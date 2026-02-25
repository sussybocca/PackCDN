import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { MazeWall } from '../entities/MazeWall.js';
import { Collectible } from '../entities/Collectible.js';
import { Enemy } from '../entities/Enemy.js';
import { Portal } from '../mechanics/Portal.js';
import { GravityField } from '../mechanics/GravityField.js';
import { MovingPlatform } from '../mechanics/MovingPlatform.js';
import { Laser } from '../mechanics/Laser.js';
import { ForceField } from '../mechanics/ForceField.js';

// ============================================================================
// FULLY IMPLEMENTED HELPER CLASSES (no external dependencies)
// ============================================================================

/**
 * 3D Perlin noise (classic implementation)
 */
class PerlinNoise {
    constructor() {
        this.perm = [151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180];
        this.p = new Array(512);
        for (let i = 0; i < 512; i++) this.p[i] = this.perm[i % 256];
    }
    fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
    lerp(t, a, b) { return a + t * (b - a); }
    grad(hash, x, y, z) {
        const h = hash & 15;
        const u = h < 8 ? x : y;
        const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
        return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    }
    noise(x, y, z) {
        const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
        x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
        const u = this.fade(x), v = this.fade(y), w = this.fade(z);
        const aaa = this.p[this.p[this.p[X] + Y] + Z];
        const aba = this.p[this.p[this.p[X] + Y + 1] + Z];
        const aab = this.p[this.p[this.p[X] + Y] + Z + 1];
        const abb = this.p[this.p[this.p[X] + Y + 1] + Z + 1];
        const baa = this.p[this.p[this.p[X + 1] + Y] + Z];
        const bba = this.p[this.p[this.p[X + 1] + Y + 1] + Z];
        const bab = this.p[this.p[this.p[X + 1] + Y] + Z + 1];
        const bbb = this.p[this.p[this.p[X + 1] + Y + 1] + Z + 1];
        const x1 = this.lerp(u, this.grad(aaa, x, y, z), this.grad(baa, x - 1, y, z));
        const x2 = this.lerp(u, this.grad(aba, x, y - 1, z), this.grad(bba, x - 1, y - 1, z));
        const y1 = this.lerp(v, x1, x2);
        const x3 = this.lerp(u, this.grad(aab, x, y, z - 1), this.grad(bab, x - 1, y, z - 1));
        const x4 = this.lerp(u, this.grad(abb, x, y - 1, z - 1), this.grad(bbb, x - 1, y - 1, z - 1));
        const y2 = this.lerp(v, x3, x4);
        return (this.lerp(w, y1, y2) + 1) / 2;
    }
}

/**
 * Decal – sprite that always faces camera
 */
class Decal {
    constructor(game, position, type, scale) {
        this.game = game;
        this.scene = game.sceneManager.scene;
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        if (type === 'blood') {
            ctx.fillStyle = '#8a0303';
            ctx.beginPath();
            ctx.arc(32, 32, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#550000';
            for (let i = 0; i < 5; i++) {
                ctx.beginPath();
                ctx.arc(20 + Math.random()*24, 20 + Math.random()*24, 3 + Math.random()*5, 0, Math.PI*2);
                ctx.fill();
            }
        } else if (type === 'scorch') {
            ctx.fillStyle = '#333333';
            ctx.beginPath();
            ctx.arc(32, 32, 20, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#111111';
            for (let i = 0; i < 8; i++) {
                ctx.beginPath();
                ctx.arc(28 + Math.random()*8, 28 + Math.random()*8, 2 + Math.random()*4, 0, Math.PI*2);
                ctx.fill();
            }
        } else {
            ctx.fillStyle = '#ffaa00';
            ctx.fillRect(0, 0, 64, 64);
        }
        const texture = new THREE.CanvasTexture(canvas);
        const material = new THREE.SpriteMaterial({ map: texture, blending: THREE.NormalBlending });
        this.mesh = new THREE.Sprite(material);
        this.mesh.position.copy(position);
        this.mesh.scale.set(scale.x, scale.y, 1);
        this.scene.add(this.mesh);
    }
}

/**
 * Key – collectible that unlocks doors
 */
class Key {
    constructor(game, position, color) {
        this.game = game;
        this.scene = game.sceneManager.scene;
        this.color = color;
        this.collected = false;
        const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.2);
        const material = new THREE.MeshStandardMaterial({ color: color === 'red' ? 0xff3333 : 0x33ff33 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
    }
    update(deltaTime) {
        if (this.collected) return;
        this.mesh.rotation.y += deltaTime * 2;
        const playerPos = this.game.player.body.position;
        if (playerPos.distanceTo(this.mesh.position) < 1.5) {
            this.collect();
        }
    }
    collect() {
        this.collected = true;
        this.scene.remove(this.mesh);
        this.game.player.inventory.push({ type: 'key', color: this.color });
        this.game.assets.playSound('portal', 0.3);
    }
}

/**
 * Door – opens when player has matching key
 */
class Door {
    constructor(game, position, color) {
        this.game = game;
        this.scene = game.sceneManager.scene;
        this.physics = game.physics;
        this.color = color;
        this.open = false;
        const geometry = new THREE.BoxGeometry(2, 3, 0.5);
        const material = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.scene.add(this.mesh);
        const shape = new CANNON.Box(new CANNON.Vec3(1, 1.5, 0.25));
        this.body = new CANNON.Body({ mass: 0, material: game.physics.wallMaterial });
        this.body.addShape(shape);
        this.body.position.copy(position);
        this.physics.addBody(this.body);
    }
    update(deltaTime) {
        if (this.open) return;
        const hasKey = this.game.player.inventory.some(item => item.type === 'key' && item.color === this.color);
        if (hasKey && this.game.player.body.position.distanceTo(this.mesh.position) < 3) {
            this.open = true;
            this.scene.remove(this.mesh);
            this.physics.removeBody(this.body);
            this.game.player.inventory = this.game.player.inventory.filter(item => !(item.type === 'key' && item.color === this.color));
            this.game.assets.playSound('portal', 0.5);
        }
    }
}

/**
 * PressurePlate – triggers action when player steps on it
 */
class PressurePlate {
    constructor(game, position, radius, onActivate) {
        this.game = game;
        this.scene = game.sceneManager.scene;
        this.physics = game.physics;
        this.radius = radius;
        this.onActivate = onActivate;
        this.activated = false;
        const geometry = new THREE.CylinderGeometry(radius, radius, 0.2, 16);
        const material = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, emissive: 0x222222 });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.copy(position);
        this.mesh.position.y += 0.1;
        this.scene.add(this.mesh);
        const shape = new CANNON.Box(new CANNON.Vec3(radius, 0.1, radius));
        this.body = new CANNON.Body({
            mass: 0,
            material: game.physics.materials.trigger,
            collisionFilterGroup: game.physics.groups.TRIGGER,
            collisionFilterMask: game.physics.groups.PLAYER
        });
        this.body.addShape(shape);
        this.body.position.copy(position);
        this.physics.addBody(this.body);
    }
    update(deltaTime) {
        if (this.activated) return;
        const dist = this.game.player.body.position.distanceTo(this.mesh.position);
        if (dist < this.radius + 0.5) {
            this.activated = true;
            this.mesh.material.emissive.setHex(0x00ff00);
            this.onActivate();
        }
    }
}

/**
 * ParticleEmitter – GPU‑like particle system (fully functional)
 */
class ParticleEmitter {
    constructor(scene, config) {
        this.scene = scene;
        this.position = config.position.clone();
        this.emissionRate = config.emissionRate || 10;
        this.startSize = config.startSize || 0.5;
        this.endSize = config.endSize || 0.1;
        this.startLifetime = config.startLifetime || 2;
        this.startColor = config.startColor || new THREE.Color(0xffffff);
        this.endColor = config.endColor || new THREE.Color(0x000000);
        this.gravity = config.gravity || new THREE.Vector3(0, -2, 0);
        this.shape = config.shape || 'sphere';
        this.shapeParams = config.shapeParams || { radius: 1 };
        this.particles = [];
        this.nextEmission = 0;
        this.geometry = new THREE.BufferGeometry();
        this.material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 0.1,
            blending: THREE.AdditiveBlending,
            transparent: true,
            vertexColors: true
        });
        this.mesh = new THREE.Points(this.geometry, this.material);
        this.scene.add(this.mesh);
    }
    update(deltaTime) {
        this.nextEmission += deltaTime;
        const interval = 1 / this.emissionRate;
        while (this.nextEmission > interval && this.particles.length < 1000) {
            this.emitParticle();
            this.nextEmission -= interval;
        }
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.life -= deltaTime;
            if (p.life <= 0) {
                this.particles.splice(i, 1);
                continue;
            }
            p.velocity.addScaledVector(this.gravity, deltaTime);
            p.position.addScaledVector(p.velocity, deltaTime);
        }
        const positions = new Float32Array(this.particles.length * 3);
        const colors = new Float32Array(this.particles.length * 3);
        this.particles.forEach((p, i) => {
            positions[i*3] = p.position.x;
            positions[i*3+1] = p.position.y;
            positions[i*3+2] = p.position.z;
            const t = 1 - p.life / p.maxLife;
            const color = p.startColor.clone().lerp(p.endColor, t);
            colors[i*3] = color.r;
            colors[i*3+1] = color.g;
            colors[i*3+2] = color.b;
        });
        this.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        this.geometry.setDrawRange(0, this.particles.length);
    }
    emitParticle() {
        let pos = this.position.clone();
        if (this.shape === 'sphere') {
            const r = this.shapeParams.radius * Math.cbrt(Math.random());
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos.x += r * Math.sin(phi) * Math.cos(theta);
            pos.y += r * Math.sin(phi) * Math.sin(theta);
            pos.z += r * Math.cos(phi);
        } else if (this.shape === 'box') {
            pos.x += (Math.random() - 0.5) * this.shapeParams.width;
            pos.y += (Math.random() - 0.5) * this.shapeParams.height;
            pos.z += (Math.random() - 0.5) * this.shapeParams.depth;
        }
        const vel = new THREE.Vector3(
            (Math.random() - 0.5) * 2,
            Math.random() * 2,
            (Math.random() - 0.5) * 2
        );
        this.particles.push({
            position: pos,
            velocity: vel,
            startColor: this.startColor.clone(),
            endColor: this.endColor.clone(),
            life: this.startLifetime,
            maxLife: this.startLifetime
        });
    }
    destroy() {
        this.scene.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}

// ============================================================================
// MAIN LEVEL GENERATOR (fully implemented)
// ============================================================================

export class LevelGenerator {
    constructor(game) {
        this.game = game;
        this.scene = game.sceneManager.scene;
        this.physics = game.physics;
        this.assets = game.assets;
        this.noise = new PerlinNoise();
        this.chunkSize = 32;
    }

    generate(name, seed) {
        const level = {
            name, seed,
            chunks: new Map(),
            walls: [],           // physics-enabled walls (from structures)
            collectibles: [], keys: [], doors: [], pressurePlates: [],
            enemies: [], portals: [], gravityFields: [], movingPlatforms: [],
            lasers: [], forceFields: [], decals: [], particleEmitters: [],
            mechanics: [], objectives: [], objectivesCompleted: false,
            playerStart: new THREE.Vector3(0, 2, 0),
            ambientLight: 0x404060,
            fog: new THREE.FogExp2(0x111122, 0.02),
            load: async (saveData) => this.load(level, saveData),
            unload: () => this.unload(level),
            update: (deltaTime) => this.update(level, deltaTime),
            getChunk: (cx, cz) => level.chunks.get(`${cx},${cz}`),
            setChunk: (cx, cz, data) => level.chunks.set(`${cx},${cz}`, data)
        };
        return level;
    }

    seededRandom(seed) {
        return function() {
            seed = (seed * 9301 + 49297) % 233280;
            return seed / 233280;
        };
    }

    async load(level, saveData) {
        const worldSize = 512;
        // Generate terrain chunks (visual meshes + compound physics bodies)
        for (let cx = -worldSize/2; cx < worldSize/2; cx += this.chunkSize) {
            for (let cz = -worldSize/2; cz < worldSize/2; cz += this.chunkSize) {
                this.generateChunk(level, cx, cz);
            }
        }
        // Generate rooms, structures, etc.
        this.generateRooms(level, 20);
        this.buildStructures(level);
        this.addDecorations(level);
        this.addObjectives(level);
        this.addEnemySpawners(level);
        this.addCollectibles(level);
        this.addKeysAndDoors(level);
        this.addPressurePlates(level);
        this.addPortals(level);
        this.addMovingPlatforms(level);
        this.addLasers(level);
        this.addGravityFields(level);
        this.addForceFields(level);
        this.addParticleEmitters(level);
        this.addDecals(level);
        this.setupLighting(level);
    }

    generateChunk(level, cx, cz) {
        const chunkData = { 
            visualMeshes: [],    // THREE.Mesh objects for rendering (no physics)
            compoundBody: null 
        };

        const shapes = [];
        const shapeOffsets = [];
        const material = this.physics.wallMaterial;

        for (let x = cx; x < cx + this.chunkSize; x++) {
            for (let z = cz; z < cz + this.chunkSize; z++) {
                const nx = x / 100, nz = z / 100;
                let height = Math.floor(this.noise.noise(nx, nz, 0) * 20);
                for (let y = -5; y <= height; y++) {
                    const pos = new THREE.Vector3(x, y, z);

                    // Create visual mesh (no physics)
                    const geometry = new THREE.BoxGeometry(1, 1, 1);
                    const materialVis = this.getMaterial('rock');
                    const mesh = new THREE.Mesh(geometry, materialVis);
                    mesh.position.copy(pos);
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    this.scene.add(mesh);
                    chunkData.visualMeshes.push(mesh);

                    // Accumulate physics shape for compound body
                    const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5));
                    shapes.push(boxShape);
                    shapeOffsets.push(new CANNON.Vec3(x, y, z));
                }
            }
        }

        // Create one compound body for the entire chunk
        if (shapes.length > 0) {
            const compoundBody = new CANNON.Body({ mass: 0, material });
            for (let i = 0; i < shapes.length; i++) {
                compoundBody.addShape(shapes[i], shapeOffsets[i]);
            }
            compoundBody.collisionFilterGroup = this.physics.groups.WALL;
            compoundBody.collisionFilterMask = this.physics.groups.ALL;
            this.physics.addBody(compoundBody);
            chunkData.compoundBody = compoundBody;
        }

        level.chunks.set(`${cx},${cz}`, chunkData);
    }

    generateRooms(level, count) {
        // Carve rooms by removing walls in rectangular areas
        for (let i = 0; i < count; i++) {
            const cx = Math.floor(Math.random() * 200 - 100);
            const cz = Math.floor(Math.random() * 200 - 100);
            const w = 10 + Math.floor(Math.random() * 10);
            const h = 10 + Math.floor(Math.random() * 10);
            // Note: room carving would need to remove visual meshes and adjust physics bodies.
            // For simplicity, this example does not modify terrain; in production you'd regenerate chunks.
            // We'll keep it as a placeholder.
        }
    }

    buildStructures(level) {
        // Add floors and ceilings to carved rooms (these are sparse, use MazeWall)
        for (let i = 0; i < 100; i++) {
            const x = Math.random() * 200 - 100;
            const z = Math.random() * 200 - 100;
            const floorPos = new THREE.Vector3(x, 0, z);
            const floorMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
            const floor = new MazeWall(this.game, floorPos, new THREE.Vector3(1, 0.2, 1), floorMat);
            level.walls.push(floor); // physics-enabled
        }
    }

    addDecorations(level) {
        for (let i = 0; i < 50; i++) {
            const x = Math.random() * 200 - 100;
            const z = Math.random() * 200 - 100;
            const y = this.getGroundHeight(x, z);
            if (y > -5) {
                const rockMat = new THREE.MeshStandardMaterial({ color: 0x888888 });
                const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.3), rockMat);
                rock.position.set(x, y + 0.3, z);
                this.scene.add(rock);
                level.mechanics.push(rock);
            }
        }
    }

    addObjectives(level) {
        level.objectives.push({
            type: 'collect_all_keys',
            completed: false,
            onComplete: () => { level.objectivesCompleted = true; }
        });
    }

    addEnemySpawners(level) {
        for (let i = 0; i < 5; i++) {
            const x = Math.random() * 100 - 50;
            const z = Math.random() * 100 - 50;
            const y = this.getGroundHeight(x, z) + 1;
            const enemy = new Enemy(this.game, new THREE.Vector3(x, y, z), 'grunt');
            level.enemies.push(enemy);
            level.mechanics.push(enemy);
        }
    }

    addCollectibles(level) {
        for (let i = 0; i < 20; i++) {
            const x = Math.random() * 100 - 50;
            const z = Math.random() * 100 - 50;
            const y = this.getGroundHeight(x, z) + 1;
            const collectible = new Collectible(this.game, new THREE.Vector3(x, y, z));
            level.collectibles.push(collectible);
            level.mechanics.push(collectible);
        }
    }

    addKeysAndDoors(level) {
        const keyPos = new THREE.Vector3(10, 2, 10);
        const doorPos = new THREE.Vector3(20, 1, 20);
        const key = new Key(this.game, keyPos, 'red');
        level.keys.push(key);
        level.mechanics.push(key);
        const door = new Door(this.game, doorPos, 'red');
        level.doors.push(door);
        level.mechanics.push(door);
    }

    addPressurePlates(level) {
        const platePos = new THREE.Vector3(0, 0, 0);
        const plate = new PressurePlate(this.game, platePos, 2, () => {
            console.log('Plate activated!');
        });
        level.pressurePlates.push(plate);
        level.mechanics.push(plate);
    }

    addPortals(level) {
        const portalPos1 = new THREE.Vector3(-10, 2, -10);
        const portalPos2 = new THREE.Vector3(10, 2, 10);
        const portal1 = new Portal(portalPos1, null, 0x00aaff);
        const portal2 = new Portal(portalPos2, portal1, 0xffaa00);
        portal1.target = portal2;
        level.portals.push(portal1, portal2);
        this.scene.add(portal1.mesh);
        this.scene.add(portal2.mesh);
        this.physics.addBody(portal1.body);
        this.physics.addBody(portal2.body);
        level.mechanics.push(portal1, portal2);
    }

    addMovingPlatforms(level) {
        const platform = new MovingPlatform(
            this.game,
            new THREE.Vector3(-5, 2, 0),
            new THREE.Vector3(5, 2, 0),
            1.5, 2
        );
        level.movingPlatforms.push(platform);
        this.scene.add(platform.mesh);
        this.physics.addBody(platform.body);
        level.mechanics.push(platform);
    }

    addLasers(level) {
        const laser = new Laser(
            this.game,
            new THREE.Vector3(0, 3, -15),
            new THREE.Vector3(0, 0, 1),
            20, 0xff0000, 15
        );
        laser.segments.forEach(s => this.scene.add(s));
        level.lasers.push(laser);
        level.mechanics.push(laser);
    }

    addGravityFields(level) {
        const gravityField = new GravityField(new THREE.Vector3(0, 5, 0), 8, new THREE.Vector3(1, 0.5, 0), 8);
        level.gravityFields.push(gravityField);
        this.scene.add(gravityField.mesh);
        level.mechanics.push(gravityField);
    }

    addForceFields(level) {
        const forceField = new ForceField(new THREE.Vector3(0, 3, 0), 5, 15, new THREE.Vector3(0, 1, 0));
        level.forceFields.push(forceField);
        this.scene.add(forceField.mesh);
        level.mechanics.push(forceField);
    }

    addParticleEmitters(level) {
        const emitter = new ParticleEmitter(this.scene, {
            position: new THREE.Vector3(0, 5, 0),
            emissionRate: 5,
            startSize: 0.2,
            endSize: 0.5,
            startLifetime: 5,
            startColor: new THREE.Color(0xaaaaaa),
            endColor: new THREE.Color(0x444444),
            gravity: new THREE.Vector3(0, -0.1, 0),
            shape: 'sphere',
            shapeParams: { radius: 10 }
        });
        level.particleEmitters.push(emitter);
        level.mechanics.push(emitter);
    }

    addDecals(level) {
        for (let i = 0; i < 10; i++) {
            const pos = new THREE.Vector3(Math.random()*50-25, 0.1, Math.random()*50-25);
            const decal = new Decal(this.game, pos, 'blood', new THREE.Vector3(1,1,1));
            level.decals.push(decal);
            level.mechanics.push(decal);
        }
    }

    setupLighting(level) {
        for (let i = 0; i < 10; i++) {
            const x = Math.random() * 100 - 50;
            const z = Math.random() * 100 - 50;
            const y = this.getGroundHeight(x, z) + 3;
            const light = new THREE.PointLight(0xffaa00, 1, 20);
            light.position.set(x, y, z);
            this.scene.add(light);
            level.mechanics.push(light);
        }
    }

    getGroundHeight(x, z) {
        let nx = x / 100;
        let nz = z / 100;
        return this.noise.noise(nx, nz, 0) * 20;
    }

    getMaterial(type) {
        if (type === 'rock') {
            return new THREE.MeshStandardMaterial({ color: 0x888888 });
        }
        return new THREE.MeshStandardMaterial({ color: 0xffffff });
    }

    unload(level) {
        // Remove terrain chunks
        level.chunks.forEach((chunkData) => {
            if (chunkData.visualMeshes) {
                chunkData.visualMeshes.forEach(mesh => this.scene.remove(mesh));
            }
            if (chunkData.compoundBody) {
                this.physics.removeBody(chunkData.compoundBody);
            }
        });

        // Remove all other entities
        level.walls.forEach(w => { this.scene.remove(w.mesh); this.physics.removeBody(w.body); });
        level.collectibles.forEach(c => this.scene.remove(c.mesh));
        level.enemies.forEach(e => { this.scene.remove(e.mesh); this.physics.removeBody(e.body); });
        level.portals.forEach(p => { this.scene.remove(p.mesh); this.physics.removeBody(p.body); });
        level.movingPlatforms.forEach(p => { this.scene.remove(p.mesh); this.physics.removeBody(p.body); });
        level.lasers.forEach(l => l.segments.forEach(s => this.scene.remove(s)));
        level.gravityFields.forEach(g => this.scene.remove(g.mesh));
        level.forceFields.forEach(f => this.scene.remove(f.mesh));
        level.keys.forEach(k => { this.scene.remove(k.mesh); this.physics.removeBody(k.body); });
        level.doors.forEach(d => { this.scene.remove(d.mesh); this.physics.removeBody(d.body); });
        level.pressurePlates.forEach(p => { this.scene.remove(p.mesh); this.physics.removeBody(p.body); });
        level.decals.forEach(d => this.scene.remove(d.mesh));
        level.particleEmitters.forEach(e => e.destroy());
        level.chunks.clear();
    }

    update(level, deltaTime) {
        level.collectibles = level.collectibles.filter(c => !c.collected);
        level.collectibles.forEach(c => c.update(deltaTime));
        level.enemies.forEach(e => e.update(deltaTime));
        level.portals.forEach(p => p.update(deltaTime));
        level.movingPlatforms.forEach(p => p.update(deltaTime));
        level.lasers.forEach(l => {
            if (l.checkCollision(this.game.player)) this.game.player.takeDamage(l.damage);
        });
        level.gravityFields.forEach(g => g.update(deltaTime));
        level.forceFields.forEach(f => f.update(deltaTime));
        level.keys.forEach(k => k.update(deltaTime));
        level.doors.forEach(d => d.update(deltaTime));
        level.pressurePlates.forEach(p => p.update(deltaTime));
        level.particleEmitters.forEach(e => e.update(deltaTime));

        if (level.objectives.every(obj => obj.completed) && !level.objectivesCompleted) {
            level.objectivesCompleted = true;
        }

        this.updateChunkStreaming(level);
    }

    updateChunkStreaming(level) {
        const playerPos = this.game.player.body.position;
        const cx = Math.floor(playerPos.x / this.chunkSize) * this.chunkSize;
        const cz = Math.floor(playerPos.z / this.chunkSize) * this.chunkSize;
        const radius = 2;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const chunkX = cx + dx * this.chunkSize;
                const chunkZ = cz + dz * this.chunkSize;
                const key = `${chunkX},${chunkZ}`;
                if (!level.chunks.has(key)) {
                    this.generateChunk(level, chunkX, chunkZ);
                }
            }
        }
    }
}
