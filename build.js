/**
 * build.js
 *   1. Parse input.xml → list of people (name, surname, address)
 *   2. Geocode each address ONCE (server-side), caching results in geocache.json
 *   3. Write public/data.json with baked-in lat/lng → map loads instantly
 *
 * The cache (geocache.json) is committed to git, so redeploys reuse it and
 * make zero API calls unless a new/changed address appears.
 */

const fs    = require('fs');
const path  = require('path');
const https = require('https');

const API_KEY   = 'AIzaSyDaIydo87nxHMB6SuC_XlxvrM6Bwk_Cwhs';
const CACHE_FILE = path.join(__dirname, 'geocache.json');
const OUT_DIR    = path.join(__dirname, 'public');
const OUT_FILE   = path.join(OUT_DIR, 'data.json');

// ─── XML helpers ──────────────────────────────────────────────────────────────

function decodeEntities(str) {
  if (!str) return '';
  return str
    .replace(/&amp;#39;/g, "'")
    .replace(/&#39;/g,     "'")
    .replace(/&amp;amp;/g, '&')
    .replace(/&amp;lt;/g,  '<')
    .replace(/&amp;gt;/g,  '>')
    .replace(/&amp;/g,     '&')
    .replace(/&lt;/g,      '<')
    .replace(/&gt;/g,      '>')
    .replace(/&quot;/g,    '"');
}

function parseXML() {
  const xml = fs.readFileSync(path.join(__dirname, 'input.xml'), 'utf-8');
  const people = [];
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
  let rowMatch, isHeader = true;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    if (isHeader) { isHeader = false; continue; }

    const cells = [];
    const cellRegex = /<Cell[^>]*>(?:<Data[^>]*>([\s\S]*?)<\/Data>)?<\/Cell>/g;
    let cm;
    while ((cm = cellRegex.exec(rowMatch[1])) !== null) {
      cells.push(cm[1] != null ? decodeEntities(cm[1].trim()) : '');
    }

    const name       = (cells[0]  || '').trim();
    const rawAddress = (cells[15] || cells[cells.length - 1] || '').trim();
    if (!name || !rawAddress) continue;

    const address = rawAddress.split(/\s{2,}/)[0].trim() || rawAddress;
    const surname = name.split(/\s+/)[0];
    people.push({ name, surname, address });
  }
  return people;
}

// ─── Geocoding ────────────────────────────────────────────────────────────────

function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function geocode(address) {
  const q   = encodeURIComponent(address + ', Україна');
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${API_KEY}&language=uk&region=UA`;
  const r   = await httpsGetJson(url);
  if (r.status === 'OK' && r.results && r.results.length) {
    const loc = r.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng };
  }
  if (r.status !== 'ZERO_RESULTS') {
    console.warn(`   ⚠ Geocode status "${r.status}"${r.error_message ? ' – ' + r.error_message : ''}`);
  }
  return null;
}

function loadCache() {
  try { return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8')); }
  catch { return {}; }
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const people = parseXML();
  const cache  = loadCache();

  let hits = 0, fetched = 0, failed = 0;

  for (const p of people) {
    const key = p.address;

    if (cache[key] !== undefined) {
      hits++;                                   // cached (coords or null)
    } else {
      const coords = await geocode(p.address);
      cache[key] = coords;                      // store null too (avoid re-tries)
      if (coords) fetched++; else failed++;
      await sleep(120);                         // gentle rate-limit
    }

    const c = cache[key];
    if (c) { p.lat = c.lat; p.lng = c.lng; }
  }

  // Persist cache
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');

  // Write data.json (only people that have coordinates get placed)
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  const withCoords = people.filter(p => p.lat != null && p.lng != null);
  fs.writeFileSync(OUT_FILE, JSON.stringify(withCoords), 'utf-8');

  console.log(`✅  build.js done: ${people.length} records | cache-hits ${hits}, geocoded ${fetched}, failed ${failed}`);
  console.log(`   → public/data.json (${withCoords.length} placed markers)`);
})();
