(function () {
"use strict";

// History API 會轉址到公開檔案。物件名稱使用 UTC，檔案本身支援跨來源讀取。
const ARCHIVE = "https://cwaopendata.s3.ap-northeast-1.amazonaws.com/history/Observation/";
const TEMP_LEVELS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37];
const TEMP_COLORS = [[0,150,160],[0,188,196],[0,206,168],[86,216,128],[0,176,80],
  [90,205,75],[150,218,95],[200,233,135],[228,243,170],[245,248,195],[252,247,180],
  [254,240,140],[255,225,100],[255,205,65],[255,170,40],[255,135,20],[245,70,28],
  [220,18,18],[165,0,0],[165,0,165]];
const RAIN_LEVELS = [1, 2, 6, 10, 15, 20, 30, 40, 50, 70, 90, 110, 130, 150, 200, 300];
const RAIN_COLORS = [[193,193,193],[155,255,255],[0,207,255],[1,152,255],[1,101,255],
  [48,153,1],[50,255,0],[248,255,0],[255,203,0],[255,154,0],[250,3,0],[204,0,3],
  [160,0,0],[152,0,154],[195,4,204],[248,5,243],[254,203,255]];
const WIND_RAMP = [[0,"#edf8fb"],[3,"#b2e2e2"],[6,"#66c2a4"],[10,"#2ca25f"],[15,"#006d2c"],[25,"#e31a1c"]];
const WIND_DIRECTIONS = ["北", "東北", "東", "東南", "南", "西南", "西", "西北"];
const VARIABLES = [
  {label: "氣溫", unit: "°C", path: "AirTemperature", valid: [-30, 55], levels: TEMP_LEVELS, colors: TEMP_COLORS},
  {label: "相對濕度", unit: "%", path: "RelativeHumidity", valid: [0, 100], ramp: [[20,"#fff7bc"],[50,"#7fcdbb"],[75,"#41b6c4"],[90,"#225ea8"],[100,"#081d58"]]},
  {label: "測站氣壓", unit: "hPa", path: "AirPressure", valid: [500, 1100], ramp: [[980,"#5e4fa2"],[1000,"#3288bd"],[1010,"#abdda4"],[1015,"#fee08b"],[1025,"#f46d43"],[1040,"#9e0142"]]},
  {label: "風速", unit: "m/s", path: "WindSpeed", valid: [0, 120], ramp: WIND_RAMP},
  {label: "風向", unit: "°", path: "WindDirection", valid: [0, 360],
    ramp: [[0,"#4575b4"],[90,"#91bfdb"],[180,"#fee090"],[270,"#fc8d59"],[360,"#4575b4"]]},
  {label: "最大陣風", unit: "m/s", path: "GustInfo/PeakGustSpeed", valid: [0, 120], ramp: WIND_RAMP},
  {label: "當日累積雨量", unit: "mm", path: "Now/Precipitation", valid: [0, 1500], levels: RAIN_LEVELS, colors: RAIN_COLORS, rain: true},
  {label: "當日最高溫", unit: "°C", path: "DailyExtreme/DailyHigh/TemperatureInfo/AirTemperature", valid: [-30, 55], levels: TEMP_LEVELS, colors: TEMP_COLORS},
  {label: "當日最低溫", unit: "°C", path: "DailyExtreme/DailyLow/TemperatureInfo/AirTemperature", valid: [-30, 55], levels: TEMP_LEVELS, colors: TEMP_COLORS}
];
const WIND_SPEED_INDEX = VARIABLES.findIndex(variable => variable.path === "WindSpeed");
const WIND_DIRECTION_INDEX = VARIABLES.findIndex(variable => variable.path === "WindDirection");
const RAIN_VARIABLES = [
  ["Past10Min", "近 10 分鐘雨量"],
  ["Past1hr", "近 1 小時雨量"],
  ["Past3hr", "近 3 小時雨量"],
  ["Past6hr", "近 6 小時雨量"],
  ["Past12hr", "近 12 小時雨量"],
  ["Past24hr", "近 24 小時雨量"],
  ["Now", "當日累積雨量"],
  ["Past2days", "昨日至今累積"],
  ["Past3days", "前日至今累積"]
].map(([period, label]) => ({
  label, unit: "mm", path: period + "/Precipitation",
  valid: [0, Infinity], levels: RAIN_LEVELS, colors: RAIN_COLORS, rain: true
}));
const DATASETS = {
  station: {
    id: "O-A0001-001", file: "QPESUMS_AUTO_STATION", element: "WeatherElement",
    step: 60 * 60 * 1000, variables: VARIABLES, label: "整點自動觀測站", description: "整點自動觀測站"
  },
  rain: {
    id: "O-A0002-001", file: "QPESUMS_GAUGE", element: "RainfallElement",
    step: 10 * 60 * 1000, variables: RAIN_VARIABLES, label: "自動雨量站", description: "自動雨量站"
  }
};
function child(node, name) {
  return node && Array.from(node.children).find(element => element.localName === name);
}
function field(node, path) {
  for (const part of path.split("/")) node = child(node, part);
  return node?.textContent.trim() || "";
}
function numeric(text) {
  return text && Number.isFinite(Number(text)) ? Number(text) : NaN;
}
function parseStations(xml, time, dataset) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const root = doc.documentElement;
  if (root.localName !== "cwaopendata" || field(root, "dataid") !== dataset.id) {
    throw new Error("歷史檔格式不符");
  }
  const stations = [];
  for (const station of child(root, "dataset")?.children || []) {
    if (station.localName !== "Station" || Date.parse(field(station, "ObsTime/DateTime")) !== time) continue;
    const geo = child(station, "GeoInfo");
    const coordinates = Array.from(geo?.children || []).find(node =>
      node.localName === "Coordinates" && field(node, "CoordinateName") === "WGS84");
    const lon = numeric(field(coordinates, "StationLongitude"));
    const lat = numeric(field(coordinates, "StationLatitude"));
    if (!(lon >= 116 && lon <= 124 && lat >= 20 && lat <= 27)) continue;
    const observations = child(station, dataset.element);
    const values = dataset.variables.map(variable => {
      const text = field(observations, variable.path);
      const value = variable.rain && (text === "T" || text === "-98") ? 0 : numeric(text);
      return value >= variable.valid[0] && value <= variable.valid[1] ? value : null;
    });
    stations.push({
      lon, lat, name: field(station, "StationName"), id: field(station, "StationId"), values,
      location: [field(geo, "CountyName"), field(geo, "TownName")].filter(Boolean).join(" "),
      altitude: numeric(field(geo, "StationAltitude")),
      weather: field(observations, "Weather"),
      gustTime: field(observations, "GustInfo/Occurred_at/DateTime"),
      gustDirection: numeric(field(observations, "GustInfo/Occurred_at/WindDirection")),
      highTime: field(observations, "DailyExtreme/DailyHigh/TemperatureInfo/Occurred_at/DateTime"),
      lowTime: field(observations, "DailyExtreme/DailyLow/TemperatureInfo/Occurred_at/DateTime")
    });
  }
  return stations;
}
async function fetchStations(time, dataset) {
  const timestamp = new Date(time).toISOString().slice(0, 16).replace(/\D/g, "");
  const response = await fetch(ARCHIVE + timestamp + "." + dataset.file + ".10M.xml", {
    signal: AbortSignal.timeout(12000)
  });
  if (response.status === 404) return [];
  if (!response.ok) throw new Error("歷史檔讀取失敗（HTTP " + response.status + "）");
  return parseStations(await response.text(), time, dataset);
}

function colorFor(variable, value) {
  if (variable.levels) {
    const next = variable.levels.findIndex(level => value < level);
    return "rgb(" + variable.colors[next < 0 ? variable.levels.length : next].join(",") + ")";
  }
  const ramp = variable.ramp;
  const next = ramp.findIndex(stop => value <= stop[0]);
  if (next <= 0) return ramp[next < 0 ? ramp.length - 1 : 0][1];
  const [low, from] = ramp[next - 1];
  const [high, to] = ramp[next];
  const fraction = (value - low) / (high - low);
  const channels = [1, 3, 5].map(offset => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(a + (b - a) * fraction);
  });
  return "rgb(" + channels.join(",") + ")";
}

const historyCache = {station: new Map(), rain: new Map()};
function getHistory(time, type) {
  const cache = historyCache[type];
  if (!cache.has(time)) {
    const pending = fetchStations(time, DATASETS[type]).then(stations => {
      if (!stations.length && cache.get(time) === pending) cache.delete(time);
      return stations;
    }, error => {
      if (cache.get(time) === pending) cache.delete(time);
      throw error;
    });
    cache.set(time, pending);
    if (cache.size > 16) cache.delete(cache.keys().next().value);
  }
  return cache.get(time);
}
function weatherText(station) {
  return station.weather && !/^(?:X|NA|N\/A|None|--|-[0-9.]+)$/i.test(station.weather) ? station.weather : "";
}
function weatherIcon(station, time) {
  const weather = weatherText(station);
  const hour = new Date(time + 8 * 3600000).getUTCHours();
  if (/雷/.test(weather)) return "⛈️";
  if (/雪|冰/.test(weather)) return "❄️";
  if (/雨/.test(weather)) return "🌧️";
  if (/霧|靄|霾/.test(weather)) return "🌫️";
  if (/陰|多雲/.test(weather)) return /多雲/.test(weather) && hour >= 6 && hour < 18 ? "⛅" : "☁️";
  if (/晴/.test(weather)) return hour >= 6 && hour < 18 ? "☀️" : "🌙";
  return "•";
}
function display(value, unit) {
  return value == null ? "—" : value + " " + unit;
}
function windIcon(direction, size, color) {
  const rotation = (direction + 180) % 360;
  return L.divIcon({
    className: "station-wind-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg viewBox="0 0 24 24" width="${size}" height="${size}" style="transform:rotate(${rotation}deg)" aria-hidden="true">
      <path d="M12 1 L19 16 L12 12.5 L5 16 Z" fill="${color}" stroke="#0b1220" stroke-width="1"/>
    </svg>`
  });
}
function weatherSummary(station) {
  const values = Object.fromEntries(VARIABLES.map((variable, index) => [variable.path, station.values[index]]));
  const direction = values.WindDirection;
  const compass = direction == null ? "" : WIND_DIRECTIONS[Math.round(direction / 45) % 8] + "風";
  const wind = values.WindSpeed === 0 ? "靜風" : [display(values.WindSpeed, "m/s"), compass].filter(Boolean).join(" · ");
  return [["氣溫", display(values.AirTemperature, "°C")], ["風況", wind],
    ["當日累積雨量", display(values["Now/Precipitation"], "mm")]];
}

function hasObservation(station, choice) {
  return choice === "overview"
    ? station.values.some(value => value != null) || !!weatherText(station)
    : station.values[Number(choice)] != null;
}

window.createSatelliteStationLayer = function (map, getElement, formatTime, type, paneName, L = window.L) {
  const dataset = DATASETS[type];
  const variables = dataset.variables;
  const $ = suffix => getElement(type + suffix);
  const markers = L.layerGroup().addTo(map);
  // SVG 僅在雨量站點上接收點擊，讓下層氣象站點仍可點選。
  // The upper rain pane must only receive events on its visible markers.
  // A full-map Canvas here intercepts clicks intended for weather stations below.
  const renderer = type === "rain" ? L.svg({pane: paneName}) : L.canvas({pane: paneName});
  const options = $("Var");
  const choices = variables.map((variable, index) => [
    String(index),
    variable.path === "WindSpeed" ? "風向＋風速（箭號，m/s）" : variable.label + "（" + variable.unit + "）"
  ]);
  if (type === "station") choices.unshift(["overview", "綜合天氣概況"]);
  for (const [value, caption] of choices) options.add(new Option(caption, value));
  if (type === "station") options.value = String(variables.findIndex(variable => variable.path === "AirTemperature"));
  let selectedTime = null;
  let version = 0;
  let pending;
  const status = message => { $("Status").textContent = message; };
  const stamp = message => { $("Stamp").textContent = dataset.label + "　" + message; };

  function drawLegend(variable, min, max) {
    const legend = $("Legend");
    const levels = [min, ...(variable.levels || variable.ramp.map(([value]) => value))
      .filter(value => value > min && value < max)];
    if (max > min) levels.push(max);
    const visible = levels.length > 8
      ? Array.from({length: 8}, (_, i) => levels[Math.round(i * (levels.length - 1) / 7)])
      : levels;
    for (const value of visible) {
      const item = document.createElement("span");
      const swatch = document.createElement("i");
      swatch.style.backgroundColor = colorFor(variable, value);
      item.append(swatch, String(Number(value.toFixed(1))));
      legend.append(item);
    }
    legend.title = variable.label + "（" + variable.unit + "）";
  }

  const markerRadius = () => Math.max(2.25, Math.min(5, (map.getZoom() - 2) * 0.7));
  map.on("zoomend", () => {
    const radius = markerRadius();
    markers.eachLayer(marker => marker.setRadius?.(radius));
  });

  function popup(station, time, paired) {
    const content = document.createElement("div");
    content.className = "station-popup";
    const title = document.createElement("h3");
    title.textContent = station.name + "（" + station.id + "）";
    content.append(title);
    const location = document.createElement("div");
    location.className = "observation-time";
    location.textContent = [station.location, station.altitude > -90 ? "海拔 " + station.altitude + " m" : ""]
      .filter(Boolean).join(" · ");
    content.append(location);

    const row = (parent, label, value) => {
      const line = document.createElement("div");
      line.className = "observation-row";
      const key = document.createElement("span");
      key.textContent = label;
      line.append(key, value);
      parent.append(line);
    };
    const formatEvent = value => {
      const stampTime = Date.parse(value);
      return Number.isFinite(stampTime) ? formatTime(stampTime) : "—";
    };
    function addObservations(parent, record, source, observationTime) {
      const info = DATASETS[source];
      const title = document.createElement("h4");
      title.textContent = (source === "station" ? "氣象觀測" : "雨量觀測") + " · " + info.id;
      const timestamp = document.createElement("div");
      timestamp.className = "observation-time";
      timestamp.textContent = formatTime(observationTime);
      parent.append(title, timestamp);
      if (source === "station") {
        const summary = document.createElement("div");
        summary.className = "observation-summary";
        row(summary, "天氣概況", weatherIcon(record, observationTime) + " " + (weatherText(record) || "—"));
        for (const [label, value] of weatherSummary(record)) row(summary, label, value);
        parent.append(summary);
      }
      info.variables.forEach((variable, index) => row(parent, variable.label, display(record.values[index], variable.unit)));
      if (source === "station") {
        row(parent, "陣風風向", display(record.gustDirection >= 0 && record.gustDirection <= 360 ? record.gustDirection : null, "°"));
        row(parent, "最大陣風時間", formatEvent(record.gustTime));
        row(parent, "最高溫時間", formatEvent(record.highTime));
        row(parent, "最低溫時間", formatEvent(record.lowTime));
      }
    }
    addObservations(content, station, type, time);
    const related = type === "station" ? "rain" : "station";
    const relatedDataset = DATASETS[related];
    const relatedTime = time;
    if (paired) addObservations(content, paired, related, relatedTime);
    else if (station.id && relatedTime % relatedDataset.step === 0) {
      const relatedContent = document.createElement("div");
      content.append(relatedContent);
      getHistory(relatedTime, related).then(stations => {
        const match = stations.find(record => record.id === station.id);
        if (match) addObservations(relatedContent, match, related, relatedTime);
      }).catch(() => {});
    }
    return content;
  }

  async function render(time, request) {
    try {
      const choice = options.value;
      const overview = choice === "overview";
      const index = overview ? 0 : Number(choice);
      const variable = variables[index];
      const windSpeedMode = variable.path === "WindSpeed";
      const windDirectionMode = variable.path === "WindDirection";
      const windMode = windSpeedMode || windDirectionMode;
      const otherType = type === "station" ? "rain" : "station";
      const otherChoice = getElement(otherType + "Var").value;
      // 3D rainfall is always its own column; do not hide paired rain gauges
      // or reduce their values to a weather station's outline.
      const canCombine = !L.rainColumn && getElement(otherType + "On").checked && time % DATASETS.station.step === 0;
      const [history, otherHistory] = await Promise.all([
        getHistory(time, type),
        canCombine ? getHistory(time, otherType).catch(() => []) : []
      ]);
      if (request !== version) return;
      if (!history.length) {
        status(formatTime(time) + " 無對應的" + dataset.description + "資料。");
        stamp(formatTime(time) + " 缺資料");
        return;
      }

      const stations = history.filter(station => hasObservation(station, choice));
      if (!stations.length) {
        status(formatTime(time) + " 無有效的" + variable.label + "觀測。");
        stamp(formatTime(time) + " 缺資料");
        return;
      }
      const radius = markerRadius();
      const values = stations.map(station => station.values[index]).filter(value => value != null);
      const related = new Map(otherHistory.filter(station => station.id && hasObservation(station, otherChoice))
        .map(station => [station.id, station]));
      let combined = 0;
      for (const station of stations) {
        const paired = related.get(station.id);
        if (paired) combined++;
        // 同站保留氣象站的座標與底色，外框呈現所選的雨量。
        if (paired && type === "rain") continue;
        const rainIndex = Number(otherChoice);
        const ring = paired ? colorFor(RAIN_VARIABLES[rainIndex], paired.values[rainIndex]) : null;
        const value = station.values[index];
        const color = value == null ? "#b7c4d2" : colorFor(variable, value);
        const coordinates = [station.lat, station.lon];
        let icon;
        const speed = windMode ? station.values[WIND_SPEED_INDEX] : null;
        const direction = windMode ? station.values[WIND_DIRECTION_INDEX] : null;
        if (overview) {
          icon = L.divIcon({
            className: "station-overview-marker", iconSize: [13, 13],
            html: weatherIcon(station, time)
          });
        } else if (windMode && direction != null && speed !== 0) {
          const size = windDirectionMode ? 24 : Math.max(16, Math.min(48, 16 + speed * 2.4));
          icon = windIcon(direction, size, color);
        }
        const marker = !overview && variable.rain && L.rainColumn
          ? L.rainColumn(coordinates, {pane: paneName, amount: value, fillColor: color, radius})
          : icon
          ? L.marker(coordinates, {pane: paneName, alt: station.name, icon}).on("add", event => {
            const element = event.target.getElement();
            if (overview) element.style.backgroundColor = color;
            if (ring) element.style.boxShadow = "0 0 0 2px " + ring;
          })
          : L.circleMarker(coordinates, {
            pane: paneName, renderer, radius, weight: ring ? 2 : 1, color: ring || "#10263b",
            fillColor: windDirectionMode && speed === 0 ? "#b7c4d2" : color, fillOpacity: 1
          });
        if (overview) marker.bindTooltip(() => {
          const tooltip = document.createElement("div");
          tooltip.textContent = [station.name, weatherText(station),
            ...weatherSummary(station).map(([label, value]) => label + " " + value)].filter(Boolean).join(" ｜ ");
          return tooltip;
        });
        marker.bindPopup(() => popup(station, time, paired), {
          className: "station-details-popup",
          maxHeight: 300
        }).addTo(markers);
      }
      if (windMode) {
        const hint = document.createElement("small");
        hint.className = "station-wind-hint";
        hint.textContent = windSpeedMode ? "箭頭指向風吹去的方向，大小與顏色代表風速。" : "箭頭指向風吹去的方向，顏色代表風的來向。";
        $("Legend").append(hint);
      }
      if (values.length) drawLegend(variable, Math.min(...values), Math.max(...values));
      if (!overview && variable.rain && L.rainColumn) {
        const hint = document.createElement('small');
        hint.className = 'station-wind-hint';
        hint.textContent = '柱高：1 mm = 500 m 視覺高度（非實際水深）；0 mm 顯示平面底座，缺值不繪製。';
        $("Legend").append(hint);
      }
      stamp(formatTime(time));
      status(formatTime(time) + " · " + stations.length + " 站" +
        (combined ? "（" + combined + " 站合併顯示）" : ""));
    } catch (error) {
      if (request !== version) return;
      markers.clearLayers();
      stamp("載入失敗");
      status((error instanceof TypeError ? "無法連線至氣象署歷史檔。" : error.message) + " 可按「更新雲圖」重試。");
    }
  }

  function schedule() {
    const request = ++version;
    markers.clearLayers();
    $("Legend").replaceChildren();
    const enabled = $("On").checked;
    $("Controls").hidden = !enabled;
    $("Stamp").hidden = !enabled || selectedTime == null;
    if (!enabled || selectedTime == null) {
      status("取得有觀測時間的衛星影格後顯示。");
      return;
    }
    if (selectedTime % dataset.step !== 0) {
      stamp(formatTime(selectedTime) + " 無同刻資料");
      status(formatTime(selectedTime) + " 無同時刻的" + dataset.description + "資料。");
      return;
    }
    stamp("載入中…");
    status("正在取得 " + formatTime(selectedTime) + " 的" + dataset.description + "資料…");
    return render(selectedTime, request);
  }
  function update() { pending = schedule(); }

  $("On").onchange = update;
  options.onchange = update;
  const otherType = type === "station" ? "rain" : "station";
  const updatePairing = () => {
    if (selectedTime != null && selectedTime % DATASETS.station.step === 0) update();
  };
  getElement(otherType + "On").addEventListener("change", updatePairing);
  getElement(otherType + "Var").addEventListener("change", updatePairing);
  update();
  return {
    setFrame(time, refresh = false) {
      if (refresh) historyCache[type].clear();
      if (time === selectedTime && !refresh) return pending;
      selectedTime = time;
      update();
      return pending;
    }
  };
};
})();
