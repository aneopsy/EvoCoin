#### Blockchain

The blockchain holds two pieces of information, the block list (a linked list), and the transaction list (a hash map).

It's responsible for:
* Verification of arriving blocks;
* Verification of arriving transactions;
* Synchronization of the transaction list;
* Synchronization of the block list;

The blockchain is a linked list where the hash of the next block is calculated based on the hash of the previous block plus the data inside the block itself:
```
+-----------+                +-----------+                +-----------+
|           |  previousHash  |           |  previousHash  |           |
|  Block 0  <----------------+  Block 1  <----------------+  Block N  |
|           |                |           |                |           |
+-----------+                +-----------+                +-----------+
```

A block is added to the block list:
1. If the block is the last one (previous index + 1);
2. If previous block is correct (previous hash == block.previousHash);
3. The hash is correct (calculated block hash == block.hash);
4. The difficulty level of the proof-of-work challenge is correct (difficulty at blockchain index _n_ < block difficulty);
5. All transactions inside the block are valid;
6. The sum of output transactions are equal the sum of input transactions + 50 coins representing the reward for the block miner;
7. If there is only 1 fee transaction and 1 reward transaction.

A transaction inside a block is valid:
1. If the transaction hash is correct (calculated transaction hash == transaction.hash);
2. The signature of all input transactions are correct (transaction data is signed by the public key of the address);
3. The sum of input transactions are greater than output transactions, it needs to leave some room for the transaction fee;
4. If the transaction isn't already in the blockchain
5. If all input transactions are unspent in the blockchain.

You can read this [post](https://medium.com/@lhartikk/a-blockchain-in-200-lines-of-code-963cc1cc0e54#.dttbm9afr5) from [naivechain](https://github.com/lhartikk/naivechain) for more details about how the blockchain works.

Transactions is a list of pending transactions. Nothing special about it. In this implementation, the list of transactions contains only the pending transactions. As soon as a transaction is confirmed, the blockchain removes it from this list.

```
[
    transaction 1,
    transaction 2,
    transaction 3
]
```

A transaction is added to the transaction list:
1. If it's not already in the transaction list;
2. If the transaction hash is correct (calculated transaction hash == transaction.hash);
3. The signature of all input transactions are correct (transaction data is signed by the public key of the address);
4. The sum of input transactions are greater than output transactions, it needs to leave some room for the transaction fee;
5. If the transaction isn't already in the blockchain
6. If all input transactions are unspent in the blockchain;

##### Block structure

A block represents a group of transactions and contains information that links it to the previous block.

```javascript
{ // Block
    "index": 0, // (first block: 0)
    "previousHash": "0", // (hash of previous block, first block is 0) (64 bytes)
    "timestamp": 1465154705, // number of seconds since January 1, 1970
    "nonce": 0, // nonce used to identify the proof-of-work step.
    "transactions": [ // list of transactions inside the block
        { // transaction 0
            "id": "63ec3ac02f...8d5ebc6dba", // random id (64 bytes)
            "hash": "563b8aa350...3eecfbd26b", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
            "type": "regular", // transaction type (regular, fee, reward)
            "data": {
                "inputs": [], // list of input transactions
                "outputs": [] // list of output transactions
            }
        }
    ],
    "hash": "c4e0b8df46...199754d1ed" // hash taken from the contents of the block: sha256 (index + previousHash + timestamp + nonce + transactions) (64 bytes)
}
```

The details about the nonce and the proof-of-work algorithm used to generate the block will be described somewhere ahead.

##### Transaction structure

A transaction contains a list of inputs and outputs representing a transfer of coins between the coin owner and an address. The input list contains a list of existing unspent output transactions and it is signed by the address owner. The output list contains amounts to other addresses, including or not a change to the owner address.

```javascript
{ // Transaction
    "id": "84286bba8d...7477efdae1", // random id (64 bytes)
    "hash": "f697d4ae63...c1e85f0ac3", // hash taken from the contents of the transaction: sha256 (id + data) (64 bytes)
    "type": "regular", // transaction type (regular, fee, reward)
    "data": {
        "inputs": [ // Transaction inputs
            {
                "transaction": "9e765ad30c...e908b32f0c", // transaction hash taken from a previous unspent transaction output (64 bytes)
                "index": "0", // index of the transaction taken from a previous unspent transaction output
                "amount": 5000000000, // amount of satoshis
                "address": "dda3ce5aa5...b409bf3fdc", // from address (64 bytes)
                "signature": "27d911cac0...6486adbf05" // transaction input hash: sha256 (transaction + index + amount + address) signed with owner address's secret key (128 bytes)
            }
        ],
        "outputs": [ // Transaction outputs
            {
                "amount": 10000, // amount of satoshis
                "address": "4f8293356d...b53e8c5b25" // to address (64 bytes)
            },
            {
                "amount": 4999989999, // amount of satoshis
                "address": "dda3ce5aa5...b409bf3fdc" // change address (64 bytes)
            }
        ]
    }
}
```

#### Operator

The operator handles wallets and addresses as well the transaction creation. Most of its operation are CRUD related. Each operator has its list of wallets and addresses, meaning that they aren't synchronized between nodes.

##### Wallet structure

A wallet contains a random id number, the password hash and the secret generated from that password. It contains a list of key pairs each one representing an address.

```javascript
[
    { // Wallet
        "id": "884d3e0407...f29af094fd", // random id (64 bytes)
        "passwordHash": "5ba9151d1c...1424be8e2c", // hash taken from password: sha256 (password) (64 bytes)
        "secret": "6acb83e364...c1a04b6ee6", // pbkdf2 secret taken from password hash: sha512 (salt + passwordHash + random factor)
        "keyPairs": [
            {
                "index": 1,
                "secretKey": "6acb83e364...ee6bcdbc73", // EdDSA secret key generated from the secret (1024 bytes)
                "publicKey": "dda3ce5aa5...b409bf3fdc" // EdDSA public key generated from the secret (64 bytes) (also known as address)
            },
            {
                "index": 2,
                "secretKey": "072ab010ed...246ed16d26", // EdDSA secret key generated from pbkdf2 (sha512 (salt + passwordHash + random factor)) over last address secret key (1024 bytes)
                "publicKey": "4f8293356d...b53e8c5b25"  // EdDSA public key generated from the secret (64 bytes) (also known as address)
            }     
        ]
    }
]
```

##### Address structure

The address is created in a deterministic way, meaning that for a given password, the next address is created based on the previous address (or the password secret if it's the first address).

It uses the EdDSA algorithm to generate a secret public key pair using a seed that can come from a random generated value from the password hash (also in a deterministic way) or from the last secret key.

```javascript
{ // Address
    "index": 1,
    "secretKey": "6acb83e364...ee6bcdbc73", // EdDSA secret key generated from the secret (1024 bytes)
    "publicKey": "dda3ce5aa5...b409bf3fdc" // EdDSA public key generated from the secret (64 bytes) (also known as address)
},
```

Only the public key is exposed as the user's address.

#### Miner

The Miner gets the list of pending transactions and creates a new block containing the transactions. By configuration, every block has at most 2 transactions in it.

Assembling a new block:
1. Get the last two transactions from the list of pending transactions;
2. Add a new transaction containing the fee value to the miner's address, 1 satoshi per transaction;
3. Add a reward transaction containing 50 coins to the miner's address;
4. Prove work for this block;

##### Proof-of-work

The proof-of-work is done by calculating the 14 first hex values for a given transaction hash and increases the nonce until it reaches the minimal difficulty level required. The difficulty increases by an exponential value (power of 5) every 5 blocks created. Around the 70th block created it starts to spend around 50 seconds to generate a new block with this configuration. All these values can be tweaked.

```javascript
const difficulty = this.blockchain.getDifficulty();
do {
    block.timestamp = new Date().getTime() / 1000;
    block.nonce++;
    block.hash = block.toHash();
    blockDifficulty = block.getDifficulty();
} while (blockDifficulty >= difficulty);
```

The `this.blockchain.getDifficulty()` returns the hex value of the current blockchain's index difficulty. This value is calculated by powering the initial difficulty by 5 every 5 blocks.

The `block.getDifficulty()` returns the hex value of the first 14 bytes of block's hash and compares it to the currently accepted difficulty.

When the hash generated reaches the desired difficulty level, it returns the block as it is.

#### Node

The node contains a list of connected peers and does all the data exchange between nodes, including:
1. Receive new peers and check what to do with it
1. Receive new blocks and check what to do with it
2. Receive new transactions and check what to do with it

The node rebroadcasts every information it receives unless it doesn't do anything with it, for example, if it already has the peer/transaction/blockchain.

An extra responsibility is to get a number of confirmations for a given transaction. It does that by asking every node if it has that transaction in its blockchain.
