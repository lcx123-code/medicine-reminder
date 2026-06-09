// 云函数入口文件 - statistics
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 获取统计数据
 */
async function getStatistics(userId, data) {
  var period = data.period || 'week';
  var medicationId = data.medicationId || null;

  // 计算日期范围
  var endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  var startDate = new Date();

  if (period === 'week') {
    startDate.setDate(startDate.getDate() - 7);
  } else if (period === 'month') {
    startDate.setMonth(startDate.getMonth() - 1);
  }

  startDate.setHours(0, 0, 0, 0);

  // 构建查询条件
  var baseWhere = {
    userId: userId,
    scheduledTime: _.gte(startDate).and(_.lte(endDate))
  };

  if (medicationId) {
    baseWhere.medicationId = medicationId;
  }

  // 一次性获取所有提醒数据
  var allReminders = await db.collection('reminders')
    .where(baseWhere)
    .field({ status: true, scheduledTime: true, medicationId: true })
    .limit(10000)
    .get();

  var reminders = allReminders.data;

  var validMeds = {};
  var medIdsInReminders = [];
  for (var i = 0; i < reminders.length; i++) {
    if (medIdsInReminders.indexOf(reminders[i].medicationId) === -1)
      medIdsInReminders.push(reminders[i].medicationId);
  }
  if (medIdsInReminders.length > 0) {
    var medRes = await db.collection('medications')
      .where({ _id: _.in(medIdsInReminders) })
      .field({ name: true })
      .get();
    for (var j = 0; j < medRes.data.length; j++)
      validMeds[medRes.data[j]._id] = medRes.data[j].name;
  }

  // 在内存中计算统计数据
  var total = reminders.length;
  var completed = 0;
  var missed = 0;
  var pending = 0;

  var dailyStatsMap = {};
  var medicationStatsMap = {};

  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];

    if (!validMeds[r.medicationId]) continue;

    // 统计状态
    if (r.status === 'completed') {
      completed++;
    } else if (r.status === 'missed') {
      missed++;
    } else {
      pending++;
    }

    // 每日统计
    var dateStr = formatDate(r.scheduledTime);
    if (!dailyStatsMap[dateStr]) {
      dailyStatsMap[dateStr] = { date: dateStr, total: 0, completed: 0 };
    }
    dailyStatsMap[dateStr].total++;
    if (r.status === 'completed') {
      dailyStatsMap[dateStr].completed++;
    }

    // 药品统计
    if (!medicationStatsMap[r.medicationId]) {
      medicationStatsMap[r.medicationId] = { medicationId: r.medicationId, total: 0, completed: 0 };
    }
    medicationStatsMap[r.medicationId].total++;
    if (r.status === 'completed') {
      medicationStatsMap[r.medicationId].completed++;
    }
  }

  // 计算依从率
  var adherenceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  // 转换每日统计为数组
  var dailyStats = [];
  for (var dateKey in dailyStatsMap) {
    dailyStats.push(dailyStatsMap[dateKey]);
  }
  dailyStats.sort(function (a, b) { return a.date > b.date ? 1 : -1; });

  var medicationStats = [];
  for (var medId in medicationStatsMap) {
    var medStat = medicationStatsMap[medId];
    medicationStats.push({
      medicationId: medId,
      medicationName: validMeds[medId],
      total: medStat.total,
      completed: medStat.completed,
      adherenceRate: medStat.total > 0 ? Math.round((medStat.completed / medStat.total) * 100) : 0
    });
  }

  return {
    code: 0,
    data: {
      total: total,
      completed: completed,
      missed: missed,
      pending: pending,
      adherenceRate: adherenceRate,
      dailyStats: dailyStats,
      medicationStats: medicationStats
    }
  };
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

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    switch (action) {
      case 'get':
        return await getStatistics(openid, event.data || {});
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('统计操作失败:', err);
    return {
      code: -1,
      message: '操作失败'
    };
  }
};
