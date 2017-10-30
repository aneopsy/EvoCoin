# EvoCoin

### Motivation
Cryptocurrencies and smart-contracts on top of a blockchain aren't the most trivial concepts to understand, things like wallets, addresses, block proof-of-work, transactions and their signatures, make more sense when they are in a broad context. This project is an attempt to provide as concise and simple an implementation of a cryptocurrency as possible.

### What is cryptocurrency
[From Wikipedia](https://en.wikipedia.org/wiki/Cryptocurrency) : A cryptocurrency (or crypto currency) is a digital asset designed to work as a medium of exchange using cryptography to secure the transactions and to control the creation of additional units of the currency.

### Key concepts of Evocoin
* Components
    * Web Client
    * Core
      * Network
      * Consensus
      * Accounts
      * Blockchain
      * Mempool
      * Wallet
      * Miner
* Js API interface to control everything
* Synchronization of blockchain and transactions
* Proof-Of-Work
* Data is persisted to a database

#### Components communication

```
              +-----------------+
              |                 |
              |   Web Client    |
              |                 |
              +--------+--------+
                       |
               +-------v-------+
               |               |
     +------+--+    Network    +---------+
     |      |  |               |         |
     |      |  +-------+-------+         |
     |      |          |                 |
+----v----+ |  +-------v------+    +-----v------+
|         | |  |              |    |            |
|  Miner  +---->  Blockchain  <----+ Consensus  |
|         | |  |              |    |            |
+---------+ |  +-------^------+    +------+-----+
            |          |                  |
            |     +----+-----+     +------v------+
            |     |          |     |             |
            +-----> Accounts +----->   Mempool   +
                  |          |     |             |
                  +-----+----+     +-------------+
                        |
                  +-----v----+
                  |          |
                  |  Wallet  |
                  |          |
                  +----------+
```
#### More information
* [API](API.md) How to use the API.
* [Blockchain](BLOCKCHAIN.md) How our Blockchain run.

### EvoCoin Demo

Check out our [Evo TestNet](http://aneopsy.xyz/client/index.html).

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes. See deployment for notes on how to deploy the project on a live system.

``` sh
# Get the project
$ git clone https://github.com/aneopsy/EvoCoin
```
### Prerequisites

* Node.js
* npm

### Quick start

```sh
#Run npm install
$ npm install
#Run npm run build
$ npm run build
#Open client/index.html in your browser to access the Browser Client.
$ chrome client/index.html
```

## Running the tests

Run some units tests
```
$ npm test
```
## Deployment
## Docker


A Dockerfile is provided which allows for creating your own backbone image using the following arguments.

| Argument  | Description |
| ------------- | ------------- |
| BRANCH  | Defaults to *master* but can be any available git branch  |
| PORT  | Defaults to TCP port *8080* |
| DOMAIN  | Domain to be used for hosting the backbone node  |
| KEY  | Path to an existing certificate key for the DOMAIN  |
| CRT  | Path to an existing signed certificate for the DOMAIN  |
| WALLET_SEED  | Pre-existing wallet private key  |

#### Building the Docker image using the above arguments
```
docker build \
  --build-arg DOMAIN=<DOMAIN> \
  --build-arg BRANCH=<BRANCH> \
  --build-arg WALLET_SEED=<WALLET_SEED> \
  --build-arg KEY=<KEY> \
  --build-arg CRT=<CRT> \
  --build-arg PORT=<PORT> \
  -t evo .
```

#### Running an instance of the image

`docker run -d -p 8080:8080 -v /etc/letsencrypt/:/etc/letsencrypt/ --name "evo" evo`

Note that you can override any of the arguments which were baked into the image at runtime with exception to the *BRANCH*. The -v flag here allows for mapping a local system path into the container for the purpose of using the existing *DOMAIN* certificates.

## Built With

* [Node.js](https://nodejs.org) - The JavaScript runtime
* [AngularJS](https://angularjs.org/) - The web framework used

## Versioning

We use [GitHub](http://https://github.com) for versioning. For the versions available, see the [tags on this repository](https://github.com/aneopsy/EvoCoin).

## Authors

* **Paul THEIS** - *Initial work* - [AneoPsy](https://github.com/aneopsy)
* **Alexandre BLANCHARD** - *Crypto work* - [--](https://github.com/aneopsy)
* **Carl DEBRAUWERE** - *Web Interface work* - [--](https://github.com/aneopsy)

See also the list of [contributors](https://github.com/aneopsy/EvoCoin/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
