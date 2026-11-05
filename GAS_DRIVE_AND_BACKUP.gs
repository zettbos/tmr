/**
 * GOOGLE APPS SCRIPT ENGINE: DRIVE PHOTO CDN (lh3) & MIDNIGHT SPREADSHEET BACKUP
 * SISTEM: TMR (Tamara Delivery PRO / TB Delivery PRO)
 * Arsitek: ZettBOT by Zettbos
 * 
 * FUNGSI:
 * 1. doPost(): Menerima upload foto dari aplikasi TMR, menyimpannya di Google Drive,
 *    dan menghasilkan direct CDN URL berkecepatan tinggi: https://lh3.googleusercontent.com/d/{ID}=s1200
 * 2. backupSupabaseToGoogleSheets(): Menarik dump snapshot seluruh tabel dari Supabase PostgreSQL
 *    dan menyimpannya ke Google Spreadsheet fisik setiap jam 12:00 malam (00:00).
 * 3. installMidnightBackupTrigger(): Memasang trigger cron jam 00:00 otomatis.
 */

// Kredensial Supabase untuk Script Properties / Hardcoded
const SUPABASE_CONFIG = {
  URL: 'https://eagplukqotycpslhvnbp.supabase.co',
  SERVICE_ROLE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZ3BsdWtxb3R5Y3BzbGh2bmJwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5Mzg1OTk5MSwiZXhwIjoyMTA5NDM1OTkxfQ.XMLMoGtJTk03RQ076h0vS8-dOnPpwOHCi3nY2ctjyN4'
};

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

    // AKSI 2: Manual Trigger Backup dari Luar
    if (action === 'triggerBackup') {
      const backupRes = backupSupabaseToGoogleSheets();
      return ContentService.createTextOutput(JSON.stringify(backupRes)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Action tidak dikenal: ' + action })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.toString() })).setMimeType(ContentService.MimeType.JSON);
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
 * SINKRONISASI COLD BACKUP SPREADSHEET (JAM 12 MALAM)
 * Menarik seluruh data terbaru dari Supabase dan menuliskannya ke Sheet Backup
 */
function backupSupabaseToGoogleSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const startTime = new Date();
  const tablesToBackup = [
    'profiles', 'customers', 'orders', 'orders_archive', 'vehicles',
    'fuel_approvals', 'fuel_logs', 'oil_change_logs', 'vehicle_services',
    'vehicle_taxes', 'tax_payment_logs', 'tax_reminder_settings',
    'suppliers', 'incoming_goods', 'activity_logs', 'sop_masters', 'sop_steps'
  ];

  let summary = [];

  tablesToBackup.forEach(tableName => {
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
        if (rows && rows.length > 0) {
          // Nama sheet tanpa underscore (Sesuai SOP ZettBOT)
          const sheetName = 'Backup' + tableName.charAt(0).toUpperCase() + tableName.slice(1);
          let sheet = ss.getSheetByName(sheetName);
          if (!sheet) {
            sheet = ss.insertSheet(sheetName);
          } else {
            sheet.clearContents();
          }

          // Headers
          const headers = Object.keys(rows[0]);
          const matrix = [headers];

          // Data rows
          rows.forEach(r => {
            const rowVals = headers.map(h => {
              const val = r[h];
              if (val === null || val === undefined) return '';
              if (typeof val === 'object') return JSON.stringify(val);
              return String(val);
            });
            matrix.push(rowVals);
          });

          sheet.getRange(1, 1, matrix.length, headers.length).setValues(matrix);
          sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e2e8f0');
          SpreadsheetApp.flush();
          summary.push(tableName + ': ' + rows.length + ' baris');
        }
      }
    } catch (e) {
      console.warn('Backup error on ' + tableName + ':', e);
      summary.push(tableName + ': GAGAL (' + e.message + ')');
    }
  });

  // Catat ke tab SystemBackupLogs
  let logSheet = ss.getSheetByName('SystemBackupLogs');
  if (!logSheet) {
    logSheet = ss.insertSheet('SystemBackupLogs');
    logSheet.appendRow(['Timestamp', 'Status', 'Durasi (Detik)', 'Rangkuman']);
    logSheet.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#f1f5f9');
  }
  const durationSec = Math.round((new Date() - startTime) / 1000);
  logSheet.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Makassar', 'yyyy-MM-dd HH:mm:ss'),
    'SUCCESS',
    durationSec,
    summary.join(', ')
  ]);
  SpreadsheetApp.flush();

  return { success: true, timestamp: new Date().toISOString(), durationSec: durationSec, summary: summary };
}

/**
 * PASANG TRIGGER OTOMATIS JAM 12 MALAM (00:00 - 01:00 WITA)
 * Jalankan fungsi ini 1x di script editor Apps Script.
 */
function installMidnightBackupTrigger() {
  // Hapus trigger lama jika ada
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(t => {
    if (t.getHandlerFunction() === 'backupSupabaseToGoogleSheets') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Buat trigger harian jam 00:00 (tengah malam)
  ScriptApp.newTrigger('backupSupabaseToGoogleSheets')
    .timeBased()
    .everyDays(1)
    .atHour(0)
    .create();

  console.log('✅ Trigger Midnight Backup Berhasil Dipasang: Eksekusi otomatis setiap jam 00:00.');
}
