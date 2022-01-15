const controllerManager = ((stateKeeper) => {
    const config = require('./config');

    const instances = {};
    for (const controller in config.controllers) {
        const Controller = require(`./controllers/${controller}/index.js`);
        instances[controller] = {};

        for (const instance in config.controllers[controller].instances) {
            instances[controller][instance] = {
                listeners: [],
                state: {},
                instance: new Controller({
                    name: instance,
                    args: config.controllers[controller].instances[instance],
                    stateKeeper
                })
            };
            instances[controller][instance].instance.initialize();
        }
    }

    return {
        shutdown: async () => {
            let shuttingDown = [];
            for (const controller in instances) {
                for (const instance in instances[controller]) {
                    shuttingDown.push(instances[controller][instance].instance.shutdown());
                }
            }

            await Promise.all(shuttingDown);
        }
    }
});

module.exports = controllerManager;
