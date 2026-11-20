// Solmar City generation: a seeded grid of avenues, blocks with buildings,
// parks, a beach and the docks. Everything is plain data — the renderer draws
// it, and the simulation asks it about roads and collisions.
import { PALETTE, ROAD_LINES, ROAD_STEP, ROAD_WIDTH, WORLD } from './config.js';
import { clamp, pick, range, rangeInt } from './random.js';

const BEACH_TOP = 2180;
const WATER_TOP = 2340;
const DOCKS_RIGHT = 340;

const ROOFS = ['#c96f4a', '#b85c5c', '#7a8ba0', '#a08b5a', '#5a7a6b', '#8a6a9e', '#c9a24a'];
const HOUSE_ROOFS = ['#c96f4a', '#a05a3a', '#7a6b8a', '#5a7a6b'];

function districtAt(x, y) {
  if (y >= BEACH_TOP) return 'beach';
  if (x <= DOCKS_RIGHT && y >= 1200 && y <= 2000) return 'docks';
  if (x >= 2800 && y >= 1400) return 'marina';
  if (x >= 1000 && x <= 2200 && y >= 600 && y <= 1600) return 'downtown';
  if (y <= 500) return 'suburbs';
  return 'midtown';
}

export function generateCity(rng) {
  const buildings = [];
  const trees = [];
  const parks = [];
  const containers = [];
  const boats = [];
  const piers = [];

  // Blocks sit between neighbouring roads. Each block holds one to four
  // buildings, a park, or (on the edges) docks, beach and marina scenery.
  for (let bx = 0; bx < ROAD_LINES.length - 1; bx += 1) {
    for (let by = 0; by < ROAD_LINES.length - 1; by += 1) {
      const x0 = ROAD_LINES[bx] + ROAD_WIDTH / 2 + 14;
      const y0 = ROAD_LINES[by] + ROAD_WIDTH / 2 + 14;
      const x1 = ROAD_LINES[bx + 1] - ROAD_WIDTH / 2 - 14;
      const y1 = ROAD_LINES[by + 1] - ROAD_WIDTH / 2 - 14;
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2;
      const district = districtAt(cx, cy);
      if (district === 'beach') continue;
      if (district === 'docks') {
        for (let i = 0; i < 5; i += 1) {
          containers.push({
            x: x0 + 8 + rng() * (x1 - x0 - 90),
            y: y0 + 8 + rng() * (y1 - y0 - 40),
            w: 78, h: 30,
            color: pick(rng, ['#b85c3d', '#3d7d9e', '#7a9e3d', '#c9a24a', '#8a6a9e']),
          });
        }
        continue;
      }
      if (district === 'marina') {
        piers.push({ x: cx - 90, y: y0 + 30, w: 180, h: 18 });
        for (let i = 0; i < 3; i += 1) {
          boats.push({ x: x0 + 30 + i * 90, y: y0 + 70 + rng() * 120, angle: range(rng, -0.4, 0.4), color: pick(rng, ['#e8e8e8', '#3d7dd9', '#e8b23d']) });
        }
        continue;
      }
      const roll = rng();
      if (roll < 0.14) {
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const count = rangeInt(rng, 4, 8);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: range(rng, x0 + 16, x1 - 16), y: range(rng, y0 + 16, y1 - 16), r: range(rng, 10, 16) });
        }
        continue;
      }
      const downtown = district === 'downtown';
      const houses = district === 'suburbs';
      const cols = houses ? 2 : downtown ? 1 : rangeInt(rng, 1, 2);
      const rows = houses ? 2 : downtown ? 1 : rangeInt(rng, 1, 2);
      const bw = (x1 - x0 - (cols - 1) * 24) / cols;
      const bh = (y1 - y0 - (rows - 1) * 24) / rows;
      for (let c = 0; c < cols; c += 1) {
        for (let r = 0; r < rows; r += 1) {
          const w = bw * range(rng, 0.62, 0.92);
          const h = bh * range(rng, 0.62, 0.92);
          const bx0 = x0 + c * (bw + 24) + (bw - w) / 2;
          const by0 = y0 + r * (bh + 24) + (bh - h) / 2;
          buildings.push({
            x: bx0, y: by0, w, h,
            tall: downtown,
            roof: pick(rng, houses ? HOUSE_ROOFS : ROOFS),
            wall: downtown ? '#5a6270' : pick(rng, ['#d9c9a8', '#c9b8a0', '#b8c4c9', '#d9a08a']),
          });
        }
      }
      if (rng() < 0.5) trees.push({ x: range(rng, x0 + 10, x1 - 10), y: range(rng, y0 + 10, y1 - 10), r: range(rng, 9, 14) });
    }
  }

  const solids = buildings.concat(containers);
  const city = { buildings, trees, parks, containers, boats, piers, districtAt };

  city.isOnRoad = function isOnRoad(x, y) {
    const half = ROAD_WIDTH / 2 + 6;
    for (const line of ROAD_LINES) {
      if (Math.abs(x - line) <= half || Math.abs(y - line) <= half) return true;
    }
    return false;
  };

  city.nearestRoad = function nearestRoad(x, y) {
    let best = ROAD_LINES[0];
    let bestD = Infinity;
    for (const line of ROAD_LINES) {
      const d = Math.min(Math.abs(x - line), Math.abs(y - line));
      if (d < bestD) { bestD = d; best = line; }
    }
    return best;
  };

  // Push a circle out of every solid rectangle (buildings, containers).
  // Returns true when anything was hit.
  city.resolveCircle = function resolveCircle(body, radius) {
    let hit = false;
    for (const s of solids) {
      const nx = clamp(body.x, s.x, s.x + s.w);
      const ny = clamp(body.y, s.y, s.y + s.h);
      const dx = body.x - nx;
      const dy = body.y - ny;
      const d2 = dx * dx + dy * dy;
      if (d2 >= radius * radius) continue;
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = nx + (dx / d) * radius;
        body.y = ny + (dy / d) * radius;
      } else {
        // Centre inside the rect: push out along the shallowest side.
        const left = body.x - s.x;
        const right = s.x + s.w - body.x;
        const top = body.y - s.y;
        const bottom = s.y + s.h - body.y;
        const m = Math.min(left, right, top, bottom);
        if (m === left) body.x = s.x - radius;
        else if (m === right) body.x = s.x + s.w + radius;
        else if (m === top) body.y = s.y - radius;
        else body.y = s.y + s.h + radius;
      }
    }
    return hit;
  };

  city.hitsBuilding = function hitsBuilding(x, y, radius) {
    const probe = { x, y };
    return city.resolveCircle(probe, radius) && (probe.x !== x || probe.y !== y);
  };

  return city;
}

export { BEACH_TOP, WATER_TOP, PALETTE, ROAD_STEP };
