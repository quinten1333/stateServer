#!/bin/env node

if (process.argv.length < 5) {
    console.error('Need at least 3 arguments: <plugin> <instance> <command>');
    process.exit(1);
}

const stateServerAPI = require('./msgLib');

const main = async () => {
    const [plugin, instance] = process.argv.slice(2, 4);
    const response = await stateServerAPI.action(plugin, instance, process.argv.slice(4));
    stateServerAPI.end();
    console.log(response.status);
    process.exitCode = response.code;
}

main();
