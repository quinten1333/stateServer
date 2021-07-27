let state = {};

class Callbacks {
    constructor() {
        this.callbacks = {};
    }

    add(plugin, instance, callback) {
        if (!this.callbacks[plugin]) this.callbacks[plugin] = {};
        if (!this.callbacks[instance]) this.callbacks[plugin][instance] = [];

        if (state[plugin] && state[plugin][instance]) {
            callback(state[plugin][instance])
        }

        this.callbacks[plugin][instance].push(callback);
    }

    remove(plugin, instance, callback) {
        const index = this.callbacks[plugin][instance].indexOf(callback);
        if (index < 0) { throw new Error('Callback not found!'); }

        this.callbacks[plugin][instance].splice(index, 1);
    }

    call(plugin, instance, data) {
        for (const callback of this.callbacks[plugin][instance]) {
            callback(data);
        }
    }

    active(plugin, instance) {
        return this.callbacks[plugin] &&
            this.callbacks[plugin][instance] &&
            this.callbacks[plugin][instance].length > 0;
    }
}

class OneTimeCallback {
    constructor() {
        this.callbacks = {};
    }

    add(callback) {
        const id = OneTimeCallback.id++;
        this.callbacks[id] = callback;
        return id;
    }

    remove(id) {
        delete this.callbacks[id];
    }

    call(id, data) {
        this.callbacks[id](data);
        this.remove(id);
    }
}
OneTimeCallback.id = 1;

const apiLib = ((socket) => {
    let callbacks = new Callbacks();
    let oneTimeCallbacks = new OneTimeCallback();

    return {
        processMessage: (message) => {
            message = JSON.parse(message);
            const { data, type } = message;

            switch (type) {
                case 'stateUpdate':
                    state[message.plugin][message.instance] = data;
                    callbacks.call(message.plugin, message.instance, data)
                    break;

                case 'getResponse':
                case 'actionResponse':
                    if (!message.id) { console.error('Received one time response with no id!'); return; }
                    oneTimeCallbacks.call(message.id, data);
                    break;

                case 'error':
                    console.error('Error', data);
                    if (message.id) {
                        oneTimeCallbacks.call(message.id, new Error(data));
                    }
                    break;

                default:
                    console.error('Received unkown type', data.type);
                    return;
            }
        },

        subscribe: (plugin, instance, callback) => {
            if (!state[plugin]) { state[plugin] = {}; }

            callbacks.add(plugin, instance, callback);
            if (state[plugin] && state[plugin][instance]) { return }

            socket.send(JSON.stringify({ command: 'subscribe', plugin, instance }));
        },

        unsubscribe: (plugin, instance, callback) => {
            callbacks.remove(plugin, instance, callback);
            if (callbacks.active(plugin, instance)) { return; }

            socket.send(JSON.stringify({ command: 'unsubscribe', plugin, instance }));
            delete state[plugin][instance];
        },

        get: (plugin, instance) => {
            return new Promise((resolve) => {
                const id = oneTimeCallbacks.add(resolve);
                socket.send(JSON.stringify({ command: 'get', plugin, instance, id }));
            });
        },

        action: (plugin, instance, args) => {
            return new Promise((resolve, reject) => {
                const id = oneTimeCallbacks.add((response) => {
                    if (response.data && response.data.code !== 0) {
                        reject(response.data.status)
                        return;
                    }

                    resolve(response.data);
                });
                socket.send(JSON.stringify({ command: 'action', plugin, instance, id, args }));
            });
        },

        connected: socket.connected,
        onOpen: socket.onOpen,
        close: socket.close,
    }
});

module.exports = apiLib;
