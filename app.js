(() => {
  const W = window.WORDS, CATS = window.CATEGORIES;
  const CAT = Object.fromEntries(CATS.map(c => [c.id, c]));
  const IDX = Object.fromEntries(W.map((o,i) => [o.w, i]));
  const app = document.getElementById("app");
  // ---- 线性图标（只替换原来的 emoji 图标，庆祝页 emoji 保留）----
  const sv = d => '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">' + d + '</svg>';
  const ICON = {
    sun:  sv('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"/>'),
    moon: sv('<path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2Z"/>'),
    book: sv('<path d="M4 5.2A1.7 1.7 0 0 1 5.7 3.5H10a2.4 2.4 0 0 1 2 1.1 2.4 2.4 0 0 1 2-1.1h4.3A1.7 1.7 0 0 1 20 5.2v11.3a1.7 1.7 0 0 1-1.7 1.7H14a2.4 2.4 0 0 0-2 1.1 2.4 2.4 0 0 0-2-1.1H5.7A1.7 1.7 0 0 1 4 16.5Z"/><path d="M12 6.6v12.7"/>'),
    bolt: sv('<path d="M13.4 2.8 4.9 13.3h5.3l-1.6 7.9 8.5-10.5h-5.3Z"/>'),
    spk:  sv('<path d="M11 4.8 6.6 8.4H3.8v7.2h2.8L11 19.2Z"/><path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.4a8 8 0 0 1 0 11.2"/>'),
    chev: sv('<path d="M9.5 5.5 16 12l-6.5 6.5"/>'),
    back: sv('<path d="M14.5 5.5 8 12l6.5 6.5"/>'),
    check:sv('<path d="M4.8 12.6 9.6 17.4 19.2 6.6"/>'),
    x:    sv('<path d="M6.2 6.2 17.8 17.8M17.8 6.2 6.2 17.8"/>')
  };

  const KEY = "be850-state-v4", OLD3 = "be850-state-v3", OLD2 = "be850-state-v2", OLD1 = "be850-progress-v1";
  const TKEY = "be850-theme";
  const GROUP = 20;   // 每次刷多少个词
  const CLEAR = 2;    // 连对几次本轮消掉

  // ================= state =================
  // st.p[word] = { s:本轮连对次数(0/1/2), seen:见过没, n:练过次数, e:错过次数 }
  // st.cur = 下一个要检查的词表下标    st.round = 第几轮
  // st.drill[cat] = { i:看到第几个, laps:整类过完几遍 }
  let st = load();

  function load(){
    try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && r.p) return norm(r); } catch {}
    return norm(migrate());
  }
  function migrate(){
    const s = { p:{}, cur:0, round:1, drill:{}, opt:{} };
    try {                                          // v3：lv → 连对次数
      const v3 = JSON.parse(localStorage.getItem(OLD3));
      if (v3 && v3.p){
        for (const w in v3.p){ const o = v3.p[w], lv = o.lv|0;
          s.p[w] = { s: lv >= 4 ? 2 : lv >= 3 ? 1 : 0, seen: lv > 0 ? 1 : 0, n:o.n|0, e:o.e|0 }; }
        return s;
      }
    } catch {}
    try {                                          // v2
      const v2 = JSON.parse(localStorage.getItem(OLD2));
      if (v2 && v2.p){
        for (const w in v2.p){ const o = v2.p[w];
          s.p[w] = { s:0, seen: o.n > 0 ? 1 : 0, n:o.n|0, e:o.e|0 }; }
        return s;
      }
    } catch {}
    try {                                          // v1
      const v1 = JSON.parse(localStorage.getItem(OLD1)) || {};
      for (const w in v1) if (v1[w] && v1[w].seen) s.p[w] = { s:0, seen:1, n:1, e:0 };
    } catch {}
    return s;
  }
  function norm(s){
    s.p = s.p || {}; s.cur = s.cur | 0; s.round = s.round || 1; s.drill = s.drill || {};
    s.opt = Object.assign({ zh:true }, s.opt || {});
    return s;
  }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch {} }
  function rec(w){ return st.p[w] || (st.p[w] = { s:0, seen:0, n:0, e:0 }); }
  function drec(cat){ return st.drill[cat] || (st.drill[cat] = { i:0, laps:0 }); }

  const hits  = w => { const r = st.p[w]; return r ? r.s|0 : 0; };
  const clear = w => hits(w) >= CLEAR;          // 本轮已消掉
  const seen  = w => { const r = st.p[w]; return !!(r && r.seen); };
  const countIn = (f, cat) => W.filter(o => (!cat || o.c === cat) && f(o.w)).length;
  const wordsIn = cat => W.filter(o => o.c === cat);
  const leftCount = () => W.length - countIn(clear);

  function markSeen(w){ const r = rec(w); if (!r.seen){ r.seen = 1; save(); } }
  function hit(w){  const r = rec(w); r.n++; r.s = Math.min(CLEAR, (r.s|0) + 1); save(); }
  function miss(w){ const r = rec(w); r.n++; r.e++; r.s = 0; save(); }
  function newRound(){
    for (const w in st.p) st.p[w].s = 0;
    st.cur = 0; st.round++; save();
  }

  // ---- 从游标往后凑 GROUP 个还没消掉的词（可绕回开头）----
  function nextBatch(){
    const list = [];
    let i = (st.cur | 0) % W.length;
    for (let k = 0; k < W.length && list.length < GROUP; k++){
      const o = W[i];
      if (!clear(o.w)) list.push(o);
      i = (i + 1) % W.length;
    }
    return list;
  }

  function shuffle(a){ a = a.slice(); for (let i=a.length-1;i>0;i--){ const j = Math.random()*(i+1)|0; [a[i],a[j]]=[a[j],a[i]]; } return a; }
  function pick3(word){
    let pool = W.filter(o => o.w !== word.w && o.zh !== word.zh && o.c === word.c);
    if (pool.length < 3) pool = pool.concat(W.filter(o => o.w !== word.w && o.zh !== word.zh && o.c !== word.c));
    const got = new Set(), out = [];
    for (const o of shuffle(pool)){ if (!got.has(o.zh)){ got.add(o.zh); out.push(o.zh); if (out.length === 3) break; } }
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
    const gone = countIn(clear), once = countIn(w => hits(w) === 1);
    const fresh = countIn(w => !seen(w));
    const practiced = total - fresh;                 // 已练 = 见过的
    const zero = practiced - once - gone;            // 练过但当前 0 次（答错归零 / 还没答对）
    const left = total - gone;
    const allDone = left === 0;

    app.innerHTML = `<div class="screen home">
      <div class="home-head">
        <div>
          <div class="brand">Basic English<span>850</span></div>
          <div class="tagline">第 ${st.round} 轮 · 连对 ${CLEAR} 次消掉一个词</div>
        </div>
        <button class="theme-btn" data-act="theme" aria-label="切换主题">${(localStorage.getItem(TKEY)||"dark")==="dark"?ICON.sun:ICON.moon}</button>
      </div>

      <div class="home-main">
      <button class="go-big ${allDone ? "all-done" : ""}" data-act="${allDone ? "newround" : "go"}">
        <span class="t">${allDone ? `第 ${st.round} 轮完成` : (gone || once ? "继续刷词" : "开始刷词")}</span>
        <span class="s">${allDone ? "点一下开始第 " + (st.round+1) + " 轮" : `接着刷 ${Math.min(GROUP,left)} 个词`}</span>
      </button>

      <div class="prog-card">
        <div class="prog-rows">
          <div class="prow"><i style="background:var(--muted)"></i><span>已练</span><b>${practiced}<em>/ ${total}</em></b></div>
          <div class="prow"><i style="background:var(--accent)"></i><span>对过 1 次</span><b>${once}<em>/ ${total}</em></b></div>
          <div class="prow"><i style="background:var(--good)"></i><span>对过 2 次 · 已消掉</span><b class="${gone ? "hit" : ""}">${gone}<em>/ ${total}</em></b></div>
        </div>
        <div class="bar-track">
          <div class="bar-seg" style="width:${gone/total*100}%;background:var(--good)"></div>
          <div class="bar-seg" style="width:${once/total*100}%;background:var(--accent)"></div>
          <div class="bar-seg" style="width:${zero/total*100}%;background:var(--muted)"></div>
        </div>
        <div class="prog-legend"><span>灰＝练过但还没对　蓝＝对过 1 次　绿＝对过 2 次已消掉　空白＝没见过</span></div>
      </div>

      </div>

      <div class="home-foot">
        <button class="row-link" data-act="cats">
          <span class="ic">${ICON.book}</span>
          <span class="tx"><b>按分类查词</b><em>查词听音 · 可整类过一遍，不计进度</em></span>
          <span class="n">${ICON.chev}</span>
        </button>
        <div class="foot"><button class="link" data-act="reset">重置全部进度</button></div>
      </div>
    </div>`;
  }

  // ================= 分类 =================
  function renderCats(){
    screen = "cats";
    const rows = CATS.map(c => {
      const tot = wordsIn(c.id).length, laps = (st.drill[c.id]||{}).laps | 0;
      return `<div class="cat-row" data-act="cat" data-id="${c.id}">
        <div class="cat-dot" style="background:var(--${c.id})"></div>
        <div class="cat-meta">
          <div class="cat-name">${c.name}<em>${c.zh}</em></div>
          <div class="cat-desc">${c.desc}</div>
        </div>
        <div class="cat-prog"><b>${tot}</b>词${laps ? `<i class="laps">过 ${laps} 遍</i>` : ""}</div>
      </div>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      <div class="bar">
        <button class="back" data-act="home">${ICON.back}返回</button>
        <div class="ttl">按分类查词</div>
        <span class="count"></span>
      </div>
      <div class="cat-list roomy">${rows}</div>
    </div>`;
  }
  function renderBrowse(catId){
    screen = "browse";
    const c = CAT[catId], list = wordsIn(catId);
    const d = st.drill[catId] || { i:0, laps:0 }, dpos = d.i | 0, dlaps = d.laps | 0;
    const dsub = dpos ? `上次看到第 ${dpos+1} 个 · 点一下接着过`
               : dlaps ? `整类已过 ${dlaps} 遍 · 再从头过一遍`
               : `${list.length} 个词自动读音 · 只看不考，不计进度`;
    const rows = list.map(o => {
      const h = hits(o.w);
      const tag = h >= CLEAR ? '<span class="ck">✓</span>'
                : h === 1    ? '<span class="ck mid">1</span>'
                : seen(o.w)  ? '<span class="ck miss">·</span>' : "";
      return `<div class="wrow ${h>=CLEAR?"seen":""}">
        <span class="en">${o.w}</span>${tag}
        <span class="zh">${o.zh}</span>
        <button class="spk" data-act="say" data-w="${o.w}" aria-label="发音">${ICON.spk}</button>
      </div>`;
    }).join("");
    app.innerHTML = `<div class="screen">
      <div class="sticky-head">
        <div class="bar">
          <button class="back" data-act="cats">${ICON.back}返回</button>
          <div class="ttl">${c.name}<small>${c.zh} · ${list.length} 个词</small></div>
          <span class="count"></span>
        </div>
        <button class="row-link" data-act="drill" data-id="${catId}">
          <span class="ic">${ICON.bolt}</span>
          <span class="tx"><b>${dpos ? "接着过这一类" : "过一遍这一类"}</b><em>${dsub}</em></span>
          <span class="n">${dlaps ? dlaps + " 遍" : ICON.chev}</span>
        </button>
      </div>
      <div class="words">${rows}</div>
    </div>`;
  }

  // ================= 刷词 =================
  // sess.phase: "card" 新词先看一眼 → "quiz" 立刻考同一个词
  let sess = null, tok = 0;
  const cur = () => sess.list[sess.idx];

  function start(){
    const list = nextBatch();
    if (!list.length) return false;
    sess = { list, idx:0, phase:"card", drill:false, gone:0, right:0, wrong:0,
             opts:[], ans:-1, picked:null, id:++tok };
    screen = "sess";
    enter();
    return true;
  }
  function startDrill(catId){
    const list = wordsIn(catId);
    if (!list.length) return false;
    const d = drec(catId);
    let idx = d.i | 0; if (idx >= list.length) idx = 0;
    sess = { list, idx, phase:"card", drill:true, cat:catId, peek:false, id:++tok };
    screen = "sess";
    render(); speak(cur().w);
    return true;
  }
  function enter(){
    if (!sess) return;
    if (sess.idx >= sess.list.length){ renderDone(); return; }
    const o = cur();
    sess.phase = seen(o.w) ? "quiz" : "card";   // 没见过 → 先亮答案（选项模糊），点一下再答
    sess.listen = hits(o.w) === 1;              // 形态进门就锁定，答完题 s 变了也不受影响
    sess.picked = null;
    makeOpts();                                 // 选项一开始就生成，布局才不会变
    render();
    speak(o.w);
    const nx = sess.list[sess.idx+1];
    if (nx) prefetch(nx.w);
  }
  function makeOpts(){
    const o = cur(), opts = pick3(o);
    const pos = Math.random() * (opts.length + 1) | 0;
    opts.splice(pos, 0, o.zh);
    sess.opts = opts; sess.ans = pos;
  }
  // 卡片看完 → 立刻考这个词
  function cardToQuiz(){
    if (!sess || sess.phase !== "card" || sess.drill) return;
    markSeen(cur().w);
    sess.phase = "quiz"; sess.listen = false;
    const scr = app.querySelector(".screen");
    if (scr){ scr.classList.remove("preview"); scr.removeAttribute("data-act"); }
    const tip = app.querySelector(".q-tip");
    if (tip) tip.textContent = "选出正确的中文意思";   // 中文释义 → 答题提示
    speak(cur().w);
  }
  function step(){
    const i = IDX[cur().w];
    if (i != null) st.cur = (i + 1) % W.length;
    save();
    sess.idx++;
    enter();
  }

  function render(){
    if (sess.drill) renderDrill(); else renderQuiz();
    fitWords();
  }
  // 单词一律单行：渲染后量一下，放不下就按比例把字号缩到刚好
  function fitWords(){
    app.querySelectorAll(".speed-word,.q-word").forEach(el => {
      el.style.fontSize = "";
      let size = parseFloat(getComputedStyle(el).fontSize);
      for (let k = 0; k < 6 && el.scrollWidth > el.clientWidth; k++){
        size = Math.max(16, size * (el.clientWidth / el.scrollWidth) - 0.5);
        el.style.fontSize = size + "px";
      }
    });
  }
  function topBar(){
    return `<div class="bar">
      <button class="back" data-act="${sess.drill ? "cat" : "home"}" ${sess.drill?`data-id="${sess.cat}"`:""}>${ICON.back}退出</button>
      <div class="ttl">${sess.drill ? CAT[sess.cat].zh : "刷词"}<small>${sess.drill ? ("只看不考" + ((st.drill[sess.cat]||{}).laps ? " · 已过 " + st.drill[sess.cat].laps + " 遍" : "")) : "本轮还剩 " + leftCount() + " 词"}</small></div>
      <span class="count">${sess.idx+1}/${sess.list.length}</span>
    </div>
    <div class="pline"><i style="width:${sess.idx/sess.list.length*100}%"></i></div>`;
  }

  // ---- 考题：第 1 次看词选中文，第 2 次纯听音选中文 ----
  function renderQuiz(){
    const o = cur(), c = CAT[o.c], picked = sess.picked != null;
    const preview = sess.phase === "card";      // 新词：先把答案摆出来，选项模糊着
    const listen = !preview && !!sess.listen;   // 对过一次了 → 升级成纯听音（进门时锁定）
    let stem, tip;
    if (preview){
      stem = `<div class="q-word">${o.w}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">${ICON.spk}<span>听发音</span></button>`;
      tip = `<span class="q-mean">${o.zh}</span>`;
    } else if (!listen){
      stem = `<div class="q-word">${o.w}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">${ICON.spk}<span>听发音</span></button>`;
      tip = "选出正确的中文意思";
    } else if (picked){                          // 听音题答完，把词形和释义都揭出来
      stem = `<div class="q-word">${o.w}</div><div class="q-sub">${o.zh}</div>
              <button class="spk-btn flat" data-act="say" data-w="${o.w}">${ICON.spk}<span>听发音</span></button>`;
      tip = "";
    } else {
      stem = `<button class="listen-spk" data-act="say" data-w="${o.w}" aria-label="播放发音">${ICON.spk}</button>`;
      tip = "只听发音 · 选出对应的中文意思";
    }
    const opts = sess.opts.map((t,i) => {
      let cls = "", mk = "";
      if (picked){
        if (i === sess.ans){ cls = "correct"; mk = '<span class="mk">' + ICON.check + '</span>'; }
        else if (i === sess.picked){ cls = "wrong"; mk = '<span class="mk">' + ICON.x + '</span>'; }
      }
      return `<button class="opt ${cls}" data-act="opt" data-i="${i}"><span class="k">${i+1}</span>${t}${mk}</button>`;
    }).join("");
    const mark = picked
      ? (sess.picked === sess.ans
          ? (hits(o.w) >= CLEAR ? `<div class="verdict good">连对 ${CLEAR} 次 · 本轮消掉 ✓</div>`
                                : `<div class="verdict">答对 1 次 · 再对 1 次就消掉</div>`)
          : `<div class="verdict bad">留在本轮，等下再遇到</div>`)
      : `<div class="verdict ph"></div>`;   // 占位，免得答完题选项往上跳
    app.innerHTML = `<div class="screen stage quiz${preview ? " preview" : ""}"${preview ? ' data-act="card-go"' : ""}>
      ${topBar()}
      <div class="q-card">
        <div class="q-cat">${dot(o.c)}${c.name}${listen ? '<span class="lv">听力</span>' : preview ? '<span class="lv new">新词</span>' : ''}</div>
        ${stem}
        ${tip ? `<div class="q-tip">${tip}</div>` : ""}
      </div>
      <div class="opts">${opts}</div>
      ${mark}
    </div>`;
  }

  // ---- 分类里的「过一遍」：纯卡片，不计进度 ----
  function renderDrill(){
    const o = cur(), c = CAT[o.c], on = st.opt.zh, show = on || sess.peek;
    app.innerHTML = `<div class="screen stage">
      ${topBar()}
      <div class="flash" data-act="next">
        <div class="cat">${dot(o.c)}${c.name}</div>
        <button class="spk-btn" data-act="say" data-w="${o.w}" aria-label="发音">${ICON.spk}</button>
        <div class="speed-word">${o.w}</div>
        ${show ? `<div class="speed-zh">${o.zh}</div>`
               : `<button class="speed-zh peek" data-act="peek">· · · 点这看中文</button>`}
        <div class="hint">点卡片任意处 → 下一个词</div>
      </div>
      <div class="toolbar">
        <button class="tool" data-act="prev" ${sess.idx===0?"disabled":""}>‹ 上一个</button>
        <button class="tool" data-act="say" data-w="${o.w}">${ICON.spk}重听</button>
        <button class="tool ${on?"on":""}" data-act="tzh">中文 ${on?"开":"关"}</button>
      </div>
      <div class="keytips">空格/→ 下一个 · ← 上一个 · R 重听</div>
    </div>`;
  }
  function drillStep(step){
    const i = sess.idx + step;
    if (i < 0) return;
    const d = drec(sess.cat);
    if (i >= sess.list.length){            // 整类过完一遍
      d.laps = (d.laps|0) + 1; d.i = 0; save();
      renderDrillDone(); return;
    }
    sess.idx = i; sess.peek = false;
    d.i = i; save();
    render(); speak(cur().w);
  }
  function renderDrillDone(){
    screen = "done";
    const c = CAT[sess.cat], d = drec(sess.cat), n = sess.list.length;
    app.innerHTML = `<div class="screen done">
      <div class="emoji">🔁</div>
      <div class="t">${c.zh} 过完第 ${d.laps} 遍</div>
      <div class="s">${n} 个词 · 这一类累计过了 ${d.laps} 遍</div>
      <div class="done-btns">
        <button class="btn-primary" data-act="drill" data-id="${sess.cat}">再过一遍</button>
        <button class="btn-ghost" data-act="cat" data-id="${sess.cat}">返回词表</button>
      </div>
    </div>`;
  }

  function pickOpt(i){
    if (!sess || sess.drill) return;
    if (sess.phase === "card"){ cardToQuiz(); return; }   // 模糊阶段点哪儿都只是揭开
    if (sess.picked != null) return;
    sess.picked = i;
    const o = cur(), right = i === sess.ans;
    if (right){ sess.right++; hit(o.w); if (clear(o.w)) sess.gone++; }
    else { sess.wrong++; miss(o.w); }
    paintAnswer();
    const id = sess.id;
    setTimeout(() => { if (sess && sess.id === id) step(); }, right ? 750 : 1700);
  }

  // 答题反馈只做局部更新：重建 DOM 会让 .q-card / .screen 的入场动画重播，
  // 单词就会跟着跳一下——快速刷词时非常累眼。
  function paintAnswer(){
    const o = cur(), right = sess.picked === sess.ans;
    app.querySelectorAll(".opt").forEach((el, i) => {
      if (i === sess.ans){
        el.classList.add("correct");
        el.insertAdjacentHTML("beforeend", '<span class="mk">' + ICON.check + '</span>');
      } else if (i === sess.picked){
        el.classList.add("wrong");
        el.insertAdjacentHTML("beforeend", '<span class="mk">' + ICON.x + '</span>');
      }
    });
    const v = app.querySelector(".verdict");
    if (v){
      v.className = "verdict " + (right ? (hits(o.w) >= CLEAR ? "good" : "") : "bad");
      v.textContent = right
        ? (hits(o.w) >= CLEAR ? `连对 ${CLEAR} 次 · 本轮消掉 ✓` : `答对 1 次 · 再对 1 次就消掉`)
        : "留在本轮，等下再遇到";
    }
    const tip = app.querySelector(".q-tip");
    if (tip) tip.style.visibility = "hidden";   // 留着占位，免得卡片变矮又跳一下
    if (sess.listen){                           // 只有听音题要把题干换成揭晓
      const spk = app.querySelector(".listen-spk");
      if (spk){
        spk.outerHTML = `<div class="q-word">${o.w}</div><div class="q-sub">${o.zh}</div>
          <button class="spk-btn flat" data-act="say" data-w="${o.w}">${ICON.spk}<span>听发音</span></button>`;
        fitWords();
      }
    }
  }

  function renderDone(){
    screen = "done";
    const n = sess.list.length, left = leftCount();
    const allDone = left === 0;
    app.innerHTML = `<div class="screen done">
      <div class="emoji">${allDone ? "🏆" : sess.wrong === 0 ? "🎯" : "⚡️"}</div>
      <div class="t">${allDone ? `第 ${st.round} 轮全部消完` : `消掉 ${sess.gone} 个`}</div>
      <div class="s">${allDone ? "850 个词都连对 " + CLEAR + " 次了"
        : `这组 ${n} 个 · 对 ${sess.right} 错 ${sess.wrong} · 本轮还剩 ${left} 词`}</div>
      <div class="done-btns">
        ${allDone ? `<button class="btn-primary" data-act="newround">开始第 ${st.round+1} 轮</button>`
                  : `<button class="btn-primary" data-act="go">再来 ${Math.min(GROUP,left)} 个</button>`}
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
        if (confirm("确定重置全部进度？")){ st = norm({ p:{}, cur:0, round:1, drill:{}, opt:st.opt }); save(); renderHome(); }
        break;
      case "newround": newRound(); if (!start()) renderHome(); break;
      case "cats": sess = null; renderCats(); break;
      case "cat": sess = null; renderBrowse(t.dataset.id); break;
      case "drill": startDrill(t.dataset.id); break;
      case "say": speak(t.dataset.w); break;
      case "go": if (!start()) renderHome(); break;
      case "card-go": cardToQuiz(); break;
      case "opt": pickOpt(+t.dataset.i); break;
      case "next": drillStep(1); break;
      case "prev": drillStep(-1); break;
      case "peek": sess.peek = true; render(); break;
      case "tzh": st.opt.zh = !st.opt.zh; save(); sess.peek = false; render(); break;
    }
  });

  document.addEventListener("keydown", e => {
    if (screen !== "sess" || !sess) return;
    const k = e.key.toLowerCase();
    if (sess.drill){
      if (e.code === "Space" || e.key === "ArrowRight"){ e.preventDefault(); drillStep(1); }
      else if (e.key === "ArrowLeft") drillStep(-1);
      else if (k === "r") speak(cur().w);
      else if (k === "z"){ st.opt.zh = !st.opt.zh; save(); sess.peek = false; render(); }
    } else if (sess.phase === "card"){
      if (e.code === "Space"){ e.preventDefault(); cardToQuiz(); }
      else if (k === "r") speak(cur().w);
    } else {
      if ("1234".includes(e.key)) pickOpt(+e.key - 1);
      else if (k === "r") speak(cur().w);
    }
  });

  // ================= 左滑返回（手机/iPad） =================
  function goBack(){
    if (screen === "sess" || screen === "done"){
      if (sess && sess.drill){ const c = sess.cat; sess = null; renderBrowse(c); }
      else { sess = null; renderHome(); }
      return true;
    }
    if (screen === "browse"){ renderCats(); return true; }
    if (screen === "cats"){ sess = null; renderHome(); return true; }
    return false;                                  // 首页没有上一层
  }

  let hint = null, sx = 0, sy = 0, stime = 0, swiping = false;
  const EDGE = 34, NEED = 62;                      // 从左边缘 34px 内起手，右滑 62px 触发
  function setHint(dx){
    if (!hint) return;
    if (dx <= 0){ hint.style.opacity = "0"; hint.style.transform = "translate(-100%,-50%)"; return; }
    const p = Math.min(dx / NEED, 1);
    hint.style.opacity = String(Math.min(p * 1.2, 1));
    hint.style.transform = `translate(${-100 + p * 130}%,-50%) scale(${.8 + p * .2})`;
    hint.classList.toggle("ready", p >= 1);
  }
  document.addEventListener("touchstart", e => {
    swiping = false;
    if (e.touches.length !== 1 || screen === "home") return;
    const t = e.touches[0];
    if (t.clientX > EDGE) return;
    swiping = true; sx = t.clientX; sy = t.clientY; stime = Date.now();
  }, { passive:true });
  document.addEventListener("touchmove", e => {
    if (!swiping) return;
    const t = e.touches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    if (dy > 44 && dx < 30){ swiping = false; setHint(0); return; }   // 其实是在竖着滚
    setHint(dx);
  }, { passive:true });
  document.addEventListener("touchend", e => {
    if (!swiping) return;
    swiping = false;
    const t = e.changedTouches[0], dx = t.clientX - sx, dy = Math.abs(t.clientY - sy);
    setHint(0);
    if (dx >= NEED && dx > dy * 1.2 && Date.now() - stime < 900) goBack();
  }, { passive:true });
  document.addEventListener("touchcancel", () => { swiping = false; setHint(0); }, { passive:true });
  document.addEventListener("keydown", e => { if (e.key === "Escape") goBack(); });

  // ---------- boot ----------
  applyTheme();
  hint = document.createElement("div");
  hint.id = "backhint"; hint.textContent = "‹";
  document.body.appendChild(hint);
  renderHome();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(()=>{});
})();
