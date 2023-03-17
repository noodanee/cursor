var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createAsyncThunk, createSlice, } from '@reduxjs/toolkit';
import { startConnections, getDefinition, runLanguageServer, getIdentifier, startCopilotWithoutFolder, } from './lsp/languageServerSlice';
import { changeSettingsNoSideffect } from './settings/settingsSlice';
import { getLanguageFromFilename } from './extensions/utils';
import { HoverState, nextFolderID, nextFileID, initialState, nextTabID, } from './window/state';
import { getActivePaneID, getActiveFileId, getTabForFile, insertFirstPane, insertNewTab, setActiveTab, createCachedTabIfNotExists, getActiveTabId, doCloseTab, updateEditorState, setPaneActive, doMoveTabToPane, splitPane, doSelectFile, doMoveToAdjacentPane, setOpenParentFolders, getPaneActiveTabId, } from './window/paneUtils';
import { getPathForFileId, setSelectedFile, isValidRenameName, getPathForFolderId, getNewFileName, updateCachedContents, doDeleteFile, commitFileRename, insertNewFile, triggerFileRename, sortAllFolders, getContentsIfNeeded, loadFileIfNeeded, getNewFolderName, insertNewFolder, getAllParentIds, doDeleteFolder, findFileIdFromPath, findFolderIdFromPath, abortFileRename, } from './window/fileUtils';
import { join } from '../utils';
import { updateCommentsForFile } from './comment/commentSlice';
import { updateTestsForFile } from './tests/testSlice';
import posthog from 'posthog-js';
import { removeEditor } from './codemirror/codemirrorSlice';
// export const monitorUploadProgress = createAsyncThunk(
//     'global/monitorUploadProgress',
//     async (args: null, { getState, dispatch }) => {
//         console.log('MONITORING UPLOAD PROGRESS')
//         const state = getState() as FullState
//         const { repoId } = state.global
//         //         let newProgress = await connector.getProgress(repoId)
//         dispatch(updateRepoProgress(newProgress))
//         setInterval(async () => {
//             const state = getState() as FullState
//             const { repoProgress, repoId } = state.global
//             if (repoProgress.state != 'done') {
//                 //                 let newProgress = await connector.getProgress(repoId)
//                 dispatch(updateRepoProgress(newProgress))
//             }
//         }, 2000)
//     }
// )
const BAD_DIRECTORIES = ['.git', 'node_modules', '.vscode', '.webpack'];
export const gotoDefinition = createAsyncThunk('global/gotoDefinition', (args, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const fid = getActiveFileId(getState().global);
    const response = yield dispatch(getDefinition(Object.assign({ fid }, args)));
    if (!getDefinition.fulfilled.match(response)) {
        return null;
    }
    else if (response.payload == null) {
        return null;
    }
    const { fileId, newStartPos, newEndPos } = response.payload;
    let paneId = getActivePaneID(getState().global);
    if (!paneId) {
        return;
    }
    let tabId = getTabForFile(getState().global, paneId, fileId);
    if (!tabId) {
        dispatch(insertTab({ paneId, fileId: fileId }));
        tabId = getTabForFile(getState().global, paneId, fileId);
    }
    dispatch(addTransaction({
        tabId,
        transactionFunction: {
            type: 'newSelection',
            from: {
                line: newStartPos.line,
                col: newStartPos.character,
            },
            to: { line: newEndPos.line, col: newEndPos.character },
            scroll: 'center',
        },
    }));
    dispatch(activeTab(tabId));
    // dispatch(activeTab({tabId: newTabId});
    // Set the new tab as active
    // setActiveTab((<FullState>getState()).global, newTabId);
}));
// thunks are savefile, deletefile, get from folder, renamefile, select file
export const selectFile = createAsyncThunk('global/selectFile', (fileId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const fullState = getState();
    const state = fullState.global;
    const contents = yield getContentsIfNeeded(state, fileId);
    const file = state.files[fileId];
    const name = file.name;
    const languageName = getLanguageFromFilename(name);
    const languageServerName = getIdentifier(languageName);
    const filePath = getPathForFileId(state, fileId);
    if (languageServerName != null) {
        const languageState = fullState.languageServerState.languageServers[languageServerName];
        if (languageState != null && !languageState.running) {
            dispatch(runLanguageServer(languageServerName));
        }
    }
    dispatch(afterSelectFile({ fileId, contents }));
    dispatch(loadFoldersAboveFile(fileId));
    dispatch(updateCommentsForFile({ filePath }));
    dispatch(updateTestsForFile(filePath));
}));
export const loadFoldersAboveFile = createAsyncThunk('global/loadFoldersAboveFile', (fileId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    if (state.files[fileId] == null) {
        return;
    }
    let parentFolderId = state.files[fileId].parentFolderId;
    do {
        const folder = state.folders[parentFolderId];
        if (folder.loaded == false)
            yield dispatch(loadFolder({ folderId: parentFolderId, goDeep: false }));
        parentFolderId = folder.parentFolderId;
    } while (parentFolderId != null);
}));
export const openFile = createAsyncThunk('global/openFile', ({ filePath, selectionRegions = null, }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('OPENING FILE', filePath);
    const result = yield dispatch(loadFileIfNeeded(filePath));
    if (!loadFileIfNeeded.fulfilled.match(result)) {
        return;
    }
    else if (result.payload == null) {
        return;
    }
    let { fileId, contents } = result.payload;
    yield dispatch(selectFile(fileId));
    let tabId = getActiveTabId(getState().global);
    if (selectionRegions != null) {
        let { start, end } = selectionRegions[0];
        dispatch(addTransaction({
            tabId,
            transactionFunction: {
                type: 'newSelection',
                from: { line: start.line, col: start.character },
                to: { line: end.line, col: end.character },
                scroll: 'center',
            },
        }));
    }
    return tabId;
}));
export const saveFile = createAsyncThunk('global/savedFile', (fileId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    if (fileId == null) {
        fileId = getActiveFileId(getState().global);
        if (fileId == null) {
            return;
        }
    }
    const state = getState().global;
    const file = state.files[fileId];
    const cachedFile = state.fileCache[fileId];
    if (!cachedFile) {
        return;
    }
    let path = getPathForFileId(state, fileId);
    const lmTime = (yield connector.getLastModifiedTime(path));
    console.log('lmTime', lmTime);
    console.log('savedTime', file.savedTime);
    if (file.savedTime != null &&
        lmTime != null &&
        lmTime > file.savedTime) {
        console.log('need to check!');
        const result = yield connector.checkSave(path);
        if (!result) {
            return;
        }
    }
    const savedTime = (yield connector.saveFile(path, cachedFile.contents));
    return { fileId };
}));
export const forceSaveAndClose = createAsyncThunk('global/forceSaveAndClose', (args, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield dispatch(saveFile(null));
    yield dispatch(forceCloseTab(null));
}));
export const deleteFolder = createAsyncThunk('global/deleteFolder', (folderId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    if (folderId == null) {
        folderId = state.rightClickId;
        if (!folderId) {
            return;
        }
    }
    let path = getPathForFolderId(state, folderId);
    console.log('path', path);
    yield connector.deleteFolder(path);
    return folderId;
}));
export const folderWasAdded = createAsyncThunk('global/folderWasAdded', (path, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(afterFolderWasAdded(path));
}));
export const folderWasDeleted = createAsyncThunk('global/folderWasDeleted', (path, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(afterFolderWasDeleted(path));
}));
export const fileWasUpdated = createAsyncThunk('global/fileWasUpdated', (path, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const fileId = findFileIdFromPath(state, path);
    if (fileId == null)
        return;
    const file = state.files[fileId];
    if (!file.saved)
        return;
    const currentTime = new Date().getTime();
    console.log('contents', file.lastSavedTime, currentTime);
    if (file.lastSavedTime != null &&
        currentTime - file.lastSavedTime < 2000)
        return;
    const contents = yield connector.getFile(path);
    // find all tabs with this file
    let tabIds = Object.keys(state.tabs)
        .map((key) => parseInt(key))
        .filter((key) => state.tabs[key].fileId == fileId);
    //await dispatch(afterFileWasUpdated({fileId, contents}));
    for (let tabId of tabIds) {
        dispatch(addTransaction({
            tabId,
            transactionFunction: {
                type: 'insert',
                from: { line: 0, col: 0 },
                to: null,
                text: contents,
            },
        }));
    }
}));
export const fileWasAdded = createAsyncThunk('global/fileWasAdded', (path, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('fadded');
    dispatch(afterFileWasAdded(path));
}));
export const fileWasDeleted = createAsyncThunk('global/fileWasDeleted', (path, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(afterFileWasDeleted(path));
}));
export const deleteFile = createAsyncThunk('global/deleteFile', (fileId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    if (fileId == null) {
        fileId = state.rightClickId;
        if (!fileId) {
            return;
        }
    }
    let path = getPathForFileId(state, fileId);
    console.log('delete path', path);
    yield connector.deleteFile(path);
    return fileId;
}));
export const commitRename = createAsyncThunk('global/commitRename', ({ fid, isFolder = false }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    if (fid == null) {
        fid = state.rightClickId;
        if (!fid) {
            return;
        }
    }
    const file = isFolder ? state.folders[fid] : state.files[fid];
    if (file.renameName == null || !isValidRenameName(state)) {
        return;
    }
    let oldPath = isFolder
        ? getPathForFolderId(state, fid)
        : getPathForFileId(state, fid);
    let newPath = join(getPathForFolderId(state, file.parentFolderId), file.renameName);
    // TODO: FIX
    yield connector.renameFile(oldPath, newPath);
    return state.rightClickId;
}));
export const rightClickFile = createAsyncThunk('global/rightClickFile', (fileId) => __awaiter(void 0, void 0, void 0, function* () {
    yield connector.rightClickFile();
    return fileId;
}));
export const rightClickFolder = createAsyncThunk('global/rightClickFolder', (folderId, { getState }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const folder = state.folders[folderId];
    const path = getPathForFolderId(state, folderId);
    yield connector.rightClickFolder(path, folder.parentFolderId == null);
    return folderId;
}));
export const loadFolder = createAsyncThunk('global/loadFolder', ({ folderId, goDeep }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    if (state.folders[folderId].loaded)
        return null;
    const folderPath = getPathForFolderId(state, folderId);
    // Added to ensure that we are not double adding already loaded files
    const folderChildren = state.folders[folderId].folderIds.map((fid) => state.folders[fid].name);
    const fileChildren = state.folders[folderId].fileIds.map((fid) => state.files[fid].name);
    const folderData = yield connector.getFolder(folderPath, folderChildren.concat(fileChildren));
    return { folderId, folderData };
}));
export const openRemoteFolder = createAsyncThunk('global/openRemoteFolder', (args, { dispatch, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const res = yield connector.setRemoteFileSystem({
        sshCommand: state.remoteCommand,
        remotePath: state.remotePath,
    });
    console.log('res', res);
    if (!res) {
        dispatch(setBadConnection(null));
        return null;
    }
    const folderPath = state.remotePath;
    const jsonData = { defaultFolder: folderPath };
    yield connector.saveProject(jsonData);
    const folderData = yield connector.getFolder(folderPath);
    dispatch(overwriteFolder({ folderPath, folderData }));
    // Now we are going to setup the lsp server
    yield dispatch(startConnections(folderPath));
    const version = yield connector.getVersion();
    dispatch(setVersion(version));
    let repoId = yield connector.initProject(folderPath);
    if (repoId != null) {
        console.log('Found a repo id', repoId);
        dispatch(setRepoId(repoId));
        dispatch(syncProject(null));
    }
    else {
        console.log('Reinitializing index');
        dispatch(initializeIndex(null));
    }
    // dispatch(monitorUploadProgress(null))
    // dispatch(loadRecur(4))
    const remote = yield connector.getRemote();
    console.log('Remote', remote);
    if (remote != null && remote.remoteCommand != null)
        dispatch(setRemoteCommand(remote.remoteCommand));
    if (remote != null && remote.remotePath != null)
        dispatch(setRemotePath(remote.remotePath));
}));
export const openTutorFolder = createAsyncThunk('global/openTutorFolder', (args, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    posthog.capture('Opened Tutor Folder', {});
    console.log('open');
    //@ts-ignore
    const path = yield connector.createTutorDir();
    console.log('open');
    yield dispatch(openFolder({ path }));
    // await for 1 second
    // await new Promise((resolve) => setTimeout(resolve, 100))
    console.log('open');
    function open(fn) {
        const desiredFilePath = join(path, fn);
        const state = getState().global;
        const fileId = findFileIdFromPath(state, desiredFilePath);
        if (fileId != null)
            dispatch(selectFile(fileId));
    }
    console.log('open');
    open('main.js');
    console.log('open');
    // open('main.py')
    console.log('open');
}));
export const openFolder = createAsyncThunk('global/openFolder', (args, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    posthog.capture('Opened Folder', {});
    const folderPath = (args != null ? args.path : null) || (yield connector.openFolder());
    if (folderPath == null) {
        return;
    }
    const jsonData = { defaultFolder: folderPath };
    yield connector.saveProject(jsonData);
    const folderData = yield connector.getFolder(folderPath);
    console.log('opening folder');
    dispatch(overwriteFolder({ folderPath, folderData }));
    console.log('opened folder');
    // Now we are going to setup the lsp server
    yield dispatch(startConnections(folderPath));
    console.log('opened folder');
    const version = yield connector.getVersion();
    dispatch(setVersion(version));
    console.log('opened folder');
    let repoId = yield connector.initProject(folderPath);
    if (repoId != null) {
        console.log('Got a valid repo Id');
        dispatch(setRepoId(repoId));
        dispatch(syncProject(null));
    }
    else {
        console.log('No repo id found');
        dispatch(initializeIndex(null));
    }
    console.log('opened folder');
    // dispatch(monitorUploadProgress(null))
    // dispatch(loadRecur(4))
    console.log('opened folder');
    const remote = yield connector.getRemote();
    console.log('Remote', remote);
    console.log('opened folder');
    if (remote != null && remote.remoteCommand != null)
        dispatch(setRemoteCommand(remote.remoteCommand));
    if (remote != null && remote.remotePath != null)
        dispatch(setRemotePath(remote.remotePath));
    console.log('opened folder');
}));
export const loadRecur = createAsyncThunk('global/loadRecur', (depth, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const toLoad = [];
    for (let folderIdStr of Object.keys(state.folders)) {
        const folderId = parseInt(folderIdStr);
        const folder = state.folders[folderId];
        if (!folder.loaded &&
            !BAD_DIRECTORIES.includes(folder.name) &&
            !folder.name.startsWith('.'))
            toLoad.push(folderId);
    }
    for (let folderId of toLoad) {
        const folder = state.folders[folderId];
        if (folder.name == 'node_modules')
            continue;
        if (folder.name == 'dist')
            continue;
        if (folder.name == '.git')
            continue;
        yield dispatch(loadFolder({ folderId, goDeep: false }));
    }
    const newstate = getState().global;
    if (depth > 0 && Object.keys(newstate.files).length < 1000) {
        yield dispatch(loadRecur(depth - 1));
    }
}));
export const trulyOpenFolder = createAsyncThunk('global/trulyOpenFolder', (args, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('FOUND DEFAULT FOLDER');
    const folderData = yield connector.getFolder(args, [], 1, BAD_DIRECTORIES);
    console.log('GOT FOLDER DATA');
    dispatch(overwriteFolder({ folderPath: args, folderData }));
    console.log('OVERWRITING FOLDER');
    const version = yield connector.getVersion();
    dispatch(setVersion(version));
    console.log('SETTING VERSION');
    // Now we are going to setup the lsp server
    dispatch(startConnections(args));
    console.log('SETTING UP LS');
    // Setup the project by uploading all files to a remote server
    let repoId = yield connector.initProject(args);
    console.log('Found repo Id', repoId);
    if (repoId != null) {
        console.log('Found repo id', repoId);
        dispatch(setRepoId(repoId));
        dispatch(syncProject(null));
    }
    else {
        console.log('Initializing index');
        dispatch(initializeIndex(null));
    }
    // dispatch(monitorUploadProgress(null))
    // dispatch(loadRecur(4))
}));
export const setIsNotFirstTimeWithSideEffect = createAsyncThunk('global/setIsNotFirstTimeWithSideEffect', (args, { dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    yield connector.setStore('isNotFirstTime', true);
    dispatch(setIsNotFirstTime(true));
}));
export const initState = createAsyncThunk('global/initState', (args, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('before');
    const config = yield connector.getProject();
    // if (config == null) {
    //     return
    // }
    let settings = yield connector.initSettings();
    dispatch(changeSettingsNoSideffect(settings));
    console.log('Opening folder');
    if (config != null && config.defaultFolder) {
        yield dispatch(trulyOpenFolder(config.defaultFolder));
    }
    console.log('Opened Folder');
    const isNotFirstTime = (yield connector.getStore('isNotFirstTime')) || false;
    console.log('before', isNotFirstTime, typeof isNotFirstTime);
    dispatch(setIsNotFirstTime(isNotFirstTime));
    dispatch(startCopilotWithoutFolder(null));
    const remote = yield connector.getRemote();
    console.log('Remote', remote);
    if (remote != null && remote.remoteCommand != null)
        dispatch(setRemoteCommand(remote.remoteCommand));
    if (remote != null && remote.remotePath != null)
        dispatch(setRemotePath(remote.remotePath));
    console.log('DONE WITH DEFAULT FOLDER');
}));
export const syncProject = createAsyncThunk('global/syncProject', (rootDir, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const myDir = rootDir || state.rootPath;
    yield connector.syncProject(myDir);
}));
export const initializeIndex = createAsyncThunk('global/initializeIndex', (rootDir, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const myDir = rootDir || state.rootPath;
    const repoId = yield connector.indexProject(myDir);
    console.log('Indexed project');
    dispatch(setRepoId(repoId));
}));
export const newFile = createAsyncThunk('global/newFile', ({ parentFolderId }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const actualParent = parentFolderId || state.rightClickId || 1;
    if (actualParent == null) {
        return;
    }
    const name = getNewFileName(state, actualParent);
    let parentPath = getPathForFolderId(state, actualParent);
    let newPath = `${parentPath}/${name}`;
    yield connector.saveFile(newPath, '');
    return { name, parentFolderId };
}));
export const newFolder = createAsyncThunk('global/newFolder', ({ parentFolderId }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const actualParent = parentFolderId || state.rightClickId;
    if (actualParent == null) {
        return;
    }
    const name = getNewFolderName(state, actualParent);
    let parentPath = getPathForFolderId(state, actualParent);
    let newPath = `${parentPath}/${name}`;
    yield connector.saveFolder(newPath);
    return { name, parentFolderId };
}));
export const closeTab = createAsyncThunk('global/closeTab', (tabId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    tabId = tabId || getActiveTabId(state);
    if (tabId == null)
        return;
    const fileId = state.tabs[tabId].fileId;
    const file = state.files[fileId];
    if (!file.saved) {
        const result = yield connector.checkCloseTab(getPathForFileId(state, fileId));
        if (result === 'cancel')
            return;
        if (result === 'save') {
            yield dispatch(saveFile(fileId));
        }
    }
    dispatch(forceCloseTab(tabId));
    // Also need to delete the view here
    dispatch(removeEditor({ tabId }));
}));
export const splitCurrentPane = createAsyncThunk('global/splitCurrentPane', (direction, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const paneId = getActivePaneID(state);
    console.log('got pane id', paneId);
    if (paneId == null)
        return;
    yield dispatch(splitPaneAndOpenFile({ paneId, hoverState: direction }));
}));
export const splitPaneAndOpenFile = createAsyncThunk('global/splitPaneAndOpenFile', ({ paneId, hoverState }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    const activeTabId = getActiveTabId(state);
    if (activeTabId == null)
        return;
    const activeTab = state.tabs[activeTabId];
    const activeFileId = activeTab.fileId;
    dispatch(executeSplitPane({ paneId, hoverState }));
    dispatch(selectFile(activeFileId));
}));
const globalSlice = createSlice({
    extraReducers: (builder) => {
        builder
            .addCase(saveFile.fulfilled, (state, action) => {
            if (action.payload == null)
                return;
            const { fileId } = action.payload;
            const file = state.files[fileId];
            if (file) {
                file.saved = true;
                file.lastSavedTime = new Date().getTime();
                file.deleted = false;
                file.savedTime = undefined;
            }
        })
            .addCase(deleteFile.fulfilled, (stobj, action) => {
            const state = stobj;
            const fileid = action.payload;
            const tabIds = Object.keys(state.tabs).filter((tabId) => {
                return state.tabs[parseInt(tabId)].fileId === fileid;
            });
            tabIds.forEach((tabId) => {
                doCloseTab(state, parseInt(tabId));
            });
            doDeleteFile(state, fileid);
        })
            .addCase(deleteFolder.fulfilled, (stobj, action) => {
            const state = stobj;
            const folderid = action.payload;
            const tabIds = Object.keys(state.tabs).filter((tabId) => {
                const fileid = state.tabs[parseInt(tabId)].fileId;
                const file = state.files[fileid];
                const allParentIds = file.parentFolderId == null
                    ? []
                    : [
                        file.parentFolderId,
                        ...getAllParentIds(state, file.parentFolderId),
                    ];
                return allParentIds.includes(folderid);
            });
            tabIds.forEach((tabId) => {
                doCloseTab(state, parseInt(tabId));
            });
            doDeleteFolder(state, folderid);
        })
            .addCase(commitRename.fulfilled, (stobj, action) => {
            const state = stobj;
            if (action.payload == null) {
                return;
            }
            const fileid = action.payload;
            commitFileRename(state);
        })
            .addCase(rightClickFile.fulfilled, (stobj, action) => {
            const state = stobj;
            const fileid = action.payload;
            state.rightClickId = fileid;
            state.isRightClickAFile = true;
        })
            .addCase(rightClickFolder.fulfilled, (stobj, action) => {
            const state = stobj;
            const folderid = action.payload;
            state.rightClickId = folderid;
            state.isRightClickAFile = false;
        })
            .addCase(newFile.fulfilled, (stobj, action) => {
            var _a;
            const state = stobj;
            abortFileRename(state);
            const actualParent = ((_a = action.payload) === null || _a === void 0 ? void 0 : _a.parentFolderId) || state.rightClickId || 1;
            if (actualParent == null || action.payload == null) {
                return;
            }
            const name = action.payload.name;
            const fileid = insertNewFile(state, actualParent, name);
            state.rightClickId = fileid;
            state.isRightClickAFile = true;
            doSelectFile(state, fileid);
            triggerFileRename(state);
        })
            .addCase(newFolder.fulfilled, (stobj, action) => {
            var _a;
            const state = stobj;
            const actualParent = ((_a = action.payload) === null || _a === void 0 ? void 0 : _a.parentFolderId) || state.rightClickId;
            abortFileRename(state);
            if (actualParent == null || action.payload == null) {
                return;
            }
            const name = action.payload.name;
            const folderId = insertNewFolder(state, actualParent, name);
            state.rightClickId = folderId;
            state.isRightClickAFile = false;
            triggerFileRename(state);
            setOpenParentFolders(state, folderId);
        })
            .addCase(loadFolder.fulfilled, (stobj, action) => {
            const state = stobj;
            if (action.payload == null) {
                return;
            }
            const folderId = action.payload.folderId;
            const { folders, files } = action.payload
                .folderData;
            const toAddFolderId = nextFolderID(state);
            // replace the folderId folder with folders[1]
            const loadedFolder = state.folders[folderId];
            if (loadedFolder == null)
                return;
            // might break remote
            loadedFolder.folderIds.push(...folders[1].folderIds.map((folderId) => folderId + toAddFolderId));
            Object.keys(folders).forEach((key) => {
                const numKey = parseInt(key);
                if (numKey === 1)
                    return;
                const newFolderId = numKey + toAddFolderId;
                const newFolder = folders[numKey];
                newFolder.parentFolderId = folderId;
                state.folders[newFolderId] = newFolder;
            });
            loadedFolder.folderIds.sort((a, b) => state.folders[a].name > state.folders[b].name ? 1 : -1);
            const toAddFileId = nextFileID(state);
            // might break remote
            loadedFolder.fileIds.push(...folders[1].fileIds.map((fileId) => fileId + toAddFileId));
            Object.keys(files).forEach((key) => {
                const numKey = parseInt(key);
                const newFileId = numKey + toAddFileId;
                const newFile = files[numKey];
                newFile.parentFolderId = folderId;
                state.files[newFileId] = newFile;
            });
            loadedFolder.fileIds.sort((a, b) => state.files[a].name > state.files[b].name ? 1 : -1);
            loadedFolder.loaded = true;
        });
    },
    name: 'global',
    initialState,
    // The `reducers` field lets us define reducers and generate associated actions
    reducers: {
        insertMultiTabAndSetActive(stobj, action) {
            const state = stobj;
            const paneId = getActivePaneID(state);
            const tabid = nextTabID(state);
            const tab = {
                fileId: 1,
                paneId,
                isActive: false,
                isChat: false,
                isReady: 0,
                isReadOnly: false,
                generating: false,
                interrupted: false,
                isMulti: true,
                isMultiDiff: true,
            };
            state.tabs[tabid] = tab;
            state.paneState.byIds[paneId].tabIds.push(tabid);
            createCachedTabIfNotExists(state, tabid);
            setActiveTab(state, tabid);
        },
        setMultiTabToDiff(stobj, action) {
            const state = stobj;
            const tabId = getActiveTabId(state);
            const tab = state.tabs[tabId];
            if (tab == null)
                return;
            tab.isMultiDiff = true;
        },
        insertTab(stobj, action) {
            const state = stobj;
            if (action.payload == null) {
                return;
            }
            const { paneId, fileId, scrollPos } = action.payload;
            const tabId = insertNewTab(state, paneId, fileId);
            if (scrollPos) {
                state.tabCache[tabId].scrollPos = scrollPos;
            }
        },
        activeTab(stobj, action) {
            const state = stobj;
            const tabId = action.payload;
            setActiveTab(state, tabId);
        },
        overwriteFolder(stobj, action) {
            const state = stobj;
            if (action.payload == null) {
                return;
            }
            const folderPath = action.payload.folderPath;
            const folderData = action.payload.folderData;
            if (!folderData) {
                return;
            }
            // copy initial state
            let newInitialState = structuredClone(initialState);
            Object.keys(newInitialState).forEach((key) => {
                // @ts-ignore
                state[key] = newInitialState[key];
            });
            state.folders = Object.assign({ 0: {
                    parentFolderId: null,
                    name: '',
                    renameName: '',
                    fileIds: [],
                    folderIds: [],
                    loaded: true,
                    isOpen: true,
                } }, folderData.folders);
            state.folders[1].isOpen = true;
            state.files = folderData.files;
            state.rootPath = folderPath;
            insertFirstPane(state);
            sortAllFolders(state);
        },
        scrollUpdate(stobj, action) {
            const state = stobj;
            const { tabId, scrollPos } = action.payload;
            createCachedTabIfNotExists(state, tabId);
            state.tabCache[tabId].scrollPos = scrollPos;
        },
        codeUpdate(stobj, action) {
            const state = stobj;
            const { code, update, tabId, canMarkNotSaved } = action.payload;
            const tab = state.tabs[tabId];
            if (!tab) {
                return;
            }
            const file = state.files[tab.fileId];
            let newCode = state.fileCache[tab.fileId].contents;
            // newCode = newCode.replace(/\r\n/g, '\n');
            // const repCode = code.replace(/\r\n/g, '\n');
            const repCode = code;
            if (file.saved && newCode !== repCode) {
                if (canMarkNotSaved) {
                    file.saved = false;
                }
                // get time milliseconds
                const date = new Date();
                const time = date.getTime();
                file.savedTime = time;
            }
            updateCachedContents(state, tab.fileId, code);
            updateEditorState(state, tabId, update);
        },
        vimUpdate(stobj, action) {
            const state = stobj;
            const { tabId, vimState } = action.payload;
            const tab = state.tabs[tabId];
            if (!tab)
                return;
            createCachedTabIfNotExists(state, tabId);
            state.tabCache[tabId].vimState = vimState;
        },
        triggerRename: (stobj, action) => {
            const state = stobj;
            let fileid = action.payload;
            fileid = fileid || state.rightClickId || getActiveFileId(state);
            if (!fileid)
                return;
            triggerFileRename(state);
        },
        updateRenameName: (stobj, action) => {
            const state = stobj;
            const { fid, new_name, isFolder = false } = action.payload;
            const file = isFolder ? state.folders[fid] : state.files[fid];
            if (file.renameName == null) {
                return;
            }
            file.renameName = new_name;
        },
        forceCloseTab: (stobj, action) => {
            const state = stobj;
            let tabid = action.payload || getActiveTabId(state);
            if (tabid == null)
                return;
            doCloseTab(state, tabid);
        },
        selectTab: (stobj, action) => {
            const state = stobj;
            const tabid = action.payload;
            const tab = state.tabs[tabid];
            // just get the file id and select it
            const fileid = tab.fileId;
            setActiveTab(state, tabid);
            setSelectedFile(state, fileid);
        },
        selectPane: (stobj, action) => {
            const state = stobj;
            const paneid = action.payload;
            setPaneActive(state, paneid);
        },
        editorCreated: (stobj, action) => {
            const state = stobj;
            const tabId = action.payload;
            // move up dummy variable to force a rerender
            state.tabs[tabId].isReady += 1;
        },
        moveTabToPane(stobj, action) {
            const state = stobj;
            const { tabId, paneId } = action.payload;
            doMoveTabToPane(state, tabId, paneId);
        },
        setDraggingTab: (stobj, action) => {
            const state = stobj;
            const tabId = action.payload;
            state.draggingTabId = tabId;
        },
        stopDraggingTab: (stobj, action) => {
            const state = stobj;
            state.draggingTabId = null;
        },
        moveDraggingTabToPane(stobj, action) {
            const state = stobj;
            const { paneId, hoverState } = action.payload;
            if (state.draggingTabId == null)
                return;
            let newPaneId = paneId;
            if (hoverState != HoverState.Full) {
                newPaneId = splitPane(state, paneId, hoverState);
            }
            if (newPaneId == null)
                return;
            doMoveTabToPane(state, state.draggingTabId, newPaneId);
            state.draggingTabId = null;
        },
        executeSplitPane(stobj, action) {
            const state = stobj;
            const { paneId, hoverState } = action.payload;
            splitPane(state, paneId, hoverState);
        },
        setZoomFactor: (stobj, action) => {
            const state = stobj;
            const zoomFactor = action.payload;
            state.zoomFactor = zoomFactor;
        },
        addTransaction: (stobj, action) => {
            const state = stobj;
            const { tabId, transactionFunction } = action.payload;
            const tabCache = state.tabCache[tabId];
            var newId;
            if (tabCache.pendingTransactions.length === 0) {
                newId = 0;
            }
            else {
                const oldIds = tabCache.pendingTransactions.map((x) => x.transactionId);
                newId = Math.max(...oldIds) + 1;
            }
            tabCache.pendingTransactions.push({
                transactionId: newId,
                transactionFunction: transactionFunction,
            });
        },
        splitPaneUnselected: (stobj, action) => {
            const state = stobj;
            const { paneId, direction } = action.payload;
            // First we split the pane
            const newPaneId = splitPane(state, paneId, direction);
            if (newPaneId == null)
                return;
            // First get the current active tab
            const activeTabId = getPaneActiveTabId(state, paneId);
            if (activeTabId == null)
                return;
            // Then we create a new tab with the same fileId as the activeTabid
            const activeTab = state.tabs[activeTabId];
            const fileId = activeTab.fileId;
            // create a new tab
            const newTabId = insertNewTab(state, fileId, newPaneId);
            setActiveTab(state, newTabId);
            setSelectedFile(state, fileId);
        },
        splitCurrentPaneUnselected: (stobj, action) => {
            const state = stobj;
            // Get currently active pane
            const paneId = getActivePaneID(state);
            console.log('got pane id', paneId);
            if (paneId == null)
                return;
            const { direction } = action.payload;
            // First we split the pane
            const newPaneId = splitPane(state, paneId, direction);
            console.log('new pane id', newPaneId);
            if (newPaneId == null)
                return;
            // First get the current active tab
            const activeTabId = getPaneActiveTabId(state, paneId);
            console.log('active tab id', activeTabId);
            if (activeTabId == null)
                return;
            // Then we create a new tab with the same fileId as the activeTabid
            const activeTab = state.tabs[activeTabId];
            const fileId = activeTab.fileId;
            console.log('file id', fileId);
            // create a new tab
            const newTabId = insertNewTab(state, fileId, newPaneId);
            setActiveTab(state, newTabId);
            setSelectedFile(state, fileId);
        },
        flushTransactions: (stobj, action) => {
            const state = stobj;
            const { tabId, transactionIds } = action.payload;
            const tabCache = state.tabCache[tabId];
            const pendingTransactions = tabCache.pendingTransactions;
            const newPendingTransactions = pendingTransactions.filter((x) => !transactionIds.includes(x.transactionId));
            tabCache.pendingTransactions = newPendingTransactions;
        },
        moveToPane: (stobj, action) => {
            const state = stobj;
            const { paneDirection } = action.payload;
            doMoveToAdjacentPane(state, paneDirection);
        },
        setRepoId(state, action) {
            state.repoId = action.payload;
            console.log('setRepoId', state.repoId);
        },
        updateRepoProgress(state, action) {
            state.repoProgress = action.payload;
        },
        closeError(state, action) {
            state.showError = false;
        },
        openError(state, action) {
            state.showError = true;
        },
        setVersion(state, action) {
            state.version = action.payload;
        },
        afterFileWasAdded(state, action) {
            const path = action.payload;
            const fileid = findFileIdFromPath(state, path);
            if (fileid != null) {
                if (state.files[fileid].deleted) {
                    state.files[fileid].deleted = false;
                    return;
                }
                else {
                    return;
                }
            }
            const parentFolderPath = path.substring(0, path.lastIndexOf(connector.PLATFORM_DELIMITER));
            const fileName = path.substring(path.lastIndexOf(connector.PLATFORM_DELIMITER) + 1);
            const parentFolderId = findFolderIdFromPath(state, parentFolderPath);
            const newFileId = insertNewFile(state, parentFolderId, fileName);
            const file = state.files[newFileId];
            delete state.fileCache[newFileId];
        },
        afterFileWasDeleted(state, action) {
            const path = action.payload;
            const fileid = findFileIdFromPath(state, path);
            if (fileid == null)
                return;
            const tabIds = Object.keys(state.tabs).filter((tabId) => {
                return state.tabs[parseInt(tabId)].fileId === fileid;
            });
            console.log('checking deleted');
            if (tabIds.length > 0) {
                const file = state.files[fileid];
                file.deleted = true;
                console.log('UPDATING DELETED');
            }
            else {
                doDeleteFile(state, fileid);
            }
        },
        afterFolderWasAdded(state, action) {
            const path = action.payload;
            const folderid = findFolderIdFromPath(state, path);
            if (folderid != null)
                return;
            const parentFolderPath = path.substring(0, path.lastIndexOf(connector.PLATFORM_DELIMITER));
            const fileName = path.substring(path.lastIndexOf(connector.PLATFORM_DELIMITER) + 1);
            const parentFolderId = findFolderIdFromPath(state, parentFolderPath);
            insertNewFolder(state, parentFolderId, fileName);
        },
        afterFolderWasDeleted(state, action) {
            const path = action.payload;
            const folderid = findFolderIdFromPath(state, path);
            if (folderid == null)
                return;
            const tabIds = Object.keys(state.tabs).filter((tabId) => {
                const fileid = state.tabs[parseInt(tabId)].fileId;
                const file = state.files[fileid];
                const allParentIds = file.parentFolderId == null
                    ? []
                    : [
                        file.parentFolderId,
                        ...getAllParentIds(state, file.parentFolderId),
                    ];
                return allParentIds.includes(folderid);
            });
            tabIds.forEach((tabId) => {
                doCloseTab(state, parseInt(tabId));
            });
            doDeleteFolder(state, folderid);
        },
        afterFileWasUpdated(state, action) {
            const { fileId, contents } = action.payload;
            if (fileId == null)
                return;
            console.log('contents');
            const file = state.files[fileId];
            if (!file.saved)
                return;
            console.log('contents');
            const cachedFile = state.fileCache[fileId];
            if (cachedFile == null)
                return;
            if (contents === cachedFile.contents)
                return;
            cachedFile.contents = contents;
            console.log('updated contents');
        },
        setFolderOpen(state, action) {
            const { folderId, isOpen } = action.payload;
            const folder = state.folders[folderId];
            folder.isOpen = isOpen;
        },
        closeRemotePopup(state, action) {
            state.showRemotePopup = false;
        },
        openRemotePopup(state, action) {
            state.showRemotePopup = true;
        },
        setRemoteCommand(state, action) {
            state.remoteCommand = action.payload;
        },
        setRemotePath(state, action) {
            state.remotePath = action.payload;
        },
        setBadConnection(state, action) {
            state.remoteBad = true;
        },
        afterSelectFile(state, action) {
            const { fileId, contents } = action.payload;
            updateCachedContents(state, fileId, contents);
            doSelectFile(state, fileId);
        },
        setIsNotFirstTime(state, action) {
            state.isNotFirstTime = action.payload;
        },
    },
});
export const { triggerRename, updateRenameName, selectTab, codeUpdate, forceCloseTab, overwriteFolder, editorCreated, addTransaction, flushTransactions, scrollUpdate, vimUpdate, selectPane, moveTabToPane, setDraggingTab, stopDraggingTab, moveDraggingTabToPane, setZoomFactor, activeTab, insertTab, moveToPane, insertMultiTabAndSetActive, setMultiTabToDiff, setRepoId, updateRepoProgress, closeError, openError, setVersion, afterFileWasAdded, afterFolderWasAdded, afterFileWasDeleted, afterFolderWasDeleted, afterFileWasUpdated, setFolderOpen, closeRemotePopup, setRemoteCommand, setRemotePath, openRemotePopup, setBadConnection, afterSelectFile, executeSplitPane, splitPaneUnselected, splitCurrentPaneUnselected, setIsNotFirstTime, } = globalSlice.actions;
export default globalSlice.reducer;
