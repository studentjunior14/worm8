import { Vector2 } from "./Vector2";
import { Component } from "./Component";
import * as PIXI from 'pixi.js';

export class GameObject {
    public position: Vector2;
    public rotation: number = 0;
    public scale: Vector2 = new Vector2(1, 1);
    public isActive: boolean = true;

    // Pixi Container
    public container: PIXI.Container;

    private components: Component[] = [];

    constructor(position: Vector2) {
        this.position = position;

        // Container oluştur
        this.container = new PIXI.Container();
        this.container.x = position.x;
        this.container.y = position.y;
    }

    public addComponent<T extends Component>(componentType: new (go: GameObject) => T): T {
        const component = new componentType(this);
        this.components.push(component);
        if (component.start) {
            component.start();
        }
        return component;
    }

    public update(deltaTime: number): void {
        // 1. Eğer başta aktif değilse işlem yapma
        if (!this.isActive) {
            if (this.container && !this.container.destroyed) {
                this.container.visible = false;
            }
            return;
        }

        if (this.container && !this.container.destroyed) {
            this.container.visible = true;
        }

        // 2. Componentleri güncelle (SnakeController burada çalışır)
        // Eğer yılan burada ölürse, isActive = false olur ve destroy çağrılır.
        for (const component of this.components) {
            component.update(deltaTime);
        }

        // 3. KRİTİK KONTROL (HATAYI ÇÖZEN KISIM)
        // Component update'inden sonra obje ölmüş veya container silinmiş olabilir.
        // Eğer öldüyse, pozisyon güncellemeye çalışma!
        if (!this.isActive || !this.container || this.container.destroyed) {
            return;
        }

        // 4. Pozisyonu güncelle (Sadece yaşıyorsa)
        this.container.x = this.position.x;
        this.container.y = this.position.y;
    }

    public destroy(): void {
        this.isActive = false; // Garanti olsun diye pasife çek
        if (this.container && !this.container.destroyed) {
            this.container.destroy({ children: true });
        }
    }
}