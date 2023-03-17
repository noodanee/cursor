import { initVim } from './vim';
import { CodeMirror } from './cm_adapter';
import { BlockCursorPlugin, hideNativeSelection } from './block-cursor';
import { StateField, StateEffect, RangeSetBuilder, } from '@codemirror/state';
import { ViewPlugin, Decoration, EditorView, showPanel, } from '@codemirror/view';
import { setSearchQuery } from '@codemirror/search';
const Vim = initVim(CodeMirror);
const HighlightMargin = 250;
const vimStyle = EditorView.baseTheme({
    '.cm-vimMode .cm-cursorLayer:not(.cm-vimCursorLayer)': {
        display: 'none',
    },
    '.cm-vim-panel': {
        padding: '0px 10px',
        fontFamily: 'monospace',
        minHeight: '1.3em',
    },
    '.cm-vim-panel input': {
        border: 'none',
        outline: 'none',
        backgroundColor: 'inherit',
    },
    '&light .cm-searchMatch': { backgroundColor: '#ffff0054' },
    '&dark .cm-searchMatch': { backgroundColor: '#00ffff8a' },
});
export const updateVimState = StateEffect.define();
export const vimStateField = StateField.define({
    create() {
        return { insertMode: false };
    },
    update(value, tr) {
        // console.log('updating vim state here');
        let newValue = Object.assign({}, value);
        // console.log('updating vim state');
        // NOTE not sure what this is being used for
        // but it could be out of sync sometimes with vim insert mode
        // as a result of the hacky fix to make escape work
        // console.log('running updateVimState with value', value, 'and tr', tr)
        for (let effect of tr.effects) {
            if (effect.is(updateVimState)) {
                newValue.insertMode = effect.value.insertMode;
            }
        }
        return newValue;
    },
    toJSON: (value) => {
        return value;
    },
    fromJSON: (value) => {
        return value;
    },
});
function generateVimPlugin(callbacks) {
    return ViewPlugin.fromClass(class {
        constructor(view) {
            this.status = '';
            this.query = null;
            this.decorations = Decoration.none;
            this.lastKeydown = '';
            this.view = view;
            const cm = (this.cm = new CodeMirror(view));
            if (callbacks.save != null)
                Vim.defineEx('write', 'w', callbacks.save);
            if (callbacks.saveAndExit != null) {
                Vim.defineEx('wq', 'wq', callbacks.saveAndExit);
                Vim.defineEx('x', 'x', callbacks.saveAndExit);
            }
            if (callbacks.toPane != null) {
                // Moving pane commands
                Vim.defineEx('toRightPane', 'toRightPane', callbacks.toPane('right'));
                Vim.defineEx('toLeftPane', 'toLeftPane', callbacks.toPane('left'));
                Vim.defineEx('toTopPane', 'toTopPane', callbacks.toPane('up'));
                Vim.defineEx('toBottomPane', 'toBottomPane', callbacks.toPane('down'));
                // Key to ex command mapping
                Vim.map('<C-w>l', ':toRightPane', 'normal');
                Vim.map('<C-w>h', ':toLeftPane', 'normal');
                Vim.map('<C-w>k', ':toTopPane', 'normal');
                Vim.map('<C-w>j', ':toBottomPane', 'normal');
            }
            if (callbacks.exit != null)
                Vim.defineEx('q', 'q', callbacks.exit);
            Vim.enterVimMode(this.cm);
            this.view.cm = this.cm;
            this.cm.state.vimPlugin = this;
            this.blockCursor = new BlockCursorPlugin(view, cm);
            this.updateClass();
            this.cm.on('vim-command-done', () => {
                if (cm.state.vim)
                    cm.state.vim.status = '';
                this.blockCursor.scheduleRedraw();
                this.updateStatus();
            });
            this.cm.on('vim-mode-change', (e) => {
                cm.state.vim.mode = e.mode;
                if (e.subMode) {
                    cm.state.vim.mode += ' block';
                }
                cm.state.vim.status = '';
                this.blockCursor.scheduleRedraw();
                this.updateClass();
                this.updateStatus();
            });
            this.cm.on('dialog', () => {
                if (this.cm.state.statusbar) {
                    this.updateStatus();
                }
                else {
                    view.dispatch({
                        effects: showVimPanel.of(!!this.cm.state.dialog),
                    });
                }
            });
            this.dom = document.createElement('span');
            this.dom.style.cssText =
                'position: absolute; right: 10px; top: 1px';
            const currentState = view.state.field(vimStateField);
            if (currentState != null) {
                for (const key in currentState) {
                    this.cm.state.vim[key] =
                        currentState[key];
                }
            }
            this.updateClass();
            this.updateStatus();
        }
        update(update) {
            var _a;
            if ((update.viewportChanged || update.docChanged) &&
                this.query) {
                this.highlight(this.query);
            }
            if (update.docChanged) {
                this.cm.onChange(update);
            }
            if (update.selectionSet) {
                this.cm.onSelectionChange();
            }
            if (update.viewportChanged) {
                // scroll
            }
            if (this.cm.curOp && !this.cm.curOp.isVimOp) {
                this.cm.onBeforeEndOperation();
            }
            if (update.transactions) {
                for (let tr of update.transactions) {
                    for (let effect of tr.effects) {
                        if (effect.is(setSearchQuery)) {
                            let forVim = (_a = effect.value) === null || _a === void 0 ? void 0 : _a.forVim;
                            if (!forVim) {
                                this.highlight(null);
                            }
                            else {
                                let query = effect.value.create();
                                this.highlight(query);
                            }
                        }
                    }
                }
            }
            this.blockCursor.update(update);
            if (callbacks.update != null)
                callbacks.update(this.cm.state.vim);
        }
        updateClass() {
            const state = this.cm.state;
            if (!state.vim || (state.vim.insertMode && !state.overwrite))
                this.view.scrollDOM.classList.remove('cm-vimMode');
            else
                this.view.scrollDOM.classList.add('cm-vimMode');
        }
        updateStatus() {
            let dom = this.cm.state.statusbar;
            let vim = this.cm.state.vim;
            if (!dom || !vim)
                return;
            let dialog = this.cm.state.dialog;
            if (dialog) {
                if (dialog.parentElement != dom) {
                    dom.textContent = '';
                    dom.appendChild(dialog);
                }
            }
            else {
                dom.textContent = `--${(vim.mode || 'normal').toUpperCase()}--`;
            }
            this.dom.textContent = vim.status;
            dom.appendChild(this.dom);
            // New code to update global codemirror view of vim state
            // console.log('updating status', vim.insertMode);
        }
        destroy() {
            Vim.leaveVimMode(this.cm);
            this.updateClass();
            this.blockCursor.destroy();
            delete this.view.cm;
        }
        highlight(query) {
            this.query = query;
            if (!query)
                return (this.decorations = Decoration.none);
            let { view } = this;
            let builder = new RangeSetBuilder();
            for (let i = 0, ranges = view.visibleRanges, l = ranges.length; i < l; i++) {
                let { from, to } = ranges[i];
                while (i < l - 1 &&
                    to > ranges[i + 1].from - 2 * HighlightMargin)
                    to = ranges[++i].to;
                query.highlight(view.state, from, to, (from, to) => {
                    builder.add(from, to, matchMark);
                });
            }
            return (this.decorations = builder.finish());
        }
        handleKey(e, view) {
            const key = CodeMirror.vimKey(e);
            const cm = this.cm;
            if (!key)
                return;
            let vim = cm.state.vim;
            if (!vim)
                return;
            // clear search highlight
            if (key == '<Esc>' &&
                !vim.insertMode &&
                !vim.visualMode &&
                this.query /* && !cm.inMultiSelectMode*/) {
                const searchState = vim.searchState_;
                if (searchState) {
                    cm.removeOverlay(searchState.getOverlay());
                    searchState.setOverlay(null);
                }
            }
            vim.status = (vim.status || '') + key;
            let result = Vim.multiSelectHandleKey(cm, key, 'user');
            vim = cm.state.vim; // the object can change if there is an exception in handleKey
            // insert mode
            if (!result && vim.insertMode && cm.state.overwrite) {
                if (e.key && e.key.length == 1 && !/\n/.test(e.key)) {
                    result = true;
                    cm.overWriteSelection(e.key);
                }
                else if (e.key == 'Backspace') {
                    result = true;
                    CodeMirror.commands.cursorCharLeft(cm);
                }
            }
            if (result) {
                CodeMirror.signal(this.cm, 'vim-keypress', key);
                e.preventDefault();
                e.stopPropagation();
                this.blockCursor.scheduleRedraw();
            }
            this.updateStatus();
            // ON UPDATE - WE UPDATE THE CM6 VIM STATE
            view.dispatch({
                effects: updateVimState.of(cm.state.vim),
            });
            return !!result;
        }
    }, {
        eventHandlers: {
            keypress: function (e, view) {
                if (this.lastKeydown == 'Dead' ||
                    (e.altKey && !e.ctrlKey && !e.metaKey))
                    this.handleKey(e, view);
            },
            keydown: function (e, view) {
                this.lastKeydown = e.key;
                this.handleKey(e, view);
            },
        },
        decorations: (v) => v.decorations,
    });
}
const matchMark = Decoration.mark({ class: 'cm-searchMatch' });
const showVimPanel = StateEffect.define();
const vimPanelState = StateField.define({
    create: () => false,
    update(value, tr) {
        for (let e of tr.effects)
            if (e.is(showVimPanel))
                value = e.value;
        return value;
    },
    provide: (f) => {
        return showPanel.from(f, (on) => (on ? createVimPanel : null));
    },
});
function createVimPanel(view) {
    let dom = document.createElement('div');
    dom.className = 'cm-vim-panel';
    let cm = view.cm;
    if (cm.state.dialog) {
        dom.appendChild(cm.state.dialog);
    }
    return { top: false, dom };
}
function statusPanel(view) {
    let dom = document.createElement('div');
    dom.className = 'cm-vim-panel';
    let cm = view.cm;
    cm.state.statusbar = dom;
    cm.state.vimPlugin.updateStatus();
    return { dom };
}
export function vim(options = {}) {
    return [
        vimStyle,
        generateVimPlugin(options.callbacks || {}),
        vimStateField,
        hideNativeSelection,
        options.status ? showPanel.of(statusPanel) : vimPanelState,
    ];
}
export { CodeMirror, Vim };
export function getCM(view) {
    return view.cm || null;
}
