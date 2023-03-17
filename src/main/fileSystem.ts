var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as child from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import Watcher from 'watcher';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { PLATFORM_INFO } from './utils';
var escapeShell = function (cmd) {
    let to_ret = '' + cmd.replace(/(["'$`\\])/g, '\\$1') + '';
    to_ret = to_ret.replace(/%/g, '%%');
    return to_ret;
};
const isWindows = process.platform === 'win32';
// A class that implements a lightweight ssh client in nodejs Typescript using spawn
class SSHClient {
    // A constructor that uses spawn to connect over ssh given an ssh bash command string
    constructor(sshCommand) {
        this.callback = null;
        // Spawn the ssh process with the given command and pipe the stdio streams
        this.sshProcess = spawn(sshCommand, { shell: true, stdio: 'pipe' });
        // Handle any errors from the ssh process
        this.sshProcess.on('error', (err) => {
            console.log('!!!!!!!!!!!!!!!!!!!!!!\n\n\n');
            console.error(`SSH process error: ${err.message}`);
            this.callback(err);
            if (this.callback != null)
                this.callback = null;
            out = '';
        });
        // Handle the exit event from the ssh process
        this.sshProcess.on('exit', (code, signal) => {
            console.log('!!!!!!!!!!!!!!!!!!!!!!\n\n\n');
            console.log(`SSH process exited with code ${code} and signal ${signal}`);
            if (this.callback != null)
                this.callback('exit');
            this.callback = null;
            out = '';
        });
        let seen = false;
        let out = '';
        this.sshProcess.stdout.on('data', (data) => {
            console.log(']]]]]]]]]]]]]] data ', data.toString());
            if (!seen) {
                seen = true;
            }
            else if (this.callback != null) {
                // remove 'cursordone' from the end of the string
                let ret = data.toString();
                if (ret.trim().endsWith('cursordone')) {
                    out += ret.slice(0, -' cursordone'.length);
                    this.callback(null, out);
                    this.callback = null;
                    out = '';
                }
                else {
                    out += ret;
                    console.log('not yet done', out);
                }
            }
        });
    }
    setNextLine(callback, callbackForHere) {
        return __awaiter(this, void 0, void 0, function* () {
            // wait until callback is null before setting it
            if (this.callback != null) {
                console.log('waiting for callback to be null');
                let count = 0;
                const interval = setInterval(() => {
                    count += 1;
                    if (count > 100) {
                        clearInterval(interval);
                        callbackForHere(false);
                    }
                    console.log('trying');
                    if (this.callback == null) {
                        console.log('found');
                        clearInterval(interval);
                        this.callback = callback;
                        callbackForHere(true);
                    }
                }, 100);
            }
            else {
                this.callback = callback;
                callbackForHere(true);
            }
        });
    }
    // A method for running a bash command on the server
    runCommand(command, callback) {
        console.log('run command');
        try {
            this.setNextLine(callback, (noError) => {
                if (!noError) {
                    this.callback = null;
                    callback('error');
                }
                console.log('got out');
                this.sshProcess.stdin.cork();
                console.log('running');
                this.sshProcess.stdin.write(`${command}\n`);
                this.sshProcess.stdin.write(`echo 'cursordone'\n`);
                console.log('running');
                this.sshProcess.stdin.uncork();
                console.log('done');
            });
        }
        catch (e) {
            this.callback = null;
            callback('error');
            console.log('\n\n\n\n\n!!!!!error', e);
        }
    }
    runCommandPromise(command) {
        return promisify(this.runCommand).bind(this)(command);
    }
}
// get current working directory
export class FileSystem {
    constructor(isRemote = false, sshCommand = '') {
        this.isRemote = isRemote;
        this.sshCommand = sshCommand;
        if (this.isRemote) {
            this.client = new SSHClient(this.sshCommand);
        }
    }
    testConnection() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                return yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise('echo "hello"'));
            }
        });
    }
    writeFileSync(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                // child.execSync(`echo '${data}' | ${this.sshCommand} -T "cat > ${path}"`)
                let command = `printf "${escapeShell(data)}" > ${path}`;
                yield this.client.runCommandPromise(command);
            }
            else {
                fs.writeFileSync(path, data);
            }
        });
    }
    unlinkSync(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`rm ${path}`));
            }
            else {
                fs.unlinkSync(path);
            }
        });
    }
    rmSync(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`rm -rf ${path}`));
            }
            else {
                fs.rmSync(path, { recursive: true });
            }
        });
    }
    mkdirSync(path, options) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                // dont look at the options, just always do -p
                yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`mkdir -p ${path}`));
            }
            else {
                fs.mkdirSync(path, options);
            }
        });
    }
    renameSync(oldPath, newPath) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`mv ${oldPath} ${newPath}`));
            }
            else {
                fs.renameSync(oldPath, newPath);
            }
        });
    }
    existsSync(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // await this.client.runCommandPromise('ls').then((data) => {
            //          console.log('\n\n\n\n\nrun command', data);
            //     });
            if (this.isRemote) {
                const remotePath = path;
                const command = `test -e ${remotePath} && echo 'yes'`;
                console.log('exists command', command);
                try {
                    const response = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(command)));
                    return response.trim() === 'yes';
                }
                catch (e) {
                    return false;
                }
            }
            else {
                return fs.existsSync(path);
            }
        });
    }
    readdirSyncWithIsDir(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            // console.log('>>>> readdir with dir', path);
            let result = '';
            if (this.isRemote) {
                result = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`ls -la ${path}`)));
                //filter out . and ..
                const lines = result.split('\n');
                return lines
                    .slice(1, lines.length)
                    .filter((x) => x !== '')
                    .filter((x) => {
                    const fileName = x.split(' ').filter((x) => x !== '')[8];
                    return fileName !== '.' && fileName !== '..';
                })
                    .map((x) => {
                    const isDir = x.split(' ')[0][0] === 'd';
                    const fileName = x.split(' ').slice(-1)[0];
                    const size = parseInt(x.split(' ').filter((x) => x !== '')[4]);
                    return { fileName, isDir, size };
                });
            }
            else {
                // do the same as above but just use the fs module
                const files = fs.readdirSync(path);
                return files.map((fileName) => {
                    const isDir = fs
                        .lstatSync(path + PLATFORM_INFO.PLATFORM_DELIMITER + fileName)
                        .isDirectory();
                    const size = fs.lstatSync(path + PLATFORM_INFO.PLATFORM_DELIMITER + fileName).size;
                    return { fileName, isDir, size };
                });
            }
        });
    }
    readdirSync(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                const remotePath = path;
                const result = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`ls ${remotePath}`)));
                return result.split('\n').filter((x) => x !== '');
            }
            else {
                return fs.readdirSync(path);
            }
        });
    }
    readFileSync(path, encoding) {
        var _a, _b, _c;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                // check the size of the file
                const size = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`du -b ${path}`)));
                const sizeInt = parseInt(size.split('\t')[0]);
                if (sizeInt > 1000000) {
                    return 'File too large';
                }
                // check if the file is binary
                const isBinary = (yield ((_b = this.client) === null || _b === void 0 ? void 0 : _b.runCommandPromise(`file ${path}`)));
                const boolBinary = isBinary.includes('binary');
                if (boolBinary) {
                    return 'File is binary';
                }
                const result = (yield ((_c = this.client) === null || _c === void 0 ? void 0 : _c.runCommandPromise(`cat ${path}`)));
                return result;
            }
            else {
                return fs.readFileSync(path, encoding);
            }
        });
    }
    readFile(path, callback) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                const remotePath = path;
                const result = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`cat ${remotePath}`)));
                callback(null, Buffer.from(result));
            }
            else {
                fs.readFile(path, callback);
            }
        });
    }
    statSync(path) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                const remotePath = path;
                const result = (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`stat ${remotePath}`)));
                const res = fs.statSync('./');
                res.mtimeMs =
                    parseInt(result.split('Modify: ')[1].split(' ')[0]) * 1000;
                res.size = parseInt(result.split('Size: ')[1].split(' ')[0]);
                // parse whether is file and is directory
                const isFile = result.split('File: ')[1].split(' ')[0] === 'regular';
                const isDirectory = result.split('File: ')[1].split(' ')[0] === 'directory';
                res.isFile = () => isFile;
                res.isDirectory = () => isDirectory;
                return res;
            }
            else {
                return fs.statSync(path);
            }
        });
    }
    exec(command, cwd) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                return (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`cd ${cwd} && ${command}`)));
            }
            else {
                return child.exec(command, {
                    cwd,
                    encoding: 'utf-8',
                    maxBuffer: 10000 * 500,
                });
            }
        });
    }
    execSync(command, cwd) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                return (yield ((_a = this.client) === null || _a === void 0 ? void 0 : _a.runCommandPromise(`cd ${cwd} && ${command}`)));
            }
            else {
                return child.execSync(command, {
                    cwd,
                    encoding: 'utf-8',
                    maxBuffer: 10000 * 500,
                });
            }
        });
    }
    execPromise(command, cwd) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isRemote) {
                return this.client.runCommandPromise(`cd ${cwd} && ${command}`);
            }
            else {
                return promisify(child.exec)(command, {
                    encoding: 'utf-8',
                    maxBuffer: 10000 * 500,
                    cwd: cwd,
                });
            }
        });
    }
    startWatcher(rootDir, ignore, callbacks) {
        if (this.isRemote) {
            const sshCommand = `${this.sshCommand} -T "inotifywait -m -r ${rootDir}"`;
            const childProcess = child.spawn(sshCommand, [], { shell: true });
            childProcess.stdout.on('data', (data) => {
                const lines = data.toString().trim().split('\n');
                // deduplicate lines
                const deduplicatedLines = lines.filter((line, index) => {
                    return lines.indexOf(line) === index;
                });
                for (const line of lines) {
                    try {
                        const inotifyOutput = line.trim();
                        const comps = inotifyOutput.split(' ');
                        const fileName = comps[comps.length - 1];
                        const folderPath = comps[0];
                        const filePath = path.join(folderPath, fileName);
                        const eventString = comps[comps.length - 2];
                        const eventAttrs = eventString.split(',');
                        const isDir = eventAttrs.includes('ISDIR');
                        const eventType = eventAttrs[0];
                        if (eventType === 'MODIFY') {
                            callbacks.change(filePath);
                        }
                        if (eventType === 'CREATE') {
                            if (isDir)
                                callbacks.addDir(filePath);
                            else
                                callbacks.add(filePath);
                        }
                        if (eventType === 'DELETE') {
                            if (isDir)
                                callbacks.unlinkDir(filePath);
                            else
                                callbacks.unlink(filePath);
                        }
                    }
                    catch (err) {
                        console.log('ERROR', err);
                    }
                }
            });
            childProcess.stderr.on('data', function (data) {
                console.log('DATA stderr: ' + data.toString());
            });
            childProcess.on('exit', function (code) {
                console.log('DATA child process exited with code ' + code);
            });
        }
        else {
            var watcher = new Watcher(rootDir, {
                ignore,
                ignoreInitial: true,
                persistent: true,
                recursive: true,
            });
            watcher
                .on('add', callbacks.add)
                .on('addDir', callbacks.addDir)
                .on('change', callbacks.change)
                .on('unlink', callbacks.unlink)
                .on('unlinkDir', callbacks.unlinkDir);
        }
    }
}
// export let fileSystem = new FileSystem(true, 'ssh -i ~/keys/WestCompute.pem ubuntu@ec2-3-90-39-139.compute-1.amazonaws.com');
export let fileSystem = new FileSystem();
export function setFileSystem(newFileSystem) {
    fileSystem = newFileSystem;
}
