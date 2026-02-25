export default function SimpleTestPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>简单测试页面</h1>
      <p>如果这个页面可以访问，说明Vercel构建成功。</p>
      <p><strong>时间戳:</strong> 2026-02-25 14:30 GMT+7</p>
      <p><strong>状态:</strong> ✅ 最简单的Next.js页面</p>
      <hr />
      <h2>问题诊断:</h2>
      <ul>
        <li>如果这个页面可访问 → Next.js构建成功</li>
        <li>如果主页面不可访问 → 主页面代码有问题</li>
        <li>如果都不可访问 → Vercel配置有问题</li>
      </ul>
    </div>
  );
}