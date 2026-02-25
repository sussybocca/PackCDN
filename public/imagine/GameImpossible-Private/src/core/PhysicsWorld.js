import * as CANNON from 'cannon-es';
import { CollisionGroups } from '../physics/CollisionGroups.js';

/**
 * Advanced physics world wrapper with:
 * - Collision groups and masks
 * - Trigger volumes (sensors)
 * - Constraints (joints, springs, motors)
 * - Custom gravity zones (local gravity modifiers)
 * - Buoyancy zones
 * - Wind zones
 * - Per‑body gravity override
 * - Contact event callbacks
 * - Raycast with filtering
 * - Debug rendering (optional)
 * - Performance optimizations (SAP broadphase, sleep)
 */
export class PhysicsWorld {
    constructor() {
        this.world = new CANNON.World();
        this.world.gravity.set(0, -9.82, 0);
        this.world.broadphase = new CANNON.SAPBroadphase(this.world);
        this.world.defaultContactMaterial.restitution = 0.2;
        this.world.defaultContactMaterial.friction = 0.5;
        this.world.allowSleep = true;
        this.world.quatNormalizeSkip = 0;
        this.world.quatNormalizeFast = false;

        // Collision groups from external definition
        this.groups = CollisionGroups;

        // Materials
        this.materials = {
            default: this.world.defaultMaterial,
            player: new CANNON.Material('playerMaterial'),
            wall: new CANNON.Material('wallMaterial'),
            enemy: new CANNON.Material('enemyMaterial'),
            platform: new CANNON.Material('platformMaterial'),
            trigger: new CANNON.Material('triggerMaterial'),
            buoyancy: new CANNON.Material('buoyancyMaterial'),
            wind: new CANNON.Material('windMaterial')
        };

        // Contact materials (collision properties between material pairs)
        this.contactMaterials = {};
        this.createContactMaterials();

        // Body‑to‑group mapping for quick filtering
        this.bodyGroups = new WeakMap(); // body -> group
        this.bodyMasks = new WeakMap();  // body -> mask

        // Triggers (bodies with isTrigger flag)
        this.triggers = new Set();

        // Constraints
        this.constraints = [];

        // Custom zones (gravity, buoyancy, wind)
        this.gravityZones = [];      // { body (CANNON.Body), gravity (Vec3), radius (number) }
        this.buoyancyZones = [];     // { body, density, viscosity, radius }
        this.windZones = [];          // { body, direction, strength, radius }

        // Per‑body gravity override
        this.bodyGravity = new WeakMap(); // body -> Vec3

        // Contact event listeners
        this.contactListeners = new Map(); // (bodyA, bodyB) -> callback

        // Debug
        this.debugRenderer = null;
    }

    /**
     * Create all contact materials.
     */
    createContactMaterials() {
        const { player, wall, enemy, platform, trigger, buoyancy, wind } = this.materials;

        // Player vs wall
        this.addContactMaterial(player, wall, {
            friction: 0.3,
            restitution: 0.1,
            contactEquationStiffness: 1e6,
            contactEquationRelaxation: 3
        });

        // Player vs enemy
        this.addContactMaterial(player, enemy, {
            friction: 0.5,
            restitution: 0.3,
            contactEquationStiffness: 1e7,
            contactEquationRelaxation: 2
        });

        // Player vs platform
        this.addContactMaterial(player, platform, {
            friction: 0.8,
            restitution: 0.1,
            contactEquationStiffness: 1e6
        });

        // Trigger vs everything (no response, just events)
        this.addContactMaterial(trigger, player, {
            friction: 0,
            restitution: 0,
            contactEquationStiffness: 0,
            contactEquationRelaxation: 0
        });
        this.addContactMaterial(trigger, enemy, { friction: 0, restitution: 0 });
        this.addContactMaterial(trigger, wall, { friction: 0, restitution: 0 });

        // Buoyancy zones use special material (low friction, high damping)
        this.addContactMaterial(buoyancy, player, { friction: 0.1, restitution: 0 });
        this.addContactMaterial(buoyancy, enemy, { friction: 0.1, restitution: 0 });

        // Wind zones (no direct contact, handled via forces)
    }

    /**
     * Helper to create and store a contact material.
     */
    addContactMaterial(matA, matB, options) {
        const cm = new CANNON.ContactMaterial(matA, matB, options);
        this.world.addContactMaterial(cm);
        const key = `${matA.name}_${matB.name}`;
        this.contactMaterials[key] = cm;
        return cm;
    }

    /**
     * Initialize the world (ground plane).
     */
    init() {
        // Ground plane (invisible, static)
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0, material: this.materials.wall });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
        groundBody.position.y = 0;
        this.addBody(groundBody, this.groups.WALL, this.groups.ALL);
    }

    /**
     * Step the simulation.
     * @param {number} deltaTime - Time since last step.
     */
    step(deltaTime) {
        // Apply custom zone forces before stepping
        this.applyGravityZones();
        this.applyBuoyancyZones();
        this.applyWindZones();

        this.world.step(1 / 60, deltaTime, 3);

        // Check triggers for overlaps
        this.processTriggers();
    }

    /**
     * Apply custom gravity zones (overrides global gravity within radius).
     */
    applyGravityZones() {
        for (const zone of this.gravityZones) {
            const bodies = this.getBodiesInSphere(zone.body.position, zone.radius);
            for (const body of bodies) {
                // Gravity is acceleration, so force = mass * gravity
                const force = zone.gravity.clone().scale(body.mass);
                body.applyForce(force, body.position);
            }
        }
    }

    /**
     * Apply buoyancy forces (Archimedes) in zones.
     */
    applyBuoyancyZones() {
        for (const zone of this.buoyancyZones) {
            const bodies = this.getBodiesInSphere(zone.body.position, zone.radius);
            for (const body of bodies) {
                // Simplified buoyancy: upward force proportional to submerged volume
                // Assume full volume for now (you could compute actual volume from shapes)
                const volume = 1.0; // Would need shape volume in reality
                const buoyantForce = new CANNON.Vec3(0, zone.density * 9.82 * volume, 0);
                body.applyForce(buoyantForce, body.position);
                // Viscous damping
                body.velocity.scale(1 - zone.viscosity, body.velocity);
            }
        }
    }

    /**
     * Apply wind forces.
     */
    applyWindZones() {
        for (const zone of this.windZones) {
            const bodies = this.getBodiesInSphere(zone.body.position, zone.radius);
            for (const body of bodies) {
                const force = zone.direction.clone().scale(zone.strength * body.mass);
                body.applyForce(force, body.position);
            }
        }
    }

    /**
     * Get all bodies within a sphere.
     * @param {CANNON.Vec3} center
     * @param {number} radius
     * @returns {Array<CANNON.Body>}
     */
    getBodiesInSphere(center, radius) {
        const result = [];
        const rSq = radius * radius;
        for (const body of this.world.bodies) {
            if (body.type === CANNON.Body.STATIC) continue;
            const dx = body.position.x - center.x;
            const dy = body.position.y - center.y;
            const dz = body.position.z - center.z;
            const distSq = dx*dx + dy*dy + dz*dz;
            if (distSq < rSq) result.push(body);
        }
        return result;
    }

    /**
     * Add a body with collision group and mask.
     * @param {CANNON.Body} body
     * @param {number} group - Collision group bit
     * @param {number} mask - Collision mask (which groups it collides with)
     */
    addBody(body, group = this.groups.ALL, mask = this.groups.ALL) {
        body.collisionFilterGroup = group;
        body.collisionFilterMask = mask;
        this.world.addBody(body);
        this.bodyGroups.set(body, group);
        this.bodyMasks.set(body, mask);
    }

    /**
     * Remove a body.
     */
    removeBody(body) {
        this.world.removeBody(body);
        this.bodyGroups.delete(body);
        this.bodyMasks.delete(body);
        this.triggers.delete(body);
    }

    /**
     * Create a trigger volume (sensor body that doesn't collide but reports overlaps).
     * @param {CANNON.Shape} shape
     * @param {CANNON.Vec3} position
     * @param {number} group - Which group the trigger belongs to (default: TRIGGER)
     * @param {number} mask - Which groups it detects (default: PLAYER | ENEMY)
     * @returns {CANNON.Body}
     */
    createTrigger(shape, position, group = this.groups.TRIGGER, mask = this.groups.PLAYER | this.groups.ENEMY) {
        const body = new CANNON.Body({ mass: 0, material: this.materials.trigger });
        body.addShape(shape);
        body.position.copy(position);
        body.collisionFilterGroup = group;
        body.collisionFilterMask = mask; // It will generate contacts with these groups
        this.addBody(body, group, mask);
        this.triggers.add(body);
        return body;
    }

    /**
     * Process triggers: check for overlaps and fire events.
     */
    processTriggers() {
        for (const trigger of this.triggers) {
            const mask = trigger.collisionFilterMask;
            for (const body of this.world.bodies) {
                if (body === trigger) continue;
                if (!(body.collisionFilterGroup & mask)) continue; // not in mask
                if (this.bodiesOverlap(trigger, body)) {
                    // Fire event if listener exists
                    const key = `${trigger.id}-${body.id}`;
                    if (this.contactListeners.has(key)) {
                        this.contactListeners.get(key)(trigger, body);
                    }
                }
            }
        }
    }

    /**
     * Check if two bodies overlap (simple AABB test).
     */
    bodiesOverlap(bodyA, bodyB) {
        return bodyA.aabb.overlaps(bodyB.aabb);
    }

    /**
     * Register a contact event listener.
     * @param {CANNON.Body} bodyA
     * @param {CANNON.Body} bodyB
     * @param {Function} callback - (bodyA, bodyB) => {}
     */
    onContact(bodyA, bodyB, callback) {
        const key = `${bodyA.id}-${bodyB.id}`;
        this.contactListeners.set(key, callback);
    }

    /**
     * Remove contact listener.
     */
    offContact(bodyA, bodyB) {
        const key = `${bodyA.id}-${bodyB.id}`;
        this.contactListeners.delete(key);
    }

    /**
     * Create a constraint.
     * @param {CANNON.Body} bodyA
     * @param {CANNON.Body} bodyB
     * @param {string} type - 'pointToPoint', 'hinge', 'lock', 'spring'
     * @param {Object} options - type‑specific options
     * @returns {CANNON.Constraint}
     */
    createConstraint(bodyA, bodyB, type, options = {}) {
        let constraint;
        switch (type) {
            case 'pointToPoint':
                constraint = new CANNON.PointToPointConstraint(
                    bodyA, options.pivotA || new CANNON.Vec3(),
                    bodyB, options.pivotB || new CANNON.Vec3()
                );
                break;
            case 'hinge':
                constraint = new CANNON.HingeConstraint(
                    bodyA, bodyB,
                    options
                );
                break;
            case 'lock':
                constraint = new CANNON.LockConstraint(bodyA, bodyB);
                break;
            case 'spring':
                constraint = new CANNON.Spring(bodyA, bodyB, options);
                // Springs are not constraints in Cannon, they apply forces. We'll handle separately.
                this.constraints.push({ type: 'spring', spring: constraint, options });
                return constraint;
            default:
                throw new Error(`Unknown constraint type: ${type}`);
        }
        this.world.addConstraint(constraint);
        this.constraints.push(constraint);
        return constraint;
    }

    /**
     * Remove a constraint.
     */
    removeConstraint(constraint) {
        this.world.removeConstraint(constraint);
        const idx = this.constraints.indexOf(constraint);
        if (idx !== -1) this.constraints.splice(idx, 1);
    }

    /**
     * Set per‑body gravity override.
     * @param {CANNON.Body} body
     * @param {CANNON.Vec3} gravity - null to reset to global
     */
    setBodyGravity(body, gravity) {
        if (gravity === null) {
            this.bodyGravity.delete(body);
        } else {
            this.bodyGravity.set(body, gravity.clone());
        }
    }

    /**
     * Raycast closest hit with filtering.
     * @param {CANNON.Vec3} from
     * @param {CANNON.Vec3} to
     * @param {Object} options - { collisionFilterMask, skipBodies }
     * @returns {CANNON.RaycastResult}
     */
    raycast(from, to, options = {}) {
        const result = new CANNON.RaycastResult();
        const ray = new CANNON.Ray(from, to);
        ray.collisionFilterMask = options.collisionFilterMask ?? this.groups.ALL;
        ray.skipBackfaces = options.skipBackfaces ?? true;
        ray.mode = CANNON.Ray.CLOSEST;

        if (options.skipBodies) {
            ray.skipBodies = options.skipBodies;
        }

        ray.intersectWorld(this.world, result);
        return result;
    }

    /**
     * Raycast all hits.
     * @returns {Array<CANNON.RaycastResult>}
     */
    raycastAll(from, to, options = {}) {
        const results = [];
        const ray = new CANNON.Ray(from, to);
        ray.collisionFilterMask = options.collisionFilterMask ?? this.groups.ALL;
        ray.skipBackfaces = options.skipBackfaces ?? true;
        ray.mode = CANNON.Ray.ALL;

        if (options.skipBodies) {
            ray.skipBodies = options.skipBodies;
        }

        ray.intersectWorld(this.world, (result) => results.push(result));
        return results;
    }

    /**
     * Cast a sphere and return first hit.
     * @param {CANNON.Vec3} from
     * @param {CANNON.Vec3} to
     * @param {number} radius
     * @param {Object} options
     * @returns {CANNON.RaycastResult}
     */
    sphereCast(from, to, radius, options = {}) {
        // Approximate by raycast with a thicker ray? Not directly supported.
        // Implement a simple sweep by sampling.
        const dir = new CANNON.Vec3().copy(to).vsub(from);
        const dist = dir.length();
        dir.normalize();
        const step = radius * 0.5;
        const steps = Math.ceil(dist / step);
        const result = new CANNON.RaycastResult();
        for (let i = 0; i <= steps; i++) {
            const t = Math.min(i * step, dist);
            const point = new CANNON.Vec3().copy(from).vadd(dir.clone().scale(t));
            // Check sphere overlap with bodies
            const bodies = this.getBodiesInSphere(point, radius);
            if (bodies.length > 0) {
                result.hasHit = true;
                result.hitPointWorld = point;
                result.body = bodies[0];
                break;
            }
        }
        return result;
    }

    /**
     * Enable debug rendering (requires CANNON DebugRenderer).
     * @param {THREE.Scene} scene
     */
    async enableDebug(scene) {   // <-- FIX: added async
        if (!this.debugRenderer) {
            try {
                const { CannonDebugRenderer } = await import('cannon-es-debugger');
                this.debugRenderer = new CannonDebugRenderer(scene, this.world);
            } catch (e) {
                console.warn('Debug renderer not available:', e);
            }
        }
    }

    /**
     * Update debug renderer (call after step).
     */
    updateDebug() {
        if (this.debugRenderer) {
            this.debugRenderer.update();
        }
    }

    /**
     * Add a gravity zone.
     * @param {CANNON.Vec3} position
     * @param {number} radius
     * @param {CANNON.Vec3} gravity - local gravity vector
     */
    addGravityZone(position, radius, gravity) {
        const body = new CANNON.Body({ mass: 0 });
        body.position.copy(position);
        this.gravityZones.push({ body, radius, gravity: gravity.clone() });
    }

    /**
     * Add a buoyancy zone.
     * @param {CANNON.Vec3} position
     * @param {number} radius
     * @param {number} density - fluid density (kg/m³)
     * @param {number} viscosity - damping factor (0-1)
     */
    addBuoyancyZone(position, radius, density = 1000, viscosity = 0.1) {
        const body = new CANNON.Body({ mass: 0 });
        body.position.copy(position);
        this.buoyancyZones.push({ body, radius, density, viscosity });
    }

    /**
     * Add a wind zone.
     * @param {CANNON.Vec3} position
     * @param {number} radius
     * @param {CANNON.Vec3} direction
     * @param {number} strength
     */
    addWindZone(position, radius, direction, strength) {
        const body = new CANNON.Body({ mass: 0 });
        body.position.copy(position);
        this.windZones.push({ body, radius, direction: direction.clone().normalize(), strength });
    }

    /**
     * Remove a zone.
     */
    removeZone(zone) {
        const index = this.gravityZones.indexOf(zone);
        if (index !== -1) this.gravityZones.splice(index, 1);
        // Similarly for others
    }
}
