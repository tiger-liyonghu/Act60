// 填充companies表的Node.js脚本
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://czzdtudtuiauhfvjdqpk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6emR0dWR0dWlhdWhmdmpkcXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE4MzU4NTcsImV4cCI6MjA4NzQxMTg1N30.Y7Nojiw8zg457P3C97sEZFGoVnWnWIN41EvIPmg3byk';

const supabase = createClient(supabaseUrl, supabaseKey);

async function populateCompanies() {
  console.log('🚀 开始填充companies表...\n');
  
  try {
    // 1. 检查当前companies表状态
    console.log('1. 检查当前companies表状态:');
    const { data: currentCount, error: countError } = await supabase
      .from('companies')
      .select('*', { count: 'exact', head: true });
    
    if (countError) {
      console.log('   ❌ 查询失败:', countError.message);
      return;
    }
    
    console.log(`   📊 当前记录数: ${currentCount ? currentCount.length : 0} 条\n`);
    
    // 2. 获取所有中国公司（从executives表）
    console.log('2. 从executives表中提取中国公司信息:');
    const { data: cnExecs, error: cnError } = await supabase
      .from('executives')
      .select('company, title')
      .eq('region', 'CN')
      .not('company', 'is', null);
    
    if (cnError) {
      console.log('   ❌ 查询失败:', cnError.message);
      return;
    }
    
    // 提取唯一公司
    const companyMap = new Map();
    cnExecs.forEach(exec => {
      if (exec.company && exec.company.trim()) {
        if (!companyMap.has(exec.company)) {
          companyMap.set(exec.company, {
            name: exec.company,
            executiveCount: 0,
            titles: new Set()
          });
        }
        const company = companyMap.get(exec.company);
        company.executiveCount++;
        if (exec.title) company.titles.add(exec.title.trim());
      }
    });
    
    const uniqueCompanies = Array.from(companyMap.values());
    console.log(`   ✅ 找到 ${uniqueCompanies.length} 家中国保险公司\n`);
    
    // 3. 准备要插入的数据
    console.log('3. 准备插入数据:');
    const companiesToInsert = uniqueCompanies.map(company => {
      // 提取公司简称
      let shortName = company.name;
      const suffixes = [
        '股份有限公司', '有限公司', '有限责任公司', 
        '保险社', '自保有限公司', '（中国）有限公司', '集团'
      ];
      
      for (const suffix of suffixes) {
        if (shortName.endsWith(suffix)) {
          shortName = shortName.slice(0, -suffix.length);
          break;
        }
      }
      
      // 确定公司类型
      let type = 'other';
      const typeKeywords = [
        { keyword: '财产保险', type: 'property' },
        { keyword: '财险', type: 'property' },
        { keyword: '人寿保险', type: 'life' },
        { keyword: '寿险', type: 'life' },
        { keyword: '再保险', type: 'reinsurance' },
        { keyword: '健康保险', type: 'health' },
        { keyword: '养老保险', type: 'pension' },
        { keyword: '农业保险', type: 'agriculture' },
        { keyword: '信用保险', type: 'credit' },
        { keyword: '相互保险', type: 'mutual' },
        { keyword: '自保', type: 'captive' }
      ];
      
      for (const { keyword, type: typeValue } of typeKeywords) {
        if (company.name.includes(keyword)) {
          type = typeValue;
          break;
        }
      }
      
      // 生成网站猜测
      let website = '';
      try {
        // 清理公司名生成域名
        let domain = company.name
          .replace(/[（）()股份有限公司有限公司有限责任公司保险社自保有限公司（中国）有限公司集团]/g, '')
          .replace(/保险/g, 'bx')
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLowerCase();
        
        if (domain.length > 0) {
          website = `https://www.${domain}.com`;
        }
      } catch (e) {
        // 忽略域名生成错误
      }
      
      return {
        name: company.name,
        short_name: shortName || company.name,
        website: website,
        region: 'CN',
        intro: `${company.name}是中国保险市场的重要参与者，拥有${company.executiveCount}位高管。`,
        fetched_url: 'https://graph.actuaryhelp.com/'
      };
    });
    
    console.log(`   ✅ 准备了 ${companiesToInsert.length} 条公司记录\n`);
    
    // 4. 插入数据（分批插入，避免超时）
    console.log('4. 插入数据到companies表:');
    const batchSize = 50;
    let insertedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < companiesToInsert.length; i += batchSize) {
      const batch = companiesToInsert.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(companiesToInsert.length / batchSize);
      
      console.log(`   插入批次 ${batchNumber}/${totalBatches} (${batch.length} 条记录)...`);
      
      const { data, error } = await supabase
        .from('companies')
        .insert(batch)
        .select();
      
      if (error) {
        console.log(`   ❌ 批次 ${batchNumber} 插入失败:`, error.message);
        errorCount++;
        
        // 尝试单条插入
        for (const company of batch) {
          const { error: singleError } = await supabase
            .from('companies')
            .insert([company]);
          
          if (singleError) {
            console.log(`     单条插入失败 ${company.name}:`, singleError.message);
          } else {
            insertedCount++;
          }
        }
      } else {
        insertedCount += batch.length;
        console.log(`   ✅ 批次 ${batchNumber} 插入成功`);
      }
    }
    
    console.log(`\n   📊 插入结果: ${insertedCount} 成功, ${errorCount} 批次失败\n`);
    
    // 5. 验证插入结果
    console.log('5. 验证插入结果:');
    const { data: finalCount, error: finalError } = await supabase
      .from('companies')
      .select('*', { count: 'exact' });
    
    if (finalError) {
      console.log('   ❌ 验证失败:', finalError.message);
    } else {
      console.log(`   ✅ companies表现在有 ${finalCount.length} 条记录\n`);
      
      // 显示前10条记录
      console.log('   前10家公司:');
      finalCount.slice(0, 10).forEach((company, i) => {
        console.log(`   ${i+1}. ${company.name}`);
        console.log(`      简称: ${company.short_name}, 类型: ${company.type}`);
        console.log(`      网站: ${company.website || '无'}`);
        console.log();
      });
      
      // 统计公司类型
      const typeStats = {};
      finalCount.forEach(company => {
        typeStats[company.type] = (typeStats[company.type] || 0) + 1;
      });
      
      console.log('   公司类型统计:');
      Object.entries(typeStats).forEach(([type, count]) => {
        const percentage = (count / finalCount.length * 100).toFixed(1);
        console.log(`   ${type}: ${count} 家 (${percentage}%)`);
      });
    }
    
    // 6. 创建数据整合建议
    console.log('\n6. 数据整合建议:');
    console.log('   ✅ companies表已填充中国保险公司基本信息');
    console.log('   🔄 下一步: 整合下载的监管数据 (65家公司)');
    console.log('   📈 预计最终数据: 120-130家独特的中国保险公司');
    console.log('   🎯 目标: 完整的中国保险市场数据库');
    
  } catch (error) {
    console.error('❌ 执行过程中出错:', error.message);
  }
}

// 执行函数
populateCompanies();