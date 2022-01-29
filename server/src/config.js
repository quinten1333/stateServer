module.exports = {
    server: {
        socket: {
            listen: process.env.PORT || 2000
        },
        webSocket: {
            listen: process.env.WS_PORT || 2001
        }
    },

    plugins: {
        bluOS: {
            instances: {
                streamer: {
                    ip: "192.168.1.243"
                }
            }
        },
        jsonStorage: {
            instances: {
                laptop: {},
                room: {
                    inMemmory: true,
                },
            }
        },
        lifx: {
            instances: {
                bedroom: {
                    identifier: "d073d52d7be0",
                    fadeDuration: 1000,
                    pullInterval: 2500,
                },
                leds: {
                    identifier: "d073d5429c55",
                    fadeDuration: 1000,
                    pullInterval: 2500,
                }
            }
        },

        bluetooth: {
            instances: {
                arduinoNano33BleSense: {
                    address: '92:D4:B3:8D:EB:F9',
                    serviceUUID: 'e905de3e-0000-44de-92c4-bb6e04fb0212',
                    characteristics: {
                        light: {
                            uuid: 'e905de3e-2001-44de-92c4-bb6e04fb0212',
                            notify: true,
                            toValue: (buf) => [buf.readUInt16LE(), buf.readUInt16LE(2), buf.readUInt16LE(4), buf.readUInt16LE(6)],
                        },
                    },
                },
            }
        }
    },

    controllers: {
        pid: {
            instances: {
                ledController: {
                    tickInterval: 1000,
                    inputPlugin: 'bluetooth',
                    inputInstance: 'arduinoNano33BleSense',
                    inputFn: (state) => {
                        if (!state || !state.light) {
                            return undefined;
                        }

                        return state.light[3];
                    },
                    outputPlugin: 'lifx',
                    outputInstance: 'leds',
                    outputFn: (output) => {
                        output = Math.min(Math.max(Math.round(output), 0), 100);
                        return ['brightness', output]
                    },
                    kp: 0.1,
                    ki: 0.1,
                    kd: 0,
                    integratorMin: -10,
                    integratorMax: 110,
                    setPoint: 82,
                    updateTreshold: 3,
                    fitMode: false,
                }
            }
        }
    }
}
