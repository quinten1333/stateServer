const stateKeeper = (() => {
    const config = require('./config');

    const instances = {};
    const setState = (plugin, instance, newState) => {
        const instanceData = instances[plugin][instance];
        instanceData.state = newState;

        for (const callback of instanceData.listeners) {
            callback(newState);
        }
    }

    for (let plugin in config.plugins) {
        const Plugin = require(`./plugins/${plugin}/index.js`);
        instances[plugin] = {};

        for (let instance in config.plugins[plugin].instances) {
            instances[plugin][instance] = {
                listeners: [],
                state: {},
                instance: new Plugin({
                    name: instance,
                    args: config.plugins[plugin].instances[instance],
                    onStateChange: (newState) => setState(plugin, instance, newState)
                })
            };
            instances[plugin][instance].instance.initialize();
        }
    }

    return {
        listen: {
            register: (plugin, instance, callback) => {
                instances[plugin][instance].listeners.push(callback);
            },

            unregister: (plugin, instance, callback) => {
                const instanceListeners = instances[plugin][instance].listeners;
                instanceListeners.splice(instanceListeners.indexOf(callback), 1);
            }
        },

        get: (plugin, instance) => {
            return instances[plugin][instance].state;
        },

        action: async (plugin, instance, args) => {
            return instances[plugin][instance].instance.action(args);
        },

        shutdown: async () => {
            let shuttingDown = [];
            for (const plugin in instances) {
                for (const instance in instances[plugin]) {
                    shuttingDown.push(instances[plugin][instance].instance.shutdown());
                }
            }

            await Promise.all(shuttingDown);
        }
    }
})();

module.exports = stateKeeper;
