const lifxAPI = require('./LifxAPI');
const { isEqual } = require('lodash')
const { promisify } = require('util');

const { EventBased } = require('../base');

class LifxLight extends EventBased {
    constructor(config) {
        super(config);

        this.identifier = config.args.identifier;
        this.fadeDuration = config.args.fadeDuration || 1;
        this.pullInterval = config.args.pullInterval || 5000;
        this.retryInterval = config.args.retryInterval || 600000;
        this.light = null;
        this.tries = 0;
        this._state = null;
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
        clearTimeout(this.lightTimer);
        clearInterval(this.stateTimer);
    }

    getLight = (callback = (err) => { throw err }) => {
        this.light = lifxAPI.getLight(this.identifier);
        if (!this.light) {
            if (this.tries > 10) {
                callback(`Could not find light ${this.identifier}.`);
                this.lightTimer = setTimeout(this.getLight, this.retryInterval, callback);
                return;
            }

            this.tries += 1;
            this.lightTimer = setTimeout(this.getLight, 1000 * this.tries, callback);
            return;
        }

        this.tries = 0;
        this.stateTimer = setInterval(this.getState, this.pullInterval);
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
        let newState;
        try {
            newState = await this.lightAction('getState');
        } catch (error) {
            console.log(`[!] ${this.identifier}: Could not retrieve light state`);
            return;
        }
        if (isEqual(this.state, newState)) { return; }

        this.state = newState;
    }

    get state() {
        return this._state || { color: { hue: 0, saturation: 0, brightness: 0, kelvin: 3000 }, power: 0, label: '' };
    }

    set state(newState) {
        this.onStateChange(newState);
        this._state = newState;
    }

    actions = {
        on: async () => {
            await this.lightAction('on', [this.fadeDuration]);
            this.state = { ...this.state, power: 1 };
        },
        off: async () => {
            await this.lightAction('off', [this.fadeDuration]);
            this.state = { ...this.state, power: 0 };
        },
        toggle: async () => {
            if (this.state.power) {
                await this.lightAction('off', [this.fadeDuration]);
                this.state = { ...this.state, power: 0 };
            } else {
                await this.lightAction('on', [this.fadeDuration]);
                this.state = { ...this.state, power: 1 };
            }
        },

        color: async (hue, saturation, brightness, kelvin) => {
            await this.lightAction('color', [hue, saturation, brightness, kelvin, this.fadeDuration]);
            this.state = { ...this.state, color: { hue, saturation, brightness, kelvin } };

        },
        brightness: async (brightnessStr) => {
            let brightness = parseInt(brightnessStr);
            if (isNaN(brightness)) { throw new Error('Given level is not a integer'); }

            if (/^(\+|\-)/.test(brightnessStr)) {
                brightness = this.state.color.brightness + brightness;
            }

            brightness = Math.max(Math.min(brightness, 100), 0);
            await this.lightAction('color', [this.state.color.hue, this.state.color.saturation, brightness, this.state.color.kelvin, 0]);
            this.state = { ...this.state, color: { ...this.state.color, brightness } };
        }
    }

}

module.exports = LifxLight;
