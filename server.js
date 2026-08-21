'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { createStore } = require('./db');

const PORT = Number(process.env.PORT || 8080);
const DATA_PATH = process.env.QTTD_DB_PATH || path.join(__dirname, 'data', 'qttd.db');
const store = createStore(DATA_PATH);
const PUBLIC = path.join(__dirname, 'public');

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionToken = cookies.qttd_session || (req.headers.authorization ? req.headers.authorization.replace(/^Bearer\s+/i, '') : null);
    const currentSession = store.getSession(sessionToken);

    // Health check
    if (url.pathname === '/api/health' && req.method === 'GET') {
      return json(res, 200, { ok: true, database: DATA_PATH });
    }

    // Auth endpoints
    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await readJson(req);
      const user = store.verifyUser(username, password);
      if (!user) {
        return json(res, 401, { error: 'Tên đăng nhập hoặc mật khẩu không chính xác.' });
      }
      const session = store.createSession(user.id);
      res.setHeader('Set-Cookie', `qttd_session=${session.token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800`);
      return json(res, 200, {
        ok: true,
        user,
        csrfToken: session.csrfToken
      });
    }

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      if (sessionToken) store.deleteSession(sessionToken);
      res.setHeader('Set-Cookie', 'qttd_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      if (!currentSession) {
        return json(res, 200, { user: null });
      }
      return json(res, 200, {
        user: {
          id: currentSession.userId,
          username: currentSession.username,
          hoTen: currentSession.hoTen,
          chucVu: currentSession.chucVu,
          maChiNhanh: currentSession.maChiNhanh
        },
        csrfToken: currentSession.csrfToken
      });
    }

    if (url.pathname === '/api/auth/users' && req.method === 'GET') {
      return json(res, 200, store.listUsers());
    }

    // Configuration & Data
    if (url.pathname === '/api/config' && req.method === 'GET') {
      return json(res, 200, store.config());
    }

    if (url.pathname === '/api/files' && req.method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const page = url.searchParams.get('page') ? Number(url.searchParams.get('page')) : 1;
      const limit = url.searchParams.get('limit') ? Number(url.searchParams.get('limit')) : 20;
      return json(res, 200, store.list(q, { page, limit }));
    }

    if (url.pathname === '/api/files' && req.method === 'POST') {
      verifyCsrf(req, currentSession);
      return saveRecord(req, res, null, currentSession);
    }

    const match = url.pathname.match(/^\/api\/files\/(\d+)(\/audit)?$/);
    if (match && req.method === 'GET') {
      if (match[2]) return json(res, 200, store.audit(Number(match[1])));
      const record = store.get(Number(match[1]));
      return record ? json(res, 200, record) : json(res, 404, { error: 'Không tìm thấy hồ sơ.' });
    }

    if (match && !match[2] && req.method === 'PUT') {
      verifyCsrf(req, currentSession);
      return saveRecord(req, res, Number(match[1]), currentSession);
    }

    if (url.pathname.startsWith('/api/')) {
      return json(res, 404, { error: 'API không tồn tại.' });
    }

    return staticFile(url.pathname, res);
  } catch (error) {
    console.error(error);
    return json(res, error.status || 500, { error: error.message || 'Lỗi hệ thống.' });
  }
});

function verifyCsrf(req, session) {
  if (!session) return; // Cho phép fallback nếu chưa bật session bắt buộc
  const clientCsrf = req.headers['x-csrf-token'];
  if (!clientCsrf || clientCsrf !== session.csrfToken) {
    throw Object.assign(new Error('CSRF Token không hợp lệ hoặc đã hết hạn.'), { status: 403 });
  }
}

async function saveRecord(req, res, id, currentSession) {
  const payload = await readJson(req);
  const userContext = currentSession ? {
    id: currentSession.userId,
    hoTen: currentSession.hoTen,
    username: currentSession.username
  } : null;

  const result = store.save(payload, id, userContext);
  if (result.validationErrors) {
    return json(res, 422, { error: 'Dữ liệu chưa hợp lệ.', details: result.validationErrors });
  }
  return json(res, id ? 200 : 201, result);
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    const value = rest.join('=').trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5_000_000) reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn.'), { status: 413 }));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(Object.assign(new Error('JSON không hợp lệ.'), { status: 400 })); }
    });
    req.on('error', reject);
  });
}

function staticFile(urlPath, res) {
  const requested = urlPath === '/' ? 'index.html' : decodeURIComponent(urlPath.slice(1));
  const filePath = path.resolve(PUBLIC, requested);
  if (!filePath.startsWith(`${PUBLIC}${path.sep}`) && filePath !== path.join(PUBLIC, 'index.html')) {
    return json(res, 403, { error: 'Từ chối truy cập.' });
  }
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return json(res, 404, { error: 'Không tìm thấy tệp.' });
  }
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8'
  };
  res.writeHead(200, {
    'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  fs.createReadStream(filePath).pipe(res);
}

function json(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'SAMEORIGIN'
  });
  res.end(JSON.stringify(body));
}

server.listen(PORT, '127.0.0.1', () => {
  console.log(`QTTD MVP đang chạy tại http://127.0.0.1:${PORT}`);
  console.log(`SQLite: ${DATA_PATH}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = { server, store };
