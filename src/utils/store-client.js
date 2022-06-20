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
        return this.redisStore
            .hgetall(
                `user:${room}`,
            )
            .then((users) => {
                return Object.values(users).map((user) => JSON.parse(user));
            });
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
}


module.exports = {
    StoreClient,
}