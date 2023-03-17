import { createSlice } from '@reduxjs/toolkit';
import { current } from '@reduxjs/toolkit';
const initialState = {
    openLeftTab: 'filetree',
    leftTabActive: false,
    fileSearchTriggered: false,
    commandPaletteTriggered: false,
    aiCommandPaletteTriggered: false,
    leftSideExpanded: true,
};
const untriggerAll = (state) => {
    state.fileSearchTriggered = false;
    state.commandPaletteTriggered = false;
    // leftSideExpanded: true
    state.aiCommandPaletteTriggered = false;
};
export const toolSlice = createSlice({
    name: 'toolState',
    initialState: initialState,
    reducers: {
        openSearch: (state) => {
            untriggerAll(state);
            state.openLeftTab = 'search';
            state.leftTabActive = true;
        },
        openFileTree: (state) => {
            untriggerAll(state);
            state.openLeftTab = 'filetree';
            state.leftTabActive = true;
        },
        leftTabInactive: (state) => {
            state.leftTabActive = false;
        },
        triggerFileSearch: (state) => {
            console.log(current(state));
            untriggerAll(state);
            state.fileSearchTriggered = true;
            console.log('done');
        },
        untriggerFileSearch: (state) => {
            console.log('untrigger');
            untriggerAll(state);
        },
        triggerCommandPalette: (state) => {
            untriggerAll(state);
            state.commandPaletteTriggered = true;
        },
        triggerAICommandPalette: (state) => {
            let newAICommandPaletteTriggered = !state.aiCommandPaletteTriggered;
            untriggerAll(state);
            state.aiCommandPaletteTriggered = newAICommandPaletteTriggered;
        },
        untriggerAICommandPalette: (state) => {
            untriggerAll(state);
        },
        untriggerCommandPalette: (state) => {
            console.log('untrigger');
            untriggerAll(state);
        },
        collapseLeftSide: (state) => {
            state.leftSideExpanded = false;
        },
        expandLeftSide: (state) => {
            state.leftSideExpanded = true;
        },
        toggleLeftSide: (state) => {
            state.leftSideExpanded = !state.leftSideExpanded;
        },
    },
});
export const { openSearch, openFileTree, leftTabInactive, triggerFileSearch, untriggerFileSearch, triggerCommandPalette, untriggerCommandPalette, triggerAICommandPalette, untriggerAICommandPalette, collapseLeftSide, expandLeftSide, toggleLeftSide, } = toolSlice.actions;
