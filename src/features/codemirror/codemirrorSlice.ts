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
import { createSlice } from '@reduxjs/toolkit';
import { EditorView } from '@codemirror/view';
import { Transaction } from '@codemirror/state';
import { customDispatch, syncDispatch, } from '../../components/codemirrorHooks/dispatch';
import { EditorState, } from '@codemirror/state';
// THESSE CANNOT be exported, because it must only be modifiable
// on state transitions
// Technically, I think you can sub out things in the middle
var codeMirrorViews = [];
function cleanViews(state) {
    // When we clean the views, we destroy the views that we have deleted from state
    codeMirrorViews
        .filter(([viewId, view]) => !state.editorIds.includes(viewId))
        .forEach(([viewId, view]) => void view.destroy());
    codeMirrorViews = codeMirrorViews.filter(([viewId, view]) => state.editorIds.includes(viewId));
    console.log({ view: codeMirrorViews });
}
function addCodeMirrorView(id, view) {
    codeMirrorViews = [...codeMirrorViews, [id, view]];
}
// You may now export any of these
export const getCodeMirrorView = (editorId) => {
    const view = codeMirrorViews.find(([viewId]) => viewId === editorId);
    if (view) {
        return view[1];
    }
    return null;
};
export const initialCodeMirrorState = {
    editorIds: [],
    editorMap: {},
};
function updateSyncViews(codeMirrorState, tabIds) {
    console.log('SYNC STUFF', 'RUNNING UPDATE SYNC VIEWS', tabIds);
    console.log('SYNC STUFF', 'RUNNING UPDATE SYNC VIEWS', codeMirrorState.editorMap);
    const views = tabIds.map((tabId) => {
        console.log('SYNC STUFF', 'TAB ID', tabId);
        const editorId = codeMirrorState.editorMap[tabId];
        return getCodeMirrorView(editorId);
    });
    //
    for (let i = 0; i < tabIds.length; i++) {
        console.log('SYNC_STUFF', 'UPDATING DISPATCH PART 1', i);
        const currentView = views[i];
        const otherViews = views.filter((view) => view !== currentView);
        const customDispatch = (tr) => syncDispatch(tr, currentView, ...otherViews);
        console.log('SYNC_STUFF', 'UPDATING DISPATCH TO BE SYNC DISPATCH');
        currentView.dispatch = (...input) => {
            customDispatch(input.length == 1 && input[0] instanceof Transaction
                ? input[0]
                : currentView.state.update(...input));
        };
    }
}
export const upsertEditor = createAsyncThunk('codemirror/createEditor', ({ tabId, editorStateConfig, useCustomDispatch }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    // Upsert the editor
    dispatch(_upsertEditor({ tabId, editorStateConfig, useCustomDispatch }));
    const state = getState().global;
    const fileId = state.tabs[tabId].fileId;
    console.log('GOT FILE ID', fileId);
    const similarTabIds = Object.keys(state.tabs).filter((otherTabId) => parseInt(otherTabId) !== tabId &&
        state.tabs[parseInt(otherTabId)].fileId === fileId);
    console.log('GOT SIMILAR TAB IDS', similarTabIds);
    // Then we change the other tabs to be the same
    if (similarTabIds.length > 0) {
        const allTabIds = [
            tabId,
            ...similarTabIds.map((id) => parseInt(id)),
        ];
        updateSyncViews(getState().codeMirrorState, allTabIds);
    }
}));
export const removeEditor = createAsyncThunk('codemirror/removeEditor', ({ tabId }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(_removeEditor({ tabId }));
    const state = getState().global;
    const fileId = state.tabs[tabId].fileId;
    const similarTabIds = Object.keys(state.tabs).filter((otherTabId) => parseInt(otherTabId) !== tabId &&
        state.tabs[parseInt(otherTabId)].fileId === fileId);
    // Then we change the other tabs to be the same
    if (similarTabIds.length > 0) {
        updateSyncViews(getState().codeMirrorState, similarTabIds.map((id) => parseInt(id)));
    }
}));
export const codeMirrorSlice = createSlice({
    name: 'codeMirrorState',
    initialState: initialCodeMirrorState,
    extraReducers: (builder) => {
        // Case for installing a language server
    },
    reducers: {
        _upsertEditor: (state, action) => {
            const { tabId, editorStateConfig: { initialState, config }, useCustomDispatch, } = action.payload;
            // Check if we already have an editor for this tab
            // if (tabId in state.editorMap) {
            //     // we can still update the editor
            //     return
            // }
            console.log('upserting view');
            const stateCurrent = initialState
                ? EditorState.fromJSON(initialState.json, config, initialState.fields)
                : EditorState.create(config);
            // Otherwise, create a new editor
            let view;
            view = new EditorView(Object.assign(Object.assign({}, stateCurrent), { dispatch: useCustomDispatch
                    ? (tr) => customDispatch(view, tr)
                    : undefined }));
            let nextId;
            if (state.editorIds.length == 0) {
                nextId = 1;
            }
            else {
                nextId = Math.max(...state.editorIds) + 1;
            }
            addCodeMirrorView(nextId, view);
            state.editorIds.push(nextId);
            state.editorMap[tabId] = nextId;
            // Then we clean the views
            cleanViews(state);
        },
        _removeEditor: (state, action) => {
            const { tabId } = action.payload;
            console.log('Deleting view!');
            if (tabId in state.editorMap) {
                const editorId = state.editorMap[tabId];
                // Find the index of the editorId
                delete state.editorMap[tabId];
                // Get the index of the editorId from the editorIds
                state.editorIds = state.editorIds.filter((eid) => eid !== editorId);
            }
            // Then we clean the views
            cleanViews(state);
        },
        transferEditor: (state, action) => {
            const { oldTabId, newTabId } = action.payload;
            if (oldTabId in state.editorMap) {
                const editorId = state.editorMap[oldTabId];
                delete state.editorMap[oldTabId];
                state.editorMap[newTabId] = editorId;
            }
            // Then we clean the views
            cleanViews(state);
            console.log(codeMirrorViews.length);
        },
    },
});
export const { _upsertEditor, _removeEditor, transferEditor } = codeMirrorSlice.actions;
