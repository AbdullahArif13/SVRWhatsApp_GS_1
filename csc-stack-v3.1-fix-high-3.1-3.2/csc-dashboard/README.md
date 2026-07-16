# CSC_IT_GS Dashboard

Front end hasil implementasi dari desain Figma (Add Contact, Templates, Create
Template, dan Chat), dibangun dengan **React + Vite + Tailwind CSS**.

## Menjalankan project

```bash
npm install
npm run dev
```

Lalu buka `http://localhost:5173`.

## Struktur folder

```
src/
├── components/        # Komponen yang dipakai berulang di banyak halaman
│   ├── Layout.jsx        # Shell halaman: TopBar + Sidebar + area konten
│   ├── TopBar.jsx         # Bar atas (hamburger, logo, nama app)
│   ├── Sidebar.jsx        # Navigasi kiri, otomatis highlight sesuai halaman aktif
│   ├── SidebarButton.jsx  # Satu tombol navigasi (Add Contact/Add Template/Start Chat)
│   ├── PageHeader.jsx     # Judul halaman + tombol aksi di kanan atas
│   └── Watermark.jsx      # Logo "GS" transparan di background
├── pages/              # Satu file per halaman/route
│   ├── AddContact.jsx     # Form tambah nomor WhatsApp + tabel kontak
│   ├── Templates.jsx      # Daftar template WhatsApp + filter
│   ├── CreateTemplate.jsx # Form buat template + panel preview
│   └── Chat.jsx           # Daftar percakapan + jendela chat
├── data/
│   └── mockData.js     # Data contoh (contacts, templates, conversations)
├── App.jsx             # Definisi routing
├── main.jsx            # Entry point React
└── index.css           # Import Tailwind + style global
```

## Cara kerja warna tombol sidebar

Tombol navigasi (`SidebarButton.jsx`) selalu **biru** dalam kondisi diam, dan
hanya berubah **abu-abu** saat kursor menunjuk/hover ke tombol tersebut
(state `:hover` murni via Tailwind `hover:bg-brand-active`). Warna tidak
ditentukan oleh halaman mana yang sedang aktif.

Khusus `/chat`, sidebar menyusut dan hanya menampilkan tombol **Start Chat**
ditambah daftar percakapan (sesuai desain layar chat "Gatekeeper").

Warna brand (biru & abu-abu) diatur terpusat di `tailwind.config.js` pada
`theme.extend.colors.brand`, jadi kalau butuh ganti warna cukup diubah di satu
tempat.

## Toggle sidebar (ikon garis tiga)

Perilakunya beda sedikit tergantung halaman, karena `Layout.jsx` membiarkan
tiap halaman "mengambil alih" arti tombol hamburger lewat prop `onToggleSidebar`:

- **Di `/contacts`, `/templates`, `/templates/create`**: sidebar memang sudah
  menampilkan ketiga fitur secara default, hamburger hanya untuk
  menyembunyikan/menampilkan sidebar (hemat ruang layar).
- **Di `/chat`**: sidebar defaultnya tampil ringkas — cuma tombol **Start
  Chat** + daftar percakapan (`ConversationList`). Klik hamburger akan
  **menampilkan kembali ketiga fitur** (Add Contact, Add Template, Start
  Chat) menggantikan daftar percakapan, sesuai `forceFullMenu` yang dikirim
  dari `Chat.jsx`. Klik lagi untuk kembali ke daftar percakapan. Jadi
  navigasi ke Add Contact / Add Template tetap bisa diakses walau sedang
  membuka Start Chat -- sidebar tidak pernah benar-benar hilang di halaman ini.

## Create Template: variabel dinamis ({{barang}}, dst)

Di `CreateTemplate.jsx`, setiap `{{namaVariabel}}` unik yang diketik di Body
Message otomatis dideteksi (`extractVariableNames`) dan langsung membuat satu
form input di panel **Input Data** -- labelnya persis nama variabel yang
diketik (mis. `{{barang}}` -> field "barang"), **bukan** diubah jadi indeks
posisi seperti `{{1}}`, `{{2}}`, `{{3}}`. Kalau variabel dihapus dari teks,
form-nya ikut hilang; kalau ditambah, form baru otomatis muncul.

Saat "Create Template" ditekan, payload yang disiapkan berbentuk:

```json
{
  "template_name": "...",
  "template_message": "Halo {{nama}}, request {{barang}} sudah kami terima.",
  "variables": {
    "nama": "Omar Fanani",
    "barang": "FILTER MASKER 4N95 UGO"
  }
}
```

Jadi `variables` adalah objek dengan key = nama variabel asli, bukan array
berbasis posisi. Tinggal ganti `console.log(payload)` di `handleCreate` dengan
pemanggilan API yang sebenarnya.

## Add Contacts: kolom Nomor

Tabel kontak di `AddContact.jsx` sekarang menampilkan 3 kolom: **Name**,
**Nomor**, dan **Create at**, sesuai desain terbaru.

## Logo watermark asli

`public/gs-watermark.png` berisi gambar logo watermark yang sebenarnya
(bukan lagi teks "GS" hasil CSS). File di folder `public/` otomatis
ter-serve di root (`/gs-watermark.png`) dan ikut ter-copy saat `npm run
build`, jadi tidak perlu di-import manual. `Watermark.jsx` tinggal
menampilkannya lewat tag `<img>`. Kalau mau ganti logo, tinggal timpa file
itu dengan nama yang sama.

## Templates: klik nama untuk lihat isi

Di halaman `/templates`, kolom **Template name** sekarang bisa diklik. Klik
nama template mana pun akan membuka popup detail (`TemplateDetailModal`)
yang menampilkan nama, status, tanggal dibuat, dan isi **Body Message**
lengkap (termasuk placeholder `{{...}}` apa adanya). Klik di luar kartu popup
atau tombol "Tutup" untuk menutupnya.

## "Use Template" di halaman Chat -- alur final

Ada 2 kontrol yang terpisah fungsinya:

1. **Ikon di dalam kotak input** (`icon-input-file.png`) -- fungsinya cuma
   toggle tampil/sembunyikan tombol pill **"Use Template"**. Tidak langsung
   membuka popup apa pun. Klik lagi -> tombol itu hilang lagi (dan popup ikut
   tertutup kalau kebetulan sedang terbuka).
2. **Tombol pill "Use Template"** (baru muncul setelah ikon di atas diklik)
   -- ini yang membuka/menutup popup **"Tamplate Name"**. Warnanya biru saat
   diam, abu-abu saat hover, dan tetap abu-abu selama popup terbuka.

Jadi urutan pemakaiannya: klik ikon -> tombol "Use Template" muncul -> klik
tombol itu -> baru popup daftar template muncul.

Daftar template di popup itu **bukan data statis terpisah** -- diambil dari
`TemplatesContext` (`src/context/TemplatesContext.jsx`), state yang sama
dipakai juga oleh halaman Templates (daftar) dan Create Template (bikin
baru). Jadi begitu kamu bikin template baru di Create Template, dia langsung
muncul juga di popup "Tamplate Name" pada halaman Chat -- tidak perlu ubah
dua tempat.

## Chat: input pesan statis di bawah

Halaman Chat memakai `Layout` dengan prop `fullHeight`, yang membuat area
konten mengisi tinggi viewport secara pasti (bukan mengikuti tinggi
dokumen). Di dalamnya, `ChatWindow` disusun sebagai kolom flex: daftar pesan
(`flex-1 overflow-y-auto`) yang bisa di-scroll sendiri, sementara kotak input
di bagian bawah tetap diam di posisinya karena bukan bagian yang di-scroll.

## Menyambungkan ke API asli

Saat ini semua data (`contacts`, `templates`, `conversations`) masih berupa
mock data di `src/data/mockData.js`. Untuk produksi, ganti pemanggilan mock
data itu dengan `fetch`/`axios` ke backend, misalnya di dalam `useEffect` pada
tiap halaman.
