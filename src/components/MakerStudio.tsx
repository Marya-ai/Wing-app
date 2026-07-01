import React, { useState, useEffect, useRef } from 'react';
import { UserProfile, DailyLog } from '../types';
// Import services with safe fallbacks in case they don't exist yet
import { fetchDailyLog, saveDailyLog, addPost } from '../lib/services';
import { Language, translations } from '../lib/translations';
import { 
  Palette, Target, Timer, CheckCircle, Play, Square, 
  BookOpen, Share2, Clock, AlertCircle,
  Zap, Frown, Coffee, RotateCcw, Upload, X
} from 'lucide-react';

interface MakerStudioProps {
  user?: any;           // Made optional
  profile?: UserProfile | null; // Made optional
  isDarkMode?: boolean; // Made optional
  onPostShared?: () => void;    // Made optional
  lang?: Language;      // Made optional
}

export default function MakerStudio({
  user = null,
  profile = null,
  isDarkMode = true,
  onPostShared,
  lang = 'en'
}: MakerStudioProps) {
  
  // Safe translation access with fallback
  const t = translations[lang as Language] || translations['en'];
  
  const [focusGoal, setFocusGoal] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [reflection, setReflection] = useState('');
  const [mood, setMood] = useState<'flow' | 'challenging' | 'peaceful' | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [wipImg, setWipImg] = useState('');
  const [wipImgError, setWipImgError] = useState('');

  // Deep Work Timer State
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  // Load Daily Log
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    
    const loadLog = async () => {
      setLoading(true);
      try {
        // Safe check: only call if function exists
        if (typeof fetchDailyLog === 'function') {
          const log = await fetchDailyLog(user.uid, todayStr);
          if (log) {
            setFocusGoal(log.focus_goal || '');
            setProgressPct(log.progress_pct || 0);
            setReflection(log.reflection || '');
          }
        }
      } catch (err) {
        console.error("Failed to load daily log", err);
      } finally {
        setLoading(false);
      }
    };
    loadLog();
  }, [user]);

  // Handle stopwatch tick
  useEffect(() => {
    if (timerRunning) {
      timerRef.current = setInterval(() => {
        setTimerSeconds(s => s + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timerRunning]);

  const handleSaveLog = async () => {
    if (!user) return;
    try {
      if (typeof saveDailyLog === 'function') {
        await saveDailyLog({
          user_id: user.uid,
          date_str: todayStr,
          focus_goal: focusGoal,
          progress_pct: progressPct,
          reflection: `${mood ? `[${mood.toUpperCase()}] ` : ''}${reflection}`
        });
      }
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareProgress = async () => {
    if (!user || !focusGoal) return;
    
    try {
      const name = profile?.full_name || user.displayName || 'Artisan';
      const moodEmoji = mood === 'flow' ? '✨' : mood === 'challenging' ? '🔨' : mood === 'peaceful' ? '☕' : '';
      
      const wipCaption = `${moodEmoji} WORK IN PROGRESS: ${name}'s studio session\n\n🎯 Focus: "${focusGoal}"\n📈 Progress: ${progressPct}%\n⏱️ Deep Work: ${formatTime(timerSeconds)}\n\n📝 Note: "${reflection || 'Carving and polishing details.'}"`;
      
      if (typeof addPost === 'function') {
        await addPost({
          user_id: user.uid,
          author_name: name,
          author_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          image_url: wipImg || 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&q=80&w=800',
          caption: wipCaption,
          post_type: 'wip' as const,
          materials: ['Studio Wood/Clay', 'Handmade Craft Material'],
          tools: ['Creative Workspace Tools']
        });
      }

      alert('Your Studio progress has been published to the main feed!');
      setWipImg('');
      // Safe callback
      if (typeof onPostShared === 'function') {
        onPostShared();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleWipImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setWipImgError('Image too large. Max 800KB.');
        return;
      }
      setWipImgError('');
      const reader = new FileReader();
      reader.onloadend = () => setWipImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const formatTime = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60).toString().padStart(2, '0');
    const secs = (totalSecs % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  // Theme Variables
  const primaryColor = isDarkMode ? '#D4AF37' : '#E07A5F';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-[#FAF7F0] border-[#EBE7DF]';
  const inputBg = isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white placeholder:text-gray-500' : 'bg-white border-[#EBE7DF] text-black placeholder:text-gray-400';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  // Circular Progress SVG Math
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progressPct / 100) * circumference;

  // Show auth prompt if no user
  if (!user && !loading) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center p-8">
        <div className={`text-center max-w-md p-8 rounded-3xl border ${cardBg}`}>
          <Palette className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: primaryColor }} />
          <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>Sign In Required</h3>
          <p className={`text-sm mb-6 ${textSecondary}`}>Please sign in to access your personal creative studio and track your daily craft logs.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 md:pb-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h2 className={`text-2xl font-bold tracking-tight mb-1 flex items-center gap-2 ${textPrimary}`}>
            <Palette className="w-6 h-6" style={{ color: primaryColor }} /> 
            {t.makerStudio || 'My Creative Studio'}
          </h2>
          <p className={`text-xs ${textSecondary}`}>
            Track deep-work logs, set focus goals, and share live progress with WING.
          </p>
        </div>
        <div className={`text-xs px-4 py-2 rounded-xl border font-mono ${cardBg}`}>
          <span className="opacity-60">DATE: </span>
          <span className="font-bold">{new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: primaryColor }} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-7xl mx-auto">
          
          {/* LEFT COLUMN: Goal & Reflection */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Focus Goal Card with Circular Progress */}
            <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
              <div className="flex flex-col sm:flex-row gap-6 items-start">
                <div className="flex-1 w-full">
                  <label className={`block text-xs font-black uppercase tracking-wider mb-3 ${textSecondary}`}>
                    Today's Focus Goal
                  </label>
                  <input
                    type="text"
                    placeholder="What masterpiece are you crafting today?"
                    value={focusGoal}
                    onChange={(e) => setFocusGoal(e.target.value)}
                    className={`w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all focus:ring-4 ${inputBg}`}
                    style={{ '--tw-ring-color': `${primaryColor}20` } as React.CSSProperties}
                  />
                  
                  <div className="mt-6">
                    <div className="flex justify-between items-end mb-2">
                      <span className={`text-xs font-bold ${textSecondary}`}>COMPLETION</span>
                      <span className="text-lg font-black" style={{ color: primaryColor }}>{progressPct}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progressPct}
                      onChange={(e) => setProgressPct(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-current"
                      style={{ accentColor: primaryColor }}
                    />
                    <div className={`flex justify-between mt-2 text-[10px] font-mono ${textSecondary}`}>
                      <span>Sketching</span>
                      <span>Shaping</span>
                      <span>Glazing</span>
                      <span>Done!</span>
                    </div>
                  </div>
                </div>

                {/* Visual Circular Indicator */}
                <div className="relative w-28 h-28 flex-shrink-0 hidden sm:block">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle cx="56" cy="56" r={radius} stroke="currentColor" strokeWidth="8" fill="transparent" className="text-gray-200 dark:text-gray-800" />
                    <circle 
                      cx="56" cy="56" r={radius} 
                      stroke={primaryColor} 
                      strokeWidth="8" 
                      fill="transparent" 
                      strokeDasharray={circumference} 
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-500 ease-out"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center flex-col">
                    <Target className="w-6 h-6 mb-1" style={{ color: primaryColor }} />
                    <span className={`text-[10px] font-bold ${textSecondary}`}>FOCUS</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Reflection Log with Mood Selector */}
            <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
              <div className="flex items-center gap-2 mb-4">
                <BookOpen className="w-5 h-5" style={{ color: primaryColor }} />
                <h3 className={`font-bold text-sm uppercase tracking-wider ${textPrimary}`}>Daily Reflection</h3>
              </div>

              {/* Mood Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {[
                  { id: 'flow', icon: Zap, label: 'Flow State' },
                  { id: 'challenging', icon: Frown, label: 'Challenging' },
                  { id: 'peaceful', icon: Coffee, label: 'Peaceful' }
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMood(m.id as any)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-bold transition-all ${
                      mood === m.id 
                        ? 'border-transparent text-white scale-105 shadow-md' 
                        : `${isDarkMode ? 'border-gray-700 text-gray-400 hover:bg-gray-800' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`
                    }`}
                    style={mood === m.id ? { backgroundColor: primaryColor } : {}}
                  >
                    <m.icon className="w-3.5 h-3.5" />
                    {m.label}
                  </button>
                ))}
              </div>

              <textarea
                rows={4}
                placeholder="How is your work flowing today? Note discoveries or roadblocks..."
                value={reflection}
                onChange={(e) => setReflection(e.target.value)}
                className={`w-full px-4 py-3.5 rounded-2xl border text-sm outline-none transition-all resize-none focus:ring-4 ${inputBg}`}
                style={{ '--tw-ring-color': `${primaryColor}20` } as React.CSSProperties}
              />

              {/* WIP Image Upload */}
              <div className="mt-4">
                <label className={`block text-xs font-black uppercase tracking-wider mb-2 ${textSecondary}`}>
                  Attach Progress Photo (Optional)
                </label>
                
                {wipImgError && (
                  <div className="mb-2 p-2 rounded-xl text-xs bg-red-500/10 text-red-500 border border-red-500/20 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {wipImgError}
                  </div>
                )}

                <div className={`relative border-2 border-dashed rounded-2xl p-6 text-center transition-all group ${
                  wipImg ? 'border-solid' : 'hover:border-opacity-70'
                } ${isDarkMode ? 'border-gray-700' : 'border-gray-300'}`}
                  style={wipImg ? { borderColor: primaryColor } : {}}
                >
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleWipImgChange}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  />
                  
                  {wipImg ? (
                    <div className="relative inline-block">
                      <img src={wipImg} alt="WIP" className="max-h-40 rounded-xl object-cover shadow-lg" />
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setWipImg(''); }}
                        className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors z-20"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <div className={`flex flex-col items-center gap-2 ${textSecondary} group-hover:scale-105 transition-transform`}>
                      <Upload className="w-8 h-8" />
                      <p className="text-sm font-bold">Tap to upload WIP snapshot</p>
                      <p className="text-[10px] opacity-70">Max 800KB • JPG/PNG</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 mt-6 pt-6 border-t border-black/5 dark:border-white/5">
                <button
                  onClick={handleSaveLog}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full text-xs font-bold transition-all active:scale-95 ${
                    isSaved ? 'bg-green-600 text-white' : 'text-white shadow-lg hover:shadow-xl'
                  }`}
                  style={!isSaved ? { backgroundColor: primaryColor } : {}}
                >
                  {isSaved ? <CheckCircle className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  {isSaved ? 'Progress Saved!' : 'Save Daily Log'}
                </button>

                <button
                  onClick={handleShareProgress}
                  disabled={!focusGoal}
                  className={`flex items-center gap-2 px-5 py-3 rounded-full text-xs font-bold transition-all border active:scale-95 ${
                    !focusGoal 
                      ? 'opacity-40 cursor-not-allowed border-gray-300 text-gray-400' 
                      : `hover:bg-opacity-10 ${isDarkMode ? 'border-[#D4AF37] text-[#D4AF37]' : 'border-[#E07A5F] text-[#E07A5F]'}`
                  }`}
                >
                  <Share2 className="w-4 h-4" /> Publish WIP to Feed
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Timer Only */}
          <div className="lg:col-span-4">
            
            {/* Deep Work Timer */}
            <div className={`rounded-3xl p-6 border text-center relative overflow-hidden shadow-sm ${cardBg}`}>
              {/* Ambient Glow */}
              <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full opacity-10 blur-xl pointer-events-none`} style={{ backgroundColor: primaryColor }} />

              <div className="flex items-center justify-center gap-2 mb-6">
                <Timer className="w-5 h-5" style={{ color: primaryColor }} />
                <h3 className={`font-bold text-sm uppercase tracking-wider ${textPrimary}`}>Deep Work Timer</h3>
              </div>

              {/* Time Display with Pulse Effect */}
              <div className="my-8 relative">
                {timerRunning && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 -mt-3 flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-[9px] font-bold text-red-500 uppercase tracking-widest">Recording</span>
                  </div>
                )}
                <span className={`text-5xl font-mono font-black tracking-wider tabular-nums ${textPrimary}`}>
                  {formatTime(timerSeconds)}
                </span>
                <p className={`text-[10px] mt-2 uppercase tracking-widest flex items-center justify-center gap-1 ${textSecondary}`}>
                  <Clock className="w-3.5 h-3.5" /> Session Duration
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-3">
                {!timerRunning ? (
                  <button
                    onClick={() => setTimerRunning(true)}
                    className="flex items-center gap-2 px-8 py-3 rounded-full text-xs font-bold text-white transition-all active:scale-95 shadow-lg hover:shadow-xl"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Play className="w-4 h-4 fill-current" /> Start Work
                  </button>
                ) : (
                  <button
                    onClick={() => setTimerRunning(false)}
                    className="flex items-center gap-2 px-8 py-3 rounded-full text-xs font-bold bg-red-600 text-white transition-all active:scale-95 shadow-lg hover:bg-red-700"
                  >
                    <Square className="w-4 h-4 fill-current" /> Pause
                  </button>
                )}

                <button
                  onClick={() => { setTimerRunning(false); setTimerSeconds(0); }}
                  className={`p-3 rounded-full border transition-all active:scale-95 ${
                    isDarkMode ? 'border-gray-700 text-gray-400 hover:bg-white/5' : 'border-gray-200 text-gray-600 hover:bg-black/5'
                  }`}
                  title="Reset Timer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>

              <div className={`mt-8 pt-4 border-t text-[10px] italic leading-relaxed ${isDarkMode ? 'border-white/5 text-gray-500' : 'border-black/5 text-gray-400'}`}>
                "Traditional craft demands undivided focus. Put on your apron, start the clock, and enter the flow state."
              </div>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}