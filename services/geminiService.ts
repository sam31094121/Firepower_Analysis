
import { GoogleGenAI, Type } from "@google/genai";
import { EmployeeData, EmployeeCategory } from "../types";

const API_KEY = process.env.API_KEY || '';

export const analyzePerformance = async (data: EmployeeData[]): Promise<EmployeeData[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
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
    你的唯一核心目標是：透過數據資源配置，實現「公司整體營收與成交率最大化」。

    請對提供的數據進行深度評估：
    1. 【營收權重】：辨識出誰能處理高價值單（大單）、誰的追續能力最強（穩定現金流）。
    2. 【產出穩定性】：透過派單數與成交率的交叉比對，過濾掉偶然的高分。
    3. 【分組策略】：
       - 大單火力組：成交率高、客單價高、績效排名領先，應給予最優質資源。
       - 穩定人選：數據中庸但穩定，適合分配一般量能。
       - 待加強：成交率低或數據不穩，建議進行針對性輔導。
       - 風險警告：嚴重偏離績效常態，應限制資源投入。

    請針對每個人提供精準、不帶情緒、極具決策價值的「組內排名」與「數據導向決議」。

    數據內容：
    ${JSON.stringify(simplifiedData)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', // 使用 Pro 模型進行深度思考
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
                description: "只能是：大單火力組, 穩定人選, 待加強, 風險警告"
              },
              categoryRank: { type: Type.INTEGER, description: "在該分組內的優先順位，1 為最優先" },
              aiAdvice: { type: Type.STRING, description: "數據導向的專業決策決議" }
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
      }

      return {
        ...emp,
        category: finalCategory,
        categoryRank: match?.categoryRank || 99,
        aiAdvice: match?.aiAdvice || '數據不足以支持決策，建議暫停派單觀察。'
      };
    });
  } catch (error) {
    console.error("AI Analysis failed:", error);
    return data;
  }
};

export const extractDataFromImage = async (base64Image: string): Promise<string[][]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `
    你是一個精準的數據 OCR 引擎。請辨識這張行銷報表截圖，並將其轉換為一個二維陣列（純數據表格）。
    
    請依照下列 11 個欄位的順序提取數據：
    1.行銷, 2.派單數, 3.派成數, 4.追續數, 5.總業績, 6.客單價, 7.追續總額, 8.業績排名, 9.追續排名, 10.均價排名, 11.派單成交率。

    規範：
    - 回傳格式必須是一個二維陣列，例如：[["姓名", "10", "2", ...], ["姓名2", "15", "3", ...]]
    - 不要包含任何表頭字樣，只要數據列。
    - 確保數字欄位不包含貨幣符號或逗號。
    - 如果某個欄位資訊缺失，請填入空字串 ""。
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
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
