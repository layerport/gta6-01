// Combat: the player's pistol and fists, Kessler thugs who shoot back,
// bullets, and the muzzle flashes and sparks that sell each hit.
import { PLAYER, WANTED } from './config.js';
import { angleTo, clamp, dist, range } from './random.js';
import { addHeat } from './police.js';
import { spawnSparks } from './vehicles.js';

/** How far a bullet can travel before the simulation drops it. */
export const BULLET_MAX_LIFE = 1.2;

export function playerShoot(state, targetX, targetY) {
  const p = state.player;
  if (p.fireCooldown > 0 || p.ammo <= 0 || !p.onFoot) return false;
  p.fireCooldown = PLAYER.fireRate;
  p.ammo -= 1;
  const a = angleTo(p.x, p.y, targetX, targetY) + range(state.rng, -0.03, 0.03);
  const mx = p.x + Math.cos(a) * 24;
  const my = p.y + Math.sin(a) * 24;
  state.bullets.push({
    x: mx, y: my,
    vx: Math.cos(a) * PLAYER.bulletSpeed,
    vy: Math.sin(a) * PLAYER.bulletSpeed,
    life: 0.9, from: 'player',
  });
  state.particles.push({ x: mx, y: my, vx: 0, vy: 0, t: 0.08, max: 0.08, size: 12, color: '#ffe9a8' });
  state.lastShotX = p.x;
  state.lastShotY = p.y;
  state.lastShotT = 1.5;
  state.audio.gunshot();
  addHeat(state, WANTED.shootHeat);
  state.stats.shotsFired += 1;
  return true;
}

export function playerMelee(state) {
  const p = state.player;
  if (p.meleeCooldown > 0 || !p.onFoot) return;
  p.meleeCooldown = 0.45;
  state.audio.punch();
  const reach = PLAYER.punchRange;
  // Thugs first.
  for (const enemy of state.enemies) {
    if (enemy.dead) continue;
    const d = dist(p.x, p.y, enemy.x, enemy.y);
    if (d < reach + 14) {
      hurtEnemy(state, enemy, PLAYER.punchDamage, angleTo(p.x, p.y, enemy.x, enemy.y));
    }
  }
  // Then anyone else standing too close.
  for (const ped of state.peds) {
    if (ped.dead) continue;
    const d = dist(p.x, p.y, ped.x, ped.y);
    if (d < reach) {
      ped.dead = true;
      ped.deadT = 0;
      spawnSparks(state, ped.x, ped.y, 6);
      addHeat(state, WANTED.killPedHeat);
    }
  }
  for (const cop of state.cops) {
    if (cop.dead) continue;
    const d = dist(p.x, p.y, cop.x, cop.y);
    if (d < reach) {
      cop.health -= 1;
      spawnSparks(state, cop.x, cop.y, 6);
      if (cop.health <= 0) {
        cop.dead = true;
        cop.deadT = 0;
        addHeat(state, WANTED.killCopHeat);
      } else {
        addHeat(state, 15);
      }
    }
  }
}

export function hurtEnemy(state, enemy, damage, fromAngle) {
  enemy.health -= damage;
  enemy.x += Math.cos(fromAngle) * 10;
  enemy.y += Math.sin(fromAngle) * 10;
  spawnSparks(state, enemy.x, enemy.y, 5);
  if (enemy.health <= 0 && !enemy.dead) {
    enemy.dead = true;
    enemy.deadT = 0;
    state.stats.kills += 1;
    if (state.mission.index === 1 && state.mission.stage === 2) {
      state.mission.kills += 1;
    }
  }
}

export function spawnThugs(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const thug = {
      x: x + range(state.rng, -90, 90),
      y: y + range(state.rng, -90, 90),
      angle: range(state.rng, 0, Math.PI * 2),
      health: 3,
      shootCd: range(state.rng, 0.4, 1.4),
      strafe: range(state.rng, -1, 1),
      strafeT: 0,
      walkPhase: 0,
      dead: false,
      deadT: 0,
    };
    // Never spawn inside a building: push out to the street.
    state.city.resolveCircle(thug, 14);
    state.enemies.push(thug);
  }
}

export function updateEnemies(state, dt) {
  const p = state.player;
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.dead) {
      enemy.deadT += dt;
      if (enemy.deadT > 10) state.enemies.splice(i, 1);
      continue;
    }
    const d = dist(enemy.x, enemy.y, p.x, p.y);
    enemy.walkPhase += dt * 6;
    enemy.strafeT -= dt;
    if (enemy.strafeT <= 0) {
      enemy.strafeT = range(state.rng, 0.8, 1.8);
      enemy.strafe = range(state.rng, -1, 1);
    }
    if (d < 460) {
      const want = angleTo(enemy.x, enemy.y, p.x, p.y);
      enemy.angle = want;
      // Strafe sideways and keep a little distance.
      const side = want + Math.PI / 2;
      enemy.x += Math.cos(side) * enemy.strafe * 46 * dt;
      enemy.y += Math.sin(side) * enemy.strafe * 46 * dt;
      if (d > 300) {
        enemy.x += Math.cos(want) * 60 * dt;
        enemy.y += Math.sin(want) * 60 * dt;
      } else if (d < 130) {
        enemy.x -= Math.cos(want) * 50 * dt;
        enemy.y -= Math.sin(want) * 50 * dt;
      }
      enemy.shootCd -= dt;
      if (enemy.shootCd <= 0 && d < 430) {
        enemy.shootCd = range(state.rng, 0.9, 1.7);
        const spread = range(state.rng, -0.12, 0.12);
        state.bullets.push({
          x: enemy.x, y: enemy.y,
          vx: Math.cos(want + spread) * 560,
          vy: Math.sin(want + spread) * 560,
          life: 1.0, from: 'enemy',
        });
        state.audio.gunshot();
      }
    }
    state.city.resolveCircle(enemy, 14);
  }
}

export function updateBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead) {
      // Walls stop bullets.
      const probe = { x: b.x, y: b.y };
      if (state.city.resolveCircle(probe, 2) && (probe.x !== b.x || probe.y !== b.y)) {
        spawnSparks(state, b.x, b.y, 4);
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      for (const enemy of state.enemies) {
        if (!enemy.dead && dist(b.x, b.y, enemy.x, enemy.y) < 20) {
          hurtEnemy(state, enemy, 1, Math.atan2(b.vy, b.vx));
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const cop of state.cops) {
          if (!cop.dead && dist(b.x, b.y, cop.x, cop.y) < 18) {
            cop.health -= 1;
            spawnSparks(state, cop.x, cop.y, 5);
            if (cop.health <= 0) {
              cop.dead = true;
              cop.deadT = 0;
              addHeat(state, WANTED.killCopHeat);
            } else {
              addHeat(state, 20);
            }
            dead = true;
            break;
          }
        }
      }
      if (!dead) {
        for (const ped of state.peds) {
          if (!ped.dead && dist(b.x, b.y, ped.x, ped.y) < 16) {
            ped.dead = true;
            ped.deadT = 0;
            spawnSparks(state, ped.x, ped.y, 6);
            addHeat(state, WANTED.killPedHeat);
            dead = true;
            break;
          }
        }
      }
    }
    if (!dead && (b.from === 'enemy' || b.from === 'cop')) {
      const hitR = p.onFoot ? 18 : 26;
      if (dist(b.x, b.y, p.x, p.y) < hitR) {
        p.health = Math.max(0, p.health - (b.from === 'enemy' ? 9 : 6));
        state.events |= 16; // EVENT_HURT
        spawnSparks(state, p.x, p.y, 5);
        dead = true;
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
  if (state.lastShotT > 0) state.lastShotT -= dt;
}
