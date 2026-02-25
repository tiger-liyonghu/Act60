"use client";

import { useEffect, useRef, useCallback, useState, useMemo } from "react";
import type { Executive, Relationship, GraphData, Region, RelType } from "@/lib/types";
import { REGION_COLOR, REL_COLOR } from "@/lib/types";
import { sampleNodesByDegree, PerformanceMonitor, debounce } from "@/lib/performance";
import { getWorkerManager, type WorkerNode, type WorkerLink } from "@/lib/worker-manager";

interface Props {
  data: GraphData;
  selectedId: number | null;
  onSelectNode: (exec: Executive) => void;
  filterRegion: Region | "ALL";
  filterRelType: RelType | "ALL";
  searchName: string;
  enableSampling?: boolean;
  degreeThreshold?: number;
  useWorker?: boolean;
}

export default function WorkerForceGraph({
  data,
  selectedId,
  onSelectNode,
  filterRegion,
  filterRelType,
  searchName,
  enableSampling = true,
  degreeThreshold = 5,
  useWorker = true,
}: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Map<number, Executive>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [workerStatus, setWorkerStatus] = useState<{
    supported: boolean;
    initialized: boolean;
    active: boolean;
  }>({ supported: false, initialized: false, active: false });
  const [performanceStats, setPerformanceStats] = useState<{
    nodes: number;
    links: number;
    renderTime?: number;
    workerTime?: number;
  }>({ nodes: 0, links: 0 });

  // 性能监控
  const perfMonitor = PerformanceMonitor.getInstance();

  // Worker管理器
  const workerManager = useMemo(() => {
    if (useWorker && typeof Worker !== 'undefined') {
      return getWorkerManager();
    }
    return null;
  }, [useWorker]);

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

      // 存储节点映射
      nodesRef.current.clear();
      allNodes.forEach(node => {
        nodesRef.current.set(node.id, node);
      });

      stopTimer?.();
      return { nodes: allNodes, links: allLinks };
    }

    // 存储节点映射
    nodesRef.current.clear();
    filteredNodes.forEach(node => {
      nodesRef.current.set(node.id, node);
    });

    stopTimer?.();
    return { nodes: filteredNodes, links: filteredLinks };
  }, [data, filterRegion, filterRelType, searchName, enableSampling, degreeThreshold]);

  // 初始化Worker
  useEffect(() => {
    if (!workerManager || !useWorker) {
      setWorkerStatus({ supported: false, initialized: false, active: false });
      return;
    }

    const initWorker = async () => {
      try {
        const { nodes, links } = processedData;
        
        if (nodes.length === 0) {
          return;
        }

        const width = containerRef.current?.clientWidth || 800;
        const height = containerRef.current?.clientHeight || 600;

        // 准备Worker数据
        const workerNodes: WorkerNode[] = nodes.map(node => ({
          id: node.id,
          x: Math.random() * width,
          y: Math.random() * height,
          degree: data.links.filter(l => {
            const sid = typeof l.source === "object" ? l.source.id : l.source;
            const tid = typeof l.target === "object" ? l.target.id : l.target;
            return sid === node.id || tid === node.id;
          }).length
        }));

        const workerLinks: WorkerLink[] = links.map(link => ({
          source: typeof link.source === "object" ? link.source.id : link.source,
          target: typeof link.target === "object" ? link.target.id : link.target,
          distance: link.source < 0 || link.target < 0 ? 150 : 80, // 聚合节点距离更远
          strength: link.strength || 0.5
        }));

        // 初始化Worker
        await workerManager.initialize({
          width,
          height,
          nodes: workerNodes,
          links: workerLinks
        });

        // 设置消息处理器
        workerManager.on('TICK', (tickData) => {
          // 更新节点位置
          tickData.nodes.forEach(workerNode => {
            const node = nodesRef.current.get(workerNode.id);
            if (node) {
              node.x = workerNode.x;
              node.y = workerNode.y;
            }
          });
          
          // 触发重绘
          drawNodes();
        });

        workerManager.on('INITIALIZED', () => {
          setWorkerStatus(prev => ({ ...prev, initialized: true }));
          console.log('Worker初始化完成');
        });

        workerManager.on('STARTED', () => {
          setWorkerStatus(prev => ({ ...prev, active: true }));
        });

        workerManager.on('STOPPED', () => {
          setWorkerStatus(prev => ({ ...prev, active: false }));
        });

        workerManager.on('END', () => {
          setWorkerStatus(prev => ({ ...prev, active: false }));
        });

        workerManager.onError((error) => {
          console.error('Worker错误:', error);
          setWorkerStatus({ supported: true, initialized: false, active: false });
        });

        setWorkerStatus({ supported: true, initialized: true, active: false });

        // 5秒后停止Worker模拟以节省性能
        setTimeout(() => {
          if (workerManager) {
            workerManager.stop();
          }
        }, 5000);

      } catch (error) {
        console.error('初始化Worker失败:', error);
        setWorkerStatus({ supported: true, initialized: false, active: false });
      }
    };

    initWorker();

    return () => {
      if (workerManager) {
        workerManager.stop();
      }
    };
  }, [workerManager, useWorker, processedData]);

  // 绘制节点和连接（不使用D3模拟）
  const drawNodes = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    
    // 更新节点位置
    svg.selectAll(".node")
      .attr("cx", (d: any) => d.x || 0)
      .attr("cy", (d: any) => d.y || 0);

    // 更新连接位置
    svg.selectAll(".link")
      .attr("x1", (d: any) => d.source.x || 0)
      .attr("y1", (d: any) => d.source.y || 0)
      .attr("x2", (d: any) => d.target.x || 0)
      .attr("y2", (d: any) => d.target.y || 0);

    // 更新标签位置
    svg.selectAll(".label")
      .attr("x", (d: any) => (d.x || 0) + (d.id < 0 ? 20 : 10))
      .attr("y", (d: any) => (d.y || 0) + 4);
  }, []);

  // 初始绘制
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
        renderTime: undefined,
        workerTime: workerStatus.active ? undefined : undefined
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

      // 绘制连接
      g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("class", "link")
        .attr("stroke", (l) => REL_COLOR[(l as unknown as Relationship).type] || "#ccc")
        .attr("stroke-width", (l) => {
          const link = l as unknown as Relationship;
          const source = nodes.find(n => n.id === (link.source as number));
          const target = nodes.find(n => n.id === (link.target as number));
          const sourceId = typeof link.source === 'number' ? link.source : link.source.id;
          const targetId = typeof link.target === 'number' ? link.target : link.target.id;
          const isAggregated = sourceId < 0 || targetId < 0;
          return isAggregated ? 2.5 : 1.5;
        })
        .attr("stroke-opacity", 0.5);

      // 绘制节点
      const nodeSel = g.append("g")
        .attr("class", "nodes")
        .selectAll<SVGCircleElement, Executive>("circle")
        .data(nodes)
        .join("circle")
        .attr("class", "node")
        .attr("r", nodeRadius)
        .attr("fill", (n) => REGION_COLOR[n.region] || "#888")
        .attr("stroke", (n) => (n.id === selectedId ? "#fff" : "transparent"))
        .attr("stroke-width", 2)
        .style("cursor", "pointer");

      // 绘制标签
      g.append("g")
        .attr("class", "labels")
        .selectAll<SVGTextElement, Executive>("text")
        .data(nodes)
        .join("text")
        .attr("class", "label")
        .text((n) => n.name)
        .attr("font-size", (n) => n.id < 0 ? 11 : 10)
        .attr("fill", "#e2e8f0")
        .attr("pointer-events", "none")
        .attr("opacity", (n) => {
          const deg = degree.get(n.id) || 0;
          return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
        });

      // 交互效果
      setupInteractions(nodeSel, links, nodes, degree);

      // 如果使用Worker，启动模拟
      if (workerManager && workerStatus.initialized && !workerStatus.active) {
        workerManager.start();
      }

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
  }, [processedData, selectedId, workerManager, workerStatus]);

  // 设置交互效果
  const setupInteractions = useCallback((
    nodeSel: d3.Selection<SVGCircleElement, Executive, SVGGElement, unknown>,
    links: any[],
    nodes: Executive[],
    degree: Map<number, number>
  ) => {
    const d3 = (await import("d3")).default;
    
    // 悬停高亮
    nodeSel
      .on("mouseover", (_event, hovered) => {
        const neighborIds = new Set<number>();
        links.forEach((l) => {
          const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
          const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
          if (sid === hovered.id) neighborIds.add(tid);
          if (tid === hovered.id) neighborIds.add(sid);
        });
        
        nodeSel.attr("opacity", (n) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0.15
        );
        
        d3.selectAll(".link").attr("stroke-opacity", (l: any) => {
          const sid = typeof l.source === "object" ? (l.source as Executive).id : (l.source as number);
          const tid = typeof l.target === "object" ? (l.target as Executive).id : (l.target as number);
          return sid === hovered.id || tid === hovered.id ? 0.9 : 0.05;
        });
        
        d3.selectAll(".label").attr("opacity", (n: any) =>
          n.id === hovered.id || neighborIds.has(n.id) ? 1 : 0
        );
      })
      .on("mouseout", () => {
        nodeSel.attr("opacity", 1);
        d3.selectAll(".link").attr("stroke-opacity", 0.5);
        d3.selectAll(".label").attr("opacity", (n: any) => {
          const deg = degree.get(n.id) || 0;
          return n.id < 0 ? 1 : (deg >= 5 ? 0.8 : 0);
        });
      })
      .on("click", (_event, n) => {
        if (n.id >= 0) {
          onSelectNode(n);
        }
      });
  }, [onSelectNode]);

  // 防抖重绘
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    
    const redraw = debounce(() => {
      draw().then((fn) => { cleanup = fn; });
    }, 100);

    redraw();

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
          <div className="text-slate-400 text-sm animate-pulse">
            {workerStatus.initialized ? "Worker计算中…" : "渲染中…"}
          </div>
        </div>
      )}
      
      {/* Worker状态指示器 */}
      {useWorker && (
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${
            workerStatus.active ? 'bg-green-500 animate-pulse' :
            workerStatus.initialized ? 'bg-blue-500' :
            workerStatus.supported ? 'bg-amber-500' : 'bg-red-500'
          }`} />
          <span className="text-xs text-slate-400">
            {workerStatus.active ? 'Worker运行中' :
             workerStatus.initialized ? 'Worker就绪' :
             workerStatus.supported ? 'Worker初始化中' : 'Worker不支持'}
          </span>
        </div>
      )}
      
      {/* 性能统计 */}
      {performanceStats.renderTime && (
        <div className="absolute bottom-2 right-2 bg-slate-800/80 text-xs text-slate-400 px-2 py-1 rounded">
          {performanceStats.nodes}节点/{performanceStats.links}连接 · {performanceStats.renderTime}ms
          {enableSampling && <span className="ml-1 text-amber-400">(已优化)</span>}
          {useWorker && workerStatus.active && <span className="ml-1 text-green-400">(Worker)</span>}
        </div>
      )}
      
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}