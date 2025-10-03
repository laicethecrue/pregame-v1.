// ===== ÉTAT =====
const state = {
  page: "menu",
  points: 0,
  // respiration
  breath: { step: 0, inCycle: 0, timeLeft: 0, tick: null, running: false },
  // visualisation
  viz: { idx: 0, auto: true, tick: null, timeLeft: 10 },
  // décisions
  dec: { i: 0, tried: {}, done: 0 },
  // affirmations / checklist
  aff: { i: 0, checked: [] },
  data: { breathe:{pattern:[4,4,4,4], cycles:4}, visualize:[], decisions:[], affirm:[], checklist:[] }
};

// ===== CHARGEMENT =====
async function loadData(){
  try {
    const r = await fetch("./pregames.json");
    state.data = await r.json();
  } catch(e){ console.error(e); }
  render();
}

// ===== OUTILS =====
function go(p){ state.page=p; render(); }
function rewardBadge(p){ return p>=60?"🏆 Or":p>=30?"🥈 Argent":"🥉 Bronze"; }
function stopAllTimers(){
  clearInterval(state.breath.tick); state.breath.tick = null; state.breath.running=false;
  clearInterval(state.viz.tick); state.viz.tick = null;
}
function todayStr(){ return new Date().toISOString().slice(0,10); }
function saveResult(kind, pts){
  const key="pg_v1_log";
  let log=[]; try{ log=JSON.parse(localStorage.getItem(key)||"[]"); }catch(e){}
  log.unshift({date: todayStr(), kind, pts});
  localStorage.setItem(key, JSON.stringify(log.slice(0,100)));
}

// ====== RESPIRATION (Box 4-4-4-4 par défaut) ======
function breathStart(){
  const {pattern, cycles} = state.data.breathe;
  Object.assign(state.breath, { step:0, inCycle:0, timeLeft: pattern[0], running:true });
  clearInterval(state.breath.tick);
  state.breath.tick = setInterval(()=>{
    if (!state.breath.running) return;
    state.breath.timeLeft--;
    if (state.breath.timeLeft<=0){
      // étape suivante
      state.breath.step = (state.breath.step+1)%4;
      if (state.breath.step===0){
        state.breath.inCycle++;
        if (state.breath.inCycle>=cycles){
          clearInterval(state.breath.tick);
          state.breath.running=false;
          state.points += 10;
          saveResult("breathe",10);
          alert("✅ Respiration terminée (+10 pts)");
          go("visualize");
          return;
        }
      }
      state.breath.timeLeft = pattern[state.breath.step];
    }
    renderProgress();
  }, 1000);
  go("breathe");
}
function breathLabel(){
  const L = ["Inspire","Garde","Expire","Garde"];
  return L[state.breath.step] || "Respire";
}

// ====== VISUALISATION ======
function vizStart(){
  state.viz.idx=0; state.viz.timeLeft=10; state.viz.auto=true;
  clearInterval(state.viz.tick);
  state.viz.tick = setInterval(()=>{
    if (!state.viz.auto) return;
    state.viz.timeLeft = Math.max(0, state.viz.timeLeft-1);
    const bar=document.getElementById("vizbar"); if(bar) bar.style.width = (100 - state.viz.timeLeft*10) + "%";
    const t=document.getElementById("viztime"); if(t) t.textContent = state.viz.timeLeft+"s";
    if (state.viz.timeLeft===0){
      state.viz.idx++;
      if (state.viz.idx>=state.data.visualize.length){
        clearInterval(state.viz.tick);
        state.points += 10; saveResult("visualize",10);
        alert("✅ Visualisation terminée (+10 pts)");
        go("decisions"); return;
      }
      state.viz.timeLeft=10;
      render();
    }
  }, 1000);
  go("visualize");
}
function vizNext(){ state.viz.idx++; state.viz.timeLeft=10; render(); }
function vizToggle(){ state.viz.auto=!state.viz.auto; render(); }

// ====== DÉCISIONS RAPIDES ======
function decStart(){ state.dec.i=0; state.dec.tried={}; state.dec.done=0; go("decisions"); }
function decAnswer(j){
  const q = state.data.decisions[state.dec.i];
  const k = state.dec.i;
  if (!state.dec.tried[k]) state.dec.tried[k]=[];
  if (q.a===j){
    const first = state.dec.tried[k].length===0;
    if (first){ state.points += (q.p||5); }
    alert(first ? `✅ Bonne réponse (+${q.p||5} pts)` : "✅ Bonne réponse (0 pt)");
    state.dec.done++; state.dec.i++;
    if (state.dec.i>=state.data.decisions.length){
      saveResult("decisions", state.dec.done*(q.p||5));
      alert("🧠 Décisions : terminé");
      go("affirm"); return;
    }
    render();
  } else {
    if (!state.dec.tried[k].includes(j)) state.dec.tried[k].push(j);
    alert("❌ Essaie encore");
    render();
  }
}

// ====== AFFIRMATIONS / CHECKLIST ======
function affStart(){ state.aff.i=0; state.aff.checked=[]; go("affirm"); }
function affConfirm(){ state.aff.i++; render(); }
function chkToggle(i){
  const box = document.getElementById("chk-"+i);
  if (!box) return;
  if (box.checked) { if(!state.aff.checked.includes(i)) state.aff.checked.push(i); }
  else { state.aff.checked = state.aff.checked.filter(x=>x!==i); }
}
function finishAll(){
  // Points : affirm + checklist
  const affPts = Math.min(state.data.affirm.length, state.aff.i) * 1; // 1pt par affirmation validée
  const chkPts = state.aff.checked.length * 1; // 1pt par élément coché
  const gained = affPts + chkPts;
  state.points += gained;
  saveResult("affirm+check", gained);

  const total = state.points;
  alert(`🏁 Rituel terminé • +${gained} pts • Total ${total} (${rewardBadge(total)})`);
  go("menu");
}

// ====== VUES ======
const V = {};
function header(){
  return `<div class="card"><div class="kv"><span><b>Points</b></span><b>${state.points} • ${rewardBadge(state.points)}</b></div></div>`;
}

V.menu = () => `
  <h2>Routine d’avant-match</h2>
  ${header()}
  <div class="card">
    <div class="badge">Conseil</div>
    <p class="tip">Laisse jouer ta musique. L’app est silencieuse par défaut.</p>
  </div>
  <button data-act="breathe">🫁 Respiration (2–3 min)</button>
  <button data-act="visualize">🎧 Visualisation (1–2 min)</button>
  <button data-act="decisions">🧩 Décisions rapides (1–2 min)</button>
  <button data-act="affirm">✅ Affirmations & Checklist (1 min)</button>
`;

V.breathe = () => {
  const {pattern, cycles} = state.data.breathe;
  const step = state.breath.step, cycle=state.breath.inCycle+1;
  return `
    ${header()}
    <h2>🫁 Respiration guidée</h2>
    <div class="card">
      <div class="badge">Box ${pattern.join("-")} • Cycle ${cycle}/${cycles}</div>
      <div class="big">${breathLabel()}</div>
      <div class="progress"><span id="bbar" style="width:${Math.max(0,(state.breath.timeLeft || pattern[0]))/pattern[step]*100}%"></span></div>
      <p class="tip">Regarde le mot et respire calmement (musique OK).</p>
      <div class="row">
        ${state.breath.running ? `<button data-act="bpause">⏸️ Pause</button>` : `<button data-act="bstart">▶️ Démarrer</button>`}
        <button data-act="breset">🔄 Recommencer</button>
        <button data-act="menu">⬅ Menu</button>
      </div>
    </div>
  `;
};

function renderProgress(){
  const p = document.getElementById("bbar");
  const {pattern} = state.data.breathe;
  const step = state.breath.step;
  if (p && pattern[step]>0){
    const ratio = Math.max(0, state.breath.timeLeft)/pattern[step]*100;
    p.style.width = ratio + "%";
  }
}

V.visualize = () => {
  const steps = state.data.visualize;
  const i = Math.min(state.viz.idx, steps.length-1);
  const txt = steps[i] || "Terminé";
  return `
    ${header()}
    <h2>🎧 Visualisation</h2>
    <div class="card">
      <div class="badge">Étape ${i+1}/${steps.length} • Auto: ${state.viz.auto?"ON":"OFF"}</div>
      <div class="progress"><span id="vizbar" style="width:${(100 - state.viz.timeLeft*10)}%"></span></div>
      <p class="big">${txt}</p>
      <div class="row">
        <button data-act="vprev">⬅</button>
        <button data-act="vtoggle">${state.viz.auto?"⏸️ Auto OFF":"▶️ Auto ON"}</button>
        <button data-act="vnext">➡</button>
      </div>
      <p id="viztime" class="tip" style="text-align:center">${state.viz.timeLeft}s</p>
      <button data-act="toDec">Passer aux Décisions</button>
    </div>
  `;
};

V.decisions = () => {
  const q = state.data.decisions[state.dec.i];
  if (!q) return `${header()}<p>Terminé.</p><button data-act="toAff">➡ Affirmations</button>`;
  const tried = state.dec.tried[state.dec.i]||[];
  return `
    ${header()}
    <h2>🧩 Décisions rapides</h2>
    <div class="card">
      <div class="badge">Carte ${state.dec.i+1}/${state.data.decisions.length}</div>
      <p class="big">${q.s}</p>
      ${q.o.map((opt,j)=>{
        const cls = (j===q.a && tried.length>0) ? "correct" : (tried.includes(j) ? "wrong" : "");
        return `<button class="${cls} q" data-j="${j}">${opt}</button>`;
      }).join("")}
      <button data-act="toAff">➡ Affirmations</button>
    </div>
  `;
};

V.affirm = () => {
  const i = state.aff.i;
  const a = state.data.affirm[i];
  const checklist = state.data.checklist.map((t,ix)=>`
    <label class="chk"><input id="chk-${ix}" type="checkbox" ${state.aff.checked.includes(ix)?"checked":""} onchange="chkToggle(${ix})"> ${t}</label>
  `).join("");
  return `
    ${header()}
    <h2>✅ Affirmations & Checklist</h2>
    <div class="card">
      ${a ? `<div class="badge">Affirmation ${i+1}/${state.data.affirm.length}</div>
             <p class="big">“${a}”</p>
             <button data-act="affOK">Je m'engage</button>`
          : `<p class="big">Affirmations terminées.</p>`}
    </div>
    <div class="card">
      <div class="badge">Checklist</div>
      ${checklist}
      <button data-act="finish">🏁 Terminer le rituel</button>
      <button data-act="menu">⬅ Menu</button>
    </div>
  `;
};

// ===== RENDU =====
function render(){
  const root=document.getElementById("app");
  const html = V[state.page] ? V[state.page]() : "<p>Chargement…</p>";
  root.innerHTML = html;
}

// ===== CLICS =====
document.addEventListener("click",(e)=>{
  const b=e.target.closest("button"); if(!b) return;
  const act=b.getAttribute("data-act");

  // nav
  if(act==="menu"){ stopAllTimers(); go("menu"); return; }

  // respiration
  if(act==="breathe"){ breathStart(); return; }
  if(act==="bstart"){ state.breath.running=true; return; }
  if(act==="bpause"){ state.breath.running=false; return; }
  if(act==="breset"){ stopAllTimers(); breathStart(); return; }

  // visualisation
  if(act==="visualize"){ vizStart(); return; }
  if(act==="vprev"){ state.viz.idx=Math.max(0,state.viz.idx-1); state.viz.timeLeft=10; render(); return; }
  if(act==="vnext"){ vizNext(); return; }
  if(act==="vtoggle"){ vizToggle(); return; }
  if(act==="toDec"){ stopAllTimers(); decStart(); return; }

  // décisions
  if(act==="decisions"){ decStart(); return; }
  if(b.classList.contains("q")){ const j=Number(b.getAttribute("data-j")); decAnswer(j); return; }
  if(act==="toAff"){ affStart(); return; }

  // affirm/check
  if(act==="affirm"){ affStart(); return; }
  if(act==="affOK"){ affConfirm(); return; }
  if(act==="finish"){ finishAll(); return; }
});

// ===== INIT =====
loadData();
