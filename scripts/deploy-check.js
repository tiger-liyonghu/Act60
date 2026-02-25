/**
 * 部署前检查脚本
 * 确保所有优化已正确集成
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始部署检查...\n');

const checks = [
  {
    name: '优化组件检查',
    files: [
      'components/WorkerForceGraph.tsx',
      'components/PerformancePanel.tsx',
      'components/LoadingProgress.tsx'
    ],
    required: true
  },
  {
    name: '工具库检查',
    files: [
      'lib/performance.ts',
      'lib/db-optimized.ts',
      'lib/worker-manager.ts'
    ],
    required: true
  },
  {
    name: '主页面集成检查',
    files: ['app/page.tsx'],
    required: true
  },
  {
    name: '配置文件检查',
    files: ['next.config.js', 'package.json', 'tsconfig.json'],
    required: true
  },
  {
    name: '文档检查',
    files: ['OPTIMIZATION_SUMMARY.md', 'README.md'],
    required: false
  }
];

let passed = 0;
let failed = 0;
let warnings = 0;

checks.forEach(check => {
  console.log(`📋 ${check.name}:`);
  
  check.files.forEach(file => {
    const filePath = path.join(__dirname, '..', file);
    
    if (fs.existsSync(filePath)) {
      const stats = fs.statSync(filePath);
      const sizeKB = Math.round(stats.size / 1024);
      
      // 检查文件内容
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n').length;
      
      console.log(`  ✅ ${file} (${sizeKB}KB, ${lines}行)`);
      passed++;
      
      // 特殊检查
      if (file === 'app/page.tsx') {
        if (content.includes('WorkerForceGraph')) {
          console.log('    ✓ 已集成WorkerForceGraph组件');
        } else {
          console.log('    ⚠️  未找到WorkerForceGraph引用');
          warnings++;
        }
        
        if (content.includes('PerformancePanel')) {
          console.log('    ✓ 已集成性能面板');
        } else {
          console.log('    ⚠️  未找到性能面板引用');
          warnings++;
        }
      }
      
      if (file === 'lib/performance.ts') {
        if (content.includes('sampleNodesByDegree')) {
          console.log('    ✓ 包含节点聚合函数');
        } else {
          console.log('    ⚠️  未找到节点聚合函数');
          warnings++;
        }
      }
      
    } else {
      if (check.required) {
        console.log(`  ❌ ${file} - 文件不存在`);
        failed++;
      } else {
        console.log(`  ⚠️  ${file} - 文件不存在（可选）`);
        warnings++;
      }
    }
  });
  
  console.log('');
});

// 检查依赖
console.log('📦 依赖检查:');
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  const requiredDeps = ['d3', 'react', 'next', '@supabase/supabase-js'];
  requiredDeps.forEach(dep => {
    if (packageJson.dependencies?.[dep] || packageJson.devDependencies?.[dep]) {
      console.log(`  ✅ ${dep} 已安装`);
      passed++;
    } else {
      console.log(`  ❌ ${dep} 未安装`);
      failed++;
    }
  });
  
  // 检查脚本
  if (packageJson.scripts?.dev) {
    console.log(`  ✅ dev脚本: ${packageJson.scripts.dev}`);
    passed++;
  } else {
    console.log('  ❌ 缺少dev脚本');
    failed++;
  }
  
} catch (error) {
  console.log(`  ❌ 无法读取package.json: ${error.message}`);
  failed++;
}

console.log('\n📊 检查结果:');
console.log(`  通过: ${passed}`);
console.log(`  失败: ${failed}`);
console.log(`  警告: ${warnings}`);

if (failed === 0) {
  console.log('\n🎉 所有检查通过！可以部署。');
  
  console.log('\n🚀 部署步骤:');
  console.log('1. 提交代码到Git仓库');
  console.log('2. 推送到Vercel连接的仓库');
  console.log('3. Vercel会自动构建和部署');
  console.log('4. 访问 https://graph.actuaryhelp.com/ 验证');
  
  console.log('\n🔧 手动优化建议:');
  console.log('1. 在Supabase控制台执行 add-indexes.sql');
  console.log('2. 配置Vercel环境变量（如果未设置）');
  console.log('3. 启用Vercel性能监控');
  
} else {
  console.log('\n⚠️  存在失败项，请修复后再部署。');
  process.exit(1);
}

// 构建测试
console.log('\n🧪 构建测试...');
try {
  const { execSync } = require('child_process');
  
  // 检查TypeScript编译
  console.log('  检查TypeScript编译...');
  execSync('npx tsc --noEmit --project tsconfig.json', { 
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe'
  });
  console.log('  ✅ TypeScript编译通过');
  passed++;
  
} catch (error) {
  console.log(`  ❌ TypeScript编译失败: ${error.message}`);
  failed++;
}

console.log('\n✅ 部署检查完成');
console.log('\n💡 提示: 部署后请测试以下功能:');
console.log('1. 数据加载和进度显示');
console.log('2. 节点聚合效果（查看聚合节点）');
console.log('3. Worker开关（高级选项）');
console.log('4. 性能面板（内存监控）');
console.log('5. 所有筛选和搜索功能');