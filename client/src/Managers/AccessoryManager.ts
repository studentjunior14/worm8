
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
    private equippedAccessories: Map<string, number> = new Map(); // Category -> ID

    // UI Elements
    private canvas: HTMLCanvasElement | null = null;
    private previewApp: PIXI.Application | null = null;
    private previewContainer: PIXI.Container = new PIXI.Container();
    private previewSnakeHead: PIXI.Graphics | null = null;
    private previewSprites: Map<string, PIXI.Sprite> = new Map();

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
        this.loadSaved(); // Load first
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
        document.getElementById('btn-wear-equip')?.addEventListener('click', () => this.toggleCurrent());

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

        // Placeholder for accessorie sprites
        // We will create sprites dynamically as needed
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

    updatePreview(previewItem: AccessoryConfig | null) {
        if (!this.previewSnakeHead) return;

        // We want to show:
        // 1. All EQUIPPED items from OTHER categories.
        // 2. The PREVIEW item for the CURRENT category (overriding equipped).

        // Get list of items to render
        const itemsToRender: AccessoryConfig[] = [];

        // Add equipped from other categories
        this.equippedAccessories.forEach((id, cat) => {
            if (cat !== this.currentCategory && this.config) {
                const item = Object.values(this.config.accessories).find(a => a.id === id);
                if (item) itemsToRender.push(item);
            }
        });

        // Add current preview item
        if (previewItem) itemsToRender.push(previewItem);

        // Render logic
        // Clear existing sprites or reuse? Reuse map by category is easiest but we have a map.
        // Let's hide all first
        this.previewSprites.forEach(s => s.visible = false);

        itemsToRender.forEach(item => {
            let sprite = this.previewSprites.get(item.category);
            if (!sprite) {
                sprite = new PIXI.Sprite();
                this.previewContainer.addChild(sprite);
                this.previewSprites.set(item.category, sprite);
            }
            if (this.loadedTextures[item.id]) {
                sprite.texture = this.loadedTextures[item.id];
                sprite.visible = true;
                sprite.anchor.set(item.anchor.x, item.anchor.y);
                // Preview scale tweak 0.8
                sprite.scale.set(item.scale.x * 0.8, item.scale.y * 0.8);
                sprite.position.set(item.offset.x, item.offset.y);

                // Z-Index by category? 
                // Simple sort order: skin < eyes < glasses < mouths < hats
                // Current child order defines z-index.
                this.sortPreviewSprites();
            }
        });

        if (previewItem) {
            document.getElementById('wear-id-display')!.innerText = previewItem.id.toString();
            this.updateEquipButtonState(previewItem);
        } else {
            document.getElementById('wear-id-display')!.innerText = "None";
        }
    }

    private sortPreviewSprites() {
        const order = ['eyes', 'mouths', 'glasses', 'hats'];
        this.previewSprites.forEach((sprite, cat) => {
            const idx = order.indexOf(cat);
            sprite.zIndex = idx + 10;
        });
        this.previewContainer.sortableChildren = true;
    }

    private updateEquipButtonState(item: AccessoryConfig) {
        const btn = document.getElementById('btn-wear-equip');
        if (!btn) return;

        const isEquipped = this.equippedAccessories.get(item.category) === item.id;
        if (isEquipped) {
            btn.innerText = "Unequip";
            btn.classList.add('equipped-state'); // Add logic in CSS if needed
        } else {
            btn.innerText = "Equip";
            btn.classList.remove('equipped-state');
        }
    }

    toggleCurrent() {
        if (this.currentItemIndex >= 0 && this.categoryItems[this.currentItemIndex]) {
            const item = this.categoryItems[this.currentItemIndex];
            const current = this.equippedAccessories.get(item.category);

            if (current === item.id) {
                // Unequip
                this.equippedAccessories.delete(item.category);
                console.log("Unequipped:", item.category);
            } else {
                // Equip (replace)
                this.equippedAccessories.set(item.category, item.id);
                console.log("Equipped:", item.id);
            }
            this.saveEquipped();
            this.updateEquipButtonState(item);
            this.updatePreview(item); // Refresh view
        }
    }

    private saveEquipped() {
        const obj = Object.fromEntries(this.equippedAccessories);
        localStorage.setItem('wormate_accessories_map', JSON.stringify(obj));
    }

    getEquippedAccessoryIds(): number[] {
        return Array.from(this.equippedAccessories.values());
    }

    public getAccessoryConfig(id: number): AccessoryConfig | null {
        if (!this.config) return null;
        for (const key in this.config.accessories) {
            if (this.config.accessories[key].id === id) {
                return this.config.accessories[key];
            }
        }
        return null;
    }

    public getTexture(id: number): PIXI.Texture | null {
        return this.loadedTextures[id] || null;
    }

    // For initializing from storage
    loadSaved() {
        try {
            const saved = localStorage.getItem('wormate_accessories_map');
            if (saved) {
                const obj = JSON.parse(saved);
                this.equippedAccessories = new Map(Object.entries(obj));
            } else {
                // Legacy check
                const legacy = localStorage.getItem('wormate_accessory');
                if (legacy) {
                    // Try to guess category or just clear
                    // We need config to know category.
                    // Deferred until config load? 
                    // Safe to just clear for new system.
                    localStorage.removeItem('wormate_accessory');
                }
            }
        } catch (e) {
            console.error("Failed to load saved accessories", e);
        }
    }
}
