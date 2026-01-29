import { Vector2 } from "./shared/Vector2.js";
import { WORLD_SIZE, GAME_SETTINGS } from "./shared/constants.js";
import { FoodManager, type Food } from "./FoodManager.js";

export class Snake {
    public static allSnakes: Snake[] = [];

    public id: string;
    public socketId: string;
    public position: Vector2;
    public rotation: number = 0;

    public name: string = "Player";
    public skin: string = "skin_green";

    public score: number = 0;
    public killCount: number = 0;
    public hsCount: number = 0;

    public isActive: boolean = true;
    public isBot: boolean = false;

    // Event Flags (reset after broadcast)
    public didHeadshot: boolean = false;
    public didKill: boolean = false;

    // Movement
    public baseSpeed: number = GAME_SETTINGS.SNAKE_START_SPEED;
    public boostSpeed: number = GAME_SETTINGS.SNAKE_START_SPEED * GAME_SETTINGS.SNAKE_BOOST_MULTIPLIER;
    public currentSpeed: number = 0;
    public turnSpeed: number = (GAME_SETTINGS.SNAKE_TURN_SPEED * 0.030) + 0.05;

    public isBoosting: boolean = false;
    public targetAngle: number = 0;

    // Body
    public pathHistory: Vector2[] = [];
    public bodyPartsCount: number = 20;
    public width: number = GAME_SETTINGS.SNAKE_START_WIDTH;
    private targetWidth: number = GAME_SETTINGS.SNAKE_START_WIDTH;

    // Cache for collision
    public cachedBodyPositions: Vector2[] = [];
    private get pointSeparation(): number { return this.width * 0.25; }
    private static readonly MAX_BODY_PARTS: number = 500;

    // Effects
    public activeEffects: { [key: string]: number } = {};
    private growPending: number = 0;

    // Bot vars
    private botTarget: Vector2 = new Vector2(0, 0);
    private botTimer: number = 0;

    constructor(id: string, socketId: string, x: number, y: number, name: string, skin: string, isBot: boolean = false) {
        this.id = id;
        this.socketId = socketId;
        this.position = new Vector2(x, y);
        this.name = name;
        this.skin = skin;
        this.isBot = isBot;

        Snake.allSnakes.push(this);

        // Init history
        this.currentSpeed = this.baseSpeed;
        for (let i = 0; i < this.bodyPartsCount * this.pointSeparation * 2; i++) {
            this.pathHistory.push(new Vector2(x, y));
        }

        if (this.isBot) this.pickNewBotTarget();
    }

    private pickNewBotTarget() {
        const angle = Math.random() * Math.PI * 2;
        const dist = 500 + Math.random() * 1500;
        this.botTarget = new Vector2(
            this.position.x + Math.cos(angle) * dist,
            this.position.y + Math.sin(angle) * dist
        );
    }

    public update(dt: number) {
        if (!this.isActive) return;

        const safeDt = Math.min(dt, 0.1);

        if (this.isBot) {
            this.handleBotInput(safeDt);
        } else {
            this.handleInput(safeDt);
        }

        this.updateHistory(safeDt);
        this.updateBodyPositionsCache();

        this.checkFoodCollision();
        this.checkSnakeCollision();
        this.checkBorderCollision();

        if (this.isActive) {
            this.processGrowth(safeDt);
            this.updateEffects(safeDt);
        }
    }

    public setInput(input: { angle: number, boosting: boolean }) {
        this.targetAngle = input.angle;
        this.isBoosting = input.boosting;
    }

    private handleInput(dt: number) {
        let targetSpeedVal = this.isBoosting ? this.boostSpeed : this.baseSpeed;

        // Speed Potion: Increases BOOST speed by 20%
        if (this.isBoosting && (this.activeEffects['speed'] || 0) > 0) {
            targetSpeedVal *= 1.2;
        }

        // Simple lerp for speed
        const speedLerp = 1 - Math.pow(0.001, dt);
        this.currentSpeed += (targetSpeedVal - this.currentSpeed) * speedLerp;

        this.rotateTowards(this.targetAngle, dt);
        this.moveForward(dt);
    }

    private handleBotInput(dt: number) {
        this.botTimer += dt;
        if (this.botTimer > 4.0) {
            this.pickNewBotTarget();
            this.botTimer = 0;
        }

        const distToCenter = this.position.distanceTo(new Vector2(WORLD_SIZE.CENTER_X, WORLD_SIZE.CENTER_Y));
        if (distToCenter > WORLD_SIZE.RADIUS - 400) {
            this.botTarget = new Vector2(WORLD_SIZE.CENTER_X, WORLD_SIZE.CENTER_Y);
        }

        const targetSpeedVal = this.baseSpeed;
        const speedLerp = 1 - Math.pow(0.001, dt);
        this.currentSpeed += (targetSpeedVal - this.currentSpeed) * speedLerp;

        const dx = this.botTarget.x - this.position.x;
        const dy = this.botTarget.y - this.position.y;
        this.rotateSmoothly(Math.atan2(dy, dx), dt);
        this.moveForward(dt);
    }

    private rotateSmoothly(targetAngle: number, dt: number) {
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        const smoothSpeed = 3.0;
        const smoothFactor = 1 - Math.exp(-smoothSpeed * dt);
        this.rotation += diff * smoothFactor;
    }

    private rotateTowards(targetAngle: number, dt: number) {
        let diff = targetAngle - this.rotation;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;

        let currentTurnSpeed = this.turnSpeed;
        // Agility Potion: Increases turn speed by 50%
        if ((this.activeEffects['agility'] || 0) > 0) {
            currentTurnSpeed *= 1.5;
        }

        const turnAmount = currentTurnSpeed * dt * 60; // 60 is to match original client logic scale
        if (Math.abs(diff) < turnAmount) this.rotation = targetAngle;
        else this.rotation += Math.sign(diff) * turnAmount;
    }

    private moveForward(dt: number) {
        const velocity = new Vector2(
            Math.cos(this.rotation),
            Math.sin(this.rotation)
        ).multiply(this.currentSpeed * dt);
        this.position = this.position.add(velocity);
    }

    private updateHistory(dt: number) {
        this.pathHistory.unshift(this.position.clone());
        const maxHistoryPoints = Math.ceil((this.bodyPartsCount * this.pointSeparation) * 3);
        if (this.pathHistory.length > maxHistoryPoints) this.pathHistory.length = maxHistoryPoints;
    }

    private updateBodyPositionsCache() {
        this.cachedBodyPositions = [];
        this.cachedBodyPositions.push(this.position);

        let accumulatedDist = 0;
        for (let i = 0; i < this.pathHistory.length - 1 && this.cachedBodyPositions.length < this.bodyPartsCount; i++) {
            const p1 = this.pathHistory[i];
            const p2 = this.pathHistory[i + 1];
            if (!p1 || !p2) continue;
            const dist = p1.distanceTo(p2);
            accumulatedDist += dist;

            if (accumulatedDist >= this.pointSeparation) {
                const overshoot = accumulatedDist - this.pointSeparation;
                accumulatedDist = overshoot;
                const ratio = dist > 0 ? overshoot / dist : 0;
                // Fix: ensure p1 and p2 exist (though logic guarantees they should)
                if (p1 && p2) {
                    const lerped = p2.lerp(p1, ratio);
                    this.cachedBodyPositions.push(lerped);
                }
            }
        }
    }

    public getTotalMultiplier(): number {
        let total = 1;
        if ((this.activeEffects['2x'] || 0) > 0) total *= 2;
        if ((this.activeEffects['5x'] || 0) > 0) total *= 5;
        if ((this.activeEffects['10x'] || 0) > 0) total *= 10;
        return total;
    }

    private checkFoodCollision() {
        const foodManager = FoodManager.getInstance();
        const headX = this.position.x;
        const headY = this.position.y;
        let eatRadius = (this.width / 2) + 20;

        // Magnet Potion: Increase radius
        if ((this.activeEffects['magnet'] || 0) > 0) {
            eatRadius += 150; // Significant range increase
        }

        // This is expensive O(N) where N is food. Spatial hashing is better but for now simple loop.
        // FoodManager should handle the query maybe?
        const eatenIndices = foodManager.checkCollision(headX, headY, eatRadius, this.id);
        eatenIndices.forEach((val: Food) => {
            this.applyFoodEffect(val.type, val.value);
        });
    }

    private applyFoodEffect(type: string, value: number) {
        const mult = this.getTotalMultiplier();
        let scoreGain = 0;

        // Handle Mystery Logic (Give random effect)
        if (type === 'mystery') {
            const possible = ['2x', '5x', '10x', 'speed', 'agility', 'magnet'];
            const randomType = possible[Math.floor(Math.random() * possible.length)];
            if (randomType) type = randomType;
        }

        if (type === 'normal') scoreGain = Math.floor(Math.random() * 40) + 30;
        else if (type === 'dead') scoreGain = 100;
        else if (['2x', '5x', '10x', 'speed', 'agility', 'magnet'].includes(type)) scoreGain = 50;
        else scoreGain = 50;

        scoreGain *= mult * value;
        this.score += scoreGain;
        this.growPending += scoreGain * 0.002;

        if (type !== 'normal' && type !== 'dead') {
            this.activeEffects[type] = GAME_SETTINGS.DURATIONS[type] || 20;
        }
    }

    private processGrowth(dt: number) {
        if (this.growPending >= 1 && this.bodyPartsCount < Snake.MAX_BODY_PARTS) {
            this.bodyPartsCount++;
            this.growPending -= 1;
        } else if (this.bodyPartsCount >= Snake.MAX_BODY_PARTS) {
            this.growPending = 0;
        }

        const sizeBonus = Math.log10(this.score + 100) * 4;
        const desiredWidth = GAME_SETTINGS.SNAKE_START_WIDTH + sizeBonus;
        this.targetWidth = desiredWidth;
        this.width += (this.targetWidth - this.width) * dt * 0.1;
        if (this.width > 150) this.width = 150;

        const baseTurnSpeed = (GAME_SETTINGS.SNAKE_TURN_SPEED * 0.030) + 0.05;
        this.turnSpeed = baseTurnSpeed * (GAME_SETTINGS.SNAKE_START_WIDTH / this.width);
    }

    private updateEffects(dt: number) {
        for (const key in this.activeEffects) {
            const val = this.activeEffects[key];
            if (val !== undefined) {
                this.activeEffects[key] = val - dt;
                if (this.activeEffects[key] <= 0) delete this.activeEffects[key];
            }
        }
    }

    private checkBorderCollision() {
        const dist = this.position.distanceTo(new Vector2(WORLD_SIZE.CENTER_X, WORLD_SIZE.CENTER_Y));
        if (dist > WORLD_SIZE.RADIUS) {
            this.die(false);
        }
    }

    private checkSnakeCollision() {
        if (!this.isActive) return;

        const myHeadX = this.position.x;
        const myHeadY = this.position.y;
        const centerX = WORLD_SIZE.CENTER_X;
        const centerY = WORLD_SIZE.CENTER_Y;
        const myHitboxRadius = (this.width / 2) * 0.7;

        for (const otherSnake of Snake.allSnakes) {
            if (otherSnake === this || !otherSnake.isActive) continue;

            const otherHeadX = otherSnake.position.x;
            const otherHeadY = otherSnake.position.y;
            const otherHitboxRadius = (otherSnake.width / 2) * 0.7;

            const maxSnakeLength = otherSnake.bodyPartsCount * otherSnake.pointSeparation;
            const dx = myHeadX - otherHeadX;
            const dy = myHeadY - otherHeadY;
            const distSq = dx * dx + dy * dy;
            // Optimization skip
            const skipDistSq = (maxSnakeLength + myHitboxRadius + otherHitboxRadius) ** 2;
            if (distSq > skipDistSq) continue;

            const combinedRadius = myHitboxRadius + otherHitboxRadius;
            const combinedRadiusSq = combinedRadius * combinedRadius;

            // Helper to resolve headshot
            const resolveHeadshot = () => {
                const center = new Vector2(centerX, centerY);
                const myDist = this.position.distanceTo(center);
                const otherDist = otherSnake.position.distanceTo(center);
                let IWin = false;
                if (myDist > otherDist) IWin = true;
                else if (otherDist > myDist) IWin = false;
                else IWin = this.score >= otherSnake.score;

                if (IWin) {
                    this.hsCount++;
                    this.didHeadshot = true; // Flag for event
                    // this.didKill = true;  // REMOVED to prevent double event (WELL DONE + HEADSHOT)
                    otherSnake.die();
                } else {
                    this.die();
                    otherSnake.hsCount++;
                    otherSnake.didHeadshot = true; // Flag for event
                    // otherSnake.didKill = true;
                }
            };

            // Head to Head
            if (distSq < combinedRadiusSq) {
                resolveHeadshot();
                return;
            }

            // Head to Body
            const bodyPositions = otherSnake.cachedBodyPositions;
            for (let i = 1; i < bodyPositions.length; i++) {
                const partPos = bodyPositions[i];
                if (!partPos) continue;
                const bdx = myHeadX - partPos.x;
                const bdy = myHeadY - partPos.y;
                if (bdx * bdx + bdy * bdy < combinedRadiusSq) {
                    if (i <= 2) {
                        resolveHeadshot();
                        return;
                    } else {
                        this.die();
                        otherSnake.killCount++;
                        otherSnake.didKill = true; // Flag for event
                        return;
                    }
                }
            }
        }
    }

    public die(spawnFood: boolean = true) {
        if (!this.isActive) return;
        this.isActive = false;

        const foodManager = FoodManager.getInstance();
        if (spawnFood) {
            let accumulatedDist = 0;
            let bodyPositions: Vector2[] = [this.position.clone()];

            for (let i = 0; i < this.pathHistory.length - 1 && bodyPositions.length < this.bodyPartsCount; i++) {
                const p1 = this.pathHistory[i];
                const p2 = this.pathHistory[i + 1];
                if (!p1 || !p2) continue;

                const dist = p1.distanceTo(p2);
                accumulatedDist += dist;
                if (accumulatedDist >= this.pointSeparation) {
                    const overshoot = accumulatedDist - this.pointSeparation;
                    accumulatedDist = overshoot;
                    const ratio = dist > 0 ? overshoot / dist : 0;
                    bodyPositions.push(p2.lerp(p1, ratio));
                }
            }

            for (const pos of bodyPositions) {
                foodManager.spawnDroppedFood(pos, 5);
            }
        }

        // Remove from list - MOVED TO GAME LOOP
        // const idx = Snake.allSnakes.indexOf(this);
        // if (idx > -1) Snake.allSnakes.splice(idx, 1);
    }
}
