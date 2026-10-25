/**
 * =========================================================================
 * SIREKAP v16 - SIMPLIFIED BACKEND ENGINE (3 SHEETS ARCHITECTURE)
 * SDIT QURRATU A'YUN AL-ISLAMI KABUPATEN MAROS
 * =========================================================================
 * Hanya menggunakan 3 Sheet:
 * 1. "KBM"    : Seluruh riwayat presensi harian KBM
 * 2. "Ujian"  : Seluruh riwayat presensi kegiatan ujian semester
 * 3. "Master" : Master Data Guru, PIN Keamanan, Mapel, Kelas, & Password Admin
 * =========================================================================
 */

const SHEET_KBM = "KBM";
const SHEET_UJIAN = "Ujian";
const SHEET_MASTER = "Master";
const DEFAULT_ADMIN_PASS = "admin123";

/**
 * Endpoint GET (Membaca data)
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const adminPass = e.parameter.admin_pass;
    const guru = e.parameter.guru;
    const pin = e.parameter.pin;
    const type = e.parameter.type;

    // 1. Ambil Master Data (Guru, Mapel, Kelas)
    if (action === "get_master") {
      return responseJSON(getMasterData());
    }

    // 2. Baca Data KBM (Harian)
    if (action === "read") {
      // Jika diakses oleh Guru (Riwayat Pribadi & Akumulasi JP)
      if (type === "harian" && guru && pin) {
        if (!validasiGuru(guru, pin)) {
          return responseJSON({ result: "error", message: "Akses Ditolak. PIN Keamanan salah." });
        }
        return responseJSON(getRiwayatGuru(SHEET_KBM, guru));
      }

      // Jika diakses oleh Admin / Kepala Sekolah (Dashboard KBM)
      if (validasiAdmin(adminPass)) {
        return responseJSON(getAllDataKBM());
      }
      return responseJSON({ result: "error", message: "Akses Ditolak. Password Admin salah." });
    }

    // 3. Baca Data Ujian
    if (action === "read_ujian") {
      // Jika diakses oleh Guru
      if (type === "ujian" && guru && pin) {
        if (!validasiGuru(guru, pin)) {
          return responseJSON({ result: "error", message: "Akses Ditolak. PIN Keamanan salah." });
        }
        return responseJSON(getRiwayatGuru(SHEET_UJIAN, guru));
      }

      // Jika diakses oleh Admin
      if (validasiAdmin(adminPass)) {
        return responseJSON(getAllDataUjian());
      }
      return responseJSON({ result: "error", message: "Akses Ditolak. Password Admin salah." });
    }

    // 4. Test Koneksi
    if (action === "ping") {
      return responseJSON({ result: "success", message: "SiRekap Backend v16 Online 🟢", timestamp: new Date().toISOString() });
    }

    return responseJSON({ result: "error", message: "Aksi GET tidak dikenali: " + action });
  } catch (err) {
    return responseJSON({ result: "error", message: err.toString() });
  }
}

/**
 * Endpoint POST (Menyimpan, mengubah, menghapus data)
 */
function doPost(e) {
  try {
    const p = e.parameter;
    const action = p.action;

    // 1. Verifikasi Login Guru
    if (action === "login_guru") {
      const ok = validasiGuru(p.guru, p.pin);
      if (ok) {
        return responseJSON({ result: "success", message: "Login Berhasil" });
      } else {
        return responseJSON({ result: "error", message: "Nama Guru atau PIN Keamanan Salah!" });
      }
    }

    // 2. Simpan Master Data (dari Admin)
    if (action === "save_master") {
      if (!validasiAdmin(p.admin_pass)) {
        return responseJSON({ result: "error", message: "Akses Ditolak. Password Admin salah." });
      }
      saveMasterData(p.teachers, p.subjects, p.classes);
      return responseJSON({ result: "success", message: "Master Data berhasil diperbarui." });
    }

    // 3. Tambah Presensi KBM (Harian)
    if (action === "insert") {
      return responseJSON(insertKBM(p));
    }

    // 4. Tambah Presensi Ujian
    if (action === "insert_ujian") {
      return responseJSON(insertUjian(p));
    }

    // 5. Update Presensi (KBM atau Ujian)
    if (action === "update") {
      return responseJSON(updateData(p));
    }

    // 6. Hapus Presensi (KBM atau Ujian)
    if (action === "delete") {
      return responseJSON(deleteData(p));
    }

    return responseJSON({ result: "error", message: "Aksi POST tidak dikenali: " + action });
  } catch (err) {
    return responseJSON({ result: "error", message: err.toString() });
  }
}

// =========================================================================
// OPERASI DATABASE SHEET
// =========================================================================

/**
 * Mengambil objek Sheet atau membuatnya secara otomatis jika belum ada
 */
function getSheet(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    if (name === SHEET_KBM) {
      sheet.appendRow(["ID", "Tanggal", "Waktu", "Kode", "Nama", "Status", "Mapel", "Kelas", "Mode", "Jam Sendiri", "Jam Team"]);
      formatHeader(sheet, 11);
    } else if (name === SHEET_UJIAN) {
      sheet.appendRow(["ID", "Tanggal", "Kode", "Nama", "Kategori", "Rincian", "Volume", "Nominal"]);
      formatHeader(sheet, 8);
    } else if (name === SHEET_MASTER) {
      sheet.getRange("A1:I1").setValues([["Kode", "Nama Guru", "PIN", "", "Mapel", "", "Kelas", "", "Admin Pass"]]);
      formatHeader(sheet, 9);
      sheet.getRange("I2").setValue(DEFAULT_ADMIN_PASS);
    }
  }
  return sheet;
}

function formatHeader(sheet, cols) {
  const range = sheet.getRange(1, 1, 1, cols);
  range.setBackground("#4f46e5");
  range.setFontColor("#ffffff");
  range.setFontWeight("bold");
  sheet.setFrozenRows(1);
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatTanggal(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Makassar", "yyyy-MM-dd");
  }
  const str = String(val).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, "Asia/Makassar", "yyyy-MM-dd");
  }
  return str;
}

function formatWaktu(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Makassar", "HH:mm");
  }
  return String(val).trim();
}

/**
 * Validasi password admin
 */
function validasiAdmin(pass) {
  const sheet = getSheet(SHEET_MASTER);
  const dbPass = sheet.getRange("I2").getValue() || DEFAULT_ADMIN_PASS;
  return String(pass) === String(dbPass);
}

/**
 * Validasi login guru dengan Nama + PIN
 */
function validasiGuru(namaLengkap, pin) {
  if (!namaLengkap || !pin) return false;
  const sheet = getSheet(SHEET_MASTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const targetClean = String(namaLengkap).trim().toLowerCase();
  const pinClean = String(pin).trim();

  for (let i = 0; i < data.length; i++) {
    const rawKode = String(data[i][0]).trim();
    const rawNama = String(data[i][1]).trim();
    const dbPin = String(data[i][2]).trim();

    const formattedKode = rawKode ? (rawKode.length === 1 ? "0" + rawKode : rawKode) : "";
    const combined = (formattedKode ? formattedKode + " " : "") + rawNama;

    if (
      (rawNama.toLowerCase() === targetClean || combined.toLowerCase() === targetClean) &&
      dbPin === pinClean
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Ambil Master Data untuk dropdown form
 */
function getMasterData() {
  const sheet = getSheet(SHEET_MASTER);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: "success", teachers: [], subjects: [], classes: [] };

  const rawGuru = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  const rawMapel = sheet.getRange(2, 5, lastRow - 1, 1).getValues();
  const rawKelas = sheet.getRange(2, 7, lastRow - 1, 1).getValues();

  const teachers = [];
  rawGuru.forEach(r => {
    if (r[1] && String(r[1]).trim() !== "") {
      const code = String(r[0]).trim();
      const formattedCode = code ? (code.length === 1 ? "0" + code : code) + " " : "";
      teachers.push(formattedCode + String(r[1]).trim());
    }
  });

  const subjects = rawMapel.map(r => String(r[0]).trim()).filter(v => v !== "");
  const classes = rawKelas.map(r => String(r[0]).trim()).filter(v => v !== "");

  return {
    result: "success",
    teachers: teachers,
    subjects: subjects,
    classes: classes
  };
}

/**
 * Simpan Master Data yang diedit dari menu Admin (tanpa menghilangkan PIN)
 */
function saveMasterData(teachersJSON, subjectsJSON, classesJSON) {
  const sheet = getSheet(SHEET_MASTER);
  const teachers = JSON.parse(teachersJSON || "[]");
  const subjects = JSON.parse(subjectsJSON || "[]");
  const classes = JSON.parse(classesJSON || "[]");

  // Ambil PIN lama agar tidak terhapus
  const lastRow = Math.max(sheet.getLastRow(), 2);
  const oldGuruData = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const pinMap = {};
  oldGuruData.forEach(r => {
    const key = String(r[1]).trim();
    if (key && r[2]) pinMap[key] = String(r[2]).trim();
  });

  // Bersihkan data lama (kolom A-G)
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, 7).clearContent();
  }

  // Siapkan data guru baru
  const guruRows = teachers.map(t => {
    const match = String(t).trim().match(/^(\d+)[\.\-\s]+(.*)/);
    const code = match ? (match[1].length === 1 ? "0" + match[1] : match[1]) : "";
    const name = match ? match[2].trim() : t.trim();
    const pin = pinMap[name] || "123456"; // Default PIN 123456 jika guru baru
    return [code, name, pin];
  });

  if (guruRows.length > 0) sheet.getRange(2, 1, guruRows.length, 3).setValues(guruRows);
  if (subjects.length > 0) sheet.getRange(2, 5, subjects.length, 1).setValues(subjects.map(s => [s]));
  if (classes.length > 0) sheet.getRange(2, 7, classes.length, 1).setValues(classes.map(c => [c]));
}

/**
 * Membaca semua data KBM (Untuk Admin Dashboard)
 */
function getAllDataKBM() {
  const sheet = getSheet(SHEET_KBM);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: "success", data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
  const list = values.map(r => {
    const rawCode = String(r[3]).trim();
    return {
      ID: String(r[0]),
      Tanggal: formatTanggal(r[1]),
      Waktu: formatWaktu(r[2]),
      Kode: rawCode ? (rawCode.length === 1 ? "0" + rawCode : rawCode) : "",
      Nama: String(r[4]).trim(),
      Status: String(r[5] || "Tetap"),
      Mapel: String(r[6] || ""),
      Kelas: String(r[7] || ""),
      Mode: String(r[8] || "sendiri"),
      "Jam Sendiri": Number(r[9]) || 0,
      "Jam Team": Number(r[10]) || 0
    };
  });

  list.reverse();
  return { result: "success", data: list.slice(0, 100) };
}

/**
 * Membaca semua data Ujian (Untuk Admin Dashboard)
 */
function getAllDataUjian() {
  const sheet = getSheet(SHEET_UJIAN);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: "success", data: [] };

  const values = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
  const list = values.map(r => {
    const rawCode = String(r[2]).trim();
    return {
      ID: String(r[0]),
      Tanggal: formatTanggal(r[1]),
      Kode: rawCode ? (rawCode.length === 1 ? "0" + rawCode : rawCode) : "",
      Nama: String(r[3]).trim(),
      Kategori: String(r[4] || ""),
      Rincian: String(r[5] || ""),
      Volume: String(r[6] || "1"),
      Nominal: Number(r[7]) || 0
    };
  });

  list.reverse();
  return { result: "success", data: list.slice(0, 100) };
}

/**
 * Membaca riwayat & statistik spesifik seorang Guru
 */
function getRiwayatGuru(sheetName, guruString) {
  const sheet = getSheet(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { result: "success", data: [], stats: { sendiri: 0, team: 0 } };

  const match = String(guruString).trim().match(/^(\d+)[\.\-\s]+(.*)/);
  const targetCode = match ? (match[1].length === 1 ? "0" + match[1] : match[1]) : "";
  const targetName = (match ? match[2] : guruString).trim().toLowerCase();

  const isKBM = (sheetName === SHEET_KBM);
  const numCols = isKBM ? 11 : 8;
  const values = sheet.getRange(2, 1, lastRow - 1, numCols).getValues();

  const filtered = [];
  let sumSendiri = 0;
  let sumTeam = 0;

  for (let i = 0; i < values.length; i++) {
    const r = values[i];
    const rawCode = String(r[isKBM ? 3 : 2]).trim();
    const rowCode = rawCode ? (rawCode.length === 1 ? "0" + rawCode : rawCode) : "";
    const rowName = String(r[isKBM ? 4 : 3]).trim().toLowerCase();

    const isMatch = (targetCode && rowCode && targetCode === rowCode) || (rowName && rowName === targetName);

    if (isMatch) {
      if (isKBM) {
        const js = Number(r[9]) || 0;
        const jt = Number(r[10]) || 0;
        sumSendiri += js;
        sumTeam += jt;
        filtered.push({
          ID: String(r[0]),
          Tanggal: formatTanggal(r[1]),
          Waktu: formatWaktu(r[2]),
          Kode: rowCode,
          Nama: String(r[4]).trim(),
          Status: String(r[5] || "Tetap"),
          Mapel: String(r[6] || ""),
          Kelas: String(r[7] || ""),
          Mode: String(r[8] || "sendiri"),
          "Jam Sendiri": js,
          "Jam Team": jt
        });
      } else {
        filtered.push({
          ID: String(r[0]),
          Tanggal: formatTanggal(r[1]),
          Kode: rowCode,
          Nama: String(r[3]).trim(),
          Kategori: String(r[4] || ""),
          Rincian: String(r[5] || ""),
          Volume: String(r[6] || "1"),
          Nominal: Number(r[7]) || 0
        });
      }
    }
  }

  filtered.reverse();
  return {
    result: "success",
    data: filtered.slice(0, 50),
    stats: { sendiri: sumSendiri, team: sumTeam }
  };
}

/**
 * Tambah baris baru KBM
 */
function insertKBM(p) {
  const sheet = getSheet(SHEET_KBM);
  sheet.appendRow([
    p.ID || String(Date.now()),
    p.Tanggal,
    p.Waktu || "",
    p.KodeGuru || "",
    p.NamaGuru || p.Guru || "",
    p.Status || "Tetap",
    p.Mapel || "",
    p.Kelas || "",
    p.Mode || "sendiri",
    Number(p["Jam Sendiri"]) || 0,
    Number(p["Jam Team"]) || 0
  ]);
  return { result: "success", message: "Data KBM tersimpan." };
}

/**
 * Tambah baris baru Ujian
 */
function insertUjian(p) {
  const sheet = getSheet(SHEET_UJIAN);
  sheet.appendRow([
    p.ID || String(Date.now()),
    p.Tanggal,
    p.KodeGuru || "",
    p.NamaGuru || p.Guru || "",
    p.Kategori || "",
    p.Rincian || "",
    p.Volume || 1,
    Number(p.Nominal) || 0
  ]);
  return { result: "success", message: "Data Ujian tersimpan." };
}

/**
 * Update data berdasarkan ID unik
 */
function updateData(p) {
  const isKBM = (p.type === "harian");
  const sheet = getSheet(isKBM ? SHEET_KBM : SHEET_UJIAN);
  const data = sheet.getDataRange().getValues();
  const targetId = String(p.ID);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === targetId) {
      const row = i + 1;
      if (isKBM) {
        sheet.getRange(row, 2, 1, 10).setValues([[
          p.Tanggal,
          p.Waktu || data[i][2],
          p.KodeGuru || data[i][3],
          p.NamaGuru || p.Guru || data[i][4],
          p.Status || "Tetap",
          p.Mapel,
          p.Kelas,
          p.Mode,
          Number(p["Jam Sendiri"]) || 0,
          Number(p["Jam Team"]) || 0
        ]]);
      } else {
        sheet.getRange(row, 2, 1, 7).setValues([[
          p.Tanggal,
          p.KodeGuru || data[i][2],
          p.NamaGuru || p.Guru || data[i][3],
          p.Kategori,
          p.Rincian,
          p.Volume,
          Number(p.Nominal) || 0
        ]]);
      }
      return { result: "success", message: "Data berhasil diperbarui." };
    }
  }
  return { result: "error", message: "ID data tidak ditemukan untuk diedit." };
}

/**
 * Hapus data berdasarkan ID unik
 */
function deleteData(p) {
  const isKBM = (p.type === "harian");
  const sheet = getSheet(isKBM ? SHEET_KBM : SHEET_UJIAN);
  const data = sheet.getDataRange().getValues();
  const targetId = String(p.ID);

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === targetId) {
      sheet.deleteRow(i + 1);
      return { result: "success", message: "Data berhasil dihapus." };
    }
  }
  return { result: "error", message: "ID data tidak ditemukan untuk dihapus." };
}

// =========================================================================
// SETUP OTOMATIS: JALANKAN INI SATU KALI DI SPREADSHEET BARU
// =========================================================================

/**
 * Klik tombol RUN pada fungsi ini di Google Apps Script untuk otomatis
 * menyiapkan 3 Sheet lengkap dengan data Guru, Mapel, Kelas SDIT Qurratu A'yun!
 */
function initSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Buat Sheet KBM
  const sKBM = getSheet(SHEET_KBM);
  
  // 2. Buat Sheet Ujian
  const sUjian = getSheet(SHEET_UJIAN);
  
  // 3. Buat Sheet Master
  const sMaster = getSheet(SHEET_MASTER);
  
  // Inisialisasi Data Awal Master Guru
  const defaultTeachers = [
    ["01", "Radiant Fadli, S.Pd.", "123456"],
    ["02", "Bahtiar, S.Pd.I.", "123456"],
    ["03", "Agung Setiabudi, S.Pd., Gr.", "123456"],
    ["04", "Fandhy Ahmad Klana, S.S., Gr.", "123456"],
    ["05", "Muhammad Ihsan", "123456"],
    ["06", "Turmisi", "123456"],
    ["07", "Wahyu Saputra", "123456"],
    ["08", "Syamsir, S.Pd., Gr.", "123456"],
    ["09", "Ahmad Prisatrialdi, S.Pd., Gr.", "123456"],
    ["10", "Syahrul Ramadhan, S.H.", "123456"],
    ["11", "Muh. Sofyan Asnur, S.Pd., Gr.", "123456"],
    ["12", "Muhammad Fikri Haekal", "123456"],
    ["13", "Munadil Amri", "123456"],
    ["14", "Fuad", "123456"],
    ["16", "Dra. Mardia Habe", "123456"],
    ["17", "Hj. Nur Apni, S.Pd., Gr.", "123456"],
    ["18", "Hj. Amalia Ahsan, S.Pd., Gr.", "123456"],
    ["19", "Dewi Syahara Nur, S.Pd., Gr.", "123456"],
    ["20", "Ina Mulyati Salam, S.T.", "123456"],
    ["21", "Humairah Nafisah, S.Pd., Gr.", "123456"],
    ["22", "Fitriani, S.Pd.", "123456"],
    ["23", "Satriani", "123456"],
    ["24", "Nur Wahidah", "123456"],
    ["25", "Muti'ah S.", "123456"],
    ["26", "Liza Fany Adella, S.Pd., Gr.", "123456"],
    ["27", "Darmawati, S.Pd., Gr.", "123456"],
    ["28", "Ilma Nurtami, S.Pd., Gr.", "123456"],
    ["29", "A. Nurdiyawanti, S.Pd., M.Pd., Gr.", "123456"],
    ["30", "Rahmawati Basri, S.Pd., Gr.", "123456"],
    ["31", "Sri Wahyuni, S.Pd., Gr.", "123456"],
    ["32", "Ihwana, S.Pd., Gr.", "123456"],
    ["33", "Surianti", "123456"],
    ["34", "Hajriani", "123456"],
    ["35", "Nur Rizky", "123456"],
    ["38", "Hebrianti, S.Pd., M.Si.", "123456"],
    ["39", "Rahmawati", "123456"],
    ["40", "Dhea Rahmiyanti, S.Pd.", "123456"]
  ];
  
  const defaultSubjects = [
    ["Al-Qur'an"], ["Aqidah Akhlak"], ["Bahasa Arab"], ["Bahasa Bugis"], ["Bahasa Indonesia"],
    ["Bahasa Inggris"], ["Calistung"], ["Doa"], ["Fiqhi"], ["Hadis"], ["Hafalan Al-Qur'an"],
    ["IPAS"], ["Ilmu Tajwid"], ["Matematika"], ["PJOK"], ["Pend. Pancasila"], ["Praktik Salat"],
    ["Seni"], ["Sirah SKI"]
  ];
  
  const defaultClasses = [
    ["1A Putra"], ["1A Putri"], ["1B Putra"], ["1B Putri"],
    ["2A Putra"], ["2A Putri"], ["2B Putra"], ["2B Putri"],
    ["3A Putra"], ["3A Putri"], ["3B Putra"], ["3B Putri"],
    ["4 Putri"], ["4A Putra"], ["4B Putra"],
    ["5 Putri"], ["5A Putra"], ["5B Putri"],
    ["6 Putra"], ["6 Putri"]
  ];
  
  sMaster.getRange(2, 1, defaultTeachers.length, 3).setValues(defaultTeachers);
  sMaster.getRange(2, 5, defaultSubjects.length, 1).setValues(defaultSubjects);
  sMaster.getRange(2, 7, defaultClasses.length, 1).setValues(defaultClasses);
  sMaster.getRange("I2").setValue(DEFAULT_ADMIN_PASS);

  // Buat juga Sheet Slip Gaji & Master Gaji otomatis
  setupSlipGaji();

  Logger.log("✅ Inisialisasi Spreadsheet Berhasil! Sheet KBM, Ujian, Master, Master_Gaji, dan Slip_Gaji siap digunakan.");
}

/**
 * =========================================================================
 * SETUP SHEET SLIP GAJI & MASTER GAJI (OTOMATIS 1 KLIK)
 * =========================================================================
 * Membuat format slip gaji siap cetak sesuai template resmi SDIT Qurratu A'yun.
 * Cukup ketik KODE Guru di sel M4, semua data & hitungan gaji langsung muncul!
 */
function setupSlipGaji() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Siapkan Sheet Master_Gaji
  let sMasterGaji = ss.getSheetByName("Master_Gaji");
  if (!sMasterGaji) {
    sMasterGaji = ss.insertSheet("Master_Gaji");
  }
  
  const headerGaji = [
    "Kode", "Nama Guru", "Jabatan", "Alamat", "No HP",
    "Gaji Pokok", "Tunjangan Jabatan", "Tunjangan Wali Kelas",
    "Tunjangan Konsumsi Transport", "Tunjangan Kesehatan",
    "Pinjaman Kas", "Iuran SPP", "Donasi", "Lainnya"
  ];
  sMasterGaji.getRange(1, 1, 1, headerGaji.length).setValues([headerGaji]);
  const hRange = sMasterGaji.getRange(1, 1, 1, headerGaji.length);
  hRange.setBackground("#4f46e5").setFontColor("#ffffff").setFontWeight("bold");
  sMasterGaji.setFrozenRows(1);
  
  // Ambil data guru dari Master jika ada
  const sMaster = getSheet(SHEET_MASTER);
  const lastMasterRow = sMaster.getLastRow();
  let teacherList = [];
  if (lastMasterRow >= 2) {
    teacherList = sMaster.getRange(2, 1, lastMasterRow - 1, 2).getValues();
  }
  
  // Isi data default Master Gaji untuk seluruh guru jika masih kosong
  if (sMasterGaji.getLastRow() < 2) {
    const gajiRows = [];
    teacherList.forEach(t => {
      const code = String(t[0]).trim();
      const formattedCode = code.length === 1 ? "0" + code : code;
      const name = String(t[1]).trim();
      
      // Khusus guru kode 25 (Muti'ah S.) sesuaikan persis seperti slip contoh
      if (formattedCode === "25" || name.indexOf("Muti'ah") !== -1) {
        gajiRows.push([
          formattedCode, name, "Wali Kelas 2A Putra", "PERUM. ABC MACCOPA", "-",
          300000, 0, 100000, 0, 50000, 0, 0, 0, 0
        ]);
      } else {
        gajiRows.push([
          formattedCode, name, "Guru", "-", "-",
          300000, 0, 0, 0, 50000, 0, 0, 0, 0
        ]);
      }
    });
    
    if (gajiRows.length > 0) {
      sMasterGaji.getRange(2, 1, gajiRows.length, headerGaji.length).setValues(gajiRows);
      sMasterGaji.getRange(2, 6, gajiRows.length, 9).setNumberFormat("#,##0");
    }
  }

  // 2. Siapkan Sheet Slip_Gaji
  let sSlip = ss.getSheetByName("Slip_Gaji");
  if (!sSlip) {
    sSlip = ss.insertSheet("Slip_Gaji");
  } else {
    sSlip.clear();
  }
  
  sSlip.setGridlines(true);

  // Atur Lebar Kolom (A - N)
  sSlip.setColumnWidth(1, 130); // A (Banner)
  sSlip.setColumnWidth(2, 40);  // B (NO / Label)
  sSlip.setColumnWidth(3, 25);  // C
  sSlip.setColumnWidth(4, 90);  // D
  sSlip.setColumnWidth(5, 90);  // E
  sSlip.setColumnWidth(6, 60);  // F
  sSlip.setColumnWidth(7, 75);  // G (Alamat / HP)
  sSlip.setColumnWidth(8, 100); // H
  sSlip.setColumnWidth(9, 100); // I
  sSlip.setColumnWidth(10, 20); // J
  sSlip.setColumnWidth(11, 35); // K (Rp)
  sSlip.setColumnWidth(12, 45); // L (Kode label)
  sSlip.setColumnWidth(13, 60); // M (Kode input)
  sSlip.setColumnWidth(14, 45); // N

  // Set default font Times New Roman untuk seluruh slip
  sSlip.getRange("A1:N35").setFontFamily("Times New Roman");

  // Warna Hijau Header (Sesuai Screenshot: #84b082)
  const GREEN_HEADER = "#84b082";

  // --- ROW 3: JUDUL SLIP GAJI & TANGGAL ---
  sSlip.getRange("B3:I3").merge().setValue("SLIP GAJI BULAN AGUSTUS 2026")
    .setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center").setVerticalAlignment("middle");
  sSlip.getRange("B3:I3").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  sSlip.getRange("K3").setValue("TGL.").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setBorder(true, true, true, true, false, false);
  sSlip.getRange("L3:N3").merge().setValue("01 Oktober 2026").setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
    .setBorder(true, true, true, true, false, false);

  // --- ROW 4: NAMA, ALAMAT, KODE ---
  sSlip.getRange("B4").setValue("NAMA").setFontWeight("bold").setBorder(true, true, true, true, false, false);
  sSlip.getRange("C4:E4").merge()
    .setFormula('=IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$E, 2, FALSE), IFERROR(VLOOKUP(TO_TEXT($M$4), Master_Gaji!$A:$E, 2, FALSE), ""))')
    .setFontWeight("bold").setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);

  sSlip.getRange("G4").setValue("ALAMAT").setFontWeight("bold").setBorder(true, true, true, true, false, false);
  sSlip.getRange("H4:J4").merge()
    .setFormula('=IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$E, 4, FALSE), "")')
    .setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);

  sSlip.getRange("L4").setValue("KODE").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sSlip.getRange("M4:N4").merge().setValue("25").setFontWeight("bold").setFontSize(12).setHorizontalAlignment("center")
    .setBackground("#fef9c3") // Kuning lembut penanda input
    .setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // --- ROW 5: JABATAN & HP ---
  sSlip.getRange("B5").setValue("JABATAN").setFontWeight("bold").setBorder(true, true, true, true, false, false);
  sSlip.getRange("C5:E5").merge()
    .setFormula('=IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$E, 3, FALSE), "")')
    .setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);

  sSlip.getRange("G5").setValue("HP").setFontWeight("bold").setBorder(true, true, true, true, false, false);
  sSlip.getRange("H4:J5").setBorder(true, true, true, true, false, false);
  sSlip.getRange("H5:J5").merge()
    .setFormula('=IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$E, 5, FALSE), "-")')
    .setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);

  // --- ROW 8 & 9: TABEL PENERIMAAN ---
  sSlip.getRange("B8").setValue("PENERIMAAN").setFontWeight("bold").setFontSize(12);
  sSlip.getRange("B9").setValue("NO.").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);
  sSlip.getRange("C9:I9").merge().setValue("KETERANGAN").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);
  sSlip.getRange("K9:N9").merge().setValue("JUMLAH").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);

  const penerimaanItems = [
    [10, "1", "GAJI POKOK", '=IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 6, FALSE), 0)'],
    [11, "2", "INSENTIF MENGAJAR KE-1 (Rp.12.000/JAM)", '=IF(SUMIFS(KBM!$J:$J, KBM!$D:$D, TEXT($M$4,"00"))*12000=0, "-", SUMIFS(KBM!$J:$J, KBM!$D:$D, TEXT($M$4,"00"))*12000)'],
    [12, "3", "INSENTIF MENGAJAR KE-2 (Rp.10.000/JAM)", '=IF(SUMIFS(KBM!$K:$K, KBM!$D:$D, TEXT($M$4,"00"))*10000=0, "-", SUMIFS(KBM!$K:$K, KBM!$D:$D, TEXT($M$4,"00"))*10000)'],
    [13, "4", "TUNJANGAN JABATAN", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 7, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 7, FALSE))'],
    [14, "5", "TUNJANGAN WALI KELAS", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 8, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 8, FALSE))'],
    [15, "6", "TUNJANGAN KONSUMSI + TRANSPORT", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 9, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 9, FALSE))'],
    [16, "7", "TUNJANGAN KESEHATAN", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 10, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 10, FALSE))'],
    [17, "8", "INSENTIF PELAKSANAAN UJIAN", '=IF(SUMIFS(Ujian!$H:$H, Ujian!$C:$C, TEXT($M$4,"00"))=0, "-", SUMIFS(Ujian!$H:$H, Ujian!$C:$C, TEXT($M$4,"00")))']
  ];

  penerimaanItems.forEach(item => {
    const row = item[0];
    sSlip.getRange(row, 2).setValue(item[1]).setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
    sSlip.getRange(row, 3, 1, 7).merge().setValue(item[2]).setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);
    sSlip.getRange(row, 11).setValue("Rp").setHorizontalAlignment("left").setBorder(true, false, true, true, false, false);
    sSlip.getRange(row, 12, 1, 3).merge().setFormula(item[3]).setHorizontalAlignment("right").setNumberFormat("#,##0").setBorder(true, true, true, false, false, false);
  });

  // --- ROW 20: TOTAL PENGHASILAN ---
  sSlip.getRange("H20:J20").merge().setValue("TOTAL PENGHASILAN").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sSlip.getRange("K20").setValue("Rp").setFontWeight("bold").setHorizontalAlignment("left").setBorder(true, false, true, true, false, false);
  sSlip.getRange("L20:N20").merge().setFormula('=SUMIF(L10:L17, ">0")').setFontWeight("bold").setHorizontalAlignment("right").setNumberFormat("#,##0").setBorder(true, true, true, false, false, false);

  // --- ROW 22 & 23: TABEL PENGURANGAN ---
  sSlip.getRange("B22").setValue("PENGURANGAN").setFontWeight("bold").setFontSize(12);
  sSlip.getRange("B23").setValue("NO.").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);
  sSlip.getRange("C23:I23").merge().setValue("KETERANGAN").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);
  sSlip.getRange("K23:N23").merge().setValue("JUMLAH").setFontWeight("bold").setHorizontalAlignment("center").setBackground(GREEN_HEADER).setBorder(true, true, true, true, false, false);

  const penguranganItems = [
    [24, "1", "PINJAMAN KAS YAYASAN", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 11, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 11, FALSE))'],
    [25, "2", "IURAN SPP ANAK", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 12, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 12, FALSE))'],
    [26, "3", "DONASI", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 13, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 13, FALSE))'],
    [27, "4", "LAINNYA", '=IF(IFERROR(VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 14, FALSE), 0)=0, "-", VLOOKUP(TEXT($M$4,"00"), Master_Gaji!$A:$N, 14, FALSE))']
  ];

  penguranganItems.forEach(item => {
    const row = item[0];
    sSlip.getRange(row, 2).setValue(item[1]).setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
    sSlip.getRange(row, 3, 1, 7).merge().setValue(item[2]).setHorizontalAlignment("left").setBorder(true, true, true, true, false, false);
    sSlip.getRange(row, 11).setValue("Rp").setHorizontalAlignment("left").setBorder(true, false, true, true, false, false);
    sSlip.getRange(row, 12, 1, 3).merge().setFormula(item[3]).setHorizontalAlignment("right").setNumberFormat("#,##0").setBorder(true, true, true, false, false, false);
  });

  // --- ROW 29: BENDAHARA & TOTAL PENGURANGAN ---
  sSlip.getRange("B29:F29").merge().setValue("BENDAHARA YAYASAN,").setFontSize(10).setHorizontalAlignment("left");
  sSlip.getRange("H29:J29").merge().setValue("TOTAL PENGURANGAN").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true, true, true, true, false, false);
  sSlip.getRange("K29").setValue("Rp").setFontWeight("bold").setHorizontalAlignment("left").setBorder(true, false, true, true, false, false);
  sSlip.getRange("L29:N29").merge().setFormula('=IF(SUMIF(L24:L27, ">0")=0, "-", SUMIF(L24:L27, ">0"))').setFontWeight("bold").setHorizontalAlignment("right").setNumberFormat("#,##0").setBorder(true, true, true, false, false, false);

  // --- ROW 31: NAMA BENDAHARA & TOTAL GAJI DITERIMA ---
  sSlip.getRange("B31:F31").merge().setValue("NAILAH FARAFISHAH, S.S.").setFontWeight("bold").setFontSize(10).setFontUnderline(true).setHorizontalAlignment("left");
  sSlip.getRange("H31:J31").merge().setValue("TOTAL GAJI DITERIMA").setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center")
    .setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sSlip.getRange("K31").setValue("Rp").setFontWeight("bold").setFontSize(11).setHorizontalAlignment("left")
    .setBorder(true, false, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sSlip.getRange("L31:N31").merge().setFormula('=L20 - IF(ISNUMBER(L29), L29, 0)').setFontWeight("bold").setFontSize(11).setHorizontalAlignment("right").setNumberFormat("#,##0")
    .setBorder(true, true, true, false, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // --- BINGKAI LUAR KOTAK CETAK SLIP GAJI (B3:N31) ---
  sSlip.getRange("B3:N31").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);

  // --- BANNER DI KOLOM A ---
  sSlip.getRange("A3:A31").setBorder(true, true, true, true, false, false, "#16a34a", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sSlip.getRange("A3").setFormula('=IMAGE("https://raw.githubusercontent.com/ibnuhusny-spec/new-sirekap/main/logo.png", 1)');

  Logger.log("✅ Slip Gaji & Master Gaji Berhasil Dibuat!");
}
