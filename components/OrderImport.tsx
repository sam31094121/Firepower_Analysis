import React, { useState, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Order, ParsedOrderRow, EmployeeProfile } from '../types';
import { saveOrdersBatch } from '../services/orderService';
import { getAllEmployeeProfilesDB } from '../services/dbService';
import { UnknownNamesModal } from './UnknownNamesModal';

// 訂單系統 Excel 的標準表頭（28 欄）
const ORDER_HEADERS = [
    '訂單編號', '訂購人名稱', '住家電話', '公司電話', '行動電話一', '行動電話二', '住家地址',
    '出貨確認', '單據類型', '訂購日期', '宅配單號', '客戶編號', '送貨地址', '開立發票方式',
    '發票抬頭', '統編', '付款日期', '收貨確認', '到貨時間', '訂單備註', '行銷人員',
    '金額', '付款方式', '訂購產品', '商品類別', '數量', '小計金額', '備註'
];

interface Props {
    onImportSuccess?: (count: number) => void;
}

/** 將 Excel 序列日期或字串轉成 YYYY-MM-DD */
function parseDate(raw: any): string {
    if (!raw) return '';
    if (typeof raw === 'number') {
        const date = XLSX.SSF.parse_date_code(raw);
        if (date) {
            const y = date.y;
            const m = String(date.m).padStart(2, '0');
            const d = String(date.d).padStart(2, '0');
            return `${y}-${m}-${d}`;
        }
    }
    const str = String(raw).trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
    const slash = str.match(/^(\d{4})\/(\d{2})\/(\d{2})$/);
    if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`;
    return str;
}

const OrderImport: React.FC<Props> = ({ onImportSuccess }) => {
    const [isDragging, setIsDragging] = useState(false);
    const [parsedRows, setParsedRows] = useState<ParsedOrderRow[]>([]);
    const [status, setStatus] = useState<'idle' | 'parsing' | 'preview' | 'saving' | 'done'>('idle');
    const [saveMsg, setSaveMsg] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [profilesCache, setProfilesCache] = useState<EmployeeProfile[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // ── 從 parsedRows 取出未對應的人名清單 ───────────────────────────
    const getUnknownNames = (rows: ParsedOrderRow[]) => [
        ...new Set(
            rows
                .filter(r => r.isValid && r.empId === '__unknown__' && r.rawName)
                .map(r => r.rawName)
        )
    ];

    // ── 解析 Excel 檔案 ──────────────────────────────────────────────
    const parseFile = useCallback(async (file: File) => {
        setStatus('parsing');
        setParsedRows([]);
        setSaveMsg('');

        try {
            // 先拉員工 profiles，建立 alias → { empId, name } 的對應表
            const profiles = await getAllEmployeeProfilesDB();
            const aliasMap: Record<string, { id: string; name: string }> = {};
            profiles.forEach(p => {
                aliasMap[p.name] = { id: p.id, name: p.name };
                ((p as any).aliases || []).forEach((a: string) => {
                    aliasMap[a] = { id: p.id, name: p.name };
                });
            });

            const buf = await file.arrayBuffer();
            const wb = XLSX.read(buf, { type: 'array', cellDates: false });
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

            if (rawRows.length < 2) {
                alert('Excel 內容為空或缺少資料列。');
                setStatus('idle');
                return;
            }

            // 建立欄位 index map
            const headerRow = rawRows[0].map((h: any) => String(h).trim());
            const idx = (col: string) => headerRow.indexOf(col);

            const rows: ParsedOrderRow[] = rawRows.slice(1)
                .filter(row => row.some((cell: any) => cell !== '' && cell !== null))
                .map(row => {
                    const raw: Record<string, any> = {};
                    ORDER_HEADERS.forEach(h => { raw[h] = row[idx(h)] ?? ''; });

                    const orderId = String(raw['訂單編號'] || '').trim();
                    const orderType = String(raw['單據類型'] || '').trim();
                    const orderStatus = String(raw['收貨確認'] || '').trim();
                    const date = parseDate(raw['訂購日期']);
                    const rawName = String(raw['行銷人員'] || '').trim();
                    const amount = parseFloat(String(raw['金額'] || '0').replace(/[^0-9.-]/g, '')) || 0;
                    const product = String(raw['訂購產品'] || '').trim();
                    const productCategory = String(raw['商品類別'] || '').trim();

                    // 檢查被忽略的狀態
                    if (orderStatus.includes('拒收') || orderStatus.includes('取消')) {
                        return null; // 回傳 null 稍後過濾掉
                    }

                    // 在預覽時就做 alias 對應
                    const matched = aliasMap[rawName];
                    const empId = matched ? matched.id : '__unknown__';
                    const empName = matched ? matched.name : '';

                    // 基本驗證
                    const isValid = !!orderId && !!date && date.length === 10;
                    let warning: string | undefined;
                    if (!isValid) {
                        warning = !orderId ? '缺少訂單編號' : '日期格式錯誤';
                    } else if (!rawName) {
                        warning = '⚠️ 行銷人員為空';
                    } else if (!matched) {
                        warning = `❓ 找不到員工：${rawName}`;
                    }

                    // 辨識商品類別歸屬
                    let dataSource: 'yishin' | 'minshi' | 'company' | 'gift' | 'other' = 'other';
                    const catLower = productCategory.toLowerCase();
                    const prodLower = product.toLowerCase();
                    const textToSearch = `${catLower} ${prodLower}`;

                    if (textToSearch.includes('贈品')) {
                        dataSource = 'gift';
                    } else if (textToSearch.includes('三立') || textToSearch.includes('奕心')) {
                        dataSource = 'yishin';
                    } else if (textToSearch.includes('民視')) {
                        dataSource = 'minshi';
                    } else if (textToSearch.includes('公司')) {
                        dataSource = 'company';
                    }

                    const result: ParsedOrderRow = { raw, orderId, orderType, orderStatus, date, rawName, amount, product, productCategory, dataSource, isValid, empId, empName };
                    if (warning) result.warning = warning;
                    return result;
                })
                .filter((r): r is ParsedOrderRow => r !== null);

            setParsedRows(rows);
            setProfilesCache(profiles); // 快取，modal 用
            setStatus('preview');

            // 解析到有未知人名時，自動彈出 modal
            const unknowns = rows.filter(r => r.isValid && r.empId === '__unknown__' && r.rawName);
            if (unknowns.length > 0) setShowModal(true);
        } catch (err) {
            console.error('Excel parse error:', err);
            alert('Excel 解析失敗，請確認格式是否正確。');
            setStatus('idle');
        }
    }, []);

    // ── 拖曳事件 ────────────────────────────────────────────────────
    const onDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) parseFile(file);
    }, [parseFile]);

    // ── Modal 確認：更新 parsedRows 的 empId/empName ─────────────────
    const handleModalConfirm = async (resolutions: { rawName: string; action: string; targetEmpId?: string }[]) => {
        setShowModal(false);
        // 重新拉 profiles（可能剛新增了新員工）
        const freshProfiles = await getAllEmployeeProfilesDB();
        setProfilesCache(freshProfiles);

        // 重建 aliasMap
        const aliasMap: Record<string, { id: string; name: string }> = {};
        freshProfiles.forEach(p => {
            aliasMap[p.name] = { id: p.id, name: p.name };
            ((p as any).aliases || []).forEach((a: string) => {
                aliasMap[a] = { id: p.id, name: p.name };
            });
        });

        // 更新 parsedRows
        setParsedRows(prev => prev.map(r => {
            const m = aliasMap[r.rawName];
            return m ? { ...r, empId: m.id, empName: m.name, warning: undefined } : r;
        }));
    };

    // ── 確認匯入 → 寫入 Firestore ───────────────────────────────────
    const handleSave = async () => {
        const validRows = parsedRows.filter(r => r.isValid);
        if (validRows.length === 0) { alert('沒有可匯入的有效資料。'); return; }

        setStatus('saving');
        try {
            const now = new Date().toISOString();
            const orders: Order[] = validRows.map(r => ({
                orderId: r.orderId,
                orderType: r.orderType,
                orderStatus: r.orderStatus,
                date: r.date,
                empId: r.empId,     // 已在解析時對應好
                rawName: r.rawName,
                amount: r.amount,
                product: r.product,
                productCategory: r.productCategory,
                dataSource: r.dataSource,
                rawData: r.raw,
                importedAt: now,
            }));

            const { duplicates } = await saveOrdersBatch(orders);

            const unknownNames = [...new Set(
                orders.filter(o => o.empId === '__unknown__').map(o => o.rawName).filter(Boolean)
            )];

            let msg = `✅ 成功匯入 ${orders.length} 筆訂單`;
            if (duplicates.length > 0) msg += `\n⚠️ ${duplicates.length} 筆重複（已覆蓋）`;
            if (unknownNames.length > 0) msg += `\n❓ 未對應人名（已存入，empId=__unknown__）：${unknownNames.join('、')}`;

            setSaveMsg(msg);
            setStatus('done');
            onImportSuccess?.(orders.length);
        } catch (err) {
            console.error('Save error:', err);
            alert('寫入 Firestore 失敗，請確認網路連線。');
            setStatus('preview');
        }
    };

    const reset = () => {
        setParsedRows([]);
        setStatus('idle');
        setSaveMsg('');
    };

    // ── 統計 ─────────────────────────────────────────────────────────
    const validCount = parsedRows.filter(r => r.isValid).length;
    const invalidCount = parsedRows.length - validCount;
    const unknownCount = parsedRows.filter(r => r.isValid && r.empId === '__unknown__').length;
    const matchedCount = parsedRows.filter(r => r.isValid && r.empId !== '__unknown__').length;
    const unknownNamesList = getUnknownNames(parsedRows);

    return (
        <div className="space-y-4">

            {/* 未知人名 Modal */}
            {showModal && unknownNamesList.length > 0 && (
                <UnknownNamesModal
                    unknownNames={unknownNamesList.map(n => ({ rawName: n, source: 'EXCEL 訂單' }))}
                    existingProfiles={profilesCache}
                    onConfirm={handleModalConfirm}
                    onClose={() => setShowModal(false)}
                />
            )}

            {/* 拖曳上傳區 */}
            {(status === 'idle' || status === 'parsing') && (
                <div
                    className={`border-4 border-dashed rounded-2xl p-12 text-center transition-all relative min-h-[220px] flex flex-col items-center justify-center
            ${isDragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-blue-50/30'}`}
                    onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={onDrop}
                >
                    <input
                        ref={fileRef}
                        type="file"
                        accept=".xlsx,.xls"
                        className="absolute inset-0 opacity-0 cursor-pointer z-10"
                        onChange={e => e.target.files?.[0] && parseFile(e.target.files[0])}
                    />
                    {status === 'parsing' ? (
                        <div className="flex flex-col items-center gap-3 pointer-events-none">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                            <p className="text-sm font-black text-slate-600 uppercase">解析 Excel + 比對員工中...</p>
                        </div>
                    ) : (
                        <div className="pointer-events-none">
                            <div className="text-5xl mb-4">📊</div>
                            <p className="text-sm font-black text-slate-600 uppercase tracking-widest">拖曳訂單 Excel 到此</p>
                            <p className="text-[11px] text-slate-400 mt-2">支援 .xlsx / .xls・解析後立即顯示員工對應結果</p>
                        </div>
                    )}
                </div>
            )}

            {/* 預覽結果 */}
            {(status === 'preview' || status === 'saving' || status === 'done') && (
                <div className="space-y-4">
                    {/* 摘要統計 */}
                    <div className="grid grid-cols-4 gap-2">
                        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
                            <div className="text-2xl font-black text-emerald-600">{matchedCount}</div>
                            <div className="text-[10px] text-emerald-500 font-bold">✅ 成功對應</div>
                        </div>
                        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
                            <div className="text-2xl font-black text-amber-500">{unknownCount}</div>
                            <div className="text-[10px] text-amber-500 font-bold">❓ 未對應員工</div>
                        </div>
                        <div className="bg-slate-50 rounded-xl p-3 text-center border border-slate-200">
                            <div className="text-2xl font-black text-slate-600">{validCount}</div>
                            <div className="text-[10px] text-slate-500 font-bold">📋 有效筆數</div>
                        </div>
                        <div className="bg-red-50 rounded-xl p-3 text-center border border-red-100">
                            <div className="text-2xl font-black text-red-400">{invalidCount}</div>
                            <div className="text-[10px] text-red-400 font-bold">❌ 無效跳過</div>
                        </div>
                    </div>

                    {/* 預覽表格：重點放在「行銷人員 → 對應員工」 */}
                    <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-80">
                        <table className="w-full text-[11px] border-collapse min-w-[750px]">
                            <thead className="sticky top-0 bg-slate-900 text-white">
                                <tr>
                                    {['#', '狀態', '訂單編號', '訂單狀態', '單據類型', '訂購日期', '行銷人員 (原始)', '→ 對應員工', '金額', '商品類別'].map(h => (
                                        <th key={h} className="px-3 py-2 font-black text-left whitespace-nowrap text-[10px]">{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {parsedRows.map((r, i) => {
                                    const isUnknown = r.isValid && r.empId === '__unknown__' && r.rawName;
                                    return (
                                        <tr key={i} className={
                                            !r.isValid ? 'bg-red-50' :
                                                isUnknown ? 'bg-amber-50' : 'hover:bg-slate-50'
                                        }>
                                            <td className="px-3 py-1.5 text-slate-400 font-mono">{i + 1}</td>
                                            <td className="px-3 py-1.5 font-bold text-base leading-none">
                                                {!r.isValid ? '❌' : isUnknown ? '⚠️' : '✅'}
                                            </td>
                                            <td className="px-3 py-1.5 font-mono text-slate-600 text-[10px]">{r.orderId || '—'}</td>
                                            <td className="px-3 py-1.5 text-slate-500">
                                                <span className={`px-2 py-0.5 rounded ${r.orderStatus.includes('收貨') ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                                    }`}>
                                                    {r.orderStatus || '-'}
                                                </span>
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-500">{r.orderType || '—'}</td>
                                            <td className="px-3 py-1.5">{r.date || '—'}</td>
                                            {/* 原始行銷人員名稱 */}
                                            <td className="px-3 py-1.5 font-bold text-slate-700">{r.rawName || <span className="text-slate-300">（空）</span>}</td>
                                            {/* 對應結果 */}
                                            <td className="px-3 py-1.5">
                                                {!r.isValid ? (
                                                    <span className="text-red-400 text-[10px]">{r.warning}</span>
                                                ) : r.empId === '__unknown__' ? (
                                                    <span className="text-amber-500 font-bold">❓ 找不到</span>
                                                ) : (
                                                    <span className="text-emerald-600 font-black">✅ {r.empName}</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-1.5 text-right text-blue-600 font-bold whitespace-nowrap">
                                                {r.amount > 0 ? `$${r.amount.toLocaleString()}` : '—'}
                                            </td>
                                            <td className="px-3 py-1.5 text-slate-500">{r.productCategory || '—'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* 匯入成功訊息 */}
                    {status === 'done' && saveMsg && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm font-bold text-emerald-700 whitespace-pre-line">
                            {saveMsg}
                        </div>
                    )}

                    {/* 操作按鈕 */}
                    <div className="flex gap-3 flex-wrap">
                        <button
                            type="button"
                            onClick={reset}
                            disabled={status === 'saving'}
                            className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black hover:border-slate-400 hover:text-slate-700 transition-all disabled:opacity-40"
                        >
                            🔄 重新上傳
                        </button>
                        {/* 有未對應名字時顯示處理按鈕 */}
                        {unknownCount > 0 && status !== 'done' && (
                            <button
                                type="button"
                                onClick={() => setShowModal(true)}
                                className="flex-1 py-3 rounded-xl border-2 border-amber-400 text-amber-600 font-black hover:bg-amber-50 transition-all"
                            >
                                ❓ 處理未知人名 ({unknownCount})
                            </button>
                        )}
                        {status !== 'done' && (
                            <button
                                type="button"
                                onClick={handleSave}
                                disabled={status === 'saving' || validCount === 0}
                                className="flex-[2] min-w-[180px] py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {status === 'saving' ? (
                                    <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /><span>寫入中...</span></>
                                ) : (
                                    <span>📥 確認匯入 {validCount} 筆</span>
                                )}
                            </button>
                        )}
                    </div>

                </div>
            )}
        </div>
    );
};

export default OrderImport;
