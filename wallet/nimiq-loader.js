'use strict';

(function() {

    function isSupportedBrowser() {
        if (typeof Symbol === "undefined") return false;
        try {
            eval("Promise.resolve();");
            eval("class Foo {}");
            eval("var bar = (x) => x+1");
        } catch (e) {
            return false;
        }
        return true;
    }

    function hasLocalStorage() {
        // taken from MDN
        try {
            var storage = window['localStorage'],
                x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch(e) {
            // return false if the error is a QuotaExceededError and the storage length is 0.
            // If the length is > 0 then we really just exceed the storage limit.
            // If another exception is thrown then probably localStorage is undefined.
            return e instanceof DOMException && (
                // everything except Firefox
                e.code === 22 ||
                // Firefox
                e.code === 1014 ||
                // test name field too, because code might not be present
                // everything except Firefox
                e.name === 'QuotaExceededError' ||
                // Firefox
                e.name === 'NS_ERROR_DOM_QUOTA_REACHED') &&
                // acknowledge QuotaExceededError only if there's something already stored
                storage.length !== 0;
        }
    }

    function initNimiq() {
        // Load main script.
        if (window.nimiq_loaded) {
            return;
        }
        window.nimiq_loaded = true;
        Nimiq.init(async () => {
            window.errorManager.clearError();
            const $ = {};
            window.$ = $;
            $.consensus = await Nimiq.Consensus.nano();

            // XXX Legacy API
            $.blockchain = $.consensus.blockchain;
            $.mempool = $.consensus.mempool;
            $.network = $.consensus.network;

            // XXX Legacy components
            $.wallet = await Nimiq.Wallet.getPersistent();

            $.network.connect();
            
            window.walletUi = new WalletUI($);
        }, function(error) {
            if (error === Nimiq.ERR_WAIT) {
                window.errorManager.showError(ErrorManager.MULTIPLE_TABS);
            } else if (error === Nimiq.ERR_UNSUPPORTED) {
                window.errorManager.showError(ErrorManager.OLD_BROWSER);
            } else {
                console.error('Error is:', error);
                window.errorManager.showError(ErrorManager.GENERAL_ERROR);
                window.nimiq_loaded = false;
            }
        });
    }


    if (!isSupportedBrowser()) {
        window.errorManager.showError(ErrorManager.OLD_BROWSER);
    } else if (!hasLocalStorage()) {
        // no local storage. This is for example the case in private browsing in Safari and Android Browser
        window.errorManager.showError(ErrorManager.NO_LOCALSTORAGE);
    } else {
        // allow to load staging branch instead
        window.nimiq_loaded = false;

        // load the nimiq loader
        var script = document.createElement('script');
        script.onreadystatechange = initNimiq;
        script.onload = initNimiq;
        script.type = 'text/javascript';
        script.src = 'https://cdn.nimiq.com/core/nimiq.js';
        document.body.appendChild(script);
    }

})();