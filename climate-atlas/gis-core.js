(function(root){
'use strict';

const D=root.ClimateData||(typeof require==='function'?require('./data.js'):null);
const CAT=root.ATMOS_VARS
 ?{ATMOS_VARS:root.ATMOS_VARS}
 :(typeof require==='function'?require('./catalog.js'):{ATMOS_VARS:{}});
const ATMOS_VARS=CAT.ATMOS_VARS||{};

function coordinate(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function validPosition(lon,lat){return lon!==null&&lat!==null&&lon>=-180&&lon<=180&&lat>=-85&&lat<=85;}

function geometryValid(g){
 if(!g)return false;
 if(g.type==='GeometryCollection')return Array.isArray(g.geometries)&&g.geometries.every(geometryValid);
 const depth={Point:0,MultiPoint:1,LineString:1,MultiLineString:2,Polygon:2,MultiPolygon:3}[g.type];
 if(depth===undefined)return false;
 function check(a,d){return Array.isArray(a)&&(d===0?a.length>=2&&typeof a[0]==='number'&&typeof a[1]==='number'&&validPosition(a[0],a[1]):a.length>0&&a.every(c=>check(c,d-1)));}
 return check(g.coordinates,depth);
}

function featureCollection(data){
 let features;
 if(data.type==='FeatureCollection')features=data.features;
 else if(data.type==='Feature')features=[data];
 else if(data.coordinates||data.type==='GeometryCollection')features=[{type:'Feature',properties:{},geometry:data}];
 else return null;
 if(data.crs)throw new Error('請先將 GeoJSON 轉為 WGS84 / EPSG:4326，並移除舊式 crs 宣告。');
 if(!Array.isArray(features)||!features.length)throw new Error('GeoJSON 沒有圖徵');
 if(features.some(f=>!geometryValid(f.geometry)))throw new Error('GeoJSON 含無效幾何或非 WGS84 經緯度。請先修正；本頁不會猜測投影。');
 return features.map(f=>({type:'Feature',properties:f.properties||{},geometry:f.geometry}));
}

function fromRows(rows,cfg){
 let skipped=0;
 const features=[];
 for(const row of rows){
  const lon=coordinate(row[cfg.lon]),lat=coordinate(row[cfg.lat]);
  if(!validPosition(lon,lat)){skipped++;continue;}
  let geometry={type:'Point',coordinates:[lon,lat]};
  if(cfg.kind==='grid'){
   const h=Number(cfg.cell)/2;
   if(!Number.isFinite(h)||h<=0||h>5)throw new Error('網格大小需介於 0 與 10 度之間');
   if(!validPosition(lon-h,lat-h)||!validPosition(lon+h,lat+h)){skipped++;continue;}
   geometry={type:'Polygon',coordinates:[[[lon-h,lat-h],[lon+h,lat-h],[lon+h,lat+h],[lon-h,lat+h],[lon-h,lat-h]]]};
  }
  features.push({type:'Feature',properties:{...row},geometry});
 }
 return{features,skipped};
}

function extent(features,field){
 if(!field)return[null,null];
 let lo=Infinity,hi=-Infinity;
 for(const f of features){
  const n=D.number(f.properties[field]);
  if(n!==null){lo=Math.min(lo,n);hi=Math.max(hi,n);}
 }
 return Number.isFinite(lo)?[lo,hi]:[null,null];
}

function times(features,field){
 return field?[...new Set(features.map(f=>String(f.properties[field]??'')).filter(Boolean))].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true})):[];
}

const RAIN_COLORS=[[193,193,193],[155,255,255],[0,207,255],[1,152,255],[1,101,255],
 [48,153,1],[50,255,0],[248,255,0],[255,203,0],[255,154,0],[250,3,0],[204,0,3],
 [160,0,0],[152,0,154],[195,4,204],[248,5,243],[254,203,255]];
const RAIN_LEVELS=[1,2,6,10,15,20,30,40,50,70,90,110,130,150,200,300];
const colors=['#344b9b','#288fba','#3cb6ad','#a3d78d','#f1d36f','#ec9852','#d6554d'];
const PALETTES={
 temp:['#2b5c8f','#4393c3','#78c679','#fed976','#fd8d3c','#e31a1c','#99000d'],
 rain:['#c1c1c1','#9bffff','#00cfff','#0198ff','#0165ff','#309901','#32ff00','#f8ff00','#ffcb00','#ff9a00','#fa0300','#cc0003','#a00000','#98009a','#c304cc','#f805f3','#fecbff'],
 humidity:['#efe3b2','#a6d9b8','#41b6c4','#225ea8','#08306b'],
 pressure:['#5e4fa2','#3288bd','#66c2a5','#fee08b','#f46d43','#9e0142'],
 wind:['#e0f3f8','#91d1c2','#43a2ca','#1b9e77','#e6ab02','#d95f02','#b10026'],
 solar:['#4c5c75','#78909c','#f6d55c','#f39c12','#e65100'],
 default:colors
};

function paletteKeyFor(fieldName){
 if(!fieldName)return 'default';
 if(ATMOS_VARS[fieldName]?.palette)return ATMOS_VARS[fieldName].palette;
 const s=String(fieldName);
 if(/temp|海表溫|海溫|sst|地溫|氣溫|最高溫|最低溫|≤10|≥30|≥25/i.test(s))return 'temp';
 if(/rain|precip|雨量|降水/i.test(s))return 'rain';
 if(/humid|rh|濕度|雲量/i.test(s))return 'humidity';
 if(/pres|氣壓|海水位|潮位|潮差|暴潮|趨勢|振幅/i.test(s))return 'pressure';
 if(/wind|gust|風速|陣風|流速|波高|浪高|週期/i.test(s))return 'wind';
 if(/sun|solar|rad|日照|日射|海拔/i.test(s))return 'solar';
 return 'default';
}

function paletteFor(fieldName){
 return PALETTES[paletteKeyFor(fieldName)]||PALETTES.default;
}

function color(value,range){
 if(value===null||range[0]===null)return '#89939b';
 const ratio=range[1]===range[0]?.5:Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0])));
 return colors[Math.min(6,Math.floor(ratio*7))];
}

function hexToRgb(h){return[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];}

function colorForVar(value,range,fieldName){
 if(value===null||value===undefined||range[0]===null)return '#89939b';
 if(paletteKeyFor(fieldName)==='rain'){
  for(let i=0;i<RAIN_LEVELS.length;i++){
   if(value<RAIN_LEVELS[i])return `rgb(${RAIN_COLORS[i].join(',')})`;
  }
  return `rgb(${RAIN_COLORS[RAIN_LEVELS.length].join(',')})`;
 }
 const pal=paletteFor(fieldName);
 const ratio=range[1]===range[0]?.5:Math.max(0,Math.min(1,(value-range[0])/(range[1]-range[0])));
 const pos=ratio*(pal.length-1);
 const i=Math.floor(pos),f=pos-i;
 const a=hexToRgb(pal[i]),b=hexToRgb(pal[Math.min(i+1,pal.length-1)]);
 return `rgb(${a.map((c,j)=>Math.round(c+(b[j]-c)*f)).join(',')})`;
}

function gradientForVar(fieldName){
 return `linear-gradient(90deg,${paletteFor(fieldName).join(',')})`;
}

function summaryStats(features,field,nameField){
 const total=features.length;
 if(!field||!total)return{total,valid:0,mean:null,sum:0,max:null,min:null};
 let valid=0,sum=0,max=null,min=null;
 for(const f of features){
  const v=D.number(f.properties[field]);
  if(v===null)continue;
  const label=nameField?String(f.properties[nameField]??''):'';
  valid++;
  sum+=v;
  if(!max||v>max.value)max={value:v,name:label};
  if(!min||v<min.value)min={value:v,name:label};
 }
 return{total,valid,mean:valid?sum/valid:null,sum,max,min};
}

root.GISCore={
 coordinate,validPosition,geometryValid,featureCollection,fromRows,
 extent,times,color,colors,
 RAIN_COLORS,RAIN_LEVELS,
 PALETTES,paletteKeyFor,paletteFor,colorForVar,gradientForVar,summaryStats
};
if(typeof module!=='undefined')module.exports=root.GISCore;
})(typeof window!=='undefined'?window:globalThis);
