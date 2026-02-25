/**
 * Worker后备方案
 * 当Web Worker不可用时，在主线程运行简化版力导向图
 */

class ForceGraphFallback {
  constructor(config) {
    this.config = config;
    this.nodes = config.nodes || [];
    this.links = config.links || [];
    this.width = config.width || 800;
    this.height = config.height || 600;
    this.simulation = null;
    this.tickCallbacks = [];
    this.isRunning = false;
  }

  initialize() {
    // 使用requestAnimationFrame模拟Worker的tick
    this.setupFallbackSimulation();
    return Promise.resolve();
  }

  setupFallbackSimulation() {
    // 简化版的力导向图模拟
    // 只进行基本的布局，不进行完整的物理模拟
    
    // 初始化节点位置
    this.nodes.forEach(node => {
      if (node.x === undefined) node.x = Math.random() * this.width;
      if (node.y === undefined) node.y = Math.random() * this.height;
      node.vx = 0;
      node.vy = 0;
    });

    // 简单的力导向算法（简化版）
    this.applyForces = () => {
      if (!this.isRunning) return;

      // 连接力
      this.links.forEach(link => {
        const source = this.getNodeById(link.source);
        const target = this.getNodeById(link.target);
        
        if (source && target) {
          const dx = target.x - source.x;
          const dy = target.y - source.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const targetDistance = link.distance || 80;
          
          if (distance > 0) {
            const force = (distance - targetDistance) * (link.strength || 0.5) * 0.1;
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            source.vx += fx;
            source.vy += fy;
            target.vx -= fx;
            target.vy -= fy;
          }
        }
      });

      // 排斥力
      const strength = -120;
      for (let i = 0; i < this.nodes.length; i++) {
        for (let j = i + 1; j < this.nodes.length; j++) {
          const nodeA = this.nodes[i];
          const nodeB = this.nodes[j];
          
          const dx = nodeB.x - nodeA.x;
          const dy = nodeB.y - nodeA.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance > 0) {
            // 聚合节点排斥力更强
            const nodeStrength = (nodeA.id < 0 || nodeB.id < 0) ? strength * 1.5 : strength;
            const force = nodeStrength / (distance * distance) * 0.1;
            
            const fx = (dx / distance) * force;
            const fy = (dy / distance) * force;
            
            nodeA.vx -= fx;
            nodeA.vy -= fy;
            nodeB.vx += fx;
            nodeB.vy += fy;
          }
        }
      }

      // 向心力
      const centerX = this.width / 2;
      const centerY = this.height / 2;
      this.nodes.forEach(node => {
        const dx = centerX - node.x;
        const dy = centerY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
          const force = distance * 0.01;
          node.vx += (dx / distance) * force;
          node.vy += (dy / distance) * force;
        }
      });

      // 更新位置
      this.nodes.forEach(node => {
        // 速度衰减
        node.vx *= 0.9;
        node.vy *= 0.9;
        
        // 边界检查
        node.x = Math.max(10, Math.min(this.width - 10, node.x + node.vx));
        node.y = Math.max(10, Math.min(this.height - 10, node.y + node.vy));
      });

      // 触发tick回调
      this.tickCallbacks.forEach(callback => {
        callback({
          nodes: this.nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            vx: n.vx,
            vy: n.vy
          }))
        });
      });

      // 继续下一帧
      if (this.isRunning) {
        requestAnimationFrame(() => this.applyForces());
      }
    };
  }

  getNodeById(id) {
    return this.nodes.find(n => n.id === id);
  }

  start() {
    this.isRunning = true;
    this.applyForces();
    
    // 5秒后自动停止以节省性能
    setTimeout(() => {
      this.stop();
    }, 5000);
  }

  stop() {
    this.isRunning = false;
  }

  updateNodes(nodes) {
    this.nodes = nodes;
    // 保持现有节点的位置
    nodes.forEach(newNode => {
      const existing = this.getNodeById(newNode.id);
      if (existing) {
        newNode.x = existing.x;
        newNode.y = existing.y;
        newNode.vx = existing.vx;
        newNode.vy = existing.vy;
      }
    });
  }

  updateLinks(links) {
    this.links = links;
  }

  onTick(callback) {
    this.tickCallbacks.push(callback);
  }

  offTick(callback) {
    const index = this.tickCallbacks.indexOf(callback);
    if (index > -1) {
      this.tickCallbacks.splice(index, 1);
    }
  }

  destroy() {
    this.stop();
    this.tickCallbacks = [];
  }
}

// 导出工厂函数
export function createForceGraphFallback(config) {
  return new ForceGraphFallback(config);
}

// 检查是否支持Worker
export function isWorkerSupported() {
  return typeof Worker !== 'undefined';
}

// 选择使用Worker还是后备方案
export function createForceGraphEngine(config) {
  if (isWorkerSupported()) {
    // 在实际应用中，这里会返回Worker引擎
    console.log('Web Worker可用，建议使用Worker版本');
    return createForceGraphFallback(config);
  } else {
    console.log('Web Worker不可用，使用后备方案');
    return createForceGraphFallback(config);
  }
}