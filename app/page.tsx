export default function HomePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
      color: 'white',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      padding: '40px 20px',
      textAlign: 'center'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ fontSize: '48px', fontWeight: 'bold', marginBottom: '20px' }}>
          保险公司高管信息图谱
        </h1>
        
        <p style={{ fontSize: '20px', opacity: 0.8, marginBottom: '40px' }}>
          保险行业高管关系可视化分析平台 - 双语版本已上线
        </p>
        
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '16px',
          padding: '40px',
          marginBottom: '40px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <h2 style={{ fontSize: '24px', marginBottom: '20px' }}>🎉 部署成功！</h2>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '30px' }}>
            <div style={{ padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#60a5fa' }}>1,494</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>保险行业高管</div>
            </div>
            
            <div style={{ padding: '20px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#34d399' }}>15,204</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>关系连接</div>
            </div>
            
            <div style={{ padding: '20px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: '#a78bfa' }}>10+</div>
              <div style={{ fontSize: '14px', opacity: 0.8 }}>保险公司</div>
            </div>
          </div>
          
          <div style={{ fontSize: '16px', lineHeight: '1.6', opacity: 0.9, marginBottom: '30px' }}>
            <p>✅ <strong>双语支持</strong>: 中文/English 界面切换</p>
            <p>✅ <strong>性能优化</strong>: 1,494个节点，15,204条关系流畅可视化</p>
            <p>✅ <strong>智能筛选</strong>: 地区、公司类型、职位、关系类型多维度筛选</p>
            <p>✅ <strong>实时搜索</strong>: 姓名、公司、学校快速搜索</p>
          </div>
          
          <button style={{
            padding: '16px 32px',
            background: '#3b82f6',
            border: 'none',
            borderRadius: '12px',
            color: 'white',
            fontSize: '18px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => (e.currentTarget.style.background = '#2563eb')}
          onMouseOut={(e) => (e.currentTarget.style.background = '#3b82f6')}>
            立即体验图谱
          </button>
        </div>
        
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: '12px',
          padding: '20px',
          fontSize: '14px',
          opacity: 0.7
        }}>
          <p style={{ margin: '0 0 10px 0' }}>
            <strong>部署信息</strong>: 版本 1.1.0 • 构建时间: 2026-02-25 15:35 GMT+7
          </p>
          <p style={{ margin: 0 }}>
            <strong>技术栈</strong>: Next.js 14 • TypeScript • D3.js • Supabase • Vercel
          </p>
        </div>
      </div>
    </div>
  );
}