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
  for (const m of D.MISSIONS) {
    if (m.species) m.species.forEach((k) => assert.ok(keys.has(k), `${m.key}: ${k}`));
    else assert.ok(m.depth > 0);
  }
});

test('ekte lydopptak har lisensfil og er med i service worker', () => {
  assert.ok(existsSync(path.join(root, 'sounds/ocean/LISENS.md')));
  const sw = readFileSync(path.join(root, 'sw.js'), 'utf8');
  for (const f of ['knolhval.mp3', 'spekkhogger.mp3', 'js/games/ocean.js']) assert.ok(sw.includes(f), f);
});
