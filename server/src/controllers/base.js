class ControllerBase {

    /**
     * Update the controller arguments during runtime.
     * @param {Object} args Object containing the arguments.
     */
    readConfig(args) {}

    /**
     * Called on server startup. Handle all async initialization here.
     * First time that state can be set;
     */
    async initialize() {}

    /**
     * Called on server shutdown. Cancel all timers, web requests etc.
     */
    async shutdown() {}

}

module.exports = { ControllerBase }
