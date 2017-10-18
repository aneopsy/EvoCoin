const HttpServer = require('./httpServer');
const JsonRpcServer = require('./jsonrpcServer');
const Blockchain = require('./blockchain');
const Operator = require('./operator');
const Miner = require('./miner');
const Node = require('./node');

module.exports = function naivecoin(host, port, peers, logLevel, name) {
  host = process.env.HOST || host || 'localhost';
  port = process.env.PORT || process.env.HTTP_PORT || port || 3001;
  // json_rpc_port = process.env.JSON_PORT || 3000;
  peers = (process.env.PEERS ? process.env.PEERS.split(',') : peers || []);
  peers = peers.map((peer) => {
    return {
      url: peer
    };
  });
  logLevel = (process.env.LOG_LEVEL ? process.env.LOG_LEVEL : logLevel || 6);
  name = process.env.NAME || name || '1';

  require('./util/consoleWrapper.js')(name, logLevel);

  console.info(`Starting node ${name}`);

  let blockchain = new Blockchain(name);
  let operator = new Operator(name, blockchain);
  let miner = new Miner(blockchain, logLevel);
  let node = new Node(host, port, peers, blockchain);
  let httpServer = new HttpServer(node, blockchain, operator, miner);
  let jsonrpcServer = new JsonRpcServer(node, blockchain, operator, miner);

  httpServer.listen(host, port);
  jsonrpcServer.listen(host, port+1);
};
