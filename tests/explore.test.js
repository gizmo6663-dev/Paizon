const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');
const F = require('../js/forest/data.js');
const K = require('../js/sky/data.js');

const root = path.join(__dirname, '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const creatures = read('js/explore/creatures.js');
const skyArt = read('js/sky/art.js');
const kit = read('js/explore/kit.js');
const hasArt = (src, kind) => new RegExp(`ART\\.${kind} =`).test(src);

function checkSpecies(list, label) {
  const keys = new Set();
  for (const s of list) {
    assert.ok(!keys.has(s.key), `${label}: duplikat ${s.key}`);
    keys.add(s.key);
    assert.ok(s.name && s.facts && s.facts.length > 80, `${label}/${s.key}: for kort tekst`);
    assert.ok(/[.!]$/.test(s.facts.trim()), `${label}/${s.key}: teksten skal slutte med punktum`);
    if (s.sound) assert.match(kit, new RegExp(`case '${s.sound}'`), `${label}/${s.key}: ukjent lyd ${s.sound}`);
  }
  return keys;
}

test('Skogen: alle arter har tekst, tegning og gyldig plass', () => {
  const keys = checkSpecies(F.SPECIES, 'skog');
  for (const s of F.SPECIES) {
    if (['gran', 'bjork'].includes(s.kind)) continue; // trærne tegnes i forest/art.js
    assert.ok(hasArt(creatures, s.kind), `skog/${s.key}: mangler tegning ${s.kind}`);
    if (s.x) assert.ok(s.x[0] >= 0 && s.x[1] <= F.WORLD.width, `skog/${s.key}: utenfor stien`);
    if (s.when && s.when.times) s.when.times.forEach((t) => assert.ok(F.TIMES.some((x) => x.key === t), `${s.key}: ukjent tid ${t}`));
    if (s.when && s.when.seasons) s.when.seasons.forEach((t) => assert.ok(F.SEASONS.some((x) => x.key === t), `${s.key}: ukjent årstid ${t}`));
  }
  for (const h of F.HIDEOUTS) {
    h.hides.forEach((o) => assert.ok(keys.has(o.species), `${h.key}: ${o.species}`));
    assert.ok(h.x > 0 && h.x < F.WORLD.width);
  }
  // Alle som bare finnes i gjemmesteder, må kunne finnes i minst ett av dem.
  for (const s of F.SPECIES.filter((x) => x.place === 'hidden')) {
    assert.ok(F.HIDEOUTS.some((h) => h.hides.some((o) => o.species === s.key)), `${s.key} finnes ikke i noe gjemmested`);
  }
});

test('Skogen: det finnes noe å se til alle tider og i alle årstider', () => {
  for (const t of F.TIMES) {
    for (const s of F.SEASONS) {
      const out = F.SPECIES.filter((sp) => !['hidden', 'thing'].includes(sp.place) && !sp.secret && F.present(sp, t.key, s.key));
      assert.ok(out.length >= 3, `${t.key}/${s.key}: bare ${out.length}`);
    }
  }
  assert.equal(F.hiddenIn(F.HIDEOUTS.find((h) => h.key === 'dam'), 'dag', 'vinter'), null, 'dammen er frosset om vinteren');
  assert.equal(F.hiddenIn(F.HIDEOUTS.find((h) => h.key === 'hultre'), 'dag', 'sommer'), 'ugle', 'ugla sover i treet om dagen');
});

test('Skogen: oppdragene peker på ting som finnes og kan nås', () => {
  const keys = new Set(F.SPECIES.map((s) => s.key));
  for (const m of F.MISSIONS) {
    if (m.hideouts) m.hideouts.forEach((k) => assert.ok(F.HIDEOUTS.some((h) => h.key === k), k));
    else {
      m.species.forEach((k) => assert.ok(keys.has(k), `${m.key}: ${k}`));
      const ok = m.species.some((k) => {
        const sp = F.SPECIES.find((s) => s.key === k);
        return F.TIMES.some((t) => F.SEASONS.some((s) => (!m.season || m.season === s.key) && F.present(sp, t.key, s.key)));
      });
      assert.ok(ok, `${m.key}: kan aldri løses`);
    }
  }
});

test('Himmelen: høydeskalaen er stigende og går begge veier', () => {
  for (let i = 1; i < K.ALT_SCALE.length; i++) {
    assert.ok(K.ALT_SCALE[i][0] > K.ALT_SCALE[i - 1][0]);
    assert.ok(K.ALT_SCALE[i][1] > K.ALT_SCALE[i - 1][1]);
  }
  for (const m of [0, 10, 30, 150, 800, 2500, 10000]) assert.ok(Math.abs(K.altAt(K.uAt(m)) - m) < 0.01, `${m} m`);
  for (let x = 0; x <= K.WORLD.width; x += 0.1) {
    const g = K.groundAt(x);
    assert.ok(g >= 0 && g < 2100, `bakken ved x=${x}: ${g}`);
  }
});

test('Himmelen: fugler og ting har tekst, tegning og høyder over bakken', () => {
  checkSpecies(K.SPECIES, 'himmel');
  for (const s of K.SPECIES) {
    assert.ok(hasArt(s.thing ? skyArt : creatures, s.kind), `himmel/${s.key}: mangler tegning ${s.kind}`);
    if (s.thing) continue;
    assert.ok(s.alt[1] > s.alt[0] && s.x[1] > s.x[0], s.key);
    // Minst ett sted i området der høyeste høyde er over bakken.
    let ok = false;
    for (let x = s.x[0]; x <= s.x[1]; x += 0.1) if (s.alt[1] > K.groundAt(x) + 5) ok = true;
    assert.ok(ok, `${s.key}: flyr under bakken`);
  }
  for (const w of ['sol', 'skyer', 'natt']) {
    const birds = K.SPECIES.filter((s) => !s.thing && !s.secret && K.present(s, w));
    assert.ok(birds.length >= 3, `${w}: for få fugler`);
  }
  const keys = new Set(K.SPECIES.map((s) => s.key));
  for (const m of K.MISSIONS) {
    if (m.species) m.species.forEach((k) => assert.ok(keys.has(k), `${m.key}: ${k}`));
    else assert.ok(m.alt > 0 || m.cloud);
  }
});

test('nye filer er med i appen og i service worker', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  for (const f of ['js/explore/kit.js', 'js/explore/creatures.js', 'js/forest/data.js', 'js/forest/art.js', 'js/games/forest.js', 'js/sky/data.js', 'js/sky/art.js', 'js/games/sky.js']) {
    assert.ok(existsSync(path.join(root, f)), f);
    assert.ok(html.includes(f), `${f} mangler i index.html`);
    assert.ok(sw.includes(f), `${f} mangler i sw.js`);
  }
});
