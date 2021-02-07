const net = require('net');
const readline = require("readline");
const conf = require('../config').server;

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const question = () => new Promise((resolve) => rl.question('', resolve))

const client = new net.Socket();
client.connect(conf.listen, async () => {
    console.log('Connected');

    while (true) {
        client.write(await question());
    }
});

client.on('data', function(data) {
	console.log('Received: ' + data);
});

client.on('close', function() {
	console.log('Connection closed');
});
