import React, { useState, useEffect } from 'react';
import { Post, Comment, UserProfile } from '../types';
import { fetchComments, addComment, createNotification } from '../lib/services';
import { X, Send, Heart, Layers, Wrench, MessageSquare, ShieldCheck, Mail } from 'lucide-react';
import { Language, translations } from '../lib/translations';

interface PinDetailModalProps {
  post: Post | null;
  onClose: () => void;
  user: any;
  profile: UserProfile | null;
  onOpenAuth: () => void;
  isDarkMode: boolean;
  onMessageMaker: (makerId: string, makerName: string) => void;
  lang: Language;
}

export default function PinDetailModal({
  post,
  onClose,
  user,
  profile,
  onOpenAuth,
  isDarkMode,
  onMessageMaker,
  lang
}: PinDetailModalProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [loadingComments, setLoadingComments] = useState(true);

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
        avatar_url: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
        content: newCommentText.trim()
      };

      await addComment(post.id, commentData);
      
      // Create a real-time Notification in the database for the post author!
      if (post.user_id !== user.uid) {
        await createNotification({
          user_id: post.user_id,
          sender_name: profile?.full_name || user.displayName || 'Artisan',
          sender_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`,
          type: 'comment',
          post_id: post.id,
          post_image: post.image_url,
          content: lang === 'am'
            ? `በልጥፍዎ ላይ አስተያየት ሰጥተዋል: "${newCommentText.trim().slice(0, 30)}..."`
            : `commented on your craft pin: "${newCommentText.trim().slice(0, 30)}..."`
        });
      }
      
      // Update local comment list
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
        sender_avatar: profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid || 'buyer'}`,
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

  const t = translations[lang];
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] hover:bg-opacity-90 text-black' : 'bg-[#E07A5F] hover:bg-opacity-90 text-white';
  const activeBorder = isDarkMode ? 'border-[#D4AF37]' : 'border-[#E07A5F]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div 
        id="pin-detail-card"
        className={`relative w-full max-w-4xl rounded-3xl p-0 overflow-hidden shadow-2xl border flex flex-col md:flex-row max-h-[90vh] transition-all duration-300 ${
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
          {/* Subtle Permanent Anti-Piracy Watermark Overlay */}
          <div className="absolute bottom-4 left-4 select-none pointer-events-none text-white/40 text-[9px] tracking-widest font-mono border border-white/10 bg-black/20 px-2 py-0.5 rounded-md">
            WING Anti-Draggable Lock Active
          </div>
        </div>

        {/* Right Side: Details & Interaction */}
        <div className="w-full md:w-1/2 flex flex-col h-full overflow-y-auto p-6 md:p-8 max-h-[50vh] md:max-h-[90vh]">
          {/* Top section: Maker Profile */}
          <div className="flex items-center justify-between pb-4 border-b border-black/5 dark:border-white/5 mb-6">
            <div className="flex items-center gap-3">
              <img
                src={post.author_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${post.user_id}`}
                alt={post.author_name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-full border border-gray-400"
              />
              <div>
                <h4 className="text-sm font-bold">{post.author_name}</h4>
                <p className="text-[10px] opacity-60">Creator Studio Maker</p>
              </div>
            </div>

            {/* Message Maker & Telegram Coordinator Actions (if not messaging self) */}
            {user?.uid !== post.user_id && (
              <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                {/* Buy via Telegram Bot */}
                <a
                  id="telegram-contact-btn"
                  href={`https://t.me/WingArtisanBot?start=buy_${post.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleTelegramClick}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold shadow-md transition-all hover:scale-102 active:scale-98 text-white ${
                    isDarkMode ? 'bg-[#229ED9] hover:bg-[#229ED9]/90' : 'bg-[#0088cc] hover:bg-[#0088cc]/90'
                  }`}
                >
                  <Send className="w-3 h-3" />
                  <span>{t.contactSellerTelegram}</span>
                </a>

                {/* Direct Message on Site */}
                <button
                  id="message-maker-btn"
                  onClick={() => onMessageMaker(post.user_id, post.author_name)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-full text-[11px] font-bold shadow transition-all focus:scale-95 duration-150 ${activeBg}`}
                >
                  <Mail className="w-3 h-3" />
                  <span>{t.contactSellerWeb}</span>
                </button>
              </div>
            )}
          </div>

          {/* Body Caption & Badges */}
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

          {/* Materials & Tools grids */}
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

          {/* Comments Section */}
          <div className="flex-1 flex flex-col min-h-[200px] border-t border-black/5 dark:border-white/5 pt-4">
            <h5 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4" /> Discussion ({comments.length})
            </h5>

            {/* List */}
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
                              id={`message-commenter-${comm.id}`}
                              type="button"
                              onClick={() => {
                                onClose(); // Close pin modal first
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

            {/* Input form */}
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
