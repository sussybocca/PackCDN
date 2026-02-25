import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GlitchPass } from 'three/addons/postprocessing/GlitchPass.js';
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { SAOPass } from 'three/addons/postprocessing/SAOPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';

export class PostProcessor {
    constructor(renderer, scene, camera) {
        this.renderer = renderer;
        this.scene = scene;
        this.camera = camera;
        this.composer = new EffectComposer(renderer);
        this.passes = {};

        // Ensure renderer has necessary capabilities
        this.renderer.depth = true;
        this.renderer.stencil = true;
    }

    init() {
        // ========== BASE RENDER ==========
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        // ========== AMBIENT OCCLUSION (SSAO) ==========
        const saoPass = new SAOPass(this.scene, this.camera);
        saoPass.params = {
            output: SAOPass.OUTPUT.Default,
            saoBias: 0.5,
            saoIntensity: 0.8,
            saoScale: 100,
            saoKernelRadius: 50,
            saoMinResolution: 0,
            saoBlur: true,
            saoBlurRadius: 8,
            saoBlurStdDev: 4,
            saoBlurDepthCutoff: 0.01
        };
        this.composer.addPass(saoPass);
        this.passes.sao = saoPass;

        // ========== BLOOM ==========
        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.5, 0.85);
        bloomPass.threshold = 0.6;
        bloomPass.strength = 1.5;
        bloomPass.radius = 0.6;
        this.composer.addPass(bloomPass);
        this.passes.bloom = bloomPass;

        // ========== COLOR CORRECTION ==========
        const colorCorrectionShader = {
            uniforms: {
                tDiffuse: { value: null },
                brightness: { value: 0.05 },
                contrast: { value: 1.2 },
                saturation: { value: 1.15 }
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
                    color.rgb += brightness;
                    color.rgb = (color.rgb - 0.5) * contrast + 0.5;
                    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                    color.rgb = mix(vec3(gray), color.rgb, saturation);
                    gl_FragColor = color;
                }
            `
        };
        const colorPass = new ShaderPass(colorCorrectionShader);
        this.composer.addPass(colorPass);
        this.passes.color = colorPass;

        // ========== GOD RAYS (Lens Flare) ==========
        const godRayShader = {
            uniforms: {
                tDiffuse: { value: null },
                lightPosition: { value: new THREE.Vector2(0.7, 0.3) },
                exposure: { value: 0.4 },
                decay: { value: 0.95 },
                density: { value: 0.8 },
                weight: { value: 0.4 },
                samples: { value: 50 }
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
                uniform vec2 lightPosition;
                uniform float exposure;
                uniform float decay;
                uniform float density;
                uniform float weight;
                uniform int samples;
                varying vec2 vUv;

                void main() {
                    vec2 texCoord = vUv;
                    vec2 deltaTexCoord = texCoord - lightPosition;
                    deltaTexCoord *= 1.0 / float(samples) * density;
                    vec3 color = texture2D(tDiffuse, texCoord).rgb;
                    float illuminationDecay = 1.0;
                    for (int i = 0; i < 50; i++) {
                        texCoord -= deltaTexCoord;
                        vec3 sampleColor = texture2D(tDiffuse, texCoord).rgb;
                        sampleColor *= illuminationDecay * weight;
                        color += sampleColor;
                        illuminationDecay *= decay;
                    }
                    color *= exposure;
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        };
        const godRayPass = new ShaderPass(godRayShader);
        this.composer.addPass(godRayPass);
        this.passes.godRay = godRayPass;

        // ========== RGB SHIFT ==========
        const rgbShiftPass = new ShaderPass(RGBShiftShader);
        rgbShiftPass.uniforms['amount'].value = 0.003;
        this.composer.addPass(rgbShiftPass);
        this.passes.rgbShift = rgbShiftPass;

        // ========== DEPTH OF FIELD (Bokeh) ==========
        const bokehPass = new BokehPass(this.scene, this.camera, {
            focus: 10.0,
            aperture: 0.025,
            maxblur: 0.01,
            width: window.innerWidth,
            height: window.innerHeight
        });
        this.composer.addPass(bokehPass);
        this.passes.bokeh = bokehPass;

        // ========== FILM GRAIN ==========
        const filmPass = new FilmPass(0.2, 0.0, 2048, false);
        filmPass.renderToScreen = false;
        this.composer.addPass(filmPass);
        this.passes.film = filmPass;

        // ========== VIGNETTE ==========
        const vignetteShader = {
            uniforms: {
                tDiffuse: { value: null },
                offset: { value: 0.8 },
                darkness: { value: 0.8 }
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
                    float vignette = smoothstep(offset, offset * 0.2, dist);
                    vignette = pow(vignette, darkness);
                    color.rgb *= vignette;
                    gl_FragColor = color;
                }
            `
        };
        const vignettePass = new ShaderPass(vignetteShader);
        vignettePass.renderToScreen = false; // Will be set to true later
        this.composer.addPass(vignettePass);
        this.passes.vignette = vignettePass;

        // ========== GLITCH (disabled) ==========
        const glitchPass = new GlitchPass();
        glitchPass.goWild = false;
        glitchPass.enabled = false;
        this.composer.addPass(glitchPass);
        this.passes.glitch = glitchPass;

        // ========== AFTERIMAGE (disabled) ==========
        const afterimagePass = new AfterimagePass(0.95);
        afterimagePass.enabled = false;
        this.composer.addPass(afterimagePass);
        this.passes.afterimage = afterimagePass;

        // Set the last active pass to render to screen (vignette)
        vignettePass.renderToScreen = true;
        glitchPass.renderToScreen = false;
        afterimagePass.renderToScreen = false;
        filmPass.renderToScreen = false;

        // Log success
        console.log('PostProcessor initialized with all effects');
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

    setGodRayIntensity(val) {
        if (this.passes.godRay) this.passes.godRay.uniforms.exposure.value = val;
    }
}
