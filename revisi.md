# DRAF RENCANA REVISI AKTIF (v6.7.0)
## INVESTIGASI & PERBAIKAN: PIPELINE UPLOAD VIDEO KE GOOGLE DRIVE / CLOUD STORAGE CDN & LIVE LOADING INDICATOR

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% dari baris pertama setiap ada sesi revisi baru. Riwayat revisi lama yang telah selesai dan tervalidasi tersimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. JAWABAN LANGSUNG ATAS PERTANYAAN PENGGUNA

* **Kenapa saat upload video muncul error *"Maaf, file yang Anda minta tidak ada"* dari Google Drive?**  
  👉 **Akar Masalahnya Sangat Fatal Namun Menarik:**  
  Video yang Anda pilih dari HP/laptop **SAMA SEKALI BELUM PERNAH TERUNGGAH KE GOOGLE DRIVE MAUPUN CLOUD!**  
  Yang terjadi sebenarnya:
  1. Kode pemanggil fungsi upload gagal memanggil adapter cloud karena nama objek adapter di JavaScript tidak sinkron (`window.GasSupabaseAdapter` bernilai `undefined`).
  2. Karena gagal terpanggil, sistem melompat ke mode darurat (*Local Fallback*) dan mengubah file video Anda menjadi teks kode mentah (Base64) yang sangat panjang: `data:video/quicktime;base64,AAAAFGZ0...` (lihat tangkapan layar 1 Anda, teks panjang itu adalah data biner video Anda!).
  3. Lalu muncul **bug regex halusinasi**: Pendeteksi link Google Drive di aplikasi kita mencari pola `/d/ID`. Karena teks Base64 itu memiliki jutaan karakter acak, di tengah-tengah teks Base64 itu kebetulan ada karakter `/d/WFaSunMCd0Bs`!
  4. Sistem antarmuka mengira teks tersebut adalah link Google Drive sungguhan dan membuat link palsu: `https://drive.google.com/file/d/WFaSunMCd0Bs/preview`.
  5. Pemutar iframe video memanggil link palsu tersebut ke Google Drive. Tentu saja server Google Drive merespons: *"Maaf, file yang Anda minta tidak ada. Pastikan bahwa Anda memiliki URL yang benar dan file tersebut memang ada."*
  6. Saat Anda menekan tombol "Simpan ke Langkah", link palsu `WFaSunMCd0Bs` inilah yang tersimpan ke database Supabase (lihat tangkapan layar 2 & 3 Anda).

* **Apakah alur upload > Google Drive > dapat link video > disimpan linknya di Supabase > web app play embed video sudah tepat?**  
  👉 **YA, 100% INI ADALAH ALUR YANG TEPAT & KAMI SEPAKAT PENUH!**  
  Alur arsitektur yang Anda minta adalah standar emas industri:
  1. User memilih file video di antarmuka web app.
  2. Muncul **loading indicator interaktif & animated progress bar** (0% ➔ 100%) dengan status keterangan transparan agar user tahu sistem sedang mengirim video ke cloud.
  3. Berkas video diunggah ke Google Drive melalui Google Apps Script (dengan failover otomatis ke Supabase Storage CDN jika ukuran video sangat besar).
  4. Google Drive memberikan File ID resmi dan URL embed publik: `https://drive.google.com/file/d/{FILE_ID}/preview`.
  5. Kolom input URL otomatis terisi link bersih Google Drive tersebut dan live preview langsung memutar video secara mulus.
  6. Ketika tombol "SIMPAN KE LANGKAH" diklik, yang disimpan ke Supabase HANYALAH link URL Google Drive tersebut (bukan teks base64 raksasa).
  7. Ketika driver/user membuka SOP, iframe web app langsung memutar video dari link Google Drive tanpa error 404!

---

## 2. HASIL AUDIT TEKNIS & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Berdasarkan audit mendalam baris demi baris pada berkas `tb-delivery-pro/index.html`, `supabase-gas-adapter.js`, dan database Supabase live:

### 1. Objek Adapter Tidak Dikenali (`window.GasSupabaseAdapter` is undefined)
Pada `index.html` baris 54638 di fungsi `handleDirectVideoFileChosen(inputEl)`:
```javascript
const adapter = window.GasSupabaseAdapter || window.SupabaseGasAdapter;
if (adapter && typeof adapter.uploadSopVideoFile === 'function') {
    // Unggah ke Cloud
} else {
    // Local Fallback: FileReader.readAsDataURL(file)
}
```
Di seluruh berkas JavaScript kita, adapter backend diikat ke `window.google.script.run` dan bukan ke nama variabel `GasSupabaseAdapter`. Karena kondisi tersebut `false`, browser langsung mengeksekusi blok `else` (Local Fallback).

### 2. File Video Berubah Menjadi Teks Base64 Raksasa
Pada blok `else`, sistem membaca file video lokal menggunakan `FileReader.readAsDataURL(file)`. Teks biner raksasa tersebut dimasukkan langsung ke input `#sopVideoUrlInput.value = e.target.result;`.

### 3. Celah Regex Deteksi Google Drive di `parseVideoMediaUrl`
Pada `index.html` baris 54552:
```javascript
let driveId = '';
const gdMatch1 = str.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
const gdMatch2 = str.match(/[?&]id=([a-zA-Z0-9_-]+)/);
const gdMatch3 = str.match(/\/d\/([a-zA-Z0-9_-]+)/); // <-- LUBANG BESAR
```
Pola `gdMatch3` sama sekali tidak memeriksa apakah domainnya adalah `drive.google.com`.
Ketika string Base64 ribuan karakter masuk, karakter acak `.../d/WFaSunMCd0Bs...` tertangkap oleh `gdMatch3`.
Sistem mengira itu ID Google Drive `WFaSunMCd0Bs` dan langsung membentuk URL:
`https://drive.google.com/file/d/WFaSunMCd0Bs/preview`.
Akibatnya kotak live preview menampilkan pesan error Google Drive 404.

### 4. Database Tercemar Link Google Drive Palsu
Pada tabel `sop_steps` untuk record langkah ke-2 SOP yang baru dibuat (`SOP-1794026657238-L2`):
- Kolom `media_examples` menyimpan:
  `direct_url: "https://drive.google.com/file/d/WFaSunMCd0Bs/preview"`
  `url: "data:video/quicktime;base64,AAAAFGZ0..."`
Inilah yang menyebabkan saat kartu SOP dibuka kembali (tangkapan layar 2 & 3), video tetap memanggil link fiktif tersebut dan menampilkan pesan error Google Drive.

### 5. Status Web App Google Apps Script
Endpoint Google Apps Script (`DEFAULT_GAS_URL`) yang terpasang saat ini memerlukan pengaturan akses:
Jika deployment GAS di Google Script belum diatur ke **"Who has access: Anyone"**, Google akan mengalihkan request POST ke halaman login akun Google. Oleh karena itu, arsitektur harus memiliki jalur ganda (*dual-engine*): Google Drive sebagai jalur utama, dengan Supabase Storage CDN publik (`brand-assets`) sebagai jalur pengaman instan tanpa batasan kuota.

---

## 3. ARSITEKTUR SOLUSI PIPELINE VIDEO & LOADING INDICATOR (v6.7.0)

### A. Alur Kerja Unggah Video Baru (Sesuai Permintaan Anda)
```
[ User Pilih Video MP4/WebM/MOV ]
               │
               ▼
[ Tampilkan UI Loading Interaktif ]
   - Spinner & Animasi Progress Bar (0% -> 100%)
   - Nama Berkas & Ukuran File Asli (MB)
   - Status: "Mengunggah video ke Cloud Storage..."
   - Tombol "SIMPAN KE LANGKAH" di-kunci sementara (disabled)
               │
               ▼
[ Engine Unggah Cloud ]
   ├── Jalur A: Google Apps Script -> Simpan ke Folder Google Drive
   │     └── Mengembalikan: https://drive.google.com/file/d/{FILE_ID}/preview
   │
   └── Jalur B (Failover Otomatis): Supabase Storage CDN (Bucket 'brand-assets')
         └── Mengembalikan URL Public CDN berkecepatan tinggi
               │
               ▼
[ Tautan Bersih Didapatkan ]
   - Mengisi `#sopVideoUrlInput` dengan link bersih (bukan Base64!)
   - Berpindah otomatis ke Tab Preview
   - Live Preview memuat video siap putar
   - Buka kunci tombol "SIMPAN KE LANGKAH"
               │
               ▼
[ User Klik "SIMPAN KE LANGKAH" ]
   - Supabase menyimpan link bersih ke `sop_steps.media_examples`
   - Bebas dari error 404 & bebas dari database bengkak!
```

### B. Desain Antarmuka Loading Indicator & Progress Bar Realtime
1. Di dalam tab unggah video (`#sopVideoTabUploadSection`), ketika user memilih video:
   - Dropzone disembunyikan dan digantikan oleh **Kartu Loading Status Modern**:
     - Ikon awan berdenyut (*pulsating cloud icon*).
     - Nama file video & ukuran file: misal `IMG_3279.MOV • 14.2 MB`.
     - Progress bar animasi gradien ungu-biru bergerak dari 0% ke 100%.
     - Teks langkah transparan:
       - `15% - Membaca berkas video...`
       - `45% - Mengunggah ke Google Drive Cloud Storage...`
       - `85% - Memproses izin akses publik & tautan sematan (embed)...`
       - `100% - Berhasil! Video siap diputar.`
2. Tombol `SIMPAN KE LANGKAH` diberi status `disabled` dengan teks `Sedang Mengunggah...` agar user tidak menyimpan sebelum video selesai diproses di cloud.

### C. Pengetatan Validasi Domain Google Drive di `parseVideoMediaUrl`
Memperbaiki fungsi deteksi agar pola `/d/ID` **HANYA** dieksekusi jika URL mengandung domain Google yang sah:
```javascript
const isGoogleDomain = str.includes('drive.google.com') || 
                       str.includes('docs.google.com') || 
                       str.includes('drive.usercontent.google.com');
```
Jika tidak berasal dari domain Google, string tidak akan pernah lagi diartikan sebagai Google Drive (mencegah bug halusinasi teks Base64).

### D. Pembersihan Data Rusak di Supabase Database
Melakukan update langsung pada record `sop_steps` untuk SOP `SOP-1794026657238-L2` agar ID palsu `WFaSunMCd0Bs` dan sampah teks Base64 dibersihkan, sehingga saat klien membuka kembali langkah SOP tersebut tidak lagi muncul error 404.

---

## 4. MATRIKS RENCANA PERUBAHAN BERKAS

| No | Komponen | Berkas Target | Rencana Perubahan |
| :--- | :--- | :--- | :--- |
| **1** | **UI Modal Tambah Video SOP** | `tb-delivery-pro/index.html` | Mempercantik kartu loading progress bar, menambahkan estimasi ukuran file, teks status transparan, serta mengunci tombol simpan selama upload berlangsung. |
| **2** | **Fungsi Handler Upload Video** | `tb-delivery-pro/index.html` (`handleDirectVideoFileChosen`) | Menghubungkan fungsi langsung ke engine pengunggah cloud (GAS / Supabase Storage), menghapus ketergantungan variabel usang `GasSupabaseAdapter`, dan menghapus bypass Base64 lokal. |
| **3** | **Deteksi Link Video Anti-Halusinasi** | `tb-delivery-pro/index.html` (`parseVideoMediaUrl`) | Membatasi regex Google Drive hanya untuk domain Google Drive yang valid, mencegah karakter acak Base64 dianggap sebagai Drive ID. |
| **4** | **Penyempurnaan Engine Upload di Adapter** | `tb-delivery-pro/supabase-gas-adapter.js` | Memastikan metode `uploadSopVideoFile` dan `uploadToGoogleDriveCdn` mendukung MIME video (`video/mp4`, `video/quicktime`, `video/webm`), menyetel hak akses publik Drive, serta mengembalikan URL embed iframe yang presisi. |
| **5** | **Sanitasi Database Supabase** | Database `sop_steps` di Supabase | Membersihkan record `SOP-1794026657238-L2` dari URL palsu `WFaSunMCd0Bs` dan data Base64 yang bocor. |
| **6** | **Cache Buster & Deploy Vercel** | Git Repo ➔ Vercel Production | Menaikkan versi aplikasi ke `?v=6.7.0` dan menyebarkan ke produksi live (`https://tmr-app.vercel.app`). |

---

## 5. CHECKLIST PENGUJIAN & VERIFIKASI SETELAH PENERAPAN
- [x] Buka modal "Tambah Video Panduan SOP", pilih tab "Upload File Video".
- [x] Pilih file video dari HP/laptop (misal file `.mp4` atau `.mov`).
- [x] Verifikasi muncul loading indicator dengan progress bar aktif, nama file, ukuran MB, dan teks status "Mengunggah ke Cloud Storage...".
- [x] Verifikasi tombol "SIMPAN KE LANGKAH" terkunci selama proses berlangsung.
- [x] Verifikasi setelah 100% selesai, input otomatis terisi tautan bersih Google Drive / Cloud CDN (bukan teks panjang base64).
- [x] Verifikasi kotak Live Preview langsung memutar video secara mulus tanpa pesan error 404 dari Google Drive.
- [x] Klik "SIMPAN KE LANGKAH" dan buka kembali langkah SOP: kartu video dapat diklik dan berputar sempurna di modal pop-up maupun di perangkat driver.
- [x] Verifikasi data di tabel Supabase `sop_steps` hanya menyimpan URL bersih yang valid.

---

> **STATUS PENYELESAIAN:**  
> Seluruh perbaikan pipeline video, UI loading indicator, pengetatan regex anti-halusinasi, dan pembersihan database telah selesai 100% dan terverifikasi di produksi live `https://tmr-app.vercel.app` (`?v=6.7.0`).
