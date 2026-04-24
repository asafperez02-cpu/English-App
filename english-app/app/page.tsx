'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  Search, Volume2, MessageSquare, Clock, Send, Loader2, 
  X, CheckCircle2, AlertCircle, Trash2, ChevronRight, Layers,
  HelpCircle, PenTool, Sparkles
} from 'lucide-react';

export default function StepByStepApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('home'); // home, history, difficult, chat
  const [word, setWord] = useState('');
  const [wordsList, setWordsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string, text: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [isCardFlipped, setIsCardFlipped] = useState(false);

  const [isJournalOpen, setIsJournalOpen] = useState(false);
  const [journalInput, setJournalInput] = useState('');
  const [journalChat, setJournalChat] = useState<{role: string, text: string, feedback?: any}[]>([]);
  const journalEndRef = useRef<HTMLDivElement>(null);

  const [insightLoading, setInsightLoading] = useState(false);
  const [activeInsightWord, setActiveInsightWord] = useState<string | null>(null);
  const [insightData, setInsightData] = useState<any>(null);

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date().toDateString());
    const savedChat = localStorage.getItem('fluency_chat');
    if (savedChat) setChatMessages(JSON.parse(savedChat));
    else setChatMessages([{ role: 'ai', text: 'Hey! I am your personal English coach. We can talk about anything—your day, work, or hobbies.' }]);
  }, []);

  useEffect(() => {
    if (isMounted && chatMessages.length > 0) localStorage.setItem('fluency_chat', JSON.stringify(chatMessages));
  }, [chatMessages, isMounted]);

  useEffect(() => {
    const q = query(collection(db, 'words'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const words: any[] = [];
      snapshot.forEach((doc) => words.push({ id: doc.id, ...doc.data() }));
      setWordsList(words);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => { if (activeTab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages, activeTab]);
  useEffect(() => { if (isJournalOpen) journalEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [journalChat, isJournalOpen]);

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const softVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Female') || v.name.includes('Samantha') || v.name.includes('UK'))) || voices.find(v => v.lang === 'en-US');
      if (softVoice) utterance.voice = softVoice;
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  };

  const fetchFromAPI = async (promptText: string) => {
    const res = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: promptText })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to fetch from API");
    return data.text;
  };

  const processAndSaveWord = async () => {
    const searchWord = word.toLowerCase().trim();
    if (!searchWord) return;
    const existingWord = wordsList.find(w => w.text === searchWord);
    if (existingWord && existingWord.definition) {
      await updateDoc(doc(db, 'words', existingWord.id), { createdAt: serverTimestamp() });
      setWord(''); return;
    }
    setLoading(true);
    try {
      const prompt = `
        The user searched for the English word: "${searchWord}". 
        Provide strictly valid JSON with no markdown and no extra text.
        1. "original": "${searchWord}"
        2. "corrected": correct english word
        3. "isTypo": boolean
        4. "partOfSpeech": noun/verb/adjective etc.
        5. "definition": clear dictionary explanation
        6. "translation": precise Hebrew translation
        7. "soundsLike": phonetic spelling with UPPERCASE for stressed syllable
        8. "synonyms": array of 2-3 synonyms
        9. "relatedNoun": if the word is a verb/adj, provide its noun form. If it IS a noun, return null.
        10. "relatedVerb": if the word is a noun/adj, provide its verb form. If it IS a verb, return null.
        11. "pastTense": if the word is a verb, provide its past tense. Otherwise return null.
        12. "example": A practical sentence using the word.
        13. "grammarNote": Strictly return null for 90% of words. Only provide a Hebrew string if the word has a highly irregular rule, a dangerous false-friend for Israelis, or a very tricky advanced nuance. NEVER output basic rules. If in doubt, return null.
        `;
      const rawText = await fetchFromAPI(prompt);
      const cleanText = rawText.replace(/```(json)?/gi, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleanText);
      const wordToSave = data.corrected.toLowerCase();
      
      if (existingWord) await updateDoc(doc(db, 'words', existingWord.id), { ...data, createdAt: serverTimestamp() });
      else {
        const correctedExisting = wordsList.find(w => w.text === wordToSave);
        if (correctedExisting) await updateDoc(doc(db, 'words', correctedExisting.id), { ...data, createdAt: serverTimestamp() });
        else await addDoc(collection(db, 'words'), { text: wordToSave, ...data, mastery: 'orange', isDifficult: false, createdAt: serverTimestamp(), dateString: new Date().toDateString() });
      }
      setWord('');
    } catch (e: any) { alert(`Error fetching data: ${e.message}`); }
    setLoading(false);
  };

  const fetchWordInsight = async (wordToExplain: string) => {
    if (activeInsightWord === wordToExplain) { setActiveInsightWord(null); return; }
    setActiveInsightWord(wordToExplain); setInsightData(null); setInsightLoading(true);
    try {
      const prompt = `The user wants an insight on the English word: "${wordToExplain}". Provide strictly valid JSON explaining its nuance IN ENGLISH. Format: {"usage": "Precise English explanation of exactly WHEN to use this word, highlighting its nuance compared to basic synonyms.", "context": "A short, practical English sentence showing it in action."}`;
      const rawText = await fetchFromAPI(prompt);
      const cleanText = rawText.replace(/```(json)?/gi, "").replace(/```/g, "").trim();
      setInsightData(JSON.parse(cleanText));
    } catch (e) { setInsightData({ usage: "Error loading insight.", context: "-" }); }
    setInsightLoading(false);
  };

  const handleJournalSend = async () => {
    if (!journalInput.trim()) return;
    const userText = journalInput.trim();
    setJournalChat(prev => [...prev, { role: 'user', text: userText }]);
    setJournalInput('');
    try {
      const prompt = `The user wrote a daily action in English to practice: "${userText}". Act as an expert English teacher. Provide strictly valid JSON feedback. {"isCorrect": boolean, "explanation": "Clear, encouraging explanation in Hebrew of any mistakes (if perfect, explain briefly why it's good)", "correction": "The grammatically correct version (if needed, else null)", "naturalAlternative": "A more native/natural/common way to say it (if applicable)"}`;
      const rawText = await fetchFromAPI(prompt);
      const cleanText = rawText.replace(/```(json)?/gi, "").replace(/```/g, "").trim();
      const feedbackData = JSON.parse(cleanText);
      setJournalChat(prev => [...prev, { role: 'ai', text: '', feedback: feedbackData }]);
    } catch (e) { setJournalChat(prev => [...prev, { role: 'ai', text: '', feedback: { explanation: "שגיאה בחיבור לשרת, נסה שוב." } }]); }
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    try {
      const history = chatMessages.slice(-10).map(m => `${m.role === 'ai' ? 'COACH' : 'USER'}: ${m.text}`).join('\n');
      const prompt = `You are a freestyle English conversation partner and expert language coach. The user wants to talk freely. CRITICAL RULE: Monitor their English. If they make ANY grammar or phrasing mistake, politely point it out, explain why, and show the correct way BEFORE continuing.\nHistory:\n${history}\nUSER: ${userMsg}\nCOACH:`;
      const responseText = await fetchFromAPI(prompt);
      setChatMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    } catch (e: any) { setChatMessages(prev => [...prev, { role: 'ai', text: `⚠️ Connection Error.` }]); }
  };

  const handleSwipeAction = async (id: string, action: 'green' | 'red') => {
    const wordRef = doc(db, 'words', id);
    if (action === 'green') await updateDoc(wordRef, { mastery: 'green', isDifficult: false });
    else await updateDoc(wordRef, { mastery: 'red', isDifficult: true });
  };

  const groupedHistory = useMemo(() => {
    const groups: any = { recent: {}, older: {} };
    if (!isMounted) return groups;
    const today = new Date(); today.setHours(0,0,0,0);
    wordsList.forEach(w => {
      const d = w.dateString || 'Unknown';
      const wordDate = new Date(d);
      const diffTime = Math.abs(today.getTime() - wordDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 7) {
        if (!groups.recent[d]) groups.recent[d] = [];
        groups.recent[d].push(w);
      } else {
        const weekNum = Math.ceil(diffDays / 7);
        const weekLabel = `Week ${weekNum} Ago`;
        if (!groups.older[weekLabel]) groups.older[weekLabel] = [];
        groups.older[weekLabel].push(w);
      }
    });
    return groups;
  }, [wordsList, isMounted]);

  const recentDates = Object.keys(groupedHistory.recent).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  const redWords = wordsList.filter(w => w.mastery === 'red' || w.isDifficult);
  const currentPracticeWord = redWords[activeCardIndex] || redWords[0];

  useEffect(() => { setIsCardFlipped(false); }, [activeCardIndex, currentPracticeWord?.id]);
  useEffect(() => { if (activeCardIndex >= redWords.length && redWords.length > 0) setActiveCardIndex(Math.max(0, redWords.length - 1)); }, [redWords.length, activeCardIndex]);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#3E322C] antialiased pb-24" dir="ltr">
      <header className="pt-10 pb-4 px-6 flex justify-center items-center">
         <div className="bg-[#1a2433] text-white font-black text-[22px] px-5 py-2.5 rounded-2xl tracking-wide shadow-md flex items-center justify-center select-none cursor-default">
           Fluency<span className="text-[#D97757]">.</span>
         </div>
      </header>

      <div className="max-w-md mx-auto px-5">
        
        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-500 pb-10">
            <div className="w-full relative mb-6">
              <input type="text" value={word} onChange={(e) => setWord(e.target.value)} placeholder="Search a word..." disabled={loading} className="w-full p-4 pl-12 bg-white rounded-2xl border border-[#EAE1D8] shadow-sm text-[16px] font-bold outline-none focus:border-[#D97757] transition-colors disabled:opacity-60" onKeyDown={(e) => e.key === 'Enter' && processAndSaveWord()} />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#A69B95]" size={18} />
              {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 text-[#D97757] animate-spin" size={18} />}
            </div>
            {loading ? (
              <div className="w-full flex flex-col items-center space-y-4 animate-pulse pt-8"><div className="h-12 bg-[#EAE1D8] rounded-xl w-3/4"></div><div className="h-4 bg-[#EAE1D8] rounded-lg w-1/2"></div><div className="h-48 w-full bg-white rounded-[2rem] mt-4"></div></div>
            ) : wordsList[0] ? (
              <div className="w-full bg-white p-8 rounded-[2rem] shadow-sm border border-[#EAE1D8] mb-8 relative">
                <div className="flex flex-col items-center justify-center text-center mb-8">
                  <h2 className="text-[44px] font-serif font-black capitalize text-[#3E322C] leading-none mb-4">{wordsList[0].text}</h2>
                  <div className="flex items-center gap-4 bg-[#FDFBF7] px-6 py-3 rounded-full border border-[#EAE1D8] shadow-sm cursor-pointer active:scale-95 transition-all" onClick={() => speak(wordsList[0].text)}>
                    <Volume2 size={22} className="text-[#D97757]" />
                    <div className="text-[17px] font-light text-[#A69B95] tracking-[0.2em] flex gap-2">
                      {wordsList[0].soundsLike?.split('-').map((p:any, i:any) => <span key={i} className={p === p.toUpperCase() ? "font-bold text-[#3E322C]" : ""}>{p.toLowerCase()}</span>)}
                    </div>
                  </div>
                </div>
                <div className="mb-6 pb-6 border-b border-[#F3EFE9] text-center">
                  <p className="text-[24px] font-bold text-[#7BA05B] mb-3">{wordsList[0].translation}</p>
                  {wordsList[0].partOfSpeech && <span className="text-[13px] font-bold text-[#4285F4] uppercase tracking-wider block mb-2">{wordsList[0].partOfSpeech}</span>}
                  <p className="text-[16px] text-[#3E322C] leading-snug">{wordsList[0].definition}</p>
                </div>
                <div className="mb-6 space-y-3">
                  {[{ label: "Verb", value: wordsList[0].relatedVerb }, { label: "Noun", value: wordsList[0].relatedNoun }, { label: "Past Tense", value: wordsList[0].pastTense }].map(item => item.value && (
                    <div key={item.label}>
                      <div className="flex items-baseline gap-2">
                         <span className="text-[13px] font-bold text-[#A69B95] w-24 shrink-0 text-left">{item.label}:</span>
                         <span className="text-[15px] font-bold text-[#3E322C] cursor-pointer hover:text-[#D97757] border-b border-dashed border-transparent hover:border-[#D97757] transition-all" onClick={() => fetchWordInsight(item.value)}>{item.value}</span>
                      </div>
                      {activeInsightWord === item.value && (
                        <div className="mt-2 p-4 bg-[#FDFBF7] border border-[#EAE1D8] rounded-xl text-left" dir="ltr">
                           {insightLoading ? <Loader2 size={16} className="animate-spin text-[#D97757] mx-auto" /> : insightData && (
                             <div className="text-sm space-y-2"><p><strong className="text-[#3E322C]">Usage:</strong> <span className="text-[#7A6D65]">{insightData.usage}</span></p><p><strong className="text-[#3E322C]">Example:</strong> <span className="text-[#7BA05B]">{insightData.context}</span></p></div>
                           )}
                        </div>
                      )}
                    </div>
                  ))}
                  {wordsList[0].synonyms && wordsList[0].synonyms.length > 0 && (
                     <div className="flex items-baseline gap-2 pt-1">
                       <span className="text-[13px] font-bold text-[#A69B95] w-24 shrink-0 text-left">Synonyms:</span>
                       <div className="flex flex-wrap gap-1.5">
                         {wordsList[0].synonyms.map((s: string, idx: number) => (
                           <span key={idx} onClick={() => fetchWordInsight(s)} className={`text-[13px] font-medium px-2 py-0.5 rounded-md border cursor-pointer transition-colors ${activeInsightWord === s ? 'bg-[#FCF8F2] border-[#F2DCC9] text-[#DDA77B]' : 'bg-[#FDFBF7] border-[#EAE1D8] text-[#3E322C] hover:border-[#D97757]'}`}>{s}</span>
                         ))}
                       </div>
                     </div>
                  )}
                  {wordsList[0].synonyms?.includes(activeInsightWord) && (
                      <div className="mt-2 p-4 bg-[#FCF8F2] border border-[#F2DCC9] rounded-xl text-left animate-in fade-in" dir="ltr">
                         {insightLoading ? <Loader2 size={16} className="animate-spin text-[#D97757] mx-auto" /> : insightData && (
                           <div className="text-sm space-y-2"><p><strong className="text-[#DDA77B] text-base">{activeInsightWord}</strong></p><p><strong className="text-[#3E322C]">Usage:</strong> <span className="text-[#7A6D65]">{insightData.usage}</span></p><p><strong className="text-[#3E322C]">Example:</strong> <span className="text-[#7BA05B] italic">"{insightData.context}"</span></p></div>
                         )}
                      </div>
                  )}
                </div>
                <div className="space-y-3">
                  <div className="bg-[#FCF8F2] p-5 rounded-2xl border border-[#F2DCC9]">
                    <p className="text-[16px] leading-relaxed text-[#DDA77B] font-medium italic">"{wordsList[0].example}"</p>
                  </div>
                  {wordsList[0].grammarNote && (
                    <div className="bg-[#F1F4EE] p-4 rounded-xl border border-[#DCE4D7] text-right" dir="rtl">
                      <p className="text-[11px] font-bold text-[#7BA05B] uppercase tracking-wider mb-1 flex items-center gap-1.5"><Sparkles size={14}/> ניואנס שחשוב להכיר</p>
                      <p className="text-[14px] text-[#3E322C] font-medium leading-snug">{wordsList[0].grammarNote}</p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* --- HISTORY TAB (RESTORED SWIPE) --- */}
        {activeTab === 'history' && (
          <div className="animate-in fade-in duration-500 mt-2">
            <div className="flex gap-4 overflow-x-auto pb-6 pt-4 px-2 no-scrollbar items-end">
              {recentDates.map(date => {
                const count = groupedHistory.recent[date]?.length || 0;
                const isSelected = selectedDate === date;
                const barHeight = Math.max(12, Math.min(40, count * 4)); 
                return (
                  <div key={date} className="flex flex-col items-center gap-2 cursor-pointer" onClick={() => setSelectedDate(date)}>
                    <span className="text-[10px] font-black text-[#A69B95]">{count}</span>
                    <div className={`w-8 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-[#3E322C]' : 'bg-[#EAE1D8]'}`} style={{ height: `${barHeight}px` }}></div>
                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${isSelected ? 'bg-[#3E322C] text-white shadow-md' : 'bg-white border border-[#EAE1D8] text-[#7A6D65]'}`}>
                      {date === new Date().toDateString() ? 'TODAY' : date.split(' ').slice(0, 1).join('')}
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-[10px] font-bold text-[#A69B95] text-center mb-4 mt-2 uppercase tracking-widest">Swipe Right = Practice • Swipe Left = Known</p>
            <div className="space-y-4 pb-10">
              {/* @ts-ignore */}
              {(groupedHistory.recent[selectedDate] || groupedHistory.older[selectedDate] || []).sort((a,b) => {
                 const order: any = { red: 1, orange: 2, green: 3 };
                 return (order[a.mastery] || 4) - (order[b.mastery] || 4);
              }).map((item: any) => (
                <SwipeableCard key={item.id} item={item} onSwipe={handleSwipeAction} onSpeak={speak} />
              ))}
            </div>
          </div>
        )}

        {/* --- PRACTICE TAB --- */}
        {activeTab === 'difficult' && (
          <div className="animate-in fade-in duration-500 h-[calc(100vh-140px)] flex flex-col pt-2 pb-6">
            <div className="flex-1 bg-white rounded-3xl border border-[#EAE1D8] overflow-hidden flex flex-col mb-4 shadow-sm">
              <div className="p-4 bg-[#FCF8F2] border-b border-[#EAE1D8] flex items-center justify-between">
                <h3 className="font-bold text-[#D97757] text-sm uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16}/> Words to Master ({redWords.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto p-2 no-scrollbar space-y-1">
                {redWords.length === 0 ? (
                   <p className="text-center text-sm text-[#A69B95] mt-10">No difficult words right now. Great job!</p>
                ) : (
                  redWords.map((w, idx) => (
                    <div key={w.id} onClick={() => setActiveCardIndex(idx)} className={`p-3 rounded-xl flex justify-between items-center transition-colors cursor-pointer ${idx === activeCardIndex ? 'bg-[#FDF6ED] border border-[#F2DCC9]' : 'hover:bg-[#FDFBF7]'}`}>
                      <span className={`font-bold capitalize ${idx === activeCardIndex ? 'text-[#3E322C]' : 'text-[#7A6D65]'}`}>{w.text}</span>
                      <span className="text-xs font-medium text-[#A69B95]">{w.translation}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="h-[260px] w-full relative shrink-0">
               {currentPracticeWord ? (
                 <div className="w-full h-full relative cursor-pointer" onClick={() => !isCardFlipped && setIsCardFlipped(true)}>
                   <div className={`absolute inset-0 bg-[#3E322C] rounded-[2rem] shadow-xl p-6 flex flex-col items-center justify-center transition-all duration-300 ${isCardFlipped ? 'opacity-0 scale-95 z-0 pointer-events-none' : 'opacity-100 scale-100 z-10'}`}>
                     <p className="text-white/60 text-xs uppercase tracking-widest font-bold mb-4">Tap to reveal</p>
                     <h2 className="text-4xl font-black text-white text-center">{currentPracticeWord.translation}</h2>
                   </div>
                   <div className={`absolute inset-0 bg-white border-2 border-[#D97757] rounded-[2rem] shadow-xl p-6 flex flex-col justify-between transition-all duration-300 ${isCardFlipped ? 'opacity-100 scale-100 z-10' : 'opacity-0 scale-95 z-0 pointer-events-none'}`}>
                     <div className="text-center mt-4">
                       <h2 className="text-3xl font-black font-serif text-[#3E322C] capitalize mb-1">{currentPracticeWord.text}</h2>
                       <p className="text-sm text-[#A69B95] tracking-widest mb-4">{currentPracticeWord.soundsLike?.toLowerCase()}</p>
                     </div>
                     <div className="flex gap-3 w-full">
                       <button onClick={(e) => { e.stopPropagation(); setIsCardFlipped(false); setActiveCardIndex(p => (p + 1) % redWords.length); }} className="flex-1 py-3 rounded-xl bg-[#FDF6ED] text-[#D97757] font-bold active:scale-95 transition-all text-sm">Still Hard</button>
                       <button onClick={async (e) => { e.stopPropagation(); await handleSwipeAction(currentPracticeWord.id, 'green'); }} className="flex-1 py-3 rounded-xl bg-[#7BA05B] text-white font-bold active:scale-95 transition-all shadow-md text-sm">Got it!</button>
                     </div>
                   </div>
                 </div>
               ) : (
                 <div className="w-full h-full bg-white border border-[#EAE1D8] rounded-[2rem] flex flex-col items-center justify-center text-[#A69B95]">
                   <CheckCircle2 size={40} className="mb-2 text-[#EAE1D8]"/>
                   <p className="font-bold">You're all caught up!</p>
                 </div>
               )}
            </div>
          </div>
        )}

        {/* --- CHAT TAB --- */}
        {activeTab === 'chat' && (
          <div className="flex flex-col animate-in fade-in" style={{ height: 'calc(100vh - 180px)' }}>
            <div className="flex justify-between items-center mb-3 px-2 bg-white/50 py-2 rounded-xl backdrop-blur-sm border border-[#EAE1D8]">
              <p className="text-[11px] text-[#D97757] font-bold uppercase tracking-wider flex items-center gap-1.5"><HelpCircle size={14}/> Grammar Coach</p>
              <button onClick={() => {localStorage.removeItem('fluency_chat'); setChatMessages([{ role: 'ai', text: 'Hey! I am your personal English coach. What is on your mind today?' }]);}} className="p-1.5 text-[#D97757] bg-white rounded-lg shadow-sm border border-[#F2DCC9]"><Trash2 size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-5 no-scrollbar pb-4 pr-1">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 max-w-[85%] rounded-[1.5rem] text-[16px] shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#3E322C] text-white rounded-br-sm' : 'bg-white text-[#3E322C] border border-[#EAE1D8] rounded-bl-sm font-serif'}`}>
                    {msg.text.split('\n').map((line, j) => <p key={j} className={line.startsWith('-') || line.startsWith('*') ? 'ml-3 mt-1 font-bold text-[#D97757]' : 'mt-1'}>{line}</p>)}
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="relative shrink-0 mt-2">
              <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onFocus={() => setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 300)} placeholder="Tell me about your day..." className="w-full p-4 pr-14 bg-white rounded-2xl border border-[#EAE1D8] shadow-sm text-[16px] outline-none focus:border-[#D97757] transition-colors" onKeyDown={(e) => e.key === 'Enter' && handleChatSend()} />
              <button onClick={handleChatSend} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-[#D97757] text-white rounded-xl shadow-md active:scale-90 transition-all"><Send size={16} /></button>
            </div>
          </div>
        )}

      </div>

      <button onClick={() => setIsJournalOpen(true)} className="fixed bottom-24 right-6 p-4 bg-[#3E322C] text-white rounded-full shadow-2xl active:scale-90 transition-all z-40 hover:bg-[#D97757]">
        <PenTool size={24} />
      </button>

      {isJournalOpen && (
        <div className="fixed inset-0 bg-[#3E322C]/40 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center sm:p-5 animate-in fade-in">
          <div className="bg-[#FDFBF7] w-full max-w-md h-[85vh] sm:h-[80vh] sm:rounded-[2rem] rounded-t-[2rem] shadow-2xl relative flex flex-col border border-[#EAE1D8] animate-in slide-in-from-bottom-10">
            <div className="p-5 border-b border-[#EAE1D8] flex justify-between items-center bg-white rounded-t-[2rem]">
              <div>
                <h3 className="text-xl font-black text-[#3E322C] flex items-center gap-2"><PenTool size={20} className="text-[#D97757]"/> Daily Log</h3>
                <p className="text-xs text-[#A69B95]">Write what you're doing right now.</p>
              </div>
              <button onClick={() => setIsJournalOpen(false)} className="p-2 bg-[#FDFBF7] rounded-full text-[#7A6D65]"><X size={20} /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar">
              {journalChat.length === 0 && (
                <div className="text-center mt-10 opacity-50">
                  <p className="text-[14px] font-bold text-[#7A6D65]">Example:</p>
                  <p className="text-[16px] text-[#3E322C] italic mt-2">"I am going to making coffee"</p>
                </div>
              )}
              {journalChat.map((msg, i) => (
                <div key={i} className="flex flex-col">
                   {msg.role === 'user' && (
                     <div className="self-end bg-[#3E322C] text-white p-4 rounded-2xl rounded-tr-sm max-w-[85%] text-[16px] shadow-sm mb-4">
                       "{msg.text}"
                     </div>
                   )}
                   {msg.role === 'ai' && msg.feedback && (
                     <div className="self-start w-full bg-white border border-[#EAE1D8] p-5 rounded-2xl shadow-sm text-right" dir="rtl">
                        <div className="flex items-center gap-2 mb-3">
                           {msg.feedback.isCorrect ? <CheckCircle2 size={20} className="text-[#7BA05B]"/> : <AlertCircle size={20} className="text-[#D97757]"/>}
                           <span className={`font-bold text-[14px] ${msg.feedback.isCorrect ? 'text-[#7BA05B]' : 'text-[#D97757]'}`}>
                             {msg.feedback.isCorrect ? 'מצוין!' : 'יש פה טעות קטנה'}
                           </span>
                        </div>
                        <p className="text-[14px] text-[#3E322C] mb-4">{msg.feedback.explanation}</p>
                        
                        {msg.feedback.correction && !msg.feedback.isCorrect && (
                          <div className="bg-[#FCF8F2] p-3 rounded-xl mb-2 text-left" dir="ltr">
                            <span className="text-[10px] font-bold text-[#DDA77B] uppercase tracking-widest block mb-1">CORRECTION</span>
                            <span className="text-[16px] font-serif font-black text-[#3E322C]">{msg.feedback.correction}</span>
                          </div>
                        )}
                        {msg.feedback.naturalAlternative && (
                          <div className="bg-[#F1F4EE] p-3 rounded-xl text-left" dir="ltr">
                            <span className="text-[10px] font-bold text-[#7BA05B] uppercase tracking-widest block mb-1">NATIVE WAY TO SAY IT</span>
                            <span className="text-[16px] font-serif font-black text-[#3E322C]">{msg.feedback.naturalAlternative}</span>
                          </div>
                        )}
                     </div>
                   )}
                </div>
              ))}
              <div ref={journalEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-[#EAE1D8]">
              <div className="relative">
                <input type="text" value={journalInput} onChange={(e) => setJournalInput(e.target.value)} placeholder="I am..." className="w-full p-4 pr-14 bg-[#FDFBF7] rounded-2xl border border-[#EAE1D8] text-[16px] outline-none focus:border-[#D97757]" onKeyDown={(e) => e.key === 'Enter' && handleJournalSend()} />
                <button onClick={handleJournalSend} className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-[#D97757] text-white rounded-xl shadow-md"><Send size={16} /></button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-[#EAE1D8] px-6 py-4 flex justify-between items-end z-30 shadow-[0_-10px_40px_rgba(62,50,44,0.03)] pb-6">
        <NavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Search size={22} />} label="Search" />
        <NavBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Clock size={22} />} label="History" />
        <NavBtn active={activeTab === 'difficult'} onClick={() => setActiveTab('difficult')} icon={<Layers size={22} />} label="Practice" />
        <NavBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={22} />} label="Coach" />
      </footer>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all w-16 relative ${active ? 'text-[#3E322C] scale-105' : 'text-[#A69B95]'}`}>
      <div className={`p-2.5 rounded-[1.2rem] transition-colors ${active ? 'bg-[#FCF8F2] text-[#DDA77B] shadow-sm border border-[#F2DCC9]' : ''}`}>{icon}</div>
      <span className={`text-[10px] uppercase tracking-widest ${active ? 'font-black text-[#3E322C]' : 'font-bold'}`}>{label}</span>
    </button>
  );
}

// RESTORED SWIPE COMPONENT
function SwipeableCard({ item, onSwipe, onSpeak }: any) {
  const [swipeOffset, setSwipeOffset] = useState(0);
  const startX = useRef(0);
  const handleTouchMove = (e: any) => {
    const diff = e.touches[0].clientX - startX.current;
    if (Math.abs(diff) < 120) setSwipeOffset(diff);
  };
  const handleTouchEnd = () => {
    if (swipeOffset > 60) onSwipe(item.id, 'red');
    else if (swipeOffset < -60) onSwipe(item.id, 'green');
    setSwipeOffset(0);
  };
  return (
    <div className="relative rounded-3xl overflow-hidden bg-[#F3EFE9]">
      <div className="absolute inset-0 flex justify-between items-center px-6">
        <div className="flex items-center gap-2 text-[#7BA05B] font-bold text-[11px] uppercase tracking-widest"><CheckCircle2 size={16} /> Known</div>
        <div className="flex items-center gap-2 text-[#D97757] font-bold text-[11px] uppercase tracking-widest">Practice <ChevronRight size={16} /></div>
      </div>
      
      <div onTouchStart={(e) => startX.current = e.touches[0].clientX} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        style={{ transform: `translateX(${swipeOffset}px)`, transition: 'transform 0.2s' }}
        className={`relative z-10 p-5 flex justify-between items-center shadow-md border border-[#EAE1D8] rounded-3xl ${item.mastery === 'red' ? 'bg-[#FDF6ED] border-[#F2DCC9]' : item.mastery === 'green' ? 'bg-[#F1F4EE] border-[#DCE4D7]' : 'bg-white'}`}>
        <div className="flex-1">
          <h4 className="text-[20px] font-black font-serif capitalize text-[#3E322C]">{item.text}</h4>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-[12px] font-bold text-[#7BA05B]">{item.translation}</p>
            <span className="text-[12px] text-[#EAE1D8]">|</span>
            <p className="text-[12px] text-[#A69B95] italic font-light tracking-wide">{item.soundsLike?.toLowerCase()}</p>
          </div>
        </div>
        <button onClick={() => onSpeak(item.text)} className="p-3 bg-[#FDFBF7] rounded-full text-[#3E322C] border border-[#EAE1D8] active:scale-90 shadow-sm ml-2"><Volume2 size={18} /></button>
      </div>
    </div>
  );
}