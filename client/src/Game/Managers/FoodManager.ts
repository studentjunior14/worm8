import { Vector2 } from "../../Engine/Vector2";
import { WORLD_SIZE } from "../../constants";
import * as PIXI from 'pixi.js';
import { SnakeController } from "../Components/SnakeController";

export type FoodType = 'normal' | '2x' | '5x' | '10x' | 'speed' | 'agility' | 'magnet' | 'mystery' | 'dead';

interface Food {
    id: string;
    sprite: PIXI.Sprite;
    type: FoodType;
    value: number;
    active: boolean;
    lifeTime: number;
}

const FOOD_FILES = ['food_01.png', 'food_02.png', 'food_03.png', 'food_04.png'];
const ITEM_FILES: { [key: string]: string } = {
    '2x': 'item_2x.png', '5x': 'item_5x.png', '10x': 'item_10x.png',
    'speed': 'item_speed.png', 'agility': 'item_agility.png',
    'magnet': 'item_magnet.png', 'mystery': 'item_mystery.png'
};

export class FoodManager {
    private static instance: FoodManager;
    private foods: Map<string, Food> = new Map();
    private container: PIXI.Container | null = null;
    private foodTextures: PIXI.Texture[] = [];
    private itemTextures: { [key: string]: PIXI.Texture } = {};
    private isLoaded: boolean = false;

    private constructor() { }

    public static getInstance(): FoodManager {
        if (!FoodManager.instance) FoodManager.instance = new FoodManager();
        return FoodManager.instance;
    }

    public async init() {
        if (this.isLoaded) return;
        try {
            for (const file of FOOD_FILES) {
                const texture = await PIXI.Assets.load(`/assets/foods/${file}`);
                this.foodTextures.push(texture);
            }
            for (const key in ITEM_FILES) {
                const texture = await PIXI.Assets.load(`/assets/items/${ITEM_FILES[key]}`);
                this.itemTextures[key] = texture;
            }
            this.isLoaded = true;
        } catch (e) { console.error("Texture hatası:", e); }
    }

    public setContainer(container: PIXI.Container) {
        this.container = container;
    }

    public spawnFood(id: string, x: number, y: number, type: FoodType, value: number): void {
        if (!this.container || !this.isLoaded) return;
        if (this.foods.has(id)) return;

        let texture: PIXI.Texture;
        let scale = 0.6;
        const tint = 0xffffff;

        if (type === '10x') { texture = this.itemTextures['10x']; scale = 0.8; }
        else if (type === '5x') { texture = this.itemTextures['5x']; scale = 0.75; }
        else if (type === '2x') { texture = this.itemTextures['2x']; scale = 0.7; }
        else if (type === 'speed') { texture = this.itemTextures['speed']; scale = 0.7; }
        else if (type === 'agility') { texture = this.itemTextures['agility']; scale = 0.7; }
        else if (type === 'magnet') { texture = this.itemTextures['magnet']; scale = 0.7; }
        else if (type === 'mystery') { texture = this.itemTextures['mystery']; scale = 0.7; }
        else if (type === 'dead') {
            texture = this.foodTextures[Math.floor(Math.random() * this.foodTextures.length)];
            scale = 0.8;
        }
        else {
            texture = this.foodTextures[Math.floor(parseInt(id.substr(0, 2), 36) % this.foodTextures.length)];
            scale = 0.6 + (Math.random() * 0.1);
        }

        if (texture) {
            const maxDim = Math.max(texture.width, texture.height);
            const finalScale = (scale * 50) / maxDim;

            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.x = x;
            sprite.y = y;
            sprite.scale.set(finalScale);
            sprite.tint = tint;

            // "Appear" animation
            sprite.scale.set(0);
            const targetScale = finalScale;
            let t = 0;
            const appearAnim = (ticker: PIXI.Ticker) => {
                t += ticker.deltaTime / 60;
                if (t > 1) {
                    sprite.scale.set(targetScale);
                    PIXI.Ticker.shared.remove(appearAnim);
                    return;
                }
                sprite.scale.set(targetScale * (Math.sin(t * Math.PI) * 0.2 + t));
                if (t >= 0.5) { sprite.scale.set(targetScale); PIXI.Ticker.shared.remove(appearAnim); }
            };
            // PIXI.Ticker.shared.add(appearAnim); 
            sprite.scale.set(finalScale);

            this.container.addChild(sprite);
            this.foods.set(id, { id, sprite, active: true, type, value, lifeTime: 0 });
        }
    }

    public removeFood(id: string, eatenBy?: string): void {
        const food = this.foods.get(id);
        if (food) {
            this.foods.delete(id); // Logically removed

            if (eatenBy) {
                // Animation Logic
                const snake = SnakeController.allSnakes.find(s => s.id === eatenBy);
                if (snake && snake.gameObject && snake.gameObject.isActive) {
                    // Animate to snake head
                    const startPos = { x: food.sprite.x, y: food.sprite.y };
                    let t = 0;
                    const duration = 0.3; // seconds

                    const flyAnim = (ticker: PIXI.Ticker) => {
                        t += ticker.deltaTime / 60;
                        if (t >= duration || !food.sprite || food.sprite.destroyed) {
                            if (this.container && food.sprite && !food.sprite.destroyed) this.container.removeChild(food.sprite);
                            if (food.sprite && !food.sprite.destroyed) food.sprite.destroy();
                            PIXI.Ticker.shared.remove(flyAnim);
                            return;
                        }

                        const r = t / duration; // 0 to 1

                        // Lerp to CURRENT snake head pos if snake is still active
                        if (snake.gameObject && snake.gameObject.isActive) {
                            const headPos = snake.gameObject.position;
                            food.sprite.x = startPos.x + (headPos.x - startPos.x) * r;
                            food.sprite.y = startPos.y + (headPos.y - startPos.y) * r;
                        }

                        food.sprite.scale.set(food.sprite.scale.x * 0.95);
                        food.sprite.alpha = 1 - (r * 0.5); // Fade slightly
                    };
                    PIXI.Ticker.shared.add(flyAnim);
                    return; // Don't destroy immediately
                }
            }

            // Default destroy
            if (this.container) this.container.removeChild(food.sprite);
            food.sprite.destroy();
        }
    }

    public update(deltaTime: number): void {
        this.foods.forEach(food => {
            if (food.type === 'dead') {
                food.lifeTime += deltaTime;
                if (food.lifeTime > 25) { food.sprite.alpha = (Math.sin(food.lifeTime * 10) + 1) / 2; }
            }
        });
    }

    public reset() {
        this.foods.forEach(food => {
            if (this.container) this.container.removeChild(food.sprite);
            food.sprite.destroy();
        });
        this.foods.clear();
    }

    public getFoods(): Food[] { return Array.from(this.foods.values()); }
}