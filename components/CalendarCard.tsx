import React, { useState, useEffect } from 'react';
import { getAllRecordsDB } from '../services/dbService';
import { HistoryRecord } from '../types';

interface CalendarCardProps {
    onDateSelect: (date: string, dataSource: 'minshi' | 'yishin' | 'combined') => void;
    refreshTrigger?: number; // 用於觸發重新載入日期標記
}

const CalendarCard: React.FC<CalendarCardProps> = ({ onDateSelect, refreshTrigger }) => {
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
    const [dataSource, setDataSource] = useState<'minshi' | 'yishin' | 'combined'>('combined');
    const [recordDates, setRecordDates] = useState<Set<string>>(new Set());
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    // 獲取當月所有有數據的日期
    const loadRecordDates = async () => {
        try {
            const records = await getAllRecordsDB();
            const yearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
            const dates = records
                .filter(r => r.archiveDate?.startsWith(yearMonth) && r.dataSource === dataSource)
                .map(r => r.archiveDate!)
                .filter(Boolean);
            setRecordDates(new Set(dates));
        } catch (e) {
            console.error('載入日期標記失敗', e);
        }
    };

    useEffect(() => {
        loadRecordDates();
    }, [currentYear, currentMonth, dataSource, refreshTrigger]);

    // 生成月曆格子
    const generateCalendar = () => {
        const firstDay = new Date(currentYear, currentMonth - 1, 1).getDay();
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const days: (number | null)[] = [];

        // 前面補空格
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // 填入日期
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d);
        }

        return days;
    };

    const handleDateClick = async (day: number) => {
        const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        console.log('📅 點選日期:', dateStr);

        // 設定選中日期
        setSelectedDate(dateStr);

        // 觸發回調
        onDateSelect(dateStr, dataSource);

        // 等待一下後重新載入記錄日期（以便即時更新綠色狀態）
        setTimeout(async () => {
            await loadRecordDates();
        }, 500);
    };

    const handlePrevMonth = () => {
        if (currentMonth === 1) {
            setCurrentMonth(12);
            setCurrentYear(currentYear - 1);
        } else {
            setCurrentMonth(currentMonth - 1);
        }
    };

    const handleNextMonth = () => {
        if (currentMonth === 12) {
            setCurrentMonth(1);
            setCurrentYear(currentYear + 1);
        } else {
            setCurrentMonth(currentMonth + 1);
        }
    };

    const days = generateCalendar();
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 border-2 border-slate-200">
            <h3 className="text-lg font-black text-slate-800 mb-4">數據歸檔月曆</h3>

            {/* 表格類型選擇 */}
            <div className="mb-4 flex gap-2">
                <button
                    onClick={() => setDataSource('minshi')}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${dataSource === 'minshi'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    民視表
                </button>
                <button
                    onClick={() => setDataSource('yishin')}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${dataSource === 'yishin'
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    奕心表
                </button>
                <button
                    onClick={() => setDataSource('combined')}
                    className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all ${dataSource === 'combined'
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                >
                    總和表
                </button>
            </div>

            {/* 年月選擇 */}
            <div className="flex items-center justify-between mb-4">
                <button
                    onClick={handlePrevMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    ←
                </button>
                <span className="font-black text-slate-800">
                    {currentYear} 年 {currentMonth} 月
                </span>
                <button
                    onClick={handleNextMonth}
                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 transition-colors"
                >
                    →
                </button>
            </div>

            {/* 星期標題 */}
            <div className="grid grid-cols-7 gap-1 mb-2">
                {weekDays.map((day) => (
                    <div key={day} className="text-center text-xs font-bold text-slate-500 py-1">
                        {day}
                    </div>
                ))}
            </div>

            {/* 月曆格子 */}
            <div className="grid grid-cols-7 gap-1">
                {days.map((day, index) => {
                    if (day === null) {
                        return <div key={`empty-${index}`} className="aspect-square" />;
                    }

                    const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const hasData = recordDates.has(dateStr);
                    const isToday =
                        day === new Date().getDate() &&
                        currentMonth === new Date().getMonth() + 1 &&
                        currentYear === new Date().getFullYear();
                    const isSelected = selectedDate === dateStr;

                    return (
                        <button
                            key={day}
                            onClick={() => handleDateClick(day)}
                            title={hasData ? `${dateStr} 有數據` : `${dateStr} 無數據`}
                            className={`aspect-square flex items-center justify-center rounded-lg text-sm font-bold transition-all hover:scale-105 ${isToday
                                ? 'bg-blue-600 text-white shadow-lg'
                                : hasData
                                    ? 'bg-green-100 text-green-700 border-2 border-green-400'
                                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                                } ${isSelected
                                    ? isToday
                                        ? 'ring-2 ring-offset-2 ring-blue-400'
                                        : hasData
                                            ? 'ring-2 ring-offset-2 ring-green-500'
                                            : 'ring-2 ring-offset-2 ring-slate-400'
                                    : ''
                                }`}
                        >
                            {day}
                        </button>
                    );
                })}
            </div>

            {/* 圖例說明 */}
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-blue-600" />
                    <span className="text-slate-600">今天</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-4 h-4 rounded bg-green-100 border-2 border-green-400" />
                    <span className="text-slate-600">有數據</span>
                </div>
            </div>
        </div>
    );
};

export default CalendarCard;
