const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../js/logic.js');

// Forutsigbar «tilfeldighet» for testene.
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

test('normalizeWord gjør om til store norske bokstaver og fjerner annet', () => {
  assert.equal(L.normalizeWord('katt'), 'KATT');
  assert.equal(L.normalizeWord(' Bjørn! '), 'BJØRN');
  assert.equal(L.normalizeWord('blå'), 'BLÅ');
  assert.equal(L.normalizeWord('kafé'), 'KAFE');
  assert.equal(L.normalizeWord('båt'), 'BÅT'); // A + kombinerende ring
  assert.equal(L.normalizeWord('123'), '');
  assert.equal(L.normalizeWord('a'.repeat(30)).length, L.MAX_WORD_LENGTH);
});

test('parseWords deler på komma, mellomrom og linjeskift og fjerner duplikater', () => {
  assert.deepEqual(L.parseWords('katt, hund\nsol;  Katt'), ['KATT', 'HUND', 'SOL']);
  assert.deepEqual(L.parseWords(''), []);
  assert.deepEqual(L.parseWords(' , ,, '), []);
});

test('buildLetterBank inneholder ordets bokstaver pluss ekstra bokstaver som ikke er i ordet', () => {
  const bank = L.buildLetterBank('KATT', 3, seeded(42));
  assert.equal(bank.length, 7);
  const letters = bank.map((t) => t.letter);
  for (const l of 'KATT') {
    const idx = letters.indexOf(l);
    assert.ok(idx >= 0, `mangler ${l}`);
    letters.splice(idx, 1);
  }
  for (const l of letters) assert.ok(!'KATT'.includes(l), `ekstrabokstav ${l} finnes i ordet`);
  assert.equal(new Set(bank.map((t) => t.id)).size, bank.length);
  assert.ok(bank.every((t) => t.used === false));
});

test('buildLetterBank legger ikke bokstavene i riktig rekkefølge', () => {
  for (let seed = 1; seed < 200; seed++) {
    const bank = L.buildLetterBank('SOL', 0, seeded(seed));
    assert.notEqual(bank.map((t) => t.letter).join(''), 'SOL');
  }
});

test('resolveSettings følger vanskelighetsgrad og overstyringer', () => {
  assert.equal(L.resolveSettings({ difficulty: 'lett' }).ghost, 'always');
  assert.equal(L.resolveSettings({ difficulty: 'middels' }).ghost, 'after');
  assert.equal(L.resolveSettings({ difficulty: 'vanskelig' }).ghost, 'never');
  assert.equal(L.resolveSettings({ difficulty: 'vanskelig', extraLetters: 'auto' }).extraLetters, 4);
  assert.equal(L.resolveSettings({ difficulty: 'lett', extraLetters: '6' }).extraLetters, 6);
  assert.equal(L.resolveSettings({ difficulty: 'middels', hintAfter: '3' }).hintAfter, 3);
  assert.equal(L.resolveSettings({ difficulty: 'ukjent' }).ghost, 'always');
});

test('starsFor gir 3 uten feil og minst 1', () => {
  assert.equal(L.starsFor(0, 0, 4), 3);
  assert.equal(L.starsFor(1, 0, 4), 2);
  assert.equal(L.starsFor(0, 1, 3), 2);
  assert.equal(L.starsFor(10, 2, 4), 1);
});

test('emojiFor finner bilder uavhengig av store/små bokstaver', () => {
  assert.equal(L.emojiFor('katt'), '🐱');
  assert.equal(L.emojiFor('BJØRN'), '🐻');
  assert.equal(L.emojiFor('xyz'), '');
});

test('alle ferdige ordlister er gyldige ord', () => {
  for (const preset of L.PRESET_LISTS) {
    for (const w of preset.words) assert.equal(L.normalizeWord(w).length, [...w].length, w);
  }
});
