import {
    collection,
    query,
    where,
    orderBy,
    getDocs
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import {
    HistoryRecord,
    EmployeeDailyRecord,
    QueryOptions,
    TimeSeriesDataPoint,
    RankingData,
    MetricType,
    EmployeeData
} from '../types';

/**
 * 多維度查詢函數 - 查詢指定人員、日期範圍、指標的數據
 */
export const getEmployeeMetrics = async (
    options: QueryOptions
): Promise<TimeSeriesDataPoint[]> => {
    const {
        employeeIds,
        startDate,
        endDate,
        metrics = [],
        dataSource,
        useAnalyzedData = false
    } = options;

    try {
        // 查詢日期範圍內的記錄
        const recordsRef = collection(db, 'records');
        let q = query(
            recordsRef,
            where('archiveDate', '>=', startDate),
            where('archiveDate', '<=', endDate),
            orderBy('archiveDate', 'asc')
        );

        // 如果指定資料來源,加入過濾
        if (dataSource) {
            q = query(q, where('dataSource', '==', dataSource));
        }

        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => doc.data() as HistoryRecord);

        // 轉換為時間序列數據點
        const dataPoints: TimeSeriesDataPoint[] = [];

        records.forEach(record => {
            const employeeDataArray = useAnalyzedData && record.analyzed41DaysData
                ? record.analyzed41DaysData
                : record.rawData;

            employeeDataArray.forEach(empData => {
                // 如果指定人員,過濾
                if (employeeIds && employeeIds.length > 0 && !employeeIds.includes(empData.name)) {
                    return;
                }

                // 提取指定指標
                metrics.forEach(metric => {
                    const value = empData[metric as keyof EmployeeData];
                    if (value !== undefined && value !== null) {
                        dataPoints.push({
                            date: record.archiveDate || record.date.split('T')[0],
                            employeeId: empData.name,
                            employeeName: empData.name,
                            value: value as number | string,
                            metric
                        });
                    }
                });
            });
        });

        return dataPoints;
    } catch (error) {
        console.error('查詢失敗:', error);
        throw new Error('查詢員工指標失敗');
    }
};

/**
 * 時間序列查詢 - 查詢單一指標的時間趨勢
 */
export const getEmployeeTimeSeries = async (
    options: Omit<QueryOptions, 'metrics'> & { metric: MetricType }
): Promise<TimeSeriesDataPoint[]> => {
    const { metric, ...restOptions } = options;
    return getEmployeeMetrics({
        ...restOptions,
        metrics: [metric]
    });
};

/**
 * 排行榜查詢 - 查詢指定日期的排行榜
 */
export const getEmployeeRanking = async (
    date: string,
    metric: MetricType,
    options?: {
        limit?: number;
        dataSource?: 'minshi' | 'yishin' | 'combined';
        useAnalyzedData?: boolean;
    }
): Promise<RankingData[]> => {
    const { limit, dataSource, useAnalyzedData = false } = options || {};

    try {
        const recordsRef = collection(db, 'records');
        let q = query(
            recordsRef,
            where('archiveDate', '==', date)
        );

        if (dataSource) {
            q = query(q, where('dataSource', '==', dataSource));
        }

        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            return [];
        }

        const record = snapshot.docs[0].data() as HistoryRecord;
        const employeeDataArray = useAnalyzedData && record.analyzed41DaysData
            ? record.analyzed41DaysData
            : record.rawData;

        // 提取指標值並排序
        const rankingData: RankingData[] = employeeDataArray
            .map(empData => {
                const value = empData[metric as keyof EmployeeData];
                return {
                    employeeId: empData.name,
                    employeeName: empData.name,
                    value: value as number | string,
                    rank: 0,
                    metric
                };
            })
            .filter(item => item.value !== undefined && item.value !== null)
            .sort((a, b) => {
                // 數字類型降序排列
                if (typeof a.value === 'number' && typeof b.value === 'number') {
                    return b.value - a.value;
                }
                return 0;
            })
            .map((item, index) => ({
                ...item,
                rank: index + 1
            }));

        // 如果有限制數量
        if (limit) {
            return rankingData.slice(0, limit);
        }

        return rankingData;
    } catch (error) {
        console.error('查詢排行榜失敗:', error);
        throw new Error('查詢排行榜失敗');
    }
};

/**
 * 指標分佈統計 - 查詢指定日期範圍內的指標分佈
 */
export const getMetricDistribution = async (
    startDate: string,
    endDate: string,
    metric: MetricType,
    options?: {
        dataSource?: 'minshi' | 'yishin' | 'combined';
        useAnalyzedData?: boolean;
    }
): Promise<{ value: number | string; count: number }[]> => {
    const dataPoints = await getEmployeeTimeSeries({
        startDate,
        endDate,
        metric,
        ...options
    });

    // 統計分佈
    const distribution = new Map<number | string, number>();
    dataPoints.forEach(point => {
        const current = distribution.get(point.value) || 0;
        distribution.set(point.value, current + 1);
    });

    return Array.from(distribution.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => {
            if (typeof a.value === 'number' && typeof b.value === 'number') {
                return a.value - b.value;
            }
            return 0;
        });
};

/**
 * 員工每日紀錄查詢 (使用 employeeDailyRecords collection)
 */
export const getEmployeeDailyMetrics = async (
    employeeId: string,
    startDate: string,
    endDate: string,
    metric: MetricType,
    options?: {
        dataSource?: 'minshi' | 'yishin' | 'combined';
        useAnalyzedData?: boolean;
    }
): Promise<TimeSeriesDataPoint[]> => {
    const { dataSource, useAnalyzedData = false } = options || {};

    try {
        const recordsRef = collection(db, 'employeeDailyRecords');
        let q = query(
            recordsRef,
            where('employeeId', '==', employeeId),
            where('date', '>=', startDate),
            where('date', '<=', endDate),
            orderBy('date', 'asc')
        );

        if (dataSource) {
            q = query(q, where('source', '==', dataSource));
        }

        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(doc => doc.data() as EmployeeDailyRecord);

        return records.map(record => {
            const empData = useAnalyzedData && record.analyzed41DaysData
                ? record.analyzed41DaysData
                : record.rawData;

            const value = empData[metric as keyof EmployeeData];

            return {
                date: record.date,
                employeeId: record.employeeId,
                employeeName: record.employeeName,
                value: value as number | string,
                metric
            };
        });
    } catch (error) {
        console.error('查詢員工每日紀錄失敗:', error);
        throw new Error('查詢員工每日紀錄失敗');
    }
};
