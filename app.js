(() => {
  const W = window.WORDS, CATS = window.CATEGORIES;
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const app = document.getElementById("app");
  const KEY = "be850-progress-v1", TKEY = "be850-theme";
  const DAY = 864e5, MIN = 6e4, INT = [0,1,2,4,8,16].map(d => d*DAY), MASTER = 4, NEWB = 10;

  // ---------- data / SRS ----------
  let prog = load();
  function load(){ try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } }
  function save(){ localStorage.setItem(KEY, JSON.stringify(prog)); }
  function rec(w){ return prog[w] || (prog[w] = { box:0, due:0, seen:false }); }
  function grade(w, g){
    const r = rec(w); r.seen = true;
    if (g === 0){ r.box = 0; r.due = Date.now() + MIN; }
    else if (g === 1){ r.box = Math.max(1, r.box); r.due = Date.now() + Math.max(10*MIN, INT[Math.min(r.box,5)]*0.5); }
    else { r.box = Math.min(5, r.box+1); r.due = Date.now() + INT[r.box]; }
    save();
  }
  const isSeen = w => !!(prog[w] && prog[w].seen);
  const isDue  = w => { const r = prog[w]; return !!(r && r.seen && r.due <= Date.now()); };
  const seenCount = cat => W.filter(o => (!cat || o.c===cat) && isSeen(o.w)).length;
  const dueWords  = cat => W.filter(o => (!cat || o.c===cat) && isDue(o.w)).sort((a,b)=>prog[a.w].due-prog[b.w].due);
  const newWords  = (n,cat) => W.filter(o => (!cat || o.c===cat) && !isSeen(o.w)).slice(0,n);
  const wordsIn   = cat => W.filter(o => o.c===cat);
  const hardWords = () => W.filter(o => { const r = prog[o.w]; return r && r.seen && r.box <= 1; });
  function batch(n, cat){ let r = dueWords(cat); if (r.length < n) r = r.concat(newWords(n-r.length, cat)); return r.slice(0,n); }
  function shuffle(a){ a = a.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function distractors(word, n){
    let pool = W.filter(o => o.w!==word.w && o.zh!==word.zh && o.c===word.c);
    if (pool.length < n) pool = pool.concat(W.filter(o => o.w!==word.w && o.zh!==word.zh && o.c!==word.c));
    const seen = new Set(), out = [];
    for (const o of shuffle(pool)){ if (!seen.has(o.zh)){ seen.add(o.zh); out.push(o.zh); if (out.length===n) break; } }
    return out;
  }

  // ---------- audio ----------
  let curAudio = null;
  function speak(w){
    if (!w) return;
    try {
      if (curAudio) curAudio.pause();
      curAudio = new Audio("audio/" + encodeURIComponent(w) + ".mp3");
      curAudio.play().catch(() => fallbackSpeak(w));
    } catch { fallbackSpeak(w); }
  }
  function fallbackSpeak(w){
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; u.rate = .9;
    speechSynthesis.speak(u);
  }

  // ---------- theme ----------
  function applyTheme(){
    const t = localStorage.getItem(TKEY) || "dark";
    document.documentElement.dataset.theme = t;
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.content = t === "light" ? "#f3f5fb" : "#0f1115";
  }
  function toggleTheme(){
    const t = (localStorage.getItem(TKEY) || "dark") === "dark" ? "light" : "dark";
    localStorage.setItem(TKEY, t); applyTheme(); renderHome();
  }

  const dot = c => `<i style="background:var(--${c})"></i>`;
  let screen = "home";

  // ================= HOME =================
  function renderHome(){
    screen = "home";
    const total = W.length, studied = seenCount();
    const pct = Math.round(studied/total*100);
    const segs = CATS.map(c => `<div class="bar-seg" style="width:${seenCount(c.id)/total*100}%;background:var(--${c.id})"></div>`).join("");
    const legend = CATS.map(c => `<span>${dot(c.id)}${c.zh} ${seenCount(c.id)}/${wordsIn(c.id).length}</span>`).join("");
    const due = dueWords().length;
    const hard = hardWords().length;
    const themeIcon = (localStorage.getItem(TKEY)||"dark")==="dark" ? "☀️" : "🌙";

    const cats = CATS.map(c => {
      const m = seenCount(c.id), tot = wordsIn(c.id).length, p = Math.round(m/tot*100);
      return `<div class="cat-row" data-act="cat" data-id="${c.id}">
        <div class="cat-dot" style="background:var(--${c.id})"></div>
        <div class="cat-meta">
          <div class="cat-name">${c.name}<em>${c.zh}</em></div>
          <div class="cat-desc">${c.desc}</div>
          <div class="cat-mini"><i style="width:${p}%;background:var(--${c.id})"></i></div>
        </div>
        <div class="cat-prog"><b>${m}/${tot}</b>${p}%</div>
      </div>`;
    }).join("");

    app.innerHTML = `<div class="screen">
      <div class="home-head">
        <div>
          <div class="brand">Basic English<span>850</span></div>
          <div class="tagline">Ogden 基础英语 · 850 词通关</div>
        </div>
        <button class="theme-btn" data-act="theme">${themeIcon}</button>
      </div>

      <div class="overall">
        <div class="overall-top">
          <div class="overall-num">${studied}<small>/ ${total} 词已学</small></div>
          <div class="overall-label">${pct}% 通关</div>
        </div>
        <div class="bar-track">${segs}</div>
        <div class="legend">${legend}</div>
      </div>

      <div class="actions">
        <button class="act ${due>0?'filled':''}" data-act="review">
          <span class="t">开始复习</span>
          <span class="s">${due>0?`今日 ${due} 张待复习`:"暂无到期，去学新词"}</span>
        </button>
        <button class="act ${due===0?'filled':''}" data-act="learn">
          <span class="t">学习新词</span><span class="s">每次 ${NEWB} 个</span>
        </button>
      </div>

      <div class="sec-title">练习模式</div>
      <div class="tiles">
        <button class="tile" data-act="quiz"><span class="ic">📝</span><span class="t">选择题</span><span class="s">4 选 1</span></button>
        <button class="tile" data-act="speed"><span class="ic">⚡️</span><span class="t">极速刷词</span><span class="s">快速过词</span></button>
        <button class="tile ${hard===0?'disabled':''}" data-act="hard"><span class="ic">🔥</span><span class="t">难词本</span><span class="s">${hard>0?hard+" 个":"暂无"}</span></button>
        <button class="tile" data-act="zhen"><span class="ic">🔁</span><span class="t">中 → 英</span><span class="s">反向回忆</span></button>
        <button class="tile" data-act="listen"><span class="ic">👂</span><span class="t">纯听音</span><span class="s">听音辨义</span></button>
      </div>

      <div class="sec-title">按分类浏览</div>
      <div class="cat-list">${cats}</div>

      <div class="foot"><button class="link" data-act="reset">重置全部进度</button></div>
    </div>`;
  }

  // ================= BROWSE =================
  function renderBrowse(catId){
    screen = "browse";
    const c = CAT[catId];
    const list = wordsIn(catId);
    const unseen = list.filter(o => !isSeen(o.w));
    const due = dueWords(catId);
    const chip = (act, label, n, tint, dis) =>
      `<button class="chip ${dis?'disabled':''}" data-act="${act}" data-id="${catId}">
        ${label}${n!=null?`<span class="n" style="color:var(--${tint});background:color-mix(in srgb,var(--${tint}) 18%,transparent)">${n}</span>`:""}
      </button>`;
    const rows = list.map(o => `<div class="wrow ${isSeen(o.w)?'seen':''}">
        <span class="en">${o.w}</span>${isSeen(o.w)?'<span class="ck">✓</span>':''}
        <span class="zh">${o.zh}</span>
        <button class="spk" data-act="say" data-w="${o.w}">🔊</button>
      </div>`).join("");

    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">${c.name}<small>${c.zh}</small></div>
        <span class="count"></span>
      </div>
      <div class="card action-card">
        <div class="h">学这一类（${c.zh}）</div>
        <div class="chips">
          ${chip("b-learn","学新词",unseen.length,"accent",unseen.length===0)}
          ${chip("b-review","复习",due.length,"gen",due.length===0)}
          ${chip("b-quiz","选择题",null,"op",false)}
          ${chip("b-zhen","中 → 英",null,"pic",false)}
          ${chip("b-listen","纯听音",null,"qual",false)}
        </div>
      </div>
      <div class="words">${rows}</div>
    </div>`;
  }

  // ================= STUDY (en / zh / listen) =================
  let study = null;
  function startStudy(list, title, mode){
    if (!list.length) return;
    study = { list, idx:0, revealed:false, mode, title };
    screen = "study";
    renderStudy();
    if (mode === "en" || mode === "listen") speak(cur().w);
  }
  const cur = () => study.list[study.idx];
  function renderStudy(){
    const s = study;
    if (s.idx >= s.list.length){ renderStudyDone(); return; }
    const o = cur(), c = CAT[o.c];
    let front, back = "", hint;
    if (s.mode === "en"){ front = `<div class="word">${o.w}</div>`; hint = "点击卡片看释义"; }
    else if (s.mode === "zh"){ front = `<div class="zh-front">${o.zh}</div>`; hint = "点击卡片看单词"; }
    else { front = `<button class="listen-spk" data-act="replay">🔊</button>`; hint = "点击 🔊 再听一次 · 点卡片看答案"; }
    if (s.revealed){
      if (s.mode === "en") back = `<div class="divider"></div><div class="back-zh">${o.zh}</div>`;
      else if (s.mode === "zh") back = `<div class="divider"></div><div class="back-en">${o.w}</div>`;
      else back = `<div class="divider"></div><div class="back-listen"><div class="e">${o.w}</div><div class="z">${o.zh}</div></div>`;
    }
    const showSpk = s.mode==="en" || s.mode==="listen" || s.revealed;
    const sub = s.mode==="en" ? "" : `<small>${s.title.includes("→")||s.mode==="listen"?(s.mode==="zh"?"中 → 英":"听音"):""}</small>`;
    app.innerHTML = `<div class="screen stage">
      <div class="bar">
        <button class="back" data-act="home">‹ 退出</button>
        <div class="ttl">${s.title}</div>
        <span class="count">${s.idx+1}/${s.list.length}</span>
      </div>
      <div class="flash" data-act="reveal">
        <div class="cat">${dot(o.c)}${c.name}</div>
        ${showSpk?`<button class="spk-btn" data-act="say" data-w="${o.w}">🔊</button>`:""}
        ${front}${back}
        <div class="hint">${s.revealed?"":hint}</div>
      </div>
      <div class="rates ${s.revealed?'':'locked'}">
        <button class="rate again" data-act="grade" data-g="0">不认识<small>很快再见</small></button>
        <button class="rate hard"  data-act="grade" data-g="1">模糊<small>稍后再见</small></button>
        <button class="rate good"  data-act="grade" data-g="2">认识<small>记住了</small></button>
      </div>
    </div>`;
  }
  function reveal(){
    if (!study || study.revealed) return;
    study.revealed = true; renderStudy();
    if (study.mode === "zh") speak(cur().w);
  }
  function gradeStudy(g){
    if (!study || !study.revealed) return;
    grade(cur().w, g);
    study.idx++; study.revealed = false; renderStudy();
    if (study.idx < study.list.length && (study.mode==="en"||study.mode==="listen")) speak(cur().w);
  }
  function renderStudyDone(){
    app.innerHTML = doneHTML("🎉", "这一组完成啦", "");
  }

  // ================= QUIZ =================
  let quiz = null;
  function startQuiz(list){
    if (!list.length) return;
    quiz = { list, idx:0, score:0, opts:[], correct:0, picked:null };
    screen = "quiz"; prepareQuiz(); renderQuiz();
  }
  function prepareQuiz(){
    const q = quiz; if (q.idx >= q.list.length) return;
    const w = q.list[q.idx];
    let opts = distractors(w, 3);
    const pos = Math.random()*(opts.length+1)|0;
    opts.splice(pos, 0, w.zh);
    q.opts = opts; q.correct = pos; q.picked = null;
    speak(w.w);
  }
  function renderQuiz(){
    const q = quiz;
    if (q.idx >= q.list.length){
      app.innerHTML = doneHTML(q.score===q.list.length?"🏆":"🎉", `答对 ${q.score}/${q.list.length}`,
        q.score===q.list.length?"全对！太强了":"继续加油");
      return;
    }
    const w = q.list[q.idx], c = CAT[w.c];
    const opts = q.opts.map((o,i) => {
      let cls = "";
      if (q.picked!=null){ if (i===q.correct) cls="correct"; else if (i===q.picked) cls="wrong"; }
      let mk = "";
      if (q.picked!=null){ if (i===q.correct) mk='<span class="mk">✅</span>'; else if (i===q.picked) mk='<span class="mk">❌</span>'; }
      return `<button class="opt ${cls}" data-act="opt" data-i="${i}"><span class="k">${i+1}</span>${o}${mk}</button>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 退出</button>
        <div class="ttl">选择题测验</div>
        <span class="count">${q.idx+1}/${q.list.length}</span>
      </div>
      <div class="q-card">
        <div class="cat" style="justify-content:center;display:flex;gap:6px;color:var(--muted);font-size:12px">${dot(w.c)}${c.name}</div>
        <div class="q-word">${w.w}</div>
        <button class="spk-btn" style="position:static;margin:0 auto" data-act="say" data-w="${w.w}">🔊</button>
        <div style="color:var(--muted);font-size:12px;margin-top:10px">选择正确的中文释义</div>
      </div>
      <div class="opts">${opts}</div>
    </div>`;
  }
  function pickQuiz(i){
    const q = quiz; if (q.picked != null || q.idx >= q.list.length) return;
    q.picked = i;
    const right = i === q.correct;
    if (right) q.score++;
    grade(q.list[q.idx].w, right ? 2 : 0);
    renderQuiz();
    setTimeout(() => { q.idx++; prepareQuiz(); renderQuiz(); }, right ? 650 : 1250);
  }

  // ================= SPEED =================
  let speed = null;
  function startSpeed(list){
    if (!list.length) return;
    speed = { list, idx:0 }; screen = "speed"; renderSpeed(); speak(list[0].w);
  }
  function renderSpeed(){
    const s = speed;
    if (s.idx >= s.list.length){ app.innerHTML = doneHTML("⚡️","刷完这一组",""); return; }
    const o = s.list[s.idx], c = CAT[o.c];
    app.innerHTML = `<div class="screen stage">
      <div class="bar">
        <button class="back" data-act="home">‹ 退出</button>
        <div class="ttl">极速刷词</div>
        <span class="count">${s.idx+1}/${s.list.length}</span>
      </div>
      <div class="pline"><i style="width:${s.idx/s.list.length*100}%"></i></div>
      <div class="flash">
        <div class="cat">${dot(o.c)}${c.name}</div>
        <button class="spk-btn" data-act="say" data-w="${o.w}">🔊</button>
        <div class="speed-word">${o.w}</div>
        <div class="speed-zh">${o.zh}</div>
      </div>
      <div class="rates">
        <button class="rate again" data-act="sp" data-g="0" style="grid-column:span 1">没记住</button>
        <button class="rate good"  data-act="sp" data-g="2" style="grid-column:span 2">记得 ✓</button>
      </div>
      <div class="keytips">空格/→ 记得 · ←/1 没记住 · R 重听</div>
    </div>`;
  }
  function advSpeed(g){
    const s = speed; if (s.idx >= s.list.length) return;
    grade(s.list[s.idx].w, g); s.idx++; renderSpeed();
    if (s.idx < s.list.length) speak(s.list[s.idx].w);
  }

  function doneHTML(emoji, t, sub){
    screen = "done";
    return `<div class="screen done">
      <div class="emoji">${emoji}</div>
      <div class="t">${t}</div>${sub?`<div class="s">${sub}</div>`:'<div class="s"></div>'}
      <button class="btn-primary" data-act="home">返回首页</button>
    </div>`;
  }

  // ================= events =================
  app.addEventListener("click", e => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    switch (a){
      case "theme": toggleTheme(); break;
      case "home": renderHome(); break;
      case "reset": if (confirm("确定重置全部学习进度？")){ prog = {}; save(); renderHome(); } break;
      case "cat": renderBrowse(t.dataset.id); break;
      case "say": e.stopPropagation(); speak(t.dataset.w); break;
      case "review": { const d = dueWords(); if (d.length) startStudy(d,"复习","en"); else { const n = newWords(NEWB); if (n.length) startStudy(n,"学习新词","en"); } break; }
      case "learn": { const n = newWords(NEWB); if (n.length) startStudy(n,"学习新词","en"); break; }
      case "quiz": { const b = batch(12); if (b.length) startQuiz(b); break; }
      case "speed": { let p = newWords(30); if (!p.length) p = batch(30); if (p.length) startSpeed(p); break; }
      case "hard": { const h = hardWords(); if (h.length) startStudy(h,"难词本","en"); break; }
      case "zhen": { const b = batch(NEWB); if (b.length) startStudy(b,"中 → 英","zh"); break; }
      case "listen": { const b = batch(NEWB); if (b.length) startStudy(b,"听音","listen"); break; }
      case "reveal": reveal(); break;
      case "replay": e.stopPropagation(); speak(cur().w); break;
      case "grade": gradeStudy(+t.dataset.g); break;
      case "opt": pickQuiz(+t.dataset.i); break;
      case "sp": advSpeed(+t.dataset.g); break;
      // per-category
      case "b-learn":  { const n = newWords(10, t.dataset.id); if (n.length) startStudy(n, CAT[t.dataset.id].zh+" · 新词","en"); break; }
      case "b-review": { const d = dueWords(t.dataset.id); if (d.length) startStudy(d, CAT[t.dataset.id].zh+" · 复习","en"); break; }
      case "b-quiz":   { const b = batch(12, t.dataset.id); if (b.length) startQuiz(b); break; }
      case "b-zhen":   { const b = batch(10, t.dataset.id); if (b.length) startStudy(b, CAT[t.dataset.id].zh+" · 中→英","zh"); break; }
      case "b-listen": { const b = batch(10, t.dataset.id); if (b.length) startStudy(b, CAT[t.dataset.id].zh+" · 听音","listen"); break; }
    }
  });

  // keyboard (desktop preview)
  document.addEventListener("keydown", e => {
    if (screen === "study"){
      if (e.code === "Space"){ e.preventDefault(); if (!study.revealed) reveal(); }
      else if (study.revealed && "123".includes(e.key)) gradeStudy(+e.key-1);
      else if (e.key.toLowerCase() === "r") speak(cur().w);
    } else if (screen === "quiz"){
      if ("1234".includes(e.key)) pickQuiz(+e.key-1);
    } else if (screen === "speed"){
      if (e.code === "Space" || e.key === "ArrowRight"){ e.preventDefault(); advSpeed(2); }
      else if (e.key === "ArrowLeft" || e.key === "1") advSpeed(0);
      else if (e.key.toLowerCase() === "r") speak(speed.list[speed.idx].w);
    }
  });

  // ---------- boot ----------
  applyTheme();
  renderHome();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
