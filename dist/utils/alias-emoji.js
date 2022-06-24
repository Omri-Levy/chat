"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.aliasEmoji = void 0;
const node_emoji_1 = __importDefault(require("node-emoji"));
const aliasEmoji = (str, ...args) => {
    let string = str;
    args.forEach(([pattern, alias]) => {
        string = string.replaceAll(pattern, `:${alias}:`);
    });
    return node_emoji_1.default.emojify(string);
};
exports.aliasEmoji = aliasEmoji;
