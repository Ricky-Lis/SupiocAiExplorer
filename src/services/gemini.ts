import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY || "";

export const getAI = (customKey?: string) => {
  return new GoogleGenAI({ apiKey: customKey || apiKey });
};
