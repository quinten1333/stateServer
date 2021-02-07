#!/bin/env node

const PARSE_REGEX = /%([^%]+)%([^%]*)/g;

const parse = (string, state) => {
    if (!string || !state) { return ['Invalid args.', string, state]; }

    let result = string.split('%', 2)[0]; // Get head of the string.
    let parsed;
    while (parsed = PARSE_REGEX.exec(string)) {
        const newVal = state[parsed[1]];
        if (newVal === undefined) { console.log(`Attribute ${parsed[1]} unkown.`); return 1; }

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
            console.log(parse(args._[0], state));
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
        const response = await stateServerAPI.action(plugin, instance, process.argv.slice(4));
        stateServerAPI.end();
        console.log(response.status);
        process.exitCode = response.code;
    }
}

if (!commands[command]) {
    console.log(`Command ${command} is unkown.`);
    process.exit(1);
}

stateServerAPI = require('./msgLib');
commands[command]().then((statusCode) => {
    process.exitCode = statusCode;
})
