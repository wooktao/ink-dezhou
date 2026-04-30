import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import { App } from './client/App.js';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameServer } from './server/game.js';
import os from 'os';
const cli = meow(`
	Usage
	  $ ink-doudizhu

	Options
	  --name, -n  Player name
    --host, -h  Host to connect to (default: localhost)
    --port, -p  Port to use (default: 3000)
    --mode, -m  "host" or "join" (default: menu)

	Examples
	  $ ink-doudizhu --name Wook --mode host
`, {
    importMeta: import.meta,
    flags: {
        name: { type: 'string', shortFlag: 'n' },
        host: { type: 'string', shortFlag: 'h', default: 'localhost' },
        port: { type: 'string', shortFlag: 'p', default: '3000' },
        mode: { type: 'string', shortFlag: 'm' }
    }
});
function getLocalIp() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return 'localhost';
}
async function start() {
    const name = cli.flags.name || 'Player-' + Math.floor(Math.random() * 1000);
    const port = parseInt(cli.flags.port);
    let host = cli.flags.host;
    const mode = cli.flags.mode;
    if (mode === 'host') {
        const httpServer = createServer();
        const io = new Server(httpServer);
        const gameServer = new GameServer(io);
        // Add 5 AI players to fill a 6-player table (1 human + 5 AIs)
        gameServer.addAiPlayer('AI-1');
        gameServer.addAiPlayer('AI-2');
        gameServer.addAiPlayer('AI-3');
        gameServer.addAiPlayer('AI-4');
        gameServer.addAiPlayer('AI-5');
        httpServer.listen(port, () => {
            const localIp = getLocalIp();
            console.log(`Server started on ${localIp}:${port}`);
        });
        host = 'localhost'; // Host connects to itself
    }
    render(React.createElement(App, { host: host, port: port, playerName: name }));
}
start();
