# 📊 SIREKAP v16 - SIMPLIFIED EDITION
**Sistem Rekapitulasi Presensi KBM & Ujian Semester**  
*SDIT Qurratu A'yun Al-Islami Kabupaten Maros*

---

## 🌟 Tentang Edisi Ini

**SiRekap v16** adalah penyempurnaan sistem presensi dewan guru yang dirancang agar **jauh lebih sederhana, ringan, dan cepat**. 

Sebelumnya, sistem terhubung ke Google Spreadsheet dengan puluhan sheet yang membingungkan. Pada versi ini, arsitektur database disederhanakan secara radikal menjadi **hanya 3 Sheet utama** tanpa mengurangi satu pun fitur presensi, keamanan, maupun rekapitulasi jam mengajar guru.

---

## 🏗️ Arsitektur 3 Sheet Database

| Nama Sheet | Fungsi Utama | Kolom Data |
|---|---|---|
| **`KBM`** | Menampung seluruh riwayat presensi KBM harian (semua guru & semua bulan) | `ID`, `Tanggal`, `Waktu`, `Kode`, `Nama`, `Status`, `Mapel`, `Kelas`, `Mode`, `Jam Sendiri`, `Jam Team` |
| **`Ujian`** | Menampung seluruh aktivitas ujian semester | `ID`, `Tanggal`, `Kode`, `Nama`, `Kategori`, `Rincian`, `Volume`, `Nominal` |
| **`Master`** | Master Data Terpadu (Nama Guru, PIN Keamanan, Mapel, Kelas, Password Admin) | Kolom A-C: Guru & PIN<br>Kolom E: Mapel<br>Kolom G: Kelas<br>Kolom I: Password Admin |

---

## 🚀 Panduan Setup Spreadsheet Baru (Dalam 3 Menit)

### Langkah 1: Buat Spreadsheet Baru
1. Buka [Google Sheets](https://sheets.new) dan buat spreadsheet kosong baru.
2. Beri nama, misalnya: `DATABASE SIREKAP - SDIT QURRATU A'YUN`.

### Langkah 2: Pasang Skrip Backend
1. Di menu atas Spreadsheet, klik **Ekstensi (Extensions) > Apps Script**.
2. Hapus semua kode bawaan di `Code.gs`.
3. Buka file [`Code.gs`](Code.gs) dari repositori ini, salin seluruh isinya, lalu tempel (*paste*) ke editor Apps Script.
4. Klik tombol **Simpan (ikon disket)**.

### Langkah 3: Inisialisasi Otomatis (1 Klik)
1. Pada menu fungsi di bagian atas editor Apps Script, pilih fungsi **`initSpreadsheet`**.
2. Klik tombol **Jalankan (Run)**.
3. Berikan izin akses (*Review Permissions > Allow*).
4. Selesai! Ketiga sheet (`KBM`, `Ujian`, dan `Master` beserta 37 guru, 19 mapel, dan 20 kelas) akan otomatis terbuat dan diformat dengan rapi.

### Langkah 4: Publikasikan sebagai Web App
1. Di pojok kanan atas Apps Script, klik tombol biru **Terapkan (Deploy) > Penerapan baru (New deployment)**.
2. Klik ikon gerigi (Select type) > pilih **Aplikasi web (Web app)**.
3. Konfigurasi:
   - **Deskripsi**: `SiRekap v16 Production`
   - **Jalankan sebagai (Execute as)**: `Saya (email Anda)`
   - **Yang memiliki akses (Who has access)**: `Siapa saja (Anyone)` *(Wajib agar HP guru bisa mengirim data)*
4. Klik **Terapkan (Deploy)**.
5. Salin **URL Aplikasi Web** yang muncul (berakhiran `/exec`).

### Langkah 5: Hubungkan ke Aplikasi
1. Buka file [`index.html`](index.html).
2. Pada baris konfigurasi `API_URL`, tempelkan URL Web App baru Anda:
   ```javascript
   const DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbxG4BYzo-3-Zu1Ugj-9jd71qx7ImDk_VCoqiJxNF5nFmeDR9c8jkg6CZfP9knTnMIv2/exec";
   ```
   *Atau Anda juga bisa mengubahnya langsung melalui menu pengaturan Admin di aplikasi web.*

---

## 📈 Formula Rekapitulasi Otomatis (Khusus Kepala Sekolah)

Jika Kepala Sekolah ingin melihat tabel rekapitulasi total jam mengajar tiap guru secara otomatis tanpa perlu membuka satu per satu, Anda cukup membuat tab sheet baru bernama **`Rekap_Bulanan`** lalu masukkan rumus sakti ini di sel `A1`:

```excel
=QUERY(KBM!A:K; "SELECT D, E, SUM(J), SUM(K), SUM(J)+SUM(K) WHERE D IS NOT NULL GROUP BY D, E LABEL D 'Kode', E 'Nama Guru', SUM(J) 'Jam Sendiri', SUM(K) 'Jam Team', SUM(J)+SUM(K) 'Total JP' ORDER BY D ASC")
```

Tabel akan ter-update otomatis secara *real-time* setiap kali ada guru yang menekan tombol kirim di HP mereka!

---

## 🖨️ Cetak Slip Gaji Otomatis (1 Ketik Kode Langsung Jadi!)

Aplikasi ini kini dilengkapi fitur **Slip Gaji Siap Cetak** otomatis yang terhubung langsung ke data presensi KBM dan Ujian:

### Cara Mengaktifkan:
1. Buka editor **Google Apps Script** di spreadsheet Anda.
2. Pilih fungsi **`setupSlipGaji`** di menu fungsi atas, lalu klik **Jalankan (Run)**.
3. Otomatis akan muncul 2 Sheet baru:
   - **`Slip_Gaji`**: Format slip resmi (warna hijau pastel, Times New Roman, bingkai cetak rapi, lengkap dengan rincian penerimaan dan potongan).
   - **`Master_Gaji`**: Tempat mengatur gaji pokok, jabatan, dan tunjangan tetap masing-masing guru.

### Cara Penggunaan:
1. Buka Sheet **`Slip_Gaji`**.
2. Masukkan **KODE GURU** pada sel **`M4`** (misal ketik `25` atau `01`).
3. Seluruh data otomatis terisi seketika:
   - Nama Guru, Jabatan, Alamat, dan No HP.
   - Gaji Pokok & Tunjangan Tetap (Wali Kelas, Kesehatan, dll).
   - **Insentif Jam Mengajar (Rp.12.000 & Rp.10.000)** langsung dihitung dari jam presensi di sheet `KBM`!
   - **Insentif Ujian** langsung diambil dari sheet `Ujian`!
   - Total Penghasilan, Potongan, dan Total Gaji Bersih otomatis terjumlah.
4. Tekan **Ctrl + P** (Print) -> Siap cetak atau simpan PDF 1 halaman penuh!

---

## 🔒 Keamanan Sistem

- **PIN Keamanan 6 Digit**: Setiap guru memiliki PIN unik di Sheet `Master`. Guru lain tidak dapat melihat atau mengedit riwayat guru lain.
- **Password Admin**: Melindungi menu dashboard kepala sekolah dan pengaturan data master.
- **Validasi Server-Side**: Proteksi data dilakukan langsung di Google Apps Script engine sehingga aman dari manipulasi inspect element / F12.

---

*Dikembangkan untuk kemudahan manajemen SDIT Qurratu A'yun Al-Islami Maros.*
