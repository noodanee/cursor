import { useEffect, useState, useMemo, useLayoutEffect } from 'react';
import { EditorState, StateEffect } from '@codemirror/state';
import { indentWithTab } from '@codemirror/commands';
import { EditorView, keymap, placeholder } from '@codemirror/view';
import { basicSetup } from './setup';
import { oneDark } from '@codemirror/theme-one-dark';
import { getStatistics } from './utils';
import { Prec } from '@codemirror/state';
import { getCodeMirrorView, upsertEditor, } from '../../features/codemirror/codemirrorSlice';
import { getViewId } from '../../features/codemirror/codemirrorSelectors';
import { useAppDispatch, useAppSelector } from '../../app/hooks';
export function useCodeMirror(props) {
    const { viewKey, value, selection, tabId, onChange, onStatistics, onCreateEditor, onUpdate, onPostCreate, customDispatch, extensions = [], autoFocus, theme = 'light', height = '', minHeight = '', maxHeight = '', placeholder: placeholderStr = '', width = '', minWidth = '', maxWidth = '', editable = true, readOnly = false, indentWithTab: defaultIndentWithTab = true, basicSetup: defaultBasicSetup = true, root, initialState, } = props;
    const [container, setContainer] = useState();
    const dispatch = useAppDispatch();
    const viewId = useAppSelector(getViewId(tabId));
    const view = useMemo(() => {
        if (viewId) {
            const candidateView = getCodeMirrorView(viewId);
            if (candidateView) {
                return candidateView;
            }
        }
    }, [viewId]);
    const [state, setState] = useState();
    const defaultLightThemeOption = EditorView.theme({
        '&': {
            backgroundColor: '#fff',
        },
    }, {
        dark: false,
    });
    const defaultThemeOption = EditorView.theme({
        '&': {
            height,
            minHeight,
            maxHeight,
            width,
            minWidth,
            maxWidth,
        },
    });
    const updateListener = EditorView.updateListener.of((vu) => {
        if ((vu.selectionSet || vu.docChanged) &&
            typeof onChange === 'function') {
            const doc = vu.state.doc;
            const value = doc.toString();
            onChange(value, vu);
        }
        onStatistics && onStatistics(getStatistics(vu));
    });
    let getExtensions = [updateListener, defaultThemeOption];
    if (defaultIndentWithTab) {
        getExtensions.unshift(keymap.of([indentWithTab]));
    }
    if (defaultBasicSetup) {
        if (typeof defaultBasicSetup === 'boolean') {
            getExtensions.unshift(basicSetup());
        }
        else {
            getExtensions.unshift(basicSetup(defaultBasicSetup));
        }
    }
    if (placeholderStr) {
        getExtensions.unshift(placeholder(placeholderStr));
    }
    switch (theme) {
        case 'light':
            getExtensions.push(defaultLightThemeOption);
            break;
        case 'dark':
            getExtensions.push(oneDark);
            break;
        case 'none':
            break;
        default:
            getExtensions.push(theme);
            break;
    }
    if (editable === false) {
        getExtensions.push(EditorView.editable.of(false));
    }
    if (readOnly) {
        getExtensions.push(Prec.highest(EditorState.readOnly.of(true)));
    }
    if (onUpdate && typeof onUpdate === 'function') {
        getExtensions.push(EditorView.updateListener.of(onUpdate));
    }
    getExtensions = getExtensions.concat(extensions);
    useEffect(() => {
        if (container) {
            if (!view) {
                const config = {
                    doc: value,
                    selection,
                    extensions: getExtensions,
                };
                const fullInitialState = {
                    initialState,
                    config,
                };
                console.log('VIEW', 'Setting new view');
                dispatch(upsertEditor({
                    tabId,
                    editorStateConfig: fullInitialState,
                    useCustomDispatch: true,
                }));
            }
        }
    }, [container, view]);
    useEffect(() => {
        setContainer(props.container);
    }, [props.container]);
    useLayoutEffect(() => {
        if (view && container) {
            console.log('Re-adding view to container');
            container.appendChild(view.dom);
            view.dispatch({
                effects: StateEffect.reconfigure.of(getExtensions),
            });
            onCreateEditor && onCreateEditor(view, view.state);
            // let diagnostics = view.state.field(diagnosticsField)
            // setDiagnostics(view.state, view.state.field(diagnosticsField))
            autoFocus && view.focus();
        }
        return () => {
            (container === null || container === void 0 ? void 0 : container.firstElementChild) &&
                (container === null || container === void 0 ? void 0 : container.removeChild(container.firstElementChild));
        };
    }, [container, view]);
    useEffect(() => () => {
        if (view) {
            console.log('VIEW', 'Not removing editor after view or container changed');
            // Maybe we dont need to do this anymore
            // dispatch(removeEditor({ tabId }))
        }
    }, [view, container]);
    // useEffect(() => {
    //     if (view && state) {
    //         onPostCreate && onPostCreate(view, state)
    //     }
    // }, [view, state])
    useEffect(() => {
        if (autoFocus && view) {
            view.focus();
        }
    }, [autoFocus, view]);
    useEffect(() => {
        if (view) {
            console.log('VIEW', 'Re-dispatching view');
            view.dispatch({
                effects: StateEffect.reconfigure.of(getExtensions),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        theme,
        extensions,
        height,
        minHeight,
        maxHeight,
        width,
        minWidth,
        maxWidth,
        placeholderStr,
        // editable,
        // readOnly,
        defaultIndentWithTab,
        defaultBasicSetup,
        // These always change, so we do not redispatch on them
        // onChange,
        // onUpdate,
        // onPostCreate,
    ]);
    useEffect(() => {
        const currentValue = view ? view.state.doc.toString() : '';
        if (view && value !== currentValue) {
            console.log('resetting value');
            view.dispatch({
                changes: {
                    from: 0,
                    to: currentValue.length,
                    insert: value || '',
                },
            });
        }
    }, [container]);
    return { state, setState, view, container, setContainer };
}
