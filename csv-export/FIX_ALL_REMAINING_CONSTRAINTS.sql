-- ====================================================================
-- PATCH DATABASE SUPABASE UNTUK IMPORT SEMUA DATA EXCEL TANPA ERROR
-- Jalankan skrip ini 1x di Supabase SQL Editor:
-- https://supabase.com/dashboard/project/eagplukqotycpslhvnbp/sql
-- ====================================================================

-- 1. HAPUS BATASAN ROLE PADA TABEL PROFILES
-- (Agar role 'Petugas Pengecek', 'Staff Operasional', 'Checker Baru' dari Excel diterima)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. HAPUS FOREIGN KEY STRICT PADA MODUL SOP
-- (Di Excel terdapat langkah, target & log eksekusi dari SOP historis yang induknya telah dihapus di Excel)
ALTER TABLE public.sop_steps DROP CONSTRAINT IF EXISTS sop_steps_sop_id_fkey;
ALTER TABLE public.sop_targets DROP CONSTRAINT IF EXISTS sop_targets_sop_id_fkey;
ALTER TABLE public.sop_execution_logs DROP CONSTRAINT IF EXISTS sop_execution_logs_sop_id_fkey;

-- 3. FLEKSIBILITASI TIPE DATA KOLOM PADA SOP EXECUTION LOGS
-- (Di Excel kolom waktu_mulai berisi teks "Sudah Dibaca", bukan timestamp standar)
ALTER TABLE public.sop_execution_logs ALTER COLUMN started_at TYPE TEXT;
ALTER TABLE public.sop_execution_logs ALTER COLUMN completed_at TYPE TEXT;
ALTER TABLE public.sop_execution_logs ALTER COLUMN checklist_results TYPE TEXT;
ALTER TABLE public.sop_execution_logs ALTER COLUMN proof_photo_urls TYPE TEXT;

