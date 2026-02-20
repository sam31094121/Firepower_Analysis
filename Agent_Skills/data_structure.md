# Firepower Analysis 資料結構說明文件

本文件詳細說明系統在 Firestore 中的資料儲存結構，方便開發者理解數據模式以便於後續的資料抓取與分析。

## 📚 集合 (Collections) 總覽

系統主要使用以下三個集合：

| 集合名稱 | 用途 | 主要 Interface | 說明 |
| :--- | :--- | :--- | :--- |
| `records` | 歷史紀錄 | `HistoryRecord` | 儲存每次匯入的完整分析紀錄 (包含當日與 41 天分析結果) |
| `employeeProfiles` | 員工檔案 | `EmployeeProfile` | 儲存員工基本資料 (狀態、入職日、備註等) |
| `employeeDailyRecords` | 每日紀錄 | `EmployeeDailyRecord` | 儲存每位員工每天的數據快照 (正規化後的數據) |

---

## 1. 歷史紀錄 (`records`)

這是系統最核心的數據集合，每次使用者上傳 Excel 並執行分析後，會產生一筆紀錄。

- **Document ID**: 自動產生 (UUID)
- **主要欄位**:

```typescript
interface HistoryRecord {
  id: string;              // 紀錄 ID
  title: string;           // 標題 (例如: "2026-02-20 分析")
  date: string;            // 建立日期 (ISO String)
  archiveDate: string;     // 歸檔日期 (YYYY-MM-DD), 用於月曆查詢
  dataSource: 'minshi' | 'yishin' | 'combined'; // 資料來源 (民視/奕心/合併)

  // 核心數據 (雙視角)
  rawData: EmployeeData[];          // 📅 當日原始數據 (永久保留)
  analyzed41DaysData?: EmployeeData[]; // 📈 41天 AI 分析結果 (AI 分析後寫入)

  // 分析狀態
  isAnalyzed: boolean;     // 是否已執行 AI 分析
  analyzedAt?: string;     // 分析時間

  // 41天分析範圍資訊 (重要!)
  analyzed41DaysRange?: {
    startDate: string;         // 開始日期 (YYYY-MM-DD)
    endDate: string;           // 結束日期 (YYYY-MM-DD)
    actualRecordCount: number; // 實際抓到的天數 (例如 35 天)
    expectedDays: number;      // 預期天數 (41)
    dataSource: 'minshi' | 'yishin' | 'combined';
  };

  totalRevenue: number;    // 當日總業績
}
```

> **💡 重點說明**:
> - `rawData`: 這是使用者上傳的 Excel 原始數據，不做任何加總分析。
> - `analyzed41DaysData`: 這是 AI 根據 `analyzed41DaysRange` 範圍內的歷史數據計算出的結果。**看趨勢或能力評估時請抓取此欄位。**

---

## 2. 員工每日紀錄 (`employeeDailyRecords`)

這個集合是將 `records` 拆解後，以「員工 + 日期」為單位的原子化數據，方便查詢特定員工的歷史曲線。

- **Document ID**: 自動產生
- **查詢索引**: 複合索引 `(employeeId, date DESC)` 方便查詢特定員工的最新紀錄。

```typescript
interface EmployeeDailyRecord {
  id: string;
  employeeId: string;      // 關聯 EmployeeProfile.id (通常是姓名)
  employeeName: string;
  date: string;            // 日期 (YYYY-MM-DD)

  // 數據內容 (與 records 結構一致)
  rawData: EmployeeData;         // 當日數據
  analyzed41DaysData?: EmployeeData; // 41天分析數據

  // 分析範圍
  analyzed41DaysRange?: {
    startDate: string;
    endDate: string;
    actualRecordCount: number;
  };

  source: 'minshi' | 'yishin' | 'combined';
}
```

---

## 3. 員工檔案 (`employeeProfiles`)

管理員工的基本屬性與狀態。

- **Document ID**: 員工姓名 (作為唯一 ID)

```typescript
interface EmployeeProfile {
  id: string;              // 員工姓名
  name: string;
  status: 'active' | 'inactive'; // 在職狀態
  accountStatus: 'enabled' | 'disabled'; // 系統帳號狀態
  joinDate: string;        // 入職日期 (YYYY-MM-DD)
  leaveDate?: string;      // 離職日期
  notes: string;           // 備註
  updatedAt: string;
}
```

---

## 📊 員工數據結構 (`EmployeeData`)

這是最底層的數據單元，無論在 `records` 還是 `employeeDailyRecords` 中，儲存員工表現的結構都是一樣的。

詳細欄位對照請參考 [欄位對照表](field_mapping.md)。

```typescript
interface EmployeeData {
  id: string;              // 員工姓名
  name: string;

  // 業績表現 (核心指標)
  todayLeads: number;          // 派單數 (件)
  todaySales: number;          // 派成數 (件)
  todayNetRevenue: number;     // 總業績 (萬元)
  todayFollowupSales: number;  // 追續總額 (元)
  avgOrderValue: number;       // 派單價值 (元/件) [計算: 總業績 / 派單數]
  todayConvRate: string;       // 成交率 (%) [計算: 派成數 / 派單數]

  // 排名資訊 (前端計算後存入)
  revenueRank: string;         // 業績排名 (例如 "1", "2")
  followupRank: string;        // 追續排名
  avgPriceRank: string;        // 均價排名

  // AI 分類與建議
  category?: '大單火力組' | '穩定人選' | '待加強' | '風險警告' | '潛力成長組';
  categoryRank?: number;       // 組內排名
  aiAdvice?: string;           // AI 給出的派單建議
  scoutAdvice?: string;        // 星探區建議 (潛力分析)

  // 其他欄位... (參考 types.ts)
}
```

## 🔍 如何抓取資料 (範例)

### 情境 1: 取得特定日期的完整報表

查詢 `records` 集合：

```javascript
const q = query(
  collection(db, "records"),
  where("archiveDate", "==", "2026-02-20"),
  where("dataSource", "==", "yishin") // 選擇資料源
);
// 取第一筆結果的 rawData 或 analyzed41DaysData
```

### 情境 2: 取得特定員工的歷史走勢

查詢 `employeeDailyRecords` 集合：

```javascript
const q = query(
  collection(db, "employeeDailyRecords"),
  where("employeeId", "==", "張三"),
  where("date", ">=", "2026-01-01"),
  where("date", "<=", "2026-02-20"),
  orderBy("date", "desc")
);
// 結果 array 可直接繪製成圖表
```
