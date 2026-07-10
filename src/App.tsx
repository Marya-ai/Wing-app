import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { Post, UserProfile } from './types';

// --- COMPONENT IMPORTS ---
import LandingPage from './components/LandingPage';
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
// FIXED PATH: Removing the '/auth/' subfolder which caused the Vite error
import AuthModal from './components/AuthModalNew'; 
import SellerDashboard from './components/SellerDashboard';
import AdminDashboard from './components/AdminDashboard';
import CommunityChat from './components/CommunityChat';
import Notifications from './components/Notifications';
import AIMentor from './components/AIMentor';
import MakerStudio from './components/MakerStudio';
import Settings from './components/Settings';

import {
  Compass, LayoutDashboard, ShieldAlert, Moon, Sun, LogOut,
  Bell, MessageSquare, Brain, User, Settings as SettingsIcon, Image as ImageIcon,
  ChevronRight, Menu, X, Globe, Sparkles, AlertTriangle
} from 'lucide-react';

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("WING Component crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 text-red-500 bg-black/20 rounded-3xl border border-red-500/20">
          <AlertTriangle size={48} className="mb-4 text-red-500" />
          <h3 className="text-xl font-black uppercase">Component Error</h3>
          <p className="text-xs mt-2 opacity-70">The Guardian Bot intercepted a crash. Check console.</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-2 bg-red-500 text-white rounded-xl text-[10px] font-black uppercase"
          >
            Reboot System
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function WingApp() {
  // --- AUTH & PROFILE STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- NAVIGATION & UI STATE ---
  const [hasEntered, setHasEntered] = useState(false);
  const [view, setView] = useState<string>('feed');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'am'>('en');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // 1. INITIAL AUTH CHECK (JWT Persistence)
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('wing_token');
      const savedUser = localStorage.getItem('wing_user');
      
      if (token && savedUser) {
        try {
          // Verify JWT with backend via Proxy
          const response = await fetch('/api/auth/me', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          
          if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            setProfile(data.user as UserProfile);
          } else {
            handleLogout();
          }
        } catch (err) {
          console.error('[WING AUTH] Verification failed:', err);
        }
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  // RBAC LOGIC (Role Based Access Control)
  const isAdmin = user?.role === 'admin';
  const isSeller = user?.role === 'seller' || user?.role === 'admin';
  
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  // AUTH HANDLERS
  const handleLoginSuccess = (token: string, userData: any) => {
    setUser(userData);
    setProfile(userData as UserProfile);
    setShowAuthModal(false);
    console.log(`[GUARDIAN] User ${userData.email} verified as ${userData.role}`);
  };

  const handleLogout = () => {
    localStorage.removeItem('wing_token');
    localStorage.removeItem('wing_user');
    setUser(null);
    setProfile(null);
    setView('feed');
    window.location.reload(); // Refresh to clear state
  };

  // UI - Loading State
  if (loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#0A0A0A]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#FFD700] mb-4"></div>
        <p className="text-[#FFD700] text-[10px] font-black uppercase tracking-[0.3em] animate-pulse">Initializing Wing</p>
      </div>
    );
  }

  // UI - Landing State
  if (!hasEntered) {
    return <LandingPage onGetStarted={() => setHasEntered(true)} />;
  }

  // MAIN VIEW ROUTER
  const renderContent = () => {
    const commonProps = { user, isDarkMode };

    switch (view) {
      case 'feed':
        return (
          <SocialFeed
            user={user}
            profile={profile}
            onSelectPost={setSelectedPost}
            isDarkMode={isDarkMode}
            activeSearchQuery={activeSearchQuery}
            setActiveSearchQuery={setActiveSearchQuery}
            onOpenAuth={() => setShowAuthModal(true)}
            currentLang={lang}
            setCurrentLang={setLang}
          />
        );
      case 'seller':
        return isSeller 
          ? <SellerDashboard {...commonProps} profile={profile} /> 
          : <AccessDenied />;
      case 'admin':
        return isAdmin 
          ? <AdminDashboard {...commonProps} profile={profile} /> 
          : <AccessDenied />;
      case 'notifications':
        return <Notifications {...commonProps} lang={lang} onOpenAuth={() => setShowAuthModal(true)} onSelectPost={setSelectedPost} posts={[]} />;
      case 'chat':
        return <CommunityChat {...commonProps} />;
      case 'mentor':
        return <AIMentor {...commonProps} lang={lang} />;
      case 'studio':
        return <MakerStudio {...commonProps} profile={profile} onPostShared={() => setView('feed')} lang={lang} />;
      case 'settings':
        return <Settings {...commonProps} profile={profile} onProfileUpdated={() => { }} onSelectPost={setSelectedPost} lang={lang} />;
      default:
        return <ComingSoon title={view} />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>

      {/* --- SIDEBAR (GOLD THEME) --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-[5000] w-72 transform transition-all duration-300 ease-in-out border-r flex flex-col
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
        ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}
      `}>

        <div className="p-10 flex items-center justify-between">
          <div className="flex items-center gap-3 group cursor-pointer">
            <div className="w-10 h-10 bg-[#FFD700] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,215,0,0.2)] group-hover:rotate-12 transition-transform">
              <Sparkles size={22} className="text-black" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tighter text-[#FFD700]">Wing</h1>
              <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30">Artisan Alliance</p>
            </div>
          </div>
          <button onClick={toggleMenu} className="lg:hidden p-2 text-gray-500"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-6 space-y-1 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3 mt-6">Marketplace</p>
          <SidebarLink icon={<Compass />} label="Explore Feed" active={view === 'feed'} onClick={() => { setView('feed'); setIsMenuOpen(false); }} />
          
          {/* RBAC: Seller Link */}
          {isSeller && (
            <SidebarLink 
              icon={<LayoutDashboard />} 
              label="Seller Office" 
              active={view === 'seller'} 
              onClick={() => { setView('seller'); setIsMenuOpen(false); }} 
            />
          )}

          <p className="px-4 text-[9px] font-black text-gray-600 uppercase tracking-widest mb-3 mt-8">Studio Tools</p>
          <SidebarLink icon={<Bell />} label="Notifications" active={view === 'notifications'} onClick={() => { setView('notifications'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<MessageSquare />} label="Community Chat" active={view === 'chat'} onClick={() => { setView('chat'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<Brain />} label="AI Mentor" active={view === 'mentor'} onClick={() => { setView('mentor'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<ImageIcon />} label="My Studio" active={view === 'studio'} onClick={() => { setView('studio'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<SettingsIcon />} label="Settings" active={view === 'settings'} onClick={() => { setView('settings'); setIsMenuOpen(false); }} />

          {/* RBAC: Admin Link */}
          {isAdmin && (
            <>
              <p className="px-4 text-[9px] font-black text-[#FFD700] uppercase tracking-widest mb-3 mt-8">System Admin</p>
              <SidebarLink 
                icon={<ShieldAlert />} 
                label="Guardian Logs" 
                active={view === 'admin'} 
                onClick={() => { setView('admin'); setIsMenuOpen(false); }} 
                color="text-[#FFD700]" 
              />
            </>
          )}
        </nav>

        <div className="p-8 border-t dark:border-gray-800">
          <button
            onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
            className={`w-full mb-6 flex items-center justify-center gap-2 py-3 rounded-xl border transition-all text-[9px] font-black uppercase tracking-widest ${isDarkMode ? 'bg-white/5 border-gray-800 hover:bg-white/10' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}
          >
            <Globe size={14} /> {lang === 'en' ? 'English' : 'አማርኛ'}
          </button>

          {user ? (
            <div className="flex items-center gap-4 mb-8 p-3 rounded-2xl bg-[#FFD700]/5 border border-[#FFD700]/20">
              <div className="w-11 h-11 rounded-xl bg-[#FFD700] flex items-center justify-center text-black font-black">
                {user.email.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-[10px] font-black uppercase truncate">{user.email.split('@')[0]}</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#FFD700] animate-pulse"></span>
                  <p className="text-[8px] text-[#FFD700] font-black uppercase">{user.role}</p>
                </div>
              </div>
            </div>
          ) : (
            <button 
              onClick={() => setShowAuthModal(true)} 
              className="w-full mb-8 py-4 rounded-2xl bg-[#FFD700] text-black font-black text-[10px] uppercase tracking-[0.2em] shadow-[0_10px_20px_rgba(255,215,0,0.2)] hover:scale-[1.03] active:scale-95 transition-all"
            >
              Sign In
            </button>
          )}

          <div className="flex items-center justify-between">
            <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl bg-gray-100 dark:bg-white/5 transition-all hover:text-[#FFD700]">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {user && (
              <button 
                onClick={handleLogout} 
                className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 text-red-500 font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
              >
                <LogOut size={16} /> Exit
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* --- MAIN STAGE --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between p-5 border-b dark:border-gray-800 bg-transparent">
          <button onClick={toggleMenu} className="p-2 rounded-xl bg-gray-100 dark:bg-white/5"><Menu size={20} /></button>
          <div className="flex items-center gap-2">
            <Sparkles className="text-[#FFD700]" size={18} />
            <span className="font-black uppercase tracking-tighter text-sm">Wing</span>
          </div>
          <div className="w-10"></div>
        </header>

        <main className="flex-1 overflow-y-auto relative no-scrollbar">
          <div className="container mx-auto p-4 lg:p-8">
            <ErrorBoundary key={view}>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* --- PERSISTENT OVERLAYS --- */}
      {selectedPost && (
        <PostDetailView
          post={selectedPost}
          user={user}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedPost(null)}
        />
      )}

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
    </div>
  );
}

// --- HELPER COMPONENTS ---

function SidebarLink({ icon, label, active, onClick, color }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 group ${active
          ? 'bg-[#FFD700] text-black shadow-[0_10px_20px_rgba(255,215,0,0.15)] translate-x-2'
          : `text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 ${color || ''}`
        }`}
    >
      <div className="flex items-center gap-4">
        {React.cloneElement(icon, { size: 18, strokeWidth: active ? 3 : 2 })}
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${active ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'}`}>
          {label}
        </span>
      </div>
      {active && <ChevronRight size={14} className="opacity-40" />}
    </button>
  );
}

function AccessDenied() {
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center p-12">
      <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6">
        <ShieldAlert className="w-10 h-10 text-red-500" />
      </div>
      <h3 className="text-xl font-black uppercase tracking-widest text-red-500">Security Restriction</h3>
      <p className="text-[10px] text-gray-500 mt-4 uppercase font-bold tracking-widest max-w-xs">
        Your artisan level does not grant access to this sector. Please contact Wing Administration.
      </p>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="h-[70vh] flex flex-col items-center justify-center text-center p-12">
      <Sparkles className="w-16 h-16 text-[#FFD700] mb-6 animate-pulse" />
      <h3 className="text-2xl font-black uppercase tracking-widest mb-2 text-[#FFD700]">{title}</h3>
      <p className="text-[10px] text-gray-500 uppercase font-bold tracking-[0.3em]">Sector Under Construction</p>
    </div>
  );
}