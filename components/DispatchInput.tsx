import React, { useState, useEffect, useCallback } from 'react';
import { Dispatch } from '../types';
import { saveDispatchesBatch, getDispatchesByDate } from '../services/orderService';
import { getAllEmployeeProfilesDB } from '../services/dbService';
import { EmployeeProfile } from '../types';

interface DispatchRow {
    rawName: string;    // 使用者輸入的名字
    empId: string;      // alias 對應後的 ID
    empName: string;    // 對應到的正式名
    count: string;      // 派單數（字串方便輸入）
    matched: boolean;   // 是否有對應到員工
}

const today = () => new Date().toISOString().split('T')[0];

const DispatchInput: React.FC = () => {
    const [startDate, setStartDate] = useState<string>(today());
    const [endDate, setEndDate] = useState<string>(today());
    const [batchInput, setBatchInput] = useState('');
    const [rows, setRows] = useState<DispatchRow[]>([
        { rawName: '', empId: '', empName: '', count: '', matched: false }
    ]);
    const [profiles, setProfiles] = useState<EmployeeProfile[]>([]);
    const [aliasMap, setAliasMap] = useState<Record<string, { id: string; name: string }>>({});
    const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'done'>('idle');
    const [saveMsg, setSaveMsg] = useState('');
    const [loaded, setLoaded] = useState(false);

    // ── 載入員工 profiles 建立 alias map ──────────────────────────
    useEffect(() => {
        const load = async () => {
            const profs = await getAllEmployeeProfilesDB();
            setProfiles(profs);
            const map: Record<string, { id: string; name: string }> = {};
            profs.forEach(p => {
                map[p.name] = { id: p.id, name: p.name };
                ((p as any).aliases || []).forEach((a: string) => {
                    map[a] = { id: p.id, name: p.name };
                });
            });
            setAliasMap(map);
            setLoaded(true);
        };
        load();
    }, []);

    // ── 切換日期時載入已有紀錄（補填支援）──────────────────────────
    const loadExisting = useCallback(async (d: string) => {
        if (!loaded) return;
        setStatus('loading');
        try {
            const existing = await getDispatchesByDate(d);
            if (existing.length > 0) {
                const loaded_rows: DispatchRow[] = existing.map(e => ({
                    rawName: e.empName,
                    empId: e.empId,
                    empName: e.empName,
                    count: String(e.totalDispatches),
                    matched: true,
                }));
                // 最後加一行空白讓使用者繼續輸入
                loaded_rows.push({ rawName: '', empId: '', empName: '', count: '', matched: false });
                setRows(loaded_rows);
            } else {
                setRows([{ rawName: '', empId: '', empName: '', count: '', matched: false }]);
            }
        } catch {
            setRows([{ rawName: '', empId: '', empName: '', count: '', matched: false }]);
        }
        setStatus('idle');
    }, [loaded]);

    useEffect(() => {
        if (loaded) loadExisting(endDate);
    }, [endDate, loaded, loadExisting]);

    // ── 批次解析文字 ────────────────────────────────────────────────
    const handleBatchProcess = () => {
        if (!batchInput.trim()) return;
        const lines = batchInput.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        const newRows: DispatchRow[] = [];

        lines.forEach(line => {
            // 略過表頭或是看起來像標題的字
            if (line.includes('派單') || line.includes('行銷') || line.includes('姓名')) return;

            // 支援空白或 Tab 分隔
            const parts = line.split(/[\s\t]+/);
            if (parts.length >= 2) {
                const name = parts[0];
                const count = parts[parts.length - 1]; // 假設最後一個數字是數量

                if (!isNaN(Number(count))) {
                    const m = aliasMap[name];
                    newRows.push({
                        rawName: name,
                        empId: m ? m.id : '',
                        empName: m ? m.name : '',
                        count: count,
                        matched: !!m
                    });
                }
            }
        });

        if (newRows.length > 0) {
            newRows.push({ rawName: '', empId: '', empName: '', count: '', matched: false });
            setRows(newRows);
            setBatchInput('');
            setSaveMsg(`解析完成：帶入 ${newRows.length - 1} 筆有效資料，請確認後按「儲存」。`);
            setTimeout(() => setSaveMsg(''), 5000);
        } else {
            alert('解析失敗：找不到符合「名字 數字」格式的資料。');
        }
    };

    // ── 更新單列 ────────────────────────────────────────────────────
    const updateRow = (idx: number, field: Partial<DispatchRow>) => {
        setRows(prev => {
            const next = [...prev];
            next[idx] = { ...next[idx], ...field };

            // 若修改 rawName，即時 alias 比對
            if ('rawName' in field) {
                const name = field.rawName!.trim();
                const m = aliasMap[name];
                next[idx].empId = m ? m.id : '';
                next[idx].empName = m ? m.name : '';
                next[idx].matched = !!m;
            }

            // 最後一行有值時自動新增一行
            if (idx === next.length - 1 && (next[idx].rawName || next[idx].count)) {
                next.push({ rawName: '', empId: '', empName: '', count: '', matched: false });
            }
            return next;
        });
    };

    const removeRow = (idx: number) => {
        setRows(prev => {
            const next = prev.filter((_, i) => i !== idx);
            if (next.length === 0) next.push({ rawName: '', empId: '', empName: '', count: '', matched: false });
            return next;
        });
    };

    // ── 儲存到 Firestore ─────────────────────────────────────────────
    const handleSave = async () => {
        const validRows = rows.filter(r => r.matched && Number(r.count) > 0);
        if (validRows.length === 0) {
            alert('沒有可儲存的有效資料（需要有對應員工且派單數 > 0）。');
            return;
        }

        setStatus('saving');
        try {
            const now = new Date().toISOString();
            const dispatches: Dispatch[] = validRows.map(r => ({
                id: `${endDate}_${r.empId}`,
                date: endDate,
                empId: r.empId,
                empName: r.empName,
                totalDispatches: Number(r.count),
                updatedAt: now,
            }));

            await saveDispatchesBatch(dispatches);
            setSaveMsg(`✅ 已儲存 ${dispatches.length} 筆派單紀錄（儲存於 ${endDate}）`);
            setStatus('done');
        } catch (err) {
            console.error('Save dispatch error:', err);
            alert('儲存失敗，請確認網路連線。');
            setStatus('idle');
        }
    };

    const validCount = rows.filter(r => r.matched && Number(r.count) > 0).length;
    const unknownRows = rows.filter(r => r.rawName.trim() && !r.matched);

    return (
        <div className="space-y-4">

            {/* 日期選擇 */}
            <div className="flex flex-col gap-2 w-full">
                <label className="text-[12px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap shrink-0">
                    📅 區間
                </label>
                <div className="flex items-center gap-1 sm:gap-2 w-full">
                    <input
                        type="date"
                        value={startDate}
                        onChange={e => { setStartDate(e.target.value); setSaveMsg(''); setStatus('idle'); }}
                        className="flex-1 min-w-[110px] sm:min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    <span className="text-slate-400 font-bold shrink-0">~</span>
                    <input
                        type="date"
                        value={endDate}
                        onChange={e => { setEndDate(e.target.value); setSaveMsg(''); setStatus('idle'); }}
                        className="flex-1 min-w-[110px] sm:min-w-0 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-blue-50"
                    />
                </div>
                {status === 'loading' && (
                    <span className="text-[10px] text-slate-400 font-bold animate-pulse shrink-0">載入現有紀錄...</span>
                )}
            </div>

            {/* 批次貼上區 */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-inner">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2 block flex items-center justify-between">
                    <span>📋 快速貼上 (從 Excel 等格式複製)</span>
                    <span className="text-[10px] text-slate-400 font-normal normal-case">支援格式：名字 [Tab/空格] 數字</span>
                </label>
                <div className="flex flex-col md:flex-row gap-3">
                    <textarea
                        value={batchInput}
                        onChange={e => setBatchInput(e.target.value)}
                        placeholder="請貼上「人員名稱 派單數」，例如：&#13;&#10;馬秋香 3&#13;&#10;王珍珠 4"
                        className="flex-1 border border-slate-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 min-h-[80px]"
                    />
                    <button
                        onClick={handleBatchProcess}
                        className="bg-slate-800 text-white font-black px-6 py-2 rounded-lg hover:bg-slate-700 active:scale-95 transition-all shadow shrink-0 whitespace-nowrap self-end md:self-stretch flex items-center justify-center"
                    >
                        解析帶入 ↓
                    </button>
                </div>
            </div>

            {/* 輸入表格 */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-[12px] border-collapse">
                    <thead className="bg-slate-900 text-white">
                        <tr>
                            <th className="px-4 py-2.5 text-left font-black text-[10px] w-8">#</th>
                            <th className="px-4 py-2.5 text-left font-black text-[10px]">行銷人員名稱</th>
                            <th className="px-4 py-2.5 text-left font-black text-[10px]">→ 對應員工</th>
                            <th className="px-4 py-2.5 text-center font-black text-[10px] w-28">派單數</th>
                            <th className="w-10"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {rows.map((row, i) => {
                            const hasName = row.rawName.trim().length > 0;
                            const isUnknown = hasName && !row.matched;
                            return (
                                <tr key={i} className={isUnknown ? 'bg-amber-50' : row.matched ? 'bg-emerald-50/30' : 'bg-white'}>
                                    <td className="px-4 py-2 text-slate-400 font-mono text-[10px]">{i + 1}</td>
                                    {/* 名字輸入 + autocomplete */}
                                    <td className="px-3 py-1">
                                        <input
                                            type="text"
                                            value={row.rawName}
                                            list={`emp-list-${i}`}
                                            placeholder="輸入名字..."
                                            onChange={e => updateRow(i, { rawName: e.target.value })}
                                            className="w-full bg-transparent border border-transparent focus:border-blue-300 rounded px-2 py-1 outline-none font-bold text-slate-800 focus:bg-white transition-all"
                                        />
                                        {/* datalist 下拉選單（從員工 profiles 取） */}
                                        <datalist id={`emp-list-${i}`}>
                                            {profiles.map(p => (
                                                <option key={p.id} value={p.name} />
                                            ))}
                                        </datalist>
                                    </td>
                                    {/* 對應結果 */}
                                    <td className="px-4 py-2">
                                        {!hasName ? (
                                            <span className="text-slate-300 text-[10px]">—</span>
                                        ) : row.matched ? (
                                            <span className="text-emerald-600 font-black text-[11px]">✅ {row.empName}</span>
                                        ) : (
                                            <span className="text-amber-500 font-bold text-[11px]">❓ 找不到</span>
                                        )}
                                    </td>
                                    {/* 派單數 */}
                                    <td className="px-3 py-1">
                                        <input
                                            type="number"
                                            min={0}
                                            value={row.count}
                                            placeholder="0"
                                            onChange={e => updateRow(i, { count: e.target.value })}
                                            className="w-full text-center bg-transparent border border-transparent focus:border-blue-300 rounded px-2 py-1 outline-none font-black text-blue-600 focus:bg-white transition-all"
                                        />
                                    </td>
                                    {/* 刪除 */}
                                    <td className="px-2 py-1 text-center">
                                        {rows.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => removeRow(i)}
                                                className="text-slate-300 hover:text-red-400 transition-colors font-bold text-base leading-none"
                                            >
                                                ×
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* 未對應警告 */}
            {unknownRows.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[11px] text-amber-700 font-bold">
                    ⚠️ 找不到員工對應：{unknownRows.map(r => r.rawName).join('、')}
                    <span className="font-normal ml-1">— 這些列不會被儲存，請確認名字是否正確。</span>
                </div>
            )}

            {/* 成功訊息 */}
            {saveMsg && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-sm font-bold text-emerald-700">
                    {saveMsg}
                </div>
            )}

            {/* 儲存按鈕 */}
            <button
                type="button"
                onClick={handleSave}
                disabled={status === 'saving' || validCount === 0}
                className="w-full py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
                {status === 'saving' ? (
                    <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /><span>儲存中...</span></>
                ) : (
                    <span>💾 儲存 {validCount} 筆派單紀錄</span>
                )}
            </button>

        </div>
    );
};

export default DispatchInput;
