const {createAdapter} = require("@socket.io/redis-adapter");

class Io {
    constructor(io, redisStore, pubClient, subClient) {
        this.redisStore = redisStore;
        this.io = io;
        this.io.adapter(createAdapter(
            pubClient,
            subClient,
        ));
        this.io.use(this.handleSession.bind(this));
        this.io.on('connection', this.onConnection.bind(this));
    }

    async onConnection(socket) {
        console.log('Client connected');

        const joinedMessage = `${socket.username} joined the room!`;
        const welcomeMessage = `Welcome to ${socket.room}, ${socket.username}!`;
        const messages = await this.redisStore.findMessages(socket.room);
        const users = await this.redisStore.findUsers(socket.room);

        socket.join(socket.room);

        messages.forEach((message) => {
            this.io.to(socket.room).emit(...this.emitMessage(message));
        });

        socket.emit("users", users);
        socket.emit(
            ...this.emitMessage(this.generateSystemMessage(welcomeMessage))
        );
        socket.to(socket.room).emit(
            ...this.emitMessage(this.generateSystemMessage(joinedMessage))
        );
        socket.on('message', this.onMessage(socket).bind(this));
        socket.on('disconnect', this.onDisconnect(socket).bind(this));
    };

    async handleSession(socket, next) {
        const room = socket.handshake.query.room;
        const username = socket.handshake.query.username;
        const user = await this.redisStore.findUser(room, username);

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

        await this.redisStore.saveUser(socket.room, {
            room: socket.room,
            username: socket.username,
        });

        next();
    };

    emitMessage(message) {
        return [
            'message',
            message,
        ]
    }

    generateMessage({from, body}) {
        return {
            from,
            body,
            timestamp: new Date(),
        };
    }

    generateSystemMessage(body) {
        return this.generateMessage({
            from: 'System',
            body,
        });
    }

    onMessage(socket) {
        return function(message) {
            socket
                .to(socket.room)
                .emit('message', message);
            this.redisStore.saveMessage(socket.room, message);
        }
    }

    onDisconnect(socket) {
        return function() {
            console.log('Client disconnected');

            const leftMessage = `${socket.username} left the room!`

            this.io
                .to(socket.room)
                .emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
            this.redisStore.deleteUser(socket.room, socket.username);
        }
    }

}

module.exports = {
    Io,
}