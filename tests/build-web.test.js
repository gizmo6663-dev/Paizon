const test = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { existsSync, readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('www/ får Capacitor-runtime lastet før appens egne skript', () => {
  execFileSync(process.execPath, ['scripts/build-web.mjs'], { cwd: root });
  // Uten denne mangler window.Capacitor.registerPlugin i Android-appen, og Start-knappen virker ikke.
  assert.ok(existsSync(path.join(root, 'www/js/capacitor.js')));
  const html = readFileSync(path.join(root, 'www/index.html'), 'utf8');
  const cap = html.indexOf('js/capacitor.js');
  assert.ok(cap > 0, 'capacitor.js er ikke lastet i www/index.html');
  for (const script of ['js/media.js', 'js/core.js', 'js/games/spell.js']) {
    assert.ok(html.indexOf(script) > cap, `${script} må lastes etter capacitor.js`);
  }
  assert.ok(existsSync(path.join(root, 'www/sounds/letters/t.mp3')), 'bokstavlydene mangler i www/');
  assert.ok(existsSync(path.join(root, 'www/js/vendor/matter.min.js')), 'Matter.js mangler i www/');
});
