import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  writeBatch,
  limit
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { HistoryRecord, EmployeeProfile, EmployeeDailyRecord } from "../types";

// Collection 名稱
const COLLECTION_RECORDS = "records";
const COLLECTION_EMPLOYEE_PROFILES = "employeeProfiles";
const COLLECTION_EMPLOYEE_DAILY_RECORDS = "employeeDailyRecords";
const COLLECTION_DAILY_STATS = "dailyStats";

// ==================== 歷史記錄管理函數 ====================

export const saveRecordDB = async (record: HistoryRecord): Promise<void> => {
  try {
    const recordRef = doc(db, COLLECTION_RECORDS, record.id);

    // 清理資料:移除 undefined 值 (Firestore 不接受 undefined)
    const cleanRecord = JSON.parse(JSON.stringify(record, (key, value) => {
      return value === undefined ? null : value;
    }));

    await setDoc(recordRef, cleanRecord);
    console.log("Firestore: 記錄已儲存:", record.title);
  } catch (error) {
    console.error("Firestore: 儲存失敗", error);
    throw new Error("儲存記錄失敗");
  }
};

// 斷路器：如果資料庫連線失敗（例如未建立），則停止後續請求
let isDbConnectionWorking = true;

const handleFirestoreError = (error: any) => {
  if (error?.message?.includes('Database') && error?.message?.includes('not found')) {
    console.warn("⚠️ 偵測到 Firestore 資料庫尚未建立，已啟用斷路器停止後續請求。");
    isDbConnectionWorking = false;
  }
  return error;
};

export const getAllRecordsDB = async (): Promise<HistoryRecord[]> => {
  if (!isDbConnectionWorking) {
    console.warn("⚠️ 斷路器已啟動：跳過 Firestore 請求 (資料庫未建立)");
    return [];
  }

  try {
    const recordsRef = collection(db, COLLECTION_RECORDS);
    const snapshot = await getDocs(recordsRef);
    const records = snapshot.docs.map(doc => doc.data() as HistoryRecord);
    return records;
  } catch (error) {
    handleFirestoreError(error);
    console.error("Firestore: 載入記錄失敗", error);
    // 這裡我們不拋出錯誤，而是回傳空陣列，避免前端炸裂
    return [];
  }
};

export const deleteRecordDB = async (id: string, archiveDate?: string, dataSource?: string): Promise<void> => {
  try {
    const batch = writeBatch(db);

    // 1. 刪除主紀錄文件
    const recordRef = doc(db, COLLECTION_RECORDS, id);
    batch.delete(recordRef);

    // 2. 如果提供了日期與資料源，進行深層清理
    if (archiveDate && dataSource) {
      console.log(`Firestore: 開始深層清理日期 ${archiveDate} (${dataSource}) 的關連數據`);

      // 清理 employeeDailyRecords
      const employeeRecordsRef = collection(db, COLLECTION_EMPLOYEE_DAILY_RECORDS);
      const q1 = query(
        employeeRecordsRef,
        where("date", "==", archiveDate),
        where("source", "==", dataSource)
      );
      const snapshot1 = await getDocs(q1);
      snapshot1.docs.forEach(doc => batch.delete(doc.ref));

      // 如果是整合模式，清理 dailyStats (C表)
      if (dataSource === 'integrated' || dataSource === 'combined') {
        const dailyStatsRef = collection(db, COLLECTION_DAILY_STATS);
        const q2 = query(dailyStatsRef, where("date", "==", archiveDate));
        const snapshot2 = await getDocs(q2);
        snapshot2.docs.forEach(doc => batch.delete(doc.ref));
      }
    }

    await batch.commit();
    console.log("Firestore: 紀錄及其關連數據已刪除:", id);
  } catch (error) {
    console.error("Firestore: 刪除失敗", error);
    throw new Error("刪除失敗");
  }
};

/**
 * 徹底清空數據庫中與紀錄相關的所有動態數據
 * (用於 handleClearAll 或系統重置)
 */
export const clearDetailedDataDB = async (): Promise<void> => {
  const collectionsToClear = [
    COLLECTION_RECORDS,
    COLLECTION_EMPLOYEE_DAILY_RECORDS,
    COLLECTION_DAILY_STATS
  ];

  for (const colName of collectionsToClear) {
    try {
      const colRef = collection(db, colName);
      let hasMore = true;
      while (hasMore) {
        const q = query(colRef, limit(400));
        const snapshot = await getDocs(q);
        if (snapshot.empty) {
          hasMore = false;
          continue;
        }
        const batch = writeBatch(db);
        snapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
        console.log(`Firestore: 已清空 ${colName} 的 400 筆資料`);
      }
    } catch (error) {
      console.error(`Firestore: 清空 ${colName} 失敗:`, error);
    }
  }
};

export const clearAllRecordsDB = async (): Promise<void> => {
  try {
    const recordsRef = collection(db, COLLECTION_RECORDS);
    const snapshot = await getDocs(recordsRef);

    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log("Firestore: 所有記錄已清空");
  } catch (error) {
    console.error("Firestore: 清空失敗", error);
    throw new Error("清空資料庫失敗");
  }
};

export const getRecordByDateDB = async (
  archiveDate: string,
  dataSource?: 'minshi' | 'yishin' | 'combined' | 'integrated'
): Promise<HistoryRecord | null> => {
  try {
    const recordsRef = collection(db, COLLECTION_RECORDS);
    let q;

    if (dataSource) {
      q = query(
        recordsRef,
        where("archiveDate", "==", archiveDate),
        where("dataSource", "==", dataSource)
      );
    } else {
      q = query(recordsRef, where("archiveDate", "==", archiveDate));
    }

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as HistoryRecord;
  } catch (error) {
    console.error("Firestore: 查詢失敗", error);
    throw new Error("查詢失敗");
  }
};

// 查詢日期範圍內的紀錄（startDate 到 endDate，含首尾）
export const getRecordsInRangeDB = async (startDate: string, endDate: string): Promise<HistoryRecord[]> => {
  try {
    const recordsRef = collection(db, COLLECTION_RECORDS);
    const q = query(
      recordsRef,
      where("archiveDate", ">=", startDate),
      where("archiveDate", "<=", endDate),
      orderBy("archiveDate", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as HistoryRecord);
  } catch (error) {
    console.error("Firestore: 範圍查詢失敗", error);
    throw new Error("範圍查詢失敗");
  }
};

// 查詢最近41天紀錄（今天 + 過去40天）
export const getRecordsLast41DaysDB = async (): Promise<HistoryRecord[]> => {
  const today = new Date();
  const endDate = today.toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return getRecordsInRangeDB(startDate, endDate);
};

// ==================== 員工檔案管理函數 ====================

export const createEmployeeProfileDB = async (profile: EmployeeProfile): Promise<void> => {
  try {
    const profileRef = doc(db, COLLECTION_EMPLOYEE_PROFILES, profile.id);
    const cleanProfile = JSON.parse(JSON.stringify(profile, (key, value) => value === undefined ? null : value));
    await setDoc(profileRef, cleanProfile);
    console.log("Firestore: 員工檔案已建立:", profile.name);
  } catch (error) {
    console.error("Firestore: 建立員工檔案失敗", error);
    throw new Error("建立員工檔案失敗");
  }
};

export const updateEmployeeProfileDB = async (profile: EmployeeProfile): Promise<void> => {
  try {
    const profileRef = doc(db, COLLECTION_EMPLOYEE_PROFILES, profile.id);
    const cleanProfile = JSON.parse(JSON.stringify(profile, (key, value) => value === undefined ? null : value));
    await setDoc(profileRef, cleanProfile, { merge: true });
    console.log("Firestore: 員工檔案已更新:", profile.name);
  } catch (error) {
    console.error("Firestore: 更新員工檔案失敗", error);
    throw new Error("更新員工檔案失敗");
  }
};

export const getEmployeeProfileDB = async (id: string): Promise<EmployeeProfile | null> => {
  try {
    const profileRef = doc(db, COLLECTION_EMPLOYEE_PROFILES, id);
    const snapshot = await getDoc(profileRef);

    if (!snapshot.exists()) {
      return null;
    }

    return snapshot.data() as EmployeeProfile;
  } catch (error) {
    console.error("Firestore: 查詢員工檔案失敗", error);
    throw new Error("查詢員工檔案失敗");
  }
};

export const getAllEmployeeProfilesDB = async (): Promise<EmployeeProfile[]> => {
  try {
    const profilesRef = collection(db, COLLECTION_EMPLOYEE_PROFILES);
    const snapshot = await getDocs(profilesRef);
    return snapshot.docs.map(doc => doc.data() as EmployeeProfile);
  } catch (error) {
    console.error("Firestore: 載入員工清單失敗", error);
    throw new Error("載入員工清單失敗");
  }
};

export const deleteEmployeeProfileDB = async (id: string): Promise<void> => {
  try {
    const profileRef = doc(db, COLLECTION_EMPLOYEE_PROFILES, id);
    await deleteDoc(profileRef);
    console.log("Firestore: 員工檔案已刪除:", id);
  } catch (error) {
    console.error("Firestore: 刪除員工檔案失敗", error);
    throw new Error("刪除員工檔案失敗");
  }
};

// ==================== 員工每日紀錄管理函數 ====================

export const saveEmployeeDailyRecordDB = async (record: EmployeeDailyRecord): Promise<void> => {
  try {
    const recordRef = doc(db, COLLECTION_EMPLOYEE_DAILY_RECORDS, record.id);
    const cleanRecord = JSON.parse(JSON.stringify(record, (key, value) => value === undefined ? null : value));
    await setDoc(recordRef, cleanRecord);
  } catch (error) {
    console.error("Firestore: 儲存員工每日紀錄失敗", error);
    throw new Error("儲存員工每日紀錄失敗");
  }
};

export const getEmployeeDailyRecordsDB = async (
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeDailyRecord[]> => {
  try {
    const recordsRef = collection(db, COLLECTION_EMPLOYEE_DAILY_RECORDS);
    const q = query(
      recordsRef,
      where("employeeId", "==", employeeId),
      where("date", ">=", startDate),
      where("date", "<=", endDate),
      orderBy("date", "desc")
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as EmployeeDailyRecord);
  } catch (error) {
    console.error("Firestore: 查詢員工每日紀錄失敗", error);
    throw new Error("查詢員工每日紀錄失敗");
  }
};

export const getEmployeeLatestRecordDB = async (employeeId: string): Promise<EmployeeDailyRecord | null> => {
  try {
    const recordsRef = collection(db, COLLECTION_EMPLOYEE_DAILY_RECORDS);
    const q = query(
      recordsRef,
      where("employeeId", "==", employeeId),
      orderBy("date", "desc")
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return null;
    }

    return snapshot.docs[0].data() as EmployeeDailyRecord;
  } catch (error) {
    console.error("Firestore: 查詢員工最新紀錄失敗", error);
    throw new Error("查詢員工最新紀錄失敗");
  }
};

// 保留舊的 initDB 函數以向下相容（但實際上不需要初始化）
export const initDB = async (): Promise<any> => {
  console.log("Firestore: 使用雲端資料庫,無需初始化");
  return Promise.resolve(null);
};
