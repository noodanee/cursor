var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAppDispatch, useAppSelector } from '../app/hooks';
import * as ssel from '../features/settings/settingsSelectors';
import { changeSettings, toggleSettings, } from '../features/settings/settingsSlice';
import { copilotChangeEnable, copilotChangeSignin, installLanguageServer, runLanguageServer, stopLanguageServer, } from '../features/lsp/languageServerSlice';
import { getConnections } from '../features/lsp/languageServerSlice';
// REMOVED CODEBASE-WIDE FEATURES!
// import { initializeIndex } from '../features/globalSlice'
import Dropdown from 'react-dropdown';
import 'react-dropdown/style.css';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { copilotStatus, getLanguages, languageServerStatus, } from '../features/lsp/languageServerSelector';
import Modal from 'react-modal';
export function SettingsPopup() {
    const dispatch = useAppDispatch();
    const settings = useAppSelector(ssel.getSettings);
    const isSettingsOpen = useAppSelector(ssel.getSettingsIsOpen);
    const languageServerNames = useAppSelector(getLanguages);
    const synced = useAppSelector((state) => state.global.repoProgress.state == 'done');
    const embeddingOptions = useMemo(() => {
        if (synced) {
            return ['embeddings', 'copilot', 'none'];
        }
        else {
            return ['copilot', 'none'];
        }
    }, [synced]);
    const [uploadPreference, setUploadPreference] = useState(false);
    useEffect(() => {
        // @ts-ignore
        connector.getUploadPreference().then((preference) => {
            console.log('got pref', preference);
            setUploadPreference(preference);
        });
    }, [isSettingsOpen]);
    const customStyles = {
        overlay: {
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            zIndex: 10000,
        },
        content: {
            padding: 'none',
            bottom: 'none',
            background: 'none',
            border: 'none',
            marginLeft: 'auto',
            marginRight: 'auto',
            top: '130px',
            right: '40px',
            left: 'none',
            width: '500px',
        },
    };
    return (_jsx(_Fragment, { children: _jsx(Modal, Object.assign({ isOpen: isSettingsOpen, onRequestClose: () => {
                dispatch(toggleSettings());
            }, style: customStyles }, { children: _jsxs("div", Object.assign({ className: "settingsContainer" }, { children: [_jsxs("div", Object.assign({ className: "settings" }, { children: [_jsx("div", Object.assign({ className: "settings__dismiss", onClick: () => {
                                    dispatch(toggleSettings());
                                } }, { children: _jsx("i", { className: "fas fa-times" }) })), _jsx("div", Object.assign({ className: "settings__title" }, { children: "SETTINGS" })), _jsxs("div", Object.assign({ className: "settings__content" }, { children: [_jsxs("div", Object.assign({ className: "settings__item" }, { children: [_jsx("div", Object.assign({ className: "settings__item_title" }, { children: "Key Bindings" })), _jsx("div", Object.assign({ className: "settings__item_description" }, { children: "Controls whether to use vim, emacs, or none" })), _jsx(Dropdown, { options: ['none', 'vim', 'emacs'], onChange: (e) => {
                                                    dispatch(changeSettings({
                                                        keyBindings: e.value,
                                                    }));
                                                }, value: settings.keyBindings })] })), _jsxs("div", Object.assign({ className: "settings__item" }, { children: [_jsx("div", Object.assign({ className: "settings__item_title" }, { children: "Text Wrapping" })), _jsx("div", Object.assign({ className: "settings__item_description" }, { children: "Controls whether text wrapping is enabled" })), _jsx(Dropdown, { options: ['enabled', 'disabled'], onChange: (e) => {
                                                    dispatch(changeSettings({
                                                        textWrapping: e.value,
                                                    }));
                                                }, value: settings.textWrapping })] })), _jsx(CopilotPanel, {}), languageServerNames.map((name) => (_jsx(LanguageServerPanel, { languageName: name }, name)))] }))] })), _jsx("div", { className: "cover-bar" })] })) })) }));
}
function CopilotPanel() {
    const dispatch = useAppDispatch();
    const { signedIn, enabled } = useAppSelector(copilotStatus);
    const [localState, setLocalState] = useState(signedIn ? 'signedIn' : 'signedOut');
    const [localData, setLocalData] = useState();
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLocalState(signedIn ? 'signedIn' : 'signedOut');
    }, [signedIn]);
    const trySignIn = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const copilotClient = getConnections().copilot.client;
        setLoading(true);
        const { verificationUri, status, userCode } = yield copilotClient.signInInitiate({});
        if (status == 'OK' || status == 'AlreadySignedIn') {
            dispatch(copilotChangeSignin(true));
        }
        else {
            setLocalState('signingIn');
            setLocalData({ url: verificationUri, code: userCode });
        }
        setLoading(false);
    }), [setLocalState, setLocalData, dispatch]);
    const tryFinishSignIn = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const copilotClient = getConnections().copilot.client;
        const { status } = yield copilotClient.signInConfirm({
            userCode: localData.code,
        });
        if (status == 'OK' || status == 'AlreadySignedIn') {
            dispatch(copilotChangeSignin(true));
        }
        else {
            setLocalState;
        }
    }), [localData, setLocalState, dispatch]);
    const signOut = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        const copilotClient = getConnections().copilot.client;
        yield copilotClient.signOut();
        dispatch(copilotChangeSignin(false));
    }), []);
    const enableCopilot = useCallback(() => {
        dispatch(copilotChangeEnable(true));
    }, [dispatch]);
    const disableCopilot = useCallback(() => {
        dispatch(copilotChangeEnable(false));
    }, [dispatch]);
    let currentPanel;
    if (localState == 'signedOut') {
        currentPanel = (_jsx("div", Object.assign({ className: "copilot__signin" }, { children: _jsx("button", Object.assign({ onClick: trySignIn }, { children: "Sign in" })) })));
    }
    else if (localState == 'signingIn') {
        currentPanel = (_jsxs("div", Object.assign({ className: "copilot__signin" }, { children: ["Please click this link:\u00A0\u00A0", _jsx("a", Object.assign({ href: localData === null || localData === void 0 ? void 0 : localData.url, target: "_blank" }, { children: localData === null || localData === void 0 ? void 0 : localData.url })), _jsx("br", {}), "Enter this code: ", localData === null || localData === void 0 ? void 0 : localData.code, _jsx("br", {}), "Click here when done:", _jsx("button", Object.assign({ onClick: tryFinishSignIn }, { children: "Done" }))] })));
    }
    else if (localState == 'signInFailed') {
        currentPanel = (_jsxs("div", Object.assign({ className: "copilot__signin" }, { children: ["Sign in failed. Please try again.", loading ? (_jsx("p", { children: "Loading..." })) : (_jsx("button", Object.assign({ onClick: trySignIn }, { children: "Sign in" })))] })));
    }
    else {
        currentPanel = (_jsxs("div", Object.assign({ className: "copilot__signin" }, { children: ["Currently signed in ", _jsx("br", {}), enabled ? (_jsx("button", Object.assign({ onClick: disableCopilot }, { children: "Disable" }))) : (_jsx("button", Object.assign({ onClick: enableCopilot }, { children: "Enable" }))), _jsx("br", {}), _jsx("button", Object.assign({ onClick: signOut }, { children: "Sign out" }))] })));
    }
    return (_jsxs("div", Object.assign({ className: "settings__item" }, { children: [_jsx("div", Object.assign({ className: "settings__item_title" }, { children: "Copilot" })), currentPanel] })));
}
// REMOVED CODEBASE-WIDE FEATURES!
// function RemoteCodebaseSettingsPanel() {
//     const dispatch = useAppDispatch()
//     const repoId = useAppSelector((state) => state.global.repoId)
//     const rootDir = useAppSelector(getRootPath)
//     const progress = useAppSelector(getProgress)
//     const finished = useMemo(() => progress.state == 'done', [progress])
//     const startUpload = useCallback(async () => {
//         dispatch(initializeIndex(rootDir!))
//     }, [dispatch])
//     let container
//     if (repoId == null) {
//         container = (
//             <div className="remote_codebase__container">
//                 <button onClick={startUpload}>Start Index</button>
//             </div>
//         )
//     } else if (!finished) {
//         container = (
//             <div className="remote_codebase__container">
//                 <div className="remote_codebase__text">
//                     {(() => {
//                         switch (progress.state) {
//                             case 'notStarted':
//                                 return 'Not started'
//                             case 'uploading':
//                                 return 'Uploading...'
//                             case 'indexing':
//                                 return 'Indexing...'
//                             case 'done':
//                                 return 'Done!'
//                             case 'error':
//                                 return 'Failed!'
//                             case null:
//                                 return <br />
//                         }
//                     })()}
//                 </div>
//                 {progress.state != 'notStarted' && progress.state != null && (
//                     <>
//                         <div className="remote_codebase__progress">
//                             <div
//                                 className="remote_codebase__progress_bar"
//                                 style={{
//                                     width: `${progress.progress * 100}%`,
//                                     color: 'green',
//                                 }}
//                             />
//                         </div>
//                         <div className="remote_codebase__progress_text">
//                             {Math.floor(progress.progress * 100.0)}%
//                         </div>
//                     </>
//                 )}
//             </div>
//         )
//     } else {
//         container = (
//             <div className="remote_codebase__container">
//                 <div className="remote_codebase__progress_text">Done!</div>
//             </div>
//         )
//     }
//     return <div className="settings__item"></div>
// }
function LanguageServerPanel({ languageName }) {
    const dispatch = useAppDispatch();
    const languageState = useAppSelector(languageServerStatus(languageName));
    const languageInstalled = useMemo(() => languageState && languageState.installed, [languageState]);
    const languageRunning = useMemo(() => languageState && languageState.running, [languageState]);
    const installServer = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(installLanguageServer(languageName));
    }), [languageName]);
    const runServer = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(runLanguageServer(languageName));
    }), [languageName]);
    const stopServer = useCallback(() => __awaiter(this, void 0, void 0, function* () {
        yield dispatch(stopLanguageServer(languageName));
    }), [languageName]);
    let container;
    if (languageInstalled) {
        container = (_jsxs("div", Object.assign({ className: "language_server__container" }, { children: [_jsx("div", Object.assign({ className: "language_server__status" }, { children: languageRunning ? 'Running' : 'Stopped' })), _jsx("div", Object.assign({ className: "copilot__signin" }, { children: languageRunning ? (_jsx("button", Object.assign({ onClick: stopServer }, { children: "Stop" }))) : (_jsx("button", Object.assign({ onClick: runServer }, { children: "Run" }))) }))] })));
    }
    else {
        container = (_jsx("div", Object.assign({ className: "copilot__signin" }, { children: _jsx("button", Object.assign({ onClick: installServer }, { children: "Install" })) })));
    }
    return (_jsxs("div", Object.assign({ className: "settings__item" }, { children: [_jsxs("div", Object.assign({ className: "settings__item_title" }, { children: [languageName, " Language Server"] })), container] })));
}
