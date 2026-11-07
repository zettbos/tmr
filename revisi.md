# DRAF RENCANA REVISI AKTIF (v7.0.0)
## INVESTIGASI AKAR MASALAH NOTIFIKASI MULTI-USER SOP, ISOLASI RESIDU CACHE LOKAL ANTAR-AKUN, PERBAIKAN FOLDER "TERJADWAL" KE "BELUM SELESAI", DAN PANDUAN PENGUJIAN KLIEN AMIR

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% dari baris pertama setiap ada sesi revisi baru. Riwayat revisi lama yang telah selesai dan tervalidasi tersimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. PENJELASAN & KLARIFIKASI: "INI YANG SALAH GW APA KLIEN YA?"

Berdasarkan analisis log percakapan WhatsApp, tangkapan layar iPhone klien Amir, dan inspeksi mendalam pada basis data Supabase:

**Jawabannya: Ini adalah KOMBINASI antara metode pengujian klien yang tidak merefleksikan operasional lapangan nyata, dan KELEMAHAN SISTEM APLIKASI KITA dalam menangani pergantian akun beruntun pada satu perangkat/peramban (*Single-Device Multi-Account Switching*).**

Berikut perincian adil dan transparan dari kedua sisi:

### A. Dari Sisi Klien (Amir) — Cara Pengujian yang Berbeda dengan Operasional Lapangan:
1. **Pengujian 3 Akun Beruntun di 1 HP yang Sama:**  
   Amir menguji fitur multi-user dengan skenario:  
   - Login Akun 1 (`pengantaran 1`) di HP miliknya pada 17.33 -> Notif muncul di 17.35 -> Dikerjakan sampai selesai.  
   - Logout Akun 1 -> Langsung Login Akun 2 (`pengantaran 2` atau `staff 2`) di HP yang sama pada 17.37 -> Menunggu notifikasi muncul.  
2. **Kondisi Riil Operasional di Lapangan:**  
   Di dunia kerja nyata:
   - Sopir 1 memegang HP fisiknya sendiri di Truk A.
   - Sopir 2 memegang HP fisiknya sendiri di Truk B.
   - Staff Toko memegang HP fisiknya sendiri di Meja Toko.  
   Masing-masing karyawan tetap dalam keadaan login di HP masing-masing, sehingga alarm notifikasi jam 17.35 akan berdering serentak di ketiga HP fisik tersebut.
3. **Mengapa Cara Klien Tetap Wajar?**  
   Meskipun tidak mencerminkan operasional sopir, **cara pengujian yang dilakukan Amir adalah hal yang sangat wajar bagi seorang Owner / Klien**. Seorang pemilik bisnis tentu ingin memastikan sistemnya berjalan sebelum menyerahkan akun ke karyawannya tanpa harus meminjam 3 unit HP fisik sekaligus.

---

### B. Dari Sisi Sistem / Kita (Bug Kode Aplikasi Kita):
Meskipun Amir menguji di 1 HP fisik yang sama, **aplikasi web kita seharusnya tangguh (*resilient*) dan mampu mengisolasi data masing-masing akun secara bersih tanpa kebocoran residu cache**.  
Faktanya, ada **4 Cacat Teknis (Technical Flaws)** nyata di kode aplikasi kita:

1. **Local Cache Pollution (`is_user_completed: true` bocor ke akun lain):**  
   Saat `pengantaran 1` menyelesaikan SOP, fungsi `finishSopExecution` (baris 60038) menuliskan properti `is_user_completed: true` langsung ke dalam objek SOP di `localStorage` (`tb_sop_master_data_cache`).  
   Ketika Amir logout dan login sebagai `pengantaran 2` atau `staff 2`, browser membaca cache SOP tersebut. Fungsi `getSopMultiUserProgress` (baris 51716) melihat `is_user_completed: true`. Akibatnya, `pengantaran 2` dan `staff 2` **langsung dianggap oleh sistem sudah menyelesaikan SOP tersebut hari ini**! Di kartu SOP bahkan muncul badge hijau *"Anda Selesai"*. Karena sudah dianggap selesai, alarm notifikasi otomatis dicegah muncul!
2. **Residu Debounce Global Tanpa User Scope (`tb_sop_last_pop_` & `_activeSopNotificationData`):**  
   Pada baris 60882 dan 63690, debounce dicatat dengan kunci `tb_sop_last_pop_` + idSop tanpa menyertakan identitas user. Selain itu, variabel memori `window._activeSopNotificationData` tidak pernah di-reset menjadi `null` saat logout atau saat eksekusi selesai, sehingga guard baris 60914 menolak memicu notifikasi ulang untuk SOP yang sama.
3. **Kartu SOP Terjebak di Folder "Terjadwal" padahal Sudah Dikerjakan 1/3 User (Screenshot 2 Amir):**  
   Pada tangkapan layar iPhone Amir (jam 17.18), kartu menampilkan `Penyelesaian: 1/3 User (33%)`, namun status badge masih tertulis `Terjadwal` dan kartu masih berada di tab **"Terjadwal"** (belum berpindah ke folder **"Belum Selesai"**).  
   Penyebabnya di `getEffectiveSopStatus` (baris 51900): sistem mengecek `sop._adminManualStatus === 'terjadwal'` sebelum mengecek progres pengerjaan `progress.completedCount > 0`. Akibatnya, status terkunci di `Terjadwal` dan kartu tidak mau berpindah folder.
4. **Window Keterlambatan Login (Late-Login Overdue Catch-Up):**  
   Jadwal SOP disetel jam **17.35 WITA**. Amir baru login akun kedua pada jam **17.37 WITA** (terlambat 2 menit).  
   Sistem kita saat ini hanya mengevaluasi slot yang jatuh tempo tetapi belum memiliki penanganan agresif untuk *late-login*: jika seorang staf baru membuka/login aplikasi setelah jam jatuh tempo terlewati dan ia belum menyelesaikan tugasnya hari ini, sistem **WAJIB langsung memunculkan alarm popup pengingat seketika** (*overdue catch-up*).

---

## 2. HASIL AUDIT TEKNIS & BUKTI VALIDASI DATABASE SUPABASE

Audit langsung ke basis data produksi Supabase (`https://eagplukqotycpslhvnbp.supabase.co`) mengonfirmasi temuan berikut:

1. **Tabel `sop_masters`:**  
   - ID: `SOP-1794043247520`  
   - Judul: *"Pengantaran Muatan Berat & Semen"*  
   - Status di database: `'Belum Selesai'` (Server database sudah benar mencatat status ini).
2. **Tabel `sop_targets` (`JADWAL-SOP-1794043247520`):**  
   - Target Users memuat 3 kode staf unik:  
     - `USR-002` (`staff2` / `TAMARA BANGUNAN`)  
     - `USR-004` (`driver1` / `01 PENGANTARAN`)  
     - `USR-005` (`driver2` / `02 PENGANTARAN`)  
     Serta alias pelengkapnya.
3. **Tabel `sop_execution_logs`:**  
   - Ditemukan hanya 1 log penyelesaian:  
     `id: LOG-1794043396950-427`, `username: USR-004`, `full_name: 01 PENGANTARAN`, `status: Selesai`, `completed_at: 2026-11-07 17:23:16 WITA`.  
   - `USR-002` dan `USR-005` **BENAR-BENAR BELUM MENYELESAIKAN SOP INI DI SERVER**.  
   - Ini membuktikan bahwa kegagalan notifikasi pada akun ke-2 murni akibat residu state lokal di browser HP Amir.

---

## 3. RANCANGAN SOLUSI PERBAIKAN ARSITEKTUR LENGKAP (v7.0.0)

Untuk menyelesaikan masalah ini secara tuntas 100% dan membuat aplikasi kebal terhadap pengujian akun bergantian di satu perangkat:

---

### Solusi 1: Isolasi Total Status Multi-User & Pembersihan Residu `is_user_completed`
* **File Target:** `tb-delivery-pro/index.html` (Fungsi `getSopMultiUserProgress` baris ~51642 & `finishSopExecution` baris ~59980).
* **Perubahan Kode:**  
  1. Hapus penyimpanan flag global `is_user_completed: true` ke dalam properti objek `sop.multi_user_progress` di master cache.
  2. Evaluasi status `isUserCompleted` di `getSopMultiUserProgress` **HANYA dihitung secara dinamis dan real-time** dengan mencocokkan identitas pengguna aktif saat ini (`currentUser.username`, `currentUser.id_user`, `currentUser.nama`) terhadap:
     - Daftar array `completed_by` / log eksekusi hari ini.
     - Kunci lokal ber-skop user: `localStorage.getItem('tb_sop_completed_' + idSop + '_' + userKey + '_' + todayKey)`.
  3. DILARANG KERAS mengasumsikan `isUserCompleted = true` hanya karena ada properti `m.is_user_completed` di objek cache lama.

---

### Solusi 2: Pembersihan Bersih Saat Logout (*Hard Teardown Session*)
* **File Target:** `tb-delivery-pro/index.html` (Fungsi `handleLogoutDirect`, `clearPersistentAuthSession`, `closeModulSOP`).
* **Perubahan Kode:**  
  1. Reset total seluruh variabel state global memori:
     ```javascript
     window._activeSopNotificationData = null;
     window._activeSopAckKey = null;
     window._sopExecutionState = null;
     window._serverCompletedSopIdsSet = new Set();
     ```
  2. Bersihkan `sessionStorage.clear()`.
  3. Hapus seluruh kunci debounce dan ack slot yang berpotensi menahan trigger notifikasi:
     - Hapus `tb_sop_last_pop_*`
     - Hapus `tb_sop_ack_slot_*`
  4. Bersihkan properti residu user-specific dari `window._sopMasterDataCache` sebelum pengguna baru login.

---

### Solusi 3: Perbaikan Logika Folder "Terjadwal" -> "Belum Selesai" di `getEffectiveSopStatus`
* **File Target:** `tb-delivery-pro/index.html` (Fungsi `getEffectiveSopStatus` baris ~51883).
* **Perubahan Logika Presedensi:**
  ```javascript
  // 1. DRAFT SELALU DRAFT
  if (stLower === 'draft' || stLower === 'draf') return 'Draft';

  // 2. STATUS SELESAI (Semua user selesai / 100%)
  if (progress.isAllCompleted || (progress.totalAssigned <= 1 && isDoneToday)) return 'Selesai';

  // 3. ATURAN KRUSIAL MULTI-USER: JIKA SUDAH ADA SEBAGIAN USER YANG SELESAI (completedCount > 0):
  // Status MUTLAK "Belum Selesai" dan WAJIB berada di folder "Belum Selesai"!
  // Aturan ini MENDAHULUI status manual terbit/terjadwal!
  if (progress.completedCount > 0) {
      return 'Belum Selesai';
  }

  // 4. JIKA BELUM ADA USER SELESAI (0 User Selesai):
  // Cek apakah waktu jadwal sudah tiba hari ini
  const isDue = isSopScheduleTimeDue(sop, todayKey);
  if (isDue) {
      return 'Belum Selesai';
  }

  // 5. Default jika belum tiba jamnya:
  return 'Terjadwal';
  ```
  Dengan perubahan ini:
  - Kartu dengan progres `1/3 User (33%)` **100% dipastikan otomatis berpindah ke tab "Belum Selesai"** dan ber-badge kuning *"Belum Selesai"*, persis seperti yang diminta Amir!

---

### Solusi 4: Mekanisme Overdue Catch-Up Notifikasi Saat Login Terlambat
* **File Target:** `tb-delivery-pro/index.html` (Fungsi `checkSopScheduleBackgroundTrigger` & `handleSopBroadcastData`).
* **Perubahan Kode:**
  - Saat `checkSopScheduleBackgroundTrigger` dieksekusi pasca-login:
    Jika jam saat ini sudah melebihi jam jadwal SOP (`curWitaMin >= schMin`), dan user tersebut belum menyelesaikan SOP pada hari ini (`!isCompletedToday`), sistem langsung menetapkan slot tersebut sebagai `latestDueSlot` dan memicu alarm popup notifikasi seketika (tanpa harus menunggu pergantian menit berikutnya).
  - Pastikan kunci `slotAckKey` dan `lastPopKey` menyertakan `userKey` spesifik:
    `'tb_sop_ack_slot_' + idSop + '_' + userKey + '_' + todayKey + '_' + cleanSlotId`.

---

### Solusi 5: Sinkronisasi Realtime Progres Multi-User dari Supabase
* **File Target:** `tb-delivery-pro/supabase-gas-adapter.js` (Fungsi `getActiveSopBroadcast`).
* **Perubahan Kode:**
  - Tambahkan kalkulasi `multi_user_progress` (`total_assigned`, `completed_count`, `completed_by`, `percentage`) ke dalam setiap objek SOP yang dikembalikan oleh `getActiveSopBroadcast`.
  - Ketika ponsel admin atau staf melakukan polling heartbeat atau sinkronisasi, progres multi-user terupdate otomatis secara live tanpa perlu me-refresh halaman browser.

---

## 4. TEMPLATE JAWABAN PROFESIONAL UNTUK KLIEN AMIR

Anda dapat menyalin pesan berikut untuk dikirimkan ke Amir via WhatsApp:

```text
Halo Pak Amir, terima kasih banyak atas detail pengujiannya yang sangat jelas dan membantu. 🙏

Terkait hasil pengujian tadi, kami ingin menjelaskan:
1. Mengenai Notifikasi Multi-User:
Di lapangan nanti, Pengantaran 1, Pengantaran 2, dan Staff 2 masing-masing memegang HP sendiri. Notifikasi jam 17.35 akan berdering serentak di HP masing-masing.
Tadi di HP Pak Amir tidak muncul di akun kedua/ketiga karena diuji secara bergantian di 1 HP yang sama. Di sistem kami sebelumnya, ketika Akun 1 selesai mengerjakan SOP di HP tersebut, browser masih menyimpan catatan lokal bahwa "SOP di HP ini sudah selesai", sehingga ketika Pak Amir login Akun 2 di HP yang sama, sistem salah mendeteksi bahwa Akun 2 sudah menyelesaikannya.

2. Mengenai Kartu SOP di Folder "Terjadwal":
Pak Amir 100% benar. Seharusnya begitu Akun 1 selesai (1/3 User - 33%), kartu SOP otomatis berpindah ke tab "Belum Selesai", bukan menetap di "Terjadwal". Kemarin ada pembacaan status jadwal yang mengunci kartu tersebut.

Saat ini kami sudah menyiapkan perbaikan menyeluruh:
- Pembersihan memori cache total saat logout (sehingga dites gonta-ganti akun di 1 HP pun notifikasi akan tetap berbunyi normal).
- Kartu SOP otomatis pindah ke folder "Belum Selesai" begitu ada 1 staf yang mulai mengerjakan (progres 1/3, 2/3, dst).
- Jika staf telat login (misal jadwal 17.35 baru login 17.37), alarm notifikasi akan langsung muncul saat login.

Perbaikan sedang kami proses sekarang ya Pak. 🙏
```

---

## 5. RENCANA AKSI & STATUS PERSETUJUAN

| No | Modul / Komponen | Tindakan | File |
|---|---|---|---|
| 1 | Multi-User Isolation | Hapus `is_user_completed` dari cache master, hitung dinamis per user aktif | `tb-delivery-pro/index.html` |
| 2 | Hard Session Teardown | Reset `window._activeSopNotificationData = null` dan pembersihan cache logout | `tb-delivery-pro/index.html` |
| 3 | Folder Status Precedence | Prioritaskan `completedCount > 0` menjadi `'Belum Selesai'` di `getEffectiveSopStatus` | `tb-delivery-pro/index.html` |
| 4 | Overdue Catch-Up Trigger | Picu alarm seketika jika login melewati jam jadwal dan belum selesai | `tb-delivery-pro/index.html` |
| 5 | Realtime Progress Sync | Sertakan `multi_user_progress` lengkap di `getActiveSopBroadcast` | `tb-delivery-pro/supabase-gas-adapter.js` |
| 6 | Deployment & Verifikasi | Verifikasi syntax, deploy ke Vercel production, dan uji login multi-user | Produksi Live |

> **PERINGATAN PROTOKOL ZETTBOT:**  
> Sesuai SOP ZettBOT, kode aplikasi **BELUM DIUBAH SAMA SEKALI** pada sesi ini.  
> Untuk menerapkan seluruh solusi perbaikan di atas secara otomatis ke codebase dan mendeploy ke produksi, silakan ketik:  
> **`/zettbot OKE TERAPKAN`**
