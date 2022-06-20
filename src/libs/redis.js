const {createClient} = require('ioredis');
const pubClient = createClient({
    host: 'redis',
    port: 6379,
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