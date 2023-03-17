var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getLanguageFromFilename } from '../extensions/utils';
import { LanguageServerClient } from './stdioClient';
import { Text } from '@codemirror/state';
import { LSLanguages } from './stdioClient';
import { offsetToPos } from './lspPlugin';
import { getContentsIfNeeded, loadFileIfNeeded } from '../window/fileUtils';
import { URI } from 'vscode-uri';
import { createSlice } from '@reduxjs/toolkit';
var clientConnections = {};
export const initialLanguageServerState = {
    languageServers: Object.fromEntries(LSLanguages.map((l) => [
        l,
        {
            languageServer: l,
            installed: false,
            running: false,
        },
    ])),
    copilotSignedIn: false,
    copilotEnabled: true,
};
export const installLanguageServer = createAsyncThunk('settings/installLanguageServer', (languageServerName, { rejectWithValue, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    const rootDir = getState().global.rootPath;
    // @ts-ignore
    yield connector.installLS(languageServerName, rootDir);
    return languageServerName;
}));
export const runLanguageServer = createAsyncThunk('settings/runLanguageServer', (languageServerName, { getState, rejectWithValue }) => __awaiter(void 0, void 0, void 0, function* () {
    if (clientConnections[languageServerName]) {
        // Already running
        return languageServerName;
    }
    else {
        const rootPath = getState().global.rootPath;
        // @ts-ignore
        yield connector.installLS(languageServerName, rootPath);
        // @ts-ignore
        yield connector.startLS(languageServerName, rootPath);
        let newClient = new LanguageServerClient({
            language: languageServerName,
            rootUri: URI.file(rootPath).toString(),
            workspaceFolders: null,
        });
        clientConnections[languageServerName] = {
            lspName: languageServerName,
            client: newClient,
        };
        yield newClient.initializePromise;
        return languageServerName;
    }
}));
export const stopLanguageServer = createAsyncThunk('settings/stopLanguageServer', (languageServerName, { rejectWithValue, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    if (!clientConnections[languageServerName]) {
        return rejectWithValue(languageServerName);
    }
    // @ts-ignore
    yield connector.stopLS(languageServerName);
    yield dispatch(killConnection(languageServerName));
    return languageServerName;
}));
export const startConnections = createAsyncThunk('lsp/startConnections', (rootUri, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield dispatch(killAllConnections(null));
    // For now we just start copilot
    const copilotClient = new LanguageServerClient({
        language: 'copilot',
        rootUri: URI.file(rootUri).toString(),
        // TODO - make this work
        workspaceFolders: null,
    });
    clientConnections['copilot'] = {
        lspName: 'copilot',
        client: copilotClient,
    };
    yield copilotClient.initializePromise;
    const signedIn = yield copilotClient.signedIn();
    dispatch(copilotChangeSignin(signedIn));
    let maybeRun = (languageServerName) => __awaiter(void 0, void 0, void 0, function* () {
        // @ts-ignore
        let savedState = yield connector.getLSState(languageServerName);
        if (savedState == null)
            return;
        if (savedState.installed && savedState.running) {
            yield dispatch(runLanguageServer(languageServerName));
        }
    });
    yield Promise.all(LSLanguages.map(maybeRun));
}));
export const startCopilotWithoutFolder = createAsyncThunk('lsp/startCopilotWithoutFolder', (args, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield dispatch(killAllConnections(null));
    // Start copilot without a folder
    const copilotClient = new LanguageServerClient({
        language: 'copilot',
        rootUri: '/Users/mntruell/portal/electron/src',
        workspaceFolders: null,
    });
    clientConnections['copilot'] = {
        lspName: 'copilot',
        client: copilotClient,
    };
    yield copilotClient.initializePromise;
    const signedIn = yield copilotClient.signedIn();
    dispatch(copilotChangeSignin(signedIn));
}));
export const killConnection = createAsyncThunk('lsp/killConnection', (languageServerName, { getState, rejectWithValue }) => __awaiter(void 0, void 0, void 0, function* () {
    if (clientConnections[languageServerName]) {
        // Already running
        clientConnections[languageServerName].client.close();
        delete clientConnections[languageServerName];
    }
    // @ts-ignore
    yield connector.killLanguageServer(languageServerName);
    return languageServerName;
}));
export const killAllConnections = createAsyncThunk('lsp/killAllConnections', (args, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    let futures = [];
    for (let lspName in clientConnections) {
        futures.push(dispatch(killConnection(lspName)));
    }
    yield Promise.all(futures);
    // @ts-ignore
    yield connector.killAllLS();
}));
export const getDefinition = createAsyncThunk('lsp/getDefinition', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    let languageId = getLanguageFromFilename(payload.path);
    if (languageId === null) {
        return null;
    }
    let lspName = getIdentifier(languageId);
    if (lspName === null) {
        return null;
    }
    const origContents = yield getContentsIfNeeded(getState().global, payload.fid);
    const origDoc = Text.of(origContents.split('\n'));
    let client = clientConnections[lspName].client;
    const gotoResult = yield client.getDefinition({
        path: payload.path,
        pos: offsetToPos(origDoc, payload.offset),
    });
    if (!gotoResult) {
        return null;
    }
    let { newPath, range } = gotoResult;
    newPath = newPath.replace(/\//g, connector.PLATFORM_DELIMITER);
    console.log('GOT', newPath, range);
    // // TODO - tmp addition to fix goto definition errors
    // // Check if new path is inside the rootDir
    // if (!newPath.startsWith((<FullState>getState()).global.rootPath!)) {
    //     return null;
    // }
    // console.log('In the not root path');
    const response = yield dispatch(loadFileIfNeeded(newPath));
    if (!loadFileIfNeeded.fulfilled.match(response)) {
        return null;
    }
    else if (response.payload == null) {
        return null;
    }
    const { fileId, contents } = response.payload;
    // TODO - figure out why we don't accurately get the start and end offsets
    // originally
    return { fileId, newStartPos: range.start, newEndPos: range.end };
}));
export const getConnections = () => {
    return clientConnections;
};
export const getIdentifier = (languageId) => {
    switch (languageId) {
        // Typescript/javascript
        case 'typescript':
        case 'typescriptreact':
        case 'javascript':
        case 'javascriptreact':
            return 'typescript';
        // Python
        case 'python':
            return 'python';
        // HTML/CSS
        case 'html':
            return 'html';
        case 'css':
            return 'css';
        // Go
        case 'go':
            return 'go';
        // C based servers
        case 'cpp':
        case 'c':
            return 'c';
        // C-Sharp
        case 'csharp':
            return 'csharp';
        // Java
        case 'java':
            return 'java';
        // Rust
        case 'rust':
            return 'rust';
        // PHP
        case 'php':
            return 'php';
        default:
            return null;
    }
};
export function subConnection(name, newConnection) {
    clientConnections[name] = { lspName: name, client: newConnection };
}
export const languageServerSlice = createSlice({
    name: 'languageServer',
    initialState: initialLanguageServerState,
    extraReducers: (builder) => {
        // Case for installing a language server
        builder.addCase(installLanguageServer.fulfilled, (state, action) => {
            let languageName = action.payload;
            if (state.languageServers[languageName]) {
                state.languageServers[languageName].installed = true;
            }
            else {
                state.languageServers[languageName] = {
                    languageServer: languageName,
                    running: false,
                    installed: true,
                };
            }
        });
        // Case for running a language server
        builder.addCase(runLanguageServer.fulfilled, (state, action) => {
            let languageName = action.payload;
            if (state.languageServers[languageName]) {
                state.languageServers[languageName].running = true;
                state.languageServers[languageName].installed = true;
            }
            else {
                state.languageServers[languageName] = {
                    languageServer: languageName,
                    running: true,
                    installed: true,
                };
            }
        });
        // Case for killing a language server
        builder.addCase(stopLanguageServer.fulfilled, (state, action) => {
            let languageName = action.payload;
            if (state.languageServers[languageName]) {
                state.languageServers[languageName].running = false;
            }
            else {
                state.languageServers[languageName] = {
                    languageServer: languageName,
                    running: false,
                    installed: false,
                };
            }
        });
    },
    reducers: {
        copilotChangeSignin(state, action) {
            state.copilotSignedIn = action.payload;
        },
        copilotChangeEnable(state, action) {
            state.copilotEnabled = action.payload;
        },
    },
});
export const { copilotChangeSignin, copilotChangeEnable } = languageServerSlice.actions;
