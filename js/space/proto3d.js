/*
 * Rommet – 3D-prototypen («papirmodeller i ekte lys»). Raketten, tårnet og trærne er
 * papirmodeller: flate fasetter, tre lystoner og blekkontur. Jorda, Månen og sola er kuler i ekte
 * lys med glødende atmosfære. Kameraet sveiper som i en film: fra rampa, opp gjennom skylaget,
 * ut i bane, tilbake mot den lille jorda og ned på Månen, der jorda stiger opp over horisonten.
 * Astronauten og skyene er papirutklipp som står i 3D-verdenen (som i et papirteater).
 */
(function () {
  'use strict';

  const S = window.PaizonSpace;
  const { clamp, lerp, smooth, seeded } = S;

  async function create3D(wrap) {
    const THREE = await import(new URL('js/vendor/three.module.min.js', document.baseURI).href);
    const K = window.PaizonPapir;
    const SA = window.PaizonSkyArt;
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const INK = 0x2b2219;

    const renderer = new THREE.WebGLRenderer({ antialias: true, logarithmicDepthBuffer: true, powerPreference: 'high-performance' });
    renderer.domElement.className = 'space-canvas';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    wrap.prepend(renderer.domElement);
    const flash = document.createElement('div');
    flash.className = 'space-flash';
    wrap.appendChild(flash);
    const grainDiv = document.createElement('div');
    grainDiv.className = 'space-grain';
    grainDiv.style.backgroundImage = `url(${K.grain().toDataURL()})`;
    wrap.appendChild(grainDiv);
    let W = 0;
    let H = 0;
    const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900000);
    function resize() {
      const r = wrap.getBoundingClientRect();
      W = Math.max(200, r.width);
      H = Math.max(200, r.height);
      renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
      renderer.setSize(W, H, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    }
    resize();

    // ---------- Papirmaterialer ----------
    const grad = new THREE.DataTexture(new Uint8Array([70, 150, 255]), 3, 1, THREE.RedFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    const grainCanvas = document.createElement('canvas');
    grainCanvas.width = grainCanvas.height = 192;
    const gctx = grainCanvas.getContext('2d');
    gctx.fillStyle = '#ffffff';
    gctx.fillRect(0, 0, 192, 192);
    gctx.drawImage(K.grain(), 0, 0);
    gctx.drawImage(K.grain(), 0, 0);
    const grainTex = new THREE.CanvasTexture(grainCanvas);
    grainTex.wrapS = grainTex.wrapT = THREE.RepeatWrapping;
    grainTex.colorSpace = THREE.SRGBColorSpace;
    const toonCache = new Map();
    const toon = (color) => {
      if (!toonCache.has(color)) toonCache.set(color, new THREE.MeshToonMaterial({ color, gradientMap: grad, map: grainTex }));
      return toonCache.get(color);
    };
    const outlineCache = new Map();
    function outlineMat(th) {
      const k = th.toFixed(3);
      if (outlineCache.has(k)) return outlineCache.get(k);
      const m = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
      m.onBeforeCompile = (s) => {
        s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n transformed += normalize(normal) * ${k};`);
      };
      m.customProgramCacheKey = () => `outline${k}`;
      outlineCache.set(k, m);
      return m;
    }
    /** En papirdel: fasettert toon-flate med blekkontur rundt. */
    function part(geo, color, th) {
      const g = new THREE.Group();
      const mat = toon(color);
      mat.flatShading = true;
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      g.add(new THREE.Mesh(geo, outlineMat(th || 0.04)));
      return g;
    }
    function canvasTex(c) {
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    }
    function radialTex(stops, size) {
      const c = document.createElement('canvas');
      c.width = c.height = size || 128;
      const x = c.getContext('2d');
      const g = x.createRadialGradient(c.width / 2, c.height / 2, 0, c.width / 2, c.height / 2, c.width / 2);
      stops.forEach(([o, col]) => g.addColorStop(o, col));
      x.fillStyle = g;
      x.fillRect(0, 0, c.width, c.height);
      return canvasTex(c);
    }
    const glowTex = radialTex([[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,230,180,0.6)'], [1, 'rgba(255,200,140,0)']]);
    const sunTex = radialTex([[0, 'rgba(255,255,250,1)'], [0.06, 'rgba(255,250,230,1)'], [0.15, 'rgba(255,230,180,0.45)'], [1, 'rgba(255,200,140,0)']], 256);
    /** Papirdott (røyk og støv): hvit sirkel med blekkant og fiber. */
    function puffTex(fill) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const x = c.getContext('2d');
      x.fillStyle = '#2b2219';
      x.beginPath();
      x.arc(64, 64, 60, 0, Math.PI * 2);
      x.fill();
      x.fillStyle = fill;
      x.beginPath();
      x.arc(64, 64, 55, 0, Math.PI * 2);
      x.fill();
      x.globalCompositeOperation = 'source-atop';
      x.drawImage(K.grain(), 0, 0);
      return canvasTex(c);
    }
    /** Et papirutklipp som tekstur (skyer, astronaut). Gir { tex, w, h, cx, cy }. */
    function cutTex(Lpx, box, draw) {
      const cut = K.makeCut(Lpx, box, (c) => draw(c, Lpx));
      const c = document.createElement('canvas');
      const pad = 8;
      c.width = cut.img.width + pad * 2;
      c.height = cut.img.height + pad * 2;
      const x = c.getContext('2d');
      x.shadowColor = K.SHADOW;
      x.shadowOffsetX = -Math.max(1, Lpx * 0.007);
      x.shadowOffsetY = Math.max(1.2, Lpx * 0.012);
      x.drawImage(cut.img, pad, pad);
      return { tex: canvasTex(c), w: c.width, h: c.height, cx: (cut.ox + pad) / c.width, cy: 1 - (cut.oy + pad) / c.height };
    }

    // ---------- Raketten (papirmodell) ----------
    function buildRocket(withLegs) {
      const root = new THREE.Group();
      const s1 = new THREE.Group();
      const s2 = new THREE.Group();
      const seg = 10;
      const add = (grp, obj, y) => {
        obj.position.y = y;
        grp.add(obj);
        return obj;
      };
      add(s1, part(new THREE.CylinderGeometry(0.36, 0.56, 0.45, seg), 0x4a4540, 0.03), 0.22);
      add(s1, part(new THREE.CylinderGeometry(0.6, 0.6, 5.0, seg), 0xf4f1ea, 0.04), 2.95);
      add(s1, part(new THREE.CylinderGeometry(0.615, 0.615, 0.45, seg), 0x2b2219, 0.02), 4.0);
      add(s1, part(new THREE.CylinderGeometry(0.615, 0.615, 0.25, seg), 0xd8432e, 0.02), 1.1);
      const fin = new THREE.Shape();
      fin.moveTo(0, 0);
      fin.lineTo(0, 1.5);
      fin.lineTo(0.85, -0.2);
      fin.lineTo(0.85, -0.45);
      fin.closePath();
      const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.08, bevelEnabled: false });
      finGeo.translate(0, 0, -0.04);
      for (let i = 0; i < 4; i++) {
        const f = part(finGeo.clone(), 0xd8432e, 0.03);
        f.rotation.y = (i * Math.PI) / 2;
        f.children.forEach((m) => { m.position.x = 0.55; });
        f.position.y = 0.55;
        s1.add(f);
      }
      add(s2, part(new THREE.CylinderGeometry(0.3, 0.45, 0.35, seg), 0x4a4540, 0.03), 5.6);
      add(s2, part(new THREE.CylinderGeometry(0.6, 0.6, 2.9, seg), 0xf4f1ea, 0.04), 7.2);
      add(s2, part(new THREE.CylinderGeometry(0.615, 0.615, 0.3, seg), 0xd8432e, 0.02), 6.1);
      const win = part(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 14), 0x6fb4d8, 0.03);
      win.rotation.x = Math.PI / 2;
      win.position.set(0, 7.9, 0.58);
      s2.add(win);
      add(s2, part(new THREE.ConeGeometry(0.6, 1.9, seg), 0xd8432e, 0.04), 9.6);
      if (withLegs) {
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2 + 0.5;
          const leg = part(new THREE.CylinderGeometry(0.07, 0.07, 2.4, 6), 0x8e8a82, 0.02);
          leg.position.set(Math.cos(a) * 0.95, 4.9, Math.sin(a) * 0.95);
          leg.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
          s2.add(leg);
          const pad = part(new THREE.CylinderGeometry(0.28, 0.32, 0.08, 10), 0x8e8a82, 0.02);
          pad.position.set(Math.cos(a) * 1.45, 3.85, Math.sin(a) * 1.45);
          s2.add(pad);
        }
      }
      root.add(s1, s2);
      return { root, s1, s2 };
    }
    function buildFlame() {
      const g = new THREE.Group();
      const layers = [[0.55, 4.2, 0xff7a2a, 0.55], [0.38, 3.0, 0xffbe50, 0.7], [0.2, 1.8, 0xfff6dc, 0.95]];
      g.cones = layers.map(([r, h, col, op]) => {
        // Bred ved dysa (y = 0), spiss nederst (y = −h).
        const geo = new THREE.ConeGeometry(r, h, 14, 1, true);
        geo.translate(0, h / 2, 0);
        geo.rotateX(Math.PI);
        const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
        g.add(m);
        return m;
      });
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffb070, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.set(6, 6, 1);
      glow.position.y = -0.8;
      g.add(glow);
      g.glow = glow;
      const light = new THREE.PointLight(0xffa050, 0, 140, 2);
      light.position.y = -1;
      g.add(light);
      g.light = light;
      g.set = (thrust, air, t) => {
        const fl = 1 + Math.sin(t * 47) * 0.06 + Math.sin(t * 31) * 0.05;
        const wide = 1 + (1 - air) * 1.6;
        g.visible = thrust > 0.02;
        g.cones.forEach((c, i) => {
          c.scale.set(wide * (i === 2 ? 1 : 1), (0.35 + thrust * 0.9) * fl * (1 + (1 - air) * 0.5), wide);
          c.material.opacity = [0.55, 0.7, 0.95][i] * (0.55 + 0.45 * air);
        });
        glow.scale.setScalar(5 + 7 * thrust * (0.5 + air));
        light.intensity = thrust * 900;
      };
      return g;
    }

    // =====================================================================
    // Scene 1: utskytningsrampa (1 enhet ≈ 10 m)
    // =====================================================================
    const ground = new THREE.Scene();
    ground.fog = new THREE.Fog(0xbfe0f4, 300, 2600);
    ground.add(new THREE.HemisphereLight(0xcfe8ff, 0x6a8a3e, 1.4));
    const gSun = new THREE.DirectionalLight(0xfff2dc, 2.4);
    gSun.position.set(60, 90, 40);
    ground.add(gSun);
    {
      const plane = new THREE.Mesh(new THREE.CircleGeometry(3000, 48), toon(0x6f9a46));
      plane.rotation.x = -Math.PI / 2;
      ground.add(plane);
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(9000, 3000), toon(0x3f86ae));
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(0, 0.3, -2200);
      ground.add(sea);
      const r = seeded(12);
      for (let i = 0; i < 26; i++) {
        const a = -Math.PI * 0.95 + (i / 25) * Math.PI * 0.9 + (r() - 0.5) * 0.08;
        const d = 700 + r() * 600;
        const h = 160 + r() * 320;
        const m = part(new THREE.ConeGeometry(h * 0.75, h, 6), 0x8fa3b2, 3);
        m.position.set(Math.cos(a) * d, h / 2 - 10, Math.sin(a) * d);
        m.rotation.y = r() * 3;
        ground.add(m);
        const snow = part(new THREE.ConeGeometry(h * 0.27, h * 0.36, 6), 0xf2f5f8, 1.5);
        snow.position.set(m.position.x, h - 10 - h * 0.18 + 1, m.position.z);
        snow.rotation.y = m.rotation.y;
        ground.add(snow);
      }
      // Skog (to instanserte lag: kjegler og konturer).
      const treeGeo = new THREE.ConeGeometry(2.6, 9, 6);
      treeGeo.translate(0, 4.5, 0);
      treeGeo.computeVertexNormals();
      const N = 260;
      const trees = new THREE.InstancedMesh(treeGeo, toon(0x2f5a2c), N);
      const tOut = new THREE.InstancedMesh(treeGeo, outlineMat(0.18), N);
      const mtx = new THREE.Matrix4();
      for (let i = 0; i < N; i++) {
        let x;
        let z;
        do {
          x = (r() - 0.5) * 520;
          z = -r() * 420 + 120;
        } while (Math.hypot(x, z) < 40);
        const s = 0.7 + r() * 0.9;
        mtx.compose(V(x, 0, z), new THREE.Quaternion(), V(s, s * (0.9 + r() * 0.4), s));
        trees.setMatrixAt(i, mtx);
        tOut.setMatrixAt(i, mtx);
      }
      ground.add(trees, tOut);
      const pad = part(new THREE.CylinderGeometry(9, 10, 1.2, 12), 0xb9b2a6, 0.1);
      pad.position.y = 0.6;
      ground.add(pad);
    }
    const tower = new THREE.Group();
    {
      const red = 0xc8553a;
      for (const x of [-1, 1]) {
        for (const z of [-1, 1]) {
          const leg = part(new THREE.BoxGeometry(0.25, 12, 0.25), red, 0.04);
          leg.position.set(x * 0.9, 6, z * 0.9);
          tower.add(leg);
        }
      }
      for (let i = 1; i < 12; i++) {
        for (const [rx, ry] of [[0, 0], [0, Math.PI / 2]]) {
          const b = part(new THREE.BoxGeometry(2.0, 0.12, 0.12), red, 0.03);
          b.position.y = i;
          b.rotation.set(rx, ry, 0.5 * (i % 2 ? 1 : -1));
          b.position.z = ry ? 0 : 0.9;
          b.position.x = ry ? 0.9 : 0;
          tower.add(b);
        }
      }
      tower.arm = new THREE.Group();
      const armMesh = part(new THREE.BoxGeometry(2.6, 0.3, 0.6), red, 0.04);
      armMesh.position.x = 1.3;
      tower.arm.add(armMesh);
      tower.arm.position.set(0.9, 8.4, 0);
      tower.add(tower.arm);
      tower.position.set(-3.2, 0, 0);
      ground.add(tower);
    }
    const rocketA = buildRocket(false);
    rocketA.root.position.y = 1.2;
    const flameA = buildFlame();
    rocketA.root.add(flameA);
    ground.add(rocketA.root);
    // Skyer: papirutklipp som står i lufta (et skylag rundt 7–9 km).
    const cloudTexs = [3, 10, 17, 24, 31].map((seed) => {
      const c = document.createElement('canvas');
      c.width = 512;
      c.height = 300;
      const x = c.getContext('2d');
      x.translate(256, 280);
      SA.ART.cumulus(x, 440, 0, { seed, tone: 0 });
      return canvasTex(c);
    });
    const clouds = [];
    {
      const r = seeded(9);
      for (let i = 0; i < 46; i++) {
        const deck = i > 10;
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexs[i % 5], transparent: true, depthWrite: false, fog: true }));
        const s = deck ? 140 + r() * 160 : 70 + r() * 80;
        sp.scale.set(s, s * 0.58, 1);
        const a = r() * Math.PI * 2;
        const d = deck ? r() * 220 : 60 + r() * 300;
        sp.position.set(Math.cos(a) * d, deck ? 700 + r() * 220 : 180 + r() * 260, Math.sin(a) * d - 40);
        ground.add(sp);
        clouds.push(sp);
      }
    }
    // Røyk.
    const smokeMat = new THREE.SpriteMaterial({ map: puffTex('#f4f1ea'), transparent: true, depthWrite: false });
    const smoke = [];
    for (let i = 0; i < 160; i++) {
      const sp = new THREE.Sprite(smokeMat.clone());
      sp.visible = false;
      ground.add(sp);
      smoke.push({ sp, alive: false, age: 0, life: 1, vel: V(0, 0, 0), size: 1, grow: 1 });
    }
    let smokeNext = 0;
    function spawnSmoke(pos, vel, size, grow, life) {
      const p = smoke[smokeNext++ % smoke.length];
      p.alive = true;
      p.age = 0;
      p.life = life;
      p.vel.copy(vel);
      p.size = size;
      p.grow = grow;
      p.sp.position.copy(pos);
      p.sp.visible = true;
    }

    // =====================================================================
    // Scene 2: jorda og rommet (jordas radius = 5000 enheter)
    // =====================================================================
    const ER = 5000;
    const space = new THREE.Scene();
    space.background = new THREE.Color(0x000004);
    // Sola lyser opp siden av jorda vi ser, og Månen fra siden (halvmåne-lys).
    const sunDir = V(0.25, 0.6, 0.76).normalize();
    const sSun = new THREE.DirectionalLight(0xffffff, 3.2);
    sSun.position.copy(sunDir).multiplyScalar(100);
    space.add(sSun);
    space.add(new THREE.AmbientLight(0x4a5a7a, 0.12));
    const em = S.earthMaps(1024);
    const earthTex = canvasTex(em.map);
    const cloudTex = canvasTex(em.clouds);
    const earth = new THREE.Mesh(new THREE.SphereGeometry(ER, 96, 64), new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x334455, shininess: 22 }));
    space.add(earth);
    const earthClouds = new THREE.Mesh(new THREE.SphereGeometry(ER * 1.006, 96, 64), new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, depthWrite: false }));
    space.add(earthClouds);
    // Snu jorda så utskytningsstedet ligger ved kysten på nordlige breddegrader (ikke ved polen).
    earth.rotation.set(0.95, 0.4, 0);
    earthClouds.rotation.copy(earth.rotation);
    function atmosphere(radius, color, power, strength) {
      return new THREE.Mesh(
        new THREE.SphereGeometry(radius, 64, 48),
        new THREE.ShaderMaterial({
          uniforms: { color: { value: new THREE.Color(color) }, power: { value: power }, strength: { value: strength } },
          vertexShader: `#include <common>
#include <logdepthbuf_pars_vertex>
varying vec3 vN; varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
  #include <logdepthbuf_vertex>
}`,
          fragmentShader: `#include <common>
#include <logdepthbuf_pars_fragment>
uniform vec3 color; uniform float power; uniform float strength;
varying vec3 vN; varying vec3 vV;
void main() {
  #include <logdepthbuf_fragment>
  float f = pow(clamp(1.0 - abs(dot(vN, vV)), 0.0, 1.0), power) * strength;
  gl_FragColor = vec4(color * f, f);
}`,
          side: THREE.BackSide,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        }),
      );
    }
    space.add(atmosphere(ER * 1.016, 0x5aaaff, 3.2, 2.2));
    // Månen (halve den ekte avstanden, så den ikke blir helt borte).
    const MR = ER * 0.273;
    const moonPos = V(150000, 22000, -90000);
    const moonTex = canvasTex(S.moonMap(1024));
    const moon = new THREE.Mesh(new THREE.SphereGeometry(MR, 72, 48), new THREE.MeshPhongMaterial({ map: moonTex, bumpMap: moonTex, bumpScale: 3, shininess: 2 }));
    moon.position.copy(moonPos);
    space.add(moon);
    // Stjerner og sola.
    function stars(n, radius, size) {
      const r = seeded(31);
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = r() * 2 - 1;
        const a = r() * Math.PI * 2;
        const s = Math.sqrt(1 - u * u);
        pos.set([Math.cos(a) * s * radius, u * radius, Math.sin(a) * s * radius], i * 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size, sizeAttenuation: false, transparent: true, opacity: 0.9, depthWrite: false }));
    }
    const spaceStars = stars(5000, 600000, 1.6);
    space.add(spaceStars);
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    sun.scale.set(160000, 160000, 1);
    space.add(sun);
    const rocketB = buildRocket(false);
    const flameB = buildFlame();
    rocketB.root.add(flameB);
    space.add(rocketB.root);
    const stage1Fall = buildRocket(false).s1;
    stage1Fall.visible = false;
    space.add(stage1Fall);
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffe9b0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, sizeAttenuation: false }));
    marker.scale.set(0.05, 0.05, 1);
    space.add(marker);
    // Romstasjonen (enkel papirmodell).
    const iss = new THREE.Group();
    {
      const truss = part(new THREE.BoxGeometry(14, 0.5, 0.5), 0xb9b5ac, 0.05);
      iss.add(truss);
      for (const x of [-5.5, -3.5, 3.5, 5.5]) {
        for (const z of [-1, 1]) {
          const p = part(new THREE.BoxGeometry(1.6, 0.06, 4.2), 0x2e4a8a, 0.04);
          p.position.set(x, 0, z * 2.6);
          iss.add(p);
        }
      }
      for (const [x, l] of [[-1.5, 2.6], [1.2, 2.2], [0, 3.2]]) {
        const m = part(new THREE.CylinderGeometry(0.55, 0.55, l, 10), 0xece8de, 0.04);
        m.rotation.z = x === 0 ? 0 : Math.PI / 2;
        m.position.set(x, x === 0 ? 0 : 0.6, x === 0 ? 1.2 : 0);
        iss.add(m);
      }
      iss.visible = false;
      space.add(iss);
    }

    // =====================================================================
    // Scene 3: Månen (1 enhet = 1 m)
    // =====================================================================
    const moonScene = new THREE.Scene();
    moonScene.background = new THREE.Color(0x000002);
    const mSun = new THREE.DirectionalLight(0xffffff, 3.6);
    mSun.position.set(-80, 22, 30);
    moonScene.add(mSun);
    moonScene.add(new THREE.AmbientLight(0x6a7890, 0.08));
    const craters = [];
    {
      const r = seeded(77);
      for (let i = 0; i < 70; i++) craters.push([(r() - 0.5) * 700, (r() - 0.5) * 700, 3 + Math.pow(r(), 2) * 40, 0.3 + r() * 0.5]);
    }
    function heightAt(x, z) {
      let h = Math.sin(x * 0.013) * Math.cos(z * 0.011) * 2.2 + Math.sin(x * 0.041 + 1) * 0.5;
      const flat = clamp(Math.hypot(x, z - 4) / 30, 0, 1);
      for (const [cx, cz, cr, dp] of craters) {
        const d = Math.hypot(x - cx, z - cz) / cr;
        if (d < 1) h -= dp * cr * 0.25 * (1 - d * d) * flat;
        h += dp * cr * 0.09 * Math.exp(-Math.pow((d - 1) / 0.22, 2)) * flat;
      }
      return h * (0.25 + 0.75 * flat);
    }
    {
      const geo = new THREE.PlaneGeometry(800, 800, 180, 180);
      geo.rotateX(-Math.PI / 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, heightAt(p.getX(i), p.getZ(i)));
      geo.computeVertexNormals();
      const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xa9a69f, roughness: 1, metalness: 0, flatShading: true }));
      moonScene.add(surf);
    }
    moonScene.add(stars(3000, 600000, 1.5));
    const earthSmall = new THREE.Group();
    {
      const e = new THREE.Mesh(new THREE.SphereGeometry(30, 48, 32), new THREE.MeshPhongMaterial({ map: earthTex, specular: 0x334455, shininess: 22 }));
      const c2 = new THREE.Mesh(new THREE.SphereGeometry(30.2, 48, 32), new THREE.MeshPhongMaterial({ map: cloudTex, transparent: true, depthWrite: false }));
      earthSmall.add(e, c2, atmosphere(30.6, 0x5aaaff, 3.2, 2.2));
      earthSmall.rotation.y = 2.2;
      moonScene.add(earthSmall);
    }
    const lander = buildRocket(true);
    lander.s1.visible = false;
    lander.s2.position.y = -3.85;
    const flameC = buildFlame();
    flameC.position.y = 1.4;
    lander.root.add(flameC);
    moonScene.add(lander.root);
    // Myke støvskyer uten kant: på Månen sprer støvet seg lavt og flatt, uten luft som bremser det.
    const dustMat = new THREE.SpriteMaterial({ map: radialTex([[0, 'rgba(196,190,178,0.85)'], [0.45, 'rgba(180,174,162,0.45)'], [1, 'rgba(170,165,155,0)']], 64), transparent: true, depthWrite: false });
    const dust = [];
    for (let i = 0; i < 120; i++) {
      const sp = new THREE.Sprite(dustMat.clone());
      sp.visible = false;
      moonScene.add(sp);
      dust.push({ sp, alive: false, vel: V(0, 0, 0), age: 0, size: 1 });
    }
    let dustNext = 0;
    // Flagg og astronaut som papirutklipp.
    const flagCut = cutTex(220, [-0.1, -1.05, 0.65, 0.05], (c, L) => K.REG.flagg.draw(c, L, 0, {}));
    const flagSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: flagCut.tex, transparent: true }));
    flagSp.center.set(flagCut.cx, flagCut.cy);
    flagSp.scale.set(2.2 * (flagCut.w / flagCut.h), 2.2, 1);
    flagSp.visible = false;
    moonScene.add(flagSp);
    const astroDef = K.REG.astronaut;
    const astroFrames = {};
    const astroTex = (pose, f) => {
      const k = `${pose}${f}`;
      if (!astroFrames[k]) astroFrames[k] = cutTex(260, astroDef.box, (c, L) => astroDef.draw(c, L, (f / 12) / 1.2, { pose }));
      return astroFrames[k];
    };
    const astroSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: astroTex('stand', 0).tex, transparent: true }));
    astroSp.visible = false;
    moonScene.add(astroSp);
    const prints = [];
    const printMat = new THREE.MeshBasicMaterial({ color: 0x77746d });
    const printGeo = new THREE.CircleGeometry(0.16, 10);
    printGeo.rotateX(-Math.PI / 2);
    printGeo.scale(1.5, 1, 0.7);

    // =====================================================================
    // Kamera og bilder
    // =====================================================================
    let time = 0;
    let scene = ground;
    let current = 'ground';
    let phaseT = {};
    let downAng = 0;
    let orbitA = 0;
    let transferPath = null;
    const tmp = V(0, 0, 0);
    const look = V(0, 0, 0);
    const camPos = V(0, 0, 0);
    const camLook = V(0, 0, 0);
    let camInit = false;
    let stepDt = 1 / 60;
    let lastFollow = null;

    function cut(color) {
      flash.style.transition = 'none';
      flash.style.background = color;
      flash.style.opacity = '1';
      void flash.offsetWidth;
      flash.style.transition = 'opacity 0.9s ease';
      flash.style.opacity = '0';
    }
    function setScene(name) {
      if (name === current) return;
      current = name;
      scene = name === 'ground' ? ground : name === 'space' ? space : moonScene;
      camInit = false;
      lastFollow = null;
      cut(name === 'space' ? '#ffffff' : '#000000');
    }
    function onPhase(phase, st) {
      phaseT[phase] = time;
      if (phase === 'pad') {
        phaseT = { pad: time };
        smoke.forEach((p) => { p.alive = false; p.sp.visible = false; });
        dust.forEach((p) => { p.alive = false; p.sp.visible = false; });
        prints.forEach((m) => moonScene.remove(m));
        prints.length = 0;
        stage1Fall.visible = false;
        rocketB.s1.visible = true;
        orbitA = 0;
        transferPath = null;
        setScene('ground');
      }
      if (phase === 'transfer') transferPath = null;
      void st;
    }
    /** Glatt kamera: følger målet med litt treghet, så klippene ikke rykker. */
    /** carry: hvor mye det vi følger (raketten) har flyttet seg siden forrige bilde. */
    function moveCam(pos, target, k, shake, carry) {
      if (!camInit) {
        camPos.copy(pos);
        camLook.copy(target);
        camInit = true;
      } else {
        if (carry) {
          camPos.add(carry);
          camLook.add(carry);
        }
        // Like rask innhenting uansett bildefrekvens (k er per bilde ved 60 bilder/s).
        const kk = 1 - Math.pow(1 - k, stepDt * 60);
        camPos.lerp(pos, kk);
        camLook.lerp(target, kk);
      }
      camera.position.copy(camPos);
      if (shake) camera.position.add(V((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
      camera.lookAt(camLook);
    }

    // ---------- Oppskyting fra rampa ----------
    function frameGround(st, dt) {
      const alt = st.alt;
      const y = 1.2 + alt * 100;
      rocketA.root.position.y = y;
      flameA.set(st.thrust, 1, time);
      rocketA.s1.visible = true;
      const arm = st.phase === 'pad' ? 0 : st.phase === 'ignition' ? smooth(st.pt / 1.5) : 1;
      tower.arm.rotation.y = arm * 1.3;
      // Himmelen blir mørkere blå oppover.
      const sky = new THREE.Color(0xbfe0f4).lerp(new THREE.Color(0x3a64b4), smooth(alt / 9));
      ground.background = sky;
      ground.fog.color.copy(sky);
      // Røyk: store skyer ut til sidene på rampa, en hale etter raketten oppover.
      const rate = st.phase === 'pad' ? st.charge * 18 : st.thrust * (alt < 0.05 ? 70 : 35);
      for (let n = Math.floor(rate * dt + Math.random()); n > 0; n--) {
        if (alt < 0.05) {
          // Røyken veltes ut til sidene fra flammegrøfta, ikke mot kameraet.
          const side = Math.random() < 0.5 ? -1 : 1;
          const sp = 12 + Math.random() * 16;
          spawnSmoke(V(side * 2, 1.5, (Math.random() - 0.5) * 3), V(side * sp, 1 + Math.random() * 3, -Math.random() * 5), 3, 5, 3 + Math.random() * 2.5);
        } else {
          spawnSmoke(V((Math.random() - 0.5) * 1.5, y - 2, (Math.random() - 0.5) * 1.5), V((Math.random() - 0.5) * 4, -6, (Math.random() - 0.5) * 4), 3.5, 6, 2.5 + Math.random() * 2);
        }
      }
      for (const p of smoke) {
        if (!p.alive) continue;
        p.age += dt;
        if (p.age > p.life) {
          p.alive = false;
          p.sp.visible = false;
          continue;
        }
        p.vel.multiplyScalar(Math.pow(0.35, dt));
        p.sp.position.addScaledVector(p.vel, dt);
        const k = p.age / p.life;
        const s = (p.size + p.grow * p.age) * (k > 0.8 ? 1 - (k - 0.8) * 4 : 1);
        p.sp.scale.set(s, s, 1);
        // Røyken ligger oppå bakken, ikke halvveis ned i den.
        if (p.sp.position.y < s * 0.42) p.sp.position.y = s * 0.42;
        p.sp.material.color.setScalar(1 - k * 0.3);
      }
      // Kamera.
      const sh = st.shake * 0.35;
      if (st.phase === 'pad') {
        const a = time * 0.12;
        moveCam(V(Math.sin(a) * 34, 6 + Math.sin(time * 0.2) * 2, Math.cos(a) * 34), V(0, 6, 0), 0.08, sh);
      } else if (st.phase === 'ignition' || (st.phase === 'ascent' && st.pt < 2)) {
        moveCam(V(18, 3, 40), V(0, y + 6, 0), 0.12, sh);
      } else {
        const carry = lastFollow ? V(0, y - lastFollow.y, 0) : null;
        lastFollow = V(0, y, 0);
        moveCam(V(10, y - 16, 26), V(0, y + 8, 0), 0.15, sh * 0.6, carry);
      }
    }

    // ---------- Opp gjennom atmosfæren og i bane ----------
    const UP = V(0, 1, 0);
    function rocketFrame(a, h) {
      const rad = V(Math.sin(a), Math.cos(a), 0);
      const tan = V(Math.cos(a), -Math.sin(a), 0);
      return { pos: rad.clone().multiplyScalar(ER + h), rad, tan, z: V(0, 0, 1) };
    }
    function frameSpace(st, dt) {
      const alt = st.alt;
      const h = 6 + alt * 0.8; // litt kortere enn virkeligheten, så jorda fyller bildet
      if (st.phase === 'orbit' || st.phase === 'burn') orbitA += dt * 0.004;
      const downrange = smooth((alt - 9) / 391) * 0.035 + orbitA;
      const f = rocketFrame(downrange, h);
      // Raketten vipper over fra rett opp til vannrett i løpet av oppstigningen.
      const pitch = smooth((alt - 15) / 300) * (Math.PI / 2);
      const dir = f.rad.clone().multiplyScalar(Math.cos(pitch)).add(f.tan.clone().multiplyScalar(Math.sin(pitch))).normalize();
      let pos = f.pos;
      if (st.phase === 'transfer') {
        if (!transferPath) {
          const p0 = f.pos.clone();
          const p3 = moonPos.clone().add(p0.clone().sub(moonPos).normalize().multiplyScalar(MR + 900));
          transferPath = new THREE.CubicBezierCurve3(p0, p0.clone().add(f.tan.clone().multiplyScalar(40000)).add(f.rad.clone().multiplyScalar(15000)), p3.clone().add(V(-30000, 15000, 20000)), p3);
        }
        const u = smooth(st.prog);
        pos = transferPath.getPoint(u);
        dir.copy(transferPath.getTangent(Math.min(0.999, u)).normalize());
      }
      const carry = lastFollow ? pos.clone().sub(lastFollow) : null;
      lastFollow = pos.clone();
      rocketB.root.position.copy(pos);
      rocketB.root.quaternion.setFromUnitVectors(UP, dir);
      rocketB.s1.visible = st.stage === 'full';
      flameB.position.y = st.stage === 'full' ? 0 : 5.42;
      flameB.set(st.thrust, st.air, time);
      flameB.visible = st.thrust > 0.02;
      marker.position.copy(pos);
      marker.visible = st.phase === 'orbit' || st.phase === 'transfer';
      // Første trinn faller bakover og snurrer.
      const sepT = st.sepAt >= 0 ? st.t - st.sepAt : -1;
      if (sepT >= 0 && sepT < 8) {
        stage1Fall.visible = true;
        if (sepT < 0.05) {
          stage1Fall.position.copy(rocketB.root.position);
          stage1Fall.quaternion.copy(rocketB.root.quaternion);
        }
        stage1Fall.position.addScaledVector(dir, -dt * (3 + sepT * 4));
        stage1Fall.position.addScaledVector(f.rad, -dt * sepT * 2);
        stage1Fall.rotateX(dt * 0.6);
        stage1Fall.rotateZ(dt * 0.35);
      } else stage1Fall.visible = false;
      // Romstasjonen suser forbi ved 400 km.
      iss.visible = alt > 360 && st.phase === 'ascent';
      if (iss.visible) {
        const k = (alt - 360) / 40;
        iss.position.copy(f.pos).addScaledVector(f.tan, 160 - k * 300).addScaledVector(f.rad, 8).addScaledVector(f.z, -30);
        iss.quaternion.setFromUnitVectors(V(0, 1, 0), f.rad);
      }
      // Himmelen: blå i lufta, svart i rommet.
      const sky = new THREE.Color(0x3a64b4).lerp(new THREE.Color(0x000004), smooth((alt - 9) / 70));
      space.background = sky;
      spaceStars.material.opacity = 0.9 * smooth((alt - 25) / 50) + (st.phase !== 'ascent' ? 0.9 : 0);
      sun.position.copy(sunDir).multiplyScalar(500000);
      earthClouds.rotation.z += dt * 0.0015;
      // Kamera.
      if (st.phase === 'ascent') {
        const k = smooth((alt - 9) / 200);
        const off = f.rad.clone().multiplyScalar(lerp(-4, 30, k)).add(f.tan.clone().multiplyScalar(lerp(10, -70, k))).add(f.z.clone().multiplyScalar(lerp(26, 110, k)));
        moveCam(pos.clone().add(off), pos.clone().addScaledVector(f.rad, lerp(8, -20, k)).addScaledVector(f.tan, lerp(0, 60, k)), 0.12, st.shake * 0.3, carry);
      } else if (st.phase === 'orbit') {
        // Nær raketten mot soloppgangen over jordkanten, så ut til hele kloden.
        const k = smooth((st.pt - 1.5) / 7);
        const near = pos.clone().addScaledVector(f.tan, -45).addScaledVector(f.rad, 10).addScaledVector(f.z, 18);
        const nearLook = pos.clone().addScaledVector(f.tan, 400).addScaledVector(f.rad, -20);
        const far = f.rad.clone().multiplyScalar(ER * 1.6).addScaledVector(f.z, ER * 2.6).addScaledVector(f.tan, -ER * 0.8);
        const farLook = f.rad.clone().multiplyScalar(ER * 0.55);
        const lk = Math.pow(k, 2.2);
        moveCam(near.clone().lerp(far, lk), nearLook.clone().lerp(farLook, k), 0.2, 0, carry);
      } else if (st.phase === 'burn') {
        moveCam(pos.clone().addScaledVector(dir, -40).addScaledVector(f.rad, 12).addScaledVector(f.z, 16), pos.clone().addScaledVector(dir, 300), 0.06, st.shake * 0.2, carry);
      } else {
        const p = st.prog;
        const side = new THREE.Vector3().crossVectors(dir, UP).normalize();
        const chase = pos.clone().addScaledVector(dir, -60).addScaledVector(UP, 16);
        const backView = pos.clone().addScaledVector(dir, 70).addScaledVector(side, 30).addScaledVector(UP, 10);
        const toMoon = moonPos.clone();
        const toEarth = V(0, 0, 0);
        let cp;
        let cl;
        if (p < 0.15) {
          cp = chase;
          cl = pos.clone().addScaledVector(dir, 400);
        } else if (p < 0.42) {
          const k = smooth((p - 0.15) / 0.08) * (1 - smooth((p - 0.36) / 0.06));
          cp = chase.clone().lerp(backView, k);
          cl = pos.clone().addScaledVector(dir, 400).lerp(toEarth, k);
        } else {
          cp = chase;
          cl = pos.clone().addScaledVector(dir, 400).lerp(toMoon, smooth((p - 0.42) / 0.2));
        }
        moveCam(cp, cl, 0.07, 0, carry);
        camera.fov = lerp(camera.fov, st.ff ? 75 : 55, 0.08);
        camera.updateProjectionMatrix();
      }
    }

    // ---------- Månen ----------
    let earthRise = 0;
    function frameMoon(st, dt) {
      const land = st.phase === 'landing' ? st.land : 1;
      const lh = lerp(70, 0, 1 - Math.pow(1 - land, 2.2));
      const gy = heightAt(0, 0);
      lander.root.position.set(0, gy + lh + 0.1, 0);
      flameC.set(st.thrust, 0, time);
      // Støvet flyr i rette buer (ingen luft på Månen).
      if (st.phase === 'landing' && lh < 25 && st.thrust > 0.1) {
        for (let n = 0; n < 3; n++) {
          const p = dust[dustNext++ % dust.length];
          const a = Math.random() * Math.PI * 2;
          const sp = 18 + Math.random() * 30;
          p.alive = true;
          p.age = 0;
          p.vel.set(Math.cos(a) * sp, 0.8 + Math.random() * 2.4, Math.sin(a) * sp);
          p.sp.position.set(Math.cos(a) * 1.5, gy + 0.6, Math.sin(a) * 1.5);
          p.size = 1.6 + Math.random() * 1.8;
          p.sp.scale.setScalar(p.size);
          p.sp.material.opacity = 0.9;
          p.sp.visible = true;
        }
      }
      for (const p of dust) {
        if (!p.alive) continue;
        p.age += dt;
        p.vel.y -= 1.62 * dt;
        p.sp.position.addScaledVector(p.vel, dt);
        p.sp.scale.setScalar(p.size * (1 + p.age * 0.9));
        p.sp.material.opacity = 0.9 * (1 - p.age / 4);
        const g2 = heightAt(p.sp.position.x, p.sp.position.z);
        if (p.sp.position.y < g2 || p.age > 4) {
          p.alive = false;
          p.sp.visible = false;
        }
      }
      // Jorda stiger sakte opp over horisonten.
      const tl = phaseT.landing != null ? time - phaseT.landing : 0;
      earthRise = smooth(tl / 45);
      earthSmall.position.set(-60, lerp(-14, 95, earthRise), -420);
      earthSmall.rotation.y += dt * 0.01;
      // Astronauten, flagget og fotsporene.
      const a = st.astro;
      astroSp.visible = st.phase === 'moon';
      flagSp.visible = st.phase === 'moon';
      flagSp.position.set(-3.2, heightAt(-3.2, 3.5), 3.5);
      if (astroSp.visible) {
        const z = 5;
        const ay = heightAt(a.x, z) + a.y;
        const fr = a.pose === 'walk' ? Math.floor(st.t * 12) % 12 : 0;
        const tex = astroTex(a.pose, fr);
        if (astroSp.material.map !== tex.tex) {
          astroSp.material.map = tex.tex;
          astroSp.material.needsUpdate = true;
        }
        astroSp.center.set(tex.cx, tex.cy);
        const hgt = 2.1 * (tex.h / 260) / 1.13;
        astroSp.scale.set(hgt * (tex.w / tex.h) * a.dir, hgt, 1);
        astroSp.position.set(a.x, ay, z);
        while (prints.length < st.prints.length) {
          const pr = st.prints[prints.length];
          const m = new THREE.Mesh(printGeo, printMat);
          m.position.set(pr.x, heightAt(pr.x, z) + 0.03, z + 0.15);
          moonScene.add(m);
          prints.push(m);
        }
      }
      // Kamera.
      if (st.phase === 'landing') {
        moveCam(V(26, gy + 9 + lh * 0.4, 34), V(0, gy + lh * 0.75 + 3, 0), 0.1, st.shake * 0.25);
      } else if (st.phase === 'landed') {
        const ang = 0.65 + st.pt * 0.05;
        moveCam(V(Math.sin(ang) * 36, gy + 7, Math.cos(ang) * 36), V(-8, gy + 8, -30), 0.04, 0);
      } else {
        moveCam(V(a.x + 1.5, heightAt(a.x, 13) + 2.4 + a.y * 0.3, 13), V(a.x - 3, heightAt(a.x, 0) + 3.2, -40), 0.06, 0);
      }
    }

    // ---------- Hovedløkke ----------
    function frame(st, dt) {
      time += dt;
      stepDt = dt;
      const ph = st.phase;
      const want = ph === 'pad' || ph === 'ignition' || (ph === 'ascent' && st.alt < 9) ? 'ground' : ph === 'landing' || ph === 'landed' || ph === 'moon' ? 'moon' : 'space';
      setScene(want);
      if (current === 'ground') frameGround(st, dt);
      else if (current === 'space') frameSpace(st, dt);
      else frameMoon(st, dt);
      renderer.render(scene, camera);
    }

    function destroy() {
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
      flash.remove();
      grainDiv.remove();
    }

    return { frame, resize, destroy, onPhase, kind: '3d', get scene() { return current; }, debug: { camera, astroSp, flagSp, rocketA, THREE } };
  }

  window.PaizonSpace = Object.assign(window.PaizonSpace || {}, { create3D });
})();
