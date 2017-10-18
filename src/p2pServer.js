'use strict';

const WebSocket = require("ws");

const p2p_port = process.env.P2P_PORT || 6001;
const sockets = [];

var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

const initP2PServer = () => {
    var server = new WebSocket.Server({port: p2p_port});
    server.on('connection', ws => initConnection(ws));
    console.log('listening websocket p2p port on: ' + p2p_port);
};

const connectToPeers = (newPeers) => {
  console.log('connectToPeers:::: ' + newPeers);
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            console.log('connection failed')
        });
    });
};

const initMessageHandler = (ws) => {
    ws.on('message', (data) => {
        var message = JSON.parse(data);
        console.log('Received Message: ' + JSON.stringify(message));
        console.log('Received TYPE: ' + JSON.stringify(message.type));
        switch (message.type) {
            case MessageType.QUERY_LATEST:
              console.log('QUERY_LATEST');
              write(ws, responseLatestMsg());
              break;
            case MessageType.QUERY_ALL:
              console.log('QUERY_ALL');
              write(ws, chain.responseChainMsg());
              break;
            case MessageType.RESPONSE_BLOCKCHAIN:
              console.log('RESPONSE_BLOCKCHAIN');
              chain.handleBlockchainResponse(message);
              break;
        }
    });
};

const broadcastLatestMsg = () => {
  broadcast(responseLatestMsg());
};

const responseLatestMsg = () => ({
    'type': MessageType.RESPONSE_BLOCKCHAIN,
    'data': JSON.stringify([chain.getLatestBlock()])
});

const initErrorHandler = (ws) => {
    var closeConnection = (ws) => {
        console.log('connection failed to peer: ' + ws.url);
        sockets.splice(sockets.indexOf(ws), 1);
    };
    ws.on('close', () => closeConnection(ws));
    ws.on('error', () => closeConnection(ws));
};

const initConnection = (ws) => {
  console.log('initConnection..... ');
    sockets.push(ws);
    initMessageHandler(ws);
    initErrorHandler(ws);
    write(ws, {'type': MessageType.QUERY_LATEST});
};

var queryChainLengthMsg = () => {
  return {'type': MessageType.QUERY_LATEST};
};

const write = (ws, message) => ws.send(JSON.stringify(message));
const broadcast = (message) => sockets.forEach(socket => write(socket, message));

const listPeers = () => {
  return sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort)
};

module.exports = {
  initP2PServer,
  connectToPeers,
  write,
  broadcast,
  listPeers,
  broadcastLatestMsg
};
