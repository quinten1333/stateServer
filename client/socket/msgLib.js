const apiLib = require('../apiLib');
const net = require('net');

const msgLib = (server) => {
    return new Promise(async (resolve, reject) => {
        const socket = new net.Socket();
        let connected;
        let onConnected = new Promise((resolve) => socket.once('connect', () => resolve(true)));
        socket.close = () => socket.end();
        socket.send = socket.write;
        socket.onOpen = (callback) => onConnected.then(callback);
        socket.connected = () => connected;

        const api = apiLib(socket);
        socket.on('data', api.processMessage);

        socket.once('error', reject);
        socket.connect(server.port, server.host);
        connected = await onConnected;
        socket.removeListener('error', reject);

        socket.on('error', (err) => {
            console.error('Socket error: ', err);
        });

        resolve(api);
    });
};

module.exports = msgLib;
