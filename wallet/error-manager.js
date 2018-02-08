// Written in ES5 to also be able to show an Error that the browser does not support ES6
'use strict';

function ErrorManager() {
	this._errorMessages = {};
	this._errorMessages[ErrorManager.GENERAL_ERROR] = {
		message: 'An Error Occured.',
		submessage: 'Please reload.',
	};
	this._errorMessages[ErrorManager.OLD_BROWSER] = {
		message: 'Your browser is not up to date.',
		submessage: 'Update to see the full power of the Nimiq ecosystem in action.',
		button: 'Continue without Updating'
	};
	this._errorMessages[ErrorManager.MULTIPLE_TABS] = {
		message: 'Nimiq is already running in a different tab.',
		submessage: 'Please close the other tabs first.'
	};
	this._errorMessages[ErrorManager.NO_LOCALSTORAGE] = {
		message: 'Your browser does not support local storage.',
		submessage: 'If you are in private browsing mode, try to run this page in normal mode.',
		button: 'Continue in Private Mode'
	};
	this._walletEl = document.getElementById('wallet');
	this._errorEl = document.getElementById('error');
	this._errorMessageEl = document.getElementById('error-message');
	this._errorSubMessageEl = document.getElementById('error-sub-message');
	this._errorButtonEl = document.getElementById('error-button');
}
ErrorManager.GENERAL_ERROR = 'general-error';
ErrorManager.OLD_BROWSER = 'old-browser';
ErrorManager.MULTIPLE_TABS = 'multiple-tabs';
ErrorManager.NO_LOCALSTORAGE = 'no-localstorage';


ErrorManager.prototype.showError = function(type) {
	_paq.push(['trackEvent', 'Error', this._errorMessages[type] ? type : ErrorManager.GENERAL_ERROR]);
	var errorMessage = this._errorMessages[type] || this._errorMessages[ErrorManager.GENERAL_ERROR];
	if (errorMessage.message) {
		this._errorMessageEl.textContent = errorMessage.message;
		this._errorMessageEl.style.display = 'block';
	} else {
		this._errorMessageEl.style.display = 'none';
	}
	if (errorMessage.submessage) {
		this._errorSubMessageEl.textContent = errorMessage.submessage;
		this._errorSubMessageEl.style.display = 'block';
		this._errorEl.classList.add('has-sub-message');
	} else {
		this._errorSubMessageEl.style.display = 'none';
		this._errorEl.classList.remove('has-sub-message');
	}
	if (errorMessage.button) {
		this._errorButtonEl.textContent = errorMessage.button;
		this._errorButtonEl.style.display = 'block';
	} else {
		this._errorButtonEl.style.display = 'none';
	}
	this._walletEl.setAttribute('error', '');
}

ErrorManager.prototype.clearError = function() {
	this._walletEl.removeAttribute('error');
}


window.errorManager = new ErrorManager();