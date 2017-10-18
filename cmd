curl -H "Content-type:application/json" --data '{"peer" : "ws://localhost:6001"}' http://localhost:3001/addPeer
curl -H "Content-type:application/json" --data '{"data" : " { amout : 1 }"}' http://localhost:3001/mineBlock

curl http://localhost:3001/blocks
curl http://localhost:3001/peers