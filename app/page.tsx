import SimpleForceGraph from '@/components/SimpleForceGraph';
import { Suspense } from 'react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-950 text-white">
      {/* 顶部导航栏 */}
      <header className="sticky top-0 z-50 bg-gray-900/80 backdrop-blur-md border-b border-gray-800">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-xl font-bold">保</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold">保险行业高管关系图谱</h1>
                <p className="text-sm text-gray-400">可视化分析平台 • 版本 1.1.0</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden md:flex items-center space-x-6">
                <a href="#data" className="text-gray-300 hover:text-white transition">数据概览</a>
                <a href="#visualization" className="text-gray-300 hover:text-white transition">可视化</a>
                <a href="#analysis" className="text-gray-300 hover:text-white transition">分析工具</a>
              </div>
              <button className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium transition">
                立即体验
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 主内容区域 */}
      <main className="container mx-auto px-6 py-8">
        {/* 数据概览卡片 */}
        <div id="data" className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-blue-400">137</div>
            <div className="text-gray-400 mt-2">保险公司</div>
            <div className="text-sm text-gray-500 mt-1">覆盖中国主要保险机构</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-green-400">1,494</div>
            <div className="text-gray-400 mt-2">高管人员</div>
            <div className="text-sm text-gray-500 mt-1">董事长、CEO、总监等</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-purple-400">15,204</div>
            <div className="text-gray-400 mt-2">关系连接</div>
            <div className="text-sm text-gray-500 mt-1">任职、投资、合作等</div>
          </div>
          
          <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700">
            <div className="text-3xl font-bold text-yellow-400">84.5%</div>
            <div className="text-gray-400 mt-2">数据完整度</div>
            <div className="text-sm text-gray-500 mt-1">持续更新中</div>
          </div>
        </div>

        {/* 可视化区域 */}
        <div id="visualization" className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* 侧边栏 - 筛选面板 */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* 筛选面板 */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
                <h3 className="font-medium text-lg mb-4">筛选条件</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">公司类型</label>
                    <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white">
                      <option value="all">全部类型</option>
                      <option value="property">财产保险</option>
                      <option value="life">人寿保险</option>
                      <option value="health">健康保险</option>
                      <option value="reinsurance">再保险</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">地区</label>
                    <select className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white">
                      <option value="all">全部地区</option>
                      <option value="beijing">北京</option>
                      <option value="shanghai">上海</option>
                      <option value="guangdong">广东</option>
                      <option value="other">其他地区</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">搜索</label>
                    <input 
                      type="text" 
                      placeholder="搜索公司或高管..." 
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-500"
                    />
                  </div>
                  <button className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-medium transition">
                    应用筛选
                  </button>
                </div>
              </div>
              
              {/* 性能面板 */}
              <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-5">
                <h3 className="font-medium text-lg mb-4">系统状态</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">节点数量</span>
                    <span className="font-medium">6</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">连线数量</span>
                    <span className="font-medium">6</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">渲染性能</span>
                    <span className="text-green-400 font-medium">优秀</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-300">内存使用</span>
                    <span className="text-yellow-400 font-medium">正常</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 主可视化区域 */}
          <div className="lg:col-span-3">
            <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-4">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-bold">保险行业关系网络</h2>
                  <p className="text-gray-400 text-sm">点击节点查看详情，拖动进行探索</p>
                </div>
                <div className="flex items-center space-x-3">
                  <button className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
                    重置视图
                  </button>
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition">
                    导出数据
                  </button>
                </div>
              </div>

              {/* 力导向图 */}
              <div className="relative h-[600px] rounded-lg overflow-hidden border border-gray-800">
                <Suspense fallback={
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="mt-4 text-gray-400">正在加载可视化图表...</p>
                    </div>
                  </div>
                }>
                  <SimpleForceGraph />
                </Suspense>
              </div>

              {/* 图例 */}
              <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                  <span className="text-sm text-gray-300">保险公司</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-green-500"></div>
                  <span className="text-sm text-gray-300">高管人员</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-purple-500"></div>
                  <span className="text-sm text-gray-300">任职关系</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 rounded-full bg-yellow-500"></div>
                  <span className="text-sm text-gray-300">投资关系</span>
                </div>
              </div>
            </div>

            {/* 分析工具区域 */}
            <div id="analysis" className="mt-8 bg-gray-900/50 rounded-xl border border-gray-800 p-6">
              <h2 className="text-xl font-bold mb-6">数据分析工具</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800/30 rounded-lg p-5">
                  <h3 className="font-medium text-lg mb-3">公司类型分布</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">财产保险公司</span>
                      <span className="font-medium">52家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">人寿保险公司</span>
                      <span className="font-medium">28家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">健康保险公司</span>
                      <span className="font-medium">15家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">再保险公司</span>
                      <span className="font-medium">8家</span>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-800/30 rounded-lg p-5">
                  <h3 className="font-medium text-lg mb-3">地区分布</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">北京</span>
                      <span className="font-medium">38家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">上海</span>
                      <span className="font-medium">32家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">广东</span>
                      <span className="font-medium">25家</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">其他地区</span>
                      <span className="font-medium">42家</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 底部信息 */}
      <footer className="mt-12 border-t border-gray-800 bg-gray-900/50">
        <div className="container mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4">保险行业高管关系图谱</h3>
              <p className="text-gray-400 text-sm">
                基于公开数据的保险行业高管关系可视化分析平台，
                帮助用户理解行业格局和人才流动。
              </p>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-4">数据来源</h3>
              <ul className="space-y-2 text-sm text-gray-400">
                <li>• 国家金融监督管理总局</li>
                <li>• 中国保险行业协会</li>
                <li>• 上市公司年报</li>
                <li>• 公开媒体报道</li>
              </ul>
            </div>
            
            <div>
              <h3 className="text-lg font-bold mb-4">技术信息</h3>
              <div className="text-sm text-gray-400 space-y-1">
                <p>版本: 1.1.0</p>
                <p>构建时间: 2026-02-26</p>
                <p>部署平台: Vercel</p>
                <p>数据更新: 每日自动同步</p>
              </div>
            </div>
          </div>
          
          <div className="mt-8 pt-8 border-t border-gray-800 text-center text-gray-500 text-sm">
            <p>© 2026 保险行业高管关系图谱. 数据仅供参考，不构成投资建议。</p>
            <p className="mt-2">技术支持: Next.js 14 • TypeScript • D3.js • Supabase</p>
          </div>
        </div>
      </footer>


    </div>
  );
}