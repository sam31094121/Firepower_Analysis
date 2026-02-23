import React, { useState } from 'react';
import { mergeAndSave, DailyStat } from '../services/mergeService';

/**
 * MergePanel：手動觸發 A+B 合併，寫入 C 表（dailyStats/）
 * 日期範圍選擇後按「執行合併」。
 */
const MergePanel: React.FC = () => {
    const todayStr = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(todayStr);
    const [endDate, setEndDate] = useState(todayStr);
    const [status, setStatus] = useState<'idle' | 'merging' | 'done' | 'error'>('idle');
    const [result, setResult] = useState<DailyStat[]>([]);

    const handleMerge = async () => {
        if (startDate > endDate) { alert('開始日期不能晚於結束日期。'); return; }
        setStatus('merging');
        setResult([]);
        try {
            const stats = await mergeAndSave(startDate, endDate);
            setResult(stats);
            setStatus('done');
        } catch (err) {
            console.error('合併失敗:', err);
            setStatus('error');
        }
    };

    // 統計摘要
    const totalOrders = result.reduce((s, r) => s + r.totalSales, 0);
    const totalRevenue = result.reduce((s, r) => s + r.totalRevenue, 0);
    const totalDisp = result.reduce((s, r) => s + r.totalDispatches, 0);
    const avgConvRate = result.length > 0
        ? (result.reduce((s, r) => s + r.conversionRate, 0) / result.length * 100).toFixed(1)
        : '0.0';

    return (
        <div className="space-y-5">
            {/* 說明 */}
            <p className="text-[11px] text-slate-400">
                將「訂單系統（來源 A）」＋「派單紀錄（來源 B）」合併計算，結果寫入 <code className="bg-slate-100 rounded px-1">dailyStats</code>。
            </p>

            {/* 日期範圍 */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">開始日期</label>
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
                <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">結束日期</label>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                </div>
            </div>

            {/* 合併按鈕 */}
            <button
                type="button"
                onClick={handleMerge}
                disabled={status === 'merging'}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
            >
                {status === 'merging' ? (
                    <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /><span>合併計算中...</span></>
                ) : (
                    <span>⚡ 執行合併</span>
                )}
            </button>

            {/* 錯誤 */}
            {status === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm font-bold text-red-600">
                    ❌ 合併失敗，請確認 Firestore 設定或稍後再試。
                </div>
            )}

            {/* 結果摘要 */}
            {status === 'done' && result.length > 0 && (
                <div className="space-y-3">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                            <div className="text-xl font-black text-emerald-600">{result.length}</div>
                            <div className="text-[10px] text-emerald-500 font-bold">人日紀錄</div>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
                            <div className="text-xl font-black text-blue-600">{totalOrders}</div>
                            <div className="text-[10px] text-blue-500 font-bold">成交筆數</div>
                        </div>
                        <div className="bg-purple-50 rounded-xl p-3 text-center border border-purple-100">
                            <div className="text-xl font-black text-purple-600">{avgConvRate}%</div>
                            <div className="text-[10px] text-purple-500 font-bold">平均成交率</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                            <div className="text-xl font-black text-slate-600">${(totalRevenue / 10000).toFixed(1)}萬</div>
                            <div className="text-[10px] text-slate-500 font-bold">總業績</div>
                        </div>
                    </div>

                    {/* 明細列表 */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-64">
                        <table className="w-full text-[11px] border-collapse min-w-[500px]">
                            <thead className="sticky top-0 bg-slate-900 text-white">
                                <tr>
                                    {['日期', '員工', '派單', '成交', '成交率', '業績'].map(h => (
                                        <th key={h} className="px-3 py-2 font-black text-left whitespace-nowrap">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {result
                                    .sort((a, b) => `${a.date}${a.empName}`.localeCompare(`${b.date}${b.empName}`))
                                    .map(r => (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="px-3 py-1.5">{r.date}</td>
                                            <td className="px-3 py-1.5 font-bold text-slate-700">{r.empName}</td>
                                            <td className="px-3 py-1.5 text-slate-500">{r.totalDispatches || '—'}</td>
                                            <td className="px-3 py-1.5 text-emerald-600 font-bold">{r.totalSales}</td>
                                            <td className="px-3 py-1.5 font-bold">
                                                {r.totalDispatches > 0
                                                    ? <span className={r.conversionRate >= 0.5 ? 'text-emerald-600' : 'text-amber-500'}>
                                                        {(r.conversionRate * 100).toFixed(0)}%
                                                    </span>
                                                    : <span className="text-slate-300">—</span>
                                                }
                                            </td>
                                            <td className="px-3 py-1.5 text-blue-600 font-bold text-right whitespace-nowrap">
                                                {r.totalRevenue > 0 ? `$${r.totalRevenue.toLocaleString()}` : '—'}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </div>

                    <p className="text-center text-[10px] text-slate-400">
                        ✅ 已寫入 <code className="bg-slate-100 rounded px-1">dailyStats</code> collection
                    </p>
                </div>
            )}

            {status === 'done' && result.length === 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm font-bold text-amber-600">
                    ⚠️ 指定日期範圍內沒有任何訂單或派單紀錄。
                </div>
            )}
        </div>
    );
};

export default MergePanel;
