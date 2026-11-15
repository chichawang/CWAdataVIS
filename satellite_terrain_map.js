/* Leaflet supplies projection utilities; MapLibre renders terrain and observations.
 * Satellite images use a display-only 2D canvas, allowing direct non-CORS images. */
window.createSatelliteTerrainAPI = function (leaflet) {
  'use strict';
  const gl = window.maplibregl;
  const backgroundMaps = new WeakMap();
  const labelMaps = new WeakMap();
  const stationPopups = new WeakMap();
  function showStationPopup(map, coordinates, content) {
    stationPopups.get(map)?.remove();
    const previousFocus = document.activeElement;
    const popup = new gl.Popup({maxWidth: '360px', className: 'station-details-popup',
      offset: 14, closeOnClick: false, focusAfterOpen: false})
      .setLngLat(coordinates).setDOMContent(content).addTo(map);
    stationPopups.set(map, popup);
    const element = popup.getElement();
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-label', content.querySelector('h3')?.textContent || '單站詳細資訊');
    // Top-layer popovers escape map clipping, stacking contexts and all HUDs.
    // Older browsers use a body-level portal with the same explicit stacking order.
    if (typeof element.showPopover === 'function') {
      element.setAttribute('popover', 'manual');
      element.showPopover();
    } else {
      document.body.append(element);
    }
    // Popovers are hidden during addTo(); remeasure after entering the top layer.
    const keepInViewport = () => {
      element.style.translate = '';
      if (matchMedia('(max-width:900px), (max-height:500px) and (pointer:coarse)').matches) return;
      const rect = element.getBoundingClientRect();
      const width = document.documentElement.clientWidth;
      const height = window.visualViewport?.height || innerHeight;
      const x = Math.max(12, Math.min(rect.left, width - rect.width - 12));
      const y = Math.max(12, Math.min(rect.top, height - rect.height - 12));
      element.style.translate = (x - rect.left) + 'px ' + (y - rect.top) + 'px';
    };
    popup.setLngLat(coordinates);
    keepInViewport();
    map.on('move', keepInViewport);
    map.on('resize', keepInViewport);
    const sizeObserver = new ResizeObserver(() => {
      if (popup.isOpen()) { popup.setLngLat(popup.getLngLat()); keepInViewport(); }
    });
    sizeObserver.observe(content);
    const close = element.querySelector('.maplibregl-popup-close-button');
    close?.setAttribute('aria-label', '關閉單站詳細資訊');
    close?.setAttribute('title', '關閉（Esc）');
    close?.focus({preventScroll: true});
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); popup.remove(); } };
    document.addEventListener('keydown', escape);
    popup.on('close', () => {
      sizeObserver.disconnect();
      map.off('move', keepInViewport);
      map.off('resize', keepInViewport);
      document.removeEventListener('keydown', escape);
      if (stationPopups.get(map) === popup) stationPopups.delete(map);
      if (previousFocus?.isConnected && (document.activeElement === document.body || element.contains(document.activeElement))) {
        previousFocus.focus?.({preventScroll: true});
      }
    });
    return popup;
  }
  let serial = 0;
  const ranks = {satellite: 350, radar: 390, labels: 450, boundaries: 455};
  const bounds = value => leaflet.latLngBounds(value);
  const corners = value => {
    const b = bounds(value);
    return [[b.getWest(), b.getNorth()], [b.getEast(), b.getNorth()],
      [b.getEast(), b.getSouth()], [b.getWest(), b.getSouth()]];
  };
  class Layer {
    constructor(kind, data, options = {}) {
      Object.assign(this, {kind, data, options, id: 'weather-' + ++serial, events: {}});
    }
    on(event, callback) { this.events[event] = callback; return this; }
    addTo(target) { target.addLayer(this); return this; }
    remove() { this.owner?.removeLayer(this); return this; }
    setOpacity(value) {
      this.options.opacity = value;
      if (this.screenCanvas) this.screenCanvas.style.opacity = value;
      if (this.map?.getLayer(this.id)) this.map.setPaintProperty(this.id, 'raster-opacity', value);
      return this;
    }
    getContainer() { return {querySelector: () => this.loaded ? true : null}; }
    mount(map) {
      if (this.kind === 'tile' && !this.options.pane) map = backgroundMaps.get(map) || map;
      if (this.options.pane === 'labels') map = labelMaps.get(map) || map;
      this.map = map;
      const {kind, data, options: o, id} = this;
      if (kind === 'tile') {
        map.addSource(id, {type: 'raster', tiles: [data], tileSize: 256, maxzoom: 18, attribution: o.attribution});
      } else if (kind === 'image') {
        if (o.pane === 'satellite') {
          this.mountSatellite(map);
          return;
        }
        let canvas = data.image;
        if (!(canvas instanceof HTMLCanvasElement)) {
          canvas = document.createElement('canvas');
          canvas.width = data.image.naturalWidth; canvas.height = data.image.naturalHeight;
          canvas.getContext('2d').drawImage(data.image, 0, 0);
        }
        map.addSource(id, {type: 'canvas', canvas, coordinates: corners(data.bounds), animate: false});
      } else if (kind === 'geojson') {
        map.addSource(id, {type: 'geojson', data});
      }
      const rank = ranks[o.pane] || 100;
      const before = map.getStyle().layers.find(layer => (layer.metadata?.weatherRank || 0) > rank)?.id;
      map.addLayer(kind === 'geojson' ? {
        id, type: 'line', source: id, metadata: {weatherRank: rank},
        paint: {'line-color': ['match', ['get', 'limit_type'], '12nm', '#22d3ee', '24nm', '#a5b4fc', '#38bdf8'],
          'line-width': 2, 'line-dasharray': [4, 2]}
      } : {id, type: 'raster', source: id, metadata: {weatherRank: rank},
        paint: {'raster-opacity': o.opacity ?? 1, 'raster-fade-duration': 0}}, before);
    }
    mountSatellite(map) {
      // Drawing a cross-origin image to Canvas2D is allowed. Never read pixels,
      // export this canvas, or upload it to WebGL (those require CORS).
      const source = this.data.image;
      const width = source.width || source.naturalWidth;
      const height = source.height || source.naturalHeight;
      const canvas = this.screenCanvas = document.createElement('canvas');
      canvas.className = 'satellite-screen-overlay';
      Object.assign(canvas.style, {position: 'absolute', inset: '0', width: '100%', height: '100%',
        pointerEvents: 'none', zIndex: '1', opacity: this.options.opacity ?? 1});
      map.getCanvasContainer().append(canvas);
      const context = canvas.getContext('2d');
      const extent = bounds(this.data.bounds);
      const nw = gl.MercatorCoordinate.fromLngLat([extent.getWest(), extent.getNorth()]);
      const se = gl.MercatorCoordinate.fromLngLat([extent.getEast(), extent.getSouth()]);
      const divisions = 32;
      const grid = [];
      for (let y = 0; y <= divisions; y++) for (let x = 0; x <= divisions; x++) {
        grid.push(new gl.MercatorCoordinate(nw.x + (se.x - nw.x) * x / divisions,
          nw.y + (se.y - nw.y) * y / divisions).toLngLat());
      }
      const triangle = (sx, sy, dx, dy, a, b, c) => {
        if (![a.x, a.y, b.x, b.y, c.x, c.y].every(Number.isFinite)) return;
        if (Math.max(a.x, b.x, c.x) < 0 || Math.min(a.x, b.x, c.x) > canvas.clientWidth ||
            Math.max(a.y, b.y, c.y) < 0 || Math.min(a.y, b.y, c.y) > canvas.clientHeight) return;
        context.save(); context.beginPath();
        // Small overlap eliminates antialiased hairline seams.
        const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3;
        for (const p of [a, b, c]) {
          const length = Math.hypot(p.x - cx, p.y - cy) || 1;
          context.lineTo(p.x + (p.x - cx) / length * .5, p.y + (p.y - cy) / length * .5);
        }
        context.closePath(); context.clip();
        const aa = (b.x - a.x) / dx, bb = (b.y - a.y) / dx;
        const cc = (c.x - a.x) / dy, dd = (c.y - a.y) / dy;
        context.transform(aa, bb, cc, dd, a.x - aa * sx - cc * sy, a.y - bb * sx - dd * sy);
        const x0 = Math.max(0, Math.min(sx, sx + dx) - 2);
        const y0 = Math.max(0, Math.min(sy, sy + dy) - 2);
        const sw = Math.min(width, Math.max(sx, sx + dx) + 2) - x0;
        const sh = Math.min(height, Math.max(sy, sy + dy) + 2) - y0;
        context.drawImage(source, x0, y0, sw, sh, x0, y0, sw, sh); context.restore();
      };
      let lastDraw = '';
      let terrainRevision = 0;
      this.invalidateSatellite = event => { if (event.sourceId === 'elevation') terrainRevision++; };
      map.on('sourcedata', this.invalidateSatellite);
      this.drawSatellite = () => {
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const w = map.getContainer().clientWidth, h = map.getContainer().clientHeight;
        const center = map.getCenter();
        const signature = [w, h, ratio, center.lng, center.lat, map.getZoom(), map.getPitch(),
          map.getBearing(), map.getCenterElevation(), JSON.stringify(map.getPadding()),
          map.getTerrain()?.exaggeration ?? 0, terrainRevision].join('|');
        if (signature === lastDraw) return;
        lastDraw = signature;
        if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
          canvas.width = Math.round(w * ratio); canvas.height = Math.round(h * ratio);
        }
        context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, w, h);
        const points = grid.map(point => map.project(point));
        const dx = width / divisions, dy = height / divisions, stride = divisions + 1;
        for (let y = 0; y < divisions; y++) for (let x = 0; x < divisions; x++) {
          const i = y * stride + x;
          triangle(x * dx, y * dy, dx, dy, points[i], points[i + 1], points[i + stride]);
          triangle((x + 1) * dx, (y + 1) * dy, -dx, -dy,
            points[i + stride + 1], points[i + stride], points[i + 1]);
        }
      };
      map.on('render', this.drawSatellite);
      this.drawSatellite();
    }
    unmount() {
      if (this.drawSatellite) this.map?.off('render', this.drawSatellite);
      if (this.invalidateSatellite) this.map?.off('sourcedata', this.invalidateSatellite);
      this.screenCanvas?.remove(); this.screenCanvas = null; this.drawSatellite = null;
      if (this.map?.getLayer(this.id)) this.map.removeLayer(this.id);
      if (this.map?.getSource(this.id)) this.map.removeSource(this.id);
      this.map = null;
    }
  }
  class Group {
    constructor() { this.layers = new Set(); }
    addTo(map) { this.map = map; return this; }
    addLayer(layer) { this.layers.add(layer); this.map.addLayer(layer); layer.owner = this; }
    removeLayer(layer) { this.layers.delete(layer); this.map.removeLayer(layer); }
    clearLayers() { [...this.layers].forEach(layer => this.removeLayer(layer)); }
    eachLayer(callback) { this.layers.forEach(callback); }
  }
  class Marker extends Layer {
    constructor(coordinates, options, circle) {
      super('marker', coordinates, options);
      this.circle = circle;
      this.element = document.createElement('div');
      const o = this.options;
      this.element.className = o.icon?.options.className || '';
      if (o.icon) {
        this.element.innerHTML = o.icon.options.html;
        const [width, height] = o.icon.options.iconSize;
        Object.assign(this.element.style, {width: width + 'px', height: height + 'px'});
      } else {
        Object.assign(this.element.style, {borderRadius: '50%', background: o.fillColor,
          border: (o.weight || 1) + 'px solid ' + o.color});
        this.setRadius(o.radius);
      }
      this.element.style.cursor = 'pointer';
      this.element.style.zIndex = '3';
      this.element.setAttribute('role', 'button'); this.element.tabIndex = 0;
      this.element.setAttribute('aria-label', o.alt || '查看測站觀測');
    }
    getElement() { return this.element; }
    setRadius(radius) { this.element.style.width = this.element.style.height = radius * 2 + 'px'; }
    bindPopup(content) { this.popupContent = content; return this; }
    bindTooltip(content) { this.element.addEventListener('mouseenter', () => { this.element.title = content().textContent; }); return this; }
    mount(map) {
      this.marker = new gl.Marker({element: this.element}).setLngLat([this.data[1], this.data[0]]).addTo(map);
      const open = event => {
        event.stopPropagation(); this.popup?.remove();
        this.popup = showStationPopup(map, this.marker.getLngLat(), this.popupContent());
      };
      this.element.onclick = open;
      this.element.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(event); } };
      this.events.add?.({target: this});
    }
    unmount() { this.marker?.remove(); this.popup?.remove(); }
  }
  // One GPU source per observation group, rather than one layer per station.
  const rainBatches = new WeakMap();
  function rainBatch(map, pane) {
    if (!rainBatches.has(map)) rainBatches.set(map, new Map());
    const batches = rainBatches.get(map);
    if (batches.has(pane)) return batches.get(pane);
    const id = 'rain-columns-' + pane;
    const entries = new Map();
    let queued = false;
    map.addSource(id, {type: 'geojson', data: {type: 'FeatureCollection', features: []}});
    map.addLayer({id, type: 'fill-extrusion', source: id, metadata: {weatherRank: 480},
      paint: {'fill-extrusion-color': ['get', 'color'], 'fill-extrusion-height': ['get', 'height'],
        'fill-extrusion-base': 0, 'fill-extrusion-opacity': .9}});
    map.addLayer({id: id + '-zero', type: 'fill', source: id, metadata: {weatherRank: 480},
      filter: ['==', ['get', 'amount'], 0],
      paint: {'fill-color': ['get', 'color'], 'fill-opacity': .7, 'fill-outline-color': '#607d8b'}});
    const batch = {entries, update() {
      if (queued) return;
      queued = true;
      queueMicrotask(() => {
        queued = false;
        map.getSource(id)?.setData({type: 'FeatureCollection', features: [...entries.values()].map(column => column.feature)});
      });
    }};
    for (const layer of [id, id + '-zero']) {
      map.on('click', layer, event => {
        const column = entries.get(event.features?.[0]?.properties.columnId);
        if (!column?.popupContent) return;
        batch.popup?.remove();
        batch.popup = showStationPopup(map, [column.data[1], column.data[0]], column.popupContent());
      });
      map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
    }
    batches.set(pane, batch);
    return batch;
  }
  class RainColumn extends Layer {
    constructor(coordinates, options) {
      super('rain-column', coordinates, options);
      const [lat, lon] = coordinates;
      const halfLat = 400 / 111320;
      const halfLon = halfLat / Math.cos(lat * Math.PI / 180);
      this.feature = {type: 'Feature', properties: {columnId: this.id,
        amount: options.amount, height: options.amount * 500, color: options.fillColor},
        geometry: {type: 'Polygon', coordinates: [[]]}};
      this.setRadius(options.radius || 5);
    }
    setRadius(radius) {
      this.options.radius = radius;
      const [lat, lon] = this.data;
      const zoom = this.map?.getZoom?.() ?? 7;
      const degrees = radius * 360 / (512 * 2 ** zoom);
      const ring = Array.from({length:32}, (_,i) => {
        const angle = i * Math.PI / 16;
        return [lon + degrees * Math.cos(angle), lat + degrees * Math.cos(lat*Math.PI/180) * Math.sin(angle)];
      });
      ring.push([...ring[0]]);
      this.feature.geometry.coordinates = [ring];
      this.batch?.update();
    }
    bindPopup(content) { this.popupContent = content; return this; }
    mount(map) { this.map = map; this.setRadius(this.options.radius); this.batch = rainBatch(map, this.options.pane); this.batch.entries.set(this.id, this); this.batch.update(); }
    unmount() {
      if (!this.batch) return;
      this.batch.entries.delete(this.id); this.batch.popup?.remove(); this.batch.update(); this.batch = null;
    }
  }
  function createMap(container) {
    const mapOptions = {container, center: [120.95, 23.7], zoom: 6.5, pitch: 0,
      bearing: 0, maxPitch: 0, maxZoom: 18, minZoom: 1, attributionControl: true,
      style: {version: 8, sources: {elevation: {type: 'raster-dem',
        tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
        encoding: 'terrarium', tileSize: 256, maxzoom: 15,
        attribution: '高程 © <a href="https://registry.opendata.aws/terrain-tiles/">AWS Terrain Tiles / Mapzen</a>'},
        shading: {type: 'raster-dem', encoding: 'terrarium', tileSize: 256, maxzoom: 15,
          tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png']}},
        layers: [{id: 'ocean', type: 'background', paint: {'background-color': '#182d39'}},
          {id: 'relief', type: 'hillshade', source: 'shading', metadata: {weatherRank: 200},
            paint: {'hillshade-exaggeration': .6, 'hillshade-shadow-color': '#16302c', 'hillshade-highlight-color': '#eef5d8'}}]}};
    // Separate WebGL surfaces allow the non-CORS satellite canvas to sit
    // between the terrain basemap and every weather/annotation layer.
    const backgroundElement = document.createElement('div');
    backgroundElement.className = 'terrain-background-map';
    Object.assign(backgroundElement.style, {position: 'absolute', inset: '0', zIndex: '0', pointerEvents: 'none'});
    document.getElementById(container).append(backgroundElement);
    const background = new gl.Map({...mapOptions, container: backgroundElement, interactive: false,
      attributionControl: false, centerClampedToGround: false, maxPitch: 80});
    const native = new gl.Map({...mapOptions,
      attributionControl: {customAttribution: '圖資 © <a href="https://maps.nlsc.gov.tw/">國土測繪中心</a>'},
      style: {...mapOptions.style, layers: []}});
    backgroundMaps.set(native, background);
    const labelElement = document.createElement('div');
    Object.assign(labelElement.style, {position:'absolute', inset:'0', zIndex:'3', pointerEvents:'none'});
    document.getElementById(container).append(labelElement);
    const labels = new gl.Map({...mapOptions, container:labelElement, interactive:false, attributionControl:false,
      centerClampedToGround:false, maxPitch:80, style:{version:8,sources:{},layers:[]}});
    labelMaps.set(native, labels);
    const syncLabels = () => labels.jumpTo({center:native.getCenter(),zoom:native.getZoom(),pitch:native.getPitch(),
      bearing:native.getBearing(),padding:native.getPadding(),elevation:native.getCenterElevation()});
    native.on('move',syncLabels);
    native.on('resize',()=>{labels.resize();syncLabels();});
    labels.on('load',syncLabels);

    native.getCanvas().style.zIndex = '2';
    const syncCamera = () => background.jumpTo({center: native.getCenter(), zoom: native.getZoom(),
      bearing: native.getBearing(), pitch: native.getPitch(), padding: native.getPadding(),
      elevation: native.getCenterElevation()});
    native.on('move', syncCamera);
    native.on('resize', () => { background.resize(); syncCamera(); });
    native.on('terrain', () => { background.setTerrain(native.getTerrain()); syncCamera(); });
    background.on('load', syncCamera);
    native.addControl(new gl.NavigationControl({visualizePitch: true}), 'top-left');
    const active = new Set();
    let ready = false;
    let viewMode = '2d';
    let terrainScale = 3;
    let baseAppearance = 'white';
    const applyBaseAppearance = () => {
      const white = baseAppearance === 'white';
      background.setPaintProperty('ocean', 'background-color', white ? '#ffffff' : '#182d39');
      background.setPaintProperty('relief', 'hillshade-exaggeration', white ? .25 : .6);
      background.setPaintProperty('relief', 'hillshade-shadow-color', white ? '#aab2bc' : '#16302c');
      background.setPaintProperty('relief', 'hillshade-highlight-color', white ? '#ffffff' : '#eef5d8');
      background.setPaintProperty('relief', 'hillshade-accent-color', white ? '#c5cbd2' : '#000000');
      // Refresh terrain's cached draped tiles after a basemap palette change.
      const terrain = background.getTerrain();
      background.setTerrain(null);
      if (terrain) background.setTerrain(terrain);
    };
    const report = text => { document.getElementById('terrainStatus').textContent = text; };
    const mount = layer => { try { layer.mount(native); } catch (error) { layer.unmount(); report('圖層載入失敗：' + error.message); } };
    let loadedMaps = 0;
    const finishLoading = () => {
      if (++loadedMaps !== 3) return;
      ready = true; applyBaseAppearance(); active.forEach(mount); syncCamera();
    };
    native.on('load', finishLoading);
    background.on('load', finishLoading);
    labels.on('load', finishLoading);
    background.on('sourcedata', event => {
      for (const layer of active) if (event.sourceId === layer.id && event.isSourceLoaded) {
        layer.loaded = true; layer.events.load?.();
      }
    });
    native.on('sourcedata', event => {
      if (event.sourceId === 'elevation' && event.isSourceLoaded && viewMode === '3d') report('三維地形已載入 · 高度倍率 1× 為原始高程');
      for (const layer of active) if (event.sourceId === layer.id && event.isSourceLoaded) {
        layer.loaded = true; layer.events.load?.();
      }
    });
    native.on('error', event => {
      if (event.sourceId === 'elevation') report('高程資料載入失敗，部分區域可能平坦；請檢查網路後重新整理。');
      else if (event.sourceId) { const layer = [...active].find(item => item.id === event.sourceId); if (layer) { layer.loaded = false; layer.events.load?.(); } }
      console.warn('Map layer error', event.error);
    });
    native.getCanvas().addEventListener('webglcontextlost', () => report('3D 繪圖連線中斷，請重新整理頁面。'));
    return {
      native,
      setViewMode(mode, exaggeration = terrainScale) {
        viewMode = mode; terrainScale = exaggeration;
        const terrain = mode === '3d' ? {source: 'elevation', exaggeration} : null;
        if (native.getSource('elevation')) native.setTerrain(terrain);
        if (background.getSource('elevation')) background.setTerrain(terrain);
        if (mode === '2d') {
          native.setMaxPitch(0); native.jumpTo({pitch: 0, bearing: 0, elevation: 0});
          native.dragRotate.disable(); native.touchZoomRotate.disableRotation(); native.touchPitch.disable();
          report('二維檢視 · 地形起伏已關閉');
        } else {
          native.setMaxPitch(80); native.dragRotate.enable(); native.touchZoomRotate.enableRotation(); native.touchPitch.enable();
          report('三維檢視 · 地形高度倍率 ' + exaggeration.toFixed(1) + '×');
        }
        syncCamera();
      },
      setBaseAppearance(key) { baseAppearance = key; if (ready) applyBaseAppearance(); },
      addLayer(layer) { active.add(layer); layer.owner = this; if (ready) mount(layer); },
      removeLayer(layer) { active.delete(layer); layer.unmount(); layer.owner = null; },
      on(events, callback) { events.split(' ').forEach(event => native.on(event, callback)); },
      createPane() { return {style: {}}; },
      getZoom: () => native.getZoom(), getMaxZoom: () => 18,
      getSize: () => ({x: native.getContainer().clientWidth}),
      invalidateSize: () => native.resize(),
      fitBounds(value, options = {}) {
        const b = bounds(value), tl = options.paddingTopLeft || [20, 20], br = options.paddingBottomRight || [20, 20];
        native.fitBounds([[b.getWest(), b.getSouth()], [b.getEast(), b.getNorth()]],
          {padding: {left: tl[0], top: tl[1], right: br[0], bottom: br[1]},
            maxZoom: options.maxZoom || 9, duration: 0,
            pitch: viewMode === '2d' ? 0 : 55, bearing: viewMode === '2d' ? 0 : -12});
      }
    };
  }
  return {...leaflet, map: createMap,
    tileLayer: (url, options) => new Layer('tile', url, options),
    imageOverlay: (image, extent, options) => new Layer('image', {image, bounds: extent}, options),
    geoJSON: (data, options) => new Layer('geojson', data, options),
    layerGroup: () => new Group(),
    rainColumn: (coordinates, options) => new RainColumn(coordinates, options),
    marker: (coordinates, options) => new Marker(coordinates, options, false),
    circleMarker: (coordinates, options) => new Marker(coordinates, options, true)
  };
};
