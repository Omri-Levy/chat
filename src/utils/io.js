const {createAdapter} = require("@socket.io/redis-adapter");

class Io {

    constructor(io, storeClient, pubClient, subClient) {
        this.storeClient = storeClient;
        this.io = io;
        this.io.adapter(createAdapter(
            pubClient,
            subClient,
        ));
        this.io.of('/chat').use(this.handleSession.bind(this));
        this.io.of('/chat').on('connection', this.onConnection.bind(this));
        this.io.on('connection', async () => {
            const rooms = await this.storeClient.findRooms();

            this.io.emit("available-rooms", rooms);
        });
    }

    async onUsers(socket) {
        const users = await this.storeClient.findUsers(socket.room);

        this.io.of('/chat').to(socket.room).emit("users", users);
    }

    async onConnection(socket) {
        console.log('Client connected');

        const joinedMessage = `${socket.username} joined the room!`;
        const welcomeMessage = `Welcome to ${socket.room}, ${socket.username}!`;
        const messages = await this.storeClient.findMessages(socket.room);

        socket.join(socket.room);
        await this.updateSubsCount(socket.room);

        messages.forEach((message) => {
            this.io.to(socket.room).emit(...this.emitMessage(message));
        });

        this.onUsers(socket);
        socket.emit(
            ...this.emitMessage(this.generateSystemMessage(welcomeMessage))
        );
        socket.to(socket.room).emit(
            ...this.emitMessage(this.generateSystemMessage(joinedMessage))
        );
        socket.on('message', this.onMessage(socket).bind(this));
        socket.on('disconnect', this.onDisconnect(socket).bind(this));
    };

    getSubsCount(room) {
        return this.io.of('/chat').adapter.rooms.get(room)?.size ?? 0;
    }

    async handleSession(socket, next) {
        const room = socket.handshake.query.room;
        const username = socket.handshake.query.username;
        const user = await this.storeClient.findUser(room, username);

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

        await this.storeClient.saveUser(socket.room, {
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
            this.storeClient.saveMessage(socket.room, message);
        }
    }

    onDisconnect(socket) {
        return function() {
            console.log('Client disconnected');

            const leftMessage = `${socket.username} left the room!`

            this.io
                .of('/chat')
                .to(socket.room)
                .emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
            this.storeClient.deleteUser(socket.room, socket.username);
            this.onUsers(socket);
            this.updateSubsCount(socket.room);
        }
    }

    async updateSubsCount(room) {
            const subsCount = this.getSubsCount(room);
            await this.storeClient.saveRoom(room, subsCount);
            const rooms = await this.storeClient.findRooms();

            this.io.emit("available-rooms", rooms);
    }
}

module.exports = {
    Io,
}