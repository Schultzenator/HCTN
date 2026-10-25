export function page(overlay: boolean, moderatorKey = ''): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Chat Relay Studio${overlay ? ' · Overlay' : ''}</title><link rel="stylesheet" href="/styles.css">${overlay ? '' : `<meta name="moderator-key" content="${moderatorKey}">`}</head><body class="${overlay ? 'overlay' : 'studio'}">
  ${overlay ? '' : `<header><a class="brand" href="/">◈ <span>CHAT RELAY<span class="brand-sub">STUDIO / TWITCHCON 2026</span></span></a><div class="connection"><i id="source-dot"></i><span id="source">Connecting</span></div><a class="overlay-link" href="/overlay" target="_blank" rel="noopener">Open OBS overlay ↗</a></header>
  <main><aside><div class="eyebrow">DIRECTOR’S DESK</div><h1>Chat writes.<br>You direct.</h1><p class="intro">One audience. One shared adventure.<br>Every chapter starts with a choice.</p><section class="control-box"><div class="section-label">01 / COLLECT THE VOTE</div><label for="duration">Voting window <span>seconds</span></label><input id="duration" type="number" min="1" max="300" value="15"><div class="buttons"><button data-command="open" class="primary">Start round</button><button data-command="close">Close vote</button></div><button data-command="fixture" id="fixture" class="wide">↻ Play new fixture round</button></section><section class="control-box"><div class="section-label">02 / MAKE IT CANON</div><p id="decision">Waiting for your audience.</p><button data-command="approve" class="primary wide">Approve winning scene →</button><div class="buttons"><button data-command="undo">Undo scene</button><button data-command="replay">↻ Replay scene</button></div><button data-command="discard" class="quiet wide">Discard vote</button></section><p id="error" role="alert"></p><p id="notice" role="status"></p><div class="safety">◉ Moderator approval required<br><span>Fixed actions · no AI calls · no shell execution</span></div></aside><div class="workspace"><div class="preview-label"><span>LIVE STAGE PREVIEW</span><span>1920 × 1080 / OBS</span></div>`}
  <div class="stage" id="stage" data-template="forest"><div class="stage-grain"></div><div class="stage-top"><span class="pill">◈ CHAT RELAY</span><span id="chapter">PROLOGUE</span></div><div class="scenery" aria-hidden="true"><div class="orb"></div><div class="world world-one"></div><div class="world world-two"></div><div class="world world-three"></div><span id="symbol">✦</span><div class="horizon"></div></div><div class="story"><span class="eyebrow" id="action-label">A STORY BUILT TOGETHER</span><h2 id="title">The adventure awaits.</h2><p id="narrative">Chat chooses the path. The director brings it to life.</p><p class="credits" id="contributors">Your audience belongs in the story.</p></div><div class="vote-box"><div class="vote-heading"><span id="round-label">WAITING FOR CHAT</span><span id="countdown">—</span></div><div id="choices"><div class="choice"><span>!vote explore</span><b id="count-explore">0</b><div id="bar-explore"></div></div><div class="choice"><span>!vote help</span><b id="count-help">0</b><div id="bar-help"></div></div><div class="choice"><span>!vote build</span><b id="count-build">0</b><div id="bar-build"></div></div></div><div class="vote-foot"><span>ONE VIEWER · ONE VOTE</span><span id="mode">FIXTURE</span></div></div><div id="overlay-status" class="overlay-status">Connecting to studio…</div></div>
  ${overlay ? '' : `<div class="telemetry"><span id="stats">0 messages · 0 duplicates</span><span id="seed"></span></div><section class="history-section"><div class="section-label">THE STORY SO FAR <span> / click a chapter to replay</span></div><div id="history"><p>No approved chapters yet.</p></div></section></div></main><footer>CRAFTED WITH CODEX <span>Local session · in-memory history · keep this server running</span></footer>`}
  <script src="/ui.js" defer></script></body></html>`;
}
export const uiScript = `
const $ = id => document.getElementById(id);
const isOverlay = document.body.classList.contains('overlay');
let state = null, version = -1, connected = false, offset = 0;
const set = (id, value) => { if ($(id)) $(id).textContent = value; };
async function command(action, extra = {}) {
  set('error', ''); set('notice', '');
  try {
    const result = await fetch('/api/command', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Moderator-Key': document.querySelector('meta[name="moderator-key"]').content }, body: JSON.stringify({ action, durationMs: Number($('duration').value) * 1000, ...extra }) });
    const data = await result.json();
    if (!result.ok) throw new Error(data.error || 'Command failed');
    set('notice', action === 'fixture' ? 'New fixture playback started.' : 'Director action applied: ' + action);
  } catch (error) { set('error', error.message); }
}
if (!isOverlay) document.querySelectorAll('[data-command]').forEach(button => button.addEventListener('click', () => command(button.dataset.command)));
function countdown() {
  if (!state) return;
  const r = state.round;
  set('countdown', r?.status === 'open' ? Math.max(0, Math.ceil((r.deadline - (Date.now() + offset)) / 1000)) + 's' : r?.status === 'closed' ? 'AWAITING DIRECTOR' : '—');
}
function render(data) {
  state = data; offset = data.serverTime - Date.now();
  set('source', data.mode.toUpperCase() + ' / ' + data.source.status);
  if ($('source')) $('source').title = data.source.detail;
  if ($('source-dot')) $('source-dot').dataset.ok = String(data.source.status === 'connected' || data.source.status === 'finished');
  set('overlay-status', connected ? '' : 'Studio connection lost · reconnecting…');
  set('mode', data.mode === 'fixture' ? 'SYNTHETIC FIXTURE' : 'TWITCH LIVE');
  set('stats', data.stats.accepted + ' messages · ' + data.stats.duplicates + ' duplicates filtered');
  set('seed', 'SESSION SEED / ' + data.seed);
  const r = data.round;
  set('round-label', r ? 'ROUND ' + r.id + ' / ' + r.status.toUpperCase() : 'WAITING FOR CHAT');
  const total = r ? Object.values(r.counts).reduce((a, b) => a + b, 0) : 0;
  for (const action of ['explore', 'help', 'build']) {
    const n = r?.counts[action] || 0; set('count-' + action, n);
    $('bar-' + action).style.width = (total ? n / total * 100 : 0) + '%';
  }
  set('decision', r?.winner ? 'Winner: ' + r.winner.toUpperCase() + '. ' + total + ' viewers voted.' : r?.status === 'closed' ? 'No votes. Discard this round to start again.' : r?.status === 'open' ? 'Voting is open. Chat can use the three commands.' : 'Start a round to collect the next chapter.');
  const scene = data.playback;
  $('stage').dataset.template = scene?.template || 'forest';
  set('title', scene?.title || 'The adventure awaits.');
  set('symbol', scene?.symbol || '✦');
  set('narrative', scene?.narrative || 'Chat chooses the path. The director brings it to life.');
  set('contributors', scene ? 'Inspired by ' + scene.contributors.join(' · ') : 'Your audience belongs in the story.');
  set('chapter', scene ? 'CHAPTER ' + String(scene.id).padStart(2, '0') : 'PROLOGUE');
  set('action-label', scene ? 'CHAT CHOSE TO ' + scene.action.toUpperCase() : 'A STORY BUILT TOGETHER');
  if (version !== data.playbackVersion) { version = data.playbackVersion; $('stage').classList.remove('reveal'); void $('stage').offsetWidth; $('stage').classList.add('reveal'); }
  if (!isOverlay) {
    $('fixture').hidden = data.mode !== 'fixture';
    const disabled = { open: r && r.status !== 'approved', close: r?.status !== 'open', approve: r?.status !== 'closed' || !r?.winner, undo: !data.history.length, replay: !data.history.length, discard: !r };
    for (const [action, value] of Object.entries(disabled)) document.querySelector('[data-command="' + action + '"]').disabled = Boolean(value);
    $('history').replaceChildren();
    for (const scene of data.history) { const b = document.createElement('button'); b.className = 'chapter-card'; b.textContent = String(scene.id).padStart(2, '0') + ' / ' + scene.title + ' · ' + scene.action; b.onclick = () => command('replay', { sceneId: scene.id }); $('history').append(b); }
    if (!data.history.length) { const p = document.createElement('p'); p.textContent = 'No approved chapters yet.'; $('history').append(p); }
  }
  countdown();
}
const events = new EventSource('/events');
events.onopen = () => { connected = true; set('overlay-status', ''); };
events.onerror = () => { connected = false; set('source', 'Studio disconnected / retrying'); set('overlay-status', 'Studio connection lost · reconnecting…'); };
events.addEventListener('state', event => render(JSON.parse(event.data)));
setInterval(countdown, 250);
`;
