// ════════════════════════════════════════════════
//  NYC Apartments — Frontend
// ════════════════════════════════════════════════

'use strict';

// ── State ─────────────────────────────────────
let map = null;
let geojsonData = null;   // GeoJSON FeatureCollection from /api/listings
let activePopup = null;   // currently open Mapbox popup
let activeZpid = null;    // zpid of the highlighted listing

// ── Entry point ───────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  try {
    const { token } = await fetchJSON('/api/mapbox-token');
    initMap(token);
  } catch (err) {
    showError(err.message);
  }
}

// ════════════════════════════════════════════════
//  MAP INITIALIZATION
// ════════════════════════════════════════════════

function initMap(token) {
  mapboxgl.accessToken = token;

  map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/dark-v11',
    center: [-73.9857, 40.7484],   // Manhattan
    zoom: 11.5,
    minZoom: 9,
    maxZoom: 19,
    pitchWithRotate: false
  });

  map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right');

  // Load listings once the style is ready so we can add layers immediately
  map.on('style.load', () => {
    setupLayers();
    loadListings();
  });
}

// ════════════════════════════════════════════════
//  MAP LAYERS
// ════════════════════════════════════════════════

function setupLayers() {
  // Source — empty at first, populated after fetch
  map.addSource('listings', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 13,
    clusterRadius: 45
  });

  // ── Cluster circles ───────────────────────────
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'listings',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': [
        'step', ['get', 'point_count'],
        '#4f8ef7',    // 1-9
        10, '#818cf8', // 10-29
        30, '#a78bfa'  // 30+
      ],
      'circle-radius': [
        'step', ['get', 'point_count'],
        20,
        10, 26,
        30, 32
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.12)',
      'circle-opacity': 0.9
    }
  });

  // Cluster count label
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'listings',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': '{point_count_abbreviated}',
      'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
      'text-size': 13
    },
    paint: { 'text-color': '#ffffff' }
  });

  // ── Individual pins (outer pulse ring for "today") ─
  map.addLayer({
    id: 'pins-ring',
    type: 'circle',
    source: 'listings',
    filter: ['all',
      ['!', ['has', 'point_count']],
      ['==', ['get', 'daysOnZillow'], 0]
    ],
    paint: {
      'circle-color': 'transparent',
      'circle-radius': 18,
      'circle-stroke-width': 1.5,
      'circle-stroke-color': '#22c55e',
      'circle-stroke-opacity': 0.45
    }
  });

  // ── Individual pins ───────────────────────────
  map.addLayer({
    id: 'pins',
    type: 'circle',
    source: 'listings',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': [
        'case',
        ['==', ['get', 'daysOnZillow'], 0], '#22c55e',  // green = today
        '#4f8ef7'                                         // blue = 1-3 days
      ],
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 6,
        14, 9,
        17, 12
      ],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': 'rgba(255,255,255,0.2)',
      'circle-opacity': 0.95
    }
  });

  // ── Hover highlight layer ─────────────────────
  map.addLayer({
    id: 'pins-highlight',
    type: 'circle',
    source: 'listings',
    filter: ['==', ['get', 'zpid'], ''],  // start with nothing highlighted
    paint: {
      'circle-color': 'transparent',
      'circle-radius': [
        'interpolate', ['linear'], ['zoom'],
        10, 9,
        14, 14,
        17, 18
      ],
      'circle-stroke-width': 2.5,
      'circle-stroke-color': '#ffffff',
      'circle-stroke-opacity': 0.9
    }
  });

  // ── Events ────────────────────────────────────

  // Click on a single pin
  map.on('click', 'pins', (e) => {
    const feature = e.features[0];
    handlePinClick(feature);
  });

  // Click on a cluster → zoom in
  map.on('click', 'clusters', (e) => {
    const [feature] = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    const clusterId = feature.properties.cluster_id;
    map.getSource('listings').getClusterExpansionZoom(clusterId, (err, zoom) => {
      if (err) return;
      map.flyTo({ center: feature.geometry.coordinates, zoom, duration: 450 });
    });
  });

  // Cursor changes
  ['pins', 'clusters'].forEach(layer => {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mouseleave', layer, () => { map.getCanvas().style.cursor = ''; });
  });
}

// ════════════════════════════════════════════════
//  DATA FETCH
// ════════════════════════════════════════════════

async function loadListings() {
  showLoading(true);
  setUpdatedLabel('Fetching listings...');

  try {
    geojsonData = await fetchJSON('/api/listings');
  } catch (err) {
    showLoading(false);
    showError(err.message);
    return;
  }

  showLoading(false);

  const features = geojsonData.features;
  const count = features.length;

  // Push data into the map source
  map.getSource('listings').setData(geojsonData);

  // Update stats
  updateStats(features);

  // Render sidebar cards
  renderSidebar(features);

  // Fit map to show all pins
  if (count > 0) fitBounds(features);

  // Update timestamp
  const now = new Date();
  setUpdatedLabel(
    `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${count} listing${count !== 1 ? 's' : ''}`
  );
}

// ════════════════════════════════════════════════
//  STATS BAR
// ════════════════════════════════════════════════

function updateStats(features) {
  const count = features.length;
  const todayCount = features.filter(f => f.properties.daysOnZillow === 0).length;

  const prices = features
    .map(f => f.properties.price)
    .filter(p => typeof p === 'number' && p > 0)
    .sort((a, b) => a - b);

  const median = prices.length
    ? prices[Math.floor(prices.length / 2)]
    : null;

  document.getElementById('count-value').textContent = count;
  document.getElementById('today-value').textContent = todayCount;
  document.getElementById('median-value').textContent = median
    ? '$' + Math.round(median / 100) * 100 + ''
    : '—';
}

// ════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════

function renderSidebar(features) {
  const list = document.getElementById('listing-list');
  list.innerHTML = '';

  if (features.length === 0) {
    const li = document.createElement('li');
    li.className = 'no-results';
    li.innerHTML = 'No new apartments found in NYC<br>in the last 3 days.';
    list.appendChild(li);
    list.classList.remove('hidden');
    return;
  }

  // Sort: today first, then by price ascending
  const sorted = [...features].sort((a, b) => {
    const da = a.properties.daysOnZillow;
    const db = b.properties.daysOnZillow;
    if (da !== db) return da - db;
    return (a.properties.price || 0) - (b.properties.price || 0);
  });

  sorted.forEach(feature => {
    const p = feature.properties;
    const isToday = p.daysOnZillow === 0;
    const coords = feature.geometry.coordinates;

    const li = document.createElement('li');
    li.className = `listing-card${isToday ? ' today' : ''}`;
    li.dataset.zpid = p.zpid;

    li.innerHTML = `
      <div class="card-row">
        <span class="card-price">${p.priceFormatted}</span>
        <span class="card-badge ${isToday ? 'badge-today' : 'badge-recent'}">
          <span class="badge-dot"></span>${p.listedLabel}
        </span>
      </div>
      <div class="card-meta">${formatBedBath(p.beds, p.baths)}${p.sqft ? ' · ' + Number(p.sqft).toLocaleString() + ' sqft' : ''}</div>
      <div class="card-address">${p.address}</div>
    `;

    li.addEventListener('click', () => {
      flyToListing(coords, p);
    });

    list.appendChild(li);
  });

  list.classList.remove('hidden');
}

// ════════════════════════════════════════════════
//  PIN CLICK & POPUP
// ════════════════════════════════════════════════

function handlePinClick(feature) {
  const coords = feature.geometry.coordinates.slice();
  const props = feature.properties;
  flyToListing(coords, props);
}

function flyToListing(coords, props) {
  map.flyTo({
    center: coords,
    zoom: Math.max(map.getZoom(), 14.5),
    offset: [120, 0],
    duration: 600,
    essential: true
  });

  // Show the popup after fly (slight delay so it appears on arrival)
  setTimeout(() => showPopup(coords, props), 200);

  setActiveCard(props.zpid);
}

function showPopup(coords, props) {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }

  const isToday = props.daysOnZillow === 0;
  const badgeClass = isToday ? 'badge-today' : 'badge-recent';
  const dotPulse = isToday ? ' style="animation:pulse-dot 1.5s ease-in-out infinite"' : '';

  const imageHtml = props.imageUrl
    ? `<img class="popup-img" src="${props.imageUrl}" alt="Listing photo" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="popup-img-placeholder">No photo available</div>`;

  const metaParts = [formatBedBath(props.beds, props.baths)];
  if (props.sqft) metaParts.push(Number(props.sqft).toLocaleString() + ' sqft');

  const html = `
    ${imageHtml}
    <div class="popup-body">
      <div class="popup-price">${props.priceFormatted}</div>
      <div class="popup-meta">${metaParts.join(' · ')}</div>
      <div class="popup-address">${props.address}</div>
      <span class="popup-badge ${badgeClass}">
        <span class="badge-dot"${dotPulse}></span>${props.listedLabel}
      </span>
      <div class="popup-divider"></div>
      <a class="popup-link" href="${props.zillowUrl}" target="_blank" rel="noopener noreferrer">
        View on Zillow <span class="popup-link-arrow">↗</span>
      </a>
    </div>
  `;

  activePopup = new mapboxgl.Popup({
    closeOnClick: false,
    maxWidth: '290px',
    offset: 16,
    className: 'nyc-popup'
  })
    .setLngLat(coords)
    .setHTML(html)
    .addTo(map);

  activePopup.on('close', () => {
    activePopup = null;
    setActiveCard(null);
  });
}

// ════════════════════════════════════════════════
//  CARD / PIN SYNC
// ════════════════════════════════════════════════

function setActiveCard(zpid) {
  activeZpid = zpid;

  // Sidebar
  document.querySelectorAll('.listing-card').forEach(el => {
    el.classList.toggle('active', el.dataset.zpid === zpid);
  });

  // Scroll the active card into view
  if (zpid) {
    const card = document.querySelector(`.listing-card[data-zpid="${zpid}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Map highlight layer
  if (map.getLayer('pins-highlight')) {
    map.setFilter('pins-highlight', ['==', ['get', 'zpid'], zpid || '']);
  }
}

// ════════════════════════════════════════════════
//  MAP BOUNDS
// ════════════════════════════════════════════════

function fitBounds(features) {
  if (features.length === 0) return;
  if (features.length === 1) {
    map.flyTo({ center: features[0].geometry.coordinates, zoom: 15, duration: 800 });
    return;
  }

  const lngs = features.map(f => f.geometry.coordinates[0]);
  const lats = features.map(f => f.geometry.coordinates[1]);

  map.fitBounds(
    [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
    { padding: { top: 60, bottom: 60, left: 420, right: 80 }, maxZoom: 14, duration: 1000 }
  );
}

// ════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════

function showLoading(visible) {
  document.getElementById('listing-loading').classList.toggle('hidden', !visible);
  document.getElementById('listing-list').classList.toggle('hidden', visible);
}

function showError(msg) {
  document.getElementById('listing-loading').classList.add('hidden');
  document.getElementById('listing-list').classList.add('hidden');

  const errEl = document.getElementById('listing-error');
  document.getElementById('error-message').textContent = msg;
  errEl.classList.remove('hidden');

  setUpdatedLabel('Failed to load');
}

function setUpdatedLabel(text) {
  document.getElementById('updated-label').textContent = text;
}

function formatBedBath(beds, baths) {
  const parts = [];
  if (beds != null) parts.push(`${beds} bd`);
  if (baths != null) parts.push(`${baths} ba`);
  return parts.join(' · ') || 'Details N/A';
}

async function fetchJSON(url) {
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
