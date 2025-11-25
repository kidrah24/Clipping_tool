import React, { useState } from 'react';
import { AppState, Clip, VideoMetadata, AnalysisError } from './types';
import { analyzeVideoForClips } from './services/geminiService';
import VideoUploader from './components/VideoUploader';
import AnalysisView from './components/AnalysisView';
import ClipResult from './components/ClipResult';
import { Scissors, Zap, Video as VideoIcon, HelpCircle, X, Sparkles } from 'lucide-react';

interface AnalysisConfig {
  timeRange?: { start: string; end: string };
  clipCount: number;
}

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoMetadata, setVideoMetadata] = useState<VideoMetadata | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [error, setError] = useState<AnalysisError | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const handleProcessStart = async (file: File, config: AnalysisConfig) => {
    // Basic validation
    if (file.size > 250 * 1024 * 1024) { // 250MB hard cap warning for demo
       alert("File is too large for this browser-based demo. Please use a file under 250MB.");
       return;
    }

    setAppState(AppState.UPLOADING);
    setVideoFile(file);
    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setVideoMetadata({
      name: file.name,
      size: file.size,
      type: file.type,
      url: url,
      duration: 0 // Will be set by player if needed
    });

    // Start analysis with config
    handleAnalysis(file, config);
  };

  const handleAnalysis = async (file: File, config: AnalysisConfig) => {
    setAppState(AppState.ANALYZING);
    setError(null);

    try {
      const results = await analyzeVideoForClips(file, config);
      setClips(results);
      setAppState(AppState.RESULTS);
    } catch (err: any) {
      console.error(err);
      setError({
        message: "Failed to analyze video.",
        details: err.message || "Unknown error occurred with Gemini API."
      });
      setAppState(AppState.ERROR);
    }
  };

  const resetApp = () => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setAppState(AppState.IDLE);
    setVideoFile(null);
    setVideoUrl(null);
    setVideoMetadata(null);
    setClips([]);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      
      {/* Navbar */}
      <nav className="border-b border-white/5 bg-slate-950/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2 cursor-pointer" onClick={resetApp} role="button">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2 rounded-lg">
                <Scissors className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                ClipMind
              </span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <button 
                onClick={() => setShowHelp(true)}
                className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>How it works</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
                <button 
                    onClick={() => setShowHelp(false)}
                    className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-indigo-500" />
                    How ClipMind Works
                </h2>
                <div className="space-y-5 text-slate-300">
                    <p className="leading-relaxed">
                        ClipMind uses advanced Gemini AI (2.5 Flash) to watch your long-form content and automatically extract viral-worthy moments suitable for Shorts, Reels, and TikTok.
                    </p>
                    <ol className="space-y-4 list-decimal pl-5 marker:text-indigo-500 marker:font-bold">
                        <li>
                            <span className="text-white font-semibold block mb-1">Upload Video</span>
                            <span className="text-sm text-slate-400">Provide a video file or paste a direct link (MP4/MOV). Direct video processing runs securely in your browser.</span>
                        </li>
                        <li>
                            <span className="text-white font-semibold block mb-1">AI Analysis</span>
                            <span className="text-sm text-slate-400">Our model analyzes the video to identify narrative hooks, jokes, emotional peaks, and self-contained stories.</span>
                        </li>
                        <li>
                            <span className="text-white font-semibold block mb-1">Smart Slicing</span>
                            <span className="text-sm text-slate-400">We precisely cut 30-60s segments that stand alone perfectly, ensuring no awkward cut-offs.</span>
                        </li>
                        <li>
                            <span className="text-white font-semibold block mb-1">Auto-Captions</span>
                            <span className="text-sm text-slate-400">We generate synchronized, viral-style karaoke captions to maximize engagement.</span>
                        </li>
                    </ol>
                </div>
                <div className="mt-8 pt-5 border-t border-slate-800 flex justify-end">
                    <button 
                        onClick={() => setShowHelp(false)}
                        className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-500/20"
                    >
                        Got it
                    </button>
                </div>
            </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {appState === AppState.IDLE && (
          <div className="space-y-16 animate-in fade-in duration-700">
            <div className="text-center space-y-6 max-w-3xl mx-auto">
              <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tight leading-tight">
                Turn long videos into <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Viral Shorts</span> instantly.
              </h1>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Upload your podcast, webinar, or long-form video. Our AI automatically identifies the most engaging hooks and extracts perfect clips for TikTok, Reels, and Shorts.
              </p>
            </div>

            <VideoUploader onProcessStart={handleProcessStart} isProcessing={false} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-800">
              {[
                { icon: Zap, title: "AI-Powered Detection", desc: "Identifies high-energy moments and emotional hooks automatically." },
                { icon: VideoIcon, title: "Auto-Framing", desc: "Analyzes context to ensure the best segments are chosen." },
                { icon: Scissors, title: "Instant Slicing", desc: "Get start/end timestamps and virality scores in seconds." }
              ].map((feature, idx) => (
                <div key={idx} className="flex flex-col items-center text-center p-4">
                  <div className="bg-slate-900 p-3 rounded-xl mb-4 ring-1 ring-white/5">
                    <feature.icon className="w-6 h-6 text-slate-400" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{feature.title}</h3>
                  <p className="text-sm text-slate-500">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {(appState === AppState.UPLOADING || appState === AppState.ANALYZING) && (
          <AnalysisView />
        )}

        {appState === AppState.RESULTS && videoUrl && (
          <ClipResult 
            clips={clips} 
            videoUrl={videoUrl} 
            metadata={videoMetadata}
            onReset={resetApp}
          />
        )}

        {appState === AppState.ERROR && (
          <div className="max-w-md mx-auto text-center py-20 animate-in fade-in zoom-in duration-300">
            <div className="bg-red-500/10 text-red-400 p-4 rounded-full inline-block mb-4 border border-red-500/20">
              <Scissors className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Something went wrong</h3>
            <p className="text-slate-400 mb-6 px-4">{error?.message || "We couldn't process your video."}</p>
            
            <div className="text-left bg-slate-900/50 p-4 rounded-lg border border-slate-800 mb-6 max-h-32 overflow-y-auto">
                <p className="text-xs text-slate-500 font-mono break-all">
                    {error?.details || "No technical details available."}
                </p>
            </div>

            <button 
              onClick={resetApp}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-lg shadow-indigo-500/20"
            >
              Try Again
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;