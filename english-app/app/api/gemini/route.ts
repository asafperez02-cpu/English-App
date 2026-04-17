import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    const API_KEY = process.env.GEMINI_API_KEY; 

    if (!API_KEY) {
      return NextResponse.json({ error: "API key is missing in environment variables." }, { status: 500 });
    }

    const cleanKey = API_KEY.trim();

    // 1. מבקשים מגוגל את רשימת המודלים הפתוחים
    const modelsRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${cleanKey}`);
    const modelsData = await modelsRes.json();
    
    if (!modelsRes.ok) {
      return NextResponse.json({ error: "Key validation failed." }, { status: 500 });
    }

    const usableModels = (modelsData.models || []).filter((m: any) => 
      m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")
    );

    // 2. יוצרים רשימת עדיפויות של מודלים לגיבוי
    const preferredModels = [
      usableModels.find((m: any) => m.name.includes("1.5-flash-8b")), // הכי מהיר ועמיד לעומסים
      usableModels.find((m: any) => m.name.includes("1.5-flash")),
      usableModels.find((m: any) => m.name.includes("gemini-pro")),
      usableModels[0] // גיבוי אחרון - כל מודל שעובד
    ].filter(Boolean);

    let lastError = "No valid models available.";
    let statusCode = 500;

    // 3. מנגנון הגיבוי: מנסים את המודלים אחד אחרי השני עד שמצליחים
    for (const model of preferredModels) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${model.name}:generateContent?key=${cleanKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: body.prompt }] }]
          })
        }
      );

      const data = await response.json();

      // אם הצלחנו, מחזירים את התשובה ועוצרים את הלולאה!
      if (response.ok) {
        const text = data.candidates[0].content.parts[0].text;
        return NextResponse.json({ text });
      } else {
        // אם גוגל החזירה שגיאה, נשמור אותה ונבדוק אם כדאי לנסות את המודל הבא בתור
        lastError = data.error?.message || "High demand on " + model.name;
        statusCode = response.status;
        
        // עומס (503) או חריגה זמנית ממכסה (429) או שגיאת שרת פנימית (500) הם סיבות להמשיך למודל הבא
        if (statusCode !== 503 && statusCode !== 429 && statusCode !== 500) {
          break; 
        }
      }
    }

    // יגיע לכאן רק אם כל המודלים היו בעומס קריטי או שקרסו
    return NextResponse.json({ error: lastError }, { status: statusCode });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}