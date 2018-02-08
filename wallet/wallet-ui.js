function $$(selector) {
    return document.querySelector(selector);
}

class WalletUI {
    constructor($) {
        this.$ = $;
        this._el = $$('#wallet');
        this._headerEl = $$('header');
        this._messageContainer = $$('#wallet-message-input');
        this._messageInput = $$('#wallet-message-input input');
        this._amountContainer = $$('#wallet-amount-input');
        this._amountInput = $$('#wallet-amount-input input');
        this._createCashlinkBtn = $$('#create-cashlink-button');
        this._createCashlinkBtnCaptionEl = this._createCashlinkBtn.firstElementChild;
        this._walletBalanceEl = $$("#wallet-balance");

        this._cashlinkHistory = new CashlinkHistory(this.$);

        this._createdCashlinkAmountChanged = this._createdCashlinkAmountChanged.bind(this);
        this._receivedCashlinkAmountChanged = this._receivedCashlinkAmountChanged.bind(this);

        this._syncSideBar = new SyncSideBar($$('#sync-sidebar'), this, this.$);
        this._faucetSideBar = new FaucetSideBar($$('#faucet-sidebar'), this, this.$);
        this._cashlinkCreationSideBar = new CashlinkCreationSideBar($$('#cashlink-creation-sidebar'), this, this.$);
        this._cashlinkReceivementSideBar = new CashlinkReceivementSideBar($$('#cashlink-receivement-sidebar'), this, this.$);
        this._cashlinkReceivementSideBar.onAccept = this._acceptCashlink.bind(this);
        this._openSideBars = [];
        this._syncSideBar.setState(SyncSideBar.CONNECTING);
        this._syncSideBar.show();

        // Check if we are receiving a cashlink.
        this._didReceiveCashlink = false;
        if (window.location.hash) {
            this._didReceiveCashlink = true;
            CashLink.parse($, this._retreiveCashlinkUrl()).then(cashlink => {
                if (cashlink) {
                    this._syncSideBar.hide();
                    this._onCashlinkReceived(cashlink);
                } else {
                    this._didReceiveCashlink = false;
                }
            });
        }

        if (Clipboard.isSupported()) {
            new Clipboard(this._createCashlinkBtn);
            this._cashlinkCreationSideBar.setTitle('Cashlink copied to your clipboard.');
        }

        $.consensus.on('established', () => this._onConsensusEstablished());
        $.consensus.on('syncing', () => this._onSyncing());
        $.blockchain.on('head-changed', _ => this._onHeadChanged());
        $.network.on('peers-changed', () => this._onPeersChanged());

        this._balance = null;
        this._updateBalanceRequest = null;
        this._updateBalance()
            .catch((e) => {
                console.error(e);
            });

        $.network.connect();

        window.addEventListener('hashchange', () => {
            let hash = window.location.hash;
            if (hash && hash!=='#') {
                window.location.reload(); // reload the page to handle the new received cashlink
            }
        });
    }


    _formatAmount(amount) {
        // show as few digits as possible depending on how big the amount is
        const digitCount = 5;
        let integerAmount = parseInt(amount.toString()) || 0;
        let integertDigitCount = integerAmount.toString().length;
        if (integertDigitCount >= digitCount) {
            return integerAmount.toString();
        }
        let maxDecimals = digitCount - integertDigitCount;
        return Number(amount.toFixed(maxDecimals)).toString(); // 0 to maxDecimals decimals without trailing zeros
    }


    _formatAmountInput() {
        let amountString = this._amountInput.value.trim();
        amountString = amountString.replace(/[^0-9.,]/g, ''); // remove illegal characters
        // remove all but the first decimal separator
        let parts = amountString.split(/[,.]/);
        if (parts.length > 1) {
            parts[0] = parts[0]+'.';
        }
        amountString = parts.join('');
        let fixed4Decimals = (Math.floor(Number(amountString) * 10000) / 10000).toFixed(4);
        if (amountString.length > fixed4Decimals.length) {
            // we don't want more then 4 decimals
            amountString = fixed4Decimals;
        }
        if (this._amountInput.value !== amountString) {
            this._amountInput.value = amountString;
        }
    }


    _onSideBarShown(sideBar) {
        if (this._openSideBars.indexOf(sideBar) === -1) {
            this._openSideBars.push(sideBar);
        }
        this._el.setAttribute('sidebar-open', '');
    }


    _onSideBarHidden(sideBar) {
        let index = this._openSideBars.indexOf(sideBar);
        if (index !== -1) {
            this._openSideBars.splice(index, 1);
        }
        if (this._openSideBars.length === 0) {
            this._el.removeAttribute('sidebar-open');
        }
    }



    /* Syncing */

    async _onConsensusEstablished() {
        _paq.push(['trackEvent', 'Consensus', 'established']);
        await this._updateBalance();
        
        this._syncSideBar.hide();
        this._createCashlinkBtnCaptionEl.textContent = 'Create Cashlink';

        if (!this._preparedCashlink) {
            // already prepare the cashlink so that we copy the url to the clipboard on click on
            // the create button
            this._prepareNewCashlink();
        }

        this._messageInput.onchange = () => this._updateCashlink();
        this._messageInput.onkeyup = () => this._updateCashlink();
        this._amountInput.onchange = () => this._updateCashlink();
        this._amountInput.onkeyup = () => this._updateCashlink();
        this._createCashlinkBtn.onclick = () => this._createCashlink();

        if (this._didReceiveCashlink && this._cashlinkReceivementSideBar.accepted) {
            if (!this._receivedCashlink) {
                // didn't handle the received cashlink yet and is accepted
                this._handleReceivedCashlink();
            } else {
                // did already handle the received cashlink but then lost consensus and switched to
                // reconnect / syncing screen. Now we can move back to confirming state.
                // Note that if the sidebar is already in a final state it will correctly block this change
                this._receivedCashlink.getAmount().then(amount => {
                    if (amount > 0) {
                        this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.CONFIRMING);
                    } else {
                        this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.WAITING_CONFIRMING);
                    }
                })
                .catch(e => {
                    console.error(e);
                    this._cashlinkReceivementSideBar.showError('Error: ' + (e.message || e));
                });
            }
        }

        if (!this._canMakeTransactionInCurrentBlock()) {
            this._el.setAttribute('outgoing-transaction-pending', '');
            let headChanged = new Promise((resolve, reject) => {
                this.$.blockchain.on('head-changed', resolve);
            });
            headChanged.then(() => {
                this._el.removeAttribute('outgoing-transaction-pending');
            });
        }
    }


    _onSyncing() {
        this._createCashlinkBtnCaptionEl.textContent = 'Please wait until synchronized';

        this._syncSideBar.setState(SyncSideBar.SYNCING);
        this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.SYNCING);

        if (!this._cashlinkReceivementSideBar.isVisible()) {
            this._syncSideBar.show();
        } else {
            this._syncSideBar.hide();
        }
    }


    _onHeadChanged(head, isBranching) {
        this._updateBalanceRequest = null; // the balance has potentially changed, so reset the cached request
        if (this.$.consensus.established && !isBranching) {
            this._updateBalance();
        }
    }


    _onPeersChanged() {
        if (this.$.network.peerCount === 0) {
            setTimeout(() => {
                // give it some time to maybe reconnect, otherwise show a message
                if (this.$.network.peerCount === 0) {
                    this._syncSideBar.setState(SyncSideBar.CONNECTION_LOST); // this state will change later again
                    // when we are connected and _onSyncing gets called
                    this._syncSideBar.show();
                }
            }, 1000);
        }
        if (!this.$.consensus.established) {
            this._syncSideBar.setPeerCount(this.$.network.peerCount);
        }
    }



    /* Cashlink creation */

    _getCashlinkUrl(cashlink) {
        // replace trailing . by = because of URL parsing issues on iPhone.
        let payload = cashlink.render().replace(/\./g, '=');
        // iPhone also has a problem to parse long words with more then 300 chars in a URL in WhatsApp
        // (and possibly others). Therefore we break the words by adding a ~
        payload = payload.replace(/[A-Za-z0-9_]{257,}/g, function(match) {
            return match.replace(/.{256}/g,"$&~"); // add a ~ every 256 characters in long words
        });
        return `${window.location.protocol}//${window.location.host}${window.location.pathname}#${payload}`;
    }

    _retreiveCashlinkUrl() {
        return window.location.hash.substr(1).replace(/~/g, '').replace(/=*$/, function(match) {
            let replacement = '';
            for (let i=0; i<match.length; ++i) {
                replacement += '.';
            }
            return replacement;
        });
    }

    _getAmount() {
        return parseFloat(this._amountInput.value.trim().replace(/,/g, '.'));
    }

    _isAmountValid() {
        const amountString = this._amountInput.value.trim();
        if (/[^0-9.,]/.test(amountString)) {
            return false;
        }
        if ((amountString.match(/[,.]/g) || []).length > 1) {
            return false;
        }
        const amount = this._getAmount();
        const satoshis = Nimiq.Policy.coinsToSatoshis(amount);
        return satoshis >= 1 && satoshis <= this._balance;
    }

    _isMessageValid() {
        let message = this._messageInput.value.trim();
        if (message.length > 64) {
            return false;
        }
        if (!Nimiq.NumberUtils.isUint8(encodeURIComponent(message).length)) {
            // this is a requirement for the message in the cashlink to be writable to the SerialBuffer
            return false;
        }
        return true;
    }

    _canMakeTransactionInCurrentBlock() {
        let recentCashlinks = this._cashlinkHistory.get();
        if (recentCashlinks.length>0
            && recentCashlinks[recentCashlinks.length-1].creationBlock === this.$.blockchain.height) {
            // cant push two transactions to the same block
            return false;
        } else {
            return true;
        }
    }

    _updateCashlink() {
        this._formatAmountInput();
        const isAmountValid = this._isAmountValid();
        const isMessageValid = this._isMessageValid();
        this._amountContainer.className = isAmountValid || !this._amountInput.value  ? '' : 'invalid';
        this._messageContainer.className = isMessageValid ? '' : 'invalid';
        this._createCashlinkBtn.disabled = !isAmountValid || !isMessageValid || !this._preparedCashlink;

        if (this._preparedCashlink) {
            if (isAmountValid) {
                this._preparedCashlink.value = Nimiq.Policy.coinsToSatoshis(this._getAmount());
            }
            if (isMessageValid) {
                this._preparedCashlink.message = this._messageInput.value.trim();
            }
        }

        this._updateClipboardPayload();
    }

    _updateClipboardPayload() {
        if (this._preparedCashlink && this._isAmountValid() && this._isMessageValid()) {
            this._createCashlinkBtn.setAttribute('data-clipboard-text', this._getCashlinkUrl(this._preparedCashlink));
        } else {
            this._createCashlinkBtn.removeAttribute('data-clipboard-text');
        }
    }

    async _executeUntilSuccess(fn, args = []) {
        try {
            return await fn.apply(this, args);
        } catch(e) {
            console.warn(e);
            return new Promise(resolve => {
                setTimeout(() => {
                    this._executeUntilSuccess(fn, args).then(result => resolve(result));
                }, 5000);
            });
        }
    }

    async _updateBalance() {
        const headHash = this.$.blockchain.headHash;
        if (!this._updateBalanceRequest) {
            this._updateBalanceRequest = this._executeUntilSuccess(async () => {
                if (!this.$.consensus.established) {
                    await new Promise((resolve) => {
                        this.$.consensus.on('established', resolve);
                    });
                }

                const account = (await this.$.consensus.getAccount(this.$.wallet.address)) || Nimiq.BasicAccount.INITIAL;

                // if the head changed and there is another balance request for the newer head, return that request
                if (!$.blockchain.headHash.equals(headHash) && this._updateBalanceRequest) {
                    return this._updateBalanceRequest;
                }

                this._balance = account.balance;
                this._walletBalanceEl.textContent = this._formatAmount(Nimiq.Policy.satoshisToCoins(account.balance));
                this._headerEl.setAttribute('has-balance', '');

                this._updateCashlink(); // revalidate the amount

                if (account.nonce === 0 && account.balance === 0 && !this._didReceiveCashlink) {
                    // it's a new user with an empty unused wallet and he didn't receive a cashlink that gives him
                    // coins anyways and he didn't receive the offer on a previous block
                    if (!this._faucetSideBar.tapped) {
                        this._faucetSideBar.setState(FaucetSideBar.OFFER);
                        this._faucetSideBar.show();
                    }
                } else {
                    this._faucetSideBar.hide();
                }
            });
        }
        return this._updateBalanceRequest; // a promise
    }

    _prepareNewCashlink() {
        CashLink.create(this.$).then(function(cashlink) {
            this._preparedCashlink = cashlink;
            this._updateCashlink();
        }.bind(this))
        .catch(function(e) {
            console.error(e);
            this._cashlinkCreationSideBar.showError('Error: ' + (e.message || e));
        }.bind(this));
    }

    _createCashlink() {
        if (!this._isAmountValid() || !this._isMessageValid() || !this._preparedCashlink
            || !this._canMakeTransactionInCurrentBlock()) {
            return;
        }
        _paq.push(['trackEvent', 'Cashlink', 'created']);

        const amount = this._getAmount();
        this._updateCashlink();

        // Disable send form.
        this._messageInput.value = '';
        this._messageInput.disabled = true;
        this._amountInput.value = '';
        this._amountInput.disabled = true;
        this._createCashlinkBtn.disabled = true;

        this._cashlinkCreationSideBar.setState(CashlinkCreationSideBar.CONFIRMING);
        this._cashlinkCreationSideBar.setCashlinkAmount(this._formatAmount(amount));
        this._cashlinkCreationSideBar.show();

        this._el.setAttribute('outgoing-transaction-pending', '');

        this._createdCashlink = this._preparedCashlink;
        this._prepareNewCashlink();
        this._createdCashlink.on('confirmed-amount-changed', this._createdCashlinkAmountChanged);
        this._cashlinkCreationSideBar.setSharePayload(this._getCashlinkUrl(this._createdCashlink),
            this._formatAmount(amount));

        this._createdCashlink.fund()
            .then(() => this._cashlinkHistory.add(this._createdCashlink))
            .catch(e => {
                console.error(e);
                this._cashlinkCreationSideBar.showError('Error: ' + (e.message || e));
                this._el.removeAttribute('outgoing-transaction-pending');
            });
    }

    _createdCashlinkAmountChanged(amount) {
        if (amount > 0) {
            _paq.push(['trackEvent', 'Cashlink', 'confirmed']);
            // Our transaction to the cashlink wallet went through. Now the user can issue a new
            // transaction.
            this._messageInput.disabled = false;
            this._amountInput.disabled = false;
            this._cashlinkCreationSideBar.setState(CashlinkCreationSideBar.CONFIRMED);
            this._el.removeAttribute('outgoing-transaction-pending');
        }
    }




    /* Cashlink Receivement */

    _onCashlinkReceived(cashlink) {
        _paq.push(['trackEvent', 'Cashlink', 'received']);
        this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.ACCEPT);
        this._cashlinkReceivementSideBar.show();

        const amount = Nimiq.Policy.satoshisToCoins(cashlink.value || 0);
        this._cashlinkReceivementSideBar.setCashlinkAmount(this._formatAmount(amount));
        this._cashlinkReceivementSideBar.setCashlinkMessage(cashlink.message || '');
    }

    _acceptCashlink() {
        _paq.push(['trackEvent', 'Cashlink', 'accepted']);
        if (this.$.consensus.established) {
            if (this._didReceiveCashlink && !this._receivedCashlink && this._cashlinkReceivementSideBar.accepted) {
                // didn't handle the received cashlink yet and is accepted
                this._handleReceivedCashlink();
            }
        } else {
            // the _handleReceivedCashlink will be called when synced
            this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.SYNCING);
        }
    }


    _handleReceivedCashlink() {
        // in the shareUI
        CashLink.parse(this.$, this._retreiveCashlinkUrl()).then(function(cashlink) {
            this._receivedCashlink = cashlink;

            return Promise.all([cashlink.getAmount(), cashlink.wasEmptied()]).then(function (promiseResult) {
                var [amount, wasEmptied] = promiseResult;
                if (wasEmptied) {
                    this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.CASHLINK_EMPTY);
                    this._cashlinkReceivementSideBar.setCashlinkAmount(this._formatAmount(0));
                    window.location.hash = '';
                } else {
                    this._receivedCashlink.on('confirmed-amount-changed', this._receivedCashlinkAmountChanged);
                    if (amount > 0) {
                        return this._receivedCashlink.claim().then(() => {
                            this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.CONFIRMING);
                        });
                    } else {
                        this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.WAITING_CONFIRMING);
                    }
                }
            }.bind(this));
        }.bind(this))
        .catch(function(e) {
            console.error(e);
            this._cashlinkReceivementSideBar.showError('Error: ' + (e.message || e));
        }.bind(this));
    }

    _receivedCashlinkAmountChanged(amount) {
        if (amount > 0) {
            // the cashlink got filled up and the amount is now confirmed
            this._receivedCashlinkReady();
        } else {
            // we emptied the cashlink
            this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.CONFIRMED);
            window.location.hash = '';
        }
    }

    _receivedCashlinkReady() {
        _paq.push(['trackEvent', 'Cashlink', 'received-ready']);
        this._receivedCashlink.claim()
        .then(() => this._cashlinkReceivementSideBar.setState(CashlinkReceivementSideBar.CONFIRMING))
        .catch (function(e) {
            console.error(e);
            this._cashlinkReceivementSideBar.showError('Error: ' + (e.message || e));
        }.bind(this));
    }
}


class CashlinkHistory {
    constructor($, key = CashlinkHistory.KEY) {
        this.$ = $;
        this._key = key;
    }

    get() {
        return localStorage[this._key]? JSON.parse(localStorage[this._key]) : [];
    }

    add(cashlink) {
        let cashlinkHistory = this.get();
        cashlinkHistory.push({
            cashlink: cashlink.render().replace(/\./g, '='),
            creationTime: Math.floor(Date.now()/1000),
            creationBlock: this.$.blockchain.height
        });
        if (cashlinkHistory.length > 100) {
            cashlinkHistory.splice(0, 1);
        }
        localStorage[this._key] = JSON.stringify(cashlinkHistory);
    }
}
CashlinkHistory.KEY = 'cashlink-history';