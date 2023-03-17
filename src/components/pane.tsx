import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
import React, { useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { getPane, getCurrentTab, getDraggingTabId, getTab, } from '../features/selectors';
import { selectPane, moveDraggingTabToPane } from '../features/globalSlice';
import { HoverState } from '../features/window/state';
import { TabBar } from './tabs';
import { Page } from './editor';
import { throttleCallback } from './componentUtils';
import { selectFixesByFileId } from '../features/fixLSP/fixLSPSelectors';
import { fixErrors } from '../features/fixLSP/fixLSPSlice';
// FixErrorsButton component
export function FixErrorsButton({ tabId }) {
    var _a;
    const dispatch = useAppDispatch();
    const fileId = (_a = useAppSelector(getTab(tabId))) === null || _a === void 0 ? void 0 : _a.fileId;
    // use redux selector to get list of errors
    const fixLSPFile = useAppSelector(selectFixesByFileId(fileId));
    // check if list has length greater than 0
    const hasErrors = fixLSPFile == null ? false : fixLSPFile.doDiagnosticsExist;
    console.log('has Errors', hasErrors);
    return (_jsx(_Fragment, { children: hasErrors && (_jsx("button", Object.assign({ onClick: () => {
                // dispatch action to fix errors
                dispatch(fixErrors({ tabId }));
            }, style: {
                color: 'white',
            } }, { children: "Fix Errors" }))) }));
}
export function Pane({ paneId }) {
    const dispatch = useAppDispatch();
    const pane = useAppSelector(getPane(paneId));
    const activeTabId = useAppSelector(getCurrentTab(paneId));
    const draggingTabId = useAppSelector(getDraggingTabId);
    const paneDiv = React.useRef(null);
    const [hoverState, setHoverState] = useState(HoverState.None);
    let paneHoverClassName = 'pane__hover';
    if (hoverState == HoverState.Left)
        paneHoverClassName += ' pane__hover_left';
    if (hoverState == HoverState.Right)
        paneHoverClassName += ' pane__hover_right';
    if (hoverState == HoverState.Top)
        paneHoverClassName += ' pane__hover_top';
    if (hoverState == HoverState.Bottom)
        paneHoverClassName += ' pane__hover_bottom';
    if (hoverState == HoverState.Full)
        paneHoverClassName += ' pane__hover_full';
    function xyToPaneHoverState(x, y) {
        if (!paneDiv.current)
            return HoverState.None;
        let rect = paneDiv.current.getBoundingClientRect();
        let horizMargin = rect.width / 4;
        let vertMargin = rect.height / 4;
        let xInDiv = x - rect.left;
        let yInDiv = y - rect.top;
        if (xInDiv < horizMargin)
            return HoverState.Left;
        if (xInDiv > rect.width - horizMargin)
            return HoverState.Right;
        if (yInDiv < vertMargin)
            return HoverState.Top;
        if (yInDiv > rect.height - vertMargin)
            return HoverState.Bottom;
        return HoverState.Full;
    }
    const isDraggingTabInPane = draggingTabId == null ? false : pane.tabIds.includes(draggingTabId);
    const shouldDrag = pane.tabIds.length > 1 || !isDraggingTabInPane;
    const onDragCallback = (event) => {
        if (shouldDrag) {
            event.preventDefault();
            const newHoverState = xyToPaneHoverState(event.clientX, event.clientY);
            setHoverState(newHoverState);
        }
    };
    const onDropCallback = (event) => {
        if (shouldDrag) {
            event.preventDefault();
            const newHoverState = xyToPaneHoverState(event.clientX, event.clientY);
            dispatch(moveDraggingTabToPane({
                paneId: paneId,
                hoverState: newHoverState,
            }));
            setHoverState(HoverState.None);
        }
    };
    const onDragLeave = (event) => {
        if (shouldDrag) {
            event.preventDefault();
            setHoverState(HoverState.None);
        }
    };
    let paneClass = 'pane';
    if (!pane.isActive)
        paneClass += ' pane__inactive';
    return (_jsxs("div", Object.assign({ className: paneClass, ref: paneDiv }, { children: [_jsx("div", { className: paneHoverClassName, onDragOver: onDragCallback, onDrop: onDropCallback, onDragLeave: onDragLeave }), _jsxs("div", Object.assign({ className: "pane__content", onDragOver: onDragCallback, onDrop: onDropCallback, onDragLeave: onDragLeave, onClick: () => {
                    dispatch(selectPane(paneId));
                } }, { children: [_jsx(TabBar, { tabIds: pane.tabIds, activeTabId: activeTabId !== null && activeTabId !== void 0 ? activeTabId : null }), activeTabId && _jsx(Page, { tid: activeTabId })] }))] })));
}
export function PaneHolder({ paneIds, depth, paneIndex, onClickBorder, width, }) {
    // dragging state
    let [draggingIndex, setDraggingIndex] = useState(null);
    let [widths, setWidths] = useState([1]);
    let paneHolderDiv = React.useRef(null);
    let horiz = depth % 2 == 0;
    let className = horiz ? 'paneholder__horizontal' : 'paneholder__vertical';
    let hasBorder = paneIndex != null && paneIndex > 0;
    let afterClassname = horiz
        ? 'paneholder__vertical_split'
        : 'paneholder__horizontal_split';
    // set document mouse up ahndler
    React.useEffect(() => {
        function handleMouseUp() {
            setDraggingIndex(null);
        }
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, []);
    function initWidths() {
        if (typeof paneIds == 'number') {
            setWidths([1]);
        }
        else {
            setWidths(Array(paneIds.length).fill(1 / paneIds.length));
        }
    }
    // when paneIds changes, reset widths
    React.useEffect(() => {
        initWidths();
    }, [paneIds]);
    // on init, set widths
    React.useEffect(() => {
        initWidths();
    }, []);
    // set mouse move handler
    React.useEffect(() => {
        if (draggingIndex != null) {
            const throttledMouseMove = throttleCallback((event) => {
                if (draggingIndex != null) {
                    event.preventDefault();
                    event.stopPropagation();
                    // adjust the widths
                    let newWidths = [...widths];
                    // get the x coord of the mouse
                    let x = horiz ? event.clientX : event.clientY;
                    // get the x coord within the paneholderdiv
                    let rect = paneHolderDiv.current.getBoundingClientRect();
                    let xInDiv = horiz ? x - rect.left : x - rect.top;
                    // get the percentage of the x coord within the paneholderdiv
                    let clickXPercent = horiz
                        ? xInDiv / rect.width
                        : xInDiv / rect.height;
                    // get the current xpercent of the dragging index - 1
                    let currentLeftXPercent = widths
                        .slice(0, draggingIndex)
                        .reduce((a, b) => a + b, 0);
                    let deltaXPercent = clickXPercent - currentLeftXPercent;
                    newWidths[draggingIndex - 1] += deltaXPercent;
                    newWidths[draggingIndex] -= deltaXPercent;
                    setWidths(newWidths);
                }
            }, 10);
            document.addEventListener('mousemove', throttledMouseMove);
            return () => {
                document.removeEventListener('mousemove', throttledMouseMove);
            };
        }
    }, [draggingIndex]);
    function onChildBorderClick(paneIndex) {
        setDraggingIndex(paneIndex);
    }
    const widthPercent = width != null ? width * 100 + '%' : '100%';
    // need to compensate for border size, located in css
    const widthExpression = hasBorder
        ? 'calc(' + widthPercent + ' - 4px)'
        : widthPercent;
    const styleDict = !horiz
        ? { width: widthExpression }
        : { height: widthExpression };
    return (_jsxs(_Fragment, { children: [hasBorder && (_jsx("div", { className: afterClassname, onMouseDown: () => {
                    if (onClickBorder != null) {
                        onClickBorder(paneIndex);
                    }
                } })), _jsx("div", Object.assign({ className: className, ref: paneHolderDiv, style: styleDict }, { children: typeof paneIds === 'number' ? (_jsx(Pane, { paneId: paneIds })) : (paneIds.map((paneId, newPaneIndex) => (_jsx(PaneHolder, { paneIndex: newPaneIndex, paneIds: paneId, depth: depth + 1, width: widths[newPaneIndex], onClickBorder: onChildBorderClick }, newPaneIndex)))) }))] }));
}
