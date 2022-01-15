const fs = require('fs').promises;
const path = require('path')

const { EventBased } = require('../base');

const fileExists = async (path) => {
    try {
        await fs.access(path);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Simple storage class which stores data in a dictionary as strings on shutdown.
 * And loads the previous values from disk on startup.
 */
class JsonStorage extends EventBased {
    constructor(config) {
        super(config);

        this.name = config.name;
        this.inMemmory = config.args.inMemmory;
        this.state = {};
    }

    async initialize() {
        this.storagePath = path.resolve(__dirname, `storage/${this.name}.json`);
        if (!this.inMemmory && await fileExists(this.storagePath)) {
            this.state = JSON.parse(await fs.readFile(this.storagePath));
            this.onStateChange(this.state);
        }
    }

    async shutdown() {
        if (this.inMemmory) { return; }

        await fs.writeFile(this.storagePath, JSON.stringify(this.state));
    }

    actions = {
        set: (key, value) => {
            key = key.split('.');

            let cursor = this.state;
            for (let part of key.slice(0, -1)) {
                if (!(part in cursor)) {
                    cursor[part] = {};
                }

                cursor = cursor[part];
            }

            cursor[key[key.length - 1]] = JSON.parse(value);
            this.onStateChange(this.state);
        }
    }
}

module.exports = JsonStorage;

