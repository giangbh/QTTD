PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS danh_muc (
  id INTEGER PRIMARY KEY,
  loai TEXT NOT NULL,
  ma TEXT NOT NULL,
  ten TEXT NOT NULL,
  thu_tu INTEGER NOT NULL DEFAULT 0,
  hieu_luc INTEGER NOT NULL DEFAULT 1,
  mac_dinh INTEGER NOT NULL DEFAULT 0,
  UNIQUE (loai, ma)
);

INSERT OR IGNORE INTO danh_muc(loai,ma,ten,thu_tu,mac_dinh) VALUES
('LOAI_HINH_KH','CA_NHAN','Cá nhân',1,0),
('LOAI_HINH_KH','HO_KINH_DOANH','Hộ kinh doanh',2,0),
('LOAI_HINH_KH','DOANH_NGHIEP','Doanh nghiệp',3,1),
('TRANG_THAI_HO_SO','NHAP','Nháp',1,1),
('TRANG_THAI_HO_SO','HIEU_LUC','Hiệu lực',2,0),
('TRANG_THAI_HO_SO','DONG','Đóng',3,0),
('CAP_PHE_DUYET','GIAM_DOC_CAP_1','Giám đốc phê duyệt cấp 1',1,1),
('CAP_PHE_DUYET','PHO_GIAM_DOC_CAP_2','Phó Giám đốc phê duyệt cấp 2',2,0),
('CAP_PHE_DUYET','HOI_DONG_CO_SO','Hội đồng tín dụng cơ sở',3,0),
('CAP_PHE_DUYET','TRU_SO_CHINH','Trụ sở chính',4,0),
('DONG_TIEN','VND','VNĐ',1,1),
('DONG_TIEN','FOREIGN','Ngoại tệ',2,0),
('DONG_TIEN','MIXED','VNĐ + Ngoại tệ',3,0),
('DON_VI_HIEN_THI','TRIEU','Triệu đồng',1,1),
('DON_VI_HIEN_THI','TY','Tỷ đồng',2,0),
('CO_KHONG','false','Không',1,1),
('CO_KHONG','true','Có',2,0),
('LOAI_DK_TSBD','BPBD','BPBĐ',1,1),
('LOAI_DK_DKTD','TAI_CHINH','Tài chính',1,0),
('LOAI_DK_DKTD','QL_CAP_TD','Quản lý cấp tín dụng',2,1),
('LOAI_DK_DKTD','KHAC','Khác',3,0),
('TAN_SUAT','TUNG_LAN','Từng lần',1,1),
('TAN_SUAT','MOT_LAN','1 lần',2,0),
('TAN_SUAT','THANG','Tháng',3,0),
('TAN_SUAT','QUY','Quý',4,0),
('TAN_SUAT','SAU_THANG','6 tháng',5,0),
('TAN_SUAT','NAM','Năm',6,0),
('TAN_SUAT','KHAC','Khác',7,0),
('TINH_CHAT_DK','THEO_DOI','Điều kiện theo dõi',1,1),
('TINH_CHAT_DK','TIEN_QUYET','Điều kiện tiên quyết',2,0),
('CHI_TIEU_DINH_LUONG','','Không áp dụng',1,1),
('CHI_TIEU_DINH_LUONG','TSBD_HMTD','TSBĐ/HMTD',2,0),
('CHI_TIEU_DINH_LUONG','DOANH_THU_CHUYEN_VE','Doanh thu chuyển về',3,0),
('CHI_TIEU_DINH_LUONG','KHAC','Khác',4,0),
('TINH_TRANG_KY','CHUA_DEN_HAN','Chưa đến hạn',1,1),
('TINH_TRANG_KY','DANG_THUC_HIEN','Đang thực hiện',2,0),
('TINH_TRANG_KY','DA_THUC_HIEN','Đã thực hiện',3,0),
('TINH_TRANG_KY','QUA_HAN','Quá hạn',4,0),
('TINH_TRANG_KY','MIEN_GIAM','Miễn giảm',5,0),
('MUC_GHI_DE','','Không',1,1),
('MUC_GHI_DE','X','Xanh',2,0),
('MUC_GHI_DE','V','Vàng',3,0),
('MUC_GHI_DE','D','Đỏ',4,0),
('TINH_TRANG_NO','CHUA_DEN_HAN','Chưa đến hạn',1,1),
('TINH_TRANG_NO','QUA_HAN','Quá hạn',2,0),
('TINH_TRANG_NO','DA_BO_SUNG','Đã bổ sung',3,0),
('MUC_DIEU_KIEN','THEO_DOI','Theo dõi',1,1),
('MUC_DIEU_KIEN','TIEN_QUYET','Tiên quyết',2,0);

CREATE TABLE IF NOT EXISTS nguoi_dung (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  ho_ten TEXT NOT NULL,
  chuc_vu TEXT,
  ma_chi_nhanh TEXT,
  hieu_luc INTEGER NOT NULL DEFAULT 1,
  ngay_tao TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS phien_dang_nhap (
  token TEXT PRIMARY KEY,
  id_nguoi_dung INTEGER NOT NULL REFERENCES nguoi_dung(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  het_han TEXT NOT NULL,
  ngay_tao TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS khach_hang (
  id INTEGER PRIMARY KEY,
  cif TEXT NOT NULL UNIQUE,
  ten_khach_hang TEXT NOT NULL,
  loai_hinh_kh TEXT NOT NULL,
  so_gcn_dkkd TEXT,
  ngay_cap_dkkd TEXT,
  ma_so_thue TEXT,
  xhtd_hang TEXT,
  xhtd_ky TEXT,
  nguoi_dai_dien_pl TEXT,
  nguoi_duoc_uy_quyen TEXT,
  ke_toan_truong TEXT,
  luu_y_khac TEXT,
  ma_chi_nhanh TEXT NOT NULL,
  ten_chi_nhanh TEXT NOT NULL,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL',
  nguoi_tao_id INTEGER REFERENCES nguoi_dung(id),
  nguoi_sua_id INTEGER REFERENCES nguoi_dung(id),
  ngay_tao TEXT NOT NULL,
  ngay_sua TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ho_so_cap_td (
  id INTEGER PRIMARY KEY,
  ma_ho_so TEXT UNIQUE,
  id_khach_hang INTEGER NOT NULL REFERENCES khach_hang(id),
  so_qd_cap_td TEXT NOT NULL,
  ngay_qd_cap_td TEXT NOT NULL,
  cap_phe_duyet TEXT NOT NULL,
  so_hdtd TEXT NOT NULL UNIQUE,
  ngay_hdtd TEXT NOT NULL,
  so_tien_vnd NUMERIC NOT NULL CHECK (so_tien_vnd > 0),
  don_vi_hien_thi TEXT NOT NULL DEFAULT 'TRIEU',
  dong_tien TEXT,
  ngay_het_han TEXT NOT NULL,
  muc_dich TEXT NOT NULL,
  linh_vuc_kd TEXT NOT NULL,
  nhu_cau_vld NUMERIC,
  thong_tin_bo_sung TEXT,
  quan_he_tctd TEXT,
  co_nkhlq INTEGER NOT NULL DEFAULT 0,
  co_doi_tac_luu_y INTEGER NOT NULL DEFAULT 0,
  khlq_ghi_chu TEXT,
  trang_thai_ho_so TEXT NOT NULL DEFAULT 'NHAP',
  ngay_lap TEXT NOT NULL,
  so_van_ban TEXT,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL',
  version INTEGER NOT NULL DEFAULT 0,
  nguoi_tao_id INTEGER REFERENCES nguoi_dung(id),
  nguoi_sua_id INTEGER REFERENCES nguoi_dung(id),
  ngay_tao TEXT NOT NULL,
  ngay_sua TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS co_cau_von (
  id INTEGER PRIMARY KEY,
  id_khach_hang INTEGER NOT NULL REFERENCES khach_hang(id) ON DELETE CASCADE,
  ten_thanh_vien TEXT NOT NULL,
  loai_thanh_vien TEXT,
  gia_tri_von_gop NUMERIC NOT NULL DEFAULT 0,
  ty_le_pct NUMERIC NOT NULL DEFAULT 0,
  thu_tu INTEGER NOT NULL,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL'
);

CREATE TABLE IF NOT EXISTS doi_tac_lien_quan (
  id INTEGER PRIMARY KEY,
  id_ho_so INTEGER NOT NULL REFERENCES ho_so_cap_td(id) ON DELETE CASCADE,
  ten_doi_tac TEXT NOT NULL,
  cif_doi_tac TEXT,
  ma_so_thue TEXT,
  loai_quan_he TEXT,
  bien_phap_quan_ly TEXT,
  thu_tu INTEGER NOT NULL,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL'
);

CREATE TABLE IF NOT EXISTS dieu_kien (
  id INTEGER PRIMARY KEY,
  id_ho_so INTEGER NOT NULL REFERENCES ho_so_cap_td(id) ON DELETE CASCADE,
  nhom_dk TEXT NOT NULL CHECK (nhom_dk IN ('TSBD', 'DKTD')),
  loai_dk TEXT NOT NULL,
  thu_tu INTEGER NOT NULL,
  noi_dung_dk TEXT NOT NULL,
  tan_suat TEXT NOT NULL,
  tinh_chat_dk TEXT NOT NULL,
  chi_tieu_dinh_luong TEXT,
  nguong_yeu_cau NUMERIC,
  ngay_bat_dau_theo_doi TEXT,
  ngay_ket_thuc_theo_doi TEXT,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL'
);

CREATE TABLE IF NOT EXISTS ky_theo_doi_dk (
  id INTEGER PRIMARY KEY,
  id_dieu_kien INTEGER NOT NULL REFERENCES dieu_kien(id) ON DELETE CASCADE,
  ky_theo_doi TEXT NOT NULL,
  ngay_den_han TEXT,
  tinh_hinh_thuc_hien TEXT,
  gia_tri_thuc_te NUMERIC,
  ngay_ghi_nhan_gia_tri TEXT,
  nguoi_ghi_nhan TEXT,
  ngay_thuc_hien TEXT,
  tinh_trang TEXT NOT NULL,
  muc_dk_ghi_de TEXT,
  ly_do_ghi_de TEXT,
  nguon_gia_tri TEXT NOT NULL DEFAULT 'MANUAL',
  UNIQUE (id_dieu_kien, ky_theo_doi)
);

CREATE TABLE IF NOT EXISTS dieu_kien_no (
  id INTEGER PRIMARY KEY,
  id_ho_so INTEGER NOT NULL REFERENCES ho_so_cap_td(id) ON DELETE CASCADE,
  stt INTEGER NOT NULL,
  ngay_no TEXT NOT NULL,
  noi_dung TEXT NOT NULL,
  loai_ho_so_no TEXT,
  ngay_cam_ket_bs TEXT NOT NULL,
  ngay_bo_sung_hs TEXT,
  tinh_trang TEXT NOT NULL,
  muc_dieu_kien TEXT NOT NULL,
  nguon_du_lieu TEXT NOT NULL DEFAULT 'MANUAL'
);

CREATE TABLE IF NOT EXISTS nhat_ky_he_thong (
  id INTEGER PRIMARY KEY,
  thoi_diem TEXT NOT NULL,
  hanh_dong TEXT NOT NULL,
  bang TEXT NOT NULL,
  id_ban_ghi INTEGER NOT NULL,
  id_nguoi_dung INTEGER REFERENCES nguoi_dung(id),
  ho_ten_nguoi_dung TEXT,
  gia_tri_cu TEXT,
  gia_tri_moi TEXT,
  chi_tiet_thay_doi TEXT
);

CREATE TABLE IF NOT EXISTS dong_bo_log (
  id INTEGER PRIMARY KEY,
  thoi_diem TEXT NOT NULL,
  he_thong_nguon TEXT NOT NULL,
  trang_thai TEXT NOT NULL,
  chi_tiet TEXT
);

CREATE INDEX IF NOT EXISTS idx_ho_so_khach_hang ON ho_so_cap_td(id_khach_hang);
CREATE INDEX IF NOT EXISTS idx_ho_so_so_hdtd ON ho_so_cap_td(so_hdtd);
CREATE INDEX IF NOT EXISTS idx_ho_so_ma ON ho_so_cap_td(ma_ho_so);
CREATE INDEX IF NOT EXISTS idx_ho_so_ngay_sua ON ho_so_cap_td(ngay_sua DESC);
CREATE INDEX IF NOT EXISTS idx_khach_hang_cif ON khach_hang(cif);
CREATE INDEX IF NOT EXISTS idx_khach_hang_ten ON khach_hang(ten_khach_hang);
CREATE INDEX IF NOT EXISTS idx_dieu_kien_ho_so ON dieu_kien(id_ho_so, nhom_dk, thu_tu);
CREATE INDEX IF NOT EXISTS idx_ky_den_han ON ky_theo_doi_dk(ngay_den_han, tinh_trang);
CREATE INDEX IF NOT EXISTS idx_no_ho_so ON dieu_kien_no(id_ho_so, stt);
CREATE INDEX IF NOT EXISTS idx_phien_dang_nhap_user ON phien_dang_nhap(id_nguoi_dung);
CREATE INDEX IF NOT EXISTS idx_nhat_ky_ban_ghi ON nhat_ky_he_thong(bang, id_ban_ghi);


