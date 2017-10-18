'use strict';
var Sha256 = require('./sha256.js');

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
          return Sha256.hash(this.index + this.previousHash + this.timestamp + this.data).toString();
    }
}

module.exports = Block;
