import React, { useState, useEffect } from 'react';
import { EmployeeData, EmployeeCategory } from '../types';
import {
  ComposedChart,
  Bar,
  Line,
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
import { speakPerformance, initVoiceSystem } from '../services/ttsService';

interface Props {
  employees: EmployeeData[];
  onRefresh?: () => void;
  history?: any[];
  dataSourceMode?: 'manual' | 'integrated';
}

const Dashboard: React.FC<Props> = ({ employees, onRefresh, history, dataSourceMode = 'manual' }) => {
  const [speakingEmployeeId, setSpeakingEmployeeId] = useState<string | null>(null);

  // 初始化語音系統
  useEffect(() => {
    initVoiceSystem();
    // 監聽語音列表變更，確保聲音已加載
    window.speechSynthesis.onvoiceschanged = () => {
      initVoiceSystem();
    };
  }, []);

  // 準備圖表數據
  const chartData = employees.map(emp => {
    // 修復舊數據快取問題：動態重新計算正確的成交率，不再依賴字串
    const calculatedRate = emp.todayLeads > 0
      ? Math.min((emp.todaySales / emp.todayLeads) * 100, 100)
      : 0;

    return {
      id: emp.id,
      name: emp.name,
      aov: emp.avgOrderValue || 0,
      convRate: calculatedRate
    };
  }).sort((a, b) => b.aov - a.aov);

  // 滾動到特定人員的邏輯
  const scrollToEmployee = (id: string) => {
    const element = document.getElementById(`emp-${id}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // 加入視覺高亮效果
      element.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50', 'transition-all', 'duration-500');
      setTimeout(() => {
        element.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50');
      }, 2000);
    }
  };

  // 處理員工卡片點擊，觸發 TTS 播報
  const handleCardClick = async (emp: EmployeeData, event: React.MouseEvent) => {
    // 防止事件冒泡
    event.stopPropagation();

    // 零延遲反應：立即設定 UI 狀態
    setSpeakingEmployeeId(emp.id);

    try {
      // 播放語音 (內部會自動 cancel 上一段語音)
      await speakPerformance(emp);

      // 播放結束後，只有當目前還是在播放同一人時才清除狀態
      // 避免因為快速點擊切換，導致把新的人的狀態清除
      setSpeakingEmployeeId(prev => prev === emp.id ? null : prev);
    } catch (error: any) {
      console.error('播放失敗:', error);
      setSpeakingEmployeeId(prev => prev === emp.id ? null : prev);

      // 不顯示 alert 干擾體驗，僅 log
    }
  };

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

  // 取得指定類別的員工
  // ⚠️ 重要：POTENTIAL 員工會同時顯示在潛力星探區 + 根據成交率自動歸入四大分類之一
  const getEmployeesByCategory = (cat: EmployeeCategory) => {
    return employees
      .filter(e => {
        // 本身就是該類別
        if (e.category === cat) return true;

        // POTENTIAL 員工額外判定：根據成交率決定應歸入哪一組
        if (e.category === EmployeeCategory.POTENTIAL) {
          const conv = parseFloat(String(e.todayConvRate || '0%').replace('%', '')) || 0;

          // 成交率 >= 30% 且派單價值高 → 歸入火力組
          if (conv >= 30 && e.avgOrderValue >= 5000 && cat === EmployeeCategory.FIREPOWER) return true;
          // 成交率 >= 20% 且 < 30% → 歸入穩定人選
          if (conv >= 20 && conv < 30 && cat === EmployeeCategory.STEADY) return true;
          // 成交率 >= 10% 且 < 20% → 歸入待加強
          if (conv >= 10 && conv < 20 && cat === EmployeeCategory.NEEDS_IMPROVEMENT) return true;
          // 成交率 < 10% → 歸入風險警告
          if (conv < 10 && cat === EmployeeCategory.RISK) return true;
        }

        return false;
      })
      .sort((a, b) => (a.categoryRank || 99) - (b.categoryRank || 99));
  };

  // 統合派單順序邏輯
  const dispatchOrder = [...employees].sort((a, b) => {
    const categoryPriority: Record<string, number> = {
      [EmployeeCategory.FIREPOWER]: 1,
      [EmployeeCategory.POTENTIAL]: 2,
      [EmployeeCategory.STEADY]: 3,
      [EmployeeCategory.NEEDS_IMPROVEMENT]: 4,
      [EmployeeCategory.RISK]: 5,
    };

    const aPriority = categoryPriority[a.category] || 99;
    const bPriority = categoryPriority[b.category] || 99;

    if (aPriority !== bPriority) return aPriority - bPriority;
    return (a.categoryRank || 99) - (b.categoryRank || 99);
  });

  return (
    <div className="space-y-8">

      {/* ── 派單總覽圓餅圖（第一張卡片） ── */}
      {employees.length > 0 && (() => {
        const totalLeads = employees.reduce((s, e) => s + (e.todayLeads || 0), 0);
        // 每人成交不得超過派單數；沒派單的人不計入成交
        const totalSales = employees.reduce((s, e) => {
          const leads = e.todayLeads || 0;
          if (leads <= 0) return s; // 沒派單不算成交
          return s + Math.min(e.todaySales || 0, leads);
        }, 0);
        const cappedSales = totalSales; // 已在上面 cap 過
        const totalUnsold = Math.max(totalLeads - cappedSales, 0);
        const convPct = totalLeads > 0 ? Math.min(Math.round(cappedSales / totalLeads * 100), 100) : 0;

        // 排序取前 8 名 + 其他
        const sorted = [...employees]
          .filter(e => (e.todayLeads || 0) > 0)
          .sort((a, b) => (b.todayLeads || 0) - (a.todayLeads || 0));
        const top = sorted.slice(0, 8);
        const othersLeads = sorted.slice(8).reduce((s, e) => s + (e.todayLeads || 0), 0);
        // 每人彙整（派單 + 成交）
        const topWithOther = [
          ...top.map(e => ({
            name: e.name,
            leads: e.todayLeads || 0,
            sales: Math.min(e.todaySales || 0, e.todayLeads || 0)
          })),
          ...(othersLeads > 0 ? [{
            name: '其他',
            leads: othersLeads,
            sales: sorted.slice(8).reduce((s, e) => s + Math.min(e.todaySales || 0, e.todayLeads || 0), 0)
          }] : [])
        ];

        // 單環交錯數據：每人兩段（實色=成交, 淡色=未成交）+ 人間白色分隔
        const interleavedData: { empName: string; value: number; type: 'sales' | 'unsold' | 'sep'; colorIdx: number }[] = [];
        topWithOther.forEach((emp, i) => {
          // 人與人之間插入分隔 slice
          if (i > 0) interleavedData.push({ empName: '__sep__', value: Math.max(totalLeads * 0.008, 1), type: 'sep', colorIdx: -1 });
          // 成交部分（實色）
          if (emp.sales > 0) interleavedData.push({ empName: emp.name, value: emp.sales, type: 'sales', colorIdx: i });
          // 未成交部分（同色淡化）
          const unsold = emp.leads - emp.sales;
          if (unsold > 0) interleavedData.push({ empName: emp.name, value: unsold, type: 'unsold', colorIdx: i });
        });
        // 尾部分隔：讓環形首尾接合處也有間距
        if (topWithOther.length > 1) {
          interleavedData.push({ empName: '__sep__', value: Math.max(totalLeads * 0.015, 1), type: 'sep', colorIdx: -1 });
        }

        const pieConvData = [
          { name: '已成交', value: cappedSales },
          { name: '未成交', value: totalUnsold }
        ].filter(d => d.value > 0);

        if (pieConvData.length === 0) {
          pieConvData.push({ name: '無數據', value: 1 });
        }

        const LEAD_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1', '#14b8a6', '#f97316', '#94a3b8'];
        const CONV_COLORS = ['#10b981', '#ef4444', '#cbd5e1']; // 新增一個灰色給無數據用

        // 內部 label：只顯示百分比（跳過分隔 slice）
        const RADIAN = Math.PI / 180;
        const renderInnerLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, payload }: any) => {
          if (payload?.type === 'sep' || percent < 0.04) return null;
          const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
          const x = cx + radius * Math.cos(-midAngle * RADIAN);
          const y = cy + radius * Math.sin(-midAngle * RADIAN);
          return (
            <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central"
              fontSize={10} fontWeight="800" style={{ pointerEvents: 'none' }}>
              {`${(percent * 100).toFixed(0)}%`}
            </text>
          );
        };

        // 自訂 Tooltip：顯示每人派單/成交明細
        const CustomDispatchTooltip = ({ active, payload }: any) => {
          if (!active || !payload?.length) return null;
          const d = payload[0]?.payload;
          if (!d || d.type === 'sep') return null;
          const name = d.empName || '';
          const emp = topWithOther.find(e => e.name === name);
          if (!emp) return null;
          const { leads, sales } = emp;
          const rate = leads > 0 ? Math.min(Math.round(sales / leads * 100), 100) : 0;
          return (
            <div style={{ background: '#fff', borderRadius: 12, padding: '10px 14px', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)' }}>
              <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 4, color: '#1e293b' }}>{name}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>📋 派單：{leads} 筆</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>✅ 成交：{sales} 筆</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>❌ 未成交：{leads - sales} 筆</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: rate >= 50 ? '#10b981' : '#ef4444', marginTop: 2, borderTop: '1px solid #e2e8f0', paddingTop: 4 }}>
                成交率：{rate}%
              </div>
            </div>
          );
        };

        return (
          <div className="bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header 漸層 */}
            <div className="relative p-6 border-b border-slate-100" style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)' }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-200">
                    <span className="text-2xl">🥧</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-slate-900 text-xl font-black tracking-tight">派單總覽</h2>
                      {dataSourceMode === 'integrated' && (
                        <span className="bg-indigo-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1">
                          <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                          雙軌模式
                        </span>
                      )}
                    </div>
                    <p className="text-slate-500 text-xs font-bold mt-0.5">
                      總派單 {totalLeads} 筆 ・ 成交 {cappedSales} 筆 ・ 成交率 {convPct}%
                    </p>
                  </div>
                </div>
                {/* 成交率大圓 */}
                <div className="hidden sm:flex items-center justify-center w-16 h-16 rounded-full border-4 border-emerald-400 bg-emerald-50">
                  <span className="text-lg font-black text-emerald-600">{convPct}%</span>
                </div>
              </div>
            </div>

            {/* KPI 統計列 */}
            <div className="grid grid-cols-3 border-b border-slate-100">
              <div className="p-4 text-center border-r border-slate-100">
                <div className="text-2xl font-black text-blue-600">{totalLeads}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">📋 總派單</div>
              </div>
              <div className="p-4 text-center border-r border-slate-100">
                <div className="text-2xl font-black text-emerald-600">{cappedSales}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">✅ 已成交</div>
              </div>
              <div className="p-4 text-center">
                <div className="text-2xl font-black text-red-500">{totalUnsold}</div>
                <div className="text-[10px] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">❌ 未成交</div>
              </div>
            </div>

            {/* 圓餅圖區 */}
            <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* 左：派單分佈 — 單環（實色=成交, 淡色=未成交） */}
              <div>
                <h3 className="text-sm font-black text-slate-700 mb-2 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center text-xs">📊</span>
                  派單分佈（派給誰 × 成交）
                </h3>
                <p className="text-[10px] text-slate-400 font-bold mb-3">
                  實色＝已成交 ｜ 淡色＝未成交
                </p>
                <div className="h-[320px] w-full flex items-center justify-center overflow-visible">
                  <PieChart width={400} height={320}>
                    <Pie
                      data={interleavedData}
                      cx="50%" cy="50%"
                      innerRadius={80} outerRadius={120}
                      paddingAngle={0}
                      dataKey="value"
                      nameKey="empName"
                      label={renderInnerLabel}
                      labelLine={false}
                      stroke="none"
                      legendType="none"
                    >
                      {interleavedData.length > 0 ? interleavedData.map((d, i) => (
                        <Cell
                          key={`ic-${i}`}
                          fill={d.type === 'sep' ? '#ffffff' : LEAD_COLORS[d.colorIdx % LEAD_COLORS.length]}
                          fillOpacity={d.type === 'sales' ? 1 : d.type === 'unsold' ? 0.3 : 1}
                          stroke={d.type === 'sep' ? '#fff' : 'none'}
                          strokeWidth={d.type === 'sep' ? 2 : 0}
                        />
                      )) : (
                        <Cell key="empty" fill="#f1f5f9" />
                      )}
                    </Pie>
                    <Tooltip content={<CustomDispatchTooltip />} />
                  </PieChart>
                </div>
                {/* 自製 Legend */}
                <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 mt-2">
                  {topWithOther.map((emp, i) => (
                    <div key={emp.name} className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: LEAD_COLORS[i % LEAD_COLORS.length] }} />
                      <span className="text-[10px] font-bold text-slate-500">{emp.name} 派{emp.leads}/成{emp.sales}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右：成交狀況 */}
              <div>
                <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center text-xs">🎯</span>
                  成交狀況
                </h3>
                <div className="h-[300px] w-full relative flex items-center justify-center overflow-visible">
                  <PieChart width={400} height={300}>
                    <Pie
                      data={pieConvData}
                      cx="50%" cy="45%"
                      innerRadius={70} outerRadius={110}
                      paddingAngle={3}
                      dataKey="value"
                      label={renderInnerLabel}
                      labelLine={false}
                      stroke="#fff" strokeWidth={2}
                    >
                      {pieConvData.map((entry, i) => {
                        const fillcolor = entry.name === '已成交' ? '#10b981' : entry.name === '未成交' ? '#ef4444' : '#cbd5e1';
                        return <Cell key={`cc-${i}`} fill={fillcolor} />;
                      })}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.15)', fontSize: '13px', fontWeight: 700 }}
                      formatter={(v: number, name: string) => [`${v} 筆`, name]}
                    />
                    <Legend
                      verticalAlign="bottom" height={40}
                      iconType="circle" iconSize={10}
                      formatter={(value: string) => {
                        const color = value === '已成交' ? '#10b981' : value === '未成交' ? '#ef4444' : '#94a3b8';
                        const count = value === '已成交' ? cappedSales : value === '未成交' ? totalUnsold : 0;
                        return <span style={{ fontSize: '12px', fontWeight: 800, color }}>{value} {count}筆</span>;
                      }}
                    />
                  </PieChart>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 派單順序卡片 (主視覺區) - 淺色主題 */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl overflow-hidden shadow-xl border border-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center space-x-4">
              <span className="text-3xl">🎯</span>
              <div>
                <h2 className="text-slate-900 text-xl font-black tracking-tight">當前最優派單順序 (AI 建議)</h2>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">整合四大維度排名，點擊人員查看詳情</p>
              </div>
            </div>
            <div className="hidden sm:block bg-blue-50 border border-blue-100 text-blue-600 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter">
              AI 數據導引
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
              {dispatchOrder.map((emp, index) => (
                <div
                  key={emp.id}
                  onClick={() => scrollToEmployee(emp.id)}
                  className="group flex bg-slate-50 hover:bg-white border border-slate-100 hover:border-blue-200 rounded-2xl p-5 transition-all cursor-pointer relative overflow-hidden shadow-sm hover:shadow-md"
                >

                  <div className="relative flex items-start space-x-4 w-full">
                    <div className="flex-shrink-0 flex flex-col items-center space-y-2">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center font-black text-lg border border-slate-700 shadow-lg text-white">
                        {index + 1}
                      </div>
                      <span className="text-2xl filter drop-shadow-sm">
                        {emp.category === EmployeeCategory.FIREPOWER ? '🔥' :
                          emp.category === EmployeeCategory.STEADY ? '💎' :
                            emp.category === EmployeeCategory.NEEDS_IMPROVEMENT ? '⚠️' : '🛑'}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center mb-2">
                        <h4 className="text-slate-900 font-black text-base truncate pr-2">{emp.name}</h4>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border truncate ${emp.category === EmployeeCategory.FIREPOWER ? 'bg-orange-50 border-orange-100 text-orange-600' :
                          emp.category === EmployeeCategory.STEADY ? 'bg-blue-50 border-blue-100 text-blue-600' :
                            emp.category === EmployeeCategory.NEEDS_IMPROVEMENT ? 'bg-amber-50 border-amber-100 text-amber-600' :
                              'bg-rose-50 border-rose-100 text-rose-600'
                          }`}>
                          {emp.category}
                        </span>
                      </div>

                      <div className="flex items-center space-x-3 mb-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>成交率 {emp.todayConvRate}</span>
                        <span className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>業績 #{emp.revenueRank}</span>
                      </div>

                      <div className="bg-white rounded-xl p-3 border border-slate-200 group-hover:border-blue-100 transition-colors shadow-inner">
                        <p className="text-xs text-slate-600 font-medium leading-relaxed italic">
                          "{emp.aiAdvice}"
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 人員效能綜分圖 (Bar + Line) */}
      {employees.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-xl border border-slate-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-slate-900 text-lg font-black tracking-tight">人員效能綜分圖</h3>
            <div className="flex items-center space-x-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              <div className="flex items-center shrink-0">
                <span className="w-3 h-3 bg-blue-500 rounded-sm mr-2"></span>
                <span>派單價值 (左軸)</span>
              </div>
              <div className="flex items-center shrink-0">
                <span className="w-3 h-3 bg-rose-500 rounded-full mr-2"></span>
                <span>成交率 % (右軸)</span>
              </div>
            </div>
          </div>

          {/* 團隊平均數據 */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-blue-600 font-black uppercase tracking-widest mb-1">團隊平均派單價值</div>
                  <div className="text-2xl font-black text-blue-600 tabular-nums">
                    ${Math.round(employees.reduce((sum, e) => sum + (e.avgOrderValue || 0), 0) / (employees.length || 1)).toLocaleString()}
                  </div>
                </div>
                <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center text-2xl">
                  💰
                </div>
              </div>
            </div>
            <div className="bg-rose-50 border border-rose-100 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-rose-600 font-black uppercase tracking-widest mb-1">團隊平均成交率</div>
                  <div className="text-2xl font-black text-rose-600 tabular-nums">
                    {(employees.reduce((sum, e) => sum + (parseFloat(String(e.todayConvRate || '0%').replace('%', '')) || 0), 0) / (employees.length || 1)).toFixed(1)}%
                  </div>
                </div>
                <div className="w-12 h-12 bg-rose-500 rounded-lg flex items-center justify-center text-2xl">
                  🎯
                </div>
              </div>
            </div>
          </div>

          <div className="h-[400px] w-full" style={{ minHeight: 400 }}>
            <ResponsiveContainer width="99%" height="100%" minHeight={400} minWidth={1}>
              <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tick={({ x, y, payload }) => (
                    <g transform={`translate(${x},${y + 18})`}>
                      <text
                        x={0}
                        y={0}
                        fill="#64748b"
                        fontSize={12}
                        fontWeight="bold"
                        textAnchor="middle"
                        style={{ writingMode: 'vertical-rl', textOrientation: 'upright', letterSpacing: '0.1em' }}
                      >
                        {payload.value}
                      </text>
                    </g>
                  )}
                  height={15}
                />
                <YAxis
                  yAxisId="left"
                  orientation="left"
                  stroke="#3b82f6"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#3b82f6', fontSize: 11, fontWeight: 'black' }}
                  label={{ value: '派單價值', angle: -90, position: 'insideLeft', offset: -5, style: { fill: '#3b82f6', fontSize: 10, fontWeight: 'bold' } }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  stroke="#f43f5e"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#f43f5e', fontSize: 11, fontWeight: 'black' }}
                  label={{ value: '成交率 (%)', angle: 90, position: 'insideRight', offset: -5, style: { fill: '#f43f5e', fontSize: 10, fontWeight: 'bold' } }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  itemStyle={{ fontSize: '11px', fontWeight: 'black', textTransform: 'uppercase' }}
                  labelStyle={{ fontWeight: 'black', color: '#1e293b', marginBottom: '4px' }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="aov"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  barSize={40}
                  name="派單價值"
                  onClick={(data) => {
                    if (data && data.id) scrollToEmployee(data.id);
                  }}
                  className="cursor-pointer"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="convRate"
                  stroke="#f43f5e"
                  strokeWidth={3}
                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                  activeDot={{ r: 6, strokeWidth: 0 }}
                  name="成交率 (%)"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 潛力星探區 - Professional Deep Night Theme */}
      {employees.length > 0 && (
        <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] border border-blue-500/30 animate-in fade-in zoom-in duration-700">
          <div className="p-8 border-b border-white/5 flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-4xl shadow-lg">
                🔭
              </div>
              <div>
                <h2 className="text-white text-2xl font-black tracking-tight">潛力星探區
                </h2>
                <p className="text-slate-400 text-sm font-bold mt-1">「尋找被低估的將才:高轉換、低分配、值得增加資源的人選」</p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {employees
                .filter(emp => {
                  // 星探判定邏輯
                  const conv = parseFloat(String(emp.todayConvRate || '0%').replace('%', '')) || 0;
                  const teamAvgConv = employees.reduce((acc, e) => acc + (parseFloat(String(e.todayConvRate || '0%').replace('%', '')) || 0), 0) / (employees.length || 1);
                  const sortedLeads = [...employees].sort((a, b) => a.todayLeads - b.todayLeads);
                  const medianLeads = sortedLeads[Math.floor(sortedLeads.length / 2)]?.todayLeads || 0;

                  // 1. AI 標記為潛力組 OR 2. 演算法偵測 (成交率 > 團隊平均 + 5%,且派單數 <= 中位數 60%)
                  return emp.category === EmployeeCategory.POTENTIAL || (conv >= teamAvgConv + 5 && emp.todayLeads <= medianLeads * 0.6);
                })
                .map((emp) => {
                  const dispatchRank = dispatchOrder.findIndex(de => de.id === emp.id) + 1;
                  const teamAvgConv = employees.reduce((acc, e) => acc + (parseFloat(String(e.todayConvRate || '0%').replace('%', '')) || 0), 0) / (employees.length || 1);
                  const teamAvgAov = employees.reduce((sum, e) => sum + e.avgOrderValue, 0) / (employees.length || 1);
                  const conv = parseFloat(String(emp.todayConvRate || '0%').replace('%', '')) || 0;

                  return (
                    <div
                      key={emp.id}
                      onClick={(e) => handleCardClick(emp, e)}
                      className={`group relative bg-white/10 border rounded-2xl p-6 hover:bg-white/20 transition-all cursor-pointer overflow-hidden backdrop-blur-md shadow-xl ${speakingEmployeeId === emp.id
                        ? 'ring-4 ring-blue-400 border-blue-400'
                        : 'border-white/10'
                        }`}
                    >
                      {/* 播放狀態指示器 */}
                      {speakingEmployeeId === emp.id && (
                        <div className="absolute top-4 right-4 z-10">
                          <span className="text-blue-400 text-2xl animate-bounce drop-shadow-lg">🔊</span>
                        </div>
                      )}

                      {/* 背景光暈效果 */}
                      <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl group-hover:bg-blue-400/30 transition-all"></div>

                      <div className="relative flex items-center justify-between mb-4">
                        <div className="flex flex-col">
                          <h4 className="text-white font-black text-lg">{emp.name}</h4>
                          <span className="text-[10px] font-black bg-blue-600 text-white px-2 py-0.5 rounded-full mt-1 inline-block w-fit">
                            AI 建議順序: #{dispatchRank}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="bg-emerald-500/20 px-3 py-1 rounded-lg inline-block">
                            <div className="text-emerald-400 font-black text-xl tabular-nums leading-none">{emp.todayConvRate}</div>
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">核心轉換率</div>
                        </div>
                      </div>

                      {/* 人員效能綜分區塊 */}
                      <div className="space-y-3 mb-4">
                        <div className="bg-black/20 rounded-xl p-3 border border-white/5">
                          <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[10px] text-slate-400 font-black uppercase">人員效能綜分指標</span>
                            <span className="text-[9px] text-blue-400 font-bold">VS 團隊平均</span>
                          </div>
                          <div className="space-y-2">
                            {/* 派單價值對比 */}
                            <div>
                              <div className="flex justify-between text-[9px] mb-1">
                                <span className="text-slate-300">派單價值: ${(emp.avgOrderValue || 0).toLocaleString()}</span>
                                <span className={emp.avgOrderValue >= teamAvgAov ? 'text-emerald-400' : 'text-rose-400'}>
                                  {emp.avgOrderValue >= teamAvgAov ? '↑' : '↓'} {Math.abs(Math.round((emp.avgOrderValue / teamAvgAov - 1) * 100))}%
                                </span>
                              </div>
                              <div className="relative h-1 w-full bg-white/5 rounded-full overflow-visible">
                                <div
                                  className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                                  style={{ width: `${Math.min((emp.avgOrderValue / teamAvgAov) * 50, 100)}%` }}
                                ></div>
                                {/* 團隊平均標記線 */}
                                <div className="absolute top-0 left-1/2 -translate-x-px h-full w-0.5 bg-yellow-400/80 shadow-sm z-10"></div>
                              </div>
                            </div>
                            {/* 成交率對比 */}
                            <div>
                              <div className="flex justify-between text-[9px] mb-1">
                                <span className="text-slate-300">成交率: {emp.todayConvRate}</span>
                                <span className={conv >= teamAvgConv ? 'text-emerald-400' : 'text-rose-400'}>
                                  {conv >= teamAvgConv ? '↑' : '↓'} {(conv - teamAvgConv).toFixed(1)}%
                                </span>
                              </div>
                              <div className="relative h-1 w-full bg-white/5 rounded-full overflow-visible">
                                <div
                                  className="absolute top-0 left-0 h-full bg-rose-500 rounded-full"
                                  style={{ width: `${Math.min((conv / teamAvgConv) * 50, 100)}%` }}
                                ></div>
                                {/* 團隊平均標記線 */}
                                <div className="absolute top-0 left-1/2 -translate-x-px h-full w-0.5 bg-yellow-400/80 shadow-sm z-10"></div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                            <div className="text-[10px] text-slate-400 font-black uppercase mb-1">當前派單量</div>
                            <div className="text-sm font-black text-white">{emp.todayLeads} <span className="text-[10px] text-rose-400 ml-1">(-低於均值)</span></div>
                          </div>
                          <div className="bg-blue-500/20 rounded-xl p-3 border border-white/10">
                            <div className="text-[10px] text-slate-400 font-black uppercase mb-1">派單價值</div>
                            <div className="text-sm font-black text-blue-400">${(emp.avgOrderValue || 0).toLocaleString()}</div>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-600/20 rounded-xl p-4 border-l-4 border-blue-500/30">
                        <p className="text-xs text-blue-200 font-bold leading-relaxed">
                          💡 {emp.scoutAdvice || '成交率遠超平均且派單極少,可提高分配派單。'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              {employees.filter(emp => {
                const conv = parseFloat(String(emp.todayConvRate || '0%').replace('%', '')) || 0;
                const teamAvgConv = employees.reduce((acc, e) => acc + (parseFloat(String(e.todayConvRate || '0%').replace('%', '')) || 0), 0) / (employees.length || 1);
                const sortedLeads = [...employees].sort((a, b) => (a.todayLeads || 0) - (b.todayLeads || 0));
                const medianLeads = sortedLeads[Math.floor(sortedLeads.length / 2)]?.todayLeads || 0;
                return emp.category === EmployeeCategory.POTENTIAL || (conv >= teamAvgConv + 5 && emp.todayLeads <= medianLeads * 0.6);
              }).length === 0 && (
                  <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-40">
                    <span className="text-4xl mb-4">🌑</span>
                    <p className="text-slate-500 text-xs font-black uppercase tracking-widest">目前暫無符合「被低估」條件的人才</p>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

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
                    <div
                      key={emp.id}
                      id={`emp-${emp.id}`}
                      onClick={(e) => handleCardClick(emp, e)}
                      className={`bg-white p-5 rounded-lg border shadow-sm hover:border-blue-400 transition-all group relativeScroll cursor-pointer ${speakingEmployeeId === emp.id
                        ? 'ring-4 ring-blue-400 border-blue-400'
                        : 'border-slate-200'
                        }`}
                    >
                      {/* 播放狀態指示器 */}
                      {speakingEmployeeId === emp.id && (
                        <div className="absolute top-2 right-2 flex items-center space-x-1">
                          <span className="text-blue-500 text-xl animate-bounce">🔊</span>
                        </div>
                      )}

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
                            {emp.todayNetRevenue?.toLocaleString() || 0}
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
                          <div className="text-[8px] text-slate-400 font-bold uppercase">派單價值</div>
                          <div className="text-xs font-bold text-slate-800">{emp.avgOrderValue?.toLocaleString() || 0}</div>
                        </div>
                        <div className="col-span-3 grid grid-cols-2 gap-2 mt-1">
                          <div className="bg-slate-900 px-3 py-2 rounded flex justify-between items-center border border-white/10">
                            <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">追單: <span className="text-blue-400">{emp.followupCount || 0}</span></span>
                            <span className="text-xs font-bold text-white tabular-nums">${emp.todayFollowupSales?.toLocaleString() || 0}</span>
                          </div>
                          <div className="bg-slate-900 px-3 py-2 rounded flex justify-between items-center border border-white/10">
                            <span className="text-[8px] text-white/40 font-bold uppercase tracking-widest">續單: <span className="text-purple-400">{emp.renewalCount || 0}</span></span>
                            <span className="text-xs font-bold text-white tabular-nums">${emp.todayRenewalSales?.toLocaleString() || 0}</span>
                          </div>
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
