import * as cs from '../../features/chat/chatSlice';
import { changeSettings } from '../../features/settings/settingsSlice';
import { store } from '../../app/store';
import { getActiveTabId } from '../window/paneUtils';
// wow this is gross
// This should probably be its own thunk
export const commandK = (msgType, isOnEntireRepo, dispatch) => {
    const chatState = store.getState().chatState;
    if (chatState.generating)
        return;
    // Dont do anything when currently generating!!
    dispatch(changeSettings({
        contextType: isOnEntireRepo ? 'embeddings' : 'copilot',
    }));
    console.log('ran command k');
    dispatch(cs.changeMsgType(msgType));
    console.log('changed message type', msgType);
    // If we are not in an active tab, then we need to open the chat
    const activeTabId = getActiveTabId(store.getState().global);
    console.log('active Tab Id', activeTabId);
    if (activeTabId) {
        dispatch(cs.turnOnCommandK());
    }
    else {
        console.log('activating diff from editor');
        if (msgType != 'edit' && msgType != 'generate') {
            dispatch(cs.activateDiffFromEditor({
                currentFile: null,
                precedingCode: null,
                procedingCode: null,
                currentSelection: null,
                pos: 0,
                selection: null,
            }));
            dispatch(cs.openCommandBar());
        }
        // Otherwise we should warn them that they cannot generate or edit code in a non-active tab
    }
};
// TODO - I think the pattern should be that this becomes a single reducer and we have an event to trigger it.
// We get rid of turnOnCommandK, as it should have the codemirror state synced anyways.
// Then in every place we open the command bar, we just dispatch a single action, which triggers this monster reducer.
