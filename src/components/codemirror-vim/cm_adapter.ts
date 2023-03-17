import { EditorSelection, MapMode } from '@codemirror/state';
import { StringStream, matchBrackets, indentUnit, ensureSyntaxTree, foldCode, } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { RegExpCursor, setSearchQuery, SearchQuery } from '@codemirror/search';
import { insertNewlineAndIndent, indentMore, indentLess, indentSelection, deleteCharBackward, deleteCharForward, cursorCharLeft, undo, redo, cursorLineBoundaryBackward, cursorLineBoundaryForward, cursorCharBackward, } from '@codemirror/commands';
function indexFromPos(doc, pos) {
    var ch = pos.ch;
    var lineNumber = pos.line + 1;
    if (lineNumber < 1) {
        lineNumber = 1;
        ch = 0;
    }
    if (lineNumber > doc.lines) {
        lineNumber = doc.lines;
        ch = Number.MAX_VALUE;
    }
    var line = doc.line(lineNumber);
    return Math.min(line.from + Math.max(0, ch), line.to);
}
function posFromIndex(doc, offset) {
    let line = doc.lineAt(offset);
    return { line: line.number - 1, ch: offset - line.from };
}
class Pos {
    constructor(line, ch) {
        this.line = line;
        this.ch = ch;
    }
}
function on(emitter, type, f) {
    if (emitter.addEventListener) {
        emitter.addEventListener(type, f, false);
    }
    else {
        var map = emitter._handlers || (emitter._handlers = {});
        map[type] = (map[type] || []).concat(f);
    }
}
function off(emitter, type, f) {
    if (emitter.removeEventListener) {
        emitter.removeEventListener(type, f, false);
    }
    else {
        var map = emitter._handlers, arr = map && map[type];
        if (arr) {
            var index = arr.indexOf(f);
            if (index > -1) {
                map[type] = arr.slice(0, index).concat(arr.slice(index + 1));
            }
        }
    }
}
function signal(emitter, type, ...args) {
    var _a;
    var handlers = (_a = emitter._handlers) === null || _a === void 0 ? void 0 : _a[type];
    if (!handlers)
        return;
    for (var i = 0; i < handlers.length; ++i) {
        handlers[i](...args);
    }
}
function signalTo(handlers, ...args) {
    if (!handlers)
        return;
    for (var i = 0; i < handlers.length; ++i) {
        handlers[i](...args);
    }
}
var specialKey = {
    Return: 'CR',
    Backspace: 'BS',
    Delete: 'Del',
    Escape: 'Esc',
    Insert: 'Ins',
    ArrowLeft: 'Left',
    ArrowRight: 'Right',
    ArrowUp: 'Up',
    ArrowDown: 'Down',
    Enter: 'CR',
    ' ': 'Space',
};
var ignoredKeys = {
    Shift: 1,
    Alt: 1,
    Command: 1,
    Control: 1,
    CapsLock: 1,
    AltGraph: 1,
    Dead: 1,
};
let wordChar;
try {
    wordChar = new RegExp('[\\w\\p{Alphabetic}\\p{Number}_]', 'u');
}
catch (_) {
    wordChar = /[\w]/;
}
// workaround for missing api for merging transactions
function dispatchChange(cm, transaction) {
    var view = cm.cm6;
    var type = 'input.type.compose';
    if (cm.curOp) {
        if (!cm.curOp.lastChange)
            type = 'input.type.compose.start';
    }
    if (transaction.annotations) {
        try {
            transaction.annotations.some(function (note) {
                if (note.value == 'input')
                    note.value = type;
            });
        }
        catch (e) {
            console.error(e);
        }
    }
    else {
        transaction.userEvent = type;
    }
    return view.dispatch(transaction);
}
function runHistoryCommand(cm, revert) {
    var _a;
    if (cm.curOp) {
        cm.curOp.$changeStart = undefined;
    }
    ;
    (revert ? undo : redo)(cm.cm6);
    let changeStartIndex = (_a = cm.curOp) === null || _a === void 0 ? void 0 : _a.$changeStart;
    // vim mode expects the changed text to be either selected or cursor placed at the start
    if (changeStartIndex != null) {
        cm.cm6.dispatch({ selection: { anchor: changeStartIndex } });
    }
}
export class CodeMirror {
    // --------------------------
    openDialog(template, callback, options) {
        return openDialog(this, template, callback, options);
    }
    openNotification(template, options) {
        return openNotification(this, template, options);
    }
    constructor(cm6) {
        this.state = {};
        this.marks = Object.create(null);
        this.$mid = 0; // marker id counter
        this.options = {};
        this._handlers = {};
        // TODO change vim.js to not use obscure api
        this.doc = {
            history: {
                done: [
                    {
                        changes: [
                            {
                                cm: this,
                                get to() {
                                    return this.cm.posFromIndex(this.cm.$lastChangeEndOffset);
                                },
                            },
                        ],
                    },
                ],
            },
        };
        this.$lastChangeEndOffset = 0;
        this.virtualSelection = null;
        this.cm6 = cm6;
        this.onChange = this.onChange.bind(this);
        this.onSelectionChange = this.onSelectionChange.bind(this);
    }
    on(type, f) {
        on(this, type, f);
    }
    off(type, f) {
        off(this, type, f);
    }
    signal(type, e, handlers) {
        signal(this, type, e, handlers);
    }
    indexFromPos(pos) {
        return indexFromPos(this.cm6.state.doc, pos);
    }
    posFromIndex(offset) {
        return posFromIndex(this.cm6.state.doc, offset);
    }
    foldCode(pos) {
        let view = this.cm6;
        let ranges = view.state.selection.ranges;
        let doc = this.cm6.state.doc;
        let index = indexFromPos(doc, pos);
        let tmpRanges = EditorSelection.create([EditorSelection.range(index, index)], 0).ranges;
        view.state.selection.ranges = tmpRanges;
        foldCode(view);
        view.state.selection.ranges = ranges;
    }
    firstLine() {
        return 0;
    }
    lastLine() {
        return this.cm6.state.doc.lines - 1;
    }
    lineCount() {
        return this.cm6.state.doc.lines;
    }
    setCursor(line, ch) {
        if (typeof line === 'object') {
            ch = line.ch;
            line = line.line;
        }
        var offset = indexFromPos(this.cm6.state.doc, { line, ch });
        this.cm6.dispatch({ selection: { anchor: offset } }, { scrollIntoView: !this.curOp });
        if (this.curOp && !this.curOp.isVimOp)
            this.onBeforeEndOperation();
    }
    getCursor(p) {
        var sel = this.cm6.state.selection.main;
        var offset = p == 'head' || !p
            ? sel.head
            : p == 'anchor'
                ? sel.anchor
                : p == 'start'
                    ? sel.from
                    : p == 'end'
                        ? sel.to
                        : null;
        if (offset == null)
            throw new Error('Invalid cursor type');
        return this.posFromIndex(offset);
    }
    listSelections() {
        var doc = this.cm6.state.doc;
        return this.cm6.state.selection.ranges.map((r) => {
            return {
                anchor: posFromIndex(doc, r.anchor),
                head: posFromIndex(doc, r.head),
            };
        });
    }
    setSelections(p, primIndex) {
        var doc = this.cm6.state.doc;
        var ranges = p.map((x) => {
            return EditorSelection.range(indexFromPos(doc, x.anchor), indexFromPos(doc, x.head));
        });
        this.cm6.dispatch({
            selection: EditorSelection.create(ranges, primIndex),
        });
    }
    setSelection(anchor, head, options) {
        var doc = this.cm6.state.doc;
        var ranges = [
            EditorSelection.range(indexFromPos(doc, anchor), indexFromPos(doc, head)),
        ];
        this.cm6.dispatch({
            selection: EditorSelection.create(ranges, 0),
        });
        if (options && options.origin == '*mouse') {
            this.onBeforeEndOperation();
        }
    }
    getLine(row) {
        var doc = this.cm6.state.doc;
        if (row < 0 || row >= doc.lines)
            return '';
        return this.cm6.state.doc.line(row + 1).text;
    }
    getLineHandle(row) {
        return { text: this.getLine(row), row: row };
    }
    getLineNumber(handle) {
        return handle.row;
    }
    getRange(s, e) {
        var doc = this.cm6.state.doc;
        return this.cm6.state.sliceDoc(indexFromPos(doc, s), indexFromPos(doc, e));
    }
    replaceRange(text, s, e) {
        if (!e)
            e = s;
        var doc = this.cm6.state.doc;
        var from = indexFromPos(doc, s);
        var to = indexFromPos(doc, e);
        dispatchChange(this, { changes: { from, to, insert: text } });
    }
    replaceSelection(text) {
        dispatchChange(this, this.cm6.state.replaceSelection(text));
    }
    replaceSelections(replacements) {
        var ranges = this.cm6.state.selection.ranges;
        var changes = ranges.map((r, i) => {
            return { from: r.from, to: r.to, insert: replacements[i] || '' };
        });
        dispatchChange(this, { changes });
    }
    getSelection() {
        return this.getSelections().join('\n');
    }
    getSelections() {
        var cm = this.cm6;
        return cm.state.selection.ranges.map((r) => cm.state.sliceDoc(r.from, r.to));
    }
    somethingSelected() {
        return this.cm6.state.selection.ranges.some((r) => !r.empty);
    }
    getInputField() {
        return this.cm6.contentDOM;
    }
    clipPos(p) {
        var doc = this.cm6.state.doc;
        var ch = p.ch;
        var lineNumber = p.line + 1;
        if (lineNumber < 1) {
            lineNumber = 1;
            ch = 0;
        }
        if (lineNumber > doc.lines) {
            lineNumber = doc.lines;
            ch = Number.MAX_VALUE;
        }
        var line = doc.line(lineNumber);
        ch = Math.min(Math.max(0, ch), line.to - line.from);
        return new Pos(lineNumber - 1, ch);
    }
    getValue() {
        return this.cm6.state.doc.toString();
    }
    setValue(text) {
        var cm = this.cm6;
        return cm.dispatch({
            changes: { from: 0, to: cm.state.doc.length, insert: text },
            selection: EditorSelection.range(0, 0),
        });
    }
    focus() {
        return this.cm6.focus();
    }
    blur() {
        return this.cm6.contentDOM.blur();
    }
    defaultTextHeight() {
        return this.cm6.defaultLineHeight;
    }
    findMatchingBracket(pos) {
        var state = this.cm6.state;
        var offset = indexFromPos(state.doc, pos);
        var m = matchBrackets(state, offset + 1, -1);
        if (m && m.end) {
            return { to: posFromIndex(state.doc, m.end.from) };
        }
        m = matchBrackets(state, offset, 1);
        if (m && m.end) {
            return { to: posFromIndex(state.doc, m.end.from) };
        }
        return { to: undefined };
    }
    scanForBracket(pos, dir, style, config) {
        return scanForBracket(this, pos, dir, style, config);
    }
    indentLine(line, more) {
        // todo how to indent only one line instead of selection
        if (more)
            this.indentMore();
        else
            this.indentLess();
    }
    indentMore() {
        indentMore(this.cm6);
    }
    indentLess() {
        indentLess(this.cm6);
    }
    execCommand(name) {
        if (name == 'indentAuto')
            CodeMirror.commands.indentAuto(this);
        else if (name == 'goLineLeft')
            cursorLineBoundaryBackward(this.cm6);
        else if (name == 'goLineRight') {
            cursorLineBoundaryForward(this.cm6);
            cursorCharBackward(this.cm6);
        }
        else
            console.log(name + ' is not implemented');
    }
    setBookmark(cursor, options) {
        var assoc = (options === null || options === void 0 ? void 0 : options.insertLeft) ? 1 : -1;
        var offset = this.indexFromPos(cursor);
        var bm = new Marker(this, offset, assoc);
        return bm;
    }
    addOverlay({ query }) {
        let cm6Query = new SearchQuery({
            regexp: true,
            search: query.source,
            caseSensitive: !/i/.test(query.flags),
        });
        if (cm6Query.valid) {
            ;
            cm6Query.forVim = true;
            this.cm6Query = cm6Query;
            let effect = setSearchQuery.of(cm6Query);
            this.cm6.dispatch({ effects: effect });
            return cm6Query;
        }
    }
    removeOverlay(overlay) {
        if (!this.cm6Query)
            return;
        this.cm6Query.forVim = false;
        let effect = setSearchQuery.of(this.cm6Query);
        this.cm6.dispatch({ effects: effect });
    }
    getSearchCursor(query, pos) {
        var cm = this;
        var last = null;
        var lastCM5Result = null;
        if (pos.ch == undefined)
            pos.ch = Number.MAX_VALUE;
        var firstOffset = indexFromPos(cm.cm6.state.doc, pos);
        var source = query.source.replace(/(\\.|{(?:\d+(?:,\d*)?|,\d+)})|[{}]/g, function (a, b) {
            if (!b)
                return '\\' + a;
            return b;
        });
        function rCursor(doc, from = 0, to = doc.length) {
            return new RegExpCursor(doc, source, { ignoreCase: query.ignoreCase }, from, to);
        }
        function nextMatch(from) {
            var doc = cm.cm6.state.doc;
            if (from > doc.length)
                return null;
            let res = rCursor(doc, from).next();
            return res.done ? null : res.value;
        }
        var ChunkSize = 10000;
        function prevMatchInRange(from, to) {
            var doc = cm.cm6.state.doc;
            for (let size = 1;; size++) {
                let start = Math.max(from, to - size * ChunkSize);
                let cursor = rCursor(doc, start, to), range = null;
                while (!cursor.next().done)
                    range = cursor.value;
                if (range && (start == from || range.from > start + 10))
                    return range;
                if (start == from)
                    return null;
            }
        }
        return {
            findNext: function () {
                return this.find(false);
            },
            findPrevious: function () {
                return this.find(true);
            },
            find: function (back) {
                var doc = cm.cm6.state.doc;
                if (back) {
                    let endAt = last
                        ? last.from == last.to
                            ? last.to - 1
                            : last.from
                        : firstOffset;
                    last = prevMatchInRange(0, endAt);
                }
                else {
                    let startFrom = last
                        ? last.from == last.to
                            ? last.to + 1
                            : last.to
                        : firstOffset;
                    last = nextMatch(startFrom);
                }
                lastCM5Result = last && {
                    from: posFromIndex(doc, last.from),
                    to: posFromIndex(doc, last.to),
                    match: last.match,
                };
                return last && last.match;
            },
            from: function () {
                return lastCM5Result === null || lastCM5Result === void 0 ? void 0 : lastCM5Result.from;
            },
            to: function () {
                return lastCM5Result === null || lastCM5Result === void 0 ? void 0 : lastCM5Result.to;
            },
            replace: function (text) {
                if (last) {
                    dispatchChange(cm, {
                        changes: { from: last.from, to: last.to, insert: text },
                    });
                    last.to = last.from + text.length;
                    if (lastCM5Result) {
                        lastCM5Result.to = posFromIndex(cm.cm6.state.doc, last.to);
                    }
                }
            },
        };
    }
    findPosV(start, amount, unit, goalColumn) {
        let { cm6 } = this;
        const doc = cm6.state.doc;
        let pixels = unit == 'page' ? cm6.dom.clientHeight : 0;
        const startOffset = indexFromPos(doc, start);
        let range = EditorSelection.range(startOffset, startOffset, goalColumn);
        let count = Math.round(Math.abs(amount));
        for (let i = 0; i < count; i++) {
            if (unit == 'page') {
                range = cm6.moveVertically(range, amount > 0, pixels);
            }
            else if (unit == 'line') {
                range = cm6.moveVertically(range, amount > 0);
            }
        }
        let pos = posFromIndex(doc, range.head);
        // set hitside to true if there was no place to move and cursor was clipped to the edge
        // of document. Needed for gj/gk
        if ((amount < 0 &&
            range.head == 0 &&
            goalColumn != 0 &&
            start.line == 0 &&
            start.ch != 0) ||
            (amount > 0 &&
                range.head == doc.length &&
                pos.ch != goalColumn &&
                start.line == pos.line)) {
            pos.hitSide = true;
        }
        return pos;
    }
    charCoords(pos, mode) {
        var rect = this.cm6.contentDOM.getBoundingClientRect();
        var offset = indexFromPos(this.cm6.state.doc, pos);
        var coords = this.cm6.coordsAtPos(offset);
        var d = -rect.top;
        return {
            left: ((coords === null || coords === void 0 ? void 0 : coords.left) || 0) - rect.left,
            top: ((coords === null || coords === void 0 ? void 0 : coords.top) || 0) + d,
            bottom: ((coords === null || coords === void 0 ? void 0 : coords.bottom) || 0) + d,
        };
    }
    coordsChar(coords, mode) {
        var rect = this.cm6.contentDOM.getBoundingClientRect();
        var offset = this.cm6.posAtCoords({
            x: coords.left + rect.left,
            y: coords.top + rect.top,
        }) || 0;
        return posFromIndex(this.cm6.state.doc, offset);
    }
    getScrollInfo() {
        var scroller = this.cm6.scrollDOM;
        return {
            left: scroller.scrollLeft,
            top: scroller.scrollTop,
            height: scroller.scrollHeight,
            width: scroller.scrollWidth,
            clientHeight: scroller.clientHeight,
            clientWidth: scroller.clientWidth,
        };
    }
    scrollTo(x, y) {
        if (x != null)
            this.cm6.scrollDOM.scrollLeft = x;
        if (y != null)
            this.cm6.scrollDOM.scrollTop = y;
    }
    scrollIntoView(pos, margin) {
        if (pos) {
            var offset = this.indexFromPos(pos);
            this.cm6.dispatch({
                effects: EditorView.scrollIntoView(offset),
            });
        }
        else {
            this.cm6.dispatch({ scrollIntoView: true, userEvent: 'scroll' });
        }
    }
    getWrapperElement() {
        return this.cm6.dom;
    }
    // for tests
    getMode() {
        return { name: this.getOption('mode') };
    }
    setSize(w, h) {
        this.cm6.dom.style.width = w + 4 + 'px';
        this.cm6.dom.style.height = h + 'px';
        this.refresh();
    }
    refresh() {
        ;
        this.cm6.measure();
    }
    // event listeners
    destroy() {
        this.removeOverlay();
    }
    onChange(update) {
        for (let i in this.marks) {
            let m = this.marks[i];
            m.update(update.changes);
        }
        if (this.virtualSelection) {
            // this.virtualSelection.ranges = this.virtualSelection.ranges.map(range => range.map(update.changes))
            for (let i = 0; i < this.virtualSelection.ranges.length; i++) {
                //this.virtualSelection.ranges[i] = this.virtualSelection.ranges[i].map(update.changes)
            }
        }
        var curOp = (this.curOp = this.curOp || {});
        update.changes.iterChanges((fromA, toA, fromB, toB, text) => {
            if (curOp.$changeStart == null || curOp.$changeStart > fromB)
                curOp.$changeStart = fromB;
            this.$lastChangeEndOffset = toB;
            var change = { text: text.toJSON() };
            if (!curOp.lastChange) {
                curOp.lastChange = curOp.change = change;
            }
            else {
                curOp.lastChange.next = curOp.lastChange = change;
            }
        }, true);
        if (!curOp.changeHandlers)
            curOp.changeHandlers =
                this._handlers['change'] && this._handlers['change'].slice();
    }
    onSelectionChange() {
        var curOp = (this.curOp = this.curOp || {});
        if (!curOp.cursorActivityHandlers)
            curOp.cursorActivityHandlers =
                this._handlers['cursorActivity'] &&
                    this._handlers['cursorActivity'].slice();
        this.curOp.cursorActivity = true;
    }
    operation(fn) {
        if (!this.curOp)
            this.curOp = { $d: 0 };
        this.curOp.$d++;
        try {
            var result = fn();
        }
        finally {
            if (this.curOp) {
                this.curOp.$d--;
                if (!this.curOp.$d)
                    this.onBeforeEndOperation();
            }
        }
        return result;
    }
    onBeforeEndOperation() {
        var op = this.curOp;
        var scrollIntoView = false;
        if (op) {
            if (op.change) {
                signalTo(op.changeHandlers, this, op.change);
            }
            if (op && op.cursorActivity) {
                signalTo(op.cursorActivityHandlers, this, null);
                if (op.isVimOp)
                    scrollIntoView = true;
            }
            this.curOp = null;
        }
        if (scrollIntoView)
            this.scrollIntoView();
    }
    moveH(increment, unit) {
        if (unit == 'char') {
            // todo
            var cur = this.getCursor();
            this.setCursor(cur.line, cur.ch + increment);
        }
    }
    setOption(name, val) {
        switch (name) {
            case 'keyMap':
                this.state.keyMap = val;
                break;
            // TODO cm6 doesn't provide any method to reconfigure these
            case 'tabSize':
            case 'indentWithTabs':
                break;
        }
    }
    getOption(name) {
        switch (name) {
            case 'firstLineNumber':
                return 1;
            case 'tabSize':
                return this.cm6.state.tabSize || 4;
            case 'readonly':
                return this.cm6.state.readOnly;
            case 'indentWithTabs':
                return this.cm6.state.facet(indentUnit) == '\t'; // TODO
            case 'indentUnit':
                return this.cm6.state.facet(indentUnit).length || 2;
            // for tests
            case 'keyMap':
                return this.state.keyMap || 'vim';
        }
    }
    toggleOverwrite(on) {
        this.state.overwrite = on;
    }
    getTokenTypeAt(pos) {
        var _a;
        // only comment|string are needed
        var offset = this.indexFromPos(pos);
        var tree = ensureSyntaxTree(this.cm6.state, offset);
        var node = tree === null || tree === void 0 ? void 0 : tree.resolve(offset);
        var type = ((_a = node === null || node === void 0 ? void 0 : node.type) === null || _a === void 0 ? void 0 : _a.name) || '';
        if (/comment/i.test(type))
            return 'comment';
        if (/string/i.test(type))
            return 'string';
        return '';
    }
    overWriteSelection(text) {
        var doc = this.cm6.state.doc;
        var sel = this.cm6.state.selection;
        var ranges = sel.ranges.map((x) => {
            if (x.empty) {
                var ch = x.to < doc.length ? doc.sliceString(x.from, x.to + 1) : '';
                if (ch && !/\n/.test(ch))
                    return EditorSelection.range(x.from, x.to + 1);
            }
            return x;
        });
        this.cm6.dispatch({
            selection: EditorSelection.create(ranges, sel.mainIndex),
        });
        this.replaceSelection(text);
    }
    /*** multiselect ****/
    isInMultiSelectMode() {
        return this.cm6.state.selection.ranges.length > 1;
    }
    virtualSelectionMode() {
        return !!this.virtualSelection;
    }
    forEachSelection(command) {
        var selection = this.cm6.state.selection;
        this.virtualSelection = EditorSelection.create(selection.ranges, selection.mainIndex);
        for (var i = 0; i < this.virtualSelection.ranges.length; i++) {
            var range = this.virtualSelection.ranges[i];
            if (!range)
                continue;
            this.cm6.dispatch({ selection: EditorSelection.create([range]) });
            command();
            this.virtualSelection.ranges[i] =
                this.cm6.state.selection.ranges[0];
        }
        this.cm6.dispatch({ selection: this.virtualSelection });
        this.virtualSelection = null;
    }
}
// --------------------------
CodeMirror.Pos = Pos;
CodeMirror.StringStream = StringStream;
CodeMirror.commands = {
    cursorCharLeft: function (cm) {
        cursorCharLeft(cm.cm6);
    },
    redo: function (cm) {
        runHistoryCommand(cm, false);
    },
    undo: function (cm) {
        runHistoryCommand(cm, true);
    },
    newlineAndIndent: function (cm) {
        insertNewlineAndIndent({
            state: cm.cm6.state,
            dispatch: (tr) => {
                return dispatchChange(cm, tr);
            },
        });
    },
    indentAuto: function (cm) {
        indentSelection(cm.cm6);
    },
};
CodeMirror.defineOption = function (name, val, setter) { };
CodeMirror.isWordChar = function (ch) {
    return wordChar.test(ch);
};
CodeMirror.keys = {
    Backspace: function (cm) {
        deleteCharBackward(cm.cm6);
    },
    Delete: function (cm) {
        deleteCharForward(cm.cm6);
    },
};
CodeMirror.keyMap = {};
CodeMirror.addClass = function () { };
CodeMirror.rmClass = function () { };
CodeMirror.e_preventDefault = function (e) {
    e.preventDefault();
};
CodeMirror.e_stop = function (e) {
    var _a, _b;
    (_a = e === null || e === void 0 ? void 0 : e.stopPropagation) === null || _a === void 0 ? void 0 : _a.call(e);
    (_b = e === null || e === void 0 ? void 0 : e.preventDefault) === null || _b === void 0 ? void 0 : _b.call(e);
};
CodeMirror.keyName = function (e) {
    var key = e.key;
    if (ignoredKeys[key])
        return;
    if (key == 'Escape')
        key = 'Esc';
    if (key == ' ')
        key = 'Space';
    if (key.length > 1) {
        key = key.replace(/Numpad|Arrow/, '');
    }
    if (key.length == 1)
        key = key.toUpperCase();
    var name = '';
    if (e.ctrlKey) {
        name += 'Ctrl-';
    }
    if (e.altKey) {
        name += 'Alt-';
    }
    if ((name || key.length > 1) && e.shiftKey) {
        name += 'Shift-';
    }
    name += key;
    return name;
};
CodeMirror.vimKey = function vimKey(e) {
    var key = e.key;
    if (ignoredKeys[key])
        return;
    if (key.length > 1 && key[0] == 'n') {
        key = key.replace('Numpad', '');
    }
    key = specialKey[key] || key;
    var name = '';
    if (e.ctrlKey) {
        name += 'C-';
    }
    if (e.altKey) {
        name += 'A-';
    }
    if (e.metaKey) {
        name += 'M-';
    }
    // on mac many characters are entered as option- combos
    // (e.g. on swiss keyboard { is option-8)
    // so we ignore lonely A- modifier for keypress event on mac
    if (e.type == 'keypress' && e.altKey && !e.metaKey && !e.ctrlKey) {
        name = name.slice(2);
    }
    if ((name || key.length > 1) && e.shiftKey) {
        name += 'S-';
    }
    name += key;
    if (name.length > 1) {
        name = '<' + name + '>';
    }
    return name;
};
CodeMirror.lookupKey = function lookupKey(key, map, handle) {
    var result = CodeMirror.keys[key];
    if (result)
        handle(result);
};
CodeMirror.on = on;
CodeMirror.off = off;
CodeMirror.signal = signal;
CodeMirror.findMatchingTag = findMatchingTag;
CodeMirror.findEnclosingTag = findEnclosingTag;
/************* dialog *************/
function dialogDiv(cm, template, bottom) {
    var dialog = document.createElement('div');
    dialog.appendChild(template);
    return dialog;
}
function closeNotification(cm, newVal) {
    if (cm.state.currentNotificationClose)
        cm.state.currentNotificationClose();
    cm.state.currentNotificationClose = newVal;
}
function openNotification(cm, template, options) {
    closeNotification(cm, close);
    var dialog = dialogDiv(cm, template, options && options.bottom);
    var closed = false;
    var doneTimer;
    var duration = options && typeof options.duration !== 'undefined'
        ? options.duration
        : 5000;
    function close() {
        if (closed)
            return;
        closed = true;
        clearTimeout(doneTimer);
        dialog.remove();
        hideDialog(cm, dialog);
    }
    dialog.onclick = function (e) {
        e.preventDefault();
        close();
    };
    showDialog(cm, dialog);
    if (duration)
        doneTimer = setTimeout(close, duration);
    return close;
}
function showDialog(cm, dialog) {
    var oldDialog = cm.state.dialog;
    cm.state.dialog = dialog;
    if (dialog && oldDialog !== dialog) {
        if (oldDialog && oldDialog.contains(document.activeElement))
            cm.focus();
        if (oldDialog && oldDialog.parentElement) {
            oldDialog.parentElement.replaceChild(dialog, oldDialog);
        }
        else if (oldDialog) {
            oldDialog.remove();
        }
        CodeMirror.signal(cm, 'dialog');
    }
}
function hideDialog(cm, dialog) {
    if (cm.state.dialog == dialog) {
        cm.state.dialog = null;
        CodeMirror.signal(cm, 'dialog');
    }
}
function openDialog(me, template, callback, options) {
    if (!options)
        options = {};
    closeNotification(me, undefined);
    var dialog = dialogDiv(me, template, options.bottom);
    var closed = false;
    showDialog(me, dialog);
    function close(newVal) {
        if (typeof newVal == 'string') {
            inp.value = newVal;
        }
        else {
            if (closed)
                return;
            closed = true;
            hideDialog(me, dialog);
            if (!me.state.dialog)
                me.focus();
            if (options.onClose)
                options.onClose(dialog);
        }
    }
    var inp = dialog.getElementsByTagName('input')[0];
    if (inp) {
        if (options.value) {
            inp.value = options.value;
            if (options.selectValueOnOpen !== false)
                inp.select();
        }
        if (options.onInput)
            CodeMirror.on(inp, 'input', function (e) {
                options.onInput(e, inp.value, close);
            });
        if (options.onKeyUp)
            CodeMirror.on(inp, 'keyup', function (e) {
                options.onKeyUp(e, inp.value, close);
            });
        CodeMirror.on(inp, 'keydown', function (e) {
            if (options &&
                options.onKeyDown &&
                options.onKeyDown(e, inp.value, close)) {
                return;
            }
            if (e.keyCode == 13)
                callback(inp.value);
            if (e.keyCode == 27 ||
                (options.closeOnEnter !== false && e.keyCode == 13)) {
                inp.blur();
                CodeMirror.e_stop(e);
                close();
            }
        });
        if (options.closeOnBlur !== false)
            CodeMirror.on(inp, 'blur', function () {
                setTimeout(function () {
                    if (document.activeElement === inp)
                        return;
                    close();
                });
            });
        inp.focus();
    }
    return close;
}
var matching = {
    '(': ')>',
    ')': '(<',
    '[': ']>',
    ']': '[<',
    '{': '}>',
    '}': '{<',
    '<': '>>',
    '>': '<<',
};
function bracketRegex(config) {
    return (config && config.bracketRegex) || /[(){}[\]]/;
}
function scanForBracket(cm, where, dir, style, config) {
    var maxScanLen = (config && config.maxScanLineLength) || 10000;
    var maxScanLines = (config && config.maxScanLines) || 1000;
    var stack = [];
    var re = bracketRegex(config);
    var lineEnd = dir > 0
        ? Math.min(where.line + maxScanLines, cm.lastLine() + 1)
        : Math.max(cm.firstLine() - 1, where.line - maxScanLines);
    for (var lineNo = where.line; lineNo != lineEnd; lineNo += dir) {
        var line = cm.getLine(lineNo);
        if (!line)
            continue;
        var pos = dir > 0 ? 0 : line.length - 1, end = dir > 0 ? line.length : -1;
        if (line.length > maxScanLen)
            continue;
        if (lineNo == where.line)
            pos = where.ch - (dir < 0 ? 1 : 0);
        for (; pos != end; pos += dir) {
            var ch = line.charAt(pos);
            if (re.test(ch) /*&& (style === undefined ||
                      (cm.getTokenTypeAt(new Pos(lineNo, pos + 1)) || "") == (style || ""))*/) {
                var match = matching[ch];
                if (match && (match.charAt(1) == '>') == dir > 0)
                    stack.push(ch);
                else if (!stack.length)
                    return { pos: new Pos(lineNo, pos), ch: ch };
                else
                    stack.pop();
            }
        }
    }
    return lineNo - dir == (dir > 0 ? cm.lastLine() : cm.firstLine())
        ? false
        : null;
}
function findMatchingTag(cm, pos) {
    var state = cm.cm6.state;
    var offset = cm.indexFromPos(pos);
    var m = matchBrackets(state, offset + 1, -1, { brackets: '\n\n' });
    if (m) {
        if (!m.end || !m.start)
            return;
        return {
            open: convertRange(state.doc, m.end),
            close: convertRange(state.doc, m.start),
        };
    }
    m = matchBrackets(state, offset, 1, { brackets: '\n\n' });
    if (m) {
        if (!m.end || !m.start)
            return;
        return {
            open: convertRange(state.doc, m.start),
            close: convertRange(state.doc, m.end),
        };
    }
}
function convertRange(doc, cm6Range) {
    return {
        from: posFromIndex(doc, cm6Range.from),
        to: posFromIndex(doc, cm6Range.to),
    };
}
function findEnclosingTag(cm, pos) {
    var state = cm.cm6.state;
    var offset = cm.indexFromPos(pos);
    var text = state.sliceDoc(0, offset);
    var i = offset;
    while (i > 0) {
        var m = matchBrackets(state, i, 1, { brackets: '\n\n' });
        if (m && m.start && m.end) {
            return {
                open: convertRange(state.doc, m.start),
                close: convertRange(state.doc, m.end),
            };
        }
        i = text.lastIndexOf('>', i - 1);
    }
}
class Marker {
    constructor(cm, offset, assoc) {
        this.cm = cm;
        this.id = cm.$mid++;
        this.offset = offset;
        this.assoc = assoc;
        cm.marks[this.id] = this;
    }
    clear() {
        delete this.cm.marks[this.id];
    }
    find() {
        if (this.offset == null)
            return null;
        return this.cm.posFromIndex(this.offset);
    }
    update(change) {
        if (this.offset != null)
            this.offset = change.mapPos(this.offset, this.assoc, MapMode.TrackDel);
    }
}
