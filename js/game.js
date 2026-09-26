'use strict';
// STRATUM engine: grid tower RPG laid out like the 2005 新新魔塔. Content comes from data.js.

const TS = 32, N = 11, MW = N * TS, W = 576, H = 432;
const MX = 192, MY = 48;                       // map origin
const FONT = '"Press Start 2P", monospace', BODY = '"VT323", monospace';
const CYAN = '#1ea4d4', MOVE_TIME = 0.1, SAVE_KEY = 'stratum-save-v3', CORRUPT_STEPS = 60;
const cv = document.getElementById('game'), ctx = cv.getContext('2d');
let scale = 1;

// ---------------------------------------------------------------- sprites
const spriteCache = {};
function buildSprite(rows, swap = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 16;
  const g = c.getContext('2d');
  const at = (x, y) => (rows[y] || '')[x] || '.';
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
    const ch = at(x, y);
    const edge = ch === '.' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at(x + dx, y + dy) !== '.');
    if (ch === '.' && !edge) continue;
    g.fillStyle = edge ? PAL.k : PAL[swap[ch] || ch];
    g.fillRect(x, y, 1, 1);
  }
  return c;
}
function sprite(name) {
  if (!spriteCache[name]) {
    const v = VARIANTS[name];
    spriteCache[name] = v ? buildSprite(SPRITES[v[0]], v[1]) : buildSprite(SPRITES[name]);
  }
  return spriteCache[name];
}
// Cache key for a monster/NPC definition, building its palette-swapped sprite on first use.
function spriteKey(def) {
  if (!def.swap) return def.sprite;
  const key = def.sprite + JSON.stringify(def.swap);
  if (!spriteCache[key]) {
    const v = VARIANTS[def.sprite];
    spriteCache[key] = buildSprite(SPRITES[v ? v[0] : def.sprite], { ...(v ? v[1] : {}), ...def.swap });
  }
  return key;
}
function whiteSprite(name) {
  const key = name + '#w';
  if (!spriteCache[key]) {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d');
    g.drawImage(sprite(name), 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#fff';
    g.fillRect(0, 0, 16, 16);
    spriteCache[key] = c;
  }
  return spriteCache[key];
}
// Opaque pixels of a sprite, used to shatter enemies into particles.
function spritePixels(name) {
  const d = sprite(name).getContext('2d').getImageData(0, 0, 16, 16).data, out = [];
  for (let i = 0; i < 256; i++) if (d[i * 4 + 3]) out.push({ x: i % 16, y: i >> 4, color: `rgb(${d[i * 4]},${d[i * 4 + 1]},${d[i * 4 + 2]})` });
  return out;
}

// ---------------------------------------------------------------- textures
const hash = (x, y, f) => {
  let h = (x * 374761393 + y * 668265263 + f * 982451653) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function canvasOf(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'));
  return c;
}
const rect = (g, col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };

// Screen backdrop: an indigo circuit board, standing in for the original's lavender stone.
const backdrop = canvasOf(W / 2, H / 2, g => {
  rect(g, '#2b2a52', 0, 0, W / 2, H / 2);
  for (let cy = 0; cy < H / 16; cy++) for (let cx = 0; cx < W / 16; cx++) {
    const r = i => hash(cx * 3 + i, cy * 5 + i, 99), x = cx * 8, y = cy * 8;
    if (r(1) < 0.45) rect(g, '#3a3970', x, y + 3, 8, 1);
    if (r(2) < 0.35) rect(g, '#3a3970', x + 3, y, 1, 8);
    if (r(3) < 0.12) { rect(g, '#4f4e94', x + 2, y + 2, 3, 3); rect(g, '#2b2a52', x + 3, y + 3); }
    if (r(4) < 0.05) { rect(g, '#1c1b38', x + 1, y + 1, 6, 4); for (let p = 0; p < 3; p++) rect(g, '#6362b0', x + 2 + p * 2, y + 5); }
  }
});

// Panel fill: dark speckled metal, standing in for the original's dark cobblestone.
const panelTex = canvasOf(32, 32, g => {
  rect(g, '#25272e', 0, 0, 32, 32);
  for (let i = 0; i < 90; i++) rect(g, hash(i, 1, 7) < 0.5 ? '#2e3139' : '#1d1f25', Math.floor(hash(i, 2, 7) * 16) * 2, Math.floor(hash(i, 3, 7) * 16) * 2, 2, 2);
});
let panelPattern = null;

const floorBg = [];
// Walls and fake walls look the same; the map edge counts as wall.
const solid = (m, x, y) => x < 0 || y < 0 || x >= N || y >= N || m[y][x] === '#' || m[y][x] === '%';
const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.substr(i, 2), 16) * (1 - t) + parseInt(b.substr(i, 2), 16) * t).toString(16).padStart(2, '0')).join('');
// Flat 16x16 pixel tiles drawn at 2x. Walls are raised blocks: a lit top, plus a dark rack face wherever floor lies below.
// Built from the live map, so a revealed fake wall ('%') becomes floor after a rebuild.
function buildFloorBg(fi) {
  const th = ZONES[zoneOf(fi)].theme, m = G.maps[fi];
  floorBg[fi] = canvasOf(N * 16, N * 16, g => {
    m.forEach((row, ty) => row.forEach((ch, tx) => {
      const ox = tx * 16, oy = ty * 16, rnd = i => hash(tx * 7 + i, ty * 13 + i, fi), at = (dx, dy) => solid(m, tx + dx, ty + dy);
      if (at(0, 0)) {
        const face = !at(0, 1), top = face ? 10 : 16;
        rect(g, th.wall, ox, oy, 16, top);
        if (!at(0, -1)) rect(g, th.hi, ox, oy, 16, 1);
        if (!at(-1, 0)) rect(g, th.hi, ox, oy, 1, top);
        if (!at(1, 0)) rect(g, th.mortar, ox + 15, oy, 1, top);
        if (!face) return;
        rect(g, th.hi, ox, oy + 9, 16, 1);
        rect(g, th.mortar, ox, oy + 10, 16, 5);
        for (let i = 3; i < 16; i += 4) rect(g, th.seam, ox + i, oy + 11, 1, 3);
        rect(g, th.seam, ox, oy + 15, 16, 1);
        if (rnd(1) < 0.2) rect(g, th.accent, ox + 1 + 4 * Math.floor(rnd(2) * 4), oy + 12, 2, 1);
      } else {
        rect(g, th.floor, ox, oy, 16, 16);
        rect(g, th.speck, ox, oy, 15, 1); rect(g, th.speck, ox, oy, 1, 15);
        rect(g, th.seam, ox, oy + 15, 16, 1); rect(g, th.seam, ox + 15, oy, 1, 16);
        if (at(0, -1)) rect(g, th.seam, ox, oy, 16, 2);
        if (at(-1, 0)) rect(g, th.seam, ox, oy, 1, 16);
        const r = rnd(3);
        if (r < 0.1) [[4, 4], [11, 4], [4, 11], [11, 11]].forEach(([x, y]) => rect(g, th.seam, ox + x, oy + y));
        else if (r < 0.16) for (let i = 0; i < 3; i++) rect(g, th.seam, ox + 5, oy + 6 + i * 2, 6, 1);
      }
    }));
  });
}

// ---------------------------------------------------------------- state
let G;                         // saved run state
let scene = 'title', time = 0, titleSel = 0, lastR = -9, endT = 0, deadT = 0, ending = null;
let ui = null;                 // modal: dialog | banner | battle | shop | book | help | fade | goal | fly | choice
let hero = { move: null, nudge: null, cooldown: 0 };
let particles = [], floaters = [], toasts = [], doorAnims = [], motes = [], statFlash = {};
let shake = 0, pendingDir = null;

const tile = (x, y, f = G.floor) => G.maps[f][y][x];
const setTile = (x, y, ch, f = G.floor) => { G.maps[f][y][x] = ch; };
const findTile = (f, ch) => {
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (G.maps[f][y][x] === ch) return [x, y];
};
const mapX = x => MX + x * TS, mapY = y => MY + y * TS;
const isVault = f => f >= MAIN_FLOORS;
// Vaults take the zone of the floor that hides their entrance.
const FLOOR_ZONE = MAPS.map((_, f) => (isVault(f) ? Math.floor(FLOOR_PLAN.findIndex(p => p.vault === f - MAIN_FLOORS) / 10) : Math.floor(f / 10)));
const zoneOf = (f = G.floor) => FLOOR_ZONE[f];
const floorLabel = f => (isVault(f) ? 'MEMORY VAULT' : `${TOWER}  ${f + 1}F`);
const metaKey = (x, y) => `${x},${y}`;
const meta = (f = G.floor) => MAP_META[f];
const isMonster = ch => /[1-69]/.test(ch);
const monsterAt = (ch, f = G.floor) => ({ ...zoneMonster(zoneOf(f), ch), ...BALANCE[zoneOf(f)].monsters[ch], boss: ch === '9' });
const itemValue = (ch, f = G.floor) => BALANCE[zoneOf(f)].items[ch];
const itemName = (ch, f = G.floor) => ITEMS[ch].name ?? ZONES[zoneOf(f)].gear[ch];

function newGame() {
  G = {
    ...structuredClone(HERO_START), floor: 0, x: 0, y: 0, dir: 'D', maps: MAPS.map(m => m.map(r => [...r])),
    flags: {}, buys: 0, steps: 0, kills: 0, status: 'NORMAL', antivirus: 0, shards: 0, visited: [0], weapon: -1, decals: {}, read: {},
  };
  [G.x, G.y] = findTile(0, 'P');
  setTile(G.x, G.y, '.');
  enterPlay();
  say(STORY.intro);
}

function enterPlay() {
  scene = 'play';
  ui = null;
  hero = { move: null, nudge: null, cooldown: 0 };
  particles = []; floaters = []; doorAnims = [];
  spawnMotes();
  Sound.play(floorMusic());
}

function floorMusic(f = G.floor) {
  if (isVault(f)) return 'vault';
  if (f % 10 === 9 && !G.flags['boss' + f]) return 'boss';
  return ZONES[zoneOf(f)].music;
}

// ---------------------------------------------------------------- combat math
const expectedDamage = m => battleCost(G, m);
function roll(base, { crit, miss }) {
  if (base <= 0) return { v: 0, block: true };
  const r = Math.random();
  if (r < miss) return { v: 0, miss: true };
  if (r < miss + crit) return { v: base * 2, crit: true };
  return { v: Math.max(1, Math.round(base * (0.9 + Math.random() * 0.2))) };
}
const dmgColor = d => (d === Infinity || d >= G.hp ? '#ff3b4e' : d >= G.hp / 2 ? '#ff8a3c' : d >= G.hp / 4 ? '#ffc23a' : d === 0 ? '#39ff9e' : '#f2f0ea');

// ---------------------------------------------------------------- feedback
function toast(text, color = '#f2f0ea') {
  toasts.unshift({ text, color, life: 2.2 });
  toasts.length = Math.min(toasts.length, 3);
}
function floater(text, x, y, color = '#fff', size = 8) {
  floaters.push({ text, x, y, color, size, life: 1, max: 1 });
}
function burst(x, y, color, n = 12, speed = 60) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
    particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color, size: 2, grav: 60 });
  }
}
// Something dissolves pixel by pixel into rising data.
function shatter(tx, ty, spr) {
  spritePixels(spr).forEach(p => particles.push({
    x: mapX(tx) + p.x * 2, y: mapY(ty) + p.y * 2,
    vx: (p.x - 8) * 6 + (Math.random() - 0.5) * 30, vy: -20 - Math.random() * 60,
    life: 0.5 + Math.random() * 0.6, max: 1.1, color: p.color, size: 2, grav: -30,
  }));
}
const flash = (k, up = true) => { statFlash[k] = { t: time, up }; };
// Center banner that waits for Enter, like the original's 取得 message.
// `lore`: optional one-line flavor shown under the item name.
const banner = (text, color = '#f2f0ea', label = 'ACQUIRED', then, lore, use) => { ui = { type: 'banner', text, color, label, then, lore, use }; };
const hurt = v => { G.hp = Math.max(1, G.hp - v); flash('hp', false); };

// ---------------------------------------------------------------- movement & interaction
function tryMove(dx, dy, dir) {
  G.dir = dir;
  const nx = G.x + dx, ny = G.y + dy;
  const block = () => { hero.nudge = { dx, dy, t: 0.12 }; hero.cooldown = 0.18; Sound.sfx.bump(); };
  if (nx < 0 || ny < 0 || nx >= N || ny >= N) return block();
  const ch = tile(nx, ny);
  if (ch === '#') return block();
  if (ch === '%') return revealWall(nx, ny);
  if (isMonster(ch)) return engage(nx, ny, ch);
  if (DOORS[ch]) return openDoor(nx, ny, ch);
  if (ch === 'S' || ch === 'M') return openShop(ch);
  if (ch === 'O') return talkNpc(nx, ny);
  if (ch === 'L') return touchGoal();
  if (ITEMS[ch]) { hero.nudge = { dx, dy, t: 0.12 }; hero.cooldown = 0.18; return pickUp(ch, nx, ny); }
  hero.move = { fx: G.x, fy: G.y, t: 0 };
  G.x = nx; G.y = ny; G.steps++;
  Sound.sfx.step();
}

function arrive() {
  if (G.status === 'CORRUPT') {
    hurt(BALANCE[zoneOf()].poison);
    if (G.steps % 4 === 0) floater(`-${BALANCE[zoneOf()].poison}`, mapX(G.x) + 16, mapY(G.y), '#b98cff', 8);
    if (--G.corruptSteps <= 0) { G.status = 'NORMAL'; toast('The corruption fades', '#39ff9e'); }
  }
  fieldDamage();
  const ch = tile(G.x, G.y);
  if (ch === 'U' || ch === 'D') changeFloor(G.floor + (ch === 'U' ? 1 : -1), ch === 'U' ? 'D' : 'U');
  else if (ch === '^') changeFloor(meta().links[metaKey(G.x, G.y)], '^');
  else if (ch === 'n' && !G.read[noteKey(G.x, G.y)]) readNote(); // read notes stay silent; E re-reads
}

const noteKey = (x, y) => `${G.floor}:${metaKey(x, y)}`;
// A floor's authored fragment (LORE, by floor number) replaces its first ordinary scrawl.
function readNote() {
  G.read[noteKey(G.x, G.y)] = true;
  const notes = meta().notes, k = metaKey(G.x, G.y);
  const spots = Object.keys(notes).filter(s => !SECRET_HINTS.includes(notes[s]));
  const lore = spots.indexOf(k) === 0 && LORE[G.floor + 1];
  say([].concat(lore || notes[k]).map(text => ({ text })));
}

// Turrets and similar hurt anything standing next to them (the original's 領域 damage).
function fieldDamage() {
  const dmg = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => [G.x + dx, G.y + dy])
    .filter(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && isMonster(tile(x, y)))
    .reduce((s, [x, y]) => s + (monsterAt(tile(x, y)).aura || 0), 0);
  if (!dmg) return;
  hurt(dmg);
  floater(`-${dmg}`, mapX(G.x) + 16, mapY(G.y) - 4, '#ff3b4e', 9);
  shake = 0.15;
  Sound.sfx.field();
}

function revealWall(x, y) {
  setTile(x, y, '.');
  floorBg[G.floor] = null;
  hero.cooldown = 0.3;
  for (let i = 0; i < 30; i++) particles.push({ x: mapX(x) + Math.random() * 32, y: mapY(y) + Math.random() * 32, vx: (Math.random() - 0.5) * 40, vy: -Math.random() * 50, life: 0.8, max: 0.8, color: ZONES[zoneOf()].theme.wall, size: 2, grav: 80 });
  shake = 0.2;
  Sound.sfx.crumble();
}

function gain(kind, v) {
  G[kind] += v;
  flash(kind);
}

function pickUp(ch, x, y) {
  const it = ITEMS[ch], cx = mapX(x) + 16, cy = mapY(y), v = itemValue(ch);
  setTile(x, y, '.');
  burst(cx, cy + 16, it.kind === 'hp' ? '#39ff9e' : '#6ff7ff', 10, 50);
  if (it.kind === 'key') { G.keys[it.key]++; flash('key' + it.key); Sound.sfx.key(); return banner(`${it.name}   x1`, PAL[it.key]); }
  if (it.kind === 'shard') return takeShard();
  if (it.kind === 'compass') {
    G.flags.compass = true;
    Sound.sfx.gear();
    return banner('Phase Compass', '#6ff7ff', undefined, undefined, ITEM_LORE['Phase Compass'], 'F  phase to a floor you have stood on');
  }
  if (it.kind === 'antivirus') {
    Sound.sfx.gem();
    if (G.status === 'CORRUPT') G.status = 'NORMAL'; else G.antivirus++;
    return banner('Antivirus Disk', '#39ff9e');
  }
  gain(it.kind, v);
  if (ch === 'w') G.weapon = Math.max(G.weapon, zoneOf()); // battle fx follow the best weapon owned
  floater(`${it.kind.toUpperCase()} +${v}`, cx, cy, it.kind === 'hp' ? '#39ff9e' : '#6ff7ff');
  (it.kind === 'hp' ? Sound.sfx.potion : it.gear ? Sound.sfx.gear : Sound.sfx.gem)();
  banner(`${itemName(ch)}   ${it.kind.toUpperCase()} +${v}`, it.gear ? '#6ff7ff' : '#f2f0ea', undefined, undefined, it.gear && ITEM_LORE[itemName(ch)]);
}

function takeShard() {
  G.shards++;
  Sound.sfx.lamp();
  shake = 0.2;
  banner('Memory Shard', '#ffc23a', 'RECOVERED', () => say(STORY.shards[G.shards - 1]));
}

function openDoor(x, y, ch) {
  const k = DOORS[ch];
  if (G.keys[k] <= 0) {
    hero.cooldown = 0.3;
    Sound.sfx.deny();
    return toast('Locked', PAL[k]);
  }
  G.keys[k]--;
  flash('key' + k, false);
  setTile(x, y, '.');
  doorAnims.push({ x, y, f: G.floor, ch, t: 0 });
  hero.cooldown = 0.22;
  Sound.sfx.door();
}

function engage(x, y, ch) {
  const m = monsterAt(ch);
  hero.cooldown = 0.3;
  if (G.atk <= m.def) {
    Sound.sfx.deny();
    return toast('Nothing gets through', '#ff3b4e');
  }
  if (m.intro && !G.flags['met' + G.floor]) {
    G.flags['met' + G.floor] = true;
    Sound.sfx.roar();
    shake = 0.5;
    return say(STORY[m.intro], () => startBattle(x, y, ch));
  }
  startBattle(x, y, ch);
}

function talkNpc(x, y) {
  const id = meta().npcs[metaKey(x, y)], npc = NPCS[id];
  hero.cooldown = 0.25;
  if (G.flags['npc:' + id]) return npc.repeat && say(STORY[npc.repeat]);
  say(STORY[npc.lines], () => {
    G.flags['npc:' + id] = true;
    if (npc.leave) { shatter(x, y, npc.sprite); setTile(x, y, '.'); }
    if (npc.gift) giveGift(npc.gift);
  });
}

function giveGift(gift) {
  if (gift === 'drill') {
    const v = itemValue('drill');
    gain('atk', v);
    Sound.sfx.gear();
    return banner(`Brann's Drill   ATK +${v}`, '#ffc23a', undefined, undefined, ITEM_LORE["Brann's Drill"]);
  }
  const it = ITEMS[gift];
  if (it.kind === 'key') { G.keys[it.key]++; flash('key' + it.key); Sound.sfx.key(); return banner(`${it.name}   x1`, PAL[it.key]); }
  if (it.kind === 'antivirus') { G.antivirus++; Sound.sfx.gem(); return banner(it.name, '#39ff9e'); }
  const v = itemValue(gift);
  gain(it.kind, v);
  (it.kind === 'hp' ? Sound.sfx.potion : Sound.sfx.gem)();
  banner(`${itemName(gift)}   ${it.kind.toUpperCase()} +${v}`);
}

function touchGoal() {
  if (!G.flags['boss' + G.floor]) return say(STORY.goalLocked);
  if (G.shards >= 5) {
    ui = { type: 'choice', sel: 0, ...STORY.choice };
    return Sound.sfx.select();
  }
  finish('endingSignature');
}

function finish(which) {
  ending = which;
  Sound.stop();
  Sound.sfx.lamp();
  ui = { type: 'goal', t: 0 };
}

// Move to floor nf and stand next to the given tile (stairs, vault stairs).
function changeFloor(nf, arriveAt) {
  Sound.sfx.stairs(nf > G.floor);
  ui = {
    type: 'fade', t: 0, done: false, label: floorLabel(nf),
    mid() {
      G.floor = nf;
      [G.x, G.y] = findTile(nf, arriveAt) || findTile(nf, 'U') || findTile(nf, 'D');
      particles = []; doorAnims = [];
      spawnMotes();
      Sound.play(floorMusic());
      const first = !G.visited.includes(nf);
      if (first) G.visited.push(nf);
      ui.after = first && ON_ENTER[nf] ? () => say(STORY[ON_ENTER[nf]]) : null;
    },
  };
}

// ---------------------------------------------------------------- battle
const BOX = { x: MX - 16, y: MY + 92, w: MW + 32, h: 176 };
const FRAME = { M: { x: BOX.x + 14, y: BOX.y + 36 }, H: { x: BOX.x + BOX.w - 62, y: BOX.y + 36 } }; // 48px portrait frames
const frameCenter = who => ({ x: FRAME[who].x + 24, y: FRAME[who].y + 24 });

function startBattle(x, y, ch) {
  const m = monsterAt(ch);
  ui = { type: 'battle', m, x, y, mhp: m.hp, heroTurn: !m.swift, timer: 0.45, mHits: 0, second: false, over: false, fast: false, lunge: null, fx: { H: 0, M: 0 }, sh: { H: 0, M: 0 }, mFlash: 0, fxs: [], stop: 0, white: 0, quake: 0 };
  Sound.sfx.battle();
}

function updateBattle(b, dt) {
  for (const k of ['H', 'M']) b.sh[k] = Math.max(0, b.sh[k] - dt);
  b.white = Math.max(0, b.white - dt);
  b.quake = Math.max(0, b.quake - dt);
  if (b.stop > 0) { b.stop -= dt; return; } // hit-stop: only the shake keeps moving
  for (const k of ['H', 'M']) b.fx[k] = Math.max(0, b.fx[k] - dt);
  b.mFlash = Math.max(0, b.mFlash - dt);
  if (b.lunge && (b.lunge.t -= dt) <= 0) b.lunge = null;
  // Attack effects age at battle speed (3x when fast, so they stay visible between 4x swings).
  const due = [];
  b.fxs = b.fxs.filter(e => {
    e.t += dt * (b.fast ? 3 : 1);
    if (e.t >= 0 && e.land) { due.push(e.land); e.land = null; }
    return e.t < e.dur;
  });
  due.forEach(f => f());
  b.timer -= dt * (b.fast ? 4 : 1);
  if (b.timer > 0) return;
  if (b.over) return endBattle(b);
  if (b.heroTurn) {
    const r = roll(G.atk - b.m.def, hitChances(G, b.m));
    b.mhp = Math.max(0, b.mhp - r.v);
    if (r.v) b.mFlash = 0.5;
    hitFx(b, r, 'M');
    if (b.mhp === 0) { b.over = true; b.timer = 0.7; Sound.sfx.kill(); }
  } else {
    b.mHits++;
    const r = roll(b.m.pierce ? b.m.atk : b.m.atk - G.def, hitChances(b.m, G));
    if (b.m.surge && b.mHits % 3 === 0 && r.v > 0) { r.v *= 2; r.surge = true; }
    if (b.m.pierce && r.v) r.pierce = true;
    G.hp = Math.max(0, G.hp - r.v);
    if (r.v) flash('hp', false);
    hitFx(b, r, 'H');
    if (G.hp === 0) { b.over = true; b.dead = true; b.timer = 0.9; }
    // Twin attackers strike again before the hero answers.
    if (b.m.double && !b.second && !b.over) { b.second = true; b.timer = 0.18; return; }
    b.second = false;
  }
  b.heroTurn = !b.heroTurn;
  if (!b.over) b.timer = 0.3;
}

// One swing: the attacker's effect plays, and the blow lands (numbers, flash, sound) when it arrives.
// P: a = muzzle, z = impact point (above the frame on a miss), d = travel direction, k = size, c = crit.
function hitFx(b, r, target) {
  const who = target === 'M' ? 'H' : 'M', z = frameCenter(target), d = who === 'H' ? -1 : 1, big = !!(r.crit || r.surge);
  b.lunge = { who, t: 0.14 };
  const P = {
    a: fxAt(frameCenter(who), d * 26, 0), z: r.miss ? fxAt(z, 0, -36) : z, to: target, d, c: big, miss: !!(r.miss || r.block),
    k: (big ? 1.5 : 1) * (who === 'M' && b.m.boss ? 1.3 : 1), flip: b.second ? -1 : 1,
  };
  const fx = who === 'H' ? heroFx() : enemyFx(b.m);
  let t = fx(b, P);
  if (r.surge && fx !== ENEMY_FX.surge) t = Math.max(t, ENEMY_FX.surge(b, P));
  fxAdd(b, 0, null, t, () => landFx(b, r, target));
}

function landFx(b, r, target) {
  const pos = frameCenter(target), big = r.crit || r.surge;
  if (r.miss) { floater('MISS', pos.x, pos.y - 34, '#9ea2ad', 10); return Sound.sfx.miss(); }
  if (r.block) {
    floater('BLOCK', pos.x, pos.y - 34, '#6ff7ff', 10);
    fxAdd(b, 0.2, p => fxSigil(pos, 20 + 6 * p, '#6ff7ff', 1 - p, 0));
    return Sound.sfx.bump();
  }
  b.fx[target] = 0.22;
  b.sh[target] = big ? 0.3 : 0.15;
  b.stop = (big ? 0.14 : 0.03) / (b.fast ? 3 : 1);
  const label = r.surge ? 'OVERFLOW' : r.crit ? 'CRIT!' : r.pierce ? 'PIERCE' : null;
  if (label) floater(label, pos.x, pos.y - 48, r.surge ? '#6ff7ff' : r.pierce ? '#b98cff' : '#ff8a3c', 9);
  floater(`-${r.v}`, pos.x, pos.y - 34, big ? '#ffc23a' : target === 'H' ? '#ff3b4e' : '#f2f0ea', big ? 14 : 11);
  burst(pos.x, pos.y, target === 'H' ? '#ff3b4e' : GORE[bleed(b.m)][2], r.crit ? 22 : 10, r.crit ? 140 : 80);
  fxAdd(b, 0.16, p => fxOrb(pos, (big ? 44 : 30) * (1 - p * 0.3), '#ffffff', 0.8 * (1 - p)));
  if (target === 'H' && b.m.boss) fxAdd(b, 0.3, p => fxRing(pos, 10 + 50 * p, '#ff3b4e', 4 * (1 - p) + 1, 1 - p));
  if (!big) return (target === 'H' ? Sound.sfx.hurt : Sound.sfx.hit)();
  // Crits: freeze-frame, white-out, box quake and speed lines.
  shake = 0.25; b.quake = 0.25; b.white = 0.1;
  fxAdd(b, 0.3, p => {
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2 + i, r0 = 30 + p * 34 + (i % 3) * 6;
      fxPath([fxAt(pos, Math.cos(a) * r0, Math.sin(a) * r0), fxAt(pos, Math.cos(a) * (r0 + 22), Math.sin(a) * (r0 + 22))], '#ffffff', 2, 1 - p);
    }
  });
  Sound.sfx.crit();
}

// ---------------------------------------------------------------- battle fx
// A battle effect draws with progress p (0..1) after `delay`; `land` fires once when it starts.
const fxAdd = (b, dur, draw, delay = 0, land) => b.fxs.push({ t: -delay, dur, draw, land });
const fxAt = (c, dx, dy) => ({ x: c.x + dx, y: c.y + dy });
const fxAlong = (a, z, t) => ({ x: a.x + (z.x - a.x) * t, y: a.y + (z.y - a.y) * t });
function fxPath(pts, color, w, a = 1) {
  ctx.globalAlpha = Math.max(0, Math.min(1, a));
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
  ctx.stroke();
}
function fxRing(c, r, color, w, a) {
  ctx.globalAlpha = Math.max(0, a);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.beginPath();
  ctx.arc(c.x, c.y, Math.max(0, r), 0, Math.PI * 2);
  ctx.stroke();
}
function fxOrb(c, r, color, a) { // color: #rrggbb
  const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, color + '00');
  ctx.globalAlpha = Math.max(0, a);
  ctx.fillStyle = g;
  ctx.fillRect(c.x - r, c.y - r, r * 2, r * 2);
}
// Lightning from a to z: n segments with sideways jitter, re-rolled every frame so it crackles.
function fxJag(a, z, n, amp) {
  const dx = z.x - a.x, dy = z.y - a.y, len = Math.hypot(dx, dy) || 1;
  return Array.from({ length: n + 1 }, (_, i) => {
    const o = i && i < n ? (Math.random() - 0.5) * amp : 0;
    return { x: a.x + dx * i / n - dy / len * o, y: a.y + dy * i / n + dx / len * o };
  });
}
function fxSigil(c, r, color, a, rot) { // hex glyph ring
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(rot);
  ctx.globalAlpha = Math.max(0, a);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i <= 6; i++) ctx[i ? 'lineTo' : 'moveTo'](Math.cos(i * Math.PI / 3) * r, Math.sin(i * Math.PI / 3) * r);
  ctx.moveTo(r * 0.6, 0);
  ctx.arc(0, 0, r * 0.6, 0, Math.PI * 2);
  for (let i = 0; i < 6; i++) {
    const q = (i + 0.5) * Math.PI / 3;
    ctx.moveTo(Math.cos(q) * r * 0.6, Math.sin(q) * r * 0.6);
    ctx.lineTo(Math.cos(q) * r * 1.25, Math.sin(q) * r * 1.25);
  }
  ctx.stroke();
  ctx.restore();
}
function fxSparks(c, color, n, speed, grav = 160) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random());
    particles.push({ x: c.x, y: c.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.4, max: 0.4, color, size: 2, grav });
  }
}

// Reusable moves; times are seconds after the swing.
const fxShot = (b, P, dur, head, delay = 0) => (fxAdd(b, dur, p => head(fxAlong(P.a, P.z, p), p), delay), delay + dur);
const fxBeam = (b, P, cols, w, dur, delay = 0, to = P.z) => fxAdd(b, dur, p => {
  const k = Math.sin(Math.PI * Math.min(1, p * 1.3));
  cols.forEach((c, i) => fxPath([P.a, to], c, Math.max(1, w * P.k * k * (1 - i / cols.length))));
}, delay);
const fxBolt = (b, P, color, dur, amp, delay = 0) => fxAdd(b, dur, () => {
  const pts = fxJag(P.a, P.z, 10, amp * P.k), a = Math.random() < 0.25 ? 0.35 : 1;
  fxPath(pts, color, 4 * P.k, a);
  fxPath(pts, '#ffffff', 1.5, a);
}, delay);
const fxClaws = (b, P, color, n, delay = 0, flip = P.flip) => fxAdd(b, 0.2, p => {
  const r = Math.min(1, p * 3) * 52 * P.k;
  for (let i = 0; i < n; i++) {
    const s = fxAt(P.z, (-26 + (i - (n - 1) / 2) * 9) * flip, -26);
    fxPath([s, fxAt(s, r * flip, r)], color, 3 - p * 2, 1 - p);
  }
}, delay);
const fxCrescent = (b, P, color, delay, rot, r = 22) => fxAdd(b, 0.22, p => {
  ctx.save();
  ctx.translate(P.z.x, P.z.y);
  ctx.rotate(rot);
  [[7 * P.k * (1 - p) + 1, color], [1.5, '#ffffff']].forEach(([w, c]) => {
    ctx.globalAlpha = 1 - p;
    ctx.strokeStyle = c;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.arc(0, 0, r * P.k, -2.6, -2.6 + 2.8 * Math.min(1, p * 6));
    ctx.stroke();
  });
  ctx.restore();
}, delay);
const fxCut = (b, P, rot, color, delay) => fxAdd(b, 0.32, p => {
  const s = Math.min(1, p * 5), L = 36 * P.k, dx = Math.cos(rot) * L, dy = Math.sin(rot) * L;
  const e = fxAt(P.z, -dx, -dy), f = fxAt(e, 2 * dx * s, 2 * dy * s);
  fxPath([e, f], color, 8, 0.45 * (1 - p));
  fxPath([e, f], '#ffffff', p < 0.4 ? 3 : 1.5, 1 - p);
}, delay);
const fxRings = (b, c, color, n, r, dur, delay = 0) => {
  for (let i = 0; i < n; i++) fxAdd(b, dur, p => fxRing(c, 4 + r * p, color, 3 * (1 - p) + 1, 1 - p), delay + i * 0.05);
};
const fxFrame = (b, P, color, dur, a, delay = 0) => fxAdd(b, dur, p => {
  if (P.miss) return;
  ctx.globalAlpha = a * (1 - p);
  ctx.fillStyle = color;
  ctx.fillRect(FRAME[P.to].x, FRAME[P.to].y, 48, 48);
}, delay);
// Signature beam: glyph at the muzzle, layered beam, then a light pillar and glyph on the target.
function fxRoot(b, P, c1, c2) {
  fxAdd(b, 0.12, p => fxSigil(P.a, 12 + 8 * p, c1, 1, time * 6));
  fxBeam(b, P, [c2, c1, '#ffffff'], 14, 0.2, 0.08);
  fxAdd(b, 0.36, p => {
    const w = 26 * P.k * (1 - p);
    ctx.globalAlpha = 0.5 * (1 - p);
    ctx.fillStyle = c2;
    ctx.fillRect(P.z.x - w / 2, BOX.y, w, BOX.h);
    fxSigil(P.z, (18 + 22 * p) * P.k, c1, 1 - p, -time * 5);
  }, 0.1, () => fxSparks(P.z, c1, 18, 150));
  return 0.1;
}

// Rho's attack follows the best weapon owned: G.weapon = zone index of its ZONES[z].gear.w, -1 = none yet.
// Each entry spawns its effects and returns when the blow lands.
const BARE_FX = (b, P) => { // energy slash
  Sound.sfx.whoosh();
  const t = fxShot(b, P, 0.07, q => { fxOrb(q, 10, '#6ff7ff', 0.8); fxPath([q, fxAt(q, -24 * P.d, 4)], '#6ff7ff', 3); });
  fxCrescent(b, P, '#6ff7ff', t, 0.2, 28);
  if (P.c) fxCrescent(b, P, '#ffffff', t + 0.04, 2.6, 30);
  return t;
};
const WEAPON_FX = [
  (b, P) => { // Coilgun: magnetic rail slug through coil rings, recoil streak behind Rho
    Sound.sfx.laser();
    fxAdd(b, 0.14, p => {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#6ff7ff';
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.ellipse(P.a.x + P.d * (4 + i * 8 + p * 12), P.a.y, 3, 11 - i * 2, 0, 0, Math.PI * 2); ctx.stroke(); }
    });
    fxAdd(b, 0.25, p => [-6, 4].forEach(o => fxPath([fxAt(P.a, -P.d * 52, o), fxAt(P.a, -P.d * (52 + 30 * (1 - p)), o)], '#6ff7ff', 2, 1 - p)));
    const t = fxShot(b, P, 0.06, q => { fxOrb(q, 12 * P.k, '#6ff7ff', 0.9); fxPath([fxAt(q, -P.d * 90, 0), q], '#1ea4d4', 6 * P.k, 0.7); fxPath([fxAt(q, -P.d * 40, 0), q], '#ffffff', 3); }, 0.02);
    fxAdd(b, 0.16, p => fxRing(P.z, 4 + 36 * p * P.k, '#6ff7ff', 3 * (1 - p) + 1, 1 - p), t, () => fxSparks(P.z, '#6ff7ff', 14, 130));
    return t;
  },
  (b, P) => { // Arc Welder: crackling arc and molten sparks
    Sound.sfx.zap();
    fxBolt(b, P, '#9fe8ff', 0.24, 26);
    if (P.c) fxBolt(b, P, '#ffffff', 0.2, 36, 0.04);
    fxAdd(b, 0.24, p => fxOrb(P.a, 14, '#9fe8ff', 1 - p));
    fxAdd(b, 0.22, p => fxOrb(P.z, 22 * P.k, '#ffffff', 1 - p), 0.03, () => fxSparks(P.z, '#ffc23a', 18, 120, 260));
    return 0.03;
  },
  (b, P) => { // Scalpel Laser: hair-thin beam, then a clean cut
    Sound.sfx.laser();
    fxBeam(b, P, ['#ff4d6d', '#ffffff'], 3, 0.1);
    fxAdd(b, 0.1, p => fxOrb(P.a, 12, '#ff4d6d', 1 - p));
    fxCut(b, P, -0.7, '#ff4d6d', 0.03);
    if (P.c) fxCut(b, P, 0.7, '#ff4d6d', 0.09);
    return 0.03;
  },
  (b, P) => { // Rivet Driver: a burst of heavy rivets, each one hammering home
    Sound.sfx.thud();
    for (let i = 0, n = P.c ? 5 : 3; i < n; i++) {
      const o = (i - (n - 1) / 2) * 8, Q = { ...P, a: fxAt(P.a, 0, o), z: fxAt(P.z, 0, o) };
      const t = fxShot(b, Q, 0.07, q => { fxPath([q, fxAt(q, -P.d * 30, 0)], '#ff8a3c', 3, 0.8); ctx.globalAlpha = 1; rect(ctx, '#dfe9f2', q.x - 5, q.y - 3, 10, 6); rect(ctx, '#ffc23a', q.x + (P.d > 0 ? 3 : -5), q.y - 3, 2, 6); }, i * 0.035);
      fxAdd(b, 0.14, p => fxRing(Q.z, 3 + 18 * p, '#ffc23a', 3 * (1 - p) + 1, 1 - p), t, () => {
        fxSparks(Q.z, '#ffc23a', 8, 140, 300);
        if (!P.miss) b.sh[P.to] = 0.12;
        if (i) Sound.sfx.thud();
      });
    }
    return 0.07;
  },
  (b, P) => { // Data Lance: a spear of live bits that bursts into a data storm
    Sound.sfx.laser();
    const bit = () => (Math.random() < 0.5 ? '0' : '1'), o = { font: BODY, align: 'center', shadow: false };
    const t = fxShot(b, P, 0.08, q => { fxOrb(q, 14, '#39ff9e', 0.7); for (let i = 0; i < 11; i++) text(bit(), q.x - P.d * i * 9, q.y - 11, { ...o, size: 24 - i, color: i ? '#39ff9e' : '#ffffff', alpha: 1 - i / 12 }); });
    const bits = Array.from({ length: P.c ? 24 : 12 }, () => ({ a: Math.random() * 6.3, s: 24 + Math.random() * 30, g: bit() }));
    fxAdd(b, 0.32, p => bits.forEach(g => text(g.g, P.z.x + Math.cos(g.a) * g.s * p * P.k, P.z.y - 8 + Math.sin(g.a) * g.s * p * P.k, { ...o, size: 20, color: '#39ff9e', alpha: 1 - p })), t);
    fxFrame(b, P, '#39ff9e', 0.2, 0.5, t);
    if (P.c) fxAdd(b, 0.36, p => { // the storm: bits rain over the target
      const f = FRAME[P.to];
      for (let c = 0; c < 6; c++) for (let r = 0; r < 3; r++) text(bit(), f.x + 4 + c * 8, f.y - 12 + (p * 70 + r * 22 + c * 9) % 66, { ...o, size: 14, color: '#b6ffd8', alpha: 1 - p });
    }, t);
    return t;
  },
  (b, P) => { // Resonance Blade: stacked sound-wave blades; the target rings like a bell
    Sound.sfx.chime();
    const ang = P.d > 0 ? 0 : Math.PI;
    for (let i = 0; i < 3; i++) fxShot(b, P, 0.09, q => {
      ctx.globalAlpha = 1 - i * 0.25;
      ctx.strokeStyle = i ? '#b98cff' : '#ffffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(q.x - P.d * 16, q.y, 20 * P.k, ang - 1.1, ang + 1.1);
      ctx.stroke();
    }, i * 0.03);
    fxAdd(b, 0.4, p => { for (let i = 0; i < 3; i++) { const q = (p * 2 + i / 3) % 1; fxRing(P.z, 6 + q * 34 * P.k, '#b98cff', 2, (1 - q) * (1 - p)); } }, 0.09);
    fxFrame(b, P, '#b98cff', 0.3, 0.45, 0.09);
    return 0.09;
  },
  (b, P) => { // Purge Cannon: charge, then a white-hot purge beam and blast
    Sound.sfx.beam();
    fxAdd(b, 0.08, p => { fxOrb(P.a, 8 + 18 * p, '#ff3b4e', 1); fxOrb(P.a, 4 + 8 * p, '#ffffff', 1); });
    fxBeam(b, P, ['#ff3b4e', '#ffc9c9', '#ffffff'], 16, 0.18, 0.07);
    fxAdd(b, 0.28, p => { fxOrb(P.z, 34 * P.k, '#ff3b4e', 1 - p); fxRing(P.z, 8 + 44 * p * P.k, '#ffffff', 5 * (1 - p) + 1, 1 - p); }, 0.08, () => fxSparks(P.z, '#ff8a3c', 22, 170));
    return 0.08;
  },
  (b, P) => { // Grave Rail: a spectral slug trailing its own ghosts; lands as a grave-marker flash
    Sound.sfx.laser();
    const t = fxShot(b, P, 0.08, q => { for (let i = 5; i >= 0; i--) { ctx.globalAlpha = 1 - i * 0.16; rect(ctx, i ? '#7fa08a' : '#e8fff0', q.x - P.d * i * 14 - 5, q.y - 4, 10, 8); } fxOrb(q, 14, '#b8d8c0', 0.6); });
    fxAdd(b, 0.34, p => {
      const h = 30 * P.k * Math.min(1, p * 5), w = 3 * (1 - p) + 1;
      fxOrb(P.z, 28, '#b8d8c0', 0.6 * (1 - p));
      fxPath([fxAt(P.z, 0, -h), fxAt(P.z, 0, h)], '#e8fff0', w, 1 - p);
      fxPath([fxAt(P.z, -h * 0.6, -h * 0.35), fxAt(P.z, h * 0.6, -h * 0.35)], '#e8fff0', w, 1 - p);
    }, t, () => fxSparks(P.z, '#b8d8c0', 16, 60, -80));
    return t;
  },
  (b, P) => { // Null Edge: the world dims and space itself is cut open
    Sound.sfx.whoosh();
    fxAdd(b, 0.3, p => { ctx.globalAlpha = 0.6 * (1 - p); ctx.fillStyle = '#000000'; ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h); });
    fxAdd(b, 0.1, p => fxPath([P.a, P.z], '#ffffff', 1, 0.7 * (1 - p)));
    const tear = (rot, delay) => fxAdd(b, 0.34, p => {
      const L = 40 * P.k, x2 = -L + 2 * L * Math.min(1, p * 8), open = Math.sin(Math.min(1, p * 1.5) * Math.PI) * 10 * P.k;
      fxOrb(P.z, 40 * P.k, '#b98cff', 0.7 * (1 - p));
      ctx.save();
      ctx.translate(P.z.x, P.z.y);
      ctx.rotate(rot);
      fxPath([{ x: -L - 8, y: 0 }, { x: x2 + 8, y: 0 }], '#ffffff', 2, 1 - p);
      [[open + 4, '#ffffff'], [open, '#000000']].forEach(([h, c]) => {
        ctx.globalAlpha = 1 - p * p;
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.moveTo(-L, 0);
        ctx.quadraticCurveTo((x2 - L) / 2, -h, x2, 0);
        ctx.quadraticCurveTo((x2 - L) / 2, h, -L, 0);
        ctx.fill();
      });
      ctx.restore();
    }, delay);
    tear(-0.5, 0.05);
    if (P.c) tear(0.6, 0.1);
    return 0.05;
  },
  (b, P) => { Sound.sfx.beam(); Sound.sfx.chime(); return fxRoot(b, P, '#ffc23a', '#6ff7ff'); }, // Root Key: the Signature beam
];
const heroFx = () => WEAPON_FX[Math.min(G.weapon ?? -1, WEAPON_FX.length - 1)] ?? BARE_FX;

// Enemy attacks by base sprite, then by ability, then a default, so new monsters just work.
const ENEMY_FX = {
  mite: (b, P) => { // bite: jaws snap shut
    Sound.sfx.whoosh();
    fxAdd(b, 0.22, p => {
      const g = 26 * (1 - Math.min(1, p * 4)) * P.k + 6;
      [-1, 1].forEach(k => {
        const jaw = Array.from({ length: 7 }, (_, i) => fxAt(P.z, (i - 3) * 7 * P.k, k * (g - (i % 2) * 8)));
        fxPath(jaw, '#ff3b4e', 5, 1 - p);
        fxPath(jaw, '#f2f0ea', 2, 1 - p);
      });
    });
    return 0.05;
  },
  wisp: (b, P) => { // electric zap
    Sound.sfx.zap();
    fxBolt(b, P, '#ffe66b', 0.16, 14);
    fxAdd(b, 0.16, p => fxOrb(P.z, 18 * P.k, '#ffe66b', 1 - p), 0.02);
    return 0.02;
  },
  husk: (b, P) => { // overhead slam and shockwave
    Sound.sfx.thud();
    fxAdd(b, 0.08, p => [-10, 0, 10].forEach(o => fxPath([fxAt(P.z, o, -60 + 40 * p), fxAt(P.z, o, -40 + 40 * p)], '#c9c6bd', 2, 0.8)));
    fxAdd(b, 0.25, p => {
      ctx.globalAlpha = 1 - p;
      ctx.strokeStyle = '#c9c6bd';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(P.z.x, P.z.y + 22, 10 + 34 * p * P.k, 4 + 8 * p, 0, 0, Math.PI * 2);
      ctx.stroke();
    }, 0.08, () => fxSparks(fxAt(P.z, 0, 22), '#9ea2ad', 12, 90));
    return 0.08;
  },
  sanitizer: (b, P) => { // purge spray
    Sound.sfx.beam();
    const drops = Array.from({ length: 22 }, () => ({ v: 0.7 + Math.random() * 0.5, o: (Math.random() - 0.5) * 36, c: Math.random() < 0.3 ? '#ffffff' : '#ff8a3c' }));
    fxAdd(b, 0.2, p => drops.forEach(d => { const q = fxAlong(P.a, P.z, Math.min(1.1, p * 1.6 * d.v)); ctx.globalAlpha = 1 - p; rect(ctx, d.c, q.x - 2, q.y + d.o * p - 2, 4, 4); }));
    fxFrame(b, P, '#ff8a3c', 0.2, 0.5, 0.1);
    return 0.1;
  },
  serpent: (b, P) => { // coil lash: a whip that snakes out and cracks
    Sound.sfx.whoosh();
    fxAdd(b, 0.24, p => {
      const s = Math.min(1, p * 3), amp = 14 * (1 - p) * P.k;
      fxPath(Array.from({ length: 17 }, (_, i) => fxAt(fxAlong(P.a, P.z, s * i / 16), 0, Math.sin(i * 0.9 - p * 20) * amp * Math.sin(i / 16 * Math.PI))), '#39ff9e', 3, 1 - p * 0.6);
    });
    fxAdd(b, 0.15, p => fxRing(P.z, 4 + 18 * p, '#39ff9e', 2, 1 - p), 0.08);
    return 0.08;
  },
  mason: (b, P) => { // hammer: a slab drops, debris flies
    Sound.sfx.thud();
    fxAdd(b, 0.1, p => { ctx.globalAlpha = 1; rect(ctx, '#b97a12', P.z.x - 3, P.z.y - 84 + 44 * p, 6, 20); rect(ctx, '#ffc23a', P.z.x - 14 * P.k, P.z.y - 64 + 44 * p, 28 * P.k, 14); });
    fxRings(b, P.z, '#ffc23a', 2, 40 * P.k, 0.22, 0.1);
    fxAdd(b, 0, null, 0.1, () => fxSparks(P.z, '#ffc23a', 14, 150, 400));
    return 0.1;
  },
  drone: (b, P) => { // target lock, then a laser
    Sound.sfx.laser();
    fxAdd(b, 0.08, p => { ctx.globalAlpha = Math.floor(p * 8) % 2 ? 0.3 : 1; rect(ctx, '#ff3b4e', P.z.x - 2, P.z.y - 2, 4, 4); fxRing(P.z, 10 - 6 * p, '#ff3b4e', 1, 1); });
    fxBeam(b, P, ['#ff3b4e', '#ffffff'], 4, 0.12, 0.07);
    return 0.08;
  },
  turret: (b, P) => { // tracer burst
    Sound.sfx.laser();
    for (let i = 0, n = P.c ? 5 : 3; i < n; i++) {
      const Q = { ...P, z: fxAt(P.z, (Math.random() - 0.5) * 16, (Math.random() - 0.5) * 20) };
      const t = fxShot(b, Q, 0.06, q => fxPath([q, fxAt(q, -P.d * 14, 0)], '#ffe66b', 2), i * 0.035);
      fxAdd(b, 0.1, p => fxOrb(Q.z, 8, '#ffe66b', 1 - p), t);
    }
    return 0.06;
  },
  hound: (b, P) => { Sound.sfx.whoosh(); fxClaws(b, P, '#ff2a3d', 3, 0.03); return 0.03; }, // claw marks
  ghost: (b, P) => { // static: the portrait dissolves into noise
    Sound.sfx.zap();
    fxAdd(b, 0.1, p => fxRing(fxAlong(P.a, P.z, p), 6 + 4 * Math.sin(p * 20), '#dfe9f2', 2, 0.6));
    fxAdd(b, 0.26, p => {
      if (P.miss) return;
      const f = FRAME[P.to];
      for (let i = 0; i < 26 * P.k; i++) { ctx.globalAlpha = (1 - p) * Math.random(); rect(ctx, Math.random() < 0.5 ? '#dfe9f2' : '#4f535e', f.x + Math.random() * 44, f.y + Math.random() * 46, 2 + Math.random() * 6, 2); }
      for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.5 * (1 - p); rect(ctx, '#8aa2b8', f.x - 6 + Math.random() * 12, f.y + Math.random() * 46, 48, 2); }
    }, 0.1);
    return 0.1;
  },
  surgeon: (b, P) => { // thrown scalpels, then crossing cuts
    Sound.sfx.whoosh();
    [-16, 0, 16].forEach((o, i) => fxShot(b, { ...P, a: fxAt(P.a, 0, o) }, 0.08, q => { fxOrb(q, 8, '#dfe9f2', 0.7); fxPath([q, fxAt(q, -P.d * 16, 0)], '#dfe9f2', 3); }, i * 0.02));
    fxCut(b, P, -0.7, '#8aa2b8', 0.09);
    fxCut(b, P, 0.7, '#8aa2b8', 0.12);
    return 0.09;
  },
  choir: (b, P) => { // sound rings
    Sound.sfx.chime();
    for (let i = 0; i < 3; i++) fxShot(b, P, 0.1, (q, p) => fxRing(q, 8 + 14 * p * P.k, i ? '#b98cff' : '#ffffff', 3, 1 - p * 0.4), i * 0.04);
    fxRings(b, P.z, '#b98cff', 3, 36 * P.k, 0.25, 0.1);
    return 0.1;
  },
  knight: (b, P) => { // wide cleave
    Sound.sfx.whoosh();
    fxCrescent(b, P, '#dfe9f2', 0.03, P.flip > 0 ? 0.3 : 2.8, 34);
    fxCrescent(b, P, '#8aa2b8', 0.06, P.flip > 0 ? 0.3 : 2.8, 42);
    return 0.03;
  },
  warden: (b, P) => { Sound.sfx.beam(); return fxRoot(b, P, '#ff3b4e', '#6ff7ff'); }, // the Root's own beam
  mirror: (b, P) => heroFx()(b, P), // The Mirror fights with Rho's own weapon
  // Ability fallbacks for sprites not listed above.
  pierce: (b, P) => { Sound.sfx.laser(); fxBeam(b, P, ['#b98cff', '#ffffff'], 5, 0.16, 0, fxAt(P.z, P.d * 120, 0)); return 0.02; }, // beam straight through
  corrupt: (b, P) => { // virus packet, then green glitch
    Sound.sfx.zap();
    const t = fxShot(b, P, 0.09, q => { ctx.globalAlpha = 1; for (let i = 0; i < 6; i++) rect(ctx, i % 2 ? '#39ff9e' : '#0f5f3a', q.x + (Math.random() - 0.5) * 14, q.y + (Math.random() - 0.5) * 14, 4, 4); });
    fxAdd(b, 0.3, p => {
      if (P.miss) return;
      const f = FRAME[P.to];
      for (let i = 0; i < 5; i++) { ctx.globalAlpha = 0.7 * (1 - p); rect(ctx, '#39ff9e', f.x + Math.random() * 30, f.y + Math.random() * 44, 6 + Math.random() * 18, 3); }
    }, t);
    return t;
  },
  double: (b, P) => { Sound.sfx.whoosh(); fxClaws(b, P, '#ff2a3d', 2, 0.02, 1); fxClaws(b, P, '#ff8a3c', 2, 0.06, -1); return 0.02; }, // twin claws
  surge: (b, P) => { // overflow blast
    Sound.sfx.beam();
    const t = fxShot(b, P, 0.1, (q, p) => { fxOrb(q, (10 + 10 * p) * P.k, '#6ff7ff', 1); fxOrb(q, 5 * P.k, '#ffffff', 1); });
    fxAdd(b, 0.3, p => { fxOrb(P.z, 40 * P.k, '#6ff7ff', 0.8 * (1 - p)); fxRing(P.z, 8 + 50 * p * P.k, '#6ff7ff', 5 * (1 - p) + 1, 1 - p); }, t);
    return t;
  },
  swift: (b, P) => { // dash: afterimage streaks, then a slash
    Sound.sfx.whoosh();
    fxAdd(b, 0.14, p => [-10, 0, 10].forEach(o => fxPath([fxAt(fxAlong(P.a, P.z, Math.max(0, p * 1.5 - 0.5)), 0, o), fxAt(fxAlong(P.a, P.z, Math.min(1, p * 1.5)), 0, o)], '#dfe9f2', 2, 1 - p)));
    fxCrescent(b, P, '#ffffff', 0.06, 0.4);
    return 0.06;
  },
  default: (b, P) => { Sound.sfx.whoosh(); fxClaws(b, P, '#ff2a3d', 3); return 0; }, // red slash
};
// Newer sprites borrow a base attack; ones left out fall back to their ability's effect.
Object.entries({
  leech: 'mite', specimen: 'mite', collector: 'mite', tangle: 'serpent', motherworm: 'serpent', drip: 'corrupt', syringe: 'surgeon', surgeonBoss: 'surgeon',
  slag: 'husk', furnace: 'sanitizer', sprayer: 'sanitizer', firewall: 'sanitizer', janitor: 'sanitizer', crane: 'mason', foreman: 'mason',
  angler: 'wisp', kernel: 'wisp', speaker: 'choir', monolith: 'choir', choirmother: 'choir', cage: 'drone', lacuna: 'ghost',
  faceless: 'knight', gatekeeper: 'knight',
}).forEach(([k, base]) => { ENEMY_FX[k] = ENEMY_FX[base]; });
const enemyFx = m => ENEMY_FX[m.sprite] || ENEMY_FX[['pierce', 'corrupt', 'double', 'surge', 'swift'].find(k => m[k])] || ENEMY_FX.default;

function endBattle(b) {
  ui = null;
  floaters = []; particles = [];
  if (b.dead) return gameOver();
  const m = b.m, cx = mapX(b.x) + 16, cy = mapY(b.y);
  setTile(b.x, b.y, '.');
  (G.decals[G.floor] ??= []).push([b.x, b.y, bleed(m), Math.floor(Math.random() * 4)]);
  shatter(b.x, b.y, spriteKey(m));
  G.kills++;
  if (m.gold) { G.gold += m.gold; flash('gold'); floater(`+${m.gold} CR`, cx, cy, '#ffc23a'); Sound.sfx.coin(); }
  G.exp += m.exp;
  flash('exp');
  hero.cooldown = 0.25;
  if (m.corrupt && G.status !== 'CORRUPT') {
    if (G.antivirus) { G.antivirus--; toast('Quarantined', '#39ff9e'); }
    else { G.status = 'CORRUPT'; toast('Corrupted', '#b98cff'); Sound.sfx.corrupt(); }
  }
  if (G.status === 'CORRUPT' && m.corrupt) G.corruptSteps = CORRUPT_STEPS;
  checkLevel();
  if (m.boss) {
    G.flags['boss' + G.floor] = true;
    shake = 0.8;
    Sound.play(floorMusic());
    if (m.outro) say(STORY[m.outro]);
  }
}

function retreat() {
  ui = null;
  floaters = []; particles = [];
  hero.cooldown = 0.3;
  Sound.sfx.stairs(false);
  toast('Retreated', '#ffc23a');
}

function checkLevel() {
  while (G.exp >= expToNext(G.lv)) {
    const g = levelGain(G.lv++, G);
    for (const k in g) if (g[k]) { G[k] += g[k]; flash(k); }
    flash('lv');
    const cx = mapX(G.x) + 16, cy = mapY(G.y) + 16;
    floater('SYNC UP!', cx, cy - 24, '#39ff9e', 10);
    toast(`Sync level ${G.lv}!  HP+${g.hp} ATK+${g.atk} DEF+${g.def}${g.agi ? ' AGI+1' : ''}`, '#39ff9e');
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * Math.PI * 2;
      particles.push({ x: cx, y: cy, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90, life: 0.7, max: 0.7, color: '#39ff9e', size: 2, grav: 0 });
    }
    Sound.sfx.level();
  }
}

function gameOver() {
  scene = 'dead';
  deadT = 0;
  Sound.stop();
  Sound.sfx.death();
  shake = 0.6;
}

// ---------------------------------------------------------------- dialog, shop, save
function say(lines, onDone) { ui = { type: 'dialog', lines, i: 0, shown: 0, onDone }; }

function advanceDialog(d) {
  const len = d.lines[d.i].text.length;
  if (d.shown < len) { d.shown = len; return; }
  Sound.sfx.select();
  if (++d.i < d.lines.length) { d.shown = 0; return; }
  ui = null;
  hero.cooldown = 0.2;
  d.onDone?.();
}

// Shops read this zone's balance: the Fabricator's price climbs with every purchase ever made.
function shopFor(ch) {
  const b = BALANCE[zoneOf()];
  if (ch === 'S') return {
    name: 'FABRICATOR', sprite: 'fabricator', text: 'INPUT: CREDIT. OUTPUT: YOU, AMENDED.',
    offers: [
      { label: `HP +${b.shop.hp}`, cost: fabricatorCost(G.buys), hp: b.shop.hp, fab: true },
      { label: `ATK +${b.shop.atk}`, cost: fabricatorCost(G.buys), atk: b.shop.atk, fab: true },
      { label: `DEF +${b.shop.def}`, cost: fabricatorCost(G.buys), def: b.shop.def, fab: true },
    ],
  };
  return {
    name: 'BROKER', sprite: 'broker', text: G.flags['npc:broker3'] ? 'Thought I was closed? So did I.' : 'No names. No questions. Credits.',
    offers: [
      { label: 'Scan Firmware', cost: b.broker.scan, flag: 'scanner' },
      { label: 'Amber Keycard', cost: b.broker.y, key: 'y' },
      { label: 'Cyan Keycard', cost: b.broker.b, key: 'b' },
      { label: 'Crimson Keycard', cost: b.broker.r, key: 'r' },
      { label: 'Antivirus Disk', cost: b.broker.v, antivirus: true },
    ],
  };
}
function openShop(ch) { hero.cooldown = 0.2; ui = { type: 'shop', ch, shop: shopFor(ch), sel: 0 }; Sound.sfx.select(); }
const soldOut = o => o.flag && G.flags[o.flag];

function buy(s) {
  const o = s.shop.offers[s.sel];
  if (!o) { ui = null; hero.cooldown = 0.2; return; }
  if (soldOut(o)) return Sound.sfx.deny();
  if (G.gold < o.cost) { Sound.sfx.deny(); return toast(`Need ${o.cost} credits`, '#ff3b4e'); }
  G.gold -= o.cost;
  flash('gold', false);
  for (const k of ['hp', 'atk', 'def']) if (o[k]) gain(k, o[k]);
  if (o.key) { G.keys[o.key]++; flash('key' + o.key); }
  if (o.flag) { G.flags[o.flag] = true; banner('Scan Firmware', '#6ff7ff', 'INSTALLED', undefined, undefined, 'M  read what waits on this floor'); }
  if (o.antivirus) { if (G.status === 'CORRUPT') G.status = 'NORMAL'; else G.antivirus++; }
  if (o.fab) G.buys++;
  s.shop = shopFor(s.ch);
  burst(mapX(G.x) + 16, mapY(G.y) + 16, '#6ff7ff', 16, 70);
  Sound.sfx.buy();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(G)); toast('State saved', '#39ff9e'); Sound.sfx.select(); }
  catch { toast('Save failed', '#ff3b4e'); }
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; } }
function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { }
  if (!s) { Sound.sfx.deny(); return toast('No saved state', '#ff3b4e'); }
  G = s;
  // Older saves lack G.weapon: infer it from the weapon tiles already taken.
  G.weapon ??= MAPS.reduce((best, m, f) => (m.some((r, y) => [...r].some((c, x) => c === 'w' && G.maps[f][y][x] !== 'w')) ? Math.max(best, FLOOR_ZONE[f]) : best), -1);
  G.decals ??= {}; // older saves have no death decals
  G.read ??= {};
  enterPlay();
  toast('State restored', '#39ff9e');
}

// ---------------------------------------------------------------- input
const DIRS = { ArrowUp: [0, -1, 'U'], ArrowDown: [0, 1, 'D'], ArrowLeft: [-1, 0, 'L'], ArrowRight: [1, 0, 'R'] };
const CONFIRM = new Set(['Enter', ' ', 'z', 'Z']);

function handleKey(key) {
  Sound.init();
  if (scene === 'title') return titleKey(key);
  if (scene === 'dead') {
    if (key === 'r' || key === 'R') newGame();
    else if (key === 'l' || key === 'L') load();
    else if (CONFIRM.has(key) && deadT > 1) toTitle();
    return;
  }
  if (scene === 'ending') { if (CONFIRM.has(key) && endT > STORY[ending].length * 2.2 + 1) toTitle(); return; }
  if (ui) return uiKey(key);
  if (DIRS[key]) { pendingDir = key; return; }
  const k = key.toLowerCase();
  if (k === 'm') {
    if (!G.flags.scanner) return Sound.sfx.deny();
    ui = { type: 'book' }; Sound.sfx.select();
  }
  else if (k === 'h') { ui = { type: 'help' }; Sound.sfx.select(); }
  else if (k === 'e') { if (tile(G.x, G.y) === 'n') readNote(); else Sound.sfx.deny(); }
  else if (k === 'f') {
    if (!G.flags.compass) return Sound.sfx.deny();
    const floors = G.visited.filter(f => !isVault(f)).sort((a, b) => a - b);
    ui = { type: 'fly', floors, sel: Math.max(0, floors.indexOf(G.floor)) };
    Sound.sfx.select();
  }
  else if (k === 's') save();
  else if (k === 'l') load();
  else if (k === 'n') toast(Sound.toggleMute() ? 'Sound off' : 'Sound on');
  else if (k === 'r') {
    if (time - lastR < 1.5) newGame(); else { lastR = time; toast('Press R again to restart', '#ff8a3c'); }
  }
}

function uiKey(key) {
  const close = () => { ui = null; hero.cooldown = 0.2; };
  if (ui.type === 'dialog' && (CONFIRM.has(key) || key === 'Escape')) advanceDialog(ui);
  else if (ui.type === 'banner' && (CONFIRM.has(key) || DIRS[key] || key === 'Escape')) { const then = ui.then; close(); then?.(); }
  else if (ui.type === 'fly') {
    const step = { ArrowUp: 1, ArrowDown: -1, ArrowRight: 10, ArrowLeft: -10 }[key];
    if (step) { ui.sel = Math.max(0, Math.min(ui.floors.length - 1, ui.sel + step)); Sound.sfx.select(); }
    else if (CONFIRM.has(key)) { const f = ui.floors[ui.sel]; if (ABANDONED.has(f) && f !== G.floor) return Sound.sfx.deny(); close(); if (f !== G.floor) changeFloor(f, f === 0 ? 'U' : 'D'); }
    else if (key === 'Escape' || key === 'f' || key === 'F') close();
  }
  else if (ui.type === 'choice') {
    if (key === 'ArrowUp' || key === 'ArrowDown') { ui.sel = 1 - ui.sel; Sound.sfx.select(); }
    else if (CONFIRM.has(key)) finish(ui.sel ? 'endingSky' : 'endingSignature');
  }
  else if (ui.type === 'battle') {
    if (CONFIRM.has(key)) ui.fast = true;
    else if ((key === 'q' || key === 'Q') && !ui.over) retreat();
  }
  else if (ui.type === 'book' && ['m', 'M', 'Escape', ...CONFIRM].includes(key)) close();
  else if (ui.type === 'help') close();
  else if (ui.type === 'shop') {
    const n = ui.shop.offers.length + 1;
    if (key === 'ArrowUp' || key === 'ArrowDown') { ui.sel = (ui.sel + (key === 'ArrowUp' ? n - 1 : 1)) % n; Sound.sfx.select(); }
    else if (CONFIRM.has(key)) buy(ui);
    else if (key === 'Escape') close();
  }
}

function titleKey(key) {
  const opts = hasSave() ? 2 : 1;
  if (!Sound.muted) Sound.play('title');
  if (key === 'ArrowUp' || key === 'ArrowDown') { titleSel = (titleSel + 1) % opts; Sound.sfx.select(); }
  else if (CONFIRM.has(key)) { Sound.sfx.select(); titleSel === 1 && opts === 2 ? load() : newGame(); }
}

function toTitle() { scene = 'title'; titleSel = 0; Sound.play('title'); }

addEventListener('keydown', e => {
  if (DIRS[e.key] || e.key === ' ') e.preventDefault();
  if (e.repeat && (!DIRS[e.key] || hero.move || pendingDir)) return;
  handleKey(e.key);
});
cv.addEventListener('pointerdown', () => handleKey('Enter'));

document.querySelectorAll('[data-key]').forEach(btn => {
  const key = btn.dataset.key;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); handleKey(key); });
});

// ---------------------------------------------------------------- update
function spawnMotes() {
  motes = Array.from({ length: 30 }, () => ({ x: Math.random() * MW, y: Math.random() * MW, s: Math.random(), p: Math.random() * 10 }));
}

function update(dt) {
  time += dt;
  shake = Math.max(0, shake - dt);
  particles = particles.filter(p => (p.life -= dt) > 0);
  particles.forEach(p => { p.vy += p.grav * dt; p.x += p.vx * dt; p.y += p.vy * dt; });
  floaters = floaters.filter(f => (f.life -= dt) > 0);
  floaters.forEach(f => { f.y -= 28 * dt; });
  toasts = toasts.filter(t => (t.life -= dt) > 0);
  doorAnims = doorAnims.filter(d => (d.t += dt) < 0.25);
  const mote = G ? ZONES[zoneOf()].theme.mote : 'dust';
  motes.forEach(m => {
    if (mote === 'data' || mote === 'ash') m.y += (mote === 'ash' ? 8 + m.s * 10 : 30 + m.s * 40) * dt;
    else if (mote === 'bubble') { m.y -= (10 + m.s * 20) * dt; m.x += Math.sin(time * 2 + m.p) * 8 * dt; }
    else if (mote === 'spark') { m.y -= (20 + m.s * 40) * dt; m.x += Math.sin(time * 3 + m.p) * 10 * dt; }
    else { m.y -= (4 + m.s * 6) * dt; m.x += (6 + m.s * 6) * dt; }
    if (m.y > MW) m.y -= MW; if (m.y < 0) m.y += MW; if (m.x > MW) m.x -= MW;
  });

  if (scene === 'ending') endT += dt;
  if (scene === 'dead') deadT += dt;
  if (scene !== 'play') return;

  if (ui) return updateUi(dt);
  hero.cooldown = Math.max(0, hero.cooldown - dt);
  if (hero.nudge && (hero.nudge.t -= dt) <= 0) hero.nudge = null;
  if (hero.move) {
    hero.move.t += dt / MOVE_TIME;
    if (hero.move.t >= 1) { hero.move = null; arrive(); }
    return;
  }
  if (pendingDir && hero.cooldown <= 0) { tryMove(...DIRS[pendingDir]); pendingDir = null; }
}

function updateUi(dt) {
  if (ui.type === 'dialog') {
    const before = Math.floor(ui.shown);
    ui.shown = Math.min(ui.lines[ui.i].text.length, ui.shown + dt * 55);
    if (Math.floor(ui.shown) > before && before % 3 === 0) Sound.sfx.blip();
  } else if (ui.type === 'battle') updateBattle(ui, dt);
  else if (ui.type === 'fade') {
    ui.t += dt;
    if (ui.t >= 0.25 && !ui.done) { ui.done = true; ui.mid(); }
    if (ui.t >= 1.1) { const after = ui.after; ui = null; after?.(); }
  } else if (ui.type === 'goal') {
    ui.t += dt;
    if (ui.t > 2.2) { ui = null; scene = 'ending'; endT = 0; Sound.play('ending'); }
  }
}

// ---------------------------------------------------------------- drawing helpers
function text(str, x, y, { size = 8, color = '#f2f0ea', align = 'left', font = FONT, shadow = true, alpha = 1, italic = false } = {}) {
  ctx.font = `${italic ? 'italic ' : ''}${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.globalAlpha = alpha;
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(str, x + 1, y + 1); }
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
  ctx.globalAlpha = 1;
}
const body = (str, x, y, opts = {}) => text(str, x, y, { size: 20, font: BODY, ...opts });
function wrap(str, maxW, size, font = BODY) {
  ctx.font = `${size}px ${font}`;
  const lines = [];
  let cur = '';
  for (const w of str.split(' ')) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  return [...lines, cur];
}
// The original's signature box: dark textured fill with a cyan border.
function panel(x, y, w, h, border = CYAN) {
  panelPattern ??= ctx.createPattern(panelTex, 'repeat');
  ctx.fillStyle = panelPattern;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = border;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);
}
function portraitFrame(name, x, y, size = 48) {
  ctx.fillStyle = '#15161b';
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, size - 2, size - 2);
  ctx.drawImage(sprite(name), x + 6, y + 6, size - 12, size - 12);
}
const spr = (name, x, y, s = 32) => ctx.drawImage(sprite(name), x, y, s, s);
const enterHint = (x, y) => body('-Enter-', x, y, { size: 18, color: '#8a8f9c', align: 'right', shadow: false, alpha: 0.6 + 0.4 * Math.sin(time * 4) });

// Stairs open toward the side you walk in from: the only open neighbour, else (room corners) an open side
// backed by a wall, ties broken in arrival order N S E W. The steps recede away from that side.
const SIDES = [[0, -1], [0, 1], [1, 0], [-1, 0]];
function stairFacing(x, y) {
  const open = (dx, dy) => !solid(G.maps[G.floor], x + dx, y + dy);
  let best = 1, score = 0;
  SIDES.forEach(([dx, dy], i) => {
    const s = open(dx, dy) ? 2 + !open(-dx, -dy) : 0;
    if (s > score) { best = i; score = s; }
  });
  return best;
}
// 16x16 stairwell drawn entering from the bottom, then turned to face. Up: steps climb toward the light.
// Down: steps sink into a black shaft. Gold = vault stairs.
const stairCache = {};
function stairSprite(up, gold, facing) {
  const z = zoneOf(), key = [z, up, gold, facing].join();
  if (!stairCache[key]) {
    const th = ZONES[z].theme, [hi, mid, lo, dark] = gold ? [PAL.O, PAL.y, PAL.Y, PAL.N] : [th.hi, th.wall, th.mortar, th.seam];
    const base = canvasOf(16, 16, g => {
      rect(g, PAL.h, 0, 0, 16, 16);
      for (let k = 0; k < 5; k++) { // k = 0 far end .. 4 at the entry
        const y = 1 + k * 3;
        if (up) {
          const c = mix(hi, mid, k / 4);
          rect(g, c, 2, y, 12, 2); rect(g, mix(lo, PAL.h, 0.5), 2, y + 2, 12, 1);
        } else { // narrowing into the shaft
          const c = mix(PAL.h, mid, (k + 1) / 5), n = [3, 2, 2, 1, 0][k];
          rect(g, mix(lo, PAL.h, 0.5), 1, y, 14, 3);
          rect(g, mix(c, hi, 0.3), 2 + n, y + 1, 12 - n * 2, 1); rect(g, c, 2 + n, y + 2, 12 - n * 2, 1);
        }
      }
      rect(g, lo, 1, 0, 1, 16); rect(g, lo, 14, 0, 1, 16);
      rect(g, dark, 0, 0, 1, 16); rect(g, dark, 15, 0, 1, 16); rect(g, dark, 0, 0, 16, 1);
    });
    stairCache[key] = canvasOf(16, 16, g => { g.translate(8, 8); g.rotate([Math.PI, 0, -Math.PI / 2, Math.PI / 2][facing]); g.drawImage(base, -8, -8); });
  }
  return stairCache[key];
}
function drawStairs(px, py, x, y, up, gold = false) {
  ctx.drawImage(stairSprite(up, gold, stairFacing(x, y)), px, py, TS, TS);
  // Screen-aligned up/down arrow, bobbing the way it leads.
  const key = 'arrow' + up + gold, bob = Math.round(0.5 + 0.5 * Math.sin(time * 4)) * (up ? -2 : 2);
  spriteCache[key] ??= buildSprite(up ? STAIR_ARROW : [...STAIR_ARROW].reverse(), { c: gold ? 'w' : up ? 'c' : 'o' });
  spr(key, px, py + bob);
}
const STAIR_ARROW = ['', '', '', '', '', '.......cc', '......cccc', '.....cccccc', '....cccccccc', '.......cc', '.......cc', '', '', '', '', ''];

// ---------------------------------------------------------------- map
function tileSpriteName(ch, x, y) {
  if (isMonster(ch)) return spriteKey(monsterAt(ch));
  if (ITEMS[ch]) return ITEMS[ch].sprite;
  if (ch === 'O') return spriteKey(NPCS[meta().npcs[metaKey(x, y)]]);
  return { Y: 'doorY', B: 'doorB', R: 'doorR', S: 'fabricator', M: 'broker', n: 'note', L: G.flags['boss' + G.floor] ? 'root' : 'rootDark' }[ch];
}

function glow(px, py, rgb, r = 30) {
  const gr = ctx.createRadialGradient(px + 16, py + 16, 2, px + 16, py + 16, r);
  gr.addColorStop(0, `rgba(${rgb},${0.35 + 0.15 * Math.sin(time * 3)})`);
  gr.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = gr;
  ctx.fillRect(px - 16, py - 16, 64, 64);
}

// ---------------------------------------------------------------- idle animation
// Idle style per base sprite name; unknown names fall back to 'breathe'. frame = extra frame in data.js,
// look = frame glancing left (flipped to track the hero), face: 1 = the art faces right (flipped to face the hero).
const IDLE = {
  mite: { style: 'skitter', frame: 'miteB' },
  wisp: { style: 'hover', frame: 'wispB', rate: 4, glitch: true },
  husk: { style: 'shamble', face: 1 },
  sanitizer: { style: 'stance', look: 'sanitizerL', legs: 11 },
  serpent: { style: 'slither', frame: 'serpentT', face: 1 },
  mason: { style: 'stomp', frame: 'masonB' },
  drone: { style: 'hover', frame: 'droneB', rate: 14 },
  turret: { style: 'sentry', look: 'turretL' },
  hound: { style: 'pant', frame: 'houndP', face: 1 },
  ghost: { style: 'glitch' },
  surgeon: { style: 'stance', frame: 'surgeonB', legs: 12 },
  choir: { style: 'hover', frame: 'choirB', rate: 2.5 },
  knight: { style: 'stance', look: 'knightL', legs: 11, slow: true },
  warden: { style: 'dread', frame: 'wardenE' },
  archivist: { style: 'glitch', still: true },
  lambda: { style: 'glitch', still: true },
  brann: { style: 'breathe', face: 1 },
  ohm: { style: 'breathe', face: 1 },
  pip: { style: 'hop' },
  broker: { style: 'breathe', face: 1 },
  ...Object.fromEntries([
    ['hover', 'drip syringe cage crow seraph lacuna pages angler daemon'],
    ['glitch', 'mirror mourner faceless'],
    ['slither', 'leech motherworm burrow tangle'],
    ['stomp', 'crab furnace tomb collector crane foreman gatekeeper janitor'],
    ['shamble', 'patient drowned specimen'],
    ['dread', 'heir choirmother librarian surgeonBoss monolith'],
    ['hop', 'kernel slag'],
  ].flatMap(([style, names]) => names.split(' ').map(n => [n, { style }]))),
};
const idleWave = (t, hz, seed) => Math.sin((t * hz + seed) * 2 * Math.PI);
const idleBeat = (t, per, len, seed) => (t + seed * per) % per < len; // on for len s out of every per s
// Bands: rows [0,cut) rise 1 sprite pixel (d=1, row cut-1 repeats) or sink 1 (d=-1, row cut drops).
const idleLift = (cut, d) => d > 0 ? [[cut - 1, 16, 0, 0], [0, cut, 0, -1]] : d < 0 ? [[cut + 1, 16, 0, 0], [0, cut, 0, 1]] : null;
const IDLE_STYLES = {
  breathe: (p, t, s, c) => { p.bands = idleLift(c.cut || 7, idleWave(t, 0.45, s) > 0.2 ? 1 : 0); },
  hop: (p, t, s) => { p.y = idleBeat(t, 1.8, 0.3, s) ? -2 : 0; if (idleBeat(t + 1.5, 1.8, 0.1, s)) p.bands = idleLift(8, -1); },
  skitter: (p, t, s, c) => {
    const run = idleBeat(t, 2.4, 0.7, s);
    p.frame = Math.floor(t * (run ? 12 : 1.5) + s * 4) % 2 ? c.frame : null;
    if (run) p.x = (Math.floor(t * 8) % 4 < 2 ? 1 : 0) * (s < 0.5 ? 1 : -1);
  },
  hover: (p, t, s, c) => {
    p.y = -1 - Math.round(idleWave(t, 0.5, s) + 1);
    p.shadow = 1;
    if (Math.floor(t * c.rate + s * 7) % 2) p.frame = c.frame;
    if (c.glitch && idleBeat(t, 1.7, 0.08, s)) p.x = s < 0.5 ? 1 : -1;
  },
  glitch: (p, t, s, c) => {
    if (!c.still) { p.y = -Math.round(idleWave(t, 0.35, s) + 1); p.shadow = 0.5; }
    p.alpha = 0.75 + 0.25 * Math.sin(t * 9 + Math.sin(t * 23) + s * 9);
    if (idleBeat(t, 1.3 + s, 0.12, s)) {
      const r = 2 + Math.floor(hash(Math.floor(t * 10), 3, Math.floor(s * 1000)) * 9), dx = s < 0.5 ? 1 : -1;
      p.bands = [[0, r, 0, 0], [r, r + 3, dx, 0], [r + 3, 16, -dx, 0]];
    }
  },
  slither: (p, t, s, c) => {
    const w = k => Math.round(idleWave(t, 0.7, s - k * 0.18));
    p.bands = [[10, 16, w(2), 0], [5, 10, w(1), 0], [0, 5, w(0), 0]];
    if (idleBeat(t, 1.9, 0.2, s)) p.frame = c.frame;
  },
  sentry: (p, t, s) => { if (idleBeat(t, 1.3, 0.1, s)) p.spark = p.frame ? [p.flip ? 12 : 2, 4] : [7, 4]; }, // muzzle blink
  pant: (p, t, s, c) => {
    const pant = idleWave(t, 0.2, s) > -0.2, open = pant && Math.floor(t * 5 + s * 3) % 2;
    if (open) p.frame = c.frame;
    p.bands = idleBeat(t, 5, 0.7, s) ? idleLift(7, -1) : idleLift(7, open ? 1 : 0);
  },
  stance: (p, t, s, c) => {
    const lean = Math.round(idleWave(t, c.slow ? 0.18 : 0.3, s) * 0.75), up = idleWave(t, 0.5, s + 0.3) > 0.3;
    p.bands = [[c.legs, 16, 0, 0], [c.legs - 1, c.legs, lean, 0], [0, c.legs, lean, up ? -1 : 0]];
    if (c.frame && idleBeat(t, 3.2, 0.5, s)) p.frame = c.frame;
  },
  stomp: (p, t, s, c) => {
    const k = (t + s * 2.6) % 2.6;
    p.x = Math.floor((t + s * 2.6) / 2.6) % 2;
    if (k < 0.15) p.bands = idleLift(9, -1);
    if (idleBeat(t, 3.7, 0.15, s)) p.frame = c.frame;
  },
  shamble: (p, t, s) => {
    p.bands = idleBeat(t, 2.9, 0.25, s) ? [[7, 16, 0, 0], [0, 7, s < 0.5 ? 1 : -1, 0]] : idleLift(7, idleWave(t, 0.35, s) > 0.4 ? 1 : 0);
  },
  dread: (p, t, s, c) => {
    p.bands = idleLift(8, idleWave(t, 0.3, s) > 0.2 ? 1 : 0);
    if (idleBeat(t, 3.5, 0.6, s)) p.frame = c.frame;
  },
};
// Idle pose of a creature at time t. seed (0-1) desyncs neighbours, face = side the hero is on (-1/0/1),
// heavy = boss: slower, with a periodic red pulse. x/y and bands are in sprite pixels, so motion stays on the grid.
function idlePose(name, t, seed = 0, face = 0, heavy = false) {
  const c = IDLE[VARIANTS[name]?.[0] || name] || { style: 'breathe' };
  const p = { x: 0, y: 0, flip: false, frame: null, bands: null, alpha: 1, shadow: 0, pulse: 0, spark: null };
  if (heavy) t *= 0.6;
  let side = face;
  if (idleBeat(t, 4 + seed * 3, c.style === 'sentry' ? 1.2 : 0.6, seed)) side = side ? -side : seed < 0.5 ? -1 : 1;
  if (c.look && side) { p.frame = c.look; p.flip = side > 0; }
  else if (c.face && side) p.flip = side * c.face < 0;
  IDLE_STYLES[c.style](p, t, seed, c);
  if (heavy) { const k = (t + seed * 3.5) % 3.5; if (k < 0.6) p.pulse = Math.sin(k / 0.6 * Math.PI); }
  return p;
}
// Cached derived canvases of a cached sprite: '#f' mirrored, '#r' flat red silhouette.
function spriteFx(key, fx) {
  return spriteCache[key + fx] ??= canvasOf(16, 16, g => {
    if (fx === '#f') { g.scale(-1, 1); g.drawImage(sprite(key), -16, 0); return; }
    g.drawImage(sprite(key), 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = '#ff3b4e';
    g.fillRect(0, 0, 16, 16);
  });
}
function drawIdle(def, x, y, p, s = TS) {
  const v = VARIANTS[def.sprite], u = s / 16;
  let key = spriteKey(p.frame ? { sprite: p.frame, swap: v ? { ...v[1], ...def.swap } : def.swap } : def);
  if (p.flip) { spriteFx(key, '#f'); key += '#f'; }
  x += p.x * u;
  if (p.shadow) { // shrinks as the creature rises
    const w = (7 + p.y) * u, sx = x + s / 2 - w / 2, sy = y + 13 * u;
    ctx.fillStyle = `rgba(0,0,0,${0.3 * p.shadow})`;
    ctx.fillRect(sx + u, sy, w - 2 * u, u);
    ctx.fillRect(sx, sy + u, w, u);
  }
  y += p.y * u;
  const blit = img => p.bands ? p.bands.forEach(([a, b, dx, dy]) => ctx.drawImage(img, 0, a, 16, b - a, x + dx * u, y + (a + dy) * u, s, (b - a) * u)) : ctx.drawImage(img, x, y, s, s);
  ctx.globalAlpha = p.alpha;
  blit(sprite(key));
  if (p.pulse) { ctx.globalAlpha = p.pulse * 0.45; blit(spriteFx(key, '#r')); }
  ctx.globalAlpha = 1;
  if (p.spark) rect(ctx, '#fff', x + p.spark[0] * u, y + p.spark[1] * u, 2 * u, u);
}

// Gore left where something died: blood from flesh, black oil from machines. Pixel splats, cached per variant.
const OILY = new Set('wisp sanitizer mason drone turret janitor syringe slag crab furnace crane foreman seraph speaker sprayer gatekeeper lacuna monolith daemon firewall collector'.split(' '));
const bleed = m => (OILY.has(VARIANTS[m.sprite]?.[0] || m.sprite) ? 'oil' : 'blood');
const GORE = { blood: ['#4a0a10', '#860e1a', '#c0121e'], oil: ['#050607', '#12181a', '#3f5c58'] }; // edge, pool, wet glint / spray
function splat(kind, v) {
  return spriteCache['splat' + kind + v] ??= canvasOf(16, 16, g => {
    const [edge, pool, wet] = GORE[kind], r = i => hash(v, i, 31);
    const cx = 6 + r(1) * 4, cy = 6 + r(2) * 4, a = 3 + r(3) * 2, b = 2 + r(4) * 2, th = r(5) * Math.PI * 2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      const d = Math.hypot((x - cx) / a, (y - cy) / b) + (hash(x, y, v + 7) - 0.5) * 0.6;
      if (d < 1) rect(g, d > 0.75 ? edge : hash(x, y, v + 9) < 0.12 ? wet : pool, x, y);
    }
    for (let i = 0; i < 8; i++) { // droplets flung one way
      const t = 1.2 + r(10 + i) * 1.6, s = th + (r(20 + i) - 0.5) * 1.2;
      rect(g, i % 3 ? pool : edge, Math.round(cx + Math.cos(s) * a * t), Math.round(cy + Math.sin(s) * b * t * 1.3), i < 2 ? 2 : 1, 1);
    }
  });
}

function drawMap() {
  if (!floorBg[G.floor]) buildFloorBg(G.floor);
  ctx.drawImage(floorBg[G.floor], MX, MY, MW, MW);
  G.decals[G.floor]?.forEach(([x, y, kind, v]) => ctx.drawImage(splat(kind, v), mapX(x), mapY(y), TS, TS));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = tile(x, y), px = mapX(x), py = mapY(y);
    if (ch === '.' || ch === '#' || ch === '%') continue;
    if (ch === 'U' || ch === 'D') { drawStairs(px, py, x, y, ch === 'U'); continue; }
    if (ch === '^') { glow(px, py, '255,194,58'); drawStairs(px, py, x, y, isVault(G.floor), true); continue; }
    const m = isMonster(ch) ? monsterAt(ch) : null, npc = ch === 'O' ? NPCS[meta().npcs[metaKey(x, y)]] : null;
    if (m?.boss) glow(px, py, '255,59,78');
    if (ch === 'L') glow(px, py, G.flags['boss' + G.floor] ? '111,247,255' : '60,70,90');
    if (ch === '*') glow(px, py, '255,194,58', 26);
    if (m?.aura) {
      ctx.strokeStyle = `rgba(255,59,78,${0.25 + 0.15 * Math.sin(time * 5)})`;
      ctx.lineWidth = 1;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => ctx.strokeRect(px + dx * TS + 2.5, py + dy * TS + 2.5, TS - 5, TS - 5));
    }
    const def = m || npc || (ch === 'M' ? { sprite: 'broker' } : null);
    if (def) {
      const p = idlePose(def.sprite, time, hash(x, y, G.floor), Math.sign(G.x - x), m?.boss);
      if (npc?.ghost) p.alpha = 0.75 + 0.25 * Math.sin(time * 9 + Math.sin(time * 23));
      drawIdle(def, px, py, p);
      continue;
    }
    if (ch === 'n') ctx.globalAlpha = G.read[noteKey(x, y)] ? 0.35 : 0.55 + 0.35 * Math.sin(time * 2 + x);
    spr(tileSpriteName(ch, x, y), px, py);
    ctx.globalAlpha = 1;
  }
  doorAnims.filter(d => d.f === G.floor).forEach(d => {
    const p = d.t / 0.25, s = sprite(tileSpriteName(d.ch));
    ctx.drawImage(s, 0, 16 * p, 16, 16 * (1 - p), mapX(d.x), mapY(d.y), TS, TS * (1 - p));
  });
  if (Math.random() < 0.04) {
    const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N);
    if (ITEMS[tile(x, y)]) particles.push({ x: mapX(x) + 8 + Math.random() * 16, y: mapY(y) + 8 + Math.random() * 16, vx: 0, vy: -10, life: 0.5, max: 0.5, color: '#fff', size: 2, grav: 0 });
  }
  drawHero();
}

function heroPos() {
  let x = G.x, y = G.y;
  if (hero.move) { const t = hero.move.t; x = hero.move.fx + (G.x - hero.move.fx) * t; y = hero.move.fy + (G.y - hero.move.fy) * t; }
  if (hero.nudge) { const k = Math.sin(hero.nudge.t / 0.12 * Math.PI) * 0.12; x += hero.nudge.dx * k; y += hero.nudge.dy * k; }
  return [mapX(x), mapY(y)];
}

function drawHero() {
  const [x, y] = heroPos();
  const walk = hero.move ? -Math.abs(Math.sin(hero.move.t * Math.PI)) * 3 : 0;
  const name = { D: 'heroD', U: 'heroU', L: 'heroR', R: 'heroR' }[G.dir];
  ctx.save();
  if (G.dir === 'L') { ctx.translate(x + TS, 0); ctx.scale(-1, 1); spr(name, 0, y + walk); }
  else spr(name, x, y + walk);
  ctx.restore();
  if (!ui && !hero.move && tile(G.x, G.y) === 'n' && G.read[noteKey(G.x, G.y)]) drawKeyTip('E', x + TS / 2, G.y ? y - 10 : y + TS + 10);
}

// Small keycap hint centred on (cx, cy), bobbing gently.
function drawKeyTip(k, cx, cy) {
  const x = Math.round(cx - 8), y = Math.round(cy - 8 + Math.sin(time * 4));
  ctx.globalAlpha = 0.9;
  rect(ctx, '#07080c', x, y, 16, 16);
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, 15, 15);
  rect(ctx, '#1a8fa0', x + 1, y + 13, 14, 2);
  text(k, cx, y + 4, { size: 8, align: 'center', shadow: false });
  ctx.globalAlpha = 1;
}

function drawMotes() {
  const { mote, moteColor } = ZONES[zoneOf()].theme;
  motes.forEach(m => {
    const x = MX + m.x, y = MY + m.y;
    if (mote === 'data') return text(m.s > 0.5 ? '1' : '0', x, y, { size: 10, font: BODY, color: moteColor, shadow: false, alpha: 0.12 + m.s * 0.2 });
    ctx.globalAlpha = mote === 'spark' ? 0.3 + 0.4 * Math.abs(Math.sin(time * 6 + m.p)) : 0.1 + m.s * 0.15;
    ctx.fillStyle = moteColor;
    if (mote === 'bubble') { ctx.strokeStyle = moteColor; ctx.lineWidth = 1; ctx.strokeRect(x, y, 3, 3); }
    else ctx.fillRect(x, y, 2, 2);
  });
  ctx.globalAlpha = 1;
}

function drawFx() {
  particles.forEach(p => {
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.5);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x, p.y, p.size, p.size);
  });
  ctx.globalAlpha = 1;
  floaters.forEach(f => {
    const pop = f.life > 0.85 ? 1 + (f.life - 0.85) * 3 : 1;
    text(f.text, f.x, f.y, { size: Math.round(f.size * pop), color: f.color, align: 'center', alpha: Math.min(1, f.life * 2) });
  });
}

function drawToasts() {
  toasts.forEach((t, i) => {
    const a = Math.min(1, t.life * 3);
    ctx.globalAlpha = a * 0.88;
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(MX + 16, MY + 6 + i * 24, MW - 32, 21);
    ctx.globalAlpha = 1;
    body(t.text, MX + MW / 2, MY + 7 + i * 24, { size: 18, color: t.color, align: 'center', alpha: a });
  });
}

// ---------------------------------------------------------------- chrome: status + keys panels, floor tab
function flashColor(k, base = '#f2f0ea') {
  const f = statFlash[k];
  if (!f || time - f.t > 0.7) return base;
  return Math.floor((time - f.t) * 12) % 2 ? base : f.up ? '#39ff9e' : '#ff3b4e';
}

function drawChrome() {
  ctx.drawImage(backdrop, 0, 0, W, H);

  // Floor tab above the map.
  ctx.fillStyle = '#25272e';
  ctx.fillRect(MX + MW / 2 - 60, 10, 120, MY - 10);
  body(floorLabel(G.floor), MX + MW / 2, 17, { size: 22, align: 'center' });

  // Status panel.
  const sx = 24, sy = MY, sw = 144;
  panel(sx, sy, sw, 216);
  spr('heroD', sx + 8, sy + 8);
  body('Status:', sx + 48, sy + 4, { size: 18 });
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(sx + 48, sy + 24, sw - 58, 20, 4);
  ctx.stroke();
  const corrupt = G.status === 'CORRUPT';
  body(G.status, sx + 48 + (sw - 58) / 2, sy + 25, { size: 18, align: 'center', color: corrupt ? (Math.floor(time * 3) % 2 ? '#b98cff' : '#ff3b4e') : '#c9c6bd' });
  [['Level', G.lv, 'lv'], ['HP', G.hp, 'hp'], ['ATK', G.atk, 'atk'], ['DEF', G.def, 'def'], ['CRIT', G.crit, 'crit'], ['AGI', G.agi, 'agi'], ['EXP', G.exp, 'exp']]
    .forEach(([label, val, k], i) => {
      const y = sy + 52 + i * 23, f = statFlash[k];
      body(label + ':', sx + 10, y);
      body(String(val), sx + sw - 14, y - (f && time - f.t < 0.25 ? 2 : 0), { align: 'right', italic: true, color: flashColor(k) });
    });

  // Keys panel.
  const ky = MY + 228;
  panel(sx, ky, sw, 124);
  [['cardY', G.keys.y, 'keyy'], ['cardB', G.keys.b, 'keyb'], ['cardR', G.keys.r, 'keyr'], ['credit', G.gold, 'gold']].forEach(([icon, n, k], i) => {
    const y = ky + 6 + i * 28;
    spr(icon, sx + 8, y);
    text('X', sx + 52, y + 10, { size: 12 });
    body(String(n), sx + sw - 14, y + 4, { size: 26, align: 'right', color: flashColor(k) });
  });

  // Map frame.
  ctx.strokeStyle = CYAN;
  ctx.lineWidth = 3;
  ctx.strokeRect(MX - 2.5, MY - 2.5, MW + 5, MW + 5);

  body('-Press H-', MX + MW, H - 26, { size: 22, color: '#ff4d6d', align: 'right' });

  // Carried extras under the keys panel: antivirus disks and memory shards.
  if (G.antivirus) { spr('floppy', sx + 2, H - 30, 24); body(`x${G.antivirus}`, sx + 26, H - 28, { size: 18 }); }
  for (let i = 0; i < G.shards; i++) spr('shard', sx + 70 + i * 16, H - 30, 20);
}

// ---------------------------------------------------------------- modals
function drawDialog(d) {
  const line = d.lines[d.i], portrait = PORTRAITS[line.who];
  const x = MX + 22, w = MW - 44, tx = portrait ? x + 66 : x + 16;
  const lines = wrap(line.text, x + w - tx - 12, 18);
  const h = Math.max(portrait ? 100 : 76, 42 + lines.length * 18 + 22), y = MY + 36;
  panel(x, y, w, h);
  if (portrait) {
    portraitFrame(portrait, x + 10, y + 10, 46);
    body(line.who, tx + (x + w - tx) / 2 - 6, y + 6, { size: 22, align: 'center', color: '#ffc23a' });
  }
  let left = Math.floor(d.shown);
  lines.forEach((l, i) => {
    body(l.slice(0, Math.max(0, left)), tx, y + (portrait ? 30 : 14) + i * 18, { size: 18 });
    left -= l.length + 1;
  });
  if (d.shown >= line.text.length) enterHint(x + w - 12, y + h - 22);
}

function drawBanner(b) {
  const x = MX - 56, w = MW + 56 + 28, y = MY + 168;
  const lines = [...(b.use ? [[b.use, '#6ff7ff']] : []), ...(b.lore ? wrap(b.lore, w - 132, 16) : []).map(l => [l, '#9ea2ad'])];
  const h = 34 + (lines.length ? lines.length * 15 + 4 : 0);
  panel(x, y, w, h);
  text(b.label, x + 12, y + 13, { size: 9, color: '#ffc23a' });
  body(b.text, x + 116, y + 7, { color: b.color });
  lines.forEach(([l, color], i) => body(l, x + 116, y + 29 + i * 15, { size: 16, color }));
  enterHint(x + w - 12, y + 8);
}

function drawBattle(b) {
  ctx.fillStyle = 'rgba(2,3,8,0.45)';
  ctx.fillRect(MX, MY, MW, MW);
  ctx.save();
  if (b.quake) ctx.translate((Math.random() - 0.5) * b.quake * 24, (Math.random() - 0.5) * b.quake * 16);
  panel(BOX.x, BOX.y, BOX.w, BOX.h, b.m.boss ? '#ff3b4e' : CYAN);
  body(b.m.name, FRAME.M.x, BOX.y + 8, { size: 22, color: b.m.boss ? '#ff3b4e' : '#f2f0ea' });
  text('VS', BOX.x + BOX.w / 2, BOX.y + 12 + Math.sin(time * 6), { size: 14, color: '#f2f0ea', align: 'center' });
  body('Rho', FRAME.H.x + 48, BOX.y + 8, { size: 22, align: 'right' });

  drawFighter(b, 'M', spriteKey(b.m));
  drawFighter(b, 'H', 'heroD');

  const rows = [['HP', b.mhp, G.hp], ['ATK', b.m.atk, G.atk], ['DEF', b.m.def, G.def], ['CRIT', b.m.crit, G.crit], ['AGI', b.m.agi, G.agi]];
  rows.forEach(([label, mv, hv], i) => {
    const y = BOX.y + 34 + i * 22;
    body(label + ':', FRAME.M.x + 58, y);
    body(String(mv), FRAME.M.x + 158, y, { align: 'right', color: i === 0 && b.mFlash ? (Math.floor(b.mFlash * 16) % 2 ? '#ff3b4e' : '#fff') : '#f2f0ea' });
    body(String(hv), FRAME.H.x - 74, y, { align: 'right', color: i === 0 ? flashColor('hp') : '#f2f0ea' });
    body(':' + label, FRAME.H.x - 68, y);
  });
  if (!b.over) {
    body('Retreat(Q)', BOX.x + BOX.w - 14, BOX.y + BOX.h - 26, { size: 20, color: '#ffd23f', align: 'right' });
    if (!b.fast) body('Space: fast', BOX.x + 14, BOX.y + BOX.h - 24, { size: 16, color: '#6e6b66', shadow: false });
  } else if (!b.dead) text('TARGET DELETED', BOX.x + BOX.w / 2, BOX.y + BOX.h - 22, { size: 9, color: '#39ff9e', align: 'center' });

  // Attack effects (WEAPON_FX / ENEMY_FX), clipped to the box, then the crit white-out.
  ctx.save();
  ctx.beginPath();
  ctx.rect(BOX.x + 3, BOX.y + 3, BOX.w - 6, BOX.h - 6);
  ctx.clip();
  ctx.lineCap = 'round';
  b.fxs.forEach(e => e.draw && e.t >= 0 && e.draw(Math.min(1, e.t / e.dur)));
  ctx.restore();
  if (b.white) { ctx.fillStyle = `rgba(255,255,255,${b.white * 3.5})`; ctx.fillRect(BOX.x, BOX.y, BOX.w, BOX.h); }
  ctx.restore();
}

// Portrait frame with lunge, shake and white hit-flash.
function drawFighter(b, who, name) {
  const f = FRAME[who], dir = who === 'H' ? -1 : 1;
  const lunge = b.lunge?.who === who ? Math.sin((1 - b.lunge.t / 0.14) * Math.PI) * 10 * dir : 0;
  const sx = b.sh[who] ? (Math.random() - 0.5) * 6 : 0, sy = b.sh[who] ? (Math.random() - 0.5) * 4 : 0;
  const x = f.x + lunge + sx, y = f.y + sy;
  ctx.globalAlpha = who === 'M' && b.over && !b.dead ? Math.max(0, b.timer / 0.7) : 1;
  portraitFrame(name, x, y, 48);
  if (b.fx[who]) {
    ctx.globalAlpha = b.fx[who] / 0.22;
    ctx.drawImage(whiteSprite(name), x + 6, y + 6, 36, 36);
  }
  ctx.globalAlpha = 1;
}

function drawBook() {
  const x = MX + 6, y = MY + 6, w = MW - 12, h = MW - 12;
  panel(x, y, w, h);
  text(`SCAN // ${floorLabel(G.floor)}`, x + 12, y + 12, { size: 8, color: '#6ff7ff' });
  const ids = [...new Set(G.maps[G.floor].flat().filter(isMonster))];
  if (!ids.length) body('No hostiles detected.', x + 12, y + 36, { color: '#9ea2ad' });
  ids.map(id => monsterAt(id)).sort((a, b) => expectedDamage(a) - expectedDamage(b)).forEach((m, i) => {
    const ry = y + 28 + i * 44, d = expectedDamage(m);
    ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.03)';
    ctx.fillRect(x + 6, ry, w - 12, 42);
    portraitFrame(spriteKey(m), x + 10, ry + 3, 36);
    body(m.name, x + 52, ry - 1, { size: 18, color: m.boss ? '#ff3b4e' : '#f2f0ea' });
    body(d === Infinity ? 'IMMUNE' : `~${d}`, x + w - 14, ry - 1, { size: 18, align: 'right', color: dmgColor(d) });
    body(`HP ${m.hp} ATK ${m.atk} DEF ${m.def} CRIT ${m.crit} AGI ${m.agi}`, x + 52, ry + 13, { size: 15, color: '#9ea2ad' });
    const special = Object.keys(ABILITIES).filter(k => m[k]).map(k => ABILITIES[k].split(':')[0]).join(' · ');
    body(`${m.gold} CR · ${m.exp} EXP${special ? '   ' + special : ''}${m.aura ? ` (${m.aura})` : ''}`, x + 52, ry + 26, { size: 15, color: special ? '#ff8a3c' : '#6e6b66' });
  });
  body('Estimates.', x + w / 2, y + h - 20, { size: 15, color: '#6e6b66', align: 'center' });
}

function drawShop(s) {
  const shop = s.shop, x = MX + 30, y = MY + 40, w = MW - 60, h = 64 + (shop.offers.length + 1) * 24 + 34;
  panel(x, y, w, h);
  portraitFrame(shop.sprite, x + 10, y + 10, 46);
  body(shop.name, x + 66 + (w - 76) / 2, y + 6, { size: 22, align: 'center', color: '#ffc23a' });
  wrap(shop.text, w - 80, 17).forEach((l, i) => body(l, x + 66, y + 28 + i * 15, { size: 16, color: '#c9c6bd' }));
  [...shop.offers, { label: 'Leave' }].forEach((o, i) => {
    const ry = y + 66 + i * 24, on = i === s.sel, out = soldOut(o);
    if (on) { ctx.fillStyle = 'rgba(30,164,212,0.2)'; ctx.fillRect(x + 12, ry - 2, w - 24, 22); }
    body((on ? '► ' : '   ') + o.label, x + 20, ry, { color: out ? '#6e6b66' : on ? '#ffd23f' : '#f2f0ea' });
    if (o.cost !== undefined) body(out ? 'SOLD' : `${o.cost} CR`, x + w - 18, ry, { align: 'right', color: out ? '#6e6b66' : G.gold >= o.cost ? '#ffc23a' : '#8f1626' });
  });
  body(`Credits: ${G.gold}`, x + w - 14, y + h - 26, { size: 18, color: '#ffc23a', align: 'right' });
}

// Keys only. M and F appear once there is something for them to do.
function drawHelp() {
  const rows = [['Arrows', 'Move'], ['Enter', 'Confirm'], ['Q', 'Retreat'], G.flags.scanner && ['M', 'Scan'],
    G.flags.compass && ['F', 'Compass'], Object.keys(G.read).length && ['E', 'Read'], ['S / L', 'Save / Load'], ['N', 'Sound'], ['R R', 'Restart']].filter(Boolean);
  const x = MX + 30, y = MY + 30, w = MW - 60, h = 48 + rows.length * 24;
  panel(x, y, w, h);
  text('CONTROLS', x + w / 2, y + 12, { size: 9, color: '#6ff7ff', align: 'center' });
  rows.forEach(([k, v], i) => { body(k, x + 20, y + 34 + i * 24, { color: '#ffd23f' }); body(v, x + 96, y + 34 + i * 24); });
}

// Phase Compass: pick any visited floor (Up/Down 1 floor, Left/Right 10).
function drawFly(u) {
  const x = MX + 76, y = MY + 96, w = MW - 152, h = 160, f = u.floors[u.sel];
  panel(x, y, w, h);
  spr('compass', x + w / 2 - 16, y + 10);
  body('PHASE JUMP', x + w / 2, y + 44, { size: 20, align: 'center', color: '#6ff7ff' });
  const dead = ABANDONED.has(f) && f !== G.floor;
  text(`${f + 1}F`, x + w / 2, y + 72, { size: 20, align: 'center', color: dead ? '#4f535e' : '#f2f0ea' });
  body(dead ? '-- NO SIGNAL --' : ZONES[zoneOf(f)].name, x + w / 2, y + 98, { size: 17, align: 'center', color: dead ? '#ff3b4e' : '#9ea2ad', alpha: dead ? 0.6 + 0.4 * Math.random() : 1 });
  body('▲▼ 1 floor  ◀▶ 10  Enter', x + w / 2, y + h - 26, { size: 15, align: 'center', color: '#6e6b66' });
}

function drawChoice(c) {
  const x = MX + 30, y = MY + 110, w = MW - 60, h = 124;
  panel(x, y, w, h, '#ffc23a');
  body(c.text, x + w / 2, y + 14, { size: 18, align: 'center', color: '#c9c6bd' });
  c.options.forEach((o, i) => {
    const on = i === c.sel, ry = y + 50 + i * 28;
    if (on) { ctx.fillStyle = 'rgba(255,194,58,0.15)'; ctx.fillRect(x + 20, ry - 2, w - 40, 24); }
    body((on ? '► ' : '   ') + o, x + 40, ry, { size: 20, color: on ? '#ffd23f' : '#f2f0ea' });
  });
}

function drawFade(f) {
  const a = f.t < 0.25 ? f.t / 0.25 : f.t < 0.6 ? 1 : 1 - (f.t - 0.6) / 0.5;
  ctx.fillStyle = `rgba(0,0,0,${Math.max(0, a)})`;
  ctx.fillRect(MX, MY, MW, MW);
  if (f.t > 0.2 && f.t < 1.1) body(f.label, MX + MW / 2, MY + MW / 2 - 12, { size: 28, color: '#6ff7ff', align: 'center', alpha: Math.min(1, a * 1.5) });
}

// ---------------------------------------------------------------- title / ending (megastructure vista)
function drawVista(lit, t) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, lit ? '#06131c' : '#040509');
  sky.addColorStop(1, lit ? '#0c2a33' : '#12141c');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  [[0.25, '#0c0e14', 38, 60], [0.5, '#15171f', 28, 30], [1, '#1f222c', 20, 0]].forEach(([depth, col, bw, top], li) => {
    for (let i = -1; i < W / bw + 2; i++) {
      const seed = hash(i, li, 7), x = i * bw * 1.6 + ((t * 6 * depth) % (bw * 1.6)) - bw, w = bw * (0.6 + seed * 0.8);
      ctx.fillStyle = col;
      ctx.fillRect(x, top + seed * 40, w, H);
      for (let k = 0; k < 10; k++) {
        const ly = top + seed * 40 + 12 + k * 34 + hash(i, k, li) * 20;
        const on = lit ? hash(i, k, 3) < Math.min(1, t / 6) : hash(i, k, 5) < 0.12 && Math.sin(t * 2 + i + k) > 0;
        if (on) { ctx.fillStyle = lit ? '#6ff7ff' : '#b7202e'; ctx.fillRect(x + w * 0.3, ly, 2 + li, 2); }
      }
    }
    ctx.strokeStyle = col;
    ctx.lineWidth = 1 + li;
    for (let c = 0; c < 3; c++) {
      ctx.beginPath();
      const cy = 90 + c * 110 + li * 20;
      ctx.moveTo(0, cy);
      ctx.quadraticCurveTo(W / 2, cy + 40 + Math.sin(t * 0.5 + c) * 6, W, cy);
      ctx.stroke();
    }
  });
  if (lit) {
    const beam = ctx.createLinearGradient(0, 0, 0, H);
    beam.addColorStop(0, 'rgba(111,247,255,0.5)');
    beam.addColorStop(1, 'rgba(111,247,255,0)');
    ctx.fillStyle = beam;
    const bw = 6 + Math.sin(t * 3) * 2;
    ctx.fillRect(W / 2 - bw / 2, 0, bw, H);
  }
  const fog = ctx.createLinearGradient(0, H - 160, 0, H);
  fog.addColorStop(0, 'rgba(160,170,190,0)');
  fog.addColorStop(1, lit ? 'rgba(111,247,255,0.12)' : 'rgba(160,170,190,0.1)');
  ctx.fillStyle = fog;
  ctx.fillRect(0, H - 160, W, 160);
  ctx.fillStyle = '#2a2d38';
  ctx.fillRect(0, H - 52, W, 4);
  ctx.drawImage(sprite('heroU'), W / 2 - 8, H - 68, 16, 16);
}

function drawTitle() {
  drawVista(false, time);
  const glitch = Math.random() < 0.06 ? (Math.random() - 0.5) * 6 : 0;
  text('STRATUM', W / 2 + glitch, 96, { size: 44, color: '#ff3b4e', align: 'center', alpha: 0.5 });
  text('STRATUM', W / 2 - glitch, 94, { size: 44, color: '#f2f0ea', align: 'center' });
  body('the builders never stopped', W / 2, 150, { size: 24, color: '#6ff7ff', align: 'center' });
  const opts = hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
  opts.forEach((o, i) => {
    const on = i === titleSel;
    text((on ? '> ' : '  ') + o, W / 2 - 56, 220 + i * 24, { size: 11, color: on ? '#ffc23a' : '#6e6b66' });
  });
  if (Math.floor(time * 2) % 2) body('press ENTER', W / 2, 290, { color: '#9ea2ad', align: 'center' });
  body('H  controls', W / 2, H - 26, { size: 18, color: '#4f535e', align: 'center' });
}

function drawEnding() {
  drawVista(true, endT);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(48, 50, W - 96, 300);
  STORY[ending].forEach((l, i) => {
    const a = Math.min(1, (endT - i * 2.2) / 1);
    if (a > 0) body(l, W / 2, 64 + i * 30, { size: 21, color: i === STORY[ending].length - 1 ? '#6ff7ff' : '#f2f0ea', align: 'center', alpha: a });
  });
  const done = endT - STORY[ending].length * 2.2;
  if (done > 0) {
    text(ending === 'endingSky' ? 'THE SKY' : 'SIGNATURE FORGED', W / 2, 228, { size: 14, color: ending === 'endingSky' ? '#ffc23a' : '#39ff9e', align: 'center', alpha: Math.min(1, done) });
    body(`Lv ${G.lv}  ·  ${G.kills} deleted  ·  ${G.steps} steps  ·  ${G.shards}/5 shards`, W / 2, 256, { color: '#9ea2ad', align: 'center', alpha: Math.min(1, done) });
    body('Thank you for climbing.', W / 2, 284, { color: '#ffc23a', align: 'center', alpha: Math.min(1, done - 0.5) });
    if (done > 1 && Math.floor(time * 2) % 2) body('press ENTER', W / 2, 318, { size: 18, color: '#6e6b66', align: 'center' });
  }
}

function drawDead() {
  ctx.fillStyle = `rgba(40,0,6,${Math.min(0.75, deadT)})`;
  ctx.fillRect(MX, MY, MW, MW);
  const cx = MX + MW / 2;
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(255,59,78,0.15)';
    ctx.fillRect(MX, MY + (time * 200 + i * 67) % MW, MW, 2);
  }
  text('SIGNAL LOST', cx + (Math.random() < 0.1 ? 3 : 0), MY + 130, { size: 20, color: '#ff3b4e', align: 'center', alpha: Math.min(1, deadT) });
  body('You were deleted.', cx, MY + 164, { color: '#c9c6bd', align: 'center', alpha: Math.min(1, deadT - 0.5) });
  if (deadT > 1) body('[L] Load   [R] Restart   [Enter] Title', cx, MY + 204, { size: 18, color: '#9ea2ad', align: 'center' });
}

function render() {
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  if (scene === 'title') return drawTitle();
  if (scene === 'ending') return drawEnding();
  ctx.save();
  if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 16, (Math.random() - 0.5) * shake * 16);
  drawChrome();
  ctx.save();
  ctx.beginPath();
  ctx.rect(MX, MY, MW, MW);
  ctx.clip();
  drawMap();
  drawMotes();
  drawFx();
  ctx.restore();
  ctx.restore();
  const modal = { dialog: drawDialog, banner: drawBanner, battle: drawBattle, book: drawBook, shop: drawShop, help: drawHelp, fade: drawFade, fly: drawFly, choice: drawChoice }[ui?.type];
  modal?.(ui);
  if (ui?.type === 'battle') drawFx();
  if (ui?.type === 'goal') {
    ctx.fillStyle = `rgba(200,255,255,${Math.min(1, ui.t / 2)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (scene === 'dead') drawDead();
  drawToasts();
}

// ---------------------------------------------------------------- boot
function resize() {
  const dpr = devicePixelRatio || 1, pad = document.getElementById('pad');
  const availH = innerHeight - (pad.offsetParent ? pad.offsetHeight + 8 : 0);
  scale = Math.max(1, Math.floor(Math.min(innerWidth / W, availH / H) * dpr * 2) / 2);
  cv.width = W * scale;
  cv.height = H * scale;
  cv.style.width = W * scale / dpr + 'px';
  cv.style.height = H * scale / dpr + 'px';
  panelPattern = null;
}
addEventListener('resize', resize);
resize();

let last = performance.now();
function loop(now) {
  update(Math.min(0.05, (now - last) / 1000));
  last = now;
  render();
  requestAnimationFrame(loop);
}
spawnMotes();
requestAnimationFrame(loop);
