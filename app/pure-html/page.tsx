export default function PureHtmlPage() {
  return (
    <html>
      <head>
        <title>纯HTML测试页面</title>
        <meta name="description" content="测试纯HTML页面部署" />
      </head>
      <body style={{ margin: 0, padding: '20px', fontFamily: 'sans-serif' }}>
        <h1>纯HTML测试页面</h1>
        <p>这个页面不依赖任何React组件或外部依赖。</p>
        <p><strong>时间戳:</strong> 2026-02-25 15:22 GMT+7</p>
        <p><strong>状态:</strong> ✅ 100%纯HTML/JSX</p>
        
        <div style={{ margin: '20px 0', padding: '15px', background: '#e8f4fd', borderRadius: '5px' }}>
          <h2>测试目的:</h2>
          <ul>
            <li>验证最基本的Next.js页面能否部署</li>
            <li>排除组件依赖问题</li>
            <li>确认Vercel构建流程</li>
          </ul>
        </div>

        <div style={{ margin: '20px 0', padding: '15px', background: '#f0f0f0', borderRadius: '5px' }}>
          <h2>部署诊断:</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#ddd' }}>
                <th style={{ padding: '8px', border: '1px solid #999' }}>页面</th>
                <th style={{ padding: '8px', border: '1px solid #999' }}>状态</th>
                <th style={{ padding: '8px', border: '1px solid #999' }}>说明</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #999' }}>/simple-test</td>
                <td style={{ padding: '8px', border: '1px solid #999', color: 'green' }}>✅ 成功</td>
                <td style={{ padding: '8px', border: '1px solid #999' }}>简单页面可访问</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #999' }}>/minimal-page</td>
                <td style={{ padding: '8px', border: '1px solid #999', color: 'green' }}>✅ 成功</td>
                <td style={{ padding: '8px', border: '1px solid #999' }}>最小化页面可访问</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #999' }}>/intermediate-page</td>
                <td style={{ padding: '8px', border: '1px solid #999', color: 'green' }}>✅ 成功</td>
                <td style={{ padding: '8px', border: '1px solid #999' }}>包含状态管理的页面可访问</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #999' }}>/new-home</td>
                <td style={{ padding: '8px', border: '1px solid #999', color: 'orange' }}>❓ 未知</td>
                <td style={{ padding: '8px', border: '1px solid #999' }}>包含组件导入的页面</td>
              </tr>
              <tr>
                <td style={{ padding: '8px', border: '1px solid #999' }}>/ (主页面)</td>
                <td style={{ padding: '8px', border: '1px solid #999', color: 'red' }}>❌ 失败</td>
                <td style={{ padding: '8px', border: '1px solid #999' }}>缓存或构建问题</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />
        
        <div style={{ marginTop: '20px', fontSize: '14px', color: '#666' }}>
          <p><strong>结论:</strong> 如果这个页面可访问，说明问题在于组件依赖或构建配置。</p>
          <p><strong>建议:</strong> 逐步添加组件依赖，找到导致构建失败的具体组件。</p>
        </div>
      </body>
    </html>
  );
}