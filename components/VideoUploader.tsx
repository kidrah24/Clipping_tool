import React, { useCallback, useState, useRef, useEffect } from 'react';
import { Upload, FileVideo, AlertCircle, Link as LinkIcon, Settings2, Play, CheckCircle2, X, Hash, Loader2 } from 'lucide-react';

interface AnalysisConfig {
  timeRange?: { start: string; end: string };
  clipCount: number;
}

interface VideoUploaderProps {
  onProcessStart: (file: File, config: AnalysisConfig) => void;
  isProcessing: boolean;
}

const VideoUploader: React.FC<VideoUploaderProps> = ({ onProcessStart, isProcessing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Staging state (File selected but not confirmed)
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Configuration state
  const [useCustomRange, setUseCustomRange] = useState(false);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("00:00");
  const [clipCount, setClipCount] = useState(3);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('video/')) {
        handleFileSelection(file);
      } else {
        setErrorMessage("Please upload a valid video file (MP4, MOV, WEBM).");
      }
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFileSelection(e.target.files[0]);
    }
  };

  const handleFileSelection = (file: File) => {
    setSelectedFile(file);
    setUseCustomRange(false);
    setErrorMessage(null);
    // Reset times
    setStartTime("00:00");
    setEndTime("00:00");
    setClipCount(3);
  };

  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput) return;
    setErrorMessage(null);
    const url = urlInput.trim();

    // Check for YouTube or other major platforms that strictly block CORS/Direct Access
    // Improved regex to catch subdomains (m.youtube, etc) and ensuring case insensitivity
    if (url.match(/(youtube\.com|youtu\.be|tiktok\.com|instagram\.com|vimeo\.com|dailymotion\.com)/i)) {
        setErrorMessage(
            "⚠️ UNSUPPORTED LINK TYPE\n\n" +
            "YouTube, Instagram, TikTok, and Vimeo do not allow direct browser access to their videos due to security restrictions (CORS).\n\n" +
            "HOW TO FIX:\n" +
            "1. Download the video to your computer first.\n" +
            "2. Click 'Browse Files' above to upload the file here."
        );
        return;
    }

    setIsDownloading(true);

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned ${response.status} ${response.statusText}`);
        }

        const blob = await response.blob();
        
        if (!blob.type.startsWith('video/')) {
             if (blob.type.includes('text/html')) {
                throw new Error(
                    "This link points to a WEBPAGE, not a video file.\n\n" +
                    "Please provide a DIRECT link to the media file (usually ending in .mp4, .mov, or .webm).\n" +
                    "Links to 'watch pages' or players will not work."
                );
             }
             if (blob.type.includes('text/plain')) {
                throw new Error("This link returned text, not a video.");
             }
             throw new Error(`URL returned '${blob.type}' which is not a valid video file.`);
        }

        // Try to get filename from URL or default
        const filename = url.split('/').pop()?.split('#')[0].split('?')[0] || "downloaded_video.mp4";
        const file = new File([blob], filename, { type: blob.type });

        handleFileSelection(file);
        setUrlInput(''); 

    } catch (error: any) {
        console.error("Download failed:", error);
        let msg = error.message;
        // Detect likely CORS failure
        if (error.name === 'TypeError' && msg === 'Failed to fetch') {
            msg = "Access Blocked (CORS): The server hosting this video does not allow direct browser downloads.\n\nTry downloading the file to your computer first, then upload it.";
        }
        setErrorMessage(msg);
    } finally {
        setIsDownloading(false);
    }
  };

  // Helper to format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Load video metadata to get duration
  useEffect(() => {
    if (selectedFile && videoRef.current) {
        const url = URL.createObjectURL(selectedFile);
        videoRef.current.src = url;
        videoRef.current.onloadedmetadata = () => {
            if (videoRef.current) {
                const dur = videoRef.current.duration;
                setVideoDuration(dur);
                setEndTime(formatTime(dur));
            }
            URL.revokeObjectURL(url);
        };
    }
  }, [selectedFile]);

  const handleSubmit = () => {
    if (!selectedFile) return;

    if (videoDuration < 30) {
        setErrorMessage("Video is too short! To generate 30-60 second clips, please upload a video longer than 30 seconds.");
        return;
    }
    
    const config: AnalysisConfig = {
        clipCount,
        timeRange: useCustomRange ? { start: startTime, end: endTime } : undefined
    };

    onProcessStart(selectedFile, config);
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setVideoDuration(0);
    setErrorMessage(null);
  };

  // If a file is selected, show the configuration screen instead of the dropzone
  if (selectedFile) {
    return (
        <div className="w-full max-w-2xl mx-auto bg-slate-900 rounded-2xl border border-slate-700 p-8 shadow-2xl animate-in fade-in zoom-in duration-300">
            {/* Hidden video for metadata */}
            <video ref={videoRef} className="hidden" />

            <div className="flex items-start justify-between mb-8">
                <div className="flex items-center space-x-4">
                    <div className="p-3 bg-indigo-500/20 rounded-xl">
                        <FileVideo className="w-8 h-8 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">{selectedFile.name}</h3>
                        <p className="text-sm text-slate-400">
                            {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB • {formatTime(videoDuration)} Duration
                        </p>
                    </div>
                </div>
                <button 
                    onClick={clearSelection}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>
            
            {errorMessage && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-in fade-in">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div className="whitespace-pre-wrap font-medium">{errorMessage}</div>
                </div>
            )}

            <div className="space-y-6">
                <div className="bg-slate-950/50 rounded-xl p-4 border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-2 text-white font-medium">
                            <Settings2 className="w-5 h-5 text-indigo-400" />
                            <span>Analysis Settings</span>
                        </div>
                    </div>

                    <div className="space-y-6">
                        {/* Clip Count Selector */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center space-x-2 text-sm font-medium text-slate-200">
                                    <Hash className="w-4 h-4 text-slate-400" />
                                    <span>Number of Clips to Generate</span>
                                </label>
                                <span className="text-xs px-2 py-0.5 bg-indigo-500/20 text-indigo-300 rounded font-bold border border-indigo-500/30">
                                    {clipCount}
                                </span>
                            </div>
                            <div className="flex items-center space-x-4">
                                <span className="text-xs text-slate-500">1</span>
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={clipCount}
                                    onChange={(e) => setClipCount(parseInt(e.target.value))}
                                    className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:accent-indigo-400"
                                />
                                <span className="text-xs text-slate-500">10</span>
                            </div>
                        </div>

                        <div className="border-t border-slate-800 pt-4 space-y-4">
                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${!useCustomRange ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                    {!useCustomRange && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input 
                                    type="radio" 
                                    checked={!useCustomRange} 
                                    onChange={() => setUseCustomRange(false)}
                                    className="hidden" 
                                />
                                <div>
                                    <span className="block text-sm font-medium text-slate-200">Analyze Full Video</span>
                                    <span className="block text-xs text-slate-500">AI will search the entire video for clips</span>
                                </div>
                            </label>

                            <label className="flex items-center space-x-3 cursor-pointer group">
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${useCustomRange ? 'bg-indigo-500 border-indigo-500' : 'border-slate-600 group-hover:border-slate-500'}`}>
                                    {useCustomRange && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <input 
                                    type="radio" 
                                    checked={useCustomRange} 
                                    onChange={() => setUseCustomRange(true)}
                                    className="hidden" 
                                />
                                <div>
                                    <span className="block text-sm font-medium text-slate-200">Analyze Specific Time Range</span>
                                    <span className="block text-xs text-slate-500">Only search for clips within a specific segment</span>
                                </div>
                            </label>

                            {/* Custom Range Inputs */}
                            <div className={`grid grid-cols-2 gap-4 pl-8 transition-all duration-300 ${useCustomRange ? 'opacity-100 max-h-24' : 'opacity-50 max-h-24 grayscale pointer-events-none'}`}>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">Start Time (MM:SS)</label>
                                    <input 
                                        type="text" 
                                        value={startTime}
                                        onChange={(e) => setStartTime(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        placeholder="00:00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-slate-400 mb-1">End Time (MM:SS)</label>
                                    <input 
                                        type="text" 
                                        value={endTime}
                                        onChange={(e) => setEndTime(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                                        placeholder="05:00"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <button 
                    onClick={handleSubmit}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-500/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                >
                    <span>Generate Shorts with AI</span>
                    <Play className="w-5 h-5 fill-current" />
                </button>
            </div>
        </div>
    );
  }

  // Default Upload View
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={`relative group border-2 border-dashed rounded-2xl p-12 transition-all duration-300 ease-in-out text-center
          ${dragActive ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-900/50'}
          ${isProcessing || isDownloading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="p-4 bg-slate-800 rounded-full shadow-xl ring-1 ring-white/10 group-hover:scale-110 transition-transform duration-300">
            <Upload className="w-8 h-8 text-indigo-400" />
          </div>
          
          <div className="space-y-2">
            <h3 className="text-xl font-semibold text-white">Upload your video</h3>
            <p className="text-slate-400 text-sm max-w-sm mx-auto">
              Drag and drop your video file here, or click to browse.
              <br />
              <span className="text-xs text-slate-500 mt-2 block">
                Recommended: MP4, MOV (Max 50MB for demo speed)
              </span>
            </p>
          </div>

          <label className="relative inline-flex items-center justify-center px-6 py-2.5 overflow-hidden font-medium text-indigo-100 transition duration-300 ease-out border border-indigo-500/30 rounded-lg shadow-md group cursor-pointer bg-indigo-500/10 hover:bg-indigo-500/20">
            <span className="absolute inset-0 flex items-center justify-center w-full h-full text-white duration-300 -translate-x-full bg-indigo-600 group-hover:translate-x-0 ease">
              <FileVideo className="w-5 h-5" />
            </span>
            <span className="absolute flex items-center justify-center w-full h-full text-indigo-400 transition-all duration-300 transform group-hover:translate-x-full ease">Browse Files</span>
            <span className="relative invisible">Browse Files</span>
            <input 
              type="file" 
              className="hidden" 
              accept="video/*" 
              onChange={handleChange}
              disabled={isProcessing || isDownloading}
            />
          </label>
        </div>
      </div>

      <div className="mt-8 flex items-center w-full space-x-4">
        <div className="h-px bg-slate-800 flex-1"></div>
        <span className="text-slate-500 text-sm font-medium">OR USE LINK</span>
        <div className="h-px bg-slate-800 flex-1"></div>
      </div>

      <form onSubmit={handleUrlSubmit} className="mt-6 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <LinkIcon className="h-5 w-5 text-slate-500" />
          </div>
          <input
            type="url"
            className="block w-full pl-10 pr-24 py-3 border border-slate-700 rounded-lg leading-5 bg-slate-900 text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition-colors"
            placeholder="Paste a direct link to .mp4 file..."
            value={urlInput}
            onChange={(e) => {
                setUrlInput(e.target.value);
                setErrorMessage(null);
            }}
            disabled={isProcessing || isDownloading}
          />
          <button
            type="submit"
            disabled={isProcessing || isDownloading || !urlInput}
            className="absolute inset-y-1 right-1 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Process"}
          </button>
      </form>
      
      {errorMessage && (
        <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3 text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="whitespace-pre-wrap font-medium">{errorMessage}</div>
        </div>
      )}
    </div>
  );
};

export default VideoUploader;