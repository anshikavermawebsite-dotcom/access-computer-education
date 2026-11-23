/* ============================================================
   🎙️ VOICE ASSISTANT  (Dark Mode button ke paas wala mic)
   1) Login check  -> localStorage 'acec_user' (login na ho to login modal khulta hai)
   2) Navigation   -> "Home", "CCC Test", "Comment" ... bolo, page smooth scroll hota hai
   3) Question     -> poori website ke Q&A (QB + MS Office/Python qa-card + Daily) scan karke
                      matching Question + Answer floating popup me dikhata hai
   ============================================================ */
(() => {
  const el = id => document.getElementById(id);
  const mic = el('micBtn'), panel = el('vaPanel');
  if (!mic || !panel) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const statusEl = el('vaStatus'), heard = el('vaHeard'), body = el('vaBody'), inp = el('vaInp'), langBtn = el('vaLang');

  /* ---------- 1) Login check ---------- */
  const isLogged = () => { try { const u = JSON.parse(localStorage.getItem('acec_user')); return !!(u && u.name); } catch { return false; } };
  let pendingLogin = false;
  const needLogin = () => {
    if (isLogged()) return false;
    pendingLogin = true;
    closePanel(); stopRec();
    if (typeof toast === 'function') toast('Voice Assistant ke liye pehle Login karein 🔐');
    if (typeof openModal === 'function') openModal('loginModal');
    return true;
  };

  /* ---------- Helpers ---------- */
  const siteHi = () => { try { return lang === 'hi'; } catch { return false; } };   // lang abhi bana na ho to bhi crash nahi
  let sLang = null;                                   // speech language (null = site ki language follow kare)
  const speechLang = () => sLang || (siteHi() ? 'hi-IN' : 'en-IN');
  const paintLangBtn = () => { langBtn.textContent = '🗣️ ' + (speechLang() === 'hi-IN' ? 'हिन्दी' : 'English'); };
  const norm = s => (s || '').toLowerCase().replace(/[\u200c\u200d]/g, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();
  const cond = s => norm(s).replace(/\s+/g, '');
  const setStatus = (t, cls) => { statusEl.textContent = t; statusEl.className = 'va-status' + (cls ? ' ' + cls : ''); };
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const openPanel = () => { panel.classList.add('open'); };
  function closePanel() { panel.classList.remove('open'); if (window.speechSynthesis) speechSynthesis.cancel(); }

  /* ---------- 2) Navigation commands ---------- */
  const NAV = [
    ['olcode', 'O-Level Coding', ['o level coding', 'olevel coding', 'o level code', 'o level m2 r5', 'ओ लेवल कोडिंग', 'ओ लेवल कोड', 'ओलेवल कोडिंग']],
    ['codepractice', 'Coding Practice', ['coding practice', 'code practice', 'code editor', 'online editor', 'editor', 'कोडिंग प्रैक्टिस', 'कोड एडिटर', 'एडिटर']],
    ['olevel', 'O-Level Test', ['o level test', 'olevel test', 'o level', 'olevel', 'ओ लेवल टेस्ट', 'ओ लेवल', 'ओलेवल']],
    ['ccc', 'CCC Test', ['ccc test', 'ccc', 'c c c', 'c c c test', 'सीसीसी टेस्ट', 'सीसीसी', 'सी सी सी']],
    ['msoffice', 'MS Office', ['ms office', 'microsoft office', 'office', 'ms word', 'word', 'excel', 'ms excel', 'powerpoint', 'ms powerpoint', 'एमएस ऑफिस', 'ऑफिस', 'ऑफ़िस', 'वर्ड', 'एक्सेल', 'पावरपॉइंट']],
    ['python-section', 'Python', ['python', 'python test', 'python chapters', 'पायथन', 'पाइथन', 'पायथॉन']],
    ['home', 'Home', ['home', 'home page', 'main page', 'top', 'start', 'ghar', 'होम', 'घर', 'शुरू']],
    ['gallery', 'Gallery', ['gallery', 'photos', 'गैलरी', 'फोटो']],
    ['courses', 'Courses', ['courses', 'course', 'our courses', 'कोर्स', 'कोर्सेस', 'कोर्सेज']],
    ['faculty', 'Faculty', ['faculty', 'teachers', 'teacher', 'फैकल्टी', 'शिक्षक', 'टीचर']],
    ['typing', 'Typing', ['typing', 'typing game', 'typing games', 'टाइपिंग', 'टाइपिंग गेम']],
    ['saturday', 'Leaderboard', ['leaderboard', 'saturday test', 'saturday', 'top 10', 'लीडरबोर्ड', 'शनिवार टेस्ट']],
    ['daily', 'Daily Question', ['daily', 'daily question', 'roz ka sawal', 'रोज का सवाल', 'डेली']],
    ['qotd', 'Question of the Day', ['qotd', 'question of the day', 'आज का सवाल']],
    ['contact', 'Contact', ['contact', 'contact us', 'sampark', 'कॉन्टैक्ट', 'संपर्क', 'कांटेक्ट']],
    ['reviews', 'Comment / Reviews', ['comment', 'comments', 'review', 'reviews', 'feedback', 'student reviews', 'कमेंट', 'कमेन्ट', 'रिव्यू', 'रिव्यु', 'फीडबैक', 'समीक्षा']]
  ];
  const FILL = new Set('go to open show me take please plz scroll navigate section page tab jao jaao chalo chal kholo kholiye dikhao dikha do karo kar par pe ko wala wali ka ki ke the my mujhe hume humein जाओ चलो खोलो खोलिए दिखाओ दिखा दो करो पर को का की के सेक्शन पेज'.split(' '));
  const THEME = [['dark', ['dark mode', 'dark', 'night mode', 'डार्क मोड', 'डार्क', 'अंधेरा']], ['light', ['light mode', 'light', 'day mode', 'लाइट मोड', 'लाइट', 'उजाला']]];

  function tryCommand(text) {
    const rest = norm(text).split(' ').filter(w => w && !FILL.has(w)).join(' ');
    if (!rest) return null;
    const rc = rest.replace(/\s+/g, '');
    for (const [mode, al] of THEME) if (al.some(a => norm(a) === rest || cond(a) === rc)) return { kind: 'theme', mode };
    for (const [id, label, al] of NAV) if (al.some(a => norm(a) === rest || cond(a) === rc)) return { kind: 'nav', id, label };
    return null;
  }
  function doCommand(c) {
    if (c.kind === 'theme') {
      if (typeof setTheme === 'function') setTheme(c.mode);
      setStatus('✅ ' + (c.mode === 'dark' ? 'Dark' : 'Light') + ' mode on', 'ok'); setTimeout(closePanel, 1200); return;
    }
    const t = el(c.id);
    if (!t || getComputedStyle(t).display === 'none') { setStatus('😕 "' + c.label + '" section abhi page par available nahi hai', 'bad'); return; }
    setStatus('✅ "' + c.label + '" par le ja raha hu…', 'ok');
    body.innerHTML = '';
    t.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setTimeout(closePanel, 1100);
  }

  /* ---------- 3) Question search (poori website scan) ---------- */
  const STOP = new Set(('the a an is are was were of in on to for and or what which who whom how does do did kya hai hain tha the ka ki ke ko se me mein par pe kaun kaunsi kaunsa kaise kab kyu kyun ' +
    'batao bataiye bataye bolo bolna sawal question questions answer ans jawab uttar chapter ccc test tell about called said full form ' +
    'क्या है हैं था का की के को से में पर कौन कौनसा कौनसी कैसे कब क्यों बताओ बताइए बोलो सवाल प्रश्न उत्तर जवाब कहलाता कहलाती कहते').split(' '));
  const toks = s => norm(s).split(' ').filter(w => w && !STOP.has(w) && (w.length > 1 || /\d/.test(w)));
  const cleanQ = s => (s || '').replace(/^\s*Q\s*\.?\s*\d+\s*[.):\-–]*\s*/i, '').replace(/\s+/g, ' ').trim();
  const cleanA = s => (s || '').replace(/^\s*(Answer|Ans|उत्तर|जवाब)\s*[:：\-]?\s*/i, '').replace(/\s+/g, ' ').trim();
  const srcOfCard = c => {
    const tab = c.closest('.mso-tab-content'), sec = c.closest('section');
    const names = { 'msword-tab': 'MS Word', 'msexcel-tab': 'MS Excel', 'mspowerpoint-tab': 'MS PowerPoint' };
    let s = sec && sec.id === 'python-section' ? '🐍 Python' : '🖥️ MS Office';
    if (tab) { const h = tab.querySelector('.sub-heading'); s += ' › ' + (names[tab.id] || (h ? h.textContent.replace(/^[^A-Za-z0-9]+/, '').slice(0, 40) : tab.id)); }
    return s;
  };

  /* Poori website se items jama karta hai (har baar fresh, taaki Hindi/English badalne par bhi sahi chale) */
  function buildItems() {
    const items = [];
    // (a) Test question bank: CCC + O-Level chapters
    if (typeof QB !== 'undefined') {
      const chap = k => { const c = [...(typeof CCC !== 'undefined' ? CCC : []), ...(typeof OL !== 'undefined' ? OL : [])].find(x => x[0] === k); return c ? (k[0] === 'c' ? '📝 CCC › ' : '📝 O-Level › ') + (typeof ttl === 'function' ? ttl(c) : c[1]) : '📝 ' + k; };
      Object.keys(QB).forEach(k => QB[k].forEach(b => {
        if (!b || !b.q) return;
        const hay = [b.q.en, b.q.hi].filter(Boolean).join(' ');
        items.push({ type: 'qb', k, b, hay, src: chap(k) });
      }));
    }
    // (b) Website ke andar likhe hue Q&A cards (MS Word / Excel / PowerPoint / Python ...)
    document.querySelectorAll('.qa-card').forEach(c => {
      const h = c.querySelector('h4'), p = c.querySelector('p');
      if (!h || !p) return;
      items.push({ type: 'card', el: c, q: cleanQ(h.textContent), a: cleanA(p.textContent), hay: cleanQ(h.textContent), src: srcOfCard(c) });
    });
    // (c) Daily question
    if (typeof DAILY !== 'undefined') DAILY.forEach(d => items.push({ type: 'daily', q: d[0], a: d[1], hay: d[0], src: '📅 Daily Question' }));
    return items;
  }

  function score(qt, qn, it) {
    if (!it._t) { it._n = norm(it.hay); it._t = toks(it.hay); it._s = new Set(it._t); }
    if (!it._t.length) return 0;
    let m = 0;
    for (const w of qt) {
      if (it._s.has(w)) { m++; continue; }
      if (w.length >= 4 && it._t.some(x => x.length >= 4 && (x.startsWith(w) || w.startsWith(x)))) m += .8;
    }
    const cov = m / qt.length, prec = m / it._t.length;
    if (cov < (qt.length >= 3 ? .6 : .99)) return 0;          // chhote sawal (1-2 shabd) me saare shabd milne chahiye
    let sc = .75 * cov + .25 * Math.min(1, prec);
    if (qn.length > 6 && it._n.includes(qn)) sc += .3;
    return sc;
  }
  function search(texts) {
    const items = buildItems(), seen = new Map();
    texts.forEach(txt => {
      const qt = toks(txt), qn = norm(txt);
      if (!qt.length) return;
      items.forEach(it => {
        const s = score(qt, qn, it);
        if (s <= 0) return;
        const key = (it._n || '').slice(0, 90);
        const old = seen.get(key);
        if (!old || old.sc < s) seen.set(key, { it, sc: s });
      });
    });
    return [...seen.values()].sort((a, b) => b.sc - a.sc).slice(0, 5).map(x => x.it);
  }

  /* ---------- Popup me result dikhana ---------- */
  let current = null;
  const view = it => {
    if (it.type === 'qb') {
      const b = it.b, opts = typeof oOf === 'function' ? oOf(b) : b.o[b.ol || 'en'], q = typeof qOf === 'function' ? qOf(b) : (b.q.en || b.q.hi);
      return { q, opts, a: opts[b.a], correct: b.a };
    }
    return { q: it.q, opts: null, a: it.a, correct: -1 };
  };
  function render(it, rest) {
    current = it; body.innerHTML = '';
    const v = view(it), card = mk('div', 'va-card');
    card.append(mk('small', 'va-src', it.src), mk('div', 'va-q', '❓ ' + v.q));
    if (v.opts) {
      const ul = mk('ul', 'va-opts');
      v.opts.forEach((o, i) => ul.append(mk('li', i === v.correct ? 'ok' : '', (i === v.correct ? '✔ ' : '') + String.fromCharCode(65 + i) + ') ' + o)));
      card.append(ul);
    }
    card.append(mk('div', 'va-a', '✅ Answer: ' + v.a));
    const act = mk('div', 'va-act');
    const speak = mk('button', '', '🔊 Suno'); speak.type = 'button';
    speak.onclick = () => {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(v.q + '. ' + (siteHi() || /[\u0900-\u097F]/.test(v.a) ? 'उत्तर: ' : 'Answer: ') + v.a);
      u.lang = /[\u0900-\u097F]/.test(v.q + v.a) ? 'hi-IN' : 'en-IN'; speechSynthesis.speak(u);
    };
    act.append(speak);
    if (it.type === 'card') {
      const go = mk('button', '', '📍 Page par dikhao'); go.type = 'button';
      go.onclick = () => reveal(it.el); act.append(go);
    }
    if (it.type === 'qb' && typeof openTest === 'function') {
      const tb = mk('button', '', '📝 Is chapter ka test'); tb.type = 'button';
      tb.onclick = () => { closePanel(); openTest(it.k); }; act.append(tb);
    }
    card.append(act); body.append(card);
    if (rest && rest.length) {
      body.append(mk('div', 'va-more', 'Milte-julte sawal:'));
      rest.forEach((o, i) => {
        const b = mk('button', 'va-alt', cleanQ(view(o).q).slice(0, 110)); b.type = 'button';
        b.onclick = () => render(o, [it, ...rest.filter(x => x !== o)].slice(0, 3)); body.append(b);
      });
    }
    // Agar Hindi/English me translation baaki hai to peeche se ho jayegi aur popup update ho jayega
    if (it.type === 'qb' && typeof ensureLang === 'function' && typeof lang !== 'undefined' && lang !== (it.b.ol || 'en') && !(it.b.q[lang] && it.b.o[lang]))
      ensureLang(it.b, lang).then(ok => { if (ok && current === it) render(it, rest); }).catch(() => { });
  }
  function reveal(c) {
    const tab = c.closest('.mso-tab-content'), sec = c.closest('section');
    if (tab && sec && typeof _tabs === 'function') {
      _tabs(sec.id, null, tab.id);
      sec.querySelectorAll('.mso-tab-btn').forEach(b => { if ((b.getAttribute('onclick') || '').includes("'" + tab.id + "'")) b.classList.add('active'); });
    }
    closePanel();
    setTimeout(() => { c.scrollIntoView({ behavior: 'smooth', block: 'center' }); c.classList.add('va-flash'); setTimeout(() => c.classList.remove('va-flash'), 3200); }, 120);
  }

  /* ---------- Main handler ---------- */
  function handle(texts) {
    texts = texts.map(t => (t || '').trim()).filter(Boolean);
    if (!texts.length) return;
    if (needLogin()) return;
    openPanel(); heard.textContent = '🗣️ "' + texts[0] + '"';
    for (const t of texts) { const c = tryCommand(t); if (c) return doCommand(c); }
    const res = search(texts);
    if (!res.length) {
      body.innerHTML = '';
      body.append(mk('div', 'va-none', '😕 Is sawal ka jawab website me nahi mila. Thoda alag shabdon me bolein ya neeche type karke poochein.'));
      setStatus('Koi match nahi mila', 'bad'); return;
    }
    setStatus('✅ ' + res.length + ' match mile', 'ok');
    render(res[0], res.slice(1));
  }

  /* ---------- Mic (Speech Recognition) ---------- */
  let rec = null, listening = false, gotFinal = false;
  function stopRec() { try { rec && rec.stop(); } catch { } }
  function startRec() {
    if (!SR) { setStatus('⚠️ Is browser me voice support nahi hai (Chrome/Edge use karein). Neeche type karke poochein ⌨️', 'bad'); inp.focus(); return; }
    rec = new SR(); rec.lang = speechLang(); rec.interimResults = true; rec.continuous = false; rec.maxAlternatives = 3;
    gotFinal = false; heard.textContent = ''; body.innerHTML = '';
    rec.onstart = () => { listening = true; mic.classList.add('listening'); setStatus('🎙️ Sun raha hu… boliye', 'live'); };
    rec.onresult = e => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) { gotFinal = true; handle([...r].map(a => a.transcript)); }
        else interim += r[0].transcript;
      }
      if (interim) heard.textContent = '🗣️ ' + interim + '…';
    };
    rec.onerror = e => {
      const m = { 'not-allowed': '🚫 Mic ki permission band hai — browser me mic allow karein', 'service-not-allowed': '🚫 Mic ki permission band hai', 'no-speech': '🤷 Kuch sunai nahi diya, dobara try karein', 'audio-capture': '🎤 Mic nahi mila', 'network': '🌐 Internet check karein (voice ke liye zaruri hai)' };
      if (e.error !== 'aborted') setStatus(m[e.error] || 'Voice error: ' + e.error, 'bad');
    };
    rec.onend = () => { listening = false; mic.classList.remove('listening'); if (!gotFinal && statusEl.classList.contains('live')) setStatus('Mic dabakar dobara boliye', ''); };
    try { rec.start(); } catch { }
  }

  /* ---------- Events ---------- */
  mic.addEventListener('click', () => {
    if (needLogin()) return;
    openPanel();
    if (listening) { stopRec(); return; }
    paintLangBtn(); startRec();
  });
  window.activateVoiceAssistant = () => mic.click();       // purana onclick naam bhi chalta rahe
  el('vaClose').onclick = () => { stopRec(); closePanel(); };
  langBtn.onclick = () => { sLang = speechLang() === 'hi-IN' ? 'en-IN' : 'hi-IN'; paintLangBtn(); if (listening) stopRec(); setTimeout(() => { if (isLogged()) startRec(); }, 250); };
  el('vaForm').onsubmit = e => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ''; stopRec(); handle([v]); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) { stopRec(); closePanel(); } });
  paintLangBtn();
  // Login poora hote hi yaad dilao ki ab mic chalega
  const lm = el('loginModal');
  if (lm) new MutationObserver(() => { if (!lm.classList.contains('open') && pendingLogin && isLogged()) { pendingLogin = false; if (typeof toast === 'function') setTimeout(() => toast('✅ Login ho gaya! Ab 🎙️ mic dabakar bolein'), 600); } }).observe(lm, { attributes: true, attributeFilter: ['class'] });
})();

/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('show'), 2600); }
const openModal = id => $('#' + id).classList.add('open');
const closeModal = id => $('#' + id).classList.remove('open');

/* ===== Language (Hindi / English) ===== */
let lang = store.get('acec_lang', 'en');
const L = {
  hi: { olcode: 'O-Level कोडिंग', codepr: 'कोडिंग प्रैक्टिस', x_rev: 'गलत जवाब देखें', x_retryW: 'गलत सवाल दोबारा', x_card: 'रिज़ल्ट कार्ड', x_share: 'WhatsApp पर शेयर', x_best: 'बेस्ट', x_yourA: 'आपका उत्तर', x_rightA: 'सही उत्तर', x_noWrong: 'वाह! एक भी जवाब गलत नहीं 🎉', x_trIng: '🌐 हिन्दी अनुवाद हो रहा है…', x_trFail: '⚠ अनुवाद नहीं हो सका (इंटरनेट जाँचें), मूल भाषा दिख रही है', x_skip: 'छोड़ा गया', home: 'होम', gallery: 'गैलरी', courses: 'कोर्सेस', faculty: 'फैकल्टी', ccc: 'CCC टेस्ट', ol: 'O-Level टेस्ट', typing: 'टाइपिंग', lb: 'लीडरबोर्ड', contact: 'संपर्क', cta1: 'CCC टेस्ट दें', cta2: 'कोर्स देखें', login: 'लॉगिन', satBtn: 'शनिवार टेस्ट शुरू करें', searchPh: 'टेस्ट, कोर्स या सवाल खोजें...', start: 'टेस्ट शुरू करें', nq: '{n} प्रश्न', soonS: 'जल्द आ रहा है', soon: 'इस चैप्टर के प्रश्न जल्द जोड़े जाएँगे', loginFirst: 'पहले लॉगिन करें', qOf: 'प्रश्न {i} / {n}', next: 'अगला प्रश्न ➔', result: 'परिणाम देखें', sat: 'शनिवार टेस्ट', back: 'वापस जाएँ', done: 'टेस्ट पूरा हुआ', sc: '{p}% स्कोर।', m1: 'शानदार प्रदर्शन! 🎉', m2: 'अच्छा प्रयास, थोड़ा और अभ्यास करें।', m3: 'कोई बात नहीं, दोबारा कोशिश करें।', exitT: 'टेस्ट छोड़ना चाहते हैं?', exitQ: 'क्या आप टेस्ट से बाहर आना चाहते हैं? आपकी प्रगति सेव रहेगी।', cancel: 'रद्द करें', yes: 'हाँ, बाहर जाएँ', resumeT: 'आपका टेस्ट अधूरा है', resumeQ: 'आपने {n} में से {i} प्रश्न हल किए हैं। वहीं से जारी रखें या शुरू से करें?', resume: '▶ Resume', restart: '↺ Starting से', noRes: 'कोई परिणाम नहीं मिला', sugg: 'लोकप्रिय टेस्ट', tTest: 'टेस्ट', tCourse: 'कोर्स', tSec: 'सेक्शन', tQ: 'प्रश्न', empty: 'अभी कोई एंट्री नहीं है। शनिवार टेस्ट देने वाले पहले बनें!', chap: 'चैप्टर', saved: 'सेव: {i}/{n}' },
  en: { olcode: 'O-Level Coding', codepr: 'Coding Practice', x_rev: 'Review wrong answers', x_retryW: 'Retry wrong questions', x_card: 'Result card', x_share: 'Share on WhatsApp', x_best: 'Best', x_yourA: 'Your answer', x_rightA: 'Correct answer', x_noWrong: 'Wow! No wrong answers 🎉', x_trIng: '🌐 Translating to English…', x_trFail: '⚠ Could not translate (check internet), showing original', x_skip: 'Skipped', home: 'Home', gallery: 'Gallery', courses: 'Courses', faculty: 'Faculty', ccc: 'CCC Test', ol: 'O-Level Test', typing: 'Typing', lb: 'Leaderboard', contact: 'Contact', cta1: 'Take CCC Test', cta2: 'View Courses', login: 'Login', satBtn: 'Start Saturday Test', searchPh: 'Search tests, courses or questions...', start: 'Start Test', nq: '{n} Questions', soonS: 'Coming soon', soon: 'Questions for this chapter will be added soon', loginFirst: 'Please login first', qOf: 'Question {i} / {n}', next: 'Next Question ➔', result: 'See Result', sat: 'Saturday Test', back: 'Go Back', done: 'Test Complete', sc: '{p}% score.', m1: 'Outstanding performance! 🎉', m2: 'Good effort, practise a little more.', m3: 'No worries, try again and improve.', exitT: 'Leave the test?', exitQ: 'Do you want to leave the test? Your progress will be saved.', cancel: 'Cancel', yes: 'Yes, leave', resumeT: 'You have an unfinished test', resumeQ: 'You have completed {i} of {n} questions. Resume from there or start over?', resume: '▶ Resume', restart: '↺ Start Over', noRes: 'No results found', sugg: 'Popular tests', tTest: 'Test', tCourse: 'Course', tSec: 'Section', tQ: 'Question', empty: 'No entries yet. Be the first to take the Saturday Test!', chap: 'Chapter', saved: 'Saved: {i}/{n}' }
};
const t = (k, v) => { let s = (L[lang] && L[lang][k]) ?? L.en[k] ?? k; if (v) for (const x in v) s = s.replace('{' + x + '}', v[x]); return s; };

/* ===== Hindi / English: ek hi switch (app + Google Translate widget sync) ===== */
let _gtCur = null, _gtTry = 0;
function gtSync() {
  const sel = document.querySelector('.goog-te-combo');
  if (!sel) { if (_gtTry++ < 30) setTimeout(gtSync, 400); return; }
  if (_gtCur === null && lang === 'en' && !/googtrans=\/en\/hi/.test(document.cookie)) { _gtCur = 'en'; return; }
  if (_gtCur === lang) return;
  _gtCur = lang;
  sel.value = lang === 'hi' ? 'hi' : ([...sel.options].some(o => o.value === 'en') ? 'en' : '');
  sel.dispatchEvent(new Event('change'));
}
function changeLanguage(code) {
  lang = code === 'hi' ? 'hi' : 'en'; store.set('acec_lang', lang); applyLang();
  toast(lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English');
}

/* ===== Data ===== */
const COURSES = [
  ['🖥️', 'CCC', 'Course on Computer Concepts, government exams ke liye'],
  ['🎓', "O'LEVEL", 'NIELIT IT foundation course'],
  ['💼', 'ADCA', 'Advanced Diploma in Computer Applications'],
  ['📚', 'PGDCA', 'Post Graduate Diploma in Computer Applications'],
  ['🧾', 'Tally', 'Accounting aur GST ki practical training'],
  ['📊', 'MS Office / Excel', 'Word, Excel, PowerPoint aur advanced Excel'],
  ['🌐', 'HTML / CSS / JS', 'Website banana seekhein'],
  ['🐍', 'Python', 'Programming basics se projects tak'],
  ['📡', 'IoT', 'Internet of Things ki basics'],
  ['⌨️', 'English Typing', 'Speed aur accuracy ki practice']
];
const CCC = [
  ['c1', 'Introduction to Computer', 50], ['c2', 'Introduction to Operating System', 50],
  ['c3', 'LibreOffice Writer', 100], ['c4', 'LibreOffice Calc', 70], ['c5', 'LibreOffice Impress', 80],
  ['c6', 'Introduction to Internet and WWW', 100], ['c7', 'E-Governance & Digital Financial Services', 100],
  ['c8', 'Overview of Future Skills & Cyber Security', 100], ['c9', 'Indian Language Digital Services & Emerging Tech', 100]
];
const OL = [
  ['o1', 'IT Tools & Network Basics', 520], ['o2', 'Web Designing & Publishing', 558],
  ['o3', 'Python Programming Advance', 100], ['o4', 'Internet of Things - IoT', 100], ['o5', 'Advanced IT Systems & Security', 100]
];
/* O Level Test (naya tab): HTML / CSS / JavaScript. Ye CCC aur purane O-Level chapters se alag hain. */
const OLX = [
  ['ox_html', 'HTML & HTML5', 100], ['ox_css', 'CSS & W3.CSS', 100], ['ox_js', 'JavaScript & AngularJS', 100]
];
const DAILY = [
  ['LibreOffice Writer me Save As ki shortcut key kya hai?', 'Ctrl + Shift + S'],
  ['HTML me sabse badi heading tag kaunsi hoti hai?', '<h1>']
];

/* Question bank: [question, [4 options], correctIndex]
   Apne purane questions yahan isi format me paste karein, chapter id (c1, c2, o1...) ke andar. */
const QB = {
  c1: [
    ['पहले से शुरू कंप्यूटर को दोबारा से शुरू करना कहलाता है?', ['वार्म बूटिंग', 'कोल्ड बूटिंग', 'लॉगइन ऑफ', 'शट डाउन'], 0],
    ['माउस में बटन की संख्या कितनी होती है?', ['2', '3', '4', 'a, b both'], 3],
    ['PNG का पूरा नाम क्या है?', ['Portable Network Group', 'Portable Net Graphics', 'Portable Network Graphics', 'Non of these'], 2],
    ['..........किलोबाइट से 1 मेगाबाइट बनता है?', ['256', '1024', '128', '512'], 1],
    ['Computer Monitor पर Blink होने वाला चिन्ह कहलाता है?', ['Pointer', 'Mouse', 'Track ball', 'Cursor'], 3],
    ['वर्चुअल मेमोरी का आकार ... पर निर्भर करता है?', ['डेटाबेस पर', 'ऐड्रेस लाइन पर', 'डिस्क स्पेस पर', 'उपरोक्त सभी'], 2],
    ['Computer CPU में Memory, Control और............. तीन यूनिट होते है?', ['अर्थमैटिक/लॉजिक', 'Input-Output', 'माइक्रोप्रोसेसर', 'None'], 0],
    ['ENIAC का पूरा नाम क्या है?', ['Electronic Numerical Integrator and Coder', 'Electronic Numerical Integrator and Computer', 'Electronic Numerical Interpreter and Computer', 'Electronic Numerical Isolator and Computer'], 1],
    ['फर्मवेयर का अर्थ है?', ['हार्डवेयर का सॉफ्टवेयर', 'एप्लीकेशन सॉफ्टवेयर', 'सिस्टम सॉफ्टवेयर', 'उपरोक्त सभी'], 0],
    ['कंप्यूटर की पांचवी पीढ़ी में किसका प्रयोग हुआ?', ['IC', 'Transistor', 'ULSI', 'None of these'], 2],
    ['माउस के माध्यम से किसी Object की properties देखने के लिए क्या करेंगे?', ['Shift Clicking', 'Right Clicking', 'Dropping', 'Dragging'], 1],
    ['USB Device किस सरंचना का अनुसरण करता है?', ['Halfman', 'Hash', 'List', 'Tree'], 3],
    ['स्पैम किससे संबंधित है?', ['Art', 'Song', 'Computer', 'Game'], 2],
    ['निम्न में से आउटपुट डिवाइस नहीं है?', ['डिजिटल कैमरा', 'CRT मॉनिटर', 'ईयर फोंस', 'प्लॉटर'], 0],
    ['निम्नलिखित में कौनसा पॉइंटिंग डिवाइस नहीं है?', ['Optical Pen', 'Mouse', 'Joy Stick', 'Scanner'], 3],
    ['Inkjet Printer में पाई जाने वाली रंगीन स्याही की बोतल में मूल रंगो की संख्या........... होती है?', ['3', '2', '10', '30'], 0],
    ['Data Processing से आशय है?', ['डाटा को व्यवस्थित करना', 'डाटा को उपयोगी बनाना', 'डेटा का संग्रह करना', 'उपरोक्त सभी'], 3],
    ['IBM का पूर्ण रूप है?', ['इंडियन बिजनेस मशीन', 'इंटरनेशनल बिजनेस मशीन', 'इटालियन बिजनेस मशीन', 'इंटीग्रल बिजनेस मशीन'], 1],
    ['Microprocessor के निर्माता कौन है?', ['Apple', 'Intel', 'IBM', 'HCL'], 1],
    ['MP3....... है?', ['माउस', 'प्रिंटर', 'साउंड फॉर्मेट', 'मोबाइल फोन'], 2],
    ['Computer का वह भाग जिसे हम छू नहीं सकते?', ['Hardware', 'Software', 'Monitor', 'CPU'], 1],
    ['इनपुट को आउटपुट में रूपांतरण कौन करता है?', ['सी.पी.यू.', 'मेमोरी', 'स्टोरेज', 'पेरीफेरल्स'], 0],
    ['Firewall है?', ['कंप्यूटर को नुक्सान पहुंचाता है', 'ऑपरेटिंग सिस्टम हैं', 'कंप्यूटर की सुरक्षा करता है', 'All of the above'], 2],
    ['पुनः प्रयोग की जा सकने वाली ऑप्टिकल स्टोरेज का संक्षिप्त नाम होगा।', ['CD', 'DVD', 'ROM', 'RW'], 3],
    ['निम्नलिखित में सबसे बड़ा कौन है?', ['PB', 'TB', 'ZB', 'EB'], 2],
    ['एक USB PenDrive किस प्रकार की स्टोरेज डिवाइस में अंतर्गत आती है?', ['Secondary', 'Primary', 'Both', 'None'], 0],
    ['Bit का समूह कहलाता है?', ['Nibble', 'Record', 'Word', 'Byte'], 3],
    ['निम्न से से कौनसी कुंजी, कर्सर के बाई तरफ के अक्षर को मिटाती है?', ['Space bar', 'Backspace', 'Delete', 'Non of these'], 1],
    ['CPU और I/O के बीच सिग्नलों के Movement को कौन नियंत्रित करता है?', ['CU', 'ALU', 'Memory unit', 'None'], 0],
    ['मॉनिटर है?', ['Storage device', 'Processing device', 'Output device', 'Input device'], 2],
    ['Recycle Bin स्वतः कॉन्फ़िगर हो जाता है ताकि यह आपके Computer की Hard Disk का डाटा को स्टोर करने के योग्य हो जाए?', ['10%', '1%', '5%', '15%'], 2],
    ['निम्नलिखित में कौन सा सिंबल हेक्साडेसिमल नंबर सिस्टम के द्वारा प्रयोग किया जाता है?', ['0-7', '0-9, A-F', '0-9', 'None'], 1],
    ['WORM का पूरा नाम क्या होगा?', ['Write On Random Memory', 'Write Once Read Many', 'Work On Real Memory', 'None'], 1],
    ['Bluetooth की खोज किसके द्वारा की गई?', ['Martin Cooper', 'Steve Jobs', 'Apple', 'Ericson (Jaap Haartsen)'], 3],
    ['Telephone नंबर जन्म-तिथि और ग्राहक का नाम किसका उदाहरण है?', ['एक फाइल', 'डाटा', 'एक डेटाबेस', 'एक रिकॉर्ड'], 3],
    ['कंप्यूटर की तीसरी पीढ़ी में किसका प्रयोग हुआ?', ['Integrated circuits', 'Transistor', 'Vacuum Tube', 'microprocessors'], 0],
    ['Printer की गुणवत्ता इस पर निर्भर करती है कि Image को Print करने में कितने प्रयुक्त होते हैं?', ['Pixel', 'DPI', 'Paper', 'PPM'], 1],
    ['निम्नलिखित में से परमानेंट मेमोरी है?', ['ROM', 'RAM', 'CD-ROM', 'CPU'], 0],
    ['नीचे दिए गए में हार्डवेयर का उदाहरण नहीं है?', ['Mouse', 'Monitor', 'Printer', 'Operating system'], 3],
    ['निम्नलिखित में कौन कौनसे कंप्यूटर CPU के मुख्य घटक कहलाते है?', ['CU', 'ALU', 'Memory', 'All of Above'], 3],
    ['UNIVAC का पूर्ण रूप क्या है?', ['Universal Automatics Company', 'Universal Automaticserial Computer', 'Universal Automatic Computer', 'None'], 2],
    ['Hierarchy क्या है?', ['स्टोरेज डिवाइस', 'एक नेटवर्क', 'कंप्यूटर के मेमोरी को क्रम में दर्शाता है', 'इनमें से कोई नहीं'], 2],
    ['सीपीयू ....... के नाम से भी जाना जाता है।', ['Execute', 'Microprocessor', 'Microchip', 'Mini Computer'], 1],
    ['MICR में R का क्या मतलब होता है?', ['Recognition', 'Recognize', 'Reader', 'Reading'], 0],
    ['सामान्य कुंजीपटल में कितने बटन पाए जाते है?', ['111', '123', '101', '134'], 2],
    ['Hybrid Computer में....... का प्रयोग किया जाता है?', ['एनालॉग संकेतों का', 'डिजिटल संकेतों का', 'उपरोक्त दोनों का', 'कोई नहीं'], 2],
    ['Computer का कार्य नहीं है?', ['Input', 'Understanding', 'Output', 'Controlling'], 1],
    ['DECIMAL Number System का आधार है?', ['10', '8', '3', 'None'], 0],
    ['निम्नलिखित स्टोरेज डिवाइस को एक स्थान से दूसरे स्थान पर आसानी से नहीं लेकर जा सकते है?', ['Pendrive', 'CD', 'DVD', 'Harddisk'], 3],
    ['निम्नलिखित में कौनसा इंटरनेट से संबंधित नहीं है?', ['Links', 'Browser', 'Search Engine', 'Printer'], 3],
    ["A floppy disk contains / फ्लॉपी डिस्क शामिल करता है:", ["Circular tracks only / केवल सरकुलर ट्रैक्स", "Sectors only / केवल सेक्टर", "Both circular tracks and sectors / सरकुलर ट्रैक्स और सेक्टर दोनों", "None of the above / उपरोक्त में से कोई नहीं"], 2],
    ["Which of the following are latest IT Gadgets? / निम्नलिखित में से कौन से नवीनतम आईटी गैजेट्स हैं?", ["Pen with Camera / पेन विथ कैमरा", "Drone Camera / ड्रोन कैमरा", "Both a & b / तथा दोनों", "None of the above / उपर्युक्त में से कोई नहीं"], 2],
    ["Hard disk is coated in both side above: / हार्डडिस्क दोनों तरफ ऊपर कोटेड होता है:", ["Magnetic Metallic Oxide / मैग्नेटिक मेटालिक ऑक्साइड", "Optical Metallic Oxide / ऑप्टिकल मेटालिक ऑक्साइड", "Carbon Layer / कार्बन लेयर", "All of the above / उपरोक्त सभी"], 0],
    ["Which type of storage device is a BIOS? / इनमें से बायोस किस प्रकार की स्टोरेज डिवाइस है?", ["Primary / प्राइमरी", "Secondary / सेकंडण्डरी", "Tertiary / टेरीटरी", "Not a storage device / स्टोरेज डिवाइस नहीं है"], 0],
    ["Which of the following devices can be used to input printed text? / निम्नलिखित में से कौन सी डिवाइस प्रिंटेड टेक्स्ट को इनपुट की तरह इस्तेमाल करता है?", ["OCR / ओ.सी.आर", "OMR / ओ.एम.आर", "MICR / एम.आई.सी.आर", "All of the above / उपरोक्त सभी"], 3],
    ["The most common pointing input device is: / सबसे कॉमन पाइंट करने वाली इनपुट डिवाइस है:", ["Track ball / ट्रैक बाल", "Touch Pad / टच पैड", "Touch Screen / टच स्क्रीन", "Mouse / माउस"], 3],
    ["..... is the result produced by a computer. / कंप्यूटर द्वारा ..... परिणाम उत्पन्न होता है।", ["Data / डाटा", "Memory / मेमोरी", "Output / आउटपुट", "Input / इनपुट"], 2],
    ["Which of the following memories allows simultaneous read and write operations? / निम्नलिखित में कौन सी मेमोरी रीड एवं राइट ऑपरेशन को साथ-साथ करने की अनुमति देता है?", ["ROM / रोम", "RAM / रैम", "EPROM / ई.पी. रोम", "None / कोई नहीं"], 1],
    ["Which of the following is the first supercomputer? / इनमें से कौन पहला सुपर कम्प्यूटर है?", ["PARAM1000 / परम 1000", "CRAY-1 / क्रे-1", "PARAM8000 / परम 8000", "CORE i7 / कोर आई 7"], 1],
    ["Which component of computer is also considered as its Heart? / इनमें से कंप्यूटर का कौन-सा कंपोनेंट हृदय माना जाता है?", ["Monitor / मॉनीटर", "Keyboard / कीबोर्ड", "Scanner / स्कैनर", "Microprocessor / माइक्रोप्रोसेसर"], 3],
    ["The most common input device used today is the: / आजकल ज्यादातर प्रयोग में आने वाला इनपुट डिवाइस है:", ["Motherboard / मदरबोर्ड", "CPU / सीपीयू", "Key Board / की बोर्ड", "System Unit / सिस्टम यूनिट"], 2],
    ["When a computer prints a report, this output is called: / जब कोई कंप्यूटर कोई रिपोर्ट प्रिंट करता है तो वह आउटपुट कहलाता है:", ["Hard Copy / हार्ड कॉपी", "Soft Copy / साफ्ट कॉपी", "Com / कॉम", "None / कोई नहीं"], 0],
    ["USB is which type of storage device? / यूएसबी इनमें से किस प्रकार की स्टोरेज डिवाइस है?", ["Primary / प्राइमरी", "Secondary / सेकंडण्डरी", "Tertiary / टेरीटरी", "None / कोई नहीं"], 2],
    [".... is the high speed memory used in the computer. / कंप्यूटर में.... हाई स्पीड मेमोरी के रूप में प्रयोग होती है।", ["RAM / रैम", "BIOS / बायोस", "Hard disk / हार्ड डिस्क", "Cache / कैचे"], 3],
    ["The output devices make it possible to: / आउटपुट डिवाइसें संभव करती हैं:", ["Viewing and printing data / डेटा को देखना एवं प्रिंट करना", "Storing data / डेटा को स्टोर करना", "Input data / डेटा को इनपुट करना", "None of these / इनमें से कोई नहीं"], 0],
    ["In computer terminology, information means: / कंप्यूटर शब्दकोष के अन्तर्गत सूचना का अर्थ है:", ["Data only / केवल डेटा", "Data important and understandable / डाटा महत्वपूर्ण और समझने योग्य", "Alphanumeric data / अल्फान्यूमेरिक डेटा", "The program / प्रोग्राम"], 1],
    ["The set of processed data is called? / प्रोसेस डेटा के सेट को कहा जाता है?", ["Data / डेटा", "Data Processing / डेटा प्रोसेसिंग", "Database / डाटाबेस", "Information / इंफॉर्मेशन"], 3],
    ["Which of the following is an output device? / इनमें से कौन-सी आउटपुट डिवाइस है?", ["Plotter / प्लॉटर", "Scanner / स्कैनर", "Joystick / जॉयस्टिक", "Light Pen / लाइट पेन"], 0],
    ["Which of the following is used in calculation work? / गणना कार्य के लिए निम्नलिखित में से किसका उपयोग किया जाता है?", ["CU / सीयू", "Mouse / माउस", "ALU / एएलयू", "CPU / सीपीयू"], 2],
    ["Which of the following is the largest unit of storage? / निम्न में से कोई भंडारण की सबसे बड़ी यूनिट है:", ["MB / एमबी", "TB / टीबी", "GB / जीबी", "KB / केबी"], 1],
    ["DVD is based on: / डीवीडी .... पर आधारित है:", ["USB Pen technology / यूएसबी पेन तकनीक", "Magnetic Disk Technology / मैग्नेटिक डिस्क तकनीक", "Media to store Video data only / केवल वीडियो संग्रह करने वाला माध्यम", "Optical Disk Technology / ऑप्टिकल डिस्क तकनीक"], 3],
    ["Which one of these stores more data than a DVD? / इनमें से डीवीडी से ज्यादा डेटा स्टोर होता है...।", ["CD ROM / सीडी रोम", "Floppy / फ्लॉपी", "Blue Ray Disk / ब्लू रे डिस्क", "Red Ray Disk / रेड रे डिस्क"], 2],
    ["Which of the following memories has the shortest access times? / निम्नलिखित में किस मेमोरी को एक्सेस करने में सबसे कम समय लगता है?", ["Cache Memory / कैश मेमोरी", "Magnetic bubble Memory / मैग्नेटिक बबल मेमोरी", "Blue Ray Disk / ब्लू रे डिस्क", "RAM / रैम"], 0],
    ["... has a limitation that we can only write information to it but cannot modify it. / ...की परिसीमा यह है कि हम उसे केवल सूचना दे सकते हैं लेकिन उसे मिटा या रूपांतरण नहीं कर सकते।", ["Tape Drive / टेप ड्राइव", "Floppy Disk / फ्लॉपी डिस्क", "CD ROM / सीडी रोम", "Hard Disk / हार्ड डिस्क"], 2],
    ["What is the name of first super computer of India? / इण्डिया का पहला सुपर कंप्यूटर का नाम है?", ["Saga 220 / सागा 220", "PARAM 8000 / परम 8000", "ENIAC / इनियाक", "PARAM 6000 / परम 6000"], 1]
  ],
  c2: [
    ['Linux ऑपरेटिंग सिस्टम में कर्नेल (Kernel) का मुख्य कार्य क्या है?', ['Hardware & Software Management', 'Web Browsing', 'Antivirus Scanning', 'Text Editing'], 0],
    ['Windows OS में किसी फाईल को हमेशा के लिए डिलीट करने की शॉर्टकट की क्या है?', ['Delete', 'Ctrl + Delete', 'Shift + Delete', 'Alt + Delete'], 2],
    ['Linux में डायरेक्टory बनाने के लिए कौन-सी कमांड प्रयुक्त होती है?', ['md', 'mkdir', 'create dir', 'newdir'], 1],
    ['निम्नलिखित में से कौन-सा ओपन सोर्स (Open-Source) ऑपरेटिंग सिस्टम है?', ['Windows 11', 'macOS', 'Windows Server', 'Ubuntu Linux'], 3],
    ['GUI का पूर्ण रूप क्या होता है?', ['Graphical User Interface', 'General User Interface', 'Guided Utility Interaction', 'Grand User Internet'], 0],
    ['Linux फाइल सिस्टम में रूट (Root) डायरेक्टरी को किस चिन्ह से दर्शाया जाता है?', ['\\', '#', '-', '/'], 3],
    ['Windows 10/11 में टास्क मैनेजर (Task Manager) खोलने की शॉर्टकट की क्या है?', ['Ctrl + Alt + Del', 'Ctrl + Shift + Esc', 'Alt + Tab', 'Win + X'], 1],
    ['Linux कमांड लाइन में वर्तमान वर्किंग डायरेक्टरी जानने के लिए क्या टाइप करते हैं?', ['dir', 'ldir', 'pwd', 'showpath'], 2],
    ['निम्नलिखित में से कौन-सा सिंगल-यूज़र ऑपरेटिंग सिस्टम का उदाहरण है?', ['MS-DOS', 'UNIX', 'Windows NT', 'Linux'], 0],
    ['ऑपरेटिंग सिस्टम किस प्रकार का सॉफ्टवेयर है?', ['Application Software', 'System Software', 'Utility Software', 'Programming Tool'], 1],
    ['Linux में किसी फाइल की अनुमति (Permissions) बदलने के लिए कौन-सी कमांड है?', ['change', 'perm', 'chown', 'chmod'], 3],
    ['एक्सटेंशन \'.exe\' सामान्यतः किस प्रकार की फाइलों के लिए होता है?', ['Audio File', 'Text File', 'Executable / Application File', 'Compressed File'], 2],
    ['Windows में खुले हुए सभी विंडोज को मिनिमाइज करके डेस्कटॉप देखने की शॉर्टकट क्या है?', ['Win + M', 'Win + D', 'Alt + D', 'Ctrl + M'], 1],
    ['Linux ऑपरेटिंग सिस्टम का जनक (Creator) कौन है?', ['Bill Gates', 'Dennis Ritchie', 'Linus Torvalds', 'Steve Jobs'], 2],
    ['बूटिंग प्रक्रिया के दौरान कंप्यूटर में कौन-सा प्रोग्राम सबसे पहले लोड होता है?', ['Device Driver', 'MS Word', 'Antivirus', 'BIOS/UEFI'], 3],
    ['Linux में सभी प्रोसेस की सूची देखने के लिए कौन-सी कमांड प्रयोग होती है?', ['ps', 'list', 'task', 'showproc'], 0],
    ['Windows ऑपरेटिंग सिस्टम किस कंपनी द्वारा विकसित किया गया है?', ['Microsoft', 'Apple', 'IBM', 'Google'], 0],
    ['Linux में फाईल सूची (List files) देखने के लिए कौन-सी कमांड है?', ['dir', 'ls', 'show', 'flist'], 1],
    ['निम्नलिखित में से कौन-सा मोबाइल ऑपरेटिंग सिस्टम नहीं है?', ['Android', 'iOS', 'Fedora', 'HarmonyOS'], 2],
    ['विंडोज में डिलीट की गई फाइलें डिफ़ॉल्ट रूप से कहाँ जाती हैं?', ['Temporary Folder', 'System 32', 'Root Folder', 'Recycle Bin'], 3],
    ['Linux ऑपरेटिंग सिस्टम किस भाषा में लिखा गया है?', ['Python', 'C Language', 'C++', 'Java'], 1],
    ['वर्चुअल मेमोरी (Virtual Memory) का प्रबंधन कौन करता है?', ['Operating System', 'CPU Register', 'Hard Disk Firmware', 'BIOS'], 0],
    ['Linux में किसी फाईल को हटाने (Delete) के लिए कौन-सी कमांड है?', ['del', 'erase', 'rm', 'clear'], 2],
    ['DOS प्रॉम्प्ट पर किसी डायरेक्टory को हटाने के लिए कौन-सी कमांड है?', ['rd', 'rmdir', 'a and b both', 'deletedir'], 2],
    ['मल्टीटास्किंग (Multitasking) का अर्थ क्या होता है?', ['एक समय में एक प्रोग्राम चलना', 'इंटरनेट चलाना', 'कई उपयोगकर्ता काम करना', 'एक साथ कई प्रोग्राम चलाना'], 3],
    ['Windows में नया फोल्डर बनाने की शॉर्टकट की क्या है?', ['Ctrl + N', 'Shift + N', 'Alt + N', 'Ctrl + Shift + N'], 3],
    ['Linux में सुपरयूज़र (Root User) बनने के लिए कौन-सी कमांड प्रयुक्त होती है?', ['admin', 'su (Switch User)', 'root', 'login'], 1],
    ['Windows में हेल्प विंडो (Help) खोलने की शॉर्टकट की क्या है?', ['F1', 'F2', 'F5', 'F10'], 0],
    ['निम्नलिखित में से कौन-सा रियल-टाइम ऑपरेटिंग सिस्टम (RTOS) है?', ['VxWorks', 'MS-DOS', 'Windows 10', 'Ubuntu'], 0],
    ['Linux में किसी टेक्स्ट फाइल की सामग्री देखने के लिए कौन-सी कमांड है?', ['read', 'view', 'showtext', 'cat'], 3],
    ['Windows में Rename करने के लिए शॉर्टकट की क्या है?', ['F1', 'F3', 'F2', 'F4'], 2],
    ['Linux फाइल सिस्टम में सुपरब्लॉक (Superblock) क्या स्टोर करता है?', ['यूजर पासवर्ड', 'फाइल सिस्टम की जानकारी', 'नेटवर्क एड्रेस', 'हार्डवेयर ड्राइवर'], 1],
    ['किसी प्रोसेस की वर्तमान स्थिति (State) को कहाँ स्टोर किया जाता है?', ['PCB (Process Control Block)', 'Stack Memory', 'Cache', 'Register File'], 0],
    ['Windows OS में Run Dialog Box खोलने की शॉर्टकट की क्या है?', ['Win + R', 'Win + R', 'Ctrl + R', 'Alt + R'], 1],
    ['Linux में पासवर्ड बदलने के लिए कौन-सी कमांड प्रयुक्त होती है?', ['changepass', 'setpass', 'passwd', 'password'], 2],
    ['निम्नलिखित में से कौन-सा एक ऑपरेटिंग सिस्टम नहीं है?', ['Linux', 'Oracle', 'Windows', 'MySQL'], 3],
    ['Linux में किसी शब्द को खोजने के लिए कौन-सी कमांड है?', ['grep', 'find', 'search', 'look'], 0],
    ['डेडलाक (Deadlock) की स्थिति ऑपरेटिंग सिस्टम में किससे संबंधित है?', ['Memory Leak', 'Virus Attack', 'Resource Allocation', 'Screen Freeze'], 2],
    ['Windows में एक्टिव विंडो बंद करने की शॉर्टकट की क्या है?', ['Win + F4', 'Ctrl + F4', 'Shift + F4', 'Alt + F4'], 3],
    ['Linux में सिस्टम को शटडाउन या रीबूट करने के लिए कौन-सी कमांड है?', ['stop', 'shutdown/reboot', 'off', 'powerdown'], 1],
    ['स्पूलिंग (Spooling) तकनीक मुख्य रूप से किसके साथ उपयोग की जाती है?', ['Monitor', 'Keyboard', 'Mouse', 'Printer / Output Devices'], 3],
    ['Windows 10 में Cortana क्या है?', ['Web Browser', 'Virtual Assistant', 'Antivirus', 'File Manager'], 1],
    ['Linux में किसी कमांड का मैनुअल (Help Page) देखने के लिए क्या टाइप करते हैं?', ['info [command]', 'help [command]', 'man [command]', 'doc [command]'], 2],
    ['बैच ऑपरेटिंग सिस्टम (Batch OS) की मुख्य विशेषता क्या थी?', ['Similar jobs grouped together', 'Real-time response', 'GUI Interface', 'Multi-user login'], 0],
    ['Linux फाइल परमिशन में \'rwx\' का अर्थ क्या होता है?', ['Run, Walk, Exit', 'Read, Write, Execute', 'Read, Watch, Edit', 'Remove, Write, X-ray'], 1],
    ['Windows में किसी फाइल या फोल्डर की प्रॉपर्टीज देखने के लिए शॉर्टकट क्या है?', ['F4', 'Ctrl + Enter', 'Shift + Enter', 'Alt + Enter'], 3],
    ['थ्रेड (Thread) को क्या कहा जाता है?', ['Sub Routine', 'Heavy Process', 'Lightweight Process', 'System Call'], 2],
    ['निम्नलिखित में से कौन-सा एक प्रोप्राइटरी (Proprietary) ऑपरेटिंग सिस्टम है?', ['Microsoft Windows', 'Ubuntu', 'Debian', 'Fedora'], 0],
    ['Linux में वर्तमान यूजर का नाम जानने के लिए कौन-सी कमांड है?', ['currentuser', 'myname', 'user', 'whoami'], 3],
    ['थ्रैशिंग (Thrashing) की समस्या किससे संबंधित है?', ['Excessive Paging / Virtual Memory', 'CPU Overheating', 'Hard Disk Failure', 'Network Congestion'], 0],
    ["Operating Systems for Mobile Phone and Tablets are / मोबाइल फोन और टैबलेट के लिए ऑपरेटिंग सिस्टम हैं-", ["Windows OS - विण्डोज ओएस", "Android OS - एंड्रायड ओएस", "iOS - आईओएस", "All of the Above - उपर्युक्त सभी"], 3],
    ["Linux kernel was invented by / लिनक्स कर्नल द्वारा अविष्कार किया गया था-", ["Linux Van Pelt - लिनक्स वेन पेल्ट", "Linux Torvalds - लिनक्स टोरवाल्डा", "Linux Pauling - लिनक्स पावलिंग", "None - कोई नहीं"], 1],
    ["GUI is used as an interface between. / जीयूआई किन दो के मध्य इन्टरफेस के लिए प्रयोग किया जाता है-", ["Hardware & Software - हार्डवेयर और सॉफ्टवेयर", "Man & Machine - व्यक्ति और मशीन", "Software & User - सॉफ्टवेयर और यूजर", "None of These - इनमें से कोई नहीं"], 2],
    ["Linux is a.......and.........operating system. / लिनक्स एक ..... एवं ........ ऑपरेटिंग सिस्टम है", ["Multiuser, Single tasking / मल्टीयूजर, सिंगल टास्किंग", "Multiuser, Multitasking / मल्टीयूजर, मल्टीटास्किंग", "Single user, Multitasking / सिंगल यूजर, मल्टीटास्किंग", "None of These - इनमें से कोई नहीं"], 1],
    ["The most popular computer operating system in use today is. / आज सबसे लोकप्रिय कम्प्यूटर ऑपरेटिंग सिस्टम उपयोग में है।", ["Linux", "Unix", "Windows", "Macintosh"], 2],
    ["Which of the following is internal command / निम्नलिखित में कौन सा आंतरिक कमांड है।", ["Ver", "Dir", "Edit", "Both a and b"], 3],
    ["Which of the following is not based on UNIX? / इनमें से कौन - सा यूनिक्स आधारित नहीं है?", ["MacOS", "Fedora", "MS DOS", "None"], 2],
    ["Computer system consists of...... / कम्प्यूटर सिस्टम शामिल करता है.........।", ["Hardware - हार्डवेयर", "Software - सॉफ्टवेयर", "Both a & b - a तथा b दोनों", "None - कोई नहीं"], 2],
    ["Operating System manages. / ऑपरेटिंग सिस्टम ....... का प्रबंधन करता है।", ["Memory - मेमोरी", "I/O Devices - इनपुट / आउटपुट डिवाइस", "Processor - प्रोसेसर", "All of the options - उपरोक्त सभी"], 3],
    ["Which of the following operating system does not implement multitasking truly? / निम्नलिखित में से कौन सा ऑपरेटिंग सिस्टम मल्टीटास्किंग वास्तव में लागू नहीं करता है?", ["Windows 98 - विण्डोज 98", "MS DOS - एमएस डॉस", "Windows XP - विण्डोज एक्सपी", "Windows NT - विण्डोज एनटी"], 1],
    ["Which extension is used for standard bitmapped format for storing graphics.... / ग्राफिक्स को स्टोर करने के लिए स्टैंडर्ड बिटमैप फ़ॉर्मेट के लिए .... एक्सटेंशन का उपयोग किया जाता है।", [".bmp", ".wav", ".xls", ".jpeg"], 0],
    ["Which of the following is an example of system software? / निम्नलिखित में सिस्टम सॉफ्टवेयर का उदाहरण है।", ["Operating system - ऑपरेटिंग सिस्टम", "Loader - लोडर", "Linker - लिंकूर", "All of the above - उपरोक्त सभी"], 3],
    ["The operating system for a computer does the following.. / किसी कम्प्यूटर का ऑपरेटिंग सिस्टम निम्न कार्य करता है।", ["Manages disk and file / डिस्क एवं फाइल मैनेज करता है", "Manages computer resources / कम्प्यूटर रिसोर्सेज को मैनेज करता है", "Manages computer memory / कम्प्यूटर की मेमोरी को मैनेज करता है", "All of the above / उपरोक्त सभी"], 3],
    ["Does Ubuntu need Antivirus? / क्या उबंटू को एंटीवायरस की जरूरत है?", ["Yes - हां", "No - नहीं", "Partial - आंशिक", "None - कोई नहीं"], 1],
    ["Operating system is used in .......... / ऑपरेटिंग सिस्टम का प्रयोग........... में होता है।", ["ATM card - एटीएम कार्ड", "Smart card - स्मार्ट कार्ड", "Computer system - कम्प्यूटर सिस्टम", "Microwave Oven - माइक्रोवेव ओवेन"], 2],
    ["In Linux a user can load or upload / लिनक्स में एक यूजर लोड या अपलोड कर सकता है।", ["I/O Modules - आई/ओ मॉड्यूल्स", "I/O Devices - आई/ओ डिवाइस", "Kernel Modules - कर्नल मॉड्यूल्स", "File Base I/O - फाइल बेस आई/ओ"], 2],
    ["A telephone number, a birth date, and a customer name are all examples of _ / टेलीफोन संख्या, जन्मतिथि और ग्राहक का नाम.......का उदाहरण है", ["A File", "A Database", "Data", "A Record"], 3],
    ["Screen that comes on when you turn on your computer that shows all the icons is called _ / कम्प्यूटर के आरंभ होने पर सभी आइकॉन को दिखाने वाली स्क्रीन को....... कहते हैं।", ["Carl", "Smurfs", "Spreadsheet", "Desktop"], 3],
    ["Which command is used to copy files? / कौन सा কमाण्ड फाइल कॉपी करने के लिए होता है", ["Copy Command - कॉपी कमांड", "Diskcopy - डिस्ककॉपी", "Ctrl+C", "All of Above - उपरोक्त सभी"], 3],
    ["To select non-adjacent files, press and hold the _ key while selecting individual files. / नॉन एडजसेन्ट फाइल को सेलेक्ट करने के लिए प्रेस... key...", ["Shift - शिफ्ट", "Tab - टैब", "Ctrl - कंट्रोल", "Windows - विण्डोज"], 2],
    ["The collection of related files is called _ / संबंधित फाइलों के संग्रह को ...... कहते हैं।", ["Data", "Database", "Register", "Datum"], 1],
    ["What is the Default File Extension after .(Dot) in Web files- / वेब फाइल में डॉट के बाद डिफॉल्ट फाइल एक्सटेंशन क्या होता है?", [".gtml", ".html or .htm", ".com", ".xtml"], 1],
    ["Which among following is responsible for finding and loading operating system into RAM? / निम्न में से कौन ऑपरेटिंग सिस्टम को रैम में सर्च एवं लोड करने के लिए रिस्पांसिबल है?", ["Bootstrap Loader", "CMOS", "DMOS", "BIOS"], 0],
    ["Aqua user interface was appeared with? / एक्वा यूजर इंटरफेस के साथ दिखाई देता है-", ["Windows", "Shells", "MAC OS", "Bourne Shell"], 2],
    ["OS does not boot itself when a system is _ / सिस्टम के...... होने पर ओ एस स्वतः बुट नहीं होता है।", ["Shutdown", "Reset", "Powered on", "Restarted"], 0]
  ],
  c3: [
    ['LibreOffice Writer में बाय डिफ़ॉल्ट फ़ॉन्ट साइज़ (Font Size) कितना होता है?', ['10', '11', '12', '14'], 1],
    ['LibreOffice Writer किस प्रकार का सॉफ्टवेयर है?', ['वर्ड प्रोसेसिंग सॉफ्टवेयर', 'ऑपरेटिंग सिस्टम', 'स्प्रेडशीट सॉफ्टवेयर', 'प्रेजेंटेशन सॉफ्टवेयर'], 0],
    ['LibreOffice Writer डॉक्यूमेंट का डिफ़ॉल्ट एक्सटेंशन (Extension) क्या होता है?', ['.doc', '.docx', '.txt', '.odt'], 3],
    ['LibreOffice Writer में प्रिंट प्रीव्यू (Print Preview) की शॉर्टकट की क्या है?', ['Ctrl+F2', 'Ctrl+F12', 'Ctrl+Shift+O', 'Ctrl+P'], 2],
    ['LibreOffice Writer में न्यूनतम (Minimum) ज़ूम साइज़ कितना होता है?', ['10%', '20%', '50%', '100%'], 1],
    ['LibreOffice Writer में अधिकतम (Maximum) ज़ूम साइज़ कितना होता है?', ['200%', '400%', '500%', '600%'], 3],
    ['LibreOffice Writer में सेव एज़ (Save As) की शॉर्टकट की क्या है?', ['Ctrl+Shift+S', 'Ctrl+S', 'F12', 'Ctrl+Alt+S'], 0],
    ['LibreOffice Writer में नया डॉक्यूमेंट (New Document) खोलने की शॉर्टकट की क्या है?', ['Ctrl+Shift+N', 'Ctrl + O', 'Ctrl+N', 'Ctrl+W'], 2],
    ['LibreOffice Writer में स्पेलिंग चेक (Spelling Check) की शॉर्टकट की क्या है?', ['F7', 'F5', 'Shift+F7', 'Ctrl+F7'], 0],
    ['LibreOffice Writer में \'Find and Replace\' का विकल्प किस मेनू में होता है?', ['File', 'Edit', 'Insert', 'Format'], 1],
    ['LibreOffice Writer में \'Find and Replace\' की शॉर्टकट की क्या है?', ['Ctrl+F', 'Ctrl+Shift+F', 'Ctrl+R', 'Ctrl+H'], 3],
    ['LibreOffice Writer में \'Word Count\' का विकल्प किस मेनू में मिलता है?', ['Edit', 'View', 'Tools', 'Format'], 2],
    ['LibreOffice Writer में टेबल इन्सर्ट (Insert Table) करने की शॉर्टकट की क्या है?', ['Ctrl+T', 'Ctrl+F12', 'Alt+T', 'Ctrl+F10'], 1],
    ['LibreOffice Writer में सुपरस्क्रिप्ट (Superscript) की शॉर्टकट की क्या है?', ['Ctrl+Shift+P', 'Ctrl+Shift+B', 'Ctrl+P', 'Ctrl+B'], 0],
    ['LibreOffice Writer में सबस्क्रिप्ट (Subscript) की शॉर्टकट की क्या है?', ['Ctrl+Shift+P', 'Ctrl+B', 'Ctrl+Shift+V', 'Ctrl+Shift+B'], 3],
    ['LibreOffice Writer में बुलेटेड लिस्ट (Bulleted List) हटाने या लगाने की शॉर्टकट की क्या है?', ['F12', 'Ctrl+F12', 'Shift+F12', 'Alt + F12'], 2],
    ['LibreOffice Writer में नंबर लिस्ट (Numbered List) की शॉर्टकट की क्या है?', ['Shift + F12', 'F12', 'Ctrl+F12', 'Alt+1'], 1],
    ['LibreOffice Writer में फॉर्मेटिंग हटाने (Clear Direct Formatting) की शॉर्टकट की क्या है?', ['Alt+M', 'Ctrl+Shift+M', 'Ctrl + Delete', 'Ctrl+M'], 3],
    ['LibreOffice Writer में नया पेज ब्रेक (Page Break) डालने की शॉर्टकट की क्या है?', ['Ctrl + Enter', 'Shift + Enter', 'Alt + Enter', 'Ctrl+Shift+Enter'], 0],
    ['LibreOffice Writer में लाइन ब्रेक (Line Break) डालने की शॉर्टकट की क्या है?', ['Ctrl + Enter', 'Alt + Enter', 'Shift + Enter', 'Enter'], 2],
    ['LibreOffice Writer में किसी टेक्स्ट को सेंटर एलाइन (Center Align) करने की शॉर्टकट की क्या है?', ['Ctrl+L', 'Ctrl+E', 'Ctrl+R', 'Ctrl+J'], 1],
    ['LibreOffice Writer में जस्टिफाई एलाइनमेंट (Justify Alignment) की शॉर्टकट की क्या है?', ['Ctrl+L', 'Ctrl+E', 'Ctrl+R', 'Ctrl+J'], 3],
    ['LibreOffice Writer में राइट एलाइनमेंट (Right Alignment) की शॉर्टकट की क्या है?', ['Ctrl+E', 'Ctrl+L', 'Ctrl+R', 'Ctrl+J'], 2],
    ['LibreOffice Writer में लेफ्ट एलाइनमेंट (Left Alignment) की शॉर्टकट की क्या है?', ['Ctrl+L', 'Ctrl+R', 'Ctrl+E', 'Ctrl+J'], 0],
    ['LibreOffice Writer में डिफ़ॉल्ट फॉन्ट स्टाइल (Font Style) क्या होता है?', ['Liberation Sans', 'Liberation Serif', 'Times New Roman', 'Arial'], 1],
    ['LibreOffice Writer में न्यूनतम फॉन्ट साइज कितना होता है (ड्रॉपडाउन सूची में)?', ['2', '4', '6', '8'], 2],
    ['LibreOffice Writer में अधिकतम फॉन्ट साइज कितना होता है (ड्रॉपडाउन सूची में)?', ['72', '80', '96', '100'], 2],
    ['LibreOffice Writer में किसी शब्द के नीचे लाल लाइन (Red Line) क्या दर्शाती है?', ['स्पेलिंग की गलती', 'ग्रामर की गलती', 'फॉर्मेटिंग की गलती', 'लिंक की त्रुटि'], 0],
    ['LibreOffice Writer में किसी वाक्य के नीचे नीली या हरी लाइन क्या दर्शाती है?', ['स्पेलिंग की गलती', 'ग्रामर की गलती', 'शब्द की पुनरावृत्ति', 'कोई नहीं'], 1],
    ['LibreOffice Writer में हेल्प (Help) की शॉर्टकट की क्या है?', ['F4', 'F2', 'F3', 'F1'], 3],
    ['LibreOffice Writer में नेविगेटर (Navigator) खोलने की शॉर्टकट की क्या है?', ['F8', 'F6', 'F7', 'F5'], 3],
    ['LibreOffice Writer में स्टाइल विंडो (Styles Window) खोलने की शॉर्टकट की क्या है?', ['F11', 'F12', 'F10', 'F9'], 0],
    ['LibreOffice Writer में फुल स्क्रीन (Full Screen) करने की शॉर्टकट की क्या है?', ['Ctrl+F10', 'Ctrl+Shift+J', 'F11', 'Ctrl+J'], 1],
    ['LibreOffice Writer में नॉन-प्रिंटिंग कैरेक्टर्स (Non-printing characters) देखने की शॉर्टकट की क्या है?', ['Ctrl+F9', 'Ctrl+F12', 'Ctrl+F8', 'Ctrl+F10'], 3],
    ['LibreOffice Writer में कमेंट (Comment) जोड़ने की शॉर्टकट की क्या है?', ['Alt+C', 'Ctrl+Shift+C', 'Ctrl+Alt+C', 'Ctrl+C'], 2],
    ['LibreOffice Writer में हाइपरलिंक (Hyperlink) जोड़ने की शॉर्टकट की क्या है?', ['Ctrl+K', 'Ctrl+H', 'Ctrl+L', 'Ctrl+Shift+K'], 0],
    ['LibreOffice Writer में कितने मेनू (Menus) होते हैं?', ['8', '9', '10', '11'], 2],
    ['LibreOffice Writer में स्टैंडर्ड टूलबार पर ज़ूम का कौन सा विकल्प नहीं होता है?', ['Zoom Slider', 'Zoom Reset', 'Zoom In/Out', 'Zoom Dialog'], 1],
    ['LibreOffice Writer में टेम्पलेट (Template) की फाइल एक्सटेंशन क्या होती है?', ['.odt', '.odp', '.ods', '.ott'], 3],
    ['LibreOffice Writer में मेल मर्ज (Mail Merge) का विकल्प किस मेनू में होता है?', ['Tools', 'Edit', 'File', 'Format'], 0],
    ['LibreOffice Writer में किसी भी टेक्स्ट को बोल्ड (Bold) करने की शॉर्टकट की क्या है?', ['Ctrl+I', 'Ctrl + B', 'Ctrl+U', 'Ctrl+D'], 1],
    ['LibreOffice Writer में इटैलिक (Italic) करने की शॉर्टकट की क्या है?', ['Ctrl+B', 'Ctrl+U', 'Ctrl+I', 'Ctrl+Shift+I'], 2],
    ['LibreOffice Writer में अंडरलाइन (Underline) करने की शॉर्टकट की क्या है?', ['Ctrl+Shift+U', 'Ctrl+I', 'Ctrl+B', 'Ctrl+U'], 3],
    ['LibreOffice Writer में \'Cut\' करने की शॉर्टकट की क्या है?', ['Ctrl+X', 'Ctrl+C', 'Ctrl+V', 'Ctrl+z'], 0],
    ['LibreOffice Writer में \'Copy\' करने की शॉर्टकट की क्या है?', ['Ctrl+A', 'Ctrl+X', 'Ctrl+V', 'Ctrl+C'], 3],
    ['LibreOffice Writer में \'Paste\' करने की शॉर्टकट की क्या है?', ['Ctrl+P', 'Ctrl+V', 'Ctrl+C', 'Ctrl+Shift+V'], 1],
    ['LibreOffice Writer में \'Undo\' करने की शॉर्टकट की क्या है?', ['Ctrl+Z', 'Ctrl+Y', 'Ctrl+U', 'Ctrl+Shift+z'], 0],
    ['LibreOffice Writer में \'Redo\' करने की शॉर्टकट की क्या है?', ['Ctrl+R', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Y'], 2],
    ['LibreOffice Writer में डॉक्यूमेंट को प्रिंट (Print) करने की शॉर्टकट की क्या है?', ['Alt+P', 'Ctrl+Shift+P', 'Ctrl+P', 'Ctrl+Shift+O'], 2],
    ['LibreOffice Writer में सिलेक्ट ऑल (Select All) की शॉर्टकट की क्या है?', ['Ctrl+A', 'Ctrl+S', 'Ctrl+Shift+A', 'Alt+A'], 0],
    ['LibreOffice Writer में पैराग्राफ को डबल लाइन स्पेसिंग देने की शॉर्टकट की क्या है?', ['Ctrl+1', 'Ctrl+2', 'Ctrl+5', 'Ctrl+0'], 1],
    ['LibreOffice Writer में सिंगल लाइन स्पेसिंग (Single Line Spacing) की शॉर्टकट की क्या है?', ['Ctrl+0', 'Ctrl+2', 'Ctrl+5', 'Ctrl+1'], 3],
    ['LibreOffice Writer में 1.5 लाइन स्पेसिंग (1.5 Line Spacing) की शॉर्टकट की क्या है?', ['Ctrl+5', 'Ctrl+2', 'Ctrl+1', 'Ctrl+1.5'], 0],
    ['LibreOffice Writer में ड्रॉप कैप (Drop Cap) का विकल्प किस मेनू में होता है?', ['Insert', 'Tools', 'Format', 'View'], 2],
    ['LibreOffice Writer में अधिकतम कितने ड्रॉप कैप (Drop Cap) लाइन्स सेट की जा सकती हैं?', ['5', '9', '10', '15'], 2],
    ['LibreOffice Writer में हेडर और फुटर (Header & Footer) का विकल्प किस मेनू में होता है?', ['File', 'Edit', 'Format', 'Insert'], 3],
    ['LibreOffice Writer में बाय डिफ़ॉल्ट ड्रॉप कैप लाइन्स कितनी होती हैं?', ['1', '2', '3', '4'], 2],
    ['LibreOffice Writer में पेज नंबर (Page Number) जोड़ने का विकल्प कहाँ मिलता है?', ['File', 'Insert', 'Format', 'Tools'], 1],
    ['LibreOffice Writer में डिजिटल सिग्नेचर (Digital Signature) का विकल्प किस मेनू में होता है?', ['Tools', 'File', 'Edit', 'Insert'], 1],
    ['LibreOffice Writer में किसी इमेज को इन्सर्ट करने की शॉर्टकट की क्या है?', ['कोई शॉर्टकट नहीं (Insert -> Image)', 'Ctrl+I', 'Ctrl+Alt+I', 'Ctrl+Shift+I'], 0],
    ['LibreOffice Writer में साइडबार (Sidebar) को टॉगल (Toggle/On-Off) करने की शॉर्टकट की क्या है?', ['Ctrl+F8', 'Ctrl+F6', 'Ctrl+F7', 'Ctrl+F5'], 3],
    ['LibreOffice Writer में \'Formatting Marks\' को ऑन/ऑफ करने की शॉर्टकट की क्या है?', ['Ctrl+F2', 'Ctrl+F8', 'Ctrl+F12', 'Ctrl+F10'], 3],
    ['LibreOffice Writer में टेबल की रो (Row) की ऊँचाई बढ़ाने या हटाने के लिए किस कुंजी का प्रयोग किया जाता है?', ['Ctrl + Arrow Keys', 'Alt + Arrow Keys', 'Shift + Arrow Keys', 'कोई नहीं'], 1],
    ['LibreOffice Writer में टेबल में एक सेल से दूसरे सेल में आगे जाने के लिए किस कुंजी का प्रयोग होता है?', ['Tab', 'Enter', 'Shift+Tab', 'Spacebar'], 0],
    ['LibreOffice Writer में टेबल में एक सेल से पीछे जाने के लिए किस कुंजी का प्रयोग होता है?', ['Tab', 'Ctrl+Tab', 'Shift+Tab', 'Alt+Tab'], 2],
    ['LibreOffice Writer में प्रोटेक्ट डॉक्यूमेंट (Protect Document) का विकल्प कहाँ होता है?', ['File', 'Edit', 'Tools', 'Window'], 0],
    ['LibreOffice Writer में कोई टेक्स्ट सेलेक्ट करके F3 दबाने से क्या होता है?', ['केस बदलता है', 'स्पेलिंग चेक होती है', 'फाइंड एंड रिप्लेस खुलता है', 'ऑटो टेक्स्ट (Auto Text) इन्सर्ट होता है'], 3],
    ['LibreOffice Writer में केस बदलने (Change Case) की शॉर्टकट की क्या है?', ['F3', 'Shift+F3', 'Alt+F3', 'Ctrl+F3'], 1],
    ['LibreOffice Writer में ज़ूम स्लाइडर (Zoom Slider) विंडो में कहाँ स्थित होता है?', ['टॉप राइट कॉर्नर', 'टॉप लेफ्ट कॉर्नर', 'बॉटम लेफ्ट कॉर्नर', 'बॉटम राइट कॉर्नर'], 3],
    ['LibreOffice Writer में \'Save\' करने की शॉर्टकट की क्या है?', ['Ctrl+Shift+S', 'Ctrl+S', 'Alt+S', 'F12'], 1],
    ['LibreOffice Writer में फोंट साइज बढ़ाने (Increase Font Size) की शॉर्टकट की क्या है?', ['Ctrl+]', 'Ctrl+[', 'Ctrl+Shift+>', 'Ctrl+Shift+<'], 0],
    ['LibreOffice Writer में फोंट साइज घटाने (Decrease Font Size) की शॉर्टकट की क्या है?', ['Ctrl+]', 'Ctrl+Shift+>', 'Ctrl+[', 'Ctrl+Shift+<'], 2],
    ['LibreOffice Writer में कमेंट बॉक्स हटाने या डिलीट करने का विकल्प कहाँ होता है?', ['व्यू मेनू', 'एडिट मेनू', 'फाइल मेनू', 'कमेंट मेनू'], 3],
    ['LibreOffice Writer में कुल कितने डिफ़ॉल्ट हेडिंग स्टाइल्स होते हैं?', ['3', '5', '6', '10'], 2],
    ['LibreOffice Writer में किसी भी फाइल को पासवर्ड प्रोटेक्टेड रूप में किस फॉर्मेट में सेव किया जाता है?', ['.odt', 'पासवर्ड विकल्प केवल odt सेव करते समय मिलता है', '.pdf', '.txt'], 1],
    ['LibreOffice Writer में ऑटो करेक्शन (Auto Correction) का फीचर किस मेनू में होता है?', ['Tools', 'Edit', 'Format', 'View'], 0],
    ['LibreOffice Writer में बाय डिफ़ॉल्ट मार्जिन (Margins) कितना होता है?', ['0.5 इंच', '0.75 इंच', '1 इंच', '1.5 इंच'], 2],
    ['LibreOffice Writer में पेज ओरिएंटेशन (Page Orientation) बाय डिफ़ॉल्ट क्या होता है?', ['Legal', 'Landscape', 'Square', 'Portrait'], 3],
    ['LibreOffice Writer में कौन सा व्यू (View) उपलब्ध नहीं होता है?', ['Slide Sorter', 'Print Layout', 'Web Layout', 'Normal View'], 0],
    ['LibreOffice Writer में फुटनोट (Footnote) और एंडनोट (Endnote) का विकल्प किस मेनू में होता है?', ['Edit', 'Insert', 'Tools', 'Format'], 1],
    ['LibreOffice Writer में फुटनोट डॉक्यूमेंट में कहाँ दिखाई देता है?', ['हर पेज के फुटर में', 'डॉक्यूमेंट के अंत में', 'हर पेज के हेडर में', 'पेज के अंत में (Bottom of Page)'], 3],
    ['LibreOffice Writer में एंडनोट (Endnote) डॉक्यूमेंट में कहाँ दिखाई देता है?', ['पेज के अंत में', 'डॉक्यूमेंट या चैप्टर के अंत में', 'हेडर में', 'फुटर में'], 1],
    ['LibreOffice Writer में थिसॉरस (Thesaurus) की शॉर्टकट की क्या होती है?', ['Alt+F7', 'Shift + F7', 'Ctrl+F7', 'F7'], 2],
    ['LibreOffice Writer में थिसॉरस का प्रयोग किसके लिए किया जाता है?', ['पर्यायवाची और विलोम शब्द (Synonyms & Antonyms)', 'स्पेलिंग चेक', 'ग्रामर चेक', 'वर्ड काउंट'], 0],
    ['LibreOffice Writer में नया फोल्डर बनाने का विकल्प किस डायलॉग बॉक्स में मिलता है?', ['Save As डायलॉग बॉक्स', 'Print डायलॉग बॉक्स', 'Open डायलॉग बॉक्स', 'दोनों Save As और Open'], 3],
    ['LibreOffice Writer में किसी टेक्स्ट के बीच से लाइन खींचना क्या कहलाता है?', ['Strikethrough', 'Underline', 'Superscript', 'Subscript'], 0],
    ['LibreOffice Writer में शैडो (Shadow) इफ़ेक्ट की शॉर्टकट की क्या है?', ['Ctrl+Shift+S', 'कोई सीधी शॉर्टकट की नहीं है', 'Alt+S', 'Ctrl+D'], 1],
    ['LibreOffice Writer में बोल्ड, इटैलिक, अंडरलाइन के अलावा टेक्स्ट इफ़ेक्ट में कौन सा विकल्प होता है?', ['Strikethrough', 'Overline', 'Both Strikethrough & Overline', 'कोई नहीं'], 2],
    ['LibreOffice Writer में \'Go to Page\' की शॉर्टकट की क्या है?', ['Ctrl+Shift+G', 'Ctrl+G', 'F5', 'Ctrt+F5'], 1],
    ['LibreOffice Writer में मैक्रो (Macro) रिकॉर्ड करने का विकल्प किस मेनू में होता है?', ['File', 'Edit', 'Tools', 'View'], 2],
    ['LibreOffice Writer में मैक्रो (Macro) की शॉर्टकट की क्या होती है?', ['Shift+F11', 'Alt+F11', 'Ctrl+F11', 'कोई डिफ़ॉल्ट शॉर्टकट की नहीं होती'], 3],
    ['LibreOffice Writer में किसी डॉक्यूमेंट को सीधे पीडीएफ (PDF) में एक्सपोर्ट करने का आइकॉन कहाँ होता है?', ['स्टैंडर्ड टूलबार', 'फॉर्मेटिंग टूलबार', 'मेनू बार', 'स्टेटस बार'], 0],
    ['LibreOffice Writer में सीधे PDF एक्सपोर्ट करने की शॉर्टकट की क्या होती है?', ['Ctrl+Shift+E', 'Ctrl+P', 'कोई डिफ़ॉल्ट शॉर्टकट की नहीं होती', 'F12'], 2],
    ['LibreOffice Writer में साइडबार में कुल कितने पेन (Panes) होते हैं?', ['केवल 1', 'केवल 2', 'केवल 4', 'लगभग 6 या अधिक'], 3],
    ['LibreOffice Writer में रूलर (Ruler) को ऑन या ऑफ करने की शॉर्टकट की क्या है?', ['Ctrl+Shift+R', 'Ctrl+R', 'Ctrl+F1', 'Alt+R'], 0],
    ['LibreOffice Writer में मैनेज टेम्पलेट्स (Manage Templates) की शॉर्टकट की क्या है?', ['Ctrl+N', 'Ctrl+Shift+N', 'Alt+N', 'Ctrl+M'], 1],
    ['LibreOffice Writer में किसी ऑब्जेक्ट को डिलीट करने के लिए किस कुंजी का प्रयोग होता है?', ['Delete', 'Backspace', 'Both Delete and Backspace', 'Ctrl+D'], 2],
    ['LibreOffice Writer में पैराग्राफ इंडेंट बढ़ाने की शॉर्टकट की क्या है?', ['Ctrl+M', 'Tab', 'Ctrl+Shift+M', 'Shift+Tab'], 1],
    ['LibreOffice Writer में बुलेट लिस्ट से बाहर आने के लिए या दो बार Enter दबाने से क्या होता है?', ['बुलेट लिस्ट समाप्त हो जाती है', 'नया पेज बन जाता है', 'टेक्स्ट बोल्ड हो जाता है', 'कुछ नहीं होता'], 0],
    ['LibreOffice Writer के संबंध में इनमें से कौन सा कथन असत्य है?', ['आप पासवर्ड से सुरक्षित डॉक्यूमेंट सेव कर सकते हैं', 'इसमें मेल मर्ज का विकल्प होता है', 'यह एक फ्री और ओपन सोर्स सॉफ्टवेयर है', 'इसमें स्प्रेडशीट जैसी फॉर्मूला बार होती है'], 3],
    ["Key used to Centered the text in LibreOffice writer. / लिब्रेऑफिस राइटर में टेक्स्ट को सेन्टर करने के लिए 'की' का इस्तेमाल होता है।", ["Ctrl + E", "Ctrl + P", "Ctrl + Z", "Ctrl + O"], 0],
    ["Which function Key is used for Spell check.. / स्पेल चेक के लिए किस फंक्शन की इस्तेमाल होता है..", ["F7", "Ctrl + C", "Shift +C", "Ctrl + F7"], 0],
    ["........ Key is used to select at the beginning of the line in LibreOffice writer. / लिब्रेऑफिस राइटर में लाइन की शुरुआत से सेलेक्ट करने के लिए 'की' का इस्तेमाल होता है-", ["Home+shift", "Ctrl+Home", "Alt+Home", "Shift +C"], 0],
    ["Which of the following shortcut Key is used for Save As. / इनमें से किस शॉर्टकट का प्रयोग Save As करने के लिए किया जाता है।", ["F7", "Ctrl + C", "Shift +Ctrl+S", "Ctrl + F7"], 2],
    ["Key used for find and replace the text in LibreOffice writer. / लिब्रेऑफिस राइटर में टेक्स्ट को फाइंड एंड रिप्लेस करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + H", "Ctrl + P", "Ctrl + Z", "Ctrl + O"], 0],
    ["In LibreOffice writer which of the following shortcut is used to justify the document. / लिब्रेऑफिस राइटर में टेक्स्ट को जड़िसफाई करने के लिए 'की' का प्रयोग होता है-", ["Ctrl + J", "Ctrl + P", "Ctrl + Z", "Ctrl + O"], 0],
    ["Key is used to go to beginning of the line in LibreOffice writer / लिब्रेऑफिस राइटर में लाइन की शुरुआत में जाने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl+Home", "Home", "Alt+Home", "Shift +Home"], 1],
    ["Open source software is software whose source code is available for modification or enhancement by anyone. Which of the following is an example of open source software? / ओपन सोर्स सॉफ्टवेयर वह सॉफ्टवेयर है जिसका सोर्स कोड किसी के द्वारा संशोधन या वृद्धि के लिए उपलब्ध है। निम्नलिखित में से कौन सा ओपन सोर्स सॉफ्टवेयर का एक उदाहरण है?", ["Adobe Photoshop - एडॉबे फोटोशॉप", "MS Word - एमएस वर्ड", "LibreOffice - लिब्रेऑफिस", "Skype - स्काइप"], 2],
    ["... Key is used to Left align the text in LibreOffice writer. / 'की' का उपयोग लिब्रेऑफिस राइटर में टेक्स्ट को बाएँ एलाइन करने के लिए किया जाता है।", ["Ctrl + M", "Ctrl + P", "Ctrl + L", "Ctrl + O"], 2],
    ["... Key is used to Right align the text in LibreOffice writer. / 'की' का उपयोग लिब्रेऑफिस राइटर में टेक्स्ट को दाएँ एलाइन करने के लिए किया जाता है।", ["Ctrl + P", "Ctrl + R", "Ctrl + M", "Ctrl + ~"], 1],
    ["Alignment buttons are available on... of LibreOffice writer. / लिब्रेऑफिस राइटर के ... पर एलाइगमेंट बटन उपलब्ध होती है-", ["Formating Toolbar - फार्मेटिंग टूलबार", "Status bar - स्टेटस बार", "Standard Toolbar - स्टैण्डर्ड टूलबार"], 0],
    ["What is the hyperlink shortcut key in LibreOffice Writer? / लिब्रेऑफिस राइटर में हाइपरलिंक की शॉर्टकट की क्या है?", ["Ctrl + H", "Ctrl + I", "Ctrl + K", "Ctrl + shift + h"], 2],
    ["Shortcut key used for line break without changing the paragraph in LibreOffice writer. / लिब्रेऑफिस राइटर में बिना पैराग्राफ बदले लाईन ब्रेक करने के लिए शॉर्टकट की का इस्तेमाल होता है-", ["Ctrl + M", "Ctrl + P", "Shift +Enter", "Ctrl + O"], 2],
    ["Minimum font size in libreoffice writer? / लिब्रेऑफिस राइटर में न्यूनतम फोंट आकार होता है?", ["2", "3", "1", "0"], 0],
    ["What do you see at the bottom of MS Word and Writer window? / एम एस वर्ड और राइटर में सबसे नीचे जो दिखाई देता है उसे क्या बोलते हैं?", ["Title bar - टाईटल बार", "Status bar - स्टेटस बार", "Task bar - टास्क बार", "Menu bar - मेनू बार"], 1],
    ["What is the print preview shortcut key in LibreOffice Writer? / लिब्रेऑफिस राइटर में प्रिंट प्रीव्यू की शॉर्टकट की क्या है?", ["Ctrl+Shift+P", "Ctrl+F2", "Ctrl+Shift+O", "Ctrl+P"], 2],
    ["Key used for Subscript the text in LibreOffice writer. / लिब्रेऑफिस राइटर में टेक्स्ट को सबस्क्रिप्ट करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl +Shift+B", "Ctrl + P", "Ctrl + M", "Ctrl + O"], 0],
    ["Key used to open find box in LibreOffice writer. / लिब्रेऑफिस राइटर में फाइंड बॉक्स ओपन करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + F", "Ctrl + T", "Ctrl + F1", "Ctrl + O"], 0],
    ["Key used for exits appliations LibreOffice writer. / लिब्रेऑफिस राइटर में एप्लीकेशन को बन्द करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + O", "Ctrl + T", "Ctrl + F1", "Ctrl + Q"], 3],
    ["Key used to Save a document in LibreOffice writer, Calc and Impress. / लिब्रेऑफिस राइटर, कैल्क और इम्प्रेस में डॉक्यूमेंट को सेव करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + F1", "Ctrl + T", "Ctrl + S", "Ctrl + O"], 2],
    ["Which one of the following shortcut Key is used to insert a page break. / पेज ब्रेक के लिए निम्न में से कौन सा शॉर्टकट 'की' का उपयोग किया जाता है।", ["Ctrl + F1", "Ctrl + T", "Ctrl + S", "Ctrl+Enter"], 3],
    ["Maximum font size in libreoffice writer? / लिब्रेऑफिस राइटर में अधिकतम फोंट आकार होता है?", ["22", "99", "100", "96"], 1],
    ["Shortcut key used to Go to start of document in LibreOffice writer. / लिब्रेऑफिस राइटर में डॉक्यूमेंट के स्टार्ट में जाने के लिए शॉर्टकट की का इस्तेमाल होता है-", ["Ctrl + M", "Ctrl + P", "Ctrl+Home", "Ctrl + O"], 2],
    ["Which is the type of page orientation. / इनमें से पेज ओरिएंटेशन का प्रकार है।", ["Portrait - पोर्ट्रेट", "Landscape - लैण्डस्केप", "Both a & b - a तथा b दोनों", "Slide - स्लाइड"], 2],
    ["Short cut Key used to Open a document LibreOffice writer. / लिब्रेऑफिस राइटर में डॉक्यूमेंट को ओपन करने के लिए 'की' का इस्तेमाल होता है", ["Ctrl + O", "Ctrl + P", "Ctrl + F", "Ctrl + Q"], 0]
  ],
  c4: [
    ['In Calc, Rename Sheet option available in which menu?', ['File', 'Sheet', 'Data', 'Format'], 1],
    ['In LibreOffice the Formula which shows 16% of the value in A1 is', ['A1%16', 'A1%16', 'A1#16%', 'A1*16%'], 3],
    ['In Calc the default number of sheets is', ['2', '3', '1', '5'], 1],
    ['In LibreOffice Calc what is the default Title name?', ['Book1', 'Title1', 'Untitled 1', 'Sheet1'], 2],
    ['In Calc the default font size is', ['10', '11', '12', '15'], 1],
    ['In LibreOffice Calc which shortcut key is use to open the cell format dialog box?', ['Ctrl+1', 'Shift+1', 'Alt+1', 'Ctrl+Alt+1'], 0],
    ['In LibreOffice Calc, which shortcut key is use to insert the Time?', ['Ctrl+Shift+;', 'Ctrl+;', 'Ctrl + T', 'None of these'], 0],
    ['Which shortcut key is use to open a new Spreadsheet?', ['Ctrl+Shift+N', 'Shift+Alt+N', 'Shift+N', 'Ctrl+N'], 3],
    ['In Calc which shortcut key is use to save as a program?', ['Shift+Alt+S', 'Ctrl+S', 'Ctrl+Shift+S', 'None of these'], 2],
    ['In LibreOffice Calc, Merge Cells command available in which menu?', ['Edit', 'Style', 'Sheet', 'Format'], 3],
    ['Which shortcut key is use to delete a cell in LibreOffice Calc?', ['Ctrl++', 'Ctrl + D', 'Ctrl+-', 'Delete'], 2],
    ['In Calc, Freeze Rows and Columns option available in which menu?', ['View', 'File', 'Format', 'Data'], 0],
    ['In Calc, the last Column label is', ['ALZ', 'AMA', 'AMJ', 'ALX'], 2],
    ['The total number of Columns in Calc is', ['1024', '10241', '48523', 'None of these'], 0],
    ['In Calc, the name of the Cell made by the intersection of last column and last row is', ['AMJ65536', 'AMX1048576', 'AMJ1024', 'AMJ1048576'], 3],
    ['In Calc which shortcut key you press to change the number format as date ?', ['Ctrl+1', 'Ctrl+Shift+3', 'Ctrl+Shift+5', 'All of these'], 1],
    ['In Calc which shortcut key is used to insert a function?', ['F2', 'F3', 'Ctrl+F2', 'Ctrl+F3'], 2],
    ['What is the default height of a Row in Calc?', ['0.18', '0.23', '0.25', '0.21'], 2],
    ['What is the default width of a column in Calc?', ['0.79', '0.84', '0.89', 'None of these'], 1],
    ['In Calc the maximum zoom size is', ['200%', '400%', '500%', '600%'], 2],
    ['Which shortcut key is use to open the Format Cell?', ['Ctrl+1', 'Ctrl+3', 'Ctrl+4', 'Ctrl+2'], 0],
    ['Which is the last menu in Calc?', ['Help', 'Format', 'View', 'Sheet'], 0],
    ['Font Size, Font Face, Bold, Italic etc. options available in which Toolbar?', ['Standard', 'Formatting', 'Drawing', 'None of these'], 1],
    ['In Calc which shortcut key is use to select the whole worksheet?', ['Ctrl+A', 'Ctrl+Shift+Space', 'Ctrl+Space', 'Both A and B'], 3],
    ['You can change the user interface in Calc Program with....?', ['Single Toolbar', 'Tabbed', 'Tabbed Compact', 'All of these'], 3],
    ['The shortcut key to open a new Template in Calc program is', ['Ctrl+Alt+N', 'Ctrl+Shift+N', 'Ctrl+N', 'None of these'], 1],
    ['Protect Sheet option available in which menu?', ['Tools', 'View', 'File', 'Sheet'], 0],
    ['The shortcut key to hide the sidebar in Libre Office Calc is', ['Ctrl+F3', 'Ctrl+F7', 'Ctrl+F5', 'Shift+F5'], 2],
    ['In Libre Office Calc, the shortcut key to convert a number in a Cell into Date is?', ['Ctrl+Shift+F3', 'Ctrl+Shift+3', 'Ctrl+Alt+3', 'None of these'], 1],
    ['What you press to exit from LibreOffice Calc?', ['Ctrl+X', 'Ctrl+R', 'Ctrl+W', 'None of these'], 2],
    ['In LibreOffice Calc the maximum Cell in a worksheet is?', ['No Limit', '1,073,741,842', '1,073,824,741', '1,073,741,824'], 3],
    ['In LibreOffice Calc, you press which key with Ctrl to insert a new line or paragraph in a Cell?', ['Alt', 'Shift', 'Tab', 'Enter'], 0],
    ['What is the default file extension for a spreadsheet in LibreOffice Calc?', ['odp', '.odd', '.ods', '.odt'], 2],
    ['In LibreOffice Calc a formula start with a symbol', ['=', '$', '&', '%'], 0],
    ['What is the result of the formula =COUNT(B1:B3)? Where B1=5, B2=4, B3=6', ['15', '3', '4', '5'], 1],
    ['What is the result of the formula =MAX(B1:B3)+MIN(B1:B3)? Where B1=5, B2=2, B3=7', ['7,2', '7+2', '5,7', '9'], 3],
    ['In LibreOffice Calc if the value is large then the Cell, then what is the result?', ['#Name?', '%%%%', '&&&&', '####'], 3],
    ['In LibreOffice Calc the address of any Cell is shown in?', ['Formula Bar', 'Address Book', 'Name Box', 'None of these'], 2],
    ['What is the result of the Formula =Product(80,-5)?', ['-400', '400', 'Null', 'None of these'], 0],
    ['In LibreOffice Calc the Alignment of a Non numeric value is', ['Right', 'Left', 'Center', 'Justified'], 1],
    ['If the Cell address is changed when you copy a formula then the formula is known as', ['Absolute Address', 'Relative Address', 'Mixed Address', 'Dynamic Address'], 1],
    ['In LibreOffice Calc, the maximum number of Row and Column is', ['1048576 & 1024', '1048576 & 16384', '16384 & 1048576', '1024 & 1048576'], 0],
    ['In Calc which shortcut key is use for print preview?', ['Ctrl+F12', 'F12', 'Ctrl+Shift+O', 'Ctrl+O'], 2],
    ['In Calc, the toolbar which has the commands like save, open, print, cut, copy etc. is called?', ['Formatting Toolbar', 'Standard Toolbar', 'Drawing Toolbar', 'None of these'], 1],
    ['Which shortcut key is use to select the complete Row?', ['Ctrl+Space', 'Ctrl+Shift+End', 'Shift+Space', 'None of these'], 2],
    ['In LibreOffice which shortcut key is use for comment?', ['Ctrl+Shift+C', 'Ctrl+C', 'Ctrl+Shift+T', 'Ctrl+Alt+C'], 3],
    ['In LibreOffice Calc, the shortcut key to convert a number into currency format is?', ['Ctrl+Shift+1', 'Ctrl+Shift+5', 'Ctrl+Shift+3', 'Ctrl+Shift+4'], 3],
    ['How many maximum sheets you can insert in LibreOffice Calc?', ['1024', '1000', '10000', 'No Limit'], 0],
    ['In LibreOffice Calc you can write maximum characters in a Cell.', ['356547', '32654', '32767', 'None of these'], 2],
    ['In LibreOffice Calc which shortcut key is use to clear direct format?', ['Ctrl+V', 'Ctrl+1', 'Ctrl + Shift + F', 'Ctrl + M'], 3],
    ['Where is the name box in LibreOffice Calc?', ['Left side under the Menu bar', 'Left side over the Menu bar', 'On the Status bar', 'Right side under the Menu bar'], 0],
    ['Which shortcut key is use to move to the next sheet?', ['Tab', 'Ctrl+Tab', 'Ctrl + Shift + Tab', 'Shift + Tab'], 1],
    ['In LibreOffice Calc which shortcut key is use to highlight a value?', ['Ctrl+F6', 'Ctrl', 'Ctrl+F8', 'Ctrl+F1'], 2],
    ['In LibreOffice Calc the address of the last Cell is', ['$D$10', 'AMJ1048576', 'XFD1048576', '$AM$D1048576'], 1],
    ['In LibreOffice Calc, to split a merged cell click button after selecting the cell', ['Split', 'Center', 'Split and Merge', 'Merge and Center'], 0],
    ['In Spreadsheet which shortcut key is use to select the row of the selected cell.', ['Ctrl+Space Bar', 'Ctrl++', 'Shift++', 'Shift+Space Bar'], 3],
    ['In Calc the process to combine two cells in one, is called', ['Join Cells', 'Merge Table', 'Join Table', 'Merge Cells'], 3],
    ['In LibreOffice Calc which shortcut key is use to move to the left of a cell?', ['Alt+Tab', 'Shift+Tab', 'Alt', 'Tab'], 1],
    ['In LibreOffice Calc, the intersection of a Row and Column is called', ['Cell', 'Table', 'Sheet', 'Book'], 0],
    ['In LibreOffice Calc which Symbol shows after a Formula Error?', ['$', '@', '#', ''], 2],
    ['In Calc you can view the worksheet page wise with page break.', ['True', 'False'], 0],
    ['In Calc you can Hide/unhide the Formula bar.', ['True', 'False'], 0],
    ['In Calc you can use the sheet tab to protect a sheet.', ['True', 'False'], 1],
    ['In LibreOffice Calc, the Drawing Toolbar can also be placed somewhere other than its location.', ['True', 'False'], 0],
    ['Date and Time stored in LibreOffice Calc is internally treated as number format.', ['True', 'False'], 0],
    ['In LibreOffice Calc, spreadsheet can have only one sheet.', ['True', 'False'], 1],
    ['Spreadsheets allow us to organize, analyze, and store data in tabular form.', ['True', 'False'], 0],
    ['In LibreOffice Calc a number is in Left alignment and an alphabet is in Right alignment.', ['True', 'False'], 1],
    ['LibreOffice Calc by default provides an auto calculator feature that displays values in a selected range.', ['True', 'False'], 0],
    ['Ctrl + D have the same function in LibreOffice calc and Writer.', ['True', 'False'], 0],
    ["Number of Rows in LibreOffice Calc spreadsheet? / लिब्रेऑफिस कैल्क स्प्रेडशीट में रो की संख्या कितनी होती है?", ["1,048,576", "256", "2,048,571", "1111"], 0],
    ["Number of Columns in LibreOffice Calc spreadsheet? / लिब्रेऑफिस कैल्क स्प्रेडशीट में कॉलम की संख्या कितनी होती है?", ["256", "1024", "1,048,576", "210"], 2],
    ["Shortcut Key used for superscript in LibreOffice Calc. / लिब्रेऑफिस कैल्क में सुपरस्क्रिप्ट के लिए शॉर्टकट की का इस्तेमाल होता है-", ["Ctrl + shift+p", "Ctrl + 5", "Ctrl + A", "Ctrl + Shift+v"], 0],
    ["Shortcut Key used for help. / हेल्प के लिए शॉर्टकट की का उपयोग होता है-", ["Ctrl + F1", "Ctrl + F2", "F1", "F7"], 2],
    ["Extension of LibreOffice calc spreadsheet. / लिब्रेऑफिस कैल्क का एक्सटेंशन है-", [".ods", ".xls", ".odp", ".odt"], 0],
    ["Short cut used for print preview LibreOffice Calc. / लिब्रेऑफिस कैल्क में प्रिन्ट प्रिव्यू करने शॉर्टकट की का इस्तेमाल होता है-", ["Ctrl + Shift +O", "Ctrl + P", "Ctrl + F", "Ctrl + 0"], 0],
    ["How many spreadsheets on Libreoffice calc by default? / डिफॉल्ट रूप में लिब्रेऑफिस कैल्क में कितने वर्कशीट होते हैं?", ["2", "3", "1", "0"], 2],
    ["What will result from adding =A1+A2 to Calc? / कैल्क में =A1+A2 को ऐड करने से क्या परिणाम आएगा?", ["#VALUE!", "5", "1", "0"], 3],
    ["What is the shortcut of date in LibreOffice Calc. / लिब्रेऑफिस कैल्क में डेट का शॉर्टकट होता है।", ["Ctrl + D", "Ctrl + Shift + :", "Ctrl + ;", "None - कोई नहीं"], 2],
    ["What is the maximum number of spreadsheets in Calc? / कैल्क में अधिकतम वर्कशीट कितनी होती है?", ["32000", "1000", "5000", "255"], 0],
    ["Calc formula will start from which of the following symbol.. / कैल्क फॉर्मूला निम्नलिखित में से किस सिम्बल से शुरू होगा?", ["@", "=", "$", "&"], 1],
    ["What is the maximum number of cell spreadsheets in calc? / कैल्क में अधिकतम सेल एक नवर्सheet में कितने हैं?", ["10737741824", "1000", "6000", "1,048,576"], 0],
    ["What is the maximum number of Characters in one cell in calc spreadsheet? / कैल्क स्प्रेडशीट में एक सेल में कैरेक्टर की अधिकतम संख्या क्या है?", ["32767", "1024", "6000", "255"], 0],
    ["Moves the cursor to the first cell (A1) in the sheet in LibreOffice. / लिब्रेऑफिस में शीट में कर्सर को पहली सेल (A1) पर ले जाया जाता है-", ["Ctrl + Home", "Ctrl + F1", "Alt + F1", "Ctrl + 0"], 0],
    ["Minimum zoom % in Calc is.... / कैल्क में न्यूनतम जूम प्रतिशत होता है।", ["20%", "0%", "10%", "15%"], 0],
    ["Key used to Opens Manage Template in LibreOffice Calc. / लिब्रेऑफिस कैल्क में Manage Template के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + Shift + N", "Ctrl + T", "Ctrl + F1", "Ctrl + 0"], 0],
    ["Key used to Print a document in LibreOffice Calc. / लिब्रेऑफिस कैल्क में डाक्यूमेंट को प्रिंट करने के लिए 'की' का इस्तेमाल होता है-", ["Ctrl + P", "Ctrl + T", "Ctrl + F1", "Ctrl + 0"], 0],
    ["Can't maximize libreoffice calc zoom? / लिब्रेऑफिस कैल्क को अधिकतम जूम नहीं कर सकते?", ["200", "300", "500", "400"], 2],
    ["Shortcut key used to opens the Function Wizard in LibreOffice Calc. / लिब्रेऑफिस कैल्क में फंक्शन विजार्ड को ओपन करने के लिए शॉर्टकट की है-", ["Alt + F1", "Ctrl + F6", "F2", "Ctrl + F2"], 3],
    ["Shortcut key used to increase width of current cell in LibreOffice Calc. / लिब्रेऑफिस कैल्क में करेंट सेल की चौड़ाई बढ़ाने के लिए शॉर्टकट की है-", ["Alt + Right Arrow", "Alt + End", "F2", "Ctrl + F2"], 0],
    ["Reduce the cell width of the current cell. / वर्तमान सेल की सेल चौड़ाई कम करें।", ["Alt + End", "Alt + Left Arrow Key", "F2", "Ctrl + F2"], 1],
    ["Shortcut key used to decrease height of current row in LibreOffice Calc. / शॉर्टकट की का उपयोग लिब्रेऑफिस कैल्क में करेंट रो की हाइट को कम करने के लिए किया जाता है।", ["Alt + up Arrow", "Alt + End", "F2", "Ctrl+F2"], 0],
    ["Shortcut key for reach to last edit cell in LibreOffice calc? / लिब्रेऑफिस कैल्क में अंतिम एडिट सेल तक पहुँचने के लिए शॉर्टकट की है-", ["Ctrl + Home", "Alt+Ctrl +0", "Ctrl+End", "Ctrl+H"], 2],
    ["The combination of the column letter and row number for a cell in an Calc spreadsheet is called. / कैल्क स्प्रेडशीट के किसी सेल के कॉलम लेटर और रो नंबर का कांबिनेशन कहलाता है-", ["Cell across - सेल एक्सॉस", "Cell Identification Number - सेल आइडेंटिफिकेशन नम्बर", "Cell Reference - सेल रिफरेन्स", "Cell Identify - सेल आइडेंटिफ़िकाई"], 2],
    ["Output of the Calc expression is =100/10/2 / कैल्क एक्सप्रेसप्रेशन =100/10/2 का आउटपुट है।", ["5", "50", "35", "200"], 0]
  ],
  c5: [
    ['What is the maximum number of views you can add to a Slide?', ['2', '4', '6', '10'], 1],
    ['Which shortcut key in LibreOffice Impress is used for Paste Unformatted Text?', ['Ctrl+Alt+V', 'Ctrl+Shift+V', 'Ctrl+Alt+Shift+V', 'None of these'], 2],
    ['What is the slide transition in LibreOffice Impress?', ['Letter', 'A type of slide', 'Over head', 'A special effect used to show a slideshow'], 3],
    ['In LibreOffice Impress the shortcut key for print preview of a presentation is?', ['Ctrl+P', 'Ctrl+Shift+P', 'Ctrl+Shift+F12', 'None of these'], 3],
    ['In LibreOffice Impress the default Title name of a presentation is?', ['Untitled 1', 'Presentation 1', 'Untitle', 'Document 1'], 0],
    ['LibreOffice Impress presentation can be exported in which format?', ['BMP', 'PDF', 'GIF', 'All'], 3],
    ['In LibreOffice Impress the minimum zoom size is?', ['5%', '10%', '15%', '20%'], 1],
    ['The slide sorter option available in which menu of LibreOffice Impress?', ['Insert', 'Format', 'View', 'Slide show'], 2],
    ['Which transition effect is not available in LibreOffice Impress?', ['Diagonal', 'Dissolve', 'Fly in', 'Fade'], 0],
    ['Using which option do all the slides appear simultaneously?', ['Print preview', 'Slide sorter', 'Handouts', 'None of these'], 1],
    ['In LibreOffice Impress which shortcut key is used for duplicate slide?', ['Ctrl+S', 'Ctrl+D', 'Ctrl+Shift+D', 'None of these'], 2],
    ['Which shortcut key is used to add a new slide in Libreoffice Impress?', ['Ctrl+M', 'Ctrl+N', 'Ctrl+S', 'Ctrl+T'], 0],
    ['The default template in LibreOffice Impress Presentation is?', ['Image', 'Title and content', 'Content only', 'Title only'], 1],
    ['In LibreOffice Impress which shortcut key is used to repeat the slide show continuously?', ['Loop', 'Repeat', 'Move', 'None'], 3],
    ['Which of the following is used to organize or shorten the slides?', ['Slide Pan', 'Slide sorter view', 'Both A and B', 'None of these'], 2],
    ['Which shortcut key is used to move to the next slide?', ['Ctrl + Page Down', 'Ctrl + home', 'Ctrl + Page up', 'None of these'], 0],
    ['In LibreOffice Impress which view contains only Text?', ['Outline view', 'Normal view', 'Notes view', 'Slide shorter view'], 0],
    ['In LibreOffice Impress the maximum number of hand outs in a slide is?', ['3', '4', '6', '9'], 3],
    ['In LibreOffice Impress which option is used to remove the slide transition?', ['None Transition', 'Split Transition', 'Wipe Transition', 'Push Transition'], 0],
    ['Which shortcut key is used to perform a slide show in LibreOffice Impress?', ['Alt+F5', 'F5', 'Shift + F5', 'Ctrl+F5'], 1],
    ['In LibreOffice Impress the default page orientation is?', ['Portrait', 'Vertical', 'Landscape', 'Horizontal'], 2],
    ['Which slide is used as a starting point for other slides?', ['First slide', 'Master slide', 'Last slide', 'None of these'], 1],
    ['In LibreOffice Impress which key is used to go to the previous slide?', ['Page down', 'Home', 'Enter', 'Page up'], 3],
    ['How can we go directly to the menu while the slide is running?', ['By clicking on the Ribbon', 'By mouse click', 'By Right click on the slide', 'All of the above'], 2],
    ['How to create a text box in a slide?', ['Slide -> Textbox', 'Insert -> Textbox', 'Insert -> Table -> Textbox', 'None of these'], 1],
    ['Which shortcut key is used to navigate in LibreOffice Impress?', ['Ctrl+Shift+F5', 'Ctrl+F5', 'Alt+F5', 'None of these'], 0],
    ['Which type of sound file from the following can be added to LibreOffice Impress?', ['.dat', '.log', '.wav', '.drv'], 2],
    ['The macros command is available in which menu of LibreOffice Impress?', ['Slide menu', 'Insert menu', 'View menu', 'Tools menu'], 3],
    ['In LibreOffice Impress which shortcut key is used to go to the first slide of the presentation?', ['Ctrl + Home', 'Home', 'Shift + Home', 'Both A and B'], 3],
    ['Which of the following view is not available in LibreOffice Impress?', ['Slide sorter view', 'Slide show view', 'Sorter view', 'None of these'], 2],
    ['Which of the following option is used to set the time for each object in a slide?', ['Slide show -> Slide Transition', 'Slide show -> Custom Transition', 'Format -> Animation', 'View -> Animation'], 0],
    ['In LibreOffice Impress the shortcut key Ctrl + E is used for?', ['Right Align', 'Center Align', 'Left Align', 'None of these'], 1],
    ['Which menu has the option of master slide in LibreOffice Impress?', ['Format', 'View', 'Slide show', 'Slide'], 1],
    ['In LibreOffice Impress which file format is not added in a presentation?', ['HTML', 'GIF', 'JPEG', 'WAV'], 0],
    ['In LibreOffice Impress the slide transition option available in which menu?', ['View', 'Slide', 'Insert', 'Both A and B'], 1],
    ['The first slide of a presentation is known as?', ['Main Slide', 'Home Slide', 'Title Slide', 'None of these'], 2],
    ['Which alignment is not available in LibreOffice Impress?', ['Right Alignment', 'Justification', 'Left Alignment', 'Central Alignment'], 3],
    ['What is used to determine the timing on a slide in a presentation?', ['Slide Timer', 'Slide Timing Tool', 'Slide Tool', 'Rehearsal'], 3],
    ['We can add a table in LibreOffice Impress?', ['True', 'False'], 0],
    ['The first slide of a presentation in LibreOffice Impress is called Master Slide?', ['True', 'False'], 1],
    ['We cannot rename slides in LibreOffice Impress?', ['True', 'False'], 1],
    ['When we insert a new slide, it insets according to its previous slide layout?', ['True', 'False'], 0],
    ['We can create a photo Album in LibreOffice Impress?', ['True', 'False'], 0],
    ['In LibreOffice Impress the shortcut key to insert a text box is?', ['F4', 'F3', 'F2', 'F5'], 2],
    ['If you add a graphic in a Master Slide it will appear on every slide of your presentation?', ['True', 'False'], 0],
    ['In LibreOffice Impress there is no option of mail merge?', ['True', 'False'], 0],
    ['In LibreOffice Impress bullet and numbering option available in which menu?', ['File', 'Slide', 'Format', 'Insert'], 2],
    ['In Impress press the shortcut key for send to back any shape is?', ['Ctrl+Shift', 'Ctrl+Shift+-', 'Ctrl+Shift++', 'None of these'], 1],
    ['In Impress the shortcut key for subscript is?', ['Ctrl+B', 'Ctrl+Shift+P', 'Ctrl+Shift+B', 'None of these'], 2],
    ['In Impress the Clear Direct Formatting option available in which menu?', ['File', 'Window', 'Tools', 'Format'], 3],
    ['Shortcut key to insert a new slide is?', ['Ctrl+Shift+M', 'Shift+M', 'Ctrl+N', 'Ctrl+M'], 3],
    ['Export Direct as PDF option available at?', ['Drawing Toolbar', 'Presentation', 'Standard Toolbar', 'All of these'], 2],
    ['Shortcut key for Presentation Slide Show is?', ['F5', 'Shift+F5', 'Alt+F5', 'All of these'], 3],
    ['If you want to close the Impress Presentation Window then which shortcut key you press?', ['Ctrl+X', 'Ctrl+B', 'Ctrl+W', 'None of these'], 2],
    ['In Impress which menu you use to change the layout of a slide?', ['Slide Show', 'Format', 'Tools', 'Slide'], 3],
    ['Text Alignment option available in which menu?', ['View', 'Format', 'Tools', 'Insert'], 1],
    ['In Impress the Layout of a slide can be?', ['Title Only', 'Title, Content', 'Title, 4 Content', 'All of these'], 3],
    ['In Impress the minimum and maximum zoom size is?', ['5, 3000', '10, 500', '400', 'None of these'], 0],
    ['In Impress which shortcut key is use to insert a Template?', ['Ctrl+Shift+B', 'Ctrl+Shift+N', 'Ctrl+N', 'None of these'], 1],
    ['During a slide presentation, which key would you press to select one hyperlink after another?', ['Ctrl+H', 'Ctrl+K', 'Tab', 'All of the above'], 2],
    ['What is the extension name of a file saved in Impress?', ['.odt', '.odp', '.ods', '.odi'], 1],
    ['Which of the following can you use to organize or shorten a slide?', ['Slide Pane', 'Slide Shorter View', 'both a and b', 'None of these'], 2],
    ['It is a slide that is used as a starting point for other slides?', ['First Slide', 'Style', 'Template', 'Master Slide'], 3],
    ['In LibreOffice Impress Macros command available in which menu?', ['Tools', 'Slide', 'Insert', 'None of these'], 0],
    ['Which of the following file formats can be added to LibreOffice Impress?', ['jpeg', 'wmv', 'mpeg', 'All of above'], 3],
    ['Using which option do all slides appear simultaneously?', ['Handouts', 'Slide Shorter', 'Print Preview', 'None of these'], 1],
    ['To Remove Slide Transition we use the following ......', ['Split Transition', 'None Transition', 'Wipe Transition', 'Push Transition'], 1],
    ['In LibreOffice Impress which Alignment is not available?', ['Right Alignment', 'Left Alignment', 'Central Alignment', 'justification'], 2],
    ['In LibreOffice Impress which view is not available in following?', ['Normal', 'Outline', 'Notes', 'None of these'], 3],
    ['In LibreOffice Impress the Slide Shorter available in which Menu?', ['View', 'Insert', 'Slide Show', 'Format'], 0],
    ['In Impress, Line, Rectangle, Ellipse etc. Tools are found in drawing toolbar?', ['True', 'False'], 0],
    ['In Impress you can insert comments with Alt + Shift + C.', ['True', 'False'], 1],
    ['With the Custom Slide Show you can do your favorite slide show?', ['True', 'False'], 0],
    ['In Impress Presentation program the status bar can be hidden?', ['True', 'False'], 0],
    ['A presentation in LibreOffice Impress can have only one master slide?', ['True', 'False'], 1],
    ['If you add a graphic to a master slide it will appear on every slide in your presentation.', ['True', 'False'], 0],
    ['A hidden slide is a slide that cannot be shown to the audience while running a slide show?', ['True', 'False'], 0],
    ['You cannot create Custom Page Style in LibreOffice Impress?', ['True', 'False'], 1],
    ['Slide animations are similar to transitions, but they applicable to individual elements in a single slide?', ['True', 'False'], 0],
    ['In LibreOffice Impress you can create a photo album from a set of images, usually with one photo per Slide.', ['True', 'False'], 0],
    ["Maximum Zoom in Impress are- / इम्प्रेस में अधिकतम जूम कितना होता है?", ["300%", "3000%", "450%", "500%"], 1],
    ["Master Slide Function in which LibreOffice Impress Menu. / लिब्रेऑफिस इम्प्रेस में मास्टर स्लाइड फंक्शन किस मेन्यू में उपलब्ध है?", ["Slide Show - स्लाइड शो", "Slide - स्लाइड", "Format - फॉर्मेट", "Tools - टूल्स"], 1],
    ["It is used to determine the timing on a slide in a presentation / इसका उपयोग प्रेजेंटेशन में स्लाइड पर समय निर्धारित करने के लिए किया जाता है।", ["Slide timer", "Slide timing tool", "Slide tool", "rehearsal"], 1],
    ["What is a presentation in LibreOffice? / लिब्रेऑफिस में प्रेजेंटेशन क्या है?", ["Calc - कैल्क", "Impress - इम्प्रेस", "Writer - राइटर", "None - कोई नहीं"], 1],
    ["...menus are found in LibreOffice Impress? / लिब्रे ऑफिस इम्प्रेस में मेन्यू की संख्या है?", ["10", "12", "9", "7"], 0],
    ["Help Key used in Libre Office? / लिब्रेऑफिस में हेल्प की का शॉर्टकट है?", ["F2", "F7", "F1", "F8"], 0],
    ["What is the minimum zoom size in LibreOffice Impress? / लिब्रेऑफिस इम्प्रेस में जूम का न्यूनतम साइज क्या होता है?", ["5%", "6%", "30%", "100%"], 0],
    ["Slide Transition command found in which menu of LibreOffice Impress? / स्लाईड ट्रांजिशन कमांड लिब्रेऑफिस इम्प्रेस में किस मेन्यू में मिलता है?", ["File - फाइल", "Slide - स्लाइड", "Format - फॉर्मेट", "F7"], 1],
    ["Which of the following is found in LibreOffice Impress? / निम्नलिखित में से कौन लिब्रेऑफिस इम्प्रेस में पाये जाते हैं?", ["Standard Tool Bar-स्टैण्डर्ड टूल बार", "Single Toolbar-सिंगल टूलबार", "Tabbed देख्स", "All of above / उपयुक्त सभी"], 3],
    ["In LibreOffice Impress, what combinations of commands are used for copy and paste? / लिब्रेऑफिस इम्प्रेस में कॉपी और पेस्ट के लिए निम्न कौन से कमाण्ड कांबिनेशन का उपयोग होता है?", ["CTRL+X and CTRL+P", "Invoke find dialog box - इनकावोक फाइंड डायलॉग बॉक्स", "CTRL+X and CTRL+5", "CTRL+C and CTRL+V"], 3],
    ["Key used to Opens Templates and Documents dialog in LibreOffice Impress. / लिब्रेऑफिस इम्प्रेस में टेम्पलेट को ओपन करने के लिए किस की का इस्तेमाल होता है-", ["Ctrl+Shift+N", "Ctrl + T", "Ctrl + F1", "Ctrl + O"], 0],
    ["Key used to Print a document in LibreOffice Impress. / लिब्रेऑफिस इम्प्रेस में डाक्यूमेंट को प्रिंट करने के लिए किस की का इस्तेमाल होता है-", ["Ctrl + P", "Ctrl + T", "Ctrl + F1", "Ctrl + O"], 0],
    ["Which command brings you to the first slide in your presentation? / कौन-सा कमांड का प्रयोग आप प्रेजेंटेशन में फर्स्ट स्लाइड पर जाने के लिए करते हैं।", ["Next slide button - नेक्स्ट स्लाइड बटन", "Page up - पेज अप", "Ctrl+Home", "Ctrl + End"], 2],
    ["Which of the following extensions are related to LibreOffice impress? / निम्नलिखित में से कौन सी एक्सटेंशन लिब्रेऑफिस इम्प्रेस से सम्बन्धित हैं?", [".odt", ".ods", ".rtf", ".odp"], 3],
    ["In LibreOffice impress which of the following key is used to end presentation. / लिब्रेऑफिस इम्प्रेस में किस की का प्रयोग प्रेजेंटेशन को समाप्त करने के लिए होता है?", ["Ctrl+X", "Ctrl+Home", "Esc", "Shift +End"], 2],
    ["In LibreOffice Impress, slide sorter command is found under which menu. / पावरप्वाइंट में किस मेन्यू के अन्तर्गत स्लाइड शार्टर कमांड पाया जाता है?", ["File - फाईल", "Tools - टूल्स", "View - व्यू", "Edit - एडिट"], 2],
    ["The default name of the Impress presentation is ... / इम्प्रेस प्रेजेंटेशन का डिफॉल्ट नाम है.........", ["Calc - कैल्क", "Untitled1- LibreOffice Impress - अनटाइटल्ड 1- लिब्रेऑफिस इम्प्रेस", "Slide1 - स्लाइड 1", "Writer - राइटर"], 1],
    ["You can create a new presentation using all of the following except. / किसके अतिरिक्त आप नया प्रेजेंटेशन तैयार कर सकते हैं?", ["Ctrl + N", "Click on New Icon", "Ctrl + O", "File menu > New Presentation"], 2],
    ["The ______ keyboard combination can be used to open a presentation file. / किसी प्रेजेंटेशन को ओपन करने के लिए किस संयोजन का उपयोग किया जाता है...", ["Ctrl+F", "Alt+P", "F1", "Ctrl+O"], 3],
    ["The maximum number of slide can be printed on A4 size page. / स्लाइडों की मैकिसमम नम्बर ए4 आकार के पेज पर प्रिंट की जा सकती है।", ["1", "5", "9", "4"], 2],
    ["You use ___ in your slides to hold text, art, and charts. / अपनी स्लाइड में टेक्स्ट, क्लिप आर्ट और चार्ट को होल्ड के लिए ..... उपयोग करें।", ["Textbox - टेक्स्ट बॉक्स", "Drawing box - ड्रॉइंग बॉक्स", "Placeholders - प्लेस होल्डर", "Window - विण्डो"], 2],
    ["Key used to insert new slide LibreOffice Impress. / लिब्रेऑफिस इम्प्रेस में नई स्लाइड इंसर्ट करने के लिए किस की का उपयोग होता है-", ["Ctrl + O", "Ctrl + M", "Ctrl + F1", "Ctrl + S"], 1],
    ["Menu command to create a text box on a slide. / स्लाइड पर टेक्स्ट बॉक्स बनाने के लिए यह मेन्यू कमाण्ड है।", ["Tool/Text box - टूल/टेक्स्ट बॉक्स", "View/Text box - व्यू/टेक्स्ट बॉक्स", "Insert/Text box - इंसर्ट/टेक्स्ट बॉक्स", "Formate/Text box - फॉर्मेट/टेक्स्ट बॉक्स"], 2],
    ["In LibreOffice Impress in order to see all the slides on one screen use- / एक स्क्रीन उपयोग पर सभी स्लाइड देखने के लिए लिब्रेऑफिस इम्प्रेस में......", ["View, slide sorter - व्यू, स्लाइड सॉर्टर", "View, slide - व्यू, स्लाइड", "View, master - व्यू, मास्टर", "View, slide show - व्यू, स्लाइड शो"], 0],
    ["Which of the following shortcut key is used to start Slide Show from Current Slide. / इम्प्रेस में किस शॉर्टकट की का प्रयोग करेंर स्लाइड शो से प्रारम्भ करने के लिए है?", ["F5", "Ctrl+F5", "Shift+F5", "Shift+F2"], 2]
  ],
  c6: [
    ['ARPANET ka poora naam kya hai?', ['Advanced Research Projects Agency Network', 'Advanced Research Project Authority Network', 'Automated Research Projects Agency Network', 'None of these'], 0],
    ['Internet ka janak (Father of Internet) kise kaha jata hai?', ['Tim Berners-Lee', 'Vint Cerf', 'Denis Ritchie', 'Alan Turing'], 1],
    ['World Wide Web (WWW) ke aavishkarak kaun hain?', ['Bill Gates', 'Charles Babbage', 'Steve Jobs', 'Tim Berners-Lee'], 3],
    ['Web pages ko dekhne ke liye kis software ka prayog kiya जाता hai?', ['Operating System', 'Compiler', 'Web Browser', 'Interpreter'], 2],
    ['URL ka poora naam kya hai?', ['Universal Record Link', 'Uniform Resource Locator', 'Unified Resource Linker', 'None of these'], 1],
    ['HTTP ka poora naam kya hai?', ['Hyperlink Transfer Protocol', 'HyperText Transmission Process', 'Hyper Text Transfer Protocol', 'Hyper Text Terminal Protocol'], 2],
    ['HTTPS me \'S\' ka kya arth hai?', ['Simple', 'Source', 'System', 'Secure'], 3],
    ['IP address ka kitna version hota hai?', ['1', '2', '4', '8'], 1],
    ['IPv4 address ki lambai (length) kitni hoti hai?', ['32 bits', '64 bits', '128 bits', '16 bits'], 0],
    ['IPv6 address ki lambai kitni hoti hai?', ['32 bits', '64 bits', '128 bits', '256 bits'], 2],
    ['Domain Name System (DNS) ka mukhya karya kya hai?', ['Internet speed badhana', 'Data encrypt karna', 'Virus block karna', 'Domain name ko IP address me badalna'], 3],
    ['Web browser par kisi page ko refresh karne ki shortcut key kya hai?', ['F5', 'F3', 'F7', 'F11'], 0],
    ['Full Screen mode me browser ko karne ki shortcut key kya hai?', ['F5', 'F10', 'F12', 'F11'], 3],
    ['Pehla web browser kaun sa tha?', ['WorldWideWeb', 'Internet Explorer', 'Netscape Navigator', 'Mosaic'], 0],
    ['Pehla graphical web browser kaun sa tha?', ['Safari', 'Chrome', 'Mosaic', 'Opera'], 2],
    ['Email ka aavishkar kisne kiya tha?', ['Tim Berners-Lee', 'Ray Tomlinson', 'Vint Cerf', 'Bill Gates'], 1],
    ['Email message ke do mukhya bhaag kaun se hote hain?', ['Header aur Body', 'To aur From', 'Subject aur Signature', 'Sender aur Receiver'], 0],
    ['CC ka email me poora naam kya hai?', ['Computer Copy', 'Carbon Copy', 'Common Copy', 'Copy Control'], 1],
    ['BCC ka email me poora naam kya hai?', ['Blind Computer Copy', 'Basic Carbon Copy', 'Blind Carbon Copy', 'None'], 2],
    ['BCC aur CC me kya antar hai?', ['Sirf size ka antar hai', 'CC recipients dusre recipients ko nahi dikhte', 'Koi antar nahi hai', 'BCC recipients dusre recipients ko nahi dikhte'], 3],
    ['Email me spam kya hota hai?', ['Draft email', 'Important email', 'Deleted email', 'Unsolicited / Junk commercial email'], 3],
    ['ISP ka poora naam kya hai?', ['Internal Service Provider', 'Internet Service Provider', 'Internet Source Protocol', 'Information Service Provider'], 1],
    ['Web browser ka udaharan kaun sa hai?', ['Google Chrome', 'Mozilla Firefox', 'Microsoft Edge', 'All of the above'], 3],
    ['Search Engine ka udaharan kaun sa hai?', ['Google', 'Yahoo', 'Bing', 'All of the above'], 3],
    ['HTML ka prayog kiske liye hota hai?', ['Web pages banane ke liye', 'Database manage karne ke liye', 'Calculations ke liye', 'Presentation के लिए'], 0],
    ['URL ka konsa bhaag protocol ko darsata hai?', ['.com', 'www.', 'http://', 'domain name'], 2],
    ['FTP ka poora naam kya hai?', ['Fast Transfer Protocol', 'File Transfer Protocol', 'File Transmission Process', 'File Text Protocol'], 1],
    ['TCP/IP ka mukhya upyog kahan hota hai?', ['Internet par data transmission ke liye', 'Printer chalane ke liye', 'Sound processing के लिए', 'RAM management के लिए'], 0],
    ['Modem kiska combination hai?', ['Monitor & Demodulator', 'Memory & Device', 'Modulator & Demodulator', 'None'], 2],
    ['MAC address kitने bit ka hota hai?', ['32 bit', '48 bit', '64 bit', '128 bit'], 1],
    ['Wi-Fi ka poora naam kya hai?', ['Wired Fidelity', 'Wireless Field', 'Wireless Fidelity', 'Wide Fidelity'], 2],
    ['Bluetooth kis technology par kaam karta hai?', ['Short-range Radio Frequency', 'Infrared waves', 'Satellite signals', 'Laser waves'], 0],
    ['Cloud Computing ka udaharan kaun sa hai?', ['Google Drive', 'Dropbox', 'OneDrive', 'All of the above'], 3],
    ['Intranet kya hota hai?', ['Public internet network', 'Private network jo kisi organization ke andar use hota hai', 'Global network', 'None'], 1],
    ['Extranet kya hota hai?', ['Private network jo authorized external users ke liye hota hai', 'Public internet', 'Local network', 'None'], 0],
    ['Browser history check karne ki shortcut key kya hai?', ['Ctrl + D', 'Ctrl + J', 'Ctrl + H', 'Ctrl + B'], 2],
    ['Browser me downloads window kholne ki shortcut key kya hai?', ['Ctrl + J', 'Ctrl + D', 'Ctrl + H', 'Ctrl + S'], 0],
    ['Bookmark add karne ki shortcut key browser me kya hoti hai?', ['Ctrl + D', 'Ctrl + B', 'Ctrl + Shift + B', 'All of these (browser ke anusar)'], 3],
    ['Incognito mode browser me kisliye use hota hai?', ['Virus hatane ke liye', 'Fast speed ke liye', 'Private browsing ke liye (history save nahi hoti)', 'Download ke liye'], 2],
    ['Incognito mode kholne ki shortcut key Chrome me kya hai?', ['Ctrl + Shift + P', 'Ctrl + Shift + N', 'Ctrl + N', 'Alt + N'], 1],
    ['Phishing kya hai?', ['Network speed badhana', 'Virus banana', 'Email bhejna', 'Fraudulent tarike se sensitive jankari (password/OTP) churana'], 3],
    ['Firewall ka mukhya karya kya hai?', ['Unauthorized access se network ki suraksha karna', 'Internet speed badhana', 'Computer ko garam hone se bachana', 'Files delete karna'], 0],
    ['E-commerce ka kya arth hai?', ['Email bhejna', 'Internet ke madhyam se kharid-bikri karna', 'Chat karna', 'Education dena'], 1],
    ['B2C ka poora naam kya hai?', ['Buyer-to-Consumer', 'Business-to-Client', 'Business-to-Consumer', 'Business-to-Company'], 2],
    ['B2B ka poora naam kya hai?', ['Buyer-to-Business', 'Business-to-Business', 'Business-to-Buyer', 'None'], 1],
    ['C2C ka udaharan kaun sa platform hai?', ['Flipkart', 'Amazon', 'OLX / Quikr', 'Myntra'], 2],
    ['Blog shabd kiska combination hai?', ['Data + Log', 'Web + Blog', 'Net + Log', 'Web + Log'], 3],
    ['Podcast kya hota hai?', ['Audio/Video digital media file jo internet par uplabdh hoti hai', 'Text document', 'Spreadsheet', 'Operating system'], 0],
    ['IoT ka poora naam kya hai?', ['Integrated Operating Tool', 'Internet of Technology', 'Internet of Things', 'None'], 2],
    ['Social Networking site ka udaharan kaun sa hai?', ['Facebook', 'Instagram', 'Twitter (X)', 'All of the above'], 3],
    ['LinkedIn kis prakar ki networking site hai?', ['Entertainment', 'Professional Networking', 'Video Sharing', 'E-commerce'], 1],
    ['Domain name ke ant me ".edu" kya darsata hai?', ['Educational institution', 'Government site', 'Network site', 'Commercial site'], 0],
    ['Domain name ke ant me ".gov" kya darsata hai?', ['Government website', 'General website', 'Gaming site', 'None'], 0],
    ['Domain name ke ant me ".mil" kya darsata hai?', ['Miscellaneous site', 'Medical site', 'Multimedia site', 'Military website'], 3],
    ['Top Level Domain (TLD) ka udaharan kaun sa hai?', ['.com', '.org', '.net', 'All of the above'], 3],
    ['Web page ka pehla page kya kahlata hai?', ['First page', 'Master page', 'Homepage', 'Index page'], 2],
    ['Hyperlink ko web page par kisse pehchana jata hai?', ['Red box', 'Blue and underlined text ya image', 'Blinking text', 'Bold text'], 1],
    ['Web hosting ka kya arth hai?', ['Web pages ko server par store karna taki internet par dikh sakein', 'Internet speed badhana', 'Domain kharidna', 'Code likhna'], 0],
    ['FTP server par files upload karne ki kriya ko kya kehte hain?', ['Downloading', 'Uploading', 'Browsing', 'Transferring'], 1],
    ['Server se apne computer par file lane ko kya kehte hain?', ['Copying', 'Uploading', 'Downloading', 'Pasting'], 2],
    ['Packet switching kisme use hoti hai?', ['Hard disk read me', 'Electricity supply me', 'Internet data transmission me', 'RAM storage me'], 2],
    ['Gateway का mukhya upyog kahan hota hai?', ['Alag-alag protocol wale networks ko aapas me jodne ke liye', 'Computer on karne ke liye', 'Mouse connect karne ke liye', 'None'], 0],
    ['Router ka mukhya karya kya hai?', ['Screen capture karna', 'Virus banana', 'Print nikalna', 'Data packets ko sabse behtar rasta (path) dena'], 3],
    ['Switch network me kya karta hai?', ['Internet band karta hai', 'Devices ko ek network ke andar aasapas jorta hai aur data direct bhejta hai', 'Password badalta hai', 'None'], 1],
    ['Hub aur Switch me kya antar hai?', ['Hub sabhi ports par data bhejta hai, Switch specific target port par bhejta hai', 'Dono ekdam same hain', 'Hub smart hota hai', 'None'], 0],
    ['Bandwidth ki unit kya hoti hai?', ['Watts', 'Hertz', 'Bytes', 'Bits per second (bps)'], 3],
    ['Baud rate kisse sambandhit hai?', ['Screen resolution', 'Computer weight', 'Modulation rate / transmission speed', 'RAM speed'], 2],
    ['SSL ka poora naam kya hai?', ['Secure System Link', 'Secure Sockets Layer', 'Simple Socket Layer', 'Safe Secure Link'], 1],
    ['TLS ka poora naam kya hai?', ['Transmission Layer Standard', 'Transfer Link System', 'Transport Layer Security', 'None'], 2],
    ['Phishing attack se bachne ke liye kya nahi karna chahiye?', ['Antivirus update rakhna chahiye', 'Kisi bhi anjaan link par click ya personal details share nahi karni chahiye', 'Strong password rakhna chahiye', 'HTTPS check karna chahiye'], 1],
    ['Ransomware kya hai?', ['Browser', 'Ek achha software', 'Antivirus', 'Ek malware jo computer ko lock ya encrypt karke firauti (ransom) maangta hai'], 3],
    ['Spyware ka mukhya uddeshya kya hota hai?', ['User ki gatividhiyon par chupchap najar rakhna aur data churana', 'Computer ki speed badhana', 'Game khelna', 'Wallpaper badlana'], 0],
    ['Adware kisse juda hota hai?', ['System ko secure karne se', 'Unwanted advertisements dikhane wale software se', 'Audio play karne se', 'None'], 1],
    ['Trojan Horse kya hai?', ['Ek harmful program jo useful software ki tarah dikhta hai', 'Ek horse game', 'Network cable', 'Browser'], 0],
    ['Worm aur Virus me mukhya antar kya hai?', ['Worm khud replicate ho sakta hai bina host file ke, virus ko host file chahiye hoti hai', 'Dono bilkul same hain', 'Virus nuksan nahi karta', 'None'], 0],
    ['CC aur BCC dono kahan hote hain email compose karte samay?', ['Subject me', 'Footer section me', 'Attachment me', 'Header section me'], 3],
    ['Email me attachment ki size limit aamtaur par kis par nirbhar karti hai?', ['Keyboard par', 'Computer ki RAM par', 'Email provider (jaise Gmail, Yahoo) ki policy par', 'Internet speed par'], 2],
    ['Gmail me ek bar me maximum kitni size ki file attach ki ja sakti hai (direct)?', ['25 MB', '10 MB', '50 MB', '100 MB'], 0],
    ['Agar 25 MB se badi file bhejni ho Gmail se, toh kiska prayog hota hai?', ['Direct bhej sakte hain', 'Bluetooth ka', 'Pendrive ka', 'Google Drive link ka'], 3],
    ['URL me kitne mukhya mukhya bhaag hote hain?', ['Paanch', 'Sirf ek', 'Protocol, Domain name, Path/File name', 'Das'], 2],
    ['Netiquettes ka kya arth hai?', ['Network speed ke niyam', 'Internet par use hone wale shishtachar (etiquette) ke niyam', 'Hardware cleaning ke niyam', 'None'], 1],
    ['Cyber Crime ki reporting ke liye Bharat sarkar ka portal kaun sa hai?', ['nielit.gov.in', 'cybercrime.gov.in', 'rbi.org.in', 'ccc.gov.in'], 1],
    ['Internet pe har ek device ka ek unique address hota hai, use kya kehte hain?', ['Text ID', 'Home Address', 'Mac ID ke alawa kuch nahi', 'IP Address'], 3],
    ['Static IP address kya hota hai?', ['Jo sirf offline chale', 'Jo har bar connect karne par badal jata hai', 'Aisa IP address jo badalta nahi hai (fixed rehta hai)', 'None'], 2],
    ['Dynamic IP address kya hota hai?', ['Jo kabhi nahi badalta', 'Jo internet se connect hone par har bar naya assign hota hai', 'Jo sirf printer ke liye ho', 'None'], 1],
    ['Telnet ka prayog kiske liye hota hai?', ['Remote computer ko text-based interface se access karne ke liye', 'File download ke liye', 'Video streaming ke liye', 'Printing के लिए'], 0],
    ['SSH ka poora naam kya hai?', ['Simple Shell', 'Secure System Host', 'Secure Shell', 'Safe Server Host'], 2],
    ['DNS kis port number par kaam karta hai?', ['Port 21', 'Port 80', 'Port 443', 'Port 53'], 3],
    ['HTTP default roop se kis port par kaam karta hai?', ['Port 21', 'Port 443', 'Port 25', 'Port 80'], 3],
    ['HTTPS default roop se kis port par kaam karta hai?', ['Port 443', 'Port 80', 'Port 21', 'Port 110'], 0],
    ['FTP default roop se kis port par kaam karta hai?', ['Port 80', 'Port 20 aur 21', 'Port 53', 'Port 443'], 1],
    ['SMTP (Simple Mail Transfer Protocol) kis port par kaam karta hai?', ['Port 110', 'Port 80', 'Port 25', 'Port 443'], 2],
    ['POP3 (Post Office Protocol v3) kis port par kaam karta hai?', ['Port 53', 'Port 25', 'Port 80', 'Port 110'], 3],
    ['IMAP (Internet Message Access Protocol) kis port par kaam karta hai?', ['Port 25', 'Port 143', 'Port 80', 'Port 443'], 1],
    ['Web page par move karne ke liye kis language ka use hota hai (structure ke alawa design ke liye)?', ['Python', 'C Language', 'CSS (Cascading Style Sheets)', 'Assembly'], 2],
    ['JavaScript का mukhya upyog web development me kiske liye hota hai?', ['Web pages me interactivity aur logic add karne ke liye', 'Database banane ke liye', 'Hardware design ke liye', 'Operating system ke liye'], 0],
    ['Cookies kya hoti hain?', ['Virus type', 'Chhoti text files jo website dwara user ke browser par store ki jati hain session track karne ke liye', 'Hardware part', 'Internet speed booster'], 1],
    ['Cache memory browser me kyu hoti hai?', ['Frequently visited web pages ko fast load karne ke liye', 'Virus rakhne ke liye', 'RAM badhane ke liye', 'None'], 0],
    ['Web scraping ka kya arth hai?', ['Website hack karna', 'Website delete karna', 'Websites se automatic tarike se data extract karna', 'None'], 2],
    ['Internet of Things (IoT) me devices aapas me kiske madhyam se judti hain?', ['Manual switch से', 'Sirf wires ke madhyam se', 'Bluetooth ke alawa kuch nahi', 'Internet aur sensors ke madhyam se'], 3],
    ["Unreserved Ticketing System (UTS) through App launched by Railway Ministry in..... / रेलवे मंत्रालय के द्वारा एप के माध्यम से अनरिजर्व्ड टिकटिंग सिस्टम (UTS)........ में लॉन्च किया गया", ["January 2019 - जनवरी 2019", "Februay 2019 - फरवरी 2019", "January 2018 - जनवरी 2018", "None of above - इनमें से कोई नहीं"], 3],
    ["Which one of the following is a Web browsing software / निम्नलिखित में से कौन सा वेब ब्राउजिंग साफ्टवेयर है।", ["Google Chrome - गूगल क्रोम", "Mozilla Firefox - मोजिला फॉयरफॉक्स", "Apple Safari - एप्पल सफारी", "all of above - उपर्युक्त सभी"], 3],
    ["The World Wide Web is composed of / वर्ल्ड वाइड वेब बनाया जाता है।", ["1 page - 1 पेज", "only 100 Web pages - केवल 100 वेब पेजेस", "500 Web pages - 500 वेब पेजेस", "Millions of Web pages - दस लाख वेब पेजेस"], 3],
    ["Webpage can be developed by using language / भाषा के उपयोग से वेब पेज बनाए जा सकते हैं।", ["HTML - एचटीएमएल", "WWW - डब्लू डब्लू डब्लू", "Web browser - वेब ब्राउजर", "Internet Explorer - इंटरनेट एक्सप्लोरर"], 0],
    ["WAIS stands for / WAIS का पूर्ण अर्थ है:", ["Wide area information server - वाइड एरिया इनफॉरमेशन सर्वर", "Wide area Internet service - वाइड एरिया इंटरनेट सर्विस", "Wide Area information system - वाइड एरिया इंफॉर्मेशन सिस्टम", "None of the above - उपर्युक्त में से कोई नहीं"], 2],
    ["The internet was originally developed by / इंटरनेट वास्तविक रूप से... द्वारा विकसित हुआ था।", ["A corporation - एक कॉर्पोरेशन", "Computer hackers - कंप्यूटर हैकर", "U.S. Department of Defense - यू.एस. का रक्षा विभाग", "The University of Michigan - मिशिगन विश्वविद्यालय"], 2],
    ["Software which allows user to view the webpage is called.... / एक सॉफ्टवेयर जिसके द्वारा वेबपेज को देखा जा सकता है।", ["Website - वेबसाइट", "Interpreter - इंटरप्रेटर", "Internet browser - इंटरनेट ब्राउजर", "Operating system - ऑपरेटिंग सिस्टम"], 2],
    ["A specifice page of web is known as / वेब का स्पेसिफिक पेज जाना जाता है।", ["worksheet - वर्कशीट", "Document - डॉक्यूमेंट", "Webpage - वेबपेज", "None of above - उपर्युक्त में से कोई नहीं"], 2],
    ["Which of the following is considered as first web browser? / निम्नलिखित में से कौन सा पहला वेब ब्राउजर के रूप में माना जाता है?", ["Nexus - नेक्सस", "Internet Explorer - इंटरनेट एक्सप्लोरर", "Netscape Navigator - नेटस्केप नेविगेटर", "Mosaic - मोजेक"], 0],
    ["The Internet uses..... / इंटरनेट प्रयोग करता है....।", ["Circuit switching - सर्किट स्विचिंग", "Packet switching - पैकेट स्विचिंग", "Hybrid Switching - हाइब्रिड स्विचिंग", "None of the above - इनमें से कोई नहीं"], 1],
    ["The first page of website is known as.. / वेबसाइट का प्रथम पेज जाना जाता है...।", ["Main page - मेन पेज", "Home page - होम पेज", "Both a & b - a तथा b दोनों", "None of above - उपर्युक्त कोई नहीं"], 1],
    ["Who was the father of Internet? / इंटरनेट का जनक किसे कहा गया ?", ["Chares Babbage - चार्ल्स बैबेज", "Vint Cerf - विन्ट सर्फ", "Denis Riche - डेनिस रिच", "Martin Cooper - मार्टिन कूपर"], 1],
    ["The communication protocol used by Internet is / इंटरनेट के द्वारा कम्यूनिकेशन प्रोटोकॉल प्रयोग होता है।", ["HTTP - एचटीटीपी", "TELNET - टेलनेट", "UTP - यूटीपी", "TCP/IP - टीसीपी/आईपी"], 3],
    ["A dial up connection to the internet / इंटरनेट के लिए डायल-अप कनेक्शन", ["There is a connection that is found in most homes. - एक कनेक्शन है जो ज्यादातर घरों में पाया जाता है।", "Allows for fast data exchange between end-points. - एंड-पॉइंट्स के मध्य फास्ट डाटा एक्सचेंज करने की अनुमति देता है।", "A good expert medium that Internet over LAN. - एक अच्छा एक्सपर्ट माध्यम जो लेन से इंटरनेट करता है।", "Both b and c - दोनों b एवं c"], 3],
    ["ISP stands for- / आई.एस.पी. का पूर्ण अर्थ है।", ["Internal Service Provider - इन्टरनल सर्विस प्रोवाइडर", "International service provider - इंटरनेशनल सर्विस प्रोवाइडर", "Internet service Provider - इंटरनेट सर्विस प्रोवाइडर", "Intranet service provider - इंट्रानेट सर्विस प्रोवाइडर"], 2],
    ["Internet is... / इंटरनेट है...", ["Complex System - काम्प्लेक्स सिस्टम", "Decentralized System - डीसेन्ट्रेलाइज्ड सिस्टम", "Dynamic System - डायनेमिक सिस्टम", "All above - उपरोक्त सभी"], 3],
    ["Each computer connected to the internet is called.. / इंटरनेट से कनेक्ट प्रत्येक कम्प्यूटर कहलाता है", ["Client/server - क्लाइंट/सर्वर", "Search engine - सर्च इंजन", "Web browser - वेब ब्राउजर", "None of above - उपर्युक्त में से कोई नहीं"], 0],
    ["Internet has the characteristic...... / इंटरनेट की विशेषता होती है।", ["To streamline corporate communication - कॉरपोरेट कम्युनिकेशन को सुव्यवस्थित करना।", "Cross-platform easement - क्रास-प्लेटफार्म आसान करना", "Establish contact with people within the organization - संस्था के अन्तर्गत ही लोगों तक सम्पर्क स्थापित करना", "All of the above - उपरोक्त सभी"], 3],
    ["A client program used to access the Internet services and resources available through the World Wide Web. / एक क्लाइंट प्रोग्राम जो वर्ल्ड वाइड वेब के थ्रू उपलब्ध रिसोर्स एवं इंटरनेट सर्विस को एक्सेस करता है-", ["ISP - आईएसपी", "Web Browser - वेब ब्राउजर", "Web Server - वेब सर्वर", "None - कोई नहीं"], 1],
    ["A host on the Internet finds another host by its.. / इंटरनेट पर एक होस्ट दूसरे होस्ट को तलाश करता है...", ["From his postal address - उसके पोस्टल एड्रेस से", "From electronic address - इलेक्ट्रॉनिक एड्रेस से", "From IP address - आई० पी० एड्रेस से", "No one - कोई नहीं"], 2],
    ["Internet explorer is a type of? / इंटरनेट एक्सप्लोरर एक प्रकार है-", ["Of Operating System - ऑपरेटिंग सिस्टम का", "Of Compiler - कम्प्लाइर का", "Of IP Address - आईपी ऐड्रेस का", "Of Browser - ब्राउजर का"], 3],
    ["Which of the following is related to internet security? / इनमें से कौन इंटरनेट सुरक्षा से संबंधित है?", ["W3C", "CERT", "MIT", "DSL"], 1],
    ["IP stands for.. / आईपी का पूर्ण अर्थ है।", ["Internet Mass Protocol - इंटरनेट मास प्रोटोकॉल", "Internet Priority Protocol - इंटरनेट प्रायोरिटी प्रोटोकॉल", "Internet Protocol - इंटरनेट प्रोटोकॉल", "Internet Property Protocol - इंटरनेट प्रॉपर्टी प्रोटोकॉल"], 2],
    ["The following is NOT an Internet search engine. / निम्न में से कौन-सा सर्च इंजन नहीं है...।", ["Google - गूगल", "Crawler - क्रावलर", "Excite - एक्ससाइट", "Scientia ans - साइंटिया एंस"], 3],
    ["______ are the two more widely used protocol for LANs. / LAN के लिए व्यापक रूप से प्रयोग होने वाले दो प्रोटोकॉल हैं।", ["TCP/IP and Ethernet - टीसीपी/आईपी और इथरनेट", "ASP/IP and TCP/IP - एएसपी/आईपी और टीसीपी/आईपी", "Token ring and ASP/IP - टोकन रिंग और एएसपी/आईपी", "Ethernet and token ring - इथरनेट और टोकन रिंग"], 3]
  ],
  c7: [
    ['UMANG App ka poora naam kya hai?', ['Unified Mobile Application for New-age Governance', 'Universal Mobile Access Network Governance', 'Unified Master Application Network Guide', 'None of these'], 0],
    ['UMANG App ko kis mantralaya dwara launch kiya gaya hai?', ['Ministry of Home Affairs', 'Ministry of Finance', 'Ministry of Electronics and Information Technology (MeitY)', 'Ministry of Education'], 2],
    ['Digilocker me user ko kitna cloud storage space milta hai?', ['5 GB', '1 GB', '2 GB / 1 GB (Aamtaur par 1GB)', '10 GB'], 1],
    ['Digilocker account banane ke liye kiska hona anivarya hai?', ['Passport', 'PAN Card', 'Voter ID', '[Aadhaar Redacted] aur Mobile Number'], 3],
    ['UPI (Unified Payments Interface) ko kisne viksit (develop) kiya hai?', ['NPCI (National Payments Corporation of India)', 'RBI', 'SBI', 'Ministry of Finance'], 0],
    ['UPI kiske dwara launch kiya gaya tha?', ['Urjit Patel', 'Narendra Modi', 'Nirmala Sitharaman', 'Dr. Raghuram Rajan (RBI Governor ke samay)'], 3],
    ['USSD code (*99#) kisase sambandhit hai?', ['Internet speed check karne ke liye', 'Mobile banking bina internet ke karne ke liye', 'Balance transfer via Wi-Fi', 'None'], 1],
    ['USSD (*99#) service kis network par kaam karti hai?', ['Bluetooth', 'Internet / Wi-Fi', 'GSM / Cellular Network (USSD channels)', 'Satellite only'], 2],
    ['AEPS ka poora naam kya hai?', ['Aadhaar Electronic Payment Service', 'Automatic Enabled Payment System', 'Aadhaar Enabled Payment System', 'None'], 2],
    ['AEPS ke madhyam se transaction karne ke liye kya zaroori hai?', ['UPI PIN', '[Your Aadhaar] number aur Biometric (Fingerprint/Iris)', 'Debit Card Password', 'Credit Card'], 1],
    ['IMPS (Immediate Payment Service) ki mukhya visheshta kya hai?', ['24x7x365 instant fund transfer', 'Sirf banking hours me chalta hai', '2-3 din ka samay lagta hai', 'Sirf weekend par chalta hai'], 0],
    ['NEFT ka settlement kis adhar par hota hai?', ['Monthly basis', 'Real-time (ek-ek karke)', 'Weekly basis', 'Batches (Hourly batches)'], 3],
    ['RTGS ka poora naam kya hai?', ['Rapid Transfer Gross System', 'Real Time Gross Settlement', 'Real Transaction Global Service', 'None'], 1],
    ['RTGS से minimum kitni rashi transfer ki ja sakti hai?', ['2 Lakhs', '1 Lakh', '50,000', 'Koi limit nahi'], 0],
    ['NEFT ki koi minimum limit hai kya?', ['50,000', '10,000', 'Nahi, koi minimum limit nahi hai', '1 Lakh'], 2],
    ['BHIM App ka poora naam kya hai?', ['Banking Help in Mobile', 'Bharat India Money', 'Bharat Instant Money', 'Bharat Interface for Money'], 3],
    ['BHIM app ko kab launch kiya gaya tha?', ['30 December 2016', '15 August 2015', '26 January 2017', '1 January 2018'], 0],
    ['BHIM App me UPI PIN kitne digit ka hota hai?', ['8 digit', 'Sirf 4 digit', 'Sirf 6 digit', '4 ya 6 digit'], 3],
    ['Aadhaar number me kitne digits hote hain?', ['12', '16', '10', '14'], 0],
    ['PAN card me kitne alphanumeric characters hote hain?', ['10', '12', '9', '16'], 0],
    ['IFSC code ke shuru ke 4 characters kya darshate hain?', ['Branch code', 'Bank ka naam (Bank Code)', 'State code', 'Country code'], 1],
    ['IFSC code kitne characters ka hota hai?', ['11', '10', '12', '9'], 0],
    ['IFSC code ka 5th character hamesha kya hota hai?', ['\'A\'', '\'1\'', '\'0\' (Zero)', '\'9\''], 2],
    ['Credit Card par CVV (Card Verification Value) kitne digit ka hota hai?', ['3', '4', '2', '6'], 0],
    ['American Express (Amex) card par CVV/CID kitne digit ka hota hai?', ['4', '3', '5', '6'], 0],
    ['e-Governance ka mukhya uddeshya kya hai?', ['Sirf tax badhana', 'Sarkar ki sevaon ko nagrikon tak saral, transparent aur digital banana', 'Paper ka kharch badhana', 'None'], 1],
    ['G2C (Government to Citizen) e-Governance ka udaharan kya hai?', ['Internal employee mail', 'Government bidding', 'Passport seva, Online bill payment, [Aadhaar Redacted] services', 'None'], 2],
    ['G2B (Government to Business) ka udaharan kaun sa hai?', ['Voter ID card', 'E-Procurement, GST filing, Company registration', 'Ration card', 'None'], 1],
    ['G2G (Government to Government) ka arth kya hai?', ['Sarkar aur company ke beech', 'Sarkar aur janta ke beech', 'Do sarkari vibhago ke beech digital data exchange ya communication', 'None'], 2],
    ['G2E (Government to Employee) e-Governance me kya shamil hai?', ['Public grievance', 'Sarkari karmchariyon ke salary, pension aur service records ka digital management', 'Commercial tax', 'None'], 1],
    ['National Portal of India (india.gov.in) kiska udaharan hai?', ['Social media', 'Private blog', 'E-commerce site', 'Single-window access to Indian Government services (G2C/ Portal)'], 3],
    ['IRCTC kis kshetra se judi e-Governance seva hai?', ['Electricity', 'Flight booking only', 'Bus booking', 'Railway ticket booking aur tourism'], 3],
    ['Jeevan Pramaan Patra kiske liye hai?', ['Income certificate', 'Birth certificate', 'Pensioners ke liye digital life certificate', 'Driving license'], 2],
    ['GeM (Government e-Marketplace) kya hai?', ['Banking portal', 'Private shopping app', 'Social networking', 'Sarkari vibhago dwara samagri (goods/services) ki online kharid ke liye portal'], 3],
    ['mAadhaar app kis dwara jari kiya gaya hai?', ['Income Tax Dept', 'NPCI', 'RBI', 'UIDAI (Unique Identification Authority of India)'], 3],
    ['National Voter Service Portal (NVSP) kisliye upyogi hai?', ['PAN card ke liye', 'Voter ID card ke liye aavedan aur naam sudharne ke liye', 'Passport के लिए', 'Ration card ke liye'], 1],
    ['DigiLocker me documents kis format me verify hote hain?', ['Xerox copy', 'Manual stamp', 'Digital format (URI / Issuer verified XML/PDF)', 'None'], 2],
    ['UPI me VPA ka poora naam kya hai?', ['Verified Payment Account', 'Virtual Payment Address', 'Virtual Personal Access', 'None'], 1],
    ['UPI ID ka format kaisa hota hai?', ['16 digit number', 'ip address format', 'name@bankhandle (e.g., rahul@oksbi)', 'Mobile number only'], 2],
    ['AEPS transaction me customer ka authenticating factor kya hota hai?', ['Credit card number', 'ATM Pin', 'Net banking password', '[Aadhaar Redacted] Number + Biometric Data'], 3],
    ['Bharat Bill Payment System (BBPS) ka mukhya karya kya hai?', ['Share market trading', 'Money transfer', 'Sabhi utility bills (bijli, pani, gas, mobile) ka ek hi platform se online bhugtan', 'Insurance claim'], 2],
    ['RuPay debit card kis sanstha dwara launch kiya gaya hai?', ['NPCI (National Payments Corporation of India)', 'Visa', 'Mastercard', 'American Express'], 0],
    ['RuPay card kis prakar ka payment network hai?', ['US Payment network', 'Indian Domestic Card Payment Network', 'European network', 'Global network only'], 1],
    ['POS (Point of Sale) machine ka upyog kahan hota hai?', ['Computer on karne ke liye', 'Dukano par card se payment lene ya swipe karne ke liye', 'Print nikalne ke liye', 'None'], 1],
    ['Micro ATM kya hota hai?', ['Chhota portable device jo bank mitra ya CSP dwara AEPS/card transactions ke liye use hota hai', 'ATM machine jo choti ho', 'Coin machine', 'None'], 0],
    ['Kisan Credit Card (KCC) yojana kis varsh shuru ki gayi thi?', ['1995', '2005', '2010', '1998-99'], 3],
    ['Pradhan Mantri Jan Dhan Yojana (PMJDY) ki shuruat kab hui thi?', ['January 2014', 'August 2015', 'August 2014', 'May 2014'], 2],
    ['PMJDY ke antargat khulne wale account me kitna overdraft (OD) facility mil sakta hai?', ['Koi OD nahi', '1 Lakh', '50,000', 'Aamtaur par 10,000 tak (pahle 5,000 tha)'], 3],
    ['Atal Pension Yojana (APY) kis umra ke logo ke liye hai?', ['18 se 40 varsh', '21 se 60 varsh', '18 se 60 varsh', 'Koi bhi'], 0],
    ['Pradhan Mantri Jeevan Jyoti Bima Yojana (PMJJBY) ke tahat annual premium kitna hai?', ['Rs. 12 per annum', 'Rs. 436 per annum', 'Rs. 330 per annum', 'Rs. 1000 per annum'], 1],
    ['Pradhan Mantri Suraksha Bima Yojana (PMSBY) ka annual premium kitna hai?', ['Rs. 100 per annum', 'Rs. 12 per annum', 'Rs. 330 per annum', 'Rs. 20 per annum'], 3],
    ['Pradhan Mantri Suraksha Bima Yojana (PMSBY) kis prakar ka bima deta hai?', ['Health Insurance', 'Life Insurance', 'Accidental Death and Disability Insurance', 'Crop Insurance'], 2],
    ['National Cyber Crime Reporting Portal kis mantralaya ke antargat ata hai?', ['Ministry of Finance', 'Ministry of IT', 'Ministry of Home Affairs (MHA)', 'RBI'], 2],
    ['National Scholarship Portal (NSP) kisliye upyogi hai?', ['School admission ke liye', 'Students ke liye various central aur state scholarships ke aavedan ke liye', 'Exam result ke liye', 'None'], 1],
    ['e-NAM (National Agriculture Market) kis kshhetra se juda hai?', ['Krishi mandi (Agricultural markets) ka pan-India electronic trading portal', 'Education market', 'E-commerce retail', 'None'], 0],
    ['Soil Health Card scheme ka mukhya uddeshya kya hai?', ['Tractor dena', 'Loan dena', 'Beej dena', 'Khet ki mitti ki urvarakta (fertility) ki janch karke kisan ko salah dena'], 3],
    ['National Identity Card ke roop me kise manyata prapt hai?', ['Voter ID', 'Pan Card', 'Driving License', '[Aadhaar Redacted] Card'], 3],
    ['[Aadhaar Redacted] biometrics me kya-kya shamil hota hai?', ['Sirf blood group', 'Sirf signature', 'Fingerprints aur Iris scan (aur face photograph)', 'None'], 2],
    ['UPI transaction me money transfer kitne samay me hota hai?', ['24 ghante me', 'Real-time (kuch hi seconds me)', '2 din me', '7 din me'], 1],
    ['UPI 123Pay kisliye launch ki gayi thi?', ['Feature phones (non-smartphone) par UPI payment karne ke liye', 'ATM ke liye', 'International payment ke liye', 'None'], 0],
    ['e-Rupee (e-Rupi) kya hai?', ['Cryptocurrency by RBI', 'Cashless aur contact-less digital payment instrument (Prepaid voucher based on QR/SMS code)', 'Normal UPI app', 'None'], 1],
    ['e-Rupi ko kisne launch kiya gaya tha?', ['Reserve Bank of India (RBI) / NPCI ke sahyog se', 'SBI', 'World Bank', 'Microsoft'], 0],
    ['Central Bank Digital Currency (CBDC) ya Digital Rupee kya hai?', ['Private token', 'Bitcoin jaisi cryptocurrency', 'RBI dwara jari ki gayi legal tender digital currency', 'None'], 2],
    ['DigiLocker me issued documents ka kya status hota hai?', ['Valueless hain', 'Sirf copy maane jate hain', 'IT Act 2000 ke tahat original physical documents ke barabar legal validity hoti hai', 'None'], 2],
    ['Passport seva project kiska udaharan hai?', ['Private project', 'Mission Mode Project (MMP) under e-Governance', 'Banking project', 'None'], 1],
    ['E-District project ka kya uddeshya hai?', ['Zila star par citizen services (jaise caste, income, domicile certificates) online dena', 'Zila me computer bechna', 'Road banana', 'None'], 0],
    ['CSC (Common Service Centre) ka kya karya hai?', ['Bank chalana', 'Sirf computer sikhana', 'Gramin aur shhari kshetro me digital sevaon (digital services) ko aam janta tak pahuchana', 'None'], 2],
    ['National e-Governance Plan (NeGP) kab approve hua tha?', ['March 2000', 'January 2010', 'August 2014', 'May 2006'], 3],
    ['Jeevan Pramaan portal ka labh kisko milta hai?', ['Businessmen ko', 'Students ko', 'Farmers ko', 'Pensioners ko (lifecertificate dene ke liye)'], 3],
    ['National Judicial Data Grid (NJDG) kis se juda hai?', ['Police database', 'Adalato (Courts) ke mukadmo aur unke status ka digital data grid', 'Land records', 'Bank loans'], 1],
    ['B2C e-Commerce ka udaharan kya hai?', ['Amazon, Flipkart se saman kharidna', 'Wholesaler se manufacturer ko bechna', 'OLX par bechna', 'None'], 0],
    ['C2B e-Commerce ka kya arth hai?', ['Business to consumer', 'Consumer apni services ya product business ko bechte hain (jaise freelance work)', 'Government to citizen', 'None'], 1],
    ['B2B e-Commerce me kya hota hai?', ['Ek business se dusre business ke beech len-den', 'Customer se customer', 'Sarkar se janta', 'None'], 0],
    ['E-Governance ki sabse pehli sthar ya paaydan (pillar) kise mana jata hai?', ['Online shopping', 'Direct voting', 'Information sharing / Connectivity aur infrastructure', 'None'], 2],
    ['UPI me maximum transaction limit per day aamtaur par kitni hoti hai?', ['Unlimited', 'Rs. 10,000', 'Rs. 50,000', 'Rs. 1 Lakh (kuch categories jaise IPO/hospital/education me jyada bhi hoti hai)'], 3],
    ['IMPS me fund transfer karne ke liye kya zaroori hota hai?', ['Sirf Aadhaar', 'Beneficiary ka Account Number aur IFSC Code (ya MMID)', 'Sirf Mobile number', 'None'], 1],
    ['MMID (Mobile Money Identifier) kitne digit ka hota hai?', ['12 digits', '4 digits', '11 digits', '7 digits'], 3],
    ['NEFT system kiske dwara operate kiya jata hai?', ['Ministry of Finance', 'SBI', 'NPCI', 'Reserve Bank of India (RBI)'], 3],
    ['RTGS system bhi kiske dwara operate hota hai?', ['NPCI', 'Commercial banks', 'Reserve Bank of India (RBI)', 'NABARD'], 2],
    ['Credit card aur Debit card me mukhya antar kya hai?', ['Debit card me apne khate ke paise use hote hain, Credit card me bank se loan/credit limit milti hai', 'Dono ekdam same hain', 'Debit card me udhar milta hai', 'None'], 0],
    ['Smart Card kya hota hai?', ['Aisa card jisme microchip embedded hoti hai data store karne ke liye', 'Sirf plastic card bina chip ke', 'Paper card', 'None'], 0],
    ['OTP (One Time Password) ka upyog kiska udaharan hai?', ['Storage ke liye', 'Speed badhane ke liye', 'Two-factor authentication (2FA) / Security ke liye', 'None'], 2],
    ['Biometric authentication kis par adharit hota hai?', ['ATM PIN par', 'Password par', 'OTP par', 'Unique physical characteristics (Fingerprint, Iris, Face) par'], 3],
    ['E-Sign service ka kya upyog hai?', ['Email bhejna', 'Electronic documents par [Aadhaar Redacted]-based e-KYC ke madhyam se digital signature karna', 'Scan karna', 'None'], 1],
    ['National Optical Fiber Network (NOFN) / BharatNet ka mukhya uddeshya kya hai?', ['Railway station par Wi-Fi', 'Mobile tower lagana', 'Desh ki sabhi gram panchayato ko high-speed broadband internet connectivity dena', 'None'], 2],
    ['e-Challan system kis kshetra me upyogi hai?', ['Court case ke liye', 'Traffic rules violation par digital fine/challan katne aur bharne ke liye', 'Electricity bill ke liye', 'None'], 1],
    ['Tele-Law service ka mukhya uddeshya kya hai?', ['Gramin kshetron ke logo ko video conferencing ke zariye kanooni salah (legal advice) dilwana', 'Online court trial', 'Police FIR online', 'None'], 0],
    ['DigiLocker kis ministry ke antargat ata hai?', ['Ministry of Education', 'Ministry of Finance', 'Ministry of Home Affairs', 'MeitY (Ministry of Electronics and Information Technology)'], 3],
    ['UPI Lite kisliye design kiya gaya hai?', ['International transfer', 'Bade loan ke liye', 'Chote value ke offline/instant transactions ke liye bina PIN ke (on-device wallet)', 'None'], 2],
    ['UPI AutoPay ka kya upyog hai?', ['Auto call karna', 'Recurring payments (jaise monthly subscription, bills, SIP) ke liye automatic debit set karna', 'Auto reply email', 'None'], 1],
    ['Cyber Swachhta Kendra (Botnet Cleaning and Malware Analysis Centre) kiska initiative hai?', ['UIDAI', 'RBI', 'NPCI', 'CERT-In (Indian Computer Emergency Response Team)'], 3],
    ['BHIM app kitni bhashao (languages) ko support karta hai?', ['20 se adhik regional languages ko', 'Sirf English', 'Sirf Hindi aur English', '5 languages'], 0],
    ['National Payment Corporation of India (NPCI) ki sthapna kis varsh hui thi?', ['2008', '2010', '2014', '2016'], 0],
    ['NPCI kiske margdarshan me sthapit ki gayi thi?', ['Ministry of Finance', 'SEBI', 'RBI aur Indian Banks\' Association (IBA)', 'SBI'], 2],
    ['Mobile Wallet (jaise Paytm, PhonePe wallet) kis prakar ke license ke antargat aate hain?', ['Banking license', 'PPI (Prepaid Payment Instruments) license by RBI', 'Telecom license', 'None'], 1],
    ['[Aadhaar Redacted] Biometric Locking ki suvidha kyon di jati hai?', ['Aadhaar card cancel karne ke liye', 'Security badhane ke liye taki bina permission ke koi biometric use na kar sake', 'Number badalne ke liye', 'None'], 1],
    ['Virtual ID (VID) [Aadhaar Redacted] me kitne digit ki hoti hai?', ['8 digits', '12 digits', '10 digits', '16 digits'], 3],
    ['[Aadhaar Redacted] Letter ya PVC card par diya gaya QR code kisliye hota hai?', ['Game khelne ke liye', 'Payment ke liye', 'Quick offline verification aur demographic details ke liye', 'None'], 2],
    ['e-Governance me "SMART" governance ka kya arth hai?', ['Simple, Moral, Accountable, Responsive, and Transparent', 'Speed, Mobile, Advanced, Reliable, Technical', 'System, Machine, Auto, Routine, Tool', 'None'], 0],
    ['National e-Governance Division (NeGD) ki sthapna kab ki gayi thi?', ['2009', '2006', '2012', '2015'], 0],
    ["In which year was the first email sent? / किस वर्ष पहला ईमेल भेजा गया था..........", ["1982", "1992", "1977", "1971"], 3],
    ["With the email we can attach the file / ईमेल के साथ हम.......फाइल संलग्न कर सकते हैं", ["Not more than one - एक से अधिक नहीं", "Not more than two - दो से अधिक नहीं", "one - एक", "None of these - इनमें से कोई नहीं"], 3],
    ["Which of the following protocols is used by internet mail? / निम्नलिखित में कौन सा प्रोटोकॉल इंटरनेट मेल के लिए इस्तेमाल किया जाता है?", ["HTTP - एचटीटीपी", "TCP/IP - टीसीपी/आईपी", "FTP - एफटीपी", "None of these - इनमें से कोई नहीं"], 0],
    ["Which of the following is not an e-mail server. / निम्नलिखित में से कौन एक ई-मेल सर्वर नहीं हैं।", ["Rediff mail", "Outlook", "Both a & b", "Linkden"], 3],
    ["A valid e-mail address is. / एक वैध ई-मेल का पता है।", ["Vml@india.com", "@vrm@india.com", "Vrm.india.com", "vrm@india.com"], 3],
    ["The domain name in an URL refers to the - / यूआरएल में डोमेन नाम को संदर्भित करता है", ["protocol - प्रोटोकॉल", "server - सर्वर", "filename - फाइल नेम", "directory - डायरेक्टरी"], 1],
    ["E-mail component of Internet Explorer is called. / इंटरनेट एक्सप्लोरर के ईमेल कम्पोनेन्ट को कहा जाता है", ["Message box - मैसेज बॉक्स", "Outlook Express - आउटलुक एक्सप्रेस", "Messenger Mailbox - मैसेंजर मेलबॉक्स", "None of the above उपयुक्त में से कोई नहीं"], 1],
    ["The convenient place to store contact information for quick retrieval is..... / कान्टैक्ट इनफॉर्मेशन स्टोर करने के लिए सुविधाजनक स्थान जहाँ इनफॉर्मेशन जल्दी से निकाला जा सके है", ["Address box - एड्रेस बॉक्स", "Message box - मैसेज बॉक्स", "Address book - एड्रेस बुक", "None of the above - इनमें से कोई नहीं"], 2],
    [".......is the exchange of computer stored messages by telecommunication. / टेलीकम्यूनिकेशन द्वारा कम्प्यूटर द्वारा संग्रहीत संदेशों का आदान-प्रदान।", ["E-Web", "E-mail", "E-net", "E-chart"], 1],
    ["What does the following emotion display? / निम्नलिखित इमोरन क्या प्रदर्शित करती है?", ["Confused face - कम्फ्यूज्ड फेस", "Happy face - हैपी फेस", "Shocked face - शाक्ड फेस", "Amazed face - अमेज़्ड फेस"], 1],
    ["A simple protocol used for fetching e-mail from a mailbox is.. / मेलबॉक्स से ई-मेल लाने के लिए उपयोग किए जाने वाला एक सिंपल प्रोटोकॉल है..", ["POP2", "POP3", "imap", "None of these - इनमें से कोई नहीं"], 1],
    ["Which of these should be avoided in an E-mail? / ई-मेल में किसकी एडवाईस करने से बचना चाहिए?", ["Wrong E-mail address", "Subject line - सब्जेक्ट लाइन", "Smileys - स्माइल", "Re-reading - री-रीडिंग"], 0],
    ["Messenger Mailbox is present in..... / मैसेंजर मेलबॉक्स मौजूद होता है......", ["Internet Explorer - इंटरनेट एक्सप्लोरर", "Netscape Communicator - नेटस्केप कम्युनिकेटर", "Both a and b - a तथा b दोनों", "None of the above - उपर्युक्त में से कोई नहीं"], 1],
    ["E-mail message can be protected by / ई-मेल संदेश को प्रोटेक्ट किया जा सकता है", ["Mirroring", "Caching", "Encryption", "Resending"], 2],
    ["IRC stands for.... / IRC का पूर्ण अर्थ है।", ["Internet Resource Channel - इंटरनेट रिसोर्स चैनल", "Internet Routing Channel - इंटरनेट राउटिंग चैनल", "Internet Rights Council - इंटरनेट राइट्स काउंसिल", "Internet Relay Chat - इंटरनेट रीले चैट"], 3],
    ["Which of these do not provide free E-mail? / इनमें से कौन सा मुफत ई-मेल प्रदान नहीं करता है?", ["Hotmail", "Rediff", "WhatsApp", "Yahoo"], 2],
    ["Which of these is the easiest way of communication? / इनमें से कौन सा संचार का सबसे आसान तरीका है?", ["E-mail", "Telephone", "Fax", "Letter"], 0],
    ["SMTP is associated with... / एसएमटीपी के साथ जुड़ा हुआ है।", ["TCP/IP - टीसीपी/आईपी", "Electronic Mail - इलेक्ट्रॉनिक मेल", "Internet Explorer - इंटरनेट एक्सप्लोरर", "WWW - डब्ल्यू डब्ल्यू डब्ल्यू"], 1],
    ["Indicates copies of the message were sent to additional people. The recipient does not know the message has been sent to others. / संदेश की प्रतियों को अतिरिक्त लोगों को भेजा गया था। प्राप्तकर्ता को पता नहीं है कि संदेश दूसरों को भेजा गया है।", ["URL - यूआरएल", "Cc - सीसी", "End - इंड", "Bcc - बीसीसी"], 3],
    ["What is the term used for talking on net with the help of typed text? / टाइप किए गए टेक्स्ट की मदद से नेट पर बात करने के लिए किस शब्द का उपयोग किया जाता है", ["New group", "E-mail", "Chatting", "None"], 2],
    ["If an email is received by an unknown person then / यदि किसी अज्ञात व्यक्ति द्वारा ईमेल प्राप्त किया जाता है", ["One should open it and responding asking their personal information. - एक को इसे खोलना चाहिए और व्यक्तिगत जानकारी के बारे में पूछना चाहिए।", "One should open it and responding saying you don't know them. - किसी को इसे खोलना चाहिए और यह कहना चाहिए कि आप उन्हें नहीं जानते", "It should be deleted without opening - इसे बिना खोले डिलीट कर देना चाहिए", "It should be forwarded to police - इसे पुलिस को भेज दिया जाना चाहिए"], 2],
    ["In email address, the symbol that is used to separate the user name with the ISP address is.. / ईमेल पते में, आईएसपी पते के साथ उपयोगकर्ता नाम को अलग करने के लिए उपयोग किया जाने वाला प्रतीक है।", ["#", "&", "@", "%"], 2],
    ["MIME stands for.... / MIME का पूर्ण अर्थ है।", ["Multipurpose Internet Extension - मल्टीपर्पस इंटरनेट एक्सटेंशन", "Multiple internet Mail Extension - मल्टीपल इंटरनेट मेल एक्सटेंशन", "Multiple international Mail Extension - मल्टीपल इंटरनेशनल मेल एक्सटेंशन", "None of these - इनमें से कोई नहीं"], 0],
    ["E-mail address is made up of...... / एक ई-मेल एड्रेस बना होता है।", ["In First part", "In two parts", "In Third Part", "None"], 1],
    ["The Internet standard is.. / इंटरनेट स्टैण्डर्ड है।", ["MIME", "BIN HEX", "UNENCODING", "None25"], 0]
  ],
  c8: [
    ['Industry 4.0 (Fourth Industrial Revolution) ka mukhya adhar kya hai?', ['Sirf manual labor', 'Cyber-Physical Systems, AI, IoT, aur Cloud Computing', 'Steam engines aur electricity', 'Mainframe computers'], 1],
    ['Artificial Intelligence (AI) ke pita (Father) kise kaha jata hai?', ['Geoffrey Hinton', 'Alan Turing', 'Marvin Minsky', 'John McCarthy'], 3],
    ['Turing Test kiske liye design kiya gaya tha?', ['Internet speed check karne ke liye', 'Computer ki speed napne ke liye', 'Kisi machine ki intelligent behavior (human-like thinking) ko parakhne ke liye', 'Virus detect karne ke liye'], 2],
    ['Machine Learning (ML) kiska ek subfield hai?', ['Artificial Intelligence (AI)', 'Data Science', 'Computer Networking', 'Cyber Security'], 0],
    ['Cloud Computing me SaaS ka poora naam kya hai?', ['Security as a Service', 'System and Application Software', 'Storage as a Service', 'Software as a Service'], 3],
    ['Cloud Computing me PaaS ka poora naam kya hai?', ['Platform as a Service', 'Program as a Service', 'Public and Access System', 'None'], 0],
    ['Cloud Computing me IaaS ka poora naam kya hai?', ['Internet and Application Service', 'Infrastructure as a Service', 'Integrated Access System', 'None'], 1],
    ['Big Data ki \'3 Vs\' properties me kya-kya shamil hai?', ['Voice, Video, Visual', 'Value, Validity, Vision', 'Volume, Velocity, Variety', 'None'], 2],
    ['Internet of Things (IoT) me sabse mukhya bhumika kiski hoti hai?', ['Sensors aur Actuators ki', 'Sirf keyboards ki', 'Heavy printers ki', 'None'], 0],
    ['Blockchain technology mukhya roop se kiske liye famous hai?', ['Fast printing ke liye', 'Video streaming ke liye', 'Decentralized, secure, aur tamper-proof distributed ledger (jaise Cryptocurrency me)', 'Virus banane ke liye'], 2],
    ['Robotic Process Automation (RPA) ka kya upyog hai?', ['Factory me physical robot se saman uthwana', 'Repetitive aur rule-based digital tasks ko software bots ke zariye automate karna', 'Typing test lena', 'None'], 1],
    ['3D Printing ka dusra naam kya hai?', ['Manual crafting', 'Subtractive Manufacturing', 'Photocopying', 'Additive Manufacturing'], 3],
    ['Virtual Reality (VR) aur Augmented Reality (AR) me mukhya antar kya hai?', ['VR poori tarah se simulated digital environment banata hai, AR real world ke upar digital elements overlay karta hai', 'Dono ekdam same hain', 'AR me headset zaroori hai, VR me nahi', 'None'], 0],
    ['Big Data me \'Velocity\' shabd ka kya arth hai?', ['Data ke prakar (types)', 'Data ka aakar (size)', 'Data ke aane aur process hone ki raftar (speed)', 'Data ki cost'], 2],
    ['Big Data me \'Volume\' ka kya arth hai?', ['Sound volume', 'Extremely large amount of data (bada data size)', 'Storage speed', 'None'], 1],
    ['Big Data me \'Variety\' ka kya arth hai?', ['Color variety', 'Alag-alag tarike ka data (Structured, Semi-structured, Unstructured)', 'Network types', 'None'], 1],
    ['Cryptography kisse sambandhit hai?', ['Internet speed badhana', 'Data delete karna', 'Data ko secret code me badalkar surakshit rakhna (Encryption/Decryption)', 'None'], 2],
    ['Plaintext ko ciphertext me badalne ki kriya ko kya kehte hain?', ['Compression', 'Decryption', 'Hashing', 'Encryption'], 3],
    ['Ciphertext ko wapas readable plaintext me badalne ko kya kehte hain?', ['Decryption', 'Encryption', 'Formatting', 'Decoding'], 0],
    ['Symmetric Encryption me kya hota hai?', ['Encryption aur Decryption dono ke liye ek hi (same) secret key ka prayog hota hai', 'Alag-alag keys hoti hain', 'Koi key nahi hoti', 'None'], 0],
    ['Asymmetric Encryption me kitni keys use hoti hain?', ['Koi key nahi', 'Sirf ek key', 'Teen keys', 'Do keys (Public Key aur Private Key)'], 3],
    ['Firewall ka mukhya karya network security me kya hai?', ['Hard disk format karna', 'Virus clean karna', 'Incoming aur outgoing network traffic ko monitor karke rules ke adhar par allow ya block karna', 'None'], 2],
    ['Malware ka poora naam kya hai?', ['Manual Software', 'Malicious Software', 'Machineware', 'Multimedia Software'], 1],
    ['Ransomware kis prakar ka attack hai?', ['Jo user ki files ko lock/encrypt karke firauti (ransom) maangta hai', 'Sirf email spam karna', 'Password chori karna bina lock kiye', 'None'], 0],
    ['Phishing attack aamtaur par kis madhyam se kiya jata hai?', ['Bluetooth se', 'Direct physical attack', 'Fake emails aur fraudulent messages ke zariye', 'None'], 2],
    ['Vishing kya hoti hai?', ['Video phishing', 'Voice call ya phone ke zariye ki jane wali phishing (fraud)', 'SMS phishing', 'None'], 1],
    ['Smishing kya hoti hai?', ['Social media phishing', 'SMS (Text message) ke zariye ki jane wali phishing', 'Voice phishing', 'None'], 1],
    ['Spoofing ka kya arth hai?', ['File delete karna', 'Computer fast karna', 'Khud ko koi aur vishwasniya vyakti ya system dikhakar dhokha dena (Caller ID spoofing, IP spoofing)', 'None'], 2],
    ['Man-in-the-Middle (MitM) attack me kya hota hai?', ['Attacker do communicating parties ke beech ke connection ko secretly sunta ya badal deta hai', 'Computer physical tor par todna', 'Password bhul jana', 'None'], 0],
    ['DDoS (Distributed Denial of Service) attack ka mukhya uddeshya kya hota hai?', ['Server ya website par itna fake traffic bhejkar use down ya inaccessible kar dena', 'Data chori karna', 'Password badalna', 'None'], 0],
    ['Zero-Day Vulnerability kya hoti hai?', ['Free software', '0 din purana virus', 'Aisi software security flaw jiske baare me vendor ya developer ko pehle se pata nahi hota aur na hi patch hota hai', 'None'], 2],
    ['Antivirus software kis par kaam karta hai?', ['Internet speed badhane ke liye', 'Known signatures aur heuristics ke adhar par malware ko detect aur remove karne ke liye', 'Games chalane ke liye', 'None'], 1],
    ['Two-Factor Authentication (2FA) me kya hota hai?', ['Login ke liye do alag-alag verification factors (jaise Password + OTP) ki aavashyakta hoti hai', 'Do password dalne padte hain', 'Do computers use hote hain', 'None'], 0],
    ['Biometric security kiske antargat aati hai?', ['Something you have', 'Something you know', 'Something you are (apki sharirik visheshta)', 'None'], 2],
    ['Password kis security category me ata hai?', ['Something you have', 'Something you know', 'Something you are', 'None'], 1],
    ['ATM Card ya Smart Card kis security category me ata hai?', ['Something you are', 'Something you know', 'Something you have', 'None'], 2],
    ['Cyber Security me CIA triad ka poora naam kya hai?', ['Control Internet Authority', 'Computer Internet Access', 'Central Intelligence Agency', 'Confidentiality, Integrity, Availability'], 3],
    ['CIA triad me \'Confidentiality\' ka kya arth hai?', ['Data ko keval authorized logo tak hi simit rakhna (unauthorized access se bachana)', 'Data ko hamesha accessible rakhna', 'Data me badlav na hone dena', 'None'], 0],
    ['CIA triad me \'Integrity\' ka kya arth hai?', ['Data ko chupana', 'Data ki shuddhata aur satyata banaye rakhna taki usme bina anumasati ke koi badlav na kar sake', 'Fast network', 'None'], 1],
    ['CIA triad me \'Availability\' ka kya arth hai?', ['Encrypt karna', 'Data delete karna', 'Authorized users ke liye data aur systems hamesha samay par uplabdh (accessible) rehna', 'None'], 2],
    ['IoT devices me security sabse bada chinta ka vishay kyu hai?', ['Kyunki wo bohot bade hote hain', 'Kyunki unme resources (processing/memory) kam hote hain aur weak default passwords hote hain', 'Kyunki wo internet par nahi chalte', 'None'], 1],
    ['Edge Computing kya hoti hai?', ['Data ko cloud par bhejne ke bajaye source ya device ke nazdeek (edge par) process karna', 'Internet band karna', 'Screen ke kinare par kaam karna', 'None'], 0],
    ['Fog Computing kiske sabse kareeb hoti hai?', ['Printer', 'Hard disk', 'Keyboard', 'Edge computing aur cloud computing ke beech ki layer'], 3],
    ['Deep Learning kiska advanced roop hai?', ['Neural Networks (Artificial Neural Networks) / Machine Learning ka', 'Simple database ka', 'HTML coding ka', 'None'], 0],
    ['Natural Language Processing (NLP) kisse sambandhit hai?', ['Cable networking', 'Image processing', 'Computers ko manushya ki bhasha (boli ya likhi gayi bhasha) ko samajhne aur prsut karne me saksham banana', 'None'], 2],
    ['Computer Vision ka mukhya karya kya hai?', ['Text padhna', 'Computers ko digital images aur videos se visual information samajhne ki kshamta dena', 'Sound record karna', 'None'], 1],
    ['Augmented Reality (AR) ka ek prasiddh udaharan kaun sa hai?', ['Complete VR headset simulation', 'Pokémon GO game ya live filters', 'Normal text editor', 'None'], 1],
    ['Public Cloud ka udaharan kaun sa hai?', ['Office ka local server', 'Personal hard drive', 'Microsoft Azure, Amazon Web Services (AWS), Google Cloud', 'None'], 2],
    ['Private Cloud kya hota hai?', ['Aisa cloud infrastructure jo sirf ek hi organization ke liye dedicatedly use hota hai', 'Jo sabhi ke liye khula ho', 'Free internet storage', 'None'], 0],
    ['Hybrid Cloud me kya hota hai?', ['Public aur Private cloud ka combination (dono ka mishran)', 'Sirf offline storage', 'Sirf local network', 'None'], 0],
    ['Digital Signature kis par adharit hota hai?', ['Simple password par', 'Public Key Cryptography par', 'Manual signature scan par', 'None'], 1],
    ['Stuxnet kya tha?', ['Web browser', 'Ek achha antivirus', 'Ek operating system', 'Ek famous malicious worm jo industrial control systems (SCADA) ko target karne ke liye banaya gaya tha'], 3],
    ['Keylogger kya hai?', ['Password generator', 'Keyboard theek karne wala tool', 'Aisa software ya hardware jo keyboard par type kiye gaye har ek shabd ko record karta hai', 'None'], 2],
    ['Rootkit kya hota hai?', ['Plant root grow karne ka tool', 'Ek stealthy malware jo system me administrator (root) level ka access chupakar prapt karta hai', 'Antivirus', 'None'], 1],
    ['Botnet kya hota hai?', ['Chatting group', 'Robot network', 'Infected computers (bots) ka ek network jise hacker remote control se operate karta hai', 'None'], 2],
    ['Social Engineering in Cyber Security ka kya arth hai?', ['Logo ko manipulate karke ya unka vishwas jeetkar confidential jankari (password/OTP) nikalwana', 'Social media par post karna', 'Coding sikhana', 'None'], 0],
    ['Shoulder Surfing kya hoti hai?', ['Beach par ghumna', 'Surfing karna net par', 'Kisi vyakti ke peeche khade hokar uska password ya PIN dekhte rehna (chupkar)', 'None'], 2],
    ['Dumpster Diving ka kya arth hai?', ['Kisi ke kachre (dustbin) se purane documents, bills ya passwords ki slip dhoond kar jankari nikalna', 'Swimming pool me diving', 'Data recovery', 'None'], 0],
    ['Hackers me "White Hat" hackers kaun hote hain?', ['Cyber criminal jo nuksan pahuchate hain', 'Ethical hackers jo security test karne ke liye system me legally penetration karte hain', 'Jo computer nahi chalate', 'None'], 1],
    ['Hackers me "Black Hat" hackers kaun hote hain?', ['Cyber criminals jo galat uddeshya se system hack karte hain aur nuksan pahuchate hain', 'Security guards', 'Government officials', 'None'], 0],
    ['Hackers me "Grey Hat" hackers kaun hote hain?', ['Sirf official workers', 'Jo bina permission ke system hack karke kammiyan dhoondte hain par nuksan nahi pahuchate (bad me bata dete hain)', 'Beginners', 'None'], 1],
    ['IoT me RFID ka poora naam kya hai?', ['Radio Field Integration', 'Rapid Frequency Identification Data', 'Radio Frequency Identification', 'None'], 2],
    ['Smart Grid kisse juda hua hai?', ['Water supply', 'Electricity supply network jo digital communication aur IoT sensors ka upyog karta hai', 'Road traffic', 'None'], 1],
    ['AI me Expert Systems kis par adharit hote hain?', ['Simple text file par', 'Random guessing par', 'IF-THEN rules aur Knowledge Base par', 'None'], 2],
    ['Cloud storage me data backup ka sabse bada fayda kya hai?', ['Kisi bhi sthan se aur kisi bhi device se data ko access kiya ja sakta hai aur hardware kharab hone par bhi data safe rehta hai', 'Internet ki zaroorat nahi padti', 'Storage free hoti hai', 'None'], 0],
    ['SSL Certificate ka upyog website par kyu hota hai?', ['Design sundar banane ke liye', 'Website ki speed badhane ke liye', 'Browser aur web server ke beech secure, encrypted connection establish karne ke liye (HTTPS)', 'None'], 2],
    ['Cryptographic Hashing function ki mukhya visheshta kya hoti hai?', ['Yeh one-way process hoti hai (ciphertext/hash se original data wapas nahi banaya ja sakta)', 'Ye do-way hoti hai', 'Ye encryption jaisi hoti hai', 'None'], 0],
    ['MD5 aur SHA-256 kiske udaharan hain?', ['Operating systems ke', 'Antivirus ke', 'Web browsers ke', 'Cryptographic Hash Functions ke'], 3],
    ['Smart City concept me kiska prayog hota hai?', ['Sirf building banane ke liye', 'IoT, AI, Big Data aur sensors ka nagrikon ki suvidha aur management ke liye', 'Jungle lagane ke liye', 'None'], 1],
    ['Autonomous Vehicles (Driverless Cars) me kis technology ka mukhya upyog hota hai?', ['AI, Computer Vision, Sensors, aur Machine Learning ka', 'Sirf manual steering ka', 'Steam power ka', 'None'], 0],
    ['Data Analytics ka kya arth hai?', ['Data type karna', 'Data delete karna', 'Raw data ko analyze karke useful insights aur conclusions nikalna', 'None'], 2],
    ['IoT network me Gateway ka kya karya hai?', ['Electricity dena', 'IoT devices aur Cloud/Server ke beech bridge ya translator ka kaam karna', 'Battery charge karna', 'None'], 1],
    ['Cyber Bullying kya hoti hai?', ['Game khelna', 'Online shopping karna', 'Internet ya digital devices ke madhyam se kisi ko pareshan, threaten ya harass karna', 'None'], 2],
    ['Cyber Stalking ka kya arth hai?', ['Online walk karna', 'Internet par kisi vyakti ki online gatividhiyon par chupchap najar rakhna aur use harass karna', 'Shopping karna', 'None'], 1],
    ['Copyright infringement kya hai?', ['Kisi ki original creative work (jaise software, book, art) ko bina permission ke use ya copy karna', 'Computer virus banana', 'Internet band karna', 'None'], 0],
    ['Plagiarism ka kya arth hai?', ['Computer hack karna', 'Kisi aur ke likhe huye text ya vicharon ko apna bata kar pesh karna bina credit diye', 'File download karna', 'None'], 1],
    ['Open Source Software kya hota hai?', ['Jiska code chupaya gaya ho', 'Jo sirf paise dekar mile', 'Aisa software jiska source code sabhi ke liye free me uplabdh hota hai aur jisme badlav kiya ja sakta hai', 'None'], 2],
    ['Proprietary Software kya hota hai?', ['Aisa software jiska source code band hota hai aur copyright ke antargat surakshit hota hai (jaise MS Windows)', 'Free open source software', 'Virus', 'None'], 0],
    ['IoT me Actuator ka kya karya hota hai?', ['Sirf data read karna', 'Control signal ke adhar par physical action ya movement perform karna (jaise motor chalana, valve kholna)', 'Data store karna', 'None'], 1],
    ['IoT me Sensor ka kya karya hota hai?', ['Print nikalna', 'Action perform karna', 'Vatavaran (environment) se physical data (jaise temperature, light, motion) ko collect karna', 'None'], 2],
    ['Cloud Computing me elasticity ka kya arth hai?', ['Resource capacity ko zaroorat ke anusar automatically ghata ya badha sakne ki kshamta', 'Hardware ko kheech kar bada karna', 'Internet speed badhana', 'None'], 0],
    ['Deepfake technology kis par adharit hoti hai?', ['Simple audio recording par', 'Normal photo crop karne par', 'AI aur Deep Learning (Generative Adversarial Networks - GANs) par kisi ki bhi fake video/audio banane ke liye', 'None'], 2],
    ['AI ke vikas me Neural Network ki sanrachna kisase prerit hai?', ['Manushya ke dimaag ke biological neural system (neurons) se', 'Computer ke motherboard se', 'Telephone wire se', 'None'], 0],
    ['Supervised Learning (Machine Learning me) kya hoti hai?', ['Bina teacher ke sikhna', 'Jahan model ko labeled data (input ke sath correct output) ke madhyam se train kiya jata hai', 'Random data process karna', 'None'], 1],
    ['Unsupervised Learning me kya hota hai?', ['Manual coding karna', 'Labeled data dena', 'Jahan model ko unlabeled data diya jata hai aur wo khud patterns ya grouping dhoondta hai', 'None'], 2],
    ['Reinforcement Learning kisme upyogi hai?', ['Trial and error method ke dwara reward ya penalty ke adhar par sikhne me (jaise gaming ya robotics)', 'Sirf data entry me', 'Word processing me', 'None'], 0],
    ['Big Data me \'Veracity\' shabd ka kya arth hai?', ['Data ka aakar', 'Data ki quality, reliability aur trustworthiness (vishwasniyata)', 'Data ki speed', 'None'], 1],
    ['Big Data me \'Value\' ka kya arth hai?', ['Process kiye gaye data se kitni upyogi business value ya arth nikal raha hai', 'Data ki kimat (paisa)', 'File size', 'None'], 0],
    ['Cyber Security audit ka mukhya uddeshya kya hota hai?', ['Software install karna', 'Computer bechna', 'Organization ke IT systems aur security policies ka evaluation karke kammiyan dhoondna', 'None'], 2],
    ['Penetration Testing (Pen Test) kya hoti hai?', ['Real hack karke nuksan pahuchana', 'System ki security ko check karne ke liye authorized tarike se us par simulated cyber attack karna', 'Internet speed check karna', 'None'], 1],
    ['Honey Pot kya hota hai cyber security me?', ['Madhu makhi ka chhatta', 'Ek decoy (dhokha dene wala) system ya network resource jo hackers ko attract karne aur unke attack ko monitor karne ke liye banaya jata hai', 'Sweet software', 'None'], 1],
    ['Biometric system me False Acceptance Rate (FAR) ka kya arth hai?', ['Machine ki speed', 'Sahi vyakti ko reject karne ki rate', 'Galat vyakti (unauthorized person) ko authorized maan lene ki sambhavna', 'None'], 2],
    ['Biometric system me False Rejection Rate (FRR) ka kya arth hai?', ['Speed limit', 'Galat vyakti ko accept karna', 'None', 'Sahi vyakti (authorized person) ko system dwara galat tarike se reject kar dena'], 3],
    ['Secure Coding practices ka mukhya uddeshya kya hota hai?', ['Software me security vulnerabilities (bugs) ko shuru se hi rokna taki hacker uska fayda na utha sakein', 'Code lamba likhna', 'Sirf design sudharna', 'None'], 0],
    ['Cloud Computing me Multi-tenancy ka kya arth hai?', ['Network failure', 'Ek hi user ka kai computer use karna', 'None', 'Ek hi physical hardware/infrastructure par multiple independent customers (tenants) ka data securely share hona'], 3],
    ['Fog Computing term sabse pehle kis company ne introduce ki thi?', ['IBM ne', 'Microsoft ne', 'Google ne', 'Cisco Systems ne'], 3],
    ['AI me Chatbot ka udaharan kaun sa hai?', ['MS Paint', 'ChatGPT, Gemini, Alexa, Siri', 'Notepad', 'VLC Player'], 1],
    ['Blockchain me har ek block me kya hota hai?', ['Normal text', 'Sirf ek password', 'Transactions ka data, timestamp, aur pichle block ka cryptographic hash (pointer)', 'None'], 2],
    ['Cyber Security ke sandarbh me \'Patch\' kya hota hai?', ['Software ki kisi security vulnerability ya bug ko thik karne ke liye chhota update ya code fix', 'Kapde ka tukda', 'Virus', 'None'], 0],
    ['National Cyber Security Policy (India) kis varsh jari ki gayi thi?', ['2013', '2008', '2015', '2020'], 0],
    ["QR code stand for... / क्यूआर कोड का अर्थ है.....", ["Quick Response Code - क्विवक रिस्पॉन्स कोड", "Quick Result Code - क्विवक रिजल्ट कोड", "Quick Restore Code - क्विवक रिस्टोर कोड", "None of above - उपरोक्त में से कोई नहीं"], 0],
    ["ATM means..... / एटीएम का अर्थ.....", ["Any Time Money - एनी टाईम मनी", "Auto Truck of Mahindra - ऑटो ट्रक ऑफ महिन्द्रा", "Automated Teller Machine - ऑटोमेटेड टेलर मशीन", "None - कोई नहीं"], 2],
    ["KYC means......? / केवाईसी का मतलब होता है......?", ["Know your customer - नो योर कस्टमर", "Know your character - नो योर कैरेक्टर", "Both of the above - उपरोक्त दोनों", "None of these - कोई नहीं"], 0],
    ["Which is type of credit card / कौन सा क्रेडिट कार्ड का प्रकार है?", ["Master Card - मास्टर कार्ड", "VISA - वीजा", "Both a & b - a तथा b दोनों", "None of these - इनमें से कोई नहीं"], 2],
    ["Which of the following is known as online banking? / निम्नलिखित में से किसे ऑनलाइन बैंकिंग के रूप में जाना जाता है?", ["Net Banking - नेट बैंकिंग", "Internet Banking - इंटरनेट बैंकिंग", "Both a & b - a तथा b दोनों", "None of above - उपरोक्त में से कोई नहीं"], 2],
    ["Can Illiterate person be issued Debit card? / क्या अनपढ़ व्यक्ति को डेबिट कार्ड इश्यू किया जा सकता है?", ["No - नहीं", "Yes - हां", "Only in case of joint account - केवल संयुक्त खाता होने की दशा में", "Only in case he is head of family - केवल परिवार का मुखिया होने की दशा में"], 1],
    ["Interest on Savings Deposit is paid / बैंक बचत जमा पर ब्याज दिया जाता है।", ["Yearly - वार्षिक", "Every Month - प्रति माह", "Half yearly - अर्द्धवार्षिक", "Quarterly - त्रैमासिक"], 2],
    ["Under PMSBY, accidental death claim is available for: / पीएमएसबीवाई के अन्तर्गत दुर्घटना मृत्यु पर क्षतिपूर्ति उपलब्ध है:", ["Rs. 1 lac - 1 लाख रुपये", "Rs. 2 lac - 2 लाख रुपये", "Rs. 3 lac - 3 लाख रुपये", "None - कोई नहीं"], 1],
    ["The Indian rupee symbol '₹' officially adopted in / भारतीय रुपये का चिन्ह ₹ है, जिसे मान्यता मिली है", ["2009", "2010", "2012", "2015"], 1],
    ["In which year NEFT services has been started? / NEFT सेवा किस वर्ष में प्रारम्भ की गयी थी?", ["2005", "2002", "2001", "2006"], 0],
    ["The amount of money to be charged for a certain amount of insurance coverage is called? / किसी बीमा में जमा होने वाली किस्त को किस नाम से जाना जाता है?", ["Token Money - टोकन मनी", "Premium - प्रीमियम", "Cash - नकद", "Insured Money - बीमा धन"], 1],
    ["Main security of internet banking is - / इंटरनेट बैंकिंग में मुख्य सुरक्षा किससे होती है.", ["Password - पासवर्ड", "User name - यूजर के नाम से", "User address - यूजर के पता से", "User mobile number - यूजर के मोबाइल नंबर"], 0],
    ["Through ....... App you can transfer the money and do any payment as bill/shopping. / ....... ऐप के माध्यम से आप पैसे ट्रांसफर कर सकते हैं और बिल/खरीदारी के कार्य में कोई भुगतान कर सकते हैं।", ["BHIM - भीम", "Paytm - पेटीएम", "Both a & b - a तथा b दोनों", "None - कोई नहीं"], 2],
    ["Atal Pension Yojna is open to Indian citizens whose age are between? / अटल पेंशन योजना किस वर्ष तक के नागरिकों के लिए है?", ["18-40", "25-40", "18-25", "18-30"], 0],
    ["Which mobile wallet does not permit cash withdrawal / किस मोबाइल वॉलेट से नकद भुगतान सम्भव नहीं है", ["Open wallet - ओपन वॉलेट", "Semi Closed wallet - सेमी क्लोज्ड वॉलेट", "Semi Open wallet - सेमी ओपन वॉलेट", "None - कोई नहीं"], 0],
    ["CVV Stand for? / CVV का अर्थ है?", ["Code Verification Value - कोड वेरिफिकेशन वैल्यू", "Card Validate Value - कार्ड वेलिडे्ट वैल्यू", "Code Verification Value - कार्ड वेरिफिकेशन वैल्यू", "None of these - कोई नहीं"], 2],
    ["Which type of deposits earns highest interest rate? / किस तरह की जमाओं में अधिक ब्याज मिलता है?", ["Current account - चालू खाता", "Fixed Deposits - मियादी जमा", "None of the options - उपरोक्त में से कोई नहीं", "Savings Account - बचत खाता"], 1],
    ["In Pradhan Mantri Mudra Yojana, under SHISHU category loan amount is / प्रधानमंत्री मुद्रा योजना के अन्तर्गत शिशु के जाने वाली ऋण की राशि है-", ["Up to 30,000 - 30,000 तक", "Up to 50,000 - 50,000 तक", "Up to 90,000 - 90,000 तक", "Up to 10,000 - 10,000 तक"], 1],
    ["Pradhan Mantri Suraksha Bima (PMSBY) was launched on- / प्रधानमंत्री सुरक्षा जीवन बीमा योजना प्रारम्भ हुआ था-", ["May 9, 2015 - 9 मई 2015", "April 9, 2015 - 9 अप्रैल 2015", "May 20, 2015 - 20 मई 2015", "May 1, 2018 - 1 मई 2018"], 0],
    ["UPI payment interface Developed by / यूपीआई पेमेन्ट इन्टरफेस किसके द्वारा डेवलप किया गया है-", ["National Payment Corporation - नेशनल पेमेन्ट कार्पोरेशन", "Finance Ministry - वित्त मंत्रालय", "Bank - बैंक", "None - कोई नहीं"], 0],
    ["Bank pays interest on / बैंक किस पर ब्याज देता है", ["None of the options - कोई नहीं", "Deposits - जमाओं", "Both Deposits & Loans - दोनों जमाओं एवं ऋणों", "Loans - ऋणों"], 1],
    ["Account payee cheques can be paid / आदाता खाता चेक का भुगतान किया जा सकता है।", ["At cash counter of Bank - बैंक के नकद काउंटर पर", "At ATM - एटीएम द्वारा", "By deposit in Bank account - बैंक खाते में जमा करके", "None of the options - उपरोक्त में से कोई नहीं"], 2],
    ["What is validity period of cheque? / चेक की वैधता अवधि होती है।", ["4 months from date of issue - जारी दिनांक से 4 माह तक", "3 months from date of issue - जारी दिनांक से 3 माह तक", "1 months from date of issue - जारी दिनांक से 1 माह तक"], 1],
    ["Full form of DFT is..../ डीएफटी का पूर्ण रूप है..", ["Dynamic Financial Tools - डॉयनॉमिक फाईनेंसियल टूल्स", "Digital Financial Tools - डिजिटल फाईनेंसियल टूल्स", "Digital Funds Tools - डिजिटल फण्ड्स टूल्स", "Double Finance tools - डबल फाइनेंस टूल्स"], 1],
    ["Bank does not give loan against / बैंक लोन नहीं देता है...।", ["Gold Ornaments - सोने के आभूषण", "LIC Policy - एलआईसी पॉलिसी", "Lottery ticket - लॉटरी टिकट", "NSC - एनएससी"], 2]
  ],
  c9: [
    ['Bhashini (National Language Translation Mission) ka mukhya uddeshya kya hai?', ['Computer hardware banana', 'Bharat ki sabhi bhashao me digital content aur services ko aasan banana (AI-based translation)', 'Sirf English sikhana', 'None'], 1],
    ['Bhashini platform kis mantralaya ke antargat viksit kiya gaya hai?', ['Ministry of Culture', 'Ministry of Education', 'Ministry of Electronics and Information Technology (MeitY)', 'Ministry of Finance'], 2],
    ['Unicode standard ka mukhya upyog kiske liye hota hai?', ['Sound mixing ke liye', 'Sirf English text ke liye', 'Image processing ke liye', 'Duniya ki sabhi bhashao ke characters aur scripts ko digital roop me represent karne ke liye'], 3],
    ['ASCII code kitne bits ka hota hai standard roop me?', ['7 bits (Extended ASCII 8 bits)', '16 bits', '32 bits', '64 bits'], 0],
    ['Unicode me UTF-8 kitne bits/bytes ka variable-length encoding system hai?', ['1 to 4 bytes (8 to 32 bits)', 'Sirf 8 bits', 'Sirf 16 bits', '64 bits'], 0],
    ['Indic language fonts me kis encoding standard ka sabse adhik prayog hota hai modern systems me?', ['BCD', 'ASCII', 'EBCDIC', 'Unicode'], 3],
    ['Speech-to-Text (STT) technology ka kya arth hai?', ['Text ko aawaj me badalna', 'Boli gayi aawaj (speech) ko text me badalna', 'Video ko audio me badalna', 'None'], 1],
    ['Text-to-Speech (TTS) technology ka kya arth hai?', ['Print nikalna', 'Aawaj ko text me badalna', 'Likhe huye text ko computer ya device dwara aawaj me bolkar sunana', 'None'], 2],
    ['OCR (Optical Character Recognition) ka mukhya karya kya hai?', ['Printed ya handwritten text ki image ko editable machine-readable text me badalna', 'Image ko print karna', 'Barcode scan karna', 'None'], 0],
    ['OMR (Optical Mark Recognition) ka upyog kahan hota hai?', ['Text edit karne ke liye', 'Multiple choice questions ki answer sheets (jaise exams) ko automatic evaluate karne ke liye', 'Video record karne ke liye', 'None'], 1],
    ['MICR (Magnetic Ink Character Recognition) ka upyog mukhya roop se kahan hota hai?', ['School attendance me', 'Supermarket me billing ke liye', 'Banks me cheques ki processing aur verification ke liye', 'None'], 2],
    ['MICR code me kul kitne digits hote hain?', ['10 digits', '11 digits', '6 digits', '9 digits'], 3],
    ['MICR code ke shuru ke 3 digits kya darshate hain?', ['Branch code', 'Bank code', 'City (City code - India ke pin code ke pehle 3 digits)', 'None'], 2],
    ['MICR code ke beech ke 3 digits kya darshate hain?', ['Bank code', 'City code', 'Branch code', 'None'], 0],
    ['MICR code ke aakhri 3 digits kya darshate hain?', ['City code', 'Branch code', 'Bank code', 'None'], 1],
    ['Barcode reader kis technology par kaam karta hai?', ['Biometric par', 'Magnetic ink par', 'Radio waves par', 'Laser light reflection (Optical technology) par'], 3],
    ['QR Code (Quick Response Code) kisne invent kiya تھا?', ['IBM', 'Bill Gates', 'Apple', 'Denso Wave (Japan ki company ne 1994 me)'], 3],
    ['Barcode ke mukable QR Code me kya visheshta hoti hai?', ['QR code sirf ek line me hota hai', 'QR code me bohot adhik data (text/links) store kiya ja sakta hai aur ye kisi bhi angle se scan ho sakta hai', 'QR code me data store nahi hota', 'None'], 1],
    ['E-Commerce me B2C model ka udaharan kya hai?', ['OLX par do user ka vyapar', 'Do companiyon ka aapas me vyapar', 'Amazon ya Flipkart se grahak dwara saman kharidna', 'None'], 2],
    ['E-Commerce me C2C model ka udaharan kya hai?', ['OLX, Quikr ya eBay par ek grahak dwara dusre grahak ko saman bechna', 'Company se customer', 'Sarkar se janta', 'None'], 0],
    ['E-Commerce me B2B model ka udaharan kya hai?', ['Customer to Business', 'Customer to Customer', 'Ek manufacturer dwara wholesaler ya retailer ko bulk me saman bechna', 'None'], 2],
    ['E-Commerce me C2B model ka udaharan kya hai?', ['Ek freelancer designer dwara apni service kisi company ko dena', 'Amazon se saman lena', 'Retailer to customer', 'None'], 0],
    ['E-Commerce me M-Commerce (Mobile Commerce) ka kya arth hai?', ['Sirf computer se shopping', 'Mobile phones ya tablets ke madhyam se internet par kharid-bikri karna', 'Landline phone se order karna', 'None'], 1],
    ['Digital Marketplace ka udaharan kaun sa hai?', ['MS Paint', 'Notepad', 'VLC media player', 'Flipkart, Amazon, Snapdeal'], 3],
    ['Payment Gateway e-commerce me kya karta hai?', ['Saman deliver karta hai', 'Customer aur Bank ke beech secure payment transaction ko process aur authorize karta hai', 'Product pack karta hai', 'None'], 1],
    ['E-Commerce website par SSL/TLS certificate hona kyu anivarya hai?', ['Speed slow karne ke liye', 'Website ka rang badalne ke liye', 'Customer ki confidential financial details (jaise credit card/password) ko encrypt aur secure rakhne ke liye', 'None'], 2],
    ['Digital Wallet (E-Wallet) kya hota hai?', ['Ek software application jo user ki payment details ko securely store karta hai online transactions ke liye', 'Lohki ki tijori', 'Hard disk folder', 'None'], 0],
    ['Aadhaar Pay kya hai?', ['Merchant (dukan_dar) dwara customer ke Aadhaar number aur biometric se payment lene ki app', 'Aadhaar card print karne ki app', 'Loan app', 'None'], 0],
    ['Bharat Interface for Money (BHIM) kis par adharit hai?', ['SWIFT network', 'NEFT system', 'RTGS system', 'Unified Payments Interface (UPI)'], 3],
    ['UPI ID me \'@\' ke baad ka hissa kya darshate hain?', ['User ka personal naam', 'Bank ka handle / PSP (Payment Service Provider) handle', 'Country code', 'None'], 1],
    ['National Digital Literacy Mission (NDLM) ka mukhya uddeshya kya hai?', ['School banana', 'Sirf degree dena', 'Desh ke nagrikon ko digital roop se sakshar (literate) banana taki wo computer aur internet ka prayog kar sakein', 'None'], 2],
    ['PM Disha (Pradhan Mantri Gramin Digital Saksharta Abhiyan) kiske liye hai?', ['Shhari kshetron ke engineers ke liye', 'Gramin kshetron me logo ko digital literacy dene ke liye', 'Bank officers ke liye', 'None'], 1],
    ['National e-Governance Plan (NeGP) ke antargat kitne mission mode projects the (shuruat me)?', ['10', '5', '100', '27 (bad me badhakar 31 ya adhik kiye gaye)'], 3],
    ['DigiLocker me kisi bhi document ko upload karne ke liye max file size limit aamtaur par kya hoti hai (per file)?', ['100 MB', '1 GB', '500 KB', '10 MB (PDF/JPEG formats)'], 3],
    ['DigiLocker me "Issued Documents" aur "Uploaded Documents" me kya antar hai?', ['Issued documents sarkari sansthao se direct digital format me aate hain (legal valid), Uploaded documents user khud scan karke dalta hai', 'Dono ekdam same hain', 'Uploaded documents jyada valid hote hain', 'None'], 0],
    ['UMANG App par kitni se adhik sarkari sevaein ek sath uplabdh hain?', ['50', 'Sirf 5', '1000+ se adhik (Central aur State governments ki)', '100'], 2],
    ['National Portal of India (india.gov.in) ko kaun manage karta hai?', ['NPCI', 'RBI', 'National Informatics Centre (NIC)', 'UIDAI'], 2],
    ['NIC (National Informatics Centre) ki sthapna kis varsh hui thi?', ['1976', '1985', '1991', '2000'], 0],
    ['GeM (Government e-Marketplace) portal kis varsh launch kiya gaya tha?', ['2016', '2014', '2018', '2020'], 0],
    ['e-NAM portal kis mantralaya ki pehal hai?', ['Ministry of IT', 'Ministry of Agriculture and Farmers Welfare', 'Ministry of Finance', 'Ministry of Commerce'], 1],
    ['Direct Benefit Transfer (DBT) yojana ka mukhya labh kya hai?', ['Check se dena', 'Cash me dukan par dena', 'Sarkari yojanao ka paisa seedhe labharthi (beneficiary) ke bank khate me bhejna bina kisi bicholiye ke', 'None'], 2],
    ['Aadhaar-enabled DBT me sabse mukhya link kya hota hai?', ['PAN card link', 'Bank Account ka Aadhaar Seeding / Mapping (NPCI mapper)', 'Voter ID link', 'None'], 1],
    ['National Payments Corporation of India (NPCI) ke antargat kaun-kaun se major products aate hain?', ['UPI, RuPay, IMPS, AEPS, BBPS, NACH', 'Sirf NEFT', 'Sirf RTGS', 'None'], 0],
    ['NACH ka poora naam kya hai?', ['National Access Clearing House', 'National Automated Clearing House', 'New Automated Card Handler', 'None'], 1],
    ['IMPS ki shuruat kis sanstha ne ki thi?', ['World Bank ne', 'RBI ne', 'SBI ne', 'NPCI ne (2010 me)'], 3],
    ['UPI 123Pay ko kisne launch kiya tha?', ['Amazon', 'Microsoft', 'Google', 'RBI Governor (March 2022 me)'], 3],
    ['e-Rupi voucher ki kya visheshta hai?', ['Yeh loan hai', 'Yeh cryptocurrency hai', 'Yeh specific purpose (jaise vaccine ya education) aur specific person ke liye hota hai, bina bank account ke bhi use ho sakta hai (prepaid e-voucher)', 'None'], 2],
    ['CBDC (Central Bank Digital Currency) ka Bharat me kya naam rakha gaya hai?', ['Digital Token', 'Bitcoin India', 'Rupee Coin', 'Digital Rupee (e-Rupee)'], 3],
    ['Wholesale CBDC (CBDC-W) ka upyog kiske liye hota hai?', ['Financial institutions ke beech wholesale transactions aur interbank settlement ke liye', 'Aam janta ki daily shopping ke liye', 'International remittance only', 'None'], 0],
    ['Retail CBDC (CBDC-R) ka upyog kiske liye hota hai?', ['Sirf RBI ke liye', 'Aam nagrikon aur businesses dwara daily retail transactions ke liye', 'Foreign trade ke liye', 'None'], 1],
    ['Bhashini project ke antargat kis AI field par sabse jyada kaam ho raha hai?', ['Video gaming par', 'Hardware manufacturing par', 'Natural Language Processing (NLP) aur Machine Translation par', 'None'], 2],
    ['Indian languages ke liye digital keyboard standardization me kis layout ka sabse jyada use hota hai?', ['ABCDE layout', 'QWERTY layout (English ke liye)', 'InScript keyboard layout', 'None'], 2],
    ['InScript keyboard layout kis ministry/organization dwara standardize kiya gaya tha?', ['Apple', 'Microsoft', 'Google', 'Department of Electronics and Information Technology (DeitY/MeitY)'], 3],
    ['Cloud-based language translation APIs ka upyog kiske liye hota hai?', ['File delete karne ke liye', 'Real-time me ek bhasha ke text ko dusri bhasha me badalne ke liye', 'Virus scan karne ke liye', 'None'], 1],
    ['E-Commerce me B2G (Business to Government) ka udaharan kya hai?', ['Government e-Marketplace (GeM) par sarkari vibhago ko saman bechna ya e-Procurement', 'Amazon par shopping', 'OLX par bechna', 'None'], 0],
    ['E-Commerce me C2G (Consumer to Government) ka udaharan kya hai?', ['Online tax bharna, bill payment, ya penalty bharna sarkar ko', 'Government job aavedan', 'Railway ticket', 'None'], 0],
    ['Supply Chain Management (SCM) e-commerce me kiske liye zaroori hai?', ['Password banane ke liye', 'Sirf website design karne ke liye', 'Raw material se lekar final product ke customer tak pahuchne ki poori process ko track aur manage karne ke liye', 'None'], 2],
    ['CRM (Customer Relationship Management) software ka e-commerce me kya upyog hai?', ['Server hack karne ke liye', 'Customers ki queries, feedback, purchase history aur support ko manage karne ke liye', 'Database delete karne ke liye', 'None'], 1],
    ['E-Commerce me \'Dropshipping\' ka kya arth hai?', ['Direct factory banana', 'Saman paani me fekna', 'Aisa retail business jisme store apne paas inventory nahi rakhta, balki order aane par supplier seedha customer ko bhejta hai', 'None'], 2],
    ['Secure Electronic Transaction (SET) protocol kiske liye banaya gaya tha?', ['Email bhejne ke liye', 'Credit card transactions ko internet par secure banane ke liye (early protocol)', 'File download karne ke liye', 'None'], 1],
    ['Tokenization (Digital Payments me) ka kya arth hai?', ['Actual card number ko ek unique alternate code (token) se replace kar dena security ke liye', 'Token se coin nikalna', 'Password badlana', 'None'], 0],
    ['Two-Factor Authentication (2FA) me RBI dwara online card transactions ke liye kya anivarya kiya gaya hai?', ['Sirf expiry date', 'Sirf card number', 'OTP (One Time Password) ya 3D Secure verification', 'None'], 2],
    ['National Knowledge Network (NKN) ka mukhya uddeshya kya hai?', ['Desh ke sabhi uchh shiksha aur anusanthan (research/educational) sansthao ko ek high-speed gigabit network se jorna', 'Primary school children ke liye game network', 'Commercial shopping network', 'None'], 0],
    ['National Optical Fiber Network (NOFN) ka naya naam kya hai?', ['BSNL Net', 'RailTel', 'JioNet', 'BharatNet'], 3],
    ['Common Service Centre (CSC) scheme kis keval mission ke antargat aati hai?', ['Railway Ministry', 'Digital India Programme ke antargat (e-Governance pillar)', 'Defense Ministry', 'None'], 1],
    ['Jeevan Pramaan initiative kis dwara shuru kiya gaya tha?', ['Supreme Court dwara', 'RBI dwara', 'Department of Electronics and Information Technology (MeitY) ke dwara pensioners ke liye', 'None'], 2],
    ['National Judicial Data Grid (NJDG) par kis prakar ka data uplabdh hota hai?', ['Desh bhar ke district aur high courts ke cases, pending matters, aur orders ka data', 'Police FIR data', 'Land registry data', 'None'], 0],
    ['Bhuvan portal kis sanstha ka geo-portal hai?', ['NIC ka', 'Google ka', 'Microsoft ka', 'ISRO (Indian Space Research Organisation) ka'], 3],
    ['Bhuvan portal ka upyog kisliye hota hai?', ['Movie streaming ke liye', 'Indian region ke satellite imagery, 3D visualization aur geospatial applications ke liye', 'Railway booking ke liye', 'None'], 1],
    ['e-Bhasha (National Web Hosting Initiative for Indian Languages) ka mukhya uddeshya kya hai?', ['English khatam karna', 'Sarkari websites aur portals ko alag-alag bhartiy bhashao me uplabdh karana', 'Private blogging', 'None'], 1],
    ['E-Commerce me Affiliate Marketing ka kya arth hai?', ['Free saman batna', 'Khud ka product banana', 'Kisi dusre ke product ka link apne platform par share karke sale par commission kamana', 'None'], 2],
    ['E-Commerce me Drop shipping aur Retail me mukhya antar kya hai?', ['Drop shipping me inventory nahi rakhni padti, retail me stock rakhna padta hai', 'Dono same hain', 'Retail me internet nahi hota', 'None'], 0],
    ['Payment Aggregator (PA) kya hota hai?', ['Currency printer', 'Bank ka ATM', 'Aisi company jo merchants ko customers se online payments accept karne ke liye various payment options integrate karne me madad karti hai (jaise Razorpay, PayU)', 'None'], 2],
    ['UPI AutoPay ka upyog kiske liye kiya jata hai?', ['Manual payment ke liye', 'Fixed interval par hone wale automatic payments (jaise OTT subscription, SIP, loan EMI) ke liye', 'Cash withdrawal ke liye', 'None'], 1],
    ['BHIM app par maximum kitni bank accounts ko ek sath link kiya ja sakta hai (UPI standard ke anusar)?', ['10 accounts', 'Sirf 1 account', 'Sirf 2 accounts', 'Multiple bank accounts link kiye ja sakte hain, par ek primary select hota hai'], 3],
    ['National Cyber Coordination Centre (NCCC) ka mukhya karya kya hai?', ['Cyber security threats ki real-time situational awareness aur meta-data analysis karna', 'Antivirus bechna', 'Website design karna', 'None'], 0],
    ['CERT-In (Indian Computer Emergency Response Team) kis ministry ke antargat kaam karta hai?', ['Ministry of Defense', 'Ministry of Home Affairs', 'Ministry of Finance', 'Ministry of Electronics and Information Technology (MeitY)'], 3],
    ['Aadhaar Virtual ID (VID) kitne digits ki hoti hai aur kyon bani hai?', ['10 digits ki, mobile ke liye', '12 digits ki, password ke liye', '16 digits ki, privacy protect karne ke liye taki real Aadhaar number share na karna pade', 'None'], 2],
    ['National Identity Smart Card project me kiski jankari hoti hai?', ['Citizen ki demographic aur biometric details chip par', 'Sirf bank balance', 'Sirf vehicle number', 'None'], 0],
    ['e-Governance ke char mukhya models (interactions) kaun-kaun se hain?', ['A2Z, B2C, C2D, D2E', 'G2C, G2B, G2G, G2E', 'P2P, C2C, B2B, A2A', 'None'], 1],
    ['Digital India campaign ki shuruat kis varsh aur date ko ki gayi thi?', ['2 October 2015', '15 August 2014', '26 January 2016', '1 July 2015'], 3],
    ['Digital India ke 9 pillars me kya shamil hai?', ['Sirf mobile manufacturing', 'Broadband Highways, Public Internet Access Programme, e-Governance, e-Kranti, etc.', 'Sirf school education', 'None'], 1],
    ['e-Kranti (Digital India ka pillar) ka mukhya uddeshya kya hai?', ['Railway booking', 'Krishi vikas', 'Electronic delivery of e-governance services ko desh bhar me tej aur vyapak banana (Governance at doorstep)', 'None'], 2],
    ['MyGov.in portal kiske liye banaya gaya hai?', ['Citizen engagement aur participatory governance ke liye (sarkar ke sath vichar aur sujhav saza karne ke liye)', 'Online shopping ke liye', 'Private chat ke liye', 'None'], 0],
    ['Digilocker me issued documents ka storage kahan hota hai?', ['Cloud repository connected to issuer department (secure cloud storage)', 'Local computer ki C drive me', 'Pendrive me', 'None'], 0],
    ['National Scholarship Portal (NSP) par scholarship ka disburse kaise hota hai?', ['Cash me school me', 'Direct Benefit Transfer (DBT) ke madhyam se seedhe student ke bank khate me', 'Cheque dwara', 'None'], 1],
    ['Soil Health Card scheme ke antargat kisan ko kitne poshak tatwo (nutrients) ki jankari mitti ki janch ke baad di jati hai?', ['20', 'Sirf 2', '5', '12 mukhya poshak tatwo (nutrients) ki jankari'], 3],
    ['e-NAM portal ka mukhya labh kisanon ko kya milta hai?', ['Free beej', 'Sirf local mandi me', 'Desh ki kisi bhi mandi me online fasal bechne ki suvidha (pan-India electronic trading platform)', 'None'], 2],
    ['PM Kisan Samman Nidhi yojana ke tahat kisanon ko salana kitni rashi di jati hai?', ['Rs. 12,000', 'Rs. 10,000', 'Rs. 5,000', 'Rs. 6,000 (3 barabar kiisto me 2000-2000 karke)'], 3],
    ['Jeevan Pramaan Patra digital life certificate ki validity kitni hoti hai aamtaur par?', ['3 mahine', 'Lifetime', '6 mahine', 'Jari hone ki tithi se 1 varsh (annual submission required)'], 3],
    ['National Voters\' Service Portal (NVSP) par naye voter registration ke liye kaun sa Form bhara jata hai?', ['Form 7', 'Form 6', 'Form 8', 'Form 4'], 1],
    ['Voter ID me naam ya details me correction ke liye NVSP par kaun sa Form bhara jata hai?', ['Form 9', 'Form 6', 'Form 7', 'Form 8'], 3],
    ['Voter ID deletion ya objection ke liye NVSP par kaun sa Form bhara jata hai?', ['Form 10', 'Form 6', 'Form 8', 'Form 7'], 3],
    ['National Portal of India par kis bhasha me content sabse pehle uplabdh hota hai?', ['Hindi aur English dono mukhya bhashao me', 'Sirf English', 'Sirf Hindi', 'Regional only'], 0],
    ['Indian Language Digital Services me \'Localization\' ka kya arth hai?', ['Computer band karna', 'Foreign language me karna', 'Software, website ya content ko kisi vishesh kshetra ya bhasha ke anurup (local language aur culture ke hisab se) dhalna', 'None'], 2],
    ['Machine Translation me Neural Machine Translation (NMT) kiska upyog karti hai?', ['Simple dictionary matching ka', 'Deep Learning aur Neural Networks ka behtar aur natural translation ke liye', 'Manual typing ka', 'None'], 1],
    ['OCR software me Font aur Style ki pehchan kis par nirbhar karti hai?', ['Audio input par', 'Random guessing par', 'Pattern matching aur feature extraction algorithms par', 'None'], 2],
    ['MICR technology me paper par jo ink use hoti hai usme kiska powder hota hai?', ['Iron oxide (magnetic particles) ka', 'Carbon dust', 'Plastic powder', 'None'], 0],
    ['QR code me kitne direction finder patterns (corners par bade squares) hote hain?', ['Koi nahi', '4 corners par', 'Sirf 1 corner par', '3 corners par (alignment ke liye)'], 3],
    ['E-Commerce me COD (Cash on Delivery) ka kya arth hai?', ['Saman prapt hone par nagad (cash) ya digital payment delivery boy ko dena', 'Pehle payment karna', 'Udhar saman lena', 'None'], 0],
    ["In computer security, ............ means that the information in a computer system only be accessible viewing by authorised parities. / कंप्यूटर सुरक्षा में, ............ का अर्थ है कि कंप्यूटर प्रणाली में सूचना केवल अधिकृत पार्टिज द्वारा देखने योग्य हो।", ["availability - उपलब्धता", "Integrity - इंटीग्रिटी", "confidentiality - गोपनीयता", "All of the above - उपर्युक्त में से सभी"], 2],
    ["Encryption techniques improve a network's / एन्क्रिप्शन तकनीक एक नेटवर्क.... को बेहतर बनाती है।", ["Performance - परफॉर्मेंस", "Security - सिक्योरिटी", "Reliability - विश्वसनीयतता", "None of above - उपर्युक्त में से कोई नहीं"], 1],
    ["Which protection method is used to monitoring who can access the data for what purpose? / किस सुरक्षा विधि का उपयोग निगरानी के लिए किया जाता है कि कौन और किस उद्देश्य के लिए डेटा एक्सेस कर सकता है?", ["System Access Control - सिस्टम एक्सेस कंट्रोल", "System Design - सिस्टम डिजाईन", "Data Access Control - डेटा एक्सेस कंट्रोल", "None of above - उपर्युक्त में से कोई नहीं"], 2],
    ["The main goals of secure computing is / सुरक्षित कंप्यूटिंग का मुख्य लक्ष्य है............", ["Confidentiality - गोपनीयता", "interruption - व्यवधान", "modification - परिवर्तन", "All of these - इनमें से सभी"], 0],
    ["............ means that sender must not be able to deny sending a message that he sent. / ............ इसका मतलब है कि प्रेषक को एक मैसेज भेजने से इनकार करने में सक्षम नहीं होना चाहिए जो उसने भेजा था।", ["Non-repudiation - नॉन रेपुडेशन", "Integrity - इंटीग्रिटी", "Authentication - ऑथेन्टिकेशन"], 0],
    ["In computer security, .......... means that computer system assets can be modified only by authorised parities. / कंप्यूटर सुरक्षा में, .......... का अर्थ है कि कंप्यूटर सिस्टम की संपत्ति को केवल अधिकृत पार्टिज द्वारा संशोधित किया जा सकता है।", ["confidentiality - गोपनीयता", "availability - उपलब्धता", "Integrity - इंटीग्रिटी", "All of the above - उपर्युक्त में से सभी"], 3],
    ["Which of the following is not a method to provide protection? / निम्नलिखित में से कौन सुरक्षा प्रदान करने की एक विधि नहीं है?", ["System Design -सिस्टम डिजाईन", "Data Access Controls - डेटा एक्सेस कंट्रोल", "System Access Controls - सिस्टम एक्सेस कंट्रोल", "None of the above - उपरोक्त कोई नहीं"], 0],
    ["In computer security, integrity refer to / कंप्यूटर सुरक्षा में, इंटीग्रिटी को देखें", ["viewing and printing of data - डेटा को देखना औ प्रिंट करना", "access to computing resources without difficulties - कठिनाइयों के बिना कम्प्यूटिंग संसाधनों तक पहुंच", "separation and protection of the resources data - संसाधनों के डेटा का पृथक्करण और संरक्षण", "All of the above - उपर्युक्त में से सभी"], 2],
    ["........... refers to the situation in which services or data become unavailable, unusable and destroyed. / ............ उस स्थिति को संदर्भित करता है जिसमें सेवाएँ या डेटा अनुपलब्ध, अनुपयोगी और नष्ट हो जाते हैं।", ["Confidentiality - गोपनीयता", "Interruption - व्यवधान", "Integrity - इंटीग्रिटी", "All of these - इनमें से सभी"], 1],
    ["Authentication is .... / प्रमाणीकरण है ....", ["hard to assure identity of user on a remote system / एक दूरस्थ प्रणाली पर उपयोगकर्ताओं की पहचान का आश्वासन देना मुश्किल है", ["disrupt computer operation - कम्प्यूटर ऑपरेशन बाधित"], ["gather sensitive information - संवेदनशील जानकारी इकट्ठा करें"], ["Both a & b - a तथा b दोनों"]], 0],
    ["Which of the following means that the receiver is ensured that the massage is coming from the intended sender, not an imposter? / निम्न में से किस का अर्थ है कि रिसीवर सुनिश्चित करता है है कि मैसेज किसी प्रेषक से नहीं बल्कि इच्छित प्रेषक से हो रही है", ["Availability - उपलब्धता", "Access Control - एक्सेस कंट्रोल", "Authentication - ऑथेन्टिकेशन", "All of the above - उपर्युक्त में से सभी"], 2],
    ["............... means to prove/verify the identity of the entity that tries to access the system's resources. / ................ का मतलब उस संस्था की पहचान को प्रमाणित/सत्यापित करना है जो सिस्टम के संसाधनों तक पहुंचने की कोशिश करती है।", ["Message authentication - मैसेज ऑथेन्टिकेशन", "Password authentication - पासवर्ड ऑथेन्टिकेशन", "Entity authentication - इंटिटी ऑथेन्टिकेशन", "All of the above - उपर्युक्त में से सभी"], 2],
    ["Software programs that close potential security breaches in an operating systems known as / सॉफ्टवेयर प्रोग्राम जो एक ऑपरेटिंग सिस्टम में संभावित सुरक्षा ब्रिचेस के रूप में जाने जाते हैं।", ["security patches - सिक्युरिटी पैचेस", "refresh patches - रिफ्रेश पैचेस", "security breath fixes - सिक्युरिटी ब्रेथ फिक्सेज", "All of the above - उपर्युक्त में से सभी"], 0],
    ["A major security problem for operation system is- / सिस्टम ऑपरेशन के लिए एक बड़ी सुरक्षा समस्या है-", ["physical problem - फिजिकल समस्या", "human problem - मानवीय समस्या", "authentication problem - सत्यापन की समस्या", "All of the above - उपर्युक्त में से सभी"], 3],
    ["Malware is used to / मैलवेयर का उपयोग किया जाता है-", ["disrupt computer operation - कम्प्यूटर ऑपरेशन बाधित", "gather sensitive information - संवेदनशील जानकारी इकट्ठा करें", "Both a & b - a तथा b दोनों", "All of the above - उपर्युक्त में से सभी"], 2],
    ["The aspect of security that fails, when an email in intercepted is / सुरक्षा का वह पहलू जो विफल हो जाता है, जब ईमेल का इंटरसेप्ट किया जाता है", ["integrity - इंटीग्रिटी", "privacy - प्राइवेसी", "authentication - ऑथेन्टिकेशन", "All of these - इनमें से सभी"], 1],
    ["The creeper virus was eventually deleted by a program known as .......... / क्रीपर वायरस को अंततः ........ नामक एक कार्यक्रम द्वारा हटा दिया गया था।", ["the weaper - दी वीपर", "the reaper - दी रीपर", "the seaper - दी सीपर", "None of abvoe - इनमें से कोई नहीं"], 1],
    ["For secure Electronic Data Interchange (EDI) transmission on internet used.......... / इंटरनेट पर सुरक्षित इलेक्ट्रॉनिक डाटा इंटरचेंज (EDI) ट्रांसमिशन के लिए उपयोग किया जाता है ... I", ["TCP/IP - टीसीपी/आईपी", "MIME - एमआईएमई", "S/MIME - एस/एमआईएमई", "None of above - उपर्युक्त में से कोई नहीं"], 2],
    ["What are the three basic component of computer security? / कंप्यूटर सुरक्षा के तीन बुनियादी घटक क्या हैं?", ["Confidentiality, integrity, availability - गोपनीयता, इंटीग्रिटी, उपलब्धता", "Control, intelligence, action - कंट्रोल, इंटेलीजेंस, एक्शन", "Central, intelligence, agency - सेन्ट्रल, इंटेलीजेंस, एजेंसी", "Confidence, integrity, action - गोपनियता, इंटीग्रिटी, एक्शन"], 0],
    ["The Secure Electronic Transaction Protocol is used for which type of payment..... / सुरक्षित इलेक्ट्रॉनिक लेनदेन प्रोटोकॉल का उपयोग किस प्रकार के भुगतान के लिए किया जाता है .....", ["Credit card - क्रेडिट कार्ड", "NEFT - एनईएफटी", "cheque - चेक"], 0],
    ["What is Cyber security? / साइबर सिक्योरिटी क्या है?", ["Cyber Security provides security against malware - साइबर सुरक्षा मैलवेयर से सुरक्षा प्रदान करती है", "Cyber Security provides security against cyber-terrorists - साइबर सुरक्षा साइबर आतंकवादियों से सुरक्षा प्रदान करती है", "Cyber Security protects a system from cyber attacks - साइबर सुरक्षा किसी सिस्टम को साइबर हमलों से बचाती है", "All of the above - उपर्युक्त में से सभी"], 3],
    ["Which of the following is/are threat(s) for electronic payment system? / निम्नलिखित में से कौन इलेक्ट्रॉनिक भुगतान प्रणाली के लिए खतरा है?", ["Computer virus - कम्प्यूटर वायरस", "Trojan horse - ट्रोजन हॉर्स", "Computer worms - कम्प्यूटर वार्म्स", "All of the above - उपर्युक्त में से कोई नहीं"], 3],
    ["In SET protocol a customer sends a purchase order / SET प्रोटोकॉल में एक ग्राहक एक खरीद आदेश भेजता है", ["Using digital signature system - डिजिटल सिग्नेचर प्रणाली का इस्तेमाल करके", "In a plain text form - एक 'प्लेन टेक्स्ट' फॉर्म के रूप में", "Encrypted with his public key - उसकी सार्वजनिक कुंजी के साथ इन्क्रिप्टेड", "None of above - इनमें से कोई नहीं"], 0],
    ["Which is a class of computer threat / कौन सा कंप्यूटर खतरे का एक वर्ग है", ["Soliciting - सालीिसिटिंग", "Stalking - स्टाकिंग", "DoS attack - डॉस अटैक", "All of these - इनमें से सभी"], 2],
    ["This is not a type of cyber attacks. / निम्न में से कौन साइबर सुरक्षा का प्रकार नहीं है-", ["Attacks on confidentiality - गोपनीयता पर हमला", "Attacks on integrity - संप्रलि पर हमला", "Attacks on property - इंटीग्रिटी पर हमला", "All of the above - उपर्युक्त सभी"], 3]
  ],
  o1: [
    ['Pehle se shuru computer ko dobara se shuru karna kehlata hai?', ['Log off', 'Cold booting', 'Warm booting', 'Shut down'], 2],
    ['Mouse me button ki sankhya kitni hoti hai?', ['2', '3', '4', 'a, b both'], 3],
    ['PNG ka poora naam kya hai?', ['Portable Network Graphics', 'Portable Net Graphics', 'Portable Network Group', 'None of these'], 0],
    ['........... kilobyte se 1 megabyte banta hai?', ['256', '1024', '128', '512'], 1],
    ['Computer Monitor par Blink hone wala chinh kehlata hai?', ['Cursor', 'Pointer', 'Track ball', 'Mouse'], 0],
    ['Virtual memory ka aakar ... par nirbhar karta hai?', ['Database par', 'Disk space par', 'Address line par', 'All of the above'], 1],
    ['Computer CPU me Memory, Control aur ............. teen unit hote hain?', ['Microprocessor', 'Input-Output', 'Arithmetic/Logic', 'None'], 2],
    ['ENIAC ka poora naam kya hai?', ['Electronic Numerical Integrator and Coder', 'Electronic Numerical Isolator and Computer', 'Electronic Numerical Interpreter and Computer', 'Electronic Numerical Integrator and Computer'], 3],
    ['Firmware ka arth hai?', ['System software', 'Application software', 'Hardware ka software', 'All of the above'], 2],
    ['Computer ki panchvi peedhi me kiska prayog hua?', ['ULSI', 'Transistor', 'IC', 'None of these'], 0],
    ['Mouse ke madhyam se kisi Object ki properties dekhne ke liye kya karenge?', ['Shift Clicking', 'Dragging', 'Dropping', 'Right Clicking'], 3],
    ['USB Device kis sanrachna ka anusaran karta hai?', ['Halfman', 'Tree', 'Hash', 'List'], 1],
    ['Spam kisse sambandhit hai?', ['Art', 'Computer', 'Game', 'Song'], 1],
    ['Nimn me se output device nahi hai?', ['Plotter', 'CRT Monitor', 'Earphones', 'Digital Camera'], 3],
    ['Nimnlikhit me se kaun sa pointing device nahi hai?', ['Scanner', 'Mouse', 'Joy Stick', 'Optical Pen'], 0],
    ['Inkjet Printer me pai jane wali rangeen syahi ki botal me mool rangon ki sankhya ........... hoti hai?', ['3', '2', '10', '30'], 0],
    ['\'Data Processing\' se aashay hai?', ['Data ko vyavasthit karna', 'Data ko upyogi banana', 'Data ka sangrah karna', 'All of the above'], 3],
    ['IBM ka poorn roop hai?', ['Italian Business Machines', 'Indian Business Machines', 'International Business Machines', 'Integral Business Machines'], 2],
    ['Microprocessor ke nirmata kaun hai?', ['IBM', 'Apple', 'Intel', 'HCL'], 2],
    ['MP3 ....... hai?', ['Mouse', 'Sound format', 'Printer', 'Mobile phone'], 1],
    ['Computer ka vah bhag jise hum chhoo nahi sakte?', ['Software', 'Monitor', 'Hardware', 'CPU'], 0],
    ['Input ko Output me roopantaran kaun karta hai?', ['Peripherals', 'Memory', 'CPU', 'Storage'], 2],
    ['Firewall ........ hai?', ['Computer ko nuksan pahunchata hai', 'Computer ki suraksha karta hai', 'Operating System hai', 'All of the above'], 1],
    ['Punah prayog ki ja sakne wali optical storage ka sankshipt naam hoga?', ['CD', 'DVD', 'ROM', 'RW'], 3],
    ['Nimnlikhit me sabse bada kaun hai?', ['PB', 'TB', 'ZB', 'EB'], 2],
    ['Ek USB PenDrive kis prakar ki storage device me aati hai?', ['Secondary', 'Primary', 'Both', 'None'], 0],
    ['Bit ka samooh kehlata hai?', ['Nibble', 'Byte', 'Record', 'Word'], 1],
    ['Nimn me se kaunsi key, cursor ke bai taraf ke akshar ko mitati hai?', ['Space bar', 'Delete', 'Backspace', 'None of these'], 2],
    ['CPU aur I/O ke beech signalon ke movement ko kaun niyantrit karta hai?', ['CU', 'ALU', 'Memory unit', 'None'], 0],
    ['Monitor hai?', ['Storage device', 'Input device', 'Processing device', 'Output device'], 3],
    ['Recycle Bin svatah configure ho jata hai taki yeh aapke computer ki Hard Disk ka ........ data store karne ke yogya ho jaye?', ['10%', '1%', '5%', '15%'], 2],
    ['Nimnlikhit me kaun sa symbol Hexadecimal Number System ke dwara prayog kiya jata hai?', ['0-7', '0-9, A-F', '0-9', 'None'], 1],
    ['WORM ka poora naam kya hoga?', ['Write On Random Memory', 'Write Once Read Many', 'Work On Real Memory', 'None'], 1],
    ['Bluetooth ki khoj kiske dwara ki gayi?', ['Martin Cooper', 'Steve Jobs', 'Apple', 'Ericsson (Jaap Haartsen)'], 3],
    ['Telephone number, janm-tithi aur grahak ka naam .......... ka udaharan hai?', ['Ek file', 'Data', 'Ek database', 'Ek record'], 3],
    ['Computer ki teesri peedhi me kiska prayog hua?', ['Integrated circuits', 'Transistor', 'Vacuum Tube', 'Microprocessors'], 0],
    ['Printer ki gunvatta is par nirbhar karti hai ki Image ko Print karne me kitne ........ prayukt hote hain?', ['Pixel', 'PPM', 'Paper', 'DPI'], 3],
    ['Nimnlikhit me se permanent memory hai?', ['RAM', 'ROM', 'CD-ROM', 'CPU'], 1],
    ['Niche diye gaye me hardware ka udaharan nahi hai?', ['Mouse', 'Printer', 'Operating System', 'Monitor'], 2],
    ['Nimnlikhit me se kaun kaun se computer CPU ke mukhya ghatak kehlate hain?', ['CU', 'ALU', 'Memory', 'All of the Above'], 3],
    ['UNIVAC ka poorn roop kya hai?', ['Universal Automatic Computer', 'Universal Automaticserial Computer', 'Universal Automatics Company', 'None'], 0],
    ['Hierarchy kya hai?', ['Storage device', 'Ek network', 'Computer ki memory ko kram me darshata hai', 'None of these'], 2],
    ['CPU ....... ke naam se bhi jana jata hai?', ['Microprocessor', 'Execute', 'Microchip', 'Mini Computer'], 0],
    ['MICR me R ka kya matlab hota hai?', ['Reader', 'Recognition', 'Recognize', 'Reading'], 1],
    ['Samanya keybaord me kitne button paye jate hain?', ['111', '123', '101', '134'], 2],
    ['Hybrid Computer me ....... ka prayog kiya jata hai?', ['Analog signalo ka', 'Digital signalo ka', 'Uprokt dono ka', 'Koi nahi'], 2],
    ['Computer ka karya nahi hai?', ['Understanding', 'Output', 'Input', 'Controlling'], 0],
    ['DECIMAL Number System ka aadhar hai?', ['8', '10', '3', 'None'], 1],
    ['Nimnlikhit storage device ko ek sthan se dusre sthan par aasani se nahi lekar ja sakte?', ['Pendrive', 'CD', 'DVD', 'Harddisk'], 3],
    ['Nimnlikhit me kaun sa Internet se sambandhit nahi hai?', ['Printer', 'Browser', 'Links', 'Search Engine'], 0],
    ['DSM ka poora naam kya hai?', ['Demoralized system memory', 'Direct system memory', 'Direct system module', 'Distributed shared memory'], 3],
    ['Computer ke poore sanchalan ko niyantrit karne wala program kaun sa hai?', ['Working system', 'Operating system', 'Peripheral system', 'Controlling system'], 1],
    ['Windows OS me Ctrl + Shift ke sath Arrow Key dabane se kya hoga?', ['Kuch paste hota hai', 'Text ka ek block highlight hota hai', 'Kuch delete hota hai', 'None of these'], 1],
    ['Windows ek Operating System hai?', ['True', 'False'], 0],
    ['ISO ka poora naam hai?', ['Internal Student Organization', 'International Student Organization', 'Integrated Service Organization', 'International Standard Organization'], 3],
    ['Desktop par samay aur dinank kahan par dikhai padte hain?', ['My computer', 'Title bar', 'Task bar', 'Status bar'], 2],
    ['Nimnlikhit me se kaun sa kathan Unix ke baare me galat hai?', ['Unix is a Multitasking Operating System', 'Unix is an open-source Software', 'Unix is a multi-user Operating system', 'Unix is a multiprogramming Operating System'], 1],
    ['Windows operating system me Start Menu ko kholne ke liye kaunsi shortcut key prayog me li jati hai?', ['Ctrl + Esc', 'Press Windows Key', 'a & b both', 'None'], 2],
    ['Kaun sa freeware hai?', ['Unix', 'LibreOffice', 'MS Office', 'None'], 0],
    ['Kernel kya hai?', ['Operating system ka graphics interface', 'Ek chip me store hota hai', 'Linux aur Unix ka ek mahatvapoorna kendra', 'All'], 3],
    ['Yadi Computer ka samay aur dinank galat hai, toh aap kiska upyog karke ise Reset kar sakte hain?', ['Control panel', 'Write file', 'Write', 'Calendar'], 0],
    ['Pratyek computer ke sabhi hisso ke theek se kaam karne aur dusre sabhi prakar ke programo ke chalne ke liye usme ek .......... hona aavashyak hai?', ['Utility software', 'Operating System', 'Interpreter', 'Compiler'], 1],
    ['Linux hai?', ['Multitasking', 'Multi-user', 'Both', 'None'], 2],
    ['Windows operating system me shut-down option pop-up karne ki shortcut key kya hoti hai?', ['Ctrl + F4', 'Ctrl + Shift + F4', 'Win + F4', 'Alt + F4'], 3],
    ['Windows operating system me Run command dialog box ko open karne ke liye kis shortcut key ka istemal kiya jata hai?', ['Ctrl + R', 'Shift + R', 'Window + R', 'Window + Shift + R'], 2],
    ['Pratham Operating System kab viksit kiya gaya tha?', ['1948', '1949', '1951', '1950'], 3],
    ['Windows ke dialog box me pichhle option par jane ke liye kaunsi shortcut key istemal ki jayegi?', ['Shift + Tab', 'Ctrl + Tab', 'Ctrl + Shift + Tab', 'Alt + Tab'], 0],
    ['Windows OS me sabhi windows ko Minimize karne ke liye hum kaunsi shortcut key ka istemal karenge?', ['Windows + D', 'Windows + M', 'Windows + Break', 'Windows Key'], 1],
    ['Nimnlikhit me se kaun sa Windows 64-bit ko support karta hai?', ['Windows 2000', 'Windows 98', 'Windows XP', 'Windows 95'], 2],
    ['Nimnlikhit me kaun ek operating system nahi hai?', ['Oracle', 'Linux', 'Windows', 'DOS'], 0],
    ['Windows ke desktop par jo image show hoti hai use kehte hain?', ['Main Image', 'Windows Image', 'Desktop Image', 'Wallpaper'], 3],
    ['Windows-10 Software ke swamitva (Owned) ka ekadhikar kiske paas hai?', ['IBM', 'Microsoft', 'Linux', 'Google'], 1],
    ['Aapke PDA computer par aapke dwara chalaye jane wale operating system ki shreni ek .......... operating system hai?', ['Single user, single task', 'Single user, multitask', 'Multiuser, multitask', 'Real time'], 0],
    ['Folder se aashay hai?', ['Filon ki ek table bana sakte hain', 'Yeh nirdharit karta hai ki computer sahi se kaam kar sake', 'Disk par filon ko vyavasthit rakhna', 'Filon ke naam dekh sakte hain'], 2],
    ['Latest Windows OS kaun sa hai?', ['Windows XP', 'Windows 10', 'Windows 8.1', 'Windows 7'], 1],
    ['System ko debug karne ka kya arth hai?', ['Sahi system ka pata lagana tatha install karna', 'Operating system install karna', 'Sahi system ka pata lagana', 'System me errors ka pata lagana aur use theek karna'], 3],
    ['Nimn me se kaun sa ek operating system ki shreni me nahi ata hai?', ['Windows', 'Android', 'Linux', 'Apache'], 3],
    ['Vah kaun sa operating system hai jo device me svatah poorn hai aur ROM me rehta hai?', ['Real Time Operating System', 'Embedded Operating System', 'Batch Operating System', 'Microprocessor Operating System'], 1],
    ['Nimnlikhit me se kaun sa sangathan computer evam software ke kshetra me lokpriya hai?', ['Rightman', 'Henley', 'Microsoft', 'Louis Vuitton'], 2],
    ['Ubuntu Operating System ko Lock karne ki shortcut key Ctrl + Alt + L hai?', ['True', 'False'], 0],
    ['Operating system se kya aashay hai?', ['Dainik software ka ek sangrah', 'Input aur output device ka ek sangrah', 'Hardware ghatakon ka ek sangrah', 'All of the above'], 0],
    ['Nimnlikhit me se kis Windows me Start Button nahi diya gaya hai?', ['Windows 7', 'Windows XP', 'Windows 8', 'None of these'], 2],
    ['Windows OS me Ctrl + F ka kya istemal hai?', ['Computer search karne ke liye', 'File ya folder ko search karne ke liye', 'My Computer open karne ke liye', 'Minimized windows ko restore karne ke liye'], 1],
    ['Linux .......... operating system hai?', ['Microsoft', 'Open source', 'Windows', 'None of these'], 1],
    ['System ke ........ hone par OS svatah boot nahi hota?', ['Reset', 'Power on', 'Restart', 'Shutdown'], 3],
    ['Unix me kisi file ko print karne ke liye kis command ka prayog kiya jata hai?', ['LPR', 'LP', 'PT', 'a & b both'], 3],
    ['Windows Control Panel se kya nahi kiya ja sakta hai?', ['Install application', 'Printer configuration', 'Application ko run karna', 'Fonts jodna'], 2],
    ['Screen par chamakti roshni (flashing or blinking light) ko kya kaha jata hai?', ['Ek cursor', 'Ek icon', 'Ek pixel', 'Koi bhi nahi'], 0],
    ['GUI par aadharit prachalan tantra ka naam batayein?', ['MS DOS', 'MS Windows', 'UNIX', 'All of these'], 1],
    ['Windows 10 ke sath maujood browser ka naam hai?', ['Internet Explorer', 'Mozilla', 'Microsoft Edge', 'Chrome'], 2],
    ['Nimnlikhit me se kaun si function key Windows-10 me boot vikalp menu launch karne ke liye prayukt hoti hai?', ['F8', 'F10', 'F5', 'F9'], 0],
    ['Ek program se dusre program par jane ke liye kaunsi shortcut key istemal ki jati hai?', ['Ctrl + Tab', 'Ctrl + Shift', 'Alt + Shift', 'Alt + Tab'], 3],
    ['Desktop par diye icon se kaise program shuru kar sakte hain?', ['Us par double click karke', 'Us par click karne ke baad keyboard se Enter key dabakar', 'Us par click karke', 'a aur b dono'], 3],
    ['Windows ko Shut-Down karne ki shortcut key hai?', ['Alt + F4', 'Ctrl + F4', 'Win + F4', 'Ctrl + Shift + F4'], 0],
    ['Windows OS me start button ka upyog kyo kiya jata hai?', ['Device setting', 'Turn off the system', 'Run applications', 'All of above'], 3],
    ['BIOS ka prayog kiske dwara kiya jata hai?', ['Compiler dwara', 'Interpreter dwara', 'Operating system dwara', 'Application software dwara'], 2],
    ['Windows ke dialog box me agle tab par jane ke liye ........ ka istemal kiya jata hai?', ['Alt + Tab', 'Ctrl + Tab', 'Shift + Tab', 'Ctrl + Shift + Tab'], 1],
    ['Ubuntu programmer ke liye sabse achha LINUX DISTROS hai?', ['True', 'False'], 0],
    ['Ubuntu ko Canonical Limited dwara launch kiya gaya tha?', ['True', 'False'], 0],
    ['Yeh operating system ek samay me ek se jyada program ko support nahi karta hai?', ['Linux', 'Windows', 'DOS', 'Unix'], 2],
    ['LibreOffice Writer me by default font size kitna hota hai?', ['10', '11', '12', '14'], 2],
    ['LibreOffice Writer kis prakar ka software hai?', ['Operating system', 'Word processing software', 'Spreadsheet software', 'Presentation software'], 1],
    ['LibreOffice Writer document ka default extension kya hota hai?', ['.doc', '.docx', '.txt', '.odt'], 3],
    ['LibreOffice Writer me Print Preview ki shortcut key kya hai?', ['Ctrl + F2', 'Ctrl + Shift + O', 'Ctrl + F12', 'Ctrl + P'], 1],
    ['LibreOffice Writer me minimum zoom size kitna hota hai?', ['10%', '20%', '50%', '100%'], 1],
    ['LibreOffice Writer me maximum zoom size kitna hota hai?', ['200%', '400%', '500%', '600%'], 3],
    ['LibreOffice Writer me Save As ki shortcut key kya hai?', ['Ctrl + Shift + S', 'Ctrl + S', 'F12', 'Ctrl + Alt + S'], 0],
    ['LibreOffice Writer me naya document kholne ki shortcut key kya hai?', ['Ctrl + Shift + N', 'Ctrl + O', 'Ctrl + N', 'Ctrl + W'], 2],
    ['LibreOffice Writer me Spelling Check ki shortcut key kya hai?', ['F5', 'Ctrl + F7', 'Shift + F7', 'F7'], 3],
    ['LibreOffice Writer me \'Find and Replace\' ka vikalp kis menu me hota hai?', ['File', 'Edit', 'Insert', 'Format'], 1],
    ['LibreOffice Writer me \'Find and Replace\' ki shortcut key kya hai?', ['Ctrl + H', 'Ctrl + F', 'Ctrl + R', 'Ctrl + Shift + F'], 0],
    ['LibreOffice Writer me \'Word Count\' ka vikalp kis menu me milta hai?', ['Edit', 'View', 'Tools', 'Format'], 2],
    ['LibreOffice Writer me Table Insert karne ki shortcut key kya hai?', ['Ctrl + F10', 'Ctrl + T', 'Alt + T', 'Ctrl + F12'], 3],
    ['LibreOffice Writer me Superscript ki shortcut key kya hai?', ['Ctrl + Shift + P', 'Ctrl + Shift + B', 'Ctrl + P', 'Ctrl + B'], 0],
    ['LibreOffice Writer me Subscript ki shortcut key kya hai?', ['Ctrl + Shift + P', 'Ctrl + Shift + B', 'Ctrl + Shift + V', 'Ctrl + B'], 1],
    ['LibreOffice Writer me Bulleted List hatane ya lagane ki shortcut key kya hai?', ['F12', 'Ctrl + F12', 'Shift + F12', 'Alt + F12'], 2],
    ['LibreOffice Writer me Numbered List ki shortcut key kya hai?', ['F12', 'Shift + F12', 'Ctrl + F12', 'Alt + 1'], 0],
    ['LibreOffice Writer me formatting hatane (Clear Direct Formatting) ki shortcut key kya hai?', ['Ctrl + Shift + M', 'Ctrl + M', 'Ctrl + Delete', 'Alt + M'], 1],
    ['LibreOffice Writer me naya Page Break dalne ki shortcut key kya hai?', ['Ctrl + Shift + Enter', 'Shift + Enter', 'Alt + Enter', 'Ctrl + Enter'], 3],
    ['LibreOffice Writer me Line Break dalne ki shortcut key kya hai?', ['Ctrl + Enter', 'Alt + Enter', 'Shift + Enter', 'Enter'], 2],
    ['LibreOffice Writer me kisi text ko Center Align karne ki shortcut key kya hai?', ['Ctrl + E', 'Ctrl + L', 'Ctrl + R', 'Ctrl + J'], 0],
    ['LibreOffice Writer me Justify Alignment ki shortcut key kya hai?', ['Ctrl + L', 'Ctrl + E', 'Ctrl + J', 'Ctrl + R'], 2],
    ['LibreOffice Writer me Right Alignment ki shortcut key kya hai?', ['Ctrl + J', 'Ctrl + L', 'Ctrl + E', 'Ctrl + R'], 3],
    ['LibreOffice Writer me Left Alignment ki shortcut key kya hai?', ['Ctrl + R', 'Ctrl + L', 'Ctrl + E', 'Ctrl + J'], 1],
    ['LibreOffice Writer me default font style kya hota hai?', ['Liberation Serif', 'Liberation Sans', 'Times New Roman', 'Arial'], 0],
    ['LibreOffice Writer me minimum font size kitna hota hai (dropdown list me)?', ['2', '4', '6', '8'], 2],
    ['LibreOffice Writer me maximum font size kitna hota hai (dropdown list me)?', ['72', '80', '96', '100'], 2],
    ['LibreOffice Writer me kisi shabd ke niche lal line (Red Line) kya darshati hai?', ['Grammar ki galti', 'Spelling ki galti', 'Formatting ki galti', 'Link ki truti'], 1],
    ['LibreOffice Writer me kisi vakya ke niche neeli ya hari line kya darshati hai?', ['Spelling ki galti', 'Koi nahi', 'Shabd ki punravrutti', 'Grammar ki galti'], 3],
    ['LibreOffice Writer me Help ki shortcut key kya hai?', ['F2', 'F1', 'F3', 'F4'], 1],
    ['LibreOffice Writer me Navigator kholne ki shortcut key kya hai?', ['F5', 'F6', 'F7', 'F8'], 0],
    ['LibreOffice Writer me Styles Window kholne ki shortcut key kya hai?', ['F9', 'F12', 'F10', 'F11'], 3],
    ['LibreOffice Writer me Full Screen karne ki shortcut key kya hai?', ['Ctrl + Shift + J', 'Ctrl + F10', 'F11', 'Ctrl + J'], 0],
    ['LibreOffice Writer me Non-printing characters dekhne ki shortcut key kya hai?', ['Ctrl + F8', 'Ctrl + F12', 'Ctrl + F10', 'Ctrl + F9'], 2],
    ['LibreOffice Writer me Comment jodna ki shortcut key kya hai?', ['Ctrl + Shift + C', 'Ctrl + Alt + C', 'Alt + C', 'Ctrl + C'], 1],
    ['LibreOffice Writer me Hyperlink jodna ki shortcut key kya hai?', ['Ctrl + H', 'Ctrl + Shift + K', 'Ctrl + L', 'Ctrl + K'], 3],
    ['LibreOffice Writer me kitne Menus hote hain?', ['8', '9', '10', '11'], 3],
    ['LibreOffice Writer me standard toolbar par zoom ka kaun sa vikalp nahi hota hai?', ['Zoom Reset', 'Zoom Dialog', 'Zoom In/Out', 'Zoom Slider'], 0],
    ['LibreOffice Writer me template ki file extension kya hoti hai?', ['.odt', '.ods', '.ott', '.odp'], 2],
    ['LibreOffice Writer me Mail Merge ka vikalp kis menu me hota hai?', ['File', 'Tools', 'Edit', 'Format'], 1],
    ['LibreOffice Writer me kisi bhi text ko Bold karne ki shortcut key kya hai?', ['Ctrl + D', 'Ctrl + I', 'Ctrl + U', 'Ctrl + B'], 3],
    ['LibreOffice Writer me Italic karne ki shortcut key kya hai?', ['Ctrl + B', 'Ctrl + I', 'Ctrl + U', 'Ctrl + Shift + I'], 1],
    ['LibreOffice Writer me Underline karne ki shortcut key kya hai?', ['Ctrl + U', 'Ctrl + I', 'Ctrl + B', 'Ctrl + Shift + U'], 0],
    ['LibreOffice Writer me \'Cut\' karne ki shortcut key kya hai?', ['Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z'], 2],
    ['LibreOffice Writer me \'Copy\' karne ki shortcut key kya hai?', ['Ctrl + V', 'Ctrl + X', 'Ctrl + C', 'Ctrl + A'], 2],
    ['LibreOffice Writer me \'Paste\' karne ki shortcut key kya hai?', ['Ctrl + P', 'Ctrl + Shift + V', 'Ctrl + C', 'Ctrl + V'], 3],
    ['LibreOffice Writer me \'Undo\' karne ki shortcut key kya hai?', ['Ctrl + Z', 'Ctrl + Y', 'Ctrl + U', 'Ctrl + Shift + Z'], 0],
    ['LibreOffice Writer me \'Redo\' karne ki shortcut key kya hai?', ['Ctrl + Z', 'Ctrl + Y', 'Ctrl + R', 'Ctrl + Shift + Y'], 1],
    ['LibreOffice Writer me document ko Print karne ki shortcut key kya hai?', ['Alt + P', 'Ctrl + Shift + P', 'Ctrl + P', 'Ctrl + Shift + O'], 2],
    ['LibreOffice Writer me Select All ki shortcut key kya hai?', ['Ctrl + S', 'Alt + A', 'Ctrl + Shift + A', 'Ctrl + A'], 3],
    ['LibreOffice Writer me paragraph ko Double Line Spacing dene ki shortcut key kya hai?', ['Ctrl + 1', 'Ctrl + 2', 'Ctrl + 5', 'Ctrl + 0'], 1],
    ['LibreOffice Writer me Single Line Spacing ki shortcut key kya hai?', ['Ctrl + 1', 'Ctrl + 2', 'Ctrl + 5', 'Ctrl + 0'], 0],
    ['LibreOffice Writer me 1.5 Line Spacing ki shortcut key kya hai?', ['Ctrl + 1', 'Ctrl + 5', 'Ctrl + 2', 'Ctrl + 1.5'], 1],
    ['LibreOffice Writer me Drop Cap ka vikalp kis menu me hota hai?', ['Insert', 'Tools', 'Format', 'View'], 2],
    ['LibreOffice Writer me adhiktam kitne Drop Cap lines set ki ja sakti hain?', ['5', '9', '10', '15'], 2],
    ['LibreOffice Writer me Header aur Footer ka vikalp kis menu me hota hai?', ['File', 'Edit', 'Format', 'Insert'], 3],
    ['LibreOffice Writer me by default Drop Cap lines kitni hoti hain?', ['1', '2', '3', '4'], 2],
    ['LibreOffice Writer me Page Number jodna ka vikalp kahan milta hai?', ['Insert', 'File', 'Format', 'Tools'], 0],
    ['LibreOffice Writer me Digital Signature ka vikalp kis menu me hota hai?', ['Tools', 'File', 'Edit', 'Insert'], 1],
    ['LibreOffice Writer me kisi image ko insert karne ki shortcut key kya hai?', ['Koi shortcut nahi (Insert -> Image)', 'Ctrl + I', 'Ctrl + Alt + I', 'Ctrl + Shift + I'], 0],
    ['LibreOffice Writer me Sidebar ko Toggle (On-Off) karne ki shortcut key kya hai?', ['Ctrl + F8', 'Ctrl + F6', 'Ctrl + F7', 'Ctrl + F5'], 3],
    ['LibreOffice Writer me \'Formatting Marks\' ko ON/OFF karne ki shortcut key kya hai?', ['Ctrl + F8', 'Ctrl + F10', 'Ctrl + F12', 'Ctrl + F2'], 1],
    ['LibreOffice Writer me table ki row ki unchai badhane ya hatane ke liye kis key ka prayog kiya jata hai?', ['Alt + Arrow Keys', 'Ctrl + Arrow Keys', 'Shift + Arrow Keys', 'None'], 0],
    ['LibreOffice Writer me table me ek cell se dusre cell me aage jane ke liye kis key ka prayog hota hai?', ['Spacebar', 'Enter', 'Shift + Tab', 'Tab'], 3],
    ['LibreOffice Writer me table me ek cell se pichhe jane ke liye kis key ka prayog hota hai?', ['Tab', 'Shift + Tab', 'Ctrl + Tab', 'Alt + Tab'], 1],
    ['LibreOffice Writer me Protect Document ka vikalp kahan hota hai?', ['Tools', 'Edit', 'File', 'Window'], 2],
    ['LibreOffice Writer me koi text select karke F3 dabane se kya hota hai?', ['AutoText insert hota hai', 'Spelling check hoti hai', 'Find and Replace khulta hai', 'Case badalta hai'], 0],
    ['LibreOffice Writer me Case badalne (Change Case) ki shortcut key kya hai?', ['F3', 'Ctrl + F3', 'Alt + F3', 'Shift + F3'], 3],
    ['LibreOffice Writer me Zoom Slider window me kahan sthit hota hai?', ['Top Right Corner', 'Top Left Corner', 'Bottom Left Corner', 'Bottom Right Corner'], 3],
    ['LibreOffice Writer me \'Save\' karne ki shortcut key kya hai?', ['Ctrl + S', 'Ctrl + Shift + S', 'Alt + S', 'F12'], 0],
    ['LibreOffice Writer me font size badhane (Increase Font Size) ki shortcut key kya hai?', ['Ctrl + [', 'Ctrl + ]', 'Ctrl + Shift + >', 'Ctrl + Shift + <'], 1],
    ['LibreOffice Writer me font size ghatane (Decrease Font Size) ki shortcut key kya hai?', ['Ctrl + ]', 'Ctrl + Shift + >', 'Ctrl + [', 'Ctrl + Shift + <'], 2],
    ['LibreOffice Writer me comment box hatane ya delete karne ka vikalp kahan hota hai?', ['File Menu', 'Edit Menu', 'Comment Menu', 'View Menu'], 2],
    ['LibreOffice Writer me kisi bhi file ko password protected roop me kis format me save kiya jata hai?', ['.odt', 'Password vikalp keval .odt save karte samay milta hai', '.pdf', '.txt'], 1],
    ['LibreOffice Writer me kul kitne default heading styles hote hain?', ['3', '5', '6', '10'], 2],
    ['LibreOffice Writer me Auto Correction ka feature kis menu me hota hai?', ['Tools', 'Edit', 'Format', 'View'], 0],
    ['LibreOffice Writer me by default margin kitna hota hai?', ['0.5 inch', '0.75 inch', '1 inch', '1.5 inch'], 2],
    ['LibreOffice Writer me Page Orientation by default kya hota hai?', ['Legal', 'Landscape', 'Square', 'Portrait'], 3],
    ['LibreOffice Writer me kaun sa View uplabdh nahi hota hai?', ['Normal View', 'Slide Sorter', 'Web Layout', 'Print Layout'], 1],
    ['LibreOffice Writer me Footnote aur Endnote ka vikalp kis menu me hota hai?', ['Format', 'Edit', 'Tools', 'Insert'], 3],
    ['LibreOffice Writer me Footnote document me kahan dikhai deta hai?', ['Page ke ant me (Bottom of Page)', 'Document ke ant me', 'Har page ke header me', 'Har page ke footer me'], 0],
    ['LibreOffice Writer me Endnote document me kahan dikhai deta hai?', ['Page ke ant me', 'Document ya chapter ke ant me', 'Header me', 'Footer me'], 1],
    ['LibreOffice Writer me Thesaurus ki shortcut key kya hoti hai?', ['F7', 'Shift + F7', 'Alt + F7', 'Ctrl + F7'], 3],
    ['LibreOffice Writer me Thesaurus ka prayog kiske liye kiya jata hai?', ['Paryayvachi aur Vilom shabd (Synonyms & Antonyms)', 'Spelling check', 'Grammar check', 'Word count'], 0],
    ['LibreOffice Writer me naya folder banane ka vikalp kis dialog box me milta hai?', ['Save As dialog box', 'Print dialog box', 'Open dialog box', 'Dono Save As aur Open'], 3],
    ['LibreOffice Writer me kisi text ke beech se line kheenchna kya kehlata hai?', ['Underline', 'Strikethrough', 'Superscript', 'Subscript'], 1],
    ['LibreOffice Writer me Shadow effect ki shortcut key kya hai?', ['Koi seedhi shortcut key nahi hai', 'Ctrl + Shift + S', 'Alt + S', 'Ctrl + D'], 0],
    ['LibreOffice Writer me Bold, Italic, Underline ke alawa text effect me kaun sa vikalp hota hai?', ['Strikethrough', 'Overline', 'Both Strikethrough & Overline', 'None'], 2],
    ['LibreOffice Writer me \'Go to Page\' ki shortcut key kya hai?', ['Ctrl + G', 'Ctrl + Shift + G', 'F5', 'Ctrl + F5'], 0],
    ['LibreOffice Writer me Macro record karne ka vikalp kis menu me hota hai?', ['File', 'Edit', 'Tools', 'View'], 2],
    ['LibreOffice Writer me Macro ki shortcut key kya hoti hai?', ['Shift + F11', 'Alt + F11', 'Ctrl + F11', 'Koi default shortcut key nahi hoti'], 3],
    ['LibreOffice Writer me kisi document ko seedhe PDF me export karne ka icon kahan hota hai?', ['Formatting Toolbar', 'Standard Toolbar', 'Menu Bar', 'Status Bar'], 1],
    ['LibreOffice Writer me seedhe PDF export karne ki shortcut key kya hoti hai?', ['Koi default shortcut key nahi hoti', 'Ctrl + P', 'F12', 'Ctrl + Shift + E'], 0],
    ['LibreOffice Writer me sidebar me kul kitne panes hote hain?', ['Keval 1', 'Keval 2', 'Keval 4', 'Lagbhag 6 ya adhik'], 3],
    ['LibreOffice Writer me Ruler ko ON/OFF karne ki shortcut key kya hai?', ['Ctrl + R', 'Ctrl + Shift + R', 'Ctrl + F1', 'Alt + R'], 1],
    ['LibreOffice Writer me Manage Templates ki shortcut key kya hai?', ['Alt + N', 'Ctrl + N', 'Ctrl + Shift + N', 'Ctrl + M'], 2],
    ['LibreOffice Writer me kisi object ko delete karne ke liye kis key ka prayog hota hai?', ['Delete', 'Backspace', 'Both Delete and Backspace', 'Ctrl + D'], 2],
    ['LibreOffice Writer me paragraph indent badhane ki shortcut key kya hai?', ['Shift + Tab', 'Ctrl + M', 'Ctrl + Shift + M', 'Tab'], 3],
    ['LibreOffice Writer me bullet list se bahar aane ke liye ya do bar Enter dabane se kya hota hai?', ['Naya page ban jata hai', 'Bullet list samapt ho jati hai', 'Text bold ho jata hai', 'Kuch nahi hota'], 1],
    ['LibreOffice Writer ke sambandh me inme se kaun sa kathan asatya hai?', ['Isme spreadsheet jaisi formula bar hoti hai', 'Isme mail merge ka vikalp hota hai', 'Aap password se surakshit document save kar sakte hain', 'Yeh ek free aur open source software hai'], 0],
    ['In Calc, Rename Sheet option available in which menu?', ['File', 'Sheet', 'Data', 'Format'], 1],
    ['In LibreOffice the Formula which shows 16% of the value in A1 is', ['A1%16', 'A1%16', 'A1#16%', 'A1*16%'], 3],
    ['In Calc the default number of sheets is', ['2', '3', '1', '5'], 2],
    ['In LibreOffice Calc what is the default Title name?', ['Untitled 1', 'Title1', 'Book1', 'Sheet1'], 0],
    ['In Calc the default font size is', ['10', '11', '12', '15'], 0],
    ['In LibreOffice Calc which shortcut key is use to open the cell format dialog box?', ['Shift + 1', 'Ctrl + Alt + 1', 'Alt + 1', 'Ctrl + 1'], 3],
    ['In LibreOffice Calc, which shortcut key is use to insert the Time?', ['Ctrl + ;', 'Ctrl + Shift + ;', 'Ctrl + T', 'None of these'], 1],
    ['Which shortcut key is use to open a new Spreadsheet?', ['Ctrl + Shift + N', 'Shift + N', 'Ctrl + N', 'Shift + Alt + N'], 2],
    ['In Calc which shortcut key is use to save as a program?', ['Ctrl + S', 'Ctrl + Shift + S', 'Shift + Alt + S', 'None of these'], 1],
    ['In LibreOffice Calc, Merge Cells command available in which menu?', ['Sheet', 'Style', 'Format', 'Edit'], 2],
    ['Which shortcut key is use to delete a cell in LibreOffice Calc?', ['Ctrl + +', 'Delete', 'Ctrl + D', 'Ctrl + -'], 3],
    ['In Calc, Freeze Rows and Columns option available in which menu?', ['View', 'File', 'Format', 'Data'], 0],
    ['In Calc, the last Column label is', ['ALZ', 'AMA', 'AMJ', 'ALX'], 2],
    ['The total number of Columns in Calc is', ['10241', '1024', '48523', 'None of these'], 1],
    ['In Calc, the name of the Cell made by the intersection of last column and last row is', ['AMJ65536', 'AMX1048576', 'AMJ1024', 'AMJ1048576'], 3],
    ['In Calc which shortcut key you press to change the number format as date?', ['Ctrl + Shift + 3', 'Ctrl + 1', 'Ctrl + Shift + 5', 'All of these'], 0],
    ['In Calc which shortcut key is used to insert a function?', ['F2', 'F3', 'Ctrl + F3', 'Ctrl + F2'], 3],
    ['What is the default height of a Row in Calc?', ['0.18', '0.23', '0.25', '0.21'], 0],
    ['What is the default width of a column in Calc?', ['0.84', '0.79', '0.89', 'None of these'], 1],
    ['In Calc the maximum zoom size is', ['200%', '400%', '500%', '600%'], 1],
    ['Which shortcut key is use to open the Format Cell?', ['Ctrl + 2', 'Ctrl + 3', 'Ctrl + 1', 'Ctrl + 4'], 2],
    ['Which is the last menu in Calc?', ['Help', 'Format', 'View', 'Sheet'], 0],
    ['Font Size, Font Face, Bold, Italic etc. options available in which Toolbar?', ['Standard', 'Drawing', 'Formatting', 'None of these'], 2],
    ['In Calc which shortcut key is use to select the whole worksheet?', ['Ctrl + A', 'Ctrl + Shift + Space', 'Ctrl + Space', 'Both A and B'], 3],
    ['You can change the user interface in Calc Program with....?', ['Single Toolbar', 'Tabbed', 'Tabbed Compact', 'All of these'], 3],
    ['The shortcut key to open a new Template in Calc program is', ['Ctrl + Shift + N', 'Ctrl + Alt + N', 'Ctrl + N', 'None of these'], 0],
    ['Protect Sheet option available in which menu?', ['View', 'File', 'Tools', 'Sheet'], 2],
    ['The shortcut key to hide the sidebar in Libre Office Calc is', ['Ctrl + F3', 'Ctrl + F5', 'Ctrl + F7', 'Shift + F5'], 1],
    ['In Libre Office Calc, the shortcut key to convert a number in a Cell into Date is?', ['Ctrl + Shift + F3', 'Ctrl + Alt + 3', 'Ctrl + Shift + 3', 'None of these'], 2],
    ['What you press to exit from LibreOffice Calc?', ['Ctrl + X', 'Ctrl + W', 'Ctrl + R', 'None of these'], 1],
    ['In LibreOffice Calc the maximum Cell in a worksheet is?', ['No Limit', '1,073,741,842', '1,073,824,741', '1,073,741,824'], 3],
    ['In LibreOffice Calc, you press which key with Ctrl to insert a new line or paragraph in a Cell?', ['Enter', 'Alt', 'Tab', 'Shift'], 0],
    ['What is the default file extension for a spreadsheet in LibreOffice Calc?', ['.odp', '.odd', '.ods', '.odt'], 2],
    ['In LibreOffice Calc a formula start with a symbol', ['=', '$', '&', '%'], 0],
    ['What is the result of the formula =COUNT(B1:B3)? Where B1=5, B2=4, B3=6', ['15', '3', '4', '5'], 1],
    ['What is the result of the formula =MAX(B1:B3)+MIN(B1:B3)? Where B1=5, B2=2, B3=7', ['7,2', '7+2', '5,7', '9'], 3],
    ['In LibreOffice Calc if the value is large then the Cell, then what is the result?', ['%%%%', '####', '&&&&', '#Name?'], 1],
    ['In LibreOffice Calc the address of any Cell is shown in?', ['Formula Bar', 'Address Book', 'Name Box', 'None of these'], 2],
    ['What is the result of the Formula =Product(80,-5)?', ['-400', '400', 'Null', 'None of these'], 0],
    ['In LibreOffice Calc the Alignment of a Non numeric value is', ['Right', 'Justified', 'Center', 'Left'], 3],
    ['If the Cell address is changed when you copy a formula then the formula is known as', ['Absolute Address', 'Relative Address', 'Mixed Address', 'Dynamic Address'], 1],
    ['In LibreOffice Calc, the maximum number of Row and Column is', ['1024 & 1048576', '1048576 & 16384', '16384 & 1048576', '1048576 & 1024'], 3],
    ['In Calc which shortcut key is use for print preview?', ['Ctrl + Shift + O', 'F12', 'Ctrl + F12', 'Ctrl + O'], 0],
    ['In Calc, the toolbar which has the commands like save, open, print, cut, copy etc. is called?', ['Formatting Toolbar', 'Drawing Toolbar', 'Standard Toolbar', 'None of these'], 2],
    ['Which shortcut key is use to select the complete Row?', ['Ctrl + Space', 'Ctrl + Shift + End', 'Shift + Space', 'None of these'], 2],
    ['In LibreOffice which shortcut key is use for comment?', ['Ctrl + Alt + C', 'Ctrl + C', 'Ctrl + Shift + T', 'Ctrl + Shift + C'], 0],
    ['In LibreOffice Calc, the shortcut key to convert a number into currency format is?', ['Ctrl + Shift + 1', 'Ctrl + Shift + 4', 'Ctrl + Shift + 5', 'Ctrl + Shift + 3'], 1],
    ['How many maximum sheets you can insert in LibreOffice Calc?', ['1000', '1024', 'No Limit', '10000'], 3],
    ['In LibreOffice Calc you can write maximum characters in a Cell.', ['32767', '32654', '356547', 'None of these'], 0],
    ['In LibreOffice Calc which shortcut key is use to clear direct format?', ['Ctrl + V', 'Ctrl + 1', 'Ctrl + Shift + F', 'Ctrl + M'], 3],
    ['Where is the name box in LibreOffice Calc?', ['On the Status bar', 'Left side over the Menu bar', 'Left side under the Menu bar', 'Right side under the Menu bar'], 2],
    ['Which shortcut key is use to move to the next sheet?', ['Tab', 'Ctrl + Tab', 'Ctrl + Shift + Tab', 'Shift + Tab'], 1],
    ['In LibreOffice Calc which shortcut key is use to highlight a value?', ['Ctrl + F6', 'Ctrl + F8', 'Ctrl', 'Ctrl + F1'], 1],
    ['In LibreOffice Calc the address of the last Cell is', ['$D$10', 'SAMD$1048576', 'XFD1048576', 'AMJ1048576'], 3],
    ['In LibreOffice Calc, to split a merged cell click button after selecting the cell', ['Center', 'Split', 'Merge and Center', 'Split and Merge'], 2],
    ['In Spreadsheet which shortcut key is use to select the row of the selected cell.', ['Shift + Space Bar', 'Ctrl + Space Bar', 'Shift + +', 'Ctrl + +'], 0],
    ['In Calc the process to combine two cells in one, is called', ['Join Cells', 'Merge Cells', 'Join Table', 'Merge Table'], 1],
    ['In LibreOffice Calc which shortcut key is use to move to the left of a cell?', ['Shift + Tab', 'Tab', 'Alt', 'Alt + Tab'], 0],
    ['In LibreOffice Calc, the intersection of a Row and Column is called', ['Book', 'Table', 'Sheet', 'Cell'], 3],
    ['In LibreOffice Calc which Symbol shows after a Formula Error?', ['$', '@', '#', '%'], 2],
    ['What is the maximum number of views you can add to a Slide?', ['2', '4', '6', '10'], 1],
    ['Which shortcut key in LibreOffice Impress is used for Paste Unformatted Text?', ['Ctrl + Alt + V', 'Ctrl + Shift + V', 'Ctrl + Alt + Shift + V', 'None of these'], 2],
    ['What is the slide transition in LibreOffice Impress?', ['Letter', 'A type of slide', 'Over head', 'A special effect used to show a slideshow'], 3],
    ['In LibreOffice Impress the shortcut key for print preview of a presentation is?', ['Ctrl + Shift + P', 'Ctrl + P', 'Ctrl + Shift + F12', 'None of these'], 0],
    ['LibreOffice Impress presentation can be exported in which format?', ['BMP', 'PDF', 'GIF', 'All'], 3],
    ['In LibreOffice Impress the default Title name of a presentation is?', ['Untitled 1', 'Presentation 1', 'Untitle', 'Document 1'], 0],
    ['In LibreOffice Impress the minimum zoom size is?', ['5%', '10%', '15%', '20%'], 0],
    ['The slide sorter option available in which menu of LibreOffice Impress?', ['Insert', 'View', 'Format', 'Slide show'], 1],
    ['Which transition effect is not available in LibreOffice Impress?', ['Fade', 'Dissolve', 'Fly in', 'Diagonal'], 2],
    ['Using which option do all the slides appear simultaneously?', ['Print preview', 'Slide sorter', 'Handouts', 'None of these'], 1],
    ['In LibreOffice Impress which shortcut key is used for duplicate slide?', ['Ctrl + S', 'Ctrl + D', 'Ctrl + Shift + D', 'None of these'], 2],
    ['Which shortcut key is used to add a new slide in LibreOffice Impress?', ['Ctrl + N', 'Ctrl + T', 'Ctrl + S', 'Ctrl + M'], 3],
    ['The default template in LibreOffice Impress Presentation is?', ['Image', 'Content only', 'Title and content', 'Title only'], 2],
    ['In LibreOffice Impress which shortcut key is used to repeat the slide show continuously?', ['Loop', 'Repeat', 'Move', 'None'], 0],
    ['Which of the following is used to organize or shorten the slides?', ['Slide Pane', 'Slide sorter view', 'Both A and B', 'None of these'], 2],
    ['Which shortcut key is used to move to the next slide?', ['Ctrl + Page up', 'Ctrl + Page Down', 'Ctrl + home', 'None of these'], 1],
    ['In LibreOffice Impress which view contains only Text?', ['Normal view', 'Slide sorter view', 'Notes view', 'Outline view'], 3],
    ['In LibreOffice Impress which option is used to remove the slide transition?', ['None Transition', 'Split Transition', 'Wipe Transition', 'Push Transition'], 0],
    ['In LibreOffice Impress the maximum number of handouts in a slide is?', ['3', '4', '6', '9'], 3],
    ['Which shortcut key is used to perform a slide show in LibreOffice Impress?', ['Alt + F5', 'F5', 'Shift + F5', 'Ctrl + F5'], 1],
    ['In LibreOffice Impress the default page orientation is?', ['Portrait', 'Vertical', 'Landscape', 'Horizontal'], 2],
    ['Which slide is used as a starting point for other slides?', ['First slide', 'Master slide', 'Last slide', 'None of these'], 1],
    ['In LibreOffice Impress which key is used to go to the previous slide?', ['Page down', 'Home', 'Enter', 'Page up'], 3],
    ['How can we go directly to the menu while the slide is running?', ['By Right click on the slide', 'By clicking on the Ribbon', 'By mouse click', 'All of the above'], 0],
    ['How to create a text box in a slide?', ['Slide -> Textbox', 'Insert -> Table -> Textbox', 'Insert -> Textbox', 'None of these'], 2],
    ['Which shortcut key is used to navigate in LibreOffice Impress?', ['Alt + F5', 'Ctrl + Shift + F5', 'Ctrl + F5', 'None of these'], 1],
    ['Which type of sound file from the following can be added to LibreOffice Impress?', ['.wav', '.log', '.dat', '.drv'], 0],
    ['The macros command is available in which menu of LibreOffice Impress?', ['Slide menu', 'Insert menu', 'View menu', 'Tools menu'], 3],
    ['In LibreOffice Impress which shortcut key is used to go to the first slide of the presentation?', ['Ctrl + Home', 'Home', 'Shift + Home', 'Both A and B'], 1],
    ['Which of the following view is not available in LibreOffice Impress?', ['Slide sorter view', 'Slide show view', 'Sorter view', 'None of these'], 2],
    ['Which of the following option is used to set the time for each object in a slide?', ['View -> Animation', 'Slide show -> Custom Transition', 'Format -> Animation', 'Slide show -> Slide Transition'], 0],
    ['In LibreOffice Impress the shortcut key Ctrl + E is used for?', ['Right Align', 'Center Align', 'Left Align', 'None of these'], 1],
    ['Which menu has the option of master slide in LibreOffice Impress?', ['Format', 'Slide show', 'Slide', 'View'], 3],
    ['In LibreOffice Impress the slide transition option available in which menu?', ['View', 'Slide', 'Insert', 'Both A and B'], 3],
    ['In LibreOffice Impress which file format is not added in a presentation?', ['GIF', 'JPEG', 'HTML', 'WAV'], 2],
    ['The first slide of a presentation is known as?', ['Title Slide', 'Home Slide', 'Main Slide', 'None of these'], 0],
    ['Which alignment is not available in LibreOffice Impress?', ['Right Alignment', 'Central Alignment', 'Justification', 'Left Alignment'], 2],
    ['What is used to determine the timing on a slide in a presentation?', ['Rehearsal', 'Slide Timer', 'Slide Tool', 'Slide Timing Tool'], 0],
    ['In LibreOffice Impress the shortcut key to insert a text box is?', ['F5', 'F3', 'F4', 'F2'], 3],
    ['In LibreOffice Impress bullet and numbering option available in which menu?', ['File', 'Format', 'Slide', 'Insert'], 1],
    ['In Impress press the shortcut key for send to back any shape is?', ['Ctrl + Shift + -', 'Ctrl + Shift + [', 'Ctrl + Shift + +', 'None of these'], 0],
    ['In Impress the shortcut key for subscript is?', ['Ctrl + Shift + P', 'Ctrl + Shift + B', 'Ctrl + B', 'None of these'], 1],
    ['In Impress the Clear Direct Formatting option available in which menu?', ['File', 'Window', 'Tools', 'Format'], 3],
    ['Shortcut key to insert a new slide is?', ['Ctrl + Shift + M', 'Shift + M', 'Ctrl + M', 'Ctrl + N'], 2],
    ['Export Direct as PDF option available at?', ['Drawing Toolbar', 'Presentation', 'Standard Toolbar', 'All of these'], 2],
    ['If you want to close the Impress Presentation Window then which shortcut key you press?', ['Ctrl + W', 'Ctrl + X', 'Ctrl + B', 'None of these'], 0],
    ['Shortcut key for Presentation Slide Show ?', ['F5', 'Shift + F5', 'Both a & b', 'ctrl + F5'], 2],
    ['In Impress which menu you use to change the layout of a slide?', ['Slide Show', 'Slide', 'Tools', 'Format'], 1],
    ['Text Alignment option available in which menu?', ['View', 'Insert', 'Tools', 'Format'], 3],
    ['In Impress the Layout of a slide can be?', ['Title Only', 'Title, Content', 'Title, 4 Content', 'All of these'], 3],
    ['In Impress the minimum and maximum zoom size is?', ['5, 3000', '10, 500', '5, 3000', 'None of these'], 0],
    ['In Impress which shortcut key is use to insert a Template?', ['Ctrl + Shift + B', 'Ctrl + Shift + N', 'Ctrl + N', 'None of these'], 1],
    ['During a slide presentation, which key would you press to select one hyperlink after another?', ['Tab', 'Ctrl + K', 'Ctrl + H', 'All of the above'], 0],
    ['What is the extension name of a file saved in Impress?', ['.odt', '.ods', '.odp', '.odi'], 2],
    ['Which of the following can you use to organize or shorten a slide?', ['Slide Pane', 'Slide Sorter View', 'Both a and b', 'None of these'], 2],
    ['..... is a slide that is used as a starting point for other slides?', ['First Slide', 'Master Slide', 'Template', 'Style'], 1],
    ['In LibreOffice Impress Macros command available in which menu?', ['Insert', 'Tools', 'Slide', 'None of these'], 1],
    ['Which of the following file formats can be added to LibreOffice Impress?', ['jpeg', 'wmv', 'mpeg', 'All of above'], 3],
    ['Using which option do all slides appear simultaneously?', ['Slide Sorter', 'Print Preview', 'Handouts', 'None of these'], 0],
    ['To Remove Slide Transition we use the following ......', ['Split Transition', 'None Transition', 'Wipe Transition', 'Push Transition'], 1],
    ['Nimnlikhit me se kaun sa Telecommunication device ka ek udaharan hai?', ['Keyboard', 'Printer', 'Mouse', 'Modem'], 3],
    ['Internet ...... ka sabse prasiddh udaharan hai?', ['LAN', 'MAN', 'WAN', 'All of these'], 2],
    ['Server ve Computer hote hain, jo ...... se jude dusre Computer ko resources pradan karte hain?', ['Super Computer', 'Mainframe', 'Client', 'Network'], 3],
    ['HTTP ka sahi vistrit kaun sa hai?', ['Hyper text transfer protocol', 'Hybrid text transfer protocol', 'Higher text transfer protocol', 'Higher transfer text protocol'], 0],
    ['Browser se kya aashay hai?', ['Web par website dikhane wala program hai', 'Internet connect karne wala program hai', 'Website banane wala program hai', 'All of the above'], 0],
    ['Website ko internet par uplabdh karane ke liye iska istemal kiya jata hai?', ['Surfing', 'Web hosting', 'Searching', 'None of these'], 1],
    ['Ek Webpage kis Format me Save hote hain?', ['Java', 'Doc', 'HTML', 'All of these'], 2],
    ['TCP/IP kisse connect hota hai?', ['Server', 'Client', 'Internet', 'a & b both'], 3],
    ['Internet se jude pratyek computer me ........ hona atiaavashyak hai?', ['Pentium Processor', 'Vishisht IP Address', 'Antivirus', 'Password Suraksha'], 1],
    ['Nimnlikhit me se internet kiska prayog karta hai?', ['Circuit Switching', 'Telephone Switching', 'Packet Switching', 'Telex Switching'], 2],
    ['Yahoo aur Google kiske udaharan hain?', ['Search Engine', 'Browser', 'Newsgroup', 'Antivirus'], 0],
    ['.......... ek \'Web Server\' hai?', ['Mozilla', 'Bind', 'Postfix', 'Apache'], 3],
    ['FAT ka poora roop hai?', ['File Allocation Table', 'Find Allocation Table', 'Fix Allocation Table', 'Free Allocation Table'], 0],
    ['Nimn me se kaun sa pehla search engine tha?', ['Google', 'Netscape', 'Archie', 'Safari'], 2],
    ['Walkie-Talkie me communication kis prakar se kiya jata hai?', ['Full-duplex', 'Half-duplex', 'Simplex', 'None'], 1],
    ['Sabse vyapak roop se istemal kiya gaya protocol kaun sa hai?', ['SMTP', 'FTP', 'ISP', 'HTTP'], 3],
    ['WAN ka poora naam hai?', ['Wide Area Network', 'Wireless Area Network', 'Both a and b', 'All of these'], 0],
    ['Pratham \'Search Engine\' kaun sa tha?', ['Google', 'Archie', 'Safari', 'Netscape'], 1],
    ['WWW ka poora naam kya hai?', ['World Web Wide', 'World Wide Web', 'Both', 'All of these'], 1],
    ['URL ka poora naam kya hota hai?', ['Unlimited Resource Locator', 'United Resource Locator', 'Uniform Resource Locator', 'Unlimited Result Long'], 2],
    ['Network me data packet bhejne ke liye is device ka istemal kiya jata hai?', ['Modem', 'Hub', 'Repeater', 'Router'], 3],
    ['Internet par dusre logon se judne ke liye aam taur par hum unke ........ ka prayog karte hain?', ['Email Address ka', 'Username ka', 'Password ka', 'Domain Name ka'], 0],
    ['Ek se dusre webpage par jana kya kehlata hai?', ['Moving', 'Transferring', 'Browsing', 'Switching'], 2],
    ['Inme se Bharat me internet ki shuruat me kiska yogdan hai?', ['BSNL', 'VSNL', 'MTNL', 'None of these'], 1],
    ['Pehla Search Engine kaun sa tha?', ['Archie', 'Google', 'Yahoo', 'None of these'], 0],
    ['HTML ka poora naam hai?', ['Hyper Text Makeout Language', 'Hyper Text Markup Link', 'Hyper Text Marked Language', 'Hyper Text Markup Language'], 3],
    ['Inme se kaun network ki security ka kaam karta hai?', ['DSL', 'Telnet', 'Hub', 'Firewall'], 3],
    ['Internet se jodakne ke liye nimnlikhit me se kis prakar ka connection telephone line prayog kiya jata hai?', ['Cable', 'Satellite', 'Dial-up', 'Wireless'], 2],
    ['User dwara computer se server me file transfer karna kehlata hai?', ['Downloading', 'Sequencing', 'Accessing', 'Uploading'], 3],
    ['Router ek ........ ke saman karya karta hai?', ['Hub', 'Bridge', 'Switch', 'Repeater'], 1],
    ['Kya Yahoo ek search engine hai?', ['True', 'False'], 0],
    ['Inme se kaun sa ek web browser ka udaharan nahi hai?', ['Safari', 'Netscape Navigator', 'Google', 'Opera'], 2],
    ['Nimnlikhit me se visham ko chunein?', ['POP', 'IMAP', 'SMTP', 'FTP'], 3],
    ['Nimnlikhit me internet ka standard protocol kaun sa hai?', ['JAVA', 'Flash', 'TCP/IP', 'HTML'], 2],
    ['Pehle web browser ka naam kya tha?', ['Mosaic', 'WorldWideWeb', 'Netscape', 'Mozilla Firefox'], 1],
    ['Kis desh me sarvadhik internet upyogkarta hain?', ['China', 'United States', 'India', 'Russia'], 0],
    ['Inme se kaun sa search engine nahi hai?', ['Google', 'Mozilla', 'Yahoo', 'All'], 1],
    ['Internet se jude pratyek computer me ........ hona zaroori hai?', ['Antivirus', 'Password Protection', 'Vishisht IP Address', 'Processor'], 2],
    ['VPN ka poora naam kya hai?', ['Virtual Print Network', 'Virtual Primary Network', 'Virtual Public Network', 'Virtual Private Network'], 3],
    ['Is prakar ki topology me yadi ek computer ka network cable toot jata hai toh sampurna computer network band ho jata hai?', ['Bus', 'Ring', 'Token Ring', 'Star'], 0],
    ['\'Indian Institute of Remote Sensing\' kahan par sthit hai?', ['Dehradun', 'Sriharikota', 'Ahmedabad', 'None of these'], 0],
    ['Vyavasayik uddeshya ke liye pratibandhit domain kaun sa hai?', ['.org', '.net', '.com', '.in'], 2],
    ['OSI reference model me pai jane wali kul layer ki sankhya kitni hoti hai?', ['5', '6', '7', '9'], 2],
    ['Niche diya gaya IP Address (IPv6 example) kiska udaharan hai?', ['IPv6', 'IPv4', 'Dono', 'Kisi ka nahi'], 0],
    ['Uniform Resource Locator (URL) se kya aashay hai?', ['A hardware', 'Address of the document or page on WWW', 'A software program', 'All of these'], 1],
    ['IPv4 kitne bits ka hota hai?', ['16 bits', '5 bits', '64 bits', '32 bits'], 3],
    ['Nimn me se kiski gati sabse tej hoti hai?', ['PAN', 'LAN', 'MAN', 'WAN'], 1],
    ['http://www.google.com kiska udaharan hai?', ['An access code', 'A protocol', 'Broadband', 'URL'], 3],
    ['DNS ka poora naam hota hai?', ['Domain Name System', 'Digital Name System', 'Domain Network System', 'All of these'], 0],
    ['DSL ek ........ connection hai?', ['Internet', 'Wireless', 'Slow', 'Broadband'], 3],
    ['UMANG App ko Bharat me kab shuru kiya gaya?', ['10 Dec 2017', '23 Nov 2017', '20 Nov 2017', '5 Nov 2017'], 1],
    ['Sample123@Yahoo.com me username kaun sa hai?', ['sample', '@', 'sample123', 'Yahoo.com'], 2],
    ['Blog ke liye content likhne wale ko bolte hain?', ['Blogger', 'Blogosphere', 'Blog', 'Blogging'], 0],
    ['Hum Gmail me adhiktam kitne size ki file ko attachment kar sakte hain?', ['15MB', '20MB', '25MB', '10MB'], 2],
    ['Nimnlikhit me kaunsi \'Social Site\' ka udaharan nahi hai?', ['Twitter', 'Instagram', 'LinkedIn', 'Amazon'], 3],
    ['POS ka poora naam kya hai?', ['Picture of Sale', 'Point of Sale', 'Position of Sale', 'None of these'], 1],
    ['Server se Mail Box me e-Mail ko Download karne wala protocol hai?', ['IMAP', 'SMTP', 'POP3', 'FTP'], 2],
    ['2FA ka poora naam hai?', ['Two factor Auditions', 'Two factor Verification', 'Two factor Authorised', 'Two factor Authentication'], 3],
    ['SMTP ka prayog kis tarah ka message bhejne ke liye kiya jata hai?', ['Users terminal se', 'Users mail box', 'a aur b dono', 'None of these'], 2],
    ['Nimnlikhit me se kiska istemal USSD seva ka labh uthane ke liye kiya jata hai?', ['*198#', '*99#', '*123#', 'Koi nahi'], 1],
    ['E-Mail me mukhya content kahan hota hai?', ['Body', 'Subject', 'CC', 'BCC'], 0],
    ['LIVE Video kiske sath Stream kar sakte hain?', ['Facebook', 'Twitter', 'Instagram', 'All'], 0],
    ['E-Mail address ke User ID aur Domain Name ko kya alag karta hai?', ['$', '#', '&', '@'], 3],
    ['Alibaba kis desh ka hai?', ['Bharat', 'China', 'Russia', 'America'], 1],
    ['B2B ka poorn roop hai?', ['Business to Business', 'Both of these', 'Basic to Business', 'None of these'], 0],
    ['Bina vishay (subject) likha hua message bheja ja sakta hai?', ['True', 'False'], 0],
    ['Inme se kaun sa email ka bhag nahi hai?', ['@', 'Space ( )', 'Underscore (_)', 'All of these'], 1],
    ['........ protocol vibhinn host ke beech e-mail ki suvidha pradan karta hai?', ['TELNET', 'FTP', 'HTTPS', 'SMTP'], 3],
    ['Nimn me se kaunsi site social site nahi hai?', ['LinkedIn', 'Twitter', 'Amazon', 'Instagram'], 2],
    ['E-Governance prakriya badlav karti hai?', ['Paradarshta', 'Dakshta', 'Sabhi', 'Jawabdehi'], 2],
    ['UMANG App ka uddeshya hai?', ['Fast gaming', 'Fasttrack Mobile Governance', 'Slow gaming', 'None of these'], 1],
    ['UMANG App kitni bhashao ko support karta hai?', ['10', '11', '12', '13'], 3],
    ['UMANG App nimn sevao ko sulabh karata hai?', ['Income Tax file karna', 'Aadhaar aur PF queries solve karna', 'Gas cylinder book karna', 'All of the above'], 3],
    ['E-Mail address ka pehla bhag ........ hai?', ['Username', 'Domain Name', 'ISP', 'Nivas ka pata'], 0],
    ['Nimn me se kaun sa nishulk web aadharit e-mail seva pradata hai?', ['www.yahoo.com', 'www.gmail.com', 'Dono', 'Koi nahi'], 2],
    ['Nimn me se kaun sa internet ka sabse viral section hai?', ['Chat messenger', 'Social networking sites', 'Tutorial sites', 'Chat room'], 1],
    ['Blog par sangrah ........ hai?', ['Feeds', 'Ek blog ke sabhi elements', 'Links', 'Aapki pichhli post ka sangrah'], 3],
    ['SMTP me \'M\' ka kya arth hai?', ['Mail', 'Mailing', 'Mobile', 'All of these'], 0],
    ['Shasan ke liye computer ke prayog ko kya kahenge?', ['Internet Governance', 'E-Mail Governance', 'E-Governance', 'Computer Governance'], 2],
    ['Electronic mail address me kitne bhag hote hain?', ['Ek bhag', 'Do bhag', 'Teen bhag', 'Sabhi'], 1],
    ['IRCTC se kya aashay hai?', ['Email Seva Pradata', 'Railway Seva Pradata', 'Plastic Money', 'E-Wallet'], 1],
    ['IMPS ka poora naam kya hai?', ['Immediate Payment Service', 'Internet payment system', 'Immediate payment system', 'All of these'], 0],
    ['RTGS ke madhyam se bhugtan karne ki nyunatam rashi seema kitni hai?', ['5 Lakh', '1 Lakh', '2 Lakh', '10 Lakh'], 2],
    ['Pradhan Mantri Suraksha Bima Yojana ek durghatna aur viklangta se sambandhit bima yojana hai?', ['True', 'False'], 0],
    ['Delete kiya gaya mail punah prapt karne ke liye kaun sa folder kholna hoga?', ['Bounce mail', 'Spam', 'Junk mail', 'Trash'], 3],
    ['WordPress, ExpressionEngine aur TypePad aadi ka istemal kiske liye kiya ja sakta hai?', ['P2P file sharing', 'Blogging', 'Word processing', 'Koi nahi'], 1],
    ['Aapke dwara bheji gayi mail \'Sent\' namak folder me dikhai jaati hai?', ['True', 'False'], 0],
    ['Upbhokta aapas me sevao ka aadan-pradan karta hai, kya kehlata hai?', ['B2B', 'B2C', 'G2C', 'C2C'], 3],
    ['CRW ka poorn roop hai?', ['Continuous Web Radar', 'Continuous Wave Reader', 'Continuous Wave Radar', 'None'], 2],
    ['Social networking site par kis prakar ke log aapko mil sakte hain?', ['Politician', 'Musician', 'Adhyapak', 'All of the above'], 3],
    ['Yadi aapke paas ek PowerPoint Show hai jo aap kisi anya vyakti ko e-mail ke madhyam se bhejna chahte hain toh aap apne email message me PowerPoint Show ko kis tarah jodenge?', ['Inclusion', 'Reply', 'Attachment', 'Forward'], 2],
    ['UMANG ka poora naam kya hai?', ['Unified Mobile Application for new governance', 'Unified Mobile Application for New Age Governance', 'Unique Mobile Application for new age governance', 'None'], 1],
    ['\'Vyakti Loan\' ko kisi vyakti ke paise ya vyapar ke aadhar par nahi diya jata?', ['True', 'False'], 1],
    ['Nimnlikhit file prakaron me se kise email ke dwara bheja nahi ja sakta hai?', ['.exe', '.pdf', '.7z', '.docx'], 0],
    ['Aapke dwara bheja gaya e-mail kahan par store hota hai?', ['Inbox', 'Trash', 'Draft', 'Outbox'], 3],
    ['Tweet me ek se adhik # tag ka prayog kar sakte hain?', ['True', 'False'], 0],
    ['Gmail ke Founder kaun hain?', ['Larry Page', 'Sergey Brin', 'Paul Buchheit', 'Sundar Pichai'], 2],
    ['Facebook me jahan aapke doston ki photo dikhai deti hai use kya kehte hain?', ['Timeline', 'Story', 'Newsfeed', 'Public'], 2],
    ['Twitter me Trending ka kya symbol hota hai?', ['$', '@', '&', '#'], 3],
    ['Freeware ke do udaharan hain?', ['MS Word aur Google Toolbar', 'Instant Messenger aur Google Toolbar', 'WinZip aur Remix', 'Shareware & File Sharing'], 1],
    ['KYC ka poora naam kya hai?', ['Know Your Cash', 'Know Your Customer', 'Knowledge of Your Customer', 'None of these'], 1],
    ['Banking kshetra me adhik sankhya me chequon ke tej nistarann me sahayata karta hai?', ['OMR', 'OCR', 'Bar Code Reader', 'MICR'], 3],
    ['MMID ka poora naam kya hai?', ['Mobile Money Identify', 'Mobile Money Identifier', 'Both', 'None'], 1],
    ['Mobile Banking se sambhav hai?', ['Khaton ki bachat rashi dekhna', 'Bijli bill bhugtan', 'Fund transfer', 'All of the above'], 3],
    ['Bank dwara ........ par byaj diya jata hai?', ['Loans', 'Transactions', 'Deposits', 'Withdraw'], 2],
    ['\'Internet Banking\' ka karya nahi hai?', ['Khate se nakad nikalna', 'Khate ka vivaran dekhna', 'Rinn ke liye aavedan karna', 'Hal hi ke karya ka vivaran dekhna'], 0],
    ['Isliye, humein bankon ki zaroorat hoti hai?', ['Rinn lene hetu', 'Byaj prapt karne hetu', 'Rupaye surakshit rakhne ke liye', 'All of the above'], 3],
    ['Nimn me se kaun sa pehchan ke satyapan se sambandhit dastavez hai?', ['Driving License', 'Passport', 'PAN Card', 'All of these'], 3],
    ['ATM Debit Card par mudrit sankhya me kitne ank hote hain?', ['12', '14', '16', '10'], 2],
    ['RTGS me \'T\' ka kya arth hai?', ['Time', 'Tea', 'Today', 'Transfer'], 0],
    ['Aadhaar se aashay hai?', ['UIDAI dwara jari pehchan patra', '12 ankon ka sankhya card hai', 'Ek bachat khata', 'a aur b dono'], 3],
    ['Bank me khata kholne ke liye KYC manadandon ki poorti ke liye nimnlikhit me kin dastavezon ko aadharik roop se vaidha mana gaya hai?', ['Aadhaar Number', 'Passport', 'PAN', 'All of the above'], 3],
    ['QR Code ka prayog pehli bar kab hua?', ['1990', '1993', '1994', '1995'], 2],
    ['DFT ka poora roop kya hai?', ['Digital Financial Tools', 'Digital Dynamic Tools', 'Dynamic Financial Tools', 'None'], 0],
    ['Credit karna kisse sambandhit hai?', ['Cash nikalna', 'Bank me paise jama karna', 'Debit', 'None of these'], 1],
    ['ITZ Cash kis bank dwara adhikrit mobile wallet hai?', ['RBI', 'SBI', 'Finance Ministry', 'GOI'], 0],
    ['Bank dwara ........ par byaj liya jata hai?', ['Jamao par', 'Rinn par', 'Dono par', 'None of these'], 1],
    ['Maestro Card Number kitne ank ke hote hain?', ['22', '20', '19', '18'], 2],
    ['IMEI ka poora naam kya hai?', ['International Mobile Equipment Identity', 'International Mobile Electronic Identity', 'Internet Mobile Equipment Identity', 'None'], 0],
    ['Credit Card ko aur kis naam se jaante hain?', ['Soft Money', 'Plastic Money', 'Hard Money', 'Easy Money'], 1],
    ['Chikitsalay me online panjeekaran kiske madhyam se hota hai?', ['Internet', 'Calc', 'HMIS', 'SMIS'], 2],
    ['Full form of UIDAI?', ['University Identification Authority of India', 'Unique Information Authority of India', 'Unique Identification Authority of India', 'None'], 2],
    ['Bank bachat jama par byaj diya jata hai?', ['Timahi', 'Pratimah', 'Ardhvarshik', 'Varshik'], 0],
    ['Kya dial karke USSD seva ka labh utha sakte hain?', ['*121#', '*99#', 'A And B', '#123*'], 2],
    ['BHIM ka poora naam kya hai?', ['Unified Payment Interface', 'Bharat Interface for Money', 'International Banking Payment', 'Bharatiya Interface Money'], 1],
    ['QR Code ko kab aur kisne viksit kiya?', ['Richard Denis, 1998', 'Mark Denis, 1995', 'Denso Mark, 1995', 'Denso Wave, 1994'], 3],
    ['QR Code me kitne number sangrahit kiye ja sakte hain?', ['7089', '5028', '1024', 'Koi seema nahi'], 0],
    ['QR Code me kitne alphanumeric word sangrahit kiye ja sakte hain?', ['4296', '5028', '7089', '10000'], 0],
    ['Pockets kis bank ke dwara shuru kiya gaya tha?', ['HDFC', 'ICICI', 'PNB', 'SBI'], 1],
    ['Nakad nikasi ke liye debit card aur credit card ka prayog kar sakte hain?', ['True', 'False'], 0],
    ['ATM se kya aashay hai?', ['Bina staff ke nakadi dena', 'Bankon me staff mukt yukta counter', 'Bankon ki shakhaein', 'None of these'], 2],
    ['PAN ka poora naam kya hai?', ['A kind of account', 'Primary Account Number', 'Position Account Number', 'Permanent Account Number'], 3],
    ['\'Vyaktigat Loan\' kisi vyakti ke paise ya vyapar ke aadhar par diya jata hai?', ['True', 'False'], 0],
    ['NABARD kisse sambandhit hai?', ['Bank', 'Rinn dene wali sanstha', 'Rinn lene wali sanstha', 'None of these'], 1],
    ['AEPS ka poora naam kya hai?', ['Annual Premium Equivalent System', 'Aadhaar Payment Enabled System', 'Aadhaar Premium Enabled System', 'Aadhaar Enabled Payment System'], 3],
    ['Bank dwara jari kiye jane wale OTP me kitni sankhyaein hoti hain?', ['4', '5', '6', '8'], 2],
    ['OTP ki samay seema kitni hoti hai?', ['5 Minute', '10 Minute', '30 Minute', 'None'], 1],
    ['OTP kahan bheja jata hai?', ['Panjeekrit mobile par', 'Panjeekrit email par', 'a tatha b dono par', 'Kisi bhi mobile par'], 2],
    ['Rupaye ko ek jagah se dusri jagah par bhejne ka surakshit madhyam hai?', ['Demand Draft', 'Cheque', 'Dono', 'Koi nahi'], 2],
    ['UPI se kya aashay hai?', ['Immediate Payment Interface', 'Unified Payments Interface', 'Unfind Pay Interface', 'None of these'], 1],
    ['Bharat me pratham ATM lagaya gaya tha?', ['1980', '1985', '1987', '1990'], 2],
    ['Nimnlikhit ka prayog bankon me cheque aur draft me kiya jata hai?', ['CPU', 'Bar Code', 'OMR', 'MICR'], 3],
    ['UPI ki shuruat kiske dwara ki gayi?', ['UIDAI', 'NPCI', 'Both', 'None'], 1],
    ['Vyapariyon dwara apne grahakon ka pushtikaran KYC kehlata hai?', ['True', 'False'], 0],
    ['Nimnlikhit me se kaun sa karya ATM nahi karta hai?', ['Shikayat', 'Mini Statement', 'Niyamit bill bhugtan', 'Nakad jama'], 3],
    ['Mobile Banking seva hai?', ['Bhugtan', 'Balance ki jaanch', 'Khata lenden', 'All of the above'], 3],
    ['ABRS stand for?', ['Aadhaar Based Reserve Service', 'Aadhaar Based Remittance Service', 'Aadhaar Based Reserve Software', 'None of these'], 1],
    ['QR Code ka kya arth hai?', ['Quick Response Code', 'Quick Register Code', 'Quick Random Code', 'None of these'], 0],
    ['IFSC Code me kitne ank hote hain?', ['11', '14', '16', '15'], 0],
    ['IDS ka poora naam kya hai?', ['Intrusion Detection System', 'International Detection System', 'Intrusion Detection Server', 'None'], 2],
    ['WPS ka poora naam kya hai?', ['Wi-Fi protected system', 'Wi-Fi protocol setup', 'Wireless protected setup', 'Wi-Fi Protected Setup'], 3],
    ['Aapko ek SMS bhejkar aapke mobile se paise kaat sakta hai?', ['IM Trojans', 'SMS Trojans', 'Backdoor Trojans', 'Ransom Trojans'], 1],
    ['Firewall ka prayog ...... se bachne ke liye kiya jata hai?', ['Data chalit hamle', 'Virus ke hamle', 'Aag ka hamla', 'Anadhikrit hamle'], 3],
    ['...... internet par upyogkarta gatividhi par nazar rakhta hai aur uski jankari ko kisi aur ko sanchalit karta hai?', ['Spyware', 'Adware', 'Malware', 'None of these'], 0],
    ['FSP (Future Skills Portal) ko kiske dwara launch kiya gaya?', ['WIPRO', 'NIELIT', 'NASSCOM', 'HCL'], 2],
    ['DES ka poora naam kya hai?', ['Data Evaluation System', 'Data Encryption Standard', 'Data Encryption Software', 'Department of Environmental'], 1],
    ['Nimnlikhit me se kaun-si soochana praudyogiki shabdavali nahi hai?', ['Upload', 'Cyberspace', 'Prakashiy bhandaran', 'Modem'], 2],
    ['Computer virus ko pehchanein?', ['Trojan horse', 'Malware', 'Ransomware', 'All of these'], 3],
    ['Miner hai?', ['Computer jo blockchain lenden ko manne aur sansadhit karne ka karya karta hai', 'Ek algorithm jo shrankhla ke agle bhag ki bhavishyavani karta hai', 'Lenden ko satyapit karne ke liye ganana karne wala vyakti', 'Ek prakar ka Blockchain'], 0],
    ['Password ka upyog kiske liye kiya jata hai?', ['Reliability', 'Suraksha', 'Lambi avadhi', 'Performance'], 1],
    ['RPA stand for...?', ['Robotic Process Automation', 'Robotic Program Automation', 'Robotic Professional Automation', 'Robotic Process Automobile'], 0],
    ['Trojan kya hai?', ['Application Software', 'Anti-virus', 'Computer Virus', 'High Level Program'], 2],
    ['Kisi data ko ek sthan se dusre sthan par sthanantarit karne ko kya kehte hain?', ['Data Manipulation', 'Data Communication', 'Data Abstraction', 'None'], 1],
    ['Internet-of-Things se sambandhit nahi hai?', ['Data Storage Standard', 'Nijikaran', 'Cyber Security', 'Kshamta'], 3],
    ['Machine ki manaviy buddhimatta ka parikshan kis kshetra me kiya jata hai?', ['Cognitive Science', 'Manovigyan', 'Itihas', 'Samajshastra'], 0],
    ['Blockchain me \'Block\' se kya aashay hai?', ['A Hash Point', 'A Timestamp', 'Transaction Data', 'All of these'], 3],
    ['CRW ka poora naam kya hai?', ['Continuous Wave Radar', 'Continuous Wave Reader', 'Continuous Web Radar', 'None of these'], 1],
    ['Inme se kaun MQTT protocol ko suparibhashit karta hai?', ['Request / Responses', 'Mesh Networking', 'Publish / Subscribe', 'Machine to Machine (M2M)'], 2],
    ['Virus ko kaun banata hai?', ['Manav', 'Prakriti', 'Machine', 'All of the above'], 0],
    ['Big Data Analytics ki visheshta hai?', ['Open Source', 'Scalability', 'Data Recovery', 'All of these'], 3],
    ['M2M ka poorn roop hai?', ['Money to Money', 'Machine to Machine', 'Mobile to Mobile', 'None of these'], 1],
    ['Machine ki manaviy buddhimatta ka parikshan kiya jane wala kshetra hai?', ['Manovigyan', 'Samajshastra', 'Cognitive Science', 'Itihas'], 2],
    ['Aisi praudyogiki jisme user ko aisa mehsus hota hai ki ve aabhasi vatavaran me hain?', ['IR', 'RA', 'ARX', 'VR'], 3],
    ['Proxy Server ka istemal kiya jata hai?', ['Anadhikrit upyogkartao ke khilaf suraksha pradan karne ke liye', 'TCP/IP dene ke liye', 'Web page ke client request process karne ke liye', 'Database access ke liye request'], 0],
    ['Ek computer me virus ke chhipne ki jagah kahan hoti hai?', ['Application Program', 'Operating System', 'a and b', 'Disk Driver'], 2],
    ['Key Logger ........ hai?', ['Firmware', 'Spyware', 'Antivirus', 'All of the above'], 1],
    ['Ek program ya hardware device, jo internet connection ke madhyam se aane wali soochanao ko kisi network ya computer system me filter karti hai?', ['Firewall', 'Antivirus', 'Cookies', 'Cyber Safety'], 0],
    ['FSP (Future Skills Portal) kab shuru hua?', ['9th Feb 2018', '29th Feb 2018', '19th Feb 2018', '19th Nov 2018'], 2],
    ['Ek computer virus hota hai?', ['Fafoond', 'Software Program', 'IC 7344', 'Bacteria'], 1],
    ['VR stand for...?', ['Versatile Reader', 'Virtual Right', 'Version Reading', 'Virtual Reality'], 3],
    ['Hacker kaun hota hai?', ['Internet virus', 'Ek machine hota hai', 'Ek insan hota hai', 'None'], 2],
    ['Cloud Computing ke dwara ........... se aap jankari tak pahunch sakte hain?', ['Your Desktop', 'Smart Phones', 'Video Game Systems', 'All of the above'], 3],
    ['AI ka prayog kis peedhi me hua?', ['Pratham Peedhi', 'Pancham Peedhi', 'Chaturth Peedhi', 'NOTA'], 1],
    ['Malware kya hai?', ['Software', 'Hacker iska istemal data chori karne ke liye karte hain', 'Yeh hamare computer ko nuksan pahunchata hai', 'All of the above'], 3],
    ['Cloud Computing me \'Cloud\' ka arth hai?', ['Internet', 'Lock', 'Hard Drive', 'Wireless'], 0],
    ['IIoT device ko sandarbhit karne ka anya tareeka kaun sa hai?', ['Connected', 'Smart', 'Uprokt Dono', 'Koi nahi'], 2],
    ['Sochne, tark karne aur sikhne me saksham computer pranali ki visheshta kaunsi hai?', ['Machine Intelligence', 'Artificial Intelligence', 'Virtual Intelligence', 'Human Intelligence'], 1],
    ['Bitcoin ........ blockchain par aadharit hai?', ['Public', 'Swikriti Public', 'Private', 'Swikriti'], 0],
    ['Blockchain se kya aashay hai?', ['Ek exchange', 'Peer to Peer network par vitrit ek ledger', 'Ek prakar ki Cryptocurrency', 'Ek kendriya ledger'], 1],
    ['Pratham swikrit IoT device ka naam ........ tha?', ['ATM', 'Video Game', 'Radio', 'Smart Watch'], 2],
    ['Antivirus program kaun kaun se hain?', ['K7', 'Quick Heal', 'Norton', 'All of these'], 3],
    ['Kya AI ka lakshya un pranalion ka nirman karna hai jo buddhiman vyavahar pradarsit karti hain?', ['True', 'False'], 0],
    ['Kaun sa kshetra Virtual Reality dwara prabhavit nahi hai?', ['Shiksha', 'Surgery', 'Dak Seva', 'Architecture'], 2],
    ['Cloud Computing ke baare me nimnlikhit me se kaun sa sahi hai?', ['Jab tak aapke paas internet connection hai, aap duniya ke kisi bhi computer se apne data tak pahunch sakte hain', 'Yeh hamse sthaniy computing ki tulna me kam kharchila aur surakshit hai', 'Keval kuch hi chhoti companiyan nivesh kar rahi hain, jisse yeh jokhim bhara ban gaya hai', 'All of the above'], 0],
    ['IoT me kin jokhimon aur chunautiyon par vichar kiya jana chahiye?', ['Privacy & Security', 'Energy Consumption', 'Network Congestion', 'All of the above'], 3],
    ['Artificial Intelligence kisse sambandhit hai?', ['Apni soch computer me rakhna', 'Machine ko buddhiman banana', 'Apni buddhimani se ki gayi programming', 'Game khelna'], 1],
    ['Firewall ka mukhya kaam hai?', ['Deleting', 'Monitoring', 'Copying', 'Moving'], 1],
    ['Data aur Password ki suraksha kaun karta hai?', ['Authentication', 'Authorization', 'Encryption', 'Non-repudiation'], 2],
    ['Cloud Computing system ke do mukhya khand kya hain?', ['Terminal aur Nodes', 'Koi nahi', 'Network aur Server', 'Front End aur Back End'], 3],
    ['Cloud Computing kya hai?', ['Computing ka ek model jisme aapka computer terminal ke roop me karya karta hai aur server ka ek network aap ke liye processing power aur storage ko sambhalta hai', 'Yeh ek jatil mausam-mapping pranali hai jo samay ki lambi seemao par jalvayu pattern ko project karti hai', 'Yeh keval ek Local Area Network (LAN) ke liye ek fancy naam hai', 'All of the above'], 0]
  ],
  o2: [
    ['सीएसएस पैडिंग प्रॉपर्टी का उपयोग किस उद्देश्य के लिए किया जाता है ?', ['बॉर्डर', 'स्पेस', 'पृष्ठभूमि रंग', 'मार्जिन'], 1],
    ['एंगुलरजेएस एक ................... है।', ['एचटीएमएल फ्रेमवर्क', '.Net फ्रेमवर्क', 'ओरेकल फ्रेमवर्क', 'जावास्क्रिप्ट फ्रेमवर्क'], 3],
    ['नोटपैड++ में चालू पंक्ति को डुप्लीकेट करने के लिए किस शॉर्टकट कुंजी का प्रयोग किया जाता है ?', ['Ctrl+Shift+D', 'Ctrl+Alt+D', 'Ctrl+D', 'Alt+D'], 2],
    ['कौन सी CSS प्रोपेर्टी यह तय करने में मदद करती है कि टेक्स्ट को क्लिप किया जाना चाहिए, कुछ बिंदु (इलिप्सिस) दिखाएं, या एक कस्टम स्ट्रिंग प्रदर्शित करें ?', ['टेक्स्ट-ओवरफ्लो', 'टेक्स्ट-स्ट्रोक', 'टेक्स्ट-शैडो', 'टेक्स्ट-डेकोरेशन'], 0],
    ['www (वर्ल्ड वाइड वेब) का आविष्कार किसने किया ?', ['बिल गेट्स', 'ली. एन. फेयोंग', 'टॉम बेर्नेर्स ली', 'टिम बेर्नेर्स ली'], 3],
    ['इंटरनेट से जुड़ने के लिए निम्न में से क्या आवश्यक है ?', ['इंटरनेट सेवा प्रदाता', 'इंटरनेट सोसायटी', 'इंटरनेट आर्किटेक्चर बोर्ड', 'अलग कंप्यूटर'], 0],
    ['दिए गए img टैग में, दोहरे उद्धरण चिह्न के अंदर "img.png" का क्या अर्थ है ?', ['एलिमेंट', 'एट्रिब्यूट', 'वैल्यू', 'ऑपरेटर'], 2],
    ['निम्नलिखित में से कौन-सा/से मार्कअप भाषा का उद्देश्य है/हैं ? I. हाइपरटेक्स्ट क्षमताएं जोड़ना II. दस्तावेज़ को बढ़ाना III. किसी दस्तावेज़ में तत्वों को परिभाषित करने के लिए', ['केवल I', 'I, II और III', 'केवल III', 'I और II'], 1],
    ['फॉण्ट का फेस सेट करने के लिए निम्न में से किस प्रॉपर्टी का प्रयोग किया जाता है ?', ['फॉण्ट-फॅमिली', 'फॉण्ट-स्टाइल', 'फॉण्ट-वैरिएंट', 'फॉण्ट-फेस'], 3],
    ['निम्नलिखित में से कौन एक माउस इवेंट नहीं है ?', ['ऑनमाउसस्क्रोलर', 'ऑनक्लिक', 'ऑनमाउसओवर', 'ऑनमाउसमूव'], 0],
    ['निम्न में से कौन सा सही है ?', ['सीएसएस एक ऑफ़लाइन कैश की मदद से वेब एप्लिकेशन को स्थानीय रूप से स्टोर कर सकता है।', 'स्टाइल शीट सामग्री को एक से अधिक प्रकार के डिवाइस के लिए अनुकूलित करने की अनुमति देती है।', 'सीएसएस का उपयोग करके हम ऑफलाइन वेबसाइट देख सकते हैं।', 'उपरोक्त सभी।'], 1],
    ['Ctrl + + F सबलाइम टेक्स्ट एडिटर में ................... के लिए शॉर्टकट कुंजी है।', ['प्राप्त करने', 'फोल्डर में प्राप्त करने', 'फाइलों में प्राप्त करने', 'उपरोक्त में से कोई नहीं'], 2],
    ['निम्नलिखित ट्रांजिसन में, 4s क्या वर्णन करता है? transition: color .4s linear;', ['वर्ड-स्पेसिंग', 'पैडिंग', 'प्रॉपर्टी', 'अवधि'], 3],
    ['निम्नलिखित में से कौन इंटरनेट पर सर्च इंजन का उदाहरण है ?', ['एमएस ऑफिस', 'जीमेल', 'गूगल', 'विंडोज'], 2],
    ['निम्नलिखित में से किसका उपयोग एक विशिष्ट नियम को लागू करने के लिए किया जाता है और इसे सीएसएस में कभी भी ओवरराइड नहीं किया जा सकता है ?', ['!important', '!important!', '@important', 'important!'], 0],
    ['निम्नलिखित में से किसे त्रुटि नहीं माना जाता है :', ['शून्य से विभाजन', 'अर्धविराम न होना', 'सिंटेक्स की गलती', 'ब्रैकेट न होना'], 1],
    ['................... इमेज पिक्सल के रंगों को बदलकर एक इमेज का रूप बदलता है।', ['क्रोप्पिंग', 'ब्ल्लरिंग', 'फ़िल्टरिंग', 'रोटेटिंग'], 2],
    ['दस्तावेज़ के ज़ूम स्तर को बढ़ाने के लिए कीबोर्ड शॉर्टकट क्या है ?', ['Alt + the plus key (+)', 'Ctrl + the plus key (+)', 'Alt + >', 'Ctrl + z'], 1],
    ['निम्नलिखित में से कौन सीएसएस का उपयोग करके एनिमेट करना संभव नहीं है ?', ['टेक्स्ट-ट्रांसफॉर्म', 'वर्ड-स्पेसिंग', 'पैडिंग', 'विड्थ'], 0],
    ['सामान्यीकृत रंग सुधार के लिए, कौन सा कमांड एक छवि में रंगों के समग्र संयोजन को समायोजित करता है ?', ['कर्ब्स', 'वेरिएशन्स', 'दि कलर बैलेंस', 'उपरोक्त में से कोई नहीं'], 2],
    ['नीचे दिए गए सीएसएस गुणों से, टेक्स्ट को बोल्ड बनाने के लिए निम्न में से किसका उपयोग किया जाता है ?', ['Text-align: bold', 'Font-style: bold', 'Text-decoration: bold', 'Font-weight: bold'], 3],
    ['किसी भी वेबपेज से कंप्यूटर सिस्टम में फाइल ट्रांसफर को ................... कहा जाता है।', ['अपलोडिंग', 'फोर्वार्डिंग', 'ट्रांस्फरिंग', 'डाउनलोडिंग'], 3],
    ['जब <iframe> टैग का उपयोग किया जाता है, तो निम्न में से कौन सी विशेषता एम्बेड करने के लिए पृष्ठ के URL को परिभाषित करती है ?', ['pref', 'src', 'स्टाइल', 'शीर्षक'], 1],
    ['सीएसएस में इमेज पुनरावृति को नियंत्रित करने के लिए सही विकल्प है :', ['h1 {background-loop: none; }', 'h1 {background-repeat: none; }', 'h1 {background-iterate: none; }', 'उपरोक्त में से कोई नहीं'], 1],
    ['निम्नलिखित में से कौन सा कथन जावास्क्रिप्ट में ऐरेज को परिभाषित करता है ?', ['यह वैल्यूज की एक क्रमबद्ध सूची है', 'यह वस्तुओं की एक क्रमबद्ध सूची है', 'यह स्ट्रिंग की एक क्रमबद्ध सूची है', 'यह कार्यों की एक आदेशित सूची है'], 0],
    ['निम्नलिखित में से कौन सा/से कथन सत्य है/हैं ? I. वेब डिज़ाइनर को केवल रूपरंग के बारे में ही नहीं बल्कि उपयोगकर्ता इंटरफ़ेस के बारे में भी चिंतित होना चाहिए II. वेब डिज़ाइन में उपयोगिता बहुत महत्वपूर्ण है', ['केवल I', 'केवल II', 'I और II दोनों', 'उपरोक्त में से कोई नहीं'], 2],
    ['सीएसएस सिंटैक्स को ................... भागों में बांटा गया है।', ['प्रॉपर्टी नाम और वैल्यू', 'सिलेक्टर और डिक्लेरेशन', 'कलर और स्टाइल', 'इनमें से कोई नहीं'], 0],
    ['एमवीसी में एक मॉडल क्या है ?', ['डेटा को बनाए रखने के लिए अपनाई जाने वाली पद्धति का निम्नतम स्तर', 'सर्वर-साइड डेटा का प्रतिनिधित्व करता है', 'डेटाबेस में संग्रहित डेटा का प्रतिनिधित्व करता है', 'उपरोक्त में से कोई नहीं'], 3],
    ['किसी छवि को टेक्स्ट के साथ घेरने के लिए किस सीएसएस प्रॉपर्टी का उपयोग करना चाहिए ?', ['रैप', 'पुश', 'अलाइन', 'फ्लोट'], 3],
    ['एक रंग प्रणाली के रंगों की श्रेणी जिन्हें वह प्रदर्शित या प्रिंट कर सकता है वह ................... है।', ['डिथरिंग', 'कलर मॉडल', 'दि गमुट', 'उपरोक्त में से कोई नहीं'], 2],
    ['निम्नलिखित में से किस उद्देश्य (उद्देश्यों) के लिए जावास्क्रिप्ट को डिज़ाइन किया गया है ?', ['एचटीएमएल पृष्ठों में अन्तर-क्रियाशीलता जोड़ने के लिए', 'सर्वर-साइड स्क्रिप्टिंग ऑपरेशन करने के लिए', 'सर्वर पर डीबी से संबंधित क्वेरी निष्पादित करने के लिए', 'एचटीएमएल पृष्ठों को स्टाइल करने के लिए'], 0],
    ['वेब क्लाइंट वेब पेज देखने के लिए किस प्रोग्राम का उपयोग करते हैं ?', ['प्रोटोकॉल', 'वेब ब्राउज़र', 'वेब सर्वर', 'सर्च इंजन'], 1],
    ['वर्तमान एचटीएमएल दस्तावेज़ में बाहरी जावास्क्रिप्ट फ़ाइल को कॉल करने के लिए सही सिंटैक्स कौन सा है ?', ['<script link="test.js"></script>', '<script href="test.js"></script>', '<import src="test.js"></import>', '<script src="test.js"></script>'], 3],
    ['नोटपैड ++ में खुली हुई सभी फाइलों को कैसे बंद करें?', ['फाइल मेनू -> क्लोज आल', '$Ctrl+w$', 'फाइल मेनू -> क्लोज विकल्प', 'सर्च मेनू -> क्लोज आल'], 0],
    ['................... एक एचटीएमएल 5 दस्तावेज़ के लिए एक डिक्लेरेशन है।', ['<DOCTYPE html>', '</DOCTYPE html>', '<!DOCTYPE html>', '<DOCTYPE html!>'], 2],
    ['फोटोशॉप फाइल के लिए फाइल एक्सटेंशन क्या है ?', ['.pds', '.psd', '.photo', '.phsd'], 1],
    ['नीचे दिए गए डिव टैग कंटेंट स्टेटमेंट पर विचार करें, "यूजरनेम" का मान कैसे प्रिंट करेंगे ?', ['{{UserName}}', 'UserName', '{UserName}', 'UserName}'], 0],
    ['निम्नलिखित में से किस फ़ाइल प्रकार में एनिमेटेड होने की क्षमता नहीं है ?', ['.GIF', '.PSD', '.PNG', 'उपरोक्त में से कोई नहीं'], 2],
    ['W3.CSS एक मानक CSS है जिसमेंः', ['jQuery लाइब्रेरी।', 'जावास्क्रिप्ट लाइब्रेरी।', '(A) और (B) दोनों सत्य हैं।', '(A) और (B) दोनों असत्य हैं।'], 3],
    ['एंगुलरजेएस एक्सप्रेशन के बारे में निम्नलिखित में से कौन सही है ?', ['अभिव्यक्ति उसी तरह व्यवहार करती है जैसे एनजी-बाइंड निर्देश', 'एक्सप्रेशन का उपयोग एप्लिकेशन डेटा को html से बांधने के लिए किया जाता है', 'एक्सप्रेशन दोहरे ब्रेसिज़ के अंदर लिखे जाते हैं जैसे {{expression}}', 'इनमें से सभी'], 3],
    ['निम्नलिखित में से किसका प्रयोग फोटोशॉप इमेज बनाने और उसमें हेर-फेर करने के लिए किया जाता है ?', ['पेनल्स', 'लेयर्स', 'टूल्स', 'इफेक्ट्स'], 1],
    ['वेब प्रकाशन की आवश्यकता के लिए निम्नलिखित में से कौन सा विकल्प सही है ?', ['इंटरनेट कनेक्शन', 'वेब डेवलपमेंट सॉफ्टवेयर', 'वेब सर्वर', 'उपरोक्त सभी'], 3],
    ['सीएसएस का उपयोग करके सफेद रंग निर्दिष्ट करने के लिए निम्नलिखित में से कौन से तरीके मान्य हैं? I. #FFFFFF II. rgb(255, 255, 255) III. rgb(FF, FF, FF)', ['केवल I', 'केवल III', 'I और III दोनों', 'I और II दोनों'], 3],
    ['कोई किसी तत्व का फॉन्ट कैसे बदल सकता है ?', ['f:', 'Font:', 'Font-family:', 'Font:b'], 2],
    ['यदि एक पैराग्राफ के लिए params एक DOM ऑब्जेक्ट है, तो पैराग्राफ में टेक्स्ट को बदलने के लिए निम्नलिखित में से कौन सा सही सिंटैक्स है ?', ['params.content="Updated Text"', 'params.value = "Updated Text";', 'params.nodeValue = "Updated Text";', 'params.firstChlid.nodeValue = "Updated Text";'], 1],
    ['निम्नलिखित जावास्क्रिप्ट कोड का आउटपुट क्या है ? <script> var a; document.getElementById("demo").innerHTML = a + 1; </script>', ['NaN', 'undefined', '1', '0'], 0],
    ['एचटीएमएल पेज को कैसे पढ़ें और रेंडर करें ?', ['वेब ब्राउज़र के माध्यम से', 'वेब नेटवर्क के माध्यम से', 'वेब सर्वर के माध्यम से', 'वेब मैट्रिक्स के माध्यम से'], 0],
    ['स्थिति कोड के संदर्भ में निम्नलिखित में से कौन सा विकल्प गलत है ?', ['200 OK', '400 बैड रिक्वेस्ट', '304 नॉट फाउंड', '301 मूव्ड परमानेंटली'], 2],
    ['सीएसएस स्टाइल या कोड का उपयोग करके, सभी हाइपरलिंक्स से अंडरलाइन को कैसे हटाया जा सकता है ?', ['a {text-decoration: no-underline;}', 'a {text: no-underline;}', 'a {text-decoration:none;}', 'a {text-style: no-underline;}'], 2],
    ['निम्नलिखित में से कौन एक सही सीएसएस सिंटैक्स है ?', ['{body; color:orange;}', 'body{color:orange;}', 'body:color=orange;', '{body: color=orange;}'], 1],
    ['एचटीएमएल टैग ................... में संलग्न हैं।', ['? And !', '< And >', '{And}', '# And #'], 1],
    ['फोटोशॉप का कौन सा फीचर इमेज में हाल ही में हुए बदलाव को ट्रैक करता है ?', ['हिस्ट्री पैनल', 'क्रिएटिव सुइट', 'हेल्प', 'फाइल'], 0],
    ['निम्न में से कौन एक ब्राउज़र नहीं है ?', ['माइक्रोसॉफ्ट एज', 'गूगल क्रोम', 'मोज़िला फायरफॉक्स', 'गूगल मीट'], 3],
    ['एचटीएमएल 5 में निम्न में से कौन सा वीडियो फॉर्मेट है ?', ['MP5', 'wbr', 'WebM', 'None'], 2],
    ['कौन सा चयनकर्ता एक निश्चित अवस्था के आधार पर तत्वों का चयन करता है ?', ['छद्म वर्ग चयनकर्ता', 'संयोजक चयनकर्ता', 'छद्म तत्व चयनकर्ता', 'विशेषता चयनकर्ता'], 0],
    ['सीएसएस में छद्म वर्ग के लिए निम्नलिखित में से कौन सा सही है ?', ['एक निर्दिष्ट तत्व का मिलान करें', 'किसी तत्व की विशेष स्थिति को परिभाषित करने के लिए उपयोग किया जाता है', 'सभी देखे गए लिंक का चयन करने के लिए उपयोग किया जाता है', 'सक्रिय लिंक का चयन करें'], 1],
    ['एंकर एलिमेंट के निम्नलिखित में से कौन सी प्रॉपर्टी यह दर्शाती है कि उपयोगकर्ता वर्तमान में किसी एलीमेंट पर क्लिक कर रहा है?', [':link', ':active', ':hover', ':visited'], 1],
    ['सीएसएस में "color:black" को ................... के रूप में जाना जाता है :', ['वैल्यू', 'सिलेक्टर', 'डिक्लेरेशन', 'नियम'], 2],
    ['................... कंप्यूटर हैं जो एक नेटवर्क से जुड़ते हैं और अन्य कंप्यूटरों को संसाधन प्रदान करते हैं।', ['सर्वर्स', 'मेनफ्रेम', 'नेटवर्क', 'क्लाइंट्स'], 0],
    ['कौन सी सीएसएस प्रॉपर्टी निर्दिष्ट करती है कि कैसे एक वीडियो, या एक छवि को उसके सामग्री बॉक्स में फिट करने के लिए आकार दिया जाता है ?', ['ऑब्जेक्ट-फिट', 'ऑब्जेक्ट-स्थिति', 'पोजीशन', 'इनमें से कोई नहीं'], 0],
    ['इंटरनेट की उत्पत्ति ................... की अवधारणा से हुई है।', ['माइक्रोसॉफ्ट', 'आइबीएम', 'वेब', 'अरपानेट'], 3],
    ['एंगुलरजेएस में एक मॉड्यूल क्या है ?', ['एप्लीकेशन', 'एक्सप्रेशन', 'एलिमेंट', 'उपरोक्त में से कोई नहीं'], 1],
    ['सीएसएस में, सेलेक्टर्स ................... का उपयोग उन तत्वों का चयन करने के लिए किया जाता है जिन्हें आप स्टाइल करना चाहते हैं।', ['प्रॉपर्टीज', 'पैटर्न्स', 'क्लासेस', 'फंक्शन्स'], 2],
    ['जावास्क्रिप्ट में "स्काई इज ब्लू" लिखने का सही सिंटैक्स है :', ['jscript.write("Sky is blue")', 'jscript.print("Sky is blue")', 'print("Sky is blue")', 'document.write("Sky is blue")'], 3],
    ['निम्न में से किस विकल्प का उपयोग किसी छवि के कुछ हिस्सों को हटाने के लिए किया जा सकता है ?', ['प्रिंट', 'क्रॉप', 'रोटेट', 'रिसाइज'], 1],
    ['मास्क लेयर के साथ काम करते समय, एक मिटाने वाले प्रभाव के लिए, चित्र में "हटाने" और "जोड़ने" के लिए किस उपकरण का उपयोग किया जाता है ?', ['सिलेक्शन टूल', 'पेंट ब्रश', 'पेंट बकेट', 'लासो टूल'], 0],
    ['एचटीएमएल मेटाडेटा निम्न में से किस टैग में मौजूद है ?', ['<p>', '<body>', '<title>', '<Head>'], 3],
    ['कौन सी सीएसएस प्रॉपर्टी छवि की स्पष्टता को निर्दिष्ट करती है ?', ['ओवरले', 'क्लेअरफिक्स', 'ओपसिटी', 'क्लैरिटी'], 2],
    ['बाहरी स्टाइल शीट को संदर्भित करने के लिए उचित एचटीएमएल सिंटैक्स क्या है ?', ['<link rel="stylesheet" type="text/css" href="demostyle.css">', '<stylesheet>demostyle.css</stylesheet/>', '<style src="demostyle.css">', 'इनमें से कोई नहीं'], 0],
    ['HTTP का पूर्ण रूप है :', ['हाइपर ट्रांसफर टेक्स्ट प्रोटोकॉल', 'हाइपर टेक्स्ट ट्रांसफर प्रोटोकॉल', 'हाइपर टेक्स्ट ट्रांसमिशन प्रोटोकॉल', 'हाइपर ट्रांसमिशन टेक्स्ट प्रोटोकॉल'], 1],
    ['मार्की टैग ................... के लिए प्रयोग किया जाता है।', ['टेक्स्ट छिपाने के लिए', 'वस्तुओं की सूची को चिह्नित करने', 'टेक्स्ट या इमेज के अंश को स्क्रॉल करने', 'उपरोक्त में से कोई नहीं'], 2],
    ['निम्नलिखित में से कौन सा/से कथन सही है/हैं ?', ['एक आईपी पते में चार बाइट्स (या 32 बिट्स) होते हैं, जिनमें से प्रत्येक 0 से 255 तक की संख्या हो सकती है।', 'ईमेल ब्राउज़ करने या भेजने के लिए, कंप्यूटर को निर्दिष्ट एक आईपी पता आवश्यक है', 'प्रत्येक कंप्यूटर के लिए आईपी पता हमेशा अनन्य होता है।', 'सभी सही हैं।'], 3],
    ['आप सभी पैराग्राफ एलेमेंट्स को \'ग्रे\' रंग में कैसे बनाएंगे ?', ['p.all {color: grey;}', 'p.all {color: #990000;}', 'all.p {color: #998877;}', 'p {color: grey;}'], 3],
    ['निम्नलिखित में से कौन सा कोड सबसे कार्यक्षम है ?', ['कोड 1', 'कोड 2', 'कोड 1 और कोड 2 दोनों', 'तुलना नहीं कर सकता'], 0],
    ['निम्नलिखित में से HTML में कौन सा टैग सबसे बड़ी हेडिंग डालने के लिए प्रयोग किया जाता है ?', ['<h3>', '<h6>', '<h1>', '<h2>'], 2],
    ['सीएसएस का स्थिति गुण डिफ़ॉल्ट मान ................... है।', ['रिलिटिव', 'स्टेटिक', 'फिक्स्ड', 'अब्सोल्युट'], 1],
    ['निम्नलिखित मामले में क्या होगा? h1 {color: red text-decoration: underline; font-style: italic;}', ['color: red, text-decoration: underline and font-style: italic all works', 'text-decoration: underline and font-style: italic works', 'color: red, text-decoration: underline works', 'only font-style: italic works'], 0],
    ['एक सीएसएस फ़ाइल में एकाधिक लाइन टिप्पणियां कैसे सम्मिलित करें ?', ['// statement', '\'statement', '/* statement */', '// statement //'], 2],
    ['निम्नलिखित में से कौन एक टेक्स्ट एडिटर नहीं है ?', ['सबलाइम', 'पेंट', 'नोटपैड++', 'विजुअल स्टूडियो कोड'], 1],
    ['नीचे दिए गए कोड में किस प्रकार के सीएसएस का प्रयोग किया गया है ? <p style="border:2px solid red;">', ['एक्सटर्नल सीएसएस', 'इंटरनल सीएसएस', 'इनलाइन सीएसएस', 'इनमें से कोई नहीं'], 2],
    ['निम्नलिखित में से कौन सी मार्कअप भाषा SGML पर आधारित है ?', ['VHML', 'SML', 'CFML', 'XML'], 3],
    ['निम्नलिखित जावास्क्रिप्ट कोड का आउटपुट क्या होगा ? <script> var $js=10; $js*=5; document.getElementById("demo").innerHTML = js; </script>', ['10', '15', '5', '50'], 3],
    ['बॉडी बैकग्राउंड रंग के लिए किस विशेषता का उपयोग किया जाता है ?', ['बैकग्राउंड', 'बीजीकलर', 'बैक कलर', 'उपरोक्त में से कोई नहीं'], 1],
    ['किसी छवि के चारों ओर गुलाबी डॉटेड बॉर्डर बनाने के लिए किस सीएसएस विशेषता (विशेषताओं) का उपयोग करना चाहिए ? I. बॉर्डर-लाइन II. बॉर्डर-स्टाइल III. बॉर्डर-कलर', ['I', 'II', 'III', 'II और III दोनों'], 3],
    ['निम्नलिखित में से कौन एक <style> टैग है/हैं?', ['<b>', '<tt>', '<i>', 'उपरोक्त सभी स्टाइल टैग हैं'], 3],
    ['सुपरस्क्रिप्ट टेक्स्ट के लिए उपयोग किया जाने वाला एचटीएमएल टैग ................... है।', ['<sup>', '<superscript>', '<s>', '<superscripted>'], 0],
    ['निम्न में से कौन सा सही है ?', ['डेटा सेल बनाने के लिए <TR> का उपयोग किया जाता है', 'तालिकाओं में, हेडर सेल डिफ़ॉल्ट रूप से केंद्रित होता है और डेटा सेल दाई ओर-संरेखित होते हैं', 'बीआर टैग का उपयोग ब्लैंक लाइन के लिए किया जाता है', 'इनपुट टैग में कम से कम 4 एट्रीब्यूट होनी चाहिए'], 2],
    ['यदि हम निम्नलिखित दो वेरिएबल्स को जोड़ते हैं तो किस प्रकार का मान मुद्रित होता है ? var $a="10"; var $b=50;', ['टेक्स्ट', 'लॉन्ग', 'इन्टिजर', 'संख्या'], 0],
    ['किसी एलिमंट के स्टाइल को परिभाषित करने के लिए किस सीएसएस सेलेक्टर का उपयोग किया जाएगा ?', ['क्लास', 'आईडी', 'टेक्स्ट', 'नाम'], 1],
    ['एंगुलर मॉड्यूल के लिए सही सिंटेक्स कौन सा है ?', ['var variable_name=angular.modules("app_name");', 'var variable_name = angular.module("app_name", []);', 'var variable_name = angular.module();', 'var variable_name = new module();'], 1],
    ['निम्नलिखित में से कौन वेबकिट के लिए CSS एक्सटेंशन प्रीफिक्स है ?', ['-web', '-0-', '-webkit', '-chrome'], 2],
    ['इमेज पर अपना नाम लिखने के लिए किस टूल का उपयोग किया जाता है ?', ['टेक्स्ट टूल', 'ड्रा टूल', 'ट्रांसफॉर्म टूल', 'स्केच टूल'], 0],
    ['एचटीएमएल में ऑर्डर की गई सूची बनाने के लिए निम्न में से किसका उपयोग किया जाता है ?', ['<ul>', '<pl>', '<ol>', '<hl>'], 2],
    ['W3.CSS निम्न में से कौन सी बोर्डर क्लास प्रोवाइड नहीं करता है।', ['w3-border-top', 'w3-border-gutter', 'w3-border-bottom', 'w3-border-right'], 1],
    ['कौन सा कथन जावास्क्रिप्ट में var और let कीवर्ड के बीच सही अंतर निर्दिष्ट करता है ?', ['var फ़ंक्शन स्कोप्ड वेरिएबल को परिभाषित करता है जबकि let ब्लॉक स्कोप्ड वेरिएबल को परिभाषित करते हैं।', 'उनके बीच कोई बड़ा अंतर नहीं है।', 'var के साथ घोषित वेरिएबल का मान बदला जा सकता है जबकि let के साथ घोषित वेरिएबल का मान बदला नहीं जा सकता है।', 'var एक वेरिएबल को परिभाषित करता है जबकि let एक स्थिरांक को परिभाषित करता है।'], 0],
    ['वेब पर छवियों का मानक रिज़ॉल्यूशन क्या है ?', ['172 PPI', '300 PPI', '256 PPI', '72 PPI'], 3],
    ['Ctrl + + P सबलाइम टेक्स्ट एडिटर में ................... को खोलने का शॉर्टकट कुंजी है।', ['वेब ब्राउज़र', 'कमांड प्रांप्ट', 'फाइल को नाम से शीघ्र-खोलना', 'टॉगल साइडबार'], 2],
    ['निम्नलिखित में से कौन एक नेटवर्क पर मौजूद प्रत्येक कंप्यूटर द्वारा अनुसरण किए जाने वाले नियमों के सेट को परिभाषित करता है ?', ['वेब', 'एचटीटीपी', 'डोमेन', 'प्रोटोकॉल'], 3],
    ['निम्न में से कौन सा निर्देश किसी को फॉर्म का उपयोग करने की अनुमति देता है ?', ['ng-form', 'ng-app', 'ng-controller', 'ng-bind'], 0],
    ['निम्नलिखित में से कौन सा एक्सप्रेशन सही है ?', ['{ expression }', '{{ expression }}', '_expression', '({ expression })'], 1],
    ['HTML ka full form kya hota hai?', ['High Text Markup Language', 'Hyper Text Markup Language', 'Hyper Tabular Markup Language', 'None of these'], 1],
    ['HTML ke latest standard version kaun sa hai?', ['HTML4', 'XHTML', 'HTML6', 'HTML5'], 3],
    ['HTML document me sabse bada heading tag kaun sa hai?', ['<h1>', '<h6>', '<head>', '<heading>'], 0],
    ['Page break ya line change karne ke liye kaun sa tag use hota hai?', ['<break>', '<lb>', '<br>', '<newline>'], 2],
    ['Hyperlink create karne ke liye kis tag ka upyog kiya jata hai?', ['<link>', '<a>', '<href>', '<url>'], 1],
    ['Image insert karne ke liye kis tag ka use hota hai?', ['<image>', '<pic>', '<img>', '<src>'], 2],
    ['Image ka path dene ke liye kis attribute ka use hota hai?', ['path', 'href', 'url', 'src'], 3],
    ['Unordered list (bullets) banane ke liye kis tag ka use hota hai?', ['<ul>', '<ol>', '<list>', '<dl>'], 0],
    ['Ordered list (numbers) banane ke liye kis tag ka use hota hai?', ['<nl>', '<ul>', '<ol>', '<li>'], 2],
    ['List me items add karne ke liye kis tag ka use karte hain?', ['<item>', '<ol-item>', '<list-item>', '<li>'], 3],
    ['HTML document ki shuruaat kis declaration se hoti hai?', ['<html>', '<!DOCTYPE html>', '<doctype>', '<head>'], 1],
    ['Web page ka metadata (title, meta tags) kahan hota hai?', ['<head>', '<footer>', '<body>', '<section>'], 0],
    ['User ko dikhne wala sabhi content kis tag me hota hai?', ['<head>', '<meta>', '<title>', '<body>'], 3],
    ['Text ko bold karne ke liye kis tag ka use hota hai?', ['<b>/<strong>', '<dark>', '<bold>', '<black>'], 0],
    ['Text ko italic karne ke liye kaun sa tag use hota hai?', ['<italic>', '<slant>', '<i> / <em>', '<style>'], 2],
    ['Text ke niche line (underline) khichne ke liye kis tag ka use hota hai?', ['<ul>', '<U>', '<line>', '<under>'], 1],
    ['Horizontal ruler (horizontal line) add karne ka tag kaun sa hai?', ['<line>', '<hr>', '<hl>', '<border>'], 1],
    ['Table banane ke liye main tag kaun sa hai?', ['<tb>', '<tab>', '<table>', '<grid>'], 2],
    ['Table me row banane ke liye kis tag ka upyog hota hai?', ['<td>', '<th>', '<row>', '<tr>'], 3],
    ['Table me data cell banane ke liye kis tag ka use karte hain?', ['<td>', '<tr>', '<th>', '<cell>'], 0],
    ['Table header cell banane ke liye kis tag ka use hota hai?', ['<head>', '<td>', '<th>', '<thead-cell>'], 2],
    ['Form create karne ke liye kis tag ka upyog hota hai?', ['<form>', '<input-form>', '<fields>', '<text-form>'], 0],
    ['Textbox, Radio button, Checkbox banane ke liye main tag kaun sa hai?', ['<field>', '<input>', '<entry>', '<box>'], 1],
    ['Drop-down menu / Select list banane ka tag kya hai?', ['<list>', '<dropdown>', '<menu>', '<select>'], 3],
    ['Drop-down list me options add karne ke liye tag?', ['<option>', '<item>', '<choices>', '<val>'], 0],
    ['Multiline text input lene ke liye kis tag ka use hota hai?', ['<input type="text">', '<multiline>', '<textbox>', '<textarea>'], 3],
    ['Multiple items select karne ke liye input type kya hoga?', ['radio', 'checkbox', 'select', 'button'], 1],
    ['Kisi ek option ko select karne (Gender) ke liye input type?', ['text', 'checkbox', 'radio', 'one-option'], 2],
    ['Form submit karne ke liye input type kya hoti hai?', ['button', 'send', 'submit', 'post'], 2],
    ['HTML document me Comments likhne ka sahi syntax kya hai?', ['<!-- Comment -->', '// Comment', '/* Comment */', '# Comment'], 0],
    ['HTML file ka extension kya hota hai?', ['.ht', '.html ya .htm', '.web', '.doc'], 1],
    ['Inline CSS add karne ke liye kis attribute ka use hota hai?', ['css', 'class', 'design', 'style'], 3],
    ['HTML me External CSS link karne ke liye tag kaun sa hai?', ['<script>', '<css>', '<link>', '<style>'], 2],
    ['HTML me JavaScript code include karne ka tag?', ['<code>', '<js>', '<javascript>', '<script>'], 3],
    ['HTML5 me Video play karne ke liye tag?', ['<video>', '<media>', '<movie>', '<mp4>'], 0],
    ['HTML5 me Audio play karne ke liye tag?', ['<sound>', '<audio>', '<mp3>', '<music>'], 1],
    ['Image na milne par text dikhane ke liye attribute?', ['title', 'alt', 'src', 'text'], 1],
    ['Hyperlink ko new tab me kholne ke liye target attribute value?', ['_self', '_new', '_blank', '_parent'], 2],
    ['Block-level element kaun sa hai?', ['<span>', '<b>', '<p>', '<div>'], 3],
    ['Inline element kaun sa hai?', ['<span>', '<p>', '<div>', '<h1>'], 0],
    ['HTML me Void Elements (Empty Tags) kya hote hain?', ['Jinka closing tag nahi hota', 'Jo hide rehte hain', 'Jo CSS support nahi karte', 'Jinme text hota hai'], 0],
    ['Inme se kaun sa Self-Closing / Void Tag hai?', ['<p>', '<br>', '<div>', '<span>'], 1],
    ['Table cells ko horizontally merge karne ke liye attribute?', ['rowspan', 'merge', 'colspan', 'cellspan'], 2],
    ['Table cells ko vertically merge karne ke liye attribute?', ['v-merge', 'colspan', 'grid-span', 'rowspan'], 3],
    ['Text Subscript (H2O me 2) ke liye tag?', ['<sup>', '<sub>', '<down>', '<under>'], 1],
    ['Text Superscript (X^2 me 2) ke liye tag?', ['<sup>', '<sub>', '<top>', '<up>'], 0],
    ['Web page me Title icon (Favicon) set karne ka tag kahan lagta hai?', ['<body>', '<footer>', '<head>', '<title>'], 2],
    ['HTML5 Semantic tag kaun sa hai?', ['<div>', '<span>', '<font>', '<article>'], 3],
    ['Page ke sabse upar ka section define karne ka Semantic tag?', ['<banner>', '<head>', '<top>', '<header>'], 3],
    ['Page ke sabse niche ka section define karne ka Semantic tag?', ['<bottom>', '<footer>', '<end>', '<base>'], 1],
    ['Navigation links group karne ka semantic tag?', ['<menu>', '<links>', '<nav>', '<navigate>'], 2],
    ['Sidebar content ke liye HTML5 Semantic tag?', ['<aside>', '<side>', '<sidebar>', '<panel>'], 0],
    ['Form me User Password hide karne ka attribute value?', ['type="secret"', 'type="hidden"', 'type="password"', 'type="private"'], 2],
    ['HTML form me Email validate karne ka default type?', ['type="text"', 'type="mail"', 'type="validate"', 'type="email"'], 3],
    ['Form field ko compulsory (zaroori) banane ka attribute?', ['important', 'required', 'must', 'validate'], 1],
    ['Input box me faint text (hint) dikhane ka attribute?', ['placeholder', 'value', 'hint', 'text'], 0],
    ['HTML Table ka title/caption dene ka tag?', ['<title>', '<head>', '<caption>', '<summary>'], 2],
    ['Pre-formatted text (as-it-is space aur line) ka tag?', ['<code>', '<pre>', '<text>', '<format>'], 1],
    ['Single Line break bina paragraph change kiye tag?', ['<br>', '<hr>', '<p>', '<space>'], 0],
    ['HTML Document me Character Encoding define karne ka meta tag?', ['<meta encode="UTF-8">', '<meta type="UTF-8">', '<charset>UTF-8</charset>', '<meta charset="UTF-8">'], 3],
    ['Non-breaking Space (&nbsp;) ka use kyu hota hai?', ['Line break rokne ke liye', 'Tab key ke liye', 'Extra Space dene ke liye', 'New line ke liye'], 0],
    ['HTML me Special Symbols (like < or >) ke liye kya use hota hai?', ['CSS Tags', 'Meta Tags', 'HTML Entities', 'Formatting Attributes'], 2],
    ['Copyright symbol (&copy;) ki HTML entity kya hai?', ['&copyright;', '&copy;', '&copy;', '&c;'], 1],
    ['HTML5 me 2D graphics draw karne ka container tag?', ['<svg>', '<graphics>', '<draw>', '<canvas>'], 3],
    ['Scalable Vector Graphics ke liye tag kaun sa hai?', ['<svg>', '<vector>', '<canvas>', '<image>'], 0],
    ['External Web Page ko apne page me embed karne ka tag?', ['<frame>', '<embed-page>', '<iframe>', '<window>'], 2],
    ['Form me Date Select karne ka input type?', ['type="calendar"', 'type="date"', 'type="day"', 'type="time"'], 1],
    ['Form me Color Picker kholne ka input type?', ['type="picker"', 'type="rgb"', 'type="palette"', 'type="color"'], 3],
    ['Form me Slider control dikhane ka input type?', ['type="slider"', 'type="meter"', 'type="scroll"', 'type="range"'], 3],
    ['File upload karne ka input type kya hai?', ['type="upload"', 'type="file"', 'type="attachment"', 'type="doc"'], 1],
    ['Form Elements ko group (border box) me rakhne ka tag?', ['<fieldset>', '<box>', '<group>', '<form-group>'], 0],
    ['Fieldset ki heading/title dene ka tag?', ['<title>', '<caption>', '<legend>', '<head>'], 2],
    ['Input Field me predefined options (autocomplete list) dene ka tag?', ['<datalist>', '<optionlist>', '<select>', '<list>'], 0],
    ['Progress bar dikhane ka HTML5 tag?', ['<bar>', '<loading>', '<progress>', '<status>'], 2],
    ['Disk Space ya Gauge Measurement dikhane ka tag?', ['<gauge>', '<meter>', '<progress>', '<level>'], 1],
    ['Expandable / Collapsible Details dikhane ka tag?', ['<expand>', '<accordion>', '<toggle>', '<details>'], 3],
    ['<details> tag ki heading banne wala tag?', ['<title>', '<head>', '<highlight>', '<summary>'], 3],
    ['Text ko highlight (yellow background) karne ka tag?', ['<mark>', '<yellow>', '<label>', '<bg>'], 0],
    ['Deleted / Strikethrough text dikhane ka tag?', ['<strike>', '<del>', '<remove>', '<cut>'], 1],
    ['Inserted/Newly added text dikhane ka tag?', ['<add>', '<new>', '<ins>', '<underline>'], 2],
    ['Short Quotation ke liye kaun sa tag use hota hai?', ['<quote>', '<q>', '<blockquote>', '<cite>'], 1],
    ['Long/Block Quotation ke liye tag?', ['<q>', '<quote-block>', '<blockquote>', '<indent>'], 2],
    ['Abbreviation (Acronym/Short Form) ke liye tag?', ['<summary>', '<acronym>', '<short>', '<abbr>'], 3],
    ['Contact information / Address dikhane ka tag?', ['<address>', '<contact>', '<mail>', '<info>'], 0],
    ['Work / Book Title refer karne ka tag?', ['<ref>', '<title>', '<cite>', '<book>'], 2],
    ['Text Direction badalne ka tag (Bi-Directional Override)?', ['<dir>', '<reverse>', '<flip>', '<bdo>'], 3],
    ['Form me Method attribute ki default value kya hoti hai?', ['GET', 'PUT', 'POST', 'REQUEST'], 0],
    ['Secure Data Send karne ke liye Form Method kaun si honi chahiye?', ['GET', 'POST', 'PUT', 'REQUEST'], 1],
    ['Form Action attribute me kya diya jata hai?', ['Form Title', 'Server Script URL jahan data jayega', 'Button Name', 'CSS file path'], 1],
    ['Image Map banane ka tag kaun sa hai?', ['<imgmap>', '<area-map>', '<hotspot>', '<map>'], 3],
    ['Image map me clickable area define karne ka tag?', ['<zone>', '<click>', '<area>', '<point>'], 2],
    ['Inme se kaun si Global Attribute hai jo sabhi tags par lag sakti hai?', ['id/class', 'href', 'src', 'alt'], 0],
    ['Page me CSS / JS external files ki base location set karne ka tag?', ['<base>', '<root>', '<url>', '<path>'], 0],
    ['HTML Markup Validation kaun karta hai?', ['Google', 'W3C (World Wide Web Consortium)', 'Microsoft', 'ISO'], 1],
    ['Radio / Checkbox ka label click karne par select karne ka tag?', ['<text>', '<name>', '<span>', '<label>'], 3],
    ['Computer Code text ko display karne ka tag?', ['<prog>', '<script>', '<code>', '<system>'], 2],
    ['Keyboard key press (e.g. Ctrl + C) dikhane ka tag?', ['<key>', '<press>', '<kbd>', '<input>'], 2],
    ['Form ko reset (clear all fields) karne ka button type?', ['type="reset"', 'type="clean"', 'type="clear"', 'type="cancel"'], 0],
    ['HTML5 me Naya Semantic Element kaun sa nahi hai?', ['<header>', '<font>', '<section>', '<footer>'], 1],
    ['Web Designing me HTML ka main role kya hai?', ['Styling dena', 'Database manage karna', 'Programming logic chalana', 'Web Page ka Structure (Dhanacha) banana'], 3],
    ['HTML5 ka standard DOCTYPE declaration kya hai?', ['<!DOCTYPE html PUBLIC>', '<!DOCTYPE HTML5>', '<!DOCTYPE html>', '<!DOCTYPE html5>'], 2],
    ['HTML5 me video clip embed karne ke liye kaun sa tag use hota hai?', ['<media>', '<movie>', '<embed-video>', '<video>'], 3],
    ['HTML5 me audio stream add karne ke liye tag kaun sa hai?', ['<audio>', '<sound>', '<music>', '<mp3>'], 0],
    ['HTML5 me JavaScript dwara 2D graphics draw karne ka canvas element?', ['<graphics>', '<canvas>', '<draw>', '<svg>'], 1],
    ['Vector-based graphics draw karne ke liye HTML5 me kya tag hai?', ['<svg>', '<vml>', '<canvas>', '<vector>'], 0],
    ['User ki geographical location track karne ke liye HTML5 API?', ['GPS API', 'Map API', 'Location API', 'Geolocation API'], 3],
    ['Browser me client-side data store karne ke liye HTML5 feature?', ['Cookies', 'LocalStorage & SessionStorage', 'WebSQL', 'Cache Storage'], 1],
    ['LocalStorage me data kab tak store rehta hai?', ['1 din tak', 'Browser close hone tak', 'Jab tak manually delete na kiya jaye', '1 ghante tak'], 2],
    ['SessionStorage ka data kab expire hota hai?', ['24 hours me', 'Never', 'Browser tab closed hone par', 'System restart par'], 2],
    ['Page ke header content ke liye HTML5 Semantic Tag?', ['<header>', '<head>', '<top>', '<masthead>'], 0],
    ['Page ke footer section ke liye HTML5 Semantic Tag?', ['<bottom>', '<footer>', '<end>', '<foot>'], 1],
    ['Main Navigation Links ke group ke liye Semantic Tag?', ['<menu>', '<links>', '<navigation>', '<nav>'], 3],
    ['Independent self-contained content (Blog Post/Article) ka tag?', ['<aside>', '<section>', '<article>', '<content>'], 2],
    ['Document me kisi ek Vishisht theme/topic ke section ke liye tag?', ['<div>', '<part>', '<group>', '<section>'], 3],
    ['Sidebar content ya Related links dikhane ka HTML5 tag?', ['<aside>', '<sidebar>', '<side>', '<panel>'], 0],
    ['Images, diagrams ya illustrations ko enclose karne ka HTML5 tag?', ['<picture>', '<figure>', '<img-box>', '<media-box>'], 1],
    ['<figure> tag ki caption/heading ke liye tag?', ['<figcaption>', '<caption>', '<title>', '<legend>'], 0],
    ['Text highlight (Yellow Background) karne ka naya HTML5 tag?', ['<yellow>', '<highlight>', '<mark>', '<bg>'], 2],
    ['Task progress (0% to 100%) dikhane ka HTML5 control tag?', ['<meter>', '<progress>', '<bar>', '<status>'], 1],
    ['Disk Space / Range Value (Gauge) dikhane ka HTML5 tag?', ['<range>', '<progress>', '<gauge>', '<meter>'], 3],
    ['Input Field me Dropdown Autocomplete suggestion list tag?', ['<select>', '<autocomplete>', '<list>', '<datalist>'], 3],
    ['Form me Color Picker Dialog box kholne ka input type?', ['type="palette"', 'type="color"', 'type="picker"', 'type="rgb"'], 1],
    ['Form me Date Picker control laane ka input type?', ['type="day"', 'type="calendar"', 'type="date"', 'type="dt"'], 2],
    ['Form me Slider Control (min-max range) ka input type?', ['type="range"', 'type="slider"', 'type="scroll"', 'type="meter"'], 0],
    ['Form me Mobile Number input aur validation type?', ['type="mobile"', 'type="phone"', 'type="tel"', 'type="number"'], 2],
    ['Web Address (URL) enter karne ka HTML5 input type?', ['type="link"', 'type="address"', 'type="web"', 'type="url"'], 3],
    ['Search Box dedicatedly banane ka HTML5 input type?', ['type="query"', 'type="search"', 'type="find"', 'type="text-search"'], 1],
    ['Date ke saath Time select karne ka input type?', ['type="datetime-local"', 'type="date-time"', 'type="time-date"', 'type="clock"'], 0],
    ['Only Time (Ghante/Minute) input lene ka type?', ['type="watch"', 'type="clock"', 'type="hour"', 'type="time"'], 3],
    ['Field ko submit hone se pehle compulsory check karne wala attribute?', ['required', 'validate', 'compulsory', 'mandatory'], 0],
    ['Page load hone par kisi Field me auto-cursor lane ka attribute?', ['auto-cursor', 'autofocus', 'focus', 'active'], 1],
    ['Input box me faint guidance/hint text dikhane ka attribute?', ['tooltip', 'hint', 'placeholder', 'value'], 2],
    ['Custom Regular Expression (Regex) pattern validation attribute?', ['regex', 'pattern', 'validate', 'rule'], 1],
    ['Multiple Files ek saath upload karne ka attribute?', ['file-list', 'multi', 'allow-many', 'multiple'], 3],
    ['HTML5 me Audio/Video autoplay karne ka attribute?', ['autoplay', 'auto', 'play', 'start'], 0],
    ['Audio/Video ko repeat mode me chalane ka attribute?', ['replay', 'repeat', 'loop', 'cycle'], 2],
    ['Media elements par Play/Pause/Volume controls dikhane ka attribute?', ['buttons', 'panel', 'controls', 'media-bar'], 2],
    ['Expandable / Collapsible widget ka HTML5 tag?', ['<details>', '<summary>', '<accordion>', '<toggle>'], 0],
    ['<details> tag ka visible heading section kaun sa hai?', ['<title>', '<summary>', '<label>', '<header>'], 1],
    ['Pop-up Dialog window / Modal box banane ka HTML5 tag?', ['<popup>', '<window>', '<modal>', '<dialog>'], 3],
    ['Calculation/Script Output result dikhane ka HTML5 tag?', ['<output>', '<result>', '<calc>', '<display>'], 0],
    ['HTML5 Drag and Drop API activate karne ka attribute?', ['drag="true"', 'dropzone', 'allow-drag', 'draggable="true"'], 3],
    ['Element ko user dwara directly edit karne dene ka attribute?', ['editable="true"', 'contenteditable="true"', 'user-edit', 'modify'], 1],
    ['Custom data storage attributes banane ka syntax?', ['attr-', 'custom-*', 'data-* (e.g. data-id)', 'store-*'], 2],
    ['Background JavaScript tasks chalane ke liye HTML5 API?', ['Web Workers', 'Web Threads', 'Background Sync', 'Service Async'], 0],
    ['Real-time bi-directional socket communication API HTML5 me?', ['Socket.IO', 'WebSockets API', 'HTTP/2', 'REST API'], 1],
    ['Server se continuous automatic updates pane ke liye API?', ['WebSockets', 'Fetch API', 'AJAX', 'Server-Sent Events (SSE)'], 3],
    ['HTML5 me kis purane formatting tag ko DEPRECATED kiya gaya hai?', ['<strong>', '<p>', '<font> / <center>', '<em>'], 2],
    ['Media elements me Multiple video sources/formats dene ka tag?', ['<media>', '<source>', '<track>', '<file>'], 1],
    ['Video me Subtitles / Captions track file include karne ka tag?', ['<subtitle>', '<vtt>', '<caption>', '<track>'], 3],
    ['What does CSS stand for?', ['Creative Style Sheets', 'Computer Style Sheets', 'Cascading Style Sheets', 'Colorful Style Sheets'], 2],
    ['Which HTML tag is used to define internal CSS?', ['<style>', '<CSS>', '<script>', '<link>'], 0],
    ['Which HTML attribute is used to define inline styles?', ['class', 'styles', 'font', 'style'], 3],
    ['Which is the correct CSS syntax?', ['{body:color=black;}', '{body;color:black;}', 'body {color: black;}', 'body:color=black;'], 2],
    ['How do you insert a comment in a CSS file?', ['\'this is comment', '/* this is comment */', '// this is comment', '<!-- comment -->'], 1],
    ['Which property is used to change background color?', ['background-color', 'color', 'bgcolor', 'bg-color'], 0],
    ['How do you apply a style to element with id="header"?', ['.header', '*header', '#header', 'header'], 2],
    ['How do you select elements with class name "test"?', ['.test', '*test', '#test', 'test'], 0],
    ['Which CSS property controls text size?', ['font-style', 'text-style', 'text-size', 'font-size'], 3],
    ['What is the default value of the position property?', ['relative', 'static', 'fixed', 'absolute'], 1],
    ['How to display hyperlinks without an underline?', ['a {text-decoration:none;}', 'a {underline:none;}', 'a {decoration:no-underline;}', 'a {text-style:none;}'], 0],
    ['Which property makes text bold?', ['font:bold;', 'font-weight: bold;', 'style:bold;', 'text-bold:true;'], 1],
    ['How do you make each word start with a capital letter?', ['text-style:capitalize', 'transform:capitalize', 'font-transform:capitalize', 'text-transform:capitalize'], 3],
    ['Which property changes font of an element?', ['font-style', 'font-name', 'font-family', 'font-type'], 2],
    ['Which property sets left padding of an element?', ['indent-left', 'padding-left', 'margin-left', 'padding-left-style'], 1],
    ['To change text color of an element, use:', ['color', 'fgcolor', 'text-color', 'font-color'], 0],
    ['Which property is used to change border color?', ['border-style', 'outline-color', 'border-bg', 'border-color'], 3],
    ['Which selector targets ALL elements on a page?', ['#', '.', 'all', '*'], 3],
    ['How to specify margin top: 10px, bottom: 20px, left/right: 5px?', ['margin: 10px 20px 5px;', 'margin: 5px 10px 20px;', 'margin: 10px 5px 20px;', 'margin: 10px 20px 5px 5px;'], 2],
    ['Does padding accept negative values?', ['Yes', 'No', 'Only in flexbox', 'Only in grid'], 1],
    ['Does margin accept negative values?', ['Yes', 'No', 'Only on top', 'Only on inline'], 0],
    ['How to link an external CSS file in HTML?', ['<style src="...">', '<stylesheet>...</stylesheet>', '<link rel="stylesheet" href="...">', '<css href="...">'], 2],
    ['Which CSS unit is relative to parent font size?', ['rem', 'px', 'em', 'pt'], 2],
    ['Which unit is relative to root font size?', ['em', 'rem', 'vh', 'px'], 1],
    ['What is 1vh equivalent to?', ['1% of body width', '10px height', '1% of container height', '1% of viewport height'], 3],
    ['Default value of box-sizing property is:', ['content-box', 'border-box', 'padding-box', 'inherit'], 0],
    ['How to make total width include padding & border?', ['box-sizing: content-box;', 'box-fit: cover;', 'box-sizing: border-box;', 'size: include-border;'], 2],
    ['Which property hides element but keeps space?', ['display: none;', 'opacity: 0;', 'overflow: hidden;', 'visibility: hidden;'], 3],
    ['Which property removes element completely from flow?', ['display: none;', 'clear: both;', 'visibility: hidden;', 'position: relative;'], 0],
    ['How to center a block element horizontally?', ['text-align: center;', 'margin: 0 auto;', 'align: center;', 'float: center;'], 1],
    ['What is default display value of <div>?', ['inline', 'inline-block', 'block', 'flex'], 2],
    ['What is default display value of <span>?', ['contents', 'inline-block', 'block', 'inline'], 3],
    ['Which property specifies stack order of elements?', ['z-index', 'order', 'stack-level', 'position-order'], 0],
    ['z-index only works on elements with position value:', ['static only', 'other than static', 'absolute only', 'fixed only'], 1],
    ['How to make a list without bullet points?', ['list-style: none;', 'list: no-bullet;', 'list-style-type: none;', 'text-decoration: none;'], 2],
    ['Which pseudo-class styles links on mouse hover?', ['active', ':hover', ':focus', ':visited'], 1],
    ['Order of pseudo-classes for links (LVHA):', ['hover, visited, link, active', 'link, hover, visited, active', 'active, hover, visited, link', 'link, visited, hover, active'], 3],
    ['How to round borders in CSS3?', ['border-radius', 'corner-radius', 'border-curve', 'box-radius'], 0],
    ['How to add shadow to text?', ['box-shadow', 'shadow-text', 'font-shadow', 'text-shadow'], 3],
    ['Correct syntax for box-shadow: horizontal vertical blur color?', ['box-shadow: 10px red 5px 2px;', 'box-shadow: red 5px 10px;', 'box-shadow: 5px 10px 4px #888;', 'box-shadow: blur 5px 10px;'], 2],
    ['What is flex-direction default value?', ['column', 'row', 'row-reverse', 'column-reverse'], 1],
    ['Which property aligns flex items along main axis?', ['justify-content', 'align-content', 'align-items', 'flex-pack'], 0],
    ['Which property aligns flex items along cross axis?', ['justify-content', 'text-align', 'align-items', 'float'], 2],
    ['How to allow flex items to wrap onto multiple lines?', ['flex-flow: nowrap;', 'flex-line: multi;', 'wrap: yes;', 'flex-wrap: wrap;'], 3],
    ['Shorthand for flex-direction and flex-wrap is:', ['flex-group', 'flex-flow', 'flex-grid', 'flex-inline'], 1],
    ['Which CSS Grid property defines column sizes?', ['grid-template-columns', 'grid-auto-columns', 'grid-columns', 'columns-template'], 0],
    ['What does fr unit stand for in Grid layout?', ['fractional unit', 'frame rate', 'fixed ratio', 'flex absolute'], 0],
    ['Property to set gap between rows and columns in Grid:', ['grid-space', 'gap', 'grid-margin', 'cell-padding'], 1],
    ['Which CSS rule is used for Media Queries?', ['@import', '@keyframes', '@font-face', '@media'], 3],
    ['Targeted width for mobile screen using media query:', ['@media (min-width: 1200px)', '@media (screen-device)', '@media (max-width: 768px)', '@media (orientation)'], 2],
    ['Which CSS rule customizes web fonts?', ['@font-face', '@font', '@include-font', '@web-font'], 0],
    ['Keyframes rule is used for creating:', ['Transforms', 'Transitions', 'Animations', 'Gradients'], 2],
    ['Which property smoothly changes property values over time?', ['transform', 'transition', 'translate', 'animation'], 1],
    ['Property used to rotate, scale, or skew elements:', ['convert', 'change', 'transition', 'transform'], 3],
    ['Value to rotate element 45 degrees clockwise:', ['turn(45deg)', 'rotate: 45;', 'transform: rotate(45deg);', 'transform: angle(45);'], 2],
    ['How to make background image fix on scroll?', ['background-repeat: fixed;', 'background-attachment: fixed;', 'background-position: fixed;', 'background-scroll: false;'], 1],
    ['Property to resize background image to cover entire div:', ['background-fit: cover;', 'background-clip: cover;', 'background-scale: 100%;', 'background-size: cover;'], 3],
    ['Correct value to prevent background image repetition:', ['background-repeat: no-repeat;', 'background-repeat: stop;', 'background-tile: none;', 'background-repeat: single;'], 0],
    ['What is the opacity value for completely transparent?', ['1', '0', '-1', '100%'], 1],
    ['In RGBA, what does \'A\' stand for?', ['Absolute', 'Attribute', 'Alpha', 'Array'], 2],
    ['Which pseudo-element styles first letter of element?', ['::first-line', '::initial', ':start-letter', '::first-letter'], 3],
    ['Pseudo-element used to insert content before element:', ['::before', ':prefix', '::after', ':front'], 0],
    ['What property is mandatory with ::before / ::after?', ['display', 'text', 'content', 'position'], 2],
    ['How to select direct child p elements inside div?', ['div p', 'div+p', 'div-p', 'div>p'], 3],
    ['Adjacent sibling combinator symbol in CSS:', ['>', '+', '~', '*'], 1],
    ['General sibling combinator symbol in CSS:', ['~', '+', '*', '>'], 0],
    ['Which CSS property controls image overflow in div?', ['fit-content', 'img-fit', 'image-style', 'object-fit'], 3],
    ['Property to clip element into specific shape (circle, polygon):', ['mask-shape', 'crop', 'clip-path', 'border-clip'], 2],
    ['How to define CSS variable name correctly?', ['$main-color', '--main-color', '@main-color', '#main-color'], 1],
    ['How to consume a CSS variable value?', ['var(--main-color)', 'use(--main-color)', 'get(--main-color)', 'val(--main-color)'], 0],
    ['Where are global CSS variables usually defined?', ['html', 'body', '*', ':root'], 3],
    ['Which selector has HIGHEST specificity?', ['Class (.btn)', 'ID (#btn)', 'Element (button)', 'Universal (*)'], 1],
    ['What overcomes all specificity rules in CSS?', ['!override', '!force', '!important', '!priority'], 2],
    ['Which property handles horizontal alignment of text?', ['text-align', 'text-position', 'vertical-align', 'align-content'], 0],
    ['Which value of text-align justifies paragraph lines?', ['justify', 'fill', 'center', 'spread'], 0],
    ['Property used to control space between letters:', ['word-spacing', 'line-height', 'text-indent', 'letter-spacing'], 3],
    ['Property used to control line height / line spacing:', ['line-spacing', 'text-height', 'line-height', 'row-gap'], 2],
    ['What is default value of float property?', ['left', 'right', 'none', 'inline'], 2],
    ['Which property cancels floating elements effect?', ['overflow', 'clear', 'reset', 'float-none'], 1],
    ['What filter property turns an image to black & white?', ['filter: sepia(100%);', 'filter: invert(100%);', 'filter: contrast(0%);', 'filter: grayscale(100%);'], 3],
    ['How to create blur effect on an element?', ['blur: 5px;', 'filter: blur(5px);', 'opacity-blur: 5px;', 'image-blur: 5px;'], 1],
    ['Backdrop-filter applies graphical effects to:', ['Area behind element', 'Border only', 'Foreground text', 'Parent element'], 0],
    ['Which CSS property controls mouse cursor appearance?', ['pointer', 'mouse-icon', 'cursor', 'hover-cursor'], 2],
    ['Value of cursor to show clicking finger hand icon:', ['hand', 'click', 'finger', 'pointer'], 3],
    ['How to disable pointer/click events on an element?', ['click: none;', 'cursor: disabled;', 'pointer-events: none;', 'events: false;'], 2],
    ['Which pseudo-class selects every 2nd child element?', [':nth-child(even) & :nth-child(2n)', ':nth-child(2n)', ':nth-child(even)', ':every(2)'], 0],
    ['Which pseudo-class targets checked checkboxes?', [':selected', ':checked', ':active', ':marked'], 1],
    ['Pseudo-class targeting an active input field being typed in:', [':active', ':hover', ':typing', ':focus'], 3],
    ['Property used to control list item marker position:', ['list-style-position', 'marker-align', 'list-position', 'bullet-place'], 0],
    ['Which attribute selector selects elements containing a word?', ['[attr^=val]', '[attr~=val]', '[attr*=val]', '[attr$=val]'], 1],
    ['Attribute selector matching attribute value starting with string:', ['[attr*=val]', '[attr^=val]', '[attr|=val]', '[attr~=val]'], 1],
    ['Attribute selector matching attribute value ending with string:', ['[attr^=val]', '[attr*=val]', '[attr~=val]', '[attr$=val]'], 3],
    ['Which property sets scroll behavior to smooth?', ['scroll-animation: smooth;', 'transition-scroll: smooth;', 'scroll-behavior: smooth;', 'smooth-scroll: true;'], 2],
    ['How to break words to prevent text overflow?', ['overflow-wrap: break-word;', 'text-break: all;', 'word-wrap: break-word;', 'line-break: force;'], 0],
    ['Which property truncates text with an ellipsis (...)?', ['text-overflow: clip;', 'overflow: ellipsis;', 'white-space: dot;', 'text-overflow: ellipsis;'], 3],
    ['What white-space value prevents text from wrapping?', ['white-space: nowrap;', 'white-space: normal;', 'white-space: pre;', 'white-space: no-break;'], 0],
    ['Default value of position attribute for flex items:', ['relative', 'static', 'flex', 'absolute'], 1],
    ['Which CSS property controls column layout in text body?', ['text-columns', 'multi-column', 'column-count', 'column-layout'], 2],
    ['What property sets background linear gradient?', ['background: gradient(...)', 'background: linear-gradient(...)', 'background-color: linear(...)', 'color-gradient: linear(...)'], 1],
    ['What is the default user-agent font size in most browsers?', ['12px', '16px', '14px', '18px'], 1],
    ['What is W3.CSS?', ['JavaScript library', 'Database tool', 'PHP framework', 'CSS framework'], 3],
    ['Does W3.CSS require jQuery or JavaScript to run?', ['No JS required', 'Requires jQuery', 'Requires React', 'Requires Angular'], 0],
    ['Which class adds a padded container with margins?', ['.w3-box', '.w3-wrapper', '.w3-container', '.w3-content'], 2],
    ['How do you set background color to red in W3.CSS?', ['.w3-color-red', '.w3-text-red', '.w3-bg-red', '.w3-red'], 3],
    ['Which class sets text color to blue in W3.CSS?', ['.w3-text-blue', '.w3-blue-text', '.w3-font-blue', '.w3-blue'], 0],
    ['Which class adds a 2px shadow card effect?', ['.w3-box', '.w3-shadow', '.w3-card', '.w3-card-shadow'], 2],
    ['Which class creates a deeper 4px shadow card?', ['.w3-card-3', '.w3-card-4', '.w3-card-large', '.w3-card-shadow'], 1],
    ['Which class creates a responsive grid row container?', ['.w3-row', '.w3-grid', '.w3-line', '.w3-flex'], 0],
    ['How many columns does W3.CSS grid system have?', ['10 columns', '8 columns', '16 columns', '12 columns'], 3],
    ['Which class defines a column for small screens (mobile)?', ['.w3-col-small', '.w3-mobile', '.w3-col.s1 to .s12', '.w3-small-grid'], 2],
    ['Which class defines a column for medium screens (tablets)?', ['.w3-medium', '.w3-col.m1 to .m12', '.w3-tab', '.w3-col-m'], 1],
    ['Which class defines a column for large screens (desktops)?', ['.w3-col.l1 to l12', '.w3-desk', '.w3-large-col', '.w3-wide'], 0],
    ['Which class creates a rectangular panel with top/bottom padding?', ['.w3-block', '.w3-card', '.w3-panel', '.w3-section'], 2],
    ['Which class styles a standard table in W3.CSS?', ['.w3-table-view', '.w3-tbl', '.w3-grid-table', '.w3-table'], 3],
    ['Which class adds striped rows to a W3.CSS table?', ['.w3-zebra', '.w3-table-striped', '.w3-striped', '.w3-alternate'], 2],
    ['Which class creates a bordered table?', ['.w3-table-grid', '.w3-table-lines', '.w3-border-table', '.w3-bordered'], 3],
    ['Which class creates a hoverable table row effect?', ['.w3-row-hover', '.w3-hoverable', '.w3-table-hover', '.w3-cursor-hover'], 1],
    ['Which class creates a basic button in W3.CSS?', ['.w3-btn', '.w3-btn-style', '.w3-button-card', '.w3-click'], 0],
    ['What is the main difference between .w3-btn and .w3-button?', ['.w3-btn has shadow by default', '.w3-btn has no shadow', '.w3-button is larger', 'No difference'], 0],
    ['Which class makes a button take full width of container?', ['.w3-full', '.w3-wide-btn', '.w3-block', '.w3-span'], 2],
    ['Which class turns a button into a circle?', ['.w3-round', '.w3-circle', '.w3-btn-round', '.w3-oval'], 1],
    ['Which class rounds the corners of an element?', ['.w3-radius', '.w3-corner', '.w3-curve', '.w3-round'], 3],
    ['Which class gives large rounded corners?', ['.w3-round-big', '.w3-round-4', '.w3-round-large', '.w3-corner-lg'], 2],
    ['Which class gives maximum rounded corners?', ['.w3-circle', '.w3-round-xxlarge', '.w3-round-max', '.w3-round-full'], 0],
    ['Which class creates a responsive image?', ['.w3-img-responsive', '.w3-image', '.w3-fluid-img', '.w3-responsive-picture'], 1],
    ['Which class displays an element as a top navigation bar?', ['.w3-header-bar', '.w3-navbar', '.w3-nav', '.w3-bar'], 3],
    ['Which class represents an item inside .w3-bar?', ['.w3-nav-item', '.w3-link', '.w3-menu-item', '.w3-bar-item'], 3],
    ['Which class creates a vertical navigation menu?', ['.w3-vbar', '.w3-sidebar-menu', '.w3-bar-block', '.w3-menu-vertical'], 2],
    ['Which class creates a collapsible sidebar?', ['.w3-sidebar', '.w3-drawer', '.w3-side-nav', '.w3-aside'], 0],
    ['Which class hides element on small screens (mobile)?', ['.w3-no-mobile', '.w3-hide-small', '.w3-hide-s', '.w3-hidden-mobile'], 1],
    ['Which class hides element on medium screens?', ['.w3-no-tab', '.w3-hide-medium', '.w3-hidden-tablet', '.w3-hide-m'], 3],
    ['Which class hides element on large screens?', ['.w3-hide-l', '.w3-hide-large', '.w3-no-desktop', '.w3-hidden-desk'], 0],
    ['Which class creates a modal popup overlay?', ['.w3-popup', '.w3-dialog', '.w3-modal', '.w3-overlay'], 2],
    ['Which class wraps the content inside a modal?', ['.w3-modal-box', '.w3-modal-content', '.w3-modal-body', '.w3-dialog-content'], 1],
    ['Which class creates a dropdown menu container?', ['.w3-dropdown-box', '.w3-dropdown-hover', '.w3-dropdown-content', '.w3-hover-drop'], 1],
    ['Which class displays dropdown content on click?', ['.w3-dropdown-open', '.w3-click-dropdown', '.w3-dropdown-click', '.w3-active-dropdown'], 2],
    ['Which class contains dropdown items?', ['.w3-dropdown-content', '.w3-dropdown-box', '.w3-drop-list', '.w3-menu-content'], 0],
    ['Which class creates a styled form container?', ['.w3-form-box', '.w3-form', '.w3-input-group', '.w3-container'], 3],
    ['Which class styles input text fields in W3.CSS?', ['.w3-textbox', '.w3-field', '.w3-input', '.w3-form-control'], 2],
    ['Which class styles radio buttons and checkboxes?', ['.w3-check-radio', '.w3-select-box', '.w3-option', '.w3-check/.w3-radio'], 3],
    ['Which class creates a badge/tag with rounded corners?', ['.w3-badge', '.w3-label', '.w3-pill', '.w3-tag'], 0],
    ['Which class creates a rectangular label/tag?', ['.w3-badge', '.w3-tag', '.w3-mark', '.w3-label'], 1],
    ['How do you animate an element fading in?', ['.w3-animate-opacity', '.w3-fade', '.w3-anim-fade', '.w3-show-fade'], 0],
    ['Which class animates element sliding in from top?', ['.w3-slide-down', '.w3-from-top', '.w3-animate-top', '.w3-anim-down'], 2],
    ['Which class animates element sliding from left?', ['.w3-slide-left', '.w3-animate-left', '.w3-from-left', '.w3-anim-left'], 1],
    ['Which class animates element sliding from right?', ['.w3-slide-right', '.w3-anim-right', '.w3-from-right', '.w3-animate-right'], 3],
    ['Which class animates element sliding from bottom?', ['.w3-slide-up', '.w3-animate-bottom', '.w3-from-bottom', '.w3-anim-up'], 1],
    ['Which class creates a zooming animation effect?', ['.w3-pop-zoom', '.w3-zoom-in', '.w3-scale-anim', '.w3-animate-zoom'], 3],
    ['Which class creates a spinning loader animation?', ['.w3-spin-loader', '.w3-rotate', '.w3-spin', '.w3-loading'], 2],
    ['Which class floats an element to the left?', ['.w3-left', '.w3-float-left', '.w3-align-left', '.w3-pull-left'], 0],
    ['Which class floats an element to the right?', ['.w3-align-right', '.w3-right', '.w3-float-right', '.w3-pull-right'], 1],
    ['Which class centers text inside an element?', ['.w3-center', '.w3-text-center', '.w3-align-center', '.w3-middle'], 0],
    ['Which class aligns text to left?', ['.w3-left-text', '.w3-align-left', '.w3-left-align', '.w3-text-left'], 2],
    ['Which class aligns text to right?', ['.w3-text-right', '.w3-right-text', '.w3-align-right', '.w3-right-align'], 3],
    ['Which class sets tiny font size (10px)?', ['.w3-micro', '.w3-extra-small', '.w3-tiny', '.w3-font-tiny'], 2],
    ['Which class sets small font size (12px)?', ['.w3-small', '.w3-sm', '.w3-font-small', '.w3-text-small'], 0],
    ['Which class sets large font size (18px)?', ['.w3-lg', '.w3-big', '.w3-font-lg', '.w3-large'], 3],
    ['Which class sets extra large font size (24px)?', ['.w3-huge', '.w3-xlarge', '.w3-extra-large', '.w3-font-xl'], 1],
    ['Which class sets jumbo font size (64px)?', ['.w3-mega', '.w3-jumbo', '.w3-xxxlarge', '.w3-hero'], 1],
    ['Which class adds a thin border around element?', ['.w3-box-border', '.w3-outline', '.w3-line', '.w3-border'], 3],
    ['Which class adds top border only?', ['.w3-border-top', '.w3-border-top', '.w3-top-line', '.w3-line-top'], 0],
    ['Which class changes border color to green?', ['.w3-border-green', '.w3-border-color-green', '.w3-green-border', '.w3-line-green'], 2],
    ['Which class removes all borders from element?', ['.w3-no-border', '.w3-clean-border', '.w3-border-none', '.w3-border-0'], 3],
    ['Which class adds hover effect with red background?', ['.w3-red-hover', '.w3-hover-bg-red', '.w3-hover-red', '.w3-onhover-red'], 2],
    ['Which class changes text color on hover to yellow?', ['.w3-hover-text-yellow', '.w3-text-hover-yellow', '.w3-hover-yellow-text', '.w3-yellow-hover-text'], 0],
    ['Which class adds hover shadow effect?', ['.w3-shadow-hover', '.w3-hover-shadow', '.w3-card-hover', '.w3-hoverable-card'], 1],
    ['Which class creates a translucent element opacity?', ['.w3-transparent', '.w3-translucent', '.w3-opacity', '.w3-alpha'], 2],
    ['Which class turns element transparent on hover?', ['.w3-opacity-hover', '.w3-hover-opacity', '.w3-hover-transparent', '.w3-trans-hover'], 1],
    ['Which class completely removes background color?', ['.w3-transparent', '.w3-no-bg', '.w3-clear-bg', '.w3-none'], 0],
    ['Which class creates a responsive video container?', ['.w3-video-box', '.w3-media', '.w3-embed', '.w3-responsive'], 3],
    ['Which class fixes element at top of page?', ['.w3-fixed-top', '.w3-top', '.w3-sticky-top', '.w3-header-fixed'], 1],
    ['Which class fixes element at bottom of page?', ['.w3-fixed-bottom', '.w3-footer-fixed', '.w3-bottom', '.w3-sticky-bottom'], 2],
    ['Which class adds tooltip on hover?', ['.w3-pop-tip', '.w3-hint', '.w3-hover-tip', '.w3-tooltip'], 3],
    ['Which class creates progress bar container?', ['.w3-progress', '.w3-light-grey (container)', '.w3-progress-bar', '.w3-meter'], 0],
    ['Which class sets width of progress bar inner fill?', ['Inline style width: X%', '.w3-progress-val', '.w3-fill-X', '.w3-meter-fill'], 0],
    ['Which class creates a close button (X)?', ['.w3-close', '.w3-button.w3-display-topright', '.w3-x-btn', '.w3-dismiss'], 1],
    ['Which class positions content to top-left of parent?', ['.w3-top-left', '.w3-pos-top-left', '.w3-align-top-left', '.w3-display-topleft'], 3],
    ['Which class centers element in exact middle of parent?', ['.w3-center-all', '.w3-exact-center', '.w3-display-middle', '.w3-middle-align'], 2],
    ['Which class positions content at bottom-right?', ['.w3-bottom-right', '.w3-align-bottom-right', '.w3-pos-bottom-right', '.w3-display-bottomright'], 3],
    ['Required parent class for .w3-display-X positioning:', ['.w3-container', '.w3-display-container', '.w3-relative', '.w3-parent'], 1],
    ['Which class sets top margin of 16px?', ['.w3-section', '.w3-margin-16', '.w3-gap-top', '.w3-space-16'], 0],
    ['Which class adds 16px margin on ALL sides?', ['.w3-margin', '.w3-space-all', '.w3-padding-all', '.w3-outer-space'], 0],
    ['Which class adds 16px padding on top and bottom?', ['.w3-pad-vertical', '.w3-vertical-padding', '.w3-padding-16', '.w3-section-pad'], 2],
    ['Which class adds 24px padding top & bottom?', ['.w3-padding-24', '.w3-padding-24', '.w3-padding-large', '.w3-pad-24'], 2],
    ['Which class adds 32px padding top & bottom?', ['.w3-padding-extra', '.w3-padding-32', '.w3-pad-32', '.w3-heavy-padding'], 1],
    ['Which class adds 64px padding top & bottom?', ['.w3-padding-huge', '.w3-pad-max', '.w3-hero-padding', '.w3-padding-64'], 3],
    ['How to hide an element dynamically in W3.CSS?', ['w3-invisible', '.w3-hide', 'w3-display-none', '.w3-close-item'], 1],
    ['How to display a hidden element in W3.CSS?', ['.w3-show', '.w3-visible', '.w3-display-block', '.w3-unhide'], 0],
    ['Which class displays an element as an inline block?', ['.w3-inline', '.w3-display-inline', '.w3-inline-box', '.w3-show-inline-block'], 3],
    ['Which class turns a list into a styled unbulleted box list?', ['.w3-unstyled-list', '.w3-list', '.w3-ul', '.w3-clean-ul'], 2],
    ['How to add avatar images in a W3.CSS list item?', ['.w3-avatar-img', '.w3-bar-item.w3-circle', '.w3-list-avatar', '.w3-icon-avatar'], 1],
    ['What default font family does W3.CSS use?', ['Verdana', 'Arial', 'Times New Roman', 'Roboto'], 0],
    ['Which class changes font to Segoe UI / sans-serif theme?', ['.w3-font-sans', '.w3-modern-font', 'Custom CSS/.w3-serif', '.w3-roboto'], 2],
    ['Which class turns font style to serif?', ['.w3-times', '.w3-font-serif', '.w3-text-serif', '.w3-serif'], 3],
    ['Which class changes text font to wide/monospace style?', ['.w3-mono', '.w3-letter-wide', '.w3-space-text', '.w3-wide'], 3],
    ['Which color library file expands standard W3.CSS colors?', ['w3-colors-all.css', 'w3-extra-colors.css', 'w3-colors-metro.css/w3-theme.css', 'w3-palettes.css'], 2],
    ['What is the correct way to include W3.CSS in HTML?', ['<script src="w3.css"></script>', '<link rel="stylesheet" href="w3.css">', '<style src="w3.css"></style>', '<w3-css href="w3.css">'], 1],
    ['What type of language is JavaScript?', ['Interpreted / JIT', 'Compiled language', 'Assembly language', 'Markup language'], 0],
    ['Which HTML tag is used to embed JavaScript?', ['<js>', '<javascript>', '<script>', '<code>'], 2],
    ['Which keyword declares a block-scoped variable?', ['var', 'define', 'global', 'let'], 3],
    ['Which keyword declares a constant variable?', ['const', 'static', 'final', 'immutable'], 0],
    ['What is the output of typeof null in JavaScript?', ['"null"', '"object"', '"undefined"', '"number"'], 1],
    ['What is the output of typeof NaN in JavaScript?', ['"NaN"', '"undefined"', '"number"', '"object"'], 2],
    ['Which operator performs strict equality check?', ['==', '!=', '=', '==='], 3],
    ['What is the result of \'5\'+3 in JavaScript?', ['"53"', '8', 'NaN', 'Error'], 0],
    ['What is the result of \'5\'-3 in JavaScript?', ['"53"', '2', '"2"', 'NaN'], 1],
    ['Which function displays a message box with OK button?', ['prompt()', 'alert()', 'confirm()', 'print()'], 1],
    ['Which method returns user text input in a dialog?', ['read()', 'input()', 'prompt()', 'confirm()'], 2],
    ['Which method prints messages to the browser console?', ['print.log()', 'system.out()', 'browser.write()', 'console.log()'], 3],
    ['What does DOM stand for?', ['Document Object Model', 'Data Object Model', 'Desktop Object Mode', 'Document Option Module'], 0],
    ['Which method selects an element by its ID?', ['getID()', 'queryID()', 'getElementById()', 'selectElement()'], 2],
    ['Which method selects the first CSS selector match?', ['querySelector()', 'selectFirst()', 'getQuery()', 'findElement()'], 0],
    ['Which method selects ALL elements matching CSS selector?', ['querySelector()', 'getElementsByCSS()', 'selectAll()', 'querySelectorAll()'], 3],
    ['Which property changes the HTML content of an element?', ['contentText', 'innerHTML', 'valueHTML', 'nodeContent'], 1],
    ['Which property changes plain text inside element safely?', ['innerHTML', 'setString', 'textContent', 'rawText'], 2],
    ['How do you write an inline comment in JavaScript?', ['# Comment', '<!-- Comment -->', '/* Comment', '// Comment'], 3],
    ['How do you write a multi-line comment in JavaScript?', ['/* line1 line2 */', '// line1 line2 //', '...', '#* line1 line2*#'], 0],
    ['Which array method adds elements to the END?', ['unshift()', 'push()', 'pop()', 'append()'], 1],
    ['Which array method removes the LAST element?', ['pop()', 'shift()', 'remove()', 'delete()'], 0],
    ['Which array method removes the FIRST element?', ['pop()', 'unshift()', 'shift()', 'slice()'], 2],
    ['Which array method adds elements to the START?', ['push()', 'unshift()', 'prepend()', 'shift()'], 1],
    ['Which method converts JSON string to JavaScript object?', ['JSON.stringify()', 'JSON.decode()', 'JSON.toObject()', 'JSON.parse()'], 3],
    ['Which method converts JS object to JSON string?', ['JSON.encode()', 'JSON.parse()', 'JSON.stringify()', 'Object.toJSON()'], 2],
    ['What is the index of the first element in an array?', ['0', '1', '-1', 'undefined'], 0],
    ['Which property returns the length of an array?', ['count', 'length', 'size', 'indexLength'], 1],
    ['Which syntax creates an Arrow Function?', ['def () { }', 'function=>()', '()() -> {}', '() => {}'], 3],
    ['Which event occurs when a user clicks an HTML element?', ['onclick', 'onhover', 'onpress', 'onchange'], 0],
    ['Which method attaches an event listener to an element?', ['attachEvent()', 'addEventListener()', 'bindEvent()', 'listenTo()'], 1],
    ['What does event.preventDefault() do?', ['Deletes event', 'Stops propagation', 'Stops default action', 'Reloads page'], 2],
    ['What does event.stopPropagation() do?', ['Cancels default', 'Removes listener', 'Stops execution', 'Stops event bubbling'], 3],
    ['What is the output of 1+"2"+3?', ['6', '"15"', '"123"', 'NaN'], 2],
    ['What is the output of 1+2+"3"?', ['"123"', '6', '"33"', '"15"'], 1],
    ['Which built-in function converts a string to an integer?', ['parseInt()', 'parseInteger()', 'toInt()', 'Number.int()'], 0],
    ['Which built-in function converts a string to float?', ['parseFloatVal()', 'Number.float()', 'toFloat()', 'parseFloat()'], 3],
    ['How do you check if a value is NaN?', ['val == NaN', 'val === NaN', 'val.isNaN()', 'isNaN(val)'], 3],
    ['What is the result of isNaN("Hello")?', ['false', 'true', 'NaN', 'TypeError'], 1],
    ['What is the result of isNaN(100)?', ['false', 'true', 'null', 'undefined'], 0],
    ['Which keyword refers to current object context?', ['self', 'parent', 'this', 'global'], 2],
    ['Which timer method runs code repeatedly at intervals?', ['setTimeout()', 'runRepeat()', 'setLoop()', 'setInterval()'], 3],
    ['Which timer method runs code ONCE after a delay?', ['setTimeout()', 'setInterval()', 'setDelay()', 'wait()'], 0],
    ['How do you stop a setInterval timer?', ['stopInterval()', 'clearInterval()', 'endInterval()', 'cancelInterval()'], 1],
    ['How do you stop a setTimeout timer?', ['cancelTimeout()', 'stopTimeout()', 'clearTimeout()', 'endTime()'], 2],
    ['Which keyword handles errors in JavaScript?', ['try...catch...finally', 'catch...throw', 'do...catch', 'try...catch'], 3],
    ['Which keyword manually creates/raises a custom error?', ['raise', 'throw', 'error', 'emit'], 1],
    ['Which code block ALWAYS executes after try/catch?', ['finally', 'then', 'always', 'end'], 0],
    ['Which ES6 feature unpacks values into variables?', ['Restructuring', 'Spreading', 'Destructuring', 'Parsing'], 2],
    ['Which operator expands array elements (...)?', ['Rest operator', 'Spread operator', 'Expansion operator', 'Triple dot operator'], 1],
    ['Which operator collects multiple arguments into an array?', ['Rest parameter', 'Spread parameter', 'Array collector', 'Group parameter'], 0],
    ['What is Template Literals syntax in ES6?', ['\'string ${var}\'', 'string ${var}', '[string {var}]', '"string ${var}"'], 3],
    ['Which ES6 feature handles asynchronous operations?', ['Callbacks only', 'Observables', 'Promises', 'Threading'], 2],
    ['What are 3 states of a Promise?', ['Pending, Fulfilled, Rejected', 'Start, Run, End', 'Active, Done, Failed', 'Init, True, False'], 0],
    ['Which method handles a resolved Promise value?', ['.catch()', '.done()', '.then()', '.resolve()'], 2],
    ['Which method handles a rejected Promise error?', ['.error()', '.then()', '.fail()', '.catch()'], 3],
    ['Which keyword pauses execution of async function?', ['wait', 'await', 'pause', 'yield'], 1],
    ['Where can the await keyword be used?', ['Inside any function', 'Inside async functions', 'Inside loops only', 'Inside class constructor'], 1],
    ['Which web API fetches resources asynchronously?', ['fetch()', 'getRequest()', 'http()', 'ajaxFetch()'], 0],
    ['Which array method creates a NEW array with modified items?', ['forEach()', 'filter()', 'map()', 'reduce()'], 2],
    ['Which array method filters elements passing a condition?', ['map()', 'select()', 'find()', 'filter()'], 3],
    ['Which array method reduces array to a single value?', ['join()', 'map()', 'reduce()', 'compress()'], 2],
    ['Which array method finds the FIRST element matching condition?', ['find()', 'filter()', 'search()', 'get()'], 0],
    ['Which method checks if AT LEAST ONE element passes condition?', ['includes()', 'every()', 'any()', 'some()'], 3],
    ['Which method checks if ALL elements pass condition?', ['some()', 'every()', 'all()', 'verify()'], 1],
    ['What is a closure in JavaScript?', ['Function without name', 'Closing tag in script', 'Inner function accessing outer scope', 'Block variable'], 2],
    ['What is Hoisting in JavaScript?', ['Async code execution', 'Deleting variables', 'Elevating function performance', 'Moving declarations to top'], 3],
    ['Are let and const hoisted?', ['No, not at all', 'Yes, in Temporal Dead Zone', 'Only const is hoisted', 'Only let is hoisted'], 1],
    ['Which storage stores data permanently in browser?', ['localStorage', 'sessionStorage', 'CookieSession', 'MemoryCache'], 0],
    ['Which storage clears data when tab is closed?', ['localStorage', 'sessionStorage', 'IndexDB', 'PermanentStorage'], 1],
    ['How to set item in localStorage?', ['localStorage.add()', 'localStorage.store()', 'localStorage.put()', 'localStorage.setItem()'], 3],
    ['How to get item from localStorage?', ['localStorage.getItem()', 'localStorage.read()', 'localStorage.fetch()', 'localStorage.find()'], 0],
    ['How to remove single item from localStorage?', ['localStorage.delete()', 'localStorage.flush()', 'localStorage.removeItem()', 'localStorage.reset()'], 2],
    ['How to clear ALL items from localStorage?', ['localStorage.clearKey()', 'localStorage.removeAll()', 'localStorage.clear()', 'localStorage.unset()'], 2],
    ['Which statement exits a loop prematurely?', ['continue', 'break', 'exit', 'stop'], 1],
    ['Which statement skips current iteration in a loop?', ['continue', 'break', 'skip', 'pass'], 0],
    ['Which object allows storing UNIQUE values only?', ['Map', 'ArraySet', 'WeakMap', 'Set'], 3],
    ['Which object allows Key-Value pairs with ANY data type key?', ['Set', 'Object', 'Map', 'Dictionary'], 2],
    ['Which keyword is used to create a Class in ES6?', ['class', 'prototype', 'struct', 'constructor'], 0],
    ['Which method initializes class object instances?', ['init()', 'constructor()', 'create()', 'main()'], 1],
    ['Which keyword allows class inheritance in ES6?', ['inherits', 'prototype', 'implements', 'extends'], 3],
    ['Which keyword calls parent class constructor?', ['base()', 'parent()', 'super()', 'root()'], 2],
    ['What is the output of Math.round(4.7)?', ['4', '5', '4.7', '4.5'], 1],
    ['What is the output of Math.floor(4.9)?', ['4', '5', '4.9', '0'], 0],
    ['What is the output of Math.ceil(4.1)?', ['4', '5', '4.1', '4.0'], 1],
    ['Which method returns random number between 0 and 1?', ['Math.rand()', 'random()', 'Number.random()', 'Math.random()'], 3],
    ['How to import module exports in ES6?', ['import {x} from \'./file\'', 'require(\'./file\')', 'include \'./file\'', 'load \'./file\''], 0],
    ['How to export a single default value in ES6 module?', ['export main', 'module.exports', 'export default', 'export primary'], 2],
    ['What is CommonJS export syntax (Node.js)?', ['export default', 'send.export = ...', 'export.all...', 'module.exports = ...'], 3],
    ['What is CommonJS import syntax (Node.js)?', ['include(\'mod\')', 'import x from \'mod\'', 'load(\'mod\')', 'const x = require(\'mod\')'], 3],
    ['What is Event Bubbling?', ['Event triggers top-down', 'Event is stopped', 'Event propagates bottom-up', 'Async event queue'], 2],
    ['What is Event Capturing?', ['Event triggers top-down', 'Event triggers bottom-up', 'Event triggers twice', 'Event default cancelled'], 0],
    ['Which operator performs Logical AND?', ['||', '&&', '!', '&'], 1],
    ['Which operator performs Logical OR?', ['|', '&&', '??', '||'], 3],
    ['Which operator is Nullish Coalescing?', ['??', '||', '?:', '&&'], 0],
    ['What is Optional Chaining operator?', ['.?', '?.', '??', '!!'], 1],
    ['What does Boolean("0") evaluate to?', ['undefined', 'false', 'true', 'NaN'], 2],
    ['What does Boolean(0) evaluate to?', ['true', 'null', 'false', 'TypeError'], 2],
    ['Which architectural pattern does AngularJS follow?', ['MVC (Model-View-Controller)', 'MVP (Model-View-Presenter)', 'Flux Architecture', 'Monolithic Architecture'], 0],
    ['Which directive is used to initialize an AngularJS application?', ['ng-init', 'ng-controller', 'ng-model', 'ng-app'], 3],
    ['How is Two-Way Data Binding implemented in AngularJS?', ['Using ng-bind', 'Using ng-model', 'Using {{ expression }}', 'Using ng-repeat'], 1],
    ['Which directive is used to iterate over a collection/array in HTML?', ['ng-for', 'ng-loop', 'ng-iterate', 'ng-repeat'], 3],
    ['What is the $scope in AngularJS?', ['A global JavaScript variable', 'An object that binds Controller and View', 'A CSS layout container', 'A database connector'], 1],
    ['Which symbol is used to pass expressions in AngularJS HTML code?', ['{{ expression }}', '{ expression }', '<% expression %>', '$(expression)'], 0],
    ['Which service is used to make HTTP requests in AngularJS?', ['$ajax', '$request', '$http', '$fetch'], 2],
    ['Which filter is used to format a date in AngularJS expressions?', ['dateFormat', 'date', 'time', 'uppercase'], 1],
    ['How do you create a custom directive in AngularJS?', ['module.directive()', 'module.createDirective()', 'module.newDirective()', '$compile.directive()'], 0],
    ['What is the purpose of $rootScope in AngularJS?', ['Scope local to a single directive', 'Parent scope of all $scope objects', 'Controller for route management', 'A private helper object'], 1],
    ['Which prefix is used for AngularJS built-in services and objects?', ['#', '@', '_', '$'], 3],
    ['What does the digest cycle ($digest) do in AngularJS?', ['Downloads JavaScript files', 'Clears browser cache', 'Checks watched variables for changes', 'Compiles HTML to CSS'], 2],
    ['Which directive is used to show or hide HTML elements based on expressions?', ['ng-visible', 'ng-display', 'ng-show/ng-hide', 'ng-if-else'], 2]
  ],
  o3: [
    ['Python me output dikhane ka function?', ['echo()', 'show()', 'print()', 'write()'], 2],
    ['Python me comment kis se shuru hota hai?', ['//', '#', '/*', '--'], 1]
  ]
};

/* ===== O Level Test question bank: HTML & HTML5 / CSS & W3.CSS / JavaScript & AngularJS (100 + 100 + 100) =====
   Format: [question, [4 options], sahi_option_index (0 se 3), explanation]
   Naye question jodne ke liye bas isi format me ek line add karein. */
const QB_OX = {
  /* ---------- HTML & HTML5 (100 questions) ---------- */
  ox_html: [
    ['What does HTML stand for?', ['Hyper Tool Markup Language', 'High Text Machine Language', 'Hyper Text Markup Language', 'Home Text Markup Language'], 2, 'HTML = Hyper Text Markup Language, the standard language for web pages.'],
    ['Who is credited with creating HTML?', ['Bill Gates', 'Dennis Ritchie', 'Brendan Eich', 'Tim Berners-Lee'], 3, 'Tim Berners-Lee invented HTML and the World Wide Web in 1989-91.'],
    ['Which tag defines the largest heading in HTML?', ['<h1>', '<head>', '<h6>', '<heading>'], 0, '<h1> is the largest heading and <h6> is the smallest.'],
    ['Which tag is used to insert a single line break?', ['<lb>', '<break>', '<br>', '<hr>'], 2, '<br> is an empty tag that breaks the line without starting a new paragraph.'],
    ['Which tag is used to create a paragraph?', ['<para>', '<p>', '<pg>', '<text>'], 1, 'The <p> tag defines a paragraph of text.'],
    ['Which attribute of the <a> tag holds the link destination?', ['href', 'src', 'link', 'url'], 0, 'The href attribute stores the URL the link points to.'],
    ['Which tag is used to display an image on a web page?', ['<image>', '<img>', '<pic>', '<src>'], 1, '<img> is an empty tag; the file is given in the src attribute.'],
    ['Which attribute provides alternate text for an image if it cannot load?', ['title', 'alt', 'name', 'text'], 1, 'The alt attribute describes the image for screen readers and when loading fails.'],
    ['Which tag creates an unordered (bulleted) list?', ['<ol>', '<li>', '<dl>', '<ul>'], 3, '<ul> makes a bulleted list; each item uses <li>.'],
    ['Which tag creates an ordered (numbered) list?', ['<ul>', '<ol>', '<nl>', '<list>'], 1, '<ol> displays list items with numbers or letters.'],
    ['Which tag defines an item inside a list?', ['<item>', '<list>', '<li>', '<il>'], 2, '<li> defines each list item inside <ul> or <ol>.'],
    ['Which tag defines a table row?', ['<td>', '<tr>', '<th>', '<row>'], 1, '<tr> means table row; cells inside it use <td> or <th>.'],
    ['Which tag defines a standard table data cell?', ['<tc>', '<cell>', '<tr>', '<td>'], 3, '<td> holds normal cell data inside a row.'],
    ['Which tag defines a table header cell (bold and centered by default)?', ['<thead>', '<th>', '<head>', '<tb>'], 1, '<th> creates a header cell; browsers show it bold and centered.'],
    ['Which attribute merges two or more columns in a table cell?', ['rowspan', 'merge', 'span', 'colspan'], 3, 'colspan makes a cell stretch across multiple columns.'],
    ['Which attribute merges two or more rows in a table cell?', ['colspan', 'merge', 'height', 'rowspan'], 3, 'rowspan makes a cell stretch across multiple rows.'],
    ['Which tag is used to create an HTML form for user input?', ['<input>', '<fieldform>', '<form>', '<submit>'], 2, '<form> wraps input controls and sends data to the server.'],
    ['Which input type hides the characters typed by the user?', ['hidden', 'password', 'secret', 'text'], 1, 'type="password" shows dots or stars instead of characters.'],
    ['Which input type lets the user pick multiple options independently?', ['radio', 'checkbox', 'select', 'button'], 1, 'Checkboxes allow zero, one or many selections.'],
    ['How are radio buttons grouped so that only one can be chosen?', ['Same id', 'Same value', 'Same class', 'Same name attribute'], 3, 'Radio buttons with the same name belong to one group.'],
    ['Which tag creates a multi-line text input?', ['<input type="multiline">', '<textbox>', '<text>', '<textarea>'], 3, '<textarea> accepts several lines of text.'],
    ['Which pair of tags creates a drop-down list?', ['<select> and <option>', '<list> and <item>', '<dropdown> and <li>', '<ul> and <li>'], 0, '<select> is the container and each choice is an <option>.'],
    ['Which attribute opens a link in a new browser tab?', ['target="_self"', 'new="tab"', 'open="new"', 'target="_blank"'], 3, 'target="_blank" opens the linked page in a new tab or window.'],
    ['Which tag draws a horizontal line across the page?', ['<line>', '<br>', '<hr>', '<border>'], 2, '<hr> creates a thematic break shown as a horizontal rule.'],
    ['Which tag marks text with strong importance (usually bold)?', ['<bold>', '<big>', '<heavy>', '<strong>'], 3, '<strong> shows importance and is bold by default.'],
    ['Which tag is used to emphasise text (usually shown in italics)?', ['<em>', '<it>', '<slant>', '<emp>'], 0, '<em> stresses text and browsers display it in italics.'],
    ['Which tag writes text as a subscript, like H2O?', ['<sup>', '<small>', '<low>', '<sub>'], 3, '<sub> lowers text below the baseline.'],
    ['Which tag keeps spaces and line breaks exactly as typed?', ['<pre>', '<code>', '<tt>', '<text>'], 0, '<pre> displays preformatted text in a fixed-width font.'],
    ['Which tag is used for a long quotation from another source?', ['<quote>', '<q>', '<blockquote>', '<cite>'], 2, '<blockquote> defines a block quotation, usually indented.'],
    ['Which tag defines an abbreviation and can show full form on hover using title?', ['<short>', '<acr>', '<abb>', '<abbr>'], 3, '<abbr title="HyperText Markup Language">HTML</abbr> shows a tooltip.'],
    ['Which tag is normally used for the contact information of the author?', ['<address>', '<contact>', '<author>', '<info>'], 0, '<address> holds contact details and is usually shown in italics.'],
    ['Which tag embeds another web page inside the current page?', ['<embed>', '<frame>', '<window>', '<iframe>'], 3, '<iframe> creates an inline frame showing another document.'],
    ['Where is the <title> tag placed?', ['Inside <head>', 'Inside <body>', 'Inside <footer>', 'After </html>'], 0, '<title> belongs in <head> and appears on the browser tab.'],
    ['What does <meta charset="UTF-8"> do?', ['Sets the page language', 'Links a stylesheet', 'Sets the character encoding of the page', 'Sets the font'], 2, 'It tells the browser to use UTF-8 so all characters display properly.'],
    ['Which tag links an external CSS file to an HTML page?', ['<style src="">', '<css>', '<script>', '<link>'], 3, '<link rel="stylesheet" href="style.css"> attaches an external stylesheet.'],
    ['Which tag is used to write internal CSS inside an HTML page?', ['<css>', '<design>', '<format>', '<style>'], 3, 'The <style> tag holds internal CSS rules.'],
    ['Which tag is used to include JavaScript in an HTML page?', ['<js>', '<script>', '<javascript>', '<code>'], 1, 'JavaScript goes inside <script> or in an external file via src.'],
    ['What is the purpose of <!DOCTYPE html>?', ['It creates a comment', 'It tells the browser which HTML version the document uses', 'It links a stylesheet', 'It starts the body'], 1, 'The doctype triggers standards mode in the browser.'],
    ['Which is the correct syntax of an HTML comment?', ['// comment', '<!-- comment -->', '/* comment */', '# comment'], 1, 'HTML comments start with <!-- and end with -->.'],
    ['Which element is the root element of an HTML document?', ['<body>', '<html>', '<head>', '<root>'], 1, '<html> wraps the whole page and contains <head> and <body>.'],
    ['Which element holds the visible content of a web page?', ['<head>', '<body>', '<main>', '<html>'], 1, 'Everything shown in the browser window sits inside <body>.'],
    ['Which of the following is a block-level element?', ['<div>', '<span>', '<a>', '<b>'], 0, '<div> starts on a new line and takes the full width.'],
    ['Which character entity creates a non-breaking space?', ['&space;', '&sp;', '&nbsp;', '&nbs;'], 2, '&nbsp; inserts a space that does not collapse or break.'],
    ['Which entity displays the less-than sign (<)?', ['&gt;', '&lessthan;', '&lt;', '&lth;'], 2, '&lt; means less-than and &gt; means greater-than.'],
    ['Which entity displays the copyright symbol?', ['&cr;', '&copy;', '&cp;', '&right;'], 1, '&copy; shows the copyright sign.'],
    ['Which attribute gives an element a unique identifier?', ['id', 'class', 'name', 'key'], 0, 'An id must be unique in a page; class can repeat.'],
    ['Which attribute adds inline CSS to an element?', ['style', 'css', 'font', 'format'], 0, 'style="color:red" applies CSS directly to that element.'],
    ['Which attribute shows a tooltip when the mouse hovers over an element?', ['hover', 'tip', 'alt', 'title'], 3, 'The title attribute provides extra information as a tooltip.'],
    ['Which attribute defines the language of a page, such as lang="en"?', ['language', 'locale', 'speak', 'lang'], 3, 'lang is set on <html> to declare the page language.'],
    ['Which attribute prevents the user from changing an input value but still submits it?', ['disabled', 'locked', 'readonly', 'fixed'], 2, 'readonly blocks editing but the value is still sent with the form.'],
    ['Which attribute limits the number of characters allowed in a text field?', ['size', 'maxlength', 'limit', 'length'], 1, 'maxlength sets the maximum number of characters.'],
    ['Which attribute of <form> specifies where the data is sent?', ['action', 'method', 'target', 'name'], 0, 'action holds the URL of the script that processes the form.'],
    ['Which HTTP method sends form data inside the request body and not in the URL?', ['GET', 'PUT', 'POST', 'HEAD'], 2, 'POST hides the data from the URL, GET shows it in the address bar.'],
    ['What is the purpose of the <label> tag with the for attribute?', ['To link a caption to a form control', 'To create a heading', 'To style a table', 'To add a comment'], 0, 'Clicking the label focuses the control whose id matches for.'],
    ['Which pair of tags groups form fields and gives the group a caption?', ['<group> and <title>', '<fieldset> and <legend>', '<form> and <caption>', '<div> and <label>'], 1, '<fieldset> draws a box and <legend> gives its title.'],
    ['Which tag gives a title to a table?', ['<title>', '<caption>', '<head>', '<legend>'], 1, '<caption> must be the first child of <table>.'],
    ['Which tags divide a table into header, body and footer sections?', ['<top>, <middle>, <bottom>', '<thead>, <tbody>, <tfoot>', '<head>, <body>, <foot>', '<th>, <tr>, <td>'], 1, '<thead>, <tbody> and <tfoot> group rows semantically.'],
    ['Which tags are used to build a description (definition) list?', ['<dl>, <dt>, <dd>', '<ul>, <li>, <dd>', '<ol>, <li>, <dt>', '<list>, <term>, <desc>'], 0, '<dl> is the list, <dt> the term and <dd> the description.'],
    ['Which code creates a link that opens the default email program?', ['<a href="mailto:abc@x.com">', '<a href="email:abc@x.com">', '<a href="mail=abc@x.com">', '<a src="mailto:abc@x.com">'], 0, 'The mailto: scheme starts a new email message.'],
    ['Which code creates a link that starts a phone call on mobile?', ['<a href="tel:9876543210">', '<a href="call:9876543210">', '<a href="phone=9876543210">', '<a href="dial:9876543210">'], 0, 'The tel: scheme dials the number on supported devices.'],
    ['How do you link to a section of the same page whose id is "contact"?', ['<a href="contact#">', '<a href="@contact">', '<a href="/contact">', '<a href="#contact">'], 3, 'A hash followed by an id jumps to that element.'],
    ['Which tag sets the base URL for all relative links in a page?', ['<root>', '<url>', '<link>', '<base>'], 3, '<base href=""> in <head> is used as the starting point for relative URLs.'],
    ['Which of these tags is deprecated and removed from HTML5?', ['<font>', '<section>', '<nav>', '<footer>'], 0, '<font> was replaced by CSS; HTML5 uses CSS for styling.'],
    ['Which tag was used to make text scroll horizontally (non-standard now)?', ['<scroll>', '<marquee>', '<move>', '<slide>'], 1, '<marquee> creates scrolling text but is obsolete.'],
    ['Which attributes set the size of an image in pixels?', ['size and length', 'width and height', 'x and y', 'top and left'], 1, 'width and height define the displayed size of <img>.'],
    ['Which pair of tags creates a clickable image map?', ['<img> and <hotspot>', '<link> and <area>', '<map> and <area>', '<map> and <zone>'], 2, '<map> holds clickable <area> regions used with usemap on <img>.'],
    ['Which attribute changes the numbering style of an ordered list to capital letters?', ['style="A"', 'letter="A"', 'type="A"', 'order="A"'], 2, 'type="A" gives A, B, C; type="1" gives numbers.'],
    ['Which attribute makes an ordered list start counting from 5?', ['begin="5"', 'from="5"', 'start="5"', 'count="5"'], 2, 'start="5" begins the numbering at 5.'],
    ['Which statement about HTML tags is correct?', ['HTML tags are case-sensitive', 'Only lowercase tags work', 'Only uppercase tags work', 'HTML tags are not case-sensitive'], 3, 'HTML tag names are not case-sensitive, but lowercase is recommended.'],
    ['What is the correct HTML for making a text input field?', ['<textinput>', '<input type="textfield">', '<text>', '<input type="text">'], 3, '<input type="text"> creates a single-line text box.'],
    ['Which input type creates a button that sends the form?', ['type="send"', 'type="go"', 'type="post"', 'type="submit"'], 3, 'A submit button submits the form to the action URL.'],
    ['Which input type clears all form fields to their original values?', ['clear', 'reset', 'delete', 'undo'], 1, 'type="reset" restores the default values.'],
    ['Which input type allows the user to choose a file to upload?', ['type="upload"', 'type="attach"', 'type="file"', 'type="browse"'], 2, 'type="file" opens the file chooser (form needs enctype="multipart/form-data").'],
    ['Which element is new in HTML5 and defines the introductory content of a page or section?', ['<top>', '<intro>', '<start>', '<header>'], 3, '<header> contains headings, logos and introductory content.'],
    ['Which HTML5 element defines the footer of a page or section?', ['<footer>', '<bottom>', '<end>', '<foot>'], 0, '<footer> usually holds copyright and contact information.'],
    ['Which HTML5 element defines a standalone, self-contained piece of content like a blog post?', ['<article>', '<section>', '<aside>', '<div>'], 0, '<article> can be distributed independently, e.g. a news story.'],
    ['Which HTML5 element groups related content under a heading in a thematic section?', ['<group>', '<part>', '<section>', '<block>'], 2, '<section> divides a document into thematic sections.'],
    ['Which HTML5 element holds content slightly related to the main content, such as a sidebar?', ['<aside>', '<side>', '<extra>', '<sidebar>'], 0, '<aside> is for tangential content like sidebars or ads.'],
    ['Which HTML5 element represents the dominant content of the <body>?', ['<primary>', '<content>', '<main>', '<center>'], 2, '<main> should appear only once per page.'],
    ['Which pair of HTML5 tags adds an image with a caption?', ['<img> and <caption>', '<image> and <title>', '<pic> and <text>', '<figure> and <figcaption>'], 3, '<figure> wraps the media and <figcaption> describes it.'],
    ['Which HTML5 tag is used to play audio files?', ['<audio>', '<sound>', '<music>', '<mp3>'], 0, '<audio controls> embeds an audio player without plugins.'],
    ['Which HTML5 tag embeds a video player?', ['<movie>', '<media>', '<video>', '<film>'], 2, '<video controls> plays MP4, WebM or Ogg files.'],
    ['Which attribute shows play, pause and volume buttons on <audio> or <video>?', ['buttons', 'player', 'controls', 'show'], 2, 'The Boolean controls attribute displays the default player controls.'],
    ['Which tag is used inside <video> to give different file formats for the same video?', ['<source>', '<format>', '<file>', '<track>'], 0, '<source src="movie.mp4" type="video/mp4"> lets the browser pick a supported format.'],
    ['Which HTML5 element is used to draw graphics with JavaScript?', ['<graphic>', '<draw>', '<canvas>', '<svg-js>'], 2, '<canvas> is a drawing area controlled by scripts.'],
    ['Which input type is new in HTML5 and validates an email address?', ['type="mail"', 'type="text-email"', 'type="email"', 'type="address"'], 2, 'type="email" checks for a valid email format.'],
    ['Which HTML5 input type shows a slider control?', ['range', 'slider', 'scroll', 'bar'], 0, 'type="range" lets the user pick a value between min and max.'],
    ['Which HTML5 input type displays a date picker?', ['calendar', 'date', 'day', 'datetime-text'], 1, 'type="date" shows a calendar picker in modern browsers.'],
    ['Which HTML5 attribute forces a user to fill a field before submitting the form?', ['mandatory', 'needed', 'validate', 'required'], 3, 'required prevents submitting an empty field.'],
    ['Which HTML5 attribute shows a hint text inside an input until the user types?', ['hint', 'placeholder', 'tip', 'default'], 1, 'placeholder displays light grey hint text inside the field.'],
    ['Which HTML5 element provides a list of predefined options for an <input> through the list attribute?', ['<select>', '<options>', '<datalist>', '<autocomplete>'], 2, '<datalist> gives autocomplete suggestions for an input.'],
    ['Which HTML5 element shows the progress of a task such as a download?', ['<progress>', '<status>', '<loader>', '<bar>'], 0, '<progress value="40" max="100"> displays a progress bar.'],
    ['Which HTML5 element displays a scalar measurement within a known range, such as disk usage?', ['<meter>', '<gauge>', '<range>', '<scale>'], 0, '<meter> shows a value in a known range, unlike <progress>.'],
    ['Which HTML5 elements create content that the user can expand or collapse?', ['<details> and <summary>', '<toggle> and <content>', '<open> and <close>', '<accordion> and <panel>'], 0, '<summary> is the visible heading and <details> reveals the rest.'],
    ['Which HTML5 tag highlights text like a marker pen?', ['<highlight>', '<hl>', '<mark>', '<em>'], 2, '<mark> shows text with a yellow background by default.'],
    ['What is the purpose of data-* attributes in HTML5?', ['To connect to a database', 'To define the data type of an input', 'To store custom data on elements', 'To encrypt the content'], 2, 'data-id="5" can be read in JavaScript through dataset.'],
    ['Which HTML5 feature stores data in the browser with no expiry date?', ['sessionStorage', 'cookie only', 'cacheStorage', 'localStorage'], 3, 'localStorage keeps data until it is cleared; sessionStorage ends with the tab.'],
    ['Which HTML5 API is used to find the geographical position of a user?', ['Position API', 'Map API', 'Geolocation API', 'Locate API'], 2, 'navigator.geolocation.getCurrentPosition() requests the location with permission.'],
    ['Which attribute makes an element editable by the user?', ['editable="true"', 'contenteditable="true"', 'edit="true"', 'write="true"'], 1, 'contenteditable lets the user edit the content directly.'],
    ['Which of the following elements is NOT supported in HTML5?', ['<abbr>', '<acronym>', '<mark>', '<time>'], 1, '<acronym> was removed; <abbr> replaces it.']
  ],
  /* ---------- CSS & W3.CSS (100 questions) ---------- */
  ox_css: [
    ['What does CSS stand for?', ['Cascading Style Sheets', 'Creative Style Sheets', 'Computer Style Sheets', 'Colorful Style Sheets'], 0, 'CSS = Cascading Style Sheets; it controls the look of HTML pages.'],
    ['Which HTML tag is used to link an external CSS file?', ['<style>', '<link>', '<css>', '<script>'], 1, '<link rel="stylesheet" href="style.css"> is placed inside <head>.'],
    ['Which CSS type has the highest priority when styles conflict?', ['Inline CSS', 'External CSS', 'Internal CSS', 'Browser default'], 0, 'Inline styles written in the style attribute override internal and external rules.'],
    ['Which selector targets an element with id="menu"?', ['.menu', '*menu', '#menu', 'menu'], 2, 'The hash symbol (#) selects by id.'],
    ['Which selector targets all elements with class="box"?', ['#box', '.box', 'box', '*box'], 1, 'The dot (.) selects by class name.'],
    ['Which selector selects every element on the page?', ['#', '*', '&', 'all'], 1, 'The universal selector * matches all elements.'],
    ['What is the correct way to apply the same style to h1 and p together?', ['h1 p { }', 'h1 > p { }', 'h1 + p { }', 'h1, p { }'], 3, 'A comma groups selectors so they share one rule.'],
    ['In div p { color: red; }, which elements become red?', ['Only direct child p of div', 'Every p inside a div at any level', 'Only the first p in div', 'Every div'], 1, 'A space is the descendant combinator and matches all nested p tags.'],
    ['In div > p { color: red; }, which elements are affected?', ['All p inside div at any depth', 'The p placed after div', 'Only p that are direct children of div', 'All div elements'], 2, 'The > combinator selects direct children only.'],
    ['What does h1 + p { } select?', ['All p after h1', 'The p inside h1', 'Every p in the page', 'The first p placed immediately after an h1'], 3, 'The + combinator selects the adjacent sibling right after h1.'],
    ['Which selector selects links that open in a new tab, a[target="_blank"]?', ['Class selector', 'Pseudo-class selector', 'Attribute selector', 'Universal selector'], 2, 'Square brackets create an attribute selector.'],
    ['Which pseudo-class styles an element when the mouse is over it?', [':hover', ':active', ':focus', ':visited'], 0, ':hover applies while the pointer is over the element.'],
    ['Which pseudo-class selects the first child of its parent?', [':first', ':start', ':top-child', ':first-child'], 3, ':first-child matches an element that is the first child.'],
    ['Which pseudo-element inserts content before an element content?', [':before-text', '::before', '::first', '::insert'], 1, '::before with the content property adds generated content.'],
    ['Which selector selects every even list item?', ['li:even', 'li:second', 'li:nth-child(even)', 'li:nth(2)'], 2, 'nth-child(even) selects 2nd, 4th, 6th ... children.'],
    ['Which is the correct syntax for a CSS comment?', ['// comment', '/* comment */', '<!-- comment -->', '# comment'], 1, 'CSS comments are written between /* and */.'],
    ['Which property changes the text colour?', ['text-color', 'font-color', 'fgcolor', 'color'], 3, 'The color property sets the foreground (text) colour.'],
    ['Which property sets the background colour of an element?', ['bgcolor', 'color-background', 'back-color', 'background-color'], 3, 'background-color accepts names, hex, rgb or hsl values.'],
    ['Which property sets an image as the background?', ['image', 'bg-src', 'background-image', 'background-src'], 2, 'background-image: url("pic.jpg") sets the image.'],
    ['Which value stops a background image from repeating?', ['repeat-none', 'stop', 'no-repeat', 'repeat: off'], 2, 'background-repeat: no-repeat shows the image only once.'],
    ['Which value makes a background image cover the full element?', ['background-size: cover', 'background-fit: full', 'background-size: stretch', 'background-cover: true'], 0, 'cover scales the image to fill the whole area.'],
    ['Which property changes the font of text?', ['font-style', 'text-font', 'typeface', 'font-family'], 3, 'font-family selects the typeface, e.g. Arial, sans-serif.'],
    ['Which property changes the size of text?', ['font-size', 'text-size', 'size', 'font-height'], 0, 'font-size sets the text size, e.g. 16px.'],
    ['Which declaration makes text bold?', ['text-style: bold', 'font: bolder-only', 'font-weight: bold', 'weight: bold'], 2, 'font-weight accepts normal, bold or numbers like 700.'],
    ['Which declaration makes text italic?', ['font-style: italic', 'text-style: italic', 'font-weight: italic', 'text-decoration: italic'], 0, 'font-style: italic slants the text.'],
    ['Which declaration centres text horizontally inside its container?', ['align: center', 'text-align: center', 'text-center: true', 'font-align: middle'], 1, 'text-align controls horizontal alignment of inline content.'],
    ['Which declaration removes the underline from links?', ['underline: none', 'link-style: none', 'text-decoration: none', 'text-style: plain'], 2, 'text-decoration: none removes underlines.'],
    ['Which declaration makes all letters capital?', ['font-variant: caps-lock', 'text-transform: uppercase', 'text-case: upper', 'letter-case: capital'], 1, 'text-transform: uppercase converts text to capital letters.'],
    ['Which property controls the space between lines of text?', ['line-spacing', 'line-height', 'text-space', 'row-gap'], 1, 'line-height sets the height of each line box.'],
    ['In the CSS box model, what is the correct order from the inside to the outside?', ['Margin, border, padding, content', 'Content, padding, border, margin', 'Content, border, padding, margin', 'Padding, content, border, margin'], 1, 'Content is at the centre, then padding, border and margin.'],
    ['Which part of the box model is the space between content and border?', ['Margin', 'Padding', 'Outline', 'Gap'], 1, 'Padding is inside the border; margin is outside it.'],
    ['Which part of the box model creates space outside the border?', ['Padding', 'Margin', 'Content', 'Spacing'], 1, 'Margin separates an element from its neighbours.'],
    ['What does margin: 10px 20px; mean?', ['10px left and right, 20px top and bottom', '10px top, 20px bottom', '10px all around', '10px top and bottom, 20px left and right'], 3, 'Two values mean vertical first, horizontal second.'],
    ['In margin: 10px 20px 30px 40px; which value is for the left side?', ['10px', '20px', '40px', '30px'], 2, 'The order is top, right, bottom, left (clockwise).'],
    ['Which declaration creates a 2px solid red border?', ['border: 2px solid red', 'border: red 2px dash', 'border-style: 2px red', 'outline-border: 2px red'], 0, 'The border shorthand takes width, style and colour.'],
    ['Which property gives an element rounded corners?', ['border-radius', 'corner-radius', 'border-curve', 'round'], 0, 'border-radius: 50% can make a circle from a square.'],
    ['What does box-sizing: border-box do?', ['Removes the border', 'Adds margin to the width', 'Hides the box', 'Includes padding and border inside the given width and height'], 3, 'With border-box the width includes padding and border.'],
    ['Which property prevents content overflow by hiding the extra part?', ['overflow: clip-all', 'display: overflow', 'hide: overflow', 'overflow: hidden'], 3, 'overflow: hidden cuts off the content that does not fit.'],
    ['What is the difference between display: none and visibility: hidden?', ['There is no difference', 'visibility:hidden removes the space; display:none keeps it', 'display:none removes the space; visibility:hidden keeps the space', 'Both delete the element from the DOM'], 2, 'visibility:hidden hides the element but it still occupies space.'],
    ['Which display value lets an element sit in line but accept width and height?', ['inline', 'block', 'none', 'inline-block'], 3, 'inline-block combines inline flow with box dimensions.'],
    ['What is the default value of the position property?', ['static', 'relative', 'absolute', 'fixed'], 0, 'Elements are positioned in normal flow (static) by default.'],
    ['Which position value moves an element relative to its normal position?', ['relative', 'absolute', 'fixed', 'sticky'], 0, 'position: relative with top/left offsets shifts it from where it would normally be.'],
    ['An absolutely positioned element is placed relative to which element?', ['The viewport always', 'Its previous sibling', 'The body only', 'The nearest positioned ancestor'], 3, 'If no ancestor is positioned, it uses the initial containing block.'],
    ['Which position value keeps an element fixed in the viewport while scrolling?', ['sticky', 'relative', 'fixed', 'absolute'], 2, 'position: fixed stays in the same place on the screen.'],
    ['Which position value toggles between relative and fixed depending on scroll position?', ['sticky', 'static', 'inherit', 'floating'], 0, 'position: sticky sticks when the scroll threshold is reached.'],
    ['Which property controls the stacking order of overlapping positioned elements?', ['stack', 'layer', 'order-z', 'z-index'], 3, 'A higher z-index appears in front of a lower one.'],
    ['Which property is used to clear floated elements?', ['clear', 'float-stop', 'reset', 'clean'], 0, 'clear: both makes an element move below floated items.'],
    ['Which declaration turns an element into a flex container?', ['display: flex', 'flex: container', 'position: flex', 'layout: flex'], 0, 'display: flex activates the flexbox layout on children.'],
    ['In a row flex container, which property centres items along the main axis?', ['align-items: center', 'text-align: center', 'justify-content: center', 'flex-align: center'], 2, 'justify-content aligns along the main axis, align-items along the cross axis.'],
    ['Which property aligns flex items along the cross axis?', ['justify-content', 'flex-flow', 'align-items', 'place-main'], 2, 'align-items controls the cross-axis alignment.'],
    ['Which declaration stacks flex items vertically?', ['flex-direction: vertical', 'flex-stack: y', 'direction: column', 'flex-direction: column'], 3, 'flex-direction: column changes the main axis to vertical.'],
    ['Which property lets flex items wrap onto the next line?', ['wrap: yes', 'flex-line: multi', 'overflow: wrap', 'flex-wrap: wrap'], 3, 'flex-wrap: wrap allows multiple lines.'],
    ['Which declaration creates a CSS grid layout?', ['grid: on', 'layout: grid', 'position: grid', 'display: grid'], 3, 'display: grid turns the element into a grid container.'],
    ['What does grid-template-columns: repeat(3, 1fr); create?', ['Three equal-width columns', 'Three rows', 'One column three times wider', 'Three fixed pixel columns'], 0, '1fr means one fraction of the free space, so each column is equal.'],
    ['Which property sets the space between grid or flex items?', ['spacing', 'gutter', 'gap', 'margin-gap-all'], 2, 'gap (or grid-gap) sets row and column spacing.'],
    ['Which unit is relative to the font-size of the root (html) element?', ['em', 'rem', 'px', 'pt'], 1, 'rem = root em; 1rem equals the font-size of <html>.'],
    ['Which unit is relative to the font-size of the parent element?', ['em', 'rem', 'vw', 'cm'], 0, 'em depends on the current element or parent font-size.'],
    ['What does 50vw mean?', ['50% of the viewport width', '50% of the parent width', '50 pixels wide', '50% of the font size'], 0, 'vw = 1% of the viewport width.'],
    ['Which of the following is a valid hexadecimal colour for red?', ['#00ff00', '#0000ff', '#ffff00', '#ff0000'], 3, '#ff0000 = full red, no green, no blue.'],
    ['What does the "a" in rgba() stand for?', ['Angle', 'Alpha (opacity)', 'Area', 'Auto'], 1, 'The 4th value is alpha: 0 is transparent and 1 is opaque.'],
    ['Which property sets the transparency of an entire element?', ['alpha', 'visibility', 'opacity', 'transparency'], 2, 'opacity: 0.5 makes the element half transparent.'],
    ['Which property creates a smooth change between two states of a style?', ['transition', 'transform', 'animation-fill', 'smooth'], 0, 'transition: all 0.3s animates property changes.'],
    ['Which declaration rotates an element by 45 degrees?', ['rotate: 45', 'transform: rotate(45deg)', 'turn: 45deg', 'transform: spin(45)'], 1, 'transform: rotate(45deg) turns the element clockwise.'],
    ['Which rule is used to define the steps of a CSS animation?', ['@keyframes', '@animate', '@frames', '@steps'], 0, '@keyframes defines the animation stages and animation-name applies it.'],
    ['Which rule is used to make a page responsive for different screen widths?', ['@screen-size', '@responsive', '@device', '@media'], 3, '@media (max-width: 600px) { ... } applies styles only on small screens.'],
    ['Which property adds a shadow around an element box?', ['box-shadow', 'shadow', 'element-shadow', 'border-shadow'], 0, 'box-shadow: 2px 2px 5px grey creates a shadow.'],
    ['Which property adds a shadow to text?', ['font-shadow', 'shadow-text', 'letter-shadow', 'text-shadow'], 3, 'text-shadow takes horizontal, vertical, blur and colour.'],
    ['Which declaration shows a hand pointer when hovering over an element?', ['pointer: hand', 'cursor: pointer', 'mouse: hand', 'hover: pointer'], 1, 'cursor: pointer shows the link-style hand icon.'],
    ['Which declaration removes bullets from a list?', ['bullet: none', 'list-style-type: none', 'list: no-bullet', 'text-decoration: none'], 1, 'list-style-type: none hides markers.'],
    ['What does !important do in a CSS declaration?', ['Marks a comment', 'Gives the declaration the highest priority over normal rules', 'Deletes the rule', 'Makes the rule optional'], 1, '!important overrides normal specificity rules.'],
    ['Which selector has the highest specificity?', ['Element selector', 'Id selector', 'Class selector', 'Universal selector'], 1, 'Specificity order: inline > id > class/attribute/pseudo-class > element.'],
    ['If two rules have the same specificity, which one is applied?', ['The first one', 'The shorter one', 'The last one written', 'Neither'], 2, 'The later rule in the cascade wins when specificity is equal.'],
    ['Which of these properties is inherited by child elements by default?', ['margin', 'border', 'padding', 'color'], 3, 'Text-related properties like color and font-family are inherited; box properties are not.'],
    ['How do you declare a CSS variable named main-color?', ['$main-color: red;', '@main-color: red;', '--main-color: red;', 'var main-color = red;'], 2, 'Custom properties begin with two hyphens.'],
    ['How do you use a CSS variable named --main-color?', ['get(--main-color)', '$(--main-color)', 'use(--main-color)', 'var(--main-color)'], 3, 'The var() function reads the value of a custom property.'],
    ['Which CSS function performs calculations such as width: calc(100% - 50px)?', ['math()', 'compute()', 'sum()', 'calc()'], 3, 'calc() lets you mix units in arithmetic.'],
    ['Which declaration centres a block element with a fixed width horizontally?', ['align: center', 'text-align: center', 'margin: 0 auto', 'padding: auto'], 2, 'Automatic left and right margins centre the block.'],
    ['Which pseudo-class selects elements that do NOT match a given selector?', [':except()', ':not()', ':without()', ':exclude()'], 1, 'p:not(.intro) selects all p without the class intro.'],
    ['What is W3.CSS?', ['A modern CSS framework with ready-made classes', 'A JavaScript library', 'A database system', 'A server-side language'], 0, 'W3.CSS is a lightweight, responsive CSS framework from W3Schools.'],
    ['How do you include W3.CSS in an HTML page?', ['<script src="w3.css">', '<import w3css>', '<style src="w3.css"></style>', '<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">'], 3, 'Add the stylesheet link in the <head> section.'],
    ['Which W3.CSS class adds standard padding to a content block?', ['w3-container', 'w3-box', 'w3-wrap', 'w3-block-pad'], 0, 'w3-container adds 16px left and right padding and a small vertical padding.'],
    ['Which W3.CSS class styles a button?', ['w3-btn-only', 'w3-button', 'w3-click', 'w3-press'], 1, 'w3-button gives hover effects and padding to buttons and links.'],
    ['Which W3.CSS class adds a box shadow to an element?', ['w3-shadow-box', 'w3-card', 'w3-glow', 'w3-lift'], 1, 'w3-card (and w3-card-4) creates a shadowed card.'],
    ['Which W3.CSS class gives a green background colour?', ['w3-bg-green', 'w3-color-green', 'w3-green', 'w3-back-green'], 2, 'Colour classes use the pattern w3-colorname, like w3-green or w3-blue.'],
    ['Which W3.CSS class makes the text red?', ['w3-text-red', 'w3-red-text', 'w3-font-red', 'w3-color-red'], 0, 'Text colours use w3-text-colorname.'],
    ['Which W3.CSS class gives an element rounded corners?', ['w3-curve', 'w3-round', 'w3-corner', 'w3-smooth'], 1, 'w3-round, w3-round-large and w3-round-xlarge set border-radius.'],
    ['Which W3.CSS class turns an image into a circle?', ['w3-circle', 'w3-round-image', 'w3-ring', 'w3-oval'], 0, 'w3-circle gives border-radius: 50%.'],
    ['Which W3.CSS class makes an element container for a horizontal navigation bar?', ['w3-nav', 'w3-menu', 'w3-bar', 'w3-topbar'], 2, 'w3-bar with w3-bar-item children creates a menu bar.'],
    ['Which W3.CSS class creates a fixed sidebar?', ['w3-side', 'w3-drawer', 'w3-left-panel', 'w3-sidebar'], 3, 'w3-sidebar is fixed to the left by default; w3-bar-block stacks its items.'],
    ['Which W3.CSS class creates a dropdown that opens on hover?', ['w3-dropdown-click', 'w3-hover-menu', 'w3-dropdown-hover', 'w3-menu-drop'], 2, 'w3-dropdown-hover holds a w3-dropdown-content child.'],
    ['Which W3.CSS classes create a pop-up window (modal)?', ['w3-popup and w3-popup-box', 'w3-dialog and w3-dialog-box', 'w3-modal and w3-modal-content', 'w3-window and w3-window-body'], 2, 'w3-modal is the overlay and w3-modal-content is the dialog box.'],
    ['Which W3.CSS class makes a table scroll horizontally on small screens?', ['w3-scroll', 'w3-responsive', 'w3-table-scroll', 'w3-mobile'], 1, 'Wrap the table in a div with w3-responsive.'],
    ['Which W3.CSS class gives a table zebra-striped rows?', ['w3-zebra', 'w3-lines', 'w3-striped', 'w3-rowcolor'], 2, 'w3-striped colours alternate rows; w3-bordered adds borders.'],
    ['Which W3.CSS class hides an element on small screens (phones)?', ['w3-hide-small', 'w3-no-mobile', 'w3-hide-phone', 'w3-small-none'], 0, 'w3-hide-small hides content on screens smaller than 601px.'],
    ['Which W3.CSS class adds default padding on all four sides of an element?', ['w3-space', 'w3-inner', 'w3-pad-all', 'w3-padding'], 3, 'w3-padding adds 8px 16px padding; w3-margin adds margin.'],
    ['Which W3.CSS class makes an element appear in the exact middle of a w3-display-container?', ['w3-center-all', 'w3-display-middle', 'w3-middle', 'w3-display-center'], 1, 'w3-display-middle positions content at the centre of its container.'],
    ['Which W3.CSS class makes an element fade in on page load?', ['w3-fade-in', 'w3-appear', 'w3-show-slow', 'w3-animate-opacity'], 3, 'w3-animate-opacity, w3-animate-left and w3-animate-zoom add simple animations.'],
    ['Which W3.CSS class is used for form inputs to get a clean style?', ['w3-form', 'w3-field', 'w3-input', 'w3-textbox'], 2, 'w3-input styles text fields; w3-select styles drop-downs.'],
    ['Which W3.CSS class sets a very large heading font size?', ['w3-jumbo', 'w3-huge-size', 'w3-big-font', 'w3-giant'], 0, 'Sizes include w3-small, w3-medium, w3-large, w3-xlarge, w3-xxlarge and w3-jumbo.'],
    ['How many columns does the W3.CSS responsive grid system use?', ['6', '10', '12', '16'], 2, 'W3.CSS uses a 12-column grid, with classes like w3-col m6 l4.']
  ],
  /* ---------- JavaScript & AngularJS (100 questions) ---------- */
  ox_js: [
    ['JavaScript is mainly known as which type of language?', ['Markup language', 'Scripting language', 'Database language', 'Styling language'], 1, 'JavaScript is a lightweight scripting language that adds behaviour to web pages.'],
    ['Who created JavaScript in 1995?', ['James Gosling', 'Brendan Eich', 'Guido van Rossum', 'Bjarne Stroustrup'], 1, 'Brendan Eich created JavaScript at Netscape in just ten days.'],
    ['Which HTML tag is used to write JavaScript code?', ['<script>', '<js>', '<javascript>', '<code>'], 0, 'JavaScript is written inside <script> tags.'],
    ['Which attribute of <script> links an external JavaScript file?', ['href', 'link', 'file', 'src'], 3, '<script src="app.js"></script> loads an external script.'],
    ['Which method shows a message in a pop-up box?', ['msg()', 'popup()', 'notify()', 'alert()'], 3, 'alert("Hello") displays a dialog with an OK button.'],
    ['Which statement prints a value in the browser console?', ['print()', 'console.log()', 'echo()', 'document.console()'], 1, 'console.log() writes output to the developer console.'],
    ['Which keyword declares a block-scoped variable that can be reassigned?', ['var', 'let', 'const', 'static'], 1, 'let is block scoped and can change; const cannot be reassigned.'],
    ['What happens when you try to reassign a variable declared with const?', ['It works normally', 'The old value stays silently', 'It gives an error', 'The variable becomes undefined'], 2, 'Assigning to a const variable throws a TypeError.'],
    ['Which of these is NOT a JavaScript data type?', ['Float', 'String', 'Boolean', 'Undefined'], 0, 'JavaScript has Number, not a separate Float type.'],
    ['What is the output of typeof "hello"?', ['text', 'char', 'string', 'word'], 2, 'typeof returns the data type name as a string.'],
    ['What does typeof null return?', ['null', 'undefined', 'number', 'object'], 3, 'This is a well-known quirk of JavaScript: typeof null is "object".'],
    ['What is the difference between == and ===?', ['No difference', '== also checks the data type', '=== also checks the data type', '=== is assignment'], 2, '=== is strict equality: both value and type must match.'],
    ['What is the result of 5 + "5" in JavaScript?', ['10', '55', 'Error', 'NaN'], 1, 'The + operator joins when one operand is a string, so the result is "55".'],
    ['What is the result of "10" - 3?', ['103', 'NaN', '"7"', '7'], 3, 'The - operator converts the string to a number, giving 7.'],
    ['What is the value of 10 % 3?', ['3', '0', '3.33', '1'], 3, 'The % (modulus) operator returns the remainder, which is 1.'],
    ['Which operator is used for logical AND?', ['||', '&', '!!', '&&'], 3, '&& returns true only if both conditions are true.'],
    ['Which loop always runs its body at least once?', ['for', 'while', 'do...while', 'for...in'], 2, 'do...while checks the condition after executing the body.'],
    ['Which statement stops a loop completely?', ['stop', 'continue', 'break', 'exit'], 2, 'break ends the loop; continue skips only the current iteration.'],
    ['Which statement skips the current iteration and moves to the next one?', ['break', 'skip', 'continue', 'next'], 2, 'continue jumps to the next iteration of the loop.'],
    ['What is the correct syntax to declare a function?', ['function myFunc() { }', 'def myFunc() { }', 'func myFunc() { }', 'function = myFunc() { }'], 0, 'Functions are declared with the function keyword.'],
    ['Which is the correct syntax of an arrow function that adds two numbers?', ['function => (a, b) a + b', '(a, b) => a + b', '(a, b) -> a + b', 'a, b => { a + b }'], 1, 'Arrow functions use => between parameters and body.'],
    ['Which keyword sends a value back from a function?', ['send', 'output', 'return', 'yield-back'], 2, 'return ends the function and gives back a value.'],
    ['What is the index of the first element in a JavaScript array?', ['1', '0', '-1', 'It depends'], 1, 'Array indexes start at 0.'],
    ['Which method adds an element at the end of an array?', ['pop()', 'shift()', 'push()', 'unshift()'], 2, 'push() appends one or more items at the end.'],
    ['Which method removes the last element of an array?', ['push()', 'shift()', 'remove()', 'pop()'], 3, 'pop() removes and returns the last element.'],
    ['Which method removes the first element of an array?', ['pop()', 'shift()', 'splice-first()', 'delete()'], 1, 'shift() removes and returns the first element.'],
    ['Which method creates a new array by applying a function to every element?', ['forEach()', 'filter()', 'map()', 'reduce()'], 2, 'map() returns a new array with the results.'],
    ['Which method creates a new array with only the elements that pass a test?', ['map()', 'filter()', 'find-all()', 'select()'], 1, 'filter() keeps elements for which the callback returns true.'],
    ['Which method joins all array elements into a string?', ['concat()', 'merge()', 'join()', 'toText()'], 2, '["a","b"].join("-") gives "a-b".'],
    ['What does the length property of "Hello" return?', ['4', '6', 'undefined', '5'], 3, 'The string has 5 characters.'],
    ['Which method converts a string to upper case?', ['toUpperCase()', 'upper()', 'capitalize()', 'toCaps()'], 0, '"abc".toUpperCase() returns "ABC".'],
    ['Which method splits a string into an array?', ['divide()', 'break()', 'split()', 'cut()'], 2, '"a,b,c".split(",") returns ["a","b","c"].'],
    ['Which symbols are used to insert variables inside a template literal?', ['{{ }}', '#{ }', '% %', '${ }'], 3, 'Template literals use backticks and ${expression}.'],
    ['Which of the following is the correct way to create an object?', ['let o = { name: "Ravi", age: 20 };', 'let o = ( name = "Ravi" );', 'let o = [ name: "Ravi" ];', 'let o = < name: "Ravi" >;'], 0, 'Objects use curly braces with key: value pairs.'],
    ['Which method converts a JavaScript object into a JSON string?', ['JSON.parse()', 'JSON.toString()', 'JSON.encode()', 'JSON.stringify()'], 3, 'JSON.stringify() serializes; JSON.parse() does the reverse.'],
    ['Which method finds an HTML element using its id?', ['document.getElementById()', 'document.getId()', 'document.findElement()', 'document.id()'], 0, 'getElementById returns the element with the matching id.'],
    ['Which property changes the HTML content inside an element?', ['outerText-only', 'innerHTML', 'html', 'content'], 1, 'element.innerHTML reads or sets the HTML inside an element.'],
    ['Which property changes only the text of an element and ignores HTML tags?', ['textContent', 'innerHTML', 'htmlText', 'value-text'], 0, 'textContent treats the string as plain text.'],
    ['Which code changes the text colour of an element with id "box" to red?', ['document.getElementById("box").style.color = "red";', 'document.getElementById("box").color = "red";', 'document.getElementById("box").css = "red";', 'document.getElementById("box").text-color = "red";'], 0, 'CSS properties are set through the style object.'],
    ['Which method attaches an event handler to an element?', ['attachClick()', 'onEvent()', 'listen()', 'addEventListener()'], 3, 'element.addEventListener("click", fn) registers a listener.'],
    ['Which event occurs when the user clicks an HTML element?', ['onchange', 'onmouseclick', 'onclick', 'onpress'], 2, 'onclick fires on mouse click.'],
    ['Which event occurs when the value of an input field changes?', ['onclick', 'onload', 'onhover', 'onchange'], 3, 'onchange fires after the value is changed and focus is lost.'],
    ['Which event occurs when the page has finished loading?', ['onready', 'onopen', 'onstart', 'onload'], 3, 'window.onload runs after the page and its resources are loaded.'],
    ['Which method runs a function once after a delay?', ['setInterval()', 'delay()', 'setTimeout()', 'wait()'], 2, 'setTimeout(fn, 1000) runs fn after 1 second.'],
    ['Which method runs a function repeatedly at a fixed interval?', ['setTimeout()', 'repeat()', 'setInterval()', 'loop()'], 2, 'setInterval repeats until clearInterval is called.'],
    ['Which method returns a random number between 0 (inclusive) and 1 (exclusive)?', ['Math.rand()', 'Math.random()', 'random()', 'Math.number()'], 1, 'Math.random() returns a decimal in the range [0, 1).'],
    ['What is the result of Math.floor(4.9)?', ['5', '4', '4.9', '0'], 1, 'Math.floor rounds down to the nearest integer.'],
    ['What is the result of Math.round(2.5)?', ['2', '2.5', '4', '3'], 3, 'Math.round rounds .5 upwards, so the answer is 3.'],
    ['What does parseInt("42px") return?', ['NaN', '"42px"', '0', '42'], 3, 'parseInt reads digits until it meets a non-digit character.'],
    ['What does NaN stand for?', ['Not a Number', 'No arithmetic Number', 'Null and Nothing', 'New Array Name'], 0, 'NaN means Not-a-Number, the result of an invalid numeric operation.'],
    ['Which function checks whether a value is NaN?', ['checkNaN()', 'notNumber()', 'isNumber()', 'isNaN()'], 3, 'isNaN("abc") returns true.'],
    ['Which object is used to work with dates and times?', ['Date', 'Time', 'Calendar', 'Clock'], 0, 'new Date() creates a date object with the current date and time.'],
    ['Which method returns the four-digit year of a Date object?', ['getFullYear()', 'getYear()', 'getYearNumber()', 'year()'], 0, 'getFullYear() returns for example 2026.'],
    ['Which block is used to handle errors in JavaScript?', ['do...error', 'if...error', 'try...catch', 'error...handle'], 2, 'Code in try is tested and catch handles any error.'],
    ['What does the confirm() method return?', ['A string', 'A number', 'undefined', 'true or false'], 3, 'confirm shows OK and Cancel; OK returns true, Cancel returns false.'],
    ['Which method asks the user to enter a value in a dialog box?', ['prompt()', 'input()', 'ask()', 'read()'], 0, 'prompt("Name?") returns the typed text or null.'],
    ['Which is the correct way to write a single-line comment in JavaScript?', ['<!-- comment -->', '// comment', '# comment', '** comment'], 1, '// starts a single-line comment; /* */ is for multi-line.'],
    ['What does this statement do: window.location.href = "https://example.com"?', ['Reloads the page', 'Opens a pop-up', 'Redirects to another page', 'Prints the URL'], 2, 'Setting location.href navigates the browser to a new URL.'],
    ['What is the value of a variable that is declared but not assigned?', ['null', '0', 'NaN', 'undefined'], 3, 'An uninitialised variable holds undefined.'],
    ['Which of the following is a falsy value in JavaScript?', ['0', '"0"', '[]', '{}'], 0, 'Falsy values: false, 0, "", null, undefined, NaN. The string "0" is truthy.'],
    ['Which operator is the ternary (conditional) operator?', ['=>', '? :', '::', '&&'], 1, 'condition ? valueIfTrue : valueIfFalse.'],
    ['What does the DOM stand for?', ['Data Object Method', 'Document Object Model', 'Digital Order Model', 'Document Oriented Markup'], 1, 'DOM is the tree representation of an HTML document.'],
    ['Which keyword is used to create a new object instance from a constructor or class?', ['new', 'create', 'make', 'instance'], 0, 'new Person("Amit") creates an object from the Person constructor.'],
    ['Which method prevents the default action of an event, such as form submission?', ['event.stop()', 'event.preventDefault()', 'event.cancel()', 'event.block()'], 1, 'preventDefault() stops the browser default behaviour.'],
    ['Which storage keeps data in the browser even after the browser is closed?', ['sessionStorage', 'Variable', 'localStorage', 'Array'], 2, 'localStorage has no expiry; sessionStorage ends with the tab.'],
    ['Which ES6 feature copies or expands array elements using three dots?', ['Spread operator', 'Rest pointer', 'Ellipsis function', 'Dot loop'], 0, 'The spread operator (...) expands iterables, e.g. [...a, ...b].'],
    ['What does async/await help with in JavaScript?', ['Writing asynchronous code in a readable way', 'Styling pages', 'Creating arrays', 'Declaring variables'], 0, 'async functions return promises and await pauses until they resolve.'],
    ['Which JavaScript function is used to fetch data from a server using promises?', ['fetch()', 'get()', 'request()', 'load()'], 0, 'fetch(url).then(res => res.json()) is the modern way to call an API.'],
    ['AngularJS is a framework developed by which company?', ['Facebook', 'Google', 'Microsoft', 'Oracle'], 1, 'AngularJS (version 1.x) was developed and maintained by Google.'],
    ['Which directive defines the root element of an AngularJS application?', ['ng-start', 'ng-root', 'ng-main', 'ng-app'], 3, 'ng-app initialises the AngularJS application on the element.'],
    ['Which directive binds the value of an input field to application data?', ['ng-model', 'ng-bind', 'ng-value', 'ng-data'], 0, 'ng-model creates two-way data binding with the input.'],
    ['Which directive attaches a controller to a part of the view?', ['ng-control', 'ng-ctrl', 'ng-manager', 'ng-controller'], 3, 'ng-controller="myCtrl" connects the HTML with the controller function.'],
    ['How do you display an AngularJS expression in HTML?', ['{{ expression }}', '[[ expression ]]', '<% expression %>', '${ expression }'], 0, 'Double curly braces display the expression value.'],
    ['What is the output of {{ 5 + 5 }} in AngularJS?', ['5 + 5', '10', '55', 'Error'], 1, 'AngularJS evaluates the expression and displays 10.'],
    ['Which directive repeats an HTML element for each item in an array?', ['ng-loop', 'ng-for', 'ng-repeat', 'ng-each'], 2, 'ng-repeat="x in items" creates one element per item.'],
    ['Which directive handles a mouse click event in AngularJS?', ['ng-onclick', 'ng-click', 'ng-press', 'ng-tap'], 1, 'ng-click="doSomething()" runs the function on click.'],
    ['Which directive initialises application data inline in the view?', ['ng-init', 'ng-set', 'ng-data-start', 'ng-begin'], 0, 'ng-init="name=\'Amit\'" sets initial values.'],
    ['What is the difference between ng-show and ng-if?', ['No difference', 'ng-show hides using CSS; ng-if removes the element from the DOM', 'ng-if hides using CSS; ng-show removes the element from the DOM', 'ng-show works only for images'], 1, 'ng-if adds or removes the element, while ng-show only toggles display.'],
    ['Which directive adds CSS classes dynamically based on an expression?', ['ng-css', 'ng-style-class', 'ng-addclass', 'ng-class'], 3, 'ng-class applies class names conditionally.'],
    ['Which directive disables a button when its expression is true?', ['ng-off', 'ng-lock', 'ng-disabled', 'ng-stop'], 2, 'ng-disabled="form.$invalid" disables the control while the condition is true.'],
    ['Which directive builds a drop-down list from an array or object?', ['ng-list', 'ng-options', 'ng-select', 'ng-items'], 1, 'ng-options="x for x in names" fills a <select> element.'],
    ['Which directive runs a function when a form is submitted?', ['ng-send', 'ng-post', 'ng-submit', 'ng-action'], 2, 'ng-submit="save()" handles the submit event.'],
    ['Which directive includes HTML from an external file into the page?', ['ng-import', 'ng-load', 'ng-insert', 'ng-include'], 3, 'ng-include="\'menu.html\'" embeds the file content.'],
    ['What is $scope in AngularJS?', ['An object that links the controller and the view', 'A CSS class', 'A database table', 'A browser plugin'], 0, '$scope holds the model data and functions available to the view.'],
    ['How do you create an AngularJS module named myApp?', ['angular.module("myApp", [])', 'angular.create("myApp")', 'new Module("myApp")', 'angular.app("myApp")'], 0, 'The second argument is the array of dependencies.'],
    ['Which code defines a controller named myCtrl in a module stored in the variable app?', ['app.add("myCtrl", $scope)', 'app.ctrl = function myCtrl() { }', 'app.controller("myCtrl", function($scope) { })', 'controller.app("myCtrl")'], 2, 'The controller function receives $scope through dependency injection.'],
    ['Which AngularJS filter converts text to upper case?', ['upper', 'capital', 'uppercase', 'toUpper'], 2, '{{ name | uppercase }} displays the text in capital letters.'],
    ['Which symbol is used to apply a filter to an expression?', ['& (ampersand)', '# (hash)', '~ (tilde)', '| (pipe)'], 3, 'Filters are added with the pipe character, e.g. {{ price | currency }}.'],
    ['Which AngularJS filter formats a number as money?', ['currency', 'money', 'price', 'rupee'], 0, '{{ 250 | currency }} outputs $250.00 by default.'],
    ['Which filter sorts an array in ng-repeat?', ['sort', 'arrange', 'orderBy', 'sortBy'], 2, 'ng-repeat="x in items | orderBy:\'name\'" sorts items by name.'],
    ['Which AngularJS service is used to read data from a remote server?', ['$ajax', '$server', '$request', '$http'], 3, '$http.get(url).then(...) sends an HTTP request.'],
    ['What is dependency injection in AngularJS?', ['Writing CSS inside JavaScript', 'Providing required objects such as $scope to a function automatically', 'Deleting unused files', 'Converting JSON into HTML'], 1, 'AngularJS passes needed services to controllers by name.'],
    ['Which AngularJS feature automatically updates the view when the model changes and the model when the view changes?', ['One-way binding', 'Two-way data binding', 'Event bubbling', 'Template caching'], 1, 'Two-way data binding keeps model and view synchronised.'],
    ['Which module and service are required for routing in AngularJS?', ['ngRoute and $routeProvider', 'ngLink and $linkProvider', 'ngPage and $pageProvider', 'ngMove and $moveProvider'], 0, 'ngRoute with $routeProvider maps URLs to templates and controllers.'],
    ['Which directive shows the template of the current route?', ['ng-route', 'ng-view', 'ng-page', 'ng-show-route'], 1, 'ng-view is the placeholder where route templates are rendered.'],
    ['Which directive prevents the user from seeing raw {{ }} expressions before AngularJS loads?', ['ng-hide-raw', 'ng-wait', 'ng-ready', 'ng-cloak'], 3, 'ng-cloak hides the element until AngularJS has compiled it.'],
    ['AngularJS follows which software design pattern?', ['Singleton-only', 'Waterfall', 'MVC (Model-View-Controller)', 'Client-Cloud-Core'], 2, 'AngularJS uses an MVC-style architecture.'],
    ['Which AngularJS form property is true when all form fields are valid?', ['$correct', '$ok', '$valid', '$clean'], 2, 'form.$valid becomes true when all validation rules pass.'],
    ['Which directive creates a custom HTML element or attribute in AngularJS?', ['.element()', '.directive()', '.component-only()', '.tag()'], 1, 'app.directive("myTag", function() { ... }) defines a custom directive.'],
    ['How do you add AngularJS to a web page?', ['Include the AngularJS library with a <script> tag', 'Add a <link> to a CSS file', 'Use <angular> tag', 'Use @import angular'], 0, 'AngularJS is added through a <script src="...angular.min.js"> tag.']
  ]
};

/* ===== Adapter: aapke purane format ke questions bina badle chalte hain ===== */
/* Naya bilingual format bhi chalta hai:
   Q('English question', 'हिंदी प्रश्न', ['A','B','C','D'], sahi_number, ['अ','ब','स','द'])   (Hindi options optional) */
const Q = (en, hi, o, a, oh) => ({ q: { en, hi }, o: { en: o, hi: oh || o }, a, ol: 'en' });

/* Chapters ke Hindi naam (language Hindi hone par dikhte hain) */
const CH_HI = {
  c1: 'कंप्यूटर का परिचय', c2: 'ऑपरेटिंग सिस्टम का परिचय', c3: 'लिब्रे ऑफिस राइटर', c4: 'लिब्रे ऑफिस कैल्क', c5: 'लिब्रे ऑफिस इम्प्रेस',
  c6: 'इंटरनेट और WWW का परिचय', c7: 'ई-गवर्नेंस और डिजिटल वित्तीय सेवाएँ', c8: 'फ्यूचर स्किल्स और साइबर सुरक्षा', c9: 'भारतीय भाषा डिजिटल सेवाएँ और उभरती तकनीकें',
  o1: 'आईटी टूल्स और नेटवर्क बेसिक्स', o2: 'वेब डिज़ाइनिंग और पब्लिशिंग', o3: 'पायथन प्रोग्रामिंग', o4: 'इंटरनेट ऑफ थिंग्स (IoT)', o5: 'एडवांस आईटी सिस्टम और सुरक्षा'
};
Object.assign(CH_HI, { ox_html: 'HTML और HTML5', ox_css: 'CSS और W3.CSS', ox_js: 'JavaScript और AngularJS' });
const ttl = c => lang === 'hi' ? (CH_HI[c[0]] || c[1]) : c[1];

/* English version of a question (optional). Language English hone par yahi dikhega.
   Format: QB_EN = { c1: { 0: ['English question', ['A','B','C','D']] } }   (0 = us chapter ka pehla question, 1 = doosra ...)
   Jis question ka English yahan nahi hai, wo apni original bhasha me hi dikhega. */
const QB_EN = {};

/* Hindi me exact (apna) anuvaad dena ho to yahan daalein (auto-translate se pehle yahi dikhega):
   QB_HI = { c4: { 0: ['हिंदी प्रश्न', ['विकल्प A', 'विकल्प B', 'विकल्प C', 'विकल्प D']] } }   (0 = us chapter ka pehla question) */
const QB_HI = {};
const isDev = x => /[\u0900-\u097F]/.test(x || '');
Object.keys(QB).forEach(k => QB[k] = QB[k].map((r, i) => {
  if (!Array.isArray(r)) return r;
  const ol = isDev(r[0]) ? 'hi' : 'en', b = { q: { hi: null, en: null }, o: { hi: null, en: null }, a: r[2], ol };
  b.q[ol] = r[0]; b.o[ol] = r[1];
  const h = (QB_HI[k] || {})[i], e = (QB_EN[k] || {})[i];
  if (h) { b.q.hi = h[0]; b.o.hi = h[1]; }
  if (e) { b.q.en = e[0]; b.o.en = e[1]; }
  return b;
}));

/* O Level (HTML/CSS/JS) questions ko engine ke format me badlo. Ye technical English me hi rehte hain,
   kyunki code wale options auto-translate hone par bigad jate hain. */
Object.keys(QB_OX).forEach(k => QB_OX[k] = QB_OX[k].map(r => Array.isArray(r)
  ? { q: { en: r[0], hi: r[0] }, o: { en: r[1], hi: r[1] }, a: r[2], ol: 'en', e: r[3] || '' } : r));

/* ===== Auto translation (Hindi <-> English) : question + options, cache ke saath ===== */
const TRC = store.get('acec_tr2', {}); let _trT = 0;
const saveTR = () => { clearTimeout(_trT); _trT = setTimeout(() => { const k = Object.keys(TRC); if (k.length > 7000) k.slice(0, 2000).forEach(x => delete TRC[x]); store.set('acec_tr2', TRC); }, 1500); };
const needTr = (x, to) => !!x && /\s/.test(x.trim()) && (to === 'hi' ? (!isDev(x) && /[A-Za-z]{3,}/.test(x)) : isDev(x));
async function gtr(x, to) {
  if (!needTr(x, to)) return x;
  const key = to + '|' + x; if (TRC[key]) return TRC[key];
  const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 7000);
  try {
    const r = await fetch('https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&sl=auto&tl=' + to + '&q=' + encodeURIComponent(x), { signal: ctl.signal });
    const j = await r.json(), out = j[0].map(p => p[0]).join('').trim();
    if (!out) return null; TRC[key] = out; saveTR(); return out;
  } catch { return null; } finally { clearTimeout(tm); }
}
const _pend = new WeakMap();
function ensureLang(b, to) {
  const from = b.ol || 'en';
  if (to === from || (b.q[to] && b.o[to])) return Promise.resolve(true);
  const m = _pend.get(b) || {}; _pend.set(b, m);
  return m[to] || (m[to] = (async () => {
    const r = await Promise.all([gtr(b.q[from], to), ...b.o[from].map(x => gtr(x, to))]);
    delete m[to];
    if (r.some(x => x === null)) { (b._fail = b._fail || {})[to] = Date.now(); return false; }
    b.q[to] = r[0]; b.o[to] = r.slice(1); return true;
  })());
}
const qOf = b => b.q[lang] ?? b.q[b.ol || 'en'];
const oOf = b => b.o[lang] ?? b.o[b.ol || 'en'];

/* ===== MS Office + Python Q&A : Hindi chunte hi saare question-answer Hindi me ===== */
/* Kaam kaise karta hai: jo card screen ke paas aata hai, uska question + answer upar wale gtr() se Hindi me
   badal jaata hai (cache ke saath, dobara internet nahi lagta). English chunte hi original wapas.
   Code / short technical answers (jaise "Ctrl + B", ".docx", "print()") jaise ke taise rehte hain. */
var qaS = { io: null, queue: [], busy: 0, touched: new Set(), chip: null, failed: false, hide: 0 };
function qaIsHinglish(x) {
  return /\b(kya|hai|hain|hota|hoti|kisliye|kyu|kaun|konsa|konsi|upyog|karne|karta|karte|ke liye|ka|ki|ko|aur|yeh|bhi)\b/i.test(x) && !/\b(what|which|how|the|is|are|of)\b/i.test(x);
}
function qaChip(msg, keep) {
  if (!qaS.chip) { qaS.chip = document.createElement('div'); qaS.chip.className = 'trchip'; document.body.appendChild(qaS.chip); }
  clearTimeout(qaS.hide);
  if (!msg) { qaS.chip.classList.remove('show'); return; }
  qaS.chip.textContent = msg; qaS.chip.classList.add('show');
  if (!keep) qaS.hide = setTimeout(() => qaS.chip.classList.remove('show'), 3200);
}
function qaTextNodes(card) {
  const out = [];
  card.querySelectorAll('h4, p').forEach(el => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest('code,strong,pre'))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    let n; while ((n = w.nextNode())) out.push(n);
  });
  return out;
}
const QA_SPLIT = /^(\s*(?:Q\d+\.\s*)?(?:\([A-Da-d]\)\s*)?)([\s\S]*?)(\s*)$/;
async function qaCard(card) {
  if (card.__qa || lang !== 'hi') return;
  if (qaIsHinglish(card.textContent)) { card.__qa = 'skip'; return; }
  card.__qa = 'busy'; qaS.touched.add(card);
  let bad = 0;
  const jobs = qaTextNodes(card).map(async n => {
    const o = n.__o !== undefined ? n.__o : n.nodeValue, m = o.match(QA_SPLIT);
    if (!m || !needTr(m[2], 'hi') || qaIsHinglish(m[2])) return;
    const r = await gtr(m[2], 'hi');
    if (r === null) { bad++; return; }
    if (lang !== 'hi') return;
    n.__o = o; n.nodeValue = m[1].replace(/Q(\d+)\./, 'प्र.$1') + r + m[3];
  });
  await Promise.all(jobs);
  if (lang !== 'hi') { card.__qa = null; return; }
  card.querySelectorAll('p strong').forEach(s => { if (s.textContent.trim() === 'Answer:') { s.__o = 'Answer:'; s.textContent = 'उत्तर:'; } });
  card.querySelectorAll('h4').forEach(h => { const f = h.firstChild; if (f && f.nodeType === 3 && f.__o === undefined && /^\s*Q\d+\./.test(f.nodeValue)) { f.__o = f.nodeValue; f.nodeValue = f.nodeValue.replace(/Q(\d+)\./, 'प्र.$1'); } });
  if (bad) { card.__qa = null; if (!qaS.failed) { qaS.failed = true; qaChip('⚠ अनुवाद नहीं हो पाया, इंटरनेट जाँचें (English दिख रहा है)'); setTimeout(() => qaS.failed = false, 20000); } }
  else card.__qa = 'hi';
}
function qaPump() {
  while (qaS.busy < 4 && qaS.queue.length) {
    const c = qaS.queue.shift(); qaS.busy++;
    qaCard(c).finally(() => { qaS.busy--; if (!qaS.queue.length && !qaS.busy) { if (lang === 'hi' && !qaS.failed) qaChip('✅ Q&A हिन्दी में तैयार'); } else qaPump(); });
  }
}
function qaApplyLang() {
  if (!qaS.io) {
    qaS.io = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; qaS.io.unobserve(e.target);
      if (lang === 'hi' && !e.target.__qa) { if (!qaS.queue.length && !qaS.busy) qaChip('🌐 Q&A हिन्दी में बदले जा रहे हैं…', true); qaS.queue.push(e.target); qaPump(); }
    }), { rootMargin: '700px 0px' });
  }
  const cards = document.querySelectorAll('.mso-qa-list .qa-card');
  if (lang === 'hi') {
    cards.forEach(c => { if (!c.__qa) qaS.io.observe(c); });
  } else {
    qaS.queue.length = 0; qaChip('');
    cards.forEach(c => qaS.io.unobserve(c));
    qaS.touched.forEach(c => {
      qaTextNodes(c).forEach(n => { if (n.__o !== undefined) { n.nodeValue = n.__o; n.__o = undefined; } });
      c.querySelectorAll('strong').forEach(s => { if (s.__o) { s.textContent = s.__o; s.__o = undefined; } });
      c.querySelectorAll('h4').forEach(h => { const f = h.firstChild; if (f && f.nodeType === 3 && f.__o !== undefined) { f.nodeValue = f.__o; f.__o = undefined; } });
      c.__qa = null;
    });
    qaS.touched.clear();
  }
}


/* Ek hi sahi-option number (index) 3 baar lagatar na aaye: test ka order is rule se set hota hai */
const runsOf = (a, bank) => { let n = 0; for (let i = 2; i < a.length; i++) if (bank[a[i]].a === bank[a[i - 1]].a && bank[a[i]].a === bank[a[i - 2]].a) n++; return n; };
function fixRuns(order, bank) {
  const a = order.slice(); let r = runsOf(a, bank);
  for (let it = 0; it < 500 && r; it++) {
    let i = 2; for (; i < a.length; i++) if (bank[a[i]].a === bank[a[i - 1]].a && bank[a[i]].a === bank[a[i - 2]].a) break;
    let ok = false;
    for (let k = 0; k < 40 && !ok; k++) {
      const j = Math.random() * a.length | 0; if (j === i || bank[a[j]].a === bank[a[i]].a) continue;
      [a[i], a[j]] = [a[j], a[i]]; const r2 = runsOf(a, bank);
      if (r2 < r) { r = r2; ok = true; } else [a[i], a[j]] = [a[j], a[i]];
    }
    if (!ok) break;
  }
  return a;
}

/* Saturday test: sab chapters ke questions me se random 25. Sirf apna alag set chahiye to SAT_CUSTOM me Q(...) daalo. */
const SAT_CUSTOM = [];
const ALLQ = Object.keys(QB).flatMap(k => QB[k]);
const getBank = k => k === 'SAT' ? (SAT_CUSTOM.length ? SAT_CUSTOM : ALLQ) : (QB[k] || QB_OX[k] || []);

/* ===== Static cards ===== */
$('#courseGrid').innerHTML = COURSES.map(c => `<div class="card"><div class="ic">${c[0]}</div><h3>${c[1]}</h3><p>${c[2]}</p><a class="btn sm" href="#contact">Enquire Now</a></div>`).join('');
$('#dailyList').innerHTML = DAILY.map((d, i) => `<details><summary>Q${i + 1}. ${d[0].replace(/</g, '&lt;')}</summary><p>Answer: ${d[1].replace(/</g, '&lt;')}</p></details>`).join('');

/* ===== Saved progress (Resume) ===== */
const prog = () => store.get('acec_prog', {});
function setProg(P) { store.set('acec_prog', P); paintResume(); renderTests(); }
function paintResume() {
  const P = prog(), ks = Object.keys(P), b = $('#resumeBtn');
  b.hidden = !ks.length;
  if (ks.length) b.dataset.k = ks.sort((a, c) => P[c].ts - P[a].ts)[0];
}
function renderTests() {
  const P = prog(), B = store.get('acec_best', {}), bb = k => B[k] ? `<div class="bbadge">🏅 ${t('x_best')}: ${B[k].s}/${B[k].n}</div>` : '';
  const mk = list => list.map((c, i) => {
    const n = getBank(c[0]).length, s = P[c[0]];
    return `<div class="card test"><span class="chip">${t('chap')} ${i + 1}</span><h3>${ttl(c)}</h3><div class="count">${n ? t('nq', { n }) : t('soonS')}</div>${s ? `<div class="rbadge">${t('saved', { i: s.i, n: s.order.length })}</div>` : ''}${bb(c[0])}<button class="btn sm" data-test="${c[0]}">${t('start')}</button></div>`;
  }).join('');
  $('#cccGrid').innerHTML = mk(CCC); $('#olGrid').innerHTML = mk(OL);
  if (typeof renderOLX === 'function') renderOLX();
}

/* ===== Login ===== */
let user = store.get('acec_user', null);
function paintUser() { $('#loginBtn').textContent = user ? '👤 ' + user.name.split(' ')[0] : t('login');  if (window.acPaint) window.acPaint(); }
$('#loginBtn').onclick = () => {
  if (user) { if (confirm('Logout karna chahte hain?')) { user = null; localStorage.removeItem('acec_user'); paintUser(); toast('Logout ho gaye'); } }
  else openModal('loginModal');
};
// Naya Login/Sign Up card (#nmCard) safal hone par yahi chalta hai: user save, header button, welcome + XP
window.acNmFinish = u => {
  user = u; store.set('acec_user', user); paintUser(); closeModal('loginModal');
  if (window.acLoginFX) window.acLoginFX(user); else toast('Welcome, ' + u.name + '!');
};

/* ===== Popup dialog (Yes/Cancel, Resume/Starting) ===== */
let dlgRes = null;
function ask(title, text, btns) {
  return new Promise(res => {
    $('#dTitle').textContent = title; $('#dText').textContent = text;
    const box = $('#dBtns'); box.innerHTML = '';
    dlgRes = v => { dlgRes = null; closeModal('dlg'); res(v); };
    btns.forEach((b, i) => { const e = document.createElement('button'); e.className = 'btn sm ' + (b.c || ''); e.textContent = b.t; e.onclick = () => dlgRes(i); box.append(e); });
    openModal('dlg');
  });
}

/* ===== Test engine ===== */
let T = null, timer = null, testOpen = false, skipPop = false;
async function openTest(key) {
  const bank = getBank(key);
  if (!bank.length) return toast(t('soon'));
  if (key === 'SAT' && !user) { toast(t('loginFirst')); return openModal('loginModal'); }
  const sv = prog()[key];
  if (sv && sv.order.length && sv.order.every(i => bank[i]) && sv.i <= sv.order.length) {
    const c = await ask(t('resumeT'), t('resumeQ', { i: sv.i, n: sv.order.length }), [{ t: t('resume') }, { t: t('restart'), c: 'ghost' }]);
    if (c === -1) return;
    if (c === 0) return begin(key, sv);
    const P = prog(); delete P[key]; setProg(P);
  }
  begin(key, null);
}
function begin(key, sv, only) {
  const bank = getBank(key);
  let order = sv ? sv.order : only ? shuffle(only) : shuffle(bank.map((_, i) => i)).slice(0, key === 'SAT' ? 25 : bank.length);
  if (!sv) order = fixRuns(order, bank);
  T = { key, order, i: sv ? sv.i : 0, score: sv ? sv.score : 0, sec: sv ? sv.sec : order.length * 45, sel: null, finished: false, wrong: (sv && sv.wrong) || [], retry: !!only };
  openModal('testModal'); testOpen = true; history.pushState({ test: 1 }, '');
  clearInterval(timer); timer = setInterval(() => { T.sec--; paintTimer(); if (T.sec <= 0) finish(); }, 1000);
  paintTitle(); paintTimer();
  T.i >= order.length ? finish() : showQ();
}
function paintTitle() { $('#tTitle').textContent = T.key === 'SAT' ? t('sat') : ttl([...CCC, ...OL, ...OLX].find(c => c[0] === T.key)); }
function paintTimer() { const s = Math.max(T.sec, 0); $('#tTimer').textContent = '⏱ ' + Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
function showQ() {
  const b = getBank(T.key)[T.order[T.i]], body = $('#tBody'); body.innerHTML = '';
  $('#tCount').textContent = t('qOf', { i: T.i + 1, n: T.order.length });
  $('#tBar').style.width = (T.i / T.order.length * 100) + '%';
  const h = document.createElement('div'); h.className = 'q'; h.textContent = qOf(b); body.append(h);
  const need = !b.q[lang] && (b.ol || 'en') !== lang;
  if (need) {
    const failed = b._fail && b._fail[lang] && Date.now() - b._fail[lang] < 20000;
    const nt = document.createElement('div'); nt.className = 'trnote'; nt.textContent = failed ? t('x_trFail') : t('x_trIng'); h.after(nt);
    if (!failed) { const ti = T.i; ensureLang(b, lang).then(() => { if (T && !T.finished && T.i === ti && getBank(T.key)[T.order[T.i]] === b) showQ(); }); }
  }
  oOf(b).forEach((o, idx) => {
    const el = document.createElement('button'); el.className = 'opt';
    const n = document.createElement('span'); n.className = 'on'; n.textContent = 'ABCD'[idx] || (idx + 1);
    const tx = document.createElement('span'); tx.textContent = o; el.append(n, tx);
    if (T.sel !== null) { el.disabled = true; if (idx === b.a) el.classList.add('ok'); else if (idx === T.sel) el.classList.add('bad'); }
    el.onclick = () => pick(idx, b); body.append(el);
  });
  if (T.sel !== null) {
    if (b.e) { const ex = document.createElement('div'); ex.className = 'olx-expl'; ex.textContent = '💡 ' + b.e; body.append(ex); }
    const n = document.createElement('button'); n.className = 'btn sm'; n.style.marginTop = '8px';
    n.textContent = T.i + 1 < T.order.length ? t('next') : t('result');
    n.onclick = () => { T.i++; T.sel = null; T.i < T.order.length ? showQ() : finish(); };
    body.append(n);
  }
  [1, 2].forEach(d => { const nb = getBank(T.key)[T.order[T.i + d]]; if (nb && (nb.ol || 'en') !== lang && !nb.q[lang]) ensureLang(nb, lang); });
}
function pick(idx, b) { if (T.sel !== null) return; T.sel = idx; if (idx === b.a) T.score++; else T.wrong.push([T.order[T.i], idx]); saveP(T.i + 1); showQ(); }
function saveP(next) { const P = prog(); P[T.key] = { order: T.order, i: next, score: T.score, sec: T.sec, ts: Date.now(), wrong: T.wrong }; setProg(P); }
function saveOnExit() { if (!T || T.finished) return; const next = T.sel !== null ? T.i + 1 : T.i; if (next > 0) saveP(next); }
function finish() {
  clearInterval(timer); T.finished = true;
  const n = T.order.length, pct = Math.round(T.score / n * 100);
  const msg = pct >= 80 ? t('m1') : pct >= 50 ? t('m2') : t('m3');
  $('#tBar').style.width = '100%'; $('#tCount').textContent = t('done');
  $('#tBody').innerHTML = `<div class="result"><div class="big grad">${T.score} / ${n}</div><p>${t('sc', { p: pct })} ${msg}</p>
    <div class="racts"><button class="btn sm ghost" id="rvBtn">📋 ${t('x_rev')} (${T.wrong.length})</button>${T.wrong.length ? `<button class="btn sm ghost" id="rtBtn">🔁 ${t('x_retryW')}</button>` : ''}<button class="btn sm ghost" id="cdBtn">🖼️ ${t('x_card')}</button><button class="btn sm wa" id="waBtn">${t('x_share')}</button></div>
    <div class="review" id="rvBox" hidden></div><button class="btn" id="again">${t('back')}</button></div>`;
  $('#again').onclick = closeTest;
  $('#rvBtn').onclick = () => { const bx = $('#rvBox'); bx.hidden = !bx.hidden; if (!bx.hidden) paintReview(); };
  if ($('#rtBtn')) $('#rtBtn').onclick = () => { const key = T.key, only = T.wrong.map(w => w[0]); closeTest(); setTimeout(() => begin(key, null, only), 300); };
  $('#cdBtn').onclick = () => resultCard();
  $('#waBtn').onclick = () => {
    const ch = T.key === 'SAT' ? t('sat') : ttl([...CCC, ...OL, ...OLX].find(c => c[0] === T.key));
    const txt = `🎓 ${(user && user.name) || 'Student'} - ${ch}: ${T.score}/${n} (${pct}%)\nACCESS COMPUTER EDUCATION CENTRE\n${location.href.split('#')[0]}`;
    window.open('https://wa.me/?text=' + encodeURIComponent(txt), '_blank');
  };
  const P = prog(); delete P[T.key]; setProg(P);
  if (!T.retry) {
    const B = store.get('acec_best', {}); if (!B[T.key] || pct > B[T.key].p) { B[T.key] = { s: T.score, n, p: pct }; store.set('acec_best', B); renderTests(); }
    if (T.key === 'SAT') saveScore(T.score);
  }
  if (pct >= 80) { confetti(); if (window.acFunResult) window.acFunResult(pct); }
}
async function paintReview() {
  const box = $('#rvBox'), bank = getBank(T.key);
  if (!T.wrong.length) { box.textContent = t('x_noWrong'); return; }
  box.textContent = t('x_trIng');
  const items = T.wrong.map(([bi, sel]) => ({ b: bank[bi], sel }));
  if (items.some(x => (x.b.ol || 'en') !== lang && !x.b.q[lang])) await Promise.all(items.map(x => ensureLang(x.b, lang)));
  box.innerHTML = '';
  items.forEach((x, k) => {
    const d = document.createElement('div'), o = oOf(x.b); d.className = 'rv';
    const q = document.createElement('div'); q.className = 'rq'; q.textContent = (k + 1) + '. ' + qOf(x.b);
    const y = document.createElement('div'); y.className = 'ry'; y.textContent = '✗ ' + t('x_yourA') + ': ' + o[x.sel];
    const r = document.createElement('div'); r.className = 'rr'; r.textContent = '✓ ' + t('x_rightA') + ': ' + o[x.b.a];
    d.append(q, y, r);
    if (x.b.e) { const ex = document.createElement('div'); ex.className = 'olx-rexp'; ex.textContent = '💡 ' + x.b.e; d.append(ex); }
    box.append(d);
  });
}
function confetti() {
  const cols = ['#ff9f1c', '#ff5f6d', '#8b5cf6', '#2ec4b6', '#fbbf24'], box = document.createElement('div'); box.className = 'confetti';
  for (let i = 0; i < 70; i++) { const p = document.createElement('i'); p.style.cssText = `left:${Math.random() * 100}%;background:${cols[i % 5]};animation-delay:${Math.random() * .8}s;animation-duration:${2 + Math.random() * 1.8}s`; box.append(p); }
  document.body.append(box); setTimeout(() => box.remove(), 4300);
}
async function resultCard() {
  try { await document.fonts.ready; } catch {}
  const n = T.order.length, pct = Math.round(T.score / n * 100), W = 1080, H = 1080, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0a0f1f'); g.addColorStop(.6, '#2a1a5e'); g.addColorStop(1, '#ff5f6d'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 6; x.strokeRect(40, 40, W - 80, H - 80);
  x.textAlign = 'center';
  const F = (w, z) => { x.font = w + ' ' + z + 'px Poppins,"Noto Sans Devanagari",sans-serif'; };
  const fit = (txt, w, z, wt) => { do { F(wt, z); z -= 2; } while (x.measureText(txt).width > w && z > 18); };
  const ch = T.key === 'SAT' ? t('sat') : ttl([...CCC, ...OL, ...OLX].find(q => q[0] === T.key));
  x.fillStyle = '#fff'; fit('ACCESS COMPUTER EDUCATION CENTRE', W - 160, 46, 700); x.fillText('ACCESS COMPUTER EDUCATION CENTRE', W / 2, 150);
  x.fillStyle = '#ffb347'; F(600, 34); x.fillText(lang === 'hi' ? 'रिज़ल्ट कार्ड' : 'RESULT CARD', W / 2, 212);
  x.fillStyle = '#fff'; fit((user && user.name) || 'Student', W - 200, 64, 700); x.fillText((user && user.name) || 'Student', W / 2, 360);
  x.fillStyle = '#c9d2ff'; fit(ch, W - 200, 38, 500); x.fillText(ch, W / 2, 425);
  x.fillStyle = '#fff'; F(800, 230); x.fillText(T.score + '/' + n, W / 2, 690);
  x.fillStyle = '#2ec4b6'; F(700, 80); x.fillText(pct + '%', W / 2, 790);
  x.fillStyle = 'rgba(255,255,255,.15)'; x.fillRect(180, 830, W - 360, 22); x.fillStyle = '#ff9f1c'; x.fillRect(180, 830, (W - 360) * pct / 100, 22);
  x.fillStyle = '#fff'; F(500, 30); x.fillText(new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }), W / 2, 920);
  x.fillStyle = '#c9d2ff'; F(500, 26); x.fillText('Bachhrawan, Raebareli  |  6393512412', W / 2, 985);
  c.toBlob(async blob => {
    const file = new File([blob], 'result-card.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Result' }); return; } } catch { return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'result-card.png'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast('✅ Result card download ho gaya');
  });
}
function closeTest() {
  clearInterval(timer); closeModal('testModal'); testOpen = false;
  if (history.state && history.state.test) { skipPop = true; history.back(); }
}
async function tryExit() {
  if (!testOpen || dlgRes) return;
  if (T && T.finished) return closeTest();
  const c = await ask(t('exitT'), t('exitQ'), [{ t: t('cancel'), c: 'ghost' }, { t: t('yes'), c: 'danger' }]);
  if (c === 1) { saveOnExit(); closeTest(); }
}

/* ===== Saturday leaderboard ===== */
function saveScore(score) {
  const lb = store.get('acec_lb', []), i = lb.findIndex(x => x.mob === user.mob);
  if (i >= 0) { if (score > lb[i].score) lb[i].score = score; } else lb.push({ name: user.name, mob: user.mob, score });
  store.set('acec_lb', lb); paintLB();
}
function paintLB() {
  const lb = store.get('acec_lb', []).sort((a, b) => b.score - a.score).slice(0, 10), body = $('#lbBody');
  body.innerHTML = '';
  if (!lb.length) { body.innerHTML = `<tr><td colspan="3" class="empty">${t('empty')}</td></tr>`; return; }
  lb.forEach((r, i) => {
    const tr = document.createElement('tr'), c = [(i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1), r.name, r.score];
    c.forEach(v => { const td = document.createElement('td'); td.textContent = v; tr.append(td); }); body.append(tr);
  });
}

/* ===== Search ===== */
function jump(id) { const e = $('#' + id); if (e) e.scrollIntoView({ behavior: 'smooth' }); }
let _qi = [], _ql = null;
function buildIdx() {
  const items = [], chTitle = k => { const c = [...CCC, ...OL, ...OLX].find(x => x[0] === k); return c ? ttl(c) : ''; };
  [...CCC, ...OL, ...OLX].forEach(c => items.push({ k: 'tTest', ic: '📝', t: ttl(c), h: (c[1] + ' ' + (CH_HI[c[0]] || '') + ' test ccc o level olevel').toLowerCase(), go: () => openTest(c[0]) }));
  items.push({ k: 'tTest', ic: '🏆', t: t('sat'), h: 'saturday test weekly mock शनिवार टेस्ट', go: () => openTest('SAT') });
  COURSES.forEach(c => items.push({ k: 'tCourse', ic: c[0], t: c[1], sub: c[2], h: (c[1] + ' ' + c[2] + ' course').toLowerCase(), go: () => jump('courses') }));
  [['faculty', '👨‍🏫', 'faculty teacher mentor sir madam फैकल्टी शिक्षक', 'faculty'], ['typing', '⌨️', 'typing game speed टाइपिंग गेम', 'typing'], ['saturday', '🥇', 'leaderboard rank topper लीडरबोर्ड', 'lb'], ['gallery', '🖼️', 'gallery photos library फोटो गैलरी', 'gallery'], ['contact', '📞', 'contact phone whatsapp address संपर्क फोन', 'contact'], ['olcode', '💻', 'o level m2-r5 coding html css javascript कोडिंग', 'olcode'], ['codepractice', '⌨️', 'coding practice vs code editor html css javascript playground कोडिंग प्रैक्टिस', 'codepr']]
    .forEach(s => items.push({ k: 'tSec', ic: s[1], t: t(s[3]), h: s[2], go: () => jump(s[0]) }));
  if (_ql !== lang) { _ql = lang; _qi = []; Object.keys(QB).forEach(k => QB[k].forEach(q => _qi.push({ k: 'tQ', ic: '❓', t: qOf(q), sub: chTitle(k), h: ((q.q.en || '') + ' ' + (q.q.hi || '')).toLowerCase(), go: () => openTest(k) }))); }
  items.push(..._qi);
  return items;
}
function renderRes(q) {
  const box = $('#sRes'); box.innerHTML = ''; q = (q || '').trim().toLowerCase();
  const all = buildIdx(); let list;
  if (!q) { const d = document.createElement('div'); d.className = 'sh'; d.textContent = t('sugg'); box.append(d); list = all.filter(x => x.k === 'tTest').slice(0, 6); }
  else { const tk = q.split(/\s+/); let qc = 0; list = all.filter(x => tk.every(w => x.h.includes(w)) && (x.k !== 'tQ' || ++qc <= 5)).slice(0, 12); }
  if (!list.length) { box.innerHTML = `<div class="sno">${t('noRes')}</div>`; return; }
  list.forEach((x, n) => {
    const b = document.createElement('button'); b.className = 'sit' + (n ? '' : ' f');
    b.innerHTML = '<i></i><span><b></b><small></small></span><em></em>';
    b.querySelector('i').textContent = x.ic; b.querySelector('b').textContent = x.t; b.querySelector('small').textContent = x.sub || ''; b.querySelector('em').textContent = t(x.k);
    b.onclick = () => { closeModal('searchModal'); x.go(); }; box.append(b);
  });
}
function openSearch() { openModal('searchModal'); $('#sInp').value = ''; renderRes(''); setTimeout(() => $('#sInp').focus(), 60); }

/* ===== Apply language everywhere ===== */
function applyLang() {
  document.documentElement.lang = lang === 'hi' ? 'hi' : 'en';
  $$('[data-i18n]').forEach(e => e.textContent = t(e.dataset.i18n));
  $$('[data-i18n-ph]').forEach(e => e.placeholder = t(e.dataset.i18nPh));
  $$('[data-hi]').forEach(e => e.textContent = lang === 'hi' ? e.dataset.hi : e.dataset.en);
  $$('.btn-lang').forEach(b => b.classList.toggle('on', b.dataset.l === lang));
  $('#langLbl').textContent = lang === 'hi' ? 'हिं' : 'EN';
  $('#tLangL').textContent = lang === 'hi' ? 'English' : 'हिन्दी';
  $$('#langMenu button').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  renderTests(); paintUser(); paintResume(); paintLB();
  if (testOpen && T) { paintTitle(); if (!T.finished) showQ(); }
  if ($('#searchModal').classList.contains('open')) renderRes($('#sInp').value);
  qaApplyLang();
  gtSync();
}

/* ===== Typing game ===== */
const WORDS = ['computer', 'keyboard', 'internet', 'python', 'html', 'memory', 'monitor', 'windows', 'network', 'browser', 'storage', 'cursor', 'program', 'shortcut', 'database', 'router', 'server', 'mouse'];
let G = null;
function gameStart() {
  endGame(true);
  G = { score: 0, lives: 3, words: [], speed: 1.2 };
  $('#gOverlay').classList.add('hide'); $('#gInput').disabled = false; $('#gInput').value = ''; $('#gInput').focus();
  paintHud();
  G.spawn = setInterval(spawn, 1700);
  G.tick = setInterval(tick, 40);
}
function paintHud() { $('#gScore').textContent = G.score; $('#gLives').textContent = '❤'.repeat(Math.max(G.lives, 0)) || '💔'; }
function spawn() {
  const el = document.createElement('div'); el.className = 'fw'; el.textContent = WORDS[Math.random() * WORDS.length | 0];
  $('#arena').append(el);
  el.style.left = Math.random() * (($('#arena').clientWidth) - el.offsetWidth - 10) + 'px';
  G.words.push({ el, y: -30, w: el.textContent });
}
function tick() {
  const h = $('#arena').clientHeight;
  G.words.slice().forEach(o => {
    o.y += G.speed; o.el.style.top = o.y + 'px';
    if (o.y > h - 30) { o.el.remove(); G.words.splice(G.words.indexOf(o), 1); G.lives--; paintHud(); if (G.lives <= 0) endGame(); }
  });
}
function endGame(silent) {
  if (!G) return;
  clearInterval(G.spawn); clearInterval(G.tick); G.words.forEach(o => o.el.remove());
  $('#gInput').disabled = true;
  if (!silent) {
    const o = $('#gOverlay'); o.classList.remove('hide');
    o.querySelector('h3').textContent = 'Game Over! Score: ' + G.score; o.querySelector('p').textContent = 'Phir se khelkar score badhayein.';
    $('#gStart').textContent = 'Play Again';
  }
  G = silent ? null : G;
}
$('#gStart').onclick = gameStart;
$('#gInput').oninput = e => {
  if (!G) return;
  const v = e.target.value.trim().toLowerCase(), hit = G.words.find(o => o.w === v);
  if (hit) { hit.el.remove(); G.words.splice(G.words.indexOf(hit), 1); G.score++; if (G.score % 5 === 0) G.speed += .25; e.target.value = ''; paintHud(); }
};

/* ===== TYPING TAB: 4 naye game (Snake, Subway Run, Hill Climb, Hindi Race) + purana Word Fire = total 5 =====
   Rules (sab naye games me): ek bhi galat key = turant Game Over | words repeat nahi hote |
   beech me chhodne (scroll/tab change) par game pause hota hai aur "Resume" milta hai */
(() => {
  const el = id => document.getElementById(id);
  const tabs = el('tgTabs'), orig = document.querySelector('#typing .game:not(.tgx)'), box = el('tgx');
  if (!tabs || !orig || !box) return;
  const cv = el('tgCv'), cx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const inp = el('tgInp'), ov = el('tgOv'), ovT = ov.querySelector('h3'), ovP = ov.querySelector('p'), ovB = el('tgGo');
  const hS = el('tgScore'), hB = el('tgBest'), hI = el('tgInfo'), hint = el('tgHint');
  const FONT = "'Poppins','Noto Sans Devanagari',sans-serif";

  const ENG = [...new Set(('computer keyboard internet python memory monitor windows network browser storage cursor program shortcut database router server mouse printer scanner laptop desktop tablet mobile android ' +
    'software hardware firmware kernel compiler variable function loop array string integer boolean object class method module package library framework website webpage domain hosting cloud backup restore update upgrade ' +
    'install uninstall download upload folder directory file document sheet slide table column row cell formula chart graph image video audio speaker headphone camera battery charger cable socket switch hub modem wifi ethernet ' +
    'bluetooth hotspot password username email inbox outbox attach forward reply delete recycle select copy paste cut undo redo bold italic underline font style margin border header footer paragraph page layout print preview ' +
    'zoom scroll button icon menu toolbar ribbon dialog window taskbar wallpaper screensaver antivirus firewall malware phishing hacker encrypt decrypt binary decimal hexadecimal byte kilobyte megabyte gigabyte terabyte ' +
    'processor cache register pixel resolution display graphics sound virus search engine google login logout signup profile account digital online offline').split(/\s+/).filter(Boolean))];

  const HI = [['भारत', 'bharat'], ['देश', 'desh'], ['विद्यालय', 'vidyalaya'], ['शिक्षा', 'shiksha'], ['परीक्षा', 'pariksha'], ['परिणाम', 'parinaam'], ['प्रश्न', 'prashn'], ['उत्तर', 'uttar'], ['पुस्तक', 'pustak'], ['कलम', 'kalam'],
    ['कागज', 'kaagaz'], ['विद्यार्थी', 'vidyarthi'], ['शिक्षक', 'shikshak'], ['कक्षा', 'kaksha'], ['ज्ञान', 'gyaan'], ['समय', 'samay'], ['मेहनत', 'mehnat'], ['सफलता', 'safalta'], ['अभ्यास', 'abhyaas'], ['सीखना', 'seekhna'],
    ['लिखना', 'likhna'], ['पढ़ना', 'padhna'], ['बोलना', 'bolna'], ['सुंदर', 'sundar'], ['तेज', 'tez'], ['धीरे', 'dheere'], ['आसान', 'aasaan'], ['कठिन', 'kathin'], ['नया', 'naya'], ['पुराना', 'puraana'],
    ['घर', 'ghar'], ['गाँव', 'gaanv'], ['शहर', 'shahar'], ['सड़क', 'sadak'], ['गाड़ी', 'gaadi'], ['रेल', 'rail'], ['पानी', 'paani'], ['भोजन', 'bhojan'], ['फल', 'phal'], ['सब्जी', 'sabzi'],
    ['दूध', 'doodh'], ['रोटी', 'roti'], ['चावल', 'chaawal'], ['मिठाई', 'mithai'], ['दीपक', 'deepak'], ['दीपावली', 'deepawali'], ['पटाखे', 'pataakhe'], ['रोशनी', 'roshni'], ['खुशी', 'khushi'], ['परिवार', 'parivar'],
    ['मित्र', 'mitra'], ['माता', 'maata'], ['पिता', 'pita'], ['भाई', 'bhai'], ['बहन', 'behen'], ['नमस्ते', 'namaste'], ['धन्यवाद', 'dhanyavaad'], ['स्वागत', 'swagat'], ['प्रणाम', 'pranaam'], ['आकाश', 'aakaash'],
    ['सूरज', 'sooraj'], ['चाँद', 'chaand'], ['सितारा', 'sitaara'], ['नदी', 'nadi'], ['पहाड़', 'pahaad'], ['जंगल', 'jungle'], ['फूल', 'phool'], ['कंप्यूटर', 'computer'], ['इंटरनेट', 'internet'], ['माउस', 'mouse']]
    .map(([h, r]) => [h.normalize('NFC'), r]);
  const ROM = {}; HI.forEach(([h, r]) => ROM[h] = r);

  const META = {
    1: ['🐍 Snake Typing', 'Har sahi letter par snake ek kadam chalta hai. Word poora type karo to snake seb kha leta hai. Time khatam ya ek bhi galat key = Game Over!'],
    2: ['🚇 Subway Typing Run', 'Rukawat aate hi uska word type karo — runner kood kar nikal jayega. Takkar ya ek bhi galat key = Game Over!'],
    3: ['🏔️ Hill Climb Typing', 'Har letter par gadi ko boost milta hai, word poora hote hi petrol bharta hai. Petrol khatam ya galat key = Game Over!'],
    4: ['🇮🇳 Hindi Typing Race', 'Hindi keyboard on karein (Windows: Win + Space, Mobile: Hindi keyboard). 25 words bina galti type karo. Time khatam ya galat akshar = Game Over!']
  };

  let gi = 0, st = 'idle', GM = null, bag = [], target = '', pos = 0, score = 0, last = 0, raf = 0, composing = false;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const bestOf = i => store.get('acec_tg_best' + i, 0);
  const norm = s => { s = (s || '').normalize('NFC').replace(/\s+$/, ''); return gi === 4 ? s : s.toLowerCase(); };
  const makeBag = () => { bag = shuffle(gi === 4 ? HI.map(x => x[0]) : ENG); };           // bag se nikla word dobara nahi aata
  const pick = (mn, mx) => { let k = -1; for (let i = bag.length - 1; i >= 0; i--) if (bag[i].length >= mn && bag[i].length <= mx) { k = i; break; } if (k < 0) k = bag.length - 1; return k < 0 ? null : bag.splice(k, 1)[0]; };
  const rr = (x, y, w, h, r) => { cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); };
  const bg = (a, b) => { const g = cx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, a); g.addColorStop(1, b); cx.fillStyle = g; cx.fillRect(0, 0, W, H); };
  const txt = (t, x, y, size, color, weight) => { cx.font = (weight || 700) + ' ' + size + 'px ' + FONT; cx.fillStyle = color; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(t, x, y); };
  const label = (t, x, y, hot) => { cx.font = '700 14px ' + FONT; const w = cx.measureText(t).width + 16; rr(x - w / 2, y - 12, w, 24, 8); cx.fillStyle = hot ? '#ffb703' : 'rgba(255,255,255,.18)'; cx.fill(); txt(t, x, y + 1, 14, hot ? '#1b0b00' : '#fff'); };

  function setTarget(w) { target = w; pos = 0; inp.value = ''; paintTarget(); }
  function paintTarget() {
    hint.textContent = '';
    if (!target) return;
    const d = document.createElement('span'); d.className = 'd'; d.textContent = target.slice(0, pos);
    hint.append(d, document.createTextNode(target.slice(pos)));
    if (gi === 4 && ROM[target]) { const s = document.createElement('small'); s.textContent = ' (' + ROM[target] + ')'; hint.append(s); }
  }
  function setHud() { hS.textContent = score; hB.textContent = Math.max(bestOf(gi), score); }
  function upInfo() { const s = GM && GM.info ? GM.info() : ''; if (hI.textContent !== s) hI.textContent = s; }
  function showOv(t, p, b) { ovT.textContent = t; ovP.textContent = p; ovB.textContent = b; ov.classList.remove('hide'); }
  function drawIdle() { bg('#10051a', '#2b0f3a'); txt(META[gi][0].split(' ')[0], W / 2, H / 2, 90, '#fff', 400); }
  function draw() { if (GM) GM.draw(); else drawIdle(); }

  /* ---------- Engine ---------- */
  function loop(t) {
    if (st !== 'run') return;
    const dt = Math.min(.05, (t - last) / 1000); last = t;
    GM.update(dt); if (st !== 'run') return;
    GM.draw(); upInfo(); raf = requestAnimationFrame(loop);
  }
  function start() {
    cancelAnimationFrame(raf); score = 0; target = ''; pos = 0; inp.value = ''; makeBag();
    st = 'run'; GM = GAMES[gi](); ov.classList.add('hide'); inp.disabled = false;
    GM.init(); setHud(); inp.focus({ preventScroll: true }); last = performance.now(); raf = requestAnimationFrame(loop);
  }
  function pause(why) { if (st !== 'run') return; st = 'pause'; cancelAnimationFrame(raf); inp.blur(); showOv('⏸️ Game Paused', why || 'Aap beech me chhod kar gaye the', '▶ Resume'); }
  function resume() { if (st !== 'pause') return; st = 'run'; ov.classList.add('hide'); inp.focus({ preventScroll: true }); last = performance.now(); raf = requestAnimationFrame(loop); }
  function over(msg, win) {
    if (st !== 'run') return;
    st = 'over'; cancelAnimationFrame(raf); draw();
    if (score > bestOf(gi)) store.set('acec_tg_best' + gi, score);
    setHud(); inp.disabled = true; inp.blur();
    showOv(win ? '🏆 You Win! Score: ' + score : '💥 Game Over! Score: ' + score, msg, '🔄 Dobara Khelo');
  }
  ovB.onclick = () => (st === 'pause' ? resume() : start());

  /* ---------- Typing check: ek bhi galat key = Game Over ---------- */
  function check() {
    if (st !== 'run' || !target) return;
    const v = norm(inp.value);
    if (!v) { pos = 0; paintTarget(); return; }
    if (v === target) { const w = target; pos = 0; inp.value = ''; target = ''; GM.onDone(w); paintTarget(); return; }
    if (!target.startsWith(v)) { if (composing) return; over('❌ Galat key! "' + v.slice(-1) + '" — sahi word tha: ' + target); return; }
    const n = v.length - pos; pos = v.length; paintTarget();
    if (n > 0 && GM.onKey) GM.onKey(n);
  }
  inp.addEventListener('compositionstart', () => { composing = true; });
  inp.addEventListener('compositionend', () => { composing = false; check(); });
  inp.addEventListener('input', check);

  /* ---------- Games ---------- */
  const GAMES = {
    /* 1) SNAKE: har sahi letter = snake ka ek kadam (BFS se seb ki taraf) */
    1() {
      const C = 32, GW = W / C, GH = H / C;
      let sn = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }], food = { x: 12, y: 5 }, left = 1, lim = 1;
      const key = (x, y) => y * GW + x;
      const path = () => {
        const prev = new Map(), q = [[sn[0].x, sn[0].y]], blocked = new Set(sn.slice(0, -1).map(s => key(s.x, s.y)));
        prev.set(key(sn[0].x, sn[0].y), null);
        while (q.length) {
          const [x, y] = q.shift();
          if (x === food.x && y === food.y) { const out = []; let k = key(x, y); while (prev.get(k) !== null) { out.push([k % GW, (k / GW) | 0]); k = prev.get(k); } return out.reverse(); }
          [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
            const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= GW || ny >= GH) return;
            const k = key(nx, ny); if (blocked.has(k) || prev.has(k)) return; prev.set(k, key(x, y)); q.push([nx, ny]);
          });
        }
        return null;
      };
      const atFood = () => sn[0].x === food.x && sn[0].y === food.y;
      const step = () => {
        if (atFood()) return true;
        const p = path(); if (!p || !p.length) { over('🐍 Snake fas gaya! Aage rasta nahi bacha'); return false; }
        sn.unshift({ x: p[0][0], y: p[0][1] }); sn.pop(); return true;
      };
      const spawn = () => {
        const w = pick(3, 7); if (!w) return over('Saare words khatam — Snake Champion! 🐍', true);
        let c, t = 0;
        do { c = { x: rnd(0, GW) | 0, y: rnd(0, GH) | 0 }; } while ((sn.some(s => s.x === c.x && s.y === c.y) || Math.abs(c.x - sn[0].x) + Math.abs(c.y - sn[0].y) < 4) && ++t < 300);
        food = c; setTarget(w); lim = left = Math.max(2.6, 2 + w.length * .8 - Math.min(1.2, score / 60));
        if (!path()) over('🐍 Snake fas gaya! Aage rasta nahi bacha');
      };
      return {
        init() { sn = [{ x: 5, y: 5 }, { x: 4, y: 5 }, { x: 3, y: 5 }]; spawn(); },
        update(dt) { left -= dt; if (left <= 0) over('⏰ Time khatam! Snake ko seb nahi mila'); },
        onKey(n) { for (let i = 0; i < n; i++) if (!step()) return; },
        onDone(w) {
          let g = 0; while (!atFood() && g++ < 80) if (!step()) return;
          score += w.length; sn.push({ ...sn[sn.length - 1] }); setHud(); spawn();
        },
        info: () => 'Length: ' + sn.length,
        draw() {
          bg('#0f2b1a', '#0b1a12');
          cx.fillStyle = 'rgba(255,255,255,.045)'; for (let x = 0; x < GW; x++) for (let y = 0; y < GH; y++) if ((x + y) % 2) cx.fillRect(x * C, y * C, C, C);
          txt('🍎', food.x * C + C / 2, food.y * C + C / 2 + 2, 26, '#fff', 400);
          const ly = food.y === 0 ? food.y * C + C + 14 : food.y * C - 10; label(target || '', Math.min(W - 50, Math.max(50, food.x * C + C / 2)), ly, true);
          sn.forEach((s, i) => { rr(s.x * C + 2, s.y * C + 2, C - 4, C - 4, 9); cx.fillStyle = i ? 'hsl(' + (140 - Math.min(i, 30) * 2) + ',68%,' + (46 - Math.min(i, 12)) + '%)' : '#9bff4f'; cx.fill(); });
          const h = sn[0]; cx.fillStyle = '#111'; cx.beginPath(); cx.arc(h.x * C + 11, h.y * C + 12, 3, 0, 7); cx.arc(h.x * C + 21, h.y * C + 12, 3, 0, 7); cx.fill();
          cx.fillStyle = '#ffb703'; cx.fillRect(0, 0, W * Math.max(0, left / lim), 5);
        }
      };
    },

    /* 2) SUBWAY RUN: rukawat ka word type karo to runner kood jata hai */
    2() {
      const LY = [140, 205, 270], RX = 120;
      let obs = [], cleared = 0, noMore = false, scroll = 0, jump = 0, ly = LY[1], lane = 1, v = 110;
      const pend = () => obs.filter(o => !o.done);
      const fill = () => {
        while (!noMore && pend().length < 2) {
          const w = pick(4, 8); if (!w) { noMore = true; break; }
          const lx = obs.length ? obs[obs.length - 1].x : W - 60, gapT = Math.max(1.8, 3.2 - cleared * .035) + rnd(0, .5);
          obs.push({ x: Math.max(W + 30, lx + v * gapT), lane: rnd(0, 3) | 0, w, done: false });
        }
      };
      const assign = () => { const c = pend()[0]; if (c && target !== c.w) setTarget(c.w); };
      return {
        init() { fill(); assign(); },
        update(dt) {
          v = Math.min(340, 110 + cleared * 7);
          obs.forEach(o => { o.x -= v * dt; }); obs = obs.filter(o => o.x > -80); scroll += v * dt; if (jump > 0) jump -= dt;
          fill(); assign();
          const c = pend()[0];
          if (c) lane = c.lane;
          ly += (LY[lane] - ly) * Math.min(1, dt * 8);
          if (c && c.x <= RX + 24) over('🚧 Takkar ho gayi! "' + c.w + '" type nahi hua');
        },
        onDone(w) {
          const c = pend()[0]; if (c) c.done = true;
          cleared++; score += w.length; jump = .45; setHud(); fill(); assign();
          if (!pend().length && noMore) over('Saari rukawatein paar — Subway Champion! 🚇', true);
        },
        info: () => 'Speed: ' + Math.round(v) + ' km/h',
        draw() {
          bg('#12122b', '#3b1f4a');
          cx.fillStyle = 'rgba(255,255,255,.07)'; for (let i = 0; i < 9; i++) { const x = ((i * 90 - scroll * .15) % (W + 90) + (W + 90)) % (W + 90) - 40, h = 50 + (i * 37) % 60; cx.fillRect(x, 105 - h, 54, h); }
          LY.forEach(y => {
            cx.fillStyle = '#2a2a3d'; cx.fillRect(0, y + 14, W, 26);
            cx.fillStyle = '#6b6b85'; for (let x = -((scroll) % 36); x < W; x += 36) cx.fillRect(x, y + 17, 5, 20);
            cx.fillStyle = '#c9c9dd'; cx.fillRect(0, y + 20, W, 3); cx.fillRect(0, y + 32, W, 3);
          });
          const cur = pend()[0];
          obs.forEach(o => {
            const y = LY[o.lane] + 6;
            if (o.done) { cx.globalAlpha = .35; txt('🚧', o.x, y, 34, '#fff', 400); cx.globalAlpha = 1; }
            else { txt('🚧', o.x, y, 38, '#fff', 400); label(o.w, o.x, y - 34, o === cur); }
          });
          const jy = jump > 0 ? -Math.sin(Math.PI * (1 - jump / .45)) * 62 : 0;
          cx.save(); cx.translate(RX, ly + 6 + jy); cx.scale(-1, 1); txt('🏃', 0, 0, 40, '#fff', 400); cx.restore();
        }
      };
    },

    /* 3) HILL CLIMB: letter = boost, word = petrol */
    3() {
      let dist = 0, fuel = 100, v = 80;
      const hgt = x => 215 + 38 * Math.sin(x * .011) + 22 * Math.sin(x * .027 + 1.3) + 10 * Math.sin(x * .06);
      const nextW = () => { const w = pick(5, 9); if (!w) return over('Saare words khatam — Hill Climb Champion! 🏔️', true); setTarget(w); };
      return {
        init() { nextW(); },
        update(dt) {
          const sl = (hgt(dist + 12) - hgt(dist - 12)) / 24;
          v += (-(v - 50) * 1.1 + sl * 90) * dt; v = Math.max(25, Math.min(420, v));
          dist += v * dt; fuel -= (7 + Math.min(8, dist / 4000)) * dt;
          if (fuel <= 0) over('⛽ Petrol khatam! Gadi ruk gayi');
        },
        onKey(n) { v = Math.min(420, v + 45 * n); },
        onDone(w) { score += w.length; fuel = Math.min(100, fuel + 22 + w.length); setHud(); nextW(); },
        info: () => 'Distance: ' + ((dist / 25) | 0) + ' m',
        draw() {
          bg('#1b2a4a', '#f2994a');
          cx.fillStyle = 'rgba(255,255,255,.5)'; for (let i = 0; i < 24; i++) cx.fillRect((i * 97) % W, (i * 53) % 110, 2, 2);
          const CX = 150; cx.beginPath(); cx.moveTo(0, H);
          for (let sx = 0; sx <= W; sx += 4) cx.lineTo(sx, hgt(dist - CX + sx));
          cx.lineTo(W, H); cx.closePath(); const g = cx.createLinearGradient(0, 150, 0, H); g.addColorStop(0, '#4a8f3a'); g.addColorStop(.12, '#6b4a2b'); g.addColorStop(1, '#2a1a10'); cx.fillStyle = g; cx.fill();
          for (let wx = Math.ceil((dist - CX) / 500) * 500; wx < dist + W; wx += 500) { const sx = wx - dist + CX, y = hgt(wx); cx.fillStyle = '#fff'; cx.fillRect(sx, y - 34, 2, 34); cx.fillStyle = '#e5383b'; cx.fillRect(sx + 2, y - 34, 16, 9); }
          const y = hgt(dist), a = Math.atan2(hgt(dist + 10) - hgt(dist - 10), 20);
          cx.save(); cx.translate(CX, y); cx.rotate(a);
          rr(-30, -32, 60, 18, 6); cx.fillStyle = '#e5383b'; cx.fill(); rr(-12, -44, 28, 14, 5); cx.fillStyle = '#9ad1ff'; cx.fill();
          [-19, 19].forEach(wx => { cx.beginPath(); cx.arc(wx, -9, 9, 0, 7); cx.fillStyle = '#111'; cx.fill(); cx.save(); cx.translate(wx, -9); cx.rotate(dist / 9); cx.fillStyle = '#ccc'; cx.fillRect(-1.5, -7, 3, 14); cx.fillRect(-7, -1.5, 14, 3); cx.restore(); });
          cx.restore();
          cx.fillStyle = 'rgba(0,0,0,.45)'; rr(10, 10, 190, 20, 8); cx.fill();
          rr(12, 12, 186 * Math.max(0, fuel / 100), 16, 6); cx.fillStyle = fuel > 50 ? '#22c55e' : fuel > 25 ? '#ffb703' : '#ef4444'; cx.fill();
          txt('⛽ ' + Math.max(0, Math.round(fuel)) + '%', 105, 21, 12, '#fff');
        }
      };
    },

    /* 4) HINDI TYPING RACE: 25 Hindi words, har word ki time-limit */
    4() {
      const GOAL = 25; let done = 0, left = 7, lim = 7, rx = 0;
      const nextW = () => { const w = pick(2, 30); if (!w) return over('Saare Hindi words khatam! 🇮🇳', true); setTarget(w); lim = left = Math.max(3.4, 7.5 - done * .16); };
      return {
        init() { nextW(); },
        update(dt) { left -= dt; rx += (done / GOAL * (W - 120) - rx) * Math.min(1, dt * 6); if (left <= 0) over('⏰ Time khatam! Word tha: ' + target); },
        onDone() {
          done++; score++; setHud();
          if (done >= GOAL) { rx = W - 120; over('🎉 25 Hindi words bina galti ke type kiye — shabaash!', true); return; }
          nextW();
        },
        info: () => 'Word ' + Math.min(GOAL, done + 1) + ' / ' + GOAL,
        draw() {
          bg('#10051a', '#2b0f3a');
          cx.fillStyle = 'rgba(255,200,100,.5)'; for (let i = 0; i < 30; i++) cx.fillRect((i * 83) % W, (i * 47) % 150, 2, 2);
          cx.fillStyle = '#2a2a3d'; cx.fillRect(0, 170, W, 56); cx.fillStyle = 'rgba(255,255,255,.35)'; for (let x = 0; x < W; x += 40) cx.fillRect(x, 197, 22, 3);
          txt('🏁', W - 40, 160, 38, '#fff', 400); txt('🚀', 60 + rx, 190, 40, '#fff', 400);
          cx.fillStyle = 'rgba(255,255,255,.15)'; rr(40, 260, W - 80, 14, 7); cx.fill();
          const r = Math.max(0, left / lim); rr(40, 260, (W - 80) * r, 14, 7); cx.fillStyle = r > .5 ? '#22c55e' : r > .25 ? '#ffb703' : '#ef4444'; cx.fill();
          txt('समय', W / 2, 295, 14, '#fff4df');
        }
      };
    }
  };

  /* ---------- Tabs + auto-pause ---------- */
  function select(i) {
    cancelAnimationFrame(raf); if (typeof endGame === 'function') endGame(true);
    gi = i; st = 'idle'; GM = null; target = ''; pos = 0; score = 0;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.g === i));
    orig.style.display = i === 0 ? '' : 'none'; box.hidden = i === 0;
    if (i === 0) return;
    inp.value = ''; inp.disabled = true; inp.lang = i === 4 ? 'hi' : 'en'; hint.textContent = ''; hI.textContent = ''; setHud();
    showOv(META[i][0], META[i][1], '▶ Start Game'); draw();
  }
  tabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) select(+b.dataset.g); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Tab badal liya tha'); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(e => { if (!e.isIntersecting) pause('Aap game se bahar chale gaye the'); }), { threshold: .25 }).observe(box);
})();

/* ===== UI misc ===== */
function dismiss(m) {
  if (m.id === 'dlg') { if (dlgRes) dlgRes(-1); return; }
  if (m.id === 'testModal') { tryExit(); return; }
  m.classList.remove('open');
}
$$('[data-close]').forEach(b => b.onclick = () => dismiss(b.closest('.modal')));
$$('.modal').forEach(m => m.onclick = e => { if (e.target === m) dismiss(m); });
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const o = ['dlg', 'searchModal', 'loginModal', 'testModal'].map(id => $('#' + id)).find(m => m.classList.contains('open'));
    if (o) dismiss(o);
    $('#langMenu').classList.remove('open');
  }
  const typing = /INPUT|TEXTAREA/.test((e.target.tagName || ''));
  if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); openSearch(); }
});

/* Test: back button / refresh / tab close par bhi confirm */
addEventListener('popstate', () => {
  if (skipPop) { skipPop = false; return; }
  if (testOpen) { history.pushState({ test: 1 }, ''); tryExit(); }
});
addEventListener('beforeunload', e => { if (testOpen && T && !T.finished) { saveOnExit(); e.preventDefault(); e.returnValue = ''; } });

/* Buttons */
$('#cccGrid').onclick = $('#olGrid').onclick = e => { const b = e.target.closest('[data-test]'); if (b) openTest(b.dataset.test); };
$('#satBtn').onclick = () => openTest('SAT');
$('#resumeBtn').onclick = () => openTest($('#resumeBtn').dataset.k);
$('#searchBtn').onclick = openSearch;
$('#sInp').oninput = e => renderRes(e.target.value);
$('#sInp').onkeydown = e => { if (e.key === 'Enter') { const f = $('#sRes .sit'); if (f) f.click(); } };

/* Language menu */
$('#langBtn').onclick = e => { e.stopPropagation(); $('#langMenu').classList.toggle('open'); };
$$('#langMenu button').forEach(b => b.onclick = () => { lang = b.dataset.lang; store.set('acec_lang', lang); $('#langMenu').classList.remove('open'); applyLang(); toast(lang === 'hi' ? 'भाषा: हिन्दी' : 'Language: English'); });
document.addEventListener('click', () => $('#langMenu').classList.remove('open'));

$('#tLang').onclick = () => { lang = lang === 'hi' ? 'en' : 'hi'; store.set('acec_lang', lang); applyLang(); };

/* Theme */
let theme = store.get('acec_theme', 'dark');
function setTheme(m) { theme = m; document.documentElement.dataset.theme = m; store.set('acec_theme', m); $$('#themeBtn2').forEach(b => b.textContent = m === 'dark' ? '☀️' : '🌙'); const tsw = $('#themeBtn'); if (tsw) tsw.setAttribute('aria-checked', m === 'light' ? 'true' : 'false'); }
$$('#themeBtn,#themeBtn2').forEach(b => b.onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark'));
setTheme(theme);

/* Menu, year, reveal */
$('#burger').onclick = () => $('#menu').classList.toggle('open');
$$('#menu a').forEach(a => a.onclick = () => $('#menu').classList.remove('open'));
$('#yr').textContent = new Date().getFullYear();
const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .1 });
$$('.reveal').forEach(el => io.observe(el));

applyLang();

/* ===== SLIDER ===== */
/* Photos change/add karne ke liye yahan list badlein (image file same folder me rakhein) */
const SLIDES = [
  { img: 'slide4.jpeg', tag: 'lets,seen Bachhrawan', title: 'Saaf-suthra apna bachhrawan', pos: 'center' },
  { img: 'slide6.jpeg', tag: 'Coaching side ', title: 'Special look', pos: 'center 30%' },
  { img: 'slide1.jpeg', tag: 'Coaching Centre', title: 'welcome to my coaching', pos: 'center' },
  { img: 'slide2.jpeg', tag: 'Library', title: 'Books ka Bada Collection', pos: 'center' },
  { img: 'slide5.jpeg', tag: 'Sigma boy', title: 'Practicle + theory expert teacher', pos: 'center' },
  { img: 'slide3.jpeg', tag: 'Railway station', title: 'Welcome to railway station', pos: 'center side' },
  { img: 'sigma.jpeg', tag: 'My Institute', title: ' Access Computer Education Center', pos: 'center side' },
  { img: 'slide8.jpeg', tag: 'Bachhrawan', title: 'welcome to bachhrawan', pos: 'center side' },
  { img: 'slide9.jpeg', tag: 'Bachhrawan', title: 'Best look in railway station side ', pos: 'center side' }
  
];
(function () {
  const wrap = $('#hSlides'), cap = $('#hCap'), dots = $('#sDots'), prog = $('#sProg'), hero = $('#home');
  let i = 0, t, x0 = null;
  wrap.innerHTML = SLIDES.map(s => `<div class="hs" style="background-image:url('${s.img}');background-position:${s.pos}"></div>`).join('');
  dots.innerHTML = SLIDES.map((_, k) => `<button aria-label="Slide ${k + 1}"></button>`).join('');
  const S = [...wrap.children], D = [...dots.children];
  function restart() {
    clearInterval(t); prog.style.animation = 'none'; void prog.offsetWidth; prog.style.animation = '';
    t = setInterval(() => go(i + 1), 5500);
  }
  function go(n) {
    i = (n + S.length) % S.length;
    S.forEach((s, k) => s.classList.toggle('on', k === i));
    D.forEach((d, k) => d.classList.toggle('on', k === i));
    cap.innerHTML = `<span>${SLIDES[i].tag}</span><b>${SLIDES[i].title}</b>`;
    restart();
  }
  $('#sPrev').onclick = () => go(i - 1);
  $('#sNext').onclick = () => go(i + 1);
  D.forEach((d, k) => d.onclick = () => go(k));
  hero.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive: true });
  hero.addEventListener('touchend', e => { if (x0 === null) return; const d = e.changedTouches[0].clientX - x0; if (Math.abs(d) > 50) go(d < 0 ? i + 1 : i - 1); x0 = null; });
  go(0);
})();

/* ===== Typing text ===== */
(function () {
  const w = ['CCC', 'O-Level', 'ADCA & PGDCA', 'Tally & MS Office', 'Python & Web Design'], el = $('#typed');
  let a = 0, b = 0, del = false;
  (function loop() {
    const s = w[a]; el.textContent = s.slice(0, b);
    if (!del && b === s.length) { del = true; return setTimeout(loop, 1400); }
    if (del && b === 0) { del = false; a = (a + 1) % w.length; }
    b += del ? -1 : 1; setTimeout(loop, del ? 45 : 90);
  })();
})();

/* ===== Neon particles (hero) ===== */
(function () {
  const c = $('#fx'), x = c.getContext('2d'); let W, H, P = [];
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mk = (fresh) => ({ x: Math.random() * W, y: fresh ? Math.random() * H : H + 10, r: .8 + Math.random() * 2.2, vy: .25 + Math.random() * .85, ph: Math.random() * 6.28, sp: .01 + Math.random() * .03, hue: Math.random() < .6 ? 330 + Math.random() * 12 : 48 + Math.random() * 10 });
  function size() {
    W = c.width = c.offsetWidth; H = c.height = c.offsetHeight;
    P = Array.from({ length: W < 700 ? 34 : 70 }, () => mk(true));
  }
  size(); addEventListener('resize', size);
  (function draw() {
    x.clearRect(0, 0, W, H);
    P.forEach((p, i) => {
      if (!calm) { p.y -= p.vy; p.ph += p.sp; p.x += Math.sin(p.ph) * .6; }
      if (p.y < -10) P[i] = mk(false);
      const a = .35 + .65 * Math.abs(Math.sin(p.ph * 1.7));
      x.fillStyle = `hsla(${p.hue},100%,62%,${a * .22})`; x.beginPath(); x.arc(p.x, p.y, p.r * 3.4, 0, 6.283); x.fill();
      x.fillStyle = `hsla(${p.hue + 8},100%,72%,${a})`; x.beginPath(); x.arc(p.x, p.y, p.r, 0, 6.283); x.fill();
    });
    requestAnimationFrame(draw);
  })();
})();

/* ===== Counters, marquee, gallery ===== */
const cio = new IntersectionObserver(es => es.forEach(e => {
  if (!e.isIntersecting) return; cio.unobserve(e.target);
  const el = e.target, n = +el.dataset.n, s = el.dataset.s || ''; let k = 0; const st = n / 60;
  (function f() { k = Math.min(k + st, n); el.textContent = Math.floor(k) + s; if (k < n) requestAnimationFrame(f); })();
}), { threshold: .6 });
$$('[data-n]').forEach(e => cio.observe(e));

$('#mq').innerHTML = [...COURSES, ...COURSES].map(c => `<span>${c[1]}</span>`).join('');

$('#gal').innerHTML = SLIDES.map((s, k) => `<figure data-k="${k}"><img src="${s.img}" alt="${s.title}" loading="lazy" style="object-position:${s.pos}"><figcaption>${s.title}</figcaption></figure>`).join('');
$$('#gal figure').forEach(f => f.onclick = () => { $('#lbImg').src = SLIDES[f.dataset.k].img; $('#lb').classList.add('open'); });
$('#lb').onclick = () => $('#lb').classList.remove('open');
document.addEventListener('keydown', e => { if (e.key === 'Escape') $('#lb').classList.remove('open'); });

/* ===== Scroll progress, top button, preloader, 3D tilt ===== */
addEventListener('scroll', () => {
  const h = document.documentElement;
  $('#sp').style.width = (h.scrollTop / (h.scrollHeight - h.clientHeight) * 100) + '%';
  $('#toTop').classList.toggle('show', h.scrollTop > 600);
}, { passive: true });
$('#toTop').onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
/* instant start: preloader hides immediately */
(() => { const p = $('#pre'); if (p) p.classList.add('hide'); })();


/* ===== 3D tilt on cards (re-render ke baad bhi chalta hai) ===== */
if (matchMedia('(hover:hover)').matches) {
  let tc = null;
  document.addEventListener('mousemove', e => {
    const c = e.target.closest ? e.target.closest('.card') : null;
    if (tc && tc !== c) { tc.style.transition = ''; tc.style.transform = ''; }
    tc = c; if (!c) return;
    const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    c.style.transition = 'transform .1s'; c.style.transform = `perspective(700px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateY(-6px)`;
  });// ===== Student Review & Bad Word Filter System =====
document.addEventListener('DOMContentLoaded', () => {
    const reviewForm = document.getElementById('reviewForm');
    const reviewsContainer = document.getElementById('reviewsContainer');
    const whatsappBtn = document.getElementById('whatsappBtn');
    const errorBox = document.getElementById('expanded-error' || 'badWordError');

    // List of Bad Words to filter out (Aap isme aur bhi words add kar sakte hain)
    const badWords = ['gali', 'faltu', 'bekar', 'badtameez', 'chutiya', 'harami', 'kamine', 'madarchod', 'bhenchod'];

    function containsBadWord(text) {
        const lowerText = text.toLowerCase();
        return badWords.some(word => lowerText.includes(word));
    }

    // Load saved reviews from localStorage on startup
    loadReviews();

    function loadReviews() {
        const savedReviews = JSON.parse(localStorage.getItem('access_centre_reviews')) || [];
        reviewsContainer.innerHTML = '';
        
        // Agar koi review nahi hai toh default sample dikhayein
        if(savedReviews.length === 0) {
            reviewsContainer.innerHTML = `
                <div class="review-card">
                    <h4>Ajay Kumar</h4>
                    <span class="course-tag">O-Level / Web Developer & Computer Instructor</span>
                    <p>किस्मत की लकीरों पर नहीं, मैं तो अपनी मेहनत और कोडिंग पर विश्वास रखता हूँ,

कंप्यूटर की स्क्रीन पर जो आज मेरा नाम चमकता है, उसके पीछे मैं अपने Family और Mentor's का हाथ रखता हूँ!

Manoj sir और Praveen sir के मार्गदर्शन ने मुझे बनाया है एक असली डेवलपर,

Sudha ma'am और परिवार के आशीर्वाद से ही आज 'Sigmaboy' आईटी की दुनिया पर राज करता है </p>
                </div>
            `;
            return;
        }

        savedReviews.forEach(rev => {
            const card = document.createElement('div');
            card.className = 'review-card';
            card.innerHTML = `
                <h4>${escapeHtml(rev.name)}</h4>
                <span class="course-tag">${escapeHtml(rev.course)}</span>
                <p>${escapeHtml(rev.text)}</p>
            `;
            reviewsContainer.prepend(card);
        });
    }

    // Handle Form Submit (Website par save karne ke liye)
    if(reviewForm) {
        reviewForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const name = document.getElementById('revName').value.trim();
            const course = document.getElementById('revCourse').value.trim();
            const text = document.getElementById('revText').value.trim();

            const fullTextCheck = name + " " + course + " " + text;

            if(containsBadWord(fullTextCheck)) {
                showError("⚠️ Error: Aapke message me kuch anuchit (abusive) shabd paye gaye hain. Kripya sudhar karein!");
                return;
            }

            hideError();

            const newReview = { name, course, text };
            let savedReviews = JSON.parse(localStorage.getItem('access_centre_reviews')) || [];
            savedReviews.push(newReview);
            localStorage.setItem('access_centre_reviews', JSON.stringify(savedReviews));

            loadReviews();
            reviewForm.reset();
            alert("Dhanyawad! Aapka review successfully website par live kar diya gaya hai.");
        });
    }

    // Handle WhatsApp Direct Send Button (Number: 7800703908)
    if(whatsappBtn) {
        whatsappBtn.addEventListener('click', () => {
            const name = document.getElementById('revName').value.trim();
            const course = document.getElementById('revCourse').value.trim();
            const text = document.getElementById('revText').value.trim();

            if(!name || !course || !text) {
                alert("Kripya pehle Naam, Course aur Review box bhar dein!");
                return;
            }

            const fullTextCheck = name + " " + course + " " + text;
            if(containsBadWord(fullTextCheck)) {
                alert("⚠️ Error: Aapke message me galat shabd hain, WhatsApp par nahi bheja ja sakta.");
                return;
            }

            const waMessage = `*New Student Review*%0A*Naam:* ${encodeURIComponent(name)}%0A*Course:* ${encodeURIComponent(course)}%0A*Review:* ${encodeURIComponent(text)}`;
            const waUrl = `https://wa.me/917800703908?text=${waMessage}`;
            window.open(waUrl, '_blank');
        });
    }

    function showError(msg) {
        let errEl = document.getElementById('badWordError');
        if(errEl) {
            errEl.style.display = 'block';
            errEl.textContent = msg;
        }
    }

    function hideError() {
        let errEl = document.getElementById('badWordError');
        if(errEl) {
            errEl.style.display = 'none';
        }
    }

    function htmlEscape(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
});
}
// ==================== ACCESS PLUS ====================
// 1) Live visitor tracker (sab devices ki counting, server counter se)
// 2) Secret admin panel: keyboard par "sigma" likhte hi khulta hai
// 3) Login ke baad Welcome effect + XP / Streak / Badges / Daily Gift
// 4) 5 naye features: Question of the Day, Study Timer, Admission Enquiry,
//    Scroll progress + Back-to-top, Website Share
(function () {
  const NS = 'access-computer-netlify', API = 'https://api.counterapi.dev/v1/';
  const istDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d || new Date()); // YYYY-MM-DD (IST)
  const today = () => istDate();
  const ls = { get: k => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
  const ss = { get: k => { try { return sessionStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch {} } };
  const el = id => document.getElementById(id);

  /* ---------- Server counter ---------- */
  const ctr = {
    async up(n) { const r = await fetch(API + NS + '/' + n + '/up', { cache: 'no-store' }); if (!r.ok) throw new Error('up'); return +(await r.json()).count || 0; },
    async get(n) {
      try { const r = await fetch(API + NS + '/' + n + '/', { cache: 'no-store' }); if (r.status >= 500) return null; if (!r.ok) return 0; return +(await r.json()).count || 0; }
      catch { return null; }
    }
  };
  async function once(store, key, names) {
    if (store.get(key)) return;
    try { for (const n of names) await ctr.up(n); store.set(key, '1'); } catch {}
  }
  (function track() {
    const T = today();
    once(ss, 'acec_v_' + T, ['visits-' + T, 'visits-all']);   // ek session = 1 visit
    once(ls, 'acec_u_' + T, ['users-' + T]);                  // ek device = aaj ka 1 user
    once(ls, 'acec_u_all', ['users-all']);                    // ek device = all-time 1 user
  })();

  /* ---------- Live active users (2-minute heartbeat buckets) ---------- */
  (function live() {
    const BUCKET = 120000, node = el('liveN'), bk = () => Math.floor(Date.now() / BUCKET);
    async function beat() {
      const b = bk(), key = 'live-' + b;
      if (ss.get('acec_live') !== String(b)) { try { await ctr.up(key); ss.set('acec_live', String(b)); } catch {} }
      const cur = await ctr.get(key), prev = await ctr.get('live-' + (b - 1));
      const n = (cur === null && prev === null) ? 1 : Math.max(cur || 0, prev || 0, 1);
      if (node) node.textContent = n;
    }
    beat(); setInterval(() => { if (!document.hidden) beat(); }, 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) beat(); });
  })();

  /* ---------- Interaction history log (sigma panel) ---------- */
  const HK = 'acec_hist';
  const hist = {
    all() { try { return JSON.parse(ls.get(HK) || '[]'); } catch { return []; } },
    add(k, d) { const a = this.all(); a.push({ t: Date.now(), k, d: d || '' }); ls.set(HK, JSON.stringify(a.slice(-300))); }
  };
  if (!ss.get('acec_hv')) { ss.set('acec_hv', '1'); hist.add('🚪 Visit', document.referrer ? 'from ' + document.referrer : 'direct'); }
  (function () {
    const seen = new Set();
    const io2 = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting && !seen.has(e.target.id)) { seen.add(e.target.id); hist.add('👁 Section', '#' + e.target.id); } }), { threshold: .4 });
    document.querySelectorAll('main section[id]').forEach(s => io2.observe(s));
    document.querySelectorAll('#menu a').forEach(a => a.addEventListener('click', () => hist.add('🧭 Menu', a.textContent.trim())));
    new MutationObserver(() => hist.add('🎨 Theme', document.documentElement.dataset.theme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const si = el('sInp'); let st;
    if (si) si.addEventListener('input', () => {
      const v = si.value.trim().toLowerCase();
      if (v === 'sigma') { si.value = ''; const m = el('searchModal'); if (m) m.classList.remove('open'); openAdmin(); return; }
      clearTimeout(st); st = setTimeout(() => { if (v.length >= 3) hist.add('🔎 Search', v.slice(0, 40)); }, 900);
    });
  })();
  function renderHist() {
    const box = el('sigmaLog'); if (!box) return; box.textContent = '';
    const rows = hist.all().reverse().slice(0, 80);
    if (!rows.length) { box.textContent = 'Abhi koi log nahi.'; return; }
    rows.forEach(r => {
      const d = document.createElement('div'); d.className = 'sg-row';
      const t = document.createElement('time'); t.textContent = new Date(r.t).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' });
      const k = document.createElement('b'); k.textContent = r.k;
      const x = document.createElement('span'); x.textContent = r.d;
      d.append(t, k, x); box.append(d);
    });
  }
  if (el('sigmaClear')) el('sigmaClear').onclick = () => { ls.set(HK, '[]'); renderHist(); };

  /* ---------- Admin panel ---------- */
  let admTimer = null;
  window.renderAdminAnalytics = async function () {
    const set = (id, v) => { const e = el(id); if (e) e.textContent = v; };
    const T = today(), f = v => v === null ? '—' : v.toLocaleString('en-IN');
    set('adm-time', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'medium' }));
    set('adm-status', '⏳ load ho raha hai…');
    const r = await Promise.all([ctr.get('users-' + T), ctr.get('visits-' + T), ctr.get('logins-' + T), ctr.get('users-all'), ctr.get('visits-all')]);
    ['today-visitors', 'today-visits', 'today-logins', 'total-visitors', 'total-visits'].forEach((id, i) => set(id, f(r[i])));
    set('adm-status', r.every(x => x === null) ? '⚠ Counter server se connect nahi hua (internet / adblock check karein)' : '🟢 Live');
    const box = el('analytics-history'); if (!box) return;
    const days = [...Array(7)].map((_, i) => istDate(new Date(Date.now() - i * 864e5)));
    const rows = await Promise.all(days.map(async d => ({ d, u: await ctr.get('users-' + d), v: await ctr.get('visits-' + d), l: await ctr.get('logins-' + d) })));
    const max = Math.max(1, ...rows.map(x => x.u || 0));
    box.textContent = '';
    rows.forEach(x => {
      const row = document.createElement('div'); row.className = 'adm-row';
      const day = new Date(x.d + 'T12:00:00+05:30').toLocaleDateString('hi-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });
      const l = document.createElement('span'); l.textContent = '📅 ' + x.d + ' (' + day + ')';
      const bar = document.createElement('i'); bar.style.setProperty('--w', Math.round((x.u || 0) / max * 100) + '%');
      const n = document.createElement('b'); n.textContent = f(x.u) + ' users · ' + f(x.v) + ' visits · ' + f(x.l) + ' logins';
      row.append(l, bar, n); box.append(row);
    });
  };
  function openAdmin() {
    const s = el('admin-analytics'); if (!s) return;
    s.style.display = 'block'; window.renderAdminAnalytics(); renderHist(); hist.add('🔓 Sigma panel', 'unlocked');
    setTimeout(() => s.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
    clearInterval(admTimer); admTimer = setInterval(() => { if (s.style.display !== 'none') window.renderAdminAnalytics(); else clearInterval(admTimer); }, 15000);
  }
  let buf = '';
  document.addEventListener('keydown', e => {
    const t = e.target; if (t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable)) return; // form / code editor me type karte time na khule
    if (e.ctrlKey || e.metaKey || e.altKey || !e.key || e.key.length !== 1) return;
    buf = (buf + e.key.toLowerCase()).slice(-12);
    if (buf.endsWith('sigma') || buf.endsWith('anshika')) { buf = ''; openAdmin(); }
  });
  // Mobile ke liye: logo par 5 baar jaldi-jaldi tap
  (function () { const lg = document.querySelector('.brand .logo'); if (!lg) return; let n = 0, tm; lg.addEventListener('click', () => { n++; clearTimeout(tm); tm = setTimeout(() => n = 0, 1500); if (n >= 5) { n = 0; openAdmin(); } }); })();
  if (el('admRefresh')) el('admRefresh').onclick = () => window.renderAdminAnalytics();
  if (el('admClose')) el('admClose').onclick = () => { el('admin-analytics').style.display = 'none'; clearInterval(admTimer); };

  /* ---------- Student progress: XP, streak, badges ---------- */
  const TIPS = [
    'Ctrl + Shift + S = Save As. Ctrl + S = Save.', 'CCC me Internet aur Cyber Security ke sawal zaroor aate hain, unhe pehle taiyaar karein.',
    'HTML me sabse badi heading <h1> hoti hai aur sabse chhoti <h6>.', 'Typing me speed se pehle accuracy badhaiye. Speed apne aap aa jayegi.',
    'Excel/Calc me formula hamesha = (equal) se shuru hota hai.', 'Test dene se pehle 5 minute purane galat jawab dekh lijiye.',
    'Python me indentation (spaces) bahut zaroori hai, galti hui to error aayega.', 'F12 dabakar browser ka Inspect tool kholiye. Web design seekhne ka best tareeka.',
    'Ctrl + Z = Undo, Ctrl + Y = Redo. Dono roz kaam aate hain.', 'Roz sirf 20 sawal solve karein. 30 din me 600 sawal ho jayenge!',
    'Password me letters, numbers aur symbols mix karein, aur kisi ke saath share na karein.', 'Padhai ke beech 25 min focus + 5 min break (Pomodoro) sabse achha chalta hai.'
  ];
  const lvl = xp => Math.floor(xp / 200) + 1;
  const pkey = u => 'acec_prog_' + (u && u.mob || 'guest');
  const blank = () => ({ xp: 0, streak: 0, best: 0, last: '', welcomed: false, gift: '', q: '' });
  const getP = u => { try { return Object.assign(blank(), JSON.parse(ls.get(pkey(u)) || '{}')); } catch { return blank(); } };
  const saveP = (u, p) => ls.set(pkey(u), JSON.stringify(p));
  const U = () => (typeof user !== 'undefined' ? user : null);
  function badges(p) {
    const b = [['🎓', 'Access Student']];
    if (p.best >= 3) b.push(['🔥', '3 Din Streak']); if (p.best >= 7) b.push(['⚡', 'Weekly Warrior']);
    if (p.xp >= 500) b.push(['🏅', '500 XP Club']); if (p.xp >= 1000) b.push(['👑', 'Champion']);
    return b;
  }
  function dailyBonus(p) {
    const t = today(); if (p.last === t) return 0;
    const y = istDate(new Date(Date.now() - 864e5));
    p.streak = p.last === y ? p.streak + 1 : 1; p.best = Math.max(p.best, p.streak); p.last = t;
    const g = 25 + Math.min(p.streak, 7) * 5; p.xp += g; return g;
  }
  window.acAddXP = function (n, why) {
    const u = U(); if (!u) { toast('Login karke XP kamayein ⭐'); return false; }
    const p = getP(u); p.xp += n; saveP(u, p); window.acPaint(); toast('⭐ +' + n + ' XP · ' + why); return true;
  };
  window.acPaint = function () {
    let chip = el('acChip');
    if (!chip) { const b = el('loginBtn'); if (!b) return; chip = document.createElement('span'); chip.id = 'acChip'; chip.className = 'ac-chip'; chip.hidden = true; b.before(chip); }
    const u = U(); if (!u) { chip.hidden = true; return; }
    const p = getP(u); chip.hidden = false; chip.textContent = '⭐ ' + p.xp + ' · Lv ' + lvl(p.xp) + (p.streak ? ' · 🔥' + p.streak : '');
    chip.title = 'XP ' + p.xp + ' | Level ' + lvl(p.xp) + ' | Streak ' + p.streak + ' din';
  };

  /* ---------- Login page: lamp ki cord neeche kheenchte hi light jalti hai aur login form khulta hai ---------- */
  (function () {
    const m = el('loginModal'), wrap = el('lgWrap'), lamp = el('lamp'), card = el('lgCard');
    const hit = el('lampHit'), head = el('lampHead'), cord = el('lampCord'), pull = el('lampPull'), msg = el('lampMsg');
    if (!m || !wrap || !lamp || !hit || !card) return;
    const MSG_OFF = msg ? msg.textContent : '';
    const AX = 138, AY = 96, REST = 164, MAX = 84, TRIGGER = 50;   // lamp SVG (200x270) ke coordinates
    let y = 0, x = 0, v = 0, startX = 0, startY = 0, moved = 0;
    let dragging = false, autoDown = false, lit = false, raf = 0, openTimer = 0, wasOpen = false;

    const scale = () => (lamp.clientWidth / 200) || 1;
    const paint = () => {
      const p = Math.max(0, Math.min(y / TRIGGER, 1));
      lamp.style.setProperty('--pull', p.toFixed(3));
      const ang = Math.max(-4, Math.min(4, y * 0.028 + x * 0.1)), r = ang * Math.PI / 180;
      const ax = 100 + (AX - 100) * Math.cos(r) - AY * Math.sin(r);
      const ay = (AX - 100) * Math.sin(r) + AY * Math.cos(r);
      const hx = ax + x * 0.25, hy = REST + y;
      head.setAttribute('transform', 'rotate(' + ang.toFixed(2) + ' 100 0)');
      cord.setAttribute('d', 'M' + ax.toFixed(1) + ' ' + ay.toFixed(1) + 'L' + hx.toFixed(1) + ' ' + hy.toFixed(1));
      cord.setAttribute('stroke-width', (2.6 - p * 0.9).toFixed(2));          // kheenchne par cord patli hoti hai
      pull.setAttribute('transform', 'translate(' + hx.toFixed(1) + ' ' + hy.toFixed(1) + ')');
      const s = scale();
      hit.style.transform = 'translate(' + ((hx - AX) * s).toFixed(1) + 'px,' + ((hy - REST) * s).toFixed(1) + 'px)';
    };

    const turnOn = () => {
      if (lit) return; lit = true;
      lamp.classList.add('on'); wrap.classList.add('lit'); m.classList.add('lit');
      hit.setAttribute('aria-pressed', 'true'); hit.setAttribute('aria-label', 'Light is on');
      if (msg) msg.textContent = 'Light on ✨ Login khul raha hai…';
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) {}
      clearTimeout(openTimer);
      openTimer = setTimeout(() => {
        wrap.classList.add('ok'); card.removeAttribute('inert');
        setTimeout(() => { const n = el('nmLEmail'); if (n) n.focus(); }, 650);
      }, 720);
    };

    const tick = () => {
      if (autoDown) {                                           // tap / keyboard: cord apne aap neeche jaati hai
        y += (MAX - y) * 0.3;
        if (y >= TRIGGER + 2) { autoDown = false; v = 0; turnOn(); }
      } else if (!dragging) {                                   // chhodte hi cord spring ki tarah wapas
        v += -y * 0.18; v *= 0.72; y += v; x *= 0.8;
        if (Math.abs(y) < 0.2 && Math.abs(v) < 0.2 && Math.abs(x) < 0.3) { y = v = x = 0; raf = 0; paint(); return; }
      }
      paint(); raf = requestAnimationFrame(tick);
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const band = raw => raw < 0 ? raw * 0.15 : raw < 60 ? raw : Math.min(MAX, 60 + (raw - 60) * 0.4);
    hit.addEventListener('pointerdown', e => {                  // mouse + touch + pen
      if (lit || autoDown || (e.pointerType === 'mouse' && e.button !== 0)) return;
      dragging = true; moved = 0; startX = e.clientX; startY = e.clientY;
      lamp.classList.add('drag');
      try { hit.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault(); kick();
    });
    hit.addEventListener('pointermove', e => {
      if (!dragging) return;
      const k = 1 / scale(), dy = (e.clientY - startY) * k, dx = (e.clientX - startX) * k;
      moved = Math.max(moved, Math.abs(dy), Math.abs(dx));
      y = band(dy); x = Math.max(-30, Math.min(30, dx));
      if (y >= TRIGGER) turnOn();
    });
    const release = () => {
      if (!dragging) return; dragging = false; lamp.classList.remove('drag');
      if (!lit && moved < 6) { autoDown = true; }               // sirf tap kiya to bhi cord kheench do
      kick();
    };
    hit.addEventListener('pointerup', release);
    hit.addEventListener('pointercancel', release);
    hit.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') { e.preventDefault(); if (!lit && !autoDown) { autoDown = true; kick(); } }
    });

    const reset = () => {
      clearTimeout(openTimer); cancelAnimationFrame(raf); raf = 0;
      lit = dragging = autoDown = false; y = x = v = 0;
      wrap.classList.remove('ok', 'lit'); m.classList.remove('lit'); lamp.classList.remove('on', 'drag');
      hit.setAttribute('aria-pressed', 'false');
      hit.setAttribute('aria-label', 'Pull the lamp cord down to turn on the light and open student login');
      if (msg) msg.textContent = MSG_OFF;
      card.setAttribute('inert', ''); paint();
    };
    new MutationObserver(() => {                                // sirf open/close badalne par reset (lit class se loop na bane)
      const open = m.classList.contains('open');
      if (open === wasOpen) return;
      wasOpen = open; reset();
      if (open) setTimeout(() => { try { hit.focus({ preventScroll: true }); } catch (e) {} }, 60);
    }).observe(m, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('resize', paint);
    reset();
  })();

  /* ---------- Login ke baad Welcome effect ---------- */
  function confetti(cv, ms) {
    const c = cv.getContext('2d'); let W = cv.width = innerWidth, H = cv.height = innerHeight;
    const cols = ['#ffd166', '#ff9f1c', '#e5383b', '#22c55e', '#38bdf8', '#e0338b', '#fff'];
    const ps = [...Array(170)].map(() => ({ x: W / 2, y: H * .38, vx: (Math.random() - .5) * 16, vy: -Math.random() * 15 - 3, s: 5 + Math.random() * 6, c: cols[Math.random() * cols.length | 0], r: Math.random() * 6, vr: (Math.random() - .5) * .4 }));
    const t0 = performance.now();
    (function f(t) {
      const k = t - t0; c.clearRect(0, 0, W, H);
      ps.forEach(p => { p.vy += .32; p.x += p.vx; p.y += p.vy; p.vx *= .992; p.r += p.vr; c.save(); c.globalAlpha = Math.max(0, 1 - k / ms); c.translate(p.x, p.y); c.rotate(p.r); c.fillStyle = p.c; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); c.restore(); });
      if (k < ms) requestAnimationFrame(f); else c.clearRect(0, 0, W, H);
    })(t0);
  }
  function mk(tag, cls, txt) { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
  function showWelcome(u, p, first, daily, gain) {
    const old = el('acWelcome'); if (old) old.remove();
    const root = mk('div', 'acw'); root.id = 'acWelcome';
    const cv = mk('canvas', 'acw-cv'); root.append(cv);
    const card = mk('div', 'acw-card'); root.append(card);
    card.append(mk('div', 'acw-ring', '🎓'));
    const h = mk('h2'); h.append('Welcome, ', mk('b', '', u.name.split(' ')[0]), '! 🎉'); card.append(h);
    card.append(mk('p', 'acw-sub', first ? 'Aapka account ban gaya. Rewards unlock ho gaye!' : 'Wapas aane par swagat hai! Aapka reward taiyaar hai.'));
    const st = mk('div', 'acw-stats');
    [[p.xp, 'Total XP'], ['Lv ' + lvl(p.xp), 'Level'], ['🔥 ' + p.streak, 'Din Streak']].forEach(a => { const d = mk('div'); d.append(mk('b', '', a[0]), mk('small', '', a[1])); st.append(d); });
    card.append(st);
    const pk = mk('ul', 'acw-perks');
    if (first) pk.append(mk('li', '', '🎁 +100 XP Welcome Bonus'));
    if (daily) pk.append(mk('li', '', '📅 +' + daily + ' XP Daily Login Bonus (streak ' + p.streak + ')'));
    if (!first && !daily) pk.append(mk('li', '', '✅ Aaj ka daily bonus aap le chuke hain. Kal phir aayein!'));
    pk.append(mk('li', '', '❓ Question of the Day se aur XP kamayein'));
    pk.append(mk('li', '', '⏱ Study Timer ke focus session se +10 XP'));
    badges(p).forEach(b => pk.append(mk('li', '', b[0] + ' Badge: ' + b[1])));
    card.append(pk);
    const gift = mk('button', 'acw-gift'); gift.type = 'button';
    const claimed = p.gift === today();
    gift.append(mk('span', 'g', claimed ? '🎀' : '🎁'), mk('small', '', claimed ? 'Aaj ka gift khul chuka hai' : 'Tap karke aaj ka Daily Gift kholein'));
    gift.onclick = () => {
      if (gift.dataset.done) return; gift.dataset.done = '1';
      const pp = getP(u), tip = TIPS[(pp.xp + new Date().getDate()) % TIPS.length];
      gift.classList.add('open'); gift.textContent = '';
      gift.append(mk('span', 'g', '💡'), mk('b', '', tip));
      if (pp.gift !== today()) { pp.gift = today(); pp.xp += 15; saveP(u, pp); gift.append(mk('small', '', '+15 XP mil gaye! ⭐')); window.acPaint(); confetti(cv, 1800); }
    };
    card.append(gift);
    const go = mk('button', 'btn full', 'Chalo Shuru Karein 🚀'); go.type = 'button'; go.onclick = () => { root.classList.remove('show'); setTimeout(() => root.remove(), 350); };
    card.append(go);
    document.body.append(root); requestAnimationFrame(() => root.classList.add('show'));
    confetti(cv, 3600);
  }
  window.acLoginFX = function (u) {
    if (!u) return;
    const p = getP(u), first = !p.welcomed; let gain = 0;
    if (first) { p.welcomed = true; p.xp += 100; gain += 100; }
    const d = dailyBonus(p); gain += d; saveP(u, p); window.acPaint();
    ctr.up('logins-' + today()).catch(() => {}); ctr.up('logins-all').catch(() => {});
    showWelcome(u, p, first, d, gain);
  };
  // Pehle se login user: roz ka streak bonus
  (function () { const u = U(); if (!u) { window.acPaint(); return; } const p = getP(u); const d = dailyBonus(p); saveP(u, p); window.acPaint(); if (d) setTimeout(() => toast('🔥 ' + p.streak + ' din streak! +' + d + ' XP'), 1200); })();

  /* ---------- Feature 1: Question of the Day ---------- */
  (function () {
    const Q = el('qdQ'); if (!Q) return;
    const keys = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'o1', 'o2', 'o3', 'o4', 'o5'];
    let seed = 0; today().split('').forEach(ch => seed = (seed * 31 + ch.charCodeAt(0)) >>> 0);
    let key = null, q = null;
    for (let i = 0; i < keys.length && !q; i++) { const k = keys[(seed + i) % keys.length], b = getBank(k); if (b && b.length) { key = k; q = b[(seed * 7) % b.length]; } }
    if (!q) { el('qdCard').style.display = 'none'; return; }
    const topic = (CCC.concat(OL).find(c => c[0] === key) || [0, 'Computer'])[1];
    el('qdTag').textContent = '📘 ' + topic + ' · ' + today();
    Q.textContent = qOf(q);
    const box = el('qdOpts'), res = el('qdRes'), memo = 'acec_qd_' + today();
    const done = ls.get(memo);
    oOf(q).forEach((o, i) => {
      const b = mk('button', 'qd-o'); b.type = 'button'; b.textContent = String.fromCharCode(65 + i) + '. ' + o;
      b.onclick = () => answer(i, true); box.append(b);
    });
    function answer(i, fresh) {
      [...box.children].forEach((b, j) => { b.disabled = true; if (j === q.a) b.classList.add('ok'); else if (j === i) b.classList.add('bad'); });
      const right = i === q.a;
      res.textContent = right ? '✅ Bilkul sahi!' : '❌ Galat. Sahi jawab: ' + String.fromCharCode(65 + q.a);
      if (fresh) { ls.set(memo, String(i)); if (U()) window.acAddXP(right ? 20 : 5, right ? 'Question of the Day sahi' : 'Question of the Day koshish'); else res.textContent += ' Login karke XP kamayein ⭐'; }
    }
    if (done !== null) answer(+done, false);
  })();

  /* ---------- Feature 2: Study Timer (Pomodoro) ---------- */
  (function () {
    const btn = el('stBtn'), pn = el('stPanel'); if (!btn || !pn) return;
    let mins = 25, left = 25 * 60, tm = null;
    const show = () => { el('stTime').textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0'); };
    const beep = () => { try { const a = new (window.AudioContext || window.webkitAudioContext)(), o = a.createOscillator(), g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = .15; o.start(); setTimeout(() => { o.stop(); a.close(); }, 700); } catch {} };
    const stop = () => { clearInterval(tm); tm = null; el('stGo').textContent = '▶ Start'; };
    btn.onclick = () => { pn.hidden = !pn.hidden; };
    el('stGo').onclick = () => {
      if (tm) { stop(); return; }
      el('stGo').textContent = '⏸ Pause';
      tm = setInterval(() => {
        left--; show();
        if (left <= 0) { stop(); beep(); left = mins * 60; show(); if (mins === 25) { if (U()) window.acAddXP(10, 'Focus session poora'); else toast('🎉 Focus poora! Login karke XP kamayein'); } else toast('☕ Break khatam, wapas padhai!'); }
      }, 1000);
    };
    el('stReset').onclick = () => { stop(); left = mins * 60; show(); };
    pn.querySelectorAll('.st-modes button').forEach(b => b.onclick = () => { pn.querySelectorAll('.st-modes button').forEach(x => x.classList.toggle('on', x === b)); mins = +b.dataset.m; stop(); left = mins * 60; show(); });
    show();
  })();

  /* ---------- Feature 3: Admission Enquiry (WhatsApp) ---------- */
  (function () {
    const b = el('enqBtn'), f = el('enqForm'); if (!b || !f) return;
    b.onclick = () => { const u = U(); if (u) { el('eqName').value = u.name; el('eqMob').value = u.mob; } openModal('enqModal'); };
    f.onsubmit = e => {
      e.preventDefault();
      const n = el('eqName').value.trim(), m = el('eqMob').value.trim(), c = el('eqCourse').value;
      if (!/^[0-9]{10}$/.test(m)) return toast('10 digit ka sahi mobile number likhein');
      const msg = 'Namaste Sir, main ' + n + ' (' + m + ') hu. Mujhe ' + c + ' course ke baare me jaankari chahiye.';
      window.open('https://wa.me/916393512412?text=' + encodeURIComponent(msg), '_blank', 'noopener');
      closeModal('enqModal');
    };
  })();

  /* ---------- Feature 4: Scroll progress + Back to top ---------- */
  (function () {
    const bar = el('scrollBar'), top = el('topBtn'); if (!bar || !top) return;
    const on = () => { const h = document.documentElement, mx = h.scrollHeight - h.clientHeight; bar.style.width = (mx > 0 ? h.scrollTop / mx * 100 : 0) + '%'; top.classList.toggle('show', h.scrollTop > 600); };
    addEventListener('scroll', on, { passive: true }); on();
    top.onclick = () => scrollTo({ top: 0, behavior: 'smooth' });
  })();

  /* ---------- Feature 5: Website Share ---------- */
  (function () {
    const b = el('shBtn'); if (!b) return;
    b.onclick = async () => {
      const d = { title: 'Access Computer Education Centre', text: 'CCC, O-Level, Python, Typing ki best coaching aur free online test series!', url: location.href.split('#')[0] };
      try { if (navigator.share) { await navigator.share(d); return; } } catch { return; }
      window.open('https://wa.me/?text=' + encodeURIComponent(d.text + ' ' + d.url), '_blank', 'noopener');
    };
  })();
})();

// ================= MS Office & Python tabs (ab dono alag-alag chalte hain) =================
function _tabs(secId, evt, name) {
  const sec = document.getElementById(secId);
  sec.querySelectorAll('.mso-tab-content').forEach(x => x.classList.remove('active'));
  sec.querySelectorAll('.mso-tab-btn').forEach(x => x.classList.remove('active'));
  if (name !== 'none') {
    const el = document.getElementById(name); if (el) el.classList.add('active');
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
  }
}
function openMsoTab(evt, name) { _tabs('msoffice', evt, name); }
function openPythonTab(evt, name) { _tabs('python-section', evt, name); }

// ================= O-Level (M2-R5) Coding: HTML / CSS / JavaScript tab =================
$$('.olc-head').forEach(h => h.onclick = () => {
  const it = h.closest('.olc-item'), open = !it.classList.contains('open');
  it.classList.toggle('open', open); h.setAttribute('aria-expanded', open); it.querySelector('.olc-body').hidden = !open;
});
$$('.olc-fig img').forEach(i => i.onclick = () => { $('#lbImg').src = i.currentSrc || i.src; $('#lb').classList.add('open'); });

// ================= Test keyboard shortcuts: 1-4 / A-D option, Enter = next =================
document.addEventListener('keydown', e => {
  if (!testOpen || !T || T.finished || dlgRes || e.ctrlKey || e.altKey || e.metaKey) return;
  if (T.sel === null) {
    let j = '1234'.indexOf(e.key); if (j < 0) j = 'abcd'.indexOf(e.key.toLowerCase());
    const bs = $$('#tBody .opt'); if (j >= 0 && bs[j]) bs[j].click();
  } else if (e.key === 'Enter' || e.key === 'ArrowRight') { const nb = $('#tBody .btn.sm'); if (nb) nb.click(); }
});

// ================= CODING PRACTICE: VS Code style editor =================
(function () {
  const root = $('#vsc'); if (!root) return;
  const ta = $('#cpTa'), pre = $('#cpPre'), gutIn = $('#cpGutIn'), cl = $('#cpCl'), pop = $('#cpPop'), fr = $('#cpFrame'), con = $('#cpCon'), sym = $('#cpSym'), code = $('.vsc-code', root), meas = $('#cpM');
  const NAMES = ['index.html', 'style.css', 'script.js'], LN = { html: 'HTML', css: 'CSS', js: 'JavaScript' };
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'area', 'base', 'col', 'embed', 'source', 'track', 'wbr']);
  const PAIR = { '(': ')', '[': ']', '{': '}', '"': '"', "'": "'", '`': '`' };

  /* ---------- Examples ---------- */
  const EX = {
    hello: {
      'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n  <link rel="stylesheet" href="style.css">\n</head>\n<body>\n  <h1>Hello, Access Computer!</h1>\n  <p>Ye meri pehli web page hai.</p>\n  <button onclick="greet()">Click Me</button>\n  <script src="script.js"></script>\n</body>\n</html>\n',
      'style.css': 'body {\n  font-family: Arial, sans-serif;\n  text-align: center;\n  background: #fff8e1;\n}\nh1 {\n  color: #e65100;\n}\nbutton {\n  padding: 10px 24px;\n  border: 0;\n  border-radius: 8px;\n  background: #ff9800;\n  color: #fff;\n}\n',
      'script.js': 'function greet() {\n  alert("Welcome to Access Computer Education Centre!");\n  console.log("Button clicked");\n}\n'
    },
    table: {
      'index.html': '<h2>Student Marks</h2>\n<table border="1">\n  <tr>\n    <th>Name</th>\n    <th>Marks</th>\n  </tr>\n  <tr>\n    <td>Anshika</td>\n    <td>92</td>\n  </tr>\n  <tr>\n    <td>Akshay</td>\n    <td>85</td>\n  </tr>\n</table>\n',
      'style.css': 'table {\n  border-collapse: collapse;\n  width: 60%;\n}\nth, td {\n  padding: 8px;\n  text-align: center;\n}\nth {\n  background: #1976d2;\n  color: #fff;\n}\n',
      'script.js': '// Table me JavaScript lagana ho to yahan likho\nconsole.log("Table ready");\n'
    },
    form: {
      'index.html': '<h2>Registration Form</h2>\n<form>\n  <label>Name:</label><br>\n  <input type="text" placeholder="Apna naam">\n  <br><br>\n  <label>Course:</label><br>\n  <select>\n    <option>CCC</option>\n    <option>O-Level</option>\n  </select>\n  <br><br>\n  <input type="submit" value="Submit">\n</form>\n',
      'style.css': 'form {\n  max-width: 280px;\n  margin: 20px auto;\n  padding: 16px;\n  border: 2px solid #4caf50;\n  border-radius: 10px;\n}\ninput, select {\n  width: 100%;\n  padding: 8px;\n}\n',
      'script.js': 'document.querySelector("form").addEventListener("submit", function (e) {\n  e.preventDefault();\n  alert("Form submit ho gaya!");\n});\n'
    },
    counter: {
      'index.html': '<h1 id="count">0</h1>\n<button id="add">+1</button>\n<button id="reset">Reset</button>\n',
      'style.css': 'body {\n  text-align: center;\n  font-family: sans-serif;\n}\nbutton {\n  font-size: 20px;\n  padding: 8px 20px;\n}\n',
      'script.js': 'let n = 0;\nconst show = document.getElementById("count");\n\ndocument.getElementById("add").addEventListener("click", function () {\n  n++;\n  show.textContent = n;\n});\n\ndocument.getElementById("reset").onclick = function () {\n  n = 0;\n  show.textContent = n;\n};\n'
    }
  };

  /* ---------- Suggestion data  (name, 'English|हिन्दी', snippet) ---------- */
  const TG = [
    ['!DOCTYPE', 'Tells browser it is HTML5|ब्राउज़र को बताता है कि HTML5 है', '!DOCTYPE html>'], ['html', 'Root of the whole page|पूरे पेज का रूट'], ['head', 'Page info (title, links)|पेज की जानकारी'],
    ['title', 'Browser tab title|ब्राउज़र टैब का नाम'], ['body', 'Visible page content|पेज का दिखने वाला हिस्सा'], ['h1', 'Biggest heading|सबसे बड़ा हेडिंग'], ['h2', 'Heading level 2|हेडिंग 2'],
    ['h3', 'Heading level 3|हेडिंग 3'], ['h4', 'Heading level 4|हेडिंग 4'], ['h5', 'Heading level 5|हेडिंग 5'], ['h6', 'Smallest heading|सबसे छोटा हेडिंग'], ['p', 'Paragraph|पैराग्राफ'],
    ['br', 'Line break|नई लाइन'], ['hr', 'Horizontal line|आड़ी लाइन'], ['a', 'Link to another page|दूसरे पेज का लिंक', 'a href="$0"></a>'], ['img', 'Show an image|इमेज दिखाता है', 'img src="$0" alt="">'],
    ['div', 'Box / container|बॉक्स / कंटेनर'], ['span', 'Small inline container|इनलाइन कंटेनर'], ['ul', 'Bullet list|बुलेट लिस्ट'], ['ol', 'Numbered list|नंबर वाली लिस्ट'], ['li', 'List item|लिस्ट का आइटम'],
    ['table', 'Table|टेबल बनाता है', 'table border="1">\n  <tr>\n    <td>$0</td>\n  </tr>\n</table>'], ['tr', 'Table row|टेबल की रो'], ['td', 'Table cell|टेबल का सेल'], ['th', 'Table heading cell|टेबल का हेडिंग सेल'],
    ['form', 'Form for user input|यूज़र इनपुट फ़ॉर्म'], ['input', 'Input box|इनपुट बॉक्स', 'input type="$0">'], ['button', 'Clickable button|क्लिक बटन'], ['label', 'Label of an input|इनपुट का लेबल'],
    ['select', 'Dropdown list|ड्रॉपडाउन लिस्ट'], ['option', 'Dropdown item|ड्रॉपडाउन आइटम'], ['textarea', 'Multi-line text box|मल्टी-लाइन बॉक्स'],
    ['style', 'CSS code inside page|पेज के अंदर CSS', 'style>\n  $0\n</style>'], ['script', 'JavaScript code|JavaScript कोड', 'script>\n  $0\n</script>'],
    ['link', 'Attach a CSS file|CSS फ़ाइल जोड़ता है', 'link rel="stylesheet" href="$0">'], ['meta', 'Page settings|पेज सेटिंग', 'meta charset="UTF-8">'],
    ['header', 'Top part of page|पेज का ऊपरी भाग'], ['nav', 'Navigation links|नेविगेशन लिंक'], ['section', 'Section of page|पेज का सेक्शन'], ['footer', 'Bottom part of page|पेज का निचला भाग'],
    ['b', 'Bold text|बोल्ड टेक्स्ट'], ['i', 'Italic text|इटैलिक टेक्स्ट'], ['u', 'Underline text|अंडरलाइन टेक्स्ट'], ['strong', 'Important text (bold)|ज़रूरी टेक्स्ट'], ['em', 'Emphasis (italic)|ज़ोर वाला टेक्स्ट'],
    ['center', 'Center the content|बीच में करता है'], ['marquee', 'Scrolling text|चलता हुआ टेक्स्ट'], ['pre', 'Text as it is written|जैसा लिखा वैसा'], ['iframe', 'Page inside a page|पेज के अंदर पेज'],
    ['video', 'Play a video|वीडियो चलाता है'], ['audio', 'Play audio|ऑडियो चलाता है'], ['!--', 'HTML comment|कमेंट (दिखता नहीं)', '!-- $0 -->']
  ].map(a => ({ k: 'tag', n: a[0], d: a[1], s: a[2] }));
  const AT = [['class', 'CSS class name|CSS क्लास'], ['id', 'Unique id|यूनिक आईडी'], ['style', 'Inline CSS|इनलाइन CSS'], ['href', 'Link address|लिंक का पता'], ['src', 'File / image path|फ़ाइल / इमेज का पाथ'],
    ['alt', 'Text if image fails|इमेज न दिखे तो टेक्स्ट'], ['width', 'Width|चौड़ाई'], ['height', 'Height|ऊँचाई'], ['type', 'Type of input|इनपुट का प्रकार'], ['name', 'Name of field|फ़ील्ड का नाम'], ['value', 'Default value|डिफ़ॉल्ट वैल्यू'],
    ['placeholder', 'Hint inside box|बॉक्स के अंदर हिंट'], ['target', 'Where to open link|लिंक कहाँ खुले'], ['rel', 'Relation (stylesheet)|रिलेशन'], ['title', 'Tooltip text|टूलटिप'], ['colspan', 'Merge columns|कॉलम मर्ज'],
    ['rowspan', 'Merge rows|रो मर्ज'], ['border', 'Border size|बॉर्डर'], ['bgcolor', 'Background color|बैकग्राउंड रंग'], ['align', 'Alignment|अलाइनमेंट'], ['required', 'Must be filled|भरना ज़रूरी'],
    ['onclick', 'Run JS on click|क्लिक पर JS चले'], ['action', 'Form target|फ़ॉर्म कहाँ जाएगा'], ['method', 'get / post|get / post'], ['for', 'Label for id|लेबल किसके लिए']].map(a => ({ k: 'attr', n: a[0], d: a[1], s: a[0] + '="$0"' }));
  const CP = [['color', 'Text color|टेक्स्ट का रंग'], ['background', 'Background|बैकग्राउंड'], ['background-color', 'Background color|बैकग्राउंड रंग'], ['font-size', 'Text size|टेक्स्ट साइज़'], ['font-family', 'Font name|फ़ॉन्ट'],
    ['font-weight', 'Bold / normal|बोल्ड / नॉर्मल'], ['text-align', 'Align text|टेक्स्ट अलाइन'], ['margin', 'Outer space|बाहर की जगह'], ['padding', 'Inner space|अंदर की जगह'], ['border', 'Border line|बॉर्डर'],
    ['border-radius', 'Round corners|गोल कोने'], ['width', 'Width|चौड़ाई'], ['height', 'Height|ऊँचाई'], ['display', 'Display type|डिस्प्ले टाइप'], ['position', 'Position type|पोज़िशन'], ['top', 'Distance from top|ऊपर से दूरी'],
    ['left', 'Distance from left|बाएँ से दूरी'], ['right', 'Distance from right|दाएँ से दूरी'], ['bottom', 'Distance from bottom|नीचे से दूरी'], ['justify-content', 'Flex main axis|फ्लेक्स अलाइन'], ['align-items', 'Flex cross axis|फ्लेक्स अलाइन'],
    ['flex-direction', 'Row / column|रो / कॉलम'], ['gap', 'Space between items|आइटम के बीच जगह'], ['box-shadow', 'Shadow|परछाई'], ['text-decoration', 'Underline etc.|अंडरलाइन आदि'], ['line-height', 'Line spacing|लाइन की दूरी'],
    ['opacity', 'Transparency|पारदर्शिता'], ['overflow', 'Extra content|ज़्यादा कंटेंट'], ['cursor', 'Mouse pointer|माउस पॉइंटर'], ['transition', 'Smooth change|स्मूद बदलाव'], ['transform', 'Rotate / scale|घुमाना / बड़ा करना'],
    ['z-index', 'Layer order|लेयर का क्रम'], ['float', 'Float left/right|फ्लोट'], ['max-width', 'Maximum width|अधिकतम चौड़ाई'], ['list-style', 'List bullets|लिस्ट बुलेट']].map(a => ({ k: 'css', n: a[0], d: a[1], s: a[0] + ': $0;' }));
  const VAL = { display: 'block inline inline-block flex grid none', position: 'static relative absolute fixed sticky', 'text-align': 'left center right justify', 'font-weight': 'normal bold bolder 600',
    'justify-content': 'flex-start center flex-end space-between space-around', 'align-items': 'center flex-start flex-end stretch', 'flex-direction': 'row column', cursor: 'pointer default', overflow: 'hidden auto scroll visible',
    'text-decoration': 'none underline line-through', float: 'left right none', border: 'solid 1px dashed', 'list-style': 'none disc circle square' };
  const JS = [['console.log', 'Print in console|कंसोल में प्रिंट', 'console.log($0);'], ['document.getElementById', 'Get element by id|id से एलिमेंट', 'document.getElementById("$0")'],
    ['document.querySelector', 'Get element (CSS selector)|एलिमेंट खोजो', 'document.querySelector("$0")'], ['document.write', 'Write on page|पेज पर लिखो', 'document.write($0);'], ['addEventListener', 'Listen to event|इवेंट सुनो', 'addEventListener("click", function () {\n  $0\n});'],
    ['function', 'Create a function|फ़ंक्शन बनाओ', 'function $0() {\n  \n}'], ['const', 'Constant variable|कॉन्स्टेंट वेरिएबल', 'const $0 = '], ['let', 'Variable|वेरिएबल', 'let $0 = '], ['var', 'Old variable|पुराना वेरिएबल', 'var $0 = '],
    ['if', 'Condition|कंडीशन', 'if ($0) {\n  \n}'], ['else', 'Else part|else भाग', 'else {\n  $0\n}'], ['for', 'For loop|फॉर लूप', 'for (let i = 0; i < $0; i++) {\n  \n}'], ['while', 'While loop|वाइल लूप', 'while ($0) {\n  \n}'],
    ['switch', 'Switch case|स्विच केस', 'switch ($0) {\n  case 1:\n    break;\n  default:\n}'], ['return', 'Return value|वैल्यू लौटाओ', 'return $0;'], ['alert', 'Popup message|पॉपअप संदेश', 'alert("$0");'],
    ['prompt', 'Ask user input|यूज़र से इनपुट', 'prompt("$0")'], ['confirm', 'OK / Cancel box|OK / Cancel बॉक्स', 'confirm("$0")'], ['parseInt', 'Text to integer|टेक्स्ट से पूर्णांक', 'parseInt($0)'],
    ['parseFloat', 'Text to decimal|टेक्स्ट से दशमलव', 'parseFloat($0)'], ['setTimeout', 'Run after delay|देर से चलाओ', 'setTimeout(function () {\n  $0\n}, 1000);'], ['setInterval', 'Repeat again & again|बार-बार चलाओ', 'setInterval(function () {\n  $0\n}, 1000);'],
    ['Math.random', 'Random number|रैंडम नंबर', 'Math.random()'], ['Math.floor', 'Round down|नीचे राउंड', 'Math.floor($0)'], ['try', 'Catch errors|एरर पकड़ो', 'try {\n  $0\n} catch (e) {\n  console.log(e);\n}']]
    .map(a => ({ k: 'js', n: a[0], d: a[1], s: a[2] }));
  const MEM = [['innerHTML', 'HTML inside element|एलिमेंट का HTML'], ['textContent', 'Text of element|एलिमेंट का टेक्स्ट'], ['value', 'Input value|इनपुट की वैल्यू'], ['style', 'CSS style|CSS स्टाइल'], ['length', 'Length|लंबाई'],
    ['push', 'Add to array|ऐरे में जोड़ो'], ['toUpperCase', 'To CAPITAL|बड़े अक्षर'], ['toLowerCase', 'To small|छोटे अक्षर'], ['classList', 'Class list|क्लास लिस्ट'], ['onclick', 'Click handler|क्लिक हैंडलर']].map(a => ({ k: 'js', n: a[0], d: a[1] }));
  const BOILER = '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Document</title>\n</head>\n<body>\n  \n</body>\n</html>\n';
  const TNAMES = new Set(TG.filter(t => /^[a-z]/.test(t.n)).map(t => t.n));

  /* ---------- Syntax highlighting ---------- */
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sp = (c, s) => s ? '<span class="hl-' + c + '">' + esc(s) + '</span>' : '';
  const KW = new Set('var let const function return if else for while do switch case break continue new this typeof class try catch finally throw in of async await default'.split(' '));
  const LIT = new Set(['true', 'false', 'null', 'undefined', 'NaN']);
  function hlJS(s) {
    let o = '', m; const re = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?|\b\d[\d.]*\b|[A-Za-z_$][\w$]*|[\s\S]/g;
    while ((m = re.exec(s))) {
      const t = m[0], c = t[0];
      if (c === '/' && (t[1] === '/' || t[1] === '*')) o += sp('c', t);
      else if (c === '"' || c === "'" || c === '`') o += sp('st', t);
      else if (/\d/.test(c)) o += sp('n', t);
      else if (/[A-Za-z_$]/.test(c)) o += KW.has(t) ? sp('k', t) : LIT.has(t) ? sp('n', t) : s[re.lastIndex] === '(' ? sp('f', t) : esc(t);
      else o += esc(t);
    }
    return o;
  }
  function hlCSS(s) {
    let o = '', d = 0, val = false, m; const re = /\/\*[\s\S]*?(?:\*\/|$)|"[^"\n]*"?|'[^'\n]*'?|[{}:;]|[^{}:;"'\/]+|\//g;
    while ((m = re.exec(s))) {
      const t = m[0], c = t[0];
      if (c === '/' && t[1] === '*') o += sp('c', t);
      else if (c === '"' || c === "'") o += sp('st', t);
      else if (c === '{') { d++; val = false; o += sp('pc', t); }
      else if (c === '}') { d = d > 0 ? d - 1 : 0; val = false; o += sp('pc', t); }
      else if (c === ':' && d > 0 && !val) { val = true; o += sp('pc', t); }
      else if (c === ';') { val = false; o += sp('pc', t); }
      else if (d === 0) o += sp('s', t);
      else if (!val) o += sp('p', t);
      else o += t.replace(/(#[0-9a-fA-F]{3,8}\b|-?\d*\.?\d+(?:px|em|rem|%|vh|vw|s|ms|deg|fr)?)|([^#\d.-]+|[\s\S])/g, (_, a, b) => a ? sp('n', a) : esc(b));
    }
    return o;
  }
  function hlHTML(s) {
    const n = s.length, low = s.toLowerCase(); let o = '', i = 0, m;
    const T = /<(\/?)(!?[A-Za-z][\w:-]*)/y, W = /\s+/y, AN = /[^\s=>\/"']+/y;
    while (i < n) {
      if (s[i] !== '<') { let e = s.indexOf('<', i); if (e < 0) e = n; o += sp('tx', s.slice(i, e)); i = e; continue; }
      if (s.startsWith('<!--', i)) { let e = s.indexOf('-->', i + 4); e = e < 0 ? n : e + 3; o += sp('c', s.slice(i, e)); i = e; continue; }
      T.lastIndex = i; m = T.exec(s);
      if (!m) { o += sp('tx', '<'); i++; continue; }
      o += sp('br', '<' + m[1]) + sp('tag', m[2]); i = T.lastIndex;
      const nm = m[2].toLowerCase(); let eq = false;
      while (i < n && s[i] !== '>') {
        const c = s[i];
        if (/\s/.test(c)) { W.lastIndex = i; W.exec(s); o += s.slice(i, W.lastIndex); i = W.lastIndex; }
        else if (c === '/' || c === '?') { o += sp('br', c); i++; }
        else if (c === '=') { o += sp('eq', c); i++; eq = true; }
        else if (c === '"' || c === "'") { let e = s.indexOf(c, i + 1); e = e < 0 ? n : e + 1; o += sp('v', s.slice(i, e)); i = e; eq = false; }
        else { AN.lastIndex = i; const mm = AN.exec(s); if (mm) { o += sp(eq ? 'v' : 'a', mm[0]); i = AN.lastIndex; eq = false; } else { o += esc(c); i++; } }
      }
      if (i < n) { o += sp('br', '>'); i++; if (!m[1] && (nm === 'script' || nm === 'style')) { let e = low.indexOf('</' + nm, i); if (e < 0) e = n; const inner = s.slice(i, e); o += nm === 'style' ? hlCSS(inner) : hlJS(inner); i = e; } }
    }
    return o;
  }

  /* ---------- State ---------- */
  let F = store.get('acec_cp', null); if (!F || !NAMES.every(k => typeof F[k] === 'string')) F = { ...EX.hello };
  let cur = 'index.html', auto = store.get('acec_cp_auto', true), fs = store.get('acec_cp_fs', 14), cw = 8.4, lh = 22, busy = false, rt, st, items = [], sel = 0, popFrom = 0, lastLn = -1;
  const lang = () => cur.endsWith('.css') ? 'css' : cur.endsWith('.js') ? 'js' : 'html';
  const hi = () => document.documentElement.lang === 'hi' ? 1 : 0;
  const coarse = matchMedia('(pointer:coarse)').matches;

  function setFs(n) {
    fs = Math.max(coarse ? 16 : 11, Math.min(26, n)); store.set('acec_cp_fs', fs);
    lh = Math.round(fs * 1.6); root.style.setProperty('--fs', fs + 'px'); root.style.setProperty('--lh', lh + 'px');
    cw = meas.getBoundingClientRect().width / 50 || fs * 0.6; draw();
  }

  /* ---------- Render ---------- */
  function draw() {
    const v = ta.value, L = lang();
    pre.innerHTML = (L === 'html' ? hlHTML(v) : L === 'css' ? hlCSS(v) : hlJS(v)) + (v.endsWith('\n') ? ' ' : '');
    lastLn = -1; status(); syncScroll();
  }
  function status() {
    const p = ta.selectionStart, b = ta.value.slice(0, p), ln = b.split('\n').length, col = p - b.lastIndexOf('\n');
    $('#cpPos').textContent = 'Ln ' + ln + ', Col ' + col;
    if (ln !== lastLn) {
      lastLn = ln; const total = ta.value.split('\n').length; let g = '';
      for (let i = 1; i <= total; i++) g += (i === ln ? '<b>' + i + '</b>' : i) + '\n';
      gutIn.innerHTML = g;
    }
    cl.style.top = (10 + (ln - 1) * lh - ta.scrollTop) + 'px';
    syncScroll();
  }
  function syncScroll() {
    pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft;
    gutIn.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)';
    const ln = ta.value.slice(0, ta.selectionStart).split('\n').length;
    cl.style.top = (10 + (ln - 1) * lh - ta.scrollTop) + 'px';
  }

  /* ---------- Open file / tabs ---------- */
  function openFile(name, focus) {
    cur = name; ta.value = F[name]; ta.scrollTop = ta.scrollLeft = 0;
    $$('#vsc [data-f]').forEach(b => b.classList.toggle('on', b.dataset.f === name));
    $('#cpTitle').textContent = name + ' — Coding Practice'; $('#cpLang').textContent = LN[lang()]; $('#cpOutName').textContent = name;
    hide(); draw(); if (focus) ta.focus();
  }
  root.addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) openFile(b.dataset.f, true); });

  /* ---------- Run / output ---------- */
  function build(quiet, clean) {
    let h = F['index.html'];
    const st = '<style>' + F['style.css'].replace(/<\/style/gi, '<\\/style') + '</style>', sc = '<script>' + F['script.js'].replace(/<\/script/gi, '<\\/script') + '<\/script>';
    let u1 = false, u2 = false;
    h = h.replace(/<link[^>]*href=["']?\.?\/?style\.css["']?[^>]*>/i, () => { u1 = true; return st; });
    h = h.replace(/<script[^>]*src=["']?\.?\/?script\.js["']?[^>]*>\s*<\/script>/i, () => { u2 = true; return sc; });
    if (!u1) h = /<\/head>/i.test(h) ? h.replace(/<\/head>/i, () => st + '</head>') : st + h;
    if (!u2) h = /<\/body>/i.test(h) ? h.replace(/<\/body>/i, () => sc + '</body>') : h + sc;
    if (clean) return h;
    const boot = '<script>(function(){var Q=' + (quiet ? 1 : 0) + ',P=function(t,a){try{parent.postMessage({cp:1,t:t,m:a.map(function(x){try{return typeof x==="object"?JSON.stringify(x):String(x)}catch(e){return String(x)}}).join(" ")},"*")}catch(e){}};["log","warn","error","info"].forEach(function(k){var o=console[k];console[k]=function(){P(k,[].slice.call(arguments));o.apply(console,arguments)}});window.addEventListener("error",function(e){P("error",[e.message+" (line "+e.lineno+")"])});window.addEventListener("unhandledrejection",function(e){P("error",[String(e.reason)])});if(Q){window.alert=function(m){P("info",["alert: "+m])};window.confirm=function(m){P("info",["confirm: "+m]);return true};window.prompt=function(m,d){P("info",["prompt: "+m]);return d||""}}})()<\/script>';
    const re = /<head[^>]*>/i, re2 = /<html[^>]*>/i, re3 = /<!doctype[^>]*>/i;
    return re.test(h) ? h.replace(re, x => x + boot) : re2.test(h) ? h.replace(re2, x => x + boot) : re3.test(h) ? h.replace(re3, x => x + boot) : boot + h;
  }
  function run(manual) { con.innerHTML = ''; $('#cpCnt').textContent = '0'; fr.srcdoc = build(!manual); }
  function sched() {
    clearTimeout(st); st = setTimeout(() => store.set('acec_cp', F), 600);
    if (auto) { clearTimeout(rt); rt = setTimeout(() => run(false), 350); }
  }
  addEventListener('message', e => {
    if (e.source !== fr.contentWindow || !e.data || !e.data.cp) return;
    const d = document.createElement('div'); d.className = e.data.t; d.textContent = '› ' + e.data.m; con.appendChild(d); con.scrollTop = con.scrollHeight;
    $('#cpCnt').textContent = con.children.length;
  });

  /* ---------- Edit helper (keeps native undo) ---------- */
  function ins(txt, a, b, caret) {
    if (a == null) { a = ta.selectionStart; b = ta.selectionEnd; }
    ta.focus(); ta.setSelectionRange(a, b); let ok = false;
    try { ok = document.execCommand('insertText', false, txt); } catch (e) { }
    if (!ok) { ta.setRangeText(txt, a, b, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    if (caret != null) { const p = a + caret; ta.setSelectionRange(p, p); }
  }
  function openTag(text) {
    text = text.replace(/<!--[\s\S]*?-->/g, ''); const stack = []; let m; const re = /<(\/?)([a-zA-Z][\w-]*)[^<>]*?(\/?)>/g;
    while ((m = re.exec(text))) {
      const n = m[2].toLowerCase();
      if (m[1]) { const k = stack.lastIndexOf(n); if (k >= 0) stack.length = k; }
      else if (!m[3] && !VOID.has(n)) stack.push(n);
    }
    return stack.length ? stack[stack.length - 1] : null;
  }
  const inTag = b => { const lt = b.lastIndexOf('<'); return lt >= 0 && b.lastIndexOf('>') < lt; };

  /* ---------- Auto close / auto pair (works with phone keyboards too) ---------- */
  function typed(ch) {
    const p = ta.selectionStart, v = ta.value, L = lang(), nx = v[p], pv = v[p - 2] || '';
    if (')]}"\'`'.includes(ch) && nx === ch) { // type over closing char
      ta.setRangeText('', p, p + 1, 'end'); return;
    }
    if (L === 'html') {
      const b = v.slice(0, p);
      if (ch === '>') {
        const m = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/.exec(b);
        if (m && !/\/>$/.test(b) && !VOID.has(m[1].toLowerCase()) && v.slice(p, p + m[1].length + 3).toLowerCase() !== '</' + m[1].toLowerCase() + '>') ins('</' + m[1] + '>', p, p, 0);
      } else if (ch === '/' && v[p - 2] === '<') { const n = openTag(v.slice(0, p - 2)); if (n) ins(n + '>', p, p); }
      else if ((ch === '"' || ch === "'") && inTag(b) && !/\w/.test(pv) && (!nx || /[\s>\/]/.test(nx))) ins(ch, p, p, 0);
      return;
    }
    if (PAIR[ch] && !(PAIR[ch] === ch && /\w/.test(pv)) && (!nx || /[\s)\]};,:]/.test(nx))) ins(PAIR[ch], p, p, 0);
  }

  /* ---------- Suggestions ---------- */
  const starts = (a, pre) => a.n.toLowerCase().startsWith(pre.toLowerCase());
  function suggest() {
    const p = ta.selectionStart, v = ta.value, L = lang(); if (ta.selectionEnd !== p || document.activeElement !== ta) return hide();
    const b = v.slice(0, p); let list = [], pf = '', m;
    if (L === 'html') {
      const lt = b.lastIndexOf('<');
      if (lt >= 0 && b.lastIndexOf('>') < lt) {
        const seg = b.slice(lt + 1);
        if ((m = /^(!?[A-Za-z][\w-]*|!-*|)$/.exec(seg))) { pf = m[1]; list = pf ? TG.filter(t => starts(t, pf)) : TG.filter(t => 'div p h1 a img ul li table form input button span'.split(' ').includes(t.n)); }
        else if (/^[A-Za-z][\w-]*\s/.test(seg)) { const r = seg.replace(/"[^"]*"|'[^']*'/g, 'Q'); if (!/["']/.test(r) && !/=\s*[\w-]*$/.test(r) && (m = /\s([\w-]+)$/.exec(r))) { pf = m[1]; list = AT.filter(t => starts(t, pf)); } }
      }
    } else if (L === 'css') {
      const depth = (b.match(/{/g) || []).length - (b.match(/}/g) || []).length;
      if (depth > 0) {
        const s = b.slice(Math.max(b.lastIndexOf('{'), b.lastIndexOf(';'), b.lastIndexOf('}')) + 1);
        if ((m = /^\s*([\w-]+)$/.exec(s))) { pf = m[1]; list = CP.filter(t => starts(t, pf)); }
        else if ((m = /^\s*([\w-]+)\s*:\s*([\w-]*)$/.exec(s)) && VAL[m[1]]) { pf = m[2]; list = VAL[m[1]].split(' ').map(x => ({ k: 'css', n: x, d: '', s: x + (v[p] === ';' ? '' : ';') })).filter(t => starts(t, pf)); }
      }
    } else {
      const ln = b.slice(b.lastIndexOf('\n') + 1);
      if (!/\/\//.test(ln) && !((ln.match(/["'`]/g) || []).length % 2) && (m = /([A-Za-z_$][\w$.]*)$/.exec(b)) && m[1].length >= 2) {
        pf = m[1]; list = JS.filter(t => starts(t, pf));
        const d = pf.lastIndexOf('.'); if (!list.length && d >= 0) { pf = pf.slice(d + 1); list = pf ? MEM.filter(t => starts(t, pf)) : []; }
      }
    }
    list = list.slice(0, 9);
    if (!list.length) return hide();
    items = list; sel = 0; popFrom = p - pf.length; showPop();
  }
  function showPop() {
    const ic = { tag: '&lt;&gt;', attr: 'a=', css: '{ }', js: 'ƒ' };
    pop.innerHTML = items.map((t, i) => '<div class="vsc-it' + (i === sel ? ' on' : '') + '" data-i="' + i + '"><i class="k-' + t.k + '">' + ic[t.k] + '</i><b>' + esc(t.n) + '</b><span>' + esc((t.d || '').split('|')[hi()] || (t.d || '').split('|')[0]) + '</span></div>').join('') +
      '<div class="vsc-ph">↑↓ select · <b>Tab</b> / Enter = write · Esc = close</div>';
    pop.classList.add('on'); place();
  }
  function place() {
    const p = popFrom, b = ta.value.slice(0, p), ln = b.split('\n').length - 1, col = p - b.lastIndexOf('\n') - 1;
    const x = 8 + col * cw - ta.scrollLeft, y = 10 + (ln + 1) * lh - ta.scrollTop;
    pop.style.left = Math.max(4, Math.min(x, code.clientWidth - pop.offsetWidth - 4)) + 'px';
    pop.style.top = Math.max(2, y + pop.offsetHeight > code.clientHeight ? y - lh - pop.offsetHeight : y) + 'px';
  }
  function hide() { pop.classList.remove('on'); items = []; }
  const isOpen = () => pop.classList.contains('on') && items.length;
  function accept(t) {
    const p = ta.selectionStart, v = ta.value; let s = t.s, b = p;
    if (t.k === 'tag') { s = t.s || (VOID.has(t.n) ? t.n + '>' : t.n + '>$0</' + t.n + '>'); if (v[b] === '>') b++; }
    else if (!s) s = t.n;
    const c = s.indexOf('$0'); s = s.replace('$0', ''); hide(); ins(s, popFrom, b, c < 0 ? s.length : c);
  }
  pop.addEventListener('mousedown', e => e.preventDefault());
  pop.addEventListener('click', e => { const r = e.target.closest('.vsc-it'); if (r) { accept(items[+r.dataset.i]); ta.focus(); } });

  /* ---------- Keyboard ---------- */
  function indent(back) {
    const v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, s = v.lastIndexOf('\n', a - 1) + 1; let e = v.indexOf('\n', b > a && v[b - 1] === '\n' ? b - 1 : b); if (e < 0) e = v.length;
    const out = v.slice(s, e).split('\n').map(l => back ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l).join('\n'); ins(out, s, e); ta.setSelectionRange(s, s + out.length);
  }
  function comment() {
    const L = lang(), [o, c] = L === 'html' ? ['<!-- ', ' -->'] : L === 'css' ? ['/* ', ' */'] : ['// ', ''], v = ta.value, a = ta.selectionStart, b = ta.selectionEnd, s = v.lastIndexOf('\n', a - 1) + 1; let e = v.indexOf('\n', b); if (e < 0) e = v.length;
    const lines = v.slice(s, e).split('\n'), all = lines.every(l => !l.trim() || l.trim().startsWith(o.trim()));
    const out = lines.map(l => {
      if (!l.trim()) return l; const ind = /^\s*/.exec(l)[0]; let t = l.slice(ind.length);
      if (all) { t = t.startsWith(o) ? t.slice(o.length) : t.slice(o.trim().length); if (c) t = t.replace(new RegExp('\\s?' + c.trim().replace(/[*\/]/g, '\\$&') + '$'), ''); return ind + t; }
      return ind + o + t + c;
    }).join('\n'); ins(out, s, e, out.length);
  }
  ta.addEventListener('keydown', e => {
    const p = ta.selectionStart, v = ta.value, L = lang(), k = e.key;
    if ((e.ctrlKey || e.metaKey) && k === 'Enter') { e.preventDefault(); run(true); return; }
    if ((e.ctrlKey || e.metaKey) && k.toLowerCase() === 's') { e.preventDefault(); store.set('acec_cp', F); toast('Saved ✔'); return; }
    if ((e.ctrlKey || e.metaKey) && k === '/') { e.preventDefault(); comment(); return; }
    if (isOpen()) {
      if (k === 'ArrowDown' || k === 'ArrowUp') { e.preventDefault(); sel = (sel + (k === 'ArrowDown' ? 1 : items.length - 1)) % items.length; showPop(); pop.children[sel].scrollIntoView({ block: 'nearest' }); return; }
      if (k === 'Tab' || k === 'Enter') { e.preventDefault(); accept(items[sel]); return; }
      if (k === 'Escape') { e.preventDefault(); hide(); return; }
    }
    if (k === 'Tab') {
      e.preventDefault();
      if (ta.selectionEnd !== p || e.shiftKey) { indent(e.shiftKey); return; }
      if (L === 'html' && !inTag(v.slice(0, p))) { // emmet-lite: type  div + Tab  or  !  + Tab
        const m = /(^|[\s>])(!|[a-zA-Z][a-zA-Z0-9]*)$/.exec(v.slice(0, p));
        if (m) {
          const w = m[2], a = p - w.length;
          if (w === '!') { const ind = /^[ \t]*/.exec(v.slice(v.lastIndexOf('\n', a - 1) + 1))[0]; const t = BOILER.replace(/\n$/, '').split('\n').join('\n' + ind), c = t.indexOf('\n' + ind + '  \n'); ins(t, a, p, c + ind.length + 3); return; }
          if (TNAMES.has(w.toLowerCase())) { const t = TG.find(x => x.n === w.toLowerCase()), s = t.s || (VOID.has(t.n) ? t.n + '>' : t.n + '>$0</' + t.n + '>'), c = s.indexOf('$0'), r = s.replace('$0', ''); ins('<' + r, a, p, 1 + (c < 0 ? r.length : c)); return; }
        }
      }
      ins('  '); return;
    }
    if (k === 'Enter' && !e.ctrlKey && !e.altKey) {
      e.preventDefault(); const ls = v.lastIndexOf('\n', p - 1) + 1, ind = /^[ \t]*/.exec(v.slice(ls, p))[0], pc = v[p - 1], nc = v[p]; let open = false, close = false;
      if (pc && '{[('.includes(pc)) { open = true; close = nc === PAIR[pc]; }
      else if (L === 'html' && pc === '>') { const m = /<([a-zA-Z][\w-]*)(?:\s[^<>]*)?>$/.exec(v.slice(ls, p)); if (m && !VOID.has(m[1].toLowerCase()) && !/\/>$/.test(v.slice(ls, p))) { open = true; close = v.slice(p, p + 2) === '</'; } }
      if (open && close) ins('\n' + ind + '  \n' + ind, p, ta.selectionEnd, ind.length + 3); else ins('\n' + ind + (open ? '  ' : ''), p, ta.selectionEnd);
      return;
    }
    if (k === 'Backspace' && ta.selectionEnd === p && p > 0 && PAIR[v[p - 1]] === v[p] && (L !== 'html' || '"\''.includes(v[p]))) { e.preventDefault(); ins('', p - 1, p + 1); return; }
  });
  ta.addEventListener('input', e => {
    F[cur] = ta.value;
    if (!busy && e.data && e.data.length === 1 && /^insert(Composition)?Text$/.test(e.inputType || 'insertText')) { busy = true; try { typed(e.data); } finally { busy = false; } }
    F[cur] = ta.value; draw(); suggest(); sched();
  });
  ta.addEventListener('scroll', () => { syncScroll(); if (isOpen()) place(); });
  ta.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== ta) hide(); }, 150));
  ['click', 'keyup'].forEach(ev => ta.addEventListener(ev, () => { status(); if (ev === 'click') hide(); }));
  document.addEventListener('selectionchange', () => { if (document.activeElement === ta) status(); });
  $('.vsc-gut', root).addEventListener('click', () => ta.focus());

  /* ---------- Phone symbol bar + keyboard ---------- */
  const SYMS = ['Tab', '<', '>', '/', '=', '"', "'", '!', '(', ')', '{', '}', '[', ']', ';', ':', '.', ',', '#', '-', '_', '&', '+', '*', '$', '%', '@', '\\', '|', '?', '`', '~', '^', '←', '→'];
  sym.innerHTML = SYMS.map(s => '<button type="button" tabindex="-1"' + (s.length > 1 ? ' class="w"' : '') + ' data-s="' + esc(s).replace(/"/g, '&quot;') + '">' + esc(s) + '</button>').join('');
  sym.addEventListener('mousedown', e => e.preventDefault());
  sym.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const s = b.dataset.s; ta.focus();
    if (s === 'Tab') ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    else if (s === '←' || s === '→') { const p = ta.selectionStart + (s === '←' ? -1 : 1); ta.setSelectionRange(Math.max(0, p), Math.max(0, p)); status(); }
    else ins(s);
  });
  const vv = window.visualViewport, small = matchMedia('(hover:none),(max-width:1000px)');
  function kb() {
    const on = document.activeElement === ta && small.matches; sym.classList.toggle('kb', on);
    sym.style.bottom = on && vv ? Math.max(0, innerHeight - vv.height - vv.offsetTop) + 'px' : '';
  }
  ta.addEventListener('focus', kb); ta.addEventListener('blur', () => setTimeout(kb, 120));
  if (vv) { vv.addEventListener('resize', kb); vv.addEventListener('scroll', kb); }
  $('#cpKb').onclick = () => ta.focus();

  /* ---------- Toolbar ---------- */
  const loadEx = k => { F = { ...EX[k] }; store.set('acec_cp', F); openFile(cur, true); run(true); };
  $('#cpRun').onclick = () => run(true);
  $('#cpEx').onchange = e => { const k = e.target.value; e.target.value = ''; if (k && confirm('Current code replace ho jayega. Continue?')) loadEx(k); };
  $('#cpReset').onclick = () => { if (confirm('Sab code reset karke starter code laga du?')) loadEx('hello'); };
  $('#cpFsM').onclick = () => setFs(fs - 1); $('#cpFsP').onclick = () => setFs(fs + 1);
  $('#cpCopy').onclick = () => { const t = ta.value; (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).catch(() => { ta.select(); document.execCommand('copy'); }).then(() => toast('Copied ✔'), () => toast('Copied ✔')); };
  $('#cpDl').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([build(false, true)], { type: 'text/html' })); a.download = 'my-page.html'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 600); };
  $('#cpNew').onclick = () => window.open(URL.createObjectURL(new Blob([build(false, true)], { type: 'text/html' })), '_blank');
  $('#cpClr').onclick = () => { con.innerHTML = ''; $('#cpCnt').textContent = '0'; };
  $('#cpAuto').onclick = () => { auto = !auto; store.set('acec_cp_auto', auto); $('#cpAuto').textContent = '⚡ Live: ' + (auto ? 'ON' : 'OFF'); if (auto) run(false); };
  $('#cpFull').onclick = () => { const f = root.classList.toggle('full'); document.body.style.overflow = f ? 'hidden' : ''; $('#cpFull').textContent = f ? '✕' : '⛶'; setTimeout(draw, 50); };
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('full') && !isOpen()) $('#cpFull').click(); });
  const tb = $('#cpTheme'), syn = () => { tb.textContent = document.documentElement.dataset.theme === 'light' ? '🌙 Dark' : '☀️ Light'; };
  new MutationObserver(syn).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); syn();
  tb.onclick = () => setTheme(theme === 'dark' ? 'light' : 'dark');
  $('#cpAuto').textContent = '⚡ Live: ' + (auto ? 'ON' : 'OFF');

  /* ---------- Init ---------- */
  setFs(fs); openFile('index.html', false); run(false);
})();

/* =====================================================================
   🔫 FREE FIRE STYLE 3D TYPING SHOOTER  (Typing section ka 6th tab)
   - Pseudo-3D canvas world (perspective projection), Mini-Map, On-screen arrow controls
   - 1 word = 5 coins | 5 words = weapon auto change | Grenade = saare words ek saath
   - Drop Store (weapons + nades), Character (Male/Female), Outfit Shop
   - 3 galat key tak theek, 4th galat key ya 3 failed chances = Game Over | 100 words = Mission Complete
   ===================================================================== */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const root = $('ffg'), tabs = $('tgTabs'), btn = $('ffTabBtn');
  if (!root || !tabs || !btn) return;
  const orig = document.querySelector('#typing .game:not(.tgx)'), box = $('tgx');
  const cv = $('ffCv'), cx = cv.getContext('2d'), W = cv.width, H = cv.height;
  const mapCv = $('ffMap'), mx = mapCv.getContext('2d'), MW = mapCv.width;
  const inp = $('ffInp'), ov = $('ffOv'), ovT = ov.querySelector('h3'), ovP = ov.querySelector('.ff-ovp'), goBtn = $('ffGo');
  const FONT = "'Poppins','Noto Sans Devanagari',sans-serif";

  /* ---------- helpers ---------- */
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ri = (a, b) => Math.floor(rnd(a, b + 1));
  const pickOf = a => a[Math.floor(Math.random() * a.length)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const normA = a => { a %= TAU; if (a > Math.PI) a -= TAU; if (a < -Math.PI) a += TAU; return a; };
  const mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  const rgbOf = hex => { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const HAZE = rgbOf('#c4708a');
  /* amt: -1..1 (dark..light), fog: 0..1 (haze blend) */
  const shade = (hex, amt, fog) => {
    const c = rgbOf(hex), t = amt < 0 ? 0 : 255, p = Math.abs(amt || 0);
    const r = c.map((v, i) => { let x = (t - v) * p + v; if (fog) x = (HAZE[i] - x) * fog + x; return Math.round(x); });
    return 'rgb(' + r[0] + ',' + r[1] + ',' + r[2] + ')';
  };
  const rrect = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  /* limb: ek tapering "haath/pair" ka hissa (s0..s1 = line ka kaun sa hissa) */
  const limb = (c, ax, ay, bx, by, w0, w1, col, s0, s1) => {
    s0 = s0 || 0; s1 = s1 == null ? 1 : s1;
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    const wa = w0 + (w1 - w0) * s0, wb = w0 + (w1 - w0) * s1;
    const ax1 = ax + dx * s0, ay1 = ay + dy * s0, bx1 = ax + dx * s1, by1 = ay + dy * s1;
    c.beginPath(); c.moveTo(ax1 + nx * wa / 2, ay1 + ny * wa / 2); c.lineTo(bx1 + nx * wb / 2, by1 + ny * wb / 2);
    c.lineTo(bx1 - nx * wb / 2, by1 - ny * wb / 2); c.lineTo(ax1 - nx * wa / 2, ay1 - ny * wa / 2); c.closePath(); c.fillStyle = col; c.fill();
  };

  /* ---------- save data ---------- */
  const KEY = 'acec_ff_save_v1';
  const defS = () => ({ coins: 0, owned: ['m1873', 'mp40'], weapon: 'm1873', nades: 1, outfits: ['default'], outfit: 'default', gender: 'male', best: 0, wins: 0, mute: false });
  let S = defS();
  try { const j = JSON.parse(localStorage.getItem(KEY) || 'null'); if (j && typeof j === 'object') S = Object.assign(defS(), j); } catch (e) { }
  if (!Array.isArray(S.owned)) S.owned = ['m1873', 'mp40'];
  if (!Array.isArray(S.outfits) || !S.outfits.includes('default')) S.outfits = ['default'].concat(S.outfits || []);
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } };

  /* ---------- sound (WebAudio, koi file nahi chahiye) ---------- */
  let AC = null;
  const ac = () => { if (S.mute) return null; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); } catch (e) { return null; } return AC; };
  const tone = (f1, f2, dur, type, vol) => { const a = ac(); if (!a) return; const o = a.createOscillator(), g = a.createGain(), t = a.currentTime; o.type = type || 'square'; o.frequency.setValueAtTime(f1, t); o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur); g.gain.setValueAtTime(vol || .06, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur); };
  const noise = (dur, vol) => { const a = ac(); if (!a) return; const n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = a.createBufferSource(), g = a.createGain(); s.buffer = b; g.gain.value = vol || .2; s.connect(g); g.connect(a.destination); s.start(); };
  const SFX = {
    shot() { noise(.12, .22); tone(240, 60, .12, 'sawtooth', .08); }, key() { tone(820, 820, .025, 'square', .02); },
    wrong() { tone(170, 80, .2, 'sawtooth', .08); }, boom() { noise(.7, .5); tone(120, 30, .55, 'sine', .22); },
    hit() { noise(.35, .3); tone(200, 50, .4, 'sawtooth', .12); }, coin() { tone(1100, 1700, .1, 'square', .04); },
    win() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, f, .22, 'triangle', .1), i * 140)); },
    over() { [330, 262, 196, 130].forEach((f, i) => setTimeout(() => tone(f, f * .9, .25, 'sawtooth', .08), i * 170)); }
  };

  /* ---------- game data ---------- */
  const WORLD = 58, FOV = 1.22, F = (W / 2) / Math.tan(FOV / 2), HOR = H * .44, CAMH = 1.65, NEAR = .35, WIN = 100, MAXWRONG = 3, MAXFAIL = 3;

  const WEAPONS = [
    { id: 'm1873', name: 'M1873', type: 'Pistol', price: 0, col: '#9aa5b1', acc: '#3a3f47', len: 40, bw: 13, rw: 46, rh: 92, mag: 0 },
    { id: 'mp40', name: 'MP40', type: 'SMG', price: 0, col: '#6b7280', acc: '#2f3640', len: 70, bw: 11, rw: 48, rh: 140, mag: 1 },
    { id: 'ump', name: 'UMP', type: 'SMG', price: 60, col: '#4b5563', acc: '#ffb703', len: 72, bw: 12, rw: 52, rh: 150, mag: 1 },
    { id: 'm1014', name: 'M1014', type: 'Shotgun', price: 100, col: '#374151', acc: '#a16207', len: 108, bw: 14, rw: 50, rh: 130, mag: 0, dbl: true },
    { id: 'deagle', name: 'Desert Eagle', type: 'Pistol', price: 120, col: '#d4af37', acc: '#1f2937', len: 50, bw: 15, rw: 48, rh: 95, mag: 0 },
    { id: 'ak47', name: 'AK47', type: 'Assault Rifle', price: 150, col: '#7c4a1e', acc: '#1f2937', len: 120, bw: 12, rw: 50, rh: 150, mag: 2 },
    { id: 'm4a1', name: 'M4A1', type: 'Assault Rifle', price: 180, col: '#2d3748', acc: '#38bdf8', len: 125, bw: 12, rw: 50, rh: 150, mag: 1 },
    { id: 'scar', name: 'SCAR', type: 'Assault Rifle', price: 200, col: '#8b7d5a', acc: '#111827', len: 125, bw: 13, rw: 52, rh: 150, mag: 1 },
    { id: 'groza', name: 'Groza', type: 'Assault Rifle', price: 250, col: '#1f2937', acc: '#ef4444', len: 130, bw: 13, rw: 54, rh: 155, mag: 1 },
    { id: 'awm', name: 'AWM', type: 'Sniper', price: 300, col: '#1b4332', acc: '#d8f3dc', len: 165, bw: 11, rw: 46, rh: 160, mag: 0, scope: true }
  ];
  const NADES = [
    { id: 'n1', name: 'Frag Grenade', qty: 1, price: 40 },
    { id: 'n3', name: 'Grenade Pack', qty: 3, price: 100 },
    { id: 'n5', name: 'Nade Crate', qty: 5, price: 150 }
  ];
  const OUTFITS = [
    { id: 'default', name: 'Black Pant & White Shirt', price: 0, top: '#f4f4f2', pant: '#121212', shoe: '#1c1c1c', sleeve: 'short', hat: null, extra: 'shirt' },
    { id: 'denim', name: 'Blue Jeans & Red Tee', price: 60, top: '#d62839', pant: '#2d5fa8', shoe: '#f1f1f1', sleeve: 'short', hat: 'cap', cap: '#d62839', extra: null },
    { id: 'camo', name: 'Jungle Camo Soldier', price: 80, top: '#4b5d34', pant: '#3a4a28', shoe: '#2b2b2b', sleeve: 'long', hat: 'helmet', extra: 'camo' },
    { id: 'ninja', name: 'Shadow Ninja', price: 120, top: '#17171f', pant: '#101015', shoe: '#0a0a0a', sleeve: 'long', hat: 'mask', band: '#d62839', extra: null },
    { id: 'racer', name: 'Neon Racer Suit', price: 150, top: '#00c2e0', pant: '#6d28d9', shoe: '#ffffff', sleeve: 'long', hat: 'cap', cap: '#6d28d9', extra: 'stripe' },
    { id: 'desert', name: 'Desert Commando', price: 180, top: '#c9a35b', pant: '#8a6d3b', shoe: '#4a3a22', sleeve: 'long', hat: 'bandana', band: '#7a2e1d', extra: 'vest' },
    { id: 'gold', name: 'Royal Gold Tracksuit', price: 250, top: '#ffcc33', pant: '#e8a317', shoe: '#ffffff', sleeve: 'long', hat: null, extra: 'stripe' }
  ];
  const WP = id => WEAPONS.find(w => w.id === id) || WEAPONS[0];
  const OUT = () => OUTFITS.find(o => o.id === S.outfit) || OUTFITS[0];
  if (!WEAPONS.some(w => w.id === S.weapon && S.owned.includes(w.id))) S.weapon = S.owned[0] || 'm1873';
  if (!OUTFITS.some(o => o.id === S.outfit && S.outfits.includes(o.id))) S.outfit = 'default';

  const BASE = ('computer keyboard internet python memory monitor windows network browser storage cursor program shortcut database router server mouse printer scanner laptop desktop tablet mobile android ' +
    'software hardware kernel compiler variable function loop array string integer boolean object class method module package library framework website domain hosting cloud backup update install download upload ' +
    'folder document sheet slide table column formula chart image video audio speaker camera battery cable switch modem wifi bluetooth password username email inbox forward reply delete copy paste undo bold ' +
    'italic font margin border header footer paragraph page layout print preview zoom scroll button icon menu toolbar ribbon dialog window taskbar antivirus firewall malware phishing hacker encrypt binary ' +
    'decimal byte processor cache register pixel display graphics sound search login profile account digital online offline html css java script coding developer tally excel office').split(/\s+/).filter(w => w.length >= 3 && w.length <= 8);
  const LEET = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7' }, SYMM = { a: '@', s: '$', i: '!', o: '0', e: '3', l: '1' };
  function leet(b, map, mn, mx) {
    const idx = []; for (let i = 1; i < b.length; i++) if (map[b[i]]) idx.push(i);
    if (!idx.length) return null;
    idx.sort(() => Math.random() - .5);
    const n = Math.min(idx.length, ri(mn, mx)), a = b.split('');
    for (let k = 0; k < n; k++) a[idx[k]] = map[a[idx[k]]];
    return a.join('');
  }
  /* lvl 0 = simple words | 1 = numbers (score 20+) | 2 = special symbols + numbers (score 50+) */
  function makeWord(lvl) {
    const b = pickOf(BASE);
    if (lvl === 0) return b;
    if (lvl === 1) { const m = Math.random(); if (m < .4) return b + ri(2, 99); if (m < .8) return leet(b, LEET, 1, 2) || b + ri(1, 9); return b + ri(1, 9) + ri(1, 9) + ri(1, 9); }
    let w = leet(b, SYMM, 1, 2) || b;
    const m = Math.random(); w += m < .75 ? pickOf(['#', '!', '@', '$', '&', '*', '%']) + ri(1, 9) : pickOf(['#', '!', '@', '$', '&', '*', '%']);
    return w;
  }
  const ECOL = ['#b91c1c', '#1d4ed8', '#15803d', '#7e22ce', '#c2410c', '#0f766e'];

  /* ---------- world scenery (har baar same map) ---------- */
  let seed = 20261106; const sr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const SCN = [];
  for (let i = 0, guard = 0; i < 56 && guard < 400; guard++) {
    const t = sr(), x = (sr() * 2 - 1) * (WORLD - 5), z = (sr() * 2 - 1) * (WORLD - 5);
    if (Math.hypot(x, z) < 10) continue;
    i++;
    if (t < .4) { const w = 1.8 + sr() * 1.6; SCN.push({ k: 'crate', x, z, w, d: w, h: 1.6 + sr() * 1.4, col: ['#8b5a2b', '#a0702f', '#6e4a25'][Math.floor(sr() * 3)], id: i }); }
    else if (t < .72) SCN.push({ k: 'bld', x, z, w: 5 + sr() * 5, d: 5 + sr() * 5, h: 6 + sr() * 9, col: ['#4b5563', '#57534e', '#52525b', '#44403c'][Math.floor(sr() * 4)], id: i });
    else SCN.push({ k: 'tree', x, z, w: 1, d: 1, h: 4 + sr() * 3, id: i });
  }

  /* ---------- state ---------- */
  const P = { x: 0, z: 0, yaw: 0 };
  let sinY = 0, cosY = 1, curW = S.weapon, G = newG(), panel = 'play', looping = false, raf = 0, lastT = 0, active = false, internal = false;
  const ctrl = { up: 0, down: 0, left: 0, right: 0 }, kbd = { up: 0, down: 0, left: 0, right: 0 };
  let drag = null, dragYaw = 0, dragMove = 0;

  function newG() {
    return { state: 'idle', words: 0, coins: 0, fails: 0, wrong: 0, typed: 0, correct: 0, en: [], lock: null, spawnT: 1, t: 0, time: 0,
      shots: [], parts: [], pops: [], flash: 0, shake: 0, recoil: 0, muzzle: 0, bob: 0, mov: 0, banner: null, nade: 0, seen: {} };
  }

  /* ---------- camera math ---------- */
  const toCam = (x, y, z) => { const dx = x - P.x, dz = z - P.z; return { l: dx * cosY - dz * sinY, y: y - CAMH, d: dx * sinY + dz * cosY }; };
  const proj = c => [W / 2 + c.l / c.d * F, HOR - c.y / c.d * F];
  function clipPoly(pts) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], ain = a.d >= NEAR, bin = b.d >= NEAR;
      if (ain) out.push(a);
      if (ain !== bin) { const t = (NEAR - a.d) / (b.d - a.d); out.push({ l: a.l + (b.l - a.l) * t, y: a.y + (b.y - a.y) * t, d: NEAR }); }
    }
    return out;
  }
  function poly3(verts, fill, stroke) {
    const pts = clipPoly(verts.map(v => toCam(v[0], v[1], v[2])));
    if (pts.length < 3) return;
    cx.beginPath(); pts.forEach((p, i) => { const q = proj(p); i ? cx.lineTo(q[0], q[1]) : cx.moveTo(q[0], q[1]); }); cx.closePath();
    if (fill) { cx.fillStyle = fill; cx.fill(); }
    if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = 1; cx.stroke(); }
  }
  function line3(a, b) {
    let p = toCam(a[0], a[1], a[2]), q = toCam(b[0], b[1], b[2]);
    if (p.d < NEAR && q.d < NEAR) return;
    if (p.d < NEAR) { const t = (NEAR - p.d) / (q.d - p.d); p = { l: p.l + (q.l - p.l) * t, y: p.y + (q.y - p.y) * t, d: NEAR }; }
    else if (q.d < NEAR) { const t = (NEAR - q.d) / (p.d - q.d); q = { l: q.l + (p.l - q.l) * t, y: q.y + (p.y - q.y) * t, d: NEAR }; }
    const a1 = proj(p), b1 = proj(q); cx.moveTo(a1[0], a1[1]); cx.lineTo(b1[0], b1[1]);
  }

  /* =================== SCENE DRAWING =================== */
  function drawSky() {
    let g = cx.createLinearGradient(0, 0, 0, HOR);
    g.addColorStop(0, '#120a2a'); g.addColorStop(.55, '#5b2a6b'); g.addColorStop(1, '#ff9b6a');
    cx.fillStyle = g; cx.fillRect(0, 0, W, HOR + 2);
    // stars
    cx.fillStyle = 'rgba(255,255,255,.7)';
    for (let i = 0; i < 40; i++) { const a = normA(i * 2.399 - P.yaw), sx = W / 2 + a * F * .9, sy = (i * 53 % 97) / 97 * HOR * .6; if (sx > -4 && sx < W + 4) cx.fillRect(sx, sy, 1.6, 1.6); }
    // sun
    const sa = normA(.55 - P.yaw), sx = W / 2 + Math.tan(clamp(sa, -1.4, 1.4)) * F;
    if (Math.abs(sa) < 1.2) { g = cx.createRadialGradient(sx, HOR - 24, 4, sx, HOR - 24, 90); g.addColorStop(0, 'rgba(255,240,180,1)'); g.addColorStop(.25, 'rgba(255,190,90,.8)'); g.addColorStop(1, 'rgba(255,140,80,0)'); cx.fillStyle = g; cx.fillRect(sx - 100, HOR - 130, 200, 130); }
    // mountains (parallax)
    cx.fillStyle = '#2a1840'; cx.beginPath(); cx.moveTo(0, HOR + 1);
    for (let x = 0; x <= W; x += 10) { const a = P.yaw + Math.atan((x - W / 2) / F), h = 26 + 22 * Math.sin(a * 3 + 1) + 14 * Math.sin(a * 7.3 + 2) + 8 * Math.sin(a * 17); cx.lineTo(x, HOR - h); }
    cx.lineTo(W, HOR + 1); cx.closePath(); cx.fill();
  }
  function drawGround() {
    const g = cx.createLinearGradient(0, HOR, 0, H);
    g.addColorStop(0, '#6a3f58'); g.addColorStop(.3, '#3a2440'); g.addColorStop(1, '#1b1126');
    cx.fillStyle = g; cx.fillRect(0, HOR, W, H - HOR);
    cx.beginPath(); cx.strokeStyle = 'rgba(255,183,3,.2)'; cx.lineWidth = 1;
    for (let k = -WORLD; k <= WORLD; k += 8) { line3([k, 0, -WORLD], [k, 0, WORLD]); line3([-WORLD, 0, k], [WORLD, 0, k]); }
    cx.stroke();
  }
  function drawWalls() {
    const hh = 4.2, seg = 8;
    for (let s = 0; s < 4; s++) {
      for (let a = -WORLD; a < WORLD; a += seg) {
        const b = a + seg, alt = (Math.round((a + WORLD) / seg) % 2) === 0;
        let v;
        if (s === 0) v = [[a, 0, WORLD], [b, 0, WORLD], [b, hh, WORLD], [a, hh, WORLD]];
        else if (s === 1) v = [[a, 0, -WORLD], [b, 0, -WORLD], [b, hh, -WORLD], [a, hh, -WORLD]];
        else if (s === 2) v = [[WORLD, 0, a], [WORLD, 0, b], [WORLD, hh, b], [WORLD, hh, a]];
        else v = [[-WORLD, 0, a], [-WORLD, 0, b], [-WORLD, hh, b], [-WORLD, hh, a]];
        const c = toCam((v[0][0] + v[1][0]) / 2, 0, (v[0][2] + v[1][2]) / 2);
        poly3(v, shade(alt ? '#c2410c' : '#431407', 0, clamp((c.d - 20) / 70, 0, .6)), null);
      }
    }
  }
  const FACES = b => {
    const hw = b.w / 2, hd = b.d / 2, h = b.h, x0 = b.x - hw, x1 = b.x + hw, z0 = b.z - hd, z1 = b.z + hd;
    return [
      { vis: P.z < z0, v: [[x0, 0, z0], [x1, 0, z0], [x1, h, z0], [x0, h, z0]], a: -.32, win: true },
      { vis: P.z > z1, v: [[x1, 0, z1], [x0, 0, z1], [x0, h, z1], [x1, h, z1]], a: -.12, win: true },
      { vis: P.x < x0, v: [[x0, 0, z1], [x0, 0, z0], [x0, h, z0], [x0, h, z1]], a: -.5, win: true },
      { vis: P.x > x1, v: [[x1, 0, z0], [x1, 0, z1], [x1, h, z1], [x1, h, z0]], a: 0, win: true },
      { vis: CAMH > h, v: [[x0, h, z0], [x1, h, z0], [x1, h, z1], [x0, h, z1]], a: .18, win: false }
    ];
  };
  function drawBox(b, c) {
    const fog = clamp((c.d - 18) / 55, 0, .65);
    FACES(b).forEach((f, fi) => {
      if (!f.vis) return;
      poly3(f.v, shade(b.col, f.a, fog), 'rgba(0,0,0,.25)');
      if (b.k === 'bld' && f.win && c.d < 48) {
        const v0 = f.v[0], v1 = f.v[1], v3 = f.v[3], wl = Math.hypot(v1[0] - v0[0], v1[2] - v0[2]), cols = Math.max(2, Math.floor(wl / 1.7)), rows = Math.max(2, Math.floor(b.h / 2.3));
        for (let i = 0; i < cols; i++) for (let j = 1; j < rows; j++) {
          const u0 = (i + .22) / cols, u1 = (i + .78) / cols, w0 = (j + .1) / rows, w1 = (j + .6) / rows;
          const P3 = (u, w) => [v0[0] + (v1[0] - v0[0]) * u + (v3[0] - v0[0]) * w, v0[1] + (v3[1] - v0[1]) * w, v0[2] + (v1[2] - v0[2]) * u + (v3[2] - v0[2]) * w];
          const lit = ((b.id * 7 + fi * 13 + i * 5 + j * 11) % 5) < 2;
          poly3([P3(u0, w0), P3(u1, w0), P3(u1, w1), P3(u0, w1)], lit ? shade('#ffd97a', -.05, fog) : shade('#27304a', 0, fog), null);
        }
      }
    });
  }
  function drawTree(b, c) {
    const s = F / c.d, sx = W / 2 + c.l / c.d * F, sy = HOR + CAMH / c.d * F, fog = clamp((c.d - 18) / 55, 0, .65);
    limb(cx, sx, sy, sx, sy - b.h * .5 * s, .5 * s, .4 * s, shade('#5a3a22', 0, fog));
    for (let i = 0; i < 3; i++) {
      const w = (1.9 - i * .45) * s, y0 = sy - (b.h * .32 + i * b.h * .22) * s, hgt = b.h * .34 * s;
      cx.fillStyle = shade(['#14532d', '#166534', '#15803d'][i], -.1, fog); cx.beginPath(); cx.moveTo(sx - w, y0); cx.lineTo(sx + w, y0); cx.lineTo(sx, y0 - hgt); cx.closePath(); cx.fill();
    }
  }
  /* Enemy (Free Fire style human) */
  function drawEnemy(e, sx, sy, s, d) {
    const fog = clamp((d - 20) / 60, 0, .55), sw = Math.sin(G.t * 7 + e.ph) * .2, col = shade(e.col, 0, fog), dark = shade(e.col, -.45, fog), skin = shade('#d9a77c', 0, fog), pant = shade('#1f2937', 0, fog);
    cx.fillStyle = 'rgba(0,0,0,.38)'; cx.beginPath(); cx.ellipse(sx, sy, .42 * s, .11 * s, 0, 0, TAU); cx.fill();
    limb(cx, sx - .11 * s, sy - .85 * s, sx - .13 * s + sw * s * .7, sy, .19 * s, .15 * s, pant);
    limb(cx, sx + .11 * s, sy - .85 * s, sx + .13 * s - sw * s * .7, sy, .19 * s, .15 * s, pant);
    cx.fillStyle = shade('#0b0b0b', 0, fog); cx.fillRect(sx - .24 * s + sw * s * .7, sy - .07 * s, .2 * s, .07 * s); cx.fillRect(sx + .04 * s - sw * s * .7, sy - .07 * s, .2 * s, .07 * s);
    cx.fillStyle = col; rrect(cx, sx - .3 * s, sy - 1.5 * s, .6 * s, .72 * s, .09 * s); cx.fill();
    cx.fillStyle = dark; rrect(cx, sx - .22 * s, sy - 1.42 * s, .44 * s, .4 * s, .05 * s); cx.fill();
    limb(cx, sx - .3 * s, sy - 1.42 * s, sx - .1 * s, sy - 1.08 * s, .15 * s, .12 * s, col);
    limb(cx, sx + .3 * s, sy - 1.42 * s, sx + .16 * s, sy - 1.12 * s, .15 * s, .12 * s, col);
    cx.fillStyle = shade('#111827', 0, fog); cx.fillRect(sx - .12 * s, sy - 1.2 * s, .34 * s, .08 * s);
    cx.fillStyle = skin; cx.beginPath(); cx.arc(sx - .1 * s, sy - 1.08 * s, .06 * s, 0, TAU); cx.arc(sx + .16 * s, sy - 1.12 * s, .06 * s, 0, TAU); cx.fill();
    cx.fillStyle = skin; cx.beginPath(); cx.arc(sx, sy - 1.64 * s, .14 * s, 0, TAU); cx.fill();
    if (e.hat === 'helmet') { cx.fillStyle = dark; cx.beginPath(); cx.arc(sx, sy - 1.68 * s, .16 * s, Math.PI, TAU); cx.fill(); }
    else if (e.hat === 'cap') { cx.fillStyle = col; cx.beginPath(); cx.arc(sx, sy - 1.68 * s, .15 * s, Math.PI, TAU); cx.fill(); cx.fillRect(sx - .16 * s, sy - 1.68 * s, .32 * s, .035 * s); }
    else { cx.fillStyle = '#111'; cx.fillRect(sx - .14 * s, sy - 1.62 * s, .28 * s, .09 * s); }
    cx.fillStyle = '#ff3b3b'; cx.fillRect(sx - .075 * s, sy - 1.66 * s, .05 * s, .03 * s); cx.fillRect(sx + .025 * s, sy - 1.66 * s, .05 * s, .03 * s);
  }
  function drawLabel(L) {
    const e = L.e, locked = G.lock === e, fs = clamp(L.s * .34, 13, 28) * (locked ? 1.12 : 1), near = e.d < 12;
    const y = L.sy - 1.95 * L.s - fs * .9;
    cx.font = '700 ' + fs + 'px ' + FONT; const tw = cx.measureText(e.w).width, pw = tw + 16, ph = fs + 10;
    rrect(cx, L.sx - pw / 2, y - ph / 2, pw, ph, 8);
    cx.fillStyle = locked ? 'rgba(40,25,0,.85)' : 'rgba(8,8,20,.72)'; cx.fill();
    cx.lineWidth = locked ? 2.5 : 1.2; cx.strokeStyle = locked ? '#ffd166' : near ? '#ff5252' : 'rgba(255,255,255,.35)'; cx.stroke();
    cx.textAlign = 'left'; cx.textBaseline = 'middle';
    const done = e.w.slice(0, e.pos), rest = e.w.slice(e.pos), x0 = L.sx - tw / 2, dw = cx.measureText(done).width;
    cx.fillStyle = '#4ade80'; cx.fillText(done, x0, y + 1);
    cx.fillStyle = near ? '#ffb3b3' : '#ffffff'; cx.fillText(rest, x0 + dw, y + 1);
    if (locked) { cx.beginPath(); cx.arc(L.sx, L.sy - .85 * L.s, 1.25 * L.s, 0, TAU); cx.strokeStyle = 'rgba(255,209,102,.7)'; cx.lineWidth = 2; cx.setLineDash([8, 6]); cx.stroke(); cx.setLineDash([]); }
  }

  /* first-person gun + arms (outfit ka sleeve bhi dikhta hai) */
  function drawVM() {
    const w = WP(curW), o = OUT(), skin = '#e0aa82', bob = Math.sin(G.bob) * 5 * G.mov, rec = G.recoil;
    const top = -w.rh, tip = top - w.len, rw = w.rw, bw = w.bw, sleeve = o.top;
    cx.save(); cx.translate(W * .64 + bob * .6, H + 16 + Math.abs(bob) * .7 + rec * 18); cx.rotate(-.4 - rec * .03);
    // left forearm (handguard ko pakadta hua)
    const lx = -2, ly = tip + w.len * .35 + 12;
    limb(cx, lx, ly, lx - 70, ly + 330, 40, 62, o.sleeve === 'long' ? sleeve : skin);
    if (o.sleeve !== 'long') limb(cx, lx, ly, lx - 70, ly + 330, 40, 62, sleeve, .45, 1);
    // gun body
    let g = cx.createLinearGradient(-rw / 2, 0, rw / 2, 0); g.addColorStop(0, shade(w.col, -.5)); g.addColorStop(.5, shade(w.col, .1)); g.addColorStop(1, shade(w.col, -.55));
    cx.beginPath(); cx.moveTo(-rw / 2, 0); cx.lineTo(rw / 2, 0); cx.lineTo(rw * .4, top); cx.lineTo(-rw * .4, top); cx.closePath(); cx.fillStyle = g; cx.fill();
    cx.strokeStyle = w.acc; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(0, -4); cx.lineTo(0, top); cx.stroke();
    // handguard + barrel(s)
    const bars = w.dbl ? [-bw * .62, bw * .62] : [0];
    bars.forEach(bx => {
      g = cx.createLinearGradient(bx - bw / 2, 0, bx + bw / 2, 0); g.addColorStop(0, '#0d1117'); g.addColorStop(.5, '#4b5563'); g.addColorStop(1, '#0d1117');
      cx.beginPath(); cx.moveTo(bx - bw / 2, top); cx.lineTo(bx + bw / 2, top); cx.lineTo(bx + bw * .36, tip); cx.lineTo(bx - bw * .36, tip); cx.closePath(); cx.fillStyle = g; cx.fill();
    });
    cx.fillStyle = shade(w.col, -.35); cx.fillRect(-bw * (w.dbl ? 1.4 : 1.05), top - w.len * .42, bw * (w.dbl ? 2.8 : 2.1), w.len * .42);
    cx.fillStyle = w.acc; cx.fillRect(-2, tip - 9, 4, 12);                        // front sight
    cx.fillRect(-rw * .32, top + 4, 7, 14); cx.fillRect(rw * .32 - 7, top + 4, 7, 14); // rear sight
    if (w.scope) {
      cx.fillStyle = '#0b0f14'; cx.beginPath(); cx.arc(0, top + w.rh * .22, 26, 0, TAU); cx.fill();
      g = cx.createRadialGradient(-6, top + w.rh * .22 - 6, 2, 0, top + w.rh * .22, 22); g.addColorStop(0, '#9be7ff'); g.addColorStop(1, '#0b3a52'); cx.fillStyle = g; cx.beginPath(); cx.arc(0, top + w.rh * .22, 20, 0, TAU); cx.fill();
      cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 1.5; cx.beginPath(); cx.moveTo(-20, top + w.rh * .22); cx.lineTo(20, top + w.rh * .22); cx.moveTo(0, top + w.rh * .22 - 20); cx.lineTo(0, top + w.rh * .22 + 20); cx.stroke();
    }
    // right forearm + hand (grip)
    const hx = rw * .22, hy = -w.rh * .2;
    limb(cx, hx + 6, hy + 10, hx + 120, hy + 300, 46, 70, o.sleeve === 'long' ? sleeve : skin);
    if (o.sleeve !== 'long') limb(cx, hx + 6, hy + 10, hx + 120, hy + 300, 46, 70, sleeve, .4, 1);
    cx.fillStyle = skin; cx.beginPath(); cx.ellipse(hx, hy, 27, 32, .1, 0, TAU); cx.fill();
    cx.strokeStyle = 'rgba(0,0,0,.25)'; cx.lineWidth = 1.5; for (let i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(hx - 24, hy - 12 + i * 11); cx.lineTo(hx + 8, hy - 8 + i * 11); cx.stroke(); }
    cx.fillStyle = skin; cx.beginPath(); cx.ellipse(lx - 2, ly, 24, 22, 0, 0, TAU); cx.fill();
    // muzzle flash
    if (G.muzzle > 0) {
      const a = G.muzzle / .08; cx.save(); cx.translate(0, tip - 4); cx.globalAlpha = clamp(a, 0, 1);
      g = cx.createRadialGradient(0, 0, 2, 0, 0, 46); g.addColorStop(0, '#fff'); g.addColorStop(.35, '#ffd166'); g.addColorStop(1, 'rgba(255,120,0,0)');
      cx.fillStyle = g; cx.beginPath(); for (let i = 0; i < 16; i++) { const r = i % 2 ? 14 : 46, an = i / 16 * TAU; cx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } cx.closePath(); cx.fill(); cx.restore();
    }
    cx.restore();
  }

  /* =================== MAIN RENDER =================== */
  function render() {
    sinY = Math.sin(P.yaw); cosY = Math.cos(P.yaw);
    cx.save();
    if (G.shake > 0) cx.translate(rnd(-1, 1) * G.shake * 12, rnd(-1, 1) * G.shake * 12);
    drawSky(); drawGround(); drawWalls();
    const items = [], labels = [];
    SCN.forEach(b => { const c = toCam(b.x, 0, b.z); if (c.d < -14 || c.d > 125) return; items.push({ d: c.d, fn: () => b.k === 'tree' ? (c.d > NEAR && drawTree(b, c)) : drawBox(b, c) }); });
    G.en.forEach(e => {
      const c = toCam(e.x, 0, e.z); if (c.d < .45) return;
      items.push({ d: c.d, fn: () => { const s = F / c.d, sx = W / 2 + c.l / c.d * F, sy = HOR + CAMH / c.d * F; drawEnemy(e, sx, sy, s, c.d); labels.push({ e, sx, sy, s }); } });
    });
    items.sort((a, b) => b.d - a.d); items.forEach(i => i.fn());
    labels.forEach(drawLabel);
    // tracers
    G.shots.forEach(s => { cx.strokeStyle = 'rgba(255,220,120,' + clamp(s.ttl / .12, 0, 1) + ')'; cx.lineWidth = 3; cx.beginPath(); cx.moveTo(s.x1, s.y1); cx.lineTo(s.x2, s.y2); cx.stroke(); });
    // particles + coin pops
    G.parts.forEach(p => { cx.globalAlpha = clamp(p.life / p.max, 0, 1); cx.fillStyle = p.col; cx.beginPath(); cx.arc(p.x, p.y, p.size, 0, TAU); cx.fill(); });
    cx.globalAlpha = 1;
    G.pops.forEach(p => { cx.globalAlpha = clamp(p.life / .9, 0, 1); cx.font = '800 ' + (p.big ? 26 : 20) + 'px ' + FONT; cx.textAlign = 'center'; cx.fillStyle = '#ffd166'; cx.strokeStyle = 'rgba(0,0,0,.7)'; cx.lineWidth = 3; cx.strokeText(p.t, p.x, p.y); cx.fillText(p.t, p.x, p.y); });
    cx.globalAlpha = 1; cx.restore();

    // off-screen target arrows
    G.en.forEach(e => {
      if (e.vis) return; const left = e.b < 0, x = left ? 26 : W - 26, y = H * .38, danger = e.d < 14;
      cx.fillStyle = danger ? 'rgba(255,60,60,.95)' : 'rgba(255,120,80,.8)'; cx.beginPath();
      if (left) { cx.moveTo(x - 12, y); cx.lineTo(x + 8, y - 16); cx.lineTo(x + 8, y + 16); } else { cx.moveTo(x + 12, y); cx.lineTo(x - 8, y - 16); cx.lineTo(x - 8, y + 16); }
      cx.closePath(); cx.fill(); cx.font = '700 11px ' + FONT; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.fillText(Math.round(e.d) + 'm', x + (left ? 2 : -2), y + 30);
    });
    // damage / grenade flash
    if (G.flash > 0) { const g = cx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, H * .85); g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, 'rgba(255,0,0,' + (G.flash * .7) + ')'); cx.fillStyle = g; cx.fillRect(0, 0, W, H); }
    if (G.nade > 0) { cx.fillStyle = 'rgba(255,255,255,' + clamp(G.nade * .9, 0, .9) + ')'; cx.fillRect(0, 0, W, H); const r = (1 - G.nade) * W * .7; cx.strokeStyle = 'rgba(255,200,100,' + G.nade + ')'; cx.lineWidth = 10 * G.nade; cx.beginPath(); cx.arc(W / 2, HOR, r, 0, TAU); cx.stroke(); }
    if (G.state === 'run' || G.state === 'paused') drawVM();
    else if (G.state === 'idle') drawVM();
    // crosshair
    cx.strokeStyle = G.lock ? '#ffd166' : 'rgba(255,255,255,.85)'; cx.lineWidth = 2; cx.beginPath();
    cx.moveTo(W / 2 - 14, HOR); cx.lineTo(W / 2 - 5, HOR); cx.moveTo(W / 2 + 5, HOR); cx.lineTo(W / 2 + 14, HOR); cx.moveTo(W / 2, HOR - 14); cx.lineTo(W / 2, HOR - 5); cx.moveTo(W / 2, HOR + 5); cx.lineTo(W / 2, HOR + 14); cx.stroke();
    cx.fillStyle = 'rgba(255,255,255,.9)'; cx.fillRect(W / 2 - 1, HOR - 1, 2, 2);
    // banner
    if (G.banner) { cx.globalAlpha = clamp(G.banner.ttl / .5, 0, 1); cx.font = '800 22px ' + FONT; cx.textAlign = 'center'; cx.fillStyle = '#fff'; cx.strokeStyle = 'rgba(0,0,0,.75)'; cx.lineWidth = 4; cx.strokeText(G.banner.t, W / 2, 62); cx.fillText(G.banner.t, W / 2, 62); cx.globalAlpha = 1; }
  }

  /* mini-map: targets = RED points */
  function drawMap() {
    const sc = MW / (WORLD * 2), X = x => (x + WORLD) * sc, Y = z => (WORLD - z) * sc;
    mx.clearRect(0, 0, MW, MW); mx.fillStyle = 'rgba(8,12,24,.92)'; mx.fillRect(0, 0, MW, MW);
    mx.strokeStyle = 'rgba(255,255,255,.08)'; mx.lineWidth = 1; mx.beginPath(); for (let k = -WORLD + 8; k < WORLD; k += 16) { mx.moveTo(X(k), 0); mx.lineTo(X(k), MW); mx.moveTo(0, Y(k)); mx.lineTo(MW, Y(k)); } mx.stroke();
    SCN.forEach(b => { mx.fillStyle = b.k === 'bld' ? 'rgba(160,170,190,.35)' : b.k === 'tree' ? 'rgba(60,180,90,.4)' : 'rgba(190,130,60,.5)'; const w = b.k === 'tree' ? 2 : b.w * sc; mx.fillRect(X(b.x) - w / 2, Y(b.z) - w / 2, w, w); });
    // view cone
    const px = X(P.x), py = Y(P.z), a = P.yaw, r = 34;
    mx.fillStyle = 'rgba(80,200,255,.22)'; mx.beginPath(); mx.moveTo(px, py);
    for (let i = 0; i <= 12; i++) { const an = a - FOV / 2 + FOV * i / 12; mx.lineTo(px + Math.sin(an) * r, py - Math.cos(an) * r); }
    mx.closePath(); mx.fill();
    // enemies (RED points)
    G.en.forEach(e => {
      const ex = X(e.x), ey = Y(e.z), pulse = 1 + .35 * Math.sin(G.t * 6 + e.ph);
      mx.fillStyle = 'rgba(255,40,40,.25)'; mx.beginPath(); mx.arc(ex, ey, 6.5 * pulse, 0, TAU); mx.fill();
      mx.fillStyle = G.lock === e ? '#ffd166' : '#ff2d2d'; mx.beginPath(); mx.arc(ex, ey, 3.4, 0, TAU); mx.fill();
    });
    // player arrow
    mx.save(); mx.translate(px, py); mx.rotate(a); mx.fillStyle = '#38bdf8'; mx.strokeStyle = '#fff'; mx.lineWidth = 1.2; mx.beginPath(); mx.moveTo(0, -7); mx.lineTo(5, 6); mx.lineTo(0, 3); mx.lineTo(-5, 6); mx.closePath(); mx.fill(); mx.stroke(); mx.restore();
    mx.strokeStyle = 'rgba(255,183,3,.7)'; mx.lineWidth = 2; mx.strokeRect(1, 1, MW - 2, MW - 2);
  }

  /* =================== GAME LOGIC =================== */
  const hudCache = {};
  function setT(id, v) { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } }
  function hud() {
    setT('ffWords', Math.min(G.words, WIN)); $('ffBar').style.width = Math.min(100, G.words) + '%';
    setT('ffRunCoins', G.coins); setT('ffCoins', S.coins); setT('ffWpn', WP(curW).name); setT('ffNades', S.nades); setT('ffNadeN', S.nades);
    setT('ffLives', '❤'.repeat(Math.max(0, MAXFAIL - G.fails)) + '🖤'.repeat(Math.min(MAXFAIL, G.fails)));
    setT('ffWrong', G.wrong);
    const lvl = G.words >= 50 ? 'HARD' : G.words >= 20 ? 'MEDIUM' : 'EASY'; setT('ffLvl', lvl);
    $('ffNade').classList.toggle('empty', S.nades <= 0);
    const l = G.lock; const hint = $('ffHint');
    const key = l ? l.w + '|' + l.pos : 'none|' + G.state; if (hudCache.hint !== key) {
      hudCache.hint = key; hint.textContent = '';
      if (l) { const d = mk('span', 'd', l.w.slice(0, l.pos)); hint.append('🎯 ', d, l.w.slice(l.pos)); }
      else hint.textContent = G.state === 'run' ? '🎯 Screen par dikhne wale kisi bhi target ka pehla akshar type karo' : 'Mission start karo 👆';
    }
  }
  function banner(t, ttl) { G.banner = { t, ttl: ttl || 1.8 }; }
  function toast(msg) { const t = $('ffToast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('show'), 2000); }

  function spawn(front) {
    if (G.en.length >= 7) return false;
    const lvl = G.words >= 50 ? 2 : G.words >= 20 ? 1 : 0, used = new Set(G.en.map(e => e.w[0].toLowerCase()));
    let w = null;
    for (let t = 0; t < 50; t++) { const c = makeWord(lvl); if (!used.has(c[0].toLowerCase()) && !G.en.some(e => e.w === c)) { w = c; break; } }
    if (!w) return false;
    let x = 0, z = 0;
    for (let t = 0; t < 12; t++) {
      const a = (front || Math.random() < .65) ? P.yaw + rnd(-.5, .5) * FOV * .9 : rnd(0, TAU), r = rnd(30, 44);
      x = P.x + Math.sin(a) * r; z = P.z + Math.cos(a) * r; if (Math.abs(x) < WORLD - 2 && Math.abs(z) < WORLD - 2) break;
    }
    x = clamp(x, -WORLD + 2, WORLD - 2); z = clamp(z, -WORLD + 2, WORLD - 2);
    G.en.push({ x, z, w, pos: 0, sp: rnd(.85, 1.15), ph: rnd(0, TAU), col: pickOf(ECOL), hat: pickOf(['helmet', 'mask', 'cap']), d: 99, b: 0, vis: false });
    return true;
  }

  function startRun() {
    G = newG(); G.state = 'run'; P.x = 0; P.z = 0; P.yaw = 0; curW = S.weapon;
    hideOv(); inp.disabled = false; inp.value = ''; inp.focus({ preventScroll: true });
    spawn(true); spawn(true); G.spawnT = 2.6; lastT = performance.now(); hud();
  }
  function showOv(title, html, b) { ovT.textContent = title; ovP.innerHTML = html; goBtn.textContent = b; ov.classList.remove('hide'); }
  function hideOv() { ov.classList.add('hide'); }
  function pause(reason) {
    if (G.state !== 'run') return;
    G.state = 'paused'; ctrl.up = ctrl.down = ctrl.left = ctrl.right = 0; kbd.up = kbd.down = kbd.left = kbd.right = 0; inp.disabled = true;
    showOv('⏸ Game Paused', reason || 'Game roka gaya hai.', '▶ Resume');
  }
  function resume() { if (G.state !== 'paused') return; G.state = 'run'; hideOv(); inp.disabled = false; inp.focus({ preventScroll: true }); lastT = performance.now(); }
  function endRun(won, reason) {
    G.state = won ? 'won' : 'over'; inp.disabled = true; inp.blur(); G.lock = null;
    S.best = Math.max(S.best, G.words); if (won) S.wins++; save();
    const stats = '<b>' + Math.min(G.words, WIN) + ' / ' + WIN + '</b> words &middot; Coins kamaye: <b>+' + G.coins + ' 🪙</b><br>Accuracy: <b>' + (G.typed ? Math.round(G.correct / G.typed * 100) : 0) + '%</b> &middot; Time: <b>' + Math.round(G.time) + 's</b> &middot; Best: <b>' + S.best + '</b>';
    if (won) { SFX.win(); showOv('🏆 MISSION COMPLETE!', 'Shabaash! Aapne 100 words blast kar diye 🎉<br>' + stats + '<br><small>Coins se Drop Store / Outfit Shop me kharidari karein.</small>', '🔁 Dobara Khelo'); }
    else { SFX.over(); showOv('💀 GAME OVER', reason + '<br>' + stats + '<br><small>Coins save hain — Drop Store me naye weapons lo!</small>', '🔁 Play Again'); }
  }

  const same = (a, b) => a === b || (b != null && /[a-z]/i.test(a) && a.toLowerCase() === b.toLowerCase());
  function wrongKey() {
    G.wrong++; G.flash = Math.max(G.flash, .35); G.shake = Math.max(G.shake, .25); SFX.wrong();
    if (G.wrong > MAXWRONG) endRun(false, '4th galat keystroke! (Ek word par sirf 3 galtiyan allowed hain)');
  }
  function typeChar(ch) {
    if (G.state !== 'run' || ch === ' ' || ch === '\n') return;
    G.typed++; const e = G.lock;
    if (e) {
      if (same(ch, e.w[e.pos])) { e.pos++; G.correct++; G.wrong = 0; SFX.key(); if (e.pos >= e.w.length) kill(e, false); }
      else wrongKey();
    } else {
      const c = G.en.find(x => x.vis && same(ch, x.w[0]));
      if (c) { G.lock = c; c.pos = 1; G.correct++; G.wrong = 0; SFX.key(); if (c.w.length <= 1) kill(c, false); }
      else if (G.en.some(x => x.vis)) wrongKey();
    }
  }
  function screenOf(e) { const c = toCam(e.x, 0, e.z); if (c.d < .4) return [W / 2, HOR]; const s = F / c.d; return [W / 2 + c.l / c.d * F, HOR + CAMH / c.d * F - 1.05 * s]; }
  function burst(x, y, big) {
    const n = big ? 26 : 18; for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(60, big ? 320 : 220); G.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: rnd(.4, .9), max: .9, size: rnd(2, 5), col: pickOf(['#ffd166', '#ff9f1c', '#ef4444', '#fff3c4', '#fb7185']) }); }
  }
  function kill(e, byNade) {
    const i = G.en.indexOf(e); if (i < 0) return;
    const [sx, sy] = screenOf(e); G.en.splice(i, 1); if (G.lock === e) G.lock = null; G.wrong = 0;
    G.words++; G.coins += 5; S.coins += 5; save();
    burst(sx, sy, byNade); G.pops.push({ x: sx, y: sy - 18, t: '+5 🪙', life: .9, big: byNade });
    if (!byNade) {
      const w = WP(curW); G.shots.push({ x1: W * .6, y1: H * .8, x2: sx, y2: sy, ttl: .12 }); G.recoil = 1; G.muzzle = .08; SFX.shot(); SFX.coin();
      if (w.dbl) G.shots.push({ x1: W * .58, y1: H * .8, x2: sx + 14, y2: sy + 8, ttl: .12 });
    }
    if (G.words % 5 === 0) switchWeapon();
    if (G.words >= WIN && G.state === 'run') endRun(true);
  }
  function switchWeapon() {
    const idxs = WEAPONS.map((w, i) => S.owned.includes(w.id) ? i : -1).filter(i => i >= 0); if (idxs.length < 2) return;
    const cur = WEAPONS.findIndex(w => w.id === curW), nx = idxs.find(i => i > cur); curW = WEAPONS[nx != null ? nx : idxs[0]].id;
    banner('🔄 Weapon badal gaya: ' + WP(curW).name, 2); tone(500, 900, .15, 'triangle', .07);
  }
  function throwNade() {
    if (G.state !== 'run') return;
    if (S.nades <= 0) { banner('💣 Grenade khatam! Drop Store se kharido', 1.6); return; }
    if (!G.en.length) { banner('Abhi koi target nahi hai', 1.2); return; }
    S.nades--; save(); G.nade = 1; G.shake = 1; SFX.boom();
    [...G.en].forEach(e => kill(e, true));
    if (G.state === 'run') banner('💥 BOOM! Saare targets blast!', 1.8);
  }
  function hitPlayer(e) {
    const i = G.en.indexOf(e); if (i < 0) return; G.en.splice(i, 1); if (G.lock === e) { G.lock = null; } G.wrong = 0;
    G.fails++; G.flash = 1; G.shake = .7; SFX.hit(); burst(W / 2, H * .6, true);
    if (G.fails >= MAXFAIL) endRun(false, 'Target aap tak pahunch gaye! (3 Failed Chances poore)'); else banner('⚠️ Target pahunch gaya! Chance: ' + G.fails + '/' + MAXFAIL, 1.6);
  }

  function update(dt) {
    G.t += dt; G.time += dt;
    // player movement
    const fwd = (ctrl.up || kbd.up ? 1 : 0) - (ctrl.down || kbd.down ? 1 : 0), trn = (ctrl.right || kbd.right ? 1 : 0) - (ctrl.left || kbd.left ? 1 : 0);
    P.yaw += trn * 1.9 * dt + dragYaw; dragYaw = 0;
    const mv = fwd * 11 * dt + dragMove; dragMove = 0;
    P.x = clamp(P.x + Math.sin(P.yaw) * mv, -WORLD + 1.5, WORLD - 1.5); P.z = clamp(P.z + Math.cos(P.yaw) * mv, -WORLD + 1.5, WORLD - 1.5);
    G.mov += ((fwd || trn ? 1 : 0) - G.mov) * Math.min(1, dt * 8); if (fwd || trn) G.bob += dt * 11;
    // aim assist: locked target ko screen me rakhta hai
    if (G.lock && !trn && Math.abs(G.lock.b) > .4) P.yaw += Math.sign(G.lock.b) * Math.min(Math.abs(G.lock.b) - .4, 1.8 * dt);
    sinY = Math.sin(P.yaw); cosY = Math.cos(P.yaw);
    // spawning (words badhne par tez + zyada)
    G.spawnT -= dt; const maxA = Math.min(6, 3 + Math.floor(G.words / 20));
    if (G.spawnT <= 0 && G.en.length < maxA) { spawn(false); G.spawnT = Math.max(2.1, 3.4 - G.words * .013); }
    if (G.en.length === 0 && G.spawnT > .9) G.spawnT = .6;
    // enemies
    const sp = 1.7 + Math.min(1.8, G.words * .018), hits = [];
    G.en.forEach(e => {
      const dx = P.x - e.x, dz = P.z - e.z, d = Math.hypot(dx, dz) || .01; e.d = d;
      if (d < 2.2) { hits.push(e); return; }
      const wv = Math.sin(G.t * 1.3 + e.ph) * .35, ux = dx / d, uz = dz / d;
      e.x += (ux - uz * wv) * sp * e.sp * dt; e.z += (uz + ux * wv) * sp * e.sp * dt;
      e.b = normA(Math.atan2(e.x - P.x, e.z - P.z) - P.yaw); e.vis = Math.abs(e.b) < FOV / 2 - .03 && d > 1;
    });
    hits.forEach(hitPlayer);
  }
  function fx(dt) {
    G.parts.forEach(p => { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; }); G.parts = G.parts.filter(p => p.life > 0);
    G.pops.forEach(p => { p.life -= dt; p.y -= 38 * dt; }); G.pops = G.pops.filter(p => p.life > 0);
    G.shots.forEach(s => s.ttl -= dt); G.shots = G.shots.filter(s => s.ttl > 0);
    G.flash = Math.max(0, G.flash - dt * 1.6); G.shake = Math.max(0, G.shake - dt * 2.2); G.recoil = Math.max(0, G.recoil - dt * 6); G.muzzle = Math.max(0, G.muzzle - dt); G.nade = Math.max(0, G.nade - dt * 1.7);
    if (G.banner) { G.banner.ttl -= dt; if (G.banner.ttl <= 0) G.banner = null; }
  }
  function frame(t) {
    if (!looping) return;
    const dt = Math.min(.05, (t - lastT) / 1000 || 0); lastT = t;
    if (G.state === 'run') update(dt); else if (G.state === 'idle') { P.yaw += dt * .12; G.t += dt; }
    if (G.state !== 'paused') fx(dt);
    render(); drawMap(); hud();
    raf = requestAnimationFrame(frame);
  }
  const startLoop = () => { if (looping) return; looping = true; lastT = performance.now(); raf = requestAnimationFrame(frame); };
  const stopLoop = () => { looping = false; cancelAnimationFrame(raf); };

  /* =================== CHARACTER (real-style human silhouette) =================== */
  function drawHuman(c, x, y, sc, gender, o) {
    const f = gender === 'female', skin = '#e0aa82', skinD = '#c58b64', hair = f ? '#2b1a12' : '#1b1410';
    const sh = f ? 30 : 38, wa = f ? 17 : 22, hp = f ? 29 : 25, sY = 92, wY = f ? 176 : 184, hem = f ? 232 : 226, hc = f ? 14 : 13, hw = f ? 15 : 14;
    c.save(); c.translate(x, y); c.scale(sc, sc); c.lineJoin = 'round'; c.lineCap = 'round';
    const ol = (p, w) => { c.lineWidth = w || 1.6; c.strokeStyle = 'rgba(0,0,0,.42)'; c.stroke(p); };
    // ground shadow
    let g = c.createRadialGradient(100, 402, 4, 100, 402, 72); g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.beginPath(); c.ellipse(100, 402, 74, 14, 0, 0, TAU); c.fill();
    // back hair (female)
    if (f) { c.fillStyle = hair; c.beginPath(); c.moveTo(78, 40); c.quadraticCurveTo(64, 74, 69, 122); c.quadraticCurveTo(80, 138, 100, 130); c.quadraticCurveTo(120, 138, 131, 122); c.quadraticCurveTo(136, 74, 122, 40); c.closePath(); c.fill(); }
    // arms (shirt ke peeche)
    const arm = side => {
      const p = new Path2D(), ax = 100 + side * sh, e1 = ax + side * 9, w0 = 19, w1 = 14, w2 = 10;
      p.moveTo(ax + side * (w0 / 2 - 2), sY + 2); p.quadraticCurveTo(e1 + side * (w1 / 2 + 3), 146, e1 + side * (w2 / 2 + 1), 208);
      p.lineTo(e1 - side * (w2 / 2) + side * 0, 208); p.quadraticCurveTo(e1 - side * (w1 / 2) - side * 1, 150, ax - side * (w0 / 2 - 6), sY + 12); p.closePath();
      return { p, ax, hx: e1 };
    };
    const arms = [arm(-1), arm(1)], armsAll = new Path2D();
    arms.forEach((a, i) => {
      const side = i ? 1 : -1;
      c.fillStyle = skin; c.fill(a.p); ol(a.p, 1.4); armsAll.addPath(a.p);
      c.save(); c.clip(a.p); c.fillStyle = o.top; c.fillRect(0, 0, 200, o.sleeve === 'long' ? 200 : 128); c.restore();
      if (o.sleeve === 'long') { c.fillStyle = shade(o.top, -.25); c.fillRect(a.hx - 8, 196, 16, 5); }
      c.fillStyle = skin; c.beginPath(); c.ellipse(a.hx + side * 1, 216, 6.5, 10, side * -.08, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.stroke();
    });
    // legs (pants)
    const leg = side => {
      const p = new Path2D(), ox = 100 + side * (hc + hw), ix = 100 - side * 1;
      p.moveTo(ox, 196); p.quadraticCurveTo(100 + side * (hc + hw + 1), 262, 100 + side * 25, 298); p.quadraticCurveTo(100 + side * 23, 340, 100 + side * 21, 380);
      p.lineTo(100 + side * 6, 380); p.quadraticCurveTo(100 + side * 3, 340, 100 + side * 3, 298); p.quadraticCurveTo(100 + side * 0, 262, ix, 238); p.closePath(); return p;
    };
    const pantsAll = new Path2D(); [-1, 1].forEach(s => pantsAll.addPath(leg(s)));
    [-1, 1].forEach(s => {
      const sx = 100 + s * 17; c.fillStyle = o.shoe; c.beginPath(); c.ellipse(sx, 388, 15, 8.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.4; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(sx, 392, 14, 3, 0, 0, Math.PI); c.fill();
    });
    c.fillStyle = o.pant; c.fill(pantsAll); c.fillStyle = o.pant; rrect(c, 100 - hp - 2, 192, hp * 2 + 4, 48, 10); c.fill();
    [-1, 1].forEach(s => ol(leg(s), 1.5));
    g = c.createLinearGradient(0, 0, 200, 0); g.addColorStop(0, 'rgba(0,0,0,.28)'); g.addColorStop(.27, 'rgba(0,0,0,0)'); g.addColorStop(.5, 'rgba(0,0,0,.22)'); g.addColorStop(.73, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = g; c.fill(pantsAll);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1.3; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(100 + s * 13, 290); c.quadraticCurveTo(100 + s * 18, 296, 100 + s * 22, 292); c.moveTo(100 + s * 12, 300); c.quadraticCurveTo(100 + s * 16, 306, 100 + s * 20, 303); c.stroke(); });
    // shirt
    const shirt = new Path2D();
    shirt.moveTo(100 - sh, sY + 6); shirt.quadraticCurveTo(100 - sh * .55, sY - 5, 90, sY - 5); shirt.quadraticCurveTo(100, sY + 8, 110, sY - 5); shirt.quadraticCurveTo(100 + sh * .55, sY - 5, 100 + sh, sY + 6);
    shirt.quadraticCurveTo(100 + sh - 2, sY + 46, 100 + wa, wY); shirt.quadraticCurveTo(100 + wa + 1, wY + 28, 100 + hp + 2, hem); shirt.quadraticCurveTo(100, hem + 6, 100 - hp - 2, hem);
    shirt.quadraticCurveTo(100 - wa - 1, wY + 28, 100 - wa, wY); shirt.quadraticCurveTo(100 - sh + 2, sY + 46, 100 - sh, sY + 6); shirt.closePath();
    // neck (shirt se pehle taaki collar upar aaye)
    c.fillStyle = skin; c.beginPath(); c.moveTo(f ? 94 : 92, 68); c.lineTo(f ? 94 : 92, 94); c.quadraticCurveTo(100, 104, f ? 106 : 108, 94); c.lineTo(f ? 106 : 108, 68); c.closePath(); c.fill();
    g = c.createLinearGradient(0, 68, 0, 96); g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fill();
    c.fillStyle = o.top; c.fill(shirt); ol(shirt, 1.6);
    g = c.createLinearGradient(100 - sh, 0, 100 + sh, 0); g.addColorStop(0, 'rgba(0,0,0,.3)'); g.addColorStop(.3, 'rgba(0,0,0,0)'); g.addColorStop(.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.3)'); c.fillStyle = g; c.fill(shirt);
    // V-neck
    c.fillStyle = skin; c.beginPath(); c.moveTo(89, sY - 4); c.lineTo(111, sY - 4); c.lineTo(100, sY + 18); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.3; c.stroke();
    c.strokeStyle = 'rgba(0,0,0,.14)'; c.lineWidth = 1.4; c.beginPath();
    if (f) { c.moveTo(82, 128); c.quadraticCurveTo(92, 140, 99, 128); c.moveTo(101, 128); c.quadraticCurveTo(108, 140, 118, 128); }
    c.moveTo(82, 175); c.quadraticCurveTo(100, 182, 118, 175); c.moveTo(80, 200); c.quadraticCurveTo(100, 208, 120, 200); c.stroke();
    // extras
    if (o.extra === 'shirt') {
      c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(89, sY - 6); c.lineTo(100, sY + 18); c.lineTo(80, sY + 14); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(111, sY - 6); c.lineTo(100, sY + 18); c.lineTo(120, sY + 14); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.moveTo(100, sY + 18); c.lineTo(100, hem + 2); c.stroke(); c.fillStyle = 'rgba(0,0,0,.35)';
      for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(103, sY + 30 + k * 26, 1.7, 0, TAU); c.fill(); }
    }
    if (o.extra === 'stripe') {
      c.save(); c.clip(shirt); c.fillStyle = 'rgba(255,255,255,.85)'; c.fillRect(0, 128, 200, 8); c.fillStyle = shade(o.pant, -.1); c.fillRect(0, 138, 200, 4); c.restore();
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; [-1, 1].forEach(s => { c.beginPath(); c.moveTo(100 + s * (hc + hw - 3), 206); c.quadraticCurveTo(100 + s * 27, 262, 100 + s * 23, 300); c.quadraticCurveTo(100 + s * 22, 340, 100 + s * 19, 376); c.stroke(); });
      arms.forEach(a => { c.save(); c.clip(a.p); c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.beginPath(); c.moveTo(a.hx > 100 ? a.hx + 3 : a.hx - 3, 100); c.lineTo(a.hx > 100 ? a.hx + 3 : a.hx - 3, 205); c.stroke(); c.restore(); });
    }
    if (o.extra === 'camo') {
      const all = new Path2D(); all.addPath(shirt); all.addPath(armsAll); all.addPath(pantsAll);
      c.save(); c.clip(all);
      for (let i = 0; i < 46; i++) { const r = n => { const v = Math.sin((i + 1) * 127.1 + n * 311.7) * 43758.5453; return v - Math.floor(v); }; c.fillStyle = ['rgba(34,48,22,.8)', 'rgba(104,128,70,.75)', 'rgba(70,86,44,.8)', 'rgba(20,28,14,.7)'][i % 4]; c.beginPath(); c.ellipse(34 + r(1) * 132, 92 + r(2) * 290, 8 + r(3) * 14, 5 + r(4) * 9, r(5) * 3, 0, TAU); c.fill(); }
      c.restore();
    }
    if (o.extra === 'vest') {
      const v = new Path2D(); v.moveTo(100 - sh + 6, 98); v.lineTo(91, 98); v.lineTo(100, 124); v.lineTo(109, 98); v.lineTo(100 + sh - 6, 98); v.lineTo(100 + wa + 3, 206); v.lineTo(100 - wa - 3, 206); v.closePath();
      c.fillStyle = '#5a4c2e'; c.fill(v); ol(v, 1.5); c.fillStyle = '#463b24'; [[80, 150], [104, 150], [80, 176], [104, 176]].forEach(p => { rrect(c, p[0], p[1], 17, 20, 3); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1; c.stroke(); });
      c.fillStyle = '#2d2616'; c.fillRect(100 - wa - 3, 200, wa * 2 + 6, 6);
    }
    // head
    const hx = f ? 19 : 21;
    const head = new Path2D(); head.moveTo(100 - hx, 44); head.bezierCurveTo(100 - hx, 20, 100 + hx, 20, 100 + hx, 44); head.bezierCurveTo(100 + hx, 62, 112, 76, 100, 76); head.bezierCurveTo(88, 76, 100 - hx, 62, 100 - hx, 44); head.closePath();
    c.fillStyle = skin; c.beginPath(); c.ellipse(100 - hx, 50, 3.5, 7, 0, 0, TAU); c.ellipse(100 + hx, 50, 3.5, 7, 0, 0, TAU); c.fill();
    c.fillStyle = skin; c.fill(head); ol(head, 1.5);
    g = c.createLinearGradient(100 - hx, 0, 100 + hx, 0); g.addColorStop(0, 'rgba(0,0,0,.18)'); g.addColorStop(.3, 'rgba(0,0,0,0)'); g.addColorStop(.75, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = g; c.fill(head);
    // face
    c.fillStyle = '#fff'; [[91, 49], [109, 49]].forEach(p => { c.beginPath(); c.ellipse(p[0], p[1], 3.6, 2.4, 0, 0, TAU); c.fill(); });
    c.fillStyle = '#2b1b12'; [[91.6, 49], [109.4, 49]].forEach(p => { c.beginPath(); c.arc(p[0], p[1], 1.8, 0, TAU); c.fill(); });
    c.strokeStyle = hair; c.lineWidth = f ? 1.6 : 2.2; c.beginPath(); c.moveTo(86, 42); c.quadraticCurveTo(91, 39.5, 96, 42); c.moveTo(104, 42); c.quadraticCurveTo(109, 39.5, 114, 42); c.stroke();
    c.strokeStyle = skinD; c.lineWidth = 1.4; c.beginPath(); c.moveTo(100, 50); c.quadraticCurveTo(97, 58, 100, 60); c.stroke();
    if (f) { c.strokeStyle = '#2b1b12'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(87.5, 48); c.lineTo(86, 46.5); c.moveTo(112.5, 48); c.lineTo(114, 46.5); c.stroke(); c.fillStyle = '#b4535a'; c.beginPath(); c.ellipse(100, 66, 5, 2.4, 0, 0, TAU); c.fill(); }
    else { c.strokeStyle = '#8a4b3c'; c.lineWidth = 1.7; c.beginPath(); c.moveTo(94, 66); c.quadraticCurveTo(100, 69, 106, 66); c.stroke(); }
    // hair (front)
    c.fillStyle = hair;
    if (f) {
      c.beginPath(); c.moveTo(79, 46); c.bezierCurveTo(76, 14, 124, 14, 121, 46); c.bezierCurveTo(118, 34, 108, 28, 97, 27); c.bezierCurveTo(88, 30, 82, 38, 79, 46); c.fill();
      c.beginPath(); c.moveTo(79, 40); c.quadraticCurveTo(70, 74, 74, 114); c.lineTo(82, 112); c.quadraticCurveTo(80, 76, 85, 44); c.closePath(); c.fill();
      c.beginPath(); c.moveTo(121, 40); c.quadraticCurveTo(130, 74, 126, 114); c.lineTo(118, 112); c.quadraticCurveTo(120, 76, 115, 44); c.closePath(); c.fill();
    } else {
      c.beginPath(); c.moveTo(78, 46); c.bezierCurveTo(74, 12, 126, 12, 122, 46); c.bezierCurveTo(120, 36, 114, 31, 108, 31); c.bezierCurveTo(100, 36, 88, 33, 82, 36); c.bezierCurveTo(80, 39, 79, 42, 78, 46); c.fill();
    }
    // headwear
    if (o.hat === 'cap') {
      c.fillStyle = o.cap || o.top; c.beginPath(); c.moveTo(77, 42); c.bezierCurveTo(77, 14, 123, 14, 123, 42); c.quadraticCurveTo(100, 33, 77, 42); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.3; c.stroke();
      c.fillStyle = shade(o.cap || o.top, -.3); c.beginPath(); c.ellipse(100, 42, 25, 5.5, 0, 0, TAU); c.fill(); c.stroke(); c.fillStyle = shade(o.cap || o.top, .25); c.beginPath(); c.arc(100, 19, 2.6, 0, TAU); c.fill();
    } else if (o.hat === 'helmet') {
      c.fillStyle = '#566a3d'; c.beginPath(); c.moveTo(74, 47); c.bezierCurveTo(70, 6, 130, 6, 126, 47); c.lineTo(74, 47); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.4; c.stroke();
      c.fillStyle = '#3c4a2a'; c.fillRect(74, 41, 52, 6); c.strokeStyle = '#2b2b2b'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(79, 47); c.lineTo(81, 70); c.moveTo(121, 47); c.lineTo(119, 70); c.stroke();
    } else if (o.hat === 'mask') {
      c.fillStyle = o.band; c.fillRect(77, 33, 46, 7); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.2; c.strokeRect(77, 33, 46, 7);
      c.fillStyle = '#12121a'; c.beginPath(); c.moveTo(80, 54); c.quadraticCurveTo(100, 50, 120, 54); c.lineTo(119, 66); c.quadraticCurveTo(100, 82, 81, 66); c.closePath(); c.fill(); c.stroke();
    } else if (o.hat === 'bandana') {
      c.fillStyle = o.band; c.beginPath(); c.moveTo(77, 38); c.quadraticCurveTo(100, 22, 123, 38); c.lineTo(123, 47); c.quadraticCurveTo(100, 36, 77, 47); c.closePath(); c.fill(); c.strokeStyle = 'rgba(0,0,0,.4)'; c.lineWidth = 1.3; c.stroke();
      c.beginPath(); c.moveTo(122, 42); c.lineTo(136, 36); c.lineTo(132, 50); c.closePath(); c.fill(); c.stroke();
    }
    c.restore();
  }
  function renderAvatar() { const a = $('ffAvatar'), c = a.getContext('2d'); c.clearRect(0, 0, a.width, a.height); drawHuman(c, a.width / 2 - 100 * .23, 0, .23, S.gender, OUT()); }

  /* =================== STORE / SHOP UI =================== */
  function gunIcon(c, w, W2, H2) {
    c.clearRect(0, 0, W2, H2); c.save(); c.translate(W2 / 2, H2 / 2);
    const L = { Pistol: 70, SMG: 100, Shotgun: 130, 'Assault Rifle': 140, Sniper: 168 }[w.type] || 100, sc = Math.min((W2 - 14) / L, 1.25); c.scale(sc, sc);
    const x0 = -L / 2, col = w.col, dk = shade(w.col, -.45);
    const body = (x, y, ww, hh, fill) => { c.fillStyle = fill; rrect(c, x, y, ww, hh, 3); c.fill(); c.strokeStyle = 'rgba(0,0,0,.5)'; c.lineWidth = 1; c.stroke(); };
    if (w.type === 'Pistol') { body(x0, -14, L * .85, 15, col); body(x0 + L * .85 - 2, -9, L * .15 + 2, 5, '#222'); c.fillStyle = dk; c.beginPath(); c.moveTo(x0 + 6, 1); c.lineTo(x0 + 26, 1); c.lineTo(x0 + 18, 28); c.lineTo(x0 + 2, 28); c.closePath(); c.fill(); c.stroke(); }
    else {
      const sw = w.type === 'SMG' ? 0 : L * .22; body(x0 + sw, -11, L - sw, 14, col); body(x0 + L * .72, -7, L * .28 + 1, 5, '#2a2a2a');
      if (sw) { c.fillStyle = dk; c.beginPath(); c.moveTo(x0 + sw, -9); c.lineTo(x0, -7); c.lineTo(x0, 12); c.lineTo(x0 + sw, 3); c.closePath(); c.fill(); c.stroke(); }
      if (w.mag) { c.fillStyle = '#20242b'; c.beginPath(); c.moveTo(x0 + L * .4, 3); c.lineTo(x0 + L * .4 + 11, 3); c.lineTo(x0 + L * .4 + (w.mag === 2 ? 20 : 11), 28); c.lineTo(x0 + L * .4 + (w.mag === 2 ? 9 : 0), 28); c.closePath(); c.fill(); c.stroke(); }
      c.fillStyle = dk; c.beginPath(); c.moveTo(x0 + L * .3, 3); c.lineTo(x0 + L * .3 + 9, 3); c.lineTo(x0 + L * .3 + 4, 20); c.lineTo(x0 + L * .3 - 6, 20); c.closePath(); c.fill(); c.stroke();
      if (w.scope) { body(x0 + L * .3, -22, L * .3, 9, '#0b0f14'); c.fillStyle = '#9be7ff'; c.fillRect(x0 + L * .3 + L * .3 - 3, -20, 3, 5); }
    }
    c.fillStyle = w.acc; c.fillRect(x0 + L * .1, -11, L * .35, 2.2); c.restore();
  }
  function cardBtn(label, cls, fn, dis) { const b = mk('button', 'btn sm ' + (cls || ''), label); b.type = 'button'; if (dis) b.disabled = true; b.onclick = fn; return b; }
  function renderStore() {
    const g = $('ffWeapons'); g.textContent = '';
    WEAPONS.forEach(w => {
      const own = S.owned.includes(w.id), eq = S.weapon === w.id, card = mk('div', 'ff-card' + (eq ? ' eq' : ''));
      const c = mk('canvas'); c.width = 160; c.height = 76; gunIcon(c.getContext('2d'), w, 160, 76); card.append(c, mk('b', '', w.name), mk('small', '', w.type));
      const b = own ? cardBtn(eq ? '✔ Equipped' : 'Equip', '', () => { S.weapon = w.id; curW = w.id; save(); refresh(); renderStore(); toast(w.name + ' equip ho gaya'); }, eq)
        : cardBtn('Buy 🪙 ' + w.price, S.coins < w.price ? 'lock' : '', () => {
          if (S.coins < w.price) { toast('Coins kam hain! ' + (w.price - S.coins) + ' aur chahiye'); return; }
          S.coins -= w.price; S.owned.push(w.id); S.weapon = w.id; curW = w.id; save(); SFX.coin(); refresh(); renderStore(); toast('🎁 ' + w.name + ' mil gaya aur equip ho gaya!');
        });
      card.append(b); g.append(card);
    });
    const n = $('ffNadeShop'); n.textContent = '';
    NADES.forEach(d => {
      const card = mk('div', 'ff-card'); card.append(mk('div', 'ff-big', '💣'.repeat(Math.min(d.qty, 3)) + (d.qty > 3 ? '+' : '')), mk('b', '', d.name + ' ×' + d.qty), mk('small', '', 'Saare words ek saath blast'));
      card.append(cardBtn('Buy 🪙 ' + d.price, S.coins < d.price ? 'lock' : '', () => {
        if (S.coins < d.price) { toast('Coins kam hain! ' + (d.price - S.coins) + ' aur chahiye'); return; }
        S.coins -= d.price; S.nades += d.qty; save(); SFX.coin(); refresh(); renderStore(); toast('💣 +' + d.qty + ' grenade mil gaye (Total: ' + S.nades + ')');
      })); n.append(card);
    });
    $('ffNadeHave').textContent = S.nades;
  }
  function outfitCanvas(o, w, h, sc) { const c = mk('canvas'); c.width = w; c.height = h; drawHuman(c.getContext('2d'), (w - 200 * sc) / 2, 0, sc, S.gender, o); return c; }
  function renderShop() {
    const g = $('ffOutfits'); g.textContent = '';
    OUTFITS.forEach(o => {
      const own = S.outfits.includes(o.id), eq = S.outfit === o.id, card = mk('div', 'ff-card tall' + (eq ? ' eq' : ''));
      card.append(outfitCanvas(o, 100, 160, .38), mk('b', '', o.name));
      card.append(own ? cardBtn(eq ? '✔ Pehna hua' : 'Pehno', '', () => { S.outfit = o.id; save(); refresh(); renderShop(); toast(o.name + ' pehen liya'); }, eq)
        : cardBtn('Buy 🪙 ' + o.price, S.coins < o.price ? 'lock' : '', () => {
          if (S.coins < o.price) { toast('Coins kam hain! ' + (o.price - S.coins) + ' aur chahiye'); return; }
          S.coins -= o.price; S.outfits.push(o.id); S.outfit = o.id; save(); SFX.coin(); refresh(); renderShop(); toast('👕 ' + o.name + ' kharida aur turant pehen liya!');
        }));
      g.append(card);
    });
  }
  function renderChar() {
    const wrap = $('ffCharCv'); wrap.textContent = ''; wrap.append(outfitCanvas(OUT(), 260, 430, 1.02));
    $('ffOutName').textContent = OUT().name;
    document.querySelectorAll('#ffGender button').forEach(b => b.classList.toggle('on', b.dataset.gd === S.gender));
  }
  function refresh() { setT('ffCoins', S.coins); renderAvatar(); hud(); $('ffMute').textContent = S.mute ? '🔇' : '🔊'; }

  /* =================== PANELS + TAB INTEGRATION =================== */
  function showPanel(name) {
    if (name !== 'play') pause('Aap ' + (name === 'store' ? 'Drop Store' : name === 'char' ? 'Character' : 'Outfit Shop') + ' me gaye the');
    panel = name;
    ['play', 'store', 'char', 'shop'].forEach(p => { $('ffP-' + p).hidden = p !== name; });
    $('ffSub').querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.p === name));
    if (name === 'store') renderStore(); else if (name === 'char') renderChar(); else if (name === 'shop') renderShop();
    if (name === 'play') startLoop(); else stopLoop();
  }
  function activate() {
    internal = true; const t0 = tabs.querySelector('[data-g="0"]'); if (t0) t0.click(); internal = false;   // baaki games ko rokta hai
    if (orig) orig.style.display = 'none'; if (box) box.hidden = true;
    tabs.querySelectorAll('button').forEach(b => b.classList.toggle('on', b === btn));
    root.hidden = false; active = true; refresh(); showPanel('play');
    if (G.state === 'idle') showOv('🔫 Free Fire Typing Shooter', IDLE_HTML, '▶ Mission Start');
  }
  function deactivate() { active = false; pause('Aap dusre game par chale gaye the'); root.hidden = true; stopLoop(); btn.classList.remove('on'); }
  const IDLE_HTML = '<ul><li>Screen par aate <b>target words</b> type karke blast karo — <b>1 word = 5 🪙</b></li><li>Har <b>5 words</b> par <b>weapon automatic</b> badalta hai</li><li><b>💣 Grenade</b> (button ya <b>Enter</b>) = saare words ek saath blast</li><li>Ek word par <b>3 galat key</b> theek, <b>4th galat = Game Over</b></li><li><b>3 target</b> tak pahunch gaye = Game Over</li><li><b>100 words</b> blast karo = 🏆 Mission Complete</li></ul><small>Move: ▲ ▼ ◀ ▶ buttons / keyboard arrows / screen par drag. Red points = Mini-Map par targets.</small>';
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || internal) return;
    if (b === btn) { e.stopPropagation(); activate(); } else if (active) deactivate();
  }, true);
  $('ffSub').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showPanel(b.dataset.p); });
  $('ffGender').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; S.gender = b.dataset.gd; save(); refresh(); renderChar(); });
  $('ffGoShop').onclick = () => showPanel('shop');
  $('ffMute').onclick = () => { S.mute = !S.mute; save(); refresh(); };
  $('ffPause').onclick = () => pause('Aapne game roka hai.');
  goBtn.onclick = () => { if (G.state === 'paused') resume(); else startRun(); };

  /* ---------- controls ---------- */
  root.querySelectorAll('[data-k]').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); ctrl[k] = 1; b.classList.add('act'); try { b.setPointerCapture(e.pointerId); } catch (_) { } };
    const off = () => { ctrl[k] = 0; b.classList.remove('act'); };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('lostpointercapture', off); b.addEventListener('contextmenu', e => e.preventDefault());
  });
  $('ffNade').addEventListener('pointerdown', e => { e.preventDefault(); throwNade(); });
  const stage = $('ffStage');
  stage.addEventListener('pointerdown', e => { if (G.state === 'run') inp.focus({ preventScroll: true }); if (e.target === cv) { drag = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (_) { } } });
  stage.addEventListener('pointermove', e => { if (!drag || G.state !== 'run') return; const r = cv.getBoundingClientRect(), k = W / r.width; dragYaw += (e.clientX - drag.x) * k * .0055; dragMove += -(e.clientY - drag.y) * k * .05; drag.x = e.clientX; drag.y = e.clientY; });
  const endDrag = () => { drag = null; }; stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
  const KMAP = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  document.addEventListener('keydown', e => {
    if (!active || panel !== 'play' || G.state !== 'run') return;
    if (KMAP[e.key]) { e.preventDefault(); kbd[KMAP[e.key]] = 1; }
    else if (e.key === 'Enter' && e.target === inp) { e.preventDefault(); throwNade(); }
    else if (e.key === 'Escape') pause('Aapne game roka hai.');
  });
  document.addEventListener('keyup', e => { if (KMAP[e.key]) kbd[KMAP[e.key]] = 0; });
  let composing = false;
  inp.addEventListener('compositionstart', () => composing = true); inp.addEventListener('compositionend', () => { composing = false; });
  inp.addEventListener('input', () => { const v = inp.value; inp.value = ''; if (G.state !== 'run') return; for (const ch of v) typeChar(ch); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause('Tab badal liya tha'); });
  if ('IntersectionObserver' in window) new IntersectionObserver(es => es.forEach(x => { if (!x.isIntersecting) pause('Aap game se bahar scroll kar gaye the'); }), { threshold: .2 }).observe(root);

  /* debug/test hook (browser console me window.__ff se dekh sakte hain) */
  window.__ff = { get G() { return G; }, P, S, typeChar, throwNade, startRun, WIN };
  refresh();
})();

/* ===== AI Resume & Portfolio Builder (html2pdf) ===== */
(function () {
  'use strict';
  const root = document.getElementById('resume');
  if (!root) return;
  const $ = s => root.querySelector(s), $$ = s => [...root.querySelectorAll(s)];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const lines = s => String(s || '').split('\n').map(x => x.trim()).filter(Boolean);
  const list = s => String(s || '').split(/[,\n]/).map(x => x.trim()).filter(Boolean);
  const KEYS = ['cat', 'name', 'phone', 'email', 'addr', 'obj', 'e10', 'e12', 'grad', 'ccc', 'skills', 'subj', 'exp', 'proj', 'idno', 'course', 'father', 'dob', 'valid', 'result', 'lang', 'role', 'to', 'subject', 'from', 'upto', 'reason'];
  const LS = 'rbData_v1';
  let tpl = 'minimal', photo = '', shape = 'round';
  const ACC = { minimal: '#111827', sidebar: '#0f766e', corporate: '#1e3a8a', creative: '#7c3aed' };

  const val = k => { const e = $('#rb_' + k); return e ? e.value.trim() : ''; };
  const data = () => { const d = { photo, shape }; KEYS.forEach(k => d[k] = val(k)); return d; };
  const fmtD = s => { if (!s) return ''; const p = s.split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; };
  const today = () => { const n = new Date(); return String(n.getDate()).padStart(2, '0') + '/' + String(n.getMonth() + 1).padStart(2, '0') + '/' + n.getFullYear(); };

  /* ---------- Photo cropper ---------- */
  const cv = $('#rbCrop'), cx = cv.getContext('2d');
  const C = { img: null, z: 1, x: 0, y: 0 };
  function drawCrop() {
    const S = cv.width; cx.clearRect(0, 0, S, S);
    if (!C.img) { photo = ''; return; }
    const base = Math.max(S / C.img.width, S / C.img.height) * C.z;
    const w = C.img.width * base, h = C.img.height * base;
    cx.fillStyle = '#fff'; cx.fillRect(0, 0, S, S);
    cx.drawImage(C.img, (S - w) / 2 + C.x * S / 200, (S - h) / 2 + C.y * S / 200, w, h);
    try { photo = cv.toDataURL('image/jpeg', .92); } catch (e) { photo = ''; }
  }
  function cropShape() { cv.style.borderRadius = shape === 'round' ? '50%' : '12px'; }
  $('#rbPhoto').addEventListener('change', e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => { const im = new Image(); im.onload = () => { C.img = im; C.z = 1; C.x = C.y = 0; $('#rbZoom').value = 1; $('#rbX').value = 0; $('#rbY').value = 0; drawCrop(); render(); }; im.src = fr.result; };
    fr.readAsDataURL(f);
  });
  [['#rbZoom', 'z'], ['#rbX', 'x'], ['#rbY', 'y']].forEach(([s, k]) => $(s).addEventListener('input', e => { C[k] = +e.target.value; drawCrop(); render(); }));
  $('#rbShape').addEventListener('change', e => { shape = e.target.value; cropShape(); render(); });
  $('#rbPhotoDel').addEventListener('click', () => { C.img = null; photo = ''; $('#rbPhoto').value = ''; drawCrop(); render(); });
  let drag = null;
  cv.addEventListener('pointerdown', e => { if (!C.img) return; drag = { px: e.clientX, py: e.clientY, x: C.x, y: C.y }; cv.setPointerCapture(e.pointerId); cv.style.cursor = 'grabbing'; });
  cv.addEventListener('pointermove', e => {
    if (!drag) return; const r = cv.getBoundingClientRect(), k = 200 / r.width;
    C.x = Math.max(-100, Math.min(100, drag.x + (e.clientX - drag.px) * k)); C.y = Math.max(-100, Math.min(100, drag.y + (e.clientY - drag.py) * k));
    $('#rbX').value = C.x; $('#rbY').value = C.y; drawCrop(); render();
  });
  const endDrag = () => { drag = null; cv.style.cursor = 'grab'; };
  cv.addEventListener('pointerup', endDrag); cv.addEventListener('pointercancel', endDrag);

  /* ---------- Template pieces ---------- */
  const ph = (d, w) => d.photo
    ? `<img src="${d.photo}" alt="" style="width:${w}px;height:${w}px;object-fit:cover;border-radius:${d.shape === 'round' ? '50%' : '12px'};display:block">`
    : `<div class="rbph" style="width:${w}px;height:${w}px;border-radius:${d.shape === 'round' ? '50%' : '12px'};font-size:${Math.round(w / 3)}px">${esc((d.name || 'A').trim().charAt(0).toUpperCase())}</div>`;
  const S = (t, inner) => inner ? `<section class="rbs"><h3>${t}</h3>${inner}</section>` : '';
  const ul = a => a.length ? '<ul>' + a.map(x => `<li>${esc(x)}</li>`).join('') + '</ul>' : '';
  const chips = a => a.map(x => `<span class="chip">${esc(x)}</span>`).join('');
  const contact = d => [d.phone && '📞 ' + esc(d.phone), d.email && '✉️ ' + esc(d.email), d.addr && '📍 ' + esc(d.addr)].filter(Boolean);
  const WM = '<div class="rbwm">Created via Access Computer Education</div>';
  function parts(d) {
    const teacher = d.cat === 'teacher';
    const obj = d.obj || (teacher ? 'Dedicated and student-friendly teacher seeking a teaching position where I can inspire learners and contribute to the growth of the institution.' : 'Motivated and hardworking candidate seeking a challenging position where I can apply my skills and grow with the organization.');
    const edu = [['10th', d.e10], ['12th', d.e12], ['Graduation / Diploma', d.grad]].filter(x => x[1]).map(x => `<b>${x[0]}:</b> ${esc(x[1])}`);
    const eduHtml = edu.length ? '<ul>' + edu.map(x => `<li>${x}</li>`).join('') + '</ul>' : '';
    const cert = d.ccc ? ul([d.ccc]) : '';
    return {
      obj: S('Career Objective', `<div>${nl(obj)}</div>`),
      edu: S('Education', eduHtml), ccc: S('CCC / O-Level', cert),
      skills: S('Technical Skills', chips(list(d.skills))),
      subj: teacher ? S('Subjects / Classes', ul(list(d.subj))) : '',
      exp: S(teacher ? 'Teaching Experience' : 'Experience', ul(lines(d.exp))),
      proj: S('Projects', ul(lines(d.proj)))
    };
  }
  const title = d => d.cat === 'teacher' ? 'Teacher — Curriculum Vitae' : 'Curriculum Vitae';

  function resume(d) {
    const p = parts(d), con = contact(d), nm = esc(d.name || 'Your Name');
    if (tpl === 'sidebar') return `<div class="rbp-sidebar"><div class="sb"><div class="ph">${ph(d, 130)}</div>${S('Contact', '<div class="rbcon">' + con.map(x => `<div>${x}</div>`).join('') + '</div>')}${p.skills}${p.ccc}${p.subj}</div><div class="mn"><h1>${nm}</h1><div class="role">${title(d)}</div><div style="height:16px"></div>${p.obj}${p.edu}${p.exp}${p.proj}</div>${WM}</div>`;
    const ct = con.map(x => `<span style="margin-right:14px;display:inline-block">${x}</span>`).join('');
    if (tpl === 'corporate') return `<div class="rbp-corporate"><div class="hd"><div><h1>${nm}</h1><div class="role">${title(d)}</div><div class="cn">${ct}</div></div>${ph(d, 108)}</div><div class="bd">${p.obj}${p.edu}${p.ccc}${p.skills}${p.subj}${p.exp}${p.proj}</div>${WM}</div>`;
    if (tpl === 'creative') return `<div class="rbp-creative"><div class="hd"><div><h1>${nm}</h1><div class="role">&lt;${title(d)} /&gt;</div><div class="cn">${ct}</div></div>${ph(d, 108)}</div><div class="bd">${p.obj}${p.skills}${p.edu}${p.ccc}${p.subj}${p.exp}${p.proj}</div>${WM}</div>`;
    return `<div class="rbp-minimal"><div class="hd"><div><h1>${nm}</h1><div class="role">${title(d)}</div><div class="rbcon" style="margin-top:8px">${ct}</div></div>${ph(d, 96)}</div>${p.obj}${p.edu}${p.ccc}${p.skills}${p.subj}${p.exp}${p.proj}${WM}</div>`;
  }

  function letterHead(d) {
    const ac = ACC[tpl], nm = esc(d.name || 'Your Name');
    const base = `<div class="rbcon">${contact(d).join(' &nbsp; ')}</div>`;
    if (tpl === 'minimal') return `<div style="border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:24px"><h1 style="font-size:24px">${nm}</h1>${base}</div>`;
    if (tpl === 'sidebar') return `<div style="border-left:6px solid #14b8a6;padding-left:12px;margin-bottom:24px"><h1 style="font-size:24px;color:#0f766e">${nm}</h1>${base}</div>`;
    const bg = tpl === 'corporate' ? ac : 'linear-gradient(135deg,#7c3aed,#06b6d4)';
    return `<div class="lhd" style="background:${bg}"><h1 style="font-size:24px">${nm}</h1><div class="rbcon">${contact(d).join(' &nbsp; ')}</div></div>`;
  }
  function leave(d) {
    const hi = d.lang === 'hi', f = fmtD(d.from), u = fmtD(d.upto);
    let days = '';
    if (d.from && d.upto) { const n = Math.round((new Date(d.upto) - new Date(d.from)) / 864e5) + 1; if (n > 0) days = n; }
    const reason = d.reason || (hi ? 'आवश्यक कारणवश' : 'urgent personal reasons');
    const sub = d.subject || (hi ? 'अवकाश हेतु प्रार्थना पत्र' : 'Application for leave');
    const nm = esc(d.name || (hi ? 'आपका नाम' : 'Your Name')), role = d.role ? esc(d.role) : '';
    let body;
    if (hi) body = `सविनय निवेदन है कि मैं <b>${esc(reason)}</b> के कारण ${f ? 'दिनांक <b>' + f + '</b>' : 'आज'}${u ? ' से <b>' + u + '</b>' : ''} तक${days ? ' (' + days + ' दिन)' : ''} उपस्थित होने में असमर्थ हूँ।<br><br>अतः आपसे विनम्र प्रार्थना है कि मुझे उक्त अवधि का अवकाश प्रदान करने की कृपा करें। मैं आपका सदैव आभारी रहूँगा/रहूँगी।`;
    else body = `With due respect, I would like to state that I will not be able to attend ${f ? 'from <b>' + f + '</b>' : 'today'}${u ? ' to <b>' + u + '</b>' : ''}${days ? ' (' + days + ' day' + (days > 1 ? 's' : '') + ')' : ''} due to <b>${esc(reason)}</b>.<br><br>I kindly request you to grant me leave for the above-mentioned period. I shall be highly obliged to you.`;
    return `<div class="letter">${letterHead(d)}
      <div class="lrow"><div>${hi ? 'सेवा में,' : 'To,'}<br>${nl(d.to || (hi ? 'प्रधानाचार्य / प्रबंधक' : 'The Principal / Manager'))}</div><div>${hi ? 'दिनांक' : 'Date'}: ${today()}</div></div>
      <p style="margin:22px 0 14px"><b>${hi ? 'विषय' : 'Subject'}: ${esc(sub)}</b></p>
      <p>${hi ? 'महोदय / महोदया,' : 'Respected Sir / Madam,'}</p>
      <p style="margin-top:8px">${body}</p>
      <p style="margin-top:30px">${hi ? 'धन्यवाद।' : 'Thank you.'}</p>
      <p style="margin-top:34px">${hi ? 'आपका आज्ञाकारी,' : 'Yours obediently,'}<br><b>${nm}</b>${role ? '<br>' + role : ''}${d.phone ? '<br>' + esc(d.phone) : ''}</p>${WM}</div>`;
  }

  function idcard(d) {
    const ac = tpl === 'creative' ? 'linear-gradient(135deg,#7c3aed,#06b6d4)' : ACC[tpl], nm = esc(d.name || 'Student Name');
    const fld = (a, b) => b ? `<div><b>${a}:</b> ${esc(b)}</div>` : '';
    const ct = d.course ? esc(d.course) : 'the course';
    return `<div class="idwrap">
      <div class="rb-idcard"><div class="ih" style="background:${ac}">ACCESS COMPUTER EDUCATION CENTRE<div style="font-weight:400;font-size:9.5px">STUDENT IDENTITY CARD</div></div>
        <div class="ib2">${ph(d, 90)}<div class="it"><div style="font-size:14px;font-weight:700">${nm}</div>${fld('ID No', d.idno)}${fld('Course', d.course)}${fld("Father", d.father)}${fld('DOB', fmtD(d.dob))}${fld('Phone', d.phone)}${fld('Address', d.addr)}</div></div>
        <div class="iff" style="background:${ac}"><span>Valid upto: ${esc(fmtD(d.valid) || '—')}</span><span>Authorised Signatory</span></div></div>
      <div class="cert" style="border-color:${tpl === 'creative' ? '#7c3aed' : ACC[tpl]}"><h2 style="color:${tpl === 'creative' ? '#7c3aed' : ACC[tpl]}">CERTIFICATE</h2>
        <p>This is to certify that</p><p style="font-size:22px;font-weight:700;margin:6px 0">${nm}</p>
        <p>${d.father ? 'S/o / D/o ' + esc(d.father) + ', ' : ''}has successfully completed / attended <b>${ct}</b> at <b>Access Computer Education Centre</b>${d.result ? ' with <b>' + esc(d.result) + '</b>' : ''}.</p>
        <p style="margin-top:8px">Date: ${today()}${d.idno ? ' &nbsp;|&nbsp; Reg. No: ' + esc(d.idno) : ''}</p>
        <div class="sig"><div>Student Signature</div><div>Director / Authorised Signatory</div></div></div>${WM}</div>`;
  }

  /* ---------- Render + scale ---------- */
  const paper = $('#rbPaper'), stage = $('#rbStage');
  function render() {
    const d = data();
    paper.innerHTML = d.cat === 'leave' ? leave(d) : d.cat === 'idcard' ? idcard(d) : resume(d);
    paper.className = 'rb-paper' + (d.cat === 'job' || d.cat === 'teacher' ? '' : ' rbp-doc');
    scale();
  }
  function scale() {
    const k = Math.min(1, stage.clientWidth / 794) || 1;
    paper.style.transform = 'scale(' + k + ')';
    stage.style.height = Math.ceil(paper.offsetHeight * k) + 'px';
  }
  window.addEventListener('resize', scale);
  if ('ResizeObserver' in window) new ResizeObserver(scale).observe(stage);

  function showCat() {
    const c = val('cat');
    $$('[data-cat]').forEach(e => e.hidden = !e.dataset.cat.split(' ').includes(c));
  }
  function save() { try { const o = {}; KEYS.forEach(k => o[k] = val(k)); o.tpl = tpl; o.shape = shape; localStorage.setItem(LS, JSON.stringify(o)); } catch (e) { } }
  function load() {
    try {
      const o = JSON.parse(localStorage.getItem(LS) || 'null'); if (!o) return;
      KEYS.forEach(k => { const e = $('#rb_' + k); if (e && o[k] != null) e.value = o[k]; });
      if (o.tpl) tpl = o.tpl; if (o.shape) { shape = o.shape; $('#rbShape').value = shape; }
    } catch (e) { }
    $$('#rbTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === tpl));
  }

  $('#rbForm').addEventListener('input', () => { showCat(); render(); save(); });
  $('#rbForm').addEventListener('change', () => { showCat(); render(); save(); });
  $('#rbTabs').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    tpl = b.dataset.t; $$('#rbTabs button').forEach(x => x.classList.toggle('on', x === b)); render(); save();
  });
  $('#rbClear').addEventListener('click', () => { $('#rbForm').reset(); C.img = null; photo = ''; shape = 'round'; drawCrop(); cropShape(); showCat(); render(); save(); });
  $('#rbSample').addEventListener('click', () => {
    const s = { name: 'Abhay Kumar', phone: '9876543210', email: 'abhay.kumar@email.com', addr: 'Aliganj, Lucknow, Uttar Pradesh', e10: 'UP Board, 2018, 78%', e12: 'UP Board, 2020, 74%', grad: 'BCA, University of Lucknow, 2023, 7.8 CGPA', ccc: 'CCC - A Grade, O-Level - B Grade', skills: 'MS Office, Python, HTML, CSS, JavaScript, Tally, Typing', subj: 'Computer Science, Maths (Class 6-10)', exp: 'Computer Instructor - Access Computer Education (2023-Present)\nData Entry Operator - ABC Enterprises (2022-2023)', proj: 'Student Management System - Python + SQLite\nPersonal Portfolio Website - HTML, CSS, JS', idno: 'ACE-2026-014', course: 'CCC / O-Level', father: 'Mr. Shivram', dob: '2007-11-11', valid: '2027-03-31', result: 'A Grade', role: 'Class 10-A', to: 'The Principal\nABC Public School, Lucknow', subject: 'Application for leave', from: new Date().toISOString().slice(0, 10), upto: new Date(Date.now() + 864e5).toISOString().slice(0, 10), reason: 'high fever and doctor advised rest' };
    Object.keys(s).forEach(k => { const e = $('#rb_' + k); if (e && !e.value) e.value = s[k]; }); render(); save();
  });

  /* ---------- PDF download ---------- */
  $('#rbDl').addEventListener('click', () => {
    const btn = $('#rbDl');
    if (!window.html2pdf) { alert('PDF library load nahi hui. Internet check karke page refresh karein.'); return; }
    const clone = paper.cloneNode(true);
    clone.style.transform = 'none'; clone.style.margin = '0'; clone.style.width = '794px';
    const d = data(), nm = (d.name || 'resume').replace(/[^\w\u0900-\u097F]+/g, '_');
    const old = btn.textContent; btn.disabled = true; btn.textContent = '⏳ PDF ban rahi hai…';
    window.html2pdf().set({
      margin: 0, filename: nm + '_' + d.cat + '.pdf', image: { type: 'jpeg', quality: .98 },
      html2canvas: { scale: 2, useCORS: true, scrollX: 0, scrollY: 0, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['.rbs', '.rb-idcard', '.cert'] }
    }).from(clone).save().then(() => { btn.disabled = false; btn.textContent = old; }).catch(() => { btn.disabled = false; btn.textContent = old; alert('PDF banane me error aaya. Dobara try karein.'); });
  });

  load(); cropShape(); showCat(); drawCrop(); render();
  setTimeout(scale, 300);
})();

/* ============================================================
   CLOUD SUITE + RESULTS HUB + RESUME/FEE RECEIPT (modular)
   Naya tool: CS_TOOLS.push({id,icon,label,render(panel){...}})
   ============================================================ */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const mk = (t, c, h) => { const e = document.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; };
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const dl = (name, data, type) => { const a = mk('a'); a.href = URL.createObjectURL(new Blob([data], { type })); a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); };
  const pdf = (el, name) => { if (window.html2pdf) html2pdf().set({ margin: 8, filename: name, image: { type: 'jpeg', quality: .98 }, html2canvas: { scale: 2 }, jsPDF: { unit: 'mm', format: 'a4' } }).from(el).save(); else window.print(); };
  const btn = (txt, fn) => { const b = mk('button', '', txt); b.type = 'button'; b.onclick = fn; return b; };
  const tabs = (tabBox, panel, list) => {
    list.forEach((t, i) => { const b = btn(t.icon + ' ' + t.label, () => { [...tabBox.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); panel.innerHTML = ''; t.render(panel); }); tabBox.appendChild(b); if (!i) b.click(); });
  };

  /* ---------- Tool 1: Writer ---------- */
  const writer = p => {
    const bar = mk('div', 'cs-bar'), doc = mk('div', 'cs-doc', '<h2>Document Title</h2><p>Yahan type karein...</p>');
    doc.contentEditable = true;
    const cmd = (l, c, v) => bar.appendChild(btn(l, () => { doc.focus(); document.execCommand(c, false, v || null); }));
    cmd('B', 'bold'); cmd('I', 'italic'); cmd('U', 'underline'); cmd('• List', 'insertUnorderedList'); cmd('1. List', 'insertOrderedList');
    cmd('Left', 'justifyLeft'); cmd('Center', 'justifyCenter'); cmd('Right', 'justifyRight'); cmd('Undo', 'undo'); cmd('Redo', 'redo');
    const fs = mk('select', '', [1, 2, 3, 4, 5, 6, 7].map(n => `<option value="${n}" ${n == 3 ? 'selected' : ''}>Size ${n}</option>`).join('')); fs.onchange = () => { doc.focus(); document.execCommand('fontSize', false, fs.value); }; bar.appendChild(fs);
    const col = mk('input'); col.type = 'color'; col.value = '#000000'; col.oninput = () => { doc.focus(); document.execCommand('foreColor', false, col.value); }; bar.appendChild(col);
    bar.appendChild(btn('⬇ PDF', () => pdf(doc, 'document.pdf')));
    bar.appendChild(btn('⬇ Word (.doc)', () => dl('document.doc', `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"></head><body>${doc.innerHTML}</body></html>`, 'application/msword')));
    bar.appendChild(btn('⬇ HTML', () => dl('document.html', doc.innerHTML, 'text/html')));
    p.append(bar, doc);
  };

  /* ---------- Tool 2: Calc ---------- */
  const calc = p => {
    const R = 25, C = 10, L = i => String.fromCharCode(65 + i), data = {};
    const val = (k, d = 0) => {
      if (d > 20) return NaN; const v = (data[k] ?? '').toString().trim(); if (v[0] !== '=') return v === '' ? 0 : isNaN(v) ? v : +v;
      let e = v.slice(1).toUpperCase();
      const rng = a => { a = a.trim(); const m = a.match(/^([A-J])(\d+):([A-J])(\d+)$/); if (!m) return [num(a, d)]; const o = []; for (let c = m[1].charCodeAt(0); c <= m[3].charCodeAt(0); c++)for (let r = +m[2]; r <= +m[4]; r++) o.push(num(String.fromCharCode(c) + r, d)); return o; };
      e = e.replace(/(SUM|AVERAGE|AVG|MIN|MAX|COUNT)\(([^)]*)\)/g, (_, f, a) => { const n = a.split(',').flatMap(rng).filter(x => typeof x === 'number' && !isNaN(x)); const s = n.reduce((x, y) => x + y, 0); return { SUM: s, AVERAGE: n.length ? s / n.length : 0, AVG: n.length ? s / n.length : 0, MIN: Math.min(...n), MAX: Math.max(...n), COUNT: n.length }[f]; });
      e = e.replace(/\b([A-J]\d+)\b/g, (_, c) => num(c, d));
      if (!/^[0-9+\-*/().\s eE]*$/.test(e)) return '#ERR'; try { const r = Function('return (' + e + ')')(); return isFinite(r) ? +r.toFixed(6) : '#DIV/0'; } catch { return '#ERR'; }
    };
    const num = (k, d) => { const r = val(k, d + 1); return typeof r === 'number' ? r : 0; };
    const t = mk('table', 'cs-grid'), inputs = {};
    const build = () => {
      t.innerHTML = '<tr><th></th>' + [...Array(C)].map((_, i) => `<th>${L(i)}</th>`).join('') + '</tr>';
      for (let r = 1; r <= R; r++) { const tr = mk('tr', '', `<td class="rh">${r}</td>`); for (let c = 0; c < C; c++) { const k = L(c) + r, td = mk('td'), i = mk('input'); i.value = data[k] ?? ''; inputs[k] = i; i.onfocus = () => i.value = data[k] ?? ''; i.onblur = () => { data[k] = i.value; refresh(); }; i.onkeydown = e => { if (e.key === 'Enter') i.blur(); }; td.appendChild(i); tr.appendChild(td); } t.appendChild(tr); }
      refresh();
    };
    const refresh = () => Object.keys(inputs).forEach(k => { if (document.activeElement !== inputs[k]) { const v = data[k]; inputs[k].value = v && String(v)[0] === '=' ? val(k) : (v ?? ''); } });
    const bar = mk('div', 'cs-bar');
    bar.append(
      btn('+ Row', () => { }), btn('Delete Last Row', () => { for (let c = 0; c < C; c++)delete data[L(c) + R]; refresh(); }),
      btn('Clear All', () => { Object.keys(data).forEach(k => delete data[k]); refresh(); }),
      btn('⬇ CSV', () => { const rows = []; for (let r = 1; r <= R; r++) { const row = []; for (let c = 0; c < C; c++)row.push('"' + String(val(L(c) + r)).replace(/"/g, '""') + '"'); rows.push(row.join(',')); } dl('sheet.csv', '\ufeff' + rows.join('\n'), 'text/csv'); }),
      btn('⬇ Excel (.xls)', () => dl('sheet.xls', '<html><head><meta charset="utf-8"></head><body>' + t.outerHTML.replace(/<input[^>]*value="([^"]*)"[^>]*>/g, '$1') + '</body></html>', 'application/vnd.ms-excel')),
      mk('span', '', '<small style="color:#9db2d6;padding:8px">Formula: =SUM(A1:A5) =AVERAGE(B1:B4) =MIN =MAX =COUNT =A1*B1</small>'));
    bar.children[0].onclick = () => { for (let c = 0; c < C; c++) { } const tr = mk('tr', '', `<td class="rh">+</td>`); for (let c = 0; c < C; c++) { const td = mk('td'), i = mk('input'); td.appendChild(i); tr.appendChild(td); } t.appendChild(tr); };
    bar.children[0].textContent = '+ Blank Row';
    const w = mk('div', 'cs-grid-w'); w.appendChild(t); p.append(bar, w); build();
  };

  /* ---------- Tool 3: Impress ---------- */
  const impress = p => {
    let s = [{ t: 'Welcome', b: 'Apni presentation yahan likhein' }], cur = 0;
    const bar = mk('div', 'cs-bar'), wrap = mk('div', 'cs-slides'), th = mk('div', 'cs-thumbs'), main = mk('div'), slide = mk('div', 'cs-slide', '<div class="t" contenteditable></div><div class="b" contenteditable></div>');
    const T = slide.children[0], B = slide.children[1];
    const save = () => { s[cur] = { t: T.innerText, b: B.innerText }; };
    const show = i => { save(); cur = i; T.innerText = s[i].t; B.innerText = s[i].b; th.innerHTML = ''; s.forEach((x, j) => { const d = mk('div', j == cur ? 'on' : '', `<b>${j + 1}</b> ${esc(x.t)}`); d.onclick = () => show(j); th.appendChild(d); }); };
    T.oninput = B.oninput = save;
    bar.append(btn('+ Slide', () => { save(); s.push({ t: 'New Slide', b: '' }); show(s.length - 1); }), btn('Delete Slide', () => { if (s.length > 1) { s.splice(cur, 1); show(Math.max(0, cur - 1)); } }),
      btn('▶ Present', () => { save(); const e = slide; e.requestFullscreen && e.requestFullscreen(); }),
      btn('⬇ PDF (all slides)', () => { save(); const h = mk('div'); s.forEach(x => h.appendChild(mk('div', 'cs-slide', `<div class="t">${esc(x.t)}</div><div class="b">${esc(x.b).replace(/\n/g, '<br>')}</div>`)).style.cssText = 'page-break-after:always;height:180mm;width:260mm'); pdf(h, 'presentation.pdf'); }),
      btn('⬇ PowerPoint-compatible (.doc)', () => { save(); dl('presentation.doc', '<html><head><meta charset="utf-8"></head><body>' + s.map((x, i) => `<h1>Slide ${i + 1}: ${esc(x.t)}</h1><p>${esc(x.b).replace(/\n/g, '<br>')}</p><br style="page-break-after:always">`).join('') + '</body></html>', 'application/msword'); }));
    main.appendChild(slide); wrap.append(th, main); p.append(bar, wrap); show(0);
  };

  /* ---------- Tool 4: Tally ledger ---------- */
  const tally = p => {
    const KEY = 'acec_tally', v = (() => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } })();
    const f = mk('div', 'cs-f cs-two', `<div><label>Date</label><input type="date" id="tD"></div><div><label>Voucher</label><select id="tV"><option>Payment</option><option>Receipt</option><option>Sales</option><option>Purchase</option><option>Journal</option></select></div>
    <div><label>Ledger / Particulars</label><input id="tL" placeholder="e.g. Cash, Sales A/c"></div><div><label>Debit (Dr) ₹</label><input id="tDr" type="number" min="0"></div><div><label>Credit (Cr) ₹</label><input id="tCr" type="number" min="0"></div><div><label>Narration</label><input id="tN"></div>`);
    const out = mk('div'), bar = mk('div', 'cs-bar');
    const draw = () => {
      try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { }
      const led = {}; v.forEach(x => { led[x.l] = led[x.l] || { d: 0, c: 0 }; led[x.l].d += +x.d; led[x.l].c += +x.c; });
      const td = v.reduce((a, x) => a + +x.d, 0), tc = v.reduce((a, x) => a + +x.c, 0);
      out.innerHTML = `<h4>Day Book</h4><div class="cs-grid-w"><table class="cs-tbl"><tr><th>Date</th><th>Type</th><th>Particulars</th><th class="r">Dr</th><th class="r">Cr</th><th>Narration</th><th></th></tr>${v.map((x, i) => `<tr><td>${esc(x.dt)}</td><td>${esc(x.v)}</td><td>${esc(x.l)}</td><td class="r">${(+x.d).toFixed(2)}</td><td class="r">${(+x.c).toFixed(2)}</td><td>${esc(x.n)}</td><td><button data-x="${i}">✕</button></td></tr>`).join('')}</table></div>
      <h4 style="margin-top:12px">Trial Balance</h4><table class="cs-tbl"><tr><th>Ledger</th><th class="r">Debit</th><th class="r">Credit</th><th class="r">Closing</th></tr>${Object.entries(led).map(([k, a]) => { const b = a.d - a.c; return `<tr><td>${esc(k)}</td><td class="r">${a.d.toFixed(2)}</td><td class="r">${a.c.toFixed(2)}</td><td class="r">${Math.abs(b).toFixed(2)} ${b >= 0 ? 'Dr' : 'Cr'}</td></tr>`; }).join('')}<tr><th>Total</th><th class="r">${td.toFixed(2)}</th><th class="r">${tc.toFixed(2)}</th><th class="r">${td === tc ? '✔ Tallied' : '⚠ Difference ' + Math.abs(td - tc).toFixed(2)}</th></tr></table>`;
      out.querySelectorAll('[data-x]').forEach(b => b.onclick = () => { v.splice(+b.dataset.x, 1); draw(); });
    };
    bar.append(btn('+ Add Entry', () => { const g = id => $('#' + id, f).value; if (!g('tL').trim()) return alert('Ledger name likhein'); v.push({ dt: g('tD') || new Date().toISOString().slice(0, 10), v: g('tV'), l: g('tL').trim(), d: g('tDr') || 0, c: g('tCr') || 0, n: g('tN') }); draw(); }),
      btn('⬇ CSV', () => dl('daybook.csv', '\ufeffDate,Type,Particulars,Dr,Cr,Narration\n' + v.map(x => [x.dt, x.v, x.l, x.d, x.c, x.n].map(z => '"' + String(z).replace(/"/g, '""') + '"').join(',')).join('\n'), 'text/csv')),
      btn('⬇ PDF', () => pdf(out, 'tally-ledger.pdf')), btn('Clear', () => { if (confirm('Saari entries delete karein?')) { v.length = 0; draw(); } }));
    p.append(f, bar, out); draw();
  };

  window.CS_TOOLS = [
    { id: 'writer', icon: '📝', label: 'Writer / MS Word', render: writer },
    { id: 'calc', icon: '📊', label: 'Calc / MS Excel', render: calc },
    { id: 'impress', icon: '📽️', label: 'Impress / PowerPoint', render: impress },
    { id: 'tally', icon: '📒', label: 'Tally Prime / Ledger', render: tally }
  ];

  /* ---------- Results hub ---------- */
  const CERT_DB = [{ no: 'ACEC/1002', name: 'Deva Vishwakarma', course: 'Tally Prime with GST', grade: 'A', date: '08-SEP-2026' }]; // naye certificates yahin add karein
  const results = [
    { t: '🎓 CCC Result / Certificate', d: 'NIELIT ki official site par CCC result dekhein.', u: 'https://nielit.gov.in/' },
    { t: '💻 O-Level Result / Certificate', d: 'NIELIT student portal par O-Level result aur certificate.', u: 'https://student.nielit.gov.in/' },
    { t: '🏛️ NIELIT Verification', d: 'Certificate verification ke liye official portal.', u: 'https://nielit.gov.in/content/verification' }
  ];
  const rh = $('#csResults');
  if (rh) {
    results.forEach(r => { const c = mk('div', 'cs-link', `<h3>${r.t}</h3><p>${r.d}</p>`); c.append(Object.assign(mk('a', 'btn sm', 'Open Official Site ↗'), { href: r.u, target: '_blank', rel: 'noopener' }), mk('span', '', ' '), btn('Embed', () => { if (!c.$f) { c.$f = mk('iframe'); c.$f.src = r.u; c.appendChild(c.$f); c.appendChild(mk('p', '', 'Agar page khali dikhe to site embed block karti hai — "Open Official Site" use karein.')); } })); rh.appendChild(c); });
    const v = mk('div', 'cs-link', `<h3>✅ Access Certificate Verify</h3><p>Certificate No. (jaise ACEC/1002) daalein.</p><div class="cs-bar"><input id="cvNo" placeholder="ACEC/1002"></div><div id="cvOut"></div>`);
    $('.cs-bar', v).appendChild(btn('Verify', () => { const n = $('#cvNo').value.trim().toUpperCase(), r = CERT_DB.find(x => x.no === n); $('#cvOut').innerHTML = r ? `<p style="color:#22c55e">✔ Valid: ${esc(r.name)} — ${esc(r.course)}, Grade ${esc(r.grade)}, ${esc(r.date)}</p>` : '<p style="color:#ef4444">✖ Record nahi mila. Centre se sampark karein: 9935035866</p>'; }));
    rh.appendChild(v);
  }

  /* ---------- Resume + Fee Receipt ---------- */
  const resume = p => {
    const F = [['name', 'Name', 'Rahul Kumar'], ['father', "Father's Name", 'Shri Ram Kumar'], ['dob', 'Date of Birth', '01-01-2003'], ['phone', 'Mobile', '9876543210'], ['email', 'Email', 'rahul@email.com'], ['address', 'Address', 'Raebareli, Uttar Pradesh'], ['qual', 'Qualification (ek line me ek)', '10th - UP Board\n12th - UP Board\nO-Level - NIELIT'], ['skills', 'Skills (ek line me ek)', 'MS Office\nTally Prime with GST\nTyping'], ['obj', 'Career Objective', 'Computer field me apni skills ke saath company ki growth me yogdaan dena.']];
    const form = mk('div', 'cs-f'), tpl = mk('select', '', '<option value="t1">Template 1 — Blue Header</option><option value="t2">Template 2 — Classic</option>'), prev = mk('div', 'cs-paper cs-rs t1');
    F.forEach(([k, l, d]) => { const w = mk('div', '', `<label>${l}</label>` + (d.length > 40 || d.includes('\n') ? `<textarea rows="3" data-k="${k}">${esc(d)}</textarea>` : `<input data-k="${k}" value="${esc(d)}">`)); form.appendChild(w); });
    const li = s => s.split('\n').filter(Boolean).map(x => `<li>${esc(x)}</li>`).join('');
    const draw = () => { const g = k => $(`[data-k=${k}]`, form).value; prev.className = 'cs-paper cs-rs ' + tpl.value; prev.innerHTML = `<h1 style="margin:0 0 8px">${esc(g('name'))}</h1><div>📞 ${esc(g('phone'))} | ✉ ${esc(g('email'))}<br>📍 ${esc(g('address'))}</div><h4>Career Objective</h4><p>${esc(g('obj'))}</p><h4>Educational Qualification</h4><ul>${li(g('qual'))}</ul><h4>Skills</h4><ul>${li(g('skills'))}</ul><h4>Personal Details</h4><p>Father's Name: ${esc(g('father'))}<br>Date of Birth: ${esc(g('dob'))}</p>`; };
    form.oninput = tpl.onchange = draw; draw();
    const bar = mk('div', 'cs-bar'); bar.append(tpl, btn('⬇ Download PDF', () => pdf(prev, 'resume.pdf')), btn('🖨 Print', () => { prev.classList.add('cs-printing'); window.print(); prev.classList.remove('cs-printing'); }));
    p.append(mk('div', 'cs-two')); p.firstChild.append(mk('div', '', '').appendChild(form).parentNode, mk('div')); p.firstChild.lastChild.append(bar, prev);
  };
  const receipt = p => {
    const n = (() => { try { return (+localStorage.getItem('acec_rc') || 273) + 1; } catch { return 274; } })();
    const form = mk('div', 'cs-f', `<label>Receipt No.</label><input data-k="no" value="${n}"><label>Student Name</label><input data-k="name"><label>Father / Husband Name</label><input data-k="father"><label>Course</label><input data-k="course" placeholder="O-Level / CCC / Tally"><label>Amount (₹)</label><input data-k="amt" type="number"><label>Payment Mode</label><select data-k="mode"><option>Cash</option><option>Online</option><option>Cheque</option><option>D.Draft</option></select><label>Date</label><input data-k="date" type="date" value="${new Date().toISOString().slice(0, 10)}"><label>Next Due Date</label><input data-k="due" type="date"><label>Late Fee (₹)</label><input data-k="late" type="number"><label>Balance (₹)</label><input data-k="bal" type="number">`);
    const prev = mk('div', 'cs-paper cs-rc'), words = x => { x = Math.floor(+x) || 0; const o = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']; const b = n => n < 20 ? o[n] : t[Math.floor(n / 10)] + ' ' + o[n % 10]; const h = n => (n > 99 ? o[Math.floor(n / 100)] + ' Hundred ' : '') + b(n % 100); if (!x) return 'Zero'; return [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']].reduce((s, [d, nm]) => { if (x >= d) { s += h(Math.floor(x / d)) + ' ' + nm + ' '; x %= d; } return s; }, '') + (x ? h(x) : ''); };
    const draw = () => { const g = k => $(`[data-k=${k}]`, form).value; prev.innerHTML = `<div class="hd"><svg width="56" height="56" viewBox="0 0 100 100"><polygon points="50,8 95,90 5,90" fill="#1e3a8a"/><polygon points="50,30 78,80 22,80" fill="#fff"/><polygon points="50,45 66,76 34,76" fill="#f59e0b"/></svg><div><h2 style="text-align:left">ACCESS COMPUTER EDUCATION CENTRE</h2><small>Run under Social Welfare Society of Education (Regd. Act 21-1860, Govt. of India)<br>H.No.438-A, Sanjay Nagar Colony, Behind Govt. Girls Inter College, Bachhrawan, Raebareli-229301 | Mob: 9935035866, 6393512412</small></div></div><div style="display:flex;justify-content:space-between"><b>FEE RECEIPT</b><span>Receipt No.: <b>${esc(g('no'))}</b> &nbsp; Date: <b>${esc(g('date'))}</b></span></div><div class="ln">Received with thanks from Mr./Miss/Mrs. <b>${esc(g('name'))}</b></div><div class="ln">S/o, D/o, W/o <b>${esc(g('father'))}</b></div><div class="ln">the sum of Rupees (Non Refundable) <b>${words(g('amt'))} Only</b></div><div class="ln">By ${esc(g('mode'))} &nbsp; Against: <b>${esc(g('course'))}</b></div><div class="ln">Late Fee: ₹${esc(g('late') || 0)} &nbsp; Balance: ₹${esc(g('bal') || 0)} &nbsp; Next Due Date: ${esc(g('due'))}</div><div style="display:flex;justify-content:space-between;align-items:end;margin-top:14px"><span class="amt">₹ ${esc(g('amt') || 0)}/-</span><span>_____________<br>Auth. Signature</span></div><small>Note: Deposited amount will not be refunded.</small>`; };
    form.oninput = draw; draw();
    const bar = mk('div', 'cs-bar'); bar.append(btn('⬇ Download PDF', () => { try { localStorage.setItem('acec_rc', $('[data-k=no]', form).value); } catch { } pdf(prev, 'fee-receipt-' + $('[data-k=no]', form).value + '.pdf'); }), btn('🖨 Print', () => { prev.classList.add('cs-printing'); window.print(); prev.classList.remove('cs-printing'); }));
    const g2 = mk('div', 'cs-two'), r = mk('div'); r.append(bar, prev); g2.append(form, r); p.appendChild(g2);
  };
  window.CS_TOOLS2 = [{ id: 'resume', icon: '📄', label: 'Resume Builder', render: resume }, { id: 'receipt', icon: '🧾', label: 'Fee Receipt', render: receipt }];

  const start = () => { const a = $('#csTabs'), b = $('#csTabs2'); if (a) tabs(a, $('#csPanel'), window.CS_TOOLS); if (b) tabs(b, $('#csPanel2'), window.CS_TOOLS2); };
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', start) : start();
})();

/* ============================================================
   ⌨️ SHORTCUT KEYS & QUIZ MASTER  +  ✨ HERO CHARACTER MORPH
   1) Software selector -> instant shortcut table (search enabled)
   2) 3D Neon Quiz (Next / Previous, wrong-answer floating neon card)
   3) Downloadable / viewable PDF cheat sheets (generated in-browser)
   4) Hero walk-in -> hands down -> morph into neon welcome box
   ============================================================ */
(function () {
  'use strict';
  const q = (s, r) => (r || document).querySelector(s);
  const qa = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* ---------- DATA ( keys are written as "Ctrl + Shift + S" ) ---------- */
  const SK = [
    { id: 'writer', name: 'LibreOffice Writer', icon: '📝', list: [
      ['Ctrl + N', 'Create a new document'], ['Ctrl + O', 'Open a document'], ['Ctrl + S', 'Save the document'], ['Ctrl + Shift + S', 'Save As'],
      ['Ctrl + P', 'Print the document'], ['Ctrl + Z', 'Undo last action'], ['Ctrl + Y', 'Redo last action'], ['Ctrl + A', 'Select all content'],
      ['Ctrl + C', 'Copy selection'], ['Ctrl + X', 'Cut selection'], ['Ctrl + V', 'Paste from clipboard'], ['Ctrl + Shift + V', 'Open Paste Special dialog'],
      ['Ctrl + B', 'Bold text'], ['Ctrl + I', 'Italic text'], ['Ctrl + U', 'Underline text'], ['Ctrl + E', 'Center align paragraph'],
      ['Ctrl + L', 'Left align paragraph'], ['Ctrl + R', 'Right align paragraph'], ['Ctrl + J', 'Justify paragraph'], ['Ctrl + H', 'Open Find & Replace'],
      ['F7', 'Check spelling'], ['Ctrl + Enter', 'Insert a page break'], ['Ctrl + 1', 'Apply Heading 1 style'], ['Ctrl + Shift + P', 'Superscript'],
      ['Ctrl + Shift + B', 'Subscript'], ['Ctrl + K', 'Insert hyperlink'], ['F11', 'Open Styles sidebar'], ['F5', 'Open Navigator'],
      ['Ctrl + Home', 'Go to start of document'], ['Ctrl + End', 'Go to end of document'], ['Ctrl + Q', 'Quit LibreOffice']
    ] },
    { id: 'word', name: 'MS Word', icon: '📘', list: [
      ['Ctrl + N', 'New blank document'], ['Ctrl + O', 'Open a document'], ['Ctrl + S', 'Save'], ['F12', 'Save As'], ['Ctrl + P', 'Print'],
      ['Ctrl + Z', 'Undo'], ['Ctrl + Y', 'Redo'], ['Ctrl + A', 'Select all'], ['Ctrl + C', 'Copy'], ['Ctrl + X', 'Cut'], ['Ctrl + V', 'Paste'],
      ['Ctrl + B', 'Bold'], ['Ctrl + I', 'Italic'], ['Ctrl + U', 'Underline'], ['Ctrl + E', 'Center align'], ['Ctrl + L', 'Left align'],
      ['Ctrl + R', 'Right align'], ['Ctrl + J', 'Justify'], ['Ctrl + F', 'Find (Navigation pane)'], ['Ctrl + H', 'Find and Replace'],
      ['Ctrl + G', 'Go To page / line'], ['F7', 'Spelling and Grammar check'], ['Ctrl + Enter', 'Insert a page break'], ['Ctrl + Alt + 1', 'Apply Heading 1'],
      ['Ctrl + K', 'Insert hyperlink'], ['Ctrl + D', 'Open Font dialog'], ['Ctrl + Shift + C', 'Copy formatting'], ['Ctrl + Shift + V', 'Paste formatting'],
      ['Shift + F3', 'Change text case'], ['Ctrl + =', 'Subscript'], ['Ctrl + Shift + =', 'Superscript'], ['Ctrl + 2', 'Double line spacing'],
      ['Ctrl + W', 'Close the document'], ['Ctrl + Home', 'Go to start of document']
    ] },
    { id: 'calc', name: 'LibreOffice Calc', icon: '📗', list: [
      ['Ctrl + S', 'Save the spreadsheet'], ['Ctrl + Z', 'Undo'], ['Ctrl + Home', 'Go to cell A1'], ['Ctrl + End', 'Go to last used cell'],
      ['F2', 'Edit the active cell'], ['Ctrl + ;', 'Insert current date'], ['Ctrl + Shift + ;', 'Insert current time'], ['Ctrl + D', 'Fill down'],
      ['Shift + F4', 'Cycle absolute / relative reference'], ['Alt + =', 'AutoSum'], ['Ctrl + Space', 'Select entire column'], ['Shift + Space', 'Select entire row'],
      ['Ctrl + 1', 'Open Format Cells dialog'], ['Ctrl + Shift + 4', 'Currency format'], ['Ctrl + Shift + 5', 'Percent format'], ['Ctrl + Shift + L', 'Toggle AutoFilter'],
      ['Ctrl + Page Down', 'Move to next sheet'], ['Ctrl + Page Up', 'Move to previous sheet'], ['Ctrl + F2', 'Open Function Wizard'], ['F9', 'Recalculate formulas'],
      ['Ctrl + Shift + V', 'Open Paste Special'], ['Ctrl + Enter', 'Fill selection with the entry'], ['F5', 'Open Navigator']
    ] },
    { id: 'excel', name: 'MS Excel', icon: '📊', list: [
      ['Ctrl + N', 'New workbook'], ['Ctrl + O', 'Open workbook'], ['Ctrl + S', 'Save'], ['F12', 'Save As'], ['Ctrl + P', 'Print'], ['Ctrl + Z', 'Undo'],
      ['Ctrl + Y', 'Redo'], ['Ctrl + C', 'Copy'], ['Ctrl + V', 'Paste'], ['Ctrl + B', 'Bold'], ['F2', 'Edit the active cell'],
      ['F4', 'Toggle absolute / relative reference'], ['Ctrl + ;', 'Insert current date'], ['Ctrl + Shift + ;', 'Insert current time'], ['Ctrl + D', 'Fill down'],
      ['Ctrl + R', 'Fill right'], ['Alt + =', 'AutoSum'], ['Ctrl + Space', 'Select entire column'], ['Shift + Space', 'Select entire row'],
      ['Ctrl + Home', 'Go to cell A1'], ['Ctrl + End', 'Go to last used cell'], ['Ctrl + 1', 'Open Format Cells'], ['Ctrl + Shift + L', 'Toggle filter'],
      ['Ctrl + T', 'Create a table'], ['Ctrl + Page Down', 'Move to next worksheet'], ['Shift + F11', 'Insert a new worksheet'], ['Ctrl + 9', 'Hide selected rows'],
      ['Ctrl + 0', 'Hide selected columns'], ['Alt + Enter', 'New line inside a cell'], ['F11', 'Create chart on a new sheet'], ['Ctrl + F', 'Find'],
      ['Ctrl + H', 'Replace'], ['F9', 'Calculate the workbook']
    ] },
    { id: 'tally', name: 'Tally Prime', icon: '🧾', list: [
      ['F4', 'Contra voucher'], ['F5', 'Payment voucher'], ['F6', 'Receipt voucher'], ['F7', 'Journal voucher'], ['F8', 'Sales voucher'],
      ['F9', 'Purchase voucher'], ['Ctrl + F8', 'Credit Note voucher'], ['Ctrl + F9', 'Debit Note voucher'], ['Alt + F7', 'Stock Journal voucher'],
      ['Ctrl + A', 'Accept / save the screen'], ['Ctrl + Q', 'Quit or abandon the screen'], ['Esc', 'Go back / cancel'], ['Alt + C', 'Create a master on the fly'],
      ['Alt + D', 'Delete a voucher or master'], ['Alt + X', 'Cancel a voucher'], ['Alt + I', 'Insert a voucher'], ['Alt + 2', 'Duplicate a voucher'],
      ['Ctrl + P', 'Print the report'], ['Ctrl + E', 'Export the report'], ['F12', 'Open Configure screen'], ['Alt + G', 'Go To any screen']
    ] },
    { id: 'photoshop', name: 'Adobe Photoshop', icon: '🎨', list: [
      ['Ctrl + N', 'New document'], ['Ctrl + O', 'Open a file'], ['Ctrl + S', 'Save'], ['Ctrl + Shift + S', 'Save As'], ['Ctrl + Z', 'Undo / Redo (toggle)'],
      ['Ctrl + Alt + Z', 'Step backward in history'], ['Ctrl + Shift + Z', 'Step forward in history'], ['Ctrl + J', 'Duplicate the layer'],
      ['Ctrl + Shift + N', 'Create a new layer'], ['Ctrl + T', 'Free Transform'], ['Ctrl + D', 'Deselect'], ['Ctrl + Shift + I', 'Inverse the selection'],
      ['Ctrl + A', 'Select all'], ['Ctrl + E', 'Merge layer down'], ['Ctrl + Shift + E', 'Merge visible layers'], ['Ctrl + G', 'Group the layers'],
      ['V', 'Move tool'], ['M', 'Marquee tool'], ['L', 'Lasso tool'], ['W', 'Quick Selection / Magic Wand tool'], ['C', 'Crop tool'], ['B', 'Brush tool'],
      ['E', 'Eraser tool'], ['T', 'Type tool'], ['G', 'Gradient / Paint Bucket tool'], ['X', 'Swap foreground and background colors'], ['D', 'Reset default colors'],
      ['Ctrl + 0', 'Fit image on screen'], ['Ctrl + Alt + I', 'Open Image Size'], ['Ctrl + Alt + C', 'Open Canvas Size'], ['Ctrl + L', 'Open Levels'],
      ['Ctrl + M', 'Open Curves'], ['Ctrl + U', 'Open Hue / Saturation']
    ] },
    { id: 'powerpoint', name: 'MS PowerPoint', icon: '📙', list: [
      ['Ctrl + N', 'New presentation'], ['Ctrl + S', 'Save'], ['Ctrl + M', 'Insert a new slide'], ['Ctrl + D', 'Duplicate the selected object'],
      ['F5', 'Start slide show from the beginning'], ['Shift + F5', 'Start slide show from the current slide'], ['Esc', 'End the slide show'],
      ['B', 'Black screen during show'], ['W', 'White screen during show'], ['N', 'Next slide during show'], ['P', 'Previous slide during show'],
      ['Ctrl + P', 'Pen pointer (during slide show)'], ['Ctrl + K', 'Insert hyperlink'], ['Ctrl + G', 'Group objects'], ['Ctrl + Shift + G', 'Ungroup objects'],
      ['F7', 'Check spelling'], ['Ctrl + B', 'Bold'], ['Ctrl + E', 'Center align'], ['Ctrl + Shift + C', 'Copy formatting']
    ] },
    { id: 'windows', name: 'Windows Basics', icon: '🪟', list: [
      ['Win + D', 'Show or hide the desktop'], ['Win + E', 'Open File Explorer'], ['Win + L', 'Lock the PC'], ['Win + R', 'Open the Run dialog'],
      ['Win + I', 'Open Settings'], ['Alt + Tab', 'Switch between open apps'], ['Alt + F4', 'Close the active window'], ['Ctrl + Shift + Esc', 'Open Task Manager'],
      ['Win + Shift + S', 'Take a screenshot (Snipping tool)'], ['Win + V', 'Open Clipboard history'], ['F2', 'Rename the selected file'],
      ['Shift + Delete', 'Delete a file permanently'], ['Win + Tab', 'Open Task View'], ['Ctrl + Alt + Delete', 'Open the security options screen'],
      ['Win + A', 'Open Quick Settings'], ['Win + P', 'Project to a second screen'], ['PrtScn', 'Copy screenshot of the full screen']
    ] }
  ];
  const byId = id => SK.find(s => s.id === id);
  const kbd = keys => keys.split(' + ').map(k => '<kbd>' + esc(k) + '</kbd>').join('<i class="sk-plus">+</i>');

  /* ---------- tiny toast ---------- */
  let toastEl, toastT;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'sk-toast'; document.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- PDF cheat sheets (html2pdf, generated in browser) ---------- */
  function sheetEl(sw) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-10000px;top:0;width:760px;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;padding:26px';
    let rows = '';
    sw.list.forEach((r, i) => { rows += '<tr style="background:' + (i % 2 ? '#f3f7ff' : '#fff') + '"><td style="padding:7px 9px;border:1px solid #cfd8ee;width:36px;text-align:center;color:#666">' + (i + 1) +
      '</td><td style="padding:7px 9px;border:1px solid #cfd8ee;width:210px;font-weight:700;font-family:Consolas,monospace;color:#3a1aa8">' + esc(r[0]) +
      '</td><td style="padding:7px 9px;border:1px solid #cfd8ee">' + esc(r[1]) + '</td></tr>'; });
    wrap.innerHTML = '<div style="border-bottom:4px solid #00b8d4;padding-bottom:10px;margin-bottom:14px"><div style="font-size:13px;color:#555;letter-spacing:1px">ACCESS COMPUTER CENTER &bull; BACHHRAWAN, RAEBARELI</div>' +
      '<div style="font-size:26px;font-weight:800;color:#1a1a3a;margin-top:4px">' + esc(sw.name) + ' &mdash; Shortcut Keys Cheat Sheet</div></div>' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr style="background:#1a1a3a;color:#fff"><th style="padding:8px;border:1px solid #1a1a3a">#</th><th style="padding:8px;border:1px solid #1a1a3a;text-align:left">Shortcut Key</th><th style="padding:8px;border:1px solid #1a1a3a;text-align:left">Function</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div style="margin-top:16px;font-size:11px;color:#777;text-align:right">Created via Access Computer Center &bull; ' + sw.list.length + ' shortcuts</div>';
    document.body.appendChild(wrap);
    return wrap;
  }
  function makePdf(id, mode) {
    const sw = byId(id); if (!sw) return;
    if (typeof window.html2pdf !== 'function') {
      toast('PDF engine load nahi hua. Internet check karke dobara try karein.');
      return;
    }
    const win = mode === 'view' ? window.open('', '_blank') : null;
    if (win) win.document.write('<title>' + esc(sw.name) + '</title><body style="background:#050508;color:#ff2e93;font-family:sans-serif;display:grid;place-items:center;height:100vh">Preparing your PDF...</body>');
    toast('PDF ban raha hai…');
    const el = sheetEl(sw);
    const job = window.html2pdf().set({
      margin: 8, filename: sw.name.replace(/\s+/g, '_') + '_Shortcut_Keys.pdf',
      image: { type: 'jpeg', quality: .96 }, html2canvas: { scale: 2, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'] }
    }).from(el);
    const done = () => { el.remove(); };
    if (mode === 'view') {
      job.outputPdf('bloburl').then(u => { if (win && !win.closed) win.location.href = u; else window.open(u, '_blank'); done(); })
        .catch(() => { done(); if (win) win.close(); toast('PDF nahi ban saka, dobara try karein.'); });
    } else {
      job.save().then(() => { done(); toast('✅ PDF download ho gaya'); }).catch(() => { done(); toast('PDF nahi ban saka, dobara try karein.'); });
    }
  }

  /* ---------- Selector + table ---------- */
  const cardsEl = q('#skCards'), tableEl = q('#skTable'), headEl = q('#skHead'), searchEl = q('#skSearch');
  let cur = 'writer';
  function renderCards() {
    if (!cardsEl) return;
    cardsEl.innerHTML = SK.map(s => '<div class="sk-card' + (s.id === cur ? ' on' : '') + '" data-id="' + s.id + '" role="button" tabindex="0" aria-label="' + esc(s.name) + '">' +
      '<div class="sk-ic">' + s.icon + '</div><b>' + esc(s.name) + '</b><small>' + s.list.length + ' shortcuts</small>' +
      '<div class="sk-pdfs"><button type="button" data-pdf="view" data-id="' + s.id + '" title="View PDF">👁 View</button><button type="button" data-pdf="dl" data-id="' + s.id + '" title="Download PDF">⬇ PDF</button></div></div>').join('');
  }
  function renderTable() {
    if (!tableEl) return;
    const sw = byId(cur), term = (searchEl && searchEl.value || '').trim().toLowerCase();
    const rows = sw.list.filter(r => !term || r[0].toLowerCase().includes(term) || r[1].toLowerCase().includes(term));
    headEl.innerHTML = '<div><h3>' + sw.icon + ' ' + esc(sw.name) + '</h3><small>' + sw.list.length + ' professional shortcut keys</small></div>' +
      '<div class="sk-head-btns"><button type="button" class="btn sm ghost" data-pdf="view" data-id="' + sw.id + '">👁 View PDF</button><button type="button" class="btn sm" data-pdf="dl" data-id="' + sw.id + '">⬇ Download PDF</button></div>';
    tableEl.innerHTML = rows.length ? '<table class="sk-table"><thead><tr><th>#</th><th>Shortcut Key</th><th>Function</th></tr></thead><tbody>' +
      rows.map((r, i) => '<tr><td>' + (i + 1) + '</td><td class="sk-keys">' + kbd(r[0]) + '</td><td>' + esc(r[1]) + '</td></tr>').join('') + '</tbody></table>'
      : '<p class="sk-empty">Koi shortcut nahi mila. Dusra word try karein.</p>';
  }
  function select(id) {
    cur = id; if (searchEl) searchEl.value = '';
    renderCards(); renderTable();
    if (qz.sel) { qz.sel.value = id; startQuiz(id); }
  }
  if (cardsEl) {
    cardsEl.addEventListener('click', e => {
      const b = e.target.closest('[data-pdf]');
      if (b) { e.stopPropagation(); makePdf(b.dataset.id, b.dataset.pdf); return; }
      const c = e.target.closest('.sk-card'); if (c) select(c.dataset.id);
    });
    cardsEl.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('sk-card')) { e.preventDefault(); select(e.target.dataset.id); } });
  }
  if (headEl) headEl.addEventListener('click', e => { const b = e.target.closest('[data-pdf]'); if (b) makePdf(b.dataset.id, b.dataset.pdf); });
  if (searchEl) searchEl.addEventListener('input', renderTable);

  /* ---------- 3D Neon Quiz ---------- */
  const qz = { box: q('#skQuiz'), sel: null, st: null };
  const QN = 10;
  function pool(soft) {
    if (soft === 'all') { const p = []; SK.forEach(s => s.list.forEach(r => p.push({ sid: s.id, sn: s.name, k: r[0], a: r[1] }))); return p; }
    const s = byId(soft); return s.list.map(r => ({ sid: s.id, sn: s.name, k: r[0], a: r[1] }));
  }
  function build(soft) {
    const items = shuffle(pool(soft)).slice(0, QN);
    return items.map(it => {
      const same = pool(it.sid);
      const keyType = Math.random() < .6;
      const field = keyType ? 'k' : 'a';
      const others = shuffle(same.filter(x => x[field] !== it[field])).map(x => x[field]);
      const uniq = []; others.forEach(o => { if (uniq.indexOf(o) < 0 && uniq.length < 3) uniq.push(o); });
      const opts = shuffle([it[field]].concat(uniq));
      return { soft: it.sn, keyType, text: keyType ? it.a : it.k, answer: it[field], opts, pick: -1 };
    });
  }
  function bestGet() { try { return JSON.parse(localStorage.getItem('acec_sk_best') || '{}'); } catch (e) { return {}; } }
  function bestSet(k, v) { try { const b = bestGet(); if (!b[k] || v > b[k]) { b[k] = v; localStorage.setItem('acec_sk_best', JSON.stringify(b)); } } catch (e) { /* storage blocked */ } }
  function startQuiz(soft) { qz.st = { soft, qs: build(soft), i: 0, done: false }; drawQuiz(); }
  function score() { return qz.st.qs.filter(x => x.pick >= 0 && x.opts[x.pick] === x.answer).length; }
  function drawQuiz() {
    const st = qz.st, box = qz.box; if (!box) return;
    const body = q('#skQBody', box), bar = q('#skBar', box), sc = q('#skScore', box);
    sc.textContent = '⭐ ' + score() + ' / ' + st.qs.length;
    if (st.done) {
      const s = score(), pct = Math.round(s / st.qs.length * 100);
      bestSet(st.soft, pct);
      const best = bestGet()[st.soft] || pct;
      bar.style.width = '100%';
      body.innerHTML = '<div class="sk-result"><div class="sk-trophy">' + (pct >= 80 ? '🏆' : pct >= 50 ? '🎯' : '📚') + '</div><h4>' + s + ' / ' + st.qs.length + ' Correct</h4>' +
        '<p>' + (pct >= 80 ? 'Zabardast! Aap shortcut master ho.' : pct >= 50 ? 'Accha hai! Thoda aur practice karein.' : 'Cheat sheet padhkar dobara try karein.') + '</p><small>Best score: ' + best + '%</small>' +
        '<div class="sk-nav"><button type="button" class="btn ghost" id="skReview">Review Answers</button><button type="button" class="btn" id="skRestart">↻ Restart Quiz</button></div></div>';
      return;
    }
    const cq = st.qs[st.i], answered = cq.pick >= 0;
    bar.style.width = ((st.i + (answered ? 1 : 0)) / st.qs.length * 100) + '%';
    const qtext = cq.keyType ? 'Which shortcut key is used to <b>' + esc(cq.text) + '</b>?' : 'What does <span class="sk-qk">' + kbd(cq.text) + '</span> do?';
    body.innerHTML = '<div class="sk-qmeta"><span>Question ' + (st.i + 1) + ' / ' + st.qs.length + '</span><span class="sk-chip">' + esc(cq.soft) + '</span></div>' +
      '<div class="sk-qtext">' + qtext + '</div><div class="sk-opts">' +
      cq.opts.map((o, i) => {
        let cls = 'sk-opt';
        if (answered) { if (o === cq.answer) cls += ' right'; else if (i === cq.pick) cls += ' wrong'; cls += ' lock'; }
        return '<button type="button" class="' + cls + '" data-i="' + i + '"><span class="sk-letter">' + 'ABCD'[i] + '</span><span class="sk-otxt">' + (cq.keyType ? kbd(o) : esc(o)) + '</span></button>';
      }).join('') + '</div>' +
      '<div class="sk-fb" id="skFb">' + (answered ? (cq.opts[cq.pick] === cq.answer ? '✅ Correct answer!' : '❌ Correct: ' + (cq.keyType ? esc(cq.answer) : esc(cq.answer))) : 'Ek option chunein') + '</div>' +
      '<div class="sk-nav"><button type="button" class="btn ghost" id="skPrev"' + (st.i === 0 ? ' disabled' : '') + '>◀ Previous</button>' +
      '<button type="button" class="btn" id="skNext">' + (st.i === st.qs.length - 1 ? 'Finish ✔' : 'Next ▶') + '</button></div>';
  }
  function showWrong(cq) {
    const box = qz.box; let pop = q('.sk-pop', box); if (pop) pop.remove();
    pop = document.createElement('div'); pop.className = 'sk-pop'; pop.setAttribute('role', 'alertdialog');
    pop.innerHTML = '<div class="sk-pop-card"><div class="sk-x">✖</div><h4>Wrong Answer</h4><p>Sahi jawab:</p><div class="sk-correct">' + (cq.keyType ? kbd(cq.answer) : esc(cq.answer)) + '</div><button type="button" class="btn sm" data-close-pop>Got it</button></div>';
    box.appendChild(pop);
    const close = () => { pop.classList.add('out'); setTimeout(() => pop.remove(), 320); };
    pop.addEventListener('click', e => { if (e.target === pop || e.target.hasAttribute('data-close-pop')) close(); });
    setTimeout(close, 4200);
  }
  function initQuiz() {
    const box = qz.box; if (!box) return;
    box.innerHTML = '<div class="sk-qhead"><h3>🎮 Quiz Master</h3><span class="sk-score" id="skScore"></span></div>' +
      '<div class="sk-qctl"><select id="skQSel" aria-label="Quiz software"><option value="all">🔀 Mix: All Software</option>' + SK.map(s => '<option value="' + s.id + '">' + s.icon + ' ' + esc(s.name) + '</option>').join('') + '</select>' +
      '<button type="button" class="btn sm ghost" id="skNew">New Quiz</button></div>' +
      '<div class="sk-prog"><i id="skBar"></i></div><div id="skQBody"></div>';
    qz.sel = q('#skQSel', box); qz.sel.value = cur;
    qz.sel.addEventListener('change', () => startQuiz(qz.sel.value));
    q('#skNew', box).addEventListener('click', () => startQuiz(qz.sel.value));
    box.addEventListener('click', e => {
      const st = qz.st; if (!st) return;
      const opt = e.target.closest('.sk-opt');
      if (opt && !st.done) {
        const cq = st.qs[st.i]; if (cq.pick >= 0) return;
        cq.pick = +opt.dataset.i; drawQuiz();
        if (cq.opts[cq.pick] !== cq.answer) showWrong(cq);
        return;
      }
      if (e.target.id === 'skPrev' && st.i > 0) { st.i--; drawQuiz(); }
      else if (e.target.id === 'skNext') {
        const cq = st.qs[st.i];
        if (cq.pick < 0) { const fb = q('#skFb', box); if (fb) { fb.classList.remove('shake'); void fb.offsetWidth; fb.classList.add('shake'); fb.textContent = '⚠ Pehle jawab chunein'; } return; }
        if (st.i < st.qs.length - 1) { st.i++; drawQuiz(); } else { st.done = true; drawQuiz(); }
      }
      else if (e.target.id === 'skRestart') startQuiz(qz.sel.value);
      else if (e.target.id === 'skReview') { st.done = false; st.i = 0; drawQuiz(); }
    });
    startQuiz(cur);
  }

  /* ---------- Hero morph replay ---------- */
  function initMorph() {
    const stage = q('#mcStage'); if (!stage) return;
    const btn = q('#mcReplay');
    if (btn) btn.addEventListener('click', () => { stage.classList.remove('mc-play'); void stage.offsetWidth; stage.classList.add('mc-play'); });
  }

  renderCards(); renderTable(); initQuiz(); initMorph();
})();
// --- Sigma Battle Arena Logic ---
let arenaState = {
    playerName: "",
    roomPass: "",
    mode: "bot",
    difficulty: "normal",
    module: "m1",
    totalQ: 20,
    currentQIndex: 0,
    score: 0,
    wrongCount: 0,
    timerInterval: null,
    timeLeft: 0,
    questionsList: []
};

// Question Database Mock per Module (O-Level Syllabus focused + W3.CSS & Python/IoT)
const oLevelQuestionBank = {
    m1: [
        { q: "What is the shortcut key to open Open / Save As in IT Tools?", opts: ["Ctrl+S", "Ctrl+O", "F12", "Ctrl+N"], ans: 0 },
        { q: "Which of the following is an Operating System?", opts: ["MS Word", "Linux", "Tally", "Photoshop"], ans: 1 },
        { q: "What is extension of LibreOffice Calc file?", opts: [".odt", ".ods", ".odp", ".txt"], ans: 1 },
        { q: "Which shortcut selects all items in a folder?", opts: ["Ctrl+A", "Ctrl+C", "Ctrl+V", "Ctrl+X"], ans: 0 }
    ],
    m2: [
        { q: "Which W3.CSS class is used to create a responsive container?", opts: [".container", ".w3-container", ".w3-box", ".box"], ans: 1 },
        { q: "What does HTML stand for?", opts: ["Hyper Text Markup Language", "High Tech Multi Language", "Hyper Transfer Machine Language", "None"], ans: 0 },
        { q: "Which W3.CSS class gives a card effect?", opts: ["w3-panel", "w3-card", "w3-box", "w3-shadow"], ans: 1 },
        { q: "CSS stands for?", opts: ["Computer Style Sheet", "Cascading Style Sheets", "Creative Style System", "Colorful Sheet"], ans: 1 }
    ],
    m3: [
        { q: "Which keyword is used to define a function in Python?", opts: ["func", "def", "define", "function"], ans: 1 },
        { q: "What is the file extension of Python files?", opts: [".pt", ".py", ".pyt", ".python"], ans: 1 },
        { q: "Which data type is immutable in Python?", opts: ["List", "Dictionary", "Tuple", "Set"], ans: 2 },
        { q: "What is output of 2 ** 3 in Python?", opts: ["6", "8", "9", "5"], ans: 1 }
    ],
    m4: [
        { q: "What does IoT stand for?", opts: ["Internet of Things", "Input output Technology", "Interconnected Operational Tools", "Internet of Telecom"], ans: 0 },
        { q: "Which board is commonly used for Arduino projects?", opts: ["Arduino Uno", "Raspberry Pi Zero", "Intel Core", "Graphics Card"], ans: 0 },
        { q: "Arduino programming language is based on which language?", opts: ["Python", "C/C++", "Java", "HTML"], ans: 1 },
        { q: "Which pin on Arduino is built-in LED attached to?", opts: ["Pin 13", "Pin 8", "Pin 5", "Pin 0"], ans: 0 }
    ]
};

function startBattleArena() {
    const nameInput = document.getElementById('p-name').value.trim();
    const passInput = document.getElementById('p-pass').value.trim();

    if (!nameInput || !passInput) {
        alert("⚠️ Please enter both Player Name and Room Password to start the test!");
        return;
    }

    arenaState.playerName = nameInput;
    arenaState.roomPass = passInput;
    arenaState.mode = document.getElementById('battle-mode').value;
    arenaState.difficulty = document.getElementById('bot-difficulty').value;
    arenaState.module = document.getElementById('quiz-module').value;
    arenaState.totalQ = parseInt(document.getElementById('q-count').value);

    // Generate randomized questions based on count
    let rawBank = oLevelQuestionBank[arenaState.module] || oLevelQuestionBank.m1;
    arenaState.questionsList = [];
    for (let i = 0; i < arenaState.totalQ; i++) {
        let randomQ = rawBank[Math.floor(Math.random() * rawBank.length)];
        arenaState.questionsList.push(randomQ);
    }

    // Reset score & index
    arenaState.currentQIndex = 0;
    arenaState.score = 0;
    arenaState.wrongCount = 0;

    // Timer calculation: (Total Questions - 10 minutes buffer, min 2 mins)
    let totalMinutes = Math.max(2, Math.floor(arenaState.totalQ * 0.8) - 10);
    if(arenaState.totalQ <= 25) totalMinutes = 10;
    arenaState.timeLeft = totalMinutes * 60;

    // Switch UI panels
    document.getElementById('arena-setup').classList.remove('active');
    document.getElementById('arena-setup').classList.add('hidden');
    document.getElementById('arena-quiz').classList.remove('hidden');
    document.getElementById('arena-quiz').classList.add('active');

    document.getElementById('hud-name').innerText = arenaState.playerName;
    document.getElementById('hud-qtotal').innerText = arenaState.totalQ;

    startArenaTimer();
    loadQuestion();
}

function startArenaTimer() {
    clearInterval(arenaState.timerInterval);
    arenaState.timerInterval = setInterval(() => {
        if (arenaState.timeLeft <= 0) {
            clearInterval(arenaState.timerInterval);
            finishArenaGame();
            return;
        }
        arenaState.timeLeft--;
        let m = Math.floor(arenaState.timeLeft / 60).toString().padStart(2, '0');
        let s = (arenaState.timeLeft % 60).toString().padStart(2, '0');
        document.getElementById('hud-timer').innerText = `${m}:${s}`;
    }, 1000);
}

function loadQuestion() {
    if (arenaState.currentQIndex >= arenaState.questionsList.length) {
        finishArenaGame();
        return;
    }

    document.getElementById('hud-qnum').innerText = arenaState.currentQIndex + 1;
    let currentObj = arenaState.questionsList[arenaState.currentQIndex];
    document.getElementById('question-text').innerText = currentObj.q;

    let optsHtml = "";
    currentObj.opts.forEach((opt, idx) => {
        optsHtml += `<button class="option-btn" onclick="checkAnswer(${idx})">${String.fromCharCode(65 + idx)}. ${opt}</button>`;
    });
    document.getElementById('options-container').innerHTML = optsHtml;
}

function checkAnswer(selectedIndex) {
    let currentObj = arenaState.questionsList[arenaState.currentQIndex];
    if (selectedIndex === currentObj.ans) {
        arenaState.score++;
    } else {
        arenaState.wrongCount++;
    }
    arenaState.currentQIndex++;
    loadQuestion();
}

function finishArenaGame() {
    clearInterval(arenaState.timerInterval);

    document.getElementById('arena-quiz').classList.remove('active');
    document.getElementById('arena-quiz').classList.add('hidden');
    document.getElementById('arena-result').classList.remove('hidden');
    document.getElementById('arena-result').classList.add('active');

    let resultHtml = "";
    
    // Check if playing vs Bot in Hard Mode
    if (arenaState.mode === 'bot' && arenaState.difficulty === 'hard') {
        // Sigma Boy Hard mode is engineered to be unbeatable
        resultHtml = `
            <h2>🤖 Unbeatable Sigma Boy!</h2>
            <p>Score: <strong>${arenaState.score} / ${arenaState.totalQ}</strong> (Wrong: ${arenaState.wrongCount})</p>
            <p style="margin-top:1rem; color:#ff007f; font-weight:bold; font-size:1.3rem;">
              Nahi sir 🙋🏻, Sigma Boy ko nahi hara sakta koi... 🤩🤩
            </p>
        `;
    } else {
        // Normal / Friend win check
        let isWinner = arenaState.score >= Math.ceil(arenaState.totalQ / 2);
        if (isWinner) {
            resultHtml = `
                <h2>🎁 🎉🎉💫 Congratulations! 👏🏻🎉🎉👏🏻</h2>
                <p>Awesome job, <strong>${arenaState.playerName}</strong>!</p>
                <p>You won the battle with <strong>${arenaState.score}</strong> correct answers! 🏆</p>
            `;
        } else {
            resultHtml = `
                <h2>💪 Try Again!</h2>
                <p>Aap fir se try karein, is bar winner 🏆 aap hi hoge, Sigma Boy ko bharosha hai! 🎉🎉💫👏🏻</p>
                <p>Your Score: ${arenaState.score} / ${arenaState.totalQ}</p>
            `;
        }
    }

    document.getElementById('result-box-content').innerHTML = resultHtml;
}

function resetArena() {
    document.getElementById('arena-result').classList.remove('active');
    document.getElementById('arena-result').classList.add('hidden');
    document.getElementById('arena-setup').classList.remove('hidden');
    document.getElementById('arena-setup').classList.add('active');
}
// Press Enter key to start arena instantly
// FIX: Terminal (ya koi aur input) me Enter dabane par Battle Arena popup trigger nahi hoga.
function isSigmaTerminalActive(e) {
    const overlay = document.getElementById('sigma-terminal-overlay');
    const termOpen = overlay && !overlay.classList.contains('sigma-terminal-hidden');
    const termInput = document.getElementById('sigma-term-input');
    const t = e && e.target;
    return !!(termOpen || document.activeElement === termInput || (t && overlay && overlay.contains(t)));
}
document.addEventListener('keypress', function(e) {
    if (e.key !== 'Enter') return;
    if (isSigmaTerminalActive(e)) return;                       // terminal par focus/open hai -> arena mat chalao
    const setupPanel = document.getElementById('arena-setup');
    if (!setupPanel || !setupPanel.classList.contains('active')) return;
    const t = e.target;
    if (!t || !setupPanel.contains(t)) return;                  // sirf arena form ke andar Enter dabane par
    if (/^(BUTTON|TEXTAREA|SELECT)$/.test(t.tagName)) return;   // button par Enter = uska apna click, double start nahi
    startBattleArena();
});
// --- Save Test Progress & Retry Feature ---
function saveTestProgress() {
    if (!arenaState || arenaState.currentQIndex === 0) return;
    const progressData = {
        playerName: arenaState.playerName,
        roomPass: arenaState.roomPass,
        mode: arenaState.mode,
        module: arenaState.module,
        totalQ: arenaState.totalQ,
        currentQIndex: arenaState.currentQIndex,
        score: arenaState.score,
        wrongCount: arenaState.wrongCount,
        timeLeft: arenaState.timeLeft,
        questionsList: arenaState.questionsList
    };
    localStorage.setItem('sigma_battle_progress', JSON.stringify(progressData));
}

// Check if previous unfinished test exists on load
window.addEventListener('load', () => {
    const saved = localStorage.getItem('sigma_battle_progress');
    if (saved) {
        if (confirm("⚠️ You have an unfinished test session! Do you want to resume from where you left off?")) {
            const data = JSON.parse(saved);
            arenaState = data;
            
            document.getElementById('arena-setup').classList.remove('active');
            document.getElementById('arena-setup').classList.add('hidden');
            document.getElementById('arena-quiz').classList.remove('hidden');
            document.getElementById('arena-quiz').classList.add('active');

            document.getElementById('hud-name').innerText = arenaState.playerName;
            document.getElementById('hud-qtotal').innerText = arenaState.totalQ;
            
            startArenaTimer();
            loadQuestion();
        } else {
            localStorage.removeItem('sigma_battle_progress');
        }
    }
});

// Auto-save progress on every question change
const originalCheckAnswer = window.checkAnswer;
window.checkAnswer = function(selectedIndex) {
    originalCheckAnswer(selectedIndex);
    saveTestProgress();
};

// Clear progress when test finishes or resets
const originalFinishGame = window.finishArenaGame;
window.finishArenaGame = function() {
    localStorage.removeItem('sigma_battle_progress');
    originalFinishGame();
};

const originalResetArena = window.resetArena;
window.resetArena = function() {
    localStorage.removeItem('sigma_battle_progress');
    originalResetArena();
};
// --- Secret Sigma Command Terminal Logic ---
function toggleSigmaTerminal() {
    const overlay = document.getElementById('sigma-terminal-overlay');
    overlay.classList.toggle('sigma-terminal-hidden');
    if (!overlay.classList.contains('sigma-terminal-hidden')) {
        setTimeout(() => document.getElementById('sigma-term-input').focus(), 50);
    } else {
        stopMatrixRain();
        document.getElementById('sigma-term-input').blur();
    }
}

// Keyboard Shortcut: Ctrl + Alt + S
document.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        toggleSigmaTerminal();
    }
});

// Command Line Handler
// FIX: capture phase + stopImmediatePropagation -> terminal ki key kisi global listener (Battle Arena etc.) tak jati hi nahi
const sigmaTermInput = document.getElementById('sigma-term-input');
const sigmaTermHistory = [];
let sigmaTermHistIdx = 0;

sigmaTermInput.addEventListener('keydown', function(e) {
    e.stopImmediatePropagation();
    e.stopPropagation();

    if (e.key === 'Enter') {
        e.preventDefault();
        const inputVal = this.value.trim();
        if (!inputVal) return;

        appendTerminalOutput(`sigma@access-pc:~$ ${inputVal}`, 'term-highlight');
        sigmaTermHistory.push(inputVal);
        sigmaTermHistIdx = sigmaTermHistory.length;
        processCommand(inputVal.toLowerCase(), inputVal);
        this.value = '';
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (sigmaTermHistIdx > 0) this.value = sigmaTermHistory[--sigmaTermHistIdx];
    } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (sigmaTermHistIdx < sigmaTermHistory.length - 1) this.value = sigmaTermHistory[++sigmaTermHistIdx];
        else { sigmaTermHistIdx = sigmaTermHistory.length; this.value = ''; }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        toggleSigmaTerminal();
    }
}, true);

// keypress / keyup bhi terminal se bahar leak na hon (purane keypress-based listeners ke liye)
['keypress', 'keyup'].forEach(function(evt) {
    sigmaTermInput.addEventListener(evt, function(e) {
        e.stopImmediatePropagation();
        e.stopPropagation();
        if (e.key === 'Enter') e.preventDefault();
    }, true);
});

function appendTerminalOutput(text, className = '') {
    const body = document.getElementById('sigma-terminal-body');
    const div = document.createElement('div');
    div.className = className;
    div.innerText = text;
    body.appendChild(div);
    body.scrollTop = body.scrollHeight;
}

function processCommand(cmd, raw) {
    cmd = (cmd || '').trim();
    raw = (raw || cmd).trim();
    const base = cmd.split(/\s+/)[0];
    if (base !== 'matrix') stopMatrixRain();   // koi bhi naya command aate hi matrix band

    switch(base) {
        case 'help':
            appendTerminalOutput("Available Commands:", "term-highlight");
            appendTerminalOutput("  - courses  : View Access Computer Center courses");
            appendTerminalOutput("  - matrix   : Trigger Matrix code rain effect");
            appendTerminalOutput("  - sigma    : Display special hidden Sigma message");
            appendTerminalOutput("  - clear    : Clear terminal screen");
            appendTerminalOutput("  - date     : Show today's date & time");
            appendTerminalOutput("  - whoami   : Show current user");
            appendTerminalOutput("  - echo TXT : Print your text");
            appendTerminalOutput("  - python   : Open Python Coding practice");
            appendTerminalOutput("  - iot      : Open IoT / Arduino Simulator");
            appendTerminalOutput("  - exit     : Close terminal");
            break;

        case 'date':
        case 'time':
            appendTerminalOutput(new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'medium' }), 'term-success');
            break;

        case 'whoami':
            appendTerminalOutput('sigma-boy @ Access Computer Center', 'term-success');
            break;

        case 'echo':
            appendTerminalOutput(raw.replace(/^echo\s*/i, '') || ' ');
            break;

        case 'python':
        case 'iot':
        case 'arduino': {
            const tabBtn = document.querySelector('.px-tab[data-px="' + (base === 'python' ? 'py' : 'ard') + '"]');
            const sec = document.getElementById('codepractice');
            if (tabBtn && sec) {
                appendTerminalOutput('Opening ' + (base === 'python' ? 'Python Coding' : 'IoT / Arduino Simulator') + '...', 'term-success');
                setTimeout(() => { toggleSigmaTerminal(); tabBtn.click(); sec.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350);
            } else appendTerminalOutput('Coding Practice section nahi mila.', 'term-error');
            break;
        }

        case 'courses':
            appendTerminalOutput("--- ACCESS COMPUTER CENTER COURSES ---", "term-highlight");
            appendTerminalOutput("1. CCC & O-Level (NIELIT Certified)");
            appendTerminalOutput("2. ADCA, PGDCA & Tally Prime with GST");
            appendTerminalOutput("3. Python, HTML5, CSS3, JavaScript & Web Development");
            break;

        case 'matrix':
            appendTerminalOutput("Initiating Matrix Rain Effect... (Type any other command to stop)", "term-success");
            startMatrixRain();
            break;

        case 'sigma':
            appendTerminalOutput("🔥 [SIGMA PROTOCOL ACTIVE] 🔥", "term-highlight");
            appendTerminalOutput("“Zindagi me success chahiye toh khud ki mehnat par bharosa rakho, Sigma Boy kabhi rukta nahi!”");
            break;

        case 'clear':
            document.getElementById('sigma-terminal-body').innerHTML = '';
            break;

        case 'exit':
            toggleSigmaTerminal();
            break;

        default:
            appendTerminalOutput(`Command not recognized: '${base}'. Type 'help' for available commands.`, 'term-error');
            break;
    }
}

function stopMatrixRain() {
    if (matrixInterval) { clearInterval(matrixInterval); matrixInterval = null; }
    const canvas = document.getElementById('matrix-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.style.display = 'none';
    }
    const ov = document.getElementById('sigma-terminal-overlay');
    if (ov) ov.classList.remove('matrix-on');
}

// Matrix Rain Effect Implementation
let matrixInterval = null;
function startMatrixRain() {
    const canvas = document.getElementById('matrix-canvas');
    canvas.style.display = 'block';
    const ov = document.getElementById('sigma-terminal-overlay');
    if (ov) ov.classList.add('matrix-on');
    const ctx = canvas.getContext('2d');
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    const katakana = 'アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブヅプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン';
    const latin = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*+';
    const alphabet = katakana + latin;
    
    const fontSize = 16;
    const columns = canvas.width / fontSize;
    const rainDrops = [];
    
    for (let x = 0; x < columns; x++) {
        rainDrops[x] = 1;
    }
    
    if (matrixInterval) clearInterval(matrixInterval);
    
    matrixInterval = setInterval(() => {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.fillStyle = '#0f0';
        ctx.font = fontSize + 'px monospace';
        
        for (let i = 0; i < rainDrops.length; i++) {
            const text = alphabet.charAt(Math.floor(Math.random() * alphabet.length));
            ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);
            
            if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
                rainDrops[i] = 0;
            }
            rainDrops[i]++;
        }
    }, 30);
}

// =====================================================================
// Sigma Utility Hub — Screenshot (html2canvas / Screen Capture API) + Screen Recorder (MediaRecorder)
// =====================================================================
(function () {
    'use strict';
    const $id = id => document.getElementById(id);
    const hub = $id('sx-hub');
    if (!hub) return;

    const el = {
        toggle: $id('sxToggle'), close: $id('sxClose'), panel: $id('sxPanel'), mini: $id('sxMini'),
        seg: $id('sxSeg'), shot: $id('sxShot'), shotHint: $id('sxShotHint'),
        sys: $id('sxSys'), mic: $id('sxMic'), timer: $id('sxTimer'),
        rec: $id('sxRec'), pause: $id('sxPause'), stop: $id('sxStop'), recHint: $id('sxRecHint'),
        prev: $id('sxPrev'), media: $id('sxMedia'), save: $id('sxSave'), drop: $id('sxDrop')
    };

    const say = m => { if (typeof toast === 'function') toast(m); };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    const pad = n => String(n).padStart(2, '0');
    const fmt = s => pad(Math.floor(s / 60)) + ':' + pad(s % 60);
    const stamp = () => { const d = new Date(); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); };

    const canScreen = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia);
    const canRecord = canScreen && typeof window.MediaRecorder !== 'undefined';

    /* ---------- Open / Close ---------- */
    function openHub(o) {
        hub.classList.toggle('open', o);
        el.toggle.setAttribute('aria-expanded', String(o));
    }
    el.toggle.addEventListener('click', () => openHub(!hub.classList.contains('open')));
    el.close.addEventListener('click', () => openHub(false));
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && hub.classList.contains('open')) {
            const ov = $id('sigma-terminal-overlay');
            if (ov && !ov.classList.contains('sigma-terminal-hidden')) return;   // terminal khula ho to uska Esc chale
            openHub(false);
        }
    });

    /* ---------- Mode selector ---------- */
    let mode = 'view';
    const hints = {
        view: 'VIEW = jo abhi screen par dikh raha hai',
        full: 'FULL PAGE = poora page upar se neeche (bahut lamba page ho to limit lagti hai)',
        screen: 'SCREEN = browser ka exact capture (3D/canvas bhi dikhega) — permission poochega'
    };
    el.seg.addEventListener('click', e => {
        const b = e.target.closest('button[data-mode]'); if (!b) return;
        if (b.dataset.mode === 'screen' && !canScreen) { say('⚠️ Is browser/device me SCREEN capture support nahi hai'); return; }
        mode = b.dataset.mode;
        el.seg.querySelectorAll('button').forEach(x => { const on = x === b; x.classList.toggle('on', on); x.setAttribute('aria-pressed', String(on)); });
        el.shotHint.textContent = hints[mode];
    });

    /* ---------- Preview / Save ---------- */
    let curURL = null;
    function clearPreview() {
        if (curURL) { URL.revokeObjectURL(curURL); curURL = null; }
        el.media.textContent = ''; el.prev.hidden = true;
    }
    function showPreview(kind, blob) {
        clearPreview();
        curURL = URL.createObjectURL(blob);
        let node;
        if (kind === 'image') { node = document.createElement('img'); node.alt = 'Screenshot preview'; node.src = curURL; }
        else { node = document.createElement('video'); node.src = curURL; node.controls = true; node.playsInline = true; }
        el.media.appendChild(node);
        const ext = kind === 'image' ? 'png' : (/mp4/.test(blob.type) ? 'mp4' : 'webm');
        el.save.href = curURL;
        el.save.download = 'access-' + (kind === 'image' ? 'screenshot-' : 'recording-') + stamp() + '.' + ext;
        el.prev.hidden = false;
        openHub(true);
    }
    el.drop.addEventListener('click', clearPreview);

    /* ---------- Screenshot ---------- */
    function loadH2C() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        return new Promise((res, rej) => {
            const s = document.createElement('script');
            const srcs = ['https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'];
            let k = 0;
            const next = () => {
                if (k >= srcs.length) return rej(new Error('html2canvas load failed'));
                const sc = document.createElement('script');
                sc.src = srcs[k++];
                sc.onload = () => window.html2canvas ? res(window.html2canvas) : next();
                sc.onerror = next;
                document.head.appendChild(sc);
            };
            next();
        });
    }
    const toBlob = c => new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('toBlob failed')), 'image/png'));

    async function shotPage(full) {
        const h2c = await loadH2C();
        const bg = getComputedStyle(document.body).backgroundColor;
        const opts = {
            useCORS: true, logging: false,
            backgroundColor: (bg && bg !== 'rgba(0, 0, 0, 0)') ? bg : '#050508',
            ignoreElements: n => n.id === 'sx-hub' || n.id === 'toast'
        };
        let target = document.body;
        if (full) {
            const de = document.documentElement;
            const W = Math.max(de.scrollWidth, innerWidth), H = Math.min(de.scrollHeight, 12000);
            Object.assign(opts, { scale: 1, width: W, height: H, windowWidth: W, windowHeight: H, x: 0, y: 0, scrollX: 0, scrollY: 0 });
            target = de;
            if (de.scrollHeight > 12000) say('ℹ️ Page bahut lamba hai — upar ke 12000px capture hue');
        } else {
            Object.assign(opts, {
                scale: Math.min(window.devicePixelRatio || 1, 2),
                x: window.scrollX, y: window.scrollY, width: innerWidth, height: innerHeight,
                windowWidth: document.documentElement.clientWidth, windowHeight: innerHeight
            });
        }
        const canvas = await h2c(target, opts);
        return toBlob(canvas);
    }

    async function shotScreen() {
        let stream;
        try { stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'browser' }, audio: false, preferCurrentTab: true }); }
        catch (e0) {
            if (e0 && (e0.name === 'NotAllowedError' || e0.name === 'AbortError')) throw e0;
            stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });   // purane browsers: simple options
        }
        hub.classList.add('sx-hide');
        try {
            const v = document.createElement('video');
            v.srcObject = stream; v.muted = true; v.playsInline = true;
            await v.play();
            await sleep(450);
            const c = document.createElement('canvas');
            c.width = v.videoWidth; c.height = v.videoHeight;
            c.getContext('2d').drawImage(v, 0, 0);
            return await toBlob(c);
        } finally {
            stream.getTracks().forEach(t => t.stop());
            hub.classList.remove('sx-hide');
        }
    }

    el.shot.addEventListener('click', async () => {
        if (el.shot.disabled) return;
        el.shot.disabled = true;
        const old = el.shot.innerHTML; el.shot.innerHTML = '<span>⏳</span> CAPTURING...';
        try {
            if (mode === 'screen') {
                const b = await shotScreen(); showPreview('image', b);
            } else {
                openHub(false); await sleep(320);               // panel band hone do
                let b;
                try { b = await shotPage(mode === 'full'); }
                catch (e1) {
                    console.warn('html2canvas fail:', e1);
                    if (!canScreen) throw e1;
                    say('ℹ️ Page capture nahi hua — SCREEN mode se le raha hoon');
                    b = await shotScreen();
                }
                showPreview('image', b);
            }
            say('📸 Screenshot ready — SAVE dabakar download karein');
        } catch (err) {
            console.error('Screenshot error:', err);
            if (err && (err.name === 'NotAllowedError' || err.name === 'AbortError')) say('Screenshot cancel / permission nahi mili');
            else say('⚠️ Screenshot nahi ban paya — "SCREEN" mode try karein');
        } finally {
            el.shot.innerHTML = old; el.shot.disabled = false; hub.classList.remove('sx-hide');
        }
    });

    /* ---------- Screen Recorder ---------- */
    let recorder = null, chunks = [], dispStream = null, micStream = null, audioCtx = null;
    let tickId = null, t0 = 0, pausedAt = 0, pausedTotal = 0, recording = false;

    if (!canRecord) {
        el.rec.disabled = true;
        el.sys.disabled = true; el.mic.disabled = true;
        el.recHint.textContent = '⚠️ Is browser/device me screen recording support nahi hai (mobile browsers me aam taur par nahi chalti). Desktop Chrome/Edge/Firefox use karein.';
        el.recHint.classList.add('warn');
    }

    function pickMime() {
        const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
        return list.find(m => window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) || '';
    }
    function elapsed() { return Math.max(0, Math.floor(((pausedAt || Date.now()) - t0 - pausedTotal) / 1000)); }
    function paint() { const t = fmt(elapsed()); el.timer.textContent = t; el.mini.textContent = '● ' + t; }
    function ui(state) {                       // 'idle' | 'rec' | 'paused'
        const on = state !== 'idle';
        hub.classList.toggle('recording', on);
        el.rec.hidden = on; el.stop.hidden = !on; el.pause.hidden = !on;
        el.pause.textContent = state === 'paused' ? '▶ RESUME' : '⏸ PAUSE';
        el.sys.disabled = el.mic.disabled = on || !canRecord;
        el.recHint.classList.remove('warn');
        el.recHint.textContent = on ? (state === 'paused' ? 'Paused — RESUME dabakar aage badhein' : '🔴 Recording chal rahi hai… STOP dabane par video milegi') : 'Browser pooche to tab/screen select karke Share dabayein';
    }
    function cleanup() {
        clearInterval(tickId); tickId = null;
        [dispStream, micStream].forEach(s => s && s.getTracks().forEach(t => t.stop()));
        dispStream = micStream = null;
        if (audioCtx) { try { audioCtx.close(); } catch (e) { } audioCtx = null; }
    }

    async function startRec() {
        if (recording || !canRecord) return;
        try {
            dispStream = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: { ideal: 30 } }, audio: el.sys.checked });
        } catch (err) {
            dispStream = null;
            say(err && err.name === 'NotAllowedError' ? 'Recording cancel / permission nahi mili' : '⚠️ Recording start nahi ho payi');
            return;
        }
        const tracks = [...dispStream.getVideoTracks()];
        const sysTracks = dispStream.getAudioTracks();
        if (el.mic.checked) {
            try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
            catch (e) { micStream = null; say('🎤 Mic permission nahi mili — bina mic record hoga'); }
        }
        if (el.sys.checked && !sysTracks.length) say('🔊 System audio share nahi hua (share dialog me "Share audio" tick karein)');
        if (sysTracks.length && micStream) {            // dono audio mix
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            audioCtx.createMediaStreamSource(new MediaStream(sysTracks)).connect(dest);
            audioCtx.createMediaStreamSource(micStream).connect(dest);
            tracks.push(...dest.stream.getAudioTracks());
        } else if (sysTracks.length) tracks.push(...sysTracks);
        else if (micStream) tracks.push(...micStream.getAudioTracks());

        const mime = pickMime();
        try {
            recorder = new MediaRecorder(new MediaStream(tracks), mime ? { mimeType: mime, videoBitsPerSecond: 4000000 } : undefined);
        } catch (err) {
            console.error(err); cleanup(); say('⚠️ Is browser me recorder bana nahi paya'); return;
        }
        chunks = [];
        recorder.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
        recorder.onstop = () => {
            const type = (recorder && recorder.mimeType) || mime || 'video/webm';
            const blob = new Blob(chunks, { type });
            recording = false; pausedAt = 0; cleanup(); ui('idle'); el.timer.textContent = '00:00';
            if (blob.size) { showPreview('video', blob); say('🎥 Recording ready — SAVE dabakar download karein'); }
            else say('⚠️ Recording khali rahi');
            recorder = null; chunks = [];
        };
        dispStream.getVideoTracks()[0].addEventListener('ended', stopRec);   // browser ke "Stop sharing" par bhi band
        t0 = Date.now(); pausedAt = 0; pausedTotal = 0; recording = true;
        recorder.start(1000);
        tickId = setInterval(paint, 500); paint(); ui('rec');
        openHub(false);                                                       // panel hata do, REC badge dikhta rahe
        say('🔴 Recording shuru');
    }
    function stopRec() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
    function togglePause() {
        if (!recorder) return;
        if (recorder.state === 'recording') { recorder.pause(); pausedAt = Date.now(); ui('paused'); }
        else if (recorder.state === 'paused') { pausedTotal += Date.now() - pausedAt; pausedAt = 0; recorder.resume(); ui('rec'); }
    }
    el.rec.addEventListener('click', startRec);
    el.stop.addEventListener('click', stopRec);
    el.pause.addEventListener('click', togglePause);

    window.addEventListener('beforeunload', e => { if (recording) { e.preventDefault(); e.returnValue = ''; } });
    ui('idle');
})();

// =====================================================================
// CODING PRACTICE extras: Python Coding + IoT / Arduino Simulator
// =====================================================================
(function () {
  'use strict';
  const q = (s, r) => (r || document).querySelector(s);
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const root = q('#pxWrap'); if (!root) return;
  const ARD = {};

  /* ---------- Sub-tabs ---------- */
  root.querySelectorAll('.px-tab').forEach(b => b.addEventListener('click', () => {
    root.querySelectorAll('.px-tab').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', String(x === b)); });
    q('#pxPy').classList.toggle('on', b.dataset.px === 'py');
    q('#pxArd').classList.toggle('on', b.dataset.px === 'ard');
  }));

  /* ---------- Syntax highlighting (custom, VS Code Dark+ colours) ---------- */
  const L = {
    py: {
      re: /(#[^\n]*)|([rRbBfFuU]{0,2}(?:'''[\s\S]*?(?:'''|$)|"""[\s\S]*?(?:"""|$)|'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?))|(\b0[xXbBoO][\da-fA-F_]+\b|\b\d[\d_]*\.?\d*(?:[eE][+-]?\d+)?[jJ]?\b|\.\d+\b)|(@[A-Za-z_][\w.]*)|([A-Za-z_]\w*)|([\s\S])/g,
      kw: new Set('and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(' ')),
      cs: new Set(['True', 'False', 'None']),
      bi: new Set('print input len range int float str list dict set tuple bool type sum min max abs round sorted reversed enumerate zip map filter open isinstance sqrt pow chr ord any all format repr id dir help bin hex oct divmod iter next object super'.split(' ')),
      ty: new Set()
    },
    cpp: {
      re: /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?)|(\b0[xX][\da-fA-F]+\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?[uUlLfF]*\b|\.\d+\b)|(^[ \t]*#[ \t]*\w+)|([A-Za-z_]\w*)|([\s\S])/gm,
      kw: new Set('if else for while do switch case default return break continue const static unsigned signed volatile struct enum typedef sizeof'.split(' ')),
      ty: new Set('void int long float double byte boolean bool char String word short uint8_t uint16_t uint32_t int8_t int16_t int32_t size_t'.split(' ')),
      cs: new Set('true false HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 PI HEX DEC BIN OCT NULL'.split(' ')),
      bi: new Set('pinMode digitalWrite digitalRead analogWrite analogRead delay delayMicroseconds millis micros tone noTone random randomSeed map constrain abs min max sqrt pow sin cos tan Serial'.split(' '))
    }
  };
  function hl(src, lang) {
    const D = L[lang]; let out = '', m, prev = ''; D.re.lastIndex = 0;
    while ((m = D.re.exec(src))) {
      const t = m[0]; let c = '';
      if (m[1]) c = 'c';
      else if (m[2]) {
        if (lang === 'py' && /^(?:[fF]|[rRbBuU][fF]|[fF][rRbB])['"]/.test(t)) {
          out += '<span class="h-s">' + esc(t).replace(/\{[^{}\n]*\}/g, x => '</span><span class="h-i">' + x + '</span><span class="h-s">') + '</span>'; prev = ''; continue;
        }
        c = 's';
      } else if (m[3]) c = 'n';
      else if (m[4]) c = 'd';
      else if (m[5]) {
        const w = t;
        if (D.kw.has(w)) c = 'k';
        else if (D.ty.has(w)) c = 't';
        else if (D.cs.has(w)) c = 'q';
        else if (prev === 'def' || prev === 'class') c = 'f';
        else if (D.bi.has(w)) c = 'b';
        else if (/^[ \t]*\(/.test(src.substr(D.re.lastIndex, 40))) c = 'f';
        else c = 'v';
        prev = w;
      } else { if (!/\s/.test(t)) prev = ''; out += esc(t); continue; }
      if (c !== 'v' || m[5]) { /* keep prev for identifiers handled above */ }
      if (!m[5]) prev = '';
      out += '<span class="h-' + c + '">' + esc(t) + '</span>';
    }
    return out + '\n';
  }

  /* ---------- Small code editor widget (textarea + highlighted overlay) ---------- */
  function editor(host, lang, init, symbols) {
    host.innerHTML = '<div class="px-gut"><pre></pre></div><div class="px-cw"><pre class="px-hl" aria-hidden="true"></pre><textarea class="px-ta" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" aria-label="Code editor"></textarea></div>';
    const gut = q('.px-gut pre', host), pre = q('.px-hl', host), ta = q('.px-ta', host);
    const api = { ta, onchange: null, onrun: null, bad: new Set() };
    const indent = lang === 'py' ? '    ' : '  ';
    function draw() {
      pre.innerHTML = hl(ta.value, lang);
      const n = ta.value.split('\n').length; let g = '';
      for (let i = 1; i <= n; i++) g += (api.bad.has(i) ? '<b>' + i + '</b>' : i) + '\n';
      gut.innerHTML = g; sync();
    }
    function sync() { pre.scrollTop = ta.scrollTop; pre.scrollLeft = ta.scrollLeft; gut.style.transform = 'translateY(' + (-ta.scrollTop) + 'px)'; }
    function ins(txt) {
      ta.focus();
      let ok = false; try { ok = document.execCommand('insertText', false, txt); } catch (e) { }
      if (!ok) { ta.setRangeText(txt, ta.selectionStart, ta.selectionEnd, 'end'); ta.dispatchEvent(new Event('input', { bubbles: true })); }
    }
    ta.addEventListener('input', () => { draw(); if (api.onchange) api.onchange(); });
    ta.addEventListener('scroll', sync);
    ta.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); if (api.onrun) api.onrun(); return; }
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); ins(indent); return; }
      if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey && !e.altKey) {
        const v = ta.value, s = ta.selectionStart, ls = v.lastIndexOf('\n', s - 1) + 1, line = v.slice(ls, s), lead = (line.match(/^[ \t]*/) || [''])[0];
        let extra = '';
        if (lang === 'py' && /:\s*$/.test(line)) extra = indent;
        if (lang === 'cpp' && /\{\s*$/.test(line)) {
          e.preventDefault();
          if (v[ta.selectionEnd] === '}') { ins('\n' + lead + indent + '\n' + lead); ta.selectionStart = ta.selectionEnd = ta.selectionStart - lead.length - 1; }
          else ins('\n' + lead + indent);
          return;
        }
        e.preventDefault(); ins('\n' + lead + extra);
      }
    });
    api.get = () => ta.value;
    api.set = v => { ta.value = v; ta.scrollTop = ta.scrollLeft = 0; draw(); };
    api.insert = ins;
    api.mark = set => { api.bad = set || new Set(); draw(); };
    api.set(init);
    if (symbols) {
      const bar = symbols; bar.innerHTML = '';
      (lang === 'py' ? ['Tab', ':', '(', ')', '[', ']', '{', '}', '"', "'", '#', '=', '+', '-', '*', '/', '%', '<', '>', ',', '.', '_'] : ['Tab', ';', '{', '}', '(', ')', '[', ']', '"', '=', '+', '-', '*', '/', '<', '>', '!', '&', '|', ',']).forEach(s => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = s; b.setAttribute('aria-label', 'Insert ' + s);
        b.addEventListener('pointerdown', e => e.preventDefault());           // keyboard band na ho
        b.addEventListener('click', () => ins(s === 'Tab' ? indent : s));
        bar.appendChild(b);
      });
    }
    return api;
  }

  /* =====================================================================
     PYTHON
     ===================================================================== */
  const PYEX = {
    hello: '# Python me pehla program\nname = "Access Computer"\nage = 10\nprint("Welcome to", name)\nprint(f"Hamare centre ko {age} saal ho gaye")\n\nfor i in range(1, 6):\n    print("Number:", i)\n',
    func: '# Function aur List\ndef table(n):\n    for i in range(1, 11):\n        print(f"{n} x {i} = {n * i}")\n\ntable(7)\n\nmarks = [78, 91, 65, 88]\nprint("Total:", sum(marks))\nprint("Average:", sum(marks) / len(marks))\nprint("Highest:", max(marks))\n',
    inp: '# input() se number lo\na = int(input("Pehla number: "))\nb = int(input("Doosra number: "))\nprint("Sum =", a + b)\nprint("Product =", a * b)\nif a > b:\n    print("Pehla bada hai")\nelse:\n    print("Doosra bada ya barabar hai")\n',
    fib: '# Fibonacci series\nn = 10\na, b = 0, 1\nseries = []\nfor _ in range(n):\n    series.append(a)\n    a, b = b, a + b\nprint(series)\n',
    dict: '# Dictionary\nstudent = {"name": "Anshika", "course": "CCC", "marks": 92}\nfor key, value in student.items():\n    print(key, "->", value)\n\nstudent["grade"] = "A+"\nprint(student)\nprint("Keys:", list(student.keys()))\n'
  };
  const py = { ed: null, engine: null, booting: null, booted: false };
  const pyCon = q('#pyCon'), pyStat = q('#pyStat'), pyCnt = q('#pyCnt');
  const pyOut = (t, c) => { const d = document.createElement('div'); if (c) d.className = c; d.textContent = t; pyCon.appendChild(d); pyCon.scrollTop = pyCon.scrollHeight; };
  const pyState = (t, c) => { pyStat.textContent = t; pyStat.className = 'px-pill' + (c ? ' ' + c : ''); };
  py.ed = editor(q('#pyEd'), 'py', PYEX.hello, q('#pySym'));

  function loadPy() {
    if (py.engine) return py.engine;
    py.engine = new Promise((res, rej) => {
      const done = async () => { try { res(await window.loadPyodide()); } catch (e) { rej(e); } };
      if (window.loadPyodide) return done();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js'; s.onload = done;
      s.onerror = () => rej(new Error('Python engine load nahi hua — internet check karein'));
      document.head.appendChild(s);
    });
    py.engine.catch(() => { py.engine = null; });
    return py.engine;
  }
  const BOOT = 'import builtins, js\ndef _inp(p=""):\n    v = js.prompt(str(p))\n    if v is None:\n        raise EOFError("input cancel ho gaya")\n    print(str(p) + str(v))\n    return str(v)\nbuiltins.input = _inp\n';
  let pyBusy = false;
  async function pyRun() {
    if (pyBusy) return;
    const code = py.ed.get(); pyCon.textContent = ''; pyCnt.textContent = ''; py.ed.mark(null);
    if (!code.trim()) { pyOut('Pehle kuch code likhiye.', 'wn'); return; }
    if (/^\s*while\s+(True|1)\s*:/m.test(code) && !/\bbreak\b|\binput\s*\(|sys\.exit/.test(code)) {
      pyOut('⚠ Infinite loop (while True) bina break ke — page hang ho sakta hai, isliye run nahi kiya. break lagayein.', 'er'); pyState('● Blocked', 'err'); return;
    }
    pyBusy = true; q('#pyRun').disabled = true;
    try {
      let eng;
      if (!py.engine) { pyOut('⏳ Python engine load ho raha hai (pehli baar ~10 MB)…', 'mu'); pyState('● Loading…', 'wait'); }
      eng = await loadPy();
      pyCon.textContent = ''; pyState('● Running…', 'run');
      eng.setStdout({ batched: s => pyOut(s) }); eng.setStderr({ batched: s => pyOut(s, 'er') });
      if (!py.booted) { await eng.runPythonAsync(BOOT); py.booted = true; }
      const t0 = performance.now();
      try { await eng.runPythonAsync(code); pyOut('✔ Program poora hua', 'ok'); pyState('● Done', 'run'); }
      catch (e) {
        let msg = String((e && e.message) || e).split('\n'), i = msg.findIndex(l => /File "<exec>"/.test(l));
        if (i > 0) msg = msg.slice(i);
        msg = msg.filter(l => !/pyodide|\/lib\/python/.test(l));
        const ln = (msg.join('\n').match(/File "<exec>", line (\d+)/) || [])[1];
        if (ln) py.ed.mark(new Set([+ln]));
        pyOut(msg.join('\n').trim(), 'er'); pyState('● Error', 'err');
      }
      pyCnt.textContent = Math.round(performance.now() - t0) + ' ms';
    } catch (e) { pyCon.textContent = ''; pyOut('✖ ' + (e.message || e), 'er'); pyState('● Offline', 'err'); }
    pyBusy = false; q('#pyRun').disabled = false;
  }
  py.ed.onrun = pyRun;
  q('#pyRun').onclick = pyRun;
  q('#pyClr').onclick = () => { pyCon.textContent = ''; pyCnt.textContent = ''; };
  q('#pyReset').onclick = () => { py.ed.set(PYEX.hello); py.ed.mark(null); pyCon.textContent = ''; pyState('● Ready'); };
  q('#pyEx').onchange = e => { if (PYEX[e.target.value]) { py.ed.set(PYEX[e.target.value]); py.ed.mark(null); } e.target.value = ''; };
  q('#pyCopy').onclick = () => { const t = py.ed.get(); (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => pyOut('⎘ Code copy ho gaya', 'mu')).catch(() => { py.ed.ta.select(); document.execCommand('copy'); }); };

  /* =====================================================================
     IoT / ARDUINO SIMULATOR
     ===================================================================== */
  const EX = {
    blink: '// Blink: pin 13 ka LED 1 second ON / OFF\nvoid setup() {\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(13, HIGH);\n  delay(1000);\n  digitalWrite(13, LOW);\n  delay(1000);\n}\n',
    traffic: '// Traffic Light: Red = 13, Yellow = 11, Green = 12\nconst int red = 13;\nconst int yellow = 11;\nconst int green = 12;\n\nvoid setup() {\n  pinMode(red, OUTPUT);\n  pinMode(yellow, OUTPUT);\n  pinMode(green, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(red, HIGH);\n  delay(2000);\n  digitalWrite(red, LOW);\n  digitalWrite(yellow, HIGH);\n  delay(800);\n  digitalWrite(yellow, LOW);\n  digitalWrite(green, HIGH);\n  delay(2000);\n  digitalWrite(green, LOW);\n}\n',
    button: '// Button dabao -> LED jale (button pin 2)\nconst int btn = 2;\nconst int led = 13;\n\nvoid setup() {\n  pinMode(btn, INPUT_PULLUP);\n  pinMode(led, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int state = digitalRead(btn);\n  if (state == LOW) {\n    digitalWrite(led, HIGH);\n    Serial.println("Button dabaya!");\n  } else {\n    digitalWrite(led, LOW);\n  }\n  delay(100);\n}\n',
    fade: '// PWM Fade: pin 11 (~) par LED dheere dheere tez/dim\nint led = 11;\nint level = 0;\nint step = 5;\n\nvoid setup() {\n  pinMode(led, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(led, level);\n  level = level + step;\n  if (level <= 0 || level >= 255) {\n    step = -step;\n  }\n  delay(20);\n}\n',
    melody: '// Buzzer (pin 8) par scale bajao\nconst int buzzer = 8;\nint notes[] = {262, 294, 330, 349, 392, 440, 494, 523};\n\nvoid setup() {\n}\n\nvoid loop() {\n  for (int i = 0; i < 8; i++) {\n    tone(buzzer, notes[i]);\n    delay(250);\n  }\n  noTone(buzzer);\n  delay(1000);\n}\n',
    pot: '// Potentiometer (A0) se LED (pin 11) ki brightness\nconst int pot = A0;\nconst int led = 11;\n\nvoid setup() {\n  Serial.begin(9600);\n  pinMode(led, OUTPUT);\n}\n\nvoid loop() {\n  int v = analogRead(pot);\n  int b = map(v, 0, 1023, 0, 255);\n  analogWrite(led, b);\n  Serial.print("Pot: ");\n  Serial.println(v);\n  delay(100);\n}\n',
    ldr: '// Night Lamp: andhera ho to LED (pin 12) jale\nconst int ldr = A1;\nconst int led = 12;\n\nvoid setup() {\n  pinMode(led, OUTPUT);\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int light = analogRead(ldr);\n  if (light < 300) {\n    digitalWrite(led, HIGH);\n  } else {\n    digitalWrite(led, LOW);\n  }\n  Serial.println(light);\n  delay(200);\n}\n',
    temp: '// Temperature Alarm: 35 C se upar buzzer (pin 8)\nconst int sensor = A2;\nconst int buzz = 8;\n\nvoid setup() {\n  Serial.begin(9600);\n}\n\nvoid loop() {\n  int raw = analogRead(sensor);\n  float volt = raw * 5.0 / 1023.0;\n  float temp = (volt - 0.5) * 100.0;\n  Serial.print("Temp C: ");\n  Serial.println(temp);\n  if (temp > 35) {\n    tone(buzz, 1000);\n  } else {\n    noTone(buzz);\n  }\n  delay(500);\n}\n'
  };

  /* ---------- Lint: instant syntax / logic errors ---------- */
  const TYPES = 'void|int|long|float|double|byte|boolean|bool|char|String|word|short|uint8_t|uint16_t|uint32_t|int8_t|int16_t|int32_t|size_t';
  const API_FN = { pinMode: 2, digitalWrite: 2, digitalRead: 1, analogWrite: 2, analogRead: 1, delay: 1, delayMicroseconds: 1, millis: 0, micros: 0, tone: [2, 3], noTone: 1, random: [1, 2], randomSeed: 1, map: 5, constrain: 3, abs: 1, min: 2, max: 2, sqrt: 1, pow: 2, sin: 1, cos: 1, tan: 1, sq: 1, round: 1, floor: 1, ceil: 1, log: 1, exp: 1, radians: 1, degrees: 1, sizeof: 1, pulseIn: [2, 3], String: [0, 1, 2] };
  const CONSTS = 'HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 PI HEX DEC BIN OCT NULL true false Serial'.split(' ');
  const KWS = ('if else for while do switch case default return break continue const static unsigned signed volatile struct enum typedef ' + TYPES.replace(/\|/g, ' ')).split(' ');
  const SERIAL_M = new Set(['begin', 'print', 'println', 'write', 'available', 'read', 'flush', 'end', 'parseInt', 'setTimeout']);
  function strip(src, errs) {
    return src.replace(/\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?/g, (m, ...a) => {
      const off = a[a.length - 2];
      if ((m[0] === '"' || m[0] === "'") && (m.length < 2 || m[m.length - 1] !== m[0] || /\\$/.test(m.slice(0, -1)) && m.length < 3)) errs.push({ ln: src.slice(0, off).split('\n').length, msg: "missing terminating " + m[0] + " character", sev: 'e' });
      if (m.startsWith('/*') && !/\*\/$/.test(m)) errs.push({ ln: src.slice(0, off).split('\n').length, msg: "unterminated /* comment", sev: 'e' });
      if (m[0] === '"' || m[0] === "'") return '0' + ' '.repeat(Math.max(0, m.length - 1));
      return m.replace(/[^\n]/g, ' ');
    });
  }
  function lev(a, b) {
    const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return d[a.length][b.length];
  }
  function splitTop(s, sep) {
    const out = []; let d = 0, cur = '';
    for (const ch of s) { if ('([{'.includes(ch)) d++; else if (')]}'.includes(ch)) d--; if (ch === sep && d === 0) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out;
  }
  function lint(src) {
    const E = []; const c = strip(src, E); const lines = c.split('\n');
    const add = (ln, msg, sev) => E.push({ ln, msg, sev: sev || 'e' });
    // brackets
    const st = []; let ln = 1; const PM = { ')': '(', ']': '[', '}': '{' };
    for (const ch of c) {
      if (ch === '\n') ln++;
      else if ('([{'.includes(ch)) st.push([ch, ln]);
      else if (')]}'.includes(ch)) { const t = st.pop(); if (!t) add(ln, "unexpected '" + ch + "' (isse pehle koi '" + PM[ch] + "' nahi mila)"); else if (t[0] !== PM[ch]) { add(ln, "'" + ch + "' ka jod '" + t[0] + "' (line " + t[1] + ") se nahi banta"); } }
    }
    st.forEach(t => add(t[1], "expected '" + { '(': ')', '[': ']', '{': '}' }[t[0]] + "' — '" + t[0] + "' band nahi kiya"));
    // semicolons
    let depth = 0;
    lines.forEach((raw, i) => {
      const t = raw.trim(); const sd = depth;
      for (const ch of t) { if ('(['.includes(ch)) depth++; else if (')]'.includes(ch)) depth--; }
      if (!t || t[0] === '#' || sd > 0 || depth > 0) return;
      if (/[;{},:(]$/.test(t) || /^(else|do)$/.test(t)) return;
      if (/^(if|else\s+if|for|while|switch)\b.*\)$/.test(t)) return;
      if (/^(?:(?:static|inline|unsigned)\s+)*(?:void|int|long|float|double|byte|boolean|bool|char|String|word|short|uint\d+_t)\s+\w+\s*\([^;=]*\)$/.test(t)) return;
      if (/[+\-*\/%&|?=<>!^]$/.test(t)) return;
      const nx = lines.slice(i + 1).find(l => l.trim()); if (nx && /^\s*[+\-*\/%&|?:.=<>]/.test(nx) && !/^\s*(\+\+|--)/.test(nx)) return;
      add(i + 1, "expected ';' — is line ke end me semicolon (;) lagayein");
    });
    // names
    const fnDecl = new Set(), vars = new Set();
    let m; const rf = new RegExp('\\b(?:' + TYPES + ')\\s+\\*?(\\w+)\\s*\\(', 'g');
    while ((m = rf.exec(c))) fnDecl.add(m[1]);
    const rv = new RegExp('\\b(?:' + TYPES + ')\\s+([^;{}]*)', 'g');
    while ((m = rv.exec(c))) splitTop(m[1], ',').forEach(ch => { const n = (ch.match(/^\s*\*?\s*(\w+)/) || [])[1]; if (n) vars.add(n); });
    c.replace(/^[ \t]*#[ \t]*define[ \t]+(\w+)/gm, (_, n) => { vars.add(n); return _; });
    if (!fnDecl.has('setup')) add(1, "undefined reference to 'setup' — void setup() { } zaroori hai");
    if (!fnDecl.has('loop')) add(1, "undefined reference to 'loop' — void loop() { } zaroori hai");
    const known = new Set([...Object.keys(API_FN), ...CONSTS, ...KWS, ...fnDecl, ...vars]);
    const body = c.replace(/^[ \t]*#.*$/gm, '').replace(/\b\d[\w.]*/g, '0');
    const seen = new Set(); const ri = /(\.\s*)?\b([A-Za-z_]\w*)\b(\s*\()?/g; let k;
    while ((k = ri.exec(body))) {
      if (k[1]) continue; const n = k[2]; if (known.has(n)) continue;
      const line = body.slice(0, k.index).split('\n').length; if (seen.has(n + line)) continue; seen.add(n + line);
      let best = '', bd = 3; known.forEach(x => { if (/^[A-Z_]+$/.test(x) && x.length < 3) return; const d = lev(n.toLowerCase(), x.toLowerCase()); if (d < bd) { bd = d; best = x; } });
      add(line, "'" + n + "' was not declared in this scope" + (best ? " — kya aapka matlab '" + best + "' tha?" : ''));
    }
    // Serial members + argument counts
    const rs = /\bSerial\s*\.\s*(\w+)/g; let usesSer = false, begin = false;
    while ((k = rs.exec(c))) { usesSer = true; if (k[1] === 'begin') begin = true; if (!SERIAL_M.has(k[1])) add(c.slice(0, k.index).split('\n').length, "'Serial' has no member named '" + k[1] + "'"); }
    if (usesSer && !begin) add(1, 'Serial use kiya par Serial.begin(9600); setup() me nahi hai', 'w');
    const rc = /(?<![.\w])(\w+)\s*\(/g;
    while ((k = rc.exec(body))) {
      const n = k[1]; if (!(n in API_FN) || fnDecl.has(n)) continue;
      let d = 0, j = rc.lastIndex - 1, e = -1;
      for (; j < body.length; j++) { if (body[j] === '(') d++; else if (body[j] === ')') { d--; if (!d) { e = j; break; } } }
      if (e < 0) continue;
      const inner = body.slice(rc.lastIndex, e).trim(), cnt = inner ? splitTop(inner, ',').length : 0, want = [].concat(API_FN[n]);
      const okc = n === 'String' || want.includes(cnt);
      if (!okc) add(body.slice(0, k.index).split('\n').length, (cnt < Math.min(...want) ? 'too few' : 'too many') + " arguments to function '" + n + "' (chahiye: " + want.join(' ya ') + ')');
    }
    E.sort((a, b) => a.ln - b.ln);
    return E;
  }

  /* ---------- Arduino C++ -> JavaScript ---------- */
  function matchParen(s, i) { let d = 0; for (let k = i; k < s.length; k++) { if (s[k] === '(') d++; else if (s[k] === ')') { d--; if (!d) return k; } } return -1; }
  function guards(c) {
    let out = '', last = 0, m; const re = /\b(while|for)\s*\(/g;
    while ((m = re.exec(c))) {
      const op = m.index + m[0].length - 1, cl = matchParen(c, op); if (cl < 0) break;
      const inner = c.slice(op + 1, cl); let rep;
      if (m[1] === 'while') rep = '(await __y(),(' + inner + '))';
      else { const p = splitTop(inner, ';'); rep = p.length === 3 ? '(' + p[0] + ';(await __y(),(' + (p[1].trim() || 'true') + '));' + p[2] + ')' : '(' + inner + ')'; }
      out += c.slice(last, m.index) + m[1] + rep; last = cl + 1; re.lastIndex = cl + 1;
    }
    return out + c.slice(last);
  }
  function toJS(src) {
    const lit = []; let c = src.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, m => {
      if (m[0] === '/') return m.replace(/[^\n]/g, ''); lit.push(m); return '\u0001' + (lit.length - 1) + '\u0002';
    });
    c = c.replace(/^[ \t]*#[ \t]*include.*$/gm, '').replace(/^[ \t]*#[ \t]*define[ \t]+(\w+)[ \t]+(.*)$/gm, 'const $1 = $2;');
    const fns = [];
    const strip = p => p.replace(/\b(?:const|unsigned|signed|volatile)\b|\b(?:int|long|float|double|byte|boolean|bool|char|String|word|short|uint\d+_t|int\d+_t|size_t)\b|[&*]|\[\s*\]/g, '');
    c = c.replace(new RegExp('^[ \\t]*(?:(?:static|inline)\\s+)*(?:unsigned\\s+)?(?:' + TYPES + ')\\s+(\\w+)\\s*\\(([^)]*)\\)(\\s*)\\{', 'gm'), (_, n, p, w) => { fns.push(n); return 'async function ' + n + '(' + strip(p) + ')' + w + '{'; });
    c = c.replace(new RegExp('\\b(?:(?:const|static|volatile|unsigned|signed|register)\\s+)*(?:' + TYPES.replace('void|', '') + ')\\s+(?:long\\s+)?\\*?\\s*(?=[A-Za-z_])', 'g'), 'let ');
    c = c.replace(/\blet\s+(\w+)\s*\[\s*\w*\s*\]\s*=\s*\{([^}]*)\}/g, 'let $1 = [$2]').replace(/\blet\s+(\w+)\s*\[\s*(\w+)\s*\]\s*;/g, 'let $1 = new Array($2).fill(0);');
    c = c.replace(/\(\s*(?:int|long|byte|word|char)\s*\)\s*(\w+(?:\([^()]*\))?|\([^()]*\))/g, 'Math.trunc($1)').replace(/\(\s*(?:float|double)\s*\)\s*/g, '');
    c = c.replace(/\.length\(\)/g, '.length');
    c = guards(c);
    fns.forEach(n => { c = c.replace(new RegExp('(?<!function\\s)(?<![.\\w])' + n + '\\s*\\(', 'g'), 'await ' + n + '('); });
    c = c.replace(/(?<![.\w])(delay|delayMicroseconds)\s*\(/g, 'await $1(');
    return c.replace(/\u0001(\d+)\u0002/g, (_, i) => lit[+i]);
  }
  const STOP = { stop: 1 };

  /* ---------- Virtual hardware ---------- */
  const COMP = [
    { id: 'red', t: 'led', n: 'LED Red', c: '#ff2b3d', pin: 13 }, { id: 'green', t: 'led', n: 'LED Green', c: '#22ff6a', pin: 12 },
    { id: 'yellow', t: 'led', n: 'LED Yellow', c: '#ffe600', pin: 11 }, { id: 'buzz', t: 'buz', n: 'Buzzer', c: '#ff9a3c', pin: 8 },
    { id: 'btn', t: 'btn', n: 'Push Button', c: '#4aa3ff', pin: 2 }, { id: 'pot', t: 'pot', n: 'Potentiometer', c: '#b57bff', pin: 14 },
    { id: 'ldr', t: 'ldr', n: 'LDR Light', c: '#ffd166', pin: 15 }, { id: 'tmp', t: 'tmp', n: 'TMP36 Temp', c: '#34e0d0', pin: 16 }
  ];
  const PWM = new Set([3, 5, 6, 9, 10, 11]);
  const X = i => 62 + i * 68, TY = 300, RAIL = 520;
  const pinName = p => p >= 14 ? 'A' + (p - 14) : 'D' + p;
  const pinXY = p => p < 14 ? [285 + (13 - p) * 21, 28] : [370 + (p - 14) * 21, 196];
  const S = { mode: {}, val: {}, pwm: {}, tone: null, btn: false, pot: 512, ldr: 70, tmp: 25 };
  const svg = q('#ardSvg'), serEl = q('#ardSer'), msgEl = q('#ardMsg'), statEl = q('#ardStat');
  const R = {};
  function buildSVG() {
    let s = '<defs><filter id="ardBlur" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="9"/></filter><pattern id="ardDots" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="1.7" fill="#b9ae8c"/></pattern></defs>';
    s += '<rect x="20" y="10" width="580" height="200" rx="12" fill="#00838a" stroke="#00565b" stroke-width="3"/><rect x="20" y="62" width="58" height="62" rx="4" fill="#c9ced6" stroke="#8a919c"/><rect x="20" y="146" width="44" height="46" rx="4" fill="#1c1c20"/>';
    s += '<circle cx="108" cy="46" r="11" fill="#d22" stroke="#800"/><text x="108" y="72" fill="#fff" font-size="10" text-anchor="middle">RESET</text><rect x="318" y="96" width="150" height="38" rx="3" fill="#222" stroke="#000"/><text x="393" y="119" fill="#bbb" font-size="11" text-anchor="middle">ATmega328P</text>';
    s += '<text x="150" y="130" fill="#fff" font-size="26" font-weight="800" font-family="system-ui">ARDUINO</text><text x="150" y="156" fill="#bff" font-size="15" font-family="system-ui">UNO · IoT Lab</text>';
    s += '<rect x="278" y="14" width="306" height="17" rx="2" fill="#15151a"/>';
    for (let p = 0; p <= 13; p++) { const [x, y] = pinXY(p); s += '<rect x="' + (x - 5) + '" y="17" width="10" height="11" fill="#d8b34a"/><text x="' + x + '" y="46" fill="#fff" font-size="9" text-anchor="middle">' + (PWM.has(p) ? '~' : '') + p + '</text>'; }
    s += '<circle id="ardL" cx="262" cy="64" r="5" fill="#ffb300" opacity=".25"/><text x="262" y="82" fill="#fff" font-size="9" text-anchor="middle">L</text>';
    s += '<rect x="300" y="188" width="136" height="15" rx="2" fill="#15151a"/><rect x="362" y="188" width="126" height="15" rx="2" fill="#15151a"/>';
    [['5V', 300], ['GND', 321]].forEach(a => { s += '<rect x="' + (a[1] - 5) + '" y="189" width="10" height="11" fill="#d8b34a"/><text x="' + a[1] + '" y="182" fill="#fff" font-size="9" text-anchor="middle">' + a[0] + '</text>'; });
    for (let p = 14; p <= 19; p++) { const [x] = pinXY(p); s += '<rect x="' + (x - 5) + '" y="189" width="10" height="11" fill="#d8b34a"/><text x="' + x + '" y="182" fill="#fff" font-size="9" text-anchor="middle">A' + (p - 14) + '</text>'; }
    s += '<rect x="20" y="248" width="580" height="292" rx="10" fill="#f1ead6" stroke="#cfc6a8" stroke-width="2"/><rect x="26" y="254" width="568" height="280" rx="8" fill="url(#ardDots)" opacity=".7"/>';
    s += '<line x1="34" y1="262" x2="586" y2="262" stroke="#e23b3b" stroke-width="5"/><text x="40" y="256" font-size="10" fill="#a11" font-weight="700">+5V</text>';
    s += '<line x1="34" y1="' + RAIL + '" x2="586" y2="' + RAIL + '" stroke="#2a6bff" stroke-width="5"/><text x="40" y="' + (RAIL + 17) + '" font-size="10" fill="#1844a8" font-weight="700">GND −</text>';
    s += '<g id="ardWires"></g>';
    COMP.forEach((c, i) => {
      const x = X(i), leg = (a, b) => '<line x1="' + x + '" y1="' + a + '" x2="' + x + '" y2="' + b + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      s += '<g id="c' + i + '">';
      if (c.t === 'led') {
        s += '<circle class="glow" cx="' + x + '" cy="338" r="34" fill="' + c.c + '" opacity="0" filter="url(#ardBlur)"/>' + leg(TY, 322) + '<rect x="' + (x - 13) + '" y="322" width="26" height="32" rx="12" fill="' + c.c + '" opacity=".28" stroke="#555"/><rect class="lit" x="' + (x - 13) + '" y="322" width="26" height="32" rx="12" fill="' + c.c + '" opacity="0"/><ellipse cx="' + (x - 5) + '" cy="332" rx="3" ry="6" fill="#fff" opacity=".5"/>' + leg(354, 372) + '<rect x="' + (x - 7) + '" y="372" width="14" height="42" rx="4" fill="#d9b88a" stroke="#8a6a3a"/><rect x="' + (x - 7) + '" y="380" width="14" height="4" fill="#c00"/><rect x="' + (x - 7) + '" y="388" width="14" height="4" fill="#111"/><rect x="' + (x - 7) + '" y="396" width="14" height="4" fill="#a60"/>' + '<line x1="' + x + '" y1="414" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      } else if (c.t === 'buz') {
        s += leg(TY, 330) + '<g class="bz"><path class="wave" d="M' + (x + 26) + ' 336 q10 16 0 32" fill="none" stroke="' + c.c + '" stroke-width="3"/><path class="wave" d="M' + (x + 34) + ' 330 q16 22 0 44" fill="none" stroke="' + c.c + '" stroke-width="3"/><path class="wave" d="M' + (x - 26) + ' 336 q-10 16 0 32" fill="none" stroke="' + c.c + '" stroke-width="3"/><path class="wave" d="M' + (x - 34) + ' 330 q-16 22 0 44" fill="none" stroke="' + c.c + '" stroke-width="3"/></g><circle cx="' + x + '" cy="352" r="24" fill="#1b1b20" stroke="#555" stroke-width="2"/><circle cx="' + x + '" cy="352" r="6" fill="#000"/><text x="' + (x - 14) + '" y="336" fill="#ddd" font-size="11">+</text>' + '<line x1="' + x + '" y1="376" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      } else if (c.t === 'btn') {
        s += leg(TY, 330) + '<g class="btnc" tabindex="-1"><rect x="' + (x - 21) + '" y="330" width="42" height="42" rx="6" fill="#2b2f3a" stroke="#111" stroke-width="2"/><circle class="cap" cx="' + x + '" cy="351" r="14" fill="' + c.c + '" stroke="#12304f" stroke-width="2"/></g><line x1="' + x + '" y1="372" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      } else if (c.t === 'pot') {
        s += leg(TY, 328) + '<circle cx="' + x + '" cy="352" r="25" fill="#2a2350" stroke="#111" stroke-width="2"/><g class="knob" transform="rotate(0 ' + x + ' 352)"><circle cx="' + x + '" cy="352" r="17" fill="' + c.c + '"/><rect x="' + (x - 2) + '" y="336" width="4" height="13" rx="2" fill="#1a0d33"/></g><line x1="' + x + '" y1="377" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      } else if (c.t === 'ldr') {
        s += leg(TY, 338) + '<circle class="sun" cx="' + (x + 22) + '" cy="326" r="7" fill="#ffd166" opacity=".2"/><rect x="' + (x - 17) + '" y="338" width="34" height="20" rx="10" fill="#c8913a" stroke="#5a3a10" stroke-width="2"/><path d="M' + (x - 11) + ' 348 l4 -5 l4 10 l4 -10 l4 10 l4 -10 l3 5" fill="none" stroke="#5a3a10" stroke-width="1.6"/><line x1="' + x + '" y1="358" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      } else {
        s += leg(TY, 340) + '<path d="M' + (x - 17) + ' 376 v-16 a17 17 0 0 1 34 0 v16 z" fill="#25252b" stroke="#000" stroke-width="2"/><text x="' + x + '" y="372" fill="#ddd" font-size="8" text-anchor="middle">TMP36</text><line x1="' + x + '" y1="376" x2="' + x + '" y2="' + RAIL + '" stroke="#9a9a9a" stroke-width="2.5"/>';
      }
      s += '<circle cx="' + x + '" cy="' + TY + '" r="4.5" fill="#d8b34a" stroke="#7a5f10"/>';
      s += '<text class="nm" x="' + x + '" y="446" text-anchor="middle" font-size="10" font-weight="700" fill="#2a2437" style="paint-order:stroke;stroke:#f1ead6;stroke-width:4px">' + c.n.replace('Potentiometer', 'Pot') + '</text><text class="pn" x="' + x + '" y="460" text-anchor="middle" font-size="10" fill="#7a1fa2" font-weight="700" style="paint-order:stroke;stroke:#f1ead6;stroke-width:4px"></text><text class="vl" x="' + x + '" y="486" text-anchor="middle" font-size="11" font-weight="700" fill="#0b4d2e" style="paint-order:stroke;stroke:#f1ead6;stroke-width:4px"></text></g>';
    });
    svg.innerHTML = s;
    COMP.forEach((c, i) => { const g = q('#c' + i, svg); R[c.id] = { g, glow: q('.glow', g), lit: q('.lit', g), cap: q('.cap', g), knob: q('.knob', g), sun: q('.sun', g), bz: q('.bz', g), pn: q('.pn', g), vl: q('.vl', g), btn: q('.btnc', g) }; });
    R.L = q('#ardL', svg);
    // button on the board is clickable
    const bd = e => { e.preventDefault(); S.btn = true; paint(); }, bu = () => { if (S.btn) { S.btn = false; paint(); } };
    R.btn.btn.addEventListener('pointerdown', bd); window.addEventListener('pointerup', bu); window.addEventListener('pointercancel', bu);
  }
  function drawWires() {
    let w = '<path class="wire" id="wr5v" d="M300 203 C300 250 70 210 42 262" stroke="#e23b3b" color="#e23b3b"/><path class="wire" id="wrg" d="M321 203 C321 330 8 300 26 ' + RAIL + '" stroke="#2a6bff" color="#2a6bff"/>';
    COMP.forEach((c, i) => {
      const [px, py] = pinXY(c.pin), x = X(i), dy = c.pin < 14 ? 130 : 60;
      w += '<path class="wire" data-w="' + c.id + '" d="M' + px + ' ' + (py + (c.pin < 14 ? 0 : 6)) + ' C' + px + ' ' + (py + dy) + ' ' + x + ' ' + (TY - dy) + ' ' + x + ' ' + TY + '" stroke="' + c.c + '" color="' + c.c + '"/>';
      if (c.t === 'pot' || c.t === 'ldr' || c.t === 'tmp') w += '<line class="wire" x1="' + (x + 12) + '" y1="262" x2="' + (x + 12) + '" y2="' + (TY - 6) + '" stroke="#e23b3b" stroke-width="2" style="stroke-width:2"/>';
      R[c.id].pn.textContent = pinName(c.pin);
    });
    q('#ardWires', svg).innerHTML = w;
  }
  const lvl = p => S.pwm[p] != null ? S.pwm[p] / 255 : (S.val[p] ? (S.mode[p] === 1 ? 1 : .25) : 0);
  const adc = c => c.t === 'pot' ? Math.round(S.pot) : c.t === 'ldr' ? Math.round(S.ldr * 10.23) : Math.round((0.5 + S.tmp / 100) / 5 * 1023);
  let raf = 0; function paint() { if (!raf) raf = requestAnimationFrame(doPaint); }
  function doPaint() {
    raf = 0;
    COMP.forEach((c, i) => {
      const r = R[c.id], wr = q('[data-w="' + c.id + '"]', svg); let on = false;
      if (c.t === 'led') { const v = lvl(c.pin); r.glow.style.opacity = v * .95; r.lit.style.opacity = v; on = v > 0; }
      else if (c.t === 'buz') { on = !!(S.tone && S.tone.p === c.pin); r.g.classList.toggle('snd', on); }
      else if (c.t === 'btn') { on = S.btn; r.cap.setAttribute('cy', S.btn ? 355 : 351); r.cap.setAttribute('r', S.btn ? 12 : 14); r.vl.textContent = S.btn ? 'PRESSED' : ''; }
      else { on = true; r.vl.textContent = c.t === 'tmp' ? S.tmp + '°C · ' + adc(c) : c.t === 'ldr' ? S.ldr + '% · ' + adc(c) : adc(c); if (c.t === 'pot') r.knob.setAttribute('transform', 'rotate(' + Math.round(-135 + S.pot / 1023 * 270) + ' ' + X(i) + ' 352)'); if (c.t === 'ldr') r.sun.style.opacity = .15 + S.ldr / 120; }
      if (wr) wr.classList.toggle('on', on && (c.t === 'led' || c.t === 'buz' || c.t === 'btn'));
    });
    R.L.setAttribute('opacity', .25 + .75 * lvl(13)); R.L.setAttribute('fill', lvl(13) > 0 ? '#ffe600' : '#ffb300');
    chips.forEach(ch => { const p = +ch.dataset.p, md = S.mode[p]; ch.className = S.pwm[p] != null ? 'pw' : S.val[p] && md === 1 ? 'hi' : md === 0 || md === 2 ? 'in' : ''; ch.title = pinName(p) + (md === 1 ? ' OUTPUT' : md === 2 ? ' INPUT_PULLUP' : md === 0 ? ' INPUT' : ' (not set)') + (S.pwm[p] != null ? ' PWM ' + S.pwm[p] : ''); });
  }
  // pin chips
  const chips = []; (function () { const box = q('#ardPins'); for (let p = 2; p <= 19; p++) { const i = document.createElement('i'); i.dataset.p = p; i.textContent = pinName(p); box.appendChild(i); chips.push(i); } })();
  // wiring + sensor controls
  (function () {
    const wb = q('#ardWire'), sb = q('#ardSens');
    COMP.forEach(c => {
      const l = document.createElement('label'), sel = document.createElement('select'); l.textContent = c.n + ' pin'; l.appendChild(sel);
      const list = (c.t === 'pot' || c.t === 'ldr' || c.t === 'tmp') ? [14, 15, 16, 17, 18, 19] : [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
      list.forEach(p => { const o = document.createElement('option'); o.value = p; o.textContent = pinName(p) + (PWM.has(p) ? ' (~PWM)' : ''); if (p === c.pin) o.selected = true; sel.appendChild(o); });
      sel.onchange = () => { c.pin = +sel.value; drawWires(); paint(); relint(); }; wb.appendChild(l);
    });
    const mk = (txt, min, max, key, unit) => { const l = document.createElement('label'), i = document.createElement('input'), sp = document.createElement('span'); i.type = 'range'; i.min = min; i.max = max; i.value = S[key]; const f = () => { S[key] = +i.value; sp.textContent = txt + ': ' + i.value + unit; paint(); }; i.oninput = f; l.append(sp, i); sb.appendChild(l); f(); };
    mk('Potentiometer', 0, 1023, 'pot', ''); mk('Light (LDR)', 0, 100, 'ldr', '%'); mk('Temperature', 0, 50, 'tmp', '°C');
    const h = document.createElement('button'); h.type = 'button'; h.className = 'ard-hold'; h.textContent = '👆 Push Button — dabaye rakho'; sb.appendChild(h);
    const dn = e => { e.preventDefault(); S.btn = true; h.classList.add('on'); paint(); }, up = () => { S.btn = false; h.classList.remove('on'); paint(); };
    h.addEventListener('pointerdown', dn); h.addEventListener('pointerup', up); h.addEventListener('pointerleave', up); h.addEventListener('pointercancel', up);
    h.addEventListener('keydown', e => { if (e.key === ' ' || e.key === 'Enter') dn(e); }); h.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') up(); });
  })();
  buildSVG(); drawWires(); paint();

  /* ---------- Sound ---------- */
  let AC = null, osc = null, gn = null;
  function beep(f) { if (!q('#ardSnd').checked) return; try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); if (!osc) { osc = AC.createOscillator(); gn = AC.createGain(); osc.type = 'square'; osc.connect(gn); gn.connect(AC.destination); osc.start(); } osc.frequency.value = f; gn.gain.value = .035; } catch (e) { } }
  function hush() { try { if (gn) gn.gain.value = 0; } catch (e) { } }

  /* ---------- Messages / status ---------- */
  const ed = editor(q('#ardEd'), 'cpp', EX.blink, q('#ardSym'));
  const warned = new Set();
  function showMsgs(list) {
    msgEl.innerHTML = '';
    const bad = new Set();
    list.forEach(x => { const d = document.createElement('div'); d.className = x.sev === 'e' ? 'e' : 'w'; d.textContent = (x.sev === 'e' ? '✖ ' : '⚠ ') + (x.ln ? 'Line ' + x.ln + ': ' : '') + x.msg; msgEl.appendChild(d); if (x.sev === 'e' && x.ln) bad.add(x.ln); });
    if (!list.some(x => x.sev === 'e')) { const d = document.createElement('div'); d.className = 'g'; d.textContent = '✔ Syntax OK — koi error nahi mili'; msgEl.prepend(d); }
    ed.mark(bad);
  }
  function setStat(t, c) { statEl.textContent = t || (running ? '● Running' : '● Stopped'); statEl.className = 'px-pill' + (c ? ' ' + c : running ? ' run' : ''); }
  function rtMsg(msg, sev) { const d = document.createElement('div'); d.className = sev === 'e' ? 'e' : 'w'; d.textContent = (sev === 'e' ? '✖ Runtime error: ' : '⚠ ') + msg; msgEl.appendChild(d); msgEl.scrollTop = msgEl.scrollHeight; }
  function warn(k, m) { if (warned.has(k)) return; warned.add(k); rtMsg(m, 'w'); }

  /* ---------- Simulation engine ---------- */
  let runId = 0, running = false; const timers = new Set();
  function mkApi(id) {
    const gd = () => { if (id !== runId) throw STOP; };
    const chk = p => { if (!Number.isInteger(p) || p < 0 || p > 19) throw new Error('Pin ' + p + ' valid nahi hai (UNO: D0–D13, A0–A5)'); };
    const norm = p => (p >= 0 && p <= 5) ? p + 14 : p;
    const t0 = performance.now(); let n = 0;
    const fmt = (x, b) => { if (typeof x === 'number') { if (Number.isInteger(x)) return (b && b !== 10) ? (x >>> 0).toString(b).toUpperCase() : String(x); return x.toFixed(b === undefined || b > 8 ? 2 : b); } if (typeof x === 'boolean') return x ? '1' : '0'; return String(x); };
    const pr = t => { serEl.textContent = (serEl.textContent + t).slice(-6000); serEl.scrollTop = serEl.scrollHeight; };
    const a = {
      HIGH: 1, LOW: 0, INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2, LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19, PI: Math.PI, HEX: 16, DEC: 10, BIN: 2, OCT: 8, NULL: 0,
      __y: async () => { gd(); if (++n % 200 === 0) { await new Promise(r => setTimeout(r, 0)); gd(); } },
      delay: ms => { gd(); return new Promise((res, rej) => { const t = { rej }; t.id = setTimeout(() => { timers.delete(t); res(); }, Math.max(0, +ms || 0)); timers.add(t); }); },
      pinMode: (p, m) => { gd(); chk(p); S.mode[p] = m; if (m === 2) S.val[p] = 1; paint(); },
      digitalWrite: (p, v) => { gd(); chk(p); if (S.mode[p] === undefined) warn('pm' + p, 'digitalWrite(' + p + ') se pehle pinMode(' + p + ', OUTPUT); likhein — warna LED poori nahi jalegi'); else if (S.mode[p] !== 1 && v) warn('po' + p, 'Pin ' + p + ' OUTPUT mode me nahi hai'); S.val[p] = v ? 1 : 0; S.pwm[p] = null; paint(); },
      digitalRead: p => { gd(); chk(p); const c = COMP.find(x => x.t === 'btn' && x.pin === p); if (S.mode[p] === 1) return S.val[p] ? 1 : 0; if (c) return S.btn ? (S.mode[p] === 2 ? 0 : 1) : (S.mode[p] === 2 ? 1 : 0); if (S.mode[p] === undefined) warn('rm' + p, 'digitalRead(' + p + ') se pehle pinMode(' + p + ', INPUT) likhein'); return S.mode[p] === 2 ? 1 : 0; },
      analogWrite: (p, v) => { gd(); chk(p); if (!PWM.has(p)) warn('pw' + p, 'Pin ' + p + ' PWM support nahi karta — 3, 5, 6, 9, 10, 11 (~) use karein'); v = Math.max(0, Math.min(255, Math.trunc(v))); if (S.mode[p] === undefined) S.mode[p] = 1; S.pwm[p] = PWM.has(p) ? v : null; S.val[p] = v >= 128 ? 1 : 0; paint(); },
      analogRead: p => { gd(); p = norm(p); chk(p); const c = COMP.find(x => (x.t === 'pot' || x.t === 'ldr' || x.t === 'tmp') && x.pin === p); return c ? adc(c) : 0; },
      tone: (p, f, d) => { gd(); chk(p); S.tone = { p, f }; beep(f); paint(); if (d) { const tk = S.tone; setTimeout(() => { if (S.tone === tk && id === runId) { S.tone = null; hush(); paint(); } }, d); } },
      noTone: p => { gd(); S.tone = null; hush(); paint(); },
      millis: () => Math.floor(performance.now() - t0), micros: () => Math.floor((performance.now() - t0) * 1000),
      random: (x, y) => y === undefined ? Math.floor(Math.random() * x) : x + Math.floor(Math.random() * (y - x)), randomSeed: () => { },
      map: (x, a1, b1, c1, d1) => Math.trunc((x - a1) * (d1 - c1) / (b1 - a1) + c1), constrain: (x, lo, hi) => Math.min(hi, Math.max(lo, x)),
      abs: Math.abs, min: Math.min, max: Math.max, sqrt: Math.sqrt, pow: Math.pow, sin: Math.sin, cos: Math.cos, tan: Math.tan, sq: x => x * x, round: Math.round, floor: Math.floor, ceil: Math.ceil, log: Math.log, exp: Math.exp, radians: x => x * Math.PI / 180, degrees: x => x * 180 / Math.PI,
      sizeof: x => Array.isArray(x) ? x.length * 2 : 2, pulseIn: () => 0,
      Serial: { begin: () => { }, end: () => { }, flush: () => { }, available: () => 0, read: () => -1, parseInt: () => 0, setTimeout: () => { }, write: x => pr(String.fromCharCode(x)), print: (x, b) => pr(fmt(x, b)), println: (x, b) => pr((x === undefined ? '' : fmt(x, b)) + '\n') }
    };
    a.delayMicroseconds = us => a.delay(us / 1000);
    return a;
  }
  const cleanup = () => { timers.forEach(t => { clearTimeout(t.id); t.rej(STOP); }); timers.clear(); S.tone = null; hush(); };
  function stopSim() { runId++; running = false; cleanup(); setStat(); paint(); }
  function resetState() { S.mode = {}; S.val = {}; S.pwm = {}; S.tone = null; warned.clear(); paint(); }
  async function runSim() {
    stopSim(); const src = ed.get(), res = lint(src); showMsgs(res);
    if (res.some(x => x.sev === 'e')) { setStat('● Error', 'err'); return; }
    resetState(); serEl.textContent = '';
    const id = ++runId; running = true; setStat();
    let prog;
    try {
      const js = toJS(src);
      const F = new Function('__a', 'with(__a){return (async function(){' + js + '\nreturn {setup:typeof setup==="function"?setup:null,loop:typeof loop==="function"?loop:null};})();}');
      prog = await F(mkApi(id));
    } catch (e) { if (e !== STOP) { rtMsg(String(e.message || e), 'e'); running = false; setStat('● Error', 'err'); } return; }
    try {
      if (prog.setup) await prog.setup();
      if (prog.loop) while (id === runId) { await prog.loop(); if (id !== runId) break; await new Promise(r => setTimeout(r, 1)); }
    } catch (e) { if (e !== STOP && id === runId) { rtMsg(String(e.message || e), 'e'); running = false; cleanup(); setStat('● Error', 'err'); } }
  }
  ARD.run = runSim;
  let tl = 0, tr = 0;
  function relint() { clearTimeout(tl); tl = setTimeout(() => { const r = lint(ed.get()); showMsgs(r); if (!r.some(x => x.sev === 'e')) { if (!running) setStat(); } else setStat('● Error', 'err'); }, 250); }
  ed.onchange = () => {
    relint(); clearTimeout(tr);
    if (q('#ardLive').checked) tr = setTimeout(() => { if (!lint(ed.get()).some(x => x.sev === 'e')) runSim(); }, 900);
  };
  ed.onrun = runSim;
  q('#ardRun').onclick = runSim; q('#ardStop').onclick = () => { clearTimeout(tr); stopSim(); resetState(); };
  q('#ardReset').onclick = () => { clearTimeout(tr); stopSim(); resetState(); ed.set(EX.blink); showMsgs(lint(ed.get())); serEl.textContent = ''; };
  q('#ardSerClr').onclick = () => { serEl.textContent = ''; };
  q('#ardEx').onchange = e => { const v = EX[e.target.value]; e.target.value = ''; if (v) { clearTimeout(tr); ed.set(v); showMsgs(lint(v)); runSim(); } };
  q('#ardSnd').onchange = e => { if (!e.target.checked) hush(); };
  showMsgs(lint(ed.get())); setStat();
  document.addEventListener('visibilitychange', () => { if (document.hidden) hush(); });
  window.__pxArduino = { lint, toJS };   // debugging / testing hook
})();


/* =====================================================================
   🎯 INTERACTIVE CAREER & COURSE FINDER QUIZ
   - 6 sawal -> score -> best course + match % + 2nd option
   - Result ke baad naam likhkar seedha WhatsApp par connect
   - Course list neeche COURSE_INFO me hai, naya course add karna ho to yahin add karein
   ===================================================================== */
(() => {
  const root = document.getElementById('cfCard');
  if (!root) return;

  const WA_NUMBER = '916393512412';          // Manoj Kumar Singh ka WhatsApp
  const CALL_NUMBER = '+916393512412';
  const CENTRE = 'Access Computer Education Center, Bachhrawan';

  const COURSE_INFO = {
    ccc:    { icon: '🖥️', name: 'CCC',           pitch: 'Computer ki basic skills aur sarkari exams/forms ke liye sabse zaroori certificate course.',
              learn: ['Computer Basics', 'Word / Excel / PPT', 'Internet & Email', 'Digital Services'] },
    olevel: { icon: '🎓', name: "O-Level (NIELIT)", pitch: 'IT ka strong foundation: programming, web aur IoT ke saath government-recognised qualification.',
              learn: ['IT Tools', 'Web Design', 'Python', 'IoT'] },
    tally:  { icon: '🧾', name: 'Tally + GST',    pitch: 'Accounting, billing aur GST seekhkar shop, office ya CA firm me kaam paane ka practical raasta.',
              learn: ['Accounting', 'GST', 'Billing', 'Excel Reports'] },
    dtp:    { icon: '🎨', name: 'DTP / Graphic Design', pitch: 'Poster, banner, visiting card aur social media design banana seekhein aur print/design shop ya freelancing me kaam karein.',
              learn: ['Photoshop', 'CorelDRAW', 'Poster & Banner', 'Print Design'] },
    web:    { icon: '🌐', name: 'Web Designing',  pitch: 'HTML, CSS aur JavaScript se khud ki website banayein aur online kaam ya freelancing shuru karein.',
              learn: ['HTML', 'CSS', 'JavaScript', 'Website Project'] }
  };
  const KEYS = Object.keys(COURSE_INFO);

  // Har option ke saath har course ko points (0-3)
  const QUIZ = [
    { q: 'Computer seekhne ka aapka main goal kya hai?', opts: [
      { e: '🏛️', t: 'Sarkari naukri ya form bharna',       s: { ccc: 3, olevel: 2 } },
      { e: '💼', t: 'Office / shop me job paana',           s: { tally: 3, ccc: 2, dtp: 1 } },
      { e: '🚀', t: 'Online kaam ya freelancing',           s: { web: 3, dtp: 3 } },
      { e: '🧑‍💻', t: 'IT field me strong career banana',     s: { olevel: 3, web: 2 } } ] },
    { q: 'Inme se aapko kaunsa kaam sabse mazedaar lagta hai?', opts: [
      { e: '🔢', t: 'Hisab-kitab, bill aur numbers',        s: { tally: 3, ccc: 1 } },
      { e: '🎨', t: 'Design, colors aur photo editing',     s: { dtp: 3, web: 1 } },
      { e: '⚙️', t: 'Logic, coding aur puzzle solve karna', s: { web: 3, olevel: 2 } },
      { e: '📄', t: 'Typing, documents aur computer basics', s: { ccc: 3, olevel: 1 } } ] },
    { q: 'Aap abhi kis stage par hain?', opts: [
      { e: '🌱', t: 'Bilkul beginner, computer pehli baar', s: { ccc: 3, dtp: 1 } },
      { e: '📘', t: '10th / 12th pass, aage badhna hai',    s: { olevel: 2, ccc: 2, tally: 1 } },
      { e: '🎓', t: 'Graduation chal rahi ya complete',     s: { olevel: 2, tally: 2, web: 2 } },
      { e: '🛠️', t: 'Thoda kaam aata hai, skill upgrade',   s: { web: 3, dtp: 2, tally: 1 } } ] },
    { q: 'Kaunsa tool/software use karna pasand karenge?', opts: [
      { e: '📊', t: 'Excel, Tally, billing software',       s: { tally: 3 } },
      { e: '🖌️', t: 'Photoshop, CorelDRAW, Canva',          s: { dtp: 3 } },
      { e: '🌍', t: 'Website banana, HTML/CSS code',        s: { web: 3 } },
      { e: '🗂️', t: 'Word, PPT, email, internet',           s: { ccc: 3, olevel: 1 } } ] },
    { q: 'Course ke liye aapke paas kitna samay hai?', opts: [
      { e: '⚡', t: 'Jaldi chahiye, chhota course',          s: { ccc: 3, dtp: 1, tally: 1 } },
      { e: '⏳', t: 'Medium time, practical skill',          s: { tally: 2, dtp: 2, web: 2 } },
      { e: '📅', t: 'Lamba time, deep learning',             s: { olevel: 3, web: 2 } },
      { e: '🤔', t: 'Abhi pata nahi, guidance chahiye',      s: { ccc: 1, olevel: 1, tally: 1 } } ] },
    { q: '1 saal baad khud ko kahan dekhna chahte hain?', opts: [
      { e: '🏢', t: 'Sarkari / private naukri me',           s: { ccc: 3, olevel: 3, tally: 1 } },
      { e: '🏪', t: 'Apni dukaan ya business chalate hue',   s: { tally: 3, dtp: 2 } },
      { e: '💻', t: 'Freelancer / website developer',        s: { web: 3, dtp: 2 } },
      { e: '📚', t: 'Aage padhai, IT degree ki taiyari',     s: { olevel: 3, ccc: 1, web: 1 } } ] }
  ];

  // Har course ka maximum possible score (percentage nikalne ke liye)
  const MAX = {};
  KEYS.forEach(k => { MAX[k] = QUIZ.reduce((sum, qu) => sum + Math.max(...qu.opts.map(o => o.s[k] || 0)), 0); });

  let step = -1;                 // -1 = intro, 0..n-1 = sawal, n = result
  let answers = [];              // har sawal me chuna hua option index

  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const mount = node => { root.innerHTML = ''; node.classList.add('cf-screen'); root.appendChild(node); };

  function score() {
    const total = {}; KEYS.forEach(k => total[k] = 0);
    answers.forEach((ai, qi) => { const s = QUIZ[qi].opts[ai].s; for (const k in s) total[k] += s[k]; });
    return KEYS.map(k => ({ key: k, raw: total[k], pct: Math.round((total[k] / MAX[k]) * 100) }))
               .sort((a, b) => b.raw - a.raw || b.pct - a.pct);
  }

  function intro() {
    const w = el('div', 'cf-intro', `
      <div class="cf-orb" aria-hidden="true">🎯</div>
      <h3>Aapke liye best course kaunsa hai?</h3>
      <p>Sirf ${QUIZ.length} chhote sawal. Aapke interest aur goal ke hisab se hum sahi course suggest karenge aur seedha WhatsApp par baat karwayenge.</p>
      <div class="cf-chips">${KEYS.map(k => `<span class="cf-chip">${COURSE_INFO[k].icon} ${esc(COURSE_INFO[k].name)}</span>`).join('')}</div>
      <button type="button" class="btn" id="cfStart">Quiz Shuru Karein 🚀</button>`);
    mount(w);
    w.querySelector('#cfStart').onclick = () => { step = 0; answers = []; render(); };
  }

  function question() {
    const qu = QUIZ[step], pct = Math.round((step / QUIZ.length) * 100);
    const w = el('div', '', `
      <div class="cf-top"><span>Sawal <b>${step + 1}</b> / ${QUIZ.length}</span><span>${pct}% complete</span></div>
      <div class="cf-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>
      <h3 class="cf-q" id="cfQ" tabindex="-1">${esc(qu.q)}</h3>
      <div class="cf-opts" role="group" aria-labelledby="cfQ"></div>
      <div class="cf-nav"><button type="button" class="cf-link" id="cfBack" ${step === 0 ? 'hidden' : ''}>← Peeche</button><button type="button" class="cf-link" id="cfRestart">Dobara shuru</button></div>`);
    const box = w.querySelector('.cf-opts');
    qu.opts.forEach((o, i) => {
      const b = el('button', 'cf-opt' + (answers[step] === i ? ' sel' : ''), `<span class="e" aria-hidden="true">${o.e}</span><span>${esc(o.t)}</span>`);
      b.type = 'button';
      b.setAttribute('aria-pressed', answers[step] === i ? 'true' : 'false');
      b.onclick = () => {
        answers[step] = i;
        box.querySelectorAll('.cf-opt').forEach(x => x.classList.remove('sel'));
        b.classList.add('sel');
        const fill = w.querySelector('.cf-bar i'); if (fill) fill.style.width = Math.round(((step + 1) / QUIZ.length) * 100) + '%';
        setTimeout(() => { step++; render(); }, 280);
      };
      box.appendChild(b);
    });
    w.querySelector('#cfBack').onclick = () => { step = Math.max(0, step - 1); render(); };
    w.querySelector('#cfRestart').onclick = () => { step = -1; answers = []; render(); };
    mount(w);
    w.querySelector('#cfQ').focus({ preventScroll: true });
  }

  function waLink(name, best, second) {
    const msg = `Namaste ${CENTRE}! 🙏\nMera naam ${name} hai.\nMaine website par Course Finder Quiz diya. Mujhe "${COURSE_INFO[best.key].name}" course suggest hua (${best.pct}% match)` +
      (second ? ` aur doosra option "${COURSE_INFO[second.key].name}" aaya.` : '.') +
      `\nKripya is course ki fees, batch timing aur admission ki jankari dijiye.`;
    return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
  }

  function result() {
    const ranked = score(), best = ranked[0], second = ranked[1];
    const c = COURSE_INFO[best.key], c2 = COURSE_INFO[second.key];
    try { localStorage.setItem('acec_cf_result', JSON.stringify({ best: best.key, pct: best.pct, t: Date.now() })); } catch (e) { /* private mode */ }

    const w = el('div', '', `
      <div class="cf-res-head"><span class="cf-kicker">✦ YOUR BEST MATCH ✦</span></div>
      <div class="cf-win">
        <div class="cf-ring" style="--p:${best.pct}"><b>${best.pct}%</b><small>match</small></div>
        <div>
          <h3>${c.icon} ${esc(c.name)}</h3>
          <p>${esc(c.pitch)}</p>
          <div class="cf-learn">${c.learn.map(x => `<span>${esc(x)}</span>`).join('')}</div>
        </div>
      </div>
      <div class="cf-alt"><span aria-hidden="true">${c2.icon}</span><span>Doosra best option: <b>${esc(c2.name)}</b> (${second.pct}% match)</span></div>
      <div class="cf-bars">${ranked.map(r => `<div class="cf-brow"><span>${COURSE_INFO[r.key].icon} ${esc(COURSE_INFO[r.key].name.split(' ')[0])}</span><i><em data-w="${r.pct}"></em></i><span>${r.pct}%</span></div>`).join('')}</div>
      <div class="cf-lead">
        <label for="cfName">Aapka naam (WhatsApp message me jayega)
          <input id="cfName" type="text" maxlength="40" autocomplete="name" placeholder="Jaise: Rahul Kumar"></label>
        <div class="cf-actions">
          <a class="btn wa" id="cfWa" target="_blank" rel="noopener" href="${waLink('Student', best, second)}">💬 WhatsApp par Connect Karein</a>
          <a class="btn ghost" href="tel:${CALL_NUMBER}">📞 Call Karein</a>
        </div>
        <button type="button" class="cf-link" id="cfAgain">↻ Quiz dobara dein</button>
        <p class="cf-note">Fees aur batch timing ki jankari centre se WhatsApp ya call par milegi.</p>
      </div>`);
    mount(w);
    requestAnimationFrame(() => requestAnimationFrame(() => w.querySelectorAll('.cf-brow em').forEach(e => { e.style.width = e.dataset.w + '%'; })));
    const nameIn = w.querySelector('#cfName'), wa = w.querySelector('#cfWa');
    const sync = () => { wa.href = waLink(nameIn.value.trim() || 'Student', best, second); };
    nameIn.addEventListener('input', sync);
    w.querySelector('#cfAgain').onclick = () => { step = -1; answers = []; render(); };
  }

  function render() {
    if (step < 0) intro();
    else if (step < QUIZ.length) question();
    else result();
    if (step >= 0) { const top = root.getBoundingClientRect().top; if (top < 70 || top > innerHeight * 0.5) root.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
  }

  render();
})();

/* =====================================================================
   DAILY CODING PRACTICE & TEST  (HTML + CSS + JavaScript, 30 min, 100 marks)
   - Roz 1 HTML + 1 CSS + 1 JS question (date ke hisab se rotate hota hai)
   - Timer: Close (pause) / Resume   - Run Code / View Code / Partial marking
   Naye questions add karne ke liye BANK.html / BANK.css / BANK.js me object add karein.
   ===================================================================== */
(function () {
  'use strict';
  var root = document.getElementById('dct');
  if (!root) return;

  /* ---------- helpers ---------- */
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var $1 = function (d, s) { return d.querySelector(s); };
  var $a = function (d, s) { return Array.prototype.slice.call(d.querySelectorAll(s)); };
  var tx = function (e) { return e ? (e.textContent || '').trim() : ''; };
  var cs = function (d, w, s) { var e = d.querySelector(s); return e ? w.getComputedStyle(e) : null; };
  var rgb = function (c) { var m = String(c).match(/[\d.]+/g); return m ? m.slice(0, 3).map(Number) : [0, 0, 0]; };
  var px = function (v) { return parseFloat(v) || 0; };

  /* ---------- QUESTION BANK ----------
     steps: [label, marks, test]
     html / css test = function(document, window) -> true/false
     js test        = string (expression evaluated inside the sandbox)          */
  var BANK = {
    html: [
      { title: 'Heading, Paragraph & Link',
        task: 'Ek page banao: <h1> me "Welcome" likho, ek <p> paragraph likho, aur ek link (<a>) banao jiska text "Google" ho aur jo https://www.google.com par jaye.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<h1> heading me "Welcome" likha ho', 9, function (d) { return /welcome/i.test(tx($1(d, 'h1'))); }],
          ['<p> paragraph me text ho', 8, function (d) { return tx($1(d, 'p')).length > 2; }],
          ['<a> ka href google.com ho', 9, function (d) { var a = $1(d, 'a'); return !!a && /google\.com/i.test(a.getAttribute('href') || ''); }],
          ['Link ka text "Google" ho', 9, function (d) { return /google/i.test(tx($1(d, 'a'))); }]],
        sol: '<!DOCTYPE html>\n<html>\n<head>\n  <title>My Page</title>\n</head>\n<body>\n  <h1>Welcome</h1>\n  <p>Ye mera pehla web page hai.</p>\n  <a href="https://www.google.com">Google</a>\n</body>\n</html>' },
      { title: 'Fruits List',
        task: 'Ek <h2> heading "Fruits" likho aur uske neeche unordered list (<ul>) banao jisme kam se kam 3 fruits (<li>) ho.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<h2> me "Fruits" likha ho', 8, function (d) { return /fruit/i.test(tx($1(d, 'h2'))); }],
          ['<ul> list banai ho', 9, function (d) { return !!$1(d, 'ul'); }],
          ['<ul> me kam se kam 3 <li> ho', 10, function (d) { return $a(d, 'ul > li').length >= 3; }],
          ['Har <li> me text likha ho', 8, function (d) { var l = $a(d, 'ul > li'); return l.length > 0 && l.every(function (x) { return tx(x).length > 0; }); }]],
        sol: '<h2>Fruits</h2>\n<ul>\n  <li>Apple</li>\n  <li>Mango</li>\n  <li>Banana</li>\n</ul>' },
      { title: 'Student Table',
        task: 'Ek table banao: pehli row me 2 headings (<th>: Name, Marks) aur uske baad kam se kam 2 data rows (<td> me data).',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<table> banaya ho', 7, function (d) { return !!$1(d, 'table'); }],
          ['Kam se kam 2 <th> heading ho', 9, function (d) { return $a(d, 'th').length >= 2; }],
          ['Kam se kam 3 <tr> rows ho (1 heading + 2 data)', 9, function (d) { return $a(d, 'tr').length >= 3; }],
          ['Kam se kam 4 <td> cells ho', 10, function (d) { return $a(d, 'td').length >= 4; }]],
        sol: '<table border="1">\n  <tr>\n    <th>Name</th>\n    <th>Marks</th>\n  </tr>\n  <tr>\n    <td>Amit</td>\n    <td>85</td>\n  </tr>\n  <tr>\n    <td>Riya</td>\n    <td>92</td>\n  </tr>\n</table>' },
      { title: 'Login Form',
        task: 'Ek login form banao jisme ek text input (username), ek password input aur ek submit button ho.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<form> tag use kiya ho', 8, function (d) { return !!$1(d, 'form'); }],
          ['Text input ho (type="text")', 9, function (d) { return !!$1(d, 'input[type=text], input:not([type])'); }],
          ['Password input ho (type="password")', 9, function (d) { return !!$1(d, 'input[type=password]'); }],
          ['Submit button ho (<button> ya type="submit")', 9, function (d) { return !!$1(d, 'button, input[type=submit]'); }]],
        sol: '<form>\n  <input type="text" placeholder="Username">\n  <input type="password" placeholder="Password">\n  <button type="submit">Login</button>\n</form>' },
      { title: 'Image with Alt',
        task: 'Ek image (<img>) lagao: src me koi bhi file naam do (jaise photo.jpg), alt text likho aur width 200 set karo.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<img> tag ho', 9, function (d) { return !!$1(d, 'img'); }],
          ['src attribute me value ho', 9, function (d) { var i = $1(d, 'img'); return !!i && (i.getAttribute('src') || '').trim().length > 0; }],
          ['alt attribute me text ho', 9, function (d) { var i = $1(d, 'img'); return !!i && (i.getAttribute('alt') || '').trim().length > 0; }],
          ['Width 200 ho (width="200" ya style)', 8, function (d) { var i = $1(d, 'img'); return !!i && (i.getAttribute('width') === '200' || /width\s*:\s*200px/i.test(i.getAttribute('style') || '')); }]],
        sol: '<img src="photo.jpg" alt="My Photo" width="200">' },
      { title: 'Ordered + Nested List',
        task: 'Ek ordered list (<ol>) banao jisme 3 items ho. Kisi ek item ke andar ek nested unordered list (<ul>) banao jisme 2 sub-items ho.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<ol> banayi ho', 9, function (d) { return !!$1(d, 'ol'); }],
          ['<ol> me kam se kam 3 <li> ho', 9, function (d) { return $a(d, 'ol > li').length >= 3; }],
          ['Kisi <li> ke andar <ul> nested ho', 9, function (d) { return !!$1(d, 'ol > li > ul'); }],
          ['Nested <ul> me kam se kam 2 <li> ho', 8, function (d) { return $a(d, 'ol > li > ul > li').length >= 2; }]],
        sol: '<ol>\n  <li>HTML</li>\n  <li>CSS\n    <ul>\n      <li>Flexbox</li>\n      <li>Grid</li>\n    </ul>\n  </li>\n  <li>JavaScript</li>\n</ol>' },
      { title: 'Semantic Page Layout',
        task: 'Semantic tags se page layout banao: <header> (andar <h1>), <main> aur <footer>.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<header> tag ho', 9, function (d) { return !!$1(d, 'header'); }],
          ['<main> tag ho', 9, function (d) { return !!$1(d, 'main'); }],
          ['<footer> tag ho', 9, function (d) { return !!$1(d, 'footer'); }],
          ['<header> ke andar <h1> ho', 8, function (d) { return !!$1(d, 'header h1'); }]],
        sol: '<header>\n  <h1>My Website</h1>\n</header>\n<main>\n  <p>Main content yahan hai.</p>\n</main>\n<footer>\n  <p>&copy; 2026 Access Computer</p>\n</footer>' },
      { title: 'Course Dropdown',
        task: 'Ek <label> aur uske saath <select> dropdown banao jisme kam se kam 3 <option> ho aur har option me value attribute ho.',
        st: '<!-- Yahan apna HTML code likho -->\n',
        steps: [
          ['<label> tag ho', 8, function (d) { return !!$1(d, 'label'); }],
          ['<select> dropdown ho', 9, function (d) { return !!$1(d, 'select'); }],
          ['<select> me kam se kam 3 <option> ho', 9, function (d) { return $a(d, 'select option').length >= 3; }],
          ['Har <option> me value attribute ho', 9, function (d) { var o = $a(d, 'select option'); return o.length > 0 && o.every(function (x) { return x.hasAttribute('value'); }); }]],
        sol: '<label for="course">Course:</label>\n<select id="course">\n  <option value="ccc">CCC</option>\n  <option value="olevel">O Level</option>\n  <option value="python">Python</option>\n</select>' }
    ],
    css: [
      { title: 'Heading & Note Style',
        task: '#title ka color red karo aur text center karo. .note ka font-size 20px karo aur font italic karo.',
        html: '<h1 id="title">Access Computer</h1>\n<p class="note">Practice daily, improve daily.</p>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['#title ka color red', 9, function (d, w) { return cs(d, w, '#title').color === 'rgb(255, 0, 0)'; }],
          ['#title text-align: center', 9, function (d, w) { return cs(d, w, '#title').textAlign === 'center'; }],
          ['.note font-size: 20px', 9, function (d, w) { return cs(d, w, '.note').fontSize === '20px'; }],
          ['.note font-style: italic', 8, function (d, w) { return cs(d, w, '.note').fontStyle === 'italic'; }]],
        sol: '#title {\n  color: red;\n  text-align: center;\n}\n.note {\n  font-size: 20px;\n  font-style: italic;\n}' },
      { title: 'Box Model',
        task: '.box ko width 200px, height 100px, yellow background aur 2px solid border do.',
        html: '<div class="box">Box</div>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['.box width: 200px', 9, function (d, w) { return cs(d, w, '.box').width === '200px'; }],
          ['.box height: 100px', 9, function (d, w) { return cs(d, w, '.box').height === '100px'; }],
          ['.box background yellow', 9, function (d, w) { return cs(d, w, '.box').backgroundColor === 'rgb(255, 255, 0)'; }],
          ['.box border: 2px solid', 8, function (d, w) { var c = cs(d, w, '.box'); return c.borderTopWidth === '2px' && c.borderTopStyle === 'solid'; }]],
        sol: '.box {\n  width: 200px;\n  height: 100px;\n  background: yellow;\n  border: 2px solid black;\n}' },
      { title: 'Flexbox Center',
        task: '.wrap ko flex container banao, items ko horizontally aur vertically center karo, aur items ke beech 10px gap rakho.',
        html: '<div class="wrap"><div class="item">1</div><div class="item">2</div><div class="item">3</div></div>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['.wrap display: flex', 10, function (d, w) { return cs(d, w, '.wrap').display === 'flex'; }],
          ['justify-content: center', 9, function (d, w) { return cs(d, w, '.wrap').justifyContent === 'center'; }],
          ['align-items: center', 8, function (d, w) { return cs(d, w, '.wrap').alignItems === 'center'; }],
          ['gap: 10px', 8, function (d, w) { return cs(d, w, '.wrap').columnGap === '10px'; }]],
        sol: '.wrap {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  gap: 10px;\n}' },
      { title: 'Rounded Button',
        task: '.btn ka background green, text color white, border-radius 8px ya zyada, aur padding 10px 20px karo.',
        html: '<button class="btn">Click Me</button>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['Background green', 9, function (d, w) { var c = rgb(cs(d, w, '.btn').backgroundColor); return c[1] > 90 && c[1] > c[0] + 40 && c[1] > c[2] + 40; }],
          ['Text color white', 9, function (d, w) { return cs(d, w, '.btn').color === 'rgb(255, 255, 255)'; }],
          ['border-radius 8px ya zyada', 9, function (d, w) { return px(cs(d, w, '.btn').borderTopLeftRadius) >= 8; }],
          ['padding: 10px 20px', 8, function (d, w) { var c = cs(d, w, '.btn'); return c.paddingTop === '10px' && c.paddingLeft === '20px'; }]],
        sol: '.btn {\n  background: green;\n  color: white;\n  border-radius: 8px;\n  padding: 10px 20px;\n}' },
      { title: 'Link Hover Effect',
        task: '.link ka color green, text-decoration none, font-weight bold karo aur .link:hover par color change karo.',
        html: '<a href="#" class="link">Visit Us</a>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['.link ka color green', 9, function (d, w) { var c = rgb(cs(d, w, '.link').color); return c[1] > 90 && c[1] > c[0] + 40 && c[1] > c[2] + 40; }],
          ['text-decoration: none', 9, function (d, w) { return cs(d, w, '.link').textDecorationLine === 'none'; }],
          ['font-weight: bold', 8, function (d, w) { return parseInt(cs(d, w, '.link').fontWeight, 10) >= 700; }],
          ['.link:hover rule me color set ho', 9, function (d) { return Array.prototype.slice.call(d.styleSheets).some(function (ss) { return Array.prototype.slice.call(ss.cssRules).some(function (r) { return /\.link\s*:hover/.test(r.selectorText || '') && !!r.style.color; }); }); }]],
        sol: '.link {\n  color: green;\n  text-decoration: none;\n  font-weight: bold;\n}\n.link:hover {\n  color: red;\n}' },
      { title: 'Card Design',
        task: '.card ko box-shadow, padding 20px, border-radius 12px (ya zyada) do, aur width 300px ke saath page me center karo (margin auto).',
        html: '<div class="card"><h3>Python</h3><p>Learn coding step by step.</p></div>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['box-shadow lagayi ho', 9, function (d, w) { return cs(d, w, '.card').boxShadow !== 'none'; }],
          ['padding: 20px', 9, function (d, w) { return cs(d, w, '.card').paddingTop === '20px'; }],
          ['border-radius 12px ya zyada', 9, function (d, w) { return px(cs(d, w, '.card').borderTopLeftRadius) >= 12; }],
          ['width 300px aur margin auto (center)', 8, function (d, w) { var c = cs(d, w, '.card'); return c.width === '300px' && c.marginLeft === c.marginRight && px(c.marginLeft) > 0; }]],
        sol: '.card {\n  width: 300px;\n  margin: 0 auto;\n  padding: 20px;\n  border-radius: 12px;\n  box-shadow: 0 4px 12px rgba(0,0,0,0.3);\n}' },
      { title: 'Grid Layout',
        task: '.grid me 3 equal columns banao (CSS Grid), 10px gap do, aur .cell ko koi background color do.',
        html: '<div class="grid"><div class="cell">1</div><div class="cell">2</div><div class="cell">3</div><div class="cell">4</div><div class="cell">5</div><div class="cell">6</div></div>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['.grid display: grid', 10, function (d, w) { return cs(d, w, '.grid').display === 'grid'; }],
          ['3 columns (grid-template-columns)', 10, function (d, w) { return cs(d, w, '.grid').gridTemplateColumns.trim().split(/\s+/).length === 3; }],
          ['gap 10px ya zyada', 7, function (d, w) { return px(cs(d, w, '.grid').rowGap) >= 10; }],
          ['.cell ka background color ho', 8, function (d, w) { return cs(d, w, '.cell').backgroundColor !== 'rgba(0, 0, 0, 0)'; }]],
        sol: '.grid {\n  display: grid;\n  grid-template-columns: repeat(3, 1fr);\n  gap: 10px;\n}\n.cell {\n  background: orange;\n  padding: 10px;\n}' },
      { title: 'Badge Positioning',
        task: '.parent ko position relative do. .child ko position absolute karke top: 10px aur right: 10px par rakho, aur usko background color do.',
        html: '<div class="parent"><div class="child">Badge</div></div>',
        st: '/* Yahan apna CSS code likho */\n',
        steps: [
          ['.parent position: relative', 9, function (d, w) { return cs(d, w, '.parent').position === 'relative'; }],
          ['.child position: absolute', 9, function (d, w) { return cs(d, w, '.child').position === 'absolute'; }],
          ['.child top: 10px aur right: 10px', 9, function (d, w) { var c = cs(d, w, '.child'); return c.top === '10px' && c.right === '10px'; }],
          ['.child ka background color ho', 8, function (d, w) { return cs(d, w, '.child').backgroundColor !== 'rgba(0, 0, 0, 0)'; }]],
        sol: '.parent {\n  position: relative;\n  height: 120px;\n  border: 1px solid gray;\n}\n.child {\n  position: absolute;\n  top: 10px;\n  right: 10px;\n  background: gold;\n  padding: 4px 8px;\n}' }
    ],
    js: [
      { title: 'Add Two Numbers',
        task: 'Ek function add(a, b) likho jo dono numbers ka sum return kare.',
        st: 'function add(a, b) {\n  // yahan code likho\n}\n',
        steps: [['add(2, 3) = 5', 10, 'add(2,3)===5'], ['add(-4, 4) = 0', 10, 'add(-4,4)===0'], ['add(0.5, 0.25) = 0.75', 10, 'add(0.5,0.25)===0.75']],
        sol: 'function add(a, b) {\n  return a + b;\n}\n\nconsole.log(add(2, 3)); // 5' },
      { title: 'Even or Odd',
        task: 'Ek function isEven(n) likho jo number even ho to true, warna false return kare.',
        st: 'function isEven(n) {\n  // yahan code likho\n}\n',
        steps: [['isEven(4) = true', 10, 'isEven(4)===true'], ['isEven(7) = false', 10, 'isEven(7)===false'], ['isEven(0) = true', 10, 'isEven(0)===true']],
        sol: 'function isEven(n) {\n  return n % 2 === 0;\n}\n\nconsole.log(isEven(4)); // true' },
      { title: 'Reverse a String',
        task: 'Ek function reverseStr(s) likho jo string ko ulta (reverse) karke return kare.',
        st: 'function reverseStr(s) {\n  // yahan code likho\n}\n',
        steps: [['reverseStr("abc") = "cba"', 10, 'reverseStr("abc")==="cba"'], ['reverseStr("Access") = "sseccA"', 10, 'reverseStr("Access")==="sseccA"'], ['reverseStr("") = ""', 10, 'reverseStr("")===""']],
        sol: 'function reverseStr(s) {\n  return s.split("").reverse().join("");\n}\n\nconsole.log(reverseStr("abc")); // cba' },
      { title: 'Largest Number',
        task: 'Ek function maxOf(arr) likho jo array ka sabse bada number return kare.',
        st: 'function maxOf(arr) {\n  // yahan code likho\n}\n',
        steps: [['maxOf([1, 5, 3]) = 5', 10, 'maxOf([1,5,3])===5'], ['maxOf([-1, -5]) = -1', 10, 'maxOf([-1,-5])===-1'], ['maxOf([7]) = 7', 10, 'maxOf([7])===7']],
        sol: 'function maxOf(arr) {\n  var max = arr[0];\n  for (var i = 1; i < arr.length; i++) {\n    if (arr[i] > max) max = arr[i];\n  }\n  return max;\n}\n\nconsole.log(maxOf([1, 5, 3])); // 5' },
      { title: 'Factorial',
        task: 'Ek function factorial(n) likho jo n ka factorial return kare (5! = 120, 0! = 1).',
        st: 'function factorial(n) {\n  // yahan code likho\n}\n',
        steps: [['factorial(5) = 120', 10, 'factorial(5)===120'], ['factorial(0) = 1', 10, 'factorial(0)===1'], ['factorial(3) = 6', 10, 'factorial(3)===6']],
        sol: 'function factorial(n) {\n  var r = 1;\n  for (var i = 2; i <= n; i++) {\n    r = r * i;\n  }\n  return r;\n}\n\nconsole.log(factorial(5)); // 120' },
      { title: 'Button Click Message',
        task: 'Button (#btn) par click karne par paragraph (#msg) me "Hello" likha aana chahiye.',
        html: '<button id="btn">Click Me</button>\n<p id="msg"></p>',
        st: '// Yahan JavaScript likho\n',
        steps: [
          ['Click par #msg me "Hello" aaye', 20, '(function(){document.getElementById("btn").click();return document.getElementById("msg").textContent.trim()==="Hello"})()'],
          ['Har click par "Hello" dikhe', 10, '(function(){document.getElementById("msg").textContent="";document.getElementById("btn").click();return document.getElementById("msg").textContent.trim()==="Hello"})()']],
        sol: 'document.getElementById("btn").addEventListener("click", function () {\n  document.getElementById("msg").textContent = "Hello";\n});' },
      { title: 'Count Vowels',
        task: 'Ek function countVowels(s) likho jo string me vowels (a, e, i, o, u) ginti return kare (capital letters bhi count hon).',
        st: 'function countVowels(s) {\n  // yahan code likho\n}\n',
        steps: [['countVowels("hello") = 2', 10, 'countVowels("hello")===2'], ['countVowels("AEIOU") = 5', 10, 'countVowels("AEIOU")===5'], ['countVowels("xyz") = 0', 10, 'countVowels("xyz")===0']],
        sol: 'function countVowels(s) {\n  var count = 0;\n  var v = "aeiouAEIOU";\n  for (var i = 0; i < s.length; i++) {\n    if (v.indexOf(s[i]) !== -1) count++;\n  }\n  return count;\n}\n\nconsole.log(countVowels("hello")); // 2' },
      { title: 'Fizz Buzz',
        task: 'Ek function fizz(n) likho: 3 se divisible ho to "Fizz", 5 se ho to "Buzz", dono se ho to "FizzBuzz", warna number khud return kare.',
        st: 'function fizz(n) {\n  // yahan code likho\n}\n',
        steps: [['fizz(3) = "Fizz"', 8, 'fizz(3)==="Fizz"'], ['fizz(5) = "Buzz"', 8, 'fizz(5)==="Buzz"'], ['fizz(15) = "FizzBuzz"', 8, 'fizz(15)==="FizzBuzz"'], ['fizz(7) = 7', 6, 'fizz(7)===7']],
        sol: 'function fizz(n) {\n  if (n % 15 === 0) return "FizzBuzz";\n  if (n % 3 === 0) return "Fizz";\n  if (n % 5 === 0) return "Buzz";\n  return n;\n}\n\nconsole.log(fizz(15)); // FizzBuzz' }
    ]
  };

  /* ---------- daily rotation (date based, har category me 8 din tak repeat nahi) ---------- */
  var TOTAL_SEC = 1800, KEY = 'dct_state_v1', HK = 'dct_hist_v1';
  var DAY_KEY = function () { var t = new Date(); return t.getFullYear() + '-' + ('0' + (t.getMonth() + 1)).slice(-2) + '-' + ('0' + t.getDate()).slice(-2); };
  var DAYNUM = function () { var t = new Date(); return Math.floor(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()) / 864e5); };
  function rng(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function pick(arr, dn, salt) {
    var n = arr.length, cyc = Math.floor(dn / n), pos = ((dn % n) + n) % n, o = arr.map(function (_, i) { return i; }), r = rng(cyc * 977 + salt);
    for (var i = n - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)), x = o[i]; o[i] = o[j]; o[j] = x; }
    return arr[o[pos]];
  }
  function decorate(k, q) {
    var steps = q.steps.map(function (s) { return { label: s[0], pts: s[1], t: s[2] }; });
    return { k: k, title: q.title, task: q.task, html: q.html || '', st: q.st, sol: q.sol, steps: steps, max: steps.reduce(function (a, s) { return a + s.pts; }, 0) };
  }
  function todays(dn) {
    return [decorate('html', pick(BANK.html, dn, 11)), decorate('css', pick(BANK.css, dn, 23)), decorate('js', pick(BANK.js, dn, 37))];
  }

  /* ---------- state (localStorage) ---------- */
  function fresh() { return { day: DAY_KEY(), dn: DAYNUM(), status: 'idle', left: TOTAL_SEC, codes: {}, best: {}, final: 0 }; }
  function load() {
    var s = null; try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) { }
    if (!s || s.day !== DAY_KEY()) s = fresh();
    if (s.status === 'running') s.status = 'paused';
    return s;
  }
  var S = load(), tmr = null, endAt = 0, saveT = null;
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { } }
  function hist() { try { return JSON.parse(localStorage.getItem(HK)) || {}; } catch (e) { return {}; } }
  function saveHist() {
    var h = hist(); h[S.day] = S.final; var o = {};
    Object.keys(h).sort().slice(-7).forEach(function (k) { o[k] = h[k]; });
    try { localStorage.setItem(HK, JSON.stringify(o)); } catch (e) { }
  }
  var fmt = function (s) { return ('0' + Math.floor(s / 60)).slice(-2) + ':' + ('0' + (s % 60)).slice(-2); };
  var totalPts = function () { return Object.keys(S.best).reduce(function (a, k) { return a + (S.best[k].pts || 0); }, 0); };

  /* ---------- evaluation ---------- */
  function mkFrame(holder, sandbox) {
    var fr = document.createElement('iframe');
    fr.className = 'dct-eval'; fr.setAttribute('sandbox', sandbox); fr.setAttribute('title', 'Output');
    holder.appendChild(fr); return fr;
  }
  function evalMarkup(q, code, holder) {
    return new Promise(function (resolve) {
      var fr = mkFrame(holder, 'allow-same-origin'), done = false;
      function fin(o) { if (!done) { done = true; o.frame = fr; resolve(o); } }
      fr.onload = function () {
        try {
          var d = fr.contentDocument, w = fr.contentWindow;
          fin({ steps: q.steps.map(function (s) { var ok = false; try { ok = !!s.t(d, w); } catch (e) { } return { label: s.label, pts: s.pts, ok: ok }; }) });
        } catch (e) { fin({ steps: q.steps.map(function (s) { return { label: s.label, pts: s.pts, ok: false }; }), err: String(e.message || e) }); }
      };
      fr.srcdoc = q.k === 'css'
        ? '<!doctype html><html><head><meta charset="utf-8"><style>' + code + '</style></head><body>' + q.html + '</body></html>'
        : code;
      setTimeout(function () { fin({ steps: q.steps.map(function (s) { return { label: s.label, pts: s.pts, ok: false }; }), err: 'Timeout' }); }, 4000);
    });
  }
  function evalJs(q, code, holder) {
    return new Promise(function (resolve) {
      var none = q.steps.map(function (s) { return { label: s.label, pts: s.pts, ok: false }; });
      if (/while\s*\(\s*(true|1)\s*\)|for\s*\(\s*;\s*;\s*\)/.test(code)) return resolve({ steps: none, logs: [], err: 'Infinite loop mila (while(true) / for(;;)). Isko hatao.' });
      var id = 'r' + Math.random().toString(36).slice(2), fr = mkFrame(holder, 'allow-scripts'), done = false;
      function fin(o) { if (done) return; done = true; window.removeEventListener('message', onMsg); o.frame = fr; resolve(o); }
      function onMsg(ev) {
        var m = ev.data;
        if (!m || m.dct !== id || ev.source !== fr.contentWindow) return;
        fin({ steps: q.steps.map(function (s, i) { return { label: s.label, pts: s.pts, ok: !!m.R[i] }; }), logs: m.L || [], err: m.E || '' });
      }
      window.addEventListener('message', onMsg);
      var head = '<script>window.__L=[];window.__E="";console.log=function(){window.__L.push([].slice.call(arguments).map(function(a){try{return typeof a==="object"?JSON.stringify(a):String(a)}catch(e){return String(a)}}).join(" "))};window.addEventListener("error",function(e){if(!window.__E)window.__E=(e.message||"Error")+(e.lineno?" (line "+e.lineno+")":"")});<\/script>';
      var tests = '<script>window.addEventListener("load",function(){var T=' + JSON.stringify(q.steps.map(function (s) { return s.t; })) + ';var R=T.map(function(t){try{return !!(0,eval)(t)}catch(e){return false}});parent.postMessage({dct:"' + id + '",R:R,L:window.__L,E:window.__E},"*")});<\/script>';
      fr.srcdoc = '<!doctype html><html><head><meta charset="utf-8"></head><body style="font-family:sans-serif">' + q.html + head + '<script>' + code.replace(/<\/script/gi, '<\\/script') + '\n<\/script>' + tests + '</body></html>';
      setTimeout(function () { fin({ steps: none, logs: [], err: 'Code ne response nahi diya (infinite loop ho sakta hai).' }); }, 4000);
    });
  }
  function evaluate(q, code, holder) { return q.k === 'js' ? evalJs(q, code, holder) : evalMarkup(q, code, holder); }
  var sum = function (steps) { return steps.reduce(function (a, s) { return a + (s.ok ? s.pts : 0); }, 0); };
  function keepBest(q, steps) {
    var p = sum(steps), b = S.best[q.k];
    if (!b || p >= b.pts) S.best[q.k] = { pts: p, ok: steps.map(function (s) { return s.ok; }) };
  }

  /* ---------- views ---------- */
  function stepsHtml(q, ok) {
    return q.steps.map(function (s, i) {
      var c = ok ? (ok[i] ? 'ok' : 'bad') : '', ic = ok ? (ok[i] ? '✓' : '✗') : '○';
      return '<li class="' + c + '"><i>' + ic + '</i><span>' + esc(s.label) + '</span><em>' + s.pts + '</em></li>';
    }).join('');
  }
  var msgFor = function (n) { return n >= 90 ? '🏆 Zabardast! Sigma level coding!' : n >= 70 ? '🔥 Bahut badhiya performance!' : n >= 40 ? '👍 Achha try — roz practice se aur improve hoga.' : n > 0 ? '💪 Shuruaat achhi hai — solution dekho aur dobara try karo.' : '😅 Koi baat nahi — View Code dekho, seekho aur kal phir try karo!'; };

  function showIntro() {
    if (S.day !== DAY_KEY() && S.status !== 'running') S = fresh();
    var Q = todays(S.dn), max = Q.reduce(function (a, q) { return a + q.max; }, 0);
    var d = new Date(), ds = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    var h = hist(), hk = Object.keys(h).sort().reverse().slice(0, 7);
    var act;
    if (S.status === 'done') act = '<div class="dct-final"><b>' + S.final + '</b><span>/ ' + max + '</span></div><p class="dct-fm">' + msgFor(S.final) + '</p><div class="dct-cta"><button class="btn" data-act="result">📊 Result & Solutions dekho</button><button class="btn ghost" data-act="restart">🔁 Dobara Test do</button></div>';
    else if (S.status === 'paused' && S.left < TOTAL_SEC) act = '<p class="dct-fm">⏸ Aapka test saved hai — <b>' + fmt(S.left) + '</b> bacha hai.</p><div class="dct-cta"><button class="btn" data-act="resume">⏯ Resume Test</button><button class="btn ghost" data-act="restart">🔁 Naya Start</button></div>';
    else act = '<div class="dct-cta"><button class="btn" data-act="start">▶ Start Test (30:00)</button></div>';
    root.innerHTML = '<div class="dct-card"><div class="dct-date">📅 ' + esc(ds) + '</div><h3 class="dct-h">Aaj ke 3 Practical Questions</h3>' +
      '<div class="dct-chips">' + Q.map(function (q) { return '<div class="dct-chip ' + q.k + '"><b>' + q.k.toUpperCase() + '</b><span>' + esc(q.title) + '</span><em>' + q.max + ' marks</em></div>'; }).join('') + '</div>' +
      '<ul class="dct-rules"><li>⏱ <b>30 minute</b> ka timer — total <b>' + max + ' marks</b></li><li>⏸ <b>Close</b> karke baad me <b>Resume</b> kar sakte ho (timer ruk jata hai)</li><li>▶ <b>Run Code</b>: galat code par error / 0 marks, sahi code par live output</li><li>🎯 <b>Step-by-step marking</b> — aadha sahi code to aadhe marks</li><li>👁 <b>View Code</b> se standard solution dekho</li><li>🔄 Har din naye questions (1 HTML + 1 CSS + 1 JavaScript)</li></ul>' + act +
      (hk.length ? '<div class="dct-hist"><b>Pichle scores:</b> ' + hk.map(function (k) { return '<span>' + k.slice(5) + ': <b>' + h[k] + '</b></span>'; }).join('') + '</div>' : '') + '</div>';
  }

  function qCard(q, i) {
    var b = S.best[q.k], code = S.codes[q.k] != null ? S.codes[q.k] : q.st;
    return '<article class="dct-q" data-k="' + q.k + '"><header class="dct-qh"><span class="dct-badge ' + q.k + '">' + q.k.toUpperCase() + '</span><h3>Q' + (i + 1) + '. ' + esc(q.title) + '</h3><span class="dct-pts">' + (b ? b.pts : 0) + ' / ' + q.max + '</span></header>' +
      '<p class="dct-task">' + esc(q.task) + '</p><ul class="dct-steps">' + stepsHtml(q, b ? b.ok : null) + '</ul>' +
      '<textarea class="dct-ed" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" rows="10" aria-label="' + q.k + ' code editor">' + esc(code) + '</textarea>' +
      '<div class="dct-btns"><button class="btn sm" data-act="run">▶ Run Code</button><button class="btn ghost sm" data-act="view">👁 View Code</button><button class="btn ghost sm" data-act="reset">↺ Reset</button></div>' +
      '<div class="dct-msg" aria-live="polite"></div><div class="dct-out" hidden><div class="dct-outh">✅ Live Output</div><div class="dct-hold"></div><pre class="dct-log"></pre></div>' +
      '<div class="dct-sol" hidden><div class="dct-solh"><b>✔ Standard Solution</b><button class="btn ghost sm" data-act="copy">📋 Copy</button></div><pre>' + esc(q.sol) + '</pre></div></article>';
  }
  function showTest() {
    var Q = todays(S.dn);
    root.innerHTML = '<div class="dct-bar"><div class="dct-clock"><span>⏱</span><b id="dctClock">' + fmt(S.left) + '</b></div><div class="dct-tot">Score: <b id="dctTot">' + totalPts() + '</b> / ' + Q.reduce(function (a, q) { return a + q.max; }, 0) + '</div><div class="dct-barbtns"><button class="btn ghost sm" data-act="close">⏸ Close</button><button class="btn sm" data-act="submit">✅ Submit</button></div></div>' + Q.map(qCard).join('');
    updClock();
  }
  function updClock() {
    var c = document.getElementById('dctClock'); if (!c) return;
    c.textContent = fmt(S.left); c.parentNode.classList.toggle('low', S.left <= 300);
  }
  function refreshScores() {
    var Q = todays(S.dn);
    Q.forEach(function (q) {
      var card = root.querySelector('[data-k="' + q.k + '"]'); if (!card) return;
      var b = S.best[q.k]; card.querySelector('.dct-pts').textContent = (b ? b.pts : 0) + ' / ' + q.max;
      card.querySelector('.dct-steps').innerHTML = stepsHtml(q, b ? b.ok : null);
    });
    var t = document.getElementById('dctTot'); if (t) t.textContent = totalPts();
  }
  function showResult(auto) {
    var Q = todays(S.dn), max = Q.reduce(function (a, q) { return a + q.max; }, 0);
    var wa = 'https://wa.me/?text=' + encodeURIComponent('Maine Access Computer Education Center ka Daily Coding Test diya aur ' + S.final + '/' + max + ' score kiya! 🎉 ' + location.origin + location.pathname + '#dailytest');
    root.innerHTML = '<div class="dct-card"><div class="dct-date">' + (auto ? '⏰ Time Up! Test auto-submit ho gaya' : '✅ Test Submit ho gaya') + '</div><div class="dct-final big"><b>' + S.final + '</b><span>/ ' + max + '</span></div><p class="dct-fm">' + msgFor(S.final) + '</p>' +
      Q.map(function (q, i) {
        var b = S.best[q.k] || { pts: 0, ok: null };
        return '<div class="dct-q" data-k="' + q.k + '"><header class="dct-qh"><span class="dct-badge ' + q.k + '">' + q.k.toUpperCase() + '</span><h3>Q' + (i + 1) + '. ' + esc(q.title) + '</h3><span class="dct-pts">' + b.pts + ' / ' + q.max + '</span></header><ul class="dct-steps">' + stepsHtml(q, b.ok || q.steps.map(function () { return false; })) + '</ul><div class="dct-btns"><button class="btn ghost sm" data-act="view">👁 View Code</button></div><div class="dct-sol" hidden><div class="dct-solh"><b>✔ Standard Solution</b><button class="btn ghost sm" data-act="copy">📋 Copy</button></div><pre>' + esc(q.sol) + '</pre></div></div>';
      }).join('') +
      '<div class="dct-cta"><a class="btn" target="_blank" rel="noopener" href="' + wa + '">📲 WhatsApp par Share</a><button class="btn ghost" data-act="restart">🔁 Dobara Test do</button><button class="btn ghost" data-act="home">🏠 Back</button></div></div>';
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- timer ---------- */
  function startTimer() {
    endAt = Date.now() + S.left * 1000; clearInterval(tmr);
    tmr = setInterval(tick, 250); tick();
  }
  function tick() {
    var l = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
    if (l !== S.left) { S.left = l; save(); updClock(); }
    if (l <= 0) { clearInterval(tmr); submit(true); }
  }
  function begin(resume) {
    S.status = 'running'; if (!resume) { S.left = TOTAL_SEC; S.codes = {}; S.best = {}; S.final = 0; }
    save(); showTest(); startTimer();
    root.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function closeTest() { clearInterval(tmr); S.status = 'paused'; save(); showIntro(); }

  function submit(auto) {
    clearInterval(tmr);
    var Q = todays(S.dn), hold = document.createElement('div');
    hold.style.cssText = 'position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden';
    document.body.appendChild(hold);
    Promise.all(Q.map(function (q) {
      var code = S.codes[q.k] != null ? S.codes[q.k] : q.st;
      return evaluate(q, code, hold).then(function (r) { keepBest(q, r.steps); });
    })).then(function () {
      hold.remove(); S.final = totalPts(); S.status = 'done'; S.left = Math.max(S.left, 0); save(); saveHist(); showResult(auto);
    });
  }

  /* ---------- Run Code ---------- */
  function run(card) {
    var Q = todays(S.dn), q = Q.filter(function (x) { return x.k === card.getAttribute('data-k'); })[0];
    var ta = card.querySelector('.dct-ed'), msg = card.querySelector('.dct-msg'), out = card.querySelector('.dct-out'), hold = card.querySelector('.dct-hold'), log = card.querySelector('.dct-log'), btn = card.querySelector('[data-act=run]');
    S.codes[q.k] = ta.value; save();
    hold.innerHTML = ''; out.hidden = true; log.textContent = ''; btn.disabled = true;
    msg.className = 'dct-msg'; msg.textContent = '⏳ Code check ho raha hai…';
    evaluate(q, ta.value, hold).then(function (r) {
      btn.disabled = false; keepBest(q, r.steps); save(); refreshScores();
      var p = sum(r.steps), all = r.steps.every(function (s) { return s.ok; }) && !r.err, fr = r.frame;
      if (all) {
        msg.className = 'dct-msg good'; msg.innerHTML = '✅ <b>Bilkul sahi!</b> Full marks: ' + p + ' / ' + q.max;
        out.hidden = false;
        if (q.k === 'js') {
          log.textContent = (r.logs.length ? r.logs.join('\n') + '\n\n' : '') + r.steps.map(function (s) { return '✓ ' + s.label; }).join('\n');
          if (q.html && fr) fr.className = 'dct-frame'; else if (fr) fr.remove();
        } else { if (fr) fr.className = 'dct-frame'; log.textContent = ''; }
      } else {
        if (fr) fr.remove();
        var why = r.err ? '❌ <b>Error:</b> ' + esc(r.err) : (p > 0 ? '⚠️ <b>Aadha adhoora code</b> — kuch steps galat hain.' : '❌ <b>Output match nahi hua</b> — abhi 0 marks.');
        msg.className = 'dct-msg bad'; msg.innerHTML = why + ' Marks mile: <b>' + p + ' / ' + q.max + '</b>. Upar ki list me ✗ wale steps theek karo.';
      }
    });
  }

  /* ---------- events ---------- */
  root.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-act]') : null; if (!b || !root.contains(b)) return;
    var act = b.getAttribute('data-act'), card = b.closest('.dct-q');
    if (act === 'start') begin(false);
    else if (act === 'resume') begin(true);
    else if (act === 'restart') { if (confirm('Naya test shuru karein? Purana score/code hat jayega.')) { clearInterval(tmr); S = fresh(); save(); begin(false); } }
    else if (act === 'close') closeTest();
    else if (act === 'submit') { if (confirm('Test submit karna hai? Submit ke baad code edit nahi hoga.')) submit(false); }
    else if (act === 'result') showResult(false);
    else if (act === 'home') showIntro();
    else if (act === 'run' && card) run(card);
    else if (act === 'view' && card) { var s = card.querySelector('.dct-sol'); s.hidden = !s.hidden; b.textContent = s.hidden ? '👁 View Code' : '🙈 Hide Code'; }
    else if (act === 'copy' && card) { var t = card.querySelector('.dct-sol pre').textContent; if (navigator.clipboard) navigator.clipboard.writeText(t).then(function () { b.textContent = '✔ Copied'; setTimeout(function () { b.textContent = '📋 Copy'; }, 1500); }); }
    else if (act === 'reset' && card) {
      var q = todays(S.dn).filter(function (x) { return x.k === card.getAttribute('data-k'); })[0];
      if (confirm('Is question ka code starter par reset karein?')) { card.querySelector('.dct-ed').value = q.st; S.codes[q.k] = q.st; save(); }
    }
  });
  root.addEventListener('input', function (e) {
    var t = e.target; if (!t.classList || !t.classList.contains('dct-ed')) return;
    S.codes[t.closest('.dct-q').getAttribute('data-k')] = t.value;
    clearTimeout(saveT); saveT = setTimeout(save, 400);
  });
  root.addEventListener('keydown', function (e) {
    var t = e.target;
    if (t.classList && t.classList.contains('dct-ed') && e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault(); var s = t.selectionStart;
      t.value = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd); t.selectionStart = t.selectionEnd = s + 2;
      t.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  window.addEventListener('beforeunload', function () { if (S.status === 'running') save(); });

  showIntro();
})();

/* =====================================================================
   Animated Login & Sign Up (Neumorphic) — #loginModal ke andar
   Tick karne ke baad yahi card khulta hai (purane naam + mobile form ki jagah).
   Login/Sign Up safal hone par site ka apna login system chalta hai:
   window.acNmFinish(user) -> user save, header button update, welcome + XP.
   NOTE: Accounts abhi browser ke localStorage me bante hain (demo level).
   Real security ke liye password check server/backend par hona chahiye.
   ===================================================================== */
(function () {
  'use strict';
  const card = document.getElementById('nmCard');
  if (!card) return;

  const $ = (s, r) => (r || card).querySelector(s);
  const $$ = (s, r) => Array.from((r || card).querySelectorAll(s));

  /* ---------- Storage ---------- */
  const K_USERS = 'acec_nm_users', K_REM = 'acec_nm_remember';
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, MOB_RE = /^[0-9]{10}$/;
  const read = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const drop = k => { try { localStorage.removeItem(k); } catch (e) {} };

  /* ---------- Password hashing (plain password kabhi save nahi hota) ---------- */
  const toHex = buf => Array.from(new Uint8Array(buf), b => ('0' + b.toString(16)).slice(-2)).join('');
  function newSalt() {
    const a = new Uint8Array(12);
    if (window.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    return toHex(a);
  }
  function hash(pw, salt) {
    const data = salt + ':' + pw;
    if (window.crypto && crypto.subtle && window.TextEncoder) {
      return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data)).then(toHex);
    }
    let h = 5381; // fallback (sirf purane browsers ke liye)
    for (let i = 0; i < data.length; i++) h = ((h << 5) + h + data.charCodeAt(i)) | 0;
    return Promise.resolve('f' + (h >>> 0).toString(16));
  }

  /* ---------- Elements ---------- */
  const modal = document.getElementById('loginModal');
  const loginPane = $('#nmLoginPane'), signupPane = $('#nmSignupPane'), overlay = $('#nmOverlay');
  const ovLogin = $('#nmOvLogin'), ovSignup = $('#nmOvSignup'), forgotSheet = $('#nmForgot');
  const loginForm = $('#nmLoginForm'), signupForm = $('#nmSignupForm'), forgotForm = $('#nmForgotForm');
  const lEmail = $('#nmLEmail'), lPass = $('#nmLPass'), lMsg = $('#nmLMsg'), remember = $('#nmRemember');
  const sName = $('#nmSName'), sEmail = $('#nmSEmail'), sMob = $('#nmSMob'), sPass = $('#nmSPass'), sMsg = $('#nmSMsg');
  const fEmail = $('#nmFEmail'), fPass = $('#nmFPass'), fMsg = $('#nmFMsg');
  const meterBar = $('#nmMeterBar'), meterTxt = $('#nmMeterTxt');

  /* ---------- Helpers ---------- */
  const delay = ms => new Promise(r => setTimeout(r, ms));

  function setInert(el, on) {
    if (on) { el.setAttribute('inert', ''); el.setAttribute('aria-hidden', 'true'); }
    else { el.removeAttribute('inert'); el.removeAttribute('aria-hidden'); }
  }
  // Jo cheez dikh nahi rahi, keyboard/screen-reader usse door rakho
  function syncInert() {
    const mode = card.getAttribute('data-mode'), fg = forgotSheet.classList.contains('open');
    setInert(loginPane, fg || mode !== 'login');
    setInert(signupPane, fg || mode !== 'signup');
    setInert(overlay, fg);
    setInert(ovLogin, mode !== 'login');
    setInert(ovSignup, mode !== 'signup');
    setInert(forgotSheet, !fg);
  }

  function note(el, text, type) { el.textContent = text || ''; el.className = 'nm-msg' + (type ? ' ' + type : ''); }
  function fail(el, text, input) {
    note(el, text, 'err');
    if (input) { input.classList.add('bad'); input.focus({ preventScroll: true }); }
    card.classList.remove('nm-shake'); void card.offsetWidth; card.classList.add('nm-shake');
  }
  function busy(form, on) { const b = $('.nm-primary', form); if (b) b.classList.toggle('is-loading', on); }
  $$('.nm-field input').forEach(i => i.addEventListener('input', () => i.classList.remove('bad')));
  sMob.addEventListener('input', () => { sMob.value = sMob.value.replace(/\D/g, '').slice(0, 10); });

  function setMode(mode, focusFirst) {
    card.setAttribute('data-mode', mode);
    $$('.nm-seg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.nmSwitch === mode)));
    [lMsg, sMsg].forEach(m => note(m, ''));
    $$('.nm-field input.bad').forEach(i => i.classList.remove('bad'));
    syncInert();
    if (focusFirst) setTimeout(() => { const i = $(mode === 'login' ? '#nmLEmail' : '#nmSName'); if (i) i.focus({ preventScroll: true }); }, 420);
  }

  // Safal login/signup: site ka apna login system (user, XP, welcome) chalao
  function finish(u) {
    const user = { name: u.name, mob: u.mob, email: u.email };
    if (typeof window.acNmFinish === 'function') window.acNmFinish(user);
  }

  /* ---------- Mode switch (overlay button + mobile segmented control) ---------- */
  card.addEventListener('click', e => {
    const sw = e.target.closest('[data-nm-switch]');
    if (sw) setMode(sw.dataset.nmSwitch, true);
  });

  /* ---------- Show / hide password ---------- */
  function eyeReset(eye) {
    const inp = eye.parentNode.querySelector('input');
    inp.type = 'password';
    eye.setAttribute('aria-pressed', 'false'); eye.setAttribute('aria-label', 'Password dikhao');
    eye.firstElementChild.className = 'fa-regular fa-eye';
  }
  card.addEventListener('click', e => {
    const eye = e.target.closest('.nm-eye'); if (!eye) return;
    const inp = eye.parentNode.querySelector('input'), show = inp.type === 'password';
    inp.type = show ? 'text' : 'password';
    eye.setAttribute('aria-pressed', String(show));
    eye.setAttribute('aria-label', show ? 'Password chhupao' : 'Password dikhao');
    eye.firstElementChild.className = show ? 'fa-regular fa-eye-slash' : 'fa-regular fa-eye';
  });

  /* ---------- Button ripple ---------- */
  card.addEventListener('pointerdown', e => {
    const b = e.target.closest('.nm-btn'); if (!b) return;
    const r = b.getBoundingClientRect(), d = Math.max(r.width, r.height);
    const s = document.createElement('span');
    s.className = 'nm-ripple';
    s.style.cssText = 'width:' + d + 'px;height:' + d + 'px;left:' + (e.clientX - r.left - d / 2) + 'px;top:' + (e.clientY - r.top - d / 2) + 'px';
    b.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });

  /* ---------- Password strength meter ---------- */
  const LEVELS = [
    ['Bahut kamzor', '#d6264f', 18], ['Kamzor', '#f97316', 38], ['Theek-thaak', '#eab308', 62],
    ['Mazboot', '#84cc16', 82], ['Bahut mazboot', '#16a34a', 100]
  ];
  function strength(p) {
    let s = 0;
    if (p.length >= 6) s++;
    if (p.length >= 10) s++;
    if (/[a-z]/.test(p) && /[A-Z]/.test(p)) s++;
    if (/\d/.test(p)) s++;
    if (/[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(s, 4);
  }
  sPass.addEventListener('input', () => {
    if (!sPass.value) { meterBar.style.width = '0'; meterTxt.textContent = ''; return; }
    const l = LEVELS[strength(sPass.value)];
    meterBar.style.width = l[2] + '%'; meterBar.style.background = l[1]; meterTxt.textContent = l[0];
  });

  /* ---------- LOGIN ---------- */
  loginForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = lEmail.value.trim().toLowerCase(), pw = lPass.value;
    if (!EMAIL_RE.test(email)) return fail(lMsg, 'Sahi email address likhein', lEmail);
    if (!pw) return fail(lMsg, 'Password likhein', lPass);
    note(lMsg, '');
    const user = read(K_USERS, []).find(x => x.email === email);
    busy(loginForm, true);
    Promise.all([user ? hash(pw, user.salt) : Promise.resolve(null), delay(450)]).then(res => {
      busy(loginForm, false);
      if (!user || res[0] !== user.hash) return fail(lMsg, 'Email ya password galat hai', lPass);
      if (remember.checked) write(K_REM, email); else drop(K_REM);
      finish(user);
    });
  });

  /* ---------- SIGN UP ---------- */
  signupForm.addEventListener('submit', e => {
    e.preventDefault();
    const name = sName.value.trim().replace(/\s+/g, ' '), email = sEmail.value.trim().toLowerCase();
    const mob = sMob.value.trim(), pw = sPass.value;
    if (name.length < 3) return fail(sMsg, 'Poora naam likhein (kam se kam 3 akshar)', sName);
    if (!EMAIL_RE.test(email)) return fail(sMsg, 'Sahi email address likhein', sEmail);
    if (!MOB_RE.test(mob)) return fail(sMsg, '10 digit ka sahi mobile number likhein', sMob);
    if (pw.length < 6) return fail(sMsg, 'Password kam se kam 6 akshar ka rakhein', sPass);
    const users = read(K_USERS, []);
    if (users.some(x => x.email === email)) return fail(sMsg, 'Is email se account pehle se hai — Login karein', sEmail);
    if (users.some(x => x.mob === mob)) return fail(sMsg, 'Is mobile number se account pehle se hai — Login karein', sMob);
    note(sMsg, '');
    busy(signupForm, true);
    const salt = newSalt();
    Promise.all([hash(pw, salt), delay(450)]).then(res => {
      busy(signupForm, false);
      const user = { name, email, mob, salt, hash: res[0], created: Date.now() };
      users.push(user);
      if (!write(K_USERS, users)) return fail(sMsg, 'Browser storage band hai, account save nahi ho paya');
      finish(user);
    });
  });

  /* ---------- FORGOT PASSWORD ---------- */
  let forgotOpener = null;
  function openForgot() {
    forgotOpener = document.activeElement;
    fEmail.value = lEmail.value; fPass.value = ''; note(fMsg, '');
    forgotSheet.classList.add('open'); syncInert();
    setTimeout(() => (fEmail.value ? fPass : fEmail).focus({ preventScroll: true }), 450);
  }
  function closeForgot() {
    forgotSheet.classList.remove('open'); syncInert();
    if (forgotOpener && forgotOpener.focus) forgotOpener.focus({ preventScroll: true });
  }
  $('#nmForgotBtn').addEventListener('click', openForgot);
  $('#nmForgotBack').addEventListener('click', closeForgot);
  // Esc dabane par pehle sirf Forgot sheet band ho, poora login popup nahi
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && forgotSheet.classList.contains('open')) { e.stopPropagation(); closeForgot(); }
  }, true);

  forgotForm.addEventListener('submit', e => {
    e.preventDefault();
    const email = fEmail.value.trim().toLowerCase(), pw = fPass.value;
    if (!EMAIL_RE.test(email)) return fail(fMsg, 'Sahi email address likhein', fEmail);
    if (pw.length < 6) return fail(fMsg, 'Naya password kam se kam 6 akshar ka rakhein', fPass);
    const users = read(K_USERS, []), user = users.find(x => x.email === email);
    if (!user) return fail(fMsg, 'Is email se koi account nahi mila', fEmail);
    note(fMsg, '');
    busy(forgotForm, true);
    const salt = newSalt();
    Promise.all([hash(pw, salt), delay(450)]).then(res => {
      busy(forgotForm, false);
      user.salt = salt; user.hash = res[0];
      if (!write(K_USERS, users)) return fail(fMsg, 'Browser storage band hai, password save nahi ho paya');
      note(fMsg, 'Password badal gaya ✔', 'ok');
      setTimeout(() => {
        closeForgot();
        lEmail.value = email; lPass.value = '';
        note(lMsg, 'Ab naye password se login karein', 'ok');
        lPass.focus({ preventScroll: true });
      }, 1000);
    });
  });

  /* ---------- Popup har baar khulne par card ko fresh (Login mode) karo ---------- */
  function resetCard() {
    forgotSheet.classList.remove('open');
    loginForm.reset(); signupForm.reset(); forgotForm.reset();
    $$('.nm-eye').forEach(eyeReset);
    meterBar.style.width = '0'; meterTxt.textContent = '';
    [lMsg, sMsg, fMsg].forEach(m => note(m, ''));
    const rem = read(K_REM, '');
    if (rem) { lEmail.value = rem; remember.checked = true; }
    setMode('login', false);
  }
  if (modal) new MutationObserver(() => { if (modal.classList.contains('open')) resetCard(); })
    .observe(modal, { attributes: true, attributeFilter: ['class'] });
  resetCard();
})();


/* =====================================================================
   PRO TOOLS (25 features) + 3D ANIMATED BACKGROUND  -- appended code
   Sab kuch ek alag IIFE me hai, isliye purane code se koi takrav nahi.
   ===================================================================== */
(function () {
  'use strict';
  const D = document, root = D.documentElement;
  const P = id => D.getElementById('pt' + id);
  const LS = {
    g(k, d) { try { const v = localStorage.getItem('pt_' + k); return v === null ? d : v; } catch (e) { return d; } },
    s(k, v) { try { localStorage.setItem('pt_' + k, v); } catch (e) {} }
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const init = (n, f) => { try { f(); } catch (e) { console.error('[ProTools] ' + n, e); } };
  const on = (el, ev, fn, o) => el && el.addEventListener(ev, fn, o);

  let tt;
  function toast(m) { const t = P('Toast'); if (!t) return; t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 1700); }
  async function copy(txt, msg) {
    try { await navigator.clipboard.writeText(txt); }
    catch (e) { const a = D.createElement('textarea'); a.value = txt; a.style.cssText = 'position:fixed;opacity:0'; D.body.appendChild(a); a.select(); try { D.execCommand('copy'); } catch (_) {} a.remove(); }
    toast(msg || 'Copied');
  }
  const setSw = (b, state, onTxt, offTxt) => { b.setAttribute('aria-checked', state ? 'true' : 'false'); b.textContent = state ? onTxt : offTxt; b.classList.toggle('on', !!state); };

  /* ---- shared audio context (sound effects + ambient) ---- */
  let AC = null;
  const actx = () => { if (!AC) { const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === 'suspended') AC.resume(); return AC; };
  let sfxOn = LS.g('sfx', '0') === '1';
  function beep(f, d, type, v) {
    if (!sfxOn) return; const c = actx(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
    o.type = type || 'triangle'; o.frequency.value = f || 560;
    g.gain.setValueAtTime(v || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + (d || .07));
    o.connect(g); g.connect(c.destination); o.start(t); o.stop(t + (d || .07) + .02);
  }

  /* shared state for background controls */
  const BG = { speed: Math.max(0, Math.min(3, parseFloat(LS.g('speed', '1')) || 0)) };
  if (LS.g('speed', '1') === '0') BG.speed = 0;

  /* ===================== 3D ANIMATED BACKGROUND ===================== */
  init('bg', () => {
    const cv = P('Bg'); if (!cv) return; const c = cv.getContext('2d');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let W, H, dpr, col = { a: '#00f0ff', b: '#7c3aed' }, pts = [], cubes = [], yaw = 0, pitch = 0, tx = 0, ty = 0, off = 0, rot = 0, raf = 0, last = 0;
    const rnd = (a, b) => a + Math.random() * (b - a);
    function colors() { const s = getComputedStyle(root); col.a = s.getPropertyValue('--pt-a').trim() || '#00f0ff'; col.b = s.getPropertyValue('--pt-b').trim() || '#7c3aed'; }
    function spawn(p, far) { p.x = rnd(-.7, .7) * W; p.y = rnd(-.6, .5) * H; p.z = far ? 1 : rnd(.15, 1); p.c = Math.random() < .7 ? 0 : 1; return p; }
    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.5); W = innerWidth; H = innerHeight;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.max(24, Math.min(70, Math.round(W * H / 20000)));
      pts = Array.from({ length: n }, () => spawn({}, false));
      cubes = [0, 1, 2].map(i => ({ x: (i - 1) * W * .3, y: -H * (.12 + i * .05), z: .55 + i * .12, s: 38 + i * 12, rx: rnd(0, 6), ry: rnd(0, 6), vx: rnd(.004, .009), vy: rnd(.006, .012) }));
      colors(); draw(0);
    }
    const V = [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1], [-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]];
    const E = [[0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7]];
    function draw(dt) {
      const sp = BG.speed * (reduce ? .2 : 1);
      yaw += (tx - yaw) * .05; pitch += (ty - pitch) * .05;
      off = (off + .006 * sp * dt) % 1; rot += dt;
      c.clearRect(0, 0, W, H);
      const hy = H * .58 + pitch * 14, vx = W / 2 + yaw * 50;
      /* floor grid (perspective) */
      c.lineWidth = 1; c.strokeStyle = col.a;
      for (let i = -12; i <= 12; i++) { c.globalAlpha = .16 - Math.abs(i) * .008; c.beginPath(); c.moveTo(vx, hy); c.lineTo(vx + i * W * .2 - yaw * 30, H); c.stroke(); }
      c.strokeStyle = col.b;
      for (let k = 0; k < 14; k++) { const d = ((k + off) / 14), y = hy + (H - hy) * Math.pow(d, 2.3); c.globalAlpha = .06 + d * .22; c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      c.globalAlpha = .18; c.fillStyle = col.a; c.fillRect(0, hy - 1, W, 2);
      /* particles (3D projected, mouse parallax) */
      const sx = [], sy = [], sa = [];
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]; p.z -= .0007 * sp * dt;
        let k = 1 / (p.z * 1.7), x = W / 2 + (p.x + yaw * 90 * (1 - p.z)) * k, y = hy * .75 + (p.y + pitch * 60 * (1 - p.z)) * k;
        if (p.z < .13 || x < -30 || x > W + 30 || y < -30 || y > H + 30) { spawn(p, true); k = 1 / (p.z * 1.7); x = W / 2 + p.x * k; y = hy * .75 + p.y * k; }
        const a = Math.min(1, (1 - p.z) * 1.5 + .12), r = Math.min(3.2, .7 + k * .7);
        sx[i] = x; sy[i] = y; sa[i] = a;
        c.globalAlpha = a * .85; c.fillStyle = p.c ? col.b : col.a; c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
      }
      if (W > 700) {
        c.strokeStyle = col.a; c.lineWidth = .7;
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const dx = sx[i] - sx[j], dy = sy[i] - sy[j], d2 = dx * dx + dy * dy;
          if (d2 < 9000) { c.globalAlpha = (1 - d2 / 9000) * .22 * Math.min(sa[i], sa[j]); c.beginPath(); c.moveTo(sx[i], sy[i]); c.lineTo(sx[j], sy[j]); c.stroke(); }
        }
      }
      /* floating wireframe cubes */
      c.lineWidth = 1.2;
      cubes.forEach((q, qi) => {
        q.rx += q.vx * sp * dt; q.ry += q.vy * sp * dt;
        const cx = Math.cos(q.rx), sxr = Math.sin(q.rx), cy = Math.cos(q.ry), sy2 = Math.sin(q.ry);
        const bob = Math.sin((rot * .02 * Math.max(sp, .1)) + qi * 2) * 14;
        const pr = V.map(v => {
          let x = v[0], y = v[1], z = v[2], t;
          t = y * cx - z * sxr; z = y * sxr + z * cx; y = t;
          t = x * cy + z * sy2; z = -x * sy2 + z * cy; x = t;
          const f = 1 / (3.2 - z * .5);
          return [W / 2 + q.x + yaw * 40 * q.z + x * q.s * f * 2.2, H * .42 + q.y + pitch * 24 * q.z + bob + y * q.s * f * 2.2];
        });
        c.strokeStyle = qi % 2 ? col.b : col.a; c.globalAlpha = .38;
        c.beginPath(); E.forEach(e => { c.moveTo(pr[e[0]][0], pr[e[0]][1]); c.lineTo(pr[e[1]][0], pr[e[1]][1]); }); c.stroke();
      });
      c.globalAlpha = 1;
    }
    function frame(now) {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(3, (now - last) / 16.67) || 1; last = now; draw(dt);
    }
    function start() { if (!raf && !D.hidden) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }
    on(window, 'pointermove', e => { tx = (e.clientX / W - .5) * 2; ty = (e.clientY / H - .5) * 2; }, { passive: true });
    let rt; on(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); });
    on(D, 'visibilitychange', () => D.hidden ? stop() : start());
    new MutationObserver(colors).observe(root, { attributes: true, attributeFilter: ['data-accent', 'data-theme'] });
    resize(); start();
  });

  /* ===================== MATRIX RAIN (feature 23) ===================== */
  let matrixToggle = () => {};
  init('matrix', () => {
    const cv = P('Matrix'), btn = P('MxBtn'); if (!cv || !btn) return;
    const c = cv.getContext('2d'), fs = 16, chars = 'ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂ0123456789<>/{}=+';
    let isOn = LS.g('matrix', '0') === '1', drops = [], raf = 0, last = 0;
    function size() { cv.width = innerWidth; cv.height = innerHeight; drops = Array.from({ length: Math.ceil(cv.width / fs) }, () => Math.random() * -40); }
    function draw(t) {
      if (!isOn) return; raf = requestAnimationFrame(draw); if (t - last < 50) return; last = t;
      c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,.14)'; c.fillRect(0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#39ff88'; c.font = fs + 'px monospace';
      for (let i = 0; i < drops.length; i++) {
        c.fillText(chars[(Math.random() * chars.length) | 0], i * fs, drops[i] * fs);
        if (drops[i] * fs > cv.height && Math.random() > .975) drops[i] = 0; else drops[i]++;
      }
    }
    function set(v) {
      isOn = v; LS.s('matrix', v ? '1' : '0'); setSw(btn, v, 'On', 'Off'); cv.classList.toggle('on', v);
      cancelAnimationFrame(raf); raf = 0;
      if (v) { size(); raf = requestAnimationFrame(draw); } else c.clearRect(0, 0, cv.width, cv.height);
    }
    matrixToggle = () => set(!isOn);
    on(btn, 'click', () => set(!isOn));
    let rt; on(window, 'resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (isOn) size(); }, 200); });
    on(D, 'visibilitychange', () => { if (!isOn) return; if (D.hidden) { cancelAnimationFrame(raf); raf = 0; } else if (!raf) raf = requestAnimationFrame(draw); });
    set(isOn);
  });

  /* ===================== 24. PARTICLE SPEED ===================== */
  init('speed', () => {
    const r = P('Sp'), v = P('SpV'); if (!r) return;
    const show = () => { v.textContent = BG.speed.toFixed(1) + 'x'; };
    r.value = Math.round(BG.speed * 10); show();
    on(r, 'input', () => { BG.speed = r.value / 10; LS.s('speed', String(BG.speed)); show(); });
    on(P('SpRst'), 'click', () => { r.value = 10; BG.speed = 1; LS.s('speed', '1'); show(); });
  });

  /* ===================== 1. PASSWORD GENERATOR ===================== */
  init('pw', () => {
    const sets = { U: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', L: 'abcdefghijklmnopqrstuvwxyz', N: '0123456789', S: '!@#$%^&*()-_=+[]{};:,.?' };
    const len = P('PwLen'), out = P('PwOut');
    const rnd = n => { const a = new Uint32Array(1), lim = Math.floor(4294967296 / n) * n; let x; do { crypto.getRandomValues(a); x = a[0]; } while (x >= lim); return x % n; };
    function gen() {
      let keys = Object.keys(sets).filter(k => P('Pw' + k).checked);
      if (!keys.length) { P('PwL').checked = true; keys = ['L']; }
      const L = +len.value, pool = keys.map(k => sets[k]).join('');
      const p = keys.map(k => sets[k][rnd(sets[k].length)]);
      while (p.length < L) p.push(pool[rnd(pool.length)]);
      for (let i = p.length - 1; i > 0; i--) { const j = rnd(i + 1); [p[i], p[j]] = [p[j], p[i]]; }
      out.textContent = p.join('');
      const bits = Math.round(L * Math.log2(pool.length));
      P('PwStr').textContent = 'Strength: ' + (bits < 45 ? 'Weak' : bits < 65 ? 'Fair' : bits < 90 ? 'Strong' : 'Very strong') + ' (~' + bits + ' bits)';
    }
    on(len, 'input', () => { P('PwLenV').textContent = len.value; gen(); });
    ['U', 'L', 'N', 'S'].forEach(k => on(P('Pw' + k), 'change', gen));
    on(P('PwGen'), 'click', gen);
    on(P('PwCopy'), 'click', () => copy(out.textContent, 'Password copied'));
    gen();
  });

  /* ===================== 2. GRADIENT PICKER ===================== */
  init('gr', () => {
    const a = P('Gr1'), b = P('Gr2'), g = P('GrAng'), pv = P('GrPrev'), code = P('GrCss');
    const up = () => { const css = 'background: linear-gradient(' + g.value + 'deg, ' + a.value + ', ' + b.value + ');'; pv.style.cssText = css; code.textContent = css; };
    [a, b, g].forEach(el => on(el, 'input', up));
    const hex = () => '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    on(P('GrRnd'), 'click', () => { a.value = hex(); b.value = hex(); g.value = Math.floor(Math.random() * 361); up(); });
    on(P('GrCopy'), 'click', () => copy(code.textContent, 'CSS copied'));
    up();
  });

  /* ===================== 3. WORD / CHAR COUNTER ===================== */
  init('cn', () => {
    const t = P('CnIn');
    const up = () => {
      const v = t.value, w = v.trim() ? v.trim().split(/\s+/).length : 0;
      P('CnW').textContent = w; P('CnC').textContent = v.length; P('CnS').textContent = v.replace(/\s/g, '').length;
      P('CnL').textContent = v ? v.split('\n').length : 0; P('CnT').textContent = (v.match(/[^.!?।]+[.!?।]+/g) || []).length;
      P('CnR').textContent = w ? Math.max(1, Math.ceil(w / 200)) : 0;
    };
    on(t, 'input', up); up();
  });

  /* ===================== 4. BINARY CONVERTER ===================== */
  init('bn', () => {
    const i = P('BnIn'), o = P('BnOut'), say = (m, bad) => { o.textContent = m; o.classList.toggle('bad', !!bad); };
    const acts = {
      t2b() { const v = i.value; if (!v) return say('Type some text first.', 1); say([...new TextEncoder().encode(v)].map(x => x.toString(2).padStart(8, '0')).join(' ')); },
      b2t() { const b = i.value.replace(/[^01]/g, ''); if (!b || b.length % 8) return say('Binary needs groups of 8 bits (0 and 1 only).', 1);
        try { say(new TextDecoder('utf-8', { fatal: true }).decode(new Uint8Array(b.match(/.{8}/g).map(x => parseInt(x, 2))))); } catch (e) { say('Those bits are not valid text.', 1); } },
      n2b() { const v = i.value.trim(); if (!/^\d+$/.test(v)) return say('Enter a whole number (0 or more).', 1); const n = BigInt(v); say('Bin: ' + n.toString(2) + '\nHex: ' + n.toString(16).toUpperCase() + '\nOct: ' + n.toString(8)); },
      b2n() { const b = i.value.replace(/\s/g, ''); if (!/^[01]+$/.test(b)) return say('Enter only 0 and 1.', 1); const n = BigInt('0b' + b); say('Dec: ' + n.toString(10) + '\nHex: ' + n.toString(16).toUpperCase()); }
    };
    D.querySelectorAll('[data-bn]').forEach(b => on(b, 'click', () => acts[b.dataset.bn]()));
  });

  /* ===================== 5. NOTES ===================== */
  init('notes', () => {
    const t = P('Notes'), st = P('NotesSt'); let h;
    t.value = LS.g('notes', '');
    on(t, 'input', () => { clearTimeout(h); st.textContent = 'Saving…'; h = setTimeout(() => { LS.s('notes', t.value); st.textContent = 'Saved ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }, 350); });
    on(P('NotesClr'), 'click', () => { t.value = ''; LS.s('notes', ''); st.textContent = 'Cleared'; });
  });

  /* ===================== 6. SOUND EFFECTS ===================== */
  function sfxSet(v) { sfxOn = v; LS.s('sfx', v ? '1' : '0'); const b = P('Sfx'); if (b) setSw(b, v, 'On', 'Off'); if (v) beep(660, .09, 'sine', .06); }
  init('sfx', () => {
    const b = P('Sfx'); setSw(b, sfxOn, 'On', 'Off');
    on(b, 'click', () => sfxSet(!sfxOn));
    on(P('SfxTest'), 'click', () => { const was = sfxOn; sfxOn = true; beep(523, .12, 'sine', .07); setTimeout(() => beep(659, .12, 'sine', .07), 110); setTimeout(() => beep(784, .18, 'sine', .07), 220); setTimeout(() => { sfxOn = was; }, 450); });
    on(P('Grid'), 'click', e => { if (e.target.closest('button') && e.target.id !== 'ptSfxTest') beep(520, .05, 'triangle', .04); });
  });

  /* ===================== 7. NEON TEXT ===================== */
  init('neon', () => {
    const t = P('NeonT'), c = P('NeonC'), p = P('NeonP');
    const css = () => 'color:#fff;text-shadow:0 0 4px #fff,0 0 12px ' + c.value + ',0 0 26px ' + c.value + ',0 0 48px ' + c.value + ';';
    const up = () => { p.textContent = t.value || ' '; p.style.cssText = css(); };
    on(t, 'input', up); on(c, 'input', up); on(P('NeonCopy'), 'click', () => copy(css(), 'CSS copied')); up();
  });

  /* ===================== 8. SCREEN RULER ===================== */
  init('ruler', () => {
    const wrap = P('Ruler'), cv = P('RulC'), btn = P('RulBtn'), rx = P('RX'), ry = P('RY'), tip = P('RT'), size = P('RulSize'); let isOn = false;
    const info = () => { size.textContent = innerWidth + ' × ' + innerHeight + ' px (DPR ' + (window.devicePixelRatio || 1).toFixed(1) + ')'; };
    function paint() {
      const dpr = window.devicePixelRatio || 1, w = innerWidth, h = innerHeight, c = cv.getContext('2d');
      cv.width = w * dpr; cv.height = h * dpr; cv.style.width = w + 'px'; cv.style.height = h + 'px'; c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = 'rgba(4,5,13,.82)'; c.fillRect(0, 0, w, 22); c.fillRect(0, 0, 22, h);
      c.strokeStyle = '#00f0ff'; c.fillStyle = '#9fefff'; c.font = '9px monospace'; c.lineWidth = 1; c.beginPath();
      for (let x = 0; x <= w; x += 10) { const L = x % 100 === 0 ? 14 : x % 50 === 0 ? 9 : 5; c.moveTo(x + .5, 22); c.lineTo(x + .5, 22 - L); }
      for (let y = 0; y <= h; y += 10) { const L = y % 100 === 0 ? 14 : y % 50 === 0 ? 9 : 5; c.moveTo(22, y + .5); c.lineTo(22 - L, y + .5); }
      c.stroke();
      for (let x = 100; x <= w; x += 100) c.fillText(x, x + 3, 9);
      for (let y = 100; y <= h; y += 100) { c.save(); c.translate(9, y - 3); c.rotate(-Math.PI / 2); c.fillText(y, 0, 0); c.restore(); }
    }
    function move(e) { rx.style.transform = 'translateX(' + e.clientX + 'px)'; ry.style.transform = 'translateY(' + e.clientY + 'px)'; tip.textContent = e.clientX + ', ' + e.clientY; tip.style.transform = 'translate(' + Math.min(e.clientX + 14, innerWidth - 90) + 'px,' + Math.min(e.clientY + 14, innerHeight - 30) + 'px)'; }
    function set(v) { isOn = v; wrap.hidden = !v; setSw(btn, v, 'Ruler on', 'Ruler off'); if (v) { paint(); } }
    on(btn, 'click', () => set(!isOn));
    on(window, 'pointermove', e => { if (isOn) move(e); }, { passive: true });
    on(window, 'resize', () => { info(); if (isOn) paint(); });
    on(D, 'keydown', e => { if (e.key === 'Escape' && isOn) set(false); });
    info();
  });

  /* ===================== 9. CALCULATOR ===================== */
  init('calc', () => {
    const inp = P('CalcIn'), keys = P('CalcKeys');
    function evaluate(src) {
      const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, ''); let i = 0;
      const fail = m => { throw new Error(m); };
      function expr() { let v = term(); while (s[i] === '+' || s[i] === '-') { const o = s[i++], r = term(); v = o === '+' ? v + r : v - r; } return v; }
      function term() { let v = unary(); while (s[i] === '*' || s[i] === '/') { const o = s[i++], r = unary(); if (o === '/' && r === 0) fail('÷0'); v = o === '*' ? v * r : v / r; } return v; }
      function unary() { if (s[i] === '-') { i++; return -unary(); } if (s[i] === '+') { i++; return unary(); } return prim(); }
      function prim() {
        let v;
        if (s[i] === '(') { i++; v = expr(); if (s[i] !== ')') fail('( )'); i++; }
        else { const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!m) fail('Error'); v = parseFloat(m[0]); i += m[0].length; }
        while (s[i] === '%') { v /= 100; i++; }
        return v;
      }
      if (!s) return '';
      const r = expr(); if (i < s.length) fail('Error'); if (!isFinite(r)) fail('Error');
      return String(parseFloat(r.toPrecision(12)));
    }
    ['C', '⌫', '(', ')', '7', '8', '9', '÷', '4', '5', '6', '×', '1', '2', '3', '−', '0', '.', '%', '+', '='].forEach(k => {
      const b = D.createElement('button'); b.type = 'button'; b.textContent = k; b.dataset.k = k;
      if (k === '=') b.className = 'eq'; else if ('÷×−+'.includes(k)) b.className = 'op'; else if (k === 'C' || k === '⌫') b.className = 'g';
      keys.appendChild(b);
    });
    function run() { try { const r = evaluate(inp.value); inp.value = r; inp.classList.remove('bad'); } catch (e) { inp.classList.add('bad'); inp.value = e.message === '÷0' ? 'Cannot divide by 0' : 'Error'; setTimeout(() => { if (inp.classList.contains('bad')) { inp.value = ''; inp.classList.remove('bad'); } }, 1100); } }
    on(keys, 'click', e => {
      const b = e.target.closest('button'); if (!b) return; const k = b.dataset.k;
      if (inp.classList.contains('bad')) { inp.value = ''; inp.classList.remove('bad'); }
      if (k === 'C') inp.value = ''; else if (k === '⌫') inp.value = inp.value.slice(0, -1); else if (k === '=') run(); else inp.value += k;
    });
    on(inp, 'keydown', e => { if (e.key === 'Enter') { e.preventDefault(); run(); } });
    on(inp, 'input', () => { inp.value = inp.value.replace(/\*/g, '×').replace(/\//g, '÷').replace(/[^0-9+\-−×÷().%\s]/g, ''); });
  });

  /* ===================== 10. RANDOM QUOTE ===================== */
  init('quote', () => {
    const Q = ['Small commits beat big plans.', 'Bug ka matlab hai ki code chal raha hai, bas aapki soch se alag.', 'Type slowly at first; speed is a side effect of accuracy.', 'Read the error message. It is usually telling the truth.', 'Ek din me ek concept, ek mahine me ek skill.', 'Make it work, make it clear, then make it fast.', 'Practice is the shortcut that has no shortcut.', 'Jo roz 30 minute code karta hai, wo kal se aage hai.', 'A clean desktop is a clear head.', 'Ask the question you are afraid is too basic. Someone else is waiting for it.', 'Backup today. Thank yourself tomorrow.', 'Computer sikhna ek bar ka kaam nahi, roz ki aadat hai.', 'Good typing is invisible, bad typing is all you notice.', 'Every expert once saved a file in the wrong folder.'];
    const el = P('Q'); let last = -1;
    const nx = () => { let i; do { i = Math.floor(Math.random() * Q.length); } while (i === last && Q.length > 1); last = i; el.textContent = Q[i]; };
    on(P('QNew'), 'click', nx); on(P('QCopy'), 'click', () => copy(el.textContent, 'Quote copied')); nx();
  });

  /* ===================== 11. THEME SWITCHER ===================== */
  init('theme', () => {
    const box = P('Acc'), mark = a => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.acc === a));
    const set = a => { if (a === 'cyan') root.removeAttribute('data-accent'); else root.setAttribute('data-accent', a); LS.s('accent', a); mark(a); };
    on(box, 'click', e => { const b = e.target.closest('button'); if (b) set(b.dataset.acc); });
    on(P('Dark'), 'click', () => { const t = D.getElementById('themeBtn'); if (t) t.click(); else toast('Theme button not found'); });
    set(LS.g('accent', 'cyan'));
  });

  /* ===================== 12. STOPWATCH ===================== */
  init('sw', () => {
    const out = P('SwT'), go = P('SwGo'), laps = P('SwL'); let run = false, t0 = 0, acc = 0, raf = 0, n = 0;
    const el = () => acc + (run ? performance.now() - t0 : 0);
    const fmt = ms => { const c = Math.floor(ms / 10) % 100, s = Math.floor(ms / 1000) % 60, m = Math.floor(ms / 60000); return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0'); };
    const tick = () => { out.textContent = fmt(el()); if (run) raf = requestAnimationFrame(tick); };
    on(go, 'click', () => { if (run) { acc = el(); run = false; go.textContent = 'Resume'; cancelAnimationFrame(raf); tick(); } else { t0 = performance.now(); run = true; go.textContent = 'Pause'; tick(); } });
    on(P('SwLap'), 'click', () => { if (!run && !acc) return; const li = D.createElement('li'); li.textContent = 'Lap ' + (++n) + '  ' + fmt(el()); laps.prepend(li); while (laps.children.length > 5) laps.lastChild.remove(); });
    on(P('SwRst'), 'click', () => { run = false; acc = 0; n = 0; cancelAnimationFrame(raf); out.textContent = '00:00.00'; go.textContent = 'Start'; laps.innerHTML = ''; });
  });

  /* ===================== 13. LOCAL STORAGE STATUS ===================== */
  init('ls', () => {
    function refresh() {
      let ok = true, bytes = 0, keys = 0;
      try { const k = '__pt_t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); for (let i = 0; i < localStorage.length; i++) { const k2 = localStorage.key(i); bytes += (k2.length + (localStorage.getItem(k2) || '').length) * 2; keys++; } } catch (e) { ok = false; }
      const kb = bytes / 1024, pc = Math.min(100, kb / 5120 * 100);
      P('LsBar').style.width = pc.toFixed(1) + '%';
      P('LsTxt').textContent = ok ? keys + ' keys, about ' + (kb < 1024 ? kb.toFixed(1) + ' KB' : (kb / 1024).toFixed(2) + ' MB') + ' of roughly 5 MB used.' : 'Local storage is blocked in this browser (private mode or settings).';
    }
    on(P('LsRef'), 'click', () => { refresh(); toast('Refreshed'); });
    on(P('LsClr'), 'click', () => {
      if (!confirm('Clear only Pro Tools data (notes, settings, feedback)? Your other site data stays.')) return;
      try { Object.keys(localStorage).filter(k => k.indexOf('pt_') === 0).forEach(k => localStorage.removeItem(k)); } catch (e) {}
      const nt = P('Notes'); if (nt) nt.value = ''; refresh(); toast('Pro Tools data cleared');
    });
    refresh();
  });

  /* ===================== 14. REGEX TESTER ===================== */
  init('rx', () => {
    const p = P('RxP'), f = P('RxF'), t = P('RxT'), o = P('RxO'), m = P('RxM');
    function run() {
      const pat = p.value; o.classList.remove('bad'); m.textContent = '';
      if (!pat) { o.textContent = t.value || '-'; return; }
      try {
        const flags = f.value.indexOf('g') < 0 ? f.value + 'g' : f.value, re = new RegExp(pat, flags), s = t.value;
        let html = '', last = 0, n = 0;
        for (const x of s.matchAll(re)) { if (n++ >= 500) break; html += esc(s.slice(last, x.index)) + '<mark>' + esc(x[0]) + '</mark>'; last = x.index + x[0].length; }
        html += esc(s.slice(last)); o.innerHTML = html || '-';
        m.textContent = n >= 500 ? '500+ matches (showing first 500)' : n + (n === 1 ? ' match' : ' matches');
      } catch (e) { o.classList.add('bad'); o.textContent = e.message; }
    }
    [p, f, t].forEach(el => on(el, 'input', run)); run();
  });

  /* ===================== 15. JSON FORMATTER ===================== */
  init('js', () => {
    const t = P('Js'), m = P('JsM'); const say = (s, bad) => { m.textContent = s; m.classList.toggle('badtxt', !!bad); };
    const go = ind => { if (!t.value.trim()) return say('Paste some JSON first.', 1); try { t.value = JSON.stringify(JSON.parse(t.value), null, ind); say('Valid JSON'); } catch (e) { say(e.message, 1); } };
    on(P('JsFmt'), 'click', () => go(2)); on(P('JsMin'), 'click', () => go(0));
    on(P('JsCopy'), 'click', () => t.value ? copy(t.value, 'JSON copied') : say('Nothing to copy.', 1));
  });

  /* ===================== 16. BASE64 ===================== */
  init('b64', () => {
    const t = P('B64'), m = P('B64M'), say = (s, bad) => { m.textContent = s; m.classList.toggle('badtxt', !!bad); };
    on(P('B64E'), 'click', () => { try { const b = new TextEncoder().encode(t.value); let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); t.value = btoa(s); say('Encoded'); } catch (e) { say('Could not encode this text.', 1); } });
    on(P('B64D'), 'click', () => { try { const bin = atob(t.value.trim().replace(/-/g, '+').replace(/_/g, '/')); t.value = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(bin, c => c.charCodeAt(0))); say('Decoded'); } catch (e) { say('That is not valid Base64 text.', 1); } });
    on(P('B64C'), 'click', () => t.value ? copy(t.value, 'Copied') : say('Nothing to copy.', 1));
  });

  /* ===================== 17. SNIPPET COPIER ===================== */
  init('sn', () => {
    const S = {
      'HTML5 starter': '<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>My Page</title>\n</head>\n<body>\n  \n</body>\n</html>',
      'Center with flexbox': '.center {\n  display: flex;\n  justify-content: center;\n  align-items: center;\n  min-height: 100vh;\n}',
      'Fetch JSON': "fetch('https://api.example.com/data')\n  .then(r => r.json())\n  .then(data => console.log(data))\n  .catch(err => console.error(err));",
      'Debounce (JS)': 'function debounce(fn, ms = 300) {\n  let t;\n  return (...a) => {\n    clearTimeout(t);\n    t = setTimeout(() => fn(...a), ms);\n  };\n}',
      'Python input loop': 'while True:\n    n = input("Enter a number (q to quit): ")\n    if n == "q":\n        break\n    print("Square:", int(n) ** 2)'
    };
    const sel = P('SnS'), pre = P('SnP');
    Object.keys(S).forEach(k => { const o = D.createElement('option'); o.textContent = k; sel.appendChild(o); });
    const up = () => { pre.textContent = S[sel.value]; };
    on(sel, 'change', up); on(P('SnC'), 'click', () => copy(S[sel.value], 'Snippet copied')); up();
  });

  /* ===================== 19. NETWORK PING ===================== */
  init('net', () => {
    const dot = P('NetDot'), st = P('NetSt'), ty = P('NetTy'), out = P('Ping'), btn = P('PingBtn');
    function status() {
      const ok = navigator.onLine; dot.className = 'pt-dot ' + (ok ? 'ok' : 'bad'); st.textContent = ok ? 'Online' : 'Offline';
      const cn = navigator.connection || navigator.mozConnection; ty.textContent = ok && cn && cn.effectiveType ? '(' + cn.effectiveType.toUpperCase() + (cn.downlink ? ', ~' + cn.downlink + ' Mbps' : '') + ')' : '';
    }
    async function ping() {
      if (!navigator.onLine) { out.textContent = 'Offline'; return; }
      btn.disabled = true; out.textContent = 'Pinging…'; const r = [];
      try {
        for (let i = 0; i < 3; i++) { const t = performance.now(); await fetch(location.href.split('#')[0].split('?')[0] + '?pt=' + Date.now() + i, { method: 'HEAD', cache: 'no-store' }); r.push(performance.now() - t); }
        const avg = Math.round(r.reduce((a, b) => a + b, 0) / r.length);
        out.textContent = avg + ' ms ' + (avg < 80 ? '(excellent)' : avg < 200 ? '(good)' : avg < 500 ? '(slow)' : '(very slow)');
      } catch (e) { out.textContent = 'Ping failed (open the site over http/https)'; }
      btn.disabled = false;
    }
    on(window, 'online', status); on(window, 'offline', status);
    const cn = navigator.connection; if (cn && cn.addEventListener) cn.addEventListener('change', status);
    on(btn, 'click', ping); status();
  });

  /* ===================== 20. FEEDBACK MODAL ===================== */
  let fbClose = () => {};
  init('fb', () => {
    const m = P('Modal'), t = P('FbT'), msg = P('FbM'), stars = P('Stars'); let rate = 0, lastFocus = null;
    const load = () => { try { return JSON.parse(LS.g('feedback', '[]')) || []; } catch (e) { return []; } };
    const count = () => { const n = load().length; P('FbN').textContent = n ? n + ' saved on this device.' : ''; };
    const paint = () => stars.querySelectorAll('button').forEach(b => b.classList.toggle('on', +b.dataset.v <= rate));
    function open() { lastFocus = D.activeElement; m.hidden = false; rate = 0; paint(); t.value = ''; msg.textContent = ''; setTimeout(() => stars.querySelector('button').focus(), 30); }
    function close() { if (m.hidden) return; m.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
    fbClose = close;
    on(P('FbOpen'), 'click', open); on(P('FbX'), 'click', close);
    on(m, 'click', e => { if (e.target === m) close(); });
    on(stars, 'click', e => { const b = e.target.closest('button'); if (b) { rate = +b.dataset.v; paint(); msg.textContent = ''; } });
    on(P('FbSend'), 'click', () => {
      if (!rate) { msg.textContent = 'Please pick a star rating first.'; return; }
      const a = load(); a.push({ r: rate, t: t.value.trim().slice(0, 600), d: new Date().toISOString() }); LS.s('feedback', JSON.stringify(a.slice(-20)));
      close(); count(); toast('Thanks for the feedback');
    });
    on(D, 'keydown', e => {
      if (m.hidden) return;
      if (e.key === 'Escape') close();
      if (e.key === 'Tab') { const f = [...m.querySelectorAll('button,textarea')].filter(x => !x.disabled); if (!f.length) return; const a = f[0], z = f[f.length - 1]; if (e.shiftKey && D.activeElement === a) { e.preventDefault(); z.focus(); } else if (!e.shiftKey && D.activeElement === z) { e.preventDefault(); a.focus(); } }
    });
    count();
  });

  /* ===================== 21. BATTERY ===================== */
  init('bat', () => {
    const bar = P('BatBar'), tx = P('BatTxt');
    if (!navigator.getBattery) { tx.textContent = 'Battery info is not available in this browser (Chrome and Edge support it).'; bar.parentNode.style.display = 'none'; return; }
    navigator.getBattery().then(b => {
      const up = () => { const l = Math.round(b.level * 100); bar.style.width = l + '%'; bar.className = l <= 20 && !b.charging ? 'low' : ''; tx.textContent = l + '% , ' + (b.charging ? 'charging' : 'on battery'); };
      ['levelchange', 'chargingchange'].forEach(ev => b.addEventListener(ev, up)); up();
    }).catch(() => { tx.textContent = 'Battery info is blocked in this browser.'; bar.parentNode.style.display = 'none'; });
  });

  /* ===================== 22. AMBIENT SOUND ===================== */
  init('amb', () => {
    const sel = P('AmbS'), vol = P('AmbV'), btn = P('AmbBtn'); let src = null, gain = null, playing = false;
    function buffer(c, kind) {
      const n = c.sampleRate * 3, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0, b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < n; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'brown') { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; }
        else if (kind === 'pink') { b0 = .99886 * b0 + w * .0555179; b1 = .99332 * b1 + w * .0750759; b2 = .969 * b2 + w * .153852; b3 = .8665 * b3 + w * .3104856; b4 = .55 * b4 + w * .5329522; b5 = -.7616 * b5 - w * .016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * .5362) * .11; b6 = w * .115926; }
        else d[i] = w * .6;
      }
      for (let i = 0; i < 2000; i++) d[n - 1 - i] *= i / 2000, d[i] *= i / 2000; /* soft loop edges */
      return b;
    }
    function stop() {
      if (src) { const s = src, g = gain, c = AC; try { g.gain.setTargetAtTime(0, c.currentTime, .08); s.stop(c.currentTime + .4); } catch (e) {} src = null; }
      playing = false; setSw(btn, false, 'Stop', 'Play');
    }
    function play() {
      const c = actx(); if (!c) { toast('Audio is not supported here'); return; }
      if (src) stop();
      const kind = sel.value; src = c.createBufferSource(); src.buffer = buffer(c, kind); src.loop = true;
      gain = c.createGain(); gain.gain.value = vol.value / 100 * .6;
      let node = src;
      if (kind === 'rain') { const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 700; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 7000; node.connect(hp); hp.connect(lp); node = lp; }
      node.connect(gain); gain.connect(c.destination); src.start(); playing = true; setSw(btn, true, 'Stop', 'Play');
    }
    on(btn, 'click', () => playing ? stop() : play());
    on(sel, 'change', () => { if (playing) play(); });
    on(vol, 'input', () => { if (gain) gain.gain.value = vol.value / 100 * .6; });
    setSw(btn, false, 'Stop', 'Play');
  });

  /* ===================== 25. QUICK SEARCH ===================== */
  init('search', () => {
    const i = P('Search'), cards = [...D.querySelectorAll('#ptGrid .pt-card:not(.pt-wide)')], none = P('None'), cnt = P('Count');
    function filter() {
      const q = i.value.trim().toLowerCase(); let n = 0;
      cards.forEach(c => { const hit = !q || (c.querySelector('h3').textContent + ' ' + c.dataset.k).toLowerCase().indexOf(q) > -1; c.hidden = !hit; if (hit) n++; });
      cnt.textContent = n + ' of ' + cards.length; none.hidden = n > 0;
    }
    on(i, 'input', filter);
    on(i, 'keydown', e => { if (e.key === 'Enter') { const f = cards.find(c => !c.hidden); if (f) { f.scrollIntoView({ behavior: 'smooth', block: 'center' }); f.classList.add('flash'); setTimeout(() => f.classList.remove('flash'), 1300); } } });
    filter();
  });

  /* ===================== 18. SHORTCUT KEYS (Alt + key) ===================== */
  init('keys', () => {
    on(D, 'keydown', e => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const m = { KeyP: () => { const s = D.getElementById('protools'); if (s) s.scrollIntoView({ behavior: 'smooth' }); },
        KeyM: () => matrixToggle(), KeyS: () => sfxSet(!sfxOn), KeyN: () => { const n = P('Notes'); if (n) { n.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => n.focus({ preventScroll: true }), 350); } } }[e.code];
      if (m) { e.preventDefault(); m(); }
    });
  });
})();


/* ===== UPDATE: 3D Car scene — mouse/touch se tilt (car apne aap round lagati rehti hai, CSS animation se) ===== */
(function () {
  const stage = document.getElementById('c3Stage');
  if (!stage) return;
  const reset = () => { stage.style.setProperty('--rx', '62deg'); stage.style.setProperty('--rz', '0deg'); };
  const move = (e) => {
    const r = stage.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    stage.style.setProperty('--rx', (62 + y * 16).toFixed(1) + 'deg');
    stage.style.setProperty('--rz', (x * -40).toFixed(1) + 'deg');
  };
  stage.addEventListener('pointermove', move);
  stage.addEventListener('pointerleave', reset);
})();


/* =====================================================================
   3D floating coloured boxes background (CSS 3D transforms - light weight)
   Body ke peeche + login popup ke andar; mouse hilane par halka parallax.
   ===================================================================== */
(function () {
  const COLORS = ['#5eead4', '#38bdf8', '#a78bfa', '#fb7185', '#fbbf24', '#34d399'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const small = window.matchMedia && matchMedia('(max-width: 700px)').matches;
  const worlds = [];
  function build(host, count) {
    if (!host || host.dataset.ready) return;
    host.dataset.ready = '1';
    const world = document.createElement('div'); world.className = 'bg3d-world';
    for (let i = 0; i < count; i++) {
      const b = document.createElement('div'); b.className = 'b3';
      const set = (k, v) => b.style.setProperty(k, v);
      set('--s', rnd(small ? 16 : 18, small ? 38 : 58).toFixed(0) + 'px');
      set('--x', rnd(2, 94).toFixed(1) + '%'); set('--y', rnd(4, 88).toFixed(1) + '%');
      set('--c', COLORS[i % COLORS.length]);
      set('--dx', rnd(-170, 170).toFixed(0) + 'px'); set('--dy', rnd(-130, 130).toFixed(0) + 'px'); set('--dz', rnd(-280, 280).toFixed(0) + 'px');
      set('--dur', rnd(14, 28).toFixed(1) + 's'); set('--spin', rnd(16, 40).toFixed(1) + 's'); set('--dl', (-rnd(0, 24)).toFixed(1) + 's');
      set('--rx', rnd(0, 360).toFixed(0) + 'deg'); set('--ry', rnd(0, 360).toFixed(0) + 'deg');
      const inner = document.createElement('div'); inner.className = 'b3-in';
      for (let f = 0; f < 6; f++) inner.appendChild(document.createElement('i'));
      b.appendChild(inner); world.appendChild(b);
    }
    host.appendChild(world); worlds.push(world);
  }
  function init() {
    document.querySelectorAll('.bg3d').forEach(h => build(h, h.classList.contains('bg3d-modal') ? (small ? 6 : 10) : (small ? 8 : 14)));
    if (!window.matchMedia || !matchMedia('(hover: hover)').matches) return;
    let tx = 0, ty = 0, queued = false;
    window.addEventListener('pointermove', e => {
      ty = (e.clientX / innerWidth - 0.5) * 10; tx = (0.5 - e.clientY / innerHeight) * 8;
      if (queued) return; queued = true;
      requestAnimationFrame(() => { queued = false; worlds.forEach(w => { w.style.setProperty('--tx', tx.toFixed(2) + 'deg'); w.style.setProperty('--ty', ty.toFixed(2) + 'deg'); }); });
    }, { passive: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();

/* ============================================================
   ✅ TAB CHECKBOXES + 🎯 O LEVEL TEST (HTML/CSS/JS) + 🎉 FUN EFFECTS
   Ye poora block naya hai. Purana koi code isme change nahi hua.
   - Har nav tab ke saath checkbox: tick = section khulta hai, untick = chhup jata hai
   - "O Level Test" tab: HTML / CSS / JavaScript subjects (100-100 questions) + Start Test
   - Fun button (🎉): confetti, balloons, fireworks, emoji rain + sound/voice (mute option ke saath)
   ============================================================ */

/* Default: sab tabs band (untick) rahenge jab tak student tick na kare.
   Agar chahte hain ki sab tabs by default khule rahein, to neeche false ko true kar dein. */
const TAB_DEFAULT_OPEN = false;

/* Ye function pehle se (renderTests ke andar) call hota hai, isliye global function hi rakha hai. */
function renderOLX() {
  const grid = document.getElementById('oltGrid');
  if (!grid || typeof OLX === 'undefined') return;
  const P = prog(), B = store.get('acec_best', {});
  OLX.forEach(c => {
    const key = c[0], n = getBank(key).length, s = P[key], b = B[key];
    const box = grid.querySelector('[data-badge="' + key + '"]');
    const cnt = grid.querySelector('[data-count="' + key + '"]');
    if (cnt) cnt.textContent = n ? t('nq', { n }) : t('soonS');
    if (!box) return;
    box.innerHTML = (s ? '<div class="rbadge">' + t('saved', { i: s.i, n: s.order.length }) + '</div>' : '') +
      (b ? '<div class="bbadge">🏅 ' + t('x_best') + ': ' + b.s + '/' + b.n + '</div>' : '');
  });
}

(() => {
  'use strict';
  const $1 = s => document.querySelector(s);
  const $all = s => Array.from(document.querySelectorAll(s));
  const safeStore = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const say = m => { if (typeof toast === 'function') toast(m); };

  /* ---------------------------------------------------------
     1) TAB CHECKBOXES
     --------------------------------------------------------- */
  const TAB_KEY = 'acec_tabs_open_v1';
  const boxes = $all('.tab-chk');
  const GATED = boxes.map(b => b.dataset.tab).filter(id => document.getElementById(id));
  const opened = new Set(safeStore.get(TAB_KEY, TAB_DEFAULT_OPEN ? GATED : []));
  const allBox = $1('#tabAll');

  function persist() { safeStore.set(TAB_KEY, GATED.filter(id => opened.has(id))); }

  function paintAll() {
    if (!allBox) return;
    const n = GATED.filter(id => opened.has(id)).length;
    allBox.checked = n === GATED.length && n > 0;
    allBox.indeterminate = n > 0 && n < GATED.length;
  }

  function setTab(id, on, quiet) {
    const sec = document.getElementById(id);
    if (!sec || !GATED.includes(id)) return;
    const was = !sec.classList.contains('tab-collapsed');
    sec.classList.toggle('tab-collapsed', !on);
    if (on) opened.add(id); else opened.delete(id);
    $all('.tab-chk[data-tab="' + id + '"]').forEach(b => { b.checked = on; });
    if (on && !was) {
      sec.classList.add('tab-in');
      setTimeout(() => sec.classList.remove('tab-in'), 600);
      // Chhupe hue section me jo games/canvas the unko size dobara nikalne do
      requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    }
    if (!quiet) persist();
    paintAll();
    document.dispatchEvent(new CustomEvent('acec:tab', { detail: { id, open: on } }));
  }

  function goTab(id) {
    setTab(id, true);
    requestAnimationFrame(() => {
      const sec = document.getElementById(id);
      if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Page load par saved state lagao
  GATED.forEach(id => setTab(id, opened.has(id), true));
  paintAll();

  // Checkbox change
  boxes.forEach(b => b.addEventListener('change', () => {
    if (b.checked) goTab(b.dataset.tab); else setTab(b.dataset.tab, false);
  }));
  if (allBox) allBox.addEventListener('change', () => {
    GATED.forEach(id => setTab(id, allBox.checked, true));
    persist(); paintAll();
    say(allBox.checked ? '✅ Saare tabs khul gaye' : '☑️ Saare tabs band');
  });

  // Koi bhi #link (nav, hero button, footer...) band section ki taraf ja raha ho to pehle use khol do
  document.addEventListener('click', e => {
    const a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = (a.getAttribute('href') || '').slice(1);
    if (!id || !GATED.includes(id)) return;
    const sec = document.getElementById(id);
    if (sec && sec.classList.contains('tab-collapsed')) { e.preventDefault(); goTab(id); history.replaceState(null, '', '#' + id); }
  }, true);

  // Direct link (example.com/#ccc) aur browser back/forward
  function fromHash() {
    const id = (location.hash || '').slice(1);
    if (id && GATED.includes(id)) goTab(id);
  }
  window.addEventListener('hashchange', fromHash);
  if (location.hash) setTimeout(fromHash, 60);

  // Search / voice assistant jab scrollIntoView se kisi band section tak pahunchein to wo khul jaye
  const _siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (...args) {
    const sec = this.closest && this.closest('.tab-collapsed');
    if (sec && sec.id) setTab(sec.id, true);
    return _siv.apply(this, args);
  };

  // Nav me switchTab('battle-arena') pehle se likha hai par kahin defined nahi tha
  if (typeof window.switchTab !== 'function') window.switchTab = id => { if (GATED.includes(id)) goTab(id); };

  /* ---------------------------------------------------------
     2) O LEVEL TEST  (HTML / CSS / JavaScript)
     --------------------------------------------------------- */
  let picked = null;
  const startBtns = () => $all('#oltStart, .olx-go');
  const hint = $1('#oltHint');

  function paintPick() {
    $all('.olx-pick').forEach(b => { b.checked = b.dataset.ox === picked; });
    $all('.olx-card').forEach(c => c.classList.toggle('on', c.dataset.ox === picked));
    const row = picked && (typeof OLX !== 'undefined') ? OLX.find(x => x[0] === picked) : null;
    startBtns().forEach(b => { b.disabled = !picked; });
    if (hint) hint.textContent = row ? 'Selected: ' + row[1] + ' · ' + getBank(picked).length + ' questions' : 'Pehle ek subject tick karein';
  }

  document.addEventListener('change', e => {
    const b = e.target;
    if (!b.classList || !b.classList.contains('olx-pick')) return;
    picked = b.checked ? b.dataset.ox : (picked === b.dataset.ox ? null : picked);
    paintPick();
  });

  // Card ke kisi bhi hisse par click karne se bhi checkbox tick ho jata hai
  document.addEventListener('click', e => {
    const card = e.target.closest && e.target.closest('.olx-card');
    if (!card || e.target.closest('input, label, button')) return;
    const b = card.querySelector('.olx-pick');
    if (b) { b.checked = !b.checked; b.dispatchEvent(new Event('change', { bubbles: true })); }
  });

  function startPicked() {
    if (!picked) { say('☝️ Pehle HTML, CSS ya JavaScript me se ek subject tick karein'); return; }
    const m = $1('#menu'); if (m) m.classList.remove('open');
    openTest(picked);
  }
  startBtns().forEach(b => b.addEventListener('click', startPicked));

  // Nav ke andar sub-options tabhi dikhen jab "O Level Test" tab tick/open ho
  function paintSub() {
    const sub = $1('#olxSubNav'), sec = document.getElementById('oltest');
    if (sub && sec) sub.hidden = sec.classList.contains('tab-collapsed');
  }
  document.addEventListener('acec:tab', e => { if (e.detail.id === 'oltest') paintSub(); });
  paintSub(); paintPick(); renderOLX();

  /* ---------------------------------------------------------
     3) FUN EFFECTS  (confetti / balloons / fireworks / emoji + sound & voice)
     --------------------------------------------------------- */
  const fab = $1('#funFab'), panel = $1('#funPanel'), cv = $1('#funCv');
  if (!fab || !panel || !cv) return;
  const cx = cv.getContext('2d');
  const prefs = Object.assign({ muted: false, voice: true, auto: false }, safeStore.get('acec_fun', {}));
  const savePrefs = () => safeStore.set('acec_fun', prefs);
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const COLORS = ['#ff2e93', '#ffd60a', '#38bdf8', '#22c55e', '#a78bfa', '#fb923c', '#f43f5e', '#2dd4bf'];
  const EMOJI = ['🎉', '🥳', '🎈', '⭐', '✨', '💻', '🚀', '😀', '🎊', '🔥', '🪔', '🎆'];
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  /* ----- Sound (Web Audio API) ----- */
  let ac = null;
  function audio() {
    if (prefs.muted) return null;
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) { try { ac = new C(); } catch { ac = null; } } }
    if (ac && ac.state === 'suspended') ac.resume();
    return ac;
  }
  function tone(freq, at, dur, type, vol, slideTo) {
    const a = audio(); if (!a) return;
    const o = a.createOscillator(), g = a.createGain(), t0 = a.currentTime + at;
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  function noise(at, dur, vol, cutoff) {
    const a = audio(); if (!a) return;
    const len = Math.max(1, Math.floor(a.sampleRate * dur)), buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = cutoff || 900; g.gain.value = vol || 0.05;
    s.connect(f); f.connect(g); g.connect(a.destination);
    s.start(a.currentTime + at);
  }
  const SOUND = {
    confetti() { noise(0, 0.12, 0.06, 3000); [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.05 + i * 0.07, 0.18, 'triangle', 0.05)); },
    balloons() { for (let i = 0; i < 4; i++) tone(300 + i * 90, i * 0.28, 0.22, 'sine', 0.05, 520 + i * 110); },
    fireworks() { for (let i = 0; i < 5; i++) { tone(900, i * 0.45, 0.35, 'sine', 0.025, 200); noise(i * 0.45 + 0.3, 0.35, 0.07, 600); } },
    emoji() { [784, 988, 1175, 1319, 1175, 988].forEach((f, i) => tone(f, i * 0.12, 0.16, 'sine', 0.045)); },
    party() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.05)); noise(0.1, 0.15, 0.06, 2500); },
    result() { [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.3, 'triangle', 0.055)); tone(1319, 0.5, 0.6, 'sine', 0.05); }
  };
  let lastSound = 0;
  function playSound(name) {
    if (prefs.muted) return;
    const now = Date.now(); if (now - lastSound < 900) return; lastSound = now;
    try { (SOUND[name] || SOUND.confetti)(); } catch {}
  }

  /* ----- Voice (Web Speech API) ----- */
  const PHRASES = {
    confetti: ['Congratulations!', 'Hooray! Party time!'],
    balloons: ['Wow! So much fun!', 'Up, up and away!'],
    fireworks: ['Happy celebration!', 'Boom! Look at that!'],
    emoji: ['Let us have some fun!', 'Smile! You are doing great!'],
    party: ['Party time at Access Computer Education Centre!', 'Shabaash students!'],
    result: ['Shabaash! Excellent score!', 'Well done! Keep it up!']
  };
  let lastVoice = 0;
  function speak(name) {
    if (prefs.muted || !prefs.voice || !('speechSynthesis' in window)) return;
    const now = Date.now(); if (now - lastVoice < 8000) return; lastVoice = now;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(pick(PHRASES[name] || PHRASES.confetti));
      u.rate = 1; u.pitch = 1.15; u.volume = 0.8; u.lang = 'en-IN';
      speechSynthesis.speak(u);
    } catch {}
  }

  /* ----- Visuals (canvas) ----- */
  const parts = []; let raf = 0, last = 0, W = 0, H = 0, dpr = 1;
  const MAXP = 700;
  function size() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', () => { if (parts.length) size(); });
  const scale = n => Math.max(6, Math.round(n * (reduce ? 0.35 : (W < 600 ? 0.6 : 1))));
  const add = p => { if (parts.length < MAXP) parts.push(p); };

  function confettiBurst(x, y, dir) {
    for (let i = 0; i < scale(70); i++) {
      const ang = (dir === 0 ? -Math.PI / 2 : -Math.PI / 2 + dir * rnd(0.15, 0.9)), sp = rnd(9, 20);
      add({ k: 'rect', x, y, vx: Math.cos(ang) * sp + rnd(-2, 2), vy: Math.sin(ang) * sp, g: 0.32, drag: 0.985, w: rnd(6, 11), h: rnd(4, 8), rot: rnd(0, 6.28), vr: rnd(-0.3, 0.3), c: pick(COLORS), life: rnd(130, 210), age: 0 });
    }
  }
  function confettiRain(n) {
    for (let i = 0; i < scale(n); i++) add({ k: 'rect', x: rnd(0, W), y: rnd(-H * 0.6, -10), vx: rnd(-1, 1), vy: rnd(1.5, 4), g: 0.02, drag: 1, w: rnd(6, 10), h: rnd(4, 7), rot: rnd(0, 6.28), vr: rnd(-0.2, 0.2), c: pick(COLORS), life: 400, age: 0, sway: rnd(0, 6.28) });
  }
  function balloons(n) {
    for (let i = 0; i < scale(n); i++) add({ k: 'balloon', x: rnd(20, W - 20), y: H + rnd(40, 320), vx: 0, vy: -rnd(1.4, 3), r: rnd(20, 32), c: pick(COLORS), life: 700, age: 0, sway: rnd(0, 6.28), sw: rnd(0.02, 0.05) });
  }
  function fireworkAt(x, y) {
    const col = pick(COLORS), n = scale(70);
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + rnd(-0.05, 0.05), sp = rnd(2.5, 7.5);
      add({ k: 'spark', x, y, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, g: 0.06, drag: 0.975, c: Math.random() < 0.3 ? '#fff' : col, life: rnd(55, 95), age: 0 });
    }
  }
  function fireworks(count) {
    for (let i = 0; i < count; i++) setTimeout(() => { fireworkAt(rnd(W * 0.15, W * 0.85), rnd(H * 0.12, H * 0.5)); ensureLoop(); }, i * 450);
  }
  function emojiRain(n) {
    for (let i = 0; i < scale(n); i++) add({ k: 'emoji', ch: pick(EMOJI), s: rnd(22, 42), x: rnd(0, W), y: rnd(-H * 0.7, -20), vx: rnd(-0.6, 0.6), vy: rnd(2, 4.5), g: 0.01, drag: 1, rot: rnd(-0.5, 0.5), vr: rnd(-0.03, 0.03), life: 420, age: 0 });
  }

  function step(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.age += dt;
      if (p.sway !== undefined) p.sway += p.sw || 0.06;
      p.vx *= Math.pow(p.drag || 1, dt); p.vy += (p.g || 0) * dt;
      p.x += (p.vx + (p.k === 'balloon' || p.sway !== undefined ? Math.sin(p.sway) * 0.9 : 0)) * dt; p.y += p.vy * dt;
      if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      if (p.age > p.life || p.y > H + 80 && p.k !== 'balloon' || p.y < -120 && p.k === 'balloon') parts.splice(i, 1);
    }
  }
  function draw() {
    cx.clearRect(0, 0, W, H);
    for (const p of parts) {
      const fade = Math.max(0, Math.min(1, (p.life - p.age) / (p.k === 'spark' ? 35 : 60)));
      cx.globalAlpha = fade;
      if (p.k === 'rect') {
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.fillStyle = p.c; cx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); cx.restore();
      } else if (p.k === 'spark') {
        cx.globalCompositeOperation = 'lighter'; cx.fillStyle = p.c; cx.beginPath(); cx.arc(p.x, p.y, 2.2, 0, 6.283); cx.fill(); cx.globalCompositeOperation = 'source-over';
      } else if (p.k === 'balloon') {
        cx.strokeStyle = 'rgba(255,255,255,.55)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y + p.r * 1.25); cx.quadraticCurveTo(p.x + 8, p.y + p.r * 2.2, p.x - 4, p.y + p.r * 3); cx.stroke();
        cx.fillStyle = p.c; cx.beginPath(); cx.ellipse(p.x, p.y, p.r * 0.82, p.r, 0, 0, 6.283); cx.fill();
        cx.fillStyle = 'rgba(255,255,255,.35)'; cx.beginPath(); cx.ellipse(p.x - p.r * 0.3, p.y - p.r * 0.35, p.r * 0.18, p.r * 0.3, -0.5, 0, 6.283); cx.fill();
        cx.fillStyle = p.c; cx.beginPath(); cx.moveTo(p.x, p.y + p.r); cx.lineTo(p.x - 4, p.y + p.r + 7); cx.lineTo(p.x + 4, p.y + p.r + 7); cx.closePath(); cx.fill();
      } else if (p.k === 'emoji') {
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.rot); cx.font = p.s + 'px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(p.ch, 0, 0); cx.restore();
      }
    }
    cx.globalAlpha = 1;
  }
  function loop(ts) {
    const dt = Math.min(2.2, (ts - last) / 16.67 || 1); last = ts;
    step(dt); draw();
    if (parts.length || pending > 0) raf = requestAnimationFrame(loop);
    else { raf = 0; cx.clearRect(0, 0, W, H); cv.classList.remove('on'); }
  }
  let pending = 0;
  function ensureLoop() {
    if (!W) size();
    cv.classList.add('on');
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
  }

  const FX = {
    confetti() { confettiBurst(W * 0.08, H, 1); confettiBurst(W * 0.92, H, -1); setTimeout(() => { confettiRain(80); ensureLoop(); }, 350); },
    balloons() { balloons(18); },
    fireworks() { fireworks(6); },
    emoji() { emojiRain(46); },
    party() { FX.confetti(); balloons(10); fireworks(4); emojiRain(20); }
  };
  function run(name) {
    if (!FX[name]) name = 'confetti';
    size();
    pending++; setTimeout(() => { pending = Math.max(0, pending - 1); }, name === 'fireworks' || name === 'party' ? 2600 : 600);
    FX[name](); ensureLoop();
    playSound(name); speak(name);
  }

  /* ----- Panel UI ----- */
  const muteBtn = $1('#funMute'), voiceBox = $1('#funVoice'), autoBox = $1('#funAuto');
  function paintPrefs() {
    muteBtn.textContent = prefs.muted ? '🔇 Sound: OFF (tap to unmute)' : '🔊 Sound: ON (tap to mute)';
    muteBtn.setAttribute('aria-pressed', String(prefs.muted));
    fab.classList.toggle('muted', prefs.muted);
    voiceBox.checked = !!prefs.voice; voiceBox.disabled = prefs.muted;
    autoBox.checked = !!prefs.auto;
  }
  paintPrefs();
  function openPanel(on) {
    panel.hidden = !on; fab.setAttribute('aria-expanded', String(on));
    if (!on && 'speechSynthesis' in window && prefs.muted) speechSynthesis.cancel();
  }
  fab.addEventListener('click', e => { e.stopPropagation(); openPanel(panel.hidden); });
  panel.addEventListener('click', e => e.stopPropagation());
  document.addEventListener('click', () => { if (!panel.hidden) openPanel(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) { openPanel(false); fab.focus(); } });
  panel.addEventListener('click', e => { const b = e.target.closest('[data-fx]'); if (b) run(b.dataset.fx); });
  muteBtn.addEventListener('click', () => {
    prefs.muted = !prefs.muted; savePrefs(); paintPrefs();
    if (prefs.muted && 'speechSynthesis' in window) speechSynthesis.cancel();
    else { lastSound = 0; tone(660, 0, 0.12, 'sine', 0.05); tone(880, 0.12, 0.16, 'sine', 0.05); }
  });
  voiceBox.addEventListener('change', () => { prefs.voice = voiceBox.checked; savePrefs(); if (!prefs.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); });
  autoBox.addEventListener('change', () => { prefs.auto = autoBox.checked; savePrefs(); });

  // Test me 80%+ score aaye to (agar Auto-celebrate on ho) fireworks + gentle fanfare + voice
  window.acFunResult = () => {
    if (!prefs.auto) return;
    size(); pending++; setTimeout(() => { pending = Math.max(0, pending - 1); }, 2400);
    fireworks(4); ensureLoop(); playSound('result'); speak('result');
  };
  window.acFun = { run, mute: v => { prefs.muted = !!v; savePrefs(); paintPrefs(); } };
})();

/* =====================================================================
   ONLINE TEST  (M1-R5 / M2-R5)  -- appended; purana code untouched
   ---------------------------------------------------------------------
   PASSWORDS (change karne ke liye neeche TESTS / HIST_PASS dekhein):
     M1-R5 test password : M1R5@2026
     M2-R5 test password : M2R5@2026
     History password    : HIST@2026
   Passwords yahan hash karke rakhe hain (seedha text nahi).
   Naya password set karna ho to browser console me:  otHashPass('NayaPass')
   aur jo hash aaye wo neeche 'hash' me paste kar dein.

   QUESTIONS UPDATE KARNE KE LIYE: neeche OT_BANK me har test ke liye
   {q:"sawal", o:["A","B","C","D"], a:sahi_option_ka_index(0 se shuru)} format hai.
   M1-R5 = M1-R5.pdf (100 MCQ) | M2-R5 = html.pdf (40 MCQ + 10 True/False = 50)
   ===================================================================== */
const OT_BANK = {"M1-R5":[{"q":"Computer ke kis bhaag ko \"Brain of Computer\" kaha jata hai?","o":["RAM","CPU","Hard Disk","Monitor"],"a":1},{"q":"Inmein se kaunsi ek Volatile (asthaayi) memory hai?","o":["ROM","SSD","RAM","Pen Drive"],"a":2},{"q":"1 Kilobyte (KB) mein kitne Bytes hote hain?","o":["1000 Bytes","1024 Bytes","512 Bytes","2048 Bytes"],"a":1},{"q":"Second Generation computers mein kis technology ka upyog kiya gaya tha?","o":["Vacuum Tubes","Integrated Circuits","Transistors","Microprocessors"],"a":2},{"q":"Inmein se kaunsa ek Output Device hai?","o":["Scanner","Joystick","Plotter","Trackball"],"a":2},{"q":"BIOS ka poora naam (Full Form) kya hai?","o":["Basic Input Output System","Binary Input Output Setup","Basic Internal Operating System","Boot Input Output Service"],"a":0},{"q":"MICR (Magnetic Ink Character Recognition) ka upyog mukhya roop se kahan hota hai?","o":["Shopping Malls","Banks (Cheque processing)","Hospitals","Airports"],"a":1},{"q":"Computer start hone par sabse pehle kaunsa software load hota hai?","o":["LibreOffice","Web Browser","Operating System","Antivirus"],"a":2},{"q":"Inmein se kaunsa ek Open-Source Operating System hai?","o":["Windows 11","macOS","Linux (Ubuntu)","iOS"],"a":2},{"q":"GUI ka poora naam kya hai?","o":["General User Interface","Graphical User Interface","Global Utility Integration","Graphic Unit Input"],"a":1},{"q":"Windows mein kisi file ya folder ko permanently delete karne (Recycle Bin mein bheje bina) ki shortcut key kya hai?","o":["Delete","Ctrl + Delete","Shift + Delete","Alt + Delete"],"a":2},{"q":"Windows mein kisi selected file ya folder ka naam badalne (Rename) ki shortcut key kya hai?","o":["F1","F2","F5","F12"],"a":1},{"q":"Linux Operating System ke mukhya core (heart) ko kya kaha jata hai?","o":["Shell","Kernel","Terminal","Root"],"a":1},{"q":"Windows OS mein Task Manager open karne ki shortcut key kya hai?","o":["Ctrl + Alt + T","Ctrl + Shift + Esc","Alt + Tab","Win + R"],"a":1},{"q":"Windows mein Run dialog box open karne ki shortcut key kya hai?","o":["Win + E","Win + D","Win + R","Win + L"],"a":2},{"q":"Computer ko sleep mode ya lock karne ke liye Windows mein kaunsi shortcut key use hoti hai?","o":["Win + L","Win + K","Ctrl + L","Alt + L"],"a":0},{"q":"Ek hi samay par ek se adhik applications chalane ki OS ki kshamta ko kya kehte hain?","o":["Multiprocessing","Multitasking","Multiuser","Multithreading"],"a":1},{"q":"Inmein se kaunsi mobile operating system nahi hai?","o":["Android","iOS","HarmonyOS","Fedora"],"a":3},{"q":"QR Code ka poora naam kya hai?","o":["Quick Response Code","Quality Result Code","Quick Register Code","Query Read Code"],"a":0},{"q":"Cloud Computing mein \"SaaS\" ka poora naam kya hai?","o":["Storage as a Service","Software as a Service","System as a Server","Security as a Service"],"a":1},{"q":"LibreOffice Writer document ka default file extension kya hota hai?","o":[".docx",".odt",".ods",".odp"],"a":1},{"q":"LibreOffice Writer mein \"Save As\" karne ki shortcut key kya hai?","o":["Ctrl + S","Ctrl + Shift + S","F12","Alt + S"],"a":1},{"q":"LibreOffice Writer mein \"Print Preview\" dekhne ki shortcut key kya hai?","o":["Ctrl + P","Ctrl + Shift + O","Ctrl + F2","Shift + P"],"a":1},{"q":"LibreOffice Writer mein \"Find and Replace\" dialog box open karne ki shortcut key kya hai?","o":["Ctrl + F","Ctrl + H","Ctrl + R","Alt + F"],"a":1},{"q":"LibreOffice Writer mein \"Superscript\" (jaise X²) lagane ki shortcut key kya hai?","o":["Ctrl + Shift + P","Ctrl + Shift + B","Ctrl + =","Ctrl + Shift + +"],"a":0},{"q":"LibreOffice Writer mein \"Subscript\" (jaise H₂O) lagane ki shortcut key kya hai?","o":["Ctrl + Shift + P","Ctrl + Shift + B","Ctrl + B","Alt + B"],"a":1},{"q":"LibreOffice Writer mein \"Clear Direct Formatting\" karne ki shortcut key kya hai?","o":["Ctrl + M","Ctrl + Q","Ctrl + Space","Shift + M"],"a":0},{"q":"LibreOffice Writer mein \"Page Break\" insert karne ki shortcut key kya hai?","o":["Shift + Enter","Ctrl + Enter","Alt + Enter","Tab + Enter"],"a":1},{"q":"LibreOffice Writer mein \"Double Underline\" lagane ki shortcut key kya hai?","o":["Ctrl + U","Ctrl + D","Ctrl + Shift + D","Alt + U"],"a":1},{"q":"LibreOffice Writer mein \"Ruler\" ko show ya hide karne ki shortcut key kya hai?","o":["Ctrl + R","Ctrl + Shift + R","Alt + R","F9"],"a":1},{"q":"LibreOffice Writer ke kis menu mein \"Mail Merge Wizard\" option hota hai?","o":["Insert","Format","Tools","File"],"a":2},{"q":"LibreOffice Writer ke kis menu mein \"Header and Footer\" insert karne ka vikalp hota hai?","o":["View","Insert","Format","Styles"],"a":1},{"q":"LibreOffice Writer ke kis menu mein \"Word Count\" option milta hai?","o":["Edit","View","Tools","Format"],"a":2},{"q":"LibreOffice Writer mein \"Export Directly as PDF\" ka option kis menu mein hota hai?","o":["File","Edit","Tools","Window"],"a":0},{"q":"LibreOffice Writer ke kis menu mein \"Track Changes\" (Record/Manage) option paya jata hai?","o":["File","Edit","Insert","Styles"],"a":1},{"q":"LibreOffice Writer mein Table insert karne ki shortcut key kya hai?","o":["Ctrl + T","Ctrl + F12","Shift + F12","Alt + T"],"a":1},{"q":"LibreOffice Writer mein \"Spelling Check\" karne ki shortcut key kya hai?","o":["F5","F7","Shift + F7","Ctrl + F7"],"a":1},{"q":"LibreOffice Writer mein \"Thesaurus\" (paryayvachi shabd) kholne ki shortcut key kya hai?","o":["F7","Ctrl + F7","Shift + F7","Alt + F7"],"a":1},{"q":"LibreOffice Writer mein \"Manage Templates\" open karne ki shortcut key kya hai?","o":["Ctrl + T","Ctrl + Shift + N","Alt + N","Ctrl + N"],"a":1},{"q":"LibreOffice Writer mein \"Heading 1\" style apply karne ki shortcut key kya hai?","o":["Ctrl + 1","Alt + 1","Shift + 1","F1"],"a":0},{"q":"LibreOffice Writer mein \"Navigator\" on/off karne ki shortcut key kya hai?","o":["F3","F5","F7","F11"],"a":1},{"q":"LibreOffice Writer mein default page orientation kaunsa hota hai?","o":["Landscape","Portrait","Legal","A3"],"a":1},{"q":"LibreOffice Writer mein minimum aur maximum zoom percentage kitna hota hai?","o":["10% se 400%","20% se 600%","20% se 500%","10% se 500%"],"a":1},{"q":"LibreOffice Writer mein kisi word ko select karne ke liye mouse se kitni baar click kiya jata hai?","o":["Single click","Double click","Triple click","Quadruple click"],"a":1},{"q":"LibreOffice Writer mein \"AutoText\" insert karne ki shortcut key kya hai?","o":["Ctrl + F3","Alt + F3","Shift + F3","F3"],"a":3},{"q":"LibreOffice Calc spreadsheet ka default file extension kya hota hai?","o":[".xlsx",".odt",".ods",".odp"],"a":2},{"q":"LibreOffice Calc mein koi bhi formula ya function kis symbol se shuru hota hai?","o":["@","#","=","$"],"a":2},{"q":"Formula =SUM(10, 20, 30) ka output kya hoga?","o":["30","60","20","Error"],"a":1},{"q":"Formula =AVERAGE(10, 20, 30, 40) ka parinaam kya aayega?","o":["20","25","30","100"],"a":1},{"q":"Formula =PRODUCT(5, 4, 2) ka output kya hoga?","o":["11","20","40","10"],"a":2},{"q":"Formula =QUOTIENT(17, 5) ka output kya hoga?","o":["2","3","3.4","5"],"a":1},{"q":"Formula =MOD(17, 5) ka parinaam (remainder) kya hoga?","o":["3","2","3.4","12"],"a":1},{"q":"Formula =ROUND(45.678, 1) ka output kya hoga?","o":["45.6","45.7","46","45.68"],"a":1},{"q":"Formula =FLOOR(127, 10) ka output kya hoga?","o":["130","120","127","100"],"a":1},{"q":"Formula =CEILING(121, 10) ka output kya hoga?","o":["120","130","125","121"],"a":1},{"q":"Formula =POWER(2, 5) ka parinaam kya hoga?","o":["10","25","32","7"],"a":2},{"q":"Range mein sirf numbers ginne ke liye kaunsa function use hota hai?","o":["=COUNTA()","=COUNT()","=COUNTIF()","=COUNTBLANK()"],"a":1},{"q":"Formula =MAX(12, 45, 8, 67, 23) aur =MIN(12, 45, 8, 67, 23) ka antar (MAX − MIN) kya hoga?","o":["59","55","44","67"],"a":0},{"q":"Formula =LEN(\"LibreOffice\") ka output kya hoga?","o":["10","11","12","9"],"a":1},{"q":"Formula =CONCATENATE(\"CCC\", \" \", \"Exam\") ka output kya hoga?","o":["CCCExam","CCC Exam","CCC-Exam","Error"],"a":1},{"q":"LibreOffice Calc mein current Date insert karne ki shortcut key kya hai?","o":["Ctrl + ;","Ctrl + Shift + ;","Alt + ;","Ctrl + D"],"a":0},{"q":"LibreOffice Calc mein current Time insert karne ki shortcut key kya hai?","o":["Ctrl + ;","Ctrl + Shift + ;","Ctrl + T","Shift + T"],"a":1},{"q":"LibreOffice Calc mein \"Format Cells\" dialog box kholne ki shortcut key kya hai?","o":["Ctrl + 1","Ctrl + F1","Alt + 1","Shift + 1"],"a":0},{"q":"LibreOffice Calc mein \"Function Wizard\" open karne ki shortcut key kya hai?","o":["F2","Ctrl + F2","Shift + F2","Alt + F2"],"a":1},{"q":"LibreOffice Calc mein kisi cell ko edit mode mein kholne ki shortcut key kya hai?","o":["F2","F4","F5","F7"],"a":0},{"q":"Cell reference ko Relative se Absolute (jaise $A$1) mein badalne ki shortcut key kya hai?","o":["F2","F4","F8","Ctrl + $"],"a":1},{"q":"LibreOffice Calc mein \"Insert Cells\" dialog box open karne ki shortcut key kya hai?","o":["Ctrl + +","Ctrl + -","Alt + +","Shift + +"],"a":0},{"q":"LibreOffice Calc mein ek worksheet mein maximum kitni Rows hoti hain?","o":["65,536","1,048,576","16,384","1,024"],"a":1},{"q":"LibreOffice Calc mein aakhiri column ka naam (address) kya hota hai (16,384 columns par)?","o":["AMJ","XFD","ZZZ","IV"],"a":1},{"q":"Jab cell ki width number dikhane ke liye kam pad jati hai, toh Calc kya error dikhata hai?","o":["#REF!","#NAME?","###","#VALUE!"],"a":2},{"q":"LibreOffice Impress presentation ka default file extension kya hota hai?","o":[".pptx",".odt",".ods",".odp"],"a":3},{"q":"LibreOffice Impress mein first slide se Slide Show start karne ki shortcut key kya hai?","o":["F5","Shift + F5","Ctrl + F5","Alt + F5"],"a":0},{"q":"Current slide (jahan aap kaam kar rahe hain) se Slide Show start karne ki shortcut key kya hai?","o":["F5","Shift + F5","Ctrl + F5","F7"],"a":1},{"q":"LibreOffice Impress mein \"New Slide\" insert karne ki shortcut key kya hai?","o":["Ctrl + N","Ctrl + M","Ctrl + Shift + N","Alt + M"],"a":1},{"q":"LibreOffice Impress mein \"Text Box\" insert karne ki shortcut key kya hai?","o":["F2","F4","F5","F8"],"a":0},{"q":"LibreOffice Impress mein \"Duplicate\" dialog box open karne ki shortcut key kya hai?","o":["Ctrl + D","Shift + F3","Ctrl + Shift + D","Alt + D"],"a":1},{"q":"Chalte hue Slide Show ko beech mein rokne (exit karne) ke liye kaunsi key dabai jati hai?","o":["Enter","Esc","Spacebar","Backspace"],"a":1},{"q":"Slide Show ke dauran agli slide par jane ke liye inmein se kaunsi key kaam nahi karti?","o":["Spacebar","Right Arrow","Esc","Enter"],"a":2},{"q":"LibreOffice Impress ke kis view mein sabhi slides chhote thumbnails ke roop mein ek saath dikhai deti hain?","o":["Normal View","Outline View","Slide Sorter View","Notes View"],"a":2},{"q":"Slides ko design aur edit karne ke liye default main view kaunsa hota hai?","o":["Normal View","Slide Sorter View","Master View","Handout View"],"a":0},{"q":"Kis view mein slide ka keval text content (headings aur bullets) dikhai deta hai, graphics nahi?","o":["Notes View","Outline View","Slide Sorter View","Normal View"],"a":1},{"q":"Presenter ke bolne ke liye speaker notes kis view mein likhe jate hain?","o":["Outline View","Notes View","Slide Sorter View","Master View"],"a":1},{"q":"Ek slide ke baad doosri slide aane par jo visual effect dikhta hai, use kya kehte hain?","o":["Custom Animation","Slide Transition","Slide Design","Master Slide"],"a":1},{"q":"Slide ke andar kisi text, image ya shape par lagaye jane wale movement effect ko kya kehte hain?","o":["Slide Transition","Animation","Slide Layout","Rehearse Timings"],"a":1},{"q":"LibreOffice Impress mein \"Slide Transition\" option kis menu mein hota hai?","o":["Insert","Slide","Format","Tools"],"a":1},{"q":"LibreOffice Impress mein \"Master Slide\" kis menu ke antargat aata hai?","o":["View","File","Edit","Tools"],"a":0},{"q":"Sabhi slides par ek jaisa background, logo ya font style ek hi baar mein set karne ke liye kis feature ka upyog hota hai?","o":["Slide Sorter","Master Slide","Slide Transition","Notes Page"],"a":1},{"q":"Slide par bane dotted boxes (jahan title, text ya image dali jati hai) ko kya kehte hain?","o":["Text Frames","Placeholders","Templates","Grids"],"a":1},{"q":"LibreOffice Impress mein default slide orientation kaunsa hota hai?","o":["Portrait","Landscape","Vertical","Square"],"a":1},{"q":"LibreOffice Impress mein minimum aur maximum zoom percentage kitna hota hai?","o":["5% se 3000%","10% se 400%","20% se 600%","5% se 500%"],"a":0},{"q":"LibreOffice Impress mein kisi object ka \"Position and Size\" dialog box open karne ki shortcut key kya hai?","o":["F2","F4","F5","F11"],"a":1},{"q":"Selected objects ko ek saath \"Group\" karne ki shortcut key kya hai?","o":["Ctrl + G","Ctrl + Shift + G","Alt + G","Shift + G"],"a":1},{"q":"Grouped objects ko wapas \"Ungroup\" karne ki shortcut key kya hai?","o":["Ctrl + U","Ctrl + Alt + Shift + G","Ctrl + Shift + U","Alt + U"],"a":1},{"q":"Audience ko baantne ke liye ek hi page par 2, 4, 6 ya 9 slides print karne ke liye kis option ka upyog hota hai?","o":["Outline","Handouts","Notes","Slides"],"a":1},{"q":"Slide show ke dauran screen ko poora Black (kaala) karne ke liye kaunsi key dabai jati hai?","o":["B","W","K","S"],"a":0},{"q":"Slide show ke dauran screen ko poora White (safed) karne ke liye kaunsi key dabai jati hai?","o":["B","W","F","Space"],"a":1},{"q":"Presentation mein har slide ke liye bolne ka samay (timing) record karne ke liye kis feature ka upyog hota hai?","o":["Slide Timer","Rehearse Timings","Auto Play","Custom Show"],"a":1},{"q":"LibreOffice Impress mein \"Duplicate Slide\" banane ka option kis menu mein hota hai?","o":["File","Edit","Slide","View"],"a":2},{"q":"LibreOffice Impress mein \"Photo Album\" create karne ka option kis menu mein milta hai?","o":["File","Insert","Slide","Tools"],"a":1},{"q":"LibreOffice Impress mein \"Styles\" sidebar open ya close karne ki shortcut key kya hai?","o":["F5","F7","F11","F12"],"a":2}],"M2-R5":[{"q":"HTML ka poora naam (Full Form) kya hai?","o":["High Text Machine Language","HyperText and Links Markup Language","HyperText Markup Language","None of these"],"a":2},{"q":"HTML document ka sabse pehla tag kaunsa hota hai?","o":["<head>","<html>","<title>","<body>"],"a":1},{"q":"Sabse badi heading dikhane ke liye kaunsa tag use hota hai?","o":["<h6>","<heading>","<h1>","<head>"],"a":2},{"q":"Line break dene ke liye kaunsa tag istemal hota hai?","o":["<lb>","<break>","<br>","<hr>"],"a":2},{"q":"HTML mein link (hyperlink) banane ke liye kaunsa tag use hota hai?","o":["<link>","<a>","<href>","<url>"],"a":1},{"q":"<a> tag mein link ka address dene ke liye kaunsa attribute use hota hai?","o":["src","link","href","alt"],"a":2},{"q":"Web page par image lagane ke liye kaunsa tag use hota hai?","o":["<pic>","<image>","<img>","<src>"],"a":2},{"q":"Image load na hone par text dikhane ke liye kaunsa attribute use hota hai?","o":["title","alt","src","text"],"a":1},{"q":"Numbered list (1, 2, 3...) banane ke liye kaunsa tag use hota hai?","o":["<ul>","<ol>","<li>","<dl>"],"a":1},{"q":"Bulleted list banane ke liye kaunsa tag use hota hai?","o":["<ol>","<ul>","<list>","<bl>"],"a":1},{"q":"Text ko bold karne ke liye HTML5 mein kaunsa semantic tag best mana jata hai?","o":["<bold>","<strong>","<big>","<em>"],"a":1},{"q":"Text ko italic karne ke liye kaunsa tag use hota hai?","o":["<italic>","<i>","<it>","<u>"],"a":1},{"q":"Horizontal line (seedhi rekha) khinchne ke liye kaunsa tag use hota hai?","o":["<line>","<hr>","<br>","<border>"],"a":1},{"q":"Web page ka background color badalne ke liye CSS se pehle kaunsa attribute use hota tha?","o":["color","bgcolor","background-color","bg"],"a":1},{"q":"Table mein ek row banane ke liye kaunsa tag use hota hai?","o":["<td>","<th>","<tr>","<table-row>"],"a":2},{"q":"Table ke andar heading cell banane ke liye kaunsa tag use hota hai?","o":["<td>","<th>","<thead>","<trh>"],"a":1},{"q":"Table mein do ya zyada columns ko jodne (merge karne) ke liye kaunsa attribute use hota hai?","o":["rowspan","colspan","merge","span"],"a":1},{"q":"Table mein do ya zyada rows ko jodne ke liye kaunsa attribute use hota hai?","o":["colspan","rowspan","rowmerge","verticalspan"],"a":1},{"q":"HTML mein comment likhne ka sahi tarika kaunsa hai?","o":["// comment","/* comment */","<!-- comment -->","<# comment #>"],"a":2},{"q":"Link ko naye tab (new tab) mein kholne ke liye target attribute ki value kya hoti hai?","o":["_new","_tab","_blank","_self"],"a":2},{"q":"Dropdown list banane ke liye kaunsa tag use hota hai?","o":["<input type=\"dropdown\">","<select>","<list>","<dropdown>"],"a":1},{"q":"Checkbox banane ke liye sahi HTML code kaunsa hai?","o":["<input type=\"check\">","<checkbox>","<input type=\"checkbox\">","<check>"],"a":2},{"q":"Text input field banane ke liye sahi tag kaunsa hai?","o":["<textfield>","<input type=\"text\">","<textinput>","<input type=\"textfield\">"],"a":1},{"q":"Form mein multi-line text input (bada box) dene ke liye kaunsa tag use hota hai?","o":["<input type=\"textarea\">","<textarea>","<textbox>","<multiline>"],"a":1},{"q":"HTML5 document type declare karne ka sahi tarika kya hai?","o":["<!DOCTYPE HTML5>","<!DOCTYPE html>","<DOCTYPE html>","<!HTML5>"],"a":1},{"q":"Web page par video chalane ke liye HTML5 ka kaunsa tag use hota hai?","o":["<media>","<movie>","<video>","<play>"],"a":2},{"q":"Audio file play karne ke liye HTML5 mein kaunsa tag hai?","o":["<sound>","<mp3>","<audio>","<music>"],"a":2},{"q":"Inmein se kaunsa ek Empty Tag (jiska closing tag nahi hota) hai?","o":["<p>","<div>","<br>","<h1>"],"a":2},{"q":"Web page ka title kahan likha jata hai?","o":["<body> section mein","<head> section mein","<footer> section mein","<html> ke bahar"],"a":1},{"q":"Ordered list ko Roman numbers (I, II, III) mein dikhane ke liye kaunsa attribute use hota hai?","o":["style=\"I\"","type=\"I\"","number=\"I\"","list=\"I\""],"a":1},{"q":"Chemical formula H2O likhne mein '2' ko niche lane ke liye kaunsa tag use hota hai?","o":["<sup>","<sub>","<down>","<below>"],"a":1},{"q":"Math power X² likhne mein '2' ko upar lane ke liye kaunsa tag use hota hai?","o":["<sub>","<sup>","<up>","<top>"],"a":1},{"q":"HTML files ka default extension kya hota hai?","o":[".ht",".html ya .htm",".web",".doc"],"a":1},{"q":"Radio button mein ek time par ek hi option select ho, iske liye sabhi inputs ka kaunsa attribute same hona chahiye?","o":["id","class","name","value"],"a":2},{"q":"Kisi input field ko bharna zaroori (mandatory) banane ke liye kaunsa attribute use hota hai?","o":["must","validate","required","important"],"a":2},{"q":"Input box ke andar halka hint text dikhane ke liye kaunsa attribute use hota hai?","o":["hint","placeholder","value","title"],"a":1},{"q":"HTML mein kitne levels ki headings hoti hain?","o":["3","5","6","8"],"a":2},{"q":"Ek web page ke andar doosra web page dikhane ke liye kaunsa tag use hota hai?","o":["<frame>","<iframe>","<embed>","<window>"],"a":1},{"q":"Text ko highlight (peele rang se mark) karne ke liye HTML5 mein kaunsa tag hai?","o":["<highlight>","<mark>","<span>","<yellow>"],"a":1},{"q":"Inmein se kaunsa Block-level element hai?","o":["<span>","<a>","<div>","<img>"],"a":2},{"q":"True ya False: HTML ek programming language hai.","o":["True","False"],"a":1},{"q":"True ya False: HTML tags case-sensitive hote hain (yani <P> aur <p> alag hain).","o":["True","False"],"a":1},{"q":"True ya False: <title> tag ka text browser ke tab par dikhai deta hai.","o":["True","False"],"a":0},{"q":"True ya False: <h1> sabse chhoti heading hoti hai.","o":["True","False"],"a":1},{"q":"True ya False: Ek hi page par ek se zyada <div> tag use kiye ja sakte hain.","o":["True","False"],"a":0},{"q":"True ya False: <br> tag ka closing tag </br> likhna zaroori hota hai.","o":["True","False"],"a":1},{"q":"True ya False: <span> ek inline element hai.","o":["True","False"],"a":0},{"q":"True ya False: Table mein <td> ka matlab \"Table Data\" hota hai.","o":["True","False"],"a":0},{"q":"True ya False: <ol> tag se bulleted list banti hai.","o":["True","False"],"a":1},{"q":"True ya False: HTML5 mein <marquee> tag ko officially hata (deprecate) diya gaya hai.","o":["True","False"],"a":0}]};
const OT_PHOTO = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/6xaJSlACEQAAAAEAABZ/anVtYgAAAB5qdW1kYzJwYQARABCAAACqADibcQNjMnBhAAAAFllqdW1iAAAAR2p1bWRjMm1hABEAEIAAAKoAOJtxA3VybjpjMnBhOjFhZTdjNzY2LWRlN2EtNDk0Mi05N2M0LTlkODE3MjAwMjM0MAAAAAOUanVtYgAAAClqdW1kYzJhcwARABCAAACqADibcQNjMnBhLmFzc2VydGlvbnMAAAAAuWp1bWIAAABEanVtZGNib3IAEQAQgAAAqgA4m3ETYzJwYS5pbmdyZWRpZW50LnYzAAAAABhjMnNoBUAxcSQRyCzPB+H+rjUUOAAAAG1jYm9yo2lkYzpmb3JtYXRqaW1hZ2UvanBlZ2ppbnN0YW5jZUlEeCx4bXA6aWlkOmMzMDg0NTVlLWYzMjQtNDg2NS1hOWNiLWU2NTZlMzBhZWFjY2xyZWxhdGlvbnNoaXBocGFyZW50T2YAAAHianVtYgAAAEFqdW1kY2JvcgARABCAAACqADibcRNjMnBhLmFjdGlvbnMudjIAAAAAGGMyc2ipcC6rxllrxd2kTr+cY3R6AAABmWNib3KiZ2FjdGlvbnOComZhY3Rpb25rYzJwYS5vcGVuZWRqcGFyYW1ldGVyc6FraW5ncmVkaWVudHOBomN1cmx4LXNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuaW5ncmVkaWVudC52M2RoYXNoWCDA6nmhNxgIIZrtWuqkjQIlXJcQeaTQz8E/7ZWaZaoBW6RmYWN0aW9ueB1jb20uYW50aHJvcGljLmNsYXVkZS5wcm92aWRlZGpwYXJhbWV0ZXJzoXgfY29tLmFudGhyb3BpYy5vcmlnaW4tY29uZmlkZW5jZWd1bmtub3dua2Rlc2NyaXB0aW9ueGZDbGF1ZGUgcHJvdmlkZWQgdGhpcyBmaWxlIGF0IHRoZSByZXF1ZXN0IG9mIGEgdXNlciBhbmQgbWF5IGhhdmUgY3JlYXRlZCBvciBtb2RpZmllZCB0aGUgZmlsZSBjb250ZW50cy5tc29mdHdhcmVBZ2VudKFkbmFtZWZDbGF1ZGVyYWxsQWN0aW9uc0luY2x1ZGVk9QAAAMhqdW1iAAAAQGp1bWRjYm9yABEAEIAAAKoAOJtxE2MycGEuaGFzaC5kYXRhAAAAABhjMnNosysyZCSbjNeuKBdK+1vZ5QAAAIBjYm9ypWNhbGdmc2hhMjU2Y3BhZE4AAAAAAAAAAAAAAAAAAGRoYXNoWCBg1iAhmd7mAW0vCFLlOz/iBOhfI/eruGpQMfylvVjVrGRuYW1lbmp1bWJmIG1hbmlmZXN0amV4Y2x1c2lvbnOBomVzdGFydBRmbGVuZ3RoGRaLAAACPmp1bWIAAAAnanVtZGMyY2wAEQAQgAAAqgA4m3EDYzJwYS5jbGFpbS52MgAAAAIPY2JvcqVjYWxnZnNoYTI1NmlzaWduYXR1cmV4TXNlbGYjanVtYmY9L2MycGEvdXJuOmMycGE6MWFlN2M3NjYtZGU3YS00OTQyLTk3YzQtOWQ4MTcyMDAyMzQwL2MycGEuc2lnbmF0dXJlamluc3RhbmNlSUR4LHhtcDppaWQ6Yzg1MWZjODAtODQ3My00NjE5LTkzYTAtODQ2MTcxNDA5ZGJicmNyZWF0ZWRfYXNzZXJ0aW9uc4OiY3VybHgtc2VsZiNqdW1iZj1jMnBhLmFzc2VydGlvbnMvYzJwYS5pbmdyZWRpZW50LnYzZGhhc2hYIMDqeaE3GAghmu1a6qSNAiVclxB5pNDPwT/tlZplqgFbomN1cmx4KnNlbGYjanVtYmY9YzJwYS5hc3NlcnRpb25zL2MycGEuYWN0aW9ucy52MmRoYXNoWCDSRzby3qomvwOLBiBh5OcQaPscoezT9OXIuLWrJWy8q6JjdXJseClzZWxmI2p1bWJmPWMycGEuYXNzZXJ0aW9ucy9jMnBhLmhhc2guZGF0YWRoYXNoWCAVMjIef629DP8Wg8jixTiBlmxoKU/lnyp3/cs0vMr46XRjbGFpbV9nZW5lcmF0b3JfaW5mb6NkbmFtZW9BbnRocm9waWMgRmlsZXNndmVyc2lvbmUxLjAuMGtzcGVjVmVyc2lvbmUyLjQuMAAAEDhqdW1iAAAAKGp1bWRjMmNzABEAEIAAAKoAOJtxA2MycGEuc2lnbmF0dXJlAAAAEAhjYm9y0oRZAhKiASYYIVkCCjCCAgYwggGNoAMCAQICFEDloAruwjnQvriD+gZCBT1nVRMAMAoGCCqGSM49BAMDMEkxFzAVBgNVBAoTDkFudGhyb3BpYywgUEJDMS4wLAYDVQQDEyVBbnRocm9waWMgQ29udGVudCBDcmVkZW50aWFscyBSb290IENBMB4XDTI2MDgwNzE4NDM1NloXDTI4MDgwNjE5NDM1NlowRDEXMBUGA1UEChMOQW50aHJvcGljLCBQQkMxKTAnBgNVBAMTIEFudGhyb3BpYyBDbGF1ZGUgQ29udGVudCBTaWduaW5nMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEmHoKa8tQGAUU1TS9QqU5W0Tp2N3XsvlK7BfQt6YWKwEzd2R3/dzKPEUDdCjlLjp9fT+KFjRVnuZ9v0oXvTe3k6NYMFYwDgYDVR0PAQH/BAQDAgeAMBUGA1UdJQQOMAwGCisGAQQBg+heAgEwDAYDVR0TAQH/BAIwADAfBgNVHSMEGDAWgBTOUeIEgU5kWyP448TPmj6cwddcwjAKBggqhkjOPQQDAwNnADBkAjAxcx0UngF60stVjs5G4T2eiptsBk5mf9oCtfJPAUBl8qs/PEXa8+gk1/X5QJ2DVcYCMHBfXN31YapiSqYvlIWrDVDJKOvXMl+kkz37Wt0PBI8sw486Mq6JeOhT+lRR4b1HCaFjcGFkWQ2eAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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';

(() => {
  'use strict';
  const TESTS = {
    'M1-R5': { sub: 'IT Tools & Network Basics', mins: 60, pass: 40, hash: 'jd7chc28h0' },
    'M2-R5': { sub: 'HTML Basics, Tags, Tables & Forms', mins: 35, pass: 25, hash: '1tuoda244v4' }
  };
  const HIST_PASS_HASH = '23ger5byzw1';
  const Q_SECS = 20;
  const K_SES = 'acec_ot_sessions_v1', K_HIS = 'acec_ot_history_v1';

  const $ = s => document.querySelector(s);
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cy = (str, seed = 0) => {
    let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) { ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  };
  const H = p => cy('acec|' + p);
  window.otHashPass = H;
  const jget = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const jset = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  const fmt = ms => { const s = Math.ceil(Math.max(0, ms) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const say = m => { if (typeof toast === 'function') toast(m); };
  const sessions = () => jget(K_SES, {});
  const saveSes = s => { const all = sessions(); all[s.key] = s; return jset(K_SES, all); };
  const history = () => jget(K_HIS, []);
  const normUser = u => u.trim().replace(/\s+/g, ' ');

  // ---- Login photo: purani image ki jagah apni photo ----
  document.querySelectorAll('.nm-photo').forEach(i => { i.src = OT_PHOTO; i.classList.add('ot-mine'); i.loading = 'eager'; i.alt = 'Sigma Boy - Access Computer Education Centre'; });

  const modal = $('#otModal'), box = $('#otBox');
  if (!modal || !box) return;
  let S = null, tick = null;

  const openM = () => modal.classList.add('open');
  const closeM = () => { modal.classList.remove('open'); stopTick(); S = null; };
  modal.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape' && !S) closeM(); });
  modal.addEventListener('keyup', e => e.stopPropagation());
  modal.addEventListener('keypress', e => e.stopPropagation());

  /* ---------------- finalize / submit ---------------- */
  function finalize(ses, auto) {
    const old = history().find(h => h.test === ses.test && h.userKey === ses.userKey);
    if (old) { ses.done = true; saveSes(ses); return old; }
    const T = TESTS[ses.test], qs = OT_BANK[ses.test];
    let score = 0; ses.ans.forEach((a, i) => { if (a === qs[i].a) score++; });
    const rec = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      user: ses.user, userKey: ses.userKey, test: ses.test, score, total: qs.length,
      pass: score >= T.pass, passMark: T.pass, ts: Date.now(), auto: !!auto, ans: ses.ans.slice()
    };
    const h = history(); h.push(rec); jset(K_HIS, h);
    ses.done = true; saveSes(ses);
    return rec;
  }
  function submit(auto) {
    if (!S) return;
    const rec = finalize(S, auto);
    stopTick(); S = null;
    if (modal.classList.contains('open')) showResult(rec);
    say(auto ? '⏰ Time khatam - test auto-submit ho gaya' : '✅ Test submit ho gaya');
  }
  function sweep() { // jo sessions ka time nikal chuka unhe submit kar do (tab band ho tab bhi)
    const all = sessions(), now = Date.now();
    Object.keys(all).forEach(k => { const s = all[k]; if (s && !s.done && now >= s.end && !(S && S.key === k)) finalize(s, true); });
  }
  sweep(); setInterval(sweep, 5000);

  /* ---------------- timers ---------------- */
  function stopTick() { if (tick) { clearInterval(tick); tick = null; } }
  function startTick() { stopTick(); tick = setInterval(onTick, 250); onTick(); }
  function onTick() {
    if (!S) return;
    const t = Date.now();
    if (t >= S.end) { submit(true); return; }
    if (t >= S.qStart + Q_SECS * 1000) { advance(); return; }
    paintTimers();
  }
  function advance() {
    const n = OT_BANK[S.test].length;
    if (S.cur < n - 1) { S.cur++; S.qStart = Date.now(); saveSes(S); renderTest(); }
    else submit(true);
  }
  function paintTimers() {
    if (!S) return;
    const clock = $('#otClock'), qs = $('#otQSec'), bar = $('#otQBar'), t = Date.now();
    const left = S.end - t, ql = Math.max(0, S.qStart + Q_SECS * 1000 - t);
    if (clock) { clock.textContent = fmt(left); clock.parentElement.classList.toggle('low', left < 300000); }
    if (qs) qs.textContent = Math.ceil(ql / 1000);
    if (bar) { bar.style.width = (ql / (Q_SECS * 1000) * 100) + '%'; bar.classList.toggle('low', ql <= 5000); }
  }

  /* ---------------- views ---------------- */
  function viewLogin(id) {
    const T = TESTS[id], n = OT_BANK[id].length;
    box.innerHTML =
      '<button type="button" class="ot-x" id="otX" aria-label="Close">&times;</button>' +
      '<form class="ot-login" id="otLoginForm" novalidate autocomplete="off">' +
      '<img class="ot-photo" src="' + OT_PHOTO + '" alt="Sigma Boy" width="112" height="112">' +
      '<h3 id="otTitle">' + esc(id) + ' Test Login</h3>' +
      '<p class="lead">' + esc(T.sub) + '</p>' +
      '<div class="ot-info"><span>📝 ' + n + ' questions</span><span>⏱ ' + T.mins + ' min</span><span>✅ Pass: ' + T.pass + '+ marks</span><span>🔒 1 attempt</span></div>' +
      '<div class="ot-field"><label for="otUser">Username *</label><input id="otUser" type="text" maxlength="30" placeholder="Apna naam / username" autocomplete="off" required></div>' +
      '<div class="ot-field"><label for="otPass">Test Password *</label><input id="otPass" type="password" placeholder="' + esc(id) + ' ka password" autocomplete="new-password" required></div>' +
      '<p class="ot-err" id="otErr" role="alert"></p>' +
      '<div class="ot-row"><button class="btn" type="submit">▶ Start / Resume Test</button><button class="btn ghost" type="button" id="otCancel">Cancel</button></div>' +
      '</form>';
    openM();
    $('#otX').onclick = $('#otCancel').onclick = closeM;
    $('#otLoginForm').onsubmit = e => { e.preventDefault(); doLogin(id); };
    setTimeout(() => { const u = $('#otUser'); if (u) u.focus(); }, 60);
  }

  function doLogin(id) {
    const T = TESTS[id], err = m => { $('#otErr').textContent = m; };
    const user = normUser($('#otUser').value), pw = $('#otPass').value;
    if (!user) return err('Username daalna zaroori hai.');
    if (user.length < 2) return err('Username kam se kam 2 akshar ka hona chahiye.');
    if (!/^[\p{L}\p{N} ._-]+$/u.test(user)) return err('Username me sirf letters, numbers, space, . _ - allowed hain.');
    if (!pw) return err('Test password daalna zaroori hai.');
    if (H(pw) !== T.hash) return err('❌ Galat test password. Test nahi khul sakta.');
    if (!jset('acec_ot_probe', 1)) return err('Browser storage band hai - test chalane ke liye isse on karein.');
    const userKey = user.toLowerCase(), key = id + '|' + userKey, n = OT_BANK[id].length, now = Date.now();

    const fin = history().find(h => h.test === id && h.userKey === userKey);
    if (fin) { say('ℹ️ Is username se test pehle hi ho chuka hai - result dikha rahe hain'); showResult(fin); return; }

    let ses = sessions()[key];
    if (ses && ses.done) return err('Is username ka attempt pura ho chuka hai.');
    if (ses) { // RESUME
      if (now >= ses.end) { showResult(finalize(ses, true)); return; }
      if (now - ses.qStart >= Q_SECS * 1000) {
        if (ses.cur < n - 1) { ses.cur++; ses.qStart = now; }
        else { showResult(finalize(ses, true)); return; }
      }
      say('▶ Test wahin se resume ho gaya jahan chhoda tha');
    } else {    // NEW
      ses = { key, user, userKey, test: id, start: now, end: now + T.mins * 60000, cur: 0, qStart: now, ans: Array(n).fill(-1), done: false };
    }
    if (!saveSes(ses)) return err('Progress save nahi ho paya - browser storage check karein.');
    S = ses; renderTest(); startTick();
  }

  function renderTest() {
    const T = TESTS[S.test], qs = OT_BANK[S.test], q = qs[S.cur], sel = S.ans[S.cur];
    const answered = S.ans.filter(a => a >= 0).length;
    box.innerHTML =
      '<button type="button" class="ot-x" id="otExit" aria-label="Exit (progress saved)" title="Exit - progress save rahega, timer chalta rahega">&times;</button>' +
      '<div class="ot-top"><div><h3 id="otTitle">' + esc(S.test) + '<small>' + esc(T.sub) + '</small></h3><div class="ot-user">👤 ' + esc(S.user) + '</div></div>' +
      '<div class="ot-clockbox"><span>Time left</span><b id="otClock">--:--</b></div></div>' +
      '<div class="ot-qmeta"><span>Question <b>' + (S.cur + 1) + '</b> / ' + qs.length + '</span><span>⏱ <b id="otQSec">' + Q_SECS + '</b>s</span></div>' +
      '<div class="ot-qbar"><i id="otQBar"></i></div>' +
      '<h4 class="ot-q">' + (S.cur + 1) + '. ' + esc(q.q) + '</h4>' +
      '<div class="ot-opts" id="otOpts">' + q.o.map((t, i) =>
        '<button type="button" class="ot-opt' + (sel === i ? ' sel' : '') + '" data-i="' + i + '"><b>' + 'ABCD'[i] + '</b><span>' + esc(t) + '</span></button>').join('') + '</div>' +
      '<div class="ot-nav"><button class="btn ghost sm" type="button" id="otPrev"' + (S.cur === 0 ? ' disabled' : '') + '>← Previous</button>' +
      '<span class="mid" id="otAns">Answered: ' + answered + ' / ' + qs.length + '</span>' +
      '<button class="btn sm" type="button" id="otNext"' + (S.cur === qs.length - 1 ? ' disabled' : '') + '>Next →</button></div>' +
      '<div class="ot-row" style="margin-top:14px"><button class="btn sm" type="button" id="otSubmit" style="background:linear-gradient(135deg,#22c55e,#16a34a)">✔ Submit Test</button></div>';
    $('#otExit').onclick = () => { stopTick(); S = null; closeM(); say('Progress save hai - dobara login karke resume karein (timer chalta rahega)'); };
    $('#otOpts').onclick = e => {
      const b = e.target.closest('.ot-opt'); if (!b || !S) return;
      S.ans[S.cur] = +b.dataset.i; saveSes(S);
      box.querySelectorAll('.ot-opt').forEach(x => x.classList.toggle('sel', x === b));
      $('#otAns').textContent = 'Answered: ' + S.ans.filter(a => a >= 0).length + ' / ' + qs.length;
    };
    $('#otPrev').onclick = () => { if (S.cur > 0) { S.cur--; S.qStart = Date.now(); saveSes(S); renderTest(); } };
    $('#otNext').onclick = () => { if (S.cur < qs.length - 1) { S.cur++; S.qStart = Date.now(); saveSes(S); renderTest(); } };
    $('#otSubmit').onclick = () => {
      const un = S.ans.filter(a => a < 0).length;
      if (confirm((un ? un + ' sawal abhi unanswered hain. ' : '') + 'Kya aap test submit karna chahte hain?')) submit(false);
    };
    paintTimers();
  }

  function thought(rec) {
    const T = TESTS[rec.test], s = rec.score, pct = Math.round(s / rec.total * 100);
    if (!rec.pass) {
      if (s >= Math.ceil(T.pass * 0.75)) return ['😔', 'Bas thodi si kami reh gayi!', 'Pass hone me sirf ' + (T.pass - s) + ' marks door the. Galat sawalon ka review karo, concepts revise karo - agli baar pakka pass hoge. 💪'];
      return ['🌱', 'Haar nahi maani jaati!', 'Ye score aakhri nahi hai. Har fail ek seekh hai - basics dobara padho, shortcut keys practice karo aur phir se koshish karo. Aap kar sakte ho!'];
    }
    if (pct >= 90) return ['🏆', 'Shandar! Aap topper ho!', 'Zabardast performance! Isi tarah mehnat karte raho - success aapke kadam choomegi.'];
    if (pct >= 75) return ['🌟', 'Bahut badhiya!', 'Aapki tayari kaafi mazboot hai. Thoda aur revision aur aap top score kar sakte ho.'];
    return ['✅', 'Pass ho gaye - badhai ho!', 'Aapne pass marks paar kar liye. Ab neeche galat jawab dekh kar unhe sudharo aur score aur badhao.'];
  }

  function showResult(rec) {
    stopTick(); S = null;
    const qs = OT_BANK[rec.test], th = thought(rec);
    const skipped = rec.ans.filter(a => a < 0).length, wrong = rec.total - rec.score - skipped;
    let rv = '';
    qs.forEach((q, i) => {
      const u = rec.ans[i], right = u === q.a;
      rv += '<div class="ot-rv ' + (right ? 'r' : 'w') + '"><h5>' + (i + 1) + '. ' + esc(q.q) + '</h5><ul>' +
        q.o.map((t, k) => {
          let c = '', tag = '';
          if (k === q.a) { c = 'ok'; tag = (u === k) ? '✔ Your answer (Correct)' : '✔ Correct answer'; }
          else if (k === u) { c = 'bad'; tag = '✘ Your answer (Wrong)'; }
          return '<li class="' + c + '"><span>' + 'ABCD'[k] + ') ' + esc(t) + '</span><em>' + tag + '</em></li>';
        }).join('') + '</ul>' + (u < 0 ? '<div class="skip">⚠ Not answered / skipped</div>' : '') + '</div>';
    });
    box.innerHTML =
      '<button type="button" class="ot-x" id="otX" aria-label="Close">&times;</button>' +
      '<div class="ot-res"><h3 id="otTitle">' + esc(rec.test) + ' - Result</h3>' +
      '<div class="ot-user">👤 ' + esc(rec.user) + ' · ' + new Date(rec.ts).toLocaleString('en-IN') + (rec.auto ? ' · ⏰ auto-submitted' : '') + '</div>' +
      '<div class="ot-score">' + rec.score + ' <small>/ ' + rec.total + '</small></div>' +
      '<span class="ot-badge ' + (rec.pass ? 'pass' : 'fail') + '">' + (rec.pass ? 'PASS' : 'FAIL') + '</span>' +
      '<div class="ot-stats"><span>✔ Correct <b>' + rec.score + '</b></span><span>✘ Wrong <b>' + wrong + '</b></span><span>⚠ Skipped <b>' + skipped + '</b></span><span>Pass marks <b>' + rec.passMark + '</b></span></div>' +
      '<div class="ot-thought"><b>' + th[0] + ' ' + th[1] + '</b><p>' + th[2] + '</p></div></div>' +
      '<h4 class="ot-review-h">📋 Answer Review (green = sahi, red = aapka galat jawab)</h4>' + rv +
      '<div class="ot-final">Final Total Score: ' + rec.score + ' / ' + rec.total + ' - ' + (rec.pass ? 'PASS ✅' : 'FAIL ❌') + '</div>' +
      '<div class="ot-row"><button class="btn" type="button" id="otHist">📜 History</button><button class="btn ghost" type="button" id="otClose">Close</button></div>';
    openM();
    $('#otX').onclick = $('#otClose').onclick = closeM;
    $('#otHist').onclick = () => viewHistPrompt();
    box.scrollTop = 0;
  }

  /* ---------------- History (password protected, NO delete) ---------------- */
  function viewHistPrompt() {
    box.innerHTML =
      '<button type="button" class="ot-x" id="otX" aria-label="Close">&times;</button>' +
      '<form class="ot-login" id="otHForm" novalidate autocomplete="off"><h3 id="otTitle">🔐 Test History</h3>' +
      '<p class="lead">History dekhne ke liye History Password daalein.</p>' +
      '<div class="ot-field"><label for="otHPass">History Password</label><input id="otHPass" type="password" autocomplete="new-password"></div>' +
      '<p class="ot-err" id="otErr" role="alert"></p>' +
      '<div class="ot-row"><button class="btn" type="submit">Unlock History</button><button class="btn ghost" type="button" id="otCancel">Cancel</button></div></form>';
    openM();
    $('#otX').onclick = $('#otCancel').onclick = closeM;
    $('#otHForm').onsubmit = e => {
      e.preventDefault();
      if (H($('#otHPass').value) !== HIST_PASS_HASH) { $('#otErr').textContent = '❌ Galat History Password.'; return; }
      viewHistory();
    };
    setTimeout(() => { const i = $('#otHPass'); if (i) i.focus(); }, 60);
  }
  function viewHistory() {
    const list = history().slice().sort((a, b) => b.ts - a.ts);
    const rows = list.map((r, i) =>
      '<tr><td>' + (i + 1) + '</td><td>' + esc(r.user) + '</td><td>' + esc(r.test) + '</td><td><b>' + r.score + '</b> / ' + r.total + '</td><td>' +
      Math.round(r.score / r.total * 100) + '%</td><td class="' + (r.pass ? 'p' : 'f') + '">' + (r.pass ? 'PASS' : 'FAIL') + '</td><td>' +
      new Date(r.ts).toLocaleString('en-IN') + '</td><td>' + (r.auto ? 'Auto (time up)' : 'Manual') + '</td></tr>').join('');
    box.innerHTML =
      '<button type="button" class="ot-x" id="otX" aria-label="Close">&times;</button>' +
      '<h3 id="otTitle">📜 Submitted Test History <small style="font-weight:500;color:var(--muted);font-size:.7em">(' + list.length + ' records · read-only)</small></h3>' +
      (list.length ? '<div class="ot-hwrap"><table class="ot-htbl"><thead><tr><th>#</th><th>Username</th><th>Test</th><th>Score</th><th>%</th><th>Result</th><th>Date &amp; Time</th><th>Submit</th></tr></thead><tbody>' + rows + '</tbody></table></div>'
        : '<p class="ot-note">Abhi koi test submit nahi hua.</p>') +
      '<div class="ot-row"><button class="btn" type="button" id="otCsv"' + (list.length ? '' : ' disabled') + '>⬇ Export CSV (backup)</button><button class="btn ghost" type="button" id="otClose">Close</button></div>';
    $('#otX').onclick = $('#otClose').onclick = closeM;
    $('#otCsv').onclick = () => {
      const q = v => '"' + String(v).replace(/"/g, '""') + '"';
      const csv = ['Username,Test,Score,Total,Result,DateTime,Submit'].concat(list.map(r =>
        [q(r.user), r.test, r.score, r.total, r.pass ? 'PASS' : 'FAIL', q(new Date(r.ts).toLocaleString('en-IN')), r.auto ? 'Auto' : 'Manual'].join(','))).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'online-test-history.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    };
  }

  /* ---------------- wiring (Online Test section buttons) ---------------- */
  document.addEventListener('click', e => {
    const s = e.target.closest && e.target.closest('[data-ot-start]');
    if (s) { e.preventDefault(); viewLogin(s.getAttribute('data-ot-start')); return; }
    const h = e.target.closest && e.target.closest('[data-ot-history]');
    if (h) { e.preventDefault(); viewHistPrompt(); }
  });
})();
