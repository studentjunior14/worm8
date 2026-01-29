import { Vector2 } from "./Vector2";

export class InputManager {
    private static instance: InputManager;

    public mousePosition: Vector2 = new Vector2(0, 0);
    public isMouseDown: boolean = false; // YENİ: Tıklama durumu

    private constructor() {
        window.addEventListener('mousemove', (e) => {
            this.mousePosition.x = e.clientX;
            this.mousePosition.y = e.clientY;
        });

        // YENİ: Basılı tutmayı algıla
        window.addEventListener('mousedown', () => {
            this.isMouseDown = true;
        });

        window.addEventListener('mouseup', () => {
            this.isMouseDown = false;
        });
    }

    public static getInstance(): InputManager {
        if (!InputManager.instance) {
            InputManager.instance = new InputManager();
        }
        return InputManager.instance;
    }
}