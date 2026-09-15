(() => {
  const W = window.WORDS, CATS = window.CATEGORIES;
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const app = document.getElementById("app");
  const KEY = "be850-state-v3", OLD2 = "be850-state-v2", OLD1 = "be850-progress-v1";
  const TKEY = "be850-theme";
  const GROUP = 20;   // 每组词数
  const UP    = 2;    // 连对几次升一层 / 移出错题本
  const TOP   = 4;    // 最高层 = 已掌握

  // 每个词的形态由它自己的层级决定：
  // 0 没见过 → 暴露卡   1 看词选中文   2 看中文选词   3 纯听音选中文   4 已掌握（不再出现）
  const FORM = {
    0: { tip:"", badge:"新词" },
    1: { tip:"选出正确的中文意思", badge:"" },
    2: { tip:"听发音，选出对应的英文单词", badge:"" },
    3: { tip:"纯听音 · 选出对应的中文意思", badge:"" }
  };

  // ================= state =================
  // st.p[word] = { lv, s:本层连对, n:练过次数, e:错过次数, bad:在错题本 }
  // st.cur = 下一个要刷的词表下标
  // st.opt = { zh:暴露卡显示中文, drill:只刷不考 }
  let st = load();

  function load(){
    try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.p) return norm(r); } catch {}
    return norm(migrate());
  }
  function migrate(){
    const s = { p:{}, cur:0, opt:{} };
    try {                                    // v2：练过 → 第 1 层，错题本保留
      const v2 = JSON.parse(localStorage.getItem(OLD2));
      if (v2 && v2.p){
        for (const w in v2.p){ const o = v2.p[w];
          s.p[w] = { lv: o.n > 0 ? 1 : 0, s:0, n:o.n|0, e:o.e|0, bad:o.bad|0 }; }
        return s;
      }
    } catch {}
    try {                                    // v1：已学 → 第 1 层
      const v1 = JSON.parse(localStorage.getItem(OLD1)) || {};
      for (const w in v1) if (v1[w] && v1[w].seen) s.p[w] = { lv:1, s:0, n:1, e:0, bad:0 };
    } catch {}
    return s;
  }
  function norm(s){
    s.p = s.p || {};
    s.cur = s.cur | 0;
    s.opt = Object.assign({ zh:true, drill:false }, s.opt || {});
    return s;
  }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
  function rec(w){ return st.p[w] || (st.p[w] = { lv:0, s:0, n:0, e:0, bad:0 }); }

  const lv   = w => { const r = st.p[w]; return r ? r.lv|0 : 0; };
  const gotIt = w => lv(w) >= TOP;
  const isBad = w => { const r = st.p[w]; return !!(r && r.bad); };
  const seen  = w => lv(w) > 0;
  const badList = () => W.filter(o => isBad(o.w));
  const countIn = (f, cat) => W.filter(o => (!cat || o.c === cat) && f(o.w)).length;
  const wordsIn = cat => W.filter(o => o.c === cat);

  // ---- 升降级：连对 UP 次升一层并移出错题本；答错降一层并入错题本 ----
  function passCard(w){                       // 暴露卡过一个
    const r = rec(w); r.n++;
    if (r.lv === 0){ r.lv = 1; r.s = 0; }
    save();
  }
  function passQuiz(w){
    const r = rec(w); r.n++; r.s++;
    if (r.s >= UP){ r.lv = Math.min(TOP, r.lv + 1); r.s = 0; r.bad = 0; }
    save();
  }
  function failQuiz(w){
    const r = rec(w); r.n++; r.e++;
    r.lv = Math.max(1, r.lv - 1); r.s = 0; r.bad = 1;
    save();
  }

  // ================= 选词 =================
  const groupOf = i => Math.floor(i / GROUP);
  const groupEnd = i => Math.min((groupOf(i) + 1) * GROUP, W.length);

  // 从游标处取本组还没掌握的词；整组都掌握了就跳下一组
  function nextBatch(){
    const drill = st.opt.drill;
    let start = st.cur | 0;
    if (start >= W.length) start = 0;
    for (let hop = 0; hop <= Math.ceil(W.length / GROUP); hop++){
      const end = groupEnd(start);
      const list = W.slice(start, end).filter(o => drill || !gotIt(o.w));
      if (list.length) return { list, start };
      start = end >= W.length ? 0 : end;
    }
    return { list:[], start:0 };              // 全部掌握
  }
  function shuffle(a){ a = a.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pick3(word, key){
    let pool = W.filter(o => o.w !== word.w && o[key] !== word[key] && o.c === word.c);
    if (pool.length < 3) pool = pool.concat(W.filter(o => o.w !== word.w && o[key] !== word[key] && o.c !== word.c));
    const got = new Set(), out = [];
    for (const o of shuffle(pool)){ if (!got.has(o[key])){ got.add(o[key]); out.push(o[key]); if (out.length === 3) break; } }
    return out;
  }

  // ================= audio =================
  let au = null;
  function speak(w){
    if (!w) return;
    try {
      if (!au){ au = new Audio(); au.preload = "auto"; }
      au.pause();
      au.src = "audio/" + encodeURIComponent(w) + ".mp3";
      au.currentTime = 0;
      const p = au.play();
      if (p && p.catch) p.catch(() => tts(w));
    } catch { tts(w); }
  }
  function tts(w){
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(w); u.lang = "en-US"; u.rate = .9;
    speechSynthesis.speak(u);
  }
  function prefetch(w){ if (w) fetch("audio/" + encodeURIComponent(w) + ".mp3").catch(()=>{}); }

  // ================= theme =================
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
    screen = "home"; sess = null;
    const total = W.length;
    const mastered = countIn(gotIt), learning = countIn(w => seen(w) && !gotIt(w));
    const bad = badList().length;
    const themeIcon = (localStorage.getItem(TKEY)||"dark") === "dark" ? "☀️" : "🌙";

    const b = nextBatch();
    const allDone = !b.list.length;
    const g = groupOf(b.start) + 1, groups = Math.ceil(total / GROUP);
    const from = groupOf(b.start) * GROUP + 1, to = groupEnd(b.start);
    const label = allDone ? "850 词全部掌握" : ((st.cur|0) === b.start && b.start % GROUP === 0 ? "开始" : "继续");
    const subtitle = allDone ? "点一下再通刷一轮" : `第 ${g}/${groups} 组 · 第 ${from}–${to} 词`;

    app.innerHTML = `<div class="screen">
      <div class="home-head">
        <div>
          <div class="brand">Basic English<span>850</span></div>
          <div class="tagline">Ogden 基础英语 · 一条流刷完</div>
        </div>
        <button class="theme-btn" data-act="theme">${themeIcon}</button>
      </div>

      <button class="go-big ${allDone ? "all-done" : ""}" data-act="go">
        <span class="t">${label}</span>
        <span class="s">${subtitle}</span>
      </button>

      <div class="prog-card">
        <div class="prog-top">
          <div class="prog-num">${mastered}<small>/ ${total} 已掌握</small></div>
          <div class="prog-side">${learning} 学习中 · ${total - mastered - learning} 没见过</div>
        </div>
        <div class="bar-track">
          <div class="bar-seg" style="width:${mastered/total*100}%;background:var(--good)"></div>
          <div class="bar-seg" style="width:${learning/total*100}%;background:var(--accent)"></div>
        </div>
      </div>

      <button class="row-link ${bad ? "hot" : ""}" data-act="wrongbook">
        <span class="ic">🧨</span>
        <span class="tx"><b>错题本</b><em>${bad ? "单独重练，连对 "+UP+" 次移出" : "答错的词会自动收进来"}</em></span>
        <span class="n">${bad}</span>
      </button>
      <button class="row-link" data-act="cats">
        <span class="ic">📚</span>
        <span class="tx"><b>按分类查词</b><em>${CATS.length} 类 · 查词听音，不计入进度</em></span>
        <span class="n">›</span>
      </button>

      <div class="foot"><button class="link" data-act="reset">重置全部进度</button></div>
    </div>`;
  }

  // ================= 分类 =================
  function renderCats(){
    screen = "cats";
    const rows = CATS.map(c => {
      const tot = wordsIn(c.id).length, m = countIn(gotIt, c.id), p = Math.round(m/tot*100);
      return `<div class="cat-row" data-act="cat" data-id="${c.id}">
        <div class="cat-dot" style="background:var(--${c.id})"></div>
        <div class="cat-meta">
          <div class="cat-name">${c.name}<em>${c.zh}</em></div>
          <div class="cat-desc">${c.desc}</div>
          <div class="cat-mini"><i style="width:${p}%;background:var(--${c.id})"></i></div>
        </div>
        <div class="cat-prog"><b>${m}/${tot}</b>掌握</div>
      </div>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">按分类查词</div>
        <span class="count"></span>
      </div>
      <div class="cat-list">${rows}</div>
    </div>`;
  }
  function renderBrowse(catId){
    screen = "browse";
    const c = CAT[catId], list = wordsIn(catId);
    const rows = list.map(o => {
      const l = lv(o.w);
      const tag = isBad(o.w) ? '<span class="ck bad">!</span>'
                : l >= TOP   ? '<span class="ck">✓</span>'
                : l > 0      ? `<span class="ck mid">${l}</span>` : "";
      return `<div class="wrow ${l>=TOP?"seen":""} ${isBad(o.w)?"bad":""}">
        <span class="en">${o.w}</span>${tag}
        <span class="zh">${o.zh}</span>
        <button class="spk" data-act="say" data-w="${o.w}">🔊</button>
      </div>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="cats">‹ 返回</button>
        <div class="ttl">${c.name}<small>${c.zh} · ${countIn(gotIt, catId)}/${list.length} 掌握</small></div>
        <span class="count"></span>
      </div>
      <div class="words">${rows}</div>
    </div>`;
  }

  // ================= 错题本 =================
  function renderWrongBook(){
    screen = "wrongbook";
    const list = badList();
    const rows = list.map(o => `<div class="wrow bad">
        <span class="en">${o.w}</span>
        <span class="zh">${o.zh}</span>
        <span class="streak">${(st.p[o.w].s|0)}/${UP}</span>
        <button class="spk" data-act="say" data-w="${o.w}">🔊</button>
        <button class="del" data-act="unbad" data-w="${o.w}">✕</button>
      </div>`).join("");
    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">错题本<small>连对 ${UP} 次自动移出</small></div>
        <span class="count">${list.length}</span>
      </div>
      ${list.length ? `<button class="go-big" data-act="go-bad">
          <span class="t">重练错题</span><span class="s">${list.length} 个词</span></button>
        <div class="words" style="margin-top:16px">${rows}</div>
        <div class="foot"><button class="link" data-act="clearbad">清空错题本</button></div>`
      : `<div class="done"><div class="emoji">✨</div><div class="t">错题本是空的</div>
         <div class="s">刷词时答错的词会自动收进这里</div>
         <button class="btn-primary" data-act="home">返回首页</button></div>`}
    </div>`;
  }

  // ================= 刷词流 =================
  let sess = null, tok = 0;
  const cur = () => sess.list[sess.idx];

  function start(wrongBook){
    let list, label;
    if (wrongBook){
      list = badList().slice(0, GROUP);
      label = "错题本";
    } else {
      const b = nextBatch();
      if (!b.list.length) return false;
      list = b.list;
      label = `第 ${groupOf(b.start)+1} 组`;
    }
    if (!list.length) return false;
    sess = { list, idx:0, label, wrong:!!wrongBook, right:0, quizzed:0, missed:[],
             form:0, opts:[], ans:-1, picked:null, peek:false, id:++tok };
    screen = "sess";
    enter();
    return true;
  }
  // 进入当前词：锁定形态、出题、读音
  function enter(){
    if (!sess) return;
    if (sess.idx >= sess.list.length){ renderDone(); return; }
    const o = cur();
    sess.form = st.opt.drill ? 0 : Math.min(lv(o.w), 3);
    sess.picked = null; sess.peek = false;
    if (sess.form > 0) makeOpts();
    render();
    speak(o.w);
    const nx = sess.list[sess.idx+1];
    if (nx) prefetch(nx.w);
  }
  function makeOpts(){
    const o = cur();
    const key = sess.form === 2 ? "w" : "zh";   // 第 2 层选英文单词，其余选中文
    const opts = pick3(o, key);
    const pos = Math.random() * (opts.length + 1) | 0;
    opts.splice(pos, 0, o[key]);
    sess.opts = opts; sess.ans = pos;
  }
  // 记账并前进：游标记在词表下标上，中途退出下次精确接续
  function step(){
    if (!sess.wrong){
      const i = W.indexOf(cur());
      if (i >= 0) st.cur = (i + 1 >= W.length) ? 0 : i + 1;
      save();
    }
    sess.idx++;
    enter();
  }

  function render(){
    sess.form === 0 ? renderCard() : renderQuiz();
  }
  function topBar(){
    return `<div class="bar">
      <button class="back" data-act="home">‹ 退出</button>
      <div class="ttl">刷词<small>${sess.label}</small></div>
      <span class="count">${sess.idx+1}/${sess.list.length}</span>
    </div>
    <div class="pline"><i style="width:${sess.idx/sess.list.length*100}%"></i></div>`;
  }
  const drillBtn = () => `<button class="tool ${st.opt.drill ? "on" : ""}" data-act="tdrill">${st.opt.drill ? "只刷不考 开" : "只刷不考"}</button>`;

  // ---- 第 0 层：暴露卡 ----
  function renderCard(){
    const o = cur(), c = CAT[o.c], on = st.opt.zh, show = on || sess.peek;
    const fresh = lv(o.w) === 0;
    app.innerHTML = `<div class="screen stage">
      ${topBar()}
      <div class="flash" data-act="next">
        <div class="cat">${dot(o.c)}${c.name}</div>
        <button class="spk-btn" data-act="say" data-w="${o.w}">🔊</button>
        ${fresh ? `<div class="badge">新词</div>` : ""}
        <div class="speed-word">${o.w}</div>
        ${show ? `<div class="speed-zh">${o.zh}</div>`
               : `<button class="speed-zh peek" data-act="peek">· · · 点这看中文</button>`}
        <div class="hint">点卡片任意处 → 下一个词</div>
      </div>
      <div class="toolbar">
        ${drillBtn()}
        <button class="tool" data-act="say" data-w="${o.w}">🔊 重听</button>
        <button class="tool ${on ? "on" : ""}" data-act="tzh">中文 ${on ? "开" : "关"}</button>
      </div>
      <div class="keytips">空格/→ 下一个 · R 重听</div>
    </div>`;
  }

  // ---- 第 1/2/3 层：选择题 ----
  function renderQuiz(){
    const o = cur(), c = CAT[o.c], picked = sess.picked != null, f = sess.form;
    let stem;
    if (picked && f === 3){
      stem = `<div class="q-word">${o.w}</div><div class="q-sub">${o.zh}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊</button>`;
    } else if (f === 1){
      stem = `<div class="q-word">${o.w}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊</button>`;
    } else if (f === 2){
      stem = `<div class="q-zh">${o.zh}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊 再听一次</button>`;
    } else {
      stem = `<button class="listen-spk" data-act="say" data-w="${o.w}">🔊</button>`;
    }
    const opts = sess.opts.map((t,i) => {
      let cls = "", mk = "";
      if (picked){
        if (i === sess.ans){ cls = "correct"; mk = '<span class="mk">✅</span>'; }
        else if (i === sess.picked){ cls = "wrong"; mk = '<span class="mk">❌</span>'; }
      }
      return `<button class="opt ${cls}" data-act="opt" data-i="${i}"><span class="k">${i+1}</span>${t}${mk}</button>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      ${topBar()}
      <div class="q-card">
        <div class="q-cat">${dot(o.c)}${c.name}</div>
        ${stem}
        ${picked ? "" : `<div class="q-tip">${FORM[f].tip}</div>`}
      </div>
      <div class="opts">${opts}</div>
      <div class="toolbar">${drillBtn()}</div>
    </div>`;
  }

  function nextCard(){
    if (!sess || sess.form !== 0 || sess.idx >= sess.list.length) return;
    passCard(cur().w);
    step();
  }
  function pickOpt(i){
    if (!sess || sess.form === 0 || sess.picked != null || sess.idx >= sess.list.length) return;
    sess.picked = i;
    const o = cur(), right = i === sess.ans;
    sess.quizzed++;
    if (right){ sess.right++; passQuiz(o.w); }
    else { failQuiz(o.w); if (!sess.missed.some(x => x.w === o.w)) sess.missed.push(o); }
    render();
    const id = sess.id;
    setTimeout(() => { if (sess && sess.id === id) step(); }, right ? 600 : 1600);
  }
  function toggleDrill(){
    st.opt.drill = !st.opt.drill; save();
    if (!sess) return;
    if (sess.picked != null) return;          // 反馈期间不打断
    enter();
  }

  function renderDone(){
    screen = "done";
    const n = sess.list.length, q = sess.quizzed, missed = sess.missed.length;
    const bad = badList().length, left = W.length - countIn(gotIt);
    const perfect = q > 0 && missed === 0;
    const emoji = perfect ? "🏆" : q > 0 ? "🎯" : "⚡️";
    const title = q > 0 ? `答对 ${sess.right}/${q}` : `过完 ${n} 个词`;
    const sub = missed ? `${missed} 个进了错题本`
              : q > 0  ? "这组全对"
              : sess.wrong ? "错题本这一遍过完了" : "接着下一组";
    app.innerHTML = `<div class="screen done">
      <div class="emoji">${emoji}</div>
      <div class="t">${title}</div>
      <div class="s">${sub} · 还剩 ${left} 词没掌握</div>
      <div class="done-btns">
        <button class="btn-primary" data-act="go">${sess.wrong ? "继续刷词" : "下一组"}</button>
        ${bad ? `<button class="btn-ghost" data-act="wrongbook">错题本 ${bad}</button>` : ""}
        <button class="btn-ghost" data-act="home">返回首页</button>
      </div>
    </div>`;
  }

  // ================= events =================
  app.addEventListener("click", e => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    switch (t.dataset.act){
      case "theme": toggleTheme(); break;
      case "home": sess = null; renderHome(); break;
      case "reset":
        if (confirm("确定重置全部进度和错题本？")){ st = norm({ p:{}, cur:0, opt:st.opt }); save(); renderHome(); }
        break;
      case "cats": renderCats(); break;
      case "cat": renderBrowse(t.dataset.id); break;
      case "say": speak(t.dataset.w); break;
      case "wrongbook": renderWrongBook(); break;
      case "unbad": { const r = rec(t.dataset.w); r.bad = 0; r.s = 0; save(); renderWrongBook(); break; }
      case "clearbad":
        if (confirm("清空错题本？")){ badList().forEach(o => { st.p[o.w].bad = 0; st.p[o.w].s = 0; }); save(); renderWrongBook(); }
        break;
      case "go": if (!start(false)) renderHome(); break;
      case "go-bad": if (!start(true)) renderHome(); break;
      case "next": nextCard(); break;
      case "peek": sess.peek = true; render(); break;
      case "tzh": st.opt.zh = !st.opt.zh; save(); sess.peek = false; render(); break;
      case "tdrill": toggleDrill(); break;
      case "opt": pickOpt(+t.dataset.i); break;
    }
  });

  document.addEventListener("keydown", e => {
    if (screen !== "sess" || !sess) return;
    const k = e.key.toLowerCase();
    if (sess.form === 0){
      if (e.code === "Space" || e.key === "ArrowRight"){ e.preventDefault(); nextCard(); }
      else if (k === "r") speak(cur().w);
      else if (k === "z"){ st.opt.zh = !st.opt.zh; save(); sess.peek = false; render(); }
    } else {
      if ("1234".includes(e.key)) pickOpt(+e.key - 1);
      else if (k === "r") speak(cur().w);
    }
  });

  // ---------- boot ----------
  applyTheme();
  renderHome();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
