import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { auth, onAuthStateChanged, signOut, db } from './lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { getProfile, seedDatabaseIfEmpty, getOrCreateDirectMessageRoom } from './lib/services';
import { UserProfile, Post } from './types';
import { Language } from './lib/translations';

// Components
import Sidebar from './components/Sidebar';
import SocialFeed from './components/SocialFeed';
import PinDetailModal from './components/PinDetailModal';
import MakerStudio from './components/MakerStudio';
import AIMentor from './components/AIMentor';
import CommunityChat from './components/CommunityChat';
import Settings from './components/Settings';
import AuthModal from './components/AuthModal';
import Notifications from './components/Notifications';

import { ShieldAlert, Info } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem('wing_lang');
    return (saved === 'am' || saved === 'en') ? saved : 'en';
  });
  
  // Modals / Focus states
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  
  // Realtime DMs focused room
  const [focusedRoomId, setFocusedRoomId] = useState<string | null>(null);
  const [focusedRoomName, setFocusedRoomName] = useState<string | null>(null);

  const handleSetLang = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('wing_lang', newLang);
  };

  // 1. Initial Seeding of Sample Data when App boots
  useEffect(() => {
    seedDatabaseIfEmpty();
  }, []);

  // 2. Auth State Changed Observer
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }
      if (currentUser) {
        // Listen to the profile in real-time to solve race condition!
        profileUnsub = onSnapshot(doc(db, 'profiles', currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const userProfile = docSnap.data() as UserProfile;
            setProfile(userProfile);
            if (userProfile.theme_preference) {
              setIsDarkMode(userProfile.theme_preference === 'dark');
            }
          } else {
            setProfile(null);
          }
        }, (err) => {
          console.error("Error listening to profile", err);
        });
      } else {
        setProfile(null);
      }
    });
    return () => {
      unsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  // 3. Sync profile if updated elsewhere
  const handleReloadProfile = async () => {
    if (user) {
      const p = await getProfile(user.uid);
      setProfile(p);
    }
  };

  // 4. Log out handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setProfile(null);
      setActiveTab('home');
    } catch (err) {
      console.error(err);
    }
  };

  // 5. DM Trigger from Post Detail Modal
  const handleMessageMaker = async (makerId: string, makerName: string) => {
    if (!user) {
      setIsAuthOpen(true);
      return;
    }
    try {
      const myName = profile?.full_name || user.displayName || 'Artisan';
      const roomId = await getOrCreateDirectMessageRoom(user.uid, makerId, myName, makerName);
      
      setFocusedRoomId(roomId);
      setFocusedRoomName(makerName);
      setSelectedPost(null); // Close post modal
      setActiveTab('messages'); // Swap tab to private messages
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectPostFromSettings = (post: Post) => {
    setSelectedPost(post);
  };

  const activeBg = isDarkMode 
    ? 'bg-[#121212] text-[#EAEAEA]' 
    : 'bg-[#FDFBF7] text-[#2C2C2C]';

  return (
    <div className={`min-h-screen flex flex-col md:flex-row transition-colors duration-300 ${activeBg}`}>
      
      {/* Floating Language Toggler */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-1.5 bg-white/90 dark:bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full border shadow-sm border-gray-200 dark:border-gray-800">
        <button
          id="lang-toggle-en"
          onClick={() => handleSetLang('en')}
          className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer transition-all ${
            lang === 'en' 
              ? 'bg-[#E07A5F] dark:bg-[#D4AF37] text-white dark:text-black shadow-sm' 
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          EN
        </button>
        <button
          id="lang-toggle-am"
          onClick={() => handleSetLang('am')}
          className={`text-[10px] font-bold px-2 py-1 rounded-full cursor-pointer transition-all ${
            lang === 'am' 
              ? 'bg-[#E07A5F] dark:bg-[#D4AF37] text-white dark:text-black shadow-sm' 
              : 'text-gray-400 dark:text-gray-500'
          }`}
        >
          አማ
        </button>
      </div>

      {/* Sidebar (Desktop and Mobile combined) */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        profile={profile}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        isDarkMode={isDarkMode}
        lang={lang}
      />

      {/* Main Panel Content */}
      <main className="flex-1 flex flex-col min-h-0 min-w-0">
        {activeTab === 'home' && (
          <SocialFeed
            mode="feed"
            user={user}
            profile={profile}
            onOpenAuth={() => setIsAuthOpen(true)}
            onSelectPost={setSelectedPost}
            isDarkMode={isDarkMode}
            activeSearchQuery={activeSearchQuery}
            setActiveSearchQuery={setActiveSearchQuery}
            lang={lang}
          />
        )}

        {activeTab === 'explore' && (
          <Notifications
            user={user}
            isDarkMode={isDarkMode}
            lang={lang}
            onOpenAuth={() => setIsAuthOpen(true)}
            onSelectPost={setSelectedPost}
            posts={[]} // Pass empty or populated posts
          />
        )}

        {activeTab === 'messages' && (
          <CommunityChat
            user={user}
            profile={profile}
            onOpenAuth={() => setIsAuthOpen(true)}
            isDarkMode={isDarkMode}
            focusedRoomId={focusedRoomId}
            focusedRoomName={focusedRoomName}
            clearFocusedRoom={() => { setFocusedRoomId(null); setFocusedRoomName(null); }}
            lang={lang}
          />
        )}

        {activeTab === 'mentor' && (
          <AIMentor isDarkMode={isDarkMode} lang={lang} />
        )}

        {activeTab === 'studio' && profile?.is_maker && (
          <MakerStudio
            user={user}
            profile={profile}
            isDarkMode={isDarkMode}
            onPostShared={() => setActiveTab('home')}
            lang={lang}
          />
        )}

        {activeTab === 'settings' && (
          <Settings
            user={user}
            profile={profile}
            onProfileUpdated={handleReloadProfile}
            isDarkMode={isDarkMode}
            setIsDarkMode={setIsDarkMode}
            onSelectPost={handleSelectPostFromSettings}
            lang={lang}
          />
        )}
      </main>

      {/* Pin Detail Overlay / Modal */}
      {selectedPost && (
        <PinDetailModal
          post={selectedPost}
          onClose={() => setSelectedPost(null)}
          user={user}
          profile={profile}
          onOpenAuth={() => setIsAuthOpen(true)}
          isDarkMode={isDarkMode}
          onMessageMaker={handleMessageMaker}
          lang={lang}
        />
      )}

      {/* Account Authentication Overlay / Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        isDarkMode={isDarkMode}
      />
      
    </div>
  );
}
