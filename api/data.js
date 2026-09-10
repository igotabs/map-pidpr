const fs   = require('fs');
const path = require('path');

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
  // input.xml lives at the project root (one level up from api/)
  const xmlPath = path.join(__dirname, '..', 'input.xml');
  const xml = fs.readFileSync(xmlPath, 'utf-8');

  const people = [];
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
  let rowMatch;
  let isHeader = true;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    if (isHeader) { isHeader = false; continue; }

    const rowHtml = rowMatch[1];
    const cells   = [];

    const cellRegex = /<Cell[^>]*>(?:<Data[^>]*>([\s\S]*?)<\/Data>)?<\/Cell>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1] != null ? decodeEntities(cellMatch[1].trim()) : '');
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

// ─── Cache parsed result in memory (survives warm invocations) ────────────────
let _cache = null;
function getCachedPeople() {
  if (!_cache) _cache = parseXML();
  return _cache;
}

// ─── Vercel serverless handler ───────────────────────────────────────────────
module.exports = (req, res) => {
  res.setHeader('Content-Type',  'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.end(JSON.stringify(getCachedPeople()));
};
