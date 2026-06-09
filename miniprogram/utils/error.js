/**
 * 统一错误处理模块
 * 提供一致的错误处理和用户提示
 */

/**
 * 处理错误并显示提示
 * @param {Error} err - 错误对象
 * @param {String} defaultMsg - 默认错误消息
 * @param {Boolean} showToast - 是否显示toast（默认true）
 */
function handleError(err, defaultMsg, showToast) {
  console.error('[Error]', err);
  
  if (showToast !== false) {
    wx.showToast({
      title: defaultMsg || '操作失败',
      icon: 'none',
      duration: 2000
    });
  }
}

/**
 * 处理云函数错误
 * @param {Error} err - 错误对象
 * @param {String} operation - 操作名称（如：加载药品、保存记录）
 */
function handleCloudError(err, operation) {
  console.error('[CloudError]' + operation, err);
  
  var msg = operation + '失败';
  if (err && err.message) {
    if (err.message.indexOf('timeout') !== -1) {
      msg = '网络超时，请重试';
    } else if (err.message.indexOf('network') !== -1) {
      msg = '网络连接失败';
    }
  }
  
  wx.showToast({
    title: msg,
    icon: 'none',
    duration: 2000
  });
}

/**
 * 显示成功提示
 * @param {String} msg - 成功消息
 */
function showSuccess(msg) {
  wx.showToast({
    title: msg || '操作成功',
    icon: 'success',
    duration: 1500
  });
}

/**
 * 显示加载提示
 * @param {String} msg - 加载消息
 */
function showLoading(msg) {
  wx.showLoading({
    title: msg || '加载中...',
    mask: true
  });
}

/**
 * 隐藏加载提示
 */
function hideLoading() {
  wx.hideLoading();
}

/**
 * 显示确认对话框
 * @param {String} title - 标题
 * @param {String} content - 内容
 * @returns {Promise} 返回确认结果
 */
function showConfirm(title, content) {
  return new Promise(function (resolve) {
    wx.showModal({
      title: title,
      content: content,
      success: function (res) {
        resolve(res.confirm);
      },
      fail: function () {
        resolve(false);
      }
    });
  });
}

module.exports = {
  handleError: handleError,
  handleCloudError: handleCloudError,
  showSuccess: showSuccess,
  showLoading: showLoading,
  hideLoading: hideLoading,
  showConfirm: showConfirm
};
