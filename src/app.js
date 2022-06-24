const express = require(`express`);
const path = require(`path`);
const app = express();

app.use(express.static(path.join(__dirname, `/public`)));

app.get(`/`, (req, res) => {
	res.sendFile(`${__dirname}/views/index.html`);
});

app.get(`/chat`, async (req, res) => {
	res.sendFile(`${__dirname}/views/chat.html`);
});

module.exports = {
	app,
};
