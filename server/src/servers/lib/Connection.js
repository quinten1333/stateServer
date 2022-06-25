const stateKeeper = require('../../stateKeeper');
const controllerManager = require('../../controllerManager');

const connections = []
class Connection {
    constructor(client) {
        this.client = client;
        this.client.on('data', this.handleMsg); // Native socket
        this.client.on('message', this.handleMsg); // WebSocket
        this.client.on('end', this.close);
        this.client.on('close', this.close);
        this.client.on('error', this.onError);

        this.callbacks = {};
        this.packets = []
        connections.push(this);
    }

    onError = (error) => {
        if (error.code === 'ECONNRESET') { return; }

        console.error('Connection errored with unkown error.');
        console.error(error);
    }

    close = () => {
        for (const plugin in this.callbacks) {
            for (const instance in this.callbacks[plugin]) {
                stateKeeper.listen.unregister(plugin, instance, this.callbacks[plugin][instance])
            }
        }

        connections.splice(connections.indexOf(this), 1);
        this.client.close();
    }

    send = (type, message, metadata = {}) => {
        this.client.send(JSON.stringify({ data: message, type: type, ...metadata }));
    }

    getSubscriptCB = (plugin, instance) => {
        return (newState) => {
            this.send('stateUpdate', newState, {
                plugin: plugin,
                instance: instance
            });
        }
    }

    handleMsg = (buf) => {
        const end = buf.indexOf('\n');
        if (end < 0) {
            this.packets.push(buf);
            return;
        }

        const newPackets = [];
        if (end !== buf.length - 1) {
            newPackets.push(buf.slice(end + 1, buf.length));
            buf = buf.slice(buf, 0, end);
        }

        buf = buf.slice(0, buf.length - 1);
        this.packets.push(buf);
        const msg = Buffer.concat(this.packets);
        this.packets = newPackets;
        this.handleCommand(msg);
    }

    handleCommand = (msg) => {
        let args;
        try {
            args = JSON.parse(msg);
        } catch (error) {
            this.send('error', 'Invalid JSON send');
            return;
        }

        if ((!args.command || !args.plugin || !args.instance) && args.command !== 'ping') {
            this.send('error', 'Need at least three arguments: { <command>, <plugin>, <instance> }');
            return;
        }

        const { command, plugin, instance } = args;

        switch (command) {
            case 'ping':
                this.send('pong');
                break;
            case 'subscribe':
                if (this.callbacks[plugin] && this.callbacks[plugin][instance]) {
                    this.send('error', `You are already subscribed to this instance.`);
                    return;
                }

                const callback = this.getSubscriptCB(plugin, instance);
                callback(stateKeeper.get(plugin, instance));

                if (!this.callbacks[plugin]) this.callbacks[plugin] = {}
                this.callbacks[plugin][instance] = callback;
                stateKeeper.listen.register(plugin, instance, callback);
                break;

            case 'unsubscribe':
                if (!this.callbacks[plugin] || !this.callbacks[plugin][instance]) {
                    this.send('error', `You were not subscribed to this instance.`);
                    return;
                }

                stateKeeper.listen.unregister(plugin, instance, this.callbacks[plugin][instance]);
                delete this.callbacks[plugin][instance];
                break;

            case 'get':
                let state;
                try {
                    state = stateKeeper.get(plugin, instance);
                } catch (e) {
                    this.send('error', 'Unkown plugin/instance combination.', { id: args.id });
                    return;
                }

                this.send('getResponse', state, { id: args.id });
                break;

            case 'action':
                stateKeeper.action(plugin, instance, args.args).then((data) => this.send('actionResponse', data, { id: args.id }));
                break;

            case 'controllerUpdate':
                if (!('key' in args) || !('value' in args)) {
                    this.send('error', 'Missing key or value argument.', { id: args.id });
                    return;
                }

                controllerManager.updateConfig(plugin, instance, args.key, args.value);
                this.send('actionResponse', { code: 0, status: 'ok' }, { id: args.id });
                break;

            default:
                this.send('error', `Unkown command ${command}`);
                return;
        }
    };
}

module.exports = {
    Connection,
    closeAll: () => {
        connections.forEach((client) => client.close())
    }
}
