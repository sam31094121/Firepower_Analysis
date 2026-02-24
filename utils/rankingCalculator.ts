import { EmployeeData } from '../types';

/**
 * 自動計算員工排名
 * @param employees 員工數據陣列
 * @returns 加上排名的員工數據
 */
export function calculateRankings(employees: EmployeeData[]): EmployeeData[] {
    if (!employees || employees.length === 0) {
        return [];
    }

    // 業績排名 (總業績由高到低)
    const sortedByRevenue = [...employees].sort((a, b) =>
        b.todayNetRevenue - a.todayNetRevenue
    );

    // 追續排名 (追續總額由高到低)
    const sortedByFollowup = [...employees].sort((a, b) =>
        b.todayFollowupSales - a.todayFollowupSales
    );

    // 均價排名 (派單價值由高到低)
    const sortedByAvgPrice = [...employees].sort((a, b) =>
        b.avgOrderValue - a.avgOrderValue
    );

    // 為每個員工加上排名
    return employees.map(emp => {
        const revenueRank = sortedByRevenue.findIndex(e => e.name === emp.name) + 1;
        const followupRank = sortedByFollowup.findIndex(e => e.name === emp.name) + 1;
        const avgPriceRank = sortedByAvgPrice.findIndex(e => e.name === emp.name) + 1;

        return {
            ...emp,
            revenueRank: String(revenueRank),
            followupRank: String(followupRank),
            avgPriceRank: String(avgPriceRank)
        };
    });
}

/**
 * 計算派單成交率
 * @param todayLeads 派單數
 * @param todaySales 派成數
 * @returns 成交率字串 (例: "66.7%")
 */
export function calculateConversionRate(todayLeads: number, todaySales: number): string {
    if (todayLeads === 0) {
        return '0.0%';
    }
    const rate = Math.min((todaySales / todayLeads) * 100, 100).toFixed(1);
    return `${rate}%`;
}

/**
 * 計算派單價值 (平均訂單金額)
 * @param todayNetRevenue 總業績
 * @param todayLeads 派單數
 * @returns 派單價值
 */
export function calculateAvgOrderValue(todayNetRevenue: number, todayLeads: number): number {
    if (todayLeads === 0) {
        return 0;
    }
    return Math.round(todayNetRevenue / todayLeads);
}
