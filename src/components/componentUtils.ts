export function throttleCallback(fn, limit = 300) {
    let inThrottle, lastFn, lastTime;
    return function () {
        const context = this, args = arguments;
        if (!inThrottle) {
            fn.apply(context, args);
            lastTime = Date.now();
            inThrottle = true;
        }
        else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                if (Date.now() - lastTime >= limit) {
                    fn.apply(context, args);
                    lastTime = Date.now();
                    inThrottle = false;
                }
            }, Math.max(limit - (Date.now() - lastTime), 0));
        }
    };
}
export function normalThrottleCallback(fn, limit = 300) {
    let inThrottle, lastFn, lastTime;
    return function (...args) {
        if (!inThrottle) {
            fn(args);
            lastTime = Date.now();
            inThrottle = true;
        }
        else {
            clearTimeout(lastFn);
            lastFn = setTimeout(() => {
                fn(args);
                lastTime = Date.now();
                inThrottle = false;
            }, limit);
        }
    };
}
