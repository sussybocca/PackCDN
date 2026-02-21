// ==================== ASSETS.JS ====================
const assets = {
    images: {},
    sounds: {},
    videos: {},
    models: {},        // THREE.Group objects (loaded models)
    animations: {},    // Animation clips per model
    mixers: [],        // Active AnimationMixers to update each frame
    loaded: false,
    totalAssets: 0,
    loadedCount: 0
};

// Built‑in asset definitions (these are always available)
const builtIn = {
    images: [
        { name: 'player', src: 'images/player_spaceship.png' },
        { name: 'enemy1', src: 'images/enemy_spaceship.png' },
        { name: 'enemy2', src: 'images/enemy2.png' },
        { name: 'bullet', src: 'images/bullets.png' },
        { name: 'enemyBullet', src: 'images/enemy_bullet.png' },
        { name: 'explosion', src: 'images/explosion.png' },
        { name: 'starfield', src: 'images/starfield.png' }
    ],
    sounds: [
        { name: 'laser1', src: 'sounds/Laser 3.mp3', label: 'Classic Laser' },
        { name: 'laser2', src: 'sounds/phaser.mp3', label: 'Phaser' },
        { name: 'laser3', src: 'sounds/blaster.mp3', label: 'Blaster' },
        { name: 'explode1', src: 'sounds/dragon-studio-loud-explosion-425457.mp3', label: 'Big Boom' },
        { name: 'explode2', src: 'sounds/explode2.mp3', label: 'Small Pop' },
        { name: 'bgm1', src: 'sounds/universfield-horror-background-atmosphere-156462.mp3', label: 'Horror Atmosphere' },
        { name: 'bgm2', src: 'sounds/space-ambient.mp3', label: 'Space Ambient' }
    ],
    videos: [
        { name: 'nebula1', src: 'sounds/139106-771366016_small.mp4', label: 'Nebula' },
        { name: 'stars1', src: 'videos/stars.mp4', label: 'Stars' },
        { name: 'galaxy1', src: 'videos/galaxy.mp4', label: 'Galaxy' }
    ],
    models: [   // 3D models (FBX)
        { name: 'player', src: 'models/Player.FBX', label: 'Player Ship' },
        { name: 'enemy1', src: 'models/enemy.FBX', label: 'Enemy Ship' }
    ]
};

// Build manifest based on user choices
function buildManifest() {
    const manifest = { 
        images: builtIn.images.slice(), 
        sounds: [], 
        videos: [],
        models: builtIn.models.slice()   // always include both models
    };
    const choices = JSON.parse(localStorage.getItem('spaceShooters_assetChoices') || '{}');

    const addBuiltInSound = (category, choiceKey, defaultName) => {
        const choice = choices[choiceKey] || defaultName;
        const found = builtIn[category].find(item => item.name === choice);
        if (found) manifest[category].push({ name: choiceKey, src: found.src });
    };

    addBuiltInSound('sounds', 'laser', 'laser1');
    addBuiltInSound('sounds', 'explode', 'explode1');
    addBuiltInSound('sounds', 'bgm', 'bgm1');

    const bgChoice = choices.background || 'nebula1';
    const foundVideo = builtIn.videos.find(v => v.name === bgChoice);
    if (foundVideo) manifest.videos.push({ name: 'background', src: foundVideo.src });

    return manifest;
}

// Load user assets (asynchronous, not blocking game start)
async function loadUserAssets() {
    const choices = JSON.parse(localStorage.getItem('spaceShooters_assetChoices') || '{}');
    for (let key of ['laser', 'explode', 'bgm', 'background']) {
        const val = choices[key];
        if (val && !builtIn.sounds.some(s => s.name === val) && !builtIn.videos.some(v => v.name === val)) {
            try {
                const blob = await window.userAssets.load(val);
                if (blob) {
                    const url = window.userAssets.blobToURL(blob);
                    if (key === 'background') {
                        const video = document.createElement('video');
                        video.src = url;
                        video.loop = true;
                        video.muted = true;
                        video.load();
                        assets.videos['background'] = video;
                    } else {
                        const audio = new Audio();
                        audio.src = url;
                        audio.load();
                        assets.sounds[key] = audio;
                    }
                }
            } catch (e) {
                console.warn('Failed to load user asset', key, e);
            }
        }
    }
}

// Load a single FBX model and return a promise
function loadFBXModel(item) {
    return new Promise((resolve, reject) => {
        // Check if THREE and FBXLoader are available
        if (typeof THREE === 'undefined' || typeof FBXLoader === 'undefined') {
            console.warn('THREE or FBXLoader not available – skipping 3D model:', item.name);
            return reject('Three.js not loaded');
        }
        const loader = new FBXLoader();
        loader.load(item.src, 
            (object) => {
                // Scale and rotate to fit 2D game orientation
                // These values may need tweaking based on your FBX
                object.scale.set(0.01, 0.01, 0.01); // adjust as needed
                object.rotation.x = -Math.PI / 2;   // make model face "up" (Y axis)
                object.rotation.z = Math.PI;        // rotate to face correct direction (optional)

                // Store any animations
                if (object.animations && object.animations.length) {
                    assets.animations[item.name] = object.animations;
                }

                resolve(object);
            },
            undefined,
            (error) => {
                console.warn(`Failed to load model: ${item.src}`, error);
                reject(error);
            }
        );
    });
}

function loadAssets(callback) {
    const manifest = buildManifest();
    assets.totalAssets = manifest.images.length + manifest.sounds.length + manifest.videos.length + manifest.models.length;

    // Images
    manifest.images.forEach(item => {
        const img = new Image();
        img.src = item.src;
        img.onload = assetLoaded;
        img.onerror = () => {
            console.warn(`Failed to load image: ${item.src}`);
            assetLoaded();
        };
        assets.images[item.name] = img;
    });

    // Sounds
    manifest.sounds.forEach(item => {
        const audio = new Audio();
        audio.src = item.src;
        audio.load();
        audio.onerror = () => {
            console.warn(`Failed to load sound: ${item.src}`);
            assetLoaded();
        };
        audio.oncanplaythrough = assetLoaded;
        assets.sounds[item.name] = audio;
    });

    // Videos
    manifest.videos.forEach(item => {
        const video = document.createElement('video');
        video.src = item.src;
        video.loop = true;
        video.muted = true;
        video.load();
        video.onerror = () => {
            console.warn(`Failed to load video: ${item.src}`);
            assetLoaded();
        };
        video.onloadeddata = assetLoaded;
        assets.videos[item.name] = video;
    });

    // Models – load with FBXLoader
    manifest.models.forEach(item => {
        loadFBXModel(item)
            .then(object => {
                assets.models[item.name] = object;
                assetLoaded();
            })
            .catch(() => {
                assetLoaded(); // count as loaded even if failed (fallback to 2D)
            });
    });

    function assetLoaded() {
        assets.loadedCount++;
        console.log(`Asset loaded: ${assets.loadedCount}/${assets.totalAssets}`);
        if (assets.loadedCount >= assets.totalAssets) {
            assets.loaded = true;
            console.log('All built‑in assets loaded, now loading user assets...');
            loadUserAssets().then(() => {
                if (callback) callback();
            }).catch(err => {
                console.warn('User assets loading failed, starting game anyway', err);
                if (callback) callback();
            });
        }
    }

    // Edge case: no built‑in assets
    if (assets.totalAssets === 0) {
        loadUserAssets().then(() => {
            if (callback) callback();
        }).catch(() => {
            if (callback) callback();
        });
    }
}

function playSound(name, volume = 1.0) {
    let sound = assets.sounds[name];
    if (!sound) return;
    const clone = sound.cloneNode();
    let volSetting = localStorage.getItem('spaceShooters_volume');
    if (volSetting === null) volSetting = 70;
    clone.volume = (volSetting / 100) * volume;
    clone.play().catch(e => {});
}

function enableAudioOnUserGesture() {
    const unlock = () => {
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
}
enableAudioOnUserGesture();
