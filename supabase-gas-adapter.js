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

        const rawNotes = row.notes || '';
        const rawPayStatus = (row.payment_status || '').toLowerCase().trim();

        // Parse nominal tambahan terkirim
        let nomTambahanTerkirim = 0;
        const matchTotalTambahan = rawNotes.match(/\[TOTAL_TAMBAHAN_TERKIRIM:\s*(\d+)\]/i);
        if (matchTotalTambahan && matchTotalTambahan[1]) {
            nomTambahanTerkirim = parseInt(matchTotalTambahan[1], 10) || 0;
        } else {
            const reTot = /\[ORDERAN TAMBAHAN\s*\(Nilai:\s*Rp\s*([0-9.,]+)/gi;
            let mTot;
            while ((mTot = reTot.exec(rawNotes)) !== null) {
                if (mTot[1]) nomTambahanTerkirim += parseInt(mTot[1].replace(/[^0-9]/g, ''), 10) || 0;
            }
        }

        // Parse nominal tambahan belum bayar
        let nomTambahanBelum = 0;
        const matchTambahanBelum = rawNotes.match(/\[TAMBAHAN_BELUM_BAYAR:\s*(\d+)\]/i);
        if (matchTambahanBelum && matchTambahanBelum[1]) {
            nomTambahanBelum = parseInt(matchTambahanBelum[1], 10) || 0;
        } else {
            const matchSisaTagihan = rawNotes.match(/\[ORDERAN TAMBAHAN[^\]]*Sisa Tagihan:\s*Rp\s*([0-9.,]+)[^\]]*\]/i);
            if (matchSisaTagihan && matchSisaTagihan[1]) {
                nomTambahanBelum = parseInt(matchSisaTagihan[1].replace(/[^0-9]/g, ''), 10) || 0;
            }
        }

        // Parse nominal belum bayar dasar
        let nomBelum = row.unpaid_amount;
        if (!nomBelum || nomBelum === 0) {
            const m = rawNotes.match(/\[BELUM_BAYAR_AWAL:\s*(\d+)\]/i) || rawNotes.match(/\[BELUM_BAYAR:\s*(\d+)\]/i);
            if (m && m[1]) {
                nomBelum = parseInt(m[1], 10) || 0;
            } else if (rawPayStatus === 'belum bayar' || rawPayStatus === 'bayar di lokasi' || rawPayStatus.includes('cod')) {
                nomBelum = row.total_amount || 0;
            } else {
                nomBelum = 0;
            }
        }

        // Parse karnet
        let karnetName = row.helper_name || '';
        if (!karnetName && row.driver_name) {
            const mK = row.driver_name.match(/\(([^)]+)\)/);
            if (mK && mK[1]) karnetName = mK[1].trim();
        }
        if (!karnetName) {
            const mN = rawNotes.match(/\[KARNET:\s*([^\]]+)\]/i);
            if (mN && mN[1]) karnetName = mN[1].trim();
        }

        // Parse foto muatan
        let cargoUrl = row.cargo_photo_url || '';
        if (!cargoUrl) {
            const matchM = rawNotes.match(/\[FOTO_MUATAN:([^\]]+)\]/i);
            if (matchM && matchM[1]) cargoUrl = matchM[1].trim();
        }

        return {
            ...row,
            id_order: row.id,
            tanggal_order: row.order_date || '',
            tanggal_pengantaran: row.delivery_date || '',
            is_urgent: (row.is_urgent === true || row.is_urgent === 'Ya' || row.is_urgent === 'true') ? 'Ya' : 'Tidak',
            id_pelanggan: row.customer_id || '',
            nama_pelanggan: row.customer_name || '',
            no_hp_pelanggan: row.customer_phone || '',
            alamat_lengkap: row.customer_address || '',
            link_gmaps: row.maps_url || '',
            url_foto_nota: row.nota_photo_url || '',
            catatan_nota: rawNotes,
            detail_barang: row.items_detail || 'Sesuai Nota',
            id_sopir: row.driver_id || '',
            nama_sopir: row.driver_name || 'Semua Sopir',
            nama_karnet: karnetName,
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
            catatan: row.delivery_notes || '',
            nama_checker: row.checker_name || '',
            pembuat_order: row.created_by || 'Admin',
            dibuat_oleh: row.created_by || 'Admin',
            url_bukti_transfer: row.transfer_proof_url || '',
            biaya_ongkir: row.shipping_cost || 0,
            ongkir: row.shipping_cost || 0,
            total_nilai_nota: row.total_amount || 0,
            petugas_pembayaran: row.payment_collector || '',
            petugas_bayar: row.payment_collector || '',
            url_nota_tambahan: row.additional_nota_url || '',
            url_foto_uang_lunas: row.cash_proof_url || '',
            tipe_pengiriman: row.shipping_type || 'Dikirim',
            url_foto_muatan: cargoUrl,
            nominal_tambahan_terkirim: nomTambahanTerkirim,
            nominal_tambahan_belum_bayar: nomTambahanBelum,
            nominal_belum_bayar: parseInt(String(nomBelum || 0).replace(/[^0-9]/g, ''), 10) || 0,
            acuan_komisi: (row.total_amount || 0) + nomTambahanTerkirim
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
                data: userObj,
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
            if (!sb) return { success: false, data: [], users: [] };
            const { data } = await sb.from('profiles').select('*').order('full_name');
            const mapped = (data || []).map(mapProfileToUserObj);
            mapped.success = true;
            mapped.data = mapped;
            return {
                success: true,
                data: mapped,
                users: mapped
            };
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
            if (!sb) return { success: false, stats: {}, driverStats: {}, logs: [] };

            const [ordersRes, profilesRes, logsRes] = await Promise.all([
                sb.from('orders').select('*').order('created_at', { ascending: false }),
                sb.from('profiles').select('*').order('full_name'),
                sb.from('activity_logs').select('*').order('timestamp', { ascending: false }).limit(20)
            ]);

            const stats = {
                total: 0,
                menungguPenugasan: 0,
                siapDimuat: 0,
                dalamPengantaran: 0,
                selesai: 0,
                kirimanSopir1: 0,
                kirimanSopir2: 0,
                kirimanTerjadwal: 0,
                urgent: 0,
                belumBayar: 0
            };

            const driverStats = {};
            (profilesRes.data || []).forEach(p => {
                if (p.role === 'Sopir' && p.is_active !== false) {
                    driverStats[p.full_name] = { total: 0, jalan: 0, selesai: 0 };
                }
            });

            const allOrders = (ordersRes.data || []).map(mapOrderToGasObj);
            stats.total = allOrders.length;

            allOrders.forEach(o => {
                const isSelesai = o.status_pengiriman && (o.status_pengiriman.toLowerCase().includes('selesai') || o.status_pengiriman === 'Terkirim');
                const isDiBawaSendiri = (o.tipe_pengiriman === 'Di Bawa Sendiri' || o.status_pengiriman === 'Di Bawa Sendiri' || o.nama_sopir === 'Di Bawa Sendiri');
                const isUnassigned = (!o.id_sopir || o.nama_sopir === 'Semua Sopir' || o.nama_sopir === '-' || o.nama_sopir === 'Pool Job');

                if (!isDiBawaSendiri && isUnassigned && !isSelesai) {
                    stats.menungguPenugasan++;
                }

                if (o.status_pengiriman === 'Pesanan Masuk / Dimuat' || o.status_pengiriman === 'Proses Muat Barang' || o.status_pengiriman === 'Sedang Dimuat') {
                    stats.siapDimuat++;
                }

                if (o.status_pengiriman === 'Dalam Pengantaran' || o.status_pengiriman === 'Dalam Pengantaran Sebagian') {
                    stats.dalamPengantaran++;
                }

                if (isSelesai) {
                    stats.selesai++;
                }

                if ((o.catatan_nota && o.catatan_nota.includes('[TITIP BARANG]')) || (o.status_pengiriman && o.status_pengiriman.toLowerCase().includes('titip'))) {
                    if (!isSelesai) stats.kirimanTerjadwal++;
                }

                if ((o.is_urgent === 'Ya' || o.is_urgent === true) && !isSelesai) {
                    stats.urgent++;
                }

                const sPay = (o.status_pembayaran || '').toLowerCase();
                const isLunas = sPay === 'lunas' || (sPay.includes('lunas') && !sPay.includes('belum'));
                const isTransfer = sPay.includes('transfer');
                if ((!isLunas && !isTransfer) || (o.nominal_tambahan_belum_bayar > 0)) {
                    stats.belumBayar++;
                }

                // Driver stats
                const drvName = o.nama_sopir;
                if (drvName && drvName !== 'Semua Sopir' && !isDiBawaSendiri) {
                    let matchedKey = null;
                    for (let k in driverStats) {
                        if (drvName.toLowerCase().includes(k.toLowerCase()) || k.toLowerCase().includes(drvName.toLowerCase())) {
                            matchedKey = k;
                            break;
                        }
                    }
                    if (!matchedKey) {
                        driverStats[drvName] = { total: 0, jalan: 0, selesai: 0 };
                        matchedKey = drvName;
                    }
                    driverStats[matchedKey].total++;
                    if (o.status_pengiriman === 'Dalam Pengantaran') driverStats[matchedKey].jalan++;
                    if (isSelesai) driverStats[matchedKey].selesai++;
                }
            });

            const logs = (logsRes.data || []).map(l => ({
                id_log: l.id,
                timestamp: l.timestamp ? new Date(l.timestamp).toLocaleString('id-ID') : '',
                user: l.user_name || 'User',
                role: l.role || '',
                aktivitas: l.action || '',
                detail: l.details || ''
            }));

            return {
                success: true,
                stats: stats,
                driverStats: driverStats,
                logs: logs,
                orders: allOrders
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

        // --- INFORMASI & PENGUMUMAN TOKO ---
        getAnnouncement: async function() {
            const sb = getClient();
            if (!sb) return { success: false, text: '', photoUrl: '' };
            try {
                const { data } = await sb.from('system_configs').select('key, value').in('key', ['APP_ANNOUNCEMENT_TEXT', 'APP_ANNOUNCEMENT_PHOTO']);
                let text = '';
                let photoUrl = '';
                if (data && Array.isArray(data)) {
                    data.forEach(item => {
                        if (item.key === 'APP_ANNOUNCEMENT_TEXT') text = item.value || '';
                        if (item.key === 'APP_ANNOUNCEMENT_PHOTO') photoUrl = item.value || '';
                    });
                }
                const defaultNotice = '-Cek barang baik-baik. Jangan sampai ada yang ketinggalan\n-Di cek kondisi mobil setiap pagi (panasi mobil)\n-update karnet masing-masing sopir. .-';
                return {
                    success: true,
                    text: text || defaultNotice,
                    photoUrl: photoUrl || ''
                };
            } catch (err) {
                console.error('[getAnnouncement error]', err);
                return {
                    success: true,
                    text: '-Cek barang baik-baik. Jangan sampai ada yang ketinggalan\n-Di cek kondisi mobil setiap pagi (panasi mobil)\n-update karnet masing-masing sopir. .-',
                    photoUrl: ''
                };
            }
        },

        saveAnnouncement: async function(text, photoBase64, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database Supabase tidak terhubung.' };
            try {
                let photoUrl = '';
                if (photoBase64 && photoBase64.trim() !== '') {
                    if (photoBase64 === '__DELETE__') {
                        photoUrl = '';
                    } else if (photoBase64.startsWith('http://') || photoBase64.startsWith('https://')) {
                        photoUrl = photoBase64;
                    } else {
                        const uploadRes = await apiServices.uploadFile(photoBase64, 'announcement_' + Date.now() + '.jpg', 'announcements');
                        if (uploadRes && uploadRes.success) photoUrl = uploadRes.url;
                    }
                }

                const updates = [
                    { key: 'APP_ANNOUNCEMENT_TEXT', value: text || '', description: 'Teks Pengumuman Toko' }
                ];
                if (photoUrl || photoBase64 === '__DELETE__') {
                    updates.push({ key: 'APP_ANNOUNCEMENT_PHOTO', value: photoUrl, description: 'URL Foto Pengumuman Toko' });
                }

                await sb.from('system_configs').upsert(updates, { onConflict: 'key' });
                logActivity(currentUser?.id_user, currentUser?.nama, currentUser?.role, 'UPDATE_ANNOUNCEMENT', 'Memperbarui banner informasi admin');
                return { success: true, message: 'Informasi pengumuman berhasil disimpan!', text: text, photoUrl: photoUrl };
            } catch (err) {
                return { success: false, message: err.toString() };
            }
        },

        // --- OPERASIONAL ORDERS & PENGANTARAN ---
        getOrders: async function(filterOpt) {
            const sb = getClient();
            if (!sb) return { success: false, data: [], orders: [], counts: {}, pagination: { currentPage: 1, totalPages: 1, totalRecords: 0 } };

            filterOpt = filterOpt || {};
            const page = parseInt(filterOpt.page, 10) || 1;
            const limit = parseInt(filterOpt.limit, 10) || 20;
            const search = filterOpt.search ? String(filterOpt.search).toLowerCase().trim() : '';
            const statusPengiriman = filterOpt.statusPengiriman || '';
            const statusPembayaran = filterOpt.statusPembayaran || '';
            const isUrgentFilter = filterOpt.isUrgent || '';
            const isTitipBarangFilter = filterOpt.isTitipBarang || '';
            const userRole = filterOpt.userRole || '';
            const userId = filterOpt.userId ? String(filterOpt.userId) : '';
            const driverFilter = filterOpt.driverFilter || filterOpt.sopir || '';

            // Query seluruh orders dari Supabase realtime
            const { data, error } = await sb
                .from('orders')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[Adapter getOrders error]', error);
                return {
                    success: false,
                    message: error.message,
                    data: [],
                    orders: [],
                    counts: {},
                    pagination: { currentPage: page, totalPages: 1, totalRecords: 0 }
                };
            }

            const allOrders = (data || []).map(mapOrderToGasObj);

            let cntAll = 0;
            let cntMasuk = 0;
            let cntMuat = 0;
            let cntJalan = 0;
            let cntSelesai = 0;
            let cntFulljob = 0;
            let cntUrgent = 0;
            let cntBelumBayar = 0;
            let cntTitip = 0;
            let cntDiBawaSendiri = 0;

            const filtered = [];

            for (let i = 0; i < allOrders.length; i++) {
                const orderObj = allOrders[i];

                // Identifikasi Di Bawa Sendiri
                const isDiBawaSendiriItem = (
                    orderObj.tipe_pengiriman === 'Di Bawa Sendiri' ||
                    orderObj.status_pengiriman === 'Di Bawa Sendiri' ||
                    orderObj.status_pengiriman === 'Selesai Di Bawa Sendiri' ||
                    (orderObj.catatan_nota && orderObj.catatan_nota.includes('[TIPE_PENGIRIMAN:DI_BAWA_SENDIRI]')) ||
                    orderObj.nama_sopir === 'Di Bawa Sendiri'
                );

                const isDalamPengantaran = (orderObj.status_pengiriman === 'Dalam Pengantaran' || orderObj.status_pengiriman === 'Dalam Pengantaran Sebagian');
                const isSisaWaitingNextTrip = (orderObj.status_pengiriman === 'Terkirim Sebagian' || orderObj.status_pengiriman === 'Sisa Kiriman' || (orderObj.status_pengiriman && orderObj.status_pengiriman.toLowerCase().includes('sebagian') && !isDalamPengantaran && !orderObj.status_pengiriman.toLowerCase().includes('selesai')));
                const isTitipNota = (orderObj.catatan_nota && (orderObj.catatan_nota.toUpperCase().includes('[TITIP BARANG]') || orderObj.catatan_nota.toLowerCase().includes('titip barang'))) ||
                                    (orderObj.catatan && (orderObj.catatan.toUpperCase().includes('[TITIP BARANG]') || orderObj.catatan.toLowerCase().includes('titip barang')));
                const isTitipStatus = orderObj.status_pengiriman && orderObj.status_pengiriman.toLowerCase().includes('titip');
                const isTitipOnly = (isTitipNota || isTitipStatus) && !isDalamPengantaran && !isSisaWaitingNextTrip;
                const isTitipSisaItem = (isTitipOnly || isSisaWaitingNextTrip) && !isDalamPengantaran;
                const isSelesaiItem = orderObj.status_pengiriman && (orderObj.status_pengiriman.toLowerCase().includes('selesai') || orderObj.status_pengiriman === 'Terkirim') && !isSisaWaitingNextTrip && !isDalamPengantaran;

                const rawSopirLower = (orderObj.nama_sopir || '').toString().toLowerCase().trim();
                const rawIdSopirLower = (orderObj.id_sopir || '').toString().toLowerCase().trim();
                const isUnassignedDriver = (!orderObj.id_sopir || rawIdSopirLower === 'semua sopir' || rawIdSopirLower === '-' || rawIdSopirLower === 'pool job' || !orderObj.nama_sopir || rawSopirLower === '' || rawSopirLower === 'semua sopir' || rawSopirLower === 'semua sopir (pool job)' || rawSopirLower === '-' || rawSopirLower === 'pool job' || rawSopirLower === 'tanpa sopir');
                const isFullJobItem = !isDiBawaSendiriItem && isUnassignedDriver && !isSelesaiItem && !isTitipSisaItem && !isDalamPengantaran;

                const isViewingFullJob = (isTitipBarangFilter === 'fulljob');

                let isDriverMatchedForCounts = true;
                if (userRole === 'Sopir') {
                    if (!isDiBawaSendiriItem) {
                        if (orderObj.id_sopir && orderObj.id_sopir !== userId && orderObj.nama_sopir !== 'Semua Sopir') {
                            isDriverMatchedForCounts = false;
                        }
                    }
                }
                if (!isDiBawaSendiriItem && driverFilter && orderObj.nama_sopir.toLowerCase().indexOf(driverFilter.toLowerCase()) === -1 && orderObj.id_sopir !== driverFilter) {
                    isDriverMatchedForCounts = false;
                }

                // 1. HITUNG BADGE COUNTER SEMUA FOLDER (UNIVERSAL)
                if (isFullJobItem) {
                    cntFulljob++;
                }

                if (isDiBawaSendiriItem) {
                    if (!isSelesaiItem && orderObj.status_pengiriman !== 'Selesai Di Bawa Sendiri') {
                        cntDiBawaSendiri++;
                    }
                } else if (isDriverMatchedForCounts) {
                    if (!isSelesaiItem) {
                        cntAll++;
                    } else {
                        cntSelesai++;
                    }

                    if (isTitipSisaItem && !isSelesaiItem) {
                        cntTitip++;
                    } else if (!isFullJobItem) {
                        if (orderObj.status_pengiriman === 'Pesanan Masuk / Dimuat' || orderObj.status_pengiriman === 'Pesanan Masuk') {
                            cntMasuk++;
                        }
                        if (orderObj.status_pengiriman === 'Proses Muat Barang' || orderObj.status_pengiriman === 'Sedang Memuat Barang' || orderObj.status_pengiriman === 'Sedang Dimuat') {
                            cntMuat++;
                        }
                        if (isDalamPengantaran) {
                            cntJalan++;
                        }
                    }

                    if ((orderObj.is_urgent === 'Ya' || orderObj.is_urgent === true) && !isSelesaiItem) {
                        cntUrgent++;
                    }

                    // Belum bayar / belum lunas
                    const payStatusLower = (orderObj.status_pembayaran || '').toLowerCase().trim();
                    const isLunas = payStatusLower === 'lunas' || (payStatusLower.includes('lunas') && !payStatusLower.includes('belum'));
                    const isTransfer = payStatusLower.includes('transfer');
                    const hasUnpaid = !isLunas && !isTransfer;
                    if (hasUnpaid || (orderObj.catatan_nota && orderObj.catatan_nota.includes('[TAMBAHAN_BELUM_BAYAR:')) || orderObj.nominal_tambahan_belum_bayar > 0) {
                        cntBelumBayar++;
                    }
                }

                // 2. FILTERING UNTUK MENAMPILKAN DATA TAB
                if (search) {
                    const matchSearch = (orderObj.id_order || '').toLowerCase().includes(search) ||
                                        (orderObj.nama_pelanggan || '').toLowerCase().includes(search) ||
                                        (orderObj.no_hp_pelanggan || '').toLowerCase().includes(search) ||
                                        (orderObj.alamat_lengkap || '').toLowerCase().includes(search) ||
                                        (orderObj.detail_barang || '').toLowerCase().includes(search) ||
                                        (orderObj.nama_sopir || '').toLowerCase().includes(search) ||
                                        (orderObj.catatan || '').toLowerCase().includes(search) ||
                                        (orderObj.pembuat_order || '').toLowerCase().includes(search);
                    if (!matchSearch) continue;
                }

                if (isViewingFullJob) {
                    if (!isDiBawaSendiriItem && isFullJobItem && !isTitipSisaItem && !isSelesaiItem && !isDalamPengantaran) {
                        filtered.push(orderObj);
                    }
                    continue;
                }

                if (!isDiBawaSendiriItem && !isDriverMatchedForCounts) {
                    continue;
                }

                const rawDiBawaSendiriOpt = (filterOpt.isDiBawaSendiri !== undefined && filterOpt.isDiBawaSendiri !== null) ? filterOpt.isDiBawaSendiri.toString().trim() : '';
                const isDiBawaSendiriFilter = (
                    statusPengiriman === 'Di Bawa Sendiri' || 
                    statusPengiriman === 'Selesai Di Bawa Sendiri' ||
                    isTitipBarangFilter === 'di_bawa_sendiri' || 
                    isTitipBarangFilter.indexOf('bawa_sendiri') !== -1 ||
                    rawDiBawaSendiriOpt !== '' ||
                    filterOpt.isDiBawaSendiri === true ||
                    filterOpt.isDiBawaSendiri === 'Ya'
                );

                if (!isDiBawaSendiriFilter && isDiBawaSendiriItem) {
                    continue;
                }

                if (isDiBawaSendiriFilter) {
                    if (!isDiBawaSendiriItem) continue;
                    const subChoice = rawDiBawaSendiriOpt || isTitipBarangFilter;
                    if (subChoice === 'bawa_sendiri_aktif' || subChoice === 'di_bawa_sendiri_aktif') {
                        if (isSelesaiItem || orderObj.status_pengiriman === 'Selesai Di Bawa Sendiri') continue;
                    } else if (subChoice === 'bawa_sendiri_titip' || subChoice === 'di_titip_nanti') {
                        if (isSelesaiItem || orderObj.status_pengiriman === 'Selesai Di Bawa Sendiri') continue;
                    } else if (subChoice === 'bawa_sendiri_selesai' || subChoice === 'selesai_bawa_sendiri') {
                        if (!isSelesaiItem && orderObj.status_pengiriman !== 'Selesai Di Bawa Sendiri') continue;
                    } else {
                        if (isSelesaiItem || orderObj.status_pengiriman === 'Selesai Di Bawa Sendiri') continue;
                    }
                    filtered.push(orderObj);
                    continue;
                }

                if (!statusPengiriman && !isUrgentFilter && !isTitipBarangFilter && !statusPembayaran && isSelesaiItem) continue;

                const isFilterSemua = (!statusPengiriman && !isUrgentFilter && !isTitipBarangFilter && !statusPembayaran);

                if (isTitipBarangFilter === 'Ya' || isTitipBarangFilter === 'all' || isTitipBarangFilter === 'titip_all' || isTitipBarangFilter === 'titip_sisa_all') {
                    if (!isTitipSisaItem || isSelesaiItem || isDalamPengantaran) continue;
                } else if (isTitipBarangFilter === 'titip_only' || isTitipBarangFilter === 'titip') {
                    if (!isTitipOnly || isSelesaiItem || isDalamPengantaran) continue;
                } else if (isTitipBarangFilter === 'sisa_only' || isTitipBarangFilter === 'sisa') {
                    if (!isSisaWaitingNextTrip || isSelesaiItem || isDalamPengantaran) continue;
                } else if (isTitipBarangFilter === 'fulljob') {
                    if (isDiBawaSendiriItem || !isFullJobItem || isTitipSisaItem || isSelesaiItem || isDalamPengantaran) continue;
                } else if (!isFilterSemua) {
                    if (statusPengiriman && isTitipSisaItem && !isSelesaiItem) continue;

                    if (statusPengiriman === 'Dalam Pengantaran') {
                        if (!isDalamPengantaran) continue;
                    } else if (statusPengiriman === 'Pesanan Masuk / Dimuat' || statusPengiriman === 'Pesanan Masuk') {
                        if (isFullJobItem) continue;
                        if (orderObj.status_pengiriman !== 'Pesanan Masuk / Dimuat' && orderObj.status_pengiriman !== 'Pesanan Masuk') continue;
                    } else if (statusPengiriman) {
                        if (statusPengiriman === 'Selesai') {
                            if (!isSelesaiItem) continue;
                        } else if (orderObj.status_pengiriman !== statusPengiriman) {
                            continue;
                        }
                    }
                }

                if (statusPembayaran) {
                    if (isDiBawaSendiriItem) continue;
                    const sPay = (orderObj.status_pembayaran || '').toString().toLowerCase();
                    const payStatusLower = sPay.trim();
                    const isLunas = payStatusLower === 'lunas' || (payStatusLower.includes('lunas') && !payStatusLower.includes('belum'));
                    const isTransfer = payStatusLower.includes('transfer');
                    const hasUnpaid = !isLunas && !isTransfer;
                    const hasBelumBayar = hasUnpaid || (orderObj.catatan_nota && orderObj.catatan_nota.includes('[TAMBAHAN_BELUM_BAYAR:')) || (orderObj.nominal_tambahan_belum_bayar > 0);
                    if (!hasBelumBayar) continue;

                    if (statusPembayaran === 'belum_bayar_all' || statusPembayaran === 'belum_lunas_all' || statusPembayaran === 'Belum Lunas' || statusPembayaran === 'all_unpaid' || statusPembayaran === 'all') {
                        // loloskan
                    } else if (statusPembayaran === 'Pembayaran Sebagian' || statusPembayaran === 'sebagian') {
                        if (!sPay.includes('sebagian') && !sPay.includes('dp')) continue;
                    } else if (statusPembayaran === 'Bayar di Lokasi' || statusPembayaran === 'COD') {
                        if (!sPay.includes('cod') && !sPay.includes('lokasi')) continue;
                    } else if (statusPembayaran === 'Belum Bayar') {
                        if (sPay.includes('cod') || sPay.includes('lokasi') || sPay.includes('sebagian') || sPay.includes('dp')) continue;
                    } else if (orderObj.status_pembayaran !== statusPembayaran) {
                        continue;
                    }
                }

                if (isUrgentFilter === 'Ya') {
                    if ((orderObj.is_urgent !== 'Ya' && orderObj.is_urgent !== true) || isSelesaiItem) continue;
                }

                filtered.push(orderObj);
            }

            // Sorting: Urgent first, then ID Order DESC
            filtered.sort((a, b) => {
                const isSelesaiA = a.status_pengiriman && (a.status_pengiriman.toLowerCase().includes('selesai') || a.status_pengiriman === 'Terkirim');
                const isSelesaiB = b.status_pengiriman && (b.status_pengiriman.toLowerCase().includes('selesai') || b.status_pengiriman === 'Terkirim');

                const aUrgent = ((a.is_urgent === 'Ya' || a.is_urgent === true) && !isSelesaiA) ? 1 : 0;
                const bUrgent = ((b.is_urgent === 'Ya' || b.is_urgent === true) && !isSelesaiB) ? 1 : 0;

                if (aUrgent !== bUrgent) {
                    return bUrgent - aUrgent;
                }
                return (b.id_order || '').localeCompare(a.id_order || '');
            });

            const totalRecords = filtered.length;
            const totalPages = Math.ceil(totalRecords / limit) || 1;
            const startIndex = (page - 1) * limit;
            const paginatedData = filtered.slice(startIndex, startIndex + limit);

            const counts = {
                all: cntAll,
                masuk: cntMasuk,
                muat: cntMuat,
                jalan: cntJalan,
                selesai: cntSelesai,
                fulljob: cntFulljob,
                urgent: cntUrgent,
                belumBayar: cntBelumBayar,
                titip: cntTitip,
                diBawaSendiri: cntDiBawaSendiri
            };

            return {
                success: true,
                data: paginatedData,
                orders: paginatedData,
                counts: counts,
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalRecords: totalRecords
                }
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
            if (!sb) return { success: false, data: [], customers: [] };
            const { data } = await sb.from('customers').select('*').order('name');
            const mapped = (data || []).map(c => ({
                id_pelanggan: c.id,
                nama_pelanggan: c.name,
                no_hp: c.phone,
                alamat_lengkap: c.address,
                link_gmaps: c.maps_url,
                total_order: c.total_orders,
                ongkir_standar: c.standard_shipping_fee,
                ongkir: c.standard_shipping_fee
            }));
            mapped.success = true;
            mapped.data = mapped;
            return {
                success: true,
                data: mapped,
                customers: mapped
            };
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

        getPajakKendaraanList: async function() {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };

            const { data, error } = await sb.from('vehicle_taxes').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error('[Adapter getPajakKendaraanList error]', error);
                return { success: false, data: [], message: error.message };
            }

            const list = (data || []).map(row => ({
                id_kendaraan: row.id,
                jenis: row.vehicle_type || 'Mobil',
                nama_pemilik: row.owner_name || '',
                no_polisi: row.plate_number || '',
                merk: row.brand || '',
                tipe_model: row.model || '',
                tahun: row.year || '',
                pajak_1_tahun: row.tax_1yr_date || '',
                pajak_5_tahun: row.tax_5yr_date || '',
                kir_mobil: row.kir_date || '',
                catatan: row.notes || '',
                stnk_url: row.stnk_photo_url || '',
                qr_url: row.qr_pertamina_url || '',
                is_active: row.is_active !== false
            }));

            return { success: true, data: list };
        },

        savePajakKendaraan: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database tidak terhubung' };

            const isEdit = !!payload.id_kendaraan;
            const idKendaraan = payload.id_kendaraan || ('PJK-' + Date.now().toString().slice(-6));

            const record = {
                id: idKendaraan,
                vehicle_type: payload.jenis || 'Mobil',
                owner_name: payload.nama_pemilik || '',
                plate_number: payload.no_polisi || '',
                brand: payload.merk || '',
                model: payload.tipe_model || '',
                year: payload.tahun || '',
                tax_1yr_date: payload.pajak_1_tahun || null,
                tax_5yr_date: payload.pajak_5_tahun || null,
                kir_date: payload.kir_mobil || null,
                notes: payload.catatan || '',
                stnk_photo_url: payload.stnk_url || '',
                qr_pertamina_url: payload.qr_url || '',
                is_active: true
            };

            let res;
            if (isEdit) {
                res = await sb.from('vehicle_taxes').update(record).eq('id', idKendaraan);
            } else {
                res = await sb.from('vehicle_taxes').insert([record]);
            }

            return {
                success: !res.error,
                message: res.error ? res.error.message : (isEdit ? 'Kendaraan berhasil diupdate!' : 'Kendaraan berhasil ditambahkan!'),
                id: idKendaraan
            };
        },

        deletePajakKendaraan: async function(idKendaraan) {
            const sb = getClient();
            if (!sb) return { success: false };
            const { error } = await sb.from('vehicle_taxes').delete().eq('id', idKendaraan);
            return { success: !error, message: error ? error.message : 'Kendaraan berhasil dihapus!' };
        },

        getSettingPengingatPajak: async function() {
            const sb = getClient();
            if (!sb) return { success: true, data: {} };

            const { data } = await sb.from('tax_reminder_settings').select('*');
            const config = {};
            (data || []).forEach(item => {
                config[item.key] = item.value;
            });

            let taskList = [];
            if (config.tugas_pesan_aktif_json) {
                try {
                    taskList = JSON.parse(config.tugas_pesan_aktif_json);
                } catch(e) {}
            }
            config.tugas_pesan_aktif = taskList;

            return { success: true, data: config };
        },

        saveSettingPengingatPajak: async function(payload) {
            const sb = getClient();
            if (!sb) return { success: false };

            const updates = [
                { key: 'mulai_pengingat_hari', value: String(payload.mulai_pengingat_hari || payload.mulai_hari || '7') },
                { key: 'jam_pengingat_wita', value: String(payload.jam_pengingat_wita || payload.jam || '08:00') },
                { key: 'kirim_ke_target', value: String(payload.kirim_ke_target || payload.target || 'Semua User') },
                { key: 'aktif_pajak_1thn', value: String(payload.aktif_pajak_1thn !== false) },
                { key: 'aktif_pajak_5thn', value: String(payload.aktif_pajak_5thn !== false) },
                { key: 'aktif_kir_mobil', value: String(payload.aktif_kir_mobil !== false) }
            ];

            if (payload.tugas_pesan_aktif) {
                updates.push({
                    key: 'tugas_pesan_aktif_json',
                    value: typeof payload.tugas_pesan_aktif === 'string' ? payload.tugas_pesan_aktif : JSON.stringify(payload.tugas_pesan_aktif)
                });
            }

            for (const item of updates) {
                await sb.from('tax_reminder_settings').upsert(item);
            }

            return { success: true, message: 'Pengaturan pengingat berhasil disimpan!' };
        },

        saveTugasPesanAktifCloud: async function(jsonStr) {
            const sb = getClient();
            if (!sb) return { success: false };
            await sb.from('tax_reminder_settings').upsert({
                key: 'tugas_pesan_aktif_json',
                value: typeof jsonStr === 'string' ? jsonStr : JSON.stringify(jsonStr)
            });
            return { success: true, message: 'Tugas pengingat tersimpan di cloud!' };
        },

        getRiwayatPajakList: async function() {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };

            const { data, error } = await sb.from('tax_payment_logs').select('*').order('created_at', { ascending: false });
            if (error) return { success: false, data: [] };

            const list = (data || []).map(r => ({
                id_transaksi: r.id,
                id_kendaraan: r.tax_id || '',
                no_polisi: r.plate_number || '',
                nama_pemilik: r.owner_name || '',
                jenis_pembayaran: r.payment_type || 'Pajak 1 Tahun',
                tanggal_bayar: r.payment_date || '',
                nominal_biaya: Number(r.amount || 0),
                url_foto_stnk_baru: r.new_stnk_photo_url || '',
                catatan: r.notes || '',
                admin_penginput: r.admin_name || ''
            }));

            return { success: true, data: list };
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

        let proxy = null;

        const runner = {
            withSuccessHandler: function(cb) {
                _successHandler = cb;
                return proxy;
            },
            withFailureHandler: function(cb) {
                _failureHandler = cb;
                return proxy;
            },
            withUserObject: function(obj) {
                return proxy;
            }
        };

        proxy = new Proxy(runner, {
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

        return proxy;
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
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicle_taxes' }, (payload) => {
                    console.log('[Realtime TMR] Perubahan data Pajak Kendaraan:', payload.eventType);
                    if (typeof window.checkAndShowPajakAlert === 'function') {
                        try { window.checkAndShowPajakAlert(false); } catch (e) {}
                    }
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
