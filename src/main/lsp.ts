var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import * as fs from 'fs';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import * as path from 'path';
import { promisify } from 'util';
import { type } from 'os';
import { app, ipcMain } from 'electron';
import fetch from 'node-fetch';
import AdmZip from 'adm-zip';
import * as targz from 'targz';
import { ungzip } from 'node-gzip';
// Import uuid
import { v4 as uuidv4 } from 'uuid';
import * as tar from 'tar';
import log from 'electron-log';
import fixPath from 'fix-path';
const writeFilePromise = promisify(fs.writeFile);
const lspDir = app.isPackaged
    ? path.join(process.resourcesPath, 'lsp')
    : path.join(__dirname, '..', '..', 'lsp');
// Get the architecture and osType from electron
// architecture can take the values of 'arm', 'arm64', 'ia32', or 'x64'
const architecture = process.arch;
// osType can take the values of 'Windows_NT', 'Linux', 'Darwin', or 'SunOS'
const osType = type();
export const lspStore = (store) => ({
    get: (key) => store.get('LSCmd-' + key),
    set: (key, value) => store.set('LSCmd-' + key, value),
    has: (key) => store.has('LSCmd-' + key),
    clear: () => {
        for (const key in store) {
            if (key.startsWith('LSCmd-')) {
                store.delete(key);
            }
        }
    },
});
function getLatestVersion(githubURL) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(githubURL);
        const jsonResponse = (yield response.json());
        return jsonResponse.tag_name;
    });
}
function downloadFile(url, outputPath) {
    return __awaiter(this, void 0, void 0, function* () {
        return yield fetch(url)
            .then((x) => x.arrayBuffer())
            .then((x) => writeFilePromise(outputPath, Buffer.from(x)));
    });
}
fixPath();
function npmDownload(...packages) {
    return __awaiter(this, void 0, void 0, function* () {
        for (const p of packages) {
            console.log('Installing', p);
            if (process.platform === 'win32') {
                yield new Promise((resolve, reject) => {
                    const childProcess = cp.spawn('npm', ['install', '-g', p], {
                        shell: true,
                    });
                });
            }
            else {
                yield promisify(cp.exec)(`npm install -g ${p}`, {
                    env: process.env,
                });
            }
        }
    });
}
function findViableVersion(lang) {
    return __awaiter(this, void 0, void 0, function* () {
        let fallbacks = [
            Object.assign(Object.assign({}, lang), { fallbacks: undefined }),
            ...(lang.fallbacks || []),
        ];
        let bestFallbackIndex = 0;
        for (let i = 0; i < fallbacks.length; i++) {
            // Try running the command for 1 second, and see if it works
            let command = fallbacks[i].command;
            let args = fallbacks[i].args;
            //let isNode = fallbacks[i].isNode || false;
            let childProcess;
            let result;
            try {
                childProcess = cp.spawn(command, args, { shell: true });
                result = new Promise((resolve, reject) => {
                    childProcess.on('error', (err) => {
                        log.info('FAILURE for', command, args);
                        resolve('EXITED');
                    });
                    // childProcess.stdout!.on('data', (data) => {
                    //     console.log(`stdout: ${data}`)
                    // })
                    childProcess.stderr.on('data', (data) => {
                        console.error(`stderr: ${data}`);
                        if (!data.includes('data')) {
                            resolve('EXITED');
                        }
                    });
                });
            }
            catch (e) {
                log.info('EARLY FAILURE for', command, args);
                console.error(e);
                continue;
            }
            let timeout = new Promise((resolve, reject) => {
                setTimeout(() => {
                    log.info('SUCESS for', command, args);
                    resolve('DONE');
                }, 3000);
            });
            let fullOut = yield Promise.race([timeout, result]);
            if (fullOut == 'DONE') {
                log.info('MARKED BEST', command, args);
                bestFallbackIndex = i;
                childProcess.kill();
                break;
            }
            else {
                log.info('MARKED BAD', command, args);
                childProcess.kill();
            }
        }
        const bestFallback = fallbacks[bestFallbackIndex];
        let newFallbacks = fallbacks.splice(bestFallbackIndex, 1);
        return Object.assign(Object.assign({}, bestFallback), { fallbacks: newFallbacks });
    });
}
class LSPManager {
    constructor(store) {
        this.runningClients = {};
        this.supportedNotifications = new Set([
            'textDocument/publishDiagnostics',
            'window/logMessage',
            'window/logMessage',
        ]);
        this.supportedInboundRequests = new Set([
            'workspace/configuration',
            'client/registerCapability',
        ]);
        this.store = lspStore(store);
    }
    stopLS(language) {
        let oldStore = this.store.get(language);
        if (oldStore) {
            this.store.set(language, Object.assign(Object.assign({}, oldStore), { running: false }));
        }
    }
    getLSState(event, language) {
        if (this.store.has(language)) {
            let info = this.store.get(language);
            return {
                installed: info.downloadedInfo != null,
                running: info.running,
            };
        }
        return null;
    }
    maybeInstallLanguage(language, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.store.has(language)) {
                let languageInfo = this.store.get(language);
                log.info('Store has language', language, languageInfo);
                if (languageInfo.downloadedInfo != null) {
                    return languageInfo.downloadedInfo;
                }
            }
            log.info('Store does not have language downloaded', language);
            const installedLanguage = yield this.installLanguage(language, rootDir);
            if (installedLanguage) {
                log.info('Got installed language', language, installedLanguage);
                this.store.set(language, {
                    name: language,
                    running: false,
                    downloadedInfo: installedLanguage,
                });
                return installedLanguage;
            }
            else {
                log.error('Could not install language', language);
            }
        });
    }
    installLanguage(language, rootDir) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('INSTALLING');
            let remoteUrl;
            let downloadPath;
            let zip;
            let extractFn;
            switch (language) {
                case 'python':
                    log.info('installing python');
                    // try {
                    //     await promisify(cp.exec)('pip install -U "pyright"')
                    //     log.info('Success in first try')
                    // } catch (e) {
                    //     try {
                    //         await promisify(cp.exec)('pip3 install -U "pyright"')
                    //         log.info('Success with pip3')
                    //     } catch (e) {
                    //         log.error('error installing python', e)
                    //     }
                    // }
                    // let candidateLang =  {
                    //     command: 'pyright-langserver',
                    //     args: ['--stdio'],
                    // }
                    // Old when using pylsp
                    try {
                        yield promisify(cp.exec)('pip install --user -U "python-lsp-server[all]"', {
                            env: process.env,
                        });
                        log.info('Success in first try');
                    }
                    catch (e) {
                        log.error('first error installing python', e);
                        try {
                            yield promisify(cp.exec)('pip3 install --user -U "python-lsp-server[all]"', {
                                env: process.env,
                            });
                            log.info('Success with pip3');
                        }
                        catch (e) {
                            log.error('error installing python', e);
                        }
                    }
                    let candidateLang = {
                        command: 'python',
                        args: ['-m', 'pylsp'],
                        fallbacks: [
                            {
                                command: 'python3',
                                args: ['-m', 'pylsp'],
                            },
                            {
                                command: 'pylsp',
                                args: [],
                            },
                        ],
                    };
                    return yield findViableVersion(candidateLang);
                case 'typescript':
                    try {
                        yield npmDownload('typescript', 'typescript-language-server');
                        return {
                            isNode: false,
                            command: 'typescript-language-server',
                            args: ['--stdio'],
                        };
                    }
                    catch (e) {
                        console.error(e);
                        return null;
                    }
                case 'css':
                    return {
                        isNode: true,
                        command: path.join(lspDir, 'css.js'),
                        args: ['--stdio'],
                    };
                case 'html':
                    try {
                        return {
                            isNode: true,
                            command: path.join(lspDir, 'html.js'),
                            args: ['--stdio'],
                        };
                    }
                    catch (e) {
                        return null;
                    }
                case 'php':
                    try {
                        yield npmDownload('intelephense');
                        return {
                            isNode: false,
                            command: 'intelephense',
                            args: ['--stdio'],
                        };
                    }
                    catch (e) {
                        return null;
                    }
                case 'copilot':
                    return {
                        isNode: true,
                        command: path.join(lspDir, 'copilot', 'dist', 'agent.js'),
                        args: [],
                    };
                case 'go':
                    const goDir = path.join(lspDir, 'go');
                    try {
                        yield promisify(cp.exec)('go install golang.org/x/tools/gopls@latest', {
                            // Set env variables so the gopls binary is installed to the correct location
                            env: Object.assign({ GOBIN: goDir, GO111Module: 'on' }, process.env),
                        });
                    }
                    catch (e) {
                        log.error('error installing go', e);
                        return null;
                    }
                    const goBinary = path.join(goDir, 'gopls');
                    return {
                        command: goBinary,
                        args: [],
                    };
                case 'java':
                    remoteUrl =
                        'https://download.eclipse.org/jdtls/snapshots/jdt-language-server-latest.tar.gz';
                    // Make dir if not exists path.join(lspPlugin, 'java')
                    let javaDir = path.join(lspDir, 'java');
                    try {
                        yield fs.promises.access(javaDir);
                    }
                    catch (e) {
                        yield fs.promises.mkdir(javaDir);
                    }
                    // fetch and download it
                    downloadPath = path.join(lspDir, 'java', 'jdt-language-server-latest.tar.gz');
                    yield downloadFile(remoteUrl, downloadPath);
                    yield promisify(targz.decompress)({
                        src: downloadPath,
                        dest: path.join(lspDir, 'java'),
                    });
                    // Delete the orig file
                    yield promisify(fs.rm)(downloadPath);
                    // Get the path to the new language server
                    const lsPath = path.join(lspDir, 'java', 'bin', 'jdtls');
                    return {
                        command: lsPath,
                        args: [
                            '--add-modules=ALL-SYSTEM',
                            '--add-opens',
                            'java.base/java.util=ALL-UNNAMED',
                            '--add-opens',
                            'java.base/java.lang=ALL-UNNAMED',
                        ],
                    };
                case 'c':
                    let cVersion = yield getLatestVersion('https://api.github.com/clangd/clangd/releases/latest');
                    if (osType === 'Darwin') {
                        remoteUrl = `https://github.com/clangd/clangd/releases/download/${cVersion}/clangd-mac-${cVersion}.zip`;
                    }
                    else if (osType === 'Linux') {
                        remoteUrl = `https://github.com/clangd/clangd/releases/download/${cVersion}/clangd-linux-${cVersion}.zip`;
                    }
                    else if (osType === 'Windows_NT') {
                        remoteUrl = `https://github.com/clangd/clangd/releases/download/${cVersion}/clangd-windows-${cVersion}.zip`;
                    }
                    else {
                        throw new Error('Unsupported OS - ' + osType);
                    }
                    let cDir = path.join(lspDir, 'c');
                    if (!fs.existsSync(cDir)) {
                        fs.mkdirSync(cDir);
                    }
                    // fetch and download it
                    downloadPath = path.join(lspDir, 'c', 'clangd.zip');
                    yield downloadFile(remoteUrl, downloadPath);
                    zip = new AdmZip(downloadPath);
                    extractFn = promisify(zip.extractAllToAsync.bind(zip));
                    yield extractFn(path.join(lspDir, 'c'), true, false);
                    // Delete the orig file
                    yield promisify(fs.rm)(downloadPath);
                    // Get the path to the new language server
                    const cLSPath = path.join(lspDir, 'c', `clangd_${cVersion}`, 'bin', 'clangd');
                    // Run chmod +x on the file
                    yield promisify(fs.chmod)(cLSPath, 0o755);
                    return {
                        command: cLSPath,
                        args: [],
                    };
                case 'rust':
                    const rustVersion = yield getLatestVersion('https://api.github.com/repos/rust-analyzer/rust-analyzer/releases/latest');
                    remoteUrl = `https://github.com/rust-lang/rust-analyzer/releases/download/${rustVersion}/`;
                    let rustName = 'rust-analyzer-';
                    if (osType === 'Darwin') {
                        if (architecture === 'x64') {
                            rustName += 'x86_64-apple-darwin.gz';
                        }
                        else if (architecture === 'arm64') {
                            rustName += 'aarch64-apple-darwin.gz';
                        }
                        else {
                            log.error('Unsupported architecture - ' + architecture);
                            throw new Error('Unsupported architecture - ' + architecture);
                        }
                    }
                    else if (osType == 'Linux') {
                        if (architecture === 'x64') {
                            rustName += 'x86_64-unknown-linux-gnu.gz';
                        }
                        else if (architecture === 'arm64') {
                            rustName += 'aarch64-unknown-linux-gnu.gz';
                        }
                        else if (architecture === 'arm') {
                            rustName += 'arm-unknown-linux-gnueabihf.gz';
                        }
                    }
                    else if (osType === 'Windows_NT') {
                        if (architecture === 'x64') {
                            rustName += 'x86_64-pc-windows-msvc.gz';
                        }
                        else if (architecture === 'arm64') {
                            rustName += 'aarch64-pc-windows-msvc.gz';
                        }
                        else if (architecture === 'ia32') {
                            rustName += 'i686-pc-windows-msvc.gz';
                        }
                        else {
                            log.error('Unsupported architecture - ' + architecture);
                            throw new Error('Unsupported architecture - ' + architecture);
                        }
                    }
                    else {
                        log.error('Unsupported OS - ' + osType);
                        throw new Error('Unsupported OS - ' + osType);
                    }
                    // Make rust dir
                    let rustDir = path.join(lspDir, 'rust');
                    if (!fs.existsSync(rustDir)) {
                        fs.mkdirSync(rustDir);
                    }
                    // fetch and download it
                    downloadPath = path.join(lspDir, 'rust', 'rust-analyzer.gz');
                    console.log(remoteUrl + rustName);
                    yield downloadFile(remoteUrl + rustName, downloadPath);
                    // Read the file
                    const file = yield promisify(fs.readFile)(downloadPath);
                    // Extract the file
                    let rawFile = yield ungzip(file);
                    const rustBinaryName = process.platform === 'win32'
                        ? 'rust-analyzer.exe'
                        : 'rust-analyzer';
                    // Write to path.join(lspDir, 'rust-analyzer')
                    yield promisify(fs.writeFile)(path.join(lspDir, 'rust', rustBinaryName), rawFile);
                    // Delete the orig file
                    yield promisify(fs.rm)(downloadPath);
                    // Get the path to the new language server
                    const rustLSPath = path.join(lspDir, 'rust', rustBinaryName);
                    // Chmod + x
                    yield promisify(fs.chmod)(rustLSPath, 0o755);
                    return {
                        command: rustLSPath,
                        args: [],
                    };
                case 'csharp':
                    const csharpVersion = yield getLatestVersion('https://api.github.com/repos/OmniSharp/omnisharp-roslyn/releases/latest');
                    let csharpName = 'omnisharp-';
                    remoteUrl = `https://github.com/OmniSharp/omnisharp-roslyn/releases/download/${csharpVersion}/`;
                    if (osType === 'Darwin') {
                        if (architecture === 'x64') {
                            csharpName += 'osx-x64';
                        }
                        else if (architecture === 'arm64') {
                            csharpName += 'osx-arm64';
                        }
                        else {
                            log.error('Unsupported architecture - ' + architecture);
                            throw new Error('Unsupported architecture - ' + architecture);
                        }
                    }
                    else if (osType == 'Linux') {
                        if (architecture === 'x64') {
                            csharpName += 'linux-x64';
                        }
                        else if (architecture === 'arm64') {
                            csharpName += 'linux-arm64';
                        }
                        else if (architecture === 'arm') {
                            csharpName += 'linux-arm';
                        }
                    }
                    else if (osType === 'Windows_NT') {
                        if (architecture === 'x64') {
                            csharpName += 'win-x64';
                        }
                        else if (architecture === 'arm64') {
                            csharpName += 'win-arm64';
                            // } else if (architecture === 'x86') {
                            //     csharpName += 'win-x86';
                        }
                        else {
                            log.error('Unsupported architecture - ' + architecture);
                            throw new Error('Unsupported architecture - ' + architecture);
                        }
                    }
                    else {
                        log.error('Unsupported OS - ' + osType);
                        throw new Error('Unsupported OS - ' + osType);
                    }
                    csharpName += '-net6.0';
                    // Make csharp dir
                    let csDir = path.join(lspDir, 'csharp');
                    if (!fs.existsSync(csDir)) {
                        fs.mkdirSync(csDir);
                    }
                    // fetch and download it
                    downloadPath = path.join(lspDir, 'csharp', 'omnisharp');
                    if (osType === 'Windows_NT') {
                        remoteUrl += csharpName + '.zip';
                        downloadPath += '.zip';
                    }
                    else {
                        remoteUrl += csharpName + '.tar.gz';
                        downloadPath += '.tar.gz';
                    }
                    yield downloadFile(remoteUrl, downloadPath);
                    // Extract the file
                    if (osType === 'Windows_NT') {
                        zip = new AdmZip(downloadPath);
                        extractFn = promisify(zip.extractAllToAsync.bind(zip));
                        yield extractFn(path.join(lspDir, 'csharp'), true, false);
                    }
                    else {
                        yield tar.x({
                            file: downloadPath,
                            C: path.join(lspDir, 'csharp'),
                        });
                    }
                    // Delete the orig file
                    yield fs.promises.rm(downloadPath);
                    // Get the path to the new language server
                    const csharpLSPath = path.join(lspDir, 'csharp', 'OmniSharp');
                    // TODO - figure out how to override mac issues with security
                    // Also figure our about the NET_PATH stuff
                    // Chmod + x
                    yield fs.promises.chmod(csharpLSPath, 0o755);
                    return {
                        command: csharpLSPath,
                        args: ['--languageserver'],
                    };
                default:
                    return null;
            }
        });
    }
    startServer(event, { language, rootDir }) {
        return __awaiter(this, void 0, void 0, function* () {
            log.info('starting server for', language);
            const installedLanguage = yield this.maybeInstallLanguage(language, rootDir);
            if (!installedLanguage) {
                log.error('Could not install language', language);
                return;
            }
            this.store.set(language, {
                name: language,
                running: true,
                downloadedInfo: installedLanguage,
            });
            const { command, args, isNode } = installedLanguage;
            let childProcess;
            if (!isNode) {
                childProcess = cp.spawn(command, args, {
                    env: process.env,
                    shell: true,
                });
            }
            else {
                childProcess = cp.fork(command, args, {
                    stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                    env: process.env,
                });
                let fallbacks = installedLanguage.fallbacks;
                if (fallbacks != null) {
                    let fallBackIndex = 0;
                    // Bind exit event listener
                    childProcess.on('exit', (code, signal) => {
                        if (fallbacks != null && fallBackIndex < fallbacks.length) {
                            let { command, args } = fallbacks[fallBackIndex];
                            childProcess = cp.fork(command, args, {
                                stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
                            });
                        }
                    });
                }
            }
            log.info('!!!!!!!!!Finished spawning child process', language);
            if (childProcess.stderr) {
                childProcess.stderr.on('data', (data) => {
                    log.warn(`lang ${language} stderr: ${data}`);
                });
            }
            // if (childProcess.stdout) {
            //     childProcess.stdout.on('data', (data) => {
            //         log.info(`lang ${language} stdout ${data}`)
            //         log.info('DONE')
            //     })
            // }
            // const filterStream = new Transform({
            //   transform(chunk, encoding, callback) {
            //     console.log('ENCODING', {encoding})
            //     // Convert the chunk to a string using the specified encoding
            //     const chunkStr = chunk.toString('utf-8').trim();
            //     console.log('CHUNK_STR', chunkStr);
            //     if (/^added \d+ package|^found \d+ vulnerabilities/.test(chunkStr)) {
            //         console.log('Not including this str')
            //         callback();
            //         return;
            //     }
            //     callback(null, chunk);
            //   },
            // });
            const connection = rpc.createMessageConnection(
            // new rpc.StreamMessageReader(childProcess.stdout!.pipe(filterStream)),
            new rpc.StreamMessageReader(childProcess.stdout), new rpc.StreamMessageWriter(childProcess.stdin));
            log.info('created connection', language);
            if (this.runningClients.hasOwnProperty(language)) {
                log.warn('SHUTTING DOWN OLD CLIENT');
                this.killServer(event, language);
            }
            this.runningClients[language] = {
                connection,
                childProcess,
            };
            connection.onNotification((method, params) => {
                // Try converting the method to keyof LSPEventMap
                let eventMethod;
                try {
                    eventMethod = method;
                    event.sender.send('notificationCallbackLS', {
                        language,
                        data: { method: eventMethod, params },
                    });
                }
                catch (e) {
                    console.error(e);
                }
            });
            connection.onRequest((method, params) => __awaiter(this, void 0, void 0, function* () {
                let requestMethod;
                try {
                    requestMethod = method;
                    let tmpIdentifier = uuidv4();
                    event.sender.send('requestCallbackLS', {
                        language,
                        data: { method: requestMethod, params },
                        identifier: tmpIdentifier,
                    });
                    // console.log('Got request', requestMethod, params)
                    let future = new Promise((resolve, reject) => {
                        // TODO - get rid of the response callback later bc it may hurt performance
                        ipcMain.handle('responseCallbackLS' + tmpIdentifier, (event, data) => {
                            resolve(data);
                        });
                    });
                    let timedOut = new Promise((resolve) => {
                        setTimeout(() => {
                            // Resolve to a response error
                            resolve({
                                error: {
                                    code: -32000,
                                    data: 'Request timed out',
                                },
                            });
                        }, 10000);
                    });
                    const response = yield Promise.race([future, timedOut]);
                    // console.log('Got response', response)
                    return response;
                }
                catch (e) {
                    console.error(e);
                    return {
                        error: {
                            code: -32601,
                            data: 'Method not found',
                        },
                    };
                }
            }));
            connection.listen();
            //log.info('Finished starting server', language)
            return language;
        });
    }
    killServer(event, language) {
        if (this.runningClients.hasOwnProperty(language)) {
            const { connection, childProcess } = this.runningClients[language];
            connection.dispose();
            childProcess.kill();
            delete this.runningClients[language];
            const oldLang = this.store.get(language);
        }
    }
    killAll(event) {
        Object.keys(this.runningClients).forEach((language) => {
            this.killServer(event, language);
        });
    }
    //   async function sendRequest<K extends keyof LSPRequestMap>(event: IpcMainInvokeEvent, arg: {
    sendRequest(event, { language, method, params, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.runningClients.hasOwnProperty(language)) {
                return;
            }
            const { connection } = this.runningClients[language];
            if (method == 'initialize') {
                let out = yield connection.sendRequest(method, params);
                // Set the capabilities
                console.log('capabilities', language, out);
                return out;
            }
            else if (method == 'textDocument/hover') {
                let out = yield connection.sendRequest(method, params);
                return out;
            }
            else if (method == 'textDocument/completion') {
                // Pop off 'wordBefore' from params
                let _a = params, { wordBefore } = _a, otherParams = __rest(_a, ["wordBefore"]);
                const wordBeforeLower = wordBefore.toLowerCase();
                let start = performance.now();
                let out = yield connection.sendRequest(method, otherParams);
                // Filter down items
                if (out != null) {
                    start = performance.now();
                    // Later we can specify the typing
                    let remainingItems = [];
                    if (Array.isArray(out)) {
                        // This is a silly case of formatting that
                        // so far we only need to handle in c# - omnisharp
                        remainingItems = out;
                    }
                    else {
                        remainingItems = out.items;
                    }
                    let filtered = false;
                    let sorted = false;
                    if (remainingItems.length > 0) {
                        if (remainingItems[0].sortText != null) {
                            sorted = true;
                        }
                        else if (remainingItems[0].label != null) {
                            filtered = true;
                        }
                    }
                    remainingItems = remainingItems.filter((item) => {
                        // Check if wordBefore is a non-contiguous substring of the label
                        // First check if the label is the same size
                        let label = item.label.toLowerCase();
                        if (item.filterText != null) {
                            label = item.filterText.toLowerCase();
                        }
                        if (label.length < wordBefore.length) {
                            return false;
                        }
                        let i = 0, j = 0;
                        while (i < wordBeforeLower.length && j < label.length) {
                            if (wordBeforeLower[i] == label[j]) {
                                i++;
                            }
                            j++;
                        }
                        return i == wordBeforeLower.length;
                    });
                    let isIncomplete = false;
                    if (remainingItems.length > 500 || (out === null || out === void 0 ? void 0 : out.isIncomplete) == true) {
                        isIncomplete = true;
                    }
                    if (remainingItems.length > 500) {
                        remainingItems = remainingItems.splice(0, 500);
                    }
                    remainingItems = remainingItems.sort((a, b) => {
                        if (sorted) {
                            remainingItems.sort((a, b) => {
                                if (a.sortText < b.sortText) {
                                    return -1;
                                }
                                else if (a.sortText > b.sortText) {
                                    return 1;
                                }
                                else {
                                    return 0;
                                }
                            });
                        }
                        const lowerA = a.label.toLowerCase();
                        const lowerB = b.label.toLowerCase();
                        if (lowerA.startsWith(wordBeforeLower) &&
                            !lowerB.startsWith(wordBeforeLower)) {
                            return -1;
                        }
                        else if (!lowerA.startsWith(wordBeforeLower) &&
                            lowerB.startsWith(wordBeforeLower)) {
                            return 1;
                        }
                        else {
                            if (lowerA.length < lowerB.length) {
                                return -1;
                            }
                            else {
                                return 1;
                            }
                        }
                    });
                    return {
                        // ...out,
                        isIncomplete,
                        items: remainingItems,
                        // Using to store additional data
                        itemDefaults: {
                            data: {
                                wordBefore,
                                filter: filtered,
                                sort: sorted,
                            },
                        },
                    };
                }
                else {
                    return {
                        isIncomplete: false,
                        items: [],
                        itemDefaults: {
                            data: {
                                wordBefore,
                                filter: false,
                                sort: false,
                            },
                        },
                    };
                }
                //return out;
            }
            else {
                return yield connection.sendRequest(method, params);
            }
        });
    }
    sendNotification(event, { language, method, params, }) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.runningClients.hasOwnProperty(language)) {
                return;
            }
            const { connection } = this.runningClients[language];
            return yield connection.sendNotification(method, params);
        });
    }
}
export const setupLSPs = (store) => {
    const lspManager = new LSPManager(store);
    ipcMain.handle('getLSState', lspManager.getLSState.bind(lspManager));
    ipcMain.handle('installLS', (event, { rootDir, language }) => lspManager.maybeInstallLanguage(language, rootDir));
    ipcMain.handle('startLS', lspManager.startServer.bind(lspManager));
    ipcMain.handle('stopLS', (event, language) => lspManager.stopLS(language));
    ipcMain.handle('killLS', lspManager.killServer.bind(lspManager));
    ipcMain.handle('sendRequestLS', lspManager.sendRequest.bind(lspManager));
    ipcMain.handle('sendNotificationLS', lspManager.sendNotification.bind(lspManager));
    ipcMain.handle('killAllLS', lspManager.killAll.bind(lspManager));
};
