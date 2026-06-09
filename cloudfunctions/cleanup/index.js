// 云函数入口文件 - cleanup
// 一次性数据清理工具
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 1. 迁移：修复缺少 timezoneOffset 的旧药品
 */
async function migrateTimezoneOffset() {
  var total = 0;
  var hasMore = true;
  while (hasMore) {
    var res = await db.collection('medications')
      .where({ timezoneOffset: _.exists(false) })
      .field({ _id: true })
      .limit(1000)
      .get();
    var items = res.data;
    if (items.length === 0) {
      hasMore = false;
      break;
    }
    for (var i = 0; i < items.length; i++) {
      await db.collection('medications').doc(items[i]._id).update({
        data: { timezoneOffset: -480 }
      });
      total++;
    }
    if (items.length < 1000) hasMore = false;
  }
  return total;
}

/**
 * 2. 幽灵清理：遍历 ALL reminders，查询对应 medication 的 times 数组，
 *    如果 reminder.timeStr 不在 med.times 中，则删除该 reminder 以及关联的 records
 */
async function cleanGhostReminders() {
  var total = 0;
  var hasMore = true;
  while (hasMore) {
    var res = await db.collection('reminders')
      .limit(1000)
      .get();
    var reminders = res.data;
    if (reminders.length === 0) {
      hasMore = false;
      break;
    }
    for (var i = 0; i < reminders.length; i++) {
      var r = reminders[i];
      // 获取关联药品
      try {
        var medRes = await db.collection('medications').doc(r.medicationId).get();
        var med = medRes.data;
        if (med && med.times && r.timeStr && med.times.indexOf(r.timeStr) === -1) {
          // 幽灵提醒：删除关联 records 和该 reminder
          await db.collection('records').where({ reminderId: r._id }).remove();
          await db.collection('reminders').doc(r._id).remove();
          total++;
        }
      } catch (err) {
        // 仅在药品确实不存在时当作幽灵处理（避免网络错误误删）
        if (err && (err.errCode === -502005 || (err.message && err.message.indexOf('not exist') >= 0))) {
          await db.collection('records').where({ reminderId: r._id }).remove();
          await db.collection('reminders').doc(r._id).remove();
          total++;
        }
      }
    }
    if (reminders.length < 1000) hasMore = false;
  }
  return total;
}

/**
 * 3. 孤儿记录清理：遍历 records，删除不存在对应 reminder 的记录
 */
async function cleanOrphanRecords() {
  var total = 0;
  var hasMore = true;
  while (hasMore) {
    var res = await db.collection('records')
      .field({ _id: true, reminderId: true })
      .limit(1000)
      .get();
    var records = res.data;
    if (records.length === 0) {
      hasMore = false;
      break;
    }
    var orphanIds = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.reminderId) continue;
      try {
        var reminderRes = await db.collection('reminders').doc(rec.reminderId).get();
        if (!reminderRes.data) {
          orphanIds.push(rec._id);
        }
      } catch (err) {
        orphanIds.push(rec._id);
      }
    }
    if (orphanIds.length > 0) {
      // 分批删除（一次最多 100 条）
      var batchSize = 100;
      for (var j = 0; j < orphanIds.length; j += batchSize) {
        var batch = orphanIds.slice(j, j + batchSize);
        await db.collection('records').where({ _id: _.in(batch) }).remove();
      }
      total += orphanIds.length;
    }
    if (records.length < 1000) hasMore = false;
  }
  return total;
}

/**
 * 5. 清理引用了已删除药品的记录
 */
async function cleanOrphanRecordsByMedication() {
  var total = 0;
  var hasMore = true;
  while (hasMore) {
    var res = await db.collection('records')
      .field({ _id: true, medicationId: true })
      .limit(1000)
      .get();
    var records = res.data;
    if (records.length === 0) { hasMore = false; break; }
    var orphanIds = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec.medicationId) continue;
      try {
        var medRes = await db.collection('medications').doc(rec.medicationId).get();
        if (!medRes.data) orphanIds.push(rec._id);
      } catch (err) {
        if (err && (err.errCode === -502005 || (err.message && err.message.indexOf('not exist') >= 0))) {
          orphanIds.push(rec._id);
        }
      }
    }
    if (orphanIds.length > 0) {
      var batchSize = 100;
      for (var j = 0; j < orphanIds.length; j += batchSize) {
        var batch = orphanIds.slice(j, j + batchSize);
        await db.collection('records').where({ _id: _.in(batch) }).remove();
      }
      total += orphanIds.length;
    }
    if (records.length < 1000) hasMore = false;
  }
  return total;
}

/**
 * 6. 去重：查询 reminders 中 status 为 pending 且在同 medicationId+timeStr 下
 *    已有 completed/acknowledged 的，删除 pending 的那个
 */
async function deduplicateReminders() {
  var total = 0;
  var hasMore = true;
  while (hasMore) {
    var res = await db.collection('reminders')
      .where({ status: 'pending' })
      .field({ medicationId: true, timeStr: true, _id: true })
      .limit(1000)
      .get();
    var pendingList = res.data;
    if (pendingList.length === 0) {
      hasMore = false;
      break;
    }
    for (var i = 0; i < pendingList.length; i++) {
      var r = pendingList[i];
      if (!r.medicationId || !r.timeStr) continue;
      var dupRes = await db.collection('reminders')
        .where({
          medicationId: r.medicationId,
          timeStr: r.timeStr,
          status: _.in(['completed', 'acknowledged'])
        })
        .field({ _id: true })
        .limit(1)
        .get();
      if (dupRes.data.length > 0) {
        await db.collection('reminders').doc(r._id).remove();
        total++;
      }
    }
    if (pendingList.length < 1000) hasMore = false;
  }
  return total;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    if (action === 'run') {
      var result = { migrated: 0, ghostReminders: 0, orphanRecords: 0, orphanMedicationRecords: 0, deduped: 0 };

      console.log('开始数据迁移（timezoneOffset）...');
      result.migrated = await migrateTimezoneOffset();

      console.log('开始清理幽灵提醒...');
      result.ghostReminders = await cleanGhostReminders();

      console.log('开始清理孤儿记录...');
      result.orphanRecords = await cleanOrphanRecords();

      console.log('开始清理已删除药品的记录...');
      result.orphanMedicationRecords = await cleanOrphanRecordsByMedication();

      console.log('开始去重...');
      result.deduped = await deduplicateReminders();

      console.log('清理完成:', JSON.stringify(result));
      return { code: 0, data: result };
    }

    return { code: -1, message: '未知操作' };
  } catch (err) {
    console.error('清理失败:', err);
    return { code: -1, message: err.message };
  }
};
