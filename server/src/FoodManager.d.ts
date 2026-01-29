import { Vector2 } from "./shared/Vector2.js";
export type FoodType = 'normal' | '2x' | '5x' | '10x' | 'speed' | 'agility' | 'magnet' | 'mystery' | 'dead';
export interface Food {
    id: string;
    x: number;
    y: number;
    type: FoodType;
    value: number;
    lifeTime: number;
}
export declare class FoodManager {
    private static instance;
    private foods;
    private maxFoodCount;
    private grid;
    private readonly CELL_SIZE;
    addedFoods: Food[];
    removedFoods: {
        id: string;
        by?: string;
    }[];
    private constructor();
    static getInstance(): FoodManager;
    init(): void;
    private getGridKey;
    private addToGrid;
    private removeFromGrid;
    spawnFood(): Food | null;
    spawnDroppedFood(pos: Vector2, value: number): void;
    removeFood(food: Food, by?: string): void;
    checkCollision(x: number, y: number, radius: number, by?: string): Food[];
    update(dt: number): void;
    getAllFood(): Food[];
}
//# sourceMappingURL=FoodManager.d.ts.map