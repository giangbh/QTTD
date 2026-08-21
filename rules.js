'use strict';

const LEVEL = { GREEN: 'X', AMBER: 'V', RED: 'D' };

function utcDay(value) {
  if (!value) return null;
  return Date.parse(`${value}T00:00:00Z`) / 86400000;
}

function scoreCondition(condition, period, params, evaluationDate) {
  const n1 = Number(params?.n1 ?? 15);
  const n2 = Number(params?.n2 ?? 30);
  const margin = Number(params?.marginPct ?? 5);
  if (!period) return result('X', 'Chưa phát sinh kỳ theo dõi', null);
  if (period.overrideLevel) return result(period.overrideLevel, `Ghi đè thủ công: ${period.overrideReason || 'không nêu lý do'}`, null);
  if (period.status === 'MIEN_GIAM') return result('X', 'Được cấp phê duyệt miễn giảm', null);

  const actual = numberOrNull(period.actualValue);
  const threshold = numberOrNull(condition.threshold);
  if (condition.quantitativeIndicator && actual !== null && threshold !== null) {
    if (actual >= threshold) return result('X', `Giá trị ${actual} đạt ngưỡng ${threshold}`, null);
    if (actual >= threshold * (1 - margin / 100)) return result('V', `Giá trị ${actual} nằm trong biên ${margin}% dưới ngưỡng ${threshold}`, null);
    return result('D', `Giá trị ${actual} thấp hơn ngưỡng ${threshold}`, null);
  }

  if (period.status === 'DA_THUC_HIEN') {
    const delay = period.completedDate && period.dueDate ? utcDay(period.completedDate) - utcDay(period.dueDate) : 0;
    if (delay <= 0) return result('X', 'Đã thực hiện đúng hạn', delay);
    if (condition.nature !== 'TIEN_QUYET' && delay <= n2) return result('V', `Hoàn thành chậm ${delay} ngày`, -delay);
    return result('D', `Hoàn thành chậm ${delay} ngày`, -delay);
  }
  if (!period.dueDate) return result('X', 'Chưa có ngày đến hạn', null);
  const remaining = utcDay(period.dueDate) - utcDay(evaluationDate);
  if (remaining >= 0) return remaining <= n1
    ? result('V', `Còn ${remaining} ngày đến hạn`, remaining)
    : result('X', `Còn ${remaining} ngày đến hạn`, remaining);
  const overdue = Math.abs(remaining);
  if (condition.nature !== 'TIEN_QUYET' && overdue <= n2) return result('V', `Quá hạn ${overdue} ngày`, remaining);
  return result('D', `Quá hạn ${overdue} ngày`, remaining);
}

function scoreDebt(debt, params, evaluationDate) {
  const n1 = Number(params?.n1 ?? 15);
  const n2 = Number(params?.n2 ?? 30);
  const prerequisite = debt.levelType === 'TIEN_QUYET';
  if (debt.supplementedDate) {
    const delay = utcDay(debt.supplementedDate) - utcDay(debt.commitmentDate);
    if (delay <= 0) return result('X', 'Đã bổ sung đúng hạn', delay);
    if (!prerequisite && delay <= n2) return result('V', `Bổ sung chậm ${delay} ngày`, -delay);
    return result('D', `Bổ sung chậm ${delay} ngày`, -delay);
  }
  if (!debt.commitmentDate) return result('X', 'Chưa có ngày cam kết', null);
  const remaining = utcDay(debt.commitmentDate) - utcDay(evaluationDate);
  if (remaining >= 0) return remaining <= n1
    ? result('V', `Còn ${remaining} ngày đến hạn`, remaining)
    : result('X', `Còn ${remaining} ngày đến hạn`, remaining);
  const overdue = Math.abs(remaining);
  if (!prerequisite && overdue <= n2) return result('V', `Quá hạn ${overdue} ngày`, remaining);
  return result('D', `Quá hạn ${overdue} ngày`, remaining);
}

function rollup(levels) {
  return levels.includes('D') ? 'D' : levels.includes('V') ? 'V' : 'X';
}

function numberOrNull(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function result(level, reason, dayDelta) { return { level, reason, dayDelta }; }

module.exports = { LEVEL, scoreCondition, scoreDebt, rollup };
