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
        this.io.on('connection', this.onConnection.bind(this))
    }

    async onConnection(socket) {
        console.log('Client connected');

        this.socket = socket;
        const joinedMessage = `${this.socket.username} joined the room!`;
        const welcomeMessage = `Welcome to ${this.socket.room}, ${this.socket.username}!`;
        const messages = await this.redisStore.findMessages(this.socket.room);
        const users = await this.redisStore.findUsers(this.socket.room);

        this.socket.join(this.socket.room);

        messages.forEach((message) => {
            this.io.to(this.socket.room).emit(...this.emitMessage(message));
        });

        this.socket.emit("users", users);
        this.socket.emit(
            ...this.emitMessage(this.generateSystemMessage(welcomeMessage))
        );
        this.socket.to(this.socket.room).emit(
            ...this.emitMessage(this.generateSystemMessage(joinedMessage))
        );
        this.socket.on('message', this.onMessage.bind(this));
        this.socket.on('disconnect', this.onDisconnect.bind(this));
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

    onMessage(message) {
        this.socket.to(this.socket.room).emit('message', message);
        this.redisStore.saveMessage(this.socket.room, message);
    }

    async onDisconnect() {
        console.log('Client disconnected');

        const leftMessage = `${this.socket.username} left the room!`

        this.io.to(this.socket.room).emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
        this.redisStore.deleteUser(this.socket.room, this.socket.username);
    };

}

module.exports = {
    Io,
}