import { EmployeeData } from '../types';
import { getRecordsLast41DaysDB } from './dbService';

/**
 * 彙總最近 41 天的員工數據（按員工姓名分組）
 * 用於 AI 分析時計算長期表現趨勢
 */
export const aggregate41DaysData = async (): Promise<EmployeeData[]> => {
    const records = await getRecordsLast41DaysDB();

    // 按員工姓名分組彙總
    const employeeMap = new Map<string, EmployeeData>();

    records.forEach(record => {
        // 使用 rawData (當日原始數據)
        const dataToUse = record.rawData;

        dataToUse.forEach(emp => {
            const existing = employeeMap.get(emp.name);

            if (!existing) {
                // 第一次遇到此員工，初始化
                employeeMap.set(emp.name, {
                    ...emp,
                    id: `agg-${emp.name}-${Date.now()}`
                });
            } else {
                // 累加 41 天數據
                existing.todayLeads += emp.todayLeads;
                existing.todaySales += emp.todaySales;
                existing.todayNetRevenue += emp.todayNetRevenue;
                existing.followupCount += emp.followupCount;
                existing.todayFollowupSales += emp.todayFollowupSales;

                // 累加其他數值欄位
                existing.monthlyTotalLeads += emp.monthlyTotalLeads || 0;
                existing.monthlyLeadSales += emp.monthlyLeadSales || 0;
                existing.monthlyFollowupSales += emp.monthlyFollowupSales || 0;
                existing.todayVirtualLeadPaid += emp.todayVirtualLeadPaid || 0;
                existing.todayVirtualFollowupPaid += emp.todayVirtualFollowupPaid || 0;
                existing.monthlyVirtualLeadDeposit += emp.monthlyVirtualLeadDeposit || 0;
                existing.monthlyVirtualFollowupDeposit += emp.monthlyVirtualFollowupDeposit || 0;
                existing.depositWithdrawal += emp.depositWithdrawal || 0;
                existing.accumulatedDeposit += emp.accumulatedDeposit || 0;
                existing.withdrawalFollowup += emp.withdrawalFollowup || 0;
                existing.followupAmount += emp.followupAmount || 0;
                existing.returnAmount += emp.returnAmount || 0;
                existing.monthlyActualRevenue += emp.monthlyActualRevenue || 0;
                existing.monthlyActualRevenueNet += emp.monthlyActualRevenueNet || 0;
            }
        });
    });

    // 計算平均值與成交率
    return Array.from(employeeMap.values()).map(emp => {
        const convRate = emp.todayLeads > 0
            ? Math.min((emp.todaySales / emp.todayLeads) * 100, 100).toFixed(1)
            : '0.0';

        const avgOrderValue = emp.todayLeads > 0
            ? Math.round(emp.todayNetRevenue / emp.todayLeads)
            : 0;

        return {
            ...emp,
            todayConvRate: `${convRate}%`,
            avgOrderValue: avgOrderValue,
            // 清空排名欄位（等待 AI 重新計算）
            revenueRank: '-',
            followupRank: '-',
            avgPriceRank: '-',
            // 清空 AI 分析欄位
            category: undefined,
            categoryRank: undefined,
            aiAdvice: undefined,
            scoutAdvice: undefined
        };
    });
};
