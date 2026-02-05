
import React, { useState, useMemo } from 'react';
import { HistoryRecord } from '../types';

interface Props {
  records: HistoryRecord[];
  onLoadRecord: (record: HistoryRecord) => void;
  onDeleteRecord: (id: string) => void;
  onClearAll: () => void;
  onExportAll: () => void;
}

const HistorySidebar: React.FC<Props> = ({ records, onLoadRecord, onDeleteRecord, onClearAll, onExportAll }) => {
  const [showAllHistory, setShowAllHistory] = useState(false);

  // 計算41天視窗範圍
  const filteredRecords = useMemo(() => {
    if (showAllHistory) {
      return records;
    }

    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    const startDate = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    return records.filter(r => {
      if (!r.archiveDate) return true; // 舊紀錄沒有 archiveDate，預設顯示
      return r.archiveDate >= startDate && r.archiveDate <= endDate;
    });
  }, [records, showAllHistory]);

  const sortedRecords = [...filteredRecords].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col space-y-3 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-800 text-sm flex items-center">
            <span className="mr-2">📁</span> 歷史存檔管理
          </h3>
          <span className="text-[10px] font-black text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
            {sortedRecords.length} / {records.length} 筆
          </span>
        </div>

        {/* 41天視窗開關 */}
        <div className="flex items-center justify-between text-xs">
          <button
            onClick={() => setShowAllHistory(!showAllHistory)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className={`w-3 h-3 rounded-sm border-2 ${showAllHistory ? 'bg-blue-600 border-blue-600' : 'border-slate-300'}`} />
            <span className="font-bold text-slate-700">顯示全部歷史</span>
          </button>
          {!showAllHistory && (
            <span className="text-[10px] text-slate-500 font-bold">41天視窗</span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={(e) => { e.preventDefault(); onExportAll(); }}
            type="button"
            className="flex-1 text-[9px] font-black tracking-widest uppercase bg-slate-200 hover:bg-slate-300 text-slate-600 py-2 rounded transition-colors"
          >
            匯出備份 (JSON)
          </button>
        </div>
      </div>
      <div className="max-h-[400px] overflow-y-auto">
        {sortedRecords.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs italic">
            {showAllHistory ? '目前沒有歷史存檔' : '最近41天沒有存檔'}
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
                    {rec.archiveDate && (
                      <div className="text-[10px] text-blue-600 font-bold mt-0.5">📅 {rec.archiveDate}</div>
                    )}
                    <div className="text-[10px] font-bold text-emerald-600 mt-1">
                      {rec.totalRevenue.toLocaleString()}
                    </div>
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
