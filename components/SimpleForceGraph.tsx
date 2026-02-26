"use client";

import { useEffect, useRef } from "react";

interface Node {
  id: string;
  name: string;
  type: "company" | "executive";
  size: number;
  color: string;
}

interface Link {
  source: string;
  target: string;
  type: string;
}

interface GraphData {
  nodes: Node[];
  links: Link[];
}

interface Props {
  data?: GraphData;
}

export default function SimpleForceGraph({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // 默认数据
  const defaultData: GraphData = {
    nodes: [
      { id: "1", name: "中国人寿", type: "company", size: 40, color: "#3b82f6" },
      { id: "2", name: "中国平安", type: "company", size: 45, color: "#3b82f6" },
      { id: "3", name: "太平洋保险", type: "company", size: 35, color: "#3b82f6" },
      { id: "4", name: "张三", type: "executive", size: 20, color: "#10b981" },
      { id: "5", name: "李四", type: "executive", size: 20, color: "#10b981" },
      { id: "6", name: "王五", type: "executive", size: 20, color: "#10b981" },
    ],
    links: [
      { source: "1", target: "4", type: "employment" },
      { source: "1", target: "5", type: "employment" },
      { source: "2", target: "5", type: "employment" },
      { source: "2", target: "6", type: "employment" },
      { source: "3", target: "4", type: "employment" },
      { source: "3", target: "6", type: "employment" },
    ],
  };

  const graphData = data || defaultData;

  useEffect(() => {
    const drawGraph = async () => {
      if (!containerRef.current || !svgRef.current) return;

      // 动态导入 d3
      const d3 = await import("d3");

      // 清除之前的图形
      d3.select(svgRef.current).selectAll("*").remove();

      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;

      // 设置 SVG 尺寸
      svgRef.current.setAttribute("width", width.toString());
      svgRef.current.setAttribute("height", height.toString());

      const svg = d3.select(svgRef.current);

      // 创建力导向模拟
      const simulation = d3.forceSimulation(graphData.nodes as any)
        .force("link", d3.forceLink(graphData.links)
          .id((d: any) => d.id)
          .distance(100))
        .force("charge", d3.forceManyBody().strength(-300))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((d: any) => d.size + 5));

      // 创建连线
      const link = svg.append("g")
        .selectAll("line")
        .data(graphData.links)
        .enter()
        .append("line")
        .attr("stroke", "#94a3b8")
        .attr("stroke-width", 2)
        .attr("stroke-opacity", 0.6);

      // 创建节点
      const node = svg.append("g")
        .selectAll("circle")
        .data(graphData.nodes)
        .enter()
        .append("circle")
        .attr("r", (d: any) => d.size)
        .attr("fill", (d: any) => d.color)
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .call((d3.drag() as any)
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended));

      // 添加节点标签
      const label = svg.append("g")
        .selectAll("text")
        .data(graphData.nodes)
        .enter()
        .append("text")
        .text((d: any) => d.name)
        .attr("font-size", "12px")
        .attr("fill", "#e2e8f0")
        .attr("text-anchor", "middle")
        .attr("dy", (d: any) => -d.size - 5);

      // 更新位置函数
      function ticked() {
        link
          .attr("x1", (d: any) => d.source.x)
          .attr("y1", (d: any) => d.source.y)
          .attr("x2", (d: any) => d.target.x)
          .attr("y2", (d: any) => d.target.y);

        node
          .attr("cx", (d: any) => d.x)
          .attr("cy", (d: any) => d.y);

        label
          .attr("x", (d: any) => d.x)
          .attr("y", (d: any) => d.y);
      }

      // 拖拽函数
      function dragstarted(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(event: any, d: any) {
        d.fx = event.x;
        d.fy = event.y;
      }

      function dragended(event: any, d: any) {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      }

      // 监听模拟更新
      simulation.on("tick", ticked);

      // 响应窗口大小变化
      const resizeObserver = new ResizeObserver(() => {
        if (containerRef.current) {
          const newWidth = containerRef.current.clientWidth;
          const newHeight = containerRef.current.clientHeight;
          svgRef.current?.setAttribute("width", newWidth.toString());
          svgRef.current?.setAttribute("height", newHeight.toString());
          simulation.force("center", d3.forceCenter(newWidth / 2, newHeight / 2));
          simulation.alpha(0.3).restart();
        }
      });

      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      return () => {
        resizeObserver.disconnect();
        simulation.stop();
      };
    };

    drawGraph();
  }, [graphData]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} className="w-full h-full" />
      
      {/* 图例 */}
      <div className="absolute bottom-4 left-4 bg-gray-900/80 backdrop-blur-sm rounded-lg p-4 border border-gray-800">
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-blue-500"></div>
            <span className="text-sm text-gray-300">保险公司</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-green-500"></div>
            <span className="text-sm text-gray-300">高管人员</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-gray-400"></div>
            <span className="text-sm text-gray-300">任职关系</span>
          </div>
        </div>
      </div>

      {/* 控制按钮 */}
      <div className="absolute top-4 right-4 flex space-x-2">
        <button 
          className="px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded text-sm transition"
          onClick={() => window.location.reload()}
        >
          重置视图
        </button>
        <button 
          className="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm transition"
          onClick={() => alert('导出功能开发中')}
        >
          导出
        </button>
      </div>
    </div>
  );
}