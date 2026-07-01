import React, { useState, useEffect, useRef } from 'react';
import { Post, UserProfile } from '../types';
import { 
  fetchAllPosts, 
  addPost, 
  incrementLikes, 
  savePostToBoard,
  createNotification
} from '../lib/services';
import { Language } from '../lib/translations';
import { 
  Search, Plus, Heart, Bookmark, Sparkles, X, 
  Image as ImageIcon, AlertCircle, Camera, Check, Layers, Wrench, Package
} from 'lucide-react';

// Sub-modal for the + buttons within the form
const FormPopup = ({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md">
      <div className="bg-white dark:bg-[#1A1A1A] rounded-3xl w-full max-w-md shadow-2xl overflow-hidden border dark:border-gray-800 animate-in fade-in zoom-in duration-200">
        <div className="flex justify-between items-center p-5 border-b dark:border-gray-800">
          <h3 className="font-black text-sm uppercase tracking-widest dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full"><X className="w-5 h-5 dark:text-white" /></button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export const CRAFT_CATEGORIES = [
  { id: 'textiles-fiber', name: 'Textiles & Fiber Arts', emoji: '🧵' },
  { id: 'woodwork', name: 'Woodwork', emoji: '🪵' },
  { id: 'ceramics-pottery', name: 'Ceramics & Pottery', emoji: '🏺' },
  { id: 'jewelry-accessories', name: 'Jewelry & Accessories', emoji: '💍' },
  { id: 'crochet-knitting', name: 'Crochet & Knitting', emoji: '🧶' },
  { id: 'leatherwork', name: 'Leatherwork', emoji: '🪡' },
  { id: 'metalwork', name: 'Metalwork', emoji: '⚒️' },
  { id: 'painting-visual', name: 'Painting & Visual Arts', emoji: '🎨' },
  { id: 'home-decor-crafts', name: 'Home Décor Crafts', emoji: '🪑' },
  { id: 'basketry-natural', name: 'Basketry & Natural Fiber', emoji: '🧺' },
  { id: 'cultural-traditional', name: 'Cultural & Traditional', emoji: '🪆' },
  { id: 'handmade-toys', name: 'Handmade Toys', emoji: '🧸' },
  { id: 'lifestyle-crafts', name: 'Lifestyle Crafts', emoji: '🕯️' }
];

export default function SocialFeed({ mode = 'feed', user, profile, onOpenAuth, onSelectPost, isDarkMode, activeSearchQuery, setActiveSearchQuery, lang }: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'finished' | 'wip'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form Main State
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
      applyAllFilters(allPosts, filterType, selectedCategory);
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { loadPosts(); }, [user]);

  const applyAllFilters = (allPosts: Post[], type: 'all' | 'finished' | 'wip', category: string) => {
    let result = allPosts;
    if (type !== 'all') result = result.filter(p => p.post_type === type);
    if (category !== 'all') result = result.filter(p => p.category === category);
    setFilteredPosts(result);
  };

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
        stock_count: typeof inStockCount === 'number' ? inStockCount : 0,
        created_at: new Date().toISOString()
      });
      setIsCreateModalOpen(false);
      setNewImgUrl(''); setProcessDescription(''); setNewMaterialsList([]); setNewToolsList([]); setNewCategory(null); setInStockCount('');
      loadPosts();
    } catch (err: any) { setFormError(err.message); } finally { setSubmittingPost(false); }
  };

  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-white border-gray-100';

  return (
    <div className="flex-1 min-h-screen px-4 py-6 pb-24 overflow-y-auto">
      
      {/* Header & Filters */}
      <div className="max-w-xl mx-auto flex flex-col gap-6 mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={activeSearchQuery} onChange={(e) => setActiveSearchQuery(e.target.value)}
            placeholder="Search crafts..." className={`w-full pl-12 pr-4 py-3.5 rounded-full border outline-none ${isDarkMode ? 'bg-[#1A1A1A] border-gray-800 text-white' : 'bg-white text-black'}`} />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex bg-gray-100 dark:bg-white/5 p-1 rounded-xl">
            {(['all', 'finished', 'wip'] as const).map((type) => (
              <button key={type} onClick={() => { setFilterType(type); applyAllFilters(posts, type, selectedCategory); }}
                className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${filterType === type ? activeBg : 'text-gray-400'}`}> {type} </button>
            ))}
          </div>
          <button onClick={() => user ? setIsCreateModalOpen(true) : onOpenAuth()} className={`flex items-center gap-2 px-6 py-2.5 rounded-full text-xs font-black shadow-lg ${activeBg}`}>
            <Plus className="w-4 h-4" /> POST
          </button>
        </div>
      </div>

      {/* Masonry Feed */}
      <div className="columns-2 md:columns-3 lg:columns-4 gap-4 space-y-4">
        {filteredPosts.map((post) => (
          <div key={post.id} onClick={() => onSelectPost(post)} className={`break-inside-avoid rounded-2xl overflow-hidden border dark:border-gray-800 ${cardBg} cursor-pointer`}>
            <img src={post.image_url} className="w-full" alt="Craft" />
            <div className="p-3">
              <p className="text-[11px] font-medium line-clamp-2 dark:text-gray-300 mb-2">{post.caption}</p>
              {post.stock_count > 0 && <span className="text-[9px] font-black text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full">STOCK: {post.stock_count}</span>}
              <div className="flex justify-between items-center mt-3 pt-2 border-t dark:border-gray-800">
                <Heart className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-[10px] font-black text-[#E07A5F]">BUY SAFE</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MAIN CREATE MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className={`relative w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl border dark:border-gray-800 max-h-[92vh] overflow-y-auto ${isDarkMode ? 'bg-[#0F0F0F]' : 'bg-[#FAF9F6]'}`}>
            
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${activeBg}`}></div>
                <h3 className={`text-sm font-black tracking-[0.2em] uppercase ${isDarkMode ? 'text-white' : 'text-black'}`}>New Creation</h3>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"><X className="w-6 h-6 text-gray-400" /></button>
            </div>

            <form onSubmit={handleCreatePost} className="space-y-8">
              
              {/* 1. Status & Category (Top Row) */}
              <div className="grid grid-cols-2 gap-3">
                <button type="button" onClick={() => setNewPostType(newPostType === 'finished' ? 'wip' : 'finished')}
                  className={`py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${newPostType === 'finished' ? activeBg : 'border-gray-200 dark:border-gray-800 text-gray-400'}`}>
                  {newPostType === 'finished' ? '✨ Finished' : '🛠️ WIP'}
                </button>
                <button type="button" onClick={() => setPopupType('category')}
                  className={`py-3.5 rounded-2xl border text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 ${newCategory ? 'border-green-500 bg-green-500/10 text-green-500' : 'border-gray-200 dark:border-gray-800 text-gray-400'}`}>
                  {newCategory ? 'DONE ✓' : 'Category +'}
                </button>
              </div>

              {/* 2. Process Description Row */}
              <div className="space-y-3">
                <div className="flex justify-between items-center px-1">
                  <label className="text-[10px] font-black uppercase tracking-widest opacity-40">The Process</label>
                  <button type="button" onClick={() => setPopupType('process')} className={`text-[10px] font-black px-3 py-1 rounded-full ${activeBg}`}>+</button>
                </div>
                <div className={`p-4 rounded-2xl border border-dashed min-h-[60px] text-[11px] ${processDescription ? 'border-blue-500/50 bg-blue-500/5 dark:text-gray-200' : 'border-gray-300 dark:border-gray-800 text-gray-400 italic'}`}>
                  {processDescription || "Tell the story of how this was made..."}
                </div>
              </div>

              {/* 3. Materials & Tools (Side-by-Side) */}
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1.5"><Layers className="w-3 h-3" /> Materials</label>
                    <button type="button" onClick={() => { setTempInput(''); setPopupType('material'); }} className="text-[10px] font-black">+</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newMaterialsList.length > 0 ? newMaterialsList.map((m, i) => (
                      <span key={i} className="text-[9px] font-black px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center gap-1">{m} <X className="w-3 h-3 text-red-500" onClick={() => setNewMaterialsList(newMaterialsList.filter((_, idx) => idx !== i))} /></span>
                    )) : <span className="text-[10px] opacity-20 italic">None added</span>}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-1.5"><Wrench className="w-3 h-3" /> Tools</label>
                    <button type="button" onClick={() => { setTempInput(''); setPopupType('tool'); }} className="text-[10px] font-black">+</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newToolsList.length > 0 ? newToolsList.map((t, i) => (
                      <span key={i} className="text-[9px] font-black px-2 py-1 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center gap-1">{t} <X className="w-3 h-3 text-red-500" onClick={() => setNewToolsList(newToolsList.filter((_, idx) => idx !== i))} /></span>
                    )) : <span className="text-[10px] opacity-20 italic">None added</span>}
                  </div>
                </div>
              </div>

              {/* 4. Compact Image Upload */}
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Photo Reference</label>
                <div onClick={() => fileInputRef.current?.click()} 
                  className={`h-24 border-2 border-dashed rounded-3xl flex items-center justify-center cursor-pointer transition-all ${newImgUrl ? 'border-green-500 bg-green-500/5' : 'border-gray-200 dark:border-gray-800 hover:bg-black/5'}`}>
                  {newImgUrl ? (
                    <img src={newImgUrl} alt="Preview" className="h-16 rounded-xl shadow-lg border dark:border-gray-700" />
                  ) : (
                    <div className="flex items-center gap-2 text-gray-400">
                      <Camera className="w-5 h-5" />
                      <span className="text-[10px] font-black uppercase tracking-widest">Select Image</span>
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageFileChange} className="hidden" />
                </div>
              </div>

              {/* 5. Stock Count & Error Display */}
              <div className="flex items-center gap-4 bg-gray-100 dark:bg-white/5 p-4 rounded-2xl">
                <Package className="w-5 h-5 text-gray-400" />
                <input type="number" min="0" placeholder="Available in Stock (0 if not for sale)" value={inStockCount} onChange={e => setInStockCount(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="flex-1 bg-transparent text-xs font-bold outline-none dark:text-white" />
              </div>

              {formError && <div className="text-red-500 text-[10px] font-black text-center uppercase tracking-widest px-4 py-3 bg-red-500/10 rounded-xl">{formError}</div>}
              
              <button type="submit" disabled={submittingPost} className={`w-full py-5 rounded-[1.5rem] font-black text-[11px] uppercase tracking-[0.3em] shadow-2xl transition-all active:scale-[0.97] ${activeBg} disabled:opacity-50`}>
                {submittingPost ? 'Publishing...' : 'Publish Creation'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP MODALS FOR + BUTTONS */}
      
      <FormPopup isOpen={popupType === 'category'} onClose={() => setPopupType(null)} title="Select Craft">
        <div className="grid grid-cols-2 gap-3">
          {CRAFT_CATEGORIES.map(cat => (
            <button key={cat.id} type="button" onClick={() => { setNewCategory(cat.id); setPopupType(null); }}
              className={`p-4 rounded-2xl border text-left flex flex-col gap-1 transition-all ${newCategory === cat.id ? 'border-[#E07A5F] bg-[#E07A5F]/10' : 'border-gray-100 dark:border-gray-800 hover:border-gray-300'}`}>
              <span className="text-2xl">{cat.emoji}</span>
              <span className="text-[10px] font-black uppercase dark:text-white">{cat.name}</span>
            </button>
          ))}
        </div>
      </FormPopup>

      <FormPopup isOpen={popupType === 'process'} onClose={() => setPopupType(null)} title="The Process">
        <textarea autoFocus className={`w-full h-48 p-5 rounded-2xl border text-xs outline-none resize-none ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          placeholder="Tell your story..." value={processDescription} onChange={e => setProcessDescription(e.target.value)} />
        <button onClick={() => setPopupType(null)} className={`w-full mt-4 py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Save Description</button>
      </FormPopup>

      <FormPopup isOpen={popupType === 'material'} onClose={() => setPopupType(null)} title="Add Materials">
        <input autoFocus type="text" placeholder="e.g. Oak Wood, Silk (Use commas)" className={`w-full p-4 rounded-xl border text-xs outline-none mb-4 ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          value={tempInput} onChange={e => setTempInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setNewMaterialsList([...newMaterialsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]), setPopupType(null))} />
        <button onClick={() => { setNewMaterialsList([...newMaterialsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]); setPopupType(null); }} className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Add Items</button>
      </FormPopup>

      <FormPopup isOpen={popupType === 'tool'} onClose={() => setPopupType(null)} title="Add Tools">
        <input autoFocus type="text" placeholder="e.g. Chisel, Loom (Use commas)" className={`w-full p-4 rounded-xl border text-xs outline-none mb-4 ${isDarkMode ? 'bg-white/5 border-gray-800 text-white' : 'bg-gray-50 border-gray-200'}`}
          value={tempInput} onChange={e => setTempInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && (setNewToolsList([...newToolsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]), setPopupType(null))} />
        <button onClick={() => { setNewToolsList([...newToolsList, ...tempInput.split(',').map(i=>i.trim()).filter(i=>i)]); setPopupType(null); }} className={`w-full py-3.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${activeBg}`}>Add Items</button>
      </FormPopup>

    </div>
  );
}