
import React, { useState, useEffect, useCallback } from 'react';
import DataInput from './components/DataInput';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import HistorySidebar from './components/HistorySidebar';
import CalendarCard from './components/CalendarCard';
import EmployeeDirectory from './components/EmployeeDirectory';
import EmployeeProfilePage from './components/EmployeeProfilePage';
import ExecutiveDashboard from './components/ExecutiveDashboard';
import ApiDiagnostics from './components/ApiDiagnostics';
import { analyzePerformance } from './services/geminiService';
import { calculateRankings } from './utils/rankingCalculator';
import {
  getAllRecordsDB,
  saveRecordDB,
  deleteRecordDB,
  clearAllRecordsDB,
  getRecordByDateDB,
  getEmployeeProfileDB,
  createEmployeeProfileDB,
  updateEmployeeProfileDB,
  saveEmployeeDailyRecordDB,
  getAllEmployeeProfilesDB
} from './services/dbService';
import { EmployeeData, HistoryRecord, EmployeeProfile, EmployeeDailyRecord } from './types';

type AppArea = 'analysis' | 'input';

const App: React.FC = () => {
  const [activeArea, setActiveArea] = useState<AppArea>('analysis');
  const [menuOpen, setMenuOpen] = useState(false);

  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string>('未命名分析');
  const [currentArchiveDate, setCurrentArchiveDate] = useState<string>('');
  const [currentDataSource, setCurrentDataSource] = useState<'minshi' | 'yishin' | 'combined'>('yishin');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

  // 雙視角數據系統
  const [dataView, setDataView] = useState<'raw' | 'analyzed'>('analyzed');  // 初始為 41天分析
  const [rawData, setRawData] = useState<EmployeeData[]>([]);  // 當日原始數據
  const [analyzed41DaysData, setAnalyzed41DaysData] = useState<EmployeeData[]>([]);  // 41天分析結果
  const [isAnalyzed, setIsAnalyzed] = useState(false);  // 是否已分析

  // 員工系統 state
  const [showEmployeeDirectory, setShowEmployeeDirectory] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeProfile | null>(null);

  // 月曆刷新觸發器
  const [calendarRefreshTrigger, setCalendarRefreshTrigger] = useState(0);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'loading' = 'success') => {
    setNotification({ message, type });
    if (type !== 'loading') {
      setTimeout(() => setNotification(prev => (prev?.message === message ? null : prev)), 5000);
    }
  }, []);

  const refreshHistory = async () => {
    try {
      const records = await getAllRecordsDB();
      setHistory([...records]);
    } catch (e) {
      console.error("App: Refresh error", e);
    }
  };

  // 初始載入：奕心表、最新日期、已分析的 41 天分析
  useEffect(() => {
    const initDisplay = async () => {
      const records = await getAllRecordsDB();
      const yishinAnalyzed = records
        .filter((r) => r.dataSource === 'yishin' && r.isAnalyzed && (r.analyzed41DaysData?.length ?? 0) > 0)
        .sort((a, b) => (b.archiveDate || '').localeCompare(a.archiveDate || ''));
      const latest = yishinAnalyzed[0];
      if (latest) {
        const raw = latest.rawData || [];
        const analyzed = latest.analyzed41DaysData || [];
        setCurrentArchiveDate(latest.archiveDate || '');
        setCurrentDataSource('yishin');
        setRawData([...raw]);
        setAnalyzed41DaysData([...analyzed]);
        setIsAnalyzed(true);
        setDataView('analyzed');
        setEmployees([...analyzed]);
        setCurrentTitle(latest.title || `${latest.archiveDate} 奕心表`);
      }
      await refreshHistory();
    };
    initDisplay();
  }, []);

  // 📥 資料載入（不執行 AI 分析）
  const handleDataLoad = useCallback(async (newData: EmployeeData[]) => {
    const archiveDate = currentArchiveDate || new Date().toISOString().split('T')[0];
    const dataSourceLabel = currentDataSource === 'minshi' ? '民視表' : currentDataSource === 'yishin' ? '奕心表' : '總和表';
    const title = `${archiveDate} ${dataSourceLabel}`;

    // 檢查是否已有數據
    const existingRecord = await getRecordByDateDB(archiveDate, currentDataSource);
    if (existingRecord) {
      const dataCount = existingRecord.rawData?.length || 0;
      const statusText = existingRecord.isAnalyzed ? '✓ 已分析' : '⚠️ 未分析';
      const confirm = window.confirm(
        `該日期 (${archiveDate} ${dataSourceLabel}) 已有數據\n` +
        `現有數據：${dataCount} 名員工 ${statusText}\n\n` +
        `是否要覆蓋？`
      );
      if (!confirm) {
        showToast("已取消載入", "error");
        return;
      }
    }

    setEmployees(newData);
    setCurrentTitle(title);
    setIsSaving(true);

    try {
      const newRecord: HistoryRecord = {
        id: existingRecord?.id || `rec-${Date.now()}`,
        title: title,
        date: new Date().toLocaleString(),
        archiveDate: archiveDate,
        dataSource: currentDataSource,
        rawData: JSON.parse(JSON.stringify(newData)),  // 當日原始數據
        analyzed41DaysData: undefined,  // 尚未分析
        isAnalyzed: false,
        totalRevenue: newData.reduce((sum, e) => sum + (e.todayNetRevenue || 0), 0)
      };

      await saveRecordDB(newRecord);
      await refreshHistory();

      // 員工建檔：儲存當日原始數據
      try {
        for (const empData of newData) {
          const empId = empData.name;
          let empProfile = await getEmployeeProfileDB(empId);

          if (!empProfile) {
            empProfile = {
              id: empId,
              name: empData.name,
              status: 'active',
              accountStatus: 'enabled',
              joinDate: archiveDate,
              notes: '',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            await createEmployeeProfileDB(empProfile);
            console.log(`✅ 自動建檔：${empData.name}`);
          } else {
            empProfile.updatedAt = new Date().toISOString();
            await updateEmployeeProfileDB(empProfile);
          }

          const dailyRecord: EmployeeDailyRecord = {
            id: `${empId}-${archiveDate}-${currentDataSource}`,
            employeeId: empId,
            employeeName: empData.name,
            date: archiveDate,
            rawData: empData,  // 當日原始數據
            analyzed41DaysData: undefined,  // 尚未分析
            source: currentDataSource,
            createdAt: new Date().toISOString()
          };
          await saveEmployeeDailyRecordDB(dailyRecord);
        }
        console.log(`✅ 員工建檔完成：共 ${newData.length} 名`);
      } catch (error) {
        console.error('員工建檔失敗', error);
      }

      localStorage.setItem('marketing_firepower_last_session', JSON.stringify({ title, data: newData }));

      // 更新雙視角狀態
      setRawData([...newData]);
      setAnalyzed41DaysData([]);
      setIsAnalyzed(false);
      setDataView('raw');

      // 觸發月曆刷新,讓新載入的日期即時變綠色
      setCalendarRefreshTrigger(prev => prev + 1);

      showToast(`✅ 數據已載入並存檔 (${newData.length} 名員工)`);
    } catch (error: any) {
      showToast(error.message || "存檔失敗", "error");
    } finally {
      setIsSaving(false);
    }
  }, [showToast, currentArchiveDate, currentDataSource]);

  // 🧠 AI 分析（整合歷史數據）
  const handleAIAnalyze = useCallback(async () => {
    // 檢查是否有已載入的數據
    if (rawData.length === 0 && employees.length === 0) {
      showToast("請先載入數據", "error");
      return;
    }

    setIsAnalyzing(true);

    try {
      // 1. 使用已載入的 rawData（當日數據）
      const currentData = rawData.length > 0 ? rawData : employees;
      console.log('🧠 開始 AI 分析');
      console.log('  - 當日數據筆數:', currentData.length);

      // 2. 從資料庫抓取所有歷史數據
      const { getAllRecordsDB } = await import('./services/dbService');
      const allRecords = await getAllRecordsDB();

      console.log('  - 資料庫總記錄數:', allRecords.length);

      // 計算日期範圍：使用當前載入的日期往前推 40 天
      const baseDate = currentArchiveDate || new Date().toISOString().split('T')[0];
      const baseDateObj = new Date(baseDate);
      const startDate = new Date(baseDateObj.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = baseDate;

      console.log('  - 基準日期:', baseDate);
      console.log('  - 日期範圍:', startDate, '~', endDate);
      console.log('  - 當前數據源:', currentDataSource);

      // 過濾：1) 有 archiveDate，2) 在日期範圍內，3) 數據源匹配
      const historicalRecords = allRecords.filter(r => {
        if (!r.archiveDate) {
          console.log('  ⚠️ 記錄缺少 archiveDate:', r.title);
          return false;
        }

        // 檢查日期範圍
        if (r.archiveDate < startDate || r.archiveDate > endDate) {
          return false;
        }

        // 檢查數據源匹配
        if (r.dataSource !== currentDataSource) {
          return false;
        }

        return true;
      });

      // 計算實際有數據的記錄數
      const actualRecordsCount = historicalRecords.length;
      console.log('  - 過濾後記錄筆數:', actualRecordsCount);
      console.log('  - 歷史記錄:', historicalRecords.map(r => `${r.archiveDate} (${r.dataSource})`).join(', '));

      // 顯示提示
      if (actualRecordsCount === 0) {
        showToast("AI 分析中（僅使用當日數據）...", "loading");
      } else if (actualRecordsCount < 10) {
        showToast(`AI 分析中（已抓取現有資料 ${actualRecordsCount} 筆）...`, "loading");
      } else {
        showToast(`AI 分析中（整合 ${actualRecordsCount} 筆歷史數據）...`, "loading");
      }

      // 3. 彙總歷史數據（按員工姓名分組）
      const employeeMap = new Map<string, any>();

      historicalRecords.forEach((record, index) => {
        const dataToUse = record.rawData;
        console.log(`  - 記錄 ${index + 1} (${record.archiveDate}):`, {
          usingRawData: !!record.rawData,
          employeeCount: dataToUse.length,
          firstEmployee: dataToUse[0] ? {
            name: dataToUse[0].name,
            todayLeads: dataToUse[0].todayLeads,
            todaySales: dataToUse[0].todaySales,
            todayNetRevenue: dataToUse[0].todayNetRevenue
          } : null
        });

        dataToUse.forEach((emp: any) => {
          const existing = employeeMap.get(emp.name);
          if (!existing) {
            // 第一次遇到此員工，只保留需要累加的原始數據欄位
            employeeMap.set(emp.name, {
              name: emp.name,
              todayLeads: emp.todayLeads || 0,
              todaySales: emp.todaySales || 0,
              todayNetRevenue: emp.todayNetRevenue || 0,
              followupCount: emp.followupCount || 0,
              todayFollowupSales: emp.todayFollowupSales || 0,
              monthlyTotalLeads: emp.monthlyTotalLeads || 0,
              monthlyLeadSales: emp.monthlyLeadSales || 0,
              monthlyFollowupSales: emp.monthlyFollowupSales || 0,
              todayVirtualLeadPaid: emp.todayVirtualLeadPaid || 0,
              todayVirtualFollowupPaid: emp.todayVirtualFollowupPaid || 0,
              monthlyVirtualLeadDeposit: emp.monthlyVirtualLeadDeposit || 0,
              monthlyVirtualFollowupDeposit: emp.monthlyVirtualFollowupDeposit || 0,
              depositWithdrawal: emp.depositWithdrawal || 0,
              accumulatedDeposit: emp.accumulatedDeposit || 0,
              withdrawalFollowup: emp.withdrawalFollowup || 0,
              followupAmount: emp.followupAmount || 0,
              returnAmount: emp.returnAmount || 0,
              monthlyActualRevenue: emp.monthlyActualRevenue || 0,
              monthlyActualRevenueNet: emp.monthlyActualRevenueNet || 0
            });
          } else {
            // 累加所有原始數據欄位
            existing.todayLeads += emp.todayLeads || 0;
            existing.todaySales += emp.todaySales || 0;
            existing.todayNetRevenue += emp.todayNetRevenue || 0;
            existing.followupCount += emp.followupCount || 0;
            existing.todayFollowupSales += emp.todayFollowupSales || 0;
            existing.monthlyTotalLeads += emp.monthlyTotalLeads || 0;
            existing.monthlyLeadSales += emp.monthlyLeadSales || 0;
            existing.monthlyFollowupSales += emp.monthlyFollowupSales || 0;
            existing.todayVirtualLeadPaid += emp.todayVirtualLeadPaid || 0;
            existing.todayVirtualFollowupPaid += emp.todayVirtualFollowupPaid || 0;
            existing.monthlyVirtualLeadDeposit += emp.monthlyVirtualLeadDeposit || 0;
            existing.monthlyVirtualFollowupDeposit += emp.monthlyVirtualFollowupDeposit || 0;
            existing.depositWithdrawal += emp.depositWithdrawal || 0;
            existing.accumulatedDeposit += emp.accumulatedDeposit || 0;
            existing.withdrawalFollowup += emp.withdrawalFollowup || 0;
            existing.followupAmount += emp.followupAmount || 0;
            existing.returnAmount += emp.returnAmount || 0;
            existing.monthlyActualRevenue += emp.monthlyActualRevenue || 0;
            existing.monthlyActualRevenueNet += emp.monthlyActualRevenueNet || 0;
          }
        });
      });

      // 3.2 加入當日數據（如果不在歷史記錄中）
      console.log('  - 加入當日數據...');

      // 檢查當日數據是否已經在歷史記錄中
      const currentArchiveDateInHistory = historicalRecords.some(r => r.archiveDate === currentArchiveDate);

      if (currentArchiveDateInHistory) {
        console.log('  ⚠️ 當日數據已在歷史記錄中，跳過累加');
      } else {
        console.log('  ✅ 當日數據不在歷史記錄中，開始累加');
        currentData.forEach((emp: any) => {
          const existing = employeeMap.get(emp.name);

          if (!existing) {
            // 當日新員工，直接加入
            employeeMap.set(emp.name, {
              name: emp.name,
              todayLeads: emp.todayLeads || 0,
              todaySales: emp.todaySales || 0,
              todayNetRevenue: emp.todayNetRevenue || 0,
              followupCount: emp.followupCount || 0,
              todayFollowupSales: emp.todayFollowupSales || 0,
              monthlyTotalLeads: emp.monthlyTotalLeads || 0,
              monthlyLeadSales: emp.monthlyLeadSales || 0,
              monthlyFollowupSales: emp.monthlyFollowupSales || 0,
              todayVirtualLeadPaid: emp.todayVirtualLeadPaid || 0,
              todayVirtualFollowupPaid: emp.todayVirtualFollowupPaid || 0,
              monthlyVirtualLeadDeposit: emp.monthlyVirtualLeadDeposit || 0,
              monthlyVirtualFollowupDeposit: emp.monthlyVirtualFollowupDeposit || 0,
              depositWithdrawal: emp.depositWithdrawal || 0,
              accumulatedDeposit: emp.accumulatedDeposit || 0,
              withdrawalFollowup: emp.withdrawalFollowup || 0,
              followupAmount: emp.followupAmount || 0,
              returnAmount: emp.returnAmount || 0,
              monthlyActualRevenue: emp.monthlyActualRevenue || 0,
              monthlyActualRevenueNet: emp.monthlyActualRevenueNet || 0
            });
          } else {
            // 累加當日數據
            existing.todayLeads += emp.todayLeads || 0;
            existing.todaySales += emp.todaySales || 0;
            existing.todayNetRevenue += emp.todayNetRevenue || 0;
            existing.followupCount += emp.followupCount || 0;
            existing.todayFollowupSales += emp.todayFollowupSales || 0;
            existing.monthlyTotalLeads += emp.monthlyTotalLeads || 0;
            existing.monthlyLeadSales += emp.monthlyLeadSales || 0;
            existing.monthlyFollowupSales += emp.monthlyFollowupSales || 0;
            existing.todayVirtualLeadPaid += emp.todayVirtualLeadPaid || 0;
            existing.todayVirtualFollowupPaid += emp.todayVirtualFollowupPaid || 0;
            existing.monthlyVirtualLeadDeposit += emp.monthlyVirtualLeadDeposit || 0;
            existing.monthlyVirtualFollowupDeposit += emp.monthlyVirtualFollowupDeposit || 0;
            existing.depositWithdrawal += emp.depositWithdrawal || 0;
            existing.accumulatedDeposit += emp.accumulatedDeposit || 0;
            existing.withdrawalFollowup += emp.withdrawalFollowup || 0;
            existing.followupAmount += emp.followupAmount || 0;
            existing.returnAmount += emp.returnAmount || 0;
            existing.monthlyActualRevenue += emp.monthlyActualRevenue || 0;
            existing.monthlyActualRevenueNet += emp.monthlyActualRevenueNet || 0;
          }
        });
      }

      // 4. 重新計算衍生欄位（派單價值、成交率）
      const aggregatedData = Array.from(employeeMap.values()).map(emp => {
        // 計算成交率 (基於累加後的數據)
        const convRate = emp.todayLeads > 0
          ? ((emp.todaySales / emp.todayLeads) * 100).toFixed(1)
          : '0.0';

        // 計算派單價值 (總業績 ÷ 派單數,基於累加後的數據)
        const avgOrderValue = emp.todayLeads > 0
          ? Math.round(emp.todayNetRevenue / emp.todayLeads)
          : 0;

        return {
          ...emp,
          todayConvRate: `${convRate}%`,
          avgOrderValue: avgOrderValue,
          id: `agg-${emp.name}-${Date.now()}`,
          // 初始化排名欄位（稍後會計算）
          revenueRank: '-',
          followupRank: '-',
          avgPriceRank: '-',
          // 清空 AI 分析欄位（等待 AI 計算）
          category: undefined,
          categoryRank: undefined,
          aiAdvice: undefined,
          scoutAdvice: undefined
        };
      });

      console.log('  - 彙總後員工數:', aggregatedData.length);

      // 檢查是否有數據可供分析
      if (aggregatedData.length === 0) {
        showToast("無法彙總數據,請確認資料庫中有歷史記錄", "error");
        setIsAnalyzing(false);
        return;
      }

      // 4.5 自動計算排名（使用 calculateRankings）
      console.log('  - 自動計算排名...');
      const rankedData = calculateRankings(aggregatedData);
      console.log('  - 排名計算完成');

      // 5. AI 分析
      console.log('  - 開始呼叫 AI 分析...');
      const analyzedData = await analyzePerformance(rankedData);
      console.log('  - AI 分析完成，結果筆數:', analyzedData?.length || 0);

      // 驗證 AI 分析結果
      if (!analyzedData || analyzedData.length === 0) {
        showToast("AI 分析失敗：未返回數據", "error");
        setIsAnalyzing(false);
        return;
      }

      setEmployees(analyzedData);

      // 6. 更新記錄（標記已分析）
      const archiveDate = currentArchiveDate || new Date().toISOString().split('T')[0];
      const dataSourceLabel = currentDataSource === 'minshi' ? '民視表' : currentDataSource === 'yishin' ? '奕心表' : '總和表';
      const title = `${archiveDate} ${dataSourceLabel}`;

      const existingRecord = await getRecordByDateDB(archiveDate, currentDataSource);

      // 保留原始數據：優先使用 rawData state，其次是 existingRecord.rawData，最後是當前 employees
      const preservedRawData = rawData.length > 0
        ? rawData
        : (existingRecord?.rawData && existingRecord.rawData.length > 0)
          ? existingRecord.rawData
          : currentData;

      console.log('💾 準備儲存分析結果:');
      console.log('  - preservedRawData 筆數:', preservedRawData.length);
      console.log('  - analyzedData 筆數:', analyzedData.length);

      const updatedRecord: HistoryRecord = {
        ...(existingRecord || {}),
        id: existingRecord?.id || `rec-${Date.now()}`,
        title: title,
        date: new Date().toLocaleString(),
        archiveDate: archiveDate,
        dataSource: currentDataSource,
        rawData: JSON.parse(JSON.stringify(preservedRawData)),  // 保留原始數據
        analyzed41DaysData: JSON.parse(JSON.stringify(analyzedData)),  // 41天分析結果

        // ✅ 記錄 41 天分析範圍
        analyzed41DaysRange: {
          startDate: startDate,
          endDate: endDate,
          actualRecordCount: actualRecordsCount,
          expectedDays: 41,
          dataSource: currentDataSource
        },

        isAnalyzed: true,
        analyzedAt: new Date().toISOString(),
        totalRevenue: analyzedData.reduce((sum, e) => sum + (e.todayNetRevenue || 0), 0)
      };

      await saveRecordDB(updatedRecord);
      await refreshHistory();

      // 4. 更新員工每日紀錄（加入 AI 建議）
      try {
        for (const empData of analyzedData) {
          const empId = empData.name;
          const dailyRecord: EmployeeDailyRecord = {
            id: `${empId}-${archiveDate}-${currentDataSource}`,
            employeeId: empId,
            employeeName: empData.name,
            date: archiveDate,
            rawData: preservedRawData.find(e => e.name === empData.name) || empData,  // 保留原始數據
            analyzed41DaysData: empData,  // 41天分析結果

            // ✅ 記錄 41 天分析範圍
            analyzed41DaysRange: {
              startDate: startDate,
              endDate: endDate,
              actualRecordCount: actualRecordsCount
            },

            source: currentDataSource,
            createdAt: new Date().toISOString()
          };
          await saveEmployeeDailyRecordDB(dailyRecord);
        }
        console.log(`✅ 員工分析結果已更新：共 ${analyzedData.length} 名`);
      } catch (error) {
        console.error('員工分析結果更新失敗', error);
      }

      localStorage.setItem('marketing_firepower_last_session', JSON.stringify({ title, data: analyzedData }));

      // 更新雙視角狀態
      console.log('📊 準備更新視角狀態:');
      console.log('  - analyzedData 筆數:', analyzedData.length);
      console.log('  - 前 3 筆員工:', analyzedData.slice(0, 3).map(e => e.name));

      setAnalyzed41DaysData([...analyzedData]);
      setEmployees([...analyzedData]);  // 直接設定 employees
      setIsAnalyzed(true);
      setDataView('analyzed');  // 分析完成後自動切換到 41 天視角

      showToast("✅ AI 分析完成（基於 41 天數據）");
    } catch (error: any) {
      showToast(error.message || "AI 分析失敗，請檢查網路狀態", "error");
    } finally {
      setIsAnalyzing(false);
    }
  }, [employees, showToast, currentArchiveDate, currentDataSource]);

  const saveToHistory = async () => {
    if (employees.length === 0 || isSaving) return;

    const titlePrompt = window.prompt("請輸入存檔名稱：", currentTitle);
    if (titlePrompt === null) return;

    const title = titlePrompt.trim() || `存檔 ${new Date().toLocaleString()}`;
    setIsSaving(true);

    // 使用當前選擇的歸檔日期，若無則使用今天
    const archiveDate = currentArchiveDate || new Date().toISOString().split('T')[0];

    const newRecord: HistoryRecord = {
      id: `rec-${Date.now()}`,
      title: title,
      date: new Date().toLocaleString(),
      archiveDate: archiveDate,
      dataSource: currentDataSource,
      rawData: JSON.parse(JSON.stringify(employees)),
      totalRevenue: employees.reduce((sum, e) => sum + (e.todayNetRevenue || 0), 0)
    };

    try {
      await saveRecordDB(newRecord);
      await refreshHistory();
      setCurrentTitle(title);
      showToast("💾 存檔成功！已同步至側邊欄");
    } catch (e) {
      console.error("App: Save error", e);
      showToast("資料庫儲育失敗", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const loadRecord = (record: HistoryRecord) => {
    console.log('📂 載入記錄:', record.title);
    console.log('  - rawData 筆數:', record.rawData?.length || 0);
    console.log('  - analyzed41DaysData 筆數:', record.analyzed41DaysData?.length || 0);
    console.log('  - isAnalyzed:', record.isAnalyzed);

    // 載入雙視角數據
    const raw = record.rawData;
    const analyzed = record.analyzed41DaysData;

    setRawData([...raw]);
    setAnalyzed41DaysData(analyzed ? [...analyzed] : []);
    setIsAnalyzed(record.isAnalyzed || false);

    // 根據當前視角設定顯示數據
    if (dataView === 'analyzed' && analyzed) {
      console.log('  → 切換到 41天分析視角');
      setEmployees([...analyzed]);
    } else {
      console.log('  → 切換到當日數據視角');
      setEmployees([...raw]);
      setDataView('raw');  // 如果沒有分析數據，強制切換到原始視角
    }

    setCurrentTitle(record.title);
    setCurrentArchiveDate(record.archiveDate || '');
    setCurrentDataSource(record.dataSource || 'combined');
    showToast(`已載入：${record.title}`);
  };

  const handleDateSelect = async (date: string, dataSource: 'minshi' | 'yishin' | 'combined') => {
    setCurrentArchiveDate(date);
    setCurrentDataSource(dataSource);
    const record = await getRecordByDateDB(date, dataSource); // 傳入 dataSource
    if (record) {
      loadRecord(record);
    } else {
      setEmployees([]);
      setCurrentTitle(`${date} (${dataSource === 'minshi' ? '民視表' : dataSource === 'yishin' ? '奕心表' : '總和表'}) - 無數據`);
      showToast(`${date} 無數據，可上傳新數據`, 'error');
    }
  };

  const deleteRecord = async (id: string) => {
    if (window.confirm("確定刪除這筆紀錄嗎？")) {
      await deleteRecordDB(id);
      await refreshHistory();
      showToast("紀錄已移除");
    }
  };

  const handleClearAll = async () => {
    if (history.length === 0) return;
    if (window.confirm("⚠️ 警告：這將永久刪除資料庫中的「所有」歷史存檔紀錄，且無法復原。確定要繼續嗎？")) {
      try {
        await clearAllRecordsDB();
        await refreshHistory();
        showToast("🧹 所有歷史紀錄已清空");
      } catch (e) {
        showToast("清空失敗", "error");
      }
    }
  };

  const handleExportAll = () => {
    if (history.length === 0) return;
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `marketing_history_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("備份檔案已下載");
  };

  return (
    <div className="min-h-screen pb-20 relative bg-slate-50 flex flex-col">
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[100] px-8 py-4 rounded-3xl shadow-2xl flex items-center space-x-3 border-2 border-white/50 backdrop-blur-xl animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'error' ? 'bg-rose-600/90 text-white' : 'bg-slate-900/90 text-white'}`}>
          {notification.type === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            <span className="text-xl">{notification.type === 'success' ? '✨' : '⚠️'}</span>
          )}
          <span className="font-black text-xs uppercase tracking-tight">{notification.message}</span>
        </div>
      )}

      <header className="h-40 bg-slate-900 flex flex-col justify-end p-8 border-b-4 border-blue-600">
        <div className="max-w-7xl mx-auto w-full flex items-end justify-between">
          <div className="flex items-center gap-6">
            {/* 選單按鈕 */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all"
                aria-label="選單"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="absolute left-0 top-full mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 py-2 z-50 overflow-hidden">
                    <button
                      onClick={() => { setActiveArea('analysis'); setMenuOpen(false); }}
                      className={`w-full px-4 py-3 text-left font-black text-sm transition-colors flex items-center gap-2 ${activeArea === 'analysis' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="text-lg">📊</span> 分析區
                    </button>
                    <div className="border-t border-slate-200 my-1" role="separator" />
                    <button
                      onClick={() => { setActiveArea('input'); setMenuOpen(false); }}
                      className={`w-full px-4 py-3 text-left font-black text-sm transition-colors flex items-center gap-2 ${activeArea === 'input' ? 'bg-blue-50 text-blue-700' : 'text-slate-700 hover:bg-slate-50'}`}
                    >
                      <span className="text-lg">📥</span> 輸入區
                    </button>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-4">
              <h1 className="text-3xl font-black text-white italic tracking-tighter">行銷火力分析系統</h1>
              <span className={`text-xs font-black px-3 py-1 rounded-full ${activeArea === 'analysis' ? 'bg-blue-500/30 text-blue-100' : 'bg-emerald-500/30 text-emerald-100'}`}>
                {activeArea === 'analysis' ? '📊 分析區' : '📥 輸入區'}
              </span>
            </div>
          </div>
          <ApiDiagnostics />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex-1">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* 左側欄：分析區僅顯示月曆，輸入區顯示全部 */}
          <div className="w-full lg:w-80 space-y-6">
            {activeArea === 'input' && (
              <>
                {/* 員工清單按鈕 - 僅輸入區 */}
                <button
                  onClick={() => setShowEmployeeDirectory(true)}
                  className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white py-4 rounded-xl font-black text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                >
                  <span className="text-2xl">👥</span>
                  員工清單
                </button>
              </>
            )}
            <CalendarCard onDateSelect={handleDateSelect} refreshTrigger={calendarRefreshTrigger} defaultDataSource={currentDataSource} selectedDateFromParent={currentArchiveDate || null} />

            {/* 戰略決策看板 - 嵌入式 (Compact Mode) */}
            {activeArea === 'analysis' && history.length > 0 && (
              <ExecutiveDashboard history={history} currentEmployees={employees} compact={true} />
            )}

            {activeArea === 'input' && (
              <>
                <DataInput onDataLoaded={handleDataLoad} isAnalyzing={isAnalyzing} />
                <HistorySidebar
                  records={history}
                  onLoadRecord={loadRecord}
                  onDeleteRecord={deleteRecord}
                  onClearAll={handleClearAll}
                  onExportAll={handleExportAll}
                />
              </>
            )}
          </div>

          <div className="flex-1">
            {/* 標題列 */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <h2 className="text-2xl font-black text-slate-800">{currentTitle}</h2>
                {employees.length > 0 && currentArchiveDate && (
                  <div className="text-sm text-slate-600 font-bold">
                    📅 {currentArchiveDate}
                  </div>
                )}
              </div>

              {/* AI 分析按鈕 - 僅輸入區 */}
              {activeArea === 'input' && employees.length > 0 && (
                <button
                  onClick={handleAIAnalyze}
                  disabled={isAnalyzing}
                  className={`px-6 py-3 rounded-xl font-black text-sm shadow-lg transition-all flex items-center gap-2 ${isAnalyzing
                    ? 'bg-slate-700 text-slate-300 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:from-purple-700 hover:to-blue-700 active:scale-95'
                    }`}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      分析中...
                    </>
                  ) : (
                    <>
                      🧠 AI 分析
                    </>
                  )}
                </button>
              )}
            </div>


            {/* 視角切換已移除，回歸單一視角 */}
            {employees.length > 0 && rawData.length > 0 && (
              <div className="flex items-center gap-3 mb-6">
                <span className="text-xs text-slate-500 font-bold uppercase tracking-widest">數據視角:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setDataView('raw');
                      setEmployees([...rawData]);
                    }}
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${dataView === 'raw'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    📅 當日數據
                  </button>
                  <button
                    onClick={() => {
                      if (analyzed41DaysData.length > 0) {
                        setDataView('analyzed');
                        setEmployees([...analyzed41DaysData]);
                      }
                    }}
                    disabled={!isAnalyzed || analyzed41DaysData.length === 0}
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${dataView === 'analyzed'
                      ? 'bg-purple-600 text-white shadow-md'
                      : isAnalyzed
                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed'
                      }`}
                  >
                    📈 41天分析 {!isAnalyzed && '(未分析)'}
                  </button>
                </div>
                {isAnalyzed && (
                  <span className="text-xs text-emerald-600 font-bold">✓ 已分析</span>
                )}
              </div>
            )}
            <Dashboard employees={employees} />
          </div>
        </div>
      </main>
      <ChatBot contextData={employees} />

      {/* 員工清單模態視窗 */}
      {showEmployeeDirectory && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col relative overflow-hidden">
            <button
              onClick={() => setShowEmployeeDirectory(false)}
              className="absolute top-4 right-4 w-10 h-10 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors z-50"
            >
              ✕
            </button>
            <EmployeeDirectory
              onSelectEmployee={(emp) => {
                setSelectedEmployee(emp);
                setShowEmployeeDirectory(false);
              }}
            />
          </div>
        </div>
      )}

      {/* 員工詳細頁模態視窗 */}
      {selectedEmployee && (
        <EmployeeProfilePage
          employee={selectedEmployee}
          onClose={() => setSelectedEmployee(null)}
          onUpdate={() => {
            // 可選：重新載入員工清單
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
};

export default App;
