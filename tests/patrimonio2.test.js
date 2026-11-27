// node tests/patrimonio2.test.js
const assert = require('assert');
const classic = require('../js/pat-data.js');
const classicSnapshot = JSON.stringify(classic);
const D = require('../js/pat2-data.js');
const E = require('../js/pat-engine.js').createEngine(D);
const P = require('../js/patrimonio2.js');
const sq = name => D.SQ.findIndex(q => q.name === name);
const game = (seed = 1) => E.newGame([{ name: 'Ana' }, { name: 'Bruno' }, { name: 'Caio' }], seed, { ...E.RULES, news: false, contracts: false });
const ok = (s, a, who = s.turn) => assert.strictEqual(E.act(s, who, a), null, JSON.stringify(a));
const add = (s, id, who = 0) => { const c = { uid: s.nextItemId++, id }; s.players[who].items.push(c); return c.uid; };
function arrive(target, setup = () => {}) {
  const s = game(73), probe = game(73); ok(probe, { type: 'roll' });
  s.players[0].pos = target - probe.dice[0] - probe.dice[1]; setup(s); ok(s, { type: 'roll' });
  assert.strictEqual(s.players[0].pos, target); return s;
}

assert.strictEqual(D.SQ.length, 52);
assert.deepStrictEqual([0, 13, 26, 39].map(i => D.SQ[i].k), ['go', 'jail', 'free', 'gotojail']);
assert.strictEqual(D.SQ[26].name, 'Patrocinador');
assert.ok(E.RULES.sponsor && E.RULES.shop);
assert.ok(!D.ITEMS.some(c => c.kind === 'fine'));
assert.strictEqual(E.itemDef('bcpermit').rarity, 'raro');
for (const id of ['rentfree', 'taxfree']) assert.strictEqual(E.itemDef(id).rarity, 'epico');
assert.deepStrictEqual(D.ITEMS.filter(c => c.rarity === 'lendario').map(c => c.id).sort(), ['buildfree', 'cash200', 'freeplot']);
assert.ok(D.ITEMS.filter(c => c.kind === 'move').every(c => Number.isInteger(c.steps) && c.steps && c.target === undefined));
assert.strictEqual(D.SQ.filter(q => q.k === 'casino').length, 2);
assert.strictEqual(D.SQ.filter(q => q.k === 'util').length, 3);
assert.deepStrictEqual(D.SQ.slice(sq('São Paulo') + 1, 39).map(q => q.k), ['prop', 'casino', 'mutirao']);
assert.deepStrictEqual(D.SQ.slice(5, 9).map(q => q.name), ['Porto Alegre', 'Imposto de Renda', 'Gramado', 'Canela']);
assert.deepStrictEqual(D.SQ.slice(19, 22).map(q => q.name), ['Florianópolis', 'Usina Hidrelétrica', 'Jurerê Internacional']);
assert.deepStrictEqual(D.SQ.slice(48).map(q => q.name), ['Búzios', 'Sorte', 'Leblon', 'Itaim Bibi']);
assert.ok(D.SQ.filter(q => q.g === 'mundo').every(q => q.price > 270));
assert.strictEqual(Object.values(D.RARITIES).reduce((n,r) => n+r.chance, 0), 100);
const streets = new Map();
for (const q of D.SQ.filter(q => q.k === 'prop')) {
  const color = D.GROUPS[q.g].c;
  if (streets.has(q.g)) assert.strictEqual(color, streets.get(q.g), `${q.name} precisa ter a cor do seu grupo`);
  else streets.set(q.g, color);
  assert.strictEqual(q.streetColor, undefined, `${q.name} não deve ter cor individual`);
}
assert.strictEqual(new Set(streets.values()).size, streets.size, 'cada grupo precisa ter cor própria');
assert.ok(D.SQ.filter(q => q.k === 'prop').every(q => !/Portugal|EUA|Emirados/.test(q.place)));
for (const item of D.ITEMS) assert.ok(require('fs').existsSync(require('path').join(__dirname, '../prototipos/patrimonio', item.art)));
{
  const s = game(73), probe = game(73); ok(probe, { type: 'roll' });
  s.players[0].pos = 52 - probe.dice[0] - probe.dice[1] + 1;
  ok(s, { type: 'roll' }); if (s.phase === 'buy') ok(s, { type: 'decline' }); assert.strictEqual(s.phase, 'shop');
  const cash = s.players[0].cash; ok(s, { type: 'shopskip' });
  assert.strictEqual(s.players[0].cash, cash); assert.notStrictEqual(s.phase, 'shop');
}
assert.strictEqual(JSON.stringify(classic), classicSnapshot);
{
  const s = game(); s.props[sq('Búzios')].owner = 1; s.props[sq('Leblon')].owner = 1;
  ok(s, { type: 'offer', to: 1, give: { cash: 10 }, want: { props: [sq('Búzios')] } });
  ok(s, { type: 'offer', to: 1, give: { cash: 20 }, want: { props: [sq('Leblon')] } });
  assert.strictEqual(s.offers.length, 2);
  const [first, second] = s.offers.map(o => o.id);
  ok(s, { type: 'reject', id: first }, 1);
  assert.deepStrictEqual(s.offers.map(o => o.id), [second]);
  ok(s, { type: 'accept', id: second }, 1);
  assert.strictEqual(s.props[sq('Leblon')].owner, 0);
  assert.strictEqual(s.offers.length, 0);
}
for (const g of Object.values(E.GROUP_OF)) {
  const costs = g.map(s => D.SQ[s].house).filter(Boolean);
  costs.forEach((cost, i) => assert.ok(!i || cost > costs[i - 1]));
}
for (const deck of Object.values(D.CARDS)) {
  assert.ok(!deck.some(c => c.e.teleport !== undefined));
  for (const c of deck) if (c.e.goto !== undefined) assert.ok(D.SQ[c.e.goto]);
}
assert.ok(D.CARDS.destino.some(c => /Salvador/.test(c.t) && c.e.goto === sq('Salvador')));
assert.ok(D.CARDS.destino.some(c => /Rio de Janeiro/.test(c.t) && c.e.goto === sq('Rio de Janeiro')));
// A edição original continua com 40 casas, Patrocinador, duas usinas e cassino clássico.
{
  const original = require('../js/pat-engine.js'), s = original.newGame([{ name: 'A' }, { name: 'B' }], 1, original.RULES);
  assert.strictEqual(classic.SQ.length, 40); assert.strictEqual(classic.SQ[20].name, 'Patrocinador');
  assert.strictEqual(original.GROUP_OF.util.length, 2); assert.strictEqual(original.maxBet(s, 0), 50);
  assert.strictEqual(original.colorPays(s, 'red'), 2); assert.strictEqual(original.colorPays(s, 'black'), 2);
  s.phase = 'casino'; s.casino = true; assert.ok(original.act(s, 0, { type: 'bet', game: 'roleta', pick: 'green', amount: 5 }));
}

// O grupo de uma única propriedade permite construir sem outras compras.
{
  const s = game(), b = sq('Balneário Camboriú'); s.props[b].owner = 0;
  assert.match(E.canBuild(s, 0, b), /Alvará/); add(s, 'bcpermit'); assert.strictEqual(E.canBuild(s, 0, b), null); ok(s, { type: 'build', sq: b });
  assert.strictEqual(s.props[b].h, 1); assert.ok(!s.players[0].items.some(c => c.id === 'bcpermit'));
  s.props[sq('Búzios')].owner = 0;
  assert.match(E.canBuild(s, 0, sq('Búzios')), /grupo inteiro/);
}
// Três usinas cobram 10×, inclusive ao chegar pela carta de Sorte.
{
  const s = game(), [a, b, c] = E.GROUP_OF.util;
  s.props[a].owner = 1; assert.strictEqual(E.rentOf(s, a, { total: 8 }), 24);
  s.props[b].owner = 1; assert.strictEqual(E.rentOf(s, a, { total: 8 }), 56);
  s.props[c].owner = 1; assert.strictEqual(E.rentOf(s, a, { total: 8 }), 80);
  assert.strictEqual(E.rentOf(s, a, { total: 8, utilMult: 7 }), 80);
  s.props[a].m = true; assert.strictEqual(E.rentOf(s, a, { total: 8 }), 0);
}
// Movimento usa 52 casas; salário só cruza o Marco Zero e a Delegacia está na 13.
{
  const s = game(73); s.players[0].pos = 39; ok(s, { type: 'roll' });
  assert.strictEqual(s.players[0].pos, 39 + s.dice[0] + s.dice[1]);
  assert.strictEqual(s.players[0].cash, 750);
  const t = game(73); t.players[0].pos = 51; ok(t, { type: 'roll' });
  assert.strictEqual(t.players[0].pos, (51 + t.dice[0] + t.dice[1]) % 52);
  assert.strictEqual(t.players[0].cash, 880);
  t.phase = 'blitz'; t.blitz = true; ok(t, { type: 'jailgo' });
  assert.strictEqual(t.players[0].pos, 13); assert.ok(t.players[0].jail);
}
// A casa física usa o patrocínio antigo; a Lojinha só abre ao cruzar o Marco Zero.
{
  const s = arrive(sq('Patrocinador'));
  assert.strictEqual(s.players[0].cash, 820); assert.notStrictEqual(s.phase, 'shop');
  const at = sq('Rio de Janeiro'), t = arrive(sq('Patrocinador'), s => { s.props[at].owner = 0; });
  assert.strictEqual(t.phase, 'sponsor'); const base = E.rentOf(t, at);
  ok(t, { type: 'sponsor', sq: at }); assert.strictEqual(E.rentOf(t, at), Math.round(base * 1.5));
  t.phase = 'sponsor'; t.sponsor = true; ok(t, { type: 'sponsor', sq: at }); assert.strictEqual(t.sp.lv, 2);
  t.turn = 1; t.phase = 'sponsor'; t.sponsor = true; t.props[sq('Búzios')].owner = 1;
  ok(t, { type: 'sponsor', sq: sq('Búzios') }); assert.strictEqual(t.sp.lv, 1); assert.strictEqual(E.rentOf(t, at), base);
}
// A chegada normal pelos dados abre os dois cassinos.
for (const name of ['Cassino', 'Cassino Royale']) assert.strictEqual(arrive(sq(name)).phase, 'casino');
// Sem teto de inventário: visitas sucessivas acumulam instâncias únicas, inclusive repetidas.
{
  const s = game(); s.players[0].cash = 10000;
  for (let k = 0; k < 60; k++) { s.phase = 'shop'; s.shop = true; ok(s, { type: 'shopspin' }); }
  assert.strictEqual(s.players[0].items.length, 60); assert.strictEqual(new Set(s.players[0].items.map(c => c.uid)).size, 60);
  assert.ok(new Set(s.players[0].items.map(c => c.id)).size < 60);
}
// Compra e obra consomem um desconto cada, sem acumular cartas do mesmo tipo.
{
  const s = game(), at = sq('Búzios'); s.buy = at; s.phase = 'buy';
  const first = add(s, 'buy50'), second = add(s, 'buy25');
  ok(s, { type: 'useitem', uid: first }); assert.strictEqual(E.buyPrice(s, at), 160);
  assert.ok(E.act(s, 0, { type: 'useitem', uid: second }));
  assert.ok(s.players[0].items.some(c => c.uid === second));
  ok(s, { type: 'buy' }); assert.strictEqual(s.players[0].cash, 590); assert.ok(!s.players[0].activeItems.buy);
  const b = sq('Balneário Camboriú'); s.props[b].owner = 0;
  ok(s, { type: 'useitem', uid: add(s, 'build50') });
  add(s, 'bcpermit'); const cost = E.buildCost(s, b); assert.strictEqual(cost, 95); ok(s, { type: 'build', sq: b });
  assert.strictEqual(E.buildCost(s, b), 190);
  const firstGroup = sq('Santarém'); s.props[firstGroup].owner = 0;
  ok(s, { type: 'useitem', uid: add(s, 'build50') }); ok(s, { type: 'pux', sq: firstGroup });
  assert.ok(!s.players[0].activeItems.build, 'puxadinho também consome o desconto da obra');
}
// Escolha de desconto acontece antes de debitar o aluguel; o dono recebe a conta reduzida.
for (const [id, expected] of [['rent25', 75], ['rent50', 50], ['rentfree', 0]]) {
  const s = game(); s.phase = 'rent'; s.pendingRent = { who: 0, owner: 1, sq: sq('Rio de Janeiro'), amount: 100 };
  ok(s, { type: 'useitem', uid: add(s, id) });
  assert.strictEqual(s.players[0].cash, 750 - expected);
  assert.strictEqual(s.players[1].cash, 750 + expected); assert.strictEqual(s.pendingRent, null);
}
// Percentuais preservam os reais: metade de 43 mil é 21,5 mil, não 22 mil.
{
  const s = arrive(sq('Rio de Janeiro'), s => { s.props[sq('Rio de Janeiro')].owner = 1; add(s, 'rent50'); });
  assert.strictEqual(s.phase, 'rent'); assert.strictEqual(s.players[0].cash, 750);
  ok(s, { type: 'useitem', uid: s.players[0].items[0].uid });
  assert.strictEqual(s.players[0].cash, 728.5); assert.strictEqual(s.players[1].cash, 771.5);
  assert.strictEqual(E.brl(21.5), 'R$ 21.500');
  const t = game(); t.phase = 'buy'; t.buy = sq('Gramado');
  ok(t, { type: 'useitem', uid: add(t, 'buy25') });
  assert.strictEqual(E.buyPrice(t, t.buy), 41.25); ok(t, { type: 'buy' });
  assert.strictEqual(t.players[0].cash, 708.75);
  assert.strictEqual(E.brl(41.25), 'R$ 41.250');
}
// A cobrança real das três usinas usa os dois dados extras e permite desconto na mesma conta.
{
  const s = arrive(sq('Usina Hidrelétrica'), s => { E.GROUP_OF.util.forEach(at => s.props[at].owner = 1); add(s, 'rent50'); });
  const dice = s.ev.find(e => e.t === 'dice' && e.extra), full = (dice.a + dice.b) * 10;
  assert.strictEqual(s.pendingRent.amount, full); ok(s, { type: 'useitem', uid: s.players[0].items[0].uid });
  assert.strictEqual(s.players[0].cash, 750 - full / 2);
}
// A carta pode ficar ativada até o próximo aluguel e desaparece uma vez só.
{
  const s = game(); ok(s, { type: 'useitem', uid: add(s, 'rent50') });
  s.pendingRent = { who: 0, owner: 1, sq: 1, amount: 100 }; s.phase = 'rent'; ok(s, { type: 'payrent' });
  assert.strictEqual(s.players[0].cash, 700); assert.ok(!s.players[0].activeItems.rent);
}
// Teto de 150 mil; verde paga 40×, número zero mantém 30×. Cassino 3× consome mesmo perdendo.
for (const [pick, boost, multiplier] of [['red', false, 2], ['black', false, 2], [17, false, 30], ['green', false, 40], [0, false, 30], ['red', true, 6], ['black', true, 6], [17, true, 90], ['green', true, 120]]) {
  let won = false;
  for (let seed = 0; seed < 300 && !won; seed++) {
    const s = game(seed); s.phase = 'casino'; s.casino = true; s.players[0].cash = 1000;
    if (boost) ok(s, { type: 'useitem', uid: add(s, 'casino3') });
    assert.strictEqual(E.maxBet(s, 0), 150);
    ok(s, { type: 'bet', game: 'roleta', pick, amount: 150 });
    assert.ok(!s.players[0].activeItems.casino);
    const result = s.ev.find(e => e.t === 'casinoResult');
    const spin = s.ev.find(e => e.t === 'casinoSpin');
    if (typeof pick === 'number' ? spin.num === pick : spin.color === pick) {
      assert.strictEqual(result.won, 150 * multiplier); assert.strictEqual(s.players[0].cash, 850 + result.won); won = true;
    } else assert.strictEqual(s.players[0].cash, 850);
  }
  assert.ok(won);
}
// Saldos abaixo do teto preservam frações de mil reais.
{
  let won = false;
  for (let seed = 0; seed < 100 && !won; seed++) {
    const s = game(seed); s.phase = 'casino'; s.casino = true; s.players[0].cash = 25.5;
    assert.strictEqual(E.maxBet(s, 0), 25.5); ok(s, { type: 'bet', game: 'roleta', pick: 'black', amount: 25.5 });
    const spin = s.ev.find(e => e.t === 'casinoSpin');
    if (spin.color === 'black') { assert.strictEqual(s.players[0].cash, 51); won = true; }
  }
  assert.ok(won);
}
// As manchetes continuam aumentando os pagamentos sem reduzir o preto abaixo de 3×.
{
  const s = game();
  for (const [title, red, black] of [['Noite de sorte', 3, 3], ['Noite de gala', 4, 4]]) {
    s.news = { cur: D.NEWS.findIndex(n => n.title === title) };
    assert.strictEqual(E.colorPays(s, 'red'), red); assert.strictEqual(E.colorPays(s, 'black'), black);
  }
}
{
  const s = game(); s.phase = 'casino'; s.casino = true; const before = JSON.stringify(s);
  for (const amount of [Infinity, NaN, -1, 150.001, 151, 10000]) { assert.ok(E.act(s, 0, { type: 'bet', game: 'roleta', pick: 'green', amount })); assert.strictEqual(JSON.stringify(s), before); }
}
// Cartas repetidas mantêm a identidade na troca, que pode incluir várias cartas dos dois lados.
{
  const s = game(), a = add(s, 'rent50'), b = add(s, 'rent50'), c = add(s, 'zero', 1);
  ok(s, { type: 'offer', to: 1, give: { items: [a] }, want: { cash: 25, items: [c] } });
  ok(s, { type: 'accept' }, 1);
  assert.deepStrictEqual(s.players[0].items.map(c => c.uid), [b, c]);
  assert.deepStrictEqual(s.players[1].items.map(c => c.uid), [a]);
  assert.strictEqual(s.players[0].cash, 775);
  ok(s, { type: 'offer', to: 1, give: { items: [b] }, want: { cash: 25 } });
  ok(s, { type: 'useitem', uid: b }); const money = s.players.map(p => p.cash);
  assert.ok(E.act(s, 1, { type: 'accept' })); assert.deepStrictEqual(s.players.map(p => p.cash), money);
  assert.ok(E.act(s, 0, { type: 'offer', to: 1, give: { items: [9999] } }));
}
// Movimento relativo resolve a chegada, abre a Lojinha ao avançar pelo início e respeita a prisão.
{
  const s = game(); s.players[0].pos = 50;
  ok(s, { type: 'useitem', uid: add(s, 'shop') }); assert.strictEqual(s.players[0].pos, 0); assert.strictEqual(s.phase, 'shop'); assert.strictEqual(s.players[0].cash, 880);
  ok(s, { type: 'shopspin' }); assert.strictEqual(s.players[0].cash, 855); assert.ok(E.act(s, 0, { type: 'shopspin' }));
  s.players[0].pos = 1;
  ok(s, { type: 'useitem', uid: add(s, 'zero') }); assert.strictEqual(s.players[0].pos, 50); assert.strictEqual(s.players[0].cash, 855); assert.strictEqual(s.buy, sq('Leblon'));
  ok(s, { type: 'decline' }); assert.notStrictEqual(s.phase, 'shop');
  s.phase = 'roll'; s.players[0].jail = true; s.players[0].pos = 13;
  assert.ok(E.act(s, 0, { type: 'useitem', uid: add(s, 'rio') }));
  ok(s, { type: 'useitem', uid: add(s, 'jailfree') }); assert.ok(!s.players[0].jail);
  ok(s, { type: 'useitem', uid: add(s, 'rio') }); assert.strictEqual(s.players[0].pos, 16); assert.strictEqual(s.buy, 16); assert.strictEqual(s.phase, 'buy');
  ok(s, { type: 'buy' }); assert.ok(E.canBuild(s, 0, 16));
  const t = game(); t.phase = 'post'; t.players[0].pos = sq('Patrocinador') - 5;
  ok(t, { type: 'useitem', uid: add(t, 'miami') }); assert.strictEqual(t.players[0].pos, sq('Patrocinador')); assert.strictEqual(t.players[0].cash, 820);
  const u = game(); u.players[0].pos = sq('Cassino') + 2;
  ok(u, { type: 'useitem', uid: add(u, 'sp') }); assert.strictEqual(u.players[0].pos, sq('Cassino')); assert.strictEqual(u.phase, 'casino');
}
// Lendárias: 500 mil, terreno escolhido e duas obras gratuitas com as restrições normais.
{
  const s = game(); ok(s, { type: 'useitem', uid: add(s, 'cash200') }); assert.strictEqual(s.players[0].cash, 1250);
  const uid = add(s, 'freeplot'), at = sq('Itaim Bibi'); s.props[sq('Leblon')].owner = 1;
  const before = JSON.stringify(s);
  for (const target of [undefined, -1, 999, sq('Leblon'), E.GROUP_OF.rail[0], E.GROUP_OF.util[0]]) {
    assert.ok(E.act(s, 0, { type: 'useitem', uid, sq: target })); assert.strictEqual(JSON.stringify(s), before);
  }
  s.phase = 'buy'; s.buy = at;
  ok(s, { type: 'useitem', uid, sq: at }); assert.strictEqual(s.props[at].owner, 0); assert.strictEqual(s.players[0].cash, 1250);
  assert.strictEqual(s.buy, null); assert.notStrictEqual(s.phase, 'buy'); assert.ok(!s.players[0].items.some(c => c.uid === uid));
  const spare = add(s, 'freeplot'); E.OWNABLE.filter(at => D.SQ[at].k === 'prop' && s.props[at].owner === null).forEach(at => { s.props[at].owner = 1; });
  assert.ok(E.act(s, 0, { type: 'useitem', uid: spare })); assert.ok(s.players[0].items.some(c => c.uid === spare));
}
{
  const s = game(), group = E.GROUP_OF.terra, b = sq('Balneário Camboriú');
  group.forEach(at => { s.props[at].owner = 0; }); s.players[0].cash = 0;
  ok(s, { type: 'useitem', uid: add(s, 'buildfree') }); assert.strictEqual(s.players[0].activeItems.build.remaining, 2);
  s.bank.houses = 0; assert.ok(E.act(s, 0, { type: 'build', sq: group[0] })); assert.strictEqual(s.players[0].activeItems.build.remaining, 2); s.bank.houses = 32;
  ok(s, { type: 'build', sq: group[0] }); assert.strictEqual(s.players[0].cash, 0); assert.strictEqual(s.players[0].activeItems.build.remaining, 1);
  assert.ok(E.act(s, 0, { type: 'build', sq: group[0] })); assert.strictEqual(s.players[0].activeItems.build.remaining, 1);
  ok(s, { type: 'build', sq: group[1] }); assert.strictEqual(s.players[0].cash, 0); assert.ok(!s.players[0].activeItems.build);
  assert.strictEqual(s.bank.houses, 30); assert.ok(E.act(s, 0, { type: 'build', sq: group[0] }));
  ok(s, { type: 'useitem', uid: add(s, 'buildfree') }); s.props[b].owner = 0;
  assert.match(E.canBuild(s, 0, b), /Alvará/); assert.strictEqual(s.players[0].activeItems.build.remaining, 2);
  add(s, 'bcpermit'); ok(s, { type: 'build', sq: b }); assert.strictEqual(s.props[b].h, 1); assert.strictEqual(s.players[0].activeItems.build.remaining, 1);
  assert.ok(!s.players[0].items.some(c => c.id === 'bcpermit'));
  const at = sq('Búzios'); s.props[at].owner = 0; ok(s, { type: 'pux', sq: at }); assert.ok(s.props[at].x); assert.ok(!s.players[0].activeItems.build); assert.strictEqual(s.players[0].cash, 0);
}
// Sonegação pode ser decidida na cobrança ou ativada para um único imposto futuro.
for (const use of [true, false]) {
  const s = arrive(sq('Imposto de Renda'), s => { add(s, 'taxfree'); });
  assert.strictEqual(s.phase, 'tax'); assert.strictEqual(s.players[0].cash, 750);
  const amount = s.pendingTaxes[0].amount, uid = s.players[0].items[0].uid;
  const other = add(s, 'cash50'), before = JSON.stringify(s);
  assert.ok(E.act(s, 0, { type: 'useitem', uid: other })); assert.strictEqual(JSON.stringify(s), before);
  ok(s, use ? { type: 'useitem', uid } : { type: 'paytax' });
  assert.strictEqual(s.players[0].cash, use ? 750 : 750 - amount); assert.strictEqual(s.pendingTaxes.length, 0);
  assert.strictEqual(s.players[0].items.some(c => c.uid === uid), !use); assert.ok(!s.players[0].activeItems.tax);
}
{
  const s = game(); ok(s, { type: 'useitem', uid: add(s, 'taxfree') });
  s.players[0].pos = sq('Imposto de Renda') - 2; ok(s, { type: 'useitem', uid: add(s, 'shop') });
  assert.strictEqual(s.players[0].cash, 750); assert.ok(!s.players[0].activeItems.tax); assert.notStrictEqual(s.phase, 'tax');
  s.players[0].pos = sq('Imposto de Renda') - 2; ok(s, { type: 'useitem', uid: add(s, 'shop') }); assert.strictEqual(s.players[0].cash, 637);
  const t = game(); ok(t, { type: 'useitem', uid: add(t, 'taxfree') }); t.news = { cur: D.NEWS.findIndex(n => n.e.tax === 0) };
  t.players[0].pos = sq('Imposto de Renda') - 2; ok(t, { type: 'useitem', uid: add(t, 'shop') }); assert.ok(t.players[0].activeItems.tax, 'imposto zerado não consome sonegação');
}
// A taxa de fortuna é resolvida antes da chegada, sem perder a cobrança nem a Lojinha.
{
  const s = game(); s.players[0].cash = 10000; s.players[0].pos = 51; add(s, 'taxfree');
  ok(s, { type: 'useitem', uid: add(s, 'miami') }); assert.strictEqual(s.phase, 'tax'); assert.strictEqual(s.pendingTaxes[0].why, 'taxa de fortuna');
  const wealth = s.pendingTaxes[0].amount;
  ok(s, { type: 'paytax' }); assert.strictEqual(s.players[0].cash, 10130 - wealth);
  if (s.phase === 'buy') ok(s, { type: 'decline' }); assert.strictEqual(s.phase, 'shop'); ok(s, { type: 'shopskip' });
  // Cruza o início e chega ao imposto de renda no mesmo movimento pelos dados.
  const t = game(73), probe = game(73); ok(probe, { type: 'roll' });
  t.players[0].cash = 10000; t.players[0].pos = 52 + sq('Imposto de Renda') - probe.dice[0] - probe.dice[1]; add(t, 'taxfree');
  ok(t, { type: 'roll' }); assert.strictEqual(t.phase, 'tax'); assert.strictEqual(t.pendingTaxes.length, 1);
  const wealthCharge = t.pendingTaxes[0].amount;
  ok(t, { type: 'paytax' }); assert.strictEqual(t.players[0].cash, 10130 - wealthCharge); assert.strictEqual(t.phase, 'tax');
  assert.strictEqual(t.pendingTaxes[0].amount, Math.ceil((10130 - wealthCharge) * .15));
  ok(t, { type: 'useitem', uid: t.players[0].items.find(c => c.id === 'taxfree').uid }); assert.strictEqual(t.players[0].cash, 10130 - wealthCharge); assert.strictEqual(t.phase, 'shop');
}
// Bots completam partidas na sala; timeout sabe sair das decisões novas.
let total = 0;
for (let n of [2, 4, 8]) {
  const room = { settings: { patRules: { limit: 20 } }, players: Array.from({ length: n }, (_, i) => ({ id: 'p' + i, name: 'P' + i, bot: true })) };
  const s = P.newGame(room, false);
  for (let k = 0; k < 30000 && s.phase !== 'over'; k++) {
    let played = false;
    for (const p of s.players) { const a = P.botAction(s, p.id); if (!a) continue; assert.strictEqual(P.act(s, p.id, a), null); played = true; total++; break; }
    if (!played) assert.ok(P.timeout(s), s.phase);
    assert.ok(s.players.every(p => Number.isFinite(p.cash) && p.pos >= 0 && p.pos < 52));
    const ids = s.players.flatMap(p => p.items.map(c => c.uid)); assert.strictEqual(new Set(ids).size, ids.length);
  }
  assert.strictEqual(s.phase, 'over'); assert.ok(s.result.winner);
}
{
  const s = P.newGame({ settings: {}, players: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] }, false);
  s.phase = 'shop'; s.shop = true; assert.deepStrictEqual(P.afkAction(s, s.players[s.turn].id), { type: 'shopskip' }); assert.ok(P.timeout(s));
  s.phase = 'rent'; s.pendingRent = { who: 0, owner: 1, sq: 1, amount: 10 }; assert.ok(P.timeout(s)); assert.strictEqual(s.pendingRent, null);
  s.phase = 'tax'; s.pendingTaxes = [{ who: 0, amount: 20, why: 'Imposto de Renda' }];
  assert.deepStrictEqual(P.afkAction(s, 'a'), { type: 'paytax' }); assert.ok(P.timeout(s)); assert.strictEqual(s.pendingTaxes.length, 0);
}
assert.strictEqual(JSON.stringify(classic), classicSnapshot);
console.log('ok: Patrimônio 2.0, regras, cartas, cassino e partidas completas;', total, 'ações de bots');
