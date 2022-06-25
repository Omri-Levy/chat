"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const path_1 = __importDefault(require("path"));
const express_1 = __importDefault(require("express"));
exports.app = (0, express_1.default)();
exports.app.use(express_1.default.static(path_1.default.join(__dirname, `/public`)));
exports.app.get(`/`, (req, res) => {
    res.sendFile(path_1.default.join(__dirname, `/views/index.html`));
});
exports.app.get(`/chat`, async (req, res) => {
    res.sendFile(path_1.default.join(__dirname, `/views/chat.html`));
});
exports.app.all(`*`, async (req, res) => {
    res.sendFile(path_1.default.join(__dirname, `/views/404.html`));
});
