import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 🔴 שים את מפתח ה-API שלך כאן:
    const API_KEY = "AIzaSyBZT-NqerijMu9sy2-4ZymfmTb4NKDbH2I"; 
    const cleanKey = API_KEY.trim();

    // 1. שואלים את גוגל אילו מודלים פתוחים וזמינים למפתח שלך!
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    const modelsData = await modelsRes.json();
    
    if (!modelsRes.ok) {
      return NextResponse.json({ error: "Key validation failed: " + JSON.stringify(modelsData) }, { status: 500 });
    }

    // 2. מסננים את הרשימה רק למודלים שמאפשרים יצירת תוכן
    const usableModels = (modelsData.models || []).filter((m: any) => 
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
    );

    // 3. בוחרים את המודל הראשון שזמין (מחפשים פלאש 1.5, אם אין אז כל פלאש, ואם אין אז כל מודל שפתוח)
    const bestModel = usableModels.find((m: any) => m.name.includes("1.5-flash")) 
                   || usableModels.find((m: any) => m.name.includes("flash")) 
                   || usableModels[0];

    if (!bestModel) {
      return NextResponse.json({ error: "No valid models found for your API key." }, { status: 500 });
    }

    console.log("Auto-selected model:", bestModel.name);

    // 4. שולחים את הבקשה למודל המדויק והזמין שמצאנו! אין יותר 404.
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${bestModel.name}:generateContent?key=${cleanKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: body.prompt }] }]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data.error?.message || "Error from Google API" }, { status: response.status });
    }

    const text = data.candidates[0].content.parts[0].text;
    return NextResponse.json({ text });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}