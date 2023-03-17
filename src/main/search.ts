var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import * as cp from 'child_process';
import { ipcMain } from 'electron';
import { promisify } from 'util';
import { PLATFORM_INFO, rgLoc } from './utils';
const searchRipGrep = (event, arg) => __awaiter(void 0, void 0, void 0, function* () {
    // Instead run ripgrep fromt the cli
    // let cmd = ['rg', '--json', '--line-number', '--with-filename']
    let cmd = ['--json', '--line-number', '--with-filename'];
    if (arg.caseSensitive) {
        cmd.push('--case-sensitive');
    }
    else {
        cmd.push('-i');
    }
    for (let badPath of arg.badPaths) {
        cmd.push('--ignore-file', badPath);
    }
    // cmd.push(`"${arg.query}"`, arg.rootPath);
    cmd.push(arg.query, arg.rootPath);
    let start = performance.now();
    let childProcess = cp.spawn(rgLoc, cmd);
    let rawData = [];
    let errored = false;
    var overflowBuffer = '';
    const trimLines = (lines) => {
        lines = overflowBuffer + lines;
        overflowBuffer = '';
        return lines
            .trim()
            .split('\n')
            .filter((match) => {
            try {
                let data = JSON.parse(match);
                if (data.type === 'match') {
                    return match;
                }
            }
            catch (e) {
                overflowBuffer += match;
            }
        });
    };
    childProcess.on('error', (err) => {
        console.log(err);
        errored = true;
    });
    childProcess.stdout.on('data', (chunk) => {
        rawData.push(...trimLines(chunk.toString()));
        if (rawData.length > 500) {
            // Exit the process
            childProcess.kill();
        }
    });
    // Wait for the process to finish
    yield new Promise((resolve, reject) => {
        childProcess.on('close', (code) => {
            resolve(code);
        });
    });
    return rawData;
});
const customDebounce = (func, wait = 0) => {
    let timeout;
    let lastCall = 0;
    return (...args) => {
        const now = Date.now();
        if (now - lastCall < wait) {
            clearTimeout(timeout);
            return new Promise((resolve, reject) => {
                timeout = setTimeout(() => {
                    lastCall = now;
                    let out = func(...args);
                    return resolve(out);
                }, wait);
            });
        }
        else {
            lastCall = now;
            return func(...args);
        }
    };
};
const searchFilesName = (event, { query, rootPath, topResults = 50, }) => __awaiter(void 0, void 0, void 0, function* () {
    const wildcardQuery = query.split('').join('*');
    const cmd = process.platform === 'win32'
        ? `${rgLoc} --iglob "*${query}*" --files '' ./ | head -n ${topResults}`
        : `find . -type f -iname "*${query}*" | head -n ${topResults}`;
    const { stdout } = yield promisify(cp.exec)(cmd, { cwd: rootPath });
    return stdout
        .split('\n')
        .map((s) => {
        if (s.startsWith('./')) {
            return s.slice(2);
        }
        return s;
    })
        .filter(Boolean);
});
const searchFilesPath = (event, { query, rootPath, topResults = 50, }) => __awaiter(void 0, void 0, void 0, function* () {
    const wildcardQuery = query.split('').join('*');
    const cmd = process.platform === 'win32'
        ? `${rgLoc} --iglob "*${query}*" --files '' ./ | head -n ${topResults}`
        : `find . -typef -ipath "*${query}*" | head -n ${topResults}`;
    const { stdout } = yield promisify(cp.exec)(cmd, { cwd: rootPath });
    return stdout
        .split('\n')
        .map((s) => {
        if (s.startsWith('./')) {
            return s.slice(2);
        }
        return s;
    })
        .filter(Boolean);
});
const searchFilesPathGit = (event, { query, rootPath, topResults = 50, }) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield doesCommandSucceed('git ls-files ffff', rootPath)) {
        const cmd = `git ls-files | grep "${query}" | head -n ${topResults}`;
        try {
            const { stdout } = yield promisify(cp.exec)(cmd, { cwd: rootPath });
            return stdout
                .split('\n')
                .map((l) => {
                // map / to connector.PLATFORM_DELIMITER
                return l.replace(/\//g, PLATFORM_INFO.PLATFORM_DELIMITER);
            })
                .filter(Boolean);
        }
        catch (e) {
            console.log(e);
        }
    }
    return yield searchFilesPath(event, { query, rootPath, topResults });
});
const doesCommandSucceed = (cmd, rootPath) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const res = yield promisify(cp.exec)(cmd, { cwd: rootPath });
        return true;
    }
    catch (e) {
        return false;
    }
});
const searchFilesNameGit = (event, { query, rootPath, topResults = 50, }) => __awaiter(void 0, void 0, void 0, function* () {
    if (yield doesCommandSucceed('git ls-files ffff', rootPath)) {
        const cmd = `git ls-files | grep -i "${query}[^\/]*" | grep -v "^node_modules/" | head -n ${topResults}`;
        try {
            const { stdout } = yield promisify(cp.exec)(cmd, { cwd: rootPath });
            return stdout
                .split('\n')
                .map((l) => {
                // map / to connector.PLATFORM_DELIMITER
                return l.replace(/\//g, PLATFORM_INFO.PLATFORM_DELIMITER);
            })
                .filter(Boolean);
        }
        catch (e) {
            console.log(e);
        }
    }
    // we'll have to run it with find
    return yield searchFilesName(event, { query, rootPath, topResults });
});
export const setupSearch = () => {
    ipcMain.handle('searchRipGrep', customDebounce(searchRipGrep));
    ipcMain.handle('searchFilesName', customDebounce(searchFilesName));
    ipcMain.handle('searchFilesPath', customDebounce(searchFilesPath));
    ipcMain.handle('searchFilesPathGit', customDebounce(searchFilesPathGit));
    ipcMain.handle('searchFilesNameGit', customDebounce(searchFilesNameGit));
};
