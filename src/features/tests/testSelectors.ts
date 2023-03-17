import { createSelector } from 'reselect';
export const getTests = (filePath) => createSelector((state) => state.test, (testState) => {
    return [
        ...Object.values(testState.generatedTests.byIds).filter((test) => 
        /* todo change the right */ test.fileName /* todo change the left */ ===
            filePath),
    ];
});
export const isTestModalVisible = (filePath) => createSelector((state) => state.test, (testState) => {
    return (filePath != null &&
        testState.requestingTestDir.includes(filePath) &&
        !(filePath in testState.testFiles.map));
});
export const selectHasTests = (filePath) => createSelector((state) => state.test, (testState) => {
    console.log('TESTFILES', testState.testFiles);
    return filePath in testState.testFiles.map;
});
