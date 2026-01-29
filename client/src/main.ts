import "./style.css";
import * as PIXI from 'pixi.js';
import { GameObject } from "./Engine/GameObject";
import { Vector2 } from "./Engine/Vector2";
import { SnakeController } from "./Game/Components/SnakeController";
import { WORLD_SIZE, GAME_SETTINGS } from "./constants";
import { FoodManager } from "./Game/Managers/FoodManager";
import { NetworkManager } from "./Game/NetworkManager";

(async () => {
    try {
        console.log("Initializing Game...");

        // --- GLOBAL VARIABLES ---
        let isGameRunning = false;
        let isGameOver = false;
        let selectedSkin = "skin_green";
        let playerName = "Player";
        let gameObjects: GameObject[] = [];
        let cameraTarget: GameObject | null = null;
        let playerController: SnakeController | null = null;
        let cameraScale = 0.8;
        const MIN_ZOOM = 0.4;
        const MAX_ZOOM = 1.5;
        let myId: string | null = null;

        // --- UI ELEMENTS ---
        const uiLayer = document.getElementById('ui-layer')!;
        const mainMenu = document.getElementById('main-menu')!;
        const storeOverlay = document.getElementById('store-overlay')!;
        const popupView = document.getElementById('popup-view')!;
        const storeView = document.getElementById('store-view')!;
        const skinsView = document.getElementById('skins-view')!;
        const wearView = document.getElementById('wear-view')!;
        const coinsView = document.getElementById('coins-view')!;

        const gameOverModal = document.getElementById('game-over-modal')!;
        const finalScoreEl = document.getElementById('final-score')!;
        const finalHsEl = document.getElementById('final-hs')!;
        const finalKillsEl = document.getElementById('final-kills')!;

        const btnPlay = document.getElementById('btn-play')!;
        const btnStore = document.getElementById('btn-store')!;
        const btnBack = document.getElementById('popup-menu-back')!;
        const btnGoHome = document.getElementById('btn-go-home')!;
        const btnRestart = document.getElementById('btn-restart')!;

        const skinPrev = document.getElementById('skin-prev')!;
        const skinNext = document.getElementById('skin-next')!;
        const skinPreviewImg = document.getElementById('skin-preview-img') as HTMLImageElement;

        const btnGoSkins = document.getElementById('store-go-skins-button');
        const btnGoWear = document.getElementById('store-go-wear-button');
        const btnGoCoins = document.getElementById('store-go-coins-button');

        const storeGroupsList = document.getElementById('store-groups')!;
        const storeCanv = document.getElementById('store-view-canv') as HTMLCanvasElement;
        const storePrev = document.getElementById('store-view-prev')!;
        const storeNext = document.getElementById('store-view-next')!;
        const skinIdDisplay = document.getElementById('skin-id-display')!;
        const skinDescCont = document.getElementById('skin-group-description-text');

        // Data Loading
        let SKINS_DATA: any = {};
        let CATEGORIES: string[] = [];
        let SKINS_BY_CATEGORY: { [key: string]: any[] } = {};
        let currentCategory = "Simple";
        let currentStoreSkinIndex = 0;

        let AVAILABLE_SKINS = [
            { file: "skin_green.png", name: "Green" },
            { file: "skin_tr.png", name: "Turkey" },
            { file: "skin_blue.png", name: "Blue" },
            { file: "skin_red.png", name: "Red" },
            { file: "skin_yellow.png", name: "Yellow" },
            { file: "skin_space.png", name: "Space" }
        ];
        let currentSkinIndex = 0;

        // PIXI App
        const app = new PIXI.Application();
        await app.init({
            width: window.innerWidth, height: window.innerHeight, backgroundColor: 0x161616, antialias: false, resolution: 1, autoDensity: true, resizeTo: window
        });
        app.ticker.maxFPS = 90;
        app.canvas.style.position = 'absolute'; app.canvas.style.top = '0'; app.canvas.style.left = '0'; app.canvas.style.zIndex = '-1';
        app.canvas.style.display = 'none';
        document.body.appendChild(app.canvas);

        const worldContainer = new PIXI.Container();
        const uiContainer = new PIXI.Container();
        uiContainer.zIndex = 100; worldContainer.zIndex = 1; worldContainer.sortableChildren = true;
        app.stage.addChild(worldContainer);
        app.stage.addChild(uiContainer);

        const bgTexture = await PIXI.Assets.load('/bg.png');
        const bgTiling = new PIXI.TilingSprite({ texture: bgTexture, width: WORLD_SIZE.RADIUS * 6, height: WORLD_SIZE.RADIUS * 6 });
        bgTiling.anchor.set(0.5); bgTiling.position.set(WORLD_SIZE.CENTER_X, WORLD_SIZE.CENTER_Y); bgTiling.tileScale.set(0.4);
        worldContainer.addChild(bgTiling);

        const border = new PIXI.Graphics();
        border.circle(WORLD_SIZE.CENTER_X, WORLD_SIZE.CENTER_Y, WORLD_SIZE.RADIUS);
        border.stroke({ width: 5, color: 0xff0000, alpha: 0.3 });
        worldContainer.addChild(border);

        const foodLayer = new PIXI.Container();
        const snakeLayer = new PIXI.Container();
        snakeLayer.sortableChildren = true;
        worldContainer.addChild(foodLayer);
        worldContainer.addChild(snakeLayer);

        const foodManager = FoodManager.getInstance();
        await foodManager.init();
        foodManager.setContainer(foodLayer);

        // --- NETWORK MANGER ---
        const net = NetworkManager.getInstance();

        net.socket.on('joined', (data: any) => {
            myId = data.id;
            console.log("Joined game with ID:", myId);
        });

        net.socket.on('state', (data: any) => {
            if (!isGameRunning) return;

            const serverIds = new Set(data.snakes.map((s: any) => s.id));

            // Update or Create
            data.snakes.forEach((sData: any) => {
                let snake = SnakeController.allSnakes.find(s => s.id === sData.id);
                if (!snake) {
                    // Create
                    const go = new GameObject(new Vector2(sData.x, sData.y));
                    const ctrl = go.addComponent(SnakeController);
                    ctrl.id = sData.id;
                    ctrl.isPlayer = (ctrl.id === myId);

                    // Note: If newly created, we might need to set default name/skin until updated
                    ctrl.setSkin(sData.sk);
                    ctrl.setName(sData.n);

                    // Z-Index: Local < Others
                    go.container.zIndex = ctrl.isPlayer ? 10 : 20;

                    snakeLayer.addChild(go.container);
                    gameObjects.push(go);
                    snake = ctrl;

                    if (ctrl.isPlayer) {
                        playerController = ctrl;
                        cameraTarget = go;
                    }
                }
                snake.updateFromServer(sData);
            });

            // Destroy missing
            for (let i = SnakeController.allSnakes.length - 1; i >= 0; i--) {
                const s = SnakeController.allSnakes[i];
                if (!serverIds.has(s.id)) {
                    s.destroy();
                    const goIdx = gameObjects.indexOf(s.gameObject);
                    if (goIdx > -1) gameObjects.splice(goIdx, 1);
                }
            }
        });

        // Death Marker Logic
        let lastDeathPos: Vector2 | null = null;
        let deathMarker: PIXI.Graphics | null = null;
        let isGamePaused = false; // For the freeze state after 3s
        let deathMarkerTimer = 0;
        let gameOverTimeout: any = null;

        net.socket.on('dead', (data: any) => {
            finalScoreEl.innerText = data.score;
            finalHsEl.innerText = data.hsCount;
            finalKillsEl.innerText = data.killCount;

            if (playerController) {
                lastDeathPos = playerController.gameObject.position.clone();
                deathMarkerTimer = 10;
            }

            // Show Game Over Modal immediately
            lbContainer.visible = true; // Keep visible but frozen
            minimapContainer.visible = true; // Keep visible but frozen
            uiLayer.style.display = 'block';
            gameOverModal.style.display = 'flex';
            mainMenu.style.display = 'none';

            // Freeze Logic
            // Game continues running for 3 seconds, but we stop HUD updates
            isGameOver = true;
            isGameRunning = true; // Keep logic running for background effect

            if (gameOverTimeout) clearTimeout(gameOverTimeout);
            gameOverTimeout = setTimeout(() => {
                isGameRunning = false; // Fully stop/freeze after 3s
                isGamePaused = true;
            }, 3000);
        });

        net.socket.on('init_food', (foods: any[]) => {
            foodManager.reset();
            foods.forEach(f => foodManager.spawnFood(f.id, f.x, f.y, f.type, f.value));
        });

        // ...

        function startGame() {
            if (gameOverTimeout) {
                clearTimeout(gameOverTimeout);
                gameOverTimeout = null;
            }
            const nicknameInput = document.getElementById('nickname-input') as HTMLInputElement;
            playerName = nicknameInput?.value.trim() || "Player";
            if (playerName.length === 0) playerName = "Player";

            app.canvas.style.display = 'block';
            uiLayer.style.display = 'none';
            storeOverlay.style.display = 'none';
            gameOverModal.style.display = 'none';

            lbContainer.visible = true;
            minimapContainer.visible = true;
            statsContainer.visible = true;
            fpsText.visible = true;
            effectsContainer.visible = true;

            isGameRunning = true;
            isGameOver = false;
            isGamePaused = false;

            SnakeController.allSnakes = [];
            gameObjects.forEach(go => go.destroy());
            gameObjects = [];
            foodManager.reset();
            playerController = null;
            cameraTarget = null;



            // JOIN SERVER
            let skinName = selectedSkin.replace('.png', '').replace('skin_', '');
            net.join(playerName, skinName);
        }

        // Removed old showGameOver as logic moved to listener
        // ...

        app.ticker.add((ticker) => {
            const dt = ticker.deltaTime / 60;
            if (isGamePaused) return; // Frozen state
            if (!isGameRunning && !isGameOver) return; // Main menu state (isGameOver is true during 3s delay)

            // ... updates ...
            if (!isGameOver) {
                // Only update HUD/Minimap if NOT game over (freeze effect)
                let doSlowUpdate = false;
                if (hudTimer >= 1.0) { doSlowUpdate = true; hudTimer = 0; }
                hudTimer += dt;
                updateHUD(ticker.FPS, doSlowUpdate);
            }

            // Allow World Updates during 3s delay
            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.life -= dt;
                ft.text.y -= ft.velocity * (dt * 60);
                ft.text.alpha = Math.min(ft.life, 1.0);
                if (ft.life <= 0) {
                    uiContainer.removeChild(ft.text);
                    ft.text.destroy();
                    floatingTexts.splice(i, 1);
                }
            }
            for (const go of gameObjects) go.update(dt);
            foodManager.update(dt);

            // Camera logic must persist even if player is dead during 3s
            if (cameraTarget && cameraTarget.isActive) {
                const tx = -cameraTarget.position.x * cameraScale + app.screen.width / 2;
                const ty = -cameraTarget.position.y * cameraScale + app.screen.height / 2;
                worldContainer.position.set(tx, ty);
                worldContainer.scale.set(cameraScale);
            }
        });

        net.socket.on('food_update', (data: any) => {
            if (isGamePaused) return; // Prevent food updates when frozen
            if (data.add) data.add.forEach((f: any) => foodManager.spawnFood(f.id, f.x, f.y, f.type, f.value));
            if (data.rem) {
                data.rem.forEach((item: any) => {
                    // Check if item is string (legacy) or object
                    if (typeof item === 'string') foodManager.removeFood(item);
                    else foodManager.removeFood(item.id, item.by);
                });
            }
        });


        // --- FETCH DATA ---
        fetch('/skins/skin_config.json')
            .then(res => res.json())
            .then(data => {
                SKINS_DATA = data.skins;
                processSkinsData();
            })
            .catch(err => {
                console.error("Failed to load skin config", err);
            });

        function processSkinsData() {
            const cats = new Set<string>();
            SKINS_BY_CATEGORY = {};
            AVAILABLE_SKINS = [];
            for (const key in SKINS_DATA) {
                const skin = SKINS_DATA[key];
                skin.file = key + ".png";
                skin.key = key;
                const cat = skin.category || "Simple";
                cats.add(cat);
                if (!SKINS_BY_CATEGORY[cat]) SKINS_BY_CATEGORY[cat] = [];
                SKINS_BY_CATEGORY[cat].push(skin);
                AVAILABLE_SKINS.push({ file: skin.file, name: key });
            }
            for (const cat in SKINS_BY_CATEGORY) {
                SKINS_BY_CATEGORY[cat].sort((a: any, b: any) => (a.id || 0) - (b.id || 0));
            }
            CATEGORIES = Array.from(cats).sort();
            if (CATEGORIES.includes("Simple")) {
                CATEGORIES = ["Simple", ...CATEGORIES.filter(c => c !== "Simple")];
            }
            if (AVAILABLE_SKINS.length > 0) {
                currentSkinIndex = 0;
                updateSkinPreview();
            }
        }

        // --- UI PIXI SETUP ---
        const minimapContainer = new PIXI.Container();
        minimapContainer.x = 20; minimapContainer.y = 20; minimapContainer.visible = false;
        uiContainer.addChild(minimapContainer);
        const minimapGraphics = new PIXI.Graphics();
        minimapContainer.addChild(minimapGraphics);
        const minimapOtherGraphics = new PIXI.Graphics();
        minimapContainer.addChild(minimapOtherGraphics);
        const minimapPlayerGraphics = new PIXI.Graphics();
        minimapContainer.addChild(minimapPlayerGraphics);

        const mapSize = 150;
        const radius = (mapSize / 2) + 8;
        let hudTimer = 0;
        for (let i = 1; i <= 12; i++) {
            const angle = (i - 3) * (Math.PI * 2 / 12);
            const numX = (mapSize / 2) + Math.cos(angle) * radius;
            const numY = (mapSize / 2) + Math.sin(angle) * radius;
            const numText = new PIXI.Text({ text: i.toString(), style: { fontFamily: 'Fredoka', fontSize: 11, fill: 0xaaaaaa, fontWeight: 'bold' } });
            numText.anchor.set(0.5); numText.x = numX; numText.y = numY;
            minimapContainer.addChild(numText);
        }

        minimapGraphics.circle(mapSize / 2, mapSize / 2, mapSize / 2);
        minimapGraphics.fill({ color: 0x000000, alpha: 0.6 });
        minimapGraphics.stroke({ width: 2, color: 0xffffff, alpha: 0.5 });
        minimapGraphics.moveTo(mapSize / 2, 0); minimapGraphics.lineTo(mapSize / 2, mapSize);
        minimapGraphics.moveTo(0, mapSize / 2); minimapGraphics.lineTo(mapSize, mapSize / 2);
        minimapGraphics.stroke({ width: 1, color: 0xffffff, alpha: 0.2 });

        const statsContainer = new PIXI.Container();
        statsContainer.x = 20; statsContainer.y = 200; statsContainer.visible = false;
        uiContainer.addChild(statsContainer);
        const hsText = new PIXI.Text({ text: 'HS: 0', style: { fontFamily: 'Fredoka', fontSize: 18, fill: 0xFFD700, stroke: { color: 0x000000, width: 3 } } });
        statsContainer.addChild(hsText);
        const killText = new PIXI.Text({ text: 'KILL: 0', style: { fontFamily: 'Fredoka', fontSize: 18, fill: 0xFFFFFF, stroke: { color: 0x000000, width: 3 } } });
        killText.y = 25; statsContainer.addChild(killText);

        const fpsText = new PIXI.Text({ text: 'FPS: 60', style: { fontFamily: 'Fredoka', fontSize: 14, fill: 0x00ff00 } });
        fpsText.visible = false;
        uiContainer.addChild(fpsText);

        const lbContainer = new PIXI.Container(); lbContainer.visible = false; uiContainer.addChild(lbContainer);
        const lbBg = new PIXI.Graphics(); lbBg.rect(0, 0, 220, 300); lbBg.fill({ color: 0x000000, alpha: 0.5 }); lbContainer.addChild(lbBg);
        const lbHeaderLeft = new PIXI.Text({ text: "Top 10", style: { fontFamily: 'Fredoka', fontSize: 14, fill: 0xffffff, fontWeight: 'bold' } });
        lbHeaderLeft.x = 10; lbHeaderLeft.y = 8; lbContainer.addChild(lbHeaderLeft);
        const lbHeaderRight = new PIXI.Text({ text: "(0 online)", style: { fontFamily: 'Fredoka', fontSize: 14, fill: 0xffffff } });
        lbHeaderRight.anchor.set(1, 0); lbHeaderRight.x = 210; lbHeaderRight.y = 8; lbContainer.addChild(lbHeaderRight);
        const lbEntriesContainer = new PIXI.Container();
        lbEntriesContainer.y = 30;
        lbContainer.addChild(lbEntriesContainer);
        const effectsContainer = new PIXI.Container(); effectsContainer.x = 220; effectsContainer.y = 30;
        effectsContainer.visible = false;
        uiContainer.addChild(effectsContainer);



        function showGameOver() {
            if (isGameOver) return;
            isGameOver = true;
            isGameRunning = false;
            lbContainer.visible = false;
            minimapContainer.visible = false;
            uiLayer.style.display = 'block';
            mainMenu.style.display = 'none';
            storeOverlay.style.display = 'none';
            gameOverModal.style.display = 'flex';
        }

        function goHome() {
            isGameRunning = false;
            isGameOver = false;
            SnakeController.allSnakes = [];
            gameObjects.forEach(go => go.destroy());
            gameObjects = [];
            foodManager.reset();
            playerController = null;
            cameraTarget = null;
            lbContainer.visible = false;
            minimapContainer.visible = false;
            statsContainer.visible = false;
            fpsText.visible = false;
            effectsContainer.visible = false;
            app.canvas.style.display = 'none';
            gameOverModal.style.display = 'none';
            storeOverlay.style.display = 'none';
            uiLayer.style.display = 'flex';
            mainMenu.style.display = 'flex';
        }

        // ... (Store and Carousel handlers same as before) ...
        const floatingTexts: { text: PIXI.Text, life: number, velocity: number }[] = [];

        // Helper to spawn floating text
        function spawnFloatingText(str: string, color: number) {
            const txt = new PIXI.Text({ text: str, style: { fontFamily: 'Fredoka', fontSize: 32, fill: color, stroke: { color: 0x000000, width: 4 }, fontWeight: 'bold' } });
            txt.anchor.set(0.5);
            txt.x = app.screen.width / 2;
            txt.y = app.screen.height / 5; // Higher (was height / 3)
            // No rotation requested for new text ("düz şekilde")
            uiContainer.addChild(txt);
            floatingTexts.push({ text: txt, life: 2.0, velocity: 1.5 });
        }

        net.socket.on('headshot', () => {
            spawnFloatingText("HEADSHOT!", 0xff0000);
            // Play Sound
            const audio = new Audio('/sounds/headshot_01.mp3');
            audio.volume = 0.5;
            audio.play().catch(e => console.error("Audio play failed", e));
        });

        net.socket.on('kill', () => {
            // User requested "HEADSHOT yerine sarı renkte WELL DONE!" for kill events?
            // "kill attığımda HEADSHOT yerine sarı renkte WELL DONE! yazısı çıkacak"
            spawnFloatingText("WELL DONE!", 0xffff00);
        });

        app.ticker.add((ticker) => {
            const dt = ticker.deltaTime / 60;
            if (isGamePaused) return; // Frozen state
            if (!isGameRunning && !isGameOver) return; // Main menu state

            // Update Death Marker Timer
            if (deathMarkerTimer > 0) deathMarkerTimer -= dt;

            for (let i = floatingTexts.length - 1; i >= 0; i--) {
                const ft = floatingTexts[i];
                ft.life -= dt;
                ft.text.y -= ft.velocity * (dt * 60);
                ft.text.alpha = Math.min(ft.life, 1.0);
                if (ft.life <= 0) {
                    uiContainer.removeChild(ft.text);
                    ft.text.destroy();
                    floatingTexts.splice(i, 1);
                }
            }

            // Only update registered objects
            for (const go of gameObjects) go.update(dt);
            foodManager.update(dt);

            if (cameraTarget && cameraTarget.isActive) {
                const tx = -cameraTarget.position.x * cameraScale + app.screen.width / 2;
                const ty = -cameraTarget.position.y * cameraScale + app.screen.height / 2;
                worldContainer.position.set(tx, ty);
                worldContainer.scale.set(cameraScale);
            }
            let doSlowUpdate = false;
            if (hudTimer >= 1.0) { doSlowUpdate = true; hudTimer = 0; }
            hudTimer += dt;
            updateHUD(ticker.FPS, doSlowUpdate);
        });

        function updateHUD(fps: number, doSlowUpdate: boolean) {
            fpsText.x = app.screen.width - 150;
            fpsText.y = app.screen.height - 30;
            if (doSlowUpdate) fpsText.text = `FPS: ${Math.round(fps)}`;
            if (playerController && playerController.gameObject.isActive) {
                hsText.text = `HS: ${playerController.hsCount}`;
                killText.text = `KILL: ${playerController.killCount}`;
                effectsContainer.removeChildren();
                let yOffset = 0;
                for (const key in playerController.activeEffects) {
                    const duration = playerController.activeEffects[key];
                    if (duration <= 0) continue;

                    const effectText = new PIXI.Text({
                        text: `${key}: ${Math.ceil(duration)}s`,
                        style: {
                            fontFamily: 'Fredoka', fontSize: 16, fill: 0x00ff00,
                            stroke: { color: 0x000000, width: 2 }, fontWeight: 'bold'
                        }
                    });
                    effectText.y = yOffset;
                    effectsContainer.addChild(effectText);
                    yOffset += 25;
                }
                minimapPlayerGraphics.clear();
                const pPos = playerController.gameObject.position;
                const relX = (pPos.x - WORLD_SIZE.CENTER_X) / WORLD_SIZE.RADIUS;
                const relY = (pPos.y - WORLD_SIZE.CENTER_Y) / WORLD_SIZE.RADIUS;
                const dotX = (mapSize / 2) + (relX * (mapSize / 2));
                const dotY = (mapSize / 2) + (relY * (mapSize / 2));
                if (Math.sqrt(Math.pow(dotX - mapSize / 2, 2) + Math.pow(dotY - mapSize / 2, 2)) <= mapSize / 2) {
                    minimapPlayerGraphics.circle(dotX, dotY, 4); minimapPlayerGraphics.fill(0x00ff00);
                }
            }
            lbContainer.x = app.screen.width - 230;
            if (doSlowUpdate) {
                const activeSnakes = SnakeController.allSnakes;
                let allScores = activeSnakes.map((s) => ({ name: s.name, score: Math.floor(s.score), isPlayer: s === playerController }));
                allScores.sort((a, b) => b.score - a.score);
                lbHeaderRight.text = `(${allScores.length} online)`;
                lbEntriesContainer.removeChildren();
                for (let i = 0; i < Math.min(allScores.length, 10); i++) {
                    const entry = allScores[i];
                    const isMe = entry.isPlayer;
                    const yPos = i * 22;
                    const color = 0xffffff;
                    const prefix = isMe ? "> " : "  ";
                    const text = new PIXI.Text({ text: `${prefix}${i + 1} ${entry.name.substring(0, 12)}`, style: { fontFamily: 'Fredoka', fontSize: 14, fill: color, fontWeight: isMe ? 'bold' : 'normal' } });
                    text.x = 5; text.y = yPos; lbEntriesContainer.addChild(text);
                    const scoreText = new PIXI.Text({ text: entry.score.toString(), style: { fontFamily: 'Fredoka', fontSize: 14, fill: color, fontWeight: isMe ? 'bold' : 'normal' } });
                    scoreText.anchor.set(1, 0); scoreText.x = 205; scoreText.y = yPos; lbEntriesContainer.addChild(scoreText);
                }
                minimapOtherGraphics.clear();

                // Draw Death Marker on Minimap
                if (lastDeathPos && deathMarkerTimer > 0) {
                    const mRelX = (lastDeathPos.x - WORLD_SIZE.CENTER_X) / WORLD_SIZE.RADIUS;
                    const mRelY = (lastDeathPos.y - WORLD_SIZE.CENTER_Y) / WORLD_SIZE.RADIUS;
                    const mDotX = (mapSize / 2) + (mRelX * (mapSize / 2));
                    const mDotY = (mapSize / 2) + (mRelY * (mapSize / 2));
                    // Check bounds (circle)
                    if (Math.sqrt(Math.pow(mDotX - mapSize / 2, 2) + Math.pow(mDotY - mapSize / 2, 2)) <= mapSize / 2) {
                        minimapOtherGraphics.moveTo(mDotX - 3, mDotY - 3);
                        minimapOtherGraphics.lineTo(mDotX + 3, mDotY + 3);
                        minimapOtherGraphics.moveTo(mDotX + 3, mDotY - 3);
                        minimapOtherGraphics.lineTo(mDotX - 3, mDotY + 3);
                        minimapOtherGraphics.stroke({ width: 2, color: 0xff0000 });
                    }
                }

                // Draw other snakes even if player is dead (frozen state persistence)
                for (const ctrl of SnakeController.allSnakes) {
                    if (ctrl !== playerController && ctrl.gameObject.isActive) {
                        const bPos = ctrl.gameObject.position;
                        const bRelX = (bPos.x - WORLD_SIZE.CENTER_X) / WORLD_SIZE.RADIUS;
                        const bRelY = (bPos.y - WORLD_SIZE.CENTER_Y) / WORLD_SIZE.RADIUS;
                        const bDotX = (mapSize / 2) + (bRelX * (mapSize / 2));
                        const bDotY = (mapSize / 2) + (bRelY * (mapSize / 2));
                        if (Math.sqrt(Math.pow(bDotX - mapSize / 2, 2) + Math.pow(bDotY - mapSize / 2, 2)) <= mapSize / 2) {
                            minimapOtherGraphics.circle(bDotX, bDotY, 2); minimapOtherGraphics.fill(0xffffff);
                        }
                    }
                }
            }
        }

        // Mouse listeners
        let mouseX = 0, mouseY = 0;
        window.addEventListener('mousemove', (e) => { mouseX = e.clientX; mouseY = e.clientY; });
        window.addEventListener('wheel', (e) => {
            const zoomSpeed = 0.001; cameraScale += e.deltaY * -zoomSpeed;
            if (cameraScale < MIN_ZOOM) cameraScale = MIN_ZOOM; if (cameraScale > MAX_ZOOM) cameraScale = MAX_ZOOM;
        }, { passive: false });

        // Store handlers
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'q') {
                SnakeController.isAutoCircling = !SnakeController.isAutoCircling;
            }
        });

        btnStore.addEventListener('click', () => { storeOverlay.style.display = 'block'; showStoreView(); });
        if (btnBack) btnBack.addEventListener('click', () => { skinsView.style.display === 'block' ? showStoreView() : storeOverlay.style.display = 'none'; });
        if (btnGoSkins) btnGoSkins.addEventListener('click', showSkinsView);
        if (btnGoWear) btnGoWear.addEventListener('click', () => alert("Clothing store coming soon!"));
        if (btnGoCoins) btnGoCoins.addEventListener('click', () => alert("Coins store coming soon!"));

        function showStoreView() { storeView.style.display = 'block'; skinsView.style.display = 'none'; wearView.style.display = 'none'; coinsView.style.display = 'none'; }
        function showSkinsView() { storeView.style.display = 'none'; skinsView.style.display = 'block'; renderCategories(); if (CATEGORIES.length > 0) selectCategory(CATEGORIES[0]); }
        function renderCategories() {
            storeGroupsList.innerHTML = '';
            CATEGORIES.forEach(cat => {
                const li = document.createElement('li'); li.innerText = cat; if (cat === currentCategory) li.classList.add('pressed');
                li.addEventListener('click', () => selectCategory(cat)); storeGroupsList.appendChild(li);
            });
        }
        function selectCategory(cat: string) {
            currentCategory = cat; const items = storeGroupsList.getElementsByTagName('li');
            for (let i = 0; i < items.length; i++) items[i].classList.toggle('pressed', items[i].innerText === cat);
            if (skinDescCont) skinDescCont.innerText = cat + " Skins"; currentStoreSkinIndex = 0; updateStoreCanvas();
        }
        function updateStoreCanvas() {
            const skins = SKINS_BY_CATEGORY[currentCategory] || []; if (skins.length === 0) return;
            if (currentStoreSkinIndex >= skins.length) currentStoreSkinIndex = 0; if (currentStoreSkinIndex < 0) currentStoreSkinIndex = skins.length - 1;
            const skin = skins[currentStoreSkinIndex]; const ctx = storeCanv.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, storeCanv.width, storeCanv.height);
                const img = new Image(); img.src = `/skins/${skin.file}`;
                img.onload = () => { const aspect = img.width / img.height; const h = 100; const w = h * aspect; ctx.drawImage(img, (storeCanv.width - w) / 2, (storeCanv.height - h) / 2, w, h); };
            }
            if (skinIdDisplay) skinIdDisplay.innerText = skin.id; selectedSkin = skin.file; skinPreviewImg.src = `/skins/${skin.file}`;
        }
        storePrev.addEventListener('click', () => { currentStoreSkinIndex--; updateStoreCanvas(); });
        storeNext.addEventListener('click', () => { currentStoreSkinIndex++; updateStoreCanvas(); });
        if (skinNext) skinNext.addEventListener('click', () => { currentSkinIndex++; if (currentSkinIndex >= AVAILABLE_SKINS.length) currentSkinIndex = 0; updateSkinPreview(); });
        if (skinPrev) skinPrev.addEventListener('click', () => { currentSkinIndex--; if (currentSkinIndex < 0) currentSkinIndex = AVAILABLE_SKINS.length - 1; updateSkinPreview(); });
        function updateSkinPreview() { if (AVAILABLE_SKINS.length === 0) return; const skin = AVAILABLE_SKINS[currentSkinIndex]; skinPreviewImg.src = `/skins/${skin.file}`; selectedSkin = skin.file; }
        window.addEventListener('resize', () => { app.renderer.resize(window.innerWidth, window.innerHeight); });
        btnPlay.addEventListener('click', startGame); btnRestart.addEventListener('click', startGame); btnGoHome.addEventListener('click', goHome);
        console.log("Game Initialization Complete");

    } catch (e) {
        console.error("Game Initialization Failed:", e); alert("Game Init Error: " + e);
    }
})();