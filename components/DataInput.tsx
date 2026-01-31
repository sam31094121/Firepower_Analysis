
import React, { useState, useEffect, useCallback } from 'react';
import { extractDataFromImage } from '../services/geminiService';
import { EmployeeData, EmployeeCategory } from '../types';

interface Props {
  onDataLoaded: (data: EmployeeData[]) => void;
}

const DataInput: React.FC<Props> = ({ onDataLoaded }) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'image'>('paste');
  const [loading, setLoading] = useState(false);
  const [rawText, setRawText] = useState('');

  // 處理圖片檔案
  const processImageFile = useCallback(async (file: File) => {
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const extracted = await extractDataFromImage(base64);
        const mapped: EmployeeData[] = extracted.map((item, idx) => ({
          ...item as EmployeeData,
          id: `img-${idx}-${Date.now()}`,
          category: EmployeeCategory.STEADY,
          timestamp: Date.now()
        }));
        onDataLoaded(mapped);
      } catch (err) {
        alert("圖片辨識失敗，請檢查網路或 API Key。");
      } finally {
        setLoading(false);
      }
    };
    reader.readAsDataURL(file);
  }, [onDataLoaded]);

  // 監聽全域貼上事件 (當處於圖片分頁時)
  useEffect(() => {
    const handleGlobalPaste = (e: ClipboardEvent) => {
      if (activeTab !== 'image' || loading) return;
      
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) processImageFile(blob);
          break;
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [activeTab, loading, processImageFile]);

  // 點擊按鈕從剪貼簿讀取
  const handlePasteButtonClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageTypes = item.types.filter(type => type.startsWith('image/'));
        if (imageTypes.length > 0) {
          const blob = await item.getType(imageTypes[0]);
          const file = new File([blob], "pasted-image.png", { type: imageTypes[0] });
          processImageFile(file);
          return;
        }
      }
      alert("剪貼簿中沒有偵測到圖片數據。請先截圖後再點擊此按鈕。");
    } catch (err) {
      alert("瀏覽器攔截了剪貼簿存取，請直接在網頁上按 Ctrl + V 貼上即可。");
    }
  };

  const cleanNum = (val: string | number): number => {
    if (val === undefined || val === null) return 0;
    const str = val.toString().trim();
    if (str === '' || str === '#DIV/0!' || str === 'NaN' || str === '#REF!') return 0;
    if (typeof val === 'number') return val;
    return Number(str.replace(/[^0-9.-]+/g, "")) || 0;
  };

  const cleanRate = (val: string): string => {
    if (!val) return '0%';
    const str = val.toString().trim();
    if (str === '' || str.includes('#DIV/0!') || str === 'NaN') return '0%';
    return str;
  };

  const handlePasteSubmit = () => {
    const lines = rawText.trim().split(/\r?\n/);
    if (lines.length === 0) return;

    const parsedData: EmployeeData[] = lines.map((line, idx) => {
      const cols = line.split(/\t|,/);
      const c = cols.map(s => s.trim().replace(/^"|"$/g, ''));
      
      return {
        id: `row-${idx}-${Date.now()}`,
        name: c[0] || `員工 ${idx + 1}`,
        todayLeads: cleanNum(c[1]),
        todaySales: cleanNum(c[2]),
        todayConvRate: cleanRate(c[3]),
        todayFollowupSales: cleanNum(c[4]),
        monthlyTotalLeads: cleanNum(c[5]),
        monthlyLeadSales: cleanNum(c[6]),
        monthlyFollowupSales: cleanNum(c[7]),
        monthlyTotalConvRate: cleanRate(c[8]),
        todayVirtualLeadPaid: cleanNum(c[9]),
        todayVirtualFollowupPaid: cleanNum(c[10]),
        monthlyVirtualLeadDeposit: cleanNum(c[11]),
        monthlyVirtualFollowupDeposit: cleanNum(c[12]),
        todayNetRevenue: cleanNum(c[13]),
        depositWithdrawal: cleanNum(c[14]),
        accumulatedDeposit: cleanNum(c[15]),
        withdrawalFollowup: cleanNum(c[16]),
        followupAmount: cleanNum(c[17]),
        returnAmount: cleanNum(c[18]),
        monthlyActualRevenue: cleanNum(c[19]),
        monthlyActualRevenueNet: cleanNum(c[20]),
        category: EmployeeCategory.STEADY,
        timestamp: Date.now()
      };
    });

    onDataLoaded(parsedData);
    setRawText('');
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processImageFile(file);
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-6">
      <div className="flex bg-slate-50 border-b border-slate-200">
        <button 
          onClick={() => setActiveTab('paste')}
          className={`flex-1 py-4 text-xs font-black tracking-widest transition-all ${activeTab === 'paste' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          EXCEL 數據貼上
        </button>
        <button 
          onClick={() => setActiveTab('image')}
          className={`flex-1 py-4 text-xs font-black tracking-widest transition-all ${activeTab === 'image' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
        >
          AI 報表辨識
        </button>
      </div>

      <div className="p-5">
        {activeTab === 'paste' ? (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] text-slate-400 font-bold">自動修正 #DIV/0! 與空值</span>
              <span className="text-[10px] text-blue-500 font-bold">支援 21 欄格式</span>
            </div>
            <textarea 
              className="w-full h-40 p-4 text-[10px] font-mono bg-slate-50 border-2 border-slate-100 rounded-2xl focus:border-blue-500 focus:ring-0 outline-none transition-all placeholder:text-slate-300"
              placeholder="請複製 Excel 整行貼上（包含 #DIV/0! 亦可）..."
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
            />
            <button 
              onClick={handlePasteSubmit}
              disabled={!rawText.trim()}
              className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-blue-600 disabled:opacity-30 transition-all shadow-lg active:scale-95"
            >
              🚀 啟動火力分析
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="border-4 border-dashed border-slate-100 rounded-3xl p-10 text-center hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer relative group min-h-[180px] flex flex-col items-center justify-center">
              <input 
                type="file" 
                accept="image/*" 
                onChange={handleImageUpload} 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
              />
              
              <div className="space-y-3 pointer-events-none">
                <div className="text-4xl group-hover:scale-110 transition-transform duration-300">📸</div>
                <div>
                  <p className="text-xs text-slate-500 font-bold">點擊或拖放報表截圖</p>
                  <p className="text-[9px] text-slate-300 font-bold uppercase mt-1 tracking-wider">或直接按下 Ctrl + V</p>
                </div>
              </div>

              {/* 貼上按鈕 - 移至右下角且不遮擋中央 */}
              <button 
                onClick={handlePasteButtonClick}
                className="absolute bottom-3 right-3 z-20 flex items-center space-x-1.5 px-3 py-1.5 bg-white text-blue-600 border border-blue-100 rounded-xl hover:bg-blue-600 hover:text-white transition-all shadow-sm active:scale-90 group/btn"
              >
                <svg className="w-3 h-3 group-hover/btn:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span className="text-[10px] font-black tracking-tighter">/ 貼上截圖 /</span>
              </button>
            </div>
            
            {loading && (
              <div className="flex items-center justify-center space-x-3 py-2 bg-blue-50/50 rounded-xl">
                <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-[11px] text-blue-600 font-black italic">Gemini 正在深度解析報表影像...</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DataInput;
