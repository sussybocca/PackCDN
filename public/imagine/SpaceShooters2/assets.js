// ==================== ASSETS.JS ====================
const assets = {
    images: {},
    sounds: {},
    videos: {},
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
    ]
};

// We'll build the actual manifest based on user choices (stored in localStorage)
function buildManifest() {
    const manifest = { images: builtIn.images.slice(), sounds: [], videos: [] };

    // Get user choices
    const choices = JSON.parse(localStorage.getItem('spaceShooters_assetChoices') || '{}');

    // Helper to add a built‑in asset by its internal name
    const addBuiltInSound = (category, choiceKey, defaultName) => {
        const choice = choices[choiceKey] || defaultName;
        // Find in builtIn
        const found = builtIn[category].find(item => item.name === choice);
        if (found) {
            manifest[category].push({ name: choiceKey, src: found.src });
        } else {
            // It's a user asset ID
            // We'll handle user assets separately after loading built‑ins
        }
    };

    // Add sounds based on choices
    addBuiltInSound('sounds', 'laser', 'laser1');
    addBuiltInSound('sounds', 'explode', 'explode1');
    addBuiltInSound('sounds', 'bgm', 'bgm1');

    // Add video based on choice
    const bgChoice = choices.background || 'nebula1';
    const foundVideo = builtIn.videos.find(v => v.name === bgChoice);
    if (foundVideo) {
        manifest.videos.push({ name: 'background', src: foundVideo.src });
    } else {
        // user asset
        // we'll handle after
    }

    return manifest;
}

// After building the manifest, we also need to load any user assets asynchronously
async function loadUserAssets(manifest, callback) {
    const choices = JSON.parse(localStorage.getItem('spaceShooters_assetChoices') || '{}');
    const userAssetIds = [];

    // Collect user asset IDs from choices
    for (let key of ['laser', 'explode', 'bgm', 'background']) {
        const val = choices[key];
        if (val && !builtIn.sounds.some(s => s.name === val) && !builtIn.videos.some(v => v.name === val)) {
            userAssetIds.push({ key, id: val });
        }
    }

    for (let { key, id } of userAssetIds) {
        try {
            const blob = await window.userAssets.load(id);
            if (blob) {
                const url = window.userAssets.blobToURL(blob);
                if (key === 'background') {
                    const video = document.createElement('video');
                    video.src = url;
                    video.loop = true;
                    video.muted = true;
                    video.load();
                    assets.videos['background'] = video;
                    // Count as loaded when ready? We'll handle in loadAssets
                } else {
                    const audio = new Audio();
                    audio.src = url;
                    audio.load();
                    assets.sounds[key] = audio;
                }
                // We'll need to track loading separately
            }
        } catch (e) {
            console.warn('Failed to load user asset', id, e);
        }
    }
}

// Modify loadAssets to first build manifest, then load built‑ins, then user assets
function loadAssets(callback) {
    const manifest = buildManifest();
    // Count built‑in assets
    assets.totalAssets = manifest.images.length + manifest.sounds.length + manifest.videos.length;

    // Load built‑in images
    manifest.images.forEach(item => {
        const img = new Image();
        img.src = item.src;
        img.onload = assetLoaded;
        img.onerror = () => { console.warn(`Failed to load image: ${item.src}`); assetLoaded(); };
        assets.images[item.name] = img;
    });

    // Load built‑in sounds
    manifest.sounds.forEach(item => {
        const audio = new Audio();
        audio.src = item.src;
        audio.load();
        audio.onerror = () => console.warn(`Failed to load sound: ${item.src}`);
        assets.sounds[item.name] = audio;
        assetLoaded();
    });

    // Load built‑in videos
    manifest.videos.forEach(item => {
        const video = document.createElement('video');
        video.src = item.src;
        video.loop = true;
        video.muted = true;
        video.load();
        video.onerror = () => console.warn(`Failed to load video: ${item.src}`);
        assets.videos[item.name] = video;
        assetLoaded();
    });

    function assetLoaded() {
        assets.loadedCount++;
        if (assets.loadedCount >= assets.totalAssets) {
            // Now load user assets (which are extra and don't affect total)
            loadUserAssets(manifest, () => {
                assets.loaded = true;
                console.log('All assets loaded');
                if (callback) callback();
            });
        }
    }

    // If there are no built‑in assets, we still need to trigger user assets
    if (assets.totalAssets === 0) {
        loadUserAssets(manifest, () => {
            assets.loaded = true;
            if (callback) callback();
        });
    }
}

// Play sound (now uses the logical name, e.g., 'laser', 'explode', 'bgm')
function playSound(name, volume = 1.0) {
    let sound = assets.sounds[name];
    if (!sound) return;
    // Clone to allow overlapping
    const clone = sound.cloneNode();
    let volSetting = localStorage.getItem('spaceShooters_volume');
    if (volSetting === null) volSetting = 70;
    clone.volume = (volSetting / 100) * volume;
    clone.play().catch(e => {});
}

// Unlock audio on first user gesture
function enableAudioOnUserGesture() {
    const unlock = () => {
        document.removeEventListener('click', unlock);
        document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('click', unlock);
    document.addEventListener('keydown', unlock);
}
enableAudioOnUserGesture();
