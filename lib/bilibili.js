const crypto = require("crypto");

// Reference: SocialSisterYi/bilibili-API-collect, docs/misc/sign/wbi.md
const MIXIN_KEY_ENC_TAB = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const REFERER = "https://www.bilibili.com/";

const QUALITY_LABELS = {
  127: "8K",
  126: "Dolby Vision",
  125: "HDR",
  120: "4K",
  116: "1080P60",
  112: "1080P+",
  80: "1080P",
  74: "720P60",
  64: "720P",
  32: "480P",
  16: "360P",
};

function getMixinKey(orig) {
  return MIXIN_KEY_ENC_TAB.map((n) => orig[n])
    .join("")
    .slice(0, 32);
}

function encWbi(params, imgKey, subKey) {
  const mixinKey = getMixinKey(imgKey + subKey);
  const currTime = Math.round(Date.now() / 1000);
  const merged = { ...params, wts: currTime };
  const query = Object.keys(merged)
    .sort()
    .map((key) => {
      // wbi strips these chars from values before signing
      const value = String(merged[key]).replace(/[!'()*]/g, "");
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join("&");
  const wRid = crypto
    .createHash("md5")
    .update(query + mixinKey)
    .digest("hex");
  return `${query}&w_rid=${wRid}`;
}

async function biliFetch(url, cookie) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Referer: REFERER,
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Bilibili API returned ${res.status} for ${url}`);
  }
  return res.json();
}

async function getWbiKeys(cookie) {
  const json = await biliFetch(
    "https://api.bilibili.com/x/web-interface/nav",
    cookie
  );
  const { img_url, sub_url } = json.data.wbi_img;
  const imgKey = img_url.split("/").pop().split(".")[0];
  const subKey = sub_url.split("/").pop().split(".")[0];
  return { imgKey, subKey };
}

function extractBvid(input) {
  const match = String(input).match(/BV[a-zA-Z0-9]{10}/);
  if (!match) return null;
  return match[0];
}

async function resolveVideo(input, cookie) {
  const bvid = extractBvid(input);
  if (!bvid) {
    throw new Error("URL atau BVID tidak valid — pastikan mengandung kode BV...");
  }

  const viewJson = await biliFetch(
    `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`,
    cookie
  );
  if (viewJson.code !== 0) {
    throw new Error(viewJson.message || "Gagal ambil info video");
  }
  const { cid, title, pic, duration, pages } = viewJson.data;

  const { imgKey, subKey } = await getWbiKeys(cookie);
  const signedQuery = encWbi(
    { bvid, cid, qn: 127, fnval: 4048, fnver: 0, fourk: 1 },
    imgKey,
    subKey
  );

  const playJson = await biliFetch(
    `https://api.bilibili.com/x/player/wbi/playurl?${signedQuery}`,
    cookie
  );
  if (playJson.code !== 0) {
    throw new Error(playJson.message || "Gagal ambil link stream");
  }

  const dash = playJson.data.dash;
  if (!dash) {
    // Video lama / live yang cuma punya format flv/mp4 progresif, bukan DASH
    const durl = playJson.data.durl || [];
    return {
      title,
      pic,
      duration,
      bvid,
      cid,
      partsCount: pages ? pages.length : 1,
      dashSupported: false,
      videoOptions: durl.map((d, i) => ({
        id: i,
        label: QUALITY_LABELS[playJson.data.quality] || `Quality ${playJson.data.quality}`,
        url: d.url,
        size: d.size,
      })),
      audioOptions: [],
    };
  }

  const videoOptions = dash.video.map((v) => ({
    id: v.id,
    label: QUALITY_LABELS[v.id] || `QN ${v.id}`,
    width: v.width,
    height: v.height,
    codecs: v.codecs,
    bandwidth: v.bandwidth,
    url: v.baseUrl,
  }));

  const audioOptions = (dash.audio || []).map((a) => ({
    id: a.id,
    label: `${Math.round(a.bandwidth / 1000)} kbps`,
    bandwidth: a.bandwidth,
    url: a.baseUrl,
  }));

  return {
    title,
    pic,
    duration,
    bvid,
    cid,
    partsCount: pages ? pages.length : 1,
    dashSupported: true,
    videoOptions,
    audioOptions,
  };
}

module.exports = { resolveVideo, biliFetch, UA, REFERER };
