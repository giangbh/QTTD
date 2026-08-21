'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash, salt };
}

function verifyPassword(password, hash, salt) {
  try {
    const calculated = crypto.scryptSync(password, salt, 64).toString('hex');
    return crypto.timingSafeEqual(Buffer.from(calculated, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

function createStore(databasePath = path.join(__dirname, 'data', 'qttd.db')) {
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000;');
  db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
  migrateSchema(db);

  seedDefaultUsers();

  function migrateSchema(database) {
    function ensureColumn(table, column, definition) {
      try {
        const cols = database.prepare(`PRAGMA table_info(${table})`).all();
        if (!cols.some(c => c.name === column)) {
          database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
        }
      } catch {}
    }
    ensureColumn('khach_hang', 'nguoi_tao_id', 'INTEGER REFERENCES nguoi_dung(id)');
    ensureColumn('khach_hang', 'nguoi_sua_id', 'INTEGER REFERENCES nguoi_dung(id)');
    ensureColumn('ho_so_cap_td', 'nguoi_tao_id', 'INTEGER REFERENCES nguoi_dung(id)');
    ensureColumn('ho_so_cap_td', 'nguoi_sua_id', 'INTEGER REFERENCES nguoi_dung(id)');
    ensureColumn('nhat_ky_he_thong', 'id_nguoi_dung', 'INTEGER REFERENCES nguoi_dung(id)');
    ensureColumn('nhat_ky_he_thong', 'ho_ten_nguoi_dung', 'TEXT');
    ensureColumn('nhat_ky_he_thong', 'chi_tiet_thay_doi', 'TEXT');
  }

  function seedDefaultUsers() {
    const row = db.prepare('SELECT COUNT(*) AS total FROM nguoi_dung').get();
    if (row && row.total > 0) return;
    createUser('admin', 'Admin@123', 'Quản trị viên hệ thống', 'Trưởng phòng QTTD', '001');
    createUser('canbo_qttd', 'Canbo@123', 'Nguyễn Văn An', 'Chuyên viên QTTD', '147');
    createUser('cb_kiemsoat', 'Kiemsoat@123', 'Trần Thị Bình', 'Kiểm soát viên rủi ro', '190');
  }

  function createUser(username, password, hoTen, chucVu = '', maChiNhanh = '') {
    const { hash, salt } = hashPassword(password);
    const now = new Date().toISOString();
    const result = db.prepare(`
      INSERT INTO nguoi_dung(username, password_hash, salt, ho_ten, chuc_vu, ma_chi_nhanh, hieu_luc, ngay_tao)
      VALUES(?,?,?,?,?,?,1,?)
    `).run(username.trim().toLowerCase(), hash, salt, hoTen.trim(), chucVu.trim(), maChiNhanh.trim(), now);
    return {
      id: Number(result.lastInsertRowid),
      username: username.trim().toLowerCase(),
      hoTen: hoTen.trim(),
      chucVu: chucVu.trim(),
      maChiNhanh: maChiNhanh.trim()
    };
  }

  function verifyUser(username, password) {
    if (!username || !password) return null;
    const user = db.prepare('SELECT * FROM nguoi_dung WHERE username=? AND hieu_luc=1').get(username.trim().toLowerCase());
    if (!user) return null;
    if (!verifyPassword(password, user.password_hash, user.salt)) return null;
    return {
      id: user.id,
      username: user.username,
      hoTen: user.ho_ten,
      chucVu: user.chuc_vu || '',
      maChiNhanh: user.ma_chi_nhanh || ''
    };
  }

  function getUser(id) {
    const row = db.prepare('SELECT id, username, ho_ten AS hoTen, chuc_vu AS chucVu, ma_chi_nhanh AS maChiNhanh, hieu_luc AS active FROM nguoi_dung WHERE id=?').get(id);
    return row || null;
  }

  function listUsers() {
    return db.prepare('SELECT id, username, ho_ten AS hoTen, chuc_vu AS chucVu, ma_chi_nhanh AS maChiNhanh FROM nguoi_dung WHERE hieu_luc=1 ORDER BY id').all();
  }

  function createSession(userId, maxAgeMs = 7 * 24 * 60 * 60 * 1000) {
    const token = crypto.randomBytes(32).toString('hex');
    const csrfToken = crypto.randomBytes(24).toString('hex');
    const now = new Date();
    const expiresAt = new Date(now.getTime() + maxAgeMs).toISOString();
    db.prepare('INSERT INTO phien_dang_nhap(token, id_nguoi_dung, csrf_token, het_han, ngay_tao) VALUES(?,?,?,?,?)')
      .run(token, userId, csrfToken, expiresAt, now.toISOString());
    return { token, csrfToken, expiresAt };
  }

  function getSession(token) {
    if (!token) return null;
    const now = new Date().toISOString();
    const row = db.prepare(`
      SELECT s.token, s.csrf_token AS csrfToken, s.het_han AS expiresAt,
             u.id AS userId, u.username, u.ho_ten AS hoTen, u.chuc_vu AS chucVu, u.ma_chi_nhanh AS maChiNhanh
      FROM phien_dang_nhap s
      JOIN nguoi_dung u ON u.id = s.id_nguoi_dung
      WHERE s.token = ? AND s.het_han > ? AND u.hieu_luc = 1
    `).get(token, now);
    return row || null;
  }

  function deleteSession(token) {
    if (!token) return;
    db.prepare('DELETE FROM phien_dang_nhap WHERE token = ?').run(token);
  }

  function list(search = '', options = {}) {
    const query = `%${(search || '').trim()}%`;
    const page = Math.max(1, Number(options.page || 1));
    const limit = options.limit !== undefined ? Math.max(1, Math.min(100, Number(options.limit))) : 20;
    const offset = (page - 1) * limit;

    const countRow = db.prepare(`
      SELECT COUNT(*) AS total
      FROM ho_so_cap_td h
      JOIN khach_hang k ON k.id = h.id_khach_hang
      WHERE ? = '%%' OR h.ma_ho_so LIKE ? OR k.cif LIKE ? OR k.ten_khach_hang LIKE ? OR h.so_hdtd LIKE ?
    `).get(query, query, query, query, query);

    const total = countRow ? Number(countRow.total) : 0;
    const totalPages = Math.ceil(total / limit) || 1;

    const items = db.prepare(`
      SELECT h.id, h.ma_ho_so AS code, k.cif, k.ten_khach_hang AS customerName,
             k.ma_chi_nhanh AS branchCode, k.ten_chi_nhanh AS branchName,
             h.so_hdtd AS contractNumber, h.so_tien_vnd AS creditAmount,
             h.trang_thai_ho_so AS status, h.ngay_sua AS updatedAt,
             u.ho_ten AS updatedByName, u.username AS updatedByUsername,
             h.nguoi_sua_id AS updatedById
      FROM ho_so_cap_td h
      JOIN khach_hang k ON k.id = h.id_khach_hang
      LEFT JOIN nguoi_dung u ON u.id = h.nguoi_sua_id
      WHERE ? = '%%' OR h.ma_ho_so LIKE ? OR k.cif LIKE ? OR k.ten_khach_hang LIKE ? OR h.so_hdtd LIKE ?
      ORDER BY h.ngay_sua DESC, h.id DESC
      LIMIT ? OFFSET ?
    `).all(query, query, query, query, query, limit, offset);

    return { items, total, page, limit, totalPages };
  }

  function config() {
    const rows = db.prepare(`SELECT loai, ma, ten, mac_dinh
      FROM danh_muc WHERE hieu_luc=1 ORDER BY loai, thu_tu, id`).all();
    return rows.reduce((result, row) => {
      (result[row.loai] ||= []).push({ value:row.ma, label:row.ten, isDefault:!!row.mac_dinh });
      return result;
    }, {});
  }

  function get(id) {
    const row = db.prepare(`
      SELECT h.*, k.*,
        h.id AS file_id, k.id AS customer_id, h.ngay_tao AS file_created_at, h.ngay_sua AS file_updated_at,
        uc.ho_ten AS created_by_name, uc.username AS created_by_username,
        uu.ho_ten AS updated_by_name, uu.username AS updated_by_username
      FROM ho_so_cap_td h
      JOIN khach_hang k ON k.id = h.id_khach_hang
      LEFT JOIN nguoi_dung uc ON uc.id = h.nguoi_tao_id
      LEFT JOIN nguoi_dung uu ON uu.id = h.nguoi_sua_id
      WHERE h.id=?
    `).get(id);
    if (!row) return null;
    const conditions = db.prepare('SELECT * FROM dieu_kien WHERE id_ho_so=? ORDER BY nhom_dk, thu_tu, id').all(id).map(mapCondition);
    const periodStmt = db.prepare('SELECT * FROM ky_theo_doi_dk WHERE id_dieu_kien=? ORDER BY id');
    for (const condition of conditions) condition.periods = periodStmt.all(condition.id).map(mapPeriod);
    return {
      id: row.file_id,
      version: row.version,
      customer: mapCustomer(row),
      file: mapFile(row),
      createdBy: row.created_by_name ? { id: row.nguoi_tao_id, name: row.created_by_name, username: row.created_by_username } : null,
      updatedBy: row.updated_by_name ? { id: row.nguoi_sua_id, name: row.updated_by_name, username: row.updated_by_username } : null,
      capitalMembers: db.prepare('SELECT * FROM co_cau_von WHERE id_khach_hang=? ORDER BY thu_tu, id').all(row.customer_id).map(mapCapital),
      relatedPartners: db.prepare('SELECT * FROM doi_tac_lien_quan WHERE id_ho_so=? ORDER BY thu_tu, id').all(id).map(mapPartner),
      conditions,
      debts: db.prepare('SELECT * FROM dieu_kien_no WHERE id_ho_so=? ORDER BY stt, id').all(id).map(mapDebt)
    };
  }

  function save(payload, id = null, user = null) {
    const errors = validate(payload);
    if (errors.length) return { validationErrors: errors };
    const now = new Date().toISOString();
    const userId = user && user.id ? Number(user.id) : (payload.userId ? Number(payload.userId) : null);
    const userName = user ? (user.hoTen || user.username) : (payload.userName || null);

    db.exec('BEGIN IMMEDIATE');
    try {
      const oldValue = id ? get(id) : null;
      if (id && !oldValue) throw httpError(404, 'Không tìm thấy hồ sơ.');
      if (id && Number(payload.version) !== Number(oldValue.version)) throw httpError(409, 'Hồ sơ đã được thay đổi ở phiên khác. Hãy tải lại trước khi lưu.');

      const customerId = upsertCustomer(payload.customer, oldValue?.customer?.id, now, userId);
      let fileId = id;
      if (id) updateFile(id, customerId, payload.file, now, oldValue.version, userId);
      else fileId = insertFile(customerId, payload.file, now, userId);

      replaceChildren(fileId, customerId, payload);
      if (!id) {
        const year = (payload.file.reportDate || now).slice(0, 4);
        const code = `QTTD-${cleanCode(payload.customer.branchCode)}-${year}-${String(fileId).padStart(5, '0')}`;
        db.prepare('UPDATE ho_so_cap_td SET ma_ho_so=? WHERE id=?').run(code, fileId);
      }
      const saved = get(fileId);

      const diffList = computeDiff(oldValue, saved);
      db.prepare(`
        INSERT INTO nhat_ky_he_thong(thoi_diem, hanh_dong, bang, id_ban_ghi, id_nguoi_dung, ho_ten_nguoi_dung, gia_tri_cu, gia_tri_moi, chi_tiet_thay_doi)
        VALUES(?,?,?,?,?,?,?,?,?)
      `).run(
        now,
        id ? 'SUA' : 'TAO',
        'ho_so_cap_td',
        fileId,
        userId,
        userName,
        oldValue ? JSON.stringify(oldValue) : null,
        JSON.stringify(saved),
        JSON.stringify(diffList)
      );

      db.exec('COMMIT');
      return saved;
    } catch (error) {
      db.exec('ROLLBACK');
      if (String(error.message).includes('UNIQUE constraint failed: khach_hang.cif')) throw httpError(409, 'CIF đã tồn tại ở khách hàng khác.');
      if (String(error.message).includes('UNIQUE constraint failed: ho_so_cap_td.so_hdtd')) throw httpError(409, 'Số HĐTD đã tồn tại.');
      throw error;
    }
  }

  function upsertCustomer(c, existingId, now, userId) {
    const values = [c.cif.trim(), c.name.trim(), c.type, nullable(c.businessRegistration), nullable(c.businessRegistrationDate),
      nullable(c.taxCode), nullable(c.rating), nullable(c.ratingDate), nullable(c.legalRepresentative), nullable(c.authorizedPerson),
      nullable(c.chiefAccountant), nullable(c.notes), c.branchCode.trim(), c.branchName.trim(), userId, now];
    if (existingId) {
      db.prepare(`UPDATE khach_hang SET cif=?,ten_khach_hang=?,loai_hinh_kh=?,so_gcn_dkkd=?,ngay_cap_dkkd=?,ma_so_thue=?,
        xhtd_hang=?,xhtd_ky=?,nguoi_dai_dien_pl=?,nguoi_duoc_uy_quyen=?,ke_toan_truong=?,luu_y_khac=?,ma_chi_nhanh=?,ten_chi_nhanh=?,nguoi_sua_id=?,ngay_sua=? WHERE id=?`).run(...values, existingId);
      return existingId;
    }
    const found = db.prepare('SELECT id FROM khach_hang WHERE cif=?').get(c.cif.trim());
    if (found) {
      db.prepare(`UPDATE khach_hang SET ten_khach_hang=?,loai_hinh_kh=?,so_gcn_dkkd=?,ngay_cap_dkkd=?,ma_so_thue=?,xhtd_hang=?,xhtd_ky=?,
        nguoi_dai_dien_pl=?,nguoi_duoc_uy_quyen=?,ke_toan_truong=?,luu_y_khac=?,ma_chi_nhanh=?,ten_chi_nhanh=?,nguoi_sua_id=?,ngay_sua=? WHERE id=?`)
        .run(...values.slice(1), found.id);
      return found.id;
    }
    return Number(db.prepare(`INSERT INTO khach_hang(cif,ten_khach_hang,loai_hinh_kh,so_gcn_dkkd,ngay_cap_dkkd,ma_so_thue,xhtd_hang,xhtd_ky,
      nguoi_dai_dien_pl,nguoi_duoc_uy_quyen,ke_toan_truong,luu_y_khac,ma_chi_nhanh,ten_chi_nhanh,nguoi_tao_id,nguoi_sua_id,ngay_tao,ngay_sua)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...values.slice(0, 14), userId, userId, now, now).lastInsertRowid);
  }

  function insertFile(customerId, f, now, userId) {
    return Number(db.prepare(`INSERT INTO ho_so_cap_td(id_khach_hang,so_qd_cap_td,ngay_qd_cap_td,cap_phe_duyet,so_hdtd,ngay_hdtd,so_tien_vnd,
      don_vi_hien_thi,dong_tien,ngay_het_han,muc_dich,linh_vuc_kd,nhu_cau_vld,thong_tin_bo_sung,quan_he_tctd,co_nkhlq,
      co_doi_tac_luu_y,khlq_ghi_chu,trang_thai_ho_so,ngay_lap,so_van_ban,nguoi_tao_id,nguoi_sua_id,ngay_tao,ngay_sua)
      VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(...fileValues(customerId, f), userId, userId, now, now).lastInsertRowid);
  }

  function updateFile(id, customerId, f, now, version, userId) {
    db.prepare(`UPDATE ho_so_cap_td SET id_khach_hang=?,so_qd_cap_td=?,ngay_qd_cap_td=?,cap_phe_duyet=?,so_hdtd=?,ngay_hdtd=?,so_tien_vnd=?,
      don_vi_hien_thi=?,dong_tien=?,ngay_het_han=?,muc_dich=?,linh_vuc_kd=?,nhu_cau_vld=?,thong_tin_bo_sung=?,quan_he_tctd=?,co_nkhlq=?,
      co_doi_tac_luu_y=?,khlq_ghi_chu=?,trang_thai_ho_so=?,ngay_lap=?,so_van_ban=?,version=version+1,nguoi_sua_id=?,ngay_sua=? WHERE id=? AND version=?`)
      .run(...fileValues(customerId, f), userId, now, id, version);
  }

  function replaceChildren(fileId, customerId, payload) {
    db.prepare('DELETE FROM co_cau_von WHERE id_khach_hang=?').run(customerId);
    const capital = db.prepare('INSERT INTO co_cau_von(id_khach_hang,ten_thanh_vien,loai_thanh_vien,gia_tri_von_gop,ty_le_pct,thu_tu) VALUES(?,?,?,?,?,?)');
    payload.capitalMembers.forEach((x, i) => capital.run(customerId, x.name.trim(), nullable(x.type), num(x.contributedCapital), num(x.percentage), i + 1));

    db.prepare('DELETE FROM doi_tac_lien_quan WHERE id_ho_so=?').run(fileId);
    const partner = db.prepare('INSERT INTO doi_tac_lien_quan(id_ho_so,ten_doi_tac,cif_doi_tac,ma_so_thue,loai_quan_he,bien_phap_quan_ly,thu_tu) VALUES(?,?,?,?,?,?,?)');
    payload.relatedPartners.forEach((x, i) => partner.run(fileId, x.name.trim(), nullable(x.cif), nullable(x.taxCode), nullable(x.relationshipType), nullable(x.managementMeasure), i + 1));

    db.prepare('DELETE FROM dieu_kien WHERE id_ho_so=?').run(fileId);
    const conditionStmt = db.prepare(`INSERT INTO dieu_kien(id_ho_so,nhom_dk,loai_dk,thu_tu,noi_dung_dk,tan_suat,tinh_chat_dk,chi_tieu_dinh_luong,
      nguong_yeu_cau,ngay_bat_dau_theo_doi,ngay_ket_thuc_theo_doi) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    const periodStmt = db.prepare(`INSERT INTO ky_theo_doi_dk(id_dieu_kien,ky_theo_doi,ngay_den_han,tinh_hinh_thuc_hien,gia_tri_thuc_te,
      ngay_ghi_nhan_gia_tri,nguoi_ghi_nhan,ngay_thuc_hien,tinh_trang,muc_dk_ghi_de,ly_do_ghi_de) VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
    payload.conditions.forEach((x, i) => {
      const conditionId = Number(conditionStmt.run(fileId, x.group, x.type, i + 1, x.content.trim(), x.frequency, x.nature,
        nullable(x.quantitativeIndicator), numOrNull(x.threshold), nullable(x.monitoringStartDate), nullable(x.monitoringEndDate)).lastInsertRowid);
      x.periods.forEach(p => periodStmt.run(conditionId, p.code.trim(), nullable(p.dueDate), nullable(p.performance), numOrNull(p.actualValue),
        nullable(p.valueRecordedDate), nullable(p.recordedBy), nullable(p.completedDate), p.status, nullable(p.overrideLevel), nullable(p.overrideReason)));
    });

    db.prepare('DELETE FROM dieu_kien_no WHERE id_ho_so=?').run(fileId);
    const debt = db.prepare(`INSERT INTO dieu_kien_no(id_ho_so,stt,ngay_no,noi_dung,loai_ho_so_no,ngay_cam_ket_bs,ngay_bo_sung_hs,tinh_trang,muc_dieu_kien)
      VALUES(?,?,?,?,?,?,?,?,?)`);
    payload.debts.forEach((x, i) => debt.run(fileId, i + 1, x.debtDate, x.content.trim(), nullable(x.documentType), x.commitmentDate,
      nullable(x.supplementedDate), x.status, x.levelType));
  }

  function audit(fileId) {
    const rows = db.prepare(`
      SELECT n.*, u.username, u.ho_ten AS hoTen
      FROM nhat_ky_he_thong n
      LEFT JOIN nguoi_dung u ON u.id = n.id_nguoi_dung
      WHERE n.bang=? AND n.id_ban_ghi=?
      ORDER BY n.id DESC
    `).all('ho_so_cap_td', fileId);

    return rows.map(x => {
      let changes = [];
      try {
        if (x.chi_tiet_thay_doi) changes = JSON.parse(x.chi_tiet_thay_doi);
      } catch {
        changes = [];
      }
      return {
        id: x.id,
        at: x.thoi_diem,
        action: x.hanh_dong,
        userId: x.id_nguoi_dung,
        userName: x.ho_ten_nguoi_dung || x.hoTen || (x.username ? `@${x.username}` : 'Hệ thống'),
        changes
      };
    });
  }

  function close() { db.close(); }

  return {
    list,
    config,
    get,
    save,
    audit,
    close,
    db,
    createUser,
    verifyUser,
    getUser,
    listUsers,
    createSession,
    getSession,
    deleteSession
  };
}

function computeDiff(oldVal, newVal) {
  if (!oldVal) {
    return [{ field: 'Khởi tạo hồ sơ', oldVal: '', newVal: `Tạo mới hồ sơ ${newVal?.file?.code || ''}` }];
  }
  const diffs = [];
  const fieldMap = {
    'customer.name': 'Tên khách hàng',
    'customer.cif': 'Mã CIF',
    'customer.type': 'Loại hình khách hàng',
    'customer.branchName': 'Tên chi nhánh',
    'file.decisionNumber': 'Số quyết định cấp TD',
    'file.approvalLevel': 'Cấp phê duyệt',
    'file.contractNumber': 'Số HĐTD',
    'file.creditAmountVnd': 'Số tiền cấp tín dụng',
    'file.status': 'Trạng thái hồ sơ',
    'file.expiryDate': 'Ngày hết hạn',
    'file.purpose': 'Mục đích cấp tín dụng'
  };

  for (const [key, label] of Object.entries(fieldMap)) {
    const [part, prop] = key.split('.');
    const v1 = oldVal[part]?.[prop];
    const v2 = newVal[part]?.[prop];
    if (String(v1 ?? '') !== String(v2 ?? '')) {
      diffs.push({ field: label, oldVal: String(v1 ?? '—'), newVal: String(v2 ?? '—') });
    }
  }

  if (oldVal.conditions?.length !== newVal.conditions?.length) {
    diffs.push({
      field: 'Điều kiện tín dụng/TSBĐ',
      oldVal: `${oldVal.conditions?.length || 0} điều kiện`,
      newVal: `${newVal.conditions?.length || 0} điều kiện`
    });
  }

  if (oldVal.debts?.length !== newVal.debts?.length) {
    diffs.push({
      field: 'Hồ sơ điều kiện nợ',
      oldVal: `${oldVal.debts?.length || 0} mục nợ`,
      newVal: `${newVal.debts?.length || 0} mục nợ`
    });
  }

  if (diffs.length === 0) {
    diffs.push({ field: 'Cập nhật chung', oldVal: 'Phiên bản cũ', newVal: `Phiên bản v${newVal.version}` });
  }

  return diffs;
}

function fileValues(customerId, f) {
  return [customerId, f.decisionNumber.trim(), f.decisionDate, f.approvalLevel, f.contractNumber.trim(), f.contractDate,
    num(f.creditAmountVnd), f.displayUnit || 'TRIEU', nullable(f.currency), f.expiryDate, f.purpose.trim(), f.businessField.trim(),
    numOrNull(f.workingCapitalNeed), nullable(f.additionalInfo), nullable(f.otherCreditInstitutions), bool(f.hasRelatedCustomerGroup),
    bool(f.hasManagedPartners), nullable(f.relatedGroupNotes), f.status || 'NHAP', f.reportDate, nullable(f.documentNumber)];
}

function validate(p) {
  const errors = [];
  if (!p || typeof p !== 'object') return ['Dữ liệu hồ sơ không hợp lệ.'];
  const c = p.customer || {}, f = p.file || {};
  const required = [[c.cif,'CIF'],[c.name,'Tên khách hàng'],[c.type,'Loại hình khách hàng'],[c.branchCode,'Mã chi nhánh'],[c.branchName,'Tên chi nhánh'],
    [f.decisionNumber,'Số quyết định'],[f.decisionDate,'Ngày quyết định'],[f.approvalLevel,'Cấp phê duyệt'],[f.contractNumber,'Số HĐTD'],
    [f.contractDate,'Ngày HĐTD'],[f.expiryDate,'Ngày hết hạn'],[f.purpose,'Mục đích cấp tín dụng'],[f.businessField,'Lĩnh vực kinh doanh'],[f.reportDate,'Ngày lập']];
  required.forEach(([value, label]) => { if (!String(value || '').trim()) errors.push(`${label} là bắt buộc.`); });
  if (!/^\d{3,20}$/.test(String(c.cif || '').trim())) errors.push('CIF phải gồm 3–20 chữ số.');
  if (!(Number(f.creditAmountVnd) > 0)) errors.push('Số tiền cấp tín dụng phải lớn hơn 0.');
  if (!Array.isArray(p.capitalMembers) || !Array.isArray(p.relatedPartners) || !Array.isArray(p.conditions) || !Array.isArray(p.debts)) errors.push('Danh sách dữ liệu liên quan không hợp lệ.');
  (p.capitalMembers || []).forEach((x,i) => { if (!String(x.name||'').trim()) errors.push(`Cơ cấu vốn dòng ${i+1}: thiếu tên thành viên.`); });
  (p.relatedPartners || []).forEach((x,i) => { if (!String(x.name||'').trim()) errors.push(`Đối tác dòng ${i+1}: thiếu tên đối tác.`); });
  (p.conditions || []).forEach((x,i) => {
    if (!String(x.content||'').trim()) errors.push(`Điều kiện dòng ${i+1}: thiếu nội dung.`);
    if (!['TSBD','DKTD'].includes(x.group)) errors.push(`Điều kiện dòng ${i+1}: nhóm không hợp lệ.`);
    (x.periods || []).forEach((p,j) => { if (!String(p.code||'').trim()) errors.push(`Điều kiện ${i+1}, kỳ ${j+1}: thiếu mã kỳ.`); });
  });
  (p.debts || []).forEach((x,i) => { if (!x.debtDate || !String(x.content||'').trim() || !x.commitmentDate) errors.push(`Điều kiện nợ dòng ${i+1}: thiếu ngày nợ, nội dung hoặc ngày cam kết.`); });
  return errors;
}

function mapCustomer(r) { return { id:r.customer_id,cif:r.cif,name:r.ten_khach_hang,type:r.loai_hinh_kh,businessRegistration:r.so_gcn_dkkd||'',businessRegistrationDate:r.ngay_cap_dkkd||'',taxCode:r.ma_so_thue||'',rating:r.xhtd_hang||'',ratingDate:r.xhtd_ky||'',legalRepresentative:r.nguoi_dai_dien_pl||'',authorizedPerson:r.nguoi_duoc_uy_quyen||'',chiefAccountant:r.ke_toan_truong||'',notes:r.luu_y_khac||'',branchCode:r.ma_chi_nhanh,branchName:r.ten_chi_nhanh,source:'MANUAL' }; }
function mapFile(r) { return { code:r.ma_ho_so,decisionNumber:r.so_qd_cap_td,decisionDate:r.ngay_qd_cap_td,approvalLevel:r.cap_phe_duyet,contractNumber:r.so_hdtd,contractDate:r.ngay_hdtd,creditAmountVnd:Number(r.so_tien_vnd),displayUnit:r.don_vi_hien_thi,currency:r.dong_tien||'',expiryDate:r.ngay_het_han,purpose:r.muc_dich,businessField:r.linh_vuc_kd,workingCapitalNeed:r.nhu_cau_vld==null?'':Number(r.nhu_cau_vld),additionalInfo:r.thong_tin_bo_sung||'',otherCreditInstitutions:r.quan_he_tctd||'',hasRelatedCustomerGroup:!!r.co_nkhlq,hasManagedPartners:!!r.co_doi_tac_luu_y,relatedGroupNotes:r.khlq_ghi_chu||'',status:r.trang_thai_ho_so,reportDate:r.ngay_lap,documentNumber:r.so_van_ban||'',source:'MANUAL',createdAt:r.file_created_at,updatedAt:r.file_updated_at}; }
function mapCapital(r){return{id:r.id,name:r.ten_thanh_vien,type:r.loai_thanh_vien||'',contributedCapital:Number(r.gia_tri_von_gop),percentage:Number(r.ty_le_pct),source:'MANUAL'};}
function mapPartner(r){return{id:r.id,name:r.ten_doi_tac,cif:r.cif_doi_tac||'',taxCode:r.ma_so_thue||'',relationshipType:r.loai_quan_he||'',managementMeasure:r.bien_phap_quan_ly||'',source:'MANUAL'};}
function mapCondition(r){return{id:r.id,group:r.nhom_dk,type:r.loai_dk,content:r.noi_dung_dk,frequency:r.tan_suat,nature:r.tinh_chat_dk,quantitativeIndicator:r.chi_tieu_dinh_luong||'',threshold:r.nguong_yeu_cau==null?'':Number(r.nguong_yeu_cau),monitoringStartDate:r.ngay_bat_dau_theo_doi||'',monitoringEndDate:r.ngay_ket_thuc_theo_doi||'',source:'MANUAL'};}
function mapPeriod(r){return{id:r.id,code:r.ky_theo_doi,dueDate:r.ngay_den_han||'',performance:r.tinh_hinh_thuc_hien||'',actualValue:r.gia_tri_thuc_te==null?'':Number(r.gia_tri_thuc_te),valueRecordedDate:r.ngay_ghi_nhan_gia_tri||'',recordedBy:r.nguoi_ghi_nhan||'',completedDate:r.ngay_thuc_hien||'',status:r.tinh_trang,overrideLevel:r.muc_dk_ghi_de||'',overrideReason:r.ly_do_ghi_de||'',source:'MANUAL'};}
function mapDebt(r){return{id:r.id,debtDate:r.ngay_no,content:r.noi_dung,documentType:r.loai_ho_so_no||'',commitmentDate:r.ngay_cam_ket_bs,supplementedDate:r.ngay_bo_sung_hs||'',status:r.tinh_trang,levelType:r.muc_dieu_kien,source:'MANUAL'};}
function nullable(v){return v === undefined || v === null || String(v).trim()==='' ? null : String(v).trim();}
function num(v){return Number(v)||0;}
function numOrNull(v){return v === '' || v === null || v === undefined ? null : Number(v);}
function bool(v){return v ? 1 : 0;}
function cleanCode(v){return String(v||'CN').replace(/[^A-Za-z0-9]/g,'').slice(0,10)||'CN';}
function httpError(status,message){const e=new Error(message);e.status=status;return e;}

module.exports = { createStore, validate, hashPassword, verifyPassword };
