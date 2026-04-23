import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OpenAI API Key" }, { status: 500 });
    }

    const isJsonRequest = body.prompt.includes("strictly valid JSON");
    
    // שדרוג הפרומפט אם זה חיפוש מילה (ולא צ'אט)
    let finalPrompt = body.prompt;
    if (isJsonRequest) {
      finalPrompt = body.prompt.replace(
        '"translation": precise Hebrew translation',
        '"translation": "Provide the most accurate, context-aware Hebrew dictionary translation. If the word has multiple common but distinctly different meanings (e.g., bark = נביחה / קליפת עץ), provide the top 2 meanings separated by a slash (/). Act as an expert lexicographer."'
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        // 🚀 המעבר למנוע הדגל - החכם והמדויק ביותר של OpenAI
        model: "gpt-4o", 
        messages: [{ role: "user", content: finalPrompt }],
        response_format: isJsonRequest ? { type: "json_object" } : { type: "text" },
        // הורדת הטמפרטורה ל-0.2 הופכת אותו לפחות "יצירתי" ויותר מדויק ועובדתי
        temperature: 0.2 
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || "OpenAI API Error");
    }

    return NextResponse.json({ text: data.choices[0].message.content });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}