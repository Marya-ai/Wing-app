import React, { useState, useEffect, useRef } from 'react';
import { Post, UserProfile } from '../types';
// WING: Firebase & Logic Imports
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { createWingPost } from '../lib/wingServices'; 

import { 
  Search, Plus, Heart, X, 
  Image as ImageIcon, Camera, Layers, Wrench, Package, Tag, AlertTriangle, Sparkles,
  Phone, Send, ShieldCheck, Info, CheckCircle2, ArrowRight
} from 'lucide-react';
import ReputationBadge from './ReputationBadge'; 

export const CRAFT_CATEGORIES = [
  { id: 'all', name: 'All Crafts', emoji: '✨' },
  { id: 'crochet-knitting', name: 'Crochet & Knitting', emoji: '🧶' },
  { id: 'textiles-fiber', name: 'Textiles & Fiber Arts', emoji: '🧵' },
  { id: 'woodwork', name: 'Woodwork', emoji: '🪵' },
  { id: 'ceramics-pottery', name: 'Ceramics & Pottery', emoji: '🏺' },
  { id: 'jewelry-accessories', name: 'Jewelry & Accessories', emoji: '💍' },
  { id: 'leatherwork', name: 'Leatherwork', emoji: '🪡' },
  { id: 'metalwork', name: 'Metalwork', emoji: '⚒️' },
  { id: 'painting-visual', name: 'Painting & Visual Arts', emoji: '🎨' },
  { id: 'home-decor-crafts', name: 'Home Décor', emoji: '🪑' },
  { id: 'basketry-natural', name: 'Basketry', emoji: '🧺' },
  { id: 'cultural-traditional', name: 'Traditional', emoji: '🪆' },
  { id: 'handmade-toys', name: 'Handmade Toys', emoji: '🧸' },
  { id: 'lifestyle-crafts', name: 'Lifestyle', emoji: '🕯️' }
];

interface SocialFeedProps {
  user: any;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  onSelectPost: (post: Post) => void;
  isDarkMode: boolean;
  activeSearchQuery: string;
  setActiveSearchQuery: (q: string) => void;
}

// Reusable Popup Component
const FormPopup = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-white dark:bg-[#0F0F0F] rounded-[2.5rem] w-full max-w-md shadow-2xl border dark:border-gray-800 overflow-hidden animate-in zoom-in duration-300">
        <div className="flex justify-between items-center p-6 border-b dark:border-gray-800">
          <h3 className="font-black text-[10px] uppercase tracking-[0.3em] dark:text-gray-400">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 dark:text-white" /></button>
        </div>
        <div className="p-8">{children}</div>
      </div>
    </div>
  );
};

export default function SocialFeed({ user, profile, onOpenAuth, onSelectPost, isDarkMode, activeSearchQuery, setActiveSearchQuery }: SocialFeedProps) {
  // --- APP STATE ---
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'finished' | 'wip'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'trending'>('newest');

  // --- MODAL STATES ---
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [popupType, setPopupType] = useState<'category' | 'process' | 'material' | 'tool' | null>(null);

  // --- REGISTRATION FORM STATE ---
  const [regPhone, setRegPhone] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regCommission, setRegCommission] = useState<number>(15); // Default 15%
  const [regAgreed, setRegAgreed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

  // --- POST FORM STATE ---
  const [processDescription, setProcessDescription] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newPostType, setNewPostType] = useState<'finished' | 'wip'>('finished');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newMaterialsList, setNewMaterialsList] = useState<string[]>([]);
  const [newToolsList, setNewToolsList] = useState<string[]>([]);
  const [price, setPrice] = useState<number | ''>(''); 
  const [formError, setFormError] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);
  const [tempInput, setTempInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white';
  const cardBg = isDarkMode ? 'bg-[#121212] border-[#1A1A1A]' : 'bg-white border-gray-100';

  // --- 1. FIREBASE REAL-TIME SYNC ---
  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. FILTERING & SEARCH LOGIC ---
  useEffect(() => {
    let result = [...posts];
    if (activeSearchQuery.trim()) {
      const q = activeSearchQuery.toLowerCase();
      result = result.filter(p => p.caption?.toLowerCase().includes(q) || p.author_name?.toLowerCase().includes(q));
    }
    if (filterType !== 'all') result = result.filter(p => p.post_type === filterType);
    if (selectedCategory !== 'all') result = result.filter(p => p.category === selectedCategory);
    if (sortBy === 'trending') result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    setFilteredPosts(result);
  }, [posts, filterType, selectedCategory, sortBy, activeSearchQuery]);

  // --- 3. HANDLE START POST (THE GATEKEEPER) ---
  const handleStartPost = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    // Logic: If profile doesn't have phone/telegram, they MUST register as artisan first
    if (!profile?.phone || !profile?.telegram_username || !profile?.has_agreed) {
      setIsRegisterModalOpen(true);
    } else {
      setIsCreateModalOpen(true);
    }
  };

  // --- 4. ARTISAN REGISTRATION ACTION ---
  const handleCompleteRegistration = async () => {
    if (!regPhone || !regTelegram || !regAgreed) {
      setFormError("Please complete all fields and agree to terms.");
      return;
    }
    setIsRegistering(true);
    try {
      await setDoc(doc(db, "profiles", user.uid), {
        phone: regPhone,
        telegram_username: regTelegram.replace('@', ''), // Clean username
        commission_rate: regCommission,
        has_agreed: true,
        trust_score: 10, // Starting points
        artisan_since: new Date().toISOString()
      }, { merge: true });

      setIsRegisterModalOpen(false);
      setIsCreateModalOpen(true); // Open the post form immediately after
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  };

  // --- 5. POST PUBLISHING ACTION ---
  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImgUrl || !newCategory) { setFormError("Missing Image or Category"); return; }
    if (newPostType === 'finished' && !price) { setFormError("Please set a price"); return; }

    setSubmittingPost(true);
    const postData = {
      user_id: user.uid,
      author_name: profile?.full_name || user.displayName,
      author_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
      image_url: newImgUrl,
      caption: processDescription,
      post_type: newPostType,
      category: newCategory,
      materials: newMaterialsList,
      tools: newToolsList,
      price: Number(price) || 0,
      wing_token: `WCT-ET-${Math.floor(100000 + Math.random() * 900000)}`,
      sales_status: 'available',
      trust_score: profile?.trust_score || 10,
      commission_rate: profile?.commission_rate || 15,
      created_at: new Date().toISOString(),
      likes_count: 0
    };

    try {
      const res = await createWingPost(postData);
      if (res.success) {
        setIsCreateModalOpen(false);
        setNewImgUrl(''); setProcessDescription('');
      }
    } catch (err) { console.error(err); } finally { setSubmittingPost(false); }
  };

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 overflow-y-auto">
      
      {/* HEADER SECTION */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 mb-12">
        <div className="relative w-full max-w-xl group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500 group-focus-within:text-[#E07A5F] transition-colors" />
          <input 
            type="text" 
            value={activeSearchQuery} 
            onChange={(e) => setActiveSearchQuery(e.target.value)}
            placeholder="Search Ethiopian Crafts..." 
            className={`w-full pl-16 pr-6 py-5 rounded-[2rem] border outline-none transition-all text-sm font-bold ${isDarkMode ? 'bg-[#111] border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-white border-gray-100 text-black shadow-sm focus:border-[#E07A5F]'}`} 
          />
        </div>
        <button onClick={handleStartPost} className={`px-12 py-5 rounded-full font-black text-xs shadow-2xl active:scale-95 transition-all ${activeBg}`}>
          <Plus className="w-5 h-5 inline mr-2" /> POST YOUR WORK
        </button>
      </div>

      {/* CATEGORIES */}
      <div className="max-w-6xl mx-auto mb-12 flex gap-4 overflow-x-auto no-scrollbar pb-4">
        {CRAFT_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-6 py-3 rounded-full border font-black text-[10px] whitespace-nowrap transition-all ${selectedCategory === cat.id ? activeBg : 'bg-white dark:bg-white/5 dark:border-gray-800 text-gray-500'}`}>
            {cat.emoji} {cat.name.toUpperCase()}
          </button>
        ))}
      </div>

      {/* FEED GRID */}
      {loading ? (
        <div className="py-40 text-center animate-pulse text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Loading Marketplace...</div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-8 space-y-8">
          {filteredPosts.map((post) => {
            const isFraud = (post.trust_score || 0) < 0;
            return (
              <div key={post.id} onClick={() => !isFraud && onSelectPost(post)} className={`break-inside-avoid relative rounded-[2.5rem] overflow-hidden border transition-all duration-500 ${cardBg} ${isFraud ? 'opacity-40 grayscale' : 'cursor-pointer group hover:shadow-2xl hover:-translate-y-2'}`}>
                <div className="relative aspect-square overflow-hidden">
                  <img src={post.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[11px] font-black px-4 py-1.5 rounded-full">
                    {post.price?.toLocaleString()} ETB
                  </div>
                  <div className="absolute bottom-4 left-4">
                    <ReputationBadge score={post.trust_score || 0} isBanned={isFraud} size="sm" />
                  </div>
                </div>
                <div className="p-6">
                  <p className="text-[11px] font-bold line-clamp-2 dark:text-gray-300 leading-relaxed">{post.caption}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 1. ARTISAN REGISTRATION MODAL */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`w-full max-w-lg rounded-[3.5rem] p-12 border shadow-2xl relative ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-100'}`}>
            <button onClick={() => setIsRegisterModalOpen(false)} className="absolute top-8 right-8 text-gray-500 hover:text-white"><X className="w-8 h-8" /></button>
            
            <div className="text-center mb-10">
              <ShieldCheck className="w-16 h-16 text-[#E07A5F] mx-auto mb-4" />
              <h2 className={`text-2xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>Artisan Verification</h2>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-2">Complete your profile to start selling</p>
            </div>

            <div className="space-y-6">
              <div className={`flex items-center gap-4 p-5 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Phone className="w-5 h-5 text-gray-400" />
                <input type="text" placeholder="Telebirr Number (09...)" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="bg-transparent outline-none text-xs font-bold dark:text-white flex-1" />
              </div>

              <div className={`flex items-center gap-4 p-5 rounded-3xl border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Send className="w-5 h-5 text-[#229ED9]" />
                <input type="text" placeholder="Telegram Username (@...)" value={regTelegram} onChange={e => setRegTelegram(e.target.value)} className="bg-transparent outline-none text-xs font-bold dark:text-white flex-1" />
              </div>

              {/* COMMISSION CHOICE */}
              <div className="p-6 rounded-[2rem] bg-gray-100 dark:bg-white/5 border dark:border-gray-800">
                <div className="flex justify-between items-center mb-4">
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wing Commission Rate</label>
                   <span className={`text-lg font-black ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]'}`}>{regCommission}%</span>
                </div>
                <input 
                  type="range" min="10" max="25" step="1" 
                  value={regCommission} onChange={e => setRegCommission(parseInt(e.target.value))}
                  className="w-full accent-[#E07A5F] cursor-pointer" 
                />
                <div className="flex justify-between mt-2 text-[9px] font-black text-gray-500 uppercase tracking-tighter">
                  <span>Standard (10%)</span>
                  <span>Premium Visibility (25%)</span>
                </div>
                <p className="text-[9px] text-gray-400 italic mt-4 leading-relaxed flex items-start gap-2">
                  <Info className="w-3 h-3 shrink-0" /> Higher rates give your crafts better ranking and the "Featured Artisan" spotlight.
                </p>
              </div>

              {/* AGREEMENT */}
              <div className="flex gap-4 p-4 items-start">
                 <input type="checkbox" checked={regAgreed} onChange={e => setRegAgreed(e.target.checked)} className="mt-1 w-5 h-5 accent-[#E07A5F]" />
                 <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                   I agree to Wing's Marketplace Terms. I understand Wing takes a <span className="text-[#E07A5F]">{regCommission}%</span> commission on sales. Fraudulent reports will result in a permanent ban.
                 </p>
              </div>

              <button 
                onClick={handleCompleteRegistration} disabled={isRegistering}
                className={`w-full py-6 rounded-[2rem] font-black text-xs uppercase tracking-[0.4em] shadow-2xl active:scale-[0.98] transition-all ${activeBg} disabled:opacity-50`}
              >
                {isRegistering ? 'VERIFYING...' : 'FINISH & START SELLING'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. CREATE CRAFT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`relative w-full max-w-xl rounded-[3.5rem] p-12 border shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-[#FAF9F6] border-gray-100'}`}>
            <div className="flex justify-between items-center mb-10">
              <h3 className={`text-sm font-black tracking-[0.5em] uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>Post a Craft</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-3"><X className="w-8 h-8 text-gray-500" /></button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-8">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setNewPostType('finished')} className={`py-5 rounded-[1.5rem] border text-[10px] font-black uppercase ${newPostType === 'finished' ? activeBg : 'border-gray-800 text-gray-500'}`}>✨ For Sale</button>
                <button type="button" onClick={() => setNewPostType('wip')} className={`py-5 rounded-[1.5rem] border text-[10px] font-black uppercase ${newPostType === 'wip' ? activeBg : 'border-gray-800 text-gray-500'}`}>🛠️ Process</button>
              </div>

              {/* Category & Image Area */}
              <div className="grid grid-cols-2 gap-6">
                <div onClick={() => setPopupType('category')} className={`h-40 rounded-[2rem] border-2 border-dashed border-gray-800 flex flex-col items-center justify-center cursor-pointer transition-all ${newCategory ? 'bg-green-500/10 border-green-500' : 'hover:bg-white/5'}`}>
                   {newCategory ? <CheckCircle2 className="w-10 h-10 text-green-500" /> : <Layers className="w-10 h-10 text-gray-700" />}
                   <span className="text-[9px] font-black uppercase mt-2">{newCategory || 'Category'}</span>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className={`h-40 rounded-[2rem] border-2 border-dashed border-gray-800 flex flex-col items-center justify-center cursor-pointer overflow-hidden ${newImgUrl ? 'border-none' : 'hover:bg-white/5'}`}>
                   {newImgUrl ? <img src={newImgUrl} className="w-full h-full object-cover" /> : <Camera className="w-10 h-10 text-gray-700" />}
                   {!newImgUrl && <span className="text-[9px] font-black uppercase mt-2">Add Photo</span>}
                </div>
              </div>

              {/* Story */}
              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-4">The Process Story</label>
                <textarea 
                  placeholder="Tell us about the making of this piece..."
                  className={`w-full p-8 rounded-[2rem] border text-xs min-h-[120px] outline-none ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-100'}`}
                  onChange={e => setProcessDescription(e.target.value)}
                />
              </div>

              {/* Price & Stock */}
              <div className="grid grid-cols-2 gap-6">
                 <div className={`flex items-center gap-4 p-6 rounded-[1.5rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50'}`}>
                   <Tag className="w-5 h-5 text-[#E07A5F]" />
                   <input type="number" placeholder="Price (ETB)" value={price} onChange={e => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} className="bg-transparent text-[12px] font-black outline-none dark:text-white w-full" />
                 </div>
                 <div className={`flex items-center gap-4 p-6 rounded-[1.5rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50'}`}>
                   <Package className="w-5 h-5 text-gray-400" />
                   <input type="number" placeholder="In Stock" className="bg-transparent text-[12px] font-black outline-none dark:text-white w-full" />
                 </div>
              </div>

              <button disabled={submittingPost} className={`w-full py-8 rounded-[2.5rem] font-black text-[12px] uppercase tracking-[0.5em] shadow-2xl active:scale-95 transition-all ${activeBg} disabled:opacity-50`}>
                {submittingPost ? 'PUBLISHING TO CLOUD...' : 'PUBLISH CRAFT'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RENDER CATEGORY POPUP */}
      <FormPopup isOpen={popupType === 'category'} onClose={() => setPopupType(null)} title="Choose Craft Category">
        <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar">
          {CRAFT_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
            <button key={cat.id} type="button" onClick={() => { setNewCategory(cat.id); setPopupType(null); }} className={`p-6 rounded-[1.5rem] border flex flex-col gap-2 ${newCategory === cat.id ? 'border-[#E07A5F] bg-[#E07A5F]/10' : 'border-gray-800 hover:bg-white/5'}`}>
              <span className="text-3xl">{cat.emoji}</span>
              <span className="text-[10px] font-black uppercase dark:text-white">{cat.name}</span>
            </button>
          ))}
        </div>
      </FormPopup>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = () => setNewImgUrl(reader.result as string);
          reader.readAsDataURL(file);
        }
      }} className="hidden" />
    </div>
  );
}