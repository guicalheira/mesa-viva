// ===== Sinuca 3D (Three.js): ambientes, mesa, bolas, taco, mira, câmeras (3ª e 1ª pessoa), coisas jogadas na mesa e sons =====
// Unidades: 1 = 10 cm (a física do Sinuca é em metros; aqui tudo é multiplicado por S).
// A jogada chega do anfitrião em st.shot ({ from, ang, power } ou, no modo gastação, { init } de algo que caiu na mesa):
// esta tela roda a mesma física (determinística) para animar e, no fim, encaixa as bolas nas posições que o anfitrião mandou.
const Sinuca3D = (() => {
  const S = 10, K = Sinuca, W = K.W * S, H = K.H * S, R = K.R * S, FY = -8; // chão
  let T, renderer, scene, camera, ray, ptr, tplane, wrap, canvas, raf = 0, mounted = false, active = false, lastT = 0, H_ = {};
  const cam = { az: 0, el: 1.0, zoom: 1, tx: 0, tz: 0, caz: 0, cel: 1.0, czoom: 1, ctx: 0, ctz: 0, baseDist: 40, moved: false, fp: false, yawOff: 0, el1: .55, waz: 0, wel: .5, eye: null, look: null, locked: false, watchT: 0, fx: 0, fz: 0, fd: 0 };
  let edge = 0, balls = {}, ballGeo, cueG, cueParts = null, handG = null, guide, ghost, ghostCue, lampL, mixers = [], aim = { ang: Math.PI, power: .5 }, opt = {}, sim = null, acc = 0, seenShot = -1, seenToss = -1, charging = null, drag = null, cloth = '', arena = '', tableG = null, envG = null, strike = null, placeAt = null, hoverT = 0, flyers = [], remains = [], amb = null, tossMode = null, fans = [], flick = [], people = [], rdrag = null, shadowTex = null;
  const C = h => new T.Color(h);
  const BALL_COL = ['#f6f3ea', '#f2c21a', '#1f4fd1', '#d8261f', '#6a2a9c', '#f07a1a', '#1f8a3c', '#7a1f2b', '#141414'];
  const CLOTH = { verde: '#1f8a3e', azul: '#1b5d8c', vinho: '#7a2033' };
  const rand = (a, b) => a + Math.random() * (b - a);
  const SEATS = [[0, H / 2 + 11], [W / 2 + 11, 0], [0, -H / 2 - 11], [-W / 2 - 11, 0]]; // onde cada lugar fica em pé (1ª pessoa fora da vez e de onde se joga coisa)

  // ---------- texturas em canvas ----------
  function canvasTex(w, h, draw, rep) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t;
  }
  const noiseFill = (x, w, h, n, a = .06, b = .08) => { for (let i = 0; i < n; i++) { x.fillStyle = i % 2 ? `rgba(255,255,255,${a})` : `rgba(0,0,0,${b})`; x.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5); } };
  const ballTex = n => canvasTex(256, 128, (x, w, h) => {
    const col = BALL_COL[n > 8 ? n - 8 : n], stripe = n > 8;
    x.fillStyle = stripe ? '#f6f3ea' : col; x.fillRect(0, 0, w, h);
    if (stripe) { x.fillStyle = col; x.fillRect(0, h * .3, w, h * .4); }
    if (n) for (const u of [.25, .75]) { x.fillStyle = '#f6f3ea'; x.beginPath(); x.ellipse(w * u, h / 2, 22, 22, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = '#141414'; x.font = '900 24px Nunito, Arial'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(n, w * u, h / 2 + 1); }
    x.globalAlpha = .07; for (let i = 0; i < 50; i++) { x.fillStyle = '#fff'; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); } x.globalAlpha = 1;
  });
  const feltTex = (hex, rep) => canvasTex(1024, 512, (x, w, h) => {
    x.fillStyle = hex; x.fillRect(0, 0, w, h); noiseFill(x, w, h, 30000, .05, .07);
    x.strokeStyle = 'rgba(255,255,255,.13)'; x.lineWidth = 2; x.beginPath(); x.moveTo(w * .25, 0); x.lineTo(w * .25, h); x.stroke();
    x.fillStyle = 'rgba(255,255,255,.22)'; x.beginPath(); x.arc(w * .75, h / 2, 4, 0, 7); x.fill();
  }, rep);
  const woodTex = (base, dark, n = 40) => canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = base; x.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) { x.strokeStyle = dark; x.globalAlpha = rand(.08, .3); x.lineWidth = rand(1, 5); const y = rand(-20, h + 20); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + rand(-12, 12), w * .7, y + rand(-12, 12), w, y + rand(-8, 8)); x.stroke(); }
    x.globalAlpha = 1; noiseFill(x, w, h, 6000, .04, .06);
  }, [1, 1]);
  const plankTex = (cols = ['#4b3220', '#553a25', '#45301e', '#5a3f2a']) => canvasTex(512, 512, (x, w, h) => {
    for (let r = 0; r < 4; r++) { x.fillStyle = cols[r]; x.fillRect(0, r * h / 4, w, h / 4); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 3; x.strokeRect(0, r * h / 4, w, h / 4);
      for (let i = 0; i < 30; i++) { x.strokeStyle = 'rgba(20,10,5,.25)'; x.lineWidth = rand(1, 3); const y = r * h / 4 + rand(4, h / 4 - 4); x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(w * .3, y + rand(-6, 6), w * .7, y + rand(-6, 6), w, y + rand(-4, 4)); x.stroke(); } }
  }, [6, 6]);
  const brickTex = (base = '#8a4a34', mortar = '#b9a898') => canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = mortar; x.fillRect(0, 0, w, h); const bw = 64, bh = 30;
    for (let r = 0; r < h / bh; r++) for (let c = -1; c < w / bw + 1; c++) { x.fillStyle = `hsl(${rand(8, 18)} ${rand(40, 55)}% ${rand(28, 40)}%)`; x.fillRect(c * bw + (r % 2 ? bw / 2 : 0) + 2, r * bh + 2, bw - 4, bh - 4); }
    noiseFill(x, w, h, 5000, .05, .1);
  }, [5, 3]);
  const concreteTex = () => canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#6e6a63'; x.fillRect(0, 0, w, h); noiseFill(x, w, h, 20000, .05, .09); x.strokeStyle = 'rgba(0,0,0,.25)'; x.lineWidth = 2; for (let i = 0; i < 8; i++) { x.beginPath(); let px = rand(0, w), py = rand(0, h); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += rand(-40, 40); py += rand(-40, 40); x.lineTo(px, py); } x.stroke(); } x.strokeStyle = 'rgba(0,0,0,.35)'; x.lineWidth = 3; x.strokeRect(0, 0, w, h); }, [8, 8]);
  const grassTex = () => canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#2f5a22'; x.fillRect(0, 0, w, h); for (let i = 0; i < 9000; i++) { x.strokeStyle = `hsl(${rand(85, 120)} ${rand(35, 55)}% ${rand(22, 40)}%)`; x.lineWidth = 1.5; const px = rand(0, w), py = rand(0, h); x.beginPath(); x.moveTo(px, py); x.lineTo(px + rand(-3, 3), py - rand(4, 10)); x.stroke(); } }, [10, 10]);
  const marbleTex = () => canvasTex(512, 512, (x, w, h) => { x.fillStyle = '#15141a'; x.fillRect(0, 0, w, h); for (let i = 0; i < 14; i++) { x.strokeStyle = `rgba(200,195,210,${rand(.08, .3)})`; x.lineWidth = rand(.6, 2.5); x.beginPath(); let px = rand(0, w), py = rand(0, h); x.moveTo(px, py); for (let k = 0; k < 10; k++) { px += rand(-60, 60); py += rand(-60, 60); x.lineTo(px, py); } x.stroke(); } noiseFill(x, w, h, 3000, .03, .05); x.strokeStyle = 'rgba(255,255,255,.08)'; x.lineWidth = 2; x.strokeRect(0, 0, w, h); }, [6, 6]);
  const tileTex = () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#8a3a22'; x.fillRect(0, 0, w, h); x.fillStyle = 'rgba(0,0,0,.35)'; for (let r = 0; r < 4; r++) x.fillRect(0, r * 64 + 56, w, 8); noiseFill(x, w, h, 2000, .05, .08); }, [12, 4]);
  const neonTex = (txt, col, font = '900 96px "Lilita One", Impact, sans-serif') => canvasTex(512, 160, (x, w, h) => {
    x.clearRect(0, 0, w, h); x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.shadowColor = col; x.shadowBlur = 30; x.strokeStyle = col; x.lineWidth = 6; x.strokeText(txt, w / 2, h / 2 + 4);
    x.shadowBlur = 0; x.fillStyle = '#fff'; x.fillText(txt, w / 2, h / 2 + 4);
  });
  const signTex = (lines, bg, fg) => canvasTex(512, 320, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h); x.strokeStyle = fg; x.lineWidth = 12; x.strokeRect(8, 8, w - 16, h - 16); x.fillStyle = fg; x.textAlign = 'center';
    lines.forEach(([t, sz, y]) => { x.font = `700 ${sz}px Nunito, Arial`; x.fillText(t, w / 2, y); });
  });
  const skylineTex = () => canvasTex(1024, 512, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0a0f24'); g.addColorStop(1, '#2a2040'); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { x.fillStyle = '#fff'; x.globalAlpha = rand(.3, 1); x.fillRect(rand(0, w), rand(0, h * .5), 1.5, 1.5); } x.globalAlpha = 1;
    for (let bx = 0; bx < w;) { const bw = rand(30, 90), bh = rand(120, 380); x.fillStyle = '#090a12'; x.fillRect(bx, h - bh, bw, bh); for (let yy = h - bh + 8; yy < h - 8; yy += 14) for (let xx = bx + 6; xx < bx + bw - 8; xx += 12) if (Math.random() < .45) { x.fillStyle = Math.random() < .2 ? '#ffd27a' : '#cfe0ff'; x.fillRect(xx, yy, 6, 8); } bx += bw + rand(4, 14); }
  });

  // ---------- peças ----------
  const std = (col, o = {}) => new T.MeshStandardMaterial({ color: C(col), roughness: .8, ...o });
  const glow = (col, i = 1.5, o = {}) => new T.MeshStandardMaterial({ color: C(col), emissive: C(col), emissiveIntensity: i, ...o });
  const box = (w, h, d, m, x, y, z, parent, ry = 0) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.rotation.y = ry; o.castShadow = o.receiveShadow = true; (parent || envG || scene).add(o); return o; };
  const cyl = (rt, rb, h, m, x, y, z, parent, seg = 16) => { const o = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; (parent || envG || scene).add(o); return o; };
  const sph = (r, m, x, y, z, parent, seg = 12) => { const o = new T.Mesh(new T.SphereGeometry(r, seg, Math.ceil(seg * .7)), m); o.position.set(x, y, z); o.castShadow = true; (parent || envG || scene).add(o); return o; };
  const plane = (w, h, m, x, y, z, rx = 0, ry = 0, parent) => { const o = new T.Mesh(new T.PlaneGeometry(w, h), m); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.receiveShadow = true; (parent || envG || scene).add(o); return o; };
  const light = (col, i, dist, x, y, z, parent, decay = 2) => { const l = new T.PointLight(col, i, dist, decay); l.position.set(x, y, z); (parent || envG || scene).add(l); return l; };
  function roundRect(w, h, r) { const s = new T.Shape(); s.moveTo(-w / 2 + r, -h / 2); s.lineTo(w / 2 - r, -h / 2); s.absarc(w / 2 - r, -h / 2 + r, r, -Math.PI / 2, 0, false); s.lineTo(w / 2, h / 2 - r); s.absarc(w / 2 - r, h / 2 - r, r, 0, Math.PI / 2, false); s.lineTo(-w / 2 + r, h / 2); s.absarc(-w / 2 + r, h / 2 - r, r, Math.PI / 2, Math.PI, false); s.lineTo(-w / 2, -h / 2 + r); s.absarc(-w / 2 + r, -h / 2 + r, r, Math.PI, Math.PI * 1.5, false); return s; }
  function dispose(root) { root.traverse(o => { o.geometry?.dispose(); for (const m of [].concat(o.material || [])) { m.map?.dispose(); m.dispose(); } }); }
  const stars = (n = 900, r = 120) => { const g = new T.BufferGeometry(), p = new Float32Array(n * 3); for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), e = rand(.05, 1.4); p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r + FY; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r; } g.setAttribute('position', new T.BufferAttribute(p, 3)); const m = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: .35, sizeAttenuation: true, fog: false })); envG.add(m); return m; };
  function skyDome(top, bottom) { const g = new T.SphereGeometry(140, 24, 12), c = new Float32Array(g.attributes.position.count * 3), t = C(top), b = C(bottom); for (let i = 0; i < c.length / 3; i++) { const y = g.attributes.position.getY(i) / 140, k = Math.max(0, Math.min(1, (y + .1) / .9)); c[i * 3] = b.r + (t.r - b.r) * k; c[i * 3 + 1] = b.g + (t.g - b.g) * k; c[i * 3 + 2] = b.b + (t.b - b.b) * k; } g.setAttribute('color', new T.BufferAttribute(c, 3)); const m = new T.Mesh(g, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide, fog: false })); m.position.y = FY; envG.add(m); }
  // lâmpadas penduradas num fio que cai entre dois pontos
  function stringBulbs(a, b, sag, n, col = 0xffd08a, lit = 3) {
    const pts = []; for (let i = 0; i <= 24; i++) { const k = i / 24; pts.push(new T.Vector3(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k - sag * 4 * k * (1 - k), a.z + (b.z - a.z) * k)); }
    envG.add(new T.Line(new T.BufferGeometry().setFromPoints(pts), new T.LineBasicMaterial({ color: 0x111111 })));
    const bm = glow(col, 2.2); for (let i = 1; i < n; i++) { const p = pts[Math.round(i * 24 / n)]; sph(.28, bm, p.x, p.y - .35, p.z, envG, 8); cyl(.12, .12, .3, std('#222'), p.x, p.y - .1, p.z, envG, 6); if (i % Math.ceil(n / lit) === 1) light(col, .9, 22, p.x, p.y - .6, p.z); }
  }
  function tree(x, z, s = 1) { cyl(.5 * s, .8 * s, 9 * s, std('#4a3220'), x, FY + 4.5 * s, z, envG, 8); const m = std('#2d6a2a'); for (let i = 0; i < 9; i++) sph(rand(2.2, 3.4) * s, m, x + rand(-2.5, 2.5) * s, FY + 9 * s + rand(0, 4) * s, z + rand(-2.5, 2.5) * s, envG, 10); }
  function plasticChair(x, z, ry, col = '#eeeeea') { const g = new T.Group(); g.position.set(x, FY, z); g.rotation.y = ry; envG.add(g); const m = std(col, { roughness: .5 }); box(4.2, .4, 4.2, m, 0, 4.4, 0, g); box(4.2, 4.2, .4, m, 0, 6.6, -1.9, g); for (const sx of [-1.8, 1.8]) for (const sz of [-1.8, 1.8]) box(.35, 4.4, .35, m, sx, 2.2, sz, g); }
  function plasticTable(x, z) { const m = std('#eeeeea', { roughness: .5 }); cyl(4, 4, .35, m, x, FY + 7.2, z, envG, 20); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; cyl(.25, .3, 7.1, m, x + Math.cos(a) * 2.5, FY + 3.55, z + Math.sin(a) * 2.5, envG, 8); } }
  function bottles(x0, y, z0, n, along = 'z', step = 1) { const glass = ['#2a7a3a', '#7a4a1a', '#c0a060', '#3a3a8a', '#8a2a2a']; for (let i = 0; i < n; i++) { const m = new T.MeshPhysicalMaterial({ color: C(glass[i % 5]), roughness: .15, transmission: .25, transparent: true, opacity: .85 }); const x = along === 'z' ? x0 + rand(-.3, .3) : x0 + i * step, z = along === 'z' ? z0 + i * step : z0 + rand(-.3, .3); cyl(.45, .5, 2.6, m, x, y + 1.3, z, envG, 10); cyl(.15, .3, 1.1, m, x, y + 3.15, z, envG, 8); } }
  function crate(x, z, ry, col = '#e8c020') { const m = std(col, { roughness: .6 }); const g = new T.Group(); g.position.set(x, FY, z); g.rotation.y = ry; envG.add(g); box(5, 3, 3.4, m, 0, 1.5, 0, g); const d = std('#2a2210'); for (const sx of [-1.4, 0, 1.4]) box(.9, 1.6, 3.5, d, sx, 1.8, 0, g); return g; }
  // fregueses: cada um tem um caminho (lista de pontos, longe da mesa); anda até o próximo, para um pouco e segue; batem palma nas bolas boas
  function npcs(list) {
    if (!T.GLTFLoader || !T.SkeletonUtils) return;
    const L = new T.GLTFLoader(), g = envG;
    list.forEach(([f, path, ry]) => L.load(`assets/npc/${f}.glb`, gl => {
      if (envG !== g) return; // o ambiente mudou enquanto carregava
      const m = T.SkeletonUtils.clone(gl.scene); m.scale.setScalar(3.5); m.position.set(path[0][0], FY, path[0][1]); m.rotation.y = ry || 0; m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } }); g.add(m); // o modelo tem 4,84 de altura
      const mix = new T.AnimationMixer(m), clip = nm => gl.animations.find(a => a.name.endsWith(nm)), sex = /mulher/.test(f) ? 'Female_' : 'Man_';
      const act = { idle: mix.clipAction(clip(sex + 'Idle')), walk: mix.clipAction(clip(sex + 'Walk')), clap: mix.clipAction(clip(sex + 'Clapping')) };
      act.idle.play(); act.idle.time = Math.random() * 3; mixers.push(mix);
      people.push({ m, act, cur: 'idle', path, i: 0, wait: rand(2, 6), speed: rand(5, 7), clapT: 0, ry: ry || 0 });
    }, null, () => { }));
  }
  function peopleStep(dt, now) {
    for (const p of people) {
      const sw = to => { if (p.cur === to) return; const a = p.act[to], b = p.act[p.cur]; a.reset().play(); a.crossFadeFrom(b, .3, false); p.cur = to; };
      if (p.clapT > now) { sw('clap'); continue; }
      if (p.path.length < 2) { sw('idle'); continue; }
      if (p.wait > 0) { p.wait -= dt; sw('idle'); continue; }
      const t = p.path[(p.i + 1) % p.path.length], dx = t[0] - p.m.position.x, dz = t[1] - p.m.position.z, d = Math.hypot(dx, dz);
      if (d < .4) { p.i = (p.i + 1) % p.path.length; p.wait = rand(2, 7); continue; }
      sw('walk'); const want = Math.atan2(dx, dz); let dr = want - p.m.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); p.m.rotation.y += dr * Math.min(1, dt * 6);
      p.m.position.x += dx / d * p.speed * dt; p.m.position.z += dz / d * p.speed * dt;
    }
  }
  function cheer() { const now = performance.now(); for (const p of people) if (Math.random() < .7) p.clapT = now + rand(1800, 3200); }
  function tableLamp(kind) { // luminária sobre a mesa (a luz principal, com sombra; as peças da luminária não fazem sombra, a lâmpada fica dentro delas)
    const y = kind === 'chandelier' ? 21 : 17, n0 = envG.children.length;
    if (kind === 'shade') { const shade = std('#1f5a3a', { roughness: .5, metalness: .2, side: T.DoubleSide }), bulbM = glow('#ffe2a0', 2.5); for (const x of [-7, 0, 7]) { const s = new T.Mesh(new T.ConeGeometry(1.7, 1.6, 24, 1, true), shade); s.position.set(x, y + 1, 0); envG.add(s); sph(.45, bulbM, x, y + .4, 0, envG); } box(16, .3, .3, std('#2a2420', { metalness: .6, roughness: .3 }), 0, y + 2.2, 0); for (const x of [-7, 7]) cyl(.05, .05, FY + 32 - y - 2, std('#111'), x, (FY + 32 + y + 2) / 2, 0, envG, 4); }
    else if (kind === 'chandelier') { const brass = std('#c9a227', { metalness: .9, roughness: .25 }), cr = new T.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, transmission: .9, thickness: 1, transparent: true, opacity: .9 }); const t = new T.Mesh(new T.TorusGeometry(3.2, .18, 10, 40), brass); t.rotation.x = Math.PI / 2; t.position.y = y + 1; envG.add(t); for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; sph(.24, cr, Math.cos(a) * 3.2, y + .2 + (i % 2) * .5, Math.sin(a) * 3.2, envG, 8); if (i % 4 === 0) sph(.26, glow('#fff0c0', 3), Math.cos(a) * 2.2, y + 1.4, Math.sin(a) * 2.2, envG, 8); } cyl(.08, .08, FY + 32 - y - 1, brass, 0, (FY + 32 + y + 1) / 2, 0, envG, 6); sph(.9, glow('#fff0c0', 2.5), 0, y + 1.2, 0, envG); }
    envG.children.slice(n0).forEach(o => o.traverse?.(m => (m.castShadow = false)));
    lampL = new T.SpotLight(kind === 'chandelier' ? 0xfff0d0 : 0xffe0b0, 2.4, 70, .8, .5, 1); lampL.position.set(0, y + .5, 0); lampL.target.position.set(0, 0, 0); lampL.castShadow = true; lampL.shadow.mapSize.set(4096, 4096); lampL.shadow.bias = -.0004; lampL.shadow.radius = 2.5; envG.add(lampL, lampL.target);
  }

  // ---------- mesa ----------
  // ruído fino para o pano ter fibra (bumpMap; as UVs das formas estão em unidades, 1 = 10 cm)
  const feltBump = () => canvasTex(256, 256, (x, w, h) => { x.fillStyle = '#808080'; x.fillRect(0, 0, w, h); for (let i = 0; i < 26000; i++) { x.fillStyle = `rgba(${Math.random() < .5 ? '255,255,255' : '0,0,0'},${rand(.08, .3)})`; x.fillRect(rand(0, w), rand(0, h), 1.2, 1.2); } }, [1, 1]);
  const CD = .55, RW = 1.4; // profundidade da tabela e largura da moldura (1 = 10 cm); medidas de mesa de bar
  function buildTable(pano) {
    if (tableG) { scene.remove(tableG); dispose(tableG); }
    const g = tableG = new T.Group(); scene.add(g);
    const A = W / 2 + CD, B = H / 2 + CD, hex = CLOTH[pano] || CLOTH.verde, bump = feltBump();
    const ft = feltTex(hex, [1 / (2 * A), 1 / (2 * B)]); ft.offset.set(.5, .5); // ShapeGeometry: UV = coordenada da forma → o pano inteiro cobre uma vez a textura
    const clothM = new T.MeshStandardMaterial({ map: ft, bumpMap: bump, bumpScale: .0035, roughness: .97 }), railCloth = new T.MeshStandardMaterial({ color: C(hex), bumpMap: bump, bumpScale: .003, roughness: .97 });
    const wood = new T.MeshPhysicalMaterial({ map: woodTex('#6a2619', '#2e0e08'), roughness: .3, clearcoat: .8, clearcoatRoughness: .18 }), dark = std('#2a1009', { roughness: .6 });
    // caçapas: círculo escuro recortado no pano, nas tabelas e na madeira (centro = o da física; no plano das formas y = -z)
    const PK = K.POCKETS.map((p, i) => ({ x: p[0] * S, y: -p[1] * S, r: i < 4 ? .66 : .76 }));
    // pano: retângulo até o fundo das tabelas, furado nas caçapas
    const feltS = new T.Shape(); feltS.moveTo(-A, -B); feltS.lineTo(A, -B); feltS.lineTo(A, B); feltS.lineTo(-A, B); feltS.closePath();
    for (const c of PK) { const h = new T.Path(); h.absarc(c.x, c.y, c.r - .04, 0, Math.PI * 2, true); feltS.holes.push(h); }
    const felt = new T.Mesh(new T.ShapeGeometry(feltS, 24), clothM); felt.rotation.x = -Math.PI / 2; felt.receiveShadow = true; g.add(felt);
    // tabelas: 6 trechos, com as pontas em bico para dentro das caçapas (nariz mais curto que o fundo, como na mesa de verdade)
    const cb = W / 2 - .31, cn = W / 2 - .71, sb = .78, sn = .62, kb = H / 2 - .31, kn = H / 2 - .71; // fundo/nariz no canto (c), no meio (s) e na cabeceira (k)
    const cushion = pts => { const sh = new T.Shape(); sh.moveTo(pts[0][0], -pts[0][1]); for (const q of pts.slice(1)) sh.lineTo(q[0], -q[1]); sh.closePath();
      const geo = new T.ExtrudeGeometry(sh, { depth: .42, bevelEnabled: true, bevelThickness: .06, bevelSize: .06, bevelSegments: 2 }); geo.rotateX(-Math.PI / 2);
      const m = new T.Mesh(geo, railCloth); m.castShadow = m.receiveShadow = true; g.add(m); };
    for (const sz of [-1, 1]) for (const sx of [-1, 1]) cushion([[sx * cb, sz * B], [sx * sb, sz * B], [sx * sn, sz * H / 2], [sx * cn, sz * H / 2]]);
    for (const sx of [-1, 1]) cushion([[sx * A, -kb], [sx * A, kb], [sx * W / 2, kn], [sx * W / 2, -kn]]);
    // moldura de mogno: o furo de dentro acompanha o fundo das tabelas e abre em arco nas 6 caçapas
    const per = [], pts = []; for (let t = 0; t < 1; t += 1 / 720) {
      const u = (t + .125) % 1, d = u * (4 * A + 4 * B); let x, y;
      if (d < 2 * A) { x = -A + d; y = -B; } else if (d < 2 * A + 2 * B) { x = A; y = -B + (d - 2 * A); } else if (d < 4 * A + 2 * B) { x = A - (d - 2 * A - 2 * B); y = B; } else { x = -A; y = B - (d - 4 * A - 2 * B); }
      per.push({ x, y });
    }
    let inside = null;
    for (let k = 0; k <= per.length; k++) {
      const q = per[k % per.length], pk = PK.find(c => Math.hypot(q.x - c.x, q.y - c.y) < c.r);
      if (pk && !inside) inside = { pk, a1: Math.atan2(pts[pts.length - 1].y - pk.y, pts[pts.length - 1].x - pk.x) };
      else if (!pk && inside) { // saiu do círculo: o arco vai pelo lado de fora (longe do centro da mesa)
        const c = inside.pk, a2 = Math.atan2(q.y - c.y, q.x - c.x), am = Math.atan2(c.y, c.x); let d1 = (a2 - inside.a1 + Math.PI * 4) % (Math.PI * 2); if (d1 > Math.PI) d1 -= Math.PI * 2;
        const mid = inside.a1 + d1 / 2, outOK = Math.cos(mid - am) > 0, span = outOK ? d1 : d1 - Math.sign(d1) * Math.PI * 2;
        for (let m = 1; m < 18; m++) { const a = inside.a1 + span * m / 18; pts.push({ x: c.x + Math.cos(a) * c.r, y: c.y + Math.sin(a) * c.r }); }
        inside = null; pts.push(q);
      } else if (!pk) pts.push(q);
    }
    const OW = W + 2 * (CD + RW), OH = H + 2 * (CD + RW), hole = new T.Shape(pts.map(q => new T.Vector2(q.x, q.y))), ring = roundRect(OW, OH, 1.2); ring.holes.push(hole);
    const top = new T.Mesh(new T.ExtrudeGeometry(ring, { depth: .42, bevelEnabled: true, bevelThickness: .1, bevelSize: .1, bevelSegments: 3, curveSegments: 8 }), wood); top.rotation.x = -Math.PI / 2; top.position.y = .1; top.castShadow = top.receiveShadow = true; g.add(top);
    const body = new T.Mesh(new T.ExtrudeGeometry(roundRect(OW, OH, 1.2), { depth: 3, bevelEnabled: false }), dark); body.rotation.x = -Math.PI / 2; body.position.y = -3.06; body.castShadow = body.receiveShadow = true; g.add(body);
    // losangos de madrepérola no meio da moldura
    const dia = new T.InstancedMesh(new T.CylinderGeometry(.17, .17, .05, 4), std('#f4ecd8', { roughness: .3, emissive: C('#403828') }), 18), d = new T.Object3D(); let i = 0;
    for (const sx of [-1, 1]) for (let k = 1; k <= 3; k++) for (const sz of [-1, 1]) { d.position.set(sx * W / 2 * k / 4, .64, sz * (B + RW / 2)); d.rotation.y = Math.PI / 4; d.updateMatrix(); dia.setMatrixAt(i++, d.matrix); }
    for (const sz of [-1, 1]) for (let k = 1; k <= 3; k++) { d.position.set(sz * (A + RW / 2), .64, (k - 2) * H / 4); d.rotation.y = Math.PI / 4; d.updateMatrix(); dia.setMatrixAt(i++, d.matrix); }
    g.add(dia);
    // o buraco: cano de couro escuro que desce fundo, com o fundo preto
    const holeM = std('#0c0806', { roughness: .95, side: T.DoubleSide }), botM = std('#030201', { roughness: 1 });
    for (const c of PK) { const h = new T.Mesh(new T.CylinderGeometry(c.r - .02, c.r - .2, 2.4, 32, 1, true), holeM); h.position.set(c.x, -.6, -c.y); g.add(h);
      const b = new T.Mesh(new T.CircleGeometry(c.r - .2, 32), botM); b.rotation.x = -Math.PI / 2; b.position.set(c.x, -1.78, -c.y); g.add(b); }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(2.2, 5, 2.2, dark, sx * (W / 2 + 1.4), -5.5, sz * (H / 2 + 1.1), g);
    const sh = new T.Mesh(new T.PlaneGeometry(W + 10, H + 10), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: .45 })); sh.rotation.x = -Math.PI / 2; sh.position.y = FY + .02; g.add(sh);
    cloth = pano;
  }

  // ---------- ambientes ----------
  const ARENAS = {
    bar() { // bar escuro de madeira, com o neon e o balcão
      scene.background = C('#0b0806'); scene.fog = new T.Fog(0x0b0806, 55, 110);
      plane(140, 140, new T.MeshStandardMaterial({ map: plankTex(), roughness: .6 }), 0, FY, 0, -Math.PI / 2);
      const WD = 70, WH = 32, wallM = std('#3a2a22', { roughness: .95 }), panelM = new T.MeshStandardMaterial({ map: woodTex('#4a2e1c', '#20100a', 60), roughness: .6 });
      for (const [x, z, ry] of [[0, -WD / 2, 0], [-WD / 2, 0, Math.PI / 2], [WD / 2, 0, -Math.PI / 2], [0, WD / 2, Math.PI]]) { plane(WD, WH, wallM, x, FY + WH / 2, z, 0, ry); plane(WD, 9, panelM, x, FY + 4.5, z, 0, ry).translateZ(.05); }
      plane(WD, WD, std('#1a1410'), 0, FY + WH, 0, Math.PI / 2);
      tableLamp('shade'); envG.add(new T.HemisphereLight(0x6a5a50, 0x1a1008, .5));
      plane(22, 7, new T.MeshBasicMaterial({ map: neonTex('SINUCA', '#ff3b7a'), transparent: true }), 0, FY + 22, -WD / 2 + .2); light(0xff3b7a, 1.4, 40, 0, FY + 21, -WD / 2 + 4);
      const barM = new T.MeshPhysicalMaterial({ map: woodTex('#3a2214', '#180c06'), roughness: .3, clearcoat: .5 });
      box(5, 10, 34, barM, -WD / 2 + 8, FY + 5, 0); box(6, .4, 36, std('#1a1410', { roughness: .15, metalness: .4 }), -WD / 2 + 8, FY + 10.2, 0);
      box(1, 20, 36, panelM, -WD / 2 + .6, FY + 14, 0); for (const y of [8, 13, 18]) { box(2.2, .3, 34, barM, -WD / 2 + 1.2, FY + y, 0); bottles(-WD / 2 + 1.2, FY + y + .15, -16, 12, 'z', 2.9); box(.3, .25, 34, glow('#ffc070', 1.2), -WD / 2 + 2.2, FY + y - .2, 0); }
      for (const z of [-10, -3, 4, 11]) { cyl(1.3, 1.3, .5, std('#7a1a1a', { roughness: .4 }), -WD / 2 + 13.5, FY + 7.2, z); cyl(.25, .4, 7, std('#222', { metalness: .7, roughness: .3 }), -WD / 2 + 13.5, FY + 3.5, z); }
      light(0xffb060, 1.2, 40, -WD / 2 + 6, FY + 20, 0);
      for (let i = 0; i < 7; i++) cyl(.1, .18, 14.6, std(i % 2 ? '#c9a66b' : '#7a4a2a', { roughness: .4 }), WD / 2 - 1.2, FY + 7.5, -6 + i * 2, envG, 8);
      box(1.2, 1.2, 16, barM, WD / 2 - 1, FY + 4, 0); box(1.2, 1.2, 16, barM, WD / 2 - 1, FY + 13, 0);
      plane(13, 8, new T.MeshStandardMaterial({ map: signTex([['SINUCA · R$ 5 A PARTIDA', 40, 90], ['Cerveja gelada   R$ 8', 30, 160], ['Caipirinha   R$ 12', 30, 208], ['Porção de fritas   R$ 18', 30, 256]], '#1e2a1e', '#e8e2c8'), roughness: .9 }), WD / 2 - .3, FY + 20, 0, 0, -Math.PI / 2);
      plane(10, 9, new T.MeshBasicMaterial({ color: 0x6a8ac0 }), 18, FY + 19, -WD / 2 + .15); for (const x of [13.2, 18, 22.8]) box(.5, 9.4, .4, std('#1a1410'), x, FY + 19, -WD / 2 + .3); for (const y of [14.5, 19, 23.5]) box(10.4, .5, .4, std('#1a1410'), 18, FY + y, -WD / 2 + .3); light(0x6a8ac0, .8, 30, 18, FY + 18, -WD / 2 + 5);
      const juke = new T.Group(); juke.position.set(-20, FY, -WD / 2 + 3); envG.add(juke); box(6, 12, 4, std('#4a1a1a', { roughness: .4 }), 0, 6, 0, juke); box(5, 4, .3, glow('#40c0ff', 1.2), 0, 8.5, 2.1, juke); for (const x of [-2.2, 2.2]) box(.5, 9, .4, glow('#ff4090', 1.5), x, 6, 2.1, juke); light(0x80d0ff, .7, 22, -20, FY + 8, -WD / 2 + 7);
      // arandelas nas paredes laterais e um ventilador no canto
      for (const [x, z] of [[-WD / 2 + .6, -22], [-WD / 2 + .6, 22], [WD / 2 - .6, -22], [WD / 2 - .6, 22]]) { sph(.9, glow('#ffd9a0', 2), x, FY + 20, z, envG, 10); light(0xffc890, 1.0, 26, x + (x < 0 ? 2 : -2), FY + 20, z); }
      const fan = new T.Group(); fan.position.set(-22, FY + WH - 2, 20); envG.add(fan); cyl(.6, .6, 2, std('#2a2420'), 0, 1, 0, fan); for (let i = 0; i < 4; i++) box(7, .1, 1.3, std('#5a3a20'), 0, 0, 0, fan, i * Math.PI / 2).translateX(4.2); fans.push(fan);
      for (const [x, z, ry] of [[-10, -WD / 2 + .2, 0], [-WD / 2 + .2, 14, Math.PI / 2]]) { const f = box(6, 4.5, .3, barM, x, FY + 20, z, envG, ry); plane(5.2, 3.7, std(ry ? '#5a7a9a' : '#9a7a4a', { roughness: .9 }), 0, 0, .17, 0, 0, f); }
      npcs([['homem1', [[-18, 14], [-22, 24], [-10, 26], [-18, 14]], .9], ['mulher2', [[-16, -12], [-24, -20], [-12, -28], [4, -28], [-16, -12]], 2.2], ['homem3', [[24, -16], [28, 10], [26, 24], [24, -16]], -2.4], ['mulher3', [[-20, 0]], 1.4]]);
    },
    boteco() { // boteco ao ar livre na favela, à noite: laje, gambiarra de lâmpadas, mesas de plástico e o morro aceso ao fundo
      scene.background = C('#070912'); scene.fog = new T.Fog(0x070912, 70, 160);
      plane(160, 160, new T.MeshStandardMaterial({ map: concreteTex(), roughness: .9 }), 0, FY, 0, -Math.PI / 2);
      skyDome('#0a1030', '#2a1a2a'); stars();
      const brick = new T.MeshStandardMaterial({ map: brickTex(), roughness: .95 });
      plane(70, 24, brick, 0, FY + 12, -30); plane(60, 24, brick, -35, FY + 12, 0, 0, Math.PI / 2); box(70, .6, .6, std('#333'), 0, FY + 24, -30);
      // laje de zinco apoiada em 4 canos
      const zinc = std('#8a8f94', { metalness: .6, roughness: .5, side: T.DoubleSide }); for (let i = 0; i < 9; i++) plane(4.6, 24, zinc, -18 + i * 4.5, FY + 25 - i * .15, -24, -Math.PI / 2 + .04, 0).rotation.z = (i % 2 ? .06 : -.06); // a laje cobre só o fundo: a mesa fica no sereno, debaixo da gambiarra
      for (const [x, z] of [[-20, -12], [20, -12], [-20, -35], [20, -35]]) cyl(.25, .25, 25, std('#2a2a2a', { metalness: .8, roughness: .4 }), x, FY + 12.5, z, envG, 8);
      stringBulbs({ x: -20, y: FY + 26, z: 10 }, { x: 20, y: FY + 26, z: 10 }, 2, 10); stringBulbs({ x: -20, y: FY + 26, z: -10 }, { x: 20, y: FY + 26, z: -10 }, 2, 10);
      stringBulbs({ x: -20, y: FY + 23, z: -26 }, { x: 20, y: FY + 23, z: -26 }, 2, 8, 0xffd08a, 2);
      tableLamp(null); envG.add(new T.HemisphereLight(0x3040a0, 0x1a1a10, .22));
      // geladeira de cerveja, caixas e som
      const fr = new T.Group(); fr.position.set(-30, FY, -14); fr.rotation.y = Math.PI / 2; envG.add(fr); box(7, 17, 6, std('#eaeaea', { roughness: .4 }), 0, 8.5, 0, fr); box(5.5, 9, .3, glow('#ffefc0', 1.4), 0, 10, 3.1, fr); box(7, 2.2, .3, std('#c21f1f'), 0, 4.2, 3.1, fr); light(0xffefc0, 1.0, 20, -27, FY + 10, -14);
      crate(-28, 4, .2); crate(-28, 8, -.1); crate(-28.3, 4.1, .1).position.y += 3; crate(-24, -26, .4, '#e03030');
      const som = new T.Group(); som.position.set(-30, FY, 12); som.rotation.y = Math.PI / 2; envG.add(som); box(9, 12, 6, std('#111'), 0, 6, 0, som); for (const y of [3.5, 8.5]) cyl(2.2, 2.2, .4, std('#333'), 0, y, 3.1, som, 20); for (let i = 0; i < 6; i++) box(1, .3, .2, glow(['#ff3030', '#30ff60', '#3080ff'][i % 3], 2), -3.2 + i * 1.3, 11.4, 3.1, som); light(0x3060ff, .5, 16, -26, FY + 12, 12);
      for (const [x, z] of [[-24, 24], [26, 24], [26, -16]]) { plasticTable(x, z); for (let i = 0; i < 3; i++) { const a = i * 2.1; plasticChair(x + Math.cos(a) * 6, z + Math.sin(a) * 6, -a - Math.PI / 2); } }
      plane(16, 5, new T.MeshStandardMaterial({ map: signTex([['BOTECO DO ZÉ', 64, 110], ['cerveja gelada · petisco · sinuca', 30, 200]], '#1a4a9a', '#ffe060'), roughness: .9 }), 0, FY + 19, -29.6);
      plane(14, 4, new T.MeshBasicMaterial({ map: neonTex('ABERTO', '#40ff80', '900 90px "Lilita One", Impact'), transparent: true }), -34.6, FY + 18, -12, 0, Math.PI / 2); light(0x40ff80, .8, 24, -32, FY + 17, -12);
      // varal com roupa e o morro ao fundo (casinhas com janela acesa)
      for (let i = 0; i < 7; i++) plane(2.2, 3, std(['#d04040', '#4060c0', '#f0f0f0', '#30a060', '#f0d040'][i % 5], { side: T.DoubleSide, roughness: 1 }), 8 + i * 3.2, FY + 18.5, -27, 0, 0);
      envG.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(6, FY + 20, -27), new T.Vector3(30, FY + 20.4, -27)]), new T.LineBasicMaterial({ color: 0x222222 })));
      for (let i = 0; i < 70; i++) { const a = rand(-.9, 1.1), dd = rand(55, 125), x = Math.cos(a) * dd + 20, z = -Math.sin(a) * dd - 10, h = rand(5, 12), y = FY + rand(0, 40) * (dd / 125); const b = box(rand(5, 9), h, rand(5, 9), std(['#8a6a50', '#a07050', '#6a5a4a', '#9a8a70', '#b07a60'][i % 5], { roughness: 1 }), x, y + h / 2, z); b.castShadow = b.receiveShadow = false; if (Math.random() < .7) plane(1.4, 1.4, glow('#ffd27a', 2), 0, 0, 3.6, 0, 0, b); }
      light(0xffa040, .4, 120, 60, FY + 30, -60, envG, 1);
      npcs([['homem2', [[-22, 20], [-30, 26], [-16, 30], [-22, 20]], 2.3], ['mulher1', [[24, 20], [32, 26], [32, -6], [24, 20]], -2.2], ['homem1', [[24, -20], [30, -24], [14, -26], [-6, -24], [24, -20]], -.6], ['mulher3', [[-27, -8]], 1.6]]);
    },
    luxo() { // bar de luxo: mármore preto, dourado, lustre de cristal e a cidade na janela
      scene.background = C('#06060a'); scene.fog = new T.Fog(0x06060a, 60, 130);
      plane(140, 140, new T.MeshPhysicalMaterial({ map: marbleTex(), roughness: .12, metalness: .05, clearcoat: 1 }), 0, FY, 0, -Math.PI / 2);
      plane(W + 16, H + 16, std('#2a0a12', { roughness: 1 }), 0, FY + .03, 0, -Math.PI / 2);
      const WD = 72, WH = 36, wallM = std('#121428', { roughness: .85 }), gold = std('#c9a227', { metalness: .9, roughness: .3 }), wain = new T.MeshPhysicalMaterial({ map: woodTex('#2a1812', '#120806', 50), roughness: .3, clearcoat: .7 });
      for (const [x, z, ry] of [[0, -WD / 2, 0], [-WD / 2, 0, Math.PI / 2], [WD / 2, 0, -Math.PI / 2], [0, WD / 2, Math.PI]]) { plane(WD, WH, wallM, x, FY + WH / 2, z, 0, ry); plane(WD, 10, wain, x, FY + 5, z, 0, ry).translateZ(.05); for (let i = -3; i <= 3; i++) { const g = box(.4, WH - 1, .3, gold, 0, 0, 0, envG, ry); g.position.set(x, FY + WH / 2, z); g.translateX(i * 10); g.translateZ(.2); } }
      plane(WD, WD, std('#0c0c14'), 0, FY + WH, 0, Math.PI / 2);
      tableLamp('chandelier'); envG.add(new T.HemisphereLight(0x404060, 0x100808, .5));
      plane(34, 16, new T.MeshBasicMaterial({ map: skylineTex() }), 0, FY + 20, -WD / 2 + .2); for (const x of [-17, -5.7, 5.7, 17]) box(.6, 16.4, .5, gold, x, FY + 20, -WD / 2 + .4); box(34.6, .6, .5, gold, 0, FY + 12, -WD / 2 + .4); box(34.6, .6, .5, gold, 0, FY + 28, -WD / 2 + .4); light(0x6a7ac0, .7, 40, 0, FY + 18, -WD / 2 + 6);
      const barM = std('#0a0a0e', { roughness: .2, metalness: .3 }); box(5, 10, 36, barM, -WD / 2 + 8, FY + 5, 0); box(6, .5, 38, gold, -WD / 2 + 8, FY + 10.2, 0); box(.6, 3, 36, glow('#50a0ff', .8), -WD / 2 + 10.6, FY + 1.6, 0);
      box(1, 22, 40, barM, -WD / 2 + .6, FY + 15, 0); for (const y of [7, 12, 17]) { box(2.4, .3, 36, gold, -WD / 2 + 1.4, FY + y, 0); box(.3, .25, 36, glow('#50a0ff', 1.6), -WD / 2 + 2.5, FY + y - .2, 0); bottles(-WD / 2 + 1.4, FY + y + .15, -16, 12, 'z', 2.9); }
      for (const z of [-9, -3, 3, 9]) { cyl(1.4, 1.4, .6, std('#1a1a22', { roughness: .4 }), -WD / 2 + 13.5, FY + 7.4, z); cyl(.2, .4, 7, gold, -WD / 2 + 13.5, FY + 3.5, z); }
      light(0xffd090, 1.2, 36, -WD / 2 + 6, FY + 22, 0);
      // sofás chesterfield, mesinha de vidro, tapete
      const leather = std('#3a1a1a', { roughness: .45 }); for (const [x, z, ry] of [[22, 22, -Math.PI / 2], [-22, 22, Math.PI / 2]]) { const g = new T.Group(); g.position.set(x, FY, z); g.rotation.y = ry; envG.add(g); box(14, 4, 7, leather, 0, 2, 0, g); box(14, 5, 2, leather, 0, 6.5, -3, g); for (const sx of [-7.2, 7.2]) box(1.6, 6, 7, leather, sx, 3, 0, g); for (let i = -1; i <= 1; i++) box(4, 1.2, 5.5, leather, i * 4.4, 4.6, .5, g); }
      box(8, .3, 4, new T.MeshPhysicalMaterial({ color: 0xa0c0d0, roughness: 0, transmission: .8, transparent: true, opacity: .6 }), 0, FY + 4.5, 24); for (const sx of [-3.5, 3.5]) for (const sz of [-1.5, 1.5]) cyl(.15, .15, 4.4, gold, sx, FY + 2.2, 24 + sz, envG, 6);
      for (const [x, z] of [[-WD / 2 + .6, -22], [-WD / 2 + .6, 22], [WD / 2 - .6, -22], [WD / 2 - .6, 22], [WD / 2 - .6, 0]]) { box(1.2, 3, 1.2, glow('#ffe0b0', 1.8), x, FY + 22, z); light(0xffd9a0, 1.0, 28, x + (x < 0 ? 2 : -2), FY + 22, z); }
      for (let i = 0; i < 6; i++) cyl(.1, .18, 14.6, std(i % 2 ? '#1a1a1a' : '#c9a227', { roughness: .3, metalness: .5 }), WD / 2 - 1.2, FY + 7.5, -5 + i * 2, envG, 8); box(1.2, 1.2, 14, gold, WD / 2 - 1, FY + 4, 0); box(1.2, 1.2, 14, gold, WD / 2 - 1, FY + 13, 0);
      plane(10, 7, std('#2a2a3a', { roughness: .9 }), WD / 2 - .3, FY + 22, 16, 0, -Math.PI / 2); box(.5, 7.6, 10.6, gold, WD / 2 - .1, FY + 22, 16);
      npcs([['mulher3', [[-20, 10], [-26, 20], [-14, 26], [-20, 10]], 1.6], ['homem3', [[20, -18], [28, -8], [30, 14], [20, -18]], -2.2], ['homem1', [[-20, -14]], 1.2]]);
    },
    quintal() { // quintal de casa à noite: grama, muro, churrasqueira acesa, varal e a luz da varanda
      scene.background = C('#06080f'); scene.fog = new T.Fog(0x06080f, 70, 150);
      plane(160, 160, new T.MeshStandardMaterial({ map: grassTex(), roughness: 1 }), 0, FY, 0, -Math.PI / 2);
      plane(W + 18, H + 16, new T.MeshStandardMaterial({ map: concreteTex(), roughness: .9 }), 0, FY + .03, 0, -Math.PI / 2);
      skyDome('#060a1e', '#1c1a2c'); stars(); sph(3.5, glow('#f4f0d8', 1.5), -60, FY + 70, -70, envG, 16); light(0xaab4d8, .4, 300, -60, FY + 70, -70, envG, 1);
      // muro em volta (cerca de madeira na frente, muro de tijolo no fundo), casa de um lado
      const brick = new T.MeshStandardMaterial({ map: brickTex('#8a6a50', '#a09080'), roughness: .95 }); plane(80, 13, brick, 0, FY + 6.5, -34); box(80, .5, 1, std('#555'), 0, FY + 13, -34);
      const fence = std('#6a4a2a', { roughness: .9 }); for (let i = 0; i < 34; i++) { box(1.6, 10, .4, fence, -33 + i * 2.1, FY + 5, 30); } box(72, .6, .4, fence, 0, FY + 8, 30.2); box(72, .6, .4, fence, 0, FY + 3, 30.2);
      for (let i = 0; i < 30; i++) box(1.6, 10, .4, fence, 36, FY + 5, -32 + i * 2.1, envG, Math.PI / 2); box(64, .6, .4, fence, 36.2, FY + 8, 0, envG, Math.PI / 2);
      const house = std('#e8dcc0', { roughness: .95 }); box(1.5, 26, 70, house, -36, FY + 13, 0); box(10, 1, 74, new T.MeshStandardMaterial({ map: tileTex(), roughness: .9 }), -31.5, FY + 26.5, 0, envG).rotation.z = -.25;
      plane(9, 8, glow('#ffd9a0', .9), -35.1, FY + 14, -12, 0, Math.PI / 2); for (const z of [-15.3, -12, -8.7]) box(.4, 8.4, .5, std('#3a2a1a'), -35, FY + 14, z); box(9.4, .5, .5, std('#3a2a1a'), -35, FY + 14, -12, envG, Math.PI / 2); light(0xffd9a0, 1.2, 40, -31, FY + 14, -12);
      box(6, 15, .6, std('#4a2a1a', { roughness: .6 }), -35, FY + 7.5, 10, envG, Math.PI / 2); sph(.8, glow('#fff0c0', 2.2), -34, FY + 19, 10, envG, 10); light(0xffe8b0, 1.4, 38, -31, FY + 19, 10);
      // churrasqueira acesa, mesa com cadeiras, isopor, árvore e varal
      const bq = new T.Group(); bq.position.set(24, FY, -28); envG.add(bq); box(10, 12, 7, brick, 0, 6, 0, bq); box(8, 1, 5, std('#222'), 0, 12.3, 0, bq); for (let i = 0; i < 7; i++) box(8, .15, .15, std('#555', { metalness: .8 }), 0, 12.9, -2.4 + i * .8, bq); const coals = glow('#ff6a20', 2.5); for (let i = 0; i < 10; i++) sph(rand(.3, .6), coals, rand(-3, 3), 12.6, rand(-2, 2), bq, 6); box(10, 14, 2, brick, 0, 19, -3.2, bq); const fl = light(0xff7a30, 2.2, 30, 24, FY + 14, -26); flick.push(fl);
      plasticTable(-22, 22); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; plasticChair(-22 + Math.cos(a) * 6, 22 + Math.sin(a) * 6, -a - Math.PI / 2, i % 2 ? '#e8e8e0' : '#2a5ad0'); }
      box(6, 4, 4, std('#eaeaea', { roughness: .5 }), 22, FY + 2, 22); box(6.2, .8, 4.2, std('#2a5ad0', { roughness: .5 }), 22, FY + 4.3, 22);
      tree(28, 18, 1.4); tree(-26, -26, 1.1);
      envG.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(-34, FY + 17, -22), new T.Vector3(10, FY + 18, -32)]), new T.LineBasicMaterial({ color: 0x222222 })));
      for (let i = 0; i < 8; i++) { const k = .12 + i * .1; plane(2.2, 3.2, std(['#f0f0f0', '#4060c0', '#d04040', '#f0d040'][i % 4], { side: T.DoubleSide, roughness: 1 }), -34 + 44 * k, FY + 15.6 + k, -22 - 10 * k, 0, .25); }
      stringBulbs({ x: -34, y: FY + 27, z: -11 }, { x: 28, y: FY + 26, z: -11 }, 2, 12); stringBulbs({ x: -34, y: FY + 27, z: 11 }, { x: 28, y: FY + 26, z: 11 }, 2, 12);
      tableLamp(null); envG.add(new T.HemisphereLight(0x3a4a80, 0x101a08, .45));
      npcs([['homem2', [[-24, 14], [-28, 24], [-14, 26], [-24, 14]], 1.2], ['mulher1', [[20, 24], [30, 20], [30, -16], [20, 24]], -2.6], ['homem3', [[-26, -14]], .8]]);
    },
  };
  function buildEnv(name) {
    if (envG) { scene.remove(envG); dispose(envG); mixers = []; fans = []; flick = []; people = []; }
    envG = new T.Group(); scene.add(envG);
    (ARENAS[name] || ARENAS.bar)();
    arena = name;
  }
  // reflexos: um "quarto" simples (teto claro, paredes escuras) vira o mapa de ambiente de todas as peças
  function envMap() {
    const pm = new T.PMREMGenerator(renderer), es = new T.Scene(); es.background = C('#0a0806');
    plane(60, 60, glow('#ffe8c0', 1.6), 0, 25, 0, Math.PI / 2, 0, es); plane(20, 6, glow('#ffd0a0', 3), 0, 22, -8, Math.PI / 2, 0, es);
    for (const [x, z, ry] of [[0, -40, 0], [-40, 0, Math.PI / 2], [40, 0, -Math.PI / 2], [0, 40, Math.PI]]) plane(80, 50, glow('#3a2a20', .25), x, 10, z, 0, ry, es);
    plane(80, 80, glow('#2a1a10', .2), 0, -15, 0, -Math.PI / 2, 0, es);
    scene.environment = pm.fromScene(es, .04).texture; pm.dispose();
  }

  // ---------- bolas, taco, mira ----------
  function buildBalls() {
    ballGeo = new T.SphereGeometry(R, 28, 20);
    shadowTex = canvasTex(128, 128, (x, w, h) => { const gr = x.createRadialGradient(64, 64, 4, 64, 64, 60); gr.addColorStop(0, 'rgba(0,0,0,.7)'); gr.addColorStop(.5, 'rgba(0,0,0,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, w, h); });
    const shG = new T.CircleGeometry(R * 1.55, 20);
    for (let n = 0; n <= 15; n++) { const m = new T.Mesh(ballGeo, new T.MeshPhysicalMaterial({ map: ballTex(n), roughness: .1, clearcoat: 1, clearcoatRoughness: .06, envMapIntensity: .9 })); m.castShadow = true; m.visible = false; scene.add(m);
      const sh = new T.Mesh(shG, new T.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false })); sh.rotation.x = -Math.PI / 2; sh.renderOrder = 1; sh.position.y = .012; sh.visible = false; scene.add(sh); // oclusão de contato: mancha escura no pano, embaixo da bola (fora da bola para não girar junto)
      balls[n] = { m, sh, x: 0, z: 0, in: true, drop: 0 }; }
    cueG = new T.Group(); scene.add(cueG);
    const shaft = new T.Mesh(new T.CylinderGeometry(.09, .15, 9.5, 12), new T.MeshPhysicalMaterial({ color: C('#d9b57a'), roughness: .3, clearcoat: .8, transparent: true })), butt = new T.Mesh(new T.CylinderGeometry(.15, .19, 5, 12), new T.MeshPhysicalMaterial({ color: C('#3a1a10'), roughness: .35, clearcoat: .8, transparent: true })), tip = new T.Mesh(new T.CylinderGeometry(.09, .09, .3, 10), std('#3a6aa8')), fer = new T.Mesh(new T.CylinderGeometry(.09, .1, .5, 10), std('#eee'));
    shaft.rotation.z = -Math.PI / 2; shaft.position.x = -(R + 5.4); butt.rotation.z = -Math.PI / 2; butt.position.x = -(R + 12.6); tip.rotation.z = -Math.PI / 2; tip.position.x = -(R + .15); fer.rotation.z = -Math.PI / 2; fer.position.x = -(R + .55);
    [shaft, butt, tip, fer].forEach(o => { o.castShadow = true; cueG.add(o); }); cueG.visible = false; cueParts = { shaft, butt };
    // mão de apoio (ponte aberta): palma no pano, 4 dedos abertos para a frente, polegar levantado; o taco passa por cima dos nós; antebraço para trás
    handG = new T.Group(); scene.add(handG); handG.visible = false;
    const skin = std('#c9906a', { roughness: .7 }), palm = sph(.5, skin, 0, .28, .05, handG, 14); palm.scale.set(1, .42, .85);
    for (const [z, len] of [[-.42, .95], [-.14, 1.05], [.14, 1.0], [.42, .85]]) { const f = cyl(.11, .13, len, skin, 0, 0, 0, handG, 8); f.position.set(.35 + len * .42, .2 - len * .1, z); f.rotation.z = -1.25; f.rotation.y = -z * .5; }
    const th = cyl(.11, .14, .9, skin, -.05, .55, -.45, handG, 8); th.rotation.x = .9; th.rotation.z = .5;
    const arm = cyl(.3, .36, 3.2, skin, -1.6, 1.0, .25, handG, 10); arm.rotation.z = 1.1; arm.rotation.y = .12;
    const cuff = cyl(.4, .42, .5, std('#2b3a5a'), -2.95, 1.9, .35, handG, 10); cuff.rotation.z = 1.1; cuff.rotation.y = .12;
    guide = new T.Group(); scene.add(guide);
    guide.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]), new T.LineDashedMaterial({ color: 0xffffff, dashSize: .5, gapSize: .3, transparent: true, opacity: .75 })));
    guide.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]), new T.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: .95 })));
    guide.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: .55 })));
    guide.add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3(1, 0, 0)]), new T.LineDashedMaterial({ color: 0xffe08a, dashSize: .4, gapSize: .3, transparent: true, opacity: .5 })));
    ghost = new T.Mesh(ballGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .35 })); guide.add(ghost); guide.visible = false;
    const ringG = new T.RingGeometry(R * 1.15, R * 1.45, 32); for (const col of [0xffffff, 0xffd24a]) { const r = new T.Mesh(ringG, new T.MeshBasicMaterial({ color: col, transparent: true, opacity: .85, depthWrite: false, side: T.DoubleSide })); r.rotation.x = -Math.PI / 2; r.renderOrder = 2; guide.add(r); } // [5] contato, [6] bola alvo
    ghostCue = new T.Mesh(ballGeo, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5 })); ghostCue.visible = false; scene.add(ghostCue);
  }
  // ângulo do taco para o cabo passar por cima da madeira (quando a branca está perto da tabela)
  function cueElev(c, ang, back) {
    const dx = -Math.cos(ang), dz = -Math.sin(ang), ex = W / 2 + 1.2, ez = H / 2 + 1.2;
    const tx = dx > 0 ? (ex - c.x) / dx : dx < 0 ? (-ex - c.x) / dx : 1e9, tz = dz > 0 ? (ez - c.z) / dz : dz < 0 ? (-ez - c.z) / dz : 1e9, d = Math.max(.4, Math.min(tx, tz));
    return 14.9 + back > d ? Math.min(.75, Math.atan2(1.05 - R, d)) : .05;
  }
  // primeira bola na linha a partir de (x, z) na direção (dx, dz), fora `skip` (raio × círculo de 2R)
  function castBall(x, z, dx, dz, skip) {
    let best = null;
    for (const n in balls) { const b = balls[n]; if (b.in || skip.includes(+n)) continue;
      const ox = b.x - x, oz = b.z - z, t = ox * dx + oz * dz; if (t <= 0) continue;
      const d2 = ox * ox + oz * oz - t * t, r2 = 4 * R * R; if (d2 > r2) continue;
      const tt = t - Math.sqrt(r2 - d2); if (tt > 0 && (!best || tt < best.t)) best = { t: tt, b };
    }
    return best;
  }
  // distância até a tabela a partir de (x, z) na direção (dx, dz) e a direção depois de rebater
  function castWall(x, z, dx, dz) {
    const lx = W / 2 - R, lz = H / 2 - R, tx = dx > 0 ? (lx - x) / dx : dx < 0 ? (-lx - x) / dx : 1e9, tz = dz > 0 ? (lz - z) / dz : dz < 0 ? (-lz - z) / dz : 1e9;
    return tx < tz ? { t: Math.max(0, tx), rx: -dx * .72, rz: dz * .9 } : { t: Math.max(0, tz), rx: dx * .9, rz: -dz * .72 };
  }
  function aimInfo() { // ponto de contato da mira: primeira bola na linha ou a tabela
    const c = balls[0], dx = Math.cos(aim.ang), dz = Math.sin(aim.ang), best = castBall(c.x, c.z, dx, dz, [0]);
    if (best) { const gx = c.x + dx * best.t, gz = c.z + dz * best.t, nx = best.b.x - gx, nz = best.b.z - gz, nl = Math.hypot(nx, nz) || 1; return { t: best.t, gx, gz, nx: nx / nl, nz: nz / nl, ball: best.b, dx, dz }; }
    const w = castWall(c.x, c.z, dx, dz); return { t: w.t, gx: c.x + dx * w.t, gz: c.z + dz * w.t, dx, dz, w };
  }
  function setLine(line, a, b) { const p = line.geometry.attributes.position; p.setXYZ(0, a.x, a.y, a.z); p.setXYZ(1, b.x, b.y, b.z); p.needsUpdate = true; line.computeLineDistances(); }

  // ---------- coisas jogadas na mesa ----------
  function makeItem(item) {
    const g = new T.Group();
    if (item === 'garrafa') { const m = new T.MeshPhysicalMaterial({ color: C('#1f6a30'), roughness: .08, transmission: .35, transparent: true, opacity: .9, clearcoat: 1 }); cyl(.32, .34, 2.1, m, 0, 1.05, 0, g, 14); cyl(.12, .3, .9, m, 0, 2.5, 0, g, 10); cyl(.14, .14, .25, std('#c9a227', { metalness: .8, roughness: .3 }), 0, 3.0, 0, g, 8); cyl(.335, .345, .7, std('#f1e6c8', { roughness: .8 }), 0, 1.0, 0, g, 14); cyl(.34, .35, .25, std('#b8232a', { roughness: .7 }), 0, 1.0, 0, g, 14); }
    else if (item === 'copo') { const m = new T.MeshPhysicalMaterial({ color: C('#e6f0f4'), roughness: .03, transmission: .7, transparent: true, opacity: .5, clearcoat: 1 }); cyl(.42, .34, 1.3, m, 0, .65, 0, g, 16); cyl(.37, .31, .75, new T.MeshPhysicalMaterial({ color: C('#d8901e'), roughness: .1, transparent: true, opacity: .85 }), 0, .45, 0, g, 14); cyl(.37, .37, .12, std('#fff6e0', { roughness: .9 }), 0, .88, 0, g, 14); }
    else if (item === 'cinzeiro') { cyl(.6, .5, .35, new T.MeshPhysicalMaterial({ color: C('#b0c0d0'), roughness: .05, transmission: .5, transparent: true, opacity: .7 }), 0, .18, 0, g, 14); }
    else { const m = std('#3a2414', { roughness: .55 }); box(1.4, .5, .9, m, 0, .4, 0, g); box(1.0, .6, .9, m, -.1, .9, 0, g); box(1.5, .22, .95, std('#efe9dc', { roughness: .8 }), 0, .11, 0, g); box(1.52, .08, .97, std('#15100c'), 0, .02, 0, g); for (let i = 0; i < 3; i++) box(.05, .05, .9, std('#eee'), -.35 + i * .25, 1.22 - i * .06, 0, g); box(.3, .2, .9, std('#15100c'), .62, .32, 0, g); }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g;
  }
  // lança do lugar de quem jogou até (x, z) na mesa; chega em `land` (ms, relógio da sala)
  function throwItem(t) {
    const from = SEATS[t.seat % 4], g = makeItem(t.item); scene.add(g);
    const start = new T.Vector3(from[0] * .9, 6.5, from[1] * .9), end = new T.Vector3(t.x * S, 0, t.z * S);
    flyers.push({ g, item: t.item, start, end, t0: performance.now(), dur: Math.max(250, t.land - Room.now()), spin: new T.Vector3(rand(-6, 6), rand(-3, 3), rand(-6, 6)), key: t.n, ttl: t.ttl });
  }
  function land(f) {
    const it = K.TOSS[f.item]; let g = f.g;
    if (it?.glass) { // quebra: cacos espalhados
      scene.remove(g); dispose(g); g = new T.Group(); scene.add(g); g.position.copy(f.end);
      const m = new T.MeshPhysicalMaterial({ color: C(f.item === 'garrafa' ? '#2a7a3a' : '#d8e8f0'), roughness: .1, transmission: .4, transparent: true, opacity: .75 });
      for (let i = 0; i < 9; i++) { const s = box(rand(.25, .6), .08, rand(.2, .5), m, rand(-1, 1) * it.r * S * 1.6, .04, rand(-1, 1) * it.r * S * 1.6, g, rand(0, 6)); s.castShadow = false; }
      if (f.item === 'garrafa') cyl(.32, .34, .9, m, rand(-.3, .3), .45, rand(-.3, .3), g, 12);
      snd.glass(f.item);
    } else { g.position.copy(f.end); g.rotation.set(0, rand(0, 6), 0); snd.thud(); }
    remains.push({ g, until: performance.now() + (f.ttl || K.TOSS_TTL), key: f.key });
  }

  // ---------- som ----------
  // Tudo sintetizado na hora (sem arquivo): os sons passam por um reverb de sala (resposta ao impulso gerada) para parecerem gravados num bar.
  let audio = null, master = null, noiseBuf = null;
  function ac() {
    if (audio !== null) return audio || null;
    try {
      audio = new (window.AudioContext || window.webkitAudioContext)(); master = audio.createGain(); master.gain.value = .9; master.connect(audio.destination);
      const sr = audio.sampleRate, n = Math.floor(sr * 1.3), ir = audio.createBuffer(2, n, sr);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.exp(-k / n * 6.5) * (k < sr * .012 ? .25 : 1); for (const [ms, g] of [[9, .5], [19, .4], [31, .3], [47, .2]]) { const at = Math.floor(sr * ms / 1000); for (let k = 0; k < 200; k++) d[at + k] += (Math.random() * 2 - 1) * g * (1 - k / 200); } }
      const cv = audio.createConvolver(), wet = audio.createGain(); cv.buffer = ir; wet.gain.value = .28; master.connect(cv); cv.connect(wet); wet.connect(audio.destination);
      noiseBuf = audio.createBuffer(1, Math.floor(sr * .5), sr); const nd = noiseBuf.getChannelData(0); for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
    } catch { audio = false; }
    return audio || null;
  }
  const on = () => { const c = ac(); return c && !SFX.isMuted?.() ? c : null; };
  // gravações reais (assets/sn_*.mp3, CC0 do Freesound): decodificadas uma vez e tocadas pelo mesmo reverb; se não carregar, fica a síntese
  const SMP = {}, SAMPLES = ['cue', 'hit1', 'hit2', 'pocket', 'clap', 'cheer', 'laugh', 'groan', 'aww', 'eh'];
  function loadSamples() { const c = ac(); if (!c) return; for (const n of SAMPLES) if (SMP[n] === undefined) { SMP[n] = null; fetch('assets/sn_' + n + '.mp3').then(r => r.arrayBuffer()).then(a => c.decodeAudioData(a)).then(d => { SMP[n] = d; }).catch(() => { SMP[n] = false; }); } }
  function sample(name, vol = 1, rate = 1, at = 0) { const c = on(), b = c && SMP[name]; if (!b) return false; const s = c.createBufferSource(), g = c.createGain(); s.buffer = b; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g); g.connect(master); s.start(c.currentTime + at); return true; }
  function tone(f, dur, vol, type = 'sine', at = 0) { const c = on(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + at; o.type = type; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur); o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + .02); }
  // ruído curto com envelope exponencial, por um filtro (ou vários em paralelo: [[freq, Q, ganho], ...] = modos de ressonância)
  function burst(dur, freq, q, vol, type = 'bandpass', at = 0, decay = 6) {
    const c = on(); if (!c) return; const t = c.currentTime + at, src = c.createBufferSource(), env = c.createGain(); src.buffer = noiseBuf; src.loop = true;
    env.gain.setValueAtTime(vol, t); env.gain.exponentialRampToValueAtTime(vol * .001, t + dur); src.connect(env);
    for (const [F, Q, g] of Array.isArray(freq) ? freq : [[freq, q, 1]]) { const f = c.createBiquadFilter(), fg = c.createGain(); f.type = Array.isArray(freq) ? 'bandpass' : type; f.frequency.value = F; f.Q.value = Q; fg.gain.value = g; env.connect(f); f.connect(fg); fg.connect(master); }
    src.start(t); src.stop(t + dur + .01);
  }
  const clip = (f, v = .8) => { if (SFX.isMuted?.()) return; const a = new Audio(f); a.volume = v; a.play().catch(() => { }); };
  // voz sintética: fonte dente de serra (com vibrato e um tremor) por 3 filtros de formante em paralelo
  // o = { f: [[t, hz], ...] (altura), fm: [[F, Q, g], ...] (formantes), env: [[t, 0..1], ...], dur, vol, at, h (sopro no começo) }
  const FM = { a: [[730, 9, 1], [1090, 10, .45], [2440, 14, .2]], o: [[570, 8, 1], [840, 10, .5], [2410, 14, .15]], u: [[300, 7, 1], [870, 11, .25], [2240, 14, .08]], e: [[530, 8, 1], [1840, 12, .45], [2480, 14, .2]] };
  function voice(o) {
    const c = on(); if (!c) return; const t = c.currentTime + (o.at || 0), src = c.createOscillator(), mix = c.createGain(), env = c.createGain(); src.type = 'sawtooth';
    src.frequency.setValueAtTime(o.f[0][1], t); for (const [tt, hz] of o.f.slice(1)) src.frequency.exponentialRampToValueAtTime(hz, t + tt);
    const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = o.vib?.[0] || 5.5; vg.gain.value = o.vib?.[1] || o.f[0][1] * .02; vib.connect(vg); vg.connect(src.frequency); vib.start(t); vib.stop(t + o.dur + .1);
    const jit = c.createOscillator(), jg = c.createGain(); jit.type = 'square'; jit.frequency.value = 27 + Math.random() * 9; jg.gain.value = o.f[0][1] * (o.creak || .008); jit.connect(jg); jg.connect(src.frequency); jit.start(t); jit.stop(t + o.dur + .1);
    for (const [F, Q, g] of o.fm) { const f = c.createBiquadFilter(), fg = c.createGain(); f.type = 'bandpass'; f.frequency.value = F * (o.fk || 1); f.Q.value = Q; fg.gain.value = g; src.connect(f); f.connect(fg); fg.connect(mix); }
    env.gain.setValueAtTime(.0001, t); for (const [tt, v] of o.env) env.gain.exponentialRampToValueAtTime(Math.max(.0001, v * o.vol), t + tt);
    mix.connect(env); env.connect(master); src.start(t); src.stop(t + o.dur + .05);
    if (o.h) burst(.05, 1600, .6, o.vol * .35, 'bandpass', o.at || 0);
  }
  // palmas: cada pessoa bate em ritmo próprio (3,5–5 por segundo), cada palma é um estalo de ruído filtrado
  function claps(people = 6, dur = 1.3, vol = .45) {
    const c = on(); if (!c) return;
    for (let p = 0; p < people; p++) { let at = rand(0, .22); const rate = rand(3.5, 5), end = dur * rand(.75, 1), F = rand(1000, 2300), v = vol * rand(.5, 1);
      while (at < end) { burst(.04, [[F * rand(.92, 1.08), 1.3, 1], [F * 2.1, 2, .3]], 0, v * rand(.6, 1), 'bandpass', at, 9); at += rand(.85, 1.15) / rate; } }
  }
  function laughOne(f0, at, n, vol, fk) { // "ha-ha-ha": sílabas que descem de altura, com o sopro do h
    for (let i = 0; i < n; i++) { const t = at + i * (.155 + i * .012) + rand(0, .02), f = f0 * (1 - i * .035) * rand(.97, 1.03);
      voice({ f: [[0, f * 1.06], [.05, f], [.13, f * .86]], fm: FM.a, fk, env: [[.025, 1], [.08, .55], [.14, .0001]], dur: .15, vol: vol * (i ? 1 : .8), at: t, h: true, vib: [6, f * .03] }); }
  }
  const snd = {
    // bola contra bola: "clack" de resina — ruído de 3 ms excitando modos agudos (filtros ressonantes), mais um toque grave na batida forte
    hit: v => { const k = Math.min(1, v / 3.5), vol = .12 + .7 * k; if (sample(Math.random() < .5 ? 'hit1' : 'hit2', .25 + .75 * k, rand(.94, 1.06))) return; burst(.012 + k * .01, [[2350 * rand(.98, 1.02), 16, 1], [3520, 12, .7], [5400, 9, .45], [8100, 7, .2]], 0, vol, 'bandpass', 0, 10); burst(.003, 6000, .5, vol * .8, 'highpass'); if (k > .3) burst(.03, 190, 1.5, k * .25, 'lowpass'); },
    // tacada: o "tock" da sola de couro na bola e o cabo do taco vibrando
    cue: p => { if (sample('cue', .4 + .6 * p, rand(.96, 1.04))) return; burst(.02, [[900, 3, 1], [1900, 6, .5], [3200, 8, .25]], 0, .3 + .5 * p, 'bandpass', 0, 10); burst(.004, 5000, .5, .15 + .2 * p, 'highpass'); tone(160, .07, .15 + .25 * p, 'sine'); tone(1150, .05, .05 + .12 * p, 'triangle'); },
    // tabela: borracha com pano, abafado
    wall: v => { const k = Math.min(1, v / 2.5); burst(.05, [[260, 1.5, 1], [700, 2, .4], [1600, 3, .12]], 0, .12 + .4 * k, 'bandpass', 0, 7); tone(120, .07, .08 + .18 * k, 'sine'); },
    // caçapa: a bola bate na boca de couro, desce e chacoalha no fundo
    pocket: () => { if (sample('pocket', .9, rand(.95, 1.05))) return; burst(.08, [[220, 1.2, 1], [520, 2, .5]], 0, .5, 'bandpass', 0, 6); [.1, .17, .23, .3].forEach((at, i) => burst(.015, [[2200 - i * 250, 10, 1], [3300, 8, .5]], 0, .22 - i * .04, 'bandpass', at, 10)); burst(.25, [[180, 1, 1], [400, 1.5, .4]], 0, .3, 'bandpass', .2, 5); },
    obj: (v, item) => { const k = Math.min(1, v / 2.5); if (K.TOSS[item]?.glass) burst(.05, [[2900, 10, 1], [4300, 8, .6], [6100, 6, .3]], 0, .15 + .4 * k, 'bandpass', 0, 8); else burst(.07, [[420, 1.2, 1], [900, 2, .3]], 0, .15 + .4 * k, 'bandpass', 0, 6); },
    glass: item => clip(item === 'garrafa' ? 'assets/d_garrafa.mp3' : 'assets/d_copo.mp3', .7),
    // reações da mesa
    groan: () => { if (sample('groan', .8, rand(.9, 1.05))) return; const f = rand(130, 175); voice({ f: [[0, f], [.45, f * .76], [.85, f * .6]], fm: FM.o, env: [[.07, 1], [.4, .85], [.9, .0001]], dur: .95, vol: .22, creak: .03, vib: [5, f * .04] }); voice({ f: [[.0, f * .5], [.8, f * .3]], fm: FM.u, env: [[.1, .5], [.8, .0001]], dur: .85, vol: .08 }); },
    laugh: () => { if (sample('laugh', .7, rand(.95, 1.05))) return; laughOne(rand(165, 215), 0, 5 + Math.floor(Math.random() * 3), .17, 1); laughOne(rand(260, 330), .11, 4 + Math.floor(Math.random() * 3), .12, 1.12); if (Math.random() < .5) laughOne(rand(190, 240), .3, 3, .08, .95); },
    cheer: () => { if (sample('cheer', .7, rand(.97, 1.03))) { if (Math.random() < .5) sample('eh', .5, rand(.95, 1.05), .1); return; } claps(7, 1.5, .5); for (let i = 0; i < 2; i++) { const f = rand(230, 320); voice({ f: [[0, f * .9], [.08, f * 1.25], [.35, f * 1.1]], fm: FM.e, fk: i ? 1.1 : 1, env: [[.04, 1], [.25, .7], [.4, .0001]], dur: .42, vol: .11, at: .05 + i * .12, h: true }); } },
    ooh: () => { if (sample('aww', .7, rand(.95, 1.05))) return; for (let i = 0; i < 4; i++) { const f = rand(190, 340); voice({ f: [[0, f * .92], [.2, f * 1.1], [.6, f * .82]], fm: FM.u, fk: rand(.92, 1.1), env: [[.12, 1], [.4, .8], [.65, .0001]], dur: .7, vol: .075, at: i * .05 + rand(0, .04), vib: [5, f * .025] }); } },
    thud: () => clip('assets/k_soft_heavy_1.ogg', .7),
  };
  function setAmbient(onOff) { if (onOff) { if (!amb) { amb = new Audio('assets/d_bar.mp3'); amb.loop = true; amb.volume = .22; } amb.play().catch(() => { }); } else amb?.pause(); }

  // ---------- montagem ----------
  function supported() { if (!window.THREE) return false; try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } }
  function mount(container, h) {
    H_ = h || H_; wrap = container;
    if (mounted) { if (canvas.parentNode !== wrap) wrap.prepend(canvas); resize(); return true; }
    if (!window.THREE) return false; T = window.THREE;
    try { renderer = new T.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' }); } catch { return false; }
    renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1)); renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    canvas = renderer.domElement; canvas.className = 'sn-gl'; wrap.prepend(canvas);
    scene = new T.Scene(); camera = new T.PerspectiveCamera(42, 1, .3, 320); ray = new T.Raycaster(); ptr = new T.Vector2(); tplane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    cam.eye = new T.Vector3(0, 30, 40); cam.look = new T.Vector3();
    envMap(); buildBalls(); bindInput();
    new ResizeObserver(resize).observe(wrap); resize(); mounted = true; return true;
  }
  function resize() {
    if (!renderer || !wrap) return;
    const w = wrap.clientWidth || 1, h = wrap.clientHeight || 1; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const vf = T.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect); cam.hf = hf;
    cam.baseDist = Math.max((W / 2 + 4) / Math.tan(hf / 2) * 1.05, (H / 2 + 4) / Math.tan(vf / 2) * 1.15);
  }
  function resetCam() { cam.az = 0; cam.el = 1.0; cam.zoom = 1; cam.tx = 0; cam.tz = 0; cam.moved = false; cam.yawOff = 0; cam.el1 = .55; }
  const orbitPos = (cx, cz, az, el, d) => new T.Vector3(cx + Math.sin(az) * Math.cos(el) * d, Math.max(1.2, Math.sin(el) * d), cz + Math.cos(az) * Math.cos(el) * d);
  function placeCamera(dt) {
    const k = 1 - Math.exp(-dt * 7), cue = balls[0], E = cam.eye, L = cam.look; let eye, look, sp = 2.5;
    if (cam.fp) {
      const shooting = opt.canShoot && !sim && !cue.in;
      if (shooting) { // atrás do taco: gira com a mira; o botão direito desloca em volta da branca (volta sozinho quando a mira mexe)
        const az = Math.atan2(-Math.cos(aim.ang), -Math.sin(aim.ang)) + cam.yawOff, pull = charging?.pull ? charging.p : 0, rx = -Math.sin(aim.ang) * .75, rz = Math.cos(aim.ang) * .75; // (rx, rz): um passo para a direita do taco
        eye = orbitPos(cue.x, cue.z, az, cam.el1, 9.5 + pull * 1.5); eye.x += rx; eye.z += rz; look = new T.Vector3(cue.x + Math.cos(aim.ang) * 4 + rx * .4, R, cue.z + Math.sin(aim.ang) * 4 + rz * .4); sp = 3;
      } else { // vista lateral acompanhando as bolas: enquadra todas as que estão andando
        const fd = cam.fd || cam.baseDist * .62; eye = orbitPos(cam.fx, cam.fz, cam.waz, cam.wel, fd); look = new T.Vector3(cam.fx, 0, cam.fz); sp = 1.6;
      }
    } else {
      cam.caz += (cam.az - cam.caz) * k; cam.cel += (cam.el - cam.cel) * k; cam.czoom += (cam.zoom - cam.czoom) * k; cam.ctx += (cam.tx - cam.ctx) * k; cam.ctz += (cam.tz - cam.ctz) * k;
      eye = orbitPos(cam.ctx, cam.ctz, cam.caz, cam.cel, cam.baseDist * cam.czoom); look = new T.Vector3(cam.ctx, 0, cam.ctz);
    }
    E.lerp(eye, Math.min(1, k * sp)); L.lerp(look, Math.min(1, k * sp)); camera.position.copy(E); camera.lookAt(L);
  }
  const orbit = (dx, dy) => { cam.az -= dx * .006; cam.el = Math.max(.18, Math.min(1.5, cam.el + dy * .005)); cam.moved = true; };
  const zoomBy = f => { cam.zoom = Math.max(.3, Math.min(1.8, cam.zoom * f)); cam.moved = true; };
  function show(onOff) { active = !!onOff && mounted; if (!mounted) return; canvas.style.display = active ? '' : 'none'; cancelAnimationFrame(raf); lastT = 0; if (active) { resize(); raf = requestAnimationFrame(loop); } else { setAmbient(false); if (cam.locked) document.exitPointerLock?.(); } }

  // ---------- entrada ----------
  function setPtr(e) { const r = canvas.getBoundingClientRect(); ptr.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ptr, camera); }
  function tablePoint(center) { if (center) ray.setFromCamera(new T.Vector2(0, 0), camera); const p = new T.Vector3(); return ray.ray.intersectPlane(tplane, p) ? { x: p.x / S, z: p.z / S } : null; }
  function aimAt(p) { const c = balls[0]; if (!p || c.in) return; const a = Math.atan2(p.z * S - c.z, p.x * S - c.x); if (Number.isFinite(a)) { aim.ang = a; H_.aim?.(aim); } }
  const onTable = p => p && Math.abs(p.x) <= K.W / 2 && Math.abs(p.z) <= K.H / 2;
  const HUD = 'button, input, select, textarea, a, label, [contenteditable], .modal, .sn-toss, .sn-ctl, .sn-tbar, .sn-cams'; // onde o clique é do botão, não da tacada
  function bindInput() {
    wrap.addEventListener('pointerdown', () => { ac()?.resume?.(); SFX.unlock?.(); loadSamples(); }, true);
    window.addEventListener('contextmenu', e => { if (e.target === canvas || (active && cam.fp)) e.preventDefault(); });
    canvas.addEventListener('dblclick', () => { if (!cam.fp) resetCam(); });
    window.addEventListener('wheel', e => { if (!active || (!cam.fp && e.target !== canvas)) return; e.preventDefault(); if (!cam.fp) zoomBy(Math.exp(e.deltaY * .0012)); else cam.el1 = Math.max(.12, Math.min(1.1, cam.el1 + e.deltaY * .0008)); }, { passive: false });
    document.addEventListener('pointerlockchange', () => { cam.locked = document.pointerLockElement === canvas; });
    const shooting = () => cam.fp && opt.canShoot && !sim && !balls[0].in;
    // em 1ª pessoa os eventos são da janela inteira: o cursor pode sair do canvas (sem pointer lock) que a mira e o clique continuam valendo
    window.addEventListener('pointermove', e => {
      if (!active) return; edge = e.clientX < 24 ? -1 : e.clientX > innerWidth - 24 ? 1 : 0;
      const mx = e.movementX ?? (drag ? e.clientX - drag.x : 0), my = e.movementY ?? (drag ? e.clientY - drag.y : 0);
      if (!cam.locked && e.target === canvas) setPtr(e);
      if (cam.fp) { // 1ª pessoa: o mouse mira; esquerdo segurado puxa o taco; direito segurado gira a câmera
        if (charging?.pull) { charging.p = Math.max(0, Math.min(1, charging.p + my * .0045)); aim.power = Math.max(.05, charging.p); H_.power?.(aim.power); if (rdrag) cam.yawOff -= mx * .006; else if (mx) { aim.ang += mx * .0024; H_.aim?.(aim); } }
        else if (rdrag) { if (shooting()) { cam.yawOff -= mx * .006; cam.el1 = Math.max(.12, Math.min(1.1, cam.el1 + my * .004)); } else { cam.waz -= mx * .006; cam.wel = Math.max(.2, Math.min(1.3, cam.wel + my * .004)); } }
        else if (shooting() && !tossMode) { if (mx) { aim.ang += mx * .0024; cam.yawOff *= Math.max(0, 1 - Math.abs(mx) * .04); H_.aim?.(aim); } if (my) cam.el1 = Math.max(.12, Math.min(1.2, cam.el1 - my * .003)); }
        else if (drag) { cam.waz -= mx * .006; cam.wel = Math.max(.2, Math.min(1.3, cam.wel + my * .004)); }
        if (drag) { drag.x = e.clientX; drag.y = e.clientY; }
        return;
      }
      if (drag) {
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
        if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 5) drag.moved = true;
        if (drag.moved) orbit(dx, dy);
        return;
      }
      if (e.target !== canvas) return;
      if (e.pointerType === 'mouse' && opt.canShoot && !charging && !tossMode && performance.now() > hoverT) aimAt(tablePoint());
      if (opt.inHand && opt.myTurn && !sim) placeAt = tablePoint();
      canvas.style.cursor = tossMode ? 'cell' : opt.inHand && opt.myTurn ? 'copy' : opt.canShoot ? 'crosshair' : 'move';
    });
    window.addEventListener('pointerdown', e => {
      if (!active) return;
      const onCanvas = e.target === canvas;
      if (cam.fp) {
        if (!onCanvas && e.target.closest?.(HUD)) return; // botões, chat e menus continuam deles
        if (onCanvas) setPtr(e); else e.preventDefault();
        if (e.pointerType === 'mouse' && !cam.locked) lock();
        if (e.button === 2) { rdrag = true; return; }
        if (e.button !== 0) return;
        if (tossMode) return doToss(tablePoint(true));
        if (opt.inHand && opt.myTurn && !sim && balls[0].in) { const p = tablePoint(true); if (p && K.inside(p.x, p.z)) H_.place?.(p.x, p.z); else H_.toast?.('Olhe para um ponto da mesa para colocar a branca.'); return; }
        if (shooting() && !charging) { charging = { pull: true, p: 0, from: aim.power }; aim.power = .05; return; }
        drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false }; return;
      }
      if (!onCanvas || e.button === 2) return;
      setPtr(e); drag = { sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch { }
    }, true);
    const up = e => {
      if (!active) return;
      if (e.button === 2 || (rdrag && e.pointerType !== 'mouse')) { rdrag = false; return; }
      if (charging?.pull) { const p = charging.p; charging = null; if (p > .06 && shooting()) H_.shoot?.(aim.ang, p); else { aim.power = .5; H_.power?.(.5); } return; }
      if (!drag) return; const d = drag; drag = null; if (!cam.locked && e.target === canvas) setPtr(e);
      if (d.moved) { hoverT = performance.now() + 400; return; }
      const p = tablePoint(cam.fp); if (!p) return;
      if (tossMode) return doToss(p);
      if (opt.inHand && opt.myTurn && !sim) { if (K.inside(p.x, p.z)) H_.place?.(p.x, p.z); else H_.toast?.('A bola branca tem que ficar dentro da mesa.'); return; }
      if (opt.canShoot && !charging && !cam.fp) aimAt(p);
    };
    window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', e => {
      if (!active || e.target?.matches?.('input, textarea')) return;
      if (e.code === 'KeyV') { toggleFP(); e.preventDefault(); return; }
      if (!opt.canShoot) return;
      const st = e.shiftKey ? .03 : .004;
      if (e.code === 'ArrowLeft') { aim.ang -= st; H_.aim?.(aim); e.preventDefault(); } else if (e.code === 'ArrowRight') { aim.ang += st; H_.aim?.(aim); e.preventDefault(); }
      else if (e.code === 'Space' && !e.repeat) { charge(true); e.preventDefault(); }
    });
    window.addEventListener('keyup', e => { if (active && e.code === 'Space' && charging && !charging.pull) charge(false); });
  }
  // prende o mouse (1ª pessoa); onde não dá (página embutida), fica o arrastar para olhar e o botão Tacar
  function lock() { try { const r = canvas.requestPointerLock?.(); r?.catch?.(() => { }); } catch { } }
  function doToss(p) { if (!onTable(p)) return H_.toast?.('Mira na mesa para jogar.'); const it = tossMode; tossMode = null; H_.toss?.(it, p.x, p.z); }
  // segurar carrega a força (a partir do valor do controle); soltar é a tacada
  function charge(onOff) {
    if (onOff) { if (!opt.canShoot || sim || charging) return; charging = { t0: performance.now(), from: aim.power }; return; }
    if (!charging) return; const p = aim.power; charging = null;
    if (!opt.canShoot || sim) return;
    H_.shoot?.(aim.ang, p);
  }
  const nudgeAim = d => { aim.ang += d; H_.aim?.(aim); };
  const setPower = p => { aim.power = Math.max(.05, Math.min(1, p)); };
  function toggleFP(v) {
    const want = v == null ? !cam.fp : !!v; if (want === cam.fp) return cam.fp;
    cam.fp = want; cam.yawOff = 0; cam.waz = -aim.ang; cam.wel = .5;
    if (!want && cam.locked) document.exitPointerLock?.();
    H_.view?.(cam.fp); return cam.fp;
  }
  const setTossMode = item => { tossMode = item && K.TOSS[item] ? item : null; return tossMode; };

  // ---------- estado ----------
  function snap(B) { for (const b of B) { const o = balls[b.n]; if (!o) continue; o.x = b.x * S; o.z = b.z * S; o.in = !!b.in; o.m.visible = o.sh.visible = !b.in; o.drop = 0; o.m.position.set(o.x, R, o.z); o.sh.position.set(o.x, .012, o.z); } }
  function sync(st, o) {
    opt = o || {};
    if (!mounted) return;
    if (st.cfg?.arena !== arena) buildEnv(st.cfg?.arena || 'bar');
    if (st.cfg?.pano !== cloth) buildTable(st.cfg?.pano || 'verde');
    if (st.toss && st.toss.n !== seenToss) { seenToss = st.toss.n; if (Room.now() < st.toss.land + 100) throwItem(st.toss); else { const f = { g: makeItem(st.toss.item), item: st.toss.item, end: new T.Vector3(st.toss.x * S, 0, st.toss.z * S), key: st.toss.n, ttl: st.toss.land + st.toss.ttl - Room.now() }; scene.add(f.g); land(f); } }
    if (!st.shot) { if (seenShot !== 0) { seenShot = 0; sim = null; snap(st.balls); } }
    else if (st.shot.n !== seenShot) {
      seenShot = st.shot.n; const sh = st.shot;
      if (Room.now() < sh.at + sh.dur - 300) { // ainda dá tempo: anima a jogada a partir das posições de antes
        snap(sh.from); sim = { B: K.launch(K.copy(sh.from), sh.kind === 'toss' ? { init: sh.init } : { ang: sh.ang, power: sh.power }), final: st.balls, obs: sh.obs || [], wait: sh.kind === 'toss' ? Math.max(0, sh.at - Room.now()) : 180 }; acc = 0;
        if (sh.kind !== 'toss') { strike = { t0: performance.now(), ang: sh.ang, power: sh.power, x: balls[0].x, z: balls[0].z, elev: cueElev(balls[0], sh.ang, 0) }; snd.cue(sh.power); cam.waz = -sh.ang + (Math.random() < .5 ? .5 : -.5); cam.wel = .5 + Math.random() * .15; cam.fx = balls[0].x; cam.fz = balls[0].z; cam.fd = cam.baseDist * .5; }
        if (!cam.moved) { cam.tx = 0; cam.tz = 0; }
      } else { sim = null; snap(st.balls); }
    } else if (!sim) snap(st.balls);
  }

  // ---------- quadro a quadro ----------
  function loop(t) {
    if (!active) return; raf = requestAnimationFrame(loop);
    const dt = Math.min(.05, lastT ? (t - lastT) / 1000 : .016); lastT = t; const now = performance.now();
    placeCamera(dt);
    for (const f of fans) f.rotation.y += dt * 2.2;
    for (const l of flick) l.intensity = 1.8 + Math.sin(now / 90) * .25 + Math.sin(now / 37) * .2;
    for (const m of mixers) m.update(dt);
    peopleStep(dt, now);
    if (edge && cam.fp && !cam.locked && opt.canShoot && !sim && !tossMode) { if (rdrag) cam.yawOff -= edge * dt * 1.2; else { aim.ang += edge * dt * .8; H_.aim?.(aim); } } // mouse encostado na borda: a mira continua girando
    if (charging && !charging.pull) { const k = Math.min(1, (now - charging.t0) / 1300); aim.power = Math.min(1, charging.from + (1 - charging.from) * k); H_.power?.(aim.power); }
    if (sim) {
      if (sim.wait > 0) sim.wait -= dt * 1000;
      else {
        acc = Math.min(.08, acc + dt); let moving = true, stepped = 0;
        while (acc >= K.DT && moving) { moving = K.step(sim.B, onEv, sim.obs); acc -= K.DT; stepped++; }
        for (const b of sim.B) { const o = balls[b.n]; if (!o || o.in) continue; move(o, b.x * S, b.z * S, (b.sx || 0) * S * stepped * K.DT, (b.sz || 0) * S * stepped * K.DT); }
        const mv = sim.B.filter(b => !b.in && (b.vx || b.vz)); if (mv.length) { let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const b of mv) { x0 = Math.min(x0, b.x); x1 = Math.max(x1, b.x); z0 = Math.min(z0, b.z); z1 = Math.max(z1, b.z); }
          const fx = (x0 + x1) / 2 * S, fz = (z0 + z1) / 2 * S, r = Math.hypot(x1 - x0, z1 - z0) / 2 * S + 3, fd = Math.max(cam.baseDist * .42, Math.min(cam.baseDist * .95, r / Math.tan((cam.hf || 1) / 2) * 1.15)), k = 1 - Math.exp(-dt * 2.5);
          cam.fx += (fx - cam.fx) * k; cam.fz += (fz - cam.fz) * k; cam.fd = (cam.fd || cam.baseDist * .62) + (fd - (cam.fd || cam.baseDist * .62)) * k; }
        if (!moving) { const fin = sim.final; sim = null; snap(fin); H_.settled?.(); }
      }
    }
    for (const n in balls) { const o = balls[n]; if (o.drop) { const k = Math.min(1, (now - o.drop) / 320); o.sh.visible = false; o.m.position.y = R - k * k * 2.2; o.m.scale.setScalar(1 - k * .3); if (k >= 1) { o.m.visible = false; o.m.scale.setScalar(1); o.drop = 0; } } }
    // coisas voando e os restos na mesa
    for (let i = flyers.length - 1; i >= 0; i--) { const f = flyers[i], k = Math.min(1, (now - f.t0) / f.dur); f.g.position.lerpVectors(f.start, f.end, k); f.g.position.y += Math.sin(Math.PI * k) * 9; f.g.rotation.x += f.spin.x * dt; f.g.rotation.z += f.spin.z * dt; if (k >= 1) { flyers.splice(i, 1); land(f); } }
    for (let i = remains.length - 1; i >= 0; i--) { const r = remains[i], left = r.until - now; if (left < 600) r.g.scale.setScalar(Math.max(.001, left / 600)); if (left <= 0) { scene.remove(r.g); dispose(r.g); remains.splice(i, 1); } }
    // taco e mira
    const c = balls[0], showCue = opt.canShoot && !sim && !c.in, ex = Math.cos(aim.ang), ez = Math.sin(aim.ang);
    if (strike) { const k = Math.min(1, (now - strike.t0) / 180); cueG.visible = k < 1; cueG.position.set(strike.x - ex * (2.5 - k * 2.5), R, strike.z - ez * (2.5 - k * 2.5)); cueG.rotation.set(0, -strike.ang, -strike.elev); if (k >= 1) strike = null; }
    else if (showCue) { const back = .3 + (charging ? (charging.pull ? charging.p * 4 : (aim.power - charging.from) * 3.5) : 0) + Math.sin(now / 900) * .04, el = cueElev(c, aim.ang, back); cueG.visible = true; cueG.position.set(c.x - ex * back, R + .05, c.z - ez * back); cueG.rotation.set(0, -aim.ang, -el); }
    else cueG.visible = false;
    if (cueParts) { const fp = cam.fp && showCue; cueParts.shaft.material.opacity = fp ? .85 : 1; cueParts.butt.visible = !fp; } // em 1ª pessoa o cabo perto da câmera não tampa a mesa
    if (handG) { handG.visible = cueG.visible && cam.fp; if (handG.visible) { const hx = strike ? strike.x : c.x, hz = strike ? strike.z : c.z, ha = strike ? strike.ang : aim.ang; handG.position.set(hx - Math.cos(ha) * 2.3, 0, hz - Math.sin(ha) * 2.3); handG.rotation.y = -ha; } }
    guide.visible = showCue;
    if (showCue) {
      const a = aimInfo(), y = R;
      const [L0, L1, L2, L3, , M1, M2] = guide.children, P = (x, z) => ({ x, y, z }), G = P(a.gx, a.gz);
      setLine(L0, P(c.x, c.z), G); ghost.position.set(a.gx, y, a.gz); ghost.visible = !!a.ball; M1.position.set(a.gx, .02, a.gz); M2.visible = !!a.ball; if (a.ball) M2.position.set(a.ball.x, .02, a.ball.z);
      if (a.ball) { // bola alvo segue a linha dos centros até a tabela (ou até outra bola); a branca desvia na tangente
        const b = a.ball, hb = castBall(b.x, b.z, a.nx, a.nz, [0, +Object.keys(balls).find(k => balls[k] === b)]), hw = castWall(b.x, b.z, a.nx, a.nz), t1 = Math.min(hb ? hb.t : 1e9, hw.t);
        setLine(L1, P(b.x, b.z), P(b.x + a.nx * t1, b.z + a.nz * t1));
        const dot = a.dx * a.nx + a.dz * a.nz, tx = a.dx - dot * a.nx, tz = a.dz - dot * a.nz, tl = Math.hypot(tx, tz);
        if (tl > .08) { const l2 = 1.5 + 5 * tl; setLine(L2, G, P(a.gx + tx / tl * l2, a.gz + tz / tl * l2)); } else setLine(L2, G, G);
        setLine(L3, G, G);
      } else { // sem bola na frente: mostra o rebote na tabela
        const w = a.w, rl = Math.hypot(w.rx, w.rz) || 1, hb = castBall(a.gx, a.gz, w.rx / rl, w.rz / rl, [0]), hw = castWall(a.gx, a.gz, w.rx / rl, w.rz / rl), t2 = Math.min(6, hb ? hb.t : 1e9, hw.t);
        setLine(L1, G, G); setLine(L2, G, G); setLine(L3, G, P(a.gx + w.rx / rl * t2, a.gz + w.rz / rl * t2));
      }
    }
    const ph = opt.inHand && opt.myTurn && !sim && placeAt; ghostCue.visible = !!ph;
    if (ph) { ghostCue.position.set(placeAt.x * S, R, placeAt.z * S); ghostCue.material.color.setHex(K.inside(placeAt.x, placeAt.z) ? 0xffffff : 0xff6060); }
    renderer.render(scene, camera);
  }
  function move(o, x, z, sx, sz) { // (sx, sz): quanto a superfície girou (vem do giro da física); sem isso gira pelo deslocamento
    const dx = sx ?? x - o.x, dz = sz ?? z - o.z, d = Math.hypot(dx, dz);
    if (d) o.m.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(dz / d, 0, -dx / d), d / R));
    o.x = x; o.z = z; o.m.position.set(x, R, z); o.sh.position.set(x, .012, z); o.m.visible = o.sh.visible = true;
  }
  function onEv(e) {
    if (e.t === 'hit') snd.hit(e.v); else if (e.t === 'wall') snd.wall(e.v); else if (e.t === 'obj') snd.obj(e.v, e.item);
    else if (e.t === 'pocket') { const o = balls[e.a]; if (o) { o.in = true; o.drop = performance.now(); } snd.pocket(); H_.pocket?.(e.a); }
  }
  // reação da mesa ao fim da jogada: 'good' (encaçapou), 'miss' (errou), 'foul' (falta: resmunga e os outros riem), 'win'
  function react(kind) { if (kind === 'good') { snd.cheer(); cheer(); } else if (kind === 'foul') { snd.groan(); setTimeout(() => snd.laugh(), 350); } else if (kind === 'miss') { if (Math.random() < .6) snd.ooh(); } else if (kind === 'win') { snd.cheer(); cheer(); sample('clap', .8, 1, .3); setTimeout(() => snd.cheer(), 900); } }
  return { supported, mount, show, sync, resetCam, charge, nudgeAim, setPower, toggleFP, setTossMode, setAmbient, react, ARENAS: Object.keys(ARENAS), get aim() { return aim; }, get busy() { return !!sim; }, get fp() { return cam.fp; }, get tossMode() { return tossMode; }, get active() { return active; }, get cam() { return cam; } };
})();
