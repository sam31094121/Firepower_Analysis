import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { HistoryRecord, EmployeeData } from '../types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, ScatterChart, Scatter, ZAxis, Cell,
    LineChart, Line, Legend
} from 'recharts';

interface Props {
    history: HistoryRecord[];
    currentEmployees: EmployeeData[];
}

// ─── Helper: 取得某筆 record 的當日總業績 ───
const getRecordRevenue = (r: HistoryRecord): number =>
    r.rawData && r.rawData.length > 0
        ? r.rawData.reduce((s: number, e: any) => s + (e.todayNetRevenue || 0), 0)
        : (r.totalRevenue || 0);

const getRecordLeads = (r: HistoryRecord): number =>
    r.rawData && r.rawData.length > 0
        ? r.rawData.reduce((s: number, e: any) => s + (e.todayLeads || 0), 0)
        : 0;

const getRecordSales = (r: HistoryRecord): number =>
    r.rawData && r.rawData.length > 0
        ? r.rawData.reduce((s: number, e: any) => s + (e.todaySales || 0), 0)
        : 0;

// ─── Helper: 取得 YYYY-MM 格式的月份 ───
const toMonthKey = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

const OperationalDashboard: React.FC<Props> = ({ currentEmployees, history }) => {
    const today = useMemo(() => new Date(), []);
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const thisMonthKey = toMonthKey(today);
    const lastMonthKey = toMonthKey(new Date(today.getFullYear(), today.getMonth() - 1, 1));

    // ─── State ───
    const [sortConfig, setSortConfig] = useState<{ key: keyof EmployeeData; direction: 'asc' | 'desc' } | null>(
        { key: 'todayNetRevenue', direction: 'desc' }
    );
    // 雙月選擇器
    const [monthA, setMonthA] = useState(lastMonthKey);     // 左月 (預設上月)
    const [monthB, setMonthB] = useState(thisMonthKey);     // 右月 (預設本月)
    // 目標設定
    const targetKey = `monthlyTarget_${thisMonthKey}`;
    const [monthlyTarget, setMonthlyTarget] = useState<number | null>(() => {
        const stored = localStorage.getItem(targetKey);
        return stored ? Number(stored) : null;
    });
    const [showTargetModal, setShowTargetModal] = useState(false);
    const [targetInput, setTargetInput] = useState('');

    // ─── 可用月份清單 (給 select) ───
    const availableMonths = useMemo(() => {
        const months = new Set<string>();
        history.forEach(r => {
            if (r.archiveDate) months.add(r.archiveDate.slice(0, 7));
        });
        months.add(thisMonthKey);
        return Array.from(months).sort().reverse(); // 最新在前
    }, [history, thisMonthKey]);

    // ─── 本月歷史紀錄 ───
    const thisMonthHistory = useMemo(() =>
        history
            .filter(r => r.archiveDate?.startsWith(thisMonthKey))
            .sort((a, b) => (a.archiveDate || '').localeCompare(b.archiveDate || '')),
        [history, thisMonthKey]);

    // ─── 核心 KPI：純歷史 + dayOfMonth + 線性比例 ───
    const kpis = useMemo(() => {
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

        // 純歷史本月累計
        const currentMonthTotal = thisMonthHistory.reduce((s, r) => s + getRecordRevenue(r), 0);
        // 預估：線性比例
        const projectedRevenue = dayOfMonth > 0 ? Math.round(currentMonthTotal / dayOfMonth * daysInMonth) : 0;
        // Gap：若有設定目標則用目標，否則用預估
        const targetForGap = monthlyTarget ?? projectedRevenue;
        // gap > 0 = 還差這麼多才到目標；gap <= 0 = 已超越目標
        const gap = targetForGap - currentMonthTotal;
        const progress = targetForGap > 0 ? Math.min((currentMonthTotal / targetForGap) * 100, 100) : 0;

        // 滾動今日達標標準：剩餘金額 / 剩餘天數
        const remainingDays = Math.max(daysInMonth - dayOfMonth, 0);
        const dailyRequired = remainingDays > 0 ? Math.round(Math.max(gap, 0) / remainingDays) : 0;

        // 最新一筆 history 的當日業績（用來判斷今日是否達到滾動標準）
        const latestRec = thisMonthHistory[thisMonthHistory.length - 1];
        const todayRevenue = latestRec ? getRecordRevenue(latestRec) : 0;
        const latestLeads = latestRec ? getRecordLeads(latestRec) : 0;
        const latestSales = latestRec ? getRecordSales(latestRec) : 0;
        const latestRevenue = latestRec ? getRecordRevenue(latestRec) : 0;
        const avgConversionRate = latestLeads > 0 ? (latestSales / latestLeads) * 100 : 0;
        const avgOrderValue = latestSales > 0 ? latestRevenue / latestSales : 0;

        return {
            currentMonthTotal, projectedRevenue, gap, progress,
            avgConversionRate, avgOrderValue, dayOfMonth, daysInMonth,
            targetForGap, remainingDays, dailyRequired, todayRevenue,
        };
    }, [thisMonthHistory, today, monthlyTarget]);

    // ─── 推薦目標額（上月 × 1.1）───
    const recommendedTarget = useMemo(() => {
        const lastMonthTotal = history
            .filter(r => r.archiveDate?.startsWith(lastMonthKey))
            .reduce((s, r) => s + getRecordRevenue(r), 0);
        // 若上月有資料：× 1.1；否則用日均推算 × 1.1
        if (lastMonthTotal > 0) return Math.round(lastMonthTotal * 1.1);
        return Math.round(kpis.projectedRevenue * 1.1);
    }, [history, lastMonthKey, kpis.projectedRevenue]);

    const saveTarget = useCallback(() => {
        const val = Number(targetInput.replace(/,/g, ''));
        if (!isNaN(val) && val > 0) {
            setMonthlyTarget(val);
            localStorage.setItem(targetKey, String(val));
        }
        setShowTargetModal(false);
    }, [targetInput, targetKey]);

    // ─── 每日業績波動 (Bar Chart) ───
    const dailyRevenueData = useMemo(() =>
        thisMonthHistory.map(r => ({
            date: (r.archiveDate || '').split('-')[2],
            revenue: getRecordRevenue(r),
            isToday: r.archiveDate === todayStr,
        })),
        [thisMonthHistory, todayStr]);

    // ─── 雙月對比 (Bar Chart, 每日並排，顯示兩月各天業績) ───
    const dualMonthData = useMemo(() => {
        const mapA = new Map<number, number>();
        const mapB = new Map<number, number>();

        history.filter(r => r.archiveDate?.startsWith(monthA)).forEach(r => {
            mapA.set(new Date(r.archiveDate!).getDate(), getRecordRevenue(r));
        });
        history.filter(r => r.archiveDate?.startsWith(monthB)).forEach(r => {
            mapB.set(new Date(r.archiveDate!).getDate(), getRecordRevenue(r));
        });

        // 合併天數
        const days = new Set([...mapA.keys(), ...mapB.keys()]);
        const result = Array.from(days).sort((a, b) => a - b).map(d => ({
            day: d,
            [monthA]: mapA.get(d) ?? null,
            [monthB]: mapB.get(d) ?? null,
        }));

        const totalA = Array.from(mapA.values()).reduce((s, v) => s + v, 0);
        const totalB = Array.from(mapB.values()).reduce((s, v) => s + v, 0);

        return { data: result, totalA, totalB };
    }, [history, monthA, monthB]);

    // ─── 每日成交率折線 ───
    const dailyConversionData = useMemo(() =>
        thisMonthHistory.map(r => ({
            date: (r.archiveDate || '').split('-')[2],
            rate: (() => { const l = getRecordLeads(r); return l > 0 ? Math.min(Math.round(getRecordSales(r) / l * 1000) / 10, 100) : 0; })(),
        })),
        [thisMonthHistory]);

    // ─── 每日 AOV 折線 ───
    const dailyAOVData = useMemo(() =>
        thisMonthHistory.map(r => ({
            date: (r.archiveDate || '').split('-')[2],
            aov: (() => { const s = getRecordSales(r); return s > 0 ? Math.round(getRecordRevenue(r) / s) : 0; })(),
        })),
        [thisMonthHistory]);

    // ─── 排行榜 & 散點 ───
    const conversionRankData = useMemo(() =>
        [...currentEmployees]
            .sort((a, b) => (b.todayLeads > 0 ? b.todaySales / b.todayLeads : 0) - (a.todayLeads > 0 ? a.todaySales / a.todayLeads : 0))
            .slice(0, 10)
            .map(e => ({ name: e.name, rate: e.todayLeads > 0 ? Math.min((e.todaySales / e.todayLeads) * 100, 100) : 0 })),
        [currentEmployees]);

    const scatterData = useMemo(() =>
        currentEmployees.map(e => ({
            x: e.todayLeads, y: e.todaySales, z: e.todayNetRevenue,
            name: e.name, rate: e.todayLeads > 0 ? Math.min((e.todaySales / e.todayLeads) * 100, 100) : 0,
        })),
        [currentEmployees]);

    const sortedEmployees = useMemo(() => {
        const items = [...currentEmployees];
        if (sortConfig) items.sort((a: any, b: any) =>
            (a[sortConfig.key] < b[sortConfig.key] ? -1 : 1) * (sortConfig.direction === 'asc' ? 1 : -1));
        return items;
    }, [currentEmployees, sortConfig]);

    const requestSort = (key: keyof EmployeeData) =>
        setSortConfig({ key, direction: sortConfig?.key === key && sortConfig.direction === 'desc' ? 'asc' : 'desc' });

    // ─── 顏色工具 ───
    const COLORS = { A: '#94a3b8', B: '#3b82f6' };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10 space-y-6">

            {/* ── Row 1: KPI Cards (2 cards + Target) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                {/* Card 1: 本月累計 & 預估 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">本月營收預估</div>
                    <div className="text-2xl font-black text-slate-800">${kpis.projectedRevenue.toLocaleString()}</div>
                    <div className="mt-2 text-xs flex justify-between text-slate-400">
                        <span>累計: ${kpis.currentMonthTotal.toLocaleString()}</span>
                        <span>{kpis.dayOfMonth}天 / {kpis.daysInMonth}天</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1 overflow-hidden">
                        <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${kpis.progress}%` }} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">{kpis.progress.toFixed(1)}% 達標</div>
                </div>

                {/* Card 2: 目標落差 (Gap) */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">
                        目標落差 (Gap)
                        {monthlyTarget && (
                            <span className="ml-2 text-blue-400 font-normal">目標 ${monthlyTarget.toLocaleString()}</span>
                        )}
                    </div>
                    {monthlyTarget ? (
                        kpis.gap <= 0 ? (
                            // 已超越目標
                            <>
                                <div className="text-2xl font-black text-emerald-500">
                                    +${Math.abs(kpis.gap).toLocaleString()}
                                </div>
                                <div className="mt-2 text-xs text-emerald-500 font-bold">🎉 已超越月目標！</div>
                            </>
                        ) : (
                            // 尚未達標 → 顯示距離 + 滾動日均
                            <>
                                <div className="text-xl font-black text-rose-500">
                                    距離目標 ${kpis.gap.toLocaleString()}
                                </div>
                                <div className="border-t border-slate-100 mt-2 pt-2 space-y-1">
                                    {/* 今日滾動要求 */}
                                    <div className="text-xs flex justify-between">
                                        <span className="text-slate-400">今日需達</span>
                                        <span className={`font-black ${kpis.todayRevenue >= kpis.dailyRequired
                                            ? 'text-emerald-600' : 'text-rose-500'
                                            }`}>
                                            ${kpis.dailyRequired.toLocaleString()}
                                        </span>
                                    </div>
                                    {/* 今日實際 vs 標準 */}
                                    <div className="text-xs flex justify-between">
                                        <span className="text-slate-400">今日已達</span>
                                        <span className="font-bold text-slate-600">
                                            ${kpis.todayRevenue.toLocaleString()}
                                        </span>
                                    </div>
                                    {/* 今日達標狀態 */}
                                    <div className={`text-[11px] font-bold mt-1 ${kpis.todayRevenue >= kpis.dailyRequired
                                        ? 'text-emerald-500' : 'text-rose-400'
                                        }`}>
                                        {kpis.todayRevenue >= kpis.dailyRequired
                                            ? `✅ 今日達標 (剩 ${kpis.remainingDays} 天)`
                                            : `⚠️ 今日未達標，壓力移至剩 ${kpis.remainingDays} 天`
                                        }
                                    </div>
                                </div>
                            </>
                        )
                    ) : (
                        <div className="text-slate-400 text-sm mt-2">尚未設定目標</div>
                    )}
                </div>

                {/* Card 3: 設定目標 */}
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
                    <div className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">本月業績目標</div>
                    <div className="text-xl font-black text-slate-800 mb-2">
                        {monthlyTarget ? `$${monthlyTarget.toLocaleString()}` : '—'}
                    </div>
                    <button
                        onClick={() => { setTargetInput(monthlyTarget ? String(monthlyTarget) : ''); setShowTargetModal(true); }}
                        className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-sm transition-colors"
                    >
                        ✏️ {monthlyTarget ? '修改目標' : '設定目標'}
                    </button>
                </div>
            </div>

            {/* ── 目標設定 Modal ── */}
            {showTargetModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
                    <div className="bg-white rounded-3xl p-8 shadow-2xl w-full max-w-sm space-y-4">
                        <h3 className="font-black text-slate-800 text-lg">設定 {thisMonthKey} 業績目標</h3>

                        {/* 推薦目標 */}
                        <div className="bg-blue-50 rounded-xl p-4">
                            <div className="text-xs text-blue-500 font-bold mb-1">🤖 推薦目標 (上月 × 110%)</div>
                            <div className="text-2xl font-black text-blue-700">${recommendedTarget.toLocaleString()}</div>
                            <button
                                onClick={() => setTargetInput(String(recommendedTarget))}
                                className="mt-2 text-xs text-blue-600 underline"
                            >使用推薦目標</button>
                        </div>

                        {/* 自訂輸入 */}
                        <div>
                            <label className="text-xs text-slate-500 font-bold block mb-1">自訂目標金額</label>
                            <input
                                type="number"
                                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-slate-800 font-black text-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                                placeholder="例如 5000000"
                                value={targetInput}
                                onChange={e => setTargetInput(e.target.value)}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button onClick={() => setShowTargetModal(false)} className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-600 font-bold hover:bg-slate-50 transition-colors">取消</button>
                            <button onClick={saveTarget} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black hover:bg-blue-700 transition-colors">確認儲存</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Row 2: 雙月每日業績對比 (Bar Chart) ── */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                {/* Header + 月選擇器 */}
                <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h3 className="text-slate-800 text-lg font-black flex items-center gap-2">
                        <span>📅</span> 雙月每日業績對比
                    </h3>
                    <div className="flex items-center gap-3 text-sm">
                        {/* 月 A */}
                        <div className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-full bg-slate-400" />
                            <select
                                value={monthA}
                                onChange={e => setMonthA(e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-bold focus:outline-none"
                            >
                                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <span className="text-slate-400 font-bold">${dualMonthData.totalA.toLocaleString()}</span>
                        </div>
                        <span className="text-slate-400">vs</span>
                        {/* 月 B */}
                        <div className="flex items-center gap-1">
                            <span className="inline-block w-3 h-3 rounded-full bg-blue-500" />
                            <select
                                value={monthB}
                                onChange={e => setMonthB(e.target.value)}
                                className="border border-slate-200 rounded-lg px-2 py-1 text-slate-700 font-bold focus:outline-none"
                            >
                                {availableMonths.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>
                            <span className="text-blue-500 font-bold">${dualMonthData.totalB.toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dualMonthData.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }} barGap={2}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 10000)}萬`} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(v: number, name: string) => v !== null ? [`$${v.toLocaleString()}`, name] : ['—', name]}
                            />
                            <Legend />
                            <Bar dataKey={monthA} name={monthA} fill={COLORS.A} radius={[3, 3, 0, 0]} barSize={8} />
                            <Bar dataKey={monthB} name={monthB} fill={COLORS.B} radius={[3, 3, 0, 0]} barSize={8} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Row 3: 本月每日業績波動 ── */}
            <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                <h3 className="text-slate-800 text-lg font-black mb-4 flex items-center gap-2">
                    <span>📊</span> 本月每日業績波動
                </h3>
                <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dailyRevenueData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 10000)}萬`} />
                            <Tooltip
                                cursor={{ fill: '#f8fafc' }}
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                formatter={(v: number) => [`$${v.toLocaleString()}`, '當日業績']}
                            />
                            <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                                {dailyRevenueData.map((entry, i) => (
                                    <Cell key={`c-${i}`} fill={entry.isToday ? '#f59e0b' : '#3b82f6'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* ── Row 4: 每日成交率 & AOV 折線圖 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 每日成交率 */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <span>🎯</span> 每日成交率趨勢
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyConversionData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} unit="%" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(v: number) => [`${v}%`, '成交率']}
                                />
                                <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2.5} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 每日 AOV */}
                <div className="bg-white p-6 rounded-3xl shadow-lg border border-slate-100">
                    <h3 className="font-black text-slate-800 mb-4 flex items-center gap-2">
                        <span>💰</span> 每日平均客單價趨勢
                    </h3>
                    <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={dailyAOVData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11 }} tickFormatter={v => `$${Math.round(v / 1000)}k`} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                                    formatter={(v: number) => [`$${v.toLocaleString()}`, '客單價']}
                                />
                                <Line type="monotone" dataKey="aov" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 3, fill: '#8b5cf6' }} activeDot={{ r: 5 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Row 5: 轉化效能分佈 & 頂尖排行 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100">
                    <h3 className="font-black text-slate-800 mb-4">🎯 轉化效能分佈</h3>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                <XAxis type="number" dataKey="x" name="派單數" unit="單" tick={{ fill: '#94a3b8' }} />
                                <YAxis type="number" dataKey="y" name="成交數" unit="單" tick={{ fill: '#94a3b8' }} />
                                <ZAxis type="number" dataKey="z" range={[50, 600]} name="業績" />
                                <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                                    if (active && payload?.length) {
                                        const d = payload[0].payload;
                                        return (
                                            <div className="bg-white p-3 rounded-lg shadow-xl border border-slate-100 text-xs">
                                                <p className="font-bold text-slate-800 mb-1">{d.name}</p>
                                                <p>成交率: <span className="font-bold text-emerald-600">{d.rate.toFixed(1)}%</span></p>
                                                <p>業績: <span className="font-bold text-blue-600">${d.z.toLocaleString()}</span></p>
                                            </div>
                                        );
                                    }
                                    return null;
                                }} />
                                <Scatter data={scatterData} fill="#3b82f6">
                                    {scatterData.map((entry, i) => (
                                        <Cell key={`c-${i}`} fill={entry.rate > kpis.avgConversionRate ? '#10b981' : entry.rate < 20 ? '#ef4444' : '#3b82f6'} />
                                    ))}
                                </Scatter>
                            </ScatterChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-lg border border-slate-100">
                    <h3 className="font-black text-slate-800 mb-4">🏆 頂尖戰力排行</h3>
                    <div className="h-[260px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={conversionRankData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal vertical={false} stroke="#f1f5f9" />
                                <XAxis type="number" unit="%" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12, fontWeight: 'bold', fill: '#475569' }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(v: number) => [`${v.toFixed(1)}%`, '成交率']} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="rate" fill="#10b981" radius={[0, 4, 4, 0]} barSize={16} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Row 6: 詳細績效表 ── */}
            <div className="bg-white rounded-3xl shadow-lg border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <h3 className="text-slate-800 text-lg font-black">詳細績效數據表</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-slate-500 uppercase bg-slate-50 font-black tracking-wider">
                            <tr>
                                <th onClick={() => requestSort('name')} className="px-6 py-4 cursor-pointer">姓名</th>
                                <th onClick={() => requestSort('category')} className="px-6 py-4 cursor-pointer">組別</th>
                                <th onClick={() => requestSort('todayLeads')} className="px-6 py-4 text-right cursor-pointer">派單</th>
                                <th onClick={() => requestSort('todaySales')} className="px-6 py-4 text-right cursor-pointer">成交</th>
                                <th className="px-6 py-4 text-right">成交率</th>
                                <th onClick={() => requestSort('todayNetRevenue')} className="px-6 py-4 text-right cursor-pointer">總業績</th>
                                <th onClick={() => requestSort('avgOrderValue')} className="px-6 py-4 text-right cursor-pointer">客單價</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {sortedEmployees.map(emp => {
                                const rate = emp.todayLeads > 0 ? (emp.todaySales / emp.todayLeads) * 100 : 0;
                                return (
                                    <tr key={emp.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4 font-bold text-slate-700">{emp.name}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold ${emp.category === '大單火力組' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-600'}`}>
                                                {emp.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right text-slate-600">{emp.todayLeads}</td>
                                        <td className="px-6 py-4 text-right text-slate-600">{emp.todaySales}</td>
                                        <td className="px-6 py-4 text-right font-bold text-emerald-600">{rate.toFixed(1)}%</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-800">${emp.todayNetRevenue.toLocaleString()}</td>
                                        <td className="px-6 py-4 text-right text-slate-500">${Math.round(emp.avgOrderValue).toLocaleString()}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default OperationalDashboard;
