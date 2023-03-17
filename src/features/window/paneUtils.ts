import { HoverState, nextTabID, nextPaneID, } from './state';
import { doDeleteFile, setSelectedFile } from './fileUtils';
export function newCachedTab() {
    return {
        initialEditorState: null,
        scrollPos: null,
        pendingTransactions: [],
        vimState: null,
    };
}
export function createCachedTabIfNotExists(state, tabId) {
    if (!(tabId in state.tabCache)) {
        state.tabCache[tabId] = newCachedTab();
    }
}
export function updateEditorState(state, tabId, editorState) {
    createCachedTabIfNotExists(state, tabId);
    state.tabCache[tabId].initialEditorState = editorState;
}
export function getNumberOfPanes(state) {
    return Object.keys(state.paneState.byIds).length;
}
export function setPaneContents(state, paneId, fileId) {
    const pane = state.paneState.byIds[paneId];
    const fileCache = state.fileCache[fileId];
    pane.contents = fileCache == null ? '' : fileCache.contents;
}
export function clearActiveTabs(state, paneId) {
    const pane = state.paneState.byIds[paneId];
    pane.tabIds.forEach((id) => {
        state.tabs[id].isActive = false;
    });
}
export function setActiveTab(state, tabid) {
    const tab = state.tabs[tabid];
    clearActiveTabs(state, tab.paneId);
    tab.isActive = true;
    setPaneContents(state, tab.paneId, tab.fileId);
}
export function insertNewTab(state, paneId, fileId) {
    const tabid = nextTabID(state);
    const tab = {
        fileId,
        paneId,
        isActive: false,
        isChat: false,
        isReady: 0,
        isReadOnly: false,
        generating: false,
        interrupted: false,
        isMulti: false,
        isMultiDiff: false,
    };
    state.tabs[tabid] = tab;
    state.paneState.byIds[paneId].tabIds.push(tabid);
    createCachedTabIfNotExists(state, tabid);
    return tabid;
}
export function getTabForFile(state, paneId, fileId) {
    const pane = state.paneState.byIds[paneId];
    const tabid = pane.tabIds.find((id) => state.tabs[id].fileId === fileId);
    return tabid;
}
export function getActivePaneID(state) {
    const paneIds = Object.keys(state.paneState.byIds);
    for (let i = 0; i < paneIds.length; i++) {
        const paneId = parseInt(paneIds[i]);
        if (state.paneState.byIds[paneId].isActive) {
            return paneId;
        }
    }
    return null;
}
export function getPaneActiveTabId(state, paneId) {
    const pane = state.paneState.byIds[paneId];
    return pane.tabIds.find((id) => state.tabs[id].isActive);
}
export function getActiveTabId(state) {
    const paneId = getActivePaneID(state);
    if (paneId == null) {
        return null;
    }
    const pane = state.paneState.byIds[paneId];
    const tabid = pane.tabIds.find((id) => state.tabs[id].isActive);
    if (tabid == null)
        return null;
    return tabid;
}
export function getActiveFileId(state) {
    const tabid = getActiveTabId(state);
    if (!tabid) {
        return null;
    }
    return state.tabs[tabid].fileId;
}
export function setPaneActive(state, paneId) {
    Object.keys(state.paneState.byIds).forEach((id) => {
        state.paneState.byIds[parseInt(id)].isActive = false;
    });
    state.paneState.byIds[paneId].isActive = true;
}
export function insertNewPaneExceptSplit(state) {
    // inactivate all panes
    const pane = {
        contents: '',
        isActive: false,
        tabIds: [],
    };
    const paneid = nextPaneID(state);
    state.paneState.byIds[paneid] = pane;
    setPaneActive(state, paneid);
    return paneid;
}
//type AtomOrArray = Atom | NestedArray;
export function findSplitOfPane(state, paneId) {
    return findParentSplit(state, paneId);
}
function findParentSplit(state, splitOrPane) {
    // recursively search bySplit for paneId
    function findSplitOfPaneHelper(state, splitOrPane, splits, depth) {
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            if (split === splitOrPane) {
                return { splits, depth };
            }
        }
        for (let i = 0; i < splits.length; i++) {
            const subSplits = splits[i];
            if (Array.isArray(subSplits)) {
                const found = findSplitOfPaneHelper(state, splitOrPane, subSplits, depth + 1);
                if (found) {
                    return found;
                }
            }
        }
        return null;
    }
    return findSplitOfPaneHelper(state, splitOrPane, state.paneState.bySplits, 0);
}
export function isDepthHorizontal(number) {
    return number % 2 === 1;
}
export function isHoverStateHorizontal(hoverState) {
    return hoverState === HoverState.Left || hoverState === HoverState.Right;
}
export function isHoverStateNewFirst(hoverState) {
    return hoverState === HoverState.Left || hoverState === HoverState.Top;
}
export function splitPane(state, paneId, hoverState) {
    const answer = findSplitOfPane(state, paneId);
    if (answer == null)
        return;
    const { splits, depth } = answer;
    const newPaneId = insertNewPaneExceptSplit(state);
    const isHorizontal = isDepthHorizontal(depth);
    const isHoverHorizontal = isHoverStateHorizontal(hoverState);
    const isHoverNewFirst = isHoverStateNewFirst(hoverState);
    const newSubSplit = isHoverNewFirst
        ? [newPaneId, paneId]
        : [paneId, newPaneId];
    //find the ind with paneId
    const index = splits.indexOf(paneId);
    if (isHorizontal === isHoverHorizontal) {
        splits.splice(index, 1, ...newSubSplit);
    }
    else {
        splits.splice(index, 1, newSubSplit);
    }
    return newPaneId;
}
export function insertFirstPane(state) {
    if (getNumberOfPanes(state) > 0) {
        return null;
    }
    const paneId = insertNewPaneExceptSplit(state);
    state.paneState.bySplits = [paneId];
    return paneId;
}
export function doMoveTabToPane(state, tabId, paneId) {
    const oldPaneId = state.tabs[tabId].paneId;
    if (oldPaneId == null)
        return;
    const tab = state.tabs[tabId];
    const oldPane = state.paneState.byIds[oldPaneId];
    if (tab.isActive && oldPane.tabIds.length > 1) {
        const index = oldPane.tabIds.indexOf(tabId);
        let newIndex = index === 0 ? 1 : index - 1;
        setActiveTab(state, oldPane.tabIds[newIndex]);
    }
    oldPane.tabIds.splice(oldPane.tabIds.indexOf(tabId), 1);
    const newPane = state.paneState.byIds[paneId];
    newPane.tabIds.push(tabId);
    setPaneActive(state, paneId);
    state.tabs[tabId].paneId = paneId;
    setActiveTab(state, tabId);
    // if old pane is empty, remove it
    if (oldPane.tabIds.length === 0) {
        deletePane(state, oldPaneId);
    }
}
export function deleteTab(state, tabId) {
    const tab = state.tabs[tabId];
    const pane = state.paneState.byIds[tab.paneId];
    // make an adjacent tab active if this one was
    if (tab.isActive && pane.tabIds.length > 1) {
        const index = pane.tabIds.indexOf(tabId);
        if (index === 0) {
            setActiveTab(state, pane.tabIds[1]);
        }
        else {
            setActiveTab(state, pane.tabIds[index - 1]);
        }
    }
    pane.tabIds.splice(pane.tabIds.indexOf(tabId), 1);
    const fileId = tab.fileId;
    delete state.tabs[tabId];
    // check to see if there are any other tabs open for this file
    const otherTab = Object.keys(state.tabs).find((id) => {
        const tab = state.tabs[parseInt(id)];
        return tab.fileId === fileId;
    });
    if (!otherTab) {
        // if not, remove the file from the file cache
        delete state.fileCache[fileId];
        state.files[fileId].saved = true;
        state.files[fileId].isSelected = false;
    }
    // delete cached tab
    delete state.tabCache[tabId];
}
export function deletePane(state, paneId) {
    const pane = state.paneState.byIds[paneId];
    pane.tabIds.forEach((id) => deleteTab(state, id));
    delete state.paneState.byIds[paneId];
    // if there are no isActive panes, make the first one active
    if (pane.isActive) {
        const allPaneIds = Object.keys(state.paneState.byIds);
        if (allPaneIds.length > 0) {
            state.paneState.byIds[parseInt(allPaneIds[0])].isActive = true;
        }
    }
    // loop through the bysplits recursively to find the paneId
    // and remove it
    function removePaneIdFromSplits(splits) {
        for (let i = 0; i < splits.length; i++) {
            const split = splits[i];
            if (split === paneId) {
                splits.splice(i, 1);
                return;
            }
            if (Array.isArray(split)) {
                removePaneIdFromSplits(split);
                // if the split array is empty, remove it
                if (split.length === 0) {
                    splits.splice(i, 1);
                    return;
                }
            }
        }
    }
    removePaneIdFromSplits(state.paneState.bySplits);
}
export function doCloseTab(state, tabId) {
    const paneId = state.tabs[tabId].paneId;
    const fileId = state.tabs[tabId].fileId;
    deleteTab(state, tabId);
    // if that was the last tab and there are more than one panes
    if (state.paneState.byIds[paneId].tabIds.length === 0 &&
        getNumberOfPanes(state) > 1) {
        deletePane(state, paneId);
    }
    // if that was the last tab for the file, remove the file from the file cache
    const otherTab = Object.keys(state.tabs).find((id) => {
        const tab = state.tabs[parseInt(id)];
        return tab.fileId === fileId;
    });
    const file = state.files[fileId];
    if (!otherTab && file.deleted == true) {
        doDeleteFile(state, fileId);
    }
}
export function doMoveToAdjacentPane(state, paneDirection) {
    const currentPaneId = getActivePaneID(state);
    const tabId = getActiveTabId(state);
    const tab = state.tabs[tabId];
    // const currentPaneId = tab.paneId;
    // paneDirection is one of 'left', 'right', 'up', 'down'
    // find the adjacent pane in the given direction
    function findAdjacentPane(state, paneId, direction) {
        // get the splits and depth of the current pane
        const answer = findSplitOfPane(state, paneId);
        if (answer == null)
            return null;
        const { splits, depth } = answer;
        // get the index of the current pane in the splits array
        const index = splits.indexOf(paneId);
        // check if the direction matches the orientation of the splits
        const isHorizontal = isDepthHorizontal(depth);
        const isDirectionHorizontal = ['right', 'left'].includes(direction);
        const offset = ['left', 'up'].includes(direction) ? -1 : 1;
        let newIndex;
        if (isHorizontal === isDirectionHorizontal) {
            // if the direction is horizontal, move left or right in the same splits array
            newIndex = index + offset;
            // check if the new index is valid
            if (newIndex >= 0 && newIndex < splits.length) {
                // return the pane id at the new index
                return splits[newIndex];
            }
        }
        else {
            // find the parent splits array and its depth
            const parentAnswer = findParentSplit(state, splits);
            if (parentAnswer == null)
                return null;
            const { splits: parentSplits } = parentAnswer;
            // find the index of the current splits array in the parent splits array
            const parentIndex = parentSplits.indexOf(splits);
            newIndex = parentIndex + offset;
            if (newIndex >= 0 && newIndex < parentSplits.length) {
                // get the new splits array
                let potentialIndex = parentSplits[newIndex];
                if (Array.isArray(potentialIndex)) {
                    const roughIndex = (index / splits.length) * potentialIndex.length;
                    // Round to the nearest index
                    newIndex = Math.round(roughIndex);
                    return potentialIndex[newIndex];
                }
                else {
                    return potentialIndex;
                }
            }
            return null;
        }
    }
    // get the adjacent pane id in the given direction
    let adjacentPaneId = findAdjacentPane(state, currentPaneId, paneDirection);
    // if the adjacent pane exists, move the tab to it
    if (adjacentPaneId != null) {
        while (Array.isArray(adjacentPaneId)) {
            adjacentPaneId = adjacentPaneId[0];
        }
        setPaneActive(state, adjacentPaneId);
    }
}
// Function to get the parent folder ids of a folder
function getParentFolderIds(globalState, folderId) {
    let parentFolderIds = [];
    let currentFolderId = folderId;
    while (currentFolderId !== null) {
        parentFolderIds.push(currentFolderId);
        currentFolderId = globalState.folders[currentFolderId].parentFolderId;
    }
    return parentFolderIds;
}
const DEFAULT_INDENT = '    ';
// set file to selected and open up the tab in the current active pane
export function doSelectFile(state, fileid) {
    const file = state.files[fileid];
    let paneId = getActivePaneID(state);
    if (paneId == null) {
        paneId = insertFirstPane(state);
    }
    let tabid = getTabForFile(state, paneId, fileid);
    if (tabid == null) {
        tabid = insertNewTab(state, paneId, fileid);
    }
    setActiveTab(state, tabid);
    setSelectedFile(state, fileid);
    // the indenting logic
    if (file.indentUnit == null) {
        const contents = state.fileCache[fileid].contents;
        function computeFirstIndents(candidateIndents) {
            // convert all preceding tabs to spaces
            const indentLengths = candidateIndents.map((line) => {
                let indent = line.match(/^\s*/);
                if (indent != null) {
                    return indent[0];
                }
                else {
                    return '';
                }
            });
            // compute the indent difference between the previous line and the current line
            const firstIndents = indentLengths
                .map((indent, index) => {
                if (index === 0) {
                    return null;
                }
                const lastIndent = indentLengths[index - 1];
                if (lastIndent.length == indent.length) {
                    return null;
                }
                else if (lastIndent.length > indent.length) {
                    return lastIndent.slice(-(lastIndent.length - indent.length));
                }
                else {
                    return indent.slice(0, indent.length - lastIndent.length);
                }
            })
                .filter((indent) => indent != null);
            return firstIndents;
        }
        const lines = contents.split('\n');
        const numFromEitherEnd = 50;
        const firstIndents = computeFirstIndents(lines.slice(0, numFromEitherEnd)).concat(computeFirstIndents(lines.slice(-numFromEitherEnd)));
        if (firstIndents.length === 0) {
            file.indentUnit = DEFAULT_INDENT;
        }
        else {
            // set minIndent to the most common indent
            const indentCounts = firstIndents.reduce((counts, indent) => {
                if (indent in counts) {
                    counts[indent] += 1;
                }
                else {
                    counts[indent] = 1;
                }
                return counts;
            }, {});
            const indentPairs = Object.entries(indentCounts);
            const minPair = indentPairs.reduce((min, args) => args[1] > min[1] ? args : min);
            let minIndent = minPair[0];
            if (!['  ', '\t', '    '].includes(minIndent)) {
                minIndent = DEFAULT_INDENT;
            }
            file.indentUnit = minIndent;
        }
    }
    // for each parent folder, set isOpen to true
    setOpenParentFolders(state, file.parentFolderId);
    // set file latest access time as number
    state.files[fileid].latestAccessTime = Date.now();
}
export function setOpenParentFolders(state, folderId) {
    const parentFolderIds = getParentFolderIds(state, folderId);
    parentFolderIds.forEach((folderId) => {
        state.folders[folderId].isOpen = true;
    });
}
