/**
 * Base entry point to the Evo library.
 */
class Evo {
    /**
     * Get the loaded instance of the Evo {@link Core}. {@link Evo.init} must be invoked before.
     * @returns {Core}
     */
    static get() {
        if (!Evo._core) throw 'Evo.get() failed - not initialized yet. Call Evo.init() first.';
        return Evo._core;
    }

    static _loadScript(url, resolve) {
        // Adding the script tag to the head as suggested before
        const head = document.getElementsByTagName('head')[0];
        const script = document.createElement('script');
        script.type = 'text/javascript';
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        // These events might occur before processing, so delay them a bit.
        const ret = () => window.setTimeout(resolve, 1000);
        script.onreadystatechange = ret;
        script.onload = ret;

        // Fire the loading
        head.appendChild(script);
    }

    /**
     * Load the Evo library.
     * @param {string|undefined} path Path that contains the required files to load the library.
     * @returns {Promise} Promise that resolves once the library was loaded.
     */
    static load(path) {
        if (!Evo._hasNativePromise()) return Evo._unsupportedPromise();
        Evo._loadPromise = Evo._loadPromise ||
            new Promise(async (resolve, error) => {
                let script = 'web.js';

                if (!Evo._hasNativeClassSupport() || !Evo._hasProperScoping()) {
                    console.error('Unsupported browser');
                    error(Evo.ERR_UNSUPPORTED);
                    return;
                } else if (!Evo._hasAsyncAwaitSupport()) {
                    script = 'web-babel.js';
                    console.warn('Client lacks native support for async');
                } else if (!Evo._hasProperCryptoApi() || !Evo._hasProperWebRTCOrNone()) {
                    script = 'web-crypto.js';
                    console.warn('Client lacks native support for crypto routines');
                }

                if (!path) {
                    if (Evo._currentScript && Evo._currentScript.src.indexOf('/') !== -1) {
                        path = Evo._currentScript.src.substring(0, Evo._currentScript.src.lastIndexOf('/') + 1);
                    } else {
                        // Fallback
                        path = './';
                    }
                }

                Evo._onload = () => {
                    if (!Evo._loaded) {
                        error(Evo.ERR_UNKNOWN);
                    } else {
                        resolve();
                    }
                };
                Evo._loadScript(path + script, Evo._onload);
            });
        return Evo._loadPromise;
    }

    static _hasNativeClassSupport() {
        try {
            eval('"use strict"; class A{}'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasAsyncAwaitSupport() {
        try {
            eval('"use strict"; (async function() { await {}; })()'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasProperCryptoApi() {
        return window.crypto && window.crypto.subtle;
    }

    static _hasProperWebRTCOrNone() {
        window.RTCPeerConnection = window.RTCPeerConnection || window.webkitRTCPeerConnection;
        return !window.RTCPeerConnection || window.RTCPeerConnection.generateCertificate;
    }

    static _hasProperScoping() {
        try {
            eval('"use strict"; class a{ a() { const a = 0; } }'); // eslint-disable-line no-eval
            return true;
        } catch (err) {
            return false;
        }
    }

    static _hasNativePromise() {
        return window.Promise;
    }

    static _unsupportedPromise() {
        return {
            'catch': function (handler) {
                handler(Evo.ERR_UNSUPPORTED);
            },
            'then': function () {}
        };
    }

    static _hasNativeGoodies() {
        return window.Number && window.Number.isInteger;
    }

    /**
     * Load the Evo library, initialize and provide a {@link Core} instance.
     * @param {function(Core)} ready Function that is invoked once the Core was initialized.
     * @param {function(number)} error Function that is invoked if the call failed.
     * @param {object} options Options for the {@link Core} constructor.
     */
    static init(ready, error, options = {}) {
        // Don't initialize core twice.
        if (Evo._core) {
            console.warn('Evo.init() called more than once.');
            if (ready) ready(Evo._core);
            return;
        }

        if (!Evo._hasNativePromise() || !Evo._hasNativeGoodies()) {
            if (error) error(Evo.ERR_UNSUPPORTED);
            return;
        }

        // Wait until there is only a single browser window open for this origin.
        WindowDetector.get().waitForSingleWindow(async function () {
            try {
                await Evo.load();
                console.log('Evo engine loaded.');
                Evo._core = await new Evo.Core(options);
                if (ready) ready(Evo._core);
            } catch (e) {
                if (Number.isInteger(e)) {
                    if (error) error(e);
                } else {
                    console.error('Error while initializing the core', e);
                    if (error) error(Evo.ERR_UNKNOWN);
                }
            }
        }, () => error && error(Evo.ERR_WAIT));
    }
}
Evo._currentScript = document.currentScript;
if (!Evo._currentScript) {
    // Heuristic
    const scripts = document.getElementsByTagName('script');
    Evo._currentScript = scripts[scripts.length - 1];
}
Evo.ERR_WAIT = -1;
Evo.ERR_UNSUPPORTED = -2;
Evo.ERR_UNKNOWN = -3;
Evo._core = null;
Evo._onload = null;
Evo._loaded = false;
Evo._loadPromise = null;
