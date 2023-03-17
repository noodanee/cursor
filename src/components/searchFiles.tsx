import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { Combobox } from '@headlessui/react';
import { getIconElement } from './filetree';
import { openFile } from '../features/globalSlice';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { getRootPath, searchAllFiles } from '../features/selectors';
import { untriggerFileSearch } from '../features/tools/toolSlice';
import { fileSearchTriggered } from '../features/tools/toolSelectors';
export default function SearchFiles() {
    const [selected, setSelected] = useState();
    const [query, setQuery] = useState('');
    const [showing, setShowing] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [results, setResults] = useState([]);
    const [childQuery, setChildQuery] = useState('');
    // const results = useAppSelector(searchFile(query))
    const comboRef = useRef(null);
    if (selectedIndex != 0 && selectedIndex >= results.length) {
        setSelectedIndex(results.length - 1);
    }
    const triggerFileSearchFocus = useAppSelector(fileSearchTriggered);
    console.log('ininintitnitnitnitn', showing);
    const dispatch = useAppDispatch();
    useEffect(() => {
        searchAllFiles(query).then((results) => {
            setResults(results);
            setChildQuery(query);
        });
    }, [query]);
    useEffect(() => {
        if (triggerFileSearchFocus) {
            dispatch(untriggerFileSearch());
            setShowing(true);
            setSelectedIndex(0);
        }
    }, [triggerFileSearchFocus, comboRef.current]);
    // effect for when becomes unfocused
    useEffect(() => {
        if (showing && comboRef.current) {
            comboRef.current.focus();
            const handleBlur = (event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    setTimeout(() => {
                        // setShowing(false)
                    }, 200);
                    //setShowing(false);
                }
            };
            comboRef.current.addEventListener('blur', handleBlur);
            return () => {
                var _a;
                (_a = comboRef.current) === null || _a === void 0 ? void 0 : _a.removeEventListener('blur', handleBlur);
            };
        }
    }, [showing, comboRef.current]);
    useEffect(() => {
        const selectedElement = document.querySelector('.file__line_selected');
        selectedElement === null || selectedElement === void 0 ? void 0 : selectedElement.scrollIntoView({ block: 'center' });
    }, [selectedIndex]); // Only run when selectedIndex changes
    return (_jsx(_Fragment, { children: showing && (_jsx("div", Object.assign({ className: "absolute top-2.5 left-1/2 \n                transform -translate-x-1/2 z-50", style: { display: showing ? 'block' : 'none' }, id: "fileSearchId" }, { children: _jsxs(Combobox, Object.assign({ value: selected, onChange: setSelected }, { children: [_jsx(Combobox.Input, { className: "w-[36rem] bg-neutral-700 rounded-md \n                        text-white py-0.5 px-1 !outline-none", placeholder: 'Search files...', displayValue: (file) => file.filename, onChange: (event) => {
                            setQuery(event.target.value);
                            setSelectedIndex(0);
                        }, onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                // click on the selected item
                                if (results[selectedIndex]) {
                                    dispatch(openFile({
                                        filePath: results[selectedIndex],
                                    }));
                                    setShowing(false);
                                }
                            }
                            if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                if (selectedIndex >= results.length - 1) {
                                    setSelectedIndex(0);
                                }
                                else {
                                    setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
                                }
                            }
                            else if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                if (selectedIndex <= 0) {
                                    setSelectedIndex(results.length - 1);
                                }
                                else {
                                    setSelectedIndex(Math.max(0, selectedIndex - 1));
                                }
                            }
                            else if (e.key === 'Escape') {
                                e.preventDefault();
                                setShowing(false);
                            }
                        }, ref: comboRef }), _jsx(Combobox.Options, Object.assign({ className: "absolute mt-1 max-h-60 w-full \n                        overflow-auto rounded-md bg-neutral-800 border-white \n                        border-opacity-20 border" }, { children: results.map((path, index) => (_jsx(SearchResult, { query: childQuery, path: path, isSelected: index == selectedIndex }, path))) }))] })) }))) }));
}
export function SearchResult({ query, path, isSelected, }) {
    const dispatch = useAppDispatch();
    const rootPath = useAppSelector(getRootPath);
    const iconElement = getIconElement(path);
    // Now paths are relative to the root path
    let splitFilePath = path.split(connector.PLATFORM_DELIMITER);
    let fileName = splitFilePath.pop();
    let precedingPath = splitFilePath
        .join(connector.PLATFORM_DELIMITER)
        .slice(rootPath.length + 1);
    const changeFile = (path) => {
        dispatch(openFile({ filePath: path }));
    };
    let className = 'file__line';
    if (isSelected) {
        className += ' file__line_selected';
    }
    return (_jsxs("div", Object.assign({ className: className, onClick: () => changeFile(path) }, { children: [_jsx("div", Object.assign({ className: "file__icon" }, { children: iconElement })), _jsx("div", Object.assign({ className: "file__name" }, { children: fileName
                    .split(new RegExp(`(${query})`, 'gi'))
                    .map((part, index) => part.toLowerCase() === query.toLowerCase() ? (_jsx("mark", { children: part }, index)) : (_jsx("span", { children: part }, index))) })), _jsx("div", Object.assign({ className: "file__path" }, { children: precedingPath
                    .split(new RegExp(`(${query})`, 'gi'))
                    .map((part, index) => part.toLowerCase() === query.toLowerCase() ? (_jsx("mark", { children: part }, index)) : (_jsx("span", { children: part }, index))) }))] })));
}
