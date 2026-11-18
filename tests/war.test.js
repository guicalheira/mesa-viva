// Regressões do Supremacia: node --test tests/war.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function fixture() {
  const math = Object.create(Math), context = vm.createContext({ Math: math, Date });
  for (const file of ['war-map.js', 'war.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
  const War = vm.runInContext('War', context);
  const room = { players: Array.from({ length: 3 }, (_, i) => ({ id: 'p' + i, seat: i })), settings: { turnSec: 0 } };
  const st = War.newGame(room);
  Object.keys(st.owner).forEach((id, i) => { st.owner[id] = 'p' + i % 3; st.armies[id] = 20; });
  st.players.forEach(p => { p.obj = 0; p.cards = []; });
  st.owner.brasil = 'p0'; st.owner.venezuela = 'p1';
  st.turn = st.players.findIndex(p => p.id === 'p0'); st.phase = 'attack'; st.round = 2; st.evs = []; st.ev = { n: 0 };
  const roll = values => { let i = 0; math.random = () => ((values[i++ % values.length] || 1) - .5) / 6; };
  const attack = n => War.act(st, 'p0', { type: 'attack', from: 'brasil', to: 'venezuela', n });
  return { War, st, roll, attack };
}
const plain = data => JSON.parse(JSON.stringify(data));

function quickFixture() {
  const f = fixture(); f.st.mode = 'quick';
  f.st.players.forEach(p => { p.initialTerritories = f.War.owned(f.st, p.id); p.visited = [...p.initialTerritories]; });
  return f;
}

function conquer(f, to = 'venezuela') {
  f.st.armies.brasil = 12; f.st.armies[to] = 1; f.st.owner[to] = 'p1'; f.roll([6, 1]);
  assert.equal(f.War.act(f.st, 'p0', { type: 'attack', from: 'brasil', to, n: 1 }), null);
  assert.equal(f.War.act(f.st, 'p0', { type: 'occupy', n: 1 }), null);
}

test('Modo Rápido sobe as trocas de um em um após 15 e mantém os bônus existentes', () => {
  const { War, st } = quickFixture();
  assert.deepEqual(Array.from({ length: 10 }, (_, n) => War.tradeValue(n, 'quick')), [4, 6, 8, 10, 12, 15, 16, 17, 18, 19]);
  assert.equal(War.tradeValue(7), 25);
  assert.equal(War.tradeReward(6, [0, 3, 6], 'quick').total, 24);
  st.phase = 'place'; st.trades = 6; const p = st.players.find(p => p.id === 'p0'); p.cards = [0, 1, 2];
  const before = st.pool.free;
  assert.equal(War.act(st, 'p0', { type: 'trade', cards: p.cards.slice() }), null);
  assert.equal(st.pool.free, before + 16); assert.equal(st.trades, 7);
});

test('conquista inédita dá uma carta; reconquista não dá, mesmo após salvar e retomar', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0');
  conquer(f); assert.equal(f.st.conquered, true);
  assert.equal(f.War.act(f.st, 'p0', { type: 'endTurn' }), null); assert.equal(p.cards.length, 1);
  f.st = plain(f.st); f.st.turn = f.st.players.findIndex(p => p.id === 'p0'); f.st.phase = 'attack'; f.st.conquered = false;
  const resumed = f.st.players.find(p => p.id === 'p0');
  conquer(f); assert.equal(f.st.conquered, false);
  assert.equal(f.War.act(f.st, 'p0', { type: 'endTurn' }), null); assert.equal(resumed.cards.length, 1);
});

test('território inicial retomado não rende carta; uma conquista inédita posterior rende', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0');
  p.initialTerritories.push('venezuela'); p.visited.push('venezuela');
  conquer(f); assert.equal(f.st.conquered, false);
  p.visited = p.visited.filter(t => t !== 'peru'); p.initialTerritories = p.initialTerritories.filter(t => t !== 'peru');
  conquer(f, 'peru'); assert.equal(f.st.conquered, true);
  assert.equal(f.War.act(f.st, 'p0', { type: 'endTurn' }), null); assert.equal(p.cards.length, 1);
});

test('histórico é individual e várias conquistas novas rendem no máximo uma carta por turno', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0');
  f.st.players.find(p => p.id === 'p1').visited = Object.keys(f.st.owner);
  p.visited = p.visited.filter(t => t !== 'peru'); p.initialTerritories = p.initialTerritories.filter(t => t !== 'peru');
  conquer(f); conquer(f, 'peru');
  assert.equal(p.turnConquests, 2); assert.equal(f.st.conquered, true);
  assert.equal(f.War.act(f.st, 'p0', { type: 'endTurn' }), null); assert.equal(p.cards.length, 1);
});

test('Clássico continua dando carta por reconquista e estados antigos mantêm as regras', () => {
  const f = quickFixture(); delete f.st.mode;
  const p = f.st.players.find(p => p.id === 'p0'); p.visited.push('venezuela');
  conquer(f); assert.equal(f.st.conquered, true);
  assert.equal(f.War.act(f.st, 'p0', { type: 'endTurn' }), null); assert.equal(p.cards.length, 1);
});

test('novas missões são distintas, viáveis para 2 a 6 jogadores e nunca começam cumpridas', () => {
  const { War } = fixture();
  const missions = War.OBJECTIVES.filter(o => o.kind === 'mission'); assert.equal(missions.length, 14);
  for (const mode of ['quick', 'classic']) for (let count = 2; count <= 6; count++) {
    const st = War.newGame({ settings: { warMode: mode, turnSec: 0 }, players: Array.from({ length: count }, (_, i) => ({ id: 'p' + i, seat: i })) });
    assert.equal(st.turnMs, 0); assert.equal(st.matchDeadline, undefined, 'não existe teto de duração');
    assert.equal(new Set(st.players.map(p => p.obj)).size, count);
    for (const p of st.players) {
      if (mode === 'quick') assert.equal(War.OBJECTIVES[p.obj].kind, 'mission');
      for (const o of missions) {
        p.obj = o.id;
        assert.equal(War.achieved(st, p), false, `${count} jogadores: ${o.name}`);
        const effective = War.objectiveOf(st, p);
        assert.ok(effective.text.length > 20);
        assert.ok(effective.goals.every(g => Number.isFinite(g.n) && g.n > 0 && g.n <= 42));
        st.owner = Object.fromEntries(Object.keys(st.owner).map(t => [t, p.id]));
        st.armies = Object.fromEntries(Object.keys(st.armies).map(t => [t, 3]));
        p.visited = Object.keys(st.owner); p.turnConquests = 6;
        assert.equal(War.achieved(st, p), true, `missão possível: ${o.name}`);
        // Restaura uma distribuição inicial antes de experimentar a próxima missão.
        st.players.forEach(q => q.initialTerritories.forEach(t => { st.owner[t] = q.id; st.armies[t] = 1; }));
        p.visited = [...p.initialTerritories]; p.turnConquests = 0;
      }
    }
  }
});

test('missão de rota exige todos os territórios atuais e a ocupação concluída', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0'); p.obj = 19;
  p.visited = [...new Set([...p.initialTerritories, ...Object.keys(f.st.owner).filter(t => !p.initialTerritories.includes(t)).slice(0, 4)])];
  for (const t of ['brasil', 'argelia', 'portugal']) f.st.owner[t] = 'p0';
  assert.equal(f.War.achieved(f.st, p), true);
  f.st.occupy = { from: 'brasil', to: 'argelia', max: 1 }; assert.equal(f.War.achieved(f.st, p), false);
  f.st.occupy = null; f.st.owner.portugal = 'p1'; assert.equal(f.War.achieved(f.st, p), false);
});

test('blocos conectados não somam territórios isolados e fortalezas exigem guarnição', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0'); p.obj = 26;
  for (const t of Object.keys(f.st.owner)) { f.st.owner[t] = 'p1'; f.st.armies[t] = 1; }
  const chain = ['brasil', 'argelia', 'portugal', 'inglaterra', 'islandia', 'groenlandia', 'labrador'];
  chain.forEach(t => { f.st.owner[t] = 'p0'; f.st.armies[t] = 2; });
  p.visited = [...new Set([...p.initialTerritories, ...Object.keys(f.st.owner)])];
  assert.equal(f.War.achieved(f.st, p), true);
  f.st.armies.portugal = 1; assert.equal(f.War.achieved(f.st, p), false);
  f.st.armies.portugal = 2; f.st.owner.islandia = 'p1'; f.st.owner.japao = 'p0'; f.st.armies.japao = 2;
  assert.equal(f.War.objectiveProgress(f.st, p)[0].current, 4);
});

test('vitória das novas missões é reconhecida pelo motor e objetivos alheios seguem secretos', () => {
  const f = quickFixture(), p = f.st.players.find(p => p.id === 'p0'); p.obj = 19;
  p.visited = Object.keys(f.st.owner); ['brasil', 'argelia', 'portugal'].forEach(t => f.st.owner[t] = 'p0');
  assert.equal(f.War.act(f.st, 'p0', { type: 'endAttack' }), null);
  assert.equal(f.st.result.winner, 'p0'); assert.equal(f.st.result.obj, 19);
  const fresh = quickFixture(), enemy = fresh.War.viewFor(fresh.st, 'p0').players.find(p => p.id === 'p1');
  assert.equal(enemy.obj, null);
});

test('bases em três continentes exigem três territórios guarnecidos em cada um', () => {
  const { War, st } = quickFixture(), p = st.players.find(p => p.id === 'p0'); p.obj = 24;
  Object.keys(st.owner).forEach(t => { st.owner[t] = 'p1'; st.armies[t] = 2; });
  const bases = ['na', 'sa', 'eu'].flatMap(c => War.inCont[c].slice(0, 3));
  bases.forEach(t => st.owner[t] = 'p0'); p.visited = Object.keys(st.owner);
  assert.equal(War.achieved(st, p), true);
  st.armies[bases[0]] = 1; assert.equal(War.achieved(st, p), false);
  assert.equal(War.objectiveProgress(st, p)[0].current, 2);
});

test('ofensiva conta conquistas da mesma vez e zera na vez seguinte', () => {
  const { War, st } = quickFixture(), p = st.players.find(p => p.id === 'p0'); p.obj = 23;
  p.visited = Object.keys(st.owner); p.turnConquests = 2;
  assert.equal(War.achieved(st, p), false);
  p.turnConquests = 3; assert.equal(War.achieved(st, p), true);
  p.turnConquests = 2;
  for (let i = 0; i < st.players.length; i++) {
    st.phase = 'move'; assert.equal(War.act(st, st.players[st.turn].id, { type: 'endTurn' }), null);
  }
  assert.equal(p.turnConquests, 0); assert.equal(War.achieved(st, p), false);
});

test('cada comparação é contada, incluindo empates a favor da defesa', () => {
  const { st, roll, attack } = fixture();
  roll([6, 5, 2, 6, 3, 1]); assert.equal(attack(3), null);
  const attacker = st.players.find(p => p.id === 'p0'), defender = st.players.find(p => p.id === 'p1');
  assert.deepEqual(plain(attacker.battleStats), { attacks: 1, defenses: 0, diceWins: 2, diceLosses: 1, conquests: 0 });
  assert.deepEqual(plain(defender.battleStats), { attacks: 0, defenses: 1, diceWins: 1, diceLosses: 2, conquests: 0 });
  roll([1]); assert.equal(attack(3), null);
  assert.equal(attacker.battleStats.attacks, 2); assert.equal(attacker.battleStats.diceLosses, 4);
  assert.equal(defender.battleStats.defenses, 2); assert.equal(defender.battleStats.diceWins, 4);
});

test('uma batalha mantém seu resultado mesmo quando ataques posteriores já chegaram', () => {
  const { st, roll, attack } = fixture();
  roll([6, 5, 2, 6, 3, 1]); assert.equal(attack(3), null);
  const first = st.evs.find(e => e.type === 'battle'), snapshot = plain(first.after);
  assert.deepEqual(snapshot, { brasil: { owner: 'p0', armies: 19 }, venezuela: { owner: 'p1', armies: 18 } });
  roll([1]); for (let i = 0; i < 4; i++) assert.equal(attack(3), null);
  assert.deepEqual(plain(first.after), snapshot);
  assert.equal(st.armies.brasil, 7); assert.equal(first.after.brasil.armies, 19);
});

test('conquista e ocupação têm estados separados e a conquista é registrada uma vez', () => {
  const { st, roll, attack, War } = fixture(); st.armies.venezuela = 1;
  roll([6, 1]); assert.equal(attack(1), null);
  const battle = st.evs.find(e => e.type === 'battle');
  assert.deepEqual(plain(battle.after.venezuela), { owner: 'p0', armies: 0 });
  assert.equal(st.players.find(p => p.id === 'p0').battleStats.conquests, 1);
  assert.equal(War.act(st, 'p0', { type: 'occupy', n: 1 }), null);
  const occupy = st.evs.find(e => e.type === 'occupy');
  assert.equal(occupy.after.venezuela.armies, 1); assert.equal(battle.after.venezuela.armies, 0);
  assert.equal(st.players.find(p => p.id === 'p0').battleStats.attacks, 1);
});

test('ações recusadas não alteram o relatório', () => {
  const { st, attack } = fixture(); st.armies.brasil = 1;
  const before = JSON.stringify(st.players.map(p => p.battleStats));
  assert.equal(typeof attack(3), 'string');
  assert.equal(JSON.stringify(st.players.map(p => p.battleStats)), before);
});

test('relatório final guarda os totais de ataque e defesa de todos os jogadores', () => {
  const { st, War, roll, attack } = fixture();
  Object.keys(st.owner).forEach(id => st.owner[id] = 'p0');
  st.owner.venezuela = 'p1'; st.owner.mexico = 'p2'; st.armies.venezuela = 1;
  st.players.find(p => p.id === 'p0').obj = 6;
  roll([6, 1]); assert.equal(attack(1), null);
  assert.equal(st.result.winner, 'p0');
  const row = st.result.ranking.find(p => p.id === 'p0');
  assert.equal(row.battleStats.attacks, 1); assert.equal(row.battleStats.conquests, 1);
  assert.equal(st.result.ranking.find(p => p.id === 'p1').battleStats.diceLosses, 1);
  assert.equal(st.result.ranking.find(p => p.id === 'p2').battleStats.attacks, 0);
  st.players.find(p => p.id === 'p0').battleStats.attacks++;
  assert.equal(row.battleStats.attacks, 1, 'resultado não compartilha o objeto mutável de contadores');
  assert.equal(War.viewFor(st, 'p2').result.ranking.length, 3);
});

test('dados de animação não expõem cartas e objetivos de outros jogadores', () => {
  const { st, War, roll, attack } = fixture(); st.players.find(p => p.id === 'p1').cards = [4, 5];
  roll([6, 5, 2, 6, 3, 1]); assert.equal(attack(3), null);
  const view = War.viewFor(st, 'p0'), enemy = view.players.find(p => p.id === 'p1');
  assert.equal(enemy.obj, null); assert.deepEqual(plain(enemy.cards), []);
  for (const item of Object.values(view.evs[0].after)) assert.deepEqual(Object.keys(item).sort(), ['armies', 'owner']);
});

test('bots aguardam a apresentação da última batalha antes de agir novamente', () => {
  const { War, st, roll, attack } = fixture(); roll([1]); assert.equal(attack(3), null);
  assert.ok(War.botDelay({ type: 'attack' }, st) >= 3000);
  assert.ok(War.botDelay({ type: 'occupy' }, st) >= 3000);
  st.evs[0].at -= 10000;
  assert.equal(War.botDelay({ type: 'attack' }, st), 1500);
});

test('partidas antigas seguem funcionando e identificam contadores parciais', () => {
  const { st, roll, attack } = fixture(); st.players.forEach(p => delete p.battleStats);
  roll([1]); assert.equal(attack(3), null);
  assert.equal(st.statsPartial, true);
  assert.equal(st.players.find(p => p.id === 'p0').battleStats.diceLosses, 3);
});

function tradeFixture(cards, trades = 0) {
  const f = fixture();
  f.st.phase = 'place'; f.st.trades = trades; f.st.pool = { free: 3, cont: {} };
  f.st.players.find(p => p.id === 'p0').cards = cards.slice();
  return f;
}

test('três símbolos iguais do mesmo continente recebem 50% a mais na troca', () => {
  const { War } = fixture();
  for (const cards of [[0, 3, 6], [1, 4, 7], [2, 5, 8]]) {
    assert.deepEqual(plain(War.tradeReward(0, cards)), { base: 4, bonus: 2, total: 6, continent: 'na' });
  }
});

test('trios mistos, curingas e seleções incompletas não ativam o bônus continental', () => {
  const { War } = fixture();
  for (const cards of [[0, 3, 9], [0, 1, 2], [0, 3, 42], [0, 0, 0], [0, 3], [42, 43, 0], []]) {
    assert.deepEqual(plain(War.tradeReward(0, cards)), { base: 4, bonus: 0, total: 4, continent: null });
  }
});

test('bônus usa o valor atual da sequência de trocas e arredonda frações para baixo', () => {
  const { War } = fixture();
  assert.deepEqual(plain(War.tradeReward(5, [0, 3, 6])), { base: 15, bonus: 7, total: 22, continent: 'na' });
  assert.deepEqual(plain(War.tradeReward(6, [0, 3, 6])), { base: 20, bonus: 10, total: 30, continent: 'na' });
});

test('troca credita o total previsto e mantém os bônus de territórios próprios', () => {
  const { War, st } = tradeFixture([0, 3, 6]);
  const before = [0, 3, 6].map(id => { const t = War.CARDS[id].terr; st.owner[t] = 'p0'; return st.armies[t]; });
  const expected = War.tradeReward(st.trades, [0, 3, 6]);
  assert.equal(War.act(st, 'p0', { type: 'trade', cards: [0, 3, 6] }), null);
  assert.equal(st.pool.free, 3 + expected.total);
  [0, 3, 6].forEach((id, i) => assert.equal(st.armies[War.CARDS[id].terr], before[i] + 2));
  const event = st.evs.find(e => e.type === 'trade');
  assert.equal(event.value, 6); assert.equal(event.baseValue, 4); assert.equal(event.continentalBonus, 2); assert.equal(event.continent, 'na');
  assert.equal(st.trades, 1); assert.equal(st.players.find(p => p.id === 'p0').cards.length, 0);
  const snapshot = JSON.stringify(st);
  assert.equal(typeof War.act(st, 'p0', { type: 'trade', cards: [0, 3, 6] }), 'string');
  assert.equal(JSON.stringify(st), snapshot, 'cartas entregues não geram o bônus novamente');
});

test('troca normal mantém o valor quando só um dos requisitos do bônus é cumprido', () => {
  for (const cards of [[0, 3, 9], [0, 1, 2], [0, 3, 42]]) {
    const { War, st } = tradeFixture(cards);
    assert.equal(War.act(st, 'p0', { type: 'trade', cards }), null);
    assert.equal(st.pool.free, 7); assert.equal(st.evs.find(e => e.type === 'trade').continentalBonus, 0);
  }
});

test('bots consideram o bônus continental ao escolher suas três cartas', () => {
  const { War, st } = tradeFixture([0, 1, 2, 3, 6]);
  [0, 1, 2, 3, 6].forEach(id => st.owner[War.CARDS[id].terr] = 'p1');
  const action = War.botAction(st, 'p0');
  assert.equal(action.type, 'trade');
  assert.deepEqual(plain(action.cards).sort((a, b) => a - b), [0, 3, 6]);
});

test('cinco cartas do mesmo símbolo dobram o valor normal sem exigir continente', () => {
  const { War } = fixture(), cards = [0, 3, 6, 9, 12];
  assert.equal(War.validSet(cards), true);
  assert.ok(new Set(cards.map(id => War.contOf[War.CARDS[id].terr])).size > 1);
  assert.deepEqual(plain(War.tradeReward(0, cards)), { base: 4, bonus: 4, total: 8, continent: null });
  assert.deepEqual(plain(War.tradeReward(5, cards)), { base: 15, bonus: 15, total: 30, continent: null });
});

test('cinco símbolos misturados, curingas e cartas repetidas não dão troca dupla', () => {
  const { War } = fixture();
  for (const cards of [[0, 3, 6, 9, 13], [0, 3, 6, 9, 42], [0, 3, 6, 9, 0], [0, 3, 6, 9]]) {
    assert.equal(War.validSet(cards), false);
    assert.equal(War.tradeReward(0, cards).bonus, 0);
  }
  assert.equal(War.validSet([0, 3, 42]), true, 'curinga continua completando uma troca normal de três');
});

test('troca dupla consome cinco cartas, avança uma troca e preserva os bônus de território', () => {
  const cards = [0, 3, 6, 9, 12], { War, st } = tradeFixture(cards);
  cards.forEach(id => st.owner[War.CARDS[id].terr] = 'p0');
  const armies = cards.map(id => st.armies[War.CARDS[id].terr]);
  assert.equal(War.act(st, 'p0', { type: 'trade', cards }), null);
  assert.equal(st.pool.free, 11, 'três na reserva + oito da troca dupla');
  assert.equal(st.players.find(p => p.id === 'p0').cards.length, 0);
  assert.deepEqual(plain(st.used).slice(-5), cards); assert.equal(st.trades, 1);
  cards.forEach((id, i) => assert.equal(st.armies[War.CARDS[id].terr], armies[i] + 2));
  const event = st.evs.find(e => e.type === 'trade');
  assert.equal(event.value, 8); assert.equal(event.fiveCardBonus, 4);
  assert.equal(event.continentalBonus, 0, 'o bônus de três cartas não se acumula com o dobro');
  assert.equal(War.act(st, 'p0', { type: 'place', t: 'brasil', n: 1 }), null);
});

test('trocas inválidas de cinco cartas não consomem cartas nem soldados', () => {
  for (const cards of [[0, 3, 6, 9, 13], [0, 3, 6, 9, 42], [0, 3, 6, 9, 0]]) {
    const { War, st } = tradeFixture([...new Set(cards)]), before = JSON.stringify(st);
    assert.equal(typeof War.act(st, 'p0', { type: 'trade', cards }), 'string');
    assert.equal(JSON.stringify(st), before);
  }
});

test('bots escolhem um conjunto de cinco iguais mesmo com uma sexta carta na mão', () => {
  const { War, st } = tradeFixture([0, 3, 6, 9, 12, 1]);
  st.players.find(p => p.id === 'p0').cards.forEach(id => st.owner[War.CARDS[id].terr] = 'p1');
  const action = War.botAction(st, 'p0');
  assert.equal(action.type, 'trade'); assert.deepEqual(plain(action.cards).sort((a, b) => a - b), [0, 3, 6, 9, 12]);
  assert.equal(War.act(st, 'p0', action), null);
  assert.deepEqual(plain(st.players.find(p => p.id === 'p0').cards), [1]);
});
