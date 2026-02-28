import React, { useState } from 'react';
import { ValidationResult, ValidationError } from '../types';

interface Props {
    result: ValidationResult;
    onClose: () => void;
    onContinue: () => void;
    onResolveOverflow?: (warnings: ValidationError[]) => void;
    isResolving?: boolean;
}

const ValidationModal: React.FC<Props> = ({ result, onClose, onContinue, onResolveOverflow, isResolving = false }) => {
    const { errors, warnings, infos } = result;
    const hasErrors = errors.length > 0;

    // Check if we have any overflow warnings that can be resolved
    const overflowWarnings = warnings.filter(w => w.overflowSales && w.overflowSales > 0);
    const hasOverflow = overflowWarnings.length > 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-700 px-6 py-4">
                    <h2 className="text-xl font-black text-white flex items-center gap-3">
                        {hasErrors ? '⚠️' : '✅'} 資料驗證結果
                    </h2>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* 錯誤 */}
                    {hasErrors && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-red-600 uppercase tracking-wider">
                                    嚴重錯誤 ({errors.length} 項) - 必須修正
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {errors.map((err, idx) => (
                                    <div key={idx} className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
                                        <div className="flex items-start gap-3">
                                            <span className="text-red-600 font-black text-lg">🔴</span>
                                            <div className="flex-1">
                                                <div className="text-xs text-red-600 font-bold mb-1">
                                                    第 {err.row} 列 {err.employeeName && `「${err.employeeName}」`} - {err.field}
                                                </div>
                                                <div className="text-sm text-red-800 font-medium">{err.message}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 警告 & 溢單回溯提示 */}
                    {warnings.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-yellow-600 uppercase tracking-wider">
                                    警告與溢單提示 ({warnings.length} 項)
                                </h3>
                            </div>
                            <div className="space-y-3">
                                {warnings.map((warn, idx) => {
                                    const isOverflow = warn.overflowSales && warn.overflowSales > 0;

                                    if (isOverflow) {
                                        return (
                                            <div key={idx} className="bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-500 p-5 rounded-r-xl shadow-sm relative overflow-hidden">
                                                {/* 裝飾背景 */}
                                                <div className="absolute right-0 top-0 text-9xl opacity-5 pointer-events-none transform translate-x-1/4 -translate-y-1/4">🔄</div>

                                                <div className="flex items-start gap-4 relative z-10">
                                                    <div className="bg-white p-2 rounded-xl shadow-sm">
                                                        <span className="text-blue-600 font-black text-xl">💡</span>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-black rounded uppercase tracking-widest">發現溢單</span>
                                                            <span className="text-sm text-slate-800 font-bold">
                                                                第 {warn.row} 列 {warn.employeeName && `「${warn.employeeName}」`}
                                                            </span>
                                                        </div>
                                                        <div className="text-blue-900 font-medium mb-4 leading-relaxed bg-white/50 p-3 rounded-lg border border-blue-100/50">
                                                            {warn.message}。<br />
                                                            <span className="text-xs text-blue-700 mt-1 inline-block">※ 系統可自動尋找近期未飽和的派單日，進行「無狀態回溯分配」，還原真實轉換率，且不影響單日總業績。</span>
                                                        </div>

                                                        {onResolveOverflow && (
                                                            <button
                                                                onClick={() => onResolveOverflow([warn])}
                                                                disabled={isResolving}
                                                                className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all shadow-sm ${isResolving
                                                                        ? 'bg-slate-200 text-slate-400 cursor-wait'
                                                                        : 'bg-blue-600 text-white hover:bg-blue-700 hover:shadow-md'
                                                                    }`}
                                                            >
                                                                <span>{isResolving ? '處理中...' : '🔄 智慧搜尋並自動回溯餘單'}</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }

                                    // 一般警告
                                    return (
                                        <div key={idx} className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-r-lg">
                                            <div className="flex items-start gap-3">
                                                <span className="text-yellow-600 font-black text-lg">⚠️</span>
                                                <div className="flex-1">
                                                    <div className="text-xs text-yellow-600 font-bold mb-1">
                                                        第 {warn.row} 列 {warn.employeeName && `「${warn.employeeName}」`} - {warn.field}
                                                    </div>
                                                    <div className="text-sm text-yellow-800 font-medium">{warn.message}</div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 提示 */}
                    {infos.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-blue-600 uppercase tracking-wider">
                                    提示資訊
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {infos.map((info, idx) => (
                                    <div key={idx} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                                        <div className="flex items-start gap-3">
                                            <span className="text-blue-600 font-black text-lg">ℹ️</span>
                                            <div className="flex-1">
                                                {info.row > 0 && (
                                                    <div className="text-xs text-blue-600 font-bold mb-1">
                                                        第 {info.row} 列 {info.employeeName && `「${info.employeeName}」`} - {info.field}
                                                    </div>
                                                )}
                                                <div className="text-sm text-blue-800 font-medium">{info.message}</div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row gap-3">
                    <button
                        onClick={onClose}
                        disabled={isResolving}
                        className="flex-1 bg-white border-2 border-slate-300 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-100 transition-all disabled:opacity-50"
                    >
                        返回修正
                    </button>
                    {!hasErrors && (
                        <button
                            onClick={onContinue}
                            disabled={isResolving || hasOverflow} // 有未處理的溢單時，建議先處理
                            className={`flex-1 font-black py-3 rounded-xl transition-all shadow-lg ${isResolving
                                    ? 'bg-slate-300 text-slate-500 cursor-wait'
                                    : hasOverflow
                                        ? 'bg-slate-800 text-white hover:bg-slate-900 border-2 border-slate-800' // 強調可以硬載，但建議處理
                                        : 'bg-emerald-600 text-white hover:bg-emerald-700'
                                }`}
                        >
                            {hasOverflow ? '忽略警告，強制強制載入' : '確認載入'}
                        </button>
                    )}

                    {hasErrors && hasOverflow && (
                        <div className="w-full text-center text-xs text-red-500 font-bold mt-2 sm:hidden">
                            ※ 請先解決致命錯誤，才能執行自動回溯。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;
