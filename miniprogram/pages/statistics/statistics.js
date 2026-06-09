// pages/statistics/statistics.js
var api = require('../../utils/api');
var dateUtil = require('../../utils/date');

Page({
  data: {
    period: 'week',
    stats: {
      total: 0,
      completed: 0,
      missed: 0,
      pending: 0,
      adherenceRate: 0,
      dailyStats: [],
      medicationStats: []
    },
    loading: true
  },

  onLoad: function () {
    this.loadStatistics();
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 3 });
    }
    this.loadStatistics();
  },

  onPullDownRefresh: function () {
    this.loadStatistics().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  loadStatistics: function () {
    var that = this;
    that.setData({ loading: true });

    return api.getStatistics({ period: that.data.period }).then(function (res) {
      if (res.code === 0) {
        var stats = res.data;

        // 处理每日统计
        if (stats.dailyStats) {
          stats.dailyStats = stats.dailyStats.map(function (day) {
            // 格式化日期为短格式（如 "周一" 或 "6/8"）
            var date = new Date(day.date);
            var month = date.getMonth() + 1;
            var dayNum = date.getDate();
            day.shortDate = month + '/' + dayNum;
            return day;
          });
        }

        that.setData({
          stats: stats,
          loading: false
        });
      }
    }).catch(function (err) {
      console.error('加载统计数据失败:', err);
      that.setData({ loading: false });
    });
  },

  onSelectPeriod: function (e) {
    var period = e.currentTarget.dataset.period;
    this.setData({ period: period });
    this.loadStatistics();
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
