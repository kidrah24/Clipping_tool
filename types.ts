export interface Caption {
  text: string;
  start: string; // "MM:SS"
  end: string;   // "MM:SS"
  startSeconds: number;
  endSeconds: number;
}

export interface Clip {
  id: string;
  title: string;
  startTime: string; // Format "MM:SS"
  endTime: string;   // Format "MM:SS"
  startSeconds: number; // Calculated for player
  endSeconds: number;   // Calculated for player
  description: string;
  viralScore: number;
  captions: Caption[];
}

export interface VideoMetadata {
  name: string;
  duration: number;
  size: number;
  type: string;
  url: string;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
  ERROR = 'ERROR'
}

export interface AnalysisError {
  message: string;
  details?: string;
}