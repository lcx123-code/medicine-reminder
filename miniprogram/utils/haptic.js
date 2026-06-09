/**
 * 触感反馈工具
 * 提供按钮点击时的触感反馈
 */

/**
 * 轻触反馈
 */
function light() {
  try {
    wx.vibrateShort({
      type: 'light',
      fail: function () {
        // 静默失败，部分设备不支持
      }
    });
  } catch (e) {
    // 静默失败
  }
}

/**
 * 中等触感反馈
 */
function medium() {
  try {
    wx.vibrateShort({
      type: 'medium',
      fail: function () {
        // 静默失败
      }
    });
  } catch (e) {
    // 静默失败
  }
}

/**
 * 重触感反馈
 */
function heavy() {
  try {
    wx.vibrateShort({
      type: 'heavy',
      fail: function () {
        // 静默失败
      }
    });
  } catch (e) {
    // 静默失败
  }
}

/**
 * 长振动
 */
function long() {
  try {
    wx.vibrateLong({
      fail: function () {
        // 静默失败
      }
    });
  } catch (e) {
    // 静默失败
  }
}

module.exports = {
  light: light,
  medium: medium,
  heavy: heavy,
  long: long
};
