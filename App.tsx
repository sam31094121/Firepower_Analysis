
import React, { useState, useEffect, useCallback } from 'react';
import DataInput from './components/DataInput';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import HistorySidebar from './components/HistorySidebar';
import ApiDiagnostics from './components/ApiDiagnostics';
import { analyzePerformance } from './services/geminiService';
import { getAllRecordsDB, saveRecordDB, deleteRecordDB, clearAllRecordsDB } from './services/dbService';
import { EmployeeData, HistoryRecord } from './types';

const App: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string>('未命名分析');
  const [notification, setNotification] = useState<{ message: string, type: 'success' | 'error' } | null>(null);

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

  useEffect(() => {
    refreshHistory();
    const lastSession = localStorage.getItem('marketing_firepower_last_session');
    if (lastSession) {
      try {
        const parsed = JSON.parse(lastSession);
        if (parsed?.data) { setEmployees(parsed.data); setCurrentTitle(parsed.title); }
      } catch (e) { }
    }
  }, []);

  const handleDataLoaded = useCallback(async (newData: EmployeeData[]) => {
    setEmployees(newData);
    setCurrentTitle(`待分析報表 ${new Date().toLocaleTimeString()}`);
    setIsAnalyzing(true);
    showToast("AI 深度分析中，請稍候...", "loading");

    try {
      const analyzedData = await analyzePerformance(newData);
      setEmployees(analyzedData);
      const title = `分析完成 ${new Date().toLocaleString()}`;
      setCurrentTitle(title);
      localStorage.setItem('marketing_firepower_last_session', JSON.stringify({ title, data: analyzedData }));
      showToast("✅ AI 分析完畢");
    } catch (error: any) {
      showToast(error.message || "AI 分類失敗，請檢查網路狀態", "error");
    } finally { setIsAnalyzing(false); }
  }, [showToast]);

  const saveToHistory = async () => {
    if (employees.length === 0 || isSaving) return;

    const titlePrompt = window.prompt("請輸入存檔名稱：", currentTitle);
    if (titlePrompt === null) return;

    const title = titlePrompt.trim() || `存檔 ${new Date().toLocaleString()}`;
    setIsSaving(true);

    const newRecord: HistoryRecord = {
      id: `rec-${Date.now()}`,
      title: title,
      date: new Date().toLocaleString(),
      data: JSON.parse(JSON.stringify(employees)),
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
    setEmployees([...record.data]);
    setCurrentTitle(record.title);
    showToast(`已載入：${record.title}`);
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
          <h1 className="text-3xl font-black text-white italic tracking-tighter">行銷火力分析系統</h1>
          <ApiDiagnostics />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10 w-full flex-1">
        <div className="flex flex-col lg:flex-row gap-10">
          <div className="w-full lg:w-80 space-y-6">
            <DataInput onDataLoaded={handleDataLoaded} isAnalyzing={isAnalyzing} />
            <HistorySidebar
              records={history}
              onLoadRecord={loadRecord}
              onDeleteRecord={deleteRecord}
              onClearAll={handleClearAll}
              onExportAll={handleExportAll}
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-black text-slate-800">{currentTitle}</h2>
              {employees.length > 0 && (
                <button
                  onClick={saveToHistory}
                  disabled={isSaving || isAnalyzing}
                  className={`bg-blue-600 hover:bg-slate-900 text-white px-8 py-3 rounded-xl font-black shadow-lg transition-all active:scale-95 flex items-center space-x-2 ${isSaving || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <span>{isSaving ? '正在寫入...' : '💾 儲存分析結果'}</span>
                </button>
              )}
            </div>
            <Dashboard employees={employees} />
          </div>
        </div>
      </main>
      <ChatBot contextData={employees} />
    </div>
  );
};

export default App;
