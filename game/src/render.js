// Drawing only: the city, its people and cars, the HUD with its minimap,
// and every menu. The camera follows the player; the HUD is drawn in a
// fixed 1280x720 logical space scaled to fit the window.
import { FONT, LANDMARKS, PALETTE, ROAD_LINES, ROAD_WIDTH, WORLD } from './config.js';
import { clamp } from './random.js';
import { missionMarker, missionTitle, objectiveText } from './missions.js';
import { BEACH_TOP, WATER_TOP } from './city.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_WASTED = 'wasted';

const VIEW_W = 1280;
const VIEW_H = 720;

export function pauseButtons() {
  return [
    { id: 'resume', label: 'Resume', x: 490, y: 330, w: 300, h: 52 },
    { id: 'save', label: 'Save game', x: 490, y: 394, w: 300, h: 52 },
    { id: 'load', label: 'Load game', x: 490, y: 458, w: 300, h: 52 },
    { id: 'restart', label: 'Restart story', x: 490, y: 522, w: 300, h: 52 },
  ];
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, dpr: 1 };
  const fonts = new Map();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.dpr = dpr;
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.ox = (canvas.width - VIEW_W * view.scale) / 2;
    view.oy = (canvas.height - VIEW_H * view.scale) / 2;
  }

  function font(size, bold) {
    const key = `${bold ? 'b' : ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${bold ? '700 ' : ''}${size}px ${FONT}`);
    return fonts.get(key);
  }

  function text(value, x, y, size, color, align, bold) {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(value, x, y);
  }

  /** CSS-pixel pointer position to world coordinates. */
  function toWorld(cssX, cssY) {
    const dx = cssX * view.dpr;
    const dy = cssY * view.dpr;
    return {
      x: (dx - canvas.width / 2) / view.scale + currentCam.x,
      y: (dy - canvas.height / 2) / view.scale + currentCam.y,
    };
  }

  /** CSS-pixel pointer position to logical HUD coordinates. */
  function toLogical(cssX, cssY) {
    return {
      x: (cssX * view.dpr - view.ox) / view.scale,
      y: (cssY * view.dpr - view.oy) / view.scale,
    };
  }

  let currentCam = { x: 0, y: 0 };
  let currentState = null;

  function worldTransform(state) {
    // Clamp the camera so the view never shows the void past the city edge.
    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const cx = vw >= WORLD.width ? WORLD.width / 2 : clamp(state.camera.x, vw / 2, WORLD.width - vw / 2);
    const cy = vh >= WORLD.height ? WORLD.height / 2 : clamp(state.camera.y, vh / 2, WORLD.height - vh / 2);
    currentCam = { x: cx, y: cy };
    currentState = state;
    ctx.setTransform(view.scale, 0, 0, view.scale, canvas.width / 2 - cx * view.scale, canvas.height / 2 - cy * view.scale);
  }

  function hudTransform() {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  }

  function drawGround(state) {
    const city = state.city;
    const cam = currentCam; // clamped, like the transform — never the raw camera
    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const x0 = Math.max(0, cam.x - vw / 2 - 60);
    const y0 = Math.max(0, cam.y - vh / 2 - 60);
    const x1 = Math.min(WORLD.width, cam.x + vw / 2 + 60);
    const y1 = Math.min(WORLD.height, cam.y + vh / 2 + 60);

    // Grass base, sand beach and the sea along the south edge.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    if (y1 > BEACH_TOP) {
      ctx.fillStyle = PALETTE.sand;
      ctx.fillRect(x0, Math.max(y0, BEACH_TOP), x1 - x0, y1 - Math.max(y0, BEACH_TOP));
    }
    if (y1 > WATER_TOP) {
      ctx.fillStyle = PALETTE.water;
      ctx.fillRect(x0, Math.max(y0, WATER_TOP), x1 - x0, y1 - Math.max(y0, WATER_TOP));
      ctx.fillStyle = PALETTE.waterDeep;
      for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
        ctx.fillRect(wx + 20, WATER_TOP + 24, 46, 4);
        ctx.fillRect(wx + 44, WATER_TOP + 52, 30, 4);
      }
    }
    // Parks.
    for (const park of city.parks) {
      if (park.x > x1 || park.x + park.w < x0 || park.y > y1 || park.y + park.h < y0) continue;
      ctx.fillStyle = '#5d9440';
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    // Sidewalks and roads.
    for (const line of ROAD_LINES) {
      if (line > y0 - 80 && line < y1 + 80) {
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(x0, line - ROAD_WIDTH / 2 - 14, x1 - x0, ROAD_WIDTH + 28);
      }
      if (line > x0 - 80 && line < x1 + 80) {
        ctx.fillStyle = PALETTE.sidewalk;
        ctx.fillRect(line - ROAD_WIDTH / 2 - 14, y0, ROAD_WIDTH + 28, y1 - y0);
      }
    }
    for (const line of ROAD_LINES) {
      if (line > y0 - 80 && line < y1 + 80) {
        ctx.fillStyle = PALETTE.road;
        ctx.fillRect(x0, line - ROAD_WIDTH / 2, x1 - x0, ROAD_WIDTH);
        ctx.fillStyle = PALETTE.roadLine;
        for (let lx = Math.floor(x0 / 64) * 64; lx < x1; lx += 64) ctx.fillRect(lx, line - 2, 34, 4);
      }
      if (line > x0 - 80 && line < x1 + 80) {
        ctx.fillStyle = PALETTE.road;
        ctx.fillRect(line - ROAD_WIDTH / 2, y0, ROAD_WIDTH, y1 - y0);
        ctx.fillStyle = PALETTE.roadLine;
        for (let ly = Math.floor(y0 / 64) * 64; ly < y1; ly += 64) ctx.fillRect(line - 2, ly, 4, 34);
      }
    }
  }

  function drawCityProps(state) {
    const city = state.city;
    const cam = currentCam; // clamped, like the transform — never the raw camera
    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const x0 = cam.x - vw / 2 - 80;
    const y0 = cam.y - vh / 2 - 80;
    const x1 = cam.x + vw / 2 + 80;
    const y1 = cam.y + vh / 2 + 80;
    // Piers and boats at the marina.
    for (const pier of city.piers) {
      ctx.fillStyle = '#8a6f4d';
      ctx.fillRect(pier.x, pier.y, pier.w, pier.h);
    }
    for (const boat of city.boats) {
      ctx.save();
      ctx.translate(boat.x, boat.y);
      ctx.rotate(boat.angle);
      ctx.fillStyle = boat.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 34, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2b2f38';
      ctx.fillRect(-8, -6, 16, 12);
      ctx.restore();
    }
    // Shipping containers at the docks.
    for (const c of city.containers) {
      ctx.fillStyle = c.color;
      ctx.fillRect(c.x, c.y, c.w, c.h);
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 2;
      ctx.strokeRect(c.x + 1, c.y + 1, c.w - 2, c.h - 2);
      ctx.beginPath();
      ctx.moveTo(c.x + c.w / 3, c.y);
      ctx.lineTo(c.x + c.w / 3, c.y + c.h);
      ctx.moveTo(c.x + (2 * c.w) / 3, c.y);
      ctx.lineTo(c.x + (2 * c.w) / 3, c.y + c.h);
      ctx.stroke();
    }
    // Trees.
    for (const tree of city.trees) {
      if (tree.x < x0 || tree.x > x1 || tree.y < y0 || tree.y > y1) continue;
      ctx.fillStyle = '#4d7a35';
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6b9e4a';
      ctx.beginPath();
      ctx.arc(tree.x - tree.r * 0.25, tree.y - tree.r * 0.25, tree.r * 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    // Buildings with roofs, walls and windows.
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.wall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      const inset = b.tall ? 10 : 6;
      ctx.fillRect(b.x + inset, b.y + inset, b.w - inset * 2, b.h - inset * 2);
      if (b.tall) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillRect(b.x + b.w / 2 - 8, b.y + 8, 16, 10);
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.28)';
        const cols = Math.max(1, Math.floor(b.w / 26));
        const rows = Math.max(1, Math.floor(b.h / 26));
        for (let i = 0; i < cols; i += 1) {
          for (let j = 0; j < rows; j += 1) {
            ctx.fillRect(b.x + 10 + i * 26, b.y + 10 + j * 26, 12, 10);
          }
        }
      }
    }
  }


  function drawSkids(state) {
    ctx.strokeStyle = 'rgba(20,20,24,0.5)';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    for (const s of state.skids) {
      ctx.globalAlpha = Math.min(1, s.t / 2);
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (p.taken) continue;
      const bob = Math.sin(state.elapsed * 3 + p.bob) * 3;
      if (p.kind === 'cash') {
        ctx.fillStyle = '#2f9e57';
        ctx.beginPath();
        ctx.arc(p.x, p.y + bob, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e8f5e9';
        text('$', p.x, p.y + bob + 6, 18, '#e8f5e9', 'center', true);
      } else if (p.kind === 'ammo') {
        ctx.fillStyle = '#c9a24a';
        ctx.fillRect(p.x - 11, p.y - 8 + bob, 22, 16);
        ctx.fillStyle = '#2b2f38';
        ctx.fillRect(p.x - 7, p.y - 4 + bob, 4, 8);
        ctx.fillRect(p.x - 1, p.y - 4 + bob, 4, 8);
        ctx.fillRect(p.x + 5, p.y - 4 + bob, 4, 8);
      } else {
        // The stolen package: a bright gold case.
        ctx.fillStyle = '#ffc93c';
        ctx.fillRect(p.x - 12, p.y - 9 + bob, 24, 18);
        ctx.strokeStyle = '#8a6d1f';
        ctx.lineWidth = 2;
        ctx.strokeRect(p.x - 12, p.y - 9 + bob, 24, 18);
      }
    }
  }

  function drawCarShape(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-32 + 3, -15 + 4, 64, 30);
    // Wheels.
    ctx.fillStyle = '#15171c';
    ctx.fillRect(-22, -18, 14, 6);
    ctx.fillRect(-22, 12, 14, 6);
    ctx.fillRect(10, -18, 14, 6);
    ctx.fillRect(10, 12, 14, 6);
    // Body.
    ctx.fillStyle = car.color;
    ctx.beginPath();
    ctx.roundRect(-32, -15, 64, 30, 8);
    ctx.fill();
    // Cabin and windshield.
    ctx.fillStyle = 'rgba(20,28,38,0.85)';
    ctx.beginPath();
    ctx.roundRect(-8, -12, 20, 24, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,220,255,0.5)';
    ctx.fillRect(8, -11, 4, 22);
    // Headlights.
    ctx.fillStyle = '#fff6c9';
    ctx.fillRect(30, -12, 3, 6);
    ctx.fillRect(30, 6, 3, 6);
    if (car.kind === 'police') {
      ctx.fillStyle = '#1d2f4d';
      ctx.fillRect(-30, -15, 20, 30);
      ctx.fillStyle = '#fff';
      text('PD', -20, 5, 11, '#fff', 'center', true);
      // Flashing light bar.
      const flash = Math.floor(performance.now() / 280) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#2f7bff';
      ctx.fillRect(-4, -17, 8, 5);
      ctx.fillStyle = flash ? '#2f7bff' : '#ff3b30';
      ctx.fillRect(4, -17, 8, 5);
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffc93c';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(-34, -17, 68, 34, 9);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, shirt, pants, phase, dead, isPlayer, isCop, isThug) {
    ctx.save();
    ctx.translate(x, y);
    if (dead) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = shirt;
      ctx.beginPath();
      ctx.ellipse(0, 0, 15, 9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    const bob = Math.sin(phase) * 2.5;
    // Legs.
    ctx.fillStyle = pants;
    ctx.fillRect(-6, -9 + bob, 12, 6);
    ctx.fillRect(-6, 3 - bob, 12, 6);
    // Body.
    ctx.fillStyle = isCop ? '#1d3a6e' : isThug ? '#7a2e2e' : shirt;
    ctx.beginPath();
    ctx.roundRect(-9, -10, 18, 20, 7);
    ctx.fill();
    if (isCop) {
      ctx.fillStyle = '#dfe6f2';
      ctx.fillRect(-9, -2, 18, 4);
      text('PD', 0, -11, 9, '#fff', 'center', true);
    }
    if (isThug) {
      ctx.fillStyle = '#d94f3d';
      ctx.fillRect(-9, -10, 18, 5);
    }
    // Head and shoulders.
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(13, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    if (isPlayer) {
      ctx.fillStyle = '#e84c3d';
      ctx.beginPath();
      ctx.arc(13, 0, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(14, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Gun in hand when aiming.
    if (isPlayer) {
      ctx.fillStyle = '#22252b';
      ctx.fillRect(16, -2, 12, 4);
    }
    ctx.restore();
  }

  function drawEntities(state) {
    for (const car of state.cars) {
      if (car.kind === 'player') continue;
      drawCarShape(car, false);
    }
    if (state.player.car) drawCarShape(state.player.car, true);
    for (const ped of state.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.shirt, ped.pants, ped.walkPhase, ped.dead, false, false, false);
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, '#1d3a6e', '#1d2f4d', cop.walkPhase, cop.dead, false, true, false);
    }
    for (const enemy of state.enemies) {
      drawPerson(enemy.x, enemy.y, enemy.angle, '#3d3d3d', '#2b2b2b', enemy.walkPhase, enemy.dead, false, false, true);
      if (!enemy.dead) {
        // Health pips above each thug.
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(enemy.x - 14, enemy.y - 30, 28, 5);
        ctx.fillStyle = '#e84c3d';
        ctx.fillRect(enemy.x - 14, enemy.y - 30, 28 * (enemy.health / 3), 5);
      }
    }
    // Bullets.
    ctx.fillStyle = '#ffe9a8';
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles.
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.t / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + p.t / p.max), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The player, on foot.
    const pl = state.player;
    if (pl.onFoot) {
      drawPerson(pl.x, pl.y, pl.angle, PALETTE.player, '#2b2f38', pl.walkPhase, false, true, false, false);
      // Aim line, short and subtle.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(pl.x + Math.cos(pl.angle) * 22, pl.y + Math.sin(pl.angle) * 22);
      ctx.lineTo(pl.x + Math.cos(pl.angle) * 46, pl.y + Math.sin(pl.angle) * 46);
      ctx.stroke();
    }
  }

  function drawMarker(state) {
    const marker = missionMarker(state);
    if (!marker) return;
    const t = state.elapsed;
    const pulse = 1 + Math.sin(t * 4) * 0.12;
    const cam = currentCam; // clamped, like the transform — never the raw camera
    const vw = canvas.width / view.scale;
    const vh = canvas.height / view.scale;
    const onScreen = marker.x > cam.x - vw / 2 && marker.x < cam.x + vw / 2
      && marker.y > cam.y - vh / 2 && marker.y < cam.y + vh / 2;
    if (onScreen) {
      // Bouncing diamond and a beam of light.
      ctx.fillStyle = 'rgba(255,201,60,0.18)';
      ctx.fillRect(marker.x - 8, marker.y - 90, 16, 90);
      ctx.save();
      ctx.translate(marker.x, marker.y - 34 + Math.sin(t * 3) * 6);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = PALETTE.marker;
      ctx.fillRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
      ctx.strokeStyle = '#8a6d1f';
      ctx.lineWidth = 2;
      ctx.strokeRect(-11 * pulse, -11 * pulse, 22 * pulse, 22 * pulse);
      ctx.restore();
      ctx.font = font(15, true);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 4;
      ctx.strokeText(marker.label, marker.x, marker.y + 34);
      ctx.fillText(marker.label, marker.x, marker.y + 34);
    } else {
      // Edge arrow pointing at the off-screen objective.
      const dx = marker.x - cam.x;
      const dy = marker.y - cam.y;
      const ang = Math.atan2(dy, dx);
      const ex = cam.x + Math.cos(ang) * (vw / 2 - 46);
      const ey = cam.y + Math.sin(ang) * (vh / 2 - 46);
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(ang);
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.moveTo(18, 0);
      ctx.lineTo(-12, -13);
      ctx.lineTo(-12, 13);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  function drawDayNight(state) {
    // A warm sun-soaked day, an orange dusk, a deep blue night.
    const hour = state.clock / 60;
    let color = 'rgba(255,214,120,0.05)';
    if (hour < 5.5 || hour >= 20) color = 'rgba(8,14,44,0.38)';
    else if (hour < 7) color = 'rgba(255,150,80,0.12)';
    else if (hour >= 17.5 && hour < 20) color = 'rgba(255,120,50,0.12)';
    else if (hour >= 17 && hour < 17.5) color = 'rgba(255,170,90,0.10)';
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Night: a pool of light around the player.
    if (hour < 5.5 || hour >= 20) {
      const px = (state.player.x - currentCam.x) * view.scale + canvas.width / 2;
      const py = (state.player.y - currentCam.y) * view.scale + canvas.height / 2;
      const grad = ctx.createRadialGradient(px, py, 40, px, py, 340);
      grad.addColorStop(0, 'rgba(255,230,160,0.20)');
      grad.addColorStop(1, 'rgba(255,230,160,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }


  function drawMinimap(state) {
    const mw = 208;
    const mh = 156;
    const mx = VIEW_W - mw - 16;
    const my = VIEW_H - mh - 16;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(mx - 6, my - 6, mw + 12, mh + 12);
    ctx.fillStyle = '#24351f';
    ctx.fillRect(mx, my, mw, mh);
    ctx.strokeStyle = '#5a5f6b';
    ctx.lineWidth = 2;
    for (const line of ROAD_LINES) {
      ctx.beginPath();
      ctx.moveTo(mx, my + line * sy);
      ctx.lineTo(mx + mw, my + line * sy);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(mx + line * sx, my);
      ctx.lineTo(mx + line * sx, my + mh);
      ctx.stroke();
    }
    // Water strip at the bottom of the map.
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(mx, my + (WATER_TOP * sy), mw, mh - WATER_TOP * sy);
    // Mission marker.
    const marker = missionMarker(state);
    if (marker) {
      ctx.fillStyle = PALETTE.marker;
      ctx.beginPath();
      ctx.arc(mx + marker.x * sx, my + marker.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police blips.
    ctx.fillStyle = '#5b9dff';
    for (const cop of state.cops) {
      if (cop.dead) continue;
      ctx.beginPath();
      ctx.arc(mx + cop.x * sx, my + cop.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // The player.
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#e84c3d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx + state.player.x * sx, my + state.player.y * sy, 4.5, 0, Math.PI * 2);
    ctx.stroke();
    text('SOLMAR CITY', mx + 4, my - 10, 13, PALETTE.muted, 'left', true);
  }

  function drawHud(state) {
    hudTransform();
    const p = state.player;
    // Top-left: health, money, ammo.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(14, 14, 250, 86);
    text('DARIO REYES', 26, 40, 15, PALETTE.muted, 'left', true);
    ctx.fillStyle = '#22252b';
    ctx.fillRect(26, 48, 180, 14);
    const hpFrac = clamp(p.health / 100, 0, 1);
    ctx.fillStyle = hpFrac > 0.5 ? '#4d9e57' : hpFrac > 0.25 ? '#e8b23d' : '#e84c3d';
    ctx.fillRect(26, 48, 180 * hpFrac, 14);
    text(`${Math.ceil(p.health)}`, 214, 61, 14, '#fff', 'left', true);
    text(`$${p.money.toLocaleString('en-US')}`, 26, 88, 20, '#7de38a', 'left', true);
    text(`Ammo ${p.ammo}`, 150, 88, 15, PALETTE.text, 'left');
    // Top-right: wanted stars.
    ctx.fillStyle = PALETTE.hudPanel;
    ctx.fillRect(VIEW_W - 214, 14, 200, 52);
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, VIEW_W - 26, 50, 30, state.wanted > 0 ? '#ffc93c' : '#8b93a3', 'right', true);
    // Top-centre: mission title and objective.
    ctx.fillStyle = PALETTE.hudPanel;
    const obj = objectiveText(state);
    ctx.fillRect(300, 14, 680, 62);
    text(missionTitle(state).toUpperCase(), 640, 40, 17, PALETTE.hudAccent, 'center', true);
    text(obj, 640, 64, 15, PALETTE.text, 'center');
    // Bottom-left: speed when driving, controls hint on foot.
    ctx.fillStyle = PALETTE.hudPanel;
    if (!p.onFoot && p.car) {
      ctx.fillRect(14, VIEW_H - 66, 190, 52);
      text(`${Math.round(Math.abs(p.car.speed) * 0.18)} km/h`, 26, VIEW_H - 34, 22, '#fff', 'left', true);
      text(p.car.model.name, 130, VIEW_H - 34, 14, PALETTE.muted, 'left');
    } else {
      ctx.fillRect(14, VIEW_H - 66, 330, 52);
      text('WASD move · Click shoot · Space punch', 26, VIEW_H - 42, 14, PALETTE.text, 'left');
      text('E enter car · P pause · M mute', 26, VIEW_H - 22, 14, PALETTE.muted, 'left');
    }
    // Toast message.
    if (state.message.t > 0) {
      ctx.font = font(18, true);
      const w = ctx.measureText(state.message.text).width + 36;
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect((VIEW_W - w) / 2, 92, w, 38);
      text(state.message.text, VIEW_W / 2, 118, 18, PALETTE.hudAccent, 'center', true);
    }
    // Clock: time of day under the stars.
    const hour = Math.floor(state.clock / 60);
    const minute = Math.floor(state.clock % 60);
    const hh = String(hour).padStart(2, '0');
    const mm = String(minute).padStart(2, '0');
    text(`${hh}:${mm}`, VIEW_W - 26, 88, 16, PALETTE.text, 'right', true);
    drawMinimap(state);
    drawDialogue(state);
  }

  function wrapLines(value, maxWidth, size) {
    ctx.font = font(size, false);
    const words = value.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = next;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function drawDialogue(state) {
    const d = state.dialogue;
    if (!d || !d.active || d.index >= d.lines.length) return;
    const line = d.lines[d.index];
    const lines = wrapLines(line, 760, 18);
    const h = 34 + lines.length * 24 + 30;
    const w = 800;
    const x = (VIEW_W - w) / 2;
    const y = VIEW_H - h - 200;
    ctx.fillStyle = 'rgba(10,12,18,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.hudAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], x + 24, y + 36 + i * 24, 18, PALETTE.text, 'left');
    }
    text('E / click to continue', x + w - 24, y + h - 12, 13, PALETTE.muted, 'right');
  }

  function drawPanel(title, lines, prompt, accent) {
    const w = 760;
    const h = 170 + lines.length * 30 + 60;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = 'rgba(10,12,18,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = accent || PALETTE.hudAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text(title, VIEW_W / 2, y + 66, 44, accent || PALETTE.hudAccent, 'center', true);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, y + 120 + i * 30, 18, PALETTE.text, 'center');
    }
    if (prompt) text(prompt, VIEW_W / 2, y + h - 28, 17, PALETTE.muted, 'center');
  }

  function drawTitle(state) {
    hudTransform();
    ctx.fillStyle = 'rgba(8,10,18,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Sun-soaked title.
    text('SOLMAR CITY', VIEW_W / 2, 190, 92, '#ffc93c', 'center', true);
    text('S T R E E T S   O F   G O L D', VIEW_W / 2, 236, 24, PALETTE.text, 'center', true);
    const lines = [
      'A brand-new open-world crime story. One city, one crew, one last score.',
      'Dario Reyes is new in Solmar. Lena Marlowe has three jobs for him —',
      'steal a car, settle a debt at the docks, and outrun the whole Solmar PD.',
      '',
      'WASD move & drive · Mouse aim · Click shoot · Space punch · E enter / steal a car',
      'P pause · M mute · Your progress saves to this browser.',
    ];
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], VIEW_W / 2, 300 + i * 30, 18, i < 3 ? PALETTE.text : PALETTE.muted, 'center');
    }
    const blink = Math.floor(performance.now() / 500) % 2 === 0;
    if (blink) text('Press ENTER or click to start', VIEW_W / 2, 540, 24, '#ffc93c', 'center', true);
    text('An original game — its city, characters and story are invented, not borrowed.', VIEW_W / 2, 690, 14, PALETTE.muted, 'center');
  }

  function drawPaused(state) {
    hudTransform();
    ctx.fillStyle = 'rgba(8,10,18,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // A tall panel: title, two lines, the prompt, then the four buttons.
    const x = 260;
    const y = 120;
    const w = 760;
    const h = 480;
    ctx.fillStyle = 'rgba(10,12,18,0.88)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = PALETTE.hudAccent;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    text('Paused', VIEW_W / 2, y + 66, 44, PALETTE.hudAccent, 'center', true);
    text('Solmar waits for no one — except right now.', VIEW_W / 2, y + 118, 18, PALETTE.text, 'center');
    text('WASD move & drive · Click shoot · Space punch · E enter car', VIEW_W / 2, y + 148, 18, PALETTE.text, 'center');
    text('Click a button below, or press P to resume', VIEW_W / 2, y + 178, 17, PALETTE.muted, 'center');
    for (const b of pauseButtons()) {
      ctx.fillStyle = '#2b3242';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = PALETTE.hudAccent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      text(b.label, b.x + b.w / 2, b.y + 34, 20, PALETTE.text, 'center', true);
    }
  }

  /** Paint one frame: the world, then the HUD or a menu for the screen. */
  function draw(state, screen) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#0e1420';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    worldTransform(state);
    drawGround(state);
    drawCityProps(state);
    drawSkids(state);
    drawPickups(state);
    drawEntities(state);
    drawMarker(state);
    // Day / night tint over the world, under the HUD.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawDayNight(state);
    if (screen === SCREEN_TITLE) {
      drawTitle(state);
      return;
    }
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPaused(state);
    else if (screen === SCREEN_BUSTED) {
      hudTransform();
      drawPanel('BUSTED', [
        'The Solmar PD caught you. Bail costs $200.',
        'Lena is already laughing at you.',
      ], 'Press ENTER to get back out there', '#5b9dff');
    } else if (screen === SCREEN_WASTED) {
      hudTransform();
      drawPanel('WASTED', [
        'Solmar eats the careless. Dario wakes up at the clinic.',
        'Hospital bill: $150.',
      ], 'Press ENTER to get back out there', '#e84c3d');
    }
    if (state.storyDone && screen === SCREEN_PLAY) {
      hudTransform();
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect(VIEW_W / 2 - 210, 92, 420, 34);
      text('★ STORY COMPLETE — Solmar is yours ★', VIEW_W / 2, 115, 16, PALETTE.hudAccent, 'center', true);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toWorld, toLogical, resize };
}
