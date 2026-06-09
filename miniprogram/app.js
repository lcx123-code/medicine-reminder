App({
  onLaunch: function () {
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: 'cloud1-d3gwep1iz078b4bf7',
        traceUser: true,
      });
    }

    this.globalData = {};

    // 调用登录，创建用户记录
    var api = require('./utils/api');
    api.login().then(function (res) {
      console.log('登录成功', res);
    }).catch(function (err) {
      console.error('登录失败', err);
    });
  },

  globalData: {
    userInfo: null,
    openid: null
  }
});
