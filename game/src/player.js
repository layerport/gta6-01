// Dario Reyes on foot and behind the wheel: walking with the mouse as the
// aim, getting in and out of cars, and stealing them off the street.
import { PLAYER, WANTED, WORLD } from './config.js';
import { angleTo, clamp, dist } from './random.js';
import { addHeat } from './police.js';
import { drivePlayerCar } from './vehicles.js';

function nearestCar(state, maxD) {
  let best = null;
  let bestD = maxD;
  for (const car of state.cars) {
    if (car.dead || car.kind === 'player') continue;
    const d = dist(state.player.x, state.player.y, car.x, car.y);
    if (d < bestD) { best = car; bestD = d; }
  }
  return best;
}

function enterCar(state, car) {
  const p = state.player;
  if (car.kind === 'traffic') {
    // Yank the driver out onto the sidewalk and take their car.
    const driver = {
      x: car.x + 40, y: car.y + 40, angle: 0, speed: 60,
      shirt: '#e8e8e8', pants: '#2b2f38', state: 'flee',
      tx: car.x + 200, ty: car.y + 200, fleeX: car.x + 260, fleeY: car.y + 260,
      walkPhase: 0, dead: false, deadT: 0, panic: 2,
    };
    state.peds.push(driver);
    addHeat(state, WANTED.stealHeat);
    state.message = { text: 'Car stolen! The PD is on to you.', t: 3 };
    state.stats.carsStolen += 1;
  } else if (car.kind === 'parked') {
    addHeat(state, Math.floor(WANTED.stealHeat / 2));
    state.stats.carsStolen += 1;
  }
  car.kind = 'player';
  car.driver = false;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  p.angle = car.angle;
  p.speed = 0;
  state.audio.engineStart();
  state.audio.click();
}

function exitCar(state) {
  const p = state.player;
  const car = p.car;
  if (!car) return;
  car.kind = 'parked';
  car.speed = 0;
  // Step out to the driver's side.
  const side = p.angle + Math.PI / 2;
  p.x = car.x + Math.cos(side) * 34;
  p.y = car.y + Math.sin(side) * 34;
  p.onFoot = true;
  p.car = null;
  p.speed = 0;
  state.city.resolveCircle(p, PLAYER.radius);
  state.audio.engineStop();
  state.audio.engineSet(0, false);
}

export function updatePlayer(state, input, dt) {
  const p = state.player;
  if (p.fireCooldown > 0) p.fireCooldown -= dt;
  if (p.meleeCooldown > 0) p.meleeCooldown -= dt;

  // E: get in the nearest car, or step out of the one you are driving.
  if (input._interact) {
    if (p.onFoot) {
      const car = nearestCar(state, 78);
      if (car) enterCar(state, car);
    } else {
      exitCar(state);
    }
  }

  if (!p.onFoot) {
    drivePlayerCar(state, input, dt);
    return;
  }

  // On foot: WASD moves, the mouse aims.
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const nx = axis.x / len;
  const ny = axis.y / len;
  const moving = axis.x !== 0 || axis.y !== 0;
  if (moving) {
    p.vx += nx * PLAYER.accel * dt;
    p.vy += ny * PLAYER.accel * dt;
  } else {
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > 0) {
      const drop = Math.min(speed, PLAYER.friction * dt);
      p.vx -= (p.vx / speed) * drop;
      p.vy -= (p.vy / speed) * drop;
    }
  }
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > PLAYER.walkSpeed) {
    p.vx = (p.vx / speed) * PLAYER.walkSpeed;
    p.vy = (p.vy / speed) * PLAYER.walkSpeed;
  }
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.x = clamp(p.x, 24, WORLD.width - 24);
  p.y = clamp(p.y, 24, WORLD.height - 24);
  state.city.resolveCircle(p, PLAYER.radius);
  p.walkPhase = (p.walkPhase || 0) + dt * (speed > 20 ? 10 : 0);
  // Aim at the mouse; face the way you walk when the mouse has not moved.
  if (input.mouse.moved) {
    p.angle = angleTo(p.x, p.y, state.mouseWorldX, state.mouseWorldY);
  } else if (moving) {
    p.angle = Math.atan2(p.vy, p.vx);
  }
  // Slow health regen while the law is not looking.
  if (state.wanted === 0 && p.health > 0 && p.health < PLAYER.health) {
    p.health = Math.min(PLAYER.health, p.health + PLAYER.regenPerSec * dt);
  }
}
