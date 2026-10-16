const test = require('node:test');
const assert = require('node:assert/strict');
const { FluidSim, ryb2rgb, PAINTS, LIQUIDS, obstacleDistance } = require('../js/fluid.js');

function settle(liquid, h, steps, stir) {
  const s = new FluidSim({ width: 600, height: 400, max: 1000, h });
  s.fillRect(0, 240, 600, 400, PAINTS.bla.ryb, 600, LIQUIDS[liquid].index);
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

test('olje og vann blander seg ikke, og olje flyter opp', () => {
  const s = new FluidSim({ width: 400, height: 400, max: 900, h: 16 });
  s.fillRect(0, 150, 400, 400, PAINTS.bla.ryb, 700);
  for (let i = 0; i < s.count; i++) s.mat[i] = i % 5 < 2 ? 1 : 0; // 40 % olje, godt blandet
  for (let k = 0; k < 1500; k++) s.step();
  const avgY = (m) => {
    let t = 0;
    let c = 0;
    for (let i = 0; i < s.count; i++) if (s.mat[i] === m) { t += s.y[i]; c++; }
    return t / c;
  };
  assert.ok(avgY(1) < avgY(0) - 15, `olje (${avgY(1).toFixed(0)}) skal ligge over vann (${avgY(0).toFixed(0)})`);
  // Få partikler skal ha flest naboer av den andre væsken.
  let mixed = 0;
  for (let i = 0; i < s.count; i++) {
    let same = 0;
    let other = 0;
    for (let j = 0; j < s.count; j++) {
      if (i !== j && Math.hypot(s.x[i] - s.x[j], s.y[i] - s.y[j]) < s.h) (s.mat[i] === s.mat[j] ? same++ : other++);
    }
    if (other > same) mixed++;
  }
  assert.ok(mixed / s.count < 0.12, `for mye blanding: ${(100 * mixed / s.count).toFixed(0)} %`);
});

test('kranen lager væske, og kan skrus av', () => {
  const s = new FluidSim({ width: 400, height: 400, max: 600, h: 16 });
  const f = s.addFaucet(5, 100, 1, 0, 0.5);
  for (let k = 0; k < 100; k++) s.step();
  const after = s.count;
  assert.ok(after > 50, `for lite fra kranen: ${after}`);
  f.on = false;
  for (let k = 0; k < 50; k++) s.step();
  assert.equal(s.count, after);
  // Sterkere stråle gir mer væske.
  const weak = new FluidSim({ width: 400, height: 400, max: 2000, h: 16 });
  const strong = new FluidSim({ width: 400, height: 400, max: 2000, h: 16 });
  weak.addFaucet(200, 5, 0, 1, 0.1);
  strong.addFaucet(200, 5, 0, 1, 1);
  for (let k = 0; k < 100; k++) { weak.step(); strong.step(); }
  assert.ok(strong.count > weak.count * 2);
});

test('sluket i bunnen fjerner væske, men ikke med proppen i', () => {
  const run = (open) => {
    const s = new FluidSim({ width: 400, height: 400, max: 900, h: 16 });
    s.fillRect(0, 200, 400, 400, PAINTS.bla.ryb, 600);
    s.floorDrain.open = open;
    for (let k = 0; k < 800; k++) s.step();
    return s.count;
  };
  assert.ok(run(true) < 50, 'åpent sluk skal tømme karet');
  assert.equal(run(false), 600, 'med proppen i skal ingenting renne ut');
});

test('kranstrålen er tynn', () => {
  const s = new FluidSim({ width: 400, height: 600, max: 600, h: 20 });
  s.floorDrain.open = false;
  s.addFaucet(200, 5, 0, 1, 0.5);
  for (let k = 0; k < 60; k++) s.step();
  // Partiklene i strålen (godt over bunnen) skal ligge nesten på rekke.
  const xs = [];
  for (let i = 0; i < s.count; i++) if (s.y[i] < 400) xs.push(s.x[i]);
  assert.ok(xs.length > 20);
  const spread = Math.max(...xs) - Math.min(...xs);
  assert.ok(spread < s.h * 0.6, `strålen er ${spread.toFixed(1)} px bred`);
});

test('væsken trenger ikke inn i hindringer, og skåla holder på vann', () => {
  for (const type of ['kloss', 'planke', 'halvmane', 'skal']) {
    const s = new FluidSim({ width: 500, height: 500, max: 900, h: 16 });
    const o = s.addObstacle(type, 250, 260, type === 'planke' ? 0.4 : 0);
    s.floorDrain.open = false;
    s.addFaucet(250, 10, 0, 1, 0.5);
    for (let k = 0; k < 500; k++) s.step();
    let inside = 0;
    for (let i = 0; i < s.count; i++) if (obstacleDistance(o, s.x[i], s.y[i]) < 0) inside++;
    assert.equal(inside, 0, `${type}: ${inside} partikler inne i hindringen`);
    if (type === 'halvmane' || type === 'skal') {
      s.faucets[0].on = false;
      for (let k = 0; k < 300; k++) s.step();
      let held = 0;
      for (let i = 0; i < s.count; i++) if (Math.hypot(s.x[i] - o.x, s.y[i] - o.y) < o.r && s.y[i] > o.y - 10) held++;
      assert.ok(held > 30, `${type} holder bare ${held} partikler`);
    }
  }
});

test('obstacleAt finner hindringen under fingeren', () => {
  const s = new FluidSim({ width: 400, height: 400, h: 16 });
  const k = s.addObstacle('kloss', 100, 100, 0);
  assert.equal(s.obstacleAt(100, 100), k);
  assert.equal(s.obstacleAt(300, 300), null);
  s.removeObstacle(k);
  assert.equal(s.obstacleAt(100, 100), null);
});
