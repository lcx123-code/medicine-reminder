#!/usr/bin/env node
/**
 * 创建占位图标的脚本
 * 在微信开发者工具中运行，或手动创建以下文件
 */

const fs = require('fs');
const path = require('path');

// 简单的 1x1 PNG 图片 base64 数据
const placeholderPNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// 需要创建的图标文件
const icons = [
  'home.png',
  'home-active.png',
  'medicine.png',
  'medicine-active.png',
  'record.png',
  'record-active.png',
  'chart.png',
  'chart-active.png',
  'empty.png'
];

const imagesDir = path.join(__dirname, 'miniprogram', 'images');

// 确保目录存在
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// 创建占位图标
icons.forEach(icon => {
  const filePath = path.join(imagesDir, icon);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, placeholderPNG);
    console.log(`✓ Created: ${icon}`);
  } else {
    console.log(`- Exists: ${icon}`);
  }
});

console.log('\n✅ 占位图标创建完成！');
console.log('\n注意：这些是占位图标，建议替换为实际的图标文件。');
console.log('图标尺寸建议：81x81 像素');
