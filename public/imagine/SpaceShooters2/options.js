// ==================== options.js ====================
document.addEventListener('DOMContentLoaded', async () => {
    // Populate built‑in asset lists
    const bgSelect = document.getElementById('backgroundSelect');
    const laserSelect = document.getElementById('laserSelect');
    const explodeSelect = document.getElementById('explodeSelect');
    const bgmSelect = document.getElementById('bgmSelect');

    // Add built‑in options
    builtIn.videos.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v.name;
        opt.textContent = v.label;
        bgSelect.appendChild(opt);
    });
    builtIn.sounds.filter(s => s.name.startsWith('laser')).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.label;
        laserSelect.appendChild(opt);
    });
    builtIn.sounds.filter(s => s.name.startsWith('explode')).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.label;
        explodeSelect.appendChild(opt);
    });
    builtIn.sounds.filter(s => s.name.startsWith('bgm')).forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.textContent = s.label;
        bgmSelect.appendChild(opt);
    });

    // Add "Upload custom..." options
    bgSelect.appendChild(new Option('Upload custom...', 'upload_custom_bg'));
    laserSelect.appendChild(new Option('Upload custom...', 'upload_custom_laser'));
    explodeSelect.appendChild(new Option('Upload custom...', 'upload_custom_explode'));
    bgmSelect.appendChild(new Option('Upload custom...', 'upload_custom_bgm'));

    // Load saved choices
    const saved = JSON.parse(localStorage.getItem('spaceShooters_assetChoices') || '{}');
    if (saved.background) bgSelect.value = saved.background;
    if (saved.laser) laserSelect.value = saved.laser;
    if (saved.explode) explodeSelect.value = saved.explode;
    if (saved.bgm) bgmSelect.value = saved.bgm;

    // Handle file uploads when "Upload custom..." is selected
    async function handleUpload(select, category, fileInputId) {
        if (select.value === `upload_custom_${category}`) {
            const fileInput = document.getElementById(fileInputId);
            fileInput.click();
            fileInput.onchange = async () => {
                const file = fileInput.files[0];
                if (!file) return;
                // Generate a unique ID
                const id = `user_${category}_${Date.now()}`;
                await window.userAssets.save(id, file);
                // Add this as a new option and select it
                const opt = new Option(file.name, id);
                select.appendChild(opt);
                select.value = id;
                // Save immediately
                saveChoices();
                fileInput.value = ''; // reset
            };
        } else {
            saveChoices();
        }
    }

    function saveChoices() {
        const choices = {
            background: bgSelect.value,
            laser: laserSelect.value,
            explode: explodeSelect.value,
            bgm: bgmSelect.value
        };
        localStorage.setItem('spaceShooters_assetChoices', JSON.stringify(choices));
    }

    bgSelect.addEventListener('change', () => handleUpload(bgSelect, 'bg', 'bgFile'));
    laserSelect.addEventListener('change', () => handleUpload(laserSelect, 'laser', 'laserFile'));
    explodeSelect.addEventListener('change', () => handleUpload(explodeSelect, 'explode', 'explodeFile'));
    bgmSelect.addEventListener('change', () => handleUpload(bgmSelect, 'bgm', 'bgmFile'));

    // Volume slider (existing)
    const volumeSlider = document.getElementById('volume');
    const volSpan = document.getElementById('volValue');
    volumeSlider.addEventListener('input', (e) => {
        volSpan.textContent = e.target.value;
        localStorage.setItem('spaceShooters_volume', e.target.value);
    });
    // Load saved volume
    const savedVol = localStorage.getItem('spaceShooters_volume');
    if (savedVol !== null) {
        volumeSlider.value = savedVol;
        volSpan.textContent = savedVol;
    }
});
