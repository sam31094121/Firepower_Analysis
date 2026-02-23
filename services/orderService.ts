import {
    collection,
    doc,
    setDoc,
    getDocs,
    query,
    where,
    writeBatch,
    getDoc
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { Order, Dispatch } from '../types';

const COL_ORDERS = 'orders';
const COL_DISPATCHES = 'dispatches';

// ==================== 訂單（來源 A）====================

/**
 * 批量儲存訂單到 Firestore。
 * 若訂單編號已存在，覆蓋（依使用者設定：發出警告但允許覆蓋）。
 * @returns 回傳重複的 orderId 清單（給前端顯示警告）
 */
export const saveOrdersBatch = async (
    orders: Order[]
): Promise<{ duplicates: string[] }> => {
    if (orders.length === 0) return { duplicates: [] };

    // 先批次查重（抓出哪些 orderId 已存在）
    const existingIds = new Set<string>();
    for (const order of orders) {
        const ref = doc(db, COL_ORDERS, order.orderId);
        const snap = await getDoc(ref);
        if (snap.exists()) existingIds.add(order.orderId);
    }

    // 批量寫入（Firestore writeBatch 上限 500 筆）
    const BATCH_SIZE = 400;
    for (let i = 0; i < orders.length; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        orders.slice(i, i + BATCH_SIZE).forEach(order => {
            const ref = doc(db, COL_ORDERS, order.orderId);
            batch.set(ref, order); // 覆蓋已有資料
        });
        await batch.commit();
    }

    return { duplicates: [...existingIds] };
};

/**
 * 查詢特定日期範圍內的訂單
 */
export const getOrdersByDateRange = async (
    startDate: string,
    endDate: string
): Promise<Order[]> => {
    const ref = collection(db, COL_ORDERS);
    const q = query(
        ref,
        where('date', '>=', startDate),
        where('date', '<=', endDate)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Order);
};

// ==================== 派單紀錄（來源 B）====================

/**
 * 儲存（或更新）單筆派單紀錄
 */
export const saveDispatch = async (dispatch: Dispatch): Promise<void> => {
    const ref = doc(db, COL_DISPATCHES, dispatch.id);
    await setDoc(ref, dispatch, { merge: true });
};

/**
 * 批量儲存派單紀錄
 */
export const saveDispatchesBatch = async (dispatches: Dispatch[]): Promise<void> => {
    if (dispatches.length === 0) return;
    const batch = writeBatch(db);
    dispatches.forEach(d => {
        const ref = doc(db, COL_DISPATCHES, d.id);
        batch.set(ref, d, { merge: true });
    });
    await batch.commit();
};

/**
 * 查詢特定日期的派單紀錄
 */
export const getDispatchesByDate = async (date: string): Promise<Dispatch[]> => {
    const ref = collection(db, COL_DISPATCHES);
    const q = query(ref, where('date', '==', date));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as Dispatch);
};
