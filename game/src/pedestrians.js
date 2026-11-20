// Pedestrians: Solmar locals strolling the sidewalks, crossing at the
// crossings, and running for cover when a gun goes off or a car bears down.
import { PED_PANTS, PED_SHIRTS, ROAD_LINES, ROAD_WIDTH, WORLD } from './config.js';
import { angleTo, clamp, dist, pick, range, rangeInt, turnToward } from './random.js';

export function spawnPedestrians(state, count) {
  for (let i = 0; i < count; i += 1) {
    const line = pick(state.rng, ROAD_LINES);
    const along = range(state.rng, 140, WORLD.width - 140);
    const horizontal = state.rng() < 0.5;
    const side = (ROAD_WIDTH / 2 + 16) * (state.rng() < 0.5 ? -1 : 1);
    state.peds.push({
      x: horizontal ? along : line + side,
      y: horizontal ? line + side : along,
      angle: range(state.rng, 0, Math.PI * 2),
      speed: range(state.rng, 42, 78),
      shirt: pick(state.rng, PED_SHIRTS),
      pants: pick(state.rng, PED_PANTS),
      state: 'walk',
      tx: 0, ty: 0,
      fleeX: 0, fleeY: 0,
      walkPhase: range(state.rng, 0, Math.PI * 2),
      dead: false,
      deadT: 0,
      panic: 0,
    });
  }
  for (const ped of state.peds) pickStrollTarget(state, ped);
}

function pickStrollTarget(state, ped) {
  const line = pick(state.rng, ROAD_LINES);
  const along = range(state.rng, 140, WORLD.width - 140);
  const horizontal = state.rng() < 0.5;
  const side = (ROAD_WIDTH / 2 + 16) * (state.rng() < 0.5 ? -1 : 1);
  ped.tx = horizontal ? along : line + side;
  ped.ty = horizontal ? line + side : along;
}

function nearestThreat(state, ped) {
  // A gunshot, a speeding car or a police chase nearby panics a pedestrian.
  if (state.lastShotT > 0 && dist(ped.x, ped.y, state.lastShotX, state.lastShotY) < 420) {
    return { x: state.lastShotX, y: state.lastShotY };
  }
  const playerCar = state.player.car;
  if (playerCar && Math.abs(playerCar.speed) > 120 && dist(ped.x, ped.y, playerCar.x, playerCar.y) < 170) {
    return { x: playerCar.x, y: playerCar.y };
  }
  return null;
}

export function updatePedestrians(state, dt) {
  for (const ped of state.peds) {
    if (ped.dead) {
      ped.deadT += dt;
      continue;
    }
    const threat = nearestThreat(state, ped);
    if (threat) {
      ped.state = 'flee';
      ped.panic = 1.6;
      const away = angleTo(threat.x, threat.y, ped.x, ped.y);
      ped.fleeX = ped.x + Math.cos(away) * 260;
      ped.fleeY = ped.y + Math.sin(away) * 260;
    } else if (ped.panic > 0) {
      ped.panic -= dt;
      if (ped.panic <= 0) ped.state = 'walk';
    }
    ped.walkPhase += dt * (ped.state === 'flee' ? 11 : 6);
    let tx = ped.tx;
    let ty = ped.ty;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      tx = ped.fleeX;
      ty = ped.fleeY;
      speed = ped.speed * 2.6;
    }
    const d = dist(ped.x, ped.y, tx, ty);
    if (d < 24) {
      if (ped.state === 'flee') { ped.state = 'walk'; pickStrollTarget(state, ped); }
      else pickStrollTarget(state, ped);
      continue;
    }
    const want = angleTo(ped.x, ped.y, tx, ty);
    ped.angle = turnToward(ped.angle, want, 5 * dt);
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    ped.x = clamp(ped.x, 40, WORLD.width - 40);
    ped.y = clamp(ped.y, 40, WORLD.height - 40);
    // Sidewalk walkers never walk through a building: nudge them back out.
    state.city.resolveCircle(ped, 12);
  }
  // The dead fade out after a while and a fresh local wanders in.
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    if (state.peds[i].dead && state.peds[i].deadT > 14) state.peds.splice(i, 1);
  }
  while (state.peds.length < state.pedTarget) {
    const before = state.peds.length;
    spawnPedestrians(state, 1);
    if (state.peds.length === before) break;
  }
}
