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
const BOSS = { T: 14, dr: 0.45, f: 0.45, off: 9, gold: 30, exp: 10, boss: true }; // tuned to the hero who arrives, firmware and all
const ELITE = { T: 10, dr: 0.7, f: 0.14, off: 6, gold: 15, exp: 6 }; // optional 2x2 machines that carry firmware
const BOSS_MARGIN = { hp: 0.85, atk: 0.95, cap: 2.5 }; // cap: tune to at most 2.5x the zone's starting HP, so a hoarder doesn't make a wall
const UPGRADE = [150, 450]; // firmware level II / III, in zone-1 credits (grows like monster gold)
const ITEM = { flood: 0.008, gem: 0.012, gear: 0.1, drill: 0.15, cell: 0.1, bigCell: 0.28, shopHp: 0.35, shopStat: 0.025, poison: 0.001, aura: 0.015 };

// Stats for one monster: DEF and HP set how many swings it takes; ATK is searched so the
// luck-aware fight cost against the reference hero is exactly tier.f of the reference HP.
// The reference hero runs no firmware, so every build meets the same monsters; instead the target is raised by
// the share of fight cost firmware is expected to save by that zone (FIRMWARE), so a typical build pays tier.f.
const FIRMWARE = [0, 0.08, 0.12, 0.22, 0.3, 0.32, 0.3, 0.5, 0.55, 0.55];
function monsterStats(def, tier, z, s, g) {
  const ref = { atk: Math.round(s.atk * (1 + g.atk * tier.off)), def: Math.round(s.def * (1 + g.def * tier.off)), crit: s.crit, agi: s.agi, mods: s.mods, slotted: s.slotted, fx: s.fx };
  const HP = s.hp * (1 + g.hp * tier.off);
  const mdef = Math.round(tier.dr * ref.atk), hd = Math.max(1, ref.atk - mdef);
  const idx = TIERS.indexOf(tier) + 1 || 7;
  const m = {
    hp: tier.T * hd - Math.floor(hd / 2), def: mdef, atk: 0,
    crit: Math.min(20, idx * 2), agi: idx + (def.swift ? 3 : 0),
    gold: Math.round((tier.gold ?? 2 + idx) * GOLD_GROWTH ** z),
    exp: (tier.exp ?? idx) * (z + 1),
    ...(def.aura ? { aura: Math.round(ITEM.aura * s.hp) } : {}),
  };
  const probe = { ...def, ...m }, target = tier.f * HP / (tier.boss ? 1 : 1 - FIRMWARE[z]);
  let lo = def.pierce ? 0 : W.afflicted(ref).def, hi = ref.def + target + 1; // a Breached hero has less DEF to get through
  for (let i = 0; i < 40; i++) { probe.atk = (lo + hi) / 2; W.battleCost(ref, probe) < target ? (lo = probe.atk) : (hi = probe.atk); }
  m.atk = Math.round(lo);
  return m;
}

function calibrateZone(z, s, g) {
  const zone = W.ZONES[z], monsters = {};
  zone.roster.forEach((def, i) => { monsters[i + 1] = monsterStats(def, TIERS[i], z, s, g); });
  monsters[7] = monsterStats(zone.elite, ELITE, z, s, g);
  monsters[9] = monsterStats(zone.boss, BOSS, z, s, g);
  const p = 1.4 ** z, r = (v, k) => Math.max(1, Math.round(v * k)), cr = v => Math.round(v * GOLD_GROWTH ** z);
  return {
    monsters,
    items: {
      a: r(s.atk, ITEM.gem), d: r(s.def, ITEM.gem), h: r(s.hp, ITEM.cell), H: r(s.hp, ITEM.bigCell),
      w: r(s.atk, ITEM.gear), e: r(s.def, ITEM.gear), drill: r(s.atk, ITEM.drill),
      // Tiered chips grow by mark (W.itemTier); the zone implant grows by zone.
      x: 1 + Math.floor(W.itemTier(z) / 2), g: 1 + Math.floor(W.itemTier(z) / 2), o: { crit: 1 + Math.floor(z / 2), agi: 1 + Math.floor(z / 3) },
    },
    poison: Math.max(2, Math.round(s.hp * ITEM.poison)),
    flood: Math.max(1, Math.round(s.hp * ITEM.flood)),
    shop: { hp: r(s.hp, ITEM.shopHp), atk: r(s.atk, ITEM.shopStat), def: r(s.def, ITEM.shopStat), crit: 3, agi: 1, upgrade: [cr(UPGRADE[0]), cr(UPGRADE[1])] },
    broker: { y: Math.round(10 * p), b: Math.round(35 * p), r: Math.round(90 * p), v: Math.round(15 * p), scan: 20, mod: Math.round(60 * p) },
  };
}

// ---- greedy player
const BAL = [];
let zoneStartHp = 1000;
let maps = W.MAPS.slice(0, W.MAIN_FLOORS).map(m => m.map(r => [...r]));
const zoneOf = f => Math.floor(f / ZONE_FLOORS);
const monsterAt = (f, ch) => ({ ...W.zoneMonster(zoneOf(f), ch), ...BAL[zoneOf(f)].monsters[ch], boss: ch === '9' });
const isMonster = ch => /[1-79]/.test(ch);
const find = (f, ch) => { for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (maps[f][y][x] === ch) return [x, y]; };
let hero = { ...structuredClone(W.HERO_START), buys: 0, antivirus: 0, corrupt: false };
hero.pos = [0, ...find(0, 'D')];
maps[0][hero.pos[2]][hero.pos[1]] = '.';

function gainExp(e) {
  hero.exp += e;
  while (hero.exp >= W.expToNext(hero.lv)) {
    const gain = W.levelGain(hero.lv++, hero);
    for (const k in gain) hero[k] += gain[k];
  }
}
// Field damage lands on every step beside the machine (about twice per fight); corruption runs its full course.
const fightCost = (f, m) => { const k = W.kit(hero); return W.battleCost(hero, m) + (m.aura || 0) * k.field * 2
  + (m.corrupt && !k.clean && hero.corrupt !== f && !hero.antivirus ? BAL[zoneOf(f)].poison * W.STATUS_STEPS : 0); };

// The simulated player's taste in firmware: slots the best it owns, and upgrades slotted ones first.
const MOD_TASTE = ['exploit', 'multithread', 'checksum', 'backprop', 'overclock', 'cache', 'dropout', 'faraday', 'prefetch', 'sandbox', 'scavenger', 'compiler'];
function takeMod(id) {
  hero.mods[id] = 1;
  hero.slotted = MOD_TASTE.filter(m => hero.mods[m]).slice(0, hero.slots);
}
function upgradeMod(f) {
  const id = hero.slotted.find(m => hero.mods[m] < W.MODS[m].lv.length), cost = id && BAL[zoneOf(f)].shop.upgrade[hero.mods[id] - 1];
  if (!id || hero.gold < cost) return false;
  hero.gold -= cost; hero.mods[id]++;
  return true;
}

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
      if (seen.has(k) || '#%OLD^z=&'.includes(c)) continue;
      seen.add(k);
      if (c === 'U') { up = [nx, ny]; continue; } // touching stairs changes floor; you can't walk through them
      if (isMonster(c) || W.DOORS[c] || 'SMkj!'.includes(c)) { frontier.push([f, nx, ny, c]); continue; }
      q.push([f, nx, ny]);
    }
  }
  return { seen, frontier, up };
}

function pickUp(f, ch) {
  const it = W.ITEMS[ch], v = BAL[zoneOf(f)].items;
  if (!it || it.kind === 'compass' || it.kind === 'shard') return false;
  if (it.kind === 'key') hero.keys[it.key]++;
  else if (['hp', 'atk', 'def', 'crit', 'agi'].includes(it.kind)) hero[it.kind] += v[ch];
  else if (it.kind === 'implant') { hero.crit += v.o.crit; hero.agi += v.o.agi; }
  else if (it.kind === 'antivirus') { if (hero.corrupt === f) hero.corrupt = false; else hero.antivirus++; }
  return true;
}

// A realistic player: climbs floor by floor, takes cheap fights, prefers doors toward the stairs,
// skips costly optional fights once the stairs are open, and only backtracks to spend credits.
const SHOP_CYCLE = ['atk', 'def', 'hp'];
let log = [];
const visited = new Set([0]);
const reachable = f => f === hero.pos[0] || !W.ABANDONED.has(f); // the Phase Compass can't reach abandoned floors
function buyFabricator() {
  const fab = [...visited].reverse().find(f => reachable(f) && maps[f].some(r => r.includes('S')));
  if (fab === undefined) return false;
  if (upgradeMod(fab)) return true;
  if (hero.gold < W.fabricatorCost(hero.buys)) return false;
  const k = SHOP_CYCLE[hero.buys % SHOP_CYCLE.length];
  hero.gold -= W.fabricatorCost(hero.buys++);
  hero[k] += BAL[zoneOf(fab)].shop[k];
  return true;
}
const wet = new Set(), levers = {}; // water already waded through; lever pulls per floor
const floorCells = (f, ch) => maps[f].flatMap((row, y) => row.flatMap((c, x) => (c === ch ? [[x, y]] : [])));
function play(cap) {
  for (let guard = 0; guard < 20000; guard++) {
    const { seen, frontier, up } = region();
    const f0 = hero.pos[0];
    if (frontier.some(fr => fr[3] === 'k')) { floorCells(f0, '~').forEach(([x, y]) => { maps[f0][y][x] = '.'; }); maps[f0].forEach(r => r.forEach((c, x) => { if (c === 'k') r[x] = '#'; })); continue; }
    for (const k of seen) { // each flooded cell costs one wade
      const [f, x, y] = k.split(',').map(Number);
      if (maps[f][y][x] === '~' && !wet.has(k)) { wet.add(k); hero.hp -= BAL[zoneOf(f)].flood; }
    }
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
    const elite = mons.find(o => o.m.drop && o.c < hero.hp * 0.4); // firmware is worth a hard fight
    if (mons.length && mons[0].c < hero.hp * 0.12 && !mons[0].m.boss) pick = mons[0];
    else if (elite) pick = elite;
    else if (doors.length) { const d = doors[0]; hero.keys[W.DOORS[d[3]]]--; maps[d[0]][d[2]][d[1]] = '.'; continue; }
    else if (mons.length && mons[0].c < hero.hp * 0.8 && (!up || mons[0].c < hero.hp * 0.25)) pick = mons[0];
    else if (up) {
      const nf = hero.pos[0] + 1;
      if (nf > cap) return { stuck: 'boss floor exit without boss' };
      if (process.env.FLOORS) log.push(`  F${nf} done: hp ${hero.hp} atk ${hero.atk} def ${hero.def} crit ${hero.crit} agi ${hero.agi} lv ${hero.lv} gold ${hero.gold} fw ${hero.slotted.map(id => id + hero.mods[id])}`);
      hero.pos = [nf, ...find(nf, 'D')];
      hero.fx = Object.fromEntries(Object.entries(hero.fx).map(([k, n]) => [k, n - 1]));
      visited.add(nf);
      continue;
    } else {
      // Out of options: pull a lever (a few times at most), or trip an alarm and fight what wakes.
      const lever = frontier.find(fr => fr[3] === 'j'), alarm = frontier.find(fr => fr[3] === '!');
      if (lever && (levers[f0] = (levers[f0] || 0) + 1) <= 3) { maps[f0].forEach(r => r.forEach((c, x) => { if (W.GATE_SWAP[c]) r[x] = W.GATE_SWAP[c]; })); continue; }
      if (alarm) {
        maps[f0][alarm[2]][alarm[1]] = '.';
        W.podsWaking(maps[f0], alarm[1], alarm[2], (x, y) => maps[f0][y]?.[x] === '.').forEach(([px, py, ox, oy]) => { maps[f0][py][px] = '#'; maps[f0][oy][ox] = '2'; });
        continue;
      }
      if (buyFabricator()) continue;
      const brokerF = [...visited].reverse().find(f => reachable(f) && maps[f].some(r => r.includes('M')));
      const price = brokerF !== undefined && BAL[zoneOf(brokerF)].broker.y;
      if (price && hero.gold >= price && frontier.some(fr => fr[3] === 'Y')) { hero.gold -= price; hero.keys.y++; continue; }
      return { stuck: `F${hero.pos[0] + 1} hp ${hero.hp}: ` + (mons.slice(0, 3).map(o => `${o.m.name} ${o.c}`).join(' | ') || 'no frontier') };
    }
    let { fr, m, c } = pick;
    if (m.boss && !BAL[zoneOf(fr[0])].bossTuned) {
      const z = zoneOf(fr[0]);
      // The boss is tuned to the hero who actually reaches it (a bit weaker, for margin).
      BAL[z].monsters[9] = monsterStats(W.ZONES[z].boss, { ...BOSS, off: 0 }, z, { ...hero, hp: Math.min(hero.hp, zoneStartHp * BOSS_MARGIN.cap) * BOSS_MARGIN.hp, atk: Math.round(hero.atk * BOSS_MARGIN.atk) }, { atk: 0, def: 0, hp: 0 });
      BAL[z].bossTuned = true;
      m = monsterAt(fr[0], fr[3]);
      c = fightCost(fr[0], m);
      if (c >= hero.hp) return { stuck: `boss ${m.name} costs ${c} > hp ${hero.hp}` };
    }
    hero.hp -= c;
    if (process.env.TRACE) console.log(`F${fr[0] + 1} ${m.name} -${c} hp ${hero.hp} atk ${hero.atk} def ${hero.def}`);
    const k = W.kit(hero);
    // Corruption is one status that re-infection only refreshes: roughly one dose of poison per floor.
    if (m.corrupt && !k.clean && hero.corrupt !== fr[0]) { if (hero.antivirus) hero.antivirus--; else hero.corrupt = fr[0]; }
    hero.gold += Math.round(m.gold * k.gold);
    gainExp(Math.round(m.exp * k.exp));
    const [ax, ay] = W.bodyAnchor(maps[fr[0]], fr[1], fr[2]);
    W.bodyCells(ax, ay, W.bodySize(fr[3])).forEach(([x, y]) => { maps[fr[0]][y][x] = '.'; });
    if (m.rollback) maps[fr[0]][ay][ax] = String(m.rollback);
    if (m.drop) takeMod(m.drop);
    Object.keys(W.STATUS).forEach(st => { if (m[st]) hero.fx[st] = 2; }); // Breach / Throttle / Lag: this floor and the next
    if (m.slot) { hero.slots++; hero.slotted = MOD_TASTE.filter(id => hero.mods[id]).slice(0, hero.slots); }
    if (m.boss) log.push(`  boss F${fr[0] + 1} ${m.name}: cost ${c} of ${hero.hp + c} hp (${Math.round((100 * c) / (hero.hp + c))}%)`);
    if (m.boss && fr[0] === cap) {
      // Step onto the next zone's first floor.
      if (cap + 1 < W.MAIN_FLOORS) { hero.pos = [cap + 1, ...find(cap + 1, 'D')]; hero.fx = Object.fromEntries(Object.entries(hero.fx).map(([k, n]) => [k, n - 1])); visited.add(cap + 1); }
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
  zoneStartHp = start.hp;
  const snapshot = { hero: structuredClone(hero), maps: maps.map(m => m.map(r => [...r])), visited: new Set(visited) };
  let g = { atk: 0.045, def: 0.045, hp: 0.02 }, result, good = null;
  for (let pass = 0; pass < 8; pass++) {
    hero = structuredClone(snapshot.hero);
    maps = snapshot.maps.map(m => m.map(r => [...r]));
    visited.clear(); snapshot.visited.forEach(v => visited.add(v));
    wet.clear(); Object.keys(levers).forEach(k => delete levers[k]);
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
  // How much the slotted firmware saves on this zone's tiers, against the same hero without it.
  const tiers = [1, 2, 3, 4, 5, 6].map(t => ({ ...W.zoneMonster(z, String(t)), ...BAL[z].monsters[t] })).filter(m => W.battleCost(hero, m) < Infinity);
  const saving = 1 - tiers.reduce((a, m) => a + W.battleCost(hero, m), 0) / tiers.reduce((a, m) => a + W.battleCost({ ...hero, slotted: [] }, m), 0);
  log.push(`  firmware ${hero.slotted.map(id => id + hero.mods[id]).join(' ')}  saves ${Math.round(saving * 100)}%`);
  report.push(...log, `zone ${String(z + 1).padStart(2)} ${W.ZONES[z].name.padEnd(24)} hp(ref) ${start.hp}->${hero.hp}  atk ${start.atk}->${hero.atk}  def ${start.def}->${hero.def}  lv ${hero.lv}  gold ${hero.gold}  keys ${JSON.stringify(hero.keys)}`);
  if (!result.done) { ok = false; report.push(`  STUCK: ${result.stuck}`); }
}
if (!quiet) console.log(report.join('\n'));

const header = `'use strict';\n// GENERATED by tools/calibrate.js from a simulated playthrough. Do not edit by hand.\n`;
fs.writeFileSync(path.join(__dirname, '..', 'js', 'balance.js'), `${header}const BALANCE = ${JSON.stringify(BAL)};\n`);
console.log(ok ? 'balanced: all 10 zones cleared' : 'NOT balanced');
process.exitCode = ok ? 0 : 1;
