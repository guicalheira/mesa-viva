# Mesa Viva — tabletop entre amigos

Mesa de jogos de tabuleiro no navegador, multiplayer P2P (WebRTC), sem servidor próprio.
Jogos: **Magnata**, de compra e venda de propriedades — leilões, níveis de construção (Terreno → Hotel), o upgrade único do Ateliê do Arquiteto, trocas e bots. **Ludo**. **Conjura**, de blefe e intriga na corte, com as cartas ilustradas com os amigos.

**Jogar:** https://guicalheira.github.io/mesa-viva/ — crie uma sala e mande o código de 5 letras para os amigos.

**Patrimônio 2.0** aceita de 2 a 8 jogadores e tem 52 casas. Os destinos adicionados são brasileiros: Porto Alegre, Gramado, Canela, Florianópolis, Jurerê Internacional, Balneário Camboriú, Búzios, Leblon e Itaim Bibi. Cada rua tem uma cor própria. Para construir em Balneário Camboriú, é preciso ser dono da propriedade e gastar um Alvará de Balneário por obra.

O cassino aceita aposta até o saldo inteiro. Vermelho e preto pagam 2×, número 30× e verde 40×. O resultado é sorteado entre 0 e 36; notícias podem aumentar o retorno das cores.

A **Lojinha** pode ser girada ao cair nela ou ao passar pelo Marco Zero, por R$ 25 mil. As cartas têm raridade Comum (55%), Rara (28%), Épica (13%) ou Lendária (4%); dentro de cada raridade, as cartas têm chances iguais. O catálogo fica disponível durante a partida. A abertura usa uma faixa de cartas com indicador central. Há cartas de R$ 5 mil, R$ 10 mil, R$ 50 mil, R$ 150 mil e R$ 200 mil, terreno barato sem dono grátis, passe de aluguel, alvará de construção em Balneário, descontos, viagens, Cassino 3× e multa. Cartas podem ser guardadas e negociadas.

Dados da nova edição: `js/pat2-data.js`; integração com a sala: `js/patrimonio2.js`. O motor e a apresentação são compartilhados por fábricas com dados separados. Validação: `node tests/patrimonio2.test.js`, `node tests/patrimonio.test.js` e `node prototipos/patrimonio/test_engine.js`.

- `index.html` + `style.css` + `js/` — código-fonte (abra via servidor local: `python -m http.server 8765`)
- `dist/mesa-viva.html` — versão em **arquivo único** (artes embutidas). Mande para os amigos ou hospede (GitHub Pages, Netlify, etc.)
- `assets/` — artes geradas no ComfyUI (Stability Matrix) com **Z-Image Turbo**
- `tools/gen_art.py` — regenera as artes (`python tools/gen_art.py --force nome`), usando o Python do ComfyUI
- `tools/build.py` — gera o `dist/` depois de editar o código

**Última!** — descarte de cartas para 2–10 jogadores. O anfitrião marca as regras no lobby: compras acumuladas em qualquer ordem (+2 e +4), comprar até servir, sequências crescentes da mesma cor, bloqueios acumulados de qualquer cor, organização manual da mão, bater a mão no 9, Troca de mão e multiplicadores ×2/×3. Por exemplo: +2, +4, ×2, ×3 deixam uma compra de **36 cartas** para o próximo.

Use **Jogar sequência** para marcar as cartas, **Jogar bloqueios** para juntar cartas Pula de qualquer cor e **Organizar** para mudar a ordem com setas; também é possível arrastar dentro da mão. A primeira carta de um grupo precisa servir na mesa. Dois bloqueios pulam os próximos dois jogadores no sentido atual. Na regra do 9, a mãozinha só aparece depois que o 9 está visível no topo da mesa: o último compra 2 cartas, ou 3 se for um 9 diretamente sobre outro. Cobrir o 9 com outra carta não abre nova batida. Quem não bater em 7 segundos recebe a penalidade. A carta Troca de mão troca todas as cartas com o jogador escolhido; se você a jogar como última carta, entrega uma mão vazia e o alvo vence. O arquivo distribuível inclui a mesa atual do Última, mantendo as regras na mesma versão.

## Arquitetura
| Arquivo | Papel |
|---|---|
| `js/data.js` | personagens, catálogo de jogos, tabuleiro e cartas do Magnata |
| `js/game.js` | motor de regras do Magnata + IA dos bots (roda só no anfitrião) |
| `js/fx.js` | sons sintetizados (WebAudio) e animações: dados 3D, peões, cartas, faixas, edifícios em pé no modo 3D |
| `js/board3d.js` | modo 3D em WebGL (Three.js): mesa, tabuleiro, peões, edifícios por nível, dados, cartas e marcadores modelados em código |
| `js/ludo.js` | Ludo: motor de regras, bots, painel lateral e tabuleiro CSS de reserva (sem WebGL) |
| `js/ludo3d.js` | Ludo em 3D (Three.js): mesa, tabuleiro em relevo, peões torneados e dado |
| `js/conjura.js` | Conjura: jogo de blefe e intriga (2–10 jogadores) — regras, contestações, bloqueios, variante Confessor e bots. Cada jogador recebe só a própria visão (cartas alheias escondidas) |
| `js/conjura-ui.js` | Conjura: mesa, cartas, painéis de ação/reação, carta de ajuda |
| `tools/gen_cards.py` | gera as artes das cartas do Conjura a partir de fotos (FLUX.2 Klein 4B no ComfyUI); as fotos originais ficam em `tools/fotos/`, fora do Git |
| `js/net.js` | P2P via PeerJS/WebRTC; se a rede não permitir conexão direta, cai sozinho para a reserva pelo servidor do PeerJS (porta 443, mensagens fatiadas) e, se preciso, para servidores MQTT públicos (EMQX/HiveMQ). Inclui o diagnóstico "Testar minha conexão" |
| `js/room.js` | lobby: entrada, prontos, bots, chat, sincronização do estado |
| `js/store.js` | login local (PBKDF2), perfil, ranking, export/import |
| `js/ui.js` | todas as telas |

Para adicionar um novo jogo: crie um motor como `Magnata` (`newGame`, `act`, `botAction`), adicione ao `GAME_LIBRARY` com `ready: true` e uma função de render em `ui.js`.

**Supremacia — Modo Rápido:** selecionado por padrão nas salas novas, com opção Clássico no lobby. As trocas globais valem 4, 6, 8, 10, 12, 15, 16, 17… soldados: depois de 15, sobem de um em um. Cada jogador só recebe carta ao conquistar um território que nunca foi seu; os territórios iniciais também entram nesse histórico. No máximo uma carta por turno. Os bônus continentais e de cinco cartas continuam valendo. A vitória acontece ao cumprir o objetivo secreto, sem teto de duração. O relógio por ação mantém o funcionamento anterior.

Há 14 novas missões com progresso visível apenas para o dono: expansão, blocos conectados, fortalezas, presença em vários continentes, rotas estratégicas e ofensivas em um turno. As metas de expansão consideram a distribuição inicial e todas exigem conquistas inéditas. O Modo Rápido usa esse novo baralho; o Clássico mistura as novas missões aos objetivos tradicionais. Partidas antigas mantêm suas regras e objetivos.

Sons de dado do Ludo (`assets/dice_*.ogg`): pacote *Casino Audio* da [Kenney](https://kenney.nl/assets/casino-audio), licença CC0.
Sons do soco na mesa e do feltro do Dominó 2 (`assets/k_*.ogg`): pacote *Impact Sounds* da [Kenney](https://kenney.nl/assets/impact-sounds), licença CC0.
Sons das pedras do Dominó 2 (`assets/d_*.mp3`): gravações reais do [Freesound](https://freesound.org), licença CC0 — [Domino pieces 1](https://freesound.org/s/329099/) e [Domino pieces hit](https://freesound.org/s/329098/) (Macif), [domino stone on the table](https://freesound.org/s/197867/) e [domino shuffle](https://freesound.org/s/197868/) (Millavsb), [domino_draw](https://freesound.org/s/705348/) (UnycodeAdmin). Ambiente do bar: [Crowded Bar - Ambient Loop](https://freesound.org/s/397569/) (gagehurley78). Vidro quebrando: [Bottle Smash](https://freesound.org/s/401619/) (Roxis_Boy) e [Breaking Glass #3](https://freesound.org/s/233605/) (abstraktgeneriert).
Fregueses do bar (`assets/npc/*.glb`): modelos animados do [Quaternius](https://quaternius.com) via [Poly Pizza](https://poly.pizza), domínio público (CC0) — Man, Man in Long Sleeves, Woman Casual, Woman in Tank Top, Woman in Dress.
