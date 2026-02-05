import React, { useState, useEffect, useMemo } from 'react';
import { EmployeeProfile, EmployeeDailyRecord, EmployeeData } from '../types';
import {
    getEmployeeDailyRecordsDB,
    updateEmployeeProfileDB
} from '../services/dbService';
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
    employee: EmployeeProfile;
    onClose: () => void;
    onUpdate: () => void;
}

type PeriodType = 'last41days' | 'thisMonth' | 'lastMonth' | 'today';

const EmployeeProfilePage: React.FC<Props> = ({ employee, onClose, onUpdate }) => {
    const [profile, setProfile] = useState<EmployeeProfile>(employee);
    const [dailyRecords, setDailyRecords] = useState<EmployeeDailyRecord[]>([]);
    const [period, setPeriod] = useState<PeriodType>('last41days');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        loadDailyRecords();
    }, [employee.id]);

    const loadDailyRecords = async () => {
        try {
            const today = new Date();
            const startDate = new Date(today.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
            const endDate = today.toISOString().split('T')[0];
            const records = await getEmployeeDailyRecordsDB(employee.id, startDate, endDate);
            setDailyRecords(records);
        } catch (error) {
            console.error('載入員工每日紀錄失敗', error);
        }
    };

    // 根據期間篩選紀錄
    const filteredRecords = useMemo(() => {
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];

        switch (period) {
            case 'today':
                return dailyRecords.filter(r => r.date === todayStr);

            case 'last41days': {
                const startDate = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                return dailyRecords.filter(r => r.date >= startDate && r.date <= todayStr);
            }

            case 'thisMonth': {
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, '0');
                const monthStr = `${year}-${month}`;
                return dailyRecords.filter(r => r.date.startsWith(monthStr));
            }

            case 'lastMonth': {
                const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const year = lastMonth.getFullYear();
                const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
                const monthStr = `${year}-${month}`;
                return dailyRecords.filter(r => r.date.startsWith(monthStr));
            }

            default:
                return dailyRecords;
        }
    }, [dailyRecords, period]);

    // 計算統計指標
    const stats = useMemo(() => {
        if (filteredRecords.length === 0) {
            return {
                avgConvRate: 0,
                avgOrderValue: 0,
                totalLeads: 0,
                totalRevenue: 0,
                totalSales: 0
            };
        }

        const total = filteredRecords.reduce((acc, r) => {
            const convRate = parseFloat(r.data.todayConvRate.replace('%', ''));
            return {
                convRate: acc.convRate + convRate,
                orderValue: acc.orderValue + r.data.avgOrderValue,
                leads: acc.leads + r.data.todayLeads,
                revenue: acc.revenue + r.data.todayNetRevenue,
                sales: acc.sales + r.data.todaySales
            };
        }, { convRate: 0, orderValue: 0, leads: 0, revenue: 0, sales: 0 });

        return {
            avgConvRate: total.convRate / filteredRecords.length,
            avgOrderValue: total.orderValue / filteredRecords.length,
            totalLeads: total.leads,
            totalRevenue: total.revenue,
            totalSales: total.sales
        };
    }, [filteredRecords]);

    // 圖表數據
    const chartData = useMemo(() => {
        return filteredRecords.map(r => ({
            date: r.date.substring(5), // MM-DD
            convRate: parseFloat(r.data.todayConvRate.replace('%', '')),
            revenue: r.data.todayNetRevenue,
            aov: r.data.avgOrderValue
        })).reverse();
    }, [filteredRecords]);

    const handleSave = async () => {
        try {
            const updatedProfile = {
                ...profile,
                updatedAt: new Date().toISOString()
            };
            await updateEmployeeProfileDB(updatedProfile);
            setProfile(updatedProfile);
            setIsEditing(false);
            onUpdate();
            alert('儲存成功！');
        } catch (error) {
            console.error('儲存失敗', error);
            alert('儲存失敗');
        }
    };

    const periodLabels: Record<PeriodType, string> = {
        last41days: '最近 41 天',
        thisMonth: '本月',
        lastMonth: '上月',
        today: '當日'
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* 標題列 */}
                <div className="p-6 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
                    <div>
                        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <span className="text-3xl">👤</span>
                            {profile.name}
                            <span className={`text-sm font-bold px-3 py-1 rounded-full ${profile.status === 'active'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-rose-100 text-rose-700'
                                }`}>
                                {profile.status === 'active' ? '在職' : '離職'}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500 mt-1">加入日期：{profile.joinDate}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* 內容區 */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 期間選擇器 */}
                    <div className="flex gap-2">
                        {(['last41days', 'thisMonth', 'lastMonth', 'today'] as PeriodType[]).map((p) => (
                            <button
                                key={p}
                                onClick={() => setPeriod(p)}
                                className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${period === p
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {periodLabels[p]}
                            </button>
                        ))}
                    </div>

                    {/* 關鍵指標卡片 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200">
                            <div className="text-xs text-blue-600 font-black uppercase mb-1">平均成交率</div>
                            <div className="text-2xl font-black text-blue-700">{stats.avgConvRate.toFixed(1)}%</div>
                        </div>
                        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 border border-green-200">
                            <div className="text-xs text-green-600 font-black uppercase mb-1">平均客單價</div>
                            <div className="text-2xl font-black text-green-700">${Math.round(stats.avgOrderValue).toLocaleString()}</div>
                        </div>
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200">
                            <div className="text-xs text-purple-600 font-black uppercase mb-1">總派單數</div>
                            <div className="text-2xl font-black text-purple-700">{stats.totalLeads}</div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 border border-orange-200">
                            <div className="text-xs text-orange-600 font-black uppercase mb-1">總業績</div>
                            <div className="text-2xl font-black text-orange-700">${stats.totalRevenue.toLocaleString()}</div>
                        </div>
                    </div>

                    {/* 趨勢圖表 */}
                    {chartData.length > 0 && (
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h3 className="text-lg font-black text-slate-800 mb-4">能力趨勢圖</h3>
                            <div className="h-[300px]" style={{ minHeight: 300 }}>
                                <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                                    <ComposedChart data={chartData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tick={{ fontSize: 11, fontWeight: 'bold' }}
                                            angle={-15}
                                            textAnchor="end"
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            tick={{ fontSize: 11, fontWeight: 'bold' }}
                                            label={{ value: '業績', angle: -90, position: 'insideLeft' }}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            tick={{ fontSize: 11, fontWeight: 'bold' }}
                                            label={{ value: '成交率 %', angle: 90, position: 'insideRight' }}
                                        />
                                        <Tooltip />
                                        <Bar yAxisId="left" dataKey="revenue" fill="#3b82f6" name="業績" />
                                        <Line yAxisId="right" type="monotone" dataKey="convRate" stroke="#f43f5e" strokeWidth={2} name="成交率" />
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    )}

                    {/* 每日明細表格 */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 bg-slate-50">
                            <h3 className="text-lg font-black text-slate-800">每日明細</h3>
                        </div>
                        <div className="overflow-x-auto max-h-[400px]">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-100 sticky top-0">
                                    <tr>
                                        <th className="px-4 py-2 text-left font-black text-slate-700">日期</th>
                                        <th className="px-4 py-2 text-right font-black text-slate-700">派單</th>
                                        <th className="px-4 py-2 text-right font-black text-slate-700">派成</th>
                                        <th className="px-4 py-2 text-right font-black text-slate-700">成交率</th>
                                        <th className="px-4 py-2 text-right font-black text-slate-700">客單價</th>
                                        <th className="px-4 py-2 text-right font-black text-slate-700">總業績</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredRecords.map((record) => (
                                        <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50">
                                            <td className="px-4 py-2 font-bold text-slate-600">{record.date}</td>
                                            <td className="px-4 py-2 text-right">{record.data.todayLeads}</td>
                                            <td className="px-4 py-2 text-right text-blue-600 font-bold">{record.data.todaySales}</td>
                                            <td className="px-4 py-2 text-right text-green-600 font-bold">{record.data.todayConvRate}</td>
                                            <td className="px-4 py-2 text-right">${record.data.avgOrderValue.toLocaleString()}</td>
                                            <td className="px-4 py-2 text-right font-black">${record.data.todayNetRevenue.toLocaleString()}</td>
                                        </tr>
                                    ))}
                                    {filteredRecords.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                                                該期間沒有數據
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 管理區 */}
                    <div className="bg-slate-50 rounded-xl border border-slate-200 p-6">
                        <h3 className="text-lg font-black text-slate-800 mb-4">管理設定</h3>

                        <div className="space-y-4">
                            {/* 狀態管理 */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">員工狀態</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setProfile({ ...profile, status: 'active', leaveDate: undefined })}
                                        className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${profile.status === 'active'
                                                ? 'bg-green-600 text-white'
                                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        在職
                                    </button>
                                    <button
                                        onClick={() => {
                                            const leaveDate = prompt('請輸入離職日期 (YYYY-MM-DD)', new Date().toISOString().split('T')[0]);
                                            if (leaveDate) {
                                                setProfile({ ...profile, status: 'inactive', leaveDate });
                                            }
                                        }}
                                        className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${profile.status === 'inactive'
                                                ? 'bg-rose-600 text-white'
                                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        離職
                                    </button>
                                </div>
                            </div>

                            {/* 帳號狀態 */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">帳號狀態</label>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setProfile({ ...profile, accountStatus: 'enabled' })}
                                        className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${profile.accountStatus === 'enabled'
                                                ? 'bg-blue-600 text-white'
                                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        啟用
                                    </button>
                                    <button
                                        onClick={() => setProfile({ ...profile, accountStatus: 'disabled' })}
                                        className={`flex-1 py-2 px-4 rounded-lg font-bold transition-all ${profile.accountStatus === 'disabled'
                                                ? 'bg-amber-600 text-white'
                                                : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100'
                                            }`}
                                    >
                                        停用
                                    </button>
                                </div>
                            </div>

                            {/* 備註 */}
                            <div>
                                <label className="text-sm font-bold text-slate-700 mb-2 block">備註</label>
                                <textarea
                                    value={profile.notes}
                                    onChange={(e) => setProfile({ ...profile, notes: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    rows={3}
                                    placeholder="輸入備註..."
                                />
                            </div>

                            {/* 儲存按鈕 */}
                            <button
                                onClick={handleSave}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-black transition-all"
                            >
                                💾 儲存變更
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EmployeeProfilePage;
