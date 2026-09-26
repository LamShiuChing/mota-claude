// Checks every floor in js/maps.js: tokens, stairs rules, specials from FLOOR_PLAN, reachability, and
// (for authored floors) that no order of opening shutters can strand the player before the goal.
// Usage: node tools/checkmaps.js [--all] [floor...]   (--all also prints generated-floor softlocks)
const load = require('./load');
const W = load(['data.js', 'world.js', 'maps.js']);
const N = 11, DIRS = [[0, -1], [0, 1], [1, 0], [-1, 0]]; // the order changeFloor tries for the arrival spot
const TOKENS = new Set('#.%UD^PSMOLnybrYBRhHadwevc*1234569');
const BLOCK = new Set('#%UD^OSML'), KEYS = { Y: 'y', B: 'b', R: 'r' };
const args = process.argv.slice(2), all = args.includes('--all'), only = args.filter(a => /^\d+$/.test(a)).map(Number);
const at = (m, x, y) => (x < 0 || y < 0 || x >= N || y >= N ? '#' : m[y][x]);
const find = (m, ch) => { const r = []; m.forEach((row, y) => [...row].forEach((c, x) => c === ch && r.push([x, y]))); return r; };
const arrival = (m, [sx, sy]) => DIRS.map(([dx, dy]) => [sx + dx, sy + dy]).find(([x, y]) => at(m, x, y) === '.');

// Flood from start. Monsters are passable (fights are the calibrator's business); doors pass only when opened.
function flood(m, start, opened, { secret = false, wall = '' } = {}) {
  const seen = new Set([start.join()]), q = [start], touch = new Set(), doors = new Set();
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy, k = nx + ',' + ny, c = at(m, nx, ny);
      if (seen.has(k) || c === '#' || wall.includes(c)) continue;
      if (KEYS[c] && !opened.has(k)) { doors.add(k); continue; }
      if (c === '%' && !secret) continue;
      if (BLOCK.has(c) && c !== '%') { touch.add(c); continue; }
      seen.add(k); q.push([nx, ny]);
    }
  }
  return { seen, touch, doors };
}

function check(f) {
  const m = W.MAPS[f], plan = W.FLOOR_PLAN[f] || {}, meta = W.MAP_META[f], errs = [], warns = [];
  const entrance = f === W.ENTRANCE, vault = f >= W.MAIN_FLOORS && !entrance, o = f % 10, boss = !vault && !entrance && o === 9;
  const authored = vault || entrance || !!plan.map;
  const strict = authored && f > 2; // 1F-3F predate these rules: their stairs and key counts are only reported
  if (m.length !== N || m.some(r => r.length !== N)) return { errs: ['not 11x11'], warns };
  for (const ch of m.join('')) if (!TOKENS.has(ch)) errs.push(`bad token ${ch}`);
  const count = ch => find(m, ch).length;
  const need = (ch, n) => count(ch) !== n && errs.push(`expected ${n} '${ch}', found ${count(ch)}`);
  if (vault) { need('^', 1); need('*', 1); need('U', 0); need('D', 0); }
  else {
    need('D', entrance ? 0 : 1); need('P', entrance ? 1 : 0);
    need(f === W.MAIN_FLOORS - 1 ? 'L' : 'U', 1);
    need('9', boss ? 1 : 0);
    for (const t of plan.place || []) if (!count(t)) errs.push(`plan wants '${t}'`);
    if (plan.npc && !Object.values(meta.npcs).includes(plan.npc)) errs.push(`npc ${plan.npc} missing`);
    if (plan.vault !== undefined) need('^', 1);
  }
  for (const [x, y] of find(m, 'O')) if (!meta.npcs[x + ',' + y]) errs.push(`O at ${x},${y} has no npc id`);
  for (const [x, y] of find(m, 'n')) if (!meta.notes[x + ',' + y]) errs.push(`n at ${x},${y} has no text`);
  // Floor lore shows on the first ordinary note, so every authored main floor needs one away from fake walls.
  const nearFake = (x, y) => find(m, '%').some(([fx, fy]) => Math.abs(fx - x) + Math.abs(fy - y) <= 2);
  if (authored && !vault && !find(m, 'n').some(([x, y]) => !nearFake(x, y))) errs.push('no ordinary note (floor lore needs one)');
  for (const [x, y] of find(m, '^')) if (meta.links[x + ',' + y] === undefined) errs.push(`^ at ${x},${y} has no link`);

  // Stairs trigger on touch: they need a floor tile to arrive on, no doorway next to them, and a nook.
  for (const s of ['U', 'D', '^']) for (const [x, y] of find(m, s)) {
    const nb = DIRS.map(([dx, dy]) => at(m, x + dx, y + dy));
    // On a boss floor the Warden-side stairs open onto the boss's tile, which is floor once it falls.
    const landing = DIRS.some(([dx, dy]) => at(m, x + dx, y + dy) === '.' || (boss && s === 'U' && at(m, x + dx, y + dy) === '9'));
    if (!landing) errs.push(`${s} at ${x},${y}: no floor tile to arrive on`);
    if (nb.some(c => KEYS[c] || c === '%') && s !== '^') errs.push(`${s} at ${x},${y}: next to a doorway`);
    if (nb.filter(c => c !== '#').length > 2) (strict ? errs : warns).push(`${s} at ${x},${y}: open on ${nb.filter(c => c !== '#').length} sides`);
  }

  const startTile = entrance ? find(m, 'P')[0] : find(m, vault ? '^' : 'D')[0];
  const start = entrance ? startTile : startTile && arrival(m, startTile);
  if (!start) return { errs: [...errs, 'no start'], warns };
  const goalTile = vault ? '*' : f === W.MAIN_FLOORS - 1 ? 'L' : 'U';
  const reached = (r, gm) => (goalTile === '*' ? [...r.seen].some(k => { const [x, y] = k.split(',').map(Number); return gm[y][x] === '*'; }) : r.touch.has(goalTile));

  // Everything must be reachable once every door and fake wall is open.
  const everything = flood(m, start, new Set(find(m, 'Y').concat(find(m, 'B'), find(m, 'R')).map(p => p.join())), { secret: true });
  m.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '#' || c === '%' || everything.seen.has(x + ',' + y)) return;
    const adj = DIRS.some(([dx, dy]) => everything.seen.has(x + dx + ',' + (y + dy)));
    if (!BLOCK.has(c) || !adj) errs.push(`unreachable ${c} at ${x},${y}`);
  }));
  if (boss) { // the boss must stand between the player and the way up
    const r = flood(m, start, new Set(find(m, 'Y').concat(find(m, 'B'), find(m, 'R')).map(p => p.join())), { secret: true, wall: '9' });
    if (reached(r, m)) errs.push('exit reachable without fighting the boss');
  }

  // Every state reachable by opening shutters in any order (starting with no keys) must still lead to the goal.
  const memo = new Map();
  const keysIn = (seen, opened) => {
    const k = { y: 0, b: 0, r: 0 };
    for (const s of seen) { const [x, y] = s.split(',').map(Number); const c = m[y][x]; if (c in k) k[c]++; }
    for (const s of opened) { const [x, y] = s.split(',').map(Number); k[KEYS[m[y][x]]]--; }
    return k;
  };
  let states = 0, stuck = null;
  const good = opened => {
    const id = [...opened].sort().join(';');
    if (memo.has(id)) return memo.get(id);
    states++;
    const r = flood(m, start, opened, { secret: vault }), keys = keysIn(r.seen, opened); // a vault may hide its shard
    let ok = reached(r, m);
    for (const d of r.doors) {
      const [x, y] = d.split(',').map(Number);
      if (keys[KEYS[m[y][x]]] > 0 && good(new Set([...opened, d]))) ok = true;
    }
    if (!ok && !stuck) stuck = [...opened].map(s => { const [x, y] = s.split(',').map(Number); return `${m[y][x]}@${s}`; }).join(' ') || '(start)';
    memo.set(id, ok);
    return ok;
  };
  if (!good(new Set())) errs.push('goal unreachable');
  else if (stuck) (strict ? errs : warns).push(`softlock after opening ${stuck}`);
  return { errs, warns, states };
}

const offsetTiers = o => { const lo = Math.min(4, 1 + Math.floor(o * 0.45)); return [lo, Math.min(6, lo + 2)]; };
let bad = 0, authoredCount = 0, softGen = 0;
W.MAPS.forEach((m, f) => {
  if (only.length && !only.includes(f + 1)) return;
  const plan = W.FLOOR_PLAN[f] || {}, authored = f >= W.MAIN_FLOORS || !!plan.map;
  const { errs, warns } = check(f);
  if (authored) authoredCount++;
  if (!authored && warns.some(w => w.startsWith('softlock'))) softGen++;
  const name = f === W.ENTRANCE ? '0F' : f >= W.MAIN_FLOORS ? `vault ${f - W.MAIN_FLOORS + 1}` : `${f + 1}F`;
  if (authored || only.length) {
    const s = m.join(''), c = ch => [...s].filter(x => x === ch).length, mons = [...s].filter(x => /[1-6]/.test(x));
    const [lo, hi] = offsetTiers(f % 10);
    const odd = f < W.MAIN_FLOORS && f % 10 < 9 ? mons.filter(t => t < lo - 1 || t > hi + 1).length : 0;
    console.log(`${name.padEnd(8)} ${errs.length ? 'FAIL' : 'ok  '} mon ${String(mons.length).padStart(2)} tiers ${[...new Set(mons)].sort().join('')}${odd ? ' (' + odd + ' off-band)' : ''}  a${c('a')} d${c('d')} h${c('h')} H${c('H')}  y${c('y')}/Y${c('Y')} b${c('b')}/B${c('B')} r${c('r')}/R${c('R')} %${c('%')}`);
  }
  if (errs.length) { bad++; errs.forEach(e => console.log(`  ${name} ERROR ${e}`)); }
  if (all || authored) warns.forEach(w => console.log(`  ${name} warn ${w}`));
});
console.log(`${authoredCount} authored floors checked; ${softGen} generated floors can be softlocked by key misuse (Broker sells keys)`);
console.log(bad ? `${bad} floors FAILED` : 'all floors ok');
process.exitCode = bad ? 1 : 0;
