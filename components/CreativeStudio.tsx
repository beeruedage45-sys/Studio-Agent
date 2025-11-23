import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Image, Video, Wand2, Loader2, AlertCircle, Download } from 'lucide-react';
import { StudioTool, GenerationResult } from '../types';

declare const process: { env: { API_KEY: string } };

const CreativeStudio: React.FC = () => {
  const [activeTool, setActiveTool] = useState<StudioTool>(StudioTool.IMAGE_GEN);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<GenerationResult | null>(null);
  
  // Settings
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K'); // For images
  const [veoRes, setVeoRes] = useState<'720p' | '1080p'>('720p'); // For video

  const handleGenerate = async () => {
    if (!prompt) return;
    setResult({ type: activeTool === StudioTool.VIDEO_GEN ? 'video' : 'image', loading: true });

    try {
        const win = window as any;

        // Helper function to check/request API key
        const ensureApiKey = async () => {
            if (win.aistudio) {
                const hasKey = await win.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    await win.aistudio.openSelectKey();
                }
            }
        };

        // Helper to handle specific billing/key errors
        const handleApiError = async (error: any) => {
             const msg = error.message || error.toString();
             if (msg.includes("Requested entity was not found") || JSON.stringify(error).includes("Requested entity was not found")) {
                 if (win.aistudio) {
                     await win.aistudio.openSelectKey();
                     throw new Error("Project not found or API key invalid. Please select a valid paid Google Cloud Project.");
                 }
             }
             throw error;
        };

        if (activeTool === StudioTool.IMAGE_GEN) {
            // Gemini 3 Pro Image requires paid key selection
            await ensureApiKey();
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            try {
                const response = await ai.models.generateContent({
                    model: 'gemini-3-pro-image-preview',
                    contents: { parts: [{ text: prompt }] },
                    config: {
                        imageConfig: {
                            aspectRatio: aspectRatio,
                            imageSize: resolution
                        }
                    }
                });

                // Extract Image
                let foundImage = false;
                if (response.candidates?.[0]?.content?.parts) {
                    for (const part of response.candidates[0].content.parts) {
                        if (part.inlineData) {
                            const base64 = part.inlineData.data;
                            const url = `data:image/png;base64,${base64}`;
                            setResult({ type: 'image', loading: false, url });
                            foundImage = true;
                            break;
                        }
                    }
                }
                if (!foundImage) throw new Error("No image generated.");
            } catch (error) {
                await handleApiError(error);
            }
        } 
        else if (activeTool === StudioTool.VIDEO_GEN) {
            // Veo requires paid key selection
            await ensureApiKey();
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

            try {
                let operation = await ai.models.generateVideos({
                    model: 'veo-3.1-fast-generate-preview',
                    prompt: prompt,
                    config: {
                        numberOfVideos: 1,
                        resolution: veoRes,
                        aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9' 
                    }
                });

                // Polling
                while (!operation.done) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                    operation = await ai.operations.getVideosOperation({operation: operation});
                }

                const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
                if (downloadLink) {
                    // Fetch bytes
                    const vidRes = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
                    const blob = await vidRes.blob();
                    const url = URL.createObjectURL(blob);
                    setResult({ type: 'video', loading: false, url });
                } else {
                    throw new Error("Video generation failed.");
                }
            } catch (error) {
                await handleApiError(error);
            }
        }

    } catch (e: any) {
        setResult({ type: 'text', loading: false, error: e.message || "Generation failed" });
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-gray-950 text-white">
        {/* Sidebar Tools */}
        <div className="w-full md:w-64 bg-gray-900 border-r border-gray-800 p-4 flex flex-col gap-2">
            <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2 px-2">Studio Tools</h3>
            
            <button
                onClick={() => setActiveTool(StudioTool.IMAGE_GEN)}
                className={`flex items-center p-3 rounded-lg text-sm font-medium transition-colors ${activeTool === StudioTool.IMAGE_GEN ? 'bg-studio-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
                <Image className="w-4 h-4 mr-3" />
                Image Gen (Pro)
            </button>
            <button
                onClick={() => setActiveTool(StudioTool.VIDEO_GEN)}
                className={`flex items-center p-3 rounded-lg text-sm font-medium transition-colors ${activeTool === StudioTool.VIDEO_GEN ? 'bg-studio-600 text-white' : 'text-gray-400 hover:bg-gray-800'}`}
            >
                <Video className="w-4 h-4 mr-3" />
                Video Gen (Veo)
            </button>
            <div className="mt-auto p-4 bg-gray-800 rounded-xl">
                 <p className="text-xs text-gray-400 mb-2">
                    Both Veo and Gemini 3 Pro Image require a paid billing project.
                 </p>
                 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="text-xs text-studio-400 hover:underline block">Billing Info &rarr;</a>
            </div>
        </div>

        {/* Configuration & Preview */}
        <div className="flex-1 overflow-y-auto p-6 md:p-12">
            <div className="max-w-4xl mx-auto space-y-8">
                
                <div className="space-y-4">
                    <h2 className="text-3xl font-bold">
                        {activeTool === StudioTool.IMAGE_GEN ? "Generate Images" : "Generate Video"}
                    </h2>
                    <textarea 
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder={`Describe the ${activeTool === StudioTool.IMAGE_GEN ? "image" : "video"} you want to create...`}
                        className="w-full h-32 bg-gray-900 border border-gray-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-studio-500 focus:border-transparent resize-none"
                    />
                    
                    {/* Controls */}
                    <div className="flex flex-wrap gap-4">
                        <select 
                            value={aspectRatio} 
                            onChange={(e) => setAspectRatio(e.target.value)}
                            className="bg-gray-800 border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-studio-500"
                        >
                            <option value="16:9">16:9 Landscape</option>
                            <option value="9:16">9:16 Portrait</option>
                            <option value="1:1">1:1 Square</option>
                            <option value="4:3">4:3 Standard</option>
                        </select>

                        {activeTool === StudioTool.IMAGE_GEN && (
                             <select 
                                value={resolution} 
                                onChange={(e) => setResolution(e.target.value as any)}
                                className="bg-gray-800 border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-studio-500"
                            >
                                <option value="1K">1K Res</option>
                                <option value="2K">2K Res</option>
                                <option value="4K">4K Res</option>
                            </select>
                        )}
                        
                        {activeTool === StudioTool.VIDEO_GEN && (
                             <select 
                                value={veoRes} 
                                onChange={(e) => setVeoRes(e.target.value as any)}
                                className="bg-gray-800 border-none rounded-lg px-4 py-2 text-sm focus:ring-1 focus:ring-studio-500"
                            >
                                <option value="720p">720p (Fast)</option>
                                <option value="1080p">1080p (HQ)</option>
                            </select>
                        )}

                        <button 
                            onClick={handleGenerate}
                            disabled={!prompt || result?.loading}
                            className="ml-auto px-6 py-2 bg-gradient-to-r from-studio-600 to-indigo-600 hover:from-studio-500 hover:to-indigo-500 rounded-lg font-semibold flex items-center transition-all disabled:opacity-50"
                        >
                            {result?.loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Wand2 className="w-4 h-4 mr-2"/>}
                            Generate
                        </button>
                    </div>
                </div>

                {/* Result Area */}
                {result && (
                    <div className="mt-8 border-t border-gray-800 pt-8 animate-fade-in">
                        {result.loading ? (
                            <div className="flex flex-col items-center justify-center h-64 bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
                                <Loader2 className="w-10 h-10 text-studio-500 animate-spin mb-4" />
                                <p className="text-gray-400">Creating your masterpiece... This might take a moment.</p>
                            </div>
                        ) : result.error ? (
                            <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl flex items-center text-red-200">
                                <AlertCircle className="w-5 h-5 mr-3" />
                                {result.error}
                            </div>
                        ) : (
                            <div className="rounded-xl overflow-hidden border border-gray-700 bg-gray-900 shadow-2xl">
                                {result.type === 'image' && result.url && (
                                    <img src={result.url} alt="Generated" className="w-full h-auto object-contain max-h-[600px]" />
                                )}
                                {result.type === 'video' && result.url && (
                                    <video src={result.url} controls autoPlay loop className="w-full h-auto max-h-[600px]" />
                                )}
                                <div className="p-4 bg-gray-800 flex justify-between items-center">
                                    <span className="text-sm text-gray-400">Generated successfully</span>
                                    {result.url && (
                                        <a href={result.url} download="studio_gen" className="text-studio-400 hover:text-white flex items-center text-sm">
                                            <Download className="w-4 h-4 mr-1" /> Save
                                        </a>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

            </div>
        </div>
    </div>
  );
};

export default CreativeStudio;