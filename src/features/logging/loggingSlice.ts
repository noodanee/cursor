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
import { API_ROOT } from '../../utils';
import { initialLoggingState } from '../window/state';
export const sendFeedbackMessage = createAsyncThunk('chat/getResponse', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    const message = state.loggingState.feedbackMessage;
    dispatch(updateFeedbackMessage(''));
    dispatch(closeChat(null));
    const response = yield fetch(`${API_ROOT}/save_message`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message,
        }),
    });
}));
export const loggingSlice = createSlice({
    name: 'settings',
    initialState: initialLoggingState,
    reducers: {
        updateFeedbackMessage(loggingState, action) {
            loggingState.feedbackMessage = action.payload;
        },
        toggleFeedback(loggingState, action) {
            loggingState.isOpen = !loggingState.isOpen;
        },
        closeChat(loggingState, action) {
            loggingState.isOpen = false;
        },
    },
});
export const { updateFeedbackMessage, toggleFeedback, closeChat } = loggingSlice.actions;
