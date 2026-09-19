export const BOUNDS = Object.freeze({ x: 8.55, z: 6.55 });
const TAU = Math.PI * 2;

export function roundedRoute({ x = 0, z = 0, width, depth, radius }) {
  const w = width / 2;
  const d = depth / 2;
  const r = Math.max(.01, Math.min(radius, w, d));
  const sx = 2 * (w - r);
  const sz = 2 * (d - r);
  const arc = Math.PI * r / 2;
  const lengths = [sx, arc, sz, arc, sx, arc, sz, arc];
  const length = lengths.reduce((a, b) => a + b, 0);
  const route = { length, x, z, width, depth, radius: r };
  route.sample = (distance, out = {}) => {
    let p = ((distance % length) + length) % length;
    let segment = 0;
    while (segment < 7 && p > lengths[segment]) p -= lengths[segment++];
    let a;
    switch (segment) {
      case 0: out.x = -w + r + p; out.z = d; out.tx = 1; out.tz = 0; break;
      case 1:
        a = Math.PI / 2 - p / r;
        out.x = w - r + Math.cos(a) * r; out.z = d - r + Math.sin(a) * r; out.tx = Math.sin(a); out.tz = -Math.cos(a); break;
      case 2: out.x = w; out.z = d - r - p; out.tx = 0; out.tz = -1; break;
      case 3:
        a = -p / r;
        out.x = w - r + Math.cos(a) * r; out.z = -d + r + Math.sin(a) * r; out.tx = Math.sin(a); out.tz = -Math.cos(a); break;
      case 4: out.x = w - r - p; out.z = -d; out.tx = -1; out.tz = 0; break;
      case 5:
        a = -Math.PI / 2 - p / r;
        out.x = -w + r + Math.cos(a) * r; out.z = -d + r + Math.sin(a) * r; out.tx = Math.sin(a); out.tz = -Math.cos(a); break;
      case 6: out.x = -w; out.z = -d + r + p; out.tx = 0; out.tz = 1; break;
      default:
        a = Math.PI - p / r;
        out.x = -w + r + Math.cos(a) * r; out.z = d - r + Math.sin(a) * r; out.tx = Math.sin(a); out.tz = -Math.cos(a);
    }
    out.x += x;
    out.z += z;
    out.yaw = -Math.atan2(out.tz, out.tx);
    return out;
  };
  return route;
}

export function collider(id, x, z, halfX, halfZ, yaw = 0, clearance = 0) {
  return { id, x, z, halfX, halfZ, yaw, clearance };
}

export function insideBounds(body, bounds = BOUNDS) {
  const c = Math.abs(Math.cos(body.yaw));
  const s = Math.abs(Math.sin(body.yaw));
  const extentX = c * body.halfX + s * body.halfZ;
  const extentZ = s * body.halfX + c * body.halfZ;
  return Math.abs(body.x) + extentX <= bounds.x && Math.abs(body.z) + extentZ <= bounds.z;
}

// Separating-axis test for the complete oriented footprint, not just an object's center.
export function overlaps(a, b, gap = 0.07) {
  const ac = Math.cos(a.yaw), as = -Math.sin(a.yaw);
  const bc = Math.cos(b.yaw), bs = -Math.sin(b.yaw);
  const dx = b.x - a.x, dz = b.z - a.z;
  const clearance = gap + (a.clearance || 0) + (b.clearance || 0);
  const testAxis = (ax, az) => {
    const aRadius = a.halfX * Math.abs(ac * ax + as * az) + a.halfZ * Math.abs(-as * ax + ac * az);
    const bRadius = b.halfX * Math.abs(bc * ax + bs * az) + b.halfZ * Math.abs(-bs * ax + bc * az);
    return Math.abs(dx * ax + dz * az) < aRadius + bRadius + clearance;
  };
  return testAxis(ac, as) && testAxis(-as, ac) && testAxis(bc, bs) && testAxis(-bs, bc);
}

export class TrafficSystem {
  constructor() {
    this.actors = [];
    this.obstacles = [[], [], [], []];
    this.time = 0;
    this.rejectedMoves = 0;
  }

  addObstacle(level, body) {
    this.obstacles[level].push(body);
    return body;
  }

  addActor(config) {
    const actor = {
      distance: 0, speed: 0, travelled: 0, stopped: false, route: null,
      halfX: .32, halfZ: .32, yaw: 0, x: 0, z: 0, candidate: {}, ...config,
    };
    if (actor.route) Object.assign(actor, actor.route.sample(actor.distance));
    this.actors.push(actor);
    return actor;
  }

  canOccupy(actor, pose) {
    if (!insideBounds(pose)) return false;
    for (const obstacle of this.obstacles[actor.level]) {
      if (overlaps(pose, obstacle)) return false;
    }
    for (const other of this.actors) {
      if (other !== actor && other.level === actor.level && overlaps(pose, other, actor.kind === 'vehicle' ? .16 : .09)) return false;
    }
    return true;
  }

  step(dt) {
    // A bounded integration step prevents tunnelling even after stalls, low frame rates, or speed changes.
    const count = Math.max(1, Math.ceil(dt / (1 / 40)));
    const step = dt / count;
    for (let i = 0; i < count; i++) {
      this.time += step;
      for (const actor of this.actors) {
        if (!actor.route || actor.speed === 0) continue;
        const nextDistance = actor.distance + actor.speed * step;
        const pose = actor.route.sample(nextDistance, actor.candidate);
        pose.halfX = actor.halfX;
        pose.halfZ = actor.halfZ;
        if (this.canOccupy(actor, pose)) {
          actor.distance = nextDistance % actor.route.length;
          actor.travelled += actor.speed * step;
          actor.x = pose.x;
          actor.z = pose.z;
          actor.yaw = pose.yaw;
          actor.stopped = false;
        } else {
          actor.stopped = true;
          this.rejectedMoves++;
        }
      }
    }
  }

  validate() {
    const issues = [];
    for (const actor of this.actors) {
      if (!insideBounds(actor)) issues.push(`${actor.id}: outside sandbox`);
      for (const obstacle of this.obstacles[actor.level]) {
        if (overlaps(actor, obstacle, 0)) issues.push(`${actor.id}: intersects ${obstacle.id}`);
      }
      for (const other of this.actors) {
        if (other !== actor && other.level === actor.level && actor.id < other.id && overlaps(actor, other, 0)) issues.push(`${actor.id}: intersects ${other.id}`);
      }
    }
    return issues;
  }

  auditRoutes(samples = 720) {
    const issues = [];
    const pose = {};
    for (const actor of this.actors) {
      if (!actor.route) continue;
      for (let i = 0; i < samples; i++) {
        actor.route.sample(actor.route.length * i / samples, pose);
        pose.halfX = actor.halfX;
        pose.halfZ = actor.halfZ;
        if (!insideBounds(pose)) { issues.push(`${actor.id}: route leaves sandbox at ${i}/${samples}`); break; }
        const obstacle = this.obstacles[actor.level].find(body => overlaps(pose, body));
        if (obstacle) { issues.push(`${actor.id}: route touches ${obstacle.id} at ${i}/${samples}`); break; }
        const parked = this.actors.find(body => body !== actor && body.level === actor.level && !body.route && overlaps(pose, body));
        if (parked) { issues.push(`${actor.id}: route touches parked ${parked.id} at ${i}/${samples}`); break; }
      }
    }
    return issues;
  }
}

// Fixed-capacity particle storage, with recycling in place and no per-frame allocations.
export class PollenPool {
  constructor(capacity, random) {
    this.capacity = capacity;
    this.random = random;
    this.positions = new Float32Array(capacity * 3);
    this.life = new Float32Array(capacity);
    this.maxLife = new Float32Array(capacity);
    this.velocity = new Float32Array(capacity * 3);
    this.active = capacity;
    for (let i = 0; i < capacity; i++) this.recycle(i, true);
  }

  recycle(i, initial = false) {
    const p = i * 3;
    this.positions[p] = (this.random() - .5) * 12.5;
    this.positions[p + 1] = .8 + this.random() * (initial ? 3.1 : .9);
    this.positions[p + 2] = -2.5 + this.random() * 3.5;
    this.life[i] = 0;
    this.maxLife[i] = 7 + this.random() * 10;
    this.velocity[p] = (this.random() - .5) * .13;
    this.velocity[p + 1] = .06 + this.random() * .08;
    this.velocity[p + 2] = (this.random() - .5) * .1;
  }

  step(dt) {
    for (let i = 0; i < this.active; i++) {
      const p = i * 3;
      this.life[i] += dt;
      this.positions[p] += this.velocity[p] * dt;
      this.positions[p + 1] += this.velocity[p + 1] * dt;
      this.positions[p + 2] += this.velocity[p + 2] * dt;
      if (this.life[i] > this.maxLife[i] || Math.abs(this.positions[p]) > 7.9 || Math.abs(this.positions[p + 2]) > 5.9 || this.positions[p + 1] > 4.7) this.recycle(i);
    }
  }
}

export function wrapAngle(angle) {
  return ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
}
