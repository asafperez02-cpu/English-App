import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OpenAI API Key" }, { status: 500 });
    }

    // הבדלה בין בקשת חיפוש מילון (שדורשת עיצוב JSON) לבקשת צ'אט רגילה
    const isJsonRequest = body.prompt.includes("strictly valid JSON");

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // המודל המהיר והמדויק של OpenAI
        messages: [{ role: "user", "content": body.prompt }],
        response_format: isJsonRequest ? { type: "json_object" } : { type: "text" },
        temperature: 0.7
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