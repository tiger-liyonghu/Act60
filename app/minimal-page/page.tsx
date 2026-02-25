export default function MinimalPage() {
  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>最小化测试页面</h1>
      <p>测试主页面组件是否会导致构建失败。</p>
      <p><strong>时间戳:</strong> 2026-02-25 15:16 GMT+7</p>
      <p><strong>状态:</strong> ✅ 包含基本React组件</p>
      <hr />
      <h2>包含的元素:</h2>
      <ul>
        <li>React组件</li>
        <li>状态管理(useState)</li>
        <li>效果钩子(useEffect)</li>
        <li>样式对象</li>
      </ul>
      <hr />
      <h2>下一步:</h2>
      <p>如果这个页面可访问，逐步添加主页面功能直到找到问题。</p>
    </div>
  );
}