import * as THREE from 'three';
import { ShaderManager } from './ShaderManager.js';

export class WaterEffect {
    constructor(scene, camera, renderer, options = {}) { // <-- added renderer parameter
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer; // <-- store renderer
        this.shaderManager = new ShaderManager();
        this.mesh = null;
        this.waveHeight = options.waveHeight || 0.5;
        this.waveLength = options.waveLength || 2.0;
        this.speed = options.speed || 1.0;
        this.windDirection = options.windDirection || new THREE.Vector2(1, 0.5);
        this.windDirection.normalize();
        this.colorShallow = options.colorShallow || new THREE.Color(0x1a4d8c);
        this.colorDeep = options.colorDeep || new THREE.Color(0x0a1a3a);
        this.foamColor = options.foamColor || new THREE.Color(0xffffff);
        this.transparency = options.transparency || 0.8;
        this.reflectionStrength = options.reflectionStrength || 0.5;
        this.refractionStrength = options.refractionStrength || 0.2;
        this.causticsStrength = options.causticsStrength || 0.3;

        // Reflection/refraction targets
        this.reflectionCamera = new THREE.PerspectiveCamera();
        this.refractionCamera = new THREE.PerspectiveCamera();
        this.reflectionTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.refractionTexture = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight);
        this.reflectionTexture.texture.format = THREE.RGBAFormat;
        this.refractionTexture.texture.format = THREE.RGBAFormat;

        // Normal map (procedural)
        this.normalMap = this.createNormalMap();

        // Foam texture (procedural)
        this.foamTexture = this.createFoamTexture();

        // Caustics texture (procedural)
        this.causticsTexture = this.createCausticsTexture();

        // Interaction ripples
        this.ripples = []; // { position, strength, age }

        // Buoyancy objects (bodies that float)
        this.buoyantBodies = new Set();
    }

    createNormalMap() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const nx = x / 256 - 0.5;
                const ny = y / 256 - 0.5;
                const val = Math.sin(nx * 10) * Math.cos(ny * 10);
                const r = (val * 0.5 + 0.5) * 255;
                const g = (val * 0.5 + 0.5) * 255;
                const b = 255;
                const idx = (y * 256 + x) * 4;
                imageData.data[idx] = r;
                imageData.data[idx+1] = g;
                imageData.data[idx+2] = b;
                imageData.data[idx+3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    createFoamTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, 128, 128);
        const imageData = ctx.getImageData(0, 0, 128, 128);
        for (let i = 0; i < imageData.data.length; i += 4) {
            const noise = Math.random() * 0.3 + 0.7;
            imageData.data[i] *= noise;
            imageData.data[i+1] *= noise;
            imageData.data[i+2] *= noise;
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    createCausticsTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        const imageData = ctx.createImageData(256, 256);
        for (let y = 0; y < 256; y++) {
            for (let x = 0; x < 256; x++) {
                const val = (Math.sin(x * 0.1) * Math.cos(y * 0.1) + 1) * 0.5;
                const idx = (y * 256 + x) * 4;
                imageData.data[idx] = val * 255;
                imageData.data[idx+1] = val * 255;
                imageData.data[idx+2] = val * 255;
                imageData.data[idx+3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
        return new THREE.CanvasTexture(canvas);
    }

    init() {
        this.shaderManager.init();
        // Use 'water' shader if 'waterAdvanced' not available; fallback to water.
        let waterShader = this.shaderManager.getShader('waterAdvanced');
        if (!waterShader) {
            waterShader = this.shaderManager.getShader('water');
        }
        if (!waterShader) {
            console.error('Water shader not found');
            return;
        }

        const geometry = new THREE.PlaneGeometry(200, 200, 128, 128);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                windDirection: { value: new THREE.Vector2(this.windDirection.x, this.windDirection.y) },
                waveHeight: { value: this.waveHeight },
                waveLength: { value: this.waveLength },
                speed: { value: this.speed },
                colorShallow: { value: this.colorShallow },
                colorDeep: { value: this.colorDeep },
                foamColor: { value: this.foamColor },
                transparency: { value: this.transparency },
                reflectionStrength: { value: this.reflectionStrength },
                refractionStrength: { value: this.refractionStrength },
                causticsStrength: { value: this.causticsStrength },
                normalMap: { value: this.normalMap },
                foamTexture: { value: this.foamTexture },
                causticsTexture: { value: this.causticsTexture },
                reflectionTexture: { value: this.reflectionTexture.texture },
                refractionTexture: { value: this.refractionTexture.texture },
                cameraPos: { value: this.camera.position.clone() },
                lightDir: { value: new THREE.Vector3(1, 1, 1).normalize() },
                lightColor: { value: new THREE.Color(0xffeedd) },
                ripples: { value: new THREE.Vector4(0,0,0,0) }
            },
            vertexShader: waterShader.vertex || `
                uniform float time;
                uniform vec2 windDirection;
                uniform float waveHeight;
                uniform float waveLength;
                uniform float speed;
                varying vec3 vPosition;
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    vUv = uv;
                    float freq = 2.0 * 3.14159 / waveLength;
                    float phase = time * speed;
                    vec2 dir = windDirection;
                    float d = dot(position.xz, dir);
                    float wave = sin(d * freq + phase) * waveHeight;
                    vec3 displaced = position + vec3(0.0, wave, 0.0);
                    float dx = cos(d * freq + phase) * waveHeight * freq * dir.x;
                    float dz = cos(d * freq + phase) * waveHeight * freq * dir.y;
                    vec3 tangent = vec3(1.0, dx, 0.0);
                    vec3 bitangent = vec3(0.0, dz, 1.0);
                    vNormal = normalize(cross(tangent, bitangent));
                    vPosition = displaced;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
                }
            `,
            fragmentShader: waterShader.fragment || `
                uniform float time;
                uniform vec3 colorShallow;
                uniform vec3 colorDeep;
                uniform vec3 foamColor;
                uniform float transparency;
                uniform float reflectionStrength;
                uniform float refractionStrength;
                uniform float causticsStrength;
                uniform sampler2D normalMap;
                uniform sampler2D foamTexture;
                uniform sampler2D causticsTexture;
                uniform sampler2D reflectionTexture;
                uniform sampler2D refractionTexture;
                uniform vec3 cameraPos;
                uniform vec3 lightDir;
                uniform vec3 lightColor;
                uniform vec4 ripples;
                varying vec3 vPosition;
                varying vec2 vUv;
                varying vec3 vNormal;

                void main() {
                    vec3 normalMap = texture2D(normalMap, vUv * 4.0 + time * 0.1).xyz * 2.0 - 1.0;
                    vec3 normal = normalize(vNormal + normalMap * 0.5);
                    vec3 viewDir = normalize(cameraPos - vPosition);
                    float fresnel = dot(viewDir, normal);
                    fresnel = pow(1.0 - max(0.0, fresnel), 3.0);
                    float depth = vPosition.y * 0.5 + 0.5;
                    vec3 baseColor = mix(colorShallow, colorDeep, depth);
                    vec2 screenUV = gl_FragCoord.xy / vec2(800.0, 600.0);
                    vec3 reflection = texture2D(reflectionTexture, screenUV).rgb;
                    vec3 refraction = texture2D(refractionTexture, screenUV).rgb;
                    float steepness = abs(vNormal.y);
                    float foam = smoothstep(0.2, 0.5, 1.0 - steepness);
                    vec3 foamSample = texture2D(foamTexture, vUv * 10.0 + time * 0.5).rgb;
                    foam *= foamSample.r;
                    float caustic = texture2D(causticsTexture, vUv * 5.0 + time * 0.2).r;
                    float rippleDist = length(vPosition.xz - ripples.xy);
                    float ripple = exp(-rippleDist * rippleDist * 2.0) * ripples.z;
                    vec3 finalColor = baseColor;
                    finalColor += reflection * reflectionStrength * fresnel;
                    finalColor += refraction * refractionStrength * (1.0 - fresnel);
                    finalColor += foam * foamColor;
                    finalColor += caustic * causticsStrength * lightColor;
                    finalColor += vec3(ripple) * 0.5;
                    float alpha = transparency;
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.rotation.x = -Math.PI / 2;
        this.mesh.position.y = 0.0;
        this.scene.add(this.mesh);
    }

    renderReflection() {
        if (!this.mesh) return;
        this.reflectionCamera.position.copy(this.camera.position);
        this.reflectionCamera.position.y = -this.camera.position.y + 2.0;
        this.reflectionCamera.rotation.copy(this.camera.rotation);
        this.reflectionCamera.rotation.x = -this.camera.rotation.x;
        this.reflectionCamera.updateMatrixWorld();
        this.reflectionCamera.projectionMatrix.copy(this.camera.projectionMatrix);

        this.mesh.visible = false;
        this.renderer.setRenderTarget(this.reflectionTexture);
        this.renderer.render(this.scene, this.reflectionCamera);
        this.renderer.setRenderTarget(null);
        this.mesh.visible = true;
    }

    renderRefraction() {
        if (!this.mesh) return;
        this.mesh.visible = false;
        this.renderer.setRenderTarget(this.refractionTexture);
        this.renderer.render(this.scene, this.camera);
        this.renderer.setRenderTarget(null);
        this.mesh.visible = true;
    }

    addRipple(position, strength) {
        this.ripples.push({ x: position.x, z: position.z, strength, age: 0 });
    }

    addBuoyantBody(body) {
        this.buoyantBodies.add(body);
    }

    applyBuoyancy(deltaTime) {
        for (let body of this.buoyantBodies) {
            const depth = 0.0 - body.position.y;
            if (depth > 0) {
                const force = new CANNON.Vec3(0, depth * body.mass * 5.0, 0);
                body.applyForce(force, body.position);
                body.velocity.y *= 0.99;
            }
        }
    }

    update(deltaTime) {
        if (!this.mesh) return;
        this.mesh.material.uniforms.time.value += deltaTime;

        for (let i = this.ripples.length - 1; i >= 0; i--) {
            const r = this.ripples[i];
            r.age += deltaTime;
            if (r.age > 2.0) {
                this.ripples.splice(i, 1);
            }
        }
        if (this.ripples.length > 0) {
            const r = this.ripples[0];
            this.mesh.material.uniforms.ripples.value.set(r.x, r.z, r.strength * (1 - r.age/2), 0);
        } else {
            this.mesh.material.uniforms.ripples.value.set(0,0,0,0);
        }

        this.applyBuoyancy(deltaTime);
        this.mesh.material.uniforms.cameraPos.value.copy(this.camera.position);
    }
}
