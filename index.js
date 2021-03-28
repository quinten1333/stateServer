#!/bin/env node

const net = require('net');

const stateKeeper = require('./stateKeeper');
const config = require('./config').server;

const clients = []
class Client {
    constructor(client) {
        this.client = client;
        this.client.on('data', this.onData);
        this.client.on('end', this.onEnd);
        this.client.on('close', this.onClose);

        this.callbacks = [];
        clients.push(this);
    }

    onData = (data) => {
        data = data.toString();
        this.handleCommand(data);
    }

    onEnd = () => {
        this.callbacks.forEach((callbackData) => stateKeeper.listen.unregister(...callbackData));
        this.end();
    }

    onClose = () => {
        clients.splice(clients.indexOf(this), 1);
    }

    send = (type, message) => {
        this.client.write(JSON.stringify({ data: message, type: type }));
    }

    end = () => this.client.end();

    getSubscriptCB = (plugin, instance) => {
        return (newState) => {
            this.send('stateUpdate', {
                plugin: plugin,
                instance: instance,
                state: newState
            });
        }
    }

    handleCommand = (msg) => {
        let args;
        try {
            args = JSON.parse(msg);
        } catch (error) {
            this.send('error', 'Invalid JSON send');
            return;
        }

        if (args.length < 3) {
            this.send('error', 'Need at least three arguments: [<command>, <plugin>, <instance>]');
            return;
        }

        const [command, plugin, instance] = args.splice(0, 3);

        switch (command) {
            case 'subscribe': // TODO: Check for double registration.
                const callback = this.getSubscriptCB(plugin, instance);
                callback(stateKeeper.get(plugin, instance));
                this.callbacks.push([plugin, instance, callback]);
                stateKeeper.listen.register(plugin, instance, callback);
                break;

            case 'get':
                this.send('getResponse', stateKeeper.get(plugin, instance));
                break;

            case 'action':
                stateKeeper.action(plugin, instance, args).then((data) => this.send('actionResponse', data));
                break;

            default:
                this.send('error', `Unkown command ${command}`);
                return;
        }
    };
}

process.on('SIGINT', async () => {
    console.log("Shutting down.");

    clients.forEach((client) => client.end());

    server.close();
    await stateKeeper.shutdown();
});

const server = net.createServer((client) => {
    new Client(client);
});

server.listen(config.listen);
