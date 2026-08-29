
/* ---- تسلسل أرقام الفواتير المستقل لكل فرع تبدأ من 2026 تصاعدياً ---- */
const BRANCH_CODES = {
  u1: 'HEAD',
  u2: 'B01', // سوبر ماركت أبو سارة
  u3: 'B02'  // أبو سارة 2
};

function getBranchInvoiceSeq(branchId) {
  const b = branchId || (typeof activeUnitId === 'function' ? activeUnitId() : 'u2');
  try {
    const saved = localStorage.getItem('aps_inv_seq_' + b);
    if (saved) return parseInt(saved, 10);
  } catch(e){}
  return 2026; // يبدأ تلقائياً من الرقم 2026 لكل فرع
}

function incrementBranchInvoiceSeq(branchId) {
  const b = branchId || (typeof activeUnitId === 'function' ? activeUnitId() : 'u2');
  const current = getBranchInvoiceSeq(b);
  const next = current + 1;
  try {
    localStorage.setItem('aps_inv_seq_' + b, next);
  } catch(e){}
  return next;
}

/* ---- الفروع والوحدات الرئيسية ---- */
var UNITS = [
  {id:'u1', name:'الإدارة العامة', type:'head'},
  {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
  {id:'u3', name:'أبو سارة 2', type:'branch'}
];

function warehouseUnits(){
  if (typeof UNITS !== 'undefined' && Array.isArray(UNITS)) {
    return UNITS.filter(u => u.type === 'branch');
  }
  return [
    {id:'u2', name:'سوبر ماركت أبو سارة', type:'branch'},
    {id:'u3', name:'أبو سارة 2', type:'branch'}
  ];
}

if (typeof window !== 'undefined') {
  window.UNITS = UNITS;
  
}

const LOCATIONS_MAP = {
  u2: 'c30c9fbf-adf8-4af8-a5bc-2d20efc389f3', // B01: سوبر ماركت أبو سارة
  u3: '6282c62f-6358-454b-a7b3-a31464f399ba'  // B02: أبو سارة 2
};

function activeLocationUuid() {
  const u = typeof activeUnitId === 'function' ? activeUnitId() : 'u2';
  return LOCATIONS_MAP[u] || LOCATIONS_MAP['u2'];
}

/* =====================================================================
   AlfaProSys — Supabase Live REST Client
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
      console.warn(`Supabase API notice on ${endpoint}: ${res.statusText}`);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("Supabase connection error:", err);
    return null;
  }
}

async function syncSupabaseData() {
  try {
    // 1. Core Categories are strictly bounded
    MAIN_CATS = [
      'مواد تموينية',
      'مشروبات وعصائر',
      'ألبان وأجبان',
      'حلويات وتسالي',
      'معلبات ومحفوظات',
      'منظفات ومستلزمات منزلية',
      'عناية شخصية',
      'لحوم ومجمدات'
    ];

    // 2. Fetch Live Inventory Stock
    const dbInv = await supabaseFetch("inventory?select=*");
    const stockByProductLoc = {};
    if (dbInv && dbInv.length > 0) {
      dbInv.forEach(row => {
        if (!stockByProductLoc[row.product_id]) stockByProductLoc[row.product_id] = {};
        stockByProductLoc[row.product_id][row.location_id] = row.quantity;
      });
    }

    // 3. Fetch Products
    const dbProds = await supabaseFetch("products?select=*");
    if (dbProds && dbProds.length > 0) {
      const mappedProds = dbProds.map(p => {
        const prodStock = stockByProductLoc[p.id] || {};
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
          mainCat: (() => {
            if (p.notes) {
              try {
                const meta = JSON.parse(p.notes);
                if (meta.mainCat) return meta.mainCat;
              } catch(e) {}
              if (p.notes.includes('cat:')) return p.notes.split('||')[0].replace('cat:', '');
            }
            return "مواد تموينية";
          })(),
          subCat: (() => {
            if (p.notes) {
              try {
                const meta = JSON.parse(p.notes);
                if (meta.subCat) return meta.subCat;
              } catch(e) {}
              if (p.notes.includes('||')) return p.notes.split('||')[1] || "";
            }
            return "";
          })(),
          expiry: (() => {
            if (p.notes) {
              try {
                const meta = JSON.parse(p.notes);
                if (meta.expiry) return meta.expiry;
              } catch(e) {}
              if (p.notes.startsWith('exp:')) return p.notes.replace('exp:', '');
            }
            return p.expiry || p.expiry_date || null;
          })(),
          stock: {
            u2: prodStock['c30c9fbf-adf8-4af8-a5bc-2d20efc389f3'] ?? 100,
            u3: prodStock['6282c62f-6358-454b-a7b3-a31464f399ba'] ?? 50
          }
        };
      });
      products = mappedProds;
      console.log(`✅ Loaded ${mappedProds.length} products with live Supabase inventory!`);
    }
    
    // 4. Fetch Customers
    const dbCusts = await supabaseFetch("customers?select=*");
    if (dbCusts && dbCusts.length > 0) {
      customers = dbCusts.map(c => {
        let wa = c.phone || '';
        if (c.notes && c.notes.startsWith('wa:')) {
          wa = c.notes.replace('wa:', '');
        }
        return {
          id: c.id,
          name: c.name,
          phone: c.phone || '',
          whatsapp: wa,
          debt: c.opening_balance || 0,
          creditLimit: c.credit_limit || 500000,
          dueDate: null,
          lastVisit: c.updated_at ? c.updated_at.slice(0, 10) : '',
          payments: [],
          invoiceIds: []
        };
      });
      console.log(`✅ Loaded ${customers.length} customers from Supabase live!`);
    }

    if (typeof renderProducts === "function") renderProducts();
    if (typeof renderCategoryGrid === "function") renderCategoryGrid();
    if (typeof renderInventory === "function") renderInventory();
        // 5. Fetch Suppliers
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
      console.log(`✅ Loaded ${suppliers.length} suppliers from Supabase live!`);
    }
    if (typeof renderCustomers === "function") renderCustomers();
    if (typeof renderSuppliers === "function") renderSuppliers();
    if (typeof render === "function") render();
  } catch (e) {
    console.error("Error syncing with Supabase:", e);
  }
}

if (typeof window !== "undefined") {
  document.addEventListener("DOMContentLoaded", () => {
    syncSupabaseData();
  });
}

/* =====================================================================
   AlfaProSys — طبقة البيانات (data.js)
   ⚠️ بيانات تجريبية (Mock) — تُستبدل بـ Supabase عند الربط
   ===================================================================== */

/* ---- إعدادات الفاتورة — منفصلة لكل فرع (u2/u3) ----
   يحررها المدير من شاشة الإعدادات لكل فرع على حدة (فرع رئيسي وفرع ثانٍ قد يختلفان بالاسم/اللوغو/الهاتف/التذييل)
---------------------------------------- */
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
        Object.keys(RECEIPT_BY_BRANCH).forEach(b => { if(saved[b]) Object.assign(RECEIPT_BY_BRANCH[b], saved[b]); });
      }
    }
  }catch(e){}
})();
/* تُستدعى من شاشة الإعدادات بعد أي تعديل على بيانات فاتورة فرع محدد (تُحدَّث شاشة الطباعة لذاك الفرع فورًا) */
function persistReceipt(){
  try{ localStorage.setItem('aps_receipt_state', JSON.stringify(RECEIPT_BY_BRANCH)); }catch(e){}
}
/* يعيد إعدادات فاتورة فرع محدد (أو فرع العمل الحالي افتراضيًا) */
function receiptFor(branch){
  const b = branch || (typeof activeUnitId === 'function' ? activeUnitId() : null);
  return RECEIPT_BY_BRANCH[b] || {logo:null, storeName:'', phone:'', footer:''};
}

/* ---- إعدادات عامة قابلة للضبط من شاشة الإعدادات (صلاحية المدير) ----
   expiryAlertDays: عدد الأيام قبل انتهاء الصلاحية الذي تبدأ عنده التنبيهات (يُستخدم في expiryList بـ app.js)
   lowStockThreshold: عتبة "مخزون منخفض" المستخدمة في شاشتي المخزون ولوحة التحكم
   discountCapPercent: أقصى نسبة حسم مسموحة بزر الحسم بشاشة البيع (pos.html) — قابلة للتعديل من الإدارة (u1) فقط
---------------------------------------- */
let APP_SETTINGS = { expiryAlertDays: 20, lowStockThreshold: 15, discountCapPercent: 15 };
(function loadAppSettings(){
  try{
    const raw = localStorage.getItem('aps_settings_state');
    if(raw){ const saved = JSON.parse(raw); if(saved && typeof saved === 'object') Object.assign(APP_SETTINGS, saved); }
  }catch(e){}
})();
function persistAppSettings(){
  try{ localStorage.setItem('aps_settings_state', JSON.stringify(APP_SETTINGS)); }catch(e){}
}

/* ---- إعدادات الطباعة ----
   ورق 80مم — عرض المنطقة المطبوعة 72مم (يشمل الهوامش)
   الهوامش الجانبية 7مم مقسومة نصفين = 3.5مم لكل جهة → المحتوى 65مم
   autoPrint: true بعد الربط بالطابعة (طباعة فورية بدون معاينة)
---------------------------------------- */
const PRINT_CFG = { paperMm: 80, printWidthMm: 72, sideMarginMm: 3.5, autoPrint: false };

/* ---- المسميات ----
   قابلة للتعديل من شاشة الإعدادات (بصلاحية المدير) بعد الربط بقاعدة البيانات
   u1 = الإدارة (دور دخول/صلاحية إدارية فقط — لا تملك مخزونًا خاصًا بها)
   u2 = الفرع الرئيسي  (مخزون فعلي)
   u3 = الفرع الثاني   (مخزون فعلي)
---------------------------------------- */

const CURRENT_UNIT_ID = 'u2'; // وحدة عمل المستخدم الحالي
const CURRENT_UNIT = UNITS.find(u => u.id === CURRENT_UNIT_ID);
/* الفروع التي تملك مخزونًا فعليًا (تُستخدم في شاشة المخزون ونافذة إضافة صنف) */
function warehouseUnits(){ return UNITS.filter(u => u.type === 'branch'); }

/* ---- تصنيفات المنتج ----
   قوائم أساسية قابلة للتوسّع — تُضبط لاحقًا من شاشة الإعدادات (صلاحية المدير)
   الصنف (subCat) مرتبط بالتصنيف الرئيسي (mainCat)
---------------------------------------- */
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
let BRANDS  = ['الشعلان', 'عافية', 'بيبسي', 'نستله', 'كولجيت-بالموليف', 'المراعي'];
const ORIGINS = ['سوري', 'أردني', 'سعودي', 'تركي', 'لبناني', 'مصري', 'غير محدد'];
const SALE_UNITS = ['قطعة', 'كيس', 'علبة', 'كرتون', 'قنينة', 'كغ (وزن مفكوك)'];

/* بيانات تجريبية للأصناف — الحقول:
   mainCat: التصنيف الرئيسي | subCat: الصنف | brand: الشركة المصنعة | origin: بلد المنشأ (اختياري)
   name: الاسم التجاري (يتضمن نوع العبوة عند الحاجة: علبة/زجاج/بلاستيك) | weight: الوزن أو الحجم (اختياري)
   saleUnit: وحدة البيع | bulkPack: عبوة الجملة (اختياري — نص حر يوضّح كيفية بيع/جرد الصنف بالجملة،
     مثال: "طرد 12 كيس" للمحارم، "كرتونة 100 قطعة" للسردين/التونة، "شوال" للسكر — مهم عند إدخال صنف جديد وعند الجرد)
   barcode | cost/retail/wholesale | expiry: تاريخ الصلاحية (اختياري — قد يكون null)
   stock: الكمية في كل فرع فعلي (u2, u3) فقط — لا يوجد مخزون باسم "الإدارة" */
let products = [
  {id:'p1',  mainCat:'مواد أساسية', subCat:'حبوب وبقوليات', brand:'الشعلان', origin:'سوري',
   name:'أرز أبيض ممتاز — الشعلان', weight:'5 كغ', saleUnit:'كيس',
   barcode:'6291001112223', cost:38000, retail:46000, wholesale:43000, expiry:'2026-09-05', stock:{u2:60, u3:22}},
  {id:'p2',  mainCat:'مواد أساسية', subCat:'حبوب وبقوليات', brand:'الشعلان', origin:'سوري',
   name:'أرز أبيض ممتاز — الشعلان', weight:'2 كغ', saleUnit:'كيس',
   barcode:'6291001112224', cost:16000, retail:19500, wholesale:18000, expiry:'2026-09-05', stock:{u2:44, u3:15}},
  {id:'p3',  mainCat:'مواد أساسية', subCat:'زيوت', brand:'عافية', origin:'سعودي',
   name:'زيت دوار الشمس', weight:'1.5 لتر', saleUnit:'قنينة',
   barcode:'6291001112230', cost:21000, retail:26500, wholesale:24500, expiry:'2027-03-01', stock:{u2:38, u3:19}},
  {id:'p4',  mainCat:'مواد أساسية', subCat:'سكر وملح', brand:'أخرى', origin:'سوري',
   name:'سكر أبيض', weight:'1 كغ', saleUnit:'كيس', bulkPack:'شوال',
   barcode:'6291001112247', cost:6800, retail:8500, wholesale:7900, expiry:null, stock:{u2:120, u3:70}},
  {id:'p5',  mainCat:'معلبات', subCat:'معلبات أسماك', brand:'أخرى', origin:'مصري',
   name:'تونة قطع', weight:'170 غ', saleUnit:'علبة', bulkPack:'كرتونة 100 قطعة',
   barcode:'6291001112254', cost:4200, retail:5500, wholesale:5000, expiry:'2026-08-28', stock:{u2:14, u3:5}},
  {id:'p6',  mainCat:'ألبان وأجبان', subCat:'حليب', brand:'المراعي', origin:'سعودي',
   name:'حليب طويل الأمد', weight:'1 لتر', saleUnit:'علبة',
   barcode:'6291001112261', cost:3500, retail:4800, wholesale:4300, expiry:'2026-08-22', stock:{u2:9, u3:3}},
  {id:'p7',  mainCat:'ألبان وأجبان', subCat:'أجبان', brand:'المراعي', origin:'سعودي',
   name:'جبنة بيضاء', weight:'400 غ', saleUnit:'علبة',
   barcode:'6291001112278', cost:9000, retail:12000, wholesale:11000, expiry:'2026-08-19', stock:{u2:4, u3:2}},
  {id:'p8',  mainCat:'حلويات وتسالي', subCat:'بسكويت وويفر', brand:'أخرى', origin:'تركي',
   name:'بسكويت شوكولاتة', weight:'', saleUnit:'علبة',
   barcode:'6291001112285', cost:2200, retail:3200, wholesale:2800, expiry:'2027-05-10', stock:{u2:55, u3:31}},
  {id:'p9',  mainCat:'مشروبات', subCat:'مشروبات ساخنة', brand:'أخرى', origin:'غير محدد',
   name:'شاي أحمر', weight:'100 كيس', saleUnit:'علبة',
   barcode:'6291001112292', cost:8600, retail:11500, wholesale:10500, expiry:'2028-01-01', stock:{u2:26, u3:14}},
  {id:'p10', mainCat:'مواد أساسية', subCat:'معكرونة وشعيرية', brand:'أخرى', origin:'سوري',
   name:'معكرونة اسباغيتي', weight:'400 غ', saleUnit:'كيس',
   barcode:'6291001112308', cost:3100, retail:4200, wholesale:3800, expiry:'2026-08-15', stock:{u2:0, u3:6}},
  {id:'p11', mainCat:'منظفات', subCat:'منظفات أطباق', brand:'أخرى', origin:'سوري',
   name:'منظف أطباق', weight:'750 مل', saleUnit:'قنينة', bulkPack:'طرد 12 قنينة',
   barcode:'6291001112315', cost:5200, retail:7200, wholesale:6500, expiry:null, stock:{u2:18, u3:11}},
  {id:'p12', mainCat:'مشروبات', subCat:'مشروبات غازية', brand:'بيبسي', origin:'سوري',
   name:'بيبسي علبة معدنية (تنك)', weight:'330 مل', saleUnit:'علبة',
   barcode:'6291001112322', cost:2600, retail:3500, wholesale:3100, expiry:'2027-02-10', stock:{u2:80, u3:40}},
  {id:'p13', mainCat:'مشروبات', subCat:'مشروبات غازية', brand:'بيبسي', origin:'سوري',
   name:'بيبسي زجاج', weight:'250 مل', saleUnit:'قنينة',
   barcode:'6291001112339', cost:1800, retail:2500, wholesale:2200, expiry:'2027-02-10', stock:{u2:50, u3:20}},
  {id:'p14', mainCat:'مشروبات', subCat:'مشروبات غازية', brand:'بيبسي', origin:'سوري',
   name:'بيبسي بلاستيك', weight:'1.5 لتر', saleUnit:'قنينة',
   barcode:'6291001112346', cost:3600, retail:5000, wholesale:4500, expiry:'2027-02-10', stock:{u2:35, u3:12}},
];

/* ---- تخزين تجريبي للأصناف المضافة يدويًا من شاشة المخزون ----
   (بديل مؤقت في المتصفح — يُستبدل بجدول Supabase الحقيقي عند الربط) */
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
      console.log("✅ New product saved to Supabase live:", p.id);
    }
  } catch (e) {
    console.error("Error saving new product to Supabase:", e);
  }

  // Ensure item is in local memory array at top
  const existingIdx = products.findIndex(x => x.id === p.id);
  if (existingIdx !== -1) products.splice(existingIdx, 1);
  products.unshift(p);

  if (typeof render === "function") render();
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
    console.log("✅ Product updated in Supabase live:", id);
  } catch (e) {
    console.error("Error updating product in Supabase:", e);
  }

  if (typeof render === "function") render();
}


/* ---- العملاء ----
   يُنشأ العميل تلقائيًا من بيانات الفاتورة بشاشة البيع (pos.html) عند إدخال هاتف/اسم جديد،
   أو يدويًا من شاشة العملاء (لعميل سابق كان يتعامل قبل النظام وعليه ذمم فعلاً)
   الحقول: name/phone/whatsapp (قد يختلف عن الهاتف) | debt: الذمم الحالية (تُحسب تلقائيًا)
   creditLimit: سقف الذمم المسموح به لهذا العميل (null = بدون سقف) — عند الوصول إليه يُنبَّه الكاشير ليتوقف
   dueDate: تاريخ تسديد متفق عليه (اختياري) | payments: سجل الدفعات [{amount, method, opNo, date}]
   invoiceIds: أرقام فواتيره (مرجع لمصفوفة invoices) */
let customers = [];
(function loadCustomersState(){
  try{
    const raw = localStorage.getItem('aps_customers_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved) && saved.length) customers.length = 0, saved.forEach(c => customers.push(c));
    }
  }catch(e){}
})();
function persistCustomers(){
  try{ localStorage.setItem('aps_customers_state', JSON.stringify(customers)); }catch(e){}
}
/* يبحث عن عميل بالهاتف (أرقام فقط)، أو ينشئه إن لم يوجد — يُستدعى من شاشة البيع عند إتمام فاتورة آجلة/جزئية */
function findOrCreateCustomer(name, phone, whatsapp){
  const digits = (phone || '').replace(/\D/g, '');
  let c = digits ? customers.find(x => x.phone.replace(/\D/g, '') === digits) : null;
  if(!c && name && name !== 'زبون نقدي'){
    c = customers.find(x => x.name === name);
  }
  if(!c){
    if(!phone && (!name || name === 'زبون نقدي')) return null; // بيع نقدي بدون بيانات — لا يُنشأ عميل
    c = {id:'c' + Date.now(), name: name || 'بدون اسم', phone: phone || '', whatsapp: whatsapp || phone || '',
         debt:0, creditLimit:null, dueDate:null, lastVisit:'', payments:[], invoiceIds:[]};
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
/* يسجّل دفعة جديدة لعميل ويحدّث ذمّته لحظيًا */
function addCustomerPayment(id, amount, method, opNo){
  const c = customers.find(x => x.id === id);
  if(!c) return;
  amount = Math.max(0, Math.min(amount, c.debt));
  c.debt -= amount;
  c.payments = c.payments || [];
  c.payments.unshift({amount, method, opNo: opNo || '', date: (typeof nowStr === 'function' ? nowStr() : '')});
  persistCustomers();
}
/* ---- سقف الذمم ----
   creditLimit = null أو 0 → بدون سقف (بدون تنبيه إطلاقًا)
   تُستخدم من شاشة البيع لتنبيه الكاشير فورًا عند وصول/تجاوز الذمم لسقف العميل */
function isOverCreditLimit(c, extra){
  if(!c || !c.creditLimit) return false;
  return (c.debt + (extra || 0)) >= c.creditLimit;
}

/* ---- الموردون ----
   balance: ما تدين به المنشأة لهذا المورد حاليًا (ذمم علينا) — يزيد بفاتورة شراء آجلة/جزئية، وينقص بتسديد دفعة له
   payments: سجل الدفعات التي دفعناها له [{amount, method, opNo, date}]
   invoiceIds: مرجع لفواتير الشراء منه (مصفوفة purchases) */
let suppliers = [];
(function loadSuppliersState(){
  try{
    const raw = localStorage.getItem('aps_suppliers_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(Array.isArray(saved) && saved.length) suppliers.length = 0, saved.forEach(s => suppliers.push(s));
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
/* يسجّل دفعة نقدية/محفظة للمورد ويحدّث رصيده — وإن كانت نقدية يخصمها فورًا من صندوق الفرع */
function addSupplierPayment(id, amount, method, opNo, branch){
  const s = suppliers.find(x => x.id === id);
  if(!s) return;
  amount = Math.max(0, Math.min(amount, s.balance));
  s.balance -= amount;
  s.payments = s.payments || [];
  s.payments.unshift({amount, method, opNo: opNo || '', date: (typeof nowStr === 'function' ? nowStr() : '')});
  persistSuppliers();
  if(method === 'نقدي' && branch && typeof addCashboxTx === 'function'){
    addCashboxTx(branch, {type:'دفعة مورد', desc:`تسديد دفعة إلى ${s.name}`, amount, direction:'out', method:'نقدي', ref:s.id});
  }
}

/* ---- الإتلاف (waste) ----
   سجل كل ما يُتلَف من المخزون (انتهاء صلاحية/عيوب تصنيع/عبوة مكسورة/كرتون مهروس/أخرى) مع الكمية والسبب والملاحظات
   يخصم فورًا من مخزون الفرع (products[].stock) عند التسجيل — لا يمكن التراجع عنه (كخصم مخزون حقيقي دائم)
   مرئي للكاشير بفرعه فقط؛ الإدارة (u1) ترى سجلًا كاملًا لكل الفروع + مقارنة بينها
   قد يكون الإتلاف جزءًا فقط من الكمية الموجودة للصنف (وليس كامل الكمية بالضرورة) */
const WASTE_REASONS = ['انتهاء الصلاحية', 'عيوب تصنيع', 'عبوة مكسورة', 'كرتون مهروس', 'أخرى'];
let wasteLog = [];
(function loadWasteLog(){
  try{
    const raw = localStorage.getItem('aps_waste_state');
    if(raw){ const saved = JSON.parse(raw); if(Array.isArray(saved)) wasteLog = saved; }
  }catch(e){}
})();
function persistWaste(){
  try{ localStorage.setItem('aps_waste_state', JSON.stringify(wasteLog)); }catch(e){}
}
/* يسجّل عملية إتلاف لصنف موجود في مخزون فرع معيّن، ويخصم الكمية فورًا من stock الخاص بذاك الفرع */
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
    branch: w.branch, productId: p.id, productName: p.name + (p.weight ? ` (${p.weight})` : ''),
    qty, unit: p.saleUnit || '', costAtTime: p.cost || 0,
    reason: w.reason, reasonNote: w.reasonNote || '', note: w.note || '',
    time: (typeof nowStr === 'function' ? nowStr() : '')
  };
  wasteLog.unshift(rec);
  persistWaste();
  if(typeof logAudit === 'function') logAudit('waste', w.branch, '', `إتلاف ${qty} ${p.saleUnit || ''} من ${p.name} — السبب: ${w.reason}`);
  return rec;
}
function wasteFor(branch){ return branch ? wasteLog.filter(w => w.branch === branch) : wasteLog; }

const invoices = [
  {id:'100482', barcode:'100482', branch:'u2', customer:'أبو خالد',     date:'2026-08-19 10:24',
   items:[{name:'أرز أبيض ممتاز 5كغ',qty:2,price:46000},{name:'زيت دوار الشمس 1.5ل',qty:1,price:26500},{name:'سكر أبيض 1كغ',qty:3,price:8500}],
   total:144500, paid:144500, status:'مكتملة'},
  {id:'100481', barcode:'100481', branch:'u2', customer:'مطعم الأصالة', date:'2026-08-19 09:50',
   items:[{name:'تونة قطع 170غ',qty:10,price:5500},{name:'بسكويت شوكولاتة',qty:6,price:3200}],
   total:74200, paid:40000, status:'آجل جزئي'},
  {id:'100480', barcode:'100480', branch:'u3', customer:'زبون نقدي',    date:'2026-08-18 17:12',
   items:[{name:'شاي أحمر 100 كيس',qty:2,price:11500},{name:'حليب طويل الأمد 1ل',qty:4,price:4800}],
   total:42200, paid:42200, status:'مكتملة'},
];
(function loadInvoicesState(){
  try{
    const raw = localStorage.getItem('aps_invoices_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(saved && Array.isArray(saved.list) && saved.list.length){ invoices.length = 0; saved.list.forEach(i => invoices.push(i)); }
    }
  }catch(e){}
})();
/* تُستدعى بعد أي تعديل على invoices (إضافة/تعديل/إلغاء فاتورة) لتبقى محفوظة بين فتحات الصفحة
   seq تُمرَّر من pos.html (متغيّر invSeq مُعرَّف هناك) لأن هذا الملف يُحمَّل قبله */
function persistInvoices(seq){
  try{ localStorage.setItem('aps_invoices_state', JSON.stringify({list: invoices, seq: seq})); }catch(e){}
}
/* يعيد رقم تسلسل الفاتورة التالي المحفوظ (إن وُجد) ليُستخدم كقيمة ابتدائية لـ invSeq في pos.html */
function loadInvoiceSeq(fallback){
  try{
    const raw = localStorage.getItem('aps_invoices_state');
    if(raw){ const saved = JSON.parse(raw); if(saved && saved.seq) return saved.seq; }
  }catch(e){}
  return fallback;
}

/* ---- فواتير الشراء (من الموردين) ----
   كل فاتورة شراء: مورد + فرع استلام البضاعة + أصناف (اسم/كمية/سعر تكلفة) + إجمالي + مدفوع/متبقي
   payMethod: 'cash' دفع كامل نقدًا فورًا من صندوق الفرع | 'partial' دفع جزء والباقي يضاف لذمة المورد (balance) | 'credit' آجل بالكامل
   عند الحفظ: تُضاف الكمية تلقائيًا لمخزون الفرع المحدد (نفس منطق شاشة المخزون) وتُحدَّث ذمة المورد ويُخصم النقدي من الصندوق */
let purchaseSeq = 9001; // تسلسل أرقام فواتير الشراء (Supabase autoincrement لاحقًا)
let purchases = [];
(function loadPurchasesState(){
  try{
    const raw = localStorage.getItem('aps_purchases_state');
    if(raw){
      const saved = JSON.parse(raw);
      if(saved && Array.isArray(saved.list)){ saved.list.forEach(p => purchases.push(p)); purchaseSeq = saved.seq || purchaseSeq; }
    }
  }catch(e){}
})();
function persistPurchases(){
  try{ localStorage.setItem('aps_purchases_state', JSON.stringify({list: purchases, seq: purchaseSeq})); }catch(e){}
}
/* ينشئ فاتورة شراء جديدة، يحدّث مخزون الفرع المستلِم، ذمة المورد، وصندوق الفرع إن وُجد دفع نقدي */
function addPurchase(p){
  const id = String(purchaseSeq);
  purchaseSeq += 1;
  const inv = {id, supplierId:p.supplierId, branch:p.branch, date:(typeof nowStr === 'function' ? nowStr() : ''),
               items:p.items, total:p.total, paid:p.paid, remaining:p.remaining, payMethod:p.payMethod, opNo:p.opNo || ''};
  purchases.unshift(inv);
  if(typeof logAudit === 'function'){
    const sup = suppliers.find(s => s.id === p.supplierId);
    logAudit('purchase', p.branch, id, `فاتورة شراء جديدة #${id} من ${sup ? sup.name : p.supplierId} بقيمة ${typeof fmtNum === 'function' ? fmtNum(p.total) : p.total} ل.س`);
  }
  persistPurchases();

  /* تحديث مخزون الفرع المستلِم — يضيف الكمية المشتراة لكل صنف */
  inv.items.forEach(it => {
    const prod = products.find(x => x.id === it.productId);
    if(prod){
      prod.stock[inv.branch] = (prod.stock[inv.branch] || 0) + it.qty;
      updateProduct(prod.id, {stock: prod.stock});
    }
  });

  /* تحديث ذمة المورد بالمتبقي (إن وُجد) */
  const sup = suppliers.find(x => x.id === inv.supplierId);
  if(sup){
    sup.balance = (sup.balance || 0) + inv.remaining;
    sup.invoiceIds = sup.invoiceIds || [];
    sup.invoiceIds.unshift(inv.id);
    persistSuppliers();
  }

  /* خصم المدفوع نقدًا من صندوق الفرع فورًا */
  if(inv.paid > 0 && typeof addCashboxTx === 'function'){
    addCashboxTx(inv.branch, {type:'فاتورة شراء', desc:`شراء بضاعة من ${sup ? sup.name : ''} (#${inv.id})`, amount: inv.paid, direction:'out', method:'نقدي', ref: inv.id});
  }
  return inv;
}

/* ---- طلبات التحويل بين الفروع ----
   fromUnit/toUnit: من الفروع الفعلية فقط (لا يوجد "الإدارة" كمخزون)
   حالات الطلب: بانتظار الموافقة → تمت الموافقة (يُخصم من فرع المصدر) → تم الاستلام (يُضاف لفرع الوجهة)
   أو: مرفوض (لا تغيير على المخزون) */
let transfers = [
  {id:'TR-020', fromUnit:'u2', toUnit:'u3', productId:'p4', qty:25, status:'تم الاستلام',       date:'2026-08-18', note:''},
  {id:'TR-019', fromUnit:'u3', toUnit:'u2', productId:'p3', qty:10, status:'تمت الموافقة',       date:'2026-08-24', note:''},
  {id:'TR-021', fromUnit:'u2', toUnit:'u3', productId:'p1', qty:15, status:'بانتظار الموافقة',   date:'2026-08-27', note:'نقص لدى الفرع الثاني'},
];
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
function addTransfer(t){ transfers.unshift(t); persistTransfers(); }
function updateTransferStatus(id, status){
  const t = transfers.find(x => x.id === id);
  if(!t) return false;
  t.status = status;
  persistTransfers();
  return true;
}

/* ---- الصندوق (لكل فرع فعلي مستقل — u1 "الإدارة" لا صندوق تشغيلي له، فقط تقرير موحّد لاحقًا) ----
   cashboxTx: كل حركة {id, branch, type, desc, amount, direction:'in'|'out', method, ref, time}
   ⚠️ نظام الورديات هنا شكلي فقط (لا يوجد تسجيل دخول/مستخدمين فعليًا بهذه المرحلة) —
   openingBalance/isOpen تُستخدم فقط لعرض "رصيد افتتاحي" وحساب "المتوقع" للمطابقة اليدوية، دون منع أي عملية بيع فعليًا */
let cashboxTx = [
  {id:'ctx1', branch:'u2', type:'مبيعات نقدية', desc:'مبيعات نقدية — فاتورة #100482', amount:144500, direction:'in',  method:'نقدي', ref:'100482', time:'2026-08-19 10:24'},
  {id:'ctx2', branch:'u2', type:'تحصيل دين',     desc:'دفعة من مطعم الأصالة',          amount:200000, direction:'in',  method:'نقدي', ref:'c1',     time:'2026-08-19 10:05'},
  {id:'ctx3', branch:'u2', type:'دفعة مورد',     desc:'تسديد دفعة إلى الوفاء لتجارة المعلبات', amount:300000, direction:'out', method:'نقدي', ref:'s3', time:'2026-08-19 11:20'},
  {id:'ctx4', branch:'u3', type:'مبيعات نقدية', desc:'مبيعات نقدية — فاتورة #100480', amount:42200,  direction:'in',  method:'نقدي', ref:'100480', time:'2026-08-18 17:12'},
];
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
/* يضيف حركة صندوق جديدة لفرع محدد (تُستدعى تلقائيًا من finishSale/addSupplierPayment/addPurchase، أو يدويًا من شاشة الصندوق) */
function addCashboxTx(branch, t){
  const tx = {id:'ctx' + Date.now() + Math.random().toString(36).slice(2,6), branch, time:(typeof nowStr === 'function' ? nowStr() : ''), ...t};
  cashboxTx.unshift(tx);
  persistCashbox();
  return tx;
}
/* الرصيد النقدي الحالي لفرع (كل الداخل − كل الخارج) — لا يشمل المحفظة/الآجل لأنها ليست نقدًا فعليًا بالدرج */
function cashboxBalance(branch){
  return cashboxTx.filter(t => t.branch === branch)
    .reduce((s, t) => s + (t.direction === 'in' ? t.amount : -t.amount), 0);
}
/* ---- حالة "الوردية" الشكلية لكل فرع — رصيد افتتاحي يدوي فقط، بدون تسجيل دخول فعلي ----
   openingBalance: يُدخله الكاشير يدويًا عند بدء يومه | openedAt: وقت الفتح الشكلي
   لا تمنع أي عملية بيع أو حركة صندوق — مجرد رقم مرجعي لحساب "المتوقع" عند المطابقة اليدوية لاحقًا */
let shiftState = { u2:{openingBalance:0, openedAt:null}, u3:{openingBalance:0, openedAt:null} };
(function loadShiftState(){
  try{
    const raw = localStorage.getItem('aps_shift_state');
    if(raw){ const saved = JSON.parse(raw); if(saved) shiftState = saved; }
  }catch(e){}
})();
function persistShiftState(){
  try{ localStorage.setItem('aps_shift_state', JSON.stringify(shiftState)); }catch(e){}
}
function openShift(branch, openingBalance){
  shiftState[branch] = {openingBalance: Number(openingBalance) || 0, openedAt: (typeof nowStr === 'function' ? nowStr() : '')};
  persistShiftState();
}
/* ---- سجل إغلاق الورديات (شكلي — للمطابقة اليدوية فقط، لا يُصفّر رصيد الصندوق الفعلي) ----
   عند الإغلاق: المتوقع = رصيد الصندوق الفعلي المتراكم حاليًا | المعدود = ما يُدخله الكاشير يدويًا | الفرق = المعدود − المتوقع */
let shiftLog = [];
(function loadShiftLog(){
  try{
    const raw = localStorage.getItem('aps_shift_log');
    if(raw){ const saved = JSON.parse(raw); if(Array.isArray(saved)) shiftLog = saved; }
  }catch(e){}
})();
function persistShiftLog(){
  try{ localStorage.setItem('aps_shift_log', JSON.stringify(shiftLog)); }catch(e){}
}
function closeShift(branch, counted){
  const st = shiftState[branch] || {openingBalance:0, openedAt:null};
  const expected = cashboxBalance(branch);
  const c = Number(counted) || 0;
  const entry = {id:'sh' + Date.now(), branch, openedAt: st.openedAt, closedAt: (typeof nowStr === 'function' ? nowStr() : ''),
                 opening: st.openingBalance, expected, counted: c, diff: c - expected};
  shiftLog.unshift(entry);
  persistShiftLog();
  shiftState[branch] = {openingBalance:0, openedAt:null};
  persistShiftState();
  return entry;
}
function shiftLogFor(branch){
  return shiftLog.filter(s => s.branch === branch);
}

/* ---- الإشعارات ----
   كل إشعار: targetUnit = الوحدة التي يظهر لها (أو 'all' لكل الوحدات) — يُقرأ عند فتح الجرس بنفس الفرع
   تُحفظ في localStorage لتبقى مشتركة بين كل التبويبات/الشاشات المفتوحة حاليًا
   لاحقًا مع Supabase: تصبح جدولاً حقيقيًا + Realtime تدفعها فور حدوثها بين الأجهزة المختلفة */
let notifications = [
  {id:'n1', title:'⏳ مواد قاربت على انتهاء الصلاحية — راجع شاشة المخزون', targetUnit:'all', time:'اليوم', read:false},
  {id:'n2', title:'دفعة مستلمة من مطعم الأصالة', targetUnit:'u2', time:'منذ ساعة', read:true},
];
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
/* يضيف إشعارًا محليًا + يبثّه فورًا لكل التبويبات المفتوحة (صوت + توست) */
function pushNotification(title, targetUnit, icon){
  const n = {id:'n' + Date.now(), title, targetUnit: targetUnit || 'all', time:'الآن', read:false};
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
  const uid = unitId || (typeof activeUnitId === 'function' ? activeUnitId() : null);
  return notificationsFor(uid).filter(n => !n.read).length;
}
function markAllNotifsRead(unitId){
  const uid = unitId || (typeof activeUnitId === 'function' ? activeUnitId() : null);
  notificationsFor(uid).forEach(n => n.read = true);
  persistNotifications();
}

const activityLog = [
  {who:'أحمد ناصر (مدير فرع)',        action:'وافق على طلب تحويل TR-020',              time:'قبل ساعة'},
  {who:'محمد كاشير',                   action:'أصدر فاتورة INV-100482 بقيمة 144,500 ل.س', time:'قبل ساعتين'},
  {who:'خالد يوسف (أمين مستودع)',     action:'سجّل فاتورة شراء جديدة من شركة الشرق',    time:'اليوم 09:10'},
  {who:'المدير العام',                 action:'أضاف فرعًا جديدًا: الفرع الثاني',         time:'أمس'},
];

/* ---- المستخدمون ----
   ⚠️ لا يوجد نظام دخول فعلي بكلمة مرور/رمز PIN بعد (مؤجّل لما بعد بناء قاعدة البيانات) —
   الدخول حاليًا فقط باختيار الوحدة من الشاشة الرئيسية. لذلك هذه القائمة تمثّل "مستخدم واحد لكل وحدة" حاليًا (وليست حسابات فردية حقيقية)،
   و"آخر دخول" وهمي تقريبي إلى حين إضافة نظام مستخدمين حقيقي متعدد لكل فرع */
const users = [
  {id:'u1', name:'الإدارة (مدير عام)', unit:'u1', role:'owner',   lastLogin:'اليوم 08:15'},
  {id:'u2', name:'كاشير الفرع الرئيسي', unit:'u2', role:'cashier', lastLogin:'اليوم 09:40'},
  {id:'u3', name:'كاشير الفرع الثاني',  unit:'u3', role:'cashier', lastLogin:'أمس 18:20'},
];

const weeklySales = [
  {d:'سبت', v:1800000},{d:'أحد', v:2100000},{d:'إثنين', v:1500000},
  {d:'ثلاثاء', v:2600000},{d:'أربعاء', v:2300000},{d:'خميس', v:1950000},{d:'اليوم', v:2450000}
];

const branchPerf = [
  {name:'الفرع الرئيسي', v:6200000},
  {name:'الفرع الثاني',  v:3900000},
];

/* ---- توزيع مبيعات الأسبوع بين الفروع لأغراض شاشة التقارير ----
   نفس بيانات weeklySales الإجمالية أعلاه لكنها مقسّمة بنسبة أداء الفرعين (branchPerf) — توضيحية إلى حين توفّر بيانات فعلية متراكمة لعدة أيام */
const weeklySalesByBranch = (function(){
  const total = branchPerf.reduce((s,b) => s + b.v, 0) || 1;
  const ratios = {u2: branchPerf[0].v / total, u3: branchPerf[1].v / total};
  const out = {u2:[], u3:[]};
  weeklySales.forEach(d => {
    out.u2.push({d:d.d, v:Math.round(d.v * ratios.u2)});
    out.u3.push({d:d.d, v:Math.round(d.v * ratios.u3)});
  });
  return out;
})();

/* ---- ساعات العمل لكل فرع — بيانات وهمية توضيحية حاليًا (لا يوجد نظام حضور/دخول فعلي بعد) ----
   ستُستبدل ببيانات حقيقية عند إضافة نظام حضور فعلي بكلمة مرور لكل مستخدم */
const branchWorkHours = {
  u2:{label:'8:00 ص – 10:00 م', hoursPerDay:14},
  u3:{label:'9:00 ص – 9:00 م',  hoursPerDay:12},
};

/* ---- سجل عمليات تعديل/إلغاء/استبدال/استرجاع الفواتير (من شاشة "تعديل فاتورة") ----
   type: 'edit' (حفظ تعديلات عامة) | 'cancel' (إلغاء فاتورة كاملة) | 'exchange' (استبدال صنف) | 'return' (إرجاع/حذف صنف)
   تُستخدم في شاشة التقارير لعرض عدد مرات كل عملية، إجماليًا ولكل فرع */
let auditLog = [];
(function loadAuditLog(){
  try{
    const raw = localStorage.getItem('aps_audit_log');
    if(raw){ const saved = JSON.parse(raw); if(Array.isArray(saved)) auditLog = saved; }
  }catch(e){}
})();
function persistAuditLog(){
  try{ localStorage.setItem('aps_audit_log', JSON.stringify(auditLog)); }catch(e){}
}
function logAudit(type, branch, invoiceId, desc){
  auditLog.unshift({id:'aud'+Date.now()+Math.random().toString(36).slice(2,6), type, branch, invoiceId, desc, time:(typeof nowStr === 'function' ? nowStr() : '')});
  persistAuditLog();
}


if (typeof window !== 'undefined') {
  window.MAIN_CATS = MAIN_CATS;
  window.SUB_CATS = SUB_CATS;
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
      console.log("✅ Customer updated in Supabase:", c.id);
    } else {
      const inserted = await supabaseFetch("customers", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify([payload])
      });
      if (inserted && inserted[0]) {
        c.id = inserted[0].id;
        console.log("✅ New Customer created in Supabase:", c.id);
      }
    }
  } catch (err) {
    console.error("Error saving customer to Supabase:", err);
  }
}

async function saveSaleToSupabase(inv) {
  try {
    const bId = inv.branch || (typeof activeUnitId === 'function' ? activeUnitId() : 'u2');
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
      console.log("✅ Sales invoice saved in Supabase:", dbInvId, invNumberStr);

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

      // Deduct stock in Supabase for this branch location
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
    console.error("Error saving sale to Supabase:", e);
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
      console.log("✅ Supplier updated in Supabase:", s.id);
    } else {
      const inserted = await supabaseFetch("suppliers", {
        method: "POST",
        headers: { "Prefer": "return=representation" },
        body: JSON.stringify([payload])
      });
      if (inserted && inserted[0]) {
        s.id = inserted[0].id;
        console.log("✅ New Supplier created in Supabase:", s.id);
      }
    }
  } catch (err) {
    console.error("Error saving supplier to Supabase:", err);
  }
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
      console.log("✅ Purchase invoice saved in Supabase:", dbInvId);

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
    console.error("Error saving purchase to Supabase:", e);
  }
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

    console.log("✅ Waste adjustment saved in Supabase:", w.productId);
  } catch (err) {
    console.error("Error saving waste to Supabase:", err);
  }
}
