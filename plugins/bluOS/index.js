// Documentation: https://nadelectronics.com/wp-content/uploads/2020/12/Custom-Integration-API-v1.0_Dec_2020.pdf

const { EventBased } = require('../base');

const DEFAULT_PORT = 11000;
const MIN_TIME_BETWEEN_REQUESTS = 500; // ms
const TIMEOUT = 100; // S

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
        muted: status.mute === 1 || status.volume === 0,
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
        await this.loop;
    }

    async startEventLoop() {
        let lastRequest;
        let responseData;

        while (true) {
            let sleepDuration = lastRequest - Date.now() + MIN_TIME_BETWEEN_REQUESTS; // Cap at 1 request per MIN_TIME_BETWEEN_REQUESTS miliseconds
            if (sleepDuration > 0) { await sleep(sleepDuration); }

            lastRequest = Date.now();
            try {
                responseData = parse((await this.blueosAPI.get(`/Status?${responseData ? `timeout=${TIMEOUT}&etag=${responseData['@_etag']}` : ''}`, { cancelToken: this.cancelRequest.token, timeout: (TIMEOUT + 10) * 1000 })).data).status;
            } catch (error) {
                if (axios.isCancel(error)) { break; }
                if (error.code === 'ENETUNREACH') { // ENETUNREACH -> Network unreachable;
                    await sleep(5000);
                    continue;
                }

                console.error(error);
                continue;
            }

            this.onResponse(responseData);
        }
    }

    actions = {
        play: () => this.blueosAPI.get('/Play'),
        seek: (seconds) => blueosAPI.get(`/Play?seek=${seconds}`),
        pause: () => this.blueosAPI.get('/Pause'),
        toggle: () => this.blueosAPI.get('/Pause?toggle=1'),
        skip: () => this.blueosAPI.get('/Skip'),
        back: () => this.blueosAPI.get('/Back'),
        shuffle: (state) => this.blueosAPI.get(`/Shuffle?state=${state}`), // state is bool if shuffle is on or not.
        repeat: (state) => this.blueosAPI.get(`/Repeat?state=${state}`), // 0: Repeat queue. 1: Repeat track. 2: Do not repeat.
        mute: () => {
            this.state.muted = !this.state.muted;
            return this.blueosAPI.get(`/Volume?mute=${this.state.muted ? '1' : '0'}`);
        },
        volume: (levelStr) => { // Level is percentage of max volume.
            let level = parseInt(levelStr);
            if (isNaN(level)) { throw new Error('Given level is not a integer'); }

            if (/^(\+|\-)/.test(levelStr)) {
                level = this.state.volume + level;
            }

            this.state.volume = level;
            return this.blueosAPI.get(`/Volume?level=${level}`)
        },

        // Custom not documented functions.
        playSource: (source) => this.blueosAPI.get(`/Play?url=${source}`) // Get source "url" from `/RadioBrowse?service=Capture`
    }
}

module.exports = BluOSAPI;
