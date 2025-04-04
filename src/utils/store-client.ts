import { Redis } from 'ioredis';
import { IMessage } from './io';

export interface IUser {
	username: string;
	room: string;
	sessionId: string;
	avatar: string;
}

export class StoreClient {
	constructor(private redisStore: Redis) {}

	async findMessages(
		room: string
	): Promise<[Array<IMessage> | undefined, Error | undefined]> {
		try {
			const messages = (await this.redisStore.lrange(
				`message:${room}`,
				0,
				10
			)) as Array<string>;

			return [messages.map((message) => JSON.parse(message)), undefined];
		} catch {
			return [undefined, new Error(`Failed to find messages..`)];
		}
	}

	async createMessage(room: string, message: IMessage) {
		try {
			const messagesLen = await this.redisStore.rpush(
				`message:${room}`,
				JSON.stringify(message)
			);

			if (messagesLen > 10) {
				this.redisStore.lpop(`message:${room}`);
			}

			return [];
		} catch {
			return [undefined, new Error(`Failed to create message..`)];
		}
	}

	async createUser(room: string, user: IUser) {
		try {
			await this.redisStore.hset(
				`user:${room}`,
				user.username,
				JSON.stringify(user)
			);

			return [];
		} catch {
			return [undefined, new Error(`Failed to create user..`)];
		}
	}

	async findUsers(room: string) {
		try {
			const users = await this.redisStore.hgetall(`user:${room}`);
			const values = Object.values(users);

			return [values.map((user) => JSON.parse(user)), undefined];
		} catch {
			return [undefined, new Error(`Failed to find users..`)];
		}
	}

	async deleteUser(room: string, username: string) {
		try {
			await this.redisStore.hdel(`user:${room}`, username);

			return [];
		} catch {
			return [
				undefined,
				new Error(
					`Failed to delete user:${room} with username ${username}..`
				),
			];
		}
	}

	async findUser(room: string, username: string) {
		try {
			const user = await this.redisStore.hget(`user:${room}`, username);

			return [user ? JSON.parse(user) : undefined];
		} catch {
			return [
				undefined,
				new Error(
					`Failed to find user:${room} with username ${username}..`
				),
			];
		}
	}

	async createRoom(room: string, subsCount: number) {
		try {
			await this.redisStore.hset(
				`rooms`,
				room,
				JSON.stringify({
					room,
					subsCount,
				})
			);

			return [];
		} catch {
			return [undefined, new Error(`Failed to create room..`)];
		}
	}

	async findRooms(): Promise<[string[] | undefined, Error | undefined]> {
		try {
			const rooms = await this.redisStore.hgetall(`rooms`);
			const values = Object.values(rooms);

			return [values.map((room) => JSON.parse(room)), undefined];
		} catch {
			return [undefined, new Error(`Failed to find rooms..`)];
		}
	}

	async findRoom(room: string) {
		try {
			const roomInfo = await this.redisStore.hget(`rooms`, room);

			return [roomInfo ? JSON.parse(roomInfo) : undefined];
		} catch {
			return [undefined, new Error(`Failed to find room..`)];
		}
	}
}
