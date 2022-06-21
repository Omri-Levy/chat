class StoreClient {
    constructor(redisClient) {
        this.redisStore = redisClient;
    }

    async findMessages(room) {
        const messages= await this.redisStore
            .lrange(`message:${room}`, 0, 10);

        return messages.map((message) => JSON.parse(message));
    }

    async saveMessage(room, message) {
        const messagesLen = await this.redisStore
            .rpush(`message:${room}`, JSON.stringify(message))

        if (messagesLen > 10) {
            return this.redisStore.lpop(`message:${room}`);
        }
    }

    async saveUser(room, user) {
        return this.redisStore
            .hset(
                `user:${room}`,
                user.username,
                JSON.stringify(user)
            );

    }

    async findUsers(room) {
        const users = await this.redisStore
            .hgetall(
                `user:${room}`,
            );
        const values = Object.values(users);

        return values.map((user) => JSON.parse(user));
    }

    async deleteUser(room, id) {
        return this.redisStore
            .hdel(
                `user:${room}`,
                id,
            );
    }

    async findUser(room, id) {
        const user = await this.redisStore
            .hget(
                `user:${room}`,
                id,
            );

        return JSON.parse(user);
    }

    async saveRoom(room, subsCount) {
        if (!room) return;

        return this.redisStore.hset('rooms', room, JSON.stringify({
            room,
            subsCount,
        }));
    }

    async findRooms() {
        const rooms = await this.redisStore.hgetall('rooms');
        const values = Object.values(rooms);

        return values.map((room) => JSON.parse(room));
    }
}


module.exports = {
    StoreClient,
}
