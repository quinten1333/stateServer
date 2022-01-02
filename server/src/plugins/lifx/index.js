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
        this.retryInterval = config.args.retryInterval || 600000;
        this.light = null;
        this.tries = 0;
        this.state = null;
    }

    initialize = async () => {
        try {
            await promisify(this.getLight)();
        } catch (error) {
            console.error(`Initializing lifx light ${this.identifier} failed.`);
            console.error(error);
            return;
        }
    }

    shutdown = async () => {
        lifxAPI.shutdown();
        clearTimeout(this.timer);
    }

    getLight = (callback = (err) => { throw err }) => {
        this.light = lifxAPI.getLight(this.identifier);
        if (!this.light) {
            if (this.tries > 10) {
                callback(`Could not find light ${this.identifier}.`);
                setTimeout(this.getLight, this.retryInterval, callback);
                return;
            }

            this.tries += 1;
            setTimeout(this.getLight, 1000 * this.tries, callback);
            return;
        }

        this.tries = 0;
        if (!this.timer) {
            this.timer = setInterval(this.getState, this.pullInterval);
        }
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
        toggle: async () => {
            if (this.state.power) {
                await this.lightAction('off', [this.fadeDuration]);
            } else {
                await this.lightAction('on', [this.fadeDuration]);
            }
        },

        color: async (hue, saturation, brightness, kelvin) => {
            await this.lightAction('color', [hue, saturation, brightness, kelvin, this.fadeDuration]);
        },
        brightness: async (brightnessStr) => {
            let brightness = parseInt(brightnessStr);
            if (isNaN(brightness)) { throw new Error('Given level is not a integer'); }

            if (/^(\+|\-)/.test(brightnessStr)) {
                brightness = this.state.color.brightness + brightness;
            }

            brightness = Math.max(Math.min(brightness, 100), 0);
            await this.lightAction('color', [this.state.color.hue, this.state.color.saturation, brightness, this.state.color.kelvin, 0]);
        }
    }

}

module.exports = LifxLight;
