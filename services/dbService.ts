
import { HistoryRecord, EmployeeProfile, EmployeeDailyRecord } from "../types";

const DB_NAME = "MarketingFirepowerDB";
const STORE_NAME = "history";
const STORE_EMPLOYEE_PROFILES = "employeeProfiles";
const STORE_EMPLOYEE_DAILY_RECORDS = "employeeDailyRecords";
const DB_VERSION = 4; // 提升版本以新增員工相關 stores

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // 歷史紀錄 store
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
        console.log("IndexedDB: history store created.");
      }

      // 員工檔案 store
      if (!db.objectStoreNames.contains(STORE_EMPLOYEE_PROFILES)) {
        db.createObjectStore(STORE_EMPLOYEE_PROFILES, { keyPath: "id" });
        console.log("IndexedDB: employeeProfiles store created.");
      }

      // 員工每日紀錄 store
      if (!db.objectStoreNames.contains(STORE_EMPLOYEE_DAILY_RECORDS)) {
        const store = db.createObjectStore(STORE_EMPLOYEE_DAILY_RECORDS, { keyPath: "id" });
        store.createIndex("employeeId", "employeeId", { unique: false });
        store.createIndex("date", "date", { unique: false });
        console.log("IndexedDB: employeeDailyRecords store created.");
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("IndexedDB: Open Error", event);
      reject("無法開啟資料庫");
    };
  });
};

export const saveRecordDB = async (record: HistoryRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);

      // 深拷貝確保數據純淨
      const clonedRecord = JSON.parse(JSON.stringify(record));
      const request = store.put(clonedRecord);

      transaction.oncomplete = () => {
        console.log("IndexedDB: Transaction complete, saved:", record.title);
        resolve();
      };

      transaction.onerror = (event) => {
        console.error("IndexedDB: Transaction Error", event);
        reject("交易執行失敗");
      };

      request.onerror = (event) => {
        console.error("IndexedDB: Request Error", event);
        reject("寫入請求失敗");
      };
    } catch (e) {
      console.error("IndexedDB: Save Exception", e);
      reject(e);
    }
  });
};

export const getAllRecordsDB = async (): Promise<HistoryRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject("載入歷史紀錄失敗");
  });
};

export const deleteRecordDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("刪除失敗");
  });
};

export const clearAllRecordsDB = async (): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("清空資料庫失敗");
  });
};

// 根據歸檔日期查詢紀錄（YYYY-MM-DD）
export const getRecordByDateDB = async (
  archiveDate: string,
  dataSource?: 'minshi' | 'yishin' | 'combined'
): Promise<HistoryRecord | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records: HistoryRecord[] = request.result || [];
      const found = records.find(r => {
        const dateMatch = r.archiveDate === archiveDate;
        if (!dataSource) return dateMatch;
        return dateMatch && r.dataSource === dataSource;
      });
      resolve(found || null);
    };
    request.onerror = () => reject("查詢失敗");
  });
};

// 查詢日期範圍內的紀錄（startDate 到 endDate，含首尾）
export const getRecordsInRangeDB = async (startDate: string, endDate: string): Promise<HistoryRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const records: HistoryRecord[] = request.result || [];
      const filtered = records.filter(r => {
        if (!r.archiveDate) return false;
        return r.archiveDate >= startDate && r.archiveDate <= endDate;
      });
      resolve(filtered.sort((a, b) => (b.archiveDate || '').localeCompare(a.archiveDate || '')));
    };
    request.onerror = () => reject("範圍查詢失敗");
  });
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
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_PROFILES, "readwrite");
    const store = transaction.objectStore(STORE_EMPLOYEE_PROFILES);
    const request = store.add(profile);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("建立員工檔案失敗");
  });
};

export const updateEmployeeProfileDB = async (profile: EmployeeProfile): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_PROFILES, "readwrite");
    const store = transaction.objectStore(STORE_EMPLOYEE_PROFILES);
    const request = store.put(profile);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("更新員工檔案失敗");
  });
};

export const getEmployeeProfileDB = async (id: string): Promise<EmployeeProfile | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_PROFILES, "readonly");
    const store = transaction.objectStore(STORE_EMPLOYEE_PROFILES);
    const request = store.get(id);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject("查詢員工檔案失敗");
  });
};

export const getAllEmployeeProfilesDB = async (): Promise<EmployeeProfile[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_PROFILES, "readonly");
    const store = transaction.objectStore(STORE_EMPLOYEE_PROFILES);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject("載入員工清單失敗");
  });
};

export const deleteEmployeeProfileDB = async (id: string): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_PROFILES, "readwrite");
    const store = transaction.objectStore(STORE_EMPLOYEE_PROFILES);
    const request = store.delete(id);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("刪除員工檔案失敗");
  });
};

// ==================== 員工每日紀錄管理函數 ====================

export const saveEmployeeDailyRecordDB = async (record: EmployeeDailyRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_DAILY_RECORDS, "readwrite");
    const store = transaction.objectStore(STORE_EMPLOYEE_DAILY_RECORDS);
    const request = store.put(record);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject("儲存員工每日紀錄失敗");
  });
};

export const getEmployeeDailyRecordsDB = async (
  employeeId: string,
  startDate: string,
  endDate: string
): Promise<EmployeeDailyRecord[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_DAILY_RECORDS, "readonly");
    const store = transaction.objectStore(STORE_EMPLOYEE_DAILY_RECORDS);
    const index = store.index("employeeId");
    const request = index.getAll(employeeId);

    request.onsuccess = () => {
      const records: EmployeeDailyRecord[] = request.result || [];
      const filtered = records.filter(r => r.date >= startDate && r.date <= endDate);
      resolve(filtered.sort((a, b) => b.date.localeCompare(a.date)));
    };
    request.onerror = () => reject("查詢員工每日紀錄失敗");
  });
};

export const getEmployeeLatestRecordDB = async (employeeId: string): Promise<EmployeeDailyRecord | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_EMPLOYEE_DAILY_RECORDS, "readonly");
    const store = transaction.objectStore(STORE_EMPLOYEE_DAILY_RECORDS);
    const index = store.index("employeeId");
    const request = index.getAll(employeeId);

    request.onsuccess = () => {
      const records: EmployeeDailyRecord[] = request.result || [];
      if (records.length === 0) {
        resolve(null);
      } else {
        const sorted = records.sort((a, b) => b.date.localeCompare(a.date));
        resolve(sorted[0]);
      }
    };
    request.onerror = () => reject("查詢員工最新紀錄失敗");
  });
};
