# CSC Dashboard Backend — Endpoint Kirim Pesan WA (Dynamic Template)

## Cara Jalankan

```bash
npm install
cp .env.example .env   # isi WA_PROVIDER_URL & WA_PROVIDER_TOKEN kalau sudah punya
npm run dev
```

Server jalan di `http://localhost:3001`.

Kalau `.env` belum diisi provider WA, endpoint tetap bisa dites — pesan hanya
akan di-log ke console (mode simulasi), tidak benar-benar terkirim.

## Endpoint

### POST /api/send-message

Body **dinamis** — `template_wa`, `no_wa`, dan (sejak v3) `nama_wa` wajib ada
di root, sisanya masuk ke dalam object `values` sesuai variabel template yang
dipakai.

**v3 — `nama_wa` vs `values.nama`:** ini dua field yang terpisah, walau
isinya sering sama persis:
- `nama_wa` : nama kontak WA tujuan. Cuma dipakai untuk ditampilkan di
  halaman "Riwayat Pengiriman" / "Chat" di dashboard — **tidak pernah**
  dipakai untuk mengisi `{{...}}` di body template.
- `values.nama` : isi untuk placeholder `{{nama}}` di body template.
  Hanya perlu diisi kalau body template yang dipakai memang punya
  `{{nama}}`.

Contoh (template `spct_order`):

```bash
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "template_wa": "spct_order",
    "no_wa": "089189182",
    "nama_wa": "Bapak Fauzi",
    "values": {
      "nama": "Abdullah",
      "nomor_request": "CSC/01",
      "requester": "Masker",
      "item": "N96"
    }
  }'
```

Contoh (template lain, `Reminder_Switch_Alert` — perhatikan `values` beda total,
tapi struktur request tetap sama):

```bash
curl -X POST http://localhost:3001/api/send-message \
  -H "Content-Type: application/json" \
  -d '{
    "template_wa": "Reminder_Switch_Alert",
    "no_wa": "089189182",
    "nama_wa": "Bapak Fauzi",
    "values": {
      "nama": "Bapak Fauzi",
      "lokasi": "Gudang A",
      "jam": "15:00"
    }
  }'
```

Kalau ada variabel template yang belum diisi, respons 400 dan menyebutkan
variabel mana saja yang kurang:

```json
{
  "success": false,
  "message": "Variabel berikut belum diisi: Item",
  "required_variables": ["Nama", "Nomor", "Nama_Requester", "Item"],
  "missing_variables": ["Item"]
}
```

### GET /api/messages

Riwayat semua percobaan pengiriman (berhasil maupun gagal), dipakai oleh
halaman "Riwayat Pengiriman" di FrontEnd. FrontEnd sendiri **tidak pernah**
memicu pengiriman — endpoint ini murni untuk ditampilkan.

```bash
curl http://localhost:3001/api/messages
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "template_wa": "spct_order",
      "no_wa": "089189182",
      "recipient_name": "Abdullah",
      "values": { "Nomor": "CSC/01", "Nama": "Abdullah", "...": "..." },
      "final_message": "Halo Bapak/Ibu Abdullah, ...",
      "status": "terkirim",
      "error_message": null,
      "created_at": "2026-07-07T06:20:00.000Z"
    }
  ]
}
```

Catatan: saat ini riwayat masih disimpan in-memory (`src/data/messageLogs.js`)
dan hilang saat server restart. Begitu database MySQL di XAMPP sudah siap,
ganti isi file itu dengan query ke tabel `message_logs`.

### Kelola Template (v3 — edit & hapus)

Dashboard "Templates" sekarang bisa edit dan menghapus template lewat
endpoint-endpoint berikut. Menghapus dilakukan bertahap (non-aktifkan dulu,
baru bisa dihapus permanen) supaya tidak ada template yang kehapus tanpa
sengaja:

```bash
# Edit nama/isi template (icon folder di tabel)
curl -X PUT http://localhost:3001/api/templates/1 \
  -H "Content-Type: application/json" \
  -d '{ "name": "spct_order", "body": "Halo {{nama}}, ..." }'

# Non-aktifkan (icon trash di tabel) -- BUKAN hapus, baris tetap ada
curl -X PATCH http://localhost:3001/api/templates/1/deactivate

# Aktifkan lagi (tombol "Continuous" di popup detail)
curl -X PATCH http://localhost:3001/api/templates/1/activate

# Hapus PERMANEN (tombol "Delete" di DALAM popup detail)
curl -X DELETE http://localhost:3001/api/templates/1
```

Template yang sedang non-aktif (`is_active = 0`) tidak akan ketemu lagi lewat
`template_wa` di `POST /api/send-message` — dianggap "sudah dihapus" dari
sudut pandang sistem yang mengirim pesan, walau baris-nya belum benar-benar
hilang dari database.

### GET /api/templates/:name/variables

Bantu frontend tahu variabel apa saja yang dibutuhkan suatu template,
tanpa hardcode di sisi frontend:

```bash
curl http://localhost:3001/api/templates/spct_order/variables
```

```json
{
  "success": true,
  "template_name": "spct_order",
  "variables": ["Nama", "Nomor", "Nama_Requester", "Item"]
}
```

## Struktur Folder

```
src/
├── data/templates.js          # sumber data template (ganti ke DB nanti)
├── utils/templateEngine.js    # extract & fill {{variabel}} — logicnya sama dengan CreateTemplate.jsx di frontend
├── services/waService.js      # pemanggil provider WhatsApp API
├── controllers/messageController.js
├── routes/messageRoutes.js
└── server.js
```

## Kenapa strukturnya begini (bukan field statis)

Template body bisa berisi placeholder `{{apa_saja}}` — jumlah dan namanya
beda-beda tiap template (lihat `CreateTemplate.jsx` di frontend, fungsi
`extractVariableNames`). Kalau endpoint dibuat dengan field statis
(`Nomor`, `Nama`, `Item`, dst di root JSON), begitu ada template baru
dengan variabel berbeda, endpoint harus diubah kodenya lagi.

Dengan membungkus variabel di dalam object `values`, dan nama variabel
yang wajib diambil otomatis dari `body` template (bukan hardcode di
backend), template baru dengan variabel apa pun langsung bisa dipakai
tanpa ubah kode endpoint sama sekali — sistem permintaan bisa "meminta apa
saja" sesuai kebutuhan.

## Menghubungkan ke Template yang Dibuat di Frontend

Saat ini `src/data/templates.js` masih hardcode 2 contoh template.
Supaya template yang dibuat lewat halaman **Create Template** di frontend
otomatis bisa dipakai lewat endpoint ini, langkah selanjutnya adalah:

1. Simpan template ke database (bukan hanya di React state `TemplatesContext`).
2. Ganti `findTemplateByName` di `data/templates.js` supaya query ke
   database yang sama, bukan array hardcode.
3. Frontend (`TemplatesContext.jsx` → `addTemplate`) memanggil endpoint
   `POST /api/templates` (belum dibuat) untuk menyimpan template baru ke
   database yang sama itu.
