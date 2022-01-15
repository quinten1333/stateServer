module.exports = {
    server: {
        socket: {
            listen: process.env.PORT || 3002
        },
        webSocket: {
            listen: process.env.WS_PORT || 3001
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
        }
    },

    controllers: {
        pid: {
            instances: {
                ledController: {
                    inputPlugin: 'jsonStorage',
                    inputInstance: 'room',
                    inputFn: (state) => state.brightness,
                    outputPlugin: 'lifx',
                    outputInstance: 'leds',
                    outputFn: (output) => ['brightness', output],
                    kp: 1,
                    ki: 0,
                    kd: 0,
                    setPoint: 100,
                }
            }
        }
    }
}
