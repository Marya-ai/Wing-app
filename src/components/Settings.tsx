import React, { useState, useEffect } from 'react';
import { UserProfile, Post } from '../types';
import { translations, Language } from '../lib/translations';
// Safe imports with fallback checks
import { 
  createOrUpdateProfile, 
  fetchSavesDetailed, 
  fetchAllPosts 
} from '../lib/services';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { 
  Settings as SettingsIcon, 
  Sun, 
  Moon, 
  User, 
  Bookmark, 
  Heart, 
  Wrench,
  Sparkles,
  Save,
  CheckCircle2,
  HelpCircle,
  Send,
  FileText,
  Scale,
  X,
  LogOut,
  Download,
  ShieldAlert
} from 'lucide-react';

interface SettingsProps {
  user?: any;                    // Made optional
  profile?: UserProfile | null;  // Made optional
  onProfileUpdated?: () => void; // Made optional
  isDarkMode?: boolean;          // Made optional
  setIsDarkMode?: (val: boolean) => void; // Made optional
  onSelectPost?: (post: Post) => void;    // Made optional
  lang?: Language;               // Made optional
}

export default function Settings({
  user = null,
  profile = null,
  onProfileUpdated,
  isDarkMode = true,
  setIsDarkMode,
  onSelectPost,
  lang = 'en'
}: SettingsProps) {
  
  // Safe translation access with fallback
  const t = translations[lang as Language] || translations['en'];
  
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [isMaker, setIsMaker] = useState(false);
  const [telegramUsername, setTelegramUsername] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showTerms, setShowTerms] = useState(false);

  // Saved boards posts state
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [loadingSaves, setLoadingSaves] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setBio(profile.bio || '');
      setIsMaker(profile.is_maker || false);
      setTelegramUsername(profile.telegram_username || '');
    }
  }, [profile]);

  // Load Saved Pins
  useEffect(() => {
    if (!user) return;
    const loadSaves = async () => {
      setLoadingSaves(true);
      try {
        // Safe check: only call if functions exist
        if (typeof fetchSavesDetailed === 'function' && typeof fetchAllPosts === 'function') {
          const saves = await fetchSavesDetailed(user.uid);
          const posts = await fetchAllPosts();
          
          // Find saved posts
          const saved = saves.map(s => posts.find(p => p.id === s.post_id)).filter(Boolean) as Post[];
          setSavedPosts(saved);
        }
      } catch (err) {
        console.error("Failed to load saved pins:", err);
      } finally {
        setLoadingSaves(false);
      }
    };
    loadSaves();
  }, [user]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setSaving(true);
    setSuccess(false);
    try {
      if (typeof createOrUpdateProfile === 'function') {
        await createOrUpdateProfile(user.uid, {
          full_name: fullName,
          bio: bio,
          is_maker: isMaker,
          telegram_username: telegramUsername,
          theme_preference: isDarkMode ? 'dark' : 'light'
        });
      }
      setSuccess(true);
      // Safe callback
      if (typeof onProfileUpdated === 'function') {
        onProfileUpdated();
      }
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleThemeToggle = (dark: boolean) => {
    if (typeof setIsDarkMode === 'function') {
      setIsDarkMode(dark);
    }
    if (user && typeof createOrUpdateProfile === 'function') {
      createOrUpdateProfile(user.uid, { theme_preference: dark ? 'dark' : 'light' });
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Sign out error:", err);
    }
  };

  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black hover:bg-opacity-90' : 'bg-[#E07A5F] text-white hover:bg-opacity-90';
  const activeBorder = isDarkMode ? 'border-[#D4AF37]' : 'border-[#E07A5F]';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-[#FAF7F0] border-[#EBE7DF]';
  const inputBg = isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white placeholder:text-gray-500' : 'bg-[#FAF7F0] border-[#EBE7DF] text-black placeholder:text-gray-400';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  // Show auth prompt if no user
  if (!user) {
    return (
      <div className="flex-1 min-h-screen flex items-center justify-center p-8">
        <div className={`text-center max-w-md p-8 rounded-3xl border ${cardBg}`}>
          <SettingsIcon className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: isDarkMode ? '#D4AF37' : '#E07A5F' }} />
          <h3 className={`text-xl font-bold mb-2 ${textPrimary}`}>Sign In Required</h3>
          <p className={`text-sm mb-6 ${textSecondary}`}>Please sign in to access your settings, customize your profile, and manage your saved crafts.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 md:pb-6 overflow-y-auto">
      
      {/* Settings Header */}
      <div className="pb-4 border-b transition-colors duration-200 border-opacity-10 mb-8 border-gray-200 dark:border-gray-800">
        <h2 className={`text-2xl font-sans font-bold tracking-tight mb-1 flex items-center gap-2 ${textPrimary}`}>
          <SettingsIcon className={`w-6 h-6 ${activeColor}`} /> {t.settings || 'Settings'}
        </h2>
        <p className={`text-xs ${textSecondary}`}>
          {lang === 'am'
            ? 'ጭብጥ ምርጫዎችን ያዋቅሩ፣ የስቱዲዮ መግለጫዎን ርትዑ እና የተቀመጡ የእደ-ጥበብ ሰሌዳዎችን ይመልከቱ'
            : 'Configure theme preferences, edit your studio bio, specify Telegram usernames, and view saved craft boards.'}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Profile & Theme settings */}
        <div className="lg:col-span-6 space-y-6">
          
          {/* 1. Theme Selection Box */}
          <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
            <h3 className={`font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 ${textPrimary}`}>
              <Sun className="w-5 h-5 text-amber-500" /> {t.styleCustomization || 'Style Customization'}
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <button
                id="theme-light-btn"
                onClick={() => handleThemeToggle(false)}
                className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                  !isDarkMode 
                    ? activeBorder + ' bg-[#FDFBF7] shadow-md' 
                    : 'bg-[#242424] border-transparent opacity-60'
                }`}
              >
                <Sun className="w-6 h-6 text-[#E07A5F]" />
                <span className="text-xs font-bold">{t.warmBeige || 'Warm Beige'}</span>
                <span className="text-[9px] opacity-60">{t.warmBeigeDesc || 'Soft & Natural'}</span>
              </button>

              <button
                id="theme-dark-btn"
                onClick={() => handleThemeToggle(true)}
                className={`p-4 rounded-2xl border text-center flex flex-col items-center justify-center gap-2 transition-all ${
                  isDarkMode 
                    ? activeBorder + ' bg-[#1C1C1C] shadow-md' 
                    : 'bg-white border-transparent opacity-60'
                }`}
              >
                <Moon className="w-6 h-6 text-[#D4AF37]" />
                <span className="text-xs font-bold">{t.deepSlate || 'Deep Slate'}</span>
                <span className="text-[9px] opacity-60">{t.deepSlateDesc || 'Focus & Contrast'}</span>
              </button>
            </div>
          </div>

          {/* 2. Profile Details Form */}
          <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
            <h3 className={`font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 ${textPrimary}`}>
              <User className={`w-5 h-5 ${activeColor}`} /> {t.editProfile || 'Edit Profile'}
            </h3>

            {success && (
              <div className="mb-4 p-2.5 rounded-xl bg-green-500/15 border border-green-500/35 text-green-500 text-xs font-mono flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" /> {lang === 'am' ? 'መገለጫው በትክክል ተቀምጧል!' : 'Profile Saved Successfully!'}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              {/* Full name */}
              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 opacity-70 ${textPrimary}`}>{t.artisanName || 'Artisan Name'}</label>
                <input
                  id="settings-fullname"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={`w-full px-4 py-2 rounded-xl border text-xs outline-none transition-all ${inputBg}`}
                />
              </div>

              {/* Bio */}
              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 opacity-70 ${textPrimary}`}>{t.shortBio || 'Short Bio'}</label>
                <textarea
                  id="settings-bio"
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Describe your wood turning, ceramic sculpting, or jewel making experience..."
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-none transition-all resize-none ${inputBg}`}
                />
              </div>

              {/* Telegram handle */}
              <div>
                <label className={`block text-xs font-bold uppercase mb-1.5 opacity-70 ${textPrimary}`}>{t.telegramHandle || 'Telegram Handle'}</label>
                <input
                  id="settings-telegram"
                  type="text"
                  value={telegramUsername}
                  onChange={(e) => setTelegramUsername(e.target.value)}
                  placeholder={t.telegramHandlePlaceholder || '@yourusername'}
                  className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-none transition-all ${inputBg}`}
                />
              </div>

              {/* Maker status */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-black/5 dark:bg-white/5">
                <div>
                  <h4 className={`text-xs font-bold ${textPrimary}`}>{t.studioMode || 'Studio Mode'}</h4>
                  <p className={`text-[10px] ${textSecondary}`}>{t.studioModeDesc || 'Enable seller features & inventory management'}</p>
                </div>
                <button
                  id="settings-maker-toggle"
                  type="button"
                  onClick={() => setIsMaker(!isMaker)}
                  className={`w-11 h-6 rounded-full p-0.5 transition-colors duration-200 outline-none ${
                    isMaker ? (isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]') : 'bg-gray-400'
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform duration-200 shadow ${
                    isMaker ? 'translate-x-5' : 'translate-x-0'
                  }`} />
                </button>
              </div>

              {/* Save button */}
              <button
                id="settings-save-profile"
                type="submit"
                disabled={saving}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all focus:scale-95 duration-150 flex items-center justify-center gap-2 ${activeBg}`}
              >
                <Save className="w-4 h-4" />
                <span>{saving ? 'Saving...' : (t.saveProfileDetails || 'Save Profile Details')}</span>
              </button>
            </form>
          </div>

          {/* 3. Account Security (NEW NECESSARY SECTION) */}
          <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
            <h3 className={`font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 ${textPrimary}`}>
              <ShieldAlert className={`w-5 h-5 ${activeColor}`} /> Account Security
            </h3>
            <div className="space-y-3">
              <button
                onClick={handleSignOut}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-colors ${
                  isDarkMode ? 'border-[#2D2D2D] text-gray-300' : 'border-[#EBE7DF] text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of WING</span>
                </span>
                <span className="text-[10px] opacity-60">Secure Exit</span>
              </button>
              
              <button
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold hover:bg-opacity-10 transition-colors ${
                  isDarkMode ? 'border-[#2D2D2D] hover:bg-white/5 text-gray-300' : 'border-[#EBE7DF] hover:bg-black/5 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-blue-500" />
                  <span>Export My Data</span>
                </span>
                <span className="text-[10px] opacity-60">GDPR Compliant</span>
              </button>
            </div>
          </div>

          {/* 4. Help Center */}
          <div className={`rounded-3xl p-6 border shadow-sm ${cardBg}`}>
            <h3 className={`font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 ${textPrimary}`}>
              <HelpCircle className={`w-5 h-5 ${activeColor}`} /> {t.helpCenter || 'Help Center'}
            </h3>
            <p className={`text-xs ${textSecondary} mb-4`}>{t.helpCenterDesc || 'Get support and review platform policies.'}</p>
            <div className="space-y-3">
              <a
                href={user ? `https://t.me/WingArtisanBot?start=bind_${user.uid}` : "https://t.me/WingArtisanBot"}
                target="_blank"
                rel="noopener noreferrer"
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold hover:bg-opacity-10 transition-colors ${
                  isDarkMode ? 'border-[#2D2D2D] hover:bg-white/5 text-gray-300' : 'border-[#EBE7DF] hover:bg-black/5 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Send className="w-4 h-4 text-sky-400" />
                  <span>{t.helpDeskTelegram || 'Help Desk Telegram'}</span>
                </span>
                <span className="text-[10px] opacity-60">{t.openBot || 'Open Bot'}</span>
              </a>

              <button
                onClick={() => setShowPrivacy(true)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold hover:bg-opacity-10 transition-colors text-left cursor-pointer ${
                  isDarkMode ? 'border-[#2D2D2D] hover:bg-white/5 text-gray-300' : 'border-[#EBE7DF] hover:bg-black/5 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-500" />
                  <span>{t.privacyPolicy || 'Privacy Policy'}</span>
                </span>
                <span className="text-[10px] opacity-60">{t.readPolicy || 'Read Policy'}</span>
              </button>

              <button
                onClick={() => setShowTerms(true)}
                className={`w-full p-3 rounded-xl border flex items-center justify-between text-xs font-semibold hover:bg-opacity-10 transition-colors text-left cursor-pointer ${
                  isDarkMode ? 'border-[#2D2D2D] hover:bg-white/5 text-gray-300' : 'border-[#EBE7DF] hover:bg-black/5 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber-500" />
                  <span>{t.termsOfService || 'Terms of Service'}</span>
                </span>
                <span className="text-[10px] opacity-60">{t.readTerms || 'Read Terms'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Right Side: Saved Pins Board */}
        <div className="lg:col-span-6">
          <div className={`rounded-3xl p-6 border shadow-sm h-full ${cardBg}`}>
            <h3 className={`font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2 ${textPrimary}`}>
              <Bookmark className={`w-5 h-5 ${activeColor}`} /> {t.savedPins || 'Saved Pins'}
            </h3>

            {loadingSaves ? (
              <div className="py-20 text-center text-xs text-gray-400 font-mono">Exploring saved collections...</div>
            ) : savedPosts.length === 0 ? (
              <div className="py-20 text-center text-xs text-gray-400">
                <Bookmark className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <span>{t.savesEmpty || 'No saved crafts yet. Tap the bookmark icon on any post to save it here.'}</span>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[450px] pr-2">
                {savedPosts.map((post) => (
                  <div
                    id={`saved-pin-thumb-${post.id}`}
                    key={post.id}
                    onClick={() => typeof onSelectPost === 'function' && onSelectPost(post)}
                    className="relative rounded-xl overflow-hidden aspect-square border cursor-pointer group hover:scale-102 transition-transform duration-200"
                  >
                    <img
                      src={post.image_url}
                      alt={post.caption}
                      className="w-full h-full object-cover"
                      draggable="false"
                      onContextMenu={(e) => e.preventDefault()}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-[10px] text-white font-bold font-mono">View Pin</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* PRIVACY POLICY MODAL */}
      {showPrivacy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`relative w-full max-w-lg rounded-2xl p-6 border shadow-2xl ${
            isDarkMode ? 'bg-[#1A1A1A] text-white border-[#2D2D2D]' : 'bg-white text-black border-[#EBE7DF]'
          }`}>
            <button
              onClick={() => setShowPrivacy(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold font-sans mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-emerald-500" /> {t.privacyPolicy || 'Privacy Policy'}
            </h3>
            <div className="text-xs space-y-3.5 max-h-[350px] overflow-y-auto pr-1 leading-relaxed opacity-90">
              <p className="font-bold">Last Updated: June 2026</p>
              <p>
                Welcome to WING Artisan Platform. We respect your privacy and are committed to protecting any personal information you share with us.
              </p>
              <p className="font-bold">1. Information We Collect</p>
              <p>
                - **Profile Information:** When you register, we collect your name, username, bio, and custom avatar.
                - **Telegram Handle:** If provided, we store your Telegram username securely to facilitate buyer communication.
                - **Activity Data:** We collect posts, progress logs, timer sessions, likes, and message logs to provide social features.
              </p>
              <p className="font-bold">2. How We Use Information</p>
              <p>
                We use your data solely to support the artisan community network, enable peer chat, mentor interactions with Wing Guide, and secure client-merchant routing. We never sell your data to brokers or advertisers.
              </p>
              <p className="font-bold">3. Contact & Inquiries</p>
              <p>
                If you have questions about your stored data, you can contact our privacy officer directly via our official Telegram bot support line.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TERMS OF SERVICE MODAL */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`relative w-full max-w-lg rounded-2xl p-6 border shadow-2xl ${
            isDarkMode ? 'bg-[#1A1A1A] text-white border-[#2D2D2D]' : 'bg-white text-black border-[#EBE7DF]'
          }`}>
            <button
              onClick={() => setShowTerms(false)}
              className="absolute top-4 right-4 p-1.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold font-sans mb-4 flex items-center gap-2">
              <Scale className="w-5 h-5 text-amber-500" /> {t.termsOfService || 'Terms of Service'}
            </h3>
            <div className="text-xs space-y-3.5 max-h-[350px] overflow-y-auto pr-1 leading-relaxed opacity-90">
              <p className="font-bold">Effective Date: June 2026</p>
              <p>
                By accessing WING, you agree to be bound by these traditional craft alliance guidelines and platform policies.
              </p>
              <p className="font-bold">1. Community Guild Conduct</p>
              <p>
                WING is a safe sanctuary for hand-carvers, potters, loom weavers, and metalsmiths. Any harassment, hate speech, plagiarism of designs, or automated spamming is strictly prohibited and results in immediate wallet and profile suspension.
              </p>
              <p className="font-bold">2. Digital and Physical Trade</p>
              <p>
                - **Decentralized Contact:** Transaction negotiations initiated through WING (including those routed via our Telegram Bot) are purely peer-to-peer. WING does not take transaction cuts and holds no liability for shipping, quality, or payments.
                - **Listing Integrity:** Makers must represent their hand-carved materials, ingredients, and tools honestly.
              </p>
              <p className="font-bold">3. Platform Services</p>
              <p>
                Our AI Mentor (Wing Guide) provides helpful technical guidance. All safety cautions (especially around butane torches, high-temperature kilns, and sharp lathe tools) are recommendations only. Always exercise physical workshop safety.
              </p>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}