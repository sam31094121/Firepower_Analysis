
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import { EmployeeData, ChatMessage } from '../types';

interface Props {
  contextData: EmployeeData[];
}

const ChatBot: React.FC<Props> = ({ contextData }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自動捲動到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userMsg,
        config: {
          systemInstruction: `
            你是一名資深「行銷營運決策顧問」，擁有極高的商業洞察力。
            當前系統數據快照：${JSON.stringify(contextData)}。

            請嚴格遵守以下輸出規範，確保回覆專業、流暢且無視覺噪音：

            【核心立場】
            1. 資源配置唯一目標：成交機率與營收總額最大化。
            2. 堅決反對：平均分配、人情派單、或無數據支持的直覺判斷。
            3. 禁止情緒性廢話：不使用「加油」、「辛苦了」、「棒極了」等修飾詞。

            【回覆結構（強制固定三段式）】
            1. **數據摘要**：用 1-2 句話精確描述目前與問題相關的人員表現或數據概況。
            2. **深度分析**：列舉核心數據點（如成交率、排名、產出值），分析其潛在的產出風險或機會。
            3. **決策建議**：給出明確的執行方針（例如：優先派單給 A 與 B、暫停 C 的新單供應）。

            【格式限制】
            - 簡化符號：僅使用粗體標題、數字條列 (1. 2. 3.) 與短橫線 (-)。
            - 禁止過度裝飾：禁止使用大量星號、表情符號（除非必要）、或複雜的縮排。
            - 簡潔有力：回覆不超過 300 字。

            【語感指引】
            - 使用「建議」、「觀察到」、「根據數據顯示」等客觀用語。
            - 內容要能直接讓管理者進行決策，不需要解釋基本的統計概念。
            - 若數據不足或提及的人員不在快照中，請直接陳述事實，不進行臆測。
          `
        }
      });

      setMessages(prev => [...prev, { role: 'model', text: response.text || '數據解析異常，請稍後再試。' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: '系統通訊中斷，請確認網路或 API 狀態。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      {isOpen ? (
        <div className="w-[320px] sm:w-[450px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col h-fit max-h-[calc(100vh-140px)] overflow-hidden animate-in fade-in zoom-in duration-200 origin-bottom-right">
          {/* Header - 固定不縮放 */}
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🤵</span>
              <span className="text-white text-sm font-black tracking-widest uppercase">決策決議顧問</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/50 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          {/* Message List - 自動捲動區域 */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-5 bg-slate-50 min-h-0">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-48 opacity-40">
                <div className="text-3xl mb-3">📊</div>
                <p className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-[0.2em] leading-loose">
                  請輸入查詢需求<br/>系統將根據即時數據生成建議
                </p>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-4 py-3 rounded-xl text-[13px] leading-relaxed shadow-sm break-words overflow-hidden ${
                  m.role === 'user' 
                  ? 'bg-blue-600 text-white font-bold rounded-tr-none' 
                  : 'bg-white text-slate-700 border border-slate-200 font-medium rounded-tl-none whitespace-pre-wrap'
                }`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 px-4 py-3 rounded-xl rounded-tl-none flex space-x-1 items-center shadow-sm">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area - 固定於底部 */}
          <div className="p-4 bg-white border-t border-slate-100 flex items-center space-x-2 shrink-0">
            <input 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-xs font-bold outline-none focus:ring-2 focus:ring-blue-600/20 focus:bg-white transition-all"
              placeholder="請輸入分析指令..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              className="bg-slate-900 p-2.5 rounded-lg text-white hover:bg-blue-600 transition-all shadow-md active:scale-95 disabled:opacity-50"
              disabled={isTyping}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-slate-900 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-2xl hover:bg-blue-600 transition-all hover:scale-105 active:scale-95 group border-2 border-white"
        >
          <span className="text-2xl">🤵</span>
        </button>
      )}
    </div>
  );
};

export default ChatBot;
