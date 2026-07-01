import React, { useState } from 'react';
import SocialFeed from './components/SocialFeed';
import PostDetailView from './components/PostDetailView';
import SellerDashboard from './components/SellerDashboard';
import AdminDashboard from './components/AdminDashboard';
import { Post } from './types';

// MOCK DATA: To test the system immediately
const MOCK_USER = { uid: 'user_123', role: 'seller' }; 

export default function WingApp() {
  // 1. Navigation State: 'feed' | 'seller' | 'admin'
  const [view, setView] = useState<'feed' | 'seller' | 'admin'>('feed');
  
  // 2. Interaction State
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isDarkMode, setIsDarkMode] = useState(true);
  
  // 3. Search State
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className={`min-h-screen transition-colors duration-500 ${isDarkMode ? 'bg-[#0A0A0A] text-white' : 'bg-[#FAF9F6] text-black'}`}>
      
      {/* --- WING NAVIGATION BAR --- */}
      <nav className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[4000] px-6 py-4 rounded-full border shadow-2xl backdrop-blur-xl flex items-center gap-8 ${isDarkMode ? 'bg-black/50 border-gray-800' : 'bg-white/80 border-gray-200'}`}>
        <button 
          onClick={() => setView('feed')}
          className={`text-[10px] font-black uppercase tracking-widest ${view === 'feed' ? 'text-[#E07A5F]' : 'text-gray-500'}`}
        >
          Explore
        </button>
        <button 
          onClick={() => setView('seller')}
          className={`text-[10px] font-black uppercase tracking-widest ${view === 'seller' ? 'text-[#E07A5F]' : 'text-gray-500'}`}
        >
          My Shop
        </button>
        <button 
          onClick={() => setView('admin')}
          className={`text-[10px] font-black uppercase tracking-widest ${view === 'admin' ? 'text-[#E07A5F]' : 'text-gray-500'}`}
        >
          Wing Admin
        </button>
        <div className="w-[1px] h-4 bg-gray-700" />
        <button onClick={() => setIsDarkMode(!isDarkMode)} className="text-lg">
          {isDarkMode ? '🌙' : '☀️'}
        </button>
      </nav>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="pb-24">
        {view === 'feed' && (
          <SocialFeed 
            user={MOCK_USER}
            profile={null}
            onOpenAuth={() => alert("Open Auth")}
            onSelectPost={(post) => setSelectedPost(post)} // This opens the Detail View
            isDarkMode={isDarkMode}
            activeSearchQuery={searchQuery}
            setActiveSearchQuery={setSearchQuery}
            lang="en"
          />
        )}

        {view === 'seller' && (
          <SellerDashboard 
            sellerPosts={[]} // In real app: filteredPosts.filter(p => p.user_id === user.uid)
            isDarkMode={isDarkMode}
          />
        )}

        {view === 'admin' && (
          <AdminDashboard 
            allPosts={[]} // In real app: fetch from DB
            isDarkMode={isDarkMode}
          />
        )}
      </main>

      {/* --- OVERLAYS --- */}
      {selectedPost && (
        <PostDetailView 
          post={selectedPost}
          user={MOCK_USER}
          isDarkMode={isDarkMode}
          onClose={() => setSelectedPost(null)}
        />
      )}
    </div>
  );
}