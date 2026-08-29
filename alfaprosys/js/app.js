/* =====================================================================
   AlfaProSys — طبقة البيانات (data.js)
   ===================================================================== */

const SUPABASE_URL = "https://gadcgzgxwwvmowqktyfu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdhZGNnemd4d3d2bW93cWt0eWZ1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY4NTU3NjgsImV4cCI6MjEwMjQzMTc2OH0.eSIBKuQADnmHxqrHHqQR_EtsC18cTp_6bwYjqxp6H9g";

async function supabaseFetch(endpoint, options = {}) {
  try {
    const headers = {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    };
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, { ...options, headers });
    if (!res.ok) {
      const errorText = await res.text();
      console.warn(`⚠️ Supabase ${res.status} على ${endpoint}:`, errorText);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("❌ خطأ الاتصال بـ Supabase:", err);
    return null;
  }
}

/* ---- الوحدات ---- */
const UNITS = [
  {id:'u1', name:'الإدارة العامة', type:'head'},
  {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
  {id:'u3', name:'أبو سارة 2', type:'branch'}
];

const BRANCH_CODES = {
  u1: 'HEAD',
  u2: 'B01',
  u3: 'B02'
};

const LOCATIONS_MAP = {
  u2: 'c30c9fbf-adf8-4af8-a5bc-2d20efc389f3',
  u3: '6282c62f-6358-454b-a7b3-a31464f399ba'
};

function warehouseUnits() {
  return UNITS.filter(u => u.type === 'branch');
}

/* ✅ دالة مساعدة للحصول على الوحدة النشطة */
function getActiveUnit() {
  if (typeof window !== 'undefined' && typeof window.activeUnitId === 'function') {
    return window.activeUnitId();
  }
  return 'u2';
}

function activeLocationUuid() {
  const u = getActiveUnit();
  return LOCATIONS_MAP[u] || LOCATIONS_MAP['u2'];
}

/* ---- تسلسل أرقام الفواتير ---- */
function getBranchInvoiceSeq(branchId) {
  const b = branchId || getActiveUnit();
  try {
    const saved = localStorage.getItem('aps_inv_seq_' + b);
    if (saved) return parseInt(saved, 10);
  } catch(e) {}
  return 2026;
}

function incrementBranchInvoiceSeq(branchId) {
  const b = branchId || getActiveUnit();
  const current = getBranchInvoiceSeq(b);
  const next = current + 1;
  try {
    localStorage.setItem('aps_inv_seq_' + b, next);
  } catch(e) {}
  return next;
}

/* ---- التصنيفات ---- */
let MAIN_CATS = [
  'مواد تموينية',
  'مشروبات وعصائر',
  'ألبان وأجبان',
  'حلويات وتسالي',
  'معلبات ومحفوظات',
  'منظفات ومستلزمات منزلية',
  'عناية شخصية',
  'لحوم ومجمدات'
];

let SUB_CATS = {
  'مواد تموينية': ['حبوب وبقوليات', 'أرز وسكر وملح', 'زيوت وسمن', 'معكرونة وشعيرية', 'إندومي ونودلز', 'دبس وعسل ومربى', 'طحينة وحلاوة', 'بهارات وتوابل', 'خبز ومخبوزات', 'تمور'],
  'مشروبات وعصائر': ['مشروبات غازية', 'عصائر طازجة ومعلبة', 'مياه معدنية', 'شاي وقهوة', 'مشروبات طاقة', 'مشروبات شعير'],
  'ألبان وأجبان': ['حليب طازج ومجفف', 'أجبان متنوعة', 'ألبان ولبنة', 'قشطة وزبدة'],
  'حلويات وتسالي': ['بسكويت وويفر', 'شوكولاتة', 'مقرمشات وشيبس', 'مكسرات', 'حلويات شعبية'],
  'معلبات ومحفوظات': ['تونة وسردين', 'معلبات خضار وبقوليات', 'صلصة طماطم وكاتشب', 'مخللات وأغذية محفوظة'],
  'منظفات ومستلزمات منزلية': ['منظفات أطباق', 'مساحيق غسيل', 'منظفات أرضيات وحمامات', 'مطهرات ومعقمات', 'أكياس وورقيات'],
  'عناية شخصية': ['صابون وشامبو', 'معجون وأسنان', 'كريمات وعناية بالبشرة'],
  'لحوم ومجمدات': ['لحوم ودواجن مجمدة', 'دجاج ومرقة', 'أسماك ومأكولات بحرية', 'خضروات مجمدة']
};

let BRANDS = ['الشعلان', 'عافية', 'بيبسي', 'نستله', 'كولجيت-بالموليف', 'المراعي'];
const ORIGINS = ['سوري', 'أردني', 'سعودي', 'تركي', 'لبناني', 'مصري', 'غير محدد'];
const SALE_UNITS = ['قطعة', 'كيس', 'علبة', 'كرتون', 'قنينة', 'كغ (وزن مفكوك)'];

/* ---- البيانات ---- */
let products = [];
let customers = [];
let suppliers = [];
let invoices = [];
let wasteLog = [];
let purchases = [];
let transfers = [];
let cashboxTx = [];
let notifications = [];
let auditLog = [];

/* ---- مزامنة Supabase ---- */
async function syncSupabaseData() {
  try {
    console.log("🔄 بدء المزامنة مع Supabase...");

    // 1. جلب المخزون
    const dbInv = await supabaseFetch("inventory?select=*");
    const stockByProductLoc = {};
    if (dbInv && dbInv.length > 0) {
      dbInv.forEach(row => {
        if (!stockByProductLoc[row.product_id]) stockByProductLoc[row.product_id] = {};
        stockByProductLoc[row.product_id][row.location_id] = row.quantity;
      });
    }

    // 2. جلب المنتجات
    const dbProds = await supabaseFetch("products?select=*");
    if (dbProds && dbProds.length > 0) {
      products = dbProds.map(p => {
        const prodStock = stockByProductLoc[p.id] || {};
        let mainCat = "مواد تموينية";
        let subCat = "";
        let expiry = null;

        if (p.notes) {
          try {
            const meta = JSON.parse(p.notes);
            if (meta.mainCat) mainCat = meta.mainCat;
            if (meta.subCat) subCat = meta.subCat;
            if (meta.expiry) expiry = meta.expiry;
          } catch(e) {}
        }

        return {
          id: p.id,
          name: p.name,
          brand: p.brand || "",
          origin: p.origin || "",
          weight: p.weight || "",
          unit: p.unit || "قطعة",
          bulkPack: p.bulk_pack || "",
          barcode: p.barcode || "",
          cost: p.cost_price || 0,
          retail: p.retail_price || 0,
          wholesale: p.wholesale_price || 0,
          mainCat,
          subCat,
          expiry,
          stock: {
            u2: prodStock['c30c9fbf-adf8-4af8-a5bc-2d20efc389f3'] || 0,
            u3: prodStock['6282c62f-6358-454b-a7b3-a31464f399ba'] || 0
          }
        };
      });
      console.log(`✅ تم تحميل ${products.length} منتج من Supabase`);
    }

    // 3. جلب العملاء
    const dbCusts = await supabaseFetch("customers?select=*");
    if (dbCusts && dbCusts.length > 0) {
      customers = dbCusts.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone || '',
        whatsapp: c.notes && c.notes.startsWith('wa:') ? c.notes.replace('wa:', '') : (c.phone || ''),
        debt: c.opening_balance || 0,
        creditLimit: c.credit_limit || 500000,
        dueDate: null,
        lastVisit: c.updated_at ? c.updated_at.slice(0, 10) : '',
        payments: [],
        invoiceIds: []
      }));
      console.log(`✅ تم تحميل ${customers.length} عميل من Supabase`);
    }

    // 4. جلب الموردين
    const dbSups = await supabaseFetch("suppliers?select=*");
    if (dbSups && dbSups.length > 0) {
      suppliers = dbSups.map(s => ({
        id: s.id,
        name: s.name,
        phone: s.phone || '',
        category: s.category || '',
        balance: s.opening_balance || 0,
        payments: [],
        invoiceIds: []
      }));
      console.log(`✅ تم تحميل ${suppliers.length} مورد من Supabase`);
    }

    // تحديث الواجهة
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        if (typeof window.renderProducts === "function") window.renderProducts();
        if (typeof window.renderCategoryGrid === "function") window.renderCategoryGrid();
        if (typeof window.renderInventory === "function") window.renderInventory();
        if (typeof window.renderCustomers === "function") window.renderCustomers();
        if (typeof window.renderSuppliers === "function") window.renderSuppliers();
        if (typeof window.render === "function") window.render();
      }
    }, 100);

  } catch (e) {
    console.error("❌ خطأ في المزامنة:", e);
  }
}

// تشغيل المزامنة عند تحميل الصفحة
if (typeof window !== "undefined") {
  window.UNITS = UNITS;
  window.MAIN_CATS = MAIN_CATS;
  window.SUB_CATS = SUB_CATS;
  
  if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", syncSupabaseData);
  } else {
    syncSupabaseData();
  }
}
/* ---- إعدادات الفاتورة لكل فرع ---- */
const RECEIPT_BY_BRANCH = {
  u2: {logo:null, storeName:'', phone:'', footer:'شكرًا لتعاملكم معنا'},
  u3: {logo:null, storeName:'', phone:'', footer:'شكرًا لتعاملكم معنا'},
};

(function loadReceiptState(){
  try{
    const raw = localStorage.getItem('aps_receipt_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(saved && typeof saved === 'object'){
        Object.keys(RECEIPT_BY_BRANCH).forEach(b => { 
          if(saved[b]) Object.assign(RECEIPT_BY_BRANCH[b], saved[b]); 
        });
      }
    }
  }catch(e){}
})();

function persistReceipt(){
  try{ localStorage.setItem('aps_receipt_state', JSON.stringify(RECEIPT_BY_BRANCH)); }catch(e){}
}

function receiptFor(branch){
  const b = branch || getActiveUnit();
  return RECEIPT_BY_BRANCH[b] || {logo:null, storeName:'', phone:'', footer:''};
}

/* ---- الإعدادات العامة ---- */
let APP_SETTINGS = { 
  expiryAlertDays: 20, 
  lowStockThreshold: 15, 
  discountCapPercent: 15 
};

(function loadAppSettings(){
  try{
    const raw = localStorage.getItem('aps_settings_state');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(saved && typeof saved === 'object') Object.assign(APP_SETTINGS, saved); 
    }
  }catch(e){}
})();

function persistAppSettings(){
  try{ localStorage.setItem('aps_settings_state', JSON.stringify(APP_SETTINGS)); }catch(e){}
}

/* ---- إعدادات الطباعة ---- */
const PRINT_CFG = { 
  paperMm: 80, 
  printWidthMm: 72, 
  sideMarginMm: 3.5, 
  autoPrint: false 
};

/* ---- حفظ منتج جديد ---- */
(function loadExtraProducts(){
  try{
    const raw = localStorage.getItem('aps_extra_products');
    if(raw){
      const extra = JSON.parse(raw);
      if(Array.isArray(extra)) extra.forEach(p => products.push(p));
    }
  }catch(e){}
})();

async function saveNewProduct(p){
  try {
    const metaNotes = JSON.stringify({
      mainCat: p.mainCat || "مواد تموينية",
      subCat: p.subCat || "",
      expiry: p.expiry || null
    });

    const dbPayload = {
      name: p.name,
      brand: p.brand || "",
      origin: p.origin || "",
      weight: p.weight || "",
      unit: p.saleUnit || p.unit || "قطعة",
      bulk_pack: p.bulkPack || "",
      barcode: p.barcode || "",
      cost_price: p.cost || 0,
      wholesale_price: p.wholesale || 0,
      retail_price: p.retail || 0,
      notes: metaNotes
    };
    
    const inserted = await supabaseFetch("products", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify([dbPayload])
    });

    if (inserted && inserted[0]) {
      p.id = inserted[0].id;
      const locMain = LOCATIONS_MAP.u2;
      const locB2 = LOCATIONS_MAP.u3;
      const invPayload = [
        { product_id: p.id, location_id: locMain, quantity: p.stock ? (p.stock.u2 || 0) : 0 },
        { product_id: p.id, location_id: locB2, quantity: p.stock ? (p.stock.u3 || 0) : 0 }
      ];
      await supabaseFetch("inventory", {
        method: "POST",
        body: JSON.stringify(invPayload)
      });
      console.log("✅ منتج جديد محفوظ:", p.id);
    }
  } catch (e) {
    console.error("❌ خطأ حفظ المنتج:", e);
  }

  const existingIdx = products.findIndex(x => x.id === p.id);
  if (existingIdx !== -1) products.splice(existingIdx, 1);
  products.unshift(p);

  if (typeof window !== 'undefined' && typeof window.render === "function") window.render();
}

async function updateProduct(id, patch){
  const p = products.find(x => x.id === id);
  if (p) {
    Object.assign(p, patch);
  }
  
  try {
    const dbPayload = {};
    if (patch.name !== undefined) dbPayload.name = patch.name;
    if (patch.brand !== undefined) dbPayload.brand = patch.brand;
    if (patch.origin !== undefined) dbPayload.origin = patch.origin;
    if (patch.weight !== undefined) dbPayload.weight = patch.weight;
    if (patch.saleUnit !== undefined || patch.unit !== undefined) dbPayload.unit = patch.saleUnit || patch.unit;
    if (patch.bulkPack !== undefined) dbPayload.bulk_pack = patch.bulkPack;
    if (patch.barcode !== undefined) dbPayload.barcode = patch.barcode;
    if (patch.cost !== undefined) dbPayload.cost_price = patch.cost;
    if (patch.wholesale !== undefined) dbPayload.wholesale_price = patch.wholesale;
    if (patch.retail !== undefined) dbPayload.retail_price = patch.retail;

    if (p && (patch.mainCat !== undefined || patch.subCat !== undefined || patch.expiry !== undefined)) {
      dbPayload.notes = JSON.stringify({
        mainCat: p.mainCat || "مواد تموينية",
        subCat: p.subCat || "",
        expiry: p.expiry || null
      });
    }

    if (Object.keys(dbPayload).length > 0 && id && id.includes('-')) {
      await supabaseFetch(`products?id=eq.${id}`, {
        method: "PATCH",
        body: JSON.stringify(dbPayload)
      });
    }

    if (patch.stock && id && id.includes('-')) {
      const locMain = LOCATIONS_MAP.u2;
      const locB2 = LOCATIONS_MAP.u3;
      
      if (patch.stock.u2 !== undefined) {
        await supabaseFetch(`inventory?product_id=eq.${id}&location_id=eq.${locMain}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: patch.stock.u2 })
        });
      }
      if (patch.stock.u3 !== undefined) {
        await supabaseFetch(`inventory?product_id=eq.${id}&location_id=eq.${locB2}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: patch.stock.u3 })
        });
      }
    }
    console.log("✅ تحديث المنتج:", id);
  } catch (e) {
    console.error("❌ خطأ التحديث:", e);
  }

  if (typeof window !== 'undefined' && typeof window.render === "function") window.render();
}

/* ---- العملاء ---- */
(function loadCustomersState(){
  try{
    const raw = localStorage.getItem('aps_customers_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved) && saved.length) {
        customers.length = 0;
        saved.forEach(c => customers.push(c));
      }
    }
  }catch(e){}
})();

function persistCustomers(){
  try{ localStorage.setItem('aps_customers_state', JSON.stringify(customers)); }catch(e){}
}

function findOrCreateCustomer(name, phone, whatsapp){
  const digits = (phone || '').replace(/\D/g, '');
  let c = digits ? customers.find(x => x.phone.replace(/\D/g, '') === digits) : null;
  if(!c && name && name !== 'زبون نقدي'){
    c = customers.find(x => x.name === name);
  }
  if(!c){
    if(!phone && (!name || name === 'زبون نقدي')) return null;
    c = {
      id:'c' + Date.now(), 
      name: name || 'بدون اسم', 
      phone: phone || '', 
      whatsapp: whatsapp || phone || '',
      debt:0, 
      creditLimit:null, 
      dueDate:null, 
      lastVisit:'', 
      payments:[], 
      invoiceIds:[]
    };
    customers.push(c);
    persistCustomers();
  }
  return c;
}

function addCustomerManual(c){
  customers.push(c);
  persistCustomers();
  if(typeof saveCustomerToSupabase === 'function') saveCustomerToSupabase(c);
}

function updateCustomer(id, patch){
  const c = customers.find(x => x.id === id);
  if(!c) return;
  Object.assign(c, patch);
  persistCustomers();
  if(typeof saveCustomerToSupabase === 'function') saveCustomerToSupabase(c);
}

function addCustomerPayment(id, amount, method, opNo){
  const c = customers.find(x => x.id === id);
  if(!c) return;
  amount = Math.max(0, Math.min(amount, c.debt));
  c.debt -= amount;
  c.payments = c.payments || [];
  c.payments.unshift({
    amount, 
    method, 
    opNo: opNo || '', 
    date: (typeof nowStr === 'function' ? nowStr() : '')
  });
  persistCustomers();
}

function isOverCreditLimit(c, extra){
  if(!c || !c.creditLimit) return false;
  return (c.debt + (extra || 0)) >= c.creditLimit;
}

async function saveCustomerToSupabase(c) {
  try {
    const payload = {
      name: c.name,
      phone: c.phone || "",
      credit_limit: c.creditLimit || 500000,
      notes: c.whatsapp ? ("wa:" + c.whatsapp) : null
    };

    if (c.id && c.id.includes('-')) {
      await supabaseFetch(`customers?id=eq.${c.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      console.log("✅ تحديث عميل:", c.id);
    } else {
      const inserted = await supabaseFetch("customers", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify([payload])
      });
      if (inserted && inserted[0]) {
        c.id = inserted[0].id;
        console.log("✅ عميل جديد:", c.id);
      }
    }
  } catch (err) {
    console.error("❌ خطأ حفظ العميل:", err);
  }
}

/* ---- الموردون ---- */
(function loadSuppliersState(){
  try{
    const raw = localStorage.getItem('aps_suppliers_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved) && saved.length) {
        suppliers.length = 0;
        saved.forEach(s => suppliers.push(s));
      }
    }
  }catch(e){}
})();

function persistSuppliers(){
  try{ localStorage.setItem('aps_suppliers_state', JSON.stringify(suppliers)); }catch(e){}
}

function addSupplierManual(s){
  suppliers.push(s);
  persistSuppliers();
  if(typeof saveSupplierToSupabase === 'function') saveSupplierToSupabase(s);
}

function updateSupplier(id, patch){
  const s = suppliers.find(x => x.id === id);
  if(!s) return;
  Object.assign(s, patch);
  persistSuppliers();
}

function addSupplierPayment(id, amount, method, opNo, branch){
  const s = suppliers.find(x => x.id === id);
  if(!s) return;
  amount = Math.max(0, Math.min(amount, s.balance));
  s.balance -= amount;
  s.payments = s.payments || [];
  s.payments.unshift({
    amount, 
    method, 
    opNo: opNo || '', 
    date: (typeof nowStr === 'function' ? nowStr() : '')
  });
  persistSuppliers();
  if(method === 'نقدي' && branch && typeof addCashboxTx === 'function'){
    addCashboxTx(branch, {
      type:'دفعة مورد', 
      desc:`تسديد دفعة إلى ${s.name}`, 
      amount, 
      direction:'out', 
      method:'نقدي', 
      ref:s.id
    });
  }
}

async function saveSupplierToSupabase(s) {
  try {
    const payload = {
      name: s.name,
      phone: s.phone || "",
      category: s.category || "",
      opening_balance: s.balance || 0
    };

    if (s.id && s.id.includes('-')) {
      await supabaseFetch(`suppliers?id=eq.${s.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
      console.log("✅ تحديث مورد:", s.id);
    } else {
      const inserted = await supabaseFetch("suppliers", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify([payload])
      });
      if (inserted && inserted[0]) {
        s.id = inserted[0].id;
        console.log("✅ مورد جديد:", s.id);
      }
    }
  } catch (err) {
    console.error("❌ خطأ حفظ المورد:", err);
  }
                            }

/* ---- الإتلاف (waste) ---- */
const WASTE_REASONS = ['انتهاء الصلاحية', 'عيوب تصنيع', 'عبوة مكسورة', 'كرتون مهروس', 'أخرى'];

(function loadWasteLog(){
  try{
    const raw = localStorage.getItem('aps_waste_state');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(Array.isArray(saved)) wasteLog = saved; 
    }
  }catch(e){}
})();

function persistWaste(){
  try{ localStorage.setItem('aps_waste_state', JSON.stringify(wasteLog)); }catch(e){}
}

function addWaste(w){
  if (typeof saveWasteToSupabase === 'function') saveWasteToSupabase(w);
  const p = products.find(x => x.id === w.productId);
  if(!p) return null;
  const avail = p.stock[w.branch] || 0;
  const qty = Math.max(1, Math.min(w.qty, avail));
  p.stock[w.branch] = avail - qty;
  updateProduct(p.id, {stock: p.stock});
  
  const rec = {
    id: 'W' + Date.now() + Math.random().toString(36).slice(2,5),
    branch: w.branch, 
    productId: p.id, 
    productName: p.name + (p.weight ? ` (${p.weight})` : ''),
    qty, 
    unit: p.saleUnit || '', 
    costAtTime: p.cost || 0,
    reason: w.reason, 
    reasonNote: w.reasonNote || '', 
    note: w.note || '',
    time: (typeof nowStr === 'function' ? nowStr() : '')
  };
  wasteLog.unshift(rec);
  persistWaste();
  if(typeof logAudit === 'function') {
    logAudit('waste', w.branch, '', `إتلاف ${qty} ${p.saleUnit || ''} من ${p.name} — السبب: ${w.reason}`);
  }
  return rec;
}

function wasteFor(branch){ 
  return branch ? wasteLog.filter(w => w.branch === branch) : wasteLog; 
}

async function saveWasteToSupabase(w) {
  try {
    const locUuid = LOCATIONS_MAP[w.branch] || LOCATIONS_MAP['u2'];
    const p = products.find(x => x.id === w.productId);
    
    const payload = {
      location_id: locUuid,
      product_id: w.productId && w.productId.includes('-') ? w.productId : null,
      quantity_change: -Math.abs(w.qty),
      reason: 'damaged',
      notes: (w.reason || '') + (w.reasonNote ? ' - ' + w.reasonNote : '') + (w.note ? ' - ' + w.note : ''),
      unit_cost: p ? (p.cost || 0) : 0
    };

    await supabaseFetch("inventory_adjustments", {
      method: "POST",
      body: JSON.stringify([payload])
    });

    console.log("✅ تسجيل إتلاف:", w.productId);
  } catch (err) {
    console.error("❌ خطأ حفظ الإتلاف:", err);
  }
}

/* ---- الفواتير ---- */
(function loadInvoicesState(){
  try{
    const raw = localStorage.getItem('aps_invoices_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(saved && Array.isArray(saved.list) && saved.list.length){ 
        invoices.length = 0; 
        saved.list.forEach(i => invoices.push(i)); 
      }
    }
  }catch(e){}
})();

function persistInvoices(seq){
  try{ 
    localStorage.setItem('aps_invoices_state', JSON.stringify({list: invoices, seq: seq})); 
  }catch(e){}
}

function loadInvoiceSeq(fallback){
  try{
    const raw = localStorage.getItem('aps_invoices_state');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(saved && saved.seq) return saved.seq; 
    }
  }catch(e){}
  return fallback;
}

async function saveSaleToSupabase(inv) {
  try {
    const bId = inv.branch || getActiveUnit();
    const locUuid = LOCATIONS_MAP[bId] || LOCATIONS_MAP['u2'];
    const bCode = BRANCH_CODES[bId] || 'B01';
    
    let cogsTotal = 0;
    if (inv.items && Array.isArray(inv.items)) {
      inv.items.forEach(item => {
        const prod = products.find(p => p.id === item.id || p.name === item.name || (item.barcode && p.barcode === item.barcode));
        const itemCost = (prod && prod.cost !== undefined) ? prod.cost : (item.cost || 0);
        cogsTotal += item.qty * itemCost;
      });
    }
    const netTotal = inv.total || 0;
    const profitTotal = netTotal - cogsTotal;

    const seqNum = inv.seqNumber || getBranchInvoiceSeq(bId);
    const invNumberStr = (inv.id && inv.id.startsWith('INV-')) ? inv.id : `INV-${bCode}-${seqNum}`;
    const isoDate = inv.dateIso || new Date().toISOString();

    let customerUuid = null;
    if (inv.customer && inv.customer !== 'زبون نقدي') {
      const matched = customers.find(c => c.name === inv.customer || (inv.phone && c.phone === inv.phone));
      if (matched && matched.id && matched.id.includes('-')) {
        customerUuid = matched.id;
      }
    }

    const invPayload = {
      invoice_number: invNumberStr,
      location_id: locUuid,
      customer_id: customerUuid,
      customer_name: inv.customer || 'زبون نقدي',
      customer_phone: inv.phone || '',
      price_mode: 'retail',
      subtotal: (inv.total || 0) + (inv.discountAmt || 0),
      discount_amount: inv.discountAmt || 0,
      total_amount: netTotal,
      paid_amount: inv.paid || 0,
      status: (inv.paid >= netTotal) ? 'completed' : 'partial',
      payment_method: inv.payMethod === 'credit' ? 'credit' : (inv.payMethod === 'wallet' ? 'wallet' : 'cash'),
      cogs_total: cogsTotal,
      profit_total: profitTotal,
      created_at: isoDate,
      created_local: isoDate
    };

    const insertedInv = await supabaseFetch("sales_invoices", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify([invPayload])
    });

    if (insertedInv && insertedInv[0]) {
      const dbInvId = insertedInv[0].id;
      console.log("✅ فاتورة محفوظة:", dbInvId, invNumberStr);

      if (inv.items && inv.items.length > 0) {
        const itemRows = inv.items.map(item => {
          const prod = products.find(p => p.id === item.id || p.name === item.name || (item.barcode && p.barcode === item.barcode));
          const itemCost = (prod && prod.cost !== undefined) ? prod.cost : (item.cost || 0);
          const lineCogs = item.qty * itemCost;
          
          let validProdUuid = (item.id && item.id.includes('-')) ? item.id : (prod && prod.id && prod.id.includes('-') ? prod.id : null);
          if (!validProdUuid && products.length > 0) {
            const firstValid = products.find(p => p.id && p.id.includes('-'));
            if (firstValid) validProdUuid = firstValid.id;
          }

          return {
            invoice_id: dbInvId,
            product_id: validProdUuid,
            product_name: item.name,
            quantity: item.qty,
            unit_price: item.price,
            line_total: item.qty * item.price,
            cogs: lineCogs,
            item_status: "sold"
          };
        }).filter(r => r.product_id);

        if (itemRows.length > 0) {
          await supabaseFetch("sales_invoice_items", {
            method: "POST",
            body: JSON.stringify(itemRows)
          });
        }
      }

      // خصم المخزون
      for (const item of inv.items) {
        const prod = products.find(p => p.id === item.id || p.name === item.name);
        if (prod && prod.id && prod.id.includes('-')) {
          if (prod.stock && prod.stock[bId] !== undefined) {
            const newQty = Math.max(0, prod.stock[bId] - item.qty);
            prod.stock[bId] = newQty;
            await supabaseFetch(`inventory?product_id=eq.${prod.id}&location_id=eq.${locUuid}`, {
              method: "PATCH",
              body: JSON.stringify({ quantity: newQty })
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("❌ خطأ حفظ الفاتورة:", e);
  }
}

/* ---- فواتير الشراء ---- */
let purchaseSeq = 9001;

(function loadPurchasesState(){
  try{
    const raw = localStorage.getItem('aps_purchases_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(saved && Array.isArray(saved.list)){ 
        saved.list.forEach(p => purchases.push(p)); 
        purchaseSeq = saved.seq || purchaseSeq; 
      }
    }
  }catch(e){}
})();

function persistPurchases(){
  try{ 
    localStorage.setItem('aps_purchases_state', JSON.stringify({list: purchases, seq: purchaseSeq})); 
  }catch(e){}
}

function addPurchase(p){
  const id = String(purchaseSeq);
  purchaseSeq += 1;
  const inv = {
    id, 
    supplierId:p.supplierId, 
    branch:p.branch, 
    date:(typeof nowStr === 'function' ? nowStr() : ''),
    items:p.items, 
    total:p.total, 
    paid:p.paid, 
    remaining:p.remaining, 
    payMethod:p.payMethod, 
    opNo:p.opNo || ''
  };
  purchases.unshift(inv);
  
  if(typeof logAudit === 'function'){
    const sup = suppliers.find(s => s.id === p.supplierId);
    logAudit('purchase', p.branch, id, `فاتورة شراء #${id} من ${sup ? sup.name : p.supplierId}`);
  }
  persistPurchases();

  // تحديث المخزون
  inv.items.forEach(it => {
    const prod = products.find(x => x.id === it.productId);
    if(prod){
      prod.stock[inv.branch] = (prod.stock[inv.branch] || 0) + it.qty;
      updateProduct(prod.id, {stock: prod.stock});
    }
  });

  // تحديث ذمة المورد
  const sup = suppliers.find(x => x.id === inv.supplierId);
  if(sup){
    sup.balance = (sup.balance || 0) + inv.remaining;
    sup.invoiceIds = sup.invoiceIds || [];
    sup.invoiceIds.unshift(inv.id);
    persistSuppliers();
  }

  // خصم النقدي من الصندوق
  if(inv.paid > 0 && typeof addCashboxTx === 'function'){
    addCashboxTx(inv.branch, {
      type:'فاتورة شراء', 
      desc:`شراء من ${sup ? sup.name : ''} (#${inv.id})`, 
      amount: inv.paid, 
      direction:'out', 
      method:'نقدي', 
      ref: inv.id
    });
  }
  return inv;
}

async function savePurchaseToSupabase(inv) {
  try {
    const locUuid = LOCATIONS_MAP[inv.branch] || LOCATIONS_MAP['u2'];
    let supplierUuid = null;
    if (inv.supplierId) {
      const matched = suppliers.find(s => s.id === inv.supplierId || s.name === inv.supplierId);
      if (matched && matched.id && matched.id.includes('-')) {
        supplierUuid = matched.id;
      }
    }

    const invPayload = {
      invoice_number: 'PUR-' + (inv.branch || 'B01') + '-' + inv.id,
      location_id: locUuid,
      supplier_id: supplierUuid,
      total_amount: inv.total || 0,
      paid_amount: inv.paid || 0,
      status: (inv.paid >= inv.total) ? 'completed' : 'partial',
      payment_method: inv.payMethod === 'credit' ? 'credit' : 'cash'
    };

    const insertedInv = await supabaseFetch("purchase_invoices", {
      method: "POST",
      headers: { "Prefer": "return=representation" },
      body: JSON.stringify([invPayload])
    });

    if (insertedInv && insertedInv[0]) {
      const dbInvId = insertedInv[0].id;
      console.log("✅ فاتورة شراء محفوظة:", dbInvId);

      if (inv.items && inv.items.length > 0) {
        const itemRows = inv.items.map(item => ({
          purchase_invoice_id: dbInvId,
          product_id: item.productId && item.productId.includes('-') ? item.productId : null,
          quantity: item.qty,
          unit_cost: item.cost,
          line_total: item.qty * item.cost
        }));

        await supabaseFetch("purchase_invoice_items", {
          method: "POST",
          body: JSON.stringify(itemRows)
        });
      }
    }
  } catch (e) {
    console.error("❌ خطأ حفظ فاتورة الشراء:", e);
  }
}

/* ---- التحويلات بين الفروع ---- */
(function loadTransfersState(){
  try{
    const raw = localStorage.getItem('aps_transfers_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved)) transfers = saved;
    }
  }catch(e){}
})();

function persistTransfers(){
  try{ localStorage.setItem('aps_transfers_state', JSON.stringify(transfers)); }catch(e){}
}

function addTransfer(t){ 
  transfers.unshift(t); 
  persistTransfers(); 
}

function updateTransferStatus(id, status){
  const t = transfers.find(x => x.id === id);
  if(!t) return false;
  t.status = status;
  persistTransfers();
  return true;
}

/* ---- الصندوق ---- */
(function loadCashboxState(){
  try{
    const raw = localStorage.getItem('aps_cashbox_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved)) cashboxTx = saved;
    }
  }catch(e){}
})();

function persistCashbox(){
  try{ localStorage.setItem('aps_cashbox_state', JSON.stringify(cashboxTx)); }catch(e){}
}

function addCashboxTx(branch, t){
  const tx = {
    id:'ctx' + Date.now() + Math.random().toString(36).slice(2,6), 
    branch, 
    time:(typeof nowStr === 'function' ? nowStr() : ''), 
    ...t
  };
  cashboxTx.unshift(tx);
  persistCashbox();
  return tx;
}

function cashboxBalance(branch){
  return cashboxTx.filter(t => t.branch === branch)
    .reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0);
}

/* ---- الورديات ---- */
let shiftState = { 
  u2:{openingBalance:0, openedAt:null}, 
  u3:{openingBalance:0, openedAt:null} 
};

(function loadShiftState(){
  try{
    const raw = localStorage.getItem('aps_shift_state');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(saved) shiftState = saved; 
    }
  }catch(e){}
})();

function persistShiftState(){
  try{ localStorage.setItem('aps_shift_state', JSON.stringify(shiftState)); }catch(e){}
}

function openShift(branch, openingBalance){
  shiftState[branch] = {
    openingBalance: Number(openingBalance) || 0, 
    openedAt: (typeof nowStr === 'function' ? nowStr() : '')
  };
  persistShiftState();
}

let shiftLog = [];

(function loadShiftLog(){
  try{
    const raw = localStorage.getItem('aps_shift_log');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(Array.isArray(saved)) shiftLog = saved; 
    }
  }catch(e){}
})();

function persistShiftLog(){
  try{ localStorage.setItem('aps_shift_log', JSON.stringify(shiftLog)); }catch(e){}
}

function closeShift(branch, counted){
  const st = shiftState[branch] || {openingBalance:0, openedAt:null};
  const expected = cashboxBalance(branch);
  const c = Number(counted) || 0;
  const entry = {
    id:'sh' + Date.now(), 
    branch, 
    openedAt: st.openedAt, 
    closedAt: (typeof nowStr === 'function' ? nowStr() : ''),
    opening: st.openingBalance, 
    expected, 
    counted: c, 
    diff: c - expected
  };
  shiftLog.unshift(entry);
  persistShiftLog();
  shiftState[branch] = {openingBalance:0, openedAt:null};
  persistShiftState();
  return entry;
}

function shiftLogFor(branch){
  return shiftLog.filter(s => s.branch === branch);
}

/* ---- الإشعارات ---- */
(function loadNotifState(){
  try{
    const raw = localStorage.getItem('aps_notifications');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved)) notifications = saved;
    }
  }catch(e){}
})();

function persistNotifications(){
  try{ localStorage.setItem('aps_notifications', JSON.stringify(notifications)); }catch(e){}
}

function pushNotification(title, targetUnit, icon){
  const n = {
    id:'n' + Date.now(), 
    title, 
    targetUnit: targetUnit || 'all', 
    time:'الآن', 
    read:false
  };
  notifications.unshift(n);
  persistNotifications();
  if(typeof broadcastAppEvent === 'function'){
    broadcastAppEvent('notification', {title, icon: icon || '🔔', targetUnit: n.targetUnit});
  }
  return n;
}

function notificationsFor(unitId){
  return notifications.filter(n => n.targetUnit === 'all' || n.targetUnit === unitId);
}

function unreadNotifCount(unitId){
  const uid = unitId || getActiveUnit();
  return notificationsFor(uid).filter(n => !n.read).length;
}

function markAllNotifsRead(unitId){
  const uid = unitId || getActiveUnit();
  notificationsFor(uid).forEach(n => n.read = true);
  persistNotifications();
}

/* ---- سجل التدقيق ---- */
(function loadAuditLog(){
  try{
    const raw = localStorage.getItem('aps_audit_log');
    if(raw){ 
      const saved = JSON.parse(raw); 
      if(Array.isArray(saved)) auditLog = saved; 
    }
  }catch(e){}
})();

function persistAuditLog(){
  try{ localStorage.setItem('aps_audit_log', JSON.stringify(auditLog)); }catch(e){}
}

function logAudit(type, branch, invoiceId, desc){
  auditLog.unshift({
    id:'aud'+Date.now()+Math.random().toString(36).slice(2,6), 
    type, 
    branch, 
    invoiceId, 
    desc, 
    time:(typeof nowStr === 'function' ? nowStr() : '')
  });
  persistAuditLog();
}

/* ============ تصدير للنافذة العامة ============ */
if (typeof window !== 'undefined') {
  window.UNITS = UNITS;
  window.MAIN_CATS = MAIN_CATS;
  window.SUB_CATS = SUB_CATS;
  window.BRANDS = BRANDS;
  window.ORIGINS = ORIGINS;
  window.SALE_UNITS = SALE_UNITS;
  window.products = products;
  window.customers = customers;
  window.suppliers = suppliers;
  window.saveNewProduct = saveNewProduct;
  window.updateProduct = updateProduct;
  window.findOrCreateCustomer = findOrCreateCustomer;
  window.addWaste = addWaste;
  window.saveSaleToSupabase = saveSaleToSupabase;
       }
