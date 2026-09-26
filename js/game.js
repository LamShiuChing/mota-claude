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
// Built from the live map, so a revealed fake wall ('%') becomes floor after a rebuild.
function buildFloorBg(fi) {
  const th = ZONES[zoneOf(fi)].theme;
  floorBg[fi] = canvasOf(N * 16, N * 16, g => {
    G.maps[fi].forEach((row, ty) => row.forEach((ch, tx) => {
      const ox = tx * 16, oy = ty * 16, rnd = i => hash(tx * 7 + i, ty * 13 + i, fi);
      if (ch === '#' || ch === '%') {
        // Server-rack panel: light bevelled block with vent slots and a status LED.
        rect(g, th.wall, ox, oy, 16, 16);
        rect(g, th.hi, ox, oy, 16, 1); rect(g, th.hi, ox, oy, 1, 16);
        rect(g, th.mortar, ox, oy + 15, 16, 1); rect(g, th.mortar, ox + 15, oy, 1, 16);
        const vents = rnd(1) < 0.5;
        for (let i = 0; i < 3; i++) {
          if (vents) { rect(g, th.mortar, ox + 3, oy + 4 + i * 3, 10, 1); rect(g, th.hi, ox + 3, oy + 5 + i * 3, 10, 1); }
          else { rect(g, th.mortar, ox + 3 + i * 4, oy + 3, 1, 10); rect(g, th.hi, ox + 4 + i * 4, oy + 3, 1, 10); }
        }
        for (let i = 0; i < 4; i++) rect(g, th.speck, ox + 1 + Math.floor(rnd(i + 5) * 14), oy + 1 + Math.floor(rnd(i + 9) * 14));
        if (rnd(20) < 0.25) rect(g, th.accent, ox + 12, oy + 12, 2, 1);
      } else {
        // Floor grating.
        rect(g, th.floor, ox, oy, 16, 16);
        rect(g, th.seam, ox, oy + 15, 16, 1); rect(g, th.seam, ox + 15, oy, 1, 16);
        for (let i = 2; i < 15; i += 4) { rect(g, th.seam, ox + 1, oy + i, 14, 1); rect(g, th.speck, ox + 1, oy + i + 1, 14, 1); }
        for (let i = 0; i < 4; i++) rect(g, th.speck, ox + Math.floor(rnd(i + 3) * 15), oy + Math.floor(rnd(i + 30) * 15));
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
const held = [];

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
    flags: {}, buys: 0, steps: 0, kills: 0, status: 'NORMAL', antivirus: 0, shards: 0, visited: [0],
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
const banner = (text, color = '#f2f0ea', label = 'ACQUIRED', then) => { ui = { type: 'banner', text, color, label, then }; };
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
  hero.move = { fx: G.x, fy: G.y, t: 0 };
  G.x = nx; G.y = ny; G.steps++;
  Sound.sfx.step();
}

function arrive() {
  if (G.status === 'CORRUPT') {
    hurt(BALANCE[zoneOf()].poison);
    if (G.steps % 4 === 0) floater(`-${BALANCE[zoneOf()].poison}`, mapX(G.x) + 16, mapY(G.y), '#b98cff', 8);
    if (--G.corruptSteps <= 0) { G.status = 'NORMAL'; toast('The corruption burned out', '#39ff9e'); }
  }
  fieldDamage();
  const ch = tile(G.x, G.y);
  if (ITEMS[ch]) pickUp(ch);
  else if (ch === 'U' || ch === 'D') changeFloor(G.floor + (ch === 'U' ? 1 : -1), ch === 'U' ? 'D' : 'U');
  else if (ch === '^') changeFloor(meta().links[metaKey(G.x, G.y)], '^');
  else if (ch === 'n') say([{ text: 'A message is scrawled here:' }, { text: `"${meta().notes[metaKey(G.x, G.y)]}"` }]);
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
  toast('A hidden path!', '#ffc23a');
}

function gain(kind, v) {
  G[kind] += v;
  flash(kind);
}

function pickUp(ch) {
  const it = ITEMS[ch], cx = mapX(G.x) + 16, cy = mapY(G.y), v = itemValue(ch);
  setTile(G.x, G.y, '.');
  burst(cx, cy + 16, it.kind === 'hp' ? '#39ff9e' : '#6ff7ff', 10, 50);
  if (it.kind === 'key') { G.keys[it.key]++; flash('key' + it.key); Sound.sfx.key(); return banner(`${it.name}   x1`, PAL[it.key]); }
  if (it.kind === 'shard') return takeShard();
  if (it.kind === 'compass') {
    G.flags.compass = true;
    Sound.sfx.gear();
    return banner('Phase Compass   Press F to jump to any floor you have visited', '#6ff7ff');
  }
  if (it.kind === 'antivirus') {
    Sound.sfx.gem();
    if (G.status === 'CORRUPT') { G.status = 'NORMAL'; return banner('Antivirus Disk   Corruption purged', '#39ff9e'); }
    G.antivirus++;
    return banner(`Antivirus Disk   Stored (${G.antivirus}). Used automatically`, '#39ff9e');
  }
  gain(it.kind, v);
  floater(`${it.kind.toUpperCase()} +${v}`, cx, cy, it.kind === 'hp' ? '#39ff9e' : '#6ff7ff');
  (it.kind === 'hp' ? Sound.sfx.potion : it.gear ? Sound.sfx.gear : Sound.sfx.gem)();
  banner(`${itemName(ch)}   ${it.kind.toUpperCase()} +${v}`, it.gear ? '#6ff7ff' : '#f2f0ea');
}

function takeShard() {
  G.shards++;
  Sound.sfx.lamp();
  shake = 0.2;
  banner(`Memory Shard   ${G.shards} / 5`, '#ffc23a', 'RECOVERED', () => say(STORY.shards[G.shards - 1]));
}

function openDoor(x, y, ch) {
  const k = DOORS[ch];
  if (G.keys[k] <= 0) {
    hero.cooldown = 0.3;
    Sound.sfx.deny();
    return toast(`Requires ${KEY_NAMES[k]} Keycard`, PAL[k]);
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
    return toast(`Your shots can't breach the ${m.name}!`, '#ff3b4e');
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
    return banner(`Brann's Drill   ATK +${v}`, '#ffc23a');
  }
  const it = ITEMS[gift];
  if (it.kind === 'key') { G.keys[it.key]++; flash('key' + it.key); Sound.sfx.key(); return banner(`${it.name}   x1`, PAL[it.key]); }
  if (it.kind === 'antivirus') { G.antivirus++; Sound.sfx.gem(); return banner(`${it.name}   Stored (${G.antivirus})`, '#39ff9e'); }
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
      const [sx, sy] = findTile(nf, arriveAt) || findTile(nf, 'U') || findTile(nf, 'D');
      const spot = [[0, -1], [0, 1], [1, 0], [-1, 0]].map(([dx, dy]) => [sx + dx, sy + dy])
        .find(([x, y]) => x >= 0 && y >= 0 && x < N && y < N && tile(x, y) === '.');
      [G.x, G.y] = spot || [sx, sy];
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
  ui = { type: 'battle', m, x, y, mhp: m.hp, heroTurn: !m.swift, timer: 0.45, mHits: 0, second: false, over: false, fast: false, lunge: null, fx: { H: 0, M: 0 }, sh: { H: 0, M: 0 }, mFlash: 0 };
  Sound.sfx.battle();
}

function updateBattle(b, dt) {
  for (const k of ['H', 'M']) { b.fx[k] = Math.max(0, b.fx[k] - dt); b.sh[k] = Math.max(0, b.sh[k] - dt); }
  b.mFlash = Math.max(0, b.mFlash - dt);
  if (b.lunge && (b.lunge.t -= dt) <= 0) b.lunge = null;
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

function hitFx(b, r, target) {
  const pos = frameCenter(target);
  b.lunge = { who: target === 'M' ? 'H' : 'M', t: 0.14 };
  if (r.miss) { floater('MISS', pos.x, pos.y - 34, '#9ea2ad', 10); return Sound.sfx.miss(); }
  if (r.block) { floater('BLOCK', pos.x, pos.y - 34, '#6ff7ff', 10); return Sound.sfx.bump(); }
  b.fx[target] = 0.22;
  b.sh[target] = r.crit || r.surge ? 0.3 : 0.15;
  const label = r.surge ? 'OVERFLOW' : r.crit ? 'CRIT!' : r.pierce ? 'PIERCE' : null;
  if (label) floater(label, pos.x, pos.y - 48, r.surge ? '#6ff7ff' : r.pierce ? '#b98cff' : '#ff8a3c', 9);
  floater(`-${r.v}`, pos.x, pos.y - 34, r.crit || r.surge ? '#ffc23a' : target === 'H' ? '#ff3b4e' : '#f2f0ea', r.crit || r.surge ? 14 : 11);
  burst(pos.x, pos.y, target === 'H' ? '#ff3b4e' : '#6ff7ff', r.crit ? 22 : 10, r.crit ? 140 : 80);
  if (r.crit || r.surge) { shake = 0.25; Sound.sfx.crit(); } else (target === 'H' ? Sound.sfx.hurt : Sound.sfx.hit)();
}

function endBattle(b) {
  ui = null;
  floaters = []; particles = [];
  if (b.dead) return gameOver();
  const m = b.m, cx = mapX(b.x) + 16, cy = mapY(b.y);
  setTile(b.x, b.y, '.');
  shatter(b.x, b.y, spriteKey(m));
  G.kills++;
  if (m.gold) { G.gold += m.gold; flash('gold'); floater(`+${m.gold} CR`, cx, cy, '#ffc23a'); Sound.sfx.coin(); }
  G.exp += m.exp;
  flash('exp');
  hero.cooldown = 0.25;
  if (m.corrupt && G.status !== 'CORRUPT') {
    if (G.antivirus) { G.antivirus--; toast('Antivirus quarantined the infection', '#39ff9e'); }
    else { G.status = 'CORRUPT'; toast('Corrupted! It drains HP as you walk', '#b98cff'); Sound.sfx.corrupt(); }
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
    name: 'FABRICATOR', sprite: 'fabricator', text: `Feed me ${fabricatorCost(G.buys)} credits. I'll print you an upgrade.`,
    offers: [
      { label: `HP +${b.shop.hp}`, cost: fabricatorCost(G.buys), hp: b.shop.hp, fab: true },
      { label: `ATK +${b.shop.atk}`, cost: fabricatorCost(G.buys), atk: b.shop.atk, fab: true },
      { label: `DEF +${b.shop.def}`, cost: fabricatorCost(G.buys), def: b.shop.def, fab: true },
    ],
  };
  return {
    name: 'BROKER', sprite: 'broker', text: 'Firmware, keycards, disks. Credits only, no questions.',
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
  if (o.flag) { G.flags[o.flag] = true; toast('Scan firmware installed. Press M.', '#6ff7ff'); }
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
    if (!G.flags.scanner) { Sound.sfx.deny(); return toast('No Scan firmware. Find the Broker.', '#ff8a3c'); }
    ui = { type: 'book' }; Sound.sfx.select();
  }
  else if (k === 'h') { ui = { type: 'help' }; Sound.sfx.select(); }
  else if (k === 'f') {
    if (!G.flags.compass) { Sound.sfx.deny(); return toast('You need a Phase Compass', '#ff8a3c'); }
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
    else if (CONFIRM.has(key)) { const f = ui.floors[ui.sel]; close(); if (f !== G.floor) changeFloor(f, f === 0 ? 'U' : 'D'); }
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
  if (DIRS[e.key] && !held.includes(e.key)) held.push(e.key);
  if (e.repeat && !DIRS[e.key]) return;
  handleKey(e.key);
});
addEventListener('keyup', e => { const i = held.indexOf(e.key); if (i >= 0) held.splice(i, 1); });
addEventListener('blur', () => { held.length = 0; });
cv.addEventListener('pointerdown', () => handleKey('Enter'));

document.querySelectorAll('[data-key]').forEach(btn => {
  const key = btn.dataset.key;
  btn.addEventListener('pointerdown', e => { e.preventDefault(); if (DIRS[key] && !held.includes(key)) held.push(key); handleKey(key); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => btn.addEventListener(ev, () => { const i = held.indexOf(key); if (i >= 0) held.splice(i, 1); }));
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
  const key = pendingDir || held[held.length - 1];
  pendingDir = null;
  if (key && hero.cooldown <= 0) tryMove(...DIRS[key]);
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

function drawStairs(x, y, up, arrow = up ? '#6ff7ff' : '#ff8a3c') {
  ctx.fillStyle = '#07080c';
  ctx.fillRect(x, y, TS, TS);
  for (let i = 0; i < 5; i++) {
    const shade = up ? 170 - i * 22 : 60 + i * 22;
    ctx.fillStyle = `rgb(${shade},${shade + 4},${shade + 12})`;
    const inset = up ? i * 2 : (4 - i) * 2;
    ctx.fillRect(x + 2 + inset, y + 2 + i * 6, TS - 4 - inset * 2, 5);
  }
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  ctx.globalAlpha = 0.5 + pulse * 0.5;
  ctx.fillStyle = arrow;
  const cy = y + 16 + (up ? -2 - pulse * 2 : 2 + pulse * 2);
  for (let i = 0; i < 4; i++) {
    const w = up ? i * 2 + 2 : 8 - i * 2;
    ctx.fillRect(x + 16 - w, cy - 4 + i * 2, w * 2, 2);
  }
  ctx.globalAlpha = 1;
}

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
  surgeon: { style: 'stance', frame: 'surgeonB', legs: 11 },
  choir: { style: 'hover', frame: 'choirB', rate: 2.5 },
  knight: { style: 'stance', look: 'knightL', legs: 11, slow: true },
  warden: { style: 'dread', frame: 'wardenE' },
  archivist: { style: 'glitch', still: true },
  lambda: { style: 'glitch', still: true },
  brann: { style: 'breathe', face: 1 },
  ohm: { style: 'breathe', face: 1 },
  pip: { style: 'hop' },
  broker: { style: 'breathe', face: 1 },
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

function drawMap() {
  if (!floorBg[G.floor]) buildFloorBg(G.floor);
  ctx.drawImage(floorBg[G.floor], MX, MY, MW, MW);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = tile(x, y), px = mapX(x), py = mapY(y);
    if (ch === '.' || ch === '#' || ch === '%') continue;
    if (ch === 'U' || ch === 'D') { drawStairs(px, py, ch === 'U'); continue; }
    if (ch === '^') { glow(px, py, '255,194,58'); drawStairs(px, py, false, '#ffc23a'); continue; }
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
    if (ch === 'n') ctx.globalAlpha = 0.55 + 0.35 * Math.sin(time * 2 + x);
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
  const x = MX - 56, w = MW + 56 + 28, y = MY + 168, h = 34;
  panel(x, y, w, h);
  text(b.label, x + 12, y + 13, { size: 9, color: '#ffc23a' });
  body(b.text, x + 116, y + 7, { color: b.color });
  enterHint(x + w - 12, y + 8);
}

function drawBattle(b) {
  ctx.fillStyle = 'rgba(2,3,8,0.45)';
  ctx.fillRect(MX, MY, MW, MW);
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
}

// Portrait frame with lunge, shake, white hit-flash and red slash marks.
function drawFighter(b, who, name) {
  const f = FRAME[who], dir = who === 'H' ? -1 : 1;
  const lunge = b.lunge?.who === who ? Math.sin((1 - b.lunge.t / 0.14) * Math.PI) * 10 * dir : 0;
  const sx = b.sh[who] ? (Math.random() - 0.5) * 6 : 0, sy = b.sh[who] ? (Math.random() - 0.5) * 4 : 0;
  const x = f.x + lunge + sx, y = f.y + sy;
  ctx.globalAlpha = who === 'M' && b.over && !b.dead ? Math.max(0, b.timer / 0.7) : 1;
  portraitFrame(name, x, y, 48);
  if (b.fx[who]) {
    const p = b.fx[who] / 0.22;
    ctx.globalAlpha = p;
    ctx.drawImage(whiteSprite(name), x + 6, y + 6, 36, 36);
    ctx.strokeStyle = '#ff2a3d';
    ctx.lineWidth = 2;
    const reach = (1 - p) * 56;
    [-8, 0, 8].forEach(o => {
      ctx.beginPath();
      ctx.moveTo(x + o - 4, y - 4);
      ctx.lineTo(x + o - 4 + reach, y - 4 + reach);
      ctx.stroke();
    });
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
  body('Estimates only: misses and crits happen.', x + w / 2, y + h - 20, { size: 15, color: '#6e6b66', align: 'center' });
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

function drawHelp() {
  const x = MX + 30, y = MY + 30, w = MW - 60, h = 292;
  panel(x, y, w, h);
  text('CONTROLS', x + w / 2, y + 12, { size: 9, color: '#6ff7ff', align: 'center' });
  [['Arrows', 'Move / bump to fight'], ['Enter', 'Confirm / skip'], ['Q', 'Retreat from battle'], ['M', 'Scan (needs firmware)'],
    ['F', 'Phase Compass: fly'], ['S / L', 'Save / Load'], ['N', 'Sound on/off'], ['R R', 'Restart']]
    .forEach(([k, v], i) => { body(k, x + 20, y + 34 + i * 24, { color: '#ffd23f' }); body(v, x + 96, y + 34 + i * 24); });
  body('Some walls are not walls.', x + w / 2, y + h - 58, { size: 17, color: '#6e6b66', align: 'center' });
  body(`Memory shards: ${G.shards} / 5`, x + w / 2, y + h - 36, { size: 18, color: '#ffc23a', align: 'center' });
}

// Phase Compass: pick any visited floor (Up/Down 1 floor, Left/Right 10).
function drawFly(u) {
  const x = MX + 76, y = MY + 96, w = MW - 152, h = 160, f = u.floors[u.sel];
  panel(x, y, w, h);
  spr('compass', x + w / 2 - 16, y + 10);
  body('PHASE JUMP', x + w / 2, y + 44, { size: 20, align: 'center', color: '#6ff7ff' });
  text(`${f + 1}F`, x + w / 2, y + 72, { size: 20, align: 'center' });
  body(ZONES[zoneOf(f)].name, x + w / 2, y + 98, { size: 17, align: 'center', color: '#9ea2ad' });
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
  body('ascent to the root terminal', W / 2, 150, { size: 24, color: '#6ff7ff', align: 'center' });
  const opts = hasSave() ? ['NEW GAME', 'CONTINUE'] : ['NEW GAME'];
  opts.forEach((o, i) => {
    const on = i === titleSel;
    text((on ? '> ' : '  ') + o, W / 2 - 56, 220 + i * 24, { size: 11, color: on ? '#ffc23a' : '#6e6b66' });
  });
  if (Math.floor(time * 2) % 2) body('press ENTER', W / 2, 290, { color: '#9ea2ad', align: 'center' });
  body('Arrows move · Bump to fight · H help', W / 2, H - 26, { size: 18, color: '#4f535e', align: 'center' });
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
