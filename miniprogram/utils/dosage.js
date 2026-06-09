/**
 * 剂量解析工具函数
 */

/**
 * 解析剂量字符串，提取数值和单位
 * @param {string} dosageStr 剂量字符串，如 "1片"、"5ml"、"0.5粒"
 * @returns {object} { numeric: number, unit: string }
 */
function parseDosage(dosageStr) {
  if (!dosageStr) {
    return { numeric: 0, unit: '' };
  }

  // 匹配数字和单位
  var match = dosageStr.match(/^([\d.]+)\s*([a-zA-Z\u4e00-\u9fa5]+)$/);
  if (match) {
    return {
      numeric: parseFloat(match[1]),
      unit: match[2]
    };
  }

  // 只有数字
  var numMatch = dosageStr.match(/^([\d.]+)$/);
  if (numMatch) {
    return {
      numeric: parseFloat(numMatch[1]),
      unit: ''
    };
  }

  return { numeric: 0, unit: '' };
}

/**
 * 获取剂量数值（用于库存计算）
 */
function getNumericDosage(dosageStr) {
  var result = parseDosage(dosageStr);
  return result.numeric;
}

/**
 * 获取剂量单位
 */
function getDosageUnit(dosageStr) {
  var result = parseDosage(dosageStr);
  return result.unit;
}

/**
 * 验证剂量格式是否有效
 */
function isValidDosage(dosageStr) {
  if (!dosageStr) return false;
  var result = parseDosage(dosageStr);
  return result.numeric > 0;
}

/**
 * 构建剂量字符串
 * @param {number} numeric 数值
 * @param {string} unit 单位
 * @returns {string}
 */
function buildDosage(numeric, unit) {
  if (!numeric || numeric <= 0) return '';
  return numeric + (unit || '');
}

/**
 * 常用剂量单位列表
 */
var COMMON_UNITS = ['片', '粒', '袋', '支', 'ml', 'mg', 'g', '滴', '颗', '揿'];

module.exports = {
  parseDosage: parseDosage,
  getNumericDosage: getNumericDosage,
  getDosageUnit: getDosageUnit,
  isValidDosage: isValidDosage,
  buildDosage: buildDosage,
  COMMON_UNITS: COMMON_UNITS
};
