/**
 * @deprecated 此文件已弃用，请使用 api.js 代替
 */

/**
 * 云函数调用工具
 * 统一管理所有云函数调用，便于维护和错误处理
 */

var config = require('../config');
var errorHandler = require('./error');

/**
 * 调用云函数
 * @param {String} name - 云函数名称
 * @param {Object} data - 传递的数据
 * @param {Boolean} silent - 是否静默处理错误（默认false）
 * @returns {Promise} 返回云函数结果
 */
function callFunction(name, data, silent) {
  return wx.cloud.callFunction({
    name: name,
    data: data || {}
  }).then(function (res) {
    return res.result;
  }).catch(function (err) {
    if (!silent) {
      errorHandler.handleCloudError(err, name);
    }
    throw err;
  });
}

// ==================== 用户相关 ====================

/**
 * 用户登录
 * @returns {Promise} 返回用户信息
 */
function login() {
  return callFunction(config.cloudFunctions.login);
}

// ==================== 药品相关 ====================

/**
 * 获取药品列表
 * @returns {Promise} 返回药品列表
 */
function getMedications() {
  return callFunction(config.cloudFunctions.medication, { action: 'list' });
}

/**
 * 添加药品
 * @param {Object} medication - 药品信息
 * @returns {Promise} 返回添加结果
 */
function addMedication(medication) {
  return callFunction(config.cloudFunctions.medication, {
    action: 'add',
    medication: medication
  });
}

/**
 * 更新药品
 * @param {Object} medication - 药品信息（需包含id）
 * @returns {Promise} 返回更新结果
 */
function updateMedication(medication) {
  return callFunction(config.cloudFunctions.medication, {
    action: 'update',
    medication: medication
  });
}

/**
 * 删除药品
 * @param {String} id - 药品ID
 * @returns {Promise} 返回删除结果
 */
function deleteMedication(id) {
  return callFunction(config.cloudFunctions.medication, {
    action: 'delete',
    id: id
  });
}

// ==================== 提醒相关 ====================

/**
 * 获取今日提醒
 * @returns {Promise} 返回今日提醒列表
 */
function getTodayReminders() {
  return callFunction(config.cloudFunctions.reminder, {
    action: 'getToday'
  });
}

/**
 * 更新提醒状态
 * @param {String} id - 提醒ID
 * @param {String} status - 新状态
 * @returns {Promise} 返回更新结果
 */
function updateReminderStatus(id, status) {
  return callFunction(config.cloudFunctions.reminder, {
    action: 'updateStatus',
    id: id,
    status: status
  });
}

// ==================== 记录相关 ====================

/**
 * 添加服药记录
 * @param {Object} record - 记录信息
 * @returns {Promise} 返回添加结果
 */
function addRecord(record) {
  return callFunction(config.cloudFunctions.record, {
    action: 'add',
    record: record
  });
}

/**
 * 获取服药记录
 * @param {Object} params - 查询参数（如：date）
 * @returns {Promise} 返回记录列表
 */
function getRecords(params) {
  return callFunction(config.cloudFunctions.record, {
    action: 'list',
    params: params
  });
}

// ==================== 统计相关 ====================

/**
 * 获取统计数据
 * @param {Object} params - 查询参数（如：period）
 * @returns {Promise} 返回统计数据
 */
function getStatistics(params) {
  return callFunction(config.cloudFunctions.statistics, {
    action: 'get',
    params: params
  });
}

module.exports = {
  callFunction: callFunction,
  login: login,
  getMedications: getMedications,
  addMedication: addMedication,
  updateMedication: updateMedication,
  deleteMedication: deleteMedication,
  getTodayReminders: getTodayReminders,
  updateReminderStatus: updateReminderStatus,
  addRecord: addRecord,
  getRecords: getRecords,
  getStatistics: getStatistics
};
