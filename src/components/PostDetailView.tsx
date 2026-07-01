import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { 
  X, Heart, MessageCircle, Share2, ShoppingBag, 
  CheckCircle2, Phone, Send, Info, ShieldCheck, Tag, AlertTriangle, ExternalLink
} from 'lucide-react';
import ReputationBadge from './ReputationBadge';

interface PostDetailViewProps {
  post: Post;
  user: any;
  isDarkMode: boolean;
  onClose: () => void;
}

export default function PostDetailView({ post, user, isDarkMode, onClose }: PostDetailViewProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [loadingSeller, setLoadingSeller] = useState(false);

  // Dynamic Styles
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white';
  const isFraudRisk = (post.trust_score || 0) < 0;

  // WING: Fetch Seller Contact Info only when requested (Privacy & Performance)
  const fetchSellerDetails = async () => {
    setLoadingSeller(true);
    try {
      const docRef = doc(db, "profiles", post.user_id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setSellerProfile(docSnap.data());
      }
    } catch (error) {
      console.error("Error fetching seller details:", error);
    } finally {
      setLoadingSeller(false);
      setHasRequested(true);
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8 animate-in fade-in duration-300">
      {/* Global Close Button */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-4 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all z-[3001]"
      >
        <X className="w-8 h-8" />
      </button>

      <div className={`relative w-full max-w-6xl h-full max-h-[90vh] overflow-hidden rounded-[4rem] border flex flex-col md:flex-row shadow-2xl ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
        
        {/* LEFT: Image Section */}
        <div className="w-full md:w-1/2 h-64 md:h-full bg-black flex items-center justify-center relative overflow-hidden">
          <img 
            src={post.image_url} 
            alt="Craft Masterpiece" 
            className={`w-full h-full object-cover transition-all duration-700 ${isFraudRisk ? 'blur-md grayscale scale-110' : ''}`} 
          />
          <div className="absolute top-8 left-8 flex gap-3">
             <span className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl ${post.post_type === 'wip' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
               {post.post_type === 'wip' ? '🛠️ Progress' : '✨ Finished'}
             </span>
             <span className="px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl bg-black/50 backdrop-blur-md text-white border border-white/10">
               {post.category?.replace('-', ' ')}
             </span>
          </div>
          
          {isFraudRisk && (
            <div className="absolute inset-0 bg-red-900/20 flex flex-col items-center justify-center p-12 text-center backdrop-blur-sm">
              <AlertTriangle className="w-16 h-16 text-white mb-4 animate-bounce" />
              <h3 className="text-white font-black uppercase tracking-[0.2em] text-lg">Caution: Fraud Risk</h3>
              <p className="text-white/80 text-[10px] font-bold uppercase mt-2">This seller's account is currently under investigation.</p>
            </div>
          )}
        </div>

        {/* RIGHT: Details Section */}
        <div className="w-full md:w-1/2 flex flex-col h-full relative">
          <div className="flex-1 overflow-y-auto p-8 md:p-14 no-scrollbar">
            
            {/* Maker Profile Header */}
            <div className="flex items-center justify-between mb-12 pb-10 border-b dark:border-gray-800">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <img src={post.author_avatar} alt="Maker" className="w-16 h-16 rounded-full border-2 border-[#E07A5F] object-cover shadow-xl" />
                  <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-[#0F0F0F]"></div>
                </div>
                <div className="space-y-2">
                  <h4 className={`text-lg font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {post.author_name}
                  </h4>
                  <ReputationBadge score={post.trust_score || 0} size="md" />
                </div>
              </div>
              <div className="flex gap-3">
                <button className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 transition-all group">
                  <Heart className="w-5 h-5 text-gray-400 group-hover:text-red-500 group-hover:fill-red-500" />
                </button>
                <button className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 hover:bg-blue-500/10 transition-all group">
                  <Share2 className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-12">
              <section>
                <h2 className={`text-[10px] font-black uppercase tracking-[0.4em] mb-5 ${activeColor}`}>Artisan's Story</h2>
                <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {post.caption || "This artisan has let the craft speak for itself."}
                </p>
              </section>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-10">
                <section>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-[#E07A5F]" /> Materials
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {post.materials?.length ? post.materials.map((m, i) => (
                      <span key={i} className="text-[9px] font-black px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 dark:text-gray-300 border dark:border-gray-800">
                        {m.toUpperCase()}
                      </span>
                    )) : <span className="text-[10px] text-gray-600 italic">Pure Handmade</span>}
                  </div>
                </section>
                <section>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-5 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-500" /> Tools
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {post.tools?.length ? post.tools.map((t, i) => (
                      <span key={i} className="text-[9px] font-black px-4 py-2 rounded-xl bg-gray-100 dark:bg-white/5 dark:text-gray-300 border dark:border-gray-800">
                        {t.toUpperCase()}
                      </span>
                    )) : <span className="text-[10px] text-gray-600 italic">Traditional Tools</span>}
                  </div>
                </section>
              </div>

              {/* Security Note */}
              <div className="p-6 rounded-3xl bg-blue-500/5 border border-blue-500/10 flex gap-4">
                <ShieldCheck className="w-6 h-6 text-blue-500 shrink-0" />
                <p className="text-[10px] text-gray-500 font-medium leading-relaxed">
                  Every purchase on Wing is protected. Always request the <strong>Wing Token</strong> from the seller to ensure your transaction is verified by our admin team.
                </p>
              </div>
            </div>
          </div>

          {/* STICKY FOOTER */}
          <div className={`p-10 border-t flex items-center justify-between ${isDarkMode ? 'bg-[#121212] border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Direct Price</p>
              <h3 className={`text-3xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                {post.price?.toLocaleString()} <span className={activeColor}>ETB</span>
              </h3>
            </div>
            
            {post.post_type === 'finished' && !hasRequested && !isFraudRisk ? (
              <button 
                onClick={() => setShowConfirm(true)}
                className={`flex items-center gap-4 px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${activeBg} hover:brightness-110`}
              >
                <ShoppingBag className="w-5 h-5" /> Buy Now
              </button>
            ) : hasRequested ? (
              <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest bg-green-500/10 px-6 py-3 rounded-full border border-green-500/20">
                <CheckCircle2 className="w-5 h-5" /> Contact Revealed
              </div>
            ) : isFraudRisk ? (
              <div className="text-[10px] font-black uppercase text-red-500 bg-red-500/10 px-8 py-4 rounded-full border border-red-500/20">Blocked</div>
            ) : (
              <div className="text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 px-8 py-4 rounded-full border border-blue-500/20 tracking-[0.2em]">Crafting...</div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in zoom-in duration-200">
          <div className={`w-full max-w-sm rounded-[3.5rem] p-12 shadow-2xl border text-center ${isDarkMode ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-100'}`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-8 mx-auto bg-blue-500/10`}>
               <Info className={`w-10 h-10 text-blue-500`} />
             </div>
             <h3 className={`text-2xl font-black uppercase tracking-tighter mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>Secure Purchase?</h3>
             <p className="text-xs text-gray-500 mb-10 leading-relaxed font-bold uppercase tracking-tighter">
               We will reveal the artisan's Telebirr and Telegram. You will also get a <strong>Wing Token</strong> to secure the sale.
             </p>
             <div className="flex flex-col gap-3">
               <button 
                onClick={fetchSellerDetails}
                disabled={loadingSeller}
                className={`py-6 rounded-3xl font-black text-[11px] uppercase tracking-widest text-white shadow-xl ${activeBg} hover:scale-105 transition-all`}
               >
                 {loadingSeller ? 'Loading Artisan...' : 'Show Contact Info'}
               </button>
               <button 
                onClick={() => setShowConfirm(false)} 
                className="py-5 rounded-3xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
               >
                 Go Back
               </button>
             </div>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN: SELLER INFO & WING TOKEN */}
      {hasRequested && sellerProfile && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className={`w-full max-w-md rounded-[4rem] p-14 shadow-2xl border text-center relative ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-100'}`}>
             
             <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-10">
               <ShieldCheck className="w-14 h-14 text-green-500" />
             </div>
             
             <h3 className={`text-3xl font-black uppercase tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Verified Artisan</h3>
             <p className="text-[10px] text-gray-500 mb-12 font-black uppercase tracking-[0.3em]">Transaction Protection Active</p>

             {/* THE WING TOKEN */}
             <div className="bg-gray-100 dark:bg-white/5 rounded-[3rem] p-10 mb-10 border border-dashed border-gray-300 dark:border-gray-700">
               <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.4em] mb-5">Your Sale Token</p>
               <div className={`text-4xl font-mono font-black tracking-[0.2em] ${activeColor}`}>
                 {post.wing_token || 'WCT-ET-XXXXXX'}
               </div>
               <p className="mt-6 text-[9px] font-black uppercase text-gray-500 px-6 py-2 bg-gray-200 dark:bg-white/10 rounded-full inline-block">
                 Send this to the seller via Telegram
               </p>
             </div>

             {/* REAL SELLER CONTACT REVEAL */}
             <div className="space-y-5 mb-14">
               {/* Telebirr Box */}
               <div className="flex items-center gap-6 p-6 rounded-[2rem] bg-gray-50 dark:bg-white/5 border dark:border-gray-800">
                 <div className="p-4 bg-blue-500/10 rounded-2xl"><Phone className="w-6 h-6 text-blue-500" /></div>
                 <div className="text-left">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Telebirr Account</p>
                   <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                     {sellerProfile.phone || "Not Provided"}
                   </p>
                 </div>
               </div>

               {/* Telegram Box */}
               <button 
                 onClick={() => window.open(`https://t.me/${sellerProfile.telegram_username?.replace('@', '')}`, '_blank')}
                 className="w-full flex items-center gap-6 p-6 rounded-[2rem] bg-gray-50 dark:bg-white/5 border dark:border-gray-800 hover:border-sky-500 transition-all text-left group"
               >
                 <div className="p-4 bg-sky-500/10 rounded-2xl group-hover:bg-sky-500 group-hover:text-white transition-all">
                    <Send className="w-6 h-6 text-sky-500 group-hover:text-white" />
                 </div>
                 <div className="flex-1">
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Telegram Direct</p>
                   <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                     @{sellerProfile.telegram_username || "Unknown"}
                   </p>
                 </div>
                 <ExternalLink className="w-5 h-5 text-gray-600" />
               </button>
             </div>

             <button 
              onClick={onClose}
              className={`w-full py-8 rounded-[2rem] font-black text-xs uppercase tracking-[0.5em] text-white shadow-2xl ${activeBg} hover:brightness-110 active:scale-[0.98] transition-all`}
             >
               Return to Marketplace
             </button>
          </div>
        </div>
      )}
    </div>
  );
}