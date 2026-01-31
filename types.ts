
export enum EmployeeCategory {
  FIREPOWER = '大單火力組',
  STEADY = '穩定人選',
  NEEDS_IMPROVEMENT = '待加強',
  RISK = '風險警告'
}

export interface EmployeeData {
  id: string;
  name: string;
  
  // 核心指標 (21 欄)
  todayLeads: number; // 今日名單數
  todaySales: number; // 今日成交
  todayConvRate: string; // 今日轉換率
  todayFollowupSales: number; // 今日追續成交
  
  monthlyTotalLeads: number; // 月累積名單
  monthlyLeadSales: number; // 月名單成交
  monthlyFollowupSales: number; // 月追續成交
  monthlyTotalConvRate: string; // 月累積轉換率
  
  todayVirtualLeadPaid: number; // 今日虛擬名單實收
  todayVirtualFollowupPaid: number; // 今日虛擬追續實收
  monthlyVirtualLeadDeposit: number; // 月累積虛擬名單寄放
  monthlyVirtualFollowupDeposit: number; // 月累積虛擬追續寄放
  
  todayNetRevenue: number; // 今日淨額
  depositWithdrawal: number; // 儲存/出金
  accumulatedDeposit: number; // 累積寄放
  withdrawalFollowup: number; // 出金追續
  followupAmount: number; // 追續金額
  returnAmount: number; // 退貨金額
  
  monthlyActualRevenue: number; // 月實際業績
  monthlyActualRevenueNet: number; // 月實際業績(扣退)

  category?: EmployeeCategory;
  aiAdvice?: string;
  timestamp: number;
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
