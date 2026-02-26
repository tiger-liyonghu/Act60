# Vercel 部署触发器

## 部署信息
- **应用名称**: 保险行业高管关系图谱
- **当前版本**: 1.1.0 (增强版)
- **构建时间**: 2026-02-26 20:40 GMT+7
- **目标环境**: Vercel 生产环境
- **部署地址**: https://graph.actuaryhelp.com

## 部署内容
### ✅ 前端功能
1. **数据可视化图表** - 力导向图展示保险公司关系
2. **响应式布局** - 支持桌面和移动端
3. **筛选面板** - 公司类型、地区筛选
4. **数据统计** - 实时显示数据概览
5. **性能监控** - 系统状态显示

### ✅ 数据展示
- 137家保险公司
- 1,494名高管人员  
- 15,204条关系连接
- 84.5%数据完整度

## 部署步骤

### 方法一：通过 Git 推送（推荐）
```bash
cd ./graph-app
git add .
git commit -m "部署增强版前端：添加数据可视化功能"
git push origin main
```

### 方法二：Vercel CLI 部署
```bash
cd ./graph-app
npx vercel --prod
```

### 方法三：手动触发
1. 访问 Vercel 控制台: https://vercel.com/tiger-liyonghu
2. 选择项目: graph-app
3. 点击 "Redeploy"

## 验证部署
```bash
# 检查部署状态
curl -s https://graph.actuaryhelp.com | grep "构建时间: 2026-02-26"

# 检查功能
open https://graph.actuaryhelp.com
```

## 回滚方案
如果部署失败，回滚到上一个版本：
```bash
# Vercel 控制台 -> Deployments -> 选择上一个版本 -> Promote to Production
```

## 联系方式
- **项目负责人**: Tiger
- **技术支持**: OpenClaw AI
- **部署时间**: 2026-02-26 20:40 GMT+7