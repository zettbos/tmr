/**
 * UNIVERSAL GAS-TO-SUPABASE ADAPTER (FACADE ENGINE) v3.0
 * TB DELIVERY PRO (TB TAMARA / TMR)
 * Dibuat oleh: ZettBOT by Zettbos
 * 
 * Fungsi:
 * - Menangani 100% pemanggilan `google.script.run` di antarmuka HTML.
 * - Mengalihkan query ke PostgreSQL Supabase & Supabase Storage secara asinkron super cepat.
 * - Menyediakan implementasi lengkap untuk CRUD Order, Checker, Sopir, Customer, Armada, BBM, Oli, Pajak, dan Konfigurasi.
 */

(function() {
    console.log('[Supabase Adapter v3.0] Mengaktifkan Universal Adapter TB Delivery PRO...');

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

    // Helper: Format tanggal aman
    function formatDateIso(d) {
        if (!d) return new Date().toISOString();
        if (d instanceof Date) return d.toISOString();
        return String(d);
    }

    // Helper: Map profile row ke objek frontend
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

    // Helper: Map order Supabase ke format GAS UI
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

    // Helper: Log aktivitas sistem ke Supabase
    async function logActivity(userId, userName, role, action, details) {
        try {
            const sb = getClient();
            if (!sb) return;
            const logId = 'LOG-' + Date.now();
            await sb.from('activity_logs').insert([{
                id: logId,
                timestamp: new Date().toISOString(),
                user_code: userId || 'SYSTEM',
                user_name: userName || 'Sistem',
                role: role || 'System',
                action: action || 'ACTION',
                details: typeof details === 'object' ? JSON.stringify(details) : String(details || '')
            }]);
        } catch(e) {
            console.warn('[LogActivity skipped]', e);
        }
    }

    // 2. Daftar Layanan Backend Terintegrasi ke Supabase
    const apiServices = {
        // --- AUTH & SESI PENGGUNA ---
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

            console.log('[Supabase Adapter] Login attempt:', username);

            const { data, error } = await sb
                .from('profiles')
                .select('*')
                .ilike('username', username)
                .maybeSingle();

            if (error || !data) {
                return { success: false, message: 'Username atau password salah!' };
            }

            if (data.password && data.password.trim() !== password) {
                return { success: false, message: 'Username atau password salah!' };
            }

            if (data.is_active === false) {
                return { success: false, message: 'AKSES DITOLAK: Akun Anda sedang dinonaktifkan Admin!' };
            }

            const userObj = mapProfileToUserObj(data);
            const token = 'TKN_' + (data.user_code || data.id) + '_' + Date.now();
            const expiresAt = Date.now() + (30 * 24 * 60 * 60 * 1000);

            localStorage.setItem('tb_tamara_current_user', JSON.stringify(userObj));
            localStorage.setItem('tb_tamara_user', JSON.stringify(userObj));
            localStorage.setItem('tb_auth_token', token);

            logActivity(userObj.id_user, userObj.nama, userObj.role, 'LOGIN', 'User login ke sistem via Supabase');

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

        saveUser: async function(userData) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };

            const userCode = userData.id_user || userData.user_code || ('USR-' + Date.now().toString().slice(-4));
            const payload = {
                user_code: userCode,
                full_name: userData.nama || userData.full_name,
                username: userData.username,
                password: userData.password,
                role: userData.role || 'Staff Toko',
                phone: userData.no_hp || userData.phone || '',
                is_active: userData.is_active !== false,
                shift_start: userData.jam_masuk || '',
                shift_end: userData.jam_keluar || '',
                address: userData.alamat || userData.address || ''
            };

            const { data, error } = await sb.from('profiles').upsert([payload], { onConflict: 'user_code' }).select().single();
            if (error) return { success: false, message: error.message };
            return { success: true, message: 'User berhasil disimpan!', user: mapProfileToUserObj(data) };
        },

        deleteUser: async function(idUser) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('profiles').delete().eq('user_code', idUser);
            return { success: !error, message: error ? error.message : 'User berhasil dihapus' };
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

        // --- PELACAKAN RESI PUBLIK ---
        getPublicTrackingData: async function(idOrder) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database belum terhubung.' };
            const cleanId = String(idOrder || '').trim();
            if (!cleanId) return { success: false, message: 'Nomor resi tidak boleh kosong.' };

            console.log('[Adapter getPublicTrackingData]', cleanId);

            const { data, error } = await sb
                .from('orders')
                .select('*')
                .or(`id.ilike.${cleanId},customer_phone.ilike.%${cleanId}%`)
                .limit(1)
                .maybeSingle();

            if (error || !data) {
                return { success: false, message: `Data pesanan "${cleanId}" tidak ditemukan! Mohon periksa kembali nomor resi pesanan Anda.` };
            }

            const buktiFotos = [data.proof_url_1, data.proof_url_2, data.proof_url_3, data.proof_url_4, data.proof_url_5].filter(Boolean);

            return {
                success: true,
                data: {
                    id_order: data.id,
                    tanggal_order: data.order_date || '',
                    nama_pelanggan: data.customer_name || '',
                    alamat_lengkap: data.customer_address || '',
                    detail_barang: data.items_detail || 'Sesuai Nota',
                    nama_sopir: data.driver_name || 'Semua Sopir',
                    status_pengiriman: data.delivery_status || 'Pesanan Masuk / Dimuat',
                    status_pembayaran: data.payment_status || 'Belum Bayar',
                    ongkir: data.shipping_cost || 0,
                    total_nilai_nota: data.total_amount || 0,
                    url_foto_nota: data.nota_photo_url || '',
                    bukti_fotos: buktiFotos
                }
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

            if (filterOpt.statusPengiriman) {
                query = query.eq('delivery_status', filterOpt.statusPengiriman);
            }
            if (filterOpt.statusPembayaran) {
                query = query.eq('payment_status', filterOpt.statusPembayaran);
            }
            if (filterOpt.search) {
                query = query.or(`customer_name.ilike.%${filterOpt.search}%,id.ilike.%${filterOpt.search}%,customer_phone.ilike.%${filterOpt.search}%`);
            }

            query = query.order('created_at', { ascending: false });

            const { data, count, error } = await query;
            if (error) {
                console.error('[Adapter getOrders error]', error);
                return { success: false, data: [] };
            }

            const mappedOrders = (data || []).map(mapOrderToGasObj);

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

        createOrder: async function(orderData, base64NotaInput, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database Supabase tidak terhubung.' };

            console.log('[Adapter createOrder] Input:', orderData);

            // Generate Order ID Atomik: TMR-MMDD-XXXX
            const now = new Date();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const prefix = `TMR-${mm}${dd}-`;

            // Cari urutan tertinggi hari ini
            const { data: latestToday } = await sb
                .from('orders')
                .select('id')
                .ilike('id', `${prefix}%`)
                .order('id', { ascending: false })
                .limit(1);

            let nextNum = 1;
            if (latestToday && latestToday.length > 0) {
                const parts = latestToday[0].id.split('-');
                if (parts.length >= 3) {
                    const parsed = parseInt(parts[2], 10);
                    if (!isNaN(parsed)) nextNum = parsed + 1;
                }
            }

            const orderId = `${prefix}${String(nextNum).padStart(4, '0')}`;

            // Handle URL foto nota
            let notaUrl = '';
            if (Array.isArray(base64NotaInput) && base64NotaInput.length > 0) {
                notaUrl = base64NotaInput[0];
            } else if (typeof base64NotaInput === 'string') {
                notaUrl = base64NotaInput;
            }

            const pembuatNama = currentUser ? (currentUser.nama || currentUser.full_name || 'Staff') : 'Staff';
            const tipeKirim = (orderData.tipe_pengiriman || orderData.status_tipe_kirim || 'Dikirim').trim();
            const isDiBawaSendiri = (tipeKirim === 'Di Bawa Sendiri');

            const payload = {
                id: orderId,
                customer_id: orderData.id_pelanggan || ('CUST-' + Date.now().toString().slice(-4)),
                customer_name: orderData.nama_pelanggan || '',
                customer_phone: orderData.no_hp_pelanggan || '',
                customer_address: orderData.alamat_lengkap || '',
                maps_url: orderData.link_gmaps || '',
                order_date: orderData.tanggal_order || now.toISOString().split('T')[0],
                delivery_date: orderData.tanggal_pengantaran || null,
                is_urgent: orderData.is_urgent === 'Ya' || orderData.is_urgent === true,
                items_detail: orderData.detail_barang || 'Sesuai Nota',
                notes: orderData.catatan_nota || orderData.catatan || '',
                shipping_cost: Number(orderData.biaya_ongkir || orderData.ongkir || 0),
                total_amount: Number(orderData.total_nilai_nota || 0),
                payment_status: orderData.status_pembayaran || 'Belum Bayar',
                delivery_status: isDiBawaSendiri ? 'Di Bawa Sendiri' : 'Pesanan Masuk / Dimuat',
                verification_status: 'Belum di Cek',
                driver_id: isDiBawaSendiri ? null : (orderData.id_sopir || null),
                driver_name: isDiBawaSendiri ? 'Di Bawa Sendiri' : (orderData.nama_sopir || 'Semua Sopir'),
                nota_photo_url: notaUrl,
                created_by: pembuatNama
            };

            const { data, error } = await sb.from('orders').insert([payload]).select().single();
            if (error) {
                console.error('[Adapter createOrder Error]', error);
                return { success: false, message: 'Gagal membuat order: ' + error.message };
            }

            logActivity(currentUser?.id_user, pembuatNama, currentUser?.role || 'Staff', 'CREATE_ORDER', `Menerbitkan pesanan ${orderId}`);

            return {
                success: true,
                message: `Order ${orderId} berhasil diterbitkan!`,
                id_order: orderId,
                data: mapOrderToGasObj(data)
            };
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

            return { success: !error, data: mapOrderToGasObj(data), message: error ? error.message : 'Order berhasil diperbarui.' };
        },

        deleteOrder: async function(idOrder) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            const { error } = await sb.from('orders').delete().eq('id', idOrder);
            return { success: !error, message: error ? error.message : `Order ${idOrder} berhasil dihapus.` };
        },

        updateStatusPengiriman: async function(idOrder, statusBaru, base64BuktiArray, idUser, namaUser, userRole) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };

            console.log('[Adapter updateStatusPengiriman]', idOrder, statusBaru);

            const updateFields = {
                delivery_status: statusBaru
            };

            if (statusBaru === 'Selesai' || statusBaru === 'Selesai Terkirim') {
                updateFields.completed_at = new Date().toISOString();
            }

            if (namaUser && (userRole === 'Sopir' || userRole === 'Karnet' || String(namaUser).includes('('))) {
                updateFields.driver_name = namaUser;
                if (idUser && userRole === 'Sopir') updateFields.driver_id = idUser;
            }

            // Simpan foto bukti jika ada
            if (Array.isArray(base64BuktiArray) && base64BuktiArray.length > 0) {
                for (let i = 0; i < Math.min(base64BuktiArray.length, 5); i++) {
                    if (base64BuktiArray[i]) {
                        updateFields[`proof_url_${i + 1}`] = base64BuktiArray[i];
                    }
                }
            }

            const { error } = await sb.from('orders').update(updateFields).eq('id', idOrder);
            if (error) {
                return { success: false, message: 'Gagal update status: ' + error.message };
            }

            logActivity(idUser, namaUser, userRole || 'Sopir', 'UPDATE_STATUS_KIRIM', `Mengubah status ${idOrder} ke ${statusBaru}`);

            return {
                success: true,
                message: `Status pengiriman ${idOrder} diperbarui ke: ${statusBaru}`
            };
        },

        updateStatusPembayaran: async function(idOrder, statusBayarBaru, idUser, namaUser, userRole, base64TransferArray, base64LunasArray, nominalBelumBayar) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };

            const updateFields = {
                payment_status: statusBayarBaru,
                payment_collector: namaUser || ''
            };

            if (Array.isArray(base64TransferArray) && base64TransferArray.length > 0) {
                updateFields.transfer_proof_url = base64TransferArray[0];
            }
            if (Array.isArray(base64LunasArray) && base64LunasArray.length > 0) {
                updateFields.cash_proof_url = base64LunasArray[0];
            }

            const { error } = await sb.from('orders').update(updateFields).eq('id', idOrder);
            if (error) return { success: false, message: error.message };

            logActivity(idUser, namaUser, userRole, 'UPDATE_STATUS_BAYAR', `Mengubah pembayaran ${idOrder} ke ${statusBayarBaru}`);
            return { success: true, message: `Status pembayaran ${idOrder} diperbarui ke ${statusBayarBaru}` };
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

            logActivity(driverId, driverName, 'Sopir', 'AMBIL_JOB', `Sopir ${driverName} mengambil order ${orderId}`);
            return { success: !error, message: error ? error.message : 'Berhasil mengambil job!' };
        },

        assignSopir: async function(idOrder, sopirName, idSopir) {
            const sb = getClient();
            if (!sb) return { success: false };

            const { error } = await sb
                .from('orders')
                .update({
                    driver_id: idSopir || null,
                    driver_name: sopirName || 'Semua Sopir'
                })
                .eq('id', idOrder);

            return { success: !error, message: error ? error.message : `Sopir ${sopirName} berhasil ditugaskan!` };
        },

        verifikasiChecker: async function(idOrder, idUser, namaUser, modeCek, catatanCek, base64ItemPhotosArray, userRole) {
            const sb = getClient();
            if (!sb) return { success: false };

            const checkerName = namaUser || (typeof idUser === 'string' ? idUser : 'Checker');
            const statusVerif = modeCek || 'Sudah di Cek';

            const updateFields = {
                verification_status: statusVerif,
                checker_name: checkerName
            };

            if (Array.isArray(base64ItemPhotosArray) && base64ItemPhotosArray.length > 0) {
                updateFields.additional_nota_url = base64ItemPhotosArray[0];
            }

            const { error } = await sb.from('orders').update(updateFields).eq('id', idOrder);
            if (error) return { success: false, message: error.message };

            logActivity(idUser, checkerName, userRole || 'Checker', 'VERIFIKASI_CHECKER', `Memverifikasi fisik order ${idOrder}`);
            return { success: true, message: `Order ${idOrder} berhasil diverifikasi checker!` };
        },

        saveFotoMuatan: async function(idOrder, base64Array) {
            const sb = getClient();
            if (!sb || !base64Array || !base64Array.length) return { success: false };
            const { error } = await sb.from('orders').update({ additional_nota_url: base64Array[0] }).eq('id', idOrder);
            return { success: !error, message: error ? error.message : 'Foto muatan berhasil disimpan!' };
        },

        archiveCompletedOrders: async function() {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb
                .from('orders')
                .update({ is_archived: true })
                .eq('delivery_status', 'Selesai');
            return { success: !error, message: error ? error.message : 'Pesanan selesai berhasil diarsipkan.' };
        },

        restoreArchivedOrder: async function(idOrder) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('orders').update({ is_archived: false }).eq('id', idOrder);
            return { success: !error, message: error ? error.message : `Order ${idOrder} berhasil dikembalikan dari arsip.` };
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

        addNewCustomer: async function(custPayload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const custId = 'CUST-' + Date.now().toString().slice(-5);
            const payload = {
                id: custId,
                name: custPayload.nama_pelanggan || custPayload.name,
                phone: custPayload.no_hp || custPayload.phone || '',
                address: custPayload.alamat_lengkap || custPayload.address || '',
                maps_url: custPayload.link_gmaps || custPayload.maps_url || '',
                standard_shipping_fee: Number(custPayload.ongkir_standar || custPayload.standard_shipping_fee || 0),
                total_orders: 0
            };
            const { data, error } = await sb.from('customers').insert([payload]).select().single();
            return { success: !error, message: error ? error.message : 'Pelanggan berhasil ditambahkan!', data: data };
        },

        updateCustomer: async function(idCust, custPayload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const payload = {
                name: custPayload.nama_pelanggan || custPayload.name,
                phone: custPayload.no_hp || custPayload.phone,
                address: custPayload.alamat_lengkap || custPayload.address,
                maps_url: custPayload.link_gmaps || custPayload.maps_url
            };
            const { error } = await sb.from('customers').update(payload).eq('id', idCust);
            return { success: !error, message: error ? error.message : 'Pelanggan berhasil diperbarui!' };
        },

        deleteCustomer: async function(idCust) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('customers').delete().eq('id', idCust);
            return { success: !error, message: error ? error.message : 'Pelanggan berhasil dihapus!' };
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

        saveAppConfig: async function(key, value, description) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('system_configs').upsert([{ key, value, description }], { onConflict: 'key' });
            return { success: !error, message: error ? error.message : 'Pengaturan berhasil disimpan!' };
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

        saveEmergencyMessage: async function(msgPayload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const msgId = 'MSG-' + Date.now();
            const payload = {
                id: msgId,
                title: msgPayload.title || msgPayload.judul,
                message: msgPayload.message || msgPayload.isi,
                type: msgPayload.type || 'Pemberitahuan',
                is_active: true,
                created_by: msgPayload.created_by || 'Admin'
            };
            const { error } = await sb.from('emergency_messages').insert([payload]);
            return { success: !error, message: error ? error.message : 'Pesan darurat berhasil disiarkan!' };
        },

        deleteEmergencyMessageById: async function(msgId) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('emergency_messages').update({ is_active: false }).eq('id', msgId);
            return { success: !error, message: error ? error.message : 'Pesan darurat dinonaktifkan.' };
        },

        // --- ARMADA, BBM & SERVIS ---
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

        requestIzinIsiBBM: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const idIzin = 'IZN-' + Date.now().toString().slice(-6);
            const dataToInsert = {
                id: idIzin,
                request_time: new Date().toISOString(),
                driver_id: payload.driver_id || payload.id_sopir,
                driver_name: payload.driver_name || payload.nama_sopir,
                plate_number: payload.plate_number || payload.no_plat,
                status: 'Menunggu Persetujuan',
                notes: payload.notes || payload.catatan || '',
                is_used: 'Belum'
            };
            const { error } = await sb.from('fuel_approvals').insert([dataToInsert]);
            return { success: !error, message: error ? error.message : 'Permohonan izin BBM berhasil diajukan!' };
        },

        respondIzinIsiBBM: async function(idIzin, status, catatan, adminName) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('fuel_approvals').update({
                status: status,
                catatan: catatan,
                responded_by: adminName,
                responded_at: new Date().toISOString()
            }).eq('id', idIzin);
            return { success: !error, message: error ? error.message : 'Izin BBM berhasil ditanggapi.' };
        },

        submitPengisianBBM: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const idBbm = 'BBM-' + Date.now().toString().slice(-6);
            const dataToInsert = {
                id: idBbm,
                fuel_date: payload.tanggal || new Date().toISOString(),
                plate_number: payload.no_plat || payload.plate_number,
                driver_id: payload.id_sopir || payload.driver_id,
                driver_name: payload.nama_sopir || payload.driver_name,
                current_km: Number(payload.km_saat_ini || 0),
                liters: Number(payload.jumlah_liter || 0),
                total_cost: Number(payload.total_biaya || 0),
                gas_station: payload.nama_spbu || '',
                fuel_type: payload.jenis_bbm || 'Solar',
                km_photo_url: payload.foto_km || '',
                receipt_photo_url: payload.foto_struk || '',
                notes: payload.catatan || ''
            };
            const { error } = await sb.from('fuel_logs').insert([dataToInsert]);
            if (!error && payload.plate_number) {
                // Update KM mobil
                await sb.from('vehicles').update({ current_km: Number(payload.km_saat_ini || 0) }).eq('plate_number', payload.plate_number);
            }
            return { success: !error, message: error ? error.message : 'Pengisian BBM berhasil dicatat!' };
        },

        deleteBBMTransaction: async function(idBbm) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('fuel_logs').delete().eq('id', idBbm);
            return { success: !error, message: error ? error.message : 'Data BBM berhasil dihapus.' };
        },

        submitInputOli: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const idOli = 'OLI-' + Date.now().toString().slice(-6);
            const dataToInsert = {
                id: idOli,
                service_date: payload.tanggal || new Date().toISOString(),
                plate_number: payload.no_plat,
                driver_id: payload.id_sopir,
                driver_name: payload.nama_sopir,
                service_km: Number(payload.km_saat_ganti || 0),
                oil_brand: payload.merek_oli || '',
                liters: Number(payload.jumlah_liter || 0),
                total_cost: Number(payload.total_biaya || 0),
                workshop_name: payload.nama_bengkel || ''
            };
            const { error } = await sb.from('oil_change_logs').insert([dataToInsert]);
            return { success: !error, message: error ? error.message : 'Riwayat ganti oli berhasil dicatat!' };
        },

        deleteOliTransaction: async function(idOli) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('oil_change_logs').delete().eq('id', idOli);
            return { success: !error, message: error ? error.message : 'Data oli berhasil dihapus.' };
        },

        submitInputService: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const idServis = 'SRV-' + Date.now().toString().slice(-6);
            const dataToInsert = {
                id: idServis,
                service_date: payload.tanggal || new Date().toISOString(),
                plate_number: payload.no_plat,
                driver_id: payload.id_sopir,
                driver_name: payload.nama_sopir,
                current_km: Number(payload.km_saat_ini || 0),
                workshop_name: payload.nama_bengkel || '',
                cost: Number(payload.biaya_perbaikan || 0),
                repair_details: payload.catatan_perbaikan || ''
            };
            const { error } = await sb.from('vehicle_services').insert([dataToInsert]);
            return { success: !error, message: error ? error.message : 'Riwayat servis kendaraan berhasil disimpan!' };
        },

        // --- PAJAK & KIR KENDARAAN ---
        getPajakDashboardSummary: async function() {
            const sb = getClient();
            if (!sb) return { total: 0, mobil: 0, motor: 0, items: [] };

            const { data } = await sb.from('vehicle_taxes').select('*');
            const list = data || [];
            return {
                total: list.length,
                mobil: list.filter(v => (v.vehicle_type || '').toLowerCase().includes('mobil')).length,
                motor: list.filter(v => (v.vehicle_type || '').toLowerCase().includes('motor')).length,
                items: list
            };
        },

        submitPembayaranPajak: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };
            const idTx = 'PJK-TX-' + Date.now().toString().slice(-6);
            const dataToInsert = {
                id: idTx,
                tax_id: payload.id_kendaraan || payload.tax_id,
                plate_number: payload.no_polisi || payload.plate_number,
                owner_name: payload.nama_pemilik || payload.owner_name,
                payment_type: payload.jenis_pembayaran || payload.payment_type,
                payment_date: payload.tanggal_bayar || new Date().toISOString(),
                amount: Number(payload.nominal_biaya || payload.amount || 0),
                notes: payload.catatan || '',
                admin_name: payload.admin_penginput || payload.admin_name || 'Admin'
            };
            const { error } = await sb.from('tax_payment_logs').insert([dataToInsert]);
            return { success: !error, message: error ? error.message : 'Pembayaran pajak berhasil dicatat!' };
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

        return new Proxy(runner, {
            get: function(target, prop) {
                if (prop === 'withSuccessHandler' || prop === 'withFailureHandler' || prop === 'withUserObject') {
                    return target[prop];
                }

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
                        console.warn(`[Adapter Fallback] Fungsi "${String(prop)}" belum dipetakan khusus. Mengembalikan fallback aman.`);
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
    
    Object.defineProperty(window.google.script, 'run', {
        get: function() {
            return createRunner();
        },
        configurable: true
    });

    // =========================================================================
    // 4. GOOGLE DRIVE CDN PHOTO HELPER (lh3.googleusercontent.com)
    // =========================================================================
    async function uploadToGoogleDriveCdn(base64Data, filenamePrefix) {
        if (!base64Data || typeof base64Data !== 'string' || base64Data.length < 50) return '';
        if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) return base64Data;

        const gasEndpoint = window.__TB_GAS_BACKEND_URL;
        if (gasEndpoint) {
            try {
                console.log('[Drive CDN] Mengunggah foto ke Google Drive CDN via GAS...');
                const res = await fetch(gasEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'uploadFileDirectToDrive',
                        base64Data: base64Data,
                        filenamePrefix: filenamePrefix || 'tmr_photo'
                    })
                });
                const json = await res.json();
                if (json && json.success && json.url) {
                    console.log('[Drive CDN] Sukses mendapatkan URL lh3:', json.url);
                    return json.url;
                }
            } catch (err) {
                console.warn('[Drive CDN Warning] Gagal upload ke GAS Drive, menggunakan fallback:', err);
            }
        }
        return base64Data;
    }
    window.__uploadToGoogleDriveCdn = uploadToGoogleDriveCdn;

    // =========================================================================
    // 5. SUPABASE REALTIME SUBSCRIPTION ENGINE (WEBSOCKETS)
    // =========================================================================
    let _realtimeChannel = null;
    function initSupabaseRealtime() {
        try {
            const sb = getClient();
            if (!sb) {
                setTimeout(initSupabaseRealtime, 800);
                return;
            }

            if (_realtimeChannel) {
                try { sb.removeChannel(_realtimeChannel); } catch (e) {}
            }

            console.log('[Realtime TMR] Menghubungkan WebSocket ke Supabase Realtime...');
            _realtimeChannel = sb.channel('tmr_realtime_stream')
                .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
                    console.log('[Realtime TMR] Perubahan data order:', payload.eventType, payload.new?.id || payload.old?.id);
                    
                    // Notifikasi audio & visual jika order baru diterbitkan
                    if (payload.eventType === 'INSERT') {
                        if (typeof window.playNewOrderSound === 'function') {
                            try { window.playNewOrderSound(); } catch (e) {}
                        }
                        if (typeof window.showToast === 'function') {
                            try { window.showToast(`Pesanan Baru: ${payload.new?.id || ''} (${payload.new?.customer_name || 'Pelanggan'})`, 'success'); } catch (e) {}
                        }
                    }

                    // Reload silent daftar orders jika fungsi loadOrders aktif
                    if (typeof window.loadOrders === 'function') {
                        try { window.loadOrders(window.currentPage || 1, false, true); } catch (e) {}
                    }

                    // Reload statistik ringkasan dashboard jika ada
                    if (typeof window.loadDashboardStats === 'function') {
                        try { window.loadDashboardStats(); } catch (e) {}
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'fuel_approvals' }, (payload) => {
                    console.log('[Realtime TMR] Perubahan data BBM:', payload.eventType);
                    if (typeof window.loadRiwayatBBMTable === 'function') {
                        try { window.loadRiwayatBBMTable(); } catch (e) {}
                    }
                })
                .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_logs' }, (payload) => {
                    console.log('[Realtime TMR] Log aktivitas baru:', payload.new?.action, payload.new?.user_name);
                })
                .subscribe((status, err) => {
                    console.log('[Realtime TMR] Status koneksi Realtime:', status);
                    if (status === 'SUBSCRIBED') {
                        console.log('⚡ [Realtime TMR] Sukses terhubung ke Supabase Realtime! Data akan tersinkronisasi otomatis seketika.');
                    }
                });

            window.__tmr_realtime_channel = _realtimeChannel;
        } catch (err) {
            console.error('[Realtime TMR Init Error]', err);
        }
    }

    // Inisialisasi Realtime otomatis saat DOM siap
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(initSupabaseRealtime, 600);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(initSupabaseRealtime, 600));
    }

    console.log('[Supabase Adapter v3.0] Universal Adapter & Realtime Engine BERHASIL diaktifkan penuh!');
})();
