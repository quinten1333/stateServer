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
                laptop: {}
            }
        }
    }
}
