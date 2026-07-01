import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from '../types';
// WING: Firebase & Service Imports
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
// Safe import with fallback check
import { reportSaleAction } from '../lib/wingServices';

import { 
  CheckCircle, AlertCircle, CreditCard, 
  ArrowRight, ShieldCheck, History, Tag, X, Package, Clock, Send, ExternalLink, AlertTriangle
} from 'lucide-react';
import ReputationBadge from './ReputationBadge';

interface SellerDashboardProps {
  user?: any;           // Made optional
  profile?: UserProfile | null; // Made optional (we'll fetch if not provided)
  isDarkMode?: boolean; // Made optional
}

// WING: Replace this with your personal Telegram link or Bot link
const SUPPORT_LINK = "https://t.me/@mari_beeee"; 
// WING: Replace this with your actual Telebirr number
const TELEBIRR_NUMBER = "09XXXXXXXX"; 

export default function SellerDashboard({ 
  user = null, 
  profile: initialProfile = null, 
  isDarkMode = true 
}: SellerDashboardProps) {
  
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [step, setStep] = useState<'input' | 'payment'>('input');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeBg = isDarkMode ? 'bg-[#D4AF37] text-black' : 'bg-[#E07A5F] text-white';
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';

  // 1. Fetch Profile if not provided by parent
  useEffect(() => {
    if (!user?.uid || initialProfile) return;
    
    const profileRef = doc(db, "profiles", user.uid);
    const unsub = onSnapshot(profileRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
    });
    return () => unsub();
  }, [user, initialProfile]);

  // 2. Real-time sync of Seller's Specific Inventory
  useEffect(() => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }
    
    const q = query(collection(db, "posts"), where("user_id", "==", user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setMyPosts(docs);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // 3. Handle Sale Reporting Logic
  const handleReportSale = async () => {
    if (!reportingPost || !tokenInput || !user) return;
    setIsSubmitting(true);

    try {
      // Safe check: only call if function exists
      if (typeof reportSaleAction !== 'function') {
        throw new Error("Sales reporting service is currently unavailable.");
      }

      // Dynamic Calculation based on the rate they chose at registration
      const rate = profile?.commission_rate || 15;
      const commissionAmount = (reportingPost.price || 0) * (rate / 100);

      const result = await reportSaleAction(
        reportingPost.id, 
        user.uid, 
        tokenInput, 
        commissionAmount
      );

      if (result?.success) {
        setStep('payment');
      } else {
        alert(result?.error || "Token verification failed. Ask the buyer for the correct WCT-ET code.");
      }
    } catch (err: any) {
      console.error(err);
      alert(err.message || "Error connecting to Wing services.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isRestricted = (profile?.trust_score || 0) < 0;

  // Show auth prompt if no user
  if (!user && !loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center p-8 ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <div className={`text-center max-w-md p-8 rounded-3xl border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <Package className="w-12 h-12 mx-auto mb-4 opacity-50" style={{ color: isDarkMode ? '#D4AF37' : '#E07A5F' }} />
          <h3 className={`text-xl font-bold mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Sign In Required</h3>
          <p className={`text-sm mb-6 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Please sign in to access your seller dashboard and manage your inventory.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 md:p-12 ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
      
      {/* 1. HEADER SECTION */}
      <header className="max-w-6xl mx-auto mb-16 flex flex-col md:flex-row md:items-center justify-between gap-8">
        <div className="flex items-center gap-6">
           <div className="relative">
             <img 
               src={profile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`} 
               className="w-20 h-20 rounded-[2rem] border-2 border-[#E07A5F] object-cover shadow-2xl" 
               alt="Artisan" 
             />
             <div className="absolute -bottom-2 -right-2 bg-green-500 p-1.5 rounded-full border-4 border-white dark:border-[#0A0A0A]">
               <CheckCircle className="w-4 h-4 text-white" />
             </div>
           </div>
           <div>
             <h1 className={`text-4xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>
               Maker <span className={activeColor}>Office</span>
             </h1>
             <div className="mt-2 flex items-center gap-3">
                <ReputationBadge score={profile?.trust_score || 0} size="md" />
                <span className="text-[10px] font-black uppercase text-gray-500 tracking-widest bg-gray-500/10 px-3 py-1 rounded-full border dark:border-gray-800">
                  {profile?.commission_rate || 15}% Fee Rate
                </span>
             </div>
           </div>
        </div>

        {isRestricted && (
          <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-[2.5rem] flex items-center gap-4 max-w-sm">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <p className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-relaxed">
              Restricted: Your trust score is negative. Pay pending commissions to enable sales reporting.
            </p>
          </div>
        )}
      </header>

      {/* 2. STATS CARDS */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className={`p-10 rounded-[3rem] border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <Package className="w-8 h-8 text-blue-500 mb-6" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Crafts</h4>
          <p className={`text-4xl font-black mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {myPosts.filter(p => p.sales_status === 'available').length}
          </p>
        </div>
        <div className={`p-10 rounded-[3rem] border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <ShieldCheck className="w-8 h-8 text-green-500 mb-6" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Verified Sales</h4>
          <p className={`text-4xl font-black mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {myPosts.filter(p => p.sales_status === 'sold').length}
          </p>
        </div>
        <div className={`p-10 rounded-[3rem] border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <Clock className="w-8 h-8 text-[#E07A5F] mb-6" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Pending Review</h4>
          <p className={`text-4xl font-black mt-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
            {myPosts.filter(p => p.sales_status === 'pending_verification').length}
          </p>
        </div>
      </div>

      {/* 3. CRAFT LIST */}
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-10 px-4">
          <h2 className={`text-sm font-black uppercase tracking-[0.4em] ${isDarkMode ? 'text-white' : 'text-black'}`}>Inventory</h2>
          <span className="text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] bg-gray-500/10 px-4 py-1.5 rounded-full">Cloud Encrypted</span>
        </div>

        <div className="space-y-6">
          {loading ? (
             <div className="py-20 text-center opacity-20 font-black uppercase text-xs tracking-widest">Syncing...</div>
          ) : myPosts.length === 0 ? (
            <div className="py-32 text-center border-2 border-dashed dark:border-gray-800 rounded-[4rem]">
              <History className="w-16 h-16 mx-auto mb-6 text-gray-300 opacity-20" />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">No crafts posted yet.</p>
            </div>
          ) : myPosts.map((post) => (
            <div key={post.id} className={`p-6 rounded-[3rem] border flex flex-col md:flex-row items-center justify-between gap-8 transition-all hover:scale-[1.01] ${isDarkMode ? 'bg-[#111] border-gray-800 hover:border-gray-700' : 'bg-white border-gray-100 shadow-sm'}`}>
              <div className="flex items-center gap-8 w-full md:w-auto">
                <div className="relative shrink-0">
                  <img src={post.image_url} className={`w-24 h-24 rounded-[2rem] object-cover shadow-2xl ${post.sales_status !== 'available' ? 'grayscale opacity-30' : ''}`} alt="" />
                  {post.sales_status === 'pending_verification' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-[2rem]">
                      <Clock className="w-10 h-10 text-white animate-spin-slow" />
                    </div>
                  )}
                </div>
                <div>
                  <h4 className={`text-lg font-black uppercase tracking-tight mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                    {post.caption?.substring(0, 40) || "Handmade Piece"}...
                  </h4>
                  <div className="flex items-center gap-4">
                    <span className={`text-xs font-black px-4 py-1.5 rounded-xl bg-gray-100 dark:bg-white/5 ${activeColor}`}>
                      {post.price?.toLocaleString()} ETB
                    </span>
                    <span className={`text-[9px] font-black uppercase px-4 py-1.5 rounded-full border ${
                      post.sales_status === 'available' ? 'border-green-500/30 text-green-500' : 
                      post.sales_status === 'pending_verification' ? 'border-blue-500/30 text-blue-500' : 
                      'border-gray-500/30 text-gray-500'
                    }`}>
                      {post.sales_status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="w-full md:w-auto">
                {post.sales_status === 'available' && !isRestricted && (
                  <button 
                    onClick={() => { setReportingPost(post); setStep('input'); }}
                    className={`w-full md:w-auto flex items-center justify-center gap-3 px-12 py-5 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 ${activeBg}`}
                  >
                    Mark Sold <ArrowRight className="w-4 h-4" />
                  </button>
                )}
                {post.sales_status === 'pending_verification' && (
                  <div className="px-8 py-4 bg-blue-500/10 rounded-2xl text-center border border-blue-500/20">
                     <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest">Awaiting Admin</p>
                  </div>
                )}
                {post.sales_status === 'sold' && (
                  <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-8 py-4 rounded-2xl border border-green-500/20">
                    <CheckCircle className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Verified</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. REPORTING MODAL */}
      {reportingPost && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/98 backdrop-blur-3xl animate-in fade-in duration-300">
          <div className={`w-full max-w-md rounded-[4rem] p-12 shadow-2xl border relative ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
            
            <button onClick={() => setReportingPost(null)} className="absolute top-10 right-10 p-2 text-gray-500 hover:text-white"><X className="w-8 h-8" /></button>

            {step === 'input' ? (
              <>
                <div className="text-center mb-12">
                  <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-8 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <Tag className={`w-12 h-12 ${activeColor}`} />
                  </div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Token Required</h3>
                  <p className="text-[11px] text-gray-500 mt-4 font-bold uppercase leading-relaxed tracking-tight px-4">
                    Enter the WCT-ET token provided by the buyer to report this sale.
                  </p>
                </div>

                <input 
                  type="text" 
                  placeholder="WCT-ET-XXXXXX"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className={`w-full p-8 rounded-[2.5rem] border-2 text-center font-mono text-3xl font-black mb-10 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-gray-50 border-gray-200 focus:border-[#E07A5F]'}`}
                />

                <button 
                  onClick={handleReportSale} 
                  disabled={isSubmitting || !tokenInput}
                  className={`w-full py-7 rounded-[2rem] font-black text-[11px] uppercase tracking-[0.4em] shadow-2xl ${activeBg} disabled:opacity-50 active:scale-95 transition-all`}
                >
                  {isSubmitting ? 'Verifying...' : 'Submit Sale Report'}
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-10">
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-8">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Report Success</h3>
                  <p className="text-[11px] text-gray-500 mt-4 font-bold uppercase leading-relaxed px-6">
                    Sale logged! Pay the commission below and send the receipt to our admin to verify.
                  </p>
                </div>

                <div className="bg-gray-100 dark:bg-white/5 rounded-[3rem] p-10 mb-8 border dark:border-gray-800">
                  <div className="flex justify-between items-center pt-8 border-t dark:border-gray-700">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Commission Due ({profile?.commission_rate || 15}%)</span>
                    <span className={`text-3xl font-black ${activeColor}`}>
                      {((reportingPost.price || 0) * (profile?.commission_rate || 15) / 100).toLocaleString()} ETB
                    </span>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                   {/* TELEBIRR INFO */}
                   <div className="p-6 rounded-[2rem] bg-blue-500/5 border border-blue-500/10 flex items-center gap-6">
                      <div className="p-4 bg-blue-500/20 rounded-2xl"><CreditCard className="w-7 h-7 text-blue-500" /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Telebirr Number</p>
                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{TELEBIRR_NUMBER}</p>
                      </div>
                   </div>

                   {/* DIRECT CHAT BUTTON */}
                   <button 
                      onClick={() => window.open(SUPPORT_LINK, '_blank')}
                      className="w-full flex items-center justify-between p-6 rounded-[2.5rem] bg-sky-500/10 border border-sky-500/20 text-sky-500 hover:bg-sky-500 hover:text-white transition-all group shadow-xl"
                   >
                      <div className="flex items-center gap-6">
                         <Send className="w-8 h-8" />
                         <div className="text-left">
                            <p className="text-[11px] font-black uppercase tracking-widest">Send Screenshot</p>
                            <p className="text-[9px] font-bold uppercase opacity-60">Chat with Wing Admin</p>
                         </div>
                      </div>
                      <ExternalLink className="w-5 h-5" />
                   </button>
                </div>

                <button 
                  onClick={() => { setReportingPost(null); setStep('input'); setTokenInput(''); }}
                  className="w-full py-6 text-[10px] font-black text-gray-500 uppercase tracking-widest"
                >
                  Return to Dashboard
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}