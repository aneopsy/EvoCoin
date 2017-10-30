class Login {
  constructor($) {
    // this._loadingSpinner = document.querySelector('#initialLoadingSpinner');
    // this._loadingSpinner.parentElement.removeChild(this._loadingSpinner);
    // this._loadingSpinner = null;
    this._startButton = document.querySelector('#connectBtn');
    this._startButton.addEventListener('click', this._startEvo);
    this._accountContainer = $$('#login-account-input');
    this._accountInput = $$('#login-account-input input');
    this._accountInput.onchange = () => this._validateAddress();
    this._accountInput.onkeyup = () => this._validateAddress();
  }

  _isAccountAddressValid() {
    return /^[0-9a-f]{192}$/i.test(this._accountInput.value);
  }

  _validateAddress() {
    this._accountContainer.className = this._isAccountAddressValid() || !this._accountInput.value ? '' : 'invalid';
    this._checkEnableSendTxBtn();
  }

  _checkEnableSendTxBtn() {
    this._startButton.disabled = !(this._isAccountAddressValid() || !this._accountInput.value);
  }

  _startEvo() {

    var walletSeed = document.getElementById('walletSeed').value.trim();
    var options = (walletSeed !== '') ? {
      walletSeed: walletSeed
    } : {}

    // Initialize Nimiq Core.
    Nimiq.init($ => {
      document.getElementById('landingSection').classList.remove('warning');
      document.getElementById('warning-multiple-tabs').style.display = 'none';
      window.$ = $;
      window.Miner = new Miner($);
      window.Wallet = new WalletUI($);
    }, function(error) {
      document.getElementById('landingSection').classList.add('warning');
      if (error === Nimiq.ERR_WAIT) {
        document.getElementById('warning-multiple-tabs').style.display = 'block';
      } else if (error === Nimiq.ERR_UNSUPPORTED) {
        document.getElementById('warning-old-browser').style.display = 'block';
      } else {
        document.getElementById('warning-general-error').style.display = 'block';
      }
    }, options);
  }
}

this.login = new Login();

function $$(selector, context) {
    context = context || document;
    var elements = context.querySelectorAll(selector);
    return Array.prototype.slice.call(elements);
}
