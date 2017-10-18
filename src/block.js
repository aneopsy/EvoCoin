'use strict';
var CryptoJS = require("crypto-js");

// BLOCK
class Block {
    constructor(index, previousHash, timestamp, data) {
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.data = data;
        this.hash = this.calculateHash();
    }

    calculateHash () {
          return CryptoJS.SHA256(this.index + this.previousHash + this.timestamp + this.data).toString();
    }
}

module.exports = Block;
