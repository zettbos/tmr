# PANDUAN INTEGRASI HEADER: GOOGLE SPREADSHEET KE SUPABASE
Dibuat Otomatis oleh ZettBOT by Zettbos

Dokumen ini mencatat seluruh pemetaan kolom dari nama lembar kerja asli Excel/Google Sheets ke format baku Supabase (PostgreSQL `snake_case`).

## 📋 Sheet: `SOP_Master` $\rightarrow$ Tabel Supabase: `sop_masters`
- **Total Baris Data Riil:** 1 baris
- **File CSV Supabase:** `sop_masters.csv`
- **File CSV Standar Sheet:** `SOP_Master_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `id_sop` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `judul_sop` | **`title`** | Aman untuk SQL & PostgREST |
| 3 | `kategori` | **`category`** | Aman untuk SQL & PostgREST |
| 4 | `tingkat_kepentingan` | **`priority`** | Aman untuk SQL & PostgREST |
| 5 | `status` | **`status`** | Aman untuk SQL & PostgREST |
| 6 | `syarat_penyelesaian_json` | **`completion_criteria`** | Aman untuk SQL & PostgREST |
| 7 | `created_at` | **`created_at`** | Aman untuk SQL & PostgREST |
| 8 | `created_by` | **`created_by`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `SOP_Langkah` $\rightarrow$ Tabel Supabase: `sop_steps`
- **Total Baris Data Riil:** 7 baris
- **File CSV Supabase:** `sop_steps.csv`
- **File CSV Standar Sheet:** `SOP_Langkah_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `id_langkah` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `id_sop` | **`sop_id`** | Aman untuk SQL & PostgREST |
| 3 | `no_urut` | **`step_number`** | Aman untuk SQL & PostgREST |
| 4 | `nama_langkah` | **`step_title`** | Aman untuk SQL & PostgREST |
| 5 | `petunjuk_user` | **`user_instructions`** | Aman untuk SQL & PostgREST |
| 6 | `checklist_json` | **`checklist`** | Aman untuk SQL & PostgREST |
| 7 | `media_contoh_json` | **`media_examples`** | Aman untuk SQL & PostgREST |
| 8 | `aturan_json` | **`rules`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `SOP_Jadwal_Target` $\rightarrow$ Tabel Supabase: `sop_targets`
- **Total Baris Data Riil:** 2 baris
- **File CSV Supabase:** `sop_targets.csv`
- **File CSV Standar Sheet:** `SOP_Jadwal_Target_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `id_jadwal` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `id_sop` | **`sop_id`** | Aman untuk SQL & PostgREST |
| 3 | `tanggal_terbit` | **`start_date`** | Aman untuk SQL & PostgREST |
| 4 | `jam_terbit_json` | **`schedule_times`** | Aman untuk SQL & PostgREST |
| 5 | `is_recurring_daily` | **`is_recurring_daily`** | Aman untuk SQL & PostgREST |
| 6 | `target_roles_json` | **`target_roles`** | Aman untuk SQL & PostgREST |
| 7 | `target_users_json` | **`target_users`** | Aman untuk SQL & PostgREST |
| 8 | `is_notif_active` | **`is_notif_active`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `SOP_Log_Pelaksanaan` $\rightarrow$ Tabel Supabase: `sop_execution_logs`
- **Total Baris Data Riil:** 11 baris
- **File CSV Supabase:** `sop_execution_logs.csv`
- **File CSV Standar Sheet:** `SOP_Log_Pelaksanaan_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `id_log` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `id_sop` | **`sop_id`** | Aman untuk SQL & PostgREST |
| 3 | `username` | **`username`** | Aman untuk SQL & PostgREST |
| 4 | `nama_user` | **`full_name`** | Aman untuk SQL & PostgREST |
| 5 | `role` | **`role`** | Aman untuk SQL & PostgREST |
| 6 | `tanggal_tugas` | **`task_date`** | Aman untuk SQL & PostgREST |
| 7 | `jam_sesi` | **`time_session`** | Aman untuk SQL & PostgREST |
| 8 | `waktu_mulai` | **`started_at`** | Aman untuk SQL & PostgREST |
| 9 | `waktu_selesai` | **`completed_at`** | Aman untuk SQL & PostgREST |
| 10 | `status` | **`status`** | Aman untuk SQL & PostgREST |
| 11 | `checklist_hasil_json` | **`checklist_results`** | Aman untuk SQL & PostgREST |
| 12 | `foto_bukti_urls_json` | **`proof_photo_urls`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Riwayat Pajak` $\rightarrow$ Tabel Supabase: `tax_payment_logs`
- **Total Baris Data Riil:** 6 baris
- **File CSV Supabase:** `tax_payment_logs.csv`
- **File CSV Standar Sheet:** `Data_Riwayat_Pajak_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Transaksi` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `ID Kendaraan` | **`tax_id`** | Aman untuk SQL & PostgREST |
| 3 | `No Polisi` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 4 | `Nama Pemilik` | **`owner_name`** | Aman untuk SQL & PostgREST |
| 5 | `Jenis Pembayaran` | **`payment_type`** | Aman untuk SQL & PostgREST |
| 6 | `Tanggal Bayar` | **`payment_date`** | Aman untuk SQL & PostgREST |
| 7 | `Nominal Biaya` | **`amount`** | Aman untuk SQL & PostgREST |
| 8 | `URL Foto STNK Baru` | **`new_stnk_photo_url`** | Aman untuk SQL & PostgREST |
| 9 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 10 | `Admin Penginput` | **`admin_name`** | Aman untuk SQL & PostgREST |
| 11 | `Waktu Input` | **`created_at`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Pajak Kendaraan` $\rightarrow$ Tabel Supabase: `vehicle_taxes`
- **Total Baris Data Riil:** 7 baris
- **File CSV Supabase:** `vehicle_taxes.csv`
- **File CSV Standar Sheet:** `Data_Pajak_Kendaraan_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Kendaraan` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Jenis` | **`vehicle_type`** | Aman untuk SQL & PostgREST |
| 3 | `Nama Pemilik` | **`owner_name`** | Aman untuk SQL & PostgREST |
| 4 | `No Polisi` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 5 | `Merk` | **`brand`** | Aman untuk SQL & PostgREST |
| 6 | `Tipe Model` | **`model`** | Aman untuk SQL & PostgREST |
| 7 | `Tahun` | **`year`** | Aman untuk SQL & PostgREST |
| 8 | `Pajak 1 Tahun` | **`tax_1yr_date`** | Aman untuk SQL & PostgREST |
| 9 | `Pajak 5 Tahun` | **`tax_5yr_date`** | Aman untuk SQL & PostgREST |
| 10 | `KIR Mobil` | **`kir_date`** | Aman untuk SQL & PostgREST |
| 11 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 12 | `URL Foto STNK` | **`stnk_photo_url`** | Aman untuk SQL & PostgREST |
| 13 | `URL Foto QR Pertamina` | **`qr_pertamina_url`** | Aman untuk SQL & PostgREST |
| 14 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |
| 15 | `Status Aktif` | **`is_active`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Setting Pengingat Pajak` $\rightarrow$ Tabel Supabase: `tax_reminder_settings`
- **Total Baris Data Riil:** 9 baris
- **File CSV Supabase:** `tax_reminder_settings.csv`
- **File CSV Standar Sheet:** `Setting_Pengingat_Pajak_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `Key` | **`key`** | Aman untuk SQL & PostgREST |
| 2 | `Value` | **`value`** | Aman untuk SQL & PostgREST |
| 3 | `Keterangan` | **`description`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Auth_Tokens` $\rightarrow$ Tabel Supabase: `auth_tokens`
- **Total Baris Data Riil:** 506 baris
- **File CSV Supabase:** `auth_tokens.csv`
- **File CSV Standar Sheet:** `Auth_Tokens_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `Token` | **`token`** | Aman untuk SQL & PostgREST |
| 2 | `ID User` | **`user_code`** | Aman untuk SQL & PostgREST |
| 3 | `Username` | **`username`** | Aman untuk SQL & PostgREST |
| 4 | `Nama` | **`name`** | Aman untuk SQL & PostgREST |
| 5 | `Role` | **`role`** | Aman untuk SQL & PostgREST |
| 6 | `Created At` | **`created_at`** | Aman untuk SQL & PostgREST |
| 7 | `Expires At` | **`expires_at`** | Aman untuk SQL & PostgREST |
| 8 | `Status` | **`status`** | Aman untuk SQL & PostgREST |
| 9 | `Device Info` | **`device_info`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Servis Kendaraan` $\rightarrow$ Tabel Supabase: `vehicle_services`
- **Total Baris Data Riil:** 2 baris
- **File CSV Supabase:** `vehicle_services.csv`
- **File CSV Standar Sheet:** `Data_Servis_Kendaraan_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Servis` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal` | **`service_date`** | Aman untuk SQL & PostgREST |
| 3 | `No Plat` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 4 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 5 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 6 | `KM Saat Ini` | **`current_km`** | Aman untuk SQL & PostgREST |
| 7 | `Nama Bengkel` | **`workshop_name`** | Aman untuk SQL & PostgREST |
| 8 | `Biaya Perbaikan` | **`cost`** | Aman untuk SQL & PostgREST |
| 9 | `Catatan Perbaikan` | **`repair_details`** | Aman untuk SQL & PostgREST |
| 10 | `URL Foto Nota` | **`receipt_photo_url`** | Aman untuk SQL & PostgREST |
| 11 | `Waktu Input` | **`created_at`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Riwayat Oli` $\rightarrow$ Tabel Supabase: `oil_change_logs`
- **Total Baris Data Riil:** 1 baris
- **File CSV Supabase:** `oil_change_logs.csv`
- **File CSV Standar Sheet:** `Data_Riwayat_Oli_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Oli` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal` | **`service_date`** | Aman untuk SQL & PostgREST |
| 3 | `No Plat` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 4 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 5 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 6 | `KM Saat Ganti` | **`service_km`** | Aman untuk SQL & PostgREST |
| 7 | `Jenis Transaksi` | **`transaction_type`** | Aman untuk SQL & PostgREST |
| 8 | `Merek Oli` | **`oil_brand`** | Aman untuk SQL & PostgREST |
| 9 | `Jumlah Liter` | **`liters`** | Aman untuk SQL & PostgREST |
| 10 | `Total Biaya` | **`total_cost`** | Aman untuk SQL & PostgREST |
| 11 | `Nama Bengkel` | **`workshop_name`** | Aman untuk SQL & PostgREST |
| 12 | `URL Foto KM` | **`km_photo_url`** | Aman untuk SQL & PostgREST |
| 13 | `URL Foto Nota` | **`receipt_photo_url`** | Aman untuk SQL & PostgREST |
| 14 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 15 | `Waktu Input` | **`created_at`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Izin BBM` $\rightarrow$ Tabel Supabase: `fuel_approvals`
- **Total Baris Data Riil:** 31 baris
- **File CSV Supabase:** `fuel_approvals.csv`
- **File CSV Standar Sheet:** `Data_Izin_BBM_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Izin` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal Jam` | **`request_time`** | Aman untuk SQL & PostgREST |
| 3 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 4 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 5 | `No Plat` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 6 | `Status Izin` | **`status`** | Aman untuk SQL & PostgREST |
| 7 | `Ditanggapi Oleh` | **`responded_by`** | Aman untuk SQL & PostgREST |
| 8 | `Tanggal Respon` | **`responded_at`** | Aman untuk SQL & PostgREST |
| 9 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 10 | `Sudah Digunakan` | **`is_used`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Kendaraan` $\rightarrow$ Tabel Supabase: `vehicles`
- **Total Baris Data Riil:** 4 baris
- **File CSV Supabase:** `vehicles.csv`
- **File CSV Standar Sheet:** `Data_Kendaraan_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Kendaraan` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `No Plat` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 3 | `Jenis Mobil` | **`vehicle_type`** | Aman untuk SQL & PostgREST |
| 4 | `Sopir Default` | **`default_driver`** | Aman untuk SQL & PostgREST |
| 5 | `KM Terkini` | **`current_km`** | Aman untuk SQL & PostgREST |
| 6 | `Terakhir Isi BBM` | **`last_fuel_date`** | Aman untuk SQL & PostgREST |
| 7 | `Total Liter BBM` | **`total_fuel_liters`** | Aman untuk SQL & PostgREST |
| 8 | `KM Terakhir Ganti Oli` | **`last_oil_km`** | Aman untuk SQL & PostgREST |
| 9 | `Interval Ganti Oli` | **`oil_interval_km`** | Aman untuk SQL & PostgREST |
| 10 | `Status Oli` | **`oil_status`** | Aman untuk SQL & PostgREST |
| 11 | `Sisa KM Oli` | **`remaining_oil_km`** | Aman untuk SQL & PostgREST |
| 12 | `Foto Mobil` | **`photo_url`** | Aman untuk SQL & PostgREST |
| 13 | `Status Aktif` | **`status`** | Aman untuk SQL & PostgREST |
| 14 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Pengisian BBM` $\rightarrow$ Tabel Supabase: `fuel_logs`
- **Total Baris Data Riil:** 4 baris
- **File CSV Supabase:** `fuel_logs.csv`
- **File CSV Standar Sheet:** `Data_Pengisian_BBM_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID BBM` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal` | **`fuel_date`** | Aman untuk SQL & PostgREST |
| 3 | `No Plat` | **`plate_number`** | Aman untuk SQL & PostgREST |
| 4 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 5 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 6 | `KM Saat Ini` | **`current_km`** | Aman untuk SQL & PostgREST |
| 7 | `KM Sebelumnya` | **`prev_km`** | Aman untuk SQL & PostgREST |
| 8 | `Jarak Tempuh` | **`trip_distance`** | Aman untuk SQL & PostgREST |
| 9 | `Jumlah Liter` | **`liters`** | Aman untuk SQL & PostgREST |
| 10 | `Total Biaya` | **`total_cost`** | Aman untuk SQL & PostgREST |
| 11 | `Rata Rata Konsumsi` | **`efficiency_ratio`** | Aman untuk SQL & PostgREST |
| 12 | `Nama SPBU` | **`gas_station`** | Aman untuk SQL & PostgREST |
| 13 | `Jenis BBM` | **`fuel_type`** | Aman untuk SQL & PostgREST |
| 14 | `URL Foto KM` | **`km_photo_url`** | Aman untuk SQL & PostgREST |
| 15 | `URL Foto Struk` | **`receipt_photo_url`** | Aman untuk SQL & PostgREST |
| 16 | `URL Foto Muatan` | **`cargo_photo_url`** | Aman untuk SQL & PostgREST |
| 17 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 18 | `Waktu Input` | **`created_at`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Emergency Messages` $\rightarrow$ Tabel Supabase: `emergency_messages`
- **Total Baris Data Riil:** 0 baris
- **File CSV Supabase:** `emergency_messages.csv`
- **File CSV Standar Sheet:** `Emergency_Messages_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Pesan` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tipe Pesan` | **`type`** | Aman untuk SQL & PostgREST |
| 3 | `Penerima Role` | **`target_roles`** | Aman untuk SQL & PostgREST |
| 4 | `Target Users` | **`target_users`** | Aman untuk SQL & PostgREST |
| 5 | `Judul Pesan` | **`title`** | Aman untuk SQL & PostgREST |
| 6 | `Isi Pesan` | **`message`** | Aman untuk SQL & PostgREST |
| 7 | `Frekuensi` | **`frequency`** | Aman untuk SQL & PostgREST |
| 8 | `Jam Kirim List` | **`schedule_times`** | Aman untuk SQL & PostgREST |
| 9 | `Tanggal Kirim` | **`broadcast_date`** | Aman untuk SQL & PostgREST |
| 10 | `Jam Kirim` | **`broadcast_time`** | Aman untuk SQL & PostgREST |
| 11 | `Status Aktif` | **`is_active`** | Aman untuk SQL & PostgREST |
| 12 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |
| 13 | `Pembuat Pesan` | **`created_by`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Suplayer` $\rightarrow$ Tabel Supabase: `suppliers`
- **Total Baris Data Riil:** 5 baris
- **File CSV Supabase:** `suppliers.csv`
- **File CSV Standar Sheet:** `Data_Suplayer_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Suplayer` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Nama Suplayer` | **`name`** | Aman untuk SQL & PostgREST |
| 3 | `No Telp` | **`phone`** | Aman untuk SQL & PostgREST |
| 4 | `Alamat` | **`address`** | Aman untuk SQL & PostgREST |
| 5 | `Catatan` | **`notes`** | Aman untuk SQL & PostgREST |
| 6 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |
| 7 | `Dibuat Oleh` | **`created_by`** | Aman untuk SQL & PostgREST |
| 8 | `Kelompok Suplayer` | **`category`** | Aman untuk SQL & PostgREST |
| 9 | `Tempo Default (Hari)` | **`default_due_days`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Users` $\rightarrow$ Tabel Supabase: `profiles`
- **Total Baris Data Riil:** 13 baris
- **File CSV Supabase:** `profiles.csv`
- **File CSV Standar Sheet:** `Users_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID User` | **`user_code`** | Aman untuk SQL & PostgREST |
| 2 | `Nama Lengkap` | **`full_name`** | Aman untuk SQL & PostgREST |
| 3 | `Username` | **`username`** | Aman untuk SQL & PostgREST |
| 4 | `Password` | **`password`** | Aman untuk SQL & PostgREST |
| 5 | `Role / Jabatan` | **`role`** | Aman untuk SQL & PostgREST |
| 6 | `No HP` | **`phone`** | Aman untuk SQL & PostgREST |
| 7 | `Status Aktif` | **`is_active`** | Aman untuk SQL & PostgREST |
| 8 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |
| 9 | `Jam Masuk` | **`shift_start`** | Aman untuk SQL & PostgREST |
| 10 | `Jam Keluar` | **`shift_end`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Data Barang Datang` $\rightarrow$ Tabel Supabase: `incoming_goods`
- **Total Baris Data Riil:** 6 baris
- **File CSV Supabase:** `incoming_goods.csv`
- **File CSV Standar Sheet:** `Data_Barang_Datang_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Barang Datang` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `No Nota` | **`invoice_no`** | Aman untuk SQL & PostgREST |
| 3 | `Nama Suplayer` | **`supplier_name`** | Aman untuk SQL & PostgREST |
| 4 | `Tanggal Nota` | **`invoice_date`** | Aman untuk SQL & PostgREST |
| 5 | `Tanggal Terima` | **`received_date`** | Aman untuk SQL & PostgREST |
| 6 | `Foto Barang 1` | **`photo_1`** | Aman untuk SQL & PostgREST |
| 7 | `Foto Barang 2` | **`photo_2`** | Aman untuk SQL & PostgREST |
| 8 | `Foto Barang 3` | **`photo_3`** | Aman untuk SQL & PostgREST |
| 9 | `Foto Barang 4` | **`photo_4`** | Aman untuk SQL & PostgREST |
| 10 | `Foto Barang 5` | **`photo_5`** | Aman untuk SQL & PostgREST |
| 11 | `Catatan Barang` | **`items_summary`** | Aman untuk SQL & PostgREST |
| 12 | `Catatan Cacat` | **`damage_notes`** | Aman untuk SQL & PostgREST |
| 13 | `Total Nilai Uang` | **`total_amount`** | Aman untuk SQL & PostgREST |
| 14 | `Metode Pembayaran` | **`payment_method`** | Aman untuk SQL & PostgREST |
| 15 | `Nominal Cash` | **`cash_paid`** | Aman untuk SQL & PostgREST |
| 16 | `Foto Bukti Pembayaran` | **`payment_proof_url`** | Aman untuk SQL & PostgREST |
| 17 | `Tempo Hari` | **`due_days`** | Aman untuk SQL & PostgREST |
| 18 | `Tanggal Jatuh Tempo` | **`due_date`** | Aman untuk SQL & PostgREST |
| 19 | `Status Jatuh Tempo` | **`due_status`** | Aman untuk SQL & PostgREST |
| 20 | `Waktu Input` | **`created_at`** | Aman untuk SQL & PostgREST |
| 21 | `Dibuat Oleh` | **`created_by`** | Aman untuk SQL & PostgREST |
| 22 | `Role Pembuat` | **`role_creator`** | Aman untuk SQL & PostgREST |
| 23 | `Sudah Dibayar` | **`paid_amount`** | Aman untuk SQL & PostgREST |
| 24 | `Sisa Hutang` | **`remaining_debt`** | Aman untuk SQL & PostgREST |
| 25 | `Riwayat Pembayaran JSON` | **`payment_history`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Customers` $\rightarrow$ Tabel Supabase: `customers`
- **Total Baris Data Riil:** 15 baris
- **File CSV Supabase:** `customers.csv`
- **File CSV Standar Sheet:** `Customers_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Pelanggan` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Nama Pelanggan` | **`name`** | Aman untuk SQL & PostgREST |
| 3 | `No HP` | **`phone`** | Aman untuk SQL & PostgREST |
| 4 | `Alamat Lengkap` | **`address`** | Aman untuk SQL & PostgREST |
| 5 | `Link Google Maps` | **`maps_url`** | Aman untuk SQL & PostgREST |
| 6 | `Total Order` | **`total_orders`** | Aman untuk SQL & PostgREST |
| 7 | `Waktu Dibuat` | **`created_at`** | Aman untuk SQL & PostgREST |
| 8 | `Ongkir Standar` | **`standard_shipping_fee`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Orders` $\rightarrow$ Tabel Supabase: `orders`
- **Total Baris Data Riil:** 17 baris
- **File CSV Supabase:** `orders.csv`
- **File CSV Standar Sheet:** `Orders_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Order` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal Order` | **`order_date`** | Aman untuk SQL & PostgREST |
| 3 | `Tanggal Pengantaran` | **`delivery_date`** | Aman untuk SQL & PostgREST |
| 4 | `Urgent / Prioritas` | **`is_urgent`** | Aman untuk SQL & PostgREST |
| 5 | `ID Pelanggan` | **`customer_id`** | Aman untuk SQL & PostgREST |
| 6 | `Nama Pelanggan` | **`customer_name`** | Aman untuk SQL & PostgREST |
| 7 | `No HP Pelanggan` | **`customer_phone`** | Aman untuk SQL & PostgREST |
| 8 | `Alamat Lengkap` | **`customer_address`** | Aman untuk SQL & PostgREST |
| 9 | `Link Google Maps` | **`maps_url`** | Aman untuk SQL & PostgREST |
| 10 | `URL Foto Nota` | **`nota_photo_url`** | Aman untuk SQL & PostgREST |
| 11 | `Catatan Nota` | **`notes`** | Aman untuk SQL & PostgREST |
| 12 | `Detail Barang` | **`items_detail`** | Aman untuk SQL & PostgREST |
| 13 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 14 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 15 | `Status Verifikasi` | **`verification_status`** | Aman untuk SQL & PostgREST |
| 16 | `Status Pengiriman` | **`delivery_status`** | Aman untuk SQL & PostgREST |
| 17 | `Status Pembayaran` | **`payment_status`** | Aman untuk SQL & PostgREST |
| 18 | `URL Bukti 1` | **`proof_url_1`** | Aman untuk SQL & PostgREST |
| 19 | `URL Bukti 2` | **`proof_url_2`** | Aman untuk SQL & PostgREST |
| 20 | `URL Bukti 3` | **`proof_url_3`** | Aman untuk SQL & PostgREST |
| 21 | `URL Bukti 4` | **`proof_url_4`** | Aman untuk SQL & PostgREST |
| 22 | `URL Bukti 5` | **`proof_url_5`** | Aman untuk SQL & PostgREST |
| 23 | `Tanggal Selesai` | **`completed_at`** | Aman untuk SQL & PostgREST |
| 24 | `Catatan Pengiriman` | **`delivery_notes`** | Aman untuk SQL & PostgREST |
| 25 | `Nama Checker` | **`checker_name`** | Aman untuk SQL & PostgREST |
| 26 | `Pembuat Order` | **`created_by`** | Aman untuk SQL & PostgREST |
| 27 | `URL Bukti Transfer` | **`transfer_proof_url`** | Aman untuk SQL & PostgREST |
| 28 | `Biaya Ongkir` | **`shipping_cost`** | Aman untuk SQL & PostgREST |
| 29 | `Total Nilai Nota` | **`total_amount`** | Aman untuk SQL & PostgREST |
| 30 | `Petugas Pembayaran` | **`payment_collector`** | Aman untuk SQL & PostgREST |
| 31 | `URL Nota Tambahan` | **`additional_nota_url`** | Aman untuk SQL & PostgREST |
| 32 | `URL Foto Uang Lunas` | **`cash_proof_url`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Arsip Pesanan` $\rightarrow$ Tabel Supabase: `orders_archive`
- **Total Baris Data Riil:** 5 baris
- **File CSV Supabase:** `orders_archive.csv`
- **File CSV Standar Sheet:** `Arsip_Pesanan_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Order` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Tanggal Order` | **`order_date`** | Aman untuk SQL & PostgREST |
| 3 | `Tanggal Pengantaran` | **`delivery_date`** | Aman untuk SQL & PostgREST |
| 4 | `Urgent / Prioritas` | **`is_urgent`** | Aman untuk SQL & PostgREST |
| 5 | `ID Pelanggan` | **`customer_id`** | Aman untuk SQL & PostgREST |
| 6 | `Nama Pelanggan` | **`customer_name`** | Aman untuk SQL & PostgREST |
| 7 | `No HP Pelanggan` | **`customer_phone`** | Aman untuk SQL & PostgREST |
| 8 | `Alamat Lengkap` | **`customer_address`** | Aman untuk SQL & PostgREST |
| 9 | `Link Google Maps` | **`maps_url`** | Aman untuk SQL & PostgREST |
| 10 | `URL Foto Nota` | **`nota_photo_url`** | Aman untuk SQL & PostgREST |
| 11 | `Catatan Nota` | **`notes`** | Aman untuk SQL & PostgREST |
| 12 | `Detail Barang` | **`items_detail`** | Aman untuk SQL & PostgREST |
| 13 | `ID Sopir` | **`driver_id`** | Aman untuk SQL & PostgREST |
| 14 | `Nama Sopir` | **`driver_name`** | Aman untuk SQL & PostgREST |
| 15 | `Status Verifikasi` | **`verification_status`** | Aman untuk SQL & PostgREST |
| 16 | `Status Pengiriman` | **`delivery_status`** | Aman untuk SQL & PostgREST |
| 17 | `Status Pembayaran` | **`payment_status`** | Aman untuk SQL & PostgREST |
| 18 | `URL Bukti 1` | **`proof_url_1`** | Aman untuk SQL & PostgREST |
| 19 | `URL Bukti 2` | **`proof_url_2`** | Aman untuk SQL & PostgREST |
| 20 | `URL Bukti 3` | **`proof_url_3`** | Aman untuk SQL & PostgREST |
| 21 | `URL Bukti 4` | **`proof_url_4`** | Aman untuk SQL & PostgREST |
| 22 | `URL Bukti 5` | **`proof_url_5`** | Aman untuk SQL & PostgREST |
| 23 | `Tanggal Selesai` | **`completed_at`** | Aman untuk SQL & PostgREST |
| 24 | `Catatan Pengiriman` | **`delivery_notes`** | Aman untuk SQL & PostgREST |
| 25 | `Nama Checker` | **`checker_name`** | Aman untuk SQL & PostgREST |
| 26 | `Pembuat Order` | **`created_by`** | Aman untuk SQL & PostgREST |
| 27 | `URL Bukti Transfer` | **`transfer_proof_url`** | Aman untuk SQL & PostgREST |
| 28 | `Biaya Ongkir` | **`shipping_cost`** | Aman untuk SQL & PostgREST |
| 29 | `Total Nilai Nota` | **`total_amount`** | Aman untuk SQL & PostgREST |
| 30 | `Petugas Pembayaran` | **`payment_collector`** | Aman untuk SQL & PostgREST |
| 31 | `URL Nota Tambahan` | **`additional_nota_url`** | Aman untuk SQL & PostgREST |
| 32 | `URL Foto Uang Lunas` | **`cash_proof_url`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `ActivityLogs` $\rightarrow$ Tabel Supabase: `activity_logs`
- **Total Baris Data Riil:** 3020 baris
- **File CSV Supabase:** `activity_logs.csv`
- **File CSV Standar Sheet:** `ActivityLogs_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `ID Log` | **`id`** | Aman untuk SQL & PostgREST |
| 2 | `Waktu Timestamp` | **`timestamp`** | Aman untuk SQL & PostgREST |
| 3 | `ID User` | **`user_code`** | Aman untuk SQL & PostgREST |
| 4 | `Nama User` | **`user_name`** | Aman untuk SQL & PostgREST |
| 5 | `Role` | **`role`** | Aman untuk SQL & PostgREST |
| 6 | `Aktivitas` | **`action`** | Aman untuk SQL & PostgREST |
| 7 | `Detail Aktivitas` | **`details`** | Aman untuk SQL & PostgREST |

---

## 📋 Sheet: `Config` $\rightarrow$ Tabel Supabase: `system_configs`
- **Total Baris Data Riil:** 11 baris
- **File CSV Supabase:** `system_configs.csv`
- **File CSV Standar Sheet:** `Config_standard_gsheet.csv`

| No | Header Asli (Google Sheet / Excel) | Header Baru Supabase (snake_case) | Keterangan Standar |
|:--:|---|---|---|
| 1 | `Kunci` | **`key`** | Aman untuk SQL & PostgREST |
| 2 | `Nilai` | **`value`** | Aman untuk SQL & PostgREST |
| 3 | `Keterangan` | **`description`** | Aman untuk SQL & PostgREST |

---

