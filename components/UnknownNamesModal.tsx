import React, { useState } from 'react';
import { EmployeeProfile } from '../types';
import { createEmployeeProfileDB, updateEmployeeProfileDB } from '../services/dbService';

interface UnknownName {
    rawName: string;  // 原始人名
    source: string;   // 來源說明（e.g. 'EXCEL 訂單'）
}

interface Resolution {
    rawName: string;
    action: 'new' | 'merge' | 'skip';
    targetEmpId?: string;  // action = 'merge' 時
}

interface Props {
    unknownNames: UnknownName[];
    existingProfiles: EmployeeProfile[];
    onConfirm: (resolutions: Resolution[]) => void;
    onClose: () => void;
}

const UnknownNamesModal: React.FC<Props> = ({
    unknownNames,
    existingProfiles,
    onConfirm,
    onClose,
}) => {
    // 每個 unknownName 的選擇狀態：'new' | 'merge' | 'skip'
    const [choices, setChoices] = useState<Record<string, { action: 'new' | 'merge' | 'skip'; targetEmpId: string }>>(
        () => Object.fromEntries(unknownNames.map(u => [u.rawName, { action: 'skip', targetEmpId: '' }]))
    );
    const [saving, setSaving] = useState(false);

    const setAction = (rawName: string, action: 'new' | 'merge' | 'skip') => {
        setChoices(prev => ({ ...prev, [rawName]: { ...prev[rawName], action } }));
    };

    const setTarget = (rawName: string, targetEmpId: string) => {
        setChoices(prev => ({ ...prev, [rawName]: { ...prev[rawName], targetEmpId, action: 'merge' } }));
    };

    const handleConfirm = async () => {
        setSaving(true);
        const now = new Date().toISOString();

        try {
            for (const u of unknownNames) {
                const c = choices[u.rawName];
                if (c.action === 'new') {
                    // 新增員工 profile，並把 rawName 當正式名
                    const newProfile: EmployeeProfile = {
                        id: `emp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                        name: u.rawName,
                        status: 'active',
                        accountStatus: 'enabled',
                        joinDate: now.split('T')[0],
                        notes: `由訂單匯入自動建立（原始名：${u.rawName}）`,
                        createdAt: now,
                        updatedAt: now,
                    };
                    await createEmployeeProfileDB(newProfile);
                } else if (c.action === 'merge' && c.targetEmpId) {
                    // 把 rawName 加入現有員工的 aliases 陣列
                    const target = existingProfiles.find(p => p.id === c.targetEmpId);
                    if (target) {
                        const existing = (target as any).aliases || [];
                        if (!existing.includes(u.rawName)) {
                            const updated = { ...target, aliases: [...existing, u.rawName], updatedAt: now };
                            await updateEmployeeProfileDB(updated);
                        }
                    }
                }
                // 'skip' 就跳過，rowName 繼續存為 __unknown__
            }

            const resolutions: Resolution[] = unknownNames.map(u => ({
                rawName: u.rawName,
                action: choices[u.rawName].action,
                targetEmpId: choices[u.rawName].targetEmpId || undefined,
            }));

            onConfirm(resolutions);
        } catch (err) {
            console.error('UnknownNamesModal save error:', err);
            alert('儲存失敗，請重試。');
        } finally {
            setSaving(false);
        }
    };

    const allResolved = unknownNames.every(u => {
        const c = choices[u.rawName];
        return c.action === 'new' || (c.action === 'merge' && c.targetEmpId) || c.action === 'skip';
    });

    return (
        /* 背景遮罩 */
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
                {/* 標頭 */}
                <div className="px-8 pt-8 pb-4 flex items-start justify-between">
                    <div>
                        <h2 className="text-xl font-black text-slate-800">偵測到未知人名</h2>
                        <p className="text-sm text-slate-400 mt-1">請確認這些名字應歸屬於哪位員工</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 text-xl font-bold leading-none transition-colors"
                    >
                        ×
                    </button>
                </div>

                {/* 每個未知名字的選項 */}
                <div className="px-6 pb-4 space-y-4 max-h-[60vh] overflow-y-auto">
                    {unknownNames.map(u => {
                        const c = choices[u.rawName];
                        return (
                            <div key={u.rawName} className="bg-slate-50 rounded-2xl p-5">
                                <div className="flex items-center justify-between mb-4">
                                    <span className="text-lg font-black text-slate-800">「{u.rawName}」</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                        來源：{u.source}
                                    </span>
                                </div>

                                {/* 兩個選項卡 */}
                                <div className="grid grid-cols-2 gap-3">
                                    {/* 新增為新員工 */}
                                    <button
                                        type="button"
                                        onClick={() => setAction(u.rawName, 'new')}
                                        className={`rounded-xl p-4 border-2 transition-all text-center flex flex-col items-center gap-2
                      ${c.action === 'new'
                                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'}`}
                                    >
                                        {/* 人像 + 加號 圖示 */}
                                        <svg className="w-8 h-8 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zM4 19.235v-.11a6.375 6.375 0 0112.75 0v.109A12.318 12.318 0 0110.374 21c-2.331 0-4.512-.645-6.374-1.766z" />
                                        </svg>
                                        <span className="text-sm font-black">新增為新員工</span>
                                    </button>

                                    {/* 合併到現有員工 */}
                                    <div
                                        className={`rounded-xl border-2 transition-all overflow-hidden
                      ${c.action === 'merge'
                                                ? 'border-emerald-500 bg-emerald-50'
                                                : 'border-slate-200 bg-white hover:border-slate-300'}`}
                                    >
                                        <div className="p-4 flex flex-col items-center gap-2">
                                            <svg className="w-8 h-8 text-slate-400 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                            </svg>
                                            <span className={`text-sm font-black ${c.action === 'merge' ? 'text-emerald-700' : 'text-slate-500'}`}>
                                                合併到現有員工...
                                            </span>
                                        </div>
                                        {/* 下拉選單 */}
                                        <select
                                            value={c.targetEmpId}
                                            onChange={e => setTarget(u.rawName, e.target.value)}
                                            className="w-full border-t border-slate-200 bg-transparent px-4 py-2 text-sm text-slate-700 outline-none focus:bg-white cursor-pointer"
                                        >
                                            <option value="">選擇員工...</option>
                                            {existingProfiles
                                                .filter(p => p.status === 'active')
                                                .map(p => (
                                                    <option key={p.id} value={p.id}>{p.name}</option>
                                                ))}
                                        </select>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* 底部說明 + 確認 */}
                <div className="px-8 py-5 border-t border-slate-100 space-y-3">
                    <p className="text-center text-[11px] text-slate-400">
                        確認後，系統將自動記住別名，下次匯入將自動對應。
                    </p>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={saving}
                        className="w-full py-3 rounded-xl bg-slate-900 text-white font-black hover:bg-blue-600 transition-all shadow-lg active:scale-95 disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {saving ? (
                            <><div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /><span>儲存中...</span></>
                        ) : (
                            <span>確認</span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export { UnknownNamesModal };
export type { UnknownName, Resolution };
