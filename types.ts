
export enum EmployeeCategory {
  FIREPOWER = '大單火力組',
  STEADY = '穩定人選',
  NEEDS_IMPROVEMENT = '待加強',
  RISK = '風險警告',
  POTENTIAL = '潛力成長組'
}

export interface EmployeeData {
  id: string;
  name: string;

  // 核心指標映射 (基於最新 11 欄位結構：行銷, 派單數, 派成數, 追續數, 總業績, 派單價值, 追續總額, 業績排名, 追續排名, 均價排名, 派單成交率)
  todayLeads: number;          // 派單數
  todaySales: number;          // 派成數
  todayFollowupSales: number;  // 追續總額
  todayNetRevenue: number;     // 總業績
  avgOrderValue: number;       // 派單價值
  followupCount: number;       // 追續數
  revenueRank: string;         // 業績排名
  followupRank: string;        // 追續排名
  avgPriceRank: string;        // 均價排名
  todayConvRate: string;       // 派單成交率

  // AI 決策與分類
  category?: EmployeeCategory;
  categoryRank?: number;       // AI 給出的組內排名
  aiAdvice?: string;           // 一般派單建議
  scoutAdvice?: string;        // 星探區專用建議(現況+提拔原因)

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
  archiveDate?: string;      // 歸檔日期（YYYY-MM-DD），用於月曆選擇
  dataSource?: 'minshi' | 'yishin' | 'combined';  // 表格來源

  // 雙視角數據系統
  rawData: EmployeeData[];   // 當日原始數據（永久保留）
  analyzed41DaysData?: EmployeeData[];  // 41天彙總分析結果（AI 分析後才有）

  // 分析狀態
  isAnalyzed?: boolean;      // 是否已執行 AI 分析
  analyzedAt?: string;       // AI 分析時間（ISO 8601）

  // 41天分析範圍資訊
  analyzed41DaysRange?: {
    startDate: string;         // 開始日期 "2026-01-03"
    endDate: string;           // 結束日期 "2026-02-12"
    actualRecordCount: number; // 實際抓到的記錄筆數
    expectedDays: number;      // 預期天數 (41)
    dataSource: 'minshi' | 'yishin' | 'combined';
  };

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

// 員工檔案
export interface EmployeeProfile {
  id: string;                    // 員工唯一 ID（使用姓名作為 ID）
  name: string;                  // 員工姓名
  status: 'active' | 'inactive'; // 在職/離職
  accountStatus: 'enabled' | 'disabled'; // 帳號啟用/停用
  joinDate: string;              // 加入日期（YYYY-MM-DD）
  leaveDate?: string;            // 離職日期（可選）
  notes: string;                 // 備註
  createdAt: string;             // 建檔時間
  updatedAt: string;             // 更新時間
}

// 員工每日紀錄
export interface EmployeeDailyRecord {
  id: string;                    // 紀錄 ID
  employeeId: string;            // 關聯 EmployeeProfile.id
  employeeName: string;          // 員工姓名
  date: string;                  // 日期（YYYY-MM-DD）

  // 雙視角數據
  rawData: EmployeeData;         // 當日原始數據
  analyzed41DaysData?: EmployeeData;  // 當天執行分析時的 41 天彙總結果

  // 41天分析範圍資訊
  analyzed41DaysRange?: {
    startDate: string;         // 開始日期
    endDate: string;           // 結束日期
    actualRecordCount: number; // 實際抓到的記錄筆數
  };

  source: 'minshi' | 'yishin' | 'combined'; // 資料來源
  createdAt: string;             // 建立時間
}

// 資料驗證相關類型
export type ValidationErrorType = 'error' | 'warning' | 'info';

export interface ValidationError {
  type: ValidationErrorType;
  row: number;                   // 第幾列 (從 1 開始)
  field: string;                 // 欄位名稱
  message: string;               // 錯誤訊息
  employeeName?: string;         // 員工姓名
}

export interface ValidationResult {
  isValid: boolean;              // 是否通過驗證
  errors: ValidationError[];     // 錯誤列表
  warnings: ValidationError[];   // 警告列表
  infos: ValidationError[];      // 提示列表
}

// ==================== 查詢系統型別定義 ====================

// 指標類型
export type MetricType =
  | 'todayLeads'
  | 'todaySales'
  | 'todayFollowupSales'
  | 'todayNetRevenue'
  | 'avgOrderValue'
  | 'followupCount'
  | 'todayConvRate'
  | 'monthlyTotalLeads'
  | 'monthlyLeadSales'
  | 'monthlyFollowupSales'
  | 'monthlyTotalConvRate'
  | 'monthlyActualRevenue';

// 查詢選項
export interface QueryOptions {
  employeeIds?: string[];        // 指定人員 (空 = 全部)
  startDate: string;             // 開始日期 (YYYY-MM-DD)
  endDate: string;               // 結束日期 (YYYY-MM-DD)
  metrics?: MetricType[];        // 指標類型
  dataSource?: 'minshi' | 'yishin' | 'combined';
  useAnalyzedData?: boolean;     // 使用分析後數據?
}

// 時間序列數據點
export interface TimeSeriesDataPoint {
  date: string;
  employeeId: string;
  employeeName: string;
  value: number | string;
  metric: MetricType;
}

// 排行榜數據
export interface RankingData {
  employeeId: string;
  employeeName: string;
  value: number | string;
  rank: number;
  metric: MetricType;
}

// 圖表數據格式 (通用)
export interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: (number | string)[];
    [key: string]: any;
  }[];
}
