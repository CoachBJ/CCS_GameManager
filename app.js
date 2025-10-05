// ===== Constants =====
const TIME_MAX_SEC = 12 * 60;              // 12:00 max
const TIME_MAX_MS  = TIME_MAX_SEC * 1000;
const LONG_PRESS_MS = 1200;

// ===== State =====
const s = {
  clockMs: TIME_MAX_MS, running: false, lastTick: 0,
  home: 0, away: 0, pos: 'home',
  stack: [] // Undo stack
};
const el   = id => document.getElementById(id);
const $    = sel => document.querySelector(sel);
const $all = sel => Array.from(document.querySelectorAll(sel));

// ===== Helpers =====
const fmt = ms => {
  const t = Math.max(0, Math.round(ms/1000));
  const m = Math.floor(t/60).toString().padStart(2,'0');
  const s = (t%60).toString().padStart(2,'0');
  return `${m}:${s}`;
};
const parseMMSS = (str) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec((str||'').trim());
  if (!m) return null;
  const min = +m[1], sec = +m[2];
  if (sec>59) return null;
  return (min*60+sec)*1000;
};
function toast(msg, ms=1400){
  const t = el('toast'); if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(()=>t.classList.remove('show'), ms);
}
function vibrate(ms=10){ try{ navigator.vibrate?.(ms); }catch{} }
async function keepAwake(){
  try { if ('wakeLock' in navigator) await navigator.wakeLock.request('screen'); } catch {}
}

// ===== Render =====
const render = () => {
  el('clockDisplay').textContent = fmt(s.clockMs);
  el('homeScore').textContent = s.home;
  el('awayScore').textContent = s.away;
  el('posHome').classList.toggle('on', s.pos==='home');
  el('posAway').classList.toggle('on', s.pos==='away');
  localStorage.setItem('gm_state', JSON.stringify(s));
};

// ===== Clock loop (RAF) =====
function tick(ts) {
  if (s.running) {
    if (!s.lastTick) s.lastTick = ts;
    const dt = ts - s.lastTick; s.lastTick = ts;
    if (s.clockMs > 0) s.clockMs = Math.max(0, s.clockMs - dt);
    else s.running = false;
    render();
  }
  requestAnimationFrame(tick);
}

// ===== Score controls =====
['home','away'].forEach(team=>{
  document.querySelectorAll(`.team-row[data-team="${team}"] .btn.score`)
    .forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const pts = Number(btn.dataset.points);
        s.stack.push({team, pts});
        s[team] += pts;
        vibrate(8);
        render();
        log(`${team.toUpperCase()} +${pts}`);
        autoUpdateCombos();
      });
    });
  document.querySelector(`.minus[data-team="${team}"]`)
    .addEventListener('click', ()=>{
      s.stack.push({team, pts:-1});
      s[team] = Math.max(0, s[team]-1);
      vibrate(8);
      render();
      log(`${team.toUpperCase()} −1`);
      autoUpdateCombos();
    });
});

// ===== Time controls (cap 12:00) =====
function setTimeFromString(str){
  const ms = parseMMSS(str);
  const clamped = Math.min(TIME_MAX_MS, ms ?? TIME_MAX_MS);
  s.clockMs = clamped; s.running=false; s.lastTick=0; render();
  if (el('timeSlider')) {
    el('timeSlider').max = String(TIME_MAX_SEC);
    el('timeSlider').value = String(Math.round(clamped/1000));
    el('timeSliderLabel').textContent = fmt(clamped);
  }
}
$all('.tset').forEach(b=>b.onclick = ()=> setTimeFromString(b.dataset.time));
if (el('timeSlider')) {
  el('timeSlider').max = String(TIME_MAX_SEC);
  el('timeSlider').addEventListener('input', e=>{
    el('timeSliderLabel').textContent = fmt(Number(e.target.value)*1000);
  });
  el('timeSlider').addEventListener('change', e=>{
    const v = Math.min(TIME_MAX_SEC, Math.max(0, Number(e.target.value)));
    s.clockMs = v*1000; s.running=false; s.lastTick=0; render();
    e.target.value = String(v);
    el('timeSliderLabel').textContent = fmt(v*1000);
  });
}
$('#useClockBtn')?.addEventListener('click', ()=>{ $('#toTime').value = fmt(s.clockMs); toast('Copied clock to planner'); });

$('#startBtn').onclick = ()=>{ s.running = true; s.lastTick = 0; render(); keepAwake(); };
$('#pauseBtn').onclick = ()=>{ s.running = false; render(); };
$('#resetBtn').onclick = ()=>{ setTimeFromString('12:00'); toast('Clock reset to 12:00'); };

$('#posHome').onclick = ()=>{ s.pos='home'; render(); };
$('#posAway').onclick = ()=>{ s.pos='away'; render(); };

$('#undoBtn').onclick = ()=>{
  const last = s.stack.pop();
  if (!last) return;
  s[last.team] = Math.max(0, s[last.team]-last.pts);
  render();
  autoUpdateCombos();
  toast('Undid last action');
};

// ===== Log =====
function log(text){
  const div = document.createElement('div');
  div.textContent = `${new Date().toLocaleTimeString()}  ${text}`;
  el('log').prepend(div);
}

// ===== Persist/boot =====
try {
  const saved = JSON.parse(localStorage.getItem('gm_state')||'null');
  if (saved) Object.assign(s, saved);
} catch {}
render(); requestAnimationFrame(tick);

// ===== Remove legacy PAT helper =====
document.getElementById('pat-helper')?.remove();

/* ===========================================================
   Advanced: Timeout Planner + Score Combo Finder
   =========================================================== */
const mmssToSec = (mmss)=>{ const ms=parseMMSS(mmss); return ms?Math.round(ms/1000):null };
const secToMMSS = (sec)=>{ sec=Math.max(0,Math.round(sec)); const m=String(Math.floor(sec/60)).padStart(2,'0'); const s=String(sec%60).padStart(2,'0'); return `${m}:${s}`; };
function btnGroupToggle(btns,clicked){ btns.forEach(b=>b.classList.toggle('on', b===clicked)); }

// Timeout Planner
let mode = 'defense';
$('#modeDefense')?.addEventListener('click', e=>{ mode='defense'; btnGroupToggle([$('#modeDefense'),$('#modeOffense')], e.target); });
$('#modeOffense')?.addEventListener('click', e=>{ mode='offense'; btnGroupToggle([$('#modeDefense'),$('#modeOffense')], e.target); });

let ourTOs = 2;
$all('.toCount').forEach(b=>{
  b.onclick = (e)=>{ ourTOs = Number(e.target.dataset.val); btnGroupToggle($all('.toCount'), e.target); vibrate(6); };
});

function simulateKneel(timeSec, defTOs, kneels=3, kneelSec=2, playClock=40){
  let t=timeSec, tos=defTOs;
  for (let i=0;i<kneels&&t>0;i++){
    t -= kneelSec; if (t<=0) break;
    if (tos>0){ tos -= 1; } else { t -= Math.min(playClock,t); }
  }
  return Math.max(0, Math.round(t));
}
function simulateDefense(timeSec, defTOs, downs=3, secPerPlay=6, playClock=40){
  let t=timeSec, tos=defTOs; const plan=[];
  for (let d=1; d<=downs && t>0; d++){
    t -= Math.min(secPerPlay,t);
    if (t<=0){ plan.push(`After play ${d}: 00:00`); break; }
    if (tos>0){ tos -= 1; plan.push(`Use TO after play ${d} → ${secToMMSS(t)} left`); }
    else { const burn=Math.min(playClock,t); t -= burn; plan.push(`No TO after play ${d} (burn ~${burn}s) → ${secToMMSS(t)} left`); }
  }
  return { timeLeft: Math.max(0,Math.round(t)), plan };
}

const toOut = el('toOutput');
$('#calcKneel')?.addEventListener('click', ()=>{
  const time = mmssToSec($('#toTime').value);
  if (time==null){ toOut.textContent='Enter time as MM:SS'; return; }
  const left = simulateKneel(time, ourTOs, 3, Number($('#kneelSec').value||2), Number($('#playClock').value||40));
  toOut.textContent =
   `KNEEL-OUT CHECK (they have ball)\nTime: ${secToMMSS(time)} | Our TOs: ${ourTOs}\n\n` +
   (left===0 ? `They CAN kneel it out.` : `They CANNOT fully kneel out. ~${secToMMSS(left)} left.`);
});
$('#calcDefense')?.addEventListener('click', ()=>{
  const time = mmssToSec($('#toTime').value);
  if (time==null){ toOut.textContent='Enter time as MM:SS'; return; }
  const { timeLeft, plan } = simulateDefense(time, ourTOs, 3, Number($('#secPerPlay').value||6), Number($('#playClock').value||40));
  toOut.textContent = `DEFENSE CLOCK PLAN\n${plan.join('\n')}\n\nEstimated after 3 plays: ${secToMMSS(timeLeft)} left.`;
});
$('#useTO')?.addEventListener('click', ()=>{
  log('USE TO');
  const boxes = ['hto1','hto2','hto3'].map(id=>document.getElementById(id));
  const nxt = boxes.find(b=>b && !b.checked);
  if (nxt) nxt.checked = true;
  toast('Timeout used');
});

// Score Combos (auto)
const PLAYS = [
  { pts:8, label:'TD+2' },
  { pts:7, label:'TD+PAT' },
  { pts:6, label:'TD' },
  { pts:3, label:'FG' },
  { pts:2, label:'Safety' }
];
function scoreCombos(target){
  const out=[]; const counts=Array(PLAYS.length).fill(0);
  (function dfs(rem,start){
    if(rem===0){ out.push(counts.slice()); return; }
    for(let i=start;i<PLAYS.length;i++){
      const v=PLAYS[i].pts; if(v<=rem){ counts[i]++; dfs(rem - v,i); counts[i]--; }
    }
  })(target,0);
  return out;
}
function formatCombo(counts){
  const parts=[], playsTotal=counts.reduce((a,b)=>a+b,0);
  for(let i=0;i<counts.length;i++) if(counts[i]>0) parts.push(`${PLAYS[i].label}×${counts[i]}`);
  const points=counts.reduce((sum,c,i)=>sum + c*PLAYS[i].pts,0);
  return { text:`${parts.join(' + ')}  (${playsTotal} plays, ${points} pts)`, playsTotal };
}
const comboOut = el('comboOutput');
function computeAndRenderCombos(target, maxShow, headerLine=null){
  const combos = scoreCombos(target).map(formatCombo)
    .sort((a,b)=> a.playsTotal - b.playsTotal || a.text.localeCompare(b.text))
    .slice(0, maxShow);
  comboOut.textContent = (headerLine ? headerLine + '\n' : '') +
    (combos.length ? combos.map(c=>`• ${c.text}`).join('\n') : 'No exact combos for that target.');
}
function autoUpdateCombos(){
  if (!el('targetPts') || !comboOut) return;
  const trailing = (s.home===s.away) ? null : (s.home>s.away?'away':'home');
  const diff = Math.abs(s.home - s.away) || 1;
  el('targetPts').value = String(diff);
  const maxShow = Math.max(5, Math.floor(Number($('#maxCombos')?.value || 30)));
  const header = trailing ? `Combos for ${trailing.toUpperCase()} to make up ${diff} pts`
                          : `Combos to take a 1-pt lead (game tied)`;
  computeAndRenderCombos(diff, maxShow, header);
}
$('#findCombos')?.addEventListener('click', ()=>{
  const target = Math.max(1, Math.floor(Number($('#targetPts').value||0)));
  const maxShow = Math.max(5, Math.floor(Number($('#maxCombos').value||30)));
  computeAndRenderCombos(target, maxShow);
});
$('#copyCombos')?.addEventListener('click', async()=>{
  if (!comboOut?.textContent) return;
  try { await navigator.clipboard.writeText(comboOut.textContent); toast('Combos copied'); } catch {}
});
autoUpdateCombos();

// ===== Theme toggle =====
(function initTheme(){
  const saved = localStorage.getItem('gm_theme');
  if (saved) document.body.setAttribute('data-theme', saved);
  $('#themeBtn')?.addEventListener('click', ()=>{
    const cur = document.body.getAttribute('data-theme') || 'dark';
    const next = cur==='dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('gm_theme', next);
    toast(next==='dark'?'Night theme':'Light theme');
  });
})();

// ===== Reset GAME (hold to confirm) =====
(function initResetGame(){
  const btn = el('resetGameBtn'); if (!btn) return;
  let t=null;
  const start = ()=>{ btn.classList.add('armed'); toast('Hold… release cancels'); t=setTimeout(doReset, LONG_PRESS_MS); };
  const cancel= ()=>{ if(t){clearTimeout(t); t=null; btn.classList.remove('armed');} };
  const doReset = ()=>{
    cancel(); vibrate(30);
    // reset scores/clock/pos/period/TOs/log; keep team names
    s.home=0; s.away=0; s.pos='home'; s.stack=[];
    s.running=false; s.lastTick=0; s.clockMs=TIME_MAX_MS;
    $('#period').value = '1';
    ['hto1','hto2','hto3','ato1','ato2','ato3'].forEach(id=>{ const b=el(id); if(b) b.checked=false; });
    el('log').innerHTML='';
    render(); autoUpdateCombos();
    if (el('timeSlider')){ el('timeSlider').value=String(TIME_MAX_SEC); el('timeSliderLabel').textContent='12:00'; }
    toast('Game reset');
  };
  ['pointerdown','touchstart','mousedown'].forEach(ev=>btn.addEventListener(ev, start));
  ['pointerup','pointerleave','touchend','touchcancel','mouseup','mouseleave'].forEach(ev=>btn.addEventListener(ev, cancel));
})();