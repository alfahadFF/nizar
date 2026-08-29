/* =====================================================================
   AlfaProSys — أدوات مشتركة (app.js)
   تنقّل + تنسيق أرقام + توست + مودالات + حساب الصلاحية + إشعارات فورية
   ===================================================================== */

/* ============ إشعارات فورية بين الشاشات المفتوحة (BroadcastChannel) ============
   تعمل الآن بين كل التبويبات/الفروع المفتوحة على نفس الجهاز/المتصفح لحظيًا
   (مثال: فتح شاشة المخزون بفرعين في تبويبين، وإرسال تحويل من أحدهما يُصدر صوتًا وتنبيهًا في الآخر فورًا)
   لاحقًا مع Supabase Realtime: تُستبدل بقناة فعلية عبر الخادم تعمل بين أي أجهزة على الإنترنت ---- */
const APS_CHANNEL = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('aps_events') : null;
function broadcastAppEvent(type, payload){
  const msg = {type, payload, ts: Date.now(), rid: Math.random().toString(36).slice(2)};
  if(APS_CHANNEL){ try{ APS_CHANNEL.postMessage(msg); }catch(e){} }
  /* نسخة احتياطية عبر localStorage تعمل حتى في المتصفحات القديمة بدون BroadcastChannel */
  try{ localStorage.setItem('aps_last_event', JSON.stringify(msg)); }catch(e){}
}
function onAppEvent(handler){
  if(APS_CHANNEL){ APS_CHANNEL.addEventListener('message', e => handler(e.data)); }
  window.addEventListener('storage', e => {
    if(e.key === 'aps_last_event' && e.newValue){
      try{ handler(JSON.parse(e.newValue)); }catch(err){}
    }
  });
}

/* ---- صوت التنبيه: نغمة قصيرة تُولَّد مباشرة (بدون ملف صوتي خارجي) — تعمل أوفلاين ---- */
function playNotifSound(){
  try{
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(!Ctx) return;
    const ctx = new Ctx();
    const tone = (freq, start, dur) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
      gain.gain.exponentialRampToValueAtTime(0.22, ctx.currentTime + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(ctx.currentTime + start);
      osc.stop(ctx.currentTime + start + dur + 0.03);
    };
    tone(880, 0, 0.13);
    tone(1175, 0.15, 0.18);
    setTimeout(() => { try{ ctx.close(); }catch(e){} }, 500);
  }catch(e){}
}

/* ---- ربط الإشعارات الفورية بأي صفحة تحتوي جرس/قائمة تنبيهات ----
   استدعِها بعد initShell() في كل صفحة: initRealtimeNotifs()
   تُشغّل الصوت + توست عند وصول أي حدث، وتُحدّث نقطة الجرس وقائمة التنبيهات إن وُجدتا */
function initRealtimeNotifs(){
  onAppEvent(msg => {
    if(!msg || msg.type !== 'notification') return;
    /* الإشعار يخص هذه الوحدة إن كان عامًا، أو موجّهًا لها تحديدًا */
    const uid = (typeof activeUnitId === 'function') ? activeUnitId() : null;
    if(msg.payload.targetUnit && msg.payload.targetUnit !== 'all' && msg.payload.targetUnit !== uid) return;
    playNotifSound();
    showToast(msg.payload.title, msg.payload.icon || '🔔');
    const dot = document.querySelector('.bell-btn .bell-dot');
    if(dot){ dot.style.display = 'block'; dot.classList.remove('pulse'); void dot.offsetWidth; dot.classList.add('pulse'); }
    if(typeof renderNotifications === 'function') renderNotifications();
  });
  refreshBellDot();
}
function refreshBellDot(){
  const dot = document.querySelector('.bell-btn .bell-dot');
  if(dot) dot.style.display = (typeof unreadNotifCount === 'function' && unreadNotifCount() > 0) ? 'block' : 'none';
}
/* فتح جرس التنبيهات + تعليمها كمقروءة لهذه الوحدة */
function openNotifModal(){
  openModal('notifModal');
  if(typeof markAllNotifsRead === 'function') markAllNotifsRead();
  if(typeof renderNotifications === 'function') renderNotifications();
  refreshBellDot();
}

/* الشاشات (تُستخدم في التنقل السريع وصفحة "قيد البناء") */
const PAGES = {
  inventory:{label:'المخزون',    icon:'🏷️'},
  customers:{label:'العملاء',    icon:'👥'},
  cashbox:  {label:'الصندوق',    icon:'💰'},
  expiry:   {label:'الصلاحية',   icon:'⏳'},
  reports:  {label:'التقارير',   icon:'📊'},
  transfers:{label:'التحويلات',  icon:'🔄'},
  purchases:{label:'المشتريات',  icon:'🧾'}
};

/* ============ الهيكل المشترك: شريط علوي + تنقّل ============ */
function activeUnitId(){
  try {
    const urlUnit = new URLSearchParams(location.search).get('unit');
    if (urlUnit) return urlUnit;
    const stored = localStorage.getItem('aps_active_unit');
    if (stored) return stored;
    return (typeof CURRENT_UNIT_ID !== 'undefined' ? CURRENT_UNIT_ID : 'u2');
  } catch(e){
    return 'u2';
  }
}

function activeUnit(){
  const list = (typeof UNITS !== 'undefined' && Array.isArray(UNITS) && UNITS.length > 0) ? UNITS : [
    {id:'u1', name:'الإدارة العامة', type:'head'},
    {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
    {id:'u3', name:'أبو سارة 2', type:'branch'}
  ];
  return list.find(u => u.id === activeUnitId()) || list[1];
}

/* ============ حماية وصول موحّدة للشاشات الحصرية للإدارة (u1) ============
   تُستدعى بأول كل شاشة إدارية (dashboard/reports/settings/activity) مباشرة بعد
   حساب uid. إن لم تكن الوحدة الحالية إدارة تُستبدل الصفحة بالكامل برسالة "غير
   مصرح" واضحة (بدون location.replace التي قد تفشل بصمت داخل معاينات بلا تنقّل
   حقيقي) وتُرجع false ليتوقف باقي كود الصفحة عن الرسم.
   الحل الصحيح هنا ليس تحويل المستخدم لشاشة بيع بوحدة قد لا تخصه أصلًا (مثال:
   آخر جلسة كانت بحساب كاشير فرع، فلا معنى لتحويله تلقائيًا لبيع ذلك الفرع)،
   بل زر "تسجيل خروج" صريح يعيده لشاشة اختيار الوحدة (index.html) ليدخل بالحساب
   الصحيح من جديد — هذا هو المنطق السليم لحين تفعيل نظام دخول حقيقي بعد قاعدة البيانات. */
function enforceAdminOnly(pageLabel){
  const u = UNITS.find(x => x.id === activeUnitId()) || {};
  if(u.type === 'head') return true;
  const mount = document.getElementById('appPage') || document.body;
  mount.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;">
      <div class="card-box" style="text-align:center;padding:40px 20px;max-width:380px;">
        <div style="font-size:44px;margin-bottom:12px;">🚫</div>
        <h2 style="margin-bottom:6px;">غير مصرح بالدخول</h2>
        <div class="row-sub" style="margin-bottom:18px;">${esc(pageLabel || 'هذه الشاشة')} حصرية لحساب الإدارة فقط.<br>الحساب المسجَّل حاليًا: ${esc(u.name || 'غير معروف')}.</div>
        <button class="btn btn-gold btn-block" onclick="location.href='index.html'">🚪 تسجيل الخروج والدخول بحساب آخر</button>
      </div>
    </div>`;
  return false;
}
/* عناصر التنقل — تُضاف شاشة جديدة هنا فيُرتبط زرّها في كل الصفحات
   الإدارة (u1) صلاحية/دخول فقط بلا مخزون خاص بها، فلا تُعرض لها شاشات البيع المرتبطة مباشرة بفرع (البيع/تعديل فاتورة)،
   وتُعرض لها بدلًا منها لوحة التحكم الخاصة بها فقط */
function navItems(){
  const u = activeUnitId();
  const isHead = (UNITS.find(x => x.id === u) || {}).type === 'head';
  if(isHead){
    return [
      {key:'dashboard', label:'لوحة التحكم', icon:'🏠', href:`dashboard.html?unit=${u}`},
      {key:'reports',   label:'التقارير',    icon:'📊', href:`reports.html?unit=${u}`},
      {key:'inventory', label:'المخزون',      icon:'🏷️', href:`inventory.html?unit=${u}`},
      {key:'waste',     label:'الإتلاف',      icon:'🗑️', href:`waste.html?unit=${u}`},
      {key:'customers', label:'العملاء',      icon:'👥', href:`customers.html?unit=${u}`},
      {key:'suppliers', label:'الموردون',     icon:'🚚', href:`suppliers.html?unit=${u}`},
      {key:'cashbox',   label:'الصندوق',      icon:'💰', href:`cashbox.html?unit=${u}`},
      {key:'activity',  label:'سجل النشاط',   icon:'📜', href:`activity.html?unit=${u}`},
      {key:'settings',  label:'الإعدادات',    icon:'⚙️', href:`settings.html?unit=${u}`}
    ];
  }
  return [
    {key:'pos',       label:'البيع',        icon:'🧾', href:`pos.html?unit=${u}`},
    {key:'editinv',   label:'تعديل فاتورة', icon:'✏️', href:`pos.html?unit=${u}&action=edit`},
    {key:'inventory', label:'المخزون',      icon:'🏷️', href:`inventory.html?unit=${u}`},
    {key:'waste',     label:'الإتلاف',      icon:'🗑️', href:`waste.html?unit=${u}`},
    {key:'customers', label:'العملاء',      icon:'👥', href:`customers.html?unit=${u}`},
    {key:'suppliers', label:'الموردون',     icon:'🚚', href:`suppliers.html?unit=${u}`},
    {key:'cashbox',   label:'الصندوق',      icon:'💰', href:`cashbox.html?unit=${u}`}
  ];
}
function renderShellNav(activeKey){
  const items = navItems();
  const selfTag = (it) => it.key === activeKey && (typeof navHome === 'function');
  const side = document.getElementById('sideNav');
  if(side){
    side.innerHTML = items.map(it => {
      const cls = `side-item ${it.key===activeKey ? 'active' : ''}`;
      const inner = `<span class="side-ic">${it.icon}</span><span class="side-lb">${it.label}</span>`;
      return selfTag(it) ? `<button class="${cls}" onclick="navHome(); closeSideNav();">${inner}</button>`
                         : `<a class="${cls}" href="${it.href}" onclick="closeSideNav();">${inner}</a>`;
    }).join('');
  }
}

function renderTopbar(subtitle){
  const tb = document.getElementById('topbar');
  if(!tb) return;
  const bell = document.getElementById('notifModal')
    ? `<button class="bell-btn" onclick="openNotifModal()">🔔<span class="bell-dot"></span></button>`
    : '';
  const u = activeUnit();
  const isHead = u && u.type === 'head';
  /* "وردية مفتوحة" مفهوم خاص بالكاشير بالفروع فقط — لا معنى له لحساب الإدارة، فيُستبدل هناك بشارة الدور */
  const statusChip = isHead
    ? `<span class="shift-chip" style="background:var(--gold-soft);color:var(--gold-deep);">👑<span class="shift-txt">حساب الإدارة</span></span>`
    : `<span class="shift-chip"><span class="shift-dot"></span><span class="shift-txt">وردية مفتوحة</span></span>`;
  tb.innerHTML = `
    <div class="topbar-left">
      <button class="nav-toggle" onclick="toggleNav()" title="إظهار/إخفاء القائمة">☰</button>
      <button class="home-btn" onclick="logoutUnit()" title="تسجيل الخروج والعودة لشاشة اختيار الوحدة">🚪</button>
      <div class="streak-mark streak-sm"><span></span><span></span><span></span></div>
      <div>
        <div class="brand-name" style="font-size:15px;">AlfaProSys</div>
        <div class="brand-sub">${esc(subtitle || '')}</div>
      </div>
      <span class="unit-chip" onclick="promptBranchSwitch()" style="cursor:pointer;" title="اضغط للتبديل بين الفروع">${esc(u ? u.name : '')} 🔄</span>
    </div>
    <div class="topbar-right">
      ${statusChip}
      ${bell}
    </div>`;
}
/* تسجيل الخروج — توجيه مباشر لشاشة اختيار الوحدة (index.html)، أي خروج فعلي من الجلسة الحالية
   بضغطة واحدة، متاح دائمًا بكل شاشة بغض النظر عن نوع الحساب الحالي (إدارة أو فرع). */
function logoutUnit(){
  location.href = 'index.html';
}
/* اسم قديم محفوظ للتوافق فقط في حال استُدعي من كود سابق */
function goHome(){ logoutUnit(); }
function toggleNav(){
  const page = document.getElementById('appPage');
  if(!page) return;
  page.classList.toggle('side-open');
}
function closeSideNav(){
  const page = document.getElementById('appPage');
  if(page) page.classList.remove('side-open');
}
function initShell(){
  /* القائمة الجانبية دائمًا مخفية عند تحميل الصفحة — لا تُستعاد حالة "مفتوحة" بين الصفحات */
  const page = document.getElementById('appPage');
  if(page) page.classList.remove('side-open');

  /* أسفل القائمة الجانبية: شارة تعكس نوع الحساب الفعلي الحالي (إدارة أو فرع) — بدل نص ثابت خاطئ بكل ملف */
  const foot = document.getElementById('sideFoot');
  if(foot){
    const u = activeUnit();
    foot.innerHTML = (u && u.type === 'head')
      ? `<span class="unit-chip" style="width:100%;justify-content:center;">👑 حساب الإدارة</span>`
      : `<span class="shift-chip" style="width:100%;justify-content:center;"><span class="shift-dot"></span><span class="shift-txt">وردية مفتوحة</span></span>`;
  }

  /* طبقة تعتيم خلف القائمة الجانبية — تُضاف تلقائيًا مرة واحدة، والضغط عليها يُغلق القائمة */
  if(page && !document.querySelector('.sidebar-backdrop')){
    const backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.onclick = closeSideNav;
    page.appendChild(backdrop);
  }
  /* زر إغلاق (✕) أعلى القائمة الجانبية نفسها */
  const brand = document.querySelector('.side-brand');
  if(brand && !brand.querySelector('.side-close')){
    const btn = document.createElement('button');
    btn.className = 'side-close';
    btn.title = 'إغلاق القائمة';
    btn.textContent = '✕';
    btn.onclick = closeSideNav;
    brand.appendChild(btn);
  }
  /* زر Esc يُغلق القائمة أيضًا */
  document.addEventListener('keydown', e => { if(e.key === 'Escape') closeSideNav(); });
}

const ROLES = {
  owner:{label:'مدير عام',     icon:'👑', desc:'كل الصلاحيات',   page:'coming.html'},
  branch_manager:{label:'مدير فرع', icon:'🏬', desc:'فرعه بالكامل', page:'coming.html'},
  cashier:{label:'كاشير',      icon:'🧾', desc:'بيع ومرتجعات',  page:'pos.html'},
  warehouse_keeper:{label:'أمين مستودع', icon:'📦', desc:'مخزون وتحويلات', page:'coming.html'}
};

/* ---- تسجيل الدخول (تجريبي: اختيار الدور) ---- */
function login(role){
  if(!ROLES[role]) return;
  try{ localStorage.setItem('aps_role', role); }catch(e){}
  location.href = ROLES[role].page + (ROLES[role].page === 'coming.html' ? '?role=' + role : '');
}
function currentRole(){
  try{ return localStorage.getItem('aps_role') || 'cashier'; }catch(e){ return 'cashier'; }
}

/* ---- تنسيق الأرقام (لاتينية) ---- */
function fmt(n){ return Number(n || 0).toLocaleString('en-US') + ' ل.س'; }
function fmtNum(n){ return Number(n || 0).toLocaleString('en-US'); }

/* ---- حماية من حقن HTML في المدخلات ---- */
function esc(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---- تطبيع النص العربي للبحث (يُستخدم في كل شاشات البحث: البيع، المخزون، الإتلاف، الفاتورة) ----
   يوحّد صور الحروف المتقاربة التي يكتبها المستخدم بأشكال مختلفة فيبدو له البحث "عشوائيًا" لو لم تُوحَّد:
   أ/إ/آ/ٱ → ا | ة → ه | ى → ي | يُزيل التشكيل | يُهمل المسافات الزائدة */
/* ---- تطبيع النص العربي للبحث والتطابق الذكي ---- */
function normalizeAr(s){
  if(!s) return '';
  return String(s)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripAl(word) {
  if (!word) return '';
  if (word.startsWith('ال') && word.length > 2) {
    return word.slice(2);
  }
  return word;
}

function matchSingleWord(hW, qW) {
  if (!hW || !qW) return false;
  if (hW.startsWith(qW)) return true;
  
  const cleanH = stripAl(hW);
  const cleanQ = stripAl(qW);
  if (cleanH.startsWith(cleanQ)) return true;

  return false;
}

function fuzzyIncludes(hay, q){
  if (!hay) return false;
  if (!q) return true;
  const normHay = normalizeAr(String(hay));
  const normQ = normalizeAr(String(q));
  if (!normQ) return true;

  const qWords = normQ.split(/\s+/).filter(Boolean);
  const hayWords = normHay.split(/\s+/).filter(Boolean);

  return qWords.every(qW => {
    return hayWords.some(hW => matchSingleWord(hW, qW));
  });
}

function sortSearchResults(list, q, keyFn) {
  if (!q || !list) return list;
  const normQ = normalizeAr(q);
  const cleanQ = stripAl(normQ);

  return list.slice().sort((a, b) => {
    const nameA = normalizeAr(keyFn ? keyFn(a) : (a.name || a));
    const nameB = normalizeAr(keyFn ? keyFn(b) : (b.name || b));

    const aStart = nameA.startsWith(normQ) || stripAl(nameA).startsWith(cleanQ);
    const bStart = nameB.startsWith(normQ) || stripAl(nameB).startsWith(cleanQ);

    if (aStart && !bStart) return -1;
    if (!aStart && bStart) return 1;
    return 0;
  });
}


/* ---- التوست ---- */
function showToast(msg, icon){
  const t = document.getElementById('toast');
  if(!t) return;
  t.innerHTML = `<span>${icon || '✅'}</span><span>${esc(msg)}</span>`;
  t.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ---- المودالات ---- */
function openModal(id){ const m = document.getElementById(id); if(m) m.classList.add('show'); }
function closeModal(id){ const m = document.getElementById(id); if(m) m.classList.remove('show'); }

/* ---- حساب الصلاحية (بالتاريخ الفعلي) ---- */
function daysUntil(dateStr){
  if(!dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const d = new Date(dateStr); d.setHours(0,0,0,0);
  return Math.round((d - today) / 86400000);
}
function expiryList(){
  const threshold = (typeof APP_SETTINGS !== 'undefined' && APP_SETTINGS.expiryAlertDays) || 20;
  return products.filter(p => p.expiry)
    .map(p => ({...p, days: daysUntil(p.expiry)}))
    .filter(p => p.days <= threshold)
    .sort((a,b) => a.days - b.days);
}

/* ---- التاريخ والوقت الآن ---- */
function nowStr(){
  const d = new Date();
  const p = n => String(n).padStart(2,'0');
  return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* =====================================================================
   قارئ الباركود — مشترك بين كل الشاشات (شاشة البيع + إضافة/تعديل صنف بالمخزون)
   طريقتان فعليتان مدعومتان:
   1) ماسح باركود خارجي USB/بلوتوث: يعمل تلقائيًا بأي حقل نص عادي بدون أي كود إضافي —
      لأن هذه الماسحات تتصرف كلوحة مفاتيح فعلية (تكتب الرقم بسرعة ثم Enter)
   2) كاميرا الجهاز (جوال/كمبيوتر): عبر واجهة BarcodeDetector المتصفحية الأصلية — بدون أي مكتبة خارجية
      ⚠️ غير مدعومة حاليًا على Safari/iPhone (لا يوفر المتصفح BarcodeDetector) —
      البديل هناك تلقائيًا: ماسح خارجي USB/بلوتوث، أو الكتابة اليدوية
   الاستخدام: startBarcodeScan(function(code){ ... }) من أي شاشة — تُغلق تلقائيًا بعد أول قراءة ناجحة
   ===================================================================== */
let _bcStream = null, _bcDetector = null, _bcRAF = null, _bcCallback = null;

function barcodeCameraSupported(){
  return ('BarcodeDetector' in window) && !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
}
function ensureScannerModal(){
  if(document.getElementById('bcModal')) return;
  const div = document.createElement('div');
  div.className = 'modal-overlay';
  div.id = 'bcModal';
  div.innerHTML = `
    <div class="modal-card">
      <div class="modal-head"><h3>📷 مسح الباركود بالكاميرا</h3><button class="modal-close" onclick="stopBarcodeScan()">✕</button></div>
      <div class="scanner-view" id="bcView">
        <video id="bcVideo" autoplay playsinline muted></video>
        <div class="scanner-frame"><div class="scan-line"></div></div>
        <div class="scanner-hint">وجّه الكاميرا نحو الباركود</div>
      </div>
      <div class="row-sub" id="bcFallback" style="display:none;text-align:center;margin-bottom:8px;">
        قراءة الكاميرا غير مدعومة على هذا المتصفح (مثل آيفون Safari حاليًا) — استخدم ماسح باركود خارجي USB/بلوتوث (يعمل تلقائيًا بأي حقل)، أو أدخل الرقم يدويًا.
      </div>
    </div>`;
  document.body.appendChild(div);
}
/* يفتح الكاميرا ويستدعي onResult(code) بمجرد قراءة أول باركود بنجاح، ثم يغلق نفسه تلقائيًا */
function startBarcodeScan(onResult){
  ensureScannerModal();
  _bcCallback = onResult;
  openModal('bcModal');
  const fallback = document.getElementById('bcFallback');
  const view = document.getElementById('bcView');
  if(!barcodeCameraSupported()){
    view.style.display = 'none';
    fallback.style.display = 'block';
    return;
  }
  view.style.display = 'flex';
  fallback.style.display = 'none';
  navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}})
    .then(stream => {
      _bcStream = stream;
      const video = document.getElementById('bcVideo');
      video.srcObject = stream;
      _bcDetector = new window.BarcodeDetector({formats:['ean_13','ean_8','upc_a','upc_e','code_128','code_39','qr_code']});
      _bcScanLoop();
    })
    .catch(() => {
      view.style.display = 'none';
      fallback.style.display = 'block';
      fallback.innerText = 'تعذّر الوصول إلى الكاميرا — تحقّق من إذن الكاميرا بالمتصفح، أو استخدم ماسحًا خارجيًا/الإدخال اليدوي.';
    });
}
function _bcScanLoop(){
  const modal = document.getElementById('bcModal');
  if(!_bcDetector || !modal || !modal.classList.contains('show')) return;
  const video = document.getElementById('bcVideo');
  if(video && video.readyState >= 2){
    _bcDetector.detect(video).then(codes => {
      if(codes && codes.length > 0){
        const val = codes[0].rawValue;
        stopBarcodeScan();
        if(_bcCallback) _bcCallback(val);
        return;
      }
      _bcRAF = requestAnimationFrame(_bcScanLoop);
    }).catch(() => { _bcRAF = requestAnimationFrame(_bcScanLoop); });
  } else {
    _bcRAF = requestAnimationFrame(_bcScanLoop);
  }
}
function stopBarcodeScan(){
  closeModal('bcModal');
  if(_bcRAF) cancelAnimationFrame(_bcRAF);
  _bcRAF = null;
  if(_bcStream){ _bcStream.getTracks().forEach(t => t.stop()); _bcStream = null; }
  _bcDetector = null;
}


/* ============ نظام الدخول وتأكيد الهوية برمز PIN للفروع والإدارة ============ */
const DEFAULT_UNIT_PINS = { u1: '1111', u2: '2222', u3: '3333' };

function getUnitPins() {
  try {
    const raw = localStorage.getItem('aps_unit_pins');
    if (raw) return Object.assign({}, DEFAULT_UNIT_PINS, JSON.parse(raw));
  } catch(e){}
  return Object.assign({}, DEFAULT_UNIT_PINS);
}

function getUnitPin(uid) {
  const pins = getUnitPins();
  return pins[uid] || DEFAULT_UNIT_PINS[uid] || '1111';
}

function setUnitPin(uid, newPin) {
  const pins = getUnitPins();
  pins[uid] = newPin.toString().trim();
  try {
    localStorage.setItem('aps_unit_pins', JSON.stringify(pins));
  } catch(e){}
}

function verifyUnitPin(uid, pinInput) {
  if (!pinInput) return false;
  const cleanInput = pinInput.toString().trim();
  const targetPin = getUnitPin(uid).toString().trim();
  const masterPin = getUnitPin('u1').toString().trim(); // Master Admin PIN (1111)
  
  return cleanInput === targetPin || cleanInput === masterPin;
}

function promptUnitPin(uid, onSuccess) {
  const list = (typeof UNITS !== 'undefined' && Array.isArray(UNITS) && UNITS.length > 0) ? UNITS : [
    {id:'u1', name:'الإدارة العامة', type:'head'},
    {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
    {id:'u3', name:'أبو سارة 2', type:'branch'}
  ];
  const u = list.find(x => x.id === uid) || { id: uid, name: uid, type: 'branch' };

  let modal = document.getElementById('pinAuthModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'pinAuthModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  let enteredDigits = "";

  if (!document.getElementById('pinDotStyle')) {
    const style = document.createElement('style');
    style.id = 'pinDotStyle';
    style.innerHTML = `
      .pin-dot {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 2px solid var(--line-hi);
        background: transparent;
        transition: all 0.15s ease;
      }
      .pin-dot.filled {
        background: var(--gold-strong);
        border-color: var(--gold-strong);
        box-shadow: 0 0 8px rgba(212, 175, 55, 0.5);
      }
    `;
    document.head.appendChild(style);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:380px;text-align:center;padding:26px 24px;border-radius:16px;">
      <div style="font-size:36px;margin-bottom:8px;">🔒</div>
      <h3 style="font-family:'Changa',sans-serif;font-size:18px;margin-bottom:4px;color:var(--gold-dark);">رمز الدخول المطلوب</h3>
      <div style="font-size:13px;color:var(--muted);margin-bottom:20px;">
        ${u.type === 'head' ? '🏢' : '🏬'} <strong>${esc(u.name)}</strong>
      </div>

      <div id="pinDotsDisplay" style="display:flex;justify-content:center;gap:14px;margin-bottom:18px;">
        <span class="pin-dot" id="pDot0"></span>
        <span class="pin-dot" id="pDot1"></span>
        <span class="pin-dot" id="pDot2"></span>
        <span class="pin-dot" id="pDot3"></span>
      </div>

      <div id="pinErrMsg" style="color:var(--rose-strong);font-size:12px;font-weight:700;min-height:22px;margin-bottom:12px;"></div>

      <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;max-width:260px;margin:0 auto 20px auto;">
        ${[1,2,3,4,5,6,7,8,9].map(n => `
          <button type="button" class="btn btn-ghost" style="font-size:20px;font-weight:700;height:48px;border-radius:10px;border:1px solid var(--line);" onclick="appendPinDigit('${n}')">${n}</button>
        `).join('')}
        <button type="button" class="btn btn-ghost" style="font-size:14px;font-weight:700;height:48px;border-radius:10px;border:1px solid var(--line);color:var(--rose-strong);" onclick="clearPinDigits()">مسح</button>
        <button type="button" class="btn btn-ghost" style="font-size:20px;font-weight:700;height:48px;border-radius:10px;border:1px solid var(--line);" onclick="appendPinDigit('0')">0</button>
        <button type="button" class="btn btn-gold" style="font-size:18px;font-weight:700;height:48px;border-radius:10px;" onclick="submitPinCheck()">✓</button>
      </div>

      <div style="display:flex;gap:10px;">
        <button type="button" class="btn btn-ghost btn-block" onclick="closePinModal()">إلغاء</button>
        <button type="button" class="btn btn-gold btn-block" onclick="submitPinCheck()">دخول 🚀</button>
      </div>
    </div>
  `;

  modal.style.display = 'flex';

  const updatePinDots = () => {
    for (let i = 0; i < 4; i++) {
      const dot = document.getElementById(`pDot${i}`);
      if (dot) {
        dot.classList.toggle('filled', i < enteredDigits.length);
      }
    }
  };

  window.appendPinDigit = (digit) => {
    if (enteredDigits.length < 6) {
      enteredDigits += digit;
      updatePinDots();
      const errEl = document.getElementById('pinErrMsg');
      if (errEl) errEl.innerText = "";
      if (enteredDigits.length >= 4) {
        window.submitPinCheck();
      }
    }
  };

  window.clearPinDigits = () => {
    enteredDigits = "";
    updatePinDots();
    const errEl = document.getElementById('pinErrMsg');
    if (errEl) errEl.innerText = "";
  };

  window.closePinModal = () => {
    modal.style.display = 'none';
  };

  window.submitPinCheck = () => {
    if (!enteredDigits) {
      const errEl = document.getElementById('pinErrMsg');
      if (errEl) errEl.innerText = "يرجى إدخال الرمز المكون من 4 أرقام";
      return;
    }

    if (verifyUnitPin(uid, enteredDigits)) {
      try { localStorage.setItem('aps_active_unit', uid); } catch(e){}
      modal.style.display = 'none';
      if (typeof onSuccess === 'function') {
        onSuccess(uid);
      }
    } else {
      const errEl = document.getElementById('pinErrMsg');
      if (errEl) errEl.innerText = "❌ الرمز غير صحيح، حاول مجدداً!";
      enteredDigits = "";
      updatePinDots();
    }
  };

  updatePinDots();

  const keyHandler = (e) => {
    if (modal.style.display === 'flex') {
      if (e.key >= '0' && e.key <= '9') {
        window.appendPinDigit(e.key);
      } else if (e.key === 'Backspace') {
        enteredDigits = enteredDigits.slice(0, -1);
        updatePinDots();
        const errEl = document.getElementById('pinErrMsg');
        if (errEl) errEl.innerText = "";
      } else if (e.key === 'Enter') {
        window.submitPinCheck();
      } else if (e.key === 'Escape') {
        window.closePinModal();
      }
    }
  };
  window.addEventListener('keydown', keyHandler, { once: true });
}

function promptBranchSwitch() {
  const current = activeUnitId();
  const list = (typeof UNITS !== 'undefined' && Array.isArray(UNITS) && UNITS.length > 0) ? UNITS : [
    {id:'u1', name:'الإدارة العامة', type:'head'},
    {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
    {id:'u3', name:'أبو سارة 2', type:'branch'}
  ];

  let modal = document.getElementById('unitSwitchModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'unitSwitchModal';
    modal.className = 'modal-overlay';
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="modal-card" style="max-width:400px;padding:24px;">
      <div class="modal-head">
        <h3>🔄 التبديل إلى فرع أو وحدة عمل أخرى</h3>
        <button class="modal-close" onclick="document.getElementById('unitSwitchModal').style.display='none'">✕</button>
      </div>
      <div style="font-size:12px;color:var(--muted);margin-bottom:16px;">اختر الفرع المطلوب وادخل الرمز للانتقال الفوري</div>
      
      <div style="display:flex;flex-direction:column;gap:10px;">
        ${list.map(u => `
          <div class="card-box" style="margin:0;cursor:pointer;display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border:${u.id === current ? '2px solid var(--gold-strong)' : '1px solid var(--line)'};" onclick="switchUnitWithPin('${u.id}')">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:24px;">${u.type === 'head' ? '🏢' : '🏬'}</span>
              <div>
                <div style="font-weight:700;font-size:14px;color:var(--text);">${esc(u.name)}</div>
                <div style="font-size:11px;color:var(--muted);">${u.type === 'head' ? 'لوحة التحكم الإدارية' : 'نقطة البيع والمخزون'}</div>
              </div>
            </div>
            ${u.id === current ? '<span class="badge badge-gold">الحالي</span>' : '<button class="btn btn-ghost btn-sm">دخول 🔒</button>'}
          </div>
        `).join('')}
      </div>
    </div>
  `;

  window.switchUnitWithPin = (targetUid) => {
    document.getElementById('unitSwitchModal').style.display = 'none';
    if (targetUid === current) return;
    promptUnitPin(targetUid, (uid) => {
      const u = list.find(x => x.id === uid) || {};
      const targetPage = u.type === 'head' ? 'dashboard.html' : 'pos.html';
      location.href = `${targetPage}?unit=${uid}`;
    });
  };

  modal.style.display = 'flex';
}
