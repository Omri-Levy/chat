"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Io = void 0;
const redis_adapter_1 = require("@socket.io/redis-adapter");
const dompurify_1 = __importDefault(require("dompurify"));
const jsdom_1 = require("jsdom");
const bad_words_1 = __importDefault(require("bad-words"));
const marked_1 = require("marked");
const styles = __importStar(require("@dicebear/open-peeps"));
const avatars_1 = require("@dicebear/avatars");
const schemas_1 = require("../validation/schemas");
const z_parse_1 = require("../validation/z-parse");
const alias_emoji_1 = require("./alias-emoji");
const uuid_1 = require("uuid");
const window = new jsdom_1.JSDOM(``).window;
const DOMPurify = (0, dompurify_1.default)(window);
class Io {
    io;
    storeClient;
    pubClient;
    subClient;
    systemAvatar = (0, avatars_1.createAvatar)(styles, {
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
    throttle = {};
    THROTTLE_TIMEOUT = 3;
    constructor(io, storeClient, pubClient, subClient) {
        this.io = io;
        this.storeClient = storeClient;
        this.pubClient = pubClient;
        this.subClient = subClient;
        this.io.adapter((0, redis_adapter_1.createAdapter)(pubClient, subClient));
        this.io
            .of(`/chat`)
            .use((socket, next) => this.handleSession(socket, next));
        this.io
            .of(`/chat`)
            .on(`connection`, (socket) => this.onConnection(socket));
        this.io.on(`connection`, async (socket) => {
            const [rooms, error] = await this.storeClient.findRooms();
            if (rooms?.length === 0) {
                const [, findRoomsError] = await this.storeClient.createRoom(`General`, 0);
                if (findRoomsError) {
                    return socket.emit(`error`, {
                        message: findRoomsError.message,
                    });
                }
            }
            if (error) {
                return socket.emit(`error`, {
                    message: error.message,
                });
            }
            this.io.emit(`available-rooms`, rooms);
            socket.on(`create`, this.onCreateRoom.bind(this));
        });
    }
    async onCreateRoom(room, cb) {
        const cleanRoom = room.trim();
        const [, errors] = await (0, z_parse_1.zParse)(schemas_1.roomSchema.schema, cleanRoom);
        if (errors) {
            return cb({
                message: `Validation Error`,
                data: errors,
            });
        }
        const [roomExists] = await this.storeClient.findRoom(cleanRoom);
        if (roomExists) {
            return cb({
                message: schemas_1.roomSchema.alreadyExists(cleanRoom),
            });
        }
        const [, createRoomError] = await this.storeClient.createRoom(cleanRoom, 0);
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
        this.io.emit(`available-rooms`, rooms);
        cb();
    }
    async onUsers(socket) {
        const [users, error] = await this.storeClient.findUsers(socket.user.room);
        if (error instanceof Error) {
            return socket.emit(`error`, {
                message: error.message,
            });
        }
        this.io.of(`/chat`).to(socket.user.room).emit(`users`, users);
    }
    async sendMessagesHistory(socket) {
        const [messages, error] = await this.storeClient.findMessages(socket.user.room);
        if (error instanceof Error) {
            return socket.emit(`error`, {
                message: error.message,
            });
        }
        messages?.forEach((message) => {
            this.io
                .of(`/chat`)
                .to(socket.user.room)
                .emit(...this.emitMessage(message));
        });
    }
    async onJoinRoom(socket) {
        const [roomExists, findRoomError] = await this.storeClient.findRoom(socket.user.room);
        if (!roomExists) {
            const err = new Error(schemas_1.roomSchema.doesNotExist(socket.user.room));
            return socket.emit(`error`, {
                message: err.message,
            });
        }
        if (findRoomError) {
            return socket.emit(`error`, {
                message: findRoomError.message,
            });
        }
        const joinedMessage = `${socket.user.username} joined the room!`;
        const welcomeMessage = `Welcome to ${socket.user.room}, ${socket.user.username}!`;
        socket.join(socket.user.room);
        const [updateError] = await this.updateSubsCount(socket.user.room);
        if (updateError) {
            return socket.emit(`error`, {
                message: updateError.message,
            });
        }
        await this.onUsers(socket);
        await this.sendMessagesHistory(socket);
        socket.emit(...this.emitMessage(this.generateSystemMessage(welcomeMessage)));
        socket
            .to(socket.user.room)
            .emit(...this.emitMessage(this.generateSystemMessage(joinedMessage)));
    }
    async onConnection(socket) {
        console.log(`Client connected`);
        socket.emit(`session`, {
            sessionId: socket.user.sessionId,
        });
        await this.onJoinRoom(socket);
        socket.on(`message`, this.onMessage(socket).bind(this));
        socket.on(`start-typing`, this.onStartTyping(socket).bind(this));
        socket.on(`stop-typing`, this.onStopTyping(socket).bind(this));
        socket.on(`disconnect`, this.onDisconnect(socket).bind(this));
    }
    getSubsCount(room) {
        return this.io.of(`/chat`).adapter.rooms.get(room)?.size ?? 0;
    }
    onStartTyping(socket) {
        return function () {
            socket.to(socket.user.room).emit(`start-typing`, {
                username: socket.user.username,
            });
        };
    }
    onStopTyping(socket) {
        return function () {
            socket.to(socket.user.room).emit(`stop-typing`, {
                username: socket.user.username,
            });
        };
    }
    async handleSession(socket, next) {
        const sanitized = {
            room: DOMPurify.sanitize(socket.handshake.auth.room).trim(),
            username: DOMPurify.sanitize(socket.handshake.auth.username).trim(),
        };
        // In case someone will try and modify the localStorage entry.
        const sessionId = DOMPurify.sanitize(socket.handshake.auth.sessionId);
        const [{ room, username } = {}, errors] = await (0, z_parse_1.zParse)(schemas_1.authSchema, sanitized);
        if (errors) {
            const err = new Error(`Validation Error`);
            err.data = errors;
            return next(err);
        }
        const [user, findUserError] = await this.storeClient.findUser(room, username);
        if (findUserError) {
            return next(findUserError);
        }
        if (user && user.sessionId !== sessionId) {
            const err = new Error(schemas_1.usernameSchema.alreadyExists(username));
            return next(err);
        }
        if (user) {
            socket.user = {
                sessionId: user.sessionId,
                room: user.room,
                username: user.username,
                avatar: user.avatar,
            };
            return next();
        }
        socket.user = {
            sessionId: sessionId ?? (0, uuid_1.v4)(),
            room,
            username,
            avatar: (0, avatars_1.createAvatar)(styles, {
                seed: username + room,
            }),
        };
        const [, createUserError] = await this.storeClient.createUser(socket.user.room, socket.user);
        if (createUserError) {
            return next(createUserError);
        }
        next();
    }
    emitMessage(message) {
        return [`message`, message];
    }
    generateMessage({ avatar, from, body }) {
        return {
            avatar,
            from,
            body,
            timestamp: new Date(),
        };
    }
    generateSystemMessage(body) {
        return this.generateMessage({
            avatar: this.systemAvatar,
            from: `System`,
            body,
        });
    }
    shouldThrottle(socket) {
        this.throttle[socket.handshake.address] ??= {
            count: 0,
            timeout: undefined,
        };
        clearTimeout(this.throttle[socket.handshake.address].timeout);
        this.throttle[socket.handshake.address].timeout = setTimeout(() => {
            this.throttle[socket.handshake.address].count = 0;
        }, this.THROTTLE_TIMEOUT * 1000);
        if (this.throttle[socket.handshake.address].count >= 3) {
            return true;
        }
        this.throttle[socket.handshake.address].count++;
        return false;
    }
    onMessage(socket) {
        return async (msg, cb) => {
            const shouldThrottle = this.shouldThrottle(socket);
            if (shouldThrottle) {
                return cb({
                    message: `You are sending messages too fast! Try again in ${this.THROTTLE_TIMEOUT} second(s).`,
                });
            }
            const filter = new bad_words_1.default();
            const sanitized = DOMPurify.sanitize(msg.trim());
            const renderer = new marked_1.Renderer();
            renderer.link = (href, title, text) => {
                return `<a  href="${href}" title="${title}" target="_blank">${text}</a>`;
            };
            const markdown = (0, marked_1.marked)(sanitized, { renderer });
            const profanity = filter.clean(markdown);
            const emojis = [
                [`:)`, `smile`],
                [`:D`, `smile`],
                [`:(`, `frowning`],
                [`D:`, `frowning`],
                [`;(`, `cry`],
                [`D;`, `cry`],
                [`;)`, `wink`],
                [`:|`, `neutral_face`],
                [`:-)`, `grin`],
                [`:-(`, `disappointed`],
                [`:-|`, `expressionless`],
                [`:o`, `open_mouth`],
                [`:0`, `open_mouth`],
                [`:O`, `open_mouth`],
                [`:-o`, `open_mouth`],
                [`:-0`, `open_mouth`],
                [`:P`, `stuck_out_tongue`],
                [`:p`, `stuck_out_tongue`],
                [`:-P`, `stuck_out_tongue`],
                [`:-p`, `stuck_out_tongue`],
            ];
            const body = (0, alias_emoji_1.aliasEmoji)(profanity, ...emojis).replace(/\n/g, `<br/>`);
            const message = {
                avatar: socket.user.avatar,
                from: socket.user.username,
                body,
                timestamp: new Date(),
            };
            const [, error] = await this.storeClient.createMessage(socket.user.room, message);
            if (error) {
                return cb({
                    message: error.message,
                });
            }
            this.io
                .of(`/chat`)
                .to(socket.user.room)
                .emit(...this.emitMessage(message));
            cb();
        };
    }
    onDisconnect(socket) {
        return async () => {
            const [roomExists] = await this.storeClient.findRoom(socket.user.room);
            if (!roomExists) {
                return;
            }
            console.log(`Client disconnected`);
            const leftMessage = `${socket.user.username} left the room!`;
            this.io
                .of(`/chat`)
                .to(socket.user.room)
                .emit(...this.emitMessage(this.generateSystemMessage(leftMessage)));
            const [, error] = await this.storeClient.deleteUser(socket.user.room, socket.user.username);
            if (error) {
                console.error(error);
                return;
            }
            this.onUsers(socket);
            const [updateError] = await this.updateSubsCount(socket.user.room);
            if (updateError) {
                console.error(error);
            }
        };
    }
    async updateSubsCount(room) {
        const subsCount = this.getSubsCount(room);
        const [, createRoomError] = await this.storeClient.createRoom(room, subsCount);
        const [rooms, findRoomsError] = await this.storeClient.findRooms();
        const error = createRoomError || findRoomsError;
        if (error) {
            return [undefined, error];
        }
        this.io.emit(`available-rooms`, rooms);
        return [];
    }
}
exports.Io = Io;
