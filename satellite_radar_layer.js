(function () {
"use strict";

const ARCHIVE = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/history/Observation/";
// 與十分鐘觀測頁的雷達整合回波使用相同的 5 dBZ 分級。
const COLORS = [
  [4,233,231], [1,159,244], [3,0,244], [2,253,2], [1,197,1], [0,142,0],
  [253,248,2], [229,188,0], [253,149,0], [253,0,0], [212,0,0], [188,0,0],
  [248,0,253], [152,84,198]
];
const STEP = 10 * 60 * 1000;
const MERCATOR_HEIGHT = 1400;

function parseRadar(xml, time) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const get = (node, name) => node?.getElementsByTagNameNS("*", name)[0];
  const params = get(doc, "parameterSet");
  const text = (node, name) => get(node, name)?.textContent.trim();
  const number = name => Number(text(params, name) || NaN);
  const nx = number("GridDimensionX");
  const ny = number("GridDimensionY");
  const west = number("StartPointLongitude");
  const south = number("StartPointLatitude");
  const step = number("GridResolution");
  const east = west + (nx - 1) * step;
  const north = south + (ny - 1) * step;
  if (text(doc, "dataid") !== "O-A0059-001" || Date.parse(text(params, "DateTime")) !== time ||
      !Number.isInteger(nx) || !Number.isInteger(ny) || nx < 2 || ny < 2 || nx * ny > 2000000 ||
      !(step > 0 && west >= -180 && east <= 180 && south >= -85 && north <= 85)) {
    throw new Error("雷達歷史檔的格點或觀測時間不符");
  }
  const samples = text(get(doc, "contents"), "content")?.split(",");
  if (samples?.length !== nx * ny) throw new Error("雷達歷史檔的格點數不符");
  return {nx, ny, west, south, east, north, step, samples};
}

function projectRadar({nx, ny, west, south, east, north, step, samples}) {
  const src = document.createElement("canvas");
  src.width = nx;
  src.height = ny;
  const ctx = src.getContext("2d");
  const pixels = ctx.createImageData(nx, ny);
  let hasEcho = false;
  for (let y = 0; y < ny; y++) {
    const sourceRow = (ny - 1 - y) * nx;
    for (let x = 0; x < nx; x++) {
      const token = samples[sourceRow + x];
      const value = token.trim() ? Number(token) : NaN;
      if (!Number.isFinite(value) || value < 0) continue;
      const color = COLORS[Math.min(COLORS.length - 1, Math.floor(value / 5))];
      const offset = (y * nx + x) * 4;
      pixels.data.set(color, offset);
      pixels.data[offset + 3] = 255;
      hasEcho = true;
    }
  }
  ctx.putImageData(pixels, 0, 0);

  // 格點由南往北排列，依 Web Mercator 的實際緯度逐列重採樣。
  const out = document.createElement("canvas");
  out.width = nx;
  out.height = MERCATOR_HEIGHT;
  const output = out.getContext("2d");
  output.imageSmoothingEnabled = false;
  const mercator = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
  const top = mercator(north);
  const bottom = mercator(south);
  for (let row = 0; row < out.height; row++) {
    const y = top + (row + 0.5) / out.height * (bottom - top);
    const lat = (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180 / Math.PI;
    const from = Math.max(0, Math.min(ny - 1, Math.round((north - lat) / step)));
    output.drawImage(src, 0, from, nx, 1, 0, row, nx, 1);
  }
  const image = new Image();
  image.src = out.toDataURL("image/png");
  return image.decode().then(() => ({image, bounds: [[south, west], [north, east]], hasEcho}));
}

async function fetchRadar(time, signal) {
  // 此產品的公開歷史檔名稱使用臺灣時間。
  const stamp = new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 16).replace(/\D/g, "");
  const response = await fetch(ARCHIVE + stamp + "compref_mosaic.xml", {
    signal: AbortSignal.any([signal, AbortSignal.timeout(20000)])
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("雷達歷史檔讀取失敗（HTTP " + response.status + "）");
  const xml = await response.text();
  if (signal.aborted) return null;
  return projectRadar(parseRadar(xml, time));
}

window.createSatelliteRadarLayer = function (map, $, formatTime, L = window.L) {
  const cache = new Map();
  let time = null;
  let request;
  let pending;
  let overlay;

  COLORS.toReversed().forEach((color, index) => {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.style.backgroundColor = "rgb(" + color.join(",") + ")";
    item.append(swatch, String((COLORS.length - 1 - index) * 5));
    $("radarLegend").append(item);
  });

  function opacity() {
    return Number($("radarOpacity").value) / 100;
  }
  async function load(selectedTime, controller) {
    try {
      const {signal} = controller;
      const frame = cache.get(selectedTime) || await fetchRadar(selectedTime, signal);
      if (signal.aborted) return;
      if (!frame) {
        $("radarStamp").textContent = "雷達　缺資料";
        $("radarStatus").textContent = formatTime(selectedTime) + " 無對應的雷達回波。";
        return;
      }
      cache.set(selectedTime, frame);
      if (cache.size > 8) cache.delete(cache.keys().next().value);
      overlay = L.imageOverlay(frame.image, frame.bounds, {pane: "radar", opacity: opacity(), interactive: false}).addTo(map);
      $("radarStamp").textContent = "雷達　" + formatTime(selectedTime);
      $("radarStatus").textContent = formatTime(selectedTime) + (frame.hasEcho ? " 已載入" : " 無可顯示的回波");
    } catch (error) {
      if (controller.signal.aborted) return;
      $("radarStamp").textContent = "雷達　載入失敗";
      $("radarStatus").textContent = (error instanceof TypeError ? "無法連線至雷達歷史檔" : error.message) + "。可按「更新雲圖」重試。";
    }
  }
  function update() {
    request?.abort();
    overlay?.remove();
    overlay = null;
    const enabled = $("radarOn").checked;
    $("radarScale").hidden = !enabled;
    $("radarControls").hidden = !enabled;
    $("radarStamp").hidden = !enabled || time == null;
    if (!enabled || time == null) {
      $("radarStatus").textContent = "取得有觀測時間的衛星影格後顯示。";
      return;
    }
    if (time % STEP !== 0) {
      $("radarStamp").textContent = "雷達　缺資料";
      $("radarStatus").textContent = formatTime(time) + " 無對應的雷達回波。";
      return;
    }
    $("radarStamp").textContent = "雷達　載入中…";
    $("radarStatus").textContent = "正在取得 " + formatTime(time) + " 的雷達回波…";
    const controller = new AbortController();
    request = controller;
    return load(time, controller);
  }
  function refreshLayer() { pending = update(); }
  $("radarOn").onchange = refreshLayer;
  $("radarOpacity").oninput = () => {
    $("radarOpacityValue").textContent = $("radarOpacity").value + "%";
    overlay?.setOpacity(opacity());
  };
  refreshLayer();
  return {
    setFrame(frameTime, refresh = false) {
      if (refresh) cache.clear();
      if (time === frameTime && !refresh) return pending;
      time = frameTime;
      refreshLayer();
      return pending;
    }
  };
};
})();
