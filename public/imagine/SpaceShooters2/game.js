// ==================== GAME.JS ====================
// Wait for assets to load
window.addEventListener('load', () => {
    console.log('Page loaded, calling loadAssets...');
    loadAssets(startGame);
});

function startGame() {
    console.log('startGame() called – assets loaded, game starting');

    // Ensure waveManager exists (from enemies.js)
    if (typeof waveManager === 'undefined') {
        console.error('waveManager not found! Check that enemies.js is loaded before game.js');
        window.waveManager = {
            enemies: [],
            waveCount: 0,
            update: function() {},
            startWave: function() { console.log('Dummy wave started'); }
        };
    }

    // Apply learning from previous games (enemies adapt to your style)
    if (waveManager.applyLearning) {
        waveManager.applyLearning();
    }

    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ========== PERFORMANCE MODE (for low-end devices) ==========
    const performanceMode = localStorage.getItem('spaceShooters_performance') === 'true';

    // ========== OPEN WORLD PARAMETERS ==========
    const WORLD_SIZE = 10000;                        // virtual universe size (pixels)
    let worldX = 512;                                 // player's absolute X in world
    let worldY = 650;                                 // player's absolute Y in world
    const SECTOR_SIZE = 1024;                         // size of one sector (matches canvas)
    let currentSector = { x: 0, y: 0 };
    let loadedSectors = new Set();                    // track loaded sectors
    let sectorEnemies = new Map();                     // key "x,y" -> array of enemies (world coordinates)

    // Camera: top‑left corner of viewport in world coordinates
    let camera = { x: 0, y: 0 };

    // ========== GAME STATE ==========
    let player = {
        width: 50,
        height: 50,
        speed: 5,
        lives: 3,
        invincible: 0
    };

    let bullets = [];
    let enemyBullets = [];
    let score = 0;
    let gameOver = false;
    let frame = 0;

    // Kill count for bullet progression (unlimited)
    let killCount = 0;

    // Level tracking - classic arcade progression (global)
    let currentLevel = 1;
    let levelMessage = '';
    let levelMessageTimer = 0;

    // Cheat system integration
    let cheatMenuOpen = false;

    // Input handling (keyboard + touch)
    const keys = {};
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);

    // ========== MOBILE TOUCH CONTROLS ==========
    let touchActive = false;
    let touchX = 0, touchY = 0;          // target position (world coordinates)
    let fireTouch = false;                 // fire on next update

    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const canvasX = (touch.clientX - rect.left) * scaleX;
            const canvasY = (touch.clientY - rect.top) * scaleY;

            // Left half of screen = movement, right half = fire
            if (canvasX < canvas.width / 2) {
                // Movement touch
                touchActive = true;
                // Convert screen to world position
                touchX = camera.x + canvasX;
                touchY = camera.y + canvasY;
            } else {
                // Fire touch
                fireTouch = true;
            }
        }
    });

    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            const canvasX = (touch.clientX - rect.left) * scaleX;
            const canvasY = (touch.clientY - rect.top) * scaleY;

            if (canvasX < canvas.width / 2) {
                touchActive = true;
                touchX = camera.x + canvasX;
                touchY = camera.y + canvasY;
                break; // only care about one movement touch
            }
        }
    });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        // If no touches left, disable movement and fire
        if (e.touches.length === 0) {
            touchActive = false;
            fireTouch = false;
        } else {
            // Check if any remaining touches are movement
            let hasMovement = false;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                const canvasX = (touch.clientX - rect.left) * scaleX;
                if (canvasX < canvas.width / 2) {
                    hasMovement = true;
                    break;
                }
            }
            touchActive = hasMovement;
            // Fire flag is momentary, reset after each shot
        }
    });

    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        touchActive = false;
        fireTouch = false;
    });

    // Prevent context menu on canvas
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Shooting cooldown
    let shootCooldown = 0;

    // ========== PLAYER STATS TRACKING (FOR CROSS‑GAME LEARNING) ==========
    let gameStats = {
        avgX: 0,
        avgY: 0,
        shotsFired: 0,
        leftMoves: 0,
        rightMoves: 0,
        upMoves: 0,
        downMoves: 0,
        totalFrames: 0
    };

    // ========== MULTIPLAYER (LAN) ==========
    let multiplayerActive = false;
    let remotePlayer = null;
    let isHost = false;

    if (window.network) {
        window.network.onRemoteUpdate = (data) => {
            remotePlayer = data;
            if (window.multiplayer) window.multiplayer.updateRemotePlayer(data);
        };
        window.network.onDisconnect = () => {
            multiplayerActive = false;
            remotePlayer = null;
            console.log('Remote player disconnected');
        };
    }

    // ========== CHEAT MENU TOGGLE (LEFT CLICK) ==========
    canvas.addEventListener('click', (e) => {
        if (e.button === 0) {
            e.preventDefault();
            cheatMenuOpen = !cheatMenuOpen;
            if (cheatMenuOpen) console.log('Cheat menu opened');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (cheatMenuOpen) {
            e.preventDefault();
            if (window.cheatSystem) {
                window.cheatSystem.handleCheatKey(e);
                if (e.key === 'Escape') cheatMenuOpen = false;
            }
        }
    });

    window.applyCheatEffect = (cheatId) => {
        switch(cheatId) {
            case 'extralife':
                player.lives++;
                document.getElementById('lives').textContent = player.lives;
                levelMessage = 'EXTRA LIFE!';
                levelMessageTimer = 60;
                break;
        }
    };

    // ========== BACKGROUND MUSIC ==========
    function startBackgroundMusic() {
        if (assets.sounds && assets.sounds.bgm) {
            assets.sounds.bgm.loop = true;
            let vol = localStorage.getItem('spaceShooters_volume');
            if (vol === null) vol = 70;
            assets.sounds.bgm.volume = (vol / 100) * 0.5;
            assets.sounds.bgm.play().catch(e => console.log('BGM play failed:', e));
        }
    }

    startBackgroundMusic();
    const userInteraction = () => {
        startBackgroundMusic();
        document.removeEventListener('click', userInteraction);
        document.removeEventListener('keydown', userInteraction);
        document.removeEventListener('touchstart', userInteraction);
    };
    document.addEventListener('click', userInteraction);
    document.addEventListener('keydown', userInteraction);
    document.addEventListener('touchstart', userInteraction);

    // Play background video if available
    if (assets.videos && assets.videos.background) {
        assets.videos.background.play().catch(e => {
            console.log('Background video autoplay failed:', e);
            const playVideoOnGesture = () => {
                assets.videos.background.play().catch(() => {});
                document.removeEventListener('click', playVideoOnGesture);
                document.removeEventListener('keydown', playVideoOnGesture);
            };
            document.addEventListener('click', playVideoOnGesture);
            document.addEventListener('keydown', playVideoOnGesture);
        });
    }

    // Start first level (global, not per sector)
    waveManager.waveCount = currentLevel;
    waveManager.startWave();
    if (window.cheatSystem) window.cheatSystem.updateUnlocks(currentLevel);
    levelMessage = `LEVEL ${currentLevel}`;
    levelMessageTimer = 60;

    // ========== SECTOR MANAGEMENT ==========
    function getSectorKey(wx, wy) {
        return `${Math.floor(wx / SECTOR_SIZE)},${Math.floor(wy / SECTOR_SIZE)}`;
    }

    function generateSector(sx, sy) {
        const key = `${sx},${sy}`;
        if (sectorEnemies.has(key)) return;

        const enemies = [];
        // Procedurally generate enemies based on sector coordinates and level
        const enemyCount = 3 + Math.floor(Math.random() * 5) + currentLevel;
        for (let i = 0; i < enemyCount; i++) {
            const x = sx * SECTOR_SIZE + Math.random() * SECTOR_SIZE;
            const y = sy * SECTOR_SIZE + Math.random() * SECTOR_SIZE;
            const type = Math.random() < 0.7 ? 'enemy1' : 'enemy2';
            const enemy = new Enemy(x, y, type, waveManager.learningProfile);
            enemy.pattern = waveManager.waveCount % 2 === 0 ? 'down' : 'sine';
            enemies.push(enemy);
        }
        sectorEnemies.set(key, enemies);
        loadedSectors.add(key);
        console.log(`Generated sector ${key} with ${enemies.length} enemies`);
    }

    function updateSector() {
        const sx = Math.floor(worldX / SECTOR_SIZE);
        const sy = Math.floor(worldY / SECTOR_SIZE);
        if (currentSector.x !== sx || currentSector.y !== sy) {
            currentSector = { x: sx, y: sy };
            // Generate current and adjacent sectors (9 sectors)
            for (let dx = -1; dx <= 1; dx++) {
                for (let dy = -1; dy <= 1; dy++) {
                    generateSector(sx + dx, sy + dy);
                }
            }
        }
    }

    function getNearbyEnemies() {
        const nearby = [];
        for (let enemies of sectorEnemies.values()) {
            nearby.push(...enemies);
        }
        return nearby;
    }

    // Generate initial sectors around player
    updateSector();

    // ========== GAME LOOP ==========
    function gameLoop() {
        if (gameOver) {
            document.getElementById('gameOver').style.display = 'block';
            if (window.enemyLearning) window.enemyLearning.updateProfile(gameStats);
            if (window.network) window.network.disconnect();
            return;
        }

        if (!cheatMenuOpen) {
            update();
        }
        draw();

        requestAnimationFrame(gameLoop);
    }

    // ========== HELPER: Generate bullets based on kill count ==========
    function createBullets(playerX, playerY, playerWidth, baseSpeed, rapidFireActive) {
        const bulletsArray = [];
        let baseWidth = 4;
        let baseHeight = 15;
        let baseSpeedValue = -8;

        const scale = 1 + killCount * 0.02;
        const bulletWidth = baseWidth * scale;
        const bulletHeight = baseHeight * scale;
        const bulletSpeed = baseSpeedValue * (1 + killCount * 0.01);

        let bulletCount = 1 + Math.floor(killCount / 10);
        if (performanceMode) {
            bulletCount = Math.min(bulletCount, 10);
        } else if (bulletCount > 20) {
            bulletCount = 20;
        }

        const spreadAngle = 0.1;
        const centerX = playerX + playerWidth / 2;
        const startY = playerY - 10;

        if (bulletCount === 1) {
            bulletsArray.push({
                x: centerX - bulletWidth / 2,
                y: startY,
                w: bulletWidth,
                h: bulletHeight,
                speed: bulletSpeed
            });
        } else {
            for (let i = 0; i < bulletCount; i++) {
                const angleOffset = (i - (bulletCount - 1) / 2) * spreadAngle;
                const speedX = Math.sin(angleOffset) * Math.abs(bulletSpeed) * 0.5;
                const speedY = bulletSpeed * Math.cos(angleOffset);
                bulletsArray.push({
                    x: centerX - bulletWidth / 2,
                    y: startY,
                    w: bulletWidth,
                    h: bulletHeight,
                    speedX: speedX,
                    speedY: speedY
                });
            }
        }
        return bulletsArray;
    }

    // ========== UPDATE ==========
    function update() {
        if (window.enemyLearning) window.enemyLearning.setGlobalFrame(frame);

        // ----- Player movement (keyboard) -----
        const leftPressed = keys['ArrowLeft'] || keys['KeyA'];
        const rightPressed = keys['ArrowRight'] || keys['KeyD'];
        const upPressed = keys['ArrowUp'] || keys['KeyW'];
        const downPressed = keys['ArrowDown'] || keys['KeyS'];

        let moveX = 0, moveY = 0;
        if (leftPressed) moveX -= 1;
        if (rightPressed) moveX += 1;
        if (upPressed) moveY -= 1;
        if (downPressed) moveY += 1;

        // ----- Mobile touch movement -----
        if (touchActive) {
            // Move player towards touch point
            const dx = touchX - worldX;
            const dy = touchY - worldY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 5) { // dead zone
                // Normalize direction
                const normX = dx / dist;
                const normY = dy / dist;
                moveX += normX;
                moveY += normY;
            }
        }

        // Normalize diagonal speed
        if (moveX !== 0 && moveY !== 0) {
            const length = Math.sqrt(moveX*moveX + moveY*moveY);
            moveX = moveX / length;
            moveY = moveY / length;
        }

        worldX += moveX * player.speed;
        worldY += moveY * player.speed;
        worldX = Math.max(0, Math.min(WORLD_SIZE - player.width, worldX));
        worldY = Math.max(0, Math.min(WORLD_SIZE - player.height, worldY));

        // Update camera
        camera.x = worldX - canvas.width / 2;
        camera.y = worldY - canvas.height / 2;
        camera.x = Math.max(0, Math.min(camera.x, WORLD_SIZE - canvas.width));
        camera.y = Math.max(0, Math.min(camera.y, WORLD_SIZE - canvas.height));

        // Update sector based on new position
        updateSector();

        // Update stats for cross‑game learning
        gameStats.totalFrames++;
        gameStats.avgX = (gameStats.avgX * (gameStats.totalFrames - 1) + (worldX / WORLD_SIZE)) / gameStats.totalFrames;
        gameStats.avgY = (gameStats.avgY * (gameStats.totalFrames - 1) + (worldY / WORLD_SIZE)) / gameStats.totalFrames;
        if (leftPressed) gameStats.leftMoves++;
        if (rightPressed) gameStats.rightMoves++;
        if (upPressed) gameStats.upMoves++;
        if (downPressed) gameStats.downMoves++;

        // Check active cheats
        const rapidFireActive = window.cheatSystem ? window.cheatSystem.isCheatActive('rapidfire') : false;
        const invincibleActive = window.cheatSystem ? window.cheatSystem.isCheatActive('invincible') : false;
        const autoAimActive = window.cheatSystem ? window.cheatSystem.isCheatActive('autotarget') : false;
        const oneHitKillActive = window.cheatSystem ? window.cheatSystem.isCheatActive('onehitkill') : false;

        // Shooting (keyboard or touch fire)
        const shotThisFrame = (keys['Space'] || fireTouch) && shootCooldown <= 0;
        if (shotThisFrame) {
            const newBullets = createBullets(worldX, worldY, player.width, -8, rapidFireActive);
            bullets.push(...newBullets);
            playSound('laser', 0.5);
            shootCooldown = rapidFireActive ? 5 : 10;
            gameStats.shotsFired += newBullets.length;
            fireTouch = false; // reset touch fire
        }
        if (shootCooldown > 0) shootCooldown--;

        // Real‑time learning
        if (window.liveLearning) {
            window.liveLearning.update(worldX, worldY, shotThisFrame);
        }

        // Get all enemies near player
        const allEnemies = getNearbyEnemies();

        // Update enemies
        allEnemies.forEach(e => e.update(worldX, worldY));

        // Update player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (b.speedX !== undefined) {
                b.x += b.speedX;
                b.y += b.speedY;
            } else {
                b.y += b.speed;
            }
            if (b.y + b.h < 0 || b.y > WORLD_SIZE || b.x + b.w < 0 || b.x > WORLD_SIZE) {
                bullets.splice(i, 1);
            }
        }

        // Enemy shooting
        let enemyShootRate = Math.min(0.5, 0.2 + currentLevel * 0.03);
        if (window.enemyLearning && window.enemyLearning.getProfile().shotsPerFrame > 0.05) {
            enemyShootRate += 0.1;
        }
        if (frame % 30 === 0) {
            allEnemies.forEach(enemy => {
                if (Math.random() < enemyShootRate) {
                    const eb = enemy.shoot();
                    enemyBullets.push(eb);
                }
            });
        }

        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            enemyBullets[i].y += enemyBullets[i].speed;
            if (enemyBullets[i].y > WORLD_SIZE) enemyBullets.splice(i, 1);
        }

        // Collisions: player bullets vs enemies
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = allEnemies.length - 1; j >= 0; j--) {
                const e = allEnemies[j];
                if (b.x < e.x + e.width &&
                    b.x + b.w > e.x &&
                    b.y < e.y + e.height &&
                    b.y + b.h > e.y) {
                    bullets.splice(i, 1);
                    // Remove enemy from sector
                    const key = getSectorKey(e.x, e.y);
                    const sectorList = sectorEnemies.get(key);
                    if (sectorList) {
                        const idx = sectorList.indexOf(e);
                        if (idx !== -1) sectorList.splice(idx, 1);
                    }
                    score += 10;
                    killCount++;
                    playSound('explode', 0.7);
                    break;
                }
            }
        }

        // Enemy bullets vs player
        if (player.invincible <= 0 && !invincibleActive) {
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eb = enemyBullets[i];
                if (eb.x < worldX + player.width && eb.x + eb.w > worldX &&
                    eb.y < worldY + player.height && eb.y + eb.h > worldY) {
                    enemyBullets.splice(i, 1);
                    player.lives--;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        } else {
            player.invincible--;
        }

        // Enemies vs player
        if (player.invincible <= 0 && !invincibleActive) {
            for (let i = allEnemies.length - 1; i >= 0; i--) {
                const e = allEnemies[i];
                if (e.x < worldX + player.width && e.x + e.width > worldX &&
                    e.y < worldY + player.height && e.y + e.height > worldY) {
                    const key = getSectorKey(e.x, e.y);
                    const sectorList = sectorEnemies.get(key);
                    if (sectorList) {
                        const idx = sectorList.indexOf(e);
                        if (idx !== -1) sectorList.splice(idx, 1);
                    }
                    player.lives--;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        }

        // Multiplayer sync
        if (multiplayerActive && window.network) {
            window.network.sendPlayerState({
                x: worldX, y: worldY,
                width: player.width, height: player.height,
                lives: player.lives
            });
            if (isHost && window.network.sendEnemyState) {
                const nearbyEnemies = allEnemies.filter(e => {
                    const dx = e.x - worldX;
                    const dy = e.y - worldY;
                    return Math.abs(dx) < 2000 && Math.abs(dy) < 2000;
                }).map(e => ({ x: e.x, y: e.y, type: e.type }));
                window.network.sendEnemyState(nearbyEnemies);
            }
        }

        // Update UI
        document.getElementById('lives').textContent = player.lives;
        document.getElementById('score').textContent = score;

        // Level progression (global, based on kills)
        if (killCount > currentLevel * 10) {
            currentLevel++;
            waveManager.waveCount = currentLevel;
            waveManager.startWave();
            if (window.cheatSystem) window.cheatSystem.updateUnlocks(currentLevel);
            levelMessage = `LEVEL ${currentLevel}`;
            levelMessageTimer = 60;
            player.speed = Math.min(8, 5 + currentLevel * 0.2);
        }

        if (levelMessageTimer > 0) levelMessageTimer--;

        // Auto‑aim cheat
        if (autoAimActive && allEnemies.length > 0) {
            bullets.forEach(b => {
                let closestDist = Infinity;
                let closestEnemy = null;
                allEnemies.forEach(e => {
                    const dx = (e.x + e.width/2) - (b.x + b.w/2);
                    const dy = (e.y + e.height/2) - (b.y + b.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closestEnemy = e;
                    }
                });
                if (closestEnemy) {
                    const targetX = closestEnemy.x + closestEnemy.width/2;
                    const targetY = closestEnemy.y + closestEnemy.height/2;
                    const dx = targetX - (b.x + b.w/2);
                    const dy = targetY - (b.y + b.h/2);
                    if (b.speedX !== undefined) {
                        b.speedX += Math.sign(dx) * 0.2;
                        b.speedY += Math.sign(dy) * 0.2;
                        const sp = Math.sqrt(b.speedX*b.speedX + b.speedY*b.speedY);
                        if (sp > 0) {
                            b.speedX = (b.speedX / sp) * Math.abs(b.speedY);
                            b.speedY = (b.speedY / sp) * Math.abs(b.speedY);
                        }
                    } else {
                        b.x += Math.sign(dx) * Math.min(Math.abs(dx)*0.1, 2);
                    }
                }
            });
        }

        frame++;
    }

    // ========== DRAW ==========
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background (video or starfield)
        if (assets.videos && assets.videos.background && assets.videos.background.readyState >= 2) {
            ctx.drawImage(assets.videos.background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = 'white';
            const starCount = performanceMode ? 30 : 100;
            for (let i = 0; i < starCount; i++) {
                // Stars move slightly with camera to give parallax effect
                let sx = (i * 73 + camera.x * 0.2) % canvas.width;
                let sy = (frame * 0.5 + i * 23 + camera.y * 0.2) % canvas.height;
                ctx.fillRect(sx, sy, 2, 2);
            }
        }

        // Draw level message
        if (levelMessageTimer > 0) {
            ctx.font = '40px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffd966';
            ctx.textAlign = 'center';
            ctx.fillText(levelMessage, canvas.width/2, 300);
        }

        // Draw player (convert world to screen)
        const playerScreenX = worldX - camera.x;
        const playerScreenY = worldY - camera.y;
        if (player.invincible <= 0 || Math.floor(frame / 5) % 2 === 0) {
            if (assets.images && assets.images.player) {
                ctx.drawImage(assets.images.player, playerScreenX, playerScreenY, player.width, player.height);
            } else {
                ctx.fillStyle = 'cyan';
                ctx.fillRect(playerScreenX, playerScreenY, player.width, player.height);
            }
        }

        // Draw enemies
        const allEnemies = getNearbyEnemies();
        allEnemies.forEach(e => {
            const ex = e.x - camera.x;
            const ey = e.y - camera.y;
            if (ex + e.width > 0 && ex < canvas.width && ey + e.height > 0 && ey < canvas.height) {
                if (assets.images && assets.images[e.type]) {
                    ctx.drawImage(assets.images[e.type], ex, ey, e.width, e.height);
                } else {
                    ctx.fillStyle = 'red';
                    ctx.fillRect(ex, ey, e.width, e.height);
                }
            }
        });

        // Draw remote player
        if (multiplayerActive && remotePlayer) {
            const rx = remotePlayer.x - camera.x;
            const ry = remotePlayer.y - camera.y;
            if (rx + 50 > 0 && rx < canvas.width && ry + 50 > 0 && ry < canvas.height) {
                if (assets.images && assets.images.player) {
                    ctx.globalAlpha = 0.7;
                    ctx.drawImage(assets.images.player, rx, ry, remotePlayer.width || 50, remotePlayer.height || 50);
                    ctx.globalAlpha = 1.0;
                } else {
                    ctx.fillStyle = 'purple';
                    ctx.fillRect(rx, ry, remotePlayer.width || 50, remotePlayer.height || 50);
                }
            }
        }

        // Draw player bullets
        bullets.forEach(b => {
            const bx = b.x - camera.x;
            const by = b.y - camera.y;
            if (bx + b.w > 0 && bx < canvas.width && by + b.h > 0 && by < canvas.height) {
                if (assets.images && assets.images.bullet) {
                    ctx.drawImage(assets.images.bullet, bx, by, b.w, b.h);
                } else {
                    ctx.fillStyle = 'yellow';
                    ctx.fillRect(bx, by, b.w, b.h);
                }
            }
        });

        // Draw enemy bullets
        enemyBullets.forEach(b => {
            const bx = b.x - camera.x;
            const by = b.y - camera.y;
            if (bx + b.w > 0 && bx < canvas.width && by + b.h > 0 && by < canvas.height) {
                if (assets.images && assets.images.enemyBullet) {
                    ctx.drawImage(assets.images.enemyBullet, bx, by, b.w, b.h);
                } else {
                    ctx.fillStyle = 'orange';
                    ctx.fillRect(bx, by, b.w, b.h);
                }
            }
        });

        // Draw cheat menu
        if (cheatMenuOpen && window.cheatSystem) {
            window.cheatSystem.drawCheatMenu(ctx, canvas.width, canvas.height);
        }

        // Draw multiplayer status
        if (multiplayerActive) {
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'right';
            ctx.fillText('MULTIPLAYER', canvas.width - 20, 40);
        }

        // Draw kill count
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        ctx.fillText(`KILLS: ${killCount}`, 20, 100);

        // Draw current level
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#0ff';
        ctx.textAlign = 'right';
        ctx.fillText(`LEVEL: ${currentLevel}`, canvas.width - 20, 100);

        // Draw touch hint (if on mobile)
        if ('ontouchstart' in window) {
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('← MOVE  |  FIRE →', canvas.width/2, canvas.height - 20);
        }
    }

    // Start game loop
    gameLoop();
}
