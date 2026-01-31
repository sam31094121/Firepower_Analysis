
import React, { useState, useEffect, useCallback } from 'react';
import DataInput from './components/DataInput';
import Dashboard from './components/Dashboard';
import ChatBot from './components/ChatBot';
import HistorySidebar from './components/HistorySidebar';
import { analyzePerformance, generateMarketingImage } from './services/geminiService';
import { getAllRecordsDB, saveRecordDB, deleteRecordDB } from './services/dbService';
import { EmployeeData, HistoryRecord } from './types';

const App: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeData[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentTitle, setCurrentTitle] = useState<string>('未命名分析');
  const [bannerImage, setBannerImage] = useState<string>('https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80');
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // 初始載入：從 IndexedDB 抓取歷史紀錄
  useEffect(() => {
    const initApp = async () => {
      try {
        const records = await getAllRecordsDB();
        setHistory(records);
        
        // 恢復上次工作狀態
        const lastSession = localStorage.getItem('marketing_firepower_last_session');
        if (lastSession) {
          const parsed = JSON.parse(lastSession);
          if (parsed && Array.isArray(parsed.data)) {
            setEmployees(parsed.data);
            setCurrentTitle(parsed.title || '上次分析紀錄');
          }
        }
      } catch (e) {
        console.error("Initialization failed", e);
      }
    };
    initApp();
  }, []);

  // 重點修正：數據一進入立刻顯示，不等待 AI
  const handleDataLoaded = useCallback(async (newData: EmployeeData[]) => {
    if (newData.length === 0) return;
    
    // 1. 先把基礎數據呈現出來 (這會立刻讓卡片人數從 0 變動)
    setEmployees(newData);
    setCurrentTitle(`待分析報表 ${new Date().toLocaleTimeString()}`);
    
    // 2. 啟動 AI 背景分析
    setIsAnalyzing(true);
    showToast("數據已載入，AI 正在分析火力...");
    
    try {
      const analyzedData = await analyzePerformance(newData);
      setEmployees(analyzedData);
      
      const finalizedTitle = `分析完成 ${new Date().toLocaleString()}`;
      setCurrentTitle(finalizedTitle);
      
      // 同步到本地暫存
      localStorage.setItem('marketing_firepower_last_session', JSON.stringify({
        title: finalizedTitle,
        data: analyzedData
      }));
      
      showToast("✅ AI 分析分組已更新");
    } catch (error) {
      console.error("Analysis Error", error);
      showToast("AI 分類失敗，請手動確認分類", "error");
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  const saveToHistory = async () => {
    if (!employees || employees.length === 0) {
      showToast("目前沒有數據可以儲存", "error");
      return;
    }
    
    const titlePrompt = window.prompt("請輸入這份分析報表的存檔名稱：", currentTitle);
    if (titlePrompt === null) return;
    
    const title = titlePrompt.trim() || `分析紀錄 ${new Date().toLocaleString()}`;

    const newRecord: HistoryRecord = {
      id: Date.now().toString(),
      title: title,
      date: new Date().toLocaleString(),
      data: [...employees],
      totalRevenue: employees.reduce((sum, e) => sum + (e.monthlyActualRevenueNet || 0), 0)
    };

    try {
      // 確保調用資料庫儲存
      await saveRecordDB(newRecord);
      
      // 更新側邊欄列表
      const updatedHistory = await getAllRecordsDB();
      setHistory(updatedHistory);
      
      setCurrentTitle(title);
      showToast("💾 資料庫存檔成功");
    } catch (e) {
      console.error("DB Save Error:", e);
      showToast("資料庫儲存失敗，請檢查權限", "error");
    }
  };

  const loadRecord = (record: HistoryRecord) => {
    setEmployees([...record.data]);
    setCurrentTitle(record.title);
    localStorage.setItem('marketing_firepower_last_session', JSON.stringify({
      title: record.title,
      data: record.data
    }));
    showToast(`已載入：${record.title}`);
  };

  const deleteRecord = async (id: string) => {
    if (window.confirm("確定要刪除這筆歷史紀錄嗎？")) {
      try {
        await deleteRecordDB(id);
        const updatedHistory = await getAllRecordsDB();
        setHistory(updatedHistory);
        showToast("紀錄已刪除");
      } catch (e) {
        showToast("刪除失敗", "error");
      }
    }
  };

  return (
    <div className="min-h-screen pb-20 relative bg-slate-50">
      {/* 通知 */}
      {notification && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4 duration-300 ${notification.type === 'success' ? 'bg-slate-900 text-white' : 'bg-rose-600 text-white'}`}>
          <span>{notification.type === 'success' ? '⚡' : '⚠️'}</span>
          <span className="font-bold">{notification.message}</span>
        </div>
      )}

      <header className="relative h-48 sm:h-60 overflow-hidden mb-8">
        <img src={bannerImage} alt="Banner" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent flex flex-col justify-end p-10">
          <div className="max-w-6xl mx-auto w-full">
            <div className="flex items-center space-x-4 mb-2">
              <span className="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-black italic tracking-tighter shadow-lg">PRO VERSION</span>
              <h1 className="text-4xl font-black text-white tracking-tighter italic">行銷火力分析系統</h1>
            </div>
            <p className="text-slate-300 text-sm font-bold tracking-tight">AI Driven Performance & Database Management System</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* 左側面板 */}
          <div className="w-full lg:w-80 space-y-6">
            <DataInput onDataLoaded={handleDataLoaded} />
            <HistorySidebar 
              records={history} 
              onLoadRecord={loadRecord} 
              onDeleteRecord={deleteRecord}
              onExportAll={() => {}}
            />
            <button 
              onClick={() => {
                if(window.confirm("確定清除目前畫面數據？")) setEmployees([]);
              }}
              className="w-full py-4 text-slate-400 hover:text-rose-500 text-[11px] font-black tracking-widest uppercase transition-colors"
            >
              清除工作區清單
            </button>
          </div>

          {/* 右側儀表板 */}
          <div className="flex-1">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
              <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{currentTitle}</h2>
                {isAnalyzing && (
                  <div className="flex items-center text-blue-600 mt-2 space-x-2">
                    <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs font-black italic">Gemini AI 正在深度運算分組建議...</span>
                  </div>
                )}
              </div>
              
              {employees.length > 0 && (
                <button 
                  onClick={saveToHistory}
                  className="group bg-slate-900 hover:bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-[0_10px_20px_-10px_rgba(15,23,42,0.5)] transition-all active:scale-95 flex items-center space-x-3"
                >
                  <span className="text-lg group-hover:rotate-12 transition-transform">💾</span>
                  <span className="font-black tracking-tight">儲存至資料庫</span>
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
