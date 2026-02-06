import { GoogleGenAI } from "@google/genai";
import { EmployeeData } from "../types";

// 動態讀取 API Key
const getApiKey = (): string => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

// 檢查 API Key 是否存在
const checkApiKey = () => {
    const apiKey = getApiKey();

    // 檢查是否為空
    if (!apiKey || apiKey.trim() === '') {
        throw new Error(
            '⚠️ Gemini API Key 未設定！\n\n' +
            '請在專案根目錄的 .env.local 檔案中加入：\n' +
            'VITE_GEMINI_API_KEY=你的真實API金鑰\n\n' +
            '取得 API Key: https://aistudio.google.com/apikey'
        );
    }

    // 檢查是否為預設佔位符
    if (apiKey === '__GEMINI_API_KEY__' || apiKey.includes('placeholder')) {
        throw new Error(
            '❌ 偵測到預設 API Key！\n\n' +
            '目前使用的是佔位符，無法進行 TTS 播報。\n' +
            '請將 .env.local 中的 API Key 替換為您的真實金鑰。\n\n' +
            '取得金鑰: https://aistudio.google.com/apikey'
        );
    }

    return apiKey;
};

/**
 * 為員工績效數據生成專業的播報腳本
 */
const generateScript = (emp: EmployeeData): string => {
    return `
    ${emp.name}，今日關鍵指標為：
    派單數 ${emp.todayLeads} 單，成交率 ${emp.todayConvRate}，派單價值 ${emp.avgOrderValue.toLocaleString()} 元。
    目前歸類為「${emp.category}」，業績排名第 ${emp.revenueRank} 名。
    AI 建議：${emp.aiAdvice}
  `.trim();
};

/**
 * 將 base64 PCM 音訊解碼為 AudioBuffer
 */
const decodePCM = async (base64Audio: string, audioContext: AudioContext): Promise<AudioBuffer> => {
    // 移除 base64 前綴（如果存在）
    const base64Data = base64Audio.includes(',') ? base64Audio.split(',')[1] : base64Audio;

    // 解碼 base64 為二進位數據
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }

    // 將字節轉換為 Int16 PCM 樣本
    const int16Array = new Int16Array(bytes.buffer);

    // 創建 AudioBuffer (單聲道, 24kHz)
    const sampleRate = 24000;
    const audioBuffer = audioContext.createBuffer(1, int16Array.length, sampleRate);
    const channelData = audioBuffer.getChannelData(0);

    // 將 Int16 轉換為 Float32 (-1.0 到 1.0)
    for (let i = 0; i < int16Array.length; i++) {
        channelData[i] = int16Array[i] / 32768.0;
    }

    return audioBuffer;
};

/**
 * 使用 Gemini 2.5 TTS API 播報員工績效
 */
export const speakPerformance = async (
    emp: EmployeeData,
    audioContext: AudioContext
): Promise<void> => {
    const apiKey = checkApiKey();
    const ai = new GoogleGenAI({ apiKey });

    const script = generateScript(emp);

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: script,
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: 'Aoede'
                        }
                    }
                }
            }
        });

        // 檢查回應中是否有音訊數據
        console.log('TTS Response:', response);

        // 從回應的 parts 中提取音訊數據
        if (!response.candidates || response.candidates.length === 0) {
            throw new Error('未收到有效回應');
        }

        const parts = response.candidates[0].content.parts;
        const audioPart = parts.find((part: any) => part.inlineData);

        if (!audioPart || !audioPart.inlineData || !audioPart.inlineData.data) {
            throw new Error('回應中未包含音訊數據');
        }

        const audioData = audioPart.inlineData.data;

        // 解碼 PCM 音訊
        const audioBuffer = await decodePCM(audioData, audioContext);

        // 使用 Web Audio API 播放
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioContext.destination);
        source.start(0);

        // 等待播放完成
        return new Promise((resolve) => {
            source.onended = () => resolve();
        });
    } catch (error: any) {
        console.error('TTS 播放失敗:', error);

        // 詳細錯誤診斷與中文提示
        let errorMessage = '語音播放失敗';

        // 429 配額錯誤
        if (error?.message?.includes('429') || error?.status === 429) {
            errorMessage = '⏱️ API 配額已達上限\n\n點擊太頻繁，請稍候 30 秒後再試。\n或至 Google AI Studio 檢查您的配額狀態。';
        }
        // 403 權限錯誤
        else if (error?.message?.includes('403') || error?.status === 403) {
            errorMessage = '🔒 模型權限不足\n\n您的 API Key 所屬專案尚未獲得 TTS 模型使用權限。\n請至 Google AI Studio 確認專案權限設定。';
        }
        // 401 認證錯誤
        else if (error?.message?.includes('401') || error?.status === 401) {
            errorMessage = '🔑 API Key 無效\n\n請檢查 .env.local 中的 VITE_GEMINI_API_KEY 是否正確。';
        }
        // 網路錯誤
        else if (error?.message?.includes('network') || error?.message?.includes('fetch')) {
            errorMessage = '📡 網路連線失敗\n\n請檢查網路連線，並確認防火牆未封鎖 Google API。';
        }
        // 模型不存在
        else if (error?.message?.includes('model') || error?.message?.includes('not found')) {
            errorMessage = '🤖 模型不可用\n\ngemini-2.0-flash-exp 模型可能暫時無法使用，請稍後再試。';
        }
        // 一般錯誤
        else if (error?.message) {
            errorMessage = `❌ ${error.message}`;
        }

        throw new Error(errorMessage);
    }
};
