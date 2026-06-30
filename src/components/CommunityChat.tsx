import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageSquare, ArrowRight, ShieldCheck, Zap, 
  Mic, Users, Scale, RefreshCw, HeartHandshake, Sparkles, Info,
  Send, ImagePlus, Play, Pause, Volume2, Trash2
} from 'lucide-react';

// --- TYPES ---
interface ChatMessage {
  id: string;
  text?: string;
  imageUrl?: string;
  voiceUrl?: string;
  sender: 'user' | 'bot';
  timestamp: number;
}

interface CommunityChatProps {
  isDarkMode: boolean;
  userId?: string;
}

export default function CommunityChat({ 
  isDarkMode, 
  userId = 'guest-user'
}: CommunityChatProps) {
  
  // CONFIGURATION - SEPARATED BOT AND GROUP LINKS
  const BOT_USERNAME = 'WingArtisanBot'; // Your actual bot username
  const GROUP_INVITE_LINK = 'https://t.me/+CPZvg1Vb8Ns0NjA0'; // Your actual group link
  
  const [isChatOpen, setIsChatOpen] = useState(false);
  
  // THEME VARIABLES
  const primaryColor = isDarkMode ? '#D4AF37' : '#E07A5F';
  const bgMain = isDarkMode ? 'bg-[#121212]' : 'bg-[#FAF9F6]';
  const textPrimary = isDarkMode ? 'text-white' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';
  const cardBg = isDarkMode ? 'bg-white/5 border-white/10' : 'bg-white border-gray-100 shadow-sm';

  // CHAT STATE
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // AUTO-SCROLL TO BOTTOM
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // INITIALIZE WELCOME MESSAGE WHEN CHAT OPENS
  useEffect(() => {
    if (isChatOpen && messages.length === 0) {
      setMessages([{
        id: 'welcome',
        text: `👋 Welcome to Wing Alliance! I'm here to help with critiques, material swaps, and price checks. What are you crafting today?`,
        sender: 'bot',
        timestamp: Date.now()
      }]);
    }
  }, [isChatOpen]);

  // SAFE DEEP LINK GENERATORS
  const links = {
    bot: `https://t.me/${BOT_USERNAME}`,
    botStart: `https://t.me/${BOT_USERNAME}?start=web_redirect`,
    group: GROUP_INVITE_LINK,
    support: `https://t.me/${BOT_USERNAME}?start=need_help_web`
  };

  // --- CHAT FUNCTIONS ---
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // TODO: Call Firebase Cloud Function to send to Telegram Bot API
    // await sendToTelegramBot(userId, inputText);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newMessage: ChatMessage = {
        id: Date.now().toString(),
        imageUrl: reader.result as string,
        sender: 'user',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, newMessage]);
      // TODO: Upload to Firebase Storage & send to bot
    };
    reader.readAsDataURL(file);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = recorder;
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const voiceUrl = URL.createObjectURL(blob);
        
        const newMessage: ChatMessage = {
          id: Date.now().toString(),
          voiceUrl,
          sender: 'user',
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, newMessage]);
        // TODO: Upload voice to storage & send to bot
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Please allow microphone access to record voice notes.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const deleteMessage = (id: string) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    // TODO: Call API to delete from Telegram/Firestore
  };

  // --- RENDER: GATEWAY PAGE ---
  if (!isChatOpen) {
    return (
      <div className={`flex-1 min-h-screen flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto ${bgMain} ${textPrimary}`}>
        <div className="max-w-4xl w-full space-y-10 pb-20 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* HEADER */}
          <div className="text-center space-y-4">
            <div className="inline-flex p-4 rounded-[2rem] mb-4 shadow-2xl transition-transform hover:scale-105 duration-300" style={{ backgroundColor: primaryColor }}>
              <MessageSquare className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter uppercase">Wing Alliance</h1>
            <p className={`text-sm font-bold uppercase tracking-[0.2em] ${textSecondary}`}>Centralized Telegram Hub</p>
            <p className={`max-w-lg mx-auto text-sm leading-relaxed ${textSecondary}`}>
              All artisan conversations, transactions, and AI mentorship happen securely in our Telegram ecosystem. Select an option below to begin.
            </p>
          </div>

          {/* FEATURES GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { icon: HeartHandshake, title: "Critique Circle", desc: "Post WIPs for honest feedback from master artisans. No selling allowed.", color: "text-pink-500", command: "/critique" },
              { icon: RefreshCw, title: "Material Swap", desc: "Barter leftover clay, yarn, or wood scraps locally without money.", color: "text-green-500", command: "/swap" },
              { icon: Scale, title: "Price Check Protocol", desc: "Private valuation tool to prevent underpricing and protect market value.", color: "text-blue-500", command: "/pricecheck" }
            ].map((feature, idx) => (
              <div key={idx} className={`p-5 rounded-2xl border flex flex-col items-center text-center transition-all hover:-translate-y-1 hover:shadow-lg ${cardBg}`}>
                <feature.icon className={`w-8 h-8 mb-3 ${feature.color}`} />
                <h3 className="font-bold text-sm mb-1">{feature.title}</h3>
                <p className={`text-xs leading-relaxed ${textSecondary} mb-3`}>{feature.desc}</p>
                <span className={`text-[10px] font-mono px-2 py-1 rounded bg-black/5 dark:bg-white/10 ${textSecondary}`}>Command: {feature.command}</span>
              </div>
            ))}
          </div>

          {/* FREE ACCESS CTA */}
          <div className={`relative overflow-hidden rounded-3xl border p-6 md:p-8 ${isDarkMode ? 'bg-gradient-to-br from-blue-900/20 to-black border-blue-500/30' : 'bg-gradient-to-br from-blue-50 to-white border-blue-200'}`}>
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none" />
            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-blue-500 fill-blue-500" />
                  <span className="text-xs font-black uppercase tracking-widest text-blue-500">Free Access • Unlimited</span>
                </div>
                <h2 className="text-2xl font-black">Full Chat & Voice Features</h2>
                <p className={`text-sm ${textSecondary}`}>Text, upload images, record voice notes, and get instant feedback from the community and AI mentor. No payment required.</p>
              </div>
              <button 
                onClick={() => setIsChatOpen(true)} 
                className="shrink-0 px-8 py-4 bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-2xl font-black text-sm shadow-lg shadow-blue-500/20 transition-all active:scale-95 flex items-center gap-2"
              >
                START CHATTING NOW <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ACTION BUTTONS - FIXED LINKS */}
          <div className="space-y-4 max-w-md mx-auto w-full">
            {/* PRIMARY: JOIN GROUP DIRECTLY */}
            <button 
              onClick={() => window.open(links.group, '_blank')} 
              className="w-full py-5 bg-[#0088cc] hover:bg-[#0099dd] text-white rounded-[2rem] font-black text-lg shadow-2xl shadow-blue-500/20 flex items-center justify-center gap-3 transition-all hover:scale-[1.02] active:scale-95 group"
            >
              <Users className="w-6 h-6 group-hover:animate-bounce" /> 
              JOIN COMMUNITY GROUP 
              <ArrowRight className="w-6 h-6" />
            </button>

            {/* SECONDARY: OPEN BOT FOR COMMANDS */}
            <button 
              onClick={() => window.open(links.botStart, '_blank')} 
              className={`w-full py-4 rounded-2xl font-bold text-sm border transition-all hover:bg-opacity-10 flex items-center justify-center gap-2 ${
                isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-white' : 'border-gray-300 text-gray-600 hover:bg-black'
              }`}
            >
              <MessageSquare className="w-4 h-4" /> Open @WingArtisanBot
            </button>

            <div className="flex items-center justify-center gap-6 text-[10px] font-bold uppercase tracking-widest opacity-40 pt-4">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> Instant Sync</span>
              <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Secure Auth</span>
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> AI Powered</span>
            </div>
            
            <p className={`text-center text-[10px] font-mono uppercase tracking-[0.3em] opacity-20`}>
              Official Bot: @{BOT_USERNAME}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER: EMBEDDED CHAT WIDGET ---
  return (
    <div className={`flex-1 min-h-screen p-4 md:p-8 ${bgMain} ${textPrimary}`}>
      <div className="max-w-3xl mx-auto h-[80vh] flex flex-col relative">
        
        {/* BACK BUTTON & HEADER */}
        <div className={`flex items-center justify-between p-4 rounded-t-2xl border-b ${cardBg}`}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsChatOpen(false)}
              className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
              title="Back to Gateway"
            >
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-cyan-500 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white fill-white" />
            </div>
            <div>
              <h2 className="font-bold text-sm">Wing Alliance Chat</h2>
              <p className={`text-xs ${textSecondary}`}>Online • Free Access</p>
            </div>
          </div>
          <button 
            onClick={() => window.open(links.support, '_blank')}
            className={`p-2 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            title="Contact Human Support"
          >
            <Info className="w-5 h-5" />
          </button>
        </div>

        {/* MESSAGES AREA */}
        <div className={`flex-1 overflow-y-auto p-4 space-y-4 ${isDarkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50'}`}>
          {messages.map(msg => (
            <div key={msg.id} className={`group relative flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* DELETE BUTTON (HOVER ONLY) */}
              {msg.sender === 'user' && (
                <button 
                  onClick={() => deleteMessage(msg.id)}
                  className="absolute -left-8 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                  title="Delete message"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                msg.sender === 'user' 
                  ? 'bg-[#0088cc] text-white rounded-br-md' 
                  : `${isDarkMode ? 'bg-[#2a2a2a]' : 'bg-white'} ${textPrimary} rounded-bl-md border ${isDarkMode ? 'border-white/10' : 'border-gray-200'}`
              }`}>
                {msg.text && <p className="leading-relaxed">{msg.text}</p>}
                
                {msg.imageUrl && (
                  <img src={msg.imageUrl} alt="Uploaded" className="rounded-lg mt-2 max-h-48 object-cover border border-white/20" />
                )}
                
                {msg.voiceUrl && (
                  <div className="flex items-center gap-3 mt-2 p-2 rounded-lg bg-black/10 dark:bg-white/10">
                    <button className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
                      <Play className="w-4 h-4 fill-current" />
                    </button>
                    <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div className="h-full w-1/3 bg-white rounded-full" />
                    </div>
                    <span className="text-[10px] font-mono opacity-70">0:12</span>
                    <Volume2 className="w-3.5 h-3.5 text-blue-300" />
                  </div>
                )}
                
                <span className="text-[10px] opacity-60 block text-right mt-1.5">
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* INPUT AREA */}
        <div className={`p-4 rounded-b-2xl border-t flex items-center gap-3 ${cardBg}`}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImageUpload} 
            accept="image/*" 
            className="hidden" 
          />
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className={`p-2.5 rounded-full transition-colors ${isDarkMode ? 'hover:bg-white/10 text-gray-400' : 'hover:bg-black/5 text-gray-500'}`}
            title="Upload Image"
          >
            <ImagePlus className="w-5 h-5" />
          </button>
          
          <div className="flex-1 relative">
            <input
              type="text"
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Type your message..."
              className={`w-full px-4 py-3 rounded-full border outline-none focus:ring-2 focus:ring-[#0088cc]/30 text-sm transition-all ${
                isDarkMode ? 'bg-[#2a2a2a] border-white/10 text-white placeholder:text-gray-500' : 'bg-white border-gray-200 text-gray-900 placeholder:text-gray-400'
              }`}
            />
            {isRecording && (
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-red-500 text-xs font-bold animate-pulse">
                <div className="w-2 h-2 bg-red-500 rounded-full" /> Recording...
              </div>
            )}
          </div>

          {inputText.trim() ? (
            <button 
              onClick={sendMessage}
              className="p-3 bg-[#0088cc] text-white rounded-full hover:bg-[#0099dd] transition-all active:scale-95 shadow-lg shadow-blue-500/20"
            >
              <Send className="w-5 h-5" />
            </button>
          ) : (
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-3 rounded-full transition-all active:scale-95 shadow-lg ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-red-500/20 animate-pulse' 
                  : `${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-100 hover:bg-gray-200'} text-gray-600 dark:text-gray-300`
              }`}
              title={isRecording ? "Stop Recording" : "Record Voice Note"}
            >
              {isRecording ? <Pause className="w-5 h-5 fill-current" /> : <Mic className="w-5 h-5" />}
            </button>
          )}
        </div>
        
        <p className={`text-[10px] text-center mt-3 ${textSecondary}`}>
          Messages sync with @{BOT_USERNAME} • Voice requires HTTPS • Free Feature
        </p>
      </div>
    </div>
  );
}