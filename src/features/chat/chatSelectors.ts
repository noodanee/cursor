import { createSelector } from 'reselect';
import { getLastBotMessage as getLastBotMessageMain } from './chatSlice';
export const getIsCommandBarOpen = (state) => state.chatState.isCommandBarOpen;
export const getCurrentDraftMessage = (state) => state.chatState.draftMessages[state.chatState.currentConversationId];
export const getLastBotMessage = (state) => {
    return getLastBotMessageMain(state.chatState);
};
export const getLastBotMessageById = (conversationId) => (state) => {
    return getLastBotMessageMain(state.chatState, conversationId);
};
export const getLastBotMessageIndex = (state) => {
    const botMessages = state.chatState.botMessages;
    return botMessages.length - 1;
};
export const getLastBotMessageFinished = (state) => {
    const botMessages = state.chatState.botMessages;
    const msg = botMessages[botMessages.length - 1];
    if (msg == null)
        return true;
    return msg.finished;
};
export const getLastBotMessageHitTokenLimit = (state) => {
    const botMessages = state.chatState.botMessages;
    const msg = botMessages[botMessages.length - 1];
    if (msg == null)
        return false;
    return msg.hitTokenLimit;
};
export const getLastBotMessageInterrupted = (state) => {
    const botMessages = state.chatState.botMessages;
    const msg = botMessages[botMessages.length - 1];
    if (msg == null)
        return false;
    return msg.interrupted;
};
export const getGenerating = (state) => state.chatState.generating;
export const getMessages = (conversationId) => createSelector((state) => state.chatState.botMessages.filter((m) => m.conversationId === conversationId), (state) => state.chatState.userMessages.filter((m) => m.conversationId === conversationId), (botMessages, userMessages) => {
    // Interleave starting with orig userMessage
    const messages = [];
    let i = 0;
    let j = 0;
    while (i < botMessages.length || j < userMessages.length) {
        if (j < userMessages.length) {
            messages.push(userMessages[j]);
            j++;
        }
        if (i < botMessages.length) {
            messages.push(botMessages[i]);
            i++;
        }
    }
    return messages;
});
export const getConversationIds = createSelector((state) => state.chatState.userMessages, (userMessages) => userMessages
    .filter((m) => m.msgType === 'freeform')
    .map((m) => m.conversationId)
    .filter((value, index, self) => self.indexOf(value) === index));
export const getConversationPrompts = (conversationIds, order = 'forward') => createSelector(...conversationIds.map(getMessages), (...messageLists) => messageLists.reduce((acc, messages) => {
    return order === 'forward'
        ? [...acc, messages[0]]
        : [messages[0], ...acc];
}, []));
export const isChatOpen = createSelector((state) => state.chatState.currentConversationId, (state) => state.chatState.msgType, (state) => state.chatState.userMessages, (state) => state.chatState.botMessages, (state) => state.chatState.chatIsOpen, (conversationId, messageType, userMessages, botMessages, chatIsOpen) => {
    if (!chatIsOpen) {
        return false;
    }
    const someMarkdownMessages = botMessages.some((m) => m.conversationId === conversationId && m.type === 'markdown');
    return someMarkdownMessages;
});
export const isChatHistoryOpen = createSelector((state) => state.chatState.chatIsOpen, (state) => state.chatState.chatHistoryIsOpen, (chatIsOpen, isChatHistoryOpen) => {
    return chatIsOpen && isChatHistoryOpen;
});
export const getLastUserMessage = (state) => {
    const userMessages = state.chatState.userMessages.filter((m) => m.conversationId === state.chatState.currentConversationId);
    return userMessages[userMessages.length - 1];
};
export const getUserMessages = (state) => {
    return state.chatState.userMessages;
};
export const getLastCodeBlocks = (state) => {
    const userMessages = state.chatState.userMessages;
    return userMessages[userMessages.length - 1].otherCodeBlocks;
};
export const getLastMarkdownMessage = (state) => {
    const botMessages = state.chatState.botMessages;
    for (let i = botMessages.length - 1; i >= 0; i--) {
        if (botMessages[i].type === 'markdown') {
            return botMessages[i];
        }
    }
};
export const getCurrentConversationMessages = () => createSelector((state) => state.chatState.currentConversationId, (state) => (id) => getMessages(id)(state), (id, getter) => getter(id));
export const getIsChatHistoryAvailable = createSelector((state) => state.chatState.userMessages, (userMessages) => userMessages.length > 0);
export const getFireCommandK = (state) => state.chatState.fireCommandK;
export const getMsgType = (state) => state.chatState.msgType;
