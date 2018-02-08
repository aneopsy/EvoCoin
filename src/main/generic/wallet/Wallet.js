class Wallet {
    static async getPersistent() {
        const db = new WalletStore();
        let keys = await db.get('keys');
        if (!keys) {
            keys = await KeyPair.generate();
            await db.put('keys', keys);
        }
        return new Wallet(keys);
    }

    static async createVolatile() {
        return new Wallet(await KeyPair.generate());
    }

    /**
     * @param {Uint8Array|string} buf
     * @return {Wallet}
     */
    static load(hexBuf) {
        const hexMatch = hexBuf.match(/[0-9A-Fa-f]*/);
        if (hexBuf.length / 2 !== Crypto.privateKeySize || hexMatch[0] !== hexBuf) {
            throw Wallet.ERR_INVALID_WALLET_SEED;
        }

        return new Wallet(KeyPair.fromHex(hexBuf));
    }

    /**
     * Create a new Wallet.
     * @returns {Promise.<Wallet>} Newly created Wallet.
     */
    constructor(keyPair) {
        this._keyPair = keyPair;
        return this._init();
    }

    async _init() {
        this._address = await this._keyPair.publicKey.toAddress();
        return this;
    }

    /**
     * Create a Transaction that is signed by the owner of this Wallet.
     * @param {Address} recipient Address of the transaction receiver
     * @param {number} value Number of Satoshis to send.
     * @param {number} fee Number of Satoshis to donate to the Miner.
     * @param {number} nonce The nonce
     * @returns {Transaction} A prepared and signed Transaction object. This still has to be sent to the network.
     */
    createTransaction(recipient, value, fee, nonce) {
        const transaction = new Transaction(this._keyPair.publicKey, recipient, value, fee, nonce);
        return this._signTransaction(transaction);
    }

    async _signTransaction(transaction) {
        transaction.signature = await Signature.create(this._keyPair.privateKey, transaction.serializeContent());
        return transaction;
    }

    /**
     * The address of the Wallet owner.
     * @type {Address}
     */
    get address() {
        return this._address;
    }

    /**
     * The public key of the Wallet owner
     * @type {PublicKey}
     */
    get publicKey() {
        return this._keyPair.publicKey;
    }

    /** @type {KeyPair} */
    get keyPair() {
        return this._keyPair;
    }

    dump() {
        return this._keyPair.toHex();
    }
}

Wallet.ERR_INVALID_WALLET_SEED = -100;

Class.register(Wallet);
