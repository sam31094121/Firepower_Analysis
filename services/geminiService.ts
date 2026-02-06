
import { GoogleGenAI, Type } from "@google/genai";
import { EmployeeData, EmployeeCategory } from "../types";

// 動態讀取 API Key,避免快取問題
const getApiKey = (): string => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

// 檢查 API Key 是否存在
const checkApiKey = () => {
  const apiKey = getApiKey();
  if (!apiKey || apiKey.trim() === '') {
    throw new Error(
      '⚠️ Gemini API Key 未設定!\n\n' +
      '📍 本地開發:\n' +
      '  請在專案根目錄建立 .env.local 檔案,並加入:\n' +
      '  VITE_GEMINI_API_KEY=你的API金鑰\n\n' +
      '📍 GitHub Pages 部署:\n' +
      '  1. 前往 GitHub Repository Settings\n' +
      '  2. 點選 Secrets and variables > Actions\n' +
      '  3. 新增 Secret: GEMINI_API_KEY\n' +
      '  4. 重新推送程式碼觸發部署\n\n' +
      '🔑 取得 API Key: https://aistudio.google.com/apikey'
    );
  }
  return apiKey;
};

export const analyzePerformance = async (data: EmployeeData[]): Promise<EmployeeData[]> => {
  const apiKey = checkApiKey();
  const ai = new GoogleGenAI({ apiKey });

  const simplifiedData = data.map(e => ({
    id: e.id,
    name: e.name,
    leads: e.todayLeads,
    sales: e.todaySales,
    totalRevenue: e.todayNetRevenue,
    avgPrice: e.avgOrderValue,
    convRate: e.todayConvRate,
    revRank: e.revenueRank,
    avgPriceRank: e.avgPriceRank,
    followupRank: e.followupRank,
    followupOrders: e.followupCount,
    followupRevenue: e.todayFollowupSales
  }));

  const prompt = `
    你是一名「資深行銷營運與派單數據科學家」，擁有極高的商業嗅覺。
    你的唯一核心目標是：透過數據資源配置，實現「公司整體營收最大化」。

    請對提供的數據進行深度評估：
    1. 【營收權重】：辨識出誰能處理高價值單（大單）、誰的追續能力最強（穩定現金流）。
    2. 【產出穩定性】：透過派單數與成交率的交叉比對，過濾掉偶然的高分。
    3. 【分組策略】：
       - 大單火力組：成交率高、派單價值高、績效排名領先，應給予最優質資源。
       - 穩定人選：數據中庸但穩定，適合分配一般量能。
       - 待加強：成交率低或數據不穩，建議進行針對性輔導。
       - 風險警告：嚴重偏離績效常態，應限制資源投入。
       - 潛力成長組：成交率明顯高於均值（團隊中位數 + 5-10%），派單價值在前 40%，但「派單數」明顯低於團隊中位數的 60%。這類人是被低估的將才，應優先增加派單。
    關於「aiAdvice (派單決策決議)」的要求：
    - 請針對該人員的數據(成交率、均價、業績)給出具體的「派單操作建議」並給予弱點分析改進方法。
    - 語氣要堅定、專業,字數在 30-50 字之間。
    - 例如:「當月派單價值達7174元,具備高成交率、高單價特質,應列為核心主力,不過追續僅有311,490應加強客戶沾黏度。」
    - 針對「潛力成長組」,請明確指出其「派單缺口」並強制建議增加資源投入。
    
    關於「scoutAdvice (星探區專用建議)」的要求：
    - 僅針對「潛力成長組」的人員生成此欄位。
    - 內容必須包含:1) 現況數據分析 2) 為何值得提拔的具體原因。
    - 語氣專業、數據導向,字數控制在 25-40 字。
    - 例如:「成交率 45% 遠超團隊均值 28%,但派單僅 12 單(中位數 60%),屬被低估人才,建議立即增撥資源。」
    - 其他組別的人員此欄位為空字串。
    
    請針對每個人提供精準、不帶情緒、極具決策價值的「組內排名」與「派單決策決議」。

    數據內容：
    ${JSON.stringify(simplifiedData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              category: {
                type: Type.STRING,
                description: "只能是:大單火力組, 穩定人選, 待加強, 風險警告, 潛力成長組"
              },
              categoryRank: { type: Type.INTEGER, description: "在該分組內的優先順位,1 為最優先" },
              aiAdvice: { type: Type.STRING, description: "數據導向的專業決策決議" },
              scoutAdvice: { type: Type.STRING, description: "星探區專用建議(僅潛力成長組需填寫,其他組別為空字串)" }
            },
            required: ["id", "category", "categoryRank", "aiAdvice"]
          }
        }
      }
    });

    const analyzedResults = JSON.parse(response.text);

    return data.map(emp => {
      const match = analyzedResults.find((a: any) => a.id === emp.id);

      let finalCategory = EmployeeCategory.STEADY;
      if (match?.category) {
        const rawCat = match.category.toString();
        if (rawCat.includes("火力")) finalCategory = EmployeeCategory.FIREPOWER;
        else if (rawCat.includes("穩定")) finalCategory = EmployeeCategory.STEADY;
        else if (rawCat.includes("加強")) finalCategory = EmployeeCategory.NEEDS_IMPROVEMENT;
        else if (rawCat.includes("風險")) finalCategory = EmployeeCategory.RISK;
        else if (rawCat.includes("潛力")) finalCategory = EmployeeCategory.POTENTIAL;
      }

      return {
        ...emp,
        category: finalCategory,
        categoryRank: match?.categoryRank || 99,
        aiAdvice: match?.aiAdvice || '數據不足以支持決策,建議暫停派單觀察。',
        scoutAdvice: match?.scoutAdvice || ''
      };
    });
  } catch (error: any) {
    console.error("AI Analysis failed:", error);
    if (error?.message?.includes('429') || error?.message?.includes('quota')) {
      throw new Error("🚀 您的 API Key 已達免費額度上限 (429)！請稍候 60 秒再試，或至 Google AI Studio 檢查配額。");
    }
    throw error;
  }
};

export const extractDataFromImage = async (base64Image: string): Promise<string[][]> => {
  const apiKey = checkApiKey();
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `
    你是一個極具適應力的數據 OCR 引擎。請辨識這張行銷報表截圖。
    注意：圖片中的表頭名稱或順序可能與標準格式不同，請發揮智慧進行語意匹配。

    目標標準欄位（共 11 欄）：
    1.行銷(姓名), 2.派單數, 3.派成數, 4.追續數, 5.總業績, 6.派單價值, 7.追續總額, 8.業績排名, 9.追續排名, 10.均價排名, 11.派單成交率。

    特別處理規範：
    - 若看到 "#DIV/0!"、"Error" 或無意義的計算錯誤，請一律轉換為 "0%" 或 "0"。
    - 自動識別圖片中的表頭，並將其對應到上述 11 個標準欄位。
    - 若圖片中完全不存在某個標準欄位，該位置請填入空字串 ""。
    - 清除所有貨幣符號 ($)、千分位逗號 (,)。
    - 僅回傳數據部分的二維陣列，不要包含表頭列。

    範例輸出格式：[["張三", "10", "2", "5", "50000", "5000", "20000", "1", "3", "2", "20%"], ...]
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { data: base64Image.split(',')[1], mimeType: 'image/jpeg' } },
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      }
    });
    return JSON.parse(response.text);
  } catch (error) {
    throw error;
  }
};
