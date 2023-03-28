#!/bin/env node

const StateServerAPI = require('./msgLib');

const IF_REGEX = /^([^:]+)\?([^:]*):([^:]*)$/;

const getNestedValue = (key, state) => {
    key = key.split('.');

    let value = state;
    for (let part of key) {
        try {
            value = value[part];
        } catch (e) {
            console.error(key.join('.'), ' is not an existing key in the state');
            return undefined;
        }
    }

    return value;
}

const parseCode = (string, state) => {
    if (!string || !state) { throw new Error('Invalid args. ' + string + ' ' + state); }

    const shorthandIf = IF_REGEX.exec(string);
    if (shorthandIf) {
        const [condition, trueVal, falseVal] = shorthandIf.slice(1, 4);

        return parseString(getNestedValue(condition.trim(), state) ? trueVal : falseVal, state);
    }

    let value = getNestedValue(string, state);
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
    while (startIndex >= 0 && i < string.length) {
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

const main = async () => {
    const args = require('yargs')(process.argv)
        .command('<plugin> <instance> status <format>', 'Get the status of an instance.')
        .command('<plugin> <instance> action [...args]', 'Execute an action')
        .command('<controller> <instance> update key value', 'Update a controllers config')
        .option('tail', { description: 'Subscribe to status updates.', alias: 't' })
        .option('host', { description: 'Hostname of server to connect to', alias: 'h', default: '192.168.1.11' })
        .option('port', { description: 'Port on which the stateserver is running', alias: 'p', default: 2000, type: 'number'})
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
                    stateServerAPI.close();
                }
            };

            if (!args.tail) {
                stateServerAPI.get(plugin, instance)
                    .then(callback)
                    .then(stateServerAPI.close);

                return 0;
            }

            stateServerAPI.subscribe(plugin, instance, callback);
            return 0;
        },

        action: async () => {
            const response = await stateServerAPI.action(plugin, instance, args._);
            stateServerAPI.close();
            console.log(response.status);
            return response.code;
        },

        update: async () => {
            const response = await stateServerAPI.controllerUpdate(plugin, instance, args._[0], args._[1]);
            stateServerAPI.close();
            console.log(response.status);
            return response.code;
        }
    }

    if (!commands[command]) {
        console.log(`Command ${command} is unkown.`);
        process.exitCode = 1;
        return;
    }

    try {
        stateServerAPI = await StateServerAPI({
            port: args.port,
            host: args.host
        });
    } catch (error) {
        console.error(`${error.code}: ${error.address}:${error.port}`);
        process.exitCode = 1;
        return;
    }

    process.on('SIGINT', () => {
        stateServerAPI.close();
    });

    commands[command]().then((statusCode) => {
        process.exitCode = statusCode;
    });
}

main();
