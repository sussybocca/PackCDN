// ==================== ENEMIES.JS ====================
console.log('enemies.js loaded (learning AI + real‑time adaptation)');

// ========== GLOBAL FRAME COUNTER (set by game.js) ==========
let globalFrame = 0;
function setGlobalFrame(frame) { globalFrame = frame; }

// ========== PLAYER PROFILE & CROSS‑GAME LEARNING ==========
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

// ========== REAL‑TIME LIVE LEARNING ==========
// Adapts enemy spawn parameters based on player's on‑screen behaviour
const liveLearning = {
    playerPositions: [],      // last 60 normalized screen positions
    playerShots: [],          // frame numbers of recent shots
    lastAnalysisFrame: 0,
    analysisInterval: 60,     // analyse every 60 frames

    // Called every frame with player's screen coordinates (0..1024, 0..768)
    update(screenX, screenY, shotThisFrame) {
        // Normalize to 0..1
        const normX = screenX / 1024;
        const normY = screenY / 768;
        this.playerPositions.push({ x: normX, y: normY, frame: globalFrame });
        if (this.playerPositions.length > 60) this.playerPositions.shift();

        if (shotThisFrame) {
            this.playerShots.push(globalFrame);
            if (this.playerShots.length > 20) this.playerShots.shift();
        }

        if (globalFrame - this.lastAnalysisFrame >= this.analysisInterval) {
            this.analyse();
            this.lastAnalysisFrame = globalFrame;
        }
    },

    analyse() {
        if (this.playerPositions.length < 10) return;

        const avgX = this.playerPositions.reduce((sum, p) => sum + p.x, 0) / this.playerPositions.length;
        const avgY = this.playerPositions.reduce((sum, p) => sum + p.y, 0) / this.playerPositions.length;
        const recentShots = this.playerShots.filter(ts => globalFrame - ts < 60).length;
        const shotRate = recentShots / 60;

        // Update waveManager parameters (used when generating new enemies)
        if (avgX < 0.3) {
            waveManager.spawnBias = 'right';   // player stays left → spawn enemies from right
        } else if (avgX > 0.7) {
            waveManager.spawnBias = 'left';
        } else {
            waveManager.spawnBias = 'random';
        }

        waveManager.enemySpeedMultiplier = (avgY < 0.5) ? 1.3 : 1.0;
        waveManager.forceSinePattern = (shotRate > 0.1);
    },

    reset() {
        this.playerPositions = [];
        this.playerShots = [];
        this.lastAnalysisFrame = 0;
    }
};

// ========== ENEMY CLASS ==========
// Used by game.js to create enemies in sectors
class Enemy {
    constructor(x, y, type = 'enemy1', learning = null, speedMultiplier = 1.0) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.width = 40;
        this.height = 40;
        this.speed = 2 * speedMultiplier;
        this.hp = 1;
        this.pattern = 'down';
        this.frame = 0;
        this.lastShot = 0;

        // Apply cross‑game learning (historical profile)
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
        }
    }

    // Simple update: move downward, optionally sine wave
    update() {
        this.y += this.speed;
        if (this.pattern === 'sine') {
            this.x += Math.sin(this.frame * 0.1) * 1.5;
        }
        this.frame++;
    }

    shoot() {
        return {
            x: this.x + this.width / 2,
            y: this.y + this.height,
            w: 5,
            h: 10,
            speed: 4
        };
    }
}

// ========== SIMPLIFIED WAVE MANAGER ==========
// Now only holds wave count and adaptation parameters.
// Enemy spawning is handled by game.js via sectors.
const waveManager = {
    waveCount: 0,
    learningProfile: null,
    // Real‑time adaptation parameters (updated by liveLearning)
    spawnBias: 'random',        // 'left', 'right', 'random'
    enemySpeedMultiplier: 1.0,
    forceSinePattern: false,

    // Increment wave count (called from game.js on level up)
    startWave() {
        this.waveCount++;
        console.log(`Wave ${this.waveCount} started`);
    },

    // Apply cross‑game learning profile at game start
    applyLearning() {
        this.learningProfile = playerProfile.totalGames > 0 ? playerProfile : null;
        if (this.learningProfile) {
            console.log('Applying learning from', this.learningProfile.totalGames, 'previous games');
        }
    },

    // Reset for new game (optional)
    reset() {
        this.waveCount = 0;
        this.spawnBias = 'random';
        this.enemySpeedMultiplier = 1.0;
        this.forceSinePattern = false;
        liveLearning.reset();
        console.log('waveManager reset');
    }
};

// Expose globally
window.waveManager = waveManager;
window.liveLearning = liveLearning;
window.Enemy = Enemy; // so game.js can use it
