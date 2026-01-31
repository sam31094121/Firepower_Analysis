
import React from 'react';
import { EmployeeData, EmployeeCategory, AnalysisSummary } from '../types';

interface Props {
  employees: EmployeeData[];
}

const Dashboard: React.FC<Props> = ({ employees }) => {
  // 統計邏輯
  const summary: AnalysisSummary = {
    firepowerCount: employees.filter(e => e.category === EmployeeCategory.FIREPOWER).length,
    steadyCount: employees.filter(e => e.category === EmployeeCategory.STEADY).length,
    improvementCount: employees.filter(e => e.category === EmployeeCategory.NEEDS_IMPROVEMENT).length,
    riskCount: employees.filter(e => e.category === EmployeeCategory.RISK).length,
    totalRevenue: employees.reduce((sum, e) => sum + (e.monthlyActualRevenueNet || 0), 0)
  };

  const getCategoryStyles = (cat?: EmployeeCategory) => {
    switch (cat) {
      case EmployeeCategory.FIREPOWER: return 'bg-orange-100 text-orange-700 border-orange-300';
      case EmployeeCategory.STEADY: return 'bg-emerald-100 text-emerald-700 border-emerald-300';
      case EmployeeCategory.NEEDS_IMPROVEMENT: return 'bg-amber-100 text-amber-700 border-amber-300';
      case EmployeeCategory.RISK: return 'bg-rose-100 text-rose-700 border-rose-300';
      default: return 'bg-slate-100 text-slate-500 border-slate-200';
    }
  };

  const getCategoryIcon = (cat?: EmployeeCategory) => {
    switch (cat) {
      case EmployeeCategory.FIREPOWER: return '🔥';
      case EmployeeCategory.STEADY: return '💎';
      case EmployeeCategory.NEEDS_IMPROVEMENT: return '⚠️';
      case EmployeeCategory.RISK: return '🛑';
      default: return '⏳';
    }
  };

  const cards = [
    { key: EmployeeCategory.FIREPOWER, label: '大單火力組', count: summary.firepowerCount, icon: '🔥', desc: '狀態巔峰，優先補單', color: 'text-orange-600' },
    { key: EmployeeCategory.STEADY, label: '穩定人選', count: summary.steadyCount, icon: '💎', desc: '長期穩健，大戶首選', color: 'text-emerald-600' },
    { key: EmployeeCategory.NEEDS_IMPROVEMENT, label: '待加強', count: summary.improvementCount, icon: '⚠️', desc: '手感不佳，僅供練手', color: 'text-amber-600' },
    { key: EmployeeCategory.RISK, label: '風險警告', count: summary.riskCount, icon: '🛑', desc: '退貨率高，嚴禁大單', color: 'text-rose-600' },
  ];

  return (
    <div className="space-y-8">
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((item) => (
          <div 
            key={item.key} 
            className={`bg-white p-6 rounded-3xl shadow-sm border border-slate-200 transition-all duration-300 ${item.count > 0 ? 'ring-2 ring-slate-900 ring-offset-2' : ''}`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-4xl">{item.icon}</span>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.label}</span>
            </div>
            <div className="flex items-baseline space-x-1">
              <span className={`text-5xl font-black ${item.count > 0 ? 'text-slate-800' : 'text-slate-200'}`}>
                {item.count}
              </span>
              <span className="text-sm font-bold text-slate-400">人</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-4 font-bold border-t border-slate-50 pt-3">{item.desc}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest border-b border-slate-100">
                <th className="px-8 py-5">銷售人員</th>
                <th className="px-8 py-5 text-center">火力分組</th>
                <th className="px-8 py-5">月實收淨額</th>
                <th className="px-8 py-5">轉換率 (今日/月)</th>
                <th className="px-8 py-5">AI 建議</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {employees.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-8 py-6">
                    <div className="font-black text-slate-800">{emp.name}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">ID: {emp.id.slice(0,8)}</div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <div className={`inline-flex items-center px-3 py-1.5 rounded-xl text-[11px] font-black border ${getCategoryStyles(emp.category)}`}>
                      <span className="mr-1">{getCategoryIcon(emp.category)}</span>
                      {emp.category || '分析中...'}
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-sm font-black text-slate-700">${(emp.monthlyActualRevenueNet || 0).toLocaleString()}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-xs font-bold text-slate-500">{emp.todayConvRate} <span className="text-slate-300 mx-1">/</span> {emp.monthlyTotalConvRate}</div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="text-[11px] text-slate-600 font-medium italic bg-slate-50 p-3 rounded-xl border border-slate-100 max-w-xs">
                      {emp.aiAdvice || '正在分析...'}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-32 text-center text-slate-300 font-black italic">
                    尚未匯入數據，請從左側貼上資料
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
