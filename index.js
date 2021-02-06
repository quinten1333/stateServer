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

    send = (message) => {
        console.log('Sending', message)
        this.client.write(JSON.stringify(message));
    }

    end = () => this.client.end();

    getSubscriptCB = (plugin, instance) => {
        return (newState) => {
            this.send({
                plugin: plugin,
                instance: instance,
                state: newState
            });
        }
    }

    handleCommand = (msg) => {
        const args = msg.split(/ /g);

        if (args.length < 3) {
            this.send('Need at least three arguments: <command> <plugin> <instance>');
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
                this.send(stateKeeper.get(plugin, instance));
                break;

            default:
                this.send(`Unkown command ${command}`);
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
