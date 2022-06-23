const {createAdapter} = require("@socket.io/redis-adapter");
const createDOMPurify = require('dompurify');
const {JSDOM} = require("jsdom");
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);
const Filter = require("bad-words");
const marked = require("marked");
const emoji = require("node-emoji");
const styles = require("@dicebear/open-peeps");
const {createAvatar} = require("@dicebear/avatars");
const {querySchema, roomSchema} = require("../validation");

const aliasEmoji = (str, ...args) => {
    let string = str;

    args.forEach(([pattern, alias]) => {
        string = string.replaceAll(pattern, `:${alias}:`);
    })

    return emoji.emojify(string);
}

const zParse = async (schema, payload) => {
        const {data, error} = await schema.safeParseAsync(payload);
        const errors = error ? error.issues.map(({path, message}) => message) : undefined;

        return [data, errors];
}

class Io {

    systemAvatar = createAvatar(styles, {
        seed: `System`,
        head: [`noHair3`],
        face: [`old`],
        accessories: [`glasses2`],
        accessoriesProbability: 100,
        facialHair: [`moustache9`],
        facialHairProbability: 100,
        skinColor: [`variant01`],
        clothingColor: [`tail01`],
    });

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
                const [rooms, error] = await this.storeClient.findRooms();

                if (error) {
                    return socket.emit('error', {
                        message: error.message,
                    });
                }

                this.io.emit("available-rooms", rooms);

                socket.on('create', this.onCreateRoom.bind(this));
        });
    }

    async onCreateRoom(room, cb) {
            const [, errors] = await zParse(roomSchema.schema, room);

            if (errors) {

                return cb({
                    message: 'Validation Error',
                    data: errors,
                });
            }

            const [roomExists] = await this.storeClient.findRoom(room);

            if (roomExists) {
                return cb({
                    message: roomSchema.alreadyExists(room),
                });
            }

            const [,createRoomError] = await this.storeClient.createRoom(room, 0);

            if (createRoomError) {
                return cb({
                    message: createRoomError.message,
                });
            }

            const [rooms, findRoomsError] = await this.storeClient.findRooms();

            if (findRoomsError) {
                return cb({
                    message: findRoomsError.message,
                });
            }

            this.io.emit("available-rooms", rooms);

            cb();
    }

    async onUsers(socket) {
        const [users, error] = await this.storeClient.findUsers(socket.room);

        if (error) {
            return socket.emit('error', {
                message: error.message,
            });
        }

        this.io.of('/chat').to(socket.room).emit("users", users);
    }

    async sendMessagesHistory(socket) {
        const [messages, error] = await this.storeClient.findMessages(socket.room);

        if (error) {
            return socket.emit('error', {
                message: error.message,
            });
        }

        messages.forEach((message) => {
            this.io.of('/chat').to(socket.room).emit(...this.emitMessage(message));
        });
    }

    async onJoinRoom(socket) {
            const [roomExists, findRoomError] = await this.storeClient.findRoom(socket.room);

            if (!roomExists) {
                const err = new Error(roomSchema.doesNotExist(socket.room));

                return socket.emit('error', {
                    message: err.message,
                });
            }


            if (findRoomError) {
                return socket.emit('error', {
                    message: findRoomError.message,
                });
            }

            const joinedMessage = `${socket.username} joined the room!`;
            const welcomeMessage = `Welcome to ${socket.room}, ${socket.username}!`;


            socket.join(socket.room);
            const [updateError] = await this.updateSubsCount(socket.room);

            if (updateError) {
                return socket.emit('error', {
                    message: updateError.message,
                });
            }

            await this.onUsers(socket);

            await this.sendMessagesHistory(socket);

            socket.emit(
                ...this.emitMessage(this.generateSystemMessage(welcomeMessage))
            );
            socket.to(socket.room).emit(
                ...this.emitMessage(this.generateSystemMessage(joinedMessage))
            );
    }

    async onConnection(socket) {
        console.log('Client connected');

        await this.onJoinRoom(socket);
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

            const [{room, username}, errors] = await zParse(querySchema, sanitized);

            if (errors) {
                const err = new Error('Validation Error')

                err.data = errors;

                return next(err);
            }

            const [user, findUserError] = await this.storeClient.findUser(room, username);

            if (findUserError) {
                return next(findUserError);
            }

            if (user) {
                socket.room = user.room;
                socket.username = user.username;
                socket.avatar = user.avatar;

                return next();
            }

            socket.room = room;
            socket.username = username;
            socket.avatar = createAvatar(styles, {
                seed: username + room,
            });

            const [, createUserError] = await this.storeClient.createUser(socket.room, {
                room: socket.room,
                username: socket.username,
                avatar: socket.avatar,
            });

            if (createUserError) {
                return next(createUserError);
            }

            next();
    };

    emitMessage(message) {
        return [
            'message',
            message,
        ]
    }

    generateMessage({avatar, from, body}) {
        return {
            avatar,
            from,
            body,
            timestamp: new Date(),
        };
    }

    generateSystemMessage(body) {
        return this.generateMessage({
            from: 'System',
            body,
            avatar: this.systemAvatar,
        });
    }

    onMessage(socket) {
        return async function(msg, cb) {
            const filter = new Filter();
            const sanitized = DOMPurify.sanitize(msg.trim());
            const renderer = new marked.Renderer();
            renderer.link = (href, title, text) => {
                return `<a  href="${href}" title="${title}" target="_blank">${text}</a>`;
            }
            const markdown = marked.parse(sanitized, { renderer });
            const profanity = filter.clean(markdown);
            const emojis = [
                [':)', 'smile'],
                [':D', 'smile'],
                [':(', 'frowning'],
                ['D:', 'frowning'],
                [';(', 'cry'],
                ['D;', 'cry'],
                [';)', 'wink'],
                [':|', 'neutral_face'],
                [':-)', 'grin'],
                [':-(', 'disappointed'],
                [':-|', 'expressionless'],
                [':o', 'open_mouth'],
                [':0', 'open_mouth'],
                [':O', 'open_mouth'],
                [':-o', 'open_mouth'],
                [':-0', 'open_mouth'],
                [':P', 'stuck_out_tongue'],
                [':p', 'stuck_out_tongue'],
                [':-P', 'stuck_out_tongue'],
                [':-p', 'stuck_out_tongue'],
            ];
            const body = aliasEmoji(
                profanity,
                ...emojis,
            ).replace(/\n/g, '<br/>');
            const message = {
                avatar: socket.avatar,
                from: socket.username,
                body,
                timestamp: new Date(),
            }
            const [,error] = await this.storeClient.createMessage(socket.room, message);

            if (error) {
                return cb({
                    message: error.message,
                });
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
            const [roomExists] = await this.storeClient.findRoom(socket.room);

            if (!roomExists) {
                return;
            }

            console.log('Client disconnected');

            const leftMessage = `${socket.username} left the room!`

            this.io
                .of('/chat')
                .to(socket.room)
                .emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
            const [,error] = await this.storeClient.deleteUser(socket.room, socket.username);

            if (error) {
                console.error(error);

                return;
            }

            this.onUsers(socket);
            const [updateError] = await this.updateSubsCount(socket.room);

            if (updateError) {
                console.error(error);
            }
        }
    }

    async updateSubsCount(room) {
            const subsCount = this.getSubsCount(room);
            const [, createRoomError] = await this.storeClient.createRoom(room, subsCount);
            const [rooms, findRoomsError] = await this.storeClient.findRooms();
            const error = createRoomError || findRoomsError;

            if (error) {
                return [undefined, error];
            }

            this.io.emit("available-rooms", rooms);

            return [];
    }
}

module.exports = {
    Io,
}
