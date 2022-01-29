class EventBased {
    constructor({args, onStateChange}) {
        this.onStateChange = onStateChange;
    }

    /**
     * Called on server startup. Handle all async initialization here.
     * First time that state can be set;
     */
    async initialize() {}

    /**
     * Called on server shutdown. Cancel all timers, web requests etc.
     */
    async shutdown() {}

    /**
     * Map a command name to a command handeling function.
     */
    actions = {}

    /**
     * Binding to execute actions given in the actions dictionary.
     * Requires all parameters to be present to run the function mapped to the
     * command via the this.actions dictionary.
     *
     * Override this function for custom action handeling behaviour.
     * @param {array} args Array of suplied arguments.
     */
    async action(args) {
        if (args.length == 0) { return new ActionResult(1, 'Need action command'); }
        args = [...args];
        const command = args.splice(0, 1);

        let commandHandler = this.actions[command];
        if (!commandHandler) { return new ActionResult(1, `Command ${command} not found.`); }
        if (commandHandler.length != args.length) { return new ActionResult(1, `Command ${command} requires exactly ${commandHandler.length} arguments`); }

        try {
            await commandHandler(...args);
        } catch (error) {
            return new ActionResult(1, error.message || 'An unhandled error has occured during the execution of the command.');
        }

        return new ActionResult(0, 'succes', this.state);
    }

}

class ActionResult {
    constructor(code, status, state) {
        if (code === undefined) { throw new Error('ActionResult class requires a status code.'); }

        this.code = code;
        if (status) this.status = status;
        if (state) this.state = state;
    }
}

module.exports = { EventBased, ActionResult }
