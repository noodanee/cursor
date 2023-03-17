var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { findFileIdFromPath, getPathForFileId, getPathForFolderId, } from '../window/fileUtils';
import { getContentsIfNeeded } from '../window/fileUtils';
import { joinAdvanced } from '../../utils';
import { badWords } from './badWords';
export function splitIntoWords(e) {
    return e
        .split(/[^a-zA-Z0-9]/)
        .filter((e) => e.length > 0)
        .filter((e) => !badWords.has(e));
}
// jaccard distance
// TODO check
function compareWords(a, b) {
    let intersection = 0;
    let union = 0;
    let aSet = new Set(a);
    let bSet = new Set(b);
    let cSet = new Set();
    for (let word of aSet) {
        if (bSet.has(word)) {
            intersection++;
            cSet.add(word);
        }
        union++;
    }
    for (let word of bSet) {
        if (!aSet.has(word))
            union++;
    }
    const fairUnion = Math.min(union, aSet.size, bSet.size);
    return intersection / fairUnion;
}
function getExtension(fileName) {
    return fileName.split('.').pop();
}
function filterFilesByExtension(state, fileIds, extension) {
    return fileIds.filter((fileId) => {
        return state.global.files[fileId].name.endsWith(extension);
    });
}
function loadContentsOfFileIds(state, fileIds) {
    return __awaiter(this, void 0, void 0, function* () {
        // keyed by number
        const contentsArr = {};
        for (let fileId of fileIds) {
            contentsArr[fileId] = yield getContentsIfNeeded(state.global, fileId);
        }
        return contentsArr;
    });
}
function filterFilesByLength(state, fileContents) {
    return Object.keys(fileContents)
        .filter((fileId) => {
        const len = fileContents[parseInt(fileId)].split('\n').length;
        return len > 0 && len < 1000;
    })
        .map((fileId) => parseInt(fileId));
}
function getFileIdsNotInForbidden(state, forbiddenFolders) {
    // start at root folder (id 1) and then recursively find files, make sure to not go into forbidden folders
    let fileIds = [];
    let foldersToVisit = [1];
    while (foldersToVisit.length > 0) {
        let folderId = foldersToVisit.pop();
        let folder = state.global.folders[folderId];
        for (let fileId of folder.fileIds) {
            fileIds.push(fileId);
        }
        for (let subFolderId of folder.folderIds) {
            const subFolderName = state.global.folders[subFolderId].name;
            if (!forbiddenFolders.includes(subFolderName) &&
                subFolderName[0] != '.') {
                foldersToVisit.push(subFolderId);
            }
        }
    }
    return fileIds;
}
function getMostRecentFileIds(state, fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const extension = getExtension(state.global.files[fileId].name);
        const startingFileIds = getFileIdsNotInForbidden(state, ['node_modules']);
        const matchedExtensions = filterFilesByExtension(state, startingFileIds, extension);
        const contents = yield loadContentsOfFileIds(state, matchedExtensions);
        // filter the file ids that are too long
        let candidateFileIds = filterFilesByLength(state, contents).filter((fid) => {
            return fid != fileId;
        });
        candidateFileIds = candidateFileIds.filter((fid) => {
            return state.global.files[fid].latestAccessTime != null;
        });
        candidateFileIds = candidateFileIds
            .sort((a, b) => {
            const first = state.global.files[b].latestAccessTime || 0;
            const second = state.global.files[a].latestAccessTime || 0;
            return first - second;
        })
            .slice(0, 20);
        // return the contents
        return candidateFileIds.reduce((acc, fileId) => {
            acc[fileId] = contents[fileId];
            return acc;
        }, {});
    });
}
export function getCopilotSnippets(state, fileId, slidingWindow = 50, maxSnippets = 5, thresholdSimilarity = 0.2) {
    return __awaiter(this, void 0, void 0, function* () {
        let words = splitIntoWords(state.global.fileCache[fileId].contents);
        let snippets = [];
        // get the 20 most recent fileids
        let recentFileContents = yield getMostRecentFileIds(state, fileId);
        let maxSim = 0;
        let maxSnippet = null;
        for (let fidStr of Object.keys(recentFileContents)) {
            let fileId = parseInt(fidStr);
            const path = getPathForFileId(state.global, fileId);
            let contents = recentFileContents[fileId];
            let lines = contents.split('\n');
            for (let i = 0; i < Math.max(1, lines.length - slidingWindow); i++) {
                let window = lines.slice(i, i + slidingWindow).join('\n');
                let windowWords = splitIntoWords(window);
                let similarity = compareWords(words, windowWords);
                if (similarity > thresholdSimilarity) {
                    snippets[fileId] = {
                        score: similarity,
                        fileId: fileId,
                        text: window,
                    };
                }
                if (similarity > maxSim) {
                    maxSim = similarity;
                    maxSnippet = window;
                }
            }
        }
        let sortedSnippets = Object.values(snippets)
            .sort((a, b) => b.score - a.score)
            .slice(0, maxSnippets)
            .map((e) => {
            return {
                text: e.text,
                path: getPathForFileId(state.global, e.fileId),
            };
        });
        return sortedSnippets;
    });
}
export function getIntellisenseSymbols(state, fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        // TODO loop through current file and get all top level function statements
        // Find all imported file paths
        // Try to locate them on disk
        // for each find their exported function statementsA
        // pass back a string array
        const fileContents = yield getContentsIfNeeded(state.global, fileId);
        const lines = fileContents.split('\n');
        const symbols = [];
        const currentFolderPath = getPathForFolderId(state.global, state.global.files[fileId].parentFolderId);
        for (let line of lines) {
            // find function name in any line that begins with function
            const match = line.match(/^\s*(export )?function ([a-zA-Z0-9_]+)/);
            if (match) {
                symbols.push(match[2]);
            }
        }
        // find the paths of all local imported files
        const importRegex = /import .* from ['"](.*)['"]/g;
        const importMatches = fileContents.matchAll(importRegex);
        const moduleRegex = /import \* as ([a-zA-Z0-9_]+) from/;
        for (let match of importMatches) {
            const importPath = match[1];
            const moduleMatch = match[0].match(moduleRegex);
            const moduleName = moduleMatch && moduleMatch.length > 1 ? moduleMatch[1] : null;
            // maerge current folder path with import path
            const fullPath = joinAdvanced(currentFolderPath, importPath);
            let foundFile = false;
            for (let ext of ['ts', 'tsx', 'js', 'jsx']) {
                const fileId = findFileIdFromPath(state.global, fullPath + '.' + ext);
                if (fileId) {
                    foundFile = true;
                    const fileContents = yield getContentsIfNeeded(state.global, fileId);
                    const lines = fileContents.split('\n');
                    for (let line of lines) {
                        // match exported function statem
                        let match = line.match(/^\s*export (type )?(enum )?(interface )?(const )?(async )?(function )?([a-zA-Z0-9_]+)/);
                        if (match) {
                            // regex to get import * as ___ from
                            let found = match[7];
                            if (moduleName) {
                                found = moduleName + '.' + found;
                            }
                            symbols.push(found);
                        }
                    }
                    break;
                }
            }
            if (!foundFile) {
                console.log('could not find file', importPath, fullPath);
            }
        }
        return symbols;
    });
}
export function getAllExportedFunctionSymbols(state, fileId) {
    return __awaiter(this, void 0, void 0, function* () {
        const fileContents = yield getContentsIfNeeded(state.global, fileId);
        const lines = fileContents.split('\n');
        const symbols = [];
        for (let line of lines) {
            // find function name in any line that begins with function
            const match = line.match(/^\s*(export )?function ([a-zA-Z0-9_]+)/);
            if (match) {
                symbols.push(match[2]);
            }
        }
        return symbols;
    });
}
