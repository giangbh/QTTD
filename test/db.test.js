'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStore } = require('../db');

function payload(contract = 'HDTD-001') {
  return {
    version: 0,
    customer: {
      cif: '68735',
      name: 'Khách hàng thử nghiệm',
      type: 'HO_KINH_DOANH',
      branchCode: '147',
      branchName: 'Ba Tháng Hai'
    },
    file: {
      decisionNumber: 'QD-001',
      decisionDate: '2026-08-01',
      approvalLevel: 'GIAM_DOC_CAP_1',
      contractNumber: contract,
      contractDate: '2026-08-02',
      creditAmountVnd: 73000000000,
      displayUnit: 'TY',
      currency: 'VND',
      expiryDate: '2027-08-01',
      purpose: 'Bổ sung vốn lưu động',
      businessField: 'Đại lý vé số',
      reportDate: '2026-08-21',
      status: 'NHAP'
    },
    capitalMembers: [{ name: 'Trần Ngọc Tâm', type: 'Cá nhân', contributedCapital: 1000000000, percentage: 100 }],
    relatedPartners: [{ name: 'Đối tác A', relationshipType: 'Thương mại', managementMeasure: 'Theo dõi dòng tiền' }],
    conditions: [{
      group: 'TSBD',
      type: 'BPBD',
      content: 'Duy trì tỷ lệ TSBĐ/HMTD tối thiểu 100%',
      frequency: 'QUY',
      nature: 'THEO_DOI',
      quantitativeIndicator: 'TSBD_HMTD',
      threshold: 100,
      periods: [{
        code: '2026-Q3',
        dueDate: '2026-09-30',
        performance: 'Đạt 106%',
        actualValue: 106,
        valueRecordedDate: '2026-08-20',
        recordedBy: 'CB QTTD',
        completedDate: '2026-08-20',
        status: 'DA_THUC_HIEN'
      }]
    }],
    debts: [{
      debtDate: '2026-08-01',
      content: 'Bổ sung bảo hiểm',
      documentType: 'Bảo hiểm',
      commitmentDate: '2026-08-31',
      supplementedDate: '',
      status: 'CHUA_DEN_HAN',
      levelType: 'THEO_DOI'
    }]
  };
}

test('lưu và đọc lại toàn bộ hồ sơ cùng dữ liệu liên quan', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qttd-test-'));
  const store = createStore(path.join(dir, 'test.db'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  const saved = store.save(payload());
  assert.match(saved.file.code, /^QTTD-147-2026-/);
  assert.equal(saved.customer.cif, '68735');
  assert.equal(saved.capitalMembers.length, 1);
  assert.equal(saved.relatedPartners.length, 1);
  assert.equal(saved.conditions[0].periods[0].actualValue, 106);
  assert.equal(saved.debts[0].content, 'Bổ sung bảo hiểm');
  assert.equal(store.list('68735').items.length, 1);
  assert.equal(store.list('68735').total, 1);
  assert.equal(store.audit(saved.id).length, 1);
  assert.deepEqual(store.config().TRANG_THAI_HO_SO.map(x => x.value), ['NHAP', 'HIEU_LUC', 'DONG']);
  assert.equal(store.config().CAP_PHE_DUYET.find(x => x.isDefault).value, 'GIAM_DOC_CAP_1');
});

test('chặn trùng số HĐTD và kiểm soát phiên bản', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qttd-test-'));
  const store = createStore(path.join(dir, 'test.db'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  const first = store.save(payload());
  const duplicate = payload(); duplicate.customer.cif = '99999';
  assert.throws(() => store.save(duplicate), /Số HĐTD đã tồn tại/);

  const stale = structuredClone(first); stale.version = 0; stale.file.purpose = 'Thay đổi';
  const updated = store.save(first, first.id);
  assert.equal(updated.version, 1);
  assert.throws(() => store.save(stale, first.id), /phiên khác/);
});

test('xác thực người dùng, lưu vết user_id và ghi nhật ký kiểm toán diff', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qttd-test-'));
  const store = createStore(path.join(dir, 'test.db'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  // 1. Kiểm tra tài khoản mẫu và xác thực
  const validUser = store.verifyUser('canbo_qttd', 'Canbo@123');
  assert.ok(validUser);
  assert.equal(validUser.username, 'canbo_qttd');
  assert.equal(validUser.hoTen, 'Nguyễn Văn An');

  const invalidUser = store.verifyUser('canbo_qttd', 'WrongPassword');
  assert.equal(invalidUser, null);

  // 2. Tạo phiên và đọc phiên
  const session = store.createSession(validUser.id);
  assert.ok(session.token);
  assert.ok(session.csrfToken);
  const fetchedSession = store.getSession(session.token);
  assert.equal(fetchedSession.userId, validUser.id);
  assert.equal(fetchedSession.username, 'canbo_qttd');

  // 3. Lưu hồ sơ với context người dùng
  const saved = store.save(payload('HDTD-AUTH-001'), null, validUser);
  assert.ok(saved.id);
  assert.equal(saved.createdBy.name, 'Nguyễn Văn An');
  assert.equal(saved.updatedBy.name, 'Nguyễn Văn An');

  // Kiểm tra danh sách hiển thị tên người cập nhật
  const list = store.list('HDTD-AUTH-001');
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].updatedByName, 'Nguyễn Văn An');

  // 4. Người dùng thứ 2 chỉnh sửa hồ sơ
  const adminUser = store.verifyUser('admin', 'Admin@123');
  const updatePayload = structuredClone(saved);
  updatePayload.file.purpose = 'Mục đích mới đã được sửa';
  updatePayload.file.creditAmountVnd = 80000000000;
  const updated = store.save(updatePayload, saved.id, adminUser);

  assert.equal(updated.createdBy.name, 'Nguyễn Văn An');
  assert.equal(updated.updatedBy.name, 'Quản trị viên hệ thống');

  // 5. Kiểm tra nhật ký kiểm toán (Audit log)
  const auditLogs = store.audit(saved.id);
  assert.equal(auditLogs.length, 2);

  // Log lần sửa cuối của admin
  const latestLog = auditLogs[0];
  assert.equal(latestLog.action, 'SUA');
  assert.equal(latestLog.userName, 'Quản trị viên hệ thống');
  assert.ok(latestLog.changes.some(c => c.field === 'Mục đích cấp tín dụng' && c.newVal === 'Mục đích mới đã được sửa'));
  assert.ok(latestLog.changes.some(c => c.field === 'Số tiền cấp tín dụng'));

  // Log tạo ban đầu của cán bộ
  const createLog = auditLogs[1];
  assert.equal(createLog.action, 'TAO');
  assert.equal(createLog.userName, 'Nguyễn Văn An');

  // 6. Xóa phiên
  store.deleteSession(session.token);
  assert.equal(store.getSession(session.token), null);
});

test('kiểm tra phân trang (pagination) và tìm kiếm nhiều bản ghi', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qttd-pagination-test-'));
  const store = createStore(path.join(dir, 'test.db'));
  t.after(() => { store.close(); fs.rmSync(dir, { recursive: true, force: true }); });

  // Tạo 25 hồ sơ mẫu
  for (let i = 1; i <= 25; i++) {
    const p = payload(`HDTD-PAGE-${String(i).padStart(3, '0')}`);
    p.customer.cif = String(80000 + i);
    p.customer.name = i % 2 === 0 ? `Doanh nghiệp Alpha ${i}` : `Hộ kinh doanh Beta ${i}`;
    store.save(p);
  }

  // 1. Phân trang mặc định trang 1 (limit 10)
  const page1 = store.list('', { page: 1, limit: 10 });
  assert.equal(page1.total, 25);
  assert.equal(page1.totalPages, 3);
  assert.equal(page1.items.length, 10);
  assert.equal(page1.page, 1);

  // 2. Trang 2 (limit 10)
  const page2 = store.list('', { page: 2, limit: 10 });
  assert.equal(page2.items.length, 10);
  assert.equal(page2.page, 2);

  // 3. Trang 3 (limit 10) -> chỉ còn 5 bản ghi cuối
  const page3 = store.list('', { page: 3, limit: 10 });
  assert.equal(page3.items.length, 5);
  assert.equal(page3.page, 3);

  // 4. Tìm kiếm từ khóa "Alpha" có phân trang
  const searchAlpha = store.list('Alpha', { page: 1, limit: 5 });
  assert.equal(searchAlpha.total, 12); // 12 bản ghi chẵn
  assert.equal(searchAlpha.totalPages, 3);
  assert.equal(searchAlpha.items.length, 5);
});

