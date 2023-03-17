var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { useEffect, useMemo } from 'react';
import { EditorState } from '@codemirror/state';
import { closeHoverTooltips, EditorView, keymap } from '@codemirror/view';
import { Prec, Compartment } from '@codemirror/state';
import { syntaxBundle } from '../../features/extensions/syntax';
import { indentationMarkers } from '../../features/extensions/indentLines';
// import { indentationMarkers } from '@replit/codemirror-indentation-markers';
import { diffExtension, } from '../../features/extensions/diff';
import { hackExtension, } from '../../features/extensions/hackDiff';
import { diagnosticsField, lintGutter } from '../../features/linter/lint';
import { autocompleteView } from '../../features/extensions/autocomplete';
import { acceptCompletion } from '@codemirror/autocomplete';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
import * as cs from '../../features/chat/chatSlice';
import * as csel from '../../features/chat/chatSelectors';
import * as ssel from '../../features/settings/settingsSelectors';
import { getFileIndentUnit } from '../../features/selectors';
import { indentUnit } from '@codemirror/language';
import { vim } from '../codemirror-vim';
import { moveToPane, saveFile } from '../../features/globalSlice';
import { closeTab } from '../../features/globalThunks';
import { languageBundle } from '../../features/extensions/lsp';
import { copilotBundle, rejectSuggestionCommand, getClient, completionDecoration, } from '../../features/extensions/ghostText';
import { copilotStatus, languageServerStatus, } from '../../features/lsp/languageServerSelector';
import { getLanguageFromFilename } from '../../features/extensions/utils';
import { scrollbarPlugin } from '../../features/extensions/minimap';
import { cursorTooltip } from '../../features/extensions/selectionTooltip';
import { indentSelection } from '@codemirror/commands';
import { emacs } from '@replit/codemirror-emacs';
import { newLineText } from '../../features/extensions/newLineText';
import { ViewPlugin, Decoration, } from '@codemirror/view';
import { RangeSetBuilder } from '@codemirror/state';
import { syntaxTree } from '@codemirror/language';
import { barExtension } from '../../features/extensions/cmdZBar';
import { updateCommentsEffect } from '../../features/extensions/comments';
import { getStyleTags, tags } from '@lezer/highlight';
import { fixLintExtension } from '../../features/linter/fixLSPExtension';
import { storePaneIdExtensions } from '../../features/extensions/storePane';
import { store } from '../../app/store';
import { triggerFileSearch } from '../../features/tools/toolSlice';
console.log({ tags });
const getTagName = (tag) => {
    for (const key of Object.keys(tags)) {
        // Turn key to string
        const keyString = key.toString();
        const currentTag = tags[keyString];
        if ('id' in currentTag && 'id' in tag) {
            if (currentTag.id === tag.id) {
                return keyString;
            }
        }
    }
};
const syntaxCompartment = new Compartment(), keyBindingsCompartment = new Compartment(), domCompartment = new Compartment(), commandBarCompartment = new Compartment(), diffCompartment = new Compartment(), indentCompartment = new Compartment(), copilotCompartment = new Compartment(), lsCompartment = new Compartment(), commentCompartment = new Compartment();
const OPEN_BRACKETS = ['{', '[', '('];
const CLOSE_BRACKETS = ['}', ']', ')'];
const ALL_BRACKETS = [...OPEN_BRACKETS, ...CLOSE_BRACKETS];
class TreeHighlighter {
    constructor(view) {
        this.markCache = Object.create(null);
        this.levels = [
            Decoration.mark({ class: 'bracketone' }),
            Decoration.mark({ class: 'brackettwo' }),
            Decoration.mark({ class: 'bracketthree' }),
        ];
        this.tree = syntaxTree(view.state);
        this.decorations = this.buildDeco(view);
    }
    update(update) {
        let tree = syntaxTree(update.state);
        if (tree != this.tree || update.viewportChanged) {
            this.tree = tree;
            this.decorations = this.buildDeco(update.view);
        }
    }
    buildDeco(view) {
        if (!this.tree.length)
            return Decoration.none;
        let builder = new RangeSetBuilder();
        let level = -1;
        let cursor = this.tree.cursor();
        do {
            const tagData = getStyleTags(cursor.node);
            // console.log({
            //     name: cursor.name,
            //     str: view.state.doc.sliceString(cursor.from, cursor.to),
            //     tags: tagData?.tags?.map(getTagName),
            //     tagData
            // })
            if (cursor != null &&
                ALL_BRACKETS.includes(cursor.name) &&
                cursor.from != null &&
                cursor.to != null) {
                if (OPEN_BRACKETS.includes(cursor.name)) {
                    level += 1;
                }
                if (level >= 0)
                    builder.add(cursor.from, cursor.to, this.levels[level % this.levels.length]);
                if (CLOSE_BRACKETS.includes(cursor.name)) {
                    level = Math.max(-1, level - 1);
                }
            }
        } while (cursor.next());
        return builder.finish();
    }
}
const treeHighlighter = Prec.high(ViewPlugin.fromClass(TreeHighlighter, {
    decorations: (v) => v.decorations,
}));
const globalExtensions = [
    EditorView.lineWrapping,
    indentationMarkers(),
    newLineText,
    diffExtension,
    hackExtension,
    lintGutter(),
    barExtension(),
    diagnosticsField,
    autocompleteView,
    storePaneIdExtensions,
    fixLintExtension,
    cursorTooltip(),
    // history({
    //     joinToEvent: (tr: Transaction, isAdjacent: boolean) => {
    //         return true
    //     },
    // }),
    //Prec.high(activeGutter),
    // TODO - remove
    // regexpLinter,
    Prec.highest(keymap.of([
        {
            key: connector.PLATFORM_CM_KEY + '-p',
            run: (view) => {
                console.log('yep');
                store.dispatch(triggerFileSearch());
                return true;
            },
        },
    ])),
    Prec.high(keymap.of([
        {
            key: 'Tab',
            run: acceptCompletion,
        },
    ])),
    Prec.highest(keymap.of([
        {
            key: connector.PLATFORM_CM_KEY + '-t',
            run: (view) => {
                console.log('running indent');
                indentSelection({
                    state: view.state,
                    dispatch: (transaction) => view.update([transaction]),
                });
                return true;
            },
        },
    ])),
    scrollbarPlugin,
    treeHighlighter,
    syntaxCompartment.of([]),
    lsCompartment.of([]),
    keyBindingsCompartment.of([]),
    domCompartment.of([]),
    commandBarCompartment.of([]),
    diffCompartment.of([]),
    indentCompartment.of([]),
    copilotCompartment.of([]),
    commentCompartment.of([]),
];
function getPrecedingLinesPos(view, numLines) {
    const selection = view.state.selection.main;
    const endLine = view.state.doc.lineAt(selection.from).number;
    const startLine = Math.max(1, endLine - numLines);
    const startLinePos = view.state.doc.line(startLine).from;
    const endLinePos = view.state.doc.line(endLine).to;
    return { startLinePos, endLinePos };
}
function getPrecedingLines(view, numLines) {
    return view.state.doc.sliceString(0, view.state.selection.main.from);
    // const {startLinePos, endLinePos} = getPrecedingLinesPos(view, numLines);
    // const selectedText = view.state.doc.sliceString(startLinePos, endLinePos);
    // return selectedText;
}
function getProcedingLines(view) {
    return view.state.doc.sliceString(view.state.selection.main.to, view.state.doc.length);
    // const selection = view.state.selection.main;
    // const endLine = view.state.doc.lineAt(selection.from).number;
    // const endLinePos = view.state.doc.line(endLine).to;
    // const selectedText = view.state.doc.sliceString(selection.from, endLinePos);
    // return selectedText;
}
function getSelectedPos(view) {
    const selection = view.state.selection.main;
    const startLine = view.state.doc.lineAt(selection.from).number;
    const endLine = view.state.doc.lineAt(selection.to).number;
    const startLinePos = view.state.doc.line(startLine).from;
    const endLinePos = view.state.doc.line(endLine).to;
    return { startLinePos, endLinePos };
}
function getSelectedText(view) {
    const selection = view.state.selection.main;
    const { startLinePos, endLinePos } = getSelectedPos(view);
    const selectedText = selection.from == selection.to
        ? null
        : view.state.doc.sliceString(startLinePos, endLinePos);
    return selectedText;
}
function getCurrentSelection(view) {
    const selection = view.state.selection.main;
    const startLine = view.state.doc.lineAt(selection.from).number;
    const endLine = view.state.doc.lineAt(selection.to).number;
    const startLinePos = view.state.doc.line(startLine).from;
    const endLinePos = view.state.doc.line(endLine).to;
    const selectedText = view.state.doc.sliceString(startLinePos, endLinePos);
    return {
        text: selectedText,
        startLine: startLine,
        endLine: endLine,
    };
}
export function useExtensions({ editorRef, filePath, relativeFilePath, tab, justCreated, }) {
    const commandBarOpen = useAppSelector(csel.getIsCommandBarOpen);
    const chatOpen = useAppSelector(csel.isChatOpen);
    const dispatch = useAppDispatch();
    const settings = useAppSelector(ssel.getSettings);
    const fileIndentUnit = useAppSelector(getFileIndentUnit(tab.fileId));
    const languageName = useMemo(() => getLanguageFromFilename(filePath), [filePath]);
    const lsStatus = useAppSelector(languageServerStatus(languageName));
    const isGenerating = useAppSelector(csel.getGenerating);
    const { signedIn, enabled } = useAppSelector(copilotStatus);
    const commentsInFile = useAppSelector((state) => state.commentState.fileThenNames[filePath]);
    useEffect(() => {
        var _a;
        let copilot;
        if (signedIn && enabled && !isGenerating) {
            copilot = copilotBundle({ filePath, relativeFilePath });
        }
        else {
            copilot = [];
        }
        if (((_a = editorRef.current) === null || _a === void 0 ? void 0 : _a.view) != null) {
            if (editorRef.current.view.state.field(completionDecoration, false)) {
                rejectSuggestionCommand(getClient(), editorRef.current.view);
            }
            editorRef.current.view.dispatch({
                effects: copilotCompartment.reconfigure(copilot),
            });
        }
    }, [justCreated, isGenerating, editorRef.current, signedIn, enabled]);
    useEffect(() => {
        var _a;
        let lsPlugin;
        if (lsStatus && lsStatus.installed && lsStatus.running) {
            lsPlugin = languageBundle(filePath);
        }
        else {
            lsPlugin = [];
        }
        (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
            effects: lsCompartment.reconfigure(lsPlugin),
        });
    }, [lsStatus, filePath, justCreated, editorRef.current]);
    useEffect(() => {
        const main = () => __awaiter(this, void 0, void 0, function* () {
            var _a;
            let syntax = yield syntaxBundle(filePath);
            (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
                effects: syntaxCompartment.reconfigure(syntax),
            });
        });
        main();
    }, [filePath, editorRef.current, settings, justCreated]);
    useEffect(() => {
        var _a;
        const newDom = Prec.high(EditorView.domEventHandlers({
            auxclick: (event, view) => {
                view.dispatch({
                    effects: closeHoverTooltips,
                });
                // get the text of the current selection
                if (event.button === 2) {
                    // Get the text at the current position
                    const pos = view.posAtCoords({
                        x: event.clientX,
                        y: event.clientY,
                    });
                    const cursorPos = view.state.selection.main.from;
                    // dispatch(cs.activateDiffFromEditor({
                    //     currentFile: filePath,
                    //     precedingCode: getPrecedingLines(view, 20)!,
                    //     procedingCode: getProcedingLines(view),
                    //     currentSelection: getSelectedText(view)!,
                    //     pos: cursorPos,
                    // }));
                    // Open the menu
                    const selection = getCurrentSelection(view);
                    connector.rightMenuAtToken({
                        offset: pos,
                        path: filePath,
                        includeAddToPrompt: commandBarOpen || chatOpen,
                        codeBlock: Object.assign({ fileId: tab.fileId }, selection),
                    });
                    //remove seelction
                    view.dispatch({
                        selection: { anchor: pos },
                    });
                }
            },
        }));
        (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
            effects: domCompartment.reconfigure(newDom),
        });
    }, [
        commandBarOpen,
        chatOpen,
        filePath,
        tab.fileId,
        editorRef.current,
        justCreated,
    ]);
    useEffect(() => {
        var _a;
        let keyBindingsExtension = [];
        switch (settings.keyBindings) {
            case 'vim':
                keyBindingsExtension = Prec.high(vim({
                    callbacks: {
                        save: () => {
                            dispatch(saveFile(null));
                        },
                        saveAndExit: () => {
                            dispatch(saveFile(null));
                            dispatch(closeTab(null));
                        },
                        exit: () => {
                            dispatch(closeTab(null));
                        },
                        toPane: (paneDirection) => () => {
                            dispatch(moveToPane({ paneDirection }));
                        },
                    },
                }));
                break;
            case 'emacs':
                keyBindingsExtension = Prec.high(emacs());
                break;
            default:
                break;
        }
        (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
            effects: keyBindingsCompartment.reconfigure(keyBindingsExtension),
        });
    }, [settings.keyBindings, editorRef.current, justCreated]);
    // useEffect(() => {
    //     editorRef.current.view?.dispatch({
    //         effects: diffCompartment.reconfigure(diffShortcuts),
    //     })
    // }, [filePath, editorRef.current, justCreated])
    useEffect(() => {
        var _a;
        (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
            effects: [updateCommentsEffect.of(true)],
        });
    }, [commentsInFile]);
    useEffect(() => {
        var _a;
        const commandBarExtension = Prec.highest(keymap.of([
            {
                key: connector.PLATFORM_CM_KEY + '-k',
                run: (view) => {
                    // const selPos = getSelectedPos(view);
                    // view.dispatch({
                    //     effects: editBoundaryEffect.of({
                    //         start: selPos.startLinePos,
                    //         end: selPos.endLinePos,
                    //     })
                    // })
                    // const selection = view.state.selection.main;
                    // const cursorPos = selection.from;
                    // //const preceedingPos = getPrecedingLinesPos(view, 20);
                    // view.dispatch({
                    //     effects: insertCursorEffect.of({
                    //         //pos: preceedingPos.endLinePos+1,
                    //         pos: cursorPos,
                    //     })
                    // })
                    // dispatch(changeSettings({
                    //     contextType: 'copilot',
                    // }))
                    // dispatch(cs.activateDiffFromEditor({
                    //     currentFile: filePath,
                    //     precedingCode: getPrecedingLines(view, 20)!,
                    //     procedingCode: getProcedingLines(view),
                    //     currentSelection: getSelectedText(view)!,
                    //     pos: cursorPos,
                    // }));
                    // dispatch(cs.openCommandBar());
                    return true;
                },
            },
            // REMOVED CODEBASE-WIDE FEATURES!
            // {
            //     key: connector.PLATFORM_CM_KEY+'-j',
            //     run: (view) => {
            //         // commandK('idk', true, dispatch)
            //         return true
            //     },
            // },
            {
                key: connector.PLATFORM_CM_KEY + '-h',
                run: (view) => {
                    dispatch(cs.toggleChatHistory());
                    return true;
                },
            },
        ]));
        (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
            effects: commandBarCompartment.reconfigure(commandBarExtension),
        });
    }, [commandBarOpen, filePath, editorRef.current, justCreated]);
    useEffect(() => {
        var _a;
        if (fileIndentUnit != null) {
            const fileIndent = [
                indentUnit.of(fileIndentUnit),
                EditorState.tabSize.of(fileIndentUnit.length),
            ];
            (_a = editorRef.current.view) === null || _a === void 0 ? void 0 : _a.dispatch({
                effects: indentCompartment.reconfigure(fileIndent),
            });
        }
    }, [fileIndentUnit, editorRef.current, justCreated]);
    return globalExtensions;
}
