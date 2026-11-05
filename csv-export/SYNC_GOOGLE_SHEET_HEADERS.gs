/**
 * SCRIPT PENYELARAS HEADER GOOGLE SPREADSHEET KE STANDAR SUPABASE (POSTGRESQL)
 * TB DELIVERY PRO (TB TAMARA)
 * Dibuat oleh: ZettBOT by Zettbos
 * 
 * FUNGSI:
 * - Menyelaraskan seluruh baris 1 (Header) di 22 sheet Google Spreadsheet
 *   agar 100% SAMA PERSIS dengan nama kolom Supabase (snake_case tanpa spasi).
 * - AMAN 100%: HANYA MENGUBAH TEKS BARIS 1 (HEADER), TIDAK MENGGESER ATAU MENGHAPUS DATA RIIL.
 */

function SYNC_ALL_SHEET_HEADERS_TO_SUPABASE() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    Logger.log("Spreadsheet aktif tidak ditemukan.");
    return;
  }

  const HEADER_DEFINITIONS = {
    'Users': [
      'user_code', 'full_name', 'username', 'password', 'role', 'phone', 
      'is_active', 'created_at', 'shift_start', 'shift_end', 'address', 'ktp_photo_url'
    ],
    'Customers': [
      'id', 'name', 'phone', 'address', 'maps_url', 'total_orders', 'created_at', 'standard_shipping_fee'
    ],
    'Orders': [
      'id', 'order_date', 'delivery_date', 'is_urgent', 'customer_id', 'customer_name', 
      'customer_phone', 'customer_address', 'maps_url', 'nota_photo_url', 'notes', 
      'items_detail', 'driver_id', 'driver_name', 'verification_status', 'delivery_status', 
      'payment_status', 'proof_url_1', 'proof_url_2', 'proof_url_3', 'proof_url_4', 
      'proof_url_5', 'completed_at', 'delivery_notes', 'checker_name', 'created_by', 
      'transfer_proof_url', 'shipping_cost', 'total_amount', 'payment_collector', 
      'additional_nota_url', 'cash_proof_url'
    ],
    'Arsip Pesanan': [
      'id', 'order_date', 'delivery_date', 'is_urgent', 'customer_id', 'customer_name', 
      'customer_phone', 'customer_address', 'maps_url', 'nota_photo_url', 'notes', 
      'items_detail', 'driver_id', 'driver_name', 'verification_status', 'delivery_status', 
      'payment_status', 'proof_url_1', 'proof_url_2', 'proof_url_3', 'proof_url_4', 
      'proof_url_5', 'completed_at', 'delivery_notes', 'checker_name', 'created_by', 
      'transfer_proof_url', 'shipping_cost', 'total_amount', 'payment_collector', 
      'additional_nota_url', 'cash_proof_url'
    ],
    'Data Kendaraan': [
      'id', 'plate_number', 'vehicle_type', 'default_driver', 'current_km', 
      'last_fuel_date', 'total_fuel_liters', 'last_oil_km', 'oil_interval_km', 
      'oil_status', 'remaining_oil_km', 'photo_url', 'status', 'created_at'
    ],
    'Data Izin BBM': [
      'id', 'request_time', 'driver_id', 'driver_name', 'plate_number', 
      'status', 'responded_by', 'responded_at', 'notes', 'is_used'
    ],
    'Data Pengisian BBM': [
      'id', 'fuel_date', 'plate_number', 'driver_id', 'driver_name', 'current_km', 
      'prev_km', 'trip_distance', 'liters', 'total_cost', 'efficiency_ratio', 
      'gas_station', 'fuel_type', 'km_photo_url', 'receipt_photo_url', 'cargo_photo_url', 
      'notes', 'created_at'
    ],
    'Data Riwayat Oli': [
      'id', 'service_date', 'plate_number', 'driver_id', 'driver_name', 'service_km', 
      'transaction_type', 'oil_brand', 'liters', 'total_cost', 'workshop_name', 
      'km_photo_url', 'receipt_photo_url', 'notes', 'created_at'
    ],
    'Data Servis Kendaraan': [
      'id', 'service_date', 'plate_number', 'driver_id', 'driver_name', 'current_km', 
      'workshop_name', 'cost', 'repair_details', 'receipt_photo_url', 'created_at'
    ],
    'Data Pajak Kendaraan': [
      'id', 'vehicle_type', 'owner_name', 'plate_number', 'brand', 'model', 'year', 
      'tax_1yr_date', 'tax_5yr_date', 'kir_date', 'notes', 'stnk_photo_url', 
      'qr_pertamina_url', 'created_at', 'is_active'
    ],
    'Data Riwayat Pajak': [
      'id', 'tax_id', 'plate_number', 'owner_name', 'payment_type', 'payment_date', 
      'amount', 'new_stnk_photo_url', 'notes', 'admin_name', 'created_at'
    ],
    'Setting Pengingat Pajak': [
      'key', 'value', 'description'
    ],
    'Data Suplayer': [
      'id', 'name', 'phone', 'address', 'notes', 'created_at', 'created_by', 
      'category', 'default_due_days'
    ],
    'Data Barang Datang': [
      'id', 'invoice_no', 'supplier_name', 'invoice_date', 'received_date', 
      'photo_1', 'photo_2', 'photo_3', 'photo_4', 'photo_5', 'items_summary', 
      'damage_notes', 'total_amount', 'payment_method', 'cash_paid', 
      'payment_proof_url', 'due_days', 'due_date', 'due_status', 'created_at', 
      'created_by', 'role_creator', 'paid_amount', 'remaining_debt', 'payment_history'
    ],
    'ActivityLogs': [
      'id', 'timestamp', 'user_code', 'user_name', 'role', 'action', 'details'
    ],
    'Config': [
      'key', 'value', 'description'
    ],
    'Emergency Messages': [
      'id', 'type', 'target_roles', 'target_users', 'title', 'message', 
      'frequency', 'schedule_times', 'broadcast_date', 'broadcast_time', 
      'is_active', 'created_at', 'created_by'
    ],
    'Auth_Tokens': [
      'token', 'user_code', 'username', 'name', 'role', 'created_at', 
      'expires_at', 'status', 'device_info'
    ],
    'SOP_Master': [
      'id', 'title', 'category', 'priority', 'status', 'completion_criteria', 'created_at', 'created_by'
    ],
    'SOP_Langkah': [
      'id', 'sop_id', 'step_number', 'step_title', 'user_instructions', 'checklist', 'media_examples', 'rules'
    ],
    'SOP_Jadwal_Target': [
      'id', 'sop_id', 'start_date', 'schedule_times', 'is_recurring_daily', 'target_roles', 'target_users', 'is_notif_active'
    ],
    'SOP_Log_Pelaksanaan': [
      'id', 'sop_id', 'username', 'full_name', 'role', 'task_date', 'time_session', 
      'started_at', 'completed_at', 'status', 'checklist_results', 'proof_photo_urls'
    ]
  };

  let updatedCount = 0;
  for (const sheetName in HEADER_DEFINITIONS) {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) continue;

    const headers = HEADER_DEFINITIONS[sheetName];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e2e8f0');
    updatedCount++;
    Logger.log("Berhasil menyelaraskan header sheet: " + sheetName);
  }

  SpreadsheetApp.flush();
  Logger.log("SELESAI! Total sheet diselaraskan: " + updatedCount);
}

