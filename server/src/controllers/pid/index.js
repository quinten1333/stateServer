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
        this.args = args;

        if (this.args.inputFn && typeof this.args.inputFn !== 'function') { console.error(`[!] PID controller ${this.name} has invalid inputFn.`); process.exit(1); }
        if (this.args.outputFn && typeof this.args.outputFn !== 'function') { console.error(`[!] PID controller ${this.name} has invalid outputFn.`); process.exit(1); }
    }

    async initialize() {
        this.stateKeeper.listen.register(this.args.inputPlugin, this.args.inputInstance, this.onUpdate);
        this.tickTimer = setInterval(this.onTick, this.args.tickInterval);
    }

    async shutdown() {
        this.stateKeeper.listen.unregister(this.args.inputPlugin, this.args.inputInstance, this.onUpdate);
        clearInterval(this.tickTimer);
    }

    onUpdate = (newState) => {
        if (this.args.inputFn) {
            newState = this.args.inputFn(newState);
            if (newState === undefined) {
                return;
            }
        }

        this.values.push(newState);
    }

    onTick = () => {
        if (this.values.length === 0) {
            return;
        }

        const values = this.values;
        this.values = [];
        const avgValue = values.reduce((sum, val) => sum + val, 0) / values.length;

        const pidOutput = this.tick(avgValue);
        if (pidOutput === undefined) {return; }

        const output = this.args.outputFn ? this.args.outputFn(pidOutput) : pidOutput;
        if (output === undefined) { return; }
        if (this.prefOutput && isEqual(output, this.prefOutput)) { return; }

        this.stateKeeper.action(this.args.outputPlugin, this.args.outputInstance, output);
        this.prefOutput = output;
    }

    tick(input) {
        const error = this.args.setPoint - input;
        if (Math.abs(error) < this.args.setPoint * 0.05 && Math.abs(input - this.lastInput) < this.args.updateTreshold) {
            if (this.args.fitMode) console.log(`PID tick skipped (in: (...,${this.lastInput.toFixed(2)}, ${input.toFixed(2)}), err: ${error.toFixed(2)})`);
            return undefined;
        }

        this.integrator += this.args.ki * error;
        this.integrator = Math.max(Math.min(this.integrator, this.args.integratorMax), this.args.integratorMin);

        let inputDiff = input - this.lastInput;
        this.lastInput = input;

        const output = this.args.kp * error + this.integrator - this.args.kd * inputDiff;
        if (this.args.fitMode) console.log(`PID tick: ${input.toFixed(2)}\t${output.toFixed(2)}`);

        return output;
    }
}

module.exports = PIDController;

