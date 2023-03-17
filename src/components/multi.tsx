import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useAppDispatch, useAppSelector } from '../app/hooks';
import { getTab, } from '../features/selectors';
import { CodeBlock } from './markdown';
import { Text } from '@codemirror/state';
import { getIconElement } from './filetree';
import { useMemo, useState } from 'react';
export function MultiSnippet({ snippet, useDiff, }) {
    const dispatch = useAppDispatch();
    const iconElement = getIconElement(snippet.fileName);
    return (_jsxs("div", Object.assign({ className: "multieditor__snippet" }, { children: [_jsx("div", Object.assign({ className: "multieditor__snippet_header" }, { children: _jsxs("div", Object.assign({ className: "file__line file__no_highlight" }, { children: [_jsx("div", Object.assign({ className: "file__icon" }, { children: iconElement })), _jsx("div", Object.assign({ className: "file__name" }, { children: snippet.fileName })), _jsx("div", Object.assign({ className: "file__path" }, { children: snippet.folderPath }))] })) })), _jsx("div", Object.assign({ className: "multieditor__snippet_body" }, { children: _jsx(CodeBlock, { className: "language-typescript", children: snippet.contents, startLine: snippet.startLine, setDiffArgs: useDiff ? snippet.diff : null, isEditable: true }, String(useDiff)) }))] })));
}
export function MultiEditor({ tabId }) {
    const dispatch = useAppDispatch();
    const tab = useAppSelector(getTab(tabId));
    const [isAccepted, setIsAccepted] = useState(false);
    const newSnippets = [
        {
            fileName: 'main.ts',
            folderPath: 'src',
            contents: `
        [
          {
            label: 'Zoom In',
            click: () => {
              main_window.webContents.send('zoom_in')
            },
            accelerator: 'cmd+plus'
          },
          {
            label: 'Zoom Out',
            click: () => {
              main_window.webContents.send('zoom_out')
            },
            accelerator: 'cmd+-'
          },
          {
            label: 'Reset Zoom',
            click: () => {
              main_window.webContents.send('zoom_reset')
            },
            accelerator: 'cmd+0'
          },
          {
            label: 'Search',
            click: () => {
              main_window.webContents.send('search')
            },
            accelerator: 'cmd+shift+f'
          },
          {
            label: 'File Search',
            click: () => {
              main_window.webContents.send('fileSearch')
            },
            accelerator: 'cmd+p'
          }
        ]
            `,
            startLine: 106,
        },
        {
            fileName: 'listeners.ts',
            folderPath: 'src',
            contents: `
// @ts-ignore
connector.registerZoom((zoom: number) => {
  store.dispatch(gs.setZoomFactor(zoom));
});

// @ts-ignore
connector.registerSearch(() => store.dispatch(ts.openSearch()));

// @ts-ignore
connector.registerSearch(() => store.dispatch(ts.triggerFileSearch()));

// @ts-ignore
connector.registerGetDefinition((payload: {path: string, offset: number}) => {
  console.log('dispatching');
  console.log(payload);
  store.dispatch(gs.gotoDefinition(payload));
});
            `,
            startLine: 50,
        },
        {
            fileName: 'preload.ts',
            folderPath: 'src',
            contents: `
  registerZoom: (callback: (arg: number) => void) => {
    function def() {
      webFrame.setZoomLevel(-2)
      callback(webFrame.getZoomFactor())
    }
    def()
    ipcRenderer.on('zoom_in', () => {
      webFrame.setZoomLevel(webFrame.getZoomLevel() + 1)
      callback(webFrame.getZoomFactor())
    })
    ipcRenderer.on('zoom_out', () => {
      webFrame.setZoomLevel(webFrame.getZoomLevel() - 1)
      callback(webFrame.getZoomFactor())
    })
    ipcRenderer.on('zoom_reset', () => {
      def()
    })
  },
  registerSearch: (callback: Callback) => ipcRenderer.on('search', callback),
  registerFileSearch: (callback: Callback) => ipcRenderer.on('fileSearch', callback),
  ...clientPreloads(),
  registerGetDefinition(callback: (arg: any) => void) {
    ipcRenderer.on('getDefinition', (event, data) => {
      callback(data)
    })
  },
  `,
            startLine: 103,
        },
    ];
    const snippets = [
        {
            fileName: 'main.ts',
            folderPath: 'src',
            diff: {
                origLine: 29,
                origEndLine: 29,
                newText: Text.of(`          },
          {
            label: 'File Search',
            click: () => {
              main_window.webContents.send('fileSearch')
            },
            accelerator: 'cmd+p'
          }`.split('\n')),
            },
            contents: `
        [
          {
            label: 'Zoom In',
            click: () => {
              main_window.webContents.send('zoom_in')
            },
            accelerator: 'cmd+plus'
          },
          {
            label: 'Zoom Out',
            click: () => {
              main_window.webContents.send('zoom_out')
            },
            accelerator: 'cmd+-'
          },
          {
            label: 'Reset Zoom',
            click: () => {
              main_window.webContents.send('zoom_reset')
            },
            accelerator: 'cmd+0'
          },
          {
            label: 'Search',
            click: () => {
              main_window.webContents.send('search')
            },
            accelerator: 'cmd+shift+f'
          }
        ]
            `,
            startLine: 106,
        },
        {
            fileName: 'listeners.ts',
            folderPath: 'src',
            diff: {
                origLine: 8,
                origEndLine: 8,
                newText: Text.of([
                    '// @ts-ignore',
                    'connector.registerFileSearch(() => store.dispatch(ts.triggerFileSearch()));',
                    '',
                ]),
            },
            contents: `
// @ts-ignore
connector.registerZoom((zoom: number) => {
  store.dispatch(gs.setZoomFactor(zoom));
});

// @ts-ignore
connector.registerSearch(() => store.dispatch(ts.openSearch()));

// @ts-ignore
connector.registerGetDefinition((payload: {path: string, offset: number}) => {
  console.log('dispatching');
  console.log(payload);
  store.dispatch(gs.gotoDefinition(payload));
});
            `,
            startLine: 50,
        },
        {
            fileName: 'preload.ts',
            folderPath: 'src',
            diff: {
                origLine: 20,
                origEndLine: 20,
                newText: Text.of(`  registerFileSearch: (callback: Callback) => ipcRenderer.on('fileSearch', callback),
  ...clientPreloads(),`.split('\n')),
            },
            contents: `
  registerZoom: (callback: (arg: number) => void) => {
    function def() {
      webFrame.setZoomLevel(-2)
      callback(webFrame.getZoomFactor())
    }
    def()
    ipcRenderer.on('zoom_in', () => {
      webFrame.setZoomLevel(webFrame.getZoomLevel() + 1)
      callback(webFrame.getZoomFactor())
    })
    ipcRenderer.on('zoom_out', () => {
      webFrame.setZoomLevel(webFrame.getZoomLevel() - 1)
      callback(webFrame.getZoomFactor())
    })
    ipcRenderer.on('zoom_reset', () => {
      def()
    })
  },
  registerSearch: (callback: Callback) => ipcRenderer.on('search', callback),
  ...clientPreloads(),
  registerGetDefinition(callback: (arg: any) => void) {
    ipcRenderer.on('getDefinition', (event, data) => {
      callback(data)
    })
  },
  `,
            startLine: 103,
        },
    ];
    const snippetElements = useMemo(() => {
        let usedSnippets;
        let useDiff;
        if (!isAccepted) {
            usedSnippets = snippets;
            useDiff = tab.isMultiDiff;
        }
        else {
            usedSnippets = newSnippets;
            useDiff = false;
        }
        return usedSnippets.map((snippet) => {
            return (_jsx(MultiSnippet, { snippet: snippet, useDiff: useDiff }, snippet.fileName));
        });
    }, [isAccepted, tab.isMultiDiff]);
    return (_jsx(_Fragment, { children: _jsxs("div", Object.assign({ className: "multieditor" }, { children: [tab.isMultiDiff && !isAccepted && (_jsxs("div", Object.assign({ className: "multieditor__header" }, { children: [_jsx("button", Object.assign({ className: "multieditor__header_accept", onClick: (e) => {
                                e.preventDefault();
                                setIsAccepted(true);
                            } }, { children: "Accept All" })), _jsx("button", Object.assign({ className: "multieditor__header_reject", onClick: (e) => {
                                e.preventDefault();
                            } }, { children: "Reject All" }))] }))), snippetElements] })) }));
}
