/**
 * GOOGLE APPS SCRIPT ENGINE: DRIVE PHOTO CDN (lh3) & SPREADSHEET COLD BACKUP
 * SISTEM: TMR (Tamara Delivery PRO / TB Delivery PRO)
 * Arsitek: ZettBOT by Zettbos
 * 
 * FUNGSI UTAMA:
 * 1. doPost(e):
 *    - Upload foto dokumentasi/surat jalan ke Drive -> Return lh3 CDN URL:
 *      https://lh3.googleusercontent.com/d/{ID}=s1200
 *    - Menerima webhook trigger 'backupSekarang' / 'triggerBackup'
 * 2. doGet(e):
 *    - Health check status
 *    - Eksekusi instan backup via browser URL (?action=backup)
 * 3. backupSekarang() / backupNow():
 *    - Fungsi mandiri untuk "Backup Sekarang" (klik Run di script editor)
 * 4. backupSupabaseToGoogleSheets():
 *    - Menarik dump snapshot seluruh tabel dari Supabase PostgreSQL
 *      dan menuliskan Header + Data ke Google Spreadsheet fisik.
 * 5. installMidnightBackupTrigger():
 *    - Memasang trigger otomatis harian jam 00:00 WITA.
 */

// Kredensial Supabase untuk Script Properties / Hardcoded
const SUPABASE_CONFIG = {
  URL: 'https://eagplukqotycpslhvnbp.supabase.co',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3BsdWtxb3R5Y3BzbGh2bmJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mzg1OTk5MSwiZXhwIjoyMTA5NDM1OTkxfQ.XMLMoGtJTk03RQ076h0vS8-dOnPpwOHCi3nY2ctjyN4'
};

// Daftar seluruh tabel di Supabase yang dicadangkan ke Google Sheets
const TABLES_TO_BACKUP = [
  'profiles',
  'customers',
  'orders',
  'orders_archive',
  'vehicles',
  'fuel_approvals',
  'fuel_logs',
  'oil_change_logs',
  'vehicle_services',
  'vehicle_taxes',
  'tax_payment_logs',
  'tax_reminder_settings',
  'suppliers',
  'incoming_goods',
  'activity_logs',
  'sop_masters',
  'sop_steps',
  'sop_targets',
  'sop_execution_logs',
  'emergency_messages',
  'system_configs'
];

/**
 * =========================================================================
 * FUNGSI OTORISASI IZIN GOOGLE APPS SCRIPT (JALANKAN INI 1x JIKA MUNCUL IZIN)
 * =========================================================================
 * Jika muncul peringatan izin (You do not have permission to call UrlFetchApp):
 * Pilih fungsi ini di dropdown fungsi, klik "Run", lalu klik "Review permissions" -> "Allow".
 */
function authorizeScript() {
  const testUrl = SUPABASE_CONFIG.URL + '/rest/v1/profiles?select=count&limit=1';
  UrlFetchApp.fetch(testUrl, {
    headers: { 'apikey': SUPABASE_CONFIG.SERVICE_ROLE_KEY }
  });
  DriveApp.getRootFolder();
  SpreadsheetApp.getActiveSpreadsheet();
  console.log('✅ Otorisasi Sukses! Izin UrlFetchApp (Supabase), Drive, dan Spreadsheet sudah aktif.');
  return 'Otorisasi Sukses';
}

/**
 * =========================================================================
 * FUNGSI TOMBOL / EKSEKUSI LANGSUNG: BACKUP SEKARANG
 * =========================================================================
 * Pilih fungsi ini di daftar fungsi Google Apps Script, lalu klik "Run".
 */
function backupSekarang() {
  console.log('🚀 [START] Memulai Eksekusi Backup Sekarang (Supabase -> Google Sheets)...');
  const result = backupSupabaseToGoogleSheets();
  console.log('✅ [FINISH] Rangkuman Hasil Backup:');
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function backupNow() {
  return backupSekarang();
}

/**
 * Mendapatkan Google Spreadsheet target secara aman:
 * 1. Coba ambil spreadsheet aktif (jika script bound)
 * 2. Coba buka dari Script Properties (BACKUP_SPREADSHEET_ID)
 * 3. Coba cari file 'TB_TAMARA_BACKUP_DATABASE' di Google Drive
 * 4. Buat spreadsheet baru otomatis jika belum ada
 */
function getTargetSpreadsheet() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}

  const props = PropertiesService.getScriptProperties();
  const savedId = props.getProperty('BACKUP_SPREADSHEET_ID');
  if (savedId) {
    try {
      return SpreadsheetApp.openById(savedId);
    } catch (e) {
      console.warn('Gagal membuka spreadsheet dari savedId:', e);
    }
  }

  try {
    const files = DriveApp.getFilesByName('TB_TAMARA_BACKUP_DATABASE');
    if (files.hasNext()) {
      const file = files.next();
      props.setProperty('BACKUP_SPREADSHEET_ID', file.getId());
      return SpreadsheetApp.openById(file.getId());
    }
  } catch (e) {}

  const newSs = SpreadsheetApp.create('TB_TAMARA_BACKUP_DATABASE');
  props.setProperty('BACKUP_SPREADSHEET_ID', newSs.getId());
  return newSs;
}

/**
 * Endpoint GET untuk Health Check dan Pemicu Backup Cepat via Browser
 */
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : '';

  // Trigger Backup langsung dari Browser URL: ?action=backup
  if (action === 'backup' || action === 'backupSekarang' || action === 'triggerBackup') {
    const result = backupSupabaseToGoogleSheets();
    return ContentService.createTextOutput(JSON.stringify(result, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    system: 'TB Delivery PRO (TMR) - Storage & Backup Microservice',
    appUrl: 'https://tmr-app.vercel.app',
    instantBackupUrl: ScriptApp.getService().getUrl() + '?action=backup',
    timestamp: new Date().toISOString()
  }, null, 2)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Endpoint POST untuk upload file dan panggilan API pendukung
 */
function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const action = payload.action || '';

    // AKSI 1: Upload File ke Drive -> Return lh3 CDN
    if (action === 'uploadFileDirectToDrive' || action === 'uploadMedia') {
      const base64Data = payload.base64Data || payload.data || '';
      const filenamePrefix = payload.filenamePrefix || 'tmr_photo';
      const result = saveFileToDriveAndGetLh3Url(base64Data, filenamePrefix);
      return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
    }

    // AKSI 2: Trigger Backup Sekarang dari Web Client / API
    if (action === 'triggerBackup' || action === 'backupSekarang' || action === 'backupDatabaseToDrive') {
      const backupRes = backupSupabaseToGoogleSheets();
      return ContentService.createTextOutput(JSON.stringify(backupRes)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'Action tidak dikenal: ' + action
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Menyimpan Base64 ke Google Drive dan mengembalikan format link Google Edge CDN:
 * https://lh3.googleusercontent.com/d/{FILE_ID}=s1200
 */
function saveFileToDriveAndGetLh3Url(base64Data, filenamePrefix) {
  try {
    if (!base64Data || typeof base64Data !== 'string' || base64Data.length < 50) {
      return { success: false, message: 'Data base64 tidak valid' };
    }

    let contentType = 'image/jpeg';
    let cleanBase64 = base64Data;
    if (base64Data.indexOf(';base64,') !== -1) {
      const parts = base64Data.split(';base64,');
      contentType = parts[0].replace('data:', '');
      cleanBase64 = parts[1];
    }

    // Dapatkan folder penyimpanan TB_DELIVERY_ATTACHMENTS
    let folder = null;
    const folderName = 'TB_DELIVERY_ATTACHMENTS';
    const folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
      try {
        folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (eShare) {}
    }

    const bytes = Utilities.base64Decode(cleanBase64);
    const ext = contentType.indexOf('png') !== -1 ? '.png' : '.jpg';
    const filename = (filenamePrefix || 'tmr') + '_' + Date.now() + ext;
    const blob = Utilities.newBlob(bytes, contentType, filename);

    const file = folder.createFile(blob);
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch (eFileShare) {}

    const fileId = file.getId();
    // FORMAT RESMI GOOGLE EDGE CDN (lh3)
    const lh3Url = 'https://lh3.googleusercontent.com/d/' + fileId + '=s1200';

    return {
      success: true,
      file_id: fileId,
      url: lh3Url,
      direct_url: lh3Url,
      filename: filename
    };
  } catch (err) {
    console.error('saveFileToDriveAndGetLh3Url error:', err);
    return { success: false, error: err.toString() };
  }
}

/**
 * ENGINE UTAMA SINKRONISASI COLD BACKUP SPREADSHEET
 * Menarik seluruh data terbaru dari 21 tabel Supabase dan menuliskannya ke Sheet Backup
 */
function backupSupabaseToGoogleSheets() {
  const ss = getTargetSpreadsheet();
  const startTime = new Date();
  let summary = [];
  let totalRows = 0;

  TABLES_TO_BACKUP.forEach(function(tableName) {
    try {
      const url = SUPABASE_CONFIG.URL + '/rest/v1/' + tableName + '?select=*&limit=10000';
      const options = {
        method: 'get',
        headers: {
          'apikey': SUPABASE_CONFIG.SERVICE_ROLE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_CONFIG.SERVICE_ROLE_KEY
        },
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      if (response.getResponseCode() === 200) {
        const rows = JSON.parse(response.getContentText());
        const sheetName = 'Backup_' + tableName;
        let sheet = ss.getSheetByName(sheetName);

        if (!sheet) {
          sheet = ss.insertSheet(sheetName);
        } else {
          sheet.clearContents();
        }

        if (rows && rows.length > 0) {
          // 1. Ekstrak Header Kolom
          const headers = Object.keys(rows[0]);
          const matrix = [headers];

          // 2. Baris Data
          rows.forEach(function(r) {
            const rowVals = headers.map(function(h) {
              const val = r[h];
              if (val === null || val === undefined) return '';
              if (typeof val === 'object') return JSON.stringify(val);
              return String(val);
            });
            matrix.push(rowVals);
          });

          // Tulis seluruh matrix data sekaligus (batch write)
          sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);

          // Format Header: Tebal, Background Slate, Freeze Row 1
          sheet.getRange(1, 1, 1, headers.length)
            .setFontWeight('bold')
            .setBackground('#e2e8f0')
            .setFontColor('#0f172a');
          try {
            sheet.setFrozenRows(1);
          } catch (eFreeze) {}

          totalRows += rows.length;
          summary.push(tableName + ': ' + rows.length + ' baris');
        } else {
          // Jika tabel kosong, tetap buat tab dan beri keterangan
          sheet.getRange(1, 1).setValue('(Tabel ' + tableName + ' kosong di database)').setFontStyle('italic');
          summary.push(tableName + ': 0 baris (kosong)');
        }
      } else {
        summary.push(tableName + ': GAGAL HTTP ' + response.getResponseCode());
      }
    } catch (e) {
      console.warn('Backup error pada ' + tableName + ':', e);
      summary.push(tableName + ': ERROR (' + e.message + ')');
    }
  });

  // Catat riwayat eksekusi ke tab SystemBackupLogs
  try {
    let logSheet = ss.getSheetByName('SystemBackupLogs');
    if (!logSheet) {
      logSheet = ss.insertSheet('SystemBackupLogs');
      logSheet.appendRow(['Timestamp (WITA)', 'Status', 'Total Baris', 'Durasi (Detik)', 'Rangkuman']);
      logSheet.getRange(1, 1, 1, 5).setFontWeight('bold').setBackground('#f1f5f9').setFontColor('#1e293b');
      try { logSheet.setFrozenRows(1); } catch (e) {}
    }
    const durationSec = Math.round((new Date() - startTime) / 1000);
    logSheet.appendRow([
      Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS',
      totalRows,
      durationSec,
      summary.join(' | ')
    ]);
  } catch (eLog) {
    console.warn('Gagal mencatat log backup:', eLog);
  }

  SpreadsheetApp.flush();
  const durationSec = Math.round((new Date() - startTime) / 1000);

  return {
    success: true,
    action: 'backupSekarang',
    spreadsheetUrl: ss.getUrl(),
    spreadsheetName: ss.getName(),
    totalRows: totalRows,
    durationSec: durationSec,
    timestampWita: Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
    summary: summary
  };
}

/**
 * PASANG TRIGGER OTOMATIS JAM 12 MALAM (00:00 - 01:00 WITA)
 * Jalankan fungsi ini 1x di script editor Apps Script.
 */
function installMidnightBackupTrigger() {
  // Hapus trigger lama jika ada
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'backupSupabaseToGoogleSheets' || t.getHandlerFunction() === 'backupSekarang') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Buat trigger harian jam 00:00 (tengah malam)
  ScriptApp.newTrigger('backupSupabaseToGoogleSheets')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  console.log('✅ Trigger Midnight Backup Berhasil Dipasang: Eksekusi otomatis setiap jam 00:00 WITA.');
}
