export default function VersionCheckPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>部署版本检查</h1>
      <p><strong>当前版本:</strong> 2026-02-25 14:20 GMT+7</p>
      <p><strong>状态:</strong> ✅ 双语版本已部署</p>
      <p><strong>标题:</strong> 保险公司高管信息图谱 - 双语版本已部署</p>
      <p><strong>构建时间:</strong> 2026-02-25 14:20:00</p>
      <hr />
      <h2>验证步骤:</h2>
      <ol>
        <li>访问 <a href="/">主页面</a> 检查标题是否更新</li>
        <li>检查搜索栏占位符是否为&quot;姓名/公司/学校&quot;</li>
        <li>检查筛选器标签是否更新为&quot;公司类型&quot;</li>
        <li>检查职位筛选是否只有3个选项</li>
      </ol>
      <hr />
      <h2>部署信息:</h2>
      <ul>
        <li><strong>Git提交:</strong> 8f349d4</li>
        <li><strong>提交时间:</strong> 2026-02-25 14:18 GMT+7</li>
        <li><strong>Vercel状态:</strong> 构建成功，静态文件已部署</li>
        <li><strong>问题:</strong> 主页面可能被缓存</li>
      </ul>
    </div>
  );
}