import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../lib/firebase';
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch, getDoc } from 'firebase/firestore';
import { Notification, Post } from '../types';
import { translations, Language } from '../lib/translations';
import { 
  Bell, Heart, MessageSquare, ShieldCheck, Send, ArrowRight, 
  UserPlus, Sparkles, CheckCircle2, Loader2, Eye, ExternalLink 
} from 'lucide-react';

interface NotificationsProps {
  user: any;
  isDarkMode: boolean;
  lang?: Language; // Made optional to prevent crash
  onOpenAuth?: () => void; // Made optional
  onSelectPost?: (post: Post) => void; // Made optional
  posts?: Post[]; // Made optional
}

// Helper for relative time formatting
const getRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export default function Notifications({
  user,
  isDarkMode,
  lang = 'en', // Default to 'en' if not provided
  onOpenAuth,
  onSelectPost,
  posts = [] // Default to empty array
}: NotificationsProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingRead, setMarkingRead] = useState(false);
  
  // Safe translation fallback
  const t = translations[lang as Language] || translations['en'];

  // Derived state for unread count
  const unreadCount = useMemo(() => notifications.filter(n => !n.read).length, [notifications]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', user.uid),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list: Notification[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Notification);
      });

      // Inject starter notifications if completely empty
      if (list.length === 0) {
        const systemNotif: Notification = {
          id: 'welcome-notif',
          user_id: user.uid,
          sender_name: 'Wing Guide 🦉',
          sender_avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150',
          type: 'system',
          content: lang === 'am' 
            ? 'እንኳን ደህና መጡ! በዊንግ ላትፎርም የተሰሩ የእደ-ጥበብ ስራዎችን ያሳዩ ከሌሎች ባለያዎች ጋር ወያዩ' 
            : 'Welcome to WING Artisan Platform! Showcase your traditional craft, track WIP logs, and get feedback from masters.',
          created_at: new Date().toISOString(),
          read: false
        };
        
        const telegramNotif: Notification = {
          id: 'telegram-notif',
          user_id: user.uid,
          sender_name: 'Telegram Bot Coordinator 🤖',
          type: 'telegram',
          content: lang === 'am'
            ? 'ቅንብሮች ውስ የቴሌግራም መለያዎን ስገቡ፤ ዢዎች በቀላሉ እንዲያገኙዎት ይረዳል'
            : 'Add your Telegram Username under Settings so buyers can purchase your crafts directly through the Telegram bot privately!',
          created_at: new Date(Date.now() - 60000).toISOString(),
          read: false
        };

        setNotifications([systemNotif, telegramNotif]);
      } else {
        setNotifications(list);
      }
      setLoading(false);

      // Batch mark as read to avoid spamming writes
      const unreadIds = snapshot.docs.filter(d => !d.data().read).map(d => d.id);
      if (unreadIds.length > 0) {
        const batch = writeBatch(db);
        unreadIds.forEach(id => {
          batch.update(doc(db, 'notifications', id), { read: true });
        });
        batch.commit().catch(e => console.error("Failed to mark notifications as read:", e));
      }
    }, (err) => {
      console.error("Failed to subscribe to notifications:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user, lang]);

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notif => {
        if (!notif.read && notif.id !== 'welcome-notif' && notif.id !== 'telegram-notif') {
          batch.update(doc(db, 'notifications', notif.id), { read: true });
        }
      });
      await batch.commit();
    } catch (e) {
      console.error("Error marking all as read:", e);
    } finally {
      setMarkingRead(false);
    }
  };

  const handleNotifClick = async (notif: Notification) => {
    if (notif.post_id && onSelectPost) {
      const match = posts.find(p => p.id === notif.post_id);
      if (match) {
        onSelectPost(match);
      } else {
        try {
          const postDoc = await getDoc(doc(db, 'posts', notif.post_id));
          if (postDoc.exists()) {
            onSelectPost({ id: postDoc.id, ...postDoc.data() } as Post);
          } else {
            alert(lang === 'am' ? 'ይህ ልፍ አልተገኘም ወይም ተሰርዟል።' : 'This post could not be found or has been deleted.');
          }
        } catch (err) {
          console.error("Failed to fetch targeted pin:", err);
        }
      }
    }
  };

  // Theme Variables
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const cardBg = isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D] hover:border-[#3D3D3D]' : 'bg-white border-gray-100 hover:border-gray-200 shadow-sm';
  const textPrimary = isDarkMode ? 'text-gray-100' : 'text-gray-900';
  const textSecondary = isDarkMode ? 'text-gray-400' : 'text-gray-500';

  const getNotifIcon = (type: string) => {
    switch (type) {
      case 'like': return <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />;
      case 'comment': return <MessageSquare className="w-3.5 h-3.5 text-blue-500" />;
      case 'system': return <Sparkles className="w-3.5 h-3.5 text-amber-500" />;
      case 'telegram': return <Send className="w-3.5 h-3.5 text-sky-400" />;
      default: return <Bell className={`w-3.5 h-3.5 ${activeColor}`} />;
    }
  };

  return (
    <div className="flex-1 min-h-screen px-4 md:px-8 py-6 pb-24 md:pb-6 overflow-y-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-opacity-10 mb-8 transition-colors duration-200 border-gray-200 dark:border-gray-800">
        <div>
          <h2 className={`text-2xl font-bold tracking-tight mb-1 flex items-center gap-2 ${textPrimary}`}>
            <Bell className={`w-6 h-6 ${activeColor}`} /> {t.notifications || 'Notifications'}
          </h2>
          <p className={`text-sm ${textSecondary}`}>
            {lang === 'am' 
              ? 'ስለ እደ-ጥበብ ጥፎችዎ የተሰጡ አስተያየቶችን እና ማበራዊ ግንነቶችን እዚህ ከታተሉ' 
              : 'Track comments, likes, saves, and important updates to your creative crafts and studio profile.'}
          </p>
        </div>
        
        {/* Mark All Read Button */}
        {!loading && user && unreadCount > 0 && (
          <button 
            onClick={handleMarkAllRead}
            disabled={markingRead}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              isDarkMode ? 'bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20' : 'bg-[#E07A5F]/10 text-[#E07A5F] hover:bg-[#E07A5F]/20'
            }`}
          >
            {markingRead ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Eye className="w-3.5 h-3.5" />}
            Mark all as read ({unreadCount})
          </button>
        )}
      </div>

      {/* Content Area */}
      {!user ? (
        <div className={`p-12 rounded-3xl border border-dashed text-center max-w-xl mx-auto mt-12 transition-colors ${
          isDarkMode ? 'border-gray-800 bg-gray-900/30' : 'border-gray-200 bg-gray-50'
        }`}>
          <div className={`w-16 h-16 mx-auto mb-6 rounded-full flex items-center justify-center ${isDarkMode ? 'bg-gray-800' : 'bg-white shadow-sm'}`}>
            <Bell className={`w-8 h-8 opacity-50 ${textSecondary}`} />
          </div>
          <h3 className={`text-lg font-bold mb-2 ${textPrimary}`}>
            {lang === 'am' ? 'ማወቂያዎችን መመልከት ይቡ' : 'Sign in to see notifications'}
          </h3>
          <p className={`text-sm mb-8 leading-relaxed max-w-md mx-auto ${textSecondary}`}>
            {lang === 'am' 
              ? 'መለያዎን በማገናኘት ልጥፎችዎ ላይ የሚደረጉ መስተጋብሮችን፣ አስተያየቶችን እና የግል መልዕክቶችን በጽበት ይከታተሉ።' 
              : 'Sync your artisan wallet or sign up with an email to review real-time likes, comment threads, and buyer purchase requests.'}
          </p>
          {onOpenAuth && (
            <button
              onClick={onOpenAuth}
              className={`px-8 py-3 rounded-xl font-bold text-sm transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 ${
                isDarkMode ? 'bg-[#D4AF37] text-black hover:bg-[#E5C048]' : 'bg-[#E07A5F] text-white hover:bg-[#F08A6F]'
              }`}
            >
              {t.connectWallet || 'Sign In'}
            </button>
          )}
        </div>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-32 gap-4">
          <Loader2 className={`w-10 h-10 animate-spin ${activeColor}`} />
          <p className={`text-sm font-medium animate-pulse ${textSecondary}`}>Checking for updates...</p>
        </div>
      ) : notifications.length === 0 ? (
        // Beautiful Empty State
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center animate-in fade-in zoom-in duration-500">
          <div className={`mb-6 flex h-24 w-24 items-center justify-center rounded-full ring-1 shadow-inner ${
            isDarkMode ? 'bg-gray-800/50 ring-gray-700' : 'bg-gray-100 ring-gray-200'
          }`}>
            <CheckCircle2 className={`h-10 w-10 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`} />
          </div>
          <h3 className={`text-2xl font-black tracking-tight ${textPrimary}`}>All caught up!</h3>
          <p className={`mt-3 max-w-md text-base leading-relaxed ${textSecondary}`}>
            You have no new notifications right now. Keep crafting, sharing your WIPs, and engaging with the community—updates will appear here automatically.
          </p>
          <button className={`mt-8 flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition-colors ${
            isDarkMode ? 'bg-[#D4AF37]/10 text-[#D4AF37] hover:bg-[#D4AF37]/20' : 'bg-[#E07A5F]/10 text-[#E07A5F] hover:bg-[#E07A5F]/20'
          }`}>
            <Sparkles className="w-4 h-4" />
            Explore the Feed for Inspiration
          </button>
        </div>
      ) : (
        // Notification List
        <div className="max-w-2xl mx-auto space-y-3">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => handleNotifClick(notif)}
              className={`group p-4 rounded-2xl border transition-all duration-200 flex gap-4 ${cardBg} ${
                notif.post_id ? 'cursor-pointer active:scale-[0.99]' : ''
              } ${!notif.read ? (isDarkMode ? 'bg-[#1C1C1C]/80' : 'bg-blue-50/50 border-blue-100') : ''}`}
            >
              {/* Avatar & Icon Badge */}
              <div className="relative flex-shrink-0 pt-1">
                <img
                  src={notif.sender_avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${notif.id}`}
                  alt="sender"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-transparent group-hover:ring-offset-2 transition-all"
                  style={{ ringColor: isDarkMode ? '#2D2D2D' : '#ffffff' }}
                />
                <div className={`absolute -bottom-1 -right-1 p-1 rounded-full border shadow-sm ${
                  isDarkMode ? 'bg-[#1C1C1C] border-[#2D2D2D]' : 'bg-white border-gray-100'
                }`}>
                  {getNotifIcon(notif.type)}
                </div>
                {!notif.read && (
                  <div className="absolute top-0 left-0 w-3 h-3 bg-[#E07A5F] rounded-full border-2 border-white dark:border-[#1C1C1C]" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className={`text-sm font-bold truncate ${textPrimary}`}>
                    {notif.sender_name}
                  </span>
                  <span className={`text-[11px] font-mono whitespace-nowrap ${textSecondary}`}>
                    {getRelativeTime(notif.created_at)}
                  </span>
                </div>
                <p className={`text-sm leading-relaxed line-clamp-2 ${textSecondary}`}>
                  {notif.content}
                </p>
                {notif.post_id && (
                  <span className={`text-[11px] font-semibold mt-2 inline-flex items-center gap-1 group-hover:gap-1.5 transition-all ${activeColor}`}>
                    {lang === 'am' ? 'ልጥፉን ይመልከቱ' : 'View Pin'} <ArrowRight className="w-3 h-3" />
                  </span>
                )}
              </div>

              {/* Thumbnail */}
              {notif.post_image && (
                <div className="w-14 h-14 rounded-xl overflow-hidden border flex-shrink-0 self-center shadow-sm">
                  <img src={notif.post_image} alt="post thumb" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}