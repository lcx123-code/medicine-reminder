Component({
  data: {
    selected: 0,
    visible: true,
    list: [
      { pagePath: '/pages/index/index', text: '今日', gradient: 'linear-gradient(135deg, #818CF8, #6366F1)', inactiveColor: '#94A3B8' },
      { pagePath: '/pages/medications/medications', text: '药品', gradient: 'linear-gradient(135deg, #6EE7B7, #10B981)', inactiveColor: '#94A3B8' },
      { pagePath: '/pages/records/records', text: '记录', gradient: 'linear-gradient(135deg, #FDBA74, #F97316)', inactiveColor: '#94A3B8' },
      { pagePath: '/pages/statistics/statistics', text: '统计', gradient: 'linear-gradient(135deg, #93C5FD, #3B82F6)', inactiveColor: '#94A3B8' }
    ]
  },
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset;
      const url = data.path;
      wx.switchTab({ url });
    },
    showBar() {
      this.setData({ visible: true });
    },
    hideBar() {
      this.setData({ visible: false });
    }
  }
});
