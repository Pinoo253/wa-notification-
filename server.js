// ============================================================
// WA NOTIF VAULT — versi satu file, tanpa npm install
// Cukup jalankan: node server.js
// ============================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');

// ------------------------------------------------------------
// KONFIGURASI — token sudah diisi otomatis, ganti kalau mau
// ------------------------------------------------------------
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || 'b20b805899514369e43fc90366b298d8251f5fcc263c0551c2c9625b47fb34c2';

const DATA_FILE = path.join(__dirname, 'data', 'notifications.json');
if (!fs.existsSync(path.join(__dirname, 'data'))) fs.mkdirSync(path.join(__dirname, 'data'));
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '[]');

function readAll() {
  try { return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8')); } catch { return []; }
}
function writeAll(list) { fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2)); }

function parseWaDate(date, time) {
  try {
    const [d, m, y] = date.split('/').map((n) => parseInt(n, 10));
    const fullYear = y < 100 ? 2000 + y : y;
    const cleanTime = time.replace('.', ':');
    return new Date(`${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${cleanTime.length === 5 ? cleanTime + ':00' : cleanTime}`).toISOString();
  } catch { return new Date().toISOString(); }
}

function importChat(chatName, rawText) {
  const lines = rawText.split(/\r?\n/);
  const lineRegex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}[.:]\d{2}(?:\s?[AP]M)?)\s*-\s*([^:]+):\s?(.*)$/i;
  const entries = [];
  let current = null;
  for (const line of lines) {
    const match = line.match(lineRegex);
    if (match) {
      if (current) entries.push(current);
      const [, date, time, sender, text] = match;
      current = {
        id: crypto.randomUUID(),
        app: 'WhatsApp (Arsip Import)',
        title: `${chatName || 'Chat'} — ${sender.trim()}`,
        text,
        timestamp: parseWaDate(date, time),
        receivedAt: new Date().toISOString(),
      };
    } else if (current && line.trim()) {
      current.text += '\n' + line;
    }
  }
  if (current) entries.push(current);
  return entries;
}

// ------------------------------------------------------------
// FRONTEND — di-inline langsung, tidak ada file terpisah
// ------------------------------------------------------------
function getHtml() {
  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>WA Notif Vault</title>
<style>
:root{--bg:#0f1115;--card:#1a1d24;--accent:#25d366;--text:#e6e6e6;--muted:#8a8f98;--border:#2a2e37;}
*{box-sizing:border-box;}
body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);}
.container{max-width:680px;margin:0 auto;padding:24px 16px 60px;}
header h1{margin:0 0 4px;font-size:1.5rem;}
.subtitle{margin:0 0 20px;color:var(--muted);font-size:0.9rem;}
.import-box{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:16px;}
.import-box label{display:block;font-size:0.8rem;color:var(--muted);margin-bottom:8px;}
.import-row{display:flex;gap:8px;flex-wrap:wrap;}
.import-row input[type="text"]{flex:1;min-width:120px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);}
.import-row input[type="file"]{color:var(--muted);font-size:0.8rem;}
.import-status{margin:8px 0 0;font-size:0.8rem;color:var(--accent);}
.controls{display:flex;gap:8px;margin-bottom:16px;}
.controls input,.controls select{flex:1;padding:10px 12px;border-radius:8px;border:1px solid var(--border);background:var(--card);color:var(--text);font-size:0.9rem;}
button{padding:10px 14px;border-radius:8px;border:none;background:var(--accent);color:#06210f;font-weight:600;cursor:pointer;font-size:0.9rem;}
button:hover{opacity:0.9;}
.list{display:flex;flex-direction:column;gap:10px;}
.item{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;}
.item-top{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;}
.item-title{font-weight:600;font-size:0.95rem;}
.item-time{color:var(--muted);font-size:0.75rem;}
.item-text{font-size:0.9rem;white-space:pre-wrap;word-break:break-word;}
.item-app{display:inline-block;margin-top:6px;font-size:0.7rem;color:var(--accent);background:rgba(37,211,102,0.1);padding:2px 8px;border-radius:999px;}
.empty{text-align:center;color:var(--muted);padding:40px 0;}
</style>
</head>
<body>
<div class="container">
<header>
<h1>📥 WA Notif Vault</h1>
<p class="subtitle">Histori notifikasi tersimpan dari HP kamu</p>
</header>

<section class="import-box">
<label for="importFile">Import chat lama/arsip (file .txt dari Export Chat WhatsApp)</label>
<div class="import-row">
<input type="text" id="importChatName" placeholder="Nama kontak/grup" />
<input type="file" id="importFile" accept=".txt" />
<button id="importBtn">Import</button>
</div>
<p id="importStatus" class="import-status"></p>
</section>

<section class="controls">
<input type="text" id="searchInput" placeholder="Cari isi pesan atau nama kontak..." />
<select id="appFilter">
<option value="">Semua aplikasi</option>
<option value="WhatsApp">WhatsApp</option>
</select>
<button id="refreshBtn">🔄 Refresh</button>
</section>

<section id="list" class="list"></section>
</div>

<script>
const TOKEN = ${JSON.stringify(API_TOKEN)};
const searchInput = document.getElementById('searchInput');
const appFilter = document.getElementById('appFilter');
const refreshBtn = document.getElementById('refreshBtn');
const listEl = document.getElementById('list');
const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const importChatName = document.getElementById('importChatName');
const importStatus = document.getElementById('importStatus');

function debounce(fn, delay){let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),delay);};}

async function loadNotifications(){
  const params = new URLSearchParams();
  if(searchInput.value) params.set('q', searchInput.value);
  if(appFilter.value) params.set('app', appFilter.value);
  try{
    const res = await fetch('/api/notifications?'+params.toString(), { headers: { 'x-api-token': TOKEN } });
    if(!res.ok){ listEl.innerHTML = '<div class="empty">Gagal memuat data.</div>'; return; }
    render(await res.json());
  }catch(e){ listEl.innerHTML = '<div class="empty">Tidak bisa terhubung ke server.</div>'; }
}

function render(items){
  if(!items.length){ listEl.innerHTML = '<div class="empty">Belum ada notifikasi tersimpan.</div>'; return; }
  listEl.innerHTML = items.map(n => \`
    <div class="item">
      <div class="item-top">
        <span class="item-title">\${escapeHtml(n.title || '(tanpa judul)')}</span>
        <span class="item-time">\${formatTime(n.timestamp)}</span>
      </div>
      <div class="item-text">\${escapeHtml(n.text)}</div>
      <span class="item-app">\${escapeHtml(n.app)}</span>
    </div>\`).join('');
}

function escapeHtml(str){ const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
function formatTime(iso){ try{ return new Date(iso).toLocaleString('id-ID'); }catch{ return iso; } }

refreshBtn.addEventListener('click', loadNotifications);
searchInput.addEventListener('input', debounce(loadNotifications, 300));
appFilter.addEventListener('change', loadNotifications);

importBtn.addEventListener('click', async () => {
  const file = importFile.files[0];
  if(!file){ importStatus.textContent = 'Pilih file .txt hasil Export Chat WhatsApp dulu.'; return; }
  const rawText = await file.text();
  importStatus.textContent = 'Mengimpor...';
  try{
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-token': TOKEN },
      body: JSON.stringify({ chatName: importChatName.value || file.name, rawText }),
    });
    const data = await res.json();
    if(!res.ok){ importStatus.textContent = 'Gagal: ' + (data.error || res.status); return; }
    importStatus.textContent = 'Berhasil impor ' + data.imported + ' pesan.';
    loadNotifications();
  }catch(e){ importStatus.textContent = 'Tidak bisa terhubung ke server.'; }
});

loadNotifications();
</script>
</body>
</html>`;
}

// ------------------------------------------------------------
// SERVER — pakai modul bawaan Node saja, tanpa express
// ------------------------------------------------------------
function checkToken(req, url) {
  const headerToken = req.headers['x-api-token'];
  const queryToken = url.searchParams.get('token');
  return (headerToken || queryToken) === API_TOKEN;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-token');

  // Dashboard
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(getHtml());
  }

  // GET daftar notifikasi
  if (req.method === 'GET' && url.pathname === '/api/notifications') {
    if (!checkToken(req, url)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Token salah atau tidak ada' })); }
    let list = readAll();
    const filterApp = url.searchParams.get('app');
    const q = url.searchParams.get('q');
    const limit = url.searchParams.get('limit');
    if (filterApp) list = list.filter((n) => n.app.toLowerCase() === filterApp.toLowerCase());
    if (q) { const needle = q.toLowerCase(); list = list.filter((n) => n.text.toLowerCase().includes(needle) || (n.title || '').toLowerCase().includes(needle)); }
    if (limit) list = list.slice(0, parseInt(limit, 10));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(list));
  }

  // POST notifikasi baru (dipanggil MacroDroid/Tasker)
  if (req.method === 'POST' && url.pathname === '/api/notifications') {
    if (!checkToken(req, url)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Token salah atau tidak ada' })); }
    try {
      const body = await readBody(req);
      if (!body.app || !body.text) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Field "app" dan "text" wajib diisi' })); }
      const list = readAll();
      const entry = { id: crypto.randomUUID(), app: body.app, title: body.title || '', text: body.text, timestamp: body.timestamp || new Date().toISOString(), receivedAt: new Date().toISOString() };
      list.unshift(entry);
      writeAll(list);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, id: entry.id }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Body tidak valid' }));
    }
  }

  // POST import chat lama/arsip
  if (req.method === 'POST' && url.pathname === '/api/import') {
    if (!checkToken(req, url)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Token salah atau tidak ada' })); }
    try {
      const body = await readBody(req);
      if (!body.rawText) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Field "rawText" wajib diisi' })); }
      const entries = importChat(body.chatName, body.rawText);
      if (!entries.length) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Tidak ada baris yang cocok dengan format export WhatsApp' })); }
      const list = readAll();
      writeAll([...entries, ...list]);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, imported: entries.length }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Body tidak valid' }));
    }
  }

  // DELETE satu entri
  if (req.method === 'DELETE' && url.pathname.startsWith('/api/notifications/')) {
    if (!checkToken(req, url)) { res.writeHead(401, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Token salah atau tidak ada' })); }
    const id = url.pathname.split('/').pop();
    const list = readAll().filter((n) => n.id !== id);
    writeAll(list);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`WA Notif Vault jalan di http://localhost:${PORT}`);
  console.log(`Token API (sudah otomatis dipakai dashboard): ${API_TOKEN}`);
});
