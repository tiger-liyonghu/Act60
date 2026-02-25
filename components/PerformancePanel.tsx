"use client";

import { useState, useEffect } from "react";
import { PerformanceMonitor, getMemoryUsage } from "@/lib/performance";

interface Props {
  className?: string;
}

export default function PerformancePanel({ className = "" }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [memory, setMemory] = useState<{
    usedJSHeapSize: number;
    totalJSHeapSize: number;
    jsHeapSizeLimit: number;
  } | null>(null);
  const [stats, setStats] = useState<Record<string, any>>({});

  const perfMonitor = PerformanceMonitor.getInstance();

  useEffect(() => {
    const updateStats = () => {
      // 内存使用
      const mem = getMemoryUsage();
      setMemory(mem);

      // 性能指标
      const newStats: Record<string, any> = {};
      const metricNames = ["data_processing", "graph_render", "filter_apply"];
      
      metricNames.forEach(name => {
        const stat = perfMonitor.getStats(name);
        if (stat) {
          newStats[name] = stat;
        }
      });

      setStats(newStats);
    };

    // 初始更新
    updateStats();

    // 定期更新
    const interval = setInterval(updateStats, 2000);

    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatPercentage = (used: number, total: number): string => {
    if (total === 0) return "0%";
    return ((used / total) * 100).toFixed(1) + "%";
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-4 left-4 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs px-3 py-1.5 rounded-lg shadow-lg transition-colors z-50 ${className}`}
        title="显示性能面板"
      >
        ⚡ 性能
      </button>
    );
  }

  return (
    <div className={`fixed bottom-4 left-4 bg-slate-900/95 backdrop-blur-sm border border-slate-700 rounded-lg shadow-xl p-4 w-80 z-50 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-slate-300 text-sm">性能监控</h3>
        <button
          onClick={() => setIsOpen(false)}
          className="text-slate-500 hover:text-slate-300 text-sm"
        >
          ✕
        </button>
      </div>

      {/* 内存使用 */}
      {memory && (
        <div className="mb-4">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs text-slate-400">内存使用</span>
            <span className="text-xs font-medium text-slate-300">
              {formatPercentage(memory.usedJSHeapSize, memory.jsHeapSizeLimit)}
            </span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ 
                width: `${(memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100}%` 
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-slate-500">
            <span>{formatBytes(memory.usedJSHeapSize)} / {formatBytes(memory.jsHeapSizeLimit)}</span>
          </div>
        </div>
      )}

      {/* 性能指标 */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-slate-400 mb-2">性能指标</h4>
        
        {Object.entries(stats).map(([name, stat]) => (
          <div key={name} className="space-y-1">
            <div className="flex justify-between">
              <span className="text-xs text-slate-400 capitalize">
                {name.replace('_', ' ')}
              </span>
              <span className="text-xs font-medium text-slate-300">
                {stat.avg.toFixed(1)}ms
              </span>
            </div>
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <span>min: {stat.min.toFixed(1)}ms</span>
              <span>max: {stat.max.toFixed(1)}ms</span>
              <span>count: {stat.count}</span>
            </div>
          </div>
        ))}
      </div>

      {/* 优化建议 */}
      <div className="mt-4 pt-3 border-t border-slate-800">
        <h4 className="text-xs font-medium text-slate-400 mb-2">优化状态</h4>
        <div className="space-y-2">
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-xs text-slate-300">节点聚合已启用</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
            <span className="text-xs text-slate-300">防抖渲染已启用</span>
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 rounded-full bg-amber-500 mr-2"></div>
            <span className="text-xs text-slate-300">建议：启用Web Worker</span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-2 mt-4">
        <button
          onClick={() => perfMonitor.clear()}
          className="flex-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 py-1.5 rounded transition-colors"
        >
          清空统计
        </button>
        <button
          onClick={() => {
            // 重新加载页面以应用优化
            window.location.reload();
          }}
          className="flex-1 text-xs bg-blue-900/30 hover:bg-blue-800/40 text-blue-300 py-1.5 rounded transition-colors"
        >
          刷新应用
        </button>
      </div>
    </div>
  );
}