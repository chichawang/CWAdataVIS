/* Photon: https://github.com/komoot/photon; OSM data under ODbL.
 * Explicit searches only; one in-flight request, cooldown and session cache.
 */
window.initPlaceSearch = function(map) {
  const el = id => document.getElementById(id);
  const normal = value => value.normalize('NFKC').replace(/台/g,'臺').replace(/\s+/g,'').toLowerCase();
  const status = value => { el('placeStatus').textContent = value; };
  const cache = new Map();
  let revision = 0, controller, nextRequest = 0, marker;
  const placeholders = {photon:'例如：臺北車站、臺北市信義區市府路1號',coords:'緯度, 經度，例如：25.0330, 121.5654'};
  function removeLayers() {
    if (marker) { map.removeLayer(marker); marker=null; }
  }
  function invalidate() {
    revision++; if (controller) controller.abort();
    controller=null; el('placeSearch').disabled=false;
    el('placeResults').replaceChildren();
  }
  const pointOK = p => Array.isArray(p) && p.length>=2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0])<=180 && Math.abs(p[1])<=90;
  function pin(lat,lon,label,zoom=17) {
    removeLayers();
    const content=document.createElement('div');content.textContent=label;
    marker=L.marker([lat,lon]).addTo(map).bindPopup(content);
    map.setView([lat,lon],zoom);marker.openPopup();
  }
  function button(label, action) {
    const item=document.createElement('button');item.type='button';item.textContent=label;
    item.style.cssText='text-align:left;white-space:normal;line-height:1.5';item.onclick=action;
    el('placeResults').appendChild(item);
  }
  async function search() {
    const query=el('placeQuery').value.trim(), type=el('placeType').value;
    invalidate();const token=revision;
    if(!query){status('請輸入位置。');return;}
    el('placeSearch').disabled=true;
    try {
      if(type==='coords') {
        const values=query.normalize('NFKC').trim().split(/[,，\s]+/);
        if(values.length!==2 || !values.every(v=>/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(v)))throw new Error('請輸入十進位「緯度, 經度」，例如 25.0330, 121.5654。');
        const [lat,lon]=values.map(Number);
        if(!pointOK([lon,lat]))throw new Error('座標超出範圍：緯度 ±90、經度 ±180。請確認順序為緯度、經度。');
        pin(lat,lon,`座標：${lat}, ${lon}`);status(`已定位：${lat}, ${lon}（緯度、經度）`);return;
      }
      const key=normal(query);
      let features=cache.get(key);
      if(!features) {
        if(Date.now()<nextRequest)throw new Error('請稍候兩秒再查詢，避免頻繁使用公開服務。');
        nextRequest=Date.now()+2000;status('正在查詢 Photon…');
        controller=new AbortController();const requestController=controller;
        const timer=setTimeout(()=>requestController.abort(),15000);
        try {
          const params=new URLSearchParams({q:query,limit:'10',bbox:'114,10,124,27'});
          const response=await fetch('https://photon.komoot.io/api/?'+params,{signal:requestController.signal});
          if(!response.ok)throw new Error(response.status===429?'Photon 暫時限流，請稍後再試。':'Photon 目前無法查詢，請稍後再試。');
          const data=await response.json();
          if(!Array.isArray(data.features))throw new Error('Photon 回傳格式異常，請稍後再試。');
          features=data.features.filter(f=>f.geometry?.type==='Point' && pointOK(f.geometry.coordinates) && String(f.properties?.countrycode).toUpperCase()==='TW');
          if(cache.size>=50)cache.delete(cache.keys().next().value);
          cache.set(key,features);
        } finally {clearTimeout(timer);}
      }
      if(token!==revision)return;
      features.forEach(feature=>{
        const p=feature.properties, coords=feature.geometry.coordinates;
        const label=[...new Set([p.state,p.county,p.city,p.district,p.locality,p.street,p.housenumber,p.name].filter(Boolean))].join(' ');
        button(label||query,()=>{
          pin(coords[1],coords[0],(label||query)+' · Photon / © OpenStreetMap contributors',16);
          status('已定位：'+(label||query)+'。結果可能是道路或地標代表點，請核對位置；未查到門牌時不代表精確門牌。');
        });
      });
      status(features.length?`找到 ${features.length} 筆臺灣候選，請核對並選取位置。`:'查無臺灣結果，請嘗試較短的道路或地標名稱。');
    } catch(error) {
      if(token===revision)status(error.name==='AbortError'?'Photon 查詢逾時，請稍後再試；座標定位仍可使用。':error instanceof TypeError?'無法連線 Photon，請確認網路或稍後再試；座標定位仍可使用。':error.message);
    } finally {if(token===revision)el('placeSearch').disabled=false;}
  }
  el('placeSearch').onclick=search;
  el('placeQuery').onkeydown=event=>{if(event.key==='Enter'&&!event.isComposing&&!el('placeSearch').disabled){event.preventDefault();search();}};
  el('placeQuery').oninput=()=>{invalidate();status('輸入完成後按「搜尋定位」。');};
  el('placeType').onchange=()=>{invalidate();el('placeQuery').placeholder=placeholders[el('placeType').value];status(el('placeType').value==='coords'?'請依序輸入緯度、經度。':'輸入完成後按「搜尋定位」。');};
  el('placeClear').onclick=()=>{invalidate();removeLayers();el('placeQuery').value='';status('已清除定位。');};
};
