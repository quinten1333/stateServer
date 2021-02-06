module.exports = {
    server: {
        listen: "/home/quinten/.stateServer.sock"
    },

    plugins: {
        bluOS: {
            instances: {
                streamer: {
                    ip: "192.168.1.242"
                }
            }
        },
        // ping: {
        //     instances: [
        //         {
                    // timeout: 60, // Seconds
        //             ip: "192.168.1.120"
        //         }
        //     ]
        // }
    }
}
