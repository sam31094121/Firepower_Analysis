import {
    TimeSeriesDataPoint,
    RankingData,
    ChartData,
    MetricType
} from '../types';

/**
 * 轉換為時間序列圖表數據 (折線圖/面積圖)
 */
export const transformToTimeSeriesChart = (
    dataPoints: TimeSeriesDataPoint[],
    metric: MetricType
): ChartData => {
    // 按員工分組
    const employeeMap = new Map<string, TimeSeriesDataPoint[]>();
    dataPoints.forEach(point => {
        if (!employeeMap.has(point.employeeId)) {
            employeeMap.set(point.employeeId, []);
        }
        employeeMap.get(point.employeeId)!.push(point);
    });

    // 取得所有日期 (排序)
    const dates = Array.from(new Set(dataPoints.map(p => p.date))).sort();

    // 建立 datasets
    const datasets = Array.from(employeeMap.entries()).map(([employeeId, points]) => {
        const employeeName = points[0].employeeName;
        const data = dates.map(date => {
            const point = points.find(p => p.date === date);
            return point ? point.value : null;
        });

        return {
            label: employeeName,
            data,
            employeeId
        };
    });

    return {
        labels: dates,
        datasets
    };
};

/**
 * 轉換為排行榜圖表數據 (橫向長條圖)
 */
export const transformToRankingChart = (
    rankingData: RankingData[],
    metric: MetricType
): ChartData => {
    return {
        labels: rankingData.map(item => item.employeeName),
        datasets: [
            {
                label: getMetricLabel(metric),
                data: rankingData.map(item => item.value)
            }
        ]
    };
};

/**
 * 轉換為分佈圖表數據 (直方圖)
 */
export const transformToDistributionChart = (
    distribution: { value: number | string; count: number }[]
): ChartData => {
    return {
        labels: distribution.map(item => String(item.value)),
        datasets: [
            {
                label: '人數',
                data: distribution.map(item => item.count)
            }
        ]
    };
};

/**
 * 轉換為多人對比圖表數據 (分組長條圖)
 */
export const transformToComparisonChart = (
    dataPoints: TimeSeriesDataPoint[],
    metrics: MetricType[]
): ChartData => {
    // 按員工分組
    const employeeMap = new Map<string, TimeSeriesDataPoint[]>();
    dataPoints.forEach(point => {
        if (!employeeMap.has(point.employeeId)) {
            employeeMap.set(point.employeeId, []);
        }
        employeeMap.get(point.employeeId)!.push(point);
    });

    const employeeNames = Array.from(employeeMap.keys());

    // 為每個指標建立一個 dataset
    const datasets = metrics.map(metric => {
        const data = employeeNames.map(employeeId => {
            const points = employeeMap.get(employeeId)!;
            const point = points.find(p => p.metric === metric);
            return point ? point.value : null;
        });

        return {
            label: getMetricLabel(metric),
            data,
            metric
        };
    });

    return {
        labels: employeeNames,
        datasets
    };
};

/**
 * 轉換為雷達圖數據 (多維度對比)
 */
export const transformToRadarChart = (
    dataPoints: TimeSeriesDataPoint[],
    employeeIds: string[]
): ChartData => {
    // 取得所有指標
    const metrics = Array.from(new Set(dataPoints.map(p => p.metric)));

    // 為每個員工建立一個 dataset
    const datasets = employeeIds.map(employeeId => {
        const employeePoints = dataPoints.filter(p => p.employeeId === employeeId);
        const employeeName = employeePoints[0]?.employeeName || employeeId;

        const data = metrics.map(metric => {
            const point = employeePoints.find(p => p.metric === metric);
            return point ? normalizeValue(point.value) : 0;
        });

        return {
            label: employeeName,
            data,
            employeeId
        };
    });

    return {
        labels: metrics.map(m => getMetricLabel(m)),
        datasets
    };
};

/**
 * 轉換為堆疊面積圖數據 (顯示佔比)
 */
export const transformToStackedAreaChart = (
    dataPoints: TimeSeriesDataPoint[],
    metric: MetricType
): ChartData => {
    const chartData = transformToTimeSeriesChart(dataPoints, metric);

    // 標記為堆疊模式
    chartData.datasets.forEach(dataset => {
        (dataset as any).stack = 'stack1';
        (dataset as any).fill = true;
    });

    return chartData;
};

// ==================== 輔助函數 ====================

/**
 * 取得指標的中文標籤
 */
const getMetricLabel = (metric: MetricType): string => {
    const labels: Record<MetricType, string> = {
        todayLeads: '派單數',
        todaySales: '派成數',
        todayFollowupSales: '追續總額',
        todayNetRevenue: '總業績',
        avgOrderValue: '派單價值',
        followupCount: '追續數',
        todayConvRate: '派單成交率',
        monthlyTotalLeads: '月派單數',
        monthlyLeadSales: '月派成數',
        monthlyFollowupSales: '月追續總額',
        monthlyTotalConvRate: '月成交率',
        monthlyActualRevenue: '月實際業績'
    };
    return labels[metric] || metric;
};

/**
 * 正規化數值 (用於雷達圖)
 * 將不同量級的指標轉換為 0-100 的範圍
 */
const normalizeValue = (value: number | string): number => {
    if (typeof value === 'string') {
        // 處理百分比字串
        if (value.includes('%')) {
            return parseFloat(value.replace('%', ''));
        }
        return parseFloat(value) || 0;
    }
    return value;
};

/**
 * 計算移動平均 (用於平滑趨勢線)
 */
export const calculateMovingAverage = (
    dataPoints: TimeSeriesDataPoint[],
    windowSize: number = 7
): TimeSeriesDataPoint[] => {
    const sorted = [...dataPoints].sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map((point, index) => {
        const start = Math.max(0, index - windowSize + 1);
        const window = sorted.slice(start, index + 1);

        const sum = window.reduce((acc, p) => {
            const val = typeof p.value === 'number' ? p.value : parseFloat(String(p.value)) || 0;
            return acc + val;
        }, 0);

        const avg = sum / window.length;

        return {
            ...point,
            value: avg
        };
    });
};
