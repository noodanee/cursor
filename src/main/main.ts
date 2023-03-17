var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fetch from 'node-fetch';
import { setupCommentIndexer } from './commentIndexer';
import { setupTestIndexer } from './testIndexer';
import { setupLSPs } from './lsp';
import { setupSearch } from './search';
import { app, shell, BrowserWindow, Menu, ipcMain, session, systemPreferences, } from 'electron';
import { API_ROOT } from '../utils';
import * as path from 'path';
import * as fs from 'fs';
import { dialog, clipboard } from 'electron';
import Store from 'electron-store';
import log from 'electron-log';
import { machineIdSync } from 'node-machine-id';
import { fileSystem, setFileSystem, FileSystem } from './fileSystem';
import { setupStoreHandlers } from './storeHandler';
import { resourcesDir } from './utils';
import { setupIndex } from './indexer';
const todesktop = require('@todesktop/runtime');
todesktop.init();
// const API_ROOT = "http://amagic.io"
// const API_ROOT = "http://localhost:8000";
// export const API_ROOT = "https://aicursor.com"
// export const API_ROOT = "https://aicursor.com";
const store = new Store();
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
    app.quit();
}
// Install Chrome DevTools extensions in development
// if (!app.isPackaged) {
//     app.whenReady().then(() => {
//         installExtension(REACT_DEVELOPER_TOOLS)
//             .then((name) => console.log(`Added Extension:  ${name}`))
//             .catch((err) => console.log('An error occurred: ', err))
//     })
//     app.whenReady().then(() => {
//         installExtension(REDUX_DEVTOOLS)
//             .then((name) => console.log(`Added Extension:  ${name}`))
//             .catch((err) => console.log('An error occurred: ', err))
//     })
// }
// Remove holded defaults
if (process.platform === 'darwin')
    systemPreferences.setUserDefault('ApplePressAndHoldEnabled', 'boolean', false);
const isAppInApplicationsFolder = app.getPath('exe').includes('Applications') ||
    !app.isPackaged ||
    process.platform !== 'darwin';
let showingDialog = false;
const logLocation = path.join(app.getPath('userData'), 'log.log');
if (isAppInApplicationsFolder) {
    log.transports.file.resolvePath = () => logLocation;
}
Object.assign(console, log.functions);
const META_KEY = process.platform === 'darwin' ? 'Cmd' : 'Ctrl';
let lastTime = null;
function logError(error) {
    log.info('uncaughtException', error);
    // send log file to server
    if (isAppInApplicationsFolder &&
        (lastTime == null || Date.now() - lastTime > 1000 * 2)) {
        lastTime = Date.now();
        const logFile = fs.readFileSync(log.transports.file.getFile().path, 'utf8');
        const body = {
            name: app.getPath('userData'),
            log: encodeURIComponent(logFile),
            error: error.toString(),
        };
        fetch(API_ROOT + '/save_log', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });
    }
}
process.on('uncaughtException', (error) => {
    logError(error);
});
process.on('unhandledRejection', (error) => {
    logError(error);
});
const createWindow = () => {
    // Create the browser window.
    const main_window = new BrowserWindow(Object.assign(Object.assign({}, (process.platform === 'darwin'
        ? {
            titleBarStyle: 'hidden',
            titleBarOverlay: true,
            trafficLightPosition: { x: 10, y: 10 },
        }
        : { frame: false })), { 
        // x: 1920,
        // y: 1095,
        width: 1500, height: 800, title: 'Cursor', 
        // A strange bug in development is preventing Chrome DevTools from showing
        // when we pass a value for 'icon'. In development, let's not pass a value.
        // icon: app.isPackaged ? 'assets/icon/icon.png' : undefined,
        webPreferences: {
            // @ts-ignore
            preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
            // TODO - remove this
            allowRunningInsecureContent: true,
            webSecurity: false,
        } }));
    main_window.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
    if (!app.isPackaged) {
        main_window.webContents.openDevTools();
    }
    // this should fix devtools error
    // setTimeout(() => {
    //     main_window.webContents.openDevTools()
    // }, 2000)
    // app.whenReady().then(() => {
    //         globalShortcut.register('Alt+CommandOrControl+I', () => {
    //             BrowserWindow.getAllWindows().forEach((win) => {
    //                 win.webContents.openDevTools()
    //             })
    //         })
    //     })
    ipcMain.handle('maximize', () => {
        // First check if this is maximized
        if (main_window.isMaximized()) {
            // If it is, unmaximize it
            main_window.unmaximize();
        }
        else {
            // If it isn't, maximize it
            main_window.maximize();
        }
    });
    // add minimize and close functionality to the window buttons
    ipcMain.handle('close', () => {
        app.quit();
    });
    ipcMain.handle('minimize', () => {
        main_window.minimize();
    });
    ipcMain.handle('return_home_dir', () => {
        return machineIdSync();
    });
    // check if store has uploadPreferences, if not, then ask the user for them
    if (store.get('uploadPreferences') == undefined) {
        // const uploadPreferences =
        //     dialog.showMessageBoxSync(main_window, {
        //         type: 'question',
        //         buttons: ['Continue', 'Turn Off'],
        //         message: 'Allow Indexing',
        //         detail: 'By default, Cursor indexes your code remotely, so that the AI can understand your entire codebase. You may turn this off at anytime.',
        //         defaultId: 0,
        //         cancelId: 1,
        //     }) == 0
        // store.set('uploadPreferences', uploadPreferences)
        store.set('uploadPreferences', false);
    }
    log.info('Made main window');
    // and load the index.html of the app.
    // @ts-ignore
    main_window.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
    if (!isAppInApplicationsFolder) {
        // show the user a dialog telling them to move the app to the Applications folder
        dialog.showMessageBoxSync(main_window, {
            type: 'warning',
            title: 'Warning',
            message: 'Please move Cursor to the Applications folder',
            detail: 'The app will not work properly if it is not in the Applications folder',
        });
    }
    let menuList = [];
    const quitApp = {
        label: 'Quit App',
        click: () => {
            app.quit();
        },
        accelerator: META_KEY + '+Q',
    };
    if (process.platform === 'darwin') {
        menuList.push({
            label: process.platform === 'darwin' ? 'Custom Menu' : 'Cursor',
            submenu: [quitApp],
        });
    }
    menuList = menuList.concat([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New File',
                    click: () => {
                        main_window.webContents.send('new_file_click');
                    },
                    accelerator: META_KEY + '+N',
                },
                {
                    label: 'Open Folder',
                    click: () => {
                        main_window.webContents.send('open_folder_triggered');
                    },
                    accelerator: META_KEY + '+O',
                },
                {
                    label: 'Open Remote Folder',
                    click: () => {
                        main_window.webContents.send('openRemotePopup');
                    },
                },
                {
                    label: 'Save File',
                    click: () => {
                        main_window.webContents.send('saved');
                    },
                    accelerator: META_KEY + '+S',
                },
                {
                    label: 'Close Tab',
                    click: () => {
                        main_window.webContents.send('close_tab');
                    },
                    accelerator: META_KEY + '+W',
                },
                ...(process.platform === 'darwin'
                    ? []
                    : [{ type: 'separator' }, quitApp]),
            ],
        },
        {
            label: 'Edit',
            submenu: [
                {
                    label: 'Undo',
                    accelerator: META_KEY + '+Z',
                    selector: 'undo:',
                },
                {
                    label: 'Redo',
                    accelerator: 'Shift+Cmd+Z',
                    selector: 'redo:',
                },
                { type: 'separator' },
                {
                    label: 'Cut',
                    accelerator: META_KEY + '+X',
                    selector: 'cut:',
                },
                {
                    label: 'Copy',
                    accelerator: META_KEY + '+C',
                    selector: 'copy:',
                },
                {
                    label: 'Paste',
                    accelerator: META_KEY + '+V',
                    selector: 'paste:',
                },
                {
                    label: 'Select All',
                    accelerator: META_KEY + '+A',
                    selector: 'selectAll:',
                },
            ],
        },
        // add a zoom
        {
            label: 'View',
            submenu: [
                {
                    label: 'Zoom In',
                    click: () => {
                        main_window.webContents.send('zoom_in');
                    },
                    accelerator: META_KEY + '+plus',
                },
                {
                    label: 'Zoom Out',
                    click: () => {
                        main_window.webContents.send('zoom_out');
                    },
                    accelerator: META_KEY + '+-',
                },
                {
                    label: 'Reset Zoom',
                    click: () => {
                        main_window.webContents.send('zoom_reset');
                    },
                    accelerator: META_KEY + '+0',
                },
                {
                    label: 'Search',
                    click: () => {
                        main_window.webContents.send('search');
                    },
                    accelerator: META_KEY + '+shift+f',
                },
                {
                    label: 'File Search',
                    click: () => {
                        main_window.webContents.send('fileSearch');
                    },
                    accelerator: META_KEY + '+p',
                },
                {
                    label: 'Command Palette',
                    click: () => {
                        main_window.webContents.send('commandPalette');
                    },
                    accelerator: 'cmd+shift+p',
                },
            ],
        },
    ]);
    var menu = Menu.buildFromTemplate(menuList);
    Menu.setApplicationMenu(menu);
    ipcMain.handle('changeSettings', (event, settings) => {
        log.info('STORING SETTINGS');
        log.info(settings);
        log.info('that was the settings');
        store.set('settings', settings);
    });
    ipcMain.handle('initSettings', (event) => {
        if (store.has('settings')) {
            log.info('found settings');
            return store.get('settings');
        }
        else {
            return {};
        }
    });
    ipcMain.handle('get_platform', function (event, arg) {
        return process.platform;
    });
    log.info('setting up handle get_folder');
    ipcMain.handle('get_folder', function (event, folderName, children, origDepth, badDirectories) {
        return __awaiter(this, void 0, void 0, function* () {
            // recursively go through all files in the directory
            // and return the file names
            const files = {};
            const folders = {};
            const addToFilesFolders = function (dirName, depth) {
                return __awaiter(this, void 0, void 0, function* () {
                    let name = path.basename(dirName);
                    let newFolder = {
                        name,
                        fileIds: [],
                        folderIds: [],
                        loaded: false,
                        parentFolderId: null,
                        renameName: null,
                        isOpen: false,
                    };
                    var newFolderId = Object.keys(folders).length + 1;
                    folders[newFolderId] = newFolder;
                    if (depth < origDepth && !badDirectories.includes(name)) {
                        let fileNameList = yield fileSystem.readdirSyncWithIsDir(dirName);
                        for (let i = 0; i < fileNameList.length; i++) {
                            const { fileName, isDir } = fileNameList[i];
                            if (fileName == '.DS_Store')
                                continue;
                            if (children.includes(fileName)) {
                                continue;
                            }
                            const newName = path.join(dirName, fileName);
                            if (isDir) {
                                const res = yield addToFilesFolders(newName, depth + 1);
                                newFolder.folderIds.push(res.newFolderId);
                                res.newFolder.parentFolderId = newFolderId;
                            }
                            else {
                                var newSubFile = {
                                    parentFolderId: newFolderId,
                                    saved: true,
                                    name: path.basename(newName),
                                    renameName: null,
                                    isSelected: false,
                                };
                                var newSubFileId = Object.keys(files).length + 1;
                                files[newSubFileId] = newSubFile;
                                newFolder.fileIds.push(newSubFileId);
                            }
                        }
                        newFolder.loaded = true;
                    }
                    return { newFolder, newFolderId };
                });
            };
            yield addToFilesFolders(folderName, 0);
            return { files, folders };
        });
    });
    log.info('setting up handle getClipboard');
    ipcMain.handle('getClipboard', function (event, arg) {
        var clip = clipboard.readText();
        return clip;
    });
    ipcMain.handle('saveUploadPreference', function (event, arg) {
        store.set('uploadPreferences', arg);
    });
    ipcMain.handle('getUploadPreference', function (event, arg) {
        if (store.has('uploadPreferences')) {
            return store.get('uploadPreferences');
        }
        else {
            return false;
        }
    });
    ipcMain.handle('createTutorDir', function (event) {
        const toCopyFrom = path.join(resourcesDir, 'tutor');
        const toCopyTo = path.join(app.getPath('home'), 'cursor-tutor');
        if (fs.existsSync(toCopyTo)) {
            // delete the directory
            fs.rmdirSync(toCopyTo, { recursive: true });
        }
        // create the directory
        fs.mkdirSync(toCopyTo);
        // copy the contents of the source directory to the destination directory
        fs.cpSync(toCopyFrom, toCopyTo, { recursive: true });
        return toCopyTo;
    });
    ipcMain.handle('checkSave', function (event, filePath) {
        const iconPath = path.join(__dirname, 'assets', 'icon', 'icon128.png');
        const basename = path.basename(filePath);
        var options = {
            type: 'question',
            buttons: ['&Go Back', '&Overwrite'],
            message: `Overwrite ${basename}?`,
            icon: iconPath,
            normalizeAccessKeys: true,
            detail: 'The contents of the file on disk changed during editing.',
            defaultId: 0,
        };
        const win = BrowserWindow.getFocusedWindow();
        showingDialog = true;
        const choice = dialog.showMessageBoxSync(win, options);
        showingDialog = false;
        return choice === 1;
    });
    ipcMain.handle('check_close_tab', function (event, filePath) {
        const iconPath = path.join(__dirname, 'assets', 'icon', 'icon128.png');
        const basename = path.basename(filePath);
        var options = {
            type: 'question',
            buttons: ['&Save', "&Don't Save", '&Cancel'],
            message: `Do you want to save the changes you made to ${basename}`,
            icon: iconPath,
            normalizeAccessKeys: true,
            detail: "Your changes will be lost if you don't save them.",
        };
        const win = BrowserWindow.getFocusedWindow();
        showingDialog = true;
        const result = dialog.showMessageBoxSync(win, options);
        showingDialog = false;
        return result === 0 ? 'save' : result === 1 ? 'dont_save' : 'cancel';
    });
    ipcMain.handle('logToFile', function (event, args) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('from renderer', args);
        });
    });
    log.info('setting up handle get_file');
    ipcMain.handle('get_file', function (event, filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            // read the file and return the contents
            var data = '';
            try {
                data = yield fileSystem.readFileSync(filePath, 'utf8');
            }
            catch (_a) {
                data = '';
            }
            return data;
        });
    });
    ipcMain.handle('copy_file', function (event, arg) {
        clipboard.writeText(arg);
    });
    ipcMain.handle('getProject', function (event) {
        if (store.has('projectPath')) {
            const res = store.get('projectPath');
            return res;
        }
        else {
            return null;
        }
    });
    ipcMain.handle('getRemote', function (event) {
        let ret = {
            remoteCommand: store.has('remoteCommand')
                ? store.get('remoteCommand')
                : null,
            remotePath: store.has('remotePath')
                ? store.get('remotePath')
                : null,
        };
        return ret;
    });
    ipcMain.handle('getLastModifiedTime', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                return (yield fileSystem.statSync(arg)).mtimeMs;
            }
            catch (_a) {
                return null;
            }
        });
    });
    ipcMain.handle('saveFile', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            // Get the parent directory of the file
            const parentDir = path.dirname(arg.path);
            // If the parent directory does not exist, create it
            if (!(yield fileSystem.existsSync(parentDir))) {
                yield fileSystem.mkdirSync(parentDir, { recursive: true });
            }
            // next, Save the file
            log.info('Trying to save the folder', arg.path);
            yield fileSystem.writeFileSync(arg.path, arg.data);
            log.info('Successfully saved the file');
            return (yield fileSystem.statSync(arg.path)).mtimeMs;
        });
    });
    ipcMain.handle('checkFileExists', function (event, path) {
        return __awaiter(this, void 0, void 0, function* () {
            // check if the file exists on disk
            const fileExists = yield fileSystem.existsSync(path);
            return fileExists;
        });
    });
    ipcMain.handle('get_version', function (event) {
        return app.getVersion();
    });
    ipcMain.handle('save_folder', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            // save the file
            log.info('Trying to save the file', arg);
            // create a new folder if it doesn't exist
            if (!(yield fileSystem.existsSync(arg))) {
                yield fileSystem.mkdirSync(arg, { recursive: true });
            }
            log.info('Successfully saved the file');
            return true;
        });
    });
    ipcMain.handle('saveProject', function (event, data) {
        if (store.has('projectPath')) {
            store.delete('projectPath');
        }
        store.set('projectPath', data);
        return true;
    });
    ipcMain.handle('rename_file', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            // rename the file
            yield fileSystem.renameSync(arg.old_path, arg.new_path);
            return true;
        });
    });
    ipcMain.handle('rename_folder', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            // rename the folder
            yield fileSystem.renameSync(arg.old_path, arg.new_path);
            return true;
        });
    });
    ipcMain.handle('check_learn_codebase', function (event, arg) {
        // ask the user if we can learn their codebase, if yes, send back true
        const iconPath = path.join(__dirname, 'assets', 'icon', 'icon128.png');
        var options = {
            type: 'question',
            buttons: ['&Yes', '&No'],
            title: 'Index this folder?',
            icon: iconPath,
            normalizeAccessKeys: true,
            message: 'In order for our AI features to work, we need to index your codebase. Is it OK if we do that on this folder?.',
        };
        const win = BrowserWindow.getFocusedWindow();
        showingDialog = true;
        dialog
            .showMessageBox(win, options)
            .then((choice) => {
            showingDialog = false;
            if (choice.response == 0) {
                event.sender.send('register_learn_codebase');
            }
            else if (choice.response == 1) {
                // do nothing
            }
        })
            .catch((err) => { });
    });
    ipcMain.handle('right_click_file', function (event, arg) {
        const template = [
            {
                label: 'Rename',
                click: () => {
                    event.sender.send('rename_file_click');
                },
            },
            { type: 'separator' },
            {
                label: 'Delete',
                click: () => {
                    event.sender.send('delete_file_click');
                },
            },
        ];
        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    });
    ipcMain.handle('right_click_folder', function (event, arg) {
        const template = [
            {
                label: 'New File',
                click: () => {
                    event.sender.send('new_file_click');
                },
            },
            {
                label: 'New Folder',
                click: () => {
                    event.sender.send('new_folder_click');
                },
            },
        ];
        const additional = [
            { type: 'separator' },
            {
                label: 'Rename',
                click: () => {
                    event.sender.send('rename_file_click');
                },
            },
            { type: 'separator' },
            {
                label: 'Delete',
                click: () => {
                    const iconPath = path.join(__dirname, 'assets', 'icon', 'icon128.png');
                    var options = {
                        type: 'question',
                        buttons: ['&!Delete!', '&Cancel'],
                        title: `DANGER: Do you want to delete`,
                        icon: iconPath,
                        normalizeAccessKeys: true,
                        message: `DANGER: Do you want to delete`,
                    };
                    const win = BrowserWindow.getFocusedWindow();
                    showingDialog = true;
                    dialog
                        .showMessageBox(win, options)
                        .then((choice) => {
                        showingDialog = false;
                        if (choice.response == 0) {
                            event.sender.send('delete_folder_click');
                        }
                    })
                        .catch((err) => { });
                },
            },
        ];
        if (!arg.isRoot) {
            template.push(...additional);
        }
        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    });
    ipcMain.handle('rightMenuAtToken', function (event, arg) {
        const template = [
            {
                label: 'Definition',
                click: () => {
                    event.sender.send('getDefinition', {
                        path: arg.path,
                        offset: arg.offset,
                    });
                },
            },
        ];
        if (arg.includeAddToPrompt) {
            template.push({
                label: 'Add To Prompt',
                click: () => {
                    event.sender.send('addCodeToPrompt', arg.codeBlock);
                },
            });
        }
        const menu = Menu.buildFromTemplate(template);
        menu.popup({ window: BrowserWindow.fromWebContents(event.sender) });
    });
    ipcMain.handle('delete_file', function (event, path) {
        return __awaiter(this, void 0, void 0, function* () {
            // delete the file
            yield fileSystem.unlinkSync(path);
            return true;
        });
    });
    ipcMain.handle('delete_folder', function (event, path) {
        return __awaiter(this, void 0, void 0, function* () {
            yield fileSystem.rmSync(path);
        });
    });
    ipcMain.handle('set_remote_file_system', function (event, arg) {
        return __awaiter(this, void 0, void 0, function* () {
            // set the remote file system
            try {
                setFileSystem(new FileSystem(true, arg.sshCommand));
                yield fileSystem.testConnection();
                store.set('remoteCommand', arg.sshCommand);
                store.set('remotePath', arg.remotePath);
                return true;
            }
            catch (e) {
                setFileSystem(new FileSystem());
                return false;
            }
        });
    });
    // show the open folder dialog
    ipcMain.handle('open_folder', function (event, arg) {
        showingDialog = true;
        const result = dialog.showOpenDialogSync(main_window, {
            properties: ['openDirectory'],
        });
        showingDialog = false;
        log.info('Opening folder: ' + result);
        if (result && result.length > 0) {
            setFileSystem(new FileSystem());
            return result[0];
        }
        return null;
    });
    setupLSPs(store);
    setupSearch();
    log.info('setting up index');
    setupCommentIndexer();
    setupTestIndexer();
    setupStoreHandlers();
    setupIndex(API_ROOT, main_window);
    log.info('setup index');
};
const modifyHeaders = () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        //details.requestHeaders['Origin'] = API_ROOT;
        // details.requestHeaders['referer'] = API_ROOT;
        callback({
            responseHeaders: Object.assign(Object.assign(Object.assign({}, details.responseHeaders), { 'Content-Security-Policy': [
                    "default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';",
                ] }), details.responseHeaders),
        });
    });
};
// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', modifyHeaders);
app.on('ready', createWindow);
// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
    app.quit();
});
