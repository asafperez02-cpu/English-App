import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY; 

    if (!API_KEY) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    // 🟢 שימוש בגרסת הייצור היציבה ביותר של מודל הפרו (V1)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-pro:generateContent?key=${API_KEY.trim()}`,
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
      // אם גוגל עדיין טוען לעומס, נחזיר שגיאה מפורטת כדי שנדע מה קורה
      throw new Error(data.error?.message || "API Error");
    }

    return NextResponse.json({ text: data.candidates[0].content.parts[0].text });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}