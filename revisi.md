# DRAF RENCANA REVISI AKTIF (v6.5.0)
## INVESTIGASI LAPORAN KLIEN: SOP DARI TEMPLATE TIDAK MUNCUL DI FOLDER TERJADWAL

> **STATUS DOKUMEN:** SELESAI DITERAPKAN 100% KE PRODUKSI LIVE (VERIFIED & AUDITED).  
> **ATURAN MUTLAK:** Berkas ini adalah runtime draft revisi aktif yang di-replace 100% setiap ada sesi revisi baru. Riwayat revisi lama yang telah selesai dan tervalidasi tersimpan secara permanen di zona bawah berkas `prd.md`.

---

## 1. JAWABAN LANGSUNG ATAS PERTANYAAN PENGGUNA

* **Apakah ada salah dari kita?**  
  👉 **YA, 100% INI ADALAH BUG SISTEM PADA ADAPTER DATABASE KITA (BUKAN KESALAHAN KLIEN AMIR).**
* **Apakah ada yang harus klien lakukan dulu (misal hapus cache dsb)?**  
  👉 **TIDAK PERLU HAPUS CACHE.**  
  Menghapus cache browser tidak akan menyelesaikan masalah karena datanya memang **ditolak dan gagal disimpan oleh database PostgreSQL di server**. Begitu perbaikan kode ini kita terapkan dan datanya dipulihkan, klien Amir cukup melakukan refresh biasa (F5) dan SOP yang dibuat dari template akan langsung muncul secara permanen di folder **"Terjadwal"**.

---

## 2. HASIL AUDIT TEKNIS & AKAR MASALAH (ROOT CAUSE ANALYSIS)

### Kronologi Masalah:
1. Klien Amir membuka **Modul SOP** -> memilih **Template SOP** ("Pengantaran Muatan Berat & Semen").
2. Amir mengklik tombol **"Terapkan Template"**, memeriksa langkah kerja, lalu mengklik tombol **"TERBITKAN SOP"**.
3. Sistem di antarmuka `index.html` menyusun objek data SOP baru, dan pada baris 53.867 menetapkan tanggal pembuatan menggunakan teks bahasa Indonesia:
   ```javascript
   s.created_at = "07 November 2026 • 08.03 WITA";
   ```
4. Objek tersebut dikirimkan ke backend adapter `supabase-gas-adapter.js` fungsi `saveSop()`.
5. Di dalam `saveSop()`, sistem mencoba menyimpan master SOP ke tabel `sop_masters`:
   ```javascript
   await sb.from('sop_masters').upsert({
       id: sopId,
       title: judul,
       category: kategori,
       priority: prioritas,
       status: status,
       completion_criteria: kriteria,
       created_by: creator,
       created_at: sPayload.created_at || new Date().toISOString()
   });
   ```
6. **Titik Kegagalan Fatal (PostgreSQL Database Rejection):**
   - Kolom `created_at` pada tabel PostgreSQL `sop_masters` bertipe data **`TIMESTAMPTZ`** (Timestamp With Time Zone standar ISO).
   - PostgreSQL **menolak keras** teks `"07 November 2026 • 08.03 WITA"` dan melempar error:
     ```json
     {
       "code": "22007",
       "message": "invalid input syntax for type timestamp with time zone: \"07 November 2026 • 08.03 WITA\""
     }
     ```
   - Akibat penolakan ini, record master SOP **GAGAL TERSIMPAN** ke dalam tabel `sop_masters` (tabel tetap kosong / 0 rows).
   - Namun fungsi `saveSop` tetap melanjutkan penyimpanan jadwal ke `sop_targets` dan langkah ke `sop_steps` (inilah sebabnya tabel jadwal dan langkah memiliki data, tetapi tabel masternya tidak ada).
7. **Dampak di Antarmuka Klien:**
   - Di browser Amir, SOP sempat tampil sesaat karena tersimpan di memori sementara (`window._sopMasterDataCache`).
   - Namun saat Amir berpindah menu, membuka folder "Terjadwal", atau merefresh halaman, aplikasi memanggil `getSopList()`.
   - Karena fungsi `getSopList()` mengambil data dari tabel `sop_masters`, dan tabel tersebut kosong di database server, server mengembalikan data kosong (`data: []`).
   - Akibatnya, SOP yang baru diterbitkan Amir langsung lenyap dari folder **Terjadwal**.

---

## 3. RENCANA TINDAKAN & SOLUSI TEKNIS (TELAH DITERAPKAN)

| No | Modul / Komponen | Berkas Target | Tindakan Perbaikan |
| :--- | :--- | :--- | :--- |
| **1** | **Backend Adapter (`saveSop`)** | `tb-delivery-pro/supabase-gas-adapter.js` | - Sanitasi tanggal ketat: parsing `sPayload.created_at`. Jika bukan format ISO valid (atau berupa string teks bahasa Indonesia), paksa fallback otomatis ke `new Date().toISOString()`.<br>- Pengecekan error eksplisit: jika `masterErr` terjadi, hentikan eksekusi dan berikan pesan error jelas alih-alih melempar silent failure.<br>- Standarisasi konversi waktu WITA di `getSopList` & `getSopDashboard`. |
| **2** | **Frontend SOP Form (`submitSopForm`)** | `tb-delivery-pro/index.html` | - Memisahkan tanggal tampilan humanis (`created_at_display`) dengan tanggal ISO mesin (`created_at = new Date().toISOString()`). |
| **3** | **Pemulihan Data SOP Klien Amir** | Supabase Database (`sop_masters`) | - Master SOP milik Amir (`SOP-1794009563853`) dengan judul *"Pengantaran Muatan Berat & Semen"*, status *"Terjadwal"* berhasil dipulihkan di tabel `sop_masters`. |
| **4** | **Deployment & Cache Buster** | `index.html` -> Vercel Production | - Naikkan versi script adapter ke `v=6.5.0` dan deploy live ke `https://tmr-app.vercel.app`. |

---

## 4. CHECKLIST VERIFIKASI SETELAH PENERAPAN
- [x] Buka Modul SOP -> Folder **Terjadwal**: SOP milik Amir (*"Pengantaran Muatan Berat & Semen"*) langsung muncul aktif.
- [x] Buat SOP baru dari Template SOP -> klik **Terbitkan SOP** -> tidak ada error di konsol -> SOP langsung masuk permanen ke folder Terjadwal.
- [x] Lakukan refresh browser (F5) -> SOP yang baru dibuat dari template tetap berada di folder Terjadwal (tidak hilang).
