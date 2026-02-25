import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { DotScreenPass } from 'three/addons/postprocessing/DotScreenPass.js';

export class PostProcessor {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = new EffectComposer(renderer);
        this.passes = {};
    }

    init() {
        // 1. Base render
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // 2. BLOOM – subtle, natural glow (only highlights)
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.2, 0.4, 0.85);
        bloomPass.threshold = 0.8;        // Only very bright areas
        bloomPass.strength = 1.0;          // Gentle glow
        bloomPass.radius = 0.5;            // Soft radius
        this.composer.addPass(bloomPass);
        this.passes.bloom = bloomPass;

        // 3. COLOR CORRECTION (custom) – contrast & saturation boost
        const colorCorrectionShader = {
            uniforms: {
                tDiffuse: { value: null },
                brightness: { value: 0.05 },
                contrast: { value: 1.15 },
                saturation: { value: 1.1 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float brightness;
                uniform float contrast;
                uniform float saturation;
                varying vec2 vUv;

                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    // Brightness
                    color.rgb += brightness;
                    // Contrast
                    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                    // Saturation
                    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    color.rgb = mix(vec3(gray), color.rgb, saturation);
                    gl_FragColor = color;
                }
            `
        };
        const colorPass = new ShaderPass(colorCorrectionShader);
        this.composer.addPass(colorPass);
        this.passes.color = colorPass;

        // 4. RGB SHIFT – very subtle chromatic aberration (lens effect)
        const rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms['amount'].value = 0.002; // Barely noticeable
        this.composer.addPass(rgbShiftPass);
        this.passes.rgbShift = rgbShiftPass;

        // 5. FILM GRAIN – cinematic texture (extremely light)
        const filmPass = new FilmPass(0.15, 0.0, 2048, false); // intensity, scanlines (0), grain size, monochrome
        filmPass.renderToScreen = false;
        this.composer.addPass(filmPass);
        this.passes.film = filmPass;

        // 6. VIGNETTE – subtle darkening at edges (draws focus)
        const vignetteShader = {
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 0.9 },
                darkness: { value: 0.7 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D tDiffuse;
                uniform float offset;
                uniform float darkness;
                varying vec2 vUv;
                void main() {
                    vec4 color = texture2D(tDiffuse, vUv);
                    float dist = distance(vUv, vec2(0.5, 0.5));
                    float vignette = smoothstep(offset, offset * 0.25, dist);
                    vignette = pow(vignette, darkness);
                    color.rgb *= vignette;
                    gl_FragColor = color;
                }
            `
        };
        const vignettePass = new ShaderPass(vignetteShader);
        vignettePass.renderToScreen = false;
        this.composer.addPass(vignettePass);
        this.passes.vignette = vignettePass;

        // 7. GLITCH – disabled by default (can be activated for special effects)
        const glitchPass = new GlitchPass();
        glitchPass.goWild = false;
        glitchPass.enabled = false;
        this.composer.addPass(glitchPass);
        this.passes.glitch = glitchPass;

        // 8. AFTERIMAGE – disabled (not needed for general immersion)
        const afterimagePass = new AfterimagePass(0.95);
        afterimagePass.enabled = false;
        this.composer.addPass(afterimagePass);
        this.passes.afterimage = afterimagePass;

        // Set the last active pass to render to screen (vignette)
        vignettePass.renderToScreen = true;
        glitchPass.renderToScreen = false;
        afterimagePass.renderToScreen = false;
        filmPass.renderToScreen = false;
    }

    render(deltaTime) {
        // Update glitch wild mode if enabled (rarely)
        if (this.passes.glitch.enabled && Math.random() > 0.98) {
            this.passes.glitch.goWild = true;
        } else {
            this.passes.glitch.goWild = false;
        }

        this.composer.render();
    }

    setBloom(enable) {
        this.passes.bloom.enabled = enable;
    }

    setGlitch(enable) {
        this.passes.glitch.enabled = enable;
    }

    setFilmIntensity(val) {
        if (this.passes.film) this.passes.film.uniforms.intensity.value = val;
    }
}
