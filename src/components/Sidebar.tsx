import { User } from 'firebase/auth';
import { UserProfile } from '../types';
import { translations, Language } from '../lib/translations';
import { 
  Home, 
  Bell, 
  MessageSquare, 
  Sparkles, 
  Palette, 
  Settings, 
  LogOut, 
  LogIn
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: User | null;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  isDarkMode: boolean;
  lang: Language;
}

export default function Sidebar({
  activeTab,
  setActiveTab,
  user,
  profile,
  onOpenAuth,
  onLogout,
  isDarkMode,
  lang
}: SidebarProps) {

  const menuItems = [
    { id: 'home', label: translations[lang].feed, icon: Home },
    { id: 'explore', label: translations[lang].notifications, icon: Bell },
    { id: 'messages', label: translations[lang].chatRoom, icon: MessageSquare },
    { id: 'mentor', label: translations[lang].aiMentor, icon: Sparkles },
    ...(profile?.is_maker ? [{ id: 'studio', label: translations[lang].myStudio, icon: Palette }] : []),
    { id: 'settings', label: translations[lang].settings, icon: Settings },
  ];

  const themeAccentText = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const themeAccentBg = isDarkMode ? 'bg-[#D4AF37]/10 text-[#D4AF37]' : 'bg-[#E07A5F]/10 text-[#E07A5F]';
  const hoverBgClass = isDarkMode ? 'hover:bg-white/5' : 'hover:bg-black/5';

  return (
    <>
      {/* 1. Desktop Left Sidebar */}
      <aside 
        id="desktop-sidebar"
        className={`hidden md:flex flex-col justify-between w-64 h-screen sticky top-0 border-r p-6 transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-[#121212] border-[#2D2D2D] text-[#EAEAEA]' 
            : 'bg-[#FDFBF7] border-[#EBE7DF] text-[#2C2C2C]'
        }`}
      >
        <div className="flex flex-col gap-10">
          {/* --- BRAND LOGO SECTION --- */}
          <div className="flex flex-col items-center pt-2">
            <div className="relative group">
              <img 
                src="/wing-logo.png" 
                alt="WING" 
                className="w-44 h-auto object-contain transition-transform duration-300 group-hover:scale-105"
                onError={(e) => {
                  // Fallback: If image fails to load, show text instead
                  e.currentTarget.style.display = 'none';
                  const fallback = e.currentTarget.parentElement?.querySelector('.logo-text');
                  if (fallback) fallback.classList.remove('hidden');
                }}
              />
              {/* Fallback Text (Hidden unless image fails) */}
              <h1 className="logo-text hidden text-3xl font-black tracking-tighter uppercase italic">
                Wing
              </h1>
            </div>
            
            {/* Subtitle */}
            <p className={`text-[9px] font-black uppercase tracking-[0.5em] opacity-30 mt-3 transition-opacity group-hover:opacity-50 ${
              isDarkMode ? 'text-white' : 'text-black'
            }`}>
              Artisan Platform
            </p>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1.5">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  id={`sidebar-item-${item.id}`}
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-3.5 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-200 ${
                    isActive 
                      ? themeAccentBg + ' shadow-sm translate-x-1' 
                      : hoverBgClass + ' text-opacity-70'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? themeAccentText : 'opacity-70'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* User profile at the bottom */}
        <div className="flex flex-col gap-4 border-t pt-6 transition-colors duration-200 border-opacity-10">
          {user ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 overflow-hidden">
                <img
                  src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
                  alt="avatar"
                  className="w-11 h-11 rounded-full border border-gray-400 object-cover shadow-sm transition-transform hover:scale-110"
                />
                <div className="overflow-hidden">
                  <p className="text-sm font-black truncate">{profile?.full_name || user.displayName || 'Artisan'}</p>
                  <p className="text-[10px] opacity-60 truncate font-mono uppercase tracking-tighter">@{profile?.username || 'artisan'}</p>
                </div>
              </div>
              <button
                id="sidebar-logout"
                onClick={onLogout}
                title="Log Out"
                className={`p-2.5 rounded-xl transition-colors ${hoverBgClass} text-red-500 active:scale-90`}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              id="sidebar-login"
              onClick={onOpenAuth}
              className={`flex items-center justify-center gap-2.5 w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all shadow-lg active:scale-95 duration-150 ${
                isDarkMode 
                  ? 'bg-[#D4AF37] hover:brightness-110 text-black shadow-[#D4AF37]/10' 
                  : 'bg-[#E07A5F] hover:brightness-110 text-white shadow-[#E07A5F]/10'
              }`}
            >
              <LogIn className="w-4 h-4" />
              <span>{translations[lang].connectWallet}</span>
            </button>
          )}
        </div>
      </aside>

      {/* 2. Mobile Bottom Sticky Nav */}
      <nav 
        id="mobile-bottom-nav"
        className={`md:hidden fixed bottom-0 left-0 right-0 z-[100] border-t flex items-center justify-around py-3 transition-colors duration-300 ${
          isDarkMode 
            ? 'bg-[#121212]/95 border-[#2D2D2D] text-[#EAEAEA] backdrop-blur-xl' 
            : 'bg-[#FDFBF7]/95 border-[#EBE7DF] text-[#2C2C2C] backdrop-blur-xl'
        }`}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              id={`mobile-nav-item-${item.id}`}
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center justify-center p-2 min-w-[64px] transition-all duration-150 active:scale-90 ${
                isActive ? themeAccentText : 'opacity-40'
              }`}
            >
              <Icon className={`${isActive ? 'w-6 h-6' : 'w-5 h-5'} transition-all`} />
              <span className={`text-[8px] mt-1.5 font-black uppercase tracking-widest ${isActive ? 'opacity-100' : 'opacity-60'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {!user && (
          <button
            id="mobile-nav-login"
            onClick={onOpenAuth}
            className={`flex flex-col items-center justify-center p-2 min-w-[64px] ${themeAccentText} active:scale-90`}
          >
            <LogIn className="w-5 h-5" />
            <span className="text-[8px] mt-1.5 font-black uppercase tracking-widest">Join</span>
          </button>
        )}
      </nav>
    </>
  );
}