import React from 'react';
import { Loader2, Sparkles } from 'lucide-react';

const AnalysisView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center py-20 animate-in fade-in zoom-in duration-500">
      <div className="relative">
        <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
        <div className="relative bg-slate-900 p-6 rounded-full ring-1 ring-white/10 shadow-2xl">
          <Loader2 className="w-12 h-12 text-indigo-400 animate-spin" />
        </div>
      </div>
      
      <h2 className="mt-8 text-2xl font-bold text-white tracking-tight">
        Analyzing Video Content
      </h2>
      <p className="mt-3 text-slate-400 text-center max-w-md">
        Gemini AI is watching your video, identifying key moments, and measuring viral potential...
      </p>

      <div className="mt-8 flex items-center space-x-3 text-sm text-indigo-300 bg-indigo-500/10 px-4 py-2 rounded-full">
        <Sparkles className="w-4 h-4" />
        <span>Extracting highlights...</span>
      </div>
    </div>
  );
};

export default AnalysisView;