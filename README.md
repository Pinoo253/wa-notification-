# WA Notif Vault

Simpan histori notifikasi WhatsApp (dan aplikasi lain) yang masuk ke **HP kamu sendiri**,
supaya kalau lawan chat menghapus pesannya, isi yang sempat muncul di notifikasi tetap
tersimpan dan bisa dicari lewat dashboard web ini.

> **Batasan penting:** ini menyimpan *teks notifikasi* (title + preview pesan) yang benar-benar
> muncul di HP kamu — bukan "hack" ke akun WhatsApp orang lain. WhatsApp terenkripsi ujung-ke-ujung
> dan tidak ada cara sah untuk membaca ulang pesan yang sudah dihapus dari server/akun orang lain.
> Media (foto/video) di notifikasi WA biasanya cuma muncul sebagai thumbnail kecil atau teks
> "📷 Photo" — jadi tool ini efektif untuk teks, terbatas untuk media.

## Cara kerja

```
WhatsApp di HP kamu → notifikasi muncul
        ↓
MacroDroid / Tasker (di HP kamu) → baca notifikasi → kirim webhook POST
        ↓
Server ini (server.js) → simpan ke data/notifications.json
        ↓
Dashboard web (public/index.html) → kamu cari & baca kapan saja
```

## 1. Install & jalankan server

```bash
npm install
cp .env.example .env
# buka .env, ganti API_TOKEN dengan string acak yang panjang & rahasia
npm start
```

Server jalan di `http://localhost:3000`. Kalau mau diakses dari HP juga (bukan cuma
komputer), deploy ke layanan gratis seperti Railway, Render, atau Fly.io — tinggal
push repo ini ke GitHub lalu connect ke salah satu layanan itu, set environment
variable `API_TOKEN` di sana juga.

## 2. Setting MacroDroid di HP Android kamu

1. Install **MacroDroid** dari Play Store (gratis, ada versi trial cukup untuk 1 macro).
2. Buat macro baru:
   - **Trigger:** `Notification` → pilih aplikasi **WhatsApp**.
   - **Action:** `HTTP Request` (di kategori Connectivity):
     - Method: `POST`
     - URL: `https://alamat-server-kamu/api/notifications?token=TOKEN_KAMU`
     - Content type: `application/json`
     - Body:
       ```json
       {
         "app": "WhatsApp",
         "title": "[notification_title]",
         "text": "[notification_text]",
         "timestamp": "[current_date_time_iso]"
       }
       ```
       (Ganti bagian `[...]` dengan variabel MacroDroid yang sesuai — MacroDroid
       menyediakan variabel `nl_title` dan `nl_text` untuk isi notifikasi terakhir.)
3. Simpan macro, pastikan MacroDroid diberi izin **Notification Access** dan
   berjalan di background tanpa dimatikan oleh battery optimizer HP kamu.

Alternatif: Tasker dengan plugin **AutoNotification** + **HTTP Request**, caranya mirip.

## 3. Baca chat lama & arsip (bukan cuma notifikasi baru)

Notifikasi cuma nangkep pesan yang masuk **setelah** kamu pasang MacroDroid. Untuk chat
lama atau chat yang sudah kamu arsipkan di WhatsApp, pakai fitur **Export Chat** bawaan
WhatsApp — ini resmi dan legal karena itu chat kamu sendiri:

1. Di WhatsApp, buka chat (termasuk yang ada di folder Arsip) yang mau di-backup.
2. Ketuk nama kontak/grup di atas → scroll ke bawah → **Export Chat**.
3. Pilih **Tanpa Media** (lebih cepat) atau **Sertakan Media**.
4. Simpan file `.txt` yang dihasilkan (via Kirim ke Diri Sendiri, Drive, dll), lalu
   download ke komputer/HP tempat kamu buka dashboard.
5. Di dashboard, bagian **"Import chat lama/arsip"** → isi nama kontak, pilih file
   `.txt` tadi, klik **Import**. Semua pesan di file itu akan masuk ke vault dan bisa
   dicari bareng dengan notifikasi WA yang lain.

Ini bisa dipakai berkali-kali untuk banyak chat (termasuk grup dan chat yang sudah kamu
arsipkan), tinggal ulangi proses export-per-chat lalu import satu-satu.

## 4. Buka dashboard

Buka `http://alamat-server-kamu/` di browser, masukkan token API yang sama dengan
di `.env`, lalu notifikasi yang masuk akan muncul dan bisa dicari.

## 5. Push ke GitHub

```bash
git init
git add .
git commit -m "Initial commit: wa-notif-vault"
git branch -M main
git remote add origin https://github.com/USERNAME/wa-notif-vault.git
git push -u origin main
```

File `.env` dan `data/notifications.json` sudah masuk `.gitignore` supaya token
rahasia dan data notifikasi kamu **tidak ikut ter-push** ke GitHub publik.

## Struktur file

```
wa-notif-vault/
├── server.js          # server Express + API webhook & penyimpanan
├── index.html          # dashboard
├── app.js              # logic dashboard
├── style.css           # tampilan dashboard
├── package.json
├── .env.example
├── .gitignore
└── data/               # dibuat otomatis saat server jalan, isi notifications.json
```

## Keamanan

- Jangan share URL server + token API ke siapa pun.
- Kalau deploy publik, pertimbangkan tambah HTTPS (otomatis kalau pakai Railway/Render).
- Data yang tersimpan bisa berisi info pribadi orang yang chat dengan kamu —
  perlakukan sebagai data sensitif.
