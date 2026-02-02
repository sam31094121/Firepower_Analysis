import React, { useState, useEffect } from 'react';

const ApiDiagnostics: React.FC = () => {
    const [status, setStatus] = useState<{
        hasKey: boolean;
        source: 'Vite' | 'None';
        isPlaceholder: boolean;
    }>({ hasKey: false, source: 'None', isPlaceholder: false });

    useEffect(() => {
        const checkApi = () => {
            const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;

            if (viteKey) {
                setStatus({ hasKey: true, source: 'Vite', isPlaceholder: false });
            } else {
                setStatus({ hasKey: false, source: 'None', isPlaceholder: false });
            }
        };

        checkApi();
        const interval = setInterval(checkApi, 5000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-end space-y-2">
            <div className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-tighter shadow-2xl flex items-center space-x-2 border backdrop-blur-md transition-all ${status.hasKey
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-600'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-600'
                }`}>
                <div className={`w-2 h-2 rounded-full animate-pulse ${status.hasKey ? 'bg-blue-500' : 'bg-rose-500'}`}></div>
                <span>Gemini API: {status.hasKey ? `Active (${status.source})` : status.isPlaceholder ? 'Placeholder Found' : 'Missing Key'}</span>
            </div>
            {!status.hasKey && (
                <div className="bg-rose-600 text-white p-3 rounded-2xl text-[10px] font-bold shadow-2xl max-w-[200px] text-right border-2 border-white pointer-events-auto">
                    地端請檢查 .env.local<br />
                    線版請檢查 GitHub Secrets
                </div>
            )}
        </div>
    );
};

export default ApiDiagnostics;
