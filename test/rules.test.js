'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { scoreCondition, scoreDebt, rollup } = require('../rules');

const params = { n1:15, n2:30, marginPct:5 };

test('định lượng được ưu tiên trước trạng thái đã thực hiện', () => {
  const result = scoreCondition(
    { quantitativeIndicator:'TSBD_HMTD', threshold:100, nature:'THEO_DOI' },
    { actualValue:92, status:'DA_THUC_HIEN', dueDate:'2026-08-30', completedDate:'2026-08-20' },
    params, '2026-08-21');
  assert.equal(result.level, 'D');
});

test('điều kiện sắp đến hạn chuyển vàng theo N1', () => {
  const result = scoreCondition({ nature:'THEO_DOI' }, { status:'CHUA_DEN_HAN', dueDate:'2026-08-30' }, params, '2026-08-21');
  assert.equal(result.level, 'V');
  assert.equal(result.dayDelta, 9);
});

test('điều kiện tiên quyết quá hạn chuyển đỏ ngay', () => {
  const result = scoreCondition({ nature:'TIEN_QUYET' }, { status:'DANG_THUC_HIEN', dueDate:'2026-08-20' }, params, '2026-08-21');
  assert.equal(result.level, 'D');
});

test('điều kiện nợ đã bổ sung đúng hạn là xanh', () => {
  const result = scoreDebt({ levelType:'TIEN_QUYET', commitmentDate:'2026-08-20', supplementedDate:'2026-08-19' }, params, '2026-08-21');
  assert.equal(result.level, 'X');
});

test('rollup ưu tiên đỏ rồi vàng rồi xanh', () => {
  assert.equal(rollup(['X','V','D']), 'D');
  assert.equal(rollup(['X','V']), 'V');
  assert.equal(rollup([]), 'X');
});
