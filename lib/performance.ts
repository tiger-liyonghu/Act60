/**
 * 性能优化工具
 */

// 数据采样和聚合
export interface AggregatedNode {
  id: number;
  name: string;
  title: string;
  company: string;
  region: string;
  degree: number;
  clusterId?: number;
}

export interface AggregatedLink {
  source: number;
  target: number;
  type: string;
  count: number; // 聚合的连接数量
}

/**
 * 根据连接度对节点进行采样
 * 保留高连接度的节点，聚合低连接度的节点
 */
export function sampleNodesByDegree<T extends { id: number }>(
  nodes: T[],
  links: Array<{ source: number; target: number }>,
  degreeThreshold: number = 5
): {
  sampledNodes: T[];
  sampledLinks: Array<{ source: number; target: number }>;
  aggregatedNodes: AggregatedNode[];
  aggregatedLinks: AggregatedLink[];
} {
  // 计算每个节点的连接度
  const degreeMap = new Map<number, number>();
  links.forEach(link => {
    degreeMap.set(link.source, (degreeMap.get(link.source) || 0) + 1);
    degreeMap.set(link.target, (degreeMap.get(link.target) || 0) + 1);
  });

  // 分离高连接度和低连接度节点
  const highDegreeNodes: T[] = [];
  const lowDegreeNodes: T[] = [];
  
  nodes.forEach(node => {
    const degree = degreeMap.get(node.id) || 0;
    if (degree >= degreeThreshold) {
      highDegreeNodes.push(node);
    } else {
      lowDegreeNodes.push(node);
    }
  });

  // 只保留高连接度节点之间的连接
  const highDegreeIds = new Set(highDegreeNodes.map(n => n.id));
  const sampledLinks = links.filter(link => 
    highDegreeIds.has(link.source) && highDegreeIds.has(link.target)
  );

  // 聚合低连接度节点（按公司分组）
  const companyMap = new Map<string, AggregatedNode>();
  
  lowDegreeNodes.forEach(node => {
    const company = (node as any).company || '未知公司';
    if (!companyMap.has(company)) {
      companyMap.set(company, {
        id: -Math.abs(company.hashCode()), // 负ID表示聚合节点
        name: company,
        title: '公司聚合',
        company,
        region: (node as any).region || 'CN',
        degree: 0
      });
    }
  });

  const aggregatedNodes = Array.from(companyMap.values());

  // 聚合连接（高连接度节点到公司聚合节点的连接）
  const aggregatedLinks: AggregatedLink[] = [];
  const linkMap = new Map<string, AggregatedLink>();

  links.forEach(link => {
    const sourceIsHigh = highDegreeIds.has(link.source);
    const targetIsHigh = highDegreeIds.has(link.target);
    
    if (sourceIsHigh !== targetIsHigh) {
      // 高连接度节点到低连接度节点的连接
      const highId = sourceIsHigh ? link.source : link.target;
      const lowNode = nodes.find(n => n.id === (sourceIsHigh ? link.target : link.source));
      const company = lowNode ? (lowNode as any).company : '未知公司';
      const aggNodeId = -Math.abs(company.hashCode());
      
      const key = `${highId}-${aggNodeId}`;
      const existing = linkMap.get(key);
      
      if (existing) {
        existing.count += 1;
      } else {
        const newLink: AggregatedLink = {
          source: sourceIsHigh ? link.source : aggNodeId,
          target: sourceIsHigh ? aggNodeId : link.target,
          type: (link as any).type || 'unknown',
          count: 1
        };
        linkMap.set(key, newLink);
      }
    }
  });

  aggregatedLinks.push(...linkMap.values());

  return {
    sampledNodes: highDegreeNodes,
    sampledLinks,
    aggregatedNodes,
    aggregatedLinks
  };
}

// 简单的字符串hash函数
declare global {
  interface String {
    hashCode(): number;
  }
}

String.prototype.hashCode = function() {
  let hash = 0;
  for (let i = 0; i < this.length; i++) {
    const char = this.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
};

/**
 * 性能监控
 */
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();
  private enabled: boolean = true;

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  start(metricName: string): () => void {
    if (!this.enabled) return () => {};

    const startTime = performance.now();
    return () => {
      const duration = performance.now() - startTime;
      this.record(metricName, duration);
    };
  }

  private record(metricName: string, duration: number): void {
    if (!this.metrics.has(metricName)) {
      this.metrics.set(metricName, []);
    }
    this.metrics.get(metricName)!.push(duration);
    
    // 只保留最近的100个记录
    if (this.metrics.get(metricName)!.length > 100) {
      this.metrics.get(metricName)!.shift();
    }
  }

  getStats(metricName: string): { avg: number; min: number; max: number; count: number } | null {
    const values = this.metrics.get(metricName);
    if (!values || values.length === 0) return null;

    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return { avg, min, max, count: values.length };
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  clear(): void {
    this.metrics.clear();
  }
}

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * 内存使用监控
 */
export function getMemoryUsage(): {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
} | null {
  if ('memory' in performance) {
    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit
    };
  }
  return null;
}