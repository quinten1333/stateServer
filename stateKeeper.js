const stateKeeper = (() => {
    const config = require('./config');

    const instances = [];
    const listeners = {}
    const state = {};
    const setState = (plugin, instance, newArgs) => {
        state[plugin][instance] = newArgs;

        for (const callback of listeners[plugin][instance]) {
            callback(newArgs);
        }
    }

    for (let plugin in config.plugins) {
        const Plugin = require(`./plugins/${plugin}/index.js`);
        state[plugin] = {};
        listeners[plugin] = {};

        for (let instance in config.plugins[plugin].instances) {
            listeners[plugin][instance] = [];
            instances.push(new Plugin({
                args: config.plugins[plugin].instances[instance],
                onStateChange: (newArgs) => setState(plugin, instance, newArgs)
            }));
        }
    }

    return {
        listen: {
            register: (plugin, instance, callback) => {
                listeners[plugin][instance].push(callback);
            },

            unregister: (plugin, instance, callback) => {
                const instanceListeners = listeners[plugin][instance];
                instanceListeners.splice(instanceListeners.indexOf(callback), 1);
            }
        },

        get: (plugin, instance) => {
            return state[plugin][instance];
        },

        shutdown: async () => {
            await Promise.all(instances.map((instance) => instance.shutdown()));
        }
    }
})();

module.exports = stateKeeper;
