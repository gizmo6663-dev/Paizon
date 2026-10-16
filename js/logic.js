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

  /** 3 stjerner uten feil, 2 med få feil, ellers 1. Alle får minst én stjerne. */
  function starsFor(mistakes, hintsUsed, length) {
    const penalty = (mistakes | 0) + (hintsUsed | 0);
    if (penalty === 0) return 3;
    if (penalty <= Math.max(1, Math.floor(length / 3))) return 2;
    return 1;
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
    starsFor,
    emojiFor,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.PaizonLogic = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
