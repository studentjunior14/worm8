import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { Game } from './Game.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: { origin: "*" }
});

// Serve static files from the client dist directory
const clientDistPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientDistPath));

const game = Game.getInstance(io);

io.on('connection', (socket) => {
    console.log('Player connected:', socket.id);

    socket.on('join', (data) => {
        const id = game.addPlayer(socket.id, data.name || "Player", data.skin || "skin_green");
        socket.emit('joined', { id });
    });

    socket.on('input', (data) => {
        if (data) game.handleInput(socket.id, data);
    });

    socket.on('disconnect', () => {
        console.log('Player disconnected:', socket.id);
        game.removePlayer(socket.id);
    });
});

// Handle SPA routing by returning index.html for unknown routes
app.get(/(.*)/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
});

game.start();

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
