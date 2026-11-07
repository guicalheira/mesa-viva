// ===== Sinuca — HUD sobre a mesa 3D, painel lateral, regras e resultado =====
const SinucaUI = (() => {
  let reacted = 0, built = null, resultShown = null, logTab = 'log', timerIv = null, has3d = false, pending = false, pendingTo = 0, foulShown = 0, drawShown = null, bannerTo = 0, wasRolling = false;
  let ambOn = (() => { try { return localStorage.getItem('sn-amb') !== '0'; } catch { return true; } })();
  const act = a => Room.send({ t: 'act', a });
  const TEAM = ['#2f7de1', '#e0453a'];
  const COL = ['#f6f3ea', '#f2c21a', '#1f4fd1', '#d8261f', '#6a2a9c', '#f07a1a', '#1f8a3c', '#7a1f2b', '#141414'];
  const ballHTML = n => `<i class="sn-ball ${n > 8 ? 'stripe' : ''}" style="--bc:${COL[n > 8 ? n - 8 : n]}">${n}</i>`;
  const rp = (room, id) => room.players.find(p => p.id === id) || { name: id, char: 'vitoria' };
  const gname = st => Sinuca.GROUP_NAMES[st.mode];
  const sideName = (st, room, k) => { const ps = st.players.filter((_, s) => Sinuca.teamOf(st, s) === k); return ps.length > 1 ? `Dupla ${k + 1}` : rp(room, ps[0].id).name; };

  function build() {
    let el = $('#sn-table'); if (!el) { el = document.createElement('div'); el.id = 'sn-table'; $('#board-wrap').appendChild(el); }
    el.innerHTML = `<div class="sn-tbar"><i id="sn-timer"></i></div><div class="sn-turn"></div><div class="sn-team L"></div><div class="sn-team R"></div><div class="sn-banner"></div>
      <div class="sn-ctl"></div><div class="sn-hint"></div><div class="sn-cross"></div><div class="sn-toss"></div><div class="sn-cams"><button class="sn-cam" data-toss="1" title="Jogar alguma coisa na mesa">🍾</button><button class="sn-cam" data-cam="fp" title="Atrás do taco / 1ª pessoa (V): o mouse mira, segure o botão esquerdo e puxe para trás para carregar, solte para tacar; botão direito gira a câmera">🎯</button><button class="sn-cam" data-cam="reset" title="Centralizar a câmera (ou dois cliques na mesa)">🔄</button></div>`;
    has3d = Sinuca3D.supported() && Sinuca3D.mount(el, {
      shoot, place: (x, z) => act({ type: 'place', x, z }), toast: m => UI.toast(m),
      settled: () => { pending = false; const st = Room.room?.state, sh = st?.shot; if (sh && sh.kind !== 'toss' && reacted !== sh.n) { reacted = sh.n; Sinuca3D.react(st.result ? 'win' : sh.foul ? 'foul' : sh.own.length ? 'good' : 'miss'); } render(Room.room); },
      power: p => { const r = $('#sn-power'); if (r) r.value = Math.round(p * 100); },
      view: fp => { $('#sn-table [data-cam="fp"]')?.classList.toggle('on', fp); $('#sn-table')?.classList.toggle('fp', fp); render(Room.room); },
      toss: (item, x, z) => { act({ type: 'toss', item, x, z }); $('#sn-table .sn-toss')?.classList.remove('on'); render(Room.room); },
    });
    if (!has3d) el.insertAdjacentHTML('beforeend', '<div class="sn-nogl">Este navegador não tem WebGL: a mesa 3D não abre aqui. 😢</div>'); // shortcut: sem WebGL não dá para jogar (não tem mesa 2D de reserva); fazer uma se alguém precisar
    Sinuca3D.show(has3d); if (has3d) Sinuca3D.setAmbient(ambOn);
    $$('[data-cam]', el).forEach(b => (b.onclick = () => { if (b.dataset.cam === 'reset') Sinuca3D.resetCam(); else Sinuca3D.toggleFP(); }));
    // jogar coisa na mesa: escolhe o item e toca na mesa (em 1ª pessoa, onde a mira está)
    const TI = { garrafa: ['🍾', 'Garrafa'], copo: ['🥃', 'Copo'], sapato: ['👟', 'Sapato'], cinzeiro: ['🫙', 'Cinzeiro'] }, tp = $('.sn-toss', el);
    tp.innerHTML = Object.entries(TI).map(([k, [i, t]]) => `<button data-item="${k}"><span>${i}</span>${t}</button>`).join('');
    $('[data-toss]', el).onclick = () => { if (Sinuca3D.tossMode) { Sinuca3D.setTossMode(null); tp.classList.remove('on'); } else tp.classList.toggle('on'); render(Room.room); };
    $$('[data-item]', tp).forEach(b => (b.onclick = () => { Sinuca3D.setTossMode(b.dataset.item); tp.classList.remove('on'); render(Room.room); }));
  }
  function shoot(ang, power) {
    if (pending) return; pending = true; act({ type: 'shot', ang, power }); render(Room.room);
    clearTimeout(pendingTo); pendingTo = setTimeout(() => { if (pending) { pending = false; render(Room.room); } }, 3000); // tacada recusada: libera de novo
  }

  function render(room) {
    const st = room.state; if (!st) return; UI.show('scr-game');
    if (built !== st.gameId) { build(); built = st.gameId; resultShown = null; foulShown = 0; drawShown = null; pending = false; }
    const me = st.players.findIndex(p => p.id === Room.myId), now = Room.now(), rolling = now < st.readyAt || (has3d && Sinuca3D.busy);
    const myTurn = me >= 0 && st.turn === me && !st.result, cueIn = st.balls[0].in, canShoot = myTurn && !rolling && !pending && !(st.inHand && cueIn);
    wasRolling = rolling;
    hud(room, st, me, myTurn, rolling, canShoot);
    renderSide(room, st);
    if (has3d) Sinuca3D.sync(st, { mySeat: me, myTurn, inHand: myTurn && st.inHand && !rolling, canShoot, cueIn });
    if (st.ev?.type === 'draw' && drawShown !== st.gameId) { drawShown = st.gameId; banner(`🎲 Sorteio: <b style="color:${TEAM[0]}">${esc(sideName(st, room, 0))}</b> fica com as ${gname(st)[st.sides[0]].toLowerCase()}, <b style="color:${TEAM[1]}">${esc(sideName(st, room, 1))}</b> com as ${gname(st)[st.sides[1]].toLowerCase()}.<small>${esc(rp(room, st.players[st.turn].id).name)} abre a partida</small>`, Sinuca.DRAW_MS); }
    if (st.shot?.foul && !rolling && foulShown !== st.shot.n) { foulShown = st.shot.n; banner(`⚠️ Falta de ${esc(rp(room, st.players[st.shot.seat].id).name)}: ${esc(st.shot.why)}.<small>+${Sinuca.FOUL_PTS} pontos e bola na mão para o adversário</small>`, 3200); SFX.coinDown?.(); }
    clearInterval(timerIv); timerIv = setInterval(() => tick(Room.room?.state), 250); tick(st);
    if (st.result && resultShown !== st.gameId) { resultShown = st.gameId; UI.recordResult(st, room); setTimeout(() => { if (Room.room?.state?.gameId === st.gameId) showResult(Room.room, st); }, Math.max(0, st.readyAt - now) + 1800); }
  }
  function banner(html, ms) { const b = $('#sn-table .sn-banner'); if (!b) return; b.innerHTML = html; b.classList.add('on'); clearTimeout(bannerTo); bannerTo = setTimeout(() => b.classList.remove('on'), ms); }

  function hud(room, st, me, myTurn, rolling, canShoot) {
    const T_ = $('#sn-table'), cur = st.players[st.turn], k = Sinuca.teamOf(st, st.turn);
    $('.sn-turn', T_).innerHTML = st.result ? `🏆 ${esc(sideName(st, room, st.result.side))} venceu!` : `${UI.avatar(rp(room, cur.id), 28)}<b>${esc(rp(room, cur.id).name)}</b><small style="color:${TEAM[k]}">${gname(st)[st.sides[k]]}</small>${rolling ? '<em>bolas rolando…</em>' : st.inHand ? '<em>🖐️ bola na mão</em>' : ''}`;
    for (const kk of [0, 1]) {
      const el = $(kk ? '.sn-team.R' : '.sn-team.L', T_), ps = st.players.map((p, s) => ({ p, s })).filter(o => Sinuca.teamOf(st, o.s) === kk), leftB = Sinuca.left(st.balls, Sinuca.groupOf(st, kk)), fin = !!st.final && st.balls.some(b => b.n === st.final && !b.in);
      el.classList.toggle('turn', k === kk && !st.result); el.style.setProperty('--tc', TEAM[kk]);
      el.innerHTML = `<div class="sn-who">${ps.map(o => `<span class="${o.s === st.turn && !st.result ? 'on' : ''}">${UI.avatar(rp(room, o.p.id), 34)}<b>${esc(rp(room, o.p.id).name)}</b></span>`).join('')}</div>
        <div class="sn-grp">${gname(st)[st.sides[kk]]}${st.teams ? ` · Dupla ${kk + 1}` : ''}</div>
        <div class="sn-balls">${leftB.map(ballHTML).join('')}${!leftB.length && fin ? ballHTML(st.final) : ''}${!leftB.length && !fin ? '✅' : ''}</div>
        <div class="sn-score"><b>${st.score[kk]}</b> pts</div>`;
    }
    const C = $('.sn-ctl', T_), show = myTurn && !rolling && !st.result && has3d;
    C.classList.toggle('on', show);
    if (show && !C.children.length) {
      C.innerHTML = `<button class="sn-b" data-aim="-1" title="Mira para a esquerda (← no teclado; Shift anda mais)">◀</button>
        <label class="sn-pw">Força<input type="range" id="sn-power" min="5" max="100" value="${Math.round(Sinuca3D.aim.power * 100)}"></label>
        <button class="sn-b big" id="sn-shoot" title="Segure para carregar a força e solte para tacar (ou a barra de espaço)">🎱 Tacar</button>
        <button class="sn-b" data-aim="1" title="Mira para a direita (→ no teclado; Shift anda mais)">▶</button>`;
      $$('[data-aim]', C).forEach(b => { let iv = 0; const go = () => Sinuca3D.nudgeAim(+b.dataset.aim * .004); b.onpointerdown = e => { e.preventDefault(); go(); clearInterval(iv); iv = setInterval(go, 60); }; b.onpointerup = b.onpointerleave = b.onpointercancel = () => clearInterval(iv); });
      $('#sn-power', C).oninput = e => Sinuca3D.setPower(e.target.value / 100);
      const sb = $('#sn-shoot', C); sb.onpointerdown = e => { e.preventDefault(); try { sb.setPointerCapture(e.pointerId); } catch { } Sinuca3D.charge(true); }; sb.onpointerup = sb.onpointercancel = () => Sinuca3D.charge(false);
    } else if (!show) C.innerHTML = '';
    C.classList.toggle('busy', !canShoot);
    const fp = has3d && Sinuca3D.fp, tm = has3d && Sinuca3D.tossMode;
    $('[data-toss]', T_).classList.toggle('on', !!tm); $('[data-toss]', T_).style.display = me < 0 || st.result ? 'none' : '';
    $('.sn-hint', T_).textContent = st.result || !has3d ? '' : tm ? (fp ? `Mire na mesa e clique para jogar o ${tm}` : `Toque na mesa onde quer jogar o ${tm}`) : me < 0 ? '👀 Você está assistindo' : rolling ? '' : !myTurn ? `Vez de ${rp(room, cur.id).name}${fp ? ' · arraste para girar a câmera · V sai' : ''}` : st.inHand && st.balls[0].in ? 'Toque na mesa para colocar a bola branca' : st.inHand ? 'Toque na mesa para mudar a branca de lugar, ou taque daí mesmo' : fp ? 'Mouse mira · segure e puxe = força, solte = tacada · direito gira · V sai' : 'Mova o mouse para mirar (ou ◀ ▶). Segure Tacar para carregar a força e solte. 🎯 ou V: atrás do taco.';
  }
  function tick(st) {
    const bar = $('#sn-timer'); if (!bar || !st) return;
    const now = Room.now();
    if (wasRolling && now >= st.readyAt && !(has3d && Sinuca3D.busy)) return render(Room.room); // as bolas pararam: libera a vez
    bar.parentElement.classList.toggle('off', !st.deadline || !!st.result || now < st.readyAt); if (!st.deadline) return;
    const left = Math.max(0, st.deadline - now), low = left < 8000; bar.style.width = Math.min(100, 100 * left / st.turnMs) + '%'; bar.classList.toggle('low', low);
    $('#sn-table .sn-team.turn .sn-who span.on b')?.setAttribute('data-t', st.result || now < st.readyAt ? '' : Math.ceil(left / 1000) + 's');
  }

  // ---------- painel lateral ----------
  function renderSide(room, st) {
    const S = $('#game-side');
    const keep = $('.chat-form input', S)?.value || '', focus = document.activeElement?.closest('#game-side .chat-form');
    const sides = [0, 1].map(k => { const who = st.players.filter((_, s) => Sinuca.teamOf(st, s) === k).map(p => esc(rp(room, p.id).name)).join(' + ');
      return `<div class="d2-score" style="--tc:${TEAM[k]}"><b>${st.score[k]}</b><span>${gname(st)[st.sides[k]]}<small>${who}</small></span></div>`; }).join('');
    S.innerHTML = `
      <div class="card cj-status"><h3>🎱 Sinuca</h3>
        <div class="bankline"><span>${st.mode === 'bola8' ? 'Bola 8' : 'Par ou ímpar'}${st.final ? ` · a ${st.final} decide` : ''}${st.cfg?.gastacao ? ' · 😈 gastação' : ''}</span><span>Tacada ${st.shotN}</span><a id="sn-rules">📖 Regras</a><a id="btn-mute">${SFX.isMuted() ? '🔇' : '🔊'} Som</a><a id="sn-amb" title="Barulho de bar">${ambOn ? '🍺' : '🔕'} Ambiente</a></div>
        <div class="d2-scores">${sides}</div></div>
      <div class="card logcard">
        <div class="tabs">${[['log', 'Registro'], ['chat', 'Chat'], ['stats', '📊']].map(([k, t]) => `<button data-lt="${k}" class="${logTab === k ? 'on' : ''}"${k === 'stats' ? ' title="Estatísticas da partida"' : ''}>${t}</button>`).join('')}</div>
        ${logTab === 'log' ? `<div class="chat-box log">${st.log.map(l => `<div class="msg">${esc(l.msg)}</div>`).join('')}</div>`
        : logTab === 'stats' ? statsHTML(room, st)
        : `<div class="chat-box">${UI.chatHTML(room)}</div><form class="chat-form"><input placeholder="Mensagem…" maxlength="300"><button class="btn">➤</button></form>`}
      </div>
      <button class="btn ghost" id="sn-leave">🚪 Sair da partida</button>`;
    if (logTab === 'chat') { const i = $('.chat-form input', S); i.value = keep; if (focus) i.focus(); }
    $$('.chat-box', S).forEach(b => (b.scrollTop = b.scrollHeight));
    UI.bindChat(S);
    $$('[data-lt]', S).forEach(b => (b.onclick = () => { logTab = b.dataset.lt; render(Room.room); }));
    $('#sn-rules', S).onclick = () => rulesModal(st);
    $('#btn-mute', S).onclick = () => { SFX.setMuted(!SFX.isMuted()); render(Room.room); };
    $('#sn-amb', S).onclick = () => { ambOn = !ambOn; try { localStorage.setItem('sn-amb', ambOn ? '1' : '0'); } catch { } if (has3d) Sinuca3D.setAmbient(ambOn); render(Room.room); };
    $('#sn-leave', S).onclick = () => { if (UI.confirmLeave()) { reset(); UI.leaveToHub(); } };
  }
  const STATS = [['tacadas', '🎱', 'Tacadas'], ['bolas', '🎯', 'Bolas encaçapadas'], ['pontos', '💯', 'Pontos feitos'], ['faltas', '⚠️', 'Faltas'], ['deuBola', '😬', 'Bolas do adversário'], ['jogou', '🍾', 'Coisas jogadas na mesa']];
  function statsHTML(room, st) {
    return `<div class="chat-box d2-stats"><table><tr><th></th>${STATS.map(([, i, t]) => `<th title="${t}">${i}</th>`).join('')}</tr>
      ${st.players.map((p, s) => `<tr style="--tc:${TEAM[Sinuca.teamOf(st, s)]}"><td>${esc(rp(room, p.id).name)}</td>${STATS.map(([k]) => `<td>${st.stats?.[s]?.[k] || 0}</td>`).join('')}</tr>`).join('')}</table>
      <p class="muted">${STATS.map(([, i, t]) => `${i} ${t}`).join(' · ')}</p></div>`;
  }
  function rulesModal(st) {
    const m = UI.modal(`<h2>🎱 Regras da sinuca</h2><ul class="rules">
      ${st.mode === 'bola8' ? '<li><b>Bola 8</b>: um lado fica com as <b>lisas</b> (1 a 7) e o outro com as <b>listradas</b> (9 a 15). Encaçapou todas as suas, tem que encaçapar a <b>8</b>; antes da hora, é derrota.</li>'
        : `<li><b>Par ou ímpar</b>: no sorteio, um lado fica com as <b>ímpares</b> (1, 3 … 13) e o outro com as <b>pares</b> (2, 4 … 14). ${st.final ? 'Encaçapou todas as suas, tem que encaçapar a <b>15</b>; antes da hora, é derrota.' : 'Vence quem encaçapa a <b>última bola do seu lado</b>.'}</li>`}
      <li>Com 4 jogadores é em <b>duplas</b>: 1º e 3º contra 2º e 4º, cada um na sua vez.</li>
      <li>Cada bola vale o <b>seu número</b> em pontos. Encaçapou bola sua: os pontos são seus e você continua. Encaçapou bola do outro: os pontos vão para ele e a bola fica fora.</li>
      <li><b>Falta</b> (branca na caçapa, não bater em nada, ou bater primeiro em bola que não é sua): <b>${Sinuca.FOUL_PTS} pontos</b> para o adversário, que joga com a <b>bola na mão</b> (põe a branca onde quiser).</li>
      <li>Encaçapar a sua última bola junto com a branca, ou a última bola do adversário, é derrota.</li>
      <li>🍾 Qualquer um pode <b>jogar coisa na mesa</b> (garrafa, copo, sapato, cinzeiro), uma a cada 10 s por pessoa. ${st.cfg?.gastacao ? '<b>Modo gastação</b>: o que cai empurra as bolas perto e fica <b>15 segundos</b> na mesa atrapalhando; bola que cai por causa disso volta para a mesa.' : 'No modo padrão é só pela graça: não mexe nas bolas.'}</li>
      <li>Cada tacada tem ${Math.round(st.turnMs / 1000)} segundos. Mire com o mouse (ou ◀ ▶ e as setas), segure <b>Tacar</b> (ou a barra de espaço) para carregar a força e solte. Arraste para girar a mesa, role para aproximar.</li>
      <li>🎯 <b>Atrás do taco</b> (tecla V): o mouse mira, segurar o <b>botão esquerdo</b> e puxar para trás carrega a força, soltar taca; o <b>botão direito</b> gira a câmera. Na jogada a câmera vai para o lado da mesa.</li></ul>
      <button class="btn primary" id="sn-rules-ok">Entendi</button>`);
    $('#sn-rules-ok', m).onclick = UI.closeModal;
  }
  function showResult(room, st) {
    const w = rp(room, st.result.winner); SFX.coinShower?.();
    const m = UI.modal(`<div class="result">
      <div class="confetti">${Array.from({ length: 40 }, (_, k) => `<i style="--x:${Math.random() * 100}%;--d:${Math.random() * 2}s;--h:${k * 37 % 360}"></i>`).join('')}</div>
      ${UI.avatar(w, 150)}<h1>${esc(sideName(st, room, st.result.side))} venceu a sinuca!</h1>
      <blockquote>${esc(st.result.msg)}</blockquote>
      <ol class="final">${[0, 1].map(k => [st.score[k], k]).sort((a, b) => b[0] - a[0]).map(([v, k]) => `<li><b>${esc(sideName(st, room, k))}</b> <small>${gname(st)[st.sides[k]]}</small><span>${v} pts</span></li>`).join('')}</ol>
      ${Room.isHost ? '<button class="btn primary big" id="back-lobby">Voltar para a sala</button>' : '<p class="muted">Aguardando o anfitrião voltar para a sala…</p>'}
      <button class="btn ghost" id="res-close">Ver a mesa</button></div>`, { wide: true });
    $('#back-lobby', m) && ($('#back-lobby', m).onclick = () => { UI.closeModal(); Room.send({ t: 'lobby' }); });
    $('#res-close', m).onclick = UI.closeModal;
  }
  function reset() { built = null; resultShown = null; pending = false; clearInterval(timerIv); clearTimeout(bannerTo); Sinuca3D.setTossMode(null); Sinuca3D.toggleFP(false); Sinuca3D.show(false); }

  return { render, reset };
})();
