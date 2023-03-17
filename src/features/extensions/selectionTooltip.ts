import { showTooltip } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { commandK } from '../../features/extensions/cmdKUtils';
import { store } from '../../app/store';
import { Prec } from '@codemirror/state';
const cursorTooltipField = StateField.define({
    create: getCursorTooltips,
    update(tooltips, tr) {
        // if the viewport changed, update the tooltips
        if (!tr.docChanged && !tr.selection)
            return tooltips;
        return getCursorTooltips(tr.state);
    },
    provide: (f) => showTooltip.computeN([f], (state) => state.field(f)),
});
function getCursorTooltips(state) {
    return state.selection.ranges
        .filter((range) => !range.empty)
        .map((range) => {
        return {
            pos: range.from,
            above: true,
            strictSide: false,
            arrow: true,
            create: (view) => {
                let dom = document.createElement('div');
                dom.className = 'cm-tooltip-cursor';
                function btn(titleText, cmdText, callback) {
                    // create one edit button and one chat button
                    let editButton = document.createElement('button');
                    // two spans
                    let editSpan = document.createElement('span');
                    editSpan.className = 'title-text';
                    let cmdKspan = document.createElement('span');
                    cmdKspan.className = 'cmd-text';
                    // add the text to the spans
                    editSpan.textContent = titleText;
                    cmdKspan.textContent = cmdText;
                    // add the spans to the button
                    editButton.appendChild(editSpan);
                    editButton.appendChild(cmdKspan);
                    editButton.addEventListener('click', callback);
                    return editButton;
                }
                dom.appendChild(btn('Edit', connector.PLATFORM_META_KEY + 'K', () => {
                    commandK('edit', false, store.dispatch);
                }));
                dom.appendChild(btn('Chat', connector.PLATFORM_META_KEY + 'L', () => {
                    commandK('freeform', false, store.dispatch);
                }));
                // dom.appendChild(btn('Test', connector.PLATFORM_META_KEY+'T', () => {
                //     commandK("test", false, store.dispatch)
                // }))
                return {
                    dom,
                    getCoords: (pos) => {
                        const editor = view.dom;
                        const editorTop = editor.getBoundingClientRect().top + 50;
                        const editorBottom = editor.getBoundingClientRect().bottom - 50;
                        const rangeTop = view.coordsAtPos(range.from).top;
                        const rangeBottom = view.coordsAtPos(range.to).top;
                        const coords = view.coordsAtPos(pos);
                        const { left, top: coordsTop } = coords;
                        const inEditorTop = Math.max(editorTop, Math.min(editorBottom, coordsTop));
                        const inRangeTop = Math.max(rangeTop, Math.min(rangeBottom, inEditorTop));
                        const top = inRangeTop;
                        const right = left + dom.offsetWidth;
                        const bottom = top + dom.offsetHeight;
                        return { top, left, right, bottom };
                    },
                };
            },
        };
    });
}
const cursorTooltipBaseTheme = EditorView.baseTheme({
    '.cm-tooltip.cm-tooltip-cursor': {
        backgroundColor: '#438ad6',
        color: 'white',
        border: 'none',
        padding: '0px',
        borderRadius: '4px',
        zIndex: 49,
        '& .cm-tooltip-arrow:before': {
            borderTopColor: '#438ad6',
        },
        '& .cm-tooltip-arrow:after': {
            borderTopColor: 'transparent',
        },
        // for buttons
        '& button': {
            backgroundColor: 'transparent',
            border: 'none',
            color: 'white',
            padding: '4px 12px',
            cursor: 'pointer',
            '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
            '& .cmd-text': {
                color: 'rgba(255, 255, 255, 0.6)',
                marginLeft: '4px',
            },
        },
    },
});
export function cursorTooltip() {
    return [
        cursorTooltipField,
        cursorTooltipBaseTheme,
        Prec.highest(keymap.of([
            {
                key: connector.PLATFORM_CM_KEY + '-k',
                run: (view) => {
                    console.log('FOUND CMD-K in cursor tooltip');
                    // if selection is empty, we generate
                    if (view.state.selection.ranges[0].empty)
                        commandK('generate', false, store.dispatch);
                    // Otherwise we edit
                    else
                        commandK('edit', false, store.dispatch);
                    return true;
                },
            },
        ])),
        Prec.highest(keymap.of([
            {
                key: connector.PLATFORM_CM_KEY + '-l',
                run: (view) => {
                    // if selection is empty, we invoke freeform with no selection
                    if (view.state.selection.ranges[0].empty)
                        commandK('freeform', false, store.dispatch);
                    else
                        commandK('freeform', false, store.dispatch);
                    return true;
                },
            },
        ])),
    ];
}
