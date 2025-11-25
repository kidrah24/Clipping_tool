import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Clip, Caption } from "../types";

// Helper to convert file to Base64
const fileToGenerativePart = async (file: File): Promise<{ inlineData: { data: string; mimeType: string } }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve({
        inlineData: {
          data: base64Data,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Parse MM:SS to seconds
const parseTime = (timeStr: string): number => {
  if (!timeStr) return 0;
  // Remove any non-digit/colon characters just in case
  const cleanStr = timeStr.replace(/[^0-9:]/g, '');
  const parts = cleanStr.split(':').map(Number);
  
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  return 0;
};

interface AnalysisConfig {
  timeRange?: { start: string; end: string };
  clipCount?: number;
}

export const analyzeVideoForClips = async (
  videoFile: File, 
  config: AnalysisConfig = {}
): Promise<Clip[]> => {
  try {
    const { timeRange, clipCount = 3 } = config;
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key not found in environment variables.");
    }

    const ai = new GoogleGenAI({ apiKey });

    // Using gemini-2.5-flash for speed and video capability
    const modelId = "gemini-2.5-flash";

    const videoPart = await fileToGenerativePart(videoFile);

    const schema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "A catchy, viral-style title for the clip." },
          startTime: { type: Type.STRING, description: "Start timestamp in MM:SS format." },
          endTime: { type: Type.STRING, description: "End timestamp in MM:SS format." },
          description: { type: Type.STRING, description: "Why this clip is engaging." },
          viralScore: { type: Type.INTEGER, description: "A score from 1-10 on potential virality." },
          captions: {
            type: Type.ARRAY,
            description: "Dialogue/Captions for this specific clip with timestamps.",
            items: {
                type: Type.OBJECT,
                properties: {
                    text: { type: Type.STRING, description: "The spoken text." },
                    start: { type: Type.STRING, description: "Start time of the sentence (MM:SS) relative to the full video." },
                    end: { type: Type.STRING, description: "End time of the sentence (MM:SS) relative to the full video." }
                },
                required: ["text", "start", "end"]
            }
          }
        },
        required: ["title", "startTime", "endTime", "description", "viralScore", "captions"],
      },
    };

    let prompt = `
      You are an expert video editor and viral content strategist. 
      Your task is to analyze the provided video deeply and extract exactly ${clipCount} distinct, high-performing short clips suitable for YouTube Shorts, TikTok, or Instagram Reels.

      IMPORTANT: Output ONLY valid JSON. Do not wrap the response in markdown like \`\`\`json.

      STRICT DURATION CONSTRAINT:
      - Each clip MUST be between 30 seconds and 60 seconds long. 
      - DO NOT select clips shorter than 30 seconds.
      - DO NOT select clips longer than 60 seconds.
      
      CRITERIA FOR SELECTION:
      1. NARRATIVE ARC: The clip must tell a complete mini-story. It needs a clear Hook (beginning), Value/Context (middle), and Payoff/Conclusion (end).
      2. CONTINUOUS FLOW: Select continuous segments. Do not just pick a single punchline. We need the setup and the punchline.
      3. VALUE-DRIVEN: It must provide specific knowledge, a complete funny story, a strong opinion with reasoning, or a surprising fact with context.
      4. HOOK: The first 3 seconds must grab attention visually or verbally.
      5. PRECISION: Ensure the start and end times align perfectly with sentence boundaries. Do not cut off words.
    `;

    if (timeRange) {
      prompt += `
      CRITICAL RANGE CONSTRAINT: You MUST ONLY select clips that occur strictly between the timestamps ${timeRange.start} and ${timeRange.end} of the video. 
      Do not output any clips that start before ${timeRange.start} or end after ${timeRange.end}.
      `;
    }

    prompt += `
      CRITICAL: For each clip, you MUST generate a transcript (captions) synchronized with the video.
      Break the captions down into SHORT phrases (2 to 6 words maximum) suitable for fast-paced viral video subtitles.
      Timestamps for captions must be relative to the START of the original video (e.g. if clip starts at 10:00, caption starts at 10:00).
      
      LANGUAGE CONSTRAINT: All captions MUST be in ENGLISH. If the audio is in another language, provide the English translation for the captions.
      
      Return the result as a JSON array.
    `;

    const response = await ai.models.generateContent({
      model: modelId,
      contents: {
        role: 'user',
        parts: [
          videoPart,
          { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
        temperature: 0.4,
      },
    });

    const responseText = response.text;
    if (!responseText) throw new Error("No response from AI model.");

    // Sanitization: Remove markdown code blocks if present (Common Gemini behavior)
    const cleanedText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    let rawClips;
    try {
      rawClips = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error("JSON Parse Error. Raw text:", responseText);
      throw new Error("Failed to parse AI response. The model may have returned invalid JSON.");
    }

    if (!Array.isArray(rawClips)) {
      throw new Error("AI response was not a list of clips.");
    }

    return rawClips.map((clip: any, index: number) => ({
      id: `clip-${index}-${Date.now()}`,
      title: clip.title,
      startTime: clip.startTime,
      endTime: clip.endTime,
      startSeconds: parseTime(clip.startTime),
      endSeconds: parseTime(clip.endTime),
      description: clip.description,
      viralScore: clip.viralScore,
      captions: (clip.captions || []).map((cap: any) => ({
        text: cap.text,
        start: cap.start,
        end: cap.end,
        startSeconds: parseTime(cap.start),
        endSeconds: parseTime(cap.end)
      }))
    }));

  } catch (error) {
    console.error("Error analyzing video:", error);
    throw error;
  }
};