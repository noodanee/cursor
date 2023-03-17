import { createSelector } from 'reselect';
export const getSettingsIsOpen = createSelector((state) => state.settingsState, (settings) => settings.isOpen);
export const getSettings = createSelector((state) => state.settingsState, (settings) => settings.settings);
