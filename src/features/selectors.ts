var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getPathForFolderId, getPathForFileId, getRelativePathForFileId, } from './window/fileUtils';
import { createSelector } from 'reselect';
import { store } from '../app/store';
export const getDraggingTabId = (state) => state.global.draggingTabId;
export const getZoomFactor = (state) => state.global.zoomFactor;
export const getProgress = (state) => state.global.repoProgress;
// PANE SELECTORS
export const getPaneIsActive = (paneId) => createSelector((state) => {
    return state.global.paneState.byIds;
}, 
// Gets the actual pane
(panes) => panes[paneId].isActive);
export const getPaneStateBySplits = (state) => state.global.paneState.bySplits;
export const getPane = (paneId) => createSelector((state) => {
    return state.global.paneState.byIds;
}, 
// Gets the actual pane
(panes) => panes[paneId]);
export const getEditorSelection = (tabId) => createSelector((state) => state.global.tabCache[tabId], (tab) => { var _a; return (_a = tab.initialEditorState) === null || _a === void 0 ? void 0 : _a.selection; });
export const getCurrentTab = (paneId) => createSelector(getPane(paneId), (state) => state.global.tabs, (pane, tabs) => {
    connector;
    if (pane) {
        for (let tabId of pane.tabIds) {
            if (tabs[tabId].isActive) {
                return tabId;
            }
        }
    }
    return null;
    // We should probably throw an error instead and catch it elsewhere
    //throw new Error(`No active tab found for pane ${paneId}`);
});
export const selectFocusedTabId = createSelector((state) => state.global.paneState.byIds, (state) => state.global.tabs, (panes, tabs) => {
    for (let paneIdStr of Object.keys(panes)) {
        const paneId = parseInt(paneIdStr);
        if (panes[paneId].isActive) {
            const pane = panes[paneId];
            for (let tabId of pane.tabIds) {
                if (tabs[tabId].isActive) {
                    return tabId;
                }
            }
            return null;
        }
    }
    return null;
    //throw new Error(`No active tab found for pane ${paneId}`);
});
export const getFocusedTab = createSelector((state) => state.global.paneState.byIds, (state) => state.global.tabs, (panes, tabs) => {
    for (let paneIdStr of Object.keys(panes)) {
        const paneId = parseInt(paneIdStr);
        if (panes[paneId].isActive) {
            const pane = panes[paneId];
            for (let tabId of pane.tabIds) {
                if (tabs[tabId].isActive) {
                    return tabs[tabId];
                }
            }
            return null;
        }
    }
    return null;
    //throw new Error(`No active tab found for pane ${paneId}`);
});
export const getCurrentPane = createSelector((state) => state.global.paneState.byIds, (panes) => {
    for (let paneIdStr of Object.keys(panes)) {
        const paneId = parseInt(paneIdStr);
        if (panes[paneId].isActive) {
            return paneId;
        }
    }
    return null;
    //throw new Error(`No active pane found`);
});
// TAB SELECTORS
export const getTabs = createSelector((state) => state.global.tabs, 
// Gets the actual tab row
(tabs) => Object.values(tabs).filter((tab) => tab.isActive));
export const getTab = (tid) => createSelector((state) => state.global.tabs, 
// Gets the actual tab row
(tabs) => tabs[tid]);
export const getPageType = (tabId) => createSelector((state) => state.global.tabs, (tabs) => {
    if (tabs[tabId].isMulti) {
        return 'multi';
    }
    else {
        return 'editor';
    }
});
const searchUnseenFiles = (query, state) => __awaiter(void 0, void 0, void 0, function* () {
    if (query == '') {
        return [];
    }
    const rootPath = state.global.rootPath;
    // Now we need to search the files that haven't been seen yet
    let nameResultsFuture = connector.searchFilesNameGit({ query, rootPath });
    let pathResultsFuture = connector.searchFilesPathGit({ query, rootPath });
    const [initialNameResults, initialPathResults] = yield Promise.all([
        nameResultsFuture,
        pathResultsFuture,
    ]);
    // console.log('initialNameResults', initialNameResults)
    // console.log('initialPathResults', initialPathResults)
    let nameResults = sortPaths(query, initialNameResults);
    nameResults = nameResults.map((path) => `${rootPath}${connector.PLATFORM_DELIMITER}${path}`);
    let pathResults = sortPaths(query, initialPathResults);
    pathResults = pathResults.map((path) => `${rootPath}${connector.PLATFORM_DELIMITER}${path}`);
    pathResults = pathResults.filter((path) => !nameResults.includes(path));
    // console.log('nameResults', nameResults)
    // console.log('pathResults', pathResults)
    return [...nameResults, ...pathResults];
});
const preferredExtensions = (paths) => {
    // Common language extensions
    const extensions = new Set([
        'py',
        'js',
        'ts',
        'tsx',
        'jsx',
        'java',
        'go',
        'rb',
        'rs',
        'cpp',
        'c',
        'h',
        'hpp',
    ]);
    paths.sort((a, b) => {
        const aExt = a.split('.').pop();
        const bExt = b.split('.').pop();
        if (extensions.has(aExt) && !extensions.has(bExt)) {
            return -1;
        }
        else if (extensions.has(bExt) && !extensions.has(aExt)) {
            return 1;
        }
        else {
            return 0;
        }
    });
    return paths;
};
const sortPaths = (origQuery, paths) => {
    let query = origQuery.toLowerCase();
    paths.sort((origA, origB) => {
        let a = origA.toLowerCase();
        let b = origB.toLowerCase();
        // First get the filenames
        const aFileName = a.split(connector.PLATFORM_DELIMITER).at(-1);
        const bFileName = b.split(connector.PLATFORM_DELIMITER).at(-1);
        if (aFileName && bFileName) {
            // If the query is in the filename, put it first
            if (aFileName.includes(query) && !bFileName.includes(query)) {
                return -1;
            }
            else if (!aFileName.includes(query) &&
                bFileName.includes(query)) {
                return 1;
            }
            else if (aFileName.includes(query) && bFileName.includes(query)) {
                // If both have the query, show the one that starts with it first
                return aFileName.indexOf(query) - bFileName.indexOf(query);
            }
        }
        return a.indexOf(query) - b.indexOf(query);
    });
    return paths;
};
export const searchAllFiles = (query) => __awaiter(void 0, void 0, void 0, function* () {
    const state = store.getState();
    const storeFiles = preferredExtensions(searchFile(query)(state));
    const unseenFiles = preferredExtensions(yield searchUnseenFiles(query, state)).filter((path) => !storeFiles.includes(path));
    // We only want the first 30 results
    return [...storeFiles, ...unseenFiles].slice(0, 30);
});
/// AMAN ADDITION FOR SEARCHING FOR FILES
// // FOLDER/FILE SELECTORS
// const searchAllFile = (query: string) => (state: {}) => {
//     const appFiles = searchFile
/// AMAN ADDITION FOR SEARCHING FOR FILES
export const searchFile = (query) => createSelector((state) => state.global, (state) => state.global.files, (state, files) => {
    let resultsSet = {};
    for (let fid in files) {
        let fileId = parseInt(fid);
        const file = files[fid];
        let filename = file.name;
        const path = getPathForFileId(state, fileId);
        if (query === '' ||
            filename
                .toLowerCase()
                .replace(/\s+/g, '')
                .includes(query.toLowerCase().replace(/\s+/g, ''))) {
            resultsSet[path] = { path, filename, score: 0 };
            if (Object.keys(resultsSet).length > 50) {
                break;
            }
        }
    }
    // Second pass
    for (let fid in files) {
        let fileId = parseInt(fid);
        const file = files[fid];
        let filename = file.name;
        const path = getPathForFileId(state, fileId);
        const relativePath = getRelativePathForFileId(state, fileId);
        if (query == '' ||
            relativePath
                .toLowerCase()
                .replace(/\s+/g, '')
                .includes(query.toLowerCase().replace(/\s+/g, ''))) {
            if (!(path in resultsSet)) {
                resultsSet[path] = { path, filename, score: 1 };
            }
            if (Object.keys(resultsSet).length > 50) {
                break;
            }
        }
    }
    let results = [
        ...Object.values(resultsSet).map((r) => ({
            path: r.path,
            filename: r.filename,
        })),
    ];
    // First sort by how early the match shows up in the string (lower index is better)
    results.sort((a, b) => {
        return (a.filename.toLowerCase().indexOf(query.toLowerCase()) -
            b.filename.toLowerCase().indexOf(query.toLowerCase()));
    });
    // Then sort by the scores we set - which means it takes priority
    results.sort((a, b) => {
        return resultsSet[a.path].score - resultsSet[b.path].score;
    });
    return [...Object.keys(resultsSet)];
});
/// END OF AMAN ADDITION FOR SEARCHING FOR FILES
export const getFolder = (fid) => createSelector((state) => state.global.folders, 
// Gets the actual folder
(folders) => folders[fid]);
export const getNotDeletedFiles = (parendFolderId) => createSelector((state) => state.global.folders, (state) => state.global.files, (folders, files) => {
    const folder = folders[parendFolderId];
    return folder.fileIds.filter((fid) => !files[fid].deleted);
});
export const getFileName = (fid) => createSelector((state) => state.global.files, 
// Gets the actual file
(files) => files[fid].name);
export const getCurrentFileId = createSelector((state) => getCurrentPane(state), (state) => state, (paneId, state) => {
    if (!paneId)
        return;
    const tabId = getCurrentTab(paneId)(state);
    if (!tabId)
        return;
    const tab = getTab(tabId)(state);
    return tab.fileId;
});
export const getCurrentFileName = createSelector((state) => getCurrentPane(state), (state) => state, (paneId, state) => {
    if (!paneId)
        return;
    const tabId = getCurrentTab(paneId)(state);
    if (!tabId)
        return;
    const tab = getTab(tabId)(state);
    const fileId = tab.fileId;
    const fileName = getFileName(fileId)(state);
    return fileName;
});
export const getCurrentFilePath = createSelector((state) => getCurrentPane(state), (state) => state, (paneId, state) => {
    if (!paneId)
        return;
    const tabId = getCurrentTab(paneId)(state);
    if (!tabId)
        return;
    const tab = getTab(tabId)(state);
    const fileId = tab.fileId;
    const filePath = getPathForFileId(state.global, fileId);
    return filePath;
});
export const getAllPaths = createSelector((state) => state.global.files, (state) => state.global.folders, (state) => state.global, (files, folders, state) => {
    let filePaths = new Set();
    let folderPaths = new Set();
    for (let fid in files) {
        const fileId = parseInt(fid);
        const path = getPathForFileId(state, fileId);
        filePaths.add(path);
    }
    for (let fid in folders) {
        const folderId = parseInt(fid);
        const path = getPathForFolderId(state, folderId);
        folderPaths.add(path);
    }
    return {
        filePaths: Array.from(filePaths),
        folderPaths: Array.from(folderPaths),
    };
});
export const getFileRenameName = (fid) => createSelector((state) => state.global.files, 
// Gets the actual file
(files) => files[fid].renameName);
export const getFileIndentUnit = (fid) => createSelector((state) => state.global.files, 
// Gets the actual file
(files) => files[fid].indentUnit);
export const getFile = (fid) => createSelector((state) => state.global.files, 
// Gets the actual file
(files) => files[fid]);
export const getFolders = (state) => state.global.folders;
function getDepthWrapper(files, folders) {
    function getDepthHelper(currentFid, isFile = false) {
        if (isFile) {
            if (files[currentFid].parentFolderId == null) {
                return 0;
            }
            else {
                return getDepthHelper(files[currentFid].parentFolderId) + 1;
            }
        }
        else {
            const folder = folders[currentFid];
            if (folder.parentFolderId == null) {
                return 0;
            }
            else {
                return getDepthHelper(folder.parentFolderId) + 1;
            }
        }
    }
    return getDepthHelper;
}
export const getDepth = (folderId, isFile = false) => createSelector((state) => {
    return state.global.files;
}, (state) => state.global.folders, (files, folders) => getDepthWrapper(files, folders)(folderId, isFile));
export const getFolderPath = (fid, includeRoot = true) => (state) => getPathForFolderId(state.global, fid, includeRoot);
export const getFilePath = (fid, includeRoot = true) => (state) => getPathForFileId(state.global, fid, includeRoot);
export const getRelativeFilePath = (fid) => (state) => getRelativePathForFileId(state.global, fid);
// EDITOR SELECTORS
export const getFileContents = (fid) => createSelector((state) => state.global.fileCache, (fileCache) => fileCache[fid].contents);
// EDITOR SELECTORS
export const getFileResetContents = (fid) => createSelector((state) => state.global.fileCache, (fileCache) => fileCache[fid].counter);
export const getCachedTab = (tid) => createSelector((state) => state.global.tabCache, (tabCache) => tabCache[tid]);
// CodeMirror Transaction Selectors
export const getPendingTransactions = (tid) => createSelector((state) => state.global.tabCache, (tabCache) => tabCache[tid].pendingTransactions);
// TODO modify to be selectors
export const getKeyListeners = (state) => state.global.keyboardBindings;
export const getRootPath = (state) => state.global.rootPath;
export const getShowErrors = (state) => state.global.showError;
export const getErrorType = (state) => state.global.errorType;
export const getErrorInfo = (state) => state.global.errorInfo;
export const getVersion = (state) => state.global.version;
export const getShowRemotePopup = (state) => state.global.showRemotePopup;
export const getRemoteCommand = (state) => state.global.remoteCommand;
export const getRemotePath = (state) => state.global.remotePath;
export const getRemoteBad = (state) => state.global.remoteBad;
export const getFolderOpen = (fid) => createSelector((state) => state.global.folders[fid], (folder) => {
    return folder.isOpen;
});
export const getIsNotFirstTime = (state) => state.global.isNotFirstTime;
