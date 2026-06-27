// Standalone local server for the BFCSP application-form PDF, so the form
// preview works WITHOUT deploying Cloud Functions (no Blaze needed). Reuses the
// exact shared generator (src/utils/bfcspForm.js → fillBfcspForm), so the output
// is identical to the official function. No Firebase/network — just reads the
// bundled template and renders the PDF.
//
// Run:  node local-form-server.js     (from backend/functions)
// Then run the scholar app with:  --dart-define=FORM_BASE_URL=http://127.0.0.1:8091

const http = require('http');
const { fillBfcspForm } = require('./src/utils/bfcspForm');

const PORT = process.env.FORM_PORT || 8091;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method !== 'POST' || !req.url.includes('generateApplicationForm')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 5_000_000) req.destroy(); // guard
  });
  req.on('end', async () => {
    try {
      const data = body ? JSON.parse(body) : {};
      const application = data.application || data;
      const bytes = await fillBfcspForm(application);
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      res.end(Buffer.from(bytes));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message || 'PDF generation failed' }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`BFCSP form server ready: http://127.0.0.1:${PORT}/generateApplicationForm`);
});
