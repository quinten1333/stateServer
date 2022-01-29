const { isEqual } = require('lodash');

const { ControllerBase } = require('../base');

class PIDController extends ControllerBase {
    constructor({ stateKeeper, name, args }) {
        super();
        this.stateKeeper = stateKeeper;
        this.values = [];
        this.tickTimer = null;

        this.name = name;
        this.readConfig(args);

        this.integrator = 0;
        this.lastInput = 0;
    }

    readConfig = (args) => {
        this.tickInterval = args.tickInterval;
        this.inputPlugin = args.inputPlugin;
        this.inputInstance = args.inputInstance;
        this.inputFn = args.inputFn;
        this.outputPlugin = args.outputPlugin;
        this.outputInstance = args.outputInstance;
        this.outputFn = args.outputFn;

        if (typeof this.inputFn !== 'function') { console.error(`[!] PID controller ${this.name} has invalid inputFn. Crash is immenent.`); }
        if (typeof this.outputFn !== 'function') { console.error(`[!] PID controller ${this.name} has invalid outputFn. Crash is immenent.`); }

        this.kp = args.kp;
        this.ki = args.ki;
        this.kd = args.kd;
        this.integratorMin = args.integratorMin;
        this.integratorMax = args.integratorMax;
        this.setPoint = args.setPoint;
        this.fitMode = args.fitMode;
    }

    async initialize() {
        this.stateKeeper.listen.register(this.inputPlugin, this.inputInstance, this.onUpdate);
        this.tickTimer = setInterval(this.onTick, this.tickInterval);
    }

    async shutdown() {
        this.stateKeeper.listen.unregister(this.inputPlugin, this.inputInstance, this.onUpdate);
        clearInterval(this.tickTimer);
    }

    onUpdate = (newState) => {
        if (typeof this.inputFn === 'function') {
            newState = this.inputFn(newState);
            if (newState === undefined) {
                return;
            }
        }

        this.values.push(newState);
    }

    onTick = () => {
        if (this.values.length === 0) {
            console.log('Missed pid tick because of lack of data');
            return;
        }

        const values = this.values;
        this.values = [];
        const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        const output = this.outputFn(this.tick(avgValue));
        if (this.prefOutput && isEqual(output, this.prefOutput)) { return; }

        this.stateKeeper.action(this.outputPlugin, this.outputInstance, output);
        this.prefOutput = output;
    }

    tick(input) {
        const error = this.setPoint - input;
        this.integrator += this.ki * error;
        this.integrator = Math.max(Math.min(this.integrator, this.integratorMax), this.integratorMin);

        let inputDiff = input - this.lastInput;
        this.lastInput = input;

        const output = this.kp * error + this.integrator - this.kd * inputDiff;
        if (this.fitMode) console.log('PID tick: ', input, output);

        return output;
    }
}

module.exports = PIDController;

