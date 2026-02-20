import React, { useMemo } from 'react';
import { HistoryRecord, EmployeeCategory, EmployeeData } from '../types';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';

interface Props {
    history: HistoryRecord[];
    currentEmployees: EmployeeData[];
    compact?: boolean;
}

const ExecutiveDashboard: React.FC<Props> = ({ history, currentEmployees, compact = false }) => {

    // 1. 營收趨勢數據 (Revenue Trend)
    // 修正邏輯：強制使用 rawData 的總和，避免混入 41 天分析數據
    const revenueTrendData = useMemo(() => {
        return history
            .filter(h => h.archiveDate)
            .sort((a, b) => (a.archiveDate!).localeCompare(b.archiveDate!))
            .slice(-10)
            .map(h => {
                // 如果有 rawData，重新計算當日總營收；否則退回到 totalRevenue (但這可能有險)
                const dailyRevenue = h.rawData && h.rawData.length > 0
                    ? h.rawData.reduce((sum, emp) => sum + emp.todayNetRevenue, 0)
                    : h.totalRevenue;

                return {
                    date: h.archiveDate,
                    revenue: dailyRevenue,
                    name: h.title
                };
            })
            .filter(d => d.revenue > 0);
    }, [history]);

    // 2. 人員戰力分佈 (Category Distribution)
    const categoryDistribution = useMemo(() => {
        const distribution = {
            [EmployeeCategory.FIREPOWER]: 0,
            [EmployeeCategory.STEADY]: 0,
            [EmployeeCategory.NEEDS_IMPROVEMENT]: 0,
            [EmployeeCategory.RISK]: 0,
            [EmployeeCategory.POTENTIAL]: 0
        };

        currentEmployees.forEach(emp => {
            if (emp.category && distribution[emp.category] !== undefined) {
                distribution[emp.category]++;
            }
        });

        return [
            { name: '大單火力組', value: distribution[EmployeeCategory.FIREPOWER], color: '#f97316' }, // Orange 500
            { name: '穩定人選', value: distribution[EmployeeCategory.STEADY], color: '#64748b' },   // Slate 500
            { name: '待加強', value: distribution[EmployeeCategory.NEEDS_IMPROVEMENT], color: '#f59e0b' }, // Amber 500
            { name: '風險警告', value: distribution[EmployeeCategory.RISK], color: '#f43f5e' },     // Rose 500
            { name: '潛力成長', value: distribution[EmployeeCategory.POTENTIAL], color: '#3b82f6' }   // Blue 500
        ].filter(d => d.value > 0);
    }, [currentEmployees]);

    // 3. 本月營收預測 (Monthly Forecast) — 純歷史 + dayOfMonth 線性推算
    const forecastData = useMemo(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

        // 純歷史累計（移除 todayRealtimeRevenue 避免重複計算）
        const currentMonthTotal = history.reduce((sum, record) => {
            if (!record.archiveDate) return sum;
            const d = new Date(record.archiveDate);
            if (d.getFullYear() === currentYear && d.getMonth() === currentMonth) {
                const dailyTotal = record.rawData && record.rawData.length > 0
                    ? record.rawData.reduce((s, e) => s + e.todayNetRevenue, 0)
                    : record.totalRevenue;
                return sum + dailyTotal;
            }
            return sum;
        }, 0);

        // 線性比例：累計 / 已過天數 × 全月天數
        const projected = dayOfMonth > 0 ? Math.round(currentMonthTotal / dayOfMonth * daysInMonth) : 0;

        return {
            current: currentMonthTotal,
            projected,
            progress: projected > 0 ? Math.min(Math.round((currentMonthTotal / projected) * 100), 100) : 0
        };
    }, [history]);

    // 4. 今日需達 / 今日已達 (從 localStorage 讀目標，計算滾動每日標準)
    const dailyTarget = useMemo(() => {
        const today = new Date();
        const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const storedTarget = localStorage.getItem(`monthlyTarget_${monthKey}`);
        const target = storedTarget ? Number(storedTarget) : null;

        const currentYear = today.getFullYear();
        const currentMonth = today.getMonth();
        const dayOfMonth = today.getDate();
        const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const remainingDays = Math.max(daysInMonth - dayOfMonth, 0);

        // 最新一筆 history 當日業績
        const thisMonthRecs = history
            .filter(r => r.archiveDate?.startsWith(monthKey))
            .sort((a, b) => (a.archiveDate || '').localeCompare(b.archiveDate || ''));
        const latestRec = thisMonthRecs[thisMonthRecs.length - 1];
        const todayRevenue = latestRec
            ? (latestRec.rawData?.length > 0
                ? latestRec.rawData.reduce((s, e) => s + e.todayNetRevenue, 0)
                : latestRec.totalRevenue)
            : 0;

        if (!target) return { dailyRequired: null, todayRevenue, hasTarget: false };

        const gap = Math.max(target - forecastData.current, 0);
        const dailyRequired = remainingDays > 0 ? Math.round(gap / remainingDays) : 0;
        return { dailyRequired, todayRevenue, hasTarget: true, onTarget: todayRevenue >= dailyRequired };
    }, [history, forecastData.current]);

    // 5. 派單統計 (Dispatch Stats)
    const dispatchStats = useMemo(() => {
        const totalLeads = currentEmployees.reduce((sum, e) => sum + e.todayLeads, 0);
        const totalSales = currentEmployees.reduce((sum, e) => sum + e.todaySales, 0);
        const failedLeads = totalLeads - totalSales; // 失敗/未成交數
        return { totalLeads, failedLeads };
    }, [currentEmployees]);

    return (
        <div className={`animate-in fade-in slide-in-from-bottom-4 duration-500 ${compact ? 'space-y-3' : 'space-y-8'}`}>

            {/* 頂部 KPI 卡片 */}
            <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'md:grid-cols-3 gap-6'}`}>

                {/* 1. compact 模式：今日需達 / 今日已達；full 模式：本月預估 */}
                {compact ? (
                    // compact sidebar: 今日需達 vs 今日已達
                    <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-700 text-white p-4">
                        <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-3">
                            今日業績標準
                        </h3>
                        {dailyTarget.hasTarget ? (
                            <div className="space-y-3">
                                {/* 今日需達 */}
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-xs">今日需達</span>
                                    <span className={`text-lg font-black tabular-nums ${dailyTarget.onTarget ? 'text-emerald-400' : 'text-rose-400'
                                        }`}>
                                        ${dailyTarget.dailyRequired!.toLocaleString()}
                                    </span>
                                </div>
                                {/* 分隔線 */}
                                <div className="border-t border-slate-700" />
                                {/* 今日已達 */}
                                <div className="flex justify-between items-center">
                                    <span className="text-slate-400 text-xs">今日已達</span>
                                    <span className="text-lg font-black tabular-nums text-white">
                                        ${dailyTarget.todayRevenue.toLocaleString()}
                                    </span>
                                </div>
                                {/* 達標狀態 */}
                                <div className={`text-[10px] font-bold text-center py-1 rounded-lg ${dailyTarget.onTarget
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                    }`}>
                                    {dailyTarget.onTarget ? '✅ 今日達標' : '⚠️ 今日未達標'}
                                </div>
                            </div>
                        ) : (
                            <div className="text-slate-500 text-xs text-center py-3">尚未設定月目標</div>
                        )}
                    </div>
                ) : (
                    // full view: 本月營收預估
                    <div className="bg-slate-900 rounded-xl shadow-lg border border-slate-700 text-white relative overflow-hidden group p-6">
                        <div className="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-500/20" />
                        <div className="relative z-10">
                            <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">本月營收預估 (Month End)</h3>
                            <div className="text-4xl font-black tabular-nums tracking-tight mb-2">
                                ${forecastData.projected.toLocaleString()}
                            </div>
                            <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 mb-2">
                                <span>進度 {Math.round((forecastData.current / forecastData.projected) * 100)}%</span>
                                <span>目前累積: ${forecastData.current.toLocaleString()}</span>
                            </div>
                            <div className="w-full bg-slate-700/50 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-gradient-to-r from-blue-500 to-cyan-400 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min((forecastData.current / forecastData.projected) * 100, 100)}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. Compact 模式新增：派單數與失敗數 (雙欄) */}
                {compact && (
                    <div className="grid grid-cols-2 gap-3">
                        {/* 總派單 */}
                        <div className="bg-blue-50 rounded-xl p-3 shadow-sm border border-blue-100 flex flex-col justify-between">
                            <h3 className="text-blue-400 text-[9px] font-black uppercase tracking-widest mb-1">總派單 (Leads)</h3>
                            <div className="flex items-end gap-1">
                                <span className="text-xl font-black text-blue-600 leading-none">
                                    {dispatchStats.totalLeads}
                                </span>
                                <span className="text-[9px] font-bold text-blue-400 mb-0.5">單</span>
                            </div>
                        </div>
                        {/* 派單失敗 */}
                        <div className="bg-slate-50 rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col justify-between">
                            <h3 className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-1">未成交 (Missed)</h3>
                            <div className="flex items-end gap-1">
                                <span className="text-xl font-black text-slate-500 leading-none">
                                    {dispatchStats.failedLeads}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 mb-0.5">單</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* 3. 風險與戰力卡片 */}
                {compact ? (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col justify-between">
                            <h3 className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">風險人數</h3>
                            <div className="flex items-end gap-1">
                                <span className="text-xl font-black text-rose-500 leading-none">
                                    {categoryDistribution.find(d => d.name === '風險警告')?.value || 0}
                                </span>
                                <span className="text-[9px] font-bold text-slate-400 mb-0.5">人</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 flex flex-col justify-between">
                            <h3 className="text-slate-400 text-[9px] font-bold uppercase tracking-widest mb-1">火力佔比</h3>
                            <div className="flex items-end gap-1">
                                <span className="text-xl font-black text-orange-500 leading-none">
                                    {Math.round(((categoryDistribution.find(d => d.name === '大單火力組')?.value || 0) / Math.max(currentEmployees.length, 1)) * 100)}%
                                </span>
                            </div>
                        </div>
                    </div>
                ) : (
                    // Default Desktop View (隱藏派單數卡片，或之後再加)
                    <>
                        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative overflow-hidden">
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">人力風險指數</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-slate-800">
                                    {categoryDistribution.find(d => d.name === '風險警告')?.value || 0}
                                </span>
                                <span className="text-sm font-bold text-slate-400 mb-1.5">人</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200 relative overflow-hidden">
                            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">核心戰力佔比</h3>
                            <div className="flex items-end gap-2">
                                <span className="text-4xl font-black text-orange-500">
                                    {Math.round(((categoryDistribution.find(d => d.name === '大單火力組')?.value || 0) / Math.max(currentEmployees.length, 1)) * 100)}%
                                </span>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* 戰情圖表區 */}
            <div className={`grid grid-cols-1 ${compact ? 'gap-3' : 'lg:grid-cols-3 gap-6'}`}>

                {/* 營收歷史趨勢 */}
                <div className={`${compact ? 'col-span-1 p-3' : 'lg:col-span-2 p-6'} bg-white rounded-xl shadow-lg border border-slate-200`}>
                    <div className="mb-2">
                        <h3 className="text-slate-900 text-xs font-black tracking-tight">營收走勢</h3>
                    </div>
                    <div className={`${compact ? 'h-[100px]' : 'h-[300px]'} w-full`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={revenueTrendData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={compact ? 'transparent' : '#f1f5f9'} />
                                <XAxis
                                    dataKey="date"
                                    hide={compact}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                                />
                                <YAxis
                                    hide={compact}
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 9, fill: '#94a3b8' }}
                                />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '11px' }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="revenue"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fillOpacity={1}
                                    fill="url(#colorRevenue)"
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* 人力分佈 */}
                <div className={`${compact ? 'p-3' : 'p-6'} bg-white rounded-xl shadow-lg border border-slate-200 flex flex-col`}>
                    <div className="mb-2">
                        <h3 className="text-slate-900 text-xs font-black tracking-tight">戰力結構</h3>
                    </div>
                    <div className={`flex-1 relative ${compact ? 'min-h-[120px]' : 'min-h-[250px]'}`}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={categoryDistribution}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={compact ? 35 : 60}
                                    outerRadius={compact ? 50 : 80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {categoryDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '11px' }} />
                                {!compact && <Legend />}
                            </PieChart>
                        </ResponsiveContainer>
                        {compact && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none pb-1">
                                <span className="text-lg font-black text-slate-800">{currentEmployees.length}</span>
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ExecutiveDashboard;
