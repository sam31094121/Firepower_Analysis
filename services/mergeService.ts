/**
 * mergeService.ts
 * 雙軌數據合併服務：
 *   來源 A（orders/) + 來源 B（dispatches/）
 *   → C 表（dailyStats/{date}_{empId}）
 *
 * 與舊 employeeDailyRecords 完全分離，雙軌並行互不干擾。
 */
import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    writeBatch,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Order, Dispatch } from '../types';
import { getAllEmployeeProfilesDB } from './dbService';

// ── Collection 名稱 ────────────────────────────────────────────
const COL_ORDERS = 'orders';
const COL_DISPATCHES = 'dispatches';
const COL_DAILY_STATS = 'dailyStats';  // C 表（新 collection）

// ── C 表的資料結構 ─────────────────────────────────────────────
export interface DailyStat {
    id: string;                  // {date}_{empId}
    date: string;                // YYYY-MM-DD
    empId: string;
    empName: string;             // 以 dispatches 紀錄為準（有對應名字）
    totalDispatches: number;     // 來源 B 派單數(分母)
    totalSales: number;          // 所有單據加總(原值)
    dispatchSales: number;       // 僅限派單(成功)的數量
    followupSales: number;       // 追單數量
    renewalSales: number;        // 續單數量
    followupRevenue: number;     // 追單總業績
    renewalRevenue: number;      // 續單總業績
    yishinRevenue: number;       // 三立奕心業績
    minshiRevenue: number;       // 民視商品業績
    companyRevenue: number;      // 公司商品業績
    giftCount: number;           // 贈品數量
    otherRevenue: number;        // 其他業績
    conversionRate: number;      // dispatchSales / totalDispatches（0 to 1）
    totalRevenue: number;        // sum(A.amount)
    avgOrderValue: number;       // totalRevenue / totalSales
    productBreakdown: Record<string, number>;  // { A類: 2, B類: 1 }
    orderIds: string[];          // 關聯的訂單編號（可反查 A 表）
    mergedAt: string;            // 合併時間戳
}

// ── 主合併函數 ─────────────────────────────────────────────────

/**
 * 對指定日期區間執行 A+B 合併，結果寫入 dailyStats/
 * @param startDate YYYY-MM-DD
 * @param endDate   YYYY-MM-DD
 * @returns 合併完成的 DailyStat 陣列
 */
export const mergeAndSave = async (
    startDate: string,
    endDate: string
): Promise<DailyStat[]> => {

    // 0. 拉取員工設定，建立別名對應與顯示名稱對應表
    const profiles = await getAllEmployeeProfilesDB();
    const aliasMap = new Map<string, { id: string, name: string, displayName?: string }>();
    const profileMap = new Map<string, { id: string, name: string, displayName?: string }>();
    profiles.forEach(p => {
        const info = { id: p.id, name: p.name, displayName: p.displayName };
        profileMap.set(p.id, info);
        aliasMap.set(p.name, info);
        if ((p as any).aliases) {
            (p as any).aliases.forEach((a: string) => aliasMap.set(a, info));
        }
    });

    // 1. 拉取 A 表（訂單）
    const orderSnap = await getDocs(
        query(
            collection(db, COL_ORDERS),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        )
    );
    const orders = orderSnap.docs
        .map(d => d.data() as Order)
        .filter(o => {
            // 過濾掉拒收與取消（可能存在於 orderStatus 或舊版的 rawData['收貨確認']）
            const status = o.orderStatus || (o.rawData && o.rawData['收貨確認']) || '';
            return !status.includes('拒收') && !status.includes('取消');
        });

    // 2. 拉取 B 表（派單）
    const dispatchSnap = await getDocs(
        query(
            collection(db, COL_DISPATCHES),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        )
    );
    const dispatches = dispatchSnap.docs.map(d => d.data() as Dispatch);

    // 3. 以 (date × empId) 建立 B 表 map
    const dispatchMap = new Map<string, Dispatch>();
    dispatches.forEach(d => {
        dispatchMap.set(`${d.date}_${d.empId}`, d);
    });

    // 4. 從 A 表聚合前，先依據最新的 aliasMap 重新矯正 orders 的 empId
    // 因為若使用者剛剛把「新人王珍珠」加入了珍珠的別名，舊的 order 裡 empId 可能是 __unknown__ 或是錯的。
    orders.forEach(o => {
        const match = aliasMap.get(o.rawName);
        if (match) {
            o.empId = match.id;
        }
    });

    const orderGroups = new Map<string, Order[]>();
    orders.forEach(o => {
        const key = `${o.date}_${o.empId}`;
        if (!orderGroups.has(key)) orderGroups.set(key, []);
        orderGroups.get(key)!.push(o);
    });

    // 5. 合併所有 key（A ∪ B 的 date×empId 聯集）
    const allKeys = new Set([
        ...orderGroups.keys(),
        ...[...dispatchMap.keys()],
    ]);

    const now = new Date().toISOString();
    const stats: DailyStat[] = [];

    for (const key of allKeys) {
        const [date, ...empParts] = key.split('_');
        const empId = empParts.join('_');  // empId 本身可能含 _

        const dispatch = dispatchMap.get(key);
        const empOrders = orderGroups.get(key) || [];

        const totalDispatches = dispatch?.totalDispatches ?? 0;

        // 判斷 displayName 或 fallback 名稱
        const profileInfo = profileMap.get(empId);
        const rawNameFound = empOrders.find(o => o.rawName?.trim())?.rawName || '';
        const defaultName = (dispatch?.empName?.trim()) || rawNameFound || '未知(空名稱)';
        const empName = profileInfo ? (profileInfo.displayName || profileInfo.name) : defaultName;

        const totalSales = empOrders.length;
        const totalRevenue = empOrders.reduce((s, o) => s + (o.amount || 0), 0);

        // 如果這個人是未知人員、也沒有配對到派單，而且連業績都是 0，通常代表那是匯入時沒有刪乾淨的空白行或無效單
        if (empId === '__unknown__' && totalDispatches === 0 && totalRevenue === 0) {
            continue;
        }

        let dispatchSales = 0;
        let followupSales = 0;
        let renewalSales = 0;
        let followupRevenue = 0;
        let renewalRevenue = 0;

        // Phase 4 頻道業績
        let yishinRevenue = 0;
        let minshiRevenue = 0;
        let companyRevenue = 0;
        let otherRevenue = 0;
        let giftCount = 0;

        empOrders.forEach(o => {
            const type = o.orderType || '';
            const amt = o.amount || 0;
            const ds = o.dataSource || 'other';
            if (type.includes('派單')) {
                dispatchSales++;
            } else if (type.includes('追單')) {
                followupSales++;
                followupRevenue += amt;
            } else if (type.includes('續單')) {
                renewalSales++;
                renewalRevenue += amt;
            } else {
                // 如果是其他單據，預設算入派單嗎？
                // 通常如果沒有特別寫，或寫一般單據，可能看團隊定義。
                // 若只認明確字眼，這裡先算 dispatcher? 保險起見若沒有明顯字眼，暫時都歸派單。
                // 為了避免漏算，我們先把非「追單、續單、退單」的都算作 dispatchSales。
                if (!type.includes('退')) {
                    dispatchSales++;
                }
            }

            // Phase 4: 依據 dataSource 歸類業績 (退單若是負數也照加，贈品只記數量)
            if (ds === 'gift') {
                giftCount++;
            } else if (ds === 'yishin') {
                yishinRevenue += amt;
            } else if (ds === 'minshi') {
                minshiRevenue += amt;
            } else if (ds === 'company') {
                companyRevenue += amt;
            } else {
                otherRevenue += amt;
            }
        });

        // 派單均價 = (總業績 - 追單業績 - 續單業績) / 派成數
        const dispatchRevenue = totalRevenue - followupRevenue - renewalRevenue;
        const avgOrderValue = dispatchSales > 0 ? Math.round(dispatchRevenue / dispatchSales) : 0;
        const conversionRate = totalDispatches > 0 ? dispatchSales / totalDispatches : 0;

        // 商品類別分佈
        const productBreakdown: Record<string, number> = {};
        empOrders.forEach(o => {
            const cat = o.productCategory || '未分類';
            productBreakdown[cat] = (productBreakdown[cat] || 0) + 1;
        });

        const stat: DailyStat = {
            id: key,
            date,
            empId,
            empName,
            totalDispatches,
            totalSales,
            dispatchSales,
            followupSales,
            renewalSales,
            followupRevenue,
            renewalRevenue,
            yishinRevenue,
            minshiRevenue,
            companyRevenue,
            giftCount,
            otherRevenue,
            conversionRate,
            totalRevenue,
            avgOrderValue,
            productBreakdown,
            orderIds: empOrders.map(o => o.orderId),
            mergedAt: now,
        };
        stats.push(stat);
    }

    // 5.5 清除該區間舊的合併資料，避免改名/合併後舊 ID (如 {date}_林佩君;鄭上官) 殘留
    const oldStatsSnap = await getDocs(
        query(
            collection(db, COL_DAILY_STATS),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        )
    );

    const operations: { type: 'delete' | 'set', ref: any, data?: any }[] = [];

    oldStatsSnap.forEach(d => {
        operations.push({ type: 'delete', ref: doc(db, COL_DAILY_STATS, d.id) });
    });

    stats.forEach(s => {
        operations.push({ type: 'set', ref: doc(db, COL_DAILY_STATS, s.id), data: s });
    });

    // 6. 批量寫入 C 表（dailyStats/)
    const BATCH_SIZE = 400;
    for (let i = 0; i < operations.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        operations.slice(i, i + BATCH_SIZE).forEach(op => {
            if (op.type === 'delete') {
                batch.delete(op.ref);
            } else {
                batch.set(op.ref, op.data);
            }
        });
        await batch.commit();
    }

    return stats;
};

/**
 * 查詢 C 表特定日期區間的合併數據
 */
export const getDailyStats = async (
    startDate: string,
    endDate: string
): Promise<DailyStat[]> => {
    const snap = await getDocs(
        query(
            collection(db, COL_DAILY_STATS),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        )
    );
    return snap.docs.map(d => d.data() as DailyStat);
};

/**
 * 查詢 C 表在指定年月有哪些日期包含合併數據 (用於月曆顯示)
 * @param yearMonth YYYY-MM
 */
export const getAvailableIntegratedDates = async (yearMonth: string): Promise<string[]> => {
    const startDate = `${yearMonth}-01`;
    const endDate = `${yearMonth}-31`;

    const snap = await getDocs(
        query(
            collection(db, COL_DAILY_STATS),
            where('date', '>=', startDate),
            where('date', '<=', endDate)
        )
    );

    const dates = snap.docs.map(d => (d.data() as DailyStat).date);
    return [...new Set(dates)].sort();
};
