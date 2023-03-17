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
import * as path from 'path';
import * as cp from 'child_process';
import log from 'electron-log';
import { Semaphore } from 'await-semaphore';
import { ipcMain } from 'electron';
import Store from 'electron-store';
import crypto from 'crypto';
// import gi from 'gitignore';
import { fileSystem } from './fileSystem';
import { promisify } from 'util';
const store = new Store();
const PATHS_TO_IGNORE_REGEX = [
    /.*\/python\d\.\d\/.*/,
    /.*\/dist\/.*/,
    /.*\/bin\/.*/,
    /.*\/lib\/.*/,
    /.*\/build\/.*/,
    /.*\/\.egg-info\/.*/,
    /.*\/\.venv\/.*/,
    /.*\/node_modules\/.*/,
    /.*\/__pycache__\/.*/,
    // Generated by gpt3 below
    /.*\/\.vscode\/.*/,
    /.*\/\.idea\/.*/,
    /.*\/\.vs\/.*/,
    /.*\/\.next\/.*/,
    /.*\/\.nuxt\/.*/,
    /.*\/\.cache\/.*/,
    /.*\/\.sass-cache\/.*/,
    /.*\/\.gradle\/.*/,
    /.*\/\.DS_Store\/.*/,
    /.*\/\.ipynb_checkpoints\/.*/,
    /.*\/\.pytest_cache\/.*/,
    /.*\/\.mypy_cache\/.*/,
    /.*\/\.tox\/.*/,
    /.*\/\.git\/.*/,
    /.*\/\.hg\/.*/,
    /.*\/\.svn\/.*/,
    /.*\/\.bzr\/.*/,
    /.*\/\.lock-wscript\/.*/,
    /.*\/\.wafpickle-[0-9]*\/.*/,
    /.*\/\.lock-waf_[0-9]*\/.*/,
    /.*\/\.Python\/.*/,
    /.*\/\.jupyter\/.*/,
    /.*\/\.vscode-test\/.*/,
    /.*\/\.history\/.*/,
    /.*\/\.yarn\/.*/,
    /.*\/\.yarn-cache\/.*/,
    /.*\/\.eslintcache\/.*/,
    /.*\/\.parcel-cache\/.*/,
    /.*\/\.cache-loader\/.*/,
    /.*\/\.nyc_output\/.*/,
    /.*\/\.node_repl_history\/.*/,
    /.*\/\.pnp.js\/.*/,
    /.*\/\.pnp\/.*/,
];
function checkStatus(repoId, apiRoot, rootDir) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield fetch(`${apiRoot}/repos/${repoId}/status`, {
            headers: {
                Cookie: `repo_path=${rootDir}`,
            },
        }).then((res) => __awaiter(this, void 0, void 0, function* () {
            if (res.status == 400) {
                console.log('not found', yield res.text());
                return 'notFound';
            }
            else if (res.status != 200) {
                console.log('error', yield res.text());
                return 'error';
            }
            const { status } = (yield res.json());
            return status;
        }), (err) => {
            console.log(err);
            return 'error';
        });
    });
}
export class CodebaseIndexer {
    constructor(rootDir, apiRoute, win, repoId) {
        this.rootDir = rootDir;
        this.apiRoute = apiRoute;
        this.win = win;
        this.repoId = repoId;
        this.numFiles = 0;
        this.numFilesToDelete = 0;
        this.filesUploaded = 0;
        this.semaphore = new Semaphore(20);
        this.finishedUpload = false;
        this.haveStartedWatcher = false;
        this.rootDir = rootDir;
        this.isCancelled = false;
        this.options = {
            endpoint: this.apiRoute + '/upload/repos/private',
            supportedExtensions: new Set([
                'py',
                'ts',
                'tsx',
                'js',
                'jsx',
                'go',
                'java',
                'scala',
                'rb',
                'php',
                'cs',
                'cpp',
                'c',
                'h',
                'hpp',
                'hxx',
                'cc',
                'hh',
                'cxx',
                'm',
                'mm',
                'swift',
                'rs',
                'kt',
                'kts',
                'clj',
                'cljc',
                'cljs',
                'md',
                'html',
                'css',
                'scss',
                'less',
                'sass',
                'txt',
                'json',
                'yaml',
                'yml',
                'xml',
                'toml',
                'ini',
                'conf',
                'config',
                'dockerfile',
                'dockerfile',
                'sh',
                'bash',
                'zsh',
                'fish',
                'bat',
                'ps1',
                'psm1',
            ]),
        };
        // this.options = Object.assign(defaults, options);
    }
    isInBadDir(itemPath) {
        return ((itemPath.includes('node_modules') || itemPath.includes('.git')) &&
            !(itemPath.endsWith('.git') || itemPath.endsWith('node_modules')));
    }
    isBadFile(itemPath) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.options.supportedExtensions.has(path.extname(itemPath).slice(1)) ||
                path.basename(itemPath) === 'package-lock.json' ||
                path.basename(itemPath) === 'yarn.lock' ||
                itemPath.includes('.git'))
                return true;
            // check if regex match with PATHS_TO_IGNORE_REGEX
            if (PATHS_TO_IGNORE_REGEX.some((regex) => regex.test(itemPath))) {
                return true;
            }
            // if any parent folders have dot in front of them, then ignore
            const parts = itemPath.split(path.sep);
            for (let i = 0; i < parts.length; i++) {
                if (parts[i].startsWith('.')) {
                    return true;
                }
            }
            // Check the size of the file with fs
            // const {size} = await fileSystem.statSync(itemPath);
            // console.log('FILE SIZE', size)
            // // If the size is greater than 1MB, don't index it
            // if (size > 1024 * 1024) {
            //     return true;
            // }
            return false;
        });
    }
    startWatcher() {
        console.log('----------STARTING WATCHER');
        if (this.haveStartedWatcher)
            return;
        this.haveStartedWatcher = true;
        const rootDir = this.rootDir;
        fileSystem.startWatcher(rootDir, (path) => {
            return this.isInBadDir(path);
        }, {
            add: (path) => __awaiter(this, void 0, void 0, function* () {
                console.log('ADD', path);
                // check if node_modules or .git in path
                if (this.isInBadDir(path))
                    return;
                this.win.webContents.send('fileWasAdded', path);
                console.log('detected add', path);
            }),
            addDir: (path) => __awaiter(this, void 0, void 0, function* () {
                console.log('ADDDIR', path);
                if (this.isInBadDir(path))
                    return;
                this.win.webContents.send('folderWasAdded', path);
                console.log('detected add dir', path);
            }),
            change: (path) => __awaiter(this, void 0, void 0, function* () {
                console.log('CHANGE', path);
                if (this.isInBadDir(path))
                    return;
                this.win.webContents.send('fileWasUpdated', path);
                console.log('detected change', path);
            }),
            unlink: (path) => __awaiter(this, void 0, void 0, function* () {
                console.log('UNLINK', path);
                console.log('detected unlink', path);
                if (this.isInBadDir(path))
                    return;
                this.win.webContents.send('fileWasDeleted', path);
                console.log('detected unlink', path);
            }),
            unlinkDir: (path) => __awaiter(this, void 0, void 0, function* () {
                console.log('UNLINKDIR', path);
                if (this.isInBadDir(path))
                    return;
                this.win.webContents.send('folderWasDeleted', path);
                console.log('detected unlink folder', path);
            }),
        });
    }
    cancel() {
        this.isCancelled = true;
    }
    listIgnoredFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            const gitignoredFiles = new Set();
            const gitSubmoduleFiles = new Set();
            try {
                // TODO: There's probably a more principled way to do this, using the
                // vscode scm APIs or API of the builtin git extension.
                // Need to paginate here because the response can be huge.
                let batchNum = 1;
                const batchSize = 10000;
                while (true) {
                    const gitCmd = 'git ls-files --others --ignored --exclude-standard';
                    const paginateCmd = `head -n ${batchNum * batchSize} | tail -n ${batchSize}`;
                    const execCmd = `${gitCmd} | ${paginateCmd}`;
                    const cmdResult = (yield promisify(cp.exec)(execCmd, { cwd: this.rootDir })).stdout;
                    //const cmdResult = (await fileSystem.execPromise(execCmd, this.rootDir)) as string;
                    const files = cmdResult
                        .split('\n')
                        // The result will have one empty string; filter it out.
                        .filter((filename) => filename.length > 0);
                    // If we have fewer than `batchSize` new files to ignore, we're done.
                    files.forEach((file) => gitignoredFiles.add(path.join(this.rootDir, file)));
                    if (gitignoredFiles.size < batchNum * batchSize) {
                        break;
                    }
                    batchNum++;
                }
                batchNum = 1;
                while (true) {
                    const gitCmd = `git submodule foreach --quiet \'git ls-files | sed "s|^|$path/|"\'`;
                    const paginateCmd = `head -n ${batchNum * batchSize} | tail -n ${batchSize}`;
                    const execCmd = `${gitCmd} | ${paginateCmd}`;
                    const cmdResult = (yield promisify(cp.exec)(execCmd, { cwd: this.rootDir })).stdout;
                    const files = cmdResult
                        .split('\n')
                        // The result will have one empty string; filter it out.
                        .filter((filename) => filename.length > 0);
                    // If we have fewer than `batchSize` new files to ignore, we're done.
                    files.forEach((file) => gitSubmoduleFiles.add(path.join(this.rootDir, file)));
                    if (gitSubmoduleFiles.size < batchNum * batchSize) {
                        break;
                    }
                    batchNum++;
                }
            }
            finally {
                const allIgnores = new Set([
                    ...gitignoredFiles,
                    ...gitSubmoduleFiles,
                ]);
                // Get all ignore files with 'train' in it
                return allIgnores;
            }
        });
    }
    listFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            if (fileSystem.isRemote || !store.get('uploadPreferences'))
                return [];
            const ignoredFiles = yield this.listIgnoredFiles();
            const listRecursive = (folderPath) => __awaiter(this, void 0, void 0, function* () {
                let folderContents;
                try {
                    folderContents = yield fileSystem.readdirSyncWithIsDir(folderPath);
                }
                catch (e) {
                    return [];
                }
                let files = [];
                // TODO: Handle symlinks. (Right now we'll ignore them.)
                for (const { isDir, fileName, size } of folderContents) {
                    const itemPath = path.join(folderPath, fileName);
                    if (!isDir) {
                        if (ignoredFiles.has(itemPath) ||
                            size > 1024 * 1024 ||
                            (yield this.isBadFile(itemPath))) {
                            //   log.info('extension ' + path.extname(itemPath).slice(1))
                            //   log.info('BAD FILE: ' + itemPath)
                        }
                        else {
                            files.push(itemPath);
                        }
                    }
                    else {
                        // Don't recurse into git directory.
                        if (fileName === '.git') {
                            continue;
                        }
                        else if (fileName === 'node_modules') {
                            continue;
                        }
                        else if (fileName === 'build') {
                            continue;
                        }
                        else if (fileName == 'out') {
                            continue;
                        }
                        files = files.concat(yield listRecursive(itemPath));
                    }
                }
                return files;
            });
            const res = yield listRecursive(this.rootDir);
            // get the first 1000 files
            return res.slice(0, 1000);
        });
    }
    updateFilesIfNeeded(files, repoId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (fileSystem.isRemote || !store.get('uploadPreferences'))
                return [];
            this.repoId = repoId;
            this.numFiles = files.length;
            const uploadFilesBatch = (files) => __awaiter(this, void 0, void 0, function* () {
                let allData = yield Promise.all(files.map(getContents));
                const filteredData = allData.filter((data) => data != null);
                const hashes = filteredData.map((data) => data.fileHash);
                const fileNames = filteredData.map((data) => data.relativeFilePath);
                if (fileSystem.isRemote || !store.get('uploadPreferences'))
                    return;
                const response = yield fetch(`${this.apiRoute}/upload/repos/private/uuids/${repoId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Cookie: `repo_path=${this.rootDir}`,
                    },
                    body: JSON.stringify(fileNames),
                });
                const foundHashes = (yield response.json());
                futures = [];
                for (let i = 0; i < hashes.length; i++) {
                    if (!foundHashes[i]) {
                        futures.push(uploadFile(filteredData[i]));
                    }
                    else if (foundHashes[i] != hashes[i]) {
                        futures.push(updateFile(filteredData[i]));
                    }
                }
                yield Promise.all(futures);
            });
            const getContents = (file) => __awaiter(this, void 0, void 0, function* () {
                const relativeFilePath = './' + path.relative(this.rootDir, file);
                let fileContents = '';
                try {
                    fileContents = yield fileSystem.readFileSync(file, 'utf8');
                }
                catch (_a) {
                    return;
                }
                const fileHash = crypto
                    .createHash('md5')
                    .update(relativeFilePath + fileContents + repoId, 'utf8')
                    .digest('hex');
                return { relativeFilePath, fileContents, fileHash };
            });
            const updateFile = ({ relativeFilePath, fileContents, fileHash, }) => __awaiter(this, void 0, void 0, function* () {
                // Semaphore context
                const release = yield this.semaphore.acquire();
                log.info(`Updating file: ${relativeFilePath}`);
                // Upload file to
                if (!fileSystem.isRemote && store.get('uploadPreferences')) {
                    yield fetch(`${this.apiRoute}/upload/repos/private/update_file/${repoId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Cookie: `repo_path=${this.rootDir}`,
                        },
                        body: JSON.stringify({
                            file: relativeFilePath,
                            contents: fileContents,
                        }),
                    });
                }
                // Probably could be a race here
                release();
            });
            const uploadFile = ({ relativeFilePath, fileContents, fileHash, }) => __awaiter(this, void 0, void 0, function* () {
                // Semaphore context
                const release = yield this.semaphore.acquire();
                console.log('Uploading file', relativeFilePath);
                let startTime = performance.now();
                if (!fileSystem.isRemote && store.get('uploadPreferences')) {
                    yield fetch(`${this.apiRoute}/upload/repos/private/add_file/${repoId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Cookie: `repo_path=${this.rootDir}`,
                        },
                        body: JSON.stringify({
                            file: relativeFilePath,
                            contents: fileContents,
                        }),
                    });
                }
                console.log('Uploaded file time', performance.now() - startTime);
                // Probably could be a race here
                release();
            });
            let futures = [];
            for (let i = 0; i < files.length; i += 100) {
                futures.push(uploadFilesBatch(files.slice(i, i + 100)));
            }
            yield Promise.all(futures);
        });
    }
    uploadFiles(files, repoId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log('uploading files', files);
            this.repoId = repoId;
            this.numFiles = files.length;
            this.filesUploaded = 0;
            this.finishedUpload = false;
            if (fileSystem.isRemote || !store.get('uploadPreferences')) {
                this.finishedUpload = true;
                return;
            }
            const uploadFile = (file) => __awaiter(this, void 0, void 0, function* () {
                // Semaphore context
                const release = yield this.semaphore.acquire();
                //here
                let fileContents = '';
                try {
                    // Get file contents
                    fileContents = yield new Promise((resolve) => __awaiter(this, void 0, void 0, function* () {
                        return yield fileSystem.readFile(file, (err, data) => {
                            if (data == null)
                                return null;
                            return resolve(data.toString());
                        });
                    }));
                }
                catch (_a) {
                    return;
                }
                if (fileContents == null)
                    return;
                const relativeFilePath = './' + path.relative(this.rootDir, file);
                //here
                log.info(`Uploading file: ${relativeFilePath}`);
                // Upload file to
                if (!fileSystem.isRemote && store.get('uploadPreferences')) {
                    yield fetch(`${this.apiRoute}/upload/repos/private/add_file/${repoId}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Cookie: `repo_path=${this.rootDir}`,
                        },
                        body: JSON.stringify({
                            file: relativeFilePath,
                            contents: fileContents,
                        }),
                    });
                }
                log.info(`Uploaded file: ${relativeFilePath}`);
                // Probably could be a race here
                this.filesUploaded += 1;
                release();
            });
            let futures = [];
            for (const file of files) {
                futures.push(uploadFile(file));
            }
            yield Promise.all(futures);
            this.finishedUpload = true;
        });
    }
    uploadProgress() {
        console.log('NUM FILES', this.numFiles);
        console.log('NUM UPLOADED', this.filesUploaded);
        if (this.numFiles === 0) {
            return 0;
        }
        else {
            return this.filesUploaded / (this.numFiles + 1);
        }
    }
    syncWithServer(apiRoot, files, repoId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.updateFilesIfNeeded(files, repoId);
            //console.log('Done syncing with server...')
        });
    }
    reIndex() {
        return __awaiter(this, void 0, void 0, function* () {
            if (fileSystem.isRemote || !store.get('uploadPreferences'))
                return;
            yield fetch(`${this.apiRoute}/upload/repos/private/finish_upload/${this.repoId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Cookie: `repo_path=${this.rootDir}`,
                },
            });
        });
    }
    startUpdateLoop(apiRoot, files, repoId, onStart = false) {
        return __awaiter(this, void 0, void 0, function* () {
            // // console.log('Starting update loop')
            // if (onStart) {
            //     try {
            //         // console.log('Starting onStart upload')
            //         await this.uploadFiles(files, repoId)
            //         // await this.syncWithServer(apiRoot, files, repoId);
            //     } catch (e) {
            //         console.log('error', e)
            //     }
            // }
            // // console.log('Starting set interval')
            // setInterval(() => {
            //     //console.log('STARTING ANEW')
            //     this.syncWithServer(apiRoot, files, repoId)
            // }, 1000 * 2 * 60)
            // setInterval(() => {
            //     // console.log('ReIndexing')
            //     this.reIndex()
            // }, 1000 * 60 * 60)
            // // console.log('Done with update loop')
        });
    }
}
function getSettings(rootDir) {
    const settings = (store.get('settingsFile' + rootDir) || {
        repoId: null,
        uploaded: false,
    });
    return settings;
}
function setSettings(rootDir, settings) {
    store.set('settingsFile' + rootDir, settings);
}
export function setupIndex(apiRoot, win) {
    const indexers = new Map();
    ipcMain.handle('syncProject', function (event, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            // const settings = getSettings(rootDir)
            // if (settings.repoId == null) return null
            // const indexer = indexers.get(settings.repoId)!
            const indexer = new CodebaseIndexer(rootDir, apiRoot, win);
            // let files = await indexer.listFiles()
            indexer.startWatcher();
            // indexer.startUpdateLoop(apiRoot, files, settings.repoId)
        });
    });
    ipcMain.handle('indexProject', function (event, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            // const connectedToInternet = await fetch(`${apiRoot}/`, {
            //     method: 'GET',
            // })
            //     .then((resp) => 'SUCCESS')
            //     .catch((failure) => 'FAILURE')
            // if (connectedToInternet == 'FAILURE') {
            //     return null
            // }
            const indexer = new CodebaseIndexer(rootDir, apiRoot, win);
            // let files = await indexer.listFiles()
            // const res = await fetch(`${apiRoot}/upload/repos/private`, {
            //     method: 'POST',
            //     headers: {
            //         'Content-Type': 'application/json',
            //         Cookie: `repo_path=${indexer.rootDir}`,
            //     },
            // })
            // const response = (await res.json()) as {
            //     message: string
            //     id: string
            // }
            // const repoId = response.id
            // indexers.set(repoId, indexer)
            indexer.startWatcher();
            // await indexer.startUpdateLoop(apiRoot, files, repoId, true)
            // // await indexer.reIndex()
            // setSettings(rootDir, { repoId, uploaded: true })
            return '123';
        });
    });
    ipcMain.handle('initProject', function (event, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            // log.warn('INITIALIZING PROJECT')
            // const connectedToInternet = await fetch(`${apiRoot}/`, {
            //     method: 'GET',
            // })
            //     .then((resp) => 'SUCCESS')
            //     .catch((failure) => 'FAILURE')
            // if (connectedToInternet == 'FAILURE') {
            //     return null
            // }
            // const cookie = { url: apiRoot, name: 'repo_path', value: rootDir }
            // session.defaultSession.cookies
            //     .set(cookie)
            //     .then(() => {})
            //     .catch((error) => console.log(error))
            // const settings = getSettings(rootDir)
            // if (!settings.uploaded) {
            //     return null
            // } else if (settings.repoId != null) {
            //     let remoteStatus = await checkStatus(
            //         settings.repoId,
            //         apiRoot,
            //         rootDir
            //     )
            //     console.log('CHECKING STATUS', remoteStatus)
            //     if (remoteStatus === 'notFound' || remoteStatus === 'error') {
            //         console.log('BAD REMOTE STATUS')
            //         setSettings(rootDir, { repoId: null, uploaded: false })
            //         return null
            //     }
            //     log.warn('RETURNING REPO ID FOR SETTINGS')
            //     // If we have an indexer saved, return that
            //     // Otherwise, we create a new one that will be used for the next sync
            //     // We don't do the initial bulk upload though since that is taken care of
            //     let indexer =
            //         indexers.get(settings.repoId) ||
            //         new CodebaseIndexer(rootDir, apiRoot, win, settings.repoId)
            //     indexers.set(settings.repoId, indexer)
            //     indexer.finishedUpload = true
            //     log.info('GOT REPO ID', settings.repoId)
            //     return settings.repoId
            // }
            return '123';
        });
    });
    ipcMain.handle('checkRepoStatus', function (event, repoId, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            // return await checkStatus(repoId, apiRoot, rootDir)
        });
    });
    ipcMain.handle('getProgress', function (event, repoId) {
        return __awaiter(this, void 0, void 0, function* () {
            return {
                progress: 1,
                state: 'done',
            };
            // const indexer = indexers.get(repoId)
            // if (!indexer) {
            //     return {
            //         progress: 0,
            //         state: 'notStarted',
            //     }
            // }
            // if (!indexer.finishedUpload) {
            //     return {
            //         progress: indexer.uploadProgress(),
            //         state: 'uploading',
            //     }
            // }
            // if (indexer && indexer.finishedUpload) {
            //     let response = await fetch(
            //         `${apiRoot}/upload/repos/private/index_progress/${repoId}`,
            //         {
            //             method: 'GET',
            //         }
            //     )
            //     let { progress } = (await response.json()) as {
            //         progress: string
            //     }
            //     if (progress == 'done') {
            //         return {
            //             progress: 1,
            //             state: 'done',
            //         }
            //     } else {
            //         return {
            //             progress: parseFloat(progress),
            //             state: 'indexing',
            //         }
            //     }
            // }
        });
    });
}