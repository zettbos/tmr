-- ================================================================================
-- MASTER DATABASE SCHEMA: TB DELIVERY PRO (TB TAMARA) - POSTGRESQL (SUPABASE)
-- DIBUAT OLEH: ZettBOT by Zettbos
-- VERSI: 1.1.0 (Production & CSV Import Ready)
-- TANGGAL: 5 November 2026
-- ================================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. PROFIL PENGGUNA (PROFILES)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    user_code TEXT UNIQUE NOT NULL, -- USR-001
    full_name TEXT NOT NULL,
    username TEXT UNIQUE NOT NULL,
    password TEXT,
    role TEXT NOT NULL,
    phone TEXT,
    is_active BOOLEAN DEFAULT true,
    shift_start TIME,
    shift_end TIME,
    address TEXT,
    ktp_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. LOG AKTIVITAS (ACTIVITY_LOGS)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id TEXT PRIMARY KEY, -- LOG-001, LOG-1785569209924
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    user_code TEXT,
    user_name TEXT,
    role TEXT,
    action TEXT NOT NULL,
    details TEXT
);

-- 3. PENGATURAN & EMERGENCY
CREATE TABLE IF NOT EXISTS public.system_configs (
    key TEXT PRIMARY KEY,
    value TEXT,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.emergency_messages (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL DEFAULT 'Info Penting',
    target_roles TEXT[] DEFAULT '{}',
    target_users TEXT[] DEFAULT '{}',
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    frequency TEXT DEFAULT 'Sekali Saja',
    schedule_times TEXT[] DEFAULT '{}',
    broadcast_date DATE DEFAULT CURRENT_DATE,
    broadcast_time TIME,
    is_active BOOLEAN DEFAULT true,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id TEXT PRIMARY KEY, -- CUST-0001
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    maps_url TEXT,
    total_orders INTEGER DEFAULT 0,
    standard_shipping_fee NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. ORDERS & ARSIP
CREATE TABLE IF NOT EXISTS public.orders (
    id TEXT PRIMARY KEY, -- TMR-MMDD-XXXX
    order_date TIMESTAMPTZ DEFAULT NOW(),
    delivery_date DATE,
    is_urgent BOOLEAN DEFAULT false,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_address TEXT,
    maps_url TEXT,
    nota_photo_url TEXT,
    notes TEXT,
    items_detail TEXT,
    driver_id TEXT,
    driver_name TEXT DEFAULT '',
    verification_status TEXT DEFAULT 'Belum di Cek',
    delivery_status TEXT DEFAULT 'Menunggu',
    payment_status TEXT DEFAULT 'Belum Bayar',
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
    shipping_cost NUMERIC(12,2) DEFAULT 0,
    total_amount NUMERIC(14,2) DEFAULT 0,
    payment_collector TEXT,
    additional_nota_url TEXT,
    cash_proof_url TEXT,
    unpaid_amount NUMERIC(14,2) DEFAULT 0,
    helper_name TEXT,
    shipping_type TEXT DEFAULT 'Dikirim',
    cargo_photo_url TEXT,
    is_archived BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 6. SUPPLIERS & INCOMING GOODS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    category TEXT,
    phone TEXT,
    address TEXT,
    default_due_days INTEGER DEFAULT 0,
    notes TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.incoming_goods (
    id TEXT PRIMARY KEY,
    invoice_no TEXT,
    supplier_id TEXT,
    supplier_name TEXT NOT NULL,
    invoice_date DATE,
    received_date DATE DEFAULT CURRENT_DATE,
    photo_1 TEXT,
    photo_2 TEXT,
    photo_3 TEXT,
    photo_4 TEXT,
    photo_5 TEXT,
    items_summary TEXT,
    damage_notes TEXT,
    total_amount NUMERIC(14,2) DEFAULT 0,
    payment_method TEXT DEFAULT 'Tempo / Hutang',
    cash_paid NUMERIC(14,2) DEFAULT 0,
    payment_proof_url TEXT,
    due_days INTEGER DEFAULT 0,
    due_date DATE,
    due_status TEXT DEFAULT 'Aman',
    paid_amount NUMERIC(14,2) DEFAULT 0,
    remaining_debt NUMERIC(14,2) DEFAULT 0,
    payment_history JSONB DEFAULT '[]'::jsonb,
    created_by TEXT,
    role_creator TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. VEHICLES & FUEL
CREATE TABLE IF NOT EXISTS public.vehicles (
    id TEXT PRIMARY KEY,
    plate_number TEXT UNIQUE NOT NULL,
    vehicle_type TEXT NOT NULL,
    default_driver TEXT,
    current_km INTEGER DEFAULT 0,
    last_fuel_date DATE,
    total_fuel_liters NUMERIC(10,2) DEFAULT 0,
    last_oil_km INTEGER DEFAULT 0,
    oil_interval_km INTEGER DEFAULT 5000,
    oil_status TEXT DEFAULT 'Oli Aman',
    remaining_oil_km INTEGER DEFAULT 5000,
    photo_url TEXT,
    status TEXT DEFAULT 'Aktif',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.fuel_approvals (
    id TEXT PRIMARY KEY,
    request_time TIMESTAMPTZ DEFAULT NOW(),
    driver_id TEXT,
    driver_name TEXT NOT NULL,
    plate_number TEXT NOT NULL,
    status TEXT DEFAULT 'Menunggu Approval',
    responded_by TEXT,
    responded_at TIMESTAMPTZ,
    notes TEXT,
    is_used TEXT DEFAULT 'Belum'
);

CREATE TABLE IF NOT EXISTS public.fuel_logs (
    id TEXT PRIMARY KEY,
    fuel_date DATE DEFAULT CURRENT_DATE,
    plate_number TEXT NOT NULL,
    driver_id TEXT,
    driver_name TEXT NOT NULL,
    current_km INTEGER NOT NULL,
    prev_km INTEGER DEFAULT 0,
    trip_distance INTEGER DEFAULT 0,
    liters NUMERIC(10,2) NOT NULL,
    total_cost NUMERIC(12,2) NOT NULL,
    efficiency_ratio NUMERIC(10,2) DEFAULT 0,
    gas_station TEXT,
    fuel_type TEXT DEFAULT 'Solar',
    km_photo_url TEXT,
    receipt_photo_url TEXT,
    cargo_photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oil_change_logs (
    id TEXT PRIMARY KEY,
    service_date DATE DEFAULT CURRENT_DATE,
    plate_number TEXT NOT NULL,
    driver_id TEXT,
    driver_name TEXT NOT NULL,
    service_km INTEGER NOT NULL,
    transaction_type TEXT DEFAULT 'Ganti Oli Rutin',
    oil_brand TEXT,
    liters NUMERIC(10,2) DEFAULT 0,
    total_cost NUMERIC(12,2) DEFAULT 0,
    workshop_name TEXT,
    km_photo_url TEXT,
    receipt_photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.vehicle_services (
    id TEXT PRIMARY KEY,
    service_date DATE DEFAULT CURRENT_DATE,
    plate_number TEXT NOT NULL,
    driver_id TEXT,
    driver_name TEXT NOT NULL,
    current_km INTEGER DEFAULT 0,
    workshop_name TEXT NOT NULL,
    cost NUMERIC(12,2) DEFAULT 0,
    repair_details TEXT,
    receipt_photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TAXES
CREATE TABLE IF NOT EXISTS public.vehicle_taxes (
    id TEXT PRIMARY KEY,
    vehicle_type TEXT DEFAULT 'Mobil',
    owner_name TEXT NOT NULL,
    plate_number TEXT UNIQUE NOT NULL,
    brand TEXT,
    model TEXT,
    year TEXT,
    tax_1yr_date DATE,
    tax_5yr_date DATE,
    kir_date DATE,
    notes TEXT,
    stnk_photo_url TEXT,
    qr_pertamina_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_payment_logs (
    id TEXT PRIMARY KEY,
    tax_id TEXT REFERENCES public.vehicle_taxes(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    owner_name TEXT,
    payment_type TEXT NOT NULL,
    payment_date DATE DEFAULT CURRENT_DATE,
    amount NUMERIC(12,2) DEFAULT 0,
    new_stnk_photo_url TEXT,
    notes TEXT,
    admin_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_reminder_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT
);

-- 9. SOP HARIAN
CREATE TABLE IF NOT EXISTS public.sop_masters (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'Sedang',
    status TEXT NOT NULL DEFAULT 'Draf',
    completion_criteria JSONB DEFAULT '{}'::jsonb,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sop_steps (
    id TEXT PRIMARY KEY,
    sop_id TEXT REFERENCES public.sop_masters(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    step_title TEXT NOT NULL,
    user_instructions TEXT,
    checklist JSONB DEFAULT '[]'::jsonb,
    media_examples JSONB DEFAULT '[]'::jsonb,
    rules JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS public.sop_targets (
    id TEXT PRIMARY KEY,
    sop_id TEXT REFERENCES public.sop_masters(id) ON DELETE CASCADE,
    start_date DATE DEFAULT CURRENT_DATE,
    schedule_times TEXT[] DEFAULT '{}',
    is_recurring_daily BOOLEAN DEFAULT false,
    target_roles TEXT[] DEFAULT '{}',
    target_users TEXT[] DEFAULT '{}',
    is_notif_active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.sop_execution_logs (
    id TEXT PRIMARY KEY,
    sop_id TEXT REFERENCES public.sop_masters(id) ON DELETE CASCADE,
    user_id TEXT,
    username TEXT NOT NULL,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL,
    task_date DATE DEFAULT CURRENT_DATE,
    time_session TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'Selesai Tepat Waktu',
    checklist_results JSONB DEFAULT '[]'::jsonb,
    proof_photo_urls TEXT[] DEFAULT '{}'
);

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

-- TRIGGER ATOMIK ORDER ID
CREATE OR REPLACE FUNCTION public.fn_generate_order_id()
RETURNS TRIGGER AS $$
DECLARE
    today_prefix TEXT;
    next_num INTEGER;
BEGIN
    today_prefix := 'TMR-' || to_char((NOW() AT TIME ZONE 'Asia/Makassar'), 'MMDD') || '-';
    SELECT COALESCE(MAX(SUBSTRING(id FROM 10 FOR 4)::INTEGER), 0) + 1
    INTO next_num
    FROM public.orders
    WHERE id LIKE today_prefix || '%';

    NEW.id := today_prefix || LPAD(next_num::TEXT, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_order_id_generator ON public.orders;
CREATE TRIGGER trg_order_id_generator
BEFORE INSERT ON public.orders
FOR EACH ROW
WHEN (NEW.id IS NULL OR NEW.id = '')
EXECUTE FUNCTION public.fn_generate_order_id();

-- RLS UNIVERSAL
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuel_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oil_change_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_masters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sop_execution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emergency_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incoming_goods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders_archive" ON public.orders_archive FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vehicles" ON public.vehicles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fuel_approvals" ON public.fuel_approvals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on fuel_logs" ON public.fuel_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on oil_change_logs" ON public.oil_change_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vehicle_services" ON public.vehicle_services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on vehicle_taxes" ON public.vehicle_taxes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tax_payment_logs" ON public.tax_payment_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on tax_reminder_settings" ON public.tax_reminder_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on incoming_goods" ON public.incoming_goods FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on system_configs" ON public.system_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on emergency_messages" ON public.emergency_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sop_masters" ON public.sop_masters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sop_steps" ON public.sop_steps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sop_targets" ON public.sop_targets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on sop_execution_logs" ON public.sop_execution_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on auth_tokens" ON public.auth_tokens FOR ALL USING (true) WITH CHECK (true);
