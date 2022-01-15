const { ControllerBase } = require('../base');

class PIDController extends ControllerBase {
    constructor({ stateKeeper, name, args }) {
        super();
        this.stateKeeper = stateKeeper;

        this.inputPlugin = args.inputPlugin;
        this.inputInstance = args.inputInstance;
        this.inputFn = args.inputFn;
        this.outputPlugin = args.outputPlugin;
        this.outputInstance = args.outputInstance;
        this.outputFn = args.outputFn;

        if (typeof this.inputFn !== 'function') { console.error(`[!] PID controller ${name} has invalid inputFn. Crash is immenent.`); }
        if (typeof this.outputFn !== 'function') { console.error(`[!] PID controller ${name} has invalid outputFn. Crash is immenent.`); }

        this.kp = args.kp;
        this.ki = args.ki;
        this.kd = args.kd;
        this.setPoint = args.setPoint;

        this.integrator = 0;
        this.lastInput = 0;
    }

    async initialize() {
        this.stateKeeper.listen.register(this.inputPlugin, this.inputInstance, this.onUpdate);
    }

    async shutdown() {
        this.stateKeeper.listen.unregister(this.inputPlugin, this.inputInstance, this.onUpdate);
    }

    onUpdate = (newState) => {
        if (typeof this.inputFn === 'function') {
            newState = this.inputFn(newState);
        }

        this.tick(newState);
    }

    tick(input) {
        const error = this.setPoint - input;
        this.integrator += this.ki * error;

        let inputDiff = input - this.lastInput;
        this.lastInput = input;

        const output = this.kp * error + this.integrator - this.kd * inputDiff;
        console.log('PID tick: ', input, output);

        this.output(output);
    }


    output(output) {
        this.stateKeeper.action(this.outputPlugin, this.outputInstance, this.outputFn(output))
    }
}

module.exports = PIDController;

