import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Bot, User, ArrowRight } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface AIMentorProps {
  isDarkMode?: boolean; // Made optional with default
  lang?: Language;      // Made optional with default
}

export default function AIMentor({ 
  isDarkMode = true,    // Default to dark mode
  lang = 'en'           // Default to English if not provided
}: AIMentorProps) {
  
  // Safe translation access with fallback
  const t = translations[lang as Language] || translations['en'];
  
  const [messages, setMessages] = useState<Message[]>(() => [
    {
      role: 'assistant',
      content: lang === 'am'
        ? "ላም ሠሪው! እኔ ዊንግ ረዳት ነኝ፣ የእደ-ጥበብ እና የስቱዲዮ ስትራቴጂ መካሪዎ። የሸክ ሥራዎችን ጋ ማውጣት፣ ክር ማገጣጠም ወይም አዲስ ሀሳብ መለግ ከፈለጉ እኔን መጠየቅ ይችላሉ\n\nዛሬ ምን እየሰሩ ነው?"
        : "Greetings, maker! I am Wing Guide, your traditional crafts and studio strategy mentor. Whether you are troubleshooting cracked glazes, pricing hand-woven scarves, or finding inspiration for recycled materials, I am here to offer encouraging and practical wisdom.\n\nWhat are you crafting today?"
    }
  ]);
  
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Suggestion chips
  const promptChips = [
    { label: "Pricing Help", text: "How should I calculate pricing for a handmade wool scarf or ceramic mug?" },
    { label: "Technique Fix", text: "How do I prevent earthenware or stoneware clay from cracking during drying?" },
    { label: "Marketing Tips", text: "What is a good Instagram strategy for a local woodworking studio?" },
    { label: "Creative Block", text: "I have some scrap sterling silver and walnut wood. Give me 3 creative ideas to combine them." }
  ];

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const newMessages = [...messages, { role: 'user' as const, content: text }];
    setMessages(newMessages);
    setInputText('');
    setLoading(true);

    try {
      // Try to call the API, but handle missing endpoint gracefully
      const response = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages })
      });
      
      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setMessages(prev => [...prev, { role: 'assistant' as const, content: data.text }]);
    } catch (err: any) {
      console.error("AI Mentor API error:", err);
      
      // Fallback response when API is unavailable (development/offline)
      const fallbackResponses: Record<string, string> = {
        'en': "I'm currently in offline mode while my cloud connection is being configured. In production, I'll provide expert advice on pricing, techniques, and marketing. For now, try asking about material combinations or design inspiration!",
        'am': "የኔ የደመና ግንኙነት እየተዘጋጀ ስለነ አሁን በመስመር ላይ አይደለሁም። በማምረት ጊዜ ለ ዋጋ፣ ክኒኮች እና በያ ምክር እሰጣለሁ። አሁን ስለ ቁቁስ ጥምረት ወይም ዲዛይን ሀሳብ ጠይቁ!"
      };
      
      setMessages(prev => [...prev, { 
        role: 'assistant' as const, 
        content: fallbackResponses[lang as Language] || fallbackResponses['en']
      }]);
    } finally {
      setLoading(false);
    }
  };

  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black hover:bg-opacity-90' : 'bg-[#E07A5F] text-white hover:bg-opacity-90';

  return (
    <div className="flex-1 min-h-screen flex flex-col px-4 md:px-8 py-6 pb-24 md:pb-6 max-h-screen">
      
      {/* Mentor Header */}
      <div className="pb-4 border-b transition-colors duration-200 border-opacity-10 mb-4 flex items-center justify-between shrink-0 border-gray-200 dark:border-gray-800">
        <div>
          <h2 className={`text-2xl font-sans font-bold tracking-tight mb-1 flex items-center gap-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
            <Sparkles className={`w-6 h-6 ${activeColor} animate-pulse`} /> Wing Guide Mentor
          </h2>
          <p className="text-xs text-gray-400">Wise and practical strategy counsel for traditional artisans and crafters.</p>
        </div>
        <div className={`text-xs px-3 py-1.5 rounded-full border hidden sm:flex items-center gap-1.5 font-mono ${
          isDarkMode ? 'bg-[#1E1E1E] border-[#2D2D2D] text-gray-300' : 'bg-[#FAF7F0] border-[#EBE7DF] text-gray-600'
        }`}>
          <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
          <span>Wing-Guide AI Online</span>
        </div>
      </div>

      {/* Main chat log container */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 min-h-0 mb-4">
        {messages.map((msg, index) => {
          const isBot = msg.role === 'assistant';
          return (
            <div 
              key={index} 
              className={`flex gap-3.5 max-w-3xl items-start animate-fade-in ${
                isBot ? '' : 'ml-auto flex-row-reverse'
              }`}
            >
              {/* Avatar */}
              <div className={`p-2.5 rounded-full border shrink-0 ${
                isBot 
                  ? (isDarkMode ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#2D2D2D]' : 'bg-[#E07A5F]/15 text-[#E07A5F] border-[#EBE7DF]')
                  : (isDarkMode ? 'bg-white/5 text-gray-300 border-[#2D2D2D]' : 'bg-black/5 text-gray-700 border-[#EBE7DF]')
              }`}>
                {isBot ? <Bot className="w-5 h-5" /> : <User className="w-5 h-5" />}
              </div>

              {/* Message Bubble */}
              <div className={`p-4.5 rounded-3xl leading-relaxed text-xs sm:text-sm whitespace-pre-wrap shadow-sm border ${
                isBot 
                  ? (isDarkMode ? 'bg-[#1C1C1C] text-[#EAEAEA] border-[#2D2D2D]' : 'bg-[#FAF7F0] text-[#2C2C2C] border-[#EBE7DF]')
                  : (isDarkMode ? 'bg-[#D4AF37] text-black border-transparent' : 'bg-[#E07A5F] text-white border-transparent')
              }`}>
                {msg.content}
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-3.5 max-w-3xl items-start">
            <div className={`p-2.5 rounded-full border shrink-0 ${
              isDarkMode ? 'bg-[#D4AF37]/15 text-[#D4AF37] border-[#2D2D2D]' : 'bg-[#E07A5F]/15 text-[#E07A5F] border-[#EBE7DF]'
            }`}>
              <Bot className="w-5 h-5" />
            </div>
            <div className={`p-4 rounded-2xl border flex items-center gap-1 ${
              isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-[#FAF7F0] border-[#EBE7DF]'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]'}`} style={{ animationDelay: '0ms' }} />
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]'}`} style={{ animationDelay: '150ms' }} />
              <div className={`w-1.5 h-1.5 rounded-full animate-bounce ${isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]'}`} style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips & Input */}
      <div className="shrink-0 space-y-3.5">
        
        {/* Suggestion Chips (only show when greeting is the last message to keep clean) */}
        {messages.length <= 2 && !loading && (
          <div className="flex flex-wrap gap-2">
            {promptChips.map((chip, i) => (
              <button
                id={`mentor-chip-${i}`}
                key={i}
                onClick={() => handleSendMessage(chip.text)}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all hover:scale-[1.02] ${
                  isDarkMode 
                    ? 'bg-[#1E1E1E] border-[#2D2D2D] hover:border-[#D4AF37] text-[#EAEAEA]' 
                    : 'bg-[#FAF7F0] border-[#EBE7DF] hover:border-[#E07A5F] text-[#2C2C2C]'
                }`}
              >
                <span>{chip.label}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ))}
          </div>
        )}

        {/* Input form */}
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSendMessage(inputText); }}
          className="flex gap-2"
        >
          <input
            id="mentor-input"
            type="text"
            placeholder="Ask Wing Guide... e.g. 'How should I price walnut coasters?'"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            className={`flex-1 px-5 py-3 rounded-2xl border text-sm outline-none transition-all ${
              isDarkMode 
                ? 'bg-[#1C1C1C] border-[#2D2D2D] focus:border-[#D4AF37] text-white placeholder:text-gray-500' 
                : 'bg-[#FAF7F0] border-[#EBE7DF] focus:border-[#E07A5F] text-black placeholder:text-gray-400'
            } disabled:opacity-50`}
          />
          <button
            id="mentor-submit-btn"
            type="submit"
            disabled={loading || !inputText.trim()}
            className={`p-3.5 rounded-2xl transition-all focus:scale-95 duration-150 flex items-center justify-center shrink-0 ${activeBg} disabled:opacity-50`}
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>

    </div>
  );
}