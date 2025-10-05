// --- State ---
const s = {
  clockMs: 12 * 60 * 1000, running: false, lastTick: 0,
  home: 0, away: 0, pos: 'home',
  stack: [] // for Undo
};
const el = id => document.getElementById(id);
const fmt = ms => {
  const t = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(t/60).toString().padStart(2,'0');
  const s = (t%60).toString().padStart(2,'0');
  return `${m}:${s}`;
};
const render = () => {
  el('clockDisplay').textContent = fmt(s.clockMs);
  el('homeScore').textContent = s.home;
  el('awayScore').textContent = s.away;
  el('posHome').classList.toggle('on', s.pos==='home');
  el('posAway').classList.toggle('on', s.pos==='away');
  localStorage.setItem('gm_state', JSON.stringify(s));
};

// --- Clock loop (RAF, smoother than setInterval) ---
function tick(ts) {
  if (s.running) {
    if (!s.lastTick) s.lastTick = ts;
    const dt = ts - s.lastTick; s.lastTick = ts;
    if (s.clockMs > 0) s.clockMs -= dt;
    else s.running = false;
    render();
  }
  requestAnimationFrame(tick);
}

// --- Wire up controls ---
['home','away'].forEach(team=>{
  document.querySelectorAll(`.team-row[data-team="${team}"] .btn.score`)
    .forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const pts = Number(btn.dataset.points);
        s.stack.push({team, pts});
        s[team] += pts;
        render();
        log(`${team.toUpperCase()} +${pts}`);
      });
    });
  document.querySelector(`.minus[data-team="${team}"]`)
    .addEventListener('click', ()=>{
      s.stack.push({team, pts:-1});
      s[team] = Math.max(0, s[team]-1);
      render();
      log(`${team.toUpperCase()} −1`);
    });
});

function setTimeFromString(str){
  const [m,sec] = str.split(':').map(Number);
  s.clockMs = (m*60+sec)*1000; s.running=false; s.lastTick=0; render();
}
document.querySelectorAll('.tset').forEach(b=>b.onclick = ()=> setTimeFromString(b.dataset.time));
el('timeSlider').addEventListener('input', e=>{
  const v = Number(e.target.value);
  el('timeSliderLabel').textContent = fmt(v*1000);
});
el('timeSlider').addEventListener('change', e=>{
  s.clockMs = Number(e.target.value)*1000; s.running=false; s.lastTick=0; render();
});

el('startBtn').onclick = ()=>{ s.running = true; s.lastTick = 0; render(); };
el('pauseBtn').onclick = ()=>{ s.running = false; render(); };
el('resetBtn').onclick = ()=>{ setTimeFromString('12:00'); };

el('posHome').onclick = ()=>{ s.pos='home'; render(); };
el('posAway').onclick = ()=>{ s.pos='away'; render(); };

el('undoBtn').onclick = ()=>{
  const last = s.stack.pop();
  if (!last) return;
  s[last.team] = Math.max(0, s[last.team]-last.pts);
  render();
};

function log(text){
  const div = document.createElement('div');
  div.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  el('log').prepend(div);
}

// --- Restore persisted state (optional) ---
try {
  const saved = JSON.parse(localStorage.getItem('gm_state')||'null');
  if (saved) Object.assign(s, saved);
} catch {}
render(); requestAnimationFrame(tick);

// --- Remove the legacy PAT vs 2-pt helper if present ---
const pat = document.getElementById('pat-helper');
if (pat) pat.remove();
