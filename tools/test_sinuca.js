// Teste rápido do motor da sinuca (física, regras e bots): node tools/test_sinuca.js
const assert = require('assert');
const Sinuca = require('../js/sinuca.js');
const { W, H, R } = Sinuca;

// 1) física determinística: a mesma tacada dá o mesmo resultado
const B0 = [{ n: 0, x: -.6, z: 0, in: false }, { n: 1, x: .3, z: 0, in: false }, { n: 2, x: .2, z: .4, in: false }];
const r1 = Sinuca.simulate(B0, 0, .7), r2 = Sinuca.simulate(B0, 0, .7);
assert.deepStrictEqual(r1.balls, r2.balls, 'simulação não é determinística');
assert.strictEqual(r1.first, 1, 'a branca devia bater primeiro na 1');
assert.ok(r1.dur > 500 && r1.dur < 30000, 'duração estranha: ' + r1.dur);

// 2) bola em linha com a caçapa cai
const P = Sinuca.POCKETS[3]; // canto (+x, +z)
const ang = Math.atan2(P[1] - 0, P[0] - 0);
const B1 = [{ n: 0, x: 0, z: 0, in: false }, { n: 3, x: Math.cos(ang) * .3, z: Math.sin(ang) * .3, in: false }];
const r3 = Sinuca.simulate(B1, ang, .5);
assert.ok(r3.pocketed.includes(3), 'a 3 devia cair na caçapa: ' + JSON.stringify(r3.pocketed));
assert.ok(!r3.pocketed.includes(0), 'a branca não devia cair');

// 3) tabela: bola rebate e fica dentro da mesa
const r4 = Sinuca.simulate([{ n: 0, x: 0, z: 0, in: false }], 1.1, .6);
assert.ok(Math.abs(r4.balls[0].x) <= W / 2 - R + 1e-9 && Math.abs(r4.balls[0].z) <= H / 2 - R + 1e-9, 'saiu da mesa: ' + JSON.stringify(r4.balls) + '');

// 4) partida inteira entre bots termina com vencedor e placar coerente
Sinuca.setNameResolver(id => id);
for (const settings of [{}, { snFinal15: true }, { snMode: 'bola8' }]) {
  const room = { players: [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], settings };
  const st = Sinuca.newGame(room);
  assert.strictEqual(st.balls.length, settings.snFinal15 || settings.snMode === 'bola8' ? 16 : 15, 'bolas na mesa');
  assert.ok(st.balls.slice(1).every((b, i, A) => A.every((c, j) => i === j || Math.hypot(b.x - c.x, b.z - c.z) >= 2 * R - 1e-6)), 'pirâmide com bolas sobrepostas');
  let shots = 0;
  while (!st.result && shots < 400) {
    st.readyAt = 0; // no teste não espera a animação
    const pid = st.players[st.turn].id, a = Sinuca.botAction(st, pid, true);
    assert.ok(a, 'bot sem jogada');
    const err = Sinuca.act(st, pid, a); assert.strictEqual(err, null, 'erro do bot: ' + err);
    shots++;
  }
  assert.ok(st.result, 'partida não acabou em 400 tacadas');
  assert.ok(st.result.ranking.length === 4 && st.result.winner, 'resultado incompleto');
  console.log(`ok ${JSON.stringify(settings)}: ${shots} tacadas, placar ${st.score.join(' x ')}, venceu ${st.result.winner} (${st.result.msg})`);
}

// 5) regras: falta por não bater em nada dá bola na mão e passa a vez; a branca não pode ser posta em cima de outra bola
{
  const st = Sinuca.newGame({ players: [{ id: 'a' }, { id: 'b' }], settings: {} });
  st.readyAt = 0; st.balls = [{ n: 0, x: -.6, z: 0, in: false }, { n: 1, x: .9, z: .5, in: false }, { n: 2, x: .9, z: -.5, in: false }];
  const me = st.players[st.turn].id, other = st.players[1 - st.turn].id;
  assert.strictEqual(Sinuca.act(st, me, { type: 'shot', ang: Math.PI, power: .05 }), null);
  assert.ok(st.shot.foul && st.inHand && st.players[st.turn].id === other, 'falta devia dar bola na mão ao outro');
  assert.strictEqual(st.score[Sinuca.teamOf(st, st.turn)], Sinuca.FOUL_PTS, 'pontos da falta');
  st.readyAt = 0;
  assert.ok(Sinuca.act(st, other, { type: 'place', x: .9, z: .5 }), 'devia recusar bola em cima de outra');
  assert.strictEqual(Sinuca.act(st, other, { type: 'place', x: 0, z: 0 }), null);
  assert.ok(Sinuca.act(st, me, { type: 'shot', ang: 0, power: .5 }), 'não é a vez dele');
  console.log('ok regras');
}
console.log('tudo certo');

// 6) gastação: garrafa na mesa empurra as bolas perto, vira obstáculo por 15 s e a bola bate nela
{
  const st = Sinuca.newGame({ players: [{ id: 'a' }, { id: 'b' }], settings: { snGastacao: true } });
  st.readyAt = 0; st.balls = [{ n: 0, x: -.6, z: 0, in: false }, { n: 1, x: .3, z: 0, in: false }, { n: 2, x: .9, z: .4, in: false }];
  assert.strictEqual(Sinuca.act(st, 'b', { type: 'toss', item: 'garrafa', x: .3, z: .06 }), null);
  assert.ok(st.shot.kind === 'toss' && st.obs.length === 1 && st.balls[1].z < 0, 'a garrafa devia empurrar a 1');
  assert.ok(Sinuca.act(st, 'b', { type: 'toss', item: 'copo', x: 0, z: 0 }), 'devia respeitar o intervalo');
  const r = Sinuca.simulate([{ n: 0, x: -.6, z: .06, in: false }], 0, .3, [{ x: 0, z: .06, r: .07, item: 'garrafa' }]);
  assert.ok(r.balls[0].x < -.1 && r.events.some(e => e.t === 'obj'), 'a branca devia bater na garrafa e voltar');
  console.log('ok gastação');
}
