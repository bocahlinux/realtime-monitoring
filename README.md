# 🧾 e-Samsat Kalteng — Monitoring Dashboard (Realtime)

**e-Samsat Kalteng Monitoring Dashboard** adalah aplikasi web berbasis **Node.js + Supabase + PostgreSQL** yang digunakan untuk memantau penerimaan pajak kendaraan bermotor secara *realtime* di lingkungan **Bapenda Provinsi Kalimantan Tengah**.

Dashboard ini menampilkan laporan transaksi harian e-Samsat yang langsung tersinkronisasi dengan database Supabase melalui kanal **Supabase Realtime**, sehingga setiap transaksi baru, pembatalan, atau koreksi pembayaran akan langsung muncul tanpa perlu memuat ulang halaman.

---

## 🚀 Fitur Utama

- **📡 Laporan Harian Realtime**
  - Data transaksi otomatis diperbarui saat terjadi *insert*, *update*, atau *delete* di Supabase.
  - Mendukung filter tanggal (*Hari ini*, *Kemarin*, *3 hari terakhir*).
  - Indikator status koneksi realtime aktif / terputus.

- **💰 Rekap Pajak Lengkap**
  - Menampilkan total penerimaan berdasarkan jenis pajak:
    - **BBNKB** — pokok & denda  
    - **PKB Berjalan** — pokok & denda  
    - **PKB Tertunggak** — pokok & denda  
    - *(opsional: SWDKLLJ jika diaktifkan di tabel)*  
  - Semua data berubah realtime saat ada transaksi baru atau penghapusan.

- **🔗 Integrasi Django → Supabase**
  - Backend Django mengirim transaksi baru atau membatalkan pembayaran langsung ke endpoint **Supabase REST API**.
  - Menggunakan **Service Role Key** untuk akses aman dan otorisasi penuh.
  - Mendukung `unique(nomor_polisi, tanggal)` untuk mencegah duplikasi transaksi.

- **🎨 Desain Modern dan Ringan**
  - Dibangun dengan **TailwindCSS**, **EJS partials**, dan **Vanilla JavaScript**.
  - Tampilan responsif dan konsisten seperti dashboard profesional.

- **🧱 Self-Hosted Supabase**
  - Berjalan di jaringan lokal (contoh: `http://192.168.168.100:8000`) menggunakan Docker Compose.
  - Fitur Realtime aktif penuh dengan `REPLICA IDENTITY FULL` untuk event DELETE.

---

## 🧠 Arsitektur Sistem

```
+-------------+        +--------------------+        +------------------+
|  Django App | <----> |  Supabase REST API | <----> |  PostgreSQL (db) |
| (Payment)   |        |  & Realtime Server |        |  + Publication   |
+-------------+        +--------------------+        +------------------+
          |                        ↑
          |   WebSocket / HTTP     |
          ↓                        |
   +-------------------------+     |
   |  Node.js Dashboard App  | <---+
   |  (Express + EJS + JS)   |
   +-------------------------+
```

---

## ⚙️ Teknologi yang Digunakan

| Komponen | Teknologi |
|-----------|------------|
| **Frontend** | TailwindCSS, EJS, Vanilla JS |
| **Backend Dashboard** | Node.js (Express) |
| **Database** | PostgreSQL (Supabase Self-Host via Docker) |
| **Integrasi Backend** | Django REST + Supabase REST API |
| **Realtime Engine** | Supabase Realtime (WebSocket) |

---

## 🗂️ Struktur Proyek

```
project/
├── app.js
├── views/
│   ├── laporan_realtime.ejs
│   └── partials/
│       ├── head.ejs
│       ├── sidebar.ejs
│       └── navbar.ejs
├── public/
│   ├── js/
│   │   └── supabase-realtime.js
│   └── css/
├── docker-compose.yml
└── README.md
```

---

## 🧩 Konfigurasi Supabase

Pastikan kamu sudah memiliki **Supabase Self-Host** yang berjalan di jaringan lokal.  
Contoh endpoint default dari docker-compose:

```
http://192.168.168.100:8000
```

Lalu aktifkan fitur realtime penuh dengan menjalankan SQL berikut di dalam database Supabase:

```sql
-- Aktifkan event insert, update, dan delete
ALTER PUBLICATION supabase_realtime SET (publish = 'insert, update, delete');

-- Pastikan tabel eSamsat masuk ke publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.esamsat_tx_harian;

-- Agar event DELETE mengirim data lengkap (bukan hanya primary key)
ALTER TABLE public.esamsat_tx_harian REPLICA IDENTITY FULL;
```

---

## ⚙️ Menjalankan Aplikasi

```bash
# 1. Jalankan Supabase (jika belum aktif)
docker compose up -d

# 2. Install dependencies Node.js
npm install

# 3. Jalankan dashboard monitoring
npm start
```

Akses di browser: **http://localhost:3001**

---

## 🧾 Contoh Data (Supabase Table)

| Kolom | Keterangan |
|-------|-------------|
| `id_transaksi` | bigint (PK, autoincrement) |
| `nomor_polisi` | text |
| `nama_wp` | text |
| `tanggal` | date |
| `pokok_bbnkb` | numeric |
| `denda_bbnkb` | numeric |
| `pj_pkb` | numeric |
| `dj_pkb` | numeric |
| `pt_pkb` | numeric |
| `dt_pkb` | numeric |
| `pj_swdkllj` | numeric |
| `dj_swdkllj` | numeric |
| `pt_swdkllj` | numeric |
| `dt_swdkllj` | numeric |
| `is_online` | boolean |
| `paid_on` | timestamp |
| ... | kolom tambahan opsional |

---

## 📊 Tampilan Dashboard

Dashboard menampilkan:

- Rekap total **PKB**, **SWDKLLJ**, dan **BBNKB** secara realtime  
- Filter tanggal (hari ini, kemarin, 3 hari terakhir)  
- Status koneksi realtime (terhubung / putus)  
- Tabel transaksi detail:
  - No Polisi
  - Nama WP
  - Tanggal
  - BBNKB (Pokok & Denda)
  - PKB Berjalan (Pokok & Denda)
  - PKB Tertunggak (Pokok & Denda)
  - Status Online

---

## 🔗 Integrasi Django → Supabase

Contoh potongan kode Django untuk sinkronisasi transaksi:

```python
payload = {
    "nomor_polisi": tagihan.nomor_polisi,
    "pj_pkb": tagihan.pokok_pkb,
    "is_online": tagihan.is_online,
}

res = requests.post(
    f"{SUPABASE_URL}/rest/v1/esamsat_tx_harian",
    headers={
        "apikey": SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal"
    },
    data=json.dumps(payload)
)

if res.status_code == 201:
    print("✅ Data berhasil dikirim ke Supabase.")
```

Dan untuk penghapusan (batal transaksi):

```python
delete_url = f"{SUPABASE_URL}/rest/v1/esamsat_tx_harian?nomor_polisi=eq.{nopol}&tanggal=eq.{tanggal}"
res = requests.delete(delete_url, headers={
    "apikey": SERVICE_ROLE_KEY,
    "Authorization": f"Bearer {SERVICE_ROLE_KEY}",
})
```

---

## 🧠 Tips Debugging

Jika event DELETE tidak muncul di dashboard:
1. Jalankan `ALTER TABLE ... REPLICA IDENTITY FULL;`
2. Pastikan nama tabel sesuai di Realtime channel:
   ```js
   .on('postgres_changes', { event: '*', schema: 'public', table: 'esamsat_tx_harian' }, applyDelta)
   ```
3. Cek console browser — harus muncul log `DELETE Event:`.

---

## 🏛️ Lisensi

Proyek ini dikembangkan oleh **PT Yuk Code Creative**  
untuk mendukung sistem digitalisasi pajak kendaraan bermotor di **Bapenda Provinsi Kalimantan Tengah**.  
Lisensi bersifat **private/internal use** kecuali dinyatakan lain.

---

### ✨ Deskripsi singkat (untuk kolom atas GitHub)

> Realtime monitoring dashboard untuk e-Samsat Kalteng — menampilkan laporan penerimaan PKB, BBNKB, dan SWDKLLJ secara langsung terhubung dengan Supabase self-host.
