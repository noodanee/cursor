var __await = (this && this.__await) || function (v) { return this instanceof __await ? (this.v = v, this) : new __await(v); }
var __asyncGenerator = (this && this.__asyncGenerator) || function (thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i;
    function verb(n) { if (g[n]) i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; }
    function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
};
//export const API_ROOT = 'https://staging.aicursor.com'
export const API_ROOT = 'https://aicursor.com';
export function streamSource(response) {
    return __asyncGenerator(this, arguments, function* streamSource_1() {
        console.log(response.headers.get('content-type'));
        // Check if the response is an event-stream
        if (response.headers.get('content-type') ==
            'text/event-stream; charset=utf-8') {
            // Create a reader to read the response body as a stream
            // const reader = response.body.getReader();
            // Fix the above error: `response.body is possibly null`
            const reader = response.body.getReader();
            // Create a decoder to decode the stream as UTF-8 text
            const decoder = new TextDecoder('utf-8');
            // Loop until the stream is done
            while (true) {
                const { value, done } = yield __await(reader.read());
                if (done) {
                    break;
                }
                const rawValue = decoder.decode(value);
                const lines = rawValue.split('\n');
                for (let line of lines) {
                    if (line.startsWith('data: ')) {
                        const jsonString = line.slice(6);
                        if (jsonString == '[DONE]') {
                            return yield __await(void 0);
                        }
                        yield yield __await(JSON.parse(jsonString));
                    }
                }
            }
        }
        else {
            // Raise exception
            throw new Error('Response is not an event-stream');
        }
    });
}
export function getPlatformInfo() {
    let PLATFORM_DELIMITER;
    let PLATFORM_META_KEY;
    let PLATFORM_CM_KEY;
    let IS_WINDOWS;
    if (process.platform === 'win32') {
        PLATFORM_DELIMITER = '\\';
        PLATFORM_META_KEY = 'Ctrl+';
        PLATFORM_CM_KEY = 'Ctrl';
        IS_WINDOWS = true;
    }
    else if (process.platform === 'darwin') {
        PLATFORM_DELIMITER = '/';
        PLATFORM_META_KEY = '⌘';
        PLATFORM_CM_KEY = 'Cmd';
        IS_WINDOWS = false;
    }
    else {
        PLATFORM_DELIMITER = '/';
        PLATFORM_META_KEY = 'Ctrl+';
        PLATFORM_CM_KEY = 'Ctrl';
        IS_WINDOWS = false;
    }
    return {
        PLATFORM_DELIMITER,
        PLATFORM_META_KEY,
        PLATFORM_CM_KEY,
        IS_WINDOWS,
    };
}
export function join(a, b) {
    if (a[a.length - 1] === connector.PLATFORM_DELIMITER) {
        return a + b;
    }
    return a + connector.PLATFORM_DELIMITER + b;
}
// make a join method that can handle ./ and ../
export function joinAdvanced(a, b) {
    if (b.startsWith('./')) {
        return joinAdvanced(a, b.slice(2));
    }
    if (b.startsWith('../')) {
        // if a ends with slash
        if (a[a.length - 1] === connector.PLATFORM_DELIMITER) {
            a = a.slice(0, -1);
        }
        const aOneHigher = a.slice(0, a.lastIndexOf(connector.PLATFORM_DELIMITER));
        return joinAdvanced(aOneHigher, b.slice(3));
    }
    return join(a, b);
}
export function removeBeginningAndEndingLineBreaks(str) {
    str = str.trimEnd();
    while (str[0] === '\n') {
        str = str.slice(1);
    }
    while (str[str.length - 1] === '\n') {
        str = str.slice(0, -1);
    }
    return str;
}
