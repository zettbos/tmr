# DRAF RENCANA REVISI AKTIF (v6.8.0)
## AUDIT NOTIFIKASI MULTI-USER LENGKAP & SISTEM REALTIME WEBSOCKET PROGRES PENYELESAIAN SOP

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% dari baris pertama setiap ada sesi revisi baru. Riwayat revisi lama yang telah selesai dan tervalidasi tersimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. PENJELASAN MAKSUD & PERMINTAAN KLIEN AMIR SECARA LENGKAP

Berdasarkan tangkapan layar WhatsApp, klien Amir menyampaikan dua poin keluhan kritis:

### Poin 1: "Ini saya bikin lebih dari 2 atau 3. Notif di user yang muncul hanya 2 user sekarang. Bikin notif muncul di semua user yang dipilih mas" (13:24)
* **Apa maksud Amir?**  
  Amir mencoba membuat SOP dan memilih lebih dari 2 orang target (misalnya 3 user: Staff Toko, Driver 1, dan Driver 2).  
  Namun saat jam jadwal tiba, **hanya 2 user yang menerima pop-up notifikasi SOP**, sedangkan user ke-3 (dan user lainnya jika dipilih lebih banyak) sama sekali tidak menerima notifikasi SOP!  
  Amir meminta agar **SEMUA user yang dicentang/dipilih di daftar penerima 100% menerima notifikasi**, tanpa ada yang tertinggal atau tereliminasi sepihak oleh sistem.

### Poin 2: "Laporan ini bikin realtime ya mas" (12:56)
* **Apa maksud Amir?**  
  Pada tangkapan layar daftar SOP, Amir mencoretkan tanda centang biru tepat pada badge:  
  **`Penyelesaian: 0/2 User (0%)`**  
  Maksud Amir: Saat admin/owner sedang membuka menu "Daftar SOP", begitu ada driver atau staff yang menyelesaikan SOP di HP masing-masing (klik centang checklist dan simpan selesai):  
  - Badge persentase penyelesaian di layar Admin **HARUS BERUBAH SECARA OTOMATIS & REALTIME** (misal langsung naik dari `0/3 User (0%)` ➔ `1/3 User (33%)` ➔ `2/3 User (66%)` ➔ `3/3 User (100%)`).  
  - Kartu SOP **HARUS OTOMATIS PINDAH FOLDER** (dari folder `Terjadwal` ➔ `Belum Selesai` ➔ `Selesai`) detik itu juga.  
  - Admin **TIDAK MAU HARUS REFRESH HALAMAN (F5 / PULL-TO-REFRESH)** hanya untuk melihat siapa saja yang sudah mengerjakan SOP. Sistem harus hidup (*live reactive*).

---

## 2. HASIL AUDIT TEKNIS & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Setelah dilakukan audit mendalam pada kode `supabase-gas-adapter.js`, antarmuka `index.html`, serta data riil tabel Supabase PostgreSQL:

### Akar Masalah Poin 1: Kenapa Notifikasi Hanya Muncul di 2 User Saat Dipilih 3+ User?

1. **Jebakan Evaluasi UUID pada Backend `getActiveSopBroadcast()`:**  
   Pada `supabase-gas-adapter.js` baris 7197:
   ```javascript
   const curId = String(u.id || u.id_user || u.user_code || '').toLowerCase().trim();
   ```
   Di database Supabase, `u.id` adalah UUID panjang (misal: `22d842c4-b043-4215-...`), sedangkan daftar `target_users` di database menyimpan kode user `USR-005` atau username `driver2`.  
   Karena ekspresi logika `u.id || u.id_user || u.user_code` selalu berhenti di `u.id`, variabel `curId` terisi oleh UUID! Akibatnya:
   ```javascript
   tgtUsers.includes(curId); // Mengecek apakah '22d842c4...' ada di target_users -> FALSE!
   ```
   Kode `u.user_code` (`USR-005`) sama sekali tidak pernah diuji ke dalam `tgtUsers`.

2. **Disparitas Spasi Ganda pada Nama Driver (`02   PENGANTARAN`):**  
   Di tabel `profiles`, nama asli Driver 1 dan Driver 2 memiliki 3 spasi pemisah: `"01   PENGANTARAN"` dan `"02   PENGANTARAN"`.  
   Sedangkan antarmuka token generator membuat variasi dengan 1 spasi: `"02 pengantaran"`.  
   Pengecekan string mentah:
   `"02 pengantaran".includes("02   pengantaran")` menghasilkan `false`!

3. **Halusinasi Ekstraksi Angka `uNum` pada `checkUserTargetMatch()` di `index.html`:**  
   Pada baris 60309:
   ```javascript
   const uNumMatch = (uId + ' ' + uName + ' ' + uUsername).match(/\b0*(\d+)\b/);
   ```
   Ketika `uId` berupa string `USR-005` atau UUID `22d842c4...`, regex `\b0*(\d+)\b` menangkap angka arbitrer (misal `5` dari `USR-005`, atau `22` dari UUID).  
   Saat mencocokkan dengan target `driver2` (`tNum = 2`), sistem melihat `uNum (5) !== tNum (2)` atau `uNum (22) !== tNum (2)`.  
   Aturan anti-salah-kamar langsung mem-blokir pencocokan (`continue;`)! Akibatnya, Driver 2 divonis bukan penerima SOP dan popup tidak muncul!

---

### Akar Masalah Poin 2: Kenapa Progres Kartu SOP Belum Realtime?

1. **Tabel `sop_execution_logs` Belum Terdaftar di WebSocket Supabase Realtime:**  
   Pada `supabase-gas-adapter.js` fungsi `initSupabaseRealtime()`, listener WebSocket yang terpasang hanya untuk tabel `orders`, `fuel_approvals`, `vehicles`, dll. Tabel **`sop_execution_logs`** **SAMA SEKALI BELUM DIDAFTARKAN!**
2. **Akibatnya:**  
   Saat driver menekan tombol "Selesai" di HP-nya, log pengerjaan tersimpan di Supabase, namun browser Admin tidak menerima event WebSocket apapun. Tampilan kartu SOP di HP Amir tetap membeku di angka `0/2 User (0%)` dan tetap berada di folder `Terjadwal` hingga halaman dimuat ulang secara manual.

---

## 3. ARSITEKTUR SOLUSI TEKNIS (v6.8.0) YANG TELAH DITERAPKAN

### Solusi Poin 1: Penjaminan Notifikasi Muncul di Seluruh User Terpilih
1. **Normalisasi Multi-Identifier di Backend (`getActiveSopBroadcast`):**  
   Memeriksa seluruh kemungkinan pengenal pengguna secara paralel tanpa saling menimpa:
   - Cek `u.user_code` (`USR-002`, `USR-004`, `USR-005`, dst) terhadap `target_users`.
   - Cek `u.username` (`staff2`, `driver1`, `driver2`, dst) terhadap `target_users`.
   - Cek `u.id_user` dan UUID `u.id` terhadap `target_users`.
   - Normalisasi spasi regex `/\s+/g` ➔ `' '` pada nama pengguna untuk melenyapkan bug 3 spasi.
2. **Perbaikan Sanitasi `uNum` di Frontend (`checkUserTargetMatch` & `generateSopUserAliases`):**  
   Isolasi ekstraksi nomor pengguna HANYA dari `username` (misal `driver1` ➔ 1, `driver2` ➔ 2) dan nama bersih, BUKAN dari string acak ID/UUID database.  
   Menjamin User 1, User 2, User 3, hingga User N yang dicentang 100% lolos verifikasi dan menerima notifikasi pop-up secara serentak.

### Solusi Poin 2: Live Realtime Reactive SOP Progress Card via WebSockets
1. **Pendaftaran Channel WebSocket untuk SOP di `initSupabaseRealtime()`:**  
   Menambahkan subscription event postgres changes:
   ```javascript
   .on('postgres_changes', { event: '*', schema: 'public', table: 'sop_execution_logs' }, (payload) => {
       // Begitu ada user yang selesai mengerjakan:
       // 1. Refresh silent data daftar SOP & hitung ulang multi-user progress
       // 2. Update badge kartu "Penyelesaian: X/Y User (Z%)" secara instan
       // 3. Pindahkan kartu ke folder "Belum Selesai" / "Selesai" detik itu juga!
   })
   .on('postgres_changes', { event: '*', schema: 'public', table: 'sop_masters' }, (payload) => {
       // Refresh daftar master jika status atau jadwal diedit admin lain
   })
   ```
2. **Audio & Toast Notification untuk Admin:**  
   Saat driver menyelesaikan SOP, admin yang sedang membuka layar SOP menerima feedback visual toast: *"SOP Selesai: [Nama Karyawan] telah menyelesaikan SOP!"* disertai nada notifikasi.

---

## 4. MATRIKS PERUBAHAN BERKAS

| No | Komponen | Berkas Target | Perubahan yang Diterapkan | Status |
| :--- | :--- | :--- | :--- | :--- |
| **1** | **Backend Broadcast Multi-User (`getActiveSopBroadcast`)** | `tb-delivery-pro/supabase-gas-adapter.js` | Memisahkan pengecekan `user_code`, `id_user`, `username`, UUID, dan normalisasi spasi nama, menjamin seluruh user terpilih menerima popup. | **SELESAI** |
| **2** | **Frontend Matcher Anti-UUID (`checkUserTargetMatch`)** | `tb-delivery-pro/index.html` | Mengisolasi parsing nomor driver hanya dari username/nama (bukan kode ID/UUID), menjamin driver 2, 3, dst menerima popup. | **SELESAI** |
| **3** | **WebSocket Realtime SOP Subscription (`initSupabaseRealtime`)** | `tb-delivery-pro/supabase-gas-adapter.js` | Mendaftarkan tabel `sop_execution_logs` dan `sop_masters` ke stream WebSocket Supabase untuk auto-update progres tanpa refresh. | **SELESAI** |
| **4** | **Reaktif Handler UI Daftar SOP** | `tb-delivery-pro/index.html` | Memasang fungsi pembaruan DOM in-place `handleRealtimeSopExecutionLogEvent` saat menerima event WebSocket dari `sop_execution_logs`. | **SELESAI** |
| **5** | **Cache Buster & Deploy Vercel** | Git Repo ➔ Vercel Production | Menaikkan versi script adapter ke `?v=6.8.0` dan menyebarkan ke produksi live (`https://tmr-app.vercel.app`). | **SELESAI** |

---

## 5. CHECKLIST PENGUJIAN & VERIFIKASI (VERIFIED)
- [x] Buat SOP baru dengan target 3 user: Staff Toko, Driver 1, dan Driver 2.
- [x] Buka akun Driver 1: Pop-up notifikasi SOP muncul presisi.
- [x] Buka akun Staff Toko: Pop-up notifikasi SOP muncul presisi.
- [x] Buka akun Driver 2: Pop-up notifikasi SOP muncul presisi (seluruh 3 user menerima notifikasi serentak).
- [x] Di HP Admin (Amir), buka tab "Daftar SOP": Kartu menampilkan `Penyelesaian: 0/3 User (0%)`.
- [x] Driver 1 menyelesaikan SOP di HP-nya:
  - [x] Tanpa admin merefresh browser (F5), badge di HP Admin langsung berubah menjadi `Penyelesaian: 1/3 User (33%)`.
  - [x] Kartu otomatis berpindah ke folder "Belum Selesai".
- [x] Driver 2 menyelesaikan SOP di HP-nya:
  - [x] Progres di HP Admin langsung naik realtime menjadi `Penyelesaian: 2/3 User (66%)`.
- [x] Staff Toko menyelesaikan SOP:
  - [x] Progres naik menjadi `Penyelesaian: 3/3 User (100%)`.
  - [x] Kartu otomatis berpindah ke folder "Selesai".
