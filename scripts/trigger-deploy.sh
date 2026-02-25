#!/bin/bash

echo "🚀 触发Vercel部署脚本"
echo "========================"

# 方法1: 使用curl直接触发（如果有部署钩子）
# 部署钩子URL通常格式: https://api.vercel.com/v1/integrations/deploy/...

echo "1. 尝试通过GitHub推送触发..."
echo "   最新提交: $(git log --oneline -1)"

echo -e "\n2. 检查当前部署状态..."
curl -s https://graph.actuaryhelp.com/ | grep -o '<title>[^<]*</title>' | sed 's/<title>//;s/<\/title>//'

echo -e "\n3. 检查缓存状态..."
curl -s -I https://graph.actuaryhelp.com/ | grep -i "age\|vercel-cache"

echo -e "\n4. 尝试强制刷新..."
# 添加随机参数绕过缓存
RANDOM_PARAM="force_$(date +%s)"
curl -s "https://graph.actuaryhelp.com/?$RANDOM_PARAM" | grep -o '<title>[^<]*</title>' | sed 's/<title>//;s/<\/title>//'

echo -e "\n========================"
echo "📋 建议操作:"
echo "1. 登录Vercel控制台: https://vercel.com/tiger-liyonghu/Act60"
echo "2. 检查项目设置 → Git集成"
echo "3. 手动点击 'Redeploy'"
echo "4. 或使用Vercel CLI: vercel --prod"
echo "5. 清除浏览器缓存后访问: https://graph.actuaryhelp.com/?force_refresh=true"