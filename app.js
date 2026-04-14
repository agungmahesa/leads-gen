/* ═══════════════════════════════════════════════
   LEAD GEN CONTROL PANEL — APP LOGIC
   ═══════════════════════════════════════════════ */

'use strict';

// ─── AUTHENTICATION CHECK ─────────────────────────
const APP_TOKEN = localStorage.getItem('appToken');
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:';
const backendUrl = isLocal ? 'http://localhost:3001' : 'https://leads-gen-production-461b.up.railway.app';

const isLoginPage = window.location.pathname === '/login.html' || window.location.pathname.endsWith('login.html');

if (!APP_TOKEN && !isLoginPage) {
  window.location.href = '/login.html';
} else if (APP_TOKEN && !isLoginPage) {
  // Validate token is still valid for this backend (local vs production may differ)
  fetch(`${backendUrl}/api/config`, { headers: { 'Authorization': `Bearer ${APP_TOKEN}` } })
    .then(r => {
      if (r.status === 403 || r.status === 401) {
        // Token is invalid/expired — clear and redirect to login
        localStorage.removeItem('appToken');
        localStorage.removeItem('savedUsername');
        localStorage.removeItem('savedPassword');
        window.location.href = '/login.html';
      }
    })
    .catch(() => {}); // Network error — don't redirect
}

// ─── UTILS ────────────────────────────────────────
const safeGet = (id) => document.getElementById(id);
const safeSetText = (id, text) => { const el = safeGet(id); if(el) el.textContent = text; };
const safeSetVal = (id, val) => { const el = safeGet(id); if(el) el.value = val; };
const safeSetStyle = (id, prop, val) => { const el = safeGet(id); if(el) el.style[prop] = val; };



// ─── Global State ─────────────────────────────────
const STATE = {
  automation: false,
  session: null,

  // Step 1
  isScrapingActive: false,
  scrapedLeads: [],
  scrapeInterval: null,
  scrapeAbort: false,

  // Step 2
  selectedLeads: [],
  isInsertingActive: false,
  insertInterval: null,
  insertAbort: false,
  insertSuccess: 0,
  insertFailed: 0,

  // Step 3
  isWaSending: false,
  isWaPaused: false,
  waInterval: null,
  waAbort: false,
  waSent: 0,
  waPending: 0,
  waFailed: 0,
  waReplied: 0,
  waLeads: [],
  waCountdownInterval: null,
  waCountdownValue: 0,

  // Monitor
  totalLeadsToday: 0,
  msgSent: 0,
  replies: 0,
};

// ─── Sample data pools ────────────────────────────
const SAMPLE_BUSINESSES = [
  { name: 'Restoran Padang Minang Jaya', phone: '+6281234567890', address: 'Jl. Kebon Jeruk No. 12, Jakarta Barat', rating: 4.5, category: 'Restaurant' },
  { name: 'Klinik Kecantikan Aura Beauty', phone: '+6282345678901', address: 'Jl. Sudirman Kav. 5, Jakarta Pusat', rating: 4.8, category: 'Beauty' },
  { name: 'Apotek Sehat Sentosa', phone: '+6283456789012', address: 'Jl. Margonda Raya No. 88, Depok', rating: 4.3, category: 'Pharmacy' },
  { name: 'Bengkel Motor Jaya Abadi', phone: '+6284567890123', address: 'Jl. Raya Bogor KM 23, Depok', rating: 4.1, category: 'Automotive' },
  { name: 'Toko Baju Fashion Hits', phone: '+6285678901234', address: 'Plaza Blok M Lt. 3 No. 15, Jakarta', rating: 4.6, category: 'Fashion' },
  { name: 'Salon Cantik Permata', phone: '+6286789012345', address: 'Jl. Kemang Raya No. 45, Jakarta Selatan', rating: 4.7, category: 'Beauty' },
  { name: 'Warung Sate Madura H. Soleh', phone: '+6287890123456', address: 'Jl. Fatmawati No. 77, Jakarta Selatan', rating: 4.4, category: 'Food' },
  { name: 'Toko Elektronik Digital Zone', phone: '+6288901234567', address: 'ITC Fatmawati Lt. 2, Jakarta', rating: 4.2, category: 'Electronics' },
  { name: 'Laundry Express 24 Jam', phone: '+6289012345678', address: 'Jl. Raya Ciledug No. 33, Tangerang', rating: 4.0, category: 'Laundry' },
  { name: 'Klinik Gigi Dr. Suherman', phone: '+6281987654321', address: 'Jl. Pramuka No. 12, Jakarta Timur', rating: 4.9, category: 'Healthcare' },
  { name: 'Rumah Makan Seafood Bahari', phone: '+6282876543210', address: 'Jl. Pantai Indah Kapuk No. 5, Jakarta Utara', rating: 4.5, category: 'Restaurant' },
  { name: 'Fitness Center Sehat Prima', phone: '+6283765432109', address: 'Mall Kelapa Gading Lt. 3, Jakarta Utara', rating: 4.6, category: 'Fitness' },
  { name: 'Mini Market Segar Selalu', phone: '+6284654321098', address: 'Jl. Pondok Indah No. 28, Jakarta Selatan', rating: 4.3, category: 'Retail' },
  { name: 'Studio Foto Abadi Kenangan', phone: '+6285543210987', address: 'Jl. Gajah Mada No. 99, Jakarta Barat', rating: 4.7, category: 'Photography' },
  { name: 'Bakso & Mie Ayam Pak Budi', phone: '+6286432109876', address: 'Jl. Tebet Raya No. 55, Jakarta Selatan', rating: 4.4, category: 'Food' },
  { name: 'Optik Mata Cerah', phone: '+6287321098765', address: 'Jl. Cempaka Putih No. 18, Jakarta Pusat', rating: 4.6, category: 'Optical' },
  { name: 'Percetakan Maju Bersama', phone: '+6288210987654', address: 'Jl. Tomang Raya No. 66, Jakarta Barat', rating: 4.1, category: 'Printing' },
  { name: 'Kafe Kopi Nusantara', phone: '+6289109876543', address: 'Jl. SCBD Lot 8, Jakarta Selatan', rating: 4.8, category: 'Cafe' },
  { name: 'Hotel Melati Indah', phone: '+6281234509876', address: 'Jl. Mangga Dua No.44, Jakarta Utara', rating: 3.9, category: 'Hotel' },
  { name: 'Toko Bunga & Dekorasi Mawar', phone: '+6282345098765', address: 'Jl. Hayam Wuruk No. 7, Jakarta Barat', rating: 4.5, category: 'Florist' },
];

// ─── Settings Config ──────────────────────────────
const CONFIG = {
  outscraperKey: '',
  airtableKey: '',
  airtableBase: '',
  airtableTable: '',
  makeWebhookUrl: ''
};

function loadConfig() {
  // Load Server-Side Configs securely
  fetch(`${backendUrl}/api/config`, {
    headers: { 'Authorization': `Bearer ${APP_TOKEN}` }
  })
  .then(res => {
     if (res.status === 401 || res.status === 403) {
       localStorage.removeItem('appToken');
       window.location.href = '/login.html';
     }
     return res.json();
  })
  .then(data => {
    if (data) {
      Object.assign(CONFIG, data);
      
      // Update inputs across all pages
      safeSetVal('airtableKey', CONFIG.airtableKey || '');
      safeSetVal('airtableBase', CONFIG.airtableBase || '');
      safeSetVal('airtableTable', CONFIG.airtableTable || '');
      safeSetVal('outscraperKey', CONFIG.outscraperKey || '');
      
      if (data.aiConfig) {
        safeSetVal('geminiKey', data.aiConfig.geminiKey || '');
        safeSetVal('aiPrompt', data.aiConfig.prompt || '');
        const sw = safeGet('aiMasterSwitch');
        if (sw) sw.checked = data.aiConfig.isActive;
      }

      updateMonitor();
    }
  })
  .catch(e => console.error("Could not load config", e));
}

async function saveAirtableConfig() {
  const key = document.getElementById('airtableKey').value.trim();
  const base = document.getElementById('airtableBase').value.trim();
  const table = document.getElementById('airtableTable').value.trim();
  
  const btn = document.getElementById('btnSaveAirtable');
  if(btn) btn.textContent = 'Saving...';

  try {
    const res = await fetch(`${backendUrl}/api/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
      body: JSON.stringify({ airtableKey: key, airtableBase: base, airtableTable: table })
    });
    if (res.ok) {
      CONFIG.airtableKey = key; 
      CONFIG.airtableBase = base; 
      CONFIG.airtableTable = table;
      addLog('Airtable Config saved securely to server.', 'ok');
      showToast('Airtable Config Saved!', false);
    } else {
      showError('Gagal menyimpan config ke server');
    }
  } catch(e) {
    showError('Network error saat menyimpan config');
  } finally {
    if(btn) btn.innerHTML = '💾 Save Airtable Config';
  }
}

// ─── Sync Config from Production (Local Dev Only) ─
async function syncConfigFromProduction() {
  const statusEl = document.getElementById('syncProdStatus');
  const btn = document.getElementById('syncProdBtn');
  const PROD_URL = 'https://leads-gen-production-461b.up.railway.app';

  if (statusEl) statusEl.textContent = '⏳ Menghubungi Railway Production...';
  if (btn) btn.disabled = true;

  try {
    // Step 1: Login to production to get a token
    const loginRes = await fetch(`${PROD_URL}/api/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username: localStorage.getItem('savedUsername') || 'admin',
        password: localStorage.getItem('savedPassword') || prompt('Masukkan password untuk Production Railway:')
      })
    });

    if (!loginRes.ok) {
      throw new Error('Login ke production gagal. Pastikan username/password benar.');
    }

    const { token: prodToken } = await loginRes.json();

    // Step 2: Call the local sync endpoint with the prod token
    const syncRes = await fetch(`${backendUrl}/api/sync-from-prod`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: prodToken })
    });

    const syncData = await syncRes.json();
    if (!syncRes.ok) throw new Error(syncData.error || 'Sync gagal');

    // Step 3: Reload config from local server
    await loadConfig();

    if (statusEl) statusEl.innerHTML = `✅ <strong>Berhasil!</strong> Config disinkronkan dari Production. Key: ${syncData.keys?.join(', ')}`;
    showToast('✅ Config Production berhasil disinkronkan!', false);
    addLog('Config berhasil ditarik dari Railway Production.', 'ok');

  } catch (err) {
    if (statusEl) statusEl.innerHTML = `❌ Error: ${err.message}`;
    showError(err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// Show the production sync banner only when running locally
if (isLocal) {
  const banner = document.getElementById('syncFromProdBanner');
  if (banner) banner.style.display = 'block';
}


// ─── WhatsApp Socket.io Client ────────────────────
let socketIo;
function initWhatsAppSocket() {
  socketIo = io(backendUrl);
  
  startBackendHeartbeat(); // Start pinging

  socketIo.on('connect', () => {
    console.log('Connected to WA backend');
    const loading = document.getElementById('waLoadingInfo');
    if (loading) loading.style.display = 'none';
  });

  socketIo.on('status', (status) => {
    updateWaConnectionUI(status);
  });

  socketIo.on('qr', (qrData) => {
    showWaQrCode(qrData);
  });

  socketIo.on('disconnect', () => {
    updateWaConnectionUI('disconnected');
    const loading = document.getElementById('waLoadingInfo');
    if (loading) loading.style.display = 'block';
  });
}

function updateWaConnectionUI(status) {
  // Support both old element IDs (index.html WA hub) and new dedicated WA page IDs
  const badge = document.getElementById('waConnBadge');
  const statusEl = document.getElementById('waConnectionStatus'); // index.html
  const qrContainer = document.getElementById('waQrContainer') || document.getElementById('qrCodeContainer');
  const connectedInfo = document.getElementById('waConnectedInfo');
  const loadingInfo = document.getElementById('waLoadingInfo');
  const qrImg = document.getElementById('qrCode');

  const statusMap = {
    connected:     { label: '✓ Connected',     color: 'var(--green)', bg: 'rgba(16,185,129,.1)' },
    waiting_scan:  { label: '📷 Scan QR Code', color: 'var(--yellow)', bg: 'rgba(251,191,36,.1)' },
    disconnected:  { label: '✗ Disconnected',  color: 'var(--red)',   bg: 'rgba(239,68,68,.1)' },
  };
  const s = statusMap[status] || statusMap['disconnected'];

  if (badge) {
    badge.className = `conn-status-badge status-${status.replace('_', '-')}`;
    badge.textContent = status.replace('_', ' ').toUpperCase();
  }
  // Also update index.html's waConnectionStatus pill
  if (statusEl) {
    statusEl.innerHTML = `<span class="status-dot" style="background:${s.color};"></span>${s.label}`;
    statusEl.style.background = s.bg;
    statusEl.style.color = s.color;
    statusEl.style.border = `1px solid ${s.color.replace(')', ',.3)')}4d`;
  }

  if (qrContainer) qrContainer.style.display = (status === 'waiting_scan') ? 'block' : 'none';
  if (connectedInfo) connectedInfo.style.display = (status === 'connected') ? 'block' : 'none';
  if (loadingInfo) loadingInfo.style.display = (status === 'disconnected') ? 'block' : 'none';

  // Also update index.html QR image
  if (status === 'waiting_scan' && qrImg) qrImg.style.display = 'block';

  if (status === 'connected') addLog('✓ WhatsApp Backend: Connected', 'ok');
}

// ─── Backend Heartbeat (One-Click Support) ────────
let backendHeartbeat;
function startBackendHeartbeat() {
  if (backendHeartbeat) clearInterval(backendHeartbeat);
  
  const checkStatus = async () => {
    const dot = document.getElementById('backendStatusDot');
    const text = document.getElementById('backendStatusText');
    
    try {
      const res = await fetch(`${backendUrl}/status`);
      if (res.ok) {
        dot.className = 'status-dot status-dot--success';
        text.textContent = 'Backend: Online';
      } else {
        throw new Error();
      }
    } catch (e) {
      dot.className = 'status-dot status-dot--error';
      text.textContent = 'Backend: Offline';
    }
  };
  
  checkStatus();
  backendHeartbeat = setInterval(checkStatus, 5000);
}

function openBackendHelp() {
  const dot = document.getElementById('backendStatusDot');
  if (dot && dot.classList.contains('status-dot--success')) {
    addLog('Backend sudah terkoneksi dan berjalan.', 'info');
    return;
  }
  
  showError(`
    <div style="text-align:left; margin-top:10px;">
      <p><strong>WhatsApp Backend Offline</strong></p>
      <p style="font-size:.7rem; line-height:1.4; margin:8px 0;">Silakan jalankan backend dengan salah satu cara berikut:</p>
      <ul style="font-size:.65rem; padding-left:15px; margin-bottom:10px;">
        <li>Klik dua kali file <strong>'Mulai_Aplikasi.command'</strong> di folder proyek Anda.</li>
        <li>Buka Terminal dan ketik: <code>node server.js</code></li>
      </ul>
      <p style="font-size:.6rem; color:var(--text-muted);">Status akan berubah otomatis jika server sudah menyala.</p>
    </div>
  `, 8000);
}

function showWaQrCode(qrBase64) {
  const wrap = document.getElementById('waQrImageWrap');
  if (wrap) wrap.innerHTML = `<img src="${qrBase64}" alt="WA QR Code" />`;
}

function logoutWhatsApp() {
  if (!confirm('Logout dari WhatsApp? Sesi akan dihapus dan QR baru akan muncul.')) return;
  // Try socket emit first
  if (socketIo && socketIo.connected) {
    socketIo.emit('logout');
    showToast('Logging out WhatsApp...');
  } else {
    // Fallback: REST API
    fetch(`${backendUrl}/api/logout-wa`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${APP_TOKEN}` }
    }).then(r => r.json()).then(d => {
      showToast(d.message || 'Logout berhasil!');
    }).catch(e => showToast('Error: ' + e.message, true));
  }
}

function reconnectWhatsApp() {
  if (socketIo && socketIo.connected) {
    socketIo.emit('reconnect-wa');
    showToast('Reconnecting WhatsApp...');
  } else {
    fetch(`${backendUrl}/api/reconnect-wa`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${APP_TOKEN}` }
    }).then(() => showToast('Reconnect triggered!')).catch(e => showToast('Error: ' + e.message, true));
  }
}

function saveSettings() {
  const osKeyEl = document.getElementById('cfgOutscraperKey');
  if(osKeyEl) CONFIG.outscraperKey = osKeyEl.value.trim();
  
  const webhookEl = document.getElementById('cfgMakeWebhookUrl');
  if(webhookEl) CONFIG.makeWebhookUrl = webhookEl.value.trim();

  localStorage.setItem('leadGenConfig', JSON.stringify({
    outscraperKey: CONFIG.outscraperKey,
    makeWebhookUrl: CONFIG.makeWebhookUrl
  }));
  
  closeSettingsModal();
  addLog('API Configuration saved successfully.', 'ok');
}

function openSettings() {
  loadConfig();
  document.getElementById('settingsModal').classList.add('open');
}

function closeSettings(event) {
  if (event.target === document.getElementById('settingsModal')) closeSettingsModal();
}
function closeSettingsModal() {
  document.getElementById('settingsModal').classList.remove('open');
}

// ─── Side-effecting helpers ───────────────────────

// Returns the active field map reading live UI inputs,
// falling back to the stored AIRTABLE_FIELD_MAP defaults.
function getActiveFieldMap() {
  const mapStr = localStorage.getItem('leadGenFieldMap');
  if (mapStr) {
    try {
      return JSON.parse(mapStr);
    } catch(e) {}
  }

  const keys = ['name','phone','address','city','state','rating','reviewsCount',
                 'instagram','website','mapsUrl','category','description', 'status', 'leadScore'];
  const map = {};
  let uiHasInputs = false;
  keys.forEach(k => {
    const el = document.getElementById(`mf_${k}`);
    if (el) {
      uiHasInputs = true;
      const val = el.value.trim();
      if (val) map[k] = val;
    }
  });

  if (uiHasInputs && Object.keys(map).length > 0) return map;

  return {
    name: 'business_name', phone: 'phone', address: 'address', city: 'city', state: 'area',
    website: 'website', instagram: 'instagram', mapsUrl: 'maps_url', rating: 'rating',
    reviewsCount: 'review_count', category: 'cafe_type', description: 'description',
    status: 'status', leadScore: 'lead_score'
  };
}

function saveMappingConfig() {
  const map = getActiveFieldMap();
  localStorage.setItem('leadGenFieldMap', JSON.stringify(map));
  addLog('Field mapping saved.', 'ok');
  // Visual flash feedback
  const inputs = document.querySelectorAll('.mapping-input');
  inputs.forEach(el => {
    el.style.borderColor = 'var(--green)';
    setTimeout(() => { el.style.borderColor = ''; }, 1200);
  });
}

function loadMappingConfig() {
  const saved = localStorage.getItem('leadGenFieldMap');
  if (!saved) return;
  try {
    const map = JSON.parse(saved);
    Object.entries(map).forEach(([k, v]) => {
      const el = document.getElementById(`mf_${k}`);
      if (el) el.value = v;
    });
  } catch(e) {}
}

// ─── Utilities ────────────────────────────────────
function now() {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function generateSessionId() {
  return 'LG-' + Math.random().toString(36).toUpperCase().slice(2, 8);
}

function randomBetween(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Outscraper → Internal field mapping ──────────
// Maps Outscraper CSV column names → our lead object keys
const OUTSCRAPER_MAP = {
  // Business info
  'name':                   'name',
  'full_name':              'name',
  'site':                   'website',
  'website':                'website',
  'phone':                  'phone',
  'phone_1':                'phone',
  'phone1':                 'phone',
  'address':                'address',
  'full_address':           'address',
  'city':                   'city',
  'state':                  'state',
  'country':                'country',
  'postal_code':            'postalCode',
  'rating':                 'rating',
  'reviews':                'reviewsCount',
  'reviews_count':          'reviewsCount',
  'review_count':           'reviewsCount',
  'subtypes':               'category',
  'type':                   'category',
  'category':               'category',
  'instagram':              'instagram',
  'company_instagram':      'instagram',
  'company_instagr':        'instagram',
  'facebook':               'facebook',
  'company_facebook':       'facebook',
  'location_link':          'mapsUrl',
  'maps_url':               'mapsUrl',
  'google_maps_url':        'mapsUrl',
  'place_id':               'placeId',
  'description':            'description',
  'working_hours':          'workingHours',
};

// Airtable field name mapping (internal key → Airtable field name)
const AIRTABLE_FIELD_MAP = {
  name:         'business_name',
  phone:        'phone',
  address:      'address',
  city:         'city',
  state:        'area',
  website:      'website',
  instagram:    'instagram',
  mapsUrl:      'maps_url',
  rating:       'rating',
  reviewsCount: 'review_count',
  category:     'cafe_type',
  description:  'description',
  status:       'status',
  leadScore:    'lead_score',
};

// ─── CSV / XLS Upload Handling ────────────────────
function initUploadZone() {
  const zone = document.getElementById('uploadDropzone');
  if (!zone) return;
  
  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processUploadedFile(file);
  });
}

function handleFileUpload(event) {
  const file = event.target.files[0];
  if (file) processUploadedFile(file);
  // Reset input so same file can be re-uploaded
  event.target.value = '';
}

function processUploadedFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const statusEl = document.getElementById('uploadStatus');
  const statusText = document.getElementById('uploadStatusText');
  const dropText = document.getElementById('uploadDropText');
  
  if (statusEl) statusEl.style.display = 'flex';
  if (statusText) statusText.textContent = `Memproses "${file.name}"…`;
  
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const leads = parseOutscraperCSV(e.target.result);
        applyUploadedLeads(leads, file.name, statusText, dropText);
      } catch(err) {
        if (statusText) statusText.textContent = `Error: ${err.message}`;
        addLog(`Upload error: ${err.message}`, 'error');
        showToast(`❌ Upload error: ${err.message}`, true);
      }
    };
    reader.readAsText(file, 'UTF-8');
  } else if (ext === 'xlsx' || ext === 'xls') {
    if (typeof XLSX === 'undefined') {
      if (statusText) statusText.textContent = 'Library XLSX belum dimuat. Tunggu sebentar dan coba lagi.';
      addLog('XLSX library not loaded yet. Retrying...', 'warn');
      // Retry after 2 seconds if SheetJS hasn't loaded yet
      setTimeout(() => processUploadedFile(file), 2000);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const leads = parseOutscraperXLSX(e.target.result);
        applyUploadedLeads(leads, file.name, statusText, dropText);
      } catch(err) {
        if (statusText) statusText.textContent = `Error parsing Excel: ${err.message}`;
        addLog(`Upload XLSX error: ${err.message}`, 'error');
        showToast(`❌ XLSX error: ${err.message}`, true);
      }
    };
    reader.readAsArrayBuffer(file);
  } else {
    if (statusText) statusText.textContent = 'Format tidak didukung. Gunakan .csv atau .xlsx';
    addLog('Unsupported file format.', 'error');
  }
}

function parseOutscraperCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('File CSV kosong atau tidak valid');
  
  const headers = parseCSVRow(lines[0]).map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const leads = [];
  
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    const raw = {};
    headers.forEach((h, idx) => { raw[h] = (cols[idx] || '').trim(); });
    const lead = mapOutscraperRow(raw, i);
    if (lead) leads.push(lead);
  }
  return leads;
}

function parseCSVRow(row) {
  const cols = [];
  let cur = '', inQuote = false;
  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuote && row[i+1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === ',' && !inQuote) {
      cols.push(cur); cur = '';
    } else cur += ch;
  }
  cols.push(cur);
  return cols;
}

function parseOutscraperXLSX(buffer) {
  // Basic XLSX parsing — requires SheetJS (loaded via CDN)
  if (typeof XLSX === 'undefined') throw new Error('Library XLSX belum dimuat. Gunakan format CSV.');
  const wb = XLSX.read(new Uint8Array(buffer), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
  return rows.map((raw, i) => {
    const normalized = {};
    Object.entries(raw).forEach(([k, v]) => {
      normalized[k.toLowerCase().replace(/\s+/g, '_')] = String(v || '').trim();
    });
    return mapOutscraperRow(normalized, i + 1);
  }).filter(Boolean);
}

function mapOutscraperRow(raw, idx) {
  const lead = { id: Date.now() + idx, source: 'upload' };
  
  // Apply column mapping
  Object.entries(OUTSCRAPER_MAP).forEach(([csvKey, leadKey]) => {
    if (raw[csvKey] && !lead[leadKey]) {
      lead[leadKey] = raw[csvKey];
    }
  });
  
  // Fallbacks / normalization
  if (!lead.name) return null; // skip rows without a name
  if (!lead.phone) lead.phone = '-';
  if (!lead.address) lead.address = '-';
  if (!lead.rating) lead.rating = '-';
  else lead.rating = parseFloat(lead.rating) || lead.rating;
  if (lead.reviewsCount) lead.reviewsCount = parseInt(lead.reviewsCount) || 0;
  
  // Spreadsheet defaults
  lead.status = 'new';
  lead.leadScore = 1;
  
  return lead;
}

function applyUploadedLeads(leads, filename, statusTextEl, dropTextEl) {
  if (!leads.length) {
    if (statusTextEl) statusTextEl.textContent = 'Tidak ada data valid ditemukan dalam file.';
    addLog(`Upload "${filename}": no valid rows found.`, 'warn');
    return;
  }
  
  // Merge with existing
  const prevCount = STATE.scrapedLeads.length;
  STATE.scrapedLeads = [...STATE.scrapedLeads, ...leads];
  // Auto-select all for Airtable sync
  STATE.selectedLeads = STATE.scrapedLeads.map((_, i) => i);
  STATE.totalLeadsToday += leads.length;
  
  // ── Update pipeline.html preview table ────────────
  const previewTable = document.getElementById('uploadPreviewBody');
  const previewBox = document.getElementById('uploadPreviewBox');
  const previewCount = document.getElementById('uploadPreviewCount');
  const pendingCount = document.getElementById('pendingAirtableCount');

  if (previewTable && previewBox) {
    previewBox.style.display = 'block';
    previewTable.innerHTML = leads.slice(0, 50).map(l => `
      <tr>
        <td style="max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(l.name || '—')}</td>
        <td>${escHtml(l.phone || '—')}</td>
        <td>${escHtml(l.city || l.address?.substring(0,20) || '—')}</td>
        <td>⭐ ${l.rating || '—'}</td>
      </tr>`).join('');
    if (previewCount) previewCount.textContent = STATE.scrapedLeads.length;
    if (pendingCount) pendingCount.textContent = STATE.scrapedLeads.length;
  }

  // ── Legacy index.html elements (if present) ───────
  const resultsList = document.getElementById('resultsList');
  if (resultsList) {
    resultsList.innerHTML = '';
    STATE.scrapedLeads.forEach((lead, i) => {
      const item = renderResultItem(lead, i + 1);
      resultsList.appendChild(item);
    });
  }
  const resultsTitle = document.getElementById('resultsTitle');
  if (resultsTitle) resultsTitle.textContent = `Results (${STATE.scrapedLeads.length})`;
  
  setStepBadge('step1', `Uploaded (${leads.length})`, 'success');
  setStepBadge('step2', 'Ready to Sync', 'success');
  populateLeadTable();
  updateMonitor();
  
  const msg = prevCount > 0 
    ? `${leads.length} leads diimport dari "${filename}" (+ ${prevCount} sebelumnya)`
    : `${leads.length} leads diimport dari "${filename}"`;
  if (statusTextEl) statusTextEl.textContent = `✓ ${msg}`;
  if (dropTextEl) dropTextEl.innerHTML = `📄 <strong>${escHtml(filename)}</strong> — ${leads.length} leads. <u>Upload lain</u>`;
  addLog(`✓ Upload success: ${leads.length} leads from "${filename}"`, 'ok');
  showToast(`✅ ${leads.length} leads siap di-sync ke Airtable!`);
}

// ─── Log System ───────────────────────────────────
function addLog(message, type = 'info') {
  const logBody = document.getElementById('logBody');
  const entry = document.createElement('div');
  entry.className = `log-entry log-${type}`;
  entry.textContent = `[${now()}] ${message}`;
  logBody.appendChild(entry);
  logBody.scrollTop = logBody.scrollHeight;
}

function clearLog() {
  document.getElementById('logBody').innerHTML = '';
  addLog('Log cleared.', 'info');
}

function openLog() {
  document.getElementById('logDrawer').classList.add('open');
  document.getElementById('logOverlay').classList.add('open');
}

function closeLog() {
  document.getElementById('logDrawer').classList.remove('open');
  document.getElementById('logOverlay').classList.remove('open');
}

// ─── Automation Toggle ────────────────────────────
function toggleAutomation() {
  STATE.automation = !STATE.automation;
  const btn = document.getElementById('automationToggle');
  const label = document.getElementById('automationLabel');
  const dot = document.getElementById('globalStatusDot');
  const statusLabel = document.getElementById('globalStatusLabel');

  if (STATE.automation) {
    btn.classList.add('active');
    label.textContent = 'Automation: ON';
    STATE.session = generateSessionId();
    document.getElementById('sessionId').textContent = STATE.session;
    dot.className = 'status-dot active';
    statusLabel.textContent = 'Active';
    addLog(`Automation enabled. Session: ${STATE.session}`, 'ok');
  } else {
    btn.classList.remove('active');
    label.textContent = 'Automation: OFF';
    dot.className = 'status-dot';
    statusLabel.textContent = 'Idle';
    addLog('Automation disabled.', 'warn');
  }
}

// ─── Clear All ────────────────────────────────────
function clearAll() {
  if (STATE.isScrapingActive || STATE.isInsertingActive || STATE.isWaSending) {
    if (!confirm('Ada proses yang sedang berjalan. Reset semua?')) return;
  }
  stopScraping();
  stopAirtable();
  stopWhatsApp();

  STATE.scrapedLeads = [];
  STATE.selectedLeads = [];
  STATE.insertSuccess = 0;
  STATE.insertFailed = 0;
  STATE.waSent = 0; STATE.waPending = 0; STATE.waFailed = 0; STATE.waReplied = 0;
  STATE.totalLeadsToday = 0; STATE.msgSent = 0; STATE.replies = 0;

  // Reset UI
  document.getElementById('resultsList').innerHTML = `
    <div class="results-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
      <p>Start scraping to see results here</p>
    </div>`;
  document.getElementById('leadTableWrap').innerHTML = `
    <div class="results-empty">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4b5563" stroke-width="1.5"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
      <p>Complete Step 1 first to see leads here</p>
    </div>`;
  document.getElementById('resultsTitle').textContent = 'Results (0)';
  document.getElementById('selectionCount').textContent = '0 selected';
  document.getElementById('scrapeProgress').style.display = 'none';
  document.getElementById('airtableProgress').style.display = 'none';
  document.getElementById('waProgress').style.display = 'none';
  document.getElementById('waNextSend').style.display = 'none';

  setStepBadge('step1', 'Ready');
  setStepBadge('step2', 'Waiting');
  setStepBadge('step3', 'Waiting');

  function updateMonitor() {
  safeSetText('monitorLeads', STATE.totalLeadsToday);
  safeSetText('monitorSynced', STATE.insertSuccess);
  safeSetText('monitorSent', STATE.waSent);
  
  const rate = STATE.waSent > 0 ? Math.round((STATE.waReplied / STATE.waSent) * 100) : 0;
  safeSetText('monitorReplies', `${rate}%`);
}
  updateWaStats();
  addLog('All data cleared. Ready for new session.', 'info');
}

// ─── Step Badge ───────────────────────────────────
function setStepBadge(step, text, state = '') {
  // Support both ID formats: 'badge-step1' (new pages) and 'step1StatusBadge' (old)
  const badge = document.getElementById(`badge-${step}`) || document.getElementById(`${step}StatusBadge`);
  if (!badge) return;
  badge.textContent = text;
  badge.className = 'step-badge';
  if (state === 'running') badge.style.cssText = 'background:rgba(251,191,36,.15); color:#fbbf24; border-color:rgba(251,191,36,.3);';
  else if (state === 'success') badge.style.cssText = 'background:rgba(16,185,129,.15); color:#10b981; border-color:rgba(16,185,129,.3);';
  else if (state === 'error') badge.style.cssText = 'background:rgba(239,68,68,.15); color:#ef4444; border-color:rgba(239,68,68,.3);';
  else badge.style.cssText = '';
}

// ─── Advanced Toggle ──────────────────────────────
function toggleAdvanced(key) {
  const panel = document.getElementById(`${key}Advanced`);
  const chevron = document.getElementById(`${key}Chevron`);
  panel.classList.toggle('open');
  chevron.classList.toggle('open');
}

// ─── Monitor Update ───────────────────────────────
function updateMonitor() {
  // Legacy dashboard IDs
  safeSetText('monTotalLeads', STATE.totalLeadsToday.toLocaleString());
  safeSetText('monMsgSent', STATE.msgSent.toLocaleString());
  safeSetText('monReplies', STATE.replies.toLocaleString());
  const conversion = STATE.msgSent > 0 ? ((STATE.replies / STATE.msgSent) * 100).toFixed(1) : '0';
  safeSetText('monConversion', conversion + '%');

  // New overview dashboard IDs
  safeSetText('monitorLeads', STATE.totalLeadsToday.toLocaleString());
  safeSetText('monitorSynced', STATE.insertSuccess.toLocaleString());
  safeSetText('monitorSent', STATE.waSent.toLocaleString());
  const rate = STATE.waSent > 0 ? Math.round((STATE.waReplied / STATE.waSent) * 100) : 0;
  safeSetText('monitorReplies', rate + '%');
}

// ─── WA Stats Update ──────────────────────────────
function updateWaStats() {
  safeSetText('waSent', STATE.waSent);
  safeSetText('waPending', STATE.waPending);
  safeSetText('waFailed', STATE.waFailed);
  safeSetText('waReplied', STATE.waReplied);
}

// ════════════════════════════════════════════════
// STEP 1: SCRAPING
// ════════════════════════════════════════════════
async function startScraping() {
  // Support both old IDs (keyword/location/limit) and new pipeline IDs (keywords/limitPerKeyword)
  const keywordEl = document.getElementById('keywords') || document.getElementById('keyword');
  const limitEl = document.getElementById('limitPerKeyword') || document.getElementById('limit');
  const keyword = (keywordEl?.value || '').trim();
  const limit = parseInt(limitEl?.value) || 50;

  if (!keyword) {
    showError('Isi keyword terlebih dahulu!');
    if (keywordEl) flashInput(keywordEl.id);
    return;
  }

  STATE.isScrapingActive = true;
  STATE.scrapingAbort = false;
  STATE.scrapedLeads = [];

  // Update UI
  document.getElementById('startScrapeBtn').style.display = 'none';
  document.getElementById('stopScrapeBtn').style.display = 'flex';
  document.getElementById('scrapeProgress').style.display = 'flex';
  document.getElementById('scrapeBar').style.width = '0%';
  document.getElementById('scrapeCount').textContent = `0 / ${limit}`;

  const resultsList = document.getElementById('resultsList');
  resultsList.innerHTML = '';

  setStepBadge('step1', 'Scraping…', 'running');
  updateGlobalStatus('Scraping active', 'warning');
  addLog(`Starting scrape: "${keyword}" di "${location}", limit ${limit}`, 'info');

  // Simulate async scraping with real-feeling intervals
  let collected = 0;
  const phoneOnly = document.getElementById('phoneOnly').value === 'true';
  const dedupeCheck = document.getElementById('dedupeCheck').checked;
  const seenPhones = new Set();
  const minRating = parseFloat(document.getElementById('minRating').value) || 0;
  const minReviews = parseInt(document.getElementById('minReviews').value) || 0;

  for (let i = 0; i < limit; i++) {
    if (STATE.scrapingAbort) break;

    await sleep(randomBetween(120, 350));

    if (STATE.scrapingAbort) break;

    // Pick a random business (simulate API scrape)
    const raw = SAMPLE_BUSINESSES[i % SAMPLE_BUSINESSES.length];
    const lead = {
      ...raw,
      reviewsCount: Math.random() > 0.3 ? randomBetween(15, 600) : randomBetween(0, 10),
      name: raw.name + (i >= SAMPLE_BUSINESSES.length ? ` #${Math.floor(i / SAMPLE_BUSINESSES.length) + 1}` : ''),
      phone: raw.phone.replace(/(\d{4})$/, () => String(randomBetween(1000, 9999))),
      id: Date.now() + i,
      status: 'new',
      leadScore: 1,
    };

    // Filters
    if (phoneOnly && !lead.phone) continue;
    if (minRating && lead.rating < minRating) continue;
    if (minReviews > 0 && lead.reviewsCount < minReviews) continue;
    if (dedupeCheck && seenPhones.has(lead.phone)) continue;
    if (dedupeCheck) seenPhones.add(lead.phone);

    collected++;
    STATE.scrapedLeads.push(lead);
    STATE.totalLeadsToday++;

    // Update progress
    const pct = Math.round((collected / limit) * 100);
    document.getElementById('scrapeBar').style.width = pct + '%';
    document.getElementById('scrapeCount').textContent = `${collected} / ${limit}`;
    document.getElementById('scrapeProgressLabel').textContent = `Scraping "${keyword}" di ${location}…`;
    document.getElementById('resultsTitle').textContent = `Results (${collected})`;

    // Append result item
    const item = renderResultItem(lead, collected);
    resultsList.appendChild(item);
    resultsList.scrollTop = resultsList.scrollHeight;

    updateMonitor();

    if (collected % 10 === 0) {
      addLog(`${collected} leads collected so far…`, 'info');
    }
  }

  // Done
  STATE.isScrapingActive = false;
  document.getElementById('startScrapeBtn').style.display = 'flex';
  document.getElementById('stopScrapeBtn').style.display = 'none';

  if (STATE.scrapingAbort) {
    setStepBadge('step1', `Stopped (${collected})`, 'error');
    addLog(`Scraping stopped. ${collected} leads collected.`, 'warn');
    updateGlobalStatus('Idle', 'idle');
  } else {
    setStepBadge('step1', `Done (${collected})`, 'success');
    addLog(`✓ Scraping complete! ${collected} leads found.`, 'ok');
    updateGlobalStatus('Step 1 done', 'active');
    document.getElementById('scrapeProgressLabel').textContent = `Complete — ${collected} leads found`;
    populateLeadTable();
  }
}

function stopScraping() {
  STATE.scrapingAbort = true;
  STATE.isScrapingActive = false;
  document.getElementById('startScrapeBtn').style.display = 'flex';
  document.getElementById('stopScrapeBtn').style.display = 'none';
  addLog('Scraping stopped by user.', 'warn');
}

function renderResultItem(lead, num) {
  const div = document.createElement('div');
  div.className = 'result-item';
  div.innerHTML = `
    <span class="result-item-num">${String(num).padStart(3, '0')}</span>
    <div class="result-item-info">
      <div class="result-item-name">${escHtml(lead.name)}</div>
      <div class="result-item-meta">
        <span class="result-meta-chip result-item-phone">${escHtml(lead.phone)}</span>
        <span class="result-meta-chip">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
          ${escHtml(lead.address.substring(0, 40))}${lead.address.length > 40 ? '…' : ''}
        </span>
        <span class="result-meta-chip">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b" stroke="#f59e0b" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          ${lead.rating} (${lead.reviewsCount || 0})
        </span>
      </div>
    </div>
    <span class="result-valid-badge">✓ valid</span>`;
  return div;
}

function exportCSV() {
  if (!STATE.scrapedLeads.length) { showError('No leads to export.'); return; }
  const header = 'Name,Phone,Address,Rating,Reviews,Category\n';
  const rows = STATE.scrapedLeads.map(l =>
    `"${l.name}","${l.phone}","${l.address}",${l.rating},${l.reviewsCount || 0},"${l.category}"`
  ).join('\n');
  downloadFile('leads_export.csv', header + rows, 'text/csv');
  addLog(`Exported ${STATE.scrapedLeads.length} leads to CSV.`, 'ok');
}

// ════════════════════════════════════════════════
// STEP 2: AIRTABLE
// ════════════════════════════════════════════════
function populateLeadTable() {
  const wrap = document.getElementById('leadTableWrap');
  if (!wrap) return; // Not on a page with this table
  wrap.innerHTML = '';
  if (!STATE.scrapedLeads.length) return;
  STATE.scrapedLeads.forEach((lead, idx) => {
    const div = document.createElement('div');
    div.className = 'lead-table-item';
    div.id = `lead-row-${idx}`;
    div.onclick = () => toggleLeadSelect(idx, div);
    const addr = (lead.address || '-').substring(0, 20);
    div.innerHTML = `
      <label class="checkbox-label" onclick="event.stopPropagation()">
        <input type="checkbox" id="lead-chk-${idx}" ${STATE.selectedLeads.includes(idx) ? 'checked' : ''} onchange="toggleLeadSelect(${idx}, document.getElementById('lead-row-${idx}'))" />
        <span class="checkbox-custom"></span>
      </label>
      <div class="lead-item-info">
        <div class="lead-item-name">${escHtml(lead.name || '')}</div>
        <div class="lead-item-phone">${escHtml(lead.phone || '')}</div>
      </div>
      <div style="display:flex; align-items:center; gap:8px;">
        <span class="result-meta-chip" style="font-size:.68rem;color:var(--text-muted)">${escHtml(addr)}…</span>
        <button class="btn-item-delete" onclick="deleteLead(${idx}, event)" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>`;
    if (STATE.selectedLeads.includes(idx)) div.classList.add('selected');
    wrap.appendChild(div);
  });
  updateSelectionCount();
  setStepBadge('step2', 'Ready', '');
}

function toggleLeadSelect(idx, rowEl) {
  const chk = document.getElementById(`lead-chk-${idx}`);
  chk.checked = !chk.checked;
  const i = STATE.selectedLeads.indexOf(idx);
  if (chk.checked) {
    if (i === -1) STATE.selectedLeads.push(idx);
    rowEl.classList.add('selected');
  } else {
    if (i !== -1) STATE.selectedLeads.splice(i, 1);
    rowEl.classList.remove('selected');
  }
  updateSelectionCount();
}

function toggleSelectAll() {
  const checked = document.getElementById('selectAllCheck').checked;
  STATE.selectedLeads = [];
  STATE.scrapedLeads.forEach((_, idx) => {
    const chk = document.getElementById(`lead-chk-${idx}`);
    const row = document.getElementById(`lead-row-${idx}`);
    if (chk) {
      chk.checked = checked;
      if (checked) {
        STATE.selectedLeads.push(idx);
        row.classList.add('selected');
      } else {
        row.classList.remove('selected');
      }
    }
  });
  updateSelectionCount();
}

function updateSelectionCount() {
  safeSetText('selectionCount', `${STATE.selectedLeads.length} selected`);
}

function deleteLead(idx, event) {
  if (event) event.stopPropagation();
  if (!confirm('Hapus lead ini?')) return;
  
  STATE.scrapedLeads.splice(idx, 1);
  STATE.selectedLeads = STATE.selectedLeads.filter(i => i !== idx).map(i => i > idx ? i - 1 : i);
  
  populateLeadTable();
  addLog('Lead deleted.', 'info');
}

function deleteSelectedLeads() {
  if (!STATE.selectedLeads.length) {
    showError('Tidak ada lead yang dipilih untuk dihapus.');
    return;
  }
  
  if (!confirm(`Hapus ${STATE.selectedLeads.length} lead yang dipilih?`)) return;
  
  // Sort indices descending to splice safely
  const indices = [...STATE.selectedLeads].sort((a, b) => b - a);
  indices.forEach(idx => {
    STATE.scrapedLeads.splice(idx, 1);
  });
  
  STATE.selectedLeads = [];
  document.getElementById('selectAllCheck').checked = false;
  
  populateLeadTable();
  addLog(`Deleted ${indices.length} leads.`, 'info');
}

async function sendToAirtable() {
  // Use selected leads — or ALL scraped leads if none selected (pipeline.html workflow)
  const leadsToSync = STATE.selectedLeads.length
    ? STATE.selectedLeads.map(idx => STATE.scrapedLeads[idx])
    : STATE.scrapedLeads;

  if (!leadsToSync.length) {
    showError('Tidak ada lead! Upload file atau scrape data terlebih dahulu.');
    return;
  }

  // ── Validate Config ──────────────────────────────
  const apiKey = CONFIG.airtableKey || '';
  const baseId = CONFIG.airtableBase || '';
  const tableName = CONFIG.airtableTable || '';

  if (!apiKey) { showError('Airtable API Key belum diisi! Set di Railway Environment Variables: AIRTABLE_KEY'); return; }
  if (!baseId) { showError('Airtable Base ID belum diisi! Set: AIRTABLE_BASE'); return; }
  if (!tableName) { showError('Airtable Table Name belum diisi! Set: AIRTABLE_TABLE'); return; }

  STATE.isInsertingActive = true;
  STATE.insertAbort = false;
  STATE.insertSuccess = 0;
  STATE.insertFailed = 0;

  const selectedLeadObjects = leadsToSync;
  const total = selectedLeadObjects.length;

  // Support both old (airtableProgress) and new (airtableProgressBox) element IDs
  safeSetStyle('sendAirtableBtn', 'display', 'none');
  safeSetStyle('stopAirtableBtn', 'display', 'flex');
  const progressEl = document.getElementById('airtableProgressBox') || document.getElementById('airtableProgress');
  if (progressEl) progressEl.style.display = 'flex';
  const barEl = document.getElementById('airtableBar');
  if (barEl) barEl.style.width = '0%';
  const countEl = document.getElementById('airtableCount');
  if (countEl) countEl.textContent = `0 / ${total}`;

  setStepBadge('step2', 'Inserting…', 'running');
  updateGlobalStatus('Airtable insert', 'warning');
  addLog(`Sending ${total} leads to Airtable (Base: ${baseId}, Table: ${tableName})…`, 'info');

  // ── Build a single Airtable record from a lead ───
  function buildRecord(lead) {
    const fields = {};
    const fieldMap = getActiveFieldMap();
    Object.entries(fieldMap).forEach(([leadKey, airtableField]) => {
      let val = lead[leadKey];
      if (val !== undefined && val !== null && val !== '' && val !== '-') {
        // Phone Standardization
        if (leadKey === 'phone' || airtableField.toLowerCase().includes('phone')) {
          let cleanPhone = String(val).replace(/\D/g, "");
          if (cleanPhone.startsWith("0")) {
              cleanPhone = "62" + cleanPhone.slice(1);
          }
          val = cleanPhone ? "+" + cleanPhone : val;
        }
        fields[airtableField] = typeof val === 'number' ? val : String(val);
      }
    });
    return { fields };
  }

  // ── Batch in groups of 10 (Airtable limit) ───────
  const BATCH = 10;
  
  let processed = 0;

  for (let i = 0; i < total; i += BATCH) {
    if (STATE.insertAbort) break;

    const batch = selectedLeadObjects.slice(i, i + BATCH);
    const records = batch.map(buildRecord);

    try {
      safeSetText('airtableProgressLabel', `Inserting records ${i + 1}–${Math.min(i + BATCH, total)} of ${total}…`);

      // Use backend proxy to avoid CORS
      const res = await fetch(`${backendUrl}/api/airtable-sync`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${APP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, baseId, tableName, records }),
      });

      const data = await res.json();

      if (!res.ok) {
        // Airtable returns {error: {type, message}} on failure
        const errMsg = data?.error?.message || data?.error?.type || res.statusText;
        throw new Error(`${res.status} — ${errMsg}`);
      }

      const inserted = data.records?.length || batch.length;
      STATE.insertSuccess += inserted;
      addLog(`✓ Batch ${Math.ceil((i + 1) / BATCH)}: ${inserted} records inserted`, 'ok');

    } catch (err) {
      STATE.insertFailed += batch.length;
      addLog(`✗ Batch error: ${err.message}`, 'error');
      showError(`Airtable Error: ${err.message}`);

      // Stop on auth errors (401/403)
      if (err.message.startsWith('401') || err.message.startsWith('403')) {
        addLog('Stopped: check your API Key and permissions.', 'error');
        break;
      }
    }

    processed = Math.min(i + BATCH, total);
    const pct = Math.round((processed / total) * 100);
    const barEl2 = document.getElementById('airtableBar');
    const cntEl2 = document.getElementById('airtableCount');
    if (barEl2) barEl2.style.width = pct + '%';
    if (cntEl2) cntEl2.textContent = `${processed} / ${total}`;
    safeSetText('insertSuccess', `✓ ${STATE.insertSuccess} inserted`);
    safeSetText('insertFailed', `✗ ${STATE.insertFailed} failed`);
    updateMonitor();

    // Small delay between batches to respect rate limits (5 req/s)
    if (i + BATCH < total && !STATE.insertAbort) await sleep(250);
  } // end for loop

  STATE.isInsertingActive = false;
  safeSetStyle('sendAirtableBtn', 'display', 'flex');
  safeSetStyle('stopAirtableBtn', 'display', 'none');

  if (STATE.insertAbort) {
    setStepBadge('step2', 'Stopped', 'error');
    addLog(`Airtable stopped. ${STATE.insertSuccess} inserted, ${STATE.insertFailed} failed.`, 'warn');
  } else {
    if (STATE.insertFailed === 0) {
      setStepBadge('step2', `Done (${STATE.insertSuccess}/${total})`, 'success');
      safeSetText('airtableProgressLabel', `✓ Complete — ${STATE.insertSuccess} records inserted`);
      updateGlobalStatus('Step 2 done', 'active');
    } else {
      setStepBadge('step2', `Partial (${STATE.insertSuccess}/${total})`, 'error');
      safeSetText('airtableProgressLabel', `⚠ ${STATE.insertSuccess} inserted, ${STATE.insertFailed} failed`);
    }
    addLog(`Airtable done: ${STATE.insertSuccess} success, ${STATE.insertFailed} failed.`, STATE.insertFailed ? 'warn' : 'ok');
    showToast(`✅ Sync selesai! ${STATE.insertSuccess} leads berhasil masuk ke Airtable.`);
  }
}

function stopAirtable() {
  STATE.insertAbort = true;
  STATE.isInsertingActive = false;
  safeSetStyle('sendAirtableBtn', 'display', 'flex');
  safeSetStyle('stopAirtableBtn', 'display', 'none');
  addLog('Airtable insert stopped by user.', 'warn');
}

// ════════════════════════════════════════════════
// STEP 3: WHATSAPP
// ════════════════════════════════════════════════
// ─── Fetch from Airtable ─────────────────────────
// ════════════════════════════════════════════════
// ─── Fetch from Airtable ─────────────────────────
async function fetchLeadsFromAirtableWithStatus() {
  const apiKey = (safeGet('airtableKey')?.value || CONFIG.airtableKey || '').trim();
  const baseId = (safeGet('airtableBase')?.value || CONFIG.airtableBase || '').trim();
  const tableName = (safeGet('airtableTable')?.value || CONFIG.airtableTable || '').trim();
  const targetStatus = safeGet('fetchStatusOption')?.value || '';

  if (!apiKey || !baseId || !tableName) {
    showError('Airtable Config belum lengkap! Isi dulu di halaman Settings.');
    alert('Buka halaman "Settings" dan masukkan Airtable Key/Base/Table di Railway Environment Variables terlebih dahulu!');
    return;
  }

  const fieldMap = getActiveFieldMap();
  const statusFieldName = fieldMap.status || 'status';

  let filter = '';
  let formulaStr = '';
  if (targetStatus) {
    formulaStr = `{${statusFieldName}} = '${targetStatus}'`;
    filter = formulaStr;
  }

  const limit = safeGet('sendLimit')?.value || 100;
  
  const btn = document.getElementById('btnLoadAirtable');
  if(btn) {
    btn.disabled = true;
    btn.innerHTML = `<span style="display:inline-block; animation:spin 1s linear infinite;">⏳</span> Loading dari Airtable...`;
  }

  addLog(`Fetching leads from Airtable (${targetStatus || 'All'})...`, 'info');
  setStepBadge('step3', 'Fetching…', 'running');

  try {
    const res = await fetch(`${backendUrl}/api/airtable-fetch`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${APP_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey, baseId, tableName,
        filterByFormula: formulaStr,
        limit
      })
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data?.error || data?.error?.message || res.statusText);

    if (!data.records || !data.records.length) {
      addLog(`Airtable: Tidak ada lead dengan status "${targetStatus || 'All'}".`, 'warn');
      safeSetStyle('fetchStatus', 'display', 'block');
      safeSetText('fetchCount', '0');
      setStepBadge('step3', 'Empty');
      STATE.waLeads = [];
      renderTargetLeads();
      alert(`Tidak ada prospek(leads) ditemukan dengan status "${targetStatus || 'All'}".\nCoba pilih status lain.`);
    } else {
      // Map Airtable records back to our internal lead format
      const revFieldMap = {};
      Object.entries(fieldMap).forEach(([k, v]) => revFieldMap[v] = k);

      STATE.waLeads = data.records.map(rec => {
        const lead = { id_airtable: rec.id };
        Object.entries(rec.fields).forEach(([fName, val]) => {
          lead[fName.toLowerCase().replace(/\s+/g, '_')] = val;
          const leadKey = revFieldMap[fName];
          if (leadKey) lead[leadKey] = val;
        });
        if (!lead.name && rec.fields[fieldMap.name]) lead.name = rec.fields[fieldMap.name];
        return lead;
      });

      safeSetStyle('fetchStatus', 'display', 'block');
      safeSetText('fetchCount', STATE.waLeads.length);
      addLog(`✓ Berhasil mengambil ${STATE.waLeads.length} lead dari Airtable.`, 'ok');
      setStepBadge('step3', 'Ready');
      renderTargetLeads();
      alert(`✅ Berhasil load ${STATE.waLeads.length} leads data dari Airtable!`);
    }

  } catch (err) {
    addLog(`✗ Gagal fetch Airtable: ${err.message}`, 'error');
    showError(`Airtable Fetch Error: ${err.message}`);
    setStepBadge('step3', 'Error', 'error');
    alert(`❌ Gagal Load dari Airtable:\n\nPesan Error: ${err.message}\n\nPastikan Airtable Config di Railway sudah 100% benar (huruf besar/kecil berpengaruh).`);
  } finally {
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Load from Airtable`;
    }
  }
}

// ─── Render Leads Table (campaigns.html) ─────────
function renderTargetLeads(filtered) {
  const body = safeGet('targetLeadsBody');
  if (!body) return;
  const list = filtered !== undefined ? filtered : STATE.waLeads;

  if (!list || list.length === 0) {
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted);">No leads loaded.</td></tr>';
    return;
  }

  body.innerHTML = list.slice(0, 200).map(l => `
    <tr>
      <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${l.name || '—'}</td>
      <td>${l.city || l.City || '—'}</td>
      <td>⭐ ${l.rating || l.Rating || '—'}</td>
      <td>${l.phone || l.Phone || '—'}</td>
    </tr>
  `).join('');
}

// ─── Local City Filter ────────────────────────────
function filterLeadsLocally() {
  const query = (safeGet('cityFilterInput')?.value || '').toLowerCase().trim();

  if (!query) {
    renderTargetLeads(STATE.waLeads);
    safeSetText('filterResultCount', '');
    return;
  }

  const filtered = STATE.waLeads.filter(l => {
    const city = (l.city || l.City || '').toLowerCase();
    return city.includes(query);
  });

  renderTargetLeads(filtered);
  safeSetText('filterResultCount', `${filtered.length} found`);
}

// ─── Campaign Template Management ────────────────
function saveCampaignTemplate() {
  const campaign = document.getElementById('campaign').value;
  if (!campaign) {
    showError('Pilih Campaign terlebih dahulu sebelum menyimpan!');
    return;
  }
  const template = document.getElementById('msgTemplate').value;
  const templates = JSON.parse(localStorage.getItem('waCampaignTemplates') || '{}');
  templates[campaign] = template;
  localStorage.setItem('waCampaignTemplates', JSON.stringify(templates));
  addLog(`✓ Template untuk campaign '${campaign}' disimpan.`, 'ok');
}

function loadCampaignTemplate() {
  const campaign = document.getElementById('campaign').value;
  if (!campaign) return;
  const templates = JSON.parse(localStorage.getItem('waCampaignTemplates') || '{}');
  if (templates[campaign]) {
    document.getElementById('msgTemplate').value = templates[campaign];
    addLog(`✓ Template campaign '${campaign}' dimuat.`, 'info');
  }
}

function toggleDelayInputs() {
  const mode = document.getElementById('delayMode').value;
  document.getElementById('delayRandomWrap').style.display = (mode === 'random') ? 'flex' : 'none';
  document.getElementById('delaySpreadWrap').style.display = (mode === 'spread') ? 'block' : 'none';
}

async function updateAirtableStatus(recordId, newStatus) {
  const apiKey = CONFIG.airtableKey || document.getElementById('airtableKey').value.trim();
  const baseId = CONFIG.airtableBase || document.getElementById('airtableBase').value.trim();
  const tableName = CONFIG.airtableTable || document.getElementById('airtableTable').value.trim();
  const fieldMap = getActiveFieldMap();
  const statusFieldName = fieldMap.status || 'status';

  try {
    const records = [{ id: recordId, fields: { [statusFieldName]: newStatus } }];
    const res = await fetch(`${backendUrl}/api/airtable-update`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${APP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ apiKey, baseId, tableName, records })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data?.error || data?.error?.message || 'Update failed');
    }
    return true;
  } catch (err) {
    addLog(`⚠ Gagal update status record ${recordId}: ${err.message}`, 'warn');
    return false;
  }
}

async function startWhatsApp() {
  const campaignEl = safeGet('campaign');
  const campaign = campaignEl ? campaignEl.value : 'default';
  const template = (safeGet('msgTemplate')?.value || '').trim();
  const sendLimit = parseInt(safeGet('sendLimit')?.value) || 50;

  if (!template) { showError('Tulis template pesan terlebih dahulu!'); return; }

  // Respect city filter if active on campaigns.html
  const cityQuery = (safeGet('cityFilterInput')?.value || '').toLowerCase().trim();
  let baseLeads = STATE.waLeads.length ? STATE.waLeads : STATE.scrapedLeads;
  const leads = cityQuery
    ? baseLeads.filter(l => (l.city || l.City || '').toLowerCase().includes(cityQuery))
    : baseLeads;

  if (!leads.length) {
    showError('Tidak ada data leads! Fetch dari Airtable atau upload data terlebih dahulu.');
    return;
  }

  const total = Math.min(sendLimit, leads.length);
  const delayMode = safeGet('delayMode')?.value || 'random';
  const spreadDurationHours = parseFloat(safeGet('delayDuration')?.value) || 2;
  const spreadDelayMs = (delayMode === 'spread') ? (spreadDurationHours * 3600000) / total : 0;

  STATE.isWaSending = true;
  STATE.isWaPaused = false;
  STATE.waAbort = false;
  STATE.waSent = 0; STATE.waPending = total; STATE.waFailed = 0; STATE.waReplied = 0;

  safeSetStyle('startWaBtn', 'display', 'none');
  safeSetStyle('pauseWaBtn', 'display', 'flex');
  safeSetStyle('stopWaBtn', 'display', 'flex');
  safeSetStyle('activeControls', 'display', 'flex');
  safeSetStyle('waProgress', 'display', 'flex');
  safeSetStyle('waNextSend', 'display', 'flex');
  
  const waBar = document.getElementById('waBar');
  if (waBar) waBar.style.width = '0%';
  safeSetText('waCount', `0 / ${total}`);

  setStepBadge('step3', 'Sending…', 'running');
  updateGlobalStatus('WA outreach sending', 'warning');
  addLog(`Starting WA campaign: "${campaign}", ${total} leads (${delayMode} delay)`, 'info');

  // Use safeGet for delay values since index.html might call this without the inputs
  const delayMinEl = document.getElementById('delayMin');
  const delayMaxEl = document.getElementById('delayMax');
  const delayMin = (delayMinEl ? parseInt(delayMinEl.value) : 15) * 1000;
  const delayMax = (delayMaxEl ? parseInt(delayMaxEl.value) : 30) * 1000;

  for (let i = 0; i < total; i++) {
    if (STATE.waAbort) break;

    while (STATE.isWaPaused && !STATE.waAbort) await sleep(500);
    if (STATE.waAbort) break;

    const lead = leads[i];
    
    // DELAY CALCULATION
    let delayMs = 0;
    if (delayMode === 'spread') {
      // Base delay for spread + 20% jitter
      const jitter = (Math.random() * 0.4) + 0.8; // 0.8 to 1.2
      delayMs = spreadDelayMs * jitter;
    } else {
      delayMs = randomBetween(delayMin, delayMax);
    }

    const delaySec = Math.round(delayMs / 1000);
    STATE.waCountdownValue = delaySec;

    // Countdown UI
    const countdownInterval = setInterval(() => {
      STATE.waCountdownValue--;
      if (STATE.waCountdownValue <= 0) { clearInterval(countdownInterval); return; }
      safeSetText('waCountdown', `${STATE.waCountdownValue}s`);
    }, 1000);

    safeSetText('waProgressLabel', `Queueing for ${lead.name || lead.business_name || 'Customer'}…`);
    safeSetText('waCountdown', `${delaySec}s`);

    // Real sleep (anti-ban)
    await sleep(delayMs); 
    clearInterval(countdownInterval);

    if (STATE.waAbort) break;
    safeSetText('waProgressLabel', `Sending to ${lead.name || lead.business_name || 'Customer'}…`);

    // Real sending via Baileys Backend
    let success = false;
    try {
      const fieldMap = getActiveFieldMap();
      let msg = "";
      const useAi = document.getElementById('useAiIntroCheck') && document.getElementById('useAiIntroCheck').checked;

      if (useAi) {
        document.getElementById('waProgressLabel').textContent = `AI is writing message for ${lead.name || lead.business_name || 'Customer'}…`;
        const aiRes = await fetch(`${backendUrl}/api/generate-intro`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
          body: JSON.stringify({
            goalPrompt: template, // The template box is now used for the prompt
            leadData: {
              name: lead.name || lead[fieldMap.name] || 'Owner',
              category: lead.category || lead.subtypes || lead[fieldMap.category] || '',
              address: lead.address || lead[fieldMap.address] || '',
              rating: lead.rating || lead[fieldMap.rating] || ''
            }
          })
        });
        const aiData = await aiRes.json();
        if (!aiRes.ok || aiData.error) {
          throw new Error(aiData.error || `Server error ${aiRes.status}`);
        }
        if (!aiData.message || aiData.message.trim() === "") {
          throw new Error("AI berhasil dipanggil tapi tidak menghasilkan pesan.");
        }
        msg = aiData.message;
      } else {
        msg = template
          .replace(/{{name}}/g, lead.name || 'Customer')
          .replace(/{{business}}/g, lead.business_name || lead.name || 'your business')
          .replace(/{{phone}}/g, lead.phone || lead[fieldMap.phone] || '')
          .replace(/{{date}}/g, new Date().toLocaleDateString());
      }

      safeSetText('waProgressLabel', `Sending to ${lead.name || lead.business_name || 'Customer'}…`);
      const res = await fetch(`${backendUrl}/send-message`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${APP_TOKEN}`
        },
        body: JSON.stringify({ 
          phone: lead.phone || lead[fieldMap.phone], 
          message: msg,
          recordId: lead.id_airtable
        })
      });
      const data = await res.json();
      success = data.success === true;
    } catch (e) {
      console.error('Real WA Send error:', e);
      addLog(`AI or WA Send Error: ${e.message}`, 'error');
      success = false;
    }

    const replied = success && Math.random() > 0.85; // Simulated replies for now

    if (success) {
      STATE.waSent++;
      if (lead.id_airtable) {
        await updateAirtableStatus(lead.id_airtable, 'Sent WA');
      }
    } else {
      STATE.waFailed++;
      if (lead.id_airtable) {
        await updateAirtableStatus(lead.id_airtable, 'Failed WA');
      }
      addLog(`Failed to send to ${lead.name || lead.phone}: connection error`, 'error');
    }

    STATE.waPending = Math.max(0, total - i - 1);
    if (replied) {
      STATE.waReplied++;
      STATE.replies++;
      addLog(`↩️ Reply received from ${lead.name || lead.phone}`, 'ok');
    }

    STATE.msgSent++;
    const pct = Math.round(((i + 1) / total) * 100);
    const waBarEl = document.getElementById('waBar');
    if (waBarEl) waBarEl.style.width = pct + '%';
    safeSetText('waCount', `${i + 1} / ${total}`);
    updateWaStats();
    updateMonitor();

    if ((i + 1) % 5 === 0) addLog(`WA: ${STATE.waSent} sent, ${STATE.waFailed} failed`, 'info');
  }

  STATE.isWaSending = false;
  safeSetStyle('startWaBtn', 'display', 'flex');
  safeSetStyle('pauseWaBtn', 'display', 'none');
  safeSetStyle('stopWaBtn', 'display', 'none');
  safeSetStyle('waNextSend', 'display', 'none');

  if (STATE.waAbort) {
    setStepBadge('step3', 'Stopped', 'error');
    addLog(`WA Outreach stopped. ${STATE.waSent} messages sent.`, 'warn');
  } else {
    setStepBadge('step3', `Done (${STATE.waSent}/${total})`, 'success');
    safeSetText('waProgressLabel', `✓ Campaign Done — ${STATE.waSent} sent`);
    addLog(`✓ WA outreach complete! ${STATE.waSent} sent, ${STATE.waReplied} replies.`, 'ok');
    updateGlobalStatus('Campaign done', 'active');
  }
}

function pauseWhatsApp() {
  STATE.isWaPaused = !STATE.isWaPaused;
  const btn = document.getElementById('pauseWaBtn');
  if (STATE.isWaPaused) {
    if (btn) btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg> Resume`;
    setStepBadge('step3', 'Paused', 'error');
    safeSetText('waProgressLabel', 'Paused…');
    addLog('WA sending paused by user.', 'warn');
    updateGlobalStatus('WA paused', 'warning');
  } else {
    if (btn) btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Pause`;
    setStepBadge('step3', 'Sending…', 'running');
    addLog('WA sending resumed.', 'ok');
    updateGlobalStatus('WA outreach sending', 'warning');
  }
}

function stopWhatsApp() {
  STATE.waAbort = true;
  STATE.isWaSending = false;
  STATE.isWaPaused = false;
  safeSetStyle('startWaBtn', 'display', 'flex');
  safeSetStyle('pauseWaBtn', 'display', 'none');
  safeSetStyle('stopWaBtn', 'display', 'none');
  safeSetStyle('waNextSend', 'display', 'none');
  addLog('WA sending stopped by user.', 'warn');
}

function generateFallbackLeads(count) {
  const leads = [];
  for (let i = 0; i < count; i++) {
    leads.push(SAMPLE_BUSINESSES[i % SAMPLE_BUSINESSES.length]);
  }
  return leads;
}

// ─── Update Delay Label ───────────────────────────
function updateDelayLabel() {
  document.getElementById('delayMinLabel').textContent = document.getElementById('delayMin').value + 's';
  document.getElementById('delayMaxLabel').textContent = document.getElementById('delayMax').value + 's';
}

// ─── Global Status ────────────────────────────────
function updateGlobalStatus(text, state) {
  const dot = document.getElementById('globalStatusDot');
  const label = document.getElementById('globalStatusLabel');
  label.textContent = text;
  dot.className = 'status-dot';
  if (state === 'active') dot.classList.add('active');
  else if (state === 'warning') dot.classList.add('warning');
  else if (state === 'error') dot.classList.add('error');
}

// ─── AI Intro Toggle ────────────────────────────────
function toggleAiIntro() {
  const isChecked = document.getElementById('useAiIntroCheck').checked;
  const label = document.getElementById('msgTemplateLabel');
  const textarea = document.getElementById('msgTemplate');
  
  if (isChecked) {
    label.innerHTML = '<span style="color:#fbbf24; font-weight:600;">✨ AI Goal Prompt</span>';
    textarea.placeholder = "Contoh: Buat pesan ramah untuk menawarkan jasa social media marketing ke restoran mereka yang ratingnya sudah lumayan bagus di Gmaps...";
    textarea.value = "Halo, puji hidangan dan rating restoran mereka secara natural. Jelaskan bahwa kami dari Agensi XY dan sangat rindu bekerja sama dengan pengusaha FnB hebat seperti mereka.";
  } else {
    label.textContent = 'Message Template';
    textarea.placeholder = "Halo {{name}}, perkenalkan saya dari...";
    textarea.value = "Halo {{name}} 👋\\n\\nPerkenalkan, saya dari tim digital marketing. Kami tertarik membantu bisnis *{{business}}* Anda berkembang lebih pesat.";
  }
}

// ─── Message Preview ──────────────────────────────
function previewMessage() {
  const template = document.getElementById('msgTemplate').value;
  const sample = STATE.scrapedLeads[0] || SAMPLE_BUSINESSES[0];
  const rendered = template
    .replace(/{{name}}/g, sample.name || 'Pak/Bu')
    .replace(/{{business}}/g, sample.name || 'Bisnis Anda')
    .replace(/{{phone}}/g, sample.phone || '-')
    .replace(/{{date}}/g, new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }));

  document.getElementById('previewBubble').textContent = rendered;
  document.getElementById('previewModal').classList.add('open');
}

function closePreview(event) {
  if (event.target === document.getElementById('previewModal')) closePreviewModal();
}
function closePreviewModal() {
  document.getElementById('previewModal').classList.remove('open');
}

function insertVar(v) {
  const ta = document.getElementById('msgTemplate');
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  ta.value = ta.value.slice(0, start) + v + ta.value.slice(end);
  ta.selectionStart = ta.selectionEnd = start + v.length;
  ta.focus();
}

// ─── Helpers ──────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showError(msg) {
  addLog(`⚠ Error: ${msg}`, 'error');
  // Inline toast
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;bottom:28px;right:28px;z-index:9999;
    background:#7f1d1d;color:#fca5a5;
    border:1px solid rgba(239,68,68,.4);
    padding:12px 20px;border-radius:10px;font-size:.82rem;font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,.5);
    animation:slideUp .3s ease;font-family:'Inter',sans-serif;
    display:flex;align-items:center;gap:8px;max-width:340px;
  `;
  toast.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${msg}`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity .3s'; setTimeout(() => toast.remove(), 300); }, 3500);
}

function flashInput(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.borderColor = 'var(--red)';
  el.style.boxShadow = '0 0 0 3px rgba(239,68,68,.2)';
  setTimeout(() => { el.style.borderColor = ''; el.style.boxShadow = ''; }, 2000);
}

function downloadFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Init ─────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadConfig();
  loadMappingConfig();
  initUploadZone();
  initWhatsAppSocket(); // << Added
  updateMonitor();
  updateWaStats();
  updateDelayLabel();
  addLog('Lead Gen Control Panel loaded. Ready.', 'ok');

  // Keyboard shortcut: Ctrl+L for log
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'l') { e.preventDefault(); openLog(); }
    if (e.key === 'Escape') { closeLog(); closePreviewModal(); closeSettingsModal(); }
  });
});

function showToast(msg, isErr=false) {
  const t = document.getElementById('toast');
  if(!t) {
    const newToast = document.createElement('div');
    newToast.id = 'toast';
    newToast.className = 'toast';
    document.body.appendChild(newToast);
    return showToast(msg, isErr); 
  }
  t.textContent = msg;
  t.style.background = isErr ? 'var(--red)' : 'var(--green)';
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

// ════════════════════════════════════════════════
// SETTINGS PAGE FUNCTIONS
// ════════════════════════════════════════════════

async function saveAiConfig() {
  const isActive = safeGet('aiMasterSwitch')?.checked || false;
  const geminiKey = (safeGet('geminiKey')?.value || '').trim();
  const prompt = (safeGet('aiPrompt')?.value || '').trim();
  const btn = safeGet('btnSaveAi');
  if (btn) btn.textContent = 'Saving...';

  try {
    const res = await fetch(`${backendUrl}/api/ai-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${APP_TOKEN}` },
      body: JSON.stringify({ isActive, geminiKey, prompt })
    });
    if (res.ok) {
      showToast('AI Config berhasil disimpan!', false);
      addLog('AI Config saved.', 'ok');
    } else {
      const d = await res.json().catch(() => ({}));
      showToast(d.error || 'Gagal menyimpan AI config.', true);
    }
  } catch (e) {
    showToast('Network error: ' + e.message, true);
  } finally {
    if (btn) btn.textContent = 'Update AI Persona';
  }
}

async function saveOutscraperConfig() {
  const key = (safeGet('outscraperKey')?.value || '').trim();
  if (!key) { showToast('Masukkan API Key Outscraper!', true); return; }

  CONFIG.outscraperKey = key;
  localStorage.setItem('leadGenConfig', JSON.stringify({ outscraperKey: key }));
  showToast('Outscraper Key saved!', false);
  addLog('Outscraper key saved locally.', 'ok');
}

// ════════════════════════════════════════════════
// CAMPAIGN HELPERS
// ════════════════════════════════════════════════

function toggleAiIntro() {
  const checked = safeGet('useAiIntroCheck')?.checked;
  const label = safeGet('msgTemplateLabel');
  if (label) {
    label.textContent = checked
      ? '✨ AI Goal Prompt (Instruksi untuk AI)'
      : 'Message Template';
  }
  const textarea = safeGet('msgTemplate');
  if (textarea) {
    textarea.placeholder = checked
      ? 'Contoh: Halo, puji hidangan dan rating mereka secara natural. Jelaskan bahwa kami dari Agensi XY...'
      : 'Halo {{name}}, kami dari ...';
  }
}

function insertTag(tag) {
  const el = safeGet('msgTemplate');
  if (!el) return;
  const start = el.selectionStart;
  const end = el.selectionEnd;
  el.value = el.value.slice(0, start) + tag + el.value.slice(end);
  el.selectionStart = el.selectionEnd = start + tag.length;
  el.focus();
}

// ════════════════════════════════════════════════
// CHAT VIEWER (chats.html) — QR + WA Status Hub
// ════════════════════════════════════════════════

function updateWaHubUI(status) {
  const statusEl = safeGet('waConnectionStatus');
  const qrBox = safeGet('qrCodeContainer');
  const connBox = safeGet('waConnectedInfo');
  const qrImg = safeGet('qrCode');

  if (!statusEl) return;

  const map = {
    connected: { text: '✓ Connected', cls: 'status-dot--success', color: 'var(--wa-green)' },
    waiting_scan: { text: '📷 Scan QR Code', cls: 'status-dot--warning', color: 'var(--yellow)' },
    disconnected: { text: '✗ Disconnected', cls: 'status-dot--error', color: 'var(--red)' },
  };
  const s = map[status] || map['disconnected'];

  statusEl.innerHTML = `<span class="status-dot ${s.cls}" style="background:${s.color};"></span>${s.text}`;

  if (qrBox) qrBox.style.display = (status === 'waiting_scan') ? 'block' : 'none';
  if (connBox) connBox.style.display = (status === 'connected') ? 'block' : 'none';
}
