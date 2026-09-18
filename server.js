require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const API_TOKEN = process.env.API_TOKEN || 'ganti-token-ini';
const DATA_FILE = path.join(__dirname, 'data', 'notifications.json');

// --- Setup penyimpanan sederhana (file JSON, cukup untuk pemakaian pribadi) ---
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'));
}
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, '[]');
}

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function writeAll(list) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2));
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serve file frontend secara eksplisit (bukan seluruh folder), biar server.js dan .env tidak ikut terekspos
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/index.html', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/app.js', (req, res) => res.sendFile(path.join(__dirname, 'app.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));

// Middleware auth sederhana pakai token, biar endpoint webhook kamu nggak dipakai orang lain
function checkToken(req, res, next) {
  const token = req.headers['x-api-token'] || req.query.token;
  if (token !== API_TOKEN) {
    return res.status(401).json({ error: 'Token salah atau tidak ada' });
  }
  next();
}

// --- Endpoint webhook: dipanggil oleh MacroDroid/Tasker setiap ada notifikasi baru ---
// Body yang diharapkan (sesuaikan dengan field yang dikirim MacroDroid, lihat README):
// { "app": "WhatsApp", "title": "Budi", "text": "Isi pesannya...", "timestamp": "2026-09-19T10:00:00Z" }
app.post('/api/notifications', checkToken, (req, res) => {
  const { app: appName, title, text, timestamp } = req.body;

  if (!appName || !text) {
    return res.status(400).json({ error: 'Field "app" dan "text" wajib diisi' });
  }

  const list = readAll();
  const entry = {
    id: crypto.randomUUID(),
    app: appName,
    title: title || '',
    text,
    timestamp: timestamp || new Date().toISOString(),
    receivedAt: new Date().toISOString(),
  };
  list.unshift(entry); // terbaru di atas
  writeAll(list);

  res.status(201).json({ ok: true, id: entry.id });
});

// --- Endpoint untuk dashboard: ambil semua notifikasi tersimpan ---
app.get('/api/notifications', checkToken, (req, res) => {
  const { app: filterApp, q, limit } = req.query;
  let list = readAll();

  if (filterApp) {
    list = list.filter((n) => n.app.toLowerCase() === String(filterApp).toLowerCase());
  }
  if (q) {
    const needle = String(q).toLowerCase();
    list = list.filter(
      (n) =>
        n.text.toLowerCase().includes(needle) ||
        (n.title || '').toLowerCase().includes(needle)
    );
  }
  if (limit) {
    list = list.slice(0, parseInt(limit, 10));
  }

  res.json(list);
});

// --- Import chat lama/arsip dari file "Export Chat" WhatsApp (format .txt bawaan WA) ---
// Body: { "chatName": "Budi", "rawText": "isi file export .txt" }
// Format baris WA export umumnya: "DD/MM/YY, HH.MM - Nama: pesan"
app.post('/api/import', checkToken, (req, res) => {
  const { chatName, rawText } = req.body;
  if (!rawText) {
    return res.status(400).json({ error: 'Field "rawText" wajib diisi (isi file export chat)' });
  }

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
      // baris lanjutan (pesan multi-baris)
      current.text += '\n' + line;
    }
  }
  if (current) entries.push(current);

  if (!entries.length) {
    return res.status(400).json({ error: 'Tidak ada baris yang cocok dengan format export WhatsApp' });
  }

  const list = readAll();
  const merged = [...entries, ...list];
  writeAll(merged);

  res.status(201).json({ ok: true, imported: entries.length });
});

function parseWaDate(date, time) {
  try {
    const [d, m, y] = date.split('/').map((n) => parseInt(n, 10));
    const fullYear = y < 100 ? 2000 + y : y;
    const cleanTime = time.replace('.', ':');
    return new Date(`${fullYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}T${cleanTime.length === 5 ? cleanTime + ':00' : cleanTime}`).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

// --- Hapus satu entri (misal setelah dibaca / tidak perlu lagi) ---
app.delete('/api/notifications/:id', checkToken, (req, res) => {
  const list = readAll();
  const next = list.filter((n) => n.id !== req.params.id);
  writeAll(next);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`wa-notif-vault jalan di http://localhost:${PORT}`);
  console.log(`Token API kamu (jaga jangan sampai bocor): ${API_TOKEN}`);
});
