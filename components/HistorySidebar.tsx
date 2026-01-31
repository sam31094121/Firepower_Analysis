
import React from 'react';
import { HistoryRecord } from '../types';

interface Props {
  records: HistoryRecord[];
  onLoadRecord: (record: HistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
  onExportAll: () => void;
}

const HistorySidebar: React.FC<Props> = ({ records, onLoadRecord, onDeleteRecord, onExportAll }) => {
  // 關鍵修復：使用 [...records] 避免在 render 過程中修改原始 props 導致 React 狀態錯誤
  const sortedRecords = [...records].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <h3 className="font-bold text-slate-800 text-sm flex items-center">
          <span className="mr-2">📁</span> 歷史存檔管理
        </h3>
        <button 
          onClick={(e) => { e.preventDefault(); onExportAll(); }}
          type="button"
          className="text-[10px] bg-slate-200 hover:bg-slate-300 text-slate-600 px-2 py-1 rounded transition-colors"
        >
          匯出備份
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {sortedRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            目前沒有歷史存檔
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {sortedRecords.map((rec) => (
              <div 
                key={rec.id} 
                className="p-3 hover:bg-blue-50/30 group transition-colors cursor-pointer" 
                onClick={() => onLoadRecord(rec)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-slate-700 truncate">{rec.title}</div>
                    <div className="text-[10px] text-slate-400">{rec.date}</div>
                    <div className="text-[10px] font-semibold text-emerald-600 mt-1">${rec.totalRevenue.toLocaleString()}</div>
                  </div>
                  <button 
                    type="button"
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      e.preventDefault();
                      onDeleteRecord(rec.id); 
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-300 hover:text-rose-500 transition-all"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HistorySidebar;
