require('dotenv/config');
const {pubClient, subClient} = require("./libs/redis");
const {StoreClient} = require("./utils/store-client");
const storeClient = new StoreClient(pubClient);
const socketIo = require('socket.io');
const http = require('http');
const {app} = require("./app");
const server = http.createServer(app);
const io = socketIo(server);
const {Io} = require("./utils/io");

new Io(io, storeClient, pubClient, subClient);

server.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}`);
});
