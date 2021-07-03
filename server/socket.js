#!/bin/env node

const net = require('net');

const config = require('../config').server.socket;
const { Connection } = require('./lib/Connection');

const server = net.createServer((client) => {
    // Standardize function names
    client.close = client.end;
    client.send = client.write;

    new Connection(client);
});


module.exports = {
    initialize: () => {
        server.listen(config.listen);
    },

    shutdown: () => {
        server.close();
    }
}
