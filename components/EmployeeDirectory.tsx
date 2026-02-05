import React, { useState, useEffect } from 'react';
import { EmployeeProfile } from '../types';
import { getAllEmployeeProfilesDB, getEmployeeLatestRecordDB } from '../services/dbService';

interface Props {
    onSelectEmployee: (employee: EmployeeProfile) => void;
}

const EmployeeDirectory: React.FC<Props> = ({ onSelectEmployee }) => {
    const [employees, setEmployees] = useState<EmployeeProfile[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
    const [latestRecordDates, setLatestRecordDates] = useState<Record<string, string>>({});

    useEffect(() => {
        loadEmployees();
    }, []);

    const loadEmployees = async () => {
        try {
            const allEmployees = await getAllEmployeeProfilesDB();
            setEmployees(allEmployees);

            // 載入每位員工的最新紀錄日期
            const dates: Record<string, string> = {};
            for (const emp of allEmployees) {
                const latestRecord = await getEmployeeLatestRecordDB(emp.id);
                if (latestRecord) {
                    dates[emp.id] = latestRecord.date;
                }
            }
            setLatestRecordDates(dates);
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
        .sort((a, b) => a.name.localeCompare(b.name, '繁體中文'));

    return (
        <div className="bg-white rounded-2xl shadow-lg border-2 border-slate-200 flex flex-col h-full">
            {/* 標題列 */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-black text-slate-800 flex items-center">
                        <span className="mr-2">👥</span>
                        員工清單
                    </h2>
                    <span className="text-xs font-bold text-slate-400 bg-white px-3 py-1 rounded-full border border-slate-200">
                        {filteredEmployees.length} / {employees.length} 名
                    </span>
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
                                        <h3 className="font-black text-slate-900 text-base">{emp.name}</h3>
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
    );
};

export default EmployeeDirectory;
