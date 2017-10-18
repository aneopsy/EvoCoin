const EventEmitter = require('events');
const R = require('ramda');
const Db = require('../util/db');
const Blocks = require('./blocks');
const Block = require('./block');
const Transactions = require('./transactions');
const TransactionAssertionError = require('./transactionAssertionError');
const BlockAssertionError = require('./blockAssertionError');
const BlockchainAssertionError = require('./blockchainAssertionError');

const BLOCKCHAIN_FILE = 'blocks.json';
const TRANSACTIONS_FILE = 'transactions.json';

const BASE_DIFFICULTY = Number.MAX_SAFE_INTEGER;
const EVERY_X_BLOCKS = 5;
const POW_CURVE = 5;

const MINING_REWARD = 5000000000;

class Blockchain {
  constructor(dbName) {
    this.blocksDb = new Db('data/' + dbName + '/' + BLOCKCHAIN_FILE, new Blocks());
    this.transactionsDb = new Db('data/' + dbName + '/' + TRANSACTIONS_FILE, new Transactions());

    this.blocks = this.blocksDb.read(Blocks);
    this.transactions = this.transactionsDb.read(Transactions);

    this.emitter = new EventEmitter();
    this.init();
  }

  init() {
    if (this.blocks.length == 0) {
      console.info('Blockchain empty, adding genesis block');
      this.blocks.push(Block.genesis);
      this.blocksDb.write(this.blocks);
    }

    console.info('Removing transactions that are in the blockchain');
    R.forEach(this.removeBlockTransactionsFromTransactions.bind(this), this.blocks);
  }

  getAllBlocks() {
    return this.blocks;
  }

  getBlockByIndex(index) {
    return R.find(R.propEq('index', index), this.blocks);
  }

  getBlockByHash(hash) {
    return R.find(R.propEq('hash', hash), this.blocks);
  }

  getLastBlock() {
    return R.last(this.blocks);
  }

  getDifficulty(index) {
    return Math.max(
      Math.floor(
        BASE_DIFFICULTY / Math.pow(
          Math.floor(((index || this.blocks.length) + 1) / EVERY_X_BLOCKS) + 1, POW_CURVE)
      ), 0);
  }

  getAllTransactions() {
    return this.transactions;
  }

  getTransactionById(id) {
    return R.find(R.propEq('id', id), this.transactions);
  }

  getTransactionFromBlocks(transactionId) {
    return R.find(R.compose(R.find(R.propEq('id', transactionId)), R.prop('transactions')), this.blocks);
  }

  replaceChain(newBlockchain) {
    if (newBlockchain.length <= this.blocks.length) {
      console.error('Blockchain shorter than the current blockchain');
      throw new BlockchainAssertionError('Blockchain shorter than the current blockchain');
    }

    this.checkChain(newBlockchain);

    console.info('Received blockchain is valid. Replacing current blockchain with received blockchain');
    let newBlocks = R.takeLast(newBlockchain.length - this.blocks.length, newBlockchain);

    R.forEach((block) => {
      this.addBlock(block, false);
    }, newBlocks);

    this.emitter.emit('blockchainReplaced', newBlocks);
  }

  checkChain(blockchainToValidate) {
    if (JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(Block.genesis)) {
      console.error('Genesis blocks aren\'t the same');
      throw new BlockchainAssertionError('Genesis blocks aren\'t the same');
    }

    try {
      for (let i = 1; i < blockchainToValidate.length; i++) {
        this.checkBlock(blockchainToValidate[i], blockchainToValidate[i - 1]);
      }
    } catch (ex) {
      console.error('Invalid block sequence');
      throw new BlockchainAssertionError('Invalid block sequence', null, ex);
    }
    return true;
  }

  addBlock(newBlock, emit = true) {
    if (this.checkBlock(newBlock, this.getLastBlock())) {
      this.blocks.push(newBlock);
      this.blocksDb.write(this.blocks);

      this.removeBlockTransactionsFromTransactions(newBlock);

      console.info(`Block added: ${newBlock.hash}`);
      console.log(`Block added: ${JSON.stringify(newBlock)}`);
      if (emit) this.emitter.emit('blockAdded', newBlock);

      return newBlock;
    }
  }

  addTransaction(newTransaction, emit = true) {
    if (this.checkTransaction(newTransaction)) {
      this.transactions.push(newTransaction);
      this.transactionsDb.write(this.transactions);

      console.info(`Transaction added: ${newTransaction.id}`);
      console.log(`Transaction added: ${JSON.stringify(newTransaction)}`);
      if (emit) this.emitter.emit('transactionAdded', newTransaction);

      return newTransaction;
    }
  }

  removeBlockTransactionsFromTransactions(newBlock) {
    this.transactions = R.reject((transaction) => {
      return R.find(R.propEq('id', transaction.id), newBlock.transactions);
    }, this.transactions);
    this.transactionsDb.write(this.transactions);
  }

  checkBlock(newBlock, previousBlock) {
    const blockHash = newBlock.toHash();

    if (previousBlock.index + 1 !== newBlock.index) {
      console.error(`Invalid index: expected '${previousBlock.index + 1}' got '${newBlock.index}'`);
      throw new BlockAssertionError(`Invalid index: expected '${previousBlock.index + 1}' got '${newBlock.index}'`);
    } else if (previousBlock.hash !== newBlock.previousHash) {
      console.error(`Invalid previoushash: expected '${previousBlock.hash}' got '${newBlock.previousHash}'`);
      throw new BlockAssertionError(`Invalid previoushash: expected '${previousBlock.hash}' got '${newBlock.previousHash}'`);
    } else if (blockHash !== newBlock.hash) {
      console.error(`Invalid hash: expected '${blockHash}' got '${newBlock.hash}'`);
      throw new BlockAssertionError(`Invalid hash: expected '${blockHash}' got '${newBlock.hash}'`);
    } else if (newBlock.getDifficulty() >= this.getDifficulty(newBlock.index)) {
      console.error(`Invalid proof-of-work difficulty: expected '${newBlock.getDifficulty()}' to be smaller than '${this.getDifficulty(newBlock.index)}'`);
      throw new BlockAssertionError(`Invalid proof-of-work difficulty: expected '${newBlock.getDifficulty()}' be smaller than '${this.getDifficulty()}'`);
    }

    R.forEach(this.checkTransaction.bind(this), newBlock.transactions);

    let sumOfInputsAmount = R.sum(R.flatten(R.map(R.compose(R.map(R.prop('amount')), R.prop('inputs'), R.prop('data')), newBlock.transactions))) + MINING_REWARD;
    let sumOfOutputsAmount = R.sum(R.flatten(R.map(R.compose(R.map(R.prop('amount')), R.prop('outputs'), R.prop('data')), newBlock.transactions)));

    let isInputsAmountGreaterOrEqualThanOutputsAmount = R.gte(sumOfInputsAmount, sumOfOutputsAmount);

    if (!isInputsAmountGreaterOrEqualThanOutputsAmount) {
      console.error(`Invalid block balance: inputs sum '${sumOfInputsAmount}', outputs sum '${sumOfOutputsAmount}'`);
      throw new BlockAssertionError(`Invalid block balance: inputs sum '${sumOfInputsAmount}', outputs sum '${sumOfOutputsAmount}'`, {
        sumOfInputsAmount,
        sumOfOutputsAmount
      });
    }

    let transactionsByType = R.countBy(R.prop('type'), newBlock.transactions);
    if (transactionsByType.fee && transactionsByType.fee > 1) {
      console.error(`Invalid fee transaction count: expected '1' got '${transactionsByType.fee}'`);
      throw new BlockAssertionError(`Invalid fee transaction count: expected '1' got '${transactionsByType.fee}'`);
    }

    if (transactionsByType.reward && transactionsByType.reward > 1) {
      console.error(`Invalid reward transaction count: expected '1' got '${transactionsByType.reward}'`);
      throw new BlockAssertionError(`Invalid reward transaction count: expected '1' got '${transactionsByType.reward}'`);
    }

    return true;
  }

  checkTransaction(transaction) {
    transaction.check(transaction);

    let isNotInBlockchain = R.all((block) => {
      return R.none(R.propEq('id', transaction.id), block.transactions);
    }, this.blocks);

    if (!isNotInBlockchain) {
      console.error(`Transaction '${transaction.id}' is already in the blockchain`);
      throw new TransactionAssertionError(`Transaction '${transaction.id}' is already in the blockchain`, transaction);
    }

    let isInputTransactionsUnspent = R.all(R.equals(false), R.flatten(R.map((txInput) => {
      return R.map(
        R.pipe(
          R.prop('transactions'),
          R.map(R.pipe(
            R.path(['data', 'inputs']),
            R.contains({
              transaction: txInput.transaction,
              index: txInput.index
            })
          ))
        ), this.blocks);
    }, transaction.data.inputs)));

    if (!isInputTransactionsUnspent) {
      console.error(`Not all inputs are unspent for transaction '${transaction.id}'`);
      throw new TransactionAssertionError(`Not all inputs are unspent for transaction '${transaction.id}'`, transaction.data.inputs);
    }

    return true;
  }

  getUnspentTransactionsForAddress(address) {
    let txOutputs = [];
    R.forEach(R.pipe(R.prop('transactions'), R.forEach((transaction) => {
      R.forEachObjIndexed((txOutput, index) => {
        if (address && txOutput.address != address) return;

        txOutputs.push({
          transaction: transaction.id,
          index: index,
          amount: txOutput.amount,
          address: txOutput.address
        });
      }, transaction.data.outputs);
    })), this.blocks);

    let txInputs = [];
    R.forEach(R.pipe(R.prop('transactions'), R.forEach(
      R.pipe(R.path(['data', 'inputs']), R.forEach((txInput) => {
        if (address && txInput.address != address) return;

        txInputs.push({
          transaction: txInput.transaction,
          index: txInput.index,
          amount: txInput.amount,
          address: txInput.address
        });
      }))
    )), this.blocks);

    let unspentTransactionOutput = [];
    R.forEach((txOutput) => {
      if (!R.any((txInput) => txInput.transaction == txOutput.transaction && txInput.index == txOutput.index, txInputs)) {
        unspentTransactionOutput.push(txOutput);
      }
    }, txOutputs);

    return unspentTransactionOutput;
  }
}

module.exports = Blockchain;
