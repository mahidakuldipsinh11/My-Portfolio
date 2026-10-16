// Zero-dependency Node.js server: serves the website + saves contact messages.
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---- tiny .env loader ----
try {
  fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/).forEach(l => {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !l.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2];
  });
} catch {}

const PORT = process.env.PORT || 5000;
const ADMIN_KEY = process.env.ADMIN_KEY || 'change-this-password';
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'messages.json');

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, '[]');
const readAll = () => { try { return JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); } catch { return []; } };
const writeAll = (l) => { const t = DB_FILE + '.tmp'; fs.writeFileSync(t, JSON.stringify(l, null, 2)); fs.renameSync(t, DB_FILE); };

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp',
  '.pdf': 'application/pdf', '.json': 'application/json' };

const send = (res, code, obj) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, x-admin-key', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS' });
  res.end(JSON.stringify(obj));
};
const body = (req) => new Promise((ok, no) => {
  let d = ''; req.on('data', c => { d += c; if (d.length > 20000) { no(new Error('big')); req.destroy(); } });
  req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { no(new Error('bad json')); } });
});

// rate limit: 5 messages / 10 min per IP
const hits = new Map();
const limited = (ip) => {
  const now = Date.now(), a = (hits.get(ip) || []).filter(t => now - t < 600000);
  if (a.length >= 5) return true; a.push(now); hits.set(ip, a); return false;
};
const clean = (v, n) => String(v || '').trim().slice(0, n);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const isAdmin = (req) => {
  const a = Buffer.from(req.headers['x-admin-key'] || ''), b = Buffer.from(ADMIN_KEY);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() || req.socket.remoteAddress;
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    if (req.method === 'POST' && url.pathname === '/api/contact') {
      if (limited(ip)) return send(res, 429, { error: 'Too many messages. Please try later.' });
      const b = await body(req);
      if (b.website) return send(res, 200, { ok: true }); // honeypot
      const name = clean(b.name, 100), email = clean(b.email, 150), message = clean(b.message, 3000);
      if (!name || !email || !message) return send(res, 400, { error: 'All fields are required.' });
      if (!EMAIL.test(email)) return send(res, 400, { error: 'Please enter a valid email.' });
      const list = readAll();
      list.push({ id: crypto.randomUUID(), name, email, message, ip, createdAt: new Date().toISOString() });
      writeAll(list);
      console.log(`New message from ${name} <${email}>`);
      return send(res, 201, { ok: true });
    }

    if (url.pathname === '/api/messages' && req.method === 'GET') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Unauthorized' });
      return send(res, 200, readAll().reverse());
    }
    if (url.pathname.startsWith('/api/messages/') && req.method === 'DELETE') {
      if (!isAdmin(req)) return send(res, 401, { error: 'Unauthorized' });
      const id = url.pathname.split('/').pop();
      writeAll(readAll().filter(m => m.id !== id));
      return send(res, 200, { ok: true });
    }

    // static files
    let file = url.pathname === '/admin' ? path.join(__dirname, 'admin.html')
      : path.join(PUBLIC, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(PUBLIC) && !file.endsWith('admin.html')) { res.writeHead(403); return res.end('Forbidden'); }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) { send(res, 400, { error: 'Bad request' }); }
}).listen(PORT, () => console.log(`Server running -> http://localhost:${PORT}   (messages: /admin)`));
