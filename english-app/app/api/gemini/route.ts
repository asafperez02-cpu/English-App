import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const API_KEY = process.env.GEMINI_API_KEY; 

    if (!API_KEY) {
      return NextResponse.json({ error: "Missing API Key" }, { status: 500 });
    }

    // 🟢 מנוע טורבו: פנייה ישירה למודל 2.0 הכי חדש ומהיר של גוגל!
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY.trim()}`,
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
      throw new Error(data.error?.message || "API Error");
    }

    return NextResponse.json({ text: data.candidates[0].content.parts[0].text });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}