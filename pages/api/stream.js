const { Readable } = require("stream");
const { UA, REFERER } = require("../../lib/bilibili");

// Bilibili CDN mengecek header Referer, jadi browser nggak bisa fetch langsung.
// Route ini jadi jembatan: server yang fetch (pakai Referer yang benar), browser cuma nerima hasilnya.
const ALLOWED_HOST = /(^|\.)bilivideo\.com$|(^|\.)akamaized\.net$|(^|\.)mcdn\.bilivideo\.cn$/;

module.exports = async function handler(req, res) {
  const { url, filename } = req.query;
  if (!url) {
    return res.status(400).json({ error: "Query 'url' wajib diisi" });
  }

  let target;
  try {
    target = new URL(url);
  } catch (e) {
    return res.status(400).json({ error: "URL tidak valid" });
  }

  if (!ALLOWED_HOST.test(target.hostname)) {
    return res.status(400).json({ error: "Host di luar domain CDN Bilibili yang diizinkan" });
  }

  const upstream = await fetch(target.toString(), {
    headers: {
      "User-Agent": UA,
      Referer: REFERER,
      ...(req.headers.range ? { Range: req.headers.range } : {}),
    },
  });

  if (!upstream.ok && upstream.status !== 206) {
    return res.status(upstream.status).json({ error: `Upstream error ${upstream.status}` });
  }

  res.status(upstream.status);
  res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) res.setHeader("Content-Length", len);
  const cr = upstream.headers.get("content-range");
  if (cr) res.setHeader("Content-Range", cr);
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${(filename || "bilibili-download").replace(/["\n]/g, "")}"`
  );

  Readable.fromWeb(upstream.body).pipe(res);
};

// Streaming file gede lewat serverless function bisa mepet limit durasi/ukuran
// di paket Vercel Hobby. Kalau kepentok, pindahkan route ini ke Edge Runtime
// atau jalankan di server Node biasa (bukan serverless).
