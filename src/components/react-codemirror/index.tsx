var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
import { jsx as _jsx } from "react/jsx-runtime";
import { useRef, forwardRef, useImperativeHandle } from 'react';
import { useCodeMirror } from './useCodeMirror';
export * from './setup';
export * from './useCodeMirror';
export * from './utils';
export const ReactCodeMirror = forwardRef((props, ref) => {
    const { viewKey, className, value = '', selection, extensions = [], onChange, onStatistics, onCreateEditor, onUpdate, onPostCreate, customDispatch, autoFocus, theme = 'light', height, minHeight, maxHeight, width, minWidth, maxWidth, basicSetup, placeholder, indentWithTab, editable, readOnly, root, initialState, tabId } = props, other = __rest(props, ["viewKey", "className", "value", "selection", "extensions", "onChange", "onStatistics", "onCreateEditor", "onUpdate", "onPostCreate", "customDispatch", "autoFocus", "theme", "height", "minHeight", "maxHeight", "width", "minWidth", "maxWidth", "basicSetup", "placeholder", "indentWithTab", "editable", "readOnly", "root", "initialState", "tabId"]);
    const editor = useRef(null);
    const { state, view, container, setContainer } = useCodeMirror({
        viewKey,
        container: editor.current,
        tabId,
        root,
        value,
        autoFocus,
        theme,
        height,
        minHeight,
        maxHeight,
        width,
        minWidth,
        maxWidth,
        basicSetup,
        placeholder,
        indentWithTab,
        editable,
        readOnly,
        selection,
        onChange,
        onStatistics,
        onCreateEditor,
        onUpdate,
        onPostCreate,
        customDispatch,
        extensions,
        initialState,
    });
    useImperativeHandle(ref, () => ({ editor: editor.current, state: state, view: view }), [editor, container, state, view]);
    // check type of value
    if (typeof value !== 'string') {
        throw new Error(`value must be typeof string but got ${typeof value}`);
    }
    const defaultClassNames = typeof theme === 'string' ? `cm-theme-${theme}` : 'cm-theme';
    return (_jsx("div", Object.assign({ ref: editor, className: `${defaultClassNames}${className ? ` ${className}` : ''}` }, other)));
});
ReactCodeMirror.displayName = 'CodeMirror';
export default ReactCodeMirror;
