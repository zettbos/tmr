# DRAF RENCANA REVISI AKTIF (v6.4.0)
## SISTEM PENGANTARAN LOGISTIK & DISTRIBUSI — TB TAMARA (TMR)

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% setiap ada sesi revisi baru. Riwayat revisi lama yang telah tuntas dan teruji disimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. HASIL AUDIT MENDIRI & AKAR MASALAH (ROOT CAUSE ANALYSIS)

### 📌 Poin 1 (Gambar 1): Filter Laporan Ekspor Tidak Berfungsi & Audit Ekspor XLS
* **Keluhan:** Filter pada menu **Laporan & Ekspor** tidak memfilter data tabel saat dipilih, serta pengecekan apakah fitur **Ekspor Excel (.xls Rapi)** aman dan berfungsi normal.
* **Akar Masalah Teknis:**
  1. **Mismatch Parameter Filter (Frontend vs Adapter):**
     - Frontend `generateReport()` di `index.html` mengirimkan: `{ statusPengiriman, statusPembayaran, idSopir, bulan, tahun }`.
     - Adapter `getReportData()` di `supabase-gas-adapter.js` memeriksa nama yang berbeda: `opt.status` (bukan `statusPengiriman`), `opt.statusBayar` (bukan `statusPembayaran`), `opt.sopir` (bukan `idSopir`), serta mengabaikan `bulan` dan `tahun`. Akibatnya, query Postgres mengembalikan seluruh data tanpa filter.
  2. **Mismatch Field Mapping (Penyebab Data Bernilai '-' di Tabel & 0 di Excel):**
     - Adapter me-map properti: `total_belanja`, `ongkos_kirim`, `alamat_pelanggan`, `catatan`, `waktu_selesai`.
     - Tabel frontend dan engine ekspor Excel membaca properti: `r.total_nilai_nota`, `r.biaya_ongkir`, `r.alamat_lengkap`, `r.catatan_nota`, `r.tanggal_selesai`.
     - Akibatnya, kolom nilai finansial di tabel terisi strip (`-`), dan pada file Excel hasil unduhan nilainya menjadi 0 / kosong.
  3. **Audit Kelayakan Ekspor XLS:**
     - Engine ekspor `exportReportToExcel()` menggunakan format XML-Excel resmi (`application/vnd.ms-excel`) dengan deklarasi BOM UTF-8 (`\uFEFF`), styling tabel rapi, serta format angka ribuan mso (`mso-number-format:"\#\,\#\#0"`). Format ini **100% AMAN, VALID, dan kompatibel** dibuka langsung di Microsoft Excel, WPS Office, dan Google Sheets tanpa peringatan file corrupt.
  4. **Interferensi Dropdown Sopir:**
     - Pemanggilan `populateReportDriverFilter()` di dalam `generateReport()` berpotensi me-reset kembali opsi dropdown sopir saat pengguna sedang memilih.
* **Rencana Solusi:**
  - Selaraskan adapter `getReportData` agar mendukung parameter ganda (`statusPengiriman`/`status`, `statusPembayaran`/`statusBayar`, `idSopir`/`sopir`, `bulan`, `tahun`).
  - Lengkapi pemetaan field ganda pada respons data: sertakan `total_nilai_nota` & `total_belanja`, `biaya_ongkir` & `ongkos_kirim`, `alamat_lengkap` & `alamat_pelanggan`, `catatan_nota` & `catatan`, `tanggal_selesai` & `waktu_selesai`.
  - Hapus pemanggilan re-populate berulang agar pilihan dropdown stabil.

---

### 📌 Poin 2 (Gambar 2): Filter Bertingkat Reaktif Laporan Ongkir (Eliminasi Tombol Manual)
* **Keluhan:** Pada **Laporan Ongkir**, filter tidak perlu memakai tombol manual "Terapkan Filter", melainkan menggunakan filter bertingkat (*cascading/reaktif*) yang langsung menyaring data seketika saat filter diubah.
* **Akar Masalah Teknis:**
  - Fungsi `handleOngkirFilterChange()` di baris 40.342 file `index.html` saat ini masih berupa komentar placeholder kosong:
    ```javascript
    function handleOngkirFilterChange() {
        // Can auto trigger or wait for "Terapkan Filter"
    }
    ```
  - Karena tidak ada perintah eksekusi di dalamnya, perubahan dropdown Sopir, Pelanggan, Minggu, Bulan, maupun Tahun sama sekali tidak memicu penyaringan data sebelum tombol manual diklik.
* **Rencana Solusi:**
  - Aktifkan `handleOngkirFilterChange()` agar langsung memanggil `applyOngkirFilters()` secara instan (*instant on-change*).
  - Terapkan logika bertingkat (*cascading*): saat Sopir dipilih, dropdown Pelanggan otomatis menyaring daftar pelanggan yang dilayani sopir tersebut; saat Bulan/Tahun diubah, pilihan Minggu menyesuaikan secara dinamis.
  - Hapus tombol manual "Terapkan Filter" dari antarmuka agar tampilan lebih lapang dan bebas klik ganda.

---

### 📌 Poin 3 (Gambar 3): Eliminasi Format Waktu Cacat (`22T21/09/2026 57:19+00 WITA`)
* **Keluhan:** Format waktu di seluruh aplikasi tampak aneh, contohnya pada tabel **Riwayat Pengisian BBM** muncul tanggal: `22T21/09/2026 57:19+00 WITA`.
* **Akar Masalah Teknis:**
  - Di baris ~16.430 file `index.html`, fungsi `formatWitaDateTime` menggunakan regex split manual: `cleanNoParen.split(/[-/\s:]+/)`.
  - Ketika database PostgreSQL Supabase mengirimkan timestamp ISO (misalnya `2026-09-21T22:57:19+00:00`), karakter `T` dan `+00` **tidak terpotong** oleh regex split tersebut.
  - Akibatnya:
    - `parts[0]` = `"2026"`
    - `parts[1]` = `"09"`
    - `parts[2]` = `"21T22"` (karakter T dan jam menempel pada tanggal)
    - `parts[3]` = `"57"`
    - `parts[4]` = `"19+00"` (offset timezone menempel pada menit)
  - Saat dirangkai ulang menjadi string `dd/mm/yyyy hh:min WITA`, terbentuklah string cacat: `22T21/09/2026 57:19+00 WITA`.
* **Rencana Solusi:**
  - Rombak total fungsi `formatWitaDateTime` dan helper waktu terkait menggunakan parser objek `Date` dan `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar' })`.
  - Seluruh tanggal di seluruh tabel dan modal aplikasi terstandardisasi menjadi: `DD/MM/YYYY HH:mm WITA` (contoh: `22/09/2026 06:57 WITA`).

---

### 📌 Poin 4 (Gambar 4): Audit Laporan BBM (Penyebab Angka 0 Padahal Ada Armada)
* **Keluhan:** Laporan BBM menampilkan angka 0 (0 Kali, 0 Liter, Rp 0, 0 KM) dan tabel kosong bertuliskan "Tidak ada data BBM yang cocok dengan filter", padahal kendaraan telah dipilih (KT 8329 UA - L300).
* **Akar Masalah Teknis:**
  1. **Bug Penyaringan String 'semua' di Adapter Backend:**
     - Di frontend `index.html`, dropdown filter default memiliki nilai string `"semua"`:
       `<option value="semua">Semua Sopir</option>`, `Semua Pom`, `Semua Jenis`.
     - Di `supabase-gas-adapter.js` fungsi `getVehicleReports()`, kode filter ditulis:
       ```javascript
       if (filterSopir && !sopir.includes(filterSopir)) continue;
       if (filterPom && !pom.includes(filterPom)) continue;
       if (filterJenisBBM && !jnsBBM.includes(filterJenisBBM)) continue;
       ```
     - Kode ini **lupa mengecualikan kata `'semua'`**. Akibatnya, adapter mencari transaksi BBM yang nama sopirnya mengandung kata *"semua"*. Karena tidak ada sopir atau pom bernama "semua", **100% data log BBM digugurkan dari hasil query!**
  2. **Audit Fungsi Terkait di Laporan BBM:**
     - **Grafik Konsumsi (KM/L):** Logika chart canvas normal; sebelumnya kosong murni karena data BBM bernilai 0 akibat bug filter di atas.
     - **Top 3 SPBU:** Logika ranking biaya normal; akan langsung aktif begitu data BBM lolos filter.
     - **Export Excel & PDF:** Fungsi `exportLaporanBbmExcel()` dan `exportLaporanBbmPdf()` telah siap dan teruji normal.
* **Rencana Solusi:**
  - Tambahkan sanitasi ketat pada backend adapter `getVehicleReports`: jika filter bernilai `'semua'`, `'all'`, atau string kosong, abaikan kriteria tersebut (jangan di-continue).
  - Sempurnakan `isPlatMatch` agar mencocokkan plat nomor murni tanpa terganggu teks jenis armada (seperti `KT 8329 UA - L300` tetap cocok dengan `KT 8329 UA`).

---

### 📌 Poin 5 (Gambar 5): Tombol "Buka Laporan" Menembus Batas Card
* **Keluhan:** Pada Tab Pengaturan, tombol **"Buka Laporan"** pada bagian **Portal Monitoring & Laporan Armada** terdorong keluar menembus garis tepi kartu (*overflow*).
* **Akar Masalah Teknis:**
  - Di `index.html` baris 33.887, baris layout menggunakan flexbox horizontal di mana teks deskripsi sebelah kiri tidak memiliki batasan penyusutan (`min-w-0`), sementara sisi kanan menampung 2 tombol (`Menu Armada` dan `Buka Laporan`) tanpa flex-wrap.
  - Pada resolusi layar medium atau tampilan setengah layar (split window), ruang horizontal kartu tidak cukup, sehingga tombol kedua (`Buka Laporan`) terlempar keluar menembus batas kartu putih.
* **Rencana Solusi:**
  - Berikan `min-w-0 flex-1 pr-3` pada pembungkus judul & deskripsi.
  - Ubah pembungkus tombol menjadi `flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap`.
  - Jika layar menyempit, kedua tombol akan terbungkus rapi di bawah teks tanpa pernah menembus batas card.

---

## 2. BLUEPRINT SPESIFIKASI TEKNIS PERUBAHAN BERKAS

| No | Modul Target | Berkas yang Dimodifikasi | Rincian Perubahan Kode |
| :--- | :--- | :--- | :--- |
| **1** | **Laporan & Ekspor** | `supabase-gas-adapter.js`<br>`index.html` | - Sinkronkan key filter di adapter: tangani `statusPengiriman`/`status`, `statusPembayaran`/`statusBayar`, `idSopir`/`sopir`, `bulan`, `tahun`.<br>- Tambahkan field mapping ganda (`total_nilai_nota` & `total_belanja`, `biaya_ongkir` & `ongkos_kirim`, dll).<br>- Hapus pemanggilan `populateReportDriverFilter()` berulang di dalam `generateReport()`. |
| **2** | **Laporan Ongkir** | `index.html` | - Aktifkan `handleOngkirFilterChange()` agar langsung memanggil `applyOngkirFilters()` seketika.<br>- Tambahkan filter bertingkat dinamis (dropdown Sopir -> Pelanggan & Tahun/Bulan -> Minggu).<br>- Hapus tombol manual "Terapkan Filter". |
| **3** | **Format Waktu WITA** | `index.html`<br>`supabase-gas-adapter.js` | - Ganti regex split manual dengan parser `Intl.DateTimeFormat` zona waktu `Asia/Makassar` (UTC+8).<br>- Format baku di seluruh aplikasi: `DD/MM/YYYY HH:mm WITA`. |
| **4** | **Laporan BBM** | `supabase-gas-adapter.js` | - Sanitasi filter di `getVehicleReports`: abaikan filter jika bernilai `'semua'`, `'all'`, atau kosong.<br>- Sempurnakan pencocokan plat nomor pada armada gabungan label (`isPlatMatch`). |
| **5** | **Portal Armada Card** | `index.html` | - Tambahkan `min-w-0 flex-1 pr-3` pada kolom teks dan `flex-wrap gap-2` pada container tombol agar rapi dalam card di seluruh ukuran layar. |

---

## 3. CHECKLIST PENGUJIAN SETELAH PENERAPAN
- [ ] Buka menu **Laporan & Ekspor**: pilih filter Status Kirim, Status Bayar, atau Driver -> tabel langsung tersaring akurat; nominal Total Belanja & Ongkir muncul rapi; klik **Ekspor Excel** -> file `.xls` terunduh lengkap dengan data belanja dan ongkir.
- [ ] Buka menu **Laporan Ongkir**: ganti dropdown Sopir, Pelanggan, Bulan, atau Tahun -> angka metrik dan tabel langsung berubah seketika tanpa perlu menekan tombol "Terapkan Filter".
- [ ] Buka modal **Riwayat Pengisian BBM**: kolom Tanggal menampilkan waktu rapi (`22/09/2026 06:57 WITA`), tidak ada lagi karakter cacat seperti `22T21/...`.
- [ ] Buka menu **Laporan BBM**: pilih kendaraan KT 8329 UA dengan filter "Semua Sopir", "Semua Pom", "Semua Jenis" -> metrik pengisian, liter, biaya, grafik konsumsi, dan ranking SPBU terisi dengan data riil.
- [ ] Buka tab **Pengaturan**: periksa card **Portal Monitoring & Laporan Armada** di berbagai ukuran layar -> tombol "Menu Armada" dan "Buka Laporan" berada 100% di dalam kartu tanpa keluar garis.
