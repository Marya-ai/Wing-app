import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from '../types';
import { 
  fetchAllPosts, 
  addPost, 
  incrementLikes, 
  savePostToBoard,
  createNotification,
  addComment // Ensure this service exists in your lib/services
} from '../lib/services';
import { Language, translations } from '../lib/translations';
import { 
  Search, Plus, Heart, Bookmark, MessageCircle, Sparkles, X, Layers, Tag, 
  Wrench, Image as ImageIcon, AlertCircle, ArrowRight, Flame, Zap, ExternalLink, ShieldCheck
} from 'lucide-react';

export const CRAFT_CATEGORIES = [
  { id: 'all', name: 'All Crafts', emoji: '✨', description: 'Everything hand-made' },
  { id: 'textiles-fiber', name: 'Textiles & Fiber Arts', emoji: '🧵', description: 'Weaving, embroidery & fabrics' },
  { id: 'woodwork', name: 'Woodwork', emoji: '🪵', description: 'Carving, joinery & timber' },
  { id: 'ceramics-pottery', name: 'Ceramics & Pottery', emoji: '🪔', description: 'Clay, glazing & wheelwork' },
  { id: 'jewelry-accessories', name: 'Jewelry & Accessories', emoji: '', description: 'Gems, rings & metal accents' },
  { id: 'crochet-knitting', name: 'Crochet & Knitting', emoji: '🧶', description: 'Yarn, needles & plushies' },
  { id: 'leatherwork', name: 'Leatherwork', emoji: '🪡', description: 'Saddlery, stitching & wallets' },
  { id: 'metalwork', name: 'Metalwork', emoji: '🧱', description: 'Forging, welding & sculpture' },
  { id: 'painting-visual', name: 'Painting & Visual Arts', emoji: '🎨', description: 'Canvas, pigments & watercolor' },
  { id: 'home-decor-crafts', name: 'Home Décor Crafts', emoji: '🪑', description: 'Decor, candles & small furniture' },
  { id: 'basketry-natural', name: 'Basketry & Natural Fiber', emoji: '', description: 'Weaving reed, bamboo & grass' },
  { id: 'cultural-traditional', name: 'Cultural & Traditional', emoji: '🪆', description: 'Folk art & heritage techniques' },
  { id: 'handmade-toys', name: 'Handmade Toys', emoji: '🧸', description: 'Dolls, puppets & soft play' },
  { id: 'lifestyle-crafts', name: 'Lifestyle Crafts', emoji: '🕯️', description: 'Organic soaps, candles & lifestyle' }
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

export default function SocialFeed({
  mode = 'feed',
  user,
  profile,
  onOpenAuth,
  onSelectPost,
  isDarkMode,
  activeSearchQuery,
  setActiveSearchQuery,
  lang
}: SocialFeedProps) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'finished' | 'wip'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchLoading, setSearchLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Streak State
  const [streak, setStreak] = useState(0);
  const [lastActiveDate, setLastActiveDate] = useState<string | null>(null);

  // New Post Form State
  const [newCaption, setNewCaption] = useState('');
  const [newImgUrl, setNewImgUrl] = useState('');
  const [newPostType, setNewPostType] = useState<'finished' | 'wip'>('finished');
  const [newCategory, setNewCategory] = useState('textiles-fiber');
  const [newMaterial, setNewMaterial] = useState('');
  const [newMaterialsList, setNewMaterialsList] = useState<string[]>([]);
  const [newTool, setNewTool] = useState('');
  const [newToolsList, setNewToolsList] = useState<string[]>([]);
  const [formError, setFormError] = useState('');
  const [submittingPost, setSubmittingPost] = useState(false);

  // Load Posts & Calculate Streak
  const loadPosts = async () => {
    setLoading(true);
    try {
      const allPosts = await fetchAllPosts();
      setPosts(allPosts);
      applyAllFilters(allPosts, filterType, selectedCategory, null);
      
      // Simple streak calculation based on user's post history
      if (user && allPosts.length > 0) {
        const userPosts = allPosts.filter(p => p.user_id === user.uid).sort((a,b) => 
          new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime()
        );
        
        let currentStreak = 0;
        let lastDate = new Date();
        
        // Check consecutive days with activity
        for (const post of userPosts) {
          const postDate = new Date(post.created_at || '');
          const diffTime = Math.abs(lastDate.getTime() - postDate.getTime());
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
          
          if (diffDays <= 1) {
            currentStreak++;
            lastDate = postDate;
          } else {
            break;
          }
        }
        setStreak(currentStreak);
        setLastActiveDate(userPosts[0]?.created_at?.split('T')[0] || null);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, [user]);

  // Keyword classifier for filtering
  const matchesCategoryKeywords = (p: Post, category: string): boolean => {
    const captionLower = p.caption?.toLowerCase() || '';
    const materialsLower = p.materials?.map(m => m.toLowerCase()).join(' ') || '';
    const toolsLower = p.tools?.map(t => t.toLowerCase()).join(' ') || '';
    const combined = `${captionLower} ${materialsLower} ${toolsLower}`;

    switch (category) {
      case 'textiles-fiber': return combined.includes('textile') || combined.includes('fiber') || combined.includes('weave') || combined.includes('fabric') || combined.includes('sew');
      case 'woodwork': return combined.includes('wood') || combined.includes('carve') || combined.includes('timber') || combined.includes('oak');
      case 'ceramics-pottery': return combined.includes('ceramic') || combined.includes('potter') || combined.includes('clay') || combined.includes('glaze');
      case 'jewelry-accessories': return combined.includes('jewelry') || combined.includes('ring') || combined.includes('necklace') || combined.includes('gem');
      case 'crochet-knitting': return combined.includes('crochet') || combined.includes('knit') || combined.includes('yarn') || combined.includes('wool');
      case 'leatherwork': return combined.includes('leather') || combined.includes('wallet') || combined.includes('stitch');
      case 'metalwork': return combined.includes('metal') || combined.includes('forge') || combined.includes('weld') || combined.includes('iron');
      case 'painting-visual': return combined.includes('paint') || combined.includes('canvas') || combined.includes('acrylic') || combined.includes('watercolor');
      case 'home-decor-crafts': return combined.includes('decor') || combined.includes('vase') || combined.includes('furniture') || combined.includes('candle');
      case 'basketry-natural': return combined.includes('basket') || combined.includes('reed') || combined.includes('bamboo');
      case 'cultural-traditional': return combined.includes('traditional') || combined.includes('heritage') || combined.includes('folk');
      case 'handmade-toys': return combined.includes('toy') || combined.includes('doll') || combined.includes('plush');
      case 'lifestyle-crafts': return combined.includes('soap') || combined.includes('candle') || combined.includes('incense');
      default: return false;
    }
  };

  const applyAllFilters = (allPosts: Post[], type: 'all' | 'finished' | 'wip', category: string, matchedIds: string[] | null | 'fallback') => {
    let result = allPosts;
    if (type !== 'all') result = result.filter(p => p.post_type === type);
    if (category !== 'all') {
      result = result.filter(p => {
        if (p.category === category) return true;
        return matchesCategoryKeywords(p, category);
      });
    }
    if (matchedIds === 'fallback' || (!matchedIds && activeSearchQuery.trim())) {
      const q = activeSearchQuery.toLowerCase().trim();
      result = result.filter(p => 
        p.caption?.toLowerCase().includes(q) ||
        p.author_name?.toLowerCase().includes(q) ||
        p.materials?.some(m => m.toLowerCase().includes(q))
      );
    } else if (Array.isArray(matchedIds)) {
      result = matchedIds.map(id => result.find(p => p.id === id)).filter(Boolean) as Post[];
    }
    setFilteredPosts(result);
  };

  useEffect(() => {
    const delaySearch = setTimeout(async () => {
      if (!activeSearchQuery.trim()) {
        applyAllFilters(posts, filterType, selectedCategory, null);
        return;
      }
      setSearchLoading(true);
      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: activeSearchQuery, posts })
        });
        const data = await response.json();
        if (data.matchedIds && Array.isArray(data.matchedIds)) {
          applyAllFilters(posts, filterType, selectedCategory, data.matchedIds);
        } else {
          applyAllFilters(posts, filterType, selectedCategory, []);
        }
      } catch (err) {
        console.error("Semantic search failed", err);
        applyAllFilters(posts, filterType, selectedCategory, 'fallback');
      } finally {
        setSearchLoading(false);
      }
    }, 600);
    return () => clearTimeout(delaySearch);
  }, [activeSearchQuery, posts, filterType, selectedCategory]);

  const handleTypeFilterChange = (type: 'all' | 'finished' | 'wip') => {
    setFilterType(type);
    applyAllFilters(posts, type, selectedCategory, null);
  };

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    applyAllFilters(posts, filterType, category, null);
  };

  const handleLike = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!user) { onOpenAuth(); return; }
    try {
      await incrementLikes(postId);
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
      setFilteredPosts(prev => prev.map(p => p.id === postId ? { ...p, likes_count: (p.likes_count || 0) + 1 } : p));
      
      const targetPost = posts.find(p => p.id === postId);
      if (targetPost && targetPost.user_id !== user.uid) {
        await createNotification({
          user_id: targetPost.user_id,
          sender_name: profile?.full_name || user.displayName || 'Artisan',
          sender_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          type: 'like',
          post_id: targetPost.id,
          post_image: targetPost.image_url,
          content: lang === 'am' ? `ልጥፍዎን ወደውል!` : `liked your craft pin "${targetPost.caption?.slice(0, 30)}..."`
        });
      }
    } catch (err) { console.error(err); }
  };

  const handleSave = async (e: React.MouseEvent, postId: string) => {
    e.stopPropagation();
    if (!user) { onOpenAuth(); return; }
    try {
      await savePostToBoard(user.uid, postId);
    } catch (err) { console.error(err); }
  };

  // ANTI-FRAUD BUY FLOW
  const handleBuyClick = (e: React.MouseEvent, post: Post) => {
    e.stopPropagation();
    if (!user) { onOpenAuth(); return; }
    
    // Secure commission flow: Redirect to Telegram Bot
    // The bot handles payment verification BEFORE revealing maker contact info
    const botUsername = 'mari_beeee'; // Your verified bot
    const startParam = `buy_${post.id}_${user.uid}`;
    window.open(`https://t.me/${botUsername}?start=${startParam}`, '_blank');
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800 * 1024) {
        setFormError('Image too large. Max 800KB.');
        return;
      }
      setFormError('');
      const reader = new FileReader();
      reader.onloadend = () => setNewImgUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const addMaterial = () => {
    if (newMaterial.trim()) {
      setNewMaterialsList([...newMaterialsList, newMaterial.trim()]);
      setNewMaterial('');
    }
  };

  const addTool = () => {
    if (newTool.trim()) {
      setNewToolsList([...newToolsList, newTool.trim()]);
      setNewTool('');
    }
  };

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!newImgUrl) { setFormError('Please upload an image.'); return; }
    if (!newCaption.trim()) { setFormError('Please enter a description.'); return; }

    setSubmittingPost(true);
    try {
      await addPost({
        user_id: user.uid,
        author_name: profile?.full_name || user.displayName || 'Artisan',
        author_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        image_url: newImgUrl,
        caption: newCaption,
        post_type: newPostType,
        category: newCategory,
        materials: newMaterialsList,
        tools: newToolsList,
        created_at: new Date().toISOString()
      });
      setIsCreateModalOpen(false);
      setNewCaption(''); setNewImgUrl(''); setNewMaterialsList([]); setNewToolsList([]);
      await loadPosts();
    } catch (err: any) {
      setFormError(err.message || 'Error publishing post');
    } finally {
      setSubmittingPost(false);
    }
  };

  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] hover:bg-opacity-90 text-black' : 'bg-[#E07A5F] hover:bg-opacity-90 text-white';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-[#FAF7F0] border-[#EBE7DF]';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 md:pb-6 overflow-y-auto">
      
      {/* Header with Literary Search */}
      <div className="flex flex-col items-center mb-6 gap-4">
        <div className="w-full max-w-2xl relative">
          <div className="absolute left-5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
            <Search className="w-5 h-5" />
            <Sparkles className={`w-3.5 h-3.5 ${activeColor} animate-pulse`} />
          </div>
          <input
            type="text"
            value={activeSearchQuery}
            onChange={(e) => setActiveSearchQuery(e.target.value)}
            placeholder="Try natural language, e.g. 'cozy warm ceramic mugs for morning tea'..."
            className={`w-full pl-14 pr-12 py-3.5 rounded-full border text-sm outline-none transition-all shadow-md ${
              isDarkMode ? 'bg-[#1A1A1A] border-[#2D2D2D] focus:border-[#D4AF37] text-white' : 'bg-[#FAF7F0] border-[#EBE7DF] focus:border-[#E07A5F] text-black'
            }`}
          />
          {searchLoading && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className={`w-5 h-5 rounded-full border-2 border-t-transparent animate-spin ${isDarkMode ? 'border-[#D4AF37]' : 'border-[#E07A5F]'}`} />
            </div>
          )}
        </div>
      </div>

      {/* Category Filters */}
      {mode === 'explore' ? (
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {CRAFT_CATEGORIES.filter(c => c.id !== 'all').map((cat) => (
            <button key={cat.id} onClick={() => handleCategoryChange(cat.id)} 
              className={`p-4 rounded-2xl border text-left transition-all hover:scale-[1.02] ${cardBg} ${selectedCategory === cat.id ? `ring-2 ${isDarkMode ? 'ring-[#D4AF37]' : 'ring-[#E07A5F]'}` : ''}`}>
              <span className="text-2xl block mb-2">{cat.emoji}</span>
              <span className={`text-xs font-bold ${textPrimary}`}>{cat.name}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="w-full mb-6 overflow-x-auto scrollbar-none">
          <div className="flex items-center gap-2 pb-2">
            {CRAFT_CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => handleCategoryChange(cat.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id ? activeBg + ' shadow-sm' : 'bg-black/5 dark:bg-white/5 text-gray-600 dark:text-gray-300'
                }`}>
                <span>{cat.emoji}</span><span>{cat.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Type Filters & Create Button */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 border-b pb-4 border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {(['all', 'finished', 'wip'] as const).map((type) => (
            <button key={type} onClick={() => handleTypeFilterChange(type)}
              className={`px-4 py-2 rounded-full text-xs font-semibold capitalize transition-all ${
                filterType === type ? activeBg + ' shadow' : 'bg-gray-100 dark:bg-[#242424] text-gray-600 dark:text-gray-300'
              }`}>
              {type === 'all' ? 'All Creations' : type === 'finished' ? 'Finished Work' : 'Work in Progress'}
            </button>
          ))}
        </div>
        <button onClick={() => user ? setIsCreateModalOpen(true) : onOpenAuth()}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow ${user ? activeBg : 'bg-gray-200 dark:bg-[#242424] text-gray-600 dark:text-gray-300'}`}>
          <Plus className="w-4 h-4" /> {user ? 'Share Craft / WIP' : 'Sign In to Post'}
        </button>
      </div>

      {/* Masonry Feed */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className={`w-8 h-8 rounded-full border-4 border-t-transparent animate-spin ${isDarkMode ? 'border-[#D4AF37]' : 'border-[#E07A5F]'}`} />
        </div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <h3 className={`text-lg font-bold ${textPrimary}`}>No crafts found</h3>
          <p className={`text-sm ${textSecondary}`}>Try adjusting your filters or search query.</p>
        </div>
      ) : (
        <>
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 space-y-4 mb-12">
            {filteredPosts.map((post) => (
              <div key={post.id} onClick={() => onSelectPost(post)}
                className={`break-inside-avoid relative rounded-2xl overflow-hidden border group cursor-pointer transition-all hover:shadow-xl hover:scale-[1.01] ${cardBg}`}>
                
                {/* Image Area */}
                <div className="relative overflow-hidden aspect-[4/5] bg-gray-100 dark:bg-gray-800">
                  <img src={post.image_url} alt={post.caption} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  
                  {/* Badges */}
                  <div className="absolute top-3 left-3 flex gap-2">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wider ${
                      post.post_type === 'wip' ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'
                    }`}>{post.post_type === 'wip' ? 'WIP' : 'FINISHED'}</span>
                  </div>

                  {/* Hover Overlay Actions */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <img src={post.author_avatar} className="w-8 h-8 rounded-full border-2 border-white" />
                        <span className="text-white text-xs font-bold truncate max-w-[100px]">{post.author_name}</span>
                      </div>
                      {/* SECURE BUY BUTTON */}
                      <button onClick={(e) => handleBuyClick(e, post)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-black text-[10px] font-bold hover:bg-gray-100 transition-colors">
                        <ShieldCheck className="w-3 h-3" /> Buy Safe
                      </button>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-white/20">
                      <div className="flex gap-3 text-white">
                        <button onClick={(e) => handleLike(e, post.id)} className="flex items-center gap-1 text-xs hover:text-red-400">
                          <Heart className={`w-4 h-4 ${post.is_liked ? 'fill-red-400 text-red-400' : ''}`} /> {post.likes_count}
                        </button>
                        <div className="flex items-center gap-1 text-xs"><MessageCircle className="w-4 h-4" /> {post.comments_count}</div>
                      </div>
                      <button onClick={(e) => handleSave(e, post.id)} className="text-white hover:text-yellow-400">
                        <Bookmark className={`w-4 h-4 ${post.is_saved ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card Content */}
                <div className="p-4">
                  <p className={`text-xs line-clamp-3 mb-3 ${textPrimary}`}>{post.caption}</p>
                  {post.materials?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {post.materials.slice(0,3).map((m,i) => (
                        <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 font-medium text-gray-600 dark:text-gray-300">#{m}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* ARTISAN STREAK FEATURE */}
          {user && (
            <div className={`max-w-2xl mx-auto rounded-3xl p-6 border ${cardBg} mb-8`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-2xl ${isDarkMode ? 'bg-orange-500/20' : 'bg-orange-100'}`}>
                    <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
                  </div>
                  <div>
                    <h3 className={`font-bold ${textPrimary}`}>Artisan Streak</h3>
                    <p className={`text-xs ${textSecondary}`}>Keep crafting daily to maintain your fire!</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-black ${activeColor}`}>{streak}</span>
                  <span className={`text-xs font-bold ml-1 ${textSecondary}`}>DAY{streak !== 1 ? 'S' : ''}</span>
                </div>
              </div>
              
              {/* Streak Progress Bar */}
              <div className="relative h-3 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                <div className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${isDarkMode ? 'bg-gradient-to-r from-orange-500 to-yellow-500' : 'bg-gradient-to-r from-orange-400 to-red-500'}`}
                  style={{ width: `${Math.min((streak / 30) * 100, 100)}%` }} />
              </div>
              <div className="flex justify-between mt-2 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                <span>Started</span>
                <span>7 Days 🔥</span>
                <span>30 Days 🏆</span>
              </div>
              
              {lastActiveDate && (
                <p className={`text-[10px] text-center mt-4 ${textSecondary}`}>
                  Last active: {new Date(lastActiveDate).toLocaleDateString()} • Next milestone: {30 - streak} days
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Create Post Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={`relative w-full max-w-lg rounded-2xl p-6 shadow-2xl border max-h-[90vh] overflow-y-auto ${cardBg}`}>
            <button onClick={() => setIsCreateModalOpen(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/10">
              <X className="w-5 h-5 text-gray-500" />
            </button>
            
            <h3 className={`text-xl font-bold mb-6 ${textPrimary}`}>Share Your Craft</h3>
            
            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> {formError}
              </div>
            )}

            <form onSubmit={handleCreatePost} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['finished', 'wip'] as const).map(type => (
                  <button key={type} type="button" onClick={() => setNewPostType(type)}
                    className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                      newPostType === type ? `${activeBg} ${isDarkMode ? 'border-[#D4AF37]' : 'border-[#E07A5F]'}` : 'border-gray-200 dark:border-gray-700 text-gray-500'
                    }`}>{type === 'finished' ? 'Finished Masterpiece' : 'Work in Progress'}</button>
                ))}
              </div>

              <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
                className={`w-full px-4 py-2.5 rounded-xl border text-xs outline-none ${isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white' : 'bg-[#FAF7F0] border-[#EBE7DF] text-black'}`}>
                {CRAFT_CATEGORIES.filter(c => c.id !== 'all').map(c => (
                  <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                ))}
              </select>

              <div className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${newImgUrl ? 'border-[#E07A5F] dark:border-[#D4AF37]' : 'border-gray-300 dark:border-gray-700'}`}>
                <input type="file" accept="image/*" onChange={handleImageFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                {newImgUrl ? (
                  <div className="relative">
                    <img src={newImgUrl} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                    <button type="button" onClick={() => setNewImgUrl('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1"><X className="w-3 h-3" /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ImageIcon className="w-8 h-8" />
                    <p className="text-xs font-bold">Upload Image (Max 800KB)</p>
                  </div>
                )}
              </div>

              <textarea rows={3} required placeholder="Describe your process..." value={newCaption} onChange={e => setNewCaption(e.target.value)}
                className={`w-full px-4 py-3 rounded-xl border text-xs outline-none resize-none ${isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white' : 'bg-[#FAF7F0] border-[#EBE7DF] text-black'}`} />

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${textSecondary}`}>Materials</label>
                  <div className="flex gap-1 mb-2">
                    <input type="text" placeholder="e.g. Clay" value={newMaterial} onChange={e => setNewMaterial(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addMaterial())}
                      className={`flex-1 px-2 py-1.5 rounded-lg border text-xs outline-none ${isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white' : 'bg-[#FAF7F0] border-[#EBE7DF] text-black'}`} />
                    <button type="button" onClick={addMaterial} className={`px-3 rounded-lg text-xs font-bold ${activeBg}`}>+</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newMaterialsList.map((m,i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 flex items-center gap-1">
                        {m}<button type="button" onClick={() => setNewMaterialsList(newMaterialsList.filter((_,idx)=>idx!==i))} className="text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={`block text-[10px] font-bold uppercase mb-1 ${textSecondary}`}>Tools</label>
                  <div className="flex gap-1 mb-2">
                    <input type="text" placeholder="e.g. Chisel" value={newTool} onChange={e => setNewTool(e.target.value)} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTool())}
                      className={`flex-1 px-2 py-1.5 rounded-lg border text-xs outline-none ${isDarkMode ? 'bg-[#242424] border-[#2D2D2D] text-white' : 'bg-[#FAF7F0] border-[#EBE7DF] text-black'}`} />
                    <button type="button" onClick={addTool} className={`px-3 rounded-lg text-xs font-bold ${activeBg}`}>+</button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {newToolsList.map((t,i) => (
                      <span key={i} className="text-[9px] px-2 py-0.5 rounded bg-black/5 dark:bg-white/10 flex items-center gap-1">
                        {t}<button type="button" onClick={() => setNewToolsList(newToolsList.filter((_,idx)=>idx!==i))} className="text-red-500">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <button type="submit" disabled={submittingPost} className={`w-full py-3 rounded-xl font-bold text-xs transition-all shadow-lg ${activeBg}`}>
                {submittingPost ? 'Publishing...' : 'Publish to Feed'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}