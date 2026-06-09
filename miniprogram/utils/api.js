/**
 * 云函数调用封装
 */

/**
 * 调用云函数
 * @param {string} name 云函数名称
 * @param {object} data 参数
 * @returns {Promise}
 */
function callFunction(name, data) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: name,
      data: data || {},
      success: function (res) {
        if (res.result && res.result.code === 0) {
          resolve(res.result);
        } else if (res.result) {
          reject(res.result);
        } else {
          resolve(res.result);
        }
      },
      fail: function (err) {
        console.error('调用云函数失败:', name, err);
        reject(err);
      }
    });
  });
}

/**
 * 登录
 */
function login() {
  return callFunction('login');
}

/**
 * 添加药品
 */
function addMedication(data) {
  return callFunction('medication', { action: 'add', data: data });
}

/**
 * 更新药品
 */
function updateMedication(data) {
  return callFunction('medication', { action: 'update', data: data });
}

/**
 * 删除药品
 */
function deleteMedication(id) {
  return callFunction('medication', { action: 'delete', data: { id: id } });
}

/**
 * 获取药品列表
 */
function getMedications() {
  return callFunction('medication', { action: 'getList' });
}

/**
 * 创建提醒
 */
function createReminder(data) {
  return callFunction('reminder', { action: 'create', data: data });
}

/**
 * 获取今日提醒
 */
function getTodayReminders() {
  return callFunction('reminder', { action: 'getToday' });
}

/**
 * 添加服药记录
 */
function addRecord(data) {
  return callFunction('record', { action: 'add', data: data });
}

/**
 * 获取服药记录
 */
function getRecords(data) {
  return callFunction('record', { action: 'getList', data: data });
}

/**
 * 获取统计数据
 */
function getStatistics(data) {
  return callFunction('statistics', { action: 'get', data: data });
}

/**
 * 同步今日提醒
 * 为缺少今日提醒的活跃药品自动补建提醒记录
 */
function syncTodayReminders() {
  return callFunction('medication', { action: 'syncTodayReminders' });
}

function toggleMedicationStatus(id, isActive) {
  return callFunction('medication', {
    action: 'toggleStatus',
    data: { id: id, isActive: isActive }
  });
}

module.exports = {
  callFunction: callFunction,
  login: login,
  addMedication: addMedication,
  updateMedication: updateMedication,
  deleteMedication: deleteMedication,
  getMedications: getMedications,
  createReminder: createReminder,
  getTodayReminders: getTodayReminders,
  addRecord: addRecord,
  getRecords: getRecords,
  getStatistics: getStatistics,
  syncTodayReminders: syncTodayReminders,
  toggleMedicationStatus: toggleMedicationStatus
};
