const JSONRPCError = require('./jsonrpcError');
const Block = require('../blockchain/block');
const Transaction = require('../blockchain/transaction');
const TransactionAssertionError = require('../blockchain/transactionAssertionError');
const BlockAssertionError = require('../blockchain/blockAssertionError');
const ArgumentError = require('../util/argumentError');
const CryptoUtil = require('../util/cryptoUtil');
// var express = require('express');
// var WebSocket = require("ws");
var jayson = require('jayson');

class JsonRpcServer {

  constructor(node, blockchain, operator, miner) {
    this.methods = {
      ping: function(args, callback) {
        callback(null, 'pong');
      },
      net_version: function(args, callback) {
        callback(null, 0);
      },
      net_peerCount: function(args, callback) {
        callback(null, 0);
      },
      blockNumber: function(args, callback) {
        callback(null, 0);
      },
      blocks: function(args, callback) {
        callback(null, blockchain.getAllBlocks());
      },
      blockLastest: function(args, callback) {
        let lastBlock = blockchain.getLastBlock();
        // if (lastBlock == null)
        //   throw new JSONRPCError(404, 'Last block not found');
        callback(null, lastBlock);
      },
      blockHash: function(args, callback) {
        let blockFound = blockchain.getBlockByHash(args[0]);
        // if (blockFound == null)
        //   throw new JSONRPCError(404, `Block not found with hash '${args[0]}'`);
        callback(null, blockFound);
      },
      blockIndex: function(args, callback) {
        let blockFound = blockchain.getBlockByIndex(args[0]);
        // if (blockFound == null)
        //   throw new JSONRPCError(404, `Block not found with hash '${args[0]}'`);
        callback(null, blockFound);
      },
      sendTransaction: function(args, callback) {
        callback();
      }
    };

    this.app = jayson.server(this.methods, {
      collect: true,
      params: Array
    });
  }

  listen(host, port) {
    return new Promise((resolve, reject) => {
      this.server = this.app.http().listen(port, (err) => {
        if (err) reject(err);
        console.info(`Listening JsonRpc on port: ${this.server.address().port}`);
        resolve(this);
      });
    });
  }
}

module.exports = JsonRpcServer;
