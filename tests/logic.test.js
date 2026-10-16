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

test('letterSoundName gir filnavn for alle bokstaver, og lydfilene finnes', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  assert.equal(L.letterSoundName('t'), 't');
  assert.equal(L.letterSoundName('Æ'), 'ae');
  assert.equal(L.letterSoundName('ø'), 'oe');
  assert.equal(L.letterSoundName('Å'), 'aa');
  for (const letter of L.ALPHABET) {
    const file = path.join(__dirname, '..', 'sounds', 'letters', L.letterSoundName(letter) + '.mp3');
    assert.ok(fs.existsSync(file), `mangler lydfil for ${letter}`);
  }
});

test('buildCountRound gir riktig svar blant tre ulike tall innenfor området', () => {
  for (let seed = 1; seed < 300; seed++) {
    const max = [5, 10, 20][seed % 3];
    const r = L.buildCountRound(max, seeded(seed));
    assert.ok(r.count >= 1 && r.count <= max);
    assert.equal(r.options.length, 3);
    assert.equal(new Set(r.options).size, 3);
    assert.ok(r.options.includes(r.count));
    assert.ok(r.options.every((n) => n >= 1 && n <= max));
    assert.ok(L.COUNT_THEMES.includes(r.emoji));
  }
});

test('buildCountRound gjentar ikke samme antall to ganger på rad', () => {
  for (let seed = 1; seed < 100; seed++) {
    assert.notEqual(L.buildCountRound(5, seeded(seed), 3).count, 3);
  }
});

test('buildMemoryDeck lager nøyaktig to av hvert kort, alle med bilde', () => {
  for (const theme of [...Object.keys(L.MEMORY_THEMES), 'blandet']) {
    const deck = L.buildMemoryDeck(10, theme, seeded(7));
    assert.equal(deck.length, 20);
    const counts = {};
    for (const c of deck) counts[c.pair] = (counts[c.pair] || 0) + 1;
    assert.ok(Object.values(counts).every((n) => n === 2));
    assert.deepEqual(deck.map((c) => c.id), deck.map((_, i) => i));
  }
  for (const theme of Object.values(L.MEMORY_THEMES)) {
    for (const w of theme.words) assert.ok(L.emojiFor(w), `${w} mangler bilde`);
  }
});

test('buildShapeRound: målet er entydig i alle moduser', () => {
  for (const mode of ['farger', 'former', 'begge']) {
    for (let seed = 1; seed < 200; seed++) {
      const r = L.buildShapeRound(mode, 1 + (seed % 6), seeded(seed));
      assert.ok(r.items.length >= 2);
      const target = r.items.find((i) => i.id === r.targetId);
      assert.ok(target);
      const same = r.items.filter((i) => {
        if (mode === 'farger') return i.color.key === target.color.key;
        if (mode === 'former') return i.shape.key === target.shape.key;
        return i.color.key === target.color.key && i.shape.key === target.shape.key;
      });
      assert.equal(same.length, 1, `${mode}: ${r.prompt} er ikke entydig`);
      if (mode === 'farger') assert.equal(new Set(r.items.map((i) => i.shape.key)).size, 1);
    }
  }
});

test('farger og former bruker riktig norsk bøyning', () => {
  const shape = (k) => L.SHAPES.find((s) => s.key === k);
  const color = (k) => L.COLORS.find((c) => c.key === k);
  assert.equal(L.shapePrompt({ shape: shape('sirkel'), color: color('rod') }, 'farger'), 'Finn den røde sirkelen');
  assert.equal(L.shapePrompt({ shape: shape('hjerte'), color: color('gul') }, 'begge'), 'Finn det gule hjertet');
  assert.equal(L.shapePrompt({ shape: shape('trekant'), color: color('bla') }, 'former'), 'Finn trekanten');
  assert.equal(L.shapeDescription({ shape: shape('hjerte'), color: color('rod') }, 'begge'), 'Det er et rødt hjerte');
  assert.equal(L.shapeDescription({ shape: shape('trekant'), color: color('bla') }, 'farger'), 'Det er en blå trekant');
  assert.equal(L.shapeDescription({ shape: shape('stjerne'), color: color('lilla') }, 'former'), 'Det er en stjerne');
});
