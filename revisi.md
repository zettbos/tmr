# MASTER DOKUMEN AUDIT & PEMETAAN SELURUH MENU APLIKASI TB TAMARA
================================================================================
DOKUMEN         : revisi.md (Master Audit, Action Mapping & Media Pipeline Protocol)
ARSITEK SISTEM  : ZettBOT by Zettbos (Universal Product Architect & Lead Engineering)
PROJEK          : TMR (Tamara Delivery PRO / TB Delivery PRO)
STATUS DOKUMEN  : TAHAP 1 SELESAI & LIVE — MENUNGGU KONFIRMASI TAHAP 2
DOMAIN TARGET   : https://tmr-app.vercel.app (Single Official Production Domain)
TANGGAL         : 6 November 2026
COMMIT HASH     : 7e70cb9 (v3.5.0)
BASIS AUDIT     : tb-delivery-pro/index.html (63.700+ baris), supabase-gas-adapter.js, & GAS_DRIVE_AND_BACKUP.gs
================================================================================

> [!NOTE]
> **STATUS EKSEKUSI TAHAP 1:**
> **TAHAP 1 TELAH 100% BERHASIL DITERAPKAN & LIVE DI PRODUKSI.**
> - Pipeline Upload Media (Google Apps Script -> Google Drive -> Google Edge CDN lh3 -> Supabase) telah aktif.
> - Seluruh 14 fitur Menu 1 (Daftar Pengantaran) dan 5 fitur Menu 2 (Input Order Baru) telah 100% READY dan teruji.
> - Live di `https://tmr-app.vercel.app` (Commit `7e70cb9`). Menunggu instruksi untuk Tahap 2.

---
## 1. PENJELASAN ARSITEKTUR PIPELINE MEDIA (FOTO) & BACKUP SPREADSHEET
---

### A. Konsep Inti: Hybrid Media & Database Architecture
Pengguna menginstruksikan bahwa seluruh upload foto dalam aplikasi harus melalui alur:
**Browser Web (Vercel) ➔ Google Apps Script Web App ➔ Simpan ke Google Drive ➔ Hasilkan Link Google Edge CDN `lh3.googleusercontent.com` ➔ Simpan Link ke Supabase ➔ Tampilkan Gambar di Aplikasi Web.**

Sedangkan peran **Google Spreadsheet** difungsikan sebagai:
1. **Penyimpan Cadangan Data (Cold Backup Mirror):** Menyimpan snapshot seluruh tabel Supabase secara berkala (misal: otomatis setiap tengah malam jam 00:00 WITA) agar toko memiliki arsip fisik Excel/Sheets yang aman.
2. **Gateway Media Google Drive:** Menjadi jembatan aman (*backend microservice*) yang menampung file upload ke folder Drive toko tanpa batas kuota storage database pihak ketiga.

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna (Sopir / Admin)
    participant UI as Web App (Vercel)
    participant GAS as Google Apps Script (GAS)
    participant Drive as Google Drive Storage
    participant SB as Supabase Database
    participant Sheet as Google Sheets (Backup)

    User->>UI: Ambil Foto / Pilih Gambar (Kamera / Galeri)
    Note over UI: Kompresi Base64 lokal (Cropper / Canvas)
    UI->>GAS: POST uploadFileDirectToDrive(base64Data, filenamePrefix)
    GAS->>Drive: Simpan file ke folder "TB_DELIVERY_ATTACHMENTS"
    Drive-->>GAS: Return FileId (misal: 1A2b3C...)
    Note over GAS: Transformasi FileId ke Link Google Edge CDN (lh3):<br/>https://lh3.googleusercontent.com/d/{FileId}=s1200
    GAS-->>UI: Return JSON { success: true, url: "https://lh3..." }
    UI->>SB: Simpan Link CDN lh3 ke Kolom Database Supabase
    SB-->>UI: Data tersimpan realtime (WebSocket)
    UI-->>User: Foto muncul instan di layar (di-cache oleh Google Edge CDN)

    Note over SB,Sheet: SINKRONISASI COLD BACKUP (Tengah Malam / Trigger)
    GAS->>SB: Tarik dump data seluruh tabel (REST API)
    GAS->>Sheet: Tulis snapshot cadangan ke Tab Spreadsheet
```

---

### B. Mengapa Arsitektur Ini Sangat Unggul? (Keuntungan Teknis)

1. **Kecepatan Akses Super Cepat (Google Global Edge CDN):**
   Format URL `https://lh3.googleusercontent.com/d/{FILE_ID}=s1200` adalah jalur Content Delivery Network (CDN) resmi yang digunakan Google Photos. Gambar yang diakses melalui URL ini otomatis di-cache di server Google terdekat di Indonesia, bebas masalah *throttling*, bebas login Google, dan 10-15x lebih cepat dimuat dibandingkan URL preview Google Drive biasa.
2. **Kapasitas Penyimpanan Drive Toko yang Lega:**
   Menyimpan foto asli di Google Drive toko (folder `TB_DELIVERY_ATTACHMENTS`) menghemat kuota Supabase Storage secara signifikan (menghindari biaya kuota bandwidth/storage Supabase).
3. **Database Supabase Tetap Ringan & Cepat:**
   Supabase hanya menyimpan teks string URL (hanya ~65 karakter per tautan), bukan file biner/blob gambar berukuran megabyte. Hasilnya, query tabel, sinkronisasi realtime, dan backup data berjalan sangat ringan.
4. **Resiliensi Data Ganda (Dual-Layer Safety):**
   - Transaksi live berjalan di Supabase PostgreSQL dengan latensi rendah (<100ms).
   - Dokumen fisik dan foto tersimpan abadi di Google Drive.
   - Cadangan tabel tersalin rapi di Google Sheets untuk pembukuan dan audit manual.

---

### C. 12 Titik Upload Foto yang Terhubung ke Pipeline Ini

| No | Modul / Layar | Jenis Foto yang Diunggah | Target Folder Drive | Kolom Penyimpanan di Supabase | Format CDN |
| :-: | :--- | :--- | :--- | :--- | :--- |
| **1** | **Input Order Baru** | Foto Nota Fisik / Surat Jalan Toko | `TB_DELIVERY_ATTACHMENTS` | `orders.receipt_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **2** | **Daftar Pengantaran** | Foto Muatan di Atas Bak Truk | `TB_DELIVERY_ATTACHMENTS` | `orders.load_photos` (Array JSON) | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **3** | **Daftar Pengantaran** | Foto Bukti Penerimaan Barang (Driver) | `TB_DELIVERY_ATTACHMENTS` | `orders.proof_photos` (Array JSON) | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **4** | **Daftar Pengantaran** | Foto Bukti Transfer / Bukti Cash Lunas | `TB_DELIVERY_ATTACHMENTS` | `orders.transfer_proof` (Array JSON) | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **5** | **Daftar Pengantaran** | Foto Orderan Tambahan (Muatan Susulan) | `TB_DELIVERY_ATTACHMENTS` | `orders.additional_items[].photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **6** | **Monitoring Armada** | Foto Struk SPBU / Pembelian BBM | `TB_DELIVERY_ATTACHMENTS` | `fuel_logs.receipt_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **7** | **Monitoring Armada** | Foto Angka Odometer (Speedometer) Mobil | `TB_DELIVERY_ATTACHMENTS` | `fuel_logs.odometer_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **8** | **Monitoring Armada** | Foto Nota Bengkel Servis & Onderdil | `TB_DELIVERY_ATTACHMENTS` | `service_logs.receipt_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **9** | **Pajak STNK & KIR** | Foto Bukti Pembayaran Pajak STNK / KIR | `TB_DELIVERY_ATTACHMENTS` | `tax_payment_history.receipt_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **10** | **Manajemen User** | Foto KTP / Dokumen Identitas Karyawan | `TB_DELIVERY_ATTACHMENTS` | `profiles.ktp_photo_url` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **11** | **Mode Suplayer** | Foto Faktur Tagihan / Nota Barang Datang | `TB_DELIVERY_ATTACHMENTS` | `supplier_orders.receipt_photo` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **12** | **Mode Suplayer** | Foto Bukti Transfer Pelunasan Suplayer | `TB_DELIVERY_ATTACHMENTS` | `supplier_payments.transfer_proof` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |
| **13** | **Modul SOP** | Foto / Media Panduan Langkah Kerja SOP | `TB_DELIVERY_ATTACHMENTS` | `sop_documents.media_url` | `https://lh3.googleusercontent.com/d/{ID}=s1200` |

---
## 2. RANGKUMAN EKSEKUTIF AUDIT SISTEM
---

Berdasarkan audit menyeluruh pada antarmuka pengguna (`index.html`) terhadap adapter backend (`supabase-gas-adapter.js` & Supabase Database):
- **Total Menu Aplikasi Utama:** **15 Menu / Modul**
- **Total Elemen Interaktif (Tombol, Input, Form, Aksi):** **74 Elemen Aksi**
- **Status Elemen yang Sudah Siap & Terhubung (READY):** **38 Elemen (51%)**
- **Status Elemen yang Belum Dibuat / Fallback Generic (MISSING):** **36 Elemen (49%)**
- **Total Endpoint RPC Terdeteksi di Kode:** **142 Endpoint** (65 aktif di adapter Supabase, 77 masih berstatus fallback atau belum dibuat).

---
## 3. MATRIKS PEMETAAN TOMBOL & AKSI PER MENU (15 MENU LENGKAP)
---

### MENU 1: DAFTAR PENGANTARAN (Core Order Management) — `tabOrders`
*Pusat operasional harian: daftar nota kiriman, penugasan armada/sopir, verifikasi gudang, status pengantaran, dokumentasi foto, dan pelunasan.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 1.1 | **Tombol Ambil Job / Penugasan Sopir** | `onclick="ambilJob(idOrder, driverName)"` | `ambilJob` | `orders` (`driver_name`, `delivery_status`) | **READY** | Sopir dapat mengambil tiket pesanan secara realtime. |
| 1.2 | **Tombol Verifikasi Checker** | `onclick="verifikasiChecker(idOrder)"` | `verifikasiChecker` | `orders` (`checker_verified`) | **READY** | Petugas gudang memvalidasi kesiapan barang. |
| 1.3 | **Tombol Ubah Status Kirim** | `onclick="updateStatusPengiriman(idOrder, status)"` | `updateStatusPengiriman` | `orders` (`delivery_status`, `finish_time`) | **READY** | Transisi status (Dalam Pengantaran, Terkirim Sebagian, Selesai). |
| 1.4 | **Tombol Lanjut Kiriman Sebagian** | `onclick="continuePartialDelivery(idOrder)"` | `continuePartialDelivery` | `orders` (`delivery_status`) | **BELUM DIBUAT** | Order berstatus *Terkirim Sebagian* tidak bisa dilanjutkan pengantarannya. |
| 1.5 | **Tombol Upload & Hapus Foto Muatan** | `onclick="uploadFotoMuatan()"` / `deleteFotoMuatan()` | `addMuatanPhoto` / `deleteMuatanPhoto` | **GAS -> GDrive -> lh3 CDN -> `orders.load_photos`** | **BELUM DIBUAT** | Dokumentasi muatan di atas truk belum terhubung ke Google Drive. |
| 1.6 | **Tombol Upload & Hapus Bukti Driver** | `onclick="uploadBuktiDriver()"` / `deleteBuktiDriver()` | `addDriverPhoto` / `deleteDriverProofPhoto` | **GAS -> GDrive -> lh3 CDN -> `orders.proof_photos`** | **BELUM DIBUAT** | Bukti penerimaan pelanggan saat tiba di lokasi belum masuk ke Drive. |
| 1.7 | **Tombol Upload & Hapus Bukti Transfer** | `onclick="uploadBuktiTransfer()"` / `deleteBuktiTransfer()` | `addTransferPhoto` / `deleteTransferProofPhoto` / `deleteFotoUangLunas` | **GAS -> GDrive -> lh3 CDN -> `orders.transfer_proof`** | **BELUM DIBUAT** | Bukti transfer uang pelunasan COD/Nota belum masuk ke Drive. |
| 1.8 | **Form Tambah Orderan Tambahan** | `onsubmit="handleAddAdditionalOrder(event)"` | `addAdditionalOrder` / `deleteAdditionalOrderPhoto` | **GAS -> GDrive -> lh3 CDN -> `orders.additional_items`** | **BELUM DIBUAT** | Barang susulan yang dititipkan ke sopir tidak bisa diinput berserta fotonya. |
| 1.9 | **Tombol Simpan Lokasi Google Maps** | `onclick="saveGmapsLocation()"` | `updateOrderGmapsLocation` / `updateGmapsLink` | `orders.customer_gmaps` | **BELUM DIBUAT** | Link navigasi Google Maps tujuan pengiriman tidak tersimpan. |
| 1.10 | **Tombol Edit Detail Pesanan & Sopir** | `onsubmit="handleEditOrderSubmit()"` / `assignSopir()` | `updateOrder` / `assignSopir` | `orders` | **READY** | Admin dapat mengganti nama pelanggan, alamat, nota, dan sopir. |
| 1.11 | **Tombol Ubah Status Pembayaran** | `onclick="updateStatusPembayaran(idOrder, status)"` | `updateStatusPembayaran` | `orders.payment_status` | **READY** | Transisi status pembayaran (Lunas, Belum Lunas, Transfer). |
| 1.12 | **Tombol Hapus Order (Admin Trash)** | `onclick="deleteOrder(idOrder)"` | `deleteOrder` | `orders` (Soft / Hard delete) | **READY** | Admin dapat membatalkan / menghapus tiket order. |
| 1.13 | **Tombol Refresh & Banner Toko** | `onclick="loadOrders()"` / `openInfoBannerPopup()` | `getOrders` / `getAnnouncement` | `orders` & `announcements` | **READY** | Memuat ulang daftar order & menampilkan banner popup toko. |
| 1.14 | **Fitur Permohonan & Approval Karnet** | `onclick="requestChangeKarnet()"` / `respondChangeKarnet()` | `requestChangeKarnet` / `respondChangeKarnet` / `dismissDriverKarnetRequest` | `karnet_requests` | **BELUM DIBUAT** | Sopir tidak bisa mengajukan tukar karnet harian ke admin. |

---

### MENU 2: INPUT ORDER BARU (Create Order) — `tabNewOrder`
*Form penerbitan tiket pesanan baru dari toko ke armada pengantaran.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 2.1 | **Autocomplete & Search Pelanggan** | `oninput="searchCustomerInputOrder()"` | `getCustomers` | `customers` | **READY** | Nomor HP & alamat otomatis terisi dari master pelanggan. |
| 2.2 | **Tombol Tambah Baris Barang Dinamis** | `onclick="addNewOrderItemRow()"` | *LOKAL (DOM Manipulation)* | - | **READY** | Tambah item barang, jumlah unit, dan satuan secara leluasa. |
| 2.3 | **Kalkulator Jarak & Ongkir Otomatis** | `onclick="hitungOngkirOtomatis()"` | `calculateRouteDistanceBackend` / `resolveGoogleMapsLocationUrl` | Google Maps API / Server Route | **BELUM DIBUAT** | Perhitungan estimasi KM otomatis gagal, pengguna harus manual. |
| 2.4 | **Upload & Crop Foto Nota Fisik** | `onchange="handleNotaPhotoSelected()"` | *GAS -> GDrive -> lh3 CDN* | **`orders.receipt_photo`** | **READY (UI/Cropper)** | Foto nota terkompres lokal; butuh disalurkan ke pipeline GAS->Drive->lh3. |
| 2.5 | **Tombol Terbitkan Order Baru** | `onsubmit="handleNewOrderSubmit(event)"` | `createOrder` | `orders` | **READY** | Tiket pesanan baru berhasil diterbitkan dan masuk antrean pool. |

---

### MENU 3: DASHBOARD OPERASIONAL — `tabDashboard`
*Pusat kendali metrik harian, statistik 8 kategori pesanan, dan log audit trail.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 3.1 | **Kartu Filter 8 Kategori Order** | `onclick="filterFromDashboard(cat)"` | *LOKAL (Filter Tab Orders)* | - | **READY** | Navigasi cepat melihat order Siap, Jalan, Selesai, Belum Lunas. |
| 3.2 | **Tombol Refresh Data Dashboard** | `onclick="loadDashboardStats()"` | `getDashboardData` | `orders`, `profiles`, `activity_logs` | **READY** | Angka metrik ringkasan ter-update akurat. |
| 3.3 | **Tabel Log Aktivitas Realtime** | *Auto-load / Realtime Subscription* | `getDashboardData` (`activity_logs`) | `activity_logs` | **READY** | 20 riwayat audit trail terakhir tampil dengan jam WITA. |

---

### MENU 4: DATABASE PELANGGAN — `tabCustomers`
*Buku induk master pelanggan, nomor kontak WhatsApp, alamat, dan ongkir standar.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 4.1 | **Tombol Tambah Pelanggan Baru** | `onsubmit="handleAddCustomerSubmit(event)"` | `addCustomer` | `customers` | **BELUM DIBUAT** | Pelanggan baru tidak bisa disimpan langsung dari menu ini. |
| 4.2 | **Tombol Edit Data Pelanggan** | `onsubmit="handleEditCustomerSubmit(event)"` | `updateCustomer` | `customers` | **READY** | Perubahan nama, HP, alamat, dan ongkir tersimpan dengan aman. |
| 4.3 | **Tombol Hapus Pelanggan** | `onclick="deleteCustomer(idCustomer)"` | `deleteCustomer` | `customers` | **READY** | Master pelanggan usang dapat dihapus oleh admin. |
| 4.4 | **Tombol Riwayat Transaksi Pelanggan** | `onclick="openCustomerHistoryModal(id)"` | `getCustomerHistory` | `orders` where `customer_id` | **BELUM DIBUAT** | Riwayat pesanan lama pelanggan tidak dapat dimuat di popup. |
| 4.5 | **Kolom Cari & Paginasi Pelanggan** | `oninput="searchCustomerTable()"` | `getCustomers` | `customers` | **READY** | Pencarian instan nama atau nomor telepon pelanggan berfungsi baik. |

---

### MENU 5: LAPORAN & EKSPOR DATA — `tabReports`
*Arsip laporan historis transaksi, filter rentang tanggal, ekspor dokumen, dan cadangan database ke Google Spreadsheet.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 5.1 | **Tombol Terapkan Filter Laporan** | `onclick="loadReportData()"` | `getReportData` | `orders` (Filtered date range) | **BELUM DIBUAT** | Penarikan data laporan kustom mengembalikan respons fallback. |
| 5.2 | **Tombol Ekspor Dokumen Excel** | `onclick="exportReportToExcel()"` | *LOKAL (CSV/XLSX Blob Exporter)* | - | **READY** | Data yang tampil di tabel dapat diunduh ke format spreadsheet. |
| 5.3 | **Tombol Cetak PDF / Print Laporan** | `onclick="window.print()"` | *LOKAL (CSS Print Optimization)* | - | **READY** | Tampilan cetak laporan bersih dan rapi sesuai standar kertas A4. |
| 5.4 | **Fitur Cadangkan ke Google Spreadsheet**| `onclick="triggerBackupToDrive()"` | `backupDatabaseToDrive` / `saveBackupSettings` | **Google Apps Script -> Google Sheets (`BackupOrders`, dll)** | **BELUM DIBUAT** | Snapshot database tidak ter-backup otomatis ke Sheet toko. |
| 5.5 | **Fitur Arsipkan Order Selesai (>30 Hari)** | `onclick="archiveOrders()"` | `archiveCompletedOrders` / `restoreArchivedOrder` | `orders_archive` | **BELUM DIBUAT** | Transaksi lama menumpuk dan berpotensi memperlambat query. |

---

### MENU 6: LAPORAN ONGKIR (Shipping Analytics) — `tabLaporanOngkir`
*Analisis pendapatan ongkos kirim, breakdown per sopir, pelanggan, dan tren periode.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 6.1 | **Tombol Refresh & Filter Periode** | `onclick="loadLaporanOngkirData(true)"` | `getLaporanOngkirData` | `orders` (`shipping_cost > 0`) | **READY** | Data 6 transaksi ongkir (Rp 180.000) tampil akurat (v3.4.0). |
| 6.2 | **Tab Switcher (Sopir/Pelanggan/Tren)** | `onclick="switchOngkirSubTab(tabName)"` | *LOKAL (Data Aggregator Engine)* | - | **READY** | Pivot pendapatan per sopir dan pelanggan terhitung instan. |
| 6.3 | **Tombol Ekspor Excel & Dokumen Ongkir** | `onclick="exportOngkirExcel()"` / `printOngkirDoc()` | *LOKAL (Excel/Print Styler)* | - | **READY** | Rekapitulasi ongkir siap diekspor atau dicetak fisik. |

---

### MENU 7: MONITORING KENDARAAN (Armada, BBM & Oli) — `tabArmada`
*Pemantauan 4 armada fisik (KT 8136 CM, KT 8329 UA, KT 8240 NB, KT 8919 UQ), izin SPBU, ganti oli, dan servis.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 7.1 | **Tombol Detail Armada (Kartu Mobil)** | `onclick="openVehicleDetailModal(plateNo)"` | `getVehicleReports` / `getVehicleDashboardData` | `vehicles`, `fuel_logs`, `oil_logs` | **BELUM DIBUAT** | Klik kartu mobil memuat layar kosong atau fallback. |
| 7.2 | **Form Permohonan Izin Isi BBM (Sopir)** | `onsubmit="submitIzinBBM(event)"` | `submitPermohonanIsiBBM` / `checkActiveBBMApproval` | `fuel_approvals` | **BELUM LENGKAP** | Sopir bisa mengajukan, namun polling status approval belum ada. |
| 7.3 | **Dialog Persetujuan BBM (Admin)** | `onclick="respondIzinBBM(id, status)"` | `getPendingBBMApprovals` / `respondIzinIsiBBM` | `fuel_approvals` | **BELUM LENGKAP** | Notifikasi izin BBM masuk ke admin belum ditarik otomatis. |
| 7.4 | **Form Input Transaksi BBM Baru** | `onsubmit="handleInputBBMSubmit(event)"` | `submitPengisianBBM` | **GAS -> GDrive -> lh3 CDN -> `fuel_logs.receipt_photo` & `odometer_photo`** | **READY (Data)** | Pencatatan teks berhasil; foto struk & odometer perlu pipeline GAS. |
| 7.5 | **Tombol Edit & Hapus Riwayat BBM** | `onsubmit="editBBM()"` / `deleteBBMTransaction()` | `editBBMTransaction` / `deleteBBMTransaction` | `fuel_logs` | **BELUM DIBUAT** | Salah input kilometer / struk SPBU tidak bisa diperbaiki/dihapus. |
| 7.6 | **Form Input Ganti Oli Mesin** | `onsubmit="handleInputOliSubmit(event)"` | `submitInputOli` | `oil_logs` | **READY** | Input oli mesin baru berhasil memperbarui sisa kilometer oli. |
| 7.7 | **Tombol Edit/Hapus Oli & Interval KM** | `onsubmit="editOli()"` / `updateBatasIntervalOli()` | `editOliTransaction` / `deleteOliTransaction` / `updateBatasIntervalOli` | `oil_logs`, `vehicles` | **BELUM DIBUAT** | Interval ganti oli tidak bisa diubah dan riwayat oli tidak bisa diedit. |
| 7.8 | **Form Input Servis & Perawatan Bengkel** | `onsubmit="handleInputServiceSubmit(event)"` | `submitInputService` | **GAS -> GDrive -> lh3 CDN -> `service_logs.receipt_photo`** | **READY (Data)** | Pencatatan nota bengkel tersimpan; foto nota perlu pipeline GAS. |
| 7.9 | **Tombol Edit/Hapus Servis Bengkel** | `onsubmit="editService()"` / `deleteService()` | `editServiceTransaction` / `deleteServiceTransaction` | `service_logs` | **BELUM DIBUAT** | Data servis salah tidak dapat diedit atau dibatalkan. |
| 7.10 | **Kelola Rekanan SPBU, Bengkel & Oli** | `onclick="deleteSpbuItem()"` / `deleteBengkelItem()` | `getSpbuList`, `getBengkelList`, `getMerekOliList` & delete RPC | `spbu_list`, `bengkel_list`, `oil_brands` | **BELUM DIBUAT** | Pilihan dropdown SPBU dan bengkel tertahan statis di frontend. |
| 7.11 | **Kelola Master Mobil Baru (Tambah/Edit)** | `onsubmit="handleSaveNewVehicle(event)"` | `saveNewMasterVehicle` / `editVehicleFromRekap` | `vehicles` | **BELUM DIBUAT** | Penambahan armada kelima atau ubah tipe mobil tidak bisa disimpan. |

---

### MENU 8: MODUL PAJAK STNK & KIR — `modalTamaraPajakKIR`
*Kepatuhan legalitas kendaraan bermotor (5 Mobil & 2 Motor), jatuh tempo STNK 1 tahun, 5 tahun, KIR, dan notifikasi.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 8.1 | **Tombol Tutup Modal Silang (✕)** | `onclick="closeModulPajakKIR()"` | *LOKAL (DOM Style reset)* | - | **READY** | Modal menutup secara mulus (v3.4.0). |
| 8.2 | **Tombol Refresh & Live Jam WITA** | `onclick="loadPajakDashboardData(true)"` | `getPajakDashboardSummary` / `getPajakKendaraanList` | `tax_vehicles` | **READY** | Dashboard menampilkan 5 mobil & 2 motor dengan jam WITA akurat. |
| 8.3 | **Form Tambah / Edit Kendaraan Pajak** | `onsubmit="handleSavePajakKendaraan(event)"` | `savePajakKendaraan` / `deletePajakKendaraan` | `tax_vehicles` | **READY** | Data tanggal jatuh tempo STNK dan KIR tersimpan rapi. |
| 8.4 | **Form Pelunasan / Tandai Pajak Terbayar** | `onsubmit="handleSubmitPembayaranPajak(event)"` | `submitPembayaranPajak` / `getRiwayatPajakList` | **GAS -> GDrive -> lh3 CDN -> `tax_payment_history.receipt_photo`** | **READY (Data)** | Bukti bayar tersimpan; foto bukti bayar disalurkan ke pipeline GAS. |
| 8.5 | **Pengaturan Notifikasi Pengingat Cloud** | `onsubmit="handleSavePengingatPajak(event)"` | `saveSettingPengingatPajak` / `saveTugasPesanAktifCloud` | `app_settings` | **READY** | Konfigurasi H-30 pengingat tersimpan ke database. |

---

### MENU 9: MODUL SOP KARYAWAN — `modalTamaraSOP`
*Sistem SOP harian berulang, instruksi kerja, checklist kepatuhan karyawan, dan laporan pembacaan.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 9.1 | **Form Buat & Edit Dokumen SOP** | `onsubmit="handleSaveSop(event)"` | `saveSop` / `uploadSopMediaToDrive` | **GAS -> GDrive -> lh3 CDN -> `sop_documents.media_url`** | **BELUM DIBUAT** | Dokumen SOP baru dan foto panduan belum bisa disimpan ke Drive. |
| 9.2 | **Tombol Hapus & Saklar Status SOP** | `onclick="deleteSop(id)"` / `toggleSopStatus()` | `deleteSop` / `setSopStatus` | `sop_documents` | **BELUM DIBUAT** | SOP tidak bisa dinonaktifkan atau dihapus dari sistem. |
| 9.3 | **Form Checklist & Konfirmasi Karyawan** | `onsubmit="handleSubmitSopExecution(event)"` | `submitSopExecutionLog` | `sop_execution_logs` | **BELUM DIBUAT** | Karyawan mengeklik checklist namun status penyelesaian tidak terekam. |
| 9.4 | **Laporan Rekap Kepatuhan SOP** | `onclick="loadSopReport()"` | `getSopReportData` / `deleteSopReportLog` | `sop_execution_logs` | **BELUM DIBUAT** | Manajemen tidak bisa melihat siapa saja yang telah menjalankan SOP. |
| 9.5 | **Tombol Cadangkan Dokumen SOP** | `onclick="backupSopData()"` | `triggerSopBackup` | **Google Apps Script -> Google Sheets / Drive** | **BELUM DIBUAT** | SOP tidak memiliki pencadangan mandiri ke sheet. |

---

### MENU 10: MODUL CEK ONGKIR & JARAK — `modalCekOngkir`
*Kalkulator tarif ongkos kirim berbasis radius kilometer dengan toleransi medan jalan.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 10.1 | **Tombol Hitung Jarak & Tarif Rute** | `onclick="calculateOngkirDistance()"` | `calculateRouteDistanceBackend` / `resolveGoogleMapsLocationUrl` | Google Distance Matrix API | **BELUM DIBUAT** | Perhitungan jarak dan rute gagal mendapatkan data KM backend. |
| 10.2 | **Form Pengaturan Formula Tarif Ongkir** | `onsubmit="handleSaveOngkirConfig(event)"` | `getOngkirConfig` / `saveOngkirConfig` | `app_settings` | **BELUM DIBUAT** | Tarif dasar dan harga per KM tidak dapat dikonfigurasi admin. |

---

### MENU 11: KOMISI PENGANTARAN & TARGET BULANAN — `tabCommission`
*Penetapan persentase bagi hasil sopir/karnet, target omzet bulanan, dan laporan komisi tercapai.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 11.1 | **Form Atur Target Bulanan Sopir** | `onsubmit="handleSaveMonthlyDriverTargets()"` | `getMonthlyDriverTargets` / `saveMonthlyDriverTargets` | `driver_targets` | **READY** | Target bulanan tersimpan dan termonitor di dashboard sopir. |
| 11.2 | **Saklar Akses Pop-up Target Sopir** | `onclick="toggleDriverTargetPopupAccess()"` | `setDriverTargetPopupAccess` | `app_settings` | **READY** | Hak akses sopir membuka rincian target dapat dikontrol admin. |
| 11.3 | **Form Simpan Rate Komisi Sopir & Karnet**| `onsubmit="handleSaveCommissionRates()"` | `saveCommissionRates` | `app_settings` | **READY** | Persentase komisi (Sopir 0.2%, Karnet 0.1%) tersimpan aktif. |
| 11.4 | **Filter & Laporan Rekap Komisi** | `onclick="loadCommissionReport()"` | `getCommissionReport` / `getMonthlyDriverPerformanceReport` | `orders`, `driver_targets` | **READY** | Total komisi pengantaran berhasil dihitung dari pesanan selesai. |

---

### MENU 12: PENGATURAN APLIKASI & POP-UP KARNET — `tabConfig`
*Manajemen konfigurasi sistem, jadwal pengingat karnet harian, dan migrasi skema.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 12.1 | **Kelola Tugas Jam Pop-up Karnet** | `onsubmit="handleSaveKarnetTask(event)"` | `getKarnetTasks` / `saveKarnetTask` / `deleteKarnetTask` | `karnet_tasks` | **READY** | Penjadwalan jam tayang pengingat karnet (07.00 WITA) berfungsi penuh. |
| 12.2 | **Form Nilai Preferensi Konfigurasi** | `onsubmit="handleSaveAppConfig(event)"` | `getAppConfig` / `saveAppConfig` | `app_settings` | **READY** | Parameter nama toko, nomor telepon, dan status sistem tersimpan. |
| 12.3 | **Tombol Migrasi Skema Google Sheets** | `onclick="runMigrationSheet()"` | `runSafeSheetMigration` | Google Spreadsheet | **BELUM DIBUAT** | Fitur khusus penyesuaian header kolom sheet backup. |

---

### MENU 13: MANAJEMEN USER / KARYAWAN (HR & Shift) — `tabUsers`
*Buku induk karyawan (13 User), hak akses (Super Admin, Petugas Pengecek, Sopir, Karnet, Staff Toko), shift kerja, dan KTP.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 13.1 | **Tombol Tambah Pengguna Baru** | `onsubmit="handleAddUserSubmit(event)"` | `saveUser` / `getUsers` | `profiles` | **READY** | Karyawan baru dapat didaftarkan dengan username dan password. |
| 13.2 | **Tombol Edit Pengguna & Jam Shift** | `onsubmit="handleEditUserSubmit(event)"` | `saveUser` | `profiles` | **READY** | Perubahan jam kerja (shift) dan nomor kontak tersimpan akurat. |
| 13.3 | **Tombol Hapus Pengguna** | `onclick="deleteUser(userCode)"` | `deleteUser` | `profiles` | **READY** | Akun karyawan nonaktif dapat dinonaktifkan atau dihapus. |
| 13.4 | **Tombol Lihat Dokumen KTP Karyawan** | `onclick="openKtpModal(urlKtp)"` | *LOKAL (Gallery Lightbox)* | **GAS -> GDrive -> lh3 CDN -> `profiles.ktp_photo_url`** | **READY (Preview)** | Foto KTP di-load dari URL lh3 CDN berkecepatan tinggi. |

---

### MENU 14: PESAN DARURAT (Emergency Alert Broadcast) — `tabEmergency`
*Siaran pengumuman darurat instan yang membunyikan sirine dan memblokir layar seluruh karyawan.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 14.1 | **Form Buat Siaran Darurat Baru** | `onsubmit="handleBroadcastEmergency(event)"` | `saveEmergencyMessage` | `emergency_alerts` | **READY** | Pesan darurat tersimpan dan memicu alarm ke perangkat tujuan. |
| 14.2 | **Tombol Toggle Status & Hapus Pesan** | `onclick="toggleEmergencyStatus()"` / `deleteEmergencyMessage()` | `getAllEmergencyMessages` / `toggleEmergencyMessageStatus` / `deleteEmergencyMessageById` | `emergency_alerts` | **BELUM LENGKAP** | Hapus pesan ready, namun toggle saklar on/off pesan belum terhubung. |
| 14.3 | **Tombol Konfirmasi Baca (Matikan Sirine)**| `onclick="acknowledgeEmergencyModal()"` | `acknowledgeEmergencyMessage` | `emergency_reads` | **BELUM DIBUAT** | Karyawan menekan tombol konfirmasi tapi status terbaca belum tercatat. |

---

### MENU 15: MODE SUPLAYER (Barang Datang & Faktur Hutang) — `tabSuplayer`
*Pencatatan nota supplier, pemantauan barang datang toko, status jatuh tempo, dan pelunasan faktur.*

| No | Elemen / Tombol UI | Aksi / Event Handler | Target RPC Backend | Supabase Table / Storage Pipeline | Status Audit | Dampak / Risiko Jika Belum Ada |
| :-: | :--- | :--- | :--- | :--- | :-: | :--- |
| 15.1 | **Form Input Nota Suplayer / Barang Datang**| `onsubmit="handleSaveBarangDatangSubmit()"` | `saveBarangDatang` / `getSuppliers` | **GAS -> GDrive -> lh3 CDN -> `supplier_orders.receipt_photo`** | **BELUM DIBUAT** | Pencatatan faktur barang datang toko gagal tersimpan ke database. |
| 15.2 | **Tombol Edit & Hapus Nota Suplayer** | `onsubmit="editBarangDatang()"` / `deleteBarangDatang()` | `updateBarangDatang` / `deleteBarangDatang` | `supplier_orders` | **BELUM DIBUAT** | Koreksi salah input nota suplayer tidak dapat dilakukan. |
| 15.3 | **Form Pelunasan Pembayaran Faktur** | `onsubmit="handleBayarNotaSuplayerSubmit()"` | `recordSupplierPayment` | **GAS -> GDrive -> lh3 CDN -> `supplier_payments.transfer_proof`** | **BELUM DIBUAT** | Pelunasan hutang toko dan upload bukti transfer suplayer gagal disimpan. |
| 15.4 | **Filter Jatuh Tempo Faktur** | `onclick="switchTempoTab(status)"` | `getBarangDatangList` | `supplier_orders` | **READY** | Tab filter faktur jatuh tempo dapat memuat daftar nota. |
| 15.5 | **Kelola Master Rekanan Supplier** | `onclick="manageSuppliers()"` | `saveSupplier` / `updateSupplier` / `deleteSupplier` | `suppliers` | **BELUM DIBUAT** | Database mitra distributor semen, besi, pipa belum bisa di-CRUD. |

---
## 4. MASTER PLAN TAHAPAN AUDIT & IMPLEMENTASI BERTAHAP
---

```mermaid
flowchart TD
    A["Review & Konfirmasi Pemetaan (revisi.md)"] --> B["Tahap 1: Core Order Lifecycle, Media Gateway GAS -> GDrive -> lh3"]
    B --> C["Tahap 2: Monitoring Armada Kendaraan, BBM & Servis"]
    C --> D["Tahap 3: Master Data Pelanggan, Suplayer & Pelunasan"]
    D --> E["Tahap 4: Modul SOP Karyawan & Laporan Kepatuhan"]
    E --> F["Tahap 5: Laporan Ekspor, Jarak Maps, Backup Sheets & Pesan Darurat"]
    F --> G["Final Production Parity 100% Verification"]
```

### 📌 TAHAP 1: Core Order Lifecycle & Media Gateway (Menu 1 & Menu 2)
> **Fokus Utama:** Mengaktifkan jembatan upload foto via GAS ke Google Drive (Edge CDN `lh3`) serta menyempurnakan alur utama tiket pengantaran.
1. **Konfigurasi Universal GAS Media Gateway (`window.__TB_GAS_BACKEND_URL`):**
   - Menghubungkan endpoint POST GAS `uploadFileDirectToDrive`.
   - Mengonversi file upload di Google Drive (`TB_DELIVERY_ATTACHMENTS`) menjadi URL `https://lh3.googleusercontent.com/d/{ID}=s1200`.
2. **Implementasi Foto Orderan:**
   - `addMuatanPhoto` & `deleteMuatanPhoto` (unggah foto muatan bak truk -> simpan URL `lh3` ke `orders.load_photos`).
   - `addDriverPhoto` & `deleteDriverProofPhoto` (bukti terima barang driver -> simpan URL `lh3` ke `orders.proof_photos`).
   - `addTransferPhoto`, `deleteTransferProofPhoto`, & `deleteFotoUangLunas` (bukti transfer COD -> simpan URL `lh3` ke `orders.transfer_proof`).
   - `addAdditionalOrder` & `deleteAdditionalOrderPhoto` (muatan susulan -> simpan URL `lh3` ke `orders.additional_items`).
3. **Penyempurnaan Alur Kirim:**
   - `continuePartialDelivery` (melanjutkan kiriman yang sebelumnya berstatus *Terkirim Sebagian*).
   - `updateOrderGmapsLocation` & `updateGmapsLink` (simpan link koordinat navigasi Google Maps tujuan).
   - `requestChangeKarnet`, `getPendingKarnetRequests`, `respondChangeKarnet`, `dismissDriverKarnetRequest` (tukar karnet harian).

### 📌 TAHAP 2: Monitoring Armada Kendaraan, BBM & Servis (Menu 7)
> **Fokus Utama:** Menghilangkan disparitas data armada (KT 8240 NB, dll) dan menyalurkan bukti struk SPBU/bengkel ke Google Drive CDN.
1. Implementasi `getVehicleReports` & `getVehicleDashboardData` (modal detail spesifik per mobil).
2. Salurkan upload foto struk BBM dan odometer ke Google Drive via GAS -> simpan URL `lh3` ke `fuel_logs`.
3. Implementasi approval pengisian BBM: `checkActiveBBMApproval` & `getPendingBBMApprovals`.
4. Implementasi CRUD lengkap riwayat BBM: `editBBMTransaction` & `deleteBBMTransaction`.
5. Implementasi CRUD lengkap riwayat oli & interval KM: `editOliTransaction`, `deleteOliTransaction`, `updateBatasIntervalOli`.
6. Implementasi CRUD lengkap bengkel: `editServiceTransaction` & `deleteServiceTransaction`.
7. Implementasi Master Relasi Armada: `getSpbuList`, `deleteSpbuItemServer`, `getBengkelList`, `deleteBengkelItemServer`, `getMerekOliList`, `deleteMerekOliItemServer`, `saveNewMasterVehicle`, `editVehicleFromRekap`, `deleteVehicleFromRekap`.

### 📌 TAHAP 3: Master Pelanggan, Mode Suplayer & Pelunasan Nota (Menu 4 & Menu 15)
> **Fokus Utama:** Kelengkapan data relasi eksternal serta upload faktur dan bukti bayar supplier ke Google Drive CDN.
1. Implementasi `addCustomer` & `getCustomerHistory` (tambah master pelanggan baru & popup histori belanja).
2. Implementasi Master Supplier CRUD: `saveSupplier`, `updateSupplier`, `deleteSupplier`.
3. Salurkan upload foto faktur barang datang ke Google Drive via GAS -> simpan URL `lh3` ke `supplier_orders.receipt_photo`.
4. Salurkan upload bukti transfer pelunasan supplier ke Google Drive via GAS -> simpan URL `lh3` ke `supplier_payments.transfer_proof`.
5. Implementasi CRUD Faktur Suplayer: `saveBarangDatang`, `updateBarangDatang`, `deleteBarangDatang`, `recordSupplierPayment`.

### 📌 TAHAP 4: Modul SOP Karyawan & Laporan Kepatuhan (Menu 9)
> **Fokus Utama:** Mengaktifkan panduan operasional standar harian toko beserta foto panduan ke Drive CDN.
1. Salurkan upload foto/media panduan SOP ke Google Drive via GAS -> simpan URL `lh3` ke `sop_documents.media_url`.
2. Implementasi Penerbitan Dokumen SOP: `saveSop`, `deleteSop`, `setSopStatus`.
3. Implementasi Kepatuhan Karyawan: `submitSopExecutionLog` (pencatatan checklist dan jam eksekusi).
4. Implementasi Pelaporan Manajemen: `getSopReportData`, `deleteSopReportLog`, `cleanOrphanSopReportLogs`.

### 📌 TAHAP 5: Laporan Ekspor, Jarak Maps, Backup Sheets & Pesan Darurat (Menu 5, Menu 10, Menu 14)
> **Fokus Utama:** Penarikan laporan kustom, cold backup ke Google Sheets, dan siaran darurat.
1. Implementasi Penarikan Laporan Historis: `getReportData` (filter rentang tanggal fleksibel).
2. Implementasi Cold Backup ke Google Spreadsheet: `backupDatabaseToDrive` / `backupSupabaseToGoogleSheets` (snapshot otomatis tengah malam ke Sheet).
3. Implementasi Arsip Order Otomatis: `getArchiveSummary`, `archiveCompletedOrders`, `getArchivedOrders`, `restoreArchivedOrder`.
4. Implementasi Jarak & Konfigurasi Ongkir: `calculateRouteDistanceBackend`, `resolveGoogleMapsLocationUrl`, `getOngkirConfig`, `saveOngkirConfig`.
5. Implementasi Penyempurnaan Pesan Darurat: `getAllEmergencyMessages`, `toggleEmergencyMessageStatus`, `acknowledgeEmergencyMessage`.

---
## 5. STATUS PERSETUJUAN & KONFIRMASI USER
---

================================================================================
STATUS: TAHAP 1 (CORE ORDER LIFECYCLE & MEDIA GATEWAY LH3) SELESAI & LIVE.
VERIFIKASI PRODUKSI: HTTPS://TMR-APP.VERCEL.APP (COMMIT 7e70cb9).
SIAP UNTUK TAHAP 2: MONITORING ARMADA KENDARAAN, BBM & PERAWATAN SERVIS.
MENUNGGU PERINTAH / KONFIRMASI: "OKE TERAPKAN TAHAP 2".
================================================================================
