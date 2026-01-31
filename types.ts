
export enum EmployeeCategory {
  FIREPOWER = '大單火力組',
  STEADY = '穩定人選',
  NEEDS_IMPROVEMENT = '待加強',
  RISK = '風險警告'
}

export interface EmployeeData {
  id: string;
  name: string;
  
  // 核心指標映射 (基於最新 11 欄位結構：行銷, 派單數, 派成數, 追續數, 總業績, 客單價, 追續總額, 業績排名, 追續排名, 均價排名, 派單成交率)
  todayLeads: number;          // 派單數
  todaySales: number;          // 派成數
  todayFollowupSales: number;  // 追續總額
  todayNetRevenue: number;     // 總業績
  avgOrderValue: number;       // 客單價
  followupCount: number;       // 追續數
  revenueRank: string;         // 業績排名
  followupRank: string;        // 追續排名
  avgPriceRank: string;        // 均價排名
  todayConvRate: string;       // 派單成交率

  // AI 決策與分類
  category?: EmployeeCategory;
  categoryRank?: number;       // AI 給出的組內排名
  aiAdvice?: string;
  timestamp: number;

  // 原有累積數據 (保留擴充性)
  monthlyTotalLeads: number;
  monthlyLeadSales: number;
  monthlyFollowupSales: number;
  monthlyTotalConvRate: string;
  todayVirtualLeadPaid: number;
  todayVirtualFollowupPaid: number;
  monthlyVirtualLeadDeposit: number;
  monthlyVirtualFollowupDeposit: number;
  depositWithdrawal: number;
  accumulatedDeposit: number;
  withdrawalFollowup: number;
  followupAmount: number;
  returnAmount: number;
  monthlyActualRevenue: number;
  monthlyActualRevenueNet: number;
}

export interface HistoryRecord {
  id: string;
  title: string;
  date: string;
  data: EmployeeData[];
  totalRevenue: number;
}

export interface AnalysisSummary {
  firepowerCount: number;
  steadyCount: number;
  improvementCount: number;
  riskCount: number;
  totalRevenue: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
