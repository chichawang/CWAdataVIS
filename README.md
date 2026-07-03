# 直接使用連結 https://chichawang.github.io/CWAdataVIS/

# 氣象署 OPEN DATA 即時觀測資料地圖
以中央氣象署（CWA）開放資料呈現全臺測站即時觀測的互動式地圖。純前端單頁網頁（HTML + [Leaflet](https://leafletjs.com/)），無需後端伺服器。

## 功能特色
- **多種觀測變數**：氣溫、相對濕度、氣壓、風向風速（箭號圖示）、最大陣風、日最高／最低溫、日照時數、日射量，以及當前／1／3／6／12／24 小時累積雨量
- **雷達疊加圖層**：雷達整合回波（dBZ）與雷達估計降雨（QPESUMS，mm）可疊加於測站標示下層，透明度可調；游標移動或點擊（手機點按）即顯示該點經緯度與回波／雨量數值
- **氣象署相似色階**：雨量採 CWA 標準 17 級分級色階、溫度採 CWA 溫度分布圖 2℃ 分級色階，其餘變數為連續漸層色階
- **風場視覺化**：箭號指向風的去向，大小與顏色代表風速
- **縣市篩選與測站搜尋**：可依縣市縮放檢視，或以測站名稱／站號搜尋
- **五種底圖**：街道圖（OSM）、衛星影像、地形圖、深色圖
- **點選測站彈出詳細資訊**：整合氣象、雨量、日射量觀測於同一視窗
- **行動裝置友善**：控制面板、圖例與雷達控制盒皆可縮小／展開，窄螢幕自動縮小並限制面板寬度；控制面板可切換靠左／靠右（⇄ 按鈕，偏好自動記憶）；地圖放大時標示緩慢縮放避免重疊
- **金鑰安全**：API 授權碼僅儲存於使用者瀏覽器（localStorage，可選），不會上傳

## 資料來源
| 資料集 | 內容 | 介接方式 |
|---|---|---|
| [O-A0003-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0003-001) | 氣象站 10 分鐘綜觀氣象資料 | REST datastore API |
| [O-A0002-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0002-001) | 雨量站雨量資料 | REST datastore API |
| [O-A0091-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0091-001) | 署屬氣象站日射量資料（MJ/m²） | 檔案型 fileapi |
| [O-A0059-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0059-001) | 雷達整合回波網格（dBZ，921×921）） | 檔案型 fileapi |
| [O-B0045-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0045-001) |雷達估計降雨 QPESUMS 網格（mm，441×561） | 檔案型 fileapi |
| [O-A0001-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0001-001) | 自動氣象站逐時觀測資料（逐時地圖） | REST datastore API |

資料皆來自[中央氣象署氣象資料開放平臺](https://opendata.cwa.gov.tw/)。

## 使用方式
1. 至[氣象署開放資料平臺](https://opendata.cwa.gov.tw/user/authkey)免費註冊會員並取得 API 授權碼（格式 `CWA-XXXXXXXX-...`）
2. 開啟網頁https://chichawang.github.io/CWAdataVIS/ ，選擇「逐 10 分鐘觀測」或「逐時觀測 × 格點分析」地圖，輸入授權碼即可進入
3. 勾選「記住金鑰」可儲存於瀏覽器，下次直接載入

## 檔案結構
```
├── index.html                        # 首頁（入口連結，可選擇逐 10 分鐘或逐時地圖）
├── CWA_opendata_10min_display.html   # 逐 10 分鐘觀測地圖（單一檔案，含 HTML/CSS/JS）
├── CWA_opendata_hourly_display.html  # 逐時觀測 × 格點分析地圖（單一檔案，含 HTML/CSS/JS）
└── README.md
```

## 缺測值處理
依 CWA 資料標準，`X`（儀器故障）、`-99`（缺值或資料異常）等特殊代碼一律視為缺測，於地圖上以灰點呈現。

## 授權與致謝
- 氣象資料：中央氣象署氣象資料開放平臺（[政府資料開放授權條款](https://data.gov.tw/license)）
- 地圖圖磚：© OpenStreetMap contributors、Esri World Imagery、OpenTopoMap、CARTO
- 地圖套件：Leaflet 1.9.4
- 本文件權益為 AGPL-3.0 license
