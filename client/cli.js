#!/bin/env node

const IF_REGEX = /^([^:]+)\?([^:]*):([^:]*)$/;

const parseCode = (string, state) => {
    if (!string || !state) { throw new Error('Invalid args. ' + string + ' ' + state); }

    const shorthandIf = IF_REGEX.exec(string);
    if (shorthandIf) {
        const [condition, trueVal, falseVal] = shorthandIf.slice(1, 4);

        return parseString(state[condition] ? trueVal : falseVal, state);
    }

    let key = string.split('.');

    let value = state;
    for (let part of key) {
        try {
            value = value[part];
        } catch (e) {
            console.error(string, ' is not an existing key in the state');
            return undefined;
        }
    }

    if (typeof(value) === 'object') {
        return JSON.stringify(value);
    }

    return value;
}

const parseString = (string, state) => {
    if (typeof string !== 'string' || !state) { throw new Error('Invalid args. ' + string + ' ' + state); }


    let depth = 0;
    let startIndex = string.indexOf('[');
    let i = startIndex;
    let result = string.substring(0, startIndex);
    while (startIndex >= 0) {
        let char = string[i];
        if (char === '[') depth += 1;
        if (char === ']') depth -= 1;
        i++;

        if (depth !== 0) { continue; }

        result += parseCode(string.substring(startIndex + 1, i - 1), state);
        startIndex = string.indexOf('[', i);
        i = startIndex;
    }

    result += string.substring(string.lastIndexOf(']') + 1);

    return result;
}

const args = require('yargs')(process.argv)
    .command('<plugin> <instance> status <format>', 'Get the status of an instance.')
    .command('<plugin> <instance> action [...args]', 'Execute an action')
    .option('tail', { description: 'Subscribe to status updates.', alias: 't' })
    .demandCommand(4)
    .help()
    .argv;

args._.splice(0, 2);
const [plugin, instance, command] = args._.splice(0, 3);
let stateServerAPI;

const commands = {
    status: async () => {
        const callback = (state) => {
            try {
                console.log(args._.length > 0 ? parseString(args._[0], state) : state);
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
