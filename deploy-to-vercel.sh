#!/bin/bash

# 部署脚本：将当前前端部署到 Vercel

echo "🚀 开始部署保险行业高管关系图谱到 Vercel..."
echo "=========================================="

# 1. 检查构建
echo "📦 检查构建状态..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误"
    exit 1
fi
echo "✅ 构建成功"

# 2. 检查 Git 状态
echo "📝 检查 Git 状态..."
git status --short

# 3. 添加文件
echo "📁 添加文件到 Git..."
git add .

# 4. 提交更改
echo "💾 提交更改..."
git commit -m "部署增强版前端：添加数据可视化功能 - $(date '+%Y-%m-%d %H:%M:%S')"

# 5. 推送到 GitHub
echo "📤 推送到 GitHub..."
git push origin main

echo ""
echo "=========================================="
echo "✅ 部署已触发！"
echo ""
echo "📊 部署信息："
echo "   - 应用: 保险行业高管关系图谱"
echo "   - 版本: 1.1.0 (增强版)"
echo "   - 时间: $(date '+%Y-%m-%d %H:%M:%S GMT+7')"
echo "   - 地址: https://graph.actuaryhelp.com"
echo ""
echo "⏳ Vercel 将自动开始部署，预计 2-3 分钟完成。"
echo "🔍 监控部署状态: https://vercel.com/tiger-liyonghu"
echo "🌐 访问应用: https://graph.actuaryhelp.com"
echo ""
echo "📋 验证部署："
echo "   curl -s https://graph.actuaryhelp.com | grep '构建时间: 2026-02-26'"
echo ""