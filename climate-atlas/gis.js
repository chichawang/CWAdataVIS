'use strict';
const $=id=>document.getElementById(id),D=ClimateData,G=GISCore,E=D.escape;
const AV=window.ATMOS_VARS||{};
const DEMO_KEY='rdec-key-123-45678-011121314';
const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView([23.7,121],7);
L.control.zoom({position:'topright'}).addTo(map);
L.control.scale({position:'bottomleft',imperial:false}).addTo(map);

const baseLayers={
 emap:L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP/default/GoogleMapsCompatible/{z}/{y}/{x}',{maxZoom:20,attribution:'© 內政部國土測繪中心 (NLSC)'}),
 gray:L.tileLayer('https://wmts.nlsc.gov.tw/wmts/EMAP01/default/GoogleMapsCompatible/{z}/{y}/{x}',{maxZoom:20,attribution:'© 內政部國土測繪中心 (NLSC 灰階)'}),
 photomix:L.tileLayer('https://wmts.nlsc.gov.tw/wmts/PHOTO_MIX/default/GoogleMapsCompatible/{z}/{y}/{x}',{maxZoom:20,attribution:'© 國土測繪中心/TGOS 正射影像(混合)'}),
 osm:L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}),
 dark:L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© CARTO © OpenStreetMap'}),
 sat:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri · Maxar · Earthstar Geographics'})
};
baseLayers.emap.addTo(map);
$('basemap').value='emap';

let theme=THEMES[0].id,pending=null,layers=[],selected=null,nextID=1,timer=null,controller=null,requestID=0,lastFeatureClickAt=0;

function notify(s,type=''){$('notice').textContent=s;$('notice').className=type;}
function options(id,values){$(id).innerHTML=values.map(([v,t])=>`<option value="${E(v)}">${E(t)}</option>`).join('');}
function halt(){if(timer)clearInterval(timer);timer=null;$('play').textContent='▶';$('play').setAttribute('aria-label','播放時間軸');}
function cancelRequest(){requestID++;if(controller)controller.abort();controller=null;$('fetch').disabled=false;if($('test-key'))$('test-key').disabled=false;}
function formatNum(v){return typeof v==='number'?Number(v.toFixed(2)):E(v);}

function activateOnlyLayer(id){
 layers.forEach(item=>{
  item.visible=(item.id===id);
  if(item.visible){if(!map.hasLayer(item.group))item.group.addTo(map);}
  else if(map.hasLayer(item.group))map.removeLayer(item.group);
 });
 selectLayer(id);
}

function removeLayerById(id){
 const l=layers.find(x=>x.id===id);
 if(!l)return;
 map.removeLayer(l.group);
 if(l.kind==='kmz-overlays')l.overlays.forEach(o=>{if(o.url)URL.revokeObjectURL(o.url);});
 layers=layers.filter(x=>x.id!==id);
}

function removeExistingBySource(sourceId){
 if(!sourceId)return;
 layers.filter(x=>x.source===sourceId).map(x=>x.id).forEach(removeLayerById);
}

function selectProduct(){
 cancelRequest();
 const d=DATASETS.find(d=>d.id===$('dataset').value)||DATASETS[0];
 $('source').href=d.url;
 $('fetch').disabled=false;
 if($('test-key'))$('test-key').disabled=false;
 $('dataset-desc').textContent=d.desc||'';
 $('dataset-note').textContent=THEMES.find(t=>t.id===theme)?.note||'';
 pending=null;
 $('mapping').hidden=true;
 const existing=layers.find(l=>l.source===d.id);
 if(existing)selectLayer(existing.id);
 const sizeHint=d.id==='C-B0024-002'?'，約 104 MB':'';
 notify(`已選取 ${d.id}（${d.period}${sizeHint}）。`);
 history.replaceState(null,'',`#${d.id}`);
}

function selectTheme(id,product){
 theme=id;
 document.querySelectorAll('[data-theme]').forEach(b=>b.classList.toggle('active',b.dataset.theme===id));
 options('dataset',DATASETS.filter(d=>d.theme===id).map(d=>[d.id,`[${d.timeTag||d.period}] ${d.name}`]));
 if(product&&DATASETS.some(d=>d.id===product&&d.theme===id))$('dataset').value=product;
 selectProduct();
}

$('themes').innerHTML=THEMES.map(t=>`<button data-theme="${t.id}">${t.icon} ${t.name}</button>`).join('');
$('themes').onclick=e=>{const b=e.target.closest('[data-theme]');if(b)selectTheme(b.dataset.theme);};
$('dataset').onchange=selectProduct;

$('basemap').onchange=()=>{
 Object.values(baseLayers).forEach(l=>map.removeLayer(l));
 if(baseLayers[$('basemap').value])baseLayers[$('basemap').value].addTo(map);
};
let tileWarning=false;
Object.values(baseLayers).forEach(b=>b.on('tileerror',()=>{
 if(!tileWarning){tileWarning=true;notify('部分底圖圖磚無法載入，可切換其他底圖；大氣資料圖層仍可正常操作。','error');}
}));

map.on('mousemove',e=>{$('coordinates').textContent=`WGS84 · ${e.latlng.lat.toFixed(4)}° N / ${e.latlng.lng.toFixed(4)}° E`;});
$('taiwan').onclick=()=>map.fitBounds([[21.7,118.1],[26.3,122.3]]);
$('fit').onclick=()=>{
 const l=active();
 if(!l){notify('尚未選取任何圖層。');return;}
 if(l.kind==='kmz-overlays'){
  const ov=l.overlays[l.index];
  if(ov?.bounds)map.fitBounds(ov.bounds,{padding:[24,24]});
  return;
 }
 if(l.group.getBounds().isValid())map.fitBounds(l.group.getBounds(),{padding:[35,35],maxZoom:11});
 else notify('目前圖層沒有可縮放的空間圖徵。');
};

$('sidebar-toggle').onclick=()=>{document.body.classList.toggle('sidebar-closed');map.invalidateSize();};
if(innerWidth<=650)document.body.classList.add('sidebar-closed');

function detectNumericFields(rows,excludeFields){
 const skip=new Set(excludeFields.filter(Boolean));
 const keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 return keys.filter(k=>{
  if(skip.has(k)||/經度|緯度|lon|lng|latitude|longitude|海拔|站號|id$/i.test(k))return false;
  return rows.some(r=>D.number(r[k])!==null);
 });
}

function addOverlayLayer(overlayResult,label,sourceId,demo=false){
 const overlays=overlayResult.overlays||[];
 if(!overlays.length)throw new Error('KMZ 內找不到有效的地理定位面化圖影像。');
 removeExistingBySource(sourceId);
 const l={
  id:nextID++,title:label,kind:'kmz-overlays',overlays,demo,source:sourceId,
  times:overlays.map(o=>o.time),groupFilter:'all',index:overlays.length-1,opacity:0.82,visible:true,
  cfg:{kind:'overlay',value:label,unit:''},range:[null,null],
  group:L.featureGroup().addTo(map)
 };
 layers.push(l);
 renderLayer(l);
 activateOnlyLayer(l.id);
 $('fit').click();
 notify(`已載入 ${overlays.length} 個月份面化圖。`,demo?'demo':'');
 if(innerWidth<=650)document.body.classList.add('sidebar-closed');
}

function receive(data,label,demo=false,autoAdd=false,datasetId=''){
 if(data&&data.kind==='kmz-overlays'){
  $('mapping').hidden=true;
  pending=null;
  addOverlayLayer(data,label,datasetId||$('dataset').value,demo);
  return;
 }
 const geo=G.featureCollection(data);
 const dsId=datasetId||$('dataset').value;
 pending={
  tables:geo?[{path:'GeoJSON features',rows:geo.map(f=>f.properties)}]:D.tables(data,dsId),
  geo,label,demo,source:dsId
 };
 pending.tables=pending.tables.filter(t=>t.rows.length);
 if(!pending.tables.length)throw new Error('沒有可讀取的資料列。');
 options('table',pending.tables.map((t,i)=>[String(i),`${t.path} · ${t.rows.length.toLocaleString()} 列`]));
 $('table').value='0';
 $('mapping').hidden=true;
 $('layer-name').value=label;
 selectTable();
 addActiveMapping();
}

function detectTableConfig(tObj,sourceId,geo){
 const rows=tObj.rows,keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 const findKey=re=>keys.find(k=>re.test(k))||'';
 const lon=findKey(/(^|\.)(經度|longitude|lon|lng|StationLongitude)$/i);
 const lat=findKey(/(^|\.)(緯度|latitude|lat|StationLatitude)$/i);
 const time=findKey(/^(時間|date|time|month|日期|月份)$/i)||findKey(/(date|time|month|日期|月份|時間)/i);
 const name=findKey(/^(測站|StationName|名稱|name)$/i)||findKey(/(stationname|stationid|站號|測站|名稱|name)/i);
 const dsMeta=DATASETS.find(d=>d.id===sourceId);
 const preferred=tObj.defaultVar||dsMeta?.defaultVar;
 const value=(preferred&&keys.includes(preferred))?preferred:findKey(/平均氣溫|氣溫|累積雨量|月總雨量|降水量|年總雨量|最高氣溫|最低氣溫|平均相對濕度|平均氣壓|平均風速|日照時數|平均海表溫|平均海溫|平均示性波高|平均波高|流速|極端暴潮高|最大暴潮高|平均潮差|氣候海水位異常|海水位趨勢|海拔|rain|temperature|value|數值|雨量/i);
 return{lon,lat,kind:geo?'geometry':(tObj.kind||'point'),cell:tObj.cell?String(tObj.cell):'0.25',value,time,name,unit:AV[value]?.unit||''};
}

function buildFeaturesFromTable(tObj,cfg,geo){
 let features,skipped=0;
 if(geo){features=geo;}
 else{
  if(!cfg.lon||!cfg.lat)throw new Error('需要經緯度欄位才能加入地圖。');
  if(cfg.kind==='geometry')throw new Error('線與面資料請匯入 GeoJSON。');
  ({features,skipped}=G.fromRows(tObj.rows,cfg));
 }
 if(!features.length)throw new Error('沒有有效的 WGS84 座標，請檢查欄位與投影。');
 if(features.length>100000)throw new Error(`資料含 ${features.length.toLocaleString()} 筆圖徵（超過 100,000 上限），請先改選「逐月」或「逐日」彙整資料表。`);
 const numericFields=detectNumericFields(tObj.rows,[cfg.lon,cfg.lat,cfg.time,cfg.name]);
 const allTimes=G.times(features,cfg.time);
 return{features,skipped,numericFields,allTimes,range:G.extent(features,cfg.value)};
}

function selectTable(){
 if(!pending)return;
 const tObj=pending.tables[+$('table').value];
 const rows=tObj.rows,keys=[...new Set(rows.flatMap(r=>Object.keys(r)))];
 for(const id of ['lon','lat','value','time','name']){
  options(id,[['',id==='value'?'單色／不指定測項':'不指定'],...keys.map(k=>[k,k])]);
 }
 const cfg=detectTableConfig(tObj,pending.source,pending.geo);
 $('lon').value=cfg.lon;$('lat').value=cfg.lat;$('time').value=cfg.time;$('name').value=cfg.name;
 $('value').value=cfg.value;$('unit').value=cfg.unit;$('cell').value=cfg.cell;
 $('kind').value=cfg.kind;
 $('kind').disabled=!!pending.geo;
 kindState();
}

function updateUnitFromValue(){
 const v=$('value').value;
 $('unit').value=AV[v]?.unit||'';
}

function kindState(){
 const geometry=$('kind').value==='geometry';
 $('lon').disabled=geometry;$('lat').disabled=geometry;
 $('cell').disabled=$('kind').value!=='grid';
}

$('table').onchange=()=>{selectTable();if($('layer-name').value&&pending)$('layer-name').value=`${pending.label} · ${pending.tables[+$('table').value].path.split('（')[0]}`;};
$('kind').onchange=kindState;
$('value').onchange=updateUnitFromValue;

function addActiveMapping(){
 if(!pending)return;
 const tableIndex=+$('table').value||0;
 const tObj=pending.tables[tableIndex];
 const cfg={
  lon:$('lon').value,lat:$('lat').value,kind:$('kind').value,cell:$('cell').value,
  value:$('value').value,time:$('time').value,name:$('name').value,unit:$('unit').value.trim()
 };
 const built=buildFeaturesFromTable(tObj,cfg,pending.geo);
 removeExistingBySource(pending.source);
 const l={
  id:nextID++,title:$('layer-name').value.trim()||pending.label,
  features:built.features,cfg,numericFields:built.numericFields,demo:pending.demo,source:pending.source,
  tables:pending.tables,tableIndex,geo:pending.geo,
  range:built.range,times:built.allTimes,groupFilter:'all',
  index:built.allTimes.length?built.allTimes.length-1:0,
  opacity:0.88,visible:true,group:L.featureGroup().addTo(map)
 };
 layers.push(l);
 renderLayer(l);
 activateOnlyLayer(l.id);
 $('fit').click();
 notify(`已載入 ${built.features.length.toLocaleString()} 筆圖徵${built.skipped?`（略過 ${built.skipped} 筆缺座標）`:''}。`,l.demo?'demo':'');
 if(innerWidth<=650)document.body.classList.add('sidebar-closed');
}

$('add').onclick=()=>{try{addActiveMapping();}catch(e){notify(e.message,'error');}};

async function readResponseWithProgress(res,label){
 const total=Number(res.headers.get('content-length'))||0;
 if(!res.body||total<2*1024*1024)return await res.arrayBuffer();
 const reader=res.body.getReader();
 const chunks=[];let received=0;
 while(true){
  const {done,value}=await reader.read();
  if(done)break;
  chunks.push(value);received+=value.byteLength;
  const mb=(received/1048576).toFixed(1);
  const totMb=total?` / ${(total/1048576).toFixed(1)} MB`:' MB';
  notify(`正在下載 ${label}：${mb}${totMb}…`);
 }
 const out=new Uint8Array(received);
 let offset=0;
 for(const c of chunks){out.set(c,offset);offset+=c.byteLength;}
 return out.buffer;
}

async function ingestBuffer(ab,fileName,label,sourceId,autoAdd=true,allowRedirect=true){
 const u8=new Uint8Array(ab);
 const isZip=(u8.length>=2&&u8[0]===0x50&&u8[1]===0x4B)||/\.(zip|kmz)$/i.test(fileName);
 if(isZip){
  notify(`正在解壓縮並解析 ${fileName}…`);
  const unpacked=await D.unpackZip(ab,fileName);
  receive(unpacked,label,false,autoAdd,sourceId);
  return;
 }
 if(D.isBinaryBuffer(u8)||/\.(nc|tiff?)$/i.test(fileName)){
  notify(`正在解析二進位網格資料 ${fileName}…`);
  receive(D.parseBinaryResource(ab,fileName,sourceId),label,false,autoAdd,sourceId);
  return;
 }
 const text=new TextDecoder('utf-8').decode(u8);
 const trimmed=text.trim();
 if(/\.csv$/i.test(fileName)&&!trimmed.startsWith('{')&&!trimmed.startsWith('<')){
  receive(D.csv(text),label,false,autoAdd,sourceId);
  return;
 }
 if(trimmed.startsWith('<')||/\.xml$/i.test(fileName)){
  notify(`正在解析 XML ${fileName}…`);
  receive(D.parseXML(text),label,false,autoAdd,sourceId);
  return;
 }
 const json=JSON.parse(text);
 const nested=allowRedirect?D.nestedResourceUrl(json):'';
 if(nested){
  const linkedName=nested.split('?')[0].split('/').pop()||`${sourceId}.zip`;
  notify(`偵測到外部資料檔連結，正在自動下載 ${linkedName}…`);
  const r2=await fetch(nested,{referrerPolicy:'no-referrer'});
  if(!r2.ok)throw new Error(`無法取得外部資料檔（HTTP ${r2.status}）`);
  const ab2=await readResponseWithProgress(r2,sourceId);
  await ingestBuffer(ab2,linkedName,label,sourceId,autoAdd,false);
  return;
 }
 receive(json,label,false,autoAdd,sourceId);
}

async function loadOfficialDataset(apiKey,keyLabel){
 const d=DATASETS.find(d=>d.id===$('dataset').value);
 if(!d)return;
 cancelRequest();const token=requestID;controller=new AbortController();const abort=controller;
 const timeoutMs=/C-B0024-002|C-B0025-002|C-B0026-002|C-A0088-001|C-A0090-001|C-A0092-001/.test(d.id)?180000:60000;
 const timeout=setTimeout(()=>abort.abort(),timeoutMs);
 $('fetch').disabled=true;
 if($('test-key'))$('test-key').disabled=true;
 notify(`載入 ${d.id}…`);
 try{
  const candidates=[];
  if(apiKey&&d.format!=='ZIP'){
   const u=new URL(d.format==='API'?`https://opendata.cwa.gov.tw/api/v1/rest/datastore/${d.id}`:`https://opendata.cwa.gov.tw/fileapi/v1/opendataapi/${d.id}`);
   u.searchParams.set('Authorization',apiKey);
   if(d.format!=='API'){u.searchParams.set('downloadType','WEB');u.searchParams.set('format','JSON');}
   candidates.push({url:u.toString(),name:`${d.id}.json`});
  }
  candidates.push({url:d.s3,name:d.s3.split('/').pop()});
  let lastErr=null,loadedOk=false;
  for(const cand of candidates){
   try{
    const res=await fetch(cand.url,{signal:abort.signal,referrerPolicy:'no-referrer'});
    if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const ab=await readResponseWithProgress(res,d.id);
    if(token!==requestID)return;
    await ingestBuffer(ab,cand.name,`${d.name} · ${d.id}`,d.id,true);
    loadedOk=true;break;
   }catch(err){lastErr=err;if(err.name==='AbortError')throw err;}
  }
  if(!loadedOk&&lastErr)throw lastErr;
 }catch(e){
  if(token===requestID){
   notify(e.name==='AbortError'?'載入逾時，請重試。':`載入失敗（${e.message}）。`,'error');
  }
 }finally{
  clearTimeout(timeout);
  if(token===requestID){$('fetch').disabled=false;if($('test-key'))$('test-key').disabled=false;controller=null;}
 }
}

$('test-key').onclick=()=>loadOfficialDataset(DEMO_KEY,'測試金鑰');
$('fetch').onclick=()=>{
 const key=$('key').value.trim();
 if(!key){notify('請輸入自訂金鑰，或點「測試金鑰載入」。','error');$('key').focus();return;}
 loadOfficialDataset(key,'自訂金鑰');
};
$('key').addEventListener('keydown',e=>{if(e.key==='Enter')$('fetch').click();});

function active(){return layers.find(l=>l.id===selected);}
function slice(l){return l.times.length?l.features.filter(f=>String(f.properties[l.cfg.time]??'')===l.times[l.index]):l.features;}

function renderLayer(l){
 l.group.clearLayers();
 if(l.kind==='kmz-overlays'){
  const ov=l.overlays[l.index];
  if(ov&&ov.url){
   L.imageOverlay(ov.url,ov.bounds,{opacity:l.opacity,interactive:false}).addTo(l.group);
  }
  l.currentCount=ov?1:0;l.rendered=l.currentCount;
 }else{
  const current=slice(l);
  l.currentCount=current.length;
  l.rendered=Math.min(12000,current.length);
  const style=f=>{
   const val=D.number(f.properties[l.cfg.value]);
   const col=G.colorForVar(val,l.range,l.cfg.value);
   return{color:'#0f1e29',weight:1.4,opacity:l.opacity,fillColor:col,fillOpacity:0.88*l.opacity};
  };
  const geo=L.geoJSON({type:'FeatureCollection',features:current.slice(0,12000)},{
   style,
   pointToLayer:(f,ll)=>L.circleMarker(ll,{...style(f),radius:current.length>200?5.5:7.5,weight:1.5,fillOpacity:0.9*l.opacity}),
   onEachFeature:(f,child)=>{
    const label=l.cfg.name?String(f.properties[l.cfg.name]??'未命名圖徵'):'空間圖徵';
    const v=D.number(f.properties[l.cfg.value]);
    const tStr=l.cfg.time&&f.properties[l.cfg.time]?` · ${E(f.properties[l.cfg.time])}`:'';
    child.bindTooltip(`${E(label)}${l.cfg.value?` · ${E(l.cfg.value)}：${v===null?'缺測':E(formatNum(v))} ${E(l.cfg.unit)}`:''}${tStr}${l.demo?' · 示範':''}`,{sticky:true});
    child.on('click',e=>{if(e&&e.originalEvent)e.originalEvent._featureClicked=true;lastFeatureClickAt=Date.now();selectLayer(l.id);showFeature(l,f);});
   }
  });
  l.group.addLayer(geo);
 }
 if(l.visible&&!map.hasLayer(l.group))l.group.addTo(map);
 if(!l.visible)map.removeLayer(l.group);
}

function layerList(){
 $('layer-count').textContent=String(layers.length);
 $('layers').innerHTML=layers.length?layers.slice().reverse().map(l=>{
  const sub=l.kind==='kmz-overlays'
   ?`面化圖疊圖 · ${l.overlays[l.index]?.label||''}`
   :`${E(l.cfg.value||'單色')} · ${l.currentCount} 筆${l.times.length?' · '+E(l.times[l.index]):''}`;
  return `<div class="layer-card ${l.id===selected?'selected':''}">
   <label><input type="checkbox" data-visible="${l.id}" ${l.visible?'checked':''}>${E(l.title)}</label>
   <small class="${l.demo?'demo-tag':''}">${l.demo?'人工示範 · ':''}${sub}</small>
   <input type="range" min="0" max="1" step="0.05" value="${l.opacity}" data-opacity="${l.id}" aria-label="${E(l.title)} 透明度">
   <div class="actions">
    <button data-select="${l.id}">${l.id===selected?'已選取':'選取'}</button>
    <button data-zoom="${l.id}">定位</button>
    <button data-remove="${l.id}">移除</button>
   </div>
  </div>`;
 }).join(''):'<div class="empty-layers">尚未加入資料圖層。</div>';
 const a=active();
 $('export').disabled=!a||a.kind==='kmz-overlays';
}

function syncTableSwitcher(){
 const l=active(),sel=$('active-table'),tabs=$('scale-tabs');
 const show=l&&l.kind!=='kmz-overlays'&&l.tables&&l.tables.length>1;
 if(sel){
  if(!show){sel.hidden=true;}
  else{
   sel.innerHTML=l.tables.map((t,i)=>`<option value="${i}">${E(t.path.split('（')[0])} (${t.rows.length.toLocaleString()})</option>`).join('');
   sel.value=String(l.tableIndex||0);
   sel.hidden=false;
  }
 }
 if(tabs){
  if(!show){tabs.hidden=true;tabs.innerHTML='';}
  else{
   const activeIdx=l.tableIndex||0;
   tabs.innerHTML=l.tables.map((t,i)=>`<button type="button" data-table-idx="${i}" class="${i===activeIdx?'active':''}">${E(t.path.split('（')[0])}</button>`).join('');
   tabs.hidden=false;
  }
 }
}

function switchLayerTable(idx){
 const l=active();
 if(!l||l.kind==='kmz-overlays'||!l.tables)return;
 const tObj=l.tables[idx];
 if(!tObj)return;
 try{
  const cfg=detectTableConfig(tObj,l.source,l.geo);
  const built=buildFeaturesFromTable(tObj,cfg,l.geo);
  l.tableIndex=idx;
  l.cfg=cfg;
  l.features=built.features;
  l.numericFields=built.numericFields;
  l.range=built.range;
  l.times=built.allTimes;
  l.groupFilter='all';
  l.index=built.allTimes.length?built.allTimes.length-1:0;
  renderLayer(l);
  selectLayer(l.id);
  notify(`已切換：${tObj.path.split('（')[0]}（${built.features.length.toLocaleString()} 筆）。`);
 }catch(e){
  if($('active-table'))$('active-table').value=String(l.tableIndex||0);
  notify(e.message,'error');
 }
}

$('active-table').onchange=()=>switchLayerTable(Number($('active-table').value));
$('scale-tabs').onclick=e=>{
 const b=e.target.closest('[data-table-idx]');
 if(b)switchLayerTable(Number(b.dataset.tableIdx));
};

function syncVarSwitcher(){
 const l=active(),sel=$('active-var');
 if(!l||l.kind==='kmz-overlays'||!l.numericFields?.length){sel.hidden=true;return;}
 sel.innerHTML=l.numericFields.map(k=>{
  const u=AV[k]?.unit?` (${AV[k].unit})`:'';
  return `<option value="${E(k)}">${E(k)}${E(u)}</option>`;
 }).join('');
 if(l.cfg.value&&l.numericFields.includes(l.cfg.value))sel.value=l.cfg.value;
 sel.hidden=false;
}

$('active-var').onchange=()=>{
 const l=active();
 if(!l||l.kind==='kmz-overlays')return;
 const v=$('active-var').value;
 l.cfg.value=v;
 l.cfg.unit=AV[v]?.unit||'';
 l.range=G.extent(l.features,v);
 renderLayer(l);
 $('detail').hidden=true;
 updateTimeline();layerList();legend();
};

function selectLayer(id){
 halt();selected=id;$('detail').hidden=true;
 syncTableSwitcher();syncVarSwitcher();layerList();updateTimeline();legend();
}

function timeGroupKey(t){
 const s=String(t||'');
 if(/^\d{4}-\d{2}-\d{2}[T\s]\d{2}/.test(s))return{key:s.slice(0,10),label:`${s.slice(0,10)}（逐時）`};
 if(/^\d{4}-\d{2}-\d{2}$/.test(s))return{key:s.slice(0,7),label:`${s.slice(0,7)} 月`};
 if(/^\d{4}-\d{2}$/.test(s))return{key:s.slice(0,4),label:`${s.slice(0,4)} 年`};
 return{key:'all',label:'全部期間'};
}

function visibleTimeIndices(l){
 if(!l||!l.times.length)return[];
 if(!l.groupFilter||l.groupFilter==='all')return l.times.map((_,i)=>i);
 const out=[];
 l.times.forEach((t,i)=>{if(timeGroupKey(t).key===l.groupFilter)out.push(i);});
 return out.length?out:l.times.map((_,i)=>i);
}

function updateTimeline(){
 const l=active();
 const grpSel=$('time-group'),tSel=$('time-select');
 if(!l||!l.times.length){
  if(grpSel){grpSel.hidden=true;grpSel.innerHTML='';}
  if(tSel){tSel.disabled=true;tSel.innerHTML='<option>尚無時間資料</option>';}
  $('slider').disabled=true;$('play').disabled=true;
  $('slider').max=0;$('slider').value=0;
  $('time-label').textContent='尚無時間資料';
  $('time-count').textContent=l?`${l.currentCount} 圖徵`:'選取圖層後探索';
  $('map-heading').textContent=l?l.title:'臺灣 · 大氣氣候資料地圖';
  $('map-subtitle').innerHTML=l
   ?`<i class="status-dot"></i>${l.demo?'人工示範 · ':''}${E(l.cfg.value||'單色圖層')}${l.cfg.unit?' ('+E(l.cfg.unit)+')':''} · ${l.visible?'顯示中':'已隱藏'}`
   :'<i class="status-dot"></i>載入大氣資料 · 點選測站查看時序';
  return;
 }
 const groups=new Map();
 l.times.forEach(t=>{
  const g=timeGroupKey(t);
  if(g.key!=='all'){
   if(!groups.has(g.key))groups.set(g.key,{label:g.label,count:0});
   groups.get(g.key).count++;
  }
 });
 if(grpSel){
  if(groups.size>=2){
   if(l.groupFilter&&l.groupFilter!=='all'&&!groups.has(l.groupFilter))l.groupFilter='all';
   const opts=[['all',`全部期間 (${l.times.length})`],...[...groups].map(([k,v])=>[k,`${v.label} (${v.count})`])];
   grpSel.innerHTML=opts.map(([v,txt])=>`<option value="${E(v)}">${E(txt)}</option>`).join('');
   grpSel.value=l.groupFilter||'all';
   grpSel.hidden=false;
  }else{
   l.groupFilter='all';
   grpSel.hidden=true;
  }
 }
 const indices=visibleTimeIndices(l);
 let pos=indices.indexOf(l.index);
 if(pos<0){pos=indices.length-1;l.index=indices[pos];}
 if(tSel){
  tSel.innerHTML=indices.map(idx=>{
   const lbl=l.kind==='kmz-overlays'?(l.overlays[idx]?.label||l.times[idx]):l.times[idx];
   return `<option value="${idx}">${E(lbl)}</option>`;
  }).join('');
  tSel.value=String(l.index);
  tSel.disabled=indices.length<2;
 }
 $('slider').disabled=indices.length<2;
 $('play').disabled=indices.length<2;
 $('slider').max=Math.max(0,indices.length-1);
 $('slider').value=pos;
 const tLabel=l.kind==='kmz-overlays'?(l.overlays[l.index]?.label||''):(l.times[l.index]||'無時間欄位');
 $('time-label').textContent=tLabel;
 $('time-count').textContent=`${pos+1} / ${indices.length} · ${l.currentCount} 圖徵`;
 $('map-heading').textContent=l.title;
 $('map-subtitle').innerHTML=`<i class="status-dot"></i>${l.demo?'人工示範 · ':''}${E(l.cfg.value||'單色圖層')}${l.cfg.unit?' ('+E(l.cfg.unit)+')':''} · ${l.visible?'顯示中':'已隱藏'}`;
}

function legend(){
 const l=active();
 if(!l){
  $('legend-title').textContent='大氣變數圖例';
  $('legend-content').innerHTML='<p>加入圖層後，顯示對應大氣變數色階與當期全臺最高／最低站。</p>';
  return;
 }
 if(l.kind==='kmz-overlays'){
  const ov=l.overlays[l.index];
  $('legend-title').textContent=l.title;
  $('legend-content').innerHTML=`<p><b>${E(ov?.label||'')}</b><br>官方 2.5 km 網格 KMZ 地理定位疊圖（PNG）。<br>本圖資供全臺空間格局與季節變化檢視，不提供點擊反推像素數值。<br>${E(l.source)}</p>`;
  return;
 }
 $('legend-title').textContent=`${l.cfg.value||'單色圖層'}${l.cfg.unit?` (${l.cfg.unit})`:''}`;
 const current=slice(l);
 const stats=G.summaryStats(current,l.cfg.value,l.cfg.name);
 const isRain=G.paletteKeyFor(l.cfg.value)==='rain';
 const u=l.cfg.unit?` ${E(l.cfg.unit)}`:'';
 const statsHtml=stats.valid?`<div class="stat-grid">
  <div class="stat-item"><small>最高站</small><strong title="${E(stats.max.name)}">${E(stats.max.name||'—')} · ${formatNum(stats.max.value)}${u}</strong></div>
  <div class="stat-item"><small>最低站</small><strong title="${E(stats.min.name)}">${E(stats.min.name||'—')} · ${formatNum(stats.min.value)}${u}</strong></div>
  <div class="stat-item"><small>當期平均</small><strong>${formatNum(stats.mean)}${u}</strong></div>
  <div class="stat-item"><small>有效站數</small><strong>${stats.valid} / ${stats.total}</strong></div>
 </div>`:'';
 let bodyHtml='';
 let notePrefix='灰色為缺測／無觀測；色階範圍鎖定全期所有時間。';
 if(l.range[0]!==null&&isRain){
  const C=G.RAIN_COLORS,L=G.RAIN_LEVELS,N=C.length,h=11;
  let barHtml='<div class="cwb-rain-bar">';
  for(let t=0;t<N;t++){
   const di=N-1-t;
   const lab=(di-1>=0)?L[di-1]:'';
   barHtml+=`<div style="position:relative;height:${h}px;background:rgb(${C[di].join(',')})">${lab!==''?`<span>${lab}</span>`:''}</div>`;
  }
  barHtml+='</div>';
  bodyHtml=`<div class="rain-legend-layout">${barHtml}<div class="rain-legend-side">${statsHtml}</div></div>`;
  notePrefix=`CWB/NCL 標準雨量分級 (${E(l.cfg.unit||'mm')}) · 灰色為缺測／無觀測`;
 }else{
  const rampHtml=l.range[0]!==null
   ?`<div class="ramp" style="background:${G.gradientForVar(l.cfg.value)}"></div><div class="ramp-labels"><span>${E(formatNum(l.range[0]))}</span><span>${E(formatNum(l.range[1]))} ${E(l.cfg.unit)}</span></div>`
   :'<p>灰色：未指定測項或全期缺測。</p>';
  bodyHtml=`${rampHtml}${statsHtml}`;
 }
 $('legend-content').innerHTML=`${bodyHtml}<p>${notePrefix}<br>${l.demo?'人工示範，非官方觀測<br>':''}${l.rendered<l.currentCount?'僅繪製前 12,000 圖徵<br>':''}${E(l.source)}</p>`;
}

function ensureLayerVisible(id){
 const l=layers.find(x=>x.id===id);
 if(!l)return;
 l.visible=true;
 if(!map.hasLayer(l.group))l.group.addTo(map);
 selectLayer(id);
}

$('layers').onclick=e=>{
 const el=e.target.closest('button');if(!el)return;
 const id=Number(el.dataset.select||el.dataset.zoom||el.dataset.remove);
 if(el.dataset.select)ensureLayerVisible(id);
 if(el.dataset.zoom){ensureLayerVisible(id);$('fit').click();}
 if(el.dataset.remove){
  removeLayerById(id);
  const next=layers.filter(x=>x.visible).at(-1)||layers.at(-1)||null;
  selectLayer(next?next.id:null);
 }
};

$('layers').onchange=e=>{
 if(e.target.dataset.visible){
  const l=layers.find(x=>x.id===+e.target.dataset.visible);
  if(!l)return;
  l.visible=e.target.checked;
  if(l.visible){
   if(!map.hasLayer(l.group))l.group.addTo(map);
   selectLayer(l.id);
  }else{
   map.removeLayer(l.group);
   if(selected===l.id){
    const next=layers.filter(x=>x.visible).at(-1)||l;
    selectLayer(next.id);
   }else{
    updateTimeline();layerList();
   }
  }
 }
};

$('layers').oninput=e=>{
 if(e.target.dataset.opacity){
  const l=layers.find(l=>l.id===+e.target.dataset.opacity);
  l.opacity=+e.target.value;
  renderLayer(l);
 }
};

function setTime(index){
 const l=active();if(!l)return;
 l.index=index;renderLayer(l);$('detail').hidden=true;
 updateTimeline();layerList();legend();
}

$('slider').oninput=()=>{
 halt();
 const l=active();if(!l)return;
 const indices=visibleTimeIndices(l);
 const target=indices[+$('slider').value];
 if(target!==undefined)setTime(target);
};
$('time-select').onchange=()=>{halt();setTime(+$('time-select').value);};
$('time-group').onchange=()=>{
 halt();
 const l=active();if(!l)return;
 l.groupFilter=$('time-group').value||'all';
 const indices=visibleTimeIndices(l);
 if(indices.length)setTime(indices[indices.length-1]);
 else updateTimeline();
};
$('play').onclick=()=>{
 if(timer){halt();return;}
 const l=active();if(!l)return;
 if(visibleTimeIndices(l).length<2)return;
 $('play').textContent='Ⅱ';$('play').setAttribute('aria-label','暫停時間軸');
 timer=setInterval(()=>{
  const cur=active();if(!cur)return;
  const indices=visibleTimeIndices(cur);
  if(indices.length<2){halt();return;}
  const pos=indices.indexOf(cur.index);
  setTime(indices[(pos+1)%indices.length]);
 },850);
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});

function buildLinePaths(pts,sx,sy){
 let seg=[],paths=[];
 for(let i=0;i<pts.length;i++){
  if(pts[i]===null){if(seg.length)paths.push(seg.join(' '));seg=[];}
  else seg.push(`${sx(i)},${sy(pts[i])}`);
 }
 if(seg.length)paths.push(seg.join(' '));
 return paths;
}

function showFeature(l,f){
 const props=f.properties;
 const value=D.number(props[l.cfg.value]);
 const skipKeys=new Set([l.cfg.lon,l.cfg.lat,l.cfg.name,'站號','測站','縣市','海拔(m)','測站類型','時間','經度','緯度']);
 const chips=Object.entries(props)
  .filter(([k,v])=>!skipKeys.has(k)&&v!==null&&v!==undefined&&v!=='')
  .slice(0,10)
  .map(([k,v])=>{
   const u=AV[k]?.unit?` ${AV[k].unit}`:'';
   return `<div class="chip"><small>${E(k)}</small><b>${E(formatNum(v))}${E(u)}</b></div>`;
  }).join('');

 let series=[];
 if(l.cfg.time&&l.cfg.value){
  const name=l.cfg.name?props[l.cfg.name]:null,geometry=JSON.stringify(f.geometry);
  series=l.features
   .filter(p=>name!==null&&name!==undefined?p.properties[l.cfg.name]===name:JSON.stringify(p.geometry)===geometry)
   .map(p=>({
    time:String(p.properties[l.cfg.time]??''),
    value:D.number(p.properties[l.cfg.value]),
    hi:D.number(p.properties['最高氣溫']??p.properties['平均最高溫']),
    lo:D.number(p.properties['最低氣溫']??p.properties['平均最低溫'])
   }))
   .sort((a,b)=>a.time.localeCompare(b.time,undefined,{numeric:true}));
 }

 let chart='';
 const good=series.filter(p=>p.value!==null);
 if(good.length>1&&series.length<=1000){
  const isRainVar=G.paletteKeyFor(l.cfg.value)==='rain';
  const isTempVar=/^(平均氣溫|氣溫)$/.test(l.cfg.value);
  const allVals=[...good.map(p=>p.value)];
  if(isTempVar){
   for(const p of series){if(p.hi!==null)allVals.push(p.hi);if(p.lo!==null)allVals.push(p.lo);}
  }
  let low=Math.min(...allVals),high=Math.max(...allVals);
  if(isRainVar){
   low=Math.min(0,...allVals);
   high=Math.max(1,...allVals);
   const sy=v=>18+(high-v)/(high-low)*77;
   const zeroY=sy(Math.max(low,Math.min(high,0)));
   const slotW=248/series.length;
   const barW=Math.max(1.2,Math.min(14,slotW*0.72));
   const bars=series.map((p,i)=>{
    if(p.value===null)return '';
    const bx=34+(i+0.5)*slotW-barW/2;
    const bh=p.value>0?Math.max(2,Math.abs(zeroY-sy(p.value))):1;
    const by=p.value>=0?zeroY-bh:zeroY;
    const fill=p.value>0?G.colorForVar(p.value,l.range,l.cfg.value):'#64748b';
    return `<rect x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}" fill="${fill}" rx="1"><title>${E(p.time)}: ${E(formatNum(p.value))} ${E(l.cfg.unit)}</title></rect>`;
   }).join('');
   chart=`<p class="hint">此測站時間變化（柱狀圖） · ${E(l.cfg.value)} (${E(l.cfg.unit||'mm')})</p>
    <svg viewBox="0 0 300 125" role="img" aria-label="選取位置降雨時間序列柱狀圖">
     <path d="M34 15V95H284" fill="none" stroke="#526f7d"/>
     ${bars}
     <text x="34" y="114" font-size="9" fill="#b1c6d1">${E(series[0].time)}</text>
     <text x="284" y="114" text-anchor="end" font-size="9" fill="#b1c6d1">${E(series.at(-1).time)}</text>
     <text x="4" y="24" font-size="9" fill="#b1c6d1">${Number(high.toFixed(1))}</text>
     <text x="4" y="95" font-size="9" fill="#b1c6d1">${Number(low.toFixed(1))}</text>
    </svg>`;
  }else{
   if(high===low)high=low+1;
   const sx=i=>34+i/(series.length-1)*248,sy=v=>18+(high-v)/(high-low)*75;
   const accentCol=G.paletteFor(l.cfg.value).at(-2)||'#71dbca';
   const mainPaths=buildLinePaths(series.map(p=>p.value),sx,sy);
   let extra='';
   if(isTempVar&&series.some(p=>p.hi!==null)&&series.some(p=>p.lo!==null)){
    const hiPaths=buildLinePaths(series.map(p=>p.hi),sx,sy);
    const loPaths=buildLinePaths(series.map(p=>p.lo),sx,sy);
    extra+=hiPaths.map(p=>`<polyline points="${p}" fill="none" stroke="#f08a65" stroke-width="1.2" stroke-dasharray="3,2"/>`).join('');
    extra+=loPaths.map(p=>`<polyline points="${p}" fill="none" stroke="#6db5e8" stroke-width="1.2" stroke-dasharray="3,2"/>`).join('');
   }
   chart=`<p class="hint">此測站時間變化 · ${E(l.cfg.value)} (${E(l.cfg.unit||'數值')})${extra?' · 虛線為高／低溫':''}</p>
    <svg viewBox="0 0 300 125" role="img" aria-label="選取位置時間序列">
     <path d="M34 15V95H284" fill="none" stroke="#526f7d"/>
     ${extra}
     ${mainPaths.map(p=>`<polyline points="${p}" fill="none" stroke="${accentCol}" stroke-width="2.2"/>`).join('')}
     <text x="34" y="114" font-size="9" fill="#b1c6d1">${E(series[0].time)}</text>
     <text x="284" y="114" text-anchor="end" font-size="9" fill="#b1c6d1">${E(series.at(-1).time)}</text>
     <text x="4" y="24" font-size="9" fill="#b1c6d1">${Number(high.toFixed(1))}</text>
     <text x="4" y="95" font-size="9" fill="#b1c6d1">${Number(low.toFixed(1))}</text>
    </svg>`;
  }
 }

 const subMeta=[props['站號']?`站號 ${props['站號']}`:'',props['縣市']||'',props['海拔(m)']!=null?`海拔 ${props['海拔(m)']} m`:'',props['時間']||''].filter(Boolean).join(' · ');
 $('detail-body').innerHTML=`<p class="eyebrow">ATMOSPHERIC INSPECTOR${l.demo?' / DEMO':''}</p>
  <h3>${E(props[l.cfg.name]??'空間圖徵')}</h3>
  ${subMeta?`<p class="hint" style="margin:0 0 6px">${E(subMeta)}</p>`:''}
  <p style="margin:0 0 6px">${E(l.cfg.value||'未指定測項')}：<b>${value===null?'缺測':E(formatNum(value))} ${E(l.cfg.unit)}</b></p>
  ${chips?`<div class="chip-grid">${chips}</div>`:''}
  ${chart}
  <table>${Object.entries(props).slice(0,60).map(([k,v])=>`<tr><th>${E(k)}</th><td>${E(typeof v==='object'&&v!==null?JSON.stringify(v):v)}</td></tr>`).join('')}</table>
  <p class="hint">${E(l.title)}${l.demo?' · 人工示範，非官方觀測':''}</p>`;
 lastFeatureClickAt=Date.now();
 $('detail').hidden=false;
}

$('detail-close').onclick=()=>{$('detail').hidden=true;};
map.on('click',e=>{if(e?.originalEvent?._featureClicked||Date.now()-lastFeatureClickAt<80)return;$('detail').hidden=true;});
document.addEventListener('click',e=>{
 if($('detail').hidden)return;
 if(e._featureClicked||Date.now()-lastFeatureClickAt<80)return;
 if(!e.target.closest('#detail'))$('detail').hidden=true;
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('detail').hidden)$('detail').hidden=true;});

$('export').onclick=()=>{
 const l=active();if(!l||l.kind==='kmz-overlays')return;
 const data={type:'FeatureCollection',metadata:{title:l.title,source:l.source,demo:l.demo,unit:l.cfg.unit,timeField:l.cfg.time,valueField:l.cfg.value},features:l.features};
 const blob=new Blob([JSON.stringify(data)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=`${l.demo?'DEMO-':''}climate-layer-${l.id}.geojson`;a.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
};

function catalog(){
 const s=$('search').value.trim().toLowerCase();
 const ds=DATASETS.filter(d=>`${d.name} ${d.id} ${d.desc}`.toLowerCase().includes(s));
 $('catalog-body').innerHTML=ds.map(d=>{
  const t=THEMES.find(x=>x.id===d.theme);
  return `<tr>
   <td><a href="${d.url}" target="_blank" rel="noopener">${E(d.name)} ↗</a><small>${d.id} · ${E(d.desc)}</small></td>
   <td>${E(t?.name||'')}</td>
   <td>${E(d.period)}</td>
   <td>${E(d.format)}</td>
   <td><button data-product="${d.id}">選擇</button></td>
  </tr>`;
 }).join('')||'<tr><td colspan="5">沒有符合的大氣資料產品。</td></tr>';

 const def=(window.DEFERRED_DATASETS||[]).filter(d=>`${d.name} ${d.id} ${d.category}`.toLowerCase().includes(s));
 const defBox=document.querySelector('#catalog .deferred-box');
 if(defBox)defBox.hidden=!(window.DEFERRED_DATASETS||[]).length;
 if($('deferred-body'))$('deferred-body').innerHTML=def.map(d=>`<tr>
  <td><a href="${d.url}" target="_blank" rel="noopener">${E(d.name)} ↗</a><small>${d.id}</small></td>
  <td><span class="deferred-tag">${E(d.category)}</span></td>
  <td class="hint">${E(d.reason)}</td>
 </tr>`).join('')||'<tr><td colspan="3">無符合項目。</td></tr>';
}

$('catalog-open').onclick=()=>{$('catalog').showModal();catalog();};
$('catalog-close').onclick=()=>$('catalog').close();
$('search').oninput=catalog;
$('catalog-body').onclick=e=>{
 const b=e.target.closest('[data-product]');
 if(b){
  const d=DATASETS.find(d=>d.id===b.dataset.product);
  selectTheme(d.theme,d.id);
  $('catalog').close();
  document.body.classList.remove('sidebar-closed');
 }
};

const initial=DATASETS.find(d=>d.id===location.hash.slice(1));
selectTheme(initial?initial.theme:THEMES[0].id,initial?.id);
