import React, { useState, useEffect } from 'react';
import { EmployeeProfile, EmployeeData } from '../types';
import { getAllEmployeeProfilesDB, getEmployeeLatestRecordDB } from '../services/dbService';

interface Props {
    onClose: () => void;
    onSelectEmployee: (employee: EmployeeProfile) => void;
}

const EmployeeDirectory: React.FC<Props> = ({ onClose, onSelectEmployee }) => {
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [dataView, setDataView] = useState<'raw' | 'analyzed'>('raw');  // 數據視角
    const [latestRecordDates, setLatestRecordDates] = useState<Record<string, string>>({});
    const [latestRecordData, setLatestRecordData] = useState<Record<string, { raw?: EmployeeData; analyzed?: EmployeeData }>>({});

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const allEmployees = await getAllEmployeeProfilesDB();
            setEmployees(allEmployees);

            // 載入每位員工的最新紀錄日期與數據
            const dates: Record<string, string> = {};
            const data: Record<string, { raw?: EmployeeData; analyzed?: EmployeeData }> = {};

            for (const emp of allEmployees) {
                const latestRecord = await getEmployeeLatestRecordDB(emp.id);
                if (latestRecord) {
                    dates[emp.id] = latestRecord.date;
                    // 儲存雙視角數據
                    data[emp.id] = {
                        raw: latestRecord.rawData,
                        analyzed: latestRecord.analyzed41DaysData
                    };
                }
            }

            setLatestRecordDates(dates);
            setLatestRecordData(data);
        } catch (error) {
            console.error('載入員工清單失敗', error);
        }
    };

    const filteredEmployees = employees
        .filter(emp => {
            // 狀態篩選
            if (statusFilter === 'active' && emp.status !== 'active') return false;
            if (statusFilter === 'inactive' && emp.status !== 'inactive') return false;

            // 搜尋篩選
            if (searchTerm && !emp.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;

            return true;
        })
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-TW'));

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-2xl border-2 border-slate-200 flex flex-col w-full max-w-lg max-h-[85vh]" onClick={e => e.stopPropagation()}>
                {/* 標題列 */}
                <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-black text-slate-800 flex items-center">
                            <span className="mr-2">👥</span>
                            員工清單
                        </h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                                {filteredEmployees.length} / {employees.length} 名
                            </span>
                            <button onClick={onClose} className="w-8 h-8 rounded-lg bg-slate-200 hover:bg-slate-300 flex items-center justify-center transition-colors text-slate-700 font-bold">✕</button>
                        </div>
                    </div>

                    {/* 搜尋框 */}
                    <input
                        type="text"
                        placeholder="搜尋員工姓名..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />

                    {/* 狀態篩選 */}
                    <div className="flex gap-2 mt-3">
                        <button
                            onClick={() => setStatusFilter('active')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${statusFilter === 'active'
                                ? 'bg-green-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            在職
                        </button>
                        <button
                            onClick={() => setStatusFilter('inactive')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${statusFilter === 'inactive'
                                ? 'bg-rose-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            離職
                        </button>
                        <button
                            onClick={() => setStatusFilter('all')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${statusFilter === 'all'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            全部
                        </button>
                    </div>

                    {/* 數據視角切換 */}
                    <div className="flex gap-2 mt-3">
                        <span className="text-[10px] text-slate-500 font-bold self-center mr-1">數據視角:</span>
                        <button
                            onClick={() => setDataView('raw')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${dataView === 'raw'
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            📅 當日數據
                        </button>
                        <button
                            onClick={() => setDataView('analyzed')}
                            className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${dataView === 'analyzed'
                                ? 'bg-purple-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                        >
                            📈 41天分析
                        </button>
                    </div>
                </div>

                {/* 員工列表 */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {filteredEmployees.length === 0 ? (
                        <div className="py-20 text-center text-slate-400 text-sm">
                            {searchTerm ? '沒有符合的員工' : '目前沒有員工資料'}
                        </div>
                    ) : (
                        filteredEmployees.map((emp) => (
                            <div
                                key={emp.id}
                                onClick={() => onSelectEmployee(emp)}
                                className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-4 cursor-pointer transition-all group"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-black text-slate-900 text-base">{emp.displayName || emp.name}</h3>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${emp.status === 'active'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-rose-100 text-rose-700'
                                                }`}>
                                                {emp.status === 'active' ? '在職' : '離職'}
                                            </span>
                                        </div>
                                        {latestRecordDates[emp.id] && (
                                            <p className="text-[10px] text-slate-500 font-bold">
                                                最近數據：{latestRecordDates[emp.id]}
                                            </p>
                                        )}

                                        {/* 顯示當前視角的數據 */}
                                        {latestRecordData[emp.id] && (
                                            <div className="mt-2 grid grid-cols-3 gap-2">
                                                {dataView === 'raw' && latestRecordData[emp.id].raw && (
                                                    <>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">派單:</span>
                                                            <span className="font-bold text-slate-700 ml-1">{latestRecordData[emp.id].raw!.todayLeads}</span>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">派成:</span>
                                                            <span className="font-bold text-slate-700 ml-1">{latestRecordData[emp.id].raw!.todaySales}</span>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">業績:</span>
                                                            <span className="font-bold text-slate-700 ml-1">{(latestRecordData[emp.id].raw!.todayNetRevenue / 10000).toFixed(1)}萬</span>
                                                        </div>
                                                    </>
                                                )}
                                                {dataView === 'analyzed' && latestRecordData[emp.id].analyzed && (
                                                    <>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">41天派單:</span>
                                                            <span className="font-bold text-purple-700 ml-1">{latestRecordData[emp.id].analyzed!.todayLeads}</span>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">41天派成:</span>
                                                            <span className="font-bold text-purple-700 ml-1">{latestRecordData[emp.id].analyzed!.todaySales}</span>
                                                        </div>
                                                        <div className="text-[10px]">
                                                            <span className="text-slate-400">41天業績:</span>
                                                            <span className="font-bold text-purple-700 ml-1">{(latestRecordData[emp.id].analyzed!.todayNetRevenue / 10000).toFixed(1)}萬</span>
                                                        </div>
                                                    </>
                                                )}
                                                {dataView === 'analyzed' && !latestRecordData[emp.id].analyzed && (
                                                    <div className="col-span-3 text-[10px] text-slate-400 italic">
                                                        尚未進行 41 天分析
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {emp.notes && (
                                            <p className="text-xs text-slate-600 mt-1 line-clamp-1">{emp.notes}</p>
                                        )}
                                    </div>
                                    <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                        →
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
};

export default EmployeeDirectory;
