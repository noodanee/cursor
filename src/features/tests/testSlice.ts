var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { createSlice, createAsyncThunk, } from '@reduxjs/toolkit';
import { API_ROOT } from '../../utils';
import { nextId } from '../window/state';
import { createFileIfNeeded, findFileIdFromPath, getContentsIfNeeded, } from '../window/fileUtils';
import { streamSource } from '../../utils';
import { manufacturedConversation } from '../chat/chatSlice';
// Define the initial state
export const initialState = {
    cachedFunctions: {
        ids: [],
        byIds: {},
    },
    generatedTests: {
        ids: [],
        byIds: {},
    },
    testFiles: {
        map: {},
    },
    requestingTestDir: [],
};
function findFunctionIds(state, identifiers) {
    const ids = state.cachedFunctions.ids;
    const byIds = state.cachedFunctions.byIds;
    const { testId, functionName, fileName, functionBody } = identifiers;
    return ids.filter((id) => (testId ? byIds[id].testId == testId : true) &&
        (functionName ? byIds[id].functionName == functionName : true) &&
        (fileName ? byIds[id].fileName == fileName : true) &&
        (functionBody ? byIds[id].functionBody == functionBody : true) // &&
    // (range ? byIds[id].range == range : true)
    );
}
function findTestIds(state, identifiers) {
    const ids = state.generatedTests.ids;
    const byIds = state.generatedTests.byIds;
    const { testId, functionId, functionName, fileName, testFileName, testCode, insertLocation, } = identifiers;
    return ids.filter((id) => (testId ? byIds[id].id == testId : true) &&
        (functionId ? byIds[id].functionId == functionId : true) &&
        (functionName ? byIds[id].functionName == functionName : true) &&
        (fileName ? byIds[id].fileName == fileName : true) &&
        (testFileName ? byIds[id].testFileName == testFileName : true) &&
        (testCode ? byIds[id].testCode == testCode : true) &&
        (insertLocation ? byIds[id].insertLocation == insertLocation : true));
}
export const updateTestsForFile = createAsyncThunk('test/updateTestsForFile', (fileName, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    let global = state.global;
    const fileId = findFileIdFromPath(global, fileName);
    if (!fileId)
        return;
    // Get the testFileName from the current fileName
    let testFileName;
    // Check if fileName is in state.test.testFiles.map
    if (fileName in state.test.testFiles.map) {
        testFileName = state.test.testFiles.map[fileName];
    }
    else {
        testFileName = null;
    }
    const contents = global.fileCache[fileId].contents;
    let testIds = findTestIds(state.test, { fileName });
    let cachedTests = [];
    if (testIds.length == 0) {
        // @ts-ignore
        let origTests = yield connector.loadTests(fileName);
        if (origTests != null) {
            let foundCachedTests = origTests;
            try {
                cachedTests = Object.values(foundCachedTests.generatedTests);
                testFileName = testFileName || foundCachedTests.testFileName;
                if (testFileName) {
                    // If we found a testFileName, we add it to the map
                    dispatch(addTestFileMap({ fileName, testFileName }));
                }
                // Iterate through each cached test and upsert it
                for (let testData of cachedTests) {
                    dispatch(upsertTest({
                        functionId: testData.functionId,
                        functionName: testData.functionName,
                        functionBody: testData.functionBody,
                        fileName,
                        // test related stuff
                        insertLocation: testData.insertLocation,
                        testCode: testData.testCode,
                    }));
                }
            }
            catch (e) {
                console.error(e);
            }
        }
        else {
        }
    }
    else {
        cachedTests = testIds.map((id) => state.test.generatedTests.byIds[id]);
    }
    let testFileContents = '';
    if (testFileName != null) {
        // Get the test file id from the testFileName
        yield dispatch(createFileIfNeeded(testFileName));
        global = getState().global;
        const testFileId = findFileIdFromPath(global, testFileName);
        // Get the contents of the test file if it exists
        if (testFileId) {
            testFileContents = yield getContentsIfNeeded(global, testFileId);
        }
    }
    const response = yield fetch(`${API_ROOT}/tests/`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `repo_path=${state.global.rootPath}`,
        },
        //credentials: 'include',
        body: JSON.stringify({
            cachedTests: cachedTests,
            fileName: fileName,
            fileContents: contents,
            testFileName: testFileName !== null && testFileName !== void 0 ? testFileName : '',
            testFileContents: testFileContents,
        }),
    });
    const getNextToken = () => __awaiter(void 0, void 0, void 0, function* () {
        let rawResult = yield generator.next();
        if (rawResult.done)
            return null;
        return rawResult.value;
    });
    let generator = streamSource(response);
    let line = yield getNextToken();
    while (line != null) {
        const { function_name: functionName, function_body: functionBody, test_code: testCode, insert_location: insertLocation, } = line;
        dispatch(upsertFunction({
            functionData: {
                fileName: fileName,
                functionName,
                functionBody,
            },
        }));
        // Get the functionId just added
        const functionId = findFunctionIds(getState().test, { fileName, functionName, functionBody })[0];
        dispatch(upsertTest({
            functionId,
            fileName,
            functionName,
            functionBody,
            insertLocation,
            testCode,
        }));
        line = yield getNextToken();
    }
    dispatch(saveTests({ path: fileName }));
}));
export const saveTests = createAsyncThunk('comments/saveComments', (payload, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    // Get all test ids for the given path
    const testIds = findTestIds(state.test, { fileName: payload.path });
    const testFileName = state.test.testFiles.map[payload.path];
    // Get all tests corresponding to those testIds
    const tests = testIds.map((id) => state.test.generatedTests.byIds[id]);
    const fullPayload = {
        generatedTests: tests,
        testFileName,
    };
    //@ts-ignore
    yield connector.saveTests({ path: payload.path, blob: fullPayload });
}));
export const computeAndRenderTest = createAsyncThunk('test/computeAndRenderTest', ({ fileName, functionBody, startLine, }, { getState, dispatch }) => __awaiter(void 0, void 0, void 0, function* () {
    const state = getState();
    let global = state.global;
    const fileId = findFileIdFromPath(global, fileName);
    if (!fileId)
        return;
    // Get the testFileName from the current fileName
    let testFileName;
    // Check if fileName is in state.test.testFiles.map
    if (fileName in state.test.testFiles.map) {
        testFileName = state.test.testFiles.map[fileName];
    }
    else {
        testFileName = null;
    }
    let testFileContents = '';
    if (testFileName != null) {
        // Get the test file id from the testFileName
        yield dispatch(createFileIfNeeded(testFileName));
        global = getState().global;
        const testFileId = findFileIdFromPath(global, testFileName);
        // Get the contents of the test file if it exists
        if (testFileId) {
            testFileContents = yield getContentsIfNeeded(global, testFileId);
        }
    }
    const response = yield fetch(`${API_ROOT}/tests/single`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Cookie: `repo_path=${state.global.rootPath}`,
        },
        //credentials: 'include',
        body: JSON.stringify({
            fileName: fileName,
            functionBody,
            testFileName: testFileName !== null && testFileName !== void 0 ? testFileName : '',
            testFileContents: testFileContents,
        }),
    });
    const json = yield response.json();
    const { test_code, insert_location } = json;
    const fileContents = yield getContentsIfNeeded(state.global, findFileIdFromPath(state.global, fileName));
    let precedingCode = null, selectedCode = null, procedingCode = null;
    if (startLine != null) {
        const endLine = startLine + functionBody.split('\n').length;
        // Let us split fileContents into preceding code, selected code, and proceding code
        precedingCode = fileContents
            .split('\n')
            .slice(0, startLine)
            .join('\n');
        selectedCode = fileContents
            .split('\n')
            .slice(startLine, endLine)
            .join('\n');
        procedingCode = fileContents.split('\n').slice(endLine).join('\n');
    }
    else {
        selectedCode = fileContents;
    }
    // For now, we place this in a chat window:
    dispatch(manufacturedConversation({
        userMessage: 'Write me a test for this block of code',
        botMessage: `Here is a test for the selected code\n\`\`\`${fileName}\n${test_code}\n\`\`\``,
        messageType: 'freeform',
        currentFile: fileName,
        procedingCode: procedingCode,
        precedingCode: precedingCode,
        currentSelection: selectedCode,
    }));
}));
export const renderNewTest = createAsyncThunk('testSlice/renderNewTest', ({ filePath, functionName, startLine, }, { dispatch, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    let state = getState();
    const testIds = findTestIds(state.test, {
        fileName: filePath,
        functionName,
    });
    if (testIds.length == 0)
        return;
    const testId = testIds[0];
    const { testCode, testFileName, insertLocation, functionBody } = state.test.generatedTests.byIds[testId];
    // get the code from the actual file
    // TODO - raise an error here instead of using the exclamation mark
    const fileContents = yield getContentsIfNeeded(state.global, findFileIdFromPath(state.global, filePath));
    let precedingCode = null, selectedCode = null, procedingCode = null;
    if (startLine != null) {
        const endLine = startLine + functionBody.split('\n').length;
        // Let us split fileContents into preceding code, selected code, and proceding code
        precedingCode = fileContents
            .split('\n')
            .slice(0, startLine)
            .join('\n');
        selectedCode = fileContents
            .split('\n')
            .slice(startLine, endLine)
            .join('\n');
        procedingCode = fileContents.split('\n').slice(endLine).join('\n');
    }
    else {
        selectedCode = fileContents;
    }
    // For now, we place this in a chat window:
    dispatch(manufacturedConversation({
        userMessage: 'Write me a test for this block of code',
        botMessage: `Here is a test for the selected code\n\`\`\`${filePath}\n${testCode}\n\`\`\``,
        messageType: 'freeform',
        currentFile: filePath,
        procedingCode: procedingCode,
        precedingCode: precedingCode,
        currentSelection: selectedCode,
    }));
    // if (testFileName == null) {
    //     // We cannot render here
    //     return;
    // }
    // // Either way, we now must render the new test. We open the test file
    // // and add the transactions to generate the test
    // // Open the file first
    // await dispatch(openFile({filePath: testFileName}));
    // // Get the tab id of the currently opened file
    // state = getState() as {test: TestState, global: State};
    // const paneId = getCurrentPane(state)!
    // const tabId = getCurrentTab(paneId)(state)!
    // // Then dispatch the transactions
    // dispatch(addTransaction({
    //     tabId: tabId,
    //     transactionFunction: {
    //         type: "insert",
    //         from: insertLocation,
    //         to: insertLocation,
    //         text: testCode
    //     }
    // }));
    // // First we update the test to show it was generated
    // dispatch(finishedGenerating({testId}));
    // // Get all of the tests
    // const allTests = (getState() as {test: TestState}).test.generatedTests.byIds;
    // // Then save them
    // //@ts-ignore
    // await connector.saveTests({path: filePath, blob: allTests});
}));
export const newTestFile = createAsyncThunk('testSlice/newTestFile', ({ fileName, testFileName }, { dispatch, getState }) => __awaiter(void 0, void 0, void 0, function* () {
    let state = getState();
    dispatch(addTestFileMap({ fileName, testFileName }));
    // Creates the file if it doesn't exist
    yield dispatch(createFileIfNeeded(testFileName));
    // Then we save the current tests
    dispatch(saveTests({ path: fileName }));
    // Then we call updateTestsforFile to generate the tests
    dispatch(updateTestsForFile(fileName));
}));
// Create the slice
export const testSlice = createSlice({
    name: 'testSlice',
    initialState,
    extraReducers: (builder) => {
        // builder.addCase(newTestFile.fulfilled, (state, action) => {
        //     const {fileName, testFileName} = action.payload;
        //     state.testFiles.map[fileName] = testFileName;
        // });
        // builder.addCase(renderNewTest.fulfilled, (state, action) => {
        //     const testId = action.payload;
        //     if (testId == null) return;
        //     state.generatedTests.byIds[testId].generated = true;
        //     // Add your logic here for the fulfilled case of renderNewTest
        // });
    },
    reducers: {
        addTestFileMap(state, action) {
            const { fileName, testFileName } = action.payload;
            state.testFiles.map[fileName] = testFileName;
        },
        requestTestFileName(state, action) {
            const { fileName } = action.payload;
            if (!state.requestingTestDir.includes(fileName)) {
                state.requestingTestDir.push(fileName);
            }
        },
        closeTestFileName(state, action) {
            const { fileName } = action.payload;
            if (state.requestingTestDir.includes(fileName)) {
                state.requestingTestDir = state.requestingTestDir.filter((name) => name != fileName);
            }
        },
        finishedGenerating(state, action) {
            const testId = action.payload.testId;
            state.generatedTests.byIds[testId].generated = true;
        },
        upsertFunction(state, action) {
            const cachedFunctions = state.cachedFunctions;
            const { ids, byIds } = cachedFunctions;
            const { functionName, functionBody, fileName } = action.payload.functionData;
            let existingFunctionIds = findFunctionIds(state, {
                functionName,
                fileName,
            });
            let existingFunctionId = existingFunctionIds.length > 0 ? existingFunctionIds[0] : null;
            if (existingFunctionId) {
                // Check if the function body is the same - if we were to replace all \s+ with ' ' and trim the strings
                const origFunction = byIds[existingFunctionId];
                const origBody = origFunction.functionBody
                    .replace(/\s+/g, ' ')
                    .trim();
                const newBody = functionBody.replace(/\s+/g, ' ').trim();
                // Dont update if less than 1 second. This is pretty arbitrary but hopefully works fine
                if (origBody == newBody ||
                    Date.now() - origFunction.lastUpdated < 1000) {
                    // If the function body is the same, then we do nothing
                    return;
                }
                else {
                    const testId = origFunction.testId;
                    // Remove this test if it exists from generatedTests
                    if (testId) {
                        const { ids, byIds } = state.generatedTests;
                        const index = ids.indexOf(testId);
                        if (index >= 0) {
                            ids.splice(index, 1);
                            delete byIds[testId];
                        }
                    }
                }
            }
            else {
                existingFunctionId = nextId(byIds);
                ids.push(existingFunctionId);
            }
            // In every other case, we need to first update the state, then recompute the test later
            byIds[existingFunctionId] = {
                id: existingFunctionId,
                fileName,
                functionName,
                functionBody,
                // range,
                lastUpdated: Date.now(),
                testId: null,
            };
        },
        upsertTest(state, action) {
            const generatedTests = state.generatedTests;
            const { ids, byIds } = generatedTests;
            const { functionId, fileName, testCode, insertLocation } = action.payload;
            const existingTestIds = findTestIds(state, { functionId, fileName });
            // Next we get the test file name from the redux store
            let testFileName;
            if (fileName in state.testFiles.map) {
                testFileName = state.testFiles.map[fileName];
            }
            else {
                testFileName = null;
            }
            if (existingTestIds.length > 0) {
                const [testId, ...others] = existingTestIds;
                byIds[testId].testCode = testCode;
                byIds[testId].insertLocation = insertLocation;
            }
            else {
                const id = nextId(byIds);
                ids.push(id);
                byIds[id] = {
                    id,
                    functionId,
                    fileName: action.payload.fileName,
                    functionName: action.payload.functionName,
                    functionBody: action.payload.functionBody,
                    testFileName,
                    testCode,
                    insertLocation,
                    generated: false,
                };
            }
        },
    },
});
// Export the actions
export const { addTestFileMap, upsertFunction, upsertTest, finishedGenerating, requestTestFileName, closeTestFileName, } = testSlice.actions;
// // Export the reducer
export default testSlice.reducer;
