// ==================== GAME.JS ====================
// ULTRA COMPLEX EDITION: Deep mechanics, power‑ups, particles, skill tree, advanced AI integration
window.addEventListener('load', () => {
    console.log('Page loaded, calling loadAssets...');
    loadAssets(startGame);
});

function startGame() {
    console.log('startGame() called – assets loaded, game starting');

    if (typeof waveManager === 'undefined') {
        console.error('waveManager not found!');
        window.waveManager = { enemies: [], waveCount: 0, update: function() {}, startWave: function() {} };
    }
    if (waveManager.applyLearning) waveManager.applyLearning();

    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ========== BACKGROUND MUSIC ==========
    function startBackgroundMusic() {
        if (assets.sounds && assets.sounds.bgm) {
            assets.sounds.bgm.loop = true;
            let vol = localStorage.getItem('spaceShooters_volume') || 70;
            assets.sounds.bgm.volume = (vol/100) * 0.5;
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

    if (assets.videos && assets.videos.background) {
        assets.videos.background.play().catch(e => {
            const playVideoOnGesture = () => {
                assets.videos.background.play().catch(() => {});
                document.removeEventListener('click', playVideoOnGesture);
                document.removeEventListener('keydown', playVideoOnGesture);
            };
            document.addEventListener('click', playVideoOnGesture);
            document.addEventListener('keydown', playVideoOnGesture);
        });
    }

    // ========== GAME STATE ==========
    let player = {
        x: 512 - 25,
        y: 650,
        width: 50,
        height: 50,
        speed: 5,
        lives: 3,
        invincible: 0,
        shield: 0,                 // shield power‑up timer
        powerups: [],               // active power‑ups
        skillPoints: 0,             // for upgrades
        skills: {
            rapidFire: 0,
            spread: 0,
            homing: 0,
            shield: 0,
            speed: 0
        }
    };

    let bullets = [];
    let enemyBullets = [];
    let powerups = [];
    let score = 0;
    let gameOver = false;
    let frame = 0;
    let killCount = 0;
    let currentLevel = 1;
    let levelMessage = '';
    let levelMessageTimer = 0;
    let cheatMenuOpen = false;

    // Input
    const keys = {};
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);
    let shootCooldown = 0;

    // Touch controls (simplified for mobile)
    let touchActive = false;
    let touchX = 0, touchY = 0;
    let fireTouch = false;
    canvas.addEventListener('touchstart', (e) => {
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
                touchX = canvasX;
                touchY = canvasY;
            } else {
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
            if (canvasX < canvas.width / 2) {
                touchActive = true;
                touchX = canvasX;
                touchY = (touch.clientY - rect.top) * scaleY;
                break;
            }
        }
    });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.touches.length === 0) {
            touchActive = false;
            fireTouch = false;
        } else {
            let hasMovement = false;
            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            for (let i = 0; i < e.touches.length; i++) {
                const touch = e.touches[i];
                const canvasX = (touch.clientX - rect.left) * scaleX;
                if (canvasX < canvas.width / 2) {
                    hasMovement = true;
                    break;
                }
            }
            touchActive = hasMovement;
        }
    });
    canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        touchActive = false;
        fireTouch = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // Stats for learning
    let gameStats = {
        avgX: 0, avgY: 0,
        shotsFired: 0,
        leftMoves: 0, rightMoves: 0, upMoves: 0, downMoves: 0,
        totalFrames: 0,
        kills: 0,
        hits: 0,
        death: false,
        powerUps: 0,
        positionGrid: new Array(100).fill(0)
    };

    // ========== MULTIPLAYER ==========
    let multiplayerActive = false;
    let remotePlayer = null;
    let isHost = false;
    if (window.network) {
        window.network.onRemoteUpdate = (data) => {
            remotePlayer = data;
        };
        window.network.onDisconnect = () => {
            multiplayerActive = false;
            remotePlayer = null;
        };
    }

    // ========== CHEAT MENU ==========
    canvas.addEventListener('click', (e) => {
        if (e.button === 0) {
            e.preventDefault();
            cheatMenuOpen = !cheatMenuOpen;
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
            case 'extralife': player.lives++; document.getElementById('lives').textContent = player.lives; levelMessage = 'EXTRA LIFE!'; levelMessageTimer = 60; break;
            case 'skillpoints': player.skillPoints += 5; break;
            case 'godmode': player.invincible = 999999; break;
        }
    };

    // Start first wave
    waveManager.waveCount = currentLevel;
    waveManager.startWave();
    if (window.cheatSystem) window.cheatSystem.updateUnlocks(currentLevel);
    levelMessage = `LEVEL ${currentLevel}`;
    levelMessageTimer = 60;

    // ========== GAME LOOP ==========
    function gameLoop() {
        if (gameOver) {
            document.getElementById('gameOver').style.display = 'block';
            gameStats.death = true;
            if (window.enemyLearning) window.enemyLearning.updateProfile(gameStats);
            if (window.network) window.network.disconnect();
            return;
        }
        if (!cheatMenuOpen) update();
        draw();
        requestAnimationFrame(gameLoop);
    }

    // ========== BULLET GENERATION (with skill scaling) ==========
    function createBullets(playerX, playerY, playerWidth) {
        const bulletsArray = [];
        let baseWidth = 4;
        let baseHeight = 15;
        let baseSpeed = -8;

        const scale = 1 + killCount * 0.02;
        const bulletWidth = baseWidth * scale;
        const bulletHeight = baseHeight * scale;
        const bulletSpeed = baseSpeed * (1 + killCount * 0.01);

        // Skill effects
        const rapidFireLevel = player.skills.rapidFire;
        const spreadLevel = player.skills.spread;
        const homingLevel = player.skills.homing;

        let bulletCount = 1 + Math.floor(killCount / 10) + rapidFireLevel;
        if (bulletCount > 30) bulletCount = 30;

        const spreadAngle = 0.1 * (1 + spreadLevel);
        const centerX = playerX + playerWidth / 2;
        const startY = playerY - 10;

        if (bulletCount === 1) {
            bulletsArray.push({
                x: centerX - bulletWidth / 2,
                y: startY,
                w: bulletWidth,
                h: bulletHeight,
                speed: bulletSpeed,
                homing: homingLevel > 0 ? homingLevel : 0
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
                    speedY: speedY,
                    homing: homingLevel > 0 ? homingLevel : 0
                });
            }
        }
        return bulletsArray;
    }

    // ========== UPDATE ==========
    function update() {
        if (window.enemyLearning) window.enemyLearning.setGlobalFrame(frame);

        // Player movement (keyboard)
        const leftPressed = keys['ArrowLeft'] || keys['KeyA'];
        const rightPressed = keys['ArrowRight'] || keys['KeyD'];
        const upPressed = keys['ArrowUp'] || keys['KeyW'];
        const downPressed = keys['ArrowDown'] || keys['KeyS'];

        if (leftPressed) player.x = Math.max(0, player.x - player.speed);
        if (rightPressed) player.x = Math.min(1024 - player.width, player.x + player.speed);
        if (upPressed) player.y = Math.max(0, player.y - player.speed);
        if (downPressed) player.y = Math.min(768 - player.height, player.y + player.speed);

        // Touch movement
        if (touchActive) {
            const dx = touchX - (player.x + player.width/2);
            const dy = touchY - (player.y + player.height/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 5) {
                player.x += (dx / dist) * player.speed;
                player.y += (dy / dist) * player.speed;
                player.x = Math.max(0, Math.min(1024 - player.width, player.x));
                player.y = Math.max(0, Math.min(768 - player.height, player.y));
            }
        }

        // Stats update
        gameStats.totalFrames++;
        gameStats.avgX = (gameStats.avgX * (gameStats.totalFrames-1) + (player.x/canvas.width)) / gameStats.totalFrames;
        gameStats.avgY = (gameStats.avgY * (gameStats.totalFrames-1) + (player.y/canvas.height)) / gameStats.totalFrames;
        if (leftPressed) gameStats.leftMoves++;
        if (rightPressed) gameStats.rightMoves++;
        if (upPressed) gameStats.upMoves++;
        if (downPressed) gameStats.downMoves++;

        // Position grid for heatmap
        const gridX = Math.floor(player.x / (canvas.width/10));
        const gridY = Math.floor(player.y / (canvas.height/10));
        const idx = gridY * 10 + gridX;
        if (idx >= 0 && idx < 100) gameStats.positionGrid[idx]++;

        // Cheat checks
        const rapidFireActive = window.cheatSystem ? window.cheatSystem.isCheatActive('rapidfire') : (player.skills.rapidFire > 0);
        const invincibleActive = window.cheatSystem ? window.cheatSystem.isCheatActive('invincible') : false;
        const autoAimActive = window.cheatSystem ? window.cheatSystem.isCheatActive('autotarget') : false;

        // Shooting
        const shotThisFrame = (keys['Space'] || fireTouch) && shootCooldown <= 0;
        if (shotThisFrame) {
            const newBullets = createBullets(player.x, player.y, player.width);
            bullets.push(...newBullets);
            playSound('laser', 0.5);
            shootCooldown = rapidFireActive ? 3 : 8;
            gameStats.shotsFired += newBullets.length;
            fireTouch = false;
        }
        if (shootCooldown > 0) shootCooldown--;

        // Live learning
        if (window.liveLearning) {
            const hitThisFrame = false; // track hits separately (would need collision feedback)
            const killThisFrame = false; // same
            window.liveLearning.update(player.x, player.y, shotThisFrame, false, false);
        }

        // Wave manager update
        waveManager.update();

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            if (b.speedX !== undefined) {
                b.x += b.speedX;
                b.y += b.speedY;
            } else {
                b.y += b.speed;
            }
            // Homing effect
            if (b.homing && waveManager.enemies.length > 0) {
                let closest = null;
                let closestDist = Infinity;
                waveManager.enemies.forEach(e => {
                    const dx = (e.x + e.width/2) - (b.x + b.w/2);
                    const dy = (e.y + e.height/2) - (b.y + b.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = e;
                    }
                });
                if (closest) {
                    const dx = (closest.x + closest.width/2) - (b.x + b.w/2);
                    const dy = (closest.y + closest.height/2) - (b.y + b.h/2);
                    const angle = Math.atan2(dy, dx);
                    const speed = Math.sqrt(b.speedX*b.speedX + b.speedY*b.speedY) || 5;
                    b.speedX = Math.cos(angle) * speed * 0.98;
                    b.speedY = Math.sin(angle) * speed * 0.98;
                }
            }
            if (b.y + b.h < 0 || b.y > canvas.height) bullets.splice(i, 1);
        }

        // Enemy shooting
        if (frame % 30 === 0) {
            waveManager.enemies.forEach(enemy => {
                let shootProb = 0.2 + currentLevel * 0.02;
                if (enemy.type === 'sniper') shootProb *= 1.5;
                if (Math.random() < shootProb) {
                    const bulletsOrSpawn = enemy.shoot(player.x, player.y);
                    if (Array.isArray(bulletsOrSpawn)) {
                        enemyBullets.push(...bulletsOrSpawn);
                    } else if (bulletsOrSpawn && bulletsOrSpawn.action === 'spawn') {
                        const newEnemy = new Enemy(bulletsOrSpawn.x, bulletsOrSpawn.y, bulletsOrSpawn.type, waveManager.learningProfile, waveManager.enemySpeedMultiplier, 'chase');
                        waveManager.enemies.push(newEnemy);
                    } else if (bulletsOrSpawn) {
                        enemyBullets.push(bulletsOrSpawn);
                    }
                }
            });
        }

        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const eb = enemyBullets[i];
            if (eb.speedX !== undefined) {
                eb.x += eb.speedX;
                eb.y += eb.speedY;
            } else {
                eb.y += eb.speed;
            }
            if (eb.y > canvas.height) enemyBullets.splice(i, 1);
            // Homing enemy bullets
            if (eb.homing) {
                const dx = player.x + player.width/2 - (eb.x + eb.w/2);
                const dy = player.y + player.height/2 - (eb.y + eb.h/2);
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(eb.speedX*eb.speedX + eb.speedY*eb.speedY) || 4;
                eb.speedX = Math.cos(angle) * speed * 0.98;
                eb.speedY = Math.sin(angle) * speed * 0.98;
            }
        }

        // Power‑up updates
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            p.update();
            if (p.y > canvas.height) powerups.splice(i, 1);
        }

        // Collisions: player bullets vs enemies
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = waveManager.enemies.length - 1; j >= 0; j--) {
                const e = waveManager.enemies[j];
                if (b.x < e.x + e.width && b.x + b.w > e.x &&
                    b.y < e.y + e.height && b.y + b.h > e.y) {
                    bullets.splice(i, 1);
                    e.hp--;
                    if (e.hp <= 0) {
                        waveManager.enemies.splice(j, 1);
                        score += 10;
                        killCount++;
                        gameStats.kills++;
                        // Chance to drop power‑up
                        if (Math.random() < 0.1) {
                            powerups.push(new PowerUp(e.x, e.y));
                        }
                        // Explosion particles
                        if (window.createExplosion) createExplosion(e.x, e.y);
                        playSound('explode', 0.7);
                    }
                    break;
                }
            }
        }

        // Enemy bullets vs player
        if (player.invincible <= 0 && !invincibleActive && player.shield <= 0) {
            for (let i = enemyBullets.length - 1; i >= 0; i--) {
                const eb = enemyBullets[i];
                if (eb.x < player.x + player.width && eb.x + eb.w > player.x &&
                    eb.y < player.y + player.height && eb.y + eb.h > player.y) {
                    enemyBullets.splice(i, 1);
                    player.lives--;
                    gameStats.hits++;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        } else {
            if (player.invincible > 0) player.invincible--;
            if (player.shield > 0) player.shield--;
        }

        // Enemies vs player
        if (player.invincible <= 0 && !invincibleActive && player.shield <= 0) {
            for (let i = waveManager.enemies.length - 1; i >= 0; i--) {
                const e = waveManager.enemies[i];
                if (e.x < player.x + player.width && e.x + e.width > player.x &&
                    e.y < player.y + player.height && e.y + e.height > player.y) {
                    waveManager.enemies.splice(i, 1);
                    player.lives--;
                    gameStats.hits++;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        }

        // Power‑up collection
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            if (p.x < player.x + player.width && p.x + p.width > player.x &&
                p.y < player.y + player.height && p.y + p.height > player.y) {
                // Apply power‑up effect
                switch(p.type) {
                    case 'health': player.lives = Math.min(5, player.lives + 1); break;
                    case 'rapidfire': player.skills.rapidFire = Math.min(3, player.skills.rapidFire + 1); break;
                    case 'spread': player.skills.spread = Math.min(3, player.skills.spread + 1); break;
                    case 'homing': player.skills.homing = Math.min(3, player.skills.homing + 1); break;
                    case 'shield': player.shield = 300; break;
                    case 'points': score += 50; break;
                }
                gameStats.powerUps++;
                powerups.splice(i, 1);
                playSound('powerup', 0.8);
            }
        }

        // Multiplayer sync
        if (multiplayerActive && window.network) {
            window.network.sendPlayerState({
                x: player.x, y: player.y,
                width: player.width, height: player.height,
                lives: player.lives
            });
            if (isHost && window.network.sendEnemyState) {
                window.network.sendEnemyState(waveManager.getSerializedEnemies());
            }
        }

        // Update UI
        document.getElementById('lives').textContent = player.lives;
        document.getElementById('score').textContent = score;

        // Level progression
        if (waveManager.enemies.length === 0 && !waveManager.bossFight) {
            currentLevel++;
            waveManager.waveCount = currentLevel;
            waveManager.startWave();
            if (window.cheatSystem) window.cheatSystem.updateUnlocks(currentLevel);
            levelMessage = `LEVEL ${currentLevel}`;
            levelMessageTimer = 60;
            player.speed = Math.min(8, 5 + currentLevel * 0.2);
            player.skillPoints += 1; // earn a skill point per level
        }

        if (levelMessageTimer > 0) levelMessageTimer--;

        // Auto‑aim cheat
        if (autoAimActive && waveManager.enemies.length > 0) {
            bullets.forEach(b => {
                let closest = null;
                let closestDist = Infinity;
                waveManager.enemies.forEach(e => {
                    const dx = (e.x + e.width/2) - (b.x + b.w/2);
                    const dy = (e.y + e.height/2) - (b.y + b.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < closestDist) { closestDist = dist; closest = e; }
                });
                if (closest) {
                    const targetX = closest.x + closest.width/2;
                    const targetY = closest.y + closest.height/2;
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

        // Update particles
        if (window.updateParticles) window.updateParticles();

        frame++;
    }

    // ========== DRAW ==========
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background (video or starfield)
        if (assets.videos && assets.videos.background && assets.videos.background.readyState >= 2) {
            ctx.drawImage(assets.videos.background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = 'white';
            for (let i = 0; i < 100; i++) {
                let sx = (i * 73) % canvas.width;
                let sy = (frame * 0.5 + i * 23) % canvas.height;
                ctx.fillRect(sx, sy, 2, 2);
            }
        }

        // Level message
        if (levelMessageTimer > 0) {
            ctx.font = '40px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffd966';
            ctx.textAlign = 'center';
            ctx.fillText(levelMessage, canvas.width/2, 300);
        }

        // Player
        if (player.invincible <= 0 || Math.floor(frame / 5) % 2 === 0) {
            if (assets.images && assets.images.player) {
                ctx.drawImage(assets.images.player, player.x, player.y, player.width, player.height);
            } else {
                ctx.fillStyle = 'cyan';
                ctx.fillRect(player.x, player.y, player.width, player.height);
            }
        }
        // Shield overlay
        if (player.shield > 0) {
            ctx.globalAlpha = 0.3;
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(player.x + player.width/2, player.y + player.height/2, 30, 0, 2*Math.PI);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Enemies
        waveManager.enemies.forEach(e => {
            if (assets.images && assets.images[e.type]) {
                ctx.drawImage(assets.images[e.type], e.x, e.y, e.width, e.height);
            } else {
                ctx.fillStyle = 'red';
                ctx.fillRect(e.x, e.y, e.width, e.height);
            }
            // Shielded indicator
            if (e.shielded) {
                ctx.strokeStyle = 'cyan';
                ctx.lineWidth = 2;
                ctx.strokeRect(e.x, e.y, e.width, e.height);
            }
        });

        // Remote player
        if (multiplayerActive && remotePlayer) {
            if (assets.images && assets.images.player) {
                ctx.globalAlpha = 0.7;
                ctx.drawImage(assets.images.player, remotePlayer.x, remotePlayer.y, remotePlayer.width || 50, remotePlayer.height || 50);
                ctx.globalAlpha = 1.0;
            } else {
                ctx.fillStyle = 'purple';
                ctx.fillRect(remotePlayer.x, remotePlayer.y, remotePlayer.width || 50, remotePlayer.height || 50);
            }
        }

        // Player bullets
        bullets.forEach(b => {
            if (assets.images && assets.images.bullet) {
                ctx.drawImage(assets.images.bullet, b.x, b.y, b.w, b.h);
            } else {
                ctx.fillStyle = 'yellow';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        });

        // Enemy bullets
        enemyBullets.forEach(b => {
            if (assets.images && assets.images.enemyBullet) {
                ctx.drawImage(assets.images.enemyBullet, b.x, b.y, b.w, b.h);
            } else {
                ctx.fillStyle = 'orange';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        });

        // Power‑ups
        powerups.forEach(p => {
            ctx.fillStyle = 'lime';
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = 'white';
            ctx.font = '12px monospace';
            ctx.fillText(p.type[0], p.x+5, p.y+15);
        });

        // Particles
        if (window.particles) {
            window.particles.forEach(p => {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, 3, 3);
            });
        }

        // Cheat menu
        if (cheatMenuOpen && window.cheatSystem) {
            window.cheatSystem.drawCheatMenu(ctx, canvas.width, canvas.height);
        }

        // Multiplayer status
        if (multiplayerActive) {
            ctx.font = '16px "Press Start 2P", monospace';
            ctx.fillStyle = '#0ff';
            ctx.textAlign = 'right';
            ctx.fillText('MULTIPLAYER', canvas.width - 20, 40);
        }

        // Stats
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        ctx.fillText(`KILLS: ${killCount}`, 20, 100);
        ctx.fillStyle = '#0ff';
        ctx.textAlign = 'right';
        ctx.fillText(`LEVEL: ${currentLevel}`, canvas.width - 20, 100);
        ctx.fillStyle = '#fff';
        ctx.font = '12px monospace';
        ctx.fillText(`SP: ${player.skillPoints}`, 20, 140);
        if (player.shield > 0) {
            ctx.fillStyle = 'blue';
            ctx.fillText(`SHIELD: ${Math.floor(player.shield/60)}s`, 20, 160);
        }

        // Touch hint
        if ('ontouchstart' in window) {
            ctx.font = '12px "Press Start 2P", monospace';
            ctx.fillStyle = '#aaa';
            ctx.textAlign = 'center';
            ctx.fillText('← MOVE  |  FIRE →', canvas.width/2, canvas.height - 20);
        }
    }

    gameLoop();
}
