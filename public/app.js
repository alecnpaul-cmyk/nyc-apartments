'use strict';

// ── State ─────────────────────────────────────────
let map = null;
let clusterGroup = null;
const markerById = new Map(); // id → Leaflet marker

// ── Boot ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initMap();
  loadListings();
});

// ════════════════════════════════════════════════
//  MAP
// ════════════════════════════════════════════════
function initMap() {
  map = L.map('map', {
    center: [40.7484, -73.9857],
    zoom: 11,
    zoomControl: false,
    preferCanvas: true,
  });

  // CartoDB Dark Matter — free, no API key
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution:
      '© <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors ' +
      '© <a href="https://carto.com/attributions" target="_blank">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20,
  }).addTo(map);

  // Zoom controls top-right
  L.control.zoom({ position: 'topright' }).addTo(map);

  // Cluster group with custom styling
  clusterGroup = L.markerClusterGroup({
    chunkedLoading: true,
    maxClusterRadius: 48,
    iconCreateFunction(cluster) {
      const n = cluster.getChildCount();
      const size = n < 10 ? 36 : n < 30 ? 42 : 48;
      return L.divIcon({
        html: `<div class="cluster-icon">${n}</div>`,
        className: '',
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
    },
  });

  map.addLayer(clusterGroup);
}

// ════════════════════════════════════════════════
//  DATA
// ════════════════════════════════════════════════
async function loadListings() {
  showLoading(true);
  setUpdatedLabel('Fetching listings from Craigslist...');

  let data;
  try {
    const res = await fetch('/api/listings');
    data = await res.json();
    if (!res.ok) throw new Error(data.error || `Server error ${res.status}`);
  } catch (err) {
    showLoading(false);
    showError(err.message);
    return;
  }

  showLoading(false);

  const features = data.features || [];
  populateMap(features);
  renderSidebar(features);
  updateStats(features);

  const count = features.length;
  const t = new Date();
  if (data.usingSample) {
    setUpdatedLabel(`Sample data · ${count} listings (Craigslist blocked cloud IPs)`);
    document.getElementById('source-badge').title = 'Using sample data — Craigslist blocks requests from cloud servers';
  } else {
    setUpdatedLabel(
      `Updated ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${count} listing${count !== 1 ? 's' : ''}`
    );
  }
}

// ════════════════════════════════════════════════
//  MAP PINS
// ════════════════════════════════════════════════
function populateMap(features) {
  clusterGroup.clearLayers();
  markerById.clear();

  features.forEach(feature => {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties;

    const icon = L.divIcon({
      className: '',
      html: `<div class="map-pin ${props.isToday ? 'pin-today' : 'pin-recent'}"></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -12],
    });

    const marker = L.marker([lat, lng], { icon });

    marker.bindPopup(buildPopupHtml(props), {
      className: 'nyc-popup',
      maxWidth: 290,
      minWidth: 260,
      autoPanPadding: [40, 40],
    });

    marker.on('popupopen',  () => setActiveCard(props.id));
    marker.on('popupclose', () => setActiveCard(null));

    clusterGroup.addLayer(marker);
    markerById.set(props.id, marker);
  });

  if (features.length > 0) fitBounds(features);
}

function buildPopupHtml(p) {
  const img = p.imageUrl
    ? `<img class="popup-img" src="${p.imageUrl}" alt="" loading="lazy" onerror="this.style.display='none'">`
    : `<div class="popup-img-placeholder">No photo</div>`;

  const bedStr = p.beds != null
    ? (p.beds === 0 ? 'Studio' : `${p.beds} bd`)
    : 'N/A';

  const badge = p.isToday ? 'badge-today' : 'badge-recent';

  return `
    ${img}
    <div class="popup-body">
      <div class="popup-price">${p.priceFormatted}</div>
      <div class="popup-meta">${bedStr} · ${p.neighborhood}</div>
      <span class="popup-badge ${badge}">
        <span class="badge-dot"></span>${p.listedLabel}
      </span>
      <div class="popup-divider"></div>
      <a class="popup-link" href="${p.url}" target="_blank" rel="noopener noreferrer">
        ${p.url.includes('/search/') ? 'Browse on Craigslist ↗' : 'View on Craigslist ↗'}
      </a>
    </div>
  `;
}

// ════════════════════════════════════════════════
//  SIDEBAR
// ════════════════════════════════════════════════
function renderSidebar(features) {
  const list = document.getElementById('listing-list');
  list.innerHTML = '';

  if (features.length === 0) {
    list.innerHTML = '<li class="no-results">No new apartments found in NYC<br>in the last 3 days.</li>';
    list.classList.remove('hidden');
    return;
  }

  // Sort: today first, then cheapest
  const sorted = [...features].sort((a, b) => {
    const da = a.properties.daysAgo, db = b.properties.daysAgo;
    if (da !== db) return da - db;
    return (a.properties.price || 0) - (b.properties.price || 0);
  });

  sorted.forEach(feature => {
    const p = feature.properties;
    const li = document.createElement('li');
    li.className = `listing-card${p.isToday ? ' today' : ''}`;
    li.dataset.id = p.id;

    const bedStr = p.beds != null
      ? (p.beds === 0 ? 'Studio' : `${p.beds} bd`)
      : '';

    li.innerHTML = `
      <div class="card-row">
        <span class="card-price">${p.priceFormatted}</span>
        <span class="card-badge ${p.isToday ? 'badge-today' : 'badge-recent'}">
          <span class="badge-dot"></span>${p.listedLabel}
        </span>
      </div>
      <div class="card-meta">${[bedStr, p.neighborhood].filter(Boolean).join(' · ')}</div>
    `;

    li.addEventListener('click', () => flyToListing(feature));
    list.appendChild(li);
  });

  list.classList.remove('hidden');
}

// ════════════════════════════════════════════════
//  INTERACTIONS
// ════════════════════════════════════════════════
function flyToListing(feature) {
  const [lng, lat] = feature.geometry.coordinates;
  const props = feature.properties;
  const marker = markerById.get(props.id);
  if (!marker) return;

  // zoomToShowLayer handles unclustering, then opens popup
  clusterGroup.zoomToShowLayer(marker, () => {
    map.setView([lat, lng], Math.max(map.getZoom(), 14), { animate: true });
    marker.openPopup();
  });
}

function setActiveCard(id) {
  document.querySelectorAll('.listing-card').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  if (id) {
    const card = document.querySelector(`.listing-card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function fitBounds(features) {
  if (features.length === 0) return;
  if (features.length === 1) {
    const [lng, lat] = features[0].geometry.coordinates;
    map.setView([lat, lng], 15);
    return;
  }
  const lats = features.map(f => f.geometry.coordinates[1]);
  const lngs = features.map(f => f.geometry.coordinates[0]);
  map.fitBounds(
    [[Math.min(...lats), Math.min(...lngs)], [Math.max(...lats), Math.max(...lngs)]],
    { paddingTopLeft: [400, 60], paddingBottomRight: [60, 60], maxZoom: 14 }
  );
}

// ════════════════════════════════════════════════
//  STATS BAR
// ════════════════════════════════════════════════
function updateStats(features) {
  const count   = features.length;
  const today   = features.filter(f => f.properties.isToday).length;
  const prices  = features.map(f => f.properties.price).filter(p => p > 0).sort((a, b) => a - b);
  const median  = prices.length ? prices[Math.floor(prices.length / 2)] : null;

  document.getElementById('count-value').textContent  = count;
  document.getElementById('today-value').textContent  = today;
  document.getElementById('median-value').textContent = median ? `$${(Math.round(median / 100) * 100).toLocaleString()}` : '—';
}

// ════════════════════════════════════════════════
//  UI HELPERS
// ════════════════════════════════════════════════
function showLoading(on) {
  document.getElementById('listing-loading').classList.toggle('hidden', !on);
  document.getElementById('listing-list').classList.toggle('hidden', on);
}

function showError(msg) {
  document.getElementById('listing-loading').classList.add('hidden');
  document.getElementById('listing-list').classList.add('hidden');
  document.getElementById('error-message').textContent = msg;
  document.getElementById('listing-error').classList.remove('hidden');
  setUpdatedLabel('Failed to load');
}

function setUpdatedLabel(text) {
  document.getElementById('updated-label').textContent = text;
}
