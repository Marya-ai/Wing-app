import React, { useState, useEffect, useRef } from 'react';
import { Post, UserProfile } from '../types';
// WING: Firebase & Logic Imports
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import { createWingPost } from '../lib/wingServices'; 

import { 
  Search, Plus, Heart, X, 
  Image as ImageIcon, Camera, Layers, Wrench, Package, Tag, AlertTriangle, Sparkles,
  Phone, Send, ShieldCheck, Info, CheckCircle2, ArrowRight, Filter
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

const FormPopup = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
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
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'finished' | 'wip'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'trending'>('newest');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [popupType, setPopupType] = useState<'category' | 'process' | 'material' | 'tool' | null>(null);

  const [regPhone, setRegPhone] = useState('');
  const [regTelegram, setRegTelegram] = useState('');
  const [regCommission, setRegCommission] = useState<number>(15);
  const [regAgreed, setRegAgreed] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);

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

  useEffect(() => {
    const q = query(collection(db, "posts"), orderBy("created_at", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

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

  const handleStartPost = () => {
    if (!user) { onOpenAuth(); return; }
    if (!profile?.phone || !profile?.telegram_username || !profile?.has_agreed) {
      setIsRegisterModalOpen(true);
    } else {
      setIsCreateModalOpen(true);
    }
  };

  const handleCompleteRegistration = async () => {
    if (!regPhone || !regTelegram || !regAgreed) {
      setFormError("Complete all fields & agree to terms.");
      return;
    }
    setIsRegistering(true);
    try {
      await setDoc(doc(db, "profiles", user.uid), {
        phone: regPhone,
        telegram_username: regTelegram.replace('@', ''),
        commission_rate: regCommission,
        has_agreed: true,
        trust_score: 10,
        artisan_since: new Date().toISOString()
      }, { merge: true });
      setIsRegisterModalOpen(false);
      setIsCreateModalOpen(true);
    } catch (err) { console.error(err); } finally { setIsRegistering(false); }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImgUrl || !newCategory) { setFormError("Missing Image or Category"); return; }
    if (newPostType === 'finished' && !price) { setFormError("Set a price"); return; }

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
    <div className="flex-1 min-h-screen px-4 md:px-10 py-8 pb-32 overflow-y-auto no-scrollbar">
      
      {/* 1. BRAND HEADER */}
      <div className="max-w-7xl mx-auto mb-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-gradient-to-tr from-[#E07A5F] to-[#D4AF37] rounded-[1.2rem] flex items-center justify-center shadow-2xl rotate-3 group hover:rotate-0 transition-transform duration-500">
              <Sparkles className="text-white w-8 h-8" />
           </div>
           <div>
             <h1 className={`text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>
               Wing <span className={isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]'}>Market</span>
             </h1>
             <p className="text-[9px] font-bold text-gray-500 uppercase tracking-[0.4em]">Ethiopian Artisan Alliance</p>
           </div>
        </div>
        <button 
          onClick={handleStartPost} 
          className={`flex items-center gap-3 px-10 py-5 rounded-full font-black text-xs shadow-2xl active:scale-95 transition-all ${activeBg} hover:brightness-110`}
        >
          <Plus size={20} /> POST YOUR WORK
        </button>
      </div>

      {/* 2. SEARCH & GLOBAL FILTERS */}
      <div className="max-w-7xl mx-auto mb-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        <div className="lg:col-span-8 relative group">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#E07A5F] transition-colors" />
          <input 
            type="text" 
            value={activeSearchQuery} 
            onChange={(e) => setActiveSearchQuery(e.target.value)}
            placeholder="Search for handmade magic..." 
            className={`w-full pl-16 pr-6 py-5 rounded-[2rem] border outline-none transition-all text-sm font-bold shadow-sm ${isDarkMode ? 'bg-[#111] border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-white border-gray-100 text-black focus:border-[#E07A5F]'}`} 
          />
        </div>
        <div className="lg:col-span-4 flex items-center gap-3 bg-gray-100 dark:bg-white/5 p-2 rounded-[1.8rem] border dark:border-gray-800">
           {(['all', 'finished', 'wip'] as const).map(t => (
             <button key={t} onClick={() => setFilterType(t)} className={`flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all ${filterType === t ? activeBg : 'text-gray-500'}`}>{t}</button>
           ))}
        </div>
      </div>

      {/* 3. CATEGORY SCROLLER */}
      <div className="max-w-7xl mx-auto mb-14 flex gap-4 overflow-x-auto no-scrollbar pb-4">
        {CRAFT_CATEGORIES.map(cat => (
          <button key={cat.id} onClick={() => setSelectedCategory(cat.id)} className={`px-8 py-4 rounded-full border font-black text-[10px] whitespace-nowrap transition-all flex items-center gap-3 ${selectedCategory === cat.id ? activeBg + ' border-transparent shadow-xl' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800 text-gray-500 hover:border-gray-400'}`}>
            <span className="text-xl">{cat.emoji}</span>
            <span>{cat.name.toUpperCase()}</span>
          </button>
        ))}
      </div>

      {/* 4. FEED GRID */}
      {loading ? (
        <div className="py-40 text-center flex flex-col items-center">
           <div className="w-12 h-12 border-4 border-[#E07A5F] border-t-transparent rounded-full animate-spin mb-6"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Syncing with Wing Cloud...</p>
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="py-40 text-center opacity-30">
          <ImageIcon size={64} className="mx-auto mb-6" />
          <h3 className="text-xl font-black uppercase tracking-widest">No Crafts Found</h3>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-8 space-y-8 max-w-7xl mx-auto">
          {filteredPosts.map((post) => {
            const isFraud = (post.trust_score || 0) < 0;
            return (
              <div 
                key={post.id} 
                onClick={() => !isFraud && onSelectPost(post)} 
                className={`break-inside-avoid relative rounded-[2.5rem] overflow-hidden border transition-all duration-500 ${cardBg} ${isFraud ? 'opacity-40 grayscale pointer-events-none' : 'cursor-pointer group hover:shadow-2xl hover:-translate-y-2 hover:border-[#E07A5F]/30'}`}
              >
                <div className="relative aspect-square overflow-hidden">
                  <img src={post.image_url} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000" alt="" />
                  <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-black px-4 py-2 rounded-full shadow-lg border border-white/10">
                    {post.price > 0 ? `${post.price.toLocaleString()} ETB` : 'PRICE ON REQ'}
                  </div>
                  <div className="absolute bottom-4 left-4 scale-90 origin-bottom-left">
                    <ReputationBadge score={post.trust_score || 0} isBanned={isFraud} size="sm" />
                  </div>
                  {post.post_type === 'wip' && (
                    <div className="absolute top-4 left-4 bg-blue-600/90 text-white text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest">WIP</div>
                  )}
                </div>
                <div className="p-6">
                  <p className="text-[12px] font-bold line-clamp-2 dark:text-gray-200 leading-relaxed mb-5">{post.caption}</p>
                  <div className="flex items-center justify-between pt-4 border-t dark:border-gray-800">
                    <div className="flex items-center gap-2">
                       <img src={post.author_avatar} className="w-6 h-6 rounded-full border dark:border-gray-700" alt="" />
                       <span className="text-[9px] font-black text-gray-500 uppercase truncate max-w-[80px]">{post.author_name}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-gray-400">
                       <Heart size={14} />
                       <span className="text-[10px] font-bold">{post.likes_count || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 5. ARTISAN REGISTRATION MODAL */}
      {isRegisterModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-2xl animate-in fade-in duration-300">
          <div className={`w-full max-w-lg rounded-[4rem] p-12 border shadow-2xl relative ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-100'}`}>
            <button onClick={() => setIsRegisterModalOpen(false)} className="absolute top-10 right-10 p-2 text-gray-500 hover:text-white"><X size={28} /></button>
            
            <div className="text-center mb-12">
              <div className="w-20 h-20 bg-green-500/10 rounded-[1.5rem] flex items-center justify-center mx-auto mb-6 rotate-12">
                 <ShieldCheck size={40} className="text-green-500" />
              </div>
              <h2 className={`text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>Verification</h2>
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-widest mt-3">Link your accounts to start selling</p>
            </div>

            <div className="space-y-6">
              <div className={`flex items-center gap-5 p-6 rounded-[1.5rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Phone className="w-6 h-6 text-gray-400" />
                <input type="text" placeholder="Telebirr Number (09...)" value={regPhone} onChange={e => setRegPhone(e.target.value)} className="bg-transparent outline-none text-sm font-black dark:text-white flex-1" />
              </div>

              <div className={`flex items-center gap-5 p-6 rounded-[1.5rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-200'}`}>
                <Send className="w-6 h-6 text-sky-500" />
                <input type="text" placeholder="Telegram Username (@...)" value={regTelegram} onChange={e => setRegTelegram(e.target.value)} className="bg-transparent outline-none text-sm font-black dark:text-white flex-1" />
              </div>

              <div className="p-8 rounded-[2.5rem] bg-gray-100 dark:bg-white/5 border dark:border-gray-800">
                <div className="flex justify-between items-center mb-6">
                   <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Wing Fee Choice</label>
                   <span className={`text-2xl font-black ${isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]'}`}>{regCommission}%</span>
                </div>
                <input type="range" min="10" max="25" value={regCommission} onChange={e => setRegCommission(parseInt(e.target.value))} className="w-full accent-[#E07A5F] h-2 bg-gray-300 dark:bg-gray-700 rounded-full appearance-none cursor-pointer" />
                <div className="flex justify-between mt-3 text-[9px] font-black text-gray-500 uppercase">
                  <span>Standard</span>
                  <span>Premium Exposure</span>
                </div>
              </div>

              <div className="flex gap-4 p-5 items-start bg-[#E07A5F]/5 rounded-2xl border border-[#E07A5F]/10">
                 <input type="checkbox" checked={regAgreed} onChange={e => setRegAgreed(e.target.checked)} className="mt-1 w-6 h-6 accent-[#E07A5F] rounded-lg" />
                 <p className="text-[10px] font-bold text-gray-500 leading-relaxed">
                   I agree to the Marketplace rules. I will report all sales and pay the <span className="text-[#E07A5F]">{regCommission}%</span> commission via Telebirr.
                 </p>
              </div>

              <button onClick={handleCompleteRegistration} disabled={isRegistering} className={`w-full py-7 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.5em] shadow-2xl active:scale-[0.98] transition-all ${activeBg} disabled:opacity-50`}>
                {isRegistering ? 'VERIFYING...' : 'CONFIRM & JOIN'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 6. CREATE CRAFT MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`relative w-full max-w-xl rounded-[4rem] p-12 border shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-[#FAF9F6] border-gray-100'}`}>
            <div className="flex justify-between items-center mb-10">
               <h3 className={`text-xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>List a Creation</h3>
               <button onClick={() => setIsCreateModalOpen(false)} className="p-2"><X size={28} className="text-gray-500" /></button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-10">
              <div className="flex p-2 bg-gray-100 dark:bg-white/5 rounded-[2rem] border dark:border-gray-800">
                 <button type="button" onClick={() => setNewPostType('finished')} className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${newPostType === 'finished' ? activeBg : 'text-gray-500'}`}>✨ For Sale</button>
                 <button type="button" onClick={() => setNewPostType('wip')} className={`flex-1 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-widest transition-all ${newPostType === 'wip' ? activeBg : 'text-gray-500'}`}>🛠️ In Progress</button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div onClick={() => setPopupType('category')} className={`h-44 rounded-[2.5rem] border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer transition-all ${newCategory ? 'bg-green-500/10 border-green-500' : 'hover:bg-white/5'}`}>
                   {newCategory ? <CheckCircle2 size={40} className="text-green-500" /> : <Layers size={40} className="text-gray-700" />}
                   <span className="text-[10px] font-black uppercase mt-3">{newCategory || 'Pick Category'}</span>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className={`h-44 rounded-[2.5rem] border-2 border-dashed border-gray-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden relative ${newImgUrl ? 'border-none shadow-2xl' : 'hover:bg-white/5'}`}>
                   {newImgUrl ? <img src={newImgUrl} className="w-full h-full object-cover" /> : <Camera size={40} className="text-gray-700" />}
                   {!newImgUrl && <span className="text-[10px] font-black uppercase mt-3">Add Media</span>}
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase text-gray-500 ml-4 tracking-widest">Story of Creation</label>
                <textarea 
                  placeholder="Share the materials, time, and heart put into this piece..."
                  className={`w-full p-8 rounded-[2.5rem] border text-xs min-h-[140px] outline-none leading-relaxed font-bold ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-white border-gray-100'}`}
                  onChange={e => setProcessDescription(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-8">
                 <div className={`flex items-center gap-5 p-6 rounded-[1.8rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-100'} ${newPostType === 'wip' ? 'opacity-20 pointer-events-none' : ''}`}>
                   <Tag className="w-6 h-6 text-[#E07A5F]" />
                   <input type="number" placeholder="Price (ETB)" value={price} onChange={e => setPrice(e.target.value === '' ? '' : parseFloat(e.target.value))} className="bg-transparent text-sm font-black outline-none dark:text-white w-full" />
                 </div>
                 <div className={`flex items-center gap-5 p-6 rounded-[1.8rem] border ${isDarkMode ? 'bg-white/5 border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
                   <Package className="w-6 h-6 text-gray-400" />
                   <input type="number" placeholder="Stock" className="bg-transparent text-sm font-black outline-none dark:text-white w-full" />
                 </div>
              </div>

              {formError && <div className="p-5 rounded-2xl bg-red-500/10 text-red-500 text-[10px] font-black uppercase text-center border border-red-500/20">{formError}</div>}

              <button disabled={submittingPost} className={`w-full py-8 rounded-[2.5rem] font-black text-xs uppercase tracking-[0.6em] shadow-2xl active:scale-95 transition-all ${activeBg} disabled:opacity-50`}>
                {submittingPost ? 'UPLOADING TO CLOUD...' : 'PUBLISH TO WING'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUPS FOR CATEGORY */}
      <FormPopup isOpen={popupType === 'category'} onClose={() => setPopupType(null)} title="Select Craft Genre">
        <div className="grid grid-cols-2 gap-4 max-h-[50vh] overflow-y-auto no-scrollbar">
          {CRAFT_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
            <button key={cat.id} type="button" onClick={() => { setNewCategory(cat.id); setPopupType(null); }} className={`p-6 rounded-[2rem] border flex flex-col gap-3 transition-all ${newCategory === cat.id ? 'border-[#E07A5F] bg-[#E07A5F]/10' : 'border-gray-800 hover:border-gray-500'}`}>
              <span className="text-4xl">{cat.emoji}</span>
              <span className="text-[10px] font-black uppercase dark:text-white tracking-tighter leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </FormPopup>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" />
    </div>
  );
}