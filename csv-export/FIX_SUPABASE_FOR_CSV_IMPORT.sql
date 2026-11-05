-- ================================================================================
-- MASTER FIX & IMPORT COMPATIBILITY SCRIPT (SUPABASE POSTGRESQL)
-- TB DELIVERY PRO (TB TAMARA)
-- Dibuat oleh: ZettBOT by Zettbos
-- 
-- JALANKAN SCRIPT INI DI SUPABASE SQL EDITOR UNTUK MEMPERBAIKI SELURUH STRUKTUR TABEL
-- AGAR 100% SESUAI DENGAN DATA CSV HASIL EKSPOR EXCEL & SIAP DI-IMPORT TANPA ERROR!
-- ================================================================================

-- 1. FIX TABEL: activity_logs (Mengakomodasi id teks LOG-001 & user_code)
DROP TABLE IF EXISTS public.activity_logs CASCADE;
CREATE TABLE public.activity_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_code TEXT,
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details TEXT
);
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on activity_logs" ON public.activity_logs;
CREATE POLICY "Allow all on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

-- 2. FIX TABEL: profiles (Tambah kolom password untuk autentikasi)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;
DROP POLICY IF EXISTS "Allow all on profiles" ON public.profiles;
CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- 3. FIX TABEL: orders (Ubah driver_id ke TEXT & tambah kolom bukti foto 1..5)
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_driver_id_fkey;
ALTER TABLE public.orders ALTER COLUMN driver_id TYPE TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_1 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_2 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_3 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_4 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_5 TEXT;
DROP POLICY IF EXISTS "Allow all on orders" ON public.orders;
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);

-- 4. FIX TABEL: fuel_approvals, fuel_logs, oil_change_logs, vehicle_services (driver_id ke TEXT & is_used ke TEXT)
ALTER TABLE public.fuel_approvals DROP CONSTRAINT IF EXISTS fuel_approvals_driver_id_fkey;
ALTER TABLE public.fuel_approvals ALTER COLUMN driver_id TYPE TEXT;
ALTER TABLE public.fuel_approvals ALTER COLUMN is_used TYPE TEXT;
DROP POLICY IF EXISTS "Allow all on fuel_approvals" ON public.fuel_approvals;
CREATE POLICY "Allow all on fuel_approvals" ON public.fuel_approvals FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.fuel_logs DROP CONSTRAINT IF EXISTS fuel_logs_driver_id_fkey;
ALTER TABLE public.fuel_logs ALTER COLUMN driver_id TYPE TEXT;
DROP POLICY IF EXISTS "Allow all on fuel_logs" ON public.fuel_logs;
CREATE POLICY "Allow all on fuel_logs" ON public.fuel_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.oil_change_logs DROP CONSTRAINT IF EXISTS oil_change_logs_driver_id_fkey;
ALTER TABLE public.oil_change_logs ALTER COLUMN driver_id TYPE TEXT;
DROP POLICY IF EXISTS "Allow all on oil_change_logs" ON public.oil_change_logs;
CREATE POLICY "Allow all on oil_change_logs" ON public.oil_change_logs FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.vehicle_services DROP CONSTRAINT IF EXISTS vehicle_services_driver_id_fkey;
ALTER TABLE public.vehicle_services ALTER COLUMN driver_id TYPE TEXT;
DROP POLICY IF EXISTS "Allow all on vehicle_services" ON public.vehicle_services;
CREATE POLICY "Allow all on vehicle_services" ON public.vehicle_services FOR ALL USING (true) WITH CHECK (true);

-- 5. FIX TABEL: incoming_goods (Tambah kolom foto barang 1..5)
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_1 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_2 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_3 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_4 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_5 TEXT;
DROP POLICY IF EXISTS "Allow all on incoming_goods" ON public.incoming_goods;
CREATE POLICY "Allow all on incoming_goods" ON public.incoming_goods FOR ALL USING (true) WITH CHECK (true);

-- 6. BUAT TABEL TAMBAHAN UNTUK ARSIP DAN TOKEN
CREATE TABLE IF NOT EXISTS public.orders_archive (
    id TEXT PRIMARY KEY,
    order_date TIMESTAMPTZ,
    delivery_date DATE,
    is_urgent BOOLEAN DEFAULT false,
    customer_id TEXT,
    customer_name TEXT,
    customer_phone TEXT,
    customer_address TEXT,
    maps_url TEXT,
    nota_photo_url TEXT,
    notes TEXT,
    items_detail TEXT,
    driver_id TEXT,
    driver_name TEXT,
    verification_status TEXT,
    delivery_status TEXT,
    payment_status TEXT,
    proof_url_1 TEXT,
    proof_url_2 TEXT,
    proof_url_3 TEXT,
    proof_url_4 TEXT,
    proof_url_5 TEXT,
    completed_at TIMESTAMPTZ,
    delivery_notes TEXT,
    checker_name TEXT,
    created_by TEXT,
    transfer_proof_url TEXT,
    shipping_cost NUMERIC(12,2),
    total_amount NUMERIC(14,2),
    payment_collector TEXT,
    additional_nota_url TEXT,
    cash_proof_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on orders_archive" ON public.orders_archive;
CREATE POLICY "Allow all on orders_archive" ON public.orders_archive FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.auth_tokens (
    token TEXT PRIMARY KEY,
    user_code TEXT,
    username TEXT,
    name TEXT,
    role TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    status TEXT,
    device_info TEXT
);
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all on auth_tokens" ON public.auth_tokens;
CREATE POLICY "Allow all on auth_tokens" ON public.auth_tokens FOR ALL USING (true) WITH CHECK (true);

-- 7. PASTIKAN RLS PERMISSIVE UNTUK SELURUH TABEL IMPORT LAINNYA
DROP POLICY IF EXISTS "Allow all on customers" ON public.customers;
CREATE POLICY "Allow all on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on vehicles" ON public.vehicles;
CREATE POLICY "Allow all on vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on vehicle_taxes" ON public.vehicle_taxes;
CREATE POLICY "Allow all on vehicle_taxes" ON public.vehicle_taxes FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on tax_payment_logs" ON public.tax_payment_logs;
CREATE POLICY "Allow all on tax_payment_logs" ON public.tax_payment_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on tax_reminder_settings" ON public.tax_reminder_settings;
CREATE POLICY "Allow all on tax_reminder_settings" ON public.tax_reminder_settings FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on suppliers" ON public.suppliers;
CREATE POLICY "Allow all on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on sop_masters" ON public.sop_masters;
CREATE POLICY "Allow all on sop_masters" ON public.sop_masters FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on sop_steps" ON public.sop_steps;
CREATE POLICY "Allow all on sop_steps" ON public.sop_steps FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on sop_targets" ON public.sop_targets;
CREATE POLICY "Allow all on sop_targets" ON public.sop_targets FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on sop_execution_logs" ON public.sop_execution_logs;
CREATE POLICY "Allow all on sop_execution_logs" ON public.sop_execution_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on system_configs" ON public.system_configs;
CREATE POLICY "Allow all on system_configs" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all on emergency_messages" ON public.emergency_messages;
CREATE POLICY "Allow all on emergency_messages" ON public.emergency_messages FOR ALL USING (true) WITH CHECK (true);

-- SELESAI! STRUKTUR DATABASE 100% KOMPATIBEL DENGAN SELURUH CSV HASIL EKSPOR EXCEL!

