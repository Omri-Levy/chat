"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const redis_1 = require("./libs/redis");
const store_client_1 = require("./utils/store-client");
const socket_io_1 = require("socket.io");
const http_1 = __importDefault(require("http"));
const app_1 = require("./app");
const io_1 = require("./utils/io");
const storeClient = new store_client_1.StoreClient(redis_1.pubClient);
const server = http_1.default.createServer(app_1.app);
const io = new socket_io_1.Server(server);
new io_1.Io(io, storeClient, redis_1.pubClient, redis_1.subClient);
server.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}`);
});
