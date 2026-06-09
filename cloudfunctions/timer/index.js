// 云函数入口文件 - timer
// 定时触发器：每分钟执行一次
// 注意：定时触发的云函数不能用 cloud.openapi，改用直接调微信 HTTP API
const cloud = require('wx-server-sdk');
const https = require('https');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

// ==================== access_token 缓存管理 ====================

var accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * 获取微信 access_token（带缓存，提前5分钟刷新）
 * 使用 stable_token 接口，不会使旧 token 失效
 */
function getAccessToken() {
  return new Promise(function (resolve, reject) {
    var now = Date.now();
    // 缓存有效（提前5分钟刷新避免边界过期）
    if (accessTokenCache.token && now < accessTokenCache.expiresAt - 5 * 60 * 1000) {
      return resolve(accessTokenCache.token);
    }

    var body = JSON.stringify({
      grant_type: 'client_credential',
      appid: 'wx39c8f9bad9062017',
      secret: '4021c46d0eaa267bb5a8ce7669acf97e',
      force_refresh: false
    });

    var req = https.request('https://api.weixin.qq.com/cgi-bin/stable_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var result = JSON.parse(data);
          if (result.access_token) {
            accessTokenCache.token = result.access_token;
            accessTokenCache.expiresAt = now + (result.expires_in || 7200) * 1000;
            console.log('access_token 已刷新，有效期至:', new Date(accessTokenCache.expiresAt).toISOString());
            resolve(accessTokenCache.token);
          } else {
            reject(new Error('获取 access_token 失败: ' + data));
          }
        } catch (e) {
          reject(new Error('解析 access_token 响应失败: ' + data));
        }
      });
    });

    req.on('error', function (err) {
      reject(new Error('请求 access_token 网络错误: ' + err.message));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 发送订阅消息（直接调微信 HTTP API，不走 cloud.openapi）
 */
function sendSubscribeMessage(openid, templateId, page, templateData) {
  return getAccessToken().then(function (token) {
    return new Promise(function (resolve, reject) {
      var body = JSON.stringify({
        touser: openid,
        template_id: templateId,
        page: page,
        data: templateData,
        miniprogram_state: 'trial',
        lang: 'zh_CN'
      });

      var req = https.request('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, function (res) {
        var data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () {
          try {
            var result = JSON.parse(data);
            if (result.errcode === 0) {
              resolve(result);
            } else {
              reject(new Error(JSON.stringify(result)));
            }
          } catch (e) {
            reject(new Error('解析订阅消息响应失败: ' + data));
          }
        });
      });

      req.on('error', function (err) {
        reject(new Error('发送订阅消息网络错误: ' + err.message));
      });
      req.write(body);
      req.end();
    });
  });
}

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
        continue;
      }

      // 发送订阅消息（直接调微信 HTTP API）
      var REMINDER_TEMPLATE_ID = 'HBUcX64MIUMEnf-WPQiAuatrglxdIORe4Z03ZgNHGrg';
      await sendSubscribeMessage(
        reminder.userId,
        REMINDER_TEMPLATE_ID,
        'pages/index/index',
        {
          thing1: { value: '请及时服药' },
          thing2: { value: medication.name },
          time3: { value: formatTime(reminder.scheduledTime) },
          thing7: { value: medication.duration ? medication.duration + '天' : '长期用药' },
          time10: { value: reminder.timeStr || formatTime(reminder.scheduledTime) }
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
        var STOCK_TEMPLATE_ID = 'yWIU75GOoaaRDI0eAzBRfZb8N5jOKDtKXj2PhLQ6xps';
        await sendSubscribeMessage(
          med.userId,
          STOCK_TEMPLATE_ID,
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

        // 发送周期结束通知
        var CYCLE_TEMPLATE_ID = '0atsTuJOmGeeKXpCDdzMJS4-1zQh6ZPK22N0AR0SukM';
        await sendSubscribeMessage(
          med.userId,
          CYCLE_TEMPLATE_ID,
          'pages/medications/medications',
          {
            time1: { value: formatDate(endDate) },
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
 * 格式化时间（转为北京时间显示）
 */
function formatTime(date) {
  var d = new Date(date);
  var bjHours = (d.getUTCHours() + 8) % 24;
  var hours = ('0' + bjHours).slice(-2);
  var minutes = ('0' + d.getUTCMinutes()).slice(-2);
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
