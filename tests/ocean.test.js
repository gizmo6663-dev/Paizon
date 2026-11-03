const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');
const D = require('../js/ocean/data.js');

const root = path.join(__dirname, '..');

test('dybdeskalaen er stigende og yAtDepth er motsatt av depthAt', () => {
  for (let i = 1; i < D.DEPTH_SCALE.length; i++) {
    assert.ok(D.DEPTH_SCALE[i][0] > D.DEPTH_SCALE[i - 1][0]);
    assert.ok(D.DEPTH_SCALE[i][1] > D.DEPTH_SCALE[i - 1][1]);
  }
  for (const d of [0, 1, 5, 12, 40, 100, 200, 650, 1000, 2500]) {
    assert.ok(Math.abs(D.depthAt(D.yAtDepth(d)) - d) < 0.01, `dybde ${d}`);
  }
});

test('havbunnen ligger inne i verden', () => {
  for (let x = 0; x <= D.WORLD.width; x += 0.05) {
    const y = D.seabedAt(x); // stranda helt til venstre ligger i vannkanten
    assert.ok(y >= 0 && y <= D.WORLD.height, `x=${x} y=${y}`);
  }
  assert.ok(D.depthAt(D.seabedAt(D.WORLD.width - 0.1)) > 2000, 'dypet når ikke 2000 m');
});

test('alle arter har fakta, sone og en plass som finnes over bunnen', () => {
  const zones = new Set(D.ZONES.map((z) => z.key));
  const keys = new Set();
  for (const s of D.SPECIES) {
    assert.ok(!keys.has(s.key), `duplikat ${s.key}`);
    keys.add(s.key);
    assert.ok(zones.has(s.zone), `${s.key}: ukjent sone ${s.zone}`);
    assert.ok(s.facts && s.facts.length > 60, `${s.key}: for kort tekst`);
    if (s.place.type === 'inside') {
      const pl = D.PLACES.find((p) => p.key === s.place.in);
      assert.ok(pl, `${s.key}: ukjent sted ${s.place.in}`);
      assert.ok(pl.items.some((it) => it.species === s.key), `${s.key}: finnes ikke inne i ${pl.key}`);
      continue;
    }
    assert.ok(s.place.x[0] >= 0 && s.place.x[1] <= D.WORLD.width, `${s.key}: x utenfor verden`);
    if (s.place.type === 'water') {
      // Minst ett punkt i x-intervallet må ha plass til grunneste dybde over bunnen.
      let ok = false;
      for (let x = s.place.x[0]; x <= s.place.x[1]; x += 0.02) {
        if (D.yAtDepth(s.place.depth[0]) < D.seabedAt(x) - 0.02) ok = true;
      }
      assert.ok(ok, `${s.key}: ingen plass over bunnen`);
    }
    if (s.sound) assert.ok(existsSync(path.join(root, 'sounds/ocean', s.sound)), `${s.key}: lydfil mangler`);
  }
});

test('alle arter har tegning, og oppdragene peker på arter som finnes', () => {
  const art = readFileSync(path.join(root, 'js/ocean/art.js'), 'utf8');
  for (const s of D.SPECIES) assert.match(art, new RegExp(`SPECIES_ART\\.${s.kind} =`), `${s.key}: mangler tegning ${s.kind}`);
  const keys = new Set(D.SPECIES.map((s) => s.key));
  const places = new Set(D.PLACES.map((p) => p.key));
  for (const m of D.MISSIONS) {
    if (m.species) m.species.forEach((k) => assert.ok(keys.has(k), `${m.key}: ${k}`));
    else if (m.places) m.places.forEach((k) => assert.ok(places.has(k), `${m.key}: ${k}`));
    else assert.ok(m.depth > 0);
  }
});

test('grotter og vrak: ligger på bunnen i riktig sone, og alt inni har tegning og tekst', () => {
  const art = readFileSync(path.join(root, 'js/ocean/art.js'), 'utf8');
  const inside = readFileSync(path.join(root, 'js/ocean/inside.js'), 'utf8');
  for (const pl of D.PLACES) {
    assert.ok(pl.x > 0 && pl.x < D.WORLD.width, pl.key);
    const zone = D.zoneAt(D.depthAt(D.seabedAt(pl.x)));
    assert.equal(zone.key, pl.zone, `${pl.key} ligger i ${zone.key}`);
    assert.ok(pl.intro.length > 40, `${pl.key}: mangler intro`);
    assert.ok(pl.items.length >= 4, `${pl.key}: for lite å finne`);
    for (const it of pl.items) {
      assert.ok(it.x >= 0 && it.x <= 1 && it.y >= 0 && it.y <= 1, `${pl.key}/${it.key}: utenfor bildet`);
      assert.ok([0, 1, 2].includes(it.layer), `${pl.key}/${it.key}: ukjent lag`);
      if (it.species) assert.ok(D.SPECIES.some((s) => s.key === it.species), `${pl.key}/${it.key}: ukjent art`);
      else assert.ok(it.name && it.text && it.text.length > 40, `${pl.key}/${it.key}: mangler tekst`);
      const drawn = new RegExp(`SPECIES_ART\\.${it.art} =`).test(art) || new RegExp(`\\n    ${it.art}\\(ctx`).test(inside);
      assert.ok(drawn, `${pl.key}/${it.key}: mangler tegning ${it.art}`);
    }
  }
  // Skipsvraket man trykker på ute i havet, fører inn i et sted som finnes.
  for (const s of D.SPECIES) if (s.enter) assert.ok(D.PLACES.some((p) => p.key === s.enter), s.key);
});

test('ekte lydopptak har lisensfil og er med i service worker', () => {
  assert.ok(existsSync(path.join(root, 'sounds/ocean/LISENS.md')));
  const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const f of ['knolhval.mp3', 'spekkhogger.mp3', 'js/games/ocean.js', 'js/ocean/inside.js']) assert.ok(sw.includes(f), f);
});
