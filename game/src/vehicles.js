// Cars: definitions, traffic that follows the avenue grid, parked cars to
// steal, and the player's own driving physics (arcade steering, drift and
// skid marks, crashes that spark and slow you down).
import { CAR, CAR_MODELS, POLICE_MODEL, ROAD_LINES, ROAD_WIDTH, WORLD } from './config.js';
import { angleTo, clamp, dist, pick, range, rangeInt, turnToward } from './random.js';

let nextCarId = 1;

export function createCar(x, y, angle, model, kind) {
  return {
    id: nextCarId,
    x, y, angle,
    speed: 0,
    model,
    color: model.color,
    kind: kind || 'traffic', // traffic | parked | police | player
    axis: 'x',
    dir: 1,
    lane: 24,
    road: ROAD_LINES[0],
    targetSpeed: 0,
    driver: kind === 'traffic',
    siren: false,
    steer: 0,
    crashCooldown: 0,
    dead: false,
  };
}

function randomRoadPoint(rng) {
  const line = pick(rng, ROAD_LINES);
  const along = range(rng, 120, WORLD.width - 120);
  return { line, along };
}

export function spawnParkedCars(state, count) {
  for (let i = 0; i < count; i += 1) {
    const { line, along } = randomRoadPoint(state.rng);
    const horizontal = state.rng() < 0.5;
    const edge = (ROAD_WIDTH / 2 - 12) * (state.rng() < 0.5 ? -1 : 1);
    const x = horizontal ? along : line + edge;
    const y = horizontal ? line + edge : along;
    const angle = horizontal ? (state.rng() < 0.5 ? 0 : Math.PI) : (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    const car = createCar(x, y, angle, pick(state.rng, CAR_MODELS), 'parked');
    car.road = line;
    state.cars.push(car);
  }
}

export function spawnTraffic(state, count) {
  for (let i = 0; i < count; i += 1) {
    const { line, along } = randomRoadPoint(state.rng);
    const horizontal = state.rng() < 0.5;
    const car = createCar(
      horizontal ? along : line,
      horizontal ? line : along,
      0,
      pick(state.rng, CAR_MODELS),
      'traffic',
    );
    car.axis = horizontal ? 'x' : 'y';
    car.dir = state.rng() < 0.5 ? 1 : -1;
    car.lane = (state.rng() < 0.5 ? -1 : 1) * 22;
    car.road = line;
    car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    car.targetSpeed = range(state.rng, 110, 190);
    car.speed = car.targetSpeed;
    state.cars.push(car);
  }
}

function carAhead(state, car, lookAhead) {
  let nearest = null;
  let nearestD = lookAhead;
  for (const other of state.cars) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const forward = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (forward > 0 && forward < nearestD && side < 30) {
      nearest = other;
      nearestD = forward;
    }
  }
  return nearest;
}

function maybeTurn(state, car, dt) {
  // At an intersection, sometimes turn onto the crossing avenue.
  const nearLine = ROAD_LINES.find((line) => Math.abs((car.axis === 'x' ? car.x : car.y) - line) < 14);
  if (nearLine === undefined || state.rng() > 0.35 * dt * 60 * 0.02) return;
  const other = car.axis === 'x' ? 'y' : 'x';
  const roadValue = car.axis === 'x' ? car.y : car.x;
  const cross = ROAD_LINES.reduce((best, line) => (Math.abs(line - roadValue) < Math.abs(best - roadValue) ? line : best), ROAD_LINES[0]);
  car.axis = other;
  car.road = cross;
  car.dir = state.rng() < 0.5 ? 1 : -1;
  car.lane = (state.rng() < 0.5 ? -1 : 1) * 22;
  car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
}

/** Traffic cars cruise their avenue, slow for the car ahead, turn at crossings. */
export function updateTraffic(state, dt) {
  for (const car of state.cars) {
    if (car.kind !== 'traffic' || car.dead) continue;
    const ahead = carAhead(state, car, 120);
    let want = car.targetSpeed;
    if (ahead) want = Math.min(want, Math.max(0, ahead.speed - 20));
    // Ease off near the player on foot so peds and the player can cross.
    const p = state.player;
    if (!p.onFoot || true) {
      const d = dist(car.x, car.y, p.x, p.y);
      if (d < 70 && Math.abs(car.speed) > 40) want = Math.min(want, 40);
    }
    car.speed += clamp(want - car.speed, -260 * dt, 180 * dt);
    const step = car.speed * dt;
    if (car.axis === 'x') car.x += car.dir * step;
    else car.y += car.dir * step;
    maybeTurn(state, car, dt);
    // Keep on the road: snap the cross-axis back to the lane.
    if (car.axis === 'x') car.y += (car.road + car.lane - car.y) * Math.min(1, 4 * dt);
    else car.x += (car.road + car.lane - car.x) * Math.min(1, 4 * dt);
    if (car.x < 60 || car.x > WORLD.width - 60 || car.y < 60 || car.y > WORLD.height - 60) {
      // Drove off the map edge: recycle to a fresh avenue entry.
      const { line, along } = randomRoadPoint(state.rng);
      const horizontal = state.rng() < 0.5;
      car.axis = horizontal ? 'x' : 'y';
      car.x = horizontal ? along : line;
      car.y = horizontal ? line : along;
      car.dir = state.rng() < 0.5 ? 1 : -1;
      car.road = line;
      car.angle = car.axis === 'x' ? (car.dir > 0 ? 0 : Math.PI) : (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
    }
  }
}


/** The player's car: arcade throttle, steering that bites harder at speed, drift. */
export function drivePlayerCar(state, input, dt) {
  const car = state.player.car;
  if (!car) return;
  const model = car.model;
  const axis = input.axis();
  const forward = axis.y < 0;
  const reverse = axis.y > 0;
  const steering = -axis.x; // left key steers left (negative angle turn)

  if (forward) car.speed += model.accel * dt;
  else if (reverse) car.speed -= (car.speed > 0 ? CAR.brake : model.accel * 0.6) * dt;
  else {
    // Coast down with drag.
    car.speed -= car.speed * CAR.drag * dt;
    if (Math.abs(car.speed) < 6) car.speed = 0;
  }
  car.speed = clamp(car.speed, -CAR.reverseTop, model.top);

  const speedRatio = clamp(Math.abs(car.speed) / model.top, 0, 1);
  const turnRate = model.handling * (0.55 + 0.45 * speedRatio) * (car.speed >= 0 ? 1 : -1);
  if (Math.abs(car.speed) > 12) {
    car.angle += steering * turnRate * dt * (Math.abs(car.speed) > 200 ? 1 : 0.75);
  }
  // Drift: at high speed with hard steering the car slides and leaves marks.
  const drifting = Math.abs(steering) > 0 && Math.abs(car.speed) > 300;
  const prevX = car.x;
  const prevY = car.y;
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (drifting) {
    state.skids.push({
      x1: prevX - Math.cos(car.angle) * 20, y1: prevY - Math.sin(car.angle) * 20,
      x2: car.x - Math.cos(car.angle) * 20, y2: car.y - Math.sin(car.angle) * 20,
      t: 4,
    });
    state.skids.push({
      x1: prevX + Math.cos(car.angle) * 20, y1: prevY + Math.sin(car.angle) * 20,
      x2: car.x + Math.cos(car.angle) * 20, y2: car.y + Math.sin(car.angle) * 20,
      t: 4,
    });
    if (state.skids.length > 220) state.skids.splice(0, state.skids.length - 220);
  }
  car.x = clamp(car.x, 30, WORLD.width - 30);
  car.y = clamp(car.y, 30, WORLD.height - 30);
  const hitWall = state.city.resolveCircle(car, 26);
  if (hitWall) {
    if (Math.abs(car.speed) > 220) {
      state.player.health = Math.max(0, state.player.health - 8);
      state.audio.crash();
      spawnSparks(state, car.x, car.y, 10);
      state.events |= 16; // EVENT_HURT
    } else if (Math.abs(car.speed) > 90) {
      state.audio.crash();
      spawnSparks(state, car.x, car.y, 5);
    }
    car.speed *= 0.45;
  }
  if (car.crashCooldown > 0) car.crashCooldown -= dt;
  collideWithTraffic(state, car, dt);
  collideWithPeds(state, car, dt);
  state.player.x = car.x;
  state.player.y = car.y;
  state.player.angle = car.angle;
  state.player.speed = car.speed;
  state.audio.engineSet(speedRatio, true);
}

function collideWithTraffic(state, car, dt) {
  for (const other of state.cars) {
    if (other === car || other.dead || other.kind === 'player') continue;
    const d = dist(car.x, car.y, other.x, other.y);
    if (d > 58 || d < 1) continue;
    // Shunt the other car aside and slow both down.
    const push = angleTo(car.x, car.y, other.x, other.y);
    other.x += Math.cos(push) * 26 * dt * 10;
    other.y += Math.sin(push) * 26 * dt * 10;
    if (car.crashCooldown <= 0 && Math.abs(car.speed) > 150) {
      car.crashCooldown = 0.5;
      state.audio.crash();
      spawnSparks(state, (car.x + other.x) / 2, (car.y + other.y) / 2, 8);
      if (Math.abs(car.speed) > 320) {
        state.player.health = Math.max(0, state.player.health - 5);
        state.events |= 16;
      }
    }
    other.speed = Math.max(0, other.speed - 120 * dt);
    car.speed *= 0.82;
  }
}

function collideWithPeds(state, car, dt) {
  if (Math.abs(car.speed) < 60) return;
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = dist(car.x, car.y, ped.x, ped.y);
    if (d > 34) continue;
    ped.dead = true;
    ped.deadT = 0;
    const fling = angleTo(car.x, car.y, ped.x, ped.y);
    ped.x += Math.cos(fling) * 26;
    ped.y += Math.sin(fling) * 26;
    spawnSparks(state, ped.x, ped.y, 8);
    state.audio.crash();
    state.player.health = Math.max(0, state.player.health - 2);
    state.events |= 16;
    // Running someone over is a crime the whole street sees.
    addHeatLocal(state, 25);
  }
}

/** Local heat helper: vehicles must not import police (police imports vehicles). */
function addHeatLocal(state, amount) {
  state.heat = Math.min(240, state.heat + amount);
  state.crimeTimer = 0;
}

export function spawnSparks(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const sp = 60 + state.rng() * 180;
    state.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, t: 0.5, max: 0.5, size: 3, color: '#ffd94d' });
  }
}

export function spawnSmoke(state, x, y) {
  state.particles.push({ x, y, vx: 0, vy: -24, t: 0.9, max: 0.9, size: 14, color: 'rgba(120,120,120,0.5)' });
}

export function makePoliceCar(state, x, y) {
  const car = createCar(x, y, 0, POLICE_MODEL, 'police');
  car.siren = true;
  car.targetSpeed = 540;
  return car;
}

export { POLICE_MODEL, rangeInt };
