// 云函数入口文件 - medication
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

var helper = require('./helpers');

/**
 * 解析剂量字符串，提取数值
 * @param {string} dosageStr 剂量字符串，如 "1片"、"5ml"
 * @returns {number}
 */
function parseNumericDosage(dosageStr) {
  if (!dosageStr) return 0;
  var match = dosageStr.match(/^([\d.]+)/);
  if (match) {
    return parseFloat(match[1]);
  }
  return 0;
}

/**
 * 创建提醒记录
 * @param {string} userId 用户ID
 * @param {string} medicationId 药品ID
 * @param {Array} times 提醒时间数组 ["08:30", "12:00"]
 * @param {string} startDate 开始日期
 * @param {number} duration 用药天数
 */
async function createRemindersForMedication(userId, medicationId, times, startDate, duration, timezoneOffset) {
  if (!times || times.length === 0) return;

  var today = new Date();
  var todayStr = helper.formatDate(today);

  console.log('创建提醒: medicationId=', medicationId, 'times=', JSON.stringify(times));

  for (var i = 0; i < times.length; i++) {
    var scheduledTime = helper.calcScheduledTime(todayStr, times[i], timezoneOffset);

    await db.collection('reminders').add({
      data: {
        userId: userId,
        medicationId: medicationId,
        scheduledTime: scheduledTime,
        timeStr: times[i],
        status: 'pending',
        createdAt: db.serverDate()
      }
    });

    console.log('已创建提醒:', times[i]);
  }

  // 写后验证
  var countRes = await db.collection('reminders')
    .where({ medicationId: medicationId, status: 'pending' })
    .count();
  console.log('验证: 共', countRes.total, '条, 期望', times.length, '条');
  if (countRes.total !== times.length) {
    console.error('创建数量不匹配! medicationId=', medicationId);
  }
}

/**
 * 添加药品
 */
async function addMedication(userId, data) {
  // 解析剂量数值
  var numericDosage = parseNumericDosage(data.dosage);

  var medication = {
    userId: userId,
    name: data.name,
    dosage: data.dosage,
    numericDosage: numericDosage,
    stockUnit: data.stockUnit || '片',
    stockEnabled: data.stockEnabled !== false,
    frequency: data.frequency,
    times: data.times || [],
    stock: data.stock || 0,
    stockWarning: data.stockWarning || 10,
    duration: data.duration || 0,
    startDate: data.startDate || helper.formatDate(new Date()),
    timezoneOffset: data.timezoneOffset || new Date().getTimezoneOffset(),
    isActive: true,
    stockWarningSentDate: '',
    createdAt: db.serverDate()
  };

  var result = await db.collection('medications').add({ data: medication });

  // 创建提醒记录（仅当 startDate 已到或从今天开始）
  var todayStr = helper.formatDate(new Date());
  if (!medication.startDate || medication.startDate <= todayStr) {
    await createRemindersForMedication(
      userId,
      result._id,
      data.times,
      medication.startDate,
      data.duration,
      data.timezoneOffset
    );
  }

  return {
    code: 0,
    data: { _id: result._id }
  };
}

/**
 * 更新药品
 */
async function updateMedication(userId, data) {
  var id = data.id;
  var timezoneOffset = data.timezoneOffset;
  delete data.id;
  // 保留 timezoneOffset，确保存储到药品文档
  data.timezoneOffset = timezoneOffset;

  if (data.dosage) {
    data.numericDosage = parseNumericDosage(data.dosage);
  }

  data.stockWarningSentDate = '';
  data.updatedAt = db.serverDate();

  await db.collection('medications').doc(id).update({ data: data });

  var today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.collection('reminders').where({
    medicationId: id,
    status: _.in(['pending', 'sent']),
    scheduledTime: _.gte(today)
  }).remove();

  if (data.times && data.times.length > 0) {
    await createRemindersForMedication(
      userId, id, data.times,
      data.startDate || helper.formatDate(new Date()),
      data.duration || 0,
      timezoneOffset
    );
  }

  return { code: 0, message: '更新成功' };
}

/**
 * 删除药品
 */
async function deleteMedication(userId, id) {
  // 删除药品
  await db.collection('medications').doc(id).remove();

  // 删除该药品的所有提醒（不限状态）
  await db.collection('reminders').where({
    medicationId: id
  }).remove();

  // 同步删除关联的服药记录
  await db.collection('records').where({
    medicationId: id
  }).remove();

  return {
    code: 0,
    message: '删除成功'
  };
}

/**
 * 获取药品列表
 */
async function getMedications(userId) {
  var result = await db.collection('medications')
    .where({ userId: userId })
    .orderBy('createdAt', 'desc')
    .get();

  return {
    code: 0,
    data: result.data
  };
}

/**
 * 同步今日提醒
 * 为缺少今日提醒的活跃药品自动补建提醒记录
 */
async function syncTodayReminders(userId) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. 获取所有启用的药品
  var medicationsRes = await db.collection('medications')
    .where({ userId: userId, isActive: true })
    .get();

  var medications = medicationsRes.data;
  var created = 0;

  for (var i = 0; i < medications.length; i++) {
    var med = medications[i];
    if (!med.times || med.times.length === 0) continue;

    // 2. 检查该药品今日是否已有提醒
    var existing = await db.collection('reminders')
      .where({
        medicationId: med._id,
        scheduledTime: _.gte(today).and(_.lt(tomorrow))
      })
      .count();

    if (existing.total > 0) continue; // 已有今日提醒，跳过

    // 3. 检查用药周期是否覆盖今天
    if (med.duration > 0 && med.startDate) {
      var startDate = new Date(med.startDate);
      var endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + med.duration);
      if (today >= endDate) continue; // 已过用药周期
    }

    // 4. 补建今日所有提醒
    for (var j = 0; j < med.times.length; j++) {
      var scheduledTime = helper.calcScheduledTime(helper.formatDate(today), med.times[j], med.timezoneOffset || 0);

      await db.collection('reminders').add({
        data: {
          userId: userId,
          medicationId: med._id,
          scheduledTime: scheduledTime,
          timeStr: med.times[j],
          status: 'pending',
          createdAt: db.serverDate()
        }
      });
      created++;
    }
  }

  return { code: 0, data: { created: created } };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    switch (action) {
      case 'add':
        return await addMedication(openid, event.data);
      case 'update':
        return await updateMedication(openid, event.data);
      case 'delete':
        return await deleteMedication(openid, event.data.id);
      case 'getList':
        return await getMedications(openid);
      case 'toggleStatus':
        await db.collection('medications').doc(event.data.id).update({
          data: { isActive: event.data.isActive, updateTime: db.serverDate() }
        });
        if (!event.data.isActive) {
          await db.collection('reminders')
            .where({ medicationId: event.data.id, status: 'pending' })
            .update({ data: { status: 'cancelled' } });
        } else {
          // 删掉停用时产生的 cancelled 提醒
          await db.collection('reminders').where({
            medicationId: event.data.id,
            status: 'cancelled'
          }).remove();

          // 检查今日是否有提醒，无则创建
          var todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          var todayEnd = new Date(todayStart);
          todayEnd.setDate(todayEnd.getDate() + 1);
          var existing = await db.collection('reminders')
            .where({ medicationId: event.data.id, scheduledTime: _.gte(todayStart).and(_.lt(todayEnd)) })
            .count();
          if (existing.total === 0) {
            var medRes = await db.collection('medications').doc(event.data.id).get();
            var med = medRes.data;
            if (med && med.times && med.times.length > 0) {
              await createRemindersForMedication(openid, event.data.id, med.times,
                helper.formatDate(new Date()), med.duration || 0, med.timezoneOffset || -480);
            }
          }
        }
        return { code: 0, message: 'ok' };
      case 'syncTodayReminders':
        return await syncTodayReminders(openid);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('药品操作失败:', err);
    return {
      code: -1,
      message: '操作失败'
    };
  }
};
