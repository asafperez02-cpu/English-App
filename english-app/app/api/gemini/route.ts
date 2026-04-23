import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY; 

    if (!OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OpenAI API Key" }, { status: 500 });
    }

    const isJsonRequest = body.prompt.includes("strictly valid JSON");
    
    // שדרוג הפרומפט: כפיית עברית מדוברת ויומיומית על פני עברית מילונית עתיקה
    let finalPrompt = body.prompt;
    if (isJsonRequest) {
      finalPrompt = body.prompt.replace(
        '"translation": precise Hebrew translation',
        '"translation": "Provide the most common, everyday conversational Hebrew translation first. Avoid overly formal or archaic words (e.g., explicitly translate \'anniversary\' as \'יום השנה / יום נישואים\' and NEVER \'יובל\'). If there are two very common distinct meanings, provide both separated by a slash (/)."'
      );
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4o", 
        messages: [{ role: "user", content: finalPrompt }],
        response_format: isJsonRequest ? { type: "json_object" } : { type: "text" },
        // הורדתי את הטמפרטורה עוד יותר ל-0.1 כדי שיהיה מדויק כמו סכין מנתחים
        temperature: 0.1 
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