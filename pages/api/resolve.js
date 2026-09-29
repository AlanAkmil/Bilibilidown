const { resolveVideo } = require("../../lib/bilibili");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { input, cookie } = req.body || {};
  if (!input) {
    return res.status(400).json({ error: "Field 'input' (URL atau BVID) wajib diisi" });
  }

  try {
    // cookie (SESSDATA) bersifat opsional, dikirim per-request, tidak pernah disimpan di server
    const result = await resolveVideo(input, cookie || undefined);
    return res.status(200).json(result);
  } catch (err) {
    return res.status(400).json({ error: err.message || "Terjadi kesalahan" });
  }
};
