import * as THREE from 'three';

export class ShaderManager {
    constructor() {
        this.shaders = {};
    }

    init() {
        // ========== PORTAL SHADER – Swirling Energy Vortex ==========
        this.shaders.portal = {
            vertex: `
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    vUv = uv;
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragment: `
                uniform float time;
                uniform vec3 cameraPosition;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // Center distance for radial effects
                    vec2 centeredUv = vUv * 2.0 - 1.0;
                    float r = length(centeredUv);
                    float a = atan(centeredUv.y, centeredUv.x);

                    // Fresnel effect (glow at edges)
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

                    // Swirling colors based on angle and time
                    float t = time * 1.5;
                    float swirl1 = sin(a * 8.0 + t) * 0.5 + 0.5;
                    float swirl2 = cos(a * 6.0 - t * 1.3) * 0.5 + 0.5;
                    float swirl3 = sin(a * 10.0 + t * 2.0) * 0.5 + 0.5;

                    // Radial pulse
                    float pulse = sin(r * 15.0 - t * 4.0) * 0.5 + 0.5;
                    float innerGlow = smoothstep(0.8, 0.2, r) * pulse;

                    // Base colors – deep purple to cyan to magenta
                    vec3 colorA = vec3(0.2, 0.0, 0.6); // deep purple
                    vec3 colorB = vec3(0.0, 0.8, 1.0); // cyan
                    vec3 colorC = vec3(1.0, 0.2, 0.8); // hot pink

                    // Mix colors based on swirls
                    vec3 color = mix(colorA, colorB, swirl1);
                    color = mix(color, colorC, swirl2);
                    color = mix(color, vec3(1.0, 1.0, 1.0), swirl3 * 0.3);

                    // Add brightness based on inner glow
                    color += innerGlow * 2.0;

                    // Edge darkening (vignette) based on distance from center
                    float vignette = 1.0 - smoothstep(0.3, 1.0, r);
                    color *= vignette;

                    // Fresnel adds a blue-white rim
                    color += vec3(0.6, 0.8, 1.0) * fresnel * 1.5;

                    // Alpha – transparent edges, solid center
                    float alpha = smoothstep(1.0, 0.2, r);
                    alpha = clamp(alpha + innerGlow * 0.5, 0.2, 1.0);

                    gl_FragColor = vec4(color, alpha);
                }
            `
        };

        // ========== WATER SHADER – Realistic Ocean with Gerstner Waves ==========
        this.shaders.water = {
            vertex: `
                uniform float time;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    vUv = uv;

                    // Gerstner wave displacement (simplified but effective)
                    float wave1 = sin(position.x * 2.0 + time * 3.0) * cos(position.z * 2.0 + time * 2.0) * 0.3;
                    float wave2 = sin(position.x * 4.0 - time * 4.0) * 0.2;
                    float wave3 = cos(position.z * 3.0 + time * 5.0) * 0.2;
                    float waveY = wave1 + wave2 + wave3;

                    vec3 displacedPosition = vec3(position.x, position.y + waveY, position.z);

                    // Approximate normal by using derivatives (simplified, but we'll compute in fragment using dFdx)
                    // Pass position to fragment for normal calculation
                    vPosition = displacedPosition;

                    vec4 mvPosition = modelViewMatrix * vec4(displacedPosition, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragment: `
                uniform float time;
                uniform vec3 cameraPosition;
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vViewPosition;

                void main() {
                    // Compute normal from position derivatives for wave lighting
                    vec3 dx = dFdx(vPosition);
                    vec3 dy = dFdy(vPosition);
                    vec3 normal = normalize(cross(dx, dy));

                    // View direction
                    vec3 viewDir = normalize(vViewPosition);

                    // Fresnel for water
                    float fresnel = pow(1.0 - max(0.0, dot(normal, viewDir)), 2.0);

                    // Depth-based color (shallow to deep)
                    float depthFactor = clamp(vPosition.y * 0.5 + 0.5, 0.0, 1.0);
                    vec3 shallowColor = vec3(0.1, 0.6, 0.5);  // turquoise
                    vec3 deepColor = vec3(0.0, 0.1, 0.3);    // deep blue
                    vec3 baseColor = mix(shallowColor, deepColor, depthFactor);

                    // Sun reflection / specular
                    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0)); // directional light from sun
                    float spec = pow(max(0.0, dot(reflect(-lightDir, normal), viewDir)), 32.0);
                    vec3 specColor = vec3(1.0, 0.9, 0.8) * spec;

                    // Foam based on wave steepness (using normal Y)
                    float foam = max(0.0, 1.0 - abs(normal.y));
                    foam = smoothstep(0.5, 0.8, foam);
                    vec3 foamColor = vec3(0.9, 0.95, 1.0);

                    // Combine
                    vec3 color = baseColor + specColor * 1.5;
                    color = mix(color, foamColor, foam * 0.8);

                    // Add caustics / light shafts (simplified as glitter)
                    float glitter = sin(vPosition.x * 20.0 + time) * sin(vPosition.z * 20.0 + time) * 0.2;
                    color += glitter * vec3(0.8, 0.9, 1.0);

                    // Alpha: nearly opaque but with some transparency
                    float alpha = 0.95;

                    gl_FragColor = vec4(color, alpha);
                }
            `
        };

        // ========== ENERGY FIELD SHADER (Bonus) – Pulsing Shield ==========
        this.shaders.energyField = {
            vertex: `
                varying vec2 vUv;
                varying vec3 vPosition;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    vUv = uv;
                    vPosition = position;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vViewPosition = -mvPosition.xyz;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragment: `
                uniform float time;
                varying vec2 vUv;
                varying vec3 vNormal;
                varying vec3 vViewPosition;

                void main() {
                    // Hexagonal grid pattern
                    vec2 uv = vUv * 4.0;
                    float grid = sin(uv.x * 3.14159) * sin(uv.y * 3.14159);
                    grid = abs(grid);
                    grid = smoothstep(0.8, 0.9, grid);

                    // Pulsing glow
                    float pulse = sin(time * 5.0) * 0.5 + 0.5;

                    // Fresnel
                    vec3 normal = normalize(vNormal);
                    vec3 viewDir = normalize(vViewPosition);
                    float fresnel = pow(1.0 - abs(dot(normal, viewDir)), 3.0);

                    // Colors
                    vec3 colorA = vec3(0.2, 0.8, 1.0); // cyan
                    vec3 colorB = vec3(0.8, 0.2, 1.0); // magenta
                    vec3 color = mix(colorA, colorB, pulse);

                    // Combine
                    color += grid * colorA * 2.0;
                    color *= (fresnel * 1.5 + 0.5);

                    float alpha = fresnel * 0.8 + 0.2;

                    gl_FragColor = vec4(color, alpha);
                }
            `
        };
    }

    getShader(name) {
        return this.shaders[name];
    }
}
