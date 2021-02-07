#!/bin/env node

const PARSE_REGEX = /%([^%]+)%([^%]*)/g;

const parse = (string, state) => {
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
    .help()
    .argv;

const stateServerAPI = require('./msgLib');

stateServerAPI.subscribe('bluOS', 'streamer', (state) => {
    if (!state.playing) { console.log(args['no-play-text']); return 0; }

    console.log(parse(args._[2], state));
});
