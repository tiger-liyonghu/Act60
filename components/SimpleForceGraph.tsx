"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { Executive, Relationship, GraphData, Region, RelType } from "@/lib/types";
import { REGION_COLOR, REL_COLOR } from "@/lib/types";
import { sampleNodesByDegree, PerformanceMonitor, debounce } from "@/lib/performance";

interface Props {
  data: GraphData;
  selectedId: number | null;
  onSelectNode: (exec: Executive) => void;
  filterRegion: Region | "ALL";
  filterRelType: RelType | "ALL";
  searchName: string;
  enableSampling?: boolean;
  degreeThreshold?: number;
}

export default function SimpleForceGraph({
  data,
  selectedId,
  onSelectNode,
  filterRegion,
  filterRelType,
  searchName,
  enableSampling = true,
  degreeThreshold = 5,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [performanceStats, setPerformanceStats] = useState<{
    nodes: number;
    links: number;
    renderTime?: number;
  }>({ nodes: 0, links: 0 });

  // 性能监控
  const perfMonitor = PerformanceMonitor.getInstance();

  // 数据预处理和采样
  const processedData = useMemo(() => {
    const stopTimer = perfMonitor.start("data_processing");
    
    // 基础过滤
    const searchLower = searchName.toLowerCase();
    const filteredNodes = data.nodes.filter((n) => {
      if (filterRegion !== "ALL" && n.region !== filterRegion) return false;
      if (searchLower && !n.name.toLowerCase().includes(searchLower) &&
          !n.company.toLowerCase().includes(searchLower) &&
          !n.extracted.schools.some((s) => s.toLowerCase().includes(searchLower))) return false;
      return true;
    });

    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = data.links.filter((l) => {
      const sid = typeof l.source === "object" ? l.source.id : (l.source as number);
      const tid = typeof l.target === "object" ? l.target.id : (l.target as number);
      if (!filteredNodeIds.has(sid) || !filteredNodeIds.has(tid)) return false;
      if (filterRelType !== "ALL" && l.type !== filterRelType) return false;
      return true;
    });

    // 如果启用采样，对数据进行聚合
    if (enableSampling && filteredNodes.length > 100) {
      const sampled = sampleNodesByDegree(
        filteredNodes,
        filteredLinks.map(l => ({
          source: typeof l.source === "object" ? l.source.id : l.source,
          target: typeof l.target === "object" ? l.target.id : l.target,
          type: l.type
        })),
        degreeThreshold
      );

      // 合并采样节点和聚合节点
      const allNodes = [
        ...sampled.sampledNodes,
        ...sampled.aggregatedNodes.map(agg => ({
          ...agg,
          extracted: { schools: [], degrees: [], companies: [] },
          website: '',
          bio: '',
          identity: ''
        } as Executive))
      ];

      // 合并连接
      const allLinks = [
        ...sampled.sampledLinks.map(l => ({
          source: l.source,
          target: l.target,
          type: (l as any).type || 'unknown',
          strength: 0.5,
          label: ''
        })),
        ...sampled.aggregatedLinks.map(l => ({
          source: l.source,
          target: l.target,
          type: l.type,
          strength: Math.min(0.8, 0.3 + l.count * 0.05),
          label: `${l.count}个连接`
        }))
      ];

      stopTimer?.();
      return { nodes: allNodes, links: allLinks };
    }

    stopTimer?.();
    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, filterRegion, filterRelType, searchName, enableSampling, degreeThreshold]);

  // 简化的绘图函数（不使用D3力导向图）
  const draw = useCallback(async () => {
    if (!svgRef.current || !containerRef.current) return;
    
    setIsLoading(true);
    const renderTimer = perfMonitor.start("graph_render");

    try {
      const d3 = await import("d3");

      // 清理之前的图形
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const width = containerRef.current.clientWidth || 800;
      const height = containerRef.current.clientHeight || 600;
      svgRef.current.setAttribute("width", String(width));
      svgRef.current.setAttribute("height", String(height));

      const { nodes, links } = processedData;

      // 更新性能统计
      setPerformanceStats({
        nodes: nodes.length,
        links: links.length,
        renderTime: undefined
      });

      if (nodes.length === 0) {
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#94a3b8")
          .text("没有找到匹配的数据");
        setIsLoading(false);
        return;
      }

      // 计算连接度
      const degree = new Map<number, number>();
      links.forEach((l) => {
        const sid = typeof l.source === "object" ? l.source.id : (l.source as number);
        const tid = typeof l.target === "object" ? l.target.id : (l.target as number);
        degree.set(sid, (degree.get(sid) || 0) + 1);
        degree.set(tid, (degree.get(tid) || 0) + 1);
      });

      const nodeRadius = (n: Executive) => {
        const deg = degree.get(n.id) || 0;
        if (n.id < 0) return Math.max(15, Math.min(30, 15 + deg * 0.3));
        return Math.max(5, Math.min(20, 5 + deg * 0.6));
      };

      // 创建分组
      const g = svg.append("g");

      // 缩放
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => g.attr("transform", event.transform));
      
      svg.call(zoom);

      // 简单布局：圆形排列
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.4;
      
      nodes.forEach((node, i) => {
        const angle = (i * 2 * Math.PI) / nodes.length;
        node.x = centerX + radius * Math.cos(angle);
        node.y = centerY + radius * Math.sin(angle);
      });

      // 绘制连接
      g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("stroke", (l: any) => REL_COLOR[l.type] || "#ccc")
        .attr("stroke-width", (l: any) => {
          const sourceId = typeof l.source === "object" ? l.source.id : l.source;
          const targetId = typeof l.target === "object" ? l.target.id : l.target;
          const isAggregated = sourceId < 0 || targetId < 0;
          return isAggregated ? 2.5 : 1.5;
        })
        .attr("stroke-opacity", 0.5)
        .attr("x1", (l: any) => {
          const source = nodes.find(n => n.id === (typeof l.source === "object" ? l.source.id : l.source));
          return source?.x || 0;
        })
        .attr("y1", (l: any) => {
          const source = nodes.find(n => n.id === (typeof l.source === "object" ? l.source.id : l.source));
          return source?.y || 0;
        })
        .attr("x2", (l: any) => {
          const target = nodes.find(n => n.id === (typeof l.target === "object" ? l.target.id : l.target));
          return target?.x || 0;
        })
        .attr("y2", (l: any) => {
          const target = nodes.find(n => n.id === (typeof l.target === "object" ? l.target.id : l.target));
          return target?.y || 0;
        });

      // 绘制节点
      const nodeSel = g.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", nodeRadius)
        .attr("fill", (n: Executive) => REGION_COLOR[n.region] || "#888")
        .attr("stroke", (n: Executive) => (n.id === selectedId ? "#fff" : "transparent"))
        .attr("stroke-width", 2)
        .attr("cx", (n: Executive) => n.x || 0)
        .attr("cy", (n: Executive) => n.y || 0)
        .style("cursor", "pointer");

      // 绘制标签
      g.append("g")
        .attr("class", "labels")
        .selectAll("text")
        .data(nodes)
        .join("text")
        .text((n: Executive) => n.name)
        .attr("font-size", (n: Executive) => n.id < 0 ? 11 : 10)
        .attr("fill", "#e2e8f0")
        .attr("pointer-events", "none")
        .attr("opacity", (n: Executive) => {
          const deg = degree.get(n.id) || 0;
          return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
        })
        .attr("x", (n: Executive) => (n.x || 0) + nodeRadius(n) + 2)
        .attr("y", (n: Executive) => (n.y || 0) + 4);

      // 交互效果
      setupInteractions(nodeSel, links, nodes, degree);

    } finally {
      setIsLoading(false);
      renderTimer?.();
      
      // 更新渲染时间
      const stats = perfMonitor.getStats("graph_render");
      if (stats) {
        setPerformanceStats(prev => ({
          ...prev,
          renderTime: Math.round(stats.avg)
        }));
      }
    }
  }, [processedData, selectedId]);

  // 设置交互效果
  const setupInteractions = useCallback((
    nodeSel: any,
    links: any[],
    nodes: Executive[],
    degree: Map<number, number>
  ) => {
    // 悬停高亮
    nodeSel
      .on("mouseover", (_event: any, hovered: Executive) => {
        const neighborIds = new Set<number>();
        links.forEach((l: any) => {
          const sid = typeof l.source === "object" ? l.source.id : l.source;
          const tid = typeof l.target === "object" ? l.target.id : l.target;
          if (sid === hovered.id) neighborIds.add(tid);
          if (tid === hovered.id) neighborIds.add(sid);
        });
        
        nodeSel.attr("opacity", (n: any) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0.15
        );
        
        (d3 as any).selectAll(".links line").attr("stroke-opacity", (l: any) => {
          const sid = typeof l.source === "object" ? l.source.id : l.source;
          const tid = typeof l.target === "object" ? l.target.id : l.target;
          return sid === hovered.id || tid === hovered.id ? 0.9 : 0.05;
        });
        
        (d3 as any).selectAll(".labels text").attr("opacity", (n: any) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0
        );
      })
      .on("mouseout", () => {
        nodeSel.attr("opacity", 1);
        (d3 as any).selectAll(".links line").attr("stroke-opacity", 0.5);
        (d3 as any).selectAll(".labels text").attr("opacity", (n: any) => {
          const deg = degree.get(n.id) || 0;
          return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
        });
      })
      .on("click", (_event: any, n: Executive) => {
        if (n.id >= 0) {
          onSelectNode(n);
        }
      });
  }, [onSelectNode]);

  // 防抖重绘
  useEffect(() => {
    const redraw = debounce(() => {
      draw();
    }, 100);

    redraw();

    const handleResize = debounce(() => {
      redraw();
    }, 250);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
          <div className="text-slate-400 text-sm animate-pulse">渲染中…</div>
        </div>
      )}
      
      {/* 性能统计 */}
      {performanceStats.renderTime && (
        <div className="absolute bottom-2 right-2 bg-slate-800/80 text-xs text-slate-400 px-2 py-1 rounded">
          {performanceStats.nodes}节点/{performanceStats.links}连接 · {performanceStats.renderTime}ms
          {enableSampling && <span className="ml-1 text-amber-400">(已优化)</span>}
        </div>
      )}
      
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}