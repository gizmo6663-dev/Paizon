const test = require('node:test');
const assert = require('node:assert/strict');
const { FluidSim, ryb2rgb, PAINTS, LIQUIDS } = require('../js/fluid.js');

function settle(liquid, h, steps, stir) {
  const s = new FluidSim({ width: 600, height: 400, max: 1000, h, liquid });
  s.fillRect(0, 240, 600, 400, PAINTS.bla.ryb, 600);
  for (let k = 0; k < steps; k++) {
    if (stir && k > 50 && k < 150) s.stir(300, 350, 8, -6, h * 3.5);
    s.step();
  }
  return s;
}

test('alle væsketyper holder seg stabile og innenfor kassen', () => {
  for (const liquid of Object.keys(LIQUIDS)) {
    for (const h of [12, 20, 32]) {
      const s = settle(liquid, h, 400, true);
      for (let i = 0; i < s.count; i++) {
        assert.ok(Number.isFinite(s.x[i]) && Number.isFinite(s.y[i]), `${liquid} h=${h}: ugyldig posisjon`);
        assert.ok(s.x[i] >= 0 && s.x[i] <= 600 && s.y[i] >= 0 && s.y[i] <= 400, `${liquid} h=${h}: utenfor kassen`);
      }
    }
  }
});

test('væsken legger seg i bunnen (tyngdekraft virker)', () => {
  const s = settle('vann', 16, 400, false);
  let ySum = 0;
  for (let i = 0; i < s.count; i++) ySum += s.y[i];
  assert.ok(ySum / s.count > 300, 'gjennomsnittlig høyde skal være i nedre del');
});

test('fillRect stopper ved grensen, og removeNear fjerner partikler', () => {
  const s = new FluidSim({ width: 400, height: 400, max: 500, h: 16 });
  s.fillRect(0, 0, 400, 400, PAINTS.rod.ryb, 120);
  assert.equal(s.count, 120);
  s.fillRect(0, 0, 400, 400, PAINTS.rod.ryb);
  assert.equal(s.count, 500, 'fyller aldri mer enn max');
  assert.equal(s.add(10, 10, PAINTS.rod.ryb), false);
  s.removeNear(200, 390, 60); // nede i væsken – fillRect fyller nedenfra
  assert.ok(s.count < 500);
  s.clear();
  assert.equal(s.count, 0);
});

test('farger blandes som maling: blå + gul blir grønn', () => {
  const s = new FluidSim({ width: 200, height: 200, max: 400, h: 16, liquid: 'vann' });
  s.fillRect(0, 100, 100, 200, PAINTS.bla.ryb);
  s.fillRect(100, 100, 200, 200, PAINTS.gul.ryb);
  for (let k = 0; k < 600; k++) {
    s.stir(100, 170, k % 40 < 20 ? 6 : -6, -2, 60);
    s.step();
  }
  const [r, g, b] = s.color(Math.floor(s.count / 2));
  assert.ok(g > r && g > b, `forventet grønnaktig farge, fikk rgb(${r}, ${g}, ${b})`);
});

test('ryb2rgb gir kjente malingsfarger', () => {
  assert.deepEqual(ryb2rgb(0, 0, 0), [255, 255, 255]);
  assert.deepEqual(ryb2rgb(1, 0, 0), [255, 0, 0]);
  assert.deepEqual(ryb2rgb(0, 1, 0), [255, 255, 0]);
  const [r, g, b] = ryb2rgb(1, 1, 0);
  assert.ok(r === 255 && g > 100 && b === 0, 'rød + gul = oransje');
});
