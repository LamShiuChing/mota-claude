'use strict';
// WebAudio sound: synth SFX layered with Kenney CC0 samples (samples.js), plus a tiny step sequencer for music.
const Sound = (() => {
  let ac, master, sfxBus, musicBus, noiseBuf, muted = false;
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

  // Machines only: pickups and progress are relays, servos and data chirps on fourths, fifths and suspended chords.
  const SFX = {
    step: () => sample('step', 0.6, 0.9) || noise(0.04, { vol: 0.08, type: 'bandpass', f: 900 }),
    bump: () => sample('bump', 0.8, 0.8) || tone(90, 0.08, { type: 'triangle', vol: 0.25, f2: 60 }),
    deny: () => sample('deny', 0.5) || (tone(140, 0.09, { vol: 0.15 }), tone(110, 0.12, { vol: 0.15, at: 0.09 })),
    door: () => { sample('clunk', 0.5, 0.8) || tick(0, 0.4, 900); sample('door', 0.6, 1, 0.05) || noise(0.25, { vol: 0.2, f: 600, f2: 3000, at: 0.05 }); },
    key: () => { sample('relay', 0.6, 1.3) || (tick(0), tick(0.08)); arp([1175, 1568], 0.06, { vol: 0.06, at: 0.05 }); },
    gem: () => { tick(0, 0.12, 5000); arp([1760, 1319, 1760], 0.035, { vol: 0.06 }); },
    potion: () => {
      noise(0.25, { vol: 0.15, type: 'bandpass', f: 1200, f2: 3500 });
      tone(160, 0.3, { type: 'sine', vol: 0.3, f2: 320 });
      arp([622, 740], 0.08, { vol: 0.09, type: 'triangle', at: 0.18 });
    },
    gear: () => {
      tone(90, 0.28, { type: 'sawtooth', vol: 0.08, f2: 260 });
      sample('clunk', 0.8, 0.9, 0.26) || tone(110, 0.15, { type: 'sine', vol: 0.4, f2: 50, at: 0.26 });
      [294, 392, 440].forEach(f => tone(f, 0.6, { type: 'triangle', vol: 0.09, at: 0.3, attack: 0.02 }));
    },
    coin: () => { tick(0, 0.3); tick(0.035, 0.3); tick(0.07, 0.3); tone(2093, 0.05, { vol: 0.04, at: 0.1 }); },
    hit: () => { sample('blade', 0.7) || tone(220, 0.08, { vol: 0.15, f2: 80 }); noise(0.07, { vol: 0.2, f: 3000, f2: 500 }); },
    crit: () => {
      sample('crit', 0.8) || noise(0.22, { vol: 0.5, f: 5000, f2: 200 });
      sample('blade', 0.5, 0.7);
      tone(80, 0.25, { type: 'sine', vol: 0.4, f2: 40 });
    },
    miss: () => noise(0.14, { vol: 0.18, type: 'highpass', f: 6000, f2: 1500 }),
    hurt: () => sample('hurt', 0.6) || (tone(180, 0.12, { vol: 0.2, f2: 90, type: 'sawtooth' }), noise(0.08, { vol: 0.25, f: 1200 })),
    kill: () => { sample('kill', 0.55) || noise(0.4, { vol: 0.3, f: 2500, f2: 100 }); tone(880, 0.5, { type: 'sawtooth', vol: 0.05, f2: 55 }); },
    battle: () => { sample('battle', 0.5); tone(622, 0.05, { vol: 0.07, at: 0.02 }); tone(880, 0.07, { vol: 0.07, at: 0.09 }); },
    level: () => {
      tone(110, 0.45, { type: 'sawtooth', vol: 0.1, f2: 440 });
      noise(0.45, { vol: 0.1, type: 'bandpass', f: 400, f2: 4000 });
      [220, 330, 494].forEach(f => tone(f, 0.9, { type: 'triangle', vol: 0.14, at: 0.42, attack: 0.01 }));
      arp([1319, 1760], 0.08, { vol: 0.04, at: 0.45 });
    },
    stairs: up => {
      tone(up ? 70 : 140, 0.35, { type: 'sawtooth', vol: 0.06, f2: up ? 140 : 70 });
      noise(0.35, { vol: 0.1, type: 'bandpass', f: up ? 400 : 900, f2: up ? 900 : 400 });
      sample('clunk', 0.5, up ? 1 : 0.8, 0.3);
    },
    blip: () => tone(1400, 0.02, { vol: 0.03 }),
    select: () => { tone(880, 0.04, { vol: 0.08 }); tick(0, 0.15, 4000); },
    buy: () => { sample('relay', 0.6) || tick(0); sample('clunk', 0.7, 0.8, 0.12) || tone(110, 0.15, { type: 'sine', vol: 0.4, f2: 50, at: 0.12 }); },
    roar: () => { sample('roar', 0.9, 0.7); tone(70, 1.2, { type: 'sawtooth', vol: 0.25, f2: 40 }); noise(1.2, { vol: 0.2, f: 400, f2: 80 }); },
    field: () => sample('field', 0.5) || tone(300, 0.2, { vol: 0.15, f2: 120, type: 'sawtooth' }),
    corrupt: () => sample('corrupt', 0.7) || tone(200, 0.3, { vol: 0.2, f2: 60, type: 'sawtooth' }),
    crumble: () => sample('crumble', 0.6) || noise(0.4, { vol: 0.3, f: 800, f2: 100 }),
    death: () => { arp([392, 370, 349, 330, 262, 196], 0.18, { vol: 0.15, type: 'triangle' }); tone(220, 1.4, { type: 'sawtooth', vol: 0.06, f2: 30 }); },
    // Attack launch variants (game.js WEAPON_FX / ENEMY_FX).
    whoosh: () => noise(0.09, { vol: 0.14, type: 'bandpass', f: 700, f2: 3000 }),
    laser: () => tone(1500, 0.09, { vol: 0.07, f2: 220 }),
    zap: () => { tone(1800, 0.1, { type: 'sawtooth', vol: 0.07, f2: 300 }); noise(0.08, { vol: 0.1, type: 'highpass', f: 4000 }); },
    thud: () => { tone(90, 0.12, { type: 'sine', vol: 0.35, f2: 40 }); noise(0.05, { vol: 0.18, f: 900 }); },
    beam: () => { tone(200, 0.22, { type: 'sawtooth', vol: 0.07, f2: 800 }); noise(0.2, { vol: 0.1, type: 'bandpass', f: 1500, f2: 400 }); },
    chime: () => { tone(988, 0.25, { type: 'triangle', vol: 0.08 }); tone(1482, 0.2, { type: 'triangle', vol: 0.05, at: 0.03 }); },
    lamp: () => { arp([294, 440, 587, 659, 880, 1175], 0.12, { vol: 0.12, type: 'triangle' }); noise(1.5, { vol: 0.12, type: 'highpass', f: 3000, at: 0.3 }); },
  };

  // Per-sfx level in dB, set from the lab.html Sound Board meters: UI and steps quiet, pickups under combat,
  // crit / boss roar / level-up / death loudest. Listen and nudge these first.
  const LEVEL = {
    step: -10, blip: 16, select: 9, bump: -12, deny: -5, miss: 1, // UI and movement
    key: -2, gem: 14, coin: 13, potion: 2, gear: -5, buy: -5, door: -1, stairs: -1, field: -5, corrupt: -1, crumble: 0, // pickups, world
    whoosh: 22, laser: 14, zap: 9, beam: 12, chime: 12, thud: 2, // attack launches
    battle: 4, hit: 0, hurt: 1, kill: 3, // blows
    crit: 1, roar: 1, level: 12, death: 17, lamp: 15, // big moments
  };
  const levels = {};
  const sfx = {};
  for (const [name, f] of Object.entries(SFX)) {
    sfx[name] = (...args) => {
      if (!ac) return;
      if (!levels[name]) { levels[name] = ac.createGain(); levels[name].gain.value = 10 ** ((LEVEL[name] || 0) / 20); levels[name].connect(sfxBus); }
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
