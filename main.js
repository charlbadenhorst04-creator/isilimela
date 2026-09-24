import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const clock = new THREE.Clock();
const isSmall = Math.min(innerWidth, innerHeight) < 700;
const COUNT = isSmall ? 60000 : 100000;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.1, 500);
camera.position.set(0, 26, 70);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 6;
controls.maxDistance = 60;
controls.enablePan = false;
controls.autoRotate = !reducedMotion;
controls.autoRotateSpeed = 0.35;

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.15, 0.7, 0.05);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------------------
// Shape generators — each returns Float32Array(COUNT * 3)
// ---------------------------------------------------------------------------
const rand = Math.random;
const gauss = () => { let u = 0, v = 0; while (!u) u = rand(); while (!v) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const onSphere = (out, i, r) => {
  const u = rand() * 2 - 1, t = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
  out[i] = s * Math.cos(t) * r; out[i + 1] = u * r; out[i + 2] = s * Math.sin(t) * r;
};

function galaxy() {
  const p = new Float32Array(COUNT * 3), arms = 4;
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3;
    if (n < COUNT * 0.12) { // bulge
      const r = Math.abs(gauss()) * 1.1;
      onSphere(p, i, r); p[i + 1] *= 0.6; continue;
    }
    const r = 0.8 + Math.pow(rand(), 1.4) * 10.5;
    const arm = (n % arms) / arms * Math.PI * 2;
    const a = arm + r * 0.55;
    const spread = 0.12 + r * 0.06;
    p[i] = Math.cos(a) * r + gauss() * spread * r * 0.35;
    p[i + 1] = gauss() * 0.18 * (1.2 - r / 12);
    p[i + 2] = Math.sin(a) * r + gauss() * spread * r * 0.35;
  }
  return p;
}

function ringedWorld() {
  const p = new Float32Array(COUNT * 3), tilt = 0.42;
  const ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3;
    if (n < COUNT * 0.5) {
      onSphere(p, i, 3.4 + rand() * 0.08);
      // latitude banding
      p[i + 1] += Math.sin(p[i + 1] * 5.0) * 0.06;
    } else {
      let r;
      do { r = 4.2 + rand() * 4.2; } while (r > 6.1 && r < 6.45); // Cassini division
      const a = rand() * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = gauss() * 0.03;
      p[i] = x; p[i + 1] = y * ct - z * st; p[i + 2] = y * st + z * ct;
    }
    const x = p[i], y = p[i + 1];
    p[i] = x * Math.cos(0.25) - y * Math.sin(0.25); p[i + 1] = x * Math.sin(0.25) + y * Math.cos(0.25);
  }
  return p;
}

function helix() {
  const p = new Float32Array(COUNT * 3), H = 16, R = 2.4, turns = 3.2;
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3, t = rand();
    const y = (t - 0.5) * H, a = t * turns * Math.PI * 2;
    const kind = rand();
    if (kind < 0.78) { // backbones
      const phase = n % 2 ? 0 : Math.PI * 0.8; // major/minor groove offset
      const j = 0.18;
      p[i] = Math.cos(a + phase) * R + gauss() * j;
      p[i + 1] = y + gauss() * j;
      p[i + 2] = Math.sin(a + phase) * R + gauss() * j;
    } else { // base-pair rungs, 10.5 per turn
      const step = 1 / (turns * 10.5);
      const tq = Math.round(t / step) * step;
      const aq = tq * turns * Math.PI * 2, yq = (tq - 0.5) * H;
      const s = rand();
      const x0 = Math.cos(aq) * R, z0 = Math.sin(aq) * R;
      const x1 = Math.cos(aq + Math.PI * 0.8) * R, z1 = Math.sin(aq + Math.PI * 0.8) * R;
      p[i] = x0 + (x1 - x0) * s + gauss() * 0.05;
      p[i + 1] = yq + gauss() * 0.05;
      p[i + 2] = z0 + (z1 - z0) * s + gauss() * 0.05;
    }
  }
  return p;
}

function trefoil() {
  const p = new Float32Array(COUNT * 3), P = 2, Q = 3, R = 5, r = 2, tube = 0.75;
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3, t = rand() * Math.PI * 2;
    const cq = Math.cos(Q * t);
    const x = (R + r * cq) * Math.cos(P * t) * 0.62;
    const y = (R + r * cq) * Math.sin(P * t) * 0.62;
    const z = r * Math.sin(Q * t) * 0.9;
    const rr = tube * Math.sqrt(rand());
    const u = rand() * 2 - 1, th = rand() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    p[i] = x + s * Math.cos(th) * rr; p[i + 1] = y + u * rr; p[i + 2] = z + s * Math.sin(th) * rr;
  }
  return p;
}

function heart() {
  const p = new Float32Array(COUNT * 3);
  let n = 0;
  while (n < COUNT) {
    const x = (rand() * 2 - 1) * 1.3, y = (rand() * 2 - 1) * 1.3, z = (rand() * 2 - 1) * 1.3;
    const a = x * x + 2.25 * y * y + z * z - 1;
    const f = a * a * a - x * x * z * z * z - 0.1125 * y * y * z * z * z;
    if (f > 0 || f < -0.02) continue; // keep a thin shell near the surface
    const i = n * 3, s = 4.6;
    p[i] = x * s; p[i + 1] = z * s; p[i + 2] = y * s;
    n++;
  }
  return p;
}

function eventHorizon() {
  const p = new Float32Array(COUNT * 3);
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3, k = rand();
    if (k < 0.66) { // accretion disk, denser near the ISCO
      const r = 2.3 + Math.pow(rand(), 2.2) * 8.5;
      const a = rand() * Math.PI * 2;
      p[i] = Math.cos(a) * r; p[i + 1] = gauss() * 0.05 * r * 0.4; p[i + 2] = Math.sin(a) * r;
    } else if (k < 0.86) { // lensed photon ring
      const a = rand() * Math.PI * 2, r = 2.0 + gauss() * 0.05;
      p[i] = Math.cos(a) * r; p[i + 1] = Math.sin(a) * r; p[i + 2] = gauss() * 0.08;
    } else { // relativistic jets
      const h = Math.pow(rand(), 0.7) * 11 * (rand() < 0.5 ? -1 : 1);
      const w = 0.1 + Math.abs(h) * 0.05;
      p[i] = gauss() * w; p[i + 1] = h; p[i + 2] = gauss() * w;
    }
  }
  return p;
}

function isilimela() {
  // The Pleiades (M45): bright sisters in degrees relative to Alcyone, wrapped in blue reflection nebulosity.
  const sisters = [[0, 0, 1.4], [-0.62, -0.05, 1.1], [-0.64, 0.14, 0.6], [0.66, 0.13, 1.1], [0.47, 0.44, 1.0],
                   [0.33, -0.37, 1.0], [0.62, 0.62, 0.8], [0.84, 0.36, 0.6], [0.95, -0.1, 0.5]];
  const p = new Float32Array(COUNT * 3), S = 7.5, total = sisters.reduce((a, s) => a + s[2], 0);
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3, k = rand();
    if (k < 0.42) { // tight, brilliant cores
      let pick = rand() * total, s = sisters[0];
      for (const c of sisters) { pick -= c[2]; if (pick <= 0) { s = c; break; } }
      const sp = 0.06 + 0.12 * Math.pow(rand(), 3) * s[2];
      p[i] = (s[0] - 0.2) * S + gauss() * sp; p[i + 1] = s[1] * S + gauss() * sp; p[i + 2] = gauss() * sp;
    } else if (k < 0.62) { // diffraction spikes on the sisters
      const s = sisters[Math.floor(rand() * sisters.length)];
      const len = Math.pow(rand(), 3) * 1.6 * s[2], axis = rand() < 0.5;
      const sign = rand() < 0.5 ? -1 : 1;
      p[i] = (s[0] - 0.2) * S + (axis ? len * sign : gauss() * 0.02);
      p[i + 1] = s[1] * S + (axis ? gauss() * 0.02 : len * sign);
      p[i + 2] = gauss() * 0.05;
    } else { // reflection nebula, streaky like the Merope nebula
      const a = gauss() * 2.6, b = gauss() * 1.4;
      p[i] = a * 0.9 + b * 0.4 + 1.2; p[i + 1] = -a * 0.4 + b * 0.9 + 1.2; p[i + 2] = gauss() * 1.2;
    }
  }
  return p;
}

async function wordShape(text) {
  const c = document.createElement('canvas');
  c.width = 1400; c.height = 360;
  const g = c.getContext('2d');
  try { await document.fonts.load('700 200px Syncopate'); } catch (_) {}
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = 220;
  do { g.font = `700 ${size}px Syncopate, "Arial Black", sans-serif`; size -= 10; }
  while (g.measureText(text).width > c.width - 60 && size > 40);
  g.fillText(text, c.width / 2, c.height / 2);
  const data = g.getImageData(0, 0, c.width, c.height).data;
  const px = [];
  let minX = Infinity, maxX = -Infinity;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) {
    if (data[(y * c.width + x) * 4 + 3] > 128) { px.push(x, y); if (x < minX) minX = x; if (x > maxX) maxX = x; }
  }
  const p = new Float32Array(COUNT * 3);
  if (!px.length) return galaxy();
  const scale = Math.min(19 / Math.max(1, maxX - minX), 0.06);
  const cx = (minX + maxX) / 2;
  for (let n = 0; n < COUNT; n++) {
    const j = (Math.floor(rand() * px.length / 2)) * 2, i = n * 3;
    p[i] = (px[j] - cx + rand() * 2) * scale;
    p[i + 1] = -(px[j + 1] - c.height / 2 + rand() * 2) * scale;
    p[i + 2] = gauss() * 0.25;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------
const FORMS = [
  { key: 'isilimela', label: 'isilimela', name: 'Isilimela', cat: 'M45 · the Pleiades, digging stars of the planting season', make: isilimela, swirl: 0, colors: ['#6f9bff', '#a9c4ff', '#ffffff'] },
  { key: 'galaxy', label: 'umthala', name: 'Umthala', cat: 'isiZulu for the Milky Way · barred spiral, 100 billion suns', make: galaxy, swirl: 0.35, colors: ['#4f6bff', '#b86bff', '#ffd9a8'] },
  { key: 'world', label: 'ringed world', name: 'Ringed World', cat: 'Saturn analogue · Cassini division at 1.9 R', make: ringedWorld, swirl: 0, colors: ['#ffae5c', '#ff6b8b', '#fff0d6'] },
  { key: 'helix', label: 'helix', name: 'Double Helix', cat: 'B-DNA · 10.5 base pairs per turn', make: helix, swirl: 0, colors: ['#2fe0c3', '#3f6dff', '#e6fffa'] },
  { key: 'knot', label: 'trefoil', name: 'Trefoil Knot', cat: 'torus knot (p, q) = (2, 3)', make: trefoil, swirl: 0, colors: ['#ff5fa2', '#6d5cff', '#ffe6f2'] },
  { key: 'heart', label: 'heart', name: 'Taubin Heart', cat: '(x²+9⁄4y²+z²−1)³ = x²z³ + 9⁄80y²z³', make: heart, swirl: 0, colors: ['#ff3d64', '#ff9166', '#fff0f3'] },
  { key: 'hole', label: 'event horizon', name: 'Event Horizon', cat: 'Kerr black hole · disk, photon ring, jets', make: eventHorizon, swirl: 1.1, colors: ['#ff7a2e', '#ff3d7f', '#fff3dc'] },
];
const WORD_COLORS = ['#8fa8ff', '#ff9ad1', '#ffffff'];

// ---------------------------------------------------------------------------
// Particle system
// ---------------------------------------------------------------------------
const geo = new THREE.BufferGeometry();
const aFrom = new Float32Array(COUNT * 3);
const aTo = new Float32Array(COUNT * 3);
const aRand = new Float32Array(COUNT);
const aDir = new Float32Array(COUNT * 3);
for (let n = 0; n < COUNT; n++) {
  aRand[n] = rand();
  onSphere(aDir, n * 3, 1);
  onSphere(aFrom, n * 3, 45 + rand() * 40); // the intro: stars fall in from far away
}
geo.setAttribute('position', new THREE.BufferAttribute(aTo, 3));
geo.setAttribute('aFrom', new THREE.BufferAttribute(aFrom, 3));
geo.setAttribute('aTo', new THREE.BufferAttribute(aTo, 3));
geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 1));
geo.setAttribute('aDir', new THREE.BufferAttribute(aDir, 3));

const uniforms = {
  uTime: { value: 0 }, uMix: { value: 0 },
  uSize: { value: isSmall ? 34 : 42 }, uPR: { value: renderer.getPixelRatio() },
  uIntensity: { value: 0.62 },
  uSwirlFrom: { value: 0 }, uSwirlTo: { value: 0 },
  uMouse: { value: new THREE.Vector3(999, 999, 999) },
  uShockPos: { value: new THREE.Vector3() }, uShockTime: { value: -100 },
  uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
};

const starMat = new THREE.ShaderMaterial({
  uniforms,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  vertexShader: /* glsl */`
    uniform float uTime, uMix, uSize, uPR, uShockTime, uSwirlFrom, uSwirlTo, uIntensity;
    uniform vec3 uMouse, uShockPos, uC1, uC2, uC3;
    attribute vec3 aFrom, aTo, aDir;
    attribute float aRand;
    varying vec3 vColor;
    varying float vAlpha;

    vec3 swirl(vec3 p, float ph) {
      float a = ph / (1.0 + length(p.xz) * 0.35);
      float c = cos(a), s = sin(a);
      return vec3(c * p.x - s * p.z, p.y, s * p.x + c * p.z);
    }

    void main() {
      float m = clamp(uMix * 1.6 - aRand * 0.6, 0.0, 1.0);
      m = m * m * (3.0 - 2.0 * m);
      vec3 b = swirl(aTo, uSwirlTo);
      vec3 p = mix(swirl(aFrom, uSwirlFrom), b, m);
      p += aDir * sin(m * 3.14159) * (1.5 + aRand * 4.0);        // arc through space while morphing
      p += aDir * sin(uTime * 0.9 + aRand * 40.0) * 0.035;         // breathing

      vec4 w = modelMatrix * vec4(p, 1.0);

      vec3 dm = w.xyz - uMouse;
      float pull = pow(smoothstep(3.2, 0.0, length(dm)), 2.0);
      w.xyz += normalize(dm + 1e-4) * pull * 1.6;                   // cursor parts the stars

      float st = uTime - uShockTime;
      vec3 ds = w.xyz - uShockPos;
      float band = exp(-pow(length(ds) - st * 9.0, 2.0) * 0.6) * exp(-st * 0.8) * step(0.0, st);
      w.xyz += normalize(ds + 1e-4) * band * 1.4;                    // shockwave ring

      vec4 mv = viewMatrix * w;
      gl_Position = projectionMatrix * mv;
      float big = step(0.985, aRand) * 2.5;
      gl_PointSize = uSize * uPR * (0.35 + aRand * 0.8 + big) * (1.0 + band * 1.5) / -mv.z;

      vec3 base = mix(uC1, uC2, fract(aRand * 7.13));
      vColor = mix(uC3, base, smoothstep(0.4, 5.5, length(b)));
      vColor += band * vec3(0.7, 0.8, 1.0) + pull * 0.6;
      vColor *= uIntensity;
      vAlpha = 0.65 + 0.35 * sin(uTime * 2.2 + aRand * 120.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vColor;
    varying float vAlpha;
    void main() {
      float d = length(gl_PointCoord - 0.5);
      if (d > 0.5) discard;
      float a = pow(1.0 - d * 2.0, 2.2);
      gl_FragColor = vec4(vColor, a * vAlpha);
    }`,
});
const stars = new THREE.Points(geo, starMat);
stars.frustumCulled = false;
scene.add(stars);

// ---------------------------------------------------------------------------
// Backdrop: nebula dome + distant star field
// ---------------------------------------------------------------------------
const nebula = new THREE.Mesh(
  new THREE.SphereGeometry(200, 48, 32),
  new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false,
    uniforms: { uTime: uniforms.uTime, uC1: uniforms.uC1, uC2: uniforms.uC2 },
    vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec3 uC1, uC2; varying vec3 vDir;
      float h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
      float n(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
        return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x), mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x), f.y),
                   mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x), mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x), f.y), f.z); }
      float fbm(vec3 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * n(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec3 p = vDir * 2.2 + vec3(0.0, 0.0, uTime * 0.01);
        float q = fbm(p + fbm(p * 1.7));
        float band = smoothstep(0.55, 0.0, abs(vDir.y + 0.15 * sin(vDir.x * 3.0)));
        vec3 col = mix(uC1, uC2, q) * pow(q, 3.0) * (0.08 + band * 0.12);
        gl_FragColor = vec4(col, 1.0);
      }`,
  }),
);
scene.add(nebula);

const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(5000 * 3);
for (let n = 0; n < 5000; n++) onSphere(dustPos, n * 3, 90 + rand() * 90);
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.22, color: 0xc9d2ff, transparent: true, opacity: 0.6, depthWrite: false }));
scene.add(dust);

// ---------------------------------------------------------------------------
// Morphing
// ---------------------------------------------------------------------------
const state = { current: -1, word: '', tweenStart: 0, tweenDur: 3.6, fromSwirl: 0, toSwirl: 0, phaseFrom: 0, phaseTo: 0 };
const palette = { c1: new THREE.Color(), c2: new THREE.Color(), c3: new THREE.Color(), hue: 0, src: FORMS[0].colors };
const cache = new Map();

function swirlXZ(arr, i, phase) {
  if (!phase) return;
  const x = arr[i], z = arr[i + 2];
  const a = phase / (1 + Math.hypot(x, z) * 0.35), c = Math.cos(a), s = Math.sin(a);
  arr[i] = c * x - s * z; arr[i + 2] = s * x + c * z;
}

// Freeze the particles where they are right now so a new morph starts seamlessly.
function bakeCurrent(t) {
  const mix = Math.min(1, (t - state.tweenStart) / state.tweenDur);
  const a = [0, 0, 0], b = [0, 0, 0];
  for (let n = 0; n < COUNT; n++) {
    const i = n * 3;
    let m = Math.min(1, Math.max(0, mix * 1.6 - aRand[n] * 0.6)); m = m * m * (3 - 2 * m);
    a[0] = aFrom[i]; a[1] = aFrom[i + 1]; a[2] = aFrom[i + 2]; swirlXZ(a, 0, state.phaseFrom);
    b[0] = aTo[i]; b[1] = aTo[i + 1]; b[2] = aTo[i + 2]; swirlXZ(b, 0, state.phaseTo);
    const arc = Math.sin(m * Math.PI) * (1.5 + aRand[n] * 4);
    aFrom[i] = a[0] + (b[0] - a[0]) * m + aDir[i] * arc;
    aFrom[i + 1] = a[1] + (b[1] - a[1]) * m + aDir[i + 1] * arc;
    aFrom[i + 2] = a[2] + (b[2] - a[2]) * m + aDir[i + 2] * arc;
  }
}

async function weave(index, word) {
  const t = clock.getElapsedTime();
  let target, meta;
  if (index === 'word') {
    target = await wordShape(word);
    meta = { name: `“${word}”`, cat: `catalogue entry · ${word.length} glyphs, ${COUNT.toLocaleString()} stars`, swirl: 0, colors: WORD_COLORS };
  } else {
    if (!cache.has(index)) cache.set(index, FORMS[index].make());
    target = cache.get(index);
    meta = FORMS[index];
  }
  bakeCurrent(t);
  aTo.set(target);
  geo.attributes.aFrom.needsUpdate = true;
  geo.attributes.aTo.needsUpdate = true;
  state.phaseFrom = 0; state.phaseTo = 0;
  state.toSwirl = meta.swirl;
  state.tweenStart = t;
  state.tweenDur = state.current === -1 ? 4.2 : 2.8;
  state.current = index;
  palette.src = meta.colors;
  setPlate(meta.name, meta.cat);
  document.querySelectorAll('#forms button').forEach((b, i) => b.setAttribute('aria-current', String(i === index)));
}

// ---------------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------------
const formsEl = document.getElementById('forms');
FORMS.forEach((f, i) => {
  const b = document.createElement('button');
  b.type = 'button';
  b.innerHTML = `<span class="k">${i + 1}</span>${f.label}`;
  b.addEventListener('click', () => { setTour(false); weave(i); });
  formsEl.appendChild(b);
});

const plate = document.querySelector('.plate');
function setPlate(name, cat) {
  plate.classList.add('swap');
  setTimeout(() => {
    document.getElementById('plateName').textContent = name;
    document.getElementById('plateCat').textContent = cat;
    plate.classList.remove('swap');
  }, 350);
}
document.getElementById('count').textContent = COUNT.toLocaleString();

document.getElementById('writeForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const word = document.getElementById('writeInput').value.trim().toUpperCase();
  if (!word) return;
  setTour(false);
  weave('word', word);
});

let tourOn = !reducedMotion, tourNext = 9;
const tourBtn = document.getElementById('tourBtn');
function setTour(on) {
  tourOn = on;
  tourBtn.setAttribute('aria-pressed', String(on));
  tourBtn.textContent = on ? 'tour on' : 'tour off';
  tourNext = clock.getElapsedTime() + 8;
}
tourBtn.addEventListener('click', () => setTour(!tourOn));
setTour(tourOn);

document.getElementById('paletteBtn').addEventListener('click', () => { palette.hue = (palette.hue + 0.17) % 1; });

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  const k = parseInt(e.key, 10);
  if (k >= 1 && k <= FORMS.length) { setTour(false); weave(k - 1); }
  if (e.code === 'Space') { e.preventDefault(); shock(new THREE.Vector3()); }
});

// ---------------------------------------------------------------------------
// Pointer: repel + shockwave
// ---------------------------------------------------------------------------
const ndc = new THREE.Vector2(), ray = new THREE.Raycaster(), plane = new THREE.Plane();
const hit = new THREE.Vector3(), camDir = new THREE.Vector3();
let pointerActive = false, downAt = null;

function pointerWorld(e) {
  ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  camera.getWorldDirection(camDir);
  plane.setFromNormalAndCoplanarPoint(camDir, controls.target);
  ray.setFromCamera(ndc, camera);
  return ray.ray.intersectPlane(plane, hit);
}
canvas.addEventListener('pointermove', (e) => { pointerActive = e.pointerType === 'mouse'; if (pointerWorld(e) && pointerActive) uniforms.uMouse.value.copy(hit); });
canvas.addEventListener('pointerleave', () => { pointerActive = false; uniforms.uMouse.value.set(999, 999, 999); });
canvas.addEventListener('pointerdown', (e) => { downAt = [e.clientX, e.clientY]; });
canvas.addEventListener('pointerup', (e) => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  if (pointerWorld(e)) shock(hit.clone());
});
function shock(pos) {
  uniforms.uShockPos.value.copy(pos);
  uniforms.uShockTime.value = clock.getElapsedTime();
  bloom.strength = 2.2;
}

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth, innerHeight);
});

// ---------------------------------------------------------------------------
// Loop
// ---------------------------------------------------------------------------
const tmp = new THREE.Color();
let last = 0, frames = 0, fpsT = 0;
const camStart = camera.position.clone(), camEnd = new THREE.Vector3(0, 7, isSmall ? 30 : 21);

function tick() {
  const t = clock.getElapsedTime(), dt = Math.min(0.05, t - last); last = t;
  uniforms.uTime.value = t;
  uniforms.uMix.value = Math.min(1, (t - state.tweenStart) / state.tweenDur);

  // differential rotation for galaxies and accretion disks
  state.phaseTo += dt * state.toSwirl;
  uniforms.uSwirlFrom.value = state.phaseFrom;
  uniforms.uSwirlTo.value = state.phaseTo;

  // glide the palette toward the current form's colours
  const k = 1 - Math.exp(-dt * 2.5);
  ['c1', 'c2', 'c3'].forEach((c, i) => {
    tmp.set(palette.src[i]).offsetHSL(palette.hue, 0, 0);
    uniforms['u' + c.toUpperCase()].value.lerp(tmp, k);
  });

  // opening dolly
  if (t < 5) {
    const e = 1 - Math.pow(1 - Math.min(1, t / 5), 3);
    camera.position.lerpVectors(camStart, camEnd, e);
  }

  bloom.strength += (1.15 - bloom.strength) * (1 - Math.exp(-dt * 2));
  if (!pointerActive) uniforms.uMouse.value.set(999, 999, 999);

  if (tourOn && t > tourNext) {
    tourNext = t + 8;
    weave(((typeof state.current === 'number' ? state.current : -1) + 1) % FORMS.length);
  }

  dust.rotation.y = t * 0.004;
  controls.update();
  composer.render();

  frames++;
  if (t - fpsT > 0.5) { document.getElementById('fps').textContent = Math.round(frames / (t - fpsT)); frames = 0; fpsT = t; }
  requestAnimationFrame(tick);
}

weave(0);
tick();
requestAnimationFrame(() => setTimeout(() => document.getElementById('veil').classList.add('gone'), 300));
