# 直接使用連結 https://chichawang.github.io/CWAdataVIS/

# 氣象署 × 環境部 × 水利署 OPEN DATA 觀測資料地圖集
以中央氣象署（CWA）、環境部（MOENV）與經濟部水利署（WRA）開放資料呈現全臺測站即時觀測的互動式地圖，另收錄整合全臺公開即時影像串流的影像地圖與河川水情地圖。純前端單頁網頁（HTML + [Leaflet](https://leafletjs.com/)），無需後端伺服器。

## 畫面預覽

![逐 10 分鐘觀測地圖](examples/10min.png)

## 首頁分頁結構
首頁（`index.html`）以**兩個頁簽**分區，所選頁簽會記錄於瀏覽器，下次開啟停留在同一分頁。

| 頁簽 | 收錄頁面 | 金鑰需求 |
|---|---|---|
| **氣象署觀測**（7 頁） | 逐 10 分鐘觀測、逐時觀測 × 格點分析、即時海象監控、地球物理觀測、地震即時監測、預報整合、數值預報模式（GFS／WRF） | 需 CWA API 授權碼 |
| **其他分頁**（5 頁） | 全球官方颱風路徑整合圖、NWP/MLWP 系集颱風路徑預報、台灣即時影像地圖、**水利署即時水位地圖**、環境部空氣品質監測地圖 | 颱風整合圖內建 CWA 示範授權碼、可自備 CWA API 授權碼；NWP/MLWP 系集颱風路徑、影像地圖與水利署水位地圖免金鑰；空品地圖需 MOENV API KEY（已內建預設金鑰） |

## 功能特色
- **多種觀測變數**：氣溫、相對濕度、氣壓、風向風速（箭號圖示）、最大陣風、日最高／最低溫、日照時數、日射量，以及當前／1／3／6／12／24 小時累積雨量
- **逐 10 分鐘觀測地圖為三圖合一**：除氣象署測站觀測外，同一頁面另整合**全臺 5,586 支即時影像鏡頭**與**水利署河川水位／地下水／IoW 物聯網感測器**七個圖層。兩組整合圖層皆**不需金鑰、預設關閉**，勾選後才載入（水情圖層一次會抓約 2.1 MB 的測站站況，故獨立節流為最快 5 分鐘更新一次，不跟著主圖的 2 分鐘排程重抓）
- **雷達疊加圖層**（10 分鐘地圖）：雷達整合回波（dBZ）與雷達估計降雨（QPESUMS，mm）可疊加於測站標示下層；透明度調整條位於圖層選單下方、僅在選取圖層時顯示；雷達圖層狀態與游標／點擊讀值（經緯度與回波／雨量數值）整合於右下圖例框
- **格點分析疊加圖層**（逐時地圖）：小時溫度分析與日累積雨量分析格點；透明度調整條位於圖層選單下方、僅在選取圖層時顯示；格點圖層狀態、色階與游標讀值整合於右下圖例框
- **衛星雲圖疊加圖層**（10 分鐘地圖）：高解析可見光、紅外線色調強化、紅外線彩色衛星雲圖，提供**臺灣**（橫麥卡托投影）與**東亞**（蘭伯特正形圓錐投影）兩種範圍，依 CWA 產品文件之投影參數逐像素反投影重採樣為 Web Mercator，海岸線對位準確；透明度調整條僅在選取雲圖時顯示
- **自動更新**：勾選後每 2 分鐘自動重新抓取所有已啟用圖層的資料，狀態列即時顯示下次更新倒數與最近更新時間；更新時不重置視角、不更動觀測變數／縣市／搜尋／圖層等使用者選擇（10 分鐘與逐時地圖皆支援）
- **觀測變數可選「無」**：隱藏所有測站點位與色階，便於單獨檢視雷達、格點、雲圖或颱風圖層
- **閃電落雷即時觀測**：KMZ（壓縮 KML）於瀏覽器端以 JSZip 解壓解析，標記顏色代表落雷距今時間（0–60 分鐘，越紅越新），並區分雲對地（落雷，實心）與雲間閃電（空心）
- **颱風路徑與侵襲機率**：熱帶氣旋過去路徑（依 CWA 強度分級上色：青=熱帶性低氣壓、黃綠=輕颱、橙=中颱、粉紅=強颱）、旋轉颱風符號、七級／十級風暴風半徑圈、白點預報路徑與 70% 路徑潛勢圓；120 小時暴風侵襲機率以 CWA 官方離散分級上色（深綠 10-20%→綠→黃→橙→紅 80%+）
- **海象監測點位**（逐時地圖）：大潮與長浪監測，依警戒狀態上色，測站座標優先取自海象測站基本資料
- **氣象署相似色階**：雨量採 CWA 標準 17 級分級色階、溫度採 CWA 溫度分布圖 2℃ 分級色階，其餘變數為連續漸層色階
- **風場視覺化**：箭號指向風的去向，大小與顏色代表風速
- **縣市篩選與測站搜尋**：可依縣市縮放檢視，或以測站名稱／站號搜尋
- **五種底圖**：街道圖（OSM）、衛星影像、地形圖、深色圖、淺色圖
- **點選測站彈出詳細資訊**：整合氣象、雨量、日射量觀測於同一視窗
- **行動裝置友善**：控制面板、圖例與圖層控制盒皆可縮小／展開，窄螢幕自動縮小並限制面板寬度；控制面板可切換靠左／靠右（⇄ 按鈕）；地圖放大時標示緩慢縮放避免重疊
- **海象自動監控儀表板**：提供資料浮標與潮位站的即時健康監控，具備 KPI 狀態卡（正常、延遲、離線、警報中）與警報日誌，點擊測站可載入並展示 48 小時內各海象觀測指標之歷史時序圖表（Chart.js）
- **地球物理觀測監控儀表板**：提供地球物理觀測資料（地磁、地電、電離層、地下水）之即時健康監控，具備 KPI 狀態卡（正常、延遲、離線、異常值）與警報日誌，點擊測站可載入並展示 48 小時內各變數指標之歷史時序圖表（Chart.js），並內建 JSON 結構診斷工具
- **數值預報模式（NWP）地圖**：全球模式 GFS（M-A0060，0.25°）與區域模式 WRF 15km（M-A0061）／WRF 3km（M-A0064）三合一，於瀏覽器端直接解析 GRIB2（支援 Simple／Complex／Spatial-Differencing 封裝，以及區域模式的 Lambert 正形圓錐網格逐像素重投影）。提供氣溫、海平面氣壓、相對濕度、風速/風向、累積降水，及 850／500／200 hPa 等高空場。特色包括：模式選單一鍵切換、預報時間軸（可播放動畫、點選時間即自動載入、切換時保留所選變數）、風格粒子流場動畫、海岸線／國界疊層強化海陸邊界、高空場自適應色階、常用氣象場建議選單、滑鼠懸停查值與颱風路徑／侵襲機率疊加。GRIB2 檔案較大（約 30–80 MB），首次載入約需 30–90 秒
- **預報整合地圖**（`CWA_forecast_display.html`，設計規劃見 `plan.md`）：以「圖層組合」模型將預報類開放資料整合於單一地圖——陸地底色（368 鄉鎮/22 縣市面量：溫度、體感、降雨機率、濕度、天氣現象、舒適度、UVI、風速，及熱傷害/冷傷害/溫差健康氣象指數）、海面底色（海面分區浪高/風級/天氣，分區為近似示意界線）、航線層（藍色公路 40 航線線色隨時間變化）、點位層（潮汐點漲退潮內插、14 類育樂景點「適遊燈號」規則引擎、海岸瘋狗浪風險、澎湖海水溫預警、海水浴場/休閒漁港/海釣點波流模式預報）、格點層（QPESUMS 未來 1 小時降雨預報）。共用一條 7 天 × 3 小時主時間軸（可播放動畫、各圖層就近對齊並於圖例標註實際有效時刻），點擊任一鄉鎮/海域/航線/點位開啟 Chart.js 時序圖彈窗；「疊加天氣現象圖示」依各縣市日出日沒時刻資料判斷晴天圖示顯示太陽（白天）或月亮（夜間）；右上「圖資與展望」抽屜提供一週天氣預測圖動畫、地面天氣圖、QPF、波浪圖、滿潮/海岸潮線影像圖與月/季長期展望、天氣概況文字；支援 URL hash 分享目前檢視狀態
- **全球官方颱風路徑整合圖**（`typhoon_multiofficialagency_display.html`，其他分頁）：彙整 CWA、JMA、JTWC、NHC、CMA、HKO、KMA 等官方氣象機構之熱帶氣旋預報路徑於同一張 Leaflet/OpenStreetMap 地圖，可切換全球/洋盆範圍、總覽全部系統或單一颱風，比較各機構預報路徑、發布時刻、預報時距與強度差異；支援歷史事件回顧、機構篩選、比較表、圖例與每 10 分鐘自動更新。頁面內建 CWA 開放資料平臺公開示範授權碼，亦可改填自己的 CWA API 授權碼
- **NWP/MLWP 系集颱風路徑預報**（`typhoon_NWP_ensemble_display.html`，其他分頁）：整合 TIGGE CXML 傳統數值預報模式（NWP）與 Google WeatherNext2 ATCF 機器學習天氣模式（MLWP）熱帶氣旋系集路徑，包含 ECMWF、NCEP GEFS、CMC CENS、BoM ACCESS-GE、KMA GEPS、JMA GEPS、UKMO MOGREPS 與 WeatherNext2。提供全球/洋盆篩選、單一系統或目前海域全部路徑顯示、系集成員義大利麵圖、集合平均、指定時效成員落點播放、侵襲機率場、中心氣壓/最大風速時序圖與 RWD 手機直橫式介面。頁面會以預設起報時間自動載入；不需 API 金鑰，但部分遠端資料可能受瀏覽器跨網域限制，可改用本機檔匯入
- **地震即時監測儀表板**（`CWA_opendata_earthquake_display.html`）：整合顯著有感地震報告（E-A0015-001）、小區域有感地震報告（E-A0016-001）與縣市鄉鎮觀測震度（E-A0015-005）三種資料的 3D 震源地圖（deck.gl + MapLibre GL）。震央圓圈、震源深度垂直線與沉於地下的震源球（顏色＝最大震度、大小＝規模、深度可 1–8 倍放大），支援 2D⇄3D 視角切換與五種底圖；地圖下方時間軸可拖曳回放、播放動畫或回到 LIVE 即時模式；右側為 KPI 摘要（顯示中事件、最大規模、24 小時內次數、最新事件）、事件詳情卡（各地區最大震度、測站 PGA/PGV 表、震度圖與報告連結）與最新地震列表（顯著/小區域標籤，點擊飛至震央）；點選顯著地震可疊加該事件之鄉鎮震度分布；每 60 秒自動更新，偵測到新報告即跳出通知、可開啟音效提醒；可篩選報告類型與規模下限
- **台灣即時影像地圖**（`台灣即時影像地圖.html`，其他分頁）：將全臺 **5,586 支公開即時影像鏡頭**整合於單一地圖，涵蓋 11 種來源分類、分屬三大分區——道路監視器（公路局省道交控 2,323 支、國道路況 1,899 支）、縣市監視（新北 CCTV 459 支、嘉義縣路況／公路監視 72 支）、其他監控（水利署河川監控 134 支、水利防災 125 支、水土保持 107 支、土石流監測 63 支、臺南水情 362 支、嘉義水情 42 支）。支援**即時快照／MJPEG、HLS 串流（Hls.js）、iframe 嵌入**三類影像型態並自動判斷；具備分區頁簽與分類 chips 篩選、鏡頭名稱／路線 autocomplete 搜尋、常用鏡頭收藏（localStorage）、切換底圖、定位目前位置與鏡頭資訊面板（可重新整理畫面、開新分頁、複製網址）。省道交控鏡頭可即時改抓公路局最新 CCTV 開放資料清單取代內建靜態快照。**本頁不需任何 API 金鑰**
- **環境部空氣品質監測地圖**（`MOENV_aqx_hourly_display.html`，其他分頁）：整合環境部環境資料開放平臺之空品監測資料。以**臺灣 AQI 六級標準色**呈現全臺測站，可切換 **19 種測項**——PM2.5／PM10／O₃／SO₂／NO₂／CO 依 AQI 濃度分級上色，另有 NO／NOx／CH₄／NMHC／THC，以及溫度、相對濕度、雨量、大氣壓力與風向風速（箭號圖示，區分小時值與即時值）。特色包括：**漸進式載入**（先以單一小型 AQI 請求上圖，測站詳細測項於背景補齊，不阻擋操作）、各空品區未來數日 **AQI 預報**卡、全臺極值統計、縣市與測站類型篩選、精簡分層式測站資訊視窗（重點置頂＋雙欄格線＋次要測項摺疊），並可疊加**河川揚塵監測**、**特殊性工業區監測**與**光化測站 50＋ 種 VOC 物種**三種點位圖層。點選測站可載入該站單站資料集（內建 77 站對照表），以 Chart.js 繪製近日逐時變化圖；光化測站可繪製單日 24 小時 VOC 物種變化曲線（依日均濃度排序物種）
- **水利署即時水位地圖**（`WRA_waterlevel_realtime_display.html`，其他分頁）：經濟部水利署開放資料整合圖，七個可疊加圖層——**河川即時水位**（857 站，依一／二／三級警戒水位分級上色，達警戒站加脈動外環）、**即時地下水位觀測井**（井位取自水利署地理資訊服務平台 KMZ，可看水位高程／埋深／井況），以及智慧防汛物聯網（IoW）的**淹水深度**、**揚塵 PM10**、**閘門相關監測**、**沖刷深度**、**累計流量（雨水貯留）**五種感測器。支援縣市→水系→河川三層連動篩選、站名／站號／地址搜尋、只顯示達警戒測站、隱藏逾時未更新的感測器，並以 URL hash 保存目前圖層與篩選狀態。測站站況與井位清冊於瀏覽器快取 24 小時，只有即時值每次重抓。**本頁不需任何 API 金鑰**
- **金鑰安全**：CWA 系列頁面與環境部空品地圖進入前皆須輸入 API 金鑰（空品地圖已內建預設金鑰可直接進入）；金鑰僅儲存於使用者瀏覽器（localStorage，可選「記住金鑰」），不會上傳。台灣即時影像地圖不需金鑰

## 資料來源

### 中央氣象署（CWA）氣象資料開放平臺
| 資料集 | 內容 | 介接方式 |
|---|---|---|
| [O-A0003-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0003-001) | 氣象站 10 分鐘綜觀氣象資料 | REST datastore API |
| [O-A0002-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0002-001) | 雨量站雨量資料 | REST datastore API |
| [O-A0001-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0001-001) | 自動氣象站逐時觀測資料 | REST datastore API |
| [O-A0091-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0091-001) | 署屬氣象站日射量資料（MJ/m²） | 檔案型 fileapi（JSON） |
| [O-A0059-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0059-001) | 雷達整合回波網格（dBZ，921×921） | 檔案型 fileapi（JSON） |
| [O-B0045-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0045-001) | 雷達估計降雨 QPESUMS 網格（mm，441×561） | 檔案型 fileapi（JSON） |
| [O-B0054-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0054-001) | 對流胞即時監測（圖像產品，可與雷達回波同時疊加） | 檔案型 fileapi（JSON → 圖檔） |
| [O-A0038-003](https://opendata.cwa.gov.tw/dataset/observation/O-A0038-003) | 小時溫度分析格點（0.03°，67×120） | 檔案型 fileapi（JSON） |
| [O-A0040-004](https://opendata.cwa.gov.tw/dataset/observation/O-A0040-004) | 日累積雨量分析格點 | 檔案型 fileapi（JSON） |
| [O-A0039-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0039-001) | 閃電落雷系統即時觀測資料 | 檔案型 fileapi（KMZ，JSZip 解壓） |
| [O-C0042-008](https://opendata.cwa.gov.tw/dataset/observation/O-C0042-008) | 高解析可見光衛星雲圖-臺灣（橫麥卡托投影） | 檔案型 fileapi（JSON → 圖檔） |
| [O-C0042-006](https://opendata.cwa.gov.tw/dataset/observation/O-C0042-006) | 高解析紅外線色調強化衛星雲圖-臺灣 | 檔案型 fileapi（JSON → 圖檔） |
| [O-C0042-002](https://opendata.cwa.gov.tw/dataset/observation/O-C0042-002) | 高解析紅外線彩色衛星雲圖-臺灣 | 檔案型 fileapi（JSON → 圖檔） |
| [O-B0032-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0032-001) | 高解析可見光衛星雲圖-東亞（蘭伯特正形圓錐投影） | 檔案型 fileapi（JSON → 圖檔） |
| [O-B0032-004](https://opendata.cwa.gov.tw/dataset/observation/O-B0032-004) | 高解析紅外線色調強化衛星雲圖-東亞 | 檔案型 fileapi（JSON → 圖檔） |
| [O-B0032-002](https://opendata.cwa.gov.tw/dataset/observation/O-B0032-002) | 高解析紅外線彩色衛星雲圖-東亞 | 檔案型 fileapi（JSON → 圖檔） |
| [O-B0055-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0055-001) | 高解析可見光反照率-東亞（GeoTIFF） | 檔案型 fileapi（JSON → GeoTIFF，geotiff.js 前端解析） |
| [O-B0056-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0056-001) | 高解析紅外線亮度溫度-東亞（GeoTIFF，K） | 檔案型 fileapi（JSON → GeoTIFF，geotiff.js 前端解析） |
| [W-C0034-005](https://opendata.cwa.gov.tw/dataset/warning/W-C0034-005) | 颱風消息與警報-熱帶氣旋路徑 | REST datastore API |
| [W-C0034-003](https://opendata.cwa.gov.tw/dataset/warning/W-C0034-003) | 颱風消息與警報-颱風侵襲機率 | 檔案型 fileapi（KMZ，JSZip 解壓） |
| [O-B0069-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0069-001) | 大潮監測 | 檔案型 fileapi（JSON） |
| [O-B0070-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0070-001) | 長浪監測 | 檔案型 fileapi（JSON） |
| [O-B0075-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0075-001) | 海象自動監控觀測資料 | REST datastore API |
| [O-B0076-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0076-001) | 海象自動監控測站基本資料 | 檔案型 fileapi（JSON） |
| [O-B0065-001](https://opendata.cwa.gov.tw/dataset/observation/O-B0065-001) | 地球物理連續觀測地下水資料 | 檔案型 fileapi（JSON） |
| [O-B0065-002](https://opendata.cwa.gov.tw/dataset/observation/O-B0065-002) | 地球物理連續觀測地磁資料 | 檔案型 fileapi（JSON） |
| [O-B0065-003](https://opendata.cwa.gov.tw/dataset/observation/O-B0065-003) | 地球物理連續觀測地電資料 | 檔案型 fileapi（JSON） |
| [O-B0065-004](https://opendata.cwa.gov.tw/dataset/observation/O-B0065-004) | 地球物理連續觀測電離層資料 | 檔案型 fileapi（JSON） |
| [O-A0043-001](https://opendata.cwa.gov.tw/dataset/observation/O-A0043-001) | 向日葵九號衛星頻道03反射率（HDF，實驗性，預設隱藏） | 檔案型 fileapi（JSON → HDF，h5wasm 解析） |
| [M-A0060](https://opendata.cwa.gov.tw/dataset/all/M-A0060-000) | 全球預報模式 GFS（0.25° 經緯度網格，預報至 +384h／間隔 6h） | 檔案型 fileapi（JSON → GRIB2，前端解析） |
| [M-A0061](https://opendata.cwa.gov.tw/dataset/all/M-A0061-000) | 區域預報模式 WRF 15km（Lambert 正形圓錐網格，預報至 +84h／間隔 6h） | 檔案型 fileapi（JSON → GRIB2，前端解析） |
| [M-A0064](https://opendata.cwa.gov.tw/dataset/all/M-A0064-000) | 區域預報模式 WRF 3km（Lambert 正形圓錐網格） | 檔案型 fileapi（JSON → GRIB2，前端解析） |
| [M-B0071](https://opendata.cwa.gov.tw/dataset/all/M-B0071-000) | 海流數值模式（NetCDF-4／HDF5，jsfive 前端解析） | 檔案型 fileapi |
| [A-B0062-001](https://opendata.cwa.gov.tw/dataset/all/A-B0062-001) | 日出日沒時刻－全臺各縣市年度逐日資料（供天氣現象圖示日／夜判斷） | 檔案型 fileapi（JSON） |
| [M-A0085-001](https://opendata.cwa.gov.tw/dataset/all/M-A0085-001) | 熱傷害指數及警示－全臺各鄉鎮五日逐三小時預報（預報整合地圖） | 檔案型 fileapi（JSON） |
| [M-B0078-001](https://opendata.cwa.gov.tw/dataset/all/M-B0078-001) | 海水浴場、休閒漁港、海釣之波流模式預報資料（預報整合地圖） | 檔案型 fileapi（JSON） |
| [E-A0015-001](https://opendata.cwa.gov.tw/dataset/earthquake/E-A0015-001) | 顯著有感地震報告（震央、規模、深度、各地測站震度與 PGA/PGV） | REST datastore API |
| [E-A0015-005](https://opendata.cwa.gov.tw/dataset/earthquake/E-A0015-005) | 顯著有感地震報告－縣市行政區（鄉鎮）觀測震度資料 | 檔案型 fileapi（JSON） |
| [E-A0016-001](https://opendata.cwa.gov.tw/dataset/earthquake/E-A0016-001) | 小區域有感地震報告（不編號地震） | REST datastore API |

### 中央氣象署（CWA）預報類資料集（預報整合地圖）
`CWA_forecast_display.html` 以「圖層組合」模型整合下列預報類資料集，多數為**同一家族、一個編號對應一個縣市／航線／景點類別**，故以家族為單位列出；完整編號對照見頁面內 `DS` / `LEISURE_CATS` / `BLUE_ROUTES` / `IMG_SETS` 設定區與 `plan.md`。

| 資料集家族 | 內容 | 介接方式 |
|---|---|---|
| [F-D0047](https://opendata.cwa.gov.tw/dataset/forecast/F-D0047-089) 系列（47 個編號） | 鄉鎮天氣預報：全臺鄉鎮未來 3 天逐 3 小時（-089）、未來 1 週（-091）、各縣市鄉鎮分頁預報、鄉鎮沿海 3 天逐 3 小時（-095） | REST ＋ 檔案型 fileapi |
| [F-C0032](https://opendata.cwa.gov.tw/dataset/forecast/F-C0032-001) 系列（24 個編號） | 縣市天氣預報：22 縣市 36 小時（-001）、各縣市「天氣小幫手」（-009～-030）、全臺天氣小幫手（-031，縣市查無資料時備援） | REST ＋ fileapi |
| [F-B0053](https://opendata.cwa.gov.tw/dataset/forecast/F-B0053-005) 系列（28 個編號） | 14 類育樂景點天氣預報（海水浴場、單車、農場旅遊等），各類別皆有「三天逐 3 小時」與「一週日夜」兩個編號 | 檔案型 fileapi |
| [F-A0037](https://opendata.cwa.gov.tw/dataset/forecast/F-A0037-001) 系列（42 個編號） | 藍色公路（客輪航線）天氣預報，一個編號對應一條航線 | 檔案型 fileapi |
| [F-C0035](https://opendata.cwa.gov.tw/dataset/forecast/F-C0035-001) 系列（18 個編號） | 天氣圖資影像：一週天氣預測圖（第 0～7 天）、地面天氣圖、QPF、波浪分析／預報圖 | fileapi → ProductURL 圖檔 |
| [F-A0022](https://opendata.cwa.gov.tw/dataset/forecast/F-A0022-001) 系列（7 個編號） | 滿潮預報影像圖（今日～第 7 天） | fileapi → 圖檔 |
| [F-B0068](https://opendata.cwa.gov.tw/dataset/forecast/F-B0068-001) -001～-004 | 海岸潮線預報圖（彰化、雲林、嘉義、臺南，每 6 小時） | fileapi → 圖檔 |
| [F-B0083](https://opendata.cwa.gov.tw/dataset/forecast/F-B0083-001) 系列（7 個編號） | 海岸異常波浪（瘋狗浪）發生風險 12／18／24 小時，及異常波浪潛勢風險海域格點（0.25°，第 00／24／36／48 小時） | 檔案型 fileapi |
| [F-A0085](https://opendata.cwa.gov.tw/dataset/forecast/F-A0085-002) -002～-005 | 健康氣象：冷傷害與溫差指數（五日、72 小時逐 3 小時） | REST datastore API |
| [F-A0012-001](https://opendata.cwa.gov.tw/dataset/forecast/F-A0012-001) | 海面天氣預報（海面分區浪高／風級／天氣） | 檔案型 fileapi |
| [F-A0021-001](https://opendata.cwa.gov.tw/dataset/forecast/F-A0021-001) | 未來 1 個月潮汐預報（潮汐點漲退潮內插） | REST datastore API |
| [F-A0089-001](https://opendata.cwa.gov.tw/dataset/forecast/F-A0089-001) | 海象暴潮預報（觀測水位／預報水位） | 檔案型 fileapi（KMZ） |
| [F-B0046-001](https://opendata.cwa.gov.tw/dataset/forecast/F-B0046-001) | QPESUMS 未來 1 小時降雨預報格點 | 檔案型 fileapi（格點） |
| [F-B0066-001](https://opendata.cwa.gov.tw/dataset/forecast/F-B0066-001) | 澎湖海水溫預警 | 檔案型 fileapi |
| [F-C0044-001](https://opendata.cwa.gov.tw/dataset/forecast/F-C0044-001) | 臺灣天氣概況（文字） | 檔案型 fileapi |
| [F-A0013-001 / -002](https://opendata.cwa.gov.tw/dataset/forecast/F-A0013-001) | 長期展望（月／季） | 檔案型 fileapi |
| [W-C0033-001 / -002](https://opendata.cwa.gov.tw/dataset/warning/W-C0033-001) | 天氣特報－縣市警特報 | REST datastore API |
| [W-C0033-003～-006](https://opendata.cwa.gov.tw/dataset/warning/W-C0033-003) | 天氣特報－CAP 格式鄉鎮生效範圍 | 檔案型 fileapi |

### 環境部（MOENV）環境資料開放平臺
`MOENV_aqx_hourly_display.html` 使用之資料集，皆以 REST API v2（`https://data.moenv.gov.tw/api/v2/{資料集}?api_key=...`）介接，支援 `fields` 欄位篩選、`filters` 條件過濾與 `sort` 排序參數以縮減傳輸量。

| 資料集 | 內容 | 說明 |
|---|---|---|
| [aqx_p_432](https://data.moenv.gov.tw/dataset/detail/AQX_P_432) | 空氣品質指標（AQI） | 各站即時 AQI、狀態、主要污染物與 O₃ 8hr／CO 8hr／PM 移動平均；**自帶經緯度**，為漸進式載入之第一階段來源 |
| [aqx_p_133](https://data.moenv.gov.tw/dataset/detail/AQX_P_133) | 縣市（直轄市）小時值－每小時 | 依測項逐時值（一列＝單站／單測項／單小時） |
| [aqx_p_134](https://data.moenv.gov.tw/dataset/detail/AQX_P_134) | 縣市（非直轄市）小時值－每小時 | 同上，與 133 合併顯示 |
| [aqx_p_07](https://data.moenv.gov.tw/dataset/detail/AQX_P_07) | 空氣品質監測站基本資料 | 提供 TWD97 經緯度、測站類型、空品區與鄉鎮（133／134 本身不含座標） |
| [aqf_p_01](https://data.moenv.gov.tw/dataset/detail/AQF_P_01) | 空氣品質預報資料 | 各空品區未來數日 AQI 預報與預報敘述 |
| [aqx_p_04](https://data.moenv.gov.tw/dataset/detail/AQX_P_04) | 河川揚塵監測資料 | 揚塵站 PM10、風速風向、溫濕度 |
| [aqx_p_29](https://data.moenv.gov.tw/dataset/detail/AQX_P_29) | 監測車、河川揚塵監測站基本資料 | 提供揚塵站座標 |
| [aqx_p_266](https://data.moenv.gov.tw/dataset/detail/AQX_P_266) | 特殊性工業區測站資訊 | 提供工業區測點座標與所屬園區 |
| [aqx_p_268](https://data.moenv.gov.tw/dataset/detail/AQX_P_268) | 特殊性工業區即時監測值（一般空氣污染物） | 依測點與測項之時序值 |
| [aqx_p_267](https://data.moenv.gov.tw/dataset/detail/AQX_P_267) | 特殊性工業區即時監測值（氣象監測項目） | 與 268 合併於同一測點顯示 |
| [aqx_p_25](https://data.moenv.gov.tw/dataset/detail/AQX_P_25) | 光化測站小時值資料 | 50＋ 種 VOC 物種，一列＝單站／單物種／單日，內含 24 小時欄位 |
| [aqx_p_27](https://data.moenv.gov.tw/dataset/detail/AQX_P_27) | 光化測站基本資料 | 15 座光化測站之 TWD97 座標 |
| [aqx_p_189](https://data.moenv.gov.tw/dataset/detail/AQX_P_189)～[aqx_p_264](https://data.moenv.gov.tw/dataset/detail/AQX_P_264)、[aqx_p_461](https://data.moenv.gov.tw/dataset/detail/AQX_P_461) | 各測站空氣品質小時值（單站資料集，共 77 站：aqx_p_189～264 連續 76 站 ＋ 富貴角站 aqx_p_461） | 供點選測站後繪製近日逐時時序圖；頁面內建站名 → 資料集代碼對照表 |

**資料時效說明**：aqx_p_432／133／134 為每小時更新之即時資料；aqx_p_267／268 實測約落後 1 日；**aqx_p_25 光化測站 VOC 非即時資料**（實測最新資料約落後數月），故設計為點選測站後才載入之分析型圖層，頁面與資訊視窗均標註「非即時資料」以免與即時 AQI 混淆。

### 經濟部水利署（WRA）開放資料
`WRA_waterlevel_realtime_display.html` 與 `CWA_opendata_10min_display.html` 的水情圖層共用同一組來源，皆以 `https://opendata.wra.gov.tw/api/v2/{資料集 UUID}?sort=_importdate%20asc&format=JSON` **直連**取得純 JSON 陣列（無分頁包裝），**不需任何金鑰**。

| 資料集 UUID | 內容 | 說明 |
|---|---|---|
| `73c4c3de-4045-4765-abeb-89f9f9cd5ff0` | 河川即時水位 | `stationid`／`datetime`／`waterlevel`／`volt`／`checkresult`，每站一筆最新值 |
| `c4acc691-7416-40ca-9464-292c0c00da92` | 河川水位測站站況 | 857 站之站名、河川、水系、地址與一／二／三級警戒水位；約 2.1 MB，於瀏覽器快取 24 小時。以 `basinidentifier` 對應即時水位的 `stationid` |
| `58a7aa39-287a-4b96-985d-47ffbc7abbd4` | 即時地下水水位 | 以 `wellidentifier` 對應觀測井，同井可能有多筆時序 |
| `3e86faea-e94a-4a91-a870-852d73e83c3d` | 地下水水位觀測井井況 | 用於補齊 KMZ 缺少的井（涵蓋澎湖／金門） |
| [gwobwell_e（KMZ）](https://gic.wra.gov.tw/gis/gic/API/Google/DownLoad.aspx?fname=gwobwell_e&filetype=KML) | 地下水觀測井井位 | 水利署地理資訊服務平台（GIC）；KMZ 即 ZIP，內含 WGS84 經緯度，以 JSZip 解壓後解析 KML |
| `21c50be1-…-790625e984e7` ／ `1b991bbb-…-06ce8749d3ed` | IoW 淹水深度（感測器基本資料／最新值） | 單位 cm；0 cm 為無積水 |
| `a2ea1f32-…-2284e49ea28d` ／ `ae7bd821-…-b3dac36874e0` | IoW 揚塵 PM10 | 單位 μg/m³；同站另有氣溫／溼度／風速 |
| `d82e29eb-…-be27ac601d5e` ／ `3e9e4c4d-…-90c88e11ea54` | IoW 閘門相關監測 | 閘門開度／絕對開度與內外水位 |
| `4d3ec222-…-f743441006a4` ／ `0e51a4ed-…-6efdc7dd87c7` | IoW 沖刷深度 | 單位 m |
| `ad756630-…-a865cdfa7984` ／ `ffa4febb-…-a7c7e6b66c8f` | IoW 累計流量（雨水貯留） | 單位 m³ |

**座標處理**：河川站況與地下水井況**皆不含經緯度欄位**，只提供 TWD97 二度分帶座標（中央經線 121°E、k0=0.9999、假東 250000），頁面於前端反算為 WGS84；少數僅有 TWD67 者先做近似平移再反算。IoW 感測器與 GIC KMZ 則自帶經緯度，不需轉換。

**資料品質**：原始資料存在座標錯誤（例：某站地址在臺北市、TWD97 座標卻落在臺南外海），頁面以「同縣市所有測站的中位數座標」比對，超過 90 km 者視為錯誤並自動剔除，剔除數量顯示於狀態列。缺測以 `-999`／`-999998` 等極大負值表示（IoW 另以 `999.9` 為哨兵值），一律視為無資料。警戒水位數值大小為 **一級 > 二級 > 三級，一級最嚴重**；空字串或 `-999` 視為未訂定。時間欄位 `datetime`／`recordtime` 無時區、實為臺灣時間，IoW 的 `timestamp` 則已帶 `+08:00`。閘門開度單位（% 或 cm）由各河川分署自訂、跨站不可直接比較，故僅以「讀值是否偏離 0」判斷是否開啟。

### 公開即時影像來源
`台灣即時影像地圖.html` 之鏡頭清單內嵌於頁面（約 1.25 MB JSON，5,586 筆），影像則由各機關伺服器即時提供，本專案不轉存、不代理任何影像內容。

| 來源 | 分類 | 介接方式 |
|---|---|---|
| 交通部公路局 省道交控路側設備 | 省道交控（2,323 支） | 內建清單 ＋ 可即時抓取 [opendataCCTVs.xml](https://cctv-maintain.thb.gov.tw/opendataCCTVs.xml) 更新 |
| 高速公路局 國道即時路況 | 國道路況（1,899 支） | 快照／串流網址直連 |
| 新北市政府、嘉義縣政府 | 縣市 CCTV／路況（531 支） | 快照／串流網址直連 |
| 經濟部水利署及所屬河川分署 | 河川監控、水利防災（259 支） | 遠端監控影像 API 直連 |
| 農業部農村發展及水土保持署 | 水土保持、土石流監測（170 支） | 快照網址直連 |
| 臺南市、嘉義縣水情站 | 臺南／嘉義水情（404 支） | 快照網址直連 |

**注意事項**：少數鏡頭（20 支）來源為純 `http://` 網址，以 `file://` 本機開啟可正常顯示，但若將頁面部署於 `https://` 網站，瀏覽器會因混合內容政策阻擋畫面，此時頁面會顯示提示並建議改用「開新分頁」觀看。部分機關來源亦可能限制跨網域嵌入或不時調整網址，載入失敗屬正常現象。

### 其他政府與國際資料來源

| 來源 | 內容 | 使用頁面 | 介接方式 |
|---|---|---|---|
| [台灣電力公司 落雷即時資料](https://data.gov.tw/dataset/61139) | 全臺落雷位置、時間與強度（可與 CWA 閃電落雷對照） | 逐 10 分鐘觀測地圖 | 政府資料開放平臺 JSON（nid=61139）→ [台電網站 CSV](https://service.taipower.com.tw/data/opendata/apply/file/d546005/001.csv) 自動備援；來源未回應 CORS 標頭，頁面提供自填轉送網址 |
| [交通部運輸研究所 港灣資訊網（ISOHE）](https://isohe.ihmt.gov.tw/) | 國內商港風力／潮位即時觀測 | 即時海象監控 | XML／JSON API；未回應 CORS 標頭，需經 `cors-proxy-worker.js` 轉送。**潮位欄位實際單位為公分**，最新一筆常為 `-999`（缺測） |
| [NCAR GDEX TIGGE（d330003）](https://data.gdex.ucar.edu/d330003/) | ECMWF、NCEP GEFS、CMC CENS、BoM ACCESS-GE、KMA GEPS、JMA GEPS、UKMO MOGREPS 之熱帶氣旋系集路徑（CXML） | NWP/MLWP 系集颱風路徑預報 | 直連或經 `cors-proxy-worker.js` 轉送 |
| Google DeepMind WeatherNext ／ WeatherNext 2 | 機器學習天氣模式（MLWP）熱帶氣旋系集路徑（ATCF；大系集為 cyclogenesis CSV，約 33 MB） | 同上 | 直連 |
| JMA、JTWC、NHC、CMA、HKO、KMA、IMD、PAGASA、BoM、Météo-France、NCHMF 等 | 各官方氣象機構熱帶氣旋預報路徑與強度 | 全球官方颱風路徑整合圖 | 各機構公開端點直連 |

**關於 CORS**：本專案為純前端頁面，所有請求都由使用者瀏覽器直接發出。CWA、MOENV 與水利署 opendata 皆可直連；台電落雷、運研所 ISOHE 與 NCAR GDEX 未回應 `Access-Control-Allow-Origin`，相關頁面提供「轉送網址」欄位，可搭配專案內的 `cors-proxy-worker.js`（Cloudflare Worker，免費方案每日 10 萬次請求）自行部署。

---

資料皆來自[中央氣象署氣象資料開放平臺](https://opendata.cwa.gov.tw/)。颱風路徑與侵襲機率產品僅於西北太平洋及南海有熱帶氣旋活動／警報期間提供資料；閃電落雷與可見光雲圖於無閃電／夜間時內容可能為空，均屬正常。衛星雲圖與衛星觀測資料之時間欄位為 UTC，頁面顯示時已轉換為台灣時間。衛星雲圖投影參數（臺灣：橫麥卡托，中央經緯度 121.0E/23.7N；東亞：蘭伯特正形圓錐，中央經緯度 128.5E/0.0N、參考緯度 30N/60N）依 [CWA 衛星雲圖產品說明文件](https://www.cwa.gov.tw/Data/data_catalog/3-7-1.pdf)。數值預報模式（M-A0060／M-A0061／M-A0064）為 GRIB2 格式並於瀏覽器端解析；區域模式 WRF（M-A0061／M-A0064）採 Lambert 正形圓錐投影網格，載入後依 [CWA WRF 產品說明文件](https://opendata.cwa.gov.tw/opendatadoc/MIC/A0061.pdf)之投影參數重投影疊至地圖，模式資料為 UTC 時間、頁面顯示已轉為台灣時間。

## 使用方式
開啟網頁 https://chichawang.github.io/CWAdataVIS/ ，於首頁**兩個頁簽**中選擇要進入的地圖。

**「氣象署觀測」頁簽（需 CWA 授權碼）**
1. 至[氣象署開放資料平臺](https://opendata.cwa.gov.tw/user/authkey)免費註冊會員並取得 API 授權碼（格式 `CWA-XXXXXXXX-...`）
2. 選擇「逐 10 分鐘觀測」、「逐時觀測 × 格點分析」、「即時海象監控」、「地球物理觀測」、「地震即時監測」、「預報整合」或「數值預報模式（GFS／WRF）」地圖/儀表板，輸入授權碼即可進入（各頁面進入前皆須先輸入金鑰。數值預報模式因 GRIB2 檔案較大，載入需較久時間）
3. 勾選「記住金鑰」可儲存於瀏覽器，下次直接載入

**「其他分頁」頁簽**
- **全球官方颱風路徑整合圖**：內建 CWA 示範授權碼，可自備 CWA API 授權碼；可總覽目前所有熱帶氣旋，或切換單一颱風比較各官方機構預報路徑
- **NWP/MLWP 系集颱風路徑預報**：不需 API 金鑰，開啟後會自動載入預設起報時間之 TIGGE NWP 與 WeatherNext2 MLWP 系集路徑；可切換模式、洋盆與單一系統，或顯示目前海域全部路徑，並檢視指定時效落點、侵襲機率與強度時序
- **台灣即時影像地圖**：不需任何金鑰，點選即可進入。進入後依分區頁簽與分類 chips 勾選要顯示的鏡頭來源，點選鏡頭即開啟即時畫面
- **水利署即時水位地圖**：不需任何金鑰，開啟即用。左側面板以區塊卡分列河川即時水位、地下水觀測井與 IoW 物聯網感測器，勾選要顯示的圖層後再依縣市→水系→河川逐層篩選；達警戒的測站會加上脈動外環，網址列的 hash 可直接複製分享目前檢視狀態
- **環境部空氣品質監測地圖**：頁面已內建預設 API KEY，可按「使用內建金鑰」直接進入；若需自備金鑰，可至[環境部環境資料開放平臺](https://data.moenv.gov.tw/)免費申請會員取得

## 檔案結構
```
├── index.html                        # 首頁（兩頁簽入口：氣象署觀測 7 頁 / 其他分頁 5 頁）
│
│   # ── 頁簽一：氣象署觀測 ──
├── CWA_opendata_10min_display.html   # 逐 10 分鐘觀測地圖（單一檔案）＝ 氣象署測站 × 全臺即時影像鏡頭 × 水利署水情，三圖合一
├── CWA_opendata_hourly_display.html  # 逐時觀測 × 格點分析地圖（單一檔案，含 HTML/CSS/JS）
├── CWA_opendata_marine_display.html  # 海象自動監控儀表板（單一檔案，含 HTML/CSS/JS）
├── CWA_opendata_geophysical_display.html # 地球物理觀測監控儀表板（單一檔案，含 HTML/CSS/JS）
├── CWA_opendata_NWPmodel_display.html # 數值預報模式地圖：GFS 全球 + WRF 區域 15km/3km（GRIB2 前端解析，單一檔案）
├── CWA_forecast_display.html         # 預報整合地圖：鄉鎮/海面/藍色公路/潮汐/育樂/QPF/健康氣象/波流模式（單一檔案，規劃見 plan.md）
├── CWA_opendata_earthquake_display.html # 地震即時監測儀表板：3D 震源地圖 × 時間軸 × 最新地震列表（單一檔案，deck.gl）
│
│   # ── 頁簽二：其他分頁 ──
├── typhoon_multiofficialagency_display.html # 全球官方颱風路徑整合圖：多官方機構預報路徑比較（單一檔案）
├── typhoon_NWP_ensemble_display.html # NWP/MLWP 系集颱風路徑預報：TIGGE/WeatherNext2 系集路徑、機率場與強度時序（單一檔案）
├── 台灣即時影像地圖.html              # 全臺 5,586 支公開即時影像鏡頭整合地圖（鏡頭清單內嵌，免金鑰，Hls.js）
├── WRA_waterlevel_realtime_display.html # 水利署即時水位地圖：河川水位 × 地下水觀測井 × IoW 物聯網五種感測器（免金鑰）
├── MOENV_aqx_hourly_display.html     # 環境部空氣品質監測地圖：AQI × 19 測項 × 揚塵/工業區/光化 VOC × 單站時序圖
│
│   # ── 其他（尚未列於首頁） ──
├── CWA_opendata_10min_CCTV_display.html # 10 分鐘觀測 × 即時影像合併版（早期版本，功能已併入 CWA_opendata_10min_display.html）
├── cors-proxy-worker.js              # 最小化 CORS 轉送 Cloudflare Worker（供台電落雷、運研所 ISOHE、NCAR TIGGE 等未回應 CORS 標頭的來源使用）
├── cwa_api_guide_card.html           # CWA API 授權碼申請流程說明卡
├── shore.json                        # 海岸線向量（預報整合地圖之海域／陸地判斷）
├── plan.md                           # 預報整合地圖之資料盤點與設計規劃文件
├── examples/
│   └── 10min.png                     # 逐 10 分鐘觀測地圖畫面截圖
└── README.md
```

## 缺測值處理
- **CWA 資料**：依 CWA 資料標準，`X`（儀器故障）、`-99`（缺值或資料異常）、`None` 等特殊代碼一律視為缺測，於地圖上以灰點呈現。
- **MOENV 資料**：空值（空字串）、`ND`、`x`、`-` 視為缺測；濃度為負值時視為儀器異常代碼並排除（溫度除外，容許負值）。當最新一小時為缺測而前一小時有效時，會回退顯示前一小時數值並於資訊視窗以 ⚠ 標記。
- **WRA 資料**：`-999`、`-999998` 等極大負值視為缺測（一律擋掉 `<= -900`）；IoW 物聯網感測器另以 `999.9` 為哨兵值，淹水深度 `>= 999` 視為異常／失聯不上色。警戒水位為空字串或 `-999` 時視為「未訂定」，該站不參與警戒分級上色。座標明顯錯誤者（距同縣市測站中位數超過 90 km）自動剔除不上圖，數量列於狀態列。

## 版權與授權宣告
- **版權所有**：Copyright (c) [2024-2026] 王志嘉. All rights reserved.
- **開源授權**：本專案之開源版本核心代碼採用 **GNU Affero General Public License v3.0 (AGPL-3.0)** 條款授權。
- **商業授權**：本專案保留未來提供雙重授權（Dual-licensing）與企業版（Enterprise Edition）之權利。若有閉源整合或 SaaS 商業使用且無法遵守 AGPL-3.0 開源規範之需求，請於github上洽談商業授權。

## 數據與第三方資源致謝
- **氣象資料**：中央氣象署氣象資料開放平臺（遵循 [政府資料開放授權條款-第1版](https://data.gov.tw/license)）
- **空氣品質資料**：[環境部環境資料開放平臺](https://data.moenv.gov.tw/)（遵循 [政府資料開放授權條款-第1版](https://data.gov.tw/license)）
- **水情資料**：[經濟部水利署資料開放平臺](https://opendata.wra.gov.tw/)、[水利署地理資訊服務平台（GIC）](https://gic.wra.gov.tw/gic/)、[水利署智慧水資源物聯網（IoW）](https://iow.wra.gov.tw/)（遵循 [政府資料開放授權條款-第1版](https://data.gov.tw/license)）
- **落雷資料**：[台灣電力公司](https://service.taipower.com.tw/)（經[政府資料開放平臺](https://data.gov.tw/dataset/61139)提供）
- **商港海氣象資料**：[交通部運輸研究所 港灣資訊網（ISOHE）](https://isohe.ihmt.gov.tw/)
- **系集颱風路徑**：[NCAR GDEX TIGGE 資料集 d330003](https://data.gdex.ucar.edu/d330003/)（ECMWF、NCEP、CMC、BoM、KMA、JMA、UKMO 提供之系集預報）與 Google DeepMind WeatherNext／WeatherNext 2
- **各國官方颱風預報**：JMA、JTWC、NHC、CMA、HKO、KMA、IMD、PAGASA、BoM、Météo-France、NCHMF 等機構之公開預報產品，著作權歸各機構所有
- **AQI 分級與配色**：參考環境部 [空氣品質指標（AQI）說明](https://airtw.moenv.gov.tw/CHT/Information/Standard/AirQualityIndicator.aspx) 之六級分級標準色
- **即時影像**：交通部公路局（省道交控路側設備 CCTV 開放資料）、高速公路局、新北市政府、嘉義縣政府、經濟部水利署及所屬河川分署、農業部農村發展及水土保持署、臺南市政府。影像著作權歸各提供機關所有，本專案僅整合公開網址供即時檢視，不轉存、不代理、不重製任何影像內容
- **颱風圖例與配色**：參考中央氣象署 [颱風機率預報產品說明](https://www.cwa.gov.tw/V8/C/P/Typhoon/TY_NEWS.html) 與 [颱風消息地圖](https://app.cwa.gov.tw/web/obsmap/typhoon.html)
- **地圖圖磚**：© OpenStreetMap contributors、Esri World Imagery、OpenTopoMap、CARTO
- **海岸線／國界向量**：[Natural Earth](https://www.naturalearthdata.com/)（Public Domain 公共領域）

## 第三方開源元件元件宣告
本專案使用了以下開源元件，其版權與授權歸原作者所有：
- **Leaflet 1.9.4** (BSD 2-Clause License)
- **JSZip 3.10.1** (MIT License / GPLv3)
- **Chart.js** (MIT License)（海象／地球物理儀表板、環境部空品地圖時序圖）
- **deck.gl 8.9** (MIT License)（地震即時監測儀表板 3D 圖層）
- **MapLibre GL JS 3.6** (BSD 3-Clause License)（地震即時監測儀表板底圖）
- **Hls.js 1.5.13** (Apache License 2.0)（台灣即時影像地圖、逐 10 分鐘觀測地圖之 HLS 串流播放）
- **geotiff.js 2.1.3** (MIT License)（逐 10 分鐘觀測地圖之東亞高解析 GeoTIFF 雲圖解析）
- **jsfive 0.4.0** (MIT License)（數值預報模式地圖之海流模式 NetCDF-4／HDF5 解析）
- **topojson-client 3.1.0** (BSD 3-Clause License)（預報整合地圖之鄉鎮／縣市界向量）
