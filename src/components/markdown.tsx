var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useRef, useEffect, useState, useCallback, } from 'react';
import cx from 'classnames';
import { ActionTips } from '../app/constants';
import { faClose, } from '@fortawesome/pro-regular-svg-icons';
import { getIconElement } from '../components/filetree';
import * as gs from '../features/globalSlice';
import { EditorView, highlightActiveLine, highlightActiveLineGutter, lineNumbers, } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
import { languages } from '@codemirror/language-data';
import { useAppSelector, useAppDispatch } from '../app/hooks';
import { syntaxBundle } from '../features/extensions/syntax';
import { getFilePath, getFile, getFolderPath, getCurrentFilePath, } from '../features/selectors';
import { ContextBuilder } from '../features/chat/context';
import * as csel from '../features/chat/chatSelectors';
import { removeBeginningAndEndingLineBreaks } from '../utils';
import ReactMarkdown from 'react-markdown';
import { diffExtension, setDiff, } from '../features/extensions/diff';
import * as cs from '../features/chat/chatSlice';
import { vscodeDark } from '../vscodeTheme';
import { vim } from './codemirror-vim';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy } from '@fortawesome/sharp-solid-svg-icons';
import ReactTextareaAutocomplete from '@webscopeio/react-textarea-autocomplete';
import Modal from 'react-modal';
export function CodeBlock({ children, className = '', startLine = null, setDiffArgs = null, isEditable = false, copyable = true, }) {
    // Extract the language name from the className
    const dispatch = useAppDispatch();
    const [codeButton, setCodeButton] = useState(false);
    let language;
    if (children == null) {
        return _jsx(_Fragment, { children: " " });
    }
    else if (Array.isArray(children)) {
        children = children[0];
    }
    if (className == '') {
        language = 'plaintext';
    }
    else {
        language = className.replace('language-', '');
    }
    const ref = useRef(null);
    const viewRef = useRef(null);
    const [blockStarted, setBlockStarted] = useState(false);
    useEffect(() => {
        var _a;
        const startBlock = () => __awaiter(this, void 0, void 0, function* () {
            if (ref.current) {
                // Find the language mode from the Codemirror language data
                const langPackage = languages.find((lang) => lang.name.toLowerCase() == language.toLowerCase());
                let extension;
                if (langPackage == null) {
                    extension = [];
                }
                else {
                    extension = yield langPackage.load();
                }
                // Create the editor state with the code value, language mode, and theme
                const toset = removeBeginningAndEndingLineBreaks(children.trimEnd());
                const state = EditorState.create({
                    // doc: (children as string).trim(),
                    doc: toset,
                    extensions: [
                        diffExtension,
                        startLine == null
                            ? []
                            : lineNumbers({
                                formatNumber: (n, state) => String(n + startLine),
                            }),
                        EditorView.editable.of(isEditable),
                        isEditable
                            ? [
                                vim(),
                                highlightActiveLine(),
                                highlightActiveLineGutter(),
                            ]
                            : [],
                        yield syntaxBundle(`text.${language}`),
                        extension,
                        vscodeDark,
                        EditorView.lineWrapping,
                    ],
                });
                // Create the editor view and attach it to the ref
                const view = new EditorView({
                    state,
                    parent: ref.current,
                });
                viewRef.current = view;
                if (setDiffArgs != null) {
                    setDiff(Object.assign({ origText: view.state.doc, diffId: '1' }, setDiffArgs), true)(view);
                }
                // Return a cleanup function to destroy the view
                return () => view.destroy();
            }
        });
        if (className != '' && viewRef.current == null) {
            setCodeButton(true);
            startBlock();
            setBlockStarted(true);
        }
        else if (children !== '' && !blockStarted) {
            setCodeButton(false);
            // append a code span to div ref
            const codeSpan = document.createElement('span');
            codeSpan.className = 'code__span';
            codeSpan.innerText = removeBeginningAndEndingLineBreaks(children);
            (_a = ref.current) === null || _a === void 0 ? void 0 : _a.appendChild(codeSpan);
        }
    }, [className, setDiffArgs]);
    useEffect(() => {
        if (viewRef.current) {
            viewRef.current.dispatch({
                changes: {
                    from: 0,
                    to: viewRef.current.state.doc.length,
                    insert: children,
                },
            });
        }
    }, [children]);
    // Return a div element with the ref
    if (!codeButton || !copyable) {
        if (className == '')
            return _jsx("div", { className: "codeblock", ref: ref });
        else
            return _jsx("div", { className: "codeblock result-codeblock", ref: ref });
    }
    else {
        return (_jsx(_Fragment, { children: _jsxs("div", Object.assign({ className: "codeblockwrapper" }, { children: [_jsx("button", Object.assign({ className: "copyButton", onClick: () => {
                            if (viewRef.current) {
                                navigator.clipboard.writeText(viewRef.current.state.doc.toString());
                            }
                        } }, { children: _jsx(FontAwesomeIcon, { icon: faCopy }) })), _jsx("div", { className: "codeblock display_text_wrapping", ref: ref })] })) }));
    }
}
export function CommandBarActionTips(props) {
    var _a;
    return (_jsx("div", Object.assign({ className: cx('flex space-x-2', {
            'justify-start': (_a = props.align) !== null && _a !== void 0 ? _a : 'left' === 'left',
            'justify-end': props.align === 'right',
        }) }, { children: props.tips.map(([name, tip, icon, callback]) => (_jsx("div", Object.assign({ className: "text-neutral-400 text-xs my-1 history-tip-icon-container", onClick: (e) => {
                e.preventDefault();
                callback();
            } }, { children: _jsx(FontAwesomeIcon, { className: "history-tip-icon", icon: icon }) }), `${name}-${tip}`))) })));
}
export function ChatPopup() {
    const dispatch = useAppDispatch();
    const isGenerating = useAppSelector((state) => state.chatState.generating);
    const isChatOpen = useAppSelector(csel.isChatOpen);
    const isChatHistoryOpen = useAppSelector(csel.isChatHistoryOpen);
    const messages = useAppSelector(csel.getCurrentConversationMessages());
    const filePath = useAppSelector(getCurrentFilePath);
    const markdownPopups = Object.entries(messages).map(([index, message]) => (_jsx(MarkdownPopup, { message: message, dismissed: !isChatOpen }, index)));
    function close() {
        dispatch(cs.interruptGeneration(null));
        dispatch(cs.setChatOpen(false));
    }
    const handleSelectHistory = (id) => {
        dispatch(cs.setCurrentConversation(id));
        dispatch(cs.setChatOpen(true));
    };
    const handleCloseHistory = () => {
        dispatch(cs.toggleChatHistory());
    };
    const commandBarActionTips = isChatHistoryOpen
        ? [ActionTips.CLOSE]
        : [ActionTips.HISTORY, ActionTips.CLOSE];
    return (_jsx(_Fragment, { children: isChatOpen && (_jsxs("div", Object.assign({ className: "chatpopup flex" }, { children: [_jsxs("div", Object.assign({ className: "px-4 overflow-auto" }, { children: [_jsx("div", Object.assign({ className: "markdownpopup__dismiss h-8 flex items-center" }, { children: _jsx(CommandBarActionTips, { tips: commandBarActionTips }) })), _jsx("div", Object.assign({ className: "flex flex-col space-y-2" }, { children: markdownPopups })), _jsx("div", Object.assign({ className: cx('my-4', {
                                'opacity-100': !isGenerating,
                                'opacity-0': isGenerating,
                            }) }, { children: !isGenerating && (_jsx(CommandBar, { parentCaller: 'chat' })) }))] })), isChatHistoryOpen && (_jsx(ChatHistory, { onSelect: handleSelectHistory }))] }))) }));
}
export function MarkdownPopup({ message, dismissed, }) {
    // const lastBotMessage = useAppSelector(csel.getLastMarkdownMessage);
    const reactMarkdownRef = useRef(null);
    useEffect(() => {
        if ((message === null || message === void 0 ? void 0 : message.sender) == 'bot' && message.type === 'markdown') {
            // setDismissed(false)
            if (reactMarkdownRef.current) {
                let elem = reactMarkdownRef.current;
                if (elem.children) {
                    let lastChild = elem.children[elem.children.length - 1];
                    if (lastChild) {
                        lastChild === null || lastChild === void 0 ? void 0 : lastChild.scrollIntoView(false);
                    }
                }
            }
        }
        else if ((message === null || message === void 0 ? void 0 : message.sender) == 'user') {
            // setDismissed(false);
            if (reactMarkdownRef.current) {
                let elem = reactMarkdownRef.current;
                if (elem.children) {
                    let lastChild = elem.children[elem.children.length - 1];
                    if (lastChild) {
                        lastChild === null || lastChild === void 0 ? void 0 : lastChild.scrollIntoView(false);
                    }
                }
            }
        }
    }, [message]);
    if (message.message.trim() == '') {
        return _jsx(_Fragment, {});
    }
    let className = (message === null || message === void 0 ? void 0 : message.sender) == 'user' ? 'userpopup' : 'markdownpopup';
    return (_jsx(_Fragment, { children: (((message === null || message === void 0 ? void 0 : message.sender) == 'bot' && message.type === 'markdown') ||
            (message === null || message === void 0 ? void 0 : message.sender) == 'user') &&
            !dismissed && (_jsx("div", Object.assign({ className: cx(className, 'px-6 py-4 rounded-lg') }, { children: _jsx("div", Object.assign({ className: "markdownpopup__content", ref: reactMarkdownRef }, { children: _jsx(ReactMarkdown, Object.assign({ components: { code: CodeBlock, a: CustomLink } }, { children: message.message })) })) }))) }));
}
const CustomLink = (_a) => {
    var { children, href } = _a, props = __rest(_a, ["children", "href"]);
    return (_jsx("a", Object.assign({ href: href, target: "_blank" }, { children: children })));
};
function CodeBlockLink({ index, codeBlock, }) {
    const dispatch = useAppDispatch();
    const currentFile = useAppSelector(getFile(codeBlock.fileId));
    const filePath = useAppSelector(getFilePath(codeBlock.fileId));
    const folderPath = useAppSelector(getFolderPath(currentFile.parentFolderId));
    const iconElement = getIconElement(currentFile.name);
    return (_jsx("div", Object.assign({ className: "commandBar__codelink", onClick: () => {
            dispatch(gs.openFile({
                filePath: filePath,
                selectionRegions: [
                    {
                        start: {
                            line: codeBlock.startLine,
                            character: 0,
                        },
                        end: { line: codeBlock.endLine, character: 0 },
                    },
                ],
            }));
        } }, { children: _jsxs("div", Object.assign({ className: "file__line file__no_highlight" }, { children: [_jsx("div", Object.assign({ className: "file__icon" }, { children: iconElement })), _jsx("div", Object.assign({ className: "file__name" }, { children: currentFile.name })), _jsx("div", Object.assign({ className: "file__path" }, { children: folderPath })), _jsxs("div", Object.assign({ className: "file__path" }, { children: ["Lines ", codeBlock.startLine, " - ", codeBlock.endLine] })), _jsx("div", Object.assign({ className: "file__close_button", onClick: (e) => {
                        e.stopPropagation();
                        dispatch(cs.removeCodeBlock(index));
                    } }, { children: _jsx(FontAwesomeIcon, { icon: faClose }) }))] })) })));
}
const Item = ({ entity: { name, type, summary, path, startIndex, endIndex }, }) => {
    const relativePath = path.slice(2);
    const fileIcon = getIconElement(relativePath);
    return (_jsxs(_Fragment, { children: [_jsxs("div", Object.assign({ className: "file__line " }, { children: [_jsx("div", Object.assign({ className: "file__icon" }, { children: fileIcon })), _jsxs("div", Object.assign({ className: "file__name" }, { children: [name.slice(0, startIndex), _jsx("mark", { children: name.slice(startIndex, endIndex) }), name.slice(endIndex)] })), _jsx("div", Object.assign({ className: "file__path" }, { children: relativePath }))] })), _jsx("div", Object.assign({ className: "truncate" }, { children: _jsx(CodeBlock, Object.assign({ className: "language-python", copyable: false }, { children: summary })) }))] }));
};
const Loading = ({ data }) => _jsx("div", { children: "Loading" });
export function CommandBarInner({ autofocus }) {
    const dispatch = useAppDispatch();
    const currentDraft = useAppSelector(csel.getCurrentDraftMessage);
    const repoId = useAppSelector((state) => state.global.repoId);
    const textareaRef = useRef({
        value: null,
    });
    const dummyRef = useRef(null);
    const getMsgType = useAppSelector(csel.getMsgType);
    let placeholder = 'Question about the whole codebase...';
    if (getMsgType == 'edit') {
        placeholder = 'Instructions for editing selection...';
    }
    else if (getMsgType == 'freeform') {
        placeholder = 'Chat about the current file/selection...';
    }
    else if (getMsgType == 'generate') {
        placeholder = 'Instructions for code to generate...';
    }
    else if (getMsgType == 'chat_edit') {
        placeholder = 'Instructions for editing the current file...';
    }
    const builder = useRef();
    const getCompletions = useCallback((text) => __awaiter(this, void 0, void 0, function* () {
        var _a;
        return (yield ((_a = builder.current) === null || _a === void 0 ? void 0 : _a.getCompletion(text, []))) || [];
    }), []);
    useEffect(() => {
        if (repoId) {
            builder.current = new ContextBuilder(repoId);
        }
    }, [repoId]);
    // const draftMessage = useAppSelector(
    //     (state) => state.chatState.draftMessages[converstationId]
    // )
    // const commandBarLinks =
    //     draftMessage?.otherCodeBlocks.map((codeBlock, i) => {
    //         return <CodeBlockLink key={i} index={i} codeBlock={codeBlock} />
    //     }) ?? []
    return (_jsx(ReactTextareaAutocomplete, { className: "commandBar__input", placeholder: placeholder, loadingComponent: Loading, scrollToItem: (container, item) => {
            if (item) {
                item.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }, ref: dummyRef, rows: 1, trigger: {
            '`': {
                dataProvider: (token) => __awaiter(this, void 0, void 0, function* () {
                    return getCompletions(token);
                    // return emoji(token)
                    //   .slice(0, 10)
                    //   .map(({ name, char }) => ({ name, char }));
                }),
                component: Item,
                output: (item, trigger) => {
                    return ('<|START_SPECIAL|>' +
                        JSON.stringify(item) +
                        '<|END_SPECIAL|>');
                },
            },
        }, containerStyle: { width: '100%', maxHeight: '80' }, dropdownStyle: {
            width: '100%',
            maxHeight: '30vh',
            overflowY: 'auto',
        }, value: currentDraft.message, autoFocus: autofocus, onChange: (e) => {
            if (e.target.value.includes('<|START_SPECIAL|>')) {
                let start = e.target.value.indexOf('<|START_SPECIAL|>') +
                    '<|START_SPECIAL|>'.length;
                let end = e.target.value.indexOf('<|END_SPECIAL|>');
                let special = e.target.value.slice(start, end);
                let item = JSON.parse(special);
                dispatch(cs.addSymbolToMessage({
                    name: item.name,
                    fileName: item.path,
                    type: item.type,
                }));
                // Change e.target.value to be the text before the special
                // and then add the special to the message
                e.target.value =
                    e.target.value.slice(0, start - '<|START_SPECIAL|>'.length) +
                        '`' +
                        item.name +
                        '`' +
                        e.target.value.slice(end + '<|END_SPECIAL|>'.length);
                //return
            }
            textareaRef.current.value.style.height = 'auto';
            textareaRef.current.value.style.height =
                textareaRef.current.value.scrollHeight + 'px';
            //getCompletions(e.target.value);
            dispatch(cs.setCurrentDraftMessage(e.target.value));
        }, 
        // ref = {textareaRef}
        innerRef: (ref) => void (textareaRef.current.value = ref), onKeyDown: (e) => {
            console.log(e.metaKey, e.keyCode);
            if (!e.shiftKey && e.key === 'Enter') {
                // Don't submit an empty prompt
                if (textareaRef.current.value.value.trim().length > 0) {
                    dispatch(cs.submitCommandBar(null));
                    e.preventDefault();
                }
            }
            // if uparrow
            if (e.keyCode == 38) {
                dispatch(cs.moveCommandBarHistory('up'));
                e.preventDefault();
            }
            if (e.keyCode == 40) {
                dispatch(cs.moveCommandBarHistory('down'));
                e.preventDefault();
            }
            // if command j
            if (e.keyCode == 74 && e.metaKey) {
                dispatch(cs.abortCommandBar());
            }
            // if command k
            if ((e.keyCode == 75 || e.keyCode == 76) && e.metaKey) {
                dispatch(cs.abortCommandBar());
            }
            // if command z
            if (e.keyCode == 90 && e.metaKey) {
                dispatch(cs.abortCommandBar());
            }
        } }));
}
function formatPromptTime(sentAt) {
    const date = new Date(sentAt);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'pm' : 'am';
    const formattedHours = hours % 12 === 0 ? 12 : hours % 12;
    const formattedMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${formattedHours}:${formattedMinutes}${ampm}`;
}
function formatPromptPreview(prompt) {
    const maxLength = 38;
    const noNewlines = prompt.replace(/(\r\n|\n|\r)/gm, '');
    // const truncated =
    //     noNewlines.length > maxLength
    //         ? noNewlines.slice(0, maxLength).trim() + '...'
    //         : noNewlines
    // return `"${truncated}"`
    // return `"${noNewlines}"`
    return noNewlines;
}
function ChatHistory(props) {
    const conversationIds = useAppSelector(csel.getConversationIds);
    const conversationPrompts = useAppSelector(csel.getConversationPrompts(conversationIds, 'reverse'));
    return (_jsxs("div", Object.assign({ className: "flex flex-col items-center w-80 select-none" }, { children: [_jsx("button", Object.assign({ className: "w-full", onClick: props.onClose }, { children: _jsx(CommandBarActionTips, { align: "right", tips: [ActionTips.CLOSE_HISTORY] }) })), _jsx("div", Object.assign({ className: "flex flex-col w-full items-center space-y-1 mt-1" }, { children: conversationPrompts.map((msg) => {
                    return (_jsx("button", Object.assign({ className: "w-full bg-neutral-600 rounded-sm px-4 py-2 ", onClick: () => { var _a; return (_a = props.onSelect) === null || _a === void 0 ? void 0 : _a.call(props, msg.conversationId); } }, { children: _jsxs("div", Object.assign({ className: 'flex justify-between whitespace-nowrap items-center' }, { children: [_jsx("span", Object.assign({ className: "text-neutral-300 text-xs customEllipsis" }, { children: formatPromptPreview(msg.message) })), _jsx("span", Object.assign({ className: "text-neutral-400 text-xs" }, { children: formatPromptTime(msg.sentAt) }))] })) }), msg.conversationId));
                }) }))] })));
}
export function CommandBar({ parentCaller, }) {
    const dispatch = useAppDispatch();
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
            top: '100px',
            width: '600px',
            maxWidth: '100vw',
            left: '50%',
            right: 'none',
            transform: 'translateX(-50%)',
        },
    };
    const commandBarOpen = useAppSelector(csel.getIsCommandBarOpen);
    const isChatHistoryAvailable = useAppSelector(csel.getIsChatHistoryAvailable);
    return (_jsx(_Fragment, { children: parentCaller == 'commandBar' ? (_jsx(Modal, Object.assign({ isOpen: commandBarOpen, onRequestClose: () => {
                dispatch(cs.abortCommandBar());
            }, style: customStyles }, { children: _jsx("div", Object.assign({ className: "commandBar__container" }, { children: _jsx("div", Object.assign({ className: "commandBar" }, { children: _jsx("div", Object.assign({ className: "commandBar__input_container" }, { children: _jsx(CommandBarInner, { autofocus: true }) })) })) })) }))) : (_jsx("div", Object.assign({ className: "commandBar__container" }, { children: _jsx("div", Object.assign({ className: "commandBar" }, { children: _jsx("div", Object.assign({ className: "commandBar__input_container" }, { children: _jsx(CommandBarInner, { autofocus: false }) })) })) }))) }));
}
