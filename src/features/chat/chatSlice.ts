var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { createAsyncThunk, createSlice, } from '@reduxjs/toolkit';
import { streamSource } from '../../utils';
import { initialChatState, } from '../window/state';
import { v4 as uuidv4 } from 'uuid';
import { findFileIdFromPath, getPathForFileId } from '../window/fileUtils';
import { getCopilotSnippets } from './promptUtils';
import { addTransaction, openFile, openError, } from '../globalSlice';
import { getActiveTabId } from '../window/paneUtils';
import { API_ROOT } from '../../utils';
import posthog from 'posthog-js';
import { getViewId } from '../codemirror/codemirrorSelectors';
import { getCodeMirrorView, } from '../codemirror/codemirrorSlice';
import { setDiff } from '../extensions/diff';
import { Text } from '@codemirror/state';
import { throttle } from 'lodash';
const thunkFactory = (actionCreator, name) => createAsyncThunk(`chat/${name}`, (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(actionCreator());
    dispatch(streamResponse(null));
}));
// custom error for when they cancel a prompt
class PromptCancelledError extends Error {
    constructor() {
        super('Prompt cancelled');
        this.name = 'PromptCancelledError';
    }
}
const blankDraftMessage = (conversationId, sentAt) => ({
    sender: 'user',
    sentAt,
    message: '',
    conversationId,
    currentFile: null,
    currentSelection: null,
    precedingCode: null,
    procedingCode: null,
    otherCodeBlocks: [],
    codeSymbols: [],
    selection: null,
    msgType: 'freeform',
});
function getPayload({ getState, dispatch, conversationId, forContinue = false, }) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        dispatch(setGenerating(true));
        const state = getState();
        let chatState = state.chatState;
        let fileCache = state.global.fileCache;
        const currentTab = getActiveTabId(state.global);
        const userMessages = chatState.userMessages.filter((um) => um.conversationId == conversationId);
        const lastUserMessage = userMessages[userMessages.length - 1];
        if (!forContinue) {
            posthog.capture('Submitted Prompt', {
                type: chatState.msgType,
                prompt: lastUserMessage.message,
            });
            posthog.capture('Submitted ' + chatState.msgType, {
                prompt: lastUserMessage.message,
            });
            console.log('Adding transaction here');
            // TODO - make this work when currentTab is None
            if (currentTab != null) {
                dispatch(addTransaction({
                    tabId: currentTab,
                    transactionFunction: {
                        // IDK what this does tbh
                        type: 'bar',
                        blob: {
                            message: lastUserMessage.message,
                            activateBundle: {
                                currentFile: lastUserMessage.currentFile,
                                precedingCode: lastUserMessage.precedingCode,
                                procedingCode: lastUserMessage.procedingCode,
                                currentSelection: lastUserMessage.currentSelection,
                                selection: lastUserMessage.selection,
                                pos: chatState.pos,
                            },
                        },
                    },
                }));
            }
            console.log('Finished adding transaction');
        }
        else {
            posthog.capture('Submitted continue', {
                type: chatState.msgType,
            });
        }
        // add in prompts to the last user message
        const fileId = lastUserMessage.currentFile
            ? findFileIdFromPath(state.global, lastUserMessage.currentFile)
            : null;
        const currentFileContents = fileId ? (_a = fileCache[fileId]) === null || _a === void 0 ? void 0 : _a.contents : null;
        let copilotCodeBlocks = fileId == null ? [] : yield getCopilotSnippets(state, fileId);
        let customCodeBlocks = [
            ...lastUserMessage.otherCodeBlocks.map((block) => {
                return {
                    text: block.text,
                    path: getPathForFileId(state.global, block.fileId),
                };
            }),
        ];
        // Capture all `CODE_HERE` with regex from the last message
        let capturedSymbols = (_b = lastUserMessage.message
            .match(/`(\w+\.*)+`/g)) === null || _b === void 0 ? void 0 : _b.map((symbol) => symbol.replace(/`/g, ''));
        // Convert to a set
        let codeSymbols = new Set();
        if (capturedSymbols) {
            console.log('CAPTURED SYMBOLS', capturedSymbols);
            capturedSymbols.forEach((symbol) => {
                codeSymbols.add(symbol);
            });
        }
        // Now set filter out the lastUserMessage.codeSymbols to only be the ones that are in the message
        console.log('CODESYMBOLS', lastUserMessage.codeSymbols);
        let codeBlockIdentifiers = [
            ...lastUserMessage.codeSymbols
                .filter((symbol) => codeSymbols.has(symbol.name))
                .map((symbol) => ({
                fileName: symbol.fileName,
                blockName: symbol.name,
                type: symbol.type,
            })),
        ];
        // Split the `precedingCode` into chunks of 20 line blocks called `precedingCodeBlocks`
        const blockSize = 20;
        console.log('precedingCode', lastUserMessage.precedingCode);
        let precedingCodeBlocks = [];
        if (lastUserMessage.precedingCode) {
            let precedingCodeLines = lastUserMessage.precedingCode.split('\n');
            for (let i = 0; i < precedingCodeLines.length; i += blockSize) {
                let block = precedingCodeLines.slice(i, i + blockSize);
                precedingCodeBlocks.push(block.join('\n'));
            }
        }
        // Split the `procedingCodeBlocks` into chunks of 20 line blocks called `procedingCodeBlocks`
        let procedingCodeBlocks = [];
        if (lastUserMessage.procedingCode) {
            let procedingCodeLines = lastUserMessage.procedingCode.split('\n');
            for (let i = 0; i < procedingCodeLines.length; i += blockSize) {
                let block = procedingCodeLines.slice(i, i + blockSize);
                procedingCodeBlocks.push(block.join('\n'));
            }
        }
        const rootPath = state.global.rootPath;
        // hack
        dispatch(updateLastUserMessageMsgType(null));
        const userRequest = {
            // Core request
            message: lastUserMessage.message,
            // Context of the current file
            currentRootPath: rootPath,
            currentFileName: lastUserMessage.currentFile,
            currentFileContents,
            // Context surrounding the cursor position
            precedingCode: precedingCodeBlocks,
            currentSelection: lastUserMessage.currentSelection,
            suffixCode: procedingCodeBlocks,
            // Get Copilot values
            copilotCodeBlocks,
            // Get user defined values
            customCodeBlocks,
            codeBlockIdentifiers,
            msgType: chatState.msgType,
            maxOrigLine: forContinue
                ? getLastBotMessage(chatState, conversationId).maxOrigLine
                : null,
        };
        const data = {
            userRequest,
            userMessages: [
                ...chatState.userMessages
                    .filter((um) => um.conversationId == lastUserMessage.conversationId)
                    .slice(0, -1),
            ],
            botMessages: [
                ...chatState.botMessages.filter((bm) => bm.conversationId == lastUserMessage.conversationId),
            ],
            //useFour: state.settingsState.settings.useFour === 'enabled',
            contextType: state.settingsState.settings.contextType,
            rootPath: state.global.rootPath,
        };
        console.log('data', data);
        // document.cookie = `repo_path=${state.global.rootPath}`
        return data;
    });
}
export const diffResponse = createAsyncThunk('chat/diffResponse', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    try {
        const getFullState = () => getState();
        const data = yield getPayload({
            getState: getFullState,
            dispatch,
            conversationId: getFullState().chatState.currentConversationId,
        });
        const state = getState();
        const chatState = state.chatState;
        const currentTab = getActiveTabId(state.global);
        const numUserMessages = chatState.userMessages.length;
        function checkSend() {
            if (numUserMessages !=
                getState().chatState.userMessages.length) {
                console.log('throwing interrupt');
                dispatch(interruptGeneration(null));
                throw new PromptCancelledError();
            }
        }
        // Hit the diffs endpoint
        const server = `${API_ROOT}/diffs/`;
        // Exclamation means this can only be invoked if the value is not null
        const viewId = getViewId(currentTab)(state);
        const view = getCodeMirrorView(viewId);
        // Override data to set selected_code as the whole doc
        data.userRequest.currentSelection = view.state.doc.toString();
        // Set the message to dummy data
        data.userRequest.message =
            'create a new Modal component, importing from headlessui';
        console.log('about to send request');
        const response = yield fetch(server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Cookie: `repo_path=${state.global.rootPath}`,
            },
            //credentials: 'include',
            body: JSON.stringify(data),
        });
        // There must exist this view
        const editorViewId = getViewId(currentTab)(getState());
        const editorView = getCodeMirrorView(editorViewId);
        const isGenerating = () => getState().chatState.generating;
        const isInterrupted = () => {
            var _a;
            return (_a = getState().chatState.botMessages.at(-1)) === null || _a === void 0 ? void 0 : _a.interrupted;
        };
        let generator = streamSource(response);
        try {
            for (var _d = true, generator_1 = __asyncValues(generator), generator_1_1; generator_1_1 = yield generator_1.next(), _a = generator_1_1.done, !_a;) {
                _c = generator_1_1.value;
                _d = false;
                try {
                    let chunk = _c;
                    if (!isGenerating() || isInterrupted())
                        break;
                    checkSend();
                    // chunk will n
                    console.log({ chunk });
                    let typedChunk = chunk;
                    console.log('Got typed chunk');
                    if (typedChunk == null) {
                        // we're probably done. Just in case, dont break
                        console.log('Null difff');
                    }
                    else {
                        console.log('Going to set diff');
                        // We're gonna run set diff
                        // first, we're gonna need to get the text between start_line and end_line
                        let start = editorView.state.doc.line(typedChunk.start_line + 1).from;
                        let end = editorView.state.doc.line(typedChunk.end_line).to;
                        let origText = editorView.state.doc.slice(start, end);
                        // Set it manually
                        setDiff({
                            origLine: typedChunk.start_line + 1,
                            origEndLine: typedChunk.end_line,
                            origText,
                            newText: Text.of(typedChunk.new_code.split('\n')),
                        })(view);
                    }
                }
                finally {
                    _d = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = generator_1.return)) yield _b.call(generator_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        checkSend();
        dispatch(finishResponse());
    }
    catch (e) {
        dispatch(setGenerating(false));
        if (!(e instanceof PromptCancelledError)) {
            console.log(e);
            dispatch(openError(null));
        }
    }
}));
export const continueGeneration = createAsyncThunk('chat/continueGeneration', (conversationId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    var _e;
    try {
        const getFullState = () => getState();
        // forcontinue is set to true here
        const data = yield getPayload({
            getState: getFullState,
            dispatch,
            conversationId,
            forContinue: true,
        });
        const state = getState();
        const chatState = state.chatState;
        const currentTab = getActiveTabId(state.global);
        const numUserMessages = chatState.userMessages.length;
        function checkSend() {
            if (numUserMessages !=
                getState().chatState.userMessages.length) {
                console.log('throwing interrupt');
                dispatch(interruptGeneration(null));
                throw new PromptCancelledError();
            }
        }
        // Hit the diffs endpoint
        const server = `${API_ROOT}/continue/`;
        console.log('about to send request');
        const response = yield fetch(server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Cookie: `repo_path=${state.global.rootPath}`,
            },
            //credentials: 'include',
            body: JSON.stringify(data),
        });
        console.log('status of chatstate', chatState);
        dispatch(resumeGeneration(conversationId));
        // There must exist this view
        const editorViewId = getViewId(currentTab)(getState());
        const editorView = getCodeMirrorView(editorViewId);
        const isGenerating = () => getState().chatState.generating;
        const isInterrupted = () => {
            var _a;
            return (_a = getState().chatState.botMessages.at(-1)) === null || _a === void 0 ? void 0 : _a.interrupted;
        };
        let generator = streamSource(response);
        const getNextToken = () => __awaiter(void 0, void 0, void 0, function* () {
            let rawResult = yield generator.next();
            if (rawResult.done)
                return null;
            return rawResult.value;
        });
        let buffer = '';
        let bigBuffer = chatState.botMessages
            .filter((bm) => bm.conversationId == conversationId)
            .at(-1).message;
        const pos = chatState.pos == undefined ? 0 : chatState.pos;
        let currentPos = pos;
        let toBreak = false;
        let finalMessage = '';
        const throttledAppendResponse = throttle((text, token) => dispatch(appendResponse({ text, token })), 100);
        while (!toBreak) {
            let token = yield getNextToken();
            // When there are no more tokens, or we are interrupted, stop the generation
            if (token == null)
                break;
            if (!isGenerating() || isInterrupted())
                break;
            if ((buffer + token).match(/.*<\|\w*?\|>.*/)) {
                if ((buffer + token).includes('<|END_message|>') ||
                    (buffer + token).includes('<|END_interrupt|>')) {
                    console.log('breaking out because of match');
                    finalMessage = buffer + token;
                    buffer += token;
                    buffer = buffer.slice(0, buffer.indexOf('<|'));
                    toBreak = true;
                }
                else {
                    buffer += token;
                }
            }
            else if ((buffer + token).length > 20) {
                buffer += token;
                // Then we ignore the other stuff
            }
            else if ((buffer + token).includes('<|')) {
                buffer += token;
                continue;
            }
            else if (token.includes('<')) {
                buffer += token;
                continue;
            }
            else {
                buffer += token;
            }
            bigBuffer += buffer;
            currentPos += buffer.length;
            checkSend();
            throttledAppendResponse(bigBuffer, token);
            buffer = '';
        }
        dispatch(appendResponse({ text: bigBuffer, token: '' }));
        buffer = finalMessage;
        while (true) {
            if (buffer.includes(`<|END_interrupt|>`)) {
                buffer = buffer.replace(`<|END_interrupt|>`, '');
                // Interrupt the generation here when we run out of tokens
                console.log('INTERRUPTING FROM SPECIAL TOKEN MEANS TOKEN LIMIT');
                dispatch(tokenLimitInterrupt());
                //dispatch(cs.setChatOpen(false))
                break;
            }
            else if (buffer.includes(`<|END_message|>`)) {
                buffer = buffer.replace(`<|END_message|>`, '');
                break;
            }
            let token = yield getNextToken();
            buffer += token;
            if (!isGenerating() || isInterrupted())
                break;
        }
        console.log('Chat state');
        console.log((_e = getFullState().chatState.botMessages.at(-1)) === null || _e === void 0 ? void 0 : _e.message);
        checkSend();
        dispatch(finishResponse());
    }
    catch (e) {
        dispatch(setGenerating(false));
        if (!(e instanceof PromptCancelledError)) {
            console.log(e);
            dispatch(openError(null));
        }
    }
}));
export const streamResponse = createAsyncThunk('chat/getResponse', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const getFullState = () => getState();
        const data = yield getPayload({
            getState: getFullState,
            dispatch,
            conversationId: getFullState().chatState.currentConversationId,
        });
        const state = getState();
        const chatState = state.chatState;
        const currentTab = getActiveTabId(state.global);
        const numUserMessages = chatState.userMessages.length;
        function checkSend() {
            if (numUserMessages !=
                getState().chatState.userMessages.length) {
                console.log('throwing interrupt');
                dispatch(interruptGeneration(null));
                throw new PromptCancelledError();
            }
        }
        const server = `${API_ROOT}/conversation`;
        const response = yield fetch(server, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Cookie: `repo_path=${state.global.rootPath}`,
            },
            //credentials: 'include',
            body: JSON.stringify(data),
        });
        let generator = streamSource(response);
        const isGenerating = () => getState().chatState.generating;
        const isInterrupted = () => {
            var _a;
            return (_a = getState().chatState.botMessages.at(-1)) === null || _a === void 0 ? void 0 : _a.interrupted;
        };
        const getNextToken = () => __awaiter(void 0, void 0, void 0, function* () {
            let rawResult = yield generator.next();
            if (rawResult.done)
                return null;
            return rawResult.value;
        });
        const getNextWord = (condition, startBuffer = '', capture = (buff) => buff) => __awaiter(void 0, void 0, void 0, function* () {
            while (!condition(startBuffer)) {
                let nextToken = yield getNextToken();
                if (nextToken == null)
                    return null;
                startBuffer += nextToken;
            }
            return capture(startBuffer);
        });
        const getVariable = (startToken, variableName) => __awaiter(void 0, void 0, void 0, function* () {
            let buffer = yield getNextWord((buff) => buff.includes('|>'), startToken);
            while (true) {
                let token = yield getNextToken();
                if (token == null)
                    break;
                if (token.includes('<|')) {
                    buffer = token;
                    break;
                }
                buffer += token;
                if (buffer.includes(``)) {
                    break;
                }
            }
            while (true) {
                let token = yield getNextToken();
                buffer += token;
                if (buffer.includes(`<|END_${variableName}|>`)) {
                    break;
                }
            }
            // parse out the value between the tags
            let value = buffer.match(/<\|BEGIN_\w+\|>([\s\S]*)<\|END_\w+\|>/)[1];
            return { value, buffer };
        });
        /**
         * Sends the body of a message by identifying the token the message starts with and adding tokens until finding the end.
         * @param startToken Token the message started with
         * @param typeStr Type of message (e.g. 'continue', 'new')
         * @returns void - this function is async and returns no value
         */
        const throttledAppendResponse = throttle((text, token) => dispatch(appendResponse({ text, token })), 100);
        const sendBody = (startToken, typeStr) => __awaiter(void 0, void 0, void 0, function* () {
            yield getNextWord((buff) => buff.includes('|>'), startToken);
            let buffer = '';
            let bigBuffer = '';
            const pos = chatState.pos == undefined ? 0 : chatState.pos;
            let currentPos = pos;
            let isFirstToken = true;
            let toBreak = false;
            let finalMessage = '';
            while (!toBreak) {
                let token = yield getNextToken();
                // When there are no more tokens, or we are interrupted, stop the generation
                if (token == null)
                    break;
                if (!isGenerating() || isInterrupted())
                    break;
                if ((buffer + token).match(/.*<\|\w*?\|>.*/)) {
                    if ((buffer + token).includes('<|END_message|>') ||
                        (buffer + token).includes('<|END_interrupt|>')) {
                        console.log('breaking out because of match');
                        finalMessage = buffer + token;
                        buffer += token;
                        buffer = buffer.slice(0, buffer.indexOf('<|'));
                        toBreak = true;
                    }
                }
                else if ((buffer + token).length > 20) {
                    buffer += token;
                    // Then we ignore the other stuff
                }
                else if ((buffer + token).includes('<|')) {
                    buffer += token;
                    continue;
                }
                else if (token.includes('<')) {
                    buffer += token;
                    continue;
                }
                else {
                    buffer += token;
                }
                if (typeStr == 'continue') {
                    checkSend();
                    if (isFirstToken) {
                        dispatch(addTransaction({
                            tabId: currentTab,
                            transactionFunction: {
                                type: 'insertStartLine',
                                from: currentPos,
                                to: currentPos,
                                text: buffer,
                                scroll: 'intoView',
                            },
                        }));
                        isFirstToken = false;
                    }
                    else {
                        dispatch(addTransaction({
                            tabId: currentTab,
                            transactionFunction: {
                                type: 'insert',
                                // from: currentPos,
                                // to: currentPos,
                                text: buffer,
                                scroll: 'intoView',
                            },
                        }));
                    }
                }
                bigBuffer += buffer;
                currentPos += buffer.length;
                checkSend();
                // This might cause a bug with things like generate but not sure
                throttledAppendResponse(bigBuffer, token);
                // dispatch(appendResponse({ text: bigBuffer, token: token }))
                buffer = '';
            }
            dispatch(appendResponse({ text: bigBuffer, token: '' }));
            buffer = finalMessage;
            while (true) {
                if (buffer.includes(`<|END_interrupt|>`)) {
                    buffer = buffer.replace(`<|END_interrupt|>`, '');
                    // Interrupt the generation here when we run out of tokens
                    console.log('INTERRUPTING FROM SPECIAL TOKEN MEANS TOKEN LIMIT');
                    dispatch(tokenLimitInterrupt());
                    //dispatch(cs.setChatOpen(false))
                    break;
                }
                else if (buffer.includes(`<|END_message|>`)) {
                    buffer = buffer.replace(`<|END_message|>`, '');
                    break;
                }
                let token = yield getNextToken();
                buffer += token;
                if (!isGenerating() || isInterrupted())
                    break;
            }
        });
        const processResponse = () => __awaiter(void 0, void 0, void 0, function* () {
            let { value, buffer } = yield getVariable('', 'type');
            checkSend();
            dispatch(newResponse({ type: value.trim() }));
            yield sendBody('', value.trim());
            if (value.trim() == 'location') {
                const state = getState();
                let locString = state.chatState.botMessages[state.chatState.botMessages.length - 1].message;
                let locJson = JSON.parse(locString);
                checkSend();
                yield dispatch(openFile({
                    filePath: locJson.filePath,
                    selectionRegions: [
                        {
                            start: {
                                line: locJson.startLine,
                                character: 0,
                            },
                            end: {
                                line: locJson.endLine,
                                character: 0,
                            },
                        },
                    ],
                }));
            }
            else if (value.trim() == 'gotoEdit') {
                let generationString = state.chatState.botMessages[state.chatState.botMessages.length - 1].message;
                let generationJson = JSON.parse(generationString);
                const relevantFilePath = generationJson[0].filePath;
                //
                if (!generationJson.every((value) => value.filePath == relevantFilePath)) {
                    console.error('Got multi-file edits which are not yet supported', generationJson);
                    throw new Error(`Filepaths do not all match - ${relevantFilePath}`);
                }
                // Todo investigate this for causing an error with line numbers changing as diffs are added
                checkSend();
                const thunkResult = yield dispatch(openFile({
                    filePath: relevantFilePath,
                }));
                if (!openFile.fulfilled.match(thunkResult)) {
                    return null;
                }
                else if (thunkResult.payload == null) {
                    return null;
                }
                const tabId = thunkResult.payload;
                const transactionFunction = generationJson.map((change) => ({
                    type: 'insert',
                    from: {
                        line: change.startLine,
                        col: 0,
                    },
                    to: {
                        line: change.endLine,
                        col: 0,
                    },
                    text: change.text,
                }));
                checkSend();
                dispatch(addTransaction({
                    tabId,
                    transactionFunction,
                }));
            }
        });
        yield processResponse();
        checkSend();
        dispatch(finishResponse());
    }
    catch (e) {
        dispatch(setGenerating(false));
        if (!(e instanceof PromptCancelledError)) {
            console.log(e);
            dispatch(openError(null));
        }
    }
}));
export function getLastBotMessage(state, conversationId = null) {
    if (!conversationId) {
        conversationId = state.currentConversationId;
    }
    return state.botMessages
        .filter((m) => m.conversationId === conversationId)
        .at(-1);
}
export const beforeAppendResponse = createAsyncThunk('chat/appendResponse', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () { }));
export const chatSlice = createSlice({
    name: 'chat',
    initialState: initialChatState,
    extraReducers: (builder) => { },
    reducers: {
        addOtherBlockToMessage(chatState, action) {
            const block = action.payload;
            const conversationId = chatState.currentConversationId;
            const draftMessage = chatState.draftMessages[conversationId];
            draftMessage.otherCodeBlocks.push(block);
            //chatState.isCommandBarOpen = true;
        },
        addSymbolToMessage(chatState, action) {
            const symbol = action.payload;
            const conversationId = chatState.currentConversationId;
            const draftMessage = chatState.draftMessages[conversationId];
            console.log('ADDING SYMBOL', symbol);
            draftMessage.codeSymbols.push(symbol);
            chatState.isCommandBarOpen = true;
        },
        // Probs bad practice to have a setter as a redux action/reducer
        setCurrentConversation(chatState, action) {
            chatState.currentConversationId = action.payload;
        },
        newResponse(chatState, action) {
            chatState.chatIsOpen = true;
            console.log('New response');
            const lastUserMessage = chatState.userMessages.at(-1);
            const type = action.payload.type;
            chatState.botMessages.push({
                sender: 'bot',
                sentAt: Date.now(),
                conversationId: chatState.currentConversationId,
                type: type,
                message: '',
                lastToken: '',
                finished: false,
                currentFile: lastUserMessage.currentFile,
                interrupted: false,
            });
        },
        removeCodeBlock(chatState, action) {
            const index = action.payload;
            const conversationId = chatState.currentConversationId;
            const draftMessage = chatState.draftMessages[conversationId];
            draftMessage.otherCodeBlocks.splice(index, 1);
        },
        removeCodeSymbol(chatState, action) {
            const index = action.payload;
            const conversationId = chatState.currentConversationId;
            const draftMessage = chatState.draftMessages[conversationId];
            draftMessage.codeSymbols = draftMessage.codeSymbols.splice(index, 1);
        },
        appendResponse(chatState, action) {
            const text = action.payload.text;
            const token = action.payload.token;
            const currentConversationId = chatState.currentConversationId;
            const lastBotMessage = chatState.botMessages
                .filter((bm) => bm.conversationId == currentConversationId)
                .at(-1);
            // Setting last bot message text and token accordingly
            lastBotMessage.message = text;
            lastBotMessage.lastToken = token;
        },
        finishResponse(chatState) {
            const lastMessage = chatState.botMessages.at(-1);
            lastMessage.finished = true;
            chatState.generating = false;
            if (['continue'].includes(lastMessage.type)) {
                // if not ends with a newline
                //if (!lastMessage.message.endsWith('\n')) lastMessage.message += '\n';
            }
        },
        testMessage(chatState) {
            const lastUserMessage = chatState.userMessages.at(-1);
            // to do
            chatState.botMessages.push({
                sender: 'bot',
                sentAt: Date.now(),
                type: 'markdown',
                conversationId: lastUserMessage.conversationId,
                lastToken: '',
                message: '# Hello World\n## This is a title\n###Lorem Ipsum\n this is a test',
                finished: false,
                currentFile: lastUserMessage.currentFile,
                interrupted: false,
            });
        },
        activateDiffFromEditor(chatState, action) {
            const payload = action.payload;
            // This was Neal's line, which I think is wrong
            // if (!chatState.isCommandBarOpen) {
            if (chatState.isCommandBarOpen) {
                const conversationId = chatState.currentConversationId;
                chatState.draftMessages[conversationId] = {
                    sender: 'user',
                    sentAt: Date.now(),
                    message: '',
                    conversationId: chatState.currentConversationId,
                    otherCodeBlocks: [],
                    codeSymbols: [],
                    currentFile: payload.currentFile,
                    precedingCode: payload.precedingCode,
                    procedingCode: payload.procedingCode,
                    currentSelection: payload.currentSelection,
                    selection: payload.selection,
                    msgType: 'freeform',
                };
                chatState.pos = payload.pos;
                chatState.commandBarHistoryIndex = -1;
                // chatState.commandBarText = ''
            }
        },
        interruptGeneration(chatState, action) {
            const lastBotMessage = getLastBotMessage(chatState, action.payload);
            if (lastBotMessage) {
                console.log('pushed interrupt');
                lastBotMessage.interrupted = true;
            }
            const conversationId = chatState.currentConversationId;
            chatState.draftMessages[conversationId] = {
                sender: 'user',
                sentAt: Date.now(),
                message: '',
                conversationId: chatState.currentConversationId,
                otherCodeBlocks: [],
                codeSymbols: [],
                currentFile: null,
                precedingCode: null,
                procedingCode: null,
                currentSelection: null,
                selection: null,
                msgType: 'freeform',
            };
            chatState.generating = false;
        },
        tokenLimitInterrupt(chatState) {
            console.log('pushing interrupt');
            const lastBotMessage = chatState.botMessages.at(-1);
            if (lastBotMessage) {
                lastBotMessage.interrupted = true;
                lastBotMessage.hitTokenLimit = true;
            }
            const conversationId = chatState.currentConversationId;
            chatState.draftMessages[conversationId] = {
                sender: 'user',
                sentAt: Date.now(),
                message: '',
                conversationId: chatState.currentConversationId,
                otherCodeBlocks: [],
                codeSymbols: [],
                currentFile: null,
                precedingCode: null,
                procedingCode: null,
                currentSelection: null,
                selection: null,
                msgType: 'freeform',
            };
            chatState.generating = false;
        },
        rejectMessage(chatState, action) {
            const lastBotMessage = getLastBotMessage(chatState, action.payload);
            if (lastBotMessage)
                lastBotMessage.rejected = true;
        },
        undoRejectMessage(chatState, action) {
            const lastBotMessage = getLastBotMessage(chatState, action.payload);
            if (lastBotMessage)
                lastBotMessage.rejected = false;
        },
        setGenerating(chatState, action) {
            chatState.generating = action.payload;
        },
        openCommandBar(chatState) {
            chatState.isCommandBarOpen = true;
            chatState.chatIsOpen = false;
            const newConversationId = uuidv4();
            console.log('opening command bar');
            chatState.currentConversationId = newConversationId;
            chatState.draftMessages[newConversationId] = blankDraftMessage(newConversationId, Date.now());
            posthog.capture('Opened Command Bar', { type: chatState.msgType });
            posthog.capture('Opened ' + chatState.msgType, {});
        },
        toggleChatHistory(chatState) {
            var _a;
            if (chatState.chatIsOpen && chatState.chatHistoryIsOpen) {
                chatState.chatHistoryIsOpen = false;
            }
            else {
                if (chatState.userMessages.length > 0) {
                    chatState.chatHistoryIsOpen = true;
                    chatState.chatIsOpen = true;
                    chatState.isCommandBarOpen = false;
                    chatState.currentConversationId =
                        ((_a = chatState.userMessages.at(-1)) === null || _a === void 0 ? void 0 : _a.conversationId) || '';
                }
            }
        },
        _submitCommandBar(chatState) {
            const draftMessage = chatState.draftMessages[chatState.currentConversationId];
            chatState.userMessages.push(Object.assign(Object.assign({}, draftMessage), { sentAt: Date.now() }));
            // If we just submitted a chat response (freeform), then draft message should look like the current
            // Use message, but with the current date
            if (chatState.msgType == 'freeform') {
                chatState.draftMessages[chatState.currentConversationId] = Object.assign(Object.assign({}, draftMessage), { sentAt: Date.now(), message: '' });
            }
            else {
                chatState.draftMessages[chatState.currentConversationId] =
                    blankDraftMessage(chatState.currentConversationId, Date.now());
            }
            chatState.isCommandBarOpen = false;
        },
        resumeGeneration(chatState, conversationAction) {
            const conversationId = conversationAction.payload;
            const lastBotMessage = chatState.botMessages
                .filter((bm) => bm.conversationId == conversationId)
                .at(-1);
            if (lastBotMessage) {
                lastBotMessage.finished = false;
                lastBotMessage.interrupted = false;
                lastBotMessage.rejected = false;
                lastBotMessage.hitTokenLimit = false;
                lastBotMessage.maxOrigLine = undefined;
            }
        },
        manufacturedConversation(chatState, action) {
            var _a, _b, _c, _d;
            const newConversationId = uuidv4();
            console.log('starting manufactured conversation');
            chatState.currentConversationId = newConversationId;
            chatState.chatIsOpen = true;
            chatState.msgType = action.payload.messageType || 'freeform';
            const newUserMessage = {
                sender: 'user',
                sentAt: Date.now(),
                message: action.payload.userMessage,
                conversationId: newConversationId,
                otherCodeBlocks: [],
                codeSymbols: [],
                currentFile: (_a = action.payload.currentFile) !== null && _a !== void 0 ? _a : null,
                precedingCode: (_b = action.payload.precedingCode) !== null && _b !== void 0 ? _b : null,
                procedingCode: (_c = action.payload.procedingCode) !== null && _c !== void 0 ? _c : null,
                currentSelection: (_d = action.payload.currentSelection) !== null && _d !== void 0 ? _d : null,
                selection: null,
                msgType: 'freeform',
            };
            chatState.userMessages.push(newUserMessage);
            chatState.botMessages.push({
                sender: 'bot',
                sentAt: Date.now(),
                type: 'markdown',
                conversationId: newConversationId,
                lastToken: '',
                message: action.payload.botMessage,
                finished: true,
                currentFile: null,
                interrupted: false,
            });
            // Ready for another message in this conversation
            chatState.draftMessages[newConversationId] = Object.assign(Object.assign({}, newUserMessage), { message: '' });
        },
        // updateCommandBarText(
        //     chatState: ChatState,
        //     action: PayloadAction<string>
        // ) {
        //     const conversationId = chatState.currentConversationId
        //     chatState.draftMessages[conversationId].message = action.payload
        //     // chatState.commandBarText = action.payload
        // },
        setCurrentDraftMessage(chatState, action) {
            const conversationId = chatState.currentConversationId;
            chatState.draftMessages[conversationId].message = action.payload;
        },
        abortCommandBar(chatState) {
            const conversationId = chatState.currentConversationId;
            chatState.isCommandBarOpen = false;
        },
        turnOnCommandK(chatState) {
            chatState.fireCommandK = true;
        },
        turnOffCommandK(chatState) {
            chatState.fireCommandK = false;
        },
        changeMsgType(chatState, action) {
            chatState.msgType = action.payload;
        },
        setChatOpen(chatState, action) {
            console.log('setting chat is open to', action.payload);
            chatState.chatIsOpen = action.payload;
        },
        updateLastUserMessageMsgType(chatState, action) {
            const lastUserMessage = chatState.userMessages[chatState.userMessages.length - 1];
            if (lastUserMessage) {
                lastUserMessage.msgType = chatState.msgType;
            }
        },
        setMaxOrigLine(chatState, action) {
            const lastBotMessage = getLastBotMessage(chatState);
            // Bad - I added lots of tech debt today and will fix later
            lastBotMessage.maxOrigLine = action.payload;
        },
        moveCommandBarHistory(chatState, action) {
            if (action.payload === 'down') {
                chatState.commandBarHistoryIndex = Math.max(-1, chatState.commandBarHistoryIndex - 1);
            }
            else {
                chatState.commandBarHistoryIndex = Math.min(chatState.commandBarHistoryIndex + 1, chatState.userMessages.length - 1);
            }
            const index = chatState.userMessages.length -
                1 -
                chatState.commandBarHistoryIndex;
            console.log('moving history', chatState.commandBarHistoryIndex, index);
            const historyMessage = chatState.userMessages.at(index);
            if (historyMessage) {
                // chatState.currentConversationId = historyMessage.conversationId
                const currentConversationId = chatState.currentConversationId;
                const currentDraftMessage = chatState.draftMessages[currentConversationId];
                currentDraftMessage.message = historyMessage.message;
            }
            // if (historyMessage) {
            //     chatState.commandBarText = historyMessage.message
            // } else {
            //     chatState.commandBarText = ''
            // }
        },
    },
});
export const { appendResponse, newResponse, activateDiffFromEditor, abortCommandBar, finishResponse, testMessage, addOtherBlockToMessage, removeCodeBlock, openCommandBar, interruptGeneration, tokenLimitInterrupt, setGenerating, addSymbolToMessage, removeCodeSymbol, turnOnCommandK, turnOffCommandK, changeMsgType, setChatOpen, toggleChatHistory, moveCommandBarHistory, manufacturedConversation, setCurrentConversation, setCurrentDraftMessage, rejectMessage, undoRejectMessage, updateLastUserMessageMsgType, resumeGeneration, 
// Bad - I added tech debt and will fix later
setMaxOrigLine, } = chatSlice.actions;
export const submitCommandBar = thunkFactory(chatSlice.actions._submitCommandBar, 'submitCommandBar');
