class StoreClient {
    constructor(redisClient) {
        this.redisStore = redisClient;
    }

    async findMessages(room) {
        try {
            const messages = await this.redisStore
                .lrange(`message:${room}`, 0, 10);

            return [messages.map((message) => JSON.parse(message))];
        } catch {
            return [undefined, new Error('Failed to find messages..')];
        }
    }

    async createMessage(room, message) {
        try {
            const messagesLen = await this.redisStore
                .rpush(`message:${room}`, JSON.stringify(message))

            if (messagesLen > 10) {
                this.redisStore.lpop(`message:${room}`);
            }

            return [];
        } catch {
            return [undefined, new Error('Failed to create message..')];
        }
    }

    async createUser(room, user) {
       try {
           await this.redisStore
               .hset(
                   `user:${room}`,
                   user.username,
                   JSON.stringify(user)
               );

           return [];
       } catch {
           return [undefined, new Error('Failed to create user..')];
       }

    }

    async findUsers(room) {
       try {
           const users = await this.redisStore
               .hgetall(
                   `user:${room}`,
               );
           const values = Object.values(users);

           return [values.map((user) => JSON.parse(user)), undefined];
       } catch {
           return [undefined, new Error('Failed to find users..')];
       }
    }

    async deleteUser(room, name) {
        try {
            await this.redisStore
                .hdel(
                    `user:${room}`,
                    name,
                );

            return [];
        } catch {
            return [undefined, new Error(`Failed to delete user:${room} with name ${name}..`)]
        }
    }

    async findUser(room, id) {
        try {
            const user = await this.redisStore
                .hget(
                    `user:${room}`,
                    id,
                );

            return [JSON.parse(user)];
        } catch {
            return [undefined, new Error(`Failed to find user:${room} with id ${id}..`)];
        }
    }

    async createRoom(room, subsCount) {
        try {
            await this.redisStore.hset('rooms', room, JSON.stringify({
                room,
                subsCount,
            }));

            return [];
        } catch {
            return [undefined, new Error('Failed to create room..')];
        }
    }

    async findRooms() {
        try {
            const rooms = await this.redisStore.hgetall('rooms');
            const values = Object.values(rooms);

            return [values.map((room) => JSON.parse(room))]
        } catch {
            return [undefined, new Error('Failed to find rooms..')];
        }
    }

    async findRoom(room) {
        try {
            const roomInfo = await this.redisStore.hget('rooms', room);

            return [roomInfo ? JSON.parse(roomInfo) : undefined];
        } catch {
            return [undefined, new Error('Failed to find room..')];
        }
    }
}


module.exports = {
    StoreClient,
}
