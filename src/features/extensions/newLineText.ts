import { ViewPlugin } from '@codemirror/view';
import { EditorView, Decoration } from '@codemirror/view';
import { WidgetType } from '@codemirror/view';
class LineText extends WidgetType {
    constructor(checked) {
        super();
        this.checked = checked;
    }
    toDOM() {
        let wrap = document.createElement('span');
        wrap.setAttribute('aria-hidden', 'true');
        wrap.className = 'cm-newline-text';
        wrap.textContent = `Type ${connector.PLATFORM_META_KEY}K to generate.`;
        return wrap;
    }
}
function checkboxes(view) {
    let widgets = [];
    const pos = view.state.selection.main.head;
    const line = view.state.doc.lineAt(pos);
    const emptySelection = view.state.selection.main.empty;
    const emtpyLine = line.text.trim().length == 0;
    if (emptySelection && emtpyLine) {
        widgets.push(Decoration.widget({ widget: new LineText(true), side: 1 }).range(pos));
    }
    return Decoration.set(widgets);
}
export const newLineText = [
    ViewPlugin.fromClass(class {
        constructor(view) {
            this.decorations = checkboxes(view);
        }
        update(update) {
            if (update.docChanged ||
                update.viewportChanged ||
                update.selectionSet)
                this.decorations = checkboxes(update.view);
        }
    }, {
        decorations: (v) => v.decorations,
    }),
    EditorView.baseTheme({
        '.cm-newline-text': {
            color: 'rgba(118, 164, 214, 0.5)',
        },
    }),
];
