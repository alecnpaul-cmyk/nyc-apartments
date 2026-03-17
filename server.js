const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

// ─────────────────────────────────────────────────────
// NYC NEIGHBORHOOD → COORDINATES DICTIONARY
// Covers all five boroughs. No API key required.
// ─────────────────────────────────────────────────────
const HOODS = {
  // Manhattan
  'upper west side': [40.7870, -73.9754], 'uws': [40.7870, -73.9754],
  'upper east side': [40.7736, -73.9566], 'ues': [40.7736, -73.9566],
  'midtown': [40.7549, -73.9840], 'midtown east': [40.7564, -73.9663],
  'midtown west': [40.7549, -73.9980], 'midtown south': [40.7484, -73.9910],
  "hell's kitchen": [40.7638, -73.9926], 'hells kitchen': [40.7638, -73.9926],
  'clinton': [40.7638, -73.9926], 'chelsea': [40.7465, -73.9968],
  'gramercy': [40.7385, -73.9843], 'murray hill': [40.7484, -73.9774],
  'kips bay': [40.7427, -73.9773], 'flatiron': [40.7410, -73.9897],
  'flatiron district': [40.7410, -73.9897], 'greenwich village': [40.7335, -74.0027],
  'west village': [40.7341, -74.0070], 'soho': [40.7230, -74.0019],
  'nolita': [40.7229, -73.9949], 'little italy': [40.7191, -73.9973],
  'chinatown': [40.7158, -73.9970], 'tribeca': [40.7163, -74.0086],
  'financial district': [40.7074, -74.0113], 'fidi': [40.7074, -74.0113],
  'battery park city': [40.7118, -74.0155], 'battery park': [40.7118, -74.0155],
  'lower east side': [40.7153, -73.9842], 'les': [40.7153, -73.9842],
  'east village': [40.7265, -73.9815], 'noho': [40.7266, -73.9936],
  'harlem': [40.8116, -73.9465], 'east harlem': [40.7957, -73.9370],
  'spanish harlem': [40.7957, -73.9370], 'el barrio': [40.7957, -73.9370],
  'central harlem': [40.8116, -73.9465], 'hamilton heights': [40.8238, -73.9495],
  'washington heights': [40.8448, -73.9335], 'inwood': [40.8675, -73.9212],
  'morningside heights': [40.8097, -73.9625], 'manhattan valley': [40.7946, -73.9673],
  'lenox hill': [40.7685, -73.9594], 'yorkville': [40.7756, -73.9447],
  'carnegie hill': [40.7836, -73.9548], 'stuyvesant town': [40.7328, -73.9770],
  'stuy town': [40.7328, -73.9770], 'two bridges': [40.7131, -73.9955],
  'marble hill': [40.8766, -73.9107], 'manhattan': [40.7831, -73.9712],
  'mnh': [40.7831, -73.9712], 'new york': [40.7549, -73.9840],

  // Brooklyn
  'williamsburg': [40.7081, -73.9571], 'north williamsburg': [40.7197, -73.9542],
  'south williamsburg': [40.7028, -73.9606], 'east williamsburg': [40.7108, -73.9336],
  'bushwick': [40.6958, -73.9171], 'bedford-stuyvesant': [40.6872, -73.9418],
  'bed-stuy': [40.6872, -73.9418], 'bedstuy': [40.6872, -73.9418],
  'park slope': [40.6668, -73.9799], 'crown heights': [40.6694, -73.9422],
  'flatbush': [40.6501, -73.9496], 'east flatbush': [40.6415, -73.9286],
  'east new york': [40.6501, -73.8801], 'bay ridge': [40.6355, -74.0205],
  'sunset park': [40.6479, -74.0102], 'red hook': [40.6746, -74.0094],
  'dumbo': [40.7033, -73.9881], 'brooklyn heights': [40.6960, -73.9937],
  'cobble hill': [40.6862, -73.9938], 'carroll gardens': [40.6800, -73.9991],
  'boerum hill': [40.6868, -73.9870], 'gowanus': [40.6741, -73.9997],
  'prospect heights': [40.6775, -73.9645], 'lefferts gardens': [40.6577, -73.9561],
  'prospect lefferts gardens': [40.6577, -73.9561], 'kensington': [40.6412, -73.9779],
  'borough park': [40.6310, -73.9990], 'bensonhurst': [40.6052, -73.9985],
  'dyker heights': [40.6209, -74.0098], 'canarsie': [40.6410, -73.9011],
  'sheepshead bay': [40.5928, -73.9438], 'brighton beach': [40.5777, -73.9614],
  'coney island': [40.5755, -73.9707], 'flatlands': [40.6337, -73.9284],
  'midwood': [40.6248, -73.9614], 'ditmas park': [40.6333, -73.9647],
  'fort greene': [40.6896, -73.9727], 'clinton hill': [40.6875, -73.9673],
  'vinegar hill': [40.6999, -73.9885], 'downtown brooklyn': [40.6926, -73.9880],
  'greenpoint': [40.7298, -73.9524], 'marine park': [40.6063, -73.9253],
  'brooklyn': [40.6782, -73.9442], 'bk': [40.6782, -73.9442],

  // Queens
  'astoria': [40.7721, -73.9302], 'long island city': [40.7447, -73.9486],
  'lic': [40.7447, -73.9486], 'flushing': [40.7675, -73.8330],
  'jamaica': [40.7021, -73.7964], 'bayside': [40.7610, -73.7760],
  'forest hills': [40.7196, -73.8448], 'jackson heights': [40.7557, -73.8834],
  'corona': [40.7467, -73.8681], 'elmhurst': [40.7366, -73.8789],
  'sunnyside': [40.7434, -73.9191], 'woodside': [40.7449, -73.9044],
  'ridgewood': [40.7050, -73.9036], 'richmond hill': [40.7007, -73.8340],
  'kew gardens': [40.7138, -73.8307], 'fresh meadows': [40.7326, -73.7932],
  'hollis': [40.7106, -73.7665], 'queens village': [40.7242, -73.7478],
  'south ozone park': [40.6784, -73.8213], 'ozone park': [40.6869, -73.8466],
  'howard beach': [40.6579, -73.8510], 'far rockaway': [40.6054, -73.7548],
  'rockaway': [40.5868, -73.8120], 'queens': [40.7282, -73.7949],

  // Bronx
  'riverdale': [40.8990, -73.9121], 'fordham': [40.8618, -73.8905],
  'mott haven': [40.8096, -73.9240], 'south bronx': [40.8176, -73.9130],
  'tremont': [40.8496, -73.8975], 'belmont': [40.8561, -73.8903],
  'parkchester': [40.8392, -73.8614], 'soundview': [40.8212, -73.8673],
  'throggs neck': [40.8224, -73.8281], 'co-op city': [40.8749, -73.8293],
  'woodlawn': [40.8995, -73.8686], 'wakefield': [40.8935, -73.8527],
  'morris heights': [40.8499, -73.9207], 'university heights': [40.8568, -73.9124],
  'grand concourse': [40.8485, -73.9151], 'highbridge': [40.8391, -73.9270],
  'morrisania': [40.8261, -73.9108], 'hunts point': [40.8143, -73.8895],
  'concourse': [40.8485, -73.9151], 'bronx': [40.8448, -73.8648],

  // Staten Island
  'st. george': [40.6443, -74.0740], 'saint george': [40.6443, -74.0740],
  'stapleton': [40.6293, -74.0740], 'port richmond': [40.6380, -74.1340],
  'new springville': [40.5733, -74.1656], 'staten island': [40.5795, -74.1502],
};

function lookupCoords(neighborhood) {
  if (!neighborhood) return null;
  const key = neighborhood.toLowerCase().trim();
  if (HOODS[key]) return [...HOODS[key]];
  for (const [name, coords] of Object.entries(HOODS)) {
    if (key.includes(name) || name.includes(key)) return [...coords];
  }
  return null;
}

// Add small random jitter so listings in the same neighborhood don't stack
function jitter(coords) {
  return [
    coords[0] + (Math.random() - 0.5) * 0.016,
    coords[1] + (Math.random() - 0.5) * 0.020,
  ];
}

// ─────────────────────────────────────────────────────
// CRAIGSLIST RSS
// ─────────────────────────────────────────────────────
async function fetchCraigslistRSS() {
  const url = 'https://newyork.craigslist.org/search/apa?format=rss';
  // Try several User-Agent strings — cloud IPs are often blocked by Craigslist
  const agents = [
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0',
  ];
  for (const ua of agents) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': ua,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
        },
        timeout: 12000,
      });
      if (res.ok) return res.text();
    } catch (_) { /* try next agent */ }
  }
  throw new Error('blocked');
}

// ─────────────────────────────────────────────────────
// RSS PARSER (zero dependencies — pure regex)
// ─────────────────────────────────────────────────────
function parseRSS(xml) {
  const items = [];
  const itemRx = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRx.exec(xml)) !== null) {
    const b = m[1];
    items.push({
      title: cdataOrTag(b, 'title'),
      link:  plainTag(b, 'link') || plainTag(b, 'guid'),
      date:  plainTag(b, 'pubDate') || plainTag(b, 'dc:date'),
      image: attrVal(b, 'enc:enclosure', 'url'),
    });
  }
  return items;
}

function cdataOrTag(xml, tag) {
  const cd = xml.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`));
  if (cd) return cd[1].trim();
  return plainTag(xml, tag);
}
function plainTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`));
  return m ? m[1].trim() : '';
}
function attrVal(xml, tag, attr) {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"[^>]*>`));
  return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────
// TITLE PARSER
// Craigslist titles look like:
//   "$3,500 / 2br - 950ft² - Sunny apartment (Park Slope)"
// ─────────────────────────────────────────────────────
function parseTitle(raw) {
  const t = raw.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'");

  const priceM = t.match(/\$([\d,]+)/);
  const price  = priceM ? parseInt(priceM[1].replace(/,/g, '')) : null;

  let beds = null;
  if (/studio/i.test(t)) beds = 0;
  else { const bm = t.match(/(\d+)\s*(?:br|bed)/i); if (bm) beds = parseInt(bm[1]); }

  const nM = t.match(/\(([^)]+)\)\s*$/);
  const neighborhood = nM ? nM[1].trim() : null;

  return { price, beds, neighborhood };
}

// ─────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────
const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

function isRecent(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return !isNaN(d) && Date.now() - d.getTime() <= THREE_DAYS_MS;
}

function listedLabel(dateStr) {
  const ms = Date.now() - new Date(dateStr).getTime();
  const h  = Math.floor(ms / 3600000);
  if (h < 1)  return 'Listed just now';
  if (h < 24) return `Listed ${h}h ago`;
  const d = Math.floor(ms / 86400000);
  return d === 1 ? 'Listed yesterday' : `Listed ${d} days ago`;
}

// ─────────────────────────────────────────────────────
// BUILD GEOJSON
// ─────────────────────────────────────────────────────
function buildGeoJSON(items) {
  const features = [];
  let id = 0;

  for (const item of items) {
    const { price, beds, neighborhood } = parseTitle(item.title);
    const base = lookupCoords(neighborhood);
    if (!base) continue; // skip listings with unrecognised location

    const [lat, lng] = jitter(base);
    const ms      = Date.now() - new Date(item.date).getTime();
    const isToday = ms < 24 * 3600000;

    features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [lng, lat] },
      properties: {
        id: String(id++),
        title: item.title,
        price,
        priceFormatted: price ? `$${price.toLocaleString()}/mo` : 'Price N/A',
        beds,
        neighborhood: neighborhood || 'NYC',
        url:          item.link,
        imageUrl:     item.image,
        isToday,
        listedLabel:  listedLabel(item.date),
        daysAgo:      Math.floor(ms / 86400000),
      },
    });
  }

  return { type: 'FeatureCollection', features };
}

// ─────────────────────────────────────────────────────
// SAMPLE DATA — used when Craigslist blocks cloud IPs
// ─────────────────────────────────────────────────────
function sampleItems() {
  const now = Date.now();
  const h = (n) => new Date(now - n * 3600 * 1000).toUTCString();
  return [
    { title: '$2,800 / 1br - Bright renovated apt (Williamsburg)',  link: 'https://newyork.craigslist.org/brk/apa/sample-1', date: h(3),  image: null },
    { title: '$3,500 / 2br - Sunny loft with laundry (Park Slope)', link: 'https://newyork.craigslist.org/brk/apa/sample-2', date: h(5),  image: null },
    { title: '$2,200 / Studio - Near subway (Astoria)',             link: 'https://newyork.craigslist.org/que/apa/sample-3', date: h(8),  image: null },
    { title: '$4,200 / 2br - Pre-war doorman building (Upper West Side)', link: 'https://newyork.craigslist.org/mnh/apa/sample-4', date: h(10), image: null },
    { title: '$1,900 / Studio - Cozy garden unit (Ridgewood)',      link: 'https://newyork.craigslist.org/que/apa/sample-5', date: h(14), image: null },
    { title: '$3,100 / 1br - Exposed brick, high ceilings (Bushwick)', link: 'https://newyork.craigslist.org/brk/apa/sample-6', date: h(2),  image: null },
    { title: '$5,500 / 3br - Renovated Brownstone (Brooklyn Heights)', link: 'https://newyork.craigslist.org/brk/apa/sample-7', date: h(20), image: null },
    { title: '$2,600 / 1br - Modern finishes (Long Island City)',   link: 'https://newyork.craigslist.org/que/apa/sample-8', date: h(26), image: null },
    { title: '$3,800 / 2br - Steps to Central Park (Upper East Side)', link: 'https://newyork.craigslist.org/mnh/apa/sample-9', date: h(30), image: null },
    { title: '$2,400 / 1br - Light-filled with roof deck (Greenpoint)', link: 'https://newyork.craigslist.org/brk/apa/sample-10', date: h(1), image: null },
    { title: '$3,200 / 2br - Gut renovated (Harlem)',               link: 'https://newyork.craigslist.org/mnh/apa/sample-11', date: h(4),  image: null },
    { title: '$2,100 / Studio - Prime location (Sunnyside)',        link: 'https://newyork.craigslist.org/que/apa/sample-12', date: h(36), image: null },
    { title: '$4,800 / 2br - Full service building (Chelsea)',      link: 'https://newyork.craigslist.org/mnh/apa/sample-13', date: h(7),  image: null },
    { title: '$2,950 / 1br - Hardwood floors, dishwasher (Bed-Stuy)', link: 'https://newyork.craigslist.org/brk/apa/sample-14', date: h(15), image: null },
    { title: '$3,300 / 2br - Spacious corner unit (Jackson Heights)', link: 'https://newyork.craigslist.org/que/apa/sample-15', date: h(48), image: null },
    { title: '$6,200 / 3br - Luxury high-rise (Midtown West)',      link: 'https://newyork.craigslist.org/mnh/apa/sample-16', date: h(11), image: null },
    { title: '$2,700 / 1br - Steps to L train (East Williamsburg)', link: 'https://newyork.craigslist.org/brk/apa/sample-17', date: h(6),  image: null },
    { title: '$1,750 / Studio - Great bones (Mott Haven)',          link: 'https://newyork.craigslist.org/brx/apa/sample-18', date: h(22), image: null },
    { title: '$3,900 / 2br - Waterfront views (Battery Park City)', link: 'https://newyork.craigslist.org/mnh/apa/sample-19', date: h(9),  image: null },
    { title: '$2,500 / 1br - Sunny top floor (Crown Heights)',      link: 'https://newyork.craigslist.org/brk/apa/sample-20', date: h(18), image: null },
  ];
}

// ─────────────────────────────────────────────────────
// API ENDPOINT
// ─────────────────────────────────────────────────────
app.get('/api/listings', async (req, res) => {
  try {
    let items;
    let usingSample = false;
    try {
      const xml = await fetchCraigslistRSS();
      const all = parseRSS(xml);
      items = all.filter(i => isRecent(i.date));
      console.log(`Live Craigslist: ${items.length} recent of ${all.length} total`);
    } catch (err) {
      console.warn(`Craigslist unavailable (${err.message}), using sample data`);
      items = sampleItems();
      usingSample = true;
    }
    const geojson = buildGeoJSON(items);
    geojson.usingSample = usingSample;
    console.log(`Serving ${geojson.features.length} listings${usingSample ? ' [SAMPLE]' : ''}`);
    res.json(geojson);
  } catch (err) {
    console.error('Listings error:', err.message);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n  NYC Apartments → http://localhost:${PORT}`);
  console.log('  100% free: Craigslist + CartoDB + OpenStreetMap\n');
});
