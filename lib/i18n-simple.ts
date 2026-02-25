// 简化的国际化配置
export type Language = 'zh' | 'en';

export interface Translations {
  // 应用标题
  appTitle: string;
  appSubtitle: string;
  
  // 搜索栏
  searchPlaceholder: string;
  searchHint: string;
  
  // 筛选器标签
  filters: {
    region: string;
    companyType: string;
    position: string;
    relationship: string;
  };
  
  // 筛选选项
  filterOptions: {
    all: string;
    region: {
      cn: string;
      hk: string;
      sg: string;
    };
    companyType: {
      nonlife: string;
      life: string;
    };
    position: {
      board: string;
      management: string;
      actuary: string;
    };
    relationship: {
      colleague: string;
      alumni: string;
      former: string;
      regulator: string;
    };
  };
  
  // 统计信息
  stats: {
    executives: string;
    relationships: string;
    loading: string;
    loaded: string;
  };
}

export const translations: Record<Language, Translations> = {
  zh: {
    appTitle: '保险公司高管信息图谱',
    appSubtitle: '保险行业高管关系可视化分析平台',
    
    searchPlaceholder: '姓名/公司/学校',
    searchHint: '搜索高管、公司或学校',
    
    filters: {
      region: '地区',
      companyType: '公司类型',
      position: '职位',
      relationship: '关系类型',
    },
    
    filterOptions: {
      all: '全部',
      region: {
        cn: '中国大陆',
        hk: '中国香港',
        sg: '新加坡',
      },
      companyType: {
        nonlife: '非寿险公司',
        life: '寿险公司',
      },
      position: {
        board: '董事会',
        management: '管理层',
        actuary: '精算师',
      },
      relationship: {
        colleague: '同事',
        alumni: '校友',
        former: '前同事',
        regulator: '监管背景',
      },
    },
    
    stats: {
      executives: '高管',
      relationships: '关系',
      loading: '加载中...',
      loaded: '已加载',
    },
  },
  
  en: {
    appTitle: 'Insurance Company Executive Information Graph',
    appSubtitle: 'Visualization and Analysis Platform for Insurance Industry Executive Relationships',
    
    searchPlaceholder: 'Name/Company/School',
    searchHint: 'Search executives, companies, or schools',
    
    filters: {
      region: 'Region',
      companyType: 'Company Type',
      position: 'Position',
      relationship: 'Relationship Type',
    },
    
    filterOptions: {
      all: 'All',
      region: {
        cn: 'Mainland China',
        hk: 'Hong Kong',
        sg: 'Singapore',
      },
      companyType: {
        nonlife: 'Non-life Insurance',
        life: 'Life Insurance',
      },
      position: {
        board: 'Board',
        management: 'Management',
        actuary: 'Actuary',
      },
      relationship: {
        colleague: 'Colleague',
        alumni: 'Alumni',
        former: 'Former Colleague',
        regulator: 'Regulator',
      },
    },
    
    stats: {
      executives: 'Executives',
      relationships: 'Relationships',
      loading: 'Loading...',
      loaded: 'Loaded',
    },
  },
};

// 简单的语言切换钩子
export function useLanguage() {
  // 这里简化，实际应该使用React Context
  return {
    language: 'zh' as Language,
    setLanguage: (lang: Language) => {},
    t: translations['zh']
  };
}

// 简单的语言切换组件 - 在React组件中实现