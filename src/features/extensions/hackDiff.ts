/*
This is a codemirror v6 implementation of inline diffs.

There are state fields that store the information for the diffs present in a
block of code.
*/
import { StateField, StateEffect, } from '@codemirror/state';
export const editBoundaryEffect = StateEffect.define({
    map: (val, mapping) => ({
        start: mapping.mapPos(val.start),
        end: mapping.mapPos(val.end),
    }),
});
export const editBoundaryState = StateField.define({
    create: () => null,
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(editBoundaryEffect)) {
                console.log('Updating editBoundaryState to', effect.value);
                value = effect.value;
            }
        }
        return value;
    },
});
export const insertCursorEffect = StateEffect.define({
    map: (val, mapping) => ({ pos: mapping.mapPos(val.pos) }),
});
export const insertCursorState = StateField.define({
    create: () => null,
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(insertCursorEffect)) {
                value = effect.value;
            }
        }
        return value;
    },
});
export const hackLockEffect = StateEffect.define({
    map: (val, mapping) => ({ on: val.on }),
});
export const hackLockState = StateField.define({
    create: () => ({ on: false }),
    update(value, tr) {
        for (let effect of tr.effects) {
            if (effect.is(hackLockEffect)) {
                value = effect.value;
            }
        }
        return value;
    },
});
export const hackExtension = [
    editBoundaryState,
    insertCursorState,
    hackLockState,
];
