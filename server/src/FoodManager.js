import { Vector2 } from "./shared/Vector2.js";
import { WORLD_SIZE } from "./shared/constants.js";
export class FoodManager {
    static instance;
    foods = [];
    maxFoodCount = 15000;
    // Grid for collision optimization
    grid = new Map();
    CELL_SIZE = 200;
    // Sync queues
    addedFoods = [];
    removedFoods = [];
    constructor() { }
    static getInstance() {
        if (!FoodManager.instance)
            FoodManager.instance = new FoodManager();
        return FoodManager.instance;
    }
    init() {
        for (let i = 0; i < 1500; i++)
            this.spawnFood();
    }
    getGridKey(x, y) {
        const gx = Math.floor(x / this.CELL_SIZE);
        const gy = Math.floor(y / this.CELL_SIZE);
        return `${gx}_${gy}`;
    }
    addToGrid(food) {
        const key = this.getGridKey(food.x, food.y);
        if (!this.grid.has(key))
            this.grid.set(key, []);
        this.grid.get(key).push(food);
    }
    removeFromGrid(food) {
        const key = this.getGridKey(food.x, food.y);
        const cell = this.grid.get(key);
        if (cell) {
            const idx = cell.indexOf(food);
            if (idx > -1)
                cell.splice(idx, 1);
            if (cell.length === 0)
                this.grid.delete(key);
        }
    }
    spawnFood() {
        if (this.foods.length >= this.maxFoodCount)
            return null;
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.sqrt(Math.random()) * (WORLD_SIZE.RADIUS - 100);
        const x = WORLD_SIZE.CENTER_X + Math.cos(angle) * dist;
        const y = WORLD_SIZE.CENTER_Y + Math.sin(angle) * dist;
        let type = 'normal';
        let value = 1;
        const chance = Math.random();
        // Adjusted probabilities for variety
        // 0.995+ -> 10x
        // 0.98+ -> 5x
        // 0.96+ -> Speed/Agility/Magnet/Mystery/2x
        if (chance > 0.995) {
            type = '10x';
            value = 10;
        }
        else if (chance > 0.98) {
            type = '5x';
            value = 5;
        }
        else if (chance > 0.94) {
            const subChance = Math.random();
            if (subChance > 0.8) {
                type = '2x';
                value = 2;
            }
            else if (subChance > 0.6) {
                type = 'speed';
                value = 1;
            }
            else if (subChance > 0.4) {
                type = 'agility';
                value = 1;
            }
            else if (subChance > 0.2) {
                type = 'magnet';
                value = 1;
            }
            else {
                type = 'mystery';
                value = 1;
            }
        }
        const food = {
            id: Math.random().toString(36).substr(2, 9),
            x, y, type, value, lifeTime: 0
        };
        this.foods.push(food);
        this.addToGrid(food);
        this.addedFoods.push(food);
        return food;
    }
    spawnDroppedFood(pos, value) {
        if (this.foods.length >= this.maxFoodCount)
            return;
        const food = {
            id: Math.random().toString(36).substr(2, 9),
            x: pos.x + (Math.random() * 20 - 10),
            y: pos.y + (Math.random() * 20 - 10),
            type: 'dead',
            value,
            lifeTime: 0
        };
        this.foods.push(food);
        this.addToGrid(food);
        this.addedFoods.push(food);
    }
    removeFood(food, by) {
        const idx = this.foods.indexOf(food);
        if (idx > -1) {
            this.foods.splice(idx, 1);
            this.removeFromGrid(food);
            if (by)
                this.removedFoods.push({ id: food.id, by });
            else
                this.removedFoods.push({ id: food.id });
        }
    }
    checkCollision(x, y, radius, by) {
        const eaten = [];
        const radiusSq = radius * radius;
        // Check grid cells around the point
        const startX = Math.floor((x - radius) / this.CELL_SIZE);
        const endX = Math.floor((x + radius) / this.CELL_SIZE);
        const startY = Math.floor((y - radius) / this.CELL_SIZE);
        const endY = Math.floor((y + radius) / this.CELL_SIZE);
        for (let gx = startX; gx <= endX; gx++) {
            for (let gy = startY; gy <= endY; gy++) {
                const key = `${gx}_${gy}`;
                const cell = this.grid.get(key);
                if (!cell)
                    continue;
                for (let i = cell.length - 1; i >= 0; i--) {
                    const food = cell[i];
                    if (!food)
                        continue;
                    const dx = x - food.x;
                    const dy = y - food.y;
                    if (dx * dx + dy * dy < radiusSq) {
                        eaten.push(food);
                        this.removeFood(food, by); // Remove immediately to prevent double eat
                    }
                }
            }
        }
        return eaten;
    }
    update(dt) {
        for (let i = this.foods.length - 1; i >= 0; i--) {
            const food = this.foods[i];
            if (!food)
                continue;
            if (food.type === 'dead') {
                food.lifeTime += dt;
                if (food.lifeTime > 30) {
                    this.removeFood(food);
                }
            }
        }
        while (this.foods.length < 1500)
            this.spawnFood();
    }
    getAllFood() {
        return this.foods;
    }
}
//# sourceMappingURL=FoodManager.js.map