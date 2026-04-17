import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // 🟢 התיקון הסופר-חשוב: מושכים את המפתח מתוך משתני הסביבה המאובטחים של וורסל!
    const API_KEY = process.env.GEMINI_API_KEY; 

    if (!API_KEY) {
      return NextResponse.json({ error: "API key is missing in environment variables." }, { status: 500 });
    }

    const cleanKey = API_KEY.trim();

    // שואלים את גוגל אילו מודלים פתוחים וזמינים
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    const modelsData = await modelsRes.json();
    
    if (!modelsRes.ok) {
      return NextResponse.json({ error: "Key validation failed: " + JSON.stringify(modelsData) }, { status: 500 });
    }

    const usableModels = (modelsData.models || []).filter((m: any) => 
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
    );

    const bestModel = usableModels.find((m: any) => m.name.includes("1.5-flash")) 
                   || usableModels.find((m: any) => m.name.includes("flash")) 
                   || usableModels[0];

    if (!bestModel) {
      return NextResponse.json({ error: "No valid models found for your API key." }, { status: 500 });
    }

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