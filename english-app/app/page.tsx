'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { 
  Search, Volume2, MessageSquare, Clock, Send, Loader2, 
  Lightbulb, X, BookOpen, RefreshCw, BookmarkPlus, CheckCircle2, AlertCircle, Trash2, ChevronRight, Layers
} from 'lucide-react';

const IDIOMS_DATABASE = [
  { phrase: "Wrap my head around", translation: "להבין משהו מורכב", context: "I just can't wrap my head around this complex clause." },
  { phrase: "Get the ball rolling", translation: "להתניע תהליך", context: "Let's get the ball rolling on the new project." },
  { phrase: "Across the board", translation: "באופן גורף", context: "The changes will apply across the board." },
  { phrase: "In a nutshell", translation: "על קצה המזלג", context: "In a nutshell, we need more time." },
  { phrase: "On the same page", translation: "מתואמים", context: "Before the meeting, ensure we are all on the same page." },
  { phrase: "Draw the line", translation: "להציב גבול", context: "We have to draw the line at these demands." },
  { phrase: "By the book", translation: "לפי הכללים", context: "Our team does everything strictly by the book." },
  { phrase: "Cut corners", translation: "לעגל פינות", context: "We cannot afford to cut corners here." },
];

const READING_TEXTS = [
  "Success is not final, failure is not fatal: it is the courage to continue that counts. Every day presents a new opportunity to refine your skills, expand your vocabulary, and build the confidence needed to articulate your thoughts clearly.",
  "The only limit to our realization of tomorrow will be our doubts of today. Embrace the process of learning. Stumbling over words is merely a stepping stone toward fluency.",
  "Communication is the bridge between confusion and clarity. Take a deep breath, read slowly, and let each word resonate. Your voice has power, and your words carry weight.",
  "Consistency is the key to mastering any language. It is not about being perfect from the start, but rather about showing up every single day and making a small, incremental effort.",
  "Language is a living breathing organism. It shifts and changes. By practicing aloud, you train not just your mind, but your vocal cords, to adapt to new rhythms and melodies."
];

export default function StepByStepApp() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [word, setWord] = useState('');
  const [wordsList, setWordsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activeIdiom, setActiveIdiom] = useState<any>(null);
  
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<{role: string, text: string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [isCompareOpen, setIsCompareOpen] = useState(false);
  const [compareInput, setCompareInput] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [compareResult, setCompareResult] = useState<any>(null);

  const [isReadingDone, setIsReadingDone] = useState(false);
  const [conceptOffset, setConceptOffset] = useState(0);

  useEffect(() => {
    setIsMounted(true);
    setSelectedDate(new Date().toDateString());
    
    const savedChat = localStorage.getItem('stepbystep_chat');
    if (savedChat) setChatMessages(JSON.parse(savedChat));
    else setChatMessages([{ role: 'ai', text: 'Hey there! How is your day going? Feel free to talk about anything.' }]);

    const readingStatus = localStorage.getItem(`reading_${new Date().toDateString()}`);
    if (readingStatus === 'done') setIsReadingDone(true);
  }, []);

  useEffect(() => {
    if (isMounted && chatMessages.length > 0) localStorage.setItem('stepbystep_chat', JSON.stringify(chatMessages));
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

  const speak = (text: string) => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
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
      setWord('');
      return;
    }
    
    setLoading(true);
    try {
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
      
      const rawText = await fetchFromAPI(prompt);
      const cleanText = rawText.replace(/```(json)?/gi, "").replace(/```/g, "").trim();
      const data = JSON.parse(cleanText);
      
      const wordToSave = data.corrected.toLowerCase();
      
      if (existingWord) {
        await updateDoc(doc(db, 'words', existingWord.id), { ...data, createdAt: serverTimestamp() });
      } else {
        const correctedExisting = wordsList.find(w => w.text === wordToSave);
        if (correctedExisting) {
          await updateDoc(doc(db, 'words', correctedExisting.id), { ...data, createdAt: serverTimestamp() });
        } else {
          await addDoc(collection(db, 'words'), { 
            text: wordToSave, 
            ...data, 
            mastery: 'orange', 
            isDifficult: false, 
            createdAt: serverTimestamp(), 
            dateString: new Date().toDateString() 
          });
        }
      }
      setWord('');
    } catch (e: any) { 
      console.error(e);
      alert(`Error fetching data: ${e.message}`); 
    }
    setLoading(false);
  };

  const handleCompareWords = async () => {
    const targetWord = compareInput.trim();
    if (!targetWord || !wordsList[0]) return;
    setIsComparing(true);
    try {
      const prompt = `User studying "${wordsList[0]?.text}". Got confused with "${targetWord}". If Hebrew, translate to confusing English word. Return strictly valid JSON: {"text": "english word", "translation": "hebrew translation"}`;
      const rawText = await fetchFromAPI(prompt);
      const cleanText = rawText.replace(/```(json)?/gi, "").replace(/```/g, "").trim();
      setCompareResult(JSON.parse(cleanText));
    } catch (e: any) { 
      alert(`Error analyzing words.`); 
    }
    setIsComparing(false);
  };

  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const userMsg = chatInput.trim();
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setChatInput('');
    try {
      const history = chatMessages.slice(-10).map(m => `${m.role === 'ai' ? 'COACH' : 'USER'}: ${m.text}`).join('\n');
      const prompt = `You are a freestyle English conversation partner and coach. 
      Have a natural, flowing conversation. Do not act like a robot. 
      Track errors silently. 
      IF the user explicitly asks for 'feedback' or 'summary', respond ONLY with:
      - 📝 Conversational Feedback (Brief honest review of their flow)
      - 💡 2 Insights (Point out exactly 2 grammatical or phrasing mistakes they made and how to fix them).
      \nHistory:\n${history}\nUSER: ${userMsg}\nCOACH:`;
      
      const responseText = await fetchFromAPI(prompt);
      setChatMessages(prev => [...prev, { role: 'ai', text: responseText }]);
    } catch (e: any) { 
      setChatMessages(prev => [...prev, { role: 'ai', text: `⚠️ Connection Error. Please try again.` }]); 
    }
  };

  const handleSwipeAction = async (id: string, action: 'green' | 'red') => {
    const wordRef = doc(db, 'words', id);
    if (action === 'green') await updateDoc(wordRef, { mastery: 'green', isDifficult: false });
    else await updateDoc(wordRef, { mastery: 'red', isDifficult: true });
  };

  const markReadingDone = () => {
    setIsReadingDone(true);
    localStorage.setItem(`reading_${new Date().toDateString()}`, 'done');
  };

  const dailyConcepts = useMemo(() => {
    if (!isMounted) return [IDIOMS_DATABASE[0], IDIOMS_DATABASE[1]];
    const baseIndex = (Math.floor(Date.now() / (1000 * 60 * 60 * 4)) + conceptOffset) * 2;
    return [
      IDIOMS_DATABASE[baseIndex % IDIOMS_DATABASE.length], 
      IDIOMS_DATABASE[(baseIndex + 1) % IDIOMS_DATABASE.length]
    ];
  }, [conceptOffset, isMounted]);

  const saveConceptToVault = async (concept: any) => {
    await addDoc(collection(db, 'words'), {
      text: concept.phrase,
      translation: concept.translation,
      example: concept.context,
      mastery: 'red',
      isDifficult: true,
      createdAt: serverTimestamp(),
      dateString: new Date().toDateString()
    });
    alert("Saved to Needs Practice!");
  };

  const groupedHistory = useMemo(() => {
    const groups: any = { recent: {}, older: {} };
    if (!isMounted) return groups;
    
    const today = new Date();
    today.setHours(0,0,0,0);

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
  const olderWeeks = Object.keys(groupedHistory.older).sort((a, b) => parseInt(a.split(' ')[1]) - parseInt(b.split(' ')[1]));

  const getReadingIconColor = () => {
    if (!isMounted) return "text-[#A69B95] bg-white border-[#EAE1D8]";
    if (isReadingDone) return "text-[#7BA05B] bg-[#F1F4EE] border-[#7BA05B]";
    const hour = new Date().getHours();
    if (hour < 12) return "text-[#A69B95] bg-white border-[#EAE1D8]"; 
    if (hour < 18) return "text-[#DDA77B] bg-[#FCF8F2] border-[#DDA77B]"; 
    return "text-[#D97757] bg-[#FDF6ED] border-[#D97757]"; 
  };

  const renderHighlightedDiff = (word1: string, word2: string) => {
    return word1.split('').map((char, index) => {
      const isDifferent = char.toLowerCase() !== (word2[index] || '').toLowerCase();
      return <span key={index} className={isDifferent ? "text-[#D97757] font-black" : ""}>{char}</span>;
    });
  };

  const dayOfYear = isMounted ? Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 1000 / 60 / 60 / 24) : 0;
  const dailyReadingText = READING_TEXTS[dayOfYear % READING_TEXTS.length];

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] font-sans text-[#3E322C] antialiased pb-24" dir="ltr">
      <header className="pt-10 pb-4 px-6 flex justify-between items-center">
        <h1 className="text-[26px] font-serif font-black tracking-tight text-[#3E322C]">
          Step<span className="text-[#D97757] italic">By</span>Step
        </h1>
        <button onClick={() => setActiveTab('reading')} className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-colors shadow-sm ${getReadingIconColor()}`}>
          {isReadingDone ? <CheckCircle2 size={20} /> : <BookOpen size={20} />}
        </button>
      </header>

      <div className="max-w-md mx-auto px-5">
        {/* --- HOME TAB --- */}
        {activeTab === 'home' && (
          <div className="animate-in fade-in duration-500 pb-10">
            <div className="w-full relative mb-6">
              <input 
                type="text" 
                value={word} 
                onChange={(e) => setWord(e.target.value)} 
                placeholder="Search a word..." 
                disabled={loading} 
                className="w-full p-4 pl-12 bg-white rounded-2xl border border-[#EAE1D8] shadow-sm text-[16px] font-bold outline-none focus:border-[#D97757] transition-colors disabled:opacity-60 disabled:bg-[#f8fafc]" 
                onKeyDown={(e) => e.key === 'Enter' && processAndSaveWord()} 
              />
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-[#A69B95]" size={18} />
              {loading && <Loader2 className="absolute right-5 top-1/2 -translate-y-1/2 text-[#D97757] animate-spin" size={18} />}
            </div>

            {loading ? (
              <div className="w-full flex flex-col items-center space-y-4 animate-pulse pt-4">
                 <div className="h-10 bg-[#EAE1D8] rounded-xl w-1/2"></div>
                 <div className="h-4 bg-[#EAE1D8] rounded-lg w-3/4"></div>
                 <div className="h-32 w-full bg-white rounded-3xl mt-4"></div>
              </div>
            ) : wordsList[0] ? (
              <div className="w-full bg-white p-7 rounded-[2rem] shadow-sm border border-[#EAE1D8] mb-8 relative text-left">
                {wordsList[0].isTypo && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#FCF8F2] text-[#DDA77B] px-4 py-1 rounded-full text-[10px] font-bold border border-[#F2DCC9] shadow-sm whitespace-nowrap">
                    Auto-corrected from {wordsList[0].original}
                  </div>
                )}
                
                <h2 className="text-[38px] font-serif font-black capitalize text-[#3E322C] leading-none mb-5">{wordsList[0].text}</h2>
                
                {wordsList[0].definition && (
                  <div className="mb-6">
                    {wordsList[0].partOfSpeech && (
                      <span className="text-[14px] font-bold text-[#4285F4] italic mb-2 block">{wordsList[0].partOfSpeech}</span>
                    )}
                    <div className="flex gap-3">
                      <div className="w-5 h-5 rounded-full border border-[#EAE1D8] flex items-center justify-center text-[11px] font-bold text-[#A69B95] shrink-0 mt-0.5">1</div>
                      <p className="text-[16px] text-[#3E322C] leading-snug">
                        {wordsList[0].definition}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mb-6">
                  <button onClick={() => speak(wordsList[0].text)} className="p-2.5 bg-[#FDFBF7] text-[#3E322C] rounded-full border border-[#EAE1D8] shadow-sm active:scale-95 transition-all">
                    <Volume2 size={18} />
                  </button>
                  <div className="text-[16px] font-light text-[#A69B95] tracking-wide flex gap-1">
                    {wordsList[0].soundsLike?.split('-').map((p:any, i:any) => <span key={i} className={p === p.toUpperCase() ? "font-bold text-[#3E322C]" : ""}>{p.toLowerCase()}</span>)}
                  </div>
                </div>

                <div className="mb-6 pt-4 border-t border-[#F3EFE9]">
                  <p className="text-[20px] font-bold text-[#7BA05B]">{wordsList[0].translation}</p>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {wordsList[0].pastTense && (
                    <span className="text-[13px] font-bold text-[#A69B95] uppercase tracking-wider bg-[#FDFBF7] px-3 py-1.5 rounded-lg border border-[#EAE1D8]">Past: {wordsList[0].pastTense}</span>
                  )}
                  {wordsList[0].synonyms?.slice(0,2).map((s: string, idx: number) => (
                    <span key={idx} className="text-[13px] font-medium text-[#5C6B8D] bg-[#F4F6FA] px-3 py-1.5 rounded-lg border border-[#E1E6F0]">{s}</span>
                  ))}
                </div>

                <div className="bg-[#FDFBF7] p-4 rounded-2xl border border-[#F3EFE9]">
                  <p className="text-[15px] leading-relaxed text-[#7A6D65] italic">"{wordsList[0].example}"</p>
                </div>
              </div>
            ) : null}

            {wordsList[0] && !loading && (
              <div className="mt-8">
                <div className="flex justify-between items-center mb-3 px-2">
                  <h4 className="text-[13px] font-bold text-[#A69B95] uppercase tracking-wider">Daily Idioms</h4>
                  <button onClick={() => setConceptOffset(prev => prev + 1)} className="p-1.5 text-[#A69B95] hover:text-[#3E322C] bg-white rounded-lg border border-[#EAE1D8] shadow-sm active:scale-90"><RefreshCw size={14} /></button>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {dailyConcepts.map((item, idx) => (
                    <div key={idx} className="bg-white border border-[#EAE1D8] p-4 rounded-2xl shadow-sm flex items-center justify-between">
                      <div className="flex-1 cursor-pointer" onClick={() => setActiveIdiom(item)}>
                        <p className="text-[15px] font-black text-[#3E322C]">{item.phrase}</p>
                        <p className="text-[12px] font-bold text-[#D97757] uppercase mt-0.5">{item.translation}</p>
                      </div>
                      <button onClick={() => saveConceptToVault(item)} className="p-2.5 bg-[#FDFBF7] border border-[#EAE1D8] rounded-xl text-[#7BA05B] shadow-sm active:scale-90"><BookmarkPlus size={18} /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {wordsList[0] && (
              <button onClick={() => { setCompareResult(null); setCompareInput(''); setIsCompareOpen(true); }} className="fixed bottom-[100px] right-6 p-4 bg-[#D97757] text-white rounded-full shadow-xl shadow-[#D97757]/30 active:scale-90 transition-all z-40">
                <Lightbulb size={24} fill="currentColor" />
              </button>
            )}

            {isCompareOpen && (
              <div className="fixed inset-0 bg-[#3E322C]/40 backdrop-blur-sm z-50 flex items-center justify-center p-5 animate-in fade-in">
                <div className="bg-[#FDFBF7] w-full max-w-sm rounded-[2rem] p-8 shadow-2xl relative border border-[#EAE1D8]">
                  <button onClick={() => setIsCompareOpen(false)} className="absolute top-6 right-6 text-[#A69B95]"><X size={20} /></button>
                  <h3 className="text-xl font-serif font-black text-[#3E322C] mb-2">Wait, I thought it was...</h3>
                  <p className="text-xs text-[#7A6D65] mb-6">Type the word you confused it with (Hebrew or English).</p>
                  
                  <div className="flex gap-2 mb-6">
                    <input type="text" value={compareInput} onChange={(e) => setCompareInput(e.target.value)} placeholder="e.g. affect" className="flex-1 p-3 px-4 bg-white rounded-xl border border-[#EAE1D8] focus:border-[#D97757] outline-none font-bold" />
                    <button onClick={handleCompareWords} disabled={isComparing || !compareInput} className="bg-[#D97757] text-white px-5 rounded-xl font-bold">
                      {isComparing ? <Loader2 size={18} className="animate-spin" /> : "Check"}
                    </button>
                  </div>

                  {compareResult && (
                    <div className="space-y-3 animate-in slide-in-from-bottom-2">
                      <div className="bg-white p-4 rounded-2xl border border-[#EAE1D8]">
                        <p className="text-[10px] font-bold text-[#7BA05B] uppercase mb-1">Original Word</p>
                        <p className="text-2xl font-black text-[#3E322C] font-serif">{renderHighlightedDiff(wordsList[0].text, compareResult.text)}</p>
                        <p className="text-[11px] font-bold text-[#A69B95] mt-1">{wordsList[0].translation}</p>
                      </div>
                      <div className="bg-[#FCF8F2] p-4 rounded-2xl border border-[#F2DCC9]">
                        <p className="text-[10px] font-bold text-[#D97757] uppercase mb-1">Your Confusion</p>
                        <p className="text-2xl font-black text-[#3E322C] font-serif">{renderHighlightedDiff(compareResult.text, wordsList[0].text)}</p>
                        <p className="text-[11px] font-bold text-[#A69B95] mt-1">{compareResult.translation}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- HISTORY TAB --- */}
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
                    <div className={`w-8 rounded-t-sm transition-all duration-300 ${isSelected ? 'bg-[#D97757]' : 'bg-[#EAE1D8]'}`} style={{ height: `${barHeight}px` }}></div>
                    <div className={`px-3 py-1.5 rounded-lg text-[10px] font-bold whitespace-nowrap transition-colors ${isSelected ? 'bg-[#3E322C] text-white' : 'bg-white border border-[#EAE1D8] text-[#7A6D65]'}`}>
                      {date === new Date().toDateString() ? 'TODAY' : date.split(' ').slice(0, 1).join('')}
                    </div>
                  </div>
                )
              })}
            </div>

            {olderWeeks.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar">
                 {olderWeeks.map(week => (
                   <button key={week} onClick={() => setSelectedDate(week)} className={`px-4 py-2 rounded-xl text-[11px] font-bold border transition-colors whitespace-nowrap ${selectedDate === week ? 'bg-[#3E322C] text-white border-[#3E322C]' : 'bg-white text-[#7A6D65] border-[#EAE1D8]'}`}>
                     {week}
                   </button>
                 ))}
              </div>
            )}

            <p className="text-[10px] font-bold text-[#A69B95] text-center mb-4 mt-2 uppercase tracking-widest">Swipe Right (Red) = Practice • Swipe Left (Green) = Known</p>

            <div className="space-y-3 pb-10">
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

        {/* --- NEEDS PRACTICE (VAULT) TAB --- */}
        {activeTab === 'difficult' && (
          <div className="animate-in fade-in duration-500 mt-2">
            <div className="bg-[#FDF6ED] p-6 rounded-3xl mb-6 shadow-sm border border-[#F2DCC9] flex items-center gap-4">
               <div className="p-3 bg-white rounded-2xl shadow-sm text-[#D97757]"><AlertCircle size={24} /></div>
               <div>
                 <h2 className="text-xl font-black text-[#3E322C] font-serif">Needs Practice</h2>
                 <p className="text-xs text-[#D97757] font-bold mt-1 uppercase tracking-widest">Tap to flip • Swipe Green to Remove</p>
               </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 pb-10">
              {wordsList.filter(w => w.mastery === 'red' || w.isDifficult).map(item => (
                <FlipCard key={item.id} item={item} onSwipe={handleSwipeAction} onSpeak={speak} />
              ))}
            </div>
          </div>
        )}

        {/* --- READING TAB --- */}
        {activeTab === 'reading' && (
          <div className="animate-in fade-in duration-500 mt-2">
            <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-[#EAE1D8] text-center">
              <div className="mx-auto w-16 h-16 bg-[#FCF8F2] rounded-full flex items-center justify-center text-[#DDA77B] mb-6 shadow-inner">
                <BookOpen size={32} />
              </div>
              <h2 className="text-2xl font-black font-serif text-[#3E322C] mb-2">Daily Reading</h2>
              <p className="text-sm text-[#A69B95] mb-8">Read out loud to set your speaking pace.</p>
              
              <div className="bg-[#FDFBF7] p-6 rounded-2xl border border-[#F3EFE9] text-left mb-8 shadow-inner">
                <p className="text-[17px] leading-loose text-[#3E322C] font-serif font-medium">{dailyReadingText}</p>
              </div>

              <button 
                onClick={markReadingDone} 
                disabled={isReadingDone}
                className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${isReadingDone ? 'bg-[#7BA05B] text-white' : 'bg-[#3E322C] text-white hover:bg-[#2A221E] shadow-lg active:scale-95'}`}
              >
                {isReadingDone ? <><CheckCircle2 size={20} /> Completed</> : "Mark as Read"}
              </button>
            </div>
          </div>
        )}

        {/* --- CHAT TAB --- */}
        {activeTab === 'chat' && (
          <div className="flex flex-col animate-in fade-in" style={{ height: 'calc(100vh - 220px)' }}>
            <div className="flex justify-between items-center mb-3 px-2 bg-white/50 py-2 rounded-xl backdrop-blur-sm border border-[#EAE1D8]">
              <p className="text-[11px] text-[#A69B95] font-bold uppercase tracking-wider">Freestyle Coach</p>
              <button onClick={() => {localStorage.removeItem('stepbystep_chat'); setChatMessages([{ role: 'ai', text: 'Hey there! How is your day going?' }]);}} className="p-1.5 text-[#D97757] bg-white rounded-lg shadow-sm border border-[#F2DCC9]"><Trash2 size={14} /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pb-4 pr-1">
              {chatMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`p-4 max-w-[85%] rounded-[1.5rem] text-[15px] shadow-sm leading-relaxed ${msg.role === 'user' ? 'bg-[#3E322C] text-white rounded-br-sm' : 'bg-white text-[#3E322C] border border-[#EAE1D8] rounded-bl-sm font-serif'}`}>
                    {msg.text.split('\n').map((line, j) => <p key={j} className={line.startsWith('-') ? 'ml-3 mt-1' : 'mt-1'}>{line}</p>)}
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

      <footer className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-2xl border-t border-[#EAE1D8] px-4 py-4 flex justify-between items-end z-50 shadow-[0_-10px_40px_rgba(62,50,44,0.03)] pb-6">
        <NavBtn active={activeTab === 'home'} onClick={() => setActiveTab('home')} icon={<Search size={22} />} label="Search" />
        <NavBtn active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<Clock size={22} />} label="History" />
        <NavBtn active={activeTab === 'difficult'} onClick={() => setActiveTab('difficult')} icon={<Layers size={22} />} label="Practice" />
        <NavBtn active={activeTab === 'reading'} onClick={() => setActiveTab('reading')} icon={<BookOpen size={22} />} label="Read" isAlert={!isReadingDone} />
        <NavBtn active={activeTab === 'chat'} onClick={() => setActiveTab('chat')} icon={<MessageSquare size={22} />} label="Chat" />
      </footer>
    </div>
  );
}

function NavBtn({ active, onClick, icon, label, isAlert = false }: any) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1.5 transition-all w-14 relative ${active ? 'text-[#3E322C] scale-105' : 'text-[#A69B95]'}`}>
      {isAlert && <div className="absolute top-1 right-2 w-2 h-2 bg-[#D97757] rounded-full shadow-sm animate-pulse"></div>}
      <div className={`p-2.5 rounded-[1.2rem] transition-colors ${active ? 'bg-[#FCF8F2] text-[#DDA77B] shadow-sm border border-[#F2DCC9]' : ''}`}>{icon}</div>
      <span className={`text-[9px] uppercase tracking-widest ${active ? 'font-black text-[#3E322C]' : 'font-bold'}`}>{label}</span>
    </button>
  );
}

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
        className={`relative z-10 p-5 flex justify-between items-center shadow-sm border border-[#EAE1D8] rounded-3xl ${item.mastery === 'red' ? 'bg-[#FDF6ED]' : item.mastery === 'green' ? 'bg-[#F1F4EE]' : 'bg-white'}`}>
        <div>
          <h4 className="text-[18px] font-black font-serif capitalize text-[#3E322C]">{item.text}</h4>
          <p className="text-[11px] font-bold text-[#A69B95] uppercase tracking-widest mt-0.5">{item.translation}</p>
        </div>
        <button onClick={() => onSpeak(item.text)} className="p-3 bg-[#FDFBF7] rounded-full text-[#3E322C] border border-[#EAE1D8] active:scale-90"><Volume2 size={16} /></button>
      </div>
    </div>
  );
}

function FlipCard({ item, onSwipe, onSpeak }: any) {
  const [isFlipped, setIsFlipped] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const startX = useRef(0);
  
  const handleTouchMove = (e: any) => {
    const diff = e.touches[0].clientX - startX.current;
    if (diff < 0 && diff > -100) setSwipeOffset(diff); 
  };
  const handleTouchEnd = () => {
    if (swipeOffset < -50) onSwipe(item.id, 'green');
    setSwipeOffset(0);
  };

  return (
    <div className="relative w-full aspect-square perspective-1000 mb-2">
       <div className="absolute inset-0 bg-[#F1F4EE] rounded-3xl flex items-center justify-end px-4 border border-[#DCE4D7]">
         <CheckCircle2 className="text-[#7BA05B]" size={24} />
       </div>

       <div 
        onTouchStart={(e) => startX.current = e.touches[0].clientX} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
        onClick={() => setIsFlipped(!isFlipped)}
        style={{ 
          transform: `translateX(${swipeOffset}px) rotateY(${isFlipped ? 180 : 0}deg)`, 
          transformStyle: 'preserve-3d',
          transition: swipeOffset ? 'none' : 'transform 0.4s ease-in-out'
        }}
        className="w-full h-full relative cursor-pointer z-10"
      >
        <div style={{ backfaceVisibility: 'hidden' }} className="absolute inset-0 bg-white border border-[#EAE1D8] rounded-3xl shadow-sm flex flex-col items-center justify-center p-4">
           <h4 className="text-[20px] font-black font-serif capitalize text-[#3E322C] text-center">{item.text}</h4>
           <p className="text-[10px] text-[#A69B95] absolute bottom-3 uppercase font-bold tracking-widest">Tap to flip</p>
        </div>

        <div style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }} className="absolute inset-0 bg-[#3E322C] rounded-3xl shadow-lg flex flex-col items-center justify-center p-4 text-white">
           <p className="text-[18px] font-bold uppercase tracking-widest text-[#DDA77B] text-center leading-tight">{item.translation}</p>
           <button onClick={(e) => { e.stopPropagation(); onSpeak(item.text); }} className="absolute top-3 right-3 text-white/50 active:text-white"><Volume2 size={16}/></button>
           <p className="text-[10px] text-white/50 absolute bottom-3 uppercase font-bold tracking-widest">Swipe left to clear</p>
        </div>
      </div>
    </div>
  );
}