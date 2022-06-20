const socketIo = require('socket.io');
const {createAdapter} = require("@socket.io/redis-adapter");
const {redisClient, subClient} = require("./redis");
const {handleSession, onConnection} = require("../utils/handlers");
const {server} = require("../server");
const io = socketIo(server);

io.adapter(createAdapter(
    redisClient,
    subClient,
));
io.use(handleSession)
io.on('connection', onConnection(io));
