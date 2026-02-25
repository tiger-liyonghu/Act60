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

export default function OptimizedForceGraph({
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
  const simulationRef = useRef<any>(null);
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
          strength: Math.min(0.8, 0.3 + l.count * 0.05), // 聚合连接更强
          label: `${l.count}个连接`
        }))
      ];

      stopTimer?.();
      return { nodes: allNodes, links: allLinks };
    }

    stopTimer?.();
    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, filterRegion, filterRelType, searchName, enableSampling, degreeThreshold]);

  // 优化的绘图函数
  const draw = useCallback(async () => {
    if (!svgRef.current || !containerRef.current) return;
    
    setIsLoading(true);
    const renderTimer = perfMonitor.start("graph_render");

    try {
      const d3 = await import("d3");

      // 清理之前的图形
      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      if (simulationRef.current) {
        simulationRef.current.stop();
        simulationRef.current = null;
      }

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
        // 显示空状态
        svg.append("text")
          .attr("x", width / 2)
          .attr("y", height / 2)
          .attr("text-anchor", "middle")
          .attr("fill", "#94a3b8")
          .text("没有找到匹配的数据");
        setIsLoading(false);
        return;
      }

      // 计算连接度（用于节点大小）
      const degree = new Map<number, number>();
      links.forEach((l) => {
        const sid = typeof l.source === "object" ? l.source.id : (l.source as number);
        const tid = typeof l.target === "object" ? l.target.id : (l.target as number);
        degree.set(sid, (degree.get(sid) || 0) + 1);
        degree.set(tid, (degree.get(tid) || 0) + 1);
      });

      const nodeRadius = (n: Executive) => {
        const deg = degree.get(n.id) || 0;
        // 聚合节点更大
        if (n.id < 0) return Math.max(15, Math.min(30, 15 + deg * 0.3));
        return Math.max(5, Math.min(20, 5 + deg * 0.6));
      };

      // 准备数据
      const simulationNodes: Executive[] = nodes.map((n) => ({ ...n }));
      const simulationLinks = links.map((l) => ({
        ...l,
        source: typeof l.source === "object" ? l.source.id : l.source,
        target: typeof l.target === "object" ? l.target.id : l.target,
      }));

      // 创建力导向图模拟
      const simulation = d3
        .forceSimulation(simulationNodes as d3.SimulationNodeDatum[])
        .force(
          "link",
          d3
            .forceLink(simulationLinks)
            .id((d: d3.SimulationNodeDatum) => (d as Executive).id)
            .distance((l: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) => {
              const link = l as unknown as Relationship;
              // 聚合连接距离更远
              const source = simulationNodes.find(n => n.id === (link.source as number));
              const target = simulationNodes.find(n => n.id === (link.target as number));
              const isAggregated = (source?.id || 0) < 0 || (target?.id || 0) < 0;
              return isAggregated ? 150 : 80;
            })
            .strength((l: d3.SimulationLinkDatum<d3.SimulationNodeDatum>) =>
              ((l as unknown as Relationship).strength || 0.5) * 0.3
            )
        )
        .force("charge", d3.forceManyBody().strength(-120))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collision", d3.forceCollide().radius((d) => nodeRadius(d as Executive) + 2))
        .alphaDecay(0.02) // 更快的衰减
        .velocityDecay(0.4);

      simulationRef.current = simulation;

      // 缩放
      const g = svg.append("g");
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 8])
        .on("zoom", (event) => g.attr("transform", event.transform));
      
      svg.call(zoom);

      // 绘制连接
      const linkSel = g
        .append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(simulationLinks)
        .join("line")
        .attr("stroke", (l) => REL_COLOR[(l as unknown as Relationship).type] || "#ccc")
        .attr("stroke-width", (l) => {
          const link = l as unknown as Relationship;
          // 聚合连接更粗
          const source = simulationNodes.find(n => n.id === (link.source as number));
          const target = simulationNodes.find(n => n.id === (link.target as number));
          const isAggregated = (source?.id || 0) < 0 || (target?.id || 0) < 0;
          return isAggregated ? 2.5 : 1.5;
        })
        .attr("stroke-opacity", 0.5);

      // 绘制节点
      const nodeSel = g
        .append("g")
        .attr("class", "nodes")
        .selectAll<SVGCircleElement, Executive>("circle")
        .data(simulationNodes)
        .join("circle")
        .attr("r", nodeRadius)
        .attr("fill", (n) => REGION_COLOR[n.region] || "#888")
        .attr("stroke", (n) => (n.id === selectedId ? "#fff" : "transparent"))
        .attr("stroke-width", 2)
        .style("cursor", "pointer")
        .call(
          d3
            .drag<SVGCircleElement, Executive>()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      // 标签（只显示高连接度节点和聚合节点）
      const labelSel = g
        .append("g")
        .attr("class", "labels")
        .selectAll<SVGTextElement, Executive>("text")
        .data(simulationNodes)
        .join("text")
        .text((n) => n.name)
        .attr("font-size", (n) => n.id < 0 ? 11 : 10) // 聚合节点标签更大
        .attr("fill", "#e2e8f0")
        .attr("pointer-events", "none")
        .attr("opacity", (n) => {
          const deg = degree.get(n.id) || 0;
          return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
        });

      // 交互效果
      const setupInteractions = () => {
        // 悬停高亮
        nodeSel
          .on("mouseover", (_event, hovered) => {
            const neighborIds = new Set<number>();
            simulationLinks.forEach((l) => {
              const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
              const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
              if (sid === hovered.id) neighborIds.add(tid);
              if (tid === hovered.id) neighborIds.add(sid);
            });
            
            nodeSel.attr("opacity", (n) =>
              n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0.15
            );
            linkSel.attr("stroke-opacity", (l) => {
              const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
              const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
              return sid === hovered.id || tid === hovered.id ? 0.9 : 0.05;
            });
            labelSel.attr("opacity", (n) =>
              n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0
            );
          })
          .on("mouseout", () => {
            nodeSel.attr("opacity", 1);
            linkSel.attr("stroke-opacity", 0.5);
            labelSel.attr("opacity", (n) => {
              const deg = degree.get(n.id) || 0;
              return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
            });
          })
          .on("click", (_event, n) => {
            // 聚合节点不触发选择
            if (n.id >= 0) {
              onSelectNode(n);
            }
          });

        // 工具提示
        const tooltip = d3
          .select(containerRef.current)
          .append("div")
          .attr("class", "graph-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(15,23,42,0.92)")
          .style("color", "#e2e8f0")
          .style("padding", "8px 12px")
          .style("border-radius", "8px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("display", "none")
          .style("max-width", "200px")
          .style("z-index", "10");

        nodeSel
          .on("mousemove.tip", (event, n) => {
            let html = `<b>${n.name}</b>`;
            if (n.id < 0) {
              html += `<br/><span style="opacity:.7">公司聚合节点</span>`;
            } else {
              html += `<br/>${n.title}<br/><span style="opacity:.7">${n.company}</span>`;
            }
            
            tooltip
              .style("display", "block")
              .style("left", event.offsetX + 14 + "px")
              .style("top", event.offsetY - 10 + "px")
              .html(html);
          })
          .on("mouseleave.tip", () => tooltip.style("display", "none"));

        return () => tooltip.remove();
      };

      const cleanupTooltip = setupInteractions();

      // 动画更新
      simulation.on("tick", () => {
        linkSel
          .attr("x1", (l) => (l.source as unknown as Executive).x ?? 0)
          .attr("y1", (l) => (l.source as unknown as Executive).y ?? 0)
          .attr("x2", (l) => (l.target as unknown as Executive).x ?? 0)
          .attr("y2", (l) => (l.target as unknown as Executive).y ?? 0);

        nodeSel
          .attr("cx", (n) => n.x ?? 0)
          .attr("cy", (n) => n.y ?? 0);

        labelSel
          .attr("x", (n) => (n.x ?? 0) + nodeRadius(n) + 2)
          .attr("y", (n) => (n.y ?? 0) + 4);
      });

      // 停止模拟的优化版本
      const stopSimulation = debounce(() => {
        if (simulationRef.current) {
          simulationRef.current.alphaTarget(0);
          simulationRef.current.alpha(0);
          setTimeout(() => {
            if (simulationRef.current) {
              simulationRef.current.stop();
            }
          }, 1000);
        }
      }, 2000);

      // 5秒后停止模拟以节省性能
      setTimeout(stopSimulation, 5000);

      // 清理函数
      return () => {
        stopSimulation();
        cleanupTooltip?.();
        if (simulationRef.current) {
          simulationRef.current.stop();
          simulationRef.current = null;
        }
      };

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
  }, [processedData, selectedId, onSelectNode]);

  // 防抖的重绘
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    const redraw = debounce(() => {
      draw().then((fn) => { cleanup = fn; });
    }, 100);

    redraw();

    // 窗口大小变化时重绘
    const handleResize = debounce(() => {
      redraw();
    }, 250);

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cleanup?.();
    };
  }, [draw]);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-slate-900">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
          <div className="text-slate-400 text-sm animate-pulse">优化渲染中…</div>
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