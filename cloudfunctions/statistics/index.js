// 云函数入口文件 - statistics
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

var helper = require('./helpers');

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
    .field({ status: true, scheduledTime: true, medicationId: true, timeStr: true })
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
      .field({ name: true, times: true })
      .get();
    for (var j = 0; j < medRes.data.length; j++)
      validMeds[medRes.data[j]._id] = { name: medRes.data[j].name, times: medRes.data[j].times || [] };
  }

  // 在内存中计算统计数据
  var total = 0;
  var completed = 0;
  var missed = 0;
  var pending = 0;

  var dailyStatsMap = {};
  var medicationStatsMap = {};

  for (var i = 0; i < reminders.length; i++) {
    var r = reminders[i];

    if (!validMeds[r.medicationId]) continue;

    // 幽灵过滤：timeStr 不在药品 times 数组中的跳过
    var medInfo = validMeds[r.medicationId];
    if (r.timeStr && medInfo.times.indexOf(r.timeStr) === -1) continue;

    total++;

    // 统计状态
    if (r.status === 'completed') {
      completed++;
    } else if (r.status === 'missed' || r.status === 'acknowledged') {
      missed++;
    } else if (r.status === 'pending') {
      pending++;
    }

    // 每日统计
    var dateStr = helper.formatDate(r.scheduledTime);
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

  // 用 records 补充迁移误删的 completed 数据
  var completedDates = {};
  for (var di = 0; di < reminders.length; di++) {
    if (reminders[di].status === 'completed') {
      completedDates[reminders[di].medicationId + '|' + helper.formatDate(reminders[di].scheduledTime)] = true;
    }
  }

  var recWhere = { userId: userId, takenAt: _.gte(startDate).and(_.lte(endDate)) };
  if (medicationId) recWhere.medicationId = medicationId;
  var recordsRecover = await db.collection('records')
    .where(recWhere).limit(10000).field({ medicationId: true, takenAt: true, reminderId: true }).get();

  for (var ri = 0; ri < recordsRecover.data.length; ri++) {
    var rec = recordsRecover.data[ri];
    var medId = rec.medicationId;
    var recDate = helper.formatDate(rec.takenAt);
    if (!validMeds[medId]) continue;
    // 幽灵记录过滤
    var takenTime = helper.formatTime(rec.takenAt);
    var medInfo = validMeds[medId];
    if (takenTime && medInfo.times.indexOf(takenTime) === -1) continue;
    if (completedDates[medId + '|' + recDate]) continue;
    completedDates[medId + '|' + recDate] = true;

    completed++;
    total++;
    if (!dailyStatsMap[recDate]) dailyStatsMap[recDate] = { date: recDate, total: 0, completed: 0 };
    dailyStatsMap[recDate].total++;
    dailyStatsMap[recDate].completed++;
    if (!medicationStatsMap[medId]) medicationStatsMap[medId] = { medicationId: medId, total: 0, completed: 0 };
    medicationStatsMap[medId].total++;
    medicationStatsMap[medId].completed++;
  }

  // 最终依从率
  adherenceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

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
      medicationName: validMeds[medId].name,
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
