// 云函数入口文件 - login
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openid = wxContext.OPENID;
  const db = cloud.database();

  try {
    // 查询用户是否存在
    const userRes = await db.collection('users').doc(openid).get().catch(() => null);

    if (userRes && userRes.data) {
      // 用户已存在，返回用户信息
      return {
        code: 0,
        data: {
          openid: openid,
          userInfo: userRes.data
        }
      };
    } else {
      // 创建新用户
      const newUser = {
        _id: openid,
        nickName: '用户',
        avatarUrl: '',
        createdAt: db.serverDate()
      };

      await db.collection('users').add({ data: newUser });

      return {
        code: 0,
        data: {
          openid: openid,
          userInfo: newUser
        }
      };
    }
  } catch (err) {
    console.error('登录失败:', err);
    return {
      code: -1,
      message: '登录失败'
    };
  }
};
