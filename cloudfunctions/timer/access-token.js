// access_token 管理及订阅消息发送
const https = require('https');

// 模板 ID 常量
var TEMPLATE_IDS = {
  REMINDER: 'HBUcX64MIUMEnf-WPQiAuatrglxdIORe4Z03ZgNHGrg',
  STOCK: 'yWIU75GOoaaRDI0eAzBRfZb8N5jOKDtKXj2PhLQ6xps',
  CYCLE: '0atsTuJOmGeeKXpCDdzMJS4-1zQh6ZPK22N0AR0SukM'
};

// access_token 缓存
var accessTokenCache = {
  token: null,
  expiresAt: 0
};

/**
 * 获取微信 access_token（带缓存，提前5分钟刷新）
 * 使用 stable_token 接口，不会使旧 token 失效
 */
function getAccessToken() {
  return new Promise(function (resolve, reject) {
    var now = Date.now();
    // 缓存有效（提前5分钟刷新避免边界过期）
    if (accessTokenCache.token && now < accessTokenCache.expiresAt - 5 * 60 * 1000) {
      return resolve(accessTokenCache.token);
    }

    var body = JSON.stringify({
      grant_type: 'client_credential',
      appid: 'wx39c8f9bad9062017',
      secret: '4021c46d0eaa267bb5a8ce7669acf97e',
      force_refresh: false
    });

    var req = https.request('https://api.weixin.qq.com/cgi-bin/stable_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function (res) {
      var data = '';
      res.on('data', function (chunk) { data += chunk; });
      res.on('end', function () {
        try {
          var result = JSON.parse(data);
          if (result.access_token) {
            accessTokenCache.token = result.access_token;
            accessTokenCache.expiresAt = now + (result.expires_in || 7200) * 1000;
            console.log('access_token 已刷新，有效期至:', new Date(accessTokenCache.expiresAt).toISOString());
            resolve(accessTokenCache.token);
          } else {
            reject(new Error('获取 access_token 失败: ' + data));
          }
        } catch (e) {
          reject(new Error('解析 access_token 响应失败: ' + data));
        }
      });
    });

    req.on('error', function (err) {
      reject(new Error('请求 access_token 网络错误: ' + err.message));
    });
    req.write(body);
    req.end();
  });
}

/**
 * 发送订阅消息（直接调微信 HTTP API，不走 cloud.openapi）
 */
function sendSubscribeMessage(openid, templateId, page, templateData) {
  return getAccessToken().then(function (token) {
    return new Promise(function (resolve, reject) {
      var body = JSON.stringify({
        touser: openid,
        template_id: templateId,
        page: page,
        data: templateData,
        miniprogram_state: 'trial',
        lang: 'zh_CN'
      });

      var req = https.request('https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=' + token, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body)
        }
      }, function (res) {
        var data = '';
        res.on('data', function (chunk) { data += chunk; });
        res.on('end', function () {
          try {
            var result = JSON.parse(data);
            if (result.errcode === 0) {
              resolve(result);
            } else {
              reject(new Error(JSON.stringify(result)));
            }
          } catch (e) {
            reject(new Error('解析订阅消息响应失败: ' + data));
          }
        });
      });

      req.on('error', function (err) {
        reject(new Error('发送订阅消息网络错误: ' + err.message));
      });
      req.write(body);
      req.end();
    });
  });
}

module.exports = {
  getAccessToken: getAccessToken,
  sendSubscribeMessage: sendSubscribeMessage,
  TEMPLATE_IDS: TEMPLATE_IDS
};
