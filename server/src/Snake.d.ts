import { Vector2 } from "./shared/Vector2.js";
export declare class Snake {
    static allSnakes: Snake[];
    id: string;
    socketId: string;
    position: Vector2;
    rotation: number;
    name: string;
    skin: string;
    score: number;
    killCount: number;
    hsCount: number;
    isActive: boolean;
    isBot: boolean;
    didHeadshot: boolean;
    didKill: boolean;
    baseSpeed: number;
    boostSpeed: number;
    currentSpeed: number;
    turnSpeed: number;
    isBoosting: boolean;
    targetAngle: number;
    pathHistory: Vector2[];
    bodyPartsCount: number;
    width: number;
    private targetWidth;
    cachedBodyPositions: Vector2[];
    private get pointSeparation();
    private static readonly MAX_BODY_PARTS;
    activeEffects: {
        [key: string]: number;
    };
    private growPending;
    private botTarget;
    private botTimer;
    constructor(id: string, socketId: string, x: number, y: number, name: string, skin: string, isBot?: boolean);
    private pickNewBotTarget;
    update(dt: number): void;
    setInput(input: {
        angle: number;
        boosting: boolean;
    }): void;
    private handleInput;
    private handleBotInput;
    private rotateSmoothly;
    private rotateTowards;
    private moveForward;
    private updateHistory;
    private updateBodyPositionsCache;
    getTotalMultiplier(): number;
    private checkFoodCollision;
    private applyFoodEffect;
    private processGrowth;
    private updateEffects;
    private checkBorderCollision;
    private checkSnakeCollision;
    die(spawnFood?: boolean): void;
}
//# sourceMappingURL=Snake.d.ts.map