
import { HistoryRecord } from "../types";

const DB_NAME = "MarketingFirepowerDB";
const STORE_NAME = "history";
const DB_VERSION = 2; // 提升版本以確保 Store 被正確創建

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
        console.log("Database ObjectStore created successfully.");
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = (event) => {
      console.error("IndexedDB Open Error:", event);
      reject("無法開啟資料庫");
    };
  });
};

export const saveRecordDB = async (record: HistoryRecord): Promise<void> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    
    // 確保數據可以被複製 (深拷貝以避免 Proxy 錯誤)
    const clonedRecord = JSON.parse(JSON.stringify(record));
    const request = store.put(clonedRecord);
    
    request.onsuccess = () => {
      console.log("Record saved to DB:", record.title);
      resolve();
    };
    
    request.onerror = (event) => {
      console.error("Save Error:", event);
      reject("儲存失敗");
    };
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
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject("刪除失敗");
  });
};
