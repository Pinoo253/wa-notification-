const tokenInput = document.getElementById('tokenInput');
const saveTokenBtn = document.getElementById('saveTokenBtn');
const searchInput = document.getElementById('searchInput');
const appFilter = document.getElementById('appFilter');
const refreshBtn = document.getElementById('refreshBtn');
const listEl = document.getElementById('list');

function getToken() {
  return localStorage.getItem('wa_vault_token') || '';
}

tokenInput.value = getToken();

saveTokenBtn.addEventListener('click', () => {
  localStorage.setItem('wa_vault_token', tokenInput.value.trim());
  loadNotifications();
});

refreshBtn.addEventListener('click', loadNotifications);
searchInput.addEventListener('input', debounce(loadNotifications, 300));
appFilter.addEventListener('change', loadNotifications);

function debounce(fn, delay) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

async function loadNotifications() {
  const token = getToken();
  if (!token) {
    listEl.innerHTML = '<div class="empty">Masukkan token API dulu di atas.</div>';
    return;
  }

  const params = new URLSearchParams();
  if (searchInput.value) params.set('q', searchInput.value);
  if (appFilter.value) params.set('app', appFilter.value);

  try {
    const res = await fetch(`/api/notifications?${params.toString()}`, {
      headers: { 'x-api-token': token },
    });
    if (!res.ok) {
      listEl.innerHTML = `<div class="empty">Gagal memuat (${res.status}). Cek token kamu.</div>`;
      return;
    }
    const data = await res.json();
    render(data);
  } catch (err) {
    listEl.innerHTML = `<div class="empty">Tidak bisa terhubung ke server.</div>`;
  }
}

function render(items) {
  if (!items.length) {
    listEl.innerHTML = '<div class="empty">Belum ada notifikasi tersimpan.</div>';
    return;
  }

  listEl.innerHTML = items
    .map(
      (n) => `
    <div class="item">
      <div class="item-top">
        <span class="item-title">${escapeHtml(n.title || '(tanpa judul)')}</span>
        <span class="item-time">${formatTime(n.timestamp)}</span>
      </div>
      <div class="item-text">${escapeHtml(n.text)}</div>
      <span class="item-app">${escapeHtml(n.app)}</span>
    </div>
  `
    )
    .join('');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleString('id-ID');
  } catch {
    return iso;
  }
}

loadNotifications();

const importBtn = document.getElementById('importBtn');
const importFile = document.getElementById('importFile');
const importChatName = document.getElementById('importChatName');
const importStatus = document.getElementById('importStatus');

importBtn.addEventListener('click', async () => {
  const token = getToken();
  if (!token) {
    importStatus.textContent = 'Masukkan token dulu.';
    return;
  }
  const file = importFile.files[0];
  if (!file) {
    importStatus.textContent = 'Pilih file .txt hasil Export Chat WhatsApp dulu.';
    return;
  }

  const rawText = await file.text();
  importStatus.textContent = 'Mengimpor...';

  try {
    const res = await fetch('/api/import', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': token,
      },
      body: JSON.stringify({ chatName: importChatName.value || file.name, rawText }),
    });
    const data = await res.json();
    if (!res.ok) {
      importStatus.textContent = `Gagal: ${data.error || res.status}`;
      return;
    }
    importStatus.textContent = `Berhasil impor ${data.imported} pesan.`;
    loadNotifications();
  } catch (err) {
    importStatus.textContent = 'Tidak bisa terhubung ke server.';
  }
});
