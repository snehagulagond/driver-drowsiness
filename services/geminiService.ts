import { GoogleGenAI } from "@google/genai";
import { AlertLog, DetectionStats } from "../types";

const processStats = async (stats: DetectionStats, logs: AlertLog[]): Promise<string> => {
  if (!process.env.API_KEY) {
    return "API Key not configured. Unable to generate report.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const prompt = `
    You are an AI Driving Safety Instructor. Analyze the following driving session data and provide a concise, safety-focused summary and recommendation.
    
    Session Stats:
    - Total Yawns: ${stats.yawnCount}
    - Drowsiness Events: ${stats.drowsyCount}
    - Average Heart Rate: ${stats.heartRate} bpm
    
    Event Log (Last 10 events):
    ${logs.slice(-10).map(l => `- [${l.timestamp}] ${l.type}: ${l.details}`).join('\n')}
    
    Instructions:
    1. Rate the driver's fatigue level (Low/Medium/High/Critical).
    2. Provide specific advice based on the frequency of yawns and drowsiness.
    3. Keep it under 100 words.
    4. Use a professional but caring tone.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text || "No analysis generated.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Failed to generate safety report. Please check your network connection.";
  }
};

export const geminiService = {
  processStats
};