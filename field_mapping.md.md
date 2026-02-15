# 欄位名稱對照表

## 資料歷史記錄 (HistoryRecord)

| 你的名稱 | 程式碼欄位名稱 | 說明 |
|---------|--------------|------|
| 表格類型 | `dataSource` | 'minshi' = 民視表格, 'yishin' = 奕心表格 |
| 資料日期 | `archiveDate` | 格式: "2026-02-12" |
| 變更日期 | [date](file:///c:/Users/Arthur/OneDrive/Documents/My_Codel/Firepower_Analysis/services/dbService.ts#172-183) | 格式: "2026/02/15 17:17:33" |
| 行銷名字 | `rawData[].name` | 在 rawData 陣列中 |
| 派單數量 | `rawData[].todayLeads` | |
| 派成數量 | `rawData[].todaySales` | |
| 追續數量 | `rawData[].followupCount` | |
| 總業績金額 | `rawData[].todayNetRevenue` | |
| 追續總金額 | `rawData[].todayFollowupSales` | |
| 派單價值 | `rawData[].avgOrderValue` | 自動計算後儲存 |
| 業績排名 | `rawData[].revenueRank` | 自動計算後儲存 |
| 追續排名 | `rawData[].followupRank` | 自動計算後儲存 |
| 派單價值排名 | `rawData[].avgPriceRank` | 自動計算後儲存 |
| 派單成交率 | `rawData[].todayConvRate` | 自動計算後儲存 |

---

## 41天推進數據 (analyzed41DaysData)

| 你的名稱 | 程式碼欄位名稱 | 說明 |
|---------|--------------|------|
| 表格類型 | `dataSource` | 同上 |
| 資料日期 | `archiveDate` | 同上 |
| 41天範圍 | `analyzed41DaysRange.startDate` ~ `analyzed41DaysRange.endDate` | "2026-01-03" ~ "2026-02-12" |
| 變更日期 | `analyzedAt` | AI 分析時間 |
| 行銷名字 | `analyzed41DaysData[].name` | |
| 派單數量 | `analyzed41DaysData[].todayLeads` | 41天彙總 |
| 派成數量 | `analyzed41DaysData[].todaySales` | 41天彙總 |
| 追續數量 | `analyzed41DaysData[].followupCount` | 41天彙總 |
| 總業績金額 | `analyzed41DaysData[].todayNetRevenue` | 41天彙總 |
| 追續總金額 | `analyzed41DaysData[].todayFollowupSales` | 41天彙總 |
| 派單價值 | `analyzed41DaysData[].avgOrderValue` | 41天平均 |
| 業績排名 | `analyzed41DaysData[].revenueRank` | 41天排名 |
| 追續排名 | `analyzed41DaysData[].followupRank` | 41天排名 |
| 派單價值排名 | `analyzed41DaysData[].avgPriceRank` | 41天排名 |
| 派單成交率 | `analyzed41DaysData[].todayConvRate` | 41天平均 |
| 能力分類標籤 | `analyzed41DaysData[].category` | AI 分類 |
| 派單決策決議 | `analyzed41DaysData[].aiAdvice` | AI 建議 |

---

## 員工檔案 (EmployeeDailyRecord)

| 你的名稱 | 程式碼欄位名稱 | 資料來源 |
|---------|--------------|---------|
| 表格類型 | `source` | 同 HistoryRecord.dataSource |
| 資料日期 | [date](file:///c:/Users/Arthur/OneDrive/Documents/My_Codel/Firepower_Analysis/services/dbService.ts#172-183) | 同 HistoryRecord.archiveDate |
| 行銷名字 | `employeeName` | |
| 變更日期 | `createdAt` | 建立時間 |
| 派單數量 | `rawData.todayLeads` | ✅ 從 HistoryRecord.rawData 複製 |
| 派成數量 | `rawData.todaySales` | ✅ 從 HistoryRecord.rawData 複製 |
| 追續數量 | `rawData.followupCount` | ✅ 從 HistoryRecord.rawData 複製 |
| 總業績金額 | `rawData.todayNetRevenue` | ✅ 從 HistoryRecord.rawData 複製 |
| 追續總金額 | `rawData.todayFollowupSales` | ✅ 從 HistoryRecord.rawData 複製 |
| 派單價值 | `rawData.avgOrderValue` | ✅ 從 HistoryRecord.rawData 複製 |
| 業績排名 | `rawData.revenueRank` | ✅ 從 HistoryRecord.rawData 複製 |
| 追續排名 | `rawData.followupRank` | ✅ 從 HistoryRecord.rawData 複製 |
| 派單價值排名 | `rawData.avgPriceRank` | ✅ 從 HistoryRecord.rawData 複製 |
| 派單成交率 | `rawData.todayConvRate` | ✅ 從 HistoryRecord.rawData 複製 |

---

## 資料流程確認

### 按下「資料載入」

```typescript
// 1. 儲存到 HistoryRecord
{
  dataSource: 'minshi',           // 表格類型
  archiveDate: '2026-02-12',      // 資料日期
  date: '2026/02/15 17:17:33',    // 變更日期
  rawData: [
    {
      name: '張大山',             // 行銷名字
      todayLeads: 10,             // 派單數量
      todaySales: 8,              // 派成數量
      followupCount: 5,           // 追續數量
      todayNetRevenue: 320000,    // 總業績金額
      todayFollowupSales: 50000,  // 追續總金額
      avgOrderValue: 32000,       // 派單價值 (自動計算後儲存)
      revenueRank: '1',           // 業績排名 (自動計算後儲存)
      followupRank: '2',          // 追續排名 (自動計算後儲存)
      avgPriceRank: '1',          // 派單價值排名 (自動計算後儲存)
      todayConvRate: '80.0%'      // 派單成交率 (自動計算後儲存)
    }
  ]
}

// 2. 同時複製到 EmployeeDailyRecord
{
  source: 'minshi',               // 表格類型
  date: '2026-02-12',             // 資料日期
  employeeName: '張大山',         // 行銷名字
  createdAt: '2026-02-15T09:17:33Z', // 變更日期
  rawData: {
    // ✅ 完整複製 HistoryRecord.rawData 中的張大山資料
    name: '張大山',
    todayLeads: 10,
    todaySales: 8,
    // ... 所有欄位
  }
}
```

### 按下「AI 分析」

```typescript
// 更新 HistoryRecord
{
  // ... 原有欄位
  analyzed41DaysData: [
    {
      name: '張大山',
      todayLeads: 410,            // 41天彙總
      todaySales: 328,            // 41天彙總
      // ... 其他彙總數據
      category: 'firepower',      // 能力分類標籤
      aiAdvice: '...'             // 派單決策決議
    }
  ],
  analyzed41DaysRange: {
    startDate: '2026-01-03',      // 41天範圍開始
    endDate: '2026-02-12',        // 41天範圍結束
    actualRecordCount: 15         // 實際抓到幾筆
  }
}

// 同時更新 EmployeeDailyRecord
{
  // ... 原有欄位
  analyzed41DaysData: {
    // ✅ 複製 HistoryRecord.analyzed41DaysData 中的張大山資料
    name: '張大山',
    todayLeads: 410,
    // ... 所有 41 天數據
  },
  analyzed41DaysRange: {
    startDate: '2026-01-03',
    endDate: '2026-02-12',
    actualRecordCount: 15
  }
}
```

---

## 快速查詢

### 查詢張大山 2026/02/12 的當日數據

```typescript
// 方法 1: 從 HistoryRecord 查
const record = await getRecordByDateDB('2026-02-12', 'minshi');
const 張大山 = record.rawData.find(emp => emp.name === '張大山');
console.log(張大山.todayLeads);  // 派單數量

// 方法 2: 從 EmployeeDailyRecord 查
const dailyRecord = await getEmployeeDailyRecordDB('張大山', '2026-02-12');
console.log(dailyRecord.rawData.todayLeads);  // 派單數量
```

### 查詢張大山 2026/02/12 的 41 天分析

```typescript
const record = await getRecordByDateDB('2026-02-12', 'minshi');
const 張大山 = record.analyzed41DaysData.find(emp => emp.name === '張大山');
console.log(張大山.category);    // 能力分類標籤
console.log(張大山.aiAdvice);    // 派單決策決議
console.log(record.analyzed41DaysRange);  // 41天範圍
```
