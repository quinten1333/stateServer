const net = require('net');

const socketPath = '/home/quinten/.stateServer.sock';

const msgLib = (() => {
    const client = new net.Socket();
    let state = {};
    let callbacks = {};

    client.on('data', function (data) {
        data = JSON.parse(data);
        state[data.plugin][data.instance] = data.state;
        callbacks[data.plugin][data.instance](data.state);
    });

    client.on('close', function () {
        console.log('Connection closed');
    });

    client.connect(socketPath);

    return {
        subscribe: (plugin, instance, callback) => {
            if (!state[plugin]) { state[plugin] = {}; callbacks[plugin] = {}; }
            if (callbacks[plugin][instance]) { console.log('Double subscribe is not supported.'); return; }

            callbacks[plugin][instance] = callback;
            client.write(`subscribe ${plugin} ${instance}`);
        },

        unsubscribe: (plugin, instance) => {
            if (!state[plugin]) { console.log(`Unkown plugin ${plugin}`); return; }
            if (!state[plugin][instance]) { console.log(`Unkown instance ${instance}`); return; }

            client.write(`unsubscribe ${plugin} ${instance}`);
            delete callbacks[plugin][instance];
            delete state[plugin][instance];
        }
    }
})();

module.exports = msgLib;
