const http = require('http');
const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

const PORT = 3000;

// ─── XML helpers ────────────────────────────────────────────────────────────

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

  // Match every <Row> block
  const rowRegex = /<Row[^>]*>([\s\S]*?)<\/Row>/g;
  let rowMatch;
  let isHeader = true;

  while ((rowMatch = rowRegex.exec(xml)) !== null) {
    // Skip the first (header) row
    if (isHeader) { isHeader = false; continue; }

    const rowHtml = rowMatch[1];
    const cells   = [];

    // Extract each <Cell> value (handles empty <Data/> and missing Data)
    const cellRegex = /<Cell[^>]*>(?:<Data[^>]*>([\s\S]*?)<\/Data>)?<\/Cell>/g;
    let cellMatch;
    while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1] != null ? decodeEntities(cellMatch[1].trim()) : '');
    }

    const name       = (cells[0]  || '').trim();           // Column A – ПІБ
    const rawAddress = (cells[15] || cells[cells.length - 1] || '').trim(); // Column P

    if (!name || !rawAddress) continue;

    // Multiple address variants separated by 2+ spaces – take the first (most specific)
    const address = rawAddress.split(/\s{2,}/)[0].trim() || rawAddress;
    const surname = name.split(/\s+/)[0]; // First word = surname

    people.push({ name, surname, address });
  }

  return people;
}

// ─── Parse once at startup ───────────────────────────────────────────────────

const people = parseXML();
console.log(`✅  Parsed ${people.length} records from input.xml`);

// ─── HTTP server ─────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const reqPath = req.url.split('?')[0];

  if (reqPath === '/data') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(people));
    return;
  }

  // Serve index.html for everything else
  fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Помилка читання index.html: ' + err.message);
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const url = `http://localhost:${PORT}`;
  console.log(`\n🗺️  Карта доступна: ${url}\n`);
  // Auto-open browser on Windows
  exec(`start ${url}`);
});
