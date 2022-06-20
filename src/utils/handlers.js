const {redisStore} = require("./redis-store");
const onDisconnect = (io, socket) => async () => {
    console.log('Client disconnected');

    const leftMessage = `${socket.username} left the room!`

    io.to(socket.room).emit(...emitMessage(generateSystemMessage(leftMessage)));
    redisStore.deleteUser(socket.room, socket.username);
};

const onMessage = (socket) => (message) => {
    socket.to(socket.room).emit('message', message);
    redisStore.saveMessage(socket.room, message);
}

const generateMessage = ({from, body}) => ({
    from,
    body,
    timestamp: new Date(),
});

const generateSystemMessage = (body) => generateMessage({
    from: 'System',
    body,
});

const emitMessage = (message) => {
    return [
        'message',
        message,
    ]
}


const handleSession = async (socket, next) => {
    const room = socket.handshake.query.room;
    const username = socket.handshake.query.username;
    const user = await redisStore.findUser(room, username);

    if (user) {
        socket.room = user.room;
        socket.username = user.username;

        return next();
    }

    if (!room || !username) {
        return next(new Error({
            from: 'System',
            body: `Invalid ${!room ? 'room' : 'username'}`,
            timestamp: new Date(),
        }));
    }

    socket.room = room;
    socket.username = username;

    await redisStore.saveUser(socket.room, {
        room: socket.room,
        username: socket.username,
    });

    next();
};

const onConnection = (io) => async (socket) => {
    console.log('Client connected');

    const joinedMessage = `${socket.username} joined the room!`;
    const welcomeMessage = `Welcome to ${socket.room}, ${socket.username}!`;
    const messages = await redisStore.findMessages(socket.room);
    const users = await redisStore.findUsers(socket.room);

    socket.join(socket.room);

    messages.forEach((message) => {
        io.to(socket.room).emit(...emitMessage(message));
    });

    socket.emit("users", users);
    socket.emit(
        ...emitMessage(generateSystemMessage(welcomeMessage))
    );
    socket.to(socket.room).emit(
        ...emitMessage(generateSystemMessage(joinedMessage))
    );
    socket.on('message', onMessage(socket));
    socket.on('disconnect', onDisconnect(io, socket));
};

module.exports = {
    handleSession,
    onConnection,
}