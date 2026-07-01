import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from './types';
// WING: Firebase Imports
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signInAnonymously, signOut } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';

// Component Imports
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
import SellerDashboard from './components/SellerDashboard';
import AdminDashboard from './components/AdminDashboard';

// Icons for Navigation
import { Compass, LayoutDashboard, ShieldAlert, Moon, Sun, LogOut, User } from 'lucide-react';

export default function WingApp() {
  // --- AUTH & PROFILE STATE ---
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // --- UI NAVIGATION STATE ---
  const [view, setView] = useState<'feed' | 'seller' | 'admin'>('feed');
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. WING: Listen for Auth Changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. WING: Real-time Profile Listener (to get Trust Score & Commission Rate)
  useEffect(() => {
    if (!user?.uid) return;

    const profileRef = doc(db, "profiles", user.uid);
    const unsubscribe = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. ACTIONS
  const handleSignOut = () => {
    if (window.confirm("Sign out of Wing?")) {
      signOut(auth);
      setView('feed');
    }
  };

  // Simple Admin Check (You can replace this with your specific email)
  const isAdmin = user?.email === 'admin@wing.com' || profile?.is_admin;

  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';

  if (loading) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <div className="w-12 h-12 border-4 border-t-[#E07A5F] border-gray-800 rounded-full animate-spin mb-4"></div>
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-gray-500">Initializing Wing...</p>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>
      
      {/* --- 1. WING DYNAMIC NAVIGATION BAR --- */}
      <nav className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[4000] px-8 py-5 rounded-full border shadow-2xl backdrop-blur-2xl flex items-center gap-10 transition-all ${isDarkMode ? 'bg-black/60 border-gray-800' : 'bg-white/90 border-gray-200'}`}>
        
        {/* Explore Button */}
        <button 
          onClick={() => setView('feed')}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${view === 'feed' ? activeColor : 'text-gray-500 hover:text-gray-400'}`}
        >
          <Compass className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">Explore</span>
        </button>

        {/* My Shop Button (Only if user exists) */}
        <button 
          onClick={() => user ? setView('seller') : alert("Please sign in to view your shop")}
          className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${view === 'seller' ? activeColor : 'text-gray-500 hover:text-gray-400'}`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[8px] font-black uppercase tracking-widest">My Office</span>
        </button>

        {/* Admin Dashboard (Only if Admin) */}
        {isAdmin && (
          <button 
            onClick={() => setView('admin')}
            className={`flex flex-col items-center gap-1.5 transition-all active:scale-90 ${view === 'admin' ? activeColor : 'text-gray-500 hover:text-gray-400'}`}
          >
            <ShieldAlert className="w-5 h-5" />
            <span className="text-[8px] font-black uppercase tracking-widest">Admin</span>
          </button>
        )}

        {/* Divider */}
        <div className="w-[1px] h-6 bg-gray-300 dark:bg-gray-800" />

        {/* Theme Toggle & Auth */}
        <div className="flex items-center gap-6">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="hover:scale-110 transition-transform">
            {isDarkMode ? <Sun className="w-5 h-5 text-yellow-500" /> : <Moon className="w-5 h-5 text-blue-500" />}
          </button>

          {user ? (
            <button onClick={handleSignOut} className="text-gray-500 hover:text-red-500 transition-colors">
              <LogOut className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => alert("Open Sign In Form")} className="text-gray-500 hover:text-green-500 transition-colors">
              <User className="w-5 h-5" />
            </button>
          )}
        </div>
      </nav>

      {/* --- 2. MAIN VIEW CONTROLLER --- */}
      <main className="pb-32 min-h-screen">
        {view === 'feed' && (
          <SocialFeed 
            user={user}
            profile={profile}
            onOpenAuth={() => alert("Please Sign In")} // In real app, open a login modal
            onSelectPost={(post) => setSelectedPost(post)}
            isDarkMode={isDarkMode}
            activeSearchQuery={searchQuery}
            setActiveSearchQuery={setSearchQuery}
          />
        )}

        {view === 'seller' && user && (
          <SellerDashboard 
            user={user}
            isDarkMode={isDarkMode}
          />
        )}

        {view === 'admin' && isAdmin && (
          <AdminDashboard 
            isDarkMode={isDarkMode}
          />
        )}
      </main>

      {/* --- 3. GLOBAL OVERLAYS --- */}
      
      {/* Post Detail View Modal */}
      {selectedPost && (
        <PostDetailView 
          post={selectedPost}
          user={user}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedPost(null)}
        />
      )}

      {/* Header for branding (Optional) */}
      <div className={`fixed top-0 left-0 w-full p-6 px-10 pointer-events-none flex justify-between items-center z-[3000]`}>
         <h1 className={`text-2xl font-black uppercase tracking-tighter pointer-events-auto cursor-pointer ${isDarkMode ? 'text-white' : 'text-black'}`} onClick={() => setView('feed')}>
           Wing <span className={activeColor}>Market</span>
         </h1>
         {user && (
           <div className="flex items-center gap-3 bg-black/10 dark:bg-white/5 backdrop-blur-md px-4 py-2 rounded-full border dark:border-gray-800 pointer-events-auto">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Connected as Artisan</span>
           </div>
         )}
      </div>

    </div>
  );
}