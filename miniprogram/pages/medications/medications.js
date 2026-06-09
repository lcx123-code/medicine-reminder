/**
 * 药品管理页面
 * 功能：
 * 1. 显示所有药品列表
 * 2. 支持搜索和筛选
 * 3. 支持添加、编辑、删除药品
 * 4. 左滑删除交互
 */

// pages/medications/medications.js
var api = require('../../utils/api');
var dateUtil = require('../../utils/date');
var haptic = require('../../utils/haptic');
var errorHandler = require('../../utils/error');

Page({
  /**
   * 页面数据
   */
  data: {
    medications: [],           // 所有药品
    filteredMedications: [],   // 筛选后的药品
    searchKeyword: '',         // 搜索关键词
    filterType: 'all',         // 筛选类型：all/active/inactive
    loading: true              // 加载状态
  },

  // 左滑删除相关变量
  startX: 0,
  startY: 0,
  currentIndex: -1,

  /**
   * 页面加载
   */
  onLoad: function () {
    this.loadMedications();
  },

  /**
   * 页面显示
   */
  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    this.loadMedications();
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh: function () {
    this.loadMedications().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  /**
   * 加载药品列表
   */
  loadMedications: function () {
    var that = this;
    that.setData({ loading: true });

    return api.getMedications().then(function (res) {
      if (res.code === 0) {
        var medications = that.formatMedications(res.data);
        that.setData({
          medications: medications,
          loading: false
        });
        that.filterMedications();
      }
    }).catch(function (err) {
      errorHandler.handleCloudError(err, '加载药品');
      that.setData({ loading: false });
    });
  },

  /**
   * 格式化药品数据
   * @param {Array} medications - 原始药品列表
   * @returns {Array} 格式化后的药品列表
   */
  formatMedications: function (medications) {
    return medications.map(function (med) {
      med.timesText = med.times ? med.times.join('、') : '未设置';
      return med;
    });
  },

  /**
   * 筛选药品
   * 根据搜索关键词和状态筛选
   */
  filterMedications: function () {
    var that = this;
    var medications = that.data.medications;
    var keyword = that.data.searchKeyword.toLowerCase();
    var filterType = that.data.filterType;

    var filtered = medications.filter(function (med) {
      var matchKeyword = !keyword || med.name.toLowerCase().indexOf(keyword) !== -1;
      var matchFilter = that.matchFilterType(med, filterType);
      return matchKeyword && matchFilter;
    });

    that.setData({ filteredMedications: filtered });
  },

  /**
   * 匹配筛选类型
   * @param {Object} med - 药品对象
   * @param {String} filterType - 筛选类型
   * @returns {Boolean} 是否匹配
   */
  matchFilterType: function (med, filterType) {
    if (filterType === 'all') return true;
    if (filterType === 'active') return med.isActive;
    if (filterType === 'inactive') return !med.isActive;
    return true;
  },

  /**
   * 搜索输入
   */
  onSearchInput: function (e) {
    this.setData({ searchKeyword: e.detail.value });
    this.filterMedications();
  },

  /**
   * 清除搜索
   */
  onClearSearch: function () {
    this.setData({ searchKeyword: '' });
    this.filterMedications();
  },

  /**
   * 切换筛选类型
   */
  onFilterChange: function (e) {
    var type = e.currentTarget.dataset.type;
    this.setData({ filterType: type });
    this.filterMedications();
  },

  // ==================== 左滑删除 ====================

  /**
   * 触摸开始
   */
  onTouchStart: function (e) {
    this.startX = e.touches[0].clientX;
    this.startY = e.touches[0].clientY;
    this.currentIndex = e.currentTarget.dataset.index;
  },

  /**
   * 触摸移动
   * 计算滑动距离，更新卡片位置
   */
  onTouchMove: function (e) {
    if (this.currentIndex === -1) return;
    
    var moveX = e.touches[0].clientX;
    var moveY = e.touches[0].clientY;
    var diffX = this.startX - moveX;
    var diffY = this.startY - moveY;
    
    // 水平滑动距离大于垂直滑动距离时，处理左滑
    if (Math.abs(diffX) > Math.abs(diffY) && diffX > 0) {
      var swipeX = Math.min(diffX, 150);
      var filteredMedications = this.data.filteredMedications;
      if (filteredMedications[this.currentIndex]) {
        filteredMedications[this.currentIndex].swipeX = -swipeX;
        this.setData({ filteredMedications: filteredMedications });
      }
    }
  },

  /**
   * 触摸结束
   * 根据滑动距离决定是否显示删除按钮
   */
  onTouchEnd: function (e) {
    if (this.currentIndex === -1) return;
    
    var endX = e.changedTouches[0].clientX;
    var diffX = this.startX - endX;
    var filteredMedications = this.data.filteredMedications;
    
    // 滑动距离超过80px，显示删除按钮
    if (diffX > 80) {
      filteredMedications[this.currentIndex].swipeX = -150;
    } else {
      filteredMedications[this.currentIndex].swipeX = 0;
    }
    
    this.setData({ filteredMedications: filteredMedications });
    this.currentIndex = -1;
  },

  // ==================== 操作按钮 ====================

  /**
   * 添加药品
   */
  onAdd: function () {
    haptic.light();
    wx.navigateTo({
      url: '/pages/addMedication/addMedication'
    });
  },

  /**
   * 编辑药品
   */
  onEdit: function (e) {
    haptic.light();
    var id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: '/pages/addMedication/addMedication?id=' + id
    });
  },

  /**
   * 删除药品
   */
  onDelete: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var name = e.currentTarget.dataset.name;
    haptic.light();

    wx.showModal({
      title: '确认删除',
      content: '确定要删除药品"' + name + '"吗？删除后相关提醒也会被删除。',
      confirmColor: '#FF4D4F',
      success: function (res) {
        if (res.confirm) {
          haptic.heavy();
          that.deleteMedication(id);
        }
      }
    });
  },

  /**
   * 执行删除药品
   * @param {String} id - 药品ID
   */
  deleteMedication: function (id) {
    var that = this;
    api.deleteMedication(id).then(function (res) {
      if (res.code === 0) {
        haptic.medium();
        errorHandler.showSuccess('删除成功');
        that.loadMedications();
      }
    }).catch(function (err) {
      errorHandler.handleCloudError(err, '删除药品');
    });
  },

  /**
   * 切换启用/停用状态
   */
  onToggleStatus: function (e) {
    var that = this;
    var id = e.currentTarget.dataset.id;
    var currentActive = e.currentTarget.dataset.active;
    var newStatus = !currentActive;
    haptic.light();
    wx.showModal({
      title: newStatus ? '确认启用' : '确认停用',
      content: newStatus ? '启用后将恢复提醒' : '停用后将暂停提醒',
      success: function (res) {
        if (res.confirm) {
          that.toggleMedicationStatus(id, newStatus);
        }
      }
    });
  },

  /**
   * 执行切换启用/停用状态
   * @param {String} id - 药品ID
   * @param {Boolean} isActive - 新的启用状态
   */
  toggleMedicationStatus: function (id, isActive) {
    var that = this;
    wx.showLoading({ title: '操作中...' });
    api.toggleMedicationStatus(id, isActive).then(function (res) {
      wx.hideLoading();
      if (res.code === 0) {
        haptic.heavy();
        wx.showToast({ title: isActive ? '已启用' : '已停用', icon: 'success' });
        that.loadMedications();
      } else {
        errorHandler.handle(res, '操作失败');
      }
    }).catch(function (err) {
      wx.hideLoading();
      errorHandler.handle(err, '操作失败');
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
