# 吃药提醒微信小程序

一个帮助用户管理药品、设置提醒、记录服药情况的微信小程序。

## 功能特点

- **微信登录** - 一键授权登录
- **药品管理** - 添加、编辑、删除药品
- **库存管理** - 追踪药品库存，库存不足时提醒
- **用药周期** - 支持设置用药天数
- **智能提醒** - 精确到分钟的提醒时间
- **服药记录** - 记录每次服药情况
- **统计分析** - 查看服药依从性统计

## 项目结构

```
medicine-reminder/
├── cloudfunctions/           # 云函数目录
│   ├── login/               # 登录云函数
│   ├── medication/          # 药品管理
│   ├── reminder/            # 提醒管理
│   ├── record/              # 服药记录
│   ├── statistics/          # 统计数据
│   └── timer/               # 定时触发器
├── miniprogram/              # 小程序目录
│   ├── pages/               # 页面
│   ├── components/          # 组件
│   ├── utils/               # 工具函数
│   └── images/              # 图片资源
└── project.config.json      # 项目配置
```

## 快速开始

### 1. 注册小程序

1. 访问 [微信公众平台](https://mp.weixin.qq.com/)
2. 注册小程序账号
3. 获取 AppID

### 2. 开通云开发

1. 下载并安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
2. 导入项目
3. 开通云开发环境
4. 记录云开发环境 ID

### 3. 配置项目

1. 打开 `project.config.json`，替换 `appid` 为你的 AppID
2. 打开 `miniprogram/app.js`，替换 `YOUR_CLOUD_ENV_ID` 为你的云开发环境 ID

### 4. 部署云函数

在微信开发者工具中：
1. 右键点击 `cloudfunctions` 下的每个文件夹
2. 选择"上传并部署：云端安装依赖"

### 5. 创建数据库集合

在云开发控制台创建以下集合：
- `users`
- `medications`
- `reminders`
- `records`

### 6. 配置定时触发器

在云开发控制台 > 云函数 > timer > 触发器：
- 配置定时触发器，每分钟执行一次

### 7. 申请订阅消息模板

1. 登录微信公众平台
2. 进入"功能" > "订阅消息"
3. 申请以下模板：
   - 服药提醒
   - 库存预警

替换 `cloudfunctions/timer/index.js` 中的模板 ID。

## 数据库集合

### users（用户表）
```javascript
{
  _id: "openid",
  nickName: "用户昵称",
  avatarUrl: "头像URL",
  createdAt: Date
}
```

### medications（药品表）
```javascript
{
  _id: "auto",
  userId: "openid",
  name: "药品名称",
  dosage: "1片",
  numericDosage: 1,
  stockUnit: "片",
  frequency: "每天3次",
  times: ["08:30", "12:00", "20:30"],
  stock: 30,
  stockWarning: 10,
  duration: 7,
  startDate: "2026-06-08",
  isActive: true,
  createdAt: Date
}
```

### reminders（提醒表）
```javascript
{
  _id: "auto",
  userId: "openid",
  medicationId: "xxx",
  scheduledTime: Date,
  status: "pending",
  createdAt: Date
}
```

### records（服药记录表）
```javascript
{
  _id: "auto",
  userId: "openid",
  medicationId: "xxx",
  reminderId: "xxx",
  takenAt: Date,
  status: "taken",
  createdAt: Date
}
```

## 使用说明

### 添加药品
1. 点击底部导航"药品"
2. 点击"添加药品"按钮
3. 填写药品信息
4. 保存

### 查看今日提醒
1. 打开小程序，默认显示首页
2. 查看今日需要服用的药品
3. 服药后点击"服药"按钮

### 查看记录
1. 点击底部导航"记录"
2. 选择日期查看服药记录

### 查看统计
1. 点击底部导航"统计"
2. 查看服药依从性

## 注意事项

1. **订阅消息权限** - 每次发送订阅消息需要用户授权
2. **云函数超时** - 默认20秒，复杂逻辑需优化
3. **数据库索引** - 建议为常用查询字段建立索引
4. **定时触发器** - 需要在云开发控制台配置

## License

MIT
