'use strict';
// All sound is synthesized with WebAudio: chiptune SFX + a tiny step sequencer for music.
const Sound = (() => {
  let ac, master, sfxBus, musicBus, noiseBuf, muted = false;
  let song = null, songName = null, step = 0, nextTime = 0, timer = null;

  function init() {
    if (ac) return ac.resume();
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.32; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0.11; musicBus.connect(master);
    decodeSamples();
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    if (songName) play(songName, true);
  }

  const now = () => ac.currentTime;
  const LEAD_VOL = { square: 0.22, triangle: 0.4, sawtooth: 0.13 };

  function tone(f, dur, { type = 'square', vol = 0.3, f2, at = 0, bus = sfxBus, attack = 0.004 } = {}) {
    if (!ac) return;
    const t = now() + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, { vol = 0.3, type = 'lowpass', f = 2000, f2, at = 0, bus = sfxBus } = {}) {
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
  function sample(name, vol = 0.8, rate = 1) {
    const list = ac && buffers[name];
    if (!list?.length) return false;
    const src = ac.createBufferSource(), g = ac.createGain();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate * (0.95 + Math.random() * 0.1);
    g.gain.value = vol;
    src.connect(g).connect(sfxBus);
    src.start();
    return true;
  }

  const arp = (notes, gap, opts) => notes.forEach((f, i) => tone(f, gap * 1.6, { ...opts, at: i * gap }));

  const sfx = {
    step: () => noise(0.04, { vol: 0.08, type: 'bandpass', f: 900 }),
    bump: () => tone(90, 0.08, { type: 'triangle', vol: 0.25, f2: 60 }),
    deny: () => sample('deny', 0.5) || (tone(140, 0.09, { vol: 0.15 }), tone(110, 0.12, { vol: 0.15, at: 0.09 })),
    door: () => { sample('door', 0.6) || noise(0.25, { vol: 0.2, f: 600, f2: 3000 }); arp([392, 523], 0.07, { vol: 0.08 }); },
    key: () => arp([784, 988, 1319], 0.05, { vol: 0.12 }),
    gem: () => arp([1047, 1319, 1568, 2093], 0.04, { vol: 0.1, type: 'triangle' }),
    potion: () => { tone(300, 0.25, { vol: 0.15, f2: 900, type: 'triangle' }); arp([660, 880], 0.06, { vol: 0.08, at: 0.1 }); },
    gear: () => arp([392, 523, 659, 784, 1047], 0.06, { vol: 0.13 }),
    coin: () => { tone(988, 0.05, { vol: 0.1 }); tone(1319, 0.18, { vol: 0.1, at: 0.05 }); },
    hit: () => sample('shot', 0.55) || (noise(0.09, { vol: 0.35, f: 3000, f2: 400 }), tone(220, 0.08, { vol: 0.15, f2: 80 })),
    crit: () => { sample('crit', 0.7) || noise(0.22, { vol: 0.5, f: 5000, f2: 200 }); tone(80, 0.25, { type: 'sine', vol: 0.4, f2: 40 }); },
    miss: () => noise(0.14, { vol: 0.18, type: 'highpass', f: 6000, f2: 1500 }),
    hurt: () => sample('hurt', 0.6) || (tone(180, 0.12, { vol: 0.2, f2: 90, type: 'sawtooth' }), noise(0.08, { vol: 0.25, f: 1200 })),
    kill: () => { sample('kill', 0.55) || noise(0.4, { vol: 0.3, f: 2500, f2: 100 }); arp([523, 392, 262], 0.06, { vol: 0.08 }); },
    battle: () => sample('battle', 0.5) || arp([220, 294, 440], 0.05, { vol: 0.12, type: 'sawtooth' }),
    level: () => arp([523, 659, 784, 1047, 784, 1047, 1319], 0.07, { vol: 0.13 }),
    stairs: up => { for (let i = 0; i < 5; i++) tone(up ? 300 + i * 90 : 700 - i * 90, 0.07, { vol: 0.1, at: i * 0.06, type: 'triangle' }); },
    blip: () => tone(1400, 0.02, { vol: 0.03 }),
    select: () => tone(880, 0.04, { vol: 0.08 }),
    buy: () => { sample('buy', 0.6) || noise(0.1, { vol: 0.08, type: 'highpass', f: 5000, at: 0.1 }); arp([659, 988, 1319], 0.05, { vol: 0.08 }); },
    roar: () => { sample('roar', 0.9, 0.7); tone(70, 1.2, { type: 'sawtooth', vol: 0.25, f2: 40 }); noise(1.2, { vol: 0.2, f: 400, f2: 80 }); },
    field: () => sample('field', 0.5) || tone(300, 0.2, { vol: 0.15, f2: 120, type: 'sawtooth' }),
    corrupt: () => sample('corrupt', 0.7) || tone(200, 0.3, { vol: 0.2, f2: 60, type: 'sawtooth' }),
    crumble: () => sample('crumble', 0.6) || noise(0.4, { vol: 0.3, f: 800, f2: 100 }),
    death: () => arp([392, 370, 349, 330, 262, 196], 0.18, { vol: 0.15, type: 'triangle' }),
    lamp: () => { arp([294, 440, 587, 740, 880, 1175], 0.12, { vol: 0.12, type: 'triangle' }); noise(1.5, { vol: 0.12, type: 'highpass', f: 3000, at: 0.3 }); },
  };

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

  return { init, sfx, play, stop, toggleMute, get muted() { return muted; } };
})();
