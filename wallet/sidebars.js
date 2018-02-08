class SideBar {
    constructor(el, listener) {
        this._el = el;
        this._listener = listener;
        this._state = null;
        this._stateViews = {};
        Array.prototype.forEach.call(this._el.querySelectorAll('[sidebar-state-view]'), view => {
            const viewName = view.getAttribute('sidebar-state-view');
            this._stateViews[viewName] = view;
            view.style.display = 'none';
        });
        this._errorEl = null;
        this._visible = false;
        this._showsError = false;
    }

    setState(state) {
        if (this._state) {
            // hide the old view
            this._stateViews[this._state].style.display = 'none';
        }
        if (!(state in this._stateViews)) {
            throw Error('Unknown View');
        }
        this._state = state;
        this._stateViews[state].style.display = '';
    }

    show() {
        if (this._visible) {
            return;
        }
        this._el.style.display = 'flex';
        this._el.offsetWidth; // style update
        this._el.classList.add('visible');
        this._visible = true;
        this._listener._onSideBarShown(this);
    }

    hide() {
        if (!this._visible) {
            return;
        }
        this._el.classList.remove('visible');
        this._visible = false;
        this._listener._onSideBarHidden(this);
        setTimeout(() => {
            this.clearError();
            this._el.style.display = 'none';
        }, 400);
    }

    isVisible() {
        return this._visible;
    }

    showError(errorMessage) {
        if (!this._errorEl) {
            this._errorEl = document.createElement('h2');
            this._errorEl.classList.add('sidebar-error');
            this._el.appendChild(this._errorEl);
        }
        this._errorEl.textContent = errorMessage;
        this._errorEl.style.display = 'block';
        this._el.classList.add('error');
        this._showsError = true;
    }

    clearError() {
        this._el.classList.remove('error');
        if (this._errorEl) {
            this._errorEl.style.display = 'none';
        }
        this._showsError = false;
    }
}


const CloseButtonMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener) {
        super(el, listener);
        this._closeButton = el.querySelector('.wallet-sidebar-leave');
        this._closeButton.onclick = () => {
            if (this._showsError) {
                this.clearError();
            } else {
                this.hide();
            }
        };
    }
};


const CashlinkAmountMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener) {
        super(el, listener);
        this._amountEl = el.querySelector('[cashlink-amount]');
    }

    setCashlinkAmount(amount) {
        this._amountEl.textContent = amount;
    }
};

const CashlinkMessageMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener) {
        super(el, listener);
        this._messageEl = el.querySelector('[cashlink-message]');
        this._messageContainer = el.querySelector('[cashlink-message-container]');
    }

    setCashlinkMessage(message) {
        this._messageEl.textContent = message;
        if (!message) {
            this._messageContainer.style.display = 'none';
        } else {
            this._messageContainer.style.display = 'block';
        }
    }
};


class Timer {
    constructor(el) {
        this._el = el;
        this._timerId = null;
        this._startTime = 0;
    }

    start() {
        this.stop();
        this._el.textContent = '0:00';
        this._startTime = Date.now();
        this._timerId = setInterval(() => {
            const elapsedTime = Math.floor((Date.now() - this._startTime) / 1000);
            const minutes = Math.floor(elapsedTime / 60);
            let seconds = elapsedTime % 60;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            this._el.textContent = minutes + ':' + seconds;
        }, 1000);
    }

    stop() {
        clearInterval(this._timerId);
    }
}


const TimerMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener) {
        super(el, listener);
        this._timer = new Timer(el.querySelector('[elapsed-time]'));
    }

    startTimer() {
        this._timer.start();
    }

    stopTimer() {
        this._timer.stop();
    }

    hide() {
        super.hide();
        this.stopTimer();
    }

    setState(state) {
        if (state === TimerMixin.CONFIRMING) {
            if (this._state !== TimerMixin.CONFIRMING) {
                this.startTimer();
            }
        } else {
            this.stopTimer();
        }
        super.setState(state);
    }
};
TimerMixin.CONFIRMING = 'confirming';


const EstimatedTransactionTimeMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener, $) {
        super(el, listener, $);
        this.$ = $;
        this._estimatedTimeEl = el.querySelector('[estimated-time]');
    }

    _formatTime(seconds) {
        let minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        return minutes + ':' + (seconds<10? '0' : '') + seconds;
    }

    updateEstimatedTransactionTime(isDoubleTransaction) {
        const prevCount = 3;
        let blocksPromises = [Promise.resolve(this.$.blockchain.head)];
        for (let i=0; i<prevCount; ++i) {
            blocksPromises.push(blocksPromises[blocksPromises.length-1]
                .then(block => this.$.blockchain.getBlock(block.prevHash)));
        }
        Promise.all(blocksPromises).then(blocks => {
            let averageTime = 0;
            for (let i=0; i<prevCount; ++i) {
                let blockMiningTime = blocks[i].timestamp - blocks[i+1].timestamp;
                averageTime += blockMiningTime;
            }
            averageTime /= prevCount;
            if (isDoubleTransaction) {
                averageTime *= 2;
            }
            averageTime += 5; // add some time for network latency and as additional buffer
            console.log('estimated transaction time is', averageTime);
            averageTime = Math.round(averageTime/5) * 5; // round to 5 second steps
            averageTime = Math.max(30, averageTime); // return 30 seconds as minimum
            this._estimatedTimeEl.textContent = this._formatTime(averageTime);
        })
        .catch(e => {
            console.error(e);
            this._estimatedTimeEl.textContent = isDoubleTransaction? '1:00' : '0:30';
        });
    }
}


class ShareUi {
    constructor(el) {
        this._el = el;
        this._whatsAppButton = el.querySelector('[share-button-whatsapp]');
        this._telegramButton = el.querySelector('[share-button-telegram]');
        // this._facebookButton = el.querySelector('[share-button-facebook]');
        this._smsButton = el.querySelector('[share-button-sms]');
        this._copyButton = el.querySelector('[share-button-copy]');
        this._mailButton = el.querySelector('[share-button-mail]');
        this._copyToast = el.querySelector('[copy-toast]');
        let availableButtons;
        if (this._isMobile()) {
            availableButtons = [this._whatsAppButton, this._telegramButton, /*this._facebookButton,*/
                this._smsButton, this._mailButton];
        } else {
            availableButtons = [this._telegramButton, /*this._facebookButton,*/ this._mailButton];
        }
        if (Clipboard.isSupported()) {
            availableButtons.push(this._copyButton);
            new Clipboard(this._copyButton);
        }
        let width = 'calc(100% / ' + availableButtons.length + ')';
        availableButtons.forEach(function(el) {
            el.style.display = 'block';
            el.style.width = width;
        });
        this._copyButton.addEventListener('click', () => {
            // show copy button
            this._copyToast.style.display = 'block';
            this._copyToast.offsetWidth; // update style
            this._copyToast.style.opacity = 1;
            setTimeout(() => {
                this._copyToast.style.opacity = 0;
                setTimeout(() => {
                    this._copyToast.style.display = 'none';
                }, 500);
            }, 2000);
        });
    }

    setPayload(payload, amount) {
        this._copyButton.setAttribute('data-clipboard-text', payload);
        payload = encodeURIComponent(payload);
        this._whatsAppButton.href = 'whatsapp://send?text='
            + encodeURIComponent('Here are ' + amount + ' NIMIQ for you. \n') + payload;
        this._telegramButton.href = 'https://telegram.me/share/url?url='+ payload + '&text='
            + encodeURIComponent('Here are ' + amount + ' NIMIQ for you.');
        // facebook is somewhat complicated. Apparently there is fb-messenger://compose
        // (https://stackoverflow.com/questions/25467445/custom-uri-schemes-for-the-facebook-messenger) but
        // it is not documented. On desktop one could use a share dialog
        // (https://stackoverflow.com/questions/13050113/url-for-compose-facebook-message-new-layout)
        //this._facebookButton.href = '';
        this._mailButton.href = 'mailto:?'+encodeURI('subject=Here are ' + amount + ' NIMIQ for you&body=')+payload;
        this._smsButton.href = this._isiOS() ? 'sms:&body='+payload : 'sms:?body='+payload;
    }

    _isMobile() {
        let userAgent = (navigator.userAgent || navigator.vendor || window.opera).toLowerCase();
        if (/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od|ad)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows (ce|phone)|xda|xiino/i.test(userAgent)
            || /1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(userAgent.substr(0, 4)))
            return true;
        else
            return false;
    }

    _isiOS() {
        let userAgent = (navigator.userAgent || navigator.vendor || window.opera).toLowerCase();
        if (/ip(hone|od|ad)/i.test(userAgent))
            return true;
        else
            return false;
    }
}


const PeerCountMixin = (BaseClass) => class extends BaseClass {
    constructor(el, listener, $) {
        super(el, listener);
        this._peerCount = el.querySelector('[peer-count]');
    }

    setPeerCount(peerCount) {
        this._peerCount.textContent = peerCount;
    }
};



/* Concrete Sidebar Implementations */

class SyncSideBar extends PeerCountMixin(CloseButtonMixin(SideBar)) {
    constructor(el, listener, $) {
        super(el, listener, $);
        this.$ = $;
        Array.prototype.forEach.call(el.querySelectorAll('[reconnect-button]'), button => button.onclick = this._reconnect.bind(this));
    }

    _reconnect() {
        // XXX HACK!!!!!!!!!!!!!!!!!!
        this.$.network._connectingCount = 0;
        this.$.network.connect();
        this.setState(SyncSideBar.CONNECTING);
        setTimeout(() => {
            // if we still don't have connected peers after 15 seconds offer again to reconnect
            if (this.$.network.peerCount === 0) {
                this.setState(SyncSideBar.RECONNECT_FAILED);
            }
        }, 15000);
    }

    setState(state) {
        super.setState(state);
        if (state === SyncSideBar.RECONNECT_FAILED) {
            this._closeButton.style.display = 'block';
        } else {
            this._closeButton.style.display = 'none';
        }
    }
};
SyncSideBar.LOADING = 'loading';
SyncSideBar.CONNECTING = 'connecting';
SyncSideBar.SYNCING = 'syncing';
SyncSideBar.CONNECTION_LOST = 'connection-lost';
SyncSideBar.RECONNECT_FAILED = 'reconnect-failed';


class FaucetSideBar extends EstimatedTransactionTimeMixin(TimerMixin(CloseButtonMixin(SideBar))) {
    constructor(el, listener, $) {
        super(el, listener, $);
        this.$ = $;
        this._tapped = false;
        el.querySelector('[tap-faucet-button]').onclick = this._tapFaucet.bind(this);
    }

    get tapped() {
        return this._tapped;
    }

    _tapFaucet() {
        _paq.push(['trackEvent', 'Faucet', 'tap']);
        let faucetPromise = new Promise((resolve, reject) => {
            var xmlhttp = new XMLHttpRequest();
            var url = 'https://faucet.nimiq-network.com/tapit/' + this.$.wallet.address.toUserFriendlyAddress(false);
            xmlhttp.onreadystatechange = () => {
                if (xmlhttp.readyState === XMLHttpRequest.DONE) {
                    if (xmlhttp.status === 200) {
                        var response = JSON.parse(xmlhttp.responseText);
                        if (response.success) {
                            resolve(response);
                        } else {
                            reject(Error('No more coins available.'));
                        }
                    } else {
                        reject(Error('Couldn\'t connect.'));
                    }
                }
            };
            xmlhttp.onerror = xmlhttp.ontimeout = () => reject(Error('Couldn\'t connect.'));
            xmlhttp.open('GET', url, true);
            xmlhttp.timeout = 5000;
            xmlhttp.send();
        });
        this.updateEstimatedTransactionTime();
        this.setState(FaucetSideBar.CONFIRMING);
        this._tapped = true;
        faucetPromise.catch((e) => {
            this.showError('An Error Occured: ' + e.message);
            this.setState(FaucetSideBar.OFFER);
        });
    }
}
FaucetSideBar.OFFER = 'offer';
FaucetSideBar.CONFIRMING = TimerMixin.CONFIRMING;


class CashlinkCreationSideBar extends EstimatedTransactionTimeMixin(CashlinkAmountMixin(TimerMixin(CloseButtonMixin(SideBar)))) {
    constructor(el, listener, $) {
        super(el, listener, $);
        this._shareUi = new ShareUi(el.querySelector('.share-buttons'));
        this._titleEl = el.querySelector('.title');
    }

    setSharePayload(payload, amount) {
        this._shareUi.setPayload(payload, amount);
    }

    setTitle(title) {
        this._titleEl.textContent = title;
    }

    setState(state) {
        if (state === CashlinkCreationSideBar.CONFIRMING) {
            this._el.classList.remove('confirmed');
            if (this._state !== CashlinkCreationSideBar.CONFIRMING) {
                this.updateEstimatedTransactionTime();
            }
        } else if (state === CashlinkCreationSideBar.CONFIRMED) {
            this._el.classList.add('confirmed');
        }
        super.setState(state);
    }
}
CashlinkCreationSideBar.CONFIRMING = TimerMixin.CONFIRMING;
CashlinkCreationSideBar.CONFIRMED = 'confirmed';


class CashlinkReceivementSideBar extends EstimatedTransactionTimeMixin(CashlinkMessageMixin(CashlinkAmountMixin(TimerMixin(CloseButtonMixin(SideBar))))) {
    constructor(el, listener, $) {
        super(el, listener, $);
        this._acceptButton = el.querySelector('[accept-cashlink-button]');
        this._sidebarBottom = el.querySelector('.wallet-sidebar-bottom');
        this._windowCloseHint = el.querySelector('[window-close-hint]');
        this._acceptButton.onclick = this._accept.bind(this);
        this._accepted = false;
    }

    get accepted() {
        return this._accepted;
    }

    set onAccept(func) {
        this._onAccept = func;
    }

    _accept() {
        this._accepted = true;

        // Call listener.
        if (this._onAccept) {
            this._onAccept();
        }

        // Advance to stored state.
        if (this._nextState) {
            this.setState(this._nextState);
        }
    }

    setState(state) {
        if (this._state === CashlinkReceivementSideBar.ACCEPT && !this._accepted) {
            this._nextState = state;
            return; // don't allow immediate state changes while not accepted
        }
        if (this._state === CashlinkReceivementSideBar.CONFIRMED
            || this._state === CashlinkReceivementSideBar.CASHLINK_EMPTY) {
            return; // don't allow to change the state to anything else anymore
        }

        if ((state === CashlinkReceivementSideBar.WAITING_CONFIRMING
            || state === CashlinkReceivementSideBar.CONFIRMING)
            && (this._state !== CashlinkReceivementSideBar.WAITING_CONFIRMING
            && this._state !== CashlinkReceivementSideBar.CONFIRMING)) {
            // changing to confirming state. Set the estimated time.
            let isDoubleTransaction = state === CashlinkReceivementSideBar.WAITING_CONFIRMING;
            this.updateEstimatedTransactionTime(isDoubleTransaction);
        }
        if (state === CashlinkReceivementSideBar.WAITING_CONFIRMING) {
            this._windowCloseHint.style.display = 'block';
        } else {
            this._windowCloseHint.style.display = 'none';
        }

        if (state === CashlinkReceivementSideBar.ACCEPT
            || state === CashlinkReceivementSideBar.SYNCING
            || state === CashlinkReceivementSideBar.WAITING_CONFIRMING) {
            this._closeButton.style.display = 'none';
        } else {
            this._closeButton.style.display = 'block';
        }
        if (state === CashlinkReceivementSideBar.ACCEPT) {
            this._sidebarBottom.style.justifyContent = 'flex-start';
        } else {
            this._sidebarBottom.style.justifyContent = 'flex-end';
            this._el.setAttribute('accepted', '');
        }

        if (state === CashlinkReceivementSideBar.WAITING_CONFIRMING) {
            state = CashlinkReceivementSideBar.CONFIRMING; // WAITING_CONFIRMING state is just a pseudonym for
            // CONFIRMING state where the cashlink is not ready yet
        }
        super.setState(state);
    }
}
CashlinkReceivementSideBar.ACCEPT = 'accept';
CashlinkReceivementSideBar.SYNCING = 'syncing';
CashlinkReceivementSideBar.WAITING_CONFIRMING = 'waiting-confirming';
CashlinkReceivementSideBar.CONFIRMING = TimerMixin.CONFIRMING;
CashlinkReceivementSideBar.CONFIRMED = 'confirmed';
CashlinkReceivementSideBar.CASHLINK_EMPTY = 'cashlink-empty';