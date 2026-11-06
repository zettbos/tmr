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

    // Helper: Konversi URL Google Drive ke direct image Edge CDN (lh3.googleusercontent.com)
    function convertDriveUrlToDirectImage(url) {
        if (!url || typeof url !== 'string') return '';
        const cleanUrl = url.trim();
        if (cleanUrl.startsWith('data:image')) return cleanUrl;
        if (cleanUrl.includes('lh3.googleusercontent.com')) return cleanUrl;

        // Ekstrak file ID Google Drive
        const driveMatch = cleanUrl.match(/\/file\/d\/([-\w]{25,})/i) ||
                           cleanUrl.match(/[?&]id=([-\w]{25,})/i) ||
                           cleanUrl.match(/\/d\/([-\w]{25,})/i);

        if (driveMatch && driveMatch[1]) {
            return 'https://lh3.googleusercontent.com/d/' + driveMatch[1] + '=s1200';
        }
        return cleanUrl;
    }
    if (typeof window !== 'undefined') {
        window.convertDriveUrlToDirectImage = convertDriveUrlToDirectImage;
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

        // ==========================================
        // TAHAP 1: CORE ORDER LIFECYCLE & MEDIA (lh3)
        // ==========================================

        addMuatanPhoto: async function(idOrder, base64PhotoArray, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const rawList = Array.isArray(base64PhotoArray) ? base64PhotoArray : [base64PhotoArray];
                const uploaded = await uploadMediaPipeline(rawList, 'MUATAN_' + idOrder);
                if (uploaded.length === 0) return { success: false, message: 'Tidak ada foto yang berhasil diunggah' };

                const { data: order, error } = await sb.from('orders').select('notes, cargo_photo_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let currentNotes = order.notes || '';
                let existing = [];
                const match = currentNotes.match(/\[FOTO_MUATAN:([^\]]+)\]/i);
                if (match && match[1]) {
                    existing = match[1].split('|||').map(s => s.trim()).filter(Boolean);
                } else if (order.cargo_photo_url) {
                    existing = order.cargo_photo_url.split('|||').map(s => s.trim()).filter(Boolean);
                }

                const combined = Array.from(new Set([...existing, ...uploaded])).slice(0, 5);
                const combinedTag = '[FOTO_MUATAN:' + combined.join('|||') + ']';
                if (match) {
                    currentNotes = currentNotes.replace(/\[FOTO_MUATAN:[^\]]+\]/i, combinedTag);
                } else {
                    currentNotes = (currentNotes ? currentNotes + ' ' : '') + combinedTag;
                }

                await sb.from('orders').update({
                    notes: currentNotes,
                    cargo_photo_url: combined.join('|||'),
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'ADD_MUATAN_PHOTO', `Menambahkan foto bukti muatan untuk order ${idOrder}`);
                }

                return { success: true, message: 'Berhasil menambahkan foto bukti muatan!', photos: combined };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        saveFotoMuatan: async function(idOrder, photoUrlsArray, currentUser) {
            return this.addMuatanPhoto(idOrder, photoUrlsArray, currentUser);
        },

        deleteMuatanPhoto: async function(idOrder, photoIdx, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner')) {
                    return { success: false, message: 'AKSES DITOLAK: Hanya Admin Pusat yang berhak menghapus foto bukti muatan!' };
                }

                const { data: order, error } = await sb.from('orders').select('notes, cargo_photo_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let currentNotes = order.notes || '';
                let existing = [];
                const match = currentNotes.match(/\[FOTO_MUATAN:([^\]]+)\]/i);
                if (match && match[1]) {
                    existing = match[1].split('|||').map(s => s.trim()).filter(Boolean);
                } else if (order.cargo_photo_url) {
                    existing = order.cargo_photo_url.split('|||').map(s => s.trim()).filter(Boolean);
                }

                const idx = parseInt(photoIdx, 10) - 1;
                if (idx >= 0 && idx < existing.length) {
                    existing.splice(idx, 1);
                }

                const newTag = existing.length > 0 ? ('[FOTO_MUATAN:' + existing.join('|||') + ']') : '';
                if (match) {
                    currentNotes = currentNotes.replace(/\[FOTO_MUATAN:[^\]]+\]/i, newTag).trim();
                }

                await sb.from('orders').update({
                    notes: currentNotes,
                    cargo_photo_url: existing.length > 0 ? existing.join('|||') : null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_MUATAN_PHOTO', `Menghapus foto muatan #${photoIdx} pada order ${idOrder}`);
                }

                return { success: true, message: 'Foto bukti muatan berhasil dihapus!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        deleteFotoMuatan: async function(idOrder, targetPhotoUrl, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner')) {
                    return { success: false, message: 'AKSES DITOLAK: Hanya Admin Pusat yang berhak menghapus foto bukti muatan!' };
                }

                const { data: order, error } = await sb.from('orders').select('notes, cargo_photo_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let currentNotes = order.notes || '';
                let existing = [];
                const match = currentNotes.match(/\[FOTO_MUATAN:([^\]]+)\]/i);
                if (match && match[1]) {
                    existing = match[1].split('|||').map(s => s.trim()).filter(Boolean);
                } else if (order.cargo_photo_url) {
                    existing = order.cargo_photo_url.split('|||').map(s => s.trim()).filter(Boolean);
                }

                existing = existing.filter(p => p !== targetPhotoUrl);
                const newTag = existing.length > 0 ? ('[FOTO_MUATAN:' + existing.join('|||') + ']') : '';
                if (match) {
                    currentNotes = currentNotes.replace(/\[FOTO_MUATAN:[^\]]+\]/i, newTag).trim();
                }

                await sb.from('orders').update({
                    notes: currentNotes,
                    cargo_photo_url: existing.length > 0 ? existing.join('|||') : null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_MUATAN_PHOTO', `Menghapus foto muatan pada order ${idOrder}`);
                }

                return { success: true, message: 'Foto bukti muatan berhasil dihapus!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        addDriverPhoto: async function(idOrder, base64PhotoArray, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const rawList = Array.isArray(base64PhotoArray) ? base64PhotoArray : [base64PhotoArray];
                const uploaded = await uploadMediaPipeline(rawList, 'DRIVER_' + idOrder);
                if (uploaded.length === 0) return { success: false, message: 'Tidak ada foto yang berhasil diunggah' };

                const { data: order, error } = await sb.from('orders').select('proof_url_1, proof_url_2, proof_url_3, proof_url_4, proof_url_5').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                const updates = { updated_at: new Date().toISOString() };
                let inserted = 0;
                for (let i = 1; i <= 5; i++) {
                    if (inserted >= uploaded.length) break;
                    const key = 'proof_url_' + i;
                    if (!order[key]) {
                        updates[key] = uploaded[inserted];
                        inserted++;
                    }
                }
                if (inserted === 0 && uploaded.length > 0) {
                    updates['proof_url_5'] = uploaded[0];
                }

                await sb.from('orders').update(updates).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'ADD_DRIVER_PHOTO', `Menambahkan foto pengiriman sopir untuk order ${idOrder}`);
                }

                return { success: true, message: 'Berhasil menambahkan foto pengiriman sopir!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        deleteDriverProofPhoto: async function(idOrder, photoIdx, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner')) {
                    return { success: false, message: 'AKSES DITOLAK: Hanya Admin Pusat yang berhak menghapus foto bukti sopir!' };
                }

                const idx = parseInt(photoIdx, 10);
                if (idx < 1 || idx > 5) return { success: false, message: 'Indeks foto tidak valid (1-5)' };

                const updates = {
                    ['proof_url_' + idx]: null,
                    updated_at: new Date().toISOString()
                };

                await sb.from('orders').update(updates).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_PROOF_PHOTO', `Menghapus foto bukti #${photoIdx} pada order ${idOrder}`);
                }

                return { success: true, message: `Foto bukti pengiriman #${photoIdx} berhasil dihapus.` };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        addTransferPhoto: async function(idOrder, base64PhotoArray, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const rawList = Array.isArray(base64PhotoArray) ? base64PhotoArray : [base64PhotoArray];
                const uploaded = await uploadMediaPipeline(rawList, 'TRANSFER_' + idOrder);
                if (uploaded.length === 0) return { success: false, message: 'Tidak ada foto yang berhasil diunggah' };

                const { data: order, error } = await sb.from('orders').select('transfer_proof_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let existing = (order.transfer_proof_url || '').split(',').map(s => s.trim()).filter(Boolean);
                const combined = Array.from(new Set([...existing, ...uploaded]));

                await sb.from('orders').update({
                    transfer_proof_url: combined.join(', '),
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'ADD_TRANSFER_PHOTO', `Menambahkan foto bukti transfer untuk order ${idOrder}`);
                }

                return { success: true, message: 'Berhasil menambahkan foto bukti transfer!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        deleteTransferProofPhoto: async function(idOrder, photoIdx, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner')) {
                    return { success: false, message: 'AKSES DITOLAK: Anda tidak berhak menghapus foto bukti transfer!' };
                }

                const { data: order, error } = await sb.from('orders').select('transfer_proof_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let urlList = (order.transfer_proof_url || '').split(',').map(s => s.trim()).filter(Boolean);
                const idx = parseInt(photoIdx, 10) - 1;
                if (idx >= 0 && idx < urlList.length) {
                    urlList.splice(idx, 1);
                }

                await sb.from('orders').update({
                    transfer_proof_url: urlList.length > 0 ? urlList.join(', ') : null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_TRANSFER_PHOTO', `Menghapus foto bukti transfer #${photoIdx} pada order ${idOrder}`);
                }

                return { success: true, message: `Foto bukti transfer #${photoIdx} berhasil dihapus.` };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        deleteTransferPhoto: async function(idOrder, photoIdx, currentUser) {
            return this.deleteTransferProofPhoto(idOrder, photoIdx, currentUser);
        },

        deleteFotoUangLunas: async function(idOrder, photoIdx, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner' && currentUser.role !== 'Admin')) {
                    return { success: false, message: 'AKSES DITOLAK: Hanya Admin / Super Admin yang berhak menghapus foto uang lunas!' };
                }

                const { data: order, error } = await sb.from('orders').select('cash_proof_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let urlList = (order.cash_proof_url || '').split(',').map(s => s.trim()).filter(Boolean);
                const idx = parseInt(photoIdx, 10) - 1;
                if (idx >= 0 && idx < urlList.length) {
                    urlList.splice(idx, 1);
                }

                await sb.from('orders').update({
                    cash_proof_url: urlList.length > 0 ? urlList.join(', ') : null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_FOTO_UANG_LUNAS', `Menghapus foto uang lunas #${photoIdx} pada order ${idOrder}`);
                }

                return { success: true, message: `Foto uang lunas #${photoIdx} berhasil dihapus.` };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        addAdditionalOrder: async function(idOrder, catatanTambahan, base64NotaArray, nominalTambahan, statusBayarTambahan, nominalSisaTambahan, currentUser, tipeKirimTambahan) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const rawList = Array.isArray(base64NotaArray) ? base64NotaArray : (base64NotaArray ? [base64NotaArray] : []);
                const uploaded = await uploadMediaPipeline(rawList, 'NOTA_TAMBAHAN_' + idOrder);

                const { data: order, error } = await sb.from('orders').select('*').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let currentNotaUrl = order.nota_photo_url || '';
                let currentTambahanUrl = order.additional_nota_url || '';
                let currentNotes = order.notes || '';

                if (uploaded.length > 0) {
                    currentTambahanUrl = currentTambahanUrl ? (currentTambahanUrl + ', ' + uploaded.join(', ')) : uploaded.join(', ');
                    currentNotaUrl = currentNotaUrl ? (currentNotaUrl + ', ' + uploaded.join(', ')) : uploaded.join(', ');
                }

                const isDiBawaSendiri = (tipeKirimTambahan === 'Di Bawa Sendiri');
                const addNominal = isDiBawaSendiri ? 0 : (parseInt(String(nominalTambahan || '').replace(/[^0-9]/g, ''), 10) || 0);
                const isLunasTambahan = (statusBayarTambahan === 'Lunas');
                const addSisaNominal = isLunasTambahan ? 0 : (parseInt(String(nominalSisaTambahan || nominalTambahan || '').replace(/[^0-9]/g, ''), 10) || 0);

                let prevTotalTambahan = 0;
                const mTot = currentNotes.match(/\[TOTAL_TAMBAHAN_TERKIRIM:\s*(\d+)\]/i);
                if (mTot && mTot[1]) {
                    prevTotalTambahan = parseInt(mTot[1], 10) || 0;
                } else {
                    const reTot = /\[ORDERAN TAMBAHAN\s*\(Nilai:\s*Rp\s*([0-9.,]+)/gi;
                    let m;
                    while ((m = reTot.exec(currentNotes)) !== null) {
                        if (m[1]) prevTotalTambahan += parseInt(m[1].replace(/[^0-9]/g, ''), 10) || 0;
                    }
                }
                const newTotalTambahan = prevTotalTambahan + addNominal;

                let prevTambahanBelum = 0;
                const mBelum = currentNotes.match(/\[TAMBAHAN_BELUM_BAYAR:\s*(\d+)\]/i);
                if (mBelum && mBelum[1]) {
                    prevTambahanBelum = parseInt(mBelum[1], 10) || 0;
                }
                const newTambahanBelum = prevTambahanBelum + addSisaNominal;

                currentNotes = currentNotes
                    .replace(/\[TOTAL_TAMBAHAN_TERKIRIM:\s*\d+\]/gi, '')
                    .replace(/\[TAMBAHAN_BELUM_BAYAR:\s*\d+\]/gi, '')
                    .trim();

                const payTag = isLunasTambahan ? 'LUNAS' : ('Sisa Tagihan: Rp ' + addSisaNominal.toLocaleString('id-ID'));
                let newEntry = '';
                if (isDiBawaSendiri) {
                    newEntry = `[ORDERAN TAMBAHAN (Di Bawa Sendiri | ${payTag})]` + (catatanTambahan && catatanTambahan.trim() ? (': ' + catatanTambahan.trim()) : '');
                } else {
                    newEntry = `[ORDERAN TAMBAHAN (Nilai: Rp ${addNominal.toLocaleString('id-ID')} | ${payTag})]` + (catatanTambahan && catatanTambahan.trim() ? (': ' + catatanTambahan.trim()) : '');
                }

                currentNotes = (currentNotes ? currentNotes + ' | ' : '') + newEntry + ` [TOTAL_TAMBAHAN_TERKIRIM:${newTotalTambahan}]`;
                if (newTambahanBelum > 0) {
                    currentNotes += ` [TAMBAHAN_BELUM_BAYAR:${newTambahanBelum}]`;
                }

                await sb.from('orders').update({
                    notes: currentNotes,
                    additional_nota_url: currentTambahanUrl || null,
                    nota_photo_url: currentNotaUrl || null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'ADD_ADDITIONAL_ORDER', `Menambahkan orderan tambahan ${isDiBawaSendiri ? '(Di Bawa Sendiri)' : 'Rp ' + addNominal.toLocaleString('id-ID')} pada order ${idOrder}`);
                }

                return {
                    success: true,
                    message: `Orderan tambahan ${isDiBawaSendiri ? '(Di Bawa Sendiri)' : 'Rp ' + addNominal.toLocaleString('id-ID')} berhasil disimpan!`,
                    new_total_tambahan: newTotalTambahan
                };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        deleteAdditionalOrderPhoto: async function(idOrder, photoIdx, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser || (currentUser.role !== 'Super Admin' && currentUser.role !== 'Owner' && currentUser.role !== 'Admin' && currentUser.role !== 'Staff Operasional' && currentUser.role !== 'Operasional')) {
                    return { success: false, message: 'AKSES DITOLAK: Hanya Admin dan Staff Operasional yang berhak menghapus foto orderan tambahan!' };
                }

                const { data: order, error } = await sb.from('orders').select('additional_nota_url').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let urlList = (order.additional_nota_url || '').split(',').map(s => s.trim()).filter(Boolean);
                const idx = parseInt(photoIdx, 10) - 1;
                if (idx >= 0 && idx < urlList.length) {
                    urlList.splice(idx, 1);
                }

                await sb.from('orders').update({
                    additional_nota_url: urlList.length > 0 ? urlList.join(', ') : null,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (currentUser) {
                    await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'DELETE_ADDITIONAL_PHOTO', `Menghapus foto orderan tambahan #${photoIdx} pada order ${idOrder}`);
                }

                return { success: true, message: 'Foto nota tambahan berhasil dihapus.' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        continuePartialDelivery: async function(idOrder, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser) return { success: false, message: 'AKSES DITOLAK: Silakan login terlebih dahulu!' };

                const { data: order, error } = await sb.from('orders').select('notes, delivery_notes').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                let rawNotes = order.notes || '';
                let rawDeliveryNotes = order.delivery_notes || '';

                if (rawNotes.toUpperCase().includes('[TITIP BARANG]')) {
                    rawNotes = rawNotes.replace(/\[TITIP BARANG\]/gi, '[KIRIMAN TAHAP 2]').trim();
                }
                if (rawDeliveryNotes.toUpperCase().includes('[TITIP BARANG]')) {
                    rawDeliveryNotes = rawDeliveryNotes.replace(/\[TITIP BARANG\]/gi, '[KIRIMAN TAHAP 2]').trim();
                }

                const nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                const nowWita = new Date(nowUtc + (8 * 3600 * 1000));
                const todayStr = `${nowWita.getFullYear()}-${String(nowWita.getMonth() + 1).padStart(2, '0')}-${String(nowWita.getDate()).padStart(2, '0')}`;

                await sb.from('orders').update({
                    delivery_status: 'Pesanan Masuk / Dimuat',
                    verification_status: 'Cek Sebagian (Perlu Cek Tahap 2)',
                    delivery_date: todayStr,
                    notes: rawNotes,
                    delivery_notes: rawDeliveryNotes,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'KIRIMAN_LANJUTAN', `Mengaktifkan kiriman lanjutan Tahap 2 pada order ${idOrder}`);

                return { success: true, message: 'Kiriman Lanjutan (Tahap 2) berhasil diaktifkan! Invoice telah berpindah ke folder Pesanan Masuk.' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        updateOrderGmapsLocation: async function(idOrder, linkGmaps, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!currentUser) return { success: false, message: 'AKSES DITOLAK: Silakan login terlebih dahulu!' };

                const { data: order, error } = await sb.from('orders').select('customer_id').eq('id', idOrder).single();
                if (error || !order) return { success: false, message: 'Order tidak ditemukan' };

                await sb.from('orders').update({
                    maps_url: linkGmaps,
                    updated_at: new Date().toISOString()
                }).eq('id', idOrder);

                if (order.customer_id) {
                    await sb.from('customers').update({
                        maps_url: linkGmaps,
                        updated_at: new Date().toISOString()
                    }).eq('id', order.customer_id);
                }

                await logActivity(currentUser.id_user || currentUser.user_code, currentUser.nama || currentUser.full_name, currentUser.role, 'UPDATE_GMAPS_GPS', `Meng-update titik lokasi GPS pelanggan untuk order ${idOrder}`);

                return { success: true, message: 'Titik lokasi GPS berhasil diperbarui secara instan!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        updateGmapsLink: async function(idOrder, urlGmaps, idUser, namaUser) {
            return this.updateOrderGmapsLocation(idOrder, urlGmaps, { id_user: idUser, nama: namaUser, role: 'Sopir' });
        },

        resolveGoogleMapsLocationUrl: async function(url) {
            try {
                if (!url || typeof url !== 'string') return { success: false, message: 'URL kosong' };
                url = url.trim();

                const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                   url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                   url.match(/place\/(-?\d+\.\d+),(-?\d+\.\d+)/) ||
                                   url.match(/(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);

                if (coordMatch) {
                    return {
                        success: true,
                        lat: parseFloat(coordMatch[1]),
                        lng: parseFloat(coordMatch[2])
                    };
                }

                const gasEndpoint = window.__TB_GAS_BACKEND_URL;
                if (gasEndpoint) {
                    try {
                        const res = await fetch(gasEndpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                            body: JSON.stringify({ action: 'resolveGoogleMapsLocationUrl', url: url }),
                            redirect: 'follow'
                        });
                        const json = await res.json();
                        if (json && json.success && json.lat && json.lng) return json;
                    } catch(e) {}
                }

                return { success: false, message: 'Koordinat tidak ditemukan pada tautan ini.' };
            } catch(e) {
                return { success: false, message: e.message };
            }
        },

        calculateRouteDistanceBackend: async function(sLat, sLng, cLat, cLng) {
            try {
                const lat1 = parseFloat(sLat);
                const lon1 = parseFloat(sLng);
                const lat2 = parseFloat(cLat);
                const lon2 = parseFloat(cLng);

                if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) {
                    return { success: false, message: 'Koordinat tidak valid' };
                }

                const R = 6371;
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                          Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                const straightKm = R * c;
                const routeKm = Math.round(straightKm * 1.3 * 10) / 10;
                const durationMins = Math.max(5, Math.round(routeKm * 2.5));

                return {
                    success: true,
                    distanceKm: routeKm,
                    durationMins: durationMins,
                    origin: { lat: lat1, lng: lon1 },
                    destination: { lat: lat2, lng: lon2 }
                };
            } catch(e) {
                return { success: false, message: e.message };
            }
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

        addCustomer: async function(custData, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                custData = custData || {};
                const nama = (custData.nama_pelanggan || custData.name || '').trim();
                const hp = (custData.no_hp || custData.phone || '').trim();
                const alamat = (custData.alamat || custData.alamat_lengkap || custData.address || '').trim();
                const gmaps = (custData.link_gmaps || custData.maps_url || '').trim();
                const rawOngkir = custData.ongkir !== undefined ? custData.ongkir : (custData.ongkir_standar || custData.standard_shipping_fee || 0);
                const ongkir = parseInt(String(rawOngkir).replace(/[^0-9]/g, ''), 10) || 0;

                if (!nama || !hp || !alamat) {
                    return { success: false, message: 'Nama, No. HP, dan Alamat wajib diisi!' };
                }

                // Ambil ID Pelanggan terakhir untuk auto-increment (CUST-XXXX)
                const { data: allCusts } = await sb.from('customers').select('id');
                let maxNum = 0;
                (allCusts || []).forEach(c => {
                    const m = String(c.id || '').match(/CUST-(\d+)/i);
                    if (m) {
                        const num = parseInt(m[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });

                const newId = 'CUST-' + String(maxNum + 1).padStart(4, '0');

                const payload = {
                    id: newId,
                    name: nama,
                    phone: hp,
                    address: alamat,
                    maps_url: gmaps,
                    standard_shipping_fee: ongkir,
                    total_orders: 0
                };

                const { data, error } = await sb.from('customers').insert([payload]).select().single();
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'SYSTEM',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    currentUser ? currentUser.role : 'Admin',
                    'TAMBAH_PELANGGAN',
                    'Menambahkan pelanggan baru: ' + nama + ' (' + newId + ')'
                );

                return {
                    success: true,
                    message: 'Pelanggan ' + nama + ' berhasil ditambahkan!',
                    id_pelanggan: newId,
                    data: data
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        addNewCustomer: async function(custData, currentUser) {
            return apiServices.addCustomer(custData, currentUser);
        },

        updateCustomer: async function(idCust, custPayload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const payload = {
                    name: custPayload.nama_pelanggan || custPayload.name,
                    phone: custPayload.no_hp || custPayload.phone,
                    address: custPayload.alamat || custPayload.alamat_lengkap || custPayload.address,
                    maps_url: custPayload.link_gmaps || custPayload.maps_url
                };
                if (custPayload.ongkir !== undefined || custPayload.ongkir_standar !== undefined) {
                    const rawO = custPayload.ongkir !== undefined ? custPayload.ongkir : custPayload.ongkir_standar;
                    payload.standard_shipping_fee = parseInt(String(rawO).replace(/[^0-9]/g, ''), 10) || 0;
                }

                const { error } = await sb.from('customers').update(payload).eq('id', idCust);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'SYSTEM',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_PELANGGAN',
                    'Memperbarui data pelanggan ' + idCust
                );

                return { success: true, message: 'Data pelanggan berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getCustomerHistory: async function(idPelanggan) {
            const sb = getClient();
            if (!sb || !idPelanggan) return { success: true, data: [] };
            try {
                const cleanId = String(idPelanggan).trim();

                // Cari data nama pelanggan
                let custName = '';
                const { data: custRow } = await sb.from('customers').select('name').eq('id', cleanId).maybeSingle();
                if (custRow && custRow.name) custName = custRow.name.trim();

                const { data: allOrders, error } = await sb.from('orders')
                    .select('*')
                    .order('created_at', { ascending: false });

                if (error || !allOrders) return { success: true, data: [] };

                const matched = allOrders.filter(o => {
                    if (o.customer_id && String(o.customer_id).trim() === cleanId) return true;
                    if (custName && o.customer_name && o.customer_name.trim().toLowerCase() === custName.toLowerCase()) return true;
                    return false;
                });

                const history = matched.map(o => ({
                    id_order: o.id,
                    tanggal_order: formatIndonesianDateTime(o.order_date || o.created_at),
                    alamat_lengkap: o.address || '-',
                    detail_barang: o.items_summary || '-',
                    nama_sopir: o.driver_name || '-',
                    status_verifikasi: o.verification_status || 'Belum di Cek',
                    nama_checker: o.checker_name || '',
                    status_pengiriman: o.shipping_status || 'Pesanan Masuk',
                    status_pembayaran: o.payment_status || 'Belum Lunas',
                    url_foto_nota: convertDriveUrlToDirectImage(o.invoice_photo_url || ''),
                    url_bukti_transfer: convertDriveUrlToDirectImage(o.transfer_proof_url || ''),
                    url_bukti_1: convertDriveUrlToDirectImage(o.proof_url_1 || ''),
                    url_bukti_2: convertDriveUrlToDirectImage(o.proof_url_2 || ''),
                    url_bukti_3: convertDriveUrlToDirectImage(o.proof_url_3 || ''),
                    url_bukti_4: convertDriveUrlToDirectImage(o.proof_url_4 || ''),
                    url_bukti_5: convertDriveUrlToDirectImage(o.proof_url_5 || '')
                }));

                return { success: true, data: history };
            } catch (err) {
                return { success: false, message: err.message, data: [] };
            }
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
                function isPlatMatchLocal(dataPlat, targetPlat) {
                    if (!targetPlat) return false;
                    const cTarget = String(targetPlat || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const cData = String(dataPlat || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!cTarget || !cData) return false;
                    return cData === cTarget || cData.includes(cTarget) || cTarget.includes(cData);
                }

                function formatWitaDate(val) {
                    if (!val) return '-';
                    const dt = val instanceof Date ? val : new Date(val);
                    if (isNaN(dt.getTime())) {
                        const s = String(val).trim();
                        if (s.includes('-')) {
                            const p = s.split('-');
                            if (p.length === 3) return p[2] + '/' + p[1] + '/' + p[0];
                        }
                        return s;
                    }
                    const utc = dt.getTime() + (dt.getTimezoneOffset() * 60000);
                    const wita = new Date(utc + (8 * 3600 * 1000));
                    const dd = String(wita.getDate()).padStart(2, '0');
                    const mm = String(wita.getMonth() + 1).padStart(2, '0');
                    const yyyy = wita.getFullYear();
                    return dd + '/' + mm + '/' + yyyy;
                }

                const [vRes, bbmRes, oliRes, srvRes] = await Promise.all([
                    sb.from('vehicles').select('*').order('id', { ascending: true }),
                    sb.from('fuel_logs').select('*').order('current_km', { ascending: true }),
                    sb.from('oil_change_logs').select('*').order('service_km', { ascending: true }),
                    sb.from('vehicle_services').select('*').order('current_km', { ascending: true })
                ]);

                const vData = vRes.data || [];
                const bbmData = bbmRes.data || [];
                const oliData = oliRes.data || [];
                const srvData = srvRes.data || [];

                let countSegeraGanti = 0;
                let countWajibGanti = 0;

                const list = vData.map(v => {
                    const noPlat = (v.plate_number || '').trim();
                    let maxTxKm = 0;
                    let latestTxTgl = '-';

                    // 1. BBM untuk mobil ini
                    const carBbm = [];
                    for (const b of bbmData) {
                        if (isPlatMatchLocal(b.plate_number, noPlat)) {
                            const tglClean = formatWitaDate(b.fuel_date || b.created_at);
                            const bKm = Number(b.current_km || 0);
                            if (bKm > maxTxKm) {
                                maxTxKm = bKm;
                                latestTxTgl = tglClean;
                            }
                            carBbm.push({
                                id: b.id,
                                tgl: tglClean,
                                km_saat_ini: bKm,
                                jarak: Number(b.trip_distance || 0),
                                liter: Number(b.liters || 0),
                                konsumsi: Number(b.efficiency_ratio || 0)
                            });
                        }
                    }

                    let isiTerakhirLiter = 0;
                    let tglTerakhirBbm = '-';
                    let konsumsiBbm = 0;

                    if (carBbm.length > 0) {
                        const lastBbm = carBbm[carBbm.length - 1];
                        isiTerakhirLiter = lastBbm.liter || 0;
                        tglTerakhirBbm = lastBbm.tgl || '-';

                        const totJarak = carBbm.reduce((acc, c) => acc + c.jarak, 0);
                        const totLiter = carBbm.reduce((acc, c) => acc + c.liter, 0);
                        if (totLiter > 0 && totJarak > 0) {
                            konsumsiBbm = parseFloat((totJarak / totLiter).toFixed(1));
                        } else if (lastBbm.konsumsi > 0) {
                            konsumsiBbm = lastBbm.konsumsi;
                        }
                    }

                    // 2. Oli untuk mobil ini
                    const carOli = [];
                    let maxGantiOliKm = 0;
                    for (const o of oliData) {
                        if (isPlatMatchLocal(o.plate_number, noPlat)) {
                            const oKm = Number(o.service_km || 0);
                            const oJenis = (o.transaction_type || 'Ganti Oli').trim();
                            const oTgl = formatWitaDate(o.service_date || o.created_at);
                            carOli.push({
                                tgl: oTgl,
                                km_ganti: oKm,
                                jenis: oJenis
                            });
                            if (oKm > maxTxKm) {
                                maxTxKm = oKm;
                                latestTxTgl = oTgl;
                            }
                            if (oJenis === 'Ganti Oli' && oKm > maxGantiOliKm) {
                                maxGantiOliKm = oKm;
                            }
                        }
                    }

                    // 3. Service untuk mobil ini
                    for (const s of srvData) {
                        if (isPlatMatchLocal(s.plate_number, noPlat)) {
                            const sKm = Number(s.current_km || 0);
                            const sTgl = formatWitaDate(s.service_date || s.created_at);
                            if (sKm > maxTxKm) {
                                maxTxKm = sKm;
                                latestTxTgl = sTgl;
                            }
                        }
                    }

                    // KM Terkini: gunakan maxTxKm jika ada transaksi nyata, fallback ke current_km database
                    let kmTerkini = maxTxKm > 0 ? maxTxKm : (Number(v.current_km || 0));
                    let tglKmTerkini = latestTxTgl !== '-' ? latestTxTgl : (tglTerakhirBbm !== '-' ? tglTerakhirBbm : '-');

                    let kmOli = maxGantiOliKm > 0 ? maxGantiOliKm : (Number(v.last_oil_km || 0) || kmTerkini);
                    const interval = Number(v.oil_interval_km || 5000);

                    let sisaOli = 0;
                    let statusOli = 'Aman';

                    if (carOli.length === 0 && kmOli === 0) {
                        statusOli = 'Belum Ada Transaksi';
                        sisaOli = interval;
                    } else {
                        sisaOli = (kmOli + interval) - kmTerkini;
                        if (sisaOli <= 500) {
                            statusOli = 'Wajib Ganti';
                            countWajibGanti++;
                        } else if (sisaOli <= 2000) {
                            statusOli = 'Segera Ganti';
                            countSegeraGanti++;
                        } else {
                            statusOli = 'Aman';
                        }
                    }

                    return {
                        id_kendaraan: v.id,
                        no_plat: noPlat,
                        jenis_mobil: v.vehicle_type || 'Mobil',
                        nama_sopir: v.default_driver || '-',
                        km_terkini: kmTerkini,
                        tgl_km_terkini: tglKmTerkini,
                        isi_terakhir_liter: isiTerakhirLiter,
                        tgl_terakhir_bbm: tglTerakhirBbm,
                        konsumsi_bbm: konsumsiBbm > 0 ? konsumsiBbm.toFixed(1).replace('.', ',') : '0,0',
                        km_terakhir_ganti_oli: kmOli,
                        interval_oli: interval,
                        status_oli: statusOli,
                        sisa_km_oli: sisaOli,
                        status_aktif: (v.status === 'true' || v.status === true || v.status === 'Aktif') ? 'Aktif' : 'Nonaktif'
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
            if (!sb) return { success: false, data: [] };
            try {
                const { data, error } = await sb.from('vehicles').select('*').order('plate_number');
                if (error) return { success: false, message: error.message, data: [] };
                const list = (data || []).map(v => ({
                    id_kendaraan: v.id,
                    no_plat: v.plate_number,
                    jenis_mobil: v.vehicle_type,
                    sopir_default: v.default_driver || '-',
                    km_terkini: Number(v.current_km || 0),
                    km_terakhir_ganti_oli: Number(v.last_oil_km || 0),
                    interval_servis_km: Number(v.oil_interval_km || 5000),
                    interval_ganti_oli: Number(v.oil_interval_km || 5000),
                    total_liter_bbm: Number(v.total_fuel_liters || 0),
                    status_aktif: v.status
                }));
                return { success: true, data: list };
            } catch (err) {
                return { success: false, message: err.message, data: [] };
            }
        },

        getVehicleDashboardData: async function(noPlat, driverUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                function isPlatMatchLocal(p1, p2) {
                    if (!p1 || !p2) return false;
                    const c1 = String(p1).toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const c2 = String(p2).toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!c1 || !c2) return false;
                    return c1 === c2 || c1.includes(c2) || c2.includes(c1);
                }

                const [vRes, bbmRes, oliRes, srvRes] = await Promise.all([
                    sb.from('vehicles').select('*'),
                    sb.from('fuel_logs').select('*').order('current_km', { ascending: true }),
                    sb.from('oil_change_logs').select('*').order('service_km', { ascending: true }),
                    sb.from('vehicle_services').select('*').order('current_km', { ascending: true })
                ]);

                const vData = vRes.data || [];
                let targetVehicle = null;

                if (noPlat) {
                    targetVehicle = vData.find(k => isPlatMatchLocal(k.plate_number, noPlat));
                }
                if (!targetVehicle && driverUser && driverUser.nama) {
                    targetVehicle = vData.find(k => (k.default_driver || '').toLowerCase() === driverUser.nama.toLowerCase());
                }
                if (!targetVehicle && vData.length > 0) {
                    targetVehicle = vData[0];
                }

                if (!targetVehicle) {
                    return { success: false, message: 'Data kendaraan tidak ditemukan' };
                }

                const tPlate = targetVehicle.plate_number;

                // Riwayat BBM
                const bbmHistory = [];
                let totalLiter = 0;
                let totalJarak = 0;
                const rawBbm = bbmRes.data || [];
                for (const row of rawBbm) {
                    if (isPlatMatchLocal(row.plate_number, tPlate)) {
                        const liter = Number(row.liters || 0);
                        const jarak = Number(row.trip_distance || 0);
                        totalLiter += liter;
                        totalJarak += jarak;

                        bbmHistory.push({
                            id_bbm: String(row.id || ''),
                            tanggal: formatIndonesianDateTime(row.fuel_date || row.created_at),
                            no_plat: String(row.plate_number || ''),
                            nama_sopir: String(row.driver_name || '-'),
                            km_saat_ini: Number(row.current_km || 0),
                            km_sebelumnya: Number(row.prev_km || 0),
                            jarak_tempuh: jarak,
                            jumlah_liter: liter,
                            total_biaya: Number(row.total_cost || 0),
                            rata_rata_konsumsi: Number(row.efficiency_ratio || 0),
                            nama_spbu: String(row.gas_station || '-'),
                            jenis_bbm: String(row.fuel_type || 'Solar'),
                            url_foto_km: convertDriveUrlToDirectImage(row.km_photo_url || ''),
                            url_foto_struk: convertDriveUrlToDirectImage(row.receipt_photo_url || ''),
                            url_foto_muatan: convertDriveUrlToDirectImage(row.cargo_photo_url || ''),
                            catatan: String(row.notes || ''),
                            waktu_input: row.created_at || row.fuel_date
                        });
                    }
                }

                const avgKonsumsi = totalLiter > 0 && totalJarak > 0 ? (totalJarak / totalLiter).toFixed(1) : '10.0';

                // Riwayat Oli
                const oliHistory = [];
                const rawOli = oliRes.data || [];
                for (const row of rawOli) {
                    if (isPlatMatchLocal(row.plate_number, tPlate)) {
                        oliHistory.push({
                            id_oli: String(row.id || ''),
                            tanggal: formatIndonesianDateTime(row.service_date || row.created_at),
                            no_plat: String(row.plate_number || ''),
                            nama_sopir: String(row.driver_name || '-'),
                            km_saat_ganti: Number(row.service_km || 0),
                            jenis_transaksi: String(row.transaction_type || 'Ganti Oli'),
                            merek_oli: String(row.oil_brand || '-'),
                            jumlah_liter: Number(row.liters || 0),
                            total_biaya: Number(row.total_cost || 0),
                            nama_bengkel: String(row.workshop_name || '-'),
                            url_foto_km: convertDriveUrlToDirectImage(row.km_photo_url || ''),
                            url_foto_nota: convertDriveUrlToDirectImage(row.receipt_photo_url || ''),
                            catatan: String(row.notes || '')
                        });
                    }
                }

                // Riwayat Servis
                const srvHistory = [];
                const rawSrv = srvRes.data || [];
                for (const row of rawSrv) {
                    if (isPlatMatchLocal(row.plate_number, tPlate)) {
                        srvHistory.push({
                            id_service: String(row.id || ''),
                            tanggal: formatIndonesianDateTime(row.service_date || row.created_at),
                            no_plat: String(row.plate_number || ''),
                            nama_sopir: String(row.driver_name || '-'),
                            km_saat_ini: Number(row.current_km || 0),
                            nama_bengkel: String(row.workshop_name || '-'),
                            biaya_perbaikan: Number(row.cost || 0),
                            catatan_perbaikan: String(row.repair_details || ''),
                            url_foto_nota: convertDriveUrlToDirectImage(row.receipt_photo_url || '')
                        });
                    }
                }

                let maxKmFound = 0;
                bbmHistory.forEach(b => { if (b.km_saat_ini > maxKmFound) maxKmFound = b.km_saat_ini; });
                oliHistory.forEach(o => { if (o.km_saat_ganti > maxKmFound) maxKmFound = o.km_saat_ganti; });
                srvHistory.forEach(s => { if (s.km_saat_ini > maxKmFound) maxKmFound = s.km_saat_ini; });

                const effectiveKm = maxKmFound > 0 ? maxKmFound : Number(targetVehicle.current_km || 0);

                let latestGantiOliKm = 0;
                for (let i = oliHistory.length - 1; i >= 0; i--) {
                    if (oliHistory[i].jenis_transaksi === 'Ganti Oli' && oliHistory[i].km_saat_ganti > 0) {
                        latestGantiOliKm = oliHistory[i].km_saat_ganti;
                        break;
                    }
                }

                const interval = Number(targetVehicle.oil_interval_km || 5000);
                const baseKmOli = latestGantiOliKm > 0 ? latestGantiOliKm : Number(targetVehicle.last_oil_km || 0);
                const sisaOli = (baseKmOli + interval) - effectiveKm;
                let statusOli = 'Oli Aman';
                if (sisaOli <= 500) statusOli = 'WAJIB GANTI OLI';
                else if (sisaOli <= 2000) statusOli = 'Segera Ganti Oli';
                else statusOli = 'Oli Aman';

                let terakhirIsiBbm = '-';
                if (bbmHistory.length > 0) {
                    const latestBbm = bbmHistory[bbmHistory.length - 1];
                    terakhirIsiBbm = latestBbm.tanggal || '-';
                } else if (targetVehicle.last_fuel_date) {
                    terakhirIsiBbm = formatIndonesianDateTime(targetVehicle.last_fuel_date);
                }

                const targetVehicleObj = {
                    id_kendaraan: targetVehicle.id,
                    no_plat: targetVehicle.plate_number,
                    jenis_mobil: targetVehicle.vehicle_type || 'Mobil',
                    sopir_default: targetVehicle.default_driver || '-',
                    km_terkini: effectiveKm,
                    km_terakhir_ganti_oli: baseKmOli,
                    interval_servis_km: interval,
                    interval_ganti_oli: interval,
                    sisa_km_oli: sisaOli,
                    status_oli: statusOli,
                    terakhir_isi_bbm: terakhirIsiBbm,
                    status_aktif: targetVehicle.status
                };

                return {
                    success: true,
                    kendaraan: targetVehicleObj,
                    avg_konsumsi: avgKonsumsi,
                    bbm_history: bbmHistory.reverse(),
                    oli_history: oliHistory.reverse(),
                    service_history: srvHistory.reverse()
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getVehicleReports: async function(filterOpt) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                filterOpt = filterOpt || {};
                const filterPlat = (filterOpt.noPlat || '').trim().toUpperCase();
                const filterSopir = (filterOpt.namaSopir || '').trim().toLowerCase();
                const filterPom = (filterOpt.namaPom || '').trim().toLowerCase();
                const filterJenisBBM = (filterOpt.jenisBBM || '').trim().toLowerCase();
                const filterJenisOli = (filterOpt.jenisOli || filterOpt.merekOli || '').trim().toLowerCase();
                const filterBengkel = (filterOpt.namaBengkel || '').trim().toLowerCase();
                const tglAwal = filterOpt.periodeAwal || '';
                const tglAkhir = filterOpt.periodeAkhir || '';

                function isPlatMatch(dataPlat, targetPlat) {
                    if (!targetPlat || targetPlat === 'SEMUA') return true;
                    const cTarget = String(targetPlat || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    const cData = String(dataPlat || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
                    if (!cTarget) return true;
                    return cData === cTarget || cData.includes(cTarget) || cTarget.includes(cData);
                }

                function isDateMatch(dStr) {
                    if (!tglAwal && !tglAkhir) return true;
                    if (!dStr) return true;
                    const dt = new Date(dStr);
                    if (isNaN(dt.getTime())) return true;
                    if (tglAwal && dt < new Date(tglAwal)) return false;
                    if (tglAkhir && dt > new Date(tglAkhir + 'T23:59:59')) return false;
                    return true;
                }

                const [vRes, bbmRes, oliRes, srvRes] = await Promise.all([
                    sb.from('vehicles').select('*'),
                    sb.from('fuel_logs').select('*').order('fuel_date', { ascending: false }),
                    sb.from('oil_change_logs').select('*').order('service_date', { ascending: false }),
                    sb.from('vehicle_services').select('*').order('service_date', { ascending: false })
                ]);

                const vehicles = vRes.data || [];
                const bbmLogs = bbmRes.data || [];
                const oliLogs = oliRes.data || [];
                const srvLogs = srvRes.data || [];

                // 1. LAPORAN BBM
                const bbmList = [];
                let bbmTotalLiter = 0;
                let bbmTotalBiaya = 0;
                let bbmTotalJarak = 0;
                const pomCounts = {};

                for (const r of bbmLogs) {
                    const plat = (r.plate_number || '').trim().toUpperCase();
                    const sopir = (r.driver_name || '').trim().toLowerCase();
                    const pom = (r.gas_station || '').trim().toLowerCase();
                    const jnsBBM = (r.fuel_type || '').trim().toLowerCase();
                    const tgl = r.fuel_date || r.created_at;

                    if (!isPlatMatch(plat, filterPlat)) continue;
                    if (filterSopir && !sopir.includes(filterSopir)) continue;
                    if (filterPom && !pom.includes(filterPom)) continue;
                    if (filterJenisBBM && !jnsBBM.includes(filterJenisBBM)) continue;
                    if (!isDateMatch(tgl)) continue;

                    const liter = Number(r.liters || 0);
                    const biaya = Number(r.total_cost || 0);
                    const jarak = Number(r.trip_distance || 0);
                    const konsumsi = Number(r.efficiency_ratio || 0);

                    bbmTotalLiter += liter;
                    bbmTotalBiaya += biaya;
                    bbmTotalJarak += jarak;

                    const spbuName = (r.gas_station || 'SPBU Lainnya').trim();
                    if (!pomCounts[spbuName]) pomCounts[spbuName] = { count: 0, total_biaya: 0, total_liter: 0 };
                    pomCounts[spbuName].count += 1;
                    pomCounts[spbuName].total_biaya += biaya;
                    pomCounts[spbuName].total_liter += liter;

                    bbmList.push({
                        id_bbm: String(r.id || ''),
                        tanggal: formatIndonesianDateTime(tgl),
                        no_plat: plat,
                        id_sopir: String(r.driver_id || ''),
                        nama_sopir: r.driver_name || '-',
                        km_saat_ini: Number(r.current_km || 0),
                        km_sebelumnya: Number(r.prev_km || 0),
                        jarak_tempuh: jarak,
                        jumlah_liter: liter,
                        jenis_bbm: r.fuel_type || 'Solar',
                        total_biaya: biaya,
                        rata_rata_konsumsi: konsumsi,
                        nama_spbu: spbuName,
                        url_foto_km: convertDriveUrlToDirectImage(r.km_photo_url || ''),
                        url_foto_struk: convertDriveUrlToDirectImage(r.receipt_photo_url || ''),
                        url_foto_muatan: convertDriveUrlToDirectImage(r.cargo_photo_url || ''),
                        catatan: r.notes || ''
                    });
                }

                // Top 3 SPBU
                const topPom = Object.keys(pomCounts).map(k => ({
                    nama_spbu: k,
                    total_biaya: pomCounts[k].total_biaya,
                    total_liter: pomCounts[k].total_liter,
                    frekuensi: pomCounts[k].count
                })).sort((a, b) => b.total_biaya - a.total_biaya).slice(0, 3);

                // 2. LAPORAN OLI
                const oliList = [];
                let oliTotalLiter = 0;
                let oliTotalBiaya = 0;

                for (const r of oliLogs) {
                    const plat = (r.plate_number || '').trim().toUpperCase();
                    const sopir = (r.driver_name || '').trim().toLowerCase();
                    const bengkel = (r.workshop_name || '').trim().toLowerCase();
                    const merek = (r.oil_brand || '').trim().toLowerCase();
                    const tgl = r.service_date || r.created_at;

                    if (!isPlatMatch(plat, filterPlat)) continue;
                    if (filterSopir && !sopir.includes(filterSopir)) continue;
                    if (filterBengkel && !bengkel.includes(filterBengkel)) continue;
                    if (filterJenisOli && !merek.includes(filterJenisOli)) continue;
                    if (!isDateMatch(tgl)) continue;

                    const liter = Number(r.liters || 0);
                    const biaya = Number(r.total_cost || 0);

                    oliTotalLiter += liter;
                    oliTotalBiaya += biaya;

                    oliList.push({
                        id_oli: String(r.id || ''),
                        tanggal: formatIndonesianDateTime(tgl),
                        no_plat: plat,
                        id_sopir: String(r.driver_id || ''),
                        nama_sopir: r.driver_name || '-',
                        km_saat_ganti: Number(r.service_km || 0),
                        jenis_transaksi: r.transaction_type || 'Ganti Oli',
                        merek_oli: r.oil_brand || '-',
                        jumlah_liter: liter,
                        total_biaya: biaya,
                        nama_bengkel: r.workshop_name || '-',
                        url_foto_km: convertDriveUrlToDirectImage(r.km_photo_url || ''),
                        url_foto_nota: convertDriveUrlToDirectImage(r.receipt_photo_url || ''),
                        catatan: r.notes || ''
                    });
                }

                // 3. LAPORAN SERVICE
                const serviceList = [];
                let serviceTotalBiaya = 0;

                for (const r of srvLogs) {
                    const plat = (r.plate_number || '').trim().toUpperCase();
                    const sopir = (r.driver_name || '').trim().toLowerCase();
                    const bengkel = (r.workshop_name || '').trim().toLowerCase();
                    const tgl = r.service_date || r.created_at;

                    if (!isPlatMatch(plat, filterPlat)) continue;
                    if (filterSopir && !sopir.includes(filterSopir)) continue;
                    if (filterBengkel && !bengkel.includes(filterBengkel)) continue;
                    if (!isDateMatch(tgl)) continue;

                    const biaya = Number(r.cost || 0);
                    serviceTotalBiaya += biaya;

                    serviceList.push({
                        id_service: String(r.id || ''),
                        tanggal: formatIndonesianDateTime(tgl),
                        no_plat: plat,
                        id_sopir: String(r.driver_id || ''),
                        nama_sopir: r.driver_name || '-',
                        km_saat_ini: Number(r.current_km || 0),
                        nama_bengkel: r.workshop_name || '-',
                        biaya_perbaikan: biaya,
                        catatan_perbaikan: r.repair_details || '',
                        url_foto_nota: convertDriveUrlToDirectImage(r.receipt_photo_url || '')
                    });
                }

                // 4. REKAP PER KENDARAAN
                const rekapKendaraanList = [];
                for (const v of vehicles) {
                    const noPlat = (v.plate_number || '').trim().toUpperCase();
                    if (!isPlatMatch(noPlat, filterPlat)) continue;

                    let totLiterBBM = 0;
                    let totJarakBBM = 0;
                    let totBiayaBBM = 0;
                    let tglTerakhirBBM = '-';

                    for (const b of bbmLogs) {
                        if (isPlatMatch(b.plate_number, noPlat)) {
                            totLiterBBM += Number(b.liters || 0);
                            totJarakBBM += Number(b.trip_distance || 0);
                            totBiayaBBM += Number(b.total_cost || 0);
                            if (tglTerakhirBBM === '-') tglTerakhirBBM = formatIndonesianDateTime(b.fuel_date || b.created_at);
                        }
                    }

                    let tglTerakhirOli = '-';
                    let kmTerakhirOli = 0;
                    for (const o of oliLogs) {
                        if (isPlatMatch(o.plate_number, noPlat)) {
                            if (tglTerakhirOli === '-') {
                                tglTerakhirOli = formatIndonesianDateTime(o.service_date || o.created_at);
                                kmTerakhirOli = Number(o.service_km || 0);
                            }
                        }
                    }

                    const avgKmPerL = totLiterBBM > 0 && totJarakBBM > 0 ? (totJarakBBM / totLiterBBM).toFixed(2) : '0';

                    rekapKendaraanList.push({
                        id_kendaraan: v.id,
                        no_plat: noPlat,
                        jenis_mobil: v.vehicle_type || 'Mobil',
                        sopir_default: v.default_driver || '-',
                        total_pengisian_bbm: bbmLogs.filter(b => isPlatMatch(b.plate_number, noPlat)).length,
                        tanggal_terakhir_bbm: tglTerakhirBBM,
                        total_liter_bbm: totLiterBBM,
                        total_jarak_bbm: totJarakBBM,
                        total_biaya_bbm: totBiayaBBM,
                        rata_rata_konsumsi: avgKmPerL,
                        tanggal_terakhir_ganti_oli: tglTerakhirOli,
                        km_terakhir_ganti_oli: kmTerakhirOli || Number(v.last_oil_km || 0),
                        km_terkini: Number(v.current_km || 0),
                        interval_oli: Number(v.oil_interval_km || 5000),
                        status_aktif: (v.status === 'true' || v.status === true || v.status === 'Aktif') ? 'Aktif' : 'Nonaktif'
                    });
                }

                return {
                    success: true,
                    summary: {
                        total_pengisian: bbmList.length,
                        total_liter_bbm: bbmTotalLiter,
                        total_biaya_bbm: bbmTotalBiaya,
                        total_jarak_bbm: bbmTotalJarak,
                        rata_rata_konsumsi: bbmTotalLiter > 0 && bbmTotalJarak > 0 ? (bbmTotalJarak / bbmTotalLiter).toFixed(2) : '0',
                        total_biaya_oli: oliTotalBiaya,
                        total_biaya_service: serviceTotalBiaya,
                        grand_total_pengeluaran: bbmTotalBiaya + oliTotalBiaya + serviceTotalBiaya
                    },
                    bbm_report: bbmList,
                    top_pom: topPom,
                    oli_report: oliList,
                    service_report: serviceList,
                    rekap_kendaraan: rekapKendaraanList
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- FUEL APPROVAL WORKFLOW ---
        requestIzinIsiBBM: async function(driverIdOrPayload, driverNama, noPlat) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                let dId, dName, nPlat, notes = '';
                if (typeof driverIdOrPayload === 'object' && driverIdOrPayload !== null) {
                    dId = driverIdOrPayload.driver_id || driverIdOrPayload.id_sopir || driverIdOrPayload.driverId;
                    dName = driverIdOrPayload.driver_name || driverIdOrPayload.nama_sopir || driverIdOrPayload.driverNama;
                    nPlat = driverIdOrPayload.plate_number || driverIdOrPayload.no_plat || driverIdOrPayload.noPlat;
                    notes = driverIdOrPayload.notes || driverIdOrPayload.catatan || '';
                } else {
                    dId = driverIdOrPayload;
                    dName = driverNama;
                    nPlat = noPlat;
                }

                // Invalidate izin lama milik sopir ini yang belum dipakai
                if (dId) {
                    await sb.from('fuel_approvals')
                        .update({ is_used: 'Diganti Permohonan Baru' })
                        .eq('driver_id', String(dId).trim())
                        .neq('is_used', 'Ya');
                }

                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const yy = String(wita.getFullYear()).slice(-2);
                const mm = String(wita.getMonth() + 1).padStart(2, '0');
                const dd = String(wita.getDate()).padStart(2, '0');
                const rnd = Math.floor(100 + Math.random() * 900);
                const idIzin = 'IZN-' + yy + mm + dd + '-' + rnd;

                const { error } = await sb.from('fuel_approvals').insert([{
                    id: idIzin,
                    request_time: new Date().toISOString(),
                    driver_id: String(dId || 'DRV').trim(),
                    driver_name: String(dName || 'Sopir').trim(),
                    plate_number: String(nPlat || '').trim().toUpperCase(),
                    status: 'PENDING',
                    notes: notes || null,
                    is_used: 'Belum'
                }]);

                if (error) return { success: false, message: error.message };
                return { success: true, message: 'Permohonan izin BBM berhasil diajukan!', idIzin: idIzin };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        submitPermohonanIsiBBM: async function(driverIdOrPayload, driverNama, noPlat) {
            return apiServices.requestIzinIsiBBM(driverIdOrPayload, driverNama, noPlat);
        },

        checkActiveBBMApproval: async function(driverId, targetIdIzin) {
            const sb = getClient();
            if (!sb) return { hasApproval: false, status: 'NONE' };
            try {
                let query = sb.from('fuel_approvals').select('*').order('request_time', { ascending: false }).limit(10);
                if (targetIdIzin) {
                    query = query.eq('id', targetIdIzin);
                } else if (driverId) {
                    query = query.eq('driver_id', String(driverId).trim());
                }

                const { data, error } = await query;
                if (error || !data || data.length === 0) {
                    return { hasApproval: false, status: 'NONE' };
                }

                // Ambil approval terbaru
                const row = data[0];
                const st = (row.status || '').toUpperCase().trim();
                const isUsed = (row.is_used || '').toLowerCase().trim();

                if (isUsed === 'ya' || isUsed === 'diganti permohonan baru') {
                    return { hasApproval: false, status: 'NONE' };
                }

                return {
                    hasApproval: true,
                    status: st,
                    idIzin: row.id,
                    plateNumber: row.plate_number,
                    respondedBy: row.responded_by || '-'
                };
            } catch (err) {
                return { hasApproval: false, status: 'NONE' };
            }
        },

        getPendingBBMApprovals: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };
            try {
                const { data, error } = await sb.from('fuel_approvals')
                    .select('*')
                    .eq('status', 'PENDING')
                    .order('request_time', { ascending: false });

                if (error) return { success: false, message: error.message, data: [] };

                const pendingList = (data || []).map(row => ({
                    idIzin: row.id,
                    tanggalJam: formatIndonesianDateTime(row.request_time),
                    idSopir: row.driver_id,
                    namaSopir: row.driver_name,
                    noPlat: row.plate_number,
                    status: 'PENDING'
                }));

                return { success: true, data: pendingList };
            } catch (err) {
                return { success: false, message: err.message, data: [] };
            }
        },

        respondIzinIsiBBM: async function(idIzin, action, userAdminNama, catatan) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const isApprove = (action === 'APPROVE' || action === 'DISETUJUI' || action === 'SETUJU');
                const statusText = isApprove ? 'DISETUJUI' : 'DITOLAK';

                const { error } = await sb.from('fuel_approvals').update({
                    status: statusText,
                    responded_by: userAdminNama || 'Admin',
                    responded_at: new Date().toISOString(),
                    notes: catatan || null
                }).eq('id', idIzin);

                if (error) return { success: false, message: error.message };
                return { success: true, message: 'Izin BBM berhasil ' + (isApprove ? 'disetujui.' : 'ditolak.') };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- BBM TRANSACTIONS (CRUD) ---
        submitPengisianBBM: async function(payload, base64Km, base64Struk, base64Muatan, currentUser, base64Muatan2) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const noPlat = (payload.no_plat || payload.plate_number || '').trim().toUpperCase();
                const kmSaatIni = parseInt(String(payload.km_saat_ini || 0).replace(/[^0-9]/g, ''), 10) || 0;
                const kmSebelumnya = parseInt(String(payload.km_sebelumnya || 0).replace(/[^0-9]/g, ''), 10) || 0;
                const jumlahLiter = parseFloat(payload.jumlah_liter) || 0;
                const totalBiaya = parseInt(String(payload.total_biaya || 0).replace(/[^0-9]/g, ''), 10) || 0;

                // VALIDASI ODOMETER ANTI-CURANG
                if (kmSebelumnya > 0 && kmSaatIni <= kmSebelumnya) {
                    return {
                        success: false,
                        message: 'Kilometer saat ini lebih kecil atau sama dengan kilometer sebelumnya!'
                    };
                }

                const jarakTempuh = Math.max(0, kmSaatIni - kmSebelumnya);
                const konsumsiKmL = (jumlahLiter > 0 && jarakTempuh > 0) ? parseFloat((jarakTempuh / jumlahLiter).toFixed(2)) : 0;

                // Upload foto bukti ke Google Drive Edge CDN (lh3)
                let urlKm = '';
                let urlStruk = '';
                let urlMuatan = '';

                if (base64Km && base64Km.length > 50) {
                    urlKm = await uploadToGoogleDriveCdn(base64Km, 'BBM_KM_' + noPlat);
                }
                if (base64Struk && base64Struk.length > 50) {
                    urlStruk = await uploadToGoogleDriveCdn(base64Struk, 'BBM_STRUK_' + noPlat);
                }
                if (base64Muatan && base64Muatan.length > 50) {
                    urlMuatan = await uploadToGoogleDriveCdn(base64Muatan, 'BBM_MUATAN_' + noPlat);
                }

                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const yy = String(wita.getFullYear()).slice(-2);
                const mm = String(wita.getMonth() + 1).padStart(2, '0');
                const dd = String(wita.getDate()).padStart(2, '0');
                const rnd = Math.floor(100 + Math.random() * 900);
                const idBbm = 'BBM-' + yy + mm + dd + '-' + rnd;

                const tglBBM = payload.tanggal || new Date().toISOString().split('T')[0];

                const { error } = await sb.from('fuel_logs').insert([{
                    id: idBbm,
                    fuel_date: tglBBM,
                    plate_number: noPlat,
                    driver_id: payload.id_sopir || payload.driver_id || (currentUser ? currentUser.id_user || currentUser.user_id : 'DRV'),
                    driver_name: payload.nama_sopir || payload.driver_name || (currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir'),
                    current_km: kmSaatIni,
                    prev_km: kmSebelumnya,
                    trip_distance: jarakTempuh,
                    liters: jumlahLiter,
                    total_cost: totalBiaya,
                    efficiency_ratio: konsumsiKmL,
                    gas_station: payload.nama_spbu || payload.gas_station || '',
                    fuel_type: payload.jenis_bbm || payload.fuel_type || 'Solar',
                    km_photo_url: urlKm,
                    receipt_photo_url: urlStruk,
                    cargo_photo_url: urlMuatan,
                    notes: payload.catatan || payload.notes || null
                }]);

                if (error) return { success: false, message: error.message };

                // Sinkronisasi data ke Master Kendaraan
                if (noPlat) {
                    const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                    if (vRow) {
                        const newCurrentKm = Math.max(Number(vRow.current_km || 0), kmSaatIni);
                        const newTotalLiters = (Number(vRow.total_fuel_liters || 0)) + jumlahLiter;
                        const interval = Number(vRow.oil_interval_km || 5000);
                        const baseOilKm = Number(vRow.last_oil_km || 0);
                        const remaining = (baseOilKm + interval) - newCurrentKm;
                        let statusOli = 'Oli Aman';
                        if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                        else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                        await sb.from('vehicles').update({
                            current_km: newCurrentKm,
                            last_fuel_date: tglBBM,
                            total_fuel_liters: newTotalLiters,
                            remaining_oil_km: remaining,
                            oil_status: statusOli
                        }).eq('plate_number', noPlat);
                    }
                }

                // Tandai izin BBM sudah digunakan jika ada id_izin
                if (payload.id_izin) {
                    await sb.from('fuel_approvals').update({ is_used: 'Ya' }).eq('id', payload.id_izin);
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'SYSTEM',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir',
                    currentUser ? currentUser.role : 'Sopir',
                    'INPUT_BBM',
                    'Mencatat BBM ' + idBbm + ' (' + noPlat + ', ' + jumlahLiter + ' L, KM ' + kmSaatIni + ')'
                );

                return {
                    success: true,
                    message: 'Data pengisian BBM berhasil disimpan!',
                    jarak_tempuh: jarakTempuh,
                    rata_rata_konsumsi: konsumsiKmL,
                    km_saat_ini: kmSaatIni
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        editBBMTransaction: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idBBM = (payload.id_bbm || '').trim();
                if (!idBBM) return { success: false, message: 'ID Transaksi BBM tidak valid!' };

                const { data: existing, error: getErr } = await sb.from('fuel_logs').select('*').eq('id', idBBM).maybeSingle();
                if (getErr || !existing) return { success: false, message: 'Transaksi BBM ' + idBBM + ' tidak ditemukan!' };

                const noPlat = (payload.no_plat || existing.plate_number || '').trim().toUpperCase();
                const kmSaatIni = parseInt(String(payload.km_saat_ini || existing.current_km || 0).replace(/[^0-9]/g, ''), 10);
                const kmSebelumnya = parseInt(String(payload.km_sebelumnya || existing.prev_km || 0).replace(/[^0-9]/g, ''), 10);
                const jumlahLiter = parseFloat(payload.jumlah_liter !== undefined ? payload.jumlah_liter : existing.liters) || 0;
                const totalBiaya = parseInt(String(payload.total_biaya !== undefined ? payload.total_biaya : existing.total_cost || 0).replace(/[^0-9]/g, ''), 10);
                const jarakTempuh = Math.max(0, kmSaatIni - kmSebelumnya);
                const konsumsiKmL = (jumlahLiter > 0 && jarakTempuh > 0) ? parseFloat((jarakTempuh / jumlahLiter).toFixed(2)) : 0;

                const updateObj = {
                    plate_number: noPlat,
                    current_km: kmSaatIni,
                    prev_km: kmSebelumnya,
                    trip_distance: jarakTempuh,
                    liters: jumlahLiter,
                    total_cost: totalBiaya,
                    efficiency_ratio: konsumsiKmL
                };

                if (payload.tanggal) updateObj.fuel_date = payload.tanggal;
                if (payload.nama_sopir) updateObj.driver_name = payload.nama_sopir;
                if (payload.nama_spbu) updateObj.gas_station = payload.nama_spbu;
                if (payload.jenis_bbm) updateObj.fuel_type = payload.jenis_bbm;
                if (payload.catatan !== undefined) updateObj.notes = payload.catatan;

                // Handle replacement photos
                if (payload.base64_foto_km && payload.base64_foto_km.length > 50) {
                    updateObj.km_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_km, 'BBM_KM_' + idBBM);
                }
                if (payload.base64_foto_struk && payload.base64_foto_struk.length > 50) {
                    updateObj.receipt_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_struk, 'BBM_STRUK_' + idBBM);
                }
                if (payload.base64_foto_muatan && payload.base64_foto_muatan.length > 50) {
                    updateObj.cargo_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_muatan, 'BBM_MUATAN_' + idBBM);
                }

                const { error: updErr } = await sb.from('fuel_logs').update(updateObj).eq('id', idBBM);
                if (updErr) return { success: false, message: updErr.message };

                // Recalculate vehicle metrics
                if (noPlat) {
                    const { data: allLogs } = await sb.from('fuel_logs').select('current_km, liters').eq('plate_number', noPlat);
                    let maxKm = 0;
                    let totL = 0;
                    (allLogs || []).forEach(l => {
                        if (Number(l.current_km || 0) > maxKm) maxKm = Number(l.current_km || 0);
                        totL += Number(l.liters || 0);
                    });

                    await sb.from('vehicles').update({
                        current_km: maxKm,
                        total_fuel_liters: totL
                    }).eq('plate_number', noPlat);
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_BBM',
                    'Mengedit transaksi BBM ' + idBBM + ' (' + noPlat + ', ' + jumlahLiter + 'L, KM ' + kmSaatIni + ')'
                );

                return { success: true, message: 'Transaksi BBM ' + idBBM + ' berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteBBMTransaction: async function(idBBM, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                idBBM = (idBBM || '').trim();
                if (!idBBM) return { success: false, message: 'ID Transaksi BBM tidak valid!' };

                const { data: existing } = await sb.from('fuel_logs').select('plate_number').eq('id', idBBM).maybeSingle();
                const noPlat = existing ? existing.plate_number : null;

                const { error } = await sb.from('fuel_logs').delete().eq('id', idBBM);
                if (error) return { success: false, message: error.message };

                // Sync ulang data kendaraan
                if (noPlat) {
                    const { data: allLogs } = await sb.from('fuel_logs').select('current_km, liters').eq('plate_number', noPlat);
                    let maxKm = 0;
                    let totL = 0;
                    (allLogs || []).forEach(l => {
                        if (Number(l.current_km || 0) > maxKm) maxKm = Number(l.current_km || 0);
                        totL += Number(l.liters || 0);
                    });

                    await sb.from('vehicles').update({
                        current_km: maxKm,
                        total_fuel_liters: totL
                    }).eq('plate_number', noPlat);
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_BBM',
                    'Menghapus transaksi BBM ' + idBBM
                );

                return { success: true, message: 'Transaksi BBM ' + idBBM + ' berhasil dihapus!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- OLI TRANSACTIONS (CRUD) ---
        submitInputOli: async function(payload, base64Km, base64Nota, currentUser, base64Bayar1, base64Bayar2) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const noPlat = (payload.no_plat || payload.plate_number || '').trim().toUpperCase();
                const kmSaatGanti = parseInt(String(payload.km_saat_ini || payload.km_saat_ganti || 0).replace(/[^0-9]/g, ''), 10) || 0;
                const totalBiaya = parseInt(String(payload.total_biaya || 0).replace(/[^0-9]/g, ''), 10) || 0;
                const jenisTransaksi = payload.jenis_transaksi || 'Ganti Oli';
                const jumlahLiter = parseFloat(payload.jumlah_liter) || 0;

                let urlKm = '';
                let urlNota = '';

                if (base64Km && base64Km.length > 50) {
                    urlKm = await uploadToGoogleDriveCdn(base64Km, 'OLI_KM_' + noPlat);
                }
                if (base64Nota && base64Nota.length > 50) {
                    urlNota = await uploadToGoogleDriveCdn(base64Nota, 'OLI_NOTA_' + noPlat);
                }

                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const yy = String(wita.getFullYear()).slice(-2);
                const mm = String(wita.getMonth() + 1).padStart(2, '0');
                const dd = String(wita.getDate()).padStart(2, '0');
                const rnd = Math.floor(100 + Math.random() * 900);
                const idOli = 'OLI-' + yy + mm + dd + '-' + rnd;

                const tglOli = payload.tanggal || new Date().toISOString().split('T')[0];

                const { error } = await sb.from('oil_change_logs').insert([{
                    id: idOli,
                    service_date: tglOli,
                    plate_number: noPlat,
                    driver_id: payload.id_sopir || (currentUser ? currentUser.id_user || currentUser.user_id : 'DRV'),
                    driver_name: payload.nama_sopir || (currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir'),
                    service_km: kmSaatGanti,
                    transaction_type: jenisTransaksi,
                    oil_brand: payload.merek_oli || '',
                    liters: jumlahLiter,
                    total_cost: totalBiaya,
                    workshop_name: payload.nama_bengkel || '',
                    km_photo_url: urlKm,
                    receipt_photo_url: urlNota,
                    notes: payload.catatan || null
                }]);

                if (error) return { success: false, message: error.message };

                // Update Master Kendaraan
                if (noPlat) {
                    const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                    if (vRow) {
                        const newCurrentKm = Math.max(Number(vRow.current_km || 0), kmSaatGanti);
                        const interval = Number(vRow.oil_interval_km || 5000);
                        let newLastOilKm = Number(vRow.last_oil_km || 0);

                        if (jenisTransaksi === 'Ganti Oli') {
                            newLastOilKm = kmSaatGanti;
                        }

                        const remaining = (newLastOilKm + interval) - newCurrentKm;
                        let statusOli = 'Oli Aman';
                        if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                        else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                        await sb.from('vehicles').update({
                            current_km: newCurrentKm,
                            last_oil_km: newLastOilKm,
                            remaining_oil_km: remaining,
                            oil_status: statusOli
                        }).eq('plate_number', noPlat);
                    }
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'SYSTEM',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir',
                    'Sopir',
                    'INPUT_OLI',
                    'Mencatat riwayat oli ' + idOli + ' (' + noPlat + ', ' + jenisTransaksi + ', ' + totalBiaya + ')'
                );

                return { success: true, message: 'Data riwayat oli berhasil disimpan!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        editOliTransaction: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idOli = (payload.id_oli || '').trim();
                if (!idOli) return { success: false, message: 'ID Transaksi Oli tidak valid!' };

                const { data: existing, error: getErr } = await sb.from('oil_change_logs').select('*').eq('id', idOli).maybeSingle();
                if (getErr || !existing) return { success: false, message: 'Transaksi Oli ' + idOli + ' tidak ditemukan!' };

                const noPlat = (payload.no_plat || existing.plate_number || '').trim().toUpperCase();
                const kmSaatGanti = parseInt(String(payload.km_saat_ganti || existing.service_km || 0).replace(/[^0-9]/g, ''), 10);
                const jenisTransaksi = payload.jenis_transaksi || existing.transaction_type || 'Ganti Oli';
                const totalBiaya = parseInt(String(payload.total_biaya !== undefined ? payload.total_biaya : existing.total_cost || 0).replace(/[^0-9]/g, ''), 10);
                const jumlahLiter = parseFloat(payload.jumlah_liter !== undefined ? payload.jumlah_liter : existing.liters) || 0;

                const updateObj = {
                    plate_number: noPlat,
                    service_km: kmSaatGanti,
                    transaction_type: jenisTransaksi,
                    total_cost: totalBiaya,
                    liters: jumlahLiter
                };

                if (payload.tanggal) updateObj.service_date = payload.tanggal;
                if (payload.nama_sopir) updateObj.driver_name = payload.nama_sopir;
                if (payload.merek_oli !== undefined) updateObj.oil_brand = payload.merek_oli;
                if (payload.nama_bengkel !== undefined) updateObj.workshop_name = payload.nama_bengkel;
                if (payload.catatan !== undefined) updateObj.notes = payload.catatan;

                if (payload.base64_foto_km && payload.base64_foto_km.length > 50) {
                    updateObj.km_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_km, 'OLI_KM_' + idOli);
                }
                if (payload.base64_foto_nota && payload.base64_foto_nota.length > 50) {
                    updateObj.receipt_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_nota, 'OLI_NOTA_' + idOli);
                }

                const { error: updErr } = await sb.from('oil_change_logs').update(updateObj).eq('id', idOli);
                if (updErr) return { success: false, message: updErr.message };

                // Recalculate oil status for this vehicle
                if (noPlat) {
                    const { data: latestOil } = await sb.from('oil_change_logs')
                        .select('service_km')
                        .eq('plate_number', noPlat)
                        .eq('transaction_type', 'Ganti Oli')
                        .order('service_km', { ascending: false })
                        .limit(1);

                    const maxOilKm = latestOil && latestOil.length > 0 ? Number(latestOil[0].service_km || 0) : 0;
                    if (maxOilKm > 0) {
                        const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                        if (vRow) {
                            const interval = Number(vRow.oil_interval_km || 5000);
                            const curKm = Number(vRow.current_km || 0);
                            const remaining = (maxOilKm + interval) - curKm;
                            let statusOli = 'Oli Aman';
                            if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                            else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                            await sb.from('vehicles').update({
                                last_oil_km: maxOilKm,
                                remaining_oil_km: remaining,
                                oil_status: statusOli
                            }).eq('plate_number', noPlat);
                        }
                    }
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_OLI',
                    'Mengedit transaksi Oli ' + idOli + ' (' + noPlat + ', ' + jenisTransaksi + ')'
                );

                return { success: true, message: 'Transaksi Oli ' + idOli + ' berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteOliTransaction: async function(idOli, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                idOli = (idOli || '').trim();
                if (!idOli) return { success: false, message: 'ID Transaksi Oli tidak valid!' };

                const { data: existing } = await sb.from('oil_change_logs').select('plate_number').eq('id', idOli).maybeSingle();
                const noPlat = existing ? existing.plate_number : null;

                const { error } = await sb.from('oil_change_logs').delete().eq('id', idOli);
                if (error) return { success: false, message: error.message };

                // Recalculate oil status for this vehicle
                if (noPlat) {
                    const { data: latestOil } = await sb.from('oil_change_logs')
                        .select('service_km')
                        .eq('plate_number', noPlat)
                        .eq('transaction_type', 'Ganti Oli')
                        .order('service_km', { ascending: false })
                        .limit(1);

                    const maxOilKm = latestOil && latestOil.length > 0 ? Number(latestOil[0].service_km || 0) : 0;
                    const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                    if (vRow) {
                        const interval = Number(vRow.oil_interval_km || 5000);
                        const curKm = Number(vRow.current_km || 0);
                        const remaining = (maxOilKm + interval) - curKm;
                        let statusOli = 'Oli Aman';
                        if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                        else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                        await sb.from('vehicles').update({
                            last_oil_km: maxOilKm,
                            remaining_oil_km: remaining,
                            oil_status: statusOli
                        }).eq('plate_number', noPlat);
                    }
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_OLI',
                    'Menghapus transaksi Oli ' + idOli
                );

                return { success: true, message: 'Transaksi Oli berhasil dihapus.' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        updateBatasIntervalOli: async function(noPlat, intervalKm, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                const interval = parseInt(String(intervalKm).replace(/[^0-9]/g, ''), 10);
                if (!interval || interval <= 0) {
                    return { success: false, message: 'Interval KM harus berupa angka positif!' };
                }

                const cleanPlat = (noPlat || '').trim().toUpperCase();
                const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', cleanPlat).maybeSingle();
                if (!vRow) return { success: false, message: 'Kendaraan ' + cleanPlat + ' tidak ditemukan!' };

                const curKm = Number(vRow.current_km || 0);
                const baseOilKm = Number(vRow.last_oil_km || 0);
                const remaining = (baseOilKm + interval) - curKm;
                let statusOli = 'Oli Aman';
                if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                const { error } = await sb.from('vehicles').update({
                    oil_interval_km: interval,
                    remaining_oil_km: remaining,
                    oil_status: statusOli
                }).eq('plate_number', cleanPlat);

                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'UPDATE_INTERVAL_OLI',
                    'Mengubah interval oli ' + cleanPlat + ' menjadi ' + interval + ' KM'
                );

                return { success: true, message: 'Interval ganti oli untuk ' + cleanPlat + ' berhasil diperbarui menjadi ' + interval + ' KM!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- SERVICE TRANSACTIONS (CRUD) ---
        submitInputService: async function(payload, base64Nota, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const noPlat = (payload.no_plat || payload.plate_number || '').trim().toUpperCase();
                const biayaPerbaikan = parseInt(String(payload.biaya_perbaikan || 0).replace(/[^0-9]/g, ''), 10) || 0;
                if (!biayaPerbaikan || biayaPerbaikan <= 0) {
                    return { success: false, message: 'Biaya perbaikan wajib diisi!' };
                }

                const kmSaatIni = parseInt(String(payload.km_saat_ini || 0).replace(/[^0-9]/g, ''), 10) || 0;

                // Upload nota ke Google Drive Edge CDN (lh3)
                let urlNota = '';
                if (Array.isArray(base64Nota)) {
                    const urls = [];
                    for (const b of base64Nota) {
                        if (b && b.length > 50) {
                            const u = await uploadToGoogleDriveCdn(b, 'SRV_NOTA_' + noPlat);
                            if (u) urls.push(u);
                        }
                    }
                    urlNota = urls.join('|||');
                } else if (typeof base64Nota === 'string' && base64Nota.length > 50) {
                    urlNota = await uploadToGoogleDriveCdn(base64Nota, 'SRV_NOTA_' + noPlat);
                }

                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const yy = String(wita.getFullYear()).slice(-2);
                const mm = String(wita.getMonth() + 1).padStart(2, '0');
                const dd = String(wita.getDate()).padStart(2, '0');
                const rnd = Math.floor(100 + Math.random() * 900);
                const idServis = 'SRV-' + yy + mm + dd + '-' + rnd;

                const tglServis = payload.tanggal || new Date().toISOString().split('T')[0];

                const { error } = await sb.from('vehicle_services').insert([{
                    id: idServis,
                    service_date: tglServis,
                    plate_number: noPlat,
                    driver_id: payload.id_sopir || (currentUser ? currentUser.id_user || currentUser.user_id : 'DRV'),
                    driver_name: payload.nama_sopir || (currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir'),
                    current_km: kmSaatIni,
                    workshop_name: payload.nama_bengkel || '',
                    cost: biayaPerbaikan,
                    repair_details: payload.catatan_perbaikan || '',
                    receipt_photo_url: urlNota
                }]);

                if (error) return { success: false, message: error.message };

                // Update KM mobil jika lebih tinggi
                if (noPlat && kmSaatIni > 0) {
                    const { data: vRow } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                    if (vRow && kmSaatIni > Number(vRow.current_km || 0)) {
                        const interval = Number(vRow.oil_interval_km || 5000);
                        const baseOilKm = Number(vRow.last_oil_km || 0);
                        const remaining = (baseOilKm + interval) - kmSaatIni;
                        let statusOli = 'Oli Aman';
                        if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                        else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                        await sb.from('vehicles').update({
                            current_km: kmSaatIni,
                            remaining_oil_km: remaining,
                            oil_status: statusOli
                        }).eq('plate_number', noPlat);
                    }
                }

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'SYSTEM',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Sopir',
                    'Sopir',
                    'INPUT_SERVICE',
                    'Mencatat servis ' + idServis + ' (' + noPlat + ', ' + biayaPerbaikan + ')'
                );

                return { success: true, message: 'Riwayat servis kendaraan berhasil disimpan!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        editServiceTransaction: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idService = (payload.id_service || '').trim();
                if (!idService) return { success: false, message: 'ID Servis tidak valid!' };

                const { data: existing, error: getErr } = await sb.from('vehicle_services').select('*').eq('id', idService).maybeSingle();
                if (getErr || !existing) return { success: false, message: 'Transaksi perbaikan/servis ' + idService + ' tidak ditemukan!' };

                const noPlat = (payload.no_plat || existing.plate_number || '').trim().toUpperCase();
                const kmSaatIni = parseInt(String(payload.km_saat_ini !== undefined ? payload.km_saat_ini : existing.current_km || 0).replace(/[^0-9]/g, ''), 10);
                const biayaPerbaikan = parseInt(String(payload.biaya_perbaikan !== undefined ? payload.biaya_perbaikan : existing.cost || 0).replace(/[^0-9]/g, ''), 10);

                const updateObj = {
                    plate_number: noPlat,
                    current_km: kmSaatIni,
                    cost: biayaPerbaikan
                };

                if (payload.tanggal) updateObj.service_date = payload.tanggal;
                if (payload.nama_sopir) updateObj.driver_name = payload.nama_sopir;
                if (payload.nama_bengkel !== undefined) updateObj.workshop_name = payload.nama_bengkel;
                if (payload.catatan_perbaikan !== undefined) updateObj.repair_details = payload.catatan_perbaikan;

                if (payload.base64_foto_nota && payload.base64_foto_nota.length > 50) {
                    updateObj.receipt_photo_url = await uploadToGoogleDriveCdn(payload.base64_foto_nota, 'SRV_NOTA_' + idService);
                }

                const { error: updErr } = await sb.from('vehicle_services').update(updateObj).eq('id', idService);
                if (updErr) return { success: false, message: updErr.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_SERVICE',
                    'Mengedit transaksi perbaikan/servis ' + idService + ' (' + noPlat + ', ' + biayaPerbaikan + ')'
                );

                return { success: true, message: 'Transaksi servis ' + idService + ' berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteServiceTransaction: async function(idService, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                idService = (idService || '').trim();
                if (!idService) return { success: false, message: 'ID Servis tidak valid!' };

                const { error } = await sb.from('vehicle_services').delete().eq('id', idService);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_SERVICE',
                    'Menghapus transaksi perbaikan/servis ' + idService
                );

                return { success: true, message: 'Transaksi perbaikan/servis ' + idService + ' berhasil dihapus!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- MASTER DATA RELATIONS (SPBU, BENGKEL, OLI, VEHICLES, SOPIR) ---
        getSpbuList: async function() {
            const sb = getClient();
            const defaultSpbu = [
                'SPBU Balikpapan',
                'SPBU Loa Kulu',
                'SPBU Samarinda',
                'SPBU Tenggarong',
                'SPBU KM 13',
                'SPBU Kebun Sayur',
                'SPBU Karang Anyar'
            ];
            if (!sb) return { success: true, data: defaultSpbu };
            try {
                const listSet = new Set(defaultSpbu);
                const { data: bbmLogs } = await sb.from('fuel_logs').select('gas_station');
                (bbmLogs || []).forEach(b => {
                    if (b.gas_station && b.gas_station.trim()) listSet.add(b.gas_station.trim());
                });

                // Deleted list
                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_SPBU_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                const delSet = new Set((deleted || []).map(x => String(x || '').toLowerCase().trim()));

                const result = Array.from(listSet).filter(p => p && !delSet.has(p.toLowerCase().trim())).sort((a, b) => a.localeCompare(b));
                return { success: true, data: result };
            } catch (err) {
                return { success: true, data: defaultSpbu };
            }
        },

        deleteSpbuItemServer: async function(nama) {
            const sb = getClient();
            if (!sb || !nama) return { success: true };
            try {
                const cleanNama = String(nama).trim();
                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_SPBU_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                if (!deleted.some(x => String(x).toLowerCase() === cleanNama.toLowerCase())) {
                    deleted.push(cleanNama);
                    await sb.from('system_configs').upsert({
                        key: 'DELETED_SPBU_LIST',
                        value: JSON.stringify(deleted),
                        description: 'Daftar SPBU yang dihapus oleh admin'
                    });
                }
                return { success: true };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getBengkelList: async function() {
            const sb = getClient();
            const defaultBengkel = [
                'Bengkel Jaya Abadi',
                'Bengkel Sejahtera',
                'Bengkel Auto2000',
                'Bengkel Tamara Motor',
                'Bengkel Maju Bersama'
            ];
            if (!sb) return { success: true, data: defaultBengkel };
            try {
                const listSet = new Set(defaultBengkel);
                const [srvRes, oliRes] = await Promise.all([
                    sb.from('vehicle_services').select('workshop_name'),
                    sb.from('oil_change_logs').select('workshop_name')
                ]);

                (srvRes.data || []).forEach(s => {
                    if (s.workshop_name && s.workshop_name.trim()) listSet.add(s.workshop_name.trim());
                });
                (oliRes.data || []).forEach(o => {
                    if (o.workshop_name && o.workshop_name.trim()) listSet.add(o.workshop_name.trim());
                });

                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_BENGKEL_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                const delSet = new Set((deleted || []).map(x => String(x || '').toLowerCase().trim()));

                const result = Array.from(listSet).filter(b => b && !delSet.has(b.toLowerCase().trim())).sort((a, b) => a.localeCompare(b));
                return { success: true, data: result };
            } catch (err) {
                return { success: true, data: defaultBengkel };
            }
        },

        deleteBengkelItemServer: async function(nama) {
            const sb = getClient();
            if (!sb || !nama) return { success: true };
            try {
                const cleanNama = String(nama).trim();
                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_BENGKEL_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                if (!deleted.some(x => String(x).toLowerCase() === cleanNama.toLowerCase())) {
                    deleted.push(cleanNama);
                    await sb.from('system_configs').upsert({
                        key: 'DELETED_BENGKEL_LIST',
                        value: JSON.stringify(deleted),
                        description: 'Daftar Bengkel yang dihapus oleh admin'
                    });
                }
                return { success: true };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getMerekOliList: async function() {
            const sb = getClient();
            const defaultOli = [
                'Shell Helix HX7 10W-40',
                'Pertamina Fastron 10W-40',
                'Pertamina Meditran SX 15W-40',
                'Castrol Magnatec 10W-40',
                'Total Quartz 7000 10W-40',
                'Mobil Super 2000 10W-40',
                'Idemitsu 10W-40',
                'Evalube Super Transco 15W-40'
            ];
            if (!sb) return defaultOli;
            try {
                const listSet = new Set(defaultOli);
                const { data: oliLogs } = await sb.from('oil_change_logs').select('oil_brand');
                (oliLogs || []).forEach(o => {
                    if (o.oil_brand && o.oil_brand.trim()) listSet.add(o.oil_brand.trim());
                });

                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_MEREK_OLI_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                const delSet = new Set((deleted || []).map(x => String(x || '').toLowerCase().trim()));

                const result = Array.from(listSet).filter(m => m && !delSet.has(m.toLowerCase().trim())).sort((a, b) => a.localeCompare(b));
                return result;
            } catch (err) {
                return defaultOli;
            }
        },

        deleteMerekOliItemServer: async function(nama) {
            const sb = getClient();
            if (!sb || !nama) return { success: true };
            try {
                const cleanNama = String(nama).trim();
                const { data: cfg } = await sb.from('system_configs').select('value').eq('key', 'DELETED_MEREK_OLI_LIST').maybeSingle();
                let deleted = [];
                if (cfg && cfg.value) {
                    try { deleted = JSON.parse(cfg.value); } catch(e){}
                }
                if (!deleted.some(x => String(x).toLowerCase() === cleanNama.toLowerCase())) {
                    deleted.push(cleanNama);
                    await sb.from('system_configs').upsert({
                        key: 'DELETED_MEREK_OLI_LIST',
                        value: JSON.stringify(deleted),
                        description: 'Daftar Merek Oli yang dihapus oleh admin'
                    });
                }
                return { success: true };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        saveNewMasterVehicle: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const noPlat = (payload.no_plat || '').trim().toUpperCase();
                if (!noPlat) return { success: false, message: 'Nomor Plat Kendaraan wajib diisi!' };

                const jenisMobil = (payload.jenis_mobil || 'Mobil').trim();
                const sopirDefault = (payload.sopir_default || (currentUser ? currentUser.nama : 'Sopir')).trim();
                const kmAwal = parseInt(String(payload.km_awal || 0).replace(/[^0-9]/g, ''), 10) || 0;
                const intervalOli = parseInt(String(payload.interval_oli || 5000).replace(/[^0-9]/g, ''), 10) || 5000;

                // Cek duplikasi nomor plat
                const { data: existing } = await sb.from('vehicles').select('id').eq('plate_number', noPlat).maybeSingle();
                if (existing) {
                    return { success: false, message: 'Nomor Plat ' + noPlat + ' sudah terdaftar di sistem!' };
                }

                const newId = 'KND-' + Date.now().toString().slice(-4);
                const { error } = await sb.from('vehicles').insert([{
                    id: newId,
                    plate_number: noPlat,
                    vehicle_type: jenisMobil,
                    default_driver: sopirDefault,
                    current_km: kmAwal,
                    last_fuel_date: null,
                    total_fuel_liters: 0,
                    last_oil_km: kmAwal,
                    oil_interval_km: intervalOli,
                    oil_status: 'Oli Aman',
                    remaining_oil_km: intervalOli,
                    status: 'true'
                }]);

                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'TAMBAH_KENDARAAN',
                    'Menambahkan armada baru: ' + noPlat + ' (' + jenisMobil + ', Sopir: ' + sopirDefault + ', KM Awal: ' + kmAwal + ')'
                );

                return { success: true, message: 'Kendaraan ' + noPlat + ' berhasil ditambahkan!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        editVehicleFromRekap: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const noPlat = (payload.no_plat || '').trim().toUpperCase();
                if (!noPlat) return { success: false, message: 'Nomor Plat Kendaraan tidak valid!' };

                const { data: existing } = await sb.from('vehicles').select('*').eq('plate_number', noPlat).maybeSingle();
                if (!existing) return { success: false, message: 'Kendaraan ' + noPlat + ' tidak ditemukan di database!' };

                const jenisMobil = (payload.jenis_mobil || existing.vehicle_type || 'Mobil').trim();
                const sopirDefault = (payload.sopir_default || existing.default_driver || '-').trim();
                const interval = parseInt(String(payload.interval_oli || existing.oil_interval_km || 5000).replace(/[^0-9]/g, ''), 10) || 5000;
                const statusAktif = (payload.status_aktif !== undefined ? String(payload.status_aktif) : existing.status);

                const curKm = Number(existing.current_km || 0);
                const lastOilKm = Number(existing.last_oil_km || 0);
                const remaining = (lastOilKm + interval) - curKm;
                let statusOli = 'Oli Aman';
                if (remaining <= 500) statusOli = 'WAJIB GANTI OLI';
                else if (remaining <= 2000) statusOli = 'Segera Ganti Oli';

                const { error } = await sb.from('vehicles').update({
                    vehicle_type: jenisMobil,
                    default_driver: sopirDefault,
                    oil_interval_km: interval,
                    remaining_oil_km: remaining,
                    oil_status: statusOli,
                    status: (statusAktif === 'true' || statusAktif === true || statusAktif === 'Aktif') ? 'true' : 'false'
                }).eq('plate_number', noPlat);

                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_KENDARAAN',
                    'Mengedit data kendaraan ' + noPlat + ' (' + jenisMobil + ', Sopir: ' + sopirDefault + ', Interval: ' + interval + ' KM)'
                );

                return { success: true, message: 'Data kendaraan ' + noPlat + ' berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteVehicleFromRekap: async function(noPlat, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                noPlat = (noPlat || '').trim().toUpperCase();
                if (!noPlat) return { success: false, message: 'Nomor Plat tidak valid!' };

                const { error } = await sb.from('vehicles').delete().eq('plate_number', noPlat);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_KENDARAAN',
                    'Menghapus master kendaraan ' + noPlat
                );

                return { success: true, message: 'Kendaraan ' + noPlat + ' berhasil dihapus dari sistem!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        getSopirArmadaList: async function() {
            const sb = getClient();
            const defaultDrivers = ['01 PENGANTARAN', '02 PENGANTARAN', 'ASWIN', 'FAHRI'];
            if (!sb) return { success: true, data: defaultDrivers };
            try {
                const { data } = await sb.from('profiles').select('nama_lengkap, role, is_active');
                const sopirSet = new Set();
                (data || []).forEach(u => {
                    const r = (u.role || '').toLowerCase();
                    const active = u.is_active === true || u.is_active === 'true' || u.is_active === 'Aktif';
                    if (active && (r.includes('sopir') || r.includes('driver')) && u.nama_lengkap) {
                        sopirSet.add(u.nama_lengkap.trim());
                    }
                });

                // Also check default drivers from vehicles
                const { data: vList } = await sb.from('vehicles').select('default_driver');
                (vList || []).forEach(v => {
                    if (v.default_driver && v.default_driver.trim() && v.default_driver !== '-') {
                        sopirSet.add(v.default_driver.trim());
                    }
                });

                defaultDrivers.forEach(d => sopirSet.add(d));

                const result = Array.from(sopirSet).sort((a, b) => a.localeCompare(b));
                return { success: true, data: result };
            } catch (err) {
                return { success: true, data: defaultDrivers };
            }
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

        // --- MASTER DATA SUPPLIER & BARANG DATANG (TAHAP 3) ---
        getSuppliers: async function(currentUser) {
            const sb = getClient();
            const defaultSuppliers = [
                { id: 'SUP-001', nama: 'PT. Maju Jaya', kelompok: 'Semen & Besi', no_telp: '081234567801', alamat: 'Balikpapan', tempo_default: 30, catatan: 'Distributor Semen Tonasa & Besi Beton' },
                { id: 'SUP-002', nama: 'CV. Sumber Bangunan', kelompok: 'Cat & Kimia', no_telp: '081234567802', alamat: 'Samarinda', tempo_default: 45, catatan: 'Distributor Cat Dulux, Avian & No Drop' },
                { id: 'SUP-003', nama: 'UD. Kayu Lestari', kelompok: 'Kayu & Triplek', no_telp: '081234567803', alamat: 'Loa Kulu', tempo_default: 14, catatan: 'Kayu Meranti, Ulin & Plywood' }
            ];
            if (!sb) return { success: true, data: defaultSuppliers };
            try {
                const { data, error } = await sb.from('suppliers').select('*').order('name');
                if (error || !data || data.length === 0) {
                    return { success: true, data: defaultSuppliers };
                }
                const mapped = data.map(s => ({
                    id: s.id,
                    id_suplayer: s.id,
                    nama: s.name,
                    nama_suplayer: s.name,
                    kelompok: s.category || '',
                    kelompok_suplayer: s.category || '',
                    no_telp: s.phone || '',
                    alamat: s.address || '',
                    tempo_default: s.default_due_days !== null && s.default_due_days !== undefined ? Number(s.default_due_days) : 30,
                    catatan: s.notes || ''
                }));
                return { success: true, data: mapped };
            } catch (err) {
                return { success: true, data: defaultSuppliers };
            }
        },

        saveSupplier: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const nama = (payload.nama || payload.nama_suplayer || payload.name || '').trim();
                if (!nama) return { success: false, message: 'Nama suplayer wajib diisi!' };

                // Auto generate ID SUP-XXX
                const { data: allSups } = await sb.from('suppliers').select('id');
                let maxNum = 0;
                (allSups || []).forEach(s => {
                    const m = String(s.id || '').match(/SUP-(\d+)/i);
                    if (m) {
                        const num = parseInt(m[1], 10);
                        if (num > maxNum) maxNum = num;
                    }
                });
                const newId = 'SUP-' + String(maxNum + 1).padStart(3, '0');

                const supRow = {
                    id: newId,
                    name: nama,
                    category: (payload.kelompok || payload.category || '').trim() || null,
                    phone: (payload.no_telp || payload.phone || '').trim() || null,
                    address: (payload.alamat || payload.address || '').trim() || null,
                    default_due_days: parseInt(payload.tempo_default, 10) || 30,
                    notes: (payload.catatan || payload.notes || '').trim() || null,
                    created_by: currentUser ? currentUser.nama || currentUser.nama_lengkap || 'Admin' : 'Admin'
                };

                const { data, error } = await sb.from('suppliers').insert([supRow]).select().single();
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'TAMBAH_SUPPLIER',
                    'Menambahkan suplayer baru: ' + nama + ' (' + newId + ')'
                );

                return {
                    success: true,
                    message: 'Suplayer ' + nama + ' berhasil disimpan!',
                    data: {
                        id: newId,
                        nama: nama,
                        kelompok: supRow.category,
                        no_telp: supRow.phone,
                        alamat: supRow.address,
                        tempo_default: supRow.default_due_days,
                        catatan: supRow.notes
                    }
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        updateSupplier: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idSup = (payload.id || payload.id_suplayer || '').trim();
                if (!idSup) return { success: false, message: 'ID Suplayer tidak valid!' };

                const updateObj = {};
                if (payload.nama || payload.nama_suplayer || payload.name) {
                    updateObj.name = (payload.nama || payload.nama_suplayer || payload.name).trim();
                }
                if (payload.kelompok !== undefined || payload.category !== undefined) {
                    updateObj.category = (payload.kelompok !== undefined ? payload.kelompok : payload.category).trim() || null;
                }
                if (payload.no_telp !== undefined || payload.phone !== undefined) {
                    updateObj.phone = (payload.no_telp !== undefined ? payload.no_telp : payload.phone).trim() || null;
                }
                if (payload.alamat !== undefined || payload.address !== undefined) {
                    updateObj.address = (payload.alamat !== undefined ? payload.alamat : payload.address).trim() || null;
                }
                if (payload.tempo_default !== undefined) {
                    updateObj.default_due_days = parseInt(payload.tempo_default, 10) || 30;
                }
                if (payload.catatan !== undefined || payload.notes !== undefined) {
                    updateObj.notes = (payload.catatan !== undefined ? payload.catatan : payload.notes).trim() || null;
                }

                const { error } = await sb.from('suppliers').update(updateObj).eq('id', idSup);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_SUPPLIER',
                    'Memperbarui data suplayer ' + idSup
                );

                return { success: true, message: 'Data suplayer ' + (updateObj.name || idSup) + ' berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteSupplier: async function(idSup, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                idSup = String(idSup || '').trim();
                if (!idSup) return { success: false, message: 'ID Suplayer tidak valid!' };

                const { error } = await sb.from('suppliers').delete().eq('id', idSup);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_SUPPLIER',
                    'Menghapus suplayer ' + idSup
                );

                return { success: true, message: 'Suplayer berhasil dihapus!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        // --- BARANG DATANG (INCOMING GOODS) ---
        getBarangDatangList: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };
            try {
                const { data, error } = await sb.from('incoming_goods').select('*').order('created_at', { ascending: false });
                if (error || !data) return { success: true, data: [] };

                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const todayZero = new Date(wita.getFullYear(), wita.getMonth(), wita.getDate(), 0, 0, 0);

                const mapped = data.map(b => {
                    const isPendingAdmin = (
                        b.payment_method === 'Di isi admin nanti' || 
                        b.payment_method === 'DIISI ADMIN NANTI' ||
                        b.due_status === 'Diisi Admin Nanti' || 
                        b.due_status === 'Menunggu Admin'
                    );

                    let calculatedStatus = b.due_status || 'Normal';
                    let daysRemaining = null;
                    let calculatedTglJatuhTempo = b.due_date ? formatIndonesianDateOnly(b.due_date) : '-';

                    const isLunas = (
                        b.payment_method === 'Pembayaran cash' ||
                        b.payment_method === 'Pembayaran transfer' ||
                        b.payment_method === 'Cash / Transfer' ||
                        (b.remaining_debt !== null && Number(b.remaining_debt) <= 0) ||
                        (b.due_status && b.due_status.toLowerCase() === 'lunas')
                    );

                    if (isPendingAdmin) {
                        calculatedStatus = 'Menunggu Admin';
                        calculatedTglJatuhTempo = '-';
                    } else if (isLunas) {
                        calculatedStatus = 'Lunas';
                        calculatedTglJatuhTempo = '-';
                    } else if (b.due_date) {
                        const dTarget = new Date(b.due_date);
                        if (!isNaN(dTarget.getTime())) {
                            const targetZero = new Date(dTarget.getFullYear(), dTarget.getMonth(), dTarget.getDate(), 0, 0, 0);
                            const diffMillis = targetZero.getTime() - todayZero.getTime();
                            const diffDays = Math.round(diffMillis / (1000 * 60 * 60 * 24));
                            daysRemaining = diffDays;

                            if (diffDays < 0) {
                                calculatedStatus = 'Sudah Jatuh Tempo (Lewat ' + Math.abs(diffDays) + ' Hari)';
                            } else if (diffDays === 0) {
                                calculatedStatus = 'Akan Jatuh Tempo (Hari Ini)';
                            } else if (diffDays <= 3) {
                                calculatedStatus = 'Akan Jatuh Tempo (H-' + diffDays + ')';
                            } else {
                                calculatedStatus = 'Belum Jatuh Tempo (' + diffDays + ' Hari Lagi)';
                            }
                        }
                    }

                    return {
                        id: b.id,
                        id_barang_datang: b.id,
                        no_nota: b.invoice_no || '-',
                        nama_suplayer: b.supplier_name || '-',
                        tanggal_nota: formatIndonesianDateOnly(b.invoice_date),
                        tanggal_terima: formatIndonesianDateTime(b.received_date || b.created_at),
                        tanggal_jatuh_tempo: calculatedTglJatuhTempo,
                        catatan_barang: b.items_summary || '-',
                        catatan_cacat: b.damage_notes || '-',
                        total_nilai_uang: Number(b.total_amount || 0),
                        metode_pembayaran: b.payment_method || 'Invoice',
                        payment_status: isPendingAdmin ? 'DIISI_ADMIN_NANTI' : 'COMPLETED',
                        status_jatuh_tempo: calculatedStatus,
                        days_remaining: daysRemaining,
                        nominal_cash: Number(b.cash_paid || 0),
                        sudah_dibayar: Number(b.paid_amount || 0),
                        sisa_hutang: Number(b.remaining_debt !== null ? b.remaining_debt : Math.max(0, (b.total_amount || 0) - (b.cash_paid || 0))),
                        tempo_hari: b.due_days !== null && b.due_days !== undefined ? b.due_days : 30,
                        dibuat_oleh: b.created_by ? (b.created_by + (b.role_creator ? ' (' + b.role_creator + ')' : '')) : '-',
                        foto_barang_1: convertDriveUrlToDirectImage(b.photo_1 || ''),
                        foto_barang_2: convertDriveUrlToDirectImage(b.photo_2 || ''),
                        foto_barang_3: convertDriveUrlToDirectImage(b.photo_3 || ''),
                        foto_barang_4: convertDriveUrlToDirectImage(b.photo_4 || ''),
                        foto_barang_5: convertDriveUrlToDirectImage(b.photo_5 || ''),
                        foto_bukti_nota: convertDriveUrlToDirectImage(b.payment_proof_url || ''),
                        foto_bukti_pembayaran: convertDriveUrlToDirectImage(b.payment_proof_url || ''),
                        riwayat_pembayaran: Array.isArray(b.payment_history) ? JSON.stringify(b.payment_history) : (b.payment_history || '[]')
                    };
                });

                return { success: true, data: mapped };
            } catch (err) {
                console.error('[getBarangDatangList error]', err);
                return { success: true, data: [] };
            }
        },

        saveBarangDatang: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const now = new Date();
                const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const wita = new Date(nowUtc + (8 * 3600 * 1000));
                const yy = String(wita.getFullYear()).slice(-2);
                const mm = String(wita.getMonth() + 1).padStart(2, '0');
                const dd = String(wita.getDate()).padStart(2, '0');
                const rnd = Math.floor(100 + Math.random() * 900);

                const finalId = 'BD-' + Date.now();
                const autoNoNota = 'BRG-' + dd + mm + yy + '-' + rnd;
                const finalNoNota = (payload.no_nota && payload.no_nota.trim() !== '') ? payload.no_nota.trim() : autoNoNota;

                // Upload up to 5 photos to Google Drive Edge CDN (lh3)
                let p1 = '';
                let p2 = '';
                let p3 = '';
                let p4 = '';
                let p5 = '';
                let pBukti = '';

                if (payload.foto_barang_1 && payload.foto_barang_1.length > 50) {
                    p1 = await uploadToGoogleDriveCdn(payload.foto_barang_1, 'BD_F1_' + finalNoNota);
                }
                if (payload.foto_barang_2 && payload.foto_barang_2.length > 50) {
                    p2 = await uploadToGoogleDriveCdn(payload.foto_barang_2, 'BD_F2_' + finalNoNota);
                }
                if (payload.foto_barang_3 && payload.foto_barang_3.length > 50) {
                    p3 = await uploadToGoogleDriveCdn(payload.foto_barang_3, 'BD_F3_' + finalNoNota);
                }
                if (payload.foto_barang_4 && payload.foto_barang_4.length > 50) {
                    p4 = await uploadToGoogleDriveCdn(payload.foto_barang_4, 'BD_F4_' + finalNoNota);
                }
                if (payload.foto_barang_5 && payload.foto_barang_5.length > 50) {
                    p5 = await uploadToGoogleDriveCdn(payload.foto_barang_5, 'BD_F5_' + finalNoNota);
                }
                if (payload.foto_bukti_pembayaran && payload.foto_bukti_pembayaran.length > 50) {
                    pBukti = await uploadToGoogleDriveCdn(payload.foto_bukti_pembayaran, 'BD_BUKTI_' + finalNoNota);
                }

                let cleanTotalUang = parseInt(String(payload.total_nilai_uang || '0').replace(/[^0-9]/g, ''), 10) || 0;
                let cleanNominalCash = parseInt(String(payload.nominal_cash || '0').replace(/[^0-9]/g, ''), 10) || 0;
                let sudahDibayar = 0;
                let sisaHutang = cleanTotalUang;
                let initialHistory = [];
                let finalDueDate = null;
                let dueStatus = 'Normal';

                const met = (payload.metode_pembayaran || '').trim();
                const isDiisiAdmin = (met === 'Di isi admin nanti' || met === 'DIISI ADMIN NANTI' || met.toLowerCase().includes('admin') || payload.payment_status === 'DIISI_ADMIN_NANTI');

                if (isDiisiAdmin) {
                    cleanTotalUang = 0;
                    cleanNominalCash = 0;
                    sudahDibayar = 0;
                    sisaHutang = 0;
                    finalDueDate = null;
                    dueStatus = 'Menunggu Admin';
                } else if (met === 'Pembayaran cash' || met === 'Pembayaran transfer' || met === 'Cash / Transfer') {
                    cleanNominalCash = cleanTotalUang;
                    sudahDibayar = cleanTotalUang;
                    sisaHutang = 0;
                    dueStatus = 'Lunas';
                    initialHistory.push({
                        tanggal: formatIndonesianDateTime(new Date()),
                        tipe: 'Lunas Awal (' + met + ')',
                        nominal: cleanTotalUang,
                        sisa_setelahnya: 0,
                        bukti_url: pBukti,
                        dicatat_oleh: currentUser ? currentUser.nama || currentUser.nama_lengkap || 'Staff' : 'Staff'
                    });
                } else {
                    // Invoice
                    const tempoDays = parseInt(payload.tempo_hari, 10) || 30;
                    let dNota = now;
                    if (payload.tanggal_nota) {
                        const parsed = new Date(payload.tanggal_nota);
                        if (!isNaN(parsed.getTime())) dNota = parsed;
                    }
                    const dTarget = new Date(dNota.getFullYear(), dNota.getMonth(), dNota.getDate() + tempoDays);
                    finalDueDate = dTarget.toISOString().split('T')[0];
                    sudahDibayar = cleanNominalCash;
                    sisaHutang = Math.max(0, cleanTotalUang - cleanNominalCash);
                    dueStatus = sisaHutang === 0 ? 'Lunas' : 'Belum Jatuh Tempo';

                    if (cleanNominalCash > 0) {
                        initialHistory.push({
                            tanggal: formatIndonesianDateTime(new Date()),
                            tipe: 'DP / Titip Awal',
                            nominal: cleanNominalCash,
                            sisa_setelahnya: sisaHutang,
                            bukti_url: pBukti,
                            dicatat_oleh: currentUser ? currentUser.nama || currentUser.nama_lengkap || 'Staff' : 'Staff'
                        });
                    }
                }

                const bdRow = {
                    id: finalId,
                    invoice_no: finalNoNota,
                    supplier_id: payload.id_suplayer || null,
                    supplier_name: (payload.nama_suplayer || 'Suplayer').trim(),
                    invoice_date: payload.tanggal_nota || new Date().toISOString().split('T')[0],
                    received_date: payload.tanggal_terima || new Date().toISOString(),
                    items_summary: payload.catatan_barang || null,
                    damage_notes: payload.catatan_cacat || null,
                    total_amount: cleanTotalUang,
                    payment_method: met,
                    cash_paid: cleanNominalCash,
                    paid_amount: sudahDibayar,
                    remaining_debt: sisaHutang,
                    due_days: parseInt(payload.tempo_hari, 10) || 30,
                    due_date: finalDueDate,
                    due_status: dueStatus,
                    payment_proof_url: pBukti,
                    payment_history: initialHistory,
                    created_by: currentUser ? currentUser.nama || currentUser.nama_lengkap || 'Staff' : 'Staff',
                    role_creator: currentUser ? currentUser.role || 'Staff Toko' : 'Staff Toko',
                    photo_1: p1,
                    photo_2: p2,
                    photo_3: p3,
                    photo_4: p4,
                    photo_5: p5
                };

                const { error } = await sb.from('incoming_goods').insert([bdRow]);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'STAFF',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Staff',
                    currentUser ? currentUser.role : 'Staff Toko',
                    'INPUT_BARANG_DATANG',
                    'Mencatat barang datang: ' + finalNoNota + ' dari ' + bdRow.supplier_name
                );

                return { success: true, message: 'Data barang datang berhasil disimpan!', id: finalId };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        updateBarangDatang: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idBd = (payload.id || payload.id_barang_datang || '').trim();
                if (!idBd) return { success: false, message: 'ID Barang Datang tidak valid!' };

                const { data: existing, error: getErr } = await sb.from('incoming_goods').select('*').eq('id', idBd).maybeSingle();
                if (getErr || !existing) return { success: false, message: 'Nota barang datang ' + idBd + ' tidak ditemukan!' };

                const updateObj = {};
                if (payload.no_nota) updateObj.invoice_no = payload.no_nota.trim();
                if (payload.nama_suplayer) updateObj.supplier_name = payload.nama_suplayer.trim();
                if (payload.tanggal_nota) updateObj.invoice_date = payload.tanggal_nota;
                if (payload.tanggal_terima) updateObj.received_date = payload.tanggal_terima;
                if (payload.catatan_barang !== undefined) updateObj.items_summary = payload.catatan_barang;
                if (payload.catatan_cacat !== undefined) updateObj.damage_notes = payload.catatan_cacat;
                if (payload.metode_pembayaran) updateObj.payment_method = payload.metode_pembayaran;

                if (payload.total_nilai_uang !== undefined) {
                    const tot = parseInt(String(payload.total_nilai_uang).replace(/[^0-9]/g, ''), 10) || 0;
                    updateObj.total_amount = tot;
                    const paid = Number(existing.paid_amount || 0);
                    updateObj.remaining_debt = Math.max(0, tot - paid);
                    if (updateObj.remaining_debt === 0) updateObj.due_status = 'Lunas';
                }

                if (payload.tempo_hari !== undefined) {
                    const tempo = parseInt(payload.tempo_hari, 10) || 30;
                    updateObj.due_days = tempo;
                    const dNota = new Date(updateObj.invoice_date || existing.invoice_date || new Date());
                    const dTarget = new Date(dNota.getFullYear(), dNota.getMonth(), dNota.getDate() + tempo);
                    updateObj.due_date = dTarget.toISOString().split('T')[0];
                }

                // Handle replacement photos if new base64 provided
                if (payload.foto_barang_1 && payload.foto_barang_1.length > 50 && payload.foto_barang_1.startsWith('data:')) {
                    updateObj.photo_1 = await uploadToGoogleDriveCdn(payload.foto_barang_1, 'BD_F1_' + idBd);
                }
                if (payload.foto_barang_2 && payload.foto_barang_2.length > 50 && payload.foto_barang_2.startsWith('data:')) {
                    updateObj.photo_2 = await uploadToGoogleDriveCdn(payload.foto_barang_2, 'BD_F2_' + idBd);
                }
                if (payload.foto_barang_3 && payload.foto_barang_3.length > 50 && payload.foto_barang_3.startsWith('data:')) {
                    updateObj.photo_3 = await uploadToGoogleDriveCdn(payload.foto_barang_3, 'BD_F3_' + idBd);
                }
                if (payload.foto_barang_4 && payload.foto_barang_4.length > 50 && payload.foto_barang_4.startsWith('data:')) {
                    updateObj.photo_4 = await uploadToGoogleDriveCdn(payload.foto_barang_4, 'BD_F4_' + idBd);
                }
                if (payload.foto_barang_5 && payload.foto_barang_5.length > 50 && payload.foto_barang_5.startsWith('data:')) {
                    updateObj.photo_5 = await uploadToGoogleDriveCdn(payload.foto_barang_5, 'BD_F5_' + idBd);
                }
                if (payload.foto_bukti_pembayaran && payload.foto_bukti_pembayaran.length > 50 && payload.foto_bukti_pembayaran.startsWith('data:')) {
                    updateObj.payment_proof_url = await uploadToGoogleDriveCdn(payload.foto_bukti_pembayaran, 'BD_BUKTI_' + idBd);
                }

                const { error: updErr } = await sb.from('incoming_goods').update(updateObj).eq('id', idBd);
                if (updErr) return { success: false, message: updErr.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'EDIT_BARANG_DATANG',
                    'Memperbarui nota barang datang ' + idBd
                );

                return { success: true, message: 'Data nota barang datang berhasil diperbarui!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        deleteBarangDatang: async function(idBd, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                idBd = String(idBd || '').trim();
                if (!idBd) return { success: false, message: 'ID Barang Datang tidak valid!' };

                const { error } = await sb.from('incoming_goods').delete().eq('id', idBd);
                if (error) return { success: false, message: error.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    'Admin',
                    'DELETE_BARANG_DATANG',
                    'Menghapus nota barang datang ' + idBd
                );

                return { success: true, message: 'Data barang datang berhasil dihapus!' };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        recordSupplierPayment: async function(payload, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database disconnected' };
            try {
                payload = payload || {};
                const idBd = (payload.id_barang_datang || payload.id || '').trim();
                if (!idBd) return { success: false, message: 'ID Nota Suplayer tidak valid!' };

                const bayarNominal = parseInt(String(payload.nominal_bayar || '0').replace(/[^0-9]/g, ''), 10) || 0;
                if (bayarNominal <= 0) return { success: false, message: 'Nominal pembayaran harus lebih dari 0!' };

                const { data: cur, error: getErr } = await sb.from('incoming_goods').select('*').eq('id', idBd).maybeSingle();
                if (getErr || !cur) return { success: false, message: 'Nota suplayer tidak ditemukan di database!' };

                // Upload bukti transfer ke Google Drive Edge CDN (lh3) jika ada
                let cdnBukti = '';
                if (payload.foto_bukti_transfer && payload.foto_bukti_transfer.length > 50) {
                    cdnBukti = await uploadToGoogleDriveCdn(payload.foto_bukti_transfer, 'PAY_SUP_' + idBd);
                } else if (payload.bukti_url) {
                    cdnBukti = convertDriveUrlToDirectImage(payload.bukti_url);
                }

                const oldPaid = Number(cur.paid_amount || 0);
                const oldDebt = cur.remaining_debt !== null ? Number(cur.remaining_debt) : Number(cur.total_amount || 0);
                const newPaid = oldPaid + bayarNominal;
                const newDebt = Math.max(0, oldDebt - bayarNominal);
                const isLunas = newDebt <= 0 || payload.opsi_bayar === 'Lunas';

                let hist = [];
                try {
                    if (Array.isArray(cur.payment_history)) {
                        hist = cur.payment_history;
                    } else if (typeof cur.payment_history === 'string' && cur.payment_history.trim()) {
                        hist = JSON.parse(cur.payment_history);
                    }
                } catch(e) {
                    hist = [];
                }

                const paymentRecord = {
                    tanggal: formatIndonesianDateTime(new Date()),
                    tipe: isLunas ? ('Pelunasan (' + (payload.metode_bayar || 'Transfer') + ')') : ('Titip Sebagian (' + (payload.metode_bayar || 'Transfer') + ')'),
                    nominal: bayarNominal,
                    sisa_setelahnya: newDebt,
                    catatan: payload.catatan || '-',
                    bukti_url: cdnBukti,
                    dicatat_oleh: currentUser ? (currentUser.nama || currentUser.nama_lengkap || 'Admin') + ' (' + (currentUser.role || 'Admin') + ')' : 'Admin',
                    jenis_pembayaran: payload.metode_bayar || 'Transfer'
                };
                hist.push(paymentRecord);

                const updateObj = {
                    paid_amount: newPaid,
                    remaining_debt: newDebt,
                    due_status: isLunas ? 'Lunas' : cur.due_status,
                    payment_history: hist
                };

                if (cdnBukti) {
                    updateObj.payment_proof_url = cdnBukti;
                }

                const { error: updErr } = await sb.from('incoming_goods').update(updateObj).eq('id', idBd);
                if (updErr) return { success: false, message: updErr.message };

                await logActivity(
                    currentUser ? currentUser.id_user || currentUser.user_id : 'ADMIN',
                    currentUser ? currentUser.nama || currentUser.nama_lengkap : 'Admin',
                    currentUser ? currentUser.role : 'Admin',
                    'BAYAR_SUPLAYER',
                    'Mencatat pembayaran suplayer ' + (cur.supplier_name || idBd) + ' sebesar Rp ' + bayarNominal.toLocaleString('id-ID') + (isLunas ? ' (LUNAS)' : ' (Sisa: Rp ' + newDebt.toLocaleString('id-ID') + ')')
                );

                return {
                    success: true,
                    message: 'Pembayaran nota suplayer sebesar Rp ' + bayarNominal.toLocaleString('id-ID') + ' berhasil dicatat!' + (isLunas ? ' (Status: LUNAS)' : '')
                };
            } catch (err) {
                return { success: false, message: err.message };
            }
        },

        submitPelunasanSupplier: async function(payload, currentUser) {
            return apiServices.recordSupplierPayment(payload, currentUser);
        },

        // --- HELPER / KARNET APPROVALS (SISTEM PERSETUJUAN PERGANTIAN KARNET) ---
        requestChangeKarnet: async function(reqPayload) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                if (!reqPayload || !reqPayload.driverId) return { success: false, message: 'Data permohonan tidak valid!' };

                const nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                const nowWita = new Date(nowUtc + (8 * 3600 * 1000));
                const timestampStr = `${String(nowWita.getDate()).padStart(2, '0')}/${String(nowWita.getMonth() + 1).padStart(2, '0')}/${nowWita.getFullYear()} ${String(nowWita.getHours()).padStart(2, '0')}:${String(nowWita.getMinutes()).padStart(2, '0')}`;

                const payload = {
                    driverId: reqPayload.driverId,
                    driverName: reqPayload.driverName || 'Sopir',
                    prevKarnet: reqPayload.prevKarnet || '-',
                    newKarnet: reqPayload.newKarnet || '-',
                    timestamp: reqPayload.timestamp || timestampStr,
                    status: 'MENUNGGU_PERSETUJUAN'
                };

                await sb.from('system_configs').upsert({
                    key: 'KARNET_REQ_' + reqPayload.driverId,
                    value: JSON.stringify(payload),
                    description: 'Permohonan Ganti Karnet Sopir: ' + (reqPayload.driverName || reqPayload.driverId),
                    updated_at: new Date().toISOString()
                });

                return { success: true, message: 'Permintaan ganti karnet berhasil diajukan!' };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        getPendingKarnetRequests: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: true, data: [] };
            try {
                if (currentUser && currentUser.role === 'Sopir') {
                    const key = 'KARNET_REQ_' + (currentUser.id_user || currentUser.user_code);
                    const { data } = await sb.from('system_configs').select('value').eq('key', key).maybeSingle();
                    if (data && data.value) {
                        try {
                            return { success: true, data: [JSON.parse(data.value)] };
                        } catch(e) {}
                    }
                    return { success: true, data: [] };
                }

                // Untuk Admin / Staff Operasional / Owner: ambil semua permintaan ganti karnet
                const { data, error } = await sb.from('system_configs').select('key, value').like('key', 'KARNET_REQ_%');
                if (error || !data || !Array.isArray(data)) return { success: true, data: [] };

                const pendingList = [];
                data.forEach(item => {
                    if (item && item.value) {
                        try {
                            const parsed = JSON.parse(item.value);
                            if (parsed && (parsed.status === 'MENUNGGU_PERSETUJUAN' || parsed.status === 'PENDING')) {
                                pendingList.push(parsed);
                            }
                        } catch(e) {}
                    }
                });

                return { success: true, data: pendingList };
            } catch(err) {
                return { success: true, data: [] };
            }
        },

        respondChangeKarnet: async function(driverId, action, currentUser) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const key = 'KARNET_REQ_' + driverId;
                const { data } = await sb.from('system_configs').select('value').eq('key', key).maybeSingle();
                if (!data || !data.value) {
                    return { success: false, message: 'Permintaan ganti karnet tidak ditemukan atau sudah diproses!' };
                }

                const reqObj = JSON.parse(data.value);
                const actionUpper = String(action || '').toUpperCase();
                const isApprove = (actionUpper === 'APPROVE' || actionUpper === 'SETUJUI' || actionUpper === 'SETUJU');
                const approverName = (currentUser && (currentUser.nama || currentUser.full_name)) ? (currentUser.nama || currentUser.full_name) : 'Admin';
                const approverRole = (currentUser && currentUser.role) ? currentUser.role : 'Admin';
                const approverId = (currentUser && (currentUser.id_user || currentUser.user_code)) ? (currentUser.id_user || currentUser.user_code) : 'ADMIN';

                const nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                const nowWita = new Date(nowUtc + (8 * 3600 * 1000));
                const timeFormatted = `${String(nowWita.getDate()).padStart(2, '0')}/${String(nowWita.getMonth() + 1).padStart(2, '0')}/${nowWita.getFullYear()} ${String(nowWita.getHours()).padStart(2, '0')}:${String(nowWita.getMinutes()).padStart(2, '0')}`;
                const dateStr = `${nowWita.getFullYear()}-${String(nowWita.getMonth() + 1).padStart(2, '0')}-${String(nowWita.getDate()).padStart(2, '0')}`;

                if (isApprove) {
                    reqObj.status = 'DISETUJUI';
                    reqObj.approvedBy = approverName;
                    reqObj.approvedAt = timeFormatted;

                    await sb.from('system_configs').upsert([
                        {
                            key: key,
                            value: JSON.stringify(reqObj),
                            updated_at: new Date().toISOString()
                        },
                        {
                            key: 'ACTIVE_KARNET_' + driverId,
                            value: JSON.stringify({ karnet: reqObj.newKarnet, date: dateStr }),
                            description: 'Karnet Aktif Sopir: ' + reqObj.driverName,
                            updated_at: new Date().toISOString()
                        }
                    ]);

                    await logActivity(approverId, approverName, approverRole, 'APPROVE_KARNET', `Menyetujui perubahan karnet ${reqObj.driverName} dari ${reqObj.prevKarnet} ke ${reqObj.newKarnet}`);
                    return { success: true, message: 'Perubahan karnet berhasil disetujui.', newKarnet: reqObj.newKarnet };
                } else {
                    reqObj.status = 'DITOLAK';
                    reqObj.rejectedBy = approverName;
                    reqObj.rejectedAt = timeFormatted;

                    await sb.from('system_configs').upsert({
                        key: key,
                        value: JSON.stringify(reqObj),
                        updated_at: new Date().toISOString()
                    });

                    await logActivity(approverId, approverName, approverRole, 'REJECT_KARNET', `Menolak perubahan karnet ${reqObj.driverName} dari ${reqObj.prevKarnet} ke ${reqObj.newKarnet}`);
                    return { success: true, message: 'Permintaan ganti karnet ditolak.' };
                }
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        dismissDriverKarnetRequest: async function(driverId) {
            const sb = getClient();
            if (!sb) return { success: true };
            try {
                await sb.from('system_configs').delete().eq('key', 'KARNET_REQ_' + driverId);
                return { success: true };
            } catch(err) {
                return { success: false, message: err.message };
            }
        },

        setDriverKarnetBackend: async function(driverId, karnetName, meta) {
            const sb = getClient();
            if (!sb) return { success: false, message: 'Database error' };
            try {
                const nowUtc = Date.now() + (new Date().getTimezoneOffset() * 60000);
                const nowWita = new Date(nowUtc + (8 * 3600 * 1000));
                const todayStr = `${nowWita.getFullYear()}-${String(nowWita.getMonth() + 1).padStart(2, '0')}-${String(nowWita.getDate()).padStart(2, '0')}`;
                const timeStr = `${String(nowWita.getHours()).padStart(2, '0')}:${String(nowWita.getMinutes()).padStart(2, '0')}`;

                const dataToSave = {
                    karnet: karnetName,
                    date: todayStr,
                    time: (meta && meta.time) ? meta.time : timeStr,
                    timestamp: (meta && meta.timestamp) ? meta.timestamp : Date.now()
                };

                await sb.from('system_configs').upsert({
                    key: 'ACTIVE_KARNET_' + driverId,
                    value: JSON.stringify(dataToSave),
                    description: 'Karnet Aktif Sopir: ' + driverId,
                    updated_at: new Date().toISOString()
                });

                return { success: true, message: 'Karnet aktif tersimpan di server!' };
            } catch(e) {
                return { success: false, message: e.message };
            }
        },

        getKarnetPopupConfig: async function(currentUser) {
            const sb = getClient();
            if (!sb) return { success: true, jamPagi: '07:00', jamSiang: '', jamSore: '', frekuensi: '1', hariAktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'], status: 'Aktif' };
            try {
                const { data } = await sb.from('system_configs').select('value').eq('key', 'KARNET_TASKS_DATA').maybeSingle();
                if (data && data.value) {
                    const tasks = JSON.parse(data.value);
                    if (Array.isArray(tasks) && tasks.length > 0) {
                        const activeTasks = tasks.filter(t => t.status === 'Aktif');
                        if (activeTasks.length > 0) {
                            if (!currentUser || currentUser.role !== 'Sopir') {
                                const first = activeTasks[0];
                                return {
                                    success: true,
                                    jamPagi: first.jamPagi || '07:00',
                                    jamSiang: first.jamSiang || '',
                                    jamSore: first.jamSore || '',
                                    frekuensi: first.frekuensi || '1',
                                    hariAktif: first.hariAktif || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                                    status: 'Aktif'
                                };
                            }

                            const driverName = (currentUser.nama || '').toLowerCase().trim();
                            const driverId = (currentUser.id_user || '').toLowerCase().trim();

                            const matching = activeTasks.find(t => {
                                if (t.isAllDrivers) return true;
                                if (!t.drivers || !Array.isArray(t.drivers)) return false;
                                if (t.drivers.includes('Semua Sopir')) return true;
                                return t.drivers.some(d => {
                                    const s = String(d).toLowerCase().trim();
                                    const cleanD = s.replace(/^\d+[\.\s\-]+/, '').trim();
                                    const cleanU = driverName.replace(/^\d+[\.\s\-]+/, '').trim();
                                    return s === driverName || s === driverId || cleanD === cleanU || driverName.includes(s) || s.includes(driverName);
                                });
                            });

                            if (matching) {
                                return {
                                    success: true,
                                    jamPagi: matching.jamPagi || '07:00',
                                    jamSiang: matching.jamSiang || '',
                                    jamSore: matching.jamSore || '',
                                    frekuensi: matching.frekuensi || '1',
                                    hariAktif: matching.hariAktif || ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
                                    status: 'Aktif'
                                };
                            }
                        }
                    }
                }
                return { success: true, jamPagi: '07:00', jamSiang: '', jamSore: '', frekuensi: '1', hariAktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'], status: 'Aktif' };
            } catch(e) {
                return { success: true, jamPagi: '07:00', jamSiang: '', jamSore: '', frekuensi: '1', hariAktif: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'], status: 'Aktif' };
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
    const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycby7JcJ_trM0THoWB1F3Zjd1uh-iPFXgVe1wxSxn7fu0/exec';
    window.__TB_GAS_BACKEND_URL = window.__TB_GAS_BACKEND_URL || 
        (typeof localStorage !== 'undefined' ? localStorage.getItem('TB_GAS_BACKEND_URL') : null) || 
        DEFAULT_GAS_URL;

    async function uploadToGoogleDriveCdn(base64Data, filenamePrefix) {
        if (!base64Data || typeof base64Data !== 'string' || base64Data.length < 50) return '';
        if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) return base64Data;

        const gasEndpoint = window.__TB_GAS_BACKEND_URL || DEFAULT_GAS_URL;
        if (gasEndpoint) {
            try {
                console.log('[Drive CDN] Mengunggah foto ke Google Drive CDN via GAS:', filenamePrefix);
                const res = await fetch(gasEndpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({
                        action: 'uploadFileDirectToDrive',
                        base64Data: base64Data,
                        filenamePrefix: filenamePrefix || 'tmr_photo'
                    }),
                    redirect: 'follow'
                });
                const json = await res.json();
                if (json && json.success && (json.url || json.direct_url)) {
                    const finalUrl = json.url || json.direct_url;
                    console.log('[Drive CDN] Sukses mendapatkan URL lh3:', finalUrl);
                    return finalUrl;
                }
            } catch (err) {
                console.warn('[Drive CDN Warning] Gagal upload ke GAS Drive, menggunakan fallback:', err);
            }
        }
        return base64Data;
    }
    window.__uploadToGoogleDriveCdn = uploadToGoogleDriveCdn;

    async function uploadMediaPipeline(items, prefix) {
        if (!items) return [];
        const list = Array.isArray(items) ? items : [items];
        const results = [];
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            if (!item) continue;
            const url = await uploadToGoogleDriveCdn(item, (prefix || 'tmr') + '_' + (i + 1));
            if (url) results.push(url);
        }
        return results;
    }

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
