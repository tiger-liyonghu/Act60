/**
 * Web Worker: 力导向图计算
 * 在后台线程进行密集计算，避免阻塞UI
 */

// 导入D3（在Worker中）
importScripts('https://d3js.org/d3.v7.min.js');

let simulation = null;
let nodes = [];
let links = [];

// 消息处理器
self.onmessage = function(event) {
  const { type, data } = event.data;
  
  switch (type) {
    case 'INIT':
      initSimulation(data);
      break;
      
    case 'UPDATE_NODES':
      updateNodes(data);
      break;
      
    case 'UPDATE_LINKS':
      updateLinks(data);
      break;
      
    case 'START':
      startSimulation();
      break;
      
    case 'STOP':
      stopSimulation();
      break;
      
    case 'RESET':
      resetSimulation();
      break;
  }
};

// 初始化模拟
function initSimulation(config) {
  const { width = 800, height = 600, nodes: initNodes, links: initLinks } = config;
  
  nodes = initNodes || [];
  links = initLinks || [];
  
  if (simulation) {
    simulation.stop();
  }
  
  // 创建力导向图模拟
  simulation = d3.forceSimulation(nodes)
    .force('link', d3.forceLink(links)
      .id(d => d.id)
      .distance(d => d.distance || 80)
      .strength(d => d.strength || 0.5)
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        // 聚合节点排斥力更强
        if (d.id < 0) return -200;
        return -120;
      })
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => {
        if (d.id < 0) return 20; // 聚合节点
        return Math.max(5, Math.min(15, 5 + (d.degree || 0) * 0.3));
      })
    )
    .alphaDecay(0.02)
    .velocityDecay(0.4)
    .on('tick', () => {
      // 每帧发送节点位置更新
      self.postMessage({
        type: 'TICK',
        data: {
          nodes: nodes.map(n => ({
            id: n.id,
            x: n.x,
            y: n.y,
            vx: n.vx,
            vy: n.vy
          }))
        }
      });
    })
    .on('end', () => {
      self.postMessage({ type: 'END' });
    });
    
  self.postMessage({ type: 'INITIALIZED' });
}

// 更新节点
function updateNodes(newNodes) {
  nodes = newNodes;
  if (simulation) {
    simulation.nodes(nodes);
    simulation.alpha(0.3).restart();
  }
}

// 更新连接
function updateLinks(newLinks) {
  links = newLinks;
  if (simulation) {
    simulation.force('link').links(links);
    simulation.alpha(0.3).restart();
  }
}

// 开始模拟
function startSimulation() {
  if (simulation) {
    simulation.alphaTarget(0.3).restart();
    self.postMessage({ type: 'STARTED' });
  }
}

// 停止模拟
function stopSimulation() {
  if (simulation) {
    simulation.alphaTarget(0);
    simulation.alpha(0);
    setTimeout(() => {
      if (simulation) simulation.stop();
      self.postMessage({ type: 'STOPPED' });
    }, 1000);
  }
}

// 重置模拟
function resetSimulation() {
  if (simulation) {
    simulation.stop();
    simulation = null;
  }
  nodes = [];
  links = [];
  self.postMessage({ type: 'RESET' });
}

// 错误处理
self.onerror = function(error) {
  self.postMessage({
    type: 'ERROR',
    data: {
      message: error.message,
      stack: error.stack
    }
  });
};

console.log('ForceGraph Worker 已启动');