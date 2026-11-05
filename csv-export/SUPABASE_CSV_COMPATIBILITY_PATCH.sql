-- ================================================================================
-- PATCH SQL KOMPATIBILITAS IMPORT CSV SPREADSHEET
-- TB DELIVERY PRO (TB TAMARA)
-- Jalankan query ini di SQL Editor Supabase jika Anda sudah menjalankan schema sebelumnya.
-- ================================================================================

-- 1. Tambahkan kolom password di profiles agar login adapter bekerja instan dari data CSV
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- 2. Tambahkan kolom individual bukti foto pengantaran di orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_1 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_2 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_3 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_4 TEXT;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS proof_url_5 TEXT;

-- 3. Tambahkan kolom individual foto barang datang di incoming_goods
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_1 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_2 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_3 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_4 TEXT;
ALTER TABLE public.incoming_goods ADD COLUMN IF NOT EXISTS photo_5 TEXT;

-- 4. Buat tabel orders_archive (jika ingin arsip di tabel terpisah seperti di spreadsheet)
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

-- 5. Buat tabel auth_tokens (jika ingin mengimpor histori sesi token lama dari spreadsheet)
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

-- Beri akses RLS untuk tabel tambahan
ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow read orders_archive" ON public.orders_archive FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow read auth_tokens" ON public.auth_tokens FOR SELECT TO authenticated USING (true);

