import { StateEffect, StateField } from '@codemirror/state';
import { getViewTabId, } from '../extensions/utils';
import { store } from '../../app/store';
import { fixErrors } from '../fixLSP/fixLSPSlice';
import { setDiff } from '../extensions/diff';
import { keymap } from '@codemirror/view';
import { getDiagnostics, lintState, } from './lint';
import { Text } from '@codemirror/state';
import { Prec } from '@codemirror/state';
// Define the resetLineNumbers effect
export const resetLineNumbersEffect = StateEffect.define();
export const lineNumbersState = StateField.define({
    create() {
        return [];
    },
    update(value, tr) {
        // Update the positions of the start of lines when the document changes
        if (tr.docChanged) {
            let newLineStartPositions = [];
            for (let lineStartPosition of value) {
                let newPos = tr.changes.mapPos(lineStartPosition, 1);
                newLineStartPositions.push(newPos);
            }
            value = newLineStartPositions;
        }
        // Mark all the positions of the start of lines in the file when the resetLineNumbers effect is submitted
        for (let effect of tr.effects) {
            if (effect.is(resetLineNumbersEffect)) {
                let lineStartPositions = [];
                for (let i = 0; i < tr.state.doc.lines; i++) {
                    lineStartPositions.push(tr.state.doc.line(i + 1).from);
                }
                value = lineStartPositions;
            }
        }
        return value;
    },
});
export function applyLineChangesToView(view, lineChanges) {
    // TODO - change this in accordance with how diffID corresponds to a conversation id now!
    console.log('a');
    // Get the line numbers state
    let lineNumbers = view.state.field(lineNumbersState);
    console.log('a', lineChanges);
    let ind = 2;
    for (let lineChange of lineChanges) {
        console.log('b');
        let fromLine = lineChange.startLine;
        let toLine = lineChange.endLine;
        console.log('b', fromLine);
        // get new line positions
        let fromPos = lineNumbers[fromLine - 1];
        let toPos = lineNumbers[toLine - 1];
        console.log('b', lineNumbers);
        console.log('b', view.state.doc);
        console.log('b', fromPos);
        let origLine = view.state.doc.lineAt(fromPos).number;
        let origEndLine = view.state.doc.lineAt(toPos).number;
        console.log('b');
        const diffPayload = {
            origText: view.state.doc,
            diffId: `${ind}`,
            origLine,
            origEndLine,
            newText: Text.of(lineChange.newText.split('\n')),
        };
        console.log('b');
        console.log('abb diff', diffPayload);
        setDiff(diffPayload, true)(view);
        console.log('abb made it 4');
        ind += 1;
    }
    console.log('a');
}
export function getFixLSPBlobForServerWithSideEffects(view) {
    let diagnostics = getDiagnostics(view.state.field(lintState), view.state);
    const seriousDiagnostics = diagnostics.filter((d) => d.severity == 'error');
    if (seriousDiagnostics.length == 0)
        return null;
    view.dispatch({
        effects: [resetLineNumbersEffect.of()],
    });
    const results = [];
    for (let diagnostic of seriousDiagnostics) {
        let line = view.state.doc.lineAt(diagnostic.from).number;
        let message = diagnostic.message;
        results.push({ line, message });
    }
    const contents = view.state.doc.toString();
    return {
        contents,
        diagnostics: results,
    };
}
// function dispatchDiagnostics(
//     view: EditorView,
//     diagnostics: readonly Diagnostic[]
// ) {
//     console.log('abb dispatch diagnostics')
//     const fileId = getCurrentFileId()
//     debounce(() => {
//         console.log('abb debounce')
//         if (diagnostics.length == 0) return
//         view.dispatch({
//             effects: [resetLineNumbersEffect.of()],
//         })
//         const results = []
//         for (let diagnostic of diagnostics) {
//             let line = view.state.doc.lineAt(diagnostic.from).number
//             let message = diagnostic.message
//             results.push({ line, message })
//         }
//         const contents = view.state.doc.toString()
//         store.dispatch(
//             submitDiagnostics({
//                 fileId: fileId,
//                 blob: {
//                     contents,
//                     diagnostics: results,
//                 },
//             })
//         )
//     }, 1000)()
// }
// export const lintViewPlugin = ViewPlugin.fromClass(
//     class {
//         constructor(readonly view: EditorView) {}
//         update(update: ViewUpdate) {
//             // Check if the update has setDiagnosticsEffect
//             if (
//                 update.transactions.some((tr) =>
//                     tr.effects.some((e) => e.is(setDiagnosticsEffect))
//                 )
//             ) {
//                 // Get the diagnostics from the update
//                 let diagnostics = getDiagnostics(
//                     update.state.field(lintState),
//                     update.state
//                 )
//                 console.log('abb update', diagnostics)
//                 const seriousDiagnostics = diagnostics.filter(
//                     (d) => d.severity == 'error'
//                 )
//                 console.log('abb update', seriousDiagnostics)
//                 const fileId = getViewFileId(this.view)
//                 // dispatchDiagnostics(this.view, seriousDiagnostics)
//                 store.dispatch(
//                     markDoDiagnosticsExit({
//                         fileId: fileId,
//                         doDiagnosticsExist: seriousDiagnostics.length > 0,
//                     })
//                 )
//                 console.log('abb update', seriousDiagnostics.length)
//             }
//         }
//     }
// )
export const fixLintExtension = [
    lineNumbersState,
    // lintViewPlugin,
    Prec.highest(keymap.of([
        {
            key: connector.PLATFORM_CM_KEY + '-Shift-Enter',
            run: (view) => {
                console.log('FIZING');
                store.dispatch(fixErrors({ tabId: getViewTabId(view) }));
                return true;
            },
        },
    ])),
];
