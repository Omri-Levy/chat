import path from 'path';
import express from 'express';

export const app = express();

app.use(express.static(path.join(__dirname, `/public`)));

app.get(`/`, (req, res) => {
	res.sendFile(path.join(__dirname, `/views/index.html`));
});

app.get(`/chat`, async (req, res) => {
	res.sendFile(path.join(__dirname, `/views/chat.html`));
});

app.all(`*`, async (req, res) => {
	res.sendFile(path.join(__dirname, `/views/404.html`));
});
