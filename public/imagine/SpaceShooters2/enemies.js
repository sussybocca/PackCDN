// ==================== ENEMIES.JS ====================
// ULTRA COMPLEX EDITION: Adaptive AI, Q-Learning, Enemy Archetypes, Cross‑Game Profiling
console.log('enemies.js loaded — MEGA COMPLEX AI EDITION');

// ========== GLOBAL FRAME COUNTER (set by game.js) ==========
let globalFrame = 0;
function setGlobalFrame(frame) { globalFrame = frame; }

// ========== DEEP PLAYER PROFILING & Q‑LEARNING ==========
const playerProfile = {
    totalGames: 0,
    totalFrames: 0,
    avgPlayerX: 0.5,
    avgPlayerY: 0.8,
    shotCount: 0,
    moveLeftCount: 0,
    moveRightCount: 0,
    moveUpCount: 0,
    moveDownCount: 0,
    // Advanced stats
    kills: 0,
    deaths: 0,
    hitsTaken: 0,
    powerUpsCollected: 0,
    accuracy: 0,                      // kills / shots
    favoriteZone: 'center',            // where player spends most time
    reactionTime: 0,                   // frames between enemy spawn and kill
    playStyle: 'balanced',              // 'aggressive', 'defensive', 'sniper', 'roamer'
    // Heatmap (10x10 grid)
    positionHeatmap: new Array(100).fill(0),

    get leftBias() {
        const total = this.moveLeftCount + this.moveRightCount;
        return total === 0 ? 0.5 : this.moveLeftCount / total;
    },
    get upBias() {
        const total = this.moveUpCount + this.moveDownCount;
        return total === 0 ? 0.5 : this.moveUpCount / total;
    },
    get shotsPerFrame() {
        return this.totalFrames === 0 ? 0 : this.shotCount / this.totalFrames;
    },
    get survivalTime() {
        return this.totalFrames;
    }
};

function loadProfile() {
    const saved = localStorage.getItem('spaceShooters_playerProfile');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(playerProfile, data);
            console.log('Deep player profile loaded', playerProfile);
        } catch (e) { console.warn('Failed to load profile', e); }
    }
}
function saveProfile() {
    localStorage.setItem('spaceShooters_playerProfile', JSON.stringify(playerProfile));
}
function updateProfile(gameStats) {
    playerProfile.totalGames++;
    const oldWeight = playerProfile.totalGames - 1;
    playerProfile.avgPlayerX = (playerProfile.avgPlayerX * oldWeight + gameStats.avgX) / playerProfile.totalGames;
    playerProfile.avgPlayerY = (playerProfile.avgPlayerY * oldWeight + gameStats.avgY) / playerProfile.totalGames;
    playerProfile.shotCount += gameStats.shotsFired;
    playerProfile.moveLeftCount += gameStats.leftMoves;
    playerProfile.moveRightCount += gameStats.rightMoves;
    playerProfile.moveUpCount += gameStats.upMoves;
    playerProfile.moveDownCount += gameStats.downMoves;
    playerProfile.totalFrames += gameStats.totalFrames;
    playerProfile.kills += gameStats.kills;
    playerProfile.hitsTaken += gameStats.hits;
    if (gameStats.death) playerProfile.deaths++;
    playerProfile.powerUpsCollected += gameStats.powerUps || 0;
    // Update heatmap
    if (gameStats.positionGrid) {
        for (let i = 0; i < 100; i++) {
            playerProfile.positionHeatmap[i] = (playerProfile.positionHeatmap[i] * oldWeight + gameStats.positionGrid[i]) / playerProfile.totalGames;
        }
    }
    // Determine playstyle
    if (playerProfile.accuracy > 0.3 && playerProfile.shotsPerFrame > 0.15) playerProfile.playStyle = 'aggressive';
    else if (playerProfile.accuracy > 0.5 && playerProfile.shotsPerFrame < 0.05) playerProfile.playStyle = 'sniper';
    else if (playerProfile.upBias > 0.7) playerProfile.playStyle = 'roamer';
    else playerProfile.playStyle = 'balanced';

    saveProfile();
}
window.enemyLearning = { loadProfile, updateProfile, getProfile: () => playerProfile, setGlobalFrame };
loadProfile();

// ========== Q‑LEARNING REINFORCEMENT MODULE ==========
const qLearner = {
    qTable: {},
    state: null,
    lastAction: null,
    learningRate: 0.1,
    discount: 0.9,
    exploration: 0.2,
    actions: [
        'increaseSpeed', 'decreaseSpeed', 'moreEnemies', 'fewerEnemies',
        'sinePattern', 'straightPattern', 'spawnLeft', 'spawnRight',
        'homingBullets', 'spreadBullets', 'kamikazeMode', 'shieldEnemies'
    ],
    getState() {
        const p = playerProfile;
        const r = liveLearning.recentStats;
        return `${Math.floor(r.avgX*10)},${Math.floor(r.avgY*10)},${Math.floor(r.shotRate*10)},${Math.floor(p.kills/10)},${waveManager.waveCount}`;
    },
    chooseAction(state) {
        if (!this.qTable[state]) {
            this.qTable[state] = {};
            this.actions.forEach(a => this.qTable[state][a] = 0);
        }
        if (Math.random() < this.exploration) {
            return this.actions[Math.floor(Math.random() * this.actions.length)];
        } else {
            let best = this.actions[0];
            let bestVal = this.qTable[state][best];
            for (let a of this.actions) {
                if (this.qTable[state][a] > bestVal) {
                    bestVal = this.qTable[state][a];
                    best = a;
                }
            }
            return best;
        }
    },
    update(state, action, reward, nextState) {
        if (!this.qTable[state]) this.qTable[state] = {};
        if (!this.qTable[nextState]) this.qTable[nextState] = {};
        const maxNext = Math.max(...this.actions.map(a => this.qTable[nextState][a] || 0));
        const current = this.qTable[state][action] || 0;
        this.qTable[state][action] = current + this.learningRate * (reward + this.discount * maxNext - current);
    },
    applyAction(action) {
        switch(action) {
            case 'increaseSpeed': waveManager.enemySpeedMultiplier *= 1.2; break;
            case 'decreaseSpeed': waveManager.enemySpeedMultiplier *= 0.8; break;
            case 'moreEnemies': waveManager.enemyCountMultiplier = (waveManager.enemyCountMultiplier || 1) + 0.3; break;
            case 'fewerEnemies': waveManager.enemyCountMultiplier = Math.max(0.5, (waveManager.enemyCountMultiplier || 1) - 0.3); break;
            case 'sinePattern': waveManager.forceSinePattern = true; break;
            case 'straightPattern': waveManager.forceSinePattern = false; break;
            case 'spawnLeft': waveManager.spawnBias = 'left'; break;
            case 'spawnRight': waveManager.spawnBias = 'right'; break;
            case 'homingBullets': waveManager.bulletType = 'homing'; break;
            case 'spreadBullets': waveManager.bulletType = 'spread'; break;
            case 'kamikazeMode': waveManager.kamikazeMode = true; break;
            case 'shieldEnemies': waveManager.shieldChance = 0.3; break;
        }
    }
};

// ========== REAL‑TIME LIVE LEARNING (ENHANCED) ==========
const liveLearning = {
    playerPositions: [],
    playerShots: [],
    playerHits: [],
    playerKills: [],
    lastAnalysisFrame: 0,
    analysisInterval: 60,
    recentStats: { avgX:0.5, avgY:0.5, shotRate:0, hitRate:0, killRate:0 },
    update(screenX, screenY, shotThisFrame, hitThisFrame, killThisFrame) {
        const normX = screenX / 1024;
        const normY = screenY / 768;
        this.playerPositions.push({ x: normX, y: normY, frame: globalFrame });
        if (this.playerPositions.length > 60) this.playerPositions.shift();
        if (shotThisFrame) {
            this.playerShots.push(globalFrame);
            if (this.playerShots.length > 20) this.playerShots.shift();
        }
        if (hitThisFrame) {
            this.playerHits.push(globalFrame);
            if (this.playerHits.length > 10) this.playerHits.shift();
        }
        if (killThisFrame) {
            this.playerKills.push(globalFrame);
            if (this.playerKills.length > 20) this.playerKills.shift();
        }
        if (globalFrame - this.lastAnalysisFrame >= this.analysisInterval) {
            this.analyse();
            this.lastAnalysisFrame = globalFrame;
        }
    },
    analyse() {
        if (this.playerPositions.length < 10) return;
        const avgX = this.playerPositions.reduce((s,p)=>s+p.x,0) / this.playerPositions.length;
        const avgY = this.playerPositions.reduce((s,p)=>s+p.y,0) / this.playerPositions.length;
        const shotRate = this.playerShots.filter(ts => globalFrame - ts < 60).length / 60;
        const hitRate = this.playerHits.filter(ts => globalFrame - ts < 60).length / 60;
        const killRate = this.playerKills.filter(ts => globalFrame - ts < 60).length / 60;
        this.recentStats = { avgX, avgY, shotRate, hitRate, killRate };
        // Update waveManager params
        if (avgX < 0.3) waveManager.spawnBias = 'right';
        else if (avgX > 0.7) waveManager.spawnBias = 'left';
        else waveManager.spawnBias = 'random';
        waveManager.enemySpeedMultiplier = (avgY < 0.5) ? 1.3 : 1.0;
        waveManager.forceSinePattern = (shotRate > 0.1);
        // Q-learning step
        const state = qLearner.getState();
        const action = qLearner.chooseAction(state);
        qLearner.applyAction(action);
        const reward = killRate * 10 - hitRate * 5;
        const nextState = qLearner.getState();
        qLearner.update(state, action, reward, nextState);
    },
    reset() {
        this.playerPositions = [];
        this.playerShots = [];
        this.playerHits = [];
        this.playerKills = [];
        this.lastAnalysisFrame = 0;
    },
    getRecentStats() { return this.recentStats; }
};

// ========== ENEMY TYPES WITH ADVANCED BEHAVIORS ==========
class Enemy {
    constructor(x, y, type = 'enemy1', learning = null, speedMultiplier = 1.0, pattern = 'down') {
        this.x = x;
        this.y = y;
        this.type = type;          // enemy1, enemy2, kamikaze, sniper, spawner, shielded, boss
        this.width = 40;
        this.height = 40;
        this.speed = this.getBaseSpeed() * speedMultiplier;
        this.hp = this.getBaseHP();
        this.pattern = pattern;    // down, sine, zigzag, circle, chase, retreat
        this.bulletType = 'normal'; // normal, homing, spread, laser
        this.kamikaze = false;
        this.shielded = false;
        this.frame = 0;
        this.lastShot = 0;
        this.children = [];        // for spawner
        this.targetX = 0;          // for chasing
        this.targetY = 0;
        this.state = 'active';      // active, spawning, dying
        this.angle = 0;

        // Apply cross‑game learning
        if (learning) {
            if (learning.leftBias > 0.6) this.x = 800 + Math.random() * 200;
            else if (learning.leftBias < 0.4) this.x = 50 + Math.random() * 200;
            if (learning.upBias > 0.7) this.speed *= 1.25;
            if (learning.shotsPerFrame > 0.05) {
                this.speed *= 1.4;
                this.pattern = 'sine';
            }
            if (learning.playStyle === 'aggressive') this.bulletType = 'spread';
            else if (learning.playStyle === 'sniper') this.bulletType = 'homing';
        }

        // Type-specific overrides
        switch(type) {
            case 'kamikaze':
                this.kamikaze = true;
                this.speed *= 1.5;
                this.hp = 1;
                break;
            case 'sniper':
                this.bulletType = 'homing';
                this.speed *= 0.7;
                break;
            case 'spawner':
                this.hp = 3;
                this.speed *= 0.5;
                break;
            case 'shielded':
                this.shielded = true;
                this.hp = 2;
                break;
            case 'boss':
                this.width = 80;
                this.height = 80;
                this.hp = 50;
                this.speed = 1;
                this.bulletType = 'spread';
                this.pattern = 'circle';
                break;
        }
    }

    getBaseSpeed() {
        return (this.type === 'boss') ? 1 : 2;
    }
    getBaseHP() {
        switch(this.type) {
            case 'enemy1': return 1;
            case 'enemy2': return 2;
            case 'kamikaze': return 1;
            case 'sniper': return 1;
            case 'spawner': return 3;
            case 'shielded': return 2;
            case 'boss': return 50;
            default: return 1;
        }
    }

    update(playerX, playerY) {
        if (this.state !== 'active') return;

        // Movement patterns
        switch(this.pattern) {
            case 'down':
                this.y += this.speed;
                break;
            case 'sine':
                this.y += this.speed;
                this.x += Math.sin(this.frame * 0.1) * 1.5;
                break;
            case 'zigzag':
                this.y += this.speed;
                this.x += (this.frame % 60 < 30) ? 1 : -1;
                break;
            case 'circle':
                this.y += this.speed * 0.5;
                this.angle += 0.05;
                this.x += Math.cos(this.angle) * 2;
                break;
            case 'chase':
                {
                    const dx = playerX - this.x;
                    const dy = playerY - this.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        this.x += (dx / dist) * this.speed * 0.7;
                        this.y += (dy / dist) * this.speed * 0.7;
                    }
                }
                break;
            case 'retreat':
                {
                    const dx = this.x - playerX;
                    const dy = this.y - playerY;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        this.x += (dx / dist) * this.speed * 0.7;
                        this.y += (dy / dist) * this.speed * 0.7;
                    }
                }
                break;
        }

        // Kamikaze logic
        if (this.kamikaze) {
            const dx = playerX - this.x;
            const dy = playerY - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 150) this.speed = 6;
            if (dist < 40) this.state = 'exploding';
        }

        // Shield regeneration
        if (this.type === 'shielded' && this.hp < 2 && this.frame % 60 === 0) this.hp++;

        this.frame++;
    }

    shoot(playerX, playerY) {
        if (this.type === 'spawner' && this.frame % 120 === 0 && this.children.length < 3) {
            return { action: 'spawn', x: this.x + 20, y: this.y + 20, type: 'enemy1' };
        }
        let bullets = [];
        const cx = this.x + this.width/2;
        const cy = this.y + this.height/2;
        if (this.bulletType === 'homing') {
            const dx = playerX - cx;
            const dy = playerY - cy;
            const angle = Math.atan2(dy, dx);
            bullets.push({
                x: cx - 2.5, y: cy, w:5, h:5,
                speedX: Math.cos(angle) * 5,
                speedY: Math.sin(angle) * 5,
                type: 'homing', homing: true
            });
        } else if (this.bulletType === 'spread') {
            for (let i = -1; i <= 1; i++) {
                bullets.push({
                    x: cx - 2.5, y: cy, w:5, h:10,
                    speedX: i * 2, speedY: 4,
                    type: 'spread'
                });
            }
        } else {
            bullets.push({
                x: cx - 2.5, y: cy, w:5, h:10,
                speed: 4,
                type: 'normal'
            });
        }
        return bullets;
    }
}

// ========== WAVE MANAGER (ADVANCED) ==========
const waveManager = {
    enemies: [],
    waveCount: 0,
    spawnTimer: 0,
    spawnInterval: 30,
    enemiesPerWave: 5,
    active: true,
    learningProfile: null,
    // Real‑time adaptation
    spawnBias: 'random',
    enemySpeedMultiplier: 1.0,
    forceSinePattern: false,
    enemyCountMultiplier: 1.0,
    bulletType: 'normal',
    kamikazeMode: false,
    shieldChance: 0,
    bossFight: false,
    bossEnemy: null,

    update() {
        if (!this.active) return;
        this.spawnTimer--;
        if (this.spawnTimer <= 0 && !this.bossFight && this.enemies.length < 20) {
            this.spawnEnemy();
            this.spawnTimer = this.spawnInterval;
        }
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(player.x, player.y);
            if (e.y > 768 || e.state === 'exploding') {
                if (e.state === 'exploding') {
                    // create explosion particles
                    if (window.particleSystem) window.particleSystem.explosion(e.x, e.y);
                }
                this.enemies.splice(i, 1);
            }
        }
        // Spawner minions
        this.enemies.forEach(e => {
            if (e.type === 'spawner' && e.children.length < 3 && Math.random() < 0.01) {
                const child = new Enemy(e.x + 20, e.y + 20, 'enemy1', this.learningProfile, this.enemySpeedMultiplier, 'chase');
                this.enemies.push(child);
                e.children.push(child);
            }
        });
    },

    spawnEnemy() {
        let x;
        switch (this.spawnBias) {
            case 'left':  x = 50 + Math.random() * 200; break;
            case 'right': x = 800 + Math.random() * 200; break;
            default:      x = 50 + Math.random() * (1024 - 100);
        }
        const y = -40;
        const baseCount = 5 + this.waveCount;
        const count = Math.floor(baseCount * (this.enemyCountMultiplier || 1));
        // Determine enemy type pool based on wave and settings
        let type;
        const r = Math.random();
        if (this.bossFight) {
            type = 'boss';
        } else if (this.waveCount >= 10 && r < 0.1) {
            type = 'boss';
            this.bossFight = true;
        } else if (r < 0.2) type = 'kamikaze';
        else if (r < 0.35) type = 'sniper';
        else if (r < 0.5) type = 'spawner';
        else if (r < 0.65) type = 'shielded';
        else type = (Math.random() < 0.7) ? 'enemy1' : 'enemy2';

        const pattern = this.forceSinePattern ? 'sine' : (this.waveCount % 2 === 0 ? 'down' : 'zigzag');
        const enemy = new Enemy(x, y, type, this.learningProfile, this.enemySpeedMultiplier, pattern);
        if (this.kamikazeMode && type !== 'boss') enemy.kamikaze = true;
        if (Math.random() < this.shieldChance) enemy.shielded = true;
        this.enemies.push(enemy);
    },

    startWave() {
        this.waveCount++;
        this.spawnInterval = Math.max(20, 60 - this.waveCount * 2);
        if (this.learningProfile && this.learningProfile.shotsPerFrame > 0.05) {
            this.spawnInterval = Math.max(15, this.spawnInterval - 5);
        }
        this.enemiesPerWave = 5 + this.waveCount;
        this.spawnTimer = 30;
        console.log(`Wave ${this.waveCount} started`);
    },

    reset() {
        this.enemies = [];
        this.waveCount = 0;
        this.spawnTimer = 0;
        this.spawnBias = 'random';
        this.enemySpeedMultiplier = 1.0;
        this.forceSinePattern = false;
        this.enemyCountMultiplier = 1.0;
        this.bulletType = 'normal';
        this.kamikazeMode = false;
        this.shieldChance = 0;
        this.bossFight = false;
        liveLearning.reset();
    },

    applyLearning() {
        this.learningProfile = playerProfile.totalGames > 0 ? playerProfile : null;
    },

    getSerializedEnemies() {
        return this.enemies.map(e => ({ x:e.x, y:e.y, type:e.type, pattern:e.pattern }));
    }
};

// ========== POWER‑UP SYSTEM ==========
const powerUpTypes = ['health', 'rapidfire', 'spread', 'homing', 'shield', 'points'];
class PowerUp {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 20;
        this.height = 20;
        this.type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];
        this.speed = 2;
    }
    update() { this.y += this.speed; }
}

// ========== PARTICLE SYSTEM ==========
const particles = [];
function createExplosion(x, y) {
    for (let i = 0; i < 10; i++) {
        particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 5,
            vy: (Math.random() - 0.5) * 5,
            life: 30,
            color: `hsl(${Math.random()*60 + 20}, 100%, 50%)`
        });
    }
}
function updateParticles() {
    for (let i = particles.length-1; i>=0; i--) {
        const p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) particles.splice(i,1);
    }
}

// Expose everything
window.waveManager = waveManager;
window.liveLearning = liveLearning;
window.Enemy = Enemy;
window.qLearner = qLearner;
window.powerUpTypes = powerUpTypes;
window.PowerUp = PowerUp;
window.particles = particles;
window.createExplosion = createExplosion;
window.updateParticles = updateParticles;
