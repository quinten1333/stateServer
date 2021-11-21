const stateKeeper = require('../../stateKeeper');

const connections = []
class Connection {
    constructor(client) {
        this.client = client;
        this.client.on('data', this.handleCommand); // Native socket
        this.client.on('message', this.handleCommand); // WebSocket
        this.client.on('end', this.close);
        this.client.on('close', this.close);
        this.client.on('error', this.onError);

        this.callbacks = {};
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

    send = (type, message, metadata={}) => {
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

    handleCommand = (msg) => {
        let args;
        try {
            args = JSON.parse(msg);
        } catch (error) {
            this.send('error', 'Invalid JSON send');
            return;
        }

        if (!args.command || !args.plugin || !args.instance) {
            this.send('error', 'Need at least three arguments: { <command>, <plugin>, <instance> }');
            return;
        }

        const { command, plugin, instance } = args;

        switch (command) {
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
