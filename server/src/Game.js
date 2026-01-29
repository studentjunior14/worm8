import { Snake } from "./Snake.js";
import { FoodManager } from "./FoodManager.js";
import { Server } from "socket.io";
import { v4 as uuidv4 } from 'uuid';
import { Vector2 } from "./shared/Vector2.js";
export class Game {
    static instance;
    io;
    lastTime = 0;
    intervalId = null;
    // 60 ticks per second
    TICK_RATE = 20; // 50ms (for "cheapest" bandwidth), maybe 30 or 60 for smoothness. 
    // Smoothness requested: let's go 30Hz or 60Hz. 
    // 60Hz is standard for "smooth". 20Hz with interpolation is efficient.
    // Let's do 60Hz server tick, but broadcast 20Hz? No, 60Hz is fine for small count.
    constructor(io) {
        this.io = io;
    }
    static getInstance(io) {
        if (!Game.instance && io)
            Game.instance = new Game(io);
        return Game.instance;
    }
    start() {
        FoodManager.getInstance().init();
        // Spawn some bots
        for (let i = 0; i < 10; i++) {
            new Snake(uuidv4(), "bot", 5000, 5000, `Bot${i}`, "skin_red", true);
        }
        this.lastTime = Date.now();
        this.intervalId = setInterval(() => this.loop(), 1000 / 60); // 60 FPS
    }
    loop() {
        const now = Date.now();
        const dt = (now - this.lastTime) / 1000;
        this.lastTime = now;
        FoodManager.getInstance().update(dt);
        // Update all snakes
        Snake.allSnakes.forEach(s => s.update(dt));
        // Cleanup inactive
        for (let i = Snake.allSnakes.length - 1; i >= 0; i--) {
            const s = Snake.allSnakes[i];
            if (!s)
                continue;
            if (!s.isActive) {
                if (s.socketId) {
                    this.io.to(s.socketId).emit('dead', {
                        score: Math.floor(s.score),
                        killCount: s.killCount,
                        hsCount: s.hsCount
                    });
                }
                // Remove from list
                Snake.allSnakes.splice(i, 1);
            }
            else {
                // Check event flags
                if (s.didHeadshot) {
                    if (s.socketId)
                        this.io.to(s.socketId).emit('headshot');
                    s.didHeadshot = false;
                }
                if (s.didKill) {
                    if (s.socketId)
                        this.io.to(s.socketId).emit('kill');
                    s.didKill = false;
                }
            }
        }
        // Maintain 20 bots
        this.maintainBots();
        // Broadcast
        this.broadcastState();
    }
    maintainBots() {
        const botCount = Snake.allSnakes.filter(s => s.isBot).length;
        const missing = 20 - botCount;
        if (missing > 0) {
            const simpleSkins = ['skin_red', 'skin_green', 'skin_blue', 'skin_yellow', 'skin_tr', 'skin_space'];
            for (let i = 0; i < missing; i++) {
                const randomSkin = simpleSkins[Math.floor(Math.random() * simpleSkins.length)] || "skin_red";
                const x = 5000 + (Math.random() * 4000 - 2000);
                const y = 5000 + (Math.random() * 4000 - 2000);
                new Snake(uuidv4(), "bot", x, y, `Bot`, randomSkin, true);
            }
        }
    }
    broadcastState() {
        // Optimization: Don't send everything every frame.
        // Send Snakes and Food events.
        // For simpler implementation now: Send all visible snakes.
        const snakesData = Snake.allSnakes.map(s => ({
            id: s.id,
            x: Number(s.position.x.toFixed(2)),
            y: Number(s.position.y.toFixed(2)),
            rot: Number(s.rotation.toFixed(2)),
            s: Math.floor(s.score),
            sk: s.skin,
            n: s.name,
            w: Number(s.width.toFixed(2)),
            b: s.bodyPartsCount,
            ef: s.activeEffects,
            k: s.killCount,
            h: s.hsCount
        }));
        // Send full state? 
        // Food: send updates
        const fm = FoodManager.getInstance();
        if (fm.addedFoods.length > 0 || fm.removedFoods.length > 0) {
            // console.log(`Broadcasting food update: +${fm.addedFoods.length} -${fm.removedFoodIds.length}`);
            this.io.emit('food_update', {
                add: fm.addedFoods,
                rem: fm.removedFoods
            });
            fm.addedFoods = [];
            fm.removedFoods = [];
        }
        this.io.volatile.emit('state', {
            snakes: snakesData,
        });
    }
    addPlayer(socketId, name, skin) {
        // Find safe random pos
        let x = 5000, y = 5000;
        const center = new Vector2(5000, 5000);
        let safe = false;
        // Try up to 20 times to find a safe spot
        for (let i = 0; i < 20; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * (4500); // 0 to 4500 (inside 5000 radius with buffer)
            const tx = 5000 + Math.cos(angle) * dist;
            const ty = 5000 + Math.sin(angle) * dist;
            // Check distance to other snakes
            let tooClose = false;
            for (const s of Snake.allSnakes) {
                const d = Math.sqrt((s.position.x - tx) ** 2 + (s.position.y - ty) ** 2);
                if (d < 500) { // Keep 500 units away
                    tooClose = true;
                    break;
                }
            }
            if (!tooClose) {
                x = tx;
                y = ty;
                safe = true;
                break;
            }
        }
        // If not found in 20 tries (crowded?), just use last attempt or fallback to random
        if (!safe) {
            x = 5000 + (Math.random() * 4000 - 2000);
            y = 5000 + (Math.random() * 4000 - 2000);
        }
        const id = uuidv4();
        const snake = new Snake(id, socketId, x, y, name, skin, false);
        // Send initial food to this player
        const allFood = FoodManager.getInstance().getAllFood();
        this.io.to(socketId).emit('init_food', allFood);
        return id;
    }
    removePlayer(socketId) {
        const snake = Snake.allSnakes.find(s => s.socketId === socketId);
        if (snake) {
            snake.die(true);
        }
    }
    handleInput(socketId, data) {
        const snake = Snake.allSnakes.find(s => s.socketId === socketId);
        if (snake) {
            snake.setInput(data);
        }
    }
}
//# sourceMappingURL=Game.js.map