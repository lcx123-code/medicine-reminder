/**
 * 首页 - 今日提醒
 * 功能：
 * 1. 显示今日需要服用的药品提醒
 * 2. 记录服药状态
 * 3. 显示库存预警
 */

// pages/index/index.js
var api = require('../../utils/api');
var dateUtil = require('../../utils/date');
var haptic = require('../../utils/haptic');
var errorHandler = require('../../utils/error');

Page({
  /**
   * 页面数据
   */
  data: {
    today: '',           // 今日日期
    weekDay: '',         // 星期几
    reminders: [],       // 今日提醒列表
    stockWarnings: [],   // 库存预警列表
    loading: true,       // 加载状态
    showNotifyBanner: false // 是否显示通知授权提示
  },

  /**
   * 页面加载
   */
  onLoad: function () {
    this.setData({
      today: dateUtil.getToday(),
      weekDay: dateUtil.getWeekDay(new Date())
    });
  },

  /**
   * 页面显示（从后台进入前台）
   */
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }
    this.loadData();
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载页面数据
   * 并行加载提醒列表和库存预警
   */
  loadData: function () {
    var that = this;
    that.setData({ loading: true });

    return Promise.all([
      that.loadReminders(),
      that.loadStockWarnings()
    ]).then(function () {
      that.setData({ loading: false });
      // 有提醒时显示通知授权提示条
      if (that.data.reminders.length > 0 && !wx.getStorageSync('notifySubscribed')) {
        that.setData({ showNotifyBanner: true });
      }
    });
  },

  /**
   * 加载今日提醒列表
   */
  loadReminders: function () {
    var that = this;
    return api.getTodayReminders().then(function (res) {
      if (res.code === 0) {
        that.setData({ reminders: res.data });
      }
    }).catch(function (err) {
      errorHandler.handleCloudError(err, '加载提醒');
    });
  },

  /**
   * 加载库存预警
   * 筛选出库存低于预警值的药品
   */
  loadStockWarnings: function () {
    var that = this;
    return api.getMedications().then(function (res) {
      if (res.code === 0) {
        // 筛选条件：启用中 且 库存 <= 预警值 且 库存 > 0 且 开启了库存管理
        var warnings = res.data.filter(function (med) {
          return med.isActive && med.stockEnabled !== false && med.stock <= med.stockWarning && med.stock >= 0;
        });
        that.setData({ stockWarnings: warnings });
      }
    }).catch(function (err) {
      errorHandler.handleCloudError(err, '加载库存预警');
    });
  },

  /**
   * 确认服药
   * @param {Object} e - 事件对象，包含reminder数据
   */
  onTakeMedicine: function (e) {
    var that = this;
    var reminder = e.detail.reminder;
    haptic.light();

    wx.showModal({
      title: '确认服药',
      content: '确认已服用 ' + reminder.medicationName + ' ' + reminder.dosage + '？',
      success: function (res) {
        if (res.confirm) {
          haptic.medium();
          that.recordTakeMedicine(reminder);
        }
      }
    });
  },

  /**
   * 记录服药
   * @param {Object} reminder - 提醒信息
   */
  recordTakeMedicine: function (reminder) {
    var that = this;

    api.addRecord({
      medicationId: reminder.medicationId,
      reminderId: reminder._id
    }).then(function (res) {
      if (res.code === 0) {
        haptic.heavy();
        errorHandler.showSuccess('服药记录已保存');

        // 更新提醒状态为已完成
        that.updateReminderStatus(reminder._id, 'completed');

        // 检查库存预警
        if (res.data.stockWarning) {
          haptic.long();
          errorHandler.showConfirm('库存预警', res.data.medicationName + ' 库存不足，请及时补充');
        }
      }
    }).catch(function (err) {
      errorHandler.handleCloudError(err, '记录服药');
    });
  },

  /**
   * 更新提醒状态
   * @param {String} reminderId - 提醒ID
   * @param {String} status - 新状态
   */
  updateReminderStatus: function (reminderId, status) {
    var reminders = this.data.reminders;
    for (var i = 0; i < reminders.length; i++) {
      if (reminders[i]._id === reminderId) {
        reminders[i].status = status;
        break;
      }
    }
    this.setData({ reminders: reminders });
  },

  /**
   * 点击开启通知提醒
   */
  onSubscribeNotify: function () {
    var that = this;
    var tmplIds = [
      'HBUcX64MIUMEnf-WPQiAuatrglxdIORe4Z03ZgNHGrg',
      'yWIU75GOoaaRDI0eAzBRfZb8N5jOKDtKXj2PhLQ6xps',
      '0atsTuJOmGeeKXpCDdzMJS4-1zQh6ZPK22N0AR0SukM'
    ];
    wx.requestSubscribeMessage({
      tmplIds: tmplIds,
      success: function (res) {
        var accepted = false;
        for (var i = 0; i < tmplIds.length; i++) {
          if (res[tmplIds[i]] === 'accept') { accepted = true; break; }
        }
        if (accepted) {
          wx.setStorageSync('notifySubscribed', true);
          that.setData({ showNotifyBanner: false });
          wx.showToast({ title: '已开启提醒', icon: 'success' });
        } else {
          wx.showToast({ title: '已取消订阅', icon: 'none' });
        }
      },
      fail: function (err) {
        console.log('订阅消息授权失败:', err);
      }
    });
  },

  /**
   * 关闭通知提示条
   */
  onCloseNotifyBanner: function () {
    this.setData({ showNotifyBanner: false });
  },

  /**
   * 已知晓漏服提醒
   */
  onAcknowledge: function (e) {
    var that = this;
    var reminder = e.detail.reminder;
    haptic.light();
    api.acknowledgeReminder(reminder._id).then(function () {
      that.loadData();
    });
  },

  // ==================== TabBar 滚动隐藏 ====================

  _lastScrollTop: 0,

  onPageScroll: function (e) {
    var tabBar = this.getTabBar();
    if (!tabBar) return;
    if (e.scrollTop > this._lastScrollTop && e.scrollTop > 50) {
      tabBar.hideBar();
    } else {
      tabBar.showBar();
    }
    this._lastScrollTop = e.scrollTop;
  }
});
