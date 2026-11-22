// A segunda edição compartilha as regras gerais, com dados e estado independentes.
const Patrimonio2 = (() => {
  const data = typeof PD2 !== 'undefined' ? PD2 : require('./pat2-data.js');
  const base = typeof Engine !== 'undefined' ? Engine : require('./pat-engine.js');
  const bridge = typeof Patrimonio !== 'undefined' ? Patrimonio : require('./patrimonio.js');
  return bridge.createGame(base.createEngine(data), data);
})();
if (typeof module !== 'undefined') module.exports = Patrimonio2;
