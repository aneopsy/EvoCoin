function $$(selector) {
    return document.querySelector(selector);
}

class WalletUI {
    constructor($) {
        this.$ = $;

        this._pendingTx = null;
        this._pendingElapsed = 0;

        this._receivingTx = null;
        this._receivingElapsed = 0;

        this._accountContainer = document.querySelector('#wallet-account-input');
        this._accountInput = document.querySelector('#wallet-account-input input');
        this._accountInput.onchange = () => this._validateAddress();
        this._accountInput.onkeyup = () => this._validateAddress();

        this._amountContainer = document.querySelector('#wallet-amount-input');
        this._amountInput = document.querySelector('#wallet-amount-input input');
        this._amountInput.onchange = () => this._validateAmount();
        this._amountInput.onkeyup = () => this._validateAmount();

        this._sendTxBtn = document.querySelector('.wallet-submit-button');
        this._sendTxBtn.onclick = () => this._sendTx();

        const accountAddr = document.querySelector('#wallet-account .address');
        accountAddr.innerText = $.wallet.address.toHex();
        const infoAddr = document.querySelector('.information .address');
        infoAddr.innerText = $.wallet.address.toHex();
        const infoSeed = document.querySelector('.information .seed');
        infoSeed.innerText = $.wallet.dump();

        const wa = document.querySelector('#wallet-account');
        wa.setAttribute('data-clipboard-text', $.wallet.address.toHex().toUpperCase());
        const clipboard = new Clipboard('#wallet-account');
        clipboard.on('success', () => {
            wa.classList.add('copied');
            setTimeout(() => wa.classList.remove('copied'), 3000);
        });

        $.accounts.getBalance($.wallet.address).then(balance => this._onBalanceChanged(balance));
        $.accounts.on($.wallet.address, account => this._onBalanceChanged(account.balance));

        $.mempool.on('transaction-added', tx => this._onTxReceived(tx));
        $.mempool.on('transactions-ready', () => this._onTxsProcessed());

        document.querySelector('#factBalanceContainer').onclick = () => this.show();
        document.querySelector('#wallet-close').onclick = () => this.hide();
        document.querySelector('#wallet-exit-area').onclick = () => this.hide();

        document.querySelector('.wallet-sidebar-leave').onclick = () => document.querySelector('#wallet').classList.remove('transaction-received');
        document.querySelector('.wallet-open').onclick = () => this._onOpenWallet();
    }

    show() {
        document.body.setAttribute('overlay', 'wallet');
    }

    hide() {
        document.body.removeAttribute('overlay');
        this._onCloseWallet();
    }

    _isAccountAddressValid() {
        return /^[0-9a-f]{40}$/i.test(this._accountInput.value);
    }

    _validateAddress() {
        this._accountContainer.className = this._isAccountAddressValid() || !this._accountInput.value ? '' : 'invalid';
        this._checkEnableSendTxBtn();
    }

    _isAmountValid() {
        const amount = parseFloat(this._amountInput.value);
        const satoshis = Evo.Policy.coinsToSatoshis(amount);
        return satoshis >= 1 / 1e8 && satoshis <= this._balance.value;
    }

    _validateAmount() {
        this._amountContainer.className = this._isAmountValid() || !this._amountInput.value  ? '' : 'invalid';
        this._checkEnableSendTxBtn();
    }

    _checkEnableSendTxBtn() {
        this._sendTxBtn.disabled = !this._isAccountAddressValid() || !this._isAmountValid();
    }

    _onBalanceChanged(balance) {
        this._balance = balance;
        document.querySelector('#wallet-balance').innerText = Evo.Policy.satoshisToCoins(balance.value).toFixed(2);
    }

    _onOpenWallet(tx) {
        document.querySelector('#wallet').classList.add('information');
    }

    _onCloseWallet(tx) {
        document.querySelector('#wallet').classList.remove('information');
    }

    _onTxReceived(tx) {
        if (!this.$.wallet.address.equals(tx.recipientAddr)) return;

        if (this._receivingTx) {
            if (this._receivingInterval) {
                clearInterval(this._receivingInterval);
            }

            this._receivingElapsed = 0;
            document.querySelector('#receivingElapsed').innerText = '0:00';
        }

        tx.getSenderAddr().then(sender => document.querySelector('#receivingSender').innerText = sender.toHex());
        document.querySelector('#receivingAmount').innerText = Evo.Policy.satoshisToCoins(tx.value).toFixed(2);

        this._receivingInterval = setInterval(() => {
            this._receivingElapsed++;
            const minutes = Math.floor(this._receivingElapsed / 60);
            let seconds = this._receivingElapsed % 60;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            document.querySelector('#receivingElapsed').innerText = minutes + ':' + seconds;
        }, 1000);

        this.show();
        document.querySelector('#wallet').classList.add('transaction-received');
        this._receivingTx = tx;
    }

    _onTxsProcessed() {
        if (this._pendingTx) {
            this._pendingTx.hash().then(hash => {
                if (!this.$.mempool.getTransaction(hash)) {
                    this._pendingTransactionConfirmed();
                }
            });
        }

        if (this._receivingTx) {
            this._receivingTx.hash().then(hash => {
                if (!this.$.mempool.getTransaction(hash)) {
                    this._receivingTransactionConfirmed();
                }
            });
        }
    }

    _sendTx() {
        if (!this._isAccountAddressValid() || !this._isAmountValid()) return;

        const recipient = this._accountInput.value;
        const address = Evo.Address.fromHex(recipient);

        if (address.equals(this.$.wallet.address)) {
            alert('You cannot send transactions to yourself.');
            return;
        }

        const amount = parseFloat(this._amountInput.value);
        const satoshis = Evo.Policy.coinsToSatoshis(amount);

        this.$.wallet.createTransaction(address, satoshis, 0, this._balance.nonce)
            .then(tx => {
                this.$.mempool.pushTransaction(tx).then(result => {
                    if (!result) {
                        alert('Sending the transaction failed. You might have an unconfirmed transaction pending. Please try again in a few seconds.');
                    } else {
                        this._transactionPending(tx);
                    }
                });
            });
    }

    _transactionPending(tx) {
        this._accountInput.value = '';
        this._amountInput.value = '';
        this._accountInput.disabled = true;
        this._amountInput.disabled = true;
        this._sendTxBtn.disabled = true;

        document.querySelector('#pendingReceiver').innerText = tx.recipientAddr.toHex();
        document.querySelector('#pendingAmount').innerText = Evo.Policy.satoshisToCoins(tx.value).toFixed(2);

        this._pendingInterval = setInterval(() => {
            this._pendingElapsed++;
            const minutes = Math.floor(this._pendingElapsed / 60);
            let seconds = this._pendingElapsed % 60;
            seconds = seconds < 10 ? '0' + seconds : seconds;
            document.querySelector('#pendingElapsed').innerText = minutes + ':' + seconds;
        }, 1000);

        document.querySelector('#wallet').classList.add('transaction-pending');
        this._pendingTx = tx;
    }

    _pendingTransactionConfirmed() {
        this._accountInput.disabled = false;
        this._amountInput.disabled = false;

        this._pendingTx = null;
        this._pendingElapsed = 0;

        document.querySelector('#wallet').classList.remove('transaction-pending');

        document.querySelector('#pendingElapsed').innerText = '0:00';
        if (this._pendingInterval) {
            clearInterval(this._pendingInterval);
            this._pendingInterval = null;
        }
    }

    _receivingTransactionConfirmed() {
        this._receivingTx = null;
        this._receivingElapsed = 0;

        document.querySelector('#wallet').classList.remove('transaction-received');

        document.querySelector('#receivingElapsed').innerText = '0:00';
        if (this._receivingInterval) {
            clearInterval(this._receivingInterval);
            this._receivingInterval = null;
        }
    }


}
