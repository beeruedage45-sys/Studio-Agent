import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Mic, MicOff, Activity, XCircle, Zap, Volume2 } from 'lucide-react';
import { createPcmBlob, decodeAudioData, base64ToUint8Array } from '../utils/audioUtils';

// Global variable for API key (injected by environment)
declare const process: { env: { API_KEY: string } };

const LiveAgent: React.FC = () => {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [volume, setVolume] = useState(0); // For visualization
  
  // Refs for audio handling to avoid re-renders
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const activeSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const sessionPromiseRef = useRef<Promise<any> | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Initialize Visualizer
  useEffect(() => {
    let animationFrameId: number;
    
    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Clear canvas with fade effect for trails
      ctx.fillStyle = 'rgba(15, 15, 18, 0.2)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Draw dynamic circle based on volume
      const radius = 50 + (volume * 100);
      
      // Outer glow
      const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.5, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(139, 92, 246, 0.1)'); // Indigo
      gradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Core
      ctx.beginPath();
      ctx.arc(centerX, centerY, 40 + (volume * 20), 0, Math.PI * 2);
      ctx.fillStyle = connected ? '#8b5cf6' : '#4b5563';
      ctx.fill();

      // Ripples
      if (connected && volume > 0.01) {
          ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(centerX, centerY, 45 + (volume * 40), 0, Math.PI * 2);
          ctx.stroke();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, [volume, connected]);

  const stopAudio = useCallback(() => {
    if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
    }
    if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
    }
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
        inputContextRef.current = null;
    }
    
    // Stop all playing output sources
    activeSourcesRef.current.forEach(source => {
        try { source.stop(); } catch (e) {}
    });
    activeSourcesRef.current.clear();

    if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
    }
    
    // Attempt to close session if accessible (wrapper doesn't expose close easily on promise, 
    // but in a real app we'd keep the session object. Here we rely on cleanup).
    setConnected(false);
    setVolume(0);
  }, []);

  const startSession = async () => {
    setError(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Setup Audio Contexts
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const outputNode = audioContextRef.current.createGain();
      outputNode.connect(audioContextRef.current.destination);

      // Connect to Live API
      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setConnected(true);
            
            // Setup Input Stream Processing
            if (!inputContextRef.current) return;
            const source = inputContextRef.current.createMediaStreamSource(stream);
            sourceRef.current = source;
            
            const scriptProcessor = inputContextRef.current.createScriptProcessor(4096, 1, 1);
            processorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              // Calculate volume for visualizer
              let sum = 0;
              for(let i=0; i<inputData.length; i++) sum += inputData[i] * inputData[i];
              const rms = Math.sqrt(sum / inputData.length);
              setVolume(v => Math.max(rms, v * 0.9)); // Smooth decay

              const pcmBlob = createPcmBlob(inputData);
              sessionPromiseRef.current?.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };

            source.connect(scriptProcessor);
            scriptProcessor.connect(inputContextRef.current.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
             // Handle Audio Output
             const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (base64Audio && audioContextRef.current) {
                 const ctx = audioContextRef.current;
                 nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                 
                 const audioBytes = base64ToUint8Array(base64Audio);
                 const audioBuffer = await decodeAudioData(audioBytes, ctx);
                 
                 const source = ctx.createBufferSource();
                 source.buffer = audioBuffer;
                 source.connect(outputNode);
                 
                 source.addEventListener('ended', () => {
                     activeSourcesRef.current.delete(source);
                 });
                 
                 source.start(nextStartTimeRef.current);
                 nextStartTimeRef.current += audioBuffer.duration;
                 activeSourcesRef.current.add(source);
             }

             // Handle Interruption
             if (message.serverContent?.interrupted) {
                 activeSourcesRef.current.forEach(src => src.stop());
                 activeSourcesRef.current.clear();
                 nextStartTimeRef.current = 0;
             }
          },
          onclose: () => {
            setConnected(false);
            stopAudio();
          },
          onerror: (err) => {
            console.error(err);
            setError("Connection error. Please try again.");
            stopAudio();
          }
        },
        config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } }
            },
            systemInstruction: "You are Studio Agent, a helpful, fast, and creative assistant. Keep your responses concise and punchy unless asked for detail. You are running in a web environment."
        }
      });

    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed to start session");
      stopAudio();
    }
  };

  useEffect(() => {
      // Cleanup on unmount
      return () => stopAudio();
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col items-center justify-center h-full w-full relative overflow-hidden bg-gradient-to-b from-gray-900 to-black p-6">
       {/* Background Ambient Effect */}
       <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob"></div>
            <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000"></div>
       </div>

       <div className="z-10 text-center space-y-8">
            <div className="space-y-2">
                <h2 className="text-3xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                    Studio Live
                </h2>
                <p className="text-gray-400 text-sm md:text-base">
                    Real-time conversational voice agent
                </p>
            </div>

            {/* Visualizer Canvas */}
            <div className="relative w-64 h-64 mx-auto flex items-center justify-center">
                <canvas 
                    ref={canvasRef} 
                    width={300} 
                    height={300} 
                    className="absolute top-0 left-0 w-full h-full"
                />
            </div>

            {/* Controls */}
            <div className="flex flex-col items-center space-y-4">
                {!connected ? (
                    <button
                        onClick={startSession}
                        className="group relative inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-studio-600 rounded-full hover:bg-studio-500 hover:shadow-lg hover:shadow-studio-500/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-studio-600 focus:ring-offset-gray-900"
                    >
                        <Mic className="w-5 h-5 mr-2" />
                        <span>Start Conversation</span>
                        <div className="absolute inset-0 rounded-full ring-2 ring-white/20 group-hover:ring-white/40 transition-all" />
                    </button>
                ) : (
                    <button
                        onClick={stopAudio}
                        className="inline-flex items-center justify-center px-8 py-4 font-semibold text-white transition-all duration-200 bg-red-600 rounded-full hover:bg-red-500 hover:shadow-lg focus:outline-none"
                    >
                        <MicOff className="w-5 h-5 mr-2" />
                        <span>End Session</span>
                    </button>
                )}
                
                <div className="h-6">
                    {connected && (
                        <div className="flex items-center text-emerald-400 text-xs font-mono animate-pulse">
                            <Zap className="w-3 h-3 mr-1" />
                            LIVE CONNECTION ACTIVE
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center text-red-400 text-xs font-mono">
                            <XCircle className="w-3 h-3 mr-1" />
                            {error}
                        </div>
                    )}
                </div>
            </div>
       </div>
       
       <div className="absolute bottom-8 text-center text-gray-600 text-xs max-w-md">
           <p>Powered by Gemini 2.5 Native Audio Live API.</p>
           <p>Latency is minimized for real-time interaction.</p>
       </div>
    </div>
  );
};

export default LiveAgent;