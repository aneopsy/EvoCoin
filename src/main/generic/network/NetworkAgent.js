class NetworkAgent extends Observable {
    constructor(blockchain, addresses, channel) {
        super();
        this._blockchain = blockchain;
        this._addresses = addresses;
        this._channel = channel;
        this._peer = null;
        this._knownAddresses = new HashSet();
        this._timers = new Timers();
        this._versionReceived = false;
        this._versionSent = false;
        this._versionAttempts = 0;
        channel.on('version', msg => this._onVersion(msg));
        channel.on('verack', msg => this._onVerAck(msg));
        channel.on('addr', msg => this._onAddr(msg));
        channel.on('getaddr', msg => this._onGetAddr(msg));
        channel.on('ping', msg => this._onPing(msg));
        channel.on('pong', msg => this._onPong(msg));
        channel.on('close', closedByRemote => this._onClose(closedByRemote));
    }

    relayAddresses(addresses) {
        if (!this._versionReceived || !this._versionSent) {
            return;
        }
        const filteredAddresses = addresses.filter(addr => {
            if (addr.protocol === Protocol.RTC && addr.distance >= PeerAddresses.MAX_DISTANCE) {
                return false;
            }
            if (addr.protocol === Protocol.DUMB) {
                return false;
            }
            const knownAddress = this._knownAddresses.get(addr);
            return !addr.isSeed() &&
                (!knownAddress || knownAddress.timestamp < Date.now() - NetworkAgent.RELAY_THROTTLE);
        });

        if (filteredAddresses.length) {
            this._channel.addr(filteredAddresses);
            for (const address of filteredAddresses) {
                this._knownAddresses.add(address);
            }
        }
    }

    handshake() {
        if (!this._channel.version(NetworkConfig.myPeerAddress(), this._blockchain.height, this._blockchain.totalWork)) {
            this._versionAttempts++;
            if (this._versionAttempts >= NetworkAgent.VERSION_ATTEMPTS_MAX) {
                this._channel.close('sending of version message failed');
                return;
            }

            setTimeout(this.handshake.bind(this), NetworkAgent.VERSION_RETRY_DELAY);
            return;
        }

        this._versionSent = true;

        if (!this._versionReceived) {
            this._timers.setTimeout('version', () => {
                this._timers.clearTimeout('version');
                this._channel.close('version timeout');
            }, NetworkAgent.HANDSHAKE_TIMEOUT);
        } else {
            this._finishHandshake();
        }
    }

    _onVersion(msg) {
        if (!this._canAcceptMessage(msg)) {
            return;
        }
        this._timers.clearTimeout('version');
        if (!Version.isCompatible(msg.version)) {
            this._channel.close(`incompatible version (ours=${Version.CODE}, theirs=${msg.version})`);
            return;
        }
        if (!Block.GENESIS.HASH.equals(msg.genesisHash)) {
            this._channel.close(`different genesis block (${msg.genesisHash})`);
            return;
        }
        if (this._channel.peerAddress) {
            if (!this._channel.peerAddress.equals(msg.peerAddress)) {
                this._channel.close('unexpected peerAddress in version message');
                return;
            }
        }
        const peerAddress = msg.peerAddress;
        if (!peerAddress.netAddress) {
            const storedAddress = this._addresses.get(peerAddress);
            if (storedAddress && storedAddress.netAddress) {
                peerAddress.netAddress = storedAddress.netAddress;
            }
        }
        this._channel.peerAddress = peerAddress;
        this._peer = new Peer(
            this._channel,
            msg.version,
            msg.startHeight,
            msg.totalWork
        );
        this._knownAddresses.add(peerAddress);
        this._versionReceived = true;
        if (this._versionSent) {
            this._finishHandshake();
        }
    }

    _finishHandshake() {
        this._timers.setInterval('connectivity',
            () => this._checkConnectivity(),
            NetworkAgent.CONNECTIVITY_CHECK_INTERVAL);
        this._timers.setInterval('announce-addr',
            () => this._channel.addr([NetworkConfig.myPeerAddress()]),
            NetworkAgent.ANNOUNCE_ADDR_INTERVAL);
        this.fire('handshake', this._peer, this);
        this._requestAddresses();
    }

    _requestAddresses() {
        this._channel.getaddr(NetworkConfig.myProtocolMask(), Services.myServiceMask());
    }

    async _onAddr(msg) {
        if (!this._canAcceptMessage(msg)) {
            return;
        }
        if (msg.addresses.length > 1000) {
            Log.w(NetworkAgent, 'Rejecting addr message - too many addresses');
            this._channel.ban('addr message too large');
            return;
        }
        for (const addr of msg.addresses) {
            this._knownAddresses.add(addr);
        }
        await this._addresses.add(this._channel, msg.addresses);
        this.fire('addr', msg.addresses, this);
    }

    _onGetAddr(msg) {
        if (!this._canAcceptMessage(msg)) {
            return;
        }
        const addresses = this._addresses.query(msg.protocolMask, msg.serviceMask);
        const filteredAddresses = addresses.filter(addr => {
            if (addr.protocol === Protocol.RTC && addr.distance >= PeerAddresses.MAX_DISTANCE) {
                return false;
            }
            const knownAddress = this._knownAddresses.get(addr);
            return !knownAddress || knownAddress.timestamp < Date.now() - NetworkAgent.RELAY_THROTTLE;
        });
        if (filteredAddresses.length) {
            this._channel.addr(filteredAddresses);
        }
    }


    _checkConnectivity() {
        const nonce = NumberUtils.randomUint32();
        if (!this._channel.ping(nonce)) {
            this._channel.close('sending ping message failed');
            return;
        }
        this._timers.setTimeout(`ping_${nonce}`, () => {
            this._timers.clearTimeout(`ping_${nonce}`);
            this._channel.close('ping timeout');
        }, NetworkAgent.PING_TIMEOUT);
    }

    _onPing(msg) {
        if (!this._canAcceptMessage(msg)) {
            return;
        }
        this._channel.pong(msg.nonce);
    }

    _onPong(msg) {
        this._timers.clearTimeout(`ping_${msg.nonce}`);
    }

    _onClose(closedByRemote) {
        this._timers.clearAll();
        this.fire('close', this._peer, this._channel, closedByRemote, this);
    }

    _canAcceptMessage(msg) {
        if (!this._versionReceived && msg.type !== Message.Type.VERSION) {
            Log.w(NetworkAgent, `Discarding ${msg.type} message from ${this._channel}` +
                ' - no version message received previously');
            return false;
        }
        return true;
    }

    get channel() {
        return this._channel;
    }

    get peer() {
        return this._peer;
    }
}
NetworkAgent.HANDSHAKE_TIMEOUT = 1000 * 3;
NetworkAgent.PING_TIMEOUT = 1000 * 10;
NetworkAgent.CONNECTIVITY_CHECK_INTERVAL = 1000 * 60;
NetworkAgent.ANNOUNCE_ADDR_INTERVAL = 1000 * 60 * 10;
NetworkAgent.RELAY_THROTTLE = 1000 * 60 * 5;
NetworkAgent.VERSION_ATTEMPTS_MAX = 10;
NetworkAgent.VERSION_RETRY_DELAY = 500;
Class.register(NetworkAgent);
