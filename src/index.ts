import 'dotenv/config';
import { pubClient, subClient } from './libs/redis';
import { StoreClient } from './utils/store-client';
import { Server } from 'socket.io';
import http from 'http';
import { app } from './app';
import { Io } from './utils/io';

const storeClient = new StoreClient(pubClient);
const server = http.createServer(app);
const io = new Server(server);

new Io(io, storeClient, pubClient, subClient);

server.listen(process.env.PORT, () => {
	console.log(`Listening on ${process.env.PORT}`);
});
