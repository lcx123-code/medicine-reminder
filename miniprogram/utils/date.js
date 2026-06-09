/**
 * 日期处理工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  if (!date) return '';
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * 格式化时间为 HH:mm
 */
function formatTime(date) {
  if (!date) return '';
  var d = new Date(date);
  var hours = ('0' + d.getHours()).slice(-2);
  var minutes = ('0' + d.getMinutes()).slice(-2);
  return hours + ':' + minutes;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm
 */
function formatDateTime(date) {
  if (!date) return '';
  return formatDate(date) + ' ' + formatTime(date);
}

/**
 * 获取今天的日期字符串
 */
function getToday() {
  return formatDate(new Date());
}

/**
 * 获取当前时间字符串 HH:mm
 */
function getCurrentTime() {
  return formatTime(new Date());
}

/**
 * 判断是否是今天
 */
function isToday(date) {
  if (!date) return false;
  var d = new Date(date);
  var today = new Date();
  return d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();
}

/**
 * 判断是否已过期（时间已过）
 */
function isPastTime(timeStr) {
  if (!timeStr) return false;
  var now = new Date();
  var parts = timeStr.split(':');
  var hours = parseInt(parts[0]);
  var minutes = parseInt(parts[1]);
  return now.getHours() > hours || (now.getHours() === hours && now.getMinutes() > minutes);
}

/**
 * 获取星期几（中文）
 */
function getWeekDay(date) {
  var days = ['日', '一', '二', '三', '四', '五', '六'];
  var d = new Date(date);
  return '周' + days[d.getDay()];
}

/**
 * 计算两个日期之间的天数差
 */
function daysBetween(date1, date2) {
  var d1 = new Date(date1);
  var d2 = new Date(date2);
  var diff = Math.abs(d2.getTime() - d1.getTime());
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 添加天数
 */
function addDays(date, days) {
  var d = new Date(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/**
 * 判断用药是否已结束
 * @param {string} startDate 开始日期 YYYY-MM-DD
 * @param {number} duration 用药天数（0表示长期）
 * @returns {boolean}
 */
function isMedicationEnded(startDate, duration) {
  if (!startDate || duration === 0) return false;
  var start = new Date(startDate);
  var end = addDays(start, duration);
  var today = getToday();
  return today > end;
}

/**
 * 获取用药已进行的天数
 */
function getMedicationDays(startDate) {
  if (!startDate) return 0;
  var start = new Date(startDate);
  var today = new Date();
  return daysBetween(start, today);
}

module.exports = {
  formatDate: formatDate,
  formatTime: formatTime,
  formatDateTime: formatDateTime,
  getToday: getToday,
  getCurrentTime: getCurrentTime,
  isToday: isToday,
  isPastTime: isPastTime,
  getWeekDay: getWeekDay,
  daysBetween: daysBetween,
  addDays: addDays,
  isMedicationEnded: isMedicationEnded,
  getMedicationDays: getMedicationDays
};
