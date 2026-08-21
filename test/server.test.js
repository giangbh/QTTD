'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');

test('server API: đăng nhập, đăng xuất, lưu vết user_id và kiểm tra CSRF', async t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qttd-server-test-'));
  const dbPath = path.join(dir, 'test.db');
  process.env.QTTD_DB_PATH = dbPath;

  // Khởi tạo store & server
  const { createStore } = require('../db');
  const store = createStore(dbPath);

  // Tạo mock http server tương tự server.js để kiểm thử
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionToken = cookies.qttd_session;
    const currentSession = store.getSession(sessionToken);

    if (url.pathname === '/api/auth/login' && req.method === 'POST') {
      const { username, password } = await readJson(req);
      const user = store.verifyUser(username, password);
      if (!user) return json(res, 401, { error: 'Sai mật khẩu' });
      const session = store.createSession(user.id);
      res.setHeader('Set-Cookie', `qttd_session=${session.token}; HttpOnly; SameSite=Lax; Path=/`);
      return json(res, 200, { ok: true, user, csrfToken: session.csrfToken });
    }

    if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
      if (sessionToken) store.deleteSession(sessionToken);
      res.setHeader('Set-Cookie', 'qttd_session=; Max-Age=0');
      return json(res, 200, { ok: true });
    }

    if (url.pathname === '/api/auth/me' && req.method === 'GET') {
      if (!currentSession) return json(res, 200, { user: null });
      return json(res, 200, { user: { id: currentSession.userId, username: currentSession.username, hoTen: currentSession.hoTen }, csrfToken: currentSession.csrfToken });
    }

    if (url.pathname === '/api/files' && req.method === 'POST') {
      if (currentSession && req.headers['x-csrf-token'] !== currentSession.csrfToken) {
        return json(res, 403, { error: 'CSRF Token không hợp lệ' });
      }
      const payload = await readJson(req);
      const userContext = currentSession ? { id: currentSession.userId, hoTen: currentSession.hoTen } : null;
      const saved = store.save(payload, null, userContext);
      return json(res, 201, saved);
    }

    if (url.pathname === '/api/files' && req.method === 'GET') {
      const q = url.searchParams.get('q') || '';
      const page = Number(url.searchParams.get('page') || 1);
      const limit = Number(url.searchParams.get('limit') || 20);
      return json(res, 200, store.list(q, { page, limit }));
    }

    if (url.pathname.startsWith('/api/files/') && req.method === 'GET') {
      const match = url.pathname.match(/^\/api\/files\/(\d+)(\/audit)?$/);
      if (match[2]) return json(res, 200, store.audit(Number(match[1])));
      return json(res, 200, store.get(Number(match[1])));
    }

    json(res, 404, { error: 'Not found' });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  t.after(() => {
    server.close();
    store.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  // 1. Đăng nhập sai
  const failLogin = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'canbo_qttd', password: 'wrong' })
  });
  assert.equal(failLogin.status, 401);

  // 2. Đăng nhập đúng
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'canbo_qttd', password: 'Canbo@123' })
  });
  assert.equal(loginRes.status, 200);
  const loginData = await loginRes.json();
  assert.equal(loginData.user.username, 'canbo_qttd');
  assert.ok(loginData.csrfToken);

  const cookie = loginRes.headers.get('set-cookie');
  assert.ok(cookie.includes('qttd_session='));

  // 3. Gọi /api/auth/me
  const meRes = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie }
  });
  const meData = await meRes.json();
  assert.equal(meData.user.username, 'canbo_qttd');

  // 4. Tạo hồ sơ không kèm CSRF token -> bị chặn 403
  const forbiddenRes = await fetch(`${baseUrl}/api/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(dummyPayload('HDTD-SRV-001'))
  });
  assert.equal(forbiddenRes.status, 403);

  // 5. Tạo hồ sơ kèm CSRF token hợp lệ -> thành công 201
  const saveRes = await fetch(`${baseUrl}/api/files`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookie,
      'X-CSRF-Token': loginData.csrfToken
    },
    body: JSON.stringify(dummyPayload('HDTD-SRV-001'))
  });
  assert.equal(saveRes.status, 201);
  const savedData = await saveRes.json();
  assert.equal(savedData.createdBy.name, 'Nguyễn Văn An');

  // 6. Kiểm tra audit log API
  const auditRes = await fetch(`${baseUrl}/api/files/${savedData.id}/audit`, {
    headers: { Cookie: cookie }
  });
  const auditData = await auditRes.json();
  assert.equal(auditData.length, 1);
  assert.equal(auditData[0].userName, 'Nguyễn Văn An');

  // 7. Kiểm tra GET /api/files có phân trang
  const listRes = await fetch(`${baseUrl}/api/files?page=1&limit=10`, {
    headers: { Cookie: cookie }
  });
  const listData = await listRes.json();
  assert.equal(listData.total, 1);
  assert.equal(listData.page, 1);
  assert.equal(listData.limit, 10);
  assert.equal(listData.items.length, 1);
  assert.equal(listData.items[0].customerName, 'Công ty ABC');

  // 8. Đăng xuất
  const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, {
    method: 'POST',
    headers: { Cookie: cookie }
  });
  assert.equal(logoutRes.status, 200);

  const meAfterLogout = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { Cookie: cookie }
  });
  const meAfterData = await meAfterLogout.json();
  assert.equal(meAfterData.user, null);
});

function dummyPayload(contract = 'HDTD-SRV-001') {
  return {
    version: 0,
    customer: { cif: '123456', name: 'Công ty ABC', type: 'DOANH_NGHIEP', branchCode: '147', branchName: 'Ba Tháng Hai' },
    file: { decisionNumber: 'QD-01', decisionDate: '2026-08-01', approvalLevel: 'GIAM_DOC_CAP_1', contractNumber: contract, contractDate: '2026-08-02', creditAmountVnd: 10000000000, displayUnit: 'TY', currency: 'VND', expiryDate: '2027-08-01', purpose: 'Bổ sung VLĐ', businessField: 'Thương mại', reportDate: '2026-08-21', status: 'NHAP' },
    capitalMembers: [], relatedPartners: [], conditions: [], debts: []
  };
}

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(';').forEach(cookie => {
    let [name, ...rest] = cookie.split('=');
    name = name?.trim();
    if (!name) return;
    list[name] = decodeURIComponent(rest.join('=').trim());
  });
  return list;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}
