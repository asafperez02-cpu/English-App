'use server';

import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBZT-NqerijMu9sy2-4ZymfmTb4NKDbH2I"; // <-- הדבק כאן את המפתח שלך
const MODEL_NAME = "gemini-1.5-flash";

export async function fetchWordDefinitionAction(searchWord: string) {
  const genAI = new GoogleGenerativeAI(API_KEY.trim());
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = `
    The user searched for the English word: "${searchWord}". 
    1. Check for spelling errors. If it's a typo, correct it.
    2. Provide dictionary definition.
    3. Provide part of speech (e.g. noun, verb, adjective).
    4. Provide phonetic pronunciation (syllables separated by hyphens, UPPERCASE for stressed syllable).
    5. Provide past tense ONLY if it's a verb with a past tense, otherwise null.
    Return strictly valid JSON and nothing else: 
    {
      "original": "${searchWord}",
      "corrected": "correct english word",
      "isTypo": boolean,
      "partOfSpeech": "noun",
      "definition": "Detailed english dictionary explanation",
      "translation": "hebrew translation",
      "soundsLike": "pro-NUN-ci-a-tion",
      "synonyms": ["synonym1", "synonym2"],
      "pastTense": "past tense word or null",
      "example": "English example sentence."
    }`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function fetchWordComparisonAction(targetWord: string, originalWord: string) {
  const genAI = new GoogleGenerativeAI(API_KEY.trim());
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = `User studying "${originalWord}". Got confused with "${targetWord}". If Hebrew, translate to confusing English word. Return strictly valid JSON: {"text": "english word", "translation": "hebrew translation"}`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}

export async function fetchChatResponseAction(historyText: string, userMsg: string) {
  const genAI = new GoogleGenerativeAI(API_KEY.trim());
  const model = genAI.getGenerativeModel({ model: MODEL_NAME });
  const prompt = `You are a freestyle English conversation partner and coach. 
  Have a natural, flowing conversation. Do not act like a robot. 
  Track errors silently. 
  IF the user explicitly asks for 'feedback' or 'summary', respond ONLY with:
  - 📝 Conversational Feedback (Brief honest review of their flow)
  - 💡 2 Insights (Point out exactly 2 grammatical or phrasing mistakes they made and how to fix them).
  \nHistory:\n${historyText}\nUSER: ${userMsg}\nCOACH:`;
  
  const result = await model.generateContent(prompt);
  return result.response.text();
}