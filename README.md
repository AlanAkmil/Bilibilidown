# Bilibili Downloader

Next.js app buat resolve video Bilibili jadi link video + audio terpisah (format DASH), lengkap dengan pilihan resolusi. Pakai API resmi Bilibili (WBI-signed), bukan scrape HTML.

## Cara kerja

1. `lib/bilibili.js` — sign request pakai algoritma WBI (referensi: `SocialSisterYi/bilibili-API-collect`), ambil `cid` dari `x/web-interface/view`, lalu ambil semua opsi stream dari `x/player/wbi/playurl` (`fnval=4048` = minta format DASH).
2. `pages/api/resolve.js` — endpoint yang dipanggil frontend, terima URL/BVID (+ cookie `SESSDATA` opsional buat unlock resolusi tinggi), balikin daftar resolusi video & bitrate audio.
3. `pages/api/stream.js` — proxy download. CDN Bilibili nolak request tanpa header `Referer` yang benar, jadi route ini yang fetch di server terus di-stream ke browser dengan `Content-Disposition: attachment`.
4. `pages/index.js` — UI: input link, radio pilih resolusi video & audio, tombol download masing-masing.

## Batasan penting

- **Tanpa login** Bilibili cuma ngasih maks ~360–480p. Untuk 1080p ke atas butuh cookie `SESSDATA` akun sendiri (field "Login opsional" di UI) — nggak disimpan di server, cuma diteruskan per-request.
- Video dan audio memang **selalu terpisah** di source-nya (arsitektur DASH Bilibili) — makanya ada catatan command `ffmpeg -i audio.m4s -i video.m4s -c copy output.mp4` di UI buat gabungin manual.
- Video lama / beberapa live replay kadang cuma nyedia format progresif (non-DASH) — kode udah handle fallback-nya (`dashSupported: false`), tapi cuma dapet satu file gabungan, gak ada pilihan resolusi banyak.
- Streaming file besar lewat Vercel serverless function bisa kena limit durasi/payload di paket Hobby. Kalau sering gagal buat video panjang/4K, pertimbangkan pindah `api/stream.js` ke Edge Runtime atau host terpisah.
- Ini murni pakai endpoint publik Bilibili — pastikan pemakaiannya sesuai ToS Bilibili dan hak cipta konten yang didownload.

## Jalanin lokal

```bash
npm install
npm run dev
```

## Deploy ke Vercel

Push ke GitHub repo, import di Vercel, deploy — nggak butuh env var apa pun (cookie diisi user langsung di UI kalau perlu).
