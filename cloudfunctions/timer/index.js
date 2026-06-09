// 云函数入口文件 - timer
// 定时触发器：每分钟执行一次
// 注意：定时触发的云函数不能用 cloud.openapi，改用直接调微信 HTTP API
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

var accessToken = require('./access-token');
var sendMessage = require('./send-message');
var helper = require('./helpers');

/**
 * 检查库存预警
 */
async function checkStockWarnings() {
  // 获取库存不足的药品
  var medicationsRes = await db.collection('medications')
    .where({
      isActive: true,
      stockEnabled: true,
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
        await accessToken.sendSubscribeMessage(
          med.userId,
          accessToken.TEMPLATE_IDS.STOCK,
          'pages/medications/medications',
          {
            thing1: { value: med.name },
            number6: { value: med.stock },
            short_thing18: { value: med.stockUnit || '片' }
          }
        );

        console.log('库存预警已发送:', med.name, '剩余:', med.stock);
      } catch (err) {
        console.error('发送库存预警失败:', med._id, err);
      }
    }
  }
}

/**
 * 检查用药周期结束
 */
async function checkMedicationCycles() {
  var today = helper.formatDate(new Date());

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

    if (helper.formatDate(endDate) <= today) {
      try {
        // 停用该药品
        await db.collection('medications').doc(med._id).update({
          data: { isActive: false }
        });

        // 发送周期结束通知
        await accessToken.sendSubscribeMessage(
          med.userId,
          accessToken.TEMPLATE_IDS.CYCLE,
          'pages/medications/medications',
          {
            time1: { value: helper.formatDate(endDate) },
            thing2: { value: med.name + '用药周期已结束，已自动停用' }
          }
        );

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

  // 获取已发送但超过1小时未处理的提醒
  // 新数据看 sentTime，旧数据（无 sentTime）用 scheduledTime 兜底
  var remindersRes = await db.collection('reminders')
    .where(_.or([
      { status: 'sent', sentTime: _.lte(oneHourAgo) },
      { status: 'sent', sentTime: _.exists(false), scheduledTime: _.lte(oneHourAgo) },
      { status: 'sent', sentTime: null, scheduledTime: _.lte(oneHourAgo) }
    ]))
    .limit(100)
    .get();

  var reminders = remindersRes.data;

  for (var i = 0; i < reminders.length; i++) {
    try {
      await db.collection('reminders').doc(reminders[i]._id).update({
        data: { status: 'missed' }
      });

      // 同步写一条漏服记录到 records 集合（使记录页也能展示漏服）
      var existing = await db.collection('records')
        .where({ reminderId: reminders[i]._id }).count();

      if (existing.total === 0) {
        await db.collection('records').add({
          data: {
            userId: reminders[i].userId,
            medicationId: reminders[i].medicationId,
            reminderId: reminders[i]._id,
            takenAt: reminders[i].scheduledTime,
            status: 'missed',
            createdAt: db.serverDate()
          }
        });
      }

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
  var tomorrowStr = helper.formatDate(tomorrow);

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

      if (helper.formatDate(endDate) < tomorrowStr) {
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
        var scheduledTime = helper.calcScheduledTime(tomorrowStr, med.times[j], med.timezoneOffset || 0);

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

// 云函数入口函数
exports.main = async (event, context) => {
  console.log('定时触发器开始执行');

  try {
    // 1. 发送到期提醒
    await sendMessage.sendDueReminders();

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
