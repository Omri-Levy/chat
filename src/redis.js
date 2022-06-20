const {createClient} = require('ioredis');
const redisClient = createClient({
    host: 'redis',
    port: 6379,
});
const subClient = redisClient.duplicate();

redisClient.on('error', (err) => {
    console.error(err);
});

subClient.on('error', (err) => {
    console.error(err);
});

module.exports = {
    redisClient,
    subClient,
}