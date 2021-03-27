module.exports = {
    server: {
        listen: "/home/quinten/.stateServer.sock"
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
