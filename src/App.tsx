import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from './types';
// WING: Firebase Imports
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// NEW MARKETPLACE COMPONENTS
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
import SellerDashboard from './components/SellerDashboard';
import AdminDashboard from './components/AdminDashboard';

// YOUR EXISTING COMPONENTS (Ensure paths are correct)
import ChatRoom from './components/ChatRoom'; 
import Notifications from './components/Notifications';

import { 
  Compass, LayoutDashboard, ShieldAlert, Moon, Sun, LogOut, 
  Bell, MessageSquare, Brain, User, Settings, Image as ImageIcon,
  ChevronRight
} from 'lucide-react';

export default function WingApp() {
  // --- AUTH & PROFILE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  // --- NAVIGATION (This controls the whole app) ---
  const [view, setView] = useState<string>('feed'); 
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  // 1. LISTEN FOR USER & PROFILE
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        onSnapshot(doc(db, "profiles", firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) setProfile(docSnap.data() as UserProfile);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  const isAdmin = profile?.is_admin || user?.email === 'admin@wing.com';

  return (
    <div className={`flex h-screen overflow-hidden ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>
      
      {/* --- 1. THE SIDEBAR (Fixed on the left) --- */}
      <aside className={`w-72 border-r flex flex-col transition-all duration-500 ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
        <div className="p-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-[#E07A5F] rounded-lg rotate-12 flex items-center justify-center font-black text-white">W</div>
             <h1 className="text-2xl font-black uppercase tracking-tighter text-[#E07A5F]">Wing</h1>
          </div>
          <p className="text-[9px] font-black uppercase tracking-[0.3em] opacity-30 mt-2">Artisan Platform</p>
        </div>

        <nav className="flex-1 px-6 space-y-2 overflow-y-auto no-scrollbar">
          {/* CATEGORY: MARKETPLACE */}
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4 mt-6">Marketplace</p>
          <SidebarLink icon={<Compass />} label="Explore Feed" active={view === 'feed'} onClick={() => setView('feed')} />
          <SidebarLink icon={<LayoutDashboard />} label="Seller Office" active={view === 'seller'} onClick={() => setView('seller')} />
          
          {/* CATEGORY: SOCIAL & TOOLS (Your existing features) */}
          <p className="px-4 text-[9px] font-black text-gray-500 uppercase tracking-widest mb-4 mt-10">Your Studio</p>
          <SidebarLink icon={<Bell />} label="Notifications" active={view === 'notifications'} onClick={() => setView('notifications')} />
          <SidebarLink icon={<MessageSquare />} label="Chat Rooms" active={view === 'chat'} onClick={() => setView('chat')} />
          <SidebarLink icon={<Brain />} label="AI Mentor" active={view === 'mentor'} onClick={() => setView('mentor')} />
          <SidebarLink icon={<ImageIcon />} label="My Projects" active={view === 'studio'} onClick={() => setView('studio')} />

          {/* ADMIN ONLY */}
          {isAdmin && (
             <>
               <p className="px-4 text-[9px] font-black text-[#D4AF37] uppercase tracking-widest mb-4 mt-10">Governance</p>
               <SidebarLink icon={<ShieldAlert />} label="Admin Panel" active={view === 'admin'} onClick={() => setView('admin')} color="text-[#D4AF37]" />
             </>
          )}
        </nav>

        {/* PROFILE FOOTER */}
        <div className="p-8 border-t dark:border-gray-800 bg-black/5">
           <div className="flex items-center gap-4 mb-8">
              <div className="relative">
                <img src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`} className="w-12 h-12 rounded-2xl border-2 border-[#E07A5F] object-cover" />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-4 border-[#0F0F0F]"></div>
              </div>
              <div className="truncate">
                <p className="text-xs font-black uppercase truncate dark:text-white">{profile?.full_name || 'Artisan'}</p>
                <p className="text-[9px] text-[#E07A5F] font-black uppercase">Score: {profile?.trust_score || 0}</p>
              </div>
           </div>
           
           <div className="flex items-center justify-between">
             <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-3 rounded-2xl bg-gray-100 dark:bg-white/5 hover:scale-110 transition-all">
                {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-500" />}
             </button>
             <button onClick={() => signOut(auth)} className="flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/10 text-red-500 font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all">
                <LogOut className="w-4 h-4" /> Exit
             </button>
           </div>
        </div>
      </aside>

      {/* --- 2. THE CONTENT AREA (Swaps based on view) --- */}
      <main className="flex-1 overflow-y-auto relative bg-transparent">
        <div className="max-w-[1600px] mx-auto">
          {view === 'feed' && (
            <SocialFeed 
              user={user} 
              profile={profile} 
              onSelectPost={setSelectedPost} 
              isDarkMode={isDarkMode} 
              activeSearchQuery="" 
              setActiveSearchQuery={() => {}} 
              onOpenAuth={() => {}} 
            />
          )}
          
          {view === 'seller' && <SellerDashboard user={user} isDarkMode={isDarkMode} />}
          
          {view === 'admin' && <AdminDashboard isDarkMode={isDarkMode} />}

          {/* YOUR EXISTING FEATURES CONNECTED HERE */}
          {view === 'notifications' && <Notifications user={user} isDarkMode={isDarkMode} />}
          {view === 'chat' && <ChatRoom user={user} isDarkMode={isDarkMode} />}
          
          {/* Placeholders for AI Mentor/Studio if you haven't finished them */}
          {view === 'mentor' && <div className="p-20 text-center uppercase font-black opacity-10 text-4xl">AI Mentor Interface</div>}
          {view === 'studio' && <div className="p-20 text-center uppercase font-black opacity-10 text-4xl">My Studio Projects</div>}
        </div>
      </main>

      {/* --- 3. MODALS (Post Detail View) --- */}
      {selectedPost && (
        <PostDetailView 
          post={selectedPost} 
          user={user} 
          isDarkMode={isDarkMode} 
          onClose={() => setSelectedPost(null)} 
        />
      )}
    </div>
  );
}

// Sidebar Button Component
function SidebarLink({ icon, label, active, onClick, color }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between px-5 py-4 rounded-[1.5rem] transition-all duration-300 group ${
        active 
        ? 'bg-[#E07A5F] text-white shadow-xl translate-x-2' 
        : `text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 ${color || ''}`
      }`}
    >
      <div className="flex items-center gap-4">
        {React.cloneElement(icon, { size: 20, strokeWidth: active ? 3 : 2 })}
        <span className={`text-[10px] font-black uppercase tracking-[0.2em] ${active ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'}`}>
          {label}
        </span>
      </div>
      {active && <ChevronRight className="w-4 h-4 opacity-50" />}
    </button>
  );
}