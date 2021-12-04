const LifxClient = require('lifx-lan-client').Client;

class LifxAPI {
    constructor() {
        this.client = new LifxClient();
        this.client.init();
    }

    getLight = (label) => {
        return this.client.light(label);
    }
}

module.exports = (() => new LifxAPI())(); // Make it a singleton.
