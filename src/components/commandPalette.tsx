import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { commandK } from '../features/extensions/cmdKUtils';
import cx from 'classnames';
import { splitCurrentPane, } from '../features/globalSlice';
import { HoverState } from '../features/window/state';
import { openFileTree, openSearch, triggerFileSearch, untriggerCommandPalette, untriggerAICommandPalette, } from '../features/tools/toolSlice';
import { toggleSettings } from '../features/settings/settingsSlice';
import { aiCommandPaletteTriggeredSelector, commandPaletteTriggeredSelector, } from '../features/tools/toolSelectors';
import { Combobox } from '@headlessui/react';
import { toggleFeedback } from '../features/logging/loggingSlice';
import { selectFocusedTabId, } from '../features/selectors';
import { getViewId, } from '../features/codemirror/codemirrorSelectors';
import { getCodeMirrorView } from '../features/codemirror/codemirrorSlice';
const commandKey = connector.PLATFORM_META_KEY + '';
const otherCommandIds = [
    'splitPaneRight',
    'splitPaneLeft',
    'splitPaneUp',
    'splitPaneDown',
    // main commands
    'search',
    'searchFiles',
    'settings',
    'fileTree',
    'feedback',
];
const aiCommands = {
    edit: {
        id: 'edit',
        type: 'ai',
        name: 'Edit Selection',
        description: 'Changes the highlighted code',
        hint: 'Changes the highlighted code',
        error: 'Try highlighting code',
        shortcut: [commandKey + 'K'],
        action: (dispatch) => {
            commandK('edit', false, dispatch);
        },
    },
    generate: {
        id: 'generate',
        type: 'ai',
        name: 'Generate',
        description: 'Writes new code',
        hint: 'Writes new code',
        error: 'Try opening a file',
        shortcut: [commandKey + 'K'],
        action: (dispatch) => {
            commandK('generate', false, dispatch);
        },
    },
    freeform: {
        id: 'freeform',
        type: 'ai',
        name: 'Chat',
        hint: 'Answers questions about anything',
        hintFileOpen: 'Answers questions about the current file or anything',
        error: 'Try unhighlighting',
        description: 'Ask a question about the current file or anything',
        shortcut: [commandKey + 'L'],
        action: (dispatch) => {
            commandK('freeform', false, dispatch);
        },
    },
    freeform_select: {
        id: 'freeform_select',
        type: 'ai',
        name: 'Chat Selection',
        hint: 'Answers questions about the highlighted code',
        error: 'Try highlighting code',
        description: 'Ask a question about the current file',
        shortcut: [commandKey + 'L'],
        action: (dispatch) => {
            commandK('freeform', false, dispatch);
        },
    },
};
const splitPaneCommands = {
    splitPaneRight: {
        id: 'splitPaneRight',
        type: 'normal',
        name: 'View: Split Editor Right',
        description: 'Split the current pane to the right',
        action: (dispatch) => {
            dispatch(splitCurrentPane(HoverState.Right));
        },
    },
    splitPaneDown: {
        id: 'splitPaneDown',
        type: 'normal',
        name: 'View: Split Editor Down',
        description: 'Split the current pane downwards',
        action: (dispatch) => {
            dispatch(splitCurrentPane(HoverState.Bottom));
        },
    },
    splitPaneLeft: {
        id: 'splitPaneLeft',
        type: 'normal',
        name: 'View: Split Editor Left',
        description: 'Split the current pane to the left',
        action: (dispatch) => {
            dispatch(splitCurrentPane(HoverState.Left));
        },
    },
    splitPaneUp: {
        id: 'splitPaneUp',
        type: 'normal',
        name: 'View: Split Editor Up',
        description: 'Split the current pane upwards',
        action: (dispatch) => {
            dispatch(splitCurrentPane(HoverState.Top));
        },
    },
};
const mainCommands = {
    search: {
        id: 'search',
        type: 'normal',
        name: 'Search',
        description: 'Exact match/regex match search through the repo',
        shortcut: [commandKey + 'F'],
        action: (dispatch) => {
            dispatch(openSearch());
        },
    },
    searchFiles: {
        id: 'searchFiles',
        type: 'normal',
        name: 'Search Files',
        description: 'Search for a specific file',
        shortcut: [commandKey + 'P'],
        action: (dispatch) => {
            console.log('triggering');
            dispatch(triggerFileSearch());
        },
    },
    settings: {
        id: 'settings',
        type: 'normal',
        name: 'Settings',
        description: 'Open the settings menu',
        shortcut: [commandKey + 'H'],
        action: (dispatch) => {
            dispatch(toggleSettings());
        },
    },
    fileTree: {
        id: 'fileTree',
        type: 'normal',
        name: 'File Tree',
        description: 'Open the file tree',
        action: (dispatch) => {
            dispatch(openFileTree());
        },
    },
    feedback: {
        id: 'feedback',
        type: 'normal',
        name: 'Feedback',
        description: 'Open the feedback form',
        action: (dispatch) => {
            dispatch(toggleFeedback(null));
        },
    },
};
const allCommands = Object.assign(Object.assign(Object.assign({}, aiCommands), splitPaneCommands), mainCommands);
export default function CommandPalettes() {
    const dispatch = useAppDispatch();
    const commandPaletteTriggeredFocus = useAppSelector(commandPaletteTriggeredSelector);
    const commandPaletteCloseTrigger = useCallback(() => dispatch(untriggerCommandPalette()), [dispatch]);
    const aiCommandPaletteTriggeredFocus = useAppSelector(aiCommandPaletteTriggeredSelector);
    const aiCommandPaletteCloseTrigger = useCallback(() => dispatch(untriggerAICommandPalette()), [dispatch]);
    return (_jsxs(_Fragment, { children: [_jsx(InnerCommandPalette, { openingTrigger: commandPaletteTriggeredFocus, aiOnly: false, closeTrigger: commandPaletteCloseTrigger }), _jsx(InnerCommandPalette, { openingTrigger: aiCommandPaletteTriggeredFocus, aiOnly: true, closeTrigger: aiCommandPaletteCloseTrigger })] }));
}
const useAIResults = () => {
    const tabId = useAppSelector(selectFocusedTabId);
    const viewId = useAppSelector(getViewId(tabId));
    const view = useMemo(() => viewId && getCodeMirrorView(viewId), [viewId]);
    const selection = view && view.state.selection.main;
    const [results, setResults] = useState([]);
    useEffect(() => {
        if (!viewId) {
            setResults([
                { id: 'freeform', clickable: true },
                { id: 'edit', clickable: false },
                { id: 'generate', clickable: false },
                { id: 'freeform_select', clickable: false },
            ]);
        }
        else {
            // This only needs to be done once when opened
            if (selection == null || selection == 0) {
                // In this case there is no tab open
                setResults([
                    { id: 'freeform', clickable: true },
                    { id: 'edit', clickable: false },
                    { id: 'generate', clickable: false },
                    { id: 'freeform_select', clickable: false },
                ]);
            }
            else if (selection.from == selection.to) {
                // Tab open but no selection
                setResults([
                    { id: 'generate', clickable: true },
                    { id: 'freeform', clickable: true },
                    { id: 'edit', clickable: false },
                    { id: 'freeform_select', clickable: false },
                ]);
            }
            else {
                // Tab open and selection
                setResults([
                    { id: 'edit', clickable: true },
                    { id: 'freeform_select', clickable: true },
                    { id: 'freeform', clickable: false },
                    { id: 'generate', clickable: false },
                ]);
            }
        }
    }, [selection]);
    return { results };
};
export function InnerCommandPalette({ openingTrigger, closeTrigger, aiOnly, }) {
    const [selected, setSelected] = useState();
    const [query, setQuery] = useState('');
    const [showing, setShowing] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const comboBtn = useRef(null);
    const comboOptionsRef = useRef(null);
    const dispatch = useAppDispatch();
    const { results: aiResults } = useAIResults();
    const otherResults = useMemo(() => aiOnly
        ? []
        : otherCommandIds.map((cid) => ({ id: cid, clickable: null })), [aiOnly]);
    const filteredResults = useMemo(() => {
        return [...aiResults, ...otherResults].filter((obj) => {
            return allCommands[obj.id].name
                .toLowerCase()
                .includes(query.toLowerCase());
        });
    }, [query, aiResults, otherResults]);
    const comboRef = useRef(null);
    const fullComboRef = useRef(null);
    useEffect(() => {
        if (selectedIndex != 0 && selectedIndex >= filteredResults.length) {
            setSelectedIndex(filteredResults.length - 1);
        }
    }, [selectedIndex, filteredResults]);
    useEffect(() => {
        if (openingTrigger) {
            setShowing(true);
            setSelectedIndex(0);
        }
        else {
            setShowing(false);
        }
    }, [openingTrigger]);
    // effect for when becomes unfocused
    useEffect(() => {
        if (showing &&
            comboRef.current &&
            comboBtn.current &&
            fullComboRef.current) {
            comboRef.current.focus();
            const handleBlur = (event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    // This is here in order to prevent the command palette from
                    // immediately closing when the user clicks on a command
                    setTimeout(() => {
                        setShowing(false);
                        closeTrigger();
                        setQuery('');
                    }, 100);
                    //setShowing(false);
                }
                else {
                }
            };
            // click the hidden combo button
            // check if the combo button
            // Check comboOptionsRef
            if (!comboOptionsRef.current)
                comboBtn.current.click();
            comboRef.current.addEventListener('blur', handleBlur);
            return () => {
                var _a;
                (_a = comboRef.current) === null || _a === void 0 ? void 0 : _a.removeEventListener('blur', handleBlur);
            };
        }
    }, [showing, comboRef.current, comboBtn.current]);
    useEffect(() => {
        const selectedElement = document.querySelector('.file__line_selected');
        selectedElement === null || selectedElement === void 0 ? void 0 : selectedElement.scrollIntoView({ block: 'center' });
    }, [selectedIndex]); // Only run when selectedIndex changes
    const keyDownHandler = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // click on the selected item
            if (filteredResults[selectedIndex]) {
                closeTrigger();
                allCommands[filteredResults[selectedIndex].id].action(dispatch);
                setQuery('');
            }
        }
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (selectedIndex >= filteredResults.length - 1) {
                setSelectedIndex(0);
            }
            else {
                setSelectedIndex(Math.min(selectedIndex + 1, filteredResults.length - 1));
            }
        }
        else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (selectedIndex <= 0) {
                setSelectedIndex(filteredResults.length - 1);
            }
            else {
                setSelectedIndex(Math.max(0, selectedIndex - 1));
            }
        }
        else if (e.key === 'Escape') {
            e.preventDefault();
            closeTrigger();
        }
    }, [selectedIndex, filteredResults, dispatch, setQuery]);
    // console.log('AI ONLY', aiOnly)
    // console.log('Showing', openingTrigger)
    // console.log('state showing', showing)
    return (_jsx(_Fragment, { children: openingTrigger && (_jsx("div", Object.assign({ className: "absolute top-2.5 left-1/2 \n                transform -translate-x-1/2 z-50", style: { display: showing ? 'block' : 'none' }, id: "fileSearchId" }, { children: _jsx(Combobox, Object.assign({ value: selected, onChange: setSelected }, { children: _jsxs("div", Object.assign({ ref: fullComboRef }, { children: [_jsx(Combobox.Input, { className: "w-[36rem] bg-neutral-700 rounded-md \n                        text-white py-0.5 px-1 !outline-none", placeholder: "Enter command...", displayValue: (command) => command.name, onChange: (event) => {
                                setQuery(event.target.value);
                                setSelectedIndex(0);
                            }, onKeyDown: keyDownHandler, ref: comboRef }), _jsx(Combobox.Button, { className: "hidden", ref: comboBtn }), _jsx(Combobox.Options, Object.assign({ className: "absolute mt-1 w-full \n                        overflow-auto rounded-md bg-neutral-800 z-[50] command_result_area", ref: comboOptionsRef }, { children: filteredResults.map((obj, index) => {
                                const command = allCommands[obj.id];
                                let toret = null;
                                if (obj.clickable === null) {
                                    toret = (_jsx(CommandResult, { command: command, query: query, closeTrigger: closeTrigger, isSelected: index == selectedIndex }, command.id));
                                }
                                else {
                                    toret = (_jsx(AICommandResult, { command: command, query: query, isClickable: obj.clickable, closeTrigger: closeTrigger, isSelected: index == selectedIndex }, command.id));
                                }
                                return (_jsx("div", Object.assign({ onMouseEnter: () => {
                                        // set selected index
                                        setSelectedIndex(index);
                                    } }, { children: toret })));
                            }) }))] })) })) }))) }));
}
export function CommandResult({ command, query, isSelected, closeTrigger, }) {
    var _a;
    const dispatch = useAppDispatch();
    const executeCommand = useCallback((e) => {
        closeTrigger();
        command.action(dispatch);
        e.stopPropagation();
    }, [dispatch, command]);
    return (_jsxs("div", Object.assign({ className: cx('command_line', { selected_command: isSelected }), onClick: executeCommand }, { children: [_jsx("div", Object.assign({ className: "file__name" }, { children: command.name
                    .split(new RegExp(`(${query})`, 'gi'))
                    .map((part, index) => part.toLowerCase() === query.toLowerCase() ? (_jsx("mark", { children: part }, index)) : (_jsx("span", { children: part }, index))) })), command.hint && (_jsx("div", Object.assign({ className: "text-xs text-white truncate flex items-end mb-0.5" }, { children: command.hint }))), _jsx("div", Object.assign({ className: "file__shortcuts ml-auto whitespace-nowrap" }, { children: (_a = command.shortcut) === null || _a === void 0 ? void 0 : _a.map((key, index) => (_jsx("div", Object.assign({ className: "shortcut__block rounded-md p-0.5 text-center text-sm text-gray-400 mr-1 inline-block min-w-[25px]" }, { children: key }), index))) }))] })));
}
export function AICommandResult({ command, query, isClickable, isSelected, closeTrigger, }) {
    var _a;
    const dispatch = useAppDispatch();
    const executeCommand = useCallback((e) => {
        if (isClickable) {
            closeTrigger();
            command.action(dispatch);
        }
        e.stopPropagation();
    }, [dispatch, command]);
    const dummyCommand = () => null;
    const clickable = isClickable;
    return (_jsxs("div", Object.assign({ className: cx('command_line', 'ai_command_result', { selected_command: isSelected }, { disabled_command: !clickable }), onMouseDown: clickable ? executeCommand : dummyCommand }, { children: [_jsx("div", Object.assign({ className: cx('file__name') }, { children: command.name
                    .split(new RegExp(`(${query})`, 'gi'))
                    .map((part, index) => part.toLowerCase() === query.toLowerCase() ? (_jsx("mark", { children: part }, index)) : (_jsx("span", { children: part }, index))) })), clickable
                ? command.hint && (_jsx("div", Object.assign({ className: "file__path" }, { children: command.hint })))
                : command.error && (_jsx("div", Object.assign({ className: "file__path" }, { children: command.error }))), _jsx("div", Object.assign({ className: "file__shortcuts ml-auto whitespace-nowrap" }, { children: (_a = command.shortcut) === null || _a === void 0 ? void 0 : _a.map((key, index) => (_jsx("div", Object.assign({ className: "shortcut__block bg-gray-800 rounded-md p-0.5 text-center text-sm text-gray-400 mr-1 inline-block min-w-[25px]" }, { children: key }), index))) }))] })));
}
