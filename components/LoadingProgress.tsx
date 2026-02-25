"use client";

import { useEffect, useState } from "react";

interface Props {
  totalExecutives: number;
  totalRelationships: number;
  loadedExecutives: number;
  loadedRelationships: number;
  className?: string;
}

export default function LoadingProgress({
  totalExecutives,
  totalRelationships,
  loadedExecutives,
  loadedRelationships,
  className = "",
}: Props) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("正在初始化...");

  useEffect(() => {
    // 计算总体进度
    const execProgress = totalExecutives > 0 ? (loadedExecutives / totalExecutives) * 50 : 0;
    const relProgress = totalRelationships > 0 ? (loadedRelationships / totalRelationships) * 50 : 0;
    const totalProgress = Math.min(100, execProgress + relProgress);
    
    setProgress(totalProgress);

    // 更新状态消息
    if (loadedExecutives === 0 && loadedRelationships === 0) {
      setStatus("正在连接数据库...");
    } else if (loadedExecutives < totalExecutives) {
      const percentage = Math.round((loadedExecutives / totalExecutives) * 100);
      setStatus(`正在加载高管数据... ${percentage}%`);
    } else if (loadedRelationships < totalRelationships) {
      const percentage = Math.round((loadedRelationships / totalRelationships) * 100);
      setStatus(`正在加载关系数据... ${percentage}%`);
    } else {
      setStatus("正在准备可视化...");
    }
  }, [totalExecutives, totalRelationships, loadedExecutives, loadedRelationships]);

  // 格式化数字
  const formatNumber = (num: number): string => {
    if (num >= 10000) {
      return `${(num / 1000).toFixed(1)}k`;
    }
    return num.toLocaleString();
  };

  return (
    <div className={`flex flex-col items-center justify-center h-screen bg-slate-900 ${className}`}>
      <div className="text-center max-w-md px-6">
        {/* Logo/Title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">保险高管关系图谱</h1>
          <p className="text-slate-400 text-sm">
            探索保险行业高管之间的复杂关系网络
          </p>
        </div>

        {/* Progress bar */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>{status}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Data stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(loadedExecutives)}/{formatNumber(totalExecutives)}
            </div>
            <div className="text-xs text-slate-400">高管</div>
            <div className="h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-blue-500"
                style={{ 
                  width: `${totalExecutives > 0 ? (loadedExecutives / totalExecutives) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
          
          <div className="bg-slate-800/50 rounded-lg p-4">
            <div className="text-2xl font-bold text-white mb-1">
              {formatNumber(loadedRelationships)}/{formatNumber(totalRelationships)}
            </div>
            <div className="text-xs text-slate-400">关系</div>
            <div className="h-1 bg-slate-700 rounded-full mt-2 overflow-hidden">
              <div 
                className="h-full bg-cyan-500"
                style={{ 
                  width: `${totalRelationships > 0 ? (loadedRelationships / totalRelationships) * 100 : 0}%` 
                }}
              />
            </div>
          </div>
        </div>

        {/* Tips */}
        <div className="text-xs text-slate-500 space-y-1">
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-2"></div>
            <span>节点大小表示连接度（关系数量）</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 mr-2"></div>
            <span>不同颜色代表不同地区（CN/HK/SG）</span>
          </div>
          <div className="flex items-center">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-2"></div>
            <span>点击节点查看详细信息，拖动节点调整布局</span>
          </div>
        </div>

        {/* Performance note */}
        {totalRelationships > 10000 && (
          <div className="mt-6 p-3 bg-amber-900/20 border border-amber-800/30 rounded-lg">
            <div className="text-xs text-amber-300 font-medium mb-1">性能优化提示</div>
            <div className="text-xs text-amber-500">
              检测到大数据量 ({formatNumber(totalRelationships)}条关系)，已启用自动优化。
              低连接度节点将被聚合以提高性能。
            </div>
          </div>
        )}
      </div>
    </div>
  );
}