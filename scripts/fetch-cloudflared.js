// Downloads cloudflared.exe (Windows AMD64) into vendor/cloudflared/ if missing.
// Runs as npm prebuild so electron-builder finds the binary when packaging.
// cloudflared is Apache 2.0; redistribution is allowed.
const fs = require('fs');
const path = require('path');
const https = require('https');

const TARGET_DIR = path.join(__dirname, '..', 'vendor', 'cloudflared');
const TARGET_FILE = path.join(TARGET_DIR, 'cloudflared.exe');
const URL = 'https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe';

function follow(url, resolve, reject) {
  https.get(url, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      follow(res.headers.location, resolve, reject);
      return;
    }
    if (res.statusCode !== 200) {
      reject(new Error(`Download failed: HTTP ${res.statusCode}`));
      return;
    }
    fs.mkdirSync(TARGET_DIR, { recursive: true });
    const out = fs.createWriteStream(TARGET_FILE);
    res.pipe(out);
    out.on('finish', () => out.close(resolve));
    out.on('error', reject);
  }).on('error', reject);
}

if (fs.existsSync(TARGET_FILE)) {
  console.log(`[fetch-cloudflared] already present: ${TARGET_FILE}`);
  process.exit(0);
}

console.log(`[fetch-cloudflared] downloading from ${URL}`);
new Promise((resolve, reject) => follow(URL, resolve, reject))
  .then(() => {
    const size = (fs.statSync(TARGET_FILE).size / 1024 / 1024).toFixed(1);
    console.log(`[fetch-cloudflared] saved ${TARGET_FILE} (${size} MB)`);
  })
  .catch((err) => {
    console.error(`[fetch-cloudflared] failed: ${err.message}`);
    process.exit(1);
  });
