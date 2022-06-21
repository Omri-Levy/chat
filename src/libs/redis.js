const {createClient} = require('ioredis');
const pubClient = createClient({
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT,
});
const subClient = pubClient.duplicate();

pubClient.on('error', (err) => {
    console.error(err);
});

subClient.on('error', (err) => {
    console.error(err);
});

module.exports = {
    pubClient,
    subClient,
}