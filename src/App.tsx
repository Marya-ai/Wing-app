import React, { useState, useEffect, ErrorInfo, ReactNode } from 'react';
import { Post, UserProfile } from './types';
// WING: Firebase & Global Logic
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// --- COMPONENT IMPORTS ---
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
import AuthModal from './components/AuthModal';
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

// --- ERROR BOUNDARY TO PREVENT WHITE SCREENS ---
class ErrorBoundary extends React.Component<{children: ReactNode}, {hasError: boolean}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true };
  }
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Component crashed:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="h-[60vh] flex flex-col items-center justify-center text-center p-8 text-red-500">
          <AlertTriangle size={48} className="mb-4" />
          <h3 className="text-xl font-black uppercase">Component Error</h3>
          <p className="text-xs mt-2 opacity-70">Check console for details.</p>
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
  const [view, setView] = useState<string>('feed'); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lang, setLang] = useState<'en' | 'am'>('en'); 
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');

  // 1. LISTEN FOR AUTH & PROFILE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        onSnapshot(doc(db, "profiles", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          }
          setLoading(false);
        });
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.is_admin || user?.email === 'admin@wing.com';
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E07A5F]"></div>
      </div>
    );
  }

  // Safe rendering function with Error Boundary
  const renderContent = () => {
    const commonProps = { user, isDarkMode };
    
    switch(view) {
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
        return user ? <SellerDashboard {...commonProps} profile={profile} /> : <AuthRequired onAuth={() => setShowAuthModal(true)} />;
      case 'admin':
        return isAdmin ? <AdminDashboard isDarkMode={isDarkMode} /> : <AccessDenied />;
      case 'notifications':
        return <Notifications {...commonProps} />;
      case 'chat':
        return <CommunityChat {...commonProps} />;
      case 'mentor':
        return <AIMentor {...commonProps} />;
      case 'studio':
        return <MakerStudio {...commonProps} />;
      case 'settings':
        return <Settings {...commonProps} profile={profile} />;
      default:
        return <ComingSoon title={view} />;
    }
  };

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>
      
      {/* --- SIDEBAR --- */}
      <aside className={`
        fixed inset-y-0 left-0 z-[5000] w-72 transform transition-transform duration-300 ease-in-out border-r flex flex-col
        ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:relative lg:translate-x-0
        ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}
      `}>
        
        <div className="p-10 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <img src="/wing-logo.png" alt="Wing Logo" className="w-10 h-10 object-contain drop-shadow-lg rotate-3 hover:rotate-0 transition-transform duration-500" />
             <div>
               <h1 className="text-2xl font-black uppercase tracking-tighter text-[#E07A5F]">Wing</h1>
               <p className="text-[8px] font-black uppercase tracking-[0.3em] opacity-30">Artisan Alliance</p>
             </div>
          </div>
          <button onClick={toggleMenu} className="lg:hidden p-2"><X size={20} /></button>
        </div>

        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 mt-6">Marketplace</p>
          <SidebarLink icon={<Compass />} label="Explore Feed" active={view === 'feed'} onClick={() => { setView('feed'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<LayoutDashboard />} label="Seller Office" active={view === 'seller'} onClick={() => { setView('seller'); setIsMenuOpen(false); }} />
          
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 mt-8">Studio Tools</p>
          <SidebarLink icon={<Bell />} label="Notifications" active={view === 'notifications'} onClick={() => { setView('notifications'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<MessageSquare />} label="Community Chat" active={view === 'chat'} onClick={() => { setView('chat'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<Brain />} label="AI Mentor" active={view === 'mentor'} onClick={() => { setView('mentor'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<ImageIcon />} label="My Studio" active={view === 'studio'} onClick={() => { setView('studio'); setIsMenuOpen(false); }} />
          <SidebarLink icon={<SettingsIcon />} label="Settings" active={view === 'settings'} onClick={() => { setView('settings'); setIsMenuOpen(false); }} />

          {isAdmin && (
             <>
               <p className="px-4 text-[9px] font-black text-[#D4AF37] uppercase tracking-widest mb-3 mt-8">Admin Control</p>
               <SidebarLink icon={<ShieldAlert />} label="Revenue & Fraud" active={view === 'admin'} onClick={() => { setView('admin'); setIsMenuOpen(false); }} color="text-[#D4AF37]" />
             </>
          )}
        </nav>

        <div className="p-8 border-t dark:border-gray-800">
           <button 
             onClick={() => setLang(lang === 'en' ? 'am' : 'en')}
             className={`w-full mb-6 flex items-center justify-center gap-2 py-2 rounded-xl border transition-all ${isDarkMode ? 'bg-white/5 border-gray-800 hover:bg-white/10' : 'bg-gray-100 border-gray-200 hover:bg-gray-200'}`}
           >
             <Globe size={12} /> {lang === 'en' ? 'English' : 'አማርኛ'}
           </button>

           {user ? (
             <div className="flex items-center gap-4 mb-8 p-3 rounded-2xl bg-black/5 dark:bg-white/5">
                <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`} className="w-12 h-12 rounded-xl object-cover shadow-lg" alt="" />
                <div className="truncate">
                  <p className="text-[10px] font-black uppercase truncate">{profile?.full_name || 'Artisan'}</p>
                  <p className="text-[9px] text-[#E07A5F] font-black uppercase">Trust: {profile?.trust_score || 0}</p>
                </div>
             </div>
           ) : (
             <button onClick={() => setShowAuthModal(true)} className="w-full mb-8 py-4 rounded-2xl bg-[#E07A5F] text-white font-black text-[10px] uppercase tracking-widest shadow-lg">Sign In</button>
           )}
           
           <div className="flex items-center justify-between">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl bg-gray-100 dark:bg-white/5 transition-all">
                {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
             </button>
             {user && (
               <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-red-500/10 text-red-500 font-black text-[9px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                  <LogOut size={16} /> Exit
               </button>
             )}
           </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="lg:hidden flex items-center justify-between p-5 border-b dark:border-gray-800 bg-transparent">
           <button onClick={toggleMenu} className="p-2 rounded-xl bg-gray-100 dark:bg-white/5"><Menu size={20} /></button>
           <div className="flex items-center gap-2">
              <img src="/wing-logo.png" className="w-8 h-8 object-contain" alt="Wing" />
              <span className="font-black uppercase tracking-tighter text-sm">Wing</span>
           </div>
           <div className="w-10"></div>
        </header>

        <main className="flex-1 overflow-y-auto relative">
          <div className="container mx-auto p-4">
            <ErrorBoundary>
              {renderContent()}
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* --- MODALS --- */}
      {selectedPost && (
        <PostDetailView 
          post={selectedPost} 
          user={user} 
          isDarkMode={isDarkMode} 
          onClose={() => setSelectedPost(null)} 
        />
      )}

      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} isDarkMode={isDarkMode} />
      )}
    </div>
  );
}

// --- HELPER COMPONENTS ---

function SidebarLink({ icon, label, active, onClick, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-2xl transition-all duration-300 group ${
        active 
        ? 'bg-[#E07A5F] text-white shadow-xl translate-x-2' 
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

function AuthRequired({ onAuth }: { onAuth: () => void }) {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center p-12">
      <User className="w-16 h-16 text-gray-400 mb-6 opacity-20" />
      <h3 className="text-xl font-black uppercase tracking-widest mb-4">Identity Required</h3>
      <p className="text-xs text-gray-500 max-w-xs mb-8 uppercase font-bold leading-relaxed">Please sign in to access this feature.</p>
      <button onClick={onAuth} className="px-10 py-4 bg-[#E07A5F] text-white rounded-full font-black text-xs uppercase tracking-widest shadow-xl">Sign In Now</button>
    </div>
  );
}

function AccessDenied() {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center p-12 opacity-50">
      <ShieldAlert className="w-16 h-16 mb-6" />
      <h3 className="text-xl font-black uppercase tracking-widest">Access Restricted</h3>
    </div>
  );
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="h-[60vh] flex flex-col items-center justify-center text-center p-12">
      <Sparkles className="w-16 h-16 text-[#E07A5F] mb-6 animate-pulse" />
      <h3 className="text-2xl font-black uppercase tracking-widest mb-2">{title}</h3>
      <p className="text-xs text-gray-500 uppercase font-bold tracking-widest">Coming Soon to Wing Platform</p>
    </div>
  );
}