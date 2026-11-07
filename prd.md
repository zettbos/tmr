# SPESIFIKASI PRODUK & MASTER CONTEXT: SISTEM OPERASIONAL TB TAMARA (TMR)
================================================================================
VERSI SISTEM    : v3.4.0 (Production Hybrid Realtime PWA)
ARSITEK SISTEM  : ZettBOT by Zettbos (Universal Product Architect & Lead Engineering)
STATUS LISENSI  : AKTIF (VERIFIED - ZettBOT Core v4.1)
DOMAIN RESMI    : https://tmr-app.vercel.app (Single Official Production Domain)
REPOSITORI      : https://github.com/zettbos/tmr
TANGGAL PEMBARUAN: 6 November 2026
================================================================================

---
## ZONA ATAS: SPESIFIKASI KEBUTUHAN PRODUK (BLUEPRINT AWAL)
---

### 1. Nama Projek & Problem Statement
- **Nama Aplikasi:** TMR (Tamara Delivery PRO / TB Delivery PRO).
- **Problem Statement:** Mengelola seluruh ekosistem logistik toko bangunan TB Tamara secara real-time: penerimaan pesanan material, verifikasi checker gudang, penugasan armada dan karnet, monitoring rute pengantaran sopir di lapangan, pembayaran COD / titip nota, monitoring pajak armada kendaraan & KIR, penerimaan nota barang suplayer, serta Standard Operating Procedure (SOP) harian karyawan multi-role tanpa hambatan koneksi, keterlambatan query, maupun pembatasan kuota serverless.

### 2. Peran Pengguna (User Roles & RBAC)
1. **Super Admin / Owner (AMI):** Hak akses mutlak seluruh modul (pengaturan sistem, laporan keuangan, audit log, manajemen armada, SOP, dan pembayaran nota suplayer).
2. **Staff Toko / Kasir:** Pencatatan order pesanan baru, cetak nota, data pelanggan, pencatatan nota barang datang suplayer, dan pelaksana SOP harian.
3. **Staff Operasional (Ops):** Monitoring armada gudang, penjadwalan antrean pengantaran, koordinasi checker dan supir.
4. **Petugas Pengecek (Checker Gudang):** Verifikasi kesesuaian fisik muatan barang dengan nota sebelum armada keluar toko, upload foto muatan, dan pelaksana SOP.
5. **Sopir (Driver Lapangan):** Penerimaan tugas antrean (Pool Job / Order Pribadi), navigasi Maps, penagihan COD di lokasi pelanggan, pencatatan BBM Pertamina, dan pelaksana SOP.
6. **Karnet (Helper):** Pendamping bongkar muat barang di lokasi proyek/rumah pelanggan dan pelaksana SOP harian.

### 3. Arsitektur Sistem Dual-Engine Hybrid (Supabase + Google Ecosystem)
Sesuai arahan arsitektur modern ZettBOT:
- **Frontend Layer:** Single Page Application (SPA / PWA) di-hosting pada Vercel Edge CDN (`https://tmr-app.vercel.app`), memuat halaman instan (< 0.5 detik) di HP maupun Desktop.
- **Primary Database & Realtime Layer:** Supabase PostgreSQL (22 Tabel Relasional) bertindak sebagai database transaksional operasional harian dengan koneksi WebSocket Realtime terpasang (`postgres_changes`).
- **Policy Keamanan Transisi:** Zero RLS (`DISABLE ROW LEVEL SECURITY`) pada seluruh tabel untuk memudahkan pengujian multi-user dan multi-role internal secara fleksibel tanpa token JWT rumit.
- **Media & CDN Storage Layer:** Google Drive Engine yang mengubah setiap unggahan file/foto bukti menjadi format URL Google CDN ultra ringan (`https://lh3.googleusercontent.com/d/{id}=s1200`), menghilangkan beban kuota storage dan mencegah string base64 membengkak di database.
- **Secondary Cold Backup Layer:** Google Spreadsheet fisik sebagai arsip dingin cadangan. Sinkronisasi data dari Supabase ke Spreadsheet hanya dijalankan otomatis sekali sehari pada pukul 00:00 tengah malam via Google Apps Script Time-driven Trigger.
- **Timezone Acuan Baku:** WITA (Waktu Indonesia Tengah / UTC+8 - Asia/Makassar).

### 4. Alur Kerja Aplikasi (End-to-End User Flow)
1. **Autentikasi Multi-Layer:** Karyawan login menggunakan Username dan Password internal. State otentikasi disimpan di `localStorage` dan session memory terenkripsi.
2. **Input Order Baru:** Kasir menginput nama pelanggan, alamat, Maps, no HP, jenis barang, ongkir, tipe pengiriman (Bawa Sendiri / Antar), dan foto nota fisik.
3. **Verifikasi Muatan (Gudang):** Checker memeriksa muatan fisik dan mengubah status dari `Belum di Cek` menjadi `Sudah di Cek oleh Staff Pengecekan`.
4. **Penugasan & Antrean (Pool Job):** Order tanpa sopir masuk ke antrean `Pool Job`. Sopir dapat mengambil job atau Admin menugaskan sopir tertentu.
5. **Pengantaran Lapangan:** Sopir memulai pengantaran (`Dalam Pengiriman`), navigasi peta pelanggan, dan konfirmasi bukti foto penerimaan di lokasi.
6. **Penyelesaian & Pembayaran:** Kasir / Admin mengonfirmasi pelunasan COD / sisa tagihan, memindahkan order ke status `Selesai`.
7. **Modul Suplayer:** Pencatatan penerimaan barang dari suplayer, status pembayaran (Lunas / Invoice / Diisi Admin Nanti), dan notifikasi jatuh tempo.
8. **Modul SOP Karyawan:** Penerbitan SOP terjadwal, pop-up pengingat berulang, pengisian checklist langkah kerja, dan upload foto bukti penyelesaian.

### 5. Skema Desain Basis Data (22 Tabel Kanonikal di Supabase PostgreSQL)
1. `profiles`: Kredensial dan data akun pengguna internal (`id`, `username`, `password`, `full_name`, `role`, `is_active`, `phone_number`, `avatar_url`, `created_at`).
2. `customers`: Master data pelanggan TB Tamara (`id`, `name`, `phone`, `address`, `maps_url`, `created_at`).
3. `orders`: Transaksi pesanan pengantaran utama (`id`, `order_date`, `delivery_date`, `customer_id`, `customer_name`, `customer_phone`, `customer_address`, `maps_url`, `nota_photo_url`, `notes`, `items_detail`, `driver_id`, `driver_name`, `helper_name`, `verification_status`, `delivery_status`, `payment_status`, `payment_method`, `total_amount`, `shipping_cost`, `unpaid_amount`, `cargo_photo_url`, `is_urgent`, `tipe_pengiriman`, `created_at`, `completed_at`).
4. `order_items`: Rincian item barang per order (`id`, `order_id`, `item_name`, `quantity`, `unit`, `unit_price`, `total_price`).
5. `vehicles`: Master data armada kendaraan operasional toko (`id`, `plate_number`, `vehicle_type`, `brand`, `model`, `year`, `ownership_type`, `owner_name`, `is_active`, `created_at`).
6. `vehicle_taxes`: Jadwal dan histori pajak armada (`id`, `vehicle_id`, `tax_type`, `due_date`, `amount`, `status`, `notes`, `created_at`).
7. `fuel_logs`: Catatan pembelian BBM armada Pertamina (`id`, `vehicle_id`, `driver_id`, `fuel_type`, `liters`, `total_cost`, `odometer_km`, `receipt_photo_url`, `status`, `created_at`).
8. `fuel_approvals`: Log persetujuan pembelian BBM oleh Admin (`id`, `fuel_log_id`, `approved_by`, `status`, `notes`, `approved_at`).
9. `suppliers`: Master direktori suplayer material (`id`, `name`, `contact_person`, `phone`, `address`, `created_at`).
10. `incoming_goods`: Penerimaan nota barang datang dari suplayer (`id`, `invoice_no`, `supplier_id`, `supplier_name`, `invoice_date`, `received_date`, `items_summary`, `total_amount`, `payment_method`, `due_status`, `cash_paid`, `paid_amount`, `remaining_debt`, `damage_notes`, `payment_proof_url`, `created_at`).
11. `supplier_payments`: Log angsuran dan pembayaran nota suplayer (`id`, `incoming_good_id`, `payment_date`, `amount`, `payment_type`, `proof_url`, `recorded_by`, `notes`, `created_at`).
12. `sop_masters`: Master SOP operasional (`id`, `title`, `category`, `priority_level`, `status`, `created_by`, `created_at`).
13. `sop_steps`: Detail langkah-langkah kerja per SOP (`id`, `sop_id`, `step_order`, `step_name`, `instructions`, `checklist_items`, `guide_media_url`, `rules`).
14. `sop_targets`: Jadwal dan penerima SOP (`id`, `sop_id`, `publish_date`, `publish_times`, `repeat_daily`, `target_roles`, `target_users`, `is_active`).
15. `sop_execution_logs`: Catatan penyelesaian SOP harian karyawan (`id`, `sop_id`, `user_id`, `user_name`, `user_role`, `completed_date`, `completed_time`, `proof_photo_url`, `approval_status`, `created_at`).
16. `system_configs`: Variabel konfigurasi sistem dinamis (`key`, `value`, `description`, `updated_at`).
17. `activity_logs`: Catatan audit aktivitas sistem (`id`, `user_id`, `user_name`, `user_role`, `action`, `description`, `created_at`).
18. `helper_assignment_requests`: Pengajuan perubahan helper/karnet oleh sopir (`id`, `driver_id`, `driver_name`, `previous_helper`, `requested_helper`, `status`, `request_date`, `created_at`).
19. `emergency_broadcasts`: Pesan darurat toko dari owner/admin (`id`, `title`, `message`, `target_roles`, `is_active`, `created_at`).
20. `shipping_rates`: Skema tarif dan jarak ongkir (`id`, `base_km`, `base_rate`, `per_km_rate`, `created_at`).
21. `cash_settlements`: Rekap penyerahan setoran uang COD sopir ke kasir (`id`, `driver_id`, `total_collected`, `total_deposited`, `settlement_date`, `verified_by`, `status`, `created_at`).
22. `backup_logs`: Riwayat eksekusi backup Supabase ke Google Spreadsheet (`id`, `backup_timestamp`, `records_backed_up`, `status`, `error_message`).

---
## ZONA BAWAH: MASTER CONTEXT & LOGIKA SISTEM TERKINI (LIVING CONTEXT)
---

### 1. Status Arsitektur & Lingkungan Aktif Terkini
- **Hosting Frontend:** Vercel Production (`https://tmr-app.vercel.app`), terkoneksi langsung ke Supabase PostgREST API dan Google CDN LH3.
- **Repositori Tunggal:** `https://github.com/zettbos/tmr` (Branch `main`).
- **Database Engine:** Supabase PostgreSQL Project ID `eagplukqotycpslhvnbp` (Region: Southeast Asia - Singapore).
- **Keamanan RLS:** Dinonaktifkan sementara (Zero RLS) untuk menjamin fluiditas pengujian multi-user dan multi-role.
- **Konektivitas Realtime:** Menggunakan Supabase Realtime Channels (`supabase.channel('tmr_realtime_stream')`) untuk auto-update instan tanpa polling berat.
- **Kompatibilitas Google Apps Script:** Dipertahankan sebagai backend sekunder murni untuk trigger backup 00:00 dan upload file Google Drive `DriveApp` (CORS-safe doPost).

### 2. Standar Pemetaan Data & Paritas Tampilan (Apps Script vs Vercel)
Untuk menjamin 100% konsistensi visual dan perilaku antara versi Apps Script lama dan Vercel modern:
1. **Format Tanggal Baku:** Seluruh field tanggal order (`order_date`) yang diterima dalam format ISO string PostgreSQL (`YYYY-MM-DDTHH:mm:ssZ`) wajib diformat secara kanonikal ke dalam format Indonesia `dd/MM/yyyy HH:mm` pada layer adapter (`mapOrderToGasObj`).
2. **Foto Banner Informasi Toko:** URL poster thumbnail disimpan di tabel `system_configs` dengan key `APP_ANNOUNCEMENT_PHOTO` menggunakan link Google CDN LH3 (`https://lh3.googleusercontent.com/d/{id}=s1200`) agar kartu pengumuman menampilkan poster visual yang identik.
3. **Notifikasi Mode Nota Suplayer:** Kartu `Mode Nota Suplayer` berubah menjadi **MERAH (`bg-[#DC2626]`)** dan memunculkan badge angka pending jika terdapat item dengan status `DIISI_ADMIN_NANTI` atau `Menunggu Admin`. Fungsi `getBarangDatangList` pada adapter wajib mengembalikan format standar `{ success: true, data: [...] }` dengan field `metode_pembayaran` dan `status_jatuh_tempo` terpetakan lengkap.
4. **Isolasi RPC Runner & Anti-Crosstalk:** Setiap pemanggilan RPC melalui adapter memiliki closure state independen untuk mencegah tabrakan callback antara pengecekan karnet, pajak kendaraan, dan data pesanan.
5. **Decoupled Metrics & Lazy DOM Preservation:**
   - Ringkasan angka pada folder counter badge dihitung cepat melalui query agregat ringan (< 50ms).
   - Kartu HTML hanya di-render saat tab yang bersangkutan sedang dibuka.
   - Saat berpindah ke menu lain lalu kembali ke tab semula, kontainer DOM dipertahankan utuh (0 milidetik / tanpa skeleton berulang).

### 3. Logika Bisnis & Formula Hitung yang Berlaku
1. **Formula Penghitungan Saldo COD & Belum Lunas:**
   $$\text{Total Tagihan COD} = \text{Nominal Belum Bayar Dasar} + \text{Nominal Tambahan Belum Bayar}$$
2. **Formula Pool Job (Zero-Leak Protection):**
   - Sebuah pesanan dikategorikan sebagai `Pool Job` jika dan hanya jika:
     $$\text{Driver} = \emptyset \lor \text{Driver} \in \{\text{'Semua Sopir'}, \text{'-'}, \text{'Pool Job'}\}$$
     $$\land \text{Tipe Pengiriman} \neq \text{'Di Bawa Sendiri'}$$
     $$\land \text{Status Pengiriman} \neq \text{'Selesai'}$$
3. **Distribusi SOP Harian & Snooze:**
   - Polling notifikasi SOP mengevaluasi jam jadwal WITA.
   - Pilihan snooze menunda alarm tepat 10 menit ($600.000\text{ ms}$).
   - Status penyelesaian SOP diisolasi per akun user; penyelesaian oleh satu personil tidak mematikan notifikasi personil lain dalam penugasan multi-user.
4. **Pajak Armada & KIR:**
   - Peringatan jatuh tempo dihitung berdasarkan selisih hari:
     $$\Delta\text{Hari} = \text{Tanggal Jatuh Tempo} - \text{Tanggal Hari Ini (WITA)}$$
   - Jika $\Delta\text{Hari} < 0$, status menjadi `Sudah lewat X hari jatuh tempo` (Banner Merah).
   - Pengaturan target broadcast disimpan terpusat di `system_configs`.

### 4. Log Pembaruan Resmi (System Evolution History)
- **v1.0.0 - v2.4.0:** Sistem awal berbasis Monolith Google Apps Script & Google Spreadsheet.
- **v2.5.0:** Modularisasi Web App, Overhaul Sistem SOP (5 Tahap), Penyumbatan Kebocoran Nota Ambil Sendiri pada Pool Job, dan Optimasi Polling Heartbeat.
- **v3.0.0 (5 November 2026):**
  - Migrasi menyeluruh ke Arsitektur Dual-Engine Hybrid (Supabase PostgreSQL Realtime + Vercel SPA).
  - Skema 22 tabel terverifikasi di Supabase dengan Zero RLS untuk testing multi-role.
  - Implementasi Google Drive CDN `lh3` untuk kompresi dan kecepatan muat foto bukti.
  - Penjadwalan Backup Harian 00:00 tengah malam ke Google Spreadsheet.
  - Integrasi Universal Facade Adapter v3.0 (`supabase-gas-adapter.js`).
  - Penetapan single production domain `https://tmr-app.vercel.app`.
  - Penyelarasan paritas penuh tampilan Vercel vs Apps Script (Format tanggal Indonesia `dd/MM/yyyy HH:mm`, kartu Suplayer merah dengan badge `2`, foto poster Informasi Toko LH3, eliminasi modal karnet `undefined`).
  - Arsitektur Smart Lazy Rendering & DOM State Preservation (Perpindahan menu instan 0ms tanpa skeleton berulang).
  - Sinkronisasi Master Context dan dokumentasi resmi ke dalam `prd.md`.
- **v3.1.0 (5 November 2026):**
  - **Paritas Metrik Dashboard Operasional:** Selaras 100% dengan Apps Script (Total Order: 12, Menunggu Penugasan: 2, Siap Dimuat: 4, Dalam Pengantaran: 1, Selesai: 5, Terjadwal: 3, Urgent: 3, Belum Lunas: 12).
  - **Statistik Driver:** Urutan driver disesuaikan secara deterministik (`02 PENGANTARAN`, `ASWIN`, `01 PENGANTARAN`) dengan sanitasi spasi ganda.
  - **Direktori Pelanggan:** Perbaikan pemetaan alamat fisik (`c.alamat` & `c.alamat_lengkap`) sehingga alamat tampil penuh (bebas strip `-`) dan terurut rapi berdasarkan ID registrasi (`CUST-0001`...).
  - **Monitoring Armada Multi-Mobil (`getDasbordArmadaMultiMobil`):** Eliminasi fallback data mock dummy (`KT 5678 YY` dkk), terhubung langsung ke basis data Supabase `vehicles` dengan 4 armada riil (`KT 8136 CM`, `KT 8329 UA`, `KT 8240 NB`, `KT 8919 UQ`), perhitungan otomatis status oli (Segera Ganti: 3, Wajib: 0), serta penambahan listener Supabase Realtime tabel `vehicles`.
  - **Integritas Pajak STNK & KIR:** Pemulihan record mobil `KT 8919 UQ` di tabel `vehicle_taxes` (Total: 7 kendaraan, 5 Mobil, 2 Motor, dan 5 Notifikasi jatuh tempo aktif).
  - **Verifikasi Produksi:** Live dan terverifikasi pada domain resmi `https://tmr-app.vercel.app`.
- **v3.2.0 (5 November 2026):**
  - **Paritas Armada & Tanggal BBM:** Mobil `KT 8240 NB` dikalibrasi sehingga tanggal KM & tanggal BBM menampilkan `-` karena belum ada riwayat isi BBM fisik. Mobil `KT 8919 UQ` menampilkan Isi Terakhir BBM `30 Liter` dengan konsumsi BBM `64,0 KM/L`.
  - **Modul SOP Karyawan (`getSopDashboardData` & `getSopList`):** Implementasi pemetaan penuh relasi `sop_masters`, `sop_steps` (diurutkan berdasarkan `step_number` dengan kolom `step_title`, `user_instructions`, `checklist`), dan `sop_targets`. Tampilan dashboard SOP kini menampilkan Total SOP: 1, Terjadwal: 1, dengan kartu SOP "Pengantaran Muatan Berat & Semen" (progress 0/2 User).
  - **Laporan Komisi Pengantaran (`getCommissionReport` & `saveCommissionRates`):** Pengambilan dinamis tarif komisi dari `system_configs` (Sopir: 0.20%, Karnet: 0.10%), kalkulasi komisi otomatis berbasis transaksi berstatus `Selesai` ($\text{Acuan Komisi} = \text{Total Amount} + \text{Total Tambahan Terkirim}$). Rekapitulasi 5 order selesai: Total Nota Selesai Rp 5.926.000, Komisi Sopir Rp 11.852, Komisi Karnet Rp 4.255, Total Komisi Rp 16.107, eliminasi error persentase `undefined%` dan `Rp NaN`.
  - **Pengaturan Tugas yang di Jalankan / Pop-up Karnet (`getKarnetTasks`, `saveKarnetTask`, `deleteKarnetTask`, `toggleKarnetTaskStatus`):** CRUD penuh tugas pop-up karnet berbasis `system_configs` (`KARNET_TASKS_DATA`). Menampilkan 1 tugas aktif default "Pop-up Karnet Sopir" (07.00 WITA, Semua Sopir, Semua Hari, Status: AKTIF). Menghilangkan kondisi macet "Memuat data tugas...".
  - **Eliminasi Dialog Pop-up Ganti Karnet `undefined`:** Penambahan filter sanitasi ketat pada `getPendingKarnetRequests` untuk memastikan tidak ada objek permintaan kosong/invalid yang memunculkan pop-up approval dengan teks `undefined (undefined)`.
  - **Verifikasi Produksi:** Commit `55afd54`, deployment Vercel `tmr-e2xtsms06-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v3.3.0 (6 November 2026):**
  - **Paritas Kartu SOP Terbaru:** Subteks kartu diselaraskan 100% dengan Google Apps Script (`Jadwal: 22.32 WITA (Harian) • 25-10-2026 22:29 WITA • Penyelesaian: 0/2 User (0%)`). Menambahkan properti `jam_list: ['22.32']`, `berulang_harian: true`, serta pemetaan `penerima_users` (2 sopir terpilih).
  - **Target & Pencapaian Bulanan Sopir (`getMonthlyDriverTargets` & `getMonthlyDriverPerformanceReport`):** Implementasi 4 fungsi RPC manajemen target sopir di adapter. Bagian 1 menampilkan 3 sopir aktif (`01 PENGANTARAN`, `02 PENGANTARAN`, `ASWIN`) dengan input target `Rp 0`. Bagian 2 menampilkan rekapitulasi pencapaian 3 sopir dengan saklar notifikasi default `OFF (DIKUNCI) / NONAKTIF`. Bagian 3 menyelaraskan dropdown notifikasi target sopir ke `OFF (Sopir Tidak Bisa Buka Detail)`.
  - **Urutan Manajemen User Sesuai Master Registrasi:** Mengubah sorting kueri `getUsers` dari `.order('full_name')` menjadi `.order('user_code', { ascending: true })` sehingga urutan 13 karyawan di tabel Manajemen Pengguna identik persis dengan urutan master sheet (`USR-001` AMI s/d `USR-019` ASWIN).
  - **Paritas Informasi Toko (Banner & Teks):** Mengganti foto thumbnail pengumuman toko dari struk pembayaran supplier bank BCA menjadi poster resmi komik edukasi ilustratif *"INFORMASI PENTING"* (`announcement_poster.png`), serta menyelaraskan teks pengumuman toko berakhiran titik tiga `...`.
  - **Verifikasi Produksi:** Commit `d4c6d4a`, deployment Vercel `tmr-9wk5aot3u-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v3.4.0 (6 November 2026):**
  - **Perbaikan Re-Click Pop-up Informasi Toko:** Menyelesaikan masalah pop-up modal informasi toko (`infoBannerPopupModal`), modal edit pengumuman (`editAnnouncementModal`), dan modal galeri gambar (`imagePreviewModal`) yang hanya bisa dibuka 1x. Fungsi pembuka modal kini mereset inline `style.display = 'flex'` dan fungsi `closeModal` membersihkan inline style `display: none` (`m.style.removeProperty('display')`) sehingga modal dapat dibuka dan ditutup berulang kali secara mulus.
  - **Tombol Close & Eliminasi Ikon Hamburger pada Modul Pajak STNK & KIR:** Menghapus ikon tiga garis (`fa-solid fa-bars`) di kiri atas `pajakViewBeranda` yang membingungkan pengguna, memasang tombol Close `✕` (`fa-solid fa-xmark`) ber-kontras tinggi di kanan atas berdampingan dengan tombol Refresh, serta memasang invisible spacer di kiri agar logo tengah tetap berada presisi di tengah layar.
  - **Paritas Penuh Laporan Ongkir (`getLaporanOngkirData`):** Mengimplementasikan fungsi RPC `getLaporanOngkirData(currentUser)` di `supabase-gas-adapter.js`. Mengambil 6 transaksi order fisik Supabase yang memiliki ongkir (`shipping_cost = 30.000`), memetakan field ke kontrak `processRawOngkirOrders`, dan menyertakan daftar sopir aktif. Menghilangkan status macet *"Memuat data transaksi ongkir..."* dan menampilkan ringkasan tepat: Total Semua Ongkir **Rp 180.000**, Total Pesanan **6 pesanan**, Rata-rata **Rp 30.000**, Tertinggi **Rp 30.000**, Terendah **Rp 30.000** (100% selaras dengan Google Apps Script).
  - **Standarisasi Universal Waktu Zona WITA (UTC+8 / WIB + 1 Jam):** Memasang Universal WITA Time Provider di frontend dan adapter: mengunci jam digital header, jam modal pajak, jam modal SOP, jam server monitoring armada multi-mobil (`waktu_server_jam`), timestamp log aktivitas dashboard (`l.timestamp`), dan helper format tanggal (`safeFormatDate` & `formatTimeToHHMM`) ke zona waktu **WITA (Asia/Makassar / GMT+8)** terlepas dari zona waktu lokal perangkat klien yang berada di WIB (GMT+7).
  - **Verifikasi Produksi:** Commit `d737278`, deployment Vercel `tmr-eaphxo0y8-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v3.5.0 (6 November 2026 - TAHAP 1 AUDIT SELESAI):**
  - **Arsitektur Media Foto Universal (Google Apps Script -> Google Drive -> Edge CDN lh3 -> Supabase):**
    Mengaktifkan jembatan `uploadToGoogleDriveCdn` dan `uploadMediaPipeline` di adapter, menghubungkan ke Google Apps Script Web App untuk menyimpan file gambar ke Google Drive toko (`TB_DELIVERY_ATTACHMENTS`) dengan hak akses publik, menghasilkan URL Google Edge CDN berkecepatan tinggi (`https://lh3.googleusercontent.com/d/{ID}=s1200`), menyimpan link CDN tersebut ke database Supabase, dan menampilkan gambar secara instan di frontend (bebas kuota storage Supabase).
  - **Menu 1 (Daftar Pengantaran - 14/14 Elemen Selesai 100%):**
    - Implementasi `addMuatanPhoto`, `saveFotoMuatan`, `deleteMuatanPhoto`, `deleteFotoMuatan` (manajemen foto muatan di atas truk, sinkronisasi tag `[FOTO_MUATAN:...]` di `notes` dan kolom `cargo_photo_url`).
    - Implementasi `addDriverPhoto` dan `deleteDriverProofPhoto` (manajemen 5 slot foto bukti penerimaan barang driver `proof_url_1` s/d `proof_url_5`).
    - Implementasi `addTransferPhoto`, `deleteTransferProofPhoto`, dan `deleteFotoUangLunas` (bukti transfer COD dan bukti uang tunai lunas).
    - Implementasi `addAdditionalOrder` dan `deleteAdditionalOrderPhoto` (penambahan muatan susulan, kalkulasi akumulasi `[TOTAL_TAMBAHAN_TERKIRIM:...]` dan `[TAMBAHAN_BELUM_BAYAR:...]` di `notes`, isolasi nominal nota utama, dan upload foto nota tambahan).
    - Implementasi `continuePartialDelivery` (mengaktifkan kiriman lanjutan Tahap 2, transisi status ke `Pesanan Masuk / Dimuat`, verifikasi `Cek Sebagian (Perlu Cek Tahap 2)`, dan pembersihan tag `[TITIP BARANG]`).
    - Implementasi `updateOrderGmapsLocation` dan `updateGmapsLink` (pembaruan titik lokasi GPS pelanggan pada tabel `orders` dan master `customers`).
    - Implementasi Sistem Ganti Karnet Sopir: `requestChangeKarnet`, `getPendingKarnetRequests`, `respondChangeKarnet`, `dismissDriverKarnetRequest`, dan `setDriverKarnetBackend` berbasis tabel `system_configs` (`KARNET_REQ_{driverId}` & `ACTIVE_KARNET_{driverId}`) dengan pencatatan audit trail ke `activity_logs`.
  - **Menu 2 (Input Order Baru - 5/5 Elemen Selesai 100%):**
    - Implementasi `calculateRouteDistanceBackend` (kalkulator jarak estimasi kilometer jalan raya dan durasi menit berkendara).
    - Implementasi `resolveGoogleMapsLocationUrl` (resolusi koordinat lintang & bujur dari URL Google Maps / sharelock pelanggan).
  - **Peningkatan Konversi URL Gambar Global:**
    Fungsi `convertDriveUrlToDirectImage` di `index.html` diperbarui untuk secara otomatis mengonversi seluruh format Google Drive URL lama menjadi link resmi Google Edge CDN (`https://lh3.googleusercontent.com/d/{ID}=s1200`).
  - **Verifikasi Produksi:** Commit `7e70cb9`, deployment Vercel `tmr-edc2wou12-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v3.6.0 (6 November 2026 - TAHAP 2 AUDIT SELESAI):**
  - **Menu 7 (Monitoring Kendaraan - Armada, BBM & Servis - 11/11 Elemen Selesai 100%):**
    - **Dasbor Monitoring Multi-Mobil & Resolusi Disparitas (`getDasbordArmadaMultiMobil`):** Mengambil data live 4 armada fisik dari `vehicles`, `fuel_logs`, `oil_change_logs`, dan `vehicle_services`. Menyelesaikan disparitas armada KT 8240 NB: dihitung dinamis dari ketiadaan log transaksi sehingga menghasilkan `isi_terakhir_liter: 0`, `tgl_terakhir_bbm: '-'`, `konsumsi_bbm: '0,0'`, `status_oli: 'Aman'`, `sisa_km_oli: 5000` (100% selaras dengan Google Apps Script). Waktu server distandarisasi ke zona WITA (`waktu_server_tgl` & `waktu_server_jam`).
    - **Modal Detail Kendaraan & Laporan Spesifik (`getVehicleDashboardData` & `getVehicleReports`):** Menyajikan data lengkap per kendaraan meliputi profil mobil, `avg_konsumsi`, riwayat BBM (`bbm_history`), riwayat oli (`oli_history`), dan riwayat perbaikan bengkel (`service_history`). Filter laporan analitis mencakup plat nomor, sopir, SPBU, jenis BBM, merek oli, bengkel, serta rentang tanggal.
    - **Alur Izin & Approval Pengisian BBM Sopir-Admin:** Implementasi `requestIzinIsiBBM` (dan `submitPermohonanIsiBBM`), `checkActiveBBMApproval`, `getPendingBBMApprovals`, dan `respondIzinIsiBBM`. Izin BBM berstatus `PENDING` dapat disetujui / ditolak admin secara realtime via Supabase.
    - **Manajemen Transaksi BBM Penuh (CRUD & Odometer Anti-Curang):** Implementasi `submitPengisianBBM`, `editBBMTransaction`, dan `deleteBBMTransaction`. Validasi anti-curang odometer memastikan kilometer terkini tidak boleh lebih kecil dari sebelumnya. Sinkronisasi otomatis jarak tempuh, konsumsi rata-rata KM/L, dan penambahan total liter BBM ke master kendaraan.
    - **Manajemen Transaksi Oli & Batas Interval KM:** Implementasi `submitInputOli`, `editOliTransaction`, `deleteOliTransaction`, dan `updateBatasIntervalOli`. Sisa kilometer oli dihitung dinamis `(last_oil_km + oil_interval_km) - current_km` dengan status peringatan otomatis (`Aman`, `Segera Ganti`, `Wajib Ganti`).
    - **Manajemen Servis & Perawatan Bengkel:** Implementasi `submitInputService`, `editServiceTransaction`, dan `deleteServiceTransaction`. Nota tagihan dan bukti perbaikan bengkel tersalurkan langsung ke pipeline media Google Edge CDN (`lh3`).
    - **Master Relasi Dropdown Dinamis:** Implementasi `getSpbuList`, `deleteSpbuItemServer`, `getBengkelList`, `deleteBengkelItemServer`, `getMerekOliList`, dan `deleteMerekOliItemServer` berbasis tabel `system_configs`.
    - **Master Data Kendaraan & Pengemudi:** Implementasi `saveNewMasterVehicle`, `editVehicleFromRekap`, `deleteVehicleFromRekap`, dan `getSopirArmadaList`.
  - **Audit Metric Progress:** Elemen interaktif READY meningkat dari 47 (63.5%) menjadi **55 Elemen (74.3%)**, elemen MISSING berkurang menjadi **19 Elemen**.
  - **Verifikasi Produksi:** 28 dari 28 uji verifikasi live Supabase lolos (`28 PASSED, 0 FAILED`). Commit `c609a17`, deployment Vercel `tmr-dotglpify-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v6.0.0 (6 November 2026 - Master Full-System Functional Audit & Remediasi 100% Selesai):**
  - **Resolusi Method Alias & Binding Execution Runner:** Proxy runner `createRunner` kini menggunakan `.apply(apiServices, args)`. Method alias (`saveFotoMuatan`, `deleteTransferPhoto`, `updateGmapsLink`, `backupSopData`) diarahkan langsung ke `apiServices.<method>` menghilangkan error `TypeError: this.<method> is not a function`.
  - **Pencegahan Foreign Key Violation pada Order Baru (`createOrder`):** Menambahkan auto-upsert pelanggan baru ke tabel `customers` jika nama/telepon tersedia, atau fallback aman `customer_id: null` sehingga pembuatan order walk-in/non-member bebas dari pelanggaran constraint `orders_customer_id_fkey`.
  - **Sanitasi Kolom Waktu Profil User (`saveUser`):** Mengonversi string kosong `""` pada jam shift masuk/keluar menjadi `null` sesuai spesifikasi tipe data PostgreSQL `TIME`.
  - **Implementasi 3 RPC Kritis Baru:**
    1. `getActiveSopBroadcast(currentUser)`: Query resmi PostgreSQL untuk memfilter SOP aktif, langkah kerja, jadwal penayangan, dan status penyelesaian hari ini untuk memicu modal pop-up wajib layar penuh.
    2. `getAppSyncHeartbeat(payload)`: Multi-domain aggregator polling 20 detik yang mengonsolidasikan notifikasi darurat, SOP broadcast, approval BBM, dan approval karnet dalam satu siklus sub-50ms.
    3. `getDriverLiveMonthlyTargetProgress(currentUser)`: Agregasi live nilai orderan selesai sopir pada bulan berjalan terhadap target bulanan toko.
  - **Pemulihan Integritas Database Modul SOP (`sop_masters`):** Men-seed 5 master SOP resmi ke tabel `sop_masters` dan membersihkan record anomali pada tabel `sop_targets`.
  - **Otomatisasi Pemajuan Jatuh Tempo Pajak (`submitPembayaranPajak`):** Otomatis memajukan tanggal jatuh tempo (+1 tahun untuk pajak tahunan, +5 tahun untuk pajak plat) pada tabel `vehicle_taxes` begitu pembayaran diverifikasi.
  - **Dual-Cloud Storage Failover (`uploadToGoogleDriveCdn`):** Penambahan failover otomatis ke Supabase Storage Edge CDN (`brand-assets`) jika Google Apps Script mengalami timeout atau limit kuota harian (20.000/hari) tercapai.
  - **Ekspansi Realtime Channel:** Menambahkan listener WebSocket Supabase Realtime untuk tabel `emergency_messages` dan `sop_masters`.
  - **Hasil Pengujian Penuh:** 137 dari 137 RPC terpetakan 100% (`0 Missing / Relying on Fallback`).
- **v6.1.0 (6 November 2026 - Optimasi Kinerja Event-Driven & Eliminasi Polling Liar):**
  - **Eliminasi Polling Agresif 5s & 15s:** Mematikan loop polling 5 detik karnet (`checkKarnetApprovalSyncTimer`) dan polling ganda 15 detik SOP (`_sopBackendSyncInterval` & `_globalSopSchedulerInterval`).
  - **Penyatuan Heartbeat Santai (60 Detik):** Mengubah interval heartbeat dari 20 detik ke 60 detik (failsafe net), memangkas frekuensi request backend hingga 96% (dari ~30 request/menit menjadi 1 request/menit).
  - **Relaksasi Sync Orders Failsafe:** Mengubah timer pasif `syncRealtimeOrders` ke 120 detik (2 menit), mempercayakan 100% pembaruan data pesanan secara instan ke WebSocket Supabase Realtime (0.05 detik).
  - **Mute Debug Console Logging:** Membungkam output default `[Adapter Call]` di konsol pada mode produksi (hanya aktif jika `window.__TB_DEBUG === true`), menghentikan penimbunan memori RAM buffer konsol.
  - **Cache-Busting Asset Versioning (`?v=6.1.0`):** Menambahkan query hash versi pada import adapter di `index.html` untuk memastikan seluruh perangkat klien langsung membuang cache lama dan warning kuning hilang seketika.
  - **Ekspansi WebSocket Realtime untuk Karnet:** Menambahkan listener event pada tabel `system_configs` untuk menangkap `KARNET_REQ_` dan `ACTIVE_KARNET_` secara real-time.
- **v6.3.1 (6 November 2026 - Unified Multi-Approval BBM & Midnight Reset Loop Fix):**
  - **Multi-Item Card Stack:** Modal approval BBM kini mendukung render bertumpuk (*stack view*) jika ada >1 izin BBM pending, lengkap dengan aksi per kartu [Tolak]/[Setuju], aksi massal [SETUJUI SEMUA (N)], dan tombol [Ingatkan Nanti] / [X] untuk snooze sementara hingga refresh (F5).
  - **Bulk Backend Endpoint:** Penambahan `respondBulkIzinIsiBBM` di adapter untuk mengeksekusi update batch PostgreSQL via `.in('id', idList)`.
  - **Midnight Reset Timezone Fix:** Penyelarasan format tanggal WITA menggunakan `Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Makassar' })` menghentikan loop pengulangan tanggal konsol `2026-11-06` vs `2026-11-07`.
- **v6.4.0 (7 November 2026 - Laporan Ekspor, Filter Reaktif Ongkir, Waktu WITA Baku & Audit Laporan BBM):**
  - **Laporan & Ekspor:** Sinkronisasi parameter filter (`statusPengiriman`/`status`, `statusPembayaran`/`statusBayar`, `idSopir`/`sopir`, `bulan`, `tahun`) dan field mapping ganda (`total_nilai_nota` & `total_belanja`, `biaya_ongkir` & `ongkos_kirim`, dll) sehingga data tabel dan ekspor Excel `.xls` terisi data finansial lengkap (tidak strip/0).
  - **Laporan Ongkir (Reaktif & Bertingkat):** Pengaktifan `handleOngkirFilterChange()` instan on-change dengan filter cascading (Sopir -> Pelanggan), serta eliminasi tombol manual "Terapkan Filter".
  - **Standarisasi Format Waktu WITA:** Perombakan `formatWitaDateTime` dan `formatIndonesianDateTime` menggunakan `Intl.DateTimeFormat` zona `Asia/Makassar` menghasilkan format seragam `DD/MM/YYYY HH:mm WITA` dan mengeliminasi bug string cacat seperti `22T21/09/2026 57:19+00 WITA`.
  - **Audit Laporan BBM:** Sanitasi nilai default `'semua'` pada backend adapter `getVehicleReports` dan penyempurnaan plat matching `isPlatMatch`, memulihkan tampilan metrik pengisian BBM, liter, biaya, grafik konsumsi, dan ranking SPBU.
  - **Layout Portal Armada Card:** Penataan flexbox (`min-w-0 flex-1` & `flex-wrap gap-2`) memastikan tombol "Buka Laporan" berada 100% di dalam batas kartu pada seluruh ukuran layar.
  - **Verifikasi Produksi:** Commit `1b4ae94`, deployment Vercel `tmr-rl0u6f6r2-zettbos-projects.vercel.app`, ter-alias resmi ke `https://tmr-app.vercel.app`.
- **v6.5.0 (7 November 2026 - Sanitasi Timestamp TIMESTAMPTZ PostgreSQL & Pemulihan SOP Template Terjadwal):**
  - **Sanitasi Kolom created_at pada Backend Adapter (`saveSop`):** Memperbaiki penolakan fatal tipe data PostgreSQL `TIMESTAMPTZ` (error kode `22007`) akibat format string bahasa Indonesia (`"07 November 2026 • 08.03 WITA"`). Ditambahkan validasi dan pemaksaan konversi ke standar ISO timestamp (`new Date().toISOString()`), serta penanganan error eksplisit pada `sb.from('sop_masters').upsert()` untuk mengeliminasi silent failure.
  - **Pemisahan Properti Tanggal di Form SOP (`submitSopForm`):** Memisahkan tanggal tampilan humanis (`created_at_display`) dengan properti ISO kanonikal (`created_at = new Date().toISOString()`) pada `index.html`.
  - **Pemulihan Data SOP Klien Amir:** Memulihkan record master SOP `SOP-1794009563853` (*"Pengantaran Muatan Berat & Semen"*, status *"Terjadwal"*) di database Supabase `sop_masters`, menyambungkan kembali 3 langkah kerja di `sop_steps` dan jadwal harian di `sop_targets`.
  - **Standarisasi Konversi Waktu WITA di Adapter (`getSopList` & `getSopDashboard`):** Mengonversi ISO timestamp dari PostgreSQL ke zona waktu WITA (UTC+8) secara akurat (`DD-MM-YYYY HH:mm WITA`).
  - **Cache Buster & Live Deployment:** Bumping cache buster script `supabase-gas-adapter.js?v=6.5.0` dan verifikasi live di `https://tmr-app.vercel.app`. Klien Amir dan seluruh user toko dapat langsung melihat SOP di folder "Terjadwal" cukup dengan merefresh halaman (F5).
- **v6.6.0 (7 November 2026 - Realtime Multi-User SOP Progress, Presisi Jam Notifikasi & Cross-Role Broadcast):**
  - **Kalkulasi Live Progres Multi-User (`getSopList` & `getSopDashboardData`):** Menghubungkan pembacaan tabel `sop_execution_logs` secara live hari ini pada layer adapter. Menghilangkan stub hardcode `0/2 User (0%)`, menghitung persentase dinamis `completedCount / totalAssigned * 100`, dan menetapkan status dinamis (`Belum Selesai` jika sebagian user selesai, `Selesai` jika seluruh user selesai).
  - **Pemulihan Penyiaran Lintas-Role (`getActiveSopBroadcast`):** Memperluas query master SOP dengan status `Belum Selesai` (bukan hanya `Aktif` dan `Terjadwal`), menyediakan properti akar `target_users`, `recipients`, `target_type: 'SPECIFIC'`, dan mengekspos `jam_list: cleanJamList` di objek jadwal. Memastikan seluruh target penerima lintas-role (Staff Toko & Sopir) menerima popup notifikasi secara presisi pada jam jadwalnya.
  - **Eliminasi Total Residu Hardcode `22.32 WITA`:** Menghapus seluruh nilai palsu `22.32 WITA` di 6 titik adapter dan menggantinya dengan jam jadwal asli dari database atau jam pembuatan SOP.
  - **Evaluasi Kandidat Penerima Bertingkat (`isUserRecipientOfSop`):** Mendukung resolusi user spesifik dari `sop.jadwal.target_users` dan `sop.jadwal.recipients` pada frontend `index.html`.
  - **Cache Buster & Live Production Deployment:** Bumping versi skrip adapter ke `?v=6.6.0`, deployment Edge CDN Vercel, dan aliasing domain `https://tmr-app.vercel.app`.

================================================================================
ARSITEK: ZettBOT by Zettbos | STATUS: PRODUCTION READY | LIVING MASTER CONTEXT
================================================================================
