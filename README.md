# Evocoin

### Motivation
Cryptocurrencies and smart-contracts on top of a blockchain aren't the most trivial concepts to understand, things like wallets, addresses, block proof-of-work, transactions and their signatures, make more sense when they are in a broad context. This project is an attempt to provide as concise and simple an implementation of a cryptocurrency as possible.

### What is cryptocurrency
[From Wikipedia](https://en.wikipedia.org/wiki/Cryptocurrency) : A cryptocurrency (or crypto currency) is a digital asset designed to work as a medium of exchange using cryptography to secure the transactions and to control the creation of additional units of the currency.

### Key concepts of Evocoin
* Components
    * HTTP Server
    * JSON-RPC Server
    * Node
    * Blockchain
    * Operator
    * Miner
* HTTP API interface to control everything
* JSON-RPC interface to control everything
* Synchronization of blockchain and transactions
* Simple proof-of-work (The difficulty increases every 5 blocks)
* Addresses creation using a deterministic approach [EdDSA](https://en.wikipedia.org/wiki/EdDSA)
* Data is persisted to a folder

#### Components communication

```
              +-----------------+
              |                 |
     +--------+ JSON-RPC Server +--------+
     |        |                 |        |
     |        +-----------------+        |
     |         +---------------+         |
     |         |               |         |
     +------+--+  HTTP Server  +---------+
     |      |  |               |         |
     |      |  +-------+-------+         |
     |      |          |                 |
+----v----+ |  +-------v------+    +-----v------+
|         | |  |              |    |            |
|  Miner  +---->  Blockchain  <----+  Operator  |
|         | |  |              |    |            |
+---------+ |  +-------^------+    +------------+
            |          |
            |     +----+---+
            |     |        |
            +----->  Node  |
                  |        |
                  +--------+
```
#### More information
* [Protocol](PROTOCOL.md) How to use the API.
* [Blockchain](BLOCKCHAIN.md) How our Blockchain run.

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

### Prerequisites

* Node.js
* npm

### Installing

A step by step series of examples that tell you have to get a development env running

First step, install all dependencies, use:

``` sh
# Run npm to install all module
$ npm install
```

### Quick start

```sh
# Run a node
$ node bin/evocoin.js

# Run two nodes
$ node bin/evocoin.js -p 3001 --name 1
$ node bin/evocoin.js -p 3002 --name 2 --peers http://localhost:3001

# Access the swagger API
http://localhost:3001/api-docs/
```

## Running the tests

Run some units tests
```
$ npm test
```
## Deployment
#### Docker

```sh
# Build the image
$ docker build . -t evocoin

# Run naivecoin in a docker
$ ./dockerExec.sh

# Run naivecoin in a docker using port 3002
$ ./dockerExec.sh -p 3002

# Run naivecoin in a docker options
$ ./dockerExec.sh -h
Usage: ./dockerExec.sh -a HOST -p PORT -l LOG_LEVEL -e PEERS -n NAME

# Run docker-compose with 3 nodes
$ docker-compose up
```

## Built With

* [Node.js](https://nodejs.org) - The JavaScript runtime
* [AngularJS](https://angularjs.org/)) - The web framework used

## Versioning

We use [GitHub](http://https://github.com) for versioning. For the versions available, see the [tags on this repository](https://github.com/your/project/tags).

## Authors

* **Paul THEIS** - *Initial work* - [AneoPsy](https://github.com/aneopsy)
* **Alexandre BLANCHARD** - *Crypto work* - [--](https://github.com/aneopsy)
* **Carl DEBRAUWERE** - *Web Interface work* - [--](https://github.com/aneopsy)

See also the list of [contributors](https://github.com/aneopsy/AneoChain/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
