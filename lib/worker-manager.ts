/**
 * Web Worker 管理器
 * 管理力导向图计算Worker的生命周期和通信
 */

export interface WorkerNode {
  id: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  degree?: number;
}

export interface WorkerLink {
  source: number;
  target: number;
  distance?: number;
  strength?: number;
}

export interface WorkerConfig {
  width: number;
  height: number;
  nodes: WorkerNode[];
  links: WorkerLink[];
}

export type WorkerMessage =
  | { type: 'INITIALIZED' }
  | { type: 'TICK'; data: { nodes: WorkerNode[] } }
  | { type: 'STARTED' }
  | { type: 'STOPPED' }
  | { type: 'END' }
  | { type: 'RESET' }
  | { type: 'ERROR'; data: { message: string; stack?: string } };

export class ForceGraphWorkerManager {
  private worker: Worker | null = null;
  private isInitialized = false;
  private messageHandlers: Map<string, ((data: any) => void)[]> = new Map();
  private errorHandlers: ((error: Error) => void)[] = [];

  constructor() {
    this.setupMessageHandlers();
  }

  /**
   * 初始化Worker
   */
  async initialize(config: WorkerConfig): Promise<void> {
    if (this.worker) {
      this.terminate();
    }

    return new Promise((resolve, reject) => {
      try {
        // 创建Worker
        this.worker = new Worker(
          new URL('./force-graph-worker.js', import.meta.url),
          { type: 'module' }
        );

        // 设置消息处理器
        this.worker.onmessage = (event) => {
          const message = event.data as WorkerMessage;
          this.handleWorkerMessage(message);
        };

        this.worker.onerror = (error) => {
          this.handleWorkerError(error);
          reject(new Error(`Worker错误: ${error.message}`));
        };

        // 监听初始化完成
        this.once('INITIALIZED', () => {
          this.isInitialized = true;
          resolve();
        });

        // 发送初始化消息
        this.sendToWorker({ type: 'INIT', data: config });

      } catch (error) {
        reject(new Error(`创建Worker失败: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
  }

  /**
   * 发送消息到Worker
   */
  sendToWorker(message: any): void {
    if (!this.worker) {
      throw new Error('Worker未初始化');
    }
    this.worker.postMessage(message);
  }

  /**
   * 更新节点数据
   */
  updateNodes(nodes: WorkerNode[]): void {
    if (!this.isInitialized) return;
    this.sendToWorker({ type: 'UPDATE_NODES', data: nodes });
  }

  /**
   * 更新连接数据
   */
  updateLinks(links: WorkerLink[]): void {
    if (!this.isInitialized) return;
    this.sendToWorker({ type: 'UPDATE_LINKS', data: links });
  }

  /**
   * 开始模拟
   */
  start(): void {
    if (!this.isInitialized) return;
    this.sendToWorker({ type: 'START' });
  }

  /**
   * 停止模拟
   */
  stop(): void {
    if (!this.isInitialized) return;
    this.sendToWorker({ type: 'STOP' });
  }

  /**
   * 重置Worker
   */
  reset(): void {
    if (!this.worker) return;
    this.sendToWorker({ type: 'RESET' });
    this.isInitialized = false;
  }

  /**
   * 终止Worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
      this.messageHandlers.clear();
    }
  }

  /**
   * 注册消息处理器
   */
  on<T extends WorkerMessage['type']>(
    type: T,
    handler: (data: Extract<WorkerMessage, { type: T }>['data']) => void
  ): void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, []);
    }
    this.messageHandlers.get(type)!.push(handler as any);
  }

  /**
   * 注册一次性消息处理器
   */
  once<T extends WorkerMessage['type']>(
    type: T,
    handler: (data: Extract<WorkerMessage, { type: T }>['data']) => void
  ): void {
    const onceHandler = (data: any) => {
      handler(data);
      this.off(type, onceHandler);
    };
    this.on(type, onceHandler);
  }

  /**
   * 移除消息处理器
   */
  off<T extends WorkerMessage['type']>(
    type: T,
    handler: (data: Extract<WorkerMessage, { type: T }>['data']) => void
  ): void {
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      const index = handlers.indexOf(handler as any);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * 注册错误处理器
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }

  /**
   * 处理Worker消息
   */
  private handleWorkerMessage(message: WorkerMessage): void {
    const handlers = this.messageHandlers.get(message.type);
    if (handlers) {
      handlers.forEach(handler => {
        try {
          handler('data' in message ? message.data : undefined);
        } catch (error) {
          console.error(`处理Worker消息 ${message.type} 时出错:`, error);
        }
      });
    }

    // 特殊处理TICK消息（高频）
    if (message.type === 'TICK') {
      // 可以在这里添加节流逻辑
    }
  }

  /**
   * 处理Worker错误
   */
  private handleWorkerError(error: ErrorEvent): void {
    const errorObj = new Error(`Worker错误: ${error.message}`);
    this.errorHandlers.forEach(handler => {
      try {
        handler(errorObj);
      } catch (e) {
        console.error('错误处理器出错:', e);
      }
    });
  }

  /**
   * 设置默认消息处理器
   */
  private setupMessageHandlers(): void {
    // 默认错误处理器
    this.onError((error) => {
      console.error('ForceGraph Worker错误:', error);
    });

    // 默认TICK处理器（空实现，由使用者覆盖）
    this.on('TICK', () => {});

    // 默认END处理器
    this.on('END', () => {
      console.log('ForceGraph模拟结束');
    });

    // 默认ERROR处理器
    this.on('ERROR', (data) => {
      console.error('Worker内部错误:', data);
    });
  }

  /**
   * 检查Worker是否可用
   */
  static isSupported(): boolean {
    return typeof Worker !== 'undefined';
  }

  /**
   * 获取Worker状态
   */
  getStatus(): {
    initialized: boolean;
    workerExists: boolean;
    supported: boolean;
  } {
    return {
      initialized: this.isInitialized,
      workerExists: !!this.worker,
      supported: ForceGraphWorkerManager.isSupported()
    };
  }
}

// 单例实例
let workerManagerInstance: ForceGraphWorkerManager | null = null;

export function getWorkerManager(): ForceGraphWorkerManager {
  if (!workerManagerInstance) {
    workerManagerInstance = new ForceGraphWorkerManager();
  }
  return workerManagerInstance;
}

export function resetWorkerManager(): void {
  if (workerManagerInstance) {
    workerManagerInstance.terminate();
    workerManagerInstance = null;
  }
}