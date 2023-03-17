import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useLayoutEffect, useRef, useEffect } from 'react';
import { faClose } from '@fortawesome/pro-regular-svg-icons';
import Modal from 'react-modal';
// import emoji from "@jukben/emoji-search";
import { useAppSelector, useAppDispatch } from './app/hooks';
import { PaneHolder } from './components/pane';
import { LeftSide } from './components/search';
import * as gs from './features/globalSlice';
import * as cs from './features/chat/chatSlice';
import * as ss from './features/settings/settingsSlice';
import * as ts from './features/tools/toolSlice';
import * as csel from './features/chat/chatSelectors';
import * as tsel from './features/tools/toolSelectors';
import * as gsel from './features/selectors';
import { getFolders, getPaneStateBySplits, getZoomFactor, getRootPath, getFocusedTab, } from './features/selectors';
import { ChatPopup, CommandBar } from './components/markdown';
import { SettingsPopup } from './components/settingsPane';
import { FeedbackArea } from './components/search';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { WelcomeScreen } from './components/welcomeScreen';
import { TitleBar } from './components/titlebar';
const customStyles = {
    overlay: {
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 10000,
    },
    content: {
        padding: 'none',
        top: '150px',
        bottom: 'none',
        background: 'none',
        border: 'none',
        width: 'auto',
        height: 'auto',
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: '600px',
    },
};
function ErrorPopup() {
    const showError = useAppSelector(gsel.getShowErrors);
    const dispatch = useAppDispatch();
    return (_jsx(Modal, Object.assign({ isOpen: showError, onRequestClose: () => {
            dispatch(gs.closeError(null));
        }, style: customStyles }, { children: _jsxs("div", Object.assign({ className: "errorPopup" }, { children: [_jsxs("div", Object.assign({ className: "errorPopup__title" }, { children: [_jsx("div", Object.assign({ className: "errorPopup__title_text" }, { children: "A server error has occurred" })), _jsx("div", Object.assign({ className: "errorPopup__title_close", onClick: () => dispatch(gs.closeError(null)) }, { children: _jsx(FontAwesomeIcon, { icon: faClose }) }))] })), _jsxs("div", Object.assign({ className: "errorPopup__body" }, { children: ["If this persists, please let us know on our Discord or at michael@cursor.so.", _jsx("br", {})] }))] })) })));
}
function SSHPopup() {
    const showRemotePopup = useAppSelector(gsel.getShowRemotePopup);
    const remoteCommand = useAppSelector(gsel.getRemoteCommand);
    const remotePath = useAppSelector(gsel.getRemotePath);
    const remoteBad = useAppSelector(gsel.getRemoteBad);
    const dispatch = useAppDispatch();
    const textInputRef = useRef(null);
    const textInputRef2 = useRef(null);
    function submit() {
        // if the inputs have more than 2 chars each
        if (textInputRef.current.value.length > 2 &&
            textInputRef2.current.value.length > 2) {
            dispatch(gs.openRemoteFolder(null));
        }
    }
    return (_jsx(Modal, Object.assign({ isOpen: showRemotePopup, onRequestClose: () => {
            dispatch(gs.closeRemotePopup(null));
        }, style: customStyles }, { children: _jsxs("div", Object.assign({ className: "errorPopup" }, { children: [_jsxs("div", Object.assign({ className: "errorPopup__title" }, { children: [_jsx("div", Object.assign({ className: "errorPopup__title_text" }, { children: "Connect to SSH directory" })), _jsx("div", Object.assign({ className: "remotePopup__title_close", onClick: () => dispatch(gs.closeRemotePopup(null)) }, { children: _jsx(FontAwesomeIcon, { icon: faClose }) }))] })), remoteBad && (_jsx("div", Object.assign({ className: "errorPopup__body" }, { children: "The SSH command or path you entered is invalid. Please try again." }))), _jsxs("div", Object.assign({ className: "remotePopup__body" }, { children: [_jsx("div", Object.assign({ className: "settings__item_title" }, { children: "SSH Command" })), _jsx("div", Object.assign({ className: "settings__item_description" }, { children: "Same command you would put in the terminal" })), _jsx("input", { type: "text", placeholder: "ssh -i ~/keys/mypemfile.pem ubuntu@ec2dns.aws.com", ref: textInputRef, value: remoteCommand, onChange: (e) => dispatch(gs.setRemoteCommand(e.target.value)) })] })), _jsxs("div", Object.assign({ className: "remotePopup__body" }, { children: [_jsx("div", Object.assign({ className: "settings__item_title" }, { children: "Target Folder" })), _jsx("div", Object.assign({ className: "settings__item_description" }, { children: "Must be an absolute path" })), _jsx("input", { type: "text", placeholder: "/home/ubuntu/portal/", value: remotePath, ref: textInputRef2, onChange: (e) => dispatch(gs.setRemotePath(e.target.value)), onKeyDown: (event) => {
                                if (event.key === 'Enter') {
                                    submit();
                                }
                            } })] })), _jsx("div", Object.assign({ className: "submit-button-parent" }, { children: _jsx("button", Object.assign({ className: "submit-button-ssh", onClick: () => {
                            submit();
                        } }, { children: "Submit" })) }))] })) })));
}
// A component that renders a button to open a file dialog
function FileDialog() {
    // Get the dispatch function from the app context
    const dispatch = useAppDispatch();
    return (
    // Render a div with a click handler that dispatches an action to open a folder
    _jsx("div", Object.assign({ className: "filedialog", onClick: () => dispatch(gs.openFolder(null)) }, { children: "Open Folder" })));
}
export function App() {
    const dispatch = useAppDispatch();
    const isNotFirstTime = useAppSelector(gsel.getIsNotFirstTime);
    const rootPath = useAppSelector(getRootPath);
    const folders = useAppSelector(getFolders);
    const leftSideExpanded = useAppSelector(tsel.getLeftSideExpanded);
    const paneSplits = useAppSelector(getPaneStateBySplits);
    const zoomFactor = useAppSelector(getZoomFactor);
    const titleHeight = Math.round((1.0 / zoomFactor) * 35) + 'px';
    // set window height to 100 vh - titlebar height
    const windowHeight = 'calc(100vh - ' + titleHeight + ')';
    const commandBarOpen = useAppSelector(csel.getIsCommandBarOpen);
    const currentActiveTab = useAppSelector(getFocusedTab);
    // Get the currently opened filename
    const activeFilePath = useAppSelector(gsel.getCurrentFilePath);
    useEffect(() => {
        function handleKeyDown(e) {
            if (e.metaKey &&
                (currentActiveTab == null || currentActiveTab.isMulti)) {
                if (e.key === 'j') {
                    // REMOVED CODEBASE-WIDE FEATURES!
                    // dispatch(
                    //     ss.changeSettings({
                    //         contextType: 'embeddings',
                    //     })
                    // )
                    // dispatch(cs.changeMsgType('idk'))
                    // dispatch(
                    //     cs.activateDiffFromEditor({
                    //         currentFile: null,
                    //         precedingCode: null,
                    //         procedingCode: null,
                    //         currentSelection: null,
                    //         pos: 0,
                    //         selection: null,
                    //     })
                    // )
                    // dispatch(cs.openCommandBar())
                }
                else if (e.key === 'l') {
                    dispatch(ss.changeSettings({
                        contextType: 'copilot',
                    }));
                    dispatch(cs.changeMsgType('freeform'));
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
                else if (e.key == 'h') {
                    dispatch(cs.toggleChatHistory());
                }
                // backspace
                console.log('keycode', e.keyCode);
                if (e.keyCode === 8) {
                    console.log('interrupting generation');
                    dispatch(cs.interruptGeneration(null));
                    dispatch(cs.setChatOpen(false));
                }
            }
            // if meta key is pressed, focus can be anywhere
            if (e.metaKey) {
                if (e.key === 'b') {
                    dispatch(ts.toggleLeftSide());
                }
            }
            // if the escape key
            if (e.key === 'Escape') {
                dispatch(cs.setChatOpen(false));
                if (commandBarOpen) {
                    dispatch(cs.abortCommandBar());
                }
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        // Don't forget to clean up
        return function cleanup() {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [currentActiveTab, commandBarOpen]);
    useLayoutEffect(() => {
        if (rootPath == null) {
            dispatch(gs.initState(null));
        }
    }, [rootPath]);
    const screenState = isNotFirstTime == false
        ? 'welcome'
        : Object.keys(folders).length <= 1
            ? 'folder'
            : 'normal';
    console.log('isNotFirstTime', isNotFirstTime, screenState);
    return (_jsxs(_Fragment, { children: [commandBarOpen && _jsx(CommandBar, { parentCaller: 'commandBar' }), _jsx(TitleBar, { titleHeight: titleHeight, useButtons: screenState === 'normal' }), _jsxs("div", Object.assign({ className: "window relative", style: { height: windowHeight } }, { children: [screenState === 'welcome' && _jsx(WelcomeScreen, {}), screenState === 'folder' && (_jsxs(_Fragment, { children: [_jsx(SSHPopup, {}), _jsx(FileDialog, {})] })), screenState === 'normal' && (_jsxs(_Fragment, { children: [_jsx("div", Object.assign({ className: `app__lefttopwrapper ${leftSideExpanded ? 'flex' : 'hidden'}` }, { children: _jsx(LeftSide, {}) })), _jsx("div", Object.assign({ className: "app__righttopwrapper" }, { children: _jsx("div", Object.assign({ className: "app__paneholderwrapper" }, { children: _jsx(PaneHolder, { paneIds: paneSplits, depth: 1 }) })) })), _jsx(ChatPopup, {}), _jsx(ErrorPopup, {}), _jsx(SettingsPopup, {}), _jsx(FeedbackArea, {}), _jsx(SSHPopup, {})] }))] }))] }));
}
