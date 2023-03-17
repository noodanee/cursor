var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { addTransaction } from '../globalSlice';
import { initialState } from '../window/state';
import { getFilePath } from '../selectors';
import { streamSource } from '../../utils';
import { API_ROOT } from '../../utils';
const API_ENDPOINT = '/long_complete';
export const startCompletion = createAsyncThunk('generation/start_completion', (tabId, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, e_1, _b, _c;
    const getTab = () => getState().global.tabs[tabId];
    // If already generating, we do nothing
    if (getTab().generating) {
        return;
    }
    const state = getState();
    const initialEditorState = state.global.tabCache[tabId].initialEditorState;
    const fileId = state.global.tabs[tabId].fileId;
    const file = getFilePath(fileId)(state);
    const content = initialEditorState.doc.toString();
    const pos = initialEditorState.selection.ranges[0].anchor;
    const path = API_ROOT + API_ENDPOINT;
    const data = {
        file,
        content,
        pos: pos,
    };
    dispatch(generationSlice.actions.pending(tabId));
    try {
        const response = yield fetch(path, {
            method: 'POST',
            headers: {
                'content-type': 'application/json;charset=UTF-8',
            },
            body: JSON.stringify(data),
        });
        var notStarted = true;
        var currentPos = pos;
        try {
            for (var _d = true, _e = __asyncValues(streamSource(response)), _f; _f = yield _e.next(), _a = _f.done, !_a;) {
                _c = _f.value;
                _d = false;
                try {
                    let token = _c;
                    if (notStarted) {
                        notStarted = false;
                        dispatch(generationSlice.actions.starting(tabId));
                    }
                    // If interrupted, we stop
                    if (getTab().interrupted)
                        break;
                    // TODO - move this logic to the generationSlice
                    dispatch(addTransaction({
                        tabId: tabId,
                        transactionFunction: {
                            type: 'insert',
                            from: currentPos,
                            to: currentPos,
                            text: token,
                        },
                    }));
                    currentPos += token.length;
                }
                finally {
                    _d = true;
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (!_d && !_a && (_b = _e.return)) yield _b.call(_e);
            }
            finally { if (e_1) throw e_1.error; }
        }
    }
    finally {
        dispatch(generationSlice.actions.completed(tabId));
    }
}));
export const generationSlice = createSlice({
    name: 'generation',
    initialState,
    reducers: {
        init(stobj, action) {
            const state = stobj;
            const tabId = action.payload;
            //state.keyboardBindings['Cmd-e'] = ''
        },
        pending(stobj, action) {
            const state = stobj;
            const tabId = action.payload;
            const tab = state.tabs[tabId];
            // set Tab to Read only
            tab.isReadOnly = true;
            tab.generating = true;
            tab.interrupted = false;
            state.keyboardBindings['Ctrl-c'] =
                generationSlice.actions.interrupt(tabId);
        },
        starting(stobj, action) { },
        completed(stobj, action) {
            const state = stobj;
            const tabId = action.payload;
            const tab = state.tabs[tabId];
            // set Tab to not Read only
            tab.isReadOnly = false;
            tab.generating = false;
            tab.interrupted = false;
            delete state.keyboardBindings['Ctrl-c'];
        },
        interrupt(stobj, action) {
            const state = stobj;
            const tabId = action.payload;
            const tab = state.tabs[tabId];
            if (tab.generating) {
                tab.interrupted = true;
                delete state.keyboardBindings['Ctrl-c'];
            }
        },
    },
});
