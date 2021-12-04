const lifxAPI = require('./LifxAPI');
const { isEqual } = require('lodash')
const { promisify } = require('util');

const { EventBased } = require('../base');

class LifxLight extends EventBased { // TODO: Keep ambient light at a certain level
    constructor(config) {
        super(config);

        this.identifier = config.args.identifier;
        this.fadeDuration = config.args.fadeDuration || 1;
        this.pullInterval = config.args.pullInterval || 5000;
        this.light = null;
        this.tries = 0;
        this.state = null;
    }

    initialize = async () => {
        await promisify(this.getLight)();
        this.timer = setInterval(this.getState, this.pullInterval);
    }

    shutdown = async () => {
        clearInterval(this.timer);
    }

    getLight = (callback = (err) => {throw err}) => {
        this.light = lifxAPI.getLight(this.identifier);
        if (!this.light) {
            if (this.tries > 10) {
                callback(`Could not find light ${this.identifier}.`);
                return;
            }

            this.tries += 1;
            setTimeout(this.getLight, 1000, callback);
            return;
        }

        this.tries = 0;
        callback();
    }

    lightAction = async (command, args = []) => {
        if (this.light.status !== 'on') {
            await new Promise((resolve, reject) => this.getLight((err) => err ? reject(err) : resolve()));
        }

        return new Promise((resolve, reject) => {
            this.light[command](...args, (err, value) => {
                if (err) { reject(err); return; }

                resolve(value);
            });
        });
    }

    getState = async () => {
        const newState = await this.lightAction('getState');

        if (!isEqual(this.state, newState)) {
            this.onStateChange(newState);
        }

        this.state = newState;
    }

    actions = {
        on: async () => {
            await this.lightAction('on', [this.fadeDuration]);
        },
        off: async () => {
            await this.lightAction('off', [this.fadeDuration]);
        },
        color: async (hue, saturation, brightness, kelvin) => {
            await this.lightAction('color', [hue, saturation, brightness, kelvin, this.fadeDuration]);
        },
    }

}

module.exports = LifxLight;
