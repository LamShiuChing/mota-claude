'use strict';
// Chiptune score. Eighth-note steps: a note name starts a note, '-' holds it, '.' rests.
// Optional `wave` picks the lead voice; `hat` adds a hi-hat/kick pattern.
const MUSIC = {
  title: {
    bpm: 70,
    lead: 'E5 - - - B4 - - - | C5 - - - A4 - - - | D5 - - - B4 - - - | E4 - - - - - - - | E5 - - - G5 - - - | F5 - - - E5 - - - | D5 - C5 - B4 - G#4 - | A4 - - - - - - -',
    bass: 'A2 - - - - - - - | F2 - - - - - - - | G2 - - - - - - - | E2 - - - - - - - | C3 - - - - - - - | D3 - - - - - - - | E2 - - - E2 - - - | A2 - - - - - - -',
  },
  stratum: {
    bpm: 112, hat: true,
    lead: 'A4 - - C5 E5 - D5 C5 | B4 - - - E4 - - - | F4 - - A4 C5 - B4 A4 | G#4 - - - - - . . | A4 - - C5 E5 - G5 F5 | E5 - D5 - C5 - B4 - | C5 - B4 - A4 - G#4 - | A4 - - - - - . .',
    bass: 'A2 A3 A2 A3 A2 A3 A2 A3 | E2 E3 E2 E3 E2 E3 E2 E3 | F2 F3 F2 F3 F2 F3 F2 F3 | E2 E3 E2 E3 E2 E3 E2 E3 | A2 A3 A2 A3 A2 A3 A2 A3 | C3 C4 C3 C4 G2 G3 G2 G3 | F2 F3 F2 F3 E2 E3 E2 E3 | A2 A3 A2 A3 A2 . . .',
  },
  nave: {
    bpm: 96, hat: true, wave: 'triangle',
    lead: 'D5 - - F5 E5 - C5 - | D5 - - - A4 - - - | C5 - - E5 D5 - A4 - | B4 - - - G4 - - - | D5 - - F5 G5 - A5 - | G5 - F5 - E5 - C5 - | D5 - C5 - A4 - G4 - | A4 - - - - - . .',
    bass: 'D2 . D3 . D2 . C3 . | D2 . D3 . A2 . C3 . | C2 . C3 . C2 . G2 . | G2 . G3 . G2 . D3 . | D2 . D3 . D2 . C3 . | Bb1 . Bb2 . Bb1 . F2 . | C2 . C3 . C2 . G2 . | D2 . A2 . D2 . . .',
  },
  ward: {
    bpm: 80, wave: 'triangle',
    lead: 'G5 - - - Eb5 - - - | D5 - - - C5 - - - | Eb5 - - - D5 - Bb4 - | C5 - - - - - - - | G5 - - - Ab5 - - - | G5 - - - F5 - Eb5 - | D5 - - - B4 - - - | C5 - - - - - . .',
    bass: 'C3 - - - - - - - | Ab2 - - - - - - - | Eb2 - - - - - - - | G2 - - - - - - - | C3 - - - - - - - | F2 - - - - - - - | G2 - - - G2 - - - | C3 - - - - - - -',
  },
  foundry: {
    bpm: 120, hat: true,
    lead: 'E5 . E5 F5 E5 . D5 . | E5 . . . B4 . . . | E5 . E5 F5 G5 . F5 E5 | D5 . . . C5 . . . | E5 . E5 F5 E5 . D5 . | C5 . D5 . E5 . F5 . | G5 . F5 . E5 . D5 . | E5 - - - . . . .',
    bass: 'E2 E2 E2 E2 F2 F2 E2 E2 | E2 E2 E2 E2 D2 D2 E2 E2 | E2 E2 E2 E2 F2 F2 G2 G2 | D2 D2 D2 D2 C2 C2 C2 C2 | E2 E2 E2 E2 F2 F2 E2 E2 | C2 C2 C2 C2 D2 D2 D2 D2 | G2 G2 F2 F2 E2 E2 D2 D2 | E2 E2 E2 E2 E2 . . .',
  },
  archive: {
    bpm: 76, wave: 'triangle',
    lead: 'C5 - - - Ab4 - C5 - | Db5 - - - C5 - - - | Bb4 - - - G4 - Bb4 - | C5 - - - - - - - | F5 - - - Eb5 - C5 - | Db5 - - - C5 - Ab4 - | Bb4 - - - G4 - E4 - | F4 - - - - - - -',
    bass: 'F2 - C3 - F2 - C3 - | Db2 - Ab2 - Db2 - Ab2 - | Eb2 - Bb2 - Eb2 - Bb2 - | F2 - C3 - F2 - C3 - | Ab2 - Eb3 - Ab2 - Eb3 - | Db2 - Ab2 - Db2 - Ab2 - | C2 - G2 - C2 - G2 - | F2 - C3 - F2 - - -',
  },
  choir: {
    bpm: 70, wave: 'sawtooth',
    lead: 'F#5 - - - F#5 - E5 - | D5 - - - C#5 - - - | B4 - - - D5 - F#5 - | E5 - - - - - - - | G5 - - - F#5 - E5 - | D5 - - - E5 - F#5 - | G5 - F#5 - E5 - C#5 - | B4 - - - - - - -',
    bass: 'B2 - - - - - - - | G2 - - - - - - - | D3 - - - - - - - | A2 - - - - - - - | E2 - - - - - - - | B2 - - - - - - - | E2 - - - F#2 - - - | B2 - - - - - - -',
  },
  quarantine: {
    bpm: 138, hat: true,
    lead: 'D5 . D5 . D5 . C5 . | D5 . . . A4 . . . | D5 . D5 . F5 . E5 . | D5 . . . C5 . . . | Bb4 . Bb4 . Bb4 . A4 . | Bb4 . . . F4 . . . | G4 . A4 . Bb4 . C5 . | D5 - - - . . . .',
    bass: 'D2 D2 D3 D2 D2 D2 D3 D2 | D2 D2 D3 D2 D2 D2 D3 D2 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | C2 C2 C3 C2 C2 C2 C3 C2 | G1 G1 G2 G1 G1 G1 G2 G1 | Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1 | A1 A1 A2 A1 A1 A1 A2 A1 | D2 D2 D3 D2 A1 A1 A2 A1',
  },
  grave: {
    bpm: 66, wave: 'triangle',
    lead: 'D5 - - - Bb4 - - - | C5 - - - A4 - - - | Bb4 - A4 - G4 - - - | F#4 - - - - - - - | G4 - - - Bb4 - D5 - | Eb5 - - - D5 - - - | C5 - Bb4 - A4 - F#4 - | G4 - - - - - - -',
    bass: 'G2 - - - - - - - | F2 - - - - - - - | Eb2 - - - - - - - | D2 - - - - - - - | G2 - - - - - - - | C2 - - - - - - - | D2 - - - D2 - - - | G2 - - - - - - -',
  },
  silent: {
    bpm: 60, wave: 'triangle',
    lead: 'A4 - - - - - - - | . . . . . . . . | E5 - - - - - - - | . . . . . . . . | D5 - - - C5 - - - | . . . . . . . . | B4 - - - - - - - | . . . . . . . .',
    bass: 'A1 - - - - - - - | - - - - - - - - | C2 - - - - - - - | - - - - - - - - | F1 - - - - - - - | - - - - - - - - | E1 - - - - - - - | - - - - - - - -',
  },
  core: {
    bpm: 132, hat: true,
    lead: 'E5 E5 . E5 F5 - E5 - | D5 D5 . D5 E5 - B4 - | C5 C5 . C5 D5 - C5 - | B4 - - - B4 - . . | E5 E5 . E5 G5 - F5 - | F5 - E5 - D5 - C5 - | B4 - C5 - D#5 - F#5 - | E5 - - - E4 - . .',
    bass: 'E2 E2 E3 E2 E2 E2 E3 E2 | D2 D2 D3 D2 D2 D2 D3 D2 | C2 C2 C3 C2 C2 C2 C3 C2 | B1 B1 B2 B1 B1 B1 B2 B1 | E2 E2 E3 E2 E2 E2 E3 E2 | F2 F2 F3 F2 F2 F2 F3 F2 | B1 B1 B2 B1 B1 B1 B2 B1 | E2 E2 E3 E2 B1 B1 B2 B1',
  },
  boss: {
    bpm: 150, hat: true, wave: 'sawtooth',
    lead: 'A5 . A5 . G5 . A5 . | C6 . B5 . A5 . E5 . | F5 . F5 . E5 . F5 . | G5 . F5 . E5 . D5 . | A5 . A5 . G5 . A5 . | C6 . B5 . A5 . G5 . | F5 . E5 . D5 . C5 . | B4 . C5 . D5 . E5 .',
    bass: 'A2 A2 A3 A2 A2 A2 A3 A2 | A2 A2 A3 A2 A2 A2 A3 A2 | F2 F2 F3 F2 F2 F2 F3 F2 | G2 G2 G3 G2 G2 G2 G3 G2 | A2 A2 A3 A2 A2 A2 A3 A2 | A2 A2 A3 A2 A2 A2 A3 A2 | D2 D2 D3 D2 D2 D2 D3 D2 | E2 E2 E3 E2 E2 E2 E3 E2',
  },
  vault: {
    bpm: 80, wave: 'triangle',
    lead: 'A5 - C6 - F5 - A5 - | G5 - - - E5 - - - | F5 - A5 - D5 - F5 - | E5 - - - C5 - - - | D5 - F5 - Bb4 - D5 - | C5 - - - A4 - - - | Bb4 - G4 - C5 - E5 - | F5 - - - - - - -',
    bass: 'F2 - C3 - F3 - C3 - | C2 - G2 - C3 - G2 - | D2 - A2 - D3 - A2 - | A1 - E2 - A2 - E2 - | Bb1 - F2 - Bb2 - F2 - | F2 - C3 - F3 - C3 - | Bb1 - F2 - C2 - G2 - | F2 - C3 - F2 - - -',
  },
  ending: {
    bpm: 84, wave: 'triangle',
    lead: 'E5 - G5 - C6 - - - | B5 - A5 - G5 - - - | A5 - G5 - E5 - D5 - | E5 - - - - - - - | C5 - D5 - E5 - G5 - | A5 - G5 - E5 - C5 - | D5 - E5 - D5 - B4 - | C5 - - - - - - -',
    bass: 'C3 - G3 - C3 - G3 - | G2 - D3 - G2 - D3 - | F2 - C3 - F2 - C3 - | C3 - G3 - C3 - G3 - | A2 - E3 - A2 - E3 - | F2 - C3 - F2 - C3 - | G2 - D3 - G2 - D3 - | C3 - G3 - C3 - - -',
  },
};
