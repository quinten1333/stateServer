#!/bin/env node

const net = require('net');

const config = require('../config').server;
const { Connection } = require('./lib/Connection');

const server = net.createServer((client) => {
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
