var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createAsyncThunk, createSlice, } from '@reduxjs/toolkit';
import { initialSettingsState, } from '../window/state';
export const changeSettings = createAsyncThunk('settings/changeSettings', (newSettings, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(changeSettingsNoSideffect(newSettings));
    //@ts-ignore
    connector.changeSettings(getState().settingsState.settings);
}));
export const settingsSlice = createSlice({
    name: 'settings',
    initialState: initialSettingsState,
    reducers: {
        toggleSettings(settingsState) {
            settingsState.isOpen = !settingsState.isOpen;
        },
        changeSettingsNoSideffect(settingsState, action) {
            settingsState.settings = Object.assign(Object.assign({}, settingsState.settings), action.payload);
            console.log('Settings state is now', settingsState.settings);
        },
    },
});
export const { toggleSettings, changeSettingsNoSideffect } = settingsSlice.actions;
