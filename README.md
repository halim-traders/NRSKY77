# NR Trading Journal

Aplikasi jurnal trading sederhana dengan tampilan dark + gold. Dibuat menggunakan HTML, CSS, dan JavaScript tanpa backend.

## Cara menjalankan
1. Ekstrak ZIP.
2. Buka folder `Journal_Trading`.
3. Klik dua kali `index.html` atau jalankan dengan Live Server di VS Code.
4. Saat pertama dibuka, buat PIN 4–6 angka lalu simpan Recovery Code yang ditampilkan (Copy / Download), kemudian tekan "Saya Sudah Simpan, Masuk".
5. Atur nama trader, modal awal, dan mata uang di menu **Account & Balance**.
6. Tambahkan transaksi melalui tombol **Add Trade**.

## Fitur
- Alur login sederhana:
  - **Belum punya PIN** → buat PIN → dapat Recovery Code → masuk.
  - **Sudah punya PIN** → isi PIN → masuk. Ada tombol **Lupa PIN?** di bawahnya.
  - **Lupa PIN** → isi Recovery Code + buat PIN baru → masuk. Data jurnal tidak dihapus.
- Recovery Code otomatis diformat (XXXX-XXXX-XXXX-XXXX), tidak peka huruf besar/kecil, dan tanda "-" boleh diabaikan
- Pembuatan Recovery Code baru melalui menu Settings > Security, dengan Copy dan Download Code
- Form transaksi tersedia langsung di halaman Trading Journal (tanpa modal) dan menampilkan riwayat transaksi tepat di bawah form.
- Exit Date digunakan sebagai tanggal realisasi di Trading Calendar; Exit Price dipakai untuk menghitung pips aktual jika tersedia.
- Dashboard saldo, net P/L, win rate, total trade
- Pair/Symbol dropdown: XAUUSD, GBPUSD, NZDUSD, USDJPY, EURUSD, dan Other
- Pips diisi manual pada form transaksi dan dipakai konsisten di Journal, Dashboard, Analytics, dan Trading Calendar.
- Analytics bulanan: modal awal, total Profit/Loss nominal, Profit/Loss %, dan jumlah trade
- Dashboard menampilkan pertumbuhan Total Balance dan Net Profit/Loss dalam persentase terhadap modal awal
- Setelah Add/Edit/Delete Trade, Dashboard, Analytics, Monthly Pips, dan Trading Calendar otomatis dihitung ulang
- Tambah, edit, hapus, cari, dan filter trade
- Grafik pertumbuhan saldo dan performa bulanan
- Trading calendar dengan Daily Summary, pips per trade, rata-rata pips per hari, dan total pips bulanan
- Initial Balance bisa diedit dan disimpan
- Current Balance bisa diedit dan disimpan tanpa mengubah histori trade/deposit/withdrawal
- Save Account menampilkan notifikasi dan langsung memperbarui Dashboard serta Account & Balance
- Data akun tetap tersimpan setelah refresh karena menggunakan localStorage
- Deposit/Withdrawal dihitung akurat dan memengaruhi Current Balance
- Clear Trade & Cash History menghapus riwayat transaksi dan cash flow, tetapi mempertahankan saldo terakhir (menjadi Initial Balance baru), profil, PIN, dan Recovery Code
- Export transaksi CSV
- Backup dan restore JSON
- Responsive desktop dan mobile

## Catatan penting
Versi ini menggunakan `localStorage` browser. Data hanya tersimpan pada browser/perangkat yang digunakan dan tidak otomatis tersinkron ke perangkat lain. PIN dan hash Recovery Code di versi ini disimpan secara lokal, bukan sistem autentikasi server. Simpan Recovery Code di tempat aman. Jika memakai data lama dari versi sebelum fitur Recovery Code, login terlebih dahulu lalu buka Settings > Security dan klik “Tampilkan / Buat Recovery Code”. Jika PIN lama sudah terlupa dan belum pernah membuat Recovery Code, PIN tidak dapat dipulihkan tanpa menghapus data lokal. Untuk penggunaan multi-user, sinkronisasi online, atau keamanan produksi, aplikasi perlu backend (misalnya PHP + MySQL) dengan autentikasi dan penyimpanan server.

Angka P/L pada trade diisi manual sesuai hasil dari platform broker. Aplikasi tidak terhubung ke broker dan tidak mengeksekusi transaksi.

- Validasi SL/TP otomatis mengikuti arah BUY/SELL agar SL dan TP berada di sisi yang benar terhadap Entry.
