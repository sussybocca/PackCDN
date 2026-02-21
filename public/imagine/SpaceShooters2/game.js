// ==================== GAME.JS ====================
// No imports – THREE and FBXLoader are now global from script tags

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

    // Apply learning from previous games
    if (waveManager.applyLearning) {
        waveManager.applyLearning();
    }

    // Canvas setup
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // ========== THREE.JS SETUP (only if THREE available) ==========
    let renderer3D, scene, camera;
    let threeAvailable = false;
    if (typeof THREE !== 'undefined' && typeof FBXLoader !== 'undefined') {
        try {
            threeAvailable = true;
            renderer3D = new THREE.WebGLRenderer({ alpha: true, antialias: true });
            renderer3D.setSize(canvas.width, canvas.height);
            renderer3D.setPixelRatio(window.devicePixelRatio);
            renderer3D.domElement.style.position = 'absolute';
            renderer3D.domElement.style.top = '0';
            renderer3D.domElement.style.left = '0';
            renderer3D.domElement.style.zIndex = '1';
            canvas.parentNode.insertBefore(renderer3D.domElement, canvas);
            canvas.style.position = 'absolute';
            canvas.style.zIndex = '2';

            scene = new THREE.Scene();
            scene.background = null;

            camera = new THREE.OrthographicCamera(0, canvas.width, canvas.height, 0, -1000, 1000);
            camera.position.set(0, 0, 1000);
            camera.lookAt(0, 0, 0);

            const ambientLight = new THREE.AmbientLight(0x404060);
            scene.add(ambientLight);
            const dirLight = new THREE.DirectionalLight(0xffffff, 1);
            dirLight.position.set(1, 2, 1);
            scene.add(dirLight);
        } catch (e) {
            console.warn('Three.js setup failed, falling back to 2D only', e);
            threeAvailable = false;
        }
    } else {
        console.warn('Three.js or FBXLoader not loaded – 2D only');
    }

    // ========== PERFORMANCE MODE ==========
    const performanceMode = localStorage.getItem('spaceShooters_performance') === 'true';

    // ========== GAME STATE ==========
    let player = {
        x: 512 - 25,
        y: 650,
        width: 50,
        height: 50,
        speed: 5,
        lives: 3,
        invincible: 0,
        shield: 0,
        rapidFire: 0,
        spreadShot: 0,
        homingShot: 0,
        speedBoost: 0,
        // 3D model reference
        model: null,
        mixer: null
    };

    let bullets = [];
    let enemyBullets = [];
    let enemies = [];
    let powerups = [];
    let particles = [];
    let score = 0;
    let gameOver = false;
    let frame = 0;
    let killCount = 0;
    let killStreak = 0;
    let maxKillStreak = 0;
    let currentLevel = 1;
    let levelMessage = '';
    let levelMessageTimer = 0;
    let cheatMenuOpen = false;

    // Input handling
    const keys = {};
    window.addEventListener('keydown', e => keys[e.code] = true);
    window.addEventListener('keyup', e => keys[e.code] = false);

    // ========== ENHANCED MOBILE TOUCH CONTROLS ==========
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
            const canvasY = (touch.clientY - rect.top) * scaleY;

            if (canvasX < canvas.width / 2) {
                touchActive = true;
                touchX = canvasX;
                touchY = canvasY;
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

    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    let shootCooldown = 0;

    // ========== ENHANCED PLAYER STATS TRACKING ==========
    let gameStats = {
        avgX: 0,
        avgY: 0,
        shotsFired: 0,
        leftMoves: 0,
        rightMoves: 0,
        upMoves: 0,
        downMoves: 0,
        totalFrames: 0,
        kills: 0,
        hits: 0,
        killStreak: 0,
        powerups: 0
    };

    // ========== MULTIPLAYER ==========
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

    // ========== CHEAT MENU ==========
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
            case 'maxpower':
                player.rapidFire = 300;
                player.spreadShot = 300;
                player.homingShot = 300;
                player.shield = 300;
                break;
            case 'killall':
                enemies = [];
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

    // Initialize wave manager
    waveManager.enemies = enemies;
    waveManager.waveCount = currentLevel;
    waveManager.startWave();
    if (window.cheatSystem) window.cheatSystem.updateUnlocks(currentLevel);
    levelMessage = `LEVEL ${currentLevel}`;
    levelMessageTimer = 60;

    // ========== 3D MODEL CREATION FUNCTIONS (only if Three.js available) ==========
    function createPlayerModel() {
        if (!threeAvailable || !assets.models.player) return;
        try {
            const model = assets.models.player.clone();
            scene.add(model);
            player.model = model;

            if (assets.animations.player && assets.animations.player.length) {
                player.mixer = new THREE.AnimationMixer(model);
                const action = player.mixer.clipAction(assets.animations.player[0]);
                action.play();
                assets.mixers.push(player.mixer);
            }

            updatePlayerModelPosition();
        } catch (e) {
            console.warn('Failed to create player 3D model', e);
        }
    }

    function updatePlayerModelPosition() {
        if (!threeAvailable || !player.model) return;
        try {
            const x3d = player.x + player.width / 2;
            const y3d = canvas.height - (player.y + player.height / 2);
            player.model.position.set(x3d, y3d, 0);
        } catch (e) {}
    }

    function createEnemyModel(enemy) {
        if (!threeAvailable || !assets.models.enemy1) return;
        try {
            const model = assets.models.enemy1.clone();
            scene.add(model);
            enemy.model = model;

            if (assets.animations.enemy1 && assets.animations.enemy1.length) {
                enemy.mixer = new THREE.AnimationMixer(model);
                const action = enemy.mixer.clipAction(assets.animations.enemy1[0]);
                action.play();
                assets.mixers.push(enemy.mixer);
            }

            updateEnemyModelPosition(enemy);
        } catch (e) {}
    }

    function updateEnemyModelPosition(enemy) {
        if (!threeAvailable || !enemy.model) return;
        try {
            const x3d = enemy.x + enemy.width / 2;
            const y3d = canvas.height - (enemy.y + enemy.height / 2);
            enemy.model.position.set(x3d, y3d, 0);
        } catch (e) {}
    }

    function removeEnemyModel(enemy) {
        if (!threeAvailable || !enemy.model) return;
        try {
            scene.remove(enemy.model);
            if (enemy.mixer) {
                const index = assets.mixers.indexOf(enemy.mixer);
                if (index !== -1) assets.mixers.splice(index, 1);
                enemy.mixer.stopAllAction();
            }
            enemy.model = null;
        } catch (e) {}
    }

    // Create player model immediately (if possible)
    createPlayerModel();

    // ========== POWER-UP SYSTEM ==========
    const powerUpTypes = ['health', 'rapidfire', 'spread', 'homing', 'shield', 'points'];
    
    class PowerUp {
        constructor(x, y) {
            this.x = x;
            this.y = y;
            this.width = 20;
            this.height = 20;
            this.type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
            this.speed = 2;
            this.angle = 0;
        }
        
        update() {
            this.angle += 0.05;
            this.x += Math.sin(this.angle) * 0.5;
            this.y += this.speed;
        }
    }

    // ========== PARTICLE SYSTEM ==========
    function createExplosion(x, y) {
        for (let i = 0; i < 10; i++) {
            particles.push({
                x: x + Math.random() * 40 - 20,
                y: y + Math.random() * 40 - 20,
                vx: (Math.random() - 0.5) * 4,
                vy: (Math.random() - 0.5) * 4,
                life: 30 + Math.random() * 20,
                color: `hsl(${Math.random() * 60 + 20}, 100%, 50%)`
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.1;
            p.life--;
            if (p.life <= 0) {
                particles.splice(i, 1);
            }
        }
    }

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

        // Render 3D scene if available
        if (threeAvailable && renderer3D && scene && camera) {
            try {
                renderer3D.render(scene, camera);
            } catch (e) {}
        }

        requestAnimationFrame(gameLoop);
    }

    // ========== ENHANCED BULLET GENERATION ==========
    function createBullets(playerX, playerY, playerWidth) {
        // ... (exactly as before – unchanged) ...
        const bulletsArray = [];
        let baseWidth = 4;
        let baseHeight = 15;
        let baseSpeed = -8;

        const scale = 1 + killCount * 0.02;
        const bulletWidth = baseWidth * scale;
        const bulletHeight = baseHeight * scale;
        const bulletSpeed = baseSpeed * (1 + killCount * 0.01);

        const rapidFireActive = player.rapidFire > 0 || (window.cheatSystem && window.cheatSystem.isCheatActive('rapidfire'));
        const spreadActive = player.spreadShot > 0;
        const homingActive = player.homingShot > 0;

        let bulletCount = 1 + Math.floor(killCount / 10);
        if (rapidFireActive) bulletCount += 2;
        if (bulletCount > 20) bulletCount = 20;

        const spreadAngle = spreadActive ? 0.15 : 0.1;
        const centerX = playerX + playerWidth / 2;
        const startY = playerY - 10;

        if (bulletCount === 1) {
            bulletsArray.push({
                x: centerX - bulletWidth / 2,
                y: startY,
                w: bulletWidth,
                h: bulletHeight,
                speed: bulletSpeed,
                homing: homingActive
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
                    homing: homingActive
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

        const currentSpeed = player.speed + (player.speedBoost > 0 ? 3 : 0);

        if (leftPressed) player.x = Math.max(0, player.x - currentSpeed);
        if (rightPressed) player.x = Math.min(1024 - player.width, player.x + currentSpeed);
        if (upPressed) player.y = Math.max(0, player.y - currentSpeed);
        if (downPressed) player.y = Math.min(768 - player.height, player.y + currentSpeed);

        // Touch movement
        if (touchActive) {
            const dx = touchX - (player.x + player.width/2);
            const dy = touchY - (player.y + player.height/2);
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist > 5) {
                player.x += (dx / dist) * currentSpeed;
                player.y += (dy / dist) * currentSpeed;
                player.x = Math.max(0, Math.min(1024 - player.width, player.x));
                player.y = Math.max(0, Math.min(768 - player.height, player.y));
            }
        }

        // Update 3D player position
        updatePlayerModelPosition();

        // Update stats
        gameStats.totalFrames++;
        gameStats.avgX = (gameStats.avgX * (gameStats.totalFrames - 1) + (player.x / canvas.width)) / gameStats.totalFrames;
        gameStats.avgY = (gameStats.avgY * (gameStats.totalFrames - 1) + (player.y / canvas.height)) / gameStats.totalFrames;
        if (leftPressed) gameStats.leftMoves++;
        if (rightPressed) gameStats.rightMoves++;
        if (upPressed) gameStats.upMoves++;
        if (downPressed) gameStats.downMoves++;

        // Check cheats
        const invincibleActive = window.cheatSystem ? window.cheatSystem.isCheatActive('invincible') : false;
        const autoAimActive = window.cheatSystem ? window.cheatSystem.isCheatActive('autotarget') : false;

        // Shooting
        const rapidFireActive = player.rapidFire > 0 || (window.cheatSystem && window.cheatSystem.isCheatActive('rapidfire'));
        const shotThisFrame = (keys['Space'] || fireTouch) && shootCooldown <= 0;
        
        if (shotThisFrame) {
            const newBullets = createBullets(player.x, player.y, player.width);
            bullets.push(...newBullets);
            playSound('laser', 0.5);
            shootCooldown = rapidFireActive ? 3 : 10;
            gameStats.shotsFired += newBullets.length;
            fireTouch = false;
        }
        if (shootCooldown > 0) shootCooldown--;

        // Update power-up timers
        if (player.rapidFire > 0) player.rapidFire--;
        if (player.spreadShot > 0) player.spreadShot--;
        if (player.homingShot > 0) player.homingShot--;
        if (player.shield > 0) player.shield--;
        if (player.speedBoost > 0) player.speedBoost--;

        // Live learning update
        if (window.liveLearning) {
            const hitThisFrame = false;
            const killThisFrame = gameStats.kills < (gameStats.kills + (killCount - gameStats.kills));
            window.liveLearning.update(player.x, player.y, shotThisFrame, hitThisFrame, killThisFrame);
        }

        // Wave manager update
        waveManager.update();

        // Check for newly spawned enemies that need 3D models
        if (threeAvailable) {
            enemies.forEach(enemy => {
                if (!enemy.model && assets.models.enemy1) {
                    createEnemyModel(enemy);
                }
            });
        }

        // Update enemies (including 3D positions)
        for (let i = enemies.length - 1; i >= 0; i--) {
            const e = enemies[i];
            e.update(player.x, player.y);
            if (threeAvailable) updateEnemyModelPosition(e);
            
            if (e.y > canvas.height + 100 || e.y < -100) {
                if (threeAvailable) removeEnemyModel(e);
                enemies.splice(i, 1);
            }
        }

        // Update player bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            
            if (b.homing && enemies.length > 0) {
                let closest = null;
                let closestDist = Infinity;
                for (let e of enemies) {
                    const dx = (e.x + e.width/2) - (b.x + b.w/2);
                    const dy = (e.y + e.height/2) - (b.y + b.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = e;
                    }
                }
                if (closest) {
                    const dx = (closest.x + closest.width/2) - (b.x + b.w/2);
                    const dy = (closest.y + closest.height/2) - (b.y + b.h/2);
                    const angle = Math.atan2(dy, dx);
                    const speed = Math.sqrt(b.speedX*b.speedX + b.speedY*b.speedY) || 5;
                    b.speedX = Math.cos(angle) * speed * 0.98;
                    b.speedY = Math.sin(angle) * speed * 0.98;
                }
            }

            if (b.speedX !== undefined) {
                b.x += b.speedX;
                b.y += b.speedY;
            } else {
                b.y += b.speed;
            }

            if (b.y + b.h < 0 || b.y > canvas.height || b.x + b.w < 0 || b.x > canvas.width) {
                bullets.splice(i, 1);
            }
        }

        // Enemy shooting
        if (frame % 30 === 0) {
            enemies.forEach(enemy => {
                let shootProb = 0.2 + currentLevel * 0.02;
                if (Math.random() < shootProb) {
                    const newBullets = enemy.shoot(player.x, player.y);
                    if (newBullets) {
                        if (Array.isArray(newBullets)) {
                            enemyBullets.push(...newBullets);
                        } else {
                            enemyBullets.push(newBullets);
                        }
                    }
                }
            });
        }

        // Update enemy bullets
        for (let i = enemyBullets.length - 1; i >= 0; i--) {
            const eb = enemyBullets[i];
            
            if (eb.homing) {
                const dx = player.x + player.width/2 - (eb.x + eb.w/2);
                const dy = player.y + player.height/2 - (eb.y + eb.h/2);
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(eb.speedX*eb.speedX + eb.speedY*eb.speedY) || 4;
                eb.speedX = Math.cos(angle) * speed * 0.98;
                eb.speedY = Math.sin(angle) * speed * 0.98;
            }

            if (eb.speedX !== undefined) {
                eb.x += eb.speedX;
                eb.y += eb.speedY;
            } else {
                eb.y += eb.speed;
            }

            if (eb.y > canvas.height) enemyBullets.splice(i, 1);
        }

        // Update powerups
        for (let i = powerups.length - 1; i >= 0; i--) {
            powerups[i].update();
            if (powerups[i].y > canvas.height) powerups.splice(i, 1);
        }

        // Update particles
        updateParticles();

        // Collisions: player bullets vs enemies
        for (let i = bullets.length - 1; i >= 0; i--) {
            const b = bullets[i];
            for (let j = enemies.length - 1; j >= 0; j--) {
                const e = enemies[j];
                if (b.x < e.x + e.width &&
                    b.x + b.w > e.x &&
                    b.y < e.y + e.height &&
                    b.y + b.h > e.y) {
                    
                    bullets.splice(i, 1);
                    e.hp--;
                    
                    if (e.hp <= 0) {
                        // Remove 3D model before splicing
                        if (threeAvailable) removeEnemyModel(e);
                        enemies.splice(j, 1);
                        score += 10;
                        killCount++;
                        gameStats.kills++;
                        killStreak++;
                        gameStats.killStreak = killStreak;
                        maxKillStreak = Math.max(maxKillStreak, killStreak);
                        
                        if (window.liveLearning) window.liveLearning.recordEnemyKill();
                        
                        createExplosion(e.x, e.y);
                        
                        if (Math.random() < 0.1) {
                            powerups.push(new PowerUp(e.x, e.y));
                        }
                        
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
                    killStreak = 0;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        } else {
            if (player.invincible > 0) player.invincible--;
        }

        // Enemies vs player
        if (player.invincible <= 0 && !invincibleActive && player.shield <= 0) {
            for (let i = enemies.length - 1; i >= 0; i--) {
                const e = enemies[i];
                if (e.x < player.x + player.width && e.x + e.width > player.x &&
                    e.y < player.y + player.height && e.y + e.height > player.y) {
                    if (threeAvailable) removeEnemyModel(e);
                    enemies.splice(i, 1);
                    player.lives--;
                    gameStats.hits++;
                    killStreak = 0;
                    player.invincible = 60;
                    playSound('explode', 1);
                    if (player.lives <= 0) gameOver = true;
                    break;
                }
            }
        }

        // Power-up collection
        for (let i = powerups.length - 1; i >= 0; i--) {
            const p = powerups[i];
            if (p.x < player.x + player.width && p.x + p.width > player.x &&
                p.y < player.y + player.height && p.y + p.height > player.y) {
                
                gameStats.powerups++;
                
                switch(p.type) {
                    case 'health':
                        player.lives = Math.min(5, player.lives + 1);
                        levelMessage = 'HP+';
                        break;
                    case 'rapidfire':
                        player.rapidFire = 300;
                        levelMessage = 'RAPID FIRE!';
                        break;
                    case 'spread':
                        player.spreadShot = 300;
                        levelMessage = 'SPREAD SHOT!';
                        break;
                    case 'homing':
                        player.homingShot = 300;
                        levelMessage = 'HOMING!';
                        break;
                    case 'shield':
                        player.shield = 300;
                        levelMessage = 'SHIELD!';
                        break;
                    case 'points':
                        score += 50;
                        levelMessage = '+50 POINTS';
                        break;
                }
                levelMessageTimer = 60;
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
                window.network.sendEnemyState(enemies.map(e => ({
                    x: e.x, y: e.y, type: e.type
                })));
            }
        }

        // Update UI
        document.getElementById('lives').textContent = player.lives;
        document.getElementById('score').textContent = score;

        // Level progression
        if (enemies.length === 0 && (!waveManager.bossFight || waveManager.bossDefeated)) {
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
        if (autoAimActive && enemies.length > 0) {
            bullets.forEach(b => {
                let closest = null;
                let closestDist = Infinity;
                enemies.forEach(e => {
                    const dx = (e.x + e.width/2) - (b.x + b.w/2);
                    const dy = (e.y + e.height/2) - (b.y + b.h/2);
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist < closestDist) {
                        closestDist = dist;
                        closest = e;
                    }
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

        // Update animation mixers (if any)
        if (threeAvailable && assets.mixers) {
            assets.mixers.forEach(mixer => mixer.update(1/60));
        }

        frame++;
    }

    // ========== ENHANCED DRAW ==========
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Background (2D)
        if (assets.videos && assets.videos.background && assets.videos.background.readyState >= 2) {
            ctx.drawImage(assets.videos.background, 0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = 'white';
            for (let i = 0; i < (performanceMode ? 50 : 200); i++) {
                let sx = (i * 73 + frame) % canvas.width;
                let sy = (frame * 0.5 + i * 23) % canvas.height;
                let size = Math.sin(i) * 2 + 1;
                ctx.fillRect(sx, sy, size, size);
            }
        }

        // Level message
        if (levelMessageTimer > 0) {
            ctx.font = '40px "Press Start 2P", monospace';
            ctx.fillStyle = '#ffd966';
            ctx.textAlign = 'center';
            ctx.fillText(levelMessage, canvas.width/2, 300);
        }

        // Player (2D fallback if model not present)
        if (!player.model) {
            if (player.invincible <= 0 || Math.floor(frame / 5) % 2 === 0) {
                if (assets.images && assets.images.player) {
                    ctx.drawImage(assets.images.player, player.x, player.y, player.width, player.height);
                } else {
                    ctx.fillStyle = 'cyan';
                    ctx.fillRect(player.x, player.y, player.width, player.height);
                }
            }
        }
        
        // Shield effect (2D overlay)
        if (player.shield > 0) {
            ctx.globalAlpha = 0.3 + Math.sin(frame * 0.1) * 0.1;
            ctx.fillStyle = 'blue';
            ctx.beginPath();
            ctx.arc(player.x + player.width/2, player.y + player.height/2, 35, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }

        // Enemies (2D fallback if model not present)
        enemies.forEach(e => {
            if (!e.model) {
                if (assets.images && assets.images[e.type]) {
                    ctx.drawImage(assets.images[e.type], e.x, e.y, e.width, e.height);
                } else {
                    switch(e.type) {
                        case 'enemy1': ctx.fillStyle = 'red'; break;
                        case 'enemy2': ctx.fillStyle = 'darkred'; break;
                        case 'enemy3': ctx.fillStyle = 'purple'; break;
                        case 'miniboss': ctx.fillStyle = 'orange'; break;
                        case 'boss': ctx.fillStyle = 'darkorange'; break;
                        default: ctx.fillStyle = 'red';
                    }
                    ctx.fillRect(e.x, e.y, e.width, e.height);
                }
            }
            
            // Health bar (always 2D)
            if (e.hp > 1) {
                ctx.fillStyle = 'green';
                ctx.fillRect(e.x, e.y - 10, e.width * (e.hp / e.getHPForType()), 5);
            }
        });

        // Remote player (2D)
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

        // Player bullets (2D)
        bullets.forEach(b => {
            if (assets.images && assets.images.bullet) {
                ctx.drawImage(assets.images.bullet, b.x, b.y, b.w, b.h);
            } else {
                ctx.fillStyle = b.homing ? 'cyan' : 'yellow';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        });

        // Enemy bullets (2D)
        enemyBullets.forEach(b => {
            if (assets.images && assets.images.enemyBullet) {
                ctx.drawImage(assets.images.enemyBullet, b.x, b.y, b.w, b.h);
            } else {
                ctx.fillStyle = b.homing ? 'red' : 'orange';
                ctx.fillRect(b.x, b.y, b.w, b.h);
            }
        });

        // Power-ups (2D)
        powerups.forEach(p => {
            const pulse = Math.sin(frame * 0.1) * 0.2 + 0.8;
            ctx.globalAlpha = pulse;
            switch(p.type) {
                case 'health': ctx.fillStyle = 'lime'; break;
                case 'rapidfire': ctx.fillStyle = 'yellow'; break;
                case 'spread': ctx.fillStyle = 'orange'; break;
                case 'homing': ctx.fillStyle = 'cyan'; break;
                case 'shield': ctx.fillStyle = 'blue'; break;
                case 'points': ctx.fillStyle = 'gold'; break;
            }
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.fillStyle = 'white';
            ctx.font = '14px monospace';
            ctx.fillText(p.type[0].toUpperCase(), p.x + 5, p.y + 15);
            ctx.globalAlpha = 1.0;
        });

        // Particles (2D)
        particles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = p.life / 50;
            ctx.fillRect(p.x, p.y, 3, 3);
        });
        ctx.globalAlpha = 1.0;

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

        // Stats display
        ctx.font = '16px "Press Start 2P", monospace';
        ctx.fillStyle = '#ff0';
        ctx.textAlign = 'left';
        ctx.fillText(`KILLS: ${killCount}`, 20, 100);
        ctx.fillText(`STREAK: ${killStreak}`, 20, 130);
        
        ctx.fillStyle = '#0ff';
        ctx.textAlign = 'right';
        ctx.fillText(`LEVEL: ${currentLevel}`, canvas.width - 20, 100);
        
        let yOffset = 160;
        if (player.rapidFire > 0) {
            ctx.fillStyle = 'yellow';
            ctx.fillText(`RAPID: ${Math.floor(player.rapidFire/60)}s`, 20, yOffset);
            yOffset += 25;
        }
        if (player.spreadShot > 0) {
            ctx.fillStyle = 'orange';
            ctx.fillText(`SPREAD: ${Math.floor(player.spreadShot/60)}s`, 20, yOffset);
            yOffset += 25;
        }
        if (player.homingShot > 0) {
            ctx.fillStyle = 'cyan';
            ctx.fillText(`HOMING: ${Math.floor(player.homingShot/60)}s`, 20, yOffset);
            yOffset += 25;
        }
        if (player.shield > 0) {
            ctx.fillStyle = 'blue';
            ctx.fillText(`SHIELD: ${Math.floor(player.shield/60)}s`, 20, yOffset);
        }

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
