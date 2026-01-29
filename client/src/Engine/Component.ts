import { GameObject } from "./GameObject";

export abstract class Component {
    public gameObject: GameObject;

    constructor(gameObject: GameObject) {
        this.gameObject = gameObject;
    }

    public start(): void {
        // Başlangıç işlemleri için (Override edilebilir)
    }

    public update(deltaTime: number): void {
        // Her karede çalışacak mantık (Override edilebilir)
    }
}