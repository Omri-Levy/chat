const {createAdapter} = require("@socket.io/redis-adapter");
const {z} = require("zod");
const createDOMPurify = require('dompurify');
const {JSDOM} = require("jsdom");
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
const Filter = require("bad-words");
const marked = require("marked");
const emoji = require("node-emoji");

const zParse = async (schema, payload) => {
        const {error, data} = await schema.safeParseAsync(payload);

        if (error) {
            return {
                errors: error.issues.map(({path, message}) => message)
            }
        }

        return data;
}

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
        this.io.on('connection', async (socket) => {
                const {rooms, error} = await this.storeClient.findRooms();

                if (error) {
                    return socket.emit('error', error);
                }

                this.io.emit("available-rooms", rooms);
        });
    }

    async onUsers(socket) {
        const {users, error} = await this.storeClient.findUsers(socket.room);

        if (error) {
            return socket.emit('error', error);
        }

        this.io.of('/chat').to(socket.room).emit("users", users);
    }

    async onConnection(socket) {
        console.log('Client connected');

        const joinedMessage = `${socket.username} joined the room!`;
        const welcomeMessage = `Welcome to ${socket.room}, ${socket.username}!`;
        const {messages, error} = await this.storeClient.findMessages(socket.room);

        if (error) {
            return socket.emit('error', error);
        }

        socket.join(socket.room);
        const updateError = await this.updateSubsCount(socket.room);

        if (updateError) {
            return socket.emit('error', updateError);
        }

        messages.forEach((message) => {
            this.io.to(socket.room).emit(...this.emitMessage(message));
        });

        await this.onUsers(socket);
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
        const sanitized = {
            room: DOMPurify.sanitize(socket.handshake.query.room).trim(),
            username: DOMPurify.sanitize(socket.handshake.query.username).trim(),
        }
        const querySchema = z.object({
            room: z.string({
                required_error: "Room is required",
                invalid_type_error: "Room must be a string",
            }).min(
                1,
            `Room must contain at least 1 character(s)`
                )
                .max(
                    320,
                    `Room must contain at most 320 character(s)`
                ),
            username: z.string({
                required_error: "Username is required",
                invalid_type_error: "Username must be a string",
            })
                .min(
                    1,
                    `Username must contain at least 1 character(s)`
                )
                .max(
                    70,
                    `Username must contain at most 70 character(s)`
                ),
        });


            const {errors, room, username} = await zParse(querySchema, sanitized);

            if (errors) {
                const err = new Error('Validation Error')

                err.data = errors;

                return next(err);
            }

            const {user, error: findUserError} = await this.storeClient.findUser(room, username);

            if (findUserError) {
                return next(new Error(findUserError));
            }

            if (user) {
                socket.room = user.room;
                socket.username = user.username;

                return next();
            }

            socket.room = room;
            socket.username = username;

            const {error: saveUserError} = await this.storeClient.saveUser(socket.room, {
                room: socket.room,
                username: socket.username,
            });

            if (saveUserError) {
                return next(new Error(saveUserError));
            }

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
        return async function(body, cb) {
            const filter = new Filter();
            const sanitized = DOMPurify.sanitize(body.trim());
            const markdown = marked.parse(sanitized);
            const profanity = filter.clean(markdown);
            const emojifi = emoji.emojify(profanity);
            const message = {
                from: socket.username,
                body: emojifi
                    .replace(/\n/g, '<br/>'),
                timestamp: new Date(),
            }
            const {error} = await this.storeClient.saveMessage(socket.room, message);

            if (error) {
                return cb(error);
            }

            this.io
                .of('/chat')
                .to(socket.room)
                .emit('message', message);

            cb();
        }
    }

    onDisconnect(socket) {
        return async function() {
            console.log('Client disconnected');

            const leftMessage = `${socket.username} left the room!`

            this.io
                .of('/chat')
                .to(socket.room)
                .emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
            const {error} = await this.storeClient.deleteUser(socket.room, socket.username);

            if (error) {
                console.error(error);

                return;
            }

            this.onUsers(socket);
            const updateError = await this.updateSubsCount(socket.room);

            if (updateError) {
                console.error(error);
            }
        }
    }

    async updateSubsCount(room) {
            const subsCount = this.getSubsCount(room);
            const {error: saveRoomError} = await this.storeClient.saveRoom(room, subsCount);
            const {rooms, error: findRoomsError} = await this.storeClient.findRooms();
            const error = saveRoomError || findRoomsError;

            if (error) {
                return error;
            }

            this.io.emit("available-rooms", rooms);
    }
}

module.exports = {
    Io,
}