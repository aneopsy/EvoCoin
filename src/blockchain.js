'use strict';
var Sha256 = require('./sha256.js');
var Block = require("./block.js");

// BLOCKCHAIN
class Blockchain {
    constructor() {
      this.chain = [this.createGenesisBlock()];
    }

    createGenesisBlock() {
      return new Block(0, "0", (new Date().getTime() / 1000), 0);
    }

    generateNextBlock(blockData) {
        var previousBlock = this.getLatestBlock();
        var nextIndex = previousBlock.index + 1;
        var nextTimestamp = new Date().getTime() / 1000;
        this.addBlock(new Block(nextIndex, previousBlock.hash, nextTimestamp, blockData));
        return true;
    };

    addBlock(newBlock) {
        // if (this.isValidNewBlock(newBlock, this.getLatestBlock())) {
            this.chain.push(newBlock);
        // }
    };

    isValidNewBlock(newBlock, previousBlock) {
        if (previousBlock.index + 1 !== newBlock.index) {
            console.log('invalid index');
            return false;
        } else if (previousBlock.hash !== newBlock.previousHash) {
            console.log('invalid previoushash');
            return false;
        } else if (newBlock.calculateHash() !== newBlock.hash) {
            console.log(typeof (newBlock.hash) + ' ' + typeof newBlock.calculateHash());
            console.log('invalid hash: ' + newBlock.calculateHash() + ' ' + newBlock.hash);
            return false;
        }
        return true;
    };

    isValidChain() {
        if (JSON.stringify(this.chain[0]) !== JSON.stringify(this.getGenesisBlock())) {
            return false;
        }
        var tempBlocks = [this.chain[0]];
        for (var i = 1; i < this.chain.length; i++) {
            if (this.isValidNewBlock(this.chain[i], tempBlocks[i - 1])) {
                tempBlocks.push(this.chain[i]);
            } else {
                return false;
            }
        }
        return true;
    };

    replaceChain(newChain) {
        // if (newChain.isValidChain() && newChain.length > this.chain.length) {
        //     console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
            this.chain = newChain;
            // broadcast(responseLatestMsg());
        // } else {
        //     console.log('Received blockchain invalid');
        // }
    };

    getLatestBlock() {
      return this.chain[this.chain.length - 1];
    }

    getBlockchain() {
      return this.chain;
    }

}

module.exports = Blockchain;
