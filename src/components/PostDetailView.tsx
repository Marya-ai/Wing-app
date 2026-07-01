import React, { useState } from 'react';
import { Post, UserProfile } from '../types';
import { 
  X, Heart, MessageCircle, Share2, ShoppingBag, 
  CheckCircle2, Phone, Send, Info, ShieldCheck, Tag, AlertTriangle
} from 'lucide-react';
import ReputationBadge from './ReputationBadge'; // Import the badge component

interface PostDetailViewProps {
  post: Post;
  user: any;
  isDarkMode: boolean;
  onClose: () => void;
}

export default function PostDetailView({ post, user, isDarkMode, onClose }: PostDetailViewProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);

  // Dynamic Styles
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const activeBg = isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]';
  const isFraudRisk = (post.seller_trust_score || 0) < 20;

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-black/95 backdrop-blur-xl p-4 md:p-8">
      {/* Global Close Button */}
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white transition-all z-10"
      >
        <X className="w-8 h-8" />
      </button>

      <div className={`relative w-full max-w-6xl h-full max-h-[90vh] overflow-hidden rounded-[3rem] border flex flex-col md:flex-row shadow-2xl ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
        
        {/* LEFT: Image Section */}
        <div className="w-full md:w-1/2 h-64 md:h-full bg-black flex items-center justify-center relative overflow-hidden">
          <img 
            src={post.image_url} 
            alt="Craft" 
            className={`w-full h-full object-cover ${isFraudRisk ? 'blur-sm grayscale' : ''}`} 
          />
          <div className="absolute top-6 left-6">
             <span className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest shadow-2xl ${post.post_type === 'wip' ? 'bg-blue-600' : 'bg-green-600'} text-white`}>
               {post.post_type}
             </span>
          </div>
          
          {isFraudRisk && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center p-10 text-center">
              <div className="bg-red-600 text-white px-6 py-4 rounded-2xl shadow-2xl">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-black uppercase tracking-widest text-xs">Seller Under Review</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Details Section */}
        <div className="w-full md:w-1/2 flex flex-col h-full relative">
          <div className="flex-1 overflow-y-auto p-8 md:p-12 no-scrollbar">
            
            {/* Maker Profile Header */}
            <div className="flex items-center justify-between mb-10 pb-8 border-b dark:border-gray-800">
              <div className="flex items-center gap-4">
                <img src={post.author_avatar} alt="Maker" className="w-14 h-14 rounded-full border-2 border-[#E07A5F] object-cover" />
                <div className="space-y-1">
                  <h4 className={`text-sm font-black uppercase tracking-widest ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {post.author_name}
                  </h4>
                  {/* WING: Reputation Badge Added Here */}
                  <ReputationBadge score={post.seller_trust_score || 0} size="lg" />
                </div>
              </div>
              <div className="flex gap-2">
                <button className="p-3 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-red-500/10 transition-colors group">
                  <Heart className="w-5 h-5 text-gray-400 group-hover:text-red-500" />
                </button>
                <button className="p-3 rounded-full bg-gray-100 dark:bg-white/5 hover:bg-blue-500/10 transition-colors group">
                  <Share2 className="w-5 h-5 text-gray-400 group-hover:text-blue-500" />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div className="space-y-10">
              <section>
                <h2 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 ${activeColor}`}>The Story</h2>
                <p className={`text-sm leading-relaxed font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {post.caption || "This artisan has let the craft speak for itself (no description provided)."}
                </p>
              </section>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-10">
                <section>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" /> Materials
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {post.materials?.map((m, i) => (
                      <span key={i} className="text-[9px] font-black px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 dark:text-gray-300 border dark:border-gray-800">
                        {m.toUpperCase()}
                      </span>
                    )) || <span className="text-[10px] italic text-gray-500">Traditional Methods</span>}
                  </div>
                </section>
                <section>
                  <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                    <Tag className="w-3 h-3" /> Tools
                  </h5>
                  <div className="flex flex-wrap gap-2">
                    {post.tools?.map((t, i) => (
                      <span key={i} className="text-[9px] font-black px-3 py-2 rounded-xl bg-gray-100 dark:bg-white/5 dark:text-gray-300 border dark:border-gray-800">
                        {t.toUpperCase()}
                      </span>
                    )) || <span className="text-[10px] italic text-gray-500">Hand-tooled</span>}
                  </div>
                </section>
              </div>

              {/* Community Placeholder */}
              <div className="pt-10 border-t dark:border-gray-800">
                <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-6 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" /> Community Discussion
                </h5>
                <div className="p-6 rounded-[2rem] bg-gray-50 dark:bg-white/5 text-[11px] text-gray-500 italic border border-dashed dark:border-gray-800">
                  Be the first to appreciate this handmade masterpiece...
                </div>
              </div>
            </div>
          </div>

          {/* STICKY FOOTER: PRICE & ACTION */}
          <div className={`p-8 md:p-10 border-t flex items-center justify-between ${isDarkMode ? 'bg-[#121212] border-gray-800' : 'bg-gray-50 border-gray-100'}`}>
            <div>
              <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1">Direct Price</p>
              <h3 className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>
                {post.price || 0} <span className={activeColor}>ETB</span>
              </h3>
            </div>
            
            {post.post_type === 'finished' && !hasRequested && !isFraudRisk ? (
              <button 
                onClick={() => setShowConfirm(true)}
                className={`flex items-center gap-3 px-10 py-5 rounded-[1.5rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${activeBg} text-white hover:brightness-110`}
              >
                <ShoppingBag className="w-5 h-5" /> Buy Now
              </button>
            ) : hasRequested ? (
              <div className="flex flex-col items-end">
                <div className="flex items-center gap-2 text-green-500 font-black text-[10px] uppercase tracking-widest bg-green-500/10 px-4 py-2 rounded-full">
                  <CheckCircle2 className="w-4 h-4" /> Request Logged
                </div>
              </div>
            ) : isFraudRisk ? (
              <div className="text-[10px] font-black uppercase text-red-500 px-4 py-2">Purchase Blocked</div>
            ) : (
              <div className="text-[10px] font-black uppercase text-blue-500 bg-blue-500/10 px-6 py-3 rounded-full tracking-widest">Work In Progress</div>
            )}
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[4000] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in zoom-in duration-200">
          <div className={`w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border text-center ${isDarkMode ? 'bg-[#1A1A1A] border-gray-800' : 'bg-white border-gray-100'}`}>
             <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 mx-auto ${isDarkMode ? 'bg-white/5' : 'bg-gray-100'}`}>
               <Info className={`w-10 h-10 ${activeColor}`} />
             </div>
             <h3 className={`text-xl font-black uppercase tracking-widest mb-3 ${isDarkMode ? 'text-white' : 'text-black'}`}>Interested?</h3>
             <p className="text-xs text-gray-500 mb-10 leading-relaxed font-bold uppercase tracking-tighter px-2">
               reveal seller contact details and get your unique Wing Token to secure this item.
             </p>
             <div className="grid grid-cols-2 gap-4">
               <button 
                onClick={() => setShowConfirm(false)} 
                className="py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
               >
                 Cancel
               </button>
               <button 
                onClick={() => { setHasRequested(true); setShowConfirm(false); }}
                className={`py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl ${activeBg} hover:scale-105 transition-transform`}
               >
                 Show Info
               </button>
             </div>
          </div>
        </div>
      )}

      {/* SUCCESS SCREEN: WING TOKEN & CONTACT */}
      {hasRequested && (
        <div className="fixed inset-0 z-[5000] flex items-center justify-center p-4 bg-black/95 backdrop-blur-3xl animate-in zoom-in duration-300">
          <div className={`w-full max-w-md rounded-[4rem] p-12 shadow-2xl border text-center relative ${isDarkMode ? 'bg-[#0A0A0A] border-gray-800' : 'bg-white border-gray-100'}`}>
             
             <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
               <ShieldCheck className="w-12 h-12 text-green-500" />
             </div>
             
             <h3 className={`text-2xl font-black uppercase tracking-widest mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Connect with Maker</h3>
             <p className="text-[10px] text-gray-500 mb-10 font-black uppercase tracking-[0.2em]">Transaction Security Enabled</p>

             {/* THE WING TOKEN BOX */}
             <div className="bg-gray-100 dark:bg-white/5 rounded-[2.5rem] p-8 mb-10 border border-dashed border-gray-300 dark:border-gray-700">
               <p className="text-[9px] font-black text-gray-400 uppercase tracking-[0.4em] mb-4">Your Sale Token</p>
               <div className={`text-3xl font-mono font-black tracking-[0.3em] ${activeColor}`}>
                 {post.wing_token || 'WCT-ET-PENDING'}
               </div>
               <div className="mt-6 flex items-center justify-center gap-2 text-[10px] font-black uppercase text-gray-500 bg-gray-200 dark:bg-white/10 px-4 py-2 rounded-full">
                 <Tag className="w-3 h-3" /> Required for payment
               </div>
             </div>

             {/* CONTACT INFO REVEAL */}
             <div className="space-y-4 mb-12 text-left">
               <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border dark:border-gray-800 group hover:border-[#E07A5F] transition-all">
                 <div className="p-4 bg-blue-500/10 rounded-2xl"><Phone className="w-6 h-6 text-blue-500" /></div>
                 <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Telebirr Account</p>
                   <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>09XXXXXXXX</p>
                 </div>
               </div>
               <div className="flex items-center gap-5 p-5 rounded-[1.5rem] bg-gray-50 dark:bg-white/5 border dark:border-gray-800 group hover:border-[#E07A5F] transition-all">
                 <div className="p-4 bg-sky-500/10 rounded-2xl"><Send className="w-6 h-6 text-sky-500" /></div>
                 <div>
                   <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-1">Telegram Direct</p>
                   <p className={`text-sm font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>@Maker_Profile</p>
                 </div>
               </div>
             </div>

             <button 
              onClick={onClose}
              className={`w-full py-6 rounded-3xl font-black text-xs uppercase tracking-[0.4em] text-white shadow-2xl ${activeBg} hover:brightness-110 active:scale-[0.98] transition-all`}
             >
               I've Noted Details
             </button>

             <p className="mt-8 text-[9px] font-bold text-gray-500 uppercase tracking-widest opacity-40">Wing Verified Artisan System</p>
          </div>
        </div>
      )}
    </div>
  );
}