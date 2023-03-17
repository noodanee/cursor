import { syntaxTree } from '@codemirror/language';
import { Prec, RangeSetBuilder, StateEffect, } from '@codemirror/state';
import { Decoration, ViewPlugin, WidgetType, } from '@codemirror/view';
import { store } from '../../app/store';
import { addCommentToDoc } from '../comment/commentSlice';
import { getFilePath, getFocusedTab, } from '../selectors';
import { getNamesAndBodies } from './utils';
// Insanely messy but we use the comments piece to find the functions
// That we can then pass up to tests
class UpdateTestDirWidget extends WidgetType {
    constructor() {
        super();
    }
    eq(other) {
        return this === other;
    }
    toDOM() {
        const wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'cm-ai-comment-container';
        const button = document.createElement('button');
        button.textContent = 'Enter Test Directory';
        const tooltip = document.createElement('div');
        tooltip.classList.add('cm-ai-comment-tooltip');
        tooltip.appendChild(button);
        wrap.appendChild(tooltip);
        return wrap;
    }
}
class CommentWidget extends WidgetType {
    constructor(line, functionName, lineIndentation, changed) {
        super();
        this.line = line;
        this.functionName = functionName;
        this.lineIndentation = lineIndentation;
        this.changed = changed;
    }
    eq(other) {
        return this === other;
    }
    toDOM() {
        let wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'cm-ai-comment-container';
        const lines = this.line.split('\n');
        for (let line in lines) {
            let outerDiv = document.createElement('div');
            let acceptDiv = document.createElement('div');
            acceptDiv.classList.add('cm-ai-comment');
            if (this.changed)
                acceptDiv.classList.add('cm-ai-comment-changed');
            acceptDiv.textContent = this.lineIndentation + lines[line];
            outerDiv.appendChild(acceptDiv);
            wrap.appendChild(outerDiv);
        }
        const tooltip = document.createElement('div');
        tooltip.classList.add('cm-ai-comment-tooltip');
        const addComment = document.createElement('div');
        addComment.classList.add('cm-ai-comment-add');
        addComment.textContent = 'Add to file';
        addComment.setAttribute('data-comment', this.line);
        addComment.setAttribute('data-function-name', this.functionName);
        tooltip.appendChild(addComment);
        wrap.appendChild(tooltip);
        return wrap;
    }
    ignoreEvent() {
        return false;
    }
}
import { selectHasTests } from '../tests/testSelectors';
// codemirror state effect for updating comments
export const updateCommentsEffect = StateEffect.define();
class TreeHighlighter {
    constructor(view) {
        this.tree = syntaxTree(view.state);
        this.first = true;
        this.decorations = this.buildDeco(view);
    }
    update(update) {
        const isUpdateComment = update.transactions.some((tr) => tr.effects.some((e) => e.is(updateCommentsEffect)));
        if (update.viewportChanged || isUpdateComment || this.first) {
            let tree = syntaxTree(update.state);
            if (tree != this.tree || isUpdateComment) {
                this.tree = tree;
                this.decorations = this.buildDeco(update.view);
                this.first = false;
            }
        }
    }
    buildDeco(view) {
        if (!this.tree.length)
            return Decoration.none;
        let comments = {};
        const state = store.getState();
        const tab = getFocusedTab(state);
        if (tab != null) {
            const filePath = getFilePath(tab.fileId)(state);
            const hasTests = selectHasTests(filePath)(state);
            if (!hasTests) {
            }
            else {
            }
            comments = state.commentState.fileThenNames[filePath] || {};
        }
        let builder = new RangeSetBuilder();
        const results = getNamesAndBodies(this.tree.cursor(), view.state.doc.toString());
        for (let result of results) {
            const { name, body, from } = result;
            const line = view.state.doc.lineAt(from);
            const startOfLine = line.from;
            const lineIndentation = line.text.match(/^\s*/)[0];
            const comment = comments[name];
            function trimFn(ins) {
                if (ins == null)
                    return null;
                let trimmed = ins.trim().split('\n').splice(1).join('\n').trim();
                //remove ending semi-colon
                if (trimmed.endsWith(';'))
                    trimmed = trimmed.slice(0, -1);
                // remove comma
                if (trimmed.endsWith(','))
                    trimmed = trimmed.slice(0, -1);
                return trimmed;
            }
            const changed = comment && trimFn(comment.originalFunctionBody) !== trimFn(body);
            if (comment != null &&
                comment.comment != null &&
                comment.marked != true) {
                const widget = Decoration.widget({
                    widget: new CommentWidget(comment.comment, name, lineIndentation, changed),
                    side: -1,
                });
                builder.add(startOfLine, startOfLine, widget);
            }
        }
        return builder.finish();
    }
}
export const aiComments = function () {
    return [
        Prec.high(ViewPlugin.fromClass(TreeHighlighter, {
            decorations: (v) => v.decorations,
            eventHandlers: {
                mousedown: function (event, view) {
                    if (event.target instanceof HTMLElement) {
                        let determinedEffect;
                        const classList = [
                            ...event.target.classList,
                            ...event.target.parentElement.classList,
                        ];
                        if (!classList.includes('cm-ai-comment-add')) {
                            return false;
                        }
                        const dataAttr = event.target.getAttribute('data-comment');
                        const functionNameAttr = event.target.getAttribute('data-function-name');
                        // find the location of the decoration with this function name attr
                        let pos;
                        //@ts-ignore
                        const plugin = this;
                        // iterate through decorations to find the position of the decoration with the matching function name
                        const decoIter = plugin.decorations.iter();
                        while (true) {
                            if (decoIter.value == null)
                                break;
                            if (decoIter.value.spec.widget instanceof
                                CommentWidget &&
                                decoIter.value.spec.widget.functionName ===
                                    functionNameAttr) {
                                pos = decoIter.from;
                                break;
                            }
                            decoIter.next();
                        }
                        // insert comment
                        if (dataAttr != null) {
                            view.dispatch({
                                changes: {
                                    from: pos,
                                    to: pos,
                                    insert: dataAttr + '\n',
                                },
                            });
                            const state = store.getState();
                            const tab = getFocusedTab(state);
                            if (tab != null) {
                                const filePath = getFilePath(tab.fileId)(state);
                                store.dispatch(addCommentToDoc({
                                    filePath,
                                    functionName: functionNameAttr,
                                }));
                            }
                        }
                        return true;
                    }
                },
            },
        })),
    ];
};
