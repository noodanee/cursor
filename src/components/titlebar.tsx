import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import * as gs from '../features/globalSlice';
import * as gt from '../features/globalThunks';
import * as cs from '../features/chat/chatSlice';
import * as ss from '../features/settings/settingsSlice';
import * as ls from '../features/logging/loggingSlice';
import * as ts from '../features/tools/toolSlice';
import * as csel from '../features/chat/chatSelectors';
import * as gsel from '../features/selectors';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { useEffect, useState } from 'react';
import SearchFiles from './searchFiles';
import CommandPalette from './commandPalette';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCog, faHandWave, faMinus, faSquare, faTimes, faRobot, } from '@fortawesome/pro-regular-svg-icons';
function Menu({ title, options, open, onClick, }) {
    return (_jsxs("div", Object.assign({ className: "menu", onClick: onClick }, { children: [title, open && (_jsx("div", Object.assign({ className: "menu__options" }, { children: options.map(([action, callback, accelerator], index) => (_jsxs("div", Object.assign({ className: "menu__option", onClick: callback }, { children: [action, accelerator && (_jsx("div", Object.assign({ className: "menu__option__accelerator" }, { children: accelerator })))] }), index))) })))] })));
}
function MenuBar() {
    const dispatch = useAppDispatch();
    const [openMenu, setOpenMenu] = useState(-1);
    // if theres a click somewhere off screen
    useEffect(() => {
        const handleClick = (e) => {
            if (e.target instanceof HTMLElement) {
                if (!e.target.closest('.menuGroup')) {
                    setOpenMenu(-1);
                }
            }
        };
        window.addEventListener('click', handleClick);
        return () => {
            window.removeEventListener('click', handleClick);
        };
    }, []);
    return (_jsxs("div", Object.assign({ className: "menuGroup" }, { children: [_jsx(Menu, { title: "File", options: [
                    [
                        'New File',
                        () => {
                            dispatch(gs.newFile({ parentFolderId: null }));
                        },
                        connector.PLATFORM_META_KEY + 'N',
                    ],
                    [
                        'Open Folder',
                        () => {
                            dispatch(gs.openFolder(null));
                        },
                        connector.PLATFORM_META_KEY + 'O',
                    ],
                    [
                        'Open Remote Folder',
                        () => {
                            dispatch(gs.openRemotePopup(null));
                        },
                    ],
                    [
                        'Save File',
                        () => {
                            dispatch(gs.saveFile(null));
                        },
                        connector.PLATFORM_META_KEY + 'S',
                    ],
                    [
                        'Close Tab',
                        () => {
                            dispatch(gt.closeTab(null));
                        },
                        connector.PLATFORM_META_KEY + 'W',
                    ],
                ], open: openMenu === 0, onClick: () => {
                    if (openMenu !== 0)
                        setOpenMenu(0);
                    else
                        setOpenMenu(-1);
                } }), _jsx(Menu, { title: "Edit", options: [
                    [
                        'Cut',
                        () => {
                            document.execCommand('cut');
                        },
                        connector.PLATFORM_META_KEY + 'X',
                    ],
                    [
                        'Copy',
                        () => {
                            document.execCommand('copy');
                        },
                        connector.PLATFORM_META_KEY + 'C',
                    ],
                    [
                        'Paste',
                        () => {
                            document.execCommand('paste');
                        },
                        connector.PLATFORM_META_KEY + 'V',
                    ],
                    [
                        'Select All',
                        () => {
                            document.execCommand('selectAll');
                        },
                        connector.PLATFORM_META_KEY + 'A',
                    ],
                ], open: openMenu === 1, onClick: () => {
                    if (openMenu !== 1)
                        setOpenMenu(1);
                    else
                        setOpenMenu(-1);
                } }), _jsx(Menu, { title: "View", options: [
                    [
                        'Zoom In',
                        () => {
                            connector.zoomIn();
                        },
                        connector.PLATFORM_META_KEY + 'plus',
                    ],
                    [
                        'Zoom Out',
                        () => {
                            connector.zoomOut();
                        },
                        connector.PLATFORM_META_KEY + 'minus',
                    ],
                    [
                        'Reset Zoom',
                        () => {
                            connector.zoomReset();
                        },
                        connector.PLATFORM_META_KEY + '0',
                    ],
                    [
                        'Search',
                        () => {
                            dispatch(ts.openSearch());
                        },
                        connector.PLATFORM_META_KEY + 'shift+f',
                    ],
                    [
                        'File Search',
                        () => {
                            dispatch(ts.triggerFileSearch());
                        },
                        connector.PLATFORM_META_KEY + 'p',
                    ],
                    [
                        'Command Palette',
                        () => {
                            dispatch(ts.triggerCommandPalette());
                        },
                        connector.PLATFORM_META_KEY + 'shift+p',
                    ],
                ], open: openMenu === 2, onClick: () => {
                    if (openMenu !== 2)
                        setOpenMenu(2);
                    else
                        setOpenMenu(-1);
                } })] })));
}
function WindowsFrameButtons() {
    const dispatch = useAppDispatch();
    return (_jsxs("div", Object.assign({ className: "windows__framebuttons" }, { children: [_jsx("div", Object.assign({ className: "titlebar__right_button", onClick: () => {
                    connector.minimize();
                } }, { children: _jsx(FontAwesomeIcon, { icon: faMinus }) })), _jsx("div", Object.assign({ className: "titlebar__right_button", onClick: () => {
                    connector.maximize();
                } }, { children: _jsx(FontAwesomeIcon, { icon: faSquare }) })), _jsx("div", Object.assign({ className: "titlebar__right_button windows__closebutton", onClick: () => {
                    connector.close();
                } }, { children: _jsx(FontAwesomeIcon, { icon: faTimes }) }))] })));
}
export function TitleBar({ titleHeight, useButtons = true, }) {
    const dispatch = useAppDispatch();
    const generating = useAppSelector(csel.getGenerating);
    const appVersion = useAppSelector(gsel.getVersion);
    const [isWindows, setIsWindows] = useState(false);
    useEffect(() => {
        connector.getPlatform().then((platform) => {
            setIsWindows(platform !== 'darwin');
        });
    }, []);
    return (_jsxs("div", Object.assign({ className: "titlebar", style: { height: titleHeight }, onDoubleClick: () => connector.maximize() }, { children: [_jsx(SearchFiles, {}), _jsx(CommandPalette, {}), _jsxs("div", Object.assign({ className: "titleOnTitleBar" }, { children: ["Cursor - v", appVersion] })), _jsxs("div", Object.assign({ className: "titlebar__left" }, { children: [isWindows && _jsx(MenuBar, {}), _jsx("div", { className: "titlebar__left_rest" })] })), useButtons && (_jsxs("div", Object.assign({ className: "titlebar__right", onDoubleClick: (e) => {
                    // Prevent double click from triggering maximize
                    e.stopPropagation();
                } }, { children: [generating && (_jsx("div", Object.assign({ className: "titlebar__right_button_spinner" }, { children: _jsx("div", { className: "loader" }) }))), generating && (_jsxs("div", Object.assign({ className: "titlebar__right_button_with_text", onClick: () => {
                            dispatch(cs.interruptGeneration(null));
                        } }, { children: ["Cancel", _jsxs("span", Object.assign({ className: "titlebar-shortcut-span" }, { children: [connector.PLATFORM_META_KEY, "\u232B"] }))] }))), _jsx("div", Object.assign({ className: "titlebar__ai_button", onClick: () => {
                            dispatch(ts.triggerAICommandPalette());
                        } }, { children: _jsx(FontAwesomeIcon, { icon: faRobot }) })), _jsx("div", Object.assign({ className: "titlebar__right_button", onClick: () => {
                            dispatch(ls.toggleFeedback(null));
                        } }, { children: _jsx(FontAwesomeIcon, { icon: faHandWave }) })), _jsx("div", Object.assign({ className: "titlebar__right_button", onClick: () => {
                            dispatch(ss.toggleSettings());
                        } }, { children: _jsx(FontAwesomeIcon, { icon: faCog }) }))] }))), _jsx("div", { className: "titlebar__right_filler" }), isWindows && _jsx(WindowsFrameButtons, {})] })));
}
