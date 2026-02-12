import { EmployeeData } from "../types";

/**
 * 格式化金額為口語化中文
 * 例如: 15000 -> 1.5萬, 10500 -> 1.05萬
 */
const formatNumberToCurrency = (num: number): string => {
    if (num >= 10000) {
        const value = num / 10000;
        // 轉為字串並移除多餘的零，保留最多兩位小數
        const formatted = parseFloat(value.toFixed(2));
        return `${formatted}萬`;
    }
    return num.toString();
};

/**
 * 格式化百分比為口語化中文
 * 例如: 80% -> 百分之八十
 */
const formatPercentage = (percentStr: string): string => {
    // 移除 % 符號並轉為數字
    const value = parseFloat(percentStr.replace('%', ''));
    if (isNaN(value)) return percentStr;
    return `百分之${value}`;
};

/**
 * 獲取最佳中文語音
 * 優先順序: Google 國語 > Microsoft Hanhan > 其他中文 > 預設
 */
const getBestVoice = (): SpeechSynthesisVoice | null => {
    const voices = window.speechSynthesis.getVoices();

    // 優先尋找 Google 國語 (通常品質最好)
    const googleVoice = voices.find(v => v.name.includes('Google') && (v.lang === 'zh-TW' || v.lang === 'zh-CN'));
    if (googleVoice) return googleVoice;

    // 其次尋找微軟語音 (Windows 常見)
    const microsoftVoice = voices.find(v => v.name.includes('Microsoft') && (v.lang === 'zh-TW' || v.lang === 'zh-CN'));
    if (microsoftVoice) return microsoftVoice;

    // 最後尋找任何中文語音
    const anyChineseVoice = voices.find(v => v.lang === 'zh-TW' || v.lang === 'zh-CN');

    return anyChineseVoice || null;
};

/**
 * 為員工績效數據生成專業的播報腳本 (口語優化版)
 */
const generateScript = (emp: EmployeeData): string => {
    const revenue = formatNumberToCurrency(emp.avgOrderValue);
    const convRate = formatPercentage(emp.todayConvRate);

    // 處理排名口語化 (第 1 名 -> 第一名)
    const rank = emp.revenueRank;

    return `
    ${emp.name}，今日關鍵指標：
    派單數 ${emp.todayLeads} 單，成交率 ${convRate}，派單價值 ${revenue}元。
    目前歸類為「${emp.category}」，業績排名第 ${rank} 名。
    AI 建議：${emp.aiAdvice}
  `.trim();
};

/**
 * 預載語音列表 (解決 Chrome 首次加載無法獲取語音的問題)
 */
export const initVoiceSystem = (): void => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.getVoices();
    }
};

/**
 * 使用瀏覽器內建 Web Speech API 播報員工績效 (零延遲、零成本)
 */
export const speakPerformance = (emp: EmployeeData): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
            console.error('瀏覽器不支援 Speech Synthesis API');
            reject(new Error('瀏覽器不支援語音合成'));
            return;
        }

        // 1. 強制中斷目前正在播放的聲音 (實現「瞬間切換」)
        window.speechSynthesis.cancel();

        // 2. 生成優化腳本
        const script = generateScript(emp);

        // 3. 建立語音實例
        const utterance = new SpeechSynthesisUtterance(script);

        // 4. 設定最佳語音
        const voice = getBestVoice();
        if (voice) {
            utterance.voice = voice;
        }

        // 5. 設定語速與音調 (稍微快一點點，更像專業匯報)
        utterance.rate = 1.1;
        utterance.pitch = 1.0;

        // 6. 事件監聽
        utterance.onend = () => {
            resolve();
        };

        utterance.onerror = (event) => {
            // 如果是被 cancel 中斷的，通常不視為錯誤，但在這裡我們只 log
            if (event.error !== 'interrupted') {
                console.error('語音播放錯誤:', event);
            }
            resolve(); // 即使錯誤也 resolve，避免 UI 卡住
        };

        // 7. 開始播放
        window.speechSynthesis.speak(utterance);
    });
};

/**
 * 停止所有語音播放
 */
export const stopSpeaking = (): void => {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
};

