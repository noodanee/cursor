import { getIdentifier } from './languageServerSlice';
import { createSelector } from '@reduxjs/toolkit';
export const getLanguages = createSelector((state) => state.languageServerState, (languageServerState) => Object.keys(languageServerState.languageServers));
export const copilotStatus = createSelector((state) => state.languageServerState, (languageServerState) => ({
    signedIn: languageServerState.copilotSignedIn,
    enabled: languageServerState.copilotEnabled,
}));
export const languageServerStatus = (languageServer) => createSelector((state) => state.languageServerState, (languageServerState) => {
    const languageServerName = getIdentifier(languageServer);
    if (languageServerName === null) {
        return null;
    }
    return languageServerState.languageServers[languageServerName];
});
