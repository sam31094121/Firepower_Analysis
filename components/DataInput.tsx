
import React, { useState, useCallback } from 'react';
import { extractDataFromImage } from '../services/geminiService';
import { validateEmployeeData } from '../services/dataValidation';
import { EmployeeData, EmployeeCategory, ValidationResult } from '../types';
import { calculateRankings } from '../utils/rankingCalculator';
import ValidationModal from './ValidationModal';
import OrderImport from './OrderImport';
import DispatchInput from './DispatchInput';
import MergePanel from './MergePanel';

interface Props {
  onDataLoaded: (data: EmployeeData[]) => void;
  onStatusChange?: (status: string) => void;
  isAnalyzing?: boolean;
}

const EXCEL_HEADERS = ["行銷", "派單數", "派成數", "追續數", "總業績", "派單價值", "追續總額", "業績排名", "追續排名", "均價排名", "派單成交率"];
const COL_COUNT = EXCEL_HEADERS.length;

const DataInput: React.FC<Props> = ({ onDataLoaded, onStatusChange, isAnalyzing }) => {
  const [activeTab, setActiveTab] = useState<'paste' | 'image' | 'order' | 'dispatch' | 'merge'>('paste');
  const [loadingImage, setLoadingImage] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [pendingData, setPendingData] = useState<EmployeeData[] | null>(null);

  const createBlankRow = () => Array(COL_COUNT).fill('');

  const [gridData, setGridData] = useState<string[][]>(() =>
    Array(3).fill(null).map(() => createBlankRow())
  );

  const handleCellChange = (rowIndex: number, colIndex: number, value: string) => {
    const newData = [...gridData];
    newData[rowIndex] = [...newData[rowIndex]];
    newData[rowIndex][colIndex] = value;

    if (rowIndex === newData.length - 1 && value.trim() !== '') {
      newData.push(createBlankRow());
    }
    setGridData(newData);
  };

  const handleClear = () => {
    if (isAnalyzing) return;
    setGridData(Array(3).fill(null).map(() => createBlankRow()));
  };

  const cleanNum = (val: string | number) => {
    if (val === undefined || val === null || val === '') return 0;
    const cleaned = val.toString().replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = () => {
    if (isAnalyzing) return;

    const validRows = gridData.filter(row => row.some(cell => cell.trim() !== ''));
    if (validRows.length === 0) {
      alert("請輸入至少一筆數據。");
      return;
    }

    const parsed: EmployeeData[] = validRows.map((row, idx) => {
      const rev = cleanNum(row[4]);
      const leads = cleanNum(row[1]);
      const sales = cleanNum(row[2]);

      // 自動計算派單價值
      const avgOrderValue = leads > 0 ? Math.round(rev / leads) : 0;

      // 自動計算成交率
      const convRate = leads > 0 ? ((sales / leads) * 100).toFixed(1) : '0.0';

      return {
        id: `grid-${idx}-${Date.now()}`,
        name: row[0] || `員工 ${idx + 1}`,
        todayLeads: leads,
        todaySales: sales,
        followupCount: cleanNum(row[3]),
        todayNetRevenue: rev,
        avgOrderValue: avgOrderValue,  // 自動計算
        todayFollowupSales: cleanNum(row[6]),
        revenueRank: '-',      // 稍後自動計算
        followupRank: '-',     // 稍後自動計算
        avgPriceRank: '-',     // 稍後自動計算
        todayConvRate: `${convRate}%`,  // 自動計算
        monthlyActualRevenueNet: rev,
        monthlyTotalConvRate: `${convRate}%`,
        monthlyTotalLeads: 0,
        monthlyLeadSales: 0,
        monthlyFollowupSales: 0,
        todayVirtualLeadPaid: 0,
        todayVirtualFollowupPaid: 0,
        monthlyVirtualLeadDeposit: 0,
        monthlyVirtualFollowupDeposit: 0,
        depositWithdrawal: 0,
        accumulatedDeposit: 0,
        withdrawalFollowup: 0,
        followupAmount: 0,
        returnAmount: 0,
        monthlyActualRevenue: rev,
        category: EmployeeCategory.STEADY
      };
    });

    // 自動計算排名
    const rankedData = calculateRankings(parsed);

    // 驗證資料
    const result = validateEmployeeData(rankedData);

    if (!result.isValid || result.infos.length > 0) {
      // 有錯誤或提示,顯示 Modal
      setValidationResult(result);
      setPendingData(rankedData);
    } else {
      // 直接載入
      onDataLoaded(rankedData);
    }
  };

  const handleValidationClose = () => {
    setValidationResult(null);
    setPendingData(null);
  };

  const handleValidationContinue = () => {
    if (pendingData) {
      onDataLoaded(pendingData);
      setValidationResult(null);
      setPendingData(null);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (activeTab !== 'paste' || isAnalyzing) return;
    const text = e.clipboardData.getData('text');
    if (!text.trim()) return;

    e.preventDefault();
    const rowsText = text.trim().split(/\r?\n/);
    const newGrid: string[][] = rowsText.map(line => {
      const cells = line.split('\t');
      const row = [...cells];
      while (row.length < COL_COUNT) row.push('');
      return row.slice(0, COL_COUNT);
    });

    newGrid.push(createBlankRow());
    setGridData(newGrid);
  };

  const processImageFile = useCallback(async (file: File) => {
    setLoadingImage(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      try {
        const extractedRows = await extractDataFromImage(base64);

        if (extractedRows && extractedRows.length > 0) {
          const filledGrid = extractedRows.map(row => {
            const newRow = [...row];
            while (newRow.length < COL_COUNT) newRow.push('');
            return newRow.slice(0, COL_COUNT);
          });
          filledGrid.push(createBlankRow());

          setGridData(filledGrid);
          setActiveTab('paste');
          alert("AI 辨識完成！數據已填入表格，請檢查無誤後點擊「執行分析」。");
        }
      } catch (err) {
        console.error("OCR Error:", err);
        alert("AI 辨識失敗，請確保圖片清晰或嘗試手動貼上。");
      } finally {
        setLoadingImage(false);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden mb-6 flex flex-col transition-all">
      <div className="flex bg-slate-100 border-b border-slate-200 overflow-x-auto">
        <button type="button" onClick={() => setActiveTab('paste')} disabled={isAnalyzing} className={`flex-none px-3 py-4 text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeTab === 'paste' ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>EXCEL 表格</button>
        <button type="button" onClick={() => setActiveTab('order')} disabled={isAnalyzing} className={`flex-none px-3 py-4 text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeTab === 'order' ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>📦 訂單匯入</button>
        <button type="button" onClick={() => setActiveTab('dispatch')} disabled={isAnalyzing} className={`flex-none px-3 py-4 text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeTab === 'dispatch' ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>📌 派單輸入</button>
        <button type="button" onClick={() => setActiveTab('merge')} disabled={isAnalyzing} className={`flex-none px-3 py-4 text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeTab === 'merge' ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>⚡ 數據合併</button>
        <button type="button" onClick={() => setActiveTab('image')} disabled={isAnalyzing} className={`flex-none px-3 py-4 text-[10px] font-black tracking-widest transition-all whitespace-nowrap ${activeTab === 'image' ? 'text-blue-600 bg-white border-b-2 border-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>AI 辨識</button>
      </div>

      <div className="p-4" onPaste={activeTab === 'paste' ? handlePaste : undefined}>
        {activeTab === 'paste' ? (
          <div className="space-y-6">
            <div className="overflow-x-auto border-2 rounded-xl border-slate-200 shadow-inner bg-slate-50">
              <table className="w-full text-[11px] border-collapse min-w-[1200px]">
                <thead>
                  <tr className="bg-slate-900 divide-x divide-slate-700">
                    <th className="w-10 p-2 text-slate-500 font-mono text-[9px]">#</th>
                    {EXCEL_HEADERS.map(h => (
                      <th key={h} className="p-3 text-white font-black text-center min-w-[90px] tracking-tighter uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {gridData.map((row, rIdx) => (
                    <tr key={rIdx} className="divide-x divide-slate-100 hover:bg-blue-50/30 transition-colors group">
                      <td className="bg-slate-50 text-slate-400 font-mono text-center p-2 group-hover:text-blue-500 text-[9px] border-r border-slate-200">{rIdx + 1}</td>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-0 border-r border-slate-100">
                          <input
                            type="text"
                            value={cell}
                            disabled={isAnalyzing}
                            onChange={(e) => handleCellChange(rIdx, cIdx, e.target.value)}
                            className={`w-full py-3 px-2 bg-transparent outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 text-center font-bold text-slate-800 transition-all ${isAnalyzing ? 'opacity-50' : ''}`}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={handleClear}
                disabled={isAnalyzing}
                className="flex-1 bg-white border-2 border-slate-200 text-slate-500 font-black py-4 rounded-xl hover:bg-rose-50 hover:border-rose-200 hover:text-rose-600 transition-all active:scale-95 shadow-sm disabled:opacity-30 disabled:hover:bg-white disabled:hover:border-slate-200"
              >
                🗑️ 清空表格
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isAnalyzing}
                className={`flex-1 font-black py-4 rounded-xl transition-all shadow-xl active:scale-95 flex items-center justify-center space-x-3 ${isAnalyzing ? 'bg-slate-700 cursor-not-allowed text-slate-300' : 'bg-slate-900 text-white hover:bg-blue-600'}`}
              >
                {isAnalyzing ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>載入中..</span>
                  </>
                ) : (
                  <>
                    <span>📥 資料載入</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : activeTab === 'order' ? (
          /* ── 訂單匯入 Tab ── */
          <OrderImport
            onImportSuccess={(count) => {
              console.log(`訂單匯入完成：${count} 筆`);
            }}
          />
        ) : activeTab === 'dispatch' ? (
          /* ── 派單輸入 Tab ── */
          <DispatchInput />
        ) : activeTab === 'merge' ? (
          /* ── 數據合併 Tab ── */
          <MergePanel />
        ) : (
          <div className="space-y-4">
            <div className={`border-4 border-dashed border-slate-100 rounded-2xl p-12 text-center hover:border-blue-200 hover:bg-blue-50/30 transition-all relative min-h-[240px] flex flex-col items-center justify-center group ${loadingImage ? 'pointer-events-none' : ''}`}>
              {!loadingImage && <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && processImageFile(e.target.files[0])} className="absolute inset-0 opacity-0 cursor-pointer z-10" />}
              <div className="pointer-events-none text-center">
                {loadingImage ? (
                  <div className="flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
                    <p className="text-sm text-slate-600 font-black uppercase">AI 正在解析影像內容...</p>
                    <p className="text-[10px] text-slate-400 mt-2">這將把數據預填至 Excel 表格中</p>
                  </div>
                ) : (
                  <>
                    <div className="text-6xl mb-4">📸</div>
                    <p className="text-sm text-slate-600 font-black uppercase tracking-widest">上傳截圖自動填表</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-bold uppercase">辨識後可手動修改</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 驗證結果 Modal */}
      {validationResult && (
        <ValidationModal
          result={validationResult}
          onClose={handleValidationClose}
          onContinue={handleValidationContinue}
        />
      )}
    </div>
  );
};

export default DataInput;
