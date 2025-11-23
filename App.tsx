import React, { useState } from 'react';
import { Mic, MessageSquare, LayoutGrid, Github } from 'lucide-react';
import LiveAgent from './components/LiveAgent';
import ChatAgent from './components/ChatAgent';
import CreativeStudio from './components/CreativeStudio';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.LIVE);

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-sans">
      {/* Sidebar Navigation */}
      <nav className="w-20 md:w-24 border-r border-gray-800 bg-[#0A0A0C] flex flex-col items-center py-8 z-50">
        <div className="mb-12">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-purple-900/20">
                <span className="font-bold text-white text-xl">S</span>
            </div>
        </div>
        
        <div className="flex-1 flex flex-col gap-8 w-full">
            <NavButton 
                active={mode === AppMode.LIVE} 
                onClick={() => setMode(AppMode.LIVE)}
                icon={<Mic className="w-6 h-6" />}
                label="Voice"
            />
            <NavButton 
                active={mode === AppMode.CHAT} 
                onClick={() => setMode(AppMode.CHAT)}
                icon={<MessageSquare className="w-6 h-6" />}
                label="Chat"
            />
            <NavButton 
                active={mode === AppMode.STUDIO} 
                onClick={() => setMode(AppMode.STUDIO)}
                icon={<LayoutGrid className="w-6 h-6" />}
                label="Studio"
            />
        </div>

        <div className="mt-auto opacity-40 hover:opacity-100 transition-opacity">
            <a href="https://github.com/google/generative-ai-js" target="_blank" rel="noreferrer">
                <Github className="w-5 h-5" />
            </a>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 h-full relative overflow-hidden">
        {mode === AppMode.LIVE && <LiveAgent />}
        {mode === AppMode.CHAT && <ChatAgent />}
        {mode === AppMode.STUDIO && <CreativeStudio />}
      </main>
    </div>
  );
};

interface NavButtonProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
}

const NavButton: React.FC<NavButtonProps> = ({ active, onClick, icon, label }) => {
    return (
        <button 
            onClick={onClick}
            className={`group relative flex flex-col items-center justify-center w-full py-3 transition-all duration-300 ${active ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
        >
            <div className={`p-3 rounded-2xl transition-all duration-300 ${active ? 'bg-studio-600 shadow-lg shadow-studio-600/30' : 'bg-transparent group-hover:bg-gray-800'}`}>
                {icon}
            </div>
            <span className={`text-[10px] mt-1 font-medium transition-opacity duration-300 ${active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                {label}
            </span>
            {active && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-studio-400 rounded-l-full" />
            )}
        </button>
    )
}

export default App;