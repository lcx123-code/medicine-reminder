// 云函数入口文件 - reminder
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 创建提醒
 */
async function createReminder(userId, data) {
  var reminder = {
    userId: userId,
    medicationId: data.medicationId,
    scheduledTime: new Date(data.scheduledTime),
    status: 'pending',
    createdAt: db.serverDate()
  };

  var result = await db.collection('reminders').add({ data: reminder });

  return {
    code: 0,
    data: { _id: result._id }
  };
}

/**
 * 获取今日提醒
 */
async function getTodayReminders(userId) {
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 获取今日提醒
  var remindersRes = await db.collection('reminders')
    .where({ userId: userId, scheduledTime: _.gte(today).and(_.lt(tomorrow)) })
    .orderBy('scheduledTime', 'asc').get();
  var reminders = remindersRes.data;

  // 数据迁移：修复缺少 timezoneOffset 的旧药品
  var needMigrate = await db.collection('medications')
    .where({ userId: userId, isActive: true, timezoneOffset: _.exists(false) })
    .field({ _id: true }).get();
  if (needMigrate.data.length > 0) {
    console.log('开始数据迁移，修复', needMigrate.data.length, '个药品');
    for (var mm = 0; mm < needMigrate.data.length; mm++) {
      var mid = needMigrate.data[mm]._id;
      await db.collection('medications').doc(mid).update({
        data: { timezoneOffset: -480 }
      });
      await db.collection('reminders').where({
        medicationId: mid, status: _.in(['pending', 'sent']), scheduledTime: _.gte(today)
      }).remove();
      console.log('迁移:', mid);
    }
  }

  // 迁移后重新获取今日提醒（旧数据已被删除）
  var refreshRes = await db.collection('reminders')
    .where({ userId: userId, scheduledTime: _.gte(today).and(_.lt(tomorrow)) })
    .orderBy('scheduledTime', 'asc').get();
  reminders = refreshRes.data;

  // 收集已有 medicationId
  var existingMedIds = [];
  for (var i = 0; i < reminders.length; i++) {
    if (existingMedIds.indexOf(reminders[i].medicationId) === -1)
      existingMedIds.push(reminders[i].medicationId);
  }

  // 清理重复：删除已有 completed/acknowledged 同药品同时间的 pending
  for (var i = reminders.length - 1; i >= 0; i--) {
    if (reminders[i].status !== 'pending') continue;
    for (var j = 0; j < reminders.length; j++) {
      if (reminders[j].medicationId === reminders[i].medicationId &&
          reminders[j].timeStr === reminders[i].timeStr &&
          (reminders[j].status === 'completed' || reminders[j].status === 'acknowledged')) {
        await db.collection('reminders').doc(reminders[i]._id).remove();
        reminders.splice(i, 1);
        break;
      }
    }
  }

  // 获取所有活跃药品（供幽灵清理和自愈共用）
  var medsRes = await db.collection('medications')
    .where({ userId: userId, isActive: true }).get();
  var medsMap = {};
  for (var mi = 0; mi < medsRes.data.length; mi++) {
    medsMap[medsRes.data[mi]._id] = medsRes.data[mi];
  }

  // 清理幽灵提醒：删除 timeStr 不在药品 times 数组中的提醒及其关联记录
  for (var i = reminders.length - 1; i >= 0; i--) {
    var med = medsMap[reminders[i].medicationId];
    if (med && med.times && med.times.indexOf(reminders[i].timeStr) === -1) {
      var ghostId = reminders[i]._id;
      await db.collection('records').where({ reminderId: ghostId }).remove();
      await db.collection('reminders').doc(ghostId).remove();
      console.log('清理幽灵数据:', ghostId, 'timeStr:', reminders[i].timeStr);
      reminders.splice(i, 1);
    }
  }

  // 清理孤儿记录：reminderId 指向已删除提醒的服药记录
  var recordsRes = await db.collection('records')
    .where({ userId: userId, createdAt: _.gte(today).and(_.lt(tomorrow)) })
    .field({ _id: true, reminderId: true })
    .get();
  var orphanIds = [];
  var checkIds = [];
  for (var ri = 0; ri < recordsRes.data.length; ri++) {
    var rec = recordsRes.data[ri];
    if (!rec.reminderId) continue;
    if (checkIds.indexOf(rec.reminderId) === -1)
      checkIds.push(rec.reminderId);
  }
  var validReminders = {};
  if (checkIds.length > 0) {
    var reminderCheckRes = await db.collection('reminders')
      .where({ _id: _.in(checkIds) })
      .field({ _id: true })
      .limit(100)
      .get();
    for (var rj = 0; rj < reminderCheckRes.data.length; rj++)
      validReminders[reminderCheckRes.data[rj]._id] = true;
  }
  for (var ri = 0; ri < recordsRes.data.length; ri++) {
    var rec = recordsRes.data[ri];
    if (rec.reminderId && !validReminders[rec.reminderId])
      orphanIds.push(rec._id);
  }
  if (orphanIds.length > 0) {
    await db.collection('records').where({ _id: _.in(orphanIds) }).remove();
    console.log('清理孤儿记录:', orphanIds.length, '条');
  }

  // 重建 existingMedIds（幽灵清理可能删了提醒）
  existingMedIds = [];
  for (var i = 0; i < reminders.length; i++) {
    if (existingMedIds.indexOf(reminders[i].medicationId) === -1)
      existingMedIds.push(reminders[i].medicationId);
  }

  // 自愈：检查并补建缺失提醒
  for (var mi = 0; mi < medsRes.data.length; mi++) {
    var med = medsRes.data[mi];
    if (!med.times || med.times.length === 0) continue;
    if (existingMedIds.indexOf(med._id) !== -1) continue;
    if (med.duration > 0 && med.startDate) {
      var end = new Date(med.startDate);
      end.setDate(end.getDate() + med.duration);
      if (today >= end) continue;
    }
    for (var ti = 0; ti < med.times.length; ti++) {
      // 去重：检查是否已有同药品同时段的提醒
      var exists = false;
      for (var ri = 0; ri < reminders.length; ri++) {
        if (reminders[ri].medicationId === med._id && reminders[ri].timeStr === med.times[ti]) {
          exists = true;
          break;
        }
      }
      if (exists) continue;
      var dateStr = String(today.getFullYear()) + '-' + 
        ('0' + (today.getMonth() + 1)).slice(-2) + '-' + 
        ('0' + today.getDate()).slice(-2);
      var st = new Date(new Date(dateStr + 'T' + med.times[ti] + ':00').getTime() + (med.timezoneOffset || 0) * 60 * 1000);
      var addRes = await db.collection('reminders').add({ data: {
        userId: userId, medicationId: med._id, scheduledTime: st,
        timeStr: med.times[ti], status: 'pending', createdAt: db.serverDate()
      }});
      reminders.push({
        _id: addRes._id,
        medicationId: med._id,
        scheduledTime: st,
        timeStr: med.times[ti],
        status: 'pending'
      });
    }
  }

  // 重新排序（按设定时间 timeStr）
  reminders.sort(function(a, b) {
    return (a.timeStr || '') > (b.timeStr || '') ? 1 : -1;
  });

  // 获取关联的药品信息
  var medicationIds = [];
  for (var i = 0; i < reminders.length; i++) {
    if (medicationIds.indexOf(reminders[i].medicationId) === -1)
      medicationIds.push(reminders[i].medicationId);
  }
  var medications = {};
  if (medicationIds.length > 0) {
    var medicationsRes = await db.collection('medications')
      .where({ _id: _.in(medicationIds) }).get();
    for (var j = 0; j < medicationsRes.data.length; j++)
      medications[medicationsRes.data[j]._id] = medicationsRes.data[j];
  }

  // 组合数据（跳过已删除或已停用的药品）
  var result = [];
  for (var k = 0; k < reminders.length; k++) {
    var reminder = reminders[k];
    var medication = medications[reminder.medicationId] || null;
    if (!medication || medication.isActive === false) continue;
    result.push({
      _id: reminder._id,
      medicationId: reminder.medicationId,
      medicationName: medication.name,
      dosage: medication.dosage || '',
      scheduledTime: reminder.scheduledTime,
      timeStr: reminder.timeStr || '',
      status: reminder.status
    });
  }

  return { code: 0, data: result };
}

/**
 * 更新提醒状态
 */
async function updateReminderStatus(userId, reminderId, status) {
  await db.collection('reminders').doc(reminderId).update({
    data: { status: status }
  });

  return {
    code: 0,
    message: '状态已更新'
  };
}

/**
 * 取消提醒
 */
async function cancelReminder(userId, reminderId) {
  await db.collection('reminders').doc(reminderId).remove();

  return {
    code: 0,
    message: '提醒已取消'
  };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    switch (action) {
      case 'create':
        return await createReminder(openid, event.data);
      case 'getToday':
        return await getTodayReminders(openid);
      case 'updateStatus':
        return await updateReminderStatus(openid, event.data.id, event.data.status);
      case 'cancel':
        return await cancelReminder(openid, event.data.id);
      case 'acknowledge':
        await db.collection('reminders').doc(event.data.id).update({
          data: { status: 'acknowledged' }
        });
        return { code: 0, message: 'ok' };
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('提醒操作失败:', err);
    return {
      code: -1,
      message: '操作失败'
    };
  }
};
