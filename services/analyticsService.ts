/**
 * analyticsService.ts
 * 提供數據分析與轉換功能，將新式 DailyStats 數據轉換為儀錶板元件 (EmployeeData) 可接受的格式。
 */
import { DailyStat, getDailyStats } from './mergeService';
import { EmployeeData, EmployeeCategory } from '../types';
import { calculateRankings, calculateConversionRate } from '../utils/rankingCalculator';

/**
 * 將 DailyStat 陣列轉換為 EmployeeData 陣列
 */
export function mapDailyStatsToEmployees(stats: DailyStat[]): EmployeeData[] {
    const employees: EmployeeData[] = stats.map(s => {
        // 基於成交率自動初步分類 (供 AI 未執行前參考)
        let category = EmployeeCategory.NEEDS_IMPROVEMENT;
        if (s.conversionRate >= 0.7) category = EmployeeCategory.FIREPOWER;
        else if (s.conversionRate >= 0.4) category = EmployeeCategory.STEADY;
        else if (s.conversionRate < 0.2 && s.totalDispatches > 5) category = EmployeeCategory.RISK;

        return {
            id: s.empId,
            name: s.empName,
            todayLeads: s.totalDispatches,
            todaySales: s.dispatchSales, // 以前用 s.totalSales，現改為明確的派單(成功)數
            todayFollowupSales: s.followupRevenue, // 追單業績
            todayRenewalSales: s.renewalRevenue, // 續單業績
            todayNetRevenue: s.totalRevenue,
            avgOrderValue: s.avgOrderValue,
            followupCount: s.followupSales, // 追單數量
            renewalCount: s.renewalSales, // 續單數量
            yishinRevenue: s.yishinRevenue, // 三立奕心業績
            minshiRevenue: s.minshiRevenue, // 民視商品業績
            companyRevenue: s.companyRevenue, // 公司商品業績
            otherRevenue: s.otherRevenue, // 其他業績
            giftCount: s.giftCount, // 贈品數量
            revenueRank: '0',
            followupRank: '0',
            avgPriceRank: '0',
            todayConvRate: calculateConversionRate(s.totalDispatches, s.dispatchSales),
            category: category,
            // 擴充欄位初始化
            monthlyTotalLeads: 0,
            monthlyLeadSales: 0,
            monthlyFollowupSales: 0,
            monthlyTotalConvRate: '0%',
            todayVirtualLeadPaid: 0,
            todayVirtualFollowupPaid: 0,
            monthlyVirtualLeadDeposit: 0,
            monthlyVirtualFollowupDeposit: 0,
            depositWithdrawal: 0,
            accumulatedDeposit: 0,
            withdrawalFollowup: 0,
            followupAmount: 0,
            returnAmount: 0,
            monthlyActualRevenue: 0,
            monthlyActualRevenueNet: 0
        };
    });

    // 計算動態排名
    return calculateRankings(employees);
}

/**
 * 獲取整合後的儀錶板數據
 * @param date YYYY-MM-DD
 */
export async function getIntegratedDashboardData(date: string): Promise<EmployeeData[]> {
    const stats = await getDailyStats(date, date);
    if (stats.length === 0) return [];
    return mapDailyStatsToEmployees(stats);
}

/**
 * 獲取一段範圍內的彙總數據 (用於趨勢圖)
 */
export async function getIntegratedRangeData(startDate: string, endDate: string): Promise<EmployeeData[]> {
    const stats = await getDailyStats(startDate, endDate);

    // 按員工聚合
    const empMap = new Map<string, DailyStat>();
    stats.forEach(s => {
        if (!empMap.has(s.empId)) {
            empMap.set(s.empId, {
                ...s,
                totalDispatches: 0,
                totalSales: 0,
                dispatchSales: 0,
                followupSales: 0,
                renewalSales: 0,
                followupRevenue: 0,
                renewalRevenue: 0,
                yishinRevenue: 0,
                minshiRevenue: 0,
                companyRevenue: 0,
                otherRevenue: 0,
                giftCount: 0,
                totalRevenue: 0
            });
        }
        const target = empMap.get(s.empId)!;
        target.totalDispatches += s.totalDispatches || 0;
        target.totalSales += s.totalSales || 0;
        target.dispatchSales += s.dispatchSales || Math.max((s.totalSales || 0) - (s.followupSales || 0) - (s.renewalSales || 0), 0);
        target.followupSales += s.followupSales || 0;
        target.renewalSales += s.renewalSales || 0;
        target.followupRevenue += s.followupRevenue || 0;
        target.renewalRevenue += s.renewalRevenue || 0;
        target.yishinRevenue += s.yishinRevenue || 0;
        target.minshiRevenue += s.minshiRevenue || 0;
        target.companyRevenue += s.companyRevenue || 0;
        target.otherRevenue += s.otherRevenue || 0;
        target.giftCount += s.giftCount || 0;
        target.totalRevenue += s.totalRevenue || 0;
    });

    const aggregatedStats = Array.from(empMap.values()).map(s => ({
        ...s,
        conversionRate: s.totalDispatches > 0 ? s.dispatchSales / s.totalDispatches : 0,
        avgOrderValue: s.dispatchSales > 0 ? Math.round((s.totalRevenue - s.followupRevenue - s.renewalRevenue) / s.dispatchSales) : 0
    }));

    return mapDailyStatsToEmployees(aggregatedStats as DailyStat[]);
}

/**
 * 獲取每日趨勢數據 (用於 ExecutiveDashboard 的營收走勢或項趨勢圖)
 * @returns 包含日期、總營收、總單數、平均客單價的陣列
 */
export async function getIntegratedTrendData(startDate: string, endDate: string) {
    const stats = await getDailyStats(startDate, endDate);

    const dayMap = new Map<string, {
        date: string,
        revenue: number,
        sales: number,
        leads: number,
        dispatchSales: number,
        followupRevenue: number,
        renewalRevenue: number
    }>();

    stats.forEach(s => {
        if (!dayMap.has(s.date)) {
            dayMap.set(s.date, {
                date: s.date,
                revenue: 0,
                sales: 0,
                leads: 0,
                dispatchSales: 0,
                followupRevenue: 0,
                renewalRevenue: 0
            });
        }
        const day = dayMap.get(s.date)!;
        day.revenue += s.totalRevenue || 0;
        day.sales += s.totalSales || 0;
        day.leads += s.totalDispatches || 0;
        day.dispatchSales += s.dispatchSales || Math.max((s.totalSales || 0) - (s.followupSales || 0) - (s.renewalSales || 0), 0);
        day.followupRevenue += s.followupRevenue || 0;
        day.renewalRevenue += s.renewalRevenue || 0;
    });

    return Array.from(dayMap.values())
        .sort((a, b) => a.date.localeCompare(b.date))
        .map(d => ({
            date: d.date,
            revenue: d.revenue,
            sales: d.sales,
            leads: d.leads,
            rate: d.leads > 0 ? Number(Math.min((d.dispatchSales / d.leads) * 100, 100).toFixed(1)) : 0,
            avgOrderValue: d.dispatchSales > 0 ? Math.round((d.revenue - d.followupRevenue - d.renewalRevenue) / d.dispatchSales) : 0
        }));
}
