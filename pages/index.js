import { useState } from "react";

function formatDuration(sec) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function safeFilename(title) {
  return (title || "video").replace(/[\\/:*?"<>|]/g, "").slice(0, 80);
}

export default function Home() {
  const [input, setInput] = useState("");
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [videoId, setVideoId] = useState(null);
  const [audioId, setAudioId] = useState(null);

  async function handleResolve(e) {
    e.preventDefault();
    setError("");
    setData(null);
    setLoading(true);
    try {
      const res = await fetch("/api/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, cookie: cookie || undefined }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal resolve video");
      setData(json);
      setVideoId(json.videoOptions?.[0]?.id ?? null);
      setAudioId(json.audioOptions?.[0]?.id ?? null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function streamLink(url, suffix, ext) {
    const filename = `${safeFilename(data?.title)}_${suffix}.${ext}`;
    return `/api/stream?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`;
  }

  const selectedVideo = data?.videoOptions?.find((v) => v.id === videoId);
  const selectedAudio = data?.audioOptions?.find((a) => a.id === audioId);

  return (
    <div className="wrap">
      <h1>Bilibili downloader</h1>
      <p className="sub">
        Tempel link atau BVID video Bilibili. Video dan audio diambil terpisah
        (format DASH bawaan Bilibili) lewat API resmi — bukan scraping halaman.
      </p>

      <form onSubmit={handleResolve}>
        <div className="field-row">
          <input
            type="text"
            placeholder="https://www.bilibili.com/video/BV1xx411c7mD atau BV1xx411c7mD"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" disabled={loading || !input}>
            {loading ? "Loading..." : "Cari"}
          </button>
        </div>

        <details className="advanced">
          <summary>Login opsional (buka resolusi 1080p ke atas)</summary>
          <input
            type="password"
            placeholder="Cookie SESSDATA"
            value={cookie}
            onChange={(e) => setCookie(e.target.value)}
            style={{ marginTop: 10, width: "100%" }}
          />
          <p className="hint">
            Tanpa login, Bilibili cuma kasih resolusi sampai 360p–480p. Kalau
            mau lebih tinggi, ambil nilai cookie <span className="mono">SESSDATA</span> dari
            akun Bilibili-mu sendiri (lewat devtools browser) dan tempel di sini.
            Nilai ini cuma dikirim per-request ke API Bilibili, tidak disimpan di server.
          </p>
        </details>
      </form>

      {error && <p className="error">{error}</p>}

      {data && (
        <div className="result">
          <div className="result-head">
            {data.pic && <img src={data.pic} alt="" referrerPolicy="no-referrer" />}
            <div>
              <h2>{data.title}</h2>
              <div className="meta mono">
                {formatDuration(data.duration)} · {data.bvid}
                {data.partsCount > 1 ? ` · ${data.partsCount} bagian` : ""}
              </div>
            </div>
          </div>

          {!data.dashSupported && (
            <>
              <p className="section-label">video ini cuma tersedia format gabungan (bukan DASH)</p>
              <div className="option-list">
                {data.videoOptions.map((v) => (
                  <div className="option-row" key={v.id}>
                    <span className="label">{v.label}</span>
                    <span className="detail mono">
                      {v.size ? `${Math.round(v.size / 1024 / 1024)} MB` : ""}
                    </span>
                    <a href={streamLink(v.url, v.label, "mp4")} download>
                      Download
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}

          {data.dashSupported && (
            <>
              <p className="section-label">resolusi video</p>
              <div className="option-list">
                {data.videoOptions.map((v) => (
                  <label className="option-row" key={v.id}>
                    <input
                      type="radio"
                      name="video"
                      checked={videoId === v.id}
                      onChange={() => setVideoId(v.id)}
                    />
                    <span className="label">{v.label}</span>
                    <span className="detail mono">
                      {v.width}×{v.height} · {v.codecs}
                    </span>
                    <a href={streamLink(v.url, v.label, "m4s")} download>
                      Download
                    </a>
                  </label>
                ))}
              </div>

              <p className="section-label">audio</p>
              <div className="option-list">
                {data.audioOptions.map((a) => (
                  <label className="option-row" key={a.id}>
                    <input
                      type="radio"
                      name="audio"
                      checked={audioId === a.id}
                      onChange={() => setAudioId(a.id)}
                    />
                    <span className="label">{a.label}</span>
                    <span className="detail"></span>
                    <a href={streamLink(a.url, a.label, "m4s")} download>
                      Download
                    </a>
                  </label>
                ))}
              </div>

              {selectedVideo && selectedAudio && (
                <div className="merge-note">
                  Video dan audio Bilibili memang kepisah (DASH). Download dua-duanya,
                  lalu gabungkan pakai ffmpeg:
                  <code>{`ffmpeg -i audio.m4s -i video.m4s -c copy ${safeFilename(data.title)}.mp4`}</code>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
