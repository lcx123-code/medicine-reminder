// 云函数入口文件 - reminder
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

var helper = require('./helpers');

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

  // 去重保留：删除已有 completed/acknowledged 同药品同时间的 pending
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

  // 重新排序（按设定时间 timeStr）
  reminders.sort(function(a, b) {
    return (a.timeStr || '') > (b.timeStr || '') ? 1 : -1;
  });

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
    }
  } catch (err) {
    console.error('提醒操作失败:', err);
    return {
      code: -1,
      message: '操作失败'
    };
  }
};
