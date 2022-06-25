class Callbacks {
  constructor(state) {
    this.state = state;
    this.callbacks = {};
  }

  add(plugin, instance, callback) {
    if (!this.callbacks[plugin]) this.callbacks[plugin] = {};
    if (!this.callbacks[instance]) this.callbacks[plugin][instance] = [];

    if (this.state[plugin] && this.state[plugin][instance]) {
      callback(this.state[plugin][instance])
    }

    this.callbacks[plugin][instance].push(callback);
  }

  remove(plugin, instance, callback) {
    const index = this.callbacks[plugin][instance].indexOf(callback);
    if (index < 0) { throw new Error('Callback not found!'); }

    this.callbacks[plugin][instance].splice(index, 1);
  }

  call(plugin, instance, data) {
    for (const callback of this.callbacks[plugin][instance]) {
      callback(data);
    }
  }

  active(plugin, instance) {
    return this.callbacks[plugin] &&
      this.callbacks[plugin][instance] &&
      this.callbacks[plugin][instance].length > 0;
  }

  getSubscriptions() {
    const result = [];
    for (const plugin in this.callbacks) {
      for (const instance in this.callbacks[plugin]) {
        result.push([plugin, instance]);
      }
    }

    return result;
  }
}

class OneTimeCallback {
  constructor() {
    this.callbacks = {};
  }

  add(callback) {
    const id = OneTimeCallback.id++;
    this.callbacks[id] = callback;
    return id;
  }

  remove(id) {
    delete this.callbacks[id];
  }

  call(id, data) {
    this.callbacks[id](data);
    this.remove(id);
  }
}
OneTimeCallback.id = 1;

/**
 *
 * @param {Function} socketCreationFn Function that returns a connecting socket.
 * @param {Number} pingInterval Ping interval in miliseconds
 * @returns api object
 */
const apiLib = (async (socketCreationFn, pingInterval = 5000) => {
  if (typeof socketCreationFn !== 'function') {
    throw new Error('First argument of apiLib should be a function which returns a socket')
  }

  let socket;
  const state = {};
  const callbacks = new Callbacks(state);
  const oneTimeCallbacks = new OneTimeCallback();
  let heartbeatInterval;

  let lastMessage = Date.now();
  const heartbeat = async () => {
    if (Date.now() - lastMessage > pingInterval) {
      sendPayload({ command: 'ping' });

      if (Date.now() - lastMessage > 3 * pingInterval) {
        connect();
      }
    }
  }

  const processMessage = (message) => {
    message = JSON.parse(message);
    const { data, type } = message;

    lastMessage = Date.now();
    switch (type) {
      case 'pong':
        // lastMessage is updated above.
        break;
      case 'stateUpdate':
        state[message.plugin][message.instance] = data;
        callbacks.call(message.plugin, message.instance, data)
        break;

      case 'getResponse':
      case 'actionResponse':
        if (!message.id) { console.error('Received one time response with no id!'); return; }
        oneTimeCallbacks.call(message.id, data);
        break;

      case 'error':
        console.error('Error', data);
        if (message.id) {
          oneTimeCallbacks.call(message.id, new Error(data));
        }
        break;

      default:
        console.error('Received unkown type', data.type);
        return;
    }
  };

  let connecting = false;
  let connect = async () => {
    if (connecting) {
      throw new Error('Tried to connect multiple times');
    }

    connecting = true;
    let wasConnected = !!socket;
    if (wasConnected) {
      heartbeatInterval = clearInterval(heartbeatInterval);
      socket.close();
    }

    socket = await socketCreationFn();
    lastMessage = Date.now();
    socket.on('data', processMessage);

    if (wasConnected) {
      for (const [plugin, instance] of callbacks.getSubscriptions()) {
        sendPayload({ command: 'subscribe', plugin, instance });
      }
    }

    connecting = false;
    heartbeatInterval = setInterval(heartbeat, pingInterval);
  }

  const sendPayload = (payload) => socket.send(JSON.stringify(payload) + '\n');

  await connect();

  return {
    subscribe: (plugin, instance, callback) => {
      if (!state[plugin]) { state[plugin] = {}; }

      callbacks.add(plugin, instance, callback);
      if (state[plugin] && state[plugin][instance]) { return }

      sendPayload({ command: 'subscribe', plugin, instance });
    },

    unsubscribe: (plugin, instance, callback) => {
      callbacks.remove(plugin, instance, callback);
      if (callbacks.active(plugin, instance)) { return; }

      sendPayload({ command: 'unsubscribe', plugin, instance });
      delete state[plugin][instance];
    },

    get: (plugin, instance) => {
      return new Promise((resolve) => {
        const id = oneTimeCallbacks.add(resolve);
        sendPayload({ command: 'get', plugin, instance, id });
      });
    },

    action: (plugin, instance, args) => {
      return new Promise((resolve, reject) => {
        const id = oneTimeCallbacks.add((response) => {
          if (response && response.code !== 0) {
            reject(response.status)
            return;
          }

          resolve(response);
        });
        sendPayload({ command: 'action', plugin, instance, id, args });
      });
    },

    controllerUpdate: (controller, instance, key, value) => {
      return new Promise((resolve, reject) => {
        const id = oneTimeCallbacks.add((response) => {
          if (response && response.code !== 0) {
            reject(response.status)
            return;
          }

          resolve(response);
        });
        sendPayload({ command: 'controllerUpdate', plugin: controller, instance, id, key, value });
      });
    },

    connected: () => !!socket,
    close: () => {
      heartbeatInterval = clearInterval(heartbeatInterval);
      socket.close()
    },
  }
});

module.exports = apiLib;
