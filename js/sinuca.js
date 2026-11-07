// ===== Sinuca — motor de regras e física (roda no anfitrião; a física também roda em cada tela, para animar a tacada) =====
// Regras (sinuca de bar, "par ou ímpar"):
// - 14 bolas (15 quando a 15 decide). No sorteio, um lado fica com as ÍMPARES (1, 3 … 13) e o outro com as PARES (2, 4 … 14); sorteia também quem abre.
// - Com 4 jogadores é em duplas (lugares 0+2 contra 1+3), cada um na sua vez. Com 3, o 1º e o 3º são dupla.
// - Encaçapou bola sua: ela vale o número em pontos e você continua. Encaçapou bola do outro: os pontos vão para ele e a bola fica fora.
// - Falta (branca na caçapa, não bater em nada, ou bater primeiro em bola que não é sua): 5 pontos para o adversário e ele joga com a branca na mão.
// - Vence quem encaçapa a última bola do seu lado (com a branca junto: derrota). Opção "a 15 decide": depois das suas, tem que encaçapar a 15 (antes da hora: derrota).
// - Modo Bola 8: lisas (1–7) contra listradas (9–15), a 8 fecha a partida (antes da hora: derrota).
// - Jogar coisa na mesa (garrafa, copo, sapato): no modo padrão é só pela graça; no modo gastação o que cai fica 15 s na mesa
//   atrapalhando as bolas (e derruba as que estiverem perto). Bola que cai na caçapa por causa disso volta para a mesa.
// A física é determinística (passo fixo, sem sorteio): a tela de cada um repete a tacada do anfitrião e chega nas mesmas posições.
const Sinuca = (() => {
  const W = 2.54, H = 1.27, R = .028575, DT = 1 / 240, MAX_T = 30, STOP = .012, MU = 1.5, ROLL = .28, DRAG = .09, E_WALL = .76, E_BALL = .96; // MU: atrito de deslizamento (m/s²); ROLL: resistência de rolamento
  const DRAW_MS = 4500, FOUL_PTS = 5, TURN_SEC = 45, TOSS_FLY = 800, TOSS_TTL = 15000, TOSS_GAP = 10000;
  // o que dá para jogar na mesa: raio do que fica na mesa, força com que empurra as bolas e se quebra
  const TOSS = { garrafa: { r: .07, v: 1.6, glass: true }, copo: { r: .05, v: 1.0, glass: true }, sapato: { r: .11, v: 2.2 }, cinzeiro: { r: .06, v: 1.4 } };
  // caçapas: centro (um pouco para fora do pano) e raio de captura
  const POCKETS = [[-W / 2 - .03, -H / 2 - .03, .082], [W / 2 + .03, -H / 2 - .03, .082], [-W / 2 - .03, H / 2 + .03, .082], [W / 2 + .03, H / 2 + .03, .082], [0, -H / 2 - .04, .07], [0, H / 2 + .04, .07]];
  const GROUPS = { parimpar: [[1, 3, 5, 7, 9, 11, 13], [2, 4, 6, 8, 10, 12, 14]], bola8: [[1, 2, 3, 4, 5, 6, 7], [9, 10, 11, 12, 13, 14, 15]] };
  const GROUP_NAMES = { parimpar: ['Ímpares', 'Pares'], bola8: ['Lisas', 'Listradas'] };
  const rnd = n => Math.floor(Math.random() * n);
  let nameOf = id => id;
  const log = (st, msg) => { st.log.push({ t: Date.now(), msg }); if (st.log.length > 160) st.log.shift(); };
  const ev = (st, e) => { st.ev = { n: (st.ev?.n || 0) + 1, ...e }; };
  const teamOf = (st, seat) => seat % 2;
  const sideName = (st, k) => { const ps = st.players.filter((_, s) => teamOf(st, s) === k); return ps.length > 1 ? `Dupla ${k + 1}` : nameOf(ps[0].id); };
  const groupOf = (st, k) => GROUPS[st.mode][st.sides[k]];
  const left = (balls, group) => balls.filter(b => !b.in && group.includes(b.n)).map(b => b.n);
  const inside = (x, z) => Math.abs(x) <= W / 2 - R && Math.abs(z) <= H / 2 - R;

  // ---------- física ----------
  // um passo de 1/240 s; onEv recebe { t: 'hit' | 'wall' | 'pocket', a, b, v }. Devolve se ainda tem bola andando.
  function step(B, onEv, obs) {
    let moving = false;
    const lx = W / 2 - R, lz = H / 2 - R;
    for (const b of B) {
      if (b.in || (!b.vx && !b.vz && !b.sx && !b.sz)) continue;
      if (b.sx === undefined) { b.sx = 0; b.sz = 0; } // s = velocidade da superfície pelo giro (rolando: s = v)
      const ux = b.vx - b.sx, uz = b.vz - b.sz, u = Math.hypot(ux, uz);
      if (u > .02) { // deslizando: o atrito freia a bola e acelera o giro (5/2) até casarem; é o que faz a branca seguir depois de uma batida cheia
        const f = Math.min(u / 3.5, MU * DT), fx = ux / u * f, fz = uz / u * f; b.vx -= fx; b.vz -= fz; b.sx += fx * 2.5; b.sz += fz * 2.5;
      } else { // rolando: resistência de rolamento + arrasto
        const v = Math.hypot(b.vx, b.vz), nv = Math.max(0, v - (ROLL + DRAG * v) * DT);
        if (nv < STOP) { b.vx = b.vz = b.sx = b.sz = 0; continue; }
        b.vx *= nv / v; b.vz *= nv / v; b.sx = b.vx; b.sz = b.vz;
      }
      b.x += b.vx * DT; b.z += b.vz * DT; moving = true;
      let near = false;
      for (let i = 0; i < 6; i++) {
        const p = POCKETS[i], d = Math.hypot(b.x - p[0], b.z - p[1]);
        if (d < p[2] || (d < p[2] + .035 && (Math.abs(b.x) > W / 2 + .02 || Math.abs(b.z) > H / 2 + .02))) { b.in = true; b.vx = b.vz = b.sx = b.sz = 0; b.x = p[0]; b.z = p[1]; onEv?.({ t: 'pocket', a: b.n, p: i }); near = true; break; }
        if (d < p[2] + .035) near = true; // na boca da caçapa não tem tabela
      }
      if (b.in || near) continue;
      if (obs) for (const o of obs) { // coisa jogada na mesa (modo gastação): a bola bate e volta
        const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz), m = o.r + R; if (d >= m || !d) continue;
        const nx = dx / d, nz = dz / d; b.x = o.x + nx * m; b.z = o.z + nz * m;
        const vn = b.vx * nx + b.vz * nz; if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vz -= 1.6 * vn * nz; onEv?.({ t: 'obj', a: b.n, v: -vn, item: o.item }); }
      }
      if (b.x < -lx && b.vx < 0) { b.x = -lx; b.vx = -b.vx * E_WALL; b.vz *= .9; b.sx *= .5; b.sz *= .8; onEv?.({ t: 'wall', a: b.n, v: Math.abs(b.vx) }); }
      else if (b.x > lx && b.vx > 0) { b.x = lx; b.vx = -b.vx * E_WALL; b.vz *= .9; b.sx *= .5; b.sz *= .8; onEv?.({ t: 'wall', a: b.n, v: Math.abs(b.vx) }); }
      if (b.z < -lz && b.vz < 0) { b.z = -lz; b.vz = -b.vz * E_WALL; b.vx *= .9; b.sz *= .5; b.sx *= .8; onEv?.({ t: 'wall', a: b.n, v: Math.abs(b.vz) }); }
      else if (b.z > lz && b.vz > 0) { b.z = lz; b.vz = -b.vz * E_WALL; b.vx *= .9; b.sz *= .5; b.sx *= .8; onEv?.({ t: 'wall', a: b.n, v: Math.abs(b.vz) }); }
    }
    for (let pass = 0, again = true; pass < 3 && again; pass++) { // até 3 passadas: no bolo da saída o impulso atravessa as bolas encostadas no mesmo passo
      again = false;
      for (let i = 0; i < B.length; i++) {
        const a = B[i]; if (a.in) continue;
        for (let j = i + 1; j < B.length; j++) {
          const b = B[j]; if (b.in) continue;
          const dx = b.x - a.x, dz = b.z - a.z, d2 = dx * dx + dz * dz; if (d2 >= 4 * R * R || !d2) continue;
          const d = Math.sqrt(d2), nx = dx / d, nz = dz / d, ov = (2 * R - d) / 2;
          a.x -= nx * ov; a.z -= nz * ov; b.x += nx * ov; b.z += nz * ov; // separa (senão grudam)
          const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz; if (rel <= 0) continue;
          const k = rel * (1 + E_BALL) / 2; a.vx -= k * nx; a.vz -= k * nz; b.vx += k * nx; b.vz += k * nz; moving = again = true;
          onEv?.({ t: 'hit', a: a.n, b: b.n, v: rel });
        }
      }
    }
    return moving;
  }
  const copy = B => B.map(b => ({ n: b.n, x: b.x, z: b.z, in: !!b.in, vx: 0, vz: 0 }));
  const speedOf = power => .5 + power * 6.5;
  // começo da jogada: tacada na branca ({ ang, power }) ou bolas empurradas por algo que caiu na mesa ({ init: [{ n, vx, vz }] })
  function launch(B, sh) {
    if (sh.init) { for (const i of sh.init) { const b = B.find(x => x.n === i.n); if (b) { b.vx = i.vx; b.vz = i.vz; } } return B; }
    const c = B[0], v = speedOf(sh.power); c.vx = Math.cos(sh.ang) * v; c.vz = Math.sin(sh.ang) * v; return B;
  }
  // jogada inteira: posições finais, o que caiu (em ordem), a primeira bola que a branca tocou e a duração
  function simulate(balls, ang, power, obs, init) {
    const B = launch(copy(balls), init ? { init } : { ang, power }), pocketed = [], events = []; let first = null, t = 0;
    const on = e => { if (e.t === 'pocket') pocketed.push(e.a); else if (e.t === 'hit' && first == null && (e.a === 0 || e.b === 0)) first = e.a || e.b; if (events.length < 400) events.push({ ...e, t2: t }); };
    for (let i = 0; i < MAX_T * 240; i++) { t += DT; if (!step(B, on, obs)) break; }
    return { balls: B.map(b => ({ n: b.n, x: b.x, z: b.z, in: b.in })), pocketed, first, dur: Math.round(t * 1000), events };
  }

  // ---------- partida ----------
  function rack(final) {
    const nums = []; for (let n = 1; n <= 15; n++) if (n !== final && n !== (final ? 0 : 15)) nums.push(n); // sem a 15 quando ela não decide
    for (let i = nums.length - 1; i > 0; i--) { const j = rnd(i + 1); [nums[i], nums[j]] = [nums[j], nums[i]]; }
    const B = [{ n: 0, x: -W / 4, z: 0, in: false }]; let i = 0;
    for (let r = 0; r < 5; r++) for (let c = 0; c <= r; c++) { // pirâmide; o meio da 3ª fileira é da bola decisiva (ou fica vazio, quando não tem)
      const mid = r === 2 && c === 1, n = mid ? final : nums[i++]; if (!n) continue;
      B.push({ n, x: W / 4 + r * R * Math.sqrt(3) * 1.002, z: (c - r / 2) * 2 * R * 1.002, in: false });
    }
    return B;
  }
  function newGame(room) {
    const ids = room.players.map(p => p.id).slice(0, 4), s = room.settings || {};
    const mode = s.snMode === 'bola8' ? 'bola8' : 'parimpar', final = mode === 'bola8' ? 8 : s.snFinal15 ? 15 : 0, g0 = rnd(2);
    const st = {
      gameId: 's' + Date.now().toString(36) + rnd(1e6).toString(36), mode, final, teams: ids.length > 2,
      players: ids.map(id => ({ id })), sides: [g0, 1 - g0], score: [0, 0], turn: rnd(ids.length), inHand: false, shotN: 0, animN: 0, shot: null, obs: [], toss: null, tossAt: {},
      turnMs: Math.min(TURN_SEC, Number(s.snTurn) || TURN_SEC) * 1000, cfg: { pano: String(s.snPano || 'verde'), arena: String(s.snArena || 'bar'), gastacao: !!s.snGastacao },
      balls: rack(final), phase: 'play', log: [], ev: { n: 0 }, result: null,
      stats: ids.map(() => ({ tacadas: 0, bolas: 0, pontos: 0, faltas: 0, deuBola: 0, jogou: 0 })),
    };
    log(st, `🎱 Começou a sinuca${mode === 'bola8' ? ' (bola 8)' : ''}${st.teams ? ' em duplas' : ''}!`);
    log(st, `🎲 Sorteio: ${sideName(st, 0)} fica com as ${GROUP_NAMES[mode][st.sides[0]].toLowerCase()} e ${sideName(st, 1)} com as ${GROUP_NAMES[mode][st.sides[1]].toLowerCase()}. ${nameOf(ids[st.turn])} abre.`);
    st.readyAt = Date.now() + DRAW_MS; st.deadline = st.readyAt + st.turnMs;
    ev(st, { type: 'draw', breaker: st.turn });
    return st;
  }
  function place(st, x, z) {
    x = +x; z = +z; if (!Number.isFinite(x) || !Number.isFinite(z) || !inside(x, z)) return 'A bola branca tem que ficar dentro da mesa.';
    if (st.balls.some(b => b.n && !b.in && Math.hypot(b.x - x, b.z - z) < 2 * R)) return 'Tem outra bola aí.';
    const c = st.balls[0]; c.x = x; c.z = z; c.in = false; return null;
  }
  // bola de volta à mesa: no ponto da pirâmide ou, se estiver ocupado, no lugar livre mais perto
  function respot(st, n) {
    const b = st.balls.find(x => x.n === n); if (!b) return;
    const free = (x, z) => inside(x, z) && !st.balls.some(o => o !== b && !o.in && Math.hypot(o.x - x, o.z - z) < 2.05 * R);
    for (let i = 0; i < 60; i++) { const x = W / 4 + Math.floor(i / 5) * 2.2 * R * (i % 2 ? 1 : -1), z = ((i % 5) - 2) * 2.2 * R; if (free(x, z)) { b.in = false; b.x = x; b.z = z; return; } }
  }
  const activeObs = (st, now) => (st.obs = (st.obs || []).filter(o => o.until > now));
  // o que aconteceu numa tacada (usado para valer a jogada e para o bot escolher a dele)
  function outcome(st, seat, from, r) {
    const k = teamOf(st, seat), g = groupOf(st, k), og = groupOf(st, 1 - k), had = left(from, g), theyHad = left(from, og);
    const own = r.pocketed.filter(n => g.includes(n)), theirs = r.pocketed.filter(n => og.includes(n)), cueIn = r.pocketed.includes(0), finalIn = !!st.final && r.pocketed.includes(st.final);
    const brk = st.shotN === 0;
    let foul = null;
    if (cueIn) foul = 'a branca caiu na caçapa';
    else if (r.first == null) foul = 'não bateu em nenhuma bola';
    else if (!brk && had.length && !g.includes(r.first)) foul = 'bateu primeiro em bola que não é sua';
    else if (!brk && !had.length && r.first !== st.final) foul = `bateu primeiro em outra bola em vez da ${st.final}`;
    let win = null, respot = false, why = '';
    if (finalIn) {
      if (brk) respot = true;
      else if (!had.length && !cueIn) { win = k; why = `encaçapou a ${st.final} e fechou a partida!`; }
      else { win = 1 - k; why = `encaçapou a ${st.final} antes da hora.`; }
    } else if (!st.final) {
      if (own.length && own.length === had.length) { if (cueIn) { win = 1 - k; why = 'encaçapou a última bola junto com a branca.'; } else { win = k; why = 'encaçapou a sua última bola!'; } }
      else if (theirs.length && theirs.length === theyHad.length) { win = 1 - k; why = 'encaçapou a última bola do adversário.'; }
    }
    return { k, own, theirs, cueIn, foul, win, why, respot, cleared: !!st.final && had.length && own.length === had.length, theyCleared: !!st.final && theyHad.length && theirs.length === theyHad.length };
  }
  function act(st, pid, a) {
    const seat = st.players.findIndex(p => p.id === pid); if (seat < 0) return 'Você não está jogando.';
    if (st.result) return 'A partida acabou.';
    if (Date.now() < st.readyAt - 250) return 'As bolas ainda estão rolando.';
    if (a.type === 'toss') return toss(st, seat, a);
    if (seat !== st.turn) return 'Não é a sua vez.';
    const cue = st.balls[0];
    if (a.type === 'place') { if (!st.inHand) return 'Você não está com a bola na mão.'; const e = place(st, a.x, a.z); if (e) return e; ev(st, { type: 'place', seat }); return null; }
    if (a.type !== 'shot') return 'Ação desconhecida.';
    if (st.inHand && (cue.in || Number.isFinite(+a.cx))) { if (!Number.isFinite(+a.cx)) return 'Coloque a bola branca na mesa primeiro.'; const e = place(st, a.cx, a.cz); if (e) return e; }
    const ang = +a.ang, power = Math.max(.05, Math.min(1, +a.power)); if (!Number.isFinite(ang) || !Number.isFinite(power)) return 'Tacada inválida.';
    const obs = activeObs(st, Date.now()).map(o => ({ x: o.x, z: o.z, r: o.r, item: o.item }));
    const from = st.balls.map(b => ({ ...b })), r = simulate(st.balls, ang, power, obs), o = outcome(st, seat, from, r), name = nameOf(pid), k = o.k, ok = 1 - k, S = st.stats[seat];
    st.balls = r.balls; st.shotN++; S.tacadas++;
    if (o.respot) { respot(st, st.final); log(st, `🎱 A ${st.final} caiu na saída: volta para a mesa.`); }
    for (const n of o.own) { st.score[k] += n; S.bolas++; S.pontos += n; }
    for (const n of o.theirs) { st.score[ok] += n; S.deuBola++; }
    if (o.own.length) log(st, `🎯 ${name} encaçapou a ${o.own.join(', a ')} (+${o.own.reduce((s, n) => s + n, 0)}).`);
    if (o.theirs.length) log(st, `😬 ${name} encaçapou a ${o.theirs.join(', a ')} do adversário (+${o.theirs.reduce((s, n) => s + n, 0)} para ${sideName(st, ok)}).`);
    if (o.cleared) log(st, `🔥 ${sideName(st, k)} limpou as suas: agora é só a ${st.final}.`);
    if (o.theyCleared) log(st, `🔥 ${sideName(st, ok)} ficou só com a ${st.final}.`);
    let why = '';
    if (o.win == null) {
      if (o.foul) { st.score[ok] += FOUL_PTS; S.faltas++; why = o.foul; log(st, `⚠️ Falta de ${name}: ${o.foul}. +${FOUL_PTS} para ${sideName(st, ok)} e bola na mão.`); st.inHand = true; st.turn = (st.turn + 1) % st.players.length; }
      else if (o.own.length) { st.inHand = false; log(st, `▶️ ${name} continua.`); }
      else { st.inHand = false; st.turn = (st.turn + 1) % st.players.length; log(st, `↪️ Vez de ${nameOf(st.players[st.turn].id)}.`); }
    }
    st.shot = { n: ++st.animN, seat, ang, power, from, obs, at: Date.now(), dur: r.dur, pocketed: r.pocketed, foul: !!o.foul, why, own: o.own, theirs: o.theirs, cueIn: o.cueIn };
    st.readyAt = st.shot.at + r.dur + 400; st.deadline = st.readyAt + st.turnMs;
    ev(st, { type: 'shot', seat, foul: !!o.foul, own: o.own.length, theirs: o.theirs.length, cueIn: o.cueIn });
    if (o.win != null) finish(st, o.win, seat, `${name} ${o.why}`);
    return null;
  }
  // jogar coisa na mesa: qualquer um da partida, a qualquer hora (menos com bola rolando), uma a cada 10 s por pessoa
  function toss(st, seat, a) {
    const it = TOSS[a.item], x = +a.x, z = +a.z, now = Date.now();
    if (!it || !Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > W / 2 || Math.abs(z) > H / 2) return 'Mira na mesa para jogar.';
    if (now - (st.tossAt[seat] || 0) < TOSS_GAP) return 'Calma, espera o caco assentar.';
    st.tossAt[seat] = now; st.stats[seat].jogou = (st.stats[seat].jogou || 0) + 1;
    const land = now + TOSS_FLY;
    st.toss = { n: (st.toss?.n || 0) + 1, seat, item: a.item, x, z, at: now, land, ttl: TOSS_TTL };
    log(st, `${it.glass ? '🍾' : '👟'} ${nameOf(st.players[seat].id)} jogou ${a.item === 'sapato' ? 'um sapato' : a.item === 'cinzeiro' ? 'um cinzeiro' : 'um' + (a.item === 'garrafa' ? 'a garrafa' : ' copo')} na mesa!`);
    ev(st, { type: 'toss', seat, item: a.item });
    if (!st.cfg.gastacao) return null;
    // gastação: o que cai empurra as bolas perto e fica 15 s na mesa atrapalhando
    const obs = activeObs(st, now).map(o => ({ x: o.x, z: o.z, r: o.r, item: o.item })), o = { x, z, r: it.r, item: a.item, until: land + TOSS_TTL };
    const init = st.balls.filter(b => !b.in && Math.hypot(b.x - x, b.z - z) < it.r + R + .03).map(b => { const dx = b.x - x, dz = b.z - z, d = Math.hypot(dx, dz) || .01; return { n: b.n, vx: dx / d * it.v, vz: dz / d * it.v }; });
    const from = st.balls.map(b => ({ ...b })), r = simulate(st.balls, 0, 0, [...obs, o], init);
    st.balls = r.balls; st.obs.push(o);
    for (const n of r.pocketed) { respot(st, n); log(st, `↩️ A ${n || 'branca'} caiu por causa da bagunça e volta para a mesa.`); }
    st.shot = { n: ++st.animN, kind: 'toss', seat, init, from, obs: [...obs, o], at: land, dur: r.dur, pocketed: r.pocketed };
    st.readyAt = land + r.dur + 300; if (st.deadline) st.deadline = Math.max(st.deadline, st.readyAt + 5000);
    return null;
  }
  function finish(st, k, seat, msg) {
    const ranking = st.players.map((p, s) => ({ id: p.id, worth: st.score[teamOf(st, s)] })).sort((a, b) => b.worth - a.worth);
    const ws = teamOf(st, seat) === k ? seat : st.players.findIndex((_, s) => teamOf(st, s) === k);
    st.result = { winner: st.players[ws].id, side: k, ranking, msg }; st.phase = 'done'; st.deadline = 0; st.inHand = false;
    log(st, `👑 ${msg} ${sideName(st, k)} venceu com ${st.score[k]} pontos!`);
  }
  // tempo esgotado: o anfitrião joga no lugar de quem está na vez
  function timeout(st) {
    if (!st.deadline || Date.now() < st.deadline - 50 || st.result) return false;
    const p = st.players[st.turn], a = botAction(st, p.id, true);
    return !!a && act(st, p.id, a) === null;
  }

  // ---------- bot ----------
  // caminho livre entre dois pontos (para a bola que vai rolar), ignorando as bolas em skip
  function clear(B, a, b, skip) {
    const dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz || 1e-9;
    for (const o of B) {
      if (o.in || skip.includes(o.n)) continue;
      const t = Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / L2)), px = a.x + dx * t, pz = a.z + dz * t;
      if (Math.hypot(o.x - px, o.z - pz) < 2 * R * .98) return false;
    }
    return true;
  }
  function candidates(B, targets) {
    const cue = B[0], out = [];
    for (const n of targets) {
      const t = B.find(b => b.n === n); if (!t || t.in) continue;
      for (const p of POCKETS) {
        const dx = t.x - p[0], dz = t.z - p[1], d = Math.hypot(dx, dz), gx = t.x + dx / d * 2 * R, gz = t.z + dz / d * 2 * R; // bola fantasma
        const ax = gx - cue.x, az = gz - cue.z, ad = Math.hypot(ax, az); if (ad < R) continue;
        const cut = -(ax * dx + az * dz) / (ad * d); if (cut < .2) continue; // corte impossível
        if (!clear(B, cue, { x: gx, z: gz }, [0, n]) || !clear(B, t, { x: p[0], z: p[1] }, [n, 0])) continue;
        out.push({ ang: Math.atan2(az, ax), power: Math.min(1, .14 + (ad + d / cut) * .2), score: cut * 2 - d - ad * .3 });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }
  function judge(st, seat, B, c) {
    const o = outcome(st, seat, B, simulate(B, c.ang, c.power, activeObs(st, Date.now()))), k = teamOf(st, seat);
    if (o.win === k) return 1000; if (o.win != null) return -1000;
    return o.own.length * 10 + o.own.reduce((s, n) => s + n, 0) * .1 - (o.foul ? 25 : 0) - o.theirs.length * 6 - (o.theyCleared ? 40 : 0);
  }
  // bola na mão: um lugar livre de onde dá para ver uma bola sua em linha com uma caçapa
  function bestSpot(B, targets) {
    const free = (x, z) => inside(x, z) && !B.some(b => b.n && !b.in && Math.hypot(b.x - x, b.z - z) < 2.4 * R);
    let best = null, bs = -1e9;
    for (const n of targets) {
      const t = B.find(b => b.n === n); if (!t || t.in) continue;
      for (const p of POCKETS) {
        const dx = t.x - p[0], dz = t.z - p[1], d = Math.hypot(dx, dz);
        for (const back of [.25, .4, .6]) {
          const x = t.x + dx / d * back, z = t.z + dz / d * back; if (!free(x, z)) continue;
          const B2 = B.map(b => b.n ? b : { ...b, x, z, in: false });
          if (!clear(B2, { x, z }, t, [0, n]) || !clear(B2, t, { x: p[0], z: p[1] }, [n, 0])) continue;
          const s = -d - back * .5; if (s > bs) { bs = s; best = { x, z }; }
        }
      }
    }
    if (best) return best;
    for (let i = 0; i < 400; i++) { const x = -W / 2 + R + (i % 20) * (W - 2 * R) / 19, z = -H / 2 + R + Math.floor(i / 20) * (H - 2 * R) / 19; if (free(x, z)) return { x, z }; }
    return { x: -W / 4, z: 0 };
  }
  function botAction(st, pid, lazy) {
    const seat = st.players.findIndex(p => p.id === pid); if (seat < 0 || st.result || seat !== st.turn) return null;
    const g = groupOf(st, teamOf(st, seat)), targets = left(st.balls, g).length ? left(st.balls, g) : st.final ? [st.final] : [];
    let B = st.balls, cx, cz;
    if (st.inHand) { const p = bestSpot(B, targets); cx = p.x; cz = p.z; B = B.map(b => b.n ? b : { ...b, x: cx, z: cz, in: false }); }
    const cue = B[0];
    if (st.shotN === 0) { const apex = B.slice(1).filter(b => !b.in).sort((a, b) => Math.hypot(a.x - cue.x, a.z - cue.z) - Math.hypot(b.x - cue.x, b.z - cue.z))[0]; return { type: 'shot', ang: Math.atan2(apex.z - cue.z, apex.x - cue.x) + (lazy ? 0 : (Math.random() - .5) * .02), power: .95 }; } // saída: pancada na pirâmide
    const cands = candidates(B, targets);
    let best = null, bs = -1e9;
    for (const c of cands.slice(0, lazy ? 4 : 8)) { const s = judge(st, seat, B, c); if (s > bs) { bs = s; best = c; } }
    if (!best || bs <= 0) { // segurança: encosta devagar na bola sua mais perto (de preferência com caminho livre)
      const safe = targets.map(n => B.find(b => b.n === n)).filter(t => t && !t.in).map(t => ({ t, d: Math.hypot(t.x - cue.x, t.z - cue.z), ok: clear(B, cue, t, [0, t.n]) })).sort((a, b) => (b.ok - a.ok) || (a.d - b.d))[0];
      if (safe) { const c = { ang: Math.atan2(safe.t.z - cue.z, safe.t.x - cue.x), power: Math.min(.6, .08 + safe.d * .12) }; const s = judge(st, seat, B, c); if (!best || s > bs) best = c; }
      if (!best) best = { ang: Math.random() * Math.PI * 2, power: .3 };
    }
    const jit = lazy ? 0 : (Math.random() - .5) * .014; // o bot erra um pouco
    return { type: 'shot', ang: best.ang + jit, power: best.power, ...(st.inHand ? { cx, cz } : {}) };
  }
  const botDelay = (a, st) => Math.max(0, (st?.readyAt || 0) - Date.now()) + 1200 + rnd(1500); // espera as bolas pararem na tela de todos

  return { W, H, R, DT, POCKETS, GROUPS, GROUP_NAMES, DRAW_MS, FOUL_PTS, TOSS, TOSS_FLY, TOSS_TTL, newGame, act, timeout, botAction, botDelay, step, simulate, launch, copy, speedOf, teamOf, groupOf, left, inside, maxSeats: () => 4, setNameResolver: f => (nameOf = f) };
})();
if (typeof module !== 'undefined') module.exports = Sinuca;
