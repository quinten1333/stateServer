const LifxClient = require('lifx-lan-client').Client;

class LifxAPI {
    constructor() {
        this.client = new LifxClient();
        this.client.init();
        this.running = true;
    }

    getLight = (label) => {
        return this.client.light(label);
    }

    shutdown = () => {
        if (!this.running) { return; }

        this.client.destroy();
        this.running = false;
    }
}

module.exports = (() => new LifxAPI())(); // Make it a singleton.
