// ==================== ENEMIES.JS ====================
console.log('enemies.js loaded (ADVANCED AI + real‑time adaptation + enemy variety)');

// ========== GLOBAL FRAME COUNTER (set by game.js) ==========
let globalFrame = 0;
function setGlobalFrame(frame) { globalFrame = frame; }

// ========== ENHANCED PLAYER PROFILE ==========
const playerProfile = {
    totalGames: 0,
    avgPlayerX: 0.5,
    avgPlayerY: 0.8,
    shotCount: 0,
    moveLeftCount: 0,
    moveRightCount: 0,
    moveUpCount: 0,
    moveDownCount: 0,
    totalFrames: 0,
    kills: 0,
    deaths: 0,
    hits: 0,
    powerupsCollected: 0,
    
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
    get accuracy() {
        return this.shotCount === 0 ? 0 : this.kills / this.shotCount;
    }
};

function loadProfile() {
    const saved = localStorage.getItem('spaceShooters_playerProfile');
    if (saved) {
        try {
            const data = JSON.parse(saved);
            Object.assign(playerProfile, data);
            console.log('Player profile loaded', playerProfile);
        } catch (e) {
            console.warn('Failed to load profile', e);
        }
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
    playerProfile.kills += gameStats.kills || 0;
    playerProfile.hits += gameStats.hits || 0;
    playerProfile.powerupsCollected += gameStats.powerups || 0;
    if (gameStats.death) playerProfile.deaths++;
    
    saveProfile();
    console.log('Profile updated', playerProfile);
}

window.enemyLearning = {
    loadProfile,
    updateProfile,
    getProfile: () => playerProfile,
    setGlobalFrame
};

loadProfile();

// ========== ADVANCED REAL‑TIME LIVE LEARNING ==========
const liveLearning = {
    playerPositions: [],
    playerShots: [],
    playerHits: [],
    playerKills: [],
    lastAnalysisFrame: 0,
    analysisInterval: 45,

    update(screenX, screenY, shotThisFrame, hitThisFrame, killThisFrame) {
        const normX = screenX / 1024;
        const normY = screenY / 768;
        this.playerPositions.push({ x: normX, y: normY, frame: globalFrame });
        if (this.playerPositions.length > 90) this.playerPositions.shift();

        if (shotThisFrame) {
            this.playerShots.push(globalFrame);
            if (this.playerShots.length > 30) this.playerShots.shift();
        }
        
        if (hitThisFrame) {
            this.playerHits.push(globalFrame);
            if (this.playerHits.length > 15) this.playerHits.shift();
        }
        
        if (killThisFrame) {
            this.playerKills.push(globalFrame);
            if (this.playerKills.length > 30) this.playerKills.shift();
        }

        if (globalFrame - this.lastAnalysisFrame >= this.analysisInterval) {
            this.analyse();
            this.lastAnalysisFrame = globalFrame;
        }
    },

    analyse() {
        if (this.playerPositions.length < 15) return;

        const avgX = this.playerPositions.reduce((sum, p) => sum + p.x, 0) / this.playerPositions.length;
        const avgY = this.playerPositions.reduce((sum, p) => sum + p.y, 0) / this.playerPositions.length;
        const recentShots = this.playerShots.filter(ts => globalFrame - ts < 60).length;
        const shotRate = recentShots / 60;
        const recentHits = this.playerHits.filter(ts => globalFrame - ts < 60).length;
        const hitRate = recentHits / 60;
        const recentKills = this.playerKills.filter(ts => globalFrame - ts < 60).length;
        const killRate = recentKills / 60;

        // Determine player style
        let playerStyle = 'balanced';
        if (shotRate > 0.15) playerStyle = 'aggressive';
        else if (killRate > 0.1 && shotRate < 0.1) playerStyle = 'sniper';
        
        // Update waveManager with advanced parameters
        waveManager.playerStyle = playerStyle;
        
        // Spawn bias based on position
        if (avgX < 0.25) {
            waveManager.spawnBias = 'right';
        } else if (avgX > 0.75) {
            waveManager.spawnBias = 'left';
        } else {
            waveManager.spawnBias = 'random';
        }

        // Dynamic difficulty
        if (killRate > 0.15) {
            waveManager.enemySpeedMultiplier = Math.min(2.0, waveManager.enemySpeedMultiplier + 0.1);
        } else if (hitRate > 0.1) {
            waveManager.enemySpeedMultiplier = Math.max(0.6, waveManager.enemySpeedMultiplier - 0.1);
        }

        // Pattern selection
        waveManager.forceSinePattern = (shotRate > 0.1);
        waveManager.forceErraticPatterns = (playerStyle === 'sniper');
    },

    recordEnemySpawn() {
        // Track spawn times if needed
    },
    
    recordEnemyKill() {
        this.playerKills.push(globalFrame);
        if (this.playerKills.length > 30) this.playerKills.shift();
    },

    reset() {
        this.playerPositions = [];
        this.playerShots = [];
        this.playerHits = [];
        this.playerKills = [];
        this.lastAnalysisFrame = 0;
    }
};

// ========== ENHANCED ENEMY CLASS WITH VARIETY ==========
class Enemy {
    constructor(x, y, type = 'enemy1', learning = null, speedMultiplier = 1.0, pattern = 'down') {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 40;
        this.speed = this.getBaseSpeed() * speedMultiplier;
        this.hp = this.getHPForType();
        this.pattern = pattern;
        this.frame = 0;
        this.lastShot = 0;
        this.angle = 0;
        this.amplitude = Math.random() * 2 + 1;
        this.frequency = Math.random() * 0.1 + 0.05;
        this.originalX = x;
        this.weaponType = this.getWeaponForType();

        // Apply cross‑game learning
        if (learning) {
            if (learning.leftBias > 0.6) {
                this.x = 800 + Math.random() * 200;
            } else if (learning.leftBias < 0.4) {
                this.x = 50 + Math.random() * 200;
            }
            if (learning.upBias > 0.7) {
                this.speed *= 1.25;
            }
            if (learning.shotsPerFrame > 0.05) {
                this.speed *= 1.4;
                this.pattern = 'sine';
            }
            if (learning.accuracy > 0.3) {
                this.hp += 1;
            }
        }
    }

    getBaseSpeed() {
        switch(this.type) {
            case 'enemy1': return 2;
            case 'enemy2': return 1.8;
            case 'enemy3': return 2.2;
            case 'miniboss': return 1.5;
            case 'boss': return 1;
            default: return 2;
        }
    }

    getHPForType() {
        switch(this.type) {
            case 'enemy1': return 1;
            case 'enemy2': return 2;
            case 'enemy3': return 3;
            case 'miniboss': return 5;
            case 'boss': return 20;
            default: return 1;
        }
    }

    getWeaponForType() {
        switch(this.type) {
            case 'enemy1': return 'single';
            case 'enemy2': return 'double';
            case 'enemy3': return 'spread';
            case 'miniboss': return 'burst';
            case 'boss': return 'homing';
            default: return 'single';
        }
    }

    update(playerX, playerY) {
        // Movement patterns
        switch(this.pattern) {
            case 'down':
                this.y += this.speed;
                break;
                
            case 'sine':
                this.y += this.speed;
                this.x += Math.sin(this.frame * this.frequency) * this.amplitude;
                break;
                
            case 'zigzag':
                this.y += this.speed;
                if (this.frame % 60 < 30) {
                    this.x += 1.5;
                } else {
                    this.x -= 1.5;
                }
                break;
                
            case 'chase':
                const dx = playerX - this.x;
                if (Math.abs(dx) > 10) {
                    this.x += Math.sign(dx) * this.speed * 0.5;
                }
                this.y += this.speed * 0.8;
                break;
                
            case 'wave':
                this.y += this.speed * 0.8;
                this.x += Math.cos(this.frame * 0.05) * 3;
                break;
                
            default:
                this.y += this.speed;
        }

        this.frame++;
    }

    shoot(playerX, playerY) {
        const bullets = [];
        const centerX = this.x + this.width / 2;
        const bottomY = this.y + this.height;
        
        switch(this.weaponType) {
            case 'single':
                bullets.push({
                    x: centerX - 2.5,
                    y: bottomY,
                    w: 5,
                    h: 10,
                    speed: 4
                });
                break;
                
            case 'double':
                bullets.push({
                    x: centerX - 10,
                    y: bottomY,
                    w: 5,
                    h: 10,
                    speed: 4
                });
                bullets.push({
                    x: centerX + 5,
                    y: bottomY,
                    w: 5,
                    h: 10,
                    speed: 4
                });
                break;
                
            case 'spread':
                for (let i = -1; i <= 1; i++) {
                    bullets.push({
                        x: centerX - 2.5,
                        y: bottomY,
                        w: 5,
                        h: 10,
                        speedX: i * 1.5,
                        speedY: 4
                    });
                }
                break;
                
            case 'burst':
                bullets.push({
                    x: centerX - 2.5,
                    y: bottomY,
                    w: 5,
                    h: 10,
                    speed: 5
                });
                break;
                
            case 'homing':
                bullets.push({
                    x: centerX - 2.5,
                    y: bottomY,
                    w: 5,
                    h: 10,
                    speed: 3,
                    homing: true
                });
                break;
        }
        
        return bullets;
    }

    // Helper for health bar drawing
    getHPForType() {
        switch(this.type) {
            case 'enemy1': return 1;
            case 'enemy2': return 2;
            case 'enemy3': return 3;
            case 'miniboss': return 5;
            case 'boss': return 20;
            default: return 1;
        }
    }
}

// ========== ENHANCED WAVE MANAGER ==========
const waveManager = {
    enemies: [],           // This will be linked to game.js enemies array
    waveCount: 0,
    spawnTimer: 30,
    spawnInterval: 45,
    learningProfile: null,
    
    // Adaptation parameters
    spawnBias: 'random',
    enemySpeedMultiplier: 1.0,
    forceSinePattern: false,
    forceErraticPatterns: false,
    playerStyle: 'balanced',
    
    // Wave management
    enemiesPerWave: 5,
    waveTypes: ['standard', 'swarm', 'sniper'],
    currentWaveType: 'standard',

    update() {
        this.spawnTimer--;
        
        if (this.spawnTimer <= 0 && this.enemies.length < 20) {
            this.spawnEnemy();
            this.spawnInterval = Math.max(30, 60 - this.waveCount * 2);
            this.spawnTimer = this.spawnInterval;
        }
    },

    spawnEnemy() {
        let x;
        switch(this.spawnBias) {
            case 'left': x = 50 + Math.random() * 200; break;
            case 'right': x = 800 + Math.random() * 200; break;
            default: x = 50 + Math.random() * 924;
        }
        
        const y = -40;
        
        // Determine enemy type based on wave and player style
        let type = 'enemy1';
        const rand = Math.random();
        
        if (this.waveCount >= 3 && rand < 0.3) {
            type = 'enemy2';
        } else if (this.waveCount >= 5 && rand < 0.2) {
            type = 'enemy3';
        } else if (this.waveCount >= 7 && rand < 0.1) {
            type = 'miniboss';
        } else if (this.waveCount >= 10 && rand < 0.05) {
            type = 'boss';
        }
        
        // Select pattern
        let pattern = 'down';
        if (this.forceSinePattern) {
            pattern = 'sine';
        } else if (this.forceErraticPatterns) {
            pattern = 'zigzag';
        } else {
            const patterns = ['down', 'sine', 'zigzag', 'wave'];
            pattern = patterns[Math.floor(Math.random() * patterns.length)];
        }
        
        const enemy = new Enemy(x, y, type, this.learningProfile, this.enemySpeedMultiplier, pattern);
        this.enemies.push(enemy);
        
        if (window.liveLearning) window.liveLearning.recordEnemySpawn();
    },

    startWave() {
        this.waveCount++;
        
        // Determine wave type
        if (this.waveCount % 5 === 0) {
            this.currentWaveType = 'swarm';
            this.enemiesPerWave = 10;
        } else if (this.waveCount % 3 === 0) {
            this.currentWaveType = 'sniper';
            this.forceErraticPatterns = true;
        } else {
            this.currentWaveType = 'standard';
            this.enemiesPerWave = 5;
        }
        
        console.log(`Wave ${this.waveCount} started - Type: ${this.currentWaveType}`);
    },

    applyLearning() {
        this.learningProfile = playerProfile.totalGames > 0 ? playerProfile : null;
        if (this.learningProfile) {
            console.log('Applying learning from', this.learningProfile.totalGames, 'previous games');
        }
    },

    reset() {
        this.enemies = [];
        this.waveCount = 0;
        this.spawnTimer = 30;
        this.spawnBias = 'random';
        this.enemySpeedMultiplier = 1.0;
        this.forceSinePattern = false;
        this.forceErraticPatterns = false;
        liveLearning.reset();
        console.log('waveManager reset');
    }
};

// Expose globally
window.waveManager = waveManager;
window.liveLearning = liveLearning;
window.Enemy = Enemy;
