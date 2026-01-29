import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Game } from './Game.js';
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});
const game = Game.getInstance(io);
io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);
    socket.on('join', (data) => {
        const id = game.addPlayer(socket.id, data.name || "Player", data.skin || "skin_green");
        socket.emit('joined', { id });
    });
    socket.on('input', (data) => {
        if (data)
            game.handleInput(socket.id, data);
    });
    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        game.removePlayer(socket.id);
    });
});
game.start();
const PORT = 3000;
httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
//# sourceMappingURL=index.js.map