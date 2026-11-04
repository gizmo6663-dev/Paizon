const test = require('node:test');
const assert = require('node:assert/strict');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (f) => readFileSync(path.join(root, f), 'utf8');
const SPACE = ['js/space/core.js', 'js/space/proto2d.js', 'js/space/proto3d.js', 'js/games/space.js'];

test('Rommet er lastet i riktig rekkefølge og ligger i offline-lageret', () => {
  const html = read('index.html');
  const sw = read('sw.js');
  let last = html.indexOf('js/papir/apply.js');
  assert.ok(last > 0, 'papirdyrene må lastes før Rommet');
  for (const f of SPACE) {
    const at = html.indexOf(`<script src="${f}"></script>`);
    assert.ok(at > last, `${f} mangler eller lastes i feil rekkefølge`);
    last = at;
    assert.ok(sw.includes(`'${f}'`), `${f} mangler i sw.js`);
  }
  assert.ok(sw.includes("'js/vendor/three.module.min.js'"), 'three.js mangler i sw.js');
});

test('three.js er lagt ved med lisens og lastes bare for 3D', () => {
  const three = read('js/vendor/three.module.min.js');
  assert.match(three.slice(0, 200), /Three\.js Authors/);
  assert.match(three.slice(0, 400), /MIT/);
  // 2D-versjonen og resten av appen skal ikke vente på three.js.
  assert.ok(!read('index.html').includes('three.module'), 'three.js skal ikke lastes i index.html');
  assert.match(read('js/space/proto3d.js'), /import\(new URL\('js\/vendor\/three\.module\.min\.js'/);
});

test('begge prøveversjonene har skjerm, knapper og samme fasene', () => {
  const html = read('index.html');
  for (const id of ['screen-space-setup', 'screen-space', 'space-world', 'space-action', 'space-radio', 'space-count']) {
    assert.ok(html.includes(`id="${id}"`), `#${id} mangler`);
  }
  assert.ok(html.includes('data-space="2d"') && html.includes('data-space="3d"'));
  const game = read('js/games/space.js');
  assert.match(game, /registerGame\('space'/);
  for (const phase of ['pad', 'ignition', 'ascent', 'orbit', 'burn', 'transfer', 'landing', 'landed', 'moon']) {
    assert.ok(game.includes(`'${phase}'`), `fasen ${phase} mangler`);
  }
  assert.match(read('js/space/proto2d.js'), /create2D/);
  assert.match(read('js/space/proto3d.js'), /create3D/);
});

test('papirutklippene i Rommet er definert', () => {
  const core = read('js/space/core.js');
  for (const k of ['rakett', 'tarn', 'romstasjon', 'astronaut', 'flagg']) {
    assert.match(core, new RegExp(`define\\('${k}'`), `${k} er ikke tegnet`);
  }
});

test('Android-appen får lov til å vibrere', () => {
  assert.match(read('android/app/src/main/AndroidManifest.xml'), /android\.permission\.VIBRATE/);
  assert.ok(existsSync(path.join(root, 'js/vendor/three.module.min.js')));
});
