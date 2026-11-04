const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const Ocean = require('../js/ocean/data.js');
const Forest = require('../js/forest/data.js');
const Sky = require('../js/sky/data.js');

const root = path.join(__dirname, '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const apply = read('js/papir/apply.js');
const papir = ['js/papir/fish.js', 'js/papir/critters.js', 'js/papir/land.js'].map(read).join('\n');

/** Alle nøkler som papirmodulene registrerer (define('x', …), fisk-…, og artstabellene i land.js). */
function definedKeys() {
  const keys = new Set();
  for (const m of papir.matchAll(/def(?:ine)?\('([a-z-]+)'/g)) keys.add(m[1]);
  for (const m of read('js/papir/fish.js').matchAll(/^\s{4}([a-z]+): \{ h:/gm)) keys.add(`fisk-${m[1]}`);
  for (const m of read('js/papir/land.js').matchAll(/^\s{4}([a-z]+): (?:P\()?\{ (?:box|body):/gm)) keys.add(m[1]);
  return keys;
}

test('alle havdyr er tegnet som papirdyr', () => {
  const keys = definedKeys();
  const things = new Set(['coral', 'wreck', 'bottle']);
  for (const s of Ocean.SPECIES) {
    if (things.has(s.kind)) {
      assert.match(apply, new RegExp(`SPECIES_ART\\.${s.kind} = wrap`), `${s.key}: tingen er ikke klippet ut`);
      continue;
    }
    const m = apply.match(new RegExp(`\\b${s.kind}: '([a-z-]+)'`));
    assert.ok(m, `${s.key} (${s.kind}) mangler i papirkartet`);
    assert.ok(keys.has(m[1]), `${s.key}: papirtegningen ${m[1]} finnes ikke`);
  }
});

test('alle dyr i skogen og på himmelen er tegnet som papirdyr', () => {
  const keys = definedKeys();
  const list = apply.match(/for \(const k of \[([^\]]+)\]/)[1];
  const things = new Set(['gran', 'bjork']); // trærne er papirutklipp i forest/art.js
  for (const s of [...Forest.SPECIES, ...Sky.SPECIES.filter((x) => !x.thing)]) {
    if (things.has(s.kind)) continue;
    assert.ok(list.includes(`'${s.kind}'`), `${s.key} (${s.kind}) kobles ikke til papirtegningen`);
    assert.ok(keys.has(s.kind), `${s.key}: papirtegningen ${s.kind} finnes ikke`);
  }
});

test('papirmodulene lastes etter spillene, og er med i service worker', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  const last = Math.max(html.indexOf('js/games/ocean.js'), html.indexOf('js/games/forest.js'), html.indexOf('js/games/sky.js'));
  let prev = last;
  for (const f of ['js/papir/core.js', 'js/papir/fish.js', 'js/papir/critters.js', 'js/papir/land.js', 'js/papir/apply.js']) {
    const i = html.indexOf(f);
    assert.ok(i > prev, `${f} må lastes etter spillene og i riktig rekkefølge`);
    prev = i;
    assert.ok(sw.includes(f), `${f} mangler i sw.js`);
  }
});

test('stil 4a: blekkontur, skygge og papirfiber har verdiene fra designet', () => {
  const core = read('js/papir/core.js');
  assert.match(core, /INK = '#2b2219'/);
  assert.match(core, /SHADOW = 'rgba\(40,30,15,0\.34\)'/);
  assert.match(core, /Math\.max\(1\.2, Lpx \* 0\.009\)/, 'konturradius');
  assert.match(core, /width = g\.height = 192/, 'fiberteksturen er 192 × 192');
  assert.match(core, /i < 1100/);
  assert.match(core, /i < 2600/);
});
