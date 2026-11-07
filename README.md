# Mesa Viva — tabletop entre amigos

Mesa de jogos de tabuleiro no navegador, multiplayer P2P (WebRTC), sem servidor próprio.
Jogos: **Sinuca** (3D, par ou ímpar, 1×1 ou duplas), **Magnata**, de compra e venda de propriedades — leilões, níveis de construção (Terreno → Hotel), o upgrade único do Ateliê do Arquiteto, trocas e bots. **Ludo**. **Conjura**, de blefe e intriga na corte, com as cartas ilustradas com os amigos.

**Jogar:** https://guicalheira.github.io/mesa-viva/ — crie uma sala e mande o código de 5 letras para os amigos.

- `index.html` + `style.css` + `js/` — código-fonte (abra via servidor local: `python -m http.server 8765`)
- `dist/mesa-viva.html` — versão em **arquivo único** (artes embutidas). Mande para os amigos ou hospede (GitHub Pages, Netlify, etc.)
- `assets/` — artes geradas no ComfyUI (Stability Matrix) com **Z-Image Turbo**
- `tools/gen_art.py` — regenera as artes (`python tools/gen_art.py --force nome`), usando o Python do ComfyUI
- `tools/build.py` — gera o `dist/` depois de editar o código

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
| `js/sinuca.js` | Sinuca: física determinística (passo fixo; a tela de cada um repete a tacada do anfitrião), regras de par ou ímpar / bola 8, pontos, faltas, bola na mão e bots que escolhem a tacada simulando |
| `js/sinuca-3d.js` | Sinuca em 3D (Three.js): bar (balcão, neon, luminária, fregueses), mesa com tabelas e caçapas, bolas, taco, mira, câmera orbital e atrás do taco, sons sintetizados |
| `js/sinuca-ui.js` | Sinuca: HUD sobre a mesa (placar, bolas que faltam, força e mira), painel lateral, regras e resultado |
| `js/net.js` | P2P via PeerJS/WebRTC; se a rede não permitir conexão direta, cai sozinho para a reserva pelo servidor do PeerJS (porta 443, mensagens fatiadas) e, se preciso, para servidores MQTT públicos (EMQX/HiveMQ). Inclui o diagnóstico "Testar minha conexão" |
| `js/room.js` | lobby: entrada, prontos, bots, chat, sincronização do estado |
| `js/store.js` | login local (PBKDF2), perfil, ranking, export/import |
| `js/ui.js` | todas as telas |

Para adicionar um novo jogo: crie um motor como `Magnata` (`newGame`, `act`, `botAction`), adicione ao `GAME_LIBRARY` com `ready: true` e uma função de render em `ui.js`.

Sons de dado do Ludo (`assets/dice_*.ogg`): pacote *Casino Audio* da [Kenney](https://kenney.nl/assets/casino-audio), licença CC0.
Sons do soco na mesa e do feltro do Dominó 2 (`assets/k_*.ogg`): pacote *Impact Sounds* da [Kenney](https://kenney.nl/assets/impact-sounds), licença CC0.
Sons das pedras do Dominó 2 (`assets/d_*.mp3`): gravações reais do [Freesound](https://freesound.org), licença CC0 — [Domino pieces 1](https://freesound.org/s/329099/) e [Domino pieces hit](https://freesound.org/s/329098/) (Macif), [domino stone on the table](https://freesound.org/s/197867/) e [domino shuffle](https://freesound.org/s/197868/) (Millavsb), [domino_draw](https://freesound.org/s/705348/) (UnycodeAdmin). Ambiente do bar: [Crowded Bar - Ambient Loop](https://freesound.org/s/397569/) (gagehurley78). Vidro quebrando: [Bottle Smash](https://freesound.org/s/401619/) (Roxis_Boy) e [Breaking Glass #3](https://freesound.org/s/233605/) (abstraktgeneriert).
Sons da Sinuca (`assets/sn_*.mp3`): gravações reais do [Freesound](https://freesound.org), licença CC0 — [Pool Ball Strike](https://freesound.org/s/763603/) (ChloePieterse), [billiard ball clack](https://freesound.org/s/539854/) (Za-Games), [pool ball hit](https://freesound.org/s/655629/) (Hankof), [pool ball falling](https://freesound.org/s/441857/) (Yarmonics), [Small applause](https://freesound.org/s/462362/) (Breviceps), [Small Audience Cheer](https://freesound.org/s/863035/) (Robo9418), [Group Laugh, Rude 2](https://freesound.org/s/870647/) (CHallSmith), [groan by adam](https://freesound.org/s/387153/) (seachangeau), [aww](https://freesound.org/s/124996/) (phmiller42), [3 Men Cheering](https://freesound.org/s/274510/) (jbeetle).
Fregueses do bar (`assets/npc/*.glb`): modelos animados do [Quaternius](https://quaternius.com) via [Poly Pizza](https://poly.pizza), domínio público (CC0) — Man, Man in Long Sleeves, Woman Casual, Woman in Tank Top, Woman in Dress.
