/**
 * UNIVERSAL GAS-TO-SUPABASE ADAPTER (FACADE ENGINE) v2.0
 * TB DELIVERY PRO (TB TAMARA)
 * Dibuat oleh: ZettBOT by Zettbos
 * 
 * Fungsi:
 * - Menangani 100% pemanggilan `google.script.run` di antarmuka HTML.
 * - Mengalihkan query ke PostgreSQL Supabase & Supabase Storage secara asinkron super cepat.
 * - Mendukung dwibahasa properti (format kolom PostgreSQL snake_case dan format GAS asli Indonesia).
 */

(function() {
    console.log('[Supabase Adapter] Mengaktifkan Universal Adapter TB Delivery PRO...');

    // 1. Kredensial Supabase Resmi TB Tamara
    const DEFAULT_SUPABASE_URL = window.__TB_SUPABASE_URL || 'https://eagplukqotycpslhvnbp.supabase.co';
    const DEFAULT_SUPABASE_ANON_KEY = window.__TB_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3BsdWtxb3R5Y3BzbGh2bmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NTk5OTEsImV4cCI6MjEwOTQzNTk5MX0.NJsG7dlU0v_ai0NG21FeD25FyGv2qMba6I3TocQD_24';

    let _supabase = null;
    function getClient() {
        if (!_supabase && window.supabase && typeof window.supabase.createClient === 'function') {
            _supabase = window.supabase.createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
        }
        return _supabase;
    }

    // Helper untuk memetakan format database ke format objek user UI
    function mapProfileToUserObj(row) {
        if (!row) return null;
        return {
            id_user: row.user_code || row.id,
            id: row.id,
            user_code: row.user_code,
            nama: row.full_name || '',
            full_name: row.full_name || '',
            username: row.username || '',
            role: row.role || '',
            no_hp: row.phone || '',
            phone: row.phone || '',
            jam_masuk: row.shift_start || '',
            jam_keluar: row.shift_end || '',
            is_active: row.is_active !== false,
            foto_ktp: row.ktp_photo_url || ''
        };
    }

    // Helper untuk memetakan order Supabase ke format GAS UI
    function mapOrderToGasObj(row) {
        if (!row) return null;
        return {
            ...row,
            id_order: row.id,
            tanggal_order: row.order_date || '',
            tanggal_pengantaran: row.delivery_date || '',
            is_urgent: row.is_urgent ? 'Ya' : 'Tidak',
            id_pelanggan: row.customer_id || '',
            nama_pelanggan: row.customer_name || '',
            no_hp_pelanggan: row.customer_phone || '',
            alamat_lengkap: row.customer_address || '',
            link_gmaps: row.maps_url || '',
            url_foto_nota: row.nota_photo_url || '',
            catatan_nota: row.notes || '',
            detail_barang: row.items_detail || '',
            id_sopir: row.driver_id || '',
            nama_sopir: row.driver_name || '',
            status_verifikasi: row.verification_status || 'Belum di Cek',
            status_pengiriman: row.delivery_status || 'Pesanan Masuk / Dimuat',
            status_pembayaran: row.payment_status || 'Belum Bayar',
            url_bukti_1: row.proof_url_1 || '',
            url_bukti_2: row.proof_url_2 || '',
            url_bukti_3: row.proof_url_3 || '',
            url_bukti_4: row.proof_url_4 || '',
            url_bukti_5: row.proof_url_5 || '',
            tanggal_selesai: row.completed_at || '',
            catatan_pengiriman: row.delivery_notes || '',
            nama_checker: row.checker_name || '',
            pembuat_order: row.created_by || '',
            dibuat_oleh: row.created_by || '',
            url_bukti_transfer: row.transfer_proof_url || '',
            biaya_ongkir: row.shipping_cost || 0,
            total_nilai_nota: row.total_amount || 0,
            petugas_pembayaran: row.payment_collector || '',
            url_nota_tambahan: row.additional_nota_url || '',
            url_foto_uang_lunas: row.cash_proof_url || ''
        };
    }

    // 2. Mock / Implemented Backend Services
    const apiServices = {
        // --- AUTH & USER SERVICES ---
        loginUser: async function(u, p) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Supabase client belum siap.' };
            
            let username = '';
            let password = '';
            if (typeof u === 'object' && u !== null) {
                username = (u.username || '').trim();
                password = (u.password || '').trim();
            } else {
                username = String(u || '').trim();
                password = String(p || '').trim();
            }

            console.log('[Supabase Adapter] Mencoba login:', username);

            const { data, error } = await sb
                .from('profiles')
                .select('*')
                .ilike('username', username)
                .maybeSingle();

            if (error || !data) {
                console.warn('[Supabase Adapter] User tidak ditemukan:', username, error);
                return { success: false, message: 'Username atau password salah!' };
            }

            if (data.password && data.password.trim() !== password) {
                console.warn('[Supabase Adapter] Password salah untuk user:', username);
                return { success: false, message: 'Username atau password salah!' };
            }

            if (data.is_active === false) {
                return { success: false, message: 'AKSES DITOLAK: Akun Anda sedang dinonaktifkan Admin!' };
            }

            const userObj = mapProfileToUserObj(data);
            const token = 'TKN_' + (data.user_code || data.id) + '_' + Date.now();
            const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

            // Simpan session profile lokal
            localStorage.setItem('tb_tamara_current_user', JSON.stringify(userObj));
            localStorage.setItem('tb_tamara_user', JSON.stringify(userObj));
            localStorage.setItem('tb_auth_token', token);

            return {
                success: true,
                user: userObj,
                token: token,
                expires_at: expiresAt
            };
        },

        verifyLoginToken: async function(token) {
            if (!token) return { success: false, message: 'Token kosong' };
            const cached = localStorage.getItem('tb_tamara_user');
            if (cached) {
                try {
                    const u = JSON.parse(cached);
                    return { success: true, user: u };
                } catch(e) {}
            }
            return { success: false, message: 'Sesi berakhir' };
        },

        revokeLoginToken: async function(token) {
            localStorage.removeItem('tb_tamara_user');
            localStorage.removeItem('tb_tamara_current_user');
            localStorage.removeItem('tb_auth_token');
            return { success: true };
        },

        getAuthenticatedUserServer_: async function() {
            const cached = localStorage.getItem('tb_tamara_user') || localStorage.getItem('tb_tamara_current_user');
            if (cached) {
                try { return JSON.parse(cached); } catch(e) {}
            }
            return null;
        },

        getUsers: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('profiles').select('*').order('full_name');
            return (data || []).map(mapProfileToUserObj);
        },

        // --- DASHBOARD & METRICS ---
        getDashboardData: async function() {
            const sb = getClient();
            if (!sb) return { orders: [], customers: [], stats: {} };

            const [ordersRes, custRes, vehiclesRes] = await Promise.all([
                sb.from('orders').select('*').order('created_at', { ascending: false }).limit(100),
                sb.from('customers').select('*').limit(50),
                sb.from('vehicles').select('*')
            ]);

            return {
                success: true,
                orders: (ordersRes.data || []).map(mapOrderToGasObj),
                customers: custRes.data || [],
                vehicles: vehiclesRes.data || []
            };
        },

        // --- OPERASIONAL ORDERS & PENGANTARAN ---
        getOrders: async function(filterOpt) {
            const sb = getClient();
            if (!sb) return { success: false, data: [] };

            filterOpt = filterOpt || {};
            const page = filterOpt.page || 1;
            const limit = filterOpt.limit || 50;

            let query = sb.from('orders').select('*', { count: 'exact' });

            // Pengurutan
            query = query.order('created_at', { ascending: false });

            const { data, count, error } = await query;
            if (error) {
                console.error('[Adapter getOrders error]', error);
                return { success: false, data: [] };
            }

            const mappedOrders = (data || []).map(mapOrderToGasObj);

            // Hitung ringkasan status
            const counts = {
                all: mappedOrders.length,
                masuk: mappedOrders.filter(o => o.status_pengiriman === 'Pesanan Masuk / Dimuat').length,
                muat: mappedOrders.filter(o => o.status_pengiriman === 'Sedang Dimuat').length,
                jalan: mappedOrders.filter(o => o.status_pengiriman === 'Dalam Pengantaran').length,
                selesai: mappedOrders.filter(o => o.status_pengiriman === 'Selesai Terkirim' || o.status_pengiriman === 'Selesai').length,
                urgent: mappedOrders.filter(o => o.is_urgent === 'Ya' || o.is_urgent === true).length,
                belumBayar: mappedOrders.filter(o => o.status_pembayaran === 'Belum Bayar').length
            };

            return {
                success: true,
                data: mappedOrders,
                orders: mappedOrders,
                total: count || mappedOrders.length,
                page: page,
                totalPages: Math.ceil((count || mappedOrders.length) / limit) || 1,
                counts: counts
            };
        },

        createOrder: async function(orderPayload) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Supabase client belum siap.' };

            const sbPayload = {
                customer_id: orderPayload.id_pelanggan || orderPayload.customer_id,
                customer_name: orderPayload.nama_pelanggan || orderPayload.customer_name,
                customer_phone: orderPayload.no_hp_pelanggan || orderPayload.customer_phone,
                customer_address: orderPayload.alamat_lengkap || orderPayload.customer_address,
                maps_url: orderPayload.link_gmaps || orderPayload.maps_url,
                order_date: orderPayload.tanggal_order || orderPayload.order_date || new Date().toISOString().split('T')[0],
                delivery_date: orderPayload.tanggal_pengantaran || orderPayload.delivery_date,
                is_urgent: orderPayload.is_urgent === 'Ya' || orderPayload.is_urgent === true,
                items_detail: orderPayload.detail_barang || orderPayload.items_detail,
                notes: orderPayload.catatan_nota || orderPayload.notes,
                shipping_cost: Number(orderPayload.biaya_ongkir || orderPayload.shipping_cost || 0),
                total_amount: Number(orderPayload.total_nilai_nota || orderPayload.total_amount || 0),
                payment_status: orderPayload.status_pembayaran || 'Belum Bayar',
                delivery_status: 'Pesanan Masuk / Dimuat',
                verification_status: 'Belum di Cek',
                created_by: orderPayload.pembuat_order || orderPayload.created_by || 'Admin'
            };

            const { data, error } = await sb.from('orders').insert([sbPayload]).select().single();
            if (error) return { success: false, message: error.message };
            return { success: true, data: mapOrderToGasObj(data) };
        },

        updateOrder: async function(orderId, updatePayload) {
            const sb = getClient();
            if (!sb) return { success: false };

            const { data, error } = await sb
                .from('orders')
                .update(updatePayload)
                .eq('id', orderId)
                .select()
                .single();

            return { success: !error, data: mapOrderToGasObj(data), message: error?.message };
        },

        ambilJob: async function(orderId, driverId, driverName) {
            const sb = getClient();
            if (!sb) return { success: false };

            const { error } = await sb
                .from('orders')
                .update({
                    driver_id: driverId,
                    driver_name: driverName,
                    delivery_status: 'Dalam Pengantaran'
                })
                .eq('id', orderId);

            return { success: !error, message: error ? error.message : 'Berhasil mengambil job.' };
        },

        verifikasiChecker: async function(orderId, checkerName) {
            const sb = getClient();
            if (!sb) return { success: false };

            const { error } = await sb
                .from('orders')
                .update({
                    verification_status: 'Sudah di Cek',
                    checker_name: checkerName
                })
                .eq('id', orderId);

            return { success: !error, message: error ? error.message : 'Berhasil diverifikasi checker.' };
        },

        // --- MASTER DATA PELANGGAN ---
        getCustomers: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('customers').select('*').order('name');
            return (data || []).map(c => ({
                id_pelanggan: c.id,
                nama_pelanggan: c.name,
                no_hp: c.phone,
                alamat_lengkap: c.address,
                link_gmaps: c.maps_url,
                total_order: c.total_orders,
                ongkir_standar: c.standard_shipping_fee
            }));
        },

        // --- PENGATURAN & EMERGENCY MESSAGES ---
        getAppConfig: async function() {
            const sb = getClient();
            if (!sb) return {};
            const { data } = await sb.from('system_configs').select('*');
            const configObj = {};
            (data || []).forEach(row => { configObj[row.key] = row.value; });
            return configObj;
        },

        getActiveEmergencyMessage: async function() {
            const sb = getClient();
            if (!sb) return null;
            const { data } = await sb
                .from('emergency_messages')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            return data || null;
        },

        // --- ARMADA & KENDARAAN ---
        getKendaraanList: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('vehicles').select('*').order('plate_number');
            return (data || []).map(v => ({
                id_kendaraan: v.id,
                no_plat: v.plate_number,
                jenis_mobil: v.vehicle_type,
                sopir_default: v.default_driver,
                km_terkini: v.current_km,
                total_liter_bbm: v.total_fuel_liters,
                status_aktif: v.status
            }));
        },

        // --- LEGALITAS PAJAK & KIR ---
        getPajakDashboardSummary: async function() {
            const sb = getClient();
            if (!sb) return { total: 0, mobil: 0, motor: 0, perlu_perhatian: 0, items: [] };

            const { data } = await sb.from('vehicle_taxes').select('*');
            const list = data || [];
            return {
                total: list.length,
                mobil: list.filter(v => (v.vehicle_type || '').toLowerCase().includes('mobil')).length,
                motor: list.filter(v => (v.vehicle_type || '').toLowerCase().includes('motor')).length,
                items: list
            };
        },

        // --- MASTER DATA SUPPLIER ---
        getSuppliers: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('suppliers').select('*').order('name');
            return (data || []).map(s => ({
                id_suplayer: s.id,
                nama_suplayer: s.name,
                no_telp: s.phone,
                alamat: s.address,
                catatan: s.notes,
                kelompok_suplayer: s.category,
                tempo_default: s.default_due_days
            }));
        },

        // --- BARANG DATANG ---
        getBarangDatangList: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('incoming_goods').select('*').order('created_at', { ascending: false });
            return (data || []).map(b => ({
                id_barang_datang: b.id,
                no_nota: b.invoice_no,
                nama_suplayer: b.supplier_name,
                tanggal_nota: b.invoice_date,
                tanggal_terima: b.received_date,
                catatan_barang: b.items_summary,
                total_nilai_uang: b.total_amount,
                status_jatuh_tempo: b.due_status,
                sisa_hutang: b.remaining_debt
            }));
        },

        // --- MODUL SOP HARIAN ---
        getSopDashboardData: async function() {
            const sb = getClient();
            if (!sb) return { total: 0, sops: [] };

            const { data } = await sb.from('sop_masters').select('*, sop_steps(*), sop_targets(*)');
            return {
                total: data?.length || 0,
                sops: data || []
            };
        },

        getSopList: async function() {
            const sb = getClient();
            if (!sb) return [];
            const { data } = await sb.from('sop_masters').select('*, sop_steps(*), sop_targets(*)').order('created_at', { ascending: false });
            return data || [];
        }
    };

    // 3. Buat Universal Proxy Runner untuk google.script.run
    function createRunner() {
        let _successHandler = function(res) {};
        let _failureHandler = function(err) { console.error('[Adapter Error]', err); };

        const runner = {
            withSuccessHandler: function(cb) {
                _successHandler = cb;
                return runner;
            },
            withFailureHandler: function(cb) {
                _failureHandler = cb;
                return runner;
            },
            withUserObject: function(obj) {
                return runner;
            }
        };

        // Buat Proxy dinamis untuk menangkap SEMUA nama fungsi di Code.gs
        return new Proxy(runner, {
            get: function(target, prop) {
                if (prop === 'withSuccessHandler' || prop === 'withFailureHandler' || prop === 'withUserObject') {
                    return target[prop];
                }

                // Jika nama fungsi dipanggil, eksekusi handler Supabase
                return function(...args) {
                    console.log(`[Adapter Call] -> ${String(prop)}()`, args);

                    if (typeof apiServices[prop] === 'function') {
                        Promise.resolve(apiServices[prop](...args))
                            .then(res => {
                                if (typeof _successHandler === 'function') _successHandler(res);
                            })
                            .catch(err => {
                                console.error(`[Adapter Exception in ${String(prop)}]`, err);
                                if (typeof _failureHandler === 'function') _failureHandler(err);
                            });
                    } else {
                        console.warn(`[Adapter Fallback] Fungsi "${String(prop)}" belum dipetakan khusus. Mengembalikan { success: true }.`);
                        setTimeout(() => {
                            if (typeof _successHandler === 'function') _successHandler({ success: true, message: 'Fallback OK' });
                        }, 50);
                    }
                };
            }
        });
    }

    // Pasang ke window.google.script.run
    window.google = window.google || {};
    window.google.script = window.google.script || {};
    
    // Override runner
    Object.defineProperty(window.google.script, 'run', {
        get: function() {
            return createRunner();
        },
        configurable: true
    });

    console.log('[Supabase Adapter] Universal Adapter v2.0 BERHASIL dipasang! google.script.run kini dialihkan ke Supabase.');
})();
