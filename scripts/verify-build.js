#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 验证构建输出...');
console.log('========================================');

// 检查.next目录
const nextDir = path.join(__dirname, '..', '.next');
if (!fs.existsSync(nextDir)) {
  console.error('❌ .next目录不存在 - 构建失败');
  process.exit(1);
}

// 检查构建输出
const buildManifest = path.join(nextDir, 'build-manifest.json');
if (!fs.existsSync(buildManifest)) {
  console.error('❌ build-manifest.json不存在 - 构建不完整');
  process.exit(1);
}

// 检查页面
const appPage = path.join(__dirname, '..', '.next', 'server', 'app', 'page.js');
if (!fs.existsSync(appPage)) {
  console.error('❌ 主页面未构建 - app/page.js不存在');
  process.exit(1);
}

// 检查版本检查页面
const versionPage = path.join(__dirname, '..', '.next', 'server', 'app', 'version-check', 'page.js');
if (!fs.existsSync(versionPage)) {
  console.error('❌ 版本检查页面未构建');
  process.exit(1);
}

// 检查构建内容
try {
  const manifest = JSON.parse(fs.readFileSync(buildManifest, 'utf8'));
  const pageCount = Object.keys(manifest.pages || {}).length;
  const appPageCount = Object.keys(manifest.app || {}).length;
  
  console.log(`✅ 构建验证通过:`);
  console.log(`   - .next目录存在`);
  console.log(`   - build-manifest.json存在`);
  console.log(`   - 主页面构建完成`);
  console.log(`   - 版本检查页面构建完成`);
  console.log(`   - 页面数量: ${pageCount}`);
  console.log(`   - App路由页面: ${appPageCount}`);
  
  // 检查主页面内容
  const pageContent = fs.readFileSync(appPage, 'utf8');
  if (pageContent.includes('保险公司高管信息图谱')) {
    console.log(`✅ 主页面包含新标题`);
  } else {
    console.warn(`⚠️  主页面可能不包含新标题`);
  }
  
} catch (error) {
  console.error('❌ 构建验证失败:', error.message);
  process.exit(1);
}

console.log('========================================');
console.log('✅ 所有检查通过 - 构建成功');