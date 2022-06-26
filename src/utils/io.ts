import { createAdapter } from '@socket.io/redis-adapter';
import createDOMPurify from 'dompurify';
import { IUser, StoreClient } from './store-client';
import { JSDOM } from 'jsdom';
import Filter from 'bad-words';
import { marked, Renderer } from 'marked';
import * as styles from '@dicebear/open-peeps';
import { createAvatar } from '@dicebear/avatars';
import { authSchema, roomSchema, usernameSchema } from '../validation/schemas';
import { zParse } from '../validation/z-parse';
import { aliasEmoji } from './alias-emoji';
import { v4 } from 'uuid';
import { Server, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { ExtendedError } from 'socket.io/dist/namespace';

const window = new JSDOM(``).window;
const DOMPurify = createDOMPurify(window as any);

export type Next = (err?: ExtendedError | undefined) => void;

export type Cb = ({
	message,
	data,
}?: {
	message: string;
	data?: Array<string>;
}) => void;

export interface IMessage {
	from: string;
	avatar: string;
	body: string;
	timestamp: Date;
}

export type SocketWithUser = Socket & { user: IUser };

export class Io {
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
	throttle: {
		[ip: string]: { count: number; timeout: NodeJS.Timeout | undefined };
	} = {};
	THROTTLE_TIMEOUT = 3;

	constructor(
		private io: Server,
		private storeClient: StoreClient,
		private pubClient: Redis,
		private subClient: Redis
	) {
		this.io.adapter(createAdapter(pubClient, subClient));
		this.io
			.of(`/chat`)
			.use((socket, next) =>
				this.handleSession(socket as SocketWithUser, next)
			);
		this.io
			.of(`/chat`)
			.on(`connection`, (socket) =>
				this.onConnection(socket as SocketWithUser)
			);
		this.io.on(`connection`, async (socket) => {
			const [rooms, error] = await this.storeClient.findRooms();

			if (rooms?.length === 0) {
				const [, findRoomsError] = await this.storeClient.createRoom(
					`General`,
					0
				);

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

	async onCreateRoom(room: string, cb: Cb) {
		const cleanRoom = room.trim();
		const [, errors] = await zParse(roomSchema.schema, cleanRoom);

		if (errors) {
			return cb({
				message: `Validation Error`,
				data: errors,
			});
		}

		const [roomExists] = await this.storeClient.findRoom(cleanRoom);

		if (roomExists) {
			return cb({
				message: roomSchema.alreadyExists(cleanRoom),
			});
		}

		const [, createRoomError] = await this.storeClient.createRoom(
			cleanRoom,
			0
		);

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

	async onUsers(socket: SocketWithUser) {
		const [users, error] = await this.storeClient.findUsers(
			socket.user.room
		);

		if (error instanceof Error) {
			return socket.emit(`error`, {
				message: error.message,
			});
		}

		this.io.of(`/chat`).to(socket.user.room).emit(`users`, users);
	}

	async sendMessagesHistory(socket: SocketWithUser) {
		const [messages, error] = await this.storeClient.findMessages(
			socket.user.room
		);

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

	async onJoinRoom(socket: SocketWithUser) {
		const [roomExists, findRoomError] = await this.storeClient.findRoom(
			socket.user.room
		);

		if (!roomExists) {
			const err = new Error(roomSchema.doesNotExist(socket.user.room));

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

		socket.emit(
			...this.emitMessage(this.generateSystemMessage(welcomeMessage))
		);
		socket
			.to(socket.user.room)
			.emit(
				...this.emitMessage(this.generateSystemMessage(joinedMessage))
			);
	}

	async onConnection(socket: SocketWithUser) {
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

	getSubsCount(room: string) {
		return this.io.of(`/chat`).adapter.rooms.get(room)?.size ?? 0;
	}

	onStartTyping(socket: SocketWithUser) {
		return function () {
			socket.to(socket.user.room).emit(`start-typing`, {
				username: socket.user.username,
			});
		};
	}

	onStopTyping(socket: SocketWithUser) {
		return function () {
			socket.to(socket.user.room).emit(`stop-typing`, {
				username: socket.user.username,
			});
		};
	}

	async handleSession(socket: SocketWithUser, next: Next) {
		const sanitized = {
			room: DOMPurify.sanitize(socket.handshake.auth.room).trim(),
			username: DOMPurify.sanitize(socket.handshake.auth.username).trim(),
		};
		// In case someone will try and modify the localStorage entry.
		const sessionId = DOMPurify.sanitize(socket.handshake.auth.sessionId);
		const [{ room, username } = {}, errors] = await zParse(
			authSchema,
			sanitized
		);

		if (errors) {
			const err = new Error(`Validation Error`) as Error & {
				data: Array<string>;
			};

			err.data = errors;

			return next(err);
		}

		const [user, findUserError] = await this.storeClient.findUser(
			room,
			username
		);

		if (findUserError) {
			return next(findUserError);
		}

		if (user && user.sessionId !== sessionId) {
			const err = new Error(usernameSchema.alreadyExists(username));

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
			sessionId: sessionId ?? v4(),
			room,
			username,
			avatar: createAvatar(styles, {
				seed: username + room,
			}),
		};

		const [, createUserError] = await this.storeClient.createUser(
			socket.user.room,
			socket.user
		);

		if (createUserError) {
			return next(createUserError);
		}

		next();
	}

	emitMessage(message: IMessage): [`message`, IMessage] {
		return [`message`, message];
	}

	generateMessage({ avatar, from, body }: Omit<IMessage, `timestamp`>) {
		return {
			avatar,
			from,
			body,
			timestamp: new Date(),
		};
	}

	generateSystemMessage(body: string) {
		return this.generateMessage({
			avatar: this.systemAvatar,
			from: `System`,
			body,
		});
	}

	shouldThrottle(socket: SocketWithUser) {
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

	onMessage(socket: SocketWithUser) {
		return async (msg: string, cb: Cb) => {
			const shouldThrottle = this.shouldThrottle(socket);

			if (shouldThrottle) {
				return cb({
					message: `You are sending messages too fast! Try again in ${this.THROTTLE_TIMEOUT} second(s).`,
				});
			}

			const filter = new Filter();
			const sanitized = DOMPurify.sanitize(msg.trim());
			const renderer = new Renderer();
			renderer.link = (href, title, text) => {
				return `<a  href="${href}" title="${title}" target="_blank">${text}</a>`;
			};
			const markdown = marked(sanitized, { renderer });
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
			const body = aliasEmoji(profanity, ...emojis).replace(
				/\n/g,
				`<br/>`
			);
			const message: IMessage = {
				avatar: socket.user.avatar,
				from: socket.user.username,
				body,
				timestamp: new Date(),
			};
			const [, error] = await this.storeClient.createMessage(
				socket.user.room,
				message
			);

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

	onDisconnect(socket: SocketWithUser) {
		return async () => {
			const [roomExists] = await this.storeClient.findRoom(
				socket.user.room
			);

			if (!roomExists) {
				return;
			}

			console.log(`Client disconnected`);

			const leftMessage = `${socket.user.username} left the room!`;

			this.io
				.of(`/chat`)
				.to(socket.user.room)
				.emit(
					...this.emitMessage(this.generateSystemMessage(leftMessage))
				);
			const [, error] = await this.storeClient.deleteUser(
				socket.user.room,
				socket.user.username
			);

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

	async updateSubsCount(room: string) {
		const subsCount = this.getSubsCount(room);
		const [, createRoomError] = await this.storeClient.createRoom(
			room,
			subsCount
		);
		const [rooms, findRoomsError] = await this.storeClient.findRooms();
		const error = createRoomError || findRoomsError;

		if (error) {
			return [undefined, error];
		}

		this.io.emit(`available-rooms`, rooms);

		return [];
	}
}
