var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createAsyncThunk } from '@reduxjs/toolkit';
import { getActiveTabId } from './window/paneUtils';
import { saveFile, forceCloseTab } from './globalSlice';
import { getPathForFileId } from './window/fileUtils';
import { removeEditor } from './codemirror/codemirrorSlice';
export const closeTab = createAsyncThunk('global/closeTab', (tabId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState().global;
    tabId = tabId || getActiveTabId(state);
    if (tabId == null)
        return;
    const fileId = state.tabs[tabId].fileId;
    const file = state.files[fileId];
    if (!file.saved) {
        const result = yield connector.checkCloseTab(getPathForFileId(state, fileId));
        if (result === 'cancel')
            return;
        if (result === 'save') {
            yield dispatch(saveFile(fileId));
        }
    }
    // Delete the view before closing the tab
    dispatch(removeEditor({ tabId }));
    // Then close the tab
    dispatch(forceCloseTab(tabId));
}));
