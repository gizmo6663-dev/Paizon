/*
 * Paizon – ren spill-logikk uten DOM-avhengigheter.
 * Lastes som vanlig <script> i nettleseren (window.PaizonLogic)
 * og som CommonJS-modul i testene (require('./js/logic.js')).
 */
(function (root) {
  'use strict';

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZÆØÅ'.split('');
  const MAX_WORD_LENGTH = 14;
  const MAX_WORDS = 30;

  // ghost: 'always' = svak bokstav vises fra start,
  //        'after'  = vises etter et antall feil forsøk i boksen,
  //        'never'  = vises aldri.
  const DIFFICULTIES = {
    lett: {
      label: 'Lett',
      ghost: 'always',
      extraLetters: 0,
      hintButton: true,
      description: 'Svake bokstaver i boksene viser hvor hver bokstav skal. Bare ordets bokstaver å velge mellom.',
    },
    middels: {
      label: 'Middels',
      ghost: 'after',
      extraLetters: 2,
      hintButton: true,
      description: 'Boksene er tomme, men den svake bokstaven dukker opp etter noen feil forsøk. Noen ekstra bokstaver.',
    },
    vanskelig: {
      label: 'Vanskelig',
      ghost: 'never',
      extraLetters: 4,
      hintButton: false,
      description: 'Ingen hjelpebokstaver og flere ekstra bokstaver å velge mellom.',
    },
  };

  // Bokstaver med aksenter gjøres om til nærmeste norske bokstav.
  const LETTER_MAP = {
    'É': 'E', 'È': 'E', 'Ê': 'E', 'Ë': 'E',
    'Á': 'A', 'À': 'A', 'Â': 'A',
    'Ó': 'O', 'Ò': 'O', 'Ô': 'O',
    'Ú': 'U', 'Ù': 'U', 'Û': 'U', 'Ü': 'U',
    'Í': 'I', 'Ì': 'I', 'Î': 'I', 'Ï': 'I',
    'Ä': 'Æ', 'Ö': 'Ø',
  };

  function toUpper(text) {
    return String(text).toLocaleUpperCase('nb-NO');
  }

  function normalizeWord(raw) {
    // NFC sørger for at Å skrevet som A + ring blir én bokstav.
    const upper = toUpper(String(raw).normalize('NFC'));
    let out = '';
    for (const ch of upper) {
      const mapped = LETTER_MAP[ch] || ch;
      if (ALPHABET.includes(mapped)) out += mapped;
    }
    return out.slice(0, MAX_WORD_LENGTH);
  }

  function parseWords(text) {
    const seen = new Set();
    const words = [];
    for (const part of String(text || '').split(/[\s,;.]+/)) {
      const word = normalizeWord(part);
      if (!word || seen.has(word)) continue;
      seen.add(word);
      words.push(word);
      if (words.length >= MAX_WORDS) break;
    }
    return words;
  }

  function shuffle(list, rng) {
    const random = rng || Math.random;
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /**
   * Lager bokstavbanken: alle ordets bokstaver + et antall ekstra
   * «lurebokstaver» som ikke finnes i ordet, i tilfeldig rekkefølge.
   */
  function buildLetterBank(word, extraCount, rng) {
    const random = rng || Math.random;
    const letters = word.split('');
    const unused = ALPHABET.filter((l) => !letters.includes(l));
    const extras = shuffle(unused, random).slice(0, Math.max(0, extraCount | 0));
    const all = letters.concat(extras);

    let order = shuffle(all, random);
    // Unngå at bokstavene ligger i riktig rekkefølge allerede.
    for (let tries = 0; tries < 10 && all.length > 1 && order.join('') === all.join(''); tries++) {
      order = shuffle(all, random);
    }
    return order.map((letter, id) => ({ id, letter, used: false }));
  }

  function resolveSettings(settings) {
    const s = settings || {};
    const base = DIFFICULTIES[s.difficulty] || DIFFICULTIES.lett;
    const extra = s.extraLetters === 'auto' || s.extraLetters === undefined
      ? base.extraLetters
      : Math.max(0, Math.min(8, parseInt(s.extraLetters, 10) || 0));
    const hintAfter = Math.max(1, Math.min(9, parseInt(s.hintAfter, 10) || 2));
    return {
      ghost: base.ghost,
      extraLetters: extra,
      hintButton: base.hintButton,
      hintAfter,
    };
  }

  const EMOJI = {
    // Dyr
    KATT: '🐱', HUND: '🐶', MUS: '🐭', HEST: '🐴', KU: '🐮', GRIS: '🐷', SAU: '🐑',
    GEIT: '🐐', HØNE: '🐔', AND: '🦆', FISK: '🐟', FUGL: '🐦', BJØRN: '🐻', ULV: '🐺',
    REV: '🦊', ELG: '🫎', HARE: '🐰', KANIN: '🐰', LØVE: '🦁', TIGER: '🐯', APE: '🐒',
    ELEFANT: '🐘', SLANGE: '🐍', FROSK: '🐸', UGLE: '🦉', BIE: '🐝', SOMMERFUGL: '🦋',
    MAUR: '🐜', SNEGL: '🐌', HVAL: '🐋', DELFIN: '🐬', PINGVIN: '🐧', SEBRA: '🦓',
    GIRAFF: '🦒', KROKODILLE: '🐊', SKILPADDE: '🐢', DINOSAUR: '🦕', DRAGE: '🐉',
    // Natur og ting
    SOL: '☀️', MÅNE: '🌙', STJERNE: '⭐', SKY: '☁️', REGN: '🌧️', SNØ: '❄️', TRE: '🌳',
    BLOMST: '🌸', HUS: '🏠', BIL: '🚗', BUSS: '🚌', TOG: '🚆', BÅT: '⛵', FLY: '✈️',
    SYKKEL: '🚲', BALL: '⚽', BOK: '📖', STOL: '🪑', SENG: '🛏️', LAMPE: '💡',
    KLOKKE: '⏰', NØKKEL: '🔑', HJERTE: '❤️', REGNBUE: '🌈', FJELL: '⛰️', HAV: '🌊',
    SKO: '👟', JAKKE: '🧥', VOTTER: '🧤', HATT: '🎩', KRONE: '👑', GAVE: '🎁',
    BALLONG: '🎈', TROMME: '🥁', GITAR: '🎸', ROBOT: '🤖', RAKETT: '🚀',
    // Mat
    EPLE: '🍎', BANAN: '🍌', PÆRE: '🍐', DRUE: '🍇', JORDBÆR: '🍓', GULROT: '🥕',
    BRØD: '🍞', OST: '🧀', MELK: '🥛', EGG: '🥚', IS: '🍦', KAKE: '🍰', PIZZA: '🍕',
    SUPPE: '🍲', VANN: '💧', TOMAT: '🍅', SITRON: '🍋', APPELSIN: '🍊', POTET: '🥔',
    // Familie
    MAMMA: '👩', PAPPA: '👨', BABY: '👶', MORMOR: '👵', FARMOR: '👵', MORFAR: '👴', FARFAR: '👴',
    // Farger
    RØD: '🟥', BLÅ: '🟦', GUL: '🟨', GRØNN: '🟩', SVART: '⬛', HVIT: '⬜', LILLA: '🟪',
    ORANSJE: '🟧', BRUN: '🟫', ROSA: '🩷',
  };

  function emojiFor(word) {
    return EMOJI[normalizeWord(word)] || '';
  }

  const PRESET_LISTS = [
    { name: 'Korte ord', icon: '🌱', words: ['sol', 'is', 'bil', 'hus', 'mus', 'ku', 'ost', 'egg'] },
    { name: 'Dyr', icon: '🐾', words: ['katt', 'hund', 'hest', 'gris', 'sau', 'fisk', 'bjørn', 'løve'] },
    { name: 'Mat', icon: '🍎', words: ['eple', 'banan', 'brød', 'ost', 'melk', 'kake', 'pizza'] },
    { name: 'Farger', icon: '🎨', words: ['rød', 'blå', 'gul', 'grønn', 'lilla', 'rosa'] },
    { name: 'Familie', icon: '👪', words: ['mamma', 'pappa', 'baby', 'mormor', 'farfar'] },
    { name: 'Æ, Ø og Å', icon: '🇳🇴', words: ['bjørn', 'blå', 'båt', 'snø', 'pære', 'løve', 'måne', 'jordbær'] },
  ];

  // ---------- Bokstavlyder ----------
  const LETTER_FILE = { 'Æ': 'ae', 'Ø': 'oe', 'Å': 'aa' };

  /** Filnavn (uten endelse) for lyden til en bokstav, f.eks. 'T' → 't', 'Ø' → 'oe'. */
  function letterSoundName(letter) {
    const l = normalizeWord(letter);
    return l ? (LETTER_FILE[l] || l.toLowerCase()) : '';
  }

  // ---------- Telle ----------
  const COUNT_THEMES = ['🍎', '🐞', '🚗', '⭐', '🐟', '🎈', '🦆', '🍓', '🌸', '🐶', '⚽', '🧁'];

  /** En telleoppgave: antall ting og tre tall å velge mellom (alle innenfor 1..max). */
  function buildCountRound(max, rng, previous) {
    const random = rng || Math.random;
    const top = Math.max(3, max | 0);
    let n;
    do {
      n = 1 + Math.floor(random() * top);
    } while (n === previous && top > 1);
    const options = new Set([n]);
    const near = shuffle([n - 2, n - 1, n + 1, n + 2].filter((x) => x >= 1 && x <= top), random);
    for (const x of near) {
      if (options.size >= 3) break;
      options.add(x);
    }
    return {
      count: n,
      emoji: COUNT_THEMES[Math.floor(random() * COUNT_THEMES.length)],
      options: Array.from(options).sort((a, b) => a - b),
    };
  }

  // ---------- Memory ----------
  const MEMORY_THEMES = {
    dyr: { name: 'Dyr', icon: '🐾', words: ['katt', 'hund', 'mus', 'hest', 'ku', 'gris', 'sau', 'fisk', 'bjørn', 'løve', 'frosk', 'ugle', 'pingvin', 'elefant'] },
    mat: { name: 'Mat', icon: '🍎', words: ['eple', 'banan', 'pære', 'drue', 'jordbær', 'gulrot', 'brød', 'ost', 'egg', 'is', 'kake', 'pizza', 'tomat', 'sitron'] },
    ting: { name: 'Ting', icon: '🚗', words: ['bil', 'buss', 'tog', 'båt', 'fly', 'sykkel', 'ball', 'bok', 'hus', 'gave', 'ballong', 'robot', 'rakett', 'krone'] },
    natur: { name: 'Natur', icon: '🌳', words: ['sol', 'måne', 'stjerne', 'sky', 'snø', 'tre', 'blomst', 'regnbue', 'fjell', 'hav', 'regn', 'bie', 'sommerfugl', 'snegl'] },
  };

  /** Stokket kortstokk med `pairs` par fra et tema (eller alle temaer om tema er 'blandet'). */
  function buildMemoryDeck(pairs, theme, rng) {
    const random = rng || Math.random;
    const pool = theme && MEMORY_THEMES[theme]
      ? MEMORY_THEMES[theme].words
      : Object.values(MEMORY_THEMES).flatMap((t) => t.words);
    const chosen = shuffle(pool, random).slice(0, Math.max(2, pairs | 0));
    const cards = [];
    chosen.forEach((word, pair) => {
      for (let k = 0; k < 2; k++) cards.push({ id: cards.length, pair, word, emoji: emojiFor(word) });
    });
    return shuffle(cards, random).map((c, id) => Object.assign(c, { id }));
  }

  // ---------- Farger og former ----------
  // def: bestemt form av adjektivet («den røde»), m/n: ubestemt hankjønn/intetkjønn («en rød», «et rødt»).
  const COLORS = [
    { key: 'rod', hex: '#e74c3c', m: 'rød', n: 'rødt', def: 'røde' },
    { key: 'bla', hex: '#2e86de', m: 'blå', n: 'blått', def: 'blå' },
    { key: 'gul', hex: '#f9ca24', m: 'gul', n: 'gult', def: 'gule' },
    { key: 'gronn', hex: '#27ae60', m: 'grønn', n: 'grønt', def: 'grønne' },
    { key: 'oransje', hex: '#f0932b', m: 'oransje', n: 'oransje', def: 'oransje' },
    { key: 'lilla', hex: '#8e44ad', m: 'lilla', n: 'lilla', def: 'lilla' },
    { key: 'rosa', hex: '#fd79a8', m: 'rosa', n: 'rosa', def: 'rosa' },
    { key: 'brun', hex: '#8d5524', m: 'brun', n: 'brunt', def: 'brune' },
  ];
  const SHAPES = [
    { key: 'sirkel', name: 'sirkel', def: 'sirkelen', neuter: false },
    { key: 'firkant', name: 'firkant', def: 'firkanten', neuter: false },
    { key: 'trekant', name: 'trekant', def: 'trekanten', neuter: false },
    { key: 'stjerne', name: 'stjerne', def: 'stjernen', neuter: false },
    { key: 'hjerte', name: 'hjerte', def: 'hjertet', neuter: true },
    { key: 'oval', name: 'oval', def: 'ovalen', neuter: false },
  ];

  /** «Finn den røde sirkelen» / «Finn trekanten» / «Finn det gule hjertet». */
  function shapePrompt(item, mode) {
    if (mode === 'former') return `Finn ${item.shape.def}`;
    return `Finn ${item.shape.neuter ? 'det' : 'den'} ${item.color.def} ${item.shape.def}`;
  }

  /** «Det er en blå trekant» / «Det er et rødt hjerte». */
  function shapeDescription(item, mode) {
    const article = item.shape.neuter ? 'et' : 'en';
    if (mode === 'former') return `Det er ${article} ${item.shape.name}`;
    const adj = item.shape.neuter ? item.color.n : item.color.m;
    return `Det er ${article} ${adj} ${item.shape.name}`;
  }

  /**
   * En runde i «Farger og former». mode: 'farger' (samme form, ulike farger),
   * 'former' (ulike former) eller 'begge' (ulike kombinasjoner).
   */
  function buildShapeRound(mode, choices, rng) {
    const random = rng || Math.random;
    const n = Math.max(2, Math.min(6, choices | 0));
    let items;
    if (mode === 'farger') {
      const shape = SHAPES[Math.floor(random() * SHAPES.length)];
      items = shuffle(COLORS, random).slice(0, n).map((color) => ({ shape, color }));
    } else if (mode === 'former') {
      items = shuffle(SHAPES, random).slice(0, n).map((shape) => ({
        shape,
        color: COLORS[Math.floor(random() * COLORS.length)],
      }));
    } else {
      const combos = [];
      for (const shape of SHAPES) for (const color of COLORS) combos.push({ shape, color });
      items = shuffle(combos, random).slice(0, n);
    }
    items = items.map((item, id) => Object.assign({ id }, item));
    const target = items[Math.floor(random() * items.length)];
    return { items, targetId: target.id, prompt: shapePrompt(target, mode) };
  }

  const api = {
    ALPHABET,
    MAX_WORD_LENGTH,
    MAX_WORDS,
    DIFFICULTIES,
    PRESET_LISTS,
    normalizeWord,
    parseWords,
    shuffle,
    buildLetterBank,
    resolveSettings,
    emojiFor,
    letterSoundName,
    COUNT_THEMES,
    buildCountRound,
    MEMORY_THEMES,
    buildMemoryDeck,
    COLORS,
    SHAPES,
    shapePrompt,
    shapeDescription,
    buildShapeRound,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PaizonLogic = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
