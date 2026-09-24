// Minimaler statischer Server ohne Abhängigkeiten: node server.js  ->  http://localhost:5190
//
// Umgebungsvariablen:
//   PORT       Port (Standard 5190)
//   HOST       Bind-Adresse (Standard 0.0.0.0)
//   MUSIC_DIR  Ordner mit Songs (Standard ./music) – wird unter /music/… ausgeliefert
//
// Die Desktop-App (electron/main.js) startet denselben Server über start() auf einem freien Port.
const http = require('http');
const fs = require('fs');
const path = require('path');

const AUDIO_EXT = ['.mp3', '.ogg', '.wav', '.m4a', '.flac'];
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
};

function listSongs(music) {
  if (!fs.existsSync(music)) return [];
  return fs.readdirSync(music)
    .filter(f => AUDIO_EXT.includes(path.extname(f).toLowerCase()))
    .sort((a, b) => a.localeCompare(b, 'en'))
    .map(f => ({ name: path.parse(f).name, url: 'music/' + encodeURIComponent(f) }));
}

// Datei nur ausliefern, wenn sie wirklich unterhalb des erlaubten Ordners liegt
function resolveInside(base, rel) {
  const file = path.resolve(base, '.' + path.sep + rel);
  return file === base || file.startsWith(base + path.sep) ? file : null;
}

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type });
  res.end(body);
}

function createServer({ publicDir, musicDir }) {
  return http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method Not Allowed');
    let url;
    try { url = decodeURIComponent(req.url.split('?')[0]); } catch (e) { return send(res, 400, 'Bad Request'); }

    if (url === '/api/songs') return send(res, 200, JSON.stringify(listSongs(musicDir)), TYPES['.json']);
    if (url === '/healthz') return send(res, 200, 'ok');

    const file = url.startsWith('/music/')
      ? resolveInside(musicDir, url.slice('/music/'.length))
      : resolveInside(publicDir, url === '/' ? 'index.html' : url.slice(1));
    if (!file) return send(res, 403, 'Forbidden');

    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) return send(res, 404, 'Not Found');
      res.writeHead(200, {
        'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Content-Length': st.size,
        'Cache-Control': 'no-store',
      });
      if (req.method === 'HEAD') return res.end();
      fs.createReadStream(file).pipe(res);
    });
  });
}

// Startet den Server; port 0 heißt: irgendein freier Port. Liefert { server, port, musicDir }.
function start({ port = 5190, host = '0.0.0.0', publicDir, musicDir } = {}) {
  publicDir = path.resolve(publicDir || path.join(__dirname, 'public'));
  musicDir = path.resolve(musicDir || path.join(__dirname, 'music'));
  const server = createServer({ publicDir, musicDir });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port: server.address().port, musicDir, songs: listSongs(musicDir).length }));
  });
}

module.exports = { start };

if (require.main === module) {
  start({
    port: Number(process.env.PORT) || 5190,
    host: process.env.HOST || '0.0.0.0',
    musicDir: process.env.MUSIC_DIR,
  }).then(({ server, port, musicDir, songs }) => {
    console.log(`Spaceboss läuft auf http://localhost:${port} (Songs aus ${musicDir}, ${songs} gefunden)`);
    for (const sig of ['SIGTERM', 'SIGINT']) {
      process.on(sig, () => {
        server.close(() => process.exit(0));
        setTimeout(() => process.exit(0), 2000).unref();
      });
    }
  }).catch(e => { console.error(e.message); process.exit(1); });
}
