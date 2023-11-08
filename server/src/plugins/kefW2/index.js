// Documentation: https://github.com/N0ciple/pykefcontrol/blob/main/pykefcontrol/kef_connector.py

const { EventBased } = require('../base');

const DEFAULT_PORT = 80;
const MIN_TIME_BETWEEN_REQUESTS = 500; // ms
const TIMEOUT = 100; // S

const axios = require('axios').default;
const sleep = (time) => new Promise((resolve) => setTimeout(resolve, time));
/*
Known paths:
  {"path": "settings:/mediaPlayer/playMode", "type": "itemWithValue"},
  {"path": "playlists:pq/getitems", "type": "rows"},
  {"path": "notifications:/display/queue", "type": "rows"},
  {"path": "settings:/kef/host/maximumVolume", "type": "itemWithValue"},
  {"path": "player:volume", "type": "itemWithValue"},
  {"path": "kef:fwupgrade/info", "type": "itemWithValue"},
  {"path": "settings:/kef/host/volumeStep", "type": "itemWithValue"},
  {"path": "settings:/kef/host/volumeLimit", "type": "itemWithValue"},
  {"path": "settings:/mediaPlayer/mute", "type": "itemWithValue"},
  {"path": "settings:/kef/host/speakerStatus", "type": "itemWithValue"},
  {"path": "settings:/kef/play/physicalSource", "type": "itemWithValue"},
  {"path": "player:player/data", "type": "itemWithValue"},
  {"path": "kef:speedTest/status", "type": "itemWithValue"},
  {"path": "network:info", "type": "itemWithValue"},
  {"path": "kef:eqProfile", "type": "itemWithValue"},
  {"path": "settings:/kef/host/modelName", "type": "itemWithValue"},
  {"path": "settings:/version", "type": "itemWithValue"},
  {"path": "settings:/deviceName", "type": "itemWithValue"},
*/
const PATHS = [
  { path: 'player:volume', type: 'itemWithValue' },
  { path: 'player:player/data', type: 'itemWithValue' },
]

class W2API extends EventBased {
  constructor(config) {
    super(config);
    this.queueId = null;

    this.speaker = axios.create({
      baseURL: `http://${config.args.ip}:${config.args.port || DEFAULT_PORT}`,
      responseType: 'application/json',
    });

    this.cancelRequest = axios.CancelToken.source();

    this.state = {
      title: '',
      album: '',
      artist: '',
      playing: false,
      volume: 0,
      muted: false,
      service: '',
      image: '',
    };

    this.register().then(() => {
      this.getData('player:player/data').then((event) => this.events['player:player/data'](event));
      this.getData('player:volume').then((event) => this.events['player:volume'](event[0]));
      this.loop = this.startEventLoop();
    });
  }

  events = {
    'player:volume': (event) => {
      const newVolume = event['i32_'];
      if (newVolume === this.state.volume) {
        return false;
      }

      this.state.volume = newVolume;
      return true;
    },

    'player:player/data': (event) => {
      let change = false;
      const playing = event.state === 'playing';

      if (playing && this.state.playing !== playing) {
        this.state.playing = playing;
        change = true;
      }

      if (event.trackRoles?.mediaData) {
        const { icon: image, title, mediaData } = event.trackRoles;
        const { artist, album, serviceID: service } = mediaData.metaData;
        if (image && this.state.image !== image) {
          this.state.image = image;
          change = true;
        }

        if (title && this.state.title !== title) {
          this.state.title = title;
          change = true;
        }

        if (artist && this.state.artist !== artist) {
          this.state.artist = artist;
          change = true;
        }

        if (album && this.state.album !== album) {
          this.state.album = album;
          change = true;
        }

        if (service && this.state.service !== service) {
          this.state.service = service;
          change = true;
        }
      }

      return change;
    }
  }

  onResponse(events) {
    events.reverse(); // Newest til oldest
    let change = false;

    const volume = events.find((event) => event.path === 'player:volume');
    if (volume?.itemValue) {
      change = this.events['player:volume'](volume.itemValue);
    }

    const playerData = events.find((event) => event.path === 'player:player/data');
    if (playerData?.itemValue) {
      const changed = this.events['player:player/data'](playerData.itemValue);
      if (changed) change = true;
    }

    if (change) this.onStateChange(this.state);
  }

  async shutdown() {
    this.cancelRequest.cancel(); // Axio call in function throws errow which breaks the loop.
    await this.loop;
    await this.deregister();
  }

  async register() {
    this.queueId = (await this.speaker.post('/api/event/modifyQueue', {
      subscribe: PATHS,
      unsubscribe: [],
    }))?.data;
  }

  async deregister() {
    this.queueId = (await this.speaker.post('/api/event/modifyQueue', {
      subscribe: [],
      unsubscribe: PATHS,
    }))?.data;
  }

  async startEventLoop() {
    let lastRequest;
    let responseData;

    while (true) {
      let sleepDuration = lastRequest - Date.now() + MIN_TIME_BETWEEN_REQUESTS; // Cap at 1 request per MIN_TIME_BETWEEN_REQUESTS miliseconds
      if (sleepDuration > 0) { await sleep(sleepDuration); }

      lastRequest = Date.now();
      try {
        responseData = (await this.speaker.get('/api/event/pollQueue', { params: { queueId: this.queueId, timeout: TIMEOUT }, cancelToken: this.cancelRequest.token, timeout: (TIMEOUT + 10) * 1000 }))?.data;
      } catch (error) {
        if (axios.isCancel(error)) { break; }
        if (error.code === 'ENETUNREACH') { // ENETUNREACH -> Network unreachable;
          await sleep(5000);
          continue;
        }

        if (error.isAxiosError) {
          console.error(error.response.data);
        } else {
          console.error(error);
        }
        continue;
      }

      this.onResponse(responseData);
    }
  }

  /**
   * Get the current value of a path.
   */
  async getData(path) {
    return (await this.speaker.get('/api/getData', {
      params: {
        path: path,
        roles: 'value'
      }
    }))?.data;
  }

  async setData(path, value, roles='value') {
    return (await this.speaker.get('/api/setData', {
      params: {
        path: path,
        roles: roles,
        value: value,
      }
    }))?.data;
  }

  actions = {
    play: () => this.setData('player:player/control', { command: 'play' }, 'activate'), // TODO: Does not work
    pause: () => this.setData('player:player/control', { command: 'pause' }, 'activate'),
    toggle: () => { if (this.state.playing) return this.actions.pause(); else return this.actions.play() },
    skip: () => this.setData('player:player/control', { command: 'next' }, 'activate'), // TODO: Does not work
    back: () => this.setData('player:player/control', { command: 'previous' }, 'activate'), // TODO: Does not work
    mute: () => {
      if (this.previousVolume > 0) {
        this.actions.volume(this.previousVolume);
        this.previousVolume = null;
      } else {
        this.previousVolume = this.state.volume;
        this.actions.volume(0);
      }
    },
    volume: async (levelStr) => { // Level is percentage of max volume.
      let level = parseInt(levelStr);
      if (isNaN(level)) { throw new Error('Given level is not a integer'); }

      if (/^(\+|\-)/.test(levelStr)) {
        level = this.state.volume + level;
      }

      this.state.volume = level;
      const res = await this.setData('player:volume', { type: 'i32_', 'i32_': level });
      this.onStateChange(this.state);
      return res;
    },

    // Speaker source : standby (not powered on),
    // wifi, bluetooth, tv, optic, coaxial or analog
    playSource: (source) => this.setData('settings:/kef/play/physicalSource', { type: 'kefPhysicalSource', kefPhysicalSource: source }),
  }
}

module.exports = W2API;
