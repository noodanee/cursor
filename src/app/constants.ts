import { faTimes, faHistory, } from '@fortawesome/free-solid-svg-icons';
import { faChevronsLeft, } from '@fortawesome/pro-regular-svg-icons';
import { setChatOpen, toggleChatHistory } from '../features/chat/chatSlice';
import { store } from './store';
export const ActionTips = {
    CLOSE: ['Close', 'Esc', faTimes, () => store.dispatch(setChatOpen(false))],
    HISTORY: [
        'History',
        'Cmd+H',
        faHistory,
        () => store.dispatch(toggleChatHistory()),
    ],
    CLOSE_HISTORY: [
        'Close History',
        'Cmd+H',
        faChevronsLeft,
        () => store.dispatch(toggleChatHistory()),
    ],
};
