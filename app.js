// =======================
// Charlotte Christian Game Manager — Voice + iPhone layout
// =======================

const TEAM_NAME = "Charlotte Christian";

// ----- Scoring definitions -----
const SCORING_PLAYS = [
  { pts: 8, label: "TD + 2pt" },
  { pts: 7, label: "TD + PAT" },
  { pts: 6, label: "TD (no conv)" },
  { pts: 3, label: "FG" },
  { pts: 2, label: "Safety" },
];
const JOINER = " • ";

// ----- Utils -----
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const toMMSS = (s) => { s=Math.max(0,Math.floor(s)); const m=Math.floor(s/60), ss=s%60; return `${m}:${String(ss).padStart(2,"0")}`; };
const fromMMSS = (txt) => { const m=String(txt||"").trim().match(/^(\d{1,2}):([0-5]?\d)$/); if(!m) return null; return clamp(parseInt(m[1],10)*60+parseInt(m[2],10),0,1440); };

// ----- Scoring core -----
function scoreCombos(target){
  const combos=[], counts=new Array(SCORING_PLAYS.length).fill(0);
  function dfs(rem,start){ if(rem===0){combos.push([...counts]);return;}
    for(let i=start;i<SCORING_PLAYS.length;i++){ const p=SCORING_PLAYS[i].pts; if(p>rem) continue; counts[i]++; dfs(rem-p,i); counts[i]--; } }
  if(target>0) dfs(target,0); return combos;
}
function rankKey(counts){ const total=counts.reduce((a,b)=>a+b,0); return [total,-counts[0],-counts[1],-counts[2],counts[3],counts[4]]; }
function formatCombo(counts){ const parts=[]; for(let i=0;i<counts.length;i++){const c=counts[i]; if(!c) continue; parts.push(c>1?`${c}x ${SCORING_PLAYS[i].label}`:SCORING_PLAYS[i].label);} return parts.join(JOINER); }
function validateInt(v){ if(v===""||v==null) return null; const n=Math.floor(Number(v)); return Number.isNaN(n)?null:n; }
function buildItems(target, cap){
  if(target<=0) return { msg: target===0 ? "Already tied." : "No points needed." };
  const combos = scoreCombos(target); if(!combos.length) return { msg:"Not reachable with standard scoring." };
  const items = combos.map(cs=>({ cs, key: rankKey(cs), txt: formatCombo(cs), plays: cs.reduce((a,b)=>a+b,0) }))
    .sort((a,b)=>{ for(let i=0;i<a.key.length;i++){ if(a.key[i]!==b.key[i]) return a.key[i]-b.key[i]; } return a.txt.localeCompare(b.txt); });
  const seen=new Set(), out=[]; for(const it of items){ if(seen.has(it.txt)) continue; seen.add(it.txt); out.push(it); if(out.length>=cap) break; }
  return { list: out };
}

// ----- DOM refs: scores/options -----
const elOur = document.querySelector("#ourScore");
const elOpp = document.querySelector("#oppScore");
const elCap = document.querySelector("#cap");
const elCalc= document.querySelector("#calc");
const elOut = document.querySelector("#output");
const elStatus=document.querySelector("#status");
const viewTable=document.querySelector("#view-table");
const viewRow  =document.querySelector("#view-row");
const whoAuto  =document.querySelector("#who-auto");
const whoUs    =document.querySelector("#who-us");
const whoOpp   =document.querySelector("#who-opp");
const elOurLabel=document.querySelector("#ourLabel");
const elOppLabel=document.querySelector("#oppLabel");

// Opponent/theme inputs
const elOppName=document.getElementById("oppName");
const elOppColor=document.getElementById("oppColor");

// PAT helper
const elXp=document.getElementById("xpPct");
const elTwo=document.getElementById("twoPct");
const elPatAdvice=document.getElementById("patAdvice");

// ----- Banner -----
function renderBanner(our, opp, oppName){
  const el = document.getElementById("banner");
  const usBehind  = Math.max(0, opp - our);
  const oppBehind = Math.max(0, our - opp);

  let cls="neutral", title="Game is tied";
  if(our < opp){ cls="bad";  title = `${TEAM_NAME} trails by ${usBehind}`; }
  if(our > opp){ cls="good"; title = `${oppName} trails by ${oppBehind}`; }

  el.className = `banner ${cls}`;
  el.innerHTML = `
    <div class="title">${title}</div>
    <div class="sub">${TEAM_NAME} ${our} — ${oppName} ${opp} • ${TEAM_NAME} behind: ${usBehind} • ${oppName} behind: ${oppBehind}</div>
  `;
}

// ----- Renderers -----
function renderRow(list){
  const card=document.createElement("div"); card.className="card";
  const row=document.createElement("div");
  list.forEach((it,idx)=>{
    const wrap=document.createElement("span"); wrap.className="wrap";
    it.txt.split(JOINER).forEach(seg=>{ const span=document.createElement("span"); span.className="segment"; span.textContent=seg; wrap.appendChild(span); });
    row.appendChild(wrap);
    if(idx<list.length-1){ const sep=document.createElement("span"); sep.textContent="   |   "; sep.className="muted"; row.appendChild(sep); }
  });
  card.appendChild(row); elOut.appendChild(card);
}
function renderTable(list){
  const card=document.createElement("div"); card.className="card";
  const table=document.createElement("table"); table.className="table";
  table.innerHTML = `<thead><tr><th>Possessions</th><th>Option</th></tr></thead>`;
  const tb=document.createElement("tbody");
  list.forEach(it=>{
    const tr=document.createElement("tr");
    const tdA=document.createElement("td"); tdA.innerHTML=`<span class="badge">${it.plays}</span>`;
    const tdB=document.createElement("td");
    it.txt.split(JOINER).forEach(seg=>{ const s=document.createElement("span"); s.className="segment"; s.textContent=seg; tdB.appendChild(s); });
    tr.appendChild(tdA); tr.appendChild(tdB); tb.appendChild(tr);
  });
  table.appendChild(tb); card.appendChild(table); elOut.appendChild(card);
}
function renderSection(title, resultObj){
  const header=document.createElement("div"); header.className="card"; header.innerHTML=`<strong>${title}</strong>`; elOut.appendChild(header);
  if(resultObj.msg){ const card=document.createElement("div"); card.className="card"; card.innerHTML=`<span class="muted">${resultObj.msg}</span>`; elOut.appendChild(card); }
  else { (viewTable.checked?renderTable:renderRow)(resultObj.list); }
}

// ===== Game clock / TOs (checkbox groups) =====
const elHalf1=document.getElementById("half1");
const elHalf2=document.getElementById("half2");
const elTimeInput=document.getElementById("timeInput");
const elMiniBtns=document.querySelectorAll(".mini");

const TO_KEYS = ["our-h1","opp-h1","our-h2","opp-h2"];
function getGroupEl(key){ return document.querySelector(`.to-checks[data-key="${key}"]`) || document.getElementById(`group-${key}`); }
function getTOState(key){ const g=getGroupEl(key); const boxes=g?[...g.querySelectorAll('input[type="checkbox"]')]:[]; return boxes.map(b=>b.checked); }
function setTOState(key, arr){ const g=getGroupEl(key); if(!g) return; const boxes=[...g.querySelectorAll('input[type="checkbox"]')]; boxes.forEach((b,i)=>{ b.checked=(arr && typeof arr[i]==="boolean")?arr[i]:true; }); }
function countTO(key){ return getTOState(key).filter(Boolean).length; }

function getTimeSecs(){ const s=fromMMSS(elTimeInput.value); return s==null?0:s; }
function setTimeSecs(secs){ elTimeInput.value = toMMSS(clamp(secs,0,1440)); }

// Quick -10/+10
elMiniBtns.forEach(b=>{
  b.addEventListener("click", ()=>{
    let secs = getTimeSecs();
    secs = clamp(secs + Number(b.dataset.dt), 0, 1440);
    setTimeSecs(secs); saveState(); updateClockHelper();
  });
});
elTimeInput.addEventListener("keydown", e=>{ if(e.key==="Enter"){ commitManualTime(); }});
elTimeInput.addEventListener("blur", commitManualTime);
function commitManualTime(){
  const secs=fromMMSS(elTimeInput.value);
  if(secs==null){ elTimeInput.classList.add("error"); return; }
  elTimeInput.classList.remove("error");
  setTimeSecs(secs); saveState(); updateClockHelper();
}

// ----- Log -----
const elLogList=document.getElementById("logList");
const elUndoLog=document.getElementById("undoLog");
const elClearLog=document.getElementById("clearLog");
const elExportLog=document.getElementById("exportLog");
function addLog(type, text, team){
  const entry = { t: Date.now(), clock: toMMSS(getTimeSecs()), half: elHalf2.checked?2:1, type, text, team };
  LOG.push(entry); renderLog(); saveState();
}
function renderLog(){
  elLogList.innerHTML = "";
  LOG.slice().reverse().forEach((e)=>{
    const div=document.createElement('div'); div.className='log-item';
    const teamBadge = e.team ? `<span class="log-team" style="color:${e.team==='our'?'var(--team)':'var(--opp)'}">${e.team==='our'?TEAM_NAME:STATE.oppName}</span>` : '';
    div.innerHTML = `<span class="log-time">${e.clock} ${e.half===2?'2H':'1H'}</span> ${teamBadge} ${e.text}`;
    elLogList.appendChild(div);
  });
}
elUndoLog.addEventListener('click', ()=>{ if(LOG.length){ LOG.pop(); renderLog(); saveState(); }});
elClearLog.addEventListener('click', ()=>{ if(confirm('Clear game log?')){ LOG.length=0; renderLog(); saveState(); }});
elExportLog.addEventListener('click', ()=>{
  const rows=[["time","half","team","type","text"]];
  LOG.forEach(e=> rows.push([e.clock, e.half, e.team||"", e.type, e.text]));
  const csv = rows.map(r=> r.map(x=> `"${String(x).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], {type:'text/csv'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='game_log.csv'; a.click();
});

// One-tap Use TO
document.getElementById("useOurTO").addEventListener("click", ()=>{ useTO('our'); });
document.getElementById("useOppTO").addEventListener("click", ()=>{ useTO('opp'); });
function useTO(side){
  const half2 = elHalf2.checked;
  const key = `${side}-${half2?'h2':'h1'}`;
  const g = getGroupEl(key); if(!g) return;
  const boxes=[...g.querySelectorAll('input[type="checkbox"]')];
  let idx=-1; for(let j=boxes.length-1;j>=0;j--){ if(boxes[j].checked){ idx=j; break; } }
  if(idx<0){ addLog('TO','(No TO left)', side); return; }
  boxes[idx].checked = false;
  addLog('TO','timeout used', side);
  saveState(); updateClockHelper();
}

// Quick score buttons
document.querySelectorAll('.chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const team = btn.dataset.team; const delta = Number(btn.dataset.delta||0);
    const our = Number(elOur.value||0), opp = Number(elOpp.value||0);
    if(team==='our'){ elOur.value = our + delta; addLog('SCORE', `+${delta} (${labelForDelta(delta)})`, 'our'); }
    else { elOpp.value = opp + delta; addLog('SCORE', `+${delta} (${labelForDelta(delta)})`, 'opp'); }
    saveState(); run();
  });
});
function labelForDelta(d){
  if(d===8) return "TD + 2pt";
  if(d===7) return "TD + PAT";
  if(d===6) return "TD (no conv)";
  if(d===3) return "FG";
  if(d===2) return "Safety / 2";
  return `+${d}`;
}

// ----- Clock helper -----
const elBallUs=document.getElementById("ballUs");
const elBallThem=document.getElementById("ballThem");
const elSnaps=document.getElementById("snaps");
const elPlayClock=document.getElementById("playClock");
const elPlayTime=document.getElementById("playTime");
const elClockResult=document.getElementById("clockResult");

[elBallUs, elBallThem, elSnaps, elPlayClock, elPlayTime].forEach(el=>{
  el.addEventListener("change", ()=>{ saveState(); updateClockHelper(); });
  el.addEventListener("input",  ()=>{ updateClockHelper(); });
});

function updateClockHelper(){
  const timeLeft=getTimeSecs();
  const snaps=clamp(Number(elSnaps.value||3),1,4);
  const pclk =clamp(Number(elPlayClock.value||40),20,45);
  const ptime=clamp(Number(elPlayTime.value||6),1,15);
  const half2=elHalf2.checked;

  const ourTO = half2 ? countTO("our-h2") : countTO("our-h1");
  const oppTO = half2 ? countTO("opp-h2") : countTO("opp-h1");

  if(elBallUs.checked){
    const burn = snaps*ptime + Math.max(0, snaps - oppTO)*pclk;
    const canBurn = Math.min(timeLeft, burn);
    const remain = Math.max(0, timeLeft - canBurn);
    elClockResult.innerHTML =
      `${TEAM_NAME} has ball. ${STATE.oppName} TOs: <b>${oppTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, est burn ≈ <b>${toMMSS(canBurn)}</b>. ` +
      (remain===0 ? `<b>You can run out the half.</b>` : `~<b>${toMMSS(remain)}</b> would remain.`);
  } else {
    const drain = snaps*ptime + Math.max(0, snaps - ourTO)*pclk;
    const canDrain = Math.min(timeLeft, drain);
    elClockResult.innerHTML =
      `${STATE.oppName} has ball. ${TEAM_NAME} TOs: <b>${ourTO}</b>. ` +
      `Over <b>${snaps}</b> snaps, they can drain ≈ <b>${toMMSS(canDrain)}</b>. ` +
      `Using our TOs reduces between-play bleed up to <b>${ourTO}</b> times.`;
  }
}

// ===== PAT vs 2-pt helper =====
function updatePatAdvice(){
  const xp = clamp(Number(elXp.value||0),0,100)/100;
  const tw = clamp(Number(elTwo.value||0),0,100)/100;
  const pick = (2*tw > xp) ? "Go for 2" : "Kick PAT";
  elPatAdvice.innerHTML = `<b>${pick}</b> • XP E[pts]=${(xp).toFixed(2)}, 2-pt E[pts]=${(2*tw).toFixed(2)} • Break-even 2-pt ≈ ${(xp/2*100).toFixed(1)}%`;
  STATE.xpPct = Math.round(xp*100); STATE.twoPct = Math.round(tw*100); saveState();
}
elXp.addEventListener('input', updatePatAdvice);
elTwo.addEventListener('input', updatePatAdvice);

// ----- State -----
const STATE_KEY="ccs-voice-state-v1";
let LOG = [];
let STATE = { oppName:"Opponent", oppColor:"#9a9a9a", xpPct:95, twoPct:45 };

function saveState(){
  const s={
    our:Number(elOur.value||0), opp:Number(elOpp.value||0),
    half: elHalf2.checked?2:1,
    time: getTimeSecs(),
    to: { "our-h1": getTOState("our-h1"), "opp-h1": getTOState("opp-h1"), "our-h2": getTOState("our-h2"), "opp-h2": getTOState("opp-h2") },
    oppName: STATE.oppName, oppColor: STATE.oppColor,
    xpPct: STATE.xpPct, twoPct: STATE.twoPct,
    log: LOG
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}
function loadState(){
  try{
    const s=JSON.parse(localStorage.getItem(STATE_KEY)||"{}");
    if("our" in s) elOur.value=s.our;
    if("opp" in s) elOpp.value=s.opp;
    (s.half===2?elHalf2:elHalf1).checked=true;
    setTimeSecs(typeof s.time==="number"? s.time : 1440);

    if(s.to){ Object.keys(s.to).forEach(k=> setTOState(k, s.to[k])); }
    else { ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true])); }

    STATE.oppName = s.oppName || "Opponent";
    STATE.oppColor = s.oppColor || "#9a9a9a";
    applyOpponentProfile();

    STATE.xpPct = typeof s.xpPct==="number" ? s.xpPct : 95;
    STATE.twoPct = typeof s.twoPct==="number" ? s.twoPct : 45;
    elXp.value = STATE.xpPct; elTwo.value = STATE.twoPct;
    updatePatAdvice();

    LOG = Array.isArray(s.log) ? s.log : [];
    renderLog();
  }catch(e){
    setTimeSecs(1440);
    ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
  }
}

// Opponent profile
function applyOpponentProfile(){
  elOppName.value = STATE.oppName;
  elOppColor.value = STATE.oppColor;
  document.documentElement.style.setProperty('--opp', STATE.oppColor);
  elOppLabel.textContent = STATE.oppName;
}
elOppName.addEventListener('input', ()=>{ STATE.oppName = elOppName.value.trim() || "Opponent"; applyOpponentProfile(); saveState(); run(); });
elOppColor.addEventListener('input', ()=>{ STATE.oppColor = elOppColor.value; applyOpponentProfile(); saveState(); });

// ----- Voice recognition -----
const micBtn = document.getElementById('micBtn');
const micStatus = document.getElementById('micStatus');
const micIcon = document.getElementById('micIcon');
const micText = document.getElementById('micText');

let recognition = null;
let listening = false;

function supportsVoice(){
  return ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
}
function setupVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){
    micBtn.disabled = true;
    micStatus.textContent = 'Voice not supported on this browser/device.';
    return;
  }
  recognition = new SR();
  recognition.lang = 'en-US';
  recognition.continuous = false;
  recognition.interimResults = true;

  recognition.onstart = () => {
    listening = true;
    micBtn.classList.add('on');
    micStatus.textContent = 'Listening…';
    micStatus.classList.add('listening');
    micText.textContent = 'Stop';
  };
  recognition.onend = () => {
    listening = false;
    micBtn.classList.remove('on');
    micStatus.classList.remove('listening');
    micText.textContent = 'Start';
  };
  recognition.onerror = (e) => {
    micStatus.textContent = `Voice error: ${e.error || 'unknown'}`;
  };
  recognition.onresult = (event) => {
    let final = '';
    for (let i=event.resultIndex; i<event.results.length; i++){
      const res = event.results[i];
      if (res.isFinal) final += res[0].transcript + ' ';
    }
    final = final.trim();
    if(final){
      const out = handleVoice(final);
      micStatus.textContent = out;
    }
  };

  micBtn.addEventListener('click', ()=>{
    if(!listening){ try{ recognition.start(); }catch(_){} }
    else { try{ recognition.stop(); }catch(_){} }
  });
}

// Parse helpers
const WORD_NUM = { two:2, three:3, six:6, seven:7, eight:8 };
function numFromWordOrDigit(s){
  s=s.toLowerCase();
  if(WORD_NUM[s] != null) return WORD_NUM[s];
  const n = parseInt(s,10); return Number.isNaN(n)?null:n;
}
function parseTimeUtterance(t){
  t = t.toLowerCase().replace(/\./g,'').replace(/seconds?/g,' sec').replace(/minutes?/g,' min').replace(/for /,'').trim();
  // 2:11
  const c = t.match(/(\d{1,2})\s*[:]\s*([0-5]?\d)/);
  if(c) return clamp(parseInt(c[1],10)*60 + parseInt(c[2],10), 0, 1440);
  // "2 min 11 sec" or "2 min" or "131 sec"
  const m = t.match(/(?:(\d{1,2})\s*min)?\s*(?:(\d{1,2})\s*sec)?/);
  if(m && (m[1] || m[2])){
    const mm = parseInt(m[1]||'0',10), ss=parseInt(m[2]||'0',10);
    return clamp(mm*60 + ss, 0, 1440);
  }
  // "2 11"
  const sp = t.match(/^\s*(\d{1,2})\s+([0-5]?\d)\s*$/);
  if(sp) return clamp(parseInt(sp[1],10)*60 + parseInt(sp[2],10),0,1440);
  // single number => minutes
  const only = t.match(/^\d{1,3}$/);
  if(only) return clamp(parseInt(only[0],10)*60, 0, 1440);
  return null;
}

// Voice command router
function handleVoice(raw){
  const text = raw.toLowerCase().trim();

  // Set clock
  let m = text.match(/^(set|adjust)\s*(the\s*)?(game\s*)?clock\s*(to|for|at)?\s*(.+)$/);
  if(m){
    const secs = parseTimeUtterance(m[5] || '');
    if(secs==null) return `Heard “${raw}” — invalid time. Say “set clock to 2:11”.`;
    setTimeSecs(secs); saveState(); updateClockHelper();
    addLog('CLOCK', `clock set to ${toMMSS(secs)}`); return `Clock set to ${toMMSS(secs)}`;
  }

  // Timeout
  if(/^(our|charlotte christian)\s*(time\s*out|timeout)$/.test(text) || /^timeout$/.test(text)){
    useTO('our'); return 'Used Charlotte Christian timeout';
  }
  if(/^(their|opponent|them)\s*(time\s*out|timeout)$/.test(text) || /^opponent timeout$/.test(text)){
    useTO('opp'); return 'Used opponent timeout';
  }

  // Add score: "add seven [team]" / "touchdown ... with pat / go for two"
  m = text.match(/^(add|plus|\+)\s*(two|three|six|seven|eight|2|3|6|7|8)\s*(for\s*)?(charlotte christian|us|we|our|opponent|them|they)?/);
  if(m){
    const pts = numFromWordOrDigit(m[2]);
    const teamWord = (m[4]||'').trim();
    const team = /opponent|them|they/.test(teamWord) ? 'opp' : 'our';
    addPoints(team, pts);
    return `Added ${pts} to ${team==='our'?TEAM_NAME:STATE.oppName}`;
  }

  // Touchdown intent
  m = text.match(/^touchdown(?:\s+(charlotte christian|us|we|our|opponent|them|they))?(?:.*\b(pat|extra point|kick)\b|.*\b(two|2)\b)?/);
  if(m){
    const team = /opponent|them|they/.test(m[1]||'') ? 'opp' : 'our';
    const want2 = !!m[3];
    const wantPat = !!m[2];
    const pts = want2 ? 8 : wantPat ? 7 : 6;
    addPoints(team, pts);
    return `Touchdown: +${pts} to ${team==='our'?TEAM_NAME:STATE.oppName}`;
  }

  // Calculate
  if(/^calculate|recalculate|compute$/.test(text)){
    run(); return 'Updated options';
  }

  // Opponent name
  m = text.match(/^(set\s+)?opponent\s+(name\s+to|is)\s+(.+)$/);
  if(m){
    STATE.oppName = m[3].trim();
    applyOpponentProfile(); saveState(); run();
    return `Opponent set to ${STATE.oppName}`;
  }

  return `Heard “${raw}” — command not recognized. Try “set clock to 2:11”, “timeout”, or “add seven Charlotte Christian”.`;
}
function addPoints(team, delta){
  const our = Number(elOur.value||0), opp = Number(elOpp.value||0);
  if(team==='our'){ elOur.value = our + delta; addLog('SCORE', `+${delta} (${labelForDelta(delta)})`, 'our'); }
  else { elOpp.value = opp + delta; addLog('SCORE', `+${delta} (${labelForDelta(delta)})`, 'opp'); }
  saveState(); run();
}

// ----- Main scoring run -----
elCalc.addEventListener("click", run);
[elOur,elOpp].forEach(el=>el.addEventListener("keydown", e=>{ if(e.key==="Enter") run(); }));
[document.getElementById('half1'), document.getElementById('half2')].forEach(el=> el.addEventListener('change', ()=>{ saveState(); updateClockHelper(); }));

function run(){
  elOut.innerHTML=""; elStatus.textContent="";

  const our=validateInt(elOur.value.trim());
  const opp=validateInt(elOpp.value.trim());
  if(our==null || opp==null){ elStatus.textContent="Enter both scores."; return; }

  renderBanner(our, opp, STATE.oppName);

  const cap=Math.max(1, Number(elCap.value||200));

  // Who needs points?
  let who="auto"; if(whoUs.checked) who="us"; if(whoOpp.checked) who="opp";
  let teamNeeding = who==="auto" ? (our>opp?"opp":our<opp?"us":"either") : who;

  const diff=Math.abs(our-opp);
  const tieTarget=diff, leadTarget=diff+1;

  const teamLabel = teamNeeding==="us" ? `${TEAM_NAME} needs` :
                    teamNeeding==="opp"? `${STATE.oppName} needs` : `Either team needs`;

  const tieRes = buildItems(tieTarget, cap);
  const leadRes= buildItems(leadTarget, cap);

  const titlePrefix = `${teamLabel} to…`;
  renderSection(`${titlePrefix} Tie`, tieRes);
  renderSection(`${titlePrefix} Take the Lead`, leadRes);

  const usBehind=Math.max(0, opp-our), oppBehind=Math.max(0, our-opp);
  elStatus.textContent =
    `Score: ${TEAM_NAME} ${our} — ${STATE.oppName} ${opp} • ${TEAM_NAME} behind: ${usBehind} • ${STATE.oppName} behind: ${oppBehind}. Showing exact-point combos.`;

  saveState();
}

// ----- Init -----
loadState();
updateClockHelper();
run();
if (supportsVoice()) setupVoice(); else {
  const ms = document.getElementById('micStatus');
  ms.textContent = 'Voice not supported on this browser/device.';
}

// Reset
document.getElementById("resetGame").addEventListener("click", ()=>{
  elOur.value=0; elOpp.value=0;
  document.getElementById("half1").checked=true;
  setTimeSecs(1440);
  ["our-h1","opp-h1","our-h2","opp-h2"].forEach(k=> setTOState(k,[true,true,true]));
  LOG.length=0; renderLog();
  STATE.oppName = elOppName.value.trim() || "Opponent";
  saveState(); run(); updateClockHelper();
});
