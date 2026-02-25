import * as THREE from 'three';

/**
 * Ultimate GPU‑instanced particle system.
 * Features:
 * - Multiple independent emitters
 * - Texture atlasing (sprite sheets) with per‑particle frame animation
 * - Per‑particle color, size, rotation
 * - Physics: gravity, drag, turbulence
 * - Emission shapes: cone, sphere, box, point
 * - Sub‑emitters (particles can spawn new particles)
 * - Trail generation
 * - Force fields (global and local)
 * - Efficient instanced rendering with dynamic updates
 */
export class ParticleSystem {
    constructor(scene) {
        this.scene = scene;
        this.emitters = [];
        this.globalForces = []; // { type: 'wind'|'attractor'|'repulsor', position, direction, radius, strength }

        // Shared quad geometry (two triangles with UVs)
        this.baseGeometry = new THREE.BufferGeometry();
        const vertices = new Float32Array([
            -0.5, -0.5, 0,
             0.5, -0.5, 0,
            -0.5,  0.5, 0,
             0.5,  0.5, 0
        ]);
        const uvs = new Float32Array([
            0, 0,
            1, 0,
            0, 1,
            1, 1
        ]);
        const indices = new Uint16Array([0, 1, 2, 2, 1, 3]);
        this.baseGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        this.baseGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
        this.baseGeometry.setIndex(new THREE.BufferAttribute(indices, 1));

        // Default soft circle texture
        this.defaultTexture = this.createDefaultTexture();

        // For sub‑emitter and trail pooling
        this.subEmitterPool = [];
    }

    createDefaultTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, 'rgba(255,255,255,1)');
        gradient.addColorStop(0.5, 'rgba(255,255,255,0.7)');
        gradient.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 64, 64);
        return new THREE.CanvasTexture(canvas);
    }

    /**
     * Create a new emitter.
     * @param {Object} config - Configuration object.
     * @returns {Object} Emitter instance.
     */
    createEmitter(config = {}) {
        const maxParticles = config.maxParticles || 2000;
        const texture = config.texture || this.defaultTexture;
        const tileCount = config.tileCount || 1; // e.g., 4 for 2x2 sprite sheet

        // Create instanced mesh for this emitter
        const material = new THREE.ShaderMaterial({
            uniforms: {
                map: { value: texture },
                tileCount: { value: tileCount },
                time: { value: 0 }
            },
            vertexShader: `
                attribute vec2 uv;
                attribute vec4 particleColor;
                attribute float particleFrame;
                attribute float particleSize;
                attribute float particleRotation;

                varying vec2 vUv;
                varying vec4 vColor;
                varying float vFrame;
                varying float vRotation;

                void main() {
                    vUv = uv;
                    vColor = particleColor;
                    vFrame = particleFrame;
                    vRotation = particleRotation;

                    // Compute view‑aligned billboard
                    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
                    vec3 look = normalize(-mvPosition.xyz);
                    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), look));
                    vec3 up = cross(look, right);

                    // Rotate quad in its local plane
                    float cosR = cos(particleRotation);
                    float sinR = sin(particleRotation);
                    vec3 localPos = vec3(position.x * cosR - position.y * sinR, position.x * sinR + position.y * cosR, 0.0);
                    vec3 worldOffset = right * localPos.x + up * localPos.y;
                    gl_Position = projectionMatrix * (mvPosition + vec4(worldOffset * particleSize, 0.0));
                }
            `,
            fragmentShader: `
                uniform sampler2D map;
                uniform float tileCount;
                varying vec2 vUv;
                varying vec4 vColor;
                varying float vFrame;

                void main() {
                    // Sprite sheet animation
                    float cols = tileCount;
                    float rows = tileCount;
                    float frameX = mod(vFrame, cols);
                    float frameY = floor(vFrame / rows);
                    vec2 uv = vUv;
                    uv.x = (uv.x + frameX) / cols;
                    uv.y = (uv.y + frameY) / rows;

                    vec4 texColor = texture2D(map, uv);
                    gl_FragColor = vColor * texColor;
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: config.blending || THREE.AdditiveBlending,
            side: THREE.DoubleSide
        });

        const mesh = new THREE.InstancedMesh(this.baseGeometry, material, maxParticles);
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        mesh.frustumCulled = false;
        mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.scene.add(mesh);

        // Add per‑instance attributes to geometry
        mesh.geometry.setAttribute('particleColor', new THREE.InstancedBufferAttribute(new Float32Array(maxParticles * 4), 4));
        mesh.geometry.setAttribute('particleFrame', new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1));
        mesh.geometry.setAttribute('particleSize', new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1));
        mesh.geometry.setAttribute('particleRotation', new THREE.InstancedBufferAttribute(new Float32Array(maxParticles), 1));

        // Emitter state
        const emitter = {
            mesh,
            maxParticles,
            position: config.position?.clone() || new THREE.Vector3(0,0,0),
            rotation: config.rotation || 0,
            duration: config.duration || -1,
            loop: config.loop || false,
            burst: config.burst || false,
            emissionRate: config.emissionRate || 10,
            startLifetime: config.startLifetime || 2.0,
            startSpeed: config.startSpeed || 5.0,
            startSize: config.startSize || 0.5,
            endSize: config.endSize || 0.1,
            startColor: config.startColor?.clone() || new THREE.Color(0xffaa00),
            endColor: config.endColor?.clone() || new THREE.Color(0x330000),
            startRotation: config.startRotation || 0,
            endRotation: config.endRotation || 0,
            gravity: config.gravity?.clone() || new THREE.Vector3(0, -2, 0),
            drag: config.drag || 0.0,
            turbulence: config.turbulence || 0.0,
            shape: config.shape || 'cone',
            shapeParams: config.shapeParams || { radius: 2, angle: 45, width: 2, height: 2, depth: 2 },
            texture,
            tileCount,
            animated: config.animated || false,
            frameRate: config.frameRate || 12,
            blending: config.blending || THREE.AdditiveBlending,
            subEmitter: config.subEmitter || null, // function that returns emitter config
            trailLength: config.trailLength || 0,
            trailInterval: config.trailInterval || 0.1,
            trailTimer: 0,
            activeParticles: [], // array of particle objects
            freeIndices: [], // indices of dead particles in instance arrays
            nextEmissionTime: 0,
            age: 0,
            enabled: true,
            instanceMatrixDirty: true,
            instanceAttributeDirty: true,
            // Data buffers (for efficient updates)
            matrices: new Float32Array(maxParticles * 16),
            colors: new Float32Array(maxParticles * 4),
            frames: new Float32Array(maxParticles),
            sizes: new Float32Array(maxParticles),
            rotations: new Float32Array(maxParticles)
        };

        // Pre-allocate particle objects
        for (let i = 0; i < maxParticles; i++) {
            emitter.activeParticles.push(null);
            emitter.freeIndices.push(i);
        }

        this.emitters.push(emitter);
        return emitter;
    }

    /**
     * Update all emitters (call every frame).
     * @param {number} deltaTime - Time since last frame.
     */
    update(deltaTime) {
        for (const emitter of this.emitters) {
            if (!emitter.enabled) continue;

            emitter.age += deltaTime;
            if (emitter.duration > 0 && emitter.age > emitter.duration) {
                if (emitter.loop) emitter.age = 0;
                else {
                    emitter.enabled = false;
                    continue;
                }
            }

            // Emit new particles based on rate
            if (emitter.emissionRate > 0 && !emitter.burst) {
                emitter.nextEmissionTime += deltaTime;
                const interval = 1.0 / emitter.emissionRate;
                while (emitter.nextEmissionTime >= interval && emitter.freeIndices.length > 0) {
                    this.emitParticle(emitter);
                    emitter.nextEmissionTime -= interval;
                }
            }

            // Update existing particles
            const particles = emitter.activeParticles;
            const freeIndices = emitter.freeIndices;
            for (let i = 0; i < particles.length; i++) {
                const p = particles[i];
                if (!p) continue;

                // Age and death
                p.life -= deltaTime;
                if (p.life <= 0) {
                    // Return to pool
                    particles[i] = null;
                    freeIndices.push(i);
                    // Optionally spawn sub‑emitter on death
                    if (emitter.subEmitter && p.subEmitterConfig) {
                        const subCfg = emitter.subEmitter(p);
                        if (subCfg) this.createEmitter({ ...subCfg, position: p.position.clone() });
                    }
                    continue;
                }

                // Physics
                const t = 1 - p.life / p.maxLife;
                p.velocity.addScaledVector(emitter.gravity, deltaTime);
                if (emitter.drag > 0) p.velocity.multiplyScalar(1 - emitter.drag * deltaTime);
                if (emitter.turbulence > 0) {
                    p.velocity.x += (Math.random() - 0.5) * emitter.turbulence * deltaTime;
                    p.velocity.y += (Math.random() - 0.5) * emitter.turbulence * deltaTime;
                    p.velocity.z += (Math.random() - 0.5) * emitter.turbulence * deltaTime;
                }
                // Global forces
                for (const force of this.globalForces) {
                    this.applyForce(p, force, deltaTime);
                }
                p.position.addScaledVector(p.velocity, deltaTime);

                // Update instance data
                const idx = p.instanceIndex;
                // Matrix: translation
                const matrix = new THREE.Matrix4().setPosition(p.position);
                // Scale: uniform scaling by size
                const size = emitter.startSize * (1 - t) + emitter.endSize * t;
                matrix.scale(new THREE.Vector3(size, size, 1));
                // Rotation: around Z axis? We'll handle in shader via rotation attribute.
                // Store matrix in emitter.matrices
                matrix.toArray(emitter.matrices, idx * 16);

                // Color
                const color = p.color.clone().lerp(emitter.endColor, t);
                emitter.colors[idx * 4] = color.r;
                emitter.colors[idx * 4 + 1] = color.g;
                emitter.colors[idx * 4 + 2] = color.b;
                emitter.colors[idx * 4 + 3] = 1.0 - t; // fade alpha

                // Frame animation
                if (emitter.animated) {
                    const totalFrames = emitter.tileCount * emitter.tileCount;
                    const frame = Math.floor(t * totalFrames * emitter.frameRate) % totalFrames;
                    emitter.frames[idx] = frame;
                } else {
                    emitter.frames[idx] = 0;
                }

                // Rotation
                const rot = emitter.startRotation * (1 - t) + emitter.endRotation * t;
                emitter.rotations[idx] = rot;

                emitter.instanceMatrixDirty = true;
                emitter.instanceAttributeDirty = true;
            }

            // Update mesh buffers if dirty
            if (emitter.instanceMatrixDirty) {
                emitter.mesh.instanceMatrix.array.set(emitter.matrices);
                emitter.mesh.instanceMatrix.needsUpdate = true;
                emitter.instanceMatrixDirty = false;
            }
            if (emitter.instanceAttributeDirty) {
                emitter.mesh.geometry.attributes.particleColor.array.set(emitter.colors);
                emitter.mesh.geometry.attributes.particleFrame.array.set(emitter.frames);
                emitter.mesh.geometry.attributes.particleSize.array.set(emitter.sizes);
                emitter.mesh.geometry.attributes.particleRotation.array.set(emitter.rotations);
                emitter.mesh.geometry.attributes.particleColor.needsUpdate = true;
                emitter.mesh.geometry.attributes.particleFrame.needsUpdate = true;
                emitter.mesh.geometry.attributes.particleSize.needsUpdate = true;
                emitter.mesh.geometry.attributes.particleRotation.needsUpdate = true;
                emitter.instanceAttributeDirty = false;
            }

            // Trail generation
            if (emitter.trailLength > 0) {
                emitter.trailTimer += deltaTime;
                while (emitter.trailTimer >= emitter.trailInterval) {
                    emitter.trailTimer -= emitter.trailInterval;
                    for (let i = 0; i < particles.length; i++) {
                        const p = particles[i];
                        if (p) {
                            // Spawn trail particle at current position
                            this.emitTrailParticle(emitter, p);
                        }
                    }
                }
            }
        }
    }

    /**
     * Apply a global force to a particle.
     */
    applyForce(p, force, deltaTime) {
        const pos = p.position;
        switch (force.type) {
            case 'wind':
                p.velocity.addScaledVector(force.direction, force.strength * deltaTime);
                break;
            case 'attractor':
            case 'repulsor': {
                const dir = new THREE.Vector3().subVectors(force.position, pos);
                const dist = dir.length();
                if (dist < force.radius) {
                    const strength = force.strength * (1 - dist / force.radius);
                    dir.normalize();
                    if (force.type === 'repulsor') dir.negate();
                    p.velocity.addScaledVector(dir, strength * deltaTime);
                }
                break;
            }
        }
    }

    /**
     * Emit a single particle from an emitter.
     */
    emitParticle(emitter, customConfig = {}) {
        const freeIdx = emitter.freeIndices.shift();
        if (freeIdx === undefined) return null;

        const p = {
            instanceIndex: freeIdx,
            position: this.getEmissionPosition(emitter),
            velocity: this.getEmissionVelocity(emitter),
            color: emitter.startColor.clone(),
            maxLife: emitter.startLifetime,
            life: emitter.startLifetime,
            subEmitterConfig: customConfig.subEmitterConfig || null
        };
        emitter.activeParticles[freeIdx] = p;
        return p;
    }

    /**
     * Emit a trail particle from a parent particle.
     */
    emitTrailParticle(emitter, parent) {
        const freeIdx = emitter.freeIndices.shift();
        if (freeIdx === undefined) return;
        const p = {
            instanceIndex: freeIdx,
            position: parent.position.clone(),
            velocity: parent.velocity.clone(),
            color: parent.color.clone(),
            maxLife: 0.2, // trail lifetime
            life: 0.2,
            subEmitterConfig: null
        };
        emitter.activeParticles[freeIdx] = p;
    }

    /**
     * Get emission position based on emitter shape.
     */
    getEmissionPosition(emitter) {
        const pos = emitter.position.clone();
        const params = emitter.shapeParams;

        switch (emitter.shape) {
            case 'cone': {
                const angle = THREE.MathUtils.degToRad(params.angle || 45);
                const radius = params.radius || 1;
                const r = Math.random() * radius;
                const theta = Math.random() * Math.PI * 2;
                const phi = (Math.random() - 0.5) * angle;
                const x = r * Math.sin(phi) * Math.cos(theta);
                const y = r * Math.cos(phi);
                const z = r * Math.sin(phi) * Math.sin(theta);
                pos.add(new THREE.Vector3(x, y, z));
                break;
            }
            case 'sphere': {
                const rad = (params.radius || 1) * Math.cbrt(Math.random()); // uniform volume
                const u = Math.random() * 2 - 1;
                const lon = Math.random() * Math.PI * 2;
                const lat = Math.acos(u);
                const x = rad * Math.sin(lat) * Math.cos(lon);
                const y = rad * Math.sin(lat) * Math.sin(lon);
                const z = rad * Math.cos(lat);
                pos.add(new THREE.Vector3(x, y, z));
                break;
            }
            case 'box': {
                const w = (params.width || 1) * (Math.random() - 0.5);
                const h = (params.height || 1) * (Math.random() - 0.5);
                const d = (params.depth || 1) * (Math.random() - 0.5);
                pos.add(new THREE.Vector3(w, h, d));
                break;
            }
            case 'point':
            default:
                // no offset
                break;
        }
        return pos;
    }

    /**
     * Get emission direction based on emitter shape.
     */
    getEmissionVelocity(emitter) {
        const speed = emitter.startSpeed;
        if (emitter.shape === 'cone') {
            const angle = THREE.MathUtils.degToRad(emitter.shapeParams.angle || 45);
            const theta = Math.random() * Math.PI * 2;
            const phi = (Math.random() - 0.5) * angle;
            return new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.cos(phi),
                Math.sin(phi) * Math.sin(theta)
            ).normalize().multiplyScalar(speed);
        } else {
            // Random direction on sphere
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            return new THREE.Vector3(
                Math.sin(phi) * Math.cos(theta),
                Math.sin(phi) * Math.sin(theta),
                Math.cos(phi)
            ).normalize().multiplyScalar(speed);
        }
    }

    /**
     * Add a global force.
     */
    addForce(force) {
        this.globalForces.push(force);
    }

    /**
     * Remove a global force.
     */
    removeForce(force) {
        const idx = this.globalForces.indexOf(force);
        if (idx !== -1) this.globalForces.splice(idx, 1);
    }

    /**
     * Remove an emitter.
     */
    removeEmitter(emitter) {
        const idx = this.emitters.indexOf(emitter);
        if (idx !== -1) {
            this.scene.remove(emitter.mesh);
            emitter.mesh.geometry.dispose();
            emitter.mesh.material.dispose();
            this.emitters.splice(idx, 1);
        }
    }

    /**
     * Burst particles from an emitter.
     */
    burst(emitter, count) {
        for (let i = 0; i < count; i++) {
            if (emitter.freeIndices.length === 0) break;
            this.emitParticle(emitter);
        }
    }
}
