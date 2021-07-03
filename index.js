const fs = require('fs/promises');

const stateKeeper = require('./stateKeeper');
const { closeAll } = require('./server/lib/Connection');

const JS_FILE_REGEX = /.js$/;

const servers = [];

const onExit = async (event) => {
    if (event instanceof Error) console.log('uncaughtException')

    console.log("Shutting down.");

    closeAll();
    for (const server of servers) {
        await server.shutdown();
    }

    await stateKeeper.shutdown();
    console.log('Shut down.');

    if (event instanceof Error) {
        console.error(event);
        process.exitCode = 1;
    }
};

['SIGINT', 'SIGTERM', 'SIGUSR2', 'uncaughtException'].forEach((event) => {
    process.once(event, onExit);
})

const main = async () => {
    const dir = await fs.readdir('./server', { withFileTypes: true });
    for (const file of dir) {
        if (!file.isFile() || !JS_FILE_REGEX.test(file.name)) { continue; }

        const server = require(`./server/${file.name}`);
        if (typeof server.initialize !== 'function' || typeof server.shutdown !== 'function') {
            console.error(`File ${file.name} does not have a initialize and shutdown method!`);
            continue;
        }

        server.initialize();
        servers.push(server);
    }

    console.log('All servers initialized.');
}

main();
