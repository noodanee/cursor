/*
This is a codemirror v6 implementation of inline diffs.

How do diffs work now?
We store diffs as a StateField that has a Codemirror Decoration.mark
This means that it is a sequence of ranges.

Then, this provides a DecorationSet of Decoration.Line's.

The reason for this complication is that we can allow codemirror's range changing
logic to work when we make edits to the diff and expand/close them. Though in hindsite
it seems like that feature is never used.
*/
import { RangeSet } from '@codemirror/state';
import { StateField, StateEffect, Transaction, Prec, } from '@codemirror/state';
import { Decoration, EditorView, GutterMarker, gutterLineClass, keymap, } from '@codemirror/view';
import { presentableDiff, Change, Chunk } from '@codemirror/merge';
import { invertedEffects } from '@codemirror/commands';
import posthog from 'posthog-js';
import { WidgetType } from '@codemirror/view';
import { store } from '../../app/store';
import * as cs from '../chat/chatSlice';
import * as csel from '../chat/chatSelectors';
/* Utility functions necessary because of lack of exports from @codemirror/merge */
function offset(change, offA, offB) {
    return new Change(change.fromA + offA, change.toA + offA, change.fromB + offB, change.toB + offB);
}
function fromLine(fromA, fromB, a, b) {
    let lineA = a.lineAt(fromA), lineB = b.lineAt(fromB);
    return lineA.to == fromA &&
        lineB.to == fromB &&
        fromA < a.length &&
        fromB < b.length
        ? [fromA + 1, fromB + 1]
        : [lineA.from, lineB.from];
}
function toLine(toA, toB, a, b) {
    let lineA = a.lineAt(toA), lineB = b.lineAt(toB);
    return lineA.from == toA && lineB.from == toB
        ? [toA, toB]
        : [lineA.to + 1, lineB.to + 1];
}
function toChunks(changes, a, b, offA, offB) {
    let chunks = [];
    for (let i = 0; i < changes.length; i++) {
        let change = changes[i];
        let [fromA, fromB] = fromLine(change.fromA + offA, change.fromB + offB, a, b);
        let [toA, toB] = toLine(change.toA + offA, change.toB + offB, a, b);
        let chunk = [offset(change, -fromA + offA, -fromB + offB)];
        while (i < changes.length - 1) {
            let next = changes[i + 1];
            let [nextA, nextB] = fromLine(next.fromA + offA, next.fromB + offB, a, b);
            if (nextA > toA + 1 && nextB > toB + 1)
                break;
            chunk.push(offset(next, -fromA + offA, -fromB + offB));
            [toA, toB] = toLine(next.toA + offA, next.toB + offB, a, b);
            i++;
        }
        chunks.push(new Chunk(chunk, fromA, Math.max(fromA, toA), fromB, Math.max(fromB, toB)));
    }
    return chunks;
}
function buildChunks(a, b, lineNumA = 1) {
    let offA = 0;
    if (lineNumA != 1) {
        offA = a.line(lineNumA).from;
    }
    return toChunks(presentableDiff(a.slice(offA).toString(), b.toString()), a, b, offA, 0);
}
const decoToJson = (diffState, state) => {
    // Convert the decoration set to an array of diff objects
    let ranges = [];
    let { mainDeco: deco } = diffState;
    const rangeIterator = deco.iter();
    while (rangeIterator.value != null) {
        if (rangeIterator.value == null)
            break;
        let startLine = state.doc.lineAt(rangeIterator.from).number;
        ranges.push({
            from: startLine,
            type: rangeIterator.value.spec.type,
            diffId: rangeIterator.value.spec.diffId,
        });
        rangeIterator.next();
    }
    return ranges;
};
const updateVisibleDecorations = (deco, doc) => {
    let lineDecos = [];
    const rangeIterator = deco.iter();
    let diffIdToTopBotLines = {};
    while (rangeIterator.value != null) {
        let startLine = doc.lineAt(rangeIterator.from).number;
        let endLine = doc.lineAt(rangeIterator.to - 1).number;
        let diffId = rangeIterator.value.spec.diffId;
        if (diffId != null) {
            if (diffIdToTopBotLines[diffId] == null) {
                diffIdToTopBotLines[diffId] = [startLine, endLine];
            }
            diffIdToTopBotLines[diffId][0] = Math.min(diffIdToTopBotLines[diffId][0], startLine);
            diffIdToTopBotLines[diffId][1] = Math.max(diffIdToTopBotLines[diffId][1], startLine);
        }
        for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
            let startLinePos = doc.line(lineNumber).from;
            lineDecos.push(Decoration.line({
                class: 'cm-diff-' + rangeIterator.value.spec.type,
            }).range(startLinePos));
        }
        rangeIterator.next();
    }
    let widgetDecos = Object.keys(diffIdToTopBotLines).map((diffId) => {
        let topLineNumber = diffIdToTopBotLines[diffId][0];
        let topLine = doc.line(topLineNumber);
        let topLinePos = topLine.from;
        const state = store.getState();
        const isLoading = !csel.getLastBotMessageFinished(state);
        const hitTokenLimit = csel.getLastBotMessageHitTokenLimit(state);
        const interrupted = csel.getLastBotMessageInterrupted(state);
        return Decoration.widget({
            widget: new (isLoading ? LoadingWidget : AcceptRejectWidget)(diffId, interrupted, hitTokenLimit),
            side: -1,
            diffId: diffId,
            block: true,
        }).range(topLinePos);
    });
    return Decoration.set([...lineDecos, ...widgetDecos], true);
};
const diffListener = EditorView.domEventHandlers({
    mousedown: (event, view) => {
        console.log(event);
        if (event.target instanceof HTMLElement) {
            let determinedEffect;
            const classList = [
                ...event.target.classList,
                ...event.target.parentElement.classList,
            ];
            console.log(classList);
            if (classList.includes('cm-diff-accept')) {
                console.log('accepting');
                determinedEffect = acceptDiff;
            }
            else if (classList.includes('cm-diff-reject')) {
                console.log('rejecting');
                determinedEffect = rejectDiff;
            }
            else if (classList.includes('cm-diff-cancel')) {
                console.log('canceling');
                store.dispatch(cs.interruptGeneration(null));
            }
            else if (classList.includes('cm-diff-continue')) {
                console.log('Hit cm-diff-continue');
                let parent = event.target.parentElement;
                let diffId = parent.getAttribute('data-diff-id');
                store.dispatch(cs.continueGeneration(diffId));
            }
            else {
                return false;
            }
            let parent = event.target.parentElement;
            let diffId = parent.getAttribute('data-diff-id');
            if (determinedEffect != null)
                determinedEffect(diffId)(view);
            return true;
        }
    },
});
// A state field that holds the diff information for each line
export const diffField = StateField.define({
    create() {
        return {
            mainDeco: Decoration.none,
            visibleDeco: Decoration.none,
        };
    },
    update(allDecos, tr) {
        // If the transaction has any addDiff effects, map them to decorations and update the decoration set
        // First modify the decoration set to stay on the same lines if the transaction is a line change
        let { mainDeco: deco, visibleDeco } = allDecos;
        let isChanged = false;
        if (tr.docChanged && deco != Decoration.none) {
            // let node = deco.iter()
            // while (node.value) {
            //     let from = node.from
            //     let to = node.to
            //     console.log('from', from, 'to', to, 'value', node.value)
            //     if (from > tr.startState.doc.length) {
            //         console.log('WAAAY TOO HIGH')
            //     } else {
            //         let lineNumber = tr.startState.doc.lineAt(from).number
            //         console.log('line number', lineNumber)
            //     }
            //     node.next()
            // }
            isChanged = true;
            deco = deco.map(tr.changes);
        }
        // let newDecos: Range<Decoration>[] = [];
        for (let effect of tr.effects) {
            if (effect.is(addDiff)) {
                let { fromLine, type, diffId } = effect.value;
                isChanged = true;
                deco = deco.update({
                    add: [diffDeco(tr.newDoc)(fromLine, type, diffId)],
                });
            }
            else if (effect.is(removeDiff)) {
                let { fromLine, type } = effect.value;
                isChanged = true;
                deco = deco.update({
                    filter: (_, __, decoration) => {
                        // return decoration.spec.type != type &&
                        //   fromLine != decoration.spec.fromLine;
                        // I think it should now be this
                        return (decoration.spec.type != type ||
                            fromLine != decoration.spec.fromLine);
                    },
                });
            }
            else if (effect.is(acceptRejectDiffEffect)) {
                let { diffId } = effect.value;
                isChanged = true;
                deco = deco.update({
                    filter: (from, __, decoration) => {
                        return diffId != decoration.spec.diffId;
                    },
                });
            }
            else if (effect.is(undoAcceptRejectDiffEffect)) {
                let { diffId, notRemovedDiffs } = effect.value;
                // We must also make the change to the store
                store.dispatch(cs.undoRejectMessage(diffId));
                console.log('About to undo ');
                console.log({ notRemovedDiffs });
                isChanged = true;
                deco = deco.update({
                    add: [
                        ...notRemovedDiffs.map((diffInfo) => diffDeco(tr.newDoc)(diffInfo.fromLine, diffInfo.type, diffId)),
                    ],
                });
            }
        }
        if (isChanged) {
            visibleDeco = updateVisibleDecorations(deco, tr.newDoc);
        }
        return { mainDeco: deco, visibleDeco };
    },
    provide: (field) => {
        const out = EditorView.decorations.from(field, (value) => {
            return value.visibleDeco;
        });
        return out;
    },
    // Serialization and deserialization parameters
    toJSON: decoToJson,
    fromJSON: (spec, instance) => {
        // Convert the array of diff objects to a decoration set
        let deco = [];
        for (let { from, type, diffId } of spec) {
            deco.push(diffDeco(instance.doc)(from, type, diffId));
        }
        let mainDeco = Decoration.set(deco);
        let visibleDeco = updateVisibleDecorations(mainDeco, instance.doc);
        return { mainDeco, visibleDeco };
    },
});
class LoadingWidget extends WidgetType {
    constructor(diffId, interrupted, hitTokenLimit) {
        super();
        this.diffId = diffId;
        this.interrupted = interrupted;
        this.hitTokenLimit = hitTokenLimit;
    }
    eq(other) {
        return this === other;
    }
    toDOM() {
        let wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'cm-diff-loading';
        wrap.setAttribute('data-diff-id', this.diffId);
        let cancelButton = document.createElement('div');
        cancelButton.classList.add('cm-diff-cancel');
        cancelButton.setAttribute('data-diff-id', this.diffId);
        let cancelText = document.createElement('div');
        cancelText.textContent = 'Cancel';
        let cancelShortcutSpan = document.createElement('span');
        cancelShortcutSpan.innerHTML =
            `<span class="${connector.IS_WINDOWS
                ? 'windows-platform-shotcut-span'
                : 'not-windows-platform-shotcut-span'}">${connector.PLATFORM_META_KEY}</span>` + '⌫';
        cancelShortcutSpan.classList.add('shortcut-span');
        cancelButton.appendChild(cancelText);
        cancelButton.appendChild(cancelShortcutSpan);
        let loadingSpinner = document.createElement('div');
        loadingSpinner.classList.add('cm-diff-loading-spinner');
        let spinnerIcon = document.createElement('i');
        spinnerIcon.classList.add('fas', 'fa-spinner', 'fa-spin');
        loadingSpinner.appendChild(spinnerIcon);
        wrap.appendChild(loadingSpinner);
        wrap.appendChild(cancelButton);
        return wrap;
    }
    ignoreEvent() {
        return false;
    }
}
class AcceptRejectWidget extends WidgetType {
    constructor(diffId, interrupted, hitTokenLimit) {
        super();
        this.diffId = diffId;
        this.interrupted = interrupted;
        this.hitTokenLimit = hitTokenLimit;
    }
    eq(other) {
        return this === other;
    }
    toDOM() {
        let wrap = document.createElement('div');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'cm-accept-reject';
        wrap.setAttribute('data-diff-id', this.diffId);
        let acceptDiv = document.createElement('div');
        acceptDiv.classList.add('cm-diff-accept', 'cm__accept_div');
        acceptDiv.setAttribute('data-diff-id', this.diffId);
        let acceptSpan = document.createElement('div');
        acceptSpan.textContent = 'Accept';
        let acceptShortcutSpan = document.createElement('span');
        acceptShortcutSpan.innerHTML =
            `<span class="${connector.IS_WINDOWS
                ? 'windows-platform-shotcut-span'
                : 'not-windows-platform-shotcut-span'}">${connector.PLATFORM_META_KEY}</span>` + '⏎';
        acceptShortcutSpan.classList.add('shortcut-span');
        acceptDiv.appendChild(acceptSpan);
        acceptDiv.appendChild(acceptShortcutSpan);
        let rejectDiv = document.createElement('div');
        rejectDiv.classList.add('cm-diff-reject', 'cm__reject_div');
        rejectDiv.setAttribute('data-diff-id', this.diffId);
        let rejectSpan = document.createElement('div');
        rejectSpan.textContent = 'Reject';
        let rejectShortcutSpan = document.createElement('span');
        rejectShortcutSpan.innerHTML =
            `<span class="${connector.IS_WINDOWS
                ? 'windows-platform-shotcut-span'
                : 'not-windows-platform-shotcut-span'}">${connector.PLATFORM_META_KEY}</span>` + '⌫';
        rejectShortcutSpan.classList.add('shortcut-span');
        rejectDiv.appendChild(rejectSpan);
        rejectDiv.appendChild(rejectShortcutSpan);
        if (this.interrupted) {
            // Add some text that indicates the diff was interrupted
            let warningDiv = document.createElement('div');
            let warningText = document.createElement('div');
            if (this.hitTokenLimit) {
                warningText.textContent = 'Diff interrupted - hit length limit';
            }
            else {
                warningText.textContent = 'Diff interrupted';
            }
            warningDiv.appendChild(warningText);
            let continueDiv = document.createElement('div');
            continueDiv.classList.add('cm-diff-continue', 'cm__continue_div');
            continueDiv.setAttribute('data-diff-id', this.diffId);
            let continueSpan = document.createElement('div');
            continueSpan.textContent = 'Continue';
            let continueShortcutSpan = document.createElement('span');
            continueShortcutSpan.innerHTML =
                `<span class="${connector.IS_WINDOWS
                    ? 'windows-platform-shotcut-span'
                    : 'not-windows-platform-shotcut-span'}">${connector.PLATFORM_META_KEY}</span>` + 'K';
            continueShortcutSpan.classList.add('shortcut-span');
            continueDiv.appendChild(continueSpan);
            continueDiv.appendChild(continueShortcutSpan);
            wrap.appendChild(continueDiv);
            wrap.appendChild(acceptDiv);
            wrap.appendChild(rejectDiv);
            warningDiv.appendChild(wrap);
            return warningDiv;
        }
        else {
            wrap.appendChild(acceptDiv);
            wrap.appendChild(rejectDiv);
            return wrap;
        }
    }
    ignoreEvent() {
        return false;
    }
}
// A state effect that can be used to set the diff information for a given range
const addDiff = StateEffect.define();
// Undo analog
const removeDiff = StateEffect.define();
const acceptRejectDiffEffect = StateEffect.define();
const undoAcceptRejectDiffEffect = StateEffect.define();
// A function that creates a decoration for a diff range
// We store the original type and the fromLine in order
// to be able to undo the effect
export const diffDeco = (doc) => (fromLine, type, diffId) => {
    return Decoration.mark({
        type,
        fromLine,
        diffId,
        class: 'cm-tag-test',
    }).range(doc.line(fromLine).from, Math.min(doc.line(fromLine).to + 1, doc.length));
};
const diffAddColor = 'rgba(0, 255, 0, 0.2) !important';
const diffBrightAddColor = '#ccffd8';
const diffDeleteColor = 'rgba(255, 0, 0, 0.2) !important';
const diffBrightDeleteColor = '#ffcccc';
const diffTheme = EditorView.theme({
    '.cm-diff-added': {
        backgroundColor: diffAddColor,
    },
    '.cm-diff-removed': {
        backgroundColor: diffDeleteColor,
    },
});
const diffAdded = new (class extends GutterMarker {
    constructor() {
        super(...arguments);
        this.elementClass = 'cm-diff-added';
    }
})();
const diffRemoved = new (class extends GutterMarker {
    constructor() {
        super(...arguments);
        this.elementClass = 'cm-diff-removed';
    }
})();
const gutterDiffHighlighter = gutterLineClass.compute([diffField], (state) => {
    let marks = [], last = -1;
    let diff = state.field(diffField);
    let diffIter = diff.visibleDeco.iter();
    while (diffIter.value) {
        if (diffIter.value.spec.widget != null) {
            diffIter.next();
            continue;
        }
        if (diffIter.value.spec.class == 'cm-diff-added') {
            marks.push(diffAdded.range(diffIter.from));
        }
        else if (diffIter.value.spec.class == 'cm-diff-removed') {
            marks.push(diffRemoved.range(diffIter.from));
        }
        else {
            throw new Error(`Invalid diff type: ${diffIter.value.spec.type}`);
        }
        diffIter.next();
    }
    return RangeSet.of(marks);
});
/*
    * A plugin that adds a diff view to the editor
    Make the line 1-indexed
*/
export const setDiff = ({ origLine, origEndLine, origText, newText, diffId = null, }, finalDiff = false, interrupted = false, hitTokenLimit = false, maxOrigLineIndex = 0) => (view) => {
    // console.log({
    //     origLine,
    //     origEndLine,
    //     origText,
    //     newText,
    //     finalDiff
    // })
    if (newText.sliceString(0, 1) == '\n') {
        newText = newText.slice(1, newText.length);
    }
    if (finalDiff &&
        newText.sliceString(newText.length - 1, newText.length) == '\n') {
        newText = newText.slice(0, newText.length - 1);
    }
    // ALL LINES ARE 1 INDEXED
    // Get only the relevant chunk
    origText = origText.slice(0, origText.line(origEndLine).to);
    // console.log('----------SETTING----------')
    let chunks = buildChunks(origText, newText, origLine);
    // If interrupted, ignore the last chunk
    if (interrupted) {
        if (maxOrigLineIndex && maxOrigLineIndex > 0) {
            const lastChunk = chunks[chunks.length - 1];
            if (origText.lineAt(lastChunk.fromA).number - 1 >
                maxOrigLineIndex) {
                chunks = chunks.slice(0, chunks.length - 1);
            }
        }
        else {
            chunks = chunks.slice(0, chunks.length - 1);
        }
    }
    let transactions = [];
    let addedLines = 0;
    for (let [index, chunk] of chunks.entries()) {
        // 1-indexed
        let startLine = origText.lineAt(chunk.fromA).number + addedLines;
        if (chunk.fromA === chunk.toA) {
            // Insert mode. Add the diff to the line above the insertion point
            // Then add the state effect to mark it as an insertion
            let relevantText = newText.slice(chunk.fromB, chunk.toB - 1);
            let relevantLines = [...Array(relevantText.lines).keys()].map((i) => i + startLine);
            transactions.push({
                changes: {
                    from: chunk.fromA,
                    to: chunk.fromA,
                    insert: relevantText + '\n',
                },
                // Add all the decorations for each new line added
                effects: [
                    ...relevantLines.map((i) => addDiff.of({ fromLine: i, type: 'added', diffId })),
                ],
                annotations: [
                    Transaction.addToHistory.of(finalDiff || interrupted),
                ],
            });
            addedLines += relevantLines.length;
        }
        else if (chunk.fromB === chunk.toB) {
            if (index == chunks.length - 1 && !finalDiff) {
                // If this is the last chunk and it's not the final diff, don't remove the lines
                // This is because the final diff will remove all the lines
                continue;
            }
            // Delete mode. Add the state effect to mark the line as a deletion
            let relevantText = origText.slice(chunk.fromA, chunk.toA - 1);
            let relevantLines = [...Array(relevantText.lines).keys()].map((i) => i + startLine);
            transactions.push({
                effects: [
                    ...relevantLines.map((i) => addDiff.of({ fromLine: i, type: 'removed', diffId })),
                ],
                annotations: [
                    Transaction.addToHistory.of(finalDiff || interrupted),
                ],
            });
        }
        else {
            let relevantTextA = origText.slice(chunk.fromA, chunk.toA - 1);
            let relevantLinesA = [...Array(relevantTextA.lines).keys()].map((i) => i + startLine);
            let relevantTextB = newText.slice(chunk.fromB, chunk.toB - 1); //.toString()
            let relevantLinesB = [...Array(relevantTextB.lines).keys()].map((i) => i + startLine + relevantLinesA.length);
            let insertPoint = chunk.toA;
            if (insertPoint == origText.length + 1) {
                relevantTextB = '\n' + relevantTextB.toString();
                insertPoint -= 1;
            }
            // Unclear when we do need to do this
            // I think the diffing algorithm is pretty bad and buggy tbh
            // So the solution is to add a newline when not the last chunk
            // or when it's the last chunk, and clearly needed or the
            // next line will merge, then we include it. I think this works
            let nextChar = origText.sliceString(insertPoint, insertPoint + 1);
            if (index != chunks.length - 1 ||
                !(nextChar == '\n' || nextChar == '')) {
                relevantTextB = relevantTextB + '\n';
            }
            transactions.push({
                changes: {
                    from: insertPoint,
                    to: insertPoint,
                    insert: relevantTextB,
                },
                effects: [
                    ...relevantLinesA.map((i) => addDiff.of({ fromLine: i, type: 'removed', diffId })),
                    ...relevantLinesB.map((i) => addDiff.of({ fromLine: i, type: 'added', diffId })),
                ],
                annotations: [
                    Transaction.addToHistory.of(finalDiff || interrupted),
                ],
            });
            addedLines += relevantLinesB.length;
        }
    }
    // Dispatching transactions
    view.dispatch(...transactions);
};
const acceptRejectDiff = ({ typeRemoved }) => (diffId, addToHistory = true) => (view) => {
    if (typeRemoved == 'removed') {
        posthog.capture('Accepted Diff');
    }
    let rangeIter = view.state.field(diffField).mainDeco.iter();
    let changes = [];
    let notRemovedDiffs = [];
    while (rangeIter.value != null) {
        if (rangeIter.value.spec.diffId === diffId) {
            let startLine = view.state.doc.lineAt(rangeIter.from).number;
            let endLine = view.state.doc.lineAt(rangeIter.to - 1).number;
            for (let lineNumber = startLine; lineNumber <= endLine; lineNumber++) {
                let line = view.state.doc.line(lineNumber);
                if (rangeIter.value.spec.type === typeRemoved) {
                    changes.push({
                        from: line.from,
                        to: Math.min(line.to + 1, view.state.doc.length),
                        insert: '',
                    });
                }
                else {
                    notRemovedDiffs.push({
                        fromLine: lineNumber,
                        type: rangeIter.value.spec.type,
                        diffId,
                    });
                }
            }
        }
        rangeIter.next();
    }
    if (changes.length > 0 || notRemovedDiffs.length > 0) {
        const transactions = {
            changes,
            effects: acceptRejectDiffEffect.of({
                diffId,
                notRemovedDiffs,
                typeRemoved,
            }),
            annotations: Transaction.addToHistory.of(addToHistory),
        };
        view.dispatch(transactions);
    }
};
export const acceptDiff = acceptRejectDiff({ typeRemoved: 'removed' });
export const rejectDiff = acceptRejectDiff({ typeRemoved: 'added' });
/*
 * This saves the diff effects to the undo/redo stack
 * It also saves the diff effects when a piece of code
 * is deleted that also deletes a part of a diff
 */
const invertDiff = invertedEffects.of((tr) => {
    // Goal here is to undo the decorations effects of diffs I am adding comments because this is very dense
    let found = [];
    if (tr.annotation(Transaction.addToHistory)) {
        for (let e of tr.effects) {
            // If we have just added a diff decoration, undoing it is removing it
            if (e.is(addDiff))
                found.push(removeDiff.of(e.value));
            // If we have just removed a diff decoration, undoing it is adding it
            else if (e.is(removeDiff))
                found.push(addDiff.of(e.value));
            // We have a custom effect for accepting or rejecting diffs
            // What we do is store the lines of the diff where the decorations
            // are removed, but the text still exists.
            // So if we accept a diff, then we store all green lines. If we reject
            // a diff, we store all red lines
            else if (e.is(acceptRejectDiffEffect))
                found.push(undoAcceptRejectDiffEffect.of(e.value));
            else if (e.is(undoAcceptRejectDiffEffect))
                found.push(acceptRejectDiffEffect.of(e.value));
        }
        let ranges = tr.startState.field(diffField).mainDeco;
        // Next, we go through all ranges were decorated initially, and may have been deleted
        tr.changes.iterChangedRanges((chFrom, chTo) => {
            // chFrom, chTo is the from and to of the change in the original document
            // This looks at all decoration ranges within that change
            ranges.between(chFrom, chTo, (rFrom, rTo, rvalue) => {
                if (rFrom >= chFrom || rTo <= chTo) {
                    // If the decoration range is contained in the change (meaning it was deleted probs)
                    let from = Math.max(chFrom, rFrom), to = Math.min(chTo, rTo);
                    if (from < to) {
                        // Then in here we set addDiff as a part of the effect
                        // TODO - may have to deal with the weird edge case where we edit
                        // a diff before accepting and the range spans multiple lines
                        let fromLine = tr.startState.doc.lineAt(from).number;
                        found.push(addDiff.of({
                            fromLine,
                            type: rvalue.spec.type,
                            diffId: rvalue.spec.diffId,
                        }));
                    }
                }
            });
        });
    }
    return found;
});
// An extension that enables the diff feature
export const diffExtension = [
    diffField,
    gutterDiffHighlighter,
    diffTheme,
    invertDiff,
    Prec.highest(diffListener),
    Prec.highest(keymap.of([])),
    Prec.highest(keymap.of([
        {
            // Enter
            key: connector.PLATFORM_CM_KEY + '-Enter',
            run: (view) => {
                const state = view.state;
                // is active diff
                if (state.field(diffField).mainDeco.size > 0) {
                    //accept diff
                    acceptDiff(state.field(diffField).mainDeco.iter().value.spec
                        .diffId)(view);
                    return true;
                }
                return false;
            },
        },
        {
            // backspace
            key: connector.PLATFORM_CM_KEY + '-Backspace',
            run: (view) => {
                const state = view.state;
                if (state.field(diffField).mainDeco.size > 0) {
                    const diffId = state.field(diffField).mainDeco.iter()
                        .value.spec.diffId;
                    // is active diff
                    const lastMessage = csel.getLastBotMessageById(diffId)(store.getState());
                    if (lastMessage) {
                        const isFinished = lastMessage.finished;
                        const isChatOpen = csel.isChatOpen(store.getState());
                        if (isFinished) {
                            // In the case where done loading, we reject the message
                            store.dispatch(cs.interruptGeneration(diffId));
                            store.dispatch(cs.rejectMessage(diffId));
                            store.dispatch(cs.setChatOpen(false));
                            // Aman: I think this was the source of a big bug. Need to stop keypress from going through!
                            return true;
                        }
                        else if (!isFinished || isChatOpen) {
                            console.log('Running cmd+backspace');
                            store.dispatch(cs.interruptGeneration(diffId));
                            store.dispatch(cs.setChatOpen(false));
                            return true;
                        }
                    }
                }
                else {
                    // Otherwise interrupt the current message
                    const lastMessage = csel.getLastBotMessage(store.getState());
                    if (lastMessage) {
                        const isFinished = lastMessage.finished;
                        if (!isFinished) {
                            store.dispatch(cs.interruptGeneration(null));
                            return true;
                        }
                    }
                }
                return false;
            },
        },
        {
            // k
            key: connector.PLATFORM_CM_KEY + '-k',
            run: (view) => {
                const state = view.state;
                // is active diff
                if (state.field(diffField).mainDeco.size > 0) {
                    const reduxState = store.getState();
                    const diffId = state.field(diffField).mainDeco.iter()
                        .value.spec.diffId;
                    //accept diff
                    const lastBotMessage = csel.getLastBotMessageById(diffId)(reduxState);
                    if (lastBotMessage) {
                        const isInterrupted = lastBotMessage.interrupted;
                        const isFinished = lastBotMessage.finished;
                        if (isInterrupted && isFinished) {
                            store.dispatch(cs.continueGeneration(diffId));
                            return true;
                        }
                    }
                }
                return false;
            },
        },
    ])),
];
