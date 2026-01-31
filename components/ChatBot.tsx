
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Chat } from "@google/genai";
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

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
      const chat = ai.chats.create({
        model: 'gemini-3-pro-preview',
        config: {
          systemInstruction: `
            你是一個專業的行銷策略助理。
            目前系統中的銷售員數據如下：${JSON.stringify(contextData)}。
            請根據這些數據回答管理者的問題，提供精確的派單建議、績效分析或激勵方案。
            如果數據中沒有提及某些人，請如實告知。
            語氣要專業、果斷、具備商業洞察力。
          `
        }
      });

      const response = await chat.sendMessage({ message: userMsg });
      setMessages(prev => [...prev, { role: 'model', text: response.text || '我現在無法回答這個問題。' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'model', text: '抱歉，與 AI 溝通時發生錯誤。' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {isOpen ? (
        <div className="w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[500px]">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-blue-600 rounded-t-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-xl">🤖</span>
              <span className="text-white font-bold">行銷策略助理 (Gemini Pro)</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-white/80 hover:text-white">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px]">
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-8 italic">
                您可以詢問：「誰是最近的大單高手？」或「如何優化目前的派單策略？」
              </p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-slate-100 text-slate-800 rounded-tl-none'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-3 py-2 rounded-2xl text-sm rounded-tl-none flex space-x-1">
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></div>
                  <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100 flex items-center space-x-2">
            <input 
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="輸入問題..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            />
            <button 
              onClick={handleSend}
              className="bg-blue-600 p-2 rounded-xl text-white hover:bg-blue-700 transition-colors shadow-sm"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl hover:bg-blue-700 transition-all hover:scale-110 active:scale-95 group"
        >
          <span className="text-2xl group-hover:rotate-12 transition-transform">💬</span>
        </button>
      )}
    </div>
  );
};

export default ChatBot;
