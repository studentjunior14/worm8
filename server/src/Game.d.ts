import { Server } from "socket.io";
export declare class Game {
    private static instance;
    private io;
    private lastTime;
    private intervalId;
    private readonly TICK_RATE;
    private constructor();
    static getInstance(io?: Server): Game;
    start(): void;
    private loop;
    private maintainBots;
    private broadcastState;
    addPlayer(socketId: string, name: string, skin: string): string;
    removePlayer(socketId: string): void;
    handleInput(socketId: string, data: {
        angle: number;
        boosting: boolean;
    }): void;
}
//# sourceMappingURL=Game.d.ts.map