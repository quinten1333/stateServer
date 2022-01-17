const { createBluetooth } = require('node-ble');
const { isEqual } = require('lodash')

const { EventBased } = require('../base');

class Bluetooth extends EventBased {
    constructor(config) {
        super(config);
        ({ bluetooth: this.bluetooth, destroy: this.destroy } = createBluetooth());

        this.name = config.name;
        this.config = config.args;

        this.connected = false;
        this.characteristics = {};
        this.state = {}
    }

    async initialize() {
        this.adapter = await this.bluetooth.defaultAdapter();
        await this.connect();
    }

    async connect() {
        if (!await this.adapter.isDiscovering()) {
            await this.adapter.startDiscovery();
        }

        this.device = await this.adapter.waitDevice(this.config.address);
        await this.adapter.stopDiscovery();

        this.device.on('connect', this.onConnected);
        this.device.on('disconnect', this.onDisconnected);
        await this.device.connect();
    }

    onConnected = async () => {
        this.connected = true;
        this.gattServer = await this.device.gatt();
        this.service = await this.gattServer.getPrimaryService(this.config.serviceUUID);

        for (const [name, characteristic] of Object.entries(this.config.characteristics)) {
            if (typeof characteristic.toValue !== 'function') { console.error(`Characteristic ${name} does not have a toValue function! Skipping.`); continue; }

            this.characteristics[name] = await this.service.getCharacteristic(characteristic.uuid);

            if (characteristic.notify) {
                this.characteristics[name].on('valuechanged', (buffer) => {
                    const newValue = characteristic.toValue(buffer);
                    if (isEqual(this.state[name], newValue)) { return; }

                    this.state[name] = newValue;
                    this.onStateChange(this.state);
                });
                this.characteristics[name].startNotifications();
            }

        }
    }

    onDisconnected = () => {
        this.connected = false;
        this.device.removeAllListeners();
        this.state = {};
        this.onStateChange(this.state);
        this.connect();
    }

    async shutdown() {
        await Promise.all(Object.entries(this.config.characteristics).map(([name, characteristic]) => {
            if (!characteristic.notify || !this.characteristics[name]) { return; }

            return this.characteristics[name].stopNotifications();
        }));
        if (this.device) {
            await this.device.disconnect();
        }
        await this.destroy();
    }

    actions = {}

}

module.exports = Bluetooth;
