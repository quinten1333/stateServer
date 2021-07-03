#!/bin/env node
const Server = require('ws').Server;

const config = require('../config').server.webSocket;
const { Connection } = require('./lib/Connection');

const server = new Server({ port: config.listen });

server.on('connection', (ws) => {
    new Connection(ws);
})


module.exports = {
    initialize: () => {
    },

    shutdown: () => {
        server.close((err) => {
            if (err) throw err;
        })
    }
}
