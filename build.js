/**
 * build.js  –  Parse input.xml → public/data.json
 * Run locally or as Vercel build step.
 */

const fs   = require('fs');
const path = require('path');

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
  const xmlPath = path.join(__dirname, 'input.xml');
  const xml     = fs.readFileSync(xmlPath, 'utf-8');

  const people   = [];
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
  let rowMatch;
  let isHeader = true;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    if (isHeader) { isHeader = false; continue; }

    const rowHtml  = rowMatch[1];
    const cells    = [];
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

// ── Write output ─────────────────────────────────────────────────────────────
const outDir  = path.join(__dirname, 'public');
const outFile = path.join(outDir, 'data.json');

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const people = parseXML();
fs.writeFileSync(outFile, JSON.stringify(people), 'utf-8');

console.log(`✅  build.js: wrote ${people.length} records → public/data.json`);
