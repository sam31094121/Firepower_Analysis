
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

  // 核心指標映射 (基於最新欄位結構：行銷, 派單數, 派成數, 追單數, 續單數, 總業績, 派單均價, 追單總額, 續單總額)
  todayLeads: number;          // 派單數 (分母)
  todaySales: number;          // 派成數 (分子)
  todayFollowupSales: number;  // 追單業績
  todayRenewalSales: number;   // 續單業績
  todayNetRevenue: number;     // 總業績
  avgOrderValue: number;       // 派單價值
  followupCount: number;       // 追單數量
  renewalCount: number;        // 續單數量
  revenueRank: string;         // 業績排名
  followupRank: string;        // 追續排名
  avgPriceRank: string;        // 均價排名
  todayConvRate: string;       // 派單成交率

  // 頻道業績拆分 (Phase 4)
  yishinRevenue: number;       // 三立奕心業績
  minshiRevenue: number;       // 民視商品業績
  companyRevenue: number;      // 公司商品業績
  giftCount: number;           // 贈品數量
  otherRevenue: number;        // 其他業績

  // AI 決策與分類
  category?: EmployeeCategory;
  categoryRank?: number;       // AI 給出的組內排名
  aiAdvice?: string;           // 一般派單建議
  scoutAdvice?: string;        // 星探區專用建議(現況+提拔原因)

  // 帳務追蹤軌跡
  rollbackTrace?: string[];    // 自動回溯標記 (Audit Trail)

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
  dataSource?: 'minshi' | 'yishin' | 'combined' | 'integrated';  // 表格來源

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
    dataSource: 'minshi' | 'yishin' | 'combined' | 'integrated';
  };

  totalRevenue: number;
  rollbackTrace?: string[];      // 自動回溯標記 (Audit Trail)
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
  displayName?: string;          // 自訂顯示名稱（如：珍珠）
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

  source: 'minshi' | 'yishin' | 'combined' | 'integrated'; // 資料來源
  createdAt: string;             // 建立時間
  rollbackTrace?: string[];      // 自動回溯標記 (Audit Trail)
}

// 資料驗證相關類型
export type ValidationErrorType = 'error' | 'warning' | 'info';

export interface ValidationError {
  type: ValidationErrorType;
  row: number;                   // 第幾列 (從 1 開始)
  field: string;                 // 欄位名稱
  message: string;               // 錯誤訊息
  employeeName?: string;         // 員工姓名
  overflowSales?: number;        // 當為溢單提示時，紀錄溢出單數
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

// ==================== 雙軌數據系統型別 ====================

/** 訂單系統匯出的單筆訂單（來源 A） */
export interface Order {
  orderId: string;          // 訂單編號（去重鍵）
  orderType: string;        // 單據類型
  orderStatus: string;      // 訂單狀態（例如：收貨確認、拒收、取消）
  date: string;             // 訂購日期 YYYY-MM-DD
  empId: string;            // alias 對應後的員工 ID（找不到時為 '__unknown__'）
  rawName: string;          // 原始行銷人員名稱（保留）
  amount: number;           // 金額
  product: string;          // 訂購產品
  productCategory: string;  // 商品類別
  dataSource: 'yishin' | 'minshi' | 'company' | 'gift' | 'other'; // 系統自動辨識的歸屬頻道 (Phase 4)
  rawData: Record<string, any>; // 原始 28 欄完整資料
  importedAt: string;       // 匯入時間戳
}

/** 行政派單紀錄（來源 B） */
export interface Dispatch {
  id: string;               // {date}_{empId}
  date: string;             // YYYY-MM-DD
  empId: string;
  empName: string;          // 顯示用
  totalDispatches: number;  // 總派單數
  updatedAt: string;
}

/** 員工別名對應（擴充現有 employeeProfiles） */
export interface AliasMap {
  [alias: string]: string;  // alias → empId
}

/** Excel 解析後的單列原始資料（對應 28 個表頭欄位） */
export interface ParsedOrderRow {
  raw: Record<string, any>;    // 全部欄位原始值
  orderId: string;
  orderType: string;
  orderStatus: string;
  date: string;
  rawName: string;
  amount: number;
  product: string;
  productCategory: string;
  dataSource: 'yishin' | 'minshi' | 'company' | 'gift' | 'other'; // 系統辨識結果
  isValid: boolean;            // 日期/金額基本格式是否正確
  warning?: string;            // e.g. 找不到行銷人員對應
  empId: string;               // alias 對應後的員工 ID（'__unknown__' = 未對應）
  empName: string;             // 對應到的員工正式姓名（未找到時為空）
}

