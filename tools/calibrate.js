// Balances the tower. For each zone: derive monster stats and item values from the hero's
// simulated state at the zone's start, greedily play the zone, measure how fast the hero actually
// grew, and repeat until the tuning is self-consistent. Writes js/balance.js.
// Usage: node tools/calibrate.js [--quiet]
const fs = require('fs'), path = require('path');
const load = require('./load');
const W = load(['data.js', 'world.js', 'maps.js']);
const quiet = process.argv.includes('--quiet');
const N = 11, ZONE_FLOORS = 10;

// ---- tuning knobs (fractions of the hero's stats at zone start)
const GOLD_GROWTH = 1.45;
const TIERS = [ // hits to kill, DEF as share of hero ATK, fight cost as share of hero HP, floor it's tuned for
  { T: 3, dr: 0.3, f: 0.021, off: 0 },
  { T: 4, dr: 0.4, f: 0.032, off: 1 },
  { T: 5, dr: 0.5, f: 0.042, off: 3 },
  { T: 6, dr: 0.55, f: 0.052, off: 4 },
  { T: 7, dr: 0.65, f: 0.062, off: 6 },
  { T: 9, dr: 0.75, f: 0.08, off: 8 },
];
const BOSS = { T: 14, dr: 0.45, f: 0.45, off: 9 };
const BOSS_MARGIN = { hp: 0.85, atk: 0.95 };
const ITEM = { gem: 0.012, gear: 0.1, drill: 0.15, cell: 0.1, bigCell: 0.28, shopHp: 0.35, shopStat: 0.025, poison: 0.001, aura: 0.015 };

// Stats for one monster: DEF and HP set how many swings it takes; ATK is searched so the
// luck-aware fight cost against the reference hero is exactly tier.f of the reference HP.
function monsterStats(def, tier, z, s, g) {
  const ref = { atk: Math.round(s.atk * (1 + g.atk * tier.off)), def: Math.round(s.def * (1 + g.def * tier.off)), crit: s.crit, agi: s.agi };
  const HP = s.hp * (1 + g.hp * tier.off);
  const mdef = Math.round(tier.dr * ref.atk), hd = Math.max(1, ref.atk - mdef);
  const idx = TIERS.indexOf(tier) + 1 || 7;
  const m = {
    hp: tier.T * hd - Math.floor(hd / 2), def: mdef, atk: 0,
    crit: Math.min(20, idx * 2), agi: idx + (def.swift ? 3 : 0),
    gold: Math.round((idx === 7 ? 30 : 2 + idx) * GOLD_GROWTH ** z),
    exp: (idx === 7 ? 10 : idx) * (z + 1),
    ...(def.aura ? { aura: Math.round(ITEM.aura * s.hp) } : {}),
  };
  const probe = { ...def, ...m }, target = tier.f * HP;
  let lo = def.pierce ? 0 : ref.def, hi = ref.def + target + 1;
  for (let i = 0; i < 40; i++) { probe.atk = (lo + hi) / 2; W.battleCost(ref, probe) < target ? (lo = probe.atk) : (hi = probe.atk); }
  m.atk = Math.round(lo);
  return m;
}

function calibrateZone(z, s, g) {
  const zone = W.ZONES[z], monsters = {};
  zone.roster.forEach((def, i) => { monsters[i + 1] = monsterStats(def, TIERS[i], z, s, g); });
  monsters[9] = monsterStats(zone.boss, BOSS, z, s, g);
  const p = 1.4 ** z, r = (v, k) => Math.max(1, Math.round(v * k));
  return {
    monsters,
    items: {
      a: r(s.atk, ITEM.gem), d: r(s.def, ITEM.gem), h: r(s.hp, ITEM.cell), H: r(s.hp, ITEM.bigCell),
      w: r(s.atk, ITEM.gear), e: r(s.def, ITEM.gear), drill: r(s.atk, ITEM.drill),
    },
    poison: Math.max(2, Math.round(s.hp * ITEM.poison)),
    shop: { hp: r(s.hp, ITEM.shopHp), atk: r(s.atk, ITEM.shopStat), def: r(s.def, ITEM.shopStat) },
    broker: { y: Math.round(10 * p), b: Math.round(35 * p), r: Math.round(90 * p), v: Math.round(15 * p), scan: 20 },
  };
}

// ---- greedy player
const BAL = [];
let maps = W.MAPS.slice(0, W.MAIN_FLOORS).map(m => m.map(r => [...r]));
const zoneOf = f => Math.floor(f / ZONE_FLOORS);
const monsterAt = (f, ch) => ({ ...W.zoneMonster(zoneOf(f), ch), ...BAL[zoneOf(f)].monsters[ch] });
const isMonster = ch => /[1-69]/.test(ch);
const find = (f, ch) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (maps[f][y][x] === ch) return [x, y]; };
let hero = { ...structuredClone(W.HERO_START), buys: 0, antivirus: 0, corrupt: false };
hero.pos = [0, ...find(0, 'P')];
maps[0][hero.pos[2]][hero.pos[1]] = '.';

function gainExp(e) {
  hero.exp += e;
  while (hero.exp >= W.expToNext(hero.lv)) {
    const gain = W.levelGain(hero.lv++, hero);
    for (const k in gain) hero[k] += gain[k];
  }
}
const fightCost = (f, m) => W.battleCost(hero, m) + (m.aura || 0)
  + (m.corrupt && !hero.corrupt && !hero.antivirus ? BAL[zoneOf(f)].poison * 30 : 0);

// What the hero can reach on the current floor without fighting or opening anything.
function region() {
  const [f] = hero.pos, seen = new Set([hero.pos.join()]), q = [hero.pos], frontier = [];
  let up = null;
  while (q.length) {
    const [, x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const c = maps[f][ny][nx], k = [f, nx, ny].join();
      if (seen.has(k) || c === '#' || c === '%' || c === 'O' || c === 'L' || c === 'D' || c === '^') continue;
      seen.add(k);
      if (c === 'U') { up = [nx, ny]; continue; } // touching stairs changes floor; you can't walk through them
      if (isMonster(c) || W.DOORS[c] || c === 'S' || c === 'M') { frontier.push([f, nx, ny, c]); continue; }
      q.push([f, nx, ny]);
    }
  }
  return { seen, frontier, up };
}

function pickUp(f, ch) {
  const it = W.ITEMS[ch], v = BAL[zoneOf(f)].items;
  if (!it || it.kind === 'compass' || it.kind === 'shard') return false;
  if (it.kind === 'key') hero.keys[it.key]++;
  else if (it.kind === 'hp' || it.kind === 'atk' || it.kind === 'def') hero[it.kind] += v[ch];
  else if (it.kind === 'antivirus') { if (hero.corrupt) hero.corrupt = false; else hero.antivirus++; }
  return true;
}

// A realistic player: climbs floor by floor, takes cheap fights, prefers doors toward the stairs,
// skips costly optional fights once the stairs are open, and only backtracks to spend credits.
const SHOP_CYCLE = ['atk', 'def', 'hp'];
let log = [];
const visited = new Set([0]);
function buyFabricator() {
  const fab = [...visited].reverse().find(f => maps[f].some(r => r.includes('S')));
  if (fab === undefined || hero.gold < W.fabricatorCost(hero.buys)) return false;
  const k = SHOP_CYCLE[hero.buys % SHOP_CYCLE.length];
  hero.gold -= W.fabricatorCost(hero.buys++);
  hero[k] += BAL[zoneOf(fab)].shop[k];
  return true;
}
function play(cap) {
  for (let guard = 0; guard < 20000; guard++) {
    const { seen, frontier, up } = region();
    let got = false;
    for (const k of seen) {
      const [f, x, y] = k.split(',').map(Number);
      if (pickUp(f, maps[f][y][x])) { maps[f][y][x] = '.'; got = true; }
    }
    if (got) continue;
    if (frontier.some(fr => fr[3] === 'S') && buyFabricator()) continue;
    const mons = frontier.filter(fr => isMonster(fr[3])).map(fr => ({ fr, m: monsterAt(fr[0], fr[3]) }))
      .map(o => ({ ...o, c: fightCost(o.fr[0], o.m) })).sort((a, b) => a.c - b.c);
    const target = up || find(hero.pos[0], 'U') || [5, 5], dist = fr => Math.abs(fr[1] - target[0]) + Math.abs(fr[2] - target[1]);
    const doors = frontier.filter(fr => W.DOORS[fr[3]] && hero.keys[W.DOORS[fr[3]]] > 0).sort((a, b) => dist(a) - dist(b));
    let pick = null;
    if (mons.length && mons[0].c < hero.hp * 0.12 && !mons[0].m.surge) pick = mons[0];
    else if (doors.length) { const d = doors[0]; hero.keys[W.DOORS[d[3]]]--; maps[d[0]][d[2]][d[1]] = '.'; continue; }
    else if (mons.length && mons[0].c < hero.hp * 0.8 && (!up || mons[0].c < hero.hp * 0.25)) pick = mons[0];
    else if (up) {
      const nf = hero.pos[0] + 1;
      if (nf > cap) return { stuck: 'boss floor exit without boss' };
      hero.pos = [nf, ...find(nf, 'D')];
      visited.add(nf);
      continue;
    } else {
      if (buyFabricator()) continue;
      const brokerF = [...visited].reverse().find(f => maps[f].some(r => r.includes('M')));
      const price = brokerF !== undefined && BAL[zoneOf(brokerF)].broker.y;
      if (price && hero.gold >= price && frontier.some(fr => fr[3] === 'Y')) { hero.gold -= price; hero.keys.y++; continue; }
      return { stuck: `F${hero.pos[0] + 1} hp ${hero.hp}: ` + (mons.slice(0, 3).map(o => `${o.m.name} ${o.c}`).join(' | ') || 'no frontier') };
    }
    let { fr, m, c } = pick;
    if (m.surge && !BAL[zoneOf(fr[0])].bossTuned) {
      const z = zoneOf(fr[0]);
      // The boss is tuned to the hero who actually reaches it (a bit weaker, for margin).
      BAL[z].monsters[9] = monsterStats(W.ZONES[z].boss, { ...BOSS, off: 0 }, z, { ...hero, hp: hero.hp * BOSS_MARGIN.hp, atk: Math.round(hero.atk * BOSS_MARGIN.atk) }, { atk: 0, def: 0, hp: 0 });
      BAL[z].bossTuned = true;
      m = monsterAt(fr[0], fr[3]);
      c = fightCost(fr[0], m);
      if (c >= hero.hp) return { stuck: `boss ${m.name} costs ${c} > hp ${hero.hp}` };
    }
    hero.hp -= c;
    if (process.env.TRACE) console.log(`F${fr[0] + 1} ${m.name} -${c} hp ${hero.hp} atk ${hero.atk} def ${hero.def}`);
    if (m.corrupt && !hero.corrupt && hero.antivirus) hero.antivirus--;
    hero.gold += m.gold;
    gainExp(m.exp);
    maps[fr[0]][fr[2]][fr[1]] = '.';
    if (m.surge) log.push(`  boss F${fr[0] + 1} ${m.name}: cost ${c} of ${hero.hp + c} hp (${Math.round((100 * c) / (hero.hp + c))}%)`);
    if (m.surge && fr[0] === cap) {
      // Step onto the next zone's first floor.
      if (cap + 1 < W.MAIN_FLOORS) { hero.pos = [cap + 1, ...find(cap + 1, 'D')]; visited.add(cap + 1); }
      return { done: true };
    }
  }
  return { stuck: 'loop guard' };
}

const report = [];
let ok = true;
for (let z = 0; z < W.ZONES.length && ok; z++) {
  // Damage and healing scale with the hero's HP at zone start, so every zone plays at the same relative difficulty.
  const start = { hp: Math.max(hero.hp, 500), atk: hero.atk, def: hero.def, crit: hero.crit, agi: hero.agi };
  const snapshot = { hero: structuredClone(hero), maps: maps.map(m => m.map(r => [...r])), visited: new Set(visited) };
  let g = { atk: 0.045, def: 0.045, hp: 0.02 }, result, good = null;
  for (let pass = 0; pass < 8; pass++) {
    hero = structuredClone(snapshot.hero);
    maps = snapshot.maps.map(m => m.map(r => [...r]));
    visited.clear(); snapshot.visited.forEach(v => visited.add(v));
    log = [];
    BAL[z] = calibrateZone(z, start, g);
    result = play(z * ZONE_FLOORS + ZONE_FLOORS - 1);
    if (!result.done) { g = { atk: g.atk * 0.6, def: g.def * 0.6, hp: g.hp * 0.6 }; continue; }
    good = { bal: BAL[z], hero: structuredClone(hero), maps: maps.map(m => m.map(r => [...r])), log };
    const next = { atk: (hero.atk / start.atk - 1) / 10, def: (hero.def / start.def - 1) / 10, hp: 0.02 };
    if (Math.abs(next.atk - g.atk) < 0.004 && Math.abs(next.def - g.def) < 0.004) break;
    g = { atk: (g.atk + next.atk) / 2, def: (g.def + next.def) / 2, hp: (g.hp + next.hp) / 2 };
  }
  if (good) ({ bal: BAL[z], hero, maps, log } = good), result = { done: true };
  report.push(...log, `zone ${String(z + 1).padStart(2)} ${W.ZONES[z].name.padEnd(24)} hp(ref) ${start.hp}->${hero.hp}  atk ${start.atk}->${hero.atk}  def ${start.def}->${hero.def}  lv ${hero.lv}  gold ${hero.gold}  keys ${JSON.stringify(hero.keys)}`);
  if (!result.done) { ok = false; report.push(`  STUCK: ${result.stuck}`); }
}
if (!quiet) console.log(report.join('\n'));

const header = `'use strict';\n// GENERATED by tools/calibrate.js from a simulated playthrough. Do not edit by hand.\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'balance.js'), `${header}const BALANCE = ${JSON.stringify(BAL)};\n`);
console.log(ok ? 'balanced: all 10 zones cleared' : 'NOT balanced');
process.exitCode = ok ? 0 : 1;
