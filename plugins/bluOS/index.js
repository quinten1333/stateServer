// Documentation: https://nadelectronics.com/wp-content/uploads/2020/12/Custom-Integration-API-v1.0_Dec_2020.pdf

const { EventBased } = require('../base');

const DEFAULT_PORT = 11000;
const MIN_TIME_BETWEEN_REQUESTS = 500; // ms

const axios = require('axios').default;
const parser = require('fast-xml-parser');
const parserOptions = {
    ignoreAttributes: false
};

const parse = (data) => parser.parse(data, parserOptions, true)
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));


const getState = (status) => {
    return {
        title: status.title1,
        album: status.album,
        artist: status.artist,
        playing: status.state !== 'pause' && status.status !== 'stop',
        volume: status.volume,
        muted: status.mute !== '0' || status.volume === 0,
        spotify: status.service === 'Spotify',
        service: status.service
    }
}


class BluOSAPI extends EventBased {
    constructor(config) {
        super(config);

        this.blueosAPI = axios.create({
            baseURL: `http://${config.args.ip}:${config.args.port || DEFAULT_PORT}`,
            responseType: 'application/xml',
        });

        this.cancelRequest = axios.CancelToken.source();
        this.loop = this.startEventLoop();
    }

    onResponse(data) {
        this.state = getState(data);
        this.onStateChange(this.state);
    }

    async shutdown() {
        this.cancelRequest.cancel(); // Axio call in function throws errow which breaks the loop.

        try {
            await this.loop;
        } catch (error) {} // Axios error should be ignored.
    }

    async startEventLoop() {
        let lastRequest = Date.now();
        let responseData = parse((await this.blueosAPI.get(`/Status`, { cancelToken: this.cancelRequest.token })).data).status;
        this.onResponse(responseData);

        while (true) {
            let sleepDuration = lastRequest - Date.now() + MIN_TIME_BETWEEN_REQUESTS; // Cap at 1 request per MIN_TIME_BETWEEN_REQUESTS miliseconds
            if (sleepDuration > 0) { await sleep(sleepDuration); }

            lastRequest = Date.now();
            responseData = parse((await this.blueosAPI.get(`/Status?timeout=100&etag=${responseData['@_etag']}`, { cancelToken: this.cancelRequest.token })).data).status;
            this.onResponse(responseData);
        }
    }
}

module.exports = BluOSAPI;
