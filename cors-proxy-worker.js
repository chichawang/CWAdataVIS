/**
 * cors-proxy-worker.js — 給 CWAdataVIS 用的最小化 CORS 轉送 Worker
 *
 * 用途：data.gdex.ucar.edu（TIGGE CXML 颱風路徑預報）與
 *       isohe.ihmt.gov.tw（商港海氣象風力／潮位）都沒有回應
 *       Access-Control-Allow-Origin，瀏覽器端無法直接 fetch。
 *       這支 Worker 代為取檔並補上 CORS 標頭。
 *
 * 用法： https://<你的worker>.workers.dev/?url=<經過 encodeURIComponent 的目標網址>
 *
 * 部署（約 10 分鐘，免費方案每天 10 萬次請求）：
 *   1. 到 https://dash.cloudflare.com → 左側 Workers & Pages → Create → Start with Hello World
 *   2. 命名（例如 cwa-cors）→ Deploy
 *   3. 進入該 Worker → Edit code → 全選刪除 → 貼上本檔全部內容 → Deploy
 *   4. 複製上方網址（形如 https://cwa-cors.你的帳號.workers.dev）
 *   5. 貼進 typhoon_NWP_ensemble_display.html 左側「資料來源 / CORS」欄位，
 *      以及 CWA_opendata_marine_display.html 頂端的「CORS 轉送網址」欄位
 *      → 儲存 → 測試連線
 *
 * 安全性：只轉送 ALLOW_HOSTS 白名單內的網域，避免變成開放式代理被濫用。
 */

/* 允許轉送的目標主機 */
const ALLOW_HOSTS = [
  "data.gdex.ucar.edu",
  "rda.ucar.edu",
  "thredds.ucar.edu",
  // 港灣環境資訊網（商港海氣象風力／潮位）— 實測不回應 Access-Control-Allow-Origin，
  // 必須經本 Worker 轉送，供 CWA_opendata_marine_display.html 使用
  "isohe.ihmt.gov.tw"
];

/* 允許呼叫這支 Worker 的來源；設為 null 代表不限制（回 *） */
const ALLOW_ORIGINS = null;
// 若只想給自己的站台用，改成例如：
// const ALLOW_ORIGINS = ["https://chichawang.github.io", "http://localhost:8000"];

const MAX_BYTES = 200 * 1024 * 1024;   // 上限 200 MB，防止誤用
const CACHE_TTL = 900;                 // 邊緣快取 15 分鐘（同一報時的檔案不會變）

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return withCORS(new Response(null, { status: 204 }), origin);
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
      return withCORS(text("只支援 GET / HEAD", 405), origin);
    }

    const reqUrl = new URL(request.url);

    // 首頁：簡單說明，方便確認部署成功
    if (!reqUrl.searchParams.has("url")) {
      return withCORS(
        text(
          "CWAdataVIS CORS proxy — OK\n\n" +
          "用法: " + reqUrl.origin + "/?url=<encodeURIComponent 後的網址>\n\n" +
          "允許的主機:\n  " + ALLOW_HOSTS.join("\n  ") + "\n",
          200
        ),
        origin
      );
    }

    const target = reqUrl.searchParams.get("url");
    let t;
    try {
      t = new URL(target);
    } catch {
      return withCORS(text("url 參數不是合法網址", 400), origin);
    }
    if (t.protocol !== "https:" && t.protocol !== "http:") {
      return withCORS(text("僅支援 http/https", 400), origin);
    }
    if (!ALLOW_HOSTS.includes(t.hostname)) {
      return withCORS(
        text("主機不在白名單內: " + t.hostname + "\n可於 ALLOW_HOSTS 自行新增。", 403),
        origin
      );
    }

    let upstream;
    try {
      upstream = await fetch(t.toString(), {
        method: request.method,
        redirect: "follow",
        headers: {
          // 不轉送瀏覽器原始標頭，避免帶上 Origin / Cookie 造成上游行為改變
          "User-Agent": "CWAdataVIS-cors-proxy/1.0 (+https://github.com/chichawang/CWAdataVIS)",
          "Accept": "*/*"
        },
        cf: { cacheTtl: CACHE_TTL, cacheEverything: true }
      });
    } catch (e) {
      return withCORS(text("上游取檔失敗: " + (e && e.message), 502), origin);
    }

    if (!upstream.ok) {
      return withCORS(
        text("上游回應 HTTP " + upstream.status + " — " + t.pathname, upstream.status),
        origin
      );
    }

    const len = parseInt(upstream.headers.get("Content-Length") || "0", 10);
    if (len && len > MAX_BYTES) {
      return withCORS(text("檔案超過上限 (" + len + " bytes)", 413), origin);
    }

    // 重點：不要動 body。JMA 的 .xml.gz 必須以原始位元組送回，
    // 由前端的 DecompressionStream 解壓；此處若誤設 Content-Encoding
    // 會讓瀏覽器提前解壓或解壓失敗。
    const headers = new Headers();
    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || "application/octet-stream"
    );
    const cl = upstream.headers.get("Content-Length");
    if (cl) headers.set("Content-Length", cl);
    headers.set("Cache-Control", "public, max-age=" + CACHE_TTL);
    headers.set("X-Proxied-From", t.hostname);

    return withCORS(
      new Response(upstream.body, { status: 200, headers }),
      origin
    );
  }
};

/* ── helpers ── */
function text(msg, status) {
  return new Response(msg, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" }
  });
}

function withCORS(res, origin) {
  const h = new Headers(res.headers);
  let allow = "*";
  if (ALLOW_ORIGINS) {
    allow = ALLOW_ORIGINS.includes(origin) ? origin : "null";
    h.set("Vary", "Origin");
  }
  h.set("Access-Control-Allow-Origin", allow);
  h.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
  h.set("Access-Control-Allow-Headers", "*");
  h.set("Access-Control-Max-Age", "86400");
  h.set("Access-Control-Expose-Headers", "Content-Length, Content-Type, X-Proxied-From");
  return new Response(res.body, { status: res.status, headers: h });
}
