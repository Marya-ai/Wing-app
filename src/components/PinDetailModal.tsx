import React, { useState, useEffect } from 'react';
import { Post, Comment, UserProfile } from '../types';
import { fetchComments, addComment, createNotification } from '../lib/services';
import { X, Send, Heart, Layers, Wrench, MessageSquare, ShieldCheck, Mail, ShoppingCart, Bookmark } from 'lucide-react';
import { Language, translations } from '../lib/translations';
import { getUserAvatar, getPostAuthorAvatar } from '../lib/avatarUtils';

interface PinDetailModalProps {
  post: Post | null;
  onClose: () => void;
  user: any;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  isDarkMode: boolean;
  onMessageMaker: (makerId: string, makerName: string) => void;
  lang: Language;
  onOpenCheckout?: (post: Post) => void; // NEW: Triggers the buying flow
  onToggleSave?: (postId: string, isSaved: boolean) => void; // NEW: Triggers save for later
}

export default function PinDetailModal({
  post,
  onClose,
  user,
  profile,
  onOpenAuth,
  isDarkMode,
  onMessageMaker,
  lang,
  onOpenCheckout,
  onToggleSave
}: PinDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);
  
  // NEW: State to hold the Telegram profile photo URL
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState<string | undefined>();

  // NEW: Engagement States
  const [isSaved, setIsSaved] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(post?.likes_count || 0);

  // NEW: Fetch Telegram photo on mount
  useEffect(() => {
    if (window.Telegram?.WebApp?.initDataUnsafe?.user?.photo_url) {
      setTelegramPhotoUrl(window.Telegram.WebApp.initDataUnsafe.user.photo_url);
    }
  }, []);

  useEffect(() => {
    if (!post) return;
    
    const loadComments = async () => {
      setLoadingComments(true);
      try {
        const list = await fetchComments(post.id);
        setComments(list);
      } catch (err) {
        console.error("Failed to load comments", err);
      } finally {
        setLoadingComments(false);
      }
    };

    loadComments();
  }, [post]);

  if (!post) return null;

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }
    if (!newCommentText.trim()) return;

    setSubmittingComment(true);
    try {
      const commentData = {
        post_id: post.id,
        user_id: user.uid,
        username: profile?.full_name || user.displayName || 'Artisan',
        avatar_url: getUserAvatar(profile, telegramPhotoUrl),
        content: newCommentText.trim()
      };

      await addComment(post.id, commentData);
      
      if (post.user_id !== user.uid) {
        await createNotification({
          user_id: post.user_id,
          sender_name: profile?.full_name || user.displayName || 'Artisan',
          sender_avatar: getUserAvatar(profile, telegramPhotoUrl),
          type: 'comment',
          post_id: post.id,
          post_image: post.image_url,
          content: lang === 'am'
            ? `በልጥፍዎ ላይ አስተያየት ሰጥተዋል: "${newCommentText.trim().slice(0, 30)}..."`
            : `commented on your craft pin: "${newCommentText.trim().slice(0, 30)}..."`
        });
      }
      
      setComments(prev => [...prev, {
        id: `temp_${Date.now()}`,
        ...commentData,
        created_at: new Date().toISOString()
      }]);
      setNewCommentText('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleTelegramClick = async () => {
    try {
      await createNotification({
        user_id: post.user_id,
        sender_name: profile?.full_name || user?.displayName || 'Artisan Buyer',
        sender_avatar: getUserAvatar(profile, telegramPhotoUrl),
        type: 'telegram',
        post_id: post.id,
        post_image: post.image_url,
        content: lang === 'am'
          ? `በቴሌግራም መግዛት ይፈልጋሉ! ምርት: "${post.caption.slice(0, 30)}..."`
          : `is interested in buying your craft "${post.caption.slice(0, 30)}..." and clicked Contact via Telegram!`
      });
    } catch (err) {
      console.error("Failed to record Telegram contact notification:", err);
    }
  };

  // NEW: Handle Save for Later
  const handleSaveForLater = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    const newState = !isSaved;
    setIsSaved(newState);
    if (onToggleSave) {
      onToggleSave(post.id, newState);
    }
  };

  // NEW: Handle Like
  const handleLike = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    const newState = !isLiked;
    setIsLiked(newState);
    setLikesCount(prev => newState ? prev + 1 : prev - 1);
    // In a full implementation, you would call an API here: await likePost(post.id);
  };

  // NEW: Handle Purchase Now
  const handlePurchaseNow = () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    if (onOpenCheckout) {
      onOpenCheckout(post);
    } else {
      console.log("Proceeding to checkout for:", post.id);
      // Fallback alert if parent component hasn't implemented onOpenCheckout yet
      alert("Checkout flow will open here!");
    }
  };

  const t = translations[lang];
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] hover:bg-opacity-90 text-black' : 'bg-[#E07A5F] hover:bg-opacity-90 text-white';
  
  const userAvatar = getUserAvatar(profile, telegramPhotoUrl);
  const postAuthorAvatar = getPostAuthorAvatar(post.user_id, post.author_avatar);
  
  // Safe fallback for stock quantity
  const availableStock = post.stock_quantity ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        id="pin-detail-card"
        className={`relative w-full max-w-5xl rounded-3xl p-0 overflow-hidden shadow-2xl border flex flex-col md:flex-row max-h-[90vh] transition-all duration-300 ${
          isDarkMode 
            ? 'bg-[#1A1A1A] text-[#EAEAEA] border-[#2D2D2D]' 
            : 'bg-[#FDFBF7] text-[#2C2C2C] border-[#EBE7DF]'
        }`}
      >
        {/* Close Button */}
        <button 
          id="close-pin-modal"
          onClick={onClose}
          className={`absolute top-4 right-4 z-10 p-1.5 rounded-full bg-black/40 hover:bg-black/65 text-white transition-colors`}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left Side: Large Image with Copyright Protections */}
        <div 
          className="w-full md:w-1/2 bg-black/20 flex items-center justify-center select-none pointer-events-none relative"
          onContextMenu={(e) => e.preventDefault()}
        >
          <img
            src={post.image_url}
            alt={post.caption}
            draggable="false"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover max-h-[50vh] md:max-h-[90vh]"
            style={{ pointerEvents: 'none' }}
          />
          <div className="absolute bottom-4 left-4 select-none pointer-events-none text-white/40 text-[9px] tracking-widest font-mono border border-white/10 bg-black/20 px-2 py-0.5 rounded-md">
            WING Anti-Draggable Lock Active
          </div>
        </div>

        {/* Right Side: Details & Interaction */}
        <div className="w-full md:w-1/2 flex flex-col h-full overflow-y-auto p-6 md:p-8 max-h-[50vh] md:max-h-[90vh]">
          
          {/* 1. Maker Profile */}
          <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={postAuthorAvatar}
                alt={post.author_name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full border border-gray-400"
              />
              <div>
                <h4 className="text-sm font-bold">{post.author_name}</h4>
                <p className="text-[10px] opacity-60">Creator Studio Maker</p>
              </div>
            </div>

            {user?.uid !== post.user_id && (
              <button
                onClick={() => onMessageMaker(post.user_id, post.author_name)}
                className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold shadow transition-all focus:scale-95 duration-150 ${activeBg}`}
              >
                <Mail className="w-3 h-3" />
                <span>{t.contactSellerWeb || 'Message Maker'}</span>
              </button>
            )}
          </div>

          {/* 2. Caption & Badges */}
          <div className="space-y-4 mb-6">
            <div className="flex items-center gap-2">
              <span className={`text-[9px] px-2.5 py-1 rounded-full font-bold tracking-wider uppercase ${
                post.post_type === 'wip' 
                  ? 'bg-amber-500 text-white' 
                  : (isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white')
              }`}>
                {post.post_type === 'wip' ? 'Work in Progress' : 'Finished Creation'}
              </span>
              <span className="text-[10px] text-gray-400 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> Original Artisan Craft
              </span>
            </div>
            <p className="text-sm leading-relaxed whitespace-pre-line opacity-90">
              {post.caption}
            </p>
          </div>

          {/* 3. MODERN WING BUY BOX (Amazon-style) */}
          <div className={`p-6 rounded-3xl border mb-6 transition-all ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className={`text-3xl font-black ${activeColor}`}>{post.price.toLocaleString()} ETB</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">Includes WING Buyer Protection</p>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-500" />
                  <span>Verified Seller</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2 mb-5 text-sm">
              <div className={`w-2.5 h-2.5 rounded-full ${availableStock > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span className={`font-bold ${availableStock > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {availableStock > 0 ? `In Stock (${availableStock} available)` : 'Currently Out of Stock'}
              </span>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handlePurchaseNow}
                disabled={availableStock === 0}
                className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  availableStock === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : activeBg
                }`}
              >
                <ShoppingCart className="w-5 h-5" />
                Purchase Now
              </button>
              
              <button 
                onClick={handleSaveForLater}
                className={`w-full py-3.5 rounded-2xl font-bold text-sm uppercase tracking-wider border-2 transition-all active:scale-[0.98] flex items-center justify-center gap-2 ${
                  isSaved 
                    ? 'border-green-500 text-green-600 bg-green-500/10' 
                    : isDarkMode ? 'border-gray-700 text-gray-300 hover:bg-gray-800' : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-current' : ''}`} />
                {isSaved ? 'Saved for Later' : 'Save for Later'}
              </button>
            </div>
          </div>

          {/* 4. Materials & Tools grids */}
          <div className="grid grid-cols-2 gap-4 mb-6 p-4 rounded-2xl bg-black/5 dark:bg-white/5">
            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 opacity-80">
                <Layers className={`w-3.5 h-3.5 ${activeColor}`} /> Materials
              </h5>
              {post.materials && post.materials.length > 0 ? (
                <ul className="text-xs space-y-1 pl-1">
                  {post.materials.map((mat, i) => (
                    <li key={i} className="list-disc list-inside opacity-75">{mat}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-gray-400">Pure handcrafted</p>
              )}
            </div>

            <div>
              <h5 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 opacity-80">
                <Wrench className={`w-3.5 h-3.5 ${activeColor}`} /> Studio Tools
              </h5>
              {post.tools && post.tools.length > 0 ? (
                <ul className="text-xs space-y-1 pl-1">
                  {post.tools.map((tool, i) => (
                    <li key={i} className="list-disc list-inside opacity-75">{tool}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-[10px] text-gray-400">Manual crafting methods</p>
              )}
            </div>
          </div>

          {/* 5. Social Proof & Comments Section */}
          <div className="flex-1 flex flex-col min-h-[200px] border-t border-black/5 dark:border-white/5 pt-4">
            
            {/* Social Proof Bar */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-black/5 dark:border-white/5">
              <button 
                onClick={handleLike}
                className={`flex items-center gap-2 text-sm font-bold transition-all ${isLiked ? 'text-red-500' : 'text-gray-500 hover:text-red-500'}`}
              >
                <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                {likesCount} Likes
              </button>
              <div className="flex items-center gap-2 text-sm font-bold text-gray-500">
                <MessageSquare className="w-5 h-5" />
                {comments.length} Comments
              </div>
            </div>

            <h5 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Discussion
            </h5>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[220px] pr-2 mb-4">
              {loadingComments ? (
                <div className="py-6 text-center text-xs text-gray-400 font-mono">Loading thoughts...</div>
              ) : comments.length === 0 ? (
                <div className="py-10 text-center text-xs text-gray-400 font-medium">
                  Be the first to leave an encouraging word or ask a question about techniques!
                </div>
              ) : (
                comments.map((comm) => (
                  <div key={comm.id} className="flex gap-2.5 items-start">
                    <img
                      src={comm.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${comm.user_id}`}
                      alt={comm.username}
                      referrerPolicy="no-referrer"
                      className="w-7 h-7 rounded-full border border-gray-400 shrink-0"
                    />
                    <div className="flex-1 p-3 rounded-2xl text-xs bg-black/5 dark:bg-white/5">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold">{comm.username}</span>
                          {user?.uid !== comm.user_id && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onMessageMaker(comm.user_id, comm.username);
                              }}
                              className="p-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full transition-colors text-gray-500 hover:text-amber-500 cursor-pointer"
                              title={`Direct Message ${comm.username}`}
                            >
                              <Mail className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        <span className="text-[9px] opacity-40">
                          {comm.created_at ? new Date(comm.created_at).toLocaleDateString() : 'Just now'}
                        </span>
                      </div>
                      <p className="opacity-90 leading-relaxed">{comm.content}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Comment Input Form */}
            <form onSubmit={handleAddComment} className="flex gap-2">
              <input
                id="comment-input"
                type="text"
                placeholder={user ? "Write a warm comment..." : "Sign in to join discussion"}
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                disabled={!user || submittingComment}
                className={`flex-1 px-4 py-2.5 rounded-full border text-xs outline-none transition-all ${
                  isDarkMode 
                    ? 'bg-[#242424] border-[#2D2D2D] focus:border-[#D4AF37] text-white' 
                    : 'bg-[#FAF7F0] border-[#EBE7DF] focus:border-[#E07A5F] text-black'
                } disabled:opacity-50`}
              />
              <button
                id="submit-comment"
                type="submit"
                disabled={!user || submittingComment || !newCommentText.trim()}
                className={`p-2.5 rounded-full transition-all duration-150 focus:scale-95 ${activeBg} disabled:opacity-50 flex items-center justify-center`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}