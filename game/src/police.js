// The wanted system: heat from crimes becomes stars, stars summon the
// Solmar PD — foot officers at first, then interceptor cars that ram and
// box the player in. Lay low out of sight and the heat fades.
import { POLICE_MODEL, WANTED, WORLD } from './config.js';
import { angleTo, clamp, dist, pick, range, turnToward } from './random.js';
import { createCar, makePoliceCar, spawnSparks } from './vehicles.js';

export function addHeat(state, amount) {
  state.heat = Math.min(240, state.heat + amount);
  state.crimeTimer = 0;
}

export function wantedStars(state) {
  let stars = 0;
  for (let i = 0; i < WANTED.thresholds.length; i += 1) {
    if (state.heat >= WANTED.thresholds[i]) stars = i;
  }
  return Math.min(stars, WANTED.maxStars);
}

function spawnPointNear(state, minD, maxD) {
  // A road point at a distance from the player, so the law arrives from off-screen.
  for (let tries = 0; tries < 12; tries += 1) {
    const x = state.rng() * WORLD.width;
    const y = state.rng() * WORLD.height;
    const d = dist(x, y, state.player.x, state.player.y);
    if (d >= minD && d <= maxD && state.city.isOnRoad(x, y)) return { x, y };
  }
  return { x: clamp(state.player.x + 500, 80, WORLD.width - 80), y: clamp(state.player.y - 420, 80, WORLD.height - 80) };
}

export function updatePolice(state, dt) {
  const stars = wantedStars(state);
  state.wanted = stars;

  // Heat fades once the player has been out of trouble for a while.
  state.crimeTimer += dt;
  let nearestCop = Infinity;
  for (const cop of state.cops) nearestCop = Math.min(nearestCop, dist(cop.x, cop.y, state.player.x, state.player.y));
  for (const car of state.cars) {
    if (car.kind === 'police') nearestCop = Math.min(nearestCop, dist(car.x, car.y, state.player.x, state.player.y));
  }
  if (state.crimeTimer > WANTED.decayDelay && nearestCop > 620) {
    state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
  }

  // Keep the response proportional to the stars.
  const wantFoot = stars >= 1 ? Math.min(4, stars) : 0;
  const wantCars = stars >= 2 ? Math.min(3, stars - 1) : 0;
  state.copSpawnT -= dt;
  if (state.copSpawnT <= 0) {
    state.copSpawnT = 1.2;
    if (state.cops.length < wantFoot) {
      const at = spawnPointNear(state, 420, 760);
      state.cops.push({
        x: at.x, y: at.y, angle: 0, speed: 0, health: 3,
        arrestT: 0, shootCd: 0, dead: false, deadT: 0, walkPhase: 0,
      });
    }
    const policeCars = state.cars.filter((c) => c.kind === 'police' && !c.dead).length;
    if (policeCars < wantCars) {
      const at = spawnPointNear(state, 520, 900);
      const car = makePoliceCar(state, at.x, at.y);
      state.cars.push(car);
      if (state.audio) state.audio.sirenStart();
    }
  }
  if (stars === 0 && state.cars.some((c) => c.kind === 'police')) {
    // Stood down: the interceptors peel off and despawn once far away.
    if (state.audio) state.audio.sirenStop();
  }

  updateFootCops(state, dt);
  updatePoliceCars(state, dt);
}

function updateFootCops(state, dt) {
  const p = state.player;
  for (let i = state.cops.length - 1; i >= 0; i -= 1) {
    const cop = state.cops[i];
    if (cop.dead) {
      cop.deadT += dt;
      if (cop.deadT > 12) state.cops.splice(i, 1);
      continue;
    }
    const d = dist(cop.x, cop.y, p.x, p.y);
    cop.walkPhase += dt * 9;
    if (state.wanted === 0) {
      // No heat: the officer strolls off and leaves.
      cop.angle = turnToward(cop.angle, angleTo(cop.x, cop.y, cop.x + 400, cop.y - 300), 4 * dt);
      cop.x += Math.cos(cop.angle) * 60 * dt;
      cop.y += Math.sin(cop.angle) * 60 * dt;
      if (d > 900) state.cops.splice(i, 1);
      continue;
    }
    const want = angleTo(cop.x, cop.y, p.x, p.y);
    cop.angle = turnToward(cop.angle, want, 6 * dt);
    const speed = p.onFoot ? 235 : 150;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    state.city.resolveCircle(cop, 14);
    if (p.onFoot && d < 34) {
      cop.arrestT += dt;
      if (cop.arrestT > 0.9) {
        state.busted = true;
        state.events |= 2; // EVENT_BUSTED
        return;
      }
    } else {
      cop.arrestT = Math.max(0, cop.arrestT - dt * 2);
    }
    // A cornered officer at 3+ stars takes a shot at a fleeing car.
    if (!p.onFoot && state.wanted >= 3 && d < 300) {
      cop.shootCd -= dt;
      if (cop.shootCd <= 0) {
        cop.shootCd = 1.4;
        state.bullets.push({
          x: cop.x, y: cop.y,
          vx: Math.cos(want) * 620, vy: Math.sin(want) * 620,
          life: 1.1, from: 'cop',
        });
        state.audio.gunshot();
      }
    }
  }
}


function updatePoliceCars(state, dt) {
  const p = state.player;
  for (let i = state.cars.length - 1; i >= 0; i -= 1) {
    const car = state.cars[i];
    if (car.kind !== 'police' || car.dead) continue;
    if (state.wanted === 0) {
      // Stood down: cruise away and despawn once far from the player.
      car.speed = Math.max(0, car.speed - 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      if (dist(car.x, car.y, p.x, p.y) > 1000) state.cars.splice(i, 1);
      continue;
    }
    const d = dist(car.x, car.y, p.x, p.y);
    const want = angleTo(car.x, car.y, p.x, p.y);
    // Steer toward the player, faster the further away they are.
    const turn = clamp(d / 300, 0.4, 1) * 3.1;
    car.angle = turnToward(car.angle, want, turn * dt);
    const target = d > 260 ? car.model.top : 300;
    car.speed += clamp(target - car.speed, -520 * dt, 460 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const hitWall = state.city.resolveCircle(car, 26);
    if (hitWall) car.speed *= 0.6;
    // Ram the player's car: a solid hit slows them and hurts.
    if (p.car && d < 62) {
      if (car.crashCooldown <= 0) {
        car.crashCooldown = 0.9;
        p.car.speed *= 0.55;
        p.health = Math.max(0, p.health - 4);
        state.events |= 16;
        state.audio.crash();
        spawnSparks(state, (car.x + p.x) / 2, (car.y + p.y) / 2, 8);
      }
    }
    if (car.crashCooldown > 0) car.crashCooldown -= dt;
    // On foot, a patrol car that catches up ends the chase on the spot.
    if (p.onFoot && d < 40) {
      state.busted = true;
      state.events |= 2; // EVENT_BUSTED
      return;
    }
  }
}
