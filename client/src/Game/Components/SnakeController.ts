import { Component } from "../../Engine/Component";
import { InputManager } from "../../Engine/InputManager";
import { Vector2 } from "../../Engine/Vector2";
import { WORLD_SIZE, GAME_SETTINGS } from "../../constants";
import * as PIXI from 'pixi.js';
import { NetworkManager } from "../NetworkManager";
import { AccessoryManager } from "../../Managers/AccessoryManager";

export class SnakeController extends Component {
    public static allSnakes: SnakeController[] = [];

    public id: string = "";
    public isPlayer: boolean = false;
    public score: number = 0;
    public killCount: number = 0;
    public hsCount: number = 0;
    public name: string = "";

    private nameLabel: PIXI.Text | null = null;

    // Server state target
    private targetPosition: Vector2 | null = null;
    private targetRotation: number = 0;

    public width: number = GAME_SETTINGS.SNAKE_START_WIDTH;
    public pathHistory: Vector2[] = [];
    public bodyPartsCount: number = 20;

    // Visuals
    private get pointSeparation(): number { return this.width * 0.25; }
    private bodySprites: PIXI.Sprite[] = [];
    private textures: PIXI.Texture[] = [];
    private texturePattern: number[] = [8, 7, 6, 5, 4, 3, 2, 1, 0];
    private static skinConfig: any = null;
    private currentGlowColors: string[] = [];
    private glowSprites: PIXI.Graphics[] = [];
    public activeEffects: { [key: string]: number } = {}; // For display only

    // Magnet Effect
    private magnetGraphic: PIXI.Graphics | null = null;
    private magnetTimer: number = 0;


    start(): void {
        this.magnetGraphic = new PIXI.Graphics();
        this.gameObject.container.addChild(this.magnetGraphic);
        // Note: It will end up behind body parts if they are added with addChildAt(0). 
        // Wait, body parts push existing children UP? No, addChildAt(x, 0) puts x at 0, shifting others to 1+.
        // So magnet (added normally at end) will be at TOP.
        // If we want it at bottom, we should add it, then add body parts at 0.
        // But body parts are added dynamically.
        // Let's rely on zIndex.
        this.gameObject.container.sortableChildren = true;
        this.magnetGraphic.zIndex = 5; // Body parts default 0? No, let's check.
        // Actually simpler: just make it transparent on top.

        SnakeController.allSnakes.push(this);
        // Initialize history with current pos
        for (let i = 0; i < this.bodyPartsCount * this.pointSeparation * 2; i++) {
            this.pathHistory.push(this.gameObject.position.clone());
        }
    }

    public updateFromServer(data: any) {
        // data: { x, y, rot, s, sk, n, w, b, ef }
        this.targetPosition = new Vector2(data.x, data.y);
        this.targetRotation = data.rot;
        this.score = data.s;
        this.width = data.w;
        if (data.b) this.bodyPartsCount = data.b;
        if (data.ef) this.activeEffects = data.ef;
        if (data.k !== undefined) this.killCount = data.k;
        if (data.h !== undefined) this.hsCount = data.h;

        // Sync Accessories
        if (data.acc) {
            this.updateAccessories(data.acc);
        }

        // Name and Skin should be set on creation, but updated if needed
        if (this.name !== data.n) this.setName(data.n);
    }

    public setName(name: string) {
        this.name = name;
        if (!this.nameLabel) {
            this.nameLabel = new PIXI.Text({
                text: name,
                style: {
                    fontFamily: 'Fredoka', fontSize: 16, fill: 0xffffff,
                    stroke: { color: 0x000000, width: 3 }, fontWeight: 'bold', align: 'center'
                }
            });
            this.nameLabel.anchor.set(0.5, 1);
            this.gameObject.container.addChild(this.nameLabel);
        } else {
            this.nameLabel.text = name;
        }
        this.updateNameLabelPos();
    }

    private updateNameLabelPos() {
        if (this.nameLabel && !this.nameLabel.destroyed) {
            this.nameLabel.y = -(this.width / 2 + 10);
            this.nameLabel.zIndex = 1000;
        }
    }

    public static isAutoCircling: boolean = false;

    update(dt: number): void {
        // If player, send input
        if (this.isPlayer) {
            const input = InputManager.getInstance();
            let angle = 0;

            if (SnakeController.isAutoCircling) {
                // Auto-Circle: Turn left (counter-clockwise)
                angle = this.gameObject.rotation - 1.5;
            } else {
                const target = input.mousePosition;
                const dx = target.x - window.innerWidth / 2;
                const dy = target.y - window.innerHeight / 2;
                angle = Math.atan2(dy, dx);
            }
            NetworkManager.getInstance().sendInput(angle, input.isMouseDown);
        }

        // Interpolate Logic
        if (this.targetPosition) {
            // Lerp factor
            const t = Math.min(dt * 5, 1.0);
            this.gameObject.position = this.gameObject.position.lerp(this.targetPosition, t);

            // Rotation lerp
            let diff = this.targetRotation - this.gameObject.rotation;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            this.gameObject.rotation += diff * t;
        }

        this.updateHistory(dt);
        this.updateBodyVisuals();
        this.updateNameLabelPos();
        this.updateMagnetVisual(dt);
    }

    private updateMagnetVisual(dt: number) {
        if (!this.magnetGraphic) return;
        const duration = this.activeEffects['magnet'] || 0;
        if (duration > 0) {
            this.magnetGraphic.visible = true;
            this.magnetTimer += dt * 5;
            this.magnetGraphic.clear();

            // Cyan/Red pulse
            const radius = 200 + Math.sin(this.magnetTimer) * 20;
            const alpha = 0.3 + Math.sin(this.magnetTimer) * 0.1;

            this.magnetGraphic.circle(0, 0, radius);
            this.magnetGraphic.stroke({ width: 4, color: 0xFF0000, alpha: 0.6 }); // Red border
            this.magnetGraphic.fill({ color: 0x00FFFF, alpha }); // Cyan fill
        } else {
            this.magnetGraphic.visible = false;
        }
    }

    private updateHistory(dt: number): void {
        // Push current interpolated position
        this.pathHistory.unshift(this.gameObject.position.clone());
        // Limit history based on body parts
        // Use a multiplier to ensure we have enough points for the visual spline
        const maxHistoryPoints = Math.ceil((this.bodyPartsCount * this.pointSeparation) * 3);
        if (this.pathHistory.length > maxHistoryPoints) this.pathHistory.length = maxHistoryPoints;
    }

    // --- VISUAL HELPERS (Unchanged mostly) ---

    public async setSkin(skinId: string) {
        try {
            const path = skinId.startsWith('skin_') ? `/skins/${skinId}.png` : `/skins/skin_${skinId}.png`;
            const texture = await PIXI.Assets.load(path);
            this.sliceTextures(texture);
            await this.loadSkinConfig(skinId);
        } catch (e) {
            const texture = await PIXI.Assets.load(`/skins/skin_green.png`);
            this.sliceTextures(texture);
            await this.loadSkinConfig('skin_green');
        }
    }

    private sliceTextures(baseTexture: PIXI.Texture) {
        this.textures = [];
        const totalFrames = 9;
        const frameWidth = baseTexture.width / totalFrames;
        const frameHeight = baseTexture.height;
        const cropSize = Math.min(frameWidth, frameHeight);
        for (let i = 0; i < totalFrames; i++) {
            const rect = new PIXI.Rectangle(
                i * frameWidth + (frameWidth - cropSize) / 2, (frameHeight - cropSize) / 2, cropSize, cropSize
            );
            this.textures.push(new PIXI.Texture({ source: baseTexture.source, frame: rect }));
        }
    }

    private async loadSkinConfig(skinId: string) {
        if (!SnakeController.skinConfig) {
            try {
                const res = await fetch('/skins/skin_config.json');
                SnakeController.skinConfig = await res.json();
            } catch (e) {
                console.error("Failed to load skin config", e);
                SnakeController.skinConfig = { skins: {} };
            }
        }
        const skinKey = skinId.startsWith('skin_') ? skinId : `skin_${skinId}`;
        const skinData = SnakeController.skinConfig.skins[skinKey] || SnakeController.skinConfig.skins[skinId];
        if (skinData && skinData.glows) {
            this.currentGlowColors = skinData.glows;
        } else {
            this.currentGlowColors = Array(9).fill(SnakeController.skinConfig.default_glow || "transparent");
        }
    }

    private updateBodyVisuals() {
        if (this.textures.length === 0) return;

        // Ensure we have enough body/glow sprites
        while (this.bodySprites.length < this.bodyPartsCount) {
            const sp = new PIXI.Sprite(this.textures[0]);
            sp.anchor.set(0.5);
            this.gameObject.container.addChildAt(sp, 0);
            this.bodySprites.push(sp);

            const glow = new PIXI.Graphics();
            glow.circle(0, 0, 50);
            glow.fill({ color: 0xffffff, alpha: 0.24 });
            glow.visible = false;

            this.gameObject.container.addChildAt(glow, 0);
            this.glowSprites.push(glow);
        }

        // Update Visibility & Scale
        for (let i = 0; i < this.bodySprites.length; i++) {
            const isVisible = i < this.bodyPartsCount;
            this.bodySprites[i].visible = isVisible;
            if (this.glowSprites[i]) {
                this.glowSprites[i].visible = isVisible && this.currentGlowColors.length > 0;
                if (isVisible) {
                    const scale = (this.width / 100) * 1.1125;
                    this.glowSprites[i].scale.set(scale);
                    this.bodySprites[i].width = this.width;
                    this.bodySprites[i].height = this.width;

                    if (this.currentGlowColors.length > 0) {
                        const patternIdx = this.texturePattern[i % this.texturePattern.length];
                        const glowColor = this.currentGlowColors[patternIdx] || "transparent";
                        if (glowColor !== "transparent") {
                            this.glowSprites[i].tint = new PIXI.Color(glowColor).toNumber();
                        } else {
                            this.glowSprites[i].visible = false;
                        }
                    }
                }
            }
        }

        let accumulatedDist = 0;
        let visualIndex = 0;

        if (this.bodySprites.length > 0) {
            const head = this.bodySprites[0];
            const headGlow = this.glowSprites[0];

            head.position.set(0, 0); // Relative to container (0,0)
            head.rotation = this.gameObject.rotation;

            const patternIndex = this.texturePattern[0];
            head.texture = this.textures[patternIndex];

            if (this.currentGlowColors.length > 0) {
                const glowColor = this.currentGlowColors[patternIndex] || "transparent";
                if (glowColor === "transparent") headGlow.visible = false;
                else {
                    headGlow.visible = true;
                    headGlow.tint = new PIXI.Color(glowColor).toNumber();
                }
            } else {
                headGlow.visible = false;
            }
            if (headGlow) {
                headGlow.position.set(0, 0);
                headGlow.rotation = head.rotation;
            }
            visualIndex = 1;

            // --- ACCESSORY UPDATE ---
            // --- ACCESSORY UPDATE ---
            this.accessorySprites.forEach((sp, id) => {
                const config = this.accessoryConfigs.get(id);
                if (!config) return;

                sp.visible = true; // Ensure visible
                sp.position.set(head.x, head.y);
                sp.rotation = head.rotation;

                // Apply local offset rotated
                const offX = config.offset.x;
                const offY = config.offset.y;
                const cos = Math.cos(head.rotation);
                const sin = Math.sin(head.rotation);
                const rX = offX * cos - offY * sin;
                const rY = offX * sin + offY * cos;

                sp.x += rX;
                sp.y += rY;

                // Scale
                const baseScale = this.width / 40.0;
                sp.scale.set(config.scale.x * baseScale, config.scale.y * baseScale);
            });
        }

        for (let i = 0; i < this.pathHistory.length - 1; i++) {
            if (visualIndex >= this.bodyPartsCount) break;
            const p1 = this.pathHistory[i];
            const p2 = this.pathHistory[i + 1];
            const dist = p1.distanceTo(p2);
            accumulatedDist += dist;

            if (accumulatedDist >= this.pointSeparation) {
                const overshoot = accumulatedDist - this.pointSeparation;
                accumulatedDist = overshoot;
                const ratio = dist > 0 ? overshoot / dist : 0;
                const exactPos = p2.lerp(p1, ratio);

                const relX = exactPos.x - this.gameObject.position.x;
                const relY = exactPos.y - this.gameObject.position.y;

                const sp = this.bodySprites[visualIndex];
                const gp = this.glowSprites[visualIndex];

                sp.position.set(relX, relY);
                if (gp) gp.position.set(relX, relY);

                const rotation = Math.atan2(p1.y - p2.y, p1.x - p2.x);
                sp.rotation = rotation;
                if (gp) gp.rotation = rotation;

                const patternIdx = this.texturePattern[visualIndex % this.texturePattern.length];
                sp.texture = this.textures[patternIdx];

                if (this.currentGlowColors.length > 0) {
                    const glowColor = this.currentGlowColors[patternIdx] || "transparent";
                    if (glowColor === "transparent") {
                        if (gp) gp.visible = false;
                    } else {
                        if (gp) {
                            gp.visible = true;
                            gp.tint = new PIXI.Color(glowColor).toNumber();
                        }
                    }
                } else {
                    if (gp) gp.visible = false;
                }
                visualIndex++;
            }
        }
    }

    public destroy() {
        const idx = SnakeController.allSnakes.indexOf(this);
        if (idx > -1) SnakeController.allSnakes.splice(idx, 1);
        this.gameObject.destroy();
    }

    // Accessory
    private accessorySprites: Map<number, PIXI.Sprite> = new Map();
    private accessoryConfigs: Map<number, any> = new Map();

    public updateAccessories(ids: number[]) {
        const currentIds = Array.from(this.accessorySprites.keys());

        // Remove old
        currentIds.forEach(id => {
            if (!ids.includes(id)) {
                const sp = this.accessorySprites.get(id);
                if (sp) {
                    sp.destroy();
                    this.accessorySprites.delete(id);
                    this.accessoryConfigs.delete(id);
                }
            }
        });

        // Add new
        ids.forEach(id => {
            if (!this.accessorySprites.has(id)) {
                this.addAccessory(id);
            }
        });
    }

    private addAccessory(id: number) {
        // Use global import
        const manager = AccessoryManager.instance;
        if (!manager) return;

        const config = manager.getAccessoryConfig(id);
        const texture = manager.getTexture(id);

        if (config && texture) {
            console.log(`SnakeController: Adding accessory ${id} sprite. Scale:`, config.scale);
            const sp = new PIXI.Sprite(texture);
            sp.anchor.set(config.anchor.x, config.anchor.y);

            // Initial Scale logic (will be updated in render loop)
            // Base width ~40
            const baseScale = this.width / 40.0;
            sp.scale.set(config.scale.x * baseScale, config.scale.y * baseScale);

            sp.zIndex = 200 + id;

            this.gameObject.container.addChild(sp);
            this.accessorySprites.set(id, sp);
            this.accessoryConfigs.set(id, config);
        }
    }
}