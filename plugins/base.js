class EventBased {
    constructor({args, onStateChange}) {
        this.onStateChange = onStateChange;
    }

    shutdown() {}

}

module.exports = { EventBased }
