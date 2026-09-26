'use strict';
// WebAudio sound: synth SFX layered with Kenney CC0 samples (samples.js), plus a tiny step sequencer for music.
const Sound = (() => {
  let ac, master, sfxBus, musicBus, verb, noiseBuf, muted = false;
  let song = null, songName = null, step = 0, nextTime = 0, timer = null;
  let dest; // where tone/noise/sample go by default: the playing sfx's level gain (see LEVEL)

  function init() {
    if (ac) return ac.resume();
    ac = new (window.AudioContext || window.webkitAudioContext)();
    const limiter = ac.createDynamicsCompressor(); // safety net for stacked hits; the mix itself peaks below it
    limiter.threshold.value = -3; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.002; limiter.release.value = 0.15;
    master = ac.createGain(); master.connect(limiter).connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.5; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.16; musicBus.connect(master);
    dest = sfxBus;
    // A short synthetic hall (decaying stereo noise) so blows and pickups sit in a space instead of a void.
    const ir = ac.createBuffer(2, ac.sampleRate * 1.4, ac.sampleRate);
    for (let c = 0; c < 2; c++) ir.getChannelData(c).forEach((_, i, d) => { d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 4; });
    verb = ac.createConvolver(); verb.buffer = ir; // fill first: the node takes the buffer's contents on assignment
    const wet = ac.createGain(); wet.gain.value = 0.12;
    verb.connect(wet).connect(master);
    decodeSamples();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (songName) play(songName, true);
  }

  const now = () => ac.currentTime;
  const LEAD_VOL = { square: 0.22, triangle: 0.4, sawtooth: 0.13 };

  function tone(f, dur, { type = 'square', vol = 0.3, f2, at = 0, bus = dest, attack = 0.004 } = {}) {
    if (!ac) return;
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.3, type = 'lowpass', f = 2000, f2, at = 0, bus = dest } = {}) {
    if (!ac) return;
    const t = now() + at, s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; fl.type = type; fl.frequency.setValueAtTime(f, t);
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl).connect(g).connect(bus); s.start(t); s.stop(t + dur + 0.02);
  }

  // Recorded CC0 effects (samples.js). Each name maps to a few variations; missing/undecodable ones fall back to synth.
  const buffers = {};
  function decodeSamples() {
    if (typeof SAMPLES === 'undefined') return;
    for (const [name, list] of Object.entries(SAMPLES)) {
      buffers[name] = [];
      for (const b64 of list) {
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        ac.decodeAudioData(bytes.buffer).then(buf => buffers[name].push(buf), () => {});
      }
    }
  }
  function sample(name, vol = 0.8, rate = 1, at = 0) {
    const list = ac && buffers[name];
    if (!list?.length) return false;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    g.gain.value = vol;
    src.connect(g).connect(dest);
    src.start(now() + at);
    return true;
  }

  const arp = (notes, gap, opts = {}) => notes.forEach((f, i) => tone(f, gap * 1.6, { ...opts, at: (opts.at || 0) + i * gap }));
  const tick = (at = 0, vol = 0.3, f = 3500) => noise(0.012, { vol, type: 'bandpass', f, at });
  // Struck metal: inharmonic partials of a free bar, the high ones dying first.
  const ring = (f, dur, { vol = 0.1, at = 0 } = {}) =>
    [[1, 1], [2.76, 0.5], [5.4, 0.25], [8.93, 0.12]].forEach(([r, a]) => tone(f * r, dur / Math.sqrt(r), { type: 'sine', vol: vol * a, at, attack: 0.002 }));
  // A machine losing power: pitch and brightness fall together.
  const powerDown = (f, dur, { vol = 0.1, at = 0 } = {}) => { tone(f, dur, { type: 'sawtooth', vol, f2: f / 12, at }); noise(dur, { vol: vol * 1.5, f: 3000, f2: 80, at }); };
  const crackle = (dur, { vol = 0.2, at = 0, f = 3000 } = {}) => { for (let t = 0; t < dur; t += 0.012 + Math.random() * 0.03) noise(0.008, { vol: vol * (0.4 + Math.random() * 0.6), type: 'bandpass', f: f * (0.6 + Math.random()), at: at + t }); };

  // Rho fights with a blade: real swings, bites and clashes (samples.js), with synth weight and ring layered in.
  // The world is machines: pickups are cards, cells and chips clicking into slots; kills are power failing.
  const SFX = {
    step: () => sample('step', 0.6, 0.9) || noise(0.04, { vol: 0.08, type: 'bandpass', f: 900 }),
    bump: () => { sample('metal', 0.35, 0.55); tone(70, 0.1, { type: 'sine', vol: 0.3, f2: 45 }); },
    deny: () => sample('deny', 0.5) || (tone(140, 0.09, { vol: 0.15 }), tone(110, 0.12, { vol: 0.15, at: 0.09 })),
    door: () => { sample('latch', 0.7, 0.8); tone(55, 0.5, { type: 'sawtooth', vol: 0.08, f2: 80, at: 0.08 }); sample('slide', 0.7, 0.85, 0.08) || noise(0.4, { vol: 0.2, f: 600, f2: 3000, at: 0.08 }); sample('metal', 0.5, 0.7, 0.5); },
    key: () => { sample('latch', 0.6, 1.4); tone(1318, 0.06, { type: 'sine', vol: 0.1, at: 0.06 }); tone(1760, 0.12, { type: 'sine', vol: 0.1, at: 0.12 }); },
    gem: () => { sample('latch', 0.4, 1.8); sample('glass', 0.5, 1.4, 0.03); arp([2637, 3520, 4186], 0.03, { type: 'sine', vol: 0.05, at: 0.05 }); ring(2200, 0.5, { vol: 0.06, at: 0.05 }); },
    potion: () => sample('latch', 0.6, 1.1),
    gear: () => {
      sample('draw', 0.8);
      tone(55, 0.5, { type: 'sine', vol: 0.3, f2: 110, at: 0.05 });
      sample('metal', 0.6, 0.8, 0.3);
      ring(587, 1.2, { vol: 0.08, at: 0.32 }); ring(880, 1, { vol: 0.05, at: 0.36 });
    },
    coin: () => { sample('coin', 0.7) || (tick(0), tick(0.035)); ring(3136, 0.25, { vol: 0.03, at: 0.01 }); },
    // Blows: single CC0 recordings picked by ear from an audition, played dry as auditioned.
    hit: () => sample('hit', 0.8),
    crit: () => sample('crit', 0.8),
    miss: () => sample('swing', 0.35, 1.5, 0.02) || noise(0.14, { vol: 0.18, type: 'highpass', f: 6000, f2: 1500 }),
    block: () => { sample('clash', 0.7, 1.15); ring(1661, 0.7, { vol: 0.05 }); },
    hurt: () => sample('hurt', 0.8),
    kill: () => sample('kill', 0.8),
    battle: () => sample('battle', 0.8),
    level: () => {
      noise(0.5, { vol: 0.1, type: 'bandpass', f: 300, f2: 6000 });
      tone(110, 0.5, { type: 'sawtooth', vol: 0.07, f2: 440 });
      sample('boom', 0.35, 1.6, 0.48);
      [220, 330, 440, 659].forEach((f, i) => ring(f, 1.6, { vol: 0.07, at: 0.48 + i * 0.03 }));
    },
    stairs: up => {
      sample('slide', 0.35, up ? 0.6 : 0.5);
      tone(up ? 60 : 120, 0.45, { type: 'sawtooth', vol: 0.06, f2: up ? 120 : 60 });
      sample('metal', 0.5, up ? 0.75 : 0.6, 0.38);
    },
    blip: () => tone(1400, 0.02, { vol: 0.03 }),
    select: () => { tone(1320, 0.03, { type: 'sine', vol: 0.1 }); tick(0, 0.12, 5000); },
    buy: () => { sample('coin', 0.5); sample('latch', 0.6, 0.9, 0.15); ring(1976, 0.3, { vol: 0.04, at: 0.15 }); },
    roar: () => {
      sample('roar', 0.8, 0.7);
      sample('clash', 0.5, 0.45); // metal screaming
      sample('boom', 0.8, 0.8);
      tone(55, 1.3, { type: 'sawtooth', vol: 0.2, f2: 35 });
      noise(1.2, { vol: 0.2, f: 500, f2: 80 });
    },
    field: () => { sample('field', 0.5) || tone(300, 0.2, { vol: 0.15, f2: 120, type: 'sawtooth' }); crackle(0.2, { vol: 0.1, f: 5000 }); },
    corrupt: () => { sample('corrupt', 0.6) || tone(200, 0.3, { vol: 0.2, f2: 60, type: 'sawtooth' }); for (let i = 0; i < 8; i++) tone(200 + Math.random() * 2000, 0.03, { vol: 0.05, at: i * 0.035 }); },
    crumble: () => { sample('crumble', 0.6) || noise(0.4, { vol: 0.3, f: 800, f2: 100 }); sample('crunch', 0.3, 0.7); },
    death: () => {
      sample('crunch', 0.5, 0.8); sample('boom', 0.8, 0.7);
      powerDown(440, 1.6, { vol: 0.08 });
      arp([392, 370, 349, 330, 262, 196], 0.2, { vol: 0.12, type: 'triangle', at: 0.3 });
    },
    // Attack launches (game.js WEAPON_FX / ENEMY_FX). swing: Rho's blade; whoosh: claws, bites and lashes.
    swing: () => { sample('swing', 0.8) || noise(0.12, { vol: 0.3, type: 'bandpass', f: 600, f2: 3000 }); ring(3520, 0.18, { vol: 0.012, at: 0.04 }); },
    whoosh: () => sample('swing', 0.5, 0.8) || noise(0.09, { vol: 0.14, type: 'bandpass', f: 700, f2: 3000 }),
    laser: () => { sample('laser', 0.5) || tone(1500, 0.09, { vol: 0.07, f2: 220 }); },
    zap: () => { tone(1800, 0.12, { type: 'sawtooth', vol: 0.05, f2: 300 }); crackle(0.18, { vol: 0.25, f: 4000 }); },
    thud: () => { sample('punch', 0.7, 0.6); sample('boom', 0.5, 1.4); },
    beam: () => { sample('field', 0.35, 1.3); tone(200, 0.3, { type: 'sawtooth', vol: 0.06, f2: 900 }); noise(0.3, { vol: 0.1, type: 'bandpass', f: 1500, f2: 400 }); },
    chime: () => ring(988, 1.2, { vol: 0.12 }),
    lamp: () => { arp([294, 440, 587, 659, 880, 1175], 0.12, { vol: 0.1, type: 'triangle' }); ring(1175, 2, { vol: 0.05, at: 0.72 }); noise(1.5, { vol: 0.08, type: 'highpass', f: 3000, at: 0.3 }); },
  };

  // Per-sfx level in dB, set from the lab.html Sound Board meters: UI and steps quiet, pickups under combat,
  // crit / boss roar / level-up / death loudest. Listen and nudge these first.
  const LEVEL = {
    step: -10, blip: 16, select: 8, bump: -3, deny: -5, miss: 0, // UI and movement
    key: 6, gem: 2, coin: 2, potion: 5, gear: -3, buy: 3, door: 1, stairs: 1, field: -6, corrupt: 5, crumble: -2, // pickups, world
    swing: -3, whoosh: -2, laser: 0, zap: 15, beam: -1, chime: 7, thud: -2, // attack launches
    battle: 7, hit: 4, block: 4, hurt: 4, kill: 5, // blows
    crit: 7, roar: 0, level: 4, death: 0, lamp: 13, // big moments
  };
  const DRY = new Set(['step', 'blip', 'deny', 'hit', 'crit', 'hurt', 'kill', 'battle']); // everything else gets a little of the tower's hall
  const levels = {};
  const sfx = {};
  for (const [name, f] of Object.entries(SFX)) {
    sfx[name] = (...args) => {
      if (!ac) return;
      if (!levels[name]) {
        levels[name] = ac.createGain(); levels[name].gain.value = 10 ** ((LEVEL[name] || 0) / 20); levels[name].connect(sfxBus);
        if (!DRY.has(name)) levels[name].connect(verb);
      }
      dest = levels[name];
      f(...args);
      dest = sfxBus;
    };
  }


  // Note name -> Hz ("C#5", "Bb2")
  const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  const hz = n => {
    const m = /^([A-G])([#b]?)(\d)$/.exec(n);
    const semi = SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (m[3] - 4) * 12;
    return 440 * 2 ** ((semi - 9) / 12);
  };
  // Tokens: note, '-' holds the previous note, '.' is a rest. Returns [{f, len}|null] per step.
  const parse = str => {
    const toks = str.replace(/\|/g, ' ').split(/\s+/).filter(Boolean), out = [];
    toks.forEach((tk, i) => {
      if (tk === '-' || tk === '.') return out.push(null);
      let len = 1;
      while (toks[i + len] === '-') len++;
      out.push({ f: hz(tk), len });
    });
    return out;
  };

  function play(name, force) {
    if (name === songName && !force) return;
    songName = name;
    const m = MUSIC[name];
    song = { bpm: m.bpm, hat: m.hat, wave: m.wave || 'square', lead: parse(m.lead), bass: parse(m.bass) };
    if (!ac) return;
    step = 0; nextTime = now() + 0.1;
    clearInterval(timer);
    timer = setInterval(schedule, 25);
  }

  function stop() { clearInterval(timer); song = null; songName = null; }

  function schedule() {
    const beat = 60 / song.bpm / 2; // eighth notes
    while (nextTime < now() + 0.12) {
      const at = nextTime - now(), l = song.lead[step % song.lead.length], b = song.bass[step % song.bass.length];
      if (l) { tone(l.f, beat * l.len * 0.95, { type: song.wave, vol: LEAD_VOL[song.wave], at, bus: musicBus, attack: 0.01 }); tone(l.f * 2.003, beat * l.len * 0.6, { type: 'triangle', vol: 0.05, at, bus: musicBus }); }
      if (b) tone(b.f, beat * b.len * 0.9, { type: 'triangle', vol: 0.5, at, bus: musicBus, attack: 0.01 });
      if (song.hat && step % 2 === 1) noise(0.03, { vol: 0.12, type: 'highpass', f: 7000, at, bus: musicBus });
      if (song.hat && step % 8 === 0) noise(0.08, { vol: 0.35, f: 180, at, bus: musicBus });
      step++; nextTime += beat;
    }
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  // ctx/out let lab.html meter the master output.
  return { init, sfx, play, stop, toggleMute, get muted() { return muted; }, get ctx() { return ac; }, get out() { return master; } };
})();
