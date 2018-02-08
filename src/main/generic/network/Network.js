class Network extends Observable {
    /**
     * @type {number}
     * @constant
     */
    static get PEER_COUNT_MAX() {
        return PlatformUtils.isBrowser() ? 15 : 50000;
    }

    /**
     * @type {number}
     * @constant
     */
    static get PEER_COUNT_PER_IP_WS_MAX() {
        return PlatformUtils.isBrowser() ? 1 : 25;
    }

    /**
     * @type {number}
     * @constant
     */
    static get PEER_COUNT_PER_IP_RTC_MAX() {
        return 2;
    }

    /**
     * @constructor
     * @param {IBlockchain} blockchain
     */
    constructor(blockchain) {
        super();
        this._blockchain = blockchain;
        return this._init();
    }

    /**
     * @listens PeerAddresses
     * @listens WebSocketConnector
     * @listens WebRtcConnector
     */
    async _init() {
        this._autoConnect = false;
        this._savedAutoConnect = false;
        this._connectingCount = 0;
        this._agents = new HashMap();
        this._connectionCounts = new HashMap();
        this._bytesSent = 0;
        this._bytesReceived = 0;
        /* WS */
        this._wsConnector = new WebSocketConnector();
        this._wsConnector.on('connection', conn => this._onConnection(conn));
        this._wsConnector.on('error', peerAddr => this._onError(peerAddr));
        /* RTC */
        this._rtcConnector = await new WebRtcConnector();
        this._rtcConnector.on('connection', conn => this._onConnection(conn));
        this._rtcConnector.on('error', (peerAddr, reason) => this._onError(peerAddr, reason));

        this._addresses = new PeerAddresses();

        this._addresses.on('added', addresses => {
            this._relayAddresses(addresses);
            this._checkPeerCount();
        });

        if (PlatformUtils.isBrowser()) {
            window.addEventListener('online', _ => this._onOnline());
            window.addEventListener('offline', _ => this._onOffline());
        }

        this._forwards = new SignalStore();

        return this;
    }

    connect() {
        this._autoConnect = true;
        this._savedAutoConnect = true;

        this._checkPeerCount();
    }

    /**
     * @param {string|*} reason
     */
    disconnect(reason) {
        this._autoConnect = false;
        this._savedAutoConnect = false;

        for (const agent of this._agents.values()) {
            agent.channel.close(reason || 'manual network disconnect');
        }
    }

    isOnline() {
        return (!PlatformUtils.isBrowser() || window.navigator.onLine === undefined) || window.navigator.onLine;
    }

    _onOnline() {
        this._autoConnect = this._savedAutoConnect;

        if (this._autoConnect) {
            this._checkPeerCount();
        }
    }

    _onOffline() {
        this._savedAutoConnect = this._autoConnect;
        this.disconnect('network disconnect');
    }

    // XXX For testing
    disconnectWebSocket() {
        this._autoConnect = false;

        // Close all websocket connections.
        for (const agent of this._agents.values()) {
            if (agent.peer.peerAddress.protocol === Protocol.WS) {
                agent.channel.close('manual websocket disconnect');
            }
        }
    }

    /**
     * @param {Array.<PeerAddress>} addresses
     * @returns {void}
     * @private
     */
    _relayAddresses(addresses) {
        if (addresses.length > 10) {
            return;
        }

        const agents = this._agents.values();
        for (let i = 0; i < Network.PEER_COUNT_RELAY; ++i) {
            const agent = ArrayUtils.randomElement(agents);
            if (agent) {
                agent.relayAddresses(addresses);
            }
        }
    }

    _checkPeerCount() {
        if (this._autoConnect // && this.isOnline() Do we need this? Not really if _onOnline/_onOffline is working.
            &&
            this.peerCount + this._connectingCount < Network.PEER_COUNT_DESIRED &&
            this._connectingCount < Network.CONNECTING_COUNT_MAX) {

            // Pick a peer address that we are not connected to yet.
            const peerAddress = this._addresses.pickAddress();

            // We can't connect if we don't know any more addresses.
            if (!peerAddress) {
                return;
            }

            // Connect to this address.
            this._connect(peerAddress);
        }
    }

    /**
     * @param {PeerAddress} peerAddress
     * @returns {void}
     * @private
     */
    _connect(peerAddress) {
        switch (peerAddress.protocol) {
            case Protocol.WS:
                Log.d(Network, `Connecting to ${peerAddress} ...`);
                if (this._wsConnector.connect(peerAddress)) {
                    this._addresses.connecting(peerAddress);
                    this._connectingCount++;
                }
                break;

            case Protocol.RTC:
                {
                    const signalChannel = this._addresses.getChannelBySignalId(peerAddress.signalId);
                    Log.d(Network, `Connecting to ${peerAddress} via ${signalChannel.peerAddress}...`);
                    if (this._rtcConnector.connect(peerAddress, signalChannel)) {
                        this._addresses.connecting(peerAddress);
                        this._connectingCount++;
                    }
                    break;
                }

            default:
                Log.e(Network, `Cannot connect to ${peerAddress} - unsupported protocol`);
                this._onError(peerAddress);
        }
    }

    /**
     * @listens PeerChannel#signal
     * @listens PeerChannel#ban
     * @listens NetworkAgent#handshake
     * @listens NetworkAgent#close
     * @param {PeerConnection} conn
     * @returns {void}
     * @private
     */
    _onConnection(conn) {
        if (conn.outbound && this._addresses.isConnecting(conn.peerAddress)) {
            this._connectingCount--;
        }
        if (conn.netAddress && !this._incrementConnectionCount(conn)) {
            return;
        }
        if (conn.outbound && this._addresses.isConnected(conn.peerAddress)) {
            conn.close('duplicate connection (outbound, pre handshake)');
            return;
        }
        if (this.peerCount >= Network.PEER_COUNT_MAX) {
            conn.close(`max peer count reached (${Network.PEER_COUNT_MAX})`);
            return;
        }
        const connType = conn.inbound ? 'inbound' : 'outbound';
        Log.d(Network, `Connection established (${connType}) #${conn.id} ${conn.netAddress || conn.peerAddress || '<pending>'}`);
        const channel = new PeerChannel(conn);
        channel.on('signal', msg => this._onSignal(channel, msg));
        channel.on('ban', reason => this._onBan(channel, reason));
        const agent = new NetworkAgent(this._blockchain, this._addresses, channel);
        agent.on('handshake', peer => this._onHandshake(peer, agent));
        agent.on('close', (peer, channel, closedByRemote) => this._onClose(peer, channel, closedByRemote));
        this._agents.put(conn.id, agent);
        agent.handshake();
        setTimeout(() => this._checkPeerCount(), Network.ADDRESS_UPDATE_DELAY);
    }

    /**
     * Handshake with this peer was successful.
     * @fires Network#peer-joined
     * @fires Network#peers-changed
     * @param {Peer} peer
     * @param {NetworkAgent} agent
     * @returns {void}
     * @private
     */
    _onHandshake(peer, agent) {
        if (peer.channel.netAddress) {
            if (peer.peerAddress.netAddress && !peer.peerAddress.netAddress.equals(peer.channel.netAddress)) {
                Log.w(Network, `Got different netAddress ${peer.channel.netAddress} for peer ${peer.peerAddress} ` +
                    `- advertised was ${peer.peerAddress.netAddress}`);
            }
            if (!peer.channel.netAddress.isPrivate()) {
                peer.peerAddress.netAddress = peer.channel.netAddress;
            }
        } else if (peer.channel.peerAddress.netAddress) {
            peer.channel.netAddress = peer.channel.peerAddress.netAddress;
            if (!this._incrementConnectionCount(peer.channel.connection)) {
                return;
            }
        } else {
            peer.channel.netAddress = NetAddress.UNKNOWN;
        }
        if (this._addresses.isConnected(peer.peerAddress)) {
            agent.channel.close('duplicate connection (post handshake)');
            return;
        }
        if (this._addresses.isBanned(peer.peerAddress)) {
            agent.channel.close('peer is banned');
            return;
        }
        this._addresses.connected(agent.channel, peer.peerAddress);
        this._relayAddresses([peer.peerAddress]);
        this.fire('peer-joined', peer);
        this.fire('peers-changed');
        Log.d(Network, `[PEER-JOINED] ${peer.peerAddress} ${peer.netAddress} (version=${peer.version}, startHeight=${peer.startHeight}, totalWork=${peer.totalWork})`);
    }

    /**
     * Connection to this peer address failed.
     * @param {PeerAddress} peerAddress
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onError(peerAddress, reason) {
        Log.w(Network, `Connection to ${peerAddress} failed` + (reason ? ` - ${reason}` : ''));

        if (this._addresses.isConnecting(peerAddress)) {
            this._connectingCount--;
        }

        this._addresses.unreachable(peerAddress);

        this._checkPeerCount();
    }

    /**
     * This peer channel was closed.
     * @fires Network#peer-left
     * @fires Network#peers-changed
     * @param {Peer} peer
     * @param {PeerChannel} channel
     * @param {boolean} closedByRemote
     * @returns {void}
     * @private
     */
    _onClose(peer, channel, closedByRemote) {
        this._agents.remove(channel.id);
        if (channel.netAddress && !channel.netAddress.isPseudo()) {
            this._decrementConnectionCount(channel.netAddress);
        }
        this._bytesSent += channel.connection.bytesSent;
        this._bytesReceived += channel.connection.bytesReceived;
        if (channel.peerAddress) {
            if (this._addresses.isConnected(channel.peerAddress)) {
                this._addresses.disconnected(channel, closedByRemote);
                this.fire('peer-left', peer);
                this.fire('peers-changed');
                const kbTransferred = ((channel.connection.bytesSent +
                    channel.connection.bytesReceived) / 1000).toFixed(2);
                Log.d(Network, `[PEER-LEFT] ${peer.peerAddress} ${peer.netAddress} ` +
                    `(version=${peer.version}, startHeight=${peer.startHeight}, ` +
                    `transferred=${kbTransferred} kB)`);
            } else {
                Log.w(Network, `Connection to ${channel.peerAddress} closed pre-handshake (by ${closedByRemote ? 'remote' : 'us'})`);
                this._addresses.unreachable(channel.peerAddress);
            }
        }

        this._checkPeerCount();
    }

    /**
     * This peer channel was banned.
     * @param {PeerChannel} channel
     * @param {string|*} [reason]
     * @returns {void}
     * @private
     */
    _onBan(channel, reason) {
        if (channel.peerAddress) {
            this._addresses.ban(channel.peerAddress);
        }
    }

    _incrementConnectionCount(conn) {
        let numConnections = this._connectionCounts.get(conn.netAddress) || 0;
        numConnections++;
        this._connectionCounts.put(conn.netAddress, numConnections);

        // Enforce max connections per IP limit.
        const maxConnections = conn.protocol === Protocol.WS ?
            Network.PEER_COUNT_PER_IP_WS_MAX : Network.PEER_COUNT_PER_IP_RTC_MAX;
        if (numConnections > maxConnections) {
            conn.close(`connection limit per ip (${maxConnections}) reached`);
            return false;
        }
        return true;
    }

    _decrementConnectionCount(netAddress) {
        let numConnections = this._connectionCounts.get(netAddress) || 1;
        numConnections = Math.max(numConnections - 1, 0);
        this._connectionCounts.put(netAddress, numConnections);
    }

    /**
     * @param {PeerChannel} channel
     * @param {SignalMessage} msg
     * @returns {void}
     * @private
     */
    _onSignal(channel, msg) {
        if (msg.ttl > Network.SIGNAL_TTL_INITIAL) {
            channel.ban('invalid signal ttl');
            return;
        }
        const mySignalId = NetworkConfig.myPeerAddress().signalId;
        if (msg.senderId === mySignalId) {
            Log.w(Network, `Received signal from myself to ${msg.recipientId} from ${channel.peerAddress} (myId: ${mySignalId})`);
            return;
        }
        if (msg.isUnroutable() && this._forwards.signalForwarded( /*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, /*nonce*/ msg.nonce)) {
            this._addresses.unroutable(channel, msg.senderId);
        }
        if (msg.recipientId === mySignalId) {
            if (this._rtcConnector.isValidSignal(msg) && (msg.isUnroutable() || msg.isTtlExceeded())) {
                this._addresses.unroutable(channel, msg.senderId);
            }
            this._rtcConnector.onSignal(channel, msg);
            return;
        }
        if (msg.ttl <= 0) {
            Log.w(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - TTL reached`);
            if (msg.flags === 0) {
                channel.signal( /*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flags.TTL_EXCEEDED);
            }
            return;
        }
        const signalChannel = this._addresses.getChannelBySignalId(msg.recipientId);
        if (!signalChannel) {
            Log.w(Network, `Failed to forward signal from ${msg.senderId} to ${msg.recipientId} - no route found`);
            if (msg.flags === 0) {
                channel.signal( /*senderId*/ msg.recipientId, /*recipientId*/ msg.senderId, msg.nonce, Network.SIGNAL_TTL_INITIAL, SignalMessage.Flags.UNROUTABLE);
            }
            return;
        }
        if (signalChannel.peerAddress.equals(channel.peerAddress)) {
            Log.e(Network, `Discarding signal from ${msg.senderId} to ${msg.recipientId} - shortest route via sending peer`);
            return;
        }
        signalChannel.signal(msg.senderId, msg.recipientId, msg.nonce, msg.ttl - 1, msg.flags, msg.payload);
        if (msg.flags === 0) {
            this._forwards.add(msg.senderId, msg.recipientId, msg.nonce);
        }
        Log.v(Network, `Forwarding signal (ttl=${msg.ttl}) from ${msg.senderId} ` +
            `(received from ${channel.peerAddress}) to ${msg.recipientId} ` +
            `(via ${signalChannel.peerAddress})`);
    }

    /** @type {Time} */
    get time() {
        return this._time;
    }

    /** @type {number} */
    get peerCount() {
        return this._addresses.peerCount;
    }

    /** @type {number} */
    get peerCountWebSocket() {
        return this._addresses.peerCountWs;
    }

    /** @type {number} */
    get peerCountWebRtc() {
        return this._addresses.peerCountRtc;
    }

    /** @type {number} */
    get peerCountDumb() {
        return this._addresses.peerCountDumb;
    }

    /** @type {number} */
    get bytesSent() {
        return this._bytesSent +
            this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesSent, 0);
    }

    /** @type {number} */
    get bytesReceived() {
        return this._bytesReceived +
            this._agents.values().reduce((n, agent) => n + agent.channel.connection.bytesReceived, 0);
    }
}
Network.PEER_COUNT_DESIRED = 6;
Network.PEER_COUNT_RELAY = 4;
Network.CONNECTING_COUNT_MAX = 2;
Network.SIGNAL_TTL_INITIAL = 3;
Network.ADDRESS_UPDATE_DELAY = 1000;
Class.register(Network);

class SignalStore {
    /**
     * @param {number} maxSize maximum number of entries
     */
    constructor(maxSize = 1000) {
        this._maxSize = maxSize;
        this._queue = new Queue();
        this._store = new HashMap();
    }

    get length() {
        return this._queue.length;
    }

    add(senderId, recipientId, nonce) {
        if (this.contains(senderId, recipientId, nonce)) {
            const signal = new ForwardedSignal(senderId, recipientId, nonce);
            this._store.put(signal, Date.now());
            this._queue.remove(signal);
            this._queue.enqueue(signal);
            return;
        }
        if (this.length >= this._maxSize) {
            const oldest = this._queue.dequeue();
            this._store.remove(oldest);
        }
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        this._queue.enqueue(signal);
        this._store.put(signal, Date.now());
    }

    contains(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        return this._store.contains(signal);
    }

    signalForwarded(senderId, recipientId, nonce) {
        const signal = new ForwardedSignal(senderId, recipientId, nonce);
        const lastSeen = this._store.get(signal);
        if (!lastSeen) {
            return false;
        }
        const valid = lastSeen + ForwardedSignal.SIGNAL_MAX_AGE > Date.now();
        if (!valid) {
            const toDelete = this._queue.dequeueUntil(signal);
            for (const dSignal of toDelete) {
                this._store.remove(dSignal);
            }
        }
        return valid;
    }
}
SignalStore.SIGNAL_MAX_AGE = 10;
Class.register(SignalStore);

class ForwardedSignal {
    constructor(senderId, recipientId, nonce) {
        this._senderId = senderId;
        this._recipientId = recipientId;
        this._nonce = nonce;
    }

    equals(o) {
        return o instanceof ForwardedSignal &&
            this._senderId === o._senderId &&
            this._recipientId === o._recipientId &&
            this._nonce === o._nonce;
    }

    hashCode() {
        return this.toString();
    }

    toString() {
        return `ForwardedSignal{senderId=${this._senderId}, recipientId=${this._recipientId}, nonce=${this._nonce}}`;
    }
}
Class.register(ForwardedSignal);
