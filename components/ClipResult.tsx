import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, ChevronRight, Share2, Sparkles, Clock, BarChart3, Download, Check, Loader2, Type as TypeIcon } from 'lucide-react';
import { Clip, VideoMetadata, Caption } from '../types';

interface ClipResultProps {
  clips: Clip[];
  videoUrl: string;
  metadata: VideoMetadata | null;
  onReset: () => void;
}

const ClipResult: React.FC<ClipResultProps> = ({ clips, videoUrl, metadata, onReset }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentClipId, setCurrentClipId] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<Clip | null>(null);
  const [showCaptions, setShowCaptions] = useState(true);
  
  // Progress State
  const [currentTime, setCurrentTime] = useState(0);
  const [progress, setProgress] = useState(0);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  useEffect(() => {
    if (clips.length > 0 && !activeClip) {
        setActiveClip(clips[0]);
        setCurrentClipId(clips[0].id);
        // Set initial time for the player
        if(videoRef.current) {
            videoRef.current.currentTime = clips[0].startSeconds;
            setCurrentTime(0);
            setProgress(0);
        }
    }
  }, [clips, activeClip]);

  // Helper for rounded rects
  const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };

  // --- Canvas Rendering Loop ---
  useEffect(() => {
    const render = () => {
        if (videoRef.current && canvasRef.current) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            if (ctx) {
                // Ensure canvas matches video dimensions
                if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
                    canvas.width = video.videoWidth || 640;
                    canvas.height = video.videoHeight || 360;
                }

                // Draw video frame
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

                // Draw Captions if enabled
                if (showCaptions && activeClip) {
                    const vidTime = video.currentTime;
                    // Find active caption index
                    const captionIndex = activeClip.captions.findIndex(
                        c => vidTime >= c.startSeconds && vidTime <= c.endSeconds
                    );

                    if (captionIndex !== -1) {
                        const currentCaption = activeClip.captions[captionIndex];
                        const words = currentCaption.text.trim().split(/\s+/);
                        
                        // Caption Style: Viral Short Style
                        // Font size depends on video height
                        const fontSize = Math.max(24, canvas.height * 0.05); 
                        ctx.font = `900 ${fontSize}px 'Inter', sans-serif`;
                        ctx.textAlign = 'left';
                        ctx.textBaseline = 'middle';

                        const spaceWidth = ctx.measureText(" ").width;
                        const wordMetrics = words.map(w => ctx.measureText(w.toUpperCase()));
                        
                        // Calculate total width of the line to center it
                        const totalTextWidth = wordMetrics.reduce((acc, m) => acc + m.width, 0) + (words.length - 1) * spaceWidth;
                        
                        let currentX = (canvas.width - totalTextWidth) / 2;
                        const y = canvas.height * 0.85; // Position at bottom 15%

                        // Time Logic for Word Highlighting
                        const captionDuration = currentCaption.endSeconds - currentCaption.startSeconds;
                        const timePassed = vidTime - currentCaption.startSeconds;
                        
                        // Estimate active word based on character count (linear distribution)
                        // This is a heuristic since we don't have word-level timestamps
                        const totalChars = currentCaption.text.length;
                        const charDuration = captionDuration / Math.max(1, totalChars);
                        
                        let charAccumulator = 0;
                        let activeWordIndex = -1;

                        for (let i = 0; i < words.length; i++) {
                             // Word length plus following space (approx)
                             const wLen = words[i].length + 1; 
                             const wStartTime = charAccumulator * charDuration;
                             const wEndTime = (charAccumulator + wLen) * charDuration;

                             if (timePassed >= wStartTime && timePassed < wEndTime) {
                                 activeWordIndex = i;
                                 break;
                             }
                             charAccumulator += wLen;
                        }
                        // Fallback: if timePassed > total but still in caption window, highlight last word
                        if (activeWordIndex === -1 && timePassed >= captionDuration * 0.9) {
                            activeWordIndex = words.length - 1;
                        }


                        // Draw Loop
                        words.forEach((word, index) => {
                            const w = word.toUpperCase();
                            const metrics = wordMetrics[index];

                            // Draw Highlight Box if active
                            if (index === activeWordIndex) {
                                ctx.save();
                                ctx.fillStyle = '#D946EF'; // Neon Purple
                                // Rotate slightly for dynamic effect
                                const paddingX = fontSize * 0.2;
                                const paddingY = fontSize * 0.15;
                                
                                // Draw Rounded Rect behind word
                                drawRoundedRect(
                                    ctx, 
                                    currentX - paddingX, 
                                    y - fontSize/2 - paddingY, 
                                    metrics.width + paddingX*2, 
                                    fontSize + paddingY*2, 
                                    8
                                );
                                ctx.fill();
                                ctx.restore();
                            }

                            // Draw Text Stroke (Black Outline)
                            ctx.lineJoin = 'round';
                            ctx.miterLimit = 2;
                            ctx.lineWidth = fontSize * 0.15;
                            ctx.strokeStyle = 'black';
                            ctx.strokeText(w, currentX, y);

                            // Draw Text Fill (White)
                            ctx.fillStyle = 'white';
                            ctx.fillText(w, currentX, y);

                            currentX += metrics.width + spaceWidth;
                        });
                    }
                }
            }
        }
        animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
        if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [activeClip, showCaptions]);


  // Handle video time updates for both playback and export
  const handleTimeUpdate = () => {
    if (videoRef.current && activeClip) {
      const vidTime = videoRef.current.currentTime;
      
      // Update UI Progress
      const clipDuration = activeClip.endSeconds - activeClip.startSeconds;
      const currentClipTime = Math.max(0, vidTime - activeClip.startSeconds);
      setCurrentTime(currentClipTime);
      setProgress((currentClipTime / clipDuration) * 100);

      // Handle Loop / Stop at end of clip
      if (vidTime >= activeClip.endSeconds) {
        if (isExporting) {
            finishExport();
        } else {
            videoRef.current.pause();
            videoRef.current.currentTime = activeClip.startSeconds;
            setIsPlaying(false); 
        }
      }

      // Update Export Progress Visuals
      if (isExporting) {
        setExportProgress((currentClipTime / clipDuration) * 100);
      }
    }
  };

  const playClip = (clip: Clip) => {
    if (videoRef.current) {
      // If we switch clips, reset everything
      setActiveClip(clip);
      setCurrentClipId(clip.id);
      videoRef.current.currentTime = clip.startSeconds;
      setCurrentTime(0);
      setProgress(0);
      
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          if (error.name !== 'AbortError') console.error("Playback failed:", error);
        });
      }
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (videoRef.current.paused) {
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            if (error.name !== 'AbortError') console.error("Playback failed:", error);
          });
        }
      } else {
        videoRef.current.pause();
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (videoRef.current && activeClip) {
        const newPercentage = parseFloat(e.target.value);
        const clipDuration = activeClip.endSeconds - activeClip.startSeconds;
        const newTime = activeClip.startSeconds + (clipDuration * (newPercentage / 100));
        videoRef.current.currentTime = newTime;
        setProgress(newPercentage);
        setCurrentTime(newTime - activeClip.startSeconds);
    }
  };

  // --- Export Logic ---

  const handleDownloadClip = async () => {
    if (!videoRef.current || !canvasRef.current || !activeClip) return;

    setIsExporting(true);
    setExportProgress(0);
    recordedChunksRef.current = [];

    // 1. Prepare for recording
    videoRef.current.pause();
    videoRef.current.currentTime = activeClip.startSeconds;

    // 2. Setup Stream from CANVAS (for visuals) and VIDEO (for audio)
    // @ts-ignore
    const canvasStream = canvasRef.current.captureStream(30); // 30 FPS
    
    // Attempt to get audio track from video element stream
    // @ts-ignore
    const videoStream = videoRef.current.captureStream ? videoRef.current.captureStream() : (videoRef.current as any).mozCaptureStream();
    const audioTrack = videoStream.getAudioTracks()[0];
    
    if (audioTrack) {
        canvasStream.addTrack(audioTrack);
    }
    
    // Check supported mime types
    const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9') 
        ? 'video/webm;codecs=vp9' 
        : 'video/webm';

    const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: 2500000 }); // 2.5 Mbps
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeClip.title.replace(/[^a-z0-9]/gi, '_')}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Cleanup
      setIsExporting(false);
      setExportProgress(0);
      
      // Reset video state
      if (videoRef.current) {
          videoRef.current.currentTime = activeClip.startSeconds;
      }
    };

    // 3. Start Recording & Playback
    recorder.start();
    const playPromise = videoRef.current.play();
    if (playPromise !== undefined) {
        playPromise.catch(err => {
            console.error("Export playback failed", err);
            setIsExporting(false);
        });
    }
  };

  const finishExport = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        if (videoRef.current) videoRef.current.pause();
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in slide-in-from-bottom-8 duration-700 relative">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-3xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400" />
            Viral Clips Generated
           </h2>
           <p className="text-slate-400 mt-1">Found 3 engaging segments from {metadata?.name}</p>
        </div>
        <button 
          onClick={onReset}
          disabled={isExporting}
          className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white border border-slate-700 rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          Process Another Video
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Player Section */}
        <div className="lg:col-span-2 space-y-4">
          <div className="relative aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
            
            {/* Hidden Video Source */}
            <video
              ref={videoRef}
              src={videoUrl}
              className="absolute opacity-0 pointer-events-none"
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => !isExporting && setIsPlaying(true)}
              onPause={() => !isExporting && setIsPlaying(false)}
              crossOrigin="anonymous"
              playsInline
              muted={false}
            />

            {/* Visible Canvas Player */}
            <canvas 
                ref={canvasRef}
                className="w-full h-full object-contain cursor-pointer"
                onClick={togglePlay}
            />
            
            {/* Export Overlay */}
            {isExporting && (
                <div className="absolute inset-0 z-50 bg-black/80 flex flex-col items-center justify-center space-y-4 backdrop-blur-sm">
                    <Loader2 className="w-12 h-12 text-indigo-500 animate-spin" />
                    <div className="text-center space-y-2">
                        <h3 className="text-xl font-bold text-white">Creating Clip with Captions...</h3>
                        <p className="text-slate-400 text-sm">Recording canvas output...</p>
                        <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                                className="h-full bg-indigo-500 transition-all duration-200" 
                                style={{ width: `${exportProgress}%` }}
                            ></div>
                        </div>
                        <p className="text-xs text-slate-500">{Math.round(exportProgress)}%</p>
                    </div>
                </div>
            )}

            {/* Custom Overlay Controls */}
            {/* Added pointer-events-none to container so it doesn't block clicks to canvas */}
            <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent transition-opacity duration-300 flex flex-col justify-end pointer-events-none ${isExporting ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}>
                {/* Re-enable pointer events for the controls themselves */}
                <div className="w-full p-4 space-y-3 pointer-events-auto">
                    
                    {/* Progress Bar */}
                    <input 
                        type="range"
                        min="0"
                        max="100"
                        step="0.1"
                        value={progress}
                        onChange={handleSeek}
                        className="w-full h-1 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-indigo-500 hover:h-1.5 transition-all"
                    />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={togglePlay}
                                className="text-white hover:text-indigo-400 transition-colors"
                            >
                                {isPlaying ? <Pause className="w-8 h-8 fill-current" /> : <Play className="w-8 h-8 fill-current" />}
                            </button>
                            <div className="text-white font-mono text-sm">
                                <span className="text-indigo-400 font-bold">{formatTime(currentTime)}</span>
                                <span className="text-slate-500 mx-2">/</span>
                                <span className="text-slate-300">{activeClip ? formatTime(activeClip.endSeconds - activeClip.startSeconds) : "00:00"}</span>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => setShowCaptions(!showCaptions)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${showCaptions ? 'bg-white text-black' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            <TypeIcon className="w-4 h-4" />
                            {showCaptions ? 'CC ON' : 'CC OFF'}
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Big Play button when paused */}
            {!isPlaying && !isExporting && (
                 <div 
                    onClick={togglePlay}
                    className="absolute inset-0 flex items-center justify-center cursor-pointer pointer-events-auto"
                 >
                    <div className="p-5 bg-indigo-600/90 rounded-full shadow-lg backdrop-blur-sm animate-pulse cursor-pointer">
                        <Play className="w-8 h-8 text-white fill-current translate-x-1" />
                    </div>
                 </div>
            )}
          </div>

          {activeClip && (
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                    <div>
                        <h3 className="text-xl font-semibold text-white mb-2">{activeClip.title}</h3>
                        <p className="text-slate-400 text-sm leading-relaxed max-w-xl">{activeClip.description}</p>
                    </div>
                    <div className="flex flex-col items-end gap-3 min-w-[140px]">
                         <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-sm font-medium border border-green-500/20">
                            <BarChart3 className="w-4 h-4" />
                            Viral Score: {activeClip.viralScore}/10
                        </div>
                        <button 
                          onClick={handleDownloadClip}
                          disabled={isExporting}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-all shadow-lg shadow-indigo-500/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isExporting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            {isExporting ? 'Generating...' : 'Download Clip'}
                        </button>
                    </div>
                </div>
            </div>
          )}
        </div>

        {/* Clip List Sidebar */}
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider px-1">Clip Selection</h3>
            <div className="space-y-3">
                {clips.map((clip) => (
                    <div 
                        key={clip.id}
                        onClick={() => !isExporting && playClip(clip)}
                        className={`
                            group cursor-pointer rounded-xl p-4 border transition-all duration-200 relative overflow-hidden
                            ${currentClipId === clip.id 
                                ? 'bg-indigo-600/10 border-indigo-500 ring-1 ring-indigo-500/50' 
                                : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-800'
                            }
                            ${isExporting ? 'opacity-50 pointer-events-none' : ''}
                        `}
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className={`
                                text-xs font-bold px-2 py-0.5 rounded uppercase
                                ${currentClipId === clip.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}
                            `}>
                                {clip.startTime} - {clip.endTime}
                            </span>
                             <div className="flex items-center gap-1 text-xs text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>{Math.round(clip.endSeconds - clip.startSeconds)}s</span>
                             </div>
                        </div>
                        <h4 className={`font-medium mb-1 line-clamp-2 ${currentClipId === clip.id ? 'text-indigo-100' : 'text-slate-300 group-hover:text-white'}`}>
                            {clip.title}
                        </h4>
                        
                        <div className="flex items-center justify-between mt-3">
                            <div className="flex space-x-1">
                                {[...Array(5)].map((_, i) => (
                                    <div key={i} className={`h-1 w-4 rounded-full ${i < (clip.viralScore / 2) ? 'bg-indigo-500' : 'bg-slate-700'}`}></div>
                                ))}
                            </div>
                            <button className={`p-1.5 rounded-full transition-colors ${currentClipId === clip.id ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                                <Play className="w-3 h-3 fill-current" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    </div>
  );
};

export default ClipResult;