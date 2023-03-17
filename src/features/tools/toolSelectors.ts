import { createSelector } from '@reduxjs/toolkit';
export const getLeftTab = createSelector((state) => state.toolState, (tool) => tool.openLeftTab);
export const getLeftTabActive = createSelector((state) => state.toolState, (tool) => tool.leftTabActive);
export const fileSearchTriggered = createSelector((state) => state.toolState, (tool) => tool.fileSearchTriggered);
export const commandPaletteTriggeredSelector = createSelector((state) => state.toolState, (tool) => {
    return tool.commandPaletteTriggered;
});
export const aiCommandPaletteTriggeredSelector = createSelector((state) => state.toolState, (tool) => {
    return tool.aiCommandPaletteTriggered;
});
export const getLeftSideExpanded = createSelector((state) => state.toolState, (tool) => tool.leftSideExpanded);
