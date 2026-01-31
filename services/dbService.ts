
import { HistoryRecord } from "../types";

const DB_NAME = "MarketingFirepowerDB";
const STORE_NAME = "history";
const DB_VERSION = 3; // 提升版本以確保全新 Store 初始化

let dbInstance: IDBDatabase | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) return resolve(dbInstance);

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
        console.log("IndexedDB: ObjectStore created.");
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
