var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { webFrame, contextBridge, ipcRenderer, } from 'electron';
import { getPlatformInfo } from './utils';
const addRemoveCallbacks = () => {
    const notificationCallbacks = {};
    const requestCallbacks = {};
    return {
        addNotificationCallback: (callback, language) => {
            if (language in notificationCallbacks) {
                ipcRenderer.removeListener('notificationCallbackLS', notificationCallbacks[language]);
            }
            notificationCallbacks[language] = callback;
            ipcRenderer.addListener('notificationCallbackLS', (event, data) => {
                callback(data.data);
            });
        },
        removeNotificationCallback(language) {
            if (language in notificationCallbacks) {
                ipcRenderer.removeListener('notificationCallbackLS', notificationCallbacks[language]);
                delete notificationCallbacks[language];
            }
        },
        addRequestCallback: (callback, language) => {
            if (language in requestCallbacks) {
                ipcRenderer.removeListener('requestCallbackLS', requestCallbacks[language]);
            }
            requestCallbacks[language] = callback;
            ipcRenderer.addListener('requestCallbackLS', (event, data) => {
                // This was a bug that I fixed where we used to just use callback
                // here rather than first check the language
                let result = requestCallbacks[data.language](data.data);
                ipcRenderer.invoke('responseCallbackLS' + data.identifier, result);
            });
        },
        removeRequestCallback(language) {
            if (language in requestCallbacks) {
                ipcRenderer.removeListener('requestCallbackLS', requestCallbacks[language]);
                delete requestCallbacks[language];
            }
        },
    };
};
export const clientPreloads = () => {
    return Object.assign({ stopLS: (language) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('stopLS', language);
        }), getLSState: (language) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('getLSState', language);
        }), installLS: (language, rootDir) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('installLS', { language, rootDir });
        }), startLS: (language, rootDir) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('startLS', { language, rootDir });
        }), sendRequestLS: (payload) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('sendRequestLS', payload);
        }), sendNotificationLS: (payload) => __awaiter(void 0, void 0, void 0, function* () {
            return yield ipcRenderer.invoke('sendNotificationLS', payload);
        }), killLS: (language) => __awaiter(void 0, void 0, void 0, function* () {
            yield ipcRenderer.invoke('killLS', language);
        }), killAllLS: () => __awaiter(void 0, void 0, void 0, function* () {
            yield ipcRenderer.invoke('killAllLS');
        }) }, addRemoveCallbacks());
};
const info = getPlatformInfo();
const electronConnector = Object.assign(Object.assign({ PLATFORM_DELIMITER: info.PLATFORM_DELIMITER, PLATFORM_META_KEY: info.PLATFORM_META_KEY, PLATFORM_CM_KEY: info.PLATFORM_CM_KEY, IS_WINDOWS: info.IS_WINDOWS, getFolder: (dir, children = [], depth = 1, badDirectories = []) => ipcRenderer.invoke('get_folder', dir, children, depth, badDirectories), getFile: (dir) => ipcRenderer.invoke('get_file', dir), initProject: (dir) => {
        return ipcRenderer.invoke('initProject', dir);
    }, indexProject: (dir) => {
        return ipcRenderer.invoke('indexProject', dir);
    }, syncProject: (dir) => {
        return ipcRenderer.invoke('syncProject', dir);
    }, 
    /// Settings
    changeSettings: (settings) => void ipcRenderer.invoke('changeSettings', settings), initSettings: () => ipcRenderer.invoke('initSettings'), setRemoteFileSystem: (blob) => ipcRenderer.invoke('set_remote_file_system', blob), getRemote: () => ipcRenderer.invoke('getRemote'), logToFile: (obj) => ipcRenderer.invoke('logToFile', obj), maximize: () => ipcRenderer.invoke('maximize'), minimize: () => ipcRenderer.invoke('minimize'), close: () => ipcRenderer.invoke('close'), returnHomeDir: () => ipcRenderer.invoke('return_home_dir'), 
    // getProgress: (repoId: string) => ipcRenderer.invoke('getProgress', repoId),
    saveFile: (path, data) => ipcRenderer.invoke('saveFile', { path: path, data: data }), checkFileExists: (path) => ipcRenderer.invoke('checkFileExists', path), saveFolder: (path) => ipcRenderer.invoke('save_folder', path), registerSaved: (callback) => ipcRenderer.on('saved', callback), registerOpenRemotePopup: (callback) => ipcRenderer.on('openRemotePopup', callback), registerFileWasAdded: (callback) => ipcRenderer.on('fileWasAdded', callback), registerFileWasDeleted: (callback) => ipcRenderer.on('fileWasDeleted', callback), registerFolderWasAdded: (callback) => ipcRenderer.on('folderWasAdded', callback), registerFolderWasDeleted: (callback) => ipcRenderer.on('folderWasDeleted', callback), registerFileWasUpdated: (callback) => ipcRenderer.on('fileWasUpdated', callback), checkSave: (path) => ipcRenderer.invoke('checkSave', path), createTutorDir: (path) => ipcRenderer.invoke('createTutorDir', path), getLastModifiedTime: (path) => ipcRenderer.invoke('getLastModifiedTime', path), copyToClipboard: (path) => ipcRenderer.invoke('copy_file', path), getUploadPreference: () => ipcRenderer.invoke('getUploadPreference', null), saveUploadPreference: (data) => ipcRenderer.invoke('saveUploadPreference', data), setStore: (key, blob) => {
        ipcRenderer.invoke('setStore', { key, blob });
    }, getStore: (key) => ipcRenderer.invoke('getStore', key), saveComments: (blob) => {
        ipcRenderer.invoke('saveComments', blob);
    }, loadComments: (path) => {
        ipcRenderer.invoke('loadComments', path);
    }, saveTests: (blob) => {
        return ipcRenderer.invoke('saveTests', blob);
    }, loadTests: (blob) => {
        return ipcRenderer.invoke('loadTests', blob);
    }, getProject: () => ipcRenderer.invoke('getProject'), saveProject: (data) => ipcRenderer.invoke('saveProject', data), getClipboard: () => ipcRenderer.invoke('getClipboard', null), renameFile: (old_path, new_path) => ipcRenderer.invoke('rename_file', {
        old_path: old_path,
        new_path: new_path,
    }), rightClickFile: () => ipcRenderer.invoke('right_click_file', null), deleteFile: (path) => ipcRenderer.invoke('delete_file', path), deleteFolder: (path) => ipcRenderer.invoke('delete_folder', path), rightClickFolder: (path, isRoot) => ipcRenderer.invoke('right_click_folder', {
        path: path,
        isRoot: isRoot,
    }), rightMenuAtToken: (payload) => ipcRenderer.invoke('rightMenuAtToken', payload), getVersion: () => ipcRenderer.invoke('get_version', null), checkLearnCodebase: () => ipcRenderer.invoke('check_learn_codebase', null), registerLearnCodebase: (callback) => ipcRenderer.on('register_learn_codebase', callback), remove_all: () => {
        ipcRenderer.removeAllListeners('rename_file_click');
        ipcRenderer.removeAllListeners('delete_file_click');
        ipcRenderer.removeAllListeners('new_file_click');
        ipcRenderer.removeAllListeners('new_folder_click');
        ipcRenderer.removeAllListeners('new_chat_click');
        ipcRenderer.removeAllListeners('close_tab');
    }, registerRenameClick: (callback) => ipcRenderer.on('rename_file_click', callback), registerDeleteClick: (callback) => ipcRenderer.on('delete_file_click', callback), registerDeleteFolderClick: (callback) => ipcRenderer.on('delete_folder_click', callback), registerNewFileClick: (callback) => ipcRenderer.on('new_file_click', callback), registerNewFolderClick: (callback) => ipcRenderer.on('new_folder_click', callback), 
    // Added for the chatbot
    registerNewChatClick: (callback) => ipcRenderer.on('new_chat_click', callback), registerCloseTab: (callback) => ipcRenderer.on('close_tab', callback), openFolder: () => ipcRenderer.invoke('open_folder', null), registerOpenFolder: (callback) => ipcRenderer.on('open_folder_triggered', callback), 
    // cancelRequest: () => ipcRenderer.invoke('cancelRequest', null),
    searchRipGrep: (payload) => ipcRenderer.invoke('searchRipGrep', payload), searchFilesName: (payload) => ipcRenderer.invoke('searchFilesName', payload), searchFilesPath: (payload) => ipcRenderer.invoke('searchFilesPath', payload), searchFilesPathGit: (payload) => ipcRenderer.invoke('searchFilesPathGit', payload), searchFilesNameGit: (payload) => ipcRenderer.invoke('searchFilesNameGit', payload), checkCloseTab: (path) => ipcRenderer.invoke('check_close_tab', path), registerForceSaveAndCloseTab: (callback) => ipcRenderer.on('force_save_and_close_tab', callback), registerForceCloseTab: (callback) => ipcRenderer.on('force_close_tab', callback), registerZoom: (callback) => {
        function def() {
            webFrame.setZoomLevel(-1);
            callback(webFrame.getZoomFactor());
        }
        def();
        ipcRenderer.on('zoom_in', () => {
            webFrame.setZoomLevel(webFrame.getZoomLevel() + 1);
            callback(webFrame.getZoomFactor());
        });
        ipcRenderer.on('zoom_out', () => {
            webFrame.setZoomLevel(webFrame.getZoomLevel() - 1);
            callback(webFrame.getZoomFactor());
        });
        ipcRenderer.on('zoom_reset', () => {
            def();
        });
    }, zoomIn: () => webFrame.setZoomLevel(webFrame.getZoomLevel() + 1), zoomOut: () => webFrame.setZoomLevel(webFrame.getZoomLevel() - 1), zoomReset: () => webFrame.setZoomLevel(-1), getPlatform: () => {
        return ipcRenderer.invoke('get_platform');
    }, registerSearch: (callback) => ipcRenderer.on('search', callback), registerFileSearch: (callback) => ipcRenderer.on('fileSearch', callback), registerCommandPalette: (callback) => ipcRenderer.on('commandPalette', callback) }, clientPreloads()), { registerGetDefinition(callback) {
        ipcRenderer.on('getDefinition', (event, data) => {
            callback(data);
        });
    },
    registerAddCodeToPrompt(callback) {
        ipcRenderer.on('addCodeToPrompt', (event, data) => {
            callback(data);
        });
    } });
contextBridge.exposeInMainWorld('connector', electronConnector);
