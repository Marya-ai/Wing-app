import React, { useState, useEffect, useRef } from 'react';
import { Post, UserProfile } from '../types';
import { 
  fetchAllPosts, 
  addPost, 
  incrementLikes, 
  savePostToBoard 
} from '../lib/services';
import { Language } from '../lib/translations';
import { 
  Search, Plus, Heart, Sparkles, X, 
  Image as ImageIcon, Camera, Check, Layers, Wrench, Package, ArrowUpDown
} from 'lucide-react';

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
  mode?: 'feed' | 'explore';
  user: any;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  onSelectPost: (post: Post) => void;
  isDarkMode: boolean;
  activeSearchQuery: string;
  setActiveSearchQuery: (q: string) => void;
  lang: Language;
}

// Sub-modal for the form buttons
const FormPopup = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-white dark:bg-[#121212] rounded-3xl w-full max-w-md shadow-2xl border dark:border-gray-800 overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b dark:border-gray-800">
          <h3 className="font-black text-xs uppercase tracking-widest dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><X className="w-5 h-5 dark:text-white" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

export default function SocialFeed({ mode = 'feed', user, profile, onOpenAuth, onSelectPost, isDarkMode, activeSearchQuery, setActiveSearchQuery, lang }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'finished' | 'wip'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'trending'>('newest');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form State
  const [processDescription, setProcessDescription] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newPostType, setNewPostType] = useState<'finished' | 'wip'>('finished');
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newMaterialsList, setNewMaterialsList] = useState<string[]>([]);
  const [newToolsList, setNewToolsList] = useState<string[]>([]);
  const [inStockCount, setInStockCount] = useState<number | ''>('');
  const [formError, setFormError] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Internal Modals State
  const [popupType, setPopupType] = useState<'category' | 'process' | 'material' | 'tool' | null>(null);
  const [tempInput, setTempInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPosts = async () => {
    setLoading(true);
    try {
      const allPosts = await fetchAllPosts();
      setPosts(allPosts);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { loadPosts(); }, [user]);

  // Combined Filtering Logic
  useEffect(() => {
    let result = [...posts];

    // Filter by Search Query
    if (activeSearchQuery.trim()) {
      const q = activeSearchQuery.toLowerCase();
      result = result.filter(p => 
        p.caption?.toLowerCase().includes(q) || 
        p.author_name?.toLowerCase().includes(q)
      );
    }

    // Filter by Finished/WIP
    if (filterType !== 'all') {
      result = result.filter(p => p.post_type === filterType);
    }

    // Filter by Category
    if (selectedCategory !== 'all') {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Sort
    if (sortBy === 'trending') {
      result.sort((a, b) => (b.likes_count || 0) - (a.likes_count || 0));
    } else {
      result.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
    }

    setFilteredPosts(result);
  }, [posts, filterType, selectedCategory, sortBy, activeSearchQuery]);

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) { setFormError('Image too large (max 1MB)'); return; }
      const reader = new FileReader();
      reader.onloadend = () => setNewImgUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newImgUrl) { setFormError('Please add a photo'); return; }
    if (!newCategory) { setFormError('Please select a category'); return; }
    setSubmittingPost(true);
    try {
      await addPost({
        user_id: user.uid,
        author_name: profile?.full_name || user.displayName || 'Artisan',
        author_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        image_url: newImgUrl,
        caption: processDescription,
        post_type: newPostType,
        category: newCategory,
        materials: newMaterialsList,
        tools: newToolsList,
        stock_count: Number(inStockCount) || 0,
        created_at: new Date().toISOString()
      });
      setIsCreateModalOpen(false);
      resetForm();
      loadPosts();
    } catch (err: any) { setFormError(err.message); } finally { setSubmittingPost(false); }
  };

  const resetForm = () => {
    setNewImgUrl(''); setProcessDescription(''); setNewMaterialsList([]); 
    setNewToolsList([]); setNewCategory(null); setInStockCount(''); setFormError('');
  };

  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-white border-gray-100';

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 overflow-y-auto">
      
      {/* 1. SEARCH BAR */}
      <div className="max-w-2xl mx-auto mb-6">
        <div className="relative group">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#E07A5F]" />
          <input 
            type="text" 
            value={activeSearchQuery} 
            onChange={(e) => setActiveSearchQuery(e.target.value)}
            placeholder="Search crafts..." 
            className={`w-full pl-14 pr-4 py-4 rounded-2xl border outline-none transition-all ${isDarkMode ? 'bg-[#1A1A1A] border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-white border-gray-200 text-black focus:border-[#E07A5F]'}`} 
          />
        </div>
      </div>

      {/* 2. CATEGORY BAR (SCROLLABLE) */}
      <div className="max-w-4xl mx-auto mb-8">
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {CRAFT_CATEGORIES.map((cat) => (
            <button 
              key={cat.id} 
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-2 px-6 py-3 rounded-2xl border font-bold text-xs whitespace-nowrap transition-all hover:scale-105 active:scale-95 ${
                selectedCategory === cat.id 
                  ? activeBg + ' border-transparent shadow-lg' 
                  : 'bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800 text-gray-500'
              }`}
            >
              <span className="text-xl">{cat.emoji}</span>
              <span>{cat.name.toUpperCase()}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. SUB-FILTERS & POST BUTTON */}
      <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4 mb-10 border-t dark:border-gray-800 pt-6">
        <div className="flex bg-gray-100 dark:bg-white/5 p-1.5 rounded-2xl">
          {(['all', 'finished', 'wip'] as const).map((type) => (
            <button 
              key={type} 
              onClick={() => setFilterType(type)}
              className={`px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${filterType === type ? activeBg : 'text-gray-400 hover:text-gray-200'}`}
            > 
              {type} 
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4">
           <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
              <button onClick={() => setSortBy('newest')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${sortBy === 'newest' ? activeBg : 'text-gray-400'}`}>NEW</button>
              <button onClick={() => setSortBy('trending')} className={`px-4 py-2 rounded-lg text-[9px] font-black uppercase ${sortBy === 'trending' ? activeBg : 'text-gray-400'}`}>TRENDING</button>
           </div>
           <button onClick={() => user ? setIsCreateModalOpen(true) : onOpenAuth()} className={`flex items-center gap-2 px-8 py-3 rounded-full text-xs font-black shadow-xl active:scale-95 transition-transform ${activeBg}`}>
              <Plus className="w-5 h-5" /> POST
           </button>
        </div>
      </div>

      {/* 4. POST FEED */}
      {loading ? ( 
        <div className="flex flex-col items-center justify-center py-32 opacity-50">
          <div className="w-10 h-10 border-4 border-t-[#E07A5F] rounded-full animate-spin mb-4"></div>
          <p className="text-xs font-black uppercase tracking-widest">Crafting your feed...</p>
        </div> 
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-32">
          <ImageIcon className="w-16 h-16 mx-auto mb-6 text-gray-300 opacity-20" />
          <h3 className="text-lg font-black dark:text-white mb-2">NO CRAFTS FOUND</h3>
          <p className="text-gray-500 text-sm italic">Try a different category or search term.</p>
        </div>
      ) : (
        <div className="columns-2 md:columns-3 lg:columns-4 xl:columns-5 gap-6 space-y-6">
          {filteredPosts.map((post) => (
            <div 
              key={post.id} 
              onClick={() => onSelectPost(post)} 
              className={`break-inside-avoid rounded-[2rem] overflow-hidden border dark:border-gray-800 ${cardBg} cursor-pointer group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2`}
            >
              <div className="relative overflow-hidden">
                <img src={post.image_url} className="w-full object-cover transition-transform duration-700 group-hover:scale-110" alt="Artisan Piece" />
                <div className="absolute top-4 right-4">
                  <span className={`text-[9px] px-3 py-1.5 rounded-full font-black uppercase tracking-widest shadow-lg ${post.post_type === 'wip' ? 'bg-blue-600 text-white' : 'bg-green-600 text-white'}`}>
                    {post.post_type}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <p className="text-xs font-bold line-clamp-2 dark:text-gray-200 mb-4 leading-relaxed">{post.caption}</p>
                <div className="flex justify-between items-center pt-4 border-t dark:border-gray-800">
                  <div className="flex items-center gap-2">
                    <img src={post.author_avatar} className="w-6 h-6 rounded-full border-2 border-[#E07A5F]" alt="Maker" />
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tighter truncate max-w-[70px]">{post.author_name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-[#E07A5F] transition-colors">
                    <Heart className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black">{post.likes_count}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl">
          <div className={`relative w-full max-w-lg rounded-[3rem] p-10 border dark:border-gray-800 shadow-2xl overflow-y-auto max-h-[92vh] ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-[#FAF9F6]'}`}>
            
            <div className="flex justify-between items-center mb-10">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full animate-pulse ${activeBg}`}></div>
                <h3 className={`text-sm font-black tracking-[0.4em] uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>New Creation</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-3 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-all"><X className="w-7 h-7 text-gray-400" /></button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-10">
              
              <div className="grid grid-cols-2 gap-4">
                <button type="button" onClick={() => setNewPostType(newPostType === 'finished' ? 'wip' : 'finished')}
                  className={`py-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest transition-all ${newPostType === 'finished' ? activeBg : 'border-gray-200 dark:border-gray-800 text-gray-400'}`}>
                  {newPostType === 'finished' ? '✨ Finished' : '🛠️ WIP'}
                </button>
                <button type="button" onClick={() => setPopupType('category')}
                  className={`py-4 rounded-2xl border text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${newCategory ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-gray-200 dark:border-gray-800 text-gray-400'}`}>
                  {newCategory ? 'DONE ✓' : 'Category +'}
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center px-2">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">The Process</label>
                  <button type="button" onClick={() => setPopupType('process')} className={`text-[10px] font-black px-4 py-1.5 rounded-full ${activeBg}`}>+</button>
                </div>
                <div className={`p-6 rounded-3xl border border-dashed min-h-[80px] text-xs leading-relaxed ${processDescription ? 'border-blue-500/50 bg-blue-500/5 dark:text-gray-200' : 'border-gray-300 dark:border-gray-800 text-gray-400 italic'}`}>
                  {processDescription || "Tell the story of your creation..."}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2"><Layers className="w-4 h-4" /> Materials</label>
                    <button type="button" onClick={() => { setTempInput(''); setPopupType('material'); }} className="text-[11px] font-black text-gray-400 hover:text-white transition-colors">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newMaterialsList.length > 0 ? newMaterialsList.map((m, i) => (
                      <span key={i} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center gap-2 border dark:border-gray-800">{m} <X className="w-3.5 h-3.5 text-red-500 cursor-pointer" onClick={() => setNewMaterialsList(newMaterialsList.filter((_, idx) => idx !== i))} /></span>
                    )) : <span className="text-[10px] opacity-20 italic pl-2">None added</span>}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-2">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2"><Wrench className="w-4 h-4" /> Tools</label>
                    <button type="button" onClick={() => { setTempInput(''); setPopupType('tool'); }} className="text-[11px] font-black text-gray-400 hover:text-white transition-colors">+</button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {newToolsList.length > 0 ? newToolsList.map((t, i) => (
                      <span key={i} className="text-[10px] font-black px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center gap-2 border dark:border-gray-800">{t} <X className="w-3.5 h-3.5 text-red-500 cursor-pointer" onClick={() => setNewToolsList(newToolsList.filter((_, idx) => idx !== i))} /></span>
                    )) : <span className="text-[10px] opacity-20 italic pl-2">None added</span>}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-2">Final Photo</label>
                <div onClick={(e) => { e.preventDefault(); e.stopPropagation(); fileInputRef.current?.click(); }} 
                  className={`h-32 border-2 border-dashed rounded-[2rem] flex items-center justify-center cursor-pointer transition-all ${newImgUrl ? 'border-green-500 bg-green-500/5' : 'border-gray-200 dark:border-gray-800 hover:bg-black/10'}`}>
                  {newImgUrl ? (
                    <img src={newImgUrl} alt="Preview" className="h-24 rounded-2xl shadow-2xl border dark:border-gray-700" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <Camera className="w-8 h-8" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Select Image</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-5 rounded-3xl border dark:border-gray-800">
                <Package className="w-6 h-6 text-gray-400" />
                <input type="number" min="0" placeholder="Available In Stock" value={inStockCount} onChange={e => setInStockCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="flex-1 bg-transparent text-[11px] font-black outline-none dark:text-white uppercase tracking-widest" />
              </div>

              {formError && <div className="text-red-500 text-[10px] font-black text-center uppercase tracking-[0.2em] px-4 py-4 bg-red-500/10 rounded-2xl">{formError}</div>}
              
              <button type="submit" disabled={submittingPost} className={`w-full py-6 rounded-[2rem] font-black text-[12px] uppercase tracking-[0.4em] shadow-2xl transition-all active:scale-[0.97] ${activeBg} disabled:opacity-50`}>
                {submittingPost ? 'PUBLISHING...' : 'CONFIRM & PUBLISH'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODALS */}
      <FormPopup isOpen={popupType === 'category'} onClose={() => setPopupType(null)} title="Choose Craft Category">
        <div className="grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
          {CRAFT_CATEGORIES.filter(c => c.id !== 'all').map(cat => (
            <button key={cat.id} type="button" onClick={() => { setNewCategory(cat.id); setPopupType(null); }}
              className={`p-6 rounded-3xl border text-left flex flex-col gap-2 transition-all ${newCategory === cat.id ? 'border-[#E07A5F] bg-[#E07A5F]/10' : 'border-gray-100 dark:border-gray-800 hover:border-gray-400'}`}>
              <span className="text-3xl">{cat.emoji}</span>
              <span className="text-[11px] font-black uppercase tracking-tight dark:text-white leading-tight">{cat.name}</span>
            </button>
          ))}
        </div>
      </FormPopup>

      <FormPopup isOpen={popupType === 'process'} onClose={() => setPopupType(null)} title="The Creation Story">
        <textarea autoFocus className={`w-full h-56 p-6 rounded-3xl border text-xs outline-none resize-none leading-relaxed ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          placeholder="Step by step, how did you make this?..." value={processDescription} onChange={e => setProcessDescription(e.target.value)} />
        <button onClick={() => setPopupType(null)} className={`w-full mt-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Save Details</button>
      </FormPopup>

      <FormPopup isOpen={popupType === 'material'} onClose={() => setPopupType(null)} title="Materials List">
        <input autoFocus type="text" placeholder="e.g. Silk, Wood, Clay (Use commas)" className={`w-full p-5 rounded-2xl border text-xs outline-none mb-6 ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          value={tempInput} onChange={e => setTempInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setNewMaterialsList([...newMaterialsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]), setPopupType(null))} />
        <button onClick={() => { setNewMaterialsList([...newMaterialsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]); setPopupType(null); }} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Add to List</button>
      </FormPopup>

      <FormPopup isOpen={popupType === 'tool'} onClose={() => setPopupType(null)} title="Tools List">
        <input autoFocus type="text" placeholder="e.g. Needle, Chisel, Loom (Use commas)" className={`w-full p-5 rounded-2xl border text-xs outline-none mb-6 ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          value={tempInput} onChange={e => setTempInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setNewToolsList([...newToolsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]), setPopupType(null))} />
        <button onClick={() => { setNewToolsList([...newToolsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]); setPopupType(null); }} className={`w-full py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Add to List</button>
      </FormPopup>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="fixed invisible opacity-0 pointer-events-none" style={{ top: '-1000px', left: '-1000px' }} />
    </div>
  );
}