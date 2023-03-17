var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/*
* Documentation/rant about language servers.
* This things are generally very poorly documented, so it is always a pain to add a new feature
* Right now, we have a single file source of truth here that acts like the client. We will probably
* want to separate this all into separate subclasses that all inherit from the base LanguageServerClient
* and each one has its own set of capabilities, features, etc that the lsp implements. Not sure if the
* right split is the file level for each of thesee

* But there are lots of annoying things that differ across servers. They all need to support a few common
* things, which is where a multiple LSPlugins may attach themselves to a running client which talks to the
* server. These LSPlugins implement the shared set of behaviors

* The details that differ are small, but important.
* For example, in registering capabilities upon an additional request, python and rust-analyzer
* take the form:
* {
    "pylsp": {
        INSERT_SETTINGS
    }
}
{
    "rustAnalyzer": {
        INSERT_SETTINGS
    }
}

But for gopls, it looks like:
[{
    SETTING_1
},
{
    SETTING_2
}
]


This is only really documented in this obscure issue: https://github.com/golang/go/issues/38819
*/
import { URI } from 'vscode-uri';
import { getLanguageFromFilename } from '../extensions/utils';
import { v4 as uuidv4 } from 'uuid';
export const LSLanguages = [
    /*'copilot', */
    'typescript',
    'html',
    'css',
    'python',
    'c',
    'rust',
    'go',
    'csharp',
    'java',
    // God knows why we support php
    'php',
]; //'go', 'java', 'c', 'rust', 'csharp']
// The language server client class
export class LanguageServerClient {
    constructor(options) {
        // this.childProcess = cp.spawn(options.process.command, options.process.args);
        // this.childProcess = cp.spawn(options.process.command, options.process.args);
        // this.connection = rpc.createMessageConnection(
        //   new rpc.StreamMessageReader(this.childProcess.stdout!),
        //   new rpc.StreamMessageWriter(this.childProcess.stdin!)
        // );
        this.connectionName = null;
        // Tracks the document version for each document
        this.documentVersionMap = {};
        this.copilotSignedIn = false;
        this.queuedUids = [];
        this.uuid = '';
        this.ready = false;
        this.capabilities = {};
        this.plugins = [];
        this.initializePromise = this.initialize(options);
        this.isCopilot = options.language == 'copilot';
        this.queuedUids = [];
        this.uuid = uuidv4();
    }
    getName() {
        return this.connectionName;
    }
    // Initialize the connection with the server
    initialize(options) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            console.log('Starting process in LSP Options', options.language);
            const rootURI = (options.rootUri ||
                ((_b = (_a = options.workspaceFolders) === null || _a === void 0 ? void 0 : _a.at(-1)) === null || _b === void 0 ? void 0 : _b.uri));
            const rootDir = URI.parse(rootURI).path;
            this.connectionName = yield connector.startLS(options.language, rootDir);
            connector.addNotificationCallback((data) => {
                this.processNotification(data);
            }, this.connectionName);
            connector.addRequestCallback((data) => {
                return this.processRequest(data);
            }, this.connectionName);
            // Now ready for normal work
            const workspaceFolder = {
                uri: options.rootUri,
                name: 'root',
            };
            const initializationParameters = {
                capabilities: {
                    textDocument: {
                        publishDiagnostics: {
                            relatedInformation: true,
                            codeDescriptionSupport: true,
                            dataSupport: true,
                        },
                        hover: {
                            dynamicRegistration: true,
                            contentFormat: ['markdown', 'plaintext'],
                        },
                        moniker: {},
                        synchronization: {
                            dynamicRegistration: true,
                            willSave: false,
                            didSave: false,
                            willSaveWaitUntil: false,
                        },
                        // include support for additionalTextEdits
                        completion: {
                            dynamicRegistration: true,
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ['markdown', 'plaintext'],
                                deprecatedSupport: false,
                                preselectSupport: false,
                                insertReplaceSupport: true,
                                resolveSupport: {
                                    properties: [
                                        'documentation',
                                        'detail',
                                        'additionalTextEdits',
                                    ],
                                },
                            },
                            contextSupport: false,
                        },
                        signatureHelp: {
                            dynamicRegistration: true,
                            signatureInformation: {
                                documentationFormat: ['markdown', 'plaintext'],
                            },
                        },
                        declaration: {
                            dynamicRegistration: true,
                            linkSupport: true,
                        },
                        definition: {
                            dynamicRegistration: true,
                            linkSupport: true,
                        },
                        typeDefinition: {
                            dynamicRegistration: true,
                            linkSupport: true,
                        },
                        implementation: {
                            dynamicRegistration: true,
                            linkSupport: true,
                        },
                        codeAction: {
                            codeActionLiteralSupport: {
                                codeActionKind: {
                                    valueSet: [
                                        'quickfix',
                                        'refactor',
                                        // 'source.organizeImports',
                                        // 'refactor.rewrite',
                                        // 'refactor.inline'
                                    ],
                                },
                            },
                        },
                    },
                    workspace: {
                        didChangeConfiguration: {
                            dynamicRegistration: true,
                        },
                        workspaceFolders: true,
                        configuration: true,
                    },
                },
                processId: null,
                rootUri: null,
                workspaceFolders: [workspaceFolder],
                //options.workspaceFolders,
            };
            if (!this.isCopilot && this.getName() != 'html') {
                // Copilot and html cant do initialization options
                // In the future, we will need a more principled way of
                // doing this
                console.log('Is Copilot', this.getName(), this.isCopilot);
                initializationParameters.initializationOptions = {
                    semanticTokens: true,
                };
                initializationParameters.capabilities.textDocument.semanticTokens =
                    {
                        dynamicRegistration: true,
                        requests: {
                            full: {
                                delta: true,
                            },
                        },
                        tokenTypes: [
                            'comment',
                            'keyword',
                            'string',
                            'number',
                            'regexp',
                            'operator',
                            'namespace',
                            'type',
                            'struct',
                            'class',
                            'interface',
                            'enum',
                            'typeParameter',
                            'function',
                            'member',
                            'property',
                            'macro',
                            'variable',
                            'parameter',
                            'label',
                            'method',
                        ],
                        tokenModifiers: [
                            'declaration',
                            'deprecated',
                            'documentation',
                            'deduced',
                            'readonly',
                            'static',
                            'abstract',
                            'dependantName',
                            'defaultLibrary',
                            'usedAsMutableReference',
                            'functionScope',
                            'classScope',
                            'fileScope',
                            'globalScope',
                            'modification',
                            'async',
                        ],
                        formats: ['relative'],
                    };
            }
            const { capabilities } = yield this.request('initialize', initializationParameters);
            this.capabilities = capabilities;
            console.log('Got capabilities');
            console.log({ language: this.connectionName, capabilities });
            this.notify('initialized', {});
            this.ready = true;
            this.autoClose = options.autoClose;
            // DISABLED WHEN USING PYRIGHT
            // Adding config settings for python
            if (this.getName() == 'python') {
                console.log('sending configurations to disable pycodestyle');
                let settings = {
                    pylsp: {
                        plugins: {
                            pycodestyle: { enabled: false },
                            mccabe: { enabled: false },
                        },
                    },
                };
                this.sendConfiguration(settings);
            }
        });
    }
    // Send a request to the server and return the response or error
    request(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = { language: this.connectionName, method, params };
            // @ts-ignore
            return yield connector.sendRequestLS(payload);
        });
    }
    // Send a notification to the server
    notify(method, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const payload = { language: this.connectionName, method, params };
            // @ts-ignore
            return yield connector.sendNotificationLS({
                language: this.connectionName,
                method,
                params,
            });
        });
    }
    // Process a notification from the server and dispatch it to the plugins
    processNotification(notification) {
        for (const plugin of this.plugins) {
            plugin.processNotification(notification);
        }
    }
    processRequest(request) {
        // TODO incorporate the return type
        console.log('PROCESSING REQUEST', this.getName(), request);
        switch (request.method) {
            case 'workspace/configuration':
                switch (this.getName()) {
                    case 'python':
                        console.log('got configuration request for py');
                        console.log(request.params);
                        return {
                            pylsp: {
                                plugins: {
                                    pycodestyle: { enabled: false },
                                    mccabe: { enabled: false },
                                },
                            },
                        };
                    case 'go':
                        console.log('got configuration request for go');
                        console.log(request.params);
                        return [
                            {
                                // gopls: {
                                'ui.semanticTokens': true,
                                // ui: { semanticTokens: true },
                            },
                        ];
                    case 'java':
                        return [
                            { 'java.format.tabSize': 4 },
                            { 'java.format.insertSpaces': true },
                        ];
                    default:
                        return;
                }
            case 'client/registerCapability':
                console.log(this.getName(), request.params);
                request.params.registrations.forEach((registration) => {
                    // First we split the method name into the plugin name and the method
                    const method = registration.method;
                    switch (method) {
                        case 'textDocument/semanticTokens':
                            this.capabilities.semanticTokensProvider =
                                registration.registerOptions || true;
                            return;
                        case 'textDocument/completion':
                            this.capabilities.completionProvider =
                                registration.registerOptions || true;
                            return;
                        case 'textDocument/hover':
                            this.capabilities.hoverProvider =
                                registration.registerOptions || true;
                            return;
                        case 'textDocument/documentHighlight':
                            this.capabilities.documentHighlightProvider =
                                registration.registerOptions || true;
                            return;
                        case 'textDocument/documentLink':
                            this.capabilities.documentLinkProvider =
                                registration.registerOptions || true;
                            return;
                        case 'textDocument/definition':
                            this.capabilities.definitionProvider =
                                registration.registerOptions || true;
                            return;
                        case 'workspace/symbol':
                            this.capabilities.workspaceSymbolProvider =
                                registration.registerOptions || true;
                            return;
                        default:
                            break;
                    }
                });
                break;
            default:
                return;
        }
    }
    /// All Notifications
    textDocumentDidOpen(params) {
        this.notify('textDocument/didOpen', params);
    }
    textDocumentDidClose(params) {
        this.notify('textDocument/didClose', params);
    }
    textDocumentDidChange(params) {
        this.notify('textDocument/didChange', params);
    }
    workspaceDidChangeConfiguration(params) {
        this.notify('workspace/didChangeConfiguration', params);
    }
    /// All Requests
    textDocumentHover(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/hover', params);
        });
    }
    textDocumentCompletion(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/completion', params);
        });
    }
    textDocumentDefinition(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/definition', params);
        });
    }
    textDocumentReferences(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/references', params);
        });
    }
    textDocumentSymbol(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/documentSymbol', params);
        });
    }
    textDocumentSemanticTokensFull(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/semanticTokens/full', params);
        });
    }
    textDocumentSemanticTokensFullDelta(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/semanticTokens/full/delta', params);
        });
    }
    textDocumentCodeAction(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/codeAction', params);
        });
    }
    textDocumentDocumentLink(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('textDocument/documentLink', params);
        });
    }
    completionItemResolve(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('completionItem/resolve', params);
        });
    }
    // Add a new function for getting symbols
    workspaceSymbol(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('workspace/symbol', params);
        });
    }
    workspaceSymbolResolve(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('workspaceSymbol/resolve', params);
        });
    }
    signOut() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('signOut', {});
        });
    }
    signInInitiate(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('signInInitiate', params);
        });
    }
    signInConfirm(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('signInConfirm', params);
        });
    }
    acceptCompletion(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('notifyAccepted', params);
        });
    }
    rejectCompletions(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.request('notifyRejected', params);
        });
    }
    // Close the connection with the server
    close() {
        // @ts-ignore
        connector.killLS(this.connectionName);
        // @ts-ignore
        connector.removeNotificationCallback(this.connectionName);
        // @ts-ignore
        connector.removeRequestCallback(this.connectionName);
    }
    maybeOpenDocument({ documentPath, documentText, }) {
        if (!(documentPath in this.documentVersionMap)) {
            this.openDocument({ documentPath, documentText });
        }
    }
    openDocument({ documentPath, documentText, }) {
        // Send a didOpen notification with the document information
        this.documentVersionMap[documentPath] = 0;
        const textDocument = {
            textDocument: {
                uri: URI.file(documentPath).toString(),
                languageId: getLanguageFromFilename(documentPath),
                text: documentText,
                version: this.documentVersionMap[documentPath],
            },
        };
        this.textDocumentDidOpen(textDocument);
    }
    closeDocument({ documentPath }) {
        // Send a didClose notification with the document information
        const textDocument = {
            textDocument: {
                uri: URI.file(documentPath).toString(),
            },
        };
        this.textDocumentDidClose(textDocument);
        delete this.documentVersionMap[documentPath];
    }
    // Send a document change to the server
    sendChange({ documentPath, documentText, }) {
        return __awaiter(this, void 0, void 0, function* () {
            // Do nothing if the client is not ready
            if (!this.ready)
                return;
            // console.log('sending change');
            const documentChange = {
                textDocument: {
                    uri: URI.file(documentPath).toString(),
                    version: ++this.documentVersionMap[documentPath],
                },
                contentChanges: [{ text: documentText }],
            };
            try {
                this.textDocumentDidChange(documentChange);
            }
            catch (e) {
                console.error(e);
            }
        });
    }
    sendConfiguration(settings) {
        return __awaiter(this, void 0, void 0, function* () {
            this.workspaceDidChangeConfiguration({ settings });
        });
    }
    getDefinition(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { path, pos } = params;
            const payload = {
                textDocument: {
                    uri: URI.file(path).toString(),
                },
                position: pos,
            };
            const origResult = yield this.textDocumentDefinition(payload);
            let result;
            console.log('GOT DEFINITION', origResult);
            if (origResult == null) {
                return;
            }
            else if (Array.isArray(origResult)) {
                result = origResult[0];
            }
            else {
                result = origResult;
            }
            let uri;
            let range;
            // Check if result has targetUri attr
            if ('targetUri' in result) {
                uri = result.targetUri;
                range = result.targetSelectionRange;
            }
            else {
                uri = result.uri;
                range = result.range;
            }
            // Weird edge case where we get a result that doesn't start with /
            if (!uri.startsWith('file:///')) {
                if (uri.startsWith('file://')) {
                    uri = uri.replace('file://', 'file:///');
                }
            }
            const newPath = URI.parse(uri).path;
            return { newPath, range };
        });
    }
    // Attach a plugin to the client
    attachPlugin(plugin) {
        this.plugins.push(plugin);
    }
    // Detach a plugin from the client
    detachPlugin(plugin) {
        const i = this.plugins.indexOf(plugin);
        if (i === -1)
            return;
        this.plugins.splice(i, 1);
        if (this.autoClose)
            this.close();
    }
    copilotSignOut() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.copilotSignedIn) {
                yield this.signOut();
            }
        });
    }
    signedIn() {
        return __awaiter(this, void 0, void 0, function* () {
            let { status } = yield this.request('checkStatus', {});
            if (status == 'SignedIn' ||
                status == 'AlreadySignedIn' ||
                status == 'OK') {
                return true;
            }
            else {
                return false;
            }
        });
    }
    getCompletion(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const response = yield this.request('getCompletions', params);
            // console.log({response});
            this.queuedUids = [...response.completions.map((c) => c.uuid)];
            return response;
        });
    }
    accept(uuid) {
        return __awaiter(this, void 0, void 0, function* () {
            let badUids = this.queuedUids.filter((u) => u != uuid);
            this.queuedUids = [];
            yield this.acceptCompletion({ uuid });
            yield this.rejectCompletions({ uuids: badUids });
        });
    }
    reject() {
        return __awaiter(this, void 0, void 0, function* () {
            let badUids = this.queuedUids;
            this.queuedUids = [];
            return yield this.rejectCompletions({ uuids: badUids });
        });
    }
}
export class CopilotServerClient extends LanguageServerClient {
}
