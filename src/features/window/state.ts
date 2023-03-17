import { v4 as uuidv4 } from 'uuid';
export var HoverState;
(function (HoverState) {
    HoverState[HoverState["None"] = 0] = "None";
    HoverState[HoverState["Full"] = 1] = "Full";
    HoverState[HoverState["Right"] = 2] = "Right";
    HoverState[HoverState["Left"] = 3] = "Left";
    HoverState[HoverState["Top"] = 4] = "Top";
    HoverState[HoverState["Bottom"] = 5] = "Bottom";
})(HoverState || (HoverState = {}));
// INITIAL STATE
export const initialLoggingState = {
    feedbackMessage: '',
    isOpen: false,
};
const startUuid = uuidv4();
export const initialChatState = {
    generating: false,
    isCommandBarOpen: false,
    currentConversationId: startUuid,
    commandBarText: '',
    conversations: [],
    userMessages: [],
    botMessages: [],
    draftMessages: {},
    fireCommandK: false,
    chatIsOpen: false,
    chatHistoryIsOpen: false,
    commandBarHistoryIndex: -1,
};
export const initialSettingsState = {
    isOpen: false,
    settings: {
        keyBindings: 'none',
        useFour: 'disabled',
        contextType: 'none',
        textWrapping: 'disabled',
    },
};
export const initialState = {
    repoId: null,
    repoProgress: {
        progress: 0,
        state: 'notStarted',
    },
    files: {},
    folders: {
        0: {
            parentFolderId: null,
            name: '',
            renameName: '',
            fileIds: [],
            folderIds: [],
            loaded: true,
            isOpen: false,
        },
    },
    fileCache: {},
    tabCache: {},
    tabs: {},
    rightClickId: null,
    isRightClickAFile: false,
    rootPath: null,
    keyboardBindings: {},
    draggingTabId: null,
    zoomFactor: 0.75,
    paneState: {
        byIds: {},
        bySplits: [],
    },
    showError: false,
    errorType: 'server',
    errorInfo: '404, request bad',
    version: '0.0.11',
    showRemotePopup: false,
    remoteCommand: '',
    remotePath: '',
    remoteBad: false,
    isNotFirstTime: true,
};
export function nextValue(keys) {
    if (keys.length == 0) {
        return 1;
    }
    else {
        return Math.max(...keys.map((x) => parseInt(x))) + 1;
    }
}
export function nextId(byIds) {
    return nextValue(Object.keys(byIds));
}
export function nextTabID(state) {
    return nextId(state.tabs);
}
export function nextPaneID(state) {
    return nextId(state.paneState.byIds);
}
export function nextFolderID(state) {
    return nextId(state.folders);
}
export function nextFileID(state) {
    return nextId(state.files);
}
