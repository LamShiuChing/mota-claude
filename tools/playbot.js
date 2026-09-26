// Dev tool: an in-browser bot that plays the real engine floor by floor (paste into the console or eval).
// Usage: await playbot(10) after newGame(). Returns a per-floor log.
window.playbot = async (maxFloor) => {
  const log = [];
  const step = n => { for (let i = 0; i < n; i++) update(0.05); };
  const settle = () => {
    for (let g = 0; g < 400; g++) {
      if (scene !== 'play') return;
      if (!ui && !hero.move) return;
      if (ui?.type === 'dialog') { ui.shown = 999; advanceDialog(ui); }
      else if (ui?.type === 'banner') uiKey('Enter');
      else if (ui?.type === 'battle') { ui.fast = true; step(10); }
      else if (ui?.type === 'shop') { ui = null; }
      else step(2);
    }
  };
  const walkable = c => c === '.' || c === 'n' || ITEMS[c] || c === 'U' || c === 'D' || c === '^';
  const bfs = () => {
    const prev = {}, seen = new Set([G.x + ',' + G.y]), q = [[G.x, G.y]], frontier = [];
    while (q.length) {
      const [x, y] = q.shift();
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (nx < 0 || ny < 0 || nx > 10 || ny > 10 || seen.has(k)) continue;
        seen.add(k); prev[k] = [x, y];
        const c = tile(nx, ny);
        if (walkable(c) && !((c === 'U' || c === 'D' || c === '^'))) q.push([nx, ny]);
        else frontier.push([nx, ny, c]);
      }
    }
    return { prev, seen, frontier };
  };
  const pathTo = (prev, tx, ty) => { const p = []; let k = tx + ',' + ty; while (prev[k]) { p.unshift(k.split(',').map(Number)); const [px, py] = prev[k]; k = px + ',' + py; if (px === G.x && py === G.y) break; } return p; };
  // Items are taken from the adjacent cell, so a step onto one takes a second press.
  const go = path => { for (const [x, y] of path) { const dx = x - G.x, dy = y - G.y, item = ITEMS[tile(x, y)]; for (let i = item ? 2 : 1; i--;) { hero.cooldown = 0; tryMove(dx, dy, dy < 0 ? 'U' : dy > 0 ? 'D' : dx < 0 ? 'L' : 'R'); settle(); if (scene !== 'play') return; } } };
  for (let guard = 0; guard < 3000 && scene === 'play' && (G.floor < maxFloor || G.floor === ENTRANCE); guard++) {
    settle();
    const { prev, seen, frontier } = bfs();
    // 1. items anywhere reachable
    let target = null;
    for (const k of seen) { const [x, y] = k.split(',').map(Number); const c = tile(x, y); if (ITEMS[c] && prev[k] && !(x === G.x && y === G.y)) { target = [x, y]; break; } }
    if (target) { go(pathTo(prev, ...target)); continue; }
    // 2. fights and doors on the frontier
    const mons = frontier.filter(f => isMonster(f[2])).map(f => ({ f, c: battleCost(G, monsterAt(f[2])) + (monsterAt(f[2]).aura || 0) })).sort((a, b) => a.c - b.c);
    const up0 = findTile(G.floor, 'U') || [5, 5];
    const doors = frontier.filter(f => DOORS[f[2]] && G.keys[DOORS[f[2]]] > 0).sort((a, b) => Math.abs(a[0] - up0[0]) + Math.abs(a[1] - up0[1]) - Math.abs(b[0] - up0[0]) - Math.abs(b[1] - up0[1]));
    const shop = frontier.find(f => f[2] === 'S');
    if (shop && G.gold >= fabricatorCost(G.buys)) { const s = shopFor('S'); const o = s.offers[G.buys % 2 ? 2 : 1]; G.gold -= o.cost; G.buys++; G[o.atk ? 'atk' : 'def'] += o.atk || o.def; continue; }
    let pick = null;
    if (mons.length && mons[0].c < G.hp * 0.12 && !monsterAt(mons[0].f[2]).boss) pick = mons[0].f;
    else if (doors.length) pick = doors[0];
    else if (mons.length && mons[0].c < G.hp * 0.8 && (!frontier.some(f => f[2] === 'U') || mons[0].c < G.hp * 0.25)) pick = mons[0].f;
    if (pick) {
      const [x, y] = pick;
      const path = pathTo(prev, x, y);
      go(path);
      continue;
    }
    // 3. climb
    const up = frontier.find(f => f[2] === 'U');
    if (up) { log.push(`F${G.floor + 1} done: hp ${G.hp} atk ${G.atk} def ${G.def} lv ${G.lv} keys ${G.keys.y}/${G.keys.b}/${G.keys.r} gold ${G.gold}`); go(pathTo(prev, up[0], up[1])); settle(); continue; }
    // Out of options: fly back to a Fabricator and spend credits, like a player with the Phase Compass would.
    const fabFloor = G.visited.filter(f => (f === G.floor || !ABANDONED.has(f)) && G.maps[f].flat().includes('S')).pop();
    if (fabFloor !== undefined && G.gold >= fabricatorCost(G.buys)) {
      const b = BALANCE[zoneOf(fabFloor)].shop, k = ['atk', 'def', 'hp'][G.buys % 3];
      G.gold -= fabricatorCost(G.buys++); G[k] += b[k];
      continue;
    }
    // Or to a Broker for a key.
    const brokerFloor = G.visited.filter(f => (f === G.floor || !ABANDONED.has(f)) && G.maps[f].flat().includes('M')).pop();
    if (brokerFloor !== undefined && G.gold >= BALANCE[zoneOf(brokerFloor)].broker.y && frontier.some(f => f[2] === 'Y') && !G.flags.botBought?.[G.floor]) {
      G.gold -= BALANCE[zoneOf(brokerFloor)].broker.y; G.keys.y++;
      (G.flags.botBought ??= {})[G.floor] = true;
      log.push(`  bought amber key on F${brokerFloor + 1}`);
      continue;
    }
    log.push(`STUCK F${G.floor + 1}: hp ${G.hp} atk ${G.atk} next ${mons.slice(0, 2).map(m => monsterAt(m.f[2]).name + ' ' + m.c).join(', ')} doors ${frontier.filter(f => DOORS[f[2]]).map(f => f[2]).join('')}`);
    break;
  }
  log.push(`end: scene ${scene} floor ${G.floor + 1} hp ${G.hp}`);
  return log;
}
;
