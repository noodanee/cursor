import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// import keybinding and keymap
import { useState, useRef, useMemo, useEffect } from 'react';
import { EditorView } from '@codemirror/view';
import { vimStateField } from './codemirror-vim/index';
import { historyField } from '@codemirror/commands';
import { Text } from '@codemirror/state';
import { vscodeDark } from '../vscodeTheme';
import CodeMirror from './react-codemirror/index';
import { throttleCallback } from './componentUtils';
import { getCachedTab, getFileContents, getTab, getKeyListeners, getFilePath, getFileName, getPaneIsActive, getFileIndentUnit, getRelativeFilePath, getPageType, getFileRenameName, getPendingTransactions, } from '../features/selectors';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { codeUpdate, editorCreated, scrollUpdate, } from '../features/globalSlice';
import * as csel from '../features/chat/chatSelectors';
import { setDiff, diffField, rejectDiff } from '../features/extensions/diff';
import { editBoundaryEffect, insertCursorEffect, editBoundaryState, } from '../features/extensions/hackDiff';
import { MultiEditor } from './multi';
//import { useRenderDiffs} from './chat/hooks';
import { diagnosticsField, setDiagnostics, } from '../features/linter/lint';
import { useDispatchHook, customDispatch, dontShowAnnotation, } from './codemirrorHooks/dispatch';
import { getSettings } from '../features/settings/settingsSelectors';
import { useExtensions } from './codemirrorHooks/extensions';
import * as cs from '../features/chat/chatSlice';
function getPrecedingLines(view, numLines) {
    return view.state.doc.sliceString(0, view.state.selection.main.from);
    // const {startLinePos, endLinePos} = getPrecedingLinesPos(view, numLines);
    // const selectedText = view.state.doc.sliceString(startLinePos, endLinePos);
    // return selectedText;
}
function getProcedingLines(view) {
    return view.state.doc.sliceString(view.state.selection.main.to, view.state.doc.length);
    // const selection = view.state.selection.main;
    // const endLine = view.state.doc.lineAt(selection.from).number;
    // const endLinePos = view.state.doc.line(endLine).to;
    // const selectedText = view.state.doc.sliceString(selection.from, endLinePos);
    // return selectedText;
}
function getSelectedPos(view) {
    const selection = view.state.selection.main;
    const startLine = view.state.doc.lineAt(selection.from).number;
    const endLine = view.state.doc.lineAt(selection.to).number;
    const startLinePos = view.state.doc.line(startLine).from;
    const endLinePos = view.state.doc.line(endLine).to;
    return { startLinePos, endLinePos };
}
function getSelectedText(view) {
    const selection = view.state.selection.main;
    const { startLinePos, endLinePos } = getSelectedPos(view);
    const selectedText = selection.from == selection.to
        ? null
        : view.state.doc.sliceString(startLinePos, endLinePos);
    return selectedText;
}
const STATE_FIELDS = {
    history: historyField,
    vim: vimStateField,
    diffs: diffField,
    diagnostics: diagnosticsField,
    // lint: lintState
};
function useEditorHook({ tabId }) {
    const tab = useAppSelector(getTab(tabId));
    const filePath = useAppSelector(getFilePath(tab.fileId));
    const relativeFilePath = useAppSelector(getRelativeFilePath(tab.fileId));
    const fileName = useAppSelector(getFileName(tab.fileId));
    const fileIndentUnit = useAppSelector(getFileIndentUnit(tab.fileId));
    const keyListeners = useAppSelector(getKeyListeners);
    // want to force a redraw when pane active changes so that we autofocus
    const isPaneActive = useAppSelector(getPaneIsActive(tab.paneId));
    const isRenaming = useAppSelector(getFileRenameName(tab.fileId));
    const cachedTab = useAppSelector(getCachedTab(tabId));
    const cachedContent = useAppSelector(getFileContents(tab.fileId));
    const initialState = useMemo(() => {
        return cachedTab == null || cachedTab.initialEditorState == null
            ? null
            : {
                json: cachedTab.initialEditorState,
                fields: STATE_FIELDS,
            };
    }, [tabId]);
    return {
        cachedTab,
        cachedContent,
        isPaneActive,
        isRenaming,
        keyListeners,
        fileName,
        relativeFilePath,
        filePath,
        fileIndentUnit,
        initialState,
        tab,
    };
}
function usePrevious(value) {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    });
    return ref;
}
function usePreviousNumber(value) {
    const ref = useRef(value);
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}
const hashString = (str) => {
    let hash = 0;
    if (str.length == 0)
        return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return String(hash);
};
export default function Editor({ tabId }) {
    const dispatch = useAppDispatch();
    const editorRef = useRef({});
    const oldEditorRef = usePrevious(editorRef.current);
    const oldTabId = usePreviousNumber(tabId);
    const [justCreated, setJustCreated] = useState(false);
    const commandBarOpen = useAppSelector(csel.getIsCommandBarOpen);
    const lastDiffParameters = useRef(null);
    // const [lastDiffParameters, setLastDiffParameters] = useState<any>()
    const origEditorState = useRef();
    // const [origEditorState, setOrigEditorState] = useState<EditorState>()
    const settings = useAppSelector(getSettings);
    const textWrapping = settings.textWrapping == 'enabled';
    const fireCommandK = useAppSelector(csel.getFireCommandK);
    //const [seenDiffs, setSeenDiffs] = useState<any[]>([]);
    const transactions = useAppSelector(getPendingTransactions(tabId));
    const { cachedTab, cachedContent, isPaneActive, isRenaming, fileName, filePath, relativeFilePath, initialState, tab, } = useEditorHook({ tabId });
    const extensions = useExtensions({
        editorRef,
        filePath,
        relativeFilePath,
        tab,
        justCreated,
    });
    // Allows transactions to be flushed to the codemirror instance
    const transactionDispatcher = useDispatchHook({
        oldTabId,
        tabId,
        editorRef,
        transactions,
    });
    //const diffReadOnly = useRenderDiffs({editorRef, tabId});
    const lastBotMessage = useAppSelector(csel.getLastBotMessage);
    const lastUserMessage = useAppSelector(csel.getLastUserMessage);
    const readOnly = false;
    const updateRemoteState = () => {
        var _a, _b;
        if (((_b = (_a = oldEditorRef.current) === null || _a === void 0 ? void 0 : _a.view) === null || _b === void 0 ? void 0 : _b.state) != null && oldTabId != null) {
            let view = oldEditorRef.current.view;
            dispatch(codeUpdate({
                code: view.state.doc.toString(),
                update: view.state.toJSON(STATE_FIELDS),
                tabId: oldTabId,
                canMarkNotSaved: false,
            }));
        }
    };
    useEffect(() => {
        var _a;
        if (!commandBarOpen && isPaneActive) {
            (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.focus();
        }
    }, [commandBarOpen]);
    useEffect(() => {
        if (oldTabId != tabId) {
            updateRemoteState();
        }
    }, [tabId]);
    useEffect(() => {
        if (!isPaneActive) {
            // If the pane was just made inactive, we want to update the redux state of the
            // current contents
            updateRemoteState();
        }
    }, [isPaneActive]);
    // so hacky
    useEffect(() => {
        var _a;
        if (fireCommandK && isPaneActive) {
            const view = (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.view;
            if (view == null)
                return;
            const selPos = getSelectedPos(view);
            view.dispatch({
                effects: editBoundaryEffect.of({
                    start: selPos.startLinePos,
                    end: selPos.endLinePos,
                }),
            });
            const selection = view.state.selection.main;
            const cursorPos = selection.from;
            //const preceedingPos = getPrecedingLinesPos(view, 20);
            view.dispatch({
                effects: insertCursorEffect.of({
                    //pos: preceedingPos.endLinePos+1,
                    pos: cursorPos,
                }),
            });
            dispatch(cs.openCommandBar());
            dispatch(cs.activateDiffFromEditor({
                currentFile: filePath,
                precedingCode: getPrecedingLines(view, 20),
                procedingCode: getProcedingLines(view),
                currentSelection: getSelectedText(view),
                pos: cursorPos,
                selection: { from: selection.from, to: selection.to },
            }));
            dispatch(cs.turnOffCommandK());
        }
    }, [fireCommandK]);
    const [prevMessage, setPrevMessage] = useState('');
    // useEffect on the last bot message
    useEffect(() => {
        var _a;
        try {
            const view = (_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.view;
            const diffId = lastBotMessage === null || lastBotMessage === void 0 ? void 0 : lastBotMessage.conversationId;
            if (view != null) {
                if (lastBotMessage != null &&
                    lastBotMessage.currentFile == filePath &&
                    !lastBotMessage.rejected) {
                    // Always reject a diff if it exsts when the lastBotMessage is not null,
                    // corresponds to the currentFile. When not rejected, we dont add the rejection
                    // to history, which is the second argument or rejectDiff
                    if (!origEditorState.current) {
                        rejectDiff(diffId, false)(view);
                        origEditorState.current = view.state;
                        lastDiffParameters.current = null;
                    }
                    // We should be guaranteed here origEditorState.current is not null
                    // When we are an edit with a nontrivial length, enter here
                    if (lastBotMessage.type == 'edit' &&
                        lastBotMessage.message.length > 2) {
                        // remove selection range from codemirror as otherwise it looks hacky
                        view.dispatch({
                            selection: {
                                anchor: view.state.selection.main.from,
                                head: view.state.selection.main.from,
                            },
                        });
                        let edit = origEditorState.current.field(editBoundaryState);
                        if (lastBotMessage.finished &&
                            !lastBotMessage.interrupted) {
                            // If we are finished, and haven't been interrupted, then we show the
                            // full diff
                            let diffParams = {
                                0: {
                                    origText: origEditorState.current.doc,
                                    diffId,
                                    origLine: origEditorState.current.doc.lineAt(edit === null || edit === void 0 ? void 0 : edit.start).number,
                                    origEndLine: origEditorState.current.doc.lineAt(edit === null || edit === void 0 ? void 0 : edit.end).number,
                                    newText: Text.of(lastBotMessage.message.split('\n')),
                                },
                                1: true,
                                2: false,
                            };
                            rejectDiff(diffId, false)(view);
                            setDiff(diffParams[0], diffParams[1])(view);
                        }
                        else {
                            // Otherwise, we need to handle the logic streaming diffs
                            const startLine = origEditorState.current.doc.lineAt(edit === null || edit === void 0 ? void 0 : edit.start).number;
                            const endLine = origEditorState.current.doc.lineAt(edit === null || edit === void 0 ? void 0 : edit.end).number;
                            let changedLines = lastBotMessage.message.split('\n');
                            // COMMENT OUT THIS LINE TO CHANGE THE LINE-BY-LINE DIFF GENERATION
                            changedLines.pop();
                            const origLines = view
                                .state.doc.sliceString(origEditorState.current.doc.line(startLine)
                                .from, origEditorState.current.doc.line(endLine).to)
                                .split('\n');
                            // loop over all the lines in the changed text
                            let maxOrigLineIndex = 0;
                            for (let i = 0; i < changedLines.length; i++) {
                                // if the stripped length of the line is less than 10, then continue.
                                // This handles near empty or duplicate line cases
                                if (changedLines[i].replace(/\s/g, '').length <
                                    15)
                                    continue;
                                // find the max index of the line in the original text
                                const origLineIndex = origLines.indexOf(changedLines[i]);
                                if (origLineIndex != -1) {
                                    maxOrigLineIndex = Math.max(maxOrigLineIndex, origLineIndex);
                                }
                            }
                            // maxOrigLineIndex gives the index of the last line in the original selection
                            // that is also in the changed text. We use this to determine the number of lines
                            if (changedLines.length > 0 &&
                                maxOrigLineIndex < origLines.length - 1) {
                                // This is the case where the suggested revision being streamed spans multiple lines
                                // and we dont have a complete match between the original and the changed text
                                const lastChangedLine = changedLines[changedLines.length - 1];
                                if (origLines[maxOrigLineIndex + 1].startsWith(lastChangedLine)) {
                                    // Then, in the case where the last line that matches starts with the last line of the changed text,
                                    // we dont want to include the last line of the original text in the diff
                                    changedLines = changedLines.slice(0, changedLines.length - 1);
                                }
                            }
                            // if (changedLines.length == 0) return null;
                            let newText;
                            if (changedLines.length == 0) {
                                newText = Text.of(['']);
                            }
                            else {
                                newText = Text.of(changedLines);
                            }
                            // Setting max common point when necessary
                            if (maxOrigLineIndex > 0) {
                                // This is now just an insertion
                                let diffParameters = {
                                    0: {
                                        origText: origEditorState.current.doc,
                                        diffId: diffId,
                                        origLine: startLine,
                                        // origEndLine: view.state.doc.lineAt(edit?.end!).number,
                                        origEndLine: maxOrigLineIndex + startLine + 1,
                                        newText: newText,
                                    },
                                    1: false,
                                    2: lastBotMessage.interrupted &&
                                        lastBotMessage.finished,
                                    3: lastBotMessage.hitTokenLimit,
                                };
                                if (!lastDiffParameters.current ||
                                    (diffParameters[0].newText.toString() !=
                                        lastDiffParameters.current[0].newText.toString() &&
                                        diffParameters[2] ==
                                            lastDiffParameters.current[2] &&
                                        diffParameters[3] ==
                                            lastDiffParameters.current[3])) {
                                    lastDiffParameters.current = diffParameters;
                                    rejectDiff(diffId, false)(view);
                                    setDiff(diffParameters[0], diffParameters[1], diffParameters[2], diffParameters[3], maxOrigLineIndex)(view);
                                }
                                else {
                                }
                            }
                            else {
                                // This is now just an insertion
                                let diffParameters = {
                                    0: {
                                        origText: view.state.doc,
                                        diffId: diffId,
                                        origLine: startLine,
                                        // origEndLine: view.state.doc.lineAt(edit?.end!).number,
                                        origEndLine: startLine,
                                        newText: newText,
                                    },
                                    1: false,
                                    2: lastBotMessage.interrupted &&
                                        lastBotMessage.finished,
                                    3: lastBotMessage.hitTokenLimit,
                                };
                                if (!lastDiffParameters.current ||
                                    (diffParameters[0].newText.toString() !=
                                        lastDiffParameters.current[0].newText.toString() &&
                                        diffParameters[2] ==
                                            lastDiffParameters.current[2] &&
                                        diffParameters[3] ==
                                            lastDiffParameters.current[3])) {
                                    lastDiffParameters.current = diffParameters;
                                    rejectDiff(diffId, false)(view);
                                    setDiff(diffParameters[0], diffParameters[1], diffParameters[2], diffParameters[3], maxOrigLineIndex)(view);
                                }
                                else {
                                }
                            }
                            if (lastBotMessage.interrupted &&
                                lastBotMessage.finished) {
                                dispatch(cs.setMaxOrigLine(maxOrigLineIndex));
                                lastDiffParameters.current = null;
                                origEditorState.current = undefined;
                            }
                        }
                    }
                    else if (lastBotMessage.type == 'continue') {
                        rejectDiff(diffId, false)(view);
                    }
                }
                else {
                    rejectDiff(diffId)(view);
                    if (origEditorState.current) {
                        origEditorState.current = undefined;
                    }
                    if (lastDiffParameters.current) {
                        lastDiffParameters.current = null;
                    }
                }
            }
        }
        catch (e) {
            console.log(e);
        }
    }, [lastBotMessage]);
    // useEffect(() => {
    //     function handleKeyDown(e: any) {
    //         console.log(e)
    //         if (e.metaKey) {
    //             if(e.key == 'p') {
    //                 console.log('trigger')
    //                 dispatch(triggerFileSearch())
    //                 e.preventDefault()
    //             }
    //         }
    //     }
    //     // editorRef.current.editor is an HTMLDIVElement
    //     // add to the editorRefs child called cm-content
    //     const editorDiv = editorRef.current.editor!;
    //     console.log(editorDiv)
    //     // add to the editorRefs child called cm-content
    //     const editorContent = editorDiv.querySelector('.cm-content')!;
    //     console.log(editorContent)
    //     editorContent.addEventListener('keydown', handleKeyDown)
    //     // Don't forget to clean up
    //     return function cleanup() {
    //         editorContent.removeEventListener('keydown', handleKeyDown)
    //     }
    // }, [editorRef])
    return (_jsx("div", Object.assign({ className: `editor__container ${textWrapping ? '' : 'no_text_wrapping'}` }, { children: _jsx(CodeMirror
        // Needs to be filePath otherwise opening another file with the same name, the
        // editor will not change
        , { 
            // Needs to be filePath otherwise opening another file with the same name, the
            // editor will not change
            tabId: tabId, viewKey: tab.paneId, theme: vscodeDark, readOnly: readOnly, ref: editorRef, customDispatch: customDispatch, autoFocus: isPaneActive && isRenaming == null, className: "window__editor", height: "100%", onCreateEditor: (view, state) => {
                setJustCreated((old) => !old);
                if (cachedTab != null && cachedTab.scrollPos != null) {
                    view.dispatch({
                        effects: EditorView.scrollIntoView(cachedTab.scrollPos, {
                            y: 'start',
                            yMargin: 0,
                        }),
                    });
                }
                transactionDispatcher(view, transactions);
                view.scrollDOM.addEventListener('scroll', throttleCallback(() => {
                    dispatch(scrollUpdate({
                        scrollPos: view.elementAtHeight(view.scrollDOM.scrollTop).from,
                        tabId: tabId,
                    }));
                }, 400));
                dispatch(editorCreated(tabId));
                const diagnostics = view.state.field(diagnosticsField);
                view.dispatch(setDiagnostics(view.state, diagnostics));
            }, onChange: throttleCallback((code, update) => {
                let start = performance.now();
                // do any of the transactiosn contain the dontshow annotation
                const canMarkNotSaved = !update.transactions.some((t) => {
                    return (t.annotation(dontShowAnnotation) !=
                        undefined);
                });
                dispatch(codeUpdate({
                    code,
                    update: update.state.toJSON(STATE_FIELDS),
                    tabId: tabId,
                    canMarkNotSaved,
                }));
            }, 100), value: cachedContent, extensions: extensions, initialState: initialState }, filePath) })));
}
export function Page({ tid }) {
    const pageType = useAppSelector(getPageType(tid));
    let page;
    let randomId = String(Math.random());
    if (pageType == 'editor') {
        page = _jsx(Editor, { tabId: tid });
    }
    else if (pageType == 'multi') {
        page = _jsx(MultiEditor, { tabId: tid });
    }
    else {
        throw new Error(`Invalid page type ${pageType}`);
    }
    return (_jsxs("div", Object.assign({ className: "window__editorcontainer" }, { children: [page, _jsx("div", { className: "cover-bar" })] })));
}
