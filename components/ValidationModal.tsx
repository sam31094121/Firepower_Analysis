import React from 'react';
import { ValidationResult } from '../types';

interface Props {
    result: ValidationResult;
    onClose: () => void;
    onContinue: () => void;
}

const ValidationModal: React.FC<Props> = ({ result, onClose, onContinue }) => {
    const { errors, warnings, infos } = result;
    const hasErrors = errors.length > 0;

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

                    {/* 警告 */}
                    {warnings.length > 0 && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                                <h3 className="text-sm font-black text-yellow-600 uppercase tracking-wider">
                                    警告 ({warnings.length} 項)
                                </h3>
                            </div>
                            <div className="space-y-2">
                                {warnings.map((warn, idx) => (
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
                                ))}
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
                <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 bg-white border-2 border-slate-300 text-slate-700 font-black py-3 rounded-xl hover:bg-slate-100 transition-all"
                    >
                        返回修正
                    </button>
                    {!hasErrors && (
                        <button
                            onClick={onContinue}
                            className="flex-1 bg-blue-600 text-white font-black py-3 rounded-xl hover:bg-blue-700 transition-all shadow-lg"
                        >
                            確認載入
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ValidationModal;
