"use client";

import { useState, useEffect } from "react";

export default function IntermediatePage() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟数据加载
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div style={{ padding: '20px', fontFamily: 'sans-serif' }}>
      <h1>中级测试页面</h1>
      <p>测试包含状态和效果的页面。</p>
      <p><strong>时间戳:</strong> 2026-02-25 15:17 GMT+7</p>
      <p><strong>状态:</strong> ✅ 包含useState和useEffect</p>
      
      <div style={{ margin: '20px 0', padding: '10px', background: '#f0f0f0' }}>
        <p>计数器: {count}</p>
        <button 
          onClick={() => setCount(count + 1)}
          style={{ padding: '5px 10px', marginRight: '10px' }}
        >
          增加
        </button>
        <button 
          onClick={() => setCount(0)}
          style={{ padding: '5px 10px' }}
        >
          重置
        </button>
      </div>

      <hr />
      <h2>包含的功能:</h2>
      <ul>
        <li>"use client"指令</li>
        <li>useState状态管理</li>
        <li>useEffect副作用</li>
        <li>条件渲染</li>
        <li>事件处理</li>
        <li>内联样式</li>
      </ul>
    </div>
  );
}