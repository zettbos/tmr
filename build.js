import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('[Build] Mengompilasi aplikasi TB Delivery PRO ke tb-delivery-pro/index.html...');

// Baca index.html utama dari root
const sourceIndexPath = path.join(rootDir, 'index.html');
let indexHtml = fs.readFileSync(sourceIndexPath, 'utf-8');

// Regex untuk mencocokkan <?!= include('namaFile'); ?>
const includeRegex = /<\?!\=\s*include\(['"]([^'"]+)['"]\);?\s*\?>/g;

let matchCount = 0;
indexHtml = indexHtml.replace(includeRegex, (match, filename) => {
    matchCount++;
    const modulePath = path.join(rootDir, `${filename}.html`);
    if (fs.existsSync(modulePath)) {
        console.log(`[Include] Menggabungkan modul: ${filename}.html`);
        return fs.readFileSync(modulePath, 'utf-8');
    } else {
        console.warn(`[Include WARN] File modul tidak ditemukan: ${modulePath}`);
        return `<!-- Modul ${filename} tidak ditemukan -->`;
    }
});

console.log(`[Build] Berhasil menyatukan ${matchCount} modul HTML ke dalam 1 Single-Page Web App.`);

// Ganti variabel template scriptlet GAS
indexHtml = indexHtml.replace(/<\?\=\s*typeof trackId[^\?]*\?>/g, "''");
indexHtml = indexHtml.replace(/<\?\=\s*typeof webAppUrl[^\?]*\?>/g, "window.location.origin");

// Update App Title & PWA Manifest
indexHtml = indexHtml.replace(/<meta name="apple-mobile-web-app-title"[^>]*>/i, '<meta name="apple-mobile-web-app-title" content="TMR">\n    <meta name="application-name" content="TMR">\n    <meta name="theme-color" content="#060d17">\n    <link rel="manifest" href="./manifest.json">\n    <link rel="icon" type="image/svg+xml" href="./icon.svg">\n    <link rel="apple-touch-icon" href="./icon.svg">');
indexHtml = indexHtml.replace(/<title id="appDocumentTitle"[^>]*>[^<]*<\/title>/i, '<title id="appDocumentTitle">TMR - Tamara Delivery PRO</title>');

// Suntikkan Supabase SDK CDN & Gas-to-Supabase Adapter di dalam tag <head>
const injectedScripts = `
    <!-- SUPABASE CLIENT & UNIVERSAL ADAPTER (MENGGANTIKAN GOOGLE APPS SCRIPT) -->
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    <script src="./supabase-gas-adapter.js"></script>
`;

if (indexHtml.includes('</head>')) {
    indexHtml = indexHtml.replace('</head>', `${injectedScripts}\n</head>`);
} else {
    indexHtml = injectedScripts + indexHtml;
}

// Tulis ke tb-delivery-pro/index.html
const destIndexPath = path.join(__dirname, 'index.html');
fs.writeFileSync(destIndexPath, indexHtml, 'utf-8');

console.log(`[Build SELESAI] File siap dijalankan: ${destIndexPath} (${(fs.statSync(destIndexPath).size / 1024).toFixed(1)} KB)`);
