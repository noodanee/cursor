import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faClose } from '@fortawesome/free-solid-svg-icons';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { getTab, getFile, getRelativeFilePath } from '../features/selectors';
import { setDraggingTab, stopDraggingTab } from '../features/globalSlice';
import { getIconElement } from './filetree';
import * as gs from '../features/globalSlice';
import * as gt from '../features/globalThunks';
import * as ts from '../features/tools/toolSlice';
import * as gsel from '../features/selectors';
import * as tsel from '../features/tools/toolSelectors';
import { faTableColumns, faTableRows } from '@fortawesome/pro-regular-svg-icons';
import { HoverState } from '../features/window/state';
// Actions needed for this component
// selectTab(tid: number) - select a tab
// closeTab(tid: number) - close a tab
// Selectors needed for this component
// getActiveTabs() - get the list of active tabs
// Objects needed for this component
// Tab - {id: number, name: string, path: string, is_active: boolean}
function Tab({ tid }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(getTab(tid));
    const file = useAppSelector(getFile(tab.fileId));
    let name = tab.isMulti ? 'multifile' : file.name;
    if (!tab.isMulti && !file.saved)
        name += ' *';
    return (_jsx("div", Object.assign({ draggable: "true", onDragStart: (e) => {
            dispatch(setDraggingTab(tid));
        }, onDragEnd: (e) => {
            dispatch(stopDraggingTab(null));
        }, className: `tab ${tab.isActive ? 'tab__is_active' : ''} ${file.deleted == true ? 'tab__is_deleted' : ''}`, onClick: () => {
            dispatch(gs.selectTab(tid));
        } }, { children: _jsxs("div", { children: [_jsx("div", Object.assign({ className: "tab__icon" }, { children: getIconElement(file.name) })), _jsx("div", Object.assign({ className: "tab__name" }, { children: name })), _jsx("div", Object.assign({ className: "tab__close", onClick: (e) => {
                        e.stopPropagation();
                        dispatch(gt.closeTab(tid));
                    } }, { children: _jsx(FontAwesomeIcon, { icon: faClose }) }))] }) })));
}
function TabPath({ tid }) {
    const tab = useAppSelector(getTab(tid));
    const filePath = useAppSelector(getRelativeFilePath(tab.fileId));
    const splitPaths = filePath.split(connector.PLATFORM_DELIMITER);
    const delimeter = '〉';
    return (_jsx(_Fragment, { children: !tab.isMulti && (_jsx("div", Object.assign({ className: "tab__path" }, { children: splitPaths.map((path, i) => (_jsxs("div", Object.assign({ className: "whitespace-nowrap" }, { children: [_jsx("span", { children: path }), i < splitPaths.length - 1 ? (_jsx("span", Object.assign({ className: "ml-4 mr-4", style: { width: '5px' } }, { children: delimeter }))) : null] }), i))) }))) }));
}
export function TabBar({ tabIds, activeTabId = null, }) {
    // Add event listener to translate vertical scroll to horizontal scroll
    const dispatch = useAppDispatch();
    const tabBarRef = useRef(null);
    useEffect(() => {
        const tabBar = tabBarRef.current;
        if (tabBar) {
            tabBar.addEventListener('wheel', (e) => {
                if (e.deltaY !== 0) {
                    e.preventDefault();
                    tabBar.scrollLeft += e.deltaY;
                }
            });
        }
    }, [tabBarRef]);
    const currentPane = useAppSelector(gsel.getCurrentPane);
    const currentTab = useAppSelector(gsel.getCurrentTab(currentPane));
    const leftSideExpanded = useAppSelector(tsel.getLeftSideExpanded);
    const handleExpandLeftSideClick = () => {
        dispatch(ts.expandLeftSide());
    };
    return (_jsxs("div", Object.assign({ className: "window__tabbarcontainer" }, { children: [_jsxs("div", Object.assign({ className: "tabbar", ref: tabBarRef }, { children: [_jsxs("div", Object.assign({ className: "tabs-container flex", ref: tabBarRef }, { children: [!leftSideExpanded && (_jsx("div", Object.assign({ className: " h-full flex items-center justify-center" }, { children: _jsx("button", Object.assign({ className: `leftside__tab opacity-75`, onClick: () => handleExpandLeftSideClick() }, { children: _jsx("div", { children: _jsx("i", { className: "fas fa-chevrons-right" }) }) })) }))), tabIds.map((tabId) => (_jsx(Tab, { tid: tabId }, tabId)))] })), currentPane != null && currentTab != null && (_jsxs("div", Object.assign({ className: "tabbar__hoverbuttons" }, { children: [_jsx("div", Object.assign({ className: "tabbar__hoverbutton", onClick: (e) => {
                                    e.stopPropagation();
                                    dispatch(gs.splitPaneAndOpenFile({
                                        paneId: currentPane,
                                        hoverState: HoverState.Right,
                                    }));
                                } }, { children: _jsx(FontAwesomeIcon, { icon: faTableColumns }) })), _jsx("div", Object.assign({ className: "tabbar__hoverbutton", onClick: (e) => {
                                    e.stopPropagation();
                                    dispatch(gs.splitPaneAndOpenFile({
                                        paneId: currentPane,
                                        hoverState: HoverState.Bottom,
                                    }));
                                } }, { children: _jsx(FontAwesomeIcon, { icon: faTableRows }) }))] })))] })), activeTabId != null ? _jsx(TabPath, { tid: activeTabId }) : null] })));
}
