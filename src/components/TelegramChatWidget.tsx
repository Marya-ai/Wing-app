import { useState, useRef, useEffect } from 'react';
import { Mic, Send, ImagePlus, X, Reply, Lock } from 'lucide-react';

interface Message {
  id: string;
  text?: string;
  voiceUrl?: string;
  imageUrl?: string;
  sender: 'user' | 'bot';
  timestamp: number;
}

export default function TelegramChatWidget({ 
  userId, 
  isPremium 
}: { 
  userId: string; 
  isPremium: boolean 
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize chat
  useEffect(() => {
    if (!isPremium) {
      setMessages([{
        id: 'welcome',
        text: '🔒 Premium Access Required\nUpgrade to 50 ETB to unlock full chat, voice notes, and AI mentorship.',
        sender: 'bot',
        timestamp: Date.now()
      }]);
      return;
    }

    // TODO: Replace with actual Firestore fetch
    setMessages([
      { id: '1', text: 'Welcome back! What are you crafting today?', sender: 'bot', timestamp: Date.now() }
    ]);
  }, [userId, isPremium]);

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const newMessage: Message = {
      id: Date.now().toString(),
      text: inputText,
      sender: 'user',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    
    // TODO: Call Firebase Cloud Function to send to Telegram
  };

  const startRecording = async () => {
    if (!isPremium) return alert('Upgrade to premium for voice notes!');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/ogg; codecs=opus' });
        // TODO: Upload to Firebase Storage & send to bot
        setIsRecording(false);
      };
      
      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  // PREMIUM LOCK SCREEN
  if (!isPremium) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center bg-gray-50 dark:bg-gray-900 rounded-2xl border">
        <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
          <Lock className="w-8 h-8 text-amber-500" />
        </div>
        <h3 className="font-bold text-lg mb-2">Voice & Chat Locked</h3>
        <p className="text-sm text-gray-500 mb-4">Unlock real-time chat, voice notes, and AI mentorship.</p>
        <button 
          onClick={() => window.open(`https://t.me/mari_beeee?start=buy_premium_50etb`, '_blank')}
          className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded-xl font-bold text-sm transition-colors"
        >
          Unlock for 50 ETB
        </button>
      </div>
    );
  }

  // FULL CHAT INTERFACE
  return (
    <div className="h-[600px] flex flex-col bg-white dark:bg-gray-900 rounded-2xl border shadow-lg overflow-hidden">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
              msg.sender === 'user' 
                ? 'bg-[#0088cc] text-white rounded-br-none' 
                : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-none'
            }`}>
              {msg.text && <p>{msg.text}</p>}
              {msg.voiceUrl && (
                <audio controls src={msg.voiceUrl} className="w-full mt-1" />
              )}
              <span className="text-[10px] opacity-70 block text-right mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 border-t dark:border-gray-800 flex items-center gap-2 bg-gray-50 dark:bg-gray-950">
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
          <ImagePlus className="w-5 h-5" />
        </button>
        
        <div className="flex-1 relative">
          <input
            type="text"
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Type a message..."
            className="w-full px-4 py-2 rounded-full border dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-[#0088cc]/30 text-sm"
          />
          {isRecording && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-red-500 text-xs animate-pulse">
              <div className="w-2 h-2 bg-red-500 rounded-full" /> Recording...
            </div>
          )}
        </div>

        {inputText.trim() ? (
          <button 
            onClick={sendMessage}
            className="p-2 bg-[#0088cc] text-white rounded-full hover:bg-[#0099dd] transition-colors"
          >
            <Send className="w-5 h-5" />
          </button>
        ) : (
          <button 
            onClick={isRecording ? stopRecording : startRecording}
            className={`p-2 rounded-full transition-colors ${
              isRecording ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}