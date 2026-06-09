// 云函数入口文件 - timer
// 定时触发器：每分钟执行一次
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 发送到期提醒
 */
async function sendDueReminders() {
  var now = new Date();
  var fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

  // 获取需要发送的提醒（状态为pending且时间已到）
  var remindersRes = await db.collection('reminders')
    .where({
      status: 'pending',
      scheduledTime: _.lte(now).and(_.gte(fiveMinutesAgo))
    })
    .limit(100)
    .get();

  var reminders = remindersRes.data;

  for (var i = 0; i < reminders.length; i++) {
    var reminder = reminders[i];

    try {
      // 获取药品信息
      var medicationRes = await db.collection('medications').doc(reminder.medicationId).get();
      var medication = medicationRes.data;

      if (!medication) {
        continue;
      }

      // 发送订阅消息
      // 模板ID需要在微信公众平台 → 订阅消息 → 选用模板后填入下方
      var REMINDER_TEMPLATE_ID = 'HBUcX64MIUMEnf-WPQiAuatrglxdIORe4Z03ZgNHGrg'; // 服药提醒模板
      {
        await cloud.openapi.subscribeMessage.send({
          touser: reminder.userId,
          templateId: REMINDER_TEMPLATE_ID,
          page: 'pages/index/index',
          data: {
            thing1: { value: medication.name },
            thing2: { value: medication.dosage },
            time3: { value: formatTime(reminder.scheduledTime) }
          }
        });
      }

      // 更新提醒状态为已发送
      await db.collection('reminders').doc(reminder._id).update({
        data: { status: 'sent' }
      });

      console.log('提醒已发送:', reminder._id);
    } catch (err) {
      console.error('发送提醒失败:', reminder._id, err);
    }
  }
}

/**
 * 检查库存预警
 */
async function checkStockWarnings() {
  // 获取库存不足的药品
  var medicationsRes = await db.collection('medications')
    .where({
      isActive: true,
      stock: _.gt(0),
      stockWarning: _.gt(0)
    })
    .limit(100)
    .get();

  var medications = medicationsRes.data;

  for (var i = 0; i < medications.length; i++) {
    var med = medications[i];

    if (med.stock <= med.stockWarning) {
      try {
        // 本地记录库存预警（控制台日志）
        console.log('库存预警:', med.name, '剩余:', med.stock);
      } catch (err) {
        console.error('检查库存预警失败:', med._id, err);
      }
    }
  }
}

/**
 * 检查用药周期结束
 */
async function checkMedicationCycles() {
  var today = formatDate(new Date());

  // 获取有用药周期的药品
  var medicationsRes = await db.collection('medications')
    .where({
      isActive: true,
      duration: _.gt(0)
    })
    .limit(100)
    .get();

  var medications = medicationsRes.data;

  for (var i = 0; i < medications.length; i++) {
    var med = medications[i];

    // 计算结束日期
    var startDate = new Date(med.startDate);
    var endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + med.duration);

    if (formatDate(endDate) <= today) {
      try {
        // 停用该药品
        await db.collection('medications').doc(med._id).update({
          data: { isActive: false }
        });

        console.log('用药周期结束:', med._id);
      } catch (err) {
        console.error('处理用药周期结束失败:', med._id, err);
      }
    }
  }
}

/**
 * 标记漏服提醒
 */
async function markMissedReminders() {
  var now = new Date();
  var oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // 获取已发送但超过1小时未完成的提醒
  var remindersRes = await db.collection('reminders')
    .where({
      status: 'sent',
      scheduledTime: _.lte(oneHourAgo)
    })
    .limit(100)
    .get();

  var reminders = remindersRes.data;

  for (var i = 0; i < reminders.length; i++) {
    try {
      await db.collection('reminders').doc(reminders[i]._id).update({
        data: { status: 'missed' }
      });

      console.log('标记漏服:', reminders[i]._id);
    } catch (err) {
      console.error('标记漏服失败:', reminders[i]._id, err);
    }
  }
}

/**
 * 为明天创建提醒
 */
async function createTomorrowReminders() {
  var now = new Date();
  var bjHour = (now.getUTCHours() + 8) % 24;
  var bjMinute = now.getUTCMinutes();
  if (bjHour !== 0 || bjMinute > 5) return { code: 0, data: { created: 0 } };

  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var tomorrowStr = formatDate(tomorrow);

  // 获取所有启用的药品
  var medicationsRes = await db.collection('medications')
    .where({ isActive: true })
    .limit(100)
    .get();

  var medications = medicationsRes.data;

  for (var i = 0; i < medications.length; i++) {
    var med = medications[i];

    // 检查用药周期
    if (med.duration > 0) {
      var startDate = new Date(med.startDate);
      var endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + med.duration);

      if (formatDate(endDate) < tomorrowStr) {
        continue; // 已过用药周期
      }
    }

    // 检查是否已有明天的提醒
    var existingReminders = await db.collection('reminders')
      .where({
        medicationId: med._id,
        scheduledTime: _.gte(new Date(tomorrowStr)).and(_.lt(new Date(tomorrowStr + 'T23:59:59')))
      })
      .count();

    if (existingReminders.total > 0) {
      continue; // 已有明天的提醒
    }

    // 创建明天的提醒
    if (med.times && med.times.length > 0) {
      for (var j = 0; j < med.times.length; j++) {
        var scheduledTime = new Date(new Date(tomorrowStr + 'T' + med.times[j] + ':00').getTime() + (med.timezoneOffset || 0) * 60 * 1000);

        await db.collection('reminders').add({
          data: {
            userId: med.userId,
            medicationId: med._id,
            scheduledTime: scheduledTime,
            timeStr: med.times[j],
            status: 'pending',
            createdAt: db.serverDate()
          }
        });
      }
    }
  }
}

/**
 * 格式化日期
 */
function formatDate(date) {
  var d = new Date(date);
  var year = d.getFullYear();
  var month = ('0' + (d.getMonth() + 1)).slice(-2);
  var day = ('0' + d.getDate()).slice(-2);
  return year + '-' + month + '-' + day;
}

/**
 * 格式化时间
 */
function formatTime(date) {
  var d = new Date(date);
  var hours = ('0' + d.getHours()).slice(-2);
  var minutes = ('0' + d.getMinutes()).slice(-2);
  return hours + ':' + minutes;
}

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('定时触发器开始执行');

  try {
    // 1. 发送到期提醒
    await sendDueReminders();

    // 2. 检查库存预警
    await checkStockWarnings();

    // 3. 检查用药周期结束
    await checkMedicationCycles();

    // 4. 标记漏服提醒
    await markMissedReminders();

    // 5. 为明天创建提醒（北京时间午夜执行）
    await createTomorrowReminders();

    console.log('定时触发器执行完成');
    return {
      code: 0,
      message: '执行完成'
    };
  } catch (err) {
    console.error('定时触发器执行失败:', err);
    return {
      code: -1,
      message: '执行失败'
    };
  }
};
