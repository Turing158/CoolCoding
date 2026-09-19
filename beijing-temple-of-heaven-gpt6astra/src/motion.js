import { Vector3 } from 'three';

export function smoothStep(value) {
  const x = Math.max(0, Math.min(1, value));
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function layerProgress(progress, delay) {
  return smoothStep((progress - delay) / (1 - delay));
}

/** Immutable origins are the source of every pose, including an exact reassembly. */
export class Exploder {
  constructor() {
    this.progress = 0;
    this.target = 0;
    this.duration = 4.2;
    this.channels = [];
  }

  registerObject(object, offset, delay = 0) {
    this.channels.push({ kind: 'object', object, base: object.position.clone(), offset: new Vector3(...offset), delay });
  }

  registerInstances(mesh, offsets, delay = 0) {
    this.channels.push({ kind: 'instances', mesh, base: mesh.instanceMatrix.array.slice(), offsets, delay });
    // Exploded instances can travel beyond their assembled bounding volume.
    mesh.frustumCulled = false;
  }

  setTarget(target) {
    this.target = target ? 1 : 0;
  }

  get active() {
    return this.progress !== this.target;
  }

  update(dt) {
    if (!this.active) return false;
    const change = Math.max(0, dt) / this.duration;
    this.progress = this.target > this.progress
      ? Math.min(this.target, this.progress + change)
      : Math.max(this.target, this.progress - change);
    this.apply();
    return true;
  }

  apply() {
    for (const channel of this.channels) {
      const amount = layerProgress(this.progress, channel.delay);
      if (channel.kind === 'object') {
        channel.object.position.copy(channel.base).addScaledVector(channel.offset, amount);
      } else {
        const { mesh, base, offsets } = channel;
        const matrix = mesh.instanceMatrix.array;
        for (let i = 0; i < mesh.count; i++) {
          const m = i * 16 + 12;
          const v = i * 3;
          matrix[m] = base[m] + offsets[v] * amount;
          matrix[m + 1] = base[m + 1] + offsets[v + 1] * amount;
          matrix[m + 2] = base[m + 2] + offsets[v + 2] * amount;
        }
        mesh.instanceMatrix.needsUpdate = true;
      }
    }
  }
}

/** Sleeps completely at rest, and never polls at 60 Hz just to discard frames. */
export class FrameScheduler {
  constructor({ fps = 30, test = false, frames = 12, render, onPause = () => {} }) {
    this.fps = fps;
    this.test = test;
    this.remaining = test ? frames : Infinity;
    this.render = render;
    this.onPause = onPause;
    this.frameCount = 0;
    this.batchCount = 0;
    this.batchLimit = frames;
    this.timer = null;
    this.raf = null;
    this.lastTime = 0;
    this.suspended = false;
    this.inFrame = false;
    this.dirty = false;
  }

  invalidate() {
    this.dirty = true;
    if (this.inFrame || this.suspended || this.remaining <= 0 || this.timer !== null || this.raf !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.raf = requestAnimationFrame((time) => this.tick(time));
    }, Math.max(0, 1000 / this.fps - (performance.now() - this.lastTime)));
  }

  tick(time) {
    this.raf = null;
    if (this.suspended || this.remaining <= 0) return;
    const dt = this.lastTime ? Math.min((time - this.lastTime) / 1000, Math.max(.25, 1 / this.fps)) : 1 / this.fps;
    this.lastTime = time;
    this.inFrame = true;
    this.dirty = false;
    this.frameCount++;
    this.batchCount++;
    if (this.test) this.remaining--;
    const moving = this.render(dt);
    this.inFrame = false;
    if (this.remaining <= 0) {
      this.lastTime = 0;
      this.onPause();
      return;
    }
    if (moving || this.dirty || this.test) this.invalidate();
    else this.lastTime = 0;
  }

  interact() {
    if (this.test && this.remaining <= 0) this.arm(1);
    else this.invalidate();
  }

  arm(frames) {
    this.remaining = this.test ? Math.max(1, Math.min(240, Math.round(frames))) : Infinity;
    this.batchLimit = this.remaining;
    this.batchCount = 0;
    this.lastTime = 0;
    this.invalidate();
  }

  suspend() {
    this.suspended = true;
    clearTimeout(this.timer);
    cancelAnimationFrame(this.raf);
    this.timer = null;
    this.raf = null;
    this.lastTime = 0;
  }

  resume() {
    this.suspended = false;
    this.invalidate();
  }
}
