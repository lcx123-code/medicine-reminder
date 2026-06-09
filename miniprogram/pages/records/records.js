// pages/records/records.js
var api = require('../../utils/api');
var dateUtil = require('../../utils/date');

function safeParseDate(dateStr) {
  if (!dateStr) return new Date();
  var p = dateStr.split('-');
  return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
}

Page({
  data: {
    selectedDate: '',
    weekDay: '',
    records: [],
    takenCount: 0,
    missedCount: 0,
    totalCount: 0,
    loading: true
  },

  onLoad: function () {
    this.setData({
      selectedDate: dateUtil.getToday(),
      weekDay: dateUtil.getWeekDay(new Date()),
      today: dateUtil.getToday()
    });
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 2 });
    }
    this.loadRecords();
  },

  loadRecords: function () {
    var that = this;
    that.setData({ loading: true });

    api.getRecords({ date: that.data.selectedDate }).then(function (res) {
      if (res.code === 0) {
        var records = res.data.map(function (record) {
          record.timeText = dateUtil.formatTime(record.takenAt);
          record.statusText = record.status === 'taken' ? '已服' : '漏服';
          return record;
        });

        var takenCount = records.filter(function (r) { return r.status === 'taken'; }).length;
        var missedCount = records.filter(function (r) { return r.status === 'missed'; }).length;

        that.setData({
          records: records,
          takenCount: takenCount,
          missedCount: missedCount,
          totalCount: records.length,
          loading: false
        });
      }
    }).catch(function (err) {
      console.error('加载记录失败:', err);
      that.setData({ loading: false });
    });
  },

  onPrevDay: function () {
    var prevDate = dateUtil.addDays(this.data.selectedDate, -1);
    this.setData({
      selectedDate: prevDate,
      weekDay: dateUtil.getWeekDay(safeParseDate(prevDate))
    });
    this.loadRecords();
  },

  onNextDay: function () {
    if (this.data.selectedDate >= dateUtil.getToday()) return;
    var nextDate = dateUtil.addDays(this.data.selectedDate, 1);
    this.setData({
      selectedDate: nextDate,
      weekDay: dateUtil.getWeekDay(safeParseDate(nextDate))
    });
    this.loadRecords();
  },

  onSelectDate: function () {
    // 使用原生日期选择器，不需要额外处理
  },

  onDateChange: function (e) {
    var date = e.detail.value;
    this.setData({
      selectedDate: date,
      weekDay: dateUtil.getWeekDay(safeParseDate(date))
    });
    this.loadRecords();
  },

  onGoToday: function () {
    this.setData({
      selectedDate: dateUtil.getToday(),
      weekDay: dateUtil.getWeekDay(new Date())
    });
    this.loadRecords();
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
