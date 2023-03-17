import { getCodeMirrorView } from './codemirrorSlice';
export const getViewId = (tabId) => (state) => {
    if (!tabId)
        return;
    const castState = state;
    if (tabId in castState.codeMirrorState.editorMap) {
        return castState.codeMirrorState.editorMap[tabId];
    }
};
/// null - means there is no codemirror instance in frame
/// true - means there is a selection
/// false - means there is no selection
export const hasSelection = (viewId) => {
    if (viewId) {
        const view = getCodeMirrorView(viewId);
        if (view) {
            console.log('main selection', view.state.selection.main);
            return (view.state.selection.main.from !== view.state.selection.main.to);
        }
    }
    return null;
};
