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
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // ========== BLOOM – cranked to insane levels ==========
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 2.5, 0.6, 0.9);
        bloomPass.threshold = 0.05;      // Lower threshold = more bloom
        bloomPass.strength = 2.0;         // Higher strength = brighter bloom
        bloomPass.radius = 0.8;           // Larger radius = softer bloom
        this.composer.addPass(bloomPass);
        this.passes.bloom = bloomPass;

        // ========== RGB SHIFT (chromatic aberration) – max distortion ==========
        const rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms['amount'].value = 0.02; // Double the previous value
        this.composer.addPass(rgbShiftPass);
        this.passes.rgbShift = rgbShiftPass;

        // ========== AFTERIMAGE (motion blur) – longer trails ==========
        const afterimagePass = new AfterimagePass(0.85); // Lower = longer trail
        afterimagePass.renderToScreen = false; // Will be set later
        this.composer.addPass(afterimagePass);
        this.passes.afterimage = afterimagePass;

        // ========== FILM GRAIN – add cinematic noise ==========
        const filmPass = new FilmPass(0.5, 0.5, 2048, false); // intensity, scanlines, grain size, monochrome
        filmPass.renderToScreen = false;
        this.composer.addPass(filmPass);
        this.passes.film = filmPass;

        // ========== GLITCH – for time dilation / chaos ==========
        const glitchPass = new GlitchPass();
        glitchPass.goWild = false;
        glitchPass.enabled = true; // Enable by default but subtle
        this.composer.addPass(glitchPass);
        this.passes.glitch = glitchPass;

        // ========== VIGNETTE (custom shader) – darken edges ==========
        const vignetteShader = {
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 1.0 },
                darkness: { value: 1.5 }
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
                    float vignette = smoothstep(0.8, offset * 0.5, dist);
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

        // Ensure the last pass renders to screen (afterimage is not last, so set the last pass)
        // We'll set the last added pass (vignette) to render to screen.
        // But we need to manage which pass is last. We can set afterimage to not render, and vignette to render.
        afterimagePass.renderToScreen = false;
        filmPass.renderToScreen = false;
        glitchPass.renderToScreen = false;
        vignettePass.renderToScreen = true; // This will be the final output

        // Also optionally add a DotScreenPass for retro? No, skip for immersion.
    }

    render(deltaTime) {
        // Update glitch wild mode randomly
        if (this.passes.glitch.enabled && Math.random() > 0.98) { // Slightly more often
            this.passes.glitch.goWild = true;
        } else {
            this.passes.glitch.goWild = false;
        }

        // Update film grain time uniform if needed (FilmPass handles internally)

        this.composer.render();
    }

    setBloom(enable) {
        this.passes.bloom.enabled = enable;
    }

    setGlitch(enable) {
        this.passes.glitch.enabled = enable;
    }

    // Additional controls if needed
    setFilmIntensity(val) {
        if (this.passes.film) this.passes.film.uniforms.intensity.value = val;
    }
}
