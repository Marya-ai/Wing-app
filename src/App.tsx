import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from './types';
// WING: Firebase & Global Logic
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// --- COMPONENT IMPORTS (Matching your exact filenames from screenshot) ---
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
import SellerDashboard from './components/SellerDashboard';
import AdminDashboard from './components/AdminDashboard';
import CommunityChat from './components/CommunityChat'; // Fixed name
import Notifications from './components/Notifications';
import AIMentor from './components/AIMentor'; // Fixed name
import MakerStudio from './components/MakerStudio'; // Fixed name
import AuthModal from './components/AuthModal';

import { 
  Compass, LayoutDashboard, ShieldAlert, Moon, Sun, LogOut, 
  Bell, MessageSquare, Brain, User, Settings, Image as ImageIcon,
  ChevronRight, Sparkles
} from 'lucide-react';

export default function WingApp() {
  // --- AUTH & PROFILE STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- NAVIGATION STATE ---
  const [view, setView] = useState<string>('feed'); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // 1. LISTEN FOR AUTH & PROFILE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Real-time listener for the user's profile
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

  if (loading) {
    return (
      <div className={`h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-[#E07A5F]"></div>
      </div>
    );
  }

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>
      
      {/* --- 1. THE SIDEBAR --- */}
      <aside className={`w-72 border-r flex flex-col transition-all duration-300 ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
        <div className="p-10">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-[#E07A5F] rounded-2xl flex items-center justify-center font-black text-white shadow-lg">W</div>
             <h1 className="text-2xl font-black uppercase tracking-tighter text-[#E07A5F]">Wing</h1>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 mt-2">Artisan Platform</p>
        </div>

        <nav className="flex-1 px-6 space-y-1.5 overflow-y-auto no-scrollbar">
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 mt-6">Marketplace</p>
          <SidebarLink icon={<Compass />} label="Explore Feed" active={view === 'feed'} onClick={() => setView('feed')} />
          <SidebarLink icon={<LayoutDashboard />} label="Seller Office" active={view === 'seller'} onClick={() => setView('seller')} />
          
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-3 mt-8">Studio Tools</p>
          <SidebarLink icon={<Bell />} label="Notifications" active={view === 'notifications'} onClick={() => setView('notifications')} />
          <SidebarLink icon={<MessageSquare />} label="Community Chat" active={view === 'chat'} onClick={() => setView('chat')} />
          <SidebarLink icon={<Brain />} label="AI Mentor" active={view === 'mentor'} onClick={() => setView('mentor')} />
          <SidebarLink icon={<ImageIcon />} label="My Studio" active={view === 'studio'} onClick={() => setView('studio')} />

          {isAdmin && (
             <>
               <p className="px-4 text-[9px] font-black text-[#D4AF37] uppercase tracking-widest mb-3 mt-8">Admin Control</p>
               <SidebarLink icon={<ShieldAlert />} label="Revenue & Fraud" active={view === 'admin'} onClick={() => setView('admin')} color="text-[#D4AF37]" />
             </>
          )}
        </nav>

        {/* PROFILE FOOTER */}
        <div className="p-8 border-t dark:border-gray-800">
           {user ? (
             <div className="flex items-center gap-4 mb-8 p-3 rounded-2xl bg-black/5 dark:bg-white/5">
                <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`} className="w-12 h-12 rounded-xl object-cover shadow-lg" alt="" />
                <div className="truncate">
                  <p className="text-[10px] font-black uppercase truncate">{profile?.full_name || 'Artisan'}</p>
                  <p className="text-[9px] text-[#E07A5F] font-black uppercase">Trust: {profile?.trust_score || 0}</p>
                </div>
             </div>
           ) : (
             <button onClick={() => setShowAuthModal(true)} className="w-full mb-8 py-3 rounded-xl bg-[#E07A5F] text-white font-black text-[10px] uppercase tracking-widest">Sign In</button>
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

      {/* --- 2. THE MAIN CONTENT AREA --- */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="container mx-auto">
          {view === 'feed' && (
            <SocialFeed 
              user={user} 
              profile={profile} 
              onSelectPost={setSelectedPost} 
              isDarkMode={isDarkMode} 
              activeSearchQuery="" 
              setActiveSearchQuery={() => {}} 
              onOpenAuth={() => setShowAuthModal(true)} 
            />
          )}
          
          {view === 'seller' && (
            user ? <SellerDashboard user={user} isDarkMode={isDarkMode} /> : <div className="p-20 text-center uppercase font-black opacity-20">Please Sign In</div>
          )}
          
          {view === 'admin' && (
            isAdmin ? <AdminDashboard isDarkMode={isDarkMode} /> : <div className="p-20 text-center uppercase font-black opacity-20">Restricted</div>
          )}

          {/* INTEGRATING YOUR EXISTING COMPONENTS */}
          {view === 'notifications' && <Notifications user={user} isDarkMode={isDarkMode} />}
          {view === 'chat' && <CommunityChat user={user} isDarkMode={isDarkMode} />}
          {view === 'mentor' && <AIMentor user={user} isDarkMode={isDarkMode} />}
          {view === 'studio' && <MakerStudio user={user} isDarkMode={isDarkMode} />}
        </div>
      </main>

      {/* --- 3. GLOBAL MODALS --- */}
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

// Sidebar Button Helper Component
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