class JsonRpcServer {

  constructor(node, blockchain, operator, miner) {
    var methods = {
      add: function(args, callback) {
        callback(null, args[0] + args[1]);
      },
      net_version: function(args, callback) {
        callback(null, VERSION);
      },
      net_peerCount: function(args, callback) {
        callback(null, initP2PServer.listPeers().length.toString(16));
      },
      blockNumber: function(args, callback) {
        callback(null, BC.getBlockchain().length.toString(16));
      },
      sendTransaction: function(args, callback) {
        BC.generateNextBlock(args);
        console.log('block added: ' + JSON.stringify(BC.getLatestBlock()));
        broadcast(responseLatestMsg());
        callback();
      }
    };

    var server = jayson.server(methods, {
      collect: true,
      params: Array
    });

  }
  server.http().listen(json_rpc_port, () => console.log('Listening JSON-RPC on port: ' + json_rpc_port));
}

module.exports = JsonRpcServer;
