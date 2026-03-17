require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve everything in /public as static files
app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────
// ENDPOINT 1: Mapbox Token
// Serves the token through an API route so it never
// appears in any HTML or committed source file.
// ─────────────────────────────────────────
app.get('/api/mapbox-token', (req, res) => {
  if (!process.env.MAPBOX_TOKEN || process.env.MAPBOX_TOKEN === 'pk.your_mapbox_token_here') {
    return res.status(500).json({ error: 'MAPBOX_TOKEN is not configured in .env' });
  }
  res.json({ token: process.env.MAPBOX_TOKEN });
});

// ─────────────────────────────────────────
// ENDPOINT 2: Listings
// Fetches NYC apartment listings from Zillow via RapidAPI,
// filters to the last 3 days, and returns as GeoJSON.
// ─────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  // Dev shortcut: return mock data without hitting the API
  if (process.env.USE_MOCK === 'true') {
    try {
      const mock = require('./mock-data.json');
      const filtered = filterToLastThreeDays(mock.results || []);
      return res.json(formatAsGeoJSON(filtered));
    } catch {
      return res.status(500).json({ error: 'mock-data.json not found. Set USE_MOCK=false or create the file.' });
    }
  }

  if (!process.env.RAPIDAPI_KEY || process.env.RAPIDAPI_KEY === 'your_rapidapi_key_here') {
    return res.status(500).json({ error: 'RAPIDAPI_KEY is not configured in .env' });
  }

  try {
    const listings = await fetchZillowListings();
    const recent = filterToLastThreeDays(listings);
    const geojson = formatAsGeoJSON(recent);
    res.json(geojson);
  } catch (err) {
    console.error('Zillow fetch error:', err.message);
    res.status(502).json({ error: `Failed to fetch listings from Zillow: ${err.message}` });
  }
});

// ─────────────────────────────────────────
// Zillow56 API fetch
// Searches for NYC rental apartments using the Zillow56 RapidAPI.
// ─────────────────────────────────────────
async function fetchZillowListings() {
  const params = new URLSearchParams({
    location: 'New York, NY',
    status_type: 'ForRent',
    home_type: 'Apartments',
    daysOn: '3',
    page: '1'
  });

  const url = `https://zillow56.p.rapidapi.com/search?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
      'X-RapidAPI-Host': 'zillow56.p.rapidapi.com'
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Zillow API returned ${response.status}: ${body.slice(0, 200)}`);
  }

  const data = await response.json();

  // Optionally save response as mock data (uncomment during development)
  // require('fs').writeFileSync('./mock-data.json', JSON.stringify(data, null, 2));

  return data.results || [];
}

// ─────────────────────────────────────────
// Filter: keep only listings from the last 3 days.
// daysOnZillow === 0 means listed today.
// ─────────────────────────────────────────
function filterToLastThreeDays(listings) {
  return listings.filter(listing => {
    const days = listing.daysOnZillow;
    return typeof days === 'number' && days <= 3;
  });
}

// ─────────────────────────────────────────
// Convert Zillow results → GeoJSON FeatureCollection
// Mapbox GL JS consumes GeoJSON natively.
// ─────────────────────────────────────────
function formatAsGeoJSON(listings) {
  const features = listings
    .filter(listing => listing.longitude != null && listing.latitude != null)
    .map(listing => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [listing.longitude, listing.latitude] // GeoJSON is [lng, lat]
      },
      properties: {
        zpid: String(listing.zpid),
        address: listing.address || 'Address unavailable',
        price: listing.price,
        priceFormatted: formatPrice(listing.price),
        beds: listing.bedrooms ?? listing.beds ?? null,
        baths: listing.bathrooms ?? listing.baths ?? null,
        sqft: listing.livingArea ?? null,
        daysOnZillow: listing.daysOnZillow,
        listedLabel: daysLabel(listing.daysOnZillow),
        imageUrl: listing.imgSrc || null,
        zillowUrl: listing.detailUrl
          ? `https://www.zillow.com${listing.detailUrl}`
          : `https://www.zillow.com/homedetails/${listing.zpid}_zpid/`
      }
    }));

  return { type: 'FeatureCollection', features };
}

function formatPrice(price) {
  if (!price) return 'Price N/A';
  return '$' + Number(price).toLocaleString() + '/mo';
}

function daysLabel(days) {
  if (days === 0) return 'Listed today';
  if (days === 1) return 'Listed yesterday';
  return `Listed ${days} days ago`;
}

// ─────────────────────────────────────────
// Start server
// ─────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n  NYC Apartments running at http://localhost:${PORT}\n`);
  console.log(`  Mapbox token:  ${process.env.MAPBOX_TOKEN ? '✓ configured' : '✗ missing (add to .env)'}`);
  console.log(`  RapidAPI key:  ${process.env.RAPIDAPI_KEY ? '✓ configured' : '✗ missing (add to .env)'}`);
  console.log(`  Mock mode:     ${process.env.USE_MOCK === 'true' ? 'ON' : 'off'}\n`);
});
