class StoreClient {
    constructor(redisClient) {
        this.redisStore = redisClient;
    }

    async findMessages(room) {
        try {
            const messages = await this.redisStore
                .lrange(`message:${room}`, 0, 10);

            return {
                messages: messages.map((message) => JSON.parse(message))
            };
        } catch {
            return {
                error: 'Something went wrong...',
        }
        }
    }

    async saveMessage(room, message) {
        try {
            const messagesLen = await this.redisStore
                .rpush(`message:${room}`, JSON.stringify(message))

            if (messagesLen > 10) {
                this.redisStore.lpop(`message:${room}`);
            }

            return {};
        } catch {
            return {
                error: 'Something went wrong...',
            }
        }
    }

    async saveUser(room, user) {
       try {
           await this.redisStore
               .hset(
                   `user:${room}`,
                   user.username,
                   JSON.stringify(user)
               );

           return {};
       } catch {
           return {
               error: 'Something went wrong...',
           }
       }

    }

    async findUsers(room) {
       try {
           const users = await this.redisStore
               .hgetall(
                   `user:${room}`,
               );
           const values = Object.values(users);

           return {
               users: values.map((user) => JSON.parse(user))
           };
       } catch {
           return {
               error: 'Something went wrong...',
           }
       }
    }

    async deleteUser(room, name) {
        try {
            await this.redisStore
                .hdel(
                    `user:${room}`,
                    name,
                );

            return {};
        } catch {
            return {
                error: `Could not delete user:${room} with name ${name}`
            }
        }
    }

    async findUser(room, id) {
        try {
            const user = await this.redisStore
                .hget(
                    `user:${room}`,
                    id,
                );

            return {
                user: JSON.parse(user),
            };
        } catch {
            return {
                error: 'Something went wrong...',
            }
        }
    }

    async saveRoom(room, subsCount) {
        try {
            if (!room) return;

            await this.redisStore.hset('rooms', room, JSON.stringify({
                room,
                subsCount,
            }));

            return {};
        } catch {
            return {
                error: 'Something went wrong...',
            }
        }
    }

    async findRooms() {
        try {
            const rooms = await this.redisStore.hgetall('rooms');
            const values = Object.values(rooms);

            return {
                rooms: values.map((room) => JSON.parse(room)),
            }
        } catch {
            return {
                error: 'Something went wrong...',
            }
        }
    }
}


module.exports = {
    StoreClient,
}
