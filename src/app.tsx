import { jsx as _jsx } from "react/jsx-runtime";
const originalConsoleLog = console.log.bind(console);
const toFile = (msg) => {
    //@ts-ignore
    connector.logToFile(msg);
    originalConsoleLog(msg);
};
// console.log = (...args) => {
//   toFile(args);
// }
// window.onerror = (err: any) => {
//   toFile(err);
// }
import * as ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './app/store';
import { App } from './appComponent';
import Modal from 'react-modal';
// Write a function to
Modal.setAppElement('#root');
const container = document.getElementById('root');
// const container = document.getElementById("root");
const root = ReactDOM.createRoot(container);
root.render(_jsx(Provider, Object.assign({ store: store }, { children: _jsx(App, {}) })));
