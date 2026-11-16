(function(root){
'use strict';

const CAT=root.STATION_COORDS
 ?{STATION_COORDS:root.STATION_COORDS,ATMOS_VARS:root.ATMOS_VARS}
 :(typeof require==='function'?require('./catalog.js'):{STATION_COORDS:{},ATMOS_VARS:{}});
const COORDS=CAT.STATION_COORDS||{};
const COORD_BY_NAME=new Map();
for(const [id,info] of Object.entries(COORDS)){
 if(info&&info[2]&&!COORD_BY_NAME.has(info[2]))COORD_BY_NAME.set(info[2],[id,info]);
}

const scalar=v=>v===null||['string','number','boolean'].includes(typeof v);
const asArr=v=>v===null||v===undefined?[]:(Array.isArray(v)?v:[v]);

function flatten(o,p='',out={}){
 if(!o||typeof o!=='object')return out;
 for(const [k,v] of Object.entries(o)){
  const key=p?`${p}.${k}`:k;
  if(scalar(v))out[key]=v;
  else if(!Array.isArray(v))flatten(v,key,out);
 }
 return out;
}

function genericTables(data){
 const found=[];let visited=0;
 function walk(v,path,context={},depth=0){
  if(depth>24||++visited>200000)return;
  if(Array.isArray(v)){
   const objects=v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
   if(objects.length){
    const rows=objects.map(o=>({...context,...flatten(o)}));
    if(rows.some(r=>Object.keys(r).length>Object.keys(context).length))found.push({path,rows});
    for(const o of objects)for(const [k,x] of Object.entries(o))if(x&&typeof x==='object')walk(x,`${path}.${k}`,{...context,...flatten(o)},depth+1);
   }else if(v.length&&v.every(scalar)){
    found.push({path,rows:v.map((value,index)=>({...context,index,value}))});
   }
  }else if(v&&typeof v==='object'){
   const next={...context,...flatten(v)};
   for(const [k,x] of Object.entries(v))if(x&&typeof x==='object')walk(x,path?`${path}.${k}`:k,next,depth+1);
  }
 }
 walk(data,'root');
 const grouped=new Map();
 for(const t of found){
  if(!grouped.has(t.path))grouped.set(t.path,[]);
  for(const row of t.rows)grouped.get(t.path).push(row);
 }
 if(!grouped.size&&data&&typeof data==='object')grouped.set('root',[flatten(data)]);
 return [...grouped].map(([path,rows])=>({path,rows}));
}

function csv(text){
 text=text.replace(/^\uFEFF/,'');
 let rows=[],row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}
  else if(c===','&&!quoted){row.push(cell);cell='';}
  else if((c==='\n'||c==='\r')&&!quoted){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);if(row.some(x=>x!==''))rows.push(row);
   row=[];cell='';
  }else cell+=c;
 }
 if(quoted)throw new Error('CSV 引號未閉合');
 row.push(cell);if(row.some(x=>x!==''))rows.push(row);
 if(rows.length<2)throw new Error('CSV 需要標題列及至少一筆資料');
 const headers=rows.shift();
 if(new Set(headers).size!==headers.length||headers.some(h=>!h.trim()))throw new Error('CSV 欄位名稱不可空白或重複');
 return rows.map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])));
}

function number(v){
 if(v===null||v===undefined||typeof v==='boolean'||String(v).trim()==='')return null;
 const s=String(v).trim();
 if(!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s))return null;
 const n=Number(s);
 return Number.isFinite(n)&&![-99,-99.9,-999,-9999].includes(n)?n:null;
}

function cwaNumber(v){
 if(v===null||v===undefined||typeof v==='boolean')return null;
 const raw=String(v).trim();
 if(!raw||/^(X|XXX|X,X|-|--|NA|N\/A|null)$/i.test(raw))return null;
 const cleaned=raw.startsWith('*')?raw.slice(1).trim():raw;
 const n=number(cleaned);
 if(n===null)return null;
 return n<=-90?null:n;
}

function rainNumber(v){
 if(v===null||v===undefined||typeof v==='boolean')return null;
 const raw=String(v).trim().replace(/^\*/,'').trim();
 if(raw.toUpperCase()==='T')return 0;
 return cwaNumber(raw);
}

function escape(s){
 return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function exportCSV(rows,keys){
 const q=v=>'"'+String(v??'').replace(/^(?=[=+@-])/,"'").replace(/"/g,'""')+'"';
 return '\uFEFF'+[keys.map(q).join(','),...rows.map(r=>keys.map(k=>q(r[k])).join(','))].join('\r\n');
}

function lookupStation(st={}){
 const sid=String(st.StationID||st.stationId||st.StationId||'').trim();
 const sname=String(st.StationName||st.stationName||'').trim();
 let lon=number(st.StationLongitude??st.longitude??st.lon);
 let lat=number(st.StationLatitude??st.latitude??st.lat);
 let county=st.CountyName||st.County?.CountyName||'';
 let alt=number(st.StationAltitude);
 let hit=sid&&COORDS[sid]?COORDS[sid]:null;
 if(!hit&&sname&&COORD_BY_NAME.has(sname))hit=COORD_BY_NAME.get(sname)[1];
 if(hit){
  if(lon===null||lat===null){lon=hit[0];lat=hit[1];}
  if(!county&&hit[3])county=hit[3];
  if(alt===null&&hit[4]!==undefined)alt=hit[4];
 }
 return{
  id:sid||sname,
  name:sname||(hit?hit[2]:sid),
  lon,lat,county,alt,
  attr:st.StationAttribute||''
 };
}

function baseStationFields(info){
 const out={'站號':info.id,'測站':info.name,'經度':info.lon,'緯度':info.lat};
 if(info.county)out['縣市']=info.county;
 if(info.alt!==null&&info.alt!==undefined)out['海拔(m)']=info.alt;
 if(info.attr)out['測站類型']=info.attr;
 return out;
}

const unescapeXML=s=>s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');

function parseXML(xml){
 if(typeof xml!=='string'||!xml.trim())throw new Error('XML 內容空白');
 const rootObj={};
 const stack=[{name:'__root__',obj:rootObj,text:'',hasChild:false}];
 const tokenRe=/<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[([\s\S]*?)\]\]>|<(\/?)([^\s>/]+)([^>]*?)(\/?)>|([^<]+)/g;
 let m;
 while((m=tokenRe.exec(xml))!==null){
  if(m[1]!==undefined){
   stack[stack.length-1].text+=m[1];
  }else if(m[6]!==undefined){
   if(stack.length>1)stack[stack.length-1].text+=unescapeXML(m[6]);
  }else if(m[3]){
   const isClose=m[2]==='/';
   const selfClose=m[5]==='/';
   const rawName=m[3];
   const tag=rawName.includes(':')?rawName.split(':').pop():rawName;
   if(!isClose){
    stack[stack.length-1].hasChild=true;
    const node={name:tag,obj:{},text:'',hasChild:false};
    stack.push(node);
    if(selfClose){
     const closed=stack.pop();
     const parent=stack[stack.length-1].obj;
     if(parent[tag]===undefined)parent[tag]=null;
     else if(Array.isArray(parent[tag]))parent[tag].push(null);
     else parent[tag]=[parent[tag],null];
    }
   }else{
    if(stack.length<=1)continue;
    const closed=stack.pop();
    const parent=stack[stack.length-1].obj;
    let val;
    if(closed.hasChild)val=closed.obj;
    else{
     const t=closed.text.trim();
     val=t===''?null:t;
    }
    if(parent[closed.name]===undefined)parent[closed.name]=val;
    else if(Array.isArray(parent[closed.name]))parent[closed.name].push(val);
    else parent[closed.name]=[parent[closed.name],val];
   }
  }
 }
 return rootObj;
}

function round1(v){return Math.round(v*10)/10;}
function round2(v){return Math.round(v*100)/100;}

function parseAgrObs(res,meta){
 const temp=meta?.temporal||{};
 const ym=temp.dataYearMonth||'';
 const td=temp.tenDayNumber?`第${temp.tenDayNumber}旬`:'';
 const period=ym&&td?`${ym} ${td}`:(ym||temp.description||'當期');
 const isTenDay=!!temp.tenDayNumber||/旬/.test(meta?.resourceName||'');
 const rows=[];
 for(const loc of asArr(res.data?.agrObs?.location)){
  const info=lookupStation(loc.station||{});
  const s=loc.agrTenDayStatistics||loc.agrMonthlyStatistics||{};
  const flagged=[];
  for(const [k,v] of Object.entries(s)){
   if(typeof v==='string'&&v.startsWith('*'))flagged.push(k);
  }
  rows.push({
   ...baseStationFields(info),
   '時間':period,
   '平均氣溫':cwaNumber(s.TemperatureMean),
   '最高氣溫':cwaNumber(s.MaxTemperature),
   '最高溫日期':s.MaxTemperatureDate&&s.MaxTemperatureDate!=='XXX'?s.MaxTemperatureDate:'',
   '最低氣溫':cwaNumber(s.MinTemperature),
   '最低溫日期':s.MinTemperatureDate&&s.MinTemperatureDate!=='XXX'?s.MinTemperatureDate:'',
   '平均相對濕度':cwaNumber(s.RelativeHumidityMean),
   '降水量':rainNumber(s.Precipitation),
   '平均風速':cwaNumber(s.WindSpeedMean),
   '最多風向':s.PrevailingWindDirection&&!/^(XXX|-)$/.test(s.PrevailingWindDirection)?String(s.PrevailingWindDirection).replace(/^\*/,''):'',
   '日照時數':cwaNumber(s.SunshineDuration),
   '日射量':cwaNumber(s.SolarRadiation),
   '0cm地溫':cwaNumber(s.SoilTemperatureAt0cm),
   '5cm地溫':cwaNumber(s.SoilTemperatureAt5cm),
   '10cm地溫':cwaNumber(s.SoilTemperatureAt10cm),
   '20cm地溫':cwaNumber(s.SoilTemperatureAt20cm),
   '50cm地溫':cwaNumber(s.SoilTemperatureAt50cm),
   '100cm地溫':cwaNumber(s.SoilTemperatureAt100cm),
   '資料註記':flagged.length?'部分日缺測 (*)':'完整'
  });
 }
 return[{path:isTenDay?'農業氣象網旬統計':'農業氣象網月統計',rows,defaultVar:'平均氣溫'}];
}

function parseB0024(locs){
 const hourlyRows=[],dailyRows=[],monthlyMap=new Map();
 for(const loc of locs){
  const info=lookupStation(loc.station||{});
  const base=baseStationFields(info);
  const dailyStatMap=new Map();
  for(const d of asArr(loc.stationObsStatistics?.AirTemperature?.daily)){
   if(d?.Date)dailyStatMap.set(d.Date,d);
  }
  const dayAgg=new Map();
  const times=asArr(loc.stationObsTimes?.stationObsTime);
  for(const obs of times){
   const dt=String(obs.DateTime||'');
   const el=obs.weatherElements||{};
   const temp=cwaNumber(el.AirTemperature);
   const rain=rainNumber(el.Precipitation);
   const pres=cwaNumber(el.AirPressure);
   const rh=cwaNumber(el.RelativeHumidity);
   const ws=cwaNumber(el.WindSpeed);
   const sun=cwaNumber(el.SunshineDuration);
   const wd=el.WindDirection&&!/^(X|X,X|-)$/.test(String(el.WindDirection))?el.WindDirection:'';
   hourlyRows.push({
    ...base,'時間':dt,'平均氣溫':temp,'降水量':rain,'測站氣壓':pres,
    '相對濕度':rh,'風速':ws,'風向':wd,'日照時數':sun
   });
   const date=dt.slice(0,10);
   if(date){
    let da=dayAgg.get(date);
    if(!da){da={tSum:0,tCnt:0,tMax:-Infinity,tMin:Infinity,rSum:0,rHas:false,pSum:0,pCnt:0,hSum:0,hCnt:0,wSum:0,wCnt:0,wMax:-Infinity,sSum:0,sHas:false};dayAgg.set(date,da);}
    if(temp!==null){da.tSum+=temp;da.tCnt++;da.tMax=Math.max(da.tMax,temp);da.tMin=Math.min(da.tMin,temp);}
    if(rain!==null){da.rSum+=rain;da.rHas=true;}
    if(pres!==null){da.pSum+=pres;da.pCnt++;}
    if(rh!==null){da.hSum+=rh;da.hCnt++;}
    if(ws!==null){da.wSum+=ws;da.wCnt++;da.wMax=Math.max(da.wMax,ws);}
    if(sun!==null){da.sSum+=sun;da.sHas=true;}
   }
  }
  const allDates=[...new Set([...dailyStatMap.keys(),...dayAgg.keys()])].sort();
  for(const date of allDates){
   const st=dailyStatMap.get(date);
   const da=dayAgg.get(date);
   const meanT=st?cwaNumber(st.Mean):(da&&da.tCnt?round1(da.tSum/da.tCnt):null);
   const maxT=st?cwaNumber(st.Maximum):(da&&da.tCnt?round1(da.tMax):null);
   const minT=st?cwaNumber(st.Minimum):(da&&da.tCnt?round1(da.tMin):null);
   const rain=da&&da.rHas?round1(da.rSum):null;
   const pres=da&&da.pCnt?round1(da.pSum/da.pCnt):null;
   const rh=da&&da.hCnt?round1(da.hSum/da.hCnt):null;
   const ws=da&&da.wCnt?round1(da.wSum/da.wCnt):null;
   const wMax=da&&da.wCnt?round1(da.wMax):null;
   const sun=da&&da.sHas?round1(da.sSum):null;
   dailyRows.push({
    ...base,'時間':date,'平均氣溫':meanT,'最高氣溫':maxT,'最低氣溫':minT,
    '降水量':rain,'平均氣壓':pres,'平均相對濕度':rh,'平均風速':ws,'最大風速':wMax,'日照時數':sun
   });
   const ym=date.slice(0,7);
   if(ym){
    const mk=`${info.id}|${ym}`;
    let ma=monthlyMap.get(mk);
    if(!ma){ma={base,ym,tSum:0,tCnt:0,tMax:-Infinity,tMin:Infinity,rSum:0,rHas:false,rainDays:0,pSum:0,pCnt:0,hSum:0,hCnt:0,wSum:0,wCnt:0,sSum:0,sHas:false};monthlyMap.set(mk,ma);}
    if(meanT!==null){ma.tSum+=meanT;ma.tCnt++;}
    if(maxT!==null)ma.tMax=Math.max(ma.tMax,maxT);
    if(minT!==null)ma.tMin=Math.min(ma.tMin,minT);
    if(rain!==null){ma.rSum+=rain;ma.rHas=true;if(rain>=0.1)ma.rainDays++;}
    if(pres!==null){ma.pSum+=pres;ma.pCnt++;}
    if(rh!==null){ma.hSum+=rh;ma.hCnt++;}
    if(ws!==null){ma.wSum+=ws;ma.wCnt++;}
    if(sun!==null){ma.sSum+=sun;ma.sHas=true;}
   }
  }
 }
 const tables=[{path:'每日大氣統計（建議地圖探索）',rows:dailyRows,defaultVar:'平均氣溫'}];
 if(hourlyRows.length>60000){
  const monthlyRows=[...monthlyMap.values()].map(ma=>({
   ...ma.base,'時間':ma.ym,
   '平均氣溫':ma.tCnt?round1(ma.tSum/ma.tCnt):null,
   '最高氣溫':ma.tMax>-Infinity?round1(ma.tMax):null,
   '最低氣溫':ma.tMin<Infinity?round1(ma.tMin):null,
   '累積雨量':ma.rHas?round1(ma.rSum):null,
   '降水日數':ma.rHas?ma.rainDays:null,
   '平均氣壓':ma.pCnt?round1(ma.pSum/ma.pCnt):null,
   '平均相對濕度':ma.hCnt?round1(ma.hSum/ma.hCnt):null,
   '平均風速':ma.wCnt?round1(ma.wSum/ma.wCnt):null,
   '日照時數':ma.sHas?round1(ma.sSum):null
  }));
  tables.push({path:'逐月大氣統計',rows:monthlyRows,defaultVar:'平均氣溫'});
  const allTimes=[...new Set(hourlyRows.map(r=>r['時間']))].sort();
  const cutoff=allTimes[Math.max(0,allTimes.length-720)]||'';
  tables.push({path:'近 30 日逐時觀測資料',rows:hourlyRows.filter(r=>r['時間']>=cutoff),defaultVar:'平均氣溫'});
 }else if(hourlyRows.length){
  tables.push({path:'逐時觀測資料',rows:hourlyRows,defaultVar:'平均氣溫'});
 }
 return tables.filter(t=>t.rows.length);
}

function parseB0025(locs){
 const dailyRows=[],monthlyRows=[],monthAgg=new Map();
 for(const loc of locs){
  const info=lookupStation(loc.station||{});
  const base=baseStationFields(info);
  const times=asArr(loc.stationObsTimes?.stationObsTime);
  for(const obs of times){
   const date=String(obs.Date||'');
   const rawP=obs.weatherElements?.Precipitation;
   const val=rainNumber(rawP);
   dailyRows.push({
    ...base,'時間':date,'降水量':val,
    '原始雨量標記':String(rawP??'').trim().toUpperCase()==='T'?'T（微量 <0.1mm）':(val===null?String(rawP??'缺測'):'')
   });
   const ym=date.slice(0,7);
   if(ym){
    const k=`${info.id}|${ym}`;
    let m=monthAgg.get(k);
    if(!m){m={base,ym,sum:0,valid:0,rainDays:0};monthAgg.set(k,m);}
    if(val!==null){m.sum+=val;m.valid++;if(val>=0.1)m.rainDays++;}
   }
  }
  const officialMonthly=asArr(loc.stationObsStatistics?.Precipitation?.monthly);
  for(const m of officialMonthly){
   if(!m?.YearMonth)continue;
   const total=rainNumber(m.Total);
   const k=`${info.id}|${m.YearMonth}`;
   const calc=monthAgg.get(k);
   monthlyRows.push({
    ...base,'時間':m.YearMonth,'月總雨量':total,
    '降水日數':calc&&calc.valid?calc.rainDays:null,
    '有效日數':calc?calc.valid:null
   });
  }
 }
 const computedMonthly=[...monthAgg.values()].map(m=>({
  ...m.base,'時間':m.ym,'累積雨量':m.valid?round1(m.sum):null,'降水日數':m.valid?m.rainDays:null,'有效日數':m.valid
 }));
 if(locs.length>150){
  const seasonAgg=new Map();
  for(const m of monthAgg.values()){
   const sid=m.base['站號'];
   let s=seasonAgg.get(sid);
   if(!s){s={base:m.base,sum:0,valid:0,rainDays:0};seasonAgg.set(sid,s);}
   if(m.valid){s.sum+=m.sum;s.valid+=m.valid;s.rainDays+=m.rainDays;}
  }
  const seasonRows=[...seasonAgg.values()].map(s=>({
   ...s.base,'時間':'全季合計','累積雨量':s.valid?round1(s.sum):null,'降水日數':s.valid?s.rainDays:null,'有效日數':s.valid
  }));
  return[
   {path:'各月累積雨量（建議地圖探索）',rows:computedMonthly,defaultVar:'累積雨量'},
   {path:'全季總雨量統計',rows:seasonRows,defaultVar:'累積雨量'},
   {path:'逐日降水量（620 站）',rows:dailyRows,defaultVar:'降水量'}
  ].filter(t=>t.rows.length);
 }
 if(monthlyRows.length){
  return[
   {path:'逐月總雨量統計',rows:monthlyRows,defaultVar:'月總雨量'},
   {path:'逐日降水量',rows:dailyRows,defaultVar:'降水量'}
  ].filter(t=>t.rows.length);
 }
 return[
  {path:'逐月累積雨量',rows:computedMonthly,defaultVar:'累積雨量'},
  {path:'逐日降水量',rows:dailyRows,defaultVar:'降水量'}
 ].filter(t=>t.rows.length);
}

function parseB0026(locs){
 const rows=[];
 for(const loc of locs){
  const info=lookupStation(loc.station||{});
  const s=loc.stationObsStatistics||{};
  const ym=String(s.YearMonth||'');
  const at=s.AirTemperature?.monthly||{};
  const pr=s.Precipitation?.monthly||{};
  const ws=s.WindSpeed?.monthly||{};
  const wd=s.WindDirection?.monthly||{};
  const gs=s.PeakGustSpeed?.monthly||{};
  const gd=s.PeakGustDirection?.monthly||{};
  const rh=s.RelativeHumidity?.monthly||{};
  const ap=s.AirPressure?.monthly||{};
  const sd=s.SunshineDuration?.monthly||{};
  rows.push({
   ...baseStationFields(info),
   '時間':ym,
   '平均氣溫':cwaNumber(at.Mean),
   '最高氣溫':cwaNumber(at.Maximum),
   '最高溫日期':at.MaximumDate||'',
   '最低氣溫':cwaNumber(at.Minimum),
   '最低溫日期':at.MinimumDate||'',
   '累積雨量':rainNumber(pr.Accumulation),
   '降水日數':cwaNumber(pr.GE01Days),
   '平均相對濕度':cwaNumber(rh.Mean),
   '最小相對濕度':cwaNumber(rh.Minimum),
   '最小濕度日期':rh.MinimumDate||'',
   '平均氣壓':cwaNumber(ap.Mean),
   '日照時數':cwaNumber(sd.Total),
   '最大風速':cwaNumber(ws.Maximum),
   '最大風速風向':cwaNumber(wd.Maximum),
   '最大風速日期':ws.MaximumDate||'',
   '最大陣風':cwaNumber(gs.Maximum),
   '最大陣風風向':cwaNumber(gd.Maximum),
   '最大陣風日期':gs.MaximumDate||''
  });
 }
 return[{path:'逐月多要素氣象資料',rows,defaultVar:'平均氣溫'}];
}

function parseB0027(locs){
 const rows=[];
 for(const loc of locs){
  const info=lookupStation(loc.station||{});
  const base=baseStationFields(info);
  const s=loc.stationObsStatistics||{};
  const byMonth=new Map();
  const ensure=m=>{
   const mm=String(m).padStart(2,'0');
   if(!byMonth.has(mm))byMonth.set(mm,{...base,'時間':`${mm}月`,'月份數值':Number(m)});
   return byMonth.get(mm);
  };
  let periodNote='';
  const readPeriod=el=>{
   if(!periodNote&&el?.StationStartYear&&el?.StationEndYear){
    periodNote=`${el.StationStartYear}–${el.StationEndYear}`;
   }
  };
  readPeriod(s.AirTemperature);
  for(const m of asArr(s.AirTemperature?.monthly)){
   const r=ensure(m.Month);
   r['平均氣溫']=cwaNumber(m.Mean);
   r['平均最高溫']=cwaNumber(m.Maximum);
   r['平均最低溫']=cwaNumber(m.Minimum);
   r['最高溫≥30°C日數']=cwaNumber(m.maxGE30Days);
   r['日均溫≥25°C日數']=cwaNumber(m.meanGE25Days);
   r['最低溫≤10°C日數']=cwaNumber(m.minLE10Days);
  }
  readPeriod(s.Precipitation);
  for(const m of asArr(s.Precipitation?.monthly)){
   const r=ensure(m.Month);
   r['累積雨量']=rainNumber(m.Accumulation);
   r['降水日數']=cwaNumber(m.GE01Days);
  }
  readPeriod(s.RelativeHumidity);
  for(const m of asArr(s.RelativeHumidity?.monthly)){ensure(m.Month)['平均相對濕度']=cwaNumber(m.Mean);}
  readPeriod(s.AirPressure);
  for(const m of asArr(s.AirPressure?.monthly)){ensure(m.Month)['平均氣壓']=cwaNumber(m.Mean);}
  readPeriod(s.SunshineDuration);
  for(const m of asArr(s.SunshineDuration?.monthly)){ensure(m.Month)['日照時數']=cwaNumber(m.Total);}
  readPeriod(s.WindSpeed);
  for(const m of asArr(s.WindSpeed?.monthly)){ensure(m.Month)['平均風速']=cwaNumber(m.Mean);}
  readPeriod(s.CloudAmount);
  for(const m of asArr(s.CloudAmount?.monthly)){ensure(m.Month)['平均雲量']=cwaNumber(m.Mean);}
  const sorted=[...byMonth.values()].sort((a,b)=>a['月份數值']-b['月份數值']);
  for(const r of sorted){delete r['月份數值'];if(periodNote)r['統計期間']=periodNote;rows.push(r);}
 }
 return[{path:'30 年氣候月平均（1–12 月）',rows,defaultVar:'平均氣溫'}];
}

const round3=v=>Math.round(v*1000)/1000;

function parseB0074(list){
 const rows=asArr(list).map(s=>({
  '站號':s.StationID||'',
  '測站':s.StationName||'',
  '經度':number(s.StationLongitude),
  '緯度':number(s.StationLatitude),
  '縣市':s.CountyName||'',
  '海拔(m)':cwaNumber(s.StationAltitude),
  '狀態':s.status||'',
  '地址':s.Location||'',
  '設站日期':s.StationStartDate||'',
  '撤站日期':s.StationEndDate||'',
  '備註':s.Notes||''
 })).filter(r=>r['經度']!==null&&r['緯度']!==null);
 const activeRows=rows.filter(r=>r['狀態']==='現存測站'||!r['撤站日期']);
 return[
  {path:'現存測站基本資料',rows:activeRows,defaultVar:'海拔(m)'},
  {path:'全部測站基本資料（含撤銷站）',rows:rows,defaultVar:'海拔(m)'}
 ].filter(t=>t.rows.length);
}

function marineKind(locs,datasetId=''){
 if(/C-B0049/i.test(datasetId))return 'wave';
 if(/C-B0050/i.test(datasetId))return 'seatemp';
 if(/C-B0052/i.test(datasetId))return 'tide';
 for(const loc of locs){
  const st=loc.StationObsStatistics||{};
  const sample=[...asArr(st.Monthly),...asArr(st.Annual)][0];
  if(!sample)continue;
  if(sample.WaveHeight||sample.MaximumWaveHeight)return 'wave';
  if(sample.SeaTemperature)return 'seatemp';
  if(sample.MeanTidalRange!==undefined||sample.HighestHighWaterLevel!==undefined)return 'tide';
 }
 return 'wave';
}

function mapMarineRecord(base,timeLabel,kind,rec){
 if(kind==='wave'){
  const mx=rec.MaximumWaveHeight||{};
  return{
   ...base,'時間':timeLabel,
   '平均示性波高':cwaNumber(rec.WaveHeight?.Mean),
   '最大示性波高':cwaNumber(mx.WaveHeight),
   '尖峰週期':cwaNumber(mx.PeakWavePeriod),
   '平均週期':cwaNumber(rec.WavePeriod?.Mean),
   '主波向':cwaNumber(mx.WaveDirection),
   '最大波發生時間':mx.MaximumTime&&mx.MaximumTime!=='-'?mx.MaximumTime:'',
   '觀測次數':cwaNumber(rec.Samples)
  };
 }
 if(kind==='seatemp'){
  const st=rec.SeaTemperature||{};
  return{
   ...base,'時間':timeLabel,
   '平均海溫':cwaNumber(st.Mean),
   '最高海溫':cwaNumber(st.Maximum),
   '最低海溫':cwaNumber(st.Minimum),
   '平均海溫距平':cwaNumber(st.MeanAnomaly),
   '最高海溫距平':cwaNumber(st.MaximumAnomaly),
   '最低海溫距平':cwaNumber(st.MinimumAnomaly),
   '最高溫年份':st.MaximumYear||'',
   '最低溫年份':st.MinimumYear||''
  };
 }
 return{
  ...base,'時間':timeLabel,
  '平均潮差':cwaNumber(rec.MeanTidalRange),
  '最高高潮位':cwaNumber(rec.HighestHighWaterLevel),
  '最低低潮位':cwaNumber(rec.LowestLowWaterLevel),
  '平均潮位':cwaNumber(rec.MeanTideLevel),
  '最大天文潮差':cwaNumber(rec.MaxAstronomicalTidalRange),
  '最高天文潮位':cwaNumber(rec.HighestAstronomicalTide),
  '最低天文潮位':cwaNumber(rec.LowestAstronomicalTide),
  '大潮平均高潮位':cwaNumber(rec.MeanHighWaterOfSpringTide),
  '大潮平均低潮位':cwaNumber(rec.MeanLowWaterOfSpringTide)
 };
}

function parseSeaSurfaceObs(locs,datasetId=''){
 const kind=marineKind(locs,datasetId);
 const defVar=kind==='wave'?'平均示性波高':(kind==='seatemp'?'平均海溫':'平均潮差');
 const climRows=[],monthlyRows=[],annualRows=[];
 for(const loc of locs){
  const info=lookupStation(loc.Station||loc.station||{});
  const base=baseStationFields(info);
  const st=loc.StationObsStatistics||{};
  const years=asArr(st.DataYear).map(String);
  const periodNote=(st.StartYear&&st.EndYear)?`${st.StartYear}–${st.EndYear}`:'';
  const monthly=asArr(st.Monthly);
  const groups=[];
  for(const m of monthly){
   if(!groups.length||Number(m.DataMonth)<=Number(groups[groups.length-1][groups[groups.length-1].length-1].DataMonth)){
    groups.push([]);
   }
   groups[groups.length-1].push(m);
  }
  if(groups[0]){
   for(const m of groups[0]){
    const mm=String(m.DataMonth).padStart(2,'0');
    const row=mapMarineRecord(base,`${mm}月`,kind,m);
    if(periodNote)row['統計期間']=periodNote;
    climRows.push(row);
   }
  }
  for(let g=1;g<groups.length;g++){
   const yr=years[g-1];
   if(!yr)continue;
   for(const m of groups[g]){
    const mm=String(m.DataMonth).padStart(2,'0');
    monthlyRows.push(mapMarineRecord(base,`${yr}-${mm}`,kind,m));
   }
  }
  const annual=asArr(st.Annual);
  for(let i=1;i<annual.length;i++){
   const yr=years[i-1];
   if(!yr)continue;
   annualRows.push(mapMarineRecord(base,yr,kind,annual[i]));
  }
 }
 climRows.sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 monthlyRows.sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 annualRows.sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 return[
  {path:'氣候月統計（1–12 月）',rows:climRows,defaultVar:defVar},
  {path:'歷年逐月統計',rows:monthlyRows,defaultVar:defVar},
  {path:'歷年年統計',rows:annualRows,defaultVar:defVar}
 ].filter(t=>t.rows.length);
}

function parseTyphSurge(typhObs){
 const names=asArr(typhObs.TyphName);
 const locGroups=asArr(typhObs.Locations);
 const eventRows=[];
 const stationMax=new Map();
 const n=Math.min(names.length,locGroups.length);
 for(let i=0;i<n;i++){
  const tyName=String(names[i]||'').trim();
  const locs=asArr(locGroups[i]?.Location);
  let ym='';
  for(const loc of locs){
   const st=loc.StationObsStatistics||{};
   const t=st.MaximumSurgeHeight?.MaximumTime||st.SurgeAnomaly?.MaximumDate||'';
   if(/^\d{4}-\d{2}/.test(String(t))){ym=String(t).slice(0,7);break;}
  }
  const tLabel=ym?`${ym} ${tyName}`:tyName;
  for(const loc of locs){
   const info=lookupStation(loc.Station||loc.station||{});
   const st=loc.StationObsStatistics||{};
   const surge=cwaNumber(st.MaximumSurgeHeight?.SurgeHeight);
   const anom=cwaNumber(st.SurgeAnomaly?.Maximum);
   const maxTime=st.MaximumSurgeHeight?.MaximumTime||'';
   const row={
    ...baseStationFields(info),
    '時間':tLabel,
    '颱風名稱':tyName,
    '最大暴潮高':surge,
    '最大暴潮偏差':anom,
    '最低暴潮偏差':cwaNumber(st.SurgeAnomaly?.Minimum),
    '暴潮發生時間':maxTime
   };
   eventRows.push(row);
   const sk=info.id||info.name;
   if(sk&&surge!==null){
    const cur=stationMax.get(sk);
    if(!cur||surge>cur['歷史最大暴潮高']){
     stationMax.set(sk,{
      ...baseStationFields(info),
      '歷史最大暴潮高':surge,
      '最大暴潮偏差':anom,
      '發生颱風':tLabel,
      '發生時間':maxTime
     });
    }
   }
  }
 }
 eventRows.sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 const maxRows=[...stationMax.values()];
 return[
  {path:'歷次颱風暴潮極值（依颱風事件）',rows:eventRows,defaultVar:'最大暴潮高'},
  {path:'各測站歷史最大暴潮統計',rows:maxRows,defaultVar:'歷史最大暴潮高'}
 ].filter(t=>t.rows.length);
}

function parseCWA(raw,datasetId=''){
 if(!raw||typeof raw!=='object')return null;
 if(Array.isArray(raw._cwaTables))return raw._cwaTables;
 const cwa=raw.cwaopendata;
 if(!cwa)return null;
 const res=cwa.resources?.resource||cwa.Resources?.Resource;
 const data=res?.data||res?.Data;
 if(!data)return null;
 const meta=res.metadata||res.Metadata||{};
 if(data.stationsStatus?.station)return parseB0074(data.stationsStatus.station);
 if(data.agrObs)return parseAgrObs(res,meta);
 const sea=data.SeaSurfaceObs||data.seaSurfaceObs;
 if(sea?.Location||sea?.location)return parseSeaSurfaceObs(asArr(sea.Location||sea.location),datasetId);
 const typh=data.TyphObs||data.typhObs;
 if(typh?.Locations)return parseTyphSurge(typh);
 const surf=data.surfaceObs;
 if(!surf)return null;
 const locs=asArr(surf.location);
 if(!locs.length)return null;
 const sample=locs[0];
 if(sample.stationObsStatistics?.YearMonth!==undefined)return parseB0026(locs);
 if(asArr(sample.stationObsStatistics?.AirTemperature?.monthly).length||
    asArr(sample.stationObsStatistics?.Precipitation?.monthly).some(m=>m?.Month!==undefined)){
  return parseB0027(locs);
 }
 const sampleTimes=asArr(sample.stationObsTimes?.stationObsTime);
 const hasHourlyDT=sampleTimes.some(t=>t?.DateTime!==undefined);
 const hasMultiElem=sampleTimes.some(t=>t?.weatherElements&&Object.keys(t.weatherElements).some(k=>k!=='Precipitation'));
 if(hasHourlyDT||hasMultiElem||sample.stationObsStatistics?.AirTemperature?.daily||/^C-B0024/i.test(datasetId)){
  return parseB0024(locs);
 }
 if(sampleTimes.some(t=>t?.Date!==undefined)||sample.stationObsStatistics?.Precipitation?.monthly||/^C-B0025/i.test(datasetId)){
  return parseB0025(locs);
 }
 return null;
}

function tables(data,datasetId=''){
 const cwaTables=parseCWA(data,datasetId);
 if(cwaTables&&cwaTables.length)return cwaTables;
 return genericTables(data);
}

/* ZIP 中央目錄解析與解壓（支援瀏覽器 DecompressionStream 與 Node zlib） */
function readZipDirectory(buf){
 const u8=buf instanceof Uint8Array?buf:new Uint8Array(buf);
 const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
 let eocd=-1;
 for(let i=u8.length-22;i>=Math.max(0,u8.length-65558);i--){
  if(dv.getUint32(i,true)===0x06054b50){eocd=i;break;}
 }
 if(eocd<0)throw new Error('無效的 ZIP 封存檔（找不到中央目錄）');
 const total=dv.getUint16(eocd+10,true);
 const cdOffset=dv.getUint32(eocd+16,true);
 const entries=[];
 let p=cdOffset;
 const dec=new TextDecoder('utf-8');
 for(let idx=0;idx<total&&p+46<=u8.length;idx++){
  if(dv.getUint32(p,true)!==0x02014b50)break;
  const comp=dv.getUint16(p+10,true);
  const csize=dv.getUint32(p+20,true);
  const usize=dv.getUint32(p+24,true);
  const nlen=dv.getUint16(p+28,true);
  const elen=dv.getUint16(p+30,true);
  const clen=dv.getUint16(p+32,true);
  const lhoff=dv.getUint32(p+42,true);
  const name=dec.decode(u8.subarray(p+46,p+46+nlen));
  entries.push({name,comp,csize,usize,lhoff});
  p+=46+nlen+elen+clen;
 }
 return{u8,dv,entries};
}

async function inflateRaw(raw){
 if(typeof require==='function'){
  return new Uint8Array(require('zlib').inflateRawSync(raw));
 }
 if(typeof DecompressionStream!=='undefined'){
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([raw]).stream().pipeThrough(ds);
  const ab=await new Response(stream).arrayBuffer();
  return new Uint8Array(ab);
 }
 throw new Error('此瀏覽器不支援 deflate-raw 解壓縮，請更新瀏覽器或先本機解壓匯入。');
}

async function extractZipEntry(u8,dv,entry){
 const lh=entry.lhoff;
 const nlen=dv.getUint16(lh+26,true);
 const elen=dv.getUint16(lh+28,true);
 const start=lh+30+nlen+elen;
 const raw=u8.subarray(start,start+entry.csize);
 if(entry.comp===0)return raw;
 if(entry.comp===8)return inflateRaw(raw);
 throw new Error(`不支援的 ZIP 壓縮方法 (${entry.comp})`);
}

function parseKMLOverlay(kmlText){
 const box=kmlText.match(/<LatLonBox>([\s\S]*?)<\/LatLonBox>/i)?.[1]||'';
 const tag=name=>number(box.match(new RegExp(`<${name}>([^<]+)<\\/${name}>`,'i'))?.[1]);
 const north=tag('north'),south=tag('south'),east=tag('east'),west=tag('west');
 if([north,south,east,west].some(v=>v===null))return null;
 const href=kmlText.match(/<GroundOverlay>[\s\S]*?<Icon>[\s\S]*?<href>([^<]+)<\/href>/i)?.[1]?.trim()||'';
 return{bounds:[[south,west],[north,east]],href};
}

function parseOverlayTime(name){
 const m=name.match(/(20\d{2})(\d{2})/);
 return m?{time:`${m[1]}-${m[2]}`,label:`${m[1]} 年 ${m[2]} 月`}:{time:name,label:name};
}

async function parseKMZ(buffer,entryName){
 const {u8,dv,entries}=readZipDirectory(buffer);
 const kmlEntry=entries.find(e=>/\.kml$/i.test(e.name));
 if(!kmlEntry)return null;
 const dec=new TextDecoder('utf-8');
 const kmlText=dec.decode(await extractZipEntry(u8,dv,kmlEntry));
 const info=parseKMLOverlay(kmlText);
 if(!info)return null;
 const pngEntry=entries.find(e=>info.href&&e.name.toLowerCase().endsWith(info.href.toLowerCase()))
  ||entries.find(e=>/\.(png|jpe?g|webp)$/i.test(e.name)&&!/colormap/i.test(e.name));
 if(!pngEntry)return null;
 const bytes=await extractZipEntry(u8,dv,pngEntry);
 const mime=/\.png$/i.test(pngEntry.name)?'image/png':'image/jpeg';
 const {time,label}=parseOverlayTime(entryName||pngEntry.name);
 const url=typeof URL!=='undefined'&&typeof Blob!=='undefined'&&URL.createObjectURL
  ?URL.createObjectURL(new Blob([bytes],{type:mime})):null;
 return{time,label,name:entryName||pngEntry.name,bounds:info.bounds,mime,bytes,url};
}

function lzwDecode(input,expectedLen){
 const out=new Uint8Array(expectedLen);
 const prefix=new Int32Array(4096);
 const suffix=new Uint8Array(4096);
 const firstChar=new Uint8Array(4096);
 const stack=new Uint8Array(4096);
 for(let i=0;i<256;i++){prefix[i]=-1;suffix[i]=i;firstChar[i]=i;}
 let outPos=0,bytePos=0,bitBuf=0,bitsLeft=0;
 let codeSize=9,nextCode=258,oldCode=-1;
 const nextBitCode=()=>{
  while(bitsLeft<codeSize){
   if(bytePos>=input.length)return -1;
   bitBuf=(bitBuf<<8)|input[bytePos++];
   bitsLeft+=8;
  }
  const code=(bitBuf>>>(bitsLeft-codeSize))&((1<<codeSize)-1);
  bitsLeft-=codeSize;
  bitBuf&=(1<<bitsLeft)-1;
  return code;
 };
 while(outPos<expectedLen){
  const code=nextBitCode();
  if(code<0||code===257)break;
  if(code===256){
   codeSize=9;nextCode=258;oldCode=-1;
   continue;
  }
  let sp=0,first=0;
  if(code<nextCode){
   let cur=code;
   first=firstChar[code];
   while(cur>=256&&sp<4096){stack[sp++]=suffix[cur];cur=prefix[cur];}
   if(cur>=0&&sp<4096)stack[sp++]=cur;
  }else if(code===nextCode&&oldCode>=0){
   first=firstChar[oldCode];
   stack[sp++]=first;
   let cur=oldCode;
   while(cur>=256&&sp<4096){stack[sp++]=suffix[cur];cur=prefix[cur];}
   if(cur>=0&&sp<4096)stack[sp++]=cur;
  }else break;
  for(let i=sp-1;i>=0&&outPos<expectedLen;i--)out[outPos++]=stack[i];
  if(oldCode>=0&&nextCode<4096){
   prefix[nextCode]=oldCode;
   suffix[nextCode]=first;
   firstChar[nextCode]=firstChar[oldCode];
   nextCode++;
   if(nextCode===511)codeSize=10;
   else if(nextCode===1023)codeSize=11;
   else if(nextCode===2047)codeSize=12;
  }
  oldCode=code;
 }
 return outPos===expectedLen?out:out.subarray(0,outPos);
}

function parseGeoTiffHeader(u8){
 const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
 const le=u8[0]===0x49&&u8[1]===0x49;
 const ifdOffset=dv.getUint32(4,le);
 const num=dv.getUint16(ifdOffset,le);
 const TYPE_SZ={1:1,2:1,3:2,4:4,5:8,6:1,8:2,9:4,11:4,12:8};
 const readVals=(type,count,eOff)=>{
  const sz=TYPE_SZ[type]||1;
  const off=count*sz<=4?eOff+8:dv.getUint32(eOff+8,le);
  if(type===2)return new TextDecoder('ascii').decode(u8.subarray(off,off+Math.max(0,count-1)));
  const arr=[];
  for(let i=0;i<count;i++){
   const p=off+i*sz;
   if(type===3)arr.push(dv.getUint16(p,le));
   else if(type===4)arr.push(dv.getUint32(p,le));
   else if(type===12)arr.push(dv.getFloat64(p,le));
   else if(type===11)arr.push(dv.getFloat32(p,le));
   else if(type===5)arr.push(dv.getUint32(p,le)/(dv.getUint32(p+4,le)||1));
   else arr.push(u8[p]);
  }
  return arr;
 };
 const tags={};
 for(let i=0;i<num;i++){
  const eOff=ifdOffset+2+i*12;
  const tag=dv.getUint16(eOff,le);
  if(![256,257,258,259,273,278,279,317,339,33550,33922,42113].includes(tag))continue;
  const type=dv.getUint16(eOff+2,le);
  const count=dv.getUint32(eOff+4,le);
  tags[tag]=readVals(type,count,eOff);
 }
 const one=(t,def=0)=>Array.isArray(tags[t])?tags[t][0]:(tags[t]??def);
 const arr=t=>Array.isArray(tags[t])?tags[t]:(tags[t]!==undefined?[tags[t]]:[]);
 const width=one(256),height=one(257),bps=one(258,64),compression=one(259,1);
 const rowsPerStrip=one(278,height||1),predictor=one(317,1);
 const scale=arr(33550),tie=arr(33922);
 const sx=scale[0]||1,sy=scale[1]||1;
 const lon0=tie.length>=4?tie[3]-tie[0]*sx:0;
 const lat0=tie.length>=5?tie[4]+tie[1]*sy:0;
 const nodata=typeof tags[42113]==='string'?number(tags[42113]):null;
 return{dv,le,width,height,bps,compression,rowsPerStrip,predictor,stripOffsets:arr(273),stripByteCounts:arr(279),sx,sy,lon0,lat0,nodata};
}

function readUncompressedTiffVal(t,r,c){
 const stripIdx=Math.floor(r/t.rowsPerStrip);
 const inStrip=r%t.rowsPerStrip;
 const bytes=t.bps===32?4:8;
 const off=t.stripOffsets[stripIdx]+(inStrip*t.width+c)*bytes;
 return t.bps===32?t.dv.getFloat32(off,t.le):t.dv.getFloat64(off,t.le);
}

async function parseCurrentZip(u8,dv,entries){
 const findMap=re=>{
  const map=new Map();
  for(const e of entries){
   const m=e.name.match(re);
   if(m)map.set(m[1],e);
  }
  return map;
 };
 const uMonths=findMap(/(?:^|\/)mmscclim_(\d{1,2})_u\.tif$/i);
 const vMonths=findMap(/(?:^|\/)mmscclim_(\d{1,2})_v\.tif$/i);
 const uAnn=entries.find(e=>/(?:^|\/)amscclim_u\.tif$/i.test(e.name));
 const vAnn=entries.find(e=>/(?:^|\/)amscclim_v\.tif$/i.test(e.name));
 const extractUvRows=async(eU,eV,timeLabel)=>{
  const tu=parseGeoTiffHeader(await extractZipEntry(u8,dv,eU));
  const tv=parseGeoTiffHeader(await extractZipEntry(u8,dv,eV));
  const rows=[];
  for(let r=0;r<tu.height;r+=2){
   const lat=round3(tu.lat0-r*tu.sy);
   if(lat<16||lat>30)continue;
   for(let c=0;c<tu.width;c+=2){
    const lon=round3(tu.lon0+c*tu.sx);
    if(lon<114||lon>132)continue;
    const u=readUncompressedTiffVal(tu,r,c);
    const v=readUncompressedTiffVal(tv,r,c);
    if(!Number.isFinite(u)||!Number.isFinite(v))continue;
    if(tu.nodata!==null&&(u===tu.nodata||v===tu.nodata))continue;
    if(Math.abs(u)>15||Math.abs(v)>15)continue;
    rows.push({
     '測站':`${lat}°N, ${lon}°E`,
     '時間':timeLabel,
     '經度':lon,
     '緯度':lat,
     '流速(m/s)':round3(Math.hypot(u,v)),
     '流向(度)':Math.round((Math.atan2(u,v)*180/Math.PI+360)%360),
     '東向流速U':round3(u),
     '北向流速V':round3(v)
    });
   }
  }
  return rows;
 };
 const monthRows=[];
 for(let m=1;m<=12;m++){
  const eu=uMonths.get(String(m))||uMonths.get(String(m).padStart(2,'0'));
  const ev=vMonths.get(String(m))||vMonths.get(String(m).padStart(2,'0'));
  if(eu&&ev)monthRows.push(...await extractUvRows(eu,ev,`${String(m).padStart(2,'0')}月`));
 }
 const annRows=(uAnn&&vAnn)?await extractUvRows(uAnn,vAnn,'年平均'):[];
 return{
  _cwaTables:[
   {path:'氣候月平均海流（1–12 月）',rows:monthRows,defaultVar:'流速(m/s)',kind:'grid',cell:0.5},
   {path:'氣候年平均海流',rows:annRows,defaultVar:'流速(m/s)',kind:'grid',cell:0.5}
  ].filter(t=>t.rows.length)
 };
}

function parseNetCDF3(u8){
 const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
 if(u8[0]!==0x43||u8[1]!==0x44||u8[2]!==0x46)throw new Error('非 NetCDF-3 經典格式');
 const version=u8[3];
 const dec=new TextDecoder('utf-8');
 const readStr=p=>{
  const n=dv.getUint32(p,false);
  const s=dec.decode(u8.subarray(p+4,p+4+n));
  return{s,p:p+4+n+((4-(n%4))%4)};
 };
 const TYPE_SZ={1:1,2:1,3:2,4:4,5:4,6:8};
 const readAttrs=p=>{
  const tag=dv.getUint32(p,false);
  if(tag===0)return{p:p+8,attrs:{}};
  const n=dv.getUint32(p+4,false);p+=8;
  const attrs={};
  for(let i=0;i<n;i++){
   const k=readStr(p);p=k.p;
   const t=dv.getUint32(p,false),cnt=dv.getUint32(p+4,false);p+=8;
   const bytes=cnt*(TYPE_SZ[t]||1);
   if(cnt===1&&(t===5||t===6))attrs[k.s]=t===5?dv.getFloat32(p,false):dv.getFloat64(p,false);
   else if(t===2)attrs[k.s]=dec.decode(u8.subarray(p,p+bytes)).replace(/\0+$/,'');
   p+=bytes+((4-(bytes%4))%4);
  }
  return{p,attrs};
 };
 let p=8;
 const dims=[];
 const dTag=dv.getUint32(p,false);
 if(dTag===0){p+=8;}
 else{
  const dn=dv.getUint32(p+4,false);p+=8;
  for(let i=0;i<dn;i++){const nm=readStr(p);p=nm.p;dims.push({name:nm.s,len:dv.getUint32(p,false)});p+=4;}
 }
 p=readAttrs(p).p;
 const vars={};
 const vTag=dv.getUint32(p,false);
 if(vTag===11){
  const vn=dv.getUint32(p+4,false);p+=8;
  for(let i=0;i<vn;i++){
   const nm=readStr(p);p=nm.p;
   const nd=dv.getUint32(p,false);p+=4;
   const shape=[];for(let d=0;d<nd;d++){shape.push(dims[dv.getUint32(p,false)]?.len||0);p+=4;}
   const a=readAttrs(p);p=a.p;
   const ncType=dv.getUint32(p,false),vsize=dv.getUint32(p+4,false);p+=8;
   const begin=version===2?Number(dv.getBigUint64(p,false)):dv.getUint32(p,false);
   p+=version===2?8:4;
   vars[nm.s]={name:nm.s,shape,ncType,vsize,begin,attrs:a.attrs};
  }
 }
 const readF64=(vr,idx)=>{
  const off=vr.begin+idx*(vr.ncType===5?4:8);
  return vr.ncType===5?dv.getFloat32(off,false):dv.getFloat64(off,false);
 };
 return{dims,vars,readF64};
}

function parseCMEMSNetCDF(u8){
 const nc=parseNetCDF3(u8);
 const vLon=nc.vars.Longitude||nc.vars.lon,vLat=nc.vars.Latitude||nc.vars.lat;
 const vClima=nc.vars.clima,vAmp=nc.vars.amplitude,vTrend=nc.vars.trend;
 if(!vLon||!vLat||!vClima)throw new Error('NetCDF 缺少必要海水位變數');
 const nLat=vLat.shape[0],nLon=vLat.shape[1]||vLon.shape[0];
 const fill=vClima.attrs?._FillValue??vClima.attrs?.missing_value??null;
 const isBad=v=>!Number.isFinite(v)||(fill!==null&&v===fill)||Math.abs(v)>1e10;
 const climaRows=[],statRows=[];
 const step=4;
 for(let r=0;r<nLat;r+=step){
  for(let c=0;c<nLon;c+=step){
   const rc=r*nLon+c;
   const lat=round3(nc.readF64(vLat,vLat.shape.length===2?rc:r));
   const lon=round3(nc.readF64(vLon,vLon.shape.length===2?rc:c));
   if(!Number.isFinite(lat)||!Number.isFinite(lon))continue;
   if(lon<115||lon>145||lat<5||lat>30)continue;
   const amp=vAmp?nc.readF64(vAmp,rc):null;
   const tr=vTrend?nc.readF64(vTrend,rc):null;
   if((amp!==null&&!isBad(amp))||(tr!==null&&!isBad(tr))){
    statRows.push({
     '測站':`${lat}°N, ${lon}°E`,
     '時間':'1994–2023',
     '經度':lon,
     '緯度':lat,
     '海水位趨勢':isBad(tr)?null:round3(tr),
     '季節振幅':isBad(amp)?null:round3(amp)
    });
   }
   const nM=vClima.shape[0]||12;
   for(let m=0;m<nM;m++){
    const val=nc.readF64(vClima,m*nLat*nLon+rc);
    if(isBad(val))continue;
    climaRows.push({
     '測站':`${lat}°N, ${lon}°E`,
     '時間':`${String(m+1).padStart(2,'0')}月`,
     '經度':lon,
     '緯度':lat,
     '氣候海水位異常':round3(val)
    });
   }
  }
 }
 return{
  _cwaTables:[
   {path:'氣候月平均海水位異常（1–12 月）',rows:climaRows,defaultVar:'氣候海水位異常',kind:'grid',cell:0.5},
   {path:'海水位長期趨勢與季節振幅（1994–2023）',rows:statRows,defaultVar:'海水位趨勢',kind:'grid',cell:0.5}
  ].filter(t=>t.rows.length)
 };
}

function parseWaveClimateNC(u8){
 const dv=new DataView(u8.buffer,u8.byteOffset,u8.byteLength);
 const dec=new TextDecoder('ascii');
 const readF32Seq=(start,len)=>Array.from({length:len},(_,i)=>dv.getFloat32(start+i*4,true));
 let lonOff=-1,latOff=-1;
 if(11848+201*4<u8.length&&Math.abs(dv.getFloat32(11848,true)-110)<1e-4&&Math.abs(dv.getFloat32(11852,true)-110.25)<1e-4)lonOff=11848;
 if(12652+141*4<u8.length&&Math.abs(dv.getFloat32(12652,true)-5)<1e-4&&Math.abs(dv.getFloat32(12656,true)-5.25)<1e-4)latOff=12652;
 for(let p=0;(lonOff<0||latOff<0)&&p+804<Math.min(u8.length,65536);p+=4){
  if(lonOff<0&&Math.abs(dv.getFloat32(p,true)-110)<1e-4&&Math.abs(dv.getFloat32(p+4,true)-110.25)<1e-4&&Math.abs(dv.getFloat32(p+800,true)-160)<1e-4)lonOff=p;
  if(latOff<0&&Math.abs(dv.getFloat32(p,true)-5)<1e-4&&Math.abs(dv.getFloat32(p+4,true)-5.25)<1e-4&&Math.abs(dv.getFloat32(p+560,true)-40)<1e-4)latOff=p;
 }
 const lons=lonOff>=0?readF32Seq(lonOff,201):Array.from({length:201},(_,i)=>110+i*0.25);
 const lats=latOff>=0?readF32Seq(latOff,141):Array.from({length:141},(_,i)=>5+i*0.25);
 const trees=new Map();
 for(let p=0;p+72<=u8.length;p++){
  if(u8[p]===0x54&&u8[p+1]===0x52&&u8[p+2]===0x45&&u8[p+3]===0x45){
   const nType=u8[p+4],nLvl=u8[p+5],used=dv.getUint16(p+6,true);
   if(nType===1&&nLvl===0&&used>=12){
    const chunks=[];
    for(let k=0;k<used;k++){
     const e=p+24+k*48;
     if(e+48>u8.length)break;
     const nbytes=dv.getUint32(e,true);
     const tIdx=dv.getUint32(e+8,true);
     const addr=dv.getUint32(e+40,true);
     if(nbytes===113364&&addr>0&&addr+nbytes<=u8.length)chunks.push({tIdx,addr});
    }
    if(chunks.length>=12)trees.set(p,chunks);
   }
  }
 }
 const ohdrs=[];
 for(let p=0;p+32<=u8.length;p++){
  if(u8[p]===0x4F&&u8[p+1]===0x48&&u8[p+2]===0x44&&u8[p+3]===0x52)ohdrs.push(p);
 }
 const varNames=['AverageWaveHeight','MedianWaveHeight','MaximumWaveHeight'];
 const varTrees={};
 for(let i=0;i<ohdrs.length;i++){
  const start=ohdrs[i],end=Math.min(u8.length,i+1<ohdrs.length?ohdrs[i+1]:start+4096,start+4096);
  const txt=dec.decode(u8.subarray(start,end));
  const matchedVar=varNames.find(vn=>txt.includes(vn));
  if(!matchedVar)continue;
  for(let p=start;p+4<=end;p++){
   const cand=dv.getUint32(p,true);
   if(trees.has(cand)){varTrees[matchedVar]=trees.get(cand);break;}
  }
 }
 const gridPts=[];
 for(let r=0;r<141;r+=2){
  const lat=round2(lats[r]);
  if(lat<17||lat>29)continue;
  for(let c=0;c<201;c+=2){
   const lon=round2(lons[c]);
   if(lon<114||lon>130)continue;
   gridPts.push({r,c,lat,lon,idx:r*201+c});
  }
 }
 const chunkAddr=(vn,m)=>varTrees[vn]?.find(x=>x.tIdx===m)?.addr;
 const readChunk=(addr,idx)=>{
  if(!addr)return null;
  const v=dv.getFloat32(addr+idx*4,true);
  return Number.isFinite(v)&&v>=0&&v<40?round2(v):null;
 };
 const rows=[];
 for(let m=0;m<12;m++){
  const aAvg=chunkAddr('AverageWaveHeight',m);
  const aMed=chunkAddr('MedianWaveHeight',m);
  const aMax=chunkAddr('MaximumWaveHeight',m);
  if(!aAvg&&!aMed&&!aMax)continue;
  const tLabel=`${String(m+1).padStart(2,'0')}月`;
  for(const pt of gridPts){
   const avg=readChunk(aAvg,pt.idx),med=readChunk(aMed,pt.idx),max=readChunk(aMax,pt.idx);
   if(avg===null&&med===null&&max===null)continue;
   rows.push({
    '測站':`${pt.lat}°N, ${pt.lon}°E`,
    '時間':tLabel,
    '經度':pt.lon,
    '緯度':pt.lat,
    '平均波高(m)':avg,
    '中位波高(m)':med,
    '最大波高(m)':max
   });
  }
 }
 return{_cwaTables:[{path:'台灣海域波候月統計（2008–2017）',rows,defaultVar:'平均波高(m)',kind:'grid',cell:0.5}].filter(t=>t.rows.length)};
}

async function parseOisstZip(u8,dv,entries){
 const findHdf5Addr=(fdv,flen,sz,validate)=>{
  const limit=Math.min(4096,flen-8);
  for(let i=8;i<limit;i++){
   if(fdv.getUint32(i,true)===sz&&fdv.getUint32(i+4,true)===0){
    const addr=fdv.getUint32(i-8,true);
    if(fdv.getUint32(i-4,true)===0&&addr>0&&addr+sz<=flen&&(!validate||validate(addr)))return addr;
   }
  }
  return -1;
 };
 const normSst=v=>{
  if(!Number.isFinite(v))return null;
  const c=v>200&&v<330?v-273.15:v;
  return c>-5&&c<45?round2(c):null;
 };
 const MONTHS_EN={january:'01',jan:'01',february:'02',feb:'02',march:'03',mar:'03',april:'04',apr:'04',may:'05',june:'06',jun:'06',july:'07',jul:'07',august:'08',aug:'08',september:'09',sep:'09',sept:'09',october:'10',oct:'10',november:'11',nov:'11',december:'12',dec:'12'};
 const byMonth=new Map();
 for(const e of entries){
  const m=e.name.match(/oisst_pac_([a-z]+|\d{1,2})(_max|_min)?\.nc$/i);
  if(!m)continue;
  const tok=m[1].toLowerCase();
  const mm=MONTHS_EN[tok]||(/^\d+$/.test(tok)?tok.padStart(2,'0'):'');
  if(!mm)continue;
  const suf=(m[2]||'').toLowerCase();
  const kind=suf==='_max'?'最高海表溫':(suf==='_min'?'最低海表溫':'平均海表溫');
  const fb=await extractZipEntry(u8,dv,e);
  const fdv=new DataView(fb.buffer,fb.byteOffset,fb.byteLength);
  const aLon=findHdf5Addr(fdv,fb.length,757*8,a=>{const x=fdv.getFloat64(a,true);return x>90&&x<130;});
  const aLat=findHdf5Addr(fdv,fb.length,593*8,a=>{const x=fdv.getFloat64(a,true);return x>-90&&x<-50;});
  const aSst=findHdf5Addr(fdv,fb.length,593*757*8);
  if(aLon<0||aLat<0||aSst<0)continue;
  for(let r=0;r<593;r+=4){
   const lat=round3(fdv.getFloat64(aLat+r*8,true));
   if(lat<10||lat>36)continue;
   for(let c=0;c<757;c+=4){
    let lon=round3(fdv.getFloat64(aLon+c*8,true));
    if(lon<0)lon=round3(lon+360);
    if(lon<110||lon>160)continue;
    const val=normSst(fdv.getFloat64(aSst+(r*757+c)*8,true));
    if(val===null)continue;
    const key=`${mm}|${r}|${c}`;
    let row=byMonth.get(key);
    if(!row){
     row={'測站':`${lat}°N, ${lon}°E`,'時間':`${mm}月`,'經度':lon,'緯度':lat};
     byMonth.set(key,row);
    }
    row[kind]=val;
   }
  }
 }
 const rows=[...byMonth.values()].sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 return{_cwaTables:[{path:'太平洋海域氣候月平均海表溫（1991–2020）',rows,defaultVar:'平均海表溫',kind:'grid',cell:1.0}].filter(t=>t.rows.length)};
}

function parseSurgeGeoTiff(u8){
 const t=parseGeoTiffHeader(u8);
 if(t.compression!==5)throw new Error(`不支援的暴潮 GeoTIFF 壓縮格式 (${t.compression})`);
 let minCnt=Infinity;
 for(const c of t.stripByteCounts)if(c>0&&c<minCnt)minCnt=c;
 const bins=new Map();
 const rowBytes=t.width*(t.bps===32?4:8);
 for(let r=0;r<t.height;r+=15){
  const cnt=t.stripByteCounts[r]||0;
  if(cnt<=minCnt+8)continue;
  const off=t.stripOffsets[r];
  if(!off||off+cnt>u8.length)continue;
  const raw=lzwDecode(u8.subarray(off,off+cnt),rowBytes);
  const rdv=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
  const lat=t.lat0-r*t.sy;
  for(let c=0;c<t.width;c+=15){
   const bOff=c*(t.bps===32?4:8);
   if(bOff+(t.bps===32?4:8)>raw.length)break;
   const val=t.bps===32?rdv.getFloat32(bOff,t.le):rdv.getFloat64(bOff,t.le);
   if(!Number.isFinite(val)||val<=0||val>=50)continue;
   const lon=t.lon0+c*t.sx;
   const blon=round3(Math.floor(lon*100)/100+0.005);
   const blat=round3(Math.floor(lat*100)/100+0.005);
   const key=`${blon},${blat}`;
   let acc=bins.get(key);
   if(!acc){acc={lon:blon,lat:blat,max:val,sum:0,n:0};bins.set(key,acc);}
   if(val>acc.max)acc.max=val;
   acc.sum+=val;acc.n++;
  }
 }
 const rows=[...bins.values()].map(b=>({
  '測站':`${b.lat}°N, ${b.lon}°E`,
  '時間':'極端情境',
  '經度':b.lon,
  '緯度':b.lat,
  '極端暴潮高':round2(b.max),
  '平均暴潮高':round2(b.sum/b.n),
  '樣本點數':b.n
 }));
 return{_cwaTables:[{path:'臺灣海岸極端暴潮線（0.01° 沿海網格）',rows,defaultVar:'極端暴潮高',kind:'grid',cell:0.01}].filter(t=>t.rows.length)};
}

function parseBinaryResource(arrayBuffer,fileName='',sourceId=''){
 const u8=new Uint8Array(arrayBuffer);
 if(u8.length>=4&&u8[0]===0x43&&u8[1]===0x44&&u8[2]===0x46&&(u8[3]===1||u8[3]===2))return parseCMEMSNetCDF(u8);
 if(u8.length>=4&&u8[0]===0x89&&u8[1]===0x48&&u8[2]===0x44&&u8[3]===0x46)return parseWaveClimateNC(u8);
 if(u8.length>=4&&((u8[0]===0x49&&u8[1]===0x49&&u8[2]===0x2A&&u8[3]===0x00)||(u8[0]===0x4D&&u8[1]===0x4D&&u8[2]===0x00&&u8[3]===0x2A)))return parseSurgeGeoTiff(u8);
 throw new Error(`無法辨識二進位檔案格式：${fileName||sourceId}`);
}

async function unpackZip(arrayBuffer,fileName='archive.zip'){
 const {u8,dv,entries}=readZipDirectory(arrayBuffer);
 const kmzEntries=entries.filter(e=>/\.kmz$/i.test(e.name));
 if(kmzEntries.length){
  const overlays=[];
  for(const e of kmzEntries){
   const kmzBytes=await extractZipEntry(u8,dv,e);
   const ov=await parseKMZ(kmzBytes,e.name);
   if(ov)overlays.push(ov);
  }
  overlays.sort((a,b)=>a.time.localeCompare(b.time,undefined,{numeric:true}));
  return{kind:'kmz-overlays',overlays,label:fileName};
 }
 if(entries.some(e=>/\.kml$/i.test(e.name))){
  const ov=await parseKMZ(arrayBuffer,fileName);
  if(ov)return{kind:'kmz-overlays',overlays:[ov],label:fileName};
 }
 if(entries.some(e=>/(?:^|\/)(?:mm|am)scclim_.*_u\.tif$/i.test(e.name))){
  return parseCurrentZip(u8,dv,entries);
 }
 if(entries.some(e=>/oisst_pac_([a-z]+|\d{1,2})(?:_max|_min)?\.nc$/i.test(e.name))){
  return parseOisstZip(u8,dv,entries);
 }
 const tifEntry=entries.find(e=>/\.tiff?$/i.test(e.name)&&!/\.aux\./i.test(e.name));
 if(tifEntry)return parseBinaryResource(await extractZipEntry(u8,dv,tifEntry),tifEntry.name);
 const ncEntry=entries.find(e=>/\.nc$/i.test(e.name));
 if(ncEntry)return parseBinaryResource(await extractZipEntry(u8,dv,ncEntry),ncEntry.name);
 const dec=new TextDecoder('utf-8');
 const dataEntries=entries.filter(e=>/\.(xml|json)$/i.test(e.name)&&!/\.aux\.xml$/i.test(e.name)).sort((a,b)=>a.name.localeCompare(b.name));
 if(!dataEntries.length)throw new Error('ZIP 內找不到可解析的 XML、JSON、NC、TIF 或 KMZ 資料檔');
 const mergedTables=new Map();
 let isB0025=false;
 for(const e of dataEntries){
  const text=dec.decode(await extractZipEntry(u8,dv,e));
  const parsed=/\.xml$/i.test(e.name)?parseXML(text):JSON.parse(text);
  const ts=tables(parsed,fileName);
  if(ts.some(t=>t.path.includes('降水量')||t.path.includes('累積雨量')))isB0025=true;
  for(const t of ts){
   if(!mergedTables.has(t.path))mergedTables.set(t.path,{path:t.path,rows:[],defaultVar:t.defaultVar});
   const bucket=mergedTables.get(t.path);
   for(const r of t.rows)bucket.rows.push(r);
  }
 }
 const monthKey=mergedTables.has('逐月總雨量統計')?'逐月總雨量統計':(mergedTables.has('逐月累積雨量')?'逐月累積雨量':'');
 if(isB0025&&monthKey){
  const monthly=mergedTables.get(monthKey).rows.slice().sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
  const yearMap=new Map();
  for(const r of monthly){
   const yr=String(r['時間']||'').slice(0,4);
   const sid=r['站號'];
   if(!yr||!sid)continue;
   const key=`${sid}|${yr}`;
   let acc=yearMap.get(key);
   if(!acc){
    acc={...r,'時間':yr,'年總雨量':0,'降水日數':0,'有效日數':0};
    delete acc['累積雨量'];
    delete acc['月總雨量'];
    yearMap.set(key,acc);
   }
   const val=r['月總雨量']??r['累積雨量'];
   if(val!==null&&val!==undefined){
    acc['年總雨量']=round1(acc['年總雨量']+val);
    acc['降水日數']+=(r['降水日數']||0);
    acc['有效日數']+=(r['有效日數']||0);
   }
  }
  const annual=[...yearMap.values()].sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
  const dailyAll=mergedTables.get('逐日降水量')?.rows||[];
  const years=[...new Set(dailyAll.map(r=>String(r['時間']||'').slice(0,4)).filter(Boolean))].sort();
  const keepYears=new Set(years.slice(-2));
  const recentDaily=dailyAll.filter(r=>keepYears.has(String(r['時間']||'').slice(0,4))).sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
  const defMonthlyVar=mergedTables.get(monthKey).defaultVar||'月總雨量';
  return{
   _cwaTables:[
    {path:'歷年逐月累積雨量（過去 9 年）',rows:monthly,defaultVar:defMonthlyVar},
    {path:'歷年年總雨量統計',rows:annual,defaultVar:'年總雨量'},
    {path:`近兩年逐日降水量（${[...keepYears].join('–')}）`,rows:recentDaily,defaultVar:'降水量'}
   ].filter(t=>t.rows.length)
  };
 }
 const list=[...mergedTables.values()];
 for(const t of list){
  if(t.rows[0]?.['時間']!==undefined)t.rows.sort((a,b)=>String(a['時間']).localeCompare(String(b['時間'])));
 }
 return{_cwaTables:list};
}

function isBinaryBuffer(u8){
 if(!u8||u8.length<4)return false;
 if(u8[0]===0x43&&u8[1]===0x44&&u8[2]===0x46&&(u8[3]===1||u8[3]===2))return true;
 if(u8[0]===0x89&&u8[1]===0x48&&u8[2]===0x44&&u8[3]===0x46)return true;
 return (u8[0]===0x49&&u8[1]===0x49&&u8[2]===0x2A&&u8[3]===0x00)||(u8[0]===0x4D&&u8[1]===0x4D&&u8[2]===0x00&&u8[3]===0x2A);
}

function nestedResourceUrl(json){
 const cand=json?.cwaopendata?.dataset?.resource?.uri
  ||json?.cwaopendata?.Dataset?.Resource?.ProductURL
  ||json?.cwaopendata?.Resources?.Resource?.uri
  ||json?.cwaopendata?.resources?.resource?.uri;
 if(typeof cand!=='string')return '';
 return /\.(zip|nc|tiff?|kmz)(\?.*)?$/i.test(cand.trim())?cand.trim():'';
}

root.ClimateData={
 tables,csv,number,cwaNumber,rainNumber,escape,exportCSV,
 lookupStation,parseXML,parseCWA,unpackZip,parseKMZ,parseBinaryResource,isBinaryBuffer,nestedResourceUrl
};
if(typeof module!=='undefined')module.exports=root.ClimateData;
})(typeof window!=='undefined'?window:globalThis);
