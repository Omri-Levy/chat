const express = require('express');
const app = express();

app.use(express.static(__dirname + '/public'));

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html');
})

app.get('/chat', (req, res) => {
    res.sendFile(__dirname + '/views/chat.html');
})

module.exports = {
    app,
}