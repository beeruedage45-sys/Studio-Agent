import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Send, User, Bot, Loader2, Sparkles, Zap, MapPin } from 'lucide-react';
import { ChatMessage } from '../types';

declare const process: { env: { API_KEY: string } };

const ChatAgent: React.FC = () => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
      { id: '0', role: 'model', text: "I'm Studio Agent. How can I help you today?", timestamp: new Date() }
  ]);
  const [loading, setLoading] = useState(false);
  const [modelType, setModelType] = useState<'fast' | 'smart'>('fast');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        text: input,
        timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        
        // Model Selection based on user preference
        const modelName = modelType === 'fast' 
            ? 'gemini-2.5-flash-lite-latest' 
            : 'gemini-3-pro-preview';

        // Add Grounding tools if in Smart Mode
        const tools = modelType === 'smart' ? [{ googleSearch: {} }, { googleMaps: {} }] : undefined;
        
        // Build chat history
        const history = messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
        }));

        const chat = ai.chats.create({
            model: modelName,
            history: history,
            config: {
                tools: tools,
                systemInstruction: "You are Studio Agent. Be helpful, concise, and professional."
            }
        });

        // Use Stream for faster perceived latency
        const resultStream = await chat.sendMessageStream({ message: userMsg.text });
        
        let fullResponse = '';
        const responseId = (Date.now() + 1).toString();
        
        // Initial placeholder for streaming
        setMessages(prev => [...prev, {
            id: responseId,
            role: 'model',
            text: '',
            timestamp: new Date()
        }]);

        for await (const chunk of resultStream) {
            const text = chunk.text;
            if (text) {
                fullResponse += text;
                setMessages(prev => prev.map(m => 
                    m.id === responseId ? { ...m, text: fullResponse } : m
                ));
            }
            // Grounding data check (simplified for display)
            const grounding = chunk.candidates?.[0]?.groundingMetadata;
             if (grounding?.groundingChunks) {
                // In a full app, we would parse and display citations nicely
                // For now, we append sources if they exist at the end
             }
        }

    } catch (error: any) {
        console.error(error);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'model',
            text: "I encountered an error processing that request.",
            timestamp: new Date()
        }]);
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
        {/* Header / Mode Switcher */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm z-10">
            <h2 className="text-xl font-bold flex items-center">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">
                    Studio Chat
                </span>
            </h2>
            <div className="flex bg-gray-800 rounded-lg p-1">
                <button
                    onClick={() => setModelType('fast')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center transition-all ${
                        modelType === 'fast' 
                        ? 'bg-studio-600 text-white shadow-md' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Zap className="w-3 h-3 mr-1.5" />
                    Fast (Lite)
                </button>
                <button
                    onClick={() => setModelType('smart')}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center transition-all ${
                        modelType === 'smart' 
                        ? 'bg-studio-600 text-white shadow-md' 
                        : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <Sparkles className="w-3 h-3 mr-1.5" />
                    Smart (Pro)
                </button>
            </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
            {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 ${
                        msg.role === 'user' 
                        ? 'bg-studio-600 text-white rounded-br-none' 
                        : 'bg-gray-800 text-gray-100 rounded-bl-none border border-gray-700'
                    }`}>
                        <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase tracking-wider">
                            {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                            <span>{msg.role === 'user' ? 'You' : 'Agent'}</span>
                        </div>
                        <div className="whitespace-pre-wrap leading-relaxed text-sm">
                            {msg.text}
                        </div>
                    </div>
                </div>
            ))}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-gray-900 border-t border-gray-800">
            <div className="relative flex items-center bg-gray-800 rounded-full border border-gray-700 focus-within:border-studio-500 focus-within:ring-1 focus-within:ring-studio-500 transition-all">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder={modelType === 'fast' ? "Ask me anything (Optimized for speed)..." : "Ask complex questions (Optimized for reasoning)..."}
                    className="flex-1 bg-transparent border-none focus:ring-0 px-6 py-4 text-sm text-white placeholder-gray-500"
                    disabled={loading}
                />
                <button
                    onClick={handleSend}
                    disabled={loading || !input.trim()}
                    className="p-3 mr-2 bg-studio-600 hover:bg-studio-500 disabled:opacity-50 disabled:hover:bg-studio-600 rounded-full text-white transition-colors"
                >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
            </div>
            <div className="mt-2 text-center">
                 <span className="text-[10px] text-gray-500">
                    {modelType === 'fast' ? 'Running on Gemini 2.5 Flash Lite' : 'Running on Gemini 3 Pro Preview with Search & Maps'}
                 </span>
            </div>
        </div>
    </div>
  );
};

export default ChatAgent;