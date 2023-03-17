import { StateField, StateEffect } from '@codemirror/state';
// StateEffect to update the current pane id
export const updatePaneId = StateEffect.define();
// StateField to store the current pane id
export const paneIdField = StateField.define({
    create: () => -1,
    update: (paneId, tr) => {
        for (let effect of tr.effects) {
            if (effect.is(updatePaneId)) {
                console.log('updatePaneId', effect.value);
                paneId = effect.value;
            }
        }
        return paneId;
    },
});
// Export the StateField and StateEffect
export const storePaneIdExtensions = [paneIdField];
