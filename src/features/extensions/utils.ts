var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { store } from '../../app/store';
import { getCurrentTab, getFilePath, getFocusedTab, getTab, } from '../selectors';
import { getTests, selectHasTests } from '../tests/testSelectors';
import { API_ROOT } from '../../utils';
import { StateEffect } from '@codemirror/state';
import { paneIdField } from './storePane';
export const reduxTransaction = StateEffect.define({});
const languagesToExtension = {
    python: ['py', 'pyi'],
    javascript: ['js', 'jsx', 'ts', 'tsx'],
    java: ['java'],
    c: ['c'],
    cpp: ['cpp', 'cc', 'cxx', 'c++', 'h', 'hpp', 'hh', 'hxx', 'h++'],
    go: ['go'],
    rust: ['rs'],
    ruby: ['rb'],
    php: ['php'],
    scala: ['scala'],
    kotlin: ['kt', 'kts'],
    swift: ['swift'],
    dart: ['dart'],
    r: ['r'],
    julia: ['jl'],
    haskell: ['hs'],
    html: ['html', 'htm'],
    css: ['css'],
    csharp: ['cs'],
    coffeescript: ['coffee'],
    clojure: ['clj'],
    bibtex: ['bib'],
    abap: ['abap'],
    bat: ['bat'],
    fsharp: ['fs', 'fsx'],
    elixir: ['ex', 'exs'],
    erlang: ['erl', 'hrl'],
    dockerfile: ['dockerfile'],
    handlebars: ['hbs'],
    ini: ['ini'],
    latex: ['tex'],
    less: ['less'],
    lua: ['lua'],
    makefile: ['mak'],
    markdown: ['md'],
    'objective-c': ['m'],
    'objective-cpp': ['mm'],
    perl: ['pl', 'pm', 'p6'],
    powershell: ['ps1'],
    jade: ['pug'],
    razor: ['cshtml'],
    scss: ['scss'],
    sass: ['sass'],
    shaderlab: ['shader'],
    shellscript: ['sh', 'bash'],
    sql: ['sql'],
    vb: ['vb'],
    xml: ['xml'],
    xsl: ['xsl'],
    yaml: ['yaml', 'yml'],
};
const extensions = {
    abap: 'abap',
    bat: 'bat',
    bib: 'bibtex',
    clj: 'clojure',
    coffee: 'coffeescript',
    c: 'c',
    h: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    csproj: 'csharp',
    css: 'css',
    diff: 'diff',
    patch: 'diff',
    dart: 'dart',
    dockerfile: 'dockerfile',
    ex: 'elixir',
    exs: 'elixir',
    erl: 'erlang',
    hrl: 'erlang',
    fs: 'fsharp',
    fsx: 'fsharp',
    gitignore: 'gitignore',
    gitattributes: 'gitattributes',
    gitmodules: 'gitmodules',
    go: 'go',
    groovy: 'groovy',
    gradle: 'groovy',
    hbs: 'handlebars',
    html: 'html',
    htm: 'html',
    ini: 'ini',
    java: 'java',
    js: 'javascript',
    jsx: 'javascriptreact',
    json: 'json',
    tex: 'latex',
    less: 'less',
    lua: 'lua',
    mak: 'makefile',
    md: 'markdown',
    m: 'objective-c',
    mm: 'objective-cpp',
    pl: 'perl',
    pm: 'perl',
    p6: 'perl6',
    php: 'php',
    ps1: 'powershell',
    pug: 'jade',
    py: 'python',
    r: 'r',
    cshtml: 'razor',
    rb: 'ruby',
    rs: 'rust',
    scss: 'scss',
    sass: 'sass',
    scala: 'scala',
    shader: 'shaderlab',
    sh: 'shellscript',
    bash: 'shellscript',
    sql: 'sql',
    swift: 'swift',
    ts: 'typescript',
    tsx: 'typescriptreact',
    vb: 'vb',
    xml: 'xml',
    xsl: 'xsl',
    yaml: 'yaml',
    yml: 'yaml',
    sve: 'javascript',
    svelte: 'javascript',
};
export function getLanguageFromFilename(filename) {
    const extension = filename.split('.').pop();
    if (extension) {
        return extensions[extension] || 'plaintext';
    }
    return 'plaintext';
}
export function getNamesAndBodies(cursor, contents) {
    const results = [];
    let lastFrom = -1;
    do {
        if (cursor.from < lastFrom) {
            break;
        }
        lastFrom = cursor.from;
        if (cursor != null &&
            cursor.from != null &&
            cursor.to != null &&
            [
                'MethodDeclaration',
                'FunctionDeclaration',
                'VariableDeclaration',
                'Property',
                'FunctionDefinition',
            ].includes(cursor.name)) {
            let from = cursor.from;
            let to = cursor.to;
            const functionBody = contents.slice(from, to);
            // get the actual body of the function using Lezer
            let functionName = null;
            do {
                // @ts-ignore
                if ([
                    'VariableDefinition',
                    'PropertyDefinition',
                    'VariableName',
                ].includes(cursor.name)) {
                    functionName = contents.slice(cursor.from, cursor.to);
                    break;
                }
            } while (cursor.next(true));
            if (functionName == null)
                continue;
            const lines = functionBody.split('\n').length;
            if (lines > 10) {
                results.push({
                    name: functionName,
                    body: functionBody,
                    from: from,
                });
            }
        }
    } while (cursor.next());
    return results;
}
export function backTrack(node) {
    const iterator = {
        next() {
            // start with prev sybling and the when done go to parent
            if (node.prevSibling) {
                node = node.prevSibling;
                return node;
            }
            if (node.parent) {
                node = node.parent;
                return node;
            }
            return null;
        },
    };
    return iterator;
}
// backtrack until
// 'MethodDeclaration',
// 'FunctionDeclaration',
// 'VariableDeclaration',
// 'Property',
// 'FunctionDefinition',
export function findDeclarationGivenDefinition(node) {
    const iterator = backTrack(node);
    let currentNode = iterator.next();
    while (currentNode) {
        if ([
            'MethodDeclaration',
            'FunctionDeclaration',
            'VariableDeclaration',
            'Property',
            'FunctionDefinition',
        ].includes(currentNode.name)) {
            return currentNode;
        }
        currentNode = iterator.next();
    }
    return null;
}
export function getCommentSingle(data) {
    return __awaiter(this, void 0, void 0, function* () {
        const response = yield fetch(`${API_ROOT}/commentSingle`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            //credentials: 'include',
            body: JSON.stringify(data),
        });
        return (yield response.json());
    });
}
export function getCachedFileName() {
    const state = store.getState();
    const focusedTab = getFocusedTab(state);
    if (focusedTab) {
        return getFilePath(focusedTab.fileId)(state);
    }
}
export function getCachedComments() {
    let comments = {};
    const state = store.getState();
    const tab = getFocusedTab(state);
    if (tab != null) {
        const filePath = getFilePath(tab.fileId)(state);
        comments = state.commentState.fileThenNames[filePath] || {};
    }
    return comments;
}
export function getCachedTests() {
    let tests = {};
    const state = store.getState();
    const tab = getFocusedTab(state);
    if (tab != null) {
        const filePath = getFilePath(tab.fileId)(state);
        const rawTests = getTests(filePath)(state);
        for (const test of rawTests) {
            tests[test.functionName] = test;
        }
    }
    return tests;
}
export function getHasTestFile() {
    const state = store.getState();
    const tab = getFocusedTab(state);
    if (tab != null) {
        const filePath = getFilePath(tab.fileId)(state);
        return selectHasTests(filePath)(state);
    }
    return false;
}
export function getCurrentFileId() {
    const state = store.getState();
    return getFocusedTab(state).fileId;
}
export function getViewFileId(view) {
    // use the paneId statefield
    const viewPaneId = view.state.field(paneIdField);
    console.log('viewPaneId', viewPaneId);
    const state = store.getState();
    return getTab(getCurrentTab(viewPaneId)(state))(state).fileId;
}
export function getViewTabId(view) {
    // use the paneId statefield
    const viewPaneId = view.state.field(paneIdField);
    const state = store.getState();
    return getCurrentTab(viewPaneId)(state);
}
