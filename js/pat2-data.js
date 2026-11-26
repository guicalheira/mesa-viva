// Patrimônio 2.0 é um tabuleiro próprio. Nunca altera os dados da edição original.
(function (root) {
  const base = typeof module !== 'undefined' ? require('./pat-data.js') : root.PD;
  const copy = x => JSON.parse(JSON.stringify(x));
  const GROUPS = { ...copy(base.GROUPS),
    sul: { name: 'Rio Grande do Sul', c: '#778b2d', l: '#e9efcf', d: '#46571a' },
    portugal: { name: 'Santa Catarina', c: '#b7477d', l: '#f6dce9', d: '#74254c' },
    unico: { name: 'Balneário Camboriú · construção livre', c: '#24a99c', l: '#d4f4ef', d: '#10665e' },
    mundo: { name: 'Destinos de luxo do Brasil', c: '#7250c4', l: '#e8defb', d: '#40267f' },
  };
  const prop = (g, name, place, art, price, rent, house) => ({ k: 'prop', g, name, place, art, price, rent, house });
  const SQ = [];
  base.SQ.forEach((original, legacyIndex) => {
    if (legacyIndex === 4 || legacyIndex === 36) return; // imposto e Sorte mudam de lugar
    const q = { ...copy(original), legacyIndex };
    if (q.k === 'free') Object.assign(q, { k: 'shop', name: 'Lojinha', place: 'Gire por R$ 25.000', art: 'lojinha' });
    SQ.push(q);
    if (legacyIndex === 5) SQ.push(
      prop('sul', 'Porto Alegre', 'Orla do Guaíba, RS', 'santos', 50, [4, 19, 50, 115, 170, 200], 25),
      { ...copy(base.SQ[4]), legacyIndex: 4 },
      prop('sul', 'Gramado', 'Serra Gaúcha, RS', 'felicio', 55, [4, 21, 55, 125, 180, 210], 30),
      prop('sul', 'Canela', 'Catedral de Pedra, RS', 'campinas', 60, [5, 23, 60, 140, 185, 220], 35));
    if (legacyIndex === 15) SQ.push(
      prop('portugal', 'Florianópolis', 'Beira-Mar Norte, SC', 'paraty', 115, [11, 54, 138, 300, 350, 405], 70),
      { k: 'util', g: 'util', name: 'Usina Hidrelétrica', place: 'Belo Monte, PA', art: 'energia', price: 100 },
      prop('portugal', 'Jurerê Internacional', 'Florianópolis, SC', 'recife', 125, [13, 62, 152, 325, 380, 440], 90));
    if (legacyIndex === 29) SQ.push(
      prop('unico', 'Balneário Camboriú', 'Barra Sul, SC', 'paulista', 220, [26, 130, 340, 590, 700, 820], 190),
      { k: 'casino', g: 'neutro', name: 'Cassino Royale', place: 'Sem teto de aposta', art: 'cassino' },
      { k: 'mutirao', g: 'neutro', name: 'Imprevisto', art: 'imprevisto' });
    if (legacyIndex === 39) SQ.push(
      prop('mundo', 'Búzios', 'Armação dos Búzios, RJ', 'santos', 320, [50, 190, 490, 860, 1000, 1150], 270),
      { ...copy(base.SQ[36]), legacyIndex: 36 },
      prop('mundo', 'Leblon', 'Rio de Janeiro, RJ', 'paulista', 380, [60, 225, 560, 950, 1120, 1280], 300),
      prop('mundo', 'Itaim Bibi', 'São Paulo, SP', 'esplanada', 450, [75, 270, 650, 1080, 1270, 1450], 340));
  });
  const oldToNew = i => SQ.findIndex(q => q.legacyIndex === i);
  const CARDS = copy(base.CARDS);
  for (const deck of Object.values(CARDS)) {
    deck.forEach(c => { if (c.e.goto !== undefined) c.e.goto = oldToNew(c.e.goto); });
    deck.push({ t: 'Oferta relâmpago! Vá direto para a Lojinha. Não receba ao passar pelo Marco Zero.', e: { teleport: SQ.findIndex(q => q.k === 'shop') } });
  }
  // Instâncias recebem um uid na partida: duas cartas iguais continuam negociáveis separadamente.
  const ITEMS = [
    { id: 'rent25', name: 'Aluguel amigo', text: 'Pague 25% a menos em um aluguel. Use ao cair ou ative para a próxima cobrança.', kind: 'rent', factor: .75 },
    { id: 'rent50', name: 'Metade da conta', text: 'Pague 50% a menos em um aluguel. Use ao cair ou ative para a próxima cobrança.', kind: 'rent', factor: .5 },
    { id: 'rentfree', name: 'Hospedagem por conta', text: 'Não pague um aluguel. Use ao cair ou ative para a próxima cobrança.', kind: 'rent', factor: 0 },
    { id: 'buy25', name: 'Feirão de terrenos', text: 'Desconto de 25% na próxima compra de terreno sem dono, fora de leilão.', kind: 'buy', factor: .75 },
    { id: 'buy50', name: 'Negócio da China', text: 'Desconto de 50% na próxima compra de terreno sem dono, fora de leilão.', kind: 'buy', factor: .5 },
    { id: 'build50', name: 'Mutirão de obra', text: 'A próxima construção custa 50% a menos. Ainda precisa cumprir as regras do grupo.', kind: 'build', factor: .5 },
    { id: 'casino3', name: 'Cassino 3×', text: 'Triplique o prêmio da próxima aposta vencedora. A carta é consumida na aposta, mesmo se perder.', kind: 'casino', factor: 3 },
    { id: 'zero', name: 'De volta ao começo', text: 'Vá direto ao Marco Zero e receba R$ 130.000.', kind: 'move', target: 0, salary: true },
    { id: 'shop', name: 'Cliente VIP', text: 'Vá direto à Lojinha e tenha uma nova oportunidade de girar por R$ 25.000. Sem salário.', kind: 'move', target: SQ.findIndex(q => q.k === 'shop') },
    { id: 'rio', name: 'Partiu Copacabana', text: 'Vá direto ao Rio de Janeiro. Compra e aluguel valem normalmente. Sem salário.', kind: 'move', target: oldToNew(39) },
    { id: 'sp', name: 'Conexão Paulista', text: 'Vá direto a São Paulo. Compra e aluguel valem normalmente. Sem salário.', kind: 'move', target: oldToNew(29) },
    { id: 'miami', name: 'Viagem para Búzios', text: 'Vá direto a Búzios. Compra e aluguel valem normalmente. Sem salário.', kind: 'move', target: SQ.findIndex(q => q.name === 'Búzios') },
    { id: 'jailfree', name: 'Alvará de soltura', text: 'Saia da Delegacia de graça antes de lançar os dados.', kind: 'jail' },
    { id: 'cash50', name: 'Fundo de reserva', text: 'Receba R$ 50.000 do banco.', kind: 'cash', amount: 50 },
    { id: 'cash10', name: 'Troco de bolso', text: 'Receba R$ 10.000 do banco.', kind: 'cash', amount: 10 },
    { id: 'cash150', name: 'Bônus de investimento', text: 'Receba R$ 150.000 do banco.', kind: 'cash', amount: 150 },
    { id: 'cash200', name: 'Grande prêmio', text: 'Receba R$ 200.000 do banco.', kind: 'cash', amount: 200 },
    { id: 'freeplot', name: 'Terreno de presente', text: 'Ganhe o terreno sem dono mais barato do tabuleiro. Se não houver, receba R$ 50.000.', kind: 'freeplot' },
    { id: 'bcpermit', name: 'Alvará de Balneário', text: 'Permite uma construção em Balneário Camboriú. É consumido na obra.', kind: 'permit' },
    { id: 'cash5', name: 'Prêmio de consolação', text: 'Receba R$ 5.000 do banco.', kind: 'cash', amount: 5 },
    { id: 'fine50', name: 'Reparo inesperado', text: 'Pague R$ 50.000 ao banco.', kind: 'fine', amount: 50 },
  ];
  const RARITIES = { comum: { name: 'Comum', color: '#6384a0', chance: 55 }, raro: { name: 'Rara', color: '#3b7ee8', chance: 28 }, epico: { name: 'Épica', color: '#a458d6', chance: 13 }, lendario: { name: 'Lendária', color: '#e6a833', chance: 4 } };
  const rarity = { rent50:'raro', rentfree:'epico', buy50:'raro', build50:'raro', casino3:'epico', zero:'epico', rio:'raro', sp:'raro', miami:'raro', cash150:'epico', cash200:'lendario', freeplot:'lendario', bcpermit:'lendario', fine50:'comum' };
  ITEMS.forEach(c => { c.rarity = rarity[c.id] || 'comum'; c.art = `img/cards/${c.id}.svg`; });
  const data = { ...base, GROUPS, SQ, CARDS, ITEMS, RARITIES, edition: 2, title: 'Patrimônio 2.0', side: 13 };
  if (typeof module !== 'undefined') module.exports = data; else root.PD2 = data;
})(typeof window !== 'undefined' ? window : globalThis);
