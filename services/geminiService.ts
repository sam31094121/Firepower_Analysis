
import { GoogleGenAI, Type } from "@google/genai";
import { EmployeeData, EmployeeCategory } from "../types";

const API_KEY = process.env.API_KEY || '';

export const analyzePerformance = async (data: EmployeeData[]): Promise<EmployeeData[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  
  const simplifiedData = data.map(e => ({
    id: e.id,
    name: e.name,
    todayConv: e.todayConvRate,
    monthlyConv: e.monthlyTotalConvRate,
    return: e.returnAmount,
    netRevenue: e.monthlyActualRevenueNet
  }));

  const prompt = `
    你是一個行銷績效分析專家。請嚴格根據以下數據對銷售員進行分類。
    
    你【必須】從這四個精確字串中選擇一個回傳：
    - "大單火力組" (判斷標準：當日轉換率極高或業績突出)
    - "穩定人選" (判斷標準：長期穩健且退貨極低)
    - "待加強" (判斷標準：轉換率低於平均且無大單)
    - "風險警告" (判斷標準：退貨金額異常高)

    數據清單：
    ${JSON.stringify(simplifiedData)}

    回傳 JSON 格式：
    [{"id": "...", "category": "大單火力組", "aiAdvice": "建議內容..."}]
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
              category: { type: Type.STRING },
              aiAdvice: { type: Type.STRING }
            },
            required: ["id", "category", "aiAdvice"]
          }
        }
      }
    });

    const analyzedResults = JSON.parse(response.text);
    
    return data.map(emp => {
      const match = analyzedResults.find((a: any) => a.id === emp.id);
      
      // 模糊匹配邏輯：確保即使 AI 回傳帶符號的字串也能正確分類
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
        aiAdvice: match?.aiAdvice || 'AI 正在規劃策略...'
      };
    });
  } catch (error) {
    console.error("AI Analysis failed:", error);
    // 降級處理：若失敗則維持原本的分類
    return data;
  }
};

export const extractDataFromImage = async (base64Image: string): Promise<Partial<EmployeeData>[]> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const prompt = `
    辨識行銷報表。
    1. 提取姓名、成交額、實收、退貨。
    2. 如果數值顯示為 #DIV/0! 或為空，請統一回傳數字 0 或 "0%"。
    3. 回傳 EmployeeData JSON 陣列。
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
      config: { responseMimeType: "application/json" }
    });
    return JSON.parse(response.text);
  } catch (error) {
    throw error;
  }
};

export const generateMarketingImage = async (prompt: string): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9" } }
    });
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (e) {}
  return '';
};
