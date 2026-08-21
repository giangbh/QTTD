'use strict';

const $ = s => document.querySelector(s);
const today = new Date().toISOString().slice(0, 10);
let config = {};
let state;
let currentUser = null;
let csrfToken = '';
let paginationState = {
  page: 1,
  limit: 20,
  total: 0,
  totalPages: 1,
  search: ''
};

document.addEventListener('DOMContentLoaded', async () => {
  setupEventListeners();

  // Kiểm tra phiên đăng nhập hiện tại
  await checkAuth();

  // Tải danh mục cấu hình
  try {
    config = await api('/api/config');
  } catch (error) {
    return toast(`Không tải được danh mục cấu hình.\n${error.message}`, true);
  }

  state = blankRecord();
  $('#evaluationDate').value = today;
  loadList();
});

function setupEventListeners() {
  $('#homeBtn').onclick = showList;
  $('#newBtn').onclick = openNew;
  $('[data-new]').onclick = openNew;

  // Search events
  $('#searchBtn').onclick = () => {
    paginationState.search = $('#searchInput').value.trim();
    paginationState.page = 1;
    loadList();
  };
  $('#searchInput').onkeydown = e => {
    if (e.key === 'Enter') {
      paginationState.search = $('#searchInput').value.trim();
      paginationState.page = 1;
      loadList();
    }
  };
  const clearBtn = $('#clearSearchBtn');
  if (clearBtn) {
    clearBtn.onclick = () => {
      $('#searchInput').value = '';
      paginationState.search = '';
      paginationState.page = 1;
      loadList();
    };
  }
  const pageSizeSelect = $('#pageSizeSelect');
  if (pageSizeSelect) {
    pageSizeSelect.onchange = () => {
      paginationState.limit = Number(pageSizeSelect.value) || 20;
      paginationState.page = 1;
      loadList();
    };
  }

  $('#saveBtn').onclick = saveRecord;
  $('#printBtn').onclick = () => window.print();
  $('#evaluationDate').onchange = renderScores;
  $('#n1').onchange = renderScores;
  $('#n2').onchange = renderScores;

  $('#recordForm').addEventListener('input', handleInput);
  $('#recordForm').addEventListener('change', handleInput);
  $('#recordForm').addEventListener('click', handleAction);

  // Auth events
  $('#logoutBtn').onclick = handleLogout;
  $('#loginBtn').onclick = showLoginModal;
  $('#loginForm').onsubmit = handleLoginSubmit;
  $('#viewAuditBtn').onclick = () => {
    const auditEl = $('#auditSection');
    auditEl.classList.remove('hidden');
    auditEl.scrollIntoView({ behavior: 'smooth' });
  };

  // Quick login chips
  document.querySelectorAll('.quick-user-chip').forEach(btn => {
    btn.onclick = () => {
      $('#loginUsername').value = btn.dataset.user;
      $('#loginPassword').value = btn.dataset.pass;
      $('#loginForm').requestSubmit();
    };
  });
}

// ----------------- AUTHENTICATION -----------------

async function checkAuth() {
  try {
    const res = await api('/api/auth/me');
    if (res && res.user) {
      currentUser = res.user;
      csrfToken = res.csrfToken || '';
      updateUserUI(currentUser);
      hideLoginModal();
    } else {
      currentUser = null;
      csrfToken = '';
      updateUserUI(null);
      showLoginModal();
    }
  } catch {
    currentUser = null;
    updateUserUI(null);
    showLoginModal();
  }
}

function updateUserUI(user) {
  if (user) {
    $('#userProfile').classList.remove('hidden');
    $('#loginBtn').classList.add('hidden');
    $('#userName').textContent = user.hoTen || user.username;
    $('#userTitle').textContent = `${user.chucVu || 'Cán bộ'} · CN ${user.maChiNhanh || 'Hội sở'}`;
    const initials = (user.hoTen || user.username).split(' ').map(w => w[0]).filter(Boolean).slice(-2).join('').toUpperCase();
    $('#userAvatar').textContent = initials || 'CB';
  } else {
    $('#userProfile').classList.add('hidden');
    $('#loginBtn').classList.remove('hidden');
  }
}

function showLoginModal() {
  $('#loginError').classList.add('hidden');
  $('#loginModal').classList.remove('hidden');
}

function hideLoginModal() {
  $('#loginModal').classList.add('hidden');
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = $('#loginUsername').value.trim();
  const password = $('#loginPassword').value;
  $('#loginSubmitBtn').disabled = true;
  $('#loginError').classList.add('hidden');

  try {
    const res = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    currentUser = res.user;
    csrfToken = res.csrfToken || '';
    updateUserUI(currentUser);
    hideLoginModal();
    toast(`Xin chào, ${currentUser.hoTen}! Đăng nhập thành công.`);
    loadList();
  } catch (error) {
    $('#loginError').textContent = error.message || 'Đăng nhập không thành công.';
    $('#loginError').classList.remove('hidden');
  } finally {
    $('#loginSubmitBtn').disabled = false;
  }
}

async function handleLogout() {
  try {
    await api('/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
  } catch {}
  currentUser = null;
  csrfToken = '';
  updateUserUI(null);
  toast('Đã đăng xuất khỏi hệ thống.');
  showLoginModal();
}

// ----------------- RECORD DATA & FLOW -----------------

function blankRecord() {
  return {
    id: null,
    version: 0,
    customer: {
      cif: '',
      name: '',
      type: defaultValue('LOAI_HINH_KH'),
      businessRegistration: '',
      businessRegistrationDate: '',
      taxCode: '',
      rating: '',
      ratingDate: '',
      legalRepresentative: '',
      authorizedPerson: '',
      chiefAccountant: '',
      notes: '',
      branchCode: currentUser?.maChiNhanh || '147',
      branchName: currentUser?.maChiNhanh === '190' ? 'Sài Gòn' : (currentUser?.maChiNhanh === '001' ? 'Hội sở chính' : 'Ba Tháng Hai'),
      source: 'MANUAL'
    },
    file: {
      code: '',
      decisionNumber: '',
      decisionDate: '',
      approvalLevel: defaultValue('CAP_PHE_DUYET'),
      contractNumber: '',
      contractDate: '',
      creditAmountVnd: '',
      displayUnit: defaultValue('DON_VI_HIEN_THI'),
      currency: defaultValue('DONG_TIEN'),
      expiryDate: '',
      purpose: '',
      businessField: '',
      workingCapitalNeed: '',
      additionalInfo: '',
      otherCreditInstitutions: '',
      hasRelatedCustomerGroup: false,
      hasManagedPartners: false,
      relatedGroupNotes: '',
      status: defaultValue('TRANG_THAI_HO_SO'),
      reportDate: today,
      documentNumber: '',
      source: 'MANUAL'
    },
    capitalMembers: [],
    relatedPartners: [],
    conditions: [],
    debts: []
  };
}

async function loadList() {
  try {
    const q = encodeURIComponent(paginationState.search);
    const page = paginationState.page;
    const limit = paginationState.limit;
    const res = await api(`/api/files?q=${q}&page=${page}&limit=${limit}`);

    const rows = Array.isArray(res) ? res : (res.items || []);
    paginationState.total = res.total !== undefined ? res.total : rows.length;
    paginationState.totalPages = res.totalPages !== undefined ? res.totalPages : 1;
    paginationState.page = res.page !== undefined ? res.page : 1;

    // Cập nhật thống kê tìm kiếm
    const summaryEl = $('#searchSummary');
    if (summaryEl) {
      if (paginationState.search) {
        summaryEl.innerHTML = `Tìm thấy <b>${paginationState.total}</b> hồ sơ khớp với từ khóa "<b>${esc(paginationState.search)}</b>" (Trang ${paginationState.page} / ${paginationState.totalPages})`;
      } else {
        summaryEl.innerHTML = `Tổng số <b>${paginationState.total}</b> hồ sơ tín dụng (Trang ${paginationState.page} / ${paginationState.totalPages})`;
      }
    }

    $('#recordList').innerHTML = rows.length ? rows.map(r => `
      <article class="record-row" data-id="${r.id}">
        <div>
          <span class="code">${esc(r.code)}</span>
          <small>${esc(r.contractNumber)}</small>
        </div>
        <div>
          <b>${esc(r.customerName)}</b>
          <small>CIF ${esc(r.cif)} · ${esc(r.branchCode)} — ${esc(r.branchName)}</small>
        </div>
        <div>
          <b>${money(r.creditAmount)} ₫</b>
          <small>Hạn mức</small>
        </div>
        <div>
          <b>${statusName(r.status)}</b>
          <small>Trạng thái</small>
        </div>
        <div>
          <b>${esc(r.updatedByName || (r.updatedByUsername ? `@${r.updatedByUsername}` : 'Hệ thống'))}</b>
          <small>${dateTime(r.updatedAt)}</small>
        </div>
        <div>
          <button class="btn small primary">Mở hồ sơ</button>
        </div>
      </article>
    `).join('') : '<div class="empty"><b>Không tìm thấy hồ sơ nào</b><br>Thử tìm với từ khóa khác hoặc tạo hồ sơ mới.</div>';

    document.querySelectorAll('.record-row').forEach(x => {
      x.onclick = () => openRecord(x.dataset.id);
    });

    renderPagination();
  } catch (e) {
    toast(e.message, true);
  }
}

function renderPagination() {
  const container = $('#pagination');
  if (!container) return;

  const { page, totalPages, total, limit } = paginationState;
  if (total === 0 || totalPages <= 1) {
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');

  const startRecord = (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Tạo các nút số trang thông minh
  let pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  container.innerHTML = `
    <div class="pagination-info">
      Hiển thị <b>${startRecord}–${endRecord}</b> trên tổng số <b>${total}</b> hồ sơ
    </div>
    <div class="pagination-controls">
      <button type="button" class="page-btn" data-page="1" ${page === 1 ? 'disabled' : ''} title="Trang đầu">««</button>
      <button type="button" class="page-btn" data-page="${page - 1}" ${page === 1 ? 'disabled' : ''} title="Trang trước">«</button>
      ${pages.map(p => {
        if (p === '...') return `<span class="page-ellipsis">…</span>`;
        return `<button type="button" class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`;
      }).join('')}
      <button type="button" class="page-btn" data-page="${page + 1}" ${page === totalPages ? 'disabled' : ''} title="Trang sau">»</button>
      <button type="button" class="page-btn" data-page="${totalPages}" ${page === totalPages ? 'disabled' : ''} title="Trang cuối">»»</button>
    </div>
  `;

  container.querySelectorAll('.page-btn[data-page]').forEach(btn => {
    btn.onclick = () => {
      const targetPage = Number(btn.dataset.page);
      if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
        paginationState.page = targetPage;
        loadList();
        scrollTo({ top: 0, behavior: 'smooth' });
      }
    };
  });
}

function showList() {
  $('#editorView').classList.add('hidden');
  $('#listView').classList.remove('hidden');
  loadList();
  scrollTo(0, 0);
}

function openNew() {
  state = blankRecord();
  showEditor();
}

async function openRecord(id) {
  try {
    state = await api(`/api/files/${id}`);
    showEditor();
    loadAudit();
  } catch (e) {
    toast(e.message, true);
  }
}

function showEditor() {
  $('#listView').classList.add('hidden');
  $('#editorView').classList.remove('hidden');
  renderAll();
  scrollTo(0, 0);
}

function renderAll() {
  $('#editorEyebrow').textContent = state.file.code || 'Hồ sơ mới';
  $('#editorTitle').textContent = state.customer.name || 'Nhập hồ sơ QTTD';
  $('#editorMeta').textContent = state.id
    ? `Phiên bản v${state.version} · Mã hồ sơ: ${state.file.code || '—'}`
    : 'Mọi thông tin đều do người dùng nhập thủ công.';

  // Banner lưu vết người thao tác
  const banner = $('#attributionBanner');
  if (state.id) {
    banner.classList.remove('hidden');
    const creator = state.createdBy ? `${esc(state.createdBy.name)} (@${esc(state.createdBy.username)})` : 'Hệ thống';
    const updater = state.updatedBy ? `${esc(state.updatedBy.name)} (@${esc(state.updatedBy.username)})` : 'Hệ thống';
    $('#attrCreatedBy').innerHTML = `${creator} (${dateTime(state.file.createdAt)})`;
    $('#attrUpdatedBy').innerHTML = `${updater} (${dateTime(state.file.updatedAt)})`;
  } else {
    banner.classList.add('hidden');
  }

  renderCustomer();
  renderCredit();
  renderConditions();
  renderDebts();
  renderScores();
}

function renderCustomer() {
  const c = state.customer;
  $('#customerSection').innerHTML = `${head('I', 'Thông tin khách hàng')}
  <div class="panel-body">
    <div class="form-grid">
      ${field('customer.name', 'Tên khách hàng', c.name, 'text', 6, true)}
      ${field('customer.cif', 'CIF', c.cif, 'text', 2, true)}
      ${selectField('customer.type', 'Loại hình', c.type, options('LOAI_HINH_KH'), 2, true)}
      ${field('customer.taxCode', 'Mã số thuế', c.taxCode, 'text', 2)}
      ${field('customer.businessRegistration', 'GCN ĐKKD', c.businessRegistration, 'text', 4)}
      ${field('customer.businessRegistrationDate', 'Ngày cấp ĐKKD', c.businessRegistrationDate, 'date', 2)}
      ${field('customer.branchCode', 'Mã chi nhánh', c.branchCode, 'text', 2, true)}
      ${field('customer.branchName', 'Tên chi nhánh', c.branchName, 'text', 4, true)}
      ${field('customer.rating', 'Xếp hạng tín dụng', c.rating, 'text', 2)}
      ${field('customer.ratingDate', 'Kỳ xếp hạng', c.ratingDate, 'date', 2)}
      ${field('customer.legalRepresentative', 'Người đại diện pháp luật', c.legalRepresentative, 'text', 3)}
      ${field('customer.authorizedPerson', 'Người được ủy quyền', c.authorizedPerson, 'text', 3)}
      ${field('customer.chiefAccountant', 'Kế toán trưởng', c.chiefAccountant, 'text', 2)}
      ${field('customer.notes', 'Lưu ý khác', c.notes, 'textarea', 12)}
    </div>
    ${subhead('Cơ cấu vốn', 'add-capital', '+ Thêm thành viên')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>TT</th><th>Tên thành viên</th><th>Loại</th><th>Giá trị vốn góp (VND)</th><th>Tỷ lệ %</th><th></th></tr></thead>
        <tbody>
          ${state.capitalMembers.length ? state.capitalMembers.map((x, i) => `<tr><td>${i + 1}</td><td>${cell(`capitalMembers.${i}.name`, x.name)}</td><td>${cell(`capitalMembers.${i}.type`, x.type)}</td><td>${cell(`capitalMembers.${i}.contributedCapital`, x.contributedCapital, 'number')}</td><td>${cell(`capitalMembers.${i}.percentage`, x.percentage, 'number')}</td><td class="row-actions">${remove('capital', i)}</td></tr>`).join('') : '<tr><td colspan="6" class="empty">Chưa có thành viên góp vốn.</td></tr>'}
        </tbody>
      </table>
    </div>
    <p class="total-note ${capitalPercent() > 100 ? 'bad' : ''}">Tổng tỷ lệ: <b>${capitalPercent()}%</b> · Tổng vốn góp: <b>${money(state.capitalMembers.reduce((a, x) => a + (+x.contributedCapital || 0), 0))} ₫</b></p>
  </div>`;
}

function renderCredit() {
  const f = state.file;
  $('#creditSection').innerHTML = `${head('II', 'Thông tin cấp tín dụng')}
  <div class="panel-body">
    <div class="form-grid">
      ${field('file.documentNumber', 'Số văn bản', f.documentNumber, 'text', 2)}
      ${field('file.reportDate', 'Ngày lập', f.reportDate, 'date', 2, true)}
      ${selectField('file.status', 'Trạng thái hồ sơ', f.status, options('TRANG_THAI_HO_SO'), 2, true)}
      ${field('file.decisionNumber', 'Số quyết định cấp TD', f.decisionNumber, 'text', 4, true)}
      ${field('file.decisionDate', 'Ngày quyết định', f.decisionDate, 'date', 2, true)}
      ${selectField('file.approvalLevel', 'Cấp phê duyệt', f.approvalLevel, options('CAP_PHE_DUYET'), 3, true)}
      ${field('file.contractNumber', 'Số HĐTD', f.contractNumber, 'text', 3, true)}
      ${field('file.contractDate', 'Ngày HĐTD', f.contractDate, 'date', 2, true)}
      ${field('file.expiryDate', 'Thời hạn đến ngày', f.expiryDate, 'date', 2, true)}
      ${selectField('file.currency', 'Đồng tiền', f.currency, options('DONG_TIEN'), 2)}
      ${field('file.creditAmountVnd', 'Số tiền cấp tín dụng (VND nguyên tệ)', f.creditAmountVnd, 'number', 4, true)}
      ${selectField('file.displayUnit', 'Đơn vị hiển thị', f.displayUnit, options('DON_VI_HIEN_THI'), 2)}
      ${field('file.workingCapitalNeed', 'Nhu cầu VLĐ (VND)', f.workingCapitalNeed, 'number', 3)}
      ${field('file.businessField', 'Lĩnh vực kinh doanh', f.businessField, 'text', 3, true)}
      ${field('file.purpose', 'Mục đích cấp tín dụng', f.purpose, 'textarea', 6, true)}
      ${field('file.additionalInfo', 'Thông tin bổ sung', f.additionalInfo, 'textarea', 6)}
      ${field('file.otherCreditInstitutions', 'Quan hệ tại các TCTD', f.otherCreditInstitutions, 'textarea', 12)}
      ${selectField('file.hasRelatedCustomerGroup', 'Thuộc nhóm KHLQ', String(!!f.hasRelatedCustomerGroup), options('CO_KHONG'), 2)}
      ${selectField('file.hasManagedPartners', 'Có đối tác cần quản lý', String(!!f.hasManagedPartners), options('CO_KHONG'), 2)}
      ${field('file.relatedGroupNotes', 'Biện pháp quản lý chung', f.relatedGroupNotes, 'text', 8)}
    </div>
    ${subhead('Đối tác liên quan', 'add-partner', '+ Thêm đối tác')}
    <div class="table-wrap">
      <table>
        <thead><tr><th>TT</th><th>Tên đối tác</th><th>CIF</th><th>MST</th><th>Loại quan hệ</th><th>Biện pháp quản lý</th><th></th></tr></thead>
        <tbody>
          ${state.relatedPartners.length ? state.relatedPartners.map((x, i) => `<tr><td>${i + 1}</td><td>${cell(`relatedPartners.${i}.name`, x.name)}</td><td>${cell(`relatedPartners.${i}.cif`, x.cif)}</td><td>${cell(`relatedPartners.${i}.taxCode`, x.taxCode)}</td><td>${cell(`relatedPartners.${i}.relationshipType`, x.relationshipType)}</td><td>${cell(`relatedPartners.${i}.managementMeasure`, x.managementMeasure)}</td><td>${remove('partner', i)}</td></tr>`).join('') : '<tr><td colspan="7" class="empty">Chưa có đối tác liên quan.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function renderConditions() {
  const groups = [['TSBD', 'III.a — Tài sản bảo đảm'], ['DKTD', 'III.b — Điều kiện tín dụng']];
  $('#conditionSection').innerHTML = `${head('III', 'Tài sản bảo đảm & Điều kiện tín dụng')}
  <div class="panel-body">
    ${groups.map(([group, title]) => `${subhead(title, `add-condition:${group}`, '+ Thêm điều kiện')}${state.conditions.map((x, i) => ({ x, i })).filter(o => o.x.group === group).map(({ x, i }) => conditionCard(x, i)).join('') || '<div class="empty">Chưa có điều kiện.</div>'}`).join('')}
  </div>`;
}

function conditionCard(x, i) {
  return `<article class="condition">
    <div class="condition-title">
      <span class="tag">${esc(x.group)}</span>
      <b>Điều kiện ${i + 1}</b>
      <span class="grow"></span>
      <button type="button" class="btn small" data-action="add-period" data-index="${i}">+ Kỳ theo dõi</button>
      ${remove('condition', i)}
    </div>
    <div class="condition-body">
      <div class="form-grid">
        ${selectField(`conditions.${i}.type`, 'Loại điều kiện', x.type, options(x.group === 'TSBD' ? 'LOAI_DK_TSBD' : 'LOAI_DK_DKTD'), 2, true)}
        ${selectField(`conditions.${i}.frequency`, 'Tần suất', x.frequency, options('TAN_SUAT'), 2, true)}
        ${selectField(`conditions.${i}.nature`, 'Tính chất', x.nature, options('TINH_CHAT_DK'), 2, true)}
        ${selectField(`conditions.${i}.quantitativeIndicator`, 'Chỉ tiêu định lượng', x.quantitativeIndicator, options('CHI_TIEU_DINH_LUONG'), 3)}
        ${field(`conditions.${i}.threshold`, 'Ngưỡng yêu cầu', x.threshold, 'number', 3)}
        ${field(`conditions.${i}.monitoringStartDate`, 'Bắt đầu theo dõi', x.monitoringStartDate, 'date', 2)}
        ${field(`conditions.${i}.monitoringEndDate`, 'Kết thúc theo dõi', x.monitoringEndDate, 'date', 2)}
        ${field(`conditions.${i}.content`, 'Nội dung điều kiện', x.content, 'textarea', 8, true)}
      </div>
      <div class="table-wrap periods">
        <table>
          <thead><tr><th>Kỳ</th><th>Đến hạn</th><th>Tình hình thực hiện</th><th>Giá trị</th><th>Ngày ghi nhận</th><th>Người ghi nhận</th><th>Ngày thực hiện</th><th>Tình trạng</th><th>Ghi đè</th><th>Mức tự động</th><th></th></tr></thead>
          <tbody>
            ${x.periods.length ? x.periods.map((p, j) => periodRow(x, i, p, j)).join('') : '<tr><td colspan="11" class="empty">Chưa có kỳ theo dõi.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  </article>`;
}

function periodRow(condition, i, p, j) {
  const score = scoreCondition(condition, p);
  return `<tr>
    <td>${cell(`conditions.${i}.periods.${j}.code`, p.code)}</td>
    <td>${cell(`conditions.${i}.periods.${j}.dueDate`, p.dueDate, 'date')}</td>
    <td>${cell(`conditions.${i}.periods.${j}.performance`, p.performance, 'textarea')}</td>
    <td>${cell(`conditions.${i}.periods.${j}.actualValue`, p.actualValue, 'number')}</td>
    <td>${cell(`conditions.${i}.periods.${j}.valueRecordedDate`, p.valueRecordedDate, 'date')}</td>
    <td>${cell(`conditions.${i}.periods.${j}.recordedBy`, p.recordedBy)}</td>
    <td>${cell(`conditions.${i}.periods.${j}.completedDate`, p.completedDate, 'date')}</td>
    <td>${cellSelect(`conditions.${i}.periods.${j}.status`, p.status, options('TINH_TRANG_KY'))}</td>
    <td>${cellSelect(`conditions.${i}.periods.${j}.overrideLevel`, p.overrideLevel, options('MUC_GHI_DE'))}${cell(`conditions.${i}.periods.${j}.overrideReason`, p.overrideReason)}</td>
    <td class="status-cell">${scoreHtml(score)}</td>
    <td>${remove('period', j, ` data-parent="${i}"`)}</td>
  </tr>`;
}

function renderDebts() {
  $('#debtSection').innerHTML = `${head('IV', 'Điều kiện theo dõi & Điều kiện nợ', 'add-debt', '+ Thêm dòng')}
  <div class="panel-body">
    <div class="table-wrap">
      <table>
        <thead><tr><th>STT</th><th>Ngày nợ</th><th>Nội dung</th><th>Loại hồ sơ</th><th>Ngày cam kết BS</th><th>Ngày bổ sung HS</th><th>Tình trạng</th><th>Mức điều kiện</th><th>Kết luận tự động</th><th></th></tr></thead>
        <tbody>
          ${state.debts.length ? state.debts.map((x, i) => `<tr><td>${i + 1}</td><td>${cell(`debts.${i}.debtDate`, x.debtDate, 'date')}</td><td>${cell(`debts.${i}.content`, x.content, 'textarea')}</td><td>${cell(`debts.${i}.documentType`, x.documentType)}</td><td>${cell(`debts.${i}.commitmentDate`, x.commitmentDate, 'date')}</td><td>${cell(`debts.${i}.supplementedDate`, x.supplementedDate, 'date')}</td><td>${cellSelect(`debts.${i}.status`, x.status, options('TINH_TRANG_NO'))}</td><td>${cellSelect(`debts.${i}.levelType`, x.levelType, options('MUC_DIEU_KIEN'))}</td><td class="status-cell">${scoreHtml(scoreDebt(x))}</td><td>${remove('debt', i)}</td></tr>`).join('') : '<tr><td colspan="10" class="empty">Chưa có điều kiện nợ.</td></tr>'}
        </tbody>
      </table>
    </div>
  </div>`;
}

function handleInput(e) {
  const path = e.target.dataset.path;
  if (!path) return;
  let value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
  if (path === 'file.hasRelatedCustomerGroup' || path === 'file.hasManagedPartners') value = value === 'true';
  setPath(state, path, value);
  const affectsScore = path.includes('.status') || path.includes('Date') || path.includes('threshold') || path.includes('actualValue') || path.includes('nature') || path.includes('override');
  if (affectsScore) {
    renderScores();
    if (e.type === 'change') {
      renderConditions();
      renderDebts();
      renderScores();
    }
  }
}

function handleAction(e) {
  const b = e.target.closest('[data-action]');
  if (!b) return;
  e.preventDefault();
  const [action, arg] = b.dataset.action.split(':');
  const i = Number(b.dataset.index);

  if (action === 'add-capital') state.capitalMembers.push({ name: '', type: 'Cá nhân', contributedCapital: '', percentage: '', source: 'MANUAL' });
  if (action === 'remove-capital') state.capitalMembers.splice(i, 1);
  if (action === 'add-partner') state.relatedPartners.push({ name: '', cif: '', taxCode: '', relationshipType: 'Quan hệ thương mại', managementMeasure: '', source: 'MANUAL' });
  if (action === 'remove-partner') state.relatedPartners.splice(i, 1);
  if (action === 'add-condition') {
    const typeGroup = arg === 'TSBD' ? 'LOAI_DK_TSBD' : 'LOAI_DK_DKTD';
    state.conditions.push({
      group: arg,
      type: defaultValue(typeGroup),
      content: '',
      frequency: defaultValue('TAN_SUAT'),
      nature: defaultValue('TINH_CHAT_DK'),
      quantitativeIndicator: defaultValue('CHI_TIEU_DINH_LUONG'),
      threshold: '',
      monitoringStartDate: '',
      monitoringEndDate: '',
      periods: [],
      source: 'MANUAL'
    });
  }
  if (action === 'remove-condition') state.conditions.splice(i, 1);
  if (action === 'add-period') state.conditions[i].periods.push({ code: '', dueDate: '', performance: '', actualValue: '', valueRecordedDate: '', recordedBy: currentUser?.hoTen || '', completedDate: '', status: defaultValue('TINH_TRANG_KY'), overrideLevel: defaultValue('MUC_GHI_DE'), overrideReason: '', source: 'MANUAL' });
  if (action === 'remove-period') state.conditions[Number(b.dataset.parent)].periods.splice(i, 1);
  if (action === 'add-debt') state.debts.push({ debtDate: today, content: '', documentType: '', commitmentDate: '', supplementedDate: '', status: defaultValue('TINH_TRANG_NO'), levelType: defaultValue('MUC_DIEU_KIEN'), source: 'MANUAL' });
  if (action === 'remove-debt') state.debts.splice(i, 1);

  renderAll();
}

async function saveRecord() {
  $('#saveBtn').disabled = true;
  try {
    const saved = await api(state.id ? `/api/files/${state.id}` : '/api/files', {
      method: state.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state)
    });
    state = saved;
    renderAll();
    loadAudit();
    toast(`Đã lưu hồ sơ ${saved.file.code} thành công!`);
  } catch (e) {
    toast(e.message, true);
  } finally {
    $('#saveBtn').disabled = false;
  }
}

async function loadAudit() {
  if (!state.id) return;
  try {
    const rows = await api(`/api/files/${state.id}/audit`);
    const auditSection = $('#auditSection');
    auditSection.classList.remove('hidden');

    if (!rows || !rows.length) {
      auditSection.innerHTML = `${head('V', 'Nhật ký & Lịch sử thay đổi')}<div class="panel-body"><div class="empty">Chưa có nhật ký nào.</div></div>`;
      return;
    }

    auditSection.innerHTML = `${head('V', 'Nhật ký & Lịch sử thay đổi')}
    <div class="panel-body">
      <div class="timeline">
        ${rows.map(item => `
          <div class="timeline-card">
            <span class="timeline-dot ${item.action === 'TAO' ? 'create' : 'update'}"></span>
            <div class="timeline-header">
              <div>
                <span class="timeline-action-tag ${item.action}">${item.action === 'TAO' ? 'Khởi tạo hồ sơ' : 'Chỉnh sửa hồ sơ'}</span>
                <span class="timeline-actor"> · 👤 ${esc(item.userName || 'Hệ thống')}</span>
              </div>
              <span class="timeline-time">🕒 ${dateTime(item.at)}</span>
            </div>
            ${item.changes && item.changes.length ? `
              <div class="diff-list">
                ${item.changes.map(ch => `
                  <div class="diff-item">
                    <span class="diff-label">${esc(ch.field)}:</span>
                    <div class="diff-values">
                      ${ch.oldVal ? `<span class="diff-old">${esc(ch.oldVal)}</span> <span class="diff-arrow">➔</span>` : ''}
                      <span class="diff-new">${esc(ch.newVal)}</span>
                    </div>
                  </div>
                `).join('')}
              </div>
            ` : '<div class="reason">Không có thông tin trường thay đổi chi tiết.</div>'}
          </div>
        `).join('')}
      </div>
    </div>`;
  } catch {}
}

// ----------------- RULES & SCORING -----------------

function scoreCondition(c, p) {
  const n1 = +$('#n1').value || 15;
  const n2 = +$('#n2').value || 30;
  const evalDate = $('#evaluationDate').value || today;

  if (!p) return { level: 'X', reason: 'Chưa phát sinh kỳ theo dõi' };
  if (p.overrideLevel) return { level: p.overrideLevel, reason: `Ghi đè thủ công: ${p.overrideReason || 'không nêu lý do'}` };
  if (p.status === 'MIEN_GIAM') return { level: 'X', reason: 'Được miễn giảm' };

  if (c.quantitativeIndicator && p.actualValue !== '' && c.threshold !== '') {
    const a = +p.actualValue, t = +c.threshold;
    if (a >= t) return { level: 'X', reason: `Giá trị ${a} đạt ngưỡng ${t}` };
    if (a >= t * 0.95) return { level: 'V', reason: `Giá trị ${a} gần ngưỡng ${t}` };
    return { level: 'D', reason: `Giá trị ${a} dưới ngưỡng ${t}` };
  }

  if (p.status === 'DA_THUC_HIEN') {
    const delay = p.completedDate && p.dueDate ? day(p.completedDate) - day(p.dueDate) : 0;
    if (delay <= 0) return { level: 'X', reason: 'Đã thực hiện đúng hạn' };
    if (c.nature !== 'TIEN_QUYET' && delay <= n2) return { level: 'V', reason: `Hoàn thành chậm ${delay} ngày` };
    return { level: 'D', reason: `Hoàn thành chậm ${delay} ngày` };
  }

  if (!p.dueDate) return { level: 'X', reason: 'Chưa có ngày đến hạn' };
  const remaining = day(p.dueDate) - day(evalDate);
  if (remaining >= 0) return remaining <= n1 ? { level: 'V', reason: `Còn ${remaining} ngày đến hạn` } : { level: 'X', reason: `Còn ${remaining} ngày đến hạn` };
  const overdue = Math.abs(remaining);
  return c.nature !== 'TIEN_QUYET' && overdue <= n2 ? { level: 'V', reason: `Quá hạn ${overdue} ngày` } : { level: 'D', reason: `Quá hạn ${overdue} ngày` };
}

function scoreDebt(x) {
  const n1 = +$('#n1').value || 15;
  const n2 = +$('#n2').value || 30;
  const evalDate = $('#evaluationDate').value || today;
  const pre = x.levelType === 'TIEN_QUYET';

  if (x.supplementedDate) {
    const delay = day(x.supplementedDate) - day(x.commitmentDate);
    if (delay <= 0) return { level: 'X', reason: 'Đã bổ sung đúng hạn' };
    return !pre && delay <= n2 ? { level: 'V', reason: `Bổ sung chậm ${delay} ngày` } : { level: 'D', reason: `Bổ sung chậm ${delay} ngày` };
  }
  if (!x.commitmentDate) return { level: 'X', reason: 'Chưa có ngày cam kết' };
  const r = day(x.commitmentDate) - day(evalDate);
  if (r >= 0) return r <= n1 ? { level: 'V', reason: `Còn ${r} ngày đến hạn` } : { level: 'X', reason: `Còn ${r} ngày đến hạn` };
  const o = Math.abs(r);
  return !pre && o <= n2 ? { level: 'V', reason: `Quá hạn ${o} ngày` } : { level: 'D', reason: `Quá hạn ${o} ngày` };
}

function renderScores() {
  const scores = state.conditions.map(x => scoreCondition(x, x.periods.at(-1))).concat(state.debts.map(scoreDebt));
  const level = scores.some(x => x.level === 'D') ? 'D' : scores.some(x => x.level === 'V') ? 'V' : 'X';
  const el = $('#overallScore');
  el.className = `score ${level}`;
  el.textContent = { X: 'Xanh', V: 'Vàng', D: 'Đỏ' }[level];
}

// ----------------- UI BUILDERS -----------------

function head(no, title, action, label) {
  return `<header class="panel-head">
    <span>${no}</span>
    <h2>${title}</h2>
    ${action ? `<div class="actions"><button type="button" class="btn light small" data-action="${action}">${label}</button></div>` : ''}
  </header>`;
}

function subhead(title, action, label) {
  return `<div class="subhead"><h3>${title}</h3><button type="button" class="btn small" data-action="${action}">${label}</button></div>`;
}

function field(path, label, value, type = 'text', span = 3, required = false) {
  const content = type === 'textarea'
    ? `<textarea aria-label="${esc(label)}" data-path="${path}" class="${required ? 'input-required' : ''}" placeholder="${required ? 'Bắt buộc nhập…' : ''}">${esc(value)}</textarea>`
    : `<input aria-label="${esc(label)}" data-path="${path}" class="${required ? 'input-required' : ''}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'step="any"' : ''} placeholder="${required ? 'Bắt buộc…' : ''}">`;
  return `<div class="field c${span} ${required ? 'field-required' : ''}"><label class="${required ? 'required' : ''}">${required ? '<span class="field-icon req" title="Bắt buộc">★</span> ' : '<span class="field-icon" title="Nhập dữ liệu">✍</span> '}${label}</label>${content}</div>`;
}

function selectField(path, label, value, items, span = 3, required = false) {
  return `<div class="field c${span} ${required ? 'field-required' : ''}"><label class="${required ? 'required' : ''}">${required ? '<span class="field-icon req" title="Bắt buộc">★</span> ' : '<span class="field-icon sel" title="Chọn từ danh mục">▾</span> '}${label}</label><select aria-label="${esc(label)}" data-path="${path}" class="${required ? 'input-required' : ''}">${optionHtml(items, value)}</select></div>`;
}

function cell(path, value, type = 'text') {
  const label = path.split('.').at(-1);
  return type === 'textarea'
    ? `<textarea aria-label="${esc(label)}" data-path="${path}">${esc(value)}</textarea>`
    : `<input aria-label="${esc(label)}" data-path="${path}" type="${type}" value="${esc(value)}" ${type === 'number' ? 'step="any"' : ''}>`;
}

function cellSelect(path, value, items) {
  return `<select aria-label="${esc(path.split('.').at(-1))}" data-path="${path}">${optionHtml(items, value)}</select>`;
}

function remove(type, index, extra = '') {
  return `<button type="button" class="btn danger small" data-action="remove-${type}" data-index="${index}"${extra}>Xóa</button>`;
}

function scoreHtml(s) {
  return `<span class="score ${s.level}">${{ X: 'Xanh', V: 'Vàng', D: 'Đỏ' }[s.level]}</span><div class="reason">${esc(s.reason)}</div>`;
}

function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}

function capitalPercent() {
  return Math.round(state.capitalMembers.reduce((a, x) => a + (+x.percentage || 0), 0) * 100) / 100;
}

function day(s) {
  return Date.parse(`${s}T00:00:00Z`) / 86400000;
}

function money(v) {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(Number(v) || 0);
}

function dateTime(v) {
  return v ? new Date(v).toLocaleString('vi-VN') : '—';
}

function options(type) {
  return config[type] || [];
}

function defaultValue(type) {
  const items = options(type);
  return (items.find(x => x.isDefault) || items[0] || {}).value || '';
}

function optionLabel(type, value) {
  return options(type).find(x => String(x.value) === String(value))?.label || value;
}

function optionHtml(items, value) {
  return items.map(x => `<option value="${esc(x.value)}" ${String(value) === String(x.value) ? 'selected' : ''}>${esc(x.label)}</option>`).join('');
}

function statusName(v) {
  return optionLabel('TRANG_THAI_HO_SO', v);
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function api(url, options = {}) {
  options.headers = options.headers || {};
  if (csrfToken && ['POST', 'PUT', 'DELETE', 'PATCH'].includes((options.method || 'GET').toUpperCase())) {
    options.headers['X-CSRF-Token'] = csrfToken;
  }

  const r = await fetch(url, options);
  const data = await r.json();
  if (!r.ok) {
    const details = data.details?.join('\n');
    throw new Error(details || data.error || 'Có lỗi xảy ra.');
  }
  return data;
}

let toastTimer;
function toast(message, error = false) {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 5000);
}
