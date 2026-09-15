(() => {
  const W = window.WORDS, CATS = window.CATEGORIES;
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const app = document.getElementById("app");
  const KEY = "be850-state-v2", OLDKEY = "be850-progress-v1", TKEY = "be850-theme";
  const GROUP = 20;   // 每组词数
  const OUT   = 2;    // 错题本：连续答对几次自动移出

  const MODES = {
    speed: { ic:"⚡️", name:"极速刷词", desc:"自动读音 · 点一下过下一个" },
    e2c:   { ic:"📝", name:"英 → 中",  desc:"看词听音 · 四选一中文" },
    c2e:   { ic:"🎧", name:"中 → 英",  desc:"听音选词 · 可切纯听力" }
  };

  // ================= state =================
  // st.p[word] = { n:练过次数, e:错过次数, s:连续答对, bad:1 在错题本 }
  // st.cur["mode|scope"] = 下一组的起始下标
  // st.opt = { speedZh, c2eZh }
  let st = load();

  function load(){
    try { const raw = JSON.parse(localStorage.getItem(KEY)); if (raw && raw.p) return norm(raw); } catch {}
    return norm(migrate());
  }
  function migrate(){
    const s = { p:{}, cur:{}, opt:{} };
    try {
      const old = JSON.parse(localStorage.getItem(OLDKEY)) || {};
      for (const w in old) if (old[w] && old[w].seen) s.p[w] = { n:1, e:0, s:0, bad:0 };
    } catch {}
    return s;
  }
  function norm(s){
    s.p = s.p || {}; s.cur = s.cur || {};
    s.opt = Object.assign({ speedZh:true, c2eZh:true }, s.opt || {});
    return s;
  }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
  function rec(w){ return st.p[w] || (st.p[w] = { n:0, e:0, s:0, bad:0 }); }

  const done    = w => { const r = st.p[w]; return !!(r && r.n > 0); };
  const isBad   = w => { const r = st.p[w]; return !!(r && r.bad); };
  const doneIn  = cat => W.filter(o => (!cat || o.c === cat) && done(o.w)).length;
  const wordsIn = cat => W.filter(o => o.c === cat);
  const badList = () => W.filter(o => isBad(o.w));

  function touch(w){ rec(w).n++; save(); }
  function markRight(w){
    const r = rec(w); r.n++; r.s++;
    if (r.bad && r.s >= OUT){ r.bad = 0; r.s = 0; }
    save();
  }
  function markWrong(w){
    const r = rec(w); r.n++; r.e++; r.bad = 1; r.s = 0; save();
  }

  // ================= word pools =================
  function scopeWords(scope){
    if (scope === "wrong") return badList();
    if (scope === "all")   return W;
    return wordsIn(scope);
  }
  const scopeName = s => s === "all" ? "全部 850" : s === "wrong" ? "错题本" : CAT[s].zh;
  const ckey = (mode, scope) => mode + "|" + scope;

  function cursorOf(mode, scope){
    const n = scopeWords(scope).length;
    let c = st.cur[ckey(mode, scope)] | 0;
    if (c >= n) c = 0;
    return c;
  }
  // 取下一组（不动游标——游标按实际做完的词数推进，中途退出下次接着剩下的）
  function nextGroup(mode, scope){
    const list = scopeWords(scope);
    if (!list.length) return { list:[], start:0 };
    if (scope === "wrong") return { list:list.slice(0, GROUP), start:0 };  // 错题本永远从头取，答对自然消失
    const cur = cursorOf(mode, scope);
    // 组边界固定在 GROUP 的倍数上：上次没做完，这次就只补这组剩下的
    const end = Math.min(Math.ceil((cur + 1) / GROUP) * GROUP, list.length);
    return { list:list.slice(cur, end), start:cur };
  }

  function shuffle(a){ a = a.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pick3(word, key){
    let pool = W.filter(o => o.w !== word.w && o[key] !== word[key] && o.c === word.c);
    if (pool.length < 3) pool = pool.concat(W.filter(o => o.w !== word.w && o[key] !== word[key] && o.c !== word.c));
    const seen = new Set(), out = [];
    for (const o of shuffle(pool)){ if (!seen.has(o[key])){ seen.add(o[key]); out.push(o[key]); if (out.length === 3) break; } }
    return out;
  }

  // ================= audio =================
  // 复用同一个 <audio>：iOS 上首次手势解锁后，后续自动播放才不会被拦
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
    const total = W.length, d = doneIn();
    const pct = Math.round(d / total * 100);
    const segs = CATS.map(c => `<div class="bar-seg" style="width:${doneIn(c.id)/total*100}%;background:var(--${c.id})"></div>`).join("");
    const legend = CATS.map(c => `<span>${dot(c.id)}${c.zh} ${doneIn(c.id)}/${wordsIn(c.id).length}</span>`).join("");
    const bad = badList().length;
    const themeIcon = (localStorage.getItem(TKEY)||"dark") === "dark" ? "☀️" : "🌙";

    const modes = Object.keys(MODES).map(m => `
      <button class="mode-card" data-act="scope" data-mode="${m}">
        <span class="ic">${MODES[m].ic}</span>
        <span class="tx"><b>${MODES[m].name}</b><em>${MODES[m].desc}</em></span>
        <span class="go">›</span>
      </button>`).join("");

    const cats = CATS.map(c => {
      const m = doneIn(c.id), tot = wordsIn(c.id).length, p = Math.round(m/tot*100);
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
          <div class="tagline">Ogden 基础英语 · 听 · 读 · 说 反复过词</div>
        </div>
        <button class="theme-btn" data-act="theme">${themeIcon}</button>
      </div>

      <div class="overall">
        <div class="overall-top">
          <div class="overall-num">${d}<small>/ ${total} 词练过</small></div>
          <div class="overall-label">${pct}% 覆盖</div>
        </div>
        <div class="bar-track">${segs}</div>
        <div class="legend">${legend}</div>
      </div>

      <div class="sec-title">练习模式</div>
      <div class="mode-list">${modes}</div>

      <button class="wrong-card ${bad ? "" : "empty"}" data-act="wrongbook">
        <span class="ic">🧨</span>
        <span class="tx"><b>错题本</b><em>${bad ? "单独重复练，连对 "+OUT+" 次自动移出" : "答错的词会自动收进来"}</em></span>
        <span class="n">${bad}</span>
      </button>

      <div class="sec-title">按分类浏览</div>
      <div class="cat-list">${cats}</div>

      <div class="foot"><button class="link" data-act="reset">重置全部进度</button></div>
    </div>`;
  }

  // ================= SCOPE PICKER =================
  function renderScope(mode){
    screen = "scope";
    const M = MODES[mode];
    const row = (scope, title, sub, tint) => {
      const list = scopeWords(scope), n = list.length;
      let prog = "", sub2 = `${n} 词`;
      if (scope === "wrong"){ prog = n ? `${n} 个` : "空"; sub2 = "答错的词"; }
      else {
        const c = cursorOf(mode, scope), groups = Math.ceil(n / GROUP), g = Math.floor(c / GROUP) + 1;
        prog = `第 ${g}/${groups} 组`;
        sub2 = c ? `已过 ${c}/${n} 词` : `${n} 词`;
      }
      return `<button class="scope-row ${n ? "" : "disabled"}" data-act="go" data-mode="${mode}" data-id="${scope}">
        <span class="sd" style="background:var(--${tint})"></span>
        <span class="st"><b>${title}</b><em>${sub}</em></span>
        <span class="sp">${prog}<small>${sub2}</small></span>
      </button>`;
    };
    const cats = CATS.map(c => row(c.id, c.zh, c.name + " · " + c.desc, c.id)).join("");

    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">${M.ic} ${M.name}<small>${M.desc}</small></div>
        <span class="count"></span>
      </div>
      <div class="sec-title">练哪一批？每组 ${GROUP} 个，自动接着上次往后</div>
      <div class="scope-list">
        ${row("all", "全部 850 词", "按书上的顺序通刷", "accent")}
        ${row("wrong", "错题本", "只练答错过的词", "again")}
        ${cats}
      </div>
    </div>`;
  }

  // ================= WRONG BOOK =================
  function renderWrongBook(){
    screen = "wrongbook";
    const list = badList();
    const rows = list.map(o => `<div class="wrow">
        <span class="en">${o.w}</span>
        <span class="zh">${o.zh}</span>
        <span class="streak">${(st.p[o.w].s|0)}/${OUT}</span>
        <button class="spk" data-act="say" data-w="${o.w}">🔊</button>
        <button class="del" data-act="unbad" data-w="${o.w}">✕</button>
      </div>`).join("");
    const chips = Object.keys(MODES).map(m =>
      `<button class="chip" data-act="go" data-mode="${m}" data-id="wrong">${MODES[m].ic} ${MODES[m].name}</button>`).join("");

    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">错题本<small>连对 ${OUT} 次自动移出</small></div>
        <span class="count">${list.length}</span>
      </div>
      ${list.length ? `<div class="card action-card">
        <div class="h">用哪种方式重练？</div>
        <div class="chips">${chips}</div>
      </div>
      <div class="words">${rows}</div>
      <div class="foot"><button class="link" data-act="clearbad">清空错题本</button></div>`
      : `<div class="done"><div class="emoji">✨</div><div class="t">错题本是空的</div>
         <div class="s">练习中答错的词会自动收进这里</div>
         <button class="btn-primary" data-act="home">返回首页</button></div>`}
    </div>`;
  }

  // ================= BROWSE =================
  function renderBrowse(catId){
    screen = "browse";
    const c = CAT[catId], list = wordsIn(catId);
    const chips = Object.keys(MODES).map(m =>
      `<button class="chip" data-act="go" data-mode="${m}" data-id="${catId}">${MODES[m].ic} ${MODES[m].name}</button>`).join("");
    const rows = list.map(o => `<div class="wrow ${done(o.w) ? "seen" : ""} ${isBad(o.w) ? "bad" : ""}">
        <span class="en">${o.w}</span>${isBad(o.w) ? '<span class="ck bad">!</span>' : done(o.w) ? '<span class="ck">✓</span>' : ""}
        <span class="zh">${o.zh}</span>
        <button class="spk" data-act="say" data-w="${o.w}">🔊</button>
      </div>`).join("");

    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">‹ 返回</button>
        <div class="ttl">${c.name}<small>${c.zh} · ${doneIn(catId)}/${list.length} 练过</small></div>
        <span class="count"></span>
      </div>
      <div class="card action-card">
        <div class="h">练这一类（${c.zh}）</div>
        <div class="chips">${chips}</div>
      </div>
      <div class="words">${rows}</div>
    </div>`;
  }

  // ================= SESSION =================
  let sess = null, tok = 0;
  const cur = () => sess.list[sess.idx];

  function startSession(mode, scope){
    const g = nextGroup(mode, scope);
    if (!g.list.length) return false;
    sess = { mode, scope, list:g.list, start:g.start, hi:0, idx:0, right:0, missed:[], counted:new Set(),
             opts:[], ans:-1, picked:null, enOpts:false, peek:false, id:++tok };
    screen = "sess";
    if (mode !== "speed") prepQuiz();
    renderSess();
    cue();
    return true;
  }
  // 把游标推到「本组已做完 n 个」的位置；中途退出，下次从这里接着
  function bump(n){
    if (!sess || sess.scope === "wrong") return;
    sess.hi = Math.max(sess.hi, n);
    const len = scopeWords(sess.scope).length;
    let c = sess.start + sess.hi;
    if (c >= len) c = 0;                       // 一轮刷完，回到开头
    st.cur[ckey(sess.mode, sess.scope)] = c;
    save();
  }
  function cue(){
    if (!sess || sess.idx >= sess.list.length) return;
    speak(cur().w);
    const nx = sess.list[sess.idx+1];
    if (nx) prefetch(nx.w);
  }
  function renderSess(){
    if (!sess) return;
    if (sess.idx >= sess.list.length){ renderDone(); return; }
    if (!sess.counted.has(sess.idx) && sess.mode === "speed"){ sess.counted.add(sess.idx); touch(cur().w); }
    sess.mode === "speed" ? renderSpeed() : renderQuiz();
  }
  function topBar(extra){
    const M = MODES[sess.mode];
    return `<div class="bar">
      <button class="back" data-act="home">‹ 退出</button>
      <div class="ttl">${M.name}<small>${scopeName(sess.scope)}</small></div>
      <span class="count">${sess.idx+1}/${sess.list.length}</span>
    </div>
    <div class="pline"><i style="width:${sess.idx/sess.list.length*100}%"></i></div>${extra||""}`;
  }

  // ---- 极速刷词：自动读音，点一下过下一个 ----
  function renderSpeed(){
    const o = cur(), c = CAT[o.c], on = st.opt.speedZh, show = on || sess.peek;
    app.innerHTML = `<div class="screen stage">
      ${topBar()}
      <div class="flash" data-act="next">
        <div class="cat">${dot(o.c)}${c.name}</div>
        <button class="spk-btn" data-act="say" data-w="${o.w}">🔊</button>
        <div class="speed-word">${o.w}</div>
        ${show ? `<div class="speed-zh">${o.zh}</div>`
               : `<button class="speed-zh peek" data-act="peek">· · · 点这看中文</button>`}
        <div class="hint">点卡片任意处 → 下一个词</div>
      </div>
      <div class="toolbar">
        <button class="tool" data-act="prev" ${sess.idx === 0 ? "disabled" : ""}>‹ 上一个</button>
        <button class="tool" data-act="say" data-w="${o.w}">🔊 重听</button>
        <button class="tool ${on ? "on" : ""}" data-act="tz-speed">中文 ${on ? "开" : "关"}</button>
      </div>
      <div class="keytips">空格/→ 下一个 · ← 上一个 · R 重听</div>
    </div>`;
  }
  function stepSpeed(d){
    if (!sess || sess.mode !== "speed") return;
    const i = sess.idx + d;
    if (i < 0) return;
    sess.idx = i; sess.peek = false;
    bump(i);
    renderSess();
    if (sess.idx < sess.list.length) cue();
  }

  // ---- 选择题：英→中 / 中→英 ----
  function prepQuiz(){
    if (sess.idx >= sess.list.length) return;
    const o = cur();
    // 选项是英文单词，只在「中→英 且 中文显示」时；中文隐藏 = 纯听音选中文意思
    sess.enOpts = sess.mode === "c2e" && st.opt.c2eZh;
    const key = sess.enOpts ? "w" : "zh";
    const opts = pick3(o, key);
    const pos = Math.random() * (opts.length + 1) | 0;
    opts.splice(pos, 0, o[key]);
    sess.opts = opts; sess.ans = pos; sess.picked = null;
  }
  function renderQuiz(){
    const o = cur(), c = CAT[o.c], picked = sess.picked != null;
    const zhOn = st.opt.c2eZh;
    let stem, tip;
    if (sess.mode === "e2c"){
      stem = `<div class="q-word">${o.w}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊</button>`;
      tip = "选出正确的中文意思";
    } else if (zhOn){
      stem = `<div class="q-zh">${o.zh}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊 再听一次</button>`;
      tip = "听发音，选出对应的英文单词";
    } else {
      stem = picked
        ? `<div class="q-word">${o.w}</div><div class="q-sub">${o.zh}</div>
           <button class="spk-btn flat" data-act="say" data-w="${o.w}">🔊</button>`
        : `<button class="listen-spk" data-act="say" data-w="${o.w}">🔊</button>`;
      tip = picked ? "" : "纯听音 · 选出对应的中文意思";
    }
    const opts = sess.opts.map((t,i) => {
      let cls = "", mk = "";
      if (picked){
        if (i === sess.ans){ cls = "correct"; mk = '<span class="mk">✅</span>'; }
        else if (i === sess.picked){ cls = "wrong"; mk = '<span class="mk">❌</span>'; }
      }
      return `<button class="opt ${cls}" data-act="opt" data-i="${i}"><span class="k">${i+1}</span>${t}${mk}</button>`;
    }).join("");
    const toggle = sess.mode === "c2e"
      ? `<div class="toolbar"><button class="tool ${zhOn ? "on" : ""}" data-act="tz-c2e">中文 ${zhOn ? "开（看中文选单词）" : "关（纯听音选中文）"}</button></div>`
      : "";

    app.innerHTML = `<div class="screen">
      ${topBar()}
      <div class="q-card">
        <div class="q-cat">${dot(o.c)}${c.name}</div>
        ${stem}
        ${tip ? `<div class="q-tip">${tip}</div>` : ""}
      </div>
      <div class="opts">${opts}</div>
      ${toggle}
    </div>`;
  }
  function pickOpt(i){
    if (!sess || sess.mode === "speed" || sess.picked != null || sess.idx >= sess.list.length) return;
    sess.picked = i;
    const o = cur(), right = i === sess.ans;
    if (right){ sess.right++; markRight(o.w); }
    else { markWrong(o.w); if (!sess.missed.some(x => x.w === o.w)) sess.missed.push(o); }
    sess.counted.add(sess.idx);
    bump(sess.idx + 1);
    renderSess();
    const id = sess.id;
    setTimeout(() => {
      if (!sess || sess.id !== id) return;
      sess.idx++;
      if (sess.idx < sess.list.length){ prepQuiz(); renderSess(); cue(); }
      else renderSess();
    }, right ? 600 : 1600);
  }
  function toggleZh(which){
    if (!sess) return;
    if (which === "speed"){ st.opt.speedZh = !st.opt.speedZh; save(); sess.peek = false; renderSess(); return; }
    st.opt.c2eZh = !st.opt.c2eZh; save();
    if (sess.picked == null){ prepQuiz(); renderSess(); cue(); } else renderSess();
  }

  // ---- 本组结束 ----
  function renderDone(){
    screen = "done";
    const m = sess.mode, isQuiz = m !== "speed", n = sess.list.length;
    const missed = sess.missed.length, bad = badList().length;
    const all = isQuiz && missed === 0;
    const emoji = all ? "🏆" : isQuiz ? "🎯" : "⚡️";
    const title = isQuiz ? `答对 ${sess.right}/${n}` : `刷完 ${n} 个词`;
    const sub = isQuiz
      ? (all ? "全对，这组过了" : `${missed} 个进了错题本`)
      : (sess.scope === "wrong" ? "错题本这一遍过完了" : "接着刷下一组");
    const more = scopeWords(sess.scope).length > 0;
    app.innerHTML = `<div class="screen done">
      <div class="emoji">${emoji}</div>
      <div class="t">${title}</div>
      <div class="s">${sub}</div>
      <div class="done-btns">
        ${more ? `<button class="btn-primary" data-act="again">再来一组</button>` : ""}
        ${bad ? `<button class="btn-ghost" data-act="wrongbook">错题本 ${bad}</button>` : ""}
        <button class="btn-ghost" data-act="home">返回首页</button>
      </div>
    </div>`;
  }

  // ================= events =================
  app.addEventListener("click", e => {
    const t = e.target.closest("[data-act]"); if (!t) return;
    const a = t.dataset.act;
    switch (a){
      case "theme": toggleTheme(); break;
      case "home": sess = null; renderHome(); break;
      case "reset":
        if (confirm("确定重置全部进度和错题本？")){ st = norm({ p:{}, cur:{}, opt:st.opt }); save(); renderHome(); }
        break;
      case "cat": renderBrowse(t.dataset.id); break;
      case "say": speak(t.dataset.w); break;
      case "scope": renderScope(t.dataset.mode); break;
      case "wrongbook": renderWrongBook(); break;
      case "unbad": { const r = rec(t.dataset.w); r.bad = 0; r.s = 0; save(); renderWrongBook(); break; }
      case "clearbad":
        if (confirm("清空错题本？")){ badList().forEach(o => { st.p[o.w].bad = 0; st.p[o.w].s = 0; }); save(); renderWrongBook(); }
        break;
      case "go": if (!startSession(t.dataset.mode, t.dataset.id)) renderHome(); break;
      case "again": if (!startSession(sess.mode, sess.scope)) renderHome(); break;
      case "next": stepSpeed(1); break;
      case "prev": stepSpeed(-1); break;
      case "peek": sess.peek = true; renderSess(); break;
      case "tz-speed": toggleZh("speed"); break;
      case "tz-c2e": toggleZh("c2e"); break;
      case "opt": pickOpt(+t.dataset.i); break;
    }
  });

  // 键盘（桌面）
  document.addEventListener("keydown", e => {
    if (screen !== "sess" || !sess) return;
    const k = e.key.toLowerCase();
    if (sess.mode === "speed"){
      if (e.code === "Space" || e.key === "ArrowRight"){ e.preventDefault(); stepSpeed(1); }
      else if (e.key === "ArrowLeft") stepSpeed(-1);
      else if (k === "r") speak(cur().w);
      else if (k === "z") toggleZh("speed");
    } else {
      if ("1234".includes(e.key)) pickOpt(+e.key - 1);
      else if (k === "r" && sess.idx < sess.list.length) speak(cur().w);
      else if (k === "z" && sess.mode === "c2e") toggleZh("c2e");
    }
  });

  // ---------- boot ----------
  applyTheme();
  renderHome();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
