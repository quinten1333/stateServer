const net = require('net');

const socketPath = '/home/quinten/.stateServer.sock';

const msgLib = (() => {
    const client = new net.Socket();
    let state = {};
    let callbacks = {};
    let getCallback = null;
    let actionCallback = null;

    client.on('data', function (message) {
        message = JSON.parse(message);
        const { data, type } = message;

        switch (type) {
            case 'stateUpdate':
                state[data.plugin][data.instance] = data.state;
                callbacks[data.plugin][data.instance](data.state);
                break;

            case 'getResponse':
                if (!getCallback) { console.error('Received get response while no callback was set!'); return; }
                getCallback(data);
                getCallback = null;
                break;

            case 'actionResponse':
                if (!actionCallback) { console.error('Received action response while no callback was set!'); return; }
                actionCallback(data);
                actionCallback = null;
                break;


            default:
                console.error('Received unkown type', data.type);
                return;
        }
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
        },

        get: (plugin, instance) => {
            return new Promise((resolve) => {
                getCallback = resolve;
                client.write(`get ${plugin} ${instance}`);
            });
        },

        action: (plugin, instance, args) => {
            return new Promise((resolve) => {
                actionCallback = resolve;
                client.write(`action ${plugin} ${instance} ${args.join(' ')}`.trim());
            });
        },

        end: () => {
            client.end();
        }
    }
})();

module.exports = msgLib;
