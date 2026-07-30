// Standalone server for the BFCSP application-form PDF, so the form preview
// works WITHOUT deploying Cloud Functions (no Blaze needed). Reuses the exact
// shared generator (src/utils/bfcspForm.js → fillBfcspForm), so the output is
// identical to the official function. No Firebase/network — just reads the
// bundled template and renders the PDF.
//
// Local:
//   node local-form-server.js            (from backend/functions)
//   flutter run --dart-define=FORM_BASE_URL=http://127.0.0.1:8091
//
// Hosted (Render / Railway / Fly / any VPS):
//   npm start                            (platforms inject PORT; see below)
//   flutter build apk --release --dart-define=FORM_BASE_URL=https://your-host
//
// A release build with no FORM_BASE_URL falls back to the deployed Cloud
// Functions URL — which 404s on projects that never deployed them — so shipped
// builds MUST pass the flag.

const http = require('http');
const { fillBfcspForm } = require('./src/utils/bfcspForm');

// Hosting platforms assign the port via PORT and expect the process to bind to
// it; FORM_PORT stays supported for existing local workflows.
const PORT = process.env.PORT || process.env.FORM_PORT || 8091;

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

const server = http.createServer((req, res) => {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  // Health check. Hosting platforms probe `GET /` and will hold the service in
  // an unhealthy state — or fail the deploy outright — if it answers 404, so
  // this has to come before the catch-all below.
  if (req.method === 'GET' && (req.url === '/' || req.url.startsWith('/health'))) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', service: 'bfcsp-form-server' }));
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
      console.error('generateApplicationForm failed:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message || 'PDF generation failed' }));
    }
  });
});

// Host omitted on purpose: Node then binds all interfaces, which hosting
// platforms require (binding 127.0.0.1 would make the service unreachable).
server.listen(PORT, () => {
  console.log(`BFCSP form server listening on port ${PORT}`);
  console.log('  POST /generateApplicationForm  → filled application PDF');
  console.log('  GET  /                         → health check');
});
