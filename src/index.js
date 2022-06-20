require('dotenv/config');
require('./socket-io');
const {server} = require("./server");

server.listen(process.env.PORT, () => {
    console.log(`Listening on ${process.env.PORT}`);
});