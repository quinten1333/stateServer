module.exports = {
    server: {
        socket: {
            listen: "/home/quinten/.stateServer.sock"
        },
        webSocket: {
            listen: process.env.WS_PORT || 3000
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
                laptop: {}
            }
        }
    }
}
