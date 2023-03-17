var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import * as ss from '../features/settings/settingsSlice';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { useCallback, useEffect } from 'react';
import { copilotStatus } from '../features/lsp/languageServerSelector';
import { copilotChangeEnable, copilotChangeSignin, getConnections, } from '../features/lsp/languageServerSlice';
import { useState } from 'react';
import { RadioGroup } from '@headlessui/react';
import { openTutorFolder, setIsNotFirstTimeWithSideEffect, } from '../features/globalSlice';
import posthog from 'posthog-js';
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
        currentPanel = (_jsx(_Fragment, { children: _jsx("div", Object.assign({ className: "copilot__signin welcome-button welcome-copilot-sign-in" }, { children: _jsx("button", Object.assign({ onClick: () => {
                        trySignIn();
                        posthog.capture('Welcome Screen Copilot Connect Click');
                    } }, { children: "Connect" })) })) }));
    }
    else if (localState == 'signingIn') {
        currentPanel = (_jsxs("div", Object.assign({ className: "copilot__signin copilot-steps-panel" }, { children: [_jsx("div", Object.assign({ className: "copilot-steps-title" }, { children: "Instructions" })), _jsxs("div", Object.assign({ className: "copilot-step" }, { children: ["1. Please click this link:\u00A0", _jsx("a", Object.assign({ href: localData === null || localData === void 0 ? void 0 : localData.url, target: "_blank" }, { children: localData === null || localData === void 0 ? void 0 : localData.url }))] })), _jsxs("div", Object.assign({ className: "copilot-step" }, { children: ["2. Enter this code: ", localData === null || localData === void 0 ? void 0 : localData.code] })), _jsxs("div", Object.assign({ className: "copilot-step" }, { children: ["3. Click here when done: \u00A0", _jsx("button", Object.assign({ onClick: tryFinishSignIn }, { children: "Done" }))] }))] })));
    }
    else if (localState == 'signInFailed') {
        currentPanel = (_jsxs("div", Object.assign({ className: "copilot__signin" }, { children: [_jsx("div", Object.assign({ className: "copilot-welcome-line" }, { children: "Sign in failed. Please try again." })), loading ? (_jsx("p", { children: "Loading..." })) : (_jsx("div", Object.assign({ className: "welcome-button welcome-copilot-sign-in" }, { children: _jsx("button", Object.assign({ onClick: trySignIn }, { children: "Sign in" })) })))] })));
    }
    else {
        posthog.capture('Welcome Screen Copilot Done');
        currentPanel = (_jsx("div", Object.assign({ className: "copilot__signin copilot-welcome-done" }, { children: "Connected!" })));
    }
    return _jsx(_Fragment, { children: currentPanel });
}
export default function ButtonGroup({ plans, onClick, }) {
    const [selected, setSelected] = useState(plans[0]);
    const dispatch = useAppDispatch();
    useEffect(() => {
        onClick(selected);
    }, [selected]);
    return (_jsx("div", Object.assign({ className: "w-full" }, { children: _jsx("div", Object.assign({ className: "" }, { children: _jsxs(RadioGroup, Object.assign({ value: selected, onChange: (plan) => {
                    setSelected(plan);
                } }, { children: [_jsx(RadioGroup.Label, Object.assign({ className: "sr-only" }, { children: "Server size" })), _jsx("div", Object.assign({ className: "" }, { children: plans.map((plan) => (_jsx("div", Object.assign({ className: "inline-block" }, { children: _jsx(RadioGroup.Option, Object.assign({ value: plan, className: ({ active, checked }) => `
                                  ${checked ? 'checked-welcome-radio' : ''}
                                    relative flex welcome-radio cursor-pointer rounded-md px-3 py-3 welcome-radio-butotn mr-2 shadow-md outline-none` }, { children: ({ active, checked }) => (_jsx(_Fragment, { children: _jsxs("div", Object.assign({ className: "flex items-center justify-between w-32" }, { children: [_jsx("div", Object.assign({ className: "flex items-center mr-2" }, { children: _jsx("div", Object.assign({ className: "text-sm" }, { children: _jsx(RadioGroup.Label, Object.assign({ as: "p", className: `font-medium` }, { children: plan.name })) })) })), checked && (_jsx("div", Object.assign({ className: "shrink-0 text-white" }, { children: _jsx(CheckIcon, { className: "h-6 w-6" }) })))] })) })) }), plan.name) }), plan.name))) }))] })) })) })));
}
function CheckIcon(props) {
    return (_jsxs("svg", Object.assign({ viewBox: "0 0 24 24", fill: "none" }, props, { children: [_jsx("circle", { cx: 12, cy: 12, r: 12, fill: "#fff", opacity: "0.2" }), _jsx("path", { d: "M7 13l3 3 7-7", stroke: "#fff", strokeWidth: 1.5, strokeLinecap: "round", strokeLinejoin: "round" })] })));
}
const keyOptions = [
    {
        name: 'Default',
        keybinding: 'none',
    },
    {
        name: 'Vim',
        keybinding: 'vim',
    },
    {
        name: 'Emacs',
        keybinding: 'emacs',
    },
];
export function WelcomeScreen() {
    const dispatch = useAppDispatch();
    const [selectedKeyBinding, setSelectedKeyBinding] = useState('default');
    const keyBindings = [
        { label: 'Default', value: 'default' },
        { label: 'Emacs', value: 'emacs' },
        { label: 'Vim', value: 'vim' },
    ];
    useEffect(() => {
        posthog.capture('Welcome Screen');
    }, []);
    return (_jsx("div", Object.assign({ className: "welcome-screen-container" }, { children: _jsxs("div", Object.assign({ className: "welcome-screen-inner" }, { children: [_jsx("h1", Object.assign({ className: "welcome-screen-title" }, { children: "Welcome" })), _jsxs("div", Object.assign({ className: "key-bindings-section section" }, { children: [_jsx("h2", Object.assign({ className: "key-bindings-title title" }, { children: "Key Bindings" })), _jsx("p", Object.assign({ className: "key-bindings-subheading subheading" }, { children: "Choose your preferred key binding style for the editor." })), _jsx(ButtonGroup, { plans: keyOptions, onClick: (plan) => {
                                dispatch(ss.changeSettings({
                                    keyBindings: plan.keybinding,
                                }));
                            } })] })), _jsxs("div", Object.assign({ className: "copilot-setup-section section" }, { children: [_jsx("h2", Object.assign({ className: "copilot-setup-title title" }, { children: "Optional: Copilot" })), _jsx("p", Object.assign({ className: "key-bindings-subheading subheading" }, { children: "Cursor comes with a built-in Github Copilot integration." })), _jsx(CopilotPanel, {})] })), _jsx("div", Object.assign({ className: "done-button-section" }, { children: _jsx("button", Object.assign({ className: "done-button welcome-button", onClick: () => {
                            posthog.capture('Welcome Screen Continue');
                            dispatch(setIsNotFirstTimeWithSideEffect(null));
                            dispatch(openTutorFolder(null));
                        } }, { children: "Continue" })) }))] })) })));
}
