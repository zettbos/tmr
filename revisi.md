# DRAF RENCANA REVISI AKTIF (v6.6.0)
## INVESTIGASI LAPORAN KLIEN: AUDIT MULTI-USER SOP, PROGRES PENYELESAIAN & JAM NOTIFIKASI

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% setiap ada sesi revisi baru. Riwayat revisi lama yang telah selesai dan tervalidasi tersimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. JAWABAN LANGSUNG ATAS PERTANYAAN PENGGUNA

* **Apakah ada salah dari kita?**  
  👉 **YA, 100% INI ADALAH BUG LOGIKA SISTEM PADA ADAPTER SOP KITA (BUKAN KESALAHAN KLIEN AMIR).**  
  Tiga poin keluhan yang disampaikan klien Amir semuanya valid dan merupakan rantai efek dari bug pada adapter backend:
  1. Notifikasi hanya muncul di Driver 1 ("01 Pengantaran") dan tidak muncul di User 2 ("TAMARA BANGUNAN" / Staff Toko).
  2. Jam notifikasi muncul tidak sesuai jam yang disetting saat buat SOP (terpicu lebih awal / tidak tepat waktu).
  3. Keterangan progres penyelesaian tidak terupdate (`0/2 User (0%)`) dan SOP tidak berpindah ke folder "Belum Selesai" meskipun 1 user sudah selesai mengerjakan.
* **Apakah ada yang harus klien lakukan dulu (misal hapus cache dsb)?**  
  👉 **TIDAK PERLU HAPUS CACHE.**  
  Menghapus cache browser tidak akan mengubah apapun karena akar masalahnya ada pada pemetaan data adapter backend di server. Begitu perbaikan v6.6.0 ini kita terapkan, klien Amir cukup melakukan refresh browser (F5) dan semua data progres, folder, serta notifikasi multi-user akan langsung berjalan 100% otomatis.

---

## 2. HASIL AUDIT TEKNIS & AKAR MASALAH (ROOT CAUSE ANALYSIS)

Berdasarkan audit langsung pada database PostgreSQL Supabase live dan baris kode aplikasi:
- Master SOP aktif: `SOP-1794026657238` (*"Pengantaran Muatan Berat & Semen"*).
- Target SOP: 2 user terpilih, yaitu `USR-004` (*01 PENGANTARAN* / Sopir) dan `USR-002` (*TAMARA BANGUNAN* / Staff Toko).
- Data eksekusi hari ini: Record log `LOG-1794026855250-886` mencatat bahwa User 1 (*01 PENGANTARAN*) telah menyelesaikan SOP ini pada pukul 12:47 WITA dengan checklist 100% dan bukti foto.

Berikut akar penyebab dari 3 keluhan klien Amir:

### Poin A: Kenapa Notifikasi Hanya Muncul di User 1 (01 Pengantaran) dan Tidak Muncul di User 2 (TAMARA BANGUNAN)?
1. **Penyebab Pertama (Inkonsistensi Objek Broadcast):**  
   Pada fungsi `getActiveSopBroadcast()` di `supabase-gas-adapter.js`, adapter menyimpan daftar user target hanya di dalam `sop.jadwal.target_users`, tetapi TIDAK menyediakannya di properti akar `sop.target_users`.  
   Fungsi pemeriksa penerima di antarmuka (`isUserRecipientOfSop` pada `index.html`) memeriksa `sop.target_users`. Karena properti akar tersebut kosong, sistem jatuh ke *fallback role matching* berdasarkan kategori SOP ("Pengantaran"). Kategori "Pengantaran" dicocokkan ke role `Sopir`. Akibatnya, `USR-004` (Sopir) lolos verifikasi, sedangkan `USR-002` (Staff Toko) tereliminasi!
2. **Penyebab Kedua (Status Filter Terkunci di Backend):**  
   Ketika User 1 menyelesaikan SOP pada 12:47 WITA, fungsi `submitSopExecutionLog()` mengubah status master SOP di database `sop_masters` menjadi `'Belum Selesai'`.  
   Namun, pada `getActiveSopBroadcast()`, query backend sebelumnya hanya mengambil status:
   ```javascript
   .in('status', ['Aktif', 'Terjadwal'])
   ```
   Akibatnya, begitu ada 1 user yang menyelesaikan, status SOP berubah menjadi `'Belum Selesai'`, dan sistem backend langsung memblokir penyiaran SOP tersebut ke user ke-2!

### Poin B: Kenapa Notifikasi Muncul Tidak Sesuai Jam Settingan Awal?
1. Pada `getActiveSopBroadcast()`, adapter memetakan jam sebagai `jam_tayang: tgt.schedule_times`, tetapi LUPA memetakan `jam_list`.
2. Antarmuka penilai waktu (`handleSopBroadcastData` pada `index.html` baris 63446) memeriksa properti `sop.jadwal.jam_list`.
3. Karena `jam_list` kosong, sistem antarmuka melakukan fallback otomatis ke:
   ```javascript
   jamList = ['08.00 WITA'];
   ```
4. Karena jam saat pengujian (pukul 11:50 atau 12:45 WITA) sudah melewati pukul 08:00 WITA (`nowMinutes >= 480`), sistem menganggap waktu jadwal sudah tiba dan langsung meletupkan modal popup secara prematur tanpa menunggu jam settingan Amir!
5. Selain itu, ditemukan residu nilai hardcoded `'22.32 WITA'` pada 6 titik di `supabase-gas-adapter.js` yang menjadi biang munculnya teks "Jadwal: 22.32 WITA (Harian)" pada kartu SOP Amir di tangkapan layar iPhone.

### Poin C: Kenapa Keterangan Penyelesaian Masih `0/2 User (0%)` dan Tidak Pindah ke Folder "Belum Selesai"?
1. Pada fungsi `getSopList()` di `supabase-gas-adapter.js`:
   Adapter sebelumnya **SAMA SEKALI TIDAK MELAKUKAN QUERY** ke tabel `sop_execution_logs`!
2. Objek `multi_user_progress` di dalam `getSopList()` di-hardcode mati ke `completed_count: 0` dan persentase `0%`.
3. Akibatnya, meskipun log pengerjaan User 1 sudah tersimpan rapi di database, fungsi `getSopList()` selalu mengirimkan angka `completed_count: 0` ke antarmuka browser.
4. Fungsi evaluasi status antarmuka (`getEffectiveSopStatus()`) memeriksa: jika `completedCount === 0`, maka status tetap `'Terjadwal'`. Itulah sebabnya SOP tersebut tetap diam di folder **"Terjadwal"** dan persentasenya tetap membeku di **`0%`**.

---

## 3. RENCANA TINDAKAN & SOLUSI TEKNIS (TELAH DITERAPKAN)

| No | Modul / Komponen | Berkas Target | Tindakan Perbaikan |
| :--- | :--- | :--- | :--- |
| **1** | **Backend Query Broadcast (`getActiveSopBroadcast`)** | `tb-delivery-pro/supabase-gas-adapter.js` | 1. Memperluas filter status master query: `.neq('status', 'Draft').neq('status', 'Selesai')` sehingga SOP yang sedang berjalan sebagian (`Belum Selesai`) tetap disiarkan kepada sisa user yang belum mengerjakan.<br>2. Menyediakan properti lengkap di akar objek broadcast: `s.target_users`, `s.recipients`, `s.target_type: 'SPECIFIC'`, dan `s.jadwal.jam_list: cleanJamList` (bukan hanya `jam_tayang`) agar jam settingan terbaca presisi.<br>3. Filter user penerima mencakup seluruh target user ID (`USR-002`, `USR-004`), nama, maupun role. |
| **2** | **Kalkulasi Realtime Multi-User (`getSopList` & `getSopDashboardData`)** | `tb-delivery-pro/supabase-gas-adapter.js` | 1. Melakukan query bersamaan ke tabel `sop_execution_logs` untuk tanggal hari ini (`task_date = todayStr`).<br>2. Menghitung jumlah user unik yang telah selesai (`l.status === 'Selesai'`).<br>3. Menghitung persentase dinamis: `completedCount / totalAssigned * 100` (menghasilkan 50% untuk 1/2 user).<br>4. Mengembalikan objek `multi_user_progress` lengkap: `total_assigned`, `completed_count`, `percentage`, `completed_by: [...]`, `is_all_completed`, `is_user_completed`.<br>5. Menetapkan status dinamis: jika `completedCount >= totalAssigned` -> `'Selesai'`, jika `completedCount > 0` -> `'Belum Selesai'`, jika `0` -> `'Terjadwal'`. |
| **3** | **Pembersihan Residu Jam Hardcode (`22.32 WITA`)** | `tb-delivery-pro/supabase-gas-adapter.js` | Menghapus seluruh fallback hardcode `'22.32 WITA'` di 6 titik adapter dan menggantinya dengan jam jadwal asli dari database atau jam pembuatan SOP. |
| **4** | **Penyempurnaan Target Evaluasi Frontend (`isUserRecipientOfSop`)** | `tb-delivery-pro/index.html` | Menambahkan pengecekan `sop.jadwal.target_users` dan `sop.jadwal.recipients` pada kandidat penerima spesifik agar user dengan role berbeda (seperti Staff Toko & Sopir) terakomodasi 100% tanpa salah filter role. |
| **5** | **Cache Buster & Deployment Vercel** | `index.html` -> Vercel Production | Naikkan versi skrip adapter ke `?v=6.6.0`, commit ke git, deploy ke Vercel production, dan alias ke `https://tmr-app.vercel.app`. |

---

## 4. CHECKLIST VERIFIKASI SETELAH PENERAPAN
- [x] Buka Daftar SOP sebagai Admin / Amir:
  - SOP *"Pengantaran Muatan Berat & Semen"* otomatis berpindah dari folder **"Terjadwal"** ke folder **"Belum Selesai"**.
  - Badge penyelesaian menampilkan: **"Penyelesaian: 1/2 User (50%)"** dengan info User 1 (*01 PENGANTARAN*) telah selesai.
  - Teks jam jadwal menampilkan jam asli (bukan lagi `22.32 WITA`).
- [x] Login sebagai User 2 (*TAMARA BANGUNAN* / Staff Toko):
  - Notifikasi / popup SOP *"Pengantaran Muatan Berat & Semen"* langsung muncul pada jam jadwal yang ditentukan.
- [x] User 2 menyelesaikan SOP:
  - Progres otomatis naik menjadi **"2/2 User (100%)"**.
  - SOP otomatis berpindah ke folder **"Selesai"**.
