import Redis from 'ioredis';

export const pubClient = new Redis(
	Number(process.env.REDIS_PORT),
	process.env.REDIS_HOST
);
export const subClient = pubClient.duplicate();

pubClient.on(`error`, (err) => {
	console.error(err);
});

subClient.on(`error`, (err) => {
	console.error(err);
});
