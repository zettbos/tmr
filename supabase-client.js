/**
 * SUPABASE CLIENT SINGLETON FOR TB DELIVERY PRO
 * Dibuat oleh: ZettBOT by Zettbos
 */

// Konfigurasi Kredensial Supabase (Bisa diisi langsung atau via Environment Variable Vercel)
const SUPABASE_URL = (typeof window !== 'undefined' && window.__TB_SUPABASE_URL) 
    || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL)
    || 'https://eagplukqotycpslhvnbp.supabase.co';

const SUPABASE_ANON_KEY = (typeof window !== 'undefined' && window.__TB_SUPABASE_ANON_KEY)
    || (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3BsdWtxb3R5Y3BzbGh2bmJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NTk5OTEsImV4cCI6MjEwOTQzNTk5MX0.NJsG7dlU0v_ai0NG21FeD25FyGv2qMba6I3TocQD_24';

// Inisialisasi Instance Supabase Global
let _supabaseInstance = null;

export function getSupabase() {
    if (!_supabaseInstance) {
        if (typeof window !== 'undefined' && window.supabase && typeof window.supabase.createClient === 'function') {
            _supabaseInstance = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true
                }
            });
        } else {
            console.warn('[SupabaseClient] Library Supabase SDK belum dimuat di window.');
        }
    }
    return _supabaseInstance;
}

// Pasang ke window agar bisa diakses oleh adapter
if (typeof window !== 'undefined') {
    window.getSupabase = getSupabase;
}
