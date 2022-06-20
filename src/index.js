require('dotenv/config');
require('./libs/socket-io');
const http = require('http');
const {app} = require("./app");
const server = http.createServer(app);

server.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}`);
});