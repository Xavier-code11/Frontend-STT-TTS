# SerenityRev Frontend (React + Vite)

Voice AI Assistant frontend supporting two transport modes:

- Mode A: HTTP streaming
- Mode B: WebSocket realtime (start → binary → stop)

UI mencakup visualizer empatik, kontrol rekam, dan penanganan notifikasi krisis yang memblokir interaksi sampai pengguna mengakui pesan.

## Prasyarat

- Node.js 18+ (disarankan 20+)
- NPM (atau PNPM/Yarn)
- Browser modern (Chrome/Edge/Firefox)
- Mikrofon tersedia dan izin akses audio diberikan
- Backend server aktif dengan endpoint sesuai konfigurasi (lihat variabel lingkungan)

## Setup Cepat

```bash
# dari folder root proyek frontend (clientside/)
npm install

# Jalankan pengembangan (Vite dev server)
npm run dev
```

Server dev Vite akan tampilkan URL (mis. http://localhost:5173). Buka di browser, izinkan akses mikrofon saat diminta.

## Konfigurasi Lingkungan

Semua konfigurasi diakses melalui `src/config/env.js` dan menggunakan variabel dengan prefix `REACT_APP_`.

Buat file `.env.local` (atau gunakan `.env`) di direktori `clientside/` dengan isi seperti di bawah. Template tersedia di `.env.example`.

```env
# URL backend HTTP (akan diberi prefix /api/v1 oleh client)
REACT_APP_BACKEND_HTTP_URL=http://localhost:8000

# URL backend WebSocket (ws:// atau wss://) — client akan menyesuaikan wss saat situs https
REACT_APP_BACKEND_WS_URL=ws://localhost:8000

# Penanda sesi
REACT_APP_SESSION_ID=web-client

# Bahasa interaksi
REACT_APP_LANGUAGE=id

# MIME audio preferensi rekaman (contoh: audio/wav)
REACT_APP_AUDIO_MIME=audio/wav
```

Catatan:
- Client otomatis menambahkan prefix path `/api/v1` ke URL yang diberikan.
- Jika aplikasi berjalan di HTTPS, koneksi `ws://` otomatis di-upgrade menjadi `wss://`.

## Mode Operasi

### Mode B: WebSocket realtime
- Protokol: `start` → kirim payload audio (binary) → `stop`.
- Client tidak menutup socket saat `stop`—menunggu event `ready` dari server untuk siklus berikutnya.
- Audio dikirim sebagai satu payload gabungan setelah rekaman berhenti untuk menghindari fragmentasi.
- Event yang dikenali:
	- `audio_start` / `audio_end` untuk playback
	- `ready` untuk menandakan server siap menerima sesi berikutnya
	- `crisis` untuk notifikasi krisis (UI modal/blurring)

### Mode A: HTTP streaming
- Mengirim audio via POST multipart; dapat melakukan streaming respons jika backend mendukung.
- Jika backend membutuhkan WAV, konversi terjadi khusus jalur HTTP.

## Fitur UI Penting

- Visualizer empatik (lingkaran + partikel), responsif terhadap playback.
- Kontrol rekam Start/Stop.
- Panel log untuk pemantauan event.
- Crisis Modal: ketika server mengirim event `crisis`, UI menampilkan modal overlay dengan:
	- teks utama (`text`),
	- label tipe/subtype,
	- tombol “OK” untuk menutup,
	Interaksi latar diblokir sampai diakui.

## Struktur Proyek Singkat

```
clientside/
	public/
	src/
		components/
			VoiceChatWidget.jsx        # Kontainer UI utama
			AIVisualizer.jsx/CSS       # Visualizer lingkaran + partikel
			CrisisModal.jsx/CSS        # Modal krisis
		lib/audio/
			MediaRecorderManager.js    # Rekaman mic + chunking
			AudioStreamPlayer.js       # Playback streaming (MSE + fallback)
			WavConverter.js            # Konversi ke WAV (jalur HTTP)
		lib/visualization/
			ParticleVisualizer.js      # Sistem partikel
		services/transports/
			WebSocketChatTransport.js  # Protokol WS start/binary/stop + event
			HttpChatTransport.js       # HTTP streaming
		services/
			VoiceChatClient.js         # Fasad yang mengoordinasi recorder + transport
		config/env.js                # Akses variabel lingkungan
```

## Menjalankan Produksi

```bash
npm run build
npm run preview
```

`preview` akan menjalankan server statis untuk memeriksa hasil build.

## Troubleshooting

- Tidak ada audio yang dikirim (error `empty_audio`): pastikan izin mikrofon diberikan dan rekaman berjalan sebelum `stop`.
- WS tidak OPEN: backend belum siap atau URL WS tidak sesuai. Cek `REACT_APP_BACKEND_WS_URL` dan log console.
- Koneksi `ws://` gagal di HTTPS: gunakan `wss://` atau biarkan client meng-upgrade otomatis jika URL valid.
- Visualizer tidak bergerak: pastikan audio playback terjadi; untuk debugging, lihat panel log.
- Event krisis muncul tapi UI tidak tampil: periksa log untuk `server event: crisis` dan pastikan `CrisisModal` tidak tersembunyi oleh CSS lain.

## Tools yang diperlukan

- Node.js 18+ (disarankan 20+)
- NPM / PNPM / Yarn
- Browser modern dengan dukungan WebAudio & MediaRecorder
- Akses mikrofon di OS dan browser

Opsional (untuk backend, bukan bagian frontend):
- FFmpeg atau layanan TTS/ASR di server sesuai kebutuhan protokol.

## Lisensi & Catatan

Kode frontend ini mematuhi protokol yang diharapkan oleh backend. Pastikan endpoint backend kompatibel dengan event yang dijelaskan di atas. Jangan memutar audio otomatis pada event krisis—UI hanya menampilkan notifikasi.
