
import * as PIXI from 'pixi.js';

interface AccessoryConfig {
    id: number;
    category: string;
    src: string;
    anchor: { x: number, y: number };
    scale: { x: number, y: number };
    offset: { x: number, y: number };
}

interface ConfigFile {
    accessories: { [key: string]: AccessoryConfig };
    categories: string[];
}

export class AccessoryManager {
    static instance: AccessoryManager;

    private config: ConfigFile | null = null;
    private loadedTextures: { [key: number]: PIXI.Texture } = {};
    private currentCategory: string = 'glasses';
    private selectedAccessoryId: number = 0; // 0 = none

    // UI Elements
    private canvas: HTMLCanvasElement | null = null;
    private previewApp: PIXI.Application | null = null;
    private previewContainer: PIXI.Container = new PIXI.Container();
    private previewSnakeHead: PIXI.Graphics | null = null;
    private previewAccessorySprite: PIXI.Sprite | null = null;

    // Store State
    private categoryItems: AccessoryConfig[] = [];
    private currentItemIndex: number = -1;

    constructor() {
        AccessoryManager.instance = this;
    }

    async init() {
        try {
            const response = await fetch('/accessories/accessories_config.json');
            this.config = await response.json();
            console.log("Accessory Config Loaded:", this.config);

            // Preload textures
            if (this.config) {
                for (const key in this.config.accessories) {
                    const acc = this.config.accessories[key];
                    this.loadedTextures[acc.id] = await PIXI.Assets.load(acc.src);
                }
            }
        } catch (e) {
            console.error("Failed to load accessory config:", e);
        }

        this.setupUI();
        this.selectCategory('glasses');
    }

    private setupUI() {
        // Buttons
        const cats = ['eyes', 'mouths', 'glasses', 'hats'];
        cats.forEach(cat => {
            const btn = document.getElementById(`wear-${cat}-button`);
            if (btn) {
                btn.addEventListener('click', () => this.selectCategory(cat));
            }
        });

        document.getElementById('wear-view-prev')?.addEventListener('click', () => this.prevItem());
        document.getElementById('wear-view-next')?.addEventListener('click', () => this.nextItem());
        document.getElementById('btn-wear-equip')?.addEventListener('click', () => this.equipCurrent());

        // Canvas
        this.canvas = document.getElementById('wear-view-canv') as HTMLCanvasElement;
        if (this.canvas) {
            this.previewApp = new PIXI.Application();
            this.previewApp.init({
                canvas: this.canvas,
                width: 700,
                height: 360,
                backgroundAlpha: 0,
                resolution: window.devicePixelRatio || 1,
                autoDensity: true
            }).then(() => {
                if (!this.previewApp) return;
                this.previewApp.stage.addChild(this.previewContainer);
                this.createPreviewSnake();
                this.previewApp.ticker.add((time) => this.animatePreview(time.elapsedMS));
            });
        }
    }

    private createPreviewSnake() {
        // Create a simple snake head representation
        const head = new PIXI.Graphics();
        head.beginFill(0x76c336); // Green skin default
        head.drawCircle(0, 0, 40); // Radius 40
        head.endFill();

        // Eyes (drawn on head for reference)
        head.beginFill(0xffffff);
        head.drawCircle(15, -15, 10);
        head.drawCircle(15, 15, 10);
        head.endFill();
        head.beginFill(0x000000);
        head.drawCircle(18, -15, 4);
        head.drawCircle(18, 15, 4);
        head.endFill();

        this.previewSnakeHead = head;
        // Position center screen
        this.previewContainer.x = 350;
        this.previewContainer.y = 180;
        this.previewContainer.addChild(head);

        // Placeholder for accessory
        this.previewAccessorySprite = new PIXI.Sprite();
        this.previewContainer.addChild(this.previewAccessorySprite);
    }

    private animatePreview(dt: number) {
        if (!this.previewContainer) return;

        const time = Date.now() / 1000;
        // Wiggle effect: Up and down bobbing + slight rotation
        const bob = Math.sin(time * 3) * 10;
        const rot = Math.sin(time * 2) * 0.1;

        this.previewContainer.y = 180 + bob;
        this.previewContainer.rotation = rot;
    }

    selectCategory(category: string) {
        this.currentCategory = category;

        // Update UI Highlights
        document.querySelectorAll('.wear-types li').forEach(li => li.classList.remove('active'));
        document.getElementById(`wear-${category}-button`)?.classList.add('active');

        // Filter items
        if (this.config) {
            this.categoryItems = Object.values(this.config.accessories)
                .filter(a => a.category === category)
                .sort((a, b) => a.id - b.id);

            // Reset to first item or none
            if (this.categoryItems.length > 0) {
                this.currentItemIndex = 0;
                this.updatePreview(this.categoryItems[0]);
            } else {
                this.currentItemIndex = -1;
                this.updatePreview(null);
            }
        }
    }

    prevItem() {
        if (this.categoryItems.length === 0) return;
        this.currentItemIndex--;
        if (this.currentItemIndex < 0) this.currentItemIndex = this.categoryItems.length - 1;
        this.updatePreview(this.categoryItems[this.currentItemIndex]);
    }

    nextItem() {
        if (this.categoryItems.length === 0) return;
        this.currentItemIndex++;
        if (this.currentItemIndex >= this.categoryItems.length) this.currentItemIndex = 0;
        this.updatePreview(this.categoryItems[this.currentItemIndex]);
    }

    updatePreview(item: AccessoryConfig | null) {
        if (!this.previewAccessorySprite || !this.previewSnakeHead) return;

        if (item && this.loadedTextures[item.id]) {
            this.previewAccessorySprite.texture = this.loadedTextures[item.id];
            this.previewAccessorySprite.visible = true;

            // Align with head (Head radius is 40)
            // Config anchor is relative to the sprite, position is relative to head center (0,0)
            this.previewAccessorySprite.anchor.set(item.anchor.x, item.anchor.y);
            this.previewAccessorySprite.scale.set(item.scale.x * 0.8, item.scale.y * 0.8); // Scale down slightly for menu
            this.previewAccessorySprite.position.set(item.offset.x, item.offset.y);

            document.getElementById('wear-id-display')!.innerText = item.id.toString();
        } else {
            this.previewAccessorySprite.visible = false;
            document.getElementById('wear-id-display')!.innerText = "None";
        }
    }

    equipCurrent() {
        if (this.currentItemIndex >= 0 && this.categoryItems[this.currentItemIndex]) {
            this.selectedAccessoryId = this.categoryItems[this.currentItemIndex].id;
            console.log("Equipped Accessory:", this.selectedAccessoryId);
            // In a real app, save to localStorage here
            localStorage.setItem('wormate_accessory', this.selectedAccessoryId.toString());
        } else {
            this.selectedAccessoryId = 0;
            localStorage.removeItem('wormate_accessory');
        }
    }

    getAccessoryId(): number {
        return this.selectedAccessoryId;
    }

    // Called by Game Loop to get sprite config
    getAccessoryConfig(id: number): AccessoryConfig | undefined {
        if (!this.config) return undefined;
        return Object.values(this.config.accessories).find(a => a.id === id);
    }

    getTexture(id: number): PIXI.Texture | undefined {
        return this.loadedTextures[id];
    }

    // For initializing from storage
    loadSaved() {
        const saved = localStorage.getItem('wormate_accessory');
        if (saved) {
            this.selectedAccessoryId = parseInt(saved);
        }
    }
}
