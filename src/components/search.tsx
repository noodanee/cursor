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
import { useState, useRef, useEffect, useCallback } from 'react';
import { FileTree, getIconElement } from './filetree';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faChevronRight, faArrowRightLong, } from '@fortawesome/sharp-solid-svg-icons';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { getLeftTab, getLeftTabActive } from '../features/tools/toolSelectors';
import { leftTabInactive, openFileTree, openSearch, collapseLeftSide, } from '../features/tools/toolSlice';
import { updateFeedbackMessage, sendFeedbackMessage, toggleFeedback, } from '../features/logging/loggingSlice';
import { getFeedbackMessage, getIsOpen, } from '../features/logging/loggingSelectors';
import { openFile } from '../features/globalSlice';
import { getRootPath } from '../features/selectors';
import _ from 'lodash';
import Modal from 'react-modal';
export function FeedbackArea() {
    const dispatch = useAppDispatch();
    const feedbackMessage = useAppSelector(getFeedbackMessage);
    const isOpen = useAppSelector(getIsOpen);
    const textareaRef = useRef(null);
    const handleTextareaChange = (e) => {
        // Set the query state to the textarea value
        dispatch(updateFeedbackMessage(e.target.value.toString()));
        // Adjust the textarea height based on the scroll height
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
            textareaRef.current.scrollHeight + 'px';
    };
    const placeholders = [
        'Least favorite thing about Cursor...',
        'Favorite thing about Cursor is...',
        'What would you like to see in Cursor?',
        'What should we fix about Cursor?',
    ];
    const randomPlaceholder = placeholders[Math.floor(Math.random() * placeholders.length)];
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
            right: '40px',
            left: 'none',
            width: '300px',
        },
    };
    return (_jsx(_Fragment, { children: _jsx(Modal, Object.assign({ isOpen: isOpen, onRequestClose: () => {
                dispatch(toggleFeedback(null));
            }, style: customStyles }, { children: _jsxs("div", Object.assign({ className: "feedbackarea" }, { children: [_jsx("textarea", { className: "search-textarea w-full", autoFocus: true, value: feedbackMessage, placeholder: 'Tell us anything! E.g. ' + randomPlaceholder, onChange: handleTextareaChange, onKeyDown: (e) => {
                            if (e.key === 'Enter') {
                                dispatch(sendFeedbackMessage(null));
                                e.preventDefault();
                                return;
                            }
                        }, ref: textareaRef }), _jsx("div", Object.assign({ className: "feedbackarea_button", onClick: () => {
                            dispatch(sendFeedbackMessage(null));
                        } }, { children: _jsx(FontAwesomeIcon, { icon: faArrowRightLong }) }))] })) })) }));
}
// A simple functional react component that houses a number of different tabs
export const LeftSide = () => {
    // A state variable to keep track of the active tab
    const activeTab = useAppSelector(getLeftTab);
    const dispatch = useAppDispatch();
    // A function to handle tab switching
    const handleTabClick = (tabName) => {
        if (tabName == 'search') {
            dispatch(openSearch());
        }
        else if (tabName == 'filetree') {
            dispatch(openFileTree());
        }
    };
    const handleCollapseClick = () => {
        dispatch(leftTabInactive());
        dispatch(collapseLeftSide());
    };
    // A function to render the content of the active tab
    const renderTabContent = () => {
        switch (activeTab) {
            case 'search':
                return _jsx(SearchComponent, {});
            case 'filetree':
                return _jsx(FileTree, {});
            default:
                return null;
        }
    };
    return (_jsxs("div", Object.assign({ className: "w-full h-full leftside" }, { children: [_jsxs("div", Object.assign({ className: "flex h-12 relative justify-center items-center leftside-icon-bar mb-2" }, { children: [_jsxs("div", Object.assign({ className: "tabs leftside__tabs" }, { children: [_jsx("button", Object.assign({ className: `leftside__tab ${activeTab === 'filetree' ? 'active' : ''}`, onClick: () => handleTabClick('filetree') }, { children: _jsx("div", { children: _jsx("i", { className: "fas fa-folder" }) }) })), _jsx("button", Object.assign({ className: `leftside__tab ${activeTab === 'search' ? 'active' : ''}`, onClick: () => handleTabClick('search') }, { children: _jsx("div", { children: _jsx("i", { className: "fas fa-search" }) }) }))] })), _jsx("div", Object.assign({ className: "tabs leftside__tabs absolute right-0 opacity-60" }, { children: _jsx("button", Object.assign({ className: "leftside__tab leftside__tab_collapse", onClick: () => handleCollapseClick() }, { children: _jsx("div", { children: _jsx("i", { className: "fas fa-chevrons-left" }) }) })) }))] })), _jsxs("div", Object.assign({ className: "leftside__filetree_container" }, { children: [renderTabContent(), _jsx("div", { className: "cover-bar" })] }))] })));
};
const handleSearch = (query, setResults, rootPath) => __awaiter(void 0, void 0, void 0, function* () {
    if (query == '') {
        setResults([]);
        return;
    }
    // @ts-ignore
    connector
        .searchRipGrep({
        query: query,
        rootPath: rootPath,
        badPaths: [],
        caseSensitive: false,
    })
        .then((out) => {
        if (out.length == 0) {
            setResults([]);
            return;
        }
        let newResults = [
            ...out.map((result) => JSON.parse(result)),
        ];
        let fileLevelResultsMap = new Map();
        for (let result of newResults) {
            let filePath = result.data.path.text;
            if (!fileLevelResultsMap.has(filePath)) {
                fileLevelResultsMap.set(filePath, { filePath, results: [] });
            }
            let fileLevelResult = fileLevelResultsMap.get(filePath);
            fileLevelResult.results.push(result);
        }
        let newestResults = [...fileLevelResultsMap.values()];
        setResults(newestResults);
        if (newestResults.length != 0) {
            let firstResult = newestResults[0].results[0];
            let start = firstResult.data.submatches[0].start;
            let end = firstResult.data.submatches[0].end;
        }
    });
});
// A simple functional react component that performs a search and displays the results
function SearchComponent() {
    // A state variable to store the search query
    const [query, setQuery] = useState('');
    const leftTabActive = useAppSelector(getLeftTabActive);
    const dispatch = useAppDispatch();
    const rootPath = useAppSelector(getRootPath);
    // A state variable to store the search results
    const [results, setResults] = useState([]);
    const throttledSearch = useCallback(_.debounce((q, sr) => {
        handleSearch(q, sr, rootPath);
    }, 250), [setResults]);
    // A ref variable to access the textarea element
    const textareaRef = useRef(null);
    useEffect(() => {
        if (leftTabActive && textareaRef.current) {
            textareaRef.current.focus();
            // select all the text
            textareaRef.current.setSelectionRange(0, textareaRef.current.value.length);
            dispatch(leftTabInactive());
        }
    }, [leftTabActive, textareaRef.current]);
    useEffect(() => {
        throttledSearch(query, setResults);
    }, [query]);
    // A function to handle the change of the textarea value
    const handleTextareaChange = (e) => {
        // Set the query state to the textarea value
        setQuery(e.target.value);
        // Adjust the textarea height based on the scroll height
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height =
            textareaRef.current.scrollHeight + 'px';
    };
    return (_jsxs("div", Object.assign({ className: "window__leftpane colortheme p-5" }, { children: [_jsx("div", Object.assign({ className: "search-bar" }, { children: _jsx("textarea", { className: "search-textarea w-full", value: query, onChange: handleTextareaChange, onKeyDown: (e) => {
                        if (e.key === 'Enter') {
                            throttledSearch(query, setResults);
                            e.preventDefault();
                            return;
                        }
                    }, ref: textareaRef }) })), _jsxs("div", Object.assign({ className: "search-results" }, { children: [results.length === 0 && _jsx("div", { children: "No results found" }), (() => {
                        // console.log('mapping results', results)
                        return results.map((result) => (_jsx(FileResultComponent, { result: result }, result.filePath)));
                    })()] }))] })));
}
function FileResultComponent({ result }) {
    // Use a state variable to track the visibility of the line results
    const [showLineResults, setShowLineResults] = useState(true);
    const iconElement = getIconElement(result.filePath);
    const rootPath = useAppSelector((state) => state.global.rootPath);
    let splitFilePath = result.filePath.split(connector.PLATFORM_DELIMITER);
    let fileName = splitFilePath.pop();
    let precedingPath = splitFilePath
        .join(connector.PLATFORM_DELIMITER)
        .slice(rootPath.length + 1);
    // Use a function to toggle the visibility of the line results
    function toggleLineResults() {
        setShowLineResults(!showLineResults);
    }
    return (_jsxs("div", Object.assign({ className: "search-result text-white" }, { children: [_jsxs("div", Object.assign({ className: "folder__line", onClick: toggleLineResults }, { children: [_jsx("div", Object.assign({ className: "folder__icon" }, { children: showLineResults ? (_jsx(FontAwesomeIcon, { icon: faChevronDown })) : (_jsx(FontAwesomeIcon, { icon: faChevronRight })) })), _jsx("div", Object.assign({ className: "file__icon" }, { children: iconElement })), _jsx("div", Object.assign({ className: "folder__name truncate shrink-0" }, { children: fileName })), _jsx("div", Object.assign({ className: "smallPath truncate text-gray-500" }, { children: precedingPath }))] })), showLineResults && (_jsx("div", Object.assign({ className: "folder__below" }, { children: [...result.results.entries()].map(([idx, result]) => (_jsx(LineResultComponent, { result: result }, idx))) })))] })));
}
function LineResultComponent({ result }) {
    let line = result.data.lines.text;
    let start = result.data.submatches[0].start;
    let end = result.data.submatches[0].end;
    const dispatch = useAppDispatch();
    return (_jsx("div", Object.assign({ className: "folder__line pl-10", onClick: () => dispatch(openFile({
            filePath: result.data.path.text,
            selectionRegions: [
                {
                    start: {
                        // we use 0-indexing for line numbers here
                        line: result.data.line_number - 1,
                        character: start,
                    },
                    end: {
                        // we use 0-indexing for line numbers here
                        line: result.data.line_number - 1,
                        character: end,
                    },
                },
            ],
        })) }, { children: _jsxs("div", Object.assign({ className: "filename truncate" }, { children: [line.slice(0, start), _jsx("span", Object.assign({ className: "highlight-search" }, { children: line.slice(start, end) })), line.slice(end)] })) })));
}
function useCache(arg0) {
    throw new Error('Function not implemented.');
}
