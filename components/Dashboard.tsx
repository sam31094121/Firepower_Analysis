
import React from 'react';
import { EmployeeData, EmployeeCategory } from '../types';

interface Props {
  employees: EmployeeData[];
}

const Dashboard: React.FC<Props> = ({ employees }) => {
  const categories = [
    {
      id: EmployeeCategory.FIREPOWER,
      label: '大單火力組',
      icon: '🔥',
      color: 'border-orange-500 bg-orange-50/10',
      textColor: 'text-orange-900',
      badgeColor: 'bg-orange-600',
      desc: '績效頂峰：具備最高成交權重。'
    },
    {
      id: EmployeeCategory.STEADY,
      label: '穩定人選',
      icon: '💎',
      color: 'border-slate-300 bg-slate-50/50',
      textColor: 'text-slate-900',
      badgeColor: 'bg-slate-600',
      desc: '穩定輸出：符合常態分佈。'
    },
    {
      id: EmployeeCategory.NEEDS_IMPROVEMENT,
      label: '待加強',
      icon: '⚠️',
      color: 'border-amber-400 bg-amber-50/10',
      textColor: 'text-amber-900',
      badgeColor: 'bg-amber-600',
      desc: '效能異常：建議訓練介入。'
    },
    {
      id: EmployeeCategory.RISK,
      label: '風險警告',
      icon: '🛑',
      color: 'border-rose-400 bg-rose-50/10',
      textColor: 'text-rose-900',
      badgeColor: 'bg-rose-600',
      desc: '決策停損：建議暫停供單。'
    }
  ];

  const getEmployeesByCategory = (cat: EmployeeCategory) => {
    return employees
      .filter(e => e.category === cat)
      .sort((a, b) => (a.categoryRank || 99) - (b.categoryRank || 99));
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {categories.map((cat) => {
          const list = getEmployeesByCategory(cat.id);
          return (
            <div key={cat.id} className={`rounded-xl border ${cat.color} flex flex-col min-h-[500px] shadow-sm`}>
              {/* 看板頭部 */}
              <div className="p-4 border-b border-black/5 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <h3 className={`font-bold ${cat.textColor} text-base`}>{cat.label}</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{cat.desc}</p>
                  </div>
                </div>
                <div className={`${cat.badgeColor} text-white px-2 py-0.5 rounded text-[10px] font-bold`}>
                  人數: {list.length}
                </div>
              </div>

              {/* 人員列表 */}
              <div className="p-4 flex-1 overflow-y-auto space-y-4">
                {list.length === 0 ? (
                  <div className="h-64 flex flex-col items-center justify-center opacity-20 italic text-xs font-bold uppercase tracking-widest text-slate-400">
                    尚無數據
                  </div>
                ) : (
                  list.map((emp) => (
                    <div key={emp.id} className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm hover:border-blue-400 transition-all group relative">
                      
                      {/* 組內排名標籤 */}
                      <div className="absolute -top-2 -left-2 bg-slate-900 text-white w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-md z-10">
                        <span className="text-xs font-black">{emp.categoryRank || '-'}</span>
                      </div>

                      {/* 基本資訊與總業績 */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="pl-4">
                          <h4 className="font-bold text-slate-900 text-lg flex items-center">
                            {emp.name}
                          </h4>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">業績排名 #{emp.revenueRank}</span>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">均價排名 #{emp.avgPriceRank}</span>
                            <span className="text-[9px] font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">追續排名 #{emp.followupRank}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-black text-slate-900 tabular-nums leading-none">
                            {emp.todayNetRevenue.toLocaleString()}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter mt-1">總業績</div>
                        </div>
                      </div>

                      {/* 數據網格 */}
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="text-[8px] text-slate-400 font-bold uppercase">派單 / 派成</div>
                          <div className="text-xs font-bold text-slate-800">
                            {emp.todayLeads} / <span className="text-blue-600">{emp.todaySales}</span>
                          </div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="text-[8px] text-slate-400 font-bold uppercase">成交率</div>
                          <div className="text-xs font-bold text-emerald-600">{emp.todayConvRate}</div>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-100">
                          <div className="text-[8px] text-slate-400 font-bold uppercase">客單價</div>
                          <div className="text-xs font-bold text-slate-800">{emp.avgOrderValue.toLocaleString()}</div>
                        </div>
                        <div className="col-span-3 bg-slate-900 px-3 py-2 rounded flex justify-between items-center">
                          <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">追續總額</span>
                          <span className="text-xs font-bold text-white tabular-nums">{emp.todayFollowupSales.toLocaleString()}</span>
                        </div>
                      </div>

                      {/* 派單決策決議區 (AI 建議) */}
                      <div className="bg-slate-50 p-3 rounded border-l-4 border-slate-400">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">派單決策決議</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700 leading-relaxed">
                          {emp.aiAdvice}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {employees.length === 0 && (
        <div className="bg-white rounded-xl p-20 text-center border border-dashed border-slate-200 flex flex-col items-center">
          <div className="text-4xl mb-6 grayscale opacity-30">📊</div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            等待數據輸入中
          </h3>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
