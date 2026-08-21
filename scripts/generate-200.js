'use strict';

const path = require('node:path');
const { createStore } = require('../db');

const databasePath = process.env.QTTD_DB_PATH || path.join(__dirname, '..', 'data', 'qttd.db');
const store = createStore(databasePath);

const branches = [
  { code: '001', name: 'Hội sở chính' },
  { code: '147', name: 'Ba Tháng Hai' },
  { code: '190', name: 'Sài Gòn' },
  { code: '314', name: 'Bình Dương' },
  { code: '102', name: 'Hà Nội' },
  { code: '205', name: 'Đà Nẵng' },
  { code: '401', name: 'Cần Thơ' },
  { code: '502', name: 'Hải Phòng' },
  { code: '603', name: 'Đồng Nai' },
  { code: '704', name: 'Long An' },
  { code: '805', name: 'Bắc Ninh' },
  { code: '906', name: 'Quảng Ninh' },
  { code: '115', name: 'Thăng Long' },
  { code: '125', name: 'Gia Định' },
  { code: '135', name: 'Bến Thành' },
  { code: '145', name: 'Chợ Lớn' },
  { code: '155', name: 'Nam Sài Gòn' },
  { code: '165', name: 'Đông Đô' },
  { code: '175', name: 'Cầu Giấy' },
  { code: '185', name: 'Tây Hồ' }
];

const businessTypes = ['DOANH_NGHIEP', 'HO_KINH_DOANH', 'CA_NHAN'];
const statuses = ['HIEU_LUC', 'HIEU_LUC', 'HIEU_LUC', 'NHAP', 'DONG'];
const approvalLevels = ['GIAM_DOC_CAP_1', 'PHO_GIAM_DOC_CAP_2', 'HOI_DONG_CO_SO', 'TRU_SO_CHINH'];

const prefixes = [
  'Công ty Cổ phần', 'Công ty TNHH', 'Tập đoàn', 'Tổng công ty',
  'Công ty TNHH MTV', 'Hộ kinh doanh', 'Công ty CP Đầu tư & Phát triển',
  'Công ty CP Xuất nhập khẩu', 'Công ty CP Sản xuất Thương mại'
];

const coreNames = [
  'An Phát', 'Minh Long', 'Thành Công', 'Hoàng Kim', 'Đại Nam', 'Bình Minh', 'Đông Á', 'Thịnh Vượng',
  'Hưng Thịnh', 'Vạn Xuân', 'Phúc Hưng', 'Thiên Tân', 'Gia Định', 'Nam Á', 'Việt Thành', 'Tân Á Đại Thành',
  'Á Châu', 'Hải Đăng', 'Phương Nam', 'Việt Phát', 'Bách Hóa', 'Long Sơn', 'Cường Thịnh', 'Hòa Phát',
  'Hồng Hà', 'Viễn Đông', 'Bảo An', 'Kim Tín', 'Toàn Cầu', 'Trường Hải', 'Khang Điền', 'Đại Đồng',
  'Phú Mỹ', 'Sơn Hải', 'Thắng Lợi', 'Hoàng Long', 'Thái Sơn', 'Bắc Á', 'Quốc Tế', 'Minh Đức'
];

const industries = [
  'Sản xuất bao bì giấy & màng nhựa',
  'Xây dựng công trình dân dụng & hạ tầng giao thông',
  'May mặc và gia công hàng dệt xuất khẩu',
  'Kinh doanh chuỗi bán lẻ hàng tiêu dùng & siêu thị mini',
  'Dịch vụ logistics, kho bãi & vận tải quốc tế',
  'Chế biến thủy hải sản đông lạnh xuất khẩu',
  'Sản xuất và gia công thép kết cấu xây dựng',
  'Đầu tư điện năng lượng mặt trời áp mái công nghiệp',
  'Sản xuất thức ăn chăn nuôi & thủy sản',
  'Kinh doanh phân phối dược phẩm & vật tư y tế',
  'Trồng trọt và chế biến nông sản xuất khẩu chất lượng cao',
  'Sản xuất linh kiện điện tử và vi mạch chính xác',
  'Kinh doanh đại lý ô tô & dịch vụ bảo dưỡng sửa chữa',
  'Sản xuất đồ gỗ nội thất cao cấp xuất khẩu Châu Âu',
  'Kinh doanh đại lý vé số & phát hành bảo lãnh'
];

const users = store.listUsers();
if (!users.length) {
  console.error('Chưa có users trong DB!');
  process.exit(1);
}

console.log(`Bắt đầu sinh 200 hồ sơ tín dụng mẫu...`);
let insertedCount = 0;
const targetCount = 200;

for (let i = 1; i <= targetCount; i++) {
  const cifNum = 200000 + i;
  const cif = String(cifNum);
  const contractNumber = `${String(i).padStart(3, '0')}/2026/${cif}/HĐTD`;

  // Kiểm tra nếu đã có số HĐTD thì bỏ qua
  const existing = store.list(contractNumber, { limit: 1 });
  if (existing.items && existing.items.some(x => x.contractNumber === contractNumber)) {
    continue;
  }

  const branch = branches[i % branches.length];
  const user = users[i % users.length];
  const type = businessTypes[i % businessTypes.length];
  const status = statuses[i % statuses.length];
  const approval = approvalLevels[i % approvalLevels.length];
  const prefix = prefixes[i % prefixes.length];
  const core = coreNames[i % coreNames.length];
  const industry = industries[i % industries.length];
  const name = type === 'CA_NHAN'
    ? `Ông/Bà ${core} — Khách hàng cá nhân`
    : `${prefix} ${core} ${i}`;

  const amount = (Math.floor((i * 3.7 + 10) % 200) + 5) * 1_000_000_000; // 5 tỷ đến 205 tỷ VND

  const payload = {
    version: 0,
    customer: {
      cif,
      name,
      type,
      businessRegistration: `03${String(10000000 + i).slice(0, 8)}`,
      businessRegistrationDate: '2021-06-15',
      taxCode: `03${String(10000000 + i).slice(0, 8)}`,
      rating: i % 3 === 0 ? 'AAA' : (i % 3 === 1 ? 'AA' : 'A+'),
      ratingDate: '2026-06-30',
      legalRepresentative: `Nguyễn Văn ${core}`,
      authorizedPerson: '',
      chiefAccountant: `Lê Thị ${core}`,
      notes: `Hồ sơ tín dụng mẫu thứ ${i} phục vụ kiểm thử tìm kiếm & phân trang.`,
      branchCode: branch.code,
      branchName: branch.name,
      source: 'MANUAL'
    },
    file: {
      decisionNumber: `${1000 + i}/QĐ-BIDV`,
      decisionDate: '2026-01-10',
      approvalLevel: approval,
      contractNumber,
      contractDate: '2026-01-15',
      creditAmountVnd: amount,
      displayUnit: 'TY',
      currency: 'VND',
      expiryDate: '2027-01-15',
      purpose: `Cấp hạn mức tín dụng tài trợ vốn lưu động phục vụ ${industry.toLowerCase()}`,
      businessField: industry,
      workingCapitalNeed: amount * 1.3,
      additionalInfo: `Hồ sơ mẫu được tạo tự động với mã CIF ${cif}.`,
      otherCreditInstitutions: i % 4 === 0 ? 'Có quan hệ tín dụng tại 01 TCTD khác, quan hệ tốt.' : 'Không có dư nợ xấu tại các TCTD.',
      hasRelatedCustomerGroup: i % 5 === 0,
      hasManagedPartners: i % 3 === 0,
      relatedGroupNotes: i % 5 === 0 ? 'Kiểm soát dòng tiền chuyển về theo tiến độ thi công hợp đồng.' : '',
      status,
      reportDate: '2026-08-21',
      documentNumber: `BC-QTTD-${cif}`,
      source: 'MANUAL'
    },
    capitalMembers: [
      { name: `Thành viên sáng lập ${core}`, type: 'Cá nhân', contributedCapital: amount * 0.2, percentage: 65, source: 'MANUAL' },
      { name: `Cổ đông chiến lược ${core}`, type: 'Doanh nghiệp', contributedCapital: amount * 0.1, percentage: 35, source: 'MANUAL' }
    ],
    relatedPartners: i % 3 === 0 ? [
      { name: `Đối tác cung ứng ${core}`, cif: '', taxCode: '0318899776', relationshipType: 'Quan hệ thương mại', managementMeasure: 'Quản lý qua tài khoản thanh toán tại BIDV', source: 'MANUAL' }
    ] : [],
    conditions: [
      {
        group: 'TSBD',
        type: 'BPBD',
        content: `Duy trì tỷ lệ giá trị tài sản bảo đảm trên hạn mức tín dụng tối thiểu 100% cho khoản cấp TD ${cif}.`,
        frequency: 'QUY',
        nature: 'THEO_DOI',
        quantitativeIndicator: 'TSBD_HMTD',
        threshold: 100,
        monitoringStartDate: '2026-01-15',
        monitoringEndDate: '2027-01-15',
        source: 'MANUAL',
        periods: [
          {
            code: '2026-Q3',
            dueDate: '2026-09-30',
            performance: `Tỷ lệ TSBĐ/HMTD ghi nhận đạt ${100 + (i % 20)}%.`,
            actualValue: 100 + (i % 20),
            valueRecordedDate: '2026-08-15',
            recordedBy: user.hoTen,
            completedDate: '2026-08-15',
            status: 'DA_THUC_HIEN',
            overrideLevel: '',
            overrideReason: '',
            source: 'MANUAL'
          }
        ]
      },
      {
        group: 'DKTD',
        type: 'TAI_CHINH',
        content: `Khách hàng cam kết chuyển tối thiểu 60% doanh thu về tài khoản BIDV chi nhánh ${branch.name}.`,
        frequency: 'QUY',
        nature: i % 7 === 0 ? 'TIEN_QUYET' : 'THEO_DOI',
        quantitativeIndicator: 'DOANH_THU_CHUYEN_VE',
        threshold: 60,
        monitoringStartDate: '2026-01-15',
        monitoringEndDate: '2027-01-15',
        source: 'MANUAL',
        periods: [
          {
            code: '2026-Q2',
            dueDate: '2026-06-30',
            performance: `Doanh thu chuyển về đạt ${65 + (i % 15)}%.`,
            actualValue: 65 + (i % 15),
            valueRecordedDate: '2026-07-02',
            recordedBy: user.hoTen,
            completedDate: '2026-07-02',
            status: 'DA_THUC_HIEN',
            overrideLevel: '',
            overrideReason: '',
            source: 'MANUAL'
          }
        ]
      }
    ],
    debts: [
      {
        debtDate: '2026-07-01',
        content: `Bổ sung chứng thư bảo hiểm tài sản bảo đảm đợt ${i}.`,
        documentType: 'Bảo hiểm',
        commitmentDate: '2026-08-30',
        supplementedDate: i % 2 === 0 ? '2026-08-20' : '',
        status: i % 2 === 0 ? 'DA_BO_SUNG' : 'CHUA_DEN_HAN',
        levelType: 'THEO_DOI',
        source: 'MANUAL'
      }
    ]
  };

  try {
    store.save(payload, null, user);
    insertedCount++;
    if (insertedCount % 40 === 0) {
      console.log(`Đã tạo ${insertedCount}/${targetCount} hồ sơ...`);
    }
  } catch (err) {
    console.error(`Lỗi khi tạo hồ sơ ${i}: ${err.message}`);
  }
}

const totalInDb = store.list('', { limit: 1 }).total;
console.log(`\n Hoàn tất! Đã thêm mới ${insertedCount} hồ sơ. Tổng số hồ sơ hiện có trong CSDL: ${totalInDb}.`);
store.close();
