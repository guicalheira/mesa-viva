// Regras opcionais e interações entre cartas, privacidade e relógio.
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../js/ultima.js');
const card = (c, v, copy = 0) => U.CARDS.map((x, id) => ({ ...x, id })).filter(x => x.c === c && x.v === String(v))[copy].id;
const R = v => card('r', v), B = v => card('b', v), G = v => card('g', v);
const W4 = card('w', 'd4'), X2 = card('w', 'x2'), X3 = card('w', 'x3'), SW = card('w', 'swap');
const all = Object.fromEntries(U.RULE_LIST.map(([k]) => [k, true]));
const room = (n, rules = {}, bots = false) => ({ settings: { ulRules: rules, ulTurn: 30 }, players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, bot: bots, name: 'Pessoa ' + i })) });
function table(hands, top = R(5), rules = {}) {
  const st = U.newGame(room(hands.length, rules));
  st.players.forEach((p, i) => { p.hand = [...hands[i]]; p.said = false; });
  const used = new Set([top, ...hands.flat()]);
  Object.assign(st, { turn: 0, turnN: 1, phase: 'play', color: U.CARDS[top].c, pile: [top], deck: U.deckIds(st.rules).filter(id => !used.has(id)), pending: 0, exposed: null, slap: null, ev: [], log: [], busyUntil: 0 });
  return st;
}
const act = (st, i, a) => U.act(st, 'p' + i, a);
const play = (st, i, c, extra = {}) => act(st, i, { type: 'play', card: c, ...extra });
const total = st => st.deck.length + st.pile.length + st.players.reduce((s, p) => s + p.hand.length, 0);
function unchanged(st, fn) { const before = JSON.stringify(st); assert.equal(typeof fn(), 'string'); assert.equal(JSON.stringify(st), before); }
function clock(t) { const c = { now: Date.now() }; t.mock.method(Date, 'now', () => c.now); return c; }
function hit(st, i) { return act(st, i, { type: 'slap', token: st.slap.token }); }

test('cada carta opcional só entra no baralho com sua própria opção', () => {
  for (const enabled of [{}, { swapHands: true }, { x2: true }, { x3: true }, all]) {
    const st = U.newGame(room(4, enabled)), ids = [...st.deck, ...st.pile, ...st.players.flatMap(p => p.hand)];
    assert.equal(ids.length, 108 + (enabled.swapHands ? 4 : 0) + (enabled.x2 ? 2 : 0) + (enabled.x3 ? 2 : 0));
    assert.equal(new Set(ids).size, ids.length);
    for (const [v, key] of [['swap', 'swapHands'], ['x2', 'x2'], ['x3', 'x3']]) assert.equal(ids.some(id => U.CARDS[id].v === v), !!enabled[key]);
  }
});

test('+2 → +4 → +2 é acumulado, sem restrição de cor ou teto', () => {
  const st = table([[R('d2'), R(1)], [W4, B(1)], [G('d2'), G(1)], [R(2), B(2)]]);
  assert.equal(play(st, 0, R('d2')), null);
  assert.equal(play(st, 1, W4, { color: 'y' }), null);
  assert.equal(st.pending, 6);
  assert.equal(play(st, 2, G('d2')), null);
  assert.equal(st.players[3].hand.length, 10);
  assert.equal(st.pending, 0); assert.equal(st.turn, 0);
});

test('×2 e ×3 multiplicam o total, e +2 ainda pode responder depois deles', () => {
  const st = table([[R('d2'), R(1)], [W4, B(1)], [X2, G(1)], [X3, B(2)], [B('d2'), R(2)], [G(2), B(3)]], R(5), all);
  play(st, 0, R('d2')); play(st, 1, W4, { color: 'y' });
  assert.equal(play(st, 2, X2, { color: 'g' }), null); assert.equal(st.pending, 12);
  assert.equal(play(st, 3, X3, { color: 'b' }), null); assert.equal(st.pending, 36);
  assert.equal(play(st, 4, B('d2')), null);
  assert.equal(st.players[5].hand.length, 40); assert.equal(st.pending, 0);
});

test('multiplicador precisa de compra pendente e respeita sua opção', () => {
  const st = table([[X2, R(1)], [B(1), G(1)]], R(5), { x2: true });
  assert.equal(U.canPlay(st, X2), false);
  unchanged(st, () => play(st, 0, X2, { color: 'r' }));
  st.pending = 2; st.rules.x2 = false;
  unchanged(st, () => play(st, 0, X2, { color: 'r' }));
});

test('×2 funciona com acúmulo de +2/+4 desmarcado; comprar paga só a dívida', () => {
  const st = table([[R('d2'), R(1)], [X2, B(1)], [R(2), B(2)]], R(5), { stack: false, x2: true });
  play(st, 0, R('d2')); assert.equal(st.pending, 2);
  assert.equal(play(st, 1, X2, { color: 'b' }), null);
  assert.equal(st.players[2].hand.length, 6);
});

test('sequência descarta em uma vez, preserva ordem da mesa e avisa Última', () => {
  const st = table([[R(5), R(6), R(7), B(2)], [B(5), G(1)]], B(5), { sequence: true });
  assert.equal(act(st, 0, { type: 'play', cards: [R(5), R(6), R(7)], call: true }), null);
  assert.deepEqual(st.players[0].hand, [B(2)]);
  assert.deepEqual(st.pile.slice(-3), [R(5), R(6), R(7)]);
  assert.equal(st.color, 'r'); assert.equal(st.turn, 1); assert.equal(st.exposed, null);
  assert.equal(st.stats[0].played, 3); assert.equal(st.players[0].said, true);
});

test('sequências inválidas, desabilitadas ou após comprar não mudam o estado', () => {
  const st = table([[R(5), R(6), R(7), B(6), R('skip')], [G(2), B(2)]], B(5), { sequence: true });
  for (const cards of [[R(5), R(7)], [R(6), R(5)], [R(5), B(6)], [R(5), R(5)], [R(5), R('skip')], [R(6), R(7)]]) unchanged(st, () => act(st, 0, { type: 'play', cards }));
  st.rules.sequence = false;
  unchanged(st, () => act(st, 0, { type: 'play', cards: [R(5), R(6)] }));
  st.rules.sequence = true; st.phase = 'drawn'; st.drawn = R(5);
  unchanged(st, () => act(st, 0, { type: 'play', cards: [R(5), R(6)] }));
});

test('organizar fora da vez mantém cartas, exposição, relógio e privacidade', () => {
  const st = table([[R(7), G(1), B(2)], [B(5), G(2)]]), deadline = st.deadline;
  st.exposed = { p: 1, bots: true };
  assert.equal(act(st, 1, { type: 'reorder', cards: [G(2), B(5)] }), null);
  assert.deepEqual(st.players[1].hand, [G(2), B(5)]);
  assert.equal(st.deadline, deadline); assert.equal(st.exposed.p, 1); assert.equal(st.turn, 0);
  assert.deepEqual(U.viewFor(st, 'p0').players[1].hand, []);
  unchanged(st, () => act(st, 0, { type: 'reorder', cards: [R(7), R(7), B(2)] }));
  st.rules.manualOrder = false;
  unchanged(st, () => act(st, 0, { type: 'reorder', cards: st.players[0].hand }));
});

test('Troca de mão exige alvo válido, troca só as mãos e mantém o segredo', () => {
  const st = table([[SW, R(1), R(2)], [B(1), B(2), B(3), B(4)], [G(1), G(2)]], R(5), { swapHands: true });
  unchanged(st, () => play(st, 0, SW, { color: 'g' }));
  unchanged(st, () => play(st, 0, SW, { color: 'g', target: 'p0' }));
  assert.equal(play(st, 0, SW, { color: 'g', target: 'p1' }), null);
  assert.deepEqual(st.players[0].hand, [B(1), B(2), B(3), B(4)]); assert.deepEqual(st.players[1].hand, [R(1), R(2)]);
  assert.equal(st.color, 'g'); assert.equal(st.turn, 1);
  const view = U.viewFor(st, 'p2');
  assert.deepEqual(view.players[0].hand, []); assert.deepEqual(view.players[1].hand, []);
  assert.equal(view.log.find(e => e.t === 'swap').hand, undefined);
});

test('Troca como última carta entrega uma mão vazia ao alvo, que vence', () => {
  const st = table([[SW], [B(1), B(2)]], R(5), { swapHands: true });
  assert.equal(play(st, 0, SW, { color: 'b', target: 'p1' }), null);
  assert.equal(st.result.winner, 'p1'); assert.deepEqual(st.players[0].hand, [B(1), B(2)]);
});

test('um 9 pausa a partida, rejeita batida antecipada/duplicada e pune o último', t => {
  const c = clock(t), st = table([[R(9), R(1)], [B(1), B(2)], [G(1), G(2)]], R(5), { slap9: true });
  assert.equal(play(st, 0, R(9)), null); assert.equal(st.slap.penalty, 2); assert.equal(st.deadline, 0);
  assert.equal(U.nextDeadline(st), st.slap.deadline);
  unchanged(st, () => hit(st, 0));
  unchanged(st, () => act(st, 0, { type: 'draw' }));
  c.now = st.slap.opensAt + 10;
  assert.equal(hit(st, 0), null); unchanged(st, () => hit(st, 0));
  assert.equal(hit(st, 1), null); assert.equal(st.slap, null);
  assert.equal(st.players[2].hand.length, 4); assert.equal(st.turn, 1);
  assert.ok(st.deadline > c.now); assert.equal(st.exposed.p, 0);
});

test('cobrir o 9 com outra carta também dispara; dois 9 valem três cartas', t => {
  const c = clock(t);
  for (const [played, expected] of [[R(1), 2], [B(9), 3]]) {
    const st = table([[played, G(1)], [B(1), G(2)]], R(9), { slap9: true });
    assert.equal(play(st, 0, played), null); assert.equal(st.slap.penalty, expected);
    c.now = st.slap.opensAt + 1; assert.equal(hit(st, 0), null);
    assert.equal(st.players[1].hand.length, 2 + expected);
  }
});

test('um 9 na abertura e um 9 ao final de sequência também pedem batida', t => {
  const c = clock(t), st = table([[R(7), R(8), R(9), G(1)], [B(1), B(2)]], R(5), { sequence: true, slap9: true });
  assert.equal(act(st, 0, { type: 'play', cards: [R(7), R(8), R(9)] }), null);
  assert.equal(st.slap.penalty, 2); c.now = st.slap.opensAt + 1; hit(st, 0);
  let opening;
  for (let k = 0; k < 300 && !opening; k++) { const s = U.newGame(room(2, { slap9: true })); if (U.CARDS[s.pile[0]].v === '9') opening = s; }
  assert.ok(opening?.slap); assert.equal(opening.slap.actor, -1);
});

test('quem não bate até o prazo compra; turnos sem limite também têm prazo no 9', t => {
  const c = clock(t), st = table([[R(9), R(1)], [B(1), B(2)], [G(1), G(2)]], R(5), { slap9: true });
  st.turnSec = 0; play(st, 0, R(9)); c.now = st.slap.opensAt + 1; hit(st, 0);
  assert.equal(U.timeout(st), false);
  c.now = st.slap.deadline; assert.equal(U.timeout(st), true);
  assert.equal(st.slap, null); assert.equal(st.players[1].hand.length, 4); assert.equal(st.players[2].hand.length, 4); assert.equal(st.deadline, 0);
});

test('descartar o último 9 só ganha depois da batida, e perder a batida impede a vitória', t => {
  const c = clock(t);
  for (const first of [0, 1]) {
    const st = table([[R(9)], [B(1), B(2)]], R(5), { slap9: true });
    play(st, 0, R(9)); assert.equal(st.result, null); c.now = st.slap.opensAt + 1;
    hit(st, first);
    if (first === 0) assert.equal(st.result.winner, 'p0');
    else { assert.equal(st.result, null); assert.equal(st.players[0].hand.length, 2); assert.equal(st.turn, 1); }
  }
});

test('token antigo não bate numa rodada nova, e espectadores não participam', t => {
  const c = clock(t), st = table([[R(9), R(1)], [B(9), B(1)]], R(5), { slap9: true });
  play(st, 0, R(9)); c.now = st.slap.opensAt + 1; const token = st.slap.token; hit(st, 0);
  play(st, 1, B(9)); c.now = st.slap.opensAt + 1;
  unchanged(st, () => act(st, 0, { type: 'slap', token }));
  unchanged(st, () => U.act(st, 'espectador', { type: 'slap', token: st.slap.token }));
  assert.deepEqual(U.viewFor(st, 'p0').slap.botAt, []);
});

test('cobrir 9 com +2 só passa a dívida depois de resolver a batida', t => {
  const c = clock(t), st = table([[R('d2'), R(1)], [B('d2'), B(2)], [G(1), G(2)]], R(9), { slap9: true });
  st.deck = st.deck.filter(id => ![G(3), G(4)].includes(id)).concat([G(3), G(4)]);
  assert.equal(play(st, 0, R('d2')), null); assert.equal(st.pending, 0); assert.equal(st.turn, 0);
  c.now = st.slap.opensAt + 1; hit(st, 0); hit(st, 1);
  assert.equal(st.pending, 2); assert.equal(st.turn, 1); assert.equal(st.players[2].hand.length, 4);
  assert.equal(play(st, 1, B('d2')), null); assert.equal(st.pending, 0); assert.equal(st.players[2].hand.length, 8);
});

test('bot guarda carta recém-comprada com monte vazio para sair de ciclos', () => {
  const st = table([[R('rev'), G(1)], [B(1), G(2)]], B('rev'));
  st.phase = 'drawn'; st.drawn = R('rev'); st.deck = [];
  assert.deepEqual(U.botAction(st, 'p0'), { type: 'keep' });
  assert.equal(act(st, 0, U.botAction(st, 'p0')), null); assert.equal(st.turn, 1);
});

test('200 partidas completas com combinações das opções preservam todas as cartas', t => {
  const c = clock(t);
  let seed = 0x12345678;
  t.mock.method(Math, 'random', () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; });
  for (let g = 0; g < 200; g++) {
    const rules = Object.fromEntries(U.RULE_LIST.map(([key], k) => [key, g < 50 || !!(g & (1 << k))]));
    const st = U.newGame(room(2 + g % 9, rules, true)), expected = U.deckIds(st.rules).length;
    let k = 0;
    while (st.phase !== 'over' && k++ < 5000) {
      c.now = Math.max(c.now, st.busyUntil + 1);
      // A janela de bater tem prioridade sobre a vez de jogar.
      const ids = st.players.map(p => p.id), hitAction = st.slap && ids.map(id => [id, U.botAction(st, id)]).find(([, a]) => a);
      const id = hitAction ? hitAction[0] : st.players[st.turn].id, a = hitAction ? hitAction[1] : U.botAction(st, id);
      assert.ok(a, `sem jogada: partida ${g}`);
      assert.equal(U.act(st, id, a), null, JSON.stringify(a));
      assert.equal(total(st), expected);
      assert.equal(new Set([...st.deck, ...st.pile, ...st.players.flatMap(p => p.hand)]).size, expected);
    }
    assert.equal(st.phase, 'over', `partida ${g} não acabou: ${JSON.stringify({hands:st.players.map(p=>p.hand), slap:st.slap, exposed:st.exposed, log:st.log.slice(-10)})}`);
    assert.equal(st.result.ranking.length, st.players.length);
  }
});
