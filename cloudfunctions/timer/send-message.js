// 发送到期提醒
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

var accessToken = require('./access-token');
var helper = require('./helpers');

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

      if (!medication.isActive) {
        // 药品已停用，删除该 ghost reminder
        await db.collection('reminders').doc(reminder._id).remove();
        continue;
      }

      // 验证 timeStr 仍在药品的 times 中（避免编辑删除时间后 ghost 被发送）
      if (reminder.timeStr && medication.times && medication.times.indexOf(reminder.timeStr) === -1) {
        await db.collection('reminders').doc(reminder._id).remove();
        continue;
      }

      // 发送订阅消息（直接调微信 HTTP API）
      await accessToken.sendSubscribeMessage(
        reminder.userId,
        accessToken.TEMPLATE_IDS.REMINDER,
        'pages/index/index',
        {
          thing1: { value: '请及时服药' },
          thing2: { value: medication.name },
          time3: { value: helper.formatTime(reminder.scheduledTime) },
          thing7: { value: medication.duration ? medication.duration + '天' : '长期用药' },
          time10: { value: reminder.timeStr || helper.formatTime(reminder.scheduledTime) }
        }
      );

      // 更新提醒状态为已发送（记录发送时间，用于漏服判断）
      await db.collection('reminders').doc(reminder._id).update({
        data: { status: 'sent', sentTime: db.serverDate() }
      });

      console.log('提醒已发送:', reminder._id);
    } catch (err) {
      console.error('发送提醒失败:', reminder._id, err);
    }
  }
}

module.exports = {
  sendDueReminders: sendDueReminders
};
