/**
 * 小程序配置文件
 * 集中管理所有配置项，便于维护和修改
 */

module.exports = {
  // 云开发环境ID
  cloudEnv: 'cloud1-d3gwep1iz078b4bf7',

  // 数据库集合名称
  collections: {
    users: 'users',
    medications: 'medications',
    reminders: 'reminders',
    records: 'records'
  },

  // 云函数名称
  cloudFunctions: {
    login: 'login',
    medication: 'medication',
    reminder: 'reminder',
    record: 'record',
    statistics: 'statistics',
    timer: 'timer'
  },

  // 默认库存预警值
  defaultStockWarning: 10,

  // 提醒时间正则（HH:MM格式）
  timeRegex: /^([01]\d|2[0-3]):([0-5]\d)$/,

  // 日期格式
  dateFormat: 'YYYY-MM-DD',

  // 频次选项
  frequencyOptions: ['每天1次', '每天2次', '每天3次', '每周1次', '每周2次', '每周3次'],

  // 库存单位选项
  stockUnitOptions: ['片', '粒', '袋', '支', 'ml', 'g', 'mg', '瓶', '盒', '揿'],

  // 用药周期选项
  durationOptions: ['长期', '7天', '14天', '21天', '30天', '自定义'],
  durationValues: [0, 7, 14, 21, 30, -1],

  // 页面路径
  pages: {
    index: '/pages/index/index',
    medications: '/pages/medications/medications',
    addMedication: '/pages/addMedication/addMedication',
    records: '/pages/records/records',
    statistics: '/pages/statistics/statistics'
  }
};
