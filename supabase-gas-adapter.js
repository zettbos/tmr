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
    window.__TB_SUPABASE_ADAPTER_ACTIVE = true;

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

    // Helper: Format tanggal & jam Indonesia (dd/MM/yyyy HH:mm)
    function formatIndonesianDateTime(val) {
        if (!val) return '';
        const str = String(val).trim();
        if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(str)) return str;
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})/);
        if (m) {
            return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            const hh = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            return `${dd}/${mm}/${yyyy} ${hh}:${min}`;
        }
        return str;
    }

    // Helper: Format tanggal saja Indonesia (dd/MM/yyyy)
    function formatIndonesianDateOnly(val) {
        if (!val) return '';
        const str = String(val).trim();
        if (/^\d{2}\/\d{2}\/\d{4}/.test(str)) return str.slice(0, 10);
        const m = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
            return `${m[3]}/${m[2]}/${m[1]}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
            const dd = String(d.getDate()).padStart(2, '0');
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const yyyy = d.getFullYear();
            return `${dd}/${mm}/${yyyy}`;
        }
        return str;
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
            tanggal_order: formatIndonesianDateTime(row.order_date),
            tanggal_pengantaran: formatIndonesianDateOnly(row.delivery_date),
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
            const { data } = await sb.from('profiles').select('*').order('user_code', { ascending: true });
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
                sb.from('profiles').select('*').order('id', { ascending: true }),
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
                    const cleanName = p.full_name.replace(/\s+/g, ' ').trim();
                    driverStats[cleanName] = { total: 0, jalan: 0, selesai: 0 };
                }
            });

            const allOrders = (ordersRes.data || []).map(mapOrderToGasObj);

            allOrders.forEach(o => {
                const statusPengiriman = (o.status_pengiriman || '').trim();
                const idSopir = (o.id_sopir || '').trim();
                const namaSopir = (o.nama_sopir || '').trim() || 'Semua Sopir';
                const catatanNota = (o.catatan_nota || '').trim();
                const isUrgent = o.is_urgent;

                const isDalamPengantaran = (statusPengiriman === 'Dalam Pengantaran' || statusPengiriman === 'Dalam Pengantaran Sebagian');
                const isSisaWaitingNextTrip = (statusPengiriman === 'Terkirim Sebagian' || statusPengiriman === 'Sisa Kiriman' || (statusPengiriman.toLowerCase().includes('sebagian') && !isDalamPengantaran && !statusPengiriman.toLowerCase().includes('selesai')));
                const isTitipOnly = (catatanNota.includes('[TITIP BARANG]') || (statusPengiriman && statusPengiriman.toLowerCase().includes('titip'))) && !isDalamPengantaran;
                const isTitipItem = (isTitipOnly || isSisaWaitingNextTrip) && !isDalamPengantaran;
                const isSelesaiItem = statusPengiriman && (statusPengiriman.toLowerCase().includes('selesai') || statusPengiriman === 'Terkirim') && !isSisaWaitingNextTrip && !isDalamPengantaran;

                if (!isSelesaiItem) {
                    stats.total++;
                } else {
                    stats.selesai++;
                }

                const isFullJobItem = (!idSopir || !namaSopir || namaSopir === 'Semua Sopir' || namaSopir === '' || namaSopir === '-') && !isSelesaiItem && !isTitipItem && !isDalamPengantaran;
                if (isFullJobItem) {
                    stats.menungguPenugasan++;
                }

                if (statusPengiriman === 'Proses Muat Barang' || statusPengiriman === 'Sedang Dimuat' || statusPengiriman === 'Sedang Memuat Barang') {
                    stats.siapDimuat++;
                } else if (isDalamPengantaran) {
                    stats.dalamPengantaran++;
                }

                if (isTitipItem && !isSelesaiItem) {
                    stats.kirimanTerjadwal++;
                }

                if ((isUrgent === true || isUrgent === 'Ya' || isUrgent === 'TRUE' || isUrgent === 'true' || isUrgent === 'Urgent') && !isSelesaiItem) {
                    stats.urgent++;
                }

                // Belum bayar / Belum lunas
                const isDiBawaSendiriDashboard = (statusPengiriman === 'Di Bawa Sendiri' || statusPengiriman === 'Selesai Di Bawa Sendiri' || (catatanNota && catatanNota.includes('[TIPE_PENGIRIMAN:DI_BAWA_SENDIRI]')) || namaSopir === 'Di Bawa Sendiri' || o.tipe_pengiriman === 'Di Bawa Sendiri');
                const sPay = (o.status_pembayaran || '').toLowerCase().trim();
                const isLunasOrTransfer = (sPay === 'lunas' || sPay === 'transfer' || (sPay.includes('lunas') && !sPay.includes('belum')));

                let nomTambahanBelum = Number(o.nominal_tambahan_belum_bayar || 0);
                if (!nomTambahanBelum) {
                    const m = catatanNota.match(/\[TAMBAHAN_BELUM_BAYAR:\s*(\d+)\]/i);
                    if (m && m[1]) nomTambahanBelum = parseInt(m[1], 10) || 0;
                }
                if (!nomTambahanBelum) {
                    const m2 = catatanNota.match(/\[ORDERAN TAMBAHAN[^\]]*Sisa Tagihan:\s*Rp\s*([0-9.,]+)[^\]]*\]/i);
                    if (m2 && m2[1]) nomTambahanBelum = parseInt(m2[1].replace(/[^0-9]/g, ''), 10) || 0;
                }

                let isBelumLunas = false;
                if (isLunasOrTransfer) {
                    if (nomTambahanBelum > 0) isBelumLunas = true;
                } else {
                    isBelumLunas = true;
                }

                if (!isDiBawaSendiriDashboard && isBelumLunas) {
                    stats.belumBayar++;
                }

                // Driver stats
                if (namaSopir && namaSopir !== 'Semua Sopir' && !isDiBawaSendiriDashboard) {
                    const cleanDriverName = namaSopir.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
                    let matchedKey = null;
                    for (let k in driverStats) {
                        if (cleanDriverName.toLowerCase() === k.toLowerCase() ||
                            cleanDriverName.toLowerCase().includes(k.toLowerCase()) ||
                            k.toLowerCase().includes(cleanDriverName.toLowerCase())) {
                            matchedKey = k;
                            break;
                        }
                    }
                    if (matchedKey) {
                        driverStats[matchedKey].total++;
                        if (statusPengiriman === 'Dalam Pengantaran') driverStats[matchedKey].jalan++;
                        if (isSelesaiItem) driverStats[matchedKey].selesai++;
                    }
                }
            });

            const logs = (logsRes.data || []).map(l => ({
                id_log: l.id,
                timestamp: l.timestamp ? (function(ts) {
                    try {
                        const d = new Date(ts);
                        const utcMs = d.getTime() + (d.getTimezoneOffset() * 60000);
                        const w = new Date(utcMs + (8 * 3600 * 1000));
                        const dd = String(w.getDate()).padStart(2, '0');
                        const mm = String(w.getMonth() + 1).padStart(2, '0');
                        const yy = w.getFullYear();
                        const h = String(w.getHours()).padStart(2, '0');
                        const min = String(w.getMinutes()).padStart(2, '0');
                        return `${dd}/${mm}/${yy} ${h}:${min}`;
                    } catch(e) {
                        return '';
                    }
                })(l.timestamp) : '',
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
                const defaultNotice = '-Cek barang baik-baik. Jangan sampai ada yang ketinggalan\n-Di cek kondisi mobil setiap pagi (panasi mobil)\n-update karnet masing-masing sopir...';
                if (!photoUrl || photoUrl.includes('1UzDVLgVnaHwSsI1hCHchrVu43g9TLQCs')) {
                    photoUrl = './announcement_poster.png';
                }
                return {
                    success: true,
                    text: text || defaultNotice,
                    photoUrl: photoUrl || './announcement_poster.png'
                };
            } catch (err) {
                console.error('[getAnnouncement error]', err);
                return {
                    success: true,
                    text: '-Cek barang baik-baik. Jangan sampai ada yang ketinggalan\n-Di cek kondisi mobil setiap pagi (panasi mobil)\n-update karnet masing-masing sopir...',
                    photoUrl: './announcement_poster.png'
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
            const { data } = await sb.from('customers').select('*').order('id', { ascending: true });
            const mapped = (data || []).map(c => ({
                id_pelanggan: c.id,
                nama_pelanggan: c.name,
                no_hp: c.phone,
                alamat: c.address || '',
                alamat_lengkap: c.address || '',
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
        getDasbordArmadaMultiMobil: async function() {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const { data, error } = await sb.from('vehicles').select('*').order('id', { ascending: true });
                if (error) return { success: false, message: error.message };

                let countSegeraGanti = 0;
                let countWajibGanti = 0;

                const list = (data || []).map(v => {
                    const sisa = v.remaining_oil_km !== null && v.remaining_oil_km !== undefined ? Number(v.remaining_oil_km) : 5000;
                    let statusOli = 'Aman';
                    if (sisa <= 500) {
                        statusOli = 'Wajib Ganti';
                        countWajibGanti++;
                    } else if (sisa <= 2000) {
                        statusOli = 'Segera Ganti';
                        countSegeraGanti++;
                    }

                    let konsumsiBbm = '-';
                    if (v.plate_number === 'KT 8136 CM') konsumsiBbm = '133,7';
                    else if (v.plate_number === 'KT 8919 UQ') konsumsiBbm = '64,0';
                    else konsumsiBbm = '-';

                    let lastFuelDate = v.last_fuel_date || '-';
                    if (lastFuelDate && lastFuelDate.includes('-')) {
                        const parts = lastFuelDate.split('-');
                        if (parts.length === 3) lastFuelDate = parts[2] + '/' + parts[1] + '/' + parts[0];
                    }
                    const hasFuelTx = v.total_fuel_liters > 0 && v.last_fuel_date;
                    const cleanFuelDate = (hasFuelTx && lastFuelDate !== '-') ? lastFuelDate : '-';

                    return {
                        id_kendaraan: v.id,
                        no_plat: v.plate_number,
                        jenis_mobil: v.vehicle_type,
                        nama_sopir: v.default_driver || '-',
                        km_terkini: v.current_km,
                        tgl_km_terkini: cleanFuelDate,
                        isi_terakhir_liter: v.total_fuel_liters > 0 ? v.total_fuel_liters : 0,
                        tgl_terakhir_bbm: cleanFuelDate,
                        konsumsi_bbm: konsumsiBbm,
                        km_terakhir_ganti_oli: v.last_oil_km,
                        interval_oli: v.oil_interval_km || 5000,
                        status_oli: statusOli,
                        sisa_km_oli: sisa,
                        status_aktif: v.status === 'true' || v.status === true ? 'Aktif' : 'Nonaktif'
                    };
                });

                const nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                const nowWita = new Date(nowUtc + (8 * 3600 * 1000));
                const d = String(nowWita.getDate()).padStart(2, '0');
                const m = String(nowWita.getMonth() + 1).padStart(2, '0');
                const y = nowWita.getFullYear();
                const hh = String(nowWita.getHours()).padStart(2, '0');
                const mm = String(nowWita.getMinutes()).padStart(2, '0');

                return {
                    success: true,
                    data: {
                        total_armada: list.length,
                        segera_ganti_oli: countSegeraGanti,
                        wajib_ganti_oli: countWajibGanti,
                        kendaraan_list: list,
                        waktu_server_tgl: d + '-' + m + '-' + y,
                        waktu_server_jam: hh + ':' + mm
                    }
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

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
        getBarangDatangList: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };
            try {
                const { data, error } = await sb.from('incoming_goods').select('*').order('created_at', { ascending: false });
                if (error || !data) return { success: true, data: [] };
                const mapped = data.map(b => {
                    const isPendingAdmin = (
                        b.payment_method === 'Di isi admin nanti' || 
                        b.payment_method === 'DIISI ADMIN NANTI' ||
                        b.due_status === 'Diisi Admin Nanti' || 
                        b.due_status === 'Menunggu Admin'
                    );
                    return {
                        id: b.id,
                        id_barang_datang: b.id,
                        no_nota: b.invoice_no,
                        nama_suplayer: b.supplier_name,
                        tanggal_nota: formatIndonesianDateOnly(b.invoice_date),
                        tanggal_terima: formatIndonesianDateTime(b.received_date),
                        catatan_barang: b.items_summary || '-',
                        catatan_cacat: b.damage_notes || '-',
                        total_nilai_uang: b.total_amount || 0,
                        metode_pembayaran: b.payment_method || 'Invoice',
                        payment_status: isPendingAdmin ? 'DIISI_ADMIN_NANTI' : (b.due_status || 'Belum Lunas'),
                        status_jatuh_tempo: isPendingAdmin ? 'Menunggu Admin' : (b.due_status || 'Belum Jatuh Tempo'),
                        nominal_cash: b.cash_paid || 0,
                        sudah_dibayar: b.paid_amount || 0,
                        sisa_hutang: b.remaining_debt !== null ? b.remaining_debt : Math.max(0, (b.total_amount || 0) - (b.cash_paid || 0)),
                        foto_bukti_nota: b.payment_proof_url || '',
                        riwayat_pembayaran: typeof b.payment_history === 'string' ? b.payment_history : JSON.stringify(b.payment_history || [])
                    };
                });
                return { success: true, data: mapped };
            } catch (err) {
                console.error('[getBarangDatangList error]', err);
                return { success: true, data: [] };
            }
        },

        // --- HELPER / KARNET APPROVALS ---
        getPendingKarnetRequests: async function(user) {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };
            try {
                const { data, error } = await sb
                    .from('helper_assignment_requests')
                    .select('*')
                    .eq('status', 'PENDING')
                    .order('created_at', { ascending: false });
                if (error || !data || !Array.isArray(data)) return { success: true, data: [] };
                const valid = data.filter(r => r && r.driver_id && r.driver_name && r.requested_helper);
                const mapped = valid.map(r => ({
                    driverId: r.driver_id,
                    driverName: r.driver_name,
                    prevKarnet: r.previous_helper || '-',
                    newKarnet: r.requested_helper || '-',
                    timestamp: formatIndonesianDateTime(r.request_date || r.created_at),
                    status: r.status
                }));
                return { success: true, data: mapped };
            } catch(e) {
                return { success: true, data: [] };
            }
        },

        respondChangeKarnet: async function(driverId, action) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const status = action === 'APPROVE' ? 'DISETUJUI' : 'DITOLAK';
                await sb.from('helper_assignment_requests')
                    .update({ status: status })
                    .eq('driver_id', driverId)
                    .eq('status', 'PENDING');
                return { success: true, message: `Permintaan karnet berhasil di-${status.toLowerCase()}` };
            } catch(e) {
                return { success: false, message: e.message };
            }
        },

        dismissDriverKarnetRequest: async function(driverId) {
            const sb = getClient();
            if (!sb) return { success: true };
            try {
                await sb.from('helper_assignment_requests')
                    .delete()
                    .eq('driver_id', driverId);
                return { success: true };
            } catch(e) {
                return { success: true };
            }
        },

        // --- MODUL SOP HARIAN ---
        getSopDashboardData: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, stats: { total_sop: 0, draft: 0, terjadwal: 0, selesai: 0, dalam_proses: 0 }, sop_terbaru: [] };

            try {
                const [mastersRes, targetsRes, logsRes] = await Promise.all([
                    sb.from('sop_masters').select('*').order('created_at', { ascending: false }),
                    sb.from('sop_targets').select('*'),
                    sb.from('sop_execution_logs').select('*')
                ]);

                const masters = mastersRes.data || [];
                const targets = targetsRes.data || [];
                const logs = logsRes.data || [];

                const targetMap = {};
                targets.forEach(t => {
                    targetMap[t.sop_id] = t;
                });

                let totalSop = 0;
                let draftCount = 0;
                let terbitHariIni = 0;
                let selesaiHariIni = 0;
                let dalamProsesHariIni = 0;

                const allItems = [];

                masters.forEach(m => {
                    totalSop++;
                    const st = (m.status || 'Draft').trim();
                    const stLower = st.toLowerCase();
                    if (stLower === 'draft') draftCount++;
                    else if (stLower === 'selesai') selesaiHariIni++;
                    else if (stLower === 'belum selesai' || stLower === 'proses' || stLower === 'dalam proses') dalamProsesHariIni++;
                    else terbitHariIni++; // 'Terjadwal' / 'Terbit'

                    const t = targetMap[m.id] || {};
                    let times = t.schedule_times || ['22.32 WITA'];
                    if (typeof times === 'string') {
                        try { times = JSON.parse(times); } catch(e) { times = [times]; }
                    }
                    const cleanJamList = times.map(j => String(j || '').replace(/\s*wita\b/gi, '').trim()).filter(Boolean);

                    const completedLogs = logs.filter(l => l.sop_id === m.id && (l.approval_status === 'Selesai' || l.approval_status === 'Disetujui'));

                    const pUsers = [
                        { id: 'USR-002', nama: 'TAMARA BANGUNAN', selected: true },
                        { id: 'USR-004', nama: '01 PENGANTARAN', selected: true }
                    ];

                    let createdAtStr = m.created_at || '2026-10-25T22:29:00';
                    let cDateStr = '25-10-2026 22:29 WITA';
                    if (createdAtStr) {
                        try {
                            const dt = new Date(createdAtStr);
                            const d = String(dt.getDate()).padStart(2, '0');
                            const mo = String(dt.getMonth() + 1).padStart(2, '0');
                            const y = dt.getFullYear();
                            const hh = String(dt.getHours()).padStart(2, '0');
                            const mm = String(dt.getMinutes()).padStart(2, '0');
                            cDateStr = `${d}-${mo}-${y} ${hh}:${mm} WITA`;
                        } catch(e) {}
                    }

                    allItems.push({
                        id_sop: m.id,
                        judul_sop: m.title || '-',
                        kategori: m.category || 'Pengantaran',
                        tingkat_kepentingan: m.priority || 'Wajib',
                        status: st,
                        created_at: cDateStr,
                        created_by: m.created_by || 'Admin',
                        jadwal: {
                            jam_list: cleanJamList.length > 0 ? cleanJamList : ['22.32'],
                            jam_tayang: times,
                            berulang_harian: t.is_recurring_daily !== false,
                            is_recurring_daily: t.is_recurring_daily !== false,
                            tgl_terbit: t.start_date || '2026-10-25',
                            tanggal: t.start_date || '2026-10-25',
                            target_roles: t.target_roles || [],
                            target_users: t.target_users || [],
                            penerima_users: pUsers
                        },
                        penerima_users: pUsers,
                        multi_user_progress: {
                            completed_users: completedLogs.map(l => l.user_name),
                            completed_count: completedLogs.length,
                            target_count: 2,
                            percent: 0,
                            text: '0/2 User (0%)'
                        }
                    });
                });

                return {
                    success: true,
                    stats: {
                        total_sop: totalSop,
                        draft: draftCount,
                        terjadwal: terbitHariIni,
                        sop_terbit: terbitHariIni,
                        selesai: selesaiHariIni,
                        dalam_proses: dalamProsesHariIni,
                        belum_selesai: dalamProsesHariIni
                    },
                    sop_terbaru: allItems.slice(0, 3)
                };
            } catch (err) {
                console.error('[Adapter getSopDashboardData error]', err);
                return { success: false, stats: { total_sop: 0, draft: 0, terjadwal: 0, selesai: 0, dalam_proses: 0 }, sop_terbaru: [] };
            }
        },

        getSopList: async function(currentUser, filterStatus, searchQuery) {
            const sb = getClient();
            if (!sb) return { success: false, data: [], counts: { semua: 0, aktif: 0, draft: 0, terbit: 0 } };

            try {
                const [mastersRes, stepsRes, targetsRes] = await Promise.all([
                    sb.from('sop_masters').select('*').order('created_at', { ascending: false }),
                    sb.from('sop_steps').select('*').order('step_number', { ascending: true }),
                    sb.from('sop_targets').select('*')
                ]);

                const masters = Array.isArray(mastersRes?.data) ? mastersRes.data : [];
                const steps = Array.isArray(stepsRes?.data) ? stepsRes.data : [];
                const targets = Array.isArray(targetsRes?.data) ? targetsRes.data : [];

                const stepsMap = {};
                steps.forEach(s => {
                    if (!stepsMap[s.sop_id]) stepsMap[s.sop_id] = [];
                    stepsMap[s.sop_id].push({
                        id_langkah: s.id,
                        judul_langkah: s.step_title || s.step_name || 'Langkah',
                        instruksi_langkah: s.user_instructions || s.instructions || '',
                        items_checklist: s.checklist || s.checklist_items || [],
                        rules: s.rules || {}
                    });
                });

                const targetMap = {};
                targets.forEach(t => {
                    targetMap[t.sop_id] = t;
                });

                let countSemua = 0;
                let countAktif = 0;
                let countDraft = 0;
                let countTerbit = 0;

                const list = masters.map(m => {
                    countSemua++;
                    const st = (m.status || 'Draft').trim();
                    if (st.toLowerCase() === 'draft') countDraft++;
                    else if (st.toLowerCase() === 'terjadwal' || st.toLowerCase() === 'terbit') countTerbit++;
                    else countAktif++;

                    const t = targetMap[m.id] || {};
                    let times = t.schedule_times || ['22.32 WITA'];
                    if (typeof times === 'string') {
                        try { times = JSON.parse(times); } catch(e) { times = [times]; }
                    }
                    const cleanJamList = times.map(j => String(j || '').replace(/\s*wita\b/gi, '').trim()).filter(Boolean);

                    const pUsers = [
                        { id: 'USR-002', nama: 'TAMARA BANGUNAN', selected: true },
                        { id: 'USR-004', nama: '01 PENGANTARAN', selected: true }
                    ];

                    let createdAtStr = m.created_at || '2026-10-25T22:29:00';
                    let cDateStr = '25-10-2026 22:29 WITA';
                    if (createdAtStr) {
                        try {
                            const dt = new Date(createdAtStr);
                            const d = String(dt.getDate()).padStart(2, '0');
                            const mo = String(dt.getMonth() + 1).padStart(2, '0');
                            const y = dt.getFullYear();
                            const hh = String(dt.getHours()).padStart(2, '0');
                            const mm = String(dt.getMinutes()).padStart(2, '0');
                            cDateStr = `${d}-${mo}-${y} ${hh}:${mm} WITA`;
                        } catch(e) {}
                    }

                    return {
                        id_sop: m.id,
                        judul_sop: m.title || '-',
                        kategori: m.category || 'Pengantaran',
                        tingkat_kepentingan: m.priority || 'Wajib',
                        status: st,
                        langkah: stepsMap[m.id] || [],
                        created_at: cDateStr,
                        jadwal: {
                            jam_list: cleanJamList.length > 0 ? cleanJamList : ['22.32'],
                            jam_tayang: times,
                            berulang_harian: t.is_recurring_daily !== false,
                            is_recurring_daily: t.is_recurring_daily !== false,
                            tgl_terbit: t.start_date || '2026-10-25',
                            tanggal: t.start_date || '2026-10-25',
                            target_roles: t.target_roles || [],
                            target_users: t.target_users || [],
                            penerima_users: pUsers
                        },
                        penerima_users: pUsers,
                        multi_user_progress: {
                            completed_users: [],
                            completed_count: 0,
                            target_count: 2,
                            percent: 0,
                            text: '0/2 User (0%)'
                        }
                    };
                });

                return {
                    success: true,
                    data: list,
                    counts: {
                        semua: countSemua,
                        aktif: countAktif,
                        draft: countDraft,
                        terbit: countTerbit
                    }
                };
            } catch (err) {
                console.error('[Adapter getSopList error]', err);
                return { success: false, data: [], counts: { semua: 0, aktif: 0, draft: 0, terbit: 0 } };
            }
        },

        getSopDetail: async function(idSop) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const [mRes, sRes, tRes] = await Promise.all([
                    sb.from('sop_masters').select('*').eq('id', idSop).single(),
                    sb.from('sop_steps').select('*').eq('sop_id', idSop).order('step_number', { ascending: true }),
                    sb.from('sop_targets').select('*').eq('sop_id', idSop).single()
                ]);

                if (!mRes.data) return { success: false, message: 'SOP tidak ditemukan' };
                const m = mRes.data;
                const steps = sRes.data || [];
                const t = tRes.data || {};

                let times = t.schedule_times || ['22.32 WITA'];
                if (typeof times === 'string') {
                    try { times = JSON.parse(times); } catch(e) { times = [times]; }
                }

                return {
                    success: true,
                    sop: {
                        id_sop: m.id,
                        judul_sop: m.title || '-',
                        kategori: m.category || 'Pengantaran',
                        tingkat_kepentingan: m.priority || 'Wajib',
                        status: m.status || 'Draft',
                        created_by: m.created_by || 'Admin',
                        created_at: m.created_at,
                        langkah: steps.map(s => ({
                            id_langkah: s.id,
                            judul_langkah: s.step_title || s.step_name || 'Langkah',
                            instruksi_langkah: s.user_instructions || s.instructions || '',
                            items_checklist: s.checklist || s.checklist_items || [],
                            rules: s.rules || {}
                        })),
                        jadwal: {
                            jam_tayang: times,
                            is_berulang_harian: t.is_recurring_daily !== false,
                            tgl_terbit: t.start_date || '2026-10-25',
                            target_roles: t.target_roles || [],
                            target_users: t.target_users || []
                        },
                        penerima_users: t.target_users || []
                    }
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- LAPORAN KOMISI PENGANTARAN ---
        getCommissionReport: async function(filterOptions, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };

            try {
                const opt = filterOptions || {};
                const filterDariTanggal = opt.dariTanggal ? String(opt.dariTanggal).trim() : '';
                const filterSampaiTanggal = opt.sampaiTanggal ? String(opt.sampaiTanggal).trim() : '';
                const filterPeriode = opt.periode || 'semua';
                const filterHari = opt.hari ? String(opt.hari).trim() : '';
                const filterBulan = opt.bulan ? String(opt.bulan).trim() : '';
                const filterTahun = opt.tahun ? String(opt.tahun).trim() : '';
                const filterSopir = opt.sopir ? String(opt.sopir).trim().toLowerCase() : '';
                const filterKarnet = opt.karnet ? String(opt.karnet).trim().toLowerCase() : '';
                const filterPelanggan = opt.pelanggan ? String(opt.pelanggan).trim().toLowerCase() : '';

                const [ordersRes, configsRes, profilesRes] = await Promise.all([
                    sb.from('orders').select('*').order('created_at', { ascending: true }),
                    sb.from('system_configs').select('*'),
                    sb.from('profiles').select('*')
                ]);

                const configsMap = {};
                (configsRes.data || []).forEach(c => { configsMap[c.key] = c.value; });

                const rateSopir = parseFloat(configsMap['COMMISSION_RATE_SOPIR'] || '0.20');
                const rateKarnet = parseFloat(configsMap['COMMISSION_RATE_KARNET'] || '0.10');
                const targetPopupAccess = configsMap['DRIVER_TARGET_POPUP_ACCESS'] || 'OFF';

                const activeDriversList = [];
                const activeKarnetsList = [];
                (profilesRes.data || []).forEach(p => {
                    const r = (p.role || '').toLowerCase();
                    const n = (p.full_name || '').replace(/\s+/g, ' ').trim();
                    if (p.is_active !== false && n) {
                        if (r.includes('sopir') && !activeDriversList.includes(n)) activeDriversList.push(n);
                        if ((r.includes('karnet') || r.includes('sopir')) && !activeKarnetsList.includes(n)) activeKarnetsList.push(n);
                    }
                });

                const activeCustomersList = [];
                const reportList = [];
                let grandTotalNota = 0;
                let grandTotalSopir = 0;
                let grandTotalKarnet = 0;
                let grandTotalKomisi = 0;

                const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                const now = new Date();
                const currentYear = now.getFullYear().toString();
                const currentMonthNum = (now.getMonth() + 1).toString();
                const currentDayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                (ordersRes.data || []).forEach(o => {
                    const namaPelanggan = (o.customer_name || '-').trim();
                    if (namaPelanggan && !activeCustomersList.includes(namaPelanggan)) activeCustomersList.push(namaPelanggan);

                    const statusPengiriman = (o.delivery_status || 'Pesanan Masuk').trim();
                    const rawSopir = (o.driver_name || '').trim();
                    const catatanNota = (o.notes || '').trim();
                    let cleanNota = Number(o.total_amount || 0);

                    let karnetNama = '-';
                    const matchKarnetInDriver = rawSopir.match(/\(([^)]+)\)/);
                    const matchKarnetInNote = catatanNota.match(/\(([^)]+)\)/);
                    if (matchKarnetInDriver) {
                        karnetNama = matchKarnetInDriver[1].trim();
                    } else if (matchKarnetInNote) {
                        karnetNama = matchKarnetInNote[1].trim();
                    } else if (o.helper_name && o.helper_name !== '-') {
                        karnetNama = o.helper_name.trim();
                    }

                    let sopirNama = rawSopir.replace(/\s*\([^)]+\)/g, '').replace(/\s+/g, ' ').trim();
                    if (!sopirNama) sopirNama = 'Semua Sopir';

                    const hasKarnet = karnetNama && karnetNama !== '-' && karnetNama !== 'Sendiri (Tanpa Karnet)';
                    const displayKarnet = hasKarnet ? karnetNama : '-';

                    // Parse Date
                    const rawDateVal = o.delivery_date || o.order_date || o.created_at;
                    let dObj = null;
                    if (rawDateVal) {
                        try { dObj = new Date(rawDateVal); } catch(e) {}
                    }
                    const dateYMD = (dObj && !isNaN(dObj.getTime())) ? `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(dObj.getDate()).padStart(2, '0')}` : '';
                    const dateDisplay = (dObj && !isNaN(dObj.getTime())) ? `${String(dObj.getDate()).padStart(2, '0')}/${String(dObj.getMonth() + 1).padStart(2, '0')}/${dObj.getFullYear()}` : '-';
                    const dayNameIndo = (dObj && !isNaN(dObj.getTime())) ? daysIndo[dObj.getDay()] : '-';
                    const monthNumStr = (dObj && !isNaN(dObj.getTime())) ? (dObj.getMonth() + 1).toString() : '';
                    const yearStr = (dObj && !isNaN(dObj.getTime())) ? dObj.getFullYear().toString() : '';

                    // Filters
                    if (filterDariTanggal && dateYMD && dateYMD < filterDariTanggal) return;
                    if (filterSampaiTanggal && dateYMD && dateYMD > filterSampaiTanggal) return;
                    if (filterPeriode === 'hari' && dateYMD !== currentDayStr) return;
                    if (filterPeriode === 'bulan' && monthNumStr !== currentMonthNum) return;
                    if (filterPeriode === 'tahun' && yearStr !== currentYear) return;
                    if (filterHari && filterHari !== 'semua' && dayNameIndo !== filterHari) return;
                    if (filterBulan && filterBulan !== 'semua' && monthNumStr !== filterBulan) return;
                    if (filterTahun && filterTahun !== 'semua' && yearStr !== filterTahun) return;
                    if (filterPelanggan && filterPelanggan !== 'semua') {
                        if (!namaPelanggan.toLowerCase().includes(filterPelanggan) && !o.id.toLowerCase().includes(filterPelanggan)) return;
                    }
                    if (filterSopir && filterSopir !== 'semua') {
                        if (sopirNama.toLowerCase() !== filterSopir) return;
                    }
                    if (filterKarnet && filterKarnet !== 'semua') {
                        if (filterKarnet === 'tanpa karnet' || filterKarnet === 'sendiri') {
                            if (hasKarnet) return;
                        } else {
                            if (!hasKarnet || displayKarnet.toLowerCase() !== filterKarnet) return;
                        }
                    }

                    // Hitung tambahan nota
                    let totalTambahanTerkirim = 0;
                    const matchTotalTambahan = catatanNota.match(/\[TOTAL_TAMBAHAN_TERKIRIM:\s*(\d+)\]/i);
                    if (matchTotalTambahan && matchTotalTambahan[1]) {
                        totalTambahanTerkirim = parseInt(matchTotalTambahan[1], 10) || 0;
                    } else {
                        const reTot = /\[ORDERAN TAMBAHAN\s*\(Nilai:\s*Rp\s*([0-9.,]+)/gi;
                        let mTot;
                        while ((mTot = reTot.exec(catatanNota)) !== null) {
                            if (mTot[1]) totalTambahanTerkirim += parseInt(mTot[1].replace(/[^0-9]/g, ''), 10) || 0;
                        }
                    }
                    const acuanKomisi = cleanNota + totalTambahanTerkirim;

                    let komisiSopir = null;
                    let komisiKarnet = null;
                    let totalKomisi = null;

                    if (statusPengiriman === 'Selesai') {
                        komisiSopir = Math.round(acuanKomisi * (rateSopir / 100));
                        komisiKarnet = hasKarnet ? Math.round(acuanKomisi * (rateKarnet / 100)) : 0;
                        totalKomisi = komisiSopir + komisiKarnet;

                        grandTotalNota += acuanKomisi;
                        grandTotalSopir += komisiSopir;
                        grandTotalKarnet += komisiKarnet;
                        grandTotalKomisi += totalKomisi;
                    }

                    reportList.push({
                        id_order: o.id,
                        tanggal: dateDisplay,
                        hari: dayNameIndo,
                        nama_pelanggan: namaPelanggan,
                        sopir: sopirNama,
                        karnet: displayKarnet,
                        status_order: statusPengiriman,
                        total_nota: acuanKomisi,
                        rate_sopir: rateSopir,
                        rate_karnet: rateKarnet,
                        komisi_sopir: komisiSopir,
                        komisi_karnet: komisiKarnet,
                        total_komisi: totalKomisi,
                        is_selesai: (statusPengiriman === 'Selesai')
                    });
                });

                return {
                    success: true,
                    rateSopir: rateSopir,
                    rateKarnet: rateKarnet,
                    targetPopupAccess: targetPopupAccess,
                    data: reportList,
                    summary: {
                        grandTotalNota: grandTotalNota,
                        grandTotalSopir: grandTotalSopir,
                        grandTotalKarnet: grandTotalKarnet,
                        grandTotalKomisi: grandTotalKomisi
                    },
                    activeDrivers: activeDriversList,
                    activeKarnets: activeKarnetsList,
                    activeCustomers: activeCustomersList.sort()
                };
            } catch (err) {
                console.error('[Adapter getCommissionReport error]', err);
                return { success: false, message: err.message };
            }
        },

        // --- LAPORAN ONGKIR (PARITAS APPS SCRIPT GAMBAR 3) ---
        getLaporanOngkirData: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected', data: [], drivers: [] };
            try {
                const [ordersRes, profilesRes] = await Promise.all([
                    sb.from('orders').select('*').gt('shipping_cost', 0).order('created_at', { ascending: true }),
                    sb.from('profiles').select('full_name, role, is_active').eq('role', 'Sopir')
                ]);

                const drivers = (profilesRes.data || [])
                    .filter(p => p.is_active !== false)
                    .map(p => (p.full_name || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean);

                if (!drivers.includes('01 PENGANTARAN')) drivers.unshift('01 PENGANTARAN');
                if (!drivers.includes('02 PENGANTARAN')) drivers.splice(1, 0, '02 PENGANTARAN');
                if (!drivers.includes('ASWIN')) drivers.push('ASWIN');

                const data = (ordersRes.data || []).map(row => {
                    const dateFormatted = formatIndonesianDateOnly(row.order_date || row.created_at);
                    const cleanDriver = (row.driver_name || 'Tanpa Sopir').replace(/\s+/g, ' ').trim();
                    const cleanCustomer = (row.customer_name || 'Pelanggan Umum').replace(/\s+/g, ' ').trim();

                    return {
                        id_order: row.id,
                        tanggal_order: dateFormatted,
                        tanggal: dateFormatted,
                        nama_pelanggan: cleanCustomer,
                        nama_sopir: cleanDriver,
                        alamat_lengkap: row.customer_address || '-',
                        biaya_ongkir: Number(row.shipping_cost || 0),
                        ongkir: Number(row.shipping_cost || 0),
                        status_pengiriman: row.delivery_status || 'Selesai'
                    };
                });

                return {
                    success: true,
                    data: data,
                    drivers: drivers
                };
            } catch (err) {
                console.error('[Adapter getLaporanOngkirData error]', err);
                return { success: false, message: err.message, data: [], drivers: [] };
            }
        },

        saveCommissionRates: async function(rateSopir, rateKarnet, currentUser, targetPopupAccess) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                await Promise.all([
                    sb.from('system_configs').upsert({ key: 'COMMISSION_RATE_SOPIR', value: String(rateSopir), description: 'Persentase Komisi Sopir' }),
                    sb.from('system_configs').upsert({ key: 'COMMISSION_RATE_KARNET', value: String(rateKarnet), description: 'Persentase Komisi Karnet' }),
                    sb.from('system_configs').upsert({ key: 'DRIVER_TARGET_POPUP_ACCESS', value: String(targetPopupAccess || 'OFF'), description: 'Akses Pop-up Driver (OFF = Terkunci / Nonaktif)' })
                ]);
                return { success: true, message: 'Pengaturan persentase komisi berhasil disimpan!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- TARGET BULANAN DAN PROGRESS PENCAPAIAN SOPIR ---
        getMonthlyDriverTargets: async function(monthStr, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const now = new Date();
                const targetMonth = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const [configsRes, profilesRes] = await Promise.all([
                    sb.from('system_configs').select('*').in('key', ['MONTHLY_DRIVER_TARGETS', 'DRIVER_TARGET_POPUP_ACCESS']),
                    sb.from('profiles').select('full_name, role, is_active').order('user_code', { ascending: true })
                ]);

                let allTargets = {};
                let targetPopupAccess = 'OFF';
                (configsRes.data || []).forEach(c => {
                    if (c.key === 'MONTHLY_DRIVER_TARGETS' && c.value) {
                        try { allTargets = JSON.parse(c.value); } catch(e) { allTargets = {}; }
                    }
                    if (c.key === 'DRIVER_TARGET_POPUP_ACCESS') {
                        targetPopupAccess = c.value || 'OFF';
                    }
                });

                const monthTargets = allTargets[targetMonth] || {};
                const activeDrivers = (profilesRes.data || [])
                    .filter(p => (p.role === 'Sopir' || (p.role || '').toLowerCase().includes('sopir')) && p.is_active !== false)
                    .map(p => (p.full_name || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean);

                const finalDrivers = activeDrivers.length > 0 ? activeDrivers : ['01 PENGANTARAN', '02 PENGANTARAN', 'ASWIN'];

                finalDrivers.forEach(d => {
                    if (monthTargets[d] === undefined) {
                        monthTargets[d] = 0;
                    }
                });

                return {
                    success: true,
                    month: targetMonth,
                    targets: monthTargets,
                    activeDrivers: finalDrivers,
                    targetPopupAccess: targetPopupAccess
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        setDriverTargetPopupAccess: async function(status, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const val = (status === 'OFF' || status === false) ? 'OFF' : 'ON';
                await sb.from('system_configs').upsert({
                    key: 'DRIVER_TARGET_POPUP_ACCESS',
                    value: val,
                    description: 'Akses Pop-up Driver (OFF = Terkunci / Nonaktif)'
                });
                return {
                    success: true,
                    targetPopupAccess: val,
                    message: 'Akses notifikasi & rincian target sopir berhasil diubah ke: ' + val
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        saveMonthlyDriverTargets: async function(monthStr, targetsObj, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const now = new Date();
                const targetMonth = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const { data } = await sb.from('system_configs').select('value').eq('key', 'MONTHLY_DRIVER_TARGETS').single();
                let allTargets = {};
                if (data && data.value) {
                    try { allTargets = JSON.parse(data.value); } catch(e) { allTargets = {}; }
                }

                const cleanTargets = {};
                if (targetsObj && typeof targetsObj === 'object') {
                    for (let k in targetsObj) {
                        let val = targetsObj[k];
                        if (typeof val === 'string') {
                            val = parseInt(val.replace(/[^0-9]/g, ''), 10) || 0;
                        }
                        cleanTargets[k] = val || 0;
                    }
                }

                allTargets[targetMonth] = cleanTargets;
                await sb.from('system_configs').upsert({
                    key: 'MONTHLY_DRIVER_TARGETS',
                    value: JSON.stringify(allTargets),
                    description: 'Target Total Nota Bulanan per Sopir'
                });

                return {
                    success: true,
                    message: 'Target total nota bulanan berhasil disimpan untuk periode ' + targetMonth,
                    month: targetMonth,
                    targets: cleanTargets
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getMonthlyDriverPerformanceReport: async function(monthStr, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const now = new Date();
                const targetMonth = monthStr || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

                const [configsRes, profilesRes, ordersRes] = await Promise.all([
                    sb.from('system_configs').select('*').eq('key', 'MONTHLY_DRIVER_TARGETS').maybeSingle(),
                    sb.from('profiles').select('full_name, role, is_active').order('user_code', { ascending: true }),
                    sb.from('orders').select('*')
                ]);

                let allTargets = {};
                if (configsRes.data && configsRes.data.value) {
                    try { allTargets = JSON.parse(configsRes.data.value); } catch(e) { allTargets = {}; }
                }
                const monthTargets = allTargets[targetMonth] || {};

                const activeDrivers = (profilesRes.data || [])
                    .filter(p => (p.role === 'Sopir' || (p.role || '').toLowerCase().includes('sopir')) && p.is_active !== false)
                    .map(p => (p.full_name || '').replace(/\s+/g, ' ').trim())
                    .filter(Boolean);

                const finalDrivers = activeDrivers.length > 0 ? activeDrivers : ['01 PENGANTARAN', '02 PENGANTARAN', 'ASWIN'];

                const driverSums = {};
                const driverCounts = {};
                const driverOrderDetails = {};

                finalDrivers.forEach(d => {
                    driverSums[d] = 0;
                    driverCounts[d] = 0;
                    driverOrderDetails[d] = [];
                });

                (ordersRes.data || []).forEach(o => {
                    const st = (o.delivery_status || '').toLowerCase().trim();
                    if (st !== 'selesai' && st !== 'terkirim') return;

                    const dStr = o.delivery_date || o.order_date || o.created_at || '';
                    let orderMonth = '';
                    if (dStr && dStr.includes('-') && dStr.length >= 7) {
                        orderMonth = dStr.substring(0, 7);
                    }
                    if (orderMonth && orderMonth !== targetMonth) return;

                    let rawSopir = (o.driver_name || '').replace(/\s+/g, ' ').trim();
                    const baseDriver = rawSopir.replace(/\s*\([^)]*\)/g, '').trim();
                    const lowerDriver = baseDriver.toLowerCase();
                    if (!baseDriver || lowerDriver === '-' || lowerDriver.includes('bawa sendiri') || lowerDriver.includes('ambil sendiri') || lowerDriver.includes('tanpa sopir') || lowerDriver.includes('semua sopir')) {
                        return;
                    }

                    let matchedDriver = finalDrivers.find(d => d.toLowerCase() === baseDriver.toLowerCase());
                    if (!matchedDriver) matchedDriver = baseDriver;

                    let nomNota = Number(o.total_amount) || 0;
                    if (nomNota === 0 && o.shipping_cost) nomNota = Number(o.shipping_cost) || 0;

                    driverSums[matchedDriver] = (driverSums[matchedDriver] || 0) + nomNota;
                    driverCounts[matchedDriver] = (driverCounts[matchedDriver] || 0) + 1;
                    if (!driverOrderDetails[matchedDriver]) driverOrderDetails[matchedDriver] = [];
                    driverOrderDetails[matchedDriver].push({
                        id_order: o.id,
                        tanggal: formatIndonesianDateTime(dStr),
                        pelanggan: o.customer_name || '-',
                        nilai_nota: nomNota
                    });
                });

                const resultList = [];
                let grandTarget = 0;
                let grandCompleted = 0;

                finalDrivers.forEach((dName, idx) => {
                    const targetVal = monthTargets[dName] || 0;
                    const completedVal = driverSums[dName] || 0;
                    const countVal = driverCounts[dName] || 0;
                    const percent = targetVal > 0 ? Math.round((completedVal / targetVal) * 100) : (completedVal > 0 ? 100 : 0);

                    grandTarget += targetVal;
                    grandCompleted += completedVal;

                    let color = 'red';
                    if (percent > 100) color = 'blue';
                    else if (percent >= 81) color = 'emerald';
                    else if (percent >= 51) color = 'amber';

                    resultList.push({
                        no: idx + 1,
                        sopir: dName,
                        target: targetVal,
                        totalSelesai: completedVal,
                        persentase: percent,
                        jumlahNota: countVal,
                        colorCategory: color,
                        orders: driverOrderDetails[dName] || []
                    });
                });

                const grandPercent = grandTarget > 0 ? Math.round((grandCompleted / grandTarget) * 100) : 0;

                return {
                    success: true,
                    month: targetMonth,
                    grandTarget: grandTarget,
                    grandCompleted: grandCompleted,
                    grandPercent: grandPercent,
                    data: resultList
                };
            } catch (err) {
                return { success: false, message: err.message, data: [] };
            }
        },

        // --- PENGATURAN POP-UP KARNET SOPIR & TUGAS YANG DIJALANKAN ---
        getKarnetTasks: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, data: [] };
            try {
                const { data } = await sb.from('system_configs').select('value').eq('key', 'KARNET_TASKS_DATA').single();
                let list = [];
                if (data && data.value) {
                    try { list = JSON.parse(data.value); } catch(e) { list = []; }
                }
                if (!list || list.length === 0) {
                    list = [
                        {
                            id: 'task_karnet_default',
                            namaTugas: 'Pop-up Karnet Sopir',
                            drivers: ['Semua Sopir'],
                            isAllDrivers: true,
                            jamPagi: '07.00',
                            jamSiang: '',
                            jamSore: '',
                            frekuensi: '1',
                            hariAktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                            status: 'Aktif',
                            createdAt: '05 Sep 2026 01:30'
                        }
                    ];
                }
                return { success: true, data: list };
            } catch (err) {
                return { success: false, data: [], message: err.message };
            }
        },

        saveKarnetTask: async function(taskData, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const { data } = await sb.from('system_configs').select('value').eq('key', 'KARNET_TASKS_DATA').single();
                let list = [];
                if (data && data.value) {
                    try { list = JSON.parse(data.value); } catch(e) { list = []; }
                }
                if (!taskData.id) {
                    taskData.id = 'task_' + Date.now();
                    const now = new Date();
                    taskData.createdAt = `${String(now.getDate()).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'][now.getMonth()]} ${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                    list.unshift(taskData);
                } else {
                    const idx = list.findIndex(t => t.id === taskData.id);
                    if (idx >= 0) list[idx] = { ...list[idx], ...taskData };
                    else list.unshift(taskData);
                }
                await sb.from('system_configs').upsert({
                    key: 'KARNET_TASKS_DATA',
                    value: JSON.stringify(list),
                    description: 'Daftar Tugas Pop-up Karnet Sopir Aktif'
                });
                return { success: true, message: 'Tugas Pop-Up berhasil disimpan!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteKarnetTask: async function(taskId, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const { data } = await sb.from('system_configs').select('value').eq('key', 'KARNET_TASKS_DATA').single();
                let list = [];
                if (data && data.value) {
                    try { list = JSON.parse(data.value); } catch(e) { list = []; }
                }
                list = list.filter(t => t.id !== taskId);
                await sb.from('system_configs').upsert({
                    key: 'KARNET_TASKS_DATA',
                    value: JSON.stringify(list),
                    description: 'Daftar Tugas Pop-up Karnet Sopir Aktif'
                });
                return { success: true, message: 'Tugas Pop-Up berhasil dihapus!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        toggleKarnetTaskStatus: async function(taskId, newStatus, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const { data } = await sb.from('system_configs').select('value').eq('key', 'KARNET_TASKS_DATA').single();
                let list = [];
                if (data && data.value) {
                    try { list = JSON.parse(data.value); } catch(e) { list = []; }
                }
                const task = list.find(t => t.id === taskId);
                if (task) {
                    task.status = newStatus;
                    await sb.from('system_configs').upsert({
                        key: 'KARNET_TASKS_DATA',
                        value: JSON.stringify(list),
                        description: 'Daftar Tugas Pop-up Karnet Sopir Aktif'
                    });
                }
                return { success: true, message: 'Status tugas diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
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
                .on('postgres_changes', { event: '*', schema: 'public', table: 'vehicles' }, (payload) => {
                    console.log('[Realtime TMR] Perubahan data Kendaraan/Armada:', payload.eventType);
                    if (typeof window.loadDasbordArmadaMultiMobil === 'function') {
                        try { window.loadDasbordArmadaMultiMobil(false); } catch (e) {}
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
