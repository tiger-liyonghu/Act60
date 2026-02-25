"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";

// 简化版的ForceGraph组件
const SimpleGraph = dynamic(() => import("@/components/SimpleForceGraph"), {
  ssr: false,
  loading: () => <div>加载图谱中...</div>,
});

// 简化类型
type Executive = {
  id: number;
  name: string;
  title: string;
  company: string;
  region: string;
};

type Relationship = {
  source: number;
  target: number;
  type: string;
};

export default function NewHomePage() {
  const [executives, setExecutives] = useState<Executive[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 模拟数据
    const mockExecutives: Executive[] = [
      { id: 1, name: "测试高管1", title: "董事长", company: "测试保险公司", region: "北京" },
      { id: 2, name: "测试高管2", title: "总经理", company: "测试保险公司", region: "上海" },
      { id: 3, name: "测试高管3", title: "精算师", company: "测试再保险公司", region: "深圳" },
    ];

    const mockRelationships: Relationship[] = [
      { source: 1, target: 2, type: "同事" },
      { source: 2, target: 3, type: "合作" },
    ];

    setTimeout(() => {
      setExecutives(mockExecutives);
      setRelationships(mockRelationships);
      setLoading(false);
    }, 1000);
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h1>保险公司高管信息图谱 - 新版本</h1>
        <p>加载数据中...</p>
      </div>
    );
  }

  const graphData = {
    nodes: executives,
    links: relationships,
  };

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '10px 20px', background: '#1e293b', color: 'white' }}>
        <h1 style={{ margin: 0, fontSize: '18px' }}>
          保险公司高管信息图谱 - 新版本 (测试)
        </h1>
        <p style={{ margin: '5px 0 0 0', fontSize: '12px', opacity: 0.8 }}>
          高管: {executives.length}人, 关系: {relationships.length}条
        </p>
      </header>

      <div style={{ flex: 1, position: 'relative' }}>
        <SimpleGraph
          data={graphData}
          selectedId={null}
          onSelectNode={(exec) => console.log('选中:', exec)}
          filterRegion="ALL"
          filterRelType="ALL"
          searchName=""
          enableSampling={false}
          degreeThreshold={0}
        />
      </div>

      <footer style={{ padding: '10px', background: '#f8f9fa', textAlign: 'center', fontSize: '12px' }}>
        <p>部署时间: 2026-02-25 15:20 GMT+7 | 版本: 新主页测试版</p>
        <p>
          <a href="/" style={{ marginRight: '10px' }}>返回旧版本</a>
          <a href="/simple-test">测试页面</a>
        </p>
      </footer>
    </div>
  );
}