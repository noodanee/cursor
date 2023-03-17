var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import { findFileIdFromPath } from '../window/fileUtils';
import { API_ROOT, streamSource } from '../../utils';
const initialState = {
    fileThenNames: {},
};
export const updateCommentsForFile = createAsyncThunk('comments/updateCommentsForFile', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    const global = state.global;
    const fileId = findFileIdFromPath(global, payload.filePath);
    if (fileId == null)
        return;
    const contents = global.fileCache[fileId].contents;
    let cachedComments = state.commentState.fileThenNames[payload.filePath];
    if (cachedComments == null) {
        //@ts-ignore
        cachedComments = yield connector.loadComments(payload.filePath);
        dispatch(updateComments({
            filePath: payload.filePath,
            comments: cachedComments,
        }));
    }
    cachedComments = cachedComments || {};
    const response = yield fetch(`${API_ROOT}/comment`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `repo_path=${state.global.rootPath}`,
        },
        //credentials: 'include',
        body: JSON.stringify({
            toComment: contents,
            filename: payload.filePath,
            cachedComments: cachedComments,
        }),
    });
    const getNextToken = () => __awaiter(void 0, void 0, void 0, function* () {
        let rawResult = yield generator.next();
        if (rawResult.done)
            return null;
        return rawResult.value;
    });
    let generator = streamSource(response);
    let line = yield getNextToken();
    while (line != null) {
        const { function_name: name, function_body: body, comment, description, } = line;
        dispatch(updateSingleComment({
            filePath: payload.filePath,
            functionName: name,
            commentFn: {
                originalFunctionBody: body,
                comment: comment.trim(),
                description: description.trim(),
            },
        }));
        line = yield getNextToken();
    }
    dispatch(saveComments({ path: payload.filePath }));
}));
export const saveComments = createAsyncThunk('comments/saveComments', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    //@ts-ignore
    connector.saveComments({
        path: payload.path,
        blob: state.commentState.fileThenNames[payload.path],
    });
}));
export const addCommentToDoc = createAsyncThunk('comments/addCommentsToDoc', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    dispatch(afterAddCommentToDoc(payload));
    dispatch(saveComments({ path: payload.filePath }));
}));
export const commentSlice = createSlice({
    name: 'commentState',
    initialState: initialState,
    reducers: {
        afterAddCommentToDoc(state, action) {
            const commentFn = state.fileThenNames[action.payload.filePath][action.payload.functionName];
            if (commentFn == null)
                return;
            commentFn.marked = true;
        },
        updateComments(state, action) {
            state.fileThenNames[action.payload.filePath] =
                action.payload.comments;
        },
        updateSingleComment(state, action) {
            if (state.fileThenNames[action.payload.filePath] == null) {
                state.fileThenNames[action.payload.filePath] = {};
            }
            state.fileThenNames[action.payload.filePath][action.payload.functionName] = action.payload.commentFn;
        },
    },
});
export const { updateComments, updateSingleComment, afterAddCommentToDoc } = commentSlice.actions;
