import assert from 'node:assert/strict';
import { createTown } from '../src/scene.js';
import { PollenPool } from '../src/motion.js';
import { seededRandom } from '../src/kit.js';

const town = createTown();
const traffic = town.traffic;
const initialIssues = traffic.validate();
const routeIssues = traffic.auditRoutes(1600);
assert.deepEqual(initialIssues, [], `Initial placement:\n${initialIssues.join('\n')}`);
assert.deepEqual(routeIssues, [], `Route clearance:\n${routeIssues.join('\n')}`);
const movers = traffic.actors.filter(actor => actor.route);
const travelled = new Map(movers.map(actor => [actor.id, actor.travelled]));
// Ten simulated minutes with uneven frame timing; no WebGL or continuous browser rendering.
for (let frame = 0; frame < 18000; frame++) {
  traffic.step(frame % 120 === 0 ? .15 : 1 / 30);
  if (frame % 90 === 0) assert.deepEqual(traffic.validate(), [], `Collision at simulation frame ${frame}`);
}
for (const actor of movers) {
  const distance = actor.travelled - travelled.get(actor.id);
  assert.ok(distance > actor.route.length * 2, `${actor.id} stalled instead of completing its route (${distance.toFixed(2)})`);
}
const pool = new PollenPool(72, seededRandom(31));
const storage = pool.positions;
for (let frame = 0; frame < 6000; frame++) pool.step(.1);
assert.equal(pool.positions, storage, 'Particle pool must reuse its original storage');
for (let i = 0; i < pool.capacity; i++) {
  assert.ok(Math.abs(storage[i * 3]) <= 7.9 && Math.abs(storage[i * 3 + 2]) <= 5.9);
  assert.ok(storage[i * 3 + 1] >= 0 && storage[i * 3 + 1] <= 4.7);
}
console.log(JSON.stringify({
  parts: town.partCount, actors: traffic.actors.length, movers: movers.length,
  routeSamples: movers.length * 1600, simulatedSeconds: Math.round(traffic.time),
  rejectedMoves: traffic.rejectedMoves, collisionIssues: traffic.validate(),
  particleCapacity: pool.capacity, result: 'PASS',
}, null, 2));
