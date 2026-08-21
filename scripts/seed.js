'use strict';

const path = require('node:path');
const { createStore } = require('../db');

const databasePath = process.env.QTTD_DB_PATH || path.join(__dirname, '..', 'data', 'qttd.db');
const store = createStore(databasePath);

const samples = [
  sample({
    cif:'68735', name:'Trần Ngọc Tâm — Chủ HKD Đại lý vé số Trần Ngọc Tâm', type:'HO_KINH_DOANH',
    registration:'0304400948-002/41N8158368', taxCode:'0304400948', rating:'AA+', representative:'Trần Ngọc Tâm',
    decision:'6571/QĐ-BIDV', contract:'171/2025/68735/HĐTD', amount:73000000000,
    field:'Kinh doanh đại lý vé số', purpose:'Bổ sung vốn lưu động, phát hành bảo lãnh phục vụ hoạt động kinh doanh đại lý vé số',
    status:'HIEU_LUC', color:'V'
  }),
  sample({
    cif:'102938', name:'Công ty Cổ phần Đầu tư Minh Long', type:'DOANH_NGHIEP',
    registration:'0312345678', taxCode:'0312345678', rating:'BBB', representative:'Nguyễn Minh Long',
    decision:'2418/QĐ-BIDV', contract:'088/2026/102938/HĐTD', amount:125000000000,
    field:'Xây dựng hạ tầng và kinh doanh bất động sản', purpose:'Tài trợ vốn lưu động cho các hợp đồng thi công hạ tầng',
    status:'HIEU_LUC', color:'D'
  }),
  sample({
    cif:'556677', name:'Công ty TNHH Sản xuất Thương mại An Phú', type:'DOANH_NGHIEP',
    registration:'3702987654', taxCode:'3702987654', rating:'A', representative:'Lê Thị An',
    decision:'1902/QĐ-BIDV', contract:'052/2026/556677/HĐTD', amount:45000000000,
    field:'Sản xuất bao bì giấy', purpose:'Bổ sung vốn lưu động phục vụ sản xuất và thu mua nguyên vật liệu',
    status:'NHAP', color:'X'
  })
];

let created = 0;
const seedUser = store.listUsers().find(u => u.username === 'canbo_qttd') || store.listUsers()[0];
for (const payload of samples) {
  if (store.list(payload.file.contractNumber).some(x => x.contractNumber === payload.file.contractNumber)) {
    console.log(`Bỏ qua hồ sơ đã có: ${payload.file.contractNumber}`);
    continue;
  }
  const saved = store.save(payload, null, seedUser);
  console.log(`Đã tạo ${saved.file.code}: ${saved.customer.name} (Tạo bởi: ${seedUser?.hoTen || 'Hệ thống'})`);
  created++;
}
console.log(`Hoàn tất: tạo mới ${created}, tổng số hồ sơ ${store.list().length}.`);
store.close();

function sample(x) {
  const branch = x.color === 'D' ? ['190','Sài Gòn'] : x.color === 'X' ? ['314','Bình Dương'] : ['147','Ba Tháng Hai'];
  return {
    version:0,
    customer:{
      cif:x.cif,name:x.name,type:x.type,businessRegistration:x.registration,businessRegistrationDate:'2022-03-15',taxCode:x.taxCode,
      rating:x.rating,ratingDate:'2026-06-30',legalRepresentative:x.representative,authorizedPerson:'',chiefAccountant:'Phạm Thu Hà',
      notes:x.color==='D'?'Khách hàng cần theo dõi sát tiến độ bổ sung tài sản bảo đảm.':'Dữ liệu mẫu phục vụ xem và in hồ sơ.',
      branchCode:branch[0],branchName:branch[1],source:'MANUAL'
    },
    file:{
      decisionNumber:x.decision,decisionDate:'2026-01-15',approvalLevel:x.amount>100000000000?'HOI_DONG_CO_SO':'GIAM_DOC_CAP_1',
      contractNumber:x.contract,contractDate:'2026-01-20',creditAmountVnd:x.amount,displayUnit:'TY',currency:'VND',expiryDate:'2027-01-20',
      purpose:x.purpose,businessField:x.field,workingCapitalNeed:x.amount*1.25,additionalInfo:'Hồ sơ mẫu được nhập thủ công để trình diễn MVP.',
      otherCreditInstitutions:x.color==='D'?'Có dư nợ tại 02 tổ chức tín dụng khác.':'Quan hệ tín dụng bình thường, không có nợ quá hạn.',
      hasRelatedCustomerGroup:x.color!=='X',hasManagedPartners:x.color==='V',relatedGroupNotes:'Kiểm soát giải ngân, dòng tiền và thu nợ tương ứng.',
      status:x.status,reportDate:'2026-08-21',documentNumber:`BC-QTTD-${x.cif}`,source:'MANUAL'
    },
    capitalMembers:[
      {name:x.representative,type:'Cá nhân',contributedCapital:x.amount*.12,percentage:70,source:'MANUAL'},
      {name:'Thành viên góp vốn thứ hai',type:'Cá nhân',contributedCapital:x.amount*.05,percentage:30,source:'MANUAL'}
    ],
    relatedPartners:x.color==='X'?[]:[
      {name:'Công ty TNHH Thương mại Thành Công',cif:'',taxCode:'0319988776',relationshipType:'Quan hệ thương mại',managementMeasure:'Giải ngân và thu nợ theo từng hợp đồng.',source:'MANUAL'}
    ],
    conditions:conditionsFor(x.color),
    debts:debtsFor(x.color)
  };
}

function conditionsFor(color) {
  const tsbdActual = color === 'D' ? 91 : color === 'V' ? 106 : 115;
  const managementPeriod = color === 'D'
    ? {code:'2026-Q2',dueDate:'2026-07-15',performance:'Chưa cung cấp báo cáo kiểm tra sử dụng vốn.',actualValue:'',valueRecordedDate:'',recordedBy:'CB QTTD',completedDate:'',status:'QUA_HAN'}
    : color === 'V'
      ? {code:'2026-Q3',dueDate:'2026-08-30',performance:'Đang tổng hợp báo cáo quý III.',actualValue:'',valueRecordedDate:'',recordedBy:'CB QTTD',completedDate:'',status:'DANG_THUC_HIEN'}
      : {code:'2026-Q2',dueDate:'2026-06-30',performance:'Đã kiểm tra mục đích sử dụng vốn, kết quả tuân thủ.',actualValue:'',valueRecordedDate:'',recordedBy:'CB QTTD',completedDate:'2026-06-28',status:'DA_THUC_HIEN'};
  return [
    {group:'TSBD',type:'BPBD',content:'Khách hàng duy trì tỷ lệ giá trị tài sản bảo đảm trên hạn mức tín dụng tối thiểu 100% trong toàn bộ thời hạn cấp tín dụng.',frequency:'QUY',nature:'THEO_DOI',quantitativeIndicator:'TSBD_HMTD',threshold:100,monitoringStartDate:'2026-01-20',monitoringEndDate:'2027-01-20',source:'MANUAL',periods:[
      {code:'2026-Q3',dueDate:'2026-09-30',performance:`Tỷ lệ TSBĐ/HMTD ghi nhận là ${tsbdActual}%.`,actualValue:tsbdActual,valueRecordedDate:'2026-08-18',recordedBy:'Nguyễn Văn QTTD',completedDate:'2026-08-18',status:'DA_THUC_HIEN',overrideLevel:'',overrideReason:'',source:'MANUAL'}
    ]},
    {group:'DKTD',type:'QL_CAP_TD',content:'Chi nhánh kiểm tra mục đích sử dụng vốn, tình hình tài chính, dòng tiền và công nợ phải thu của khách hàng định kỳ hàng quý.',frequency:'QUY',nature:color==='D'?'TIEN_QUYET':'THEO_DOI',quantitativeIndicator:'',threshold:'',monitoringStartDate:'2026-01-20',monitoringEndDate:'2027-01-20',source:'MANUAL',periods:[managementPeriod]},
    {group:'DKTD',type:'TAI_CHINH',content:'Khách hàng chuyển doanh thu từ hoạt động kinh doanh về tài khoản mở tại BIDV và ưu tiên sử dụng các dịch vụ ngân hàng tại BIDV.',frequency:'QUY',nature:'THEO_DOI',quantitativeIndicator:'DOANH_THU_CHUYEN_VE',threshold:60,monitoringStartDate:'2026-01-20',monitoringEndDate:'2027-01-20',source:'MANUAL',periods:[
      {code:'2026-Q2',dueDate:'2026-06-30',performance:'Doanh thu chuyển về đạt 72% tổng doanh thu.',actualValue:72,valueRecordedDate:'2026-07-05',recordedBy:'Nguyễn Văn QTTD',completedDate:'2026-07-05',status:'DA_THUC_HIEN',overrideLevel:'',overrideReason:'',source:'MANUAL'}
    ]}
  ];
}

function debtsFor(color) {
  if (color === 'X') return [{debtDate:'2026-06-01',content:'Bổ sung chứng thư bảo hiểm tài sản bảo đảm.',documentType:'Bảo hiểm',commitmentDate:'2026-07-15',supplementedDate:'2026-07-10',status:'DA_BO_SUNG',levelType:'THEO_DOI',source:'MANUAL'}];
  if (color === 'V') return [{debtDate:'2026-08-01',content:'Bổ sung báo cáo tài chính bán niên 2026.',documentType:'Báo cáo tài chính',commitmentDate:'2026-08-31',supplementedDate:'',status:'CHUA_DEN_HAN',levelType:'THEO_DOI',source:'MANUAL'}];
  return [{debtDate:'2026-06-01',content:'Bổ sung hồ sơ pháp lý của tài sản bảo đảm tại dự án Minh Long.',documentType:'Hồ sơ pháp lý TSBĐ',commitmentDate:'2026-07-20',supplementedDate:'',status:'QUA_HAN',levelType:'TIEN_QUYET',source:'MANUAL'}];
}
