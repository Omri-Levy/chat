"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.subClient = exports.pubClient = void 0;
const ioredis_1 = __importDefault(require("ioredis"));
exports.pubClient = new ioredis_1.default(Number(process.env.REDIS_PORT), process.env.REDIS_HOST);
exports.subClient = exports.pubClient.duplicate();
exports.pubClient.on(`error`, (err) => {
    console.error(err);
});
exports.subClient.on(`error`, (err) => {
    console.error(err);
});
