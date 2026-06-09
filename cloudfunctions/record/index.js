// 云函数入口文件 - record
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 添加服药记录
 * 自动扣减库存
 */
async function addRecord(userId, data) {
  var medicationId = data.medicationId;
  var reminderId = data.reminderId;

  // 防重：同一提醒不可重复记录已服
  if (reminderId) {
    var existing = await db.collection('records')
      .where({ reminderId: reminderId, status: 'taken' }).count();
    if (existing.total > 0) {
      console.log('addRecord 重复调用，已跳过:', reminderId);
      return { code: 0, data: { duplicate: true } };
    }
  }

  // 获取药品信息
  var medicationRes = await db.collection('medications').doc(medicationId).get();
  var medication = medicationRes.data;

  if (!medication) {
    return {
      code: -1,
      message: '药品不存在'
    };
  }

  // 创建服药记录
  var record = {
    userId: userId,
    medicationId: medicationId,
    reminderId: reminderId,
    takenAt: db.serverDate(),
    status: 'taken',
    createdAt: db.serverDate()
  };

  await db.collection('records').add({ data: record });

  // 更新提醒状态为已完成
  if (reminderId) {
    await db.collection('reminders').doc(reminderId).update({
      data: { status: 'completed' }
    });
  }

  // 扣减库存
  var newStock = medication.stock - medication.numericDosage;
  if (newStock < 0) newStock = 0;

  await db.collection('medications').doc(medicationId).update({
    data: { stock: newStock }
  });

  // 检查库存预警
  var stockWarning = false;
  if (newStock <= medication.stockWarning) {
    stockWarning = true;
  }

  return {
    code: 0,
    data: {
      recordId: record._id,
      newStock: newStock,
      stockWarning: stockWarning,
      medicationName: medication.name
    }
  };
}

/**
 * 获取服药记录
 */
async function getRecords(userId, data) {
  var date = data.date || null;
  var page = data.page || 1;
  var pageSize = data.pageSize || 20;

  var whereCondition = { userId: userId };

  // 按日期筛选
  if (date) {
    var startDate = new Date(date);
    startDate.setHours(0, 0, 0, 0);

    var endDate = new Date(date);
    endDate.setHours(23, 59, 59, 999);

    whereCondition.createdAt = _.gte(startDate).and(_.lte(endDate));
  }

  // 获取记录
  var recordsRes = await db.collection('records')
    .where(whereCondition)
    .orderBy('createdAt', 'desc')
    .skip((page - 1) * pageSize)
    .limit(pageSize)
    .get();

  var records = recordsRes.data;

  // 获取关联的药品信息
  var medicationIds = [];
  for (var i = 0; i < records.length; i++) {
    if (medicationIds.indexOf(records[i].medicationId) === -1) {
      medicationIds.push(records[i].medicationId);
    }
  }

  var medications = {};
  if (medicationIds.length > 0) {
    var medicationsRes = await db.collection('medications')
      .where({ _id: _.in(medicationIds) })
      .get();

    for (var j = 0; j < medicationsRes.data.length; j++) {
      medications[medicationsRes.data[j]._id] = medicationsRes.data[j];
    }
  }

  // 组合数据
  var result = [];
  for (var k = 0; k < records.length; k++) {
    var record = records[k];
    var medication = medications[record.medicationId] || null;

    result.push({
      _id: record._id,
      medicationId: record.medicationId,
      medicationName: medication ? medication.name : '未知药品',
      dosage: medication ? medication.dosage : '',
      takenAt: record.takenAt,
      status: record.status
    });
  }

  return {
    code: 0,
    data: result
  };
}

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const action = event.action;

  try {
    switch (action) {
      case 'add':
        return await addRecord(openid, event.data);
      case 'getList':
        return await getRecords(openid, event.data);
      default:
        return {
          code: -1,
          message: '未知操作'
        };
    }
  } catch (err) {
    console.error('记录操作失败:', err);
    return {
      code: -1,
      message: '操作失败'
    };
  }
};
