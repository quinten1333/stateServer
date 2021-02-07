#!/bin/env node

const PARSE_REGEX = /%([^%]+)%([^%]*)/g;
const IF_REGEX = /^([^:]+):([^:]+):([^:]+)$/;
const STRING_REGEX = /'(.*)'/;

const parse = (string, state) => {
    if (!string || !state) { throw new Error('Invalid args.' + string + state.toString()); }

    let result = string.split('%', 2)[0]; // Get head of the string.
    let parsed, shorthandIf;
    while (parsed = PARSE_REGEX.exec(string)) {
        let varName = parsed[1];
        if (shorthandIf = IF_REGEX.exec(varName)) {
            const [condition, trueVal, falseVal] = shorthandIf.slice(1, 4);
            varName = state[condition] ? trueVal : falseVal;

            if (STRING_REGEX.test(varName)) {
                result += varName.substring(1, varName.length - 1) + parsed[2];
                continue;
            }
        }

        const newVal = state[varName];
        if (newVal === undefined) { throw new Error(`Attribute ${varName} unkown.`); }

        result += newVal + parsed[2]; // Insert parsed value and possible text behind.
    }

    return result;
}

const args = require('yargs')(process.argv)
    .command('<plugin> <instance> status <format>', 'Get the status of an instance.')
    .command('<plugin> <instance> action [...args]', 'Execute an action')
    .option('tail', { description: 'Subscribe to status updates.', alias: 't' })
    .demandCommand(5)
    .help()
    .argv;

args._.splice(0, 2);
const [plugin, instance, command] = args._.splice(0, 3);
let stateServerAPI;

const commands = {
    status: async () => {
        if (args._.length != 1) { console.error('Status requires exectly one argument.'); return 1; }

        const callback = (state) => {
            try {
                console.log(parse(args._[0], state));
            } catch (error) {
                console.error(error.message);
                stateServerAPI.end();
            }
        };

        if (!args.tail) {
            stateServerAPI.get(plugin, instance)
                .then(callback)
                .then(stateServerAPI.end);

            return 0;
        }

        stateServerAPI.subscribe(plugin, instance, callback);
        return 0;
    },

    action: async () => {
        const response = await stateServerAPI.action(plugin, instance, args._);
        stateServerAPI.end();
        console.log(response)
        console.log(response.status);
        return response.code;
    }
}

if (!commands[command]) {
    console.log(`Command ${command} is unkown.`);
    process.exit(1);
}

stateServerAPI = require('./msgLib');
process.on('SIGINT', () => {
    stateServerAPI.end();
});


commands[command]().then((statusCode) => {
    process.exitCode = statusCode;
})
