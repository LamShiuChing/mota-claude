// Generates js/maps.js: every main floor without a hand-made map, plus the Memory Vaults.
// Usage: node tools/genmaps.js            (seeds come from tools/seeds.json when present)
const fs = require('fs'), path = require('path');
const load = require('./load');
const W = load(['data.js', 'world.js']);
const N = 11;
const seedsFile = path.join(__dirname, 'seeds.json');
const SEEDS = fs.existsSync(seedsFile) ? JSON.parse(fs.readFileSync(seedsFile, 'utf8')) : {};

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const inside = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
const key = (x, y) => `${x},${y}`;

// One floor. Returns null when the layout can't satisfy the plan (caller retries with a new seed).
function generate(plan, rand) {
  const pick = a => a[Math.floor(rand() * a.length)];
  const g = Array.from({ length: N }, () => Array(N).fill('.'));
  const regions = [], gaps = [];

  // Recursive division: walls on odd lines, doorway gaps on even cells, rooms have even bounds.
  (function divide(x0, y0, x1, y1) {
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    if ((w <= 3 && h <= 3) || (w * h <= 9 + rand() * 8 && rand() < 0.75 && w * h < 30)) return regions.push({ x0, y0, x1, y1 });
    const vertical = w === h ? rand() < 0.5 : w > h;
    const lo = vertical ? x0 : y0, hi = vertical ? x1 : y1;
    const lines = []; for (let i = lo + 1; i < hi; i += 2) lines.push(i);
    const at = pick(lines);
    const span = []; for (let i = vertical ? y0 : x0; i <= (vertical ? y1 : x1); i += 2) span.push(i);
    for (let i = vertical ? y0 : x0; i <= (vertical ? y1 : x1); i++) vertical ? (g[i][at] = '#') : (g[at][i] = '#');
    const holes = new Set([pick(span)]);
    if (span.length >= 4 && rand() < 0.22) holes.add(pick(span));
    for (const s of holes) gaps.push(vertical ? { x: at, y: s } : { x: s, y: at });
    if (vertical) { divide(x0, y0, at - 1, y1); divide(at + 1, y0, x1, y1); }
    else { divide(x0, y0, x1, at - 1); divide(x0, at + 1, x1, y1); }
  })(0, 0, N - 1, N - 1);

  const rid = Array.from({ length: N }, () => Array(N).fill(-1));
  regions.forEach((r, i) => {
    r.id = i; r.cells = []; r.area = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1);
    for (let y = r.y0; y <= r.y1; y++) for (let x = r.x0; x <= r.x1; x++) { rid[y][x] = i; r.cells.push([x, y]); }
  });
  for (const gp of gaps) {
    g[gp.y][gp.x] = '.';
    const [a, b] = DIRS4.map(([dx, dy]) => [gp.x + dx, gp.y + dy]).filter(([x, y]) => inside(x, y) && rid[y][x] >= 0).map(([x, y]) => rid[y][x]);
    Object.assign(gp, { a, b });
  }
  const adj = regions.map(() => []);
  gaps.forEach((gp, i) => { adj[gp.a].push([gp.b, i]); adj[gp.b].push([gp.a, i]); });
  const bfs = from => {
    const dist = regions.map(() => -1), via = regions.map(() => -1), q = [from];
    dist[from] = 0;
    while (q.length) { const r = q.shift(); for (const [n, gi] of adj[r]) if (dist[n] < 0) { dist[n] = dist[r] + 1; via[n] = gi; q.push(n); } }
    return { dist, via };
  };

  const taken = new Set(), gapAt = new Set(gaps.map(gp => key(gp.x, gp.y)));
  const set = (x, y, ch) => { g[y][x] = ch; taken.add(key(x, y)); };
  const nearGap = (x, y) => DIRS4.some(([dx, dy]) => gapAt.has(key(x + dx, y + dy)));
  const free = r => r.cells.filter(([x, y]) => !taken.has(key(x, y)));
  const evenCell = r => free(r).filter(([x, y]) => x % 2 === 0 && y % 2 === 0);
  // Cells where a blocking tile can sit without cutting the room: corners away from doorways.
  const safeSpot = r => free(r).filter(([x, y]) => r.x1 > r.x0 && r.y1 > r.y0 && (x === r.x0 || x === r.x1) && (y === r.y0 || y === r.y1) && !nearGap(x, y));
  // Stairs trigger on contact, so they must never sit on a through-path: only room corners or
  // corridor dead ends, away from doorways.
  const stairsSpot = r => evenCell(r).filter(([x, y]) => !nearGap(x, y)
    && (r.x0 === r.x1 || r.y0 === r.y1 ? (x === r.x0 && y === r.y0) || (x === r.x1 && y === r.y1) : (x === r.x0 || x === r.x1) && (y === r.y0 || y === r.y1)));
  const reserveNeighbor = (x, y) => {
    const n = DIRS4.map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => inside(nx, ny) && rid[ny][nx] === rid[y][x] && !taken.has(key(nx, ny)));
    if (!n) return false;
    taken.add(key(...n));
    return true;
  };

  // Stairs: down-stairs in a roomy region, up-stairs in the farthest one.
  const startR = pick(regions.filter(r => r.area >= 3 && stairsSpot(r).length));
  if (!startR) return null;
  const [dx, dy] = pick(stairsSpot(startR));
  set(dx, dy, 'D');
  if (!reserveNeighbor(dx, dy)) return null;
  const { dist, via } = bfs(startR.id);
  const far = Math.max(...dist);
  const endR = pick(regions.filter(r => dist[r.id] >= far - 1 && r !== startR && r.area >= 2 && stairsSpot(r).length));
  if (!endR) return null;
  const [ux, uy] = pick(stairsSpot(endR));
  set(ux, uy, plan.last ? 'L' : 'U');
  reserveNeighbor(ux, uy);

  const mainGaps = new Set(), mainRegions = new Set([startR.id]);
  for (let r = endR.id; r !== startR.id; ) { const gp = gaps[via[r]]; mainGaps.add(via[r]); mainRegions.add(r); r = gp.a === r ? gp.b : gp.a; }

  // Secret room: a dead-end region off the main path, sealed by a fake wall.
  let secret = null;
  if (plan.secret) {
    const leaves = regions.filter(r => adj[r.id].length === 1 && !mainRegions.has(r.id) && r.area <= 15 && r.area >= 2);
    secret = leaves.length ? pick(leaves) : null;
    if (!secret && plan.vault !== undefined) return null;
  }

  const o = plan.offset, lo = Math.min(4, 1 + Math.floor(o * 0.45)), hi = Math.min(6, lo + 2);
  const tier = (a = lo, b = hi) => String(a + Math.floor(rand() * (b - a + 1)));
  const doors = { Y: 0, B: 0, R: 0 }, mainDoors = { Y: 0, B: 0, R: 0 };
  gaps.forEach((gp, i) => {
    let ch;
    if (secret && (gp.a === secret.id || gp.b === secret.id)) ch = '%';
    else if (mainGaps.has(i)) ch = rand() < 0.62 ? tier(Math.max(lo, hi - 1), hi) : 'Y';
    else {
      const r = rand();
      ch = r < 0.4 ? 'Y' : r < 0.52 ? 'B' : r < 0.56 && plan.zone > 0 ? 'R' : r < 0.9 ? tier() : '.';
    }
    if (DOORS_SET.has(ch)) (mainGaps.has(i) ? mainDoors : doors)[ch]++;
    g[gp.y][gp.x] = ch;
    taken.add(key(gp.x, gp.y));
  });

  // Regions ranked by how early they're reached; keys go early, loot goes deep and behind doors.
  const order = [...regions].filter(r => r !== secret).sort((a, b) => dist[a.id] - dist[b.id]);
  const placeIn = (ch, pool, blocking = false) => {
    for (const r of pool) {
      const spots = blocking ? safeSpot(r) : free(r);
      if (spots.length) { const [x, y] = pick(spots); set(x, y, ch); return [x, y]; }
    }
    return null;
  };
  const shuffled = a => a.map(v => [rand(), v]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
  const early = order.slice(0, Math.max(2, Math.ceil(order.length / 3)));
  const late = shuffled(order.slice(Math.ceil(order.length / 3)));

  const meta = { npcs: {}, notes: {}, links: {} };
  for (const t of plan.place) if (!placeIn(t, shuffled(t === 'S' || t === 'M' ? early : late), t === 'S' || t === 'M')) return null;

  const count = (base, extra) => base + Math.floor(rand() * (extra + 1));
  // Keys for main-path doors must be reachable without opening any door.
  const openReach = [startR], seenR = new Set([startR.id]);
  for (let i = 0; i < openReach.length; i++) for (const [n, gi] of adj[openReach[i].id]) {
    const t = g[gaps[gi].y][gaps[gi].x];
    if (!seenR.has(n) && !DOORS_SET.has(t) && t !== '%') { seenR.add(n); openReach.push(regions[n]); }
  }
  for (let i = 0; i < mainDoors.Y; i++) if (!placeIn('y', shuffled(openReach))) return null;
  for (let i = 0; i < doors.Y - (rand() < 0.5 ? 1 : 0); i++) placeIn('y', shuffled(early).concat(late));
  for (let i = 0; i < doors.B; i++) placeIn('b', shuffled(order));
  for (let i = 0; i < doors.R; i++) placeIn('r', shuffled(order));
  const loot = [
    ...Array(count(2, 1)).fill('a'), ...Array(count(2, 1)).fill('d'), ...Array(count(2, 1)).fill('h'),
    ...(rand() < 0.4 ? ['H'] : []), ...(plan.corrupt && rand() < 0.45 ? ['v'] : []),
  ];
  for (const t of loot) placeIn(t, late.concat(shuffled(early)));

  if (secret) {
    if (plan.vault !== undefined) {
      const spot = safeSpot(secret)[0] || free(secret)[0];
      if (!spot) return null;
      set(...spot, '^');
      meta.links[key(...spot)] = W.MAIN_FLOORS + plan.vault;
    }
    for (const t of ['H', rand() < 0.5 ? 'a' : 'd']) placeIn(t, [secret]);
    // A scrawled hint on the near side of the fake wall.
    const fw = gaps.find(gp => gp.a === secret.id || gp.b === secret.id);
    const outside = regions[fw.a === secret.id ? fw.b : fw.a];
    const hint = placeIn('n', [outside]);
    if (hint) meta.notes[key(...hint)] = pick(W.SECRET_HINTS);
  }

  for (const r of regions) {
    if (r === startR || r === secret) continue;
    const n = r.area <= 2 ? 0 : r.area <= 6 ? (rand() < 0.5 ? 1 : 0) : 1 + (rand() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) placeIn(tier(), [r]);
  }
  for (let i = 0; i < 1 + (rand() < 0.4 ? 1 : 0); i++) {
    const at = placeIn('n', shuffled(order));
    if (at) meta.notes[key(...at)] = pick(W.NOTES[plan.zone]);
  }
  // Last, so an NPC never shifts the rest of the floor's layout (or its balance).
  if (plan.npc) {
    const at = placeIn('O', shuffled(order), true);
    if (!at) return null;
    meta.npcs[key(...at)] = plan.npc;
  }
  return { map: g.map(r => r.join('')), meta };
}
const DOORS_SET = new Set(['Y', 'B', 'R']);

// Hand-made maps: record npcs / notes / vault links from the plan. A plan's `npc` takes the map's 'O',
// its `vault` the map's '^', and a note within two steps of a fake wall gets a secret hint.
function fromHandmade(map, extra = {}) {
  const meta = { npcs: { ...(extra.npcs || {}) }, notes: {}, links: {} };
  const notes = [...(extra.notes || [])];
  const link = extra.link ?? (extra.vault !== undefined ? W.MAIN_FLOORS + extra.vault : undefined);
  const nearFake = (x, y) => map.some((row, fy) => [...row].some((c, fx) => c === '%' && Math.abs(fx - x) + Math.abs(fy - y) <= 2));
  map.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === 'n') meta.notes[key(x, y)] = notes.shift()
      || (nearFake(x, y) ? W.SECRET_HINTS[(x + y) % W.SECRET_HINTS.length] : W.NOTES[extra.zone][(x * 7 + y) % W.NOTES[extra.zone].length]);
    if (ch === '^' && link !== undefined) meta.links[key(x, y)] = link;
    if (ch === 'O' && extra.npc) meta.npcs[key(x, y)] = extra.npc;
  }));
  return { map, meta };
}

const MAPS = [], META = [];
const corruptZone = z => [...W.ZONES[z].roster, W.ZONES[z].boss].some(m => m.corrupt);
W.FLOOR_PLAN.forEach((plan, i) => {
  let out;
  if (plan.map) out = fromHandmade(plan.map, plan);
  else {
    const p = { ...plan, offset: i % 10, corrupt: corruptZone(plan.zone), last: i === W.MAIN_FLOORS - 1 };
    for (let attempt = 0; !out; attempt++) out = generate(p, mulberry32((SEEDS[i] ?? i * 7919) + attempt * 104729));
  }
  MAPS.push(out.map); META.push(out.meta);
});
W.VAULTS.forEach((v, i) => {
  const entrance = W.FLOOR_PLAN.findIndex(p => p.vault === i);
  const out = fromHandmade(v.map, { notes: v.notes, link: entrance });
  MAPS.push(out.map); META.push(out.meta);
});
const entrance = fromHandmade(W.MAP_0F, { notes: W.ENTRANCE_NOTES });
MAPS.push(entrance.map); META.push(entrance.meta);

const body = `'use strict';\n// GENERATED by tools/genmaps.js. Edit world.js / the generator, then regenerate.\nconst MAPS = ${JSON.stringify(MAPS, null, 1)};\nconst MAP_META = ${JSON.stringify(META)};\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'maps.js'), body);
console.log(`wrote ${MAPS.length} floors`);
