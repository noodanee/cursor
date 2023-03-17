var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { indentUnit } from '@codemirror/language';
import { Decoration, EditorView, } from '@codemirror/view';
import { Facet, StateEffect, StateField, Transaction, Annotation, } from '@codemirror/state';
import { EditorState, Prec } from '@codemirror/state';
import { completionStatus } from '@codemirror/autocomplete';
import { vimStateField } from '../../components/codemirror-vim';
import { getLanguageFromFilename } from './utils';
import { getConnections } from '../lsp/languageServerSlice';
import { offsetToPos, posToOffset } from '../lsp/lspPlugin';
import { copilotServer, docPathFacet } from '../lsp/lspPlugin';
// Create Facet for the current docPath
export const docPath = Facet.define({
    combine(value) {
        return value[value.length - 1];
    },
});
export const relDocPath = Facet.define({
    combine(value) {
        return value[value.length - 1];
    },
});
const ghostMark = Decoration.mark({ class: 'cm-ghostText' });
// Effects to tell StateEffect what to do with GhostText
const addSuggestion = StateEffect.define();
const acceptSuggestion = StateEffect.define();
const clearSuggestion = StateEffect.define();
const typeFirst = StateEffect.define();
export const completionDecoration = StateField.define({
    create(state) {
        return { ghostText: null };
    },
    update(state, transaction) {
        for (let effect of transaction.effects) {
            if (effect.is(addSuggestion)) {
                // When adding a suggestion, we set th ghostText
                const { text, displayText, endReplacement, cursorPos, startPos, endPos, uuid, } = effect.value;
                const endGhostText = cursorPos + displayText.length;
                const decorations = Decoration.set([
                    ghostMark.range(cursorPos, endGhostText),
                ]);
                return {
                    ghostText: {
                        text,
                        displayText,
                        startPos,
                        endPos,
                        decorations,
                        displayPos: cursorPos,
                        endReplacement,
                        endGhostText,
                        weirdInsert: false,
                        uuid,
                    },
                };
            }
            else if (effect.is(acceptSuggestion)) {
                if (state.ghostText) {
                    return { ghostText: null };
                }
            }
            else if (effect.is(typeFirst)) {
                const numChars = effect.value;
                if (state.ghostText && !state.ghostText.weirdInsert) {
                    var { text, displayText, displayPos, startPos, endPos, endGhostText, decorations, endReplacement, uuid, } = state.ghostText;
                    displayPos += numChars;
                    displayText = displayText.slice(numChars);
                    if (startPos == endGhostText) {
                        return { ghostText: null };
                    }
                    else {
                        decorations = Decoration.set([
                            ghostMark.range(displayPos, endGhostText),
                        ]);
                        return {
                            ghostText: {
                                text,
                                displayText,
                                startPos,
                                endPos,
                                decorations,
                                endGhostText,
                                endReplacement,
                                uuid,
                                displayPos,
                                weirdInsert: false,
                            },
                        };
                    }
                }
            }
            else if (effect.is(clearSuggestion)) {
                return { ghostText: null };
            }
        }
        // if (transaction.docChanged && state.ghostText) {
        //     if (transaction.
        //     onsole.log({changes: transaction.changes, transaction})
        //     const newGhostText = state.ghostText.decorations.map(transaction.changes)
        //     return {ghostText: {...state.ghostText, decorations: newGhostText}};
        // }
        return state;
    },
    provide: (field) => EditorView.decorations.from(field, (value) => value.ghostText ? value.ghostText.decorations : Decoration.none),
});
const copilotEvent = Annotation.define();
/****************************************************************************
 ************************* COMMANDS ******************************************
 *****************************************************************************/
const acceptSuggestionCommand = (copilotClient, view) => {
    // We delete the ghost text and insert the suggestion.
    // We also set the cursor to the end of the suggestion.
    const ghostText = view.state.field(completionDecoration).ghostText;
    if (!ghostText) {
        return false;
    }
    const ghostTextStart = ghostText.displayPos;
    const ghostTextEnd = ghostText.endGhostText;
    const actualTextStart = ghostText.startPos;
    const actualTextEnd = ghostText.endPos;
    const replacementEnd = ghostText.endReplacement;
    const suggestion = ghostText.text;
    view.dispatch({
        changes: {
            from: ghostTextStart,
            to: ghostTextEnd,
            insert: '',
        },
        // selection: {anchor: actualTextEnd},
        effects: acceptSuggestion.of(null),
        annotations: [
            copilotEvent.of(null),
            Transaction.addToHistory.of(false),
        ],
    });
    const tmpTextEnd = replacementEnd - (ghostTextEnd - ghostTextStart);
    console.log('accepting new thing');
    view.dispatch({
        changes: {
            from: actualTextStart,
            to: tmpTextEnd,
            insert: suggestion,
        },
        selection: { anchor: actualTextEnd },
        annotations: [copilotEvent.of(null), Transaction.addToHistory.of(true)],
    });
    console.log('accepted new thing');
    // copilotClient.accept(ghostText.uuid);
    return true;
};
export const rejectSuggestionCommand = (copilotClient, view) => {
    // We delete the suggestion, then carry through with the original keypress
    const ghostText = view.state.field(completionDecoration).ghostText;
    if (!ghostText) {
        return false;
    }
    const ghostTextStart = ghostText.displayPos;
    const ghostTextEnd = ghostText.endGhostText;
    view.dispatch({
        changes: {
            from: ghostTextStart,
            to: ghostTextEnd,
            insert: '',
        },
        effects: clearSuggestion.of(null),
        annotations: [
            copilotEvent.of(null),
            Transaction.addToHistory.of(false),
        ],
    });
    return false;
};
const sameKeyCommand = (copilotClient, view, key) => {
    // When we type a key that is the same as the first letter of the suggestion, we delete the first letter of the suggestion and carry through with the original keypress
    const ghostText = view.state.field(completionDecoration).ghostText;
    if (!ghostText) {
        return false;
    }
    const ghostTextStart = ghostText.displayPos;
    const indent = view.state.facet(indentUnit);
    console.log(key);
    console.log(ghostText.displayText);
    if (key == 'Tab' && ghostText.displayText.startsWith(indent)) {
        view.dispatch({
            selection: { anchor: ghostTextStart + indent.length },
            effects: typeFirst.of(indent.length),
            annotations: [
                copilotEvent.of(null),
                Transaction.addToHistory.of(false),
            ],
        });
        return true;
    }
    else if (key == 'Tab') {
        return acceptSuggestionCommand(copilotClient, view);
    }
    else if (ghostText.weirdInsert || key != ghostText.displayText[0]) {
        return rejectSuggestionCommand(copilotClient, view);
    }
    else if (ghostText.displayText.length == 1) {
        return acceptSuggestionCommand(copilotClient, view);
    }
    else {
        // Use this to delete the first letter of the suggestion
        view.dispatch({
            selection: { anchor: ghostTextStart + 1 },
            effects: typeFirst.of(1),
            annotations: [
                copilotEvent.of(null),
                Transaction.addToHistory.of(false),
            ],
        });
        return true;
    }
};
const completionPlugin = (copilotClient) => EditorView.domEventHandlers({
    keydown(event, view) {
        if (event.key != 'Shift' &&
            event.key != 'Control' &&
            event.key != 'Alt' &&
            event.key != 'Meta') {
            return sameKeyCommand(copilotClient, view, event.key);
        }
        else {
            return false;
        }
    },
    mousedown(event, view) {
        return rejectSuggestionCommand(copilotClient, view);
    },
});
const viewCompletionPlugin = (copilotClient) => EditorView.updateListener.of((update) => {
    if (update.focusChanged) {
        rejectSuggestionCommand(copilotClient, update.view);
    }
});
// A view plugin that requests completions from the server after a delay
const completionRequester = (client) => {
    let timeout = null;
    let lastPos = 0;
    const badUpdate = (update) => {
        for (let tr of update.transactions) {
            if (tr.annotation(copilotEvent) != undefined) {
                return true;
            }
        }
        return false;
    };
    const containsGhostText = (update) => {
        return update.state.field(completionDecoration).ghostText != null;
    };
    const notInsertMode = (update) => {
        let vimState = update.state.field(vimStateField, false);
        if (!vimState) {
            return false;
        }
        else {
            return vimState.insertMode == false;
        }
    };
    const autocompleting = (update) => {
        return completionStatus(update.state) == 'active';
    };
    const notFocused = (update) => {
        return !update.view.hasFocus;
    };
    return EditorView.updateListener.of((update) => {
        if (notInsertMode(update)) {
            if (timeout) {
                clearTimeout(timeout);
            }
            return;
        }
        if (update.docChanged &&
            !update.transactions.some((tr) => tr.effects.some((e) => e.is(acceptSuggestion) || e.is(clearSuggestion)))) {
            // Cancel the previous timeout
            if (timeout) {
                clearTimeout(timeout);
            }
            if (badUpdate(update) ||
                containsGhostText(update) ||
                notInsertMode(update) ||
                autocompleting(update) ||
                notFocused(update)) {
                return;
            }
            // Get the current position and source
            const state = update.state;
            const pos = state.selection.main.head;
            const source = state.doc.toString();
            const path = state.facet(docPath);
            const relativePath = state.facet(relDocPath);
            const languageId = getLanguageFromFilename(path);
            // Set a new timeout to request completion
            timeout = setTimeout(() => __awaiter(void 0, void 0, void 0, function* () {
                // Check if the position has changed
                if (pos === lastPos) {
                    // Request completion from the server
                    try {
                        const completionResult = yield client.getCompletion({
                            doc: {
                                source,
                                tabSize: state.facet(EditorState.tabSize),
                                indentSize: 1,
                                insertSpaces: true,
                                path,
                                uri: `file://${path}`,
                                relativePath,
                                languageId,
                                position: offsetToPos(state.doc, pos),
                            },
                        });
                        if (completionResult.completions.length == 0) {
                            return;
                        }
                        let { text, displayText, range: { start, end }, position, uuid, } = completionResult.completions[0];
                        let startPos = posToOffset(state.doc, {
                            line: start.line,
                            character: start.character,
                        });
                        const endGhostPos = posToOffset(state.doc, {
                            line: position.line,
                            character: position.character,
                        }) + displayText.length;
                        // EndPos is the position that marks the complete end
                        // of what is to be replaced when we accept a completion
                        // result
                        const endPos = startPos + text.length;
                        let isInsertMode = true;
                        const vimMode = state.field(vimStateField, false);
                        if (vimMode) {
                            isInsertMode = vimMode.insertMode;
                        }
                        // Check if the position is still the same
                        if (pos === lastPos &&
                            isInsertMode == true &&
                            completionStatus(update.view.state) != 'active' &&
                            update.view.hasFocus) {
                            // Dispatch an effect to add the suggestion
                            // If the completion starts before the end of the line, check the end of the line with the end of the completion
                            let line = update.view.state.doc.lineAt(pos);
                            if (line.to != pos) {
                                console.log('line.to', line.to);
                                console.log('endPos', endPos);
                                const ending = update.view.state.doc.sliceString(pos, line.to);
                                if (displayText.endsWith(ending)) {
                                    displayText = displayText.slice(0, displayText.length - ending.length);
                                }
                                else if (displayText.includes(ending)) {
                                    // Remove the ending
                                    update.view.dispatch({
                                        changes: {
                                            from: pos,
                                            to: line.to,
                                            insert: '',
                                        },
                                        selection: { anchor: pos },
                                        effects: typeFirst.of(ending.length),
                                        annotations: [
                                            copilotEvent.of(null),
                                            Transaction.addToHistory.of(false),
                                        ],
                                    });
                                }
                            }
                            update.view.dispatch({
                                changes: {
                                    from: pos,
                                    to: pos,
                                    insert: displayText,
                                },
                                effects: [
                                    addSuggestion.of({
                                        displayText,
                                        endReplacement: endGhostPos,
                                        text,
                                        cursorPos: pos,
                                        startPos,
                                        endPos,
                                        uuid,
                                    }),
                                ],
                                annotations: [
                                    copilotEvent.of(null),
                                    Transaction.addToHistory.of(false),
                                ],
                            });
                        }
                    }
                    catch (error) {
                        // Javascript wait for 500ms for some reason is necessary here.
                        // TODO - FIGURE OUT WHY THIS RESOLVES THE BUG
                        console.log('Interrupted', error);
                        yield new Promise((resolve) => setTimeout(resolve, 300));
                    }
                }
            }), 150);
            // Update the last position
            lastPos = pos;
        }
    });
};
export const getClient = () => getConnections().copilot.client;
export const copilotBundle = ({ filePath, relativeFilePath, }) => [
    docPath.of(filePath),
    docPathFacet.of(filePath),
    relDocPath.of(relativeFilePath),
    completionDecoration,
    Prec.highest(completionPlugin(getConnections().copilot.client)),
    Prec.highest(viewCompletionPlugin(getConnections().copilot.client)),
    completionRequester(getConnections().copilot.client),
    copilotServer({ client: getConnections().copilot.client }),
];
