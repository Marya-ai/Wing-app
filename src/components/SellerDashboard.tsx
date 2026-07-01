import React, { useState, useEffect } from 'react';
import { Post } from '../types';
// WING: Firebase & Service Imports
import { db } from '../lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { reportSaleAction } from '../lib/wingServices';

import { 
  CheckCircle, AlertCircle, CreditCard, 
  ArrowRight, ShieldCheck, History, Tag, X, Package, Clock
} from 'lucide-react';
import ReputationBadge from './ReputationBadge';

interface SellerDashboardProps {
  user: any; // Current logged-in artisan
  isDarkMode: boolean;
}

export default function SellerDashboard({ user, isDarkMode }: SellerDashboardProps) {
  const [myPosts, setMyPosts] = useState<Post[]>([]);
  const [reportingPost, setReportingPost] = useState<Post | null>(null);
  const [tokenInput, setTokenInput] = useState('');
  const [step, setStep] = useState<'input' | 'payment'>('input');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const activeBg = isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]';
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';

  // WING: Real-time sync of Seller's specific inventory
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, "posts"), 
      where("user_id", "==", user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Post[];
      setMyPosts(docs);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // WING: Handle the Sale Reporting Logic
  const handleReportSale = async () => {
    if (!reportingPost || !tokenInput) return;
    
    setIsSubmitting(true);
    // Calculate 15% Wing Commission
    const commission = (reportingPost.price || 0) * 0.15;

    try {
      const result = await reportSaleAction(
        reportingPost.id, 
        user.uid, 
        tokenInput, 
        commission
      );

      if (result.success) {
        setStep('payment');
      } else {
        alert(result.error || "Token verification failed. Please check the code provided by the buyer.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred during reporting.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6 pb-32">
      
      {/* 1. HEADER SECTION */}
      <header className="mb-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
           <div className="relative">
             <img 
               src={user?.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user?.uid}`} 
               className="w-16 h-16 rounded-[1.5rem] border-2 border-[#E07A5F] object-cover shadow-xl" 
               alt="Artisan" 
             />
             <div className="absolute -bottom-2 -right-2 bg-green-500 p-1 rounded-full border-2 border-white dark:border-[#0A0A0A]">
               <CheckCircle className="w-3 h-3 text-white" />
             </div>
           </div>
           <div>
             <h1 className={`text-3xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>
               Maker <span className={activeColor}>Dashboard</span>
             </h1>
             <div className="mt-1">
                <ReputationBadge score={user?.trust_score || 50} size="sm" />
             </div>
           </div>
        </div>
      </header>

      {/* 2. STATS CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className={`p-8 rounded-[2.5rem] border ${isDarkMode ? 'bg-[#161616] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <Package className="w-6 h-6 text-blue-500 mb-4" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Live Listings</h4>
          <p className="text-3xl font-black mt-1">{myPosts.filter(p => p.sales_status === 'available').length}</p>
        </div>
        <div className={`p-8 rounded-[2.5rem] border ${isDarkMode ? 'bg-[#161616] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <ShieldCheck className="w-6 h-6 text-green-500 mb-4" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Verified Sales</h4>
          <p className="text-3xl font-black mt-1">{myPosts.filter(p => p.sales_status === 'sold').length}</p>
        </div>
        <div className={`p-8 rounded-[2.5rem] border ${isDarkMode ? 'bg-[#161616] border-gray-800' : 'bg-white border-gray-100 shadow-sm'}`}>
          <Clock className="w-6 h-6 text-[#E07A5F] mb-4" />
          <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pending Wing Review</h4>
          <p className="text-3xl font-black mt-1">{myPosts.filter(p => p.sales_status === 'pending_verification').length}</p>
        </div>
      </div>

      {/* 3. CRAFT MANAGEMENT LIST */}
      <div className="flex items-center justify-between mb-8 px-2">
        <h2 className={`text-xs font-black uppercase tracking-[0.3em] ${isDarkMode ? 'text-white' : 'text-black'}`}>Your Inventory</h2>
        <span className="text-[9px] font-black text-gray-500 uppercase">Real-time Sync Active</span>
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 w-full rounded-[2rem] animate-pulse bg-gray-100 dark:bg-white/5" />)}
          </div>
        ) : myPosts.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-[3rem]">
            <History className="w-12 h-12 mx-auto mb-4 text-gray-300 opacity-20" />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No crafts found. Start by posting your first work.</p>
          </div>
        ) : myPosts.map((post) => (
          <div key={post.id} className={`group p-5 rounded-[2.5rem] border flex flex-col md:flex-row items-center justify-between gap-6 transition-all hover:shadow-xl ${isDarkMode ? 'bg-[#111] border-gray-800 hover:bg-[#161616]' : 'bg-white border-gray-100'}`}>
            <div className="flex items-center gap-6 w-full md:w-auto">
              <div className="relative">
                <img src={post.image_url} className={`w-20 h-20 rounded-[1.5rem] object-cover shadow-lg ${post.sales_status === 'pending_verification' ? 'opacity-40 grayscale' : ''}`} alt="" />
                {post.sales_status === 'pending_verification' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Clock className="w-8 h-8 text-[#E07A5F] animate-pulse" />
                  </div>
                )}
              </div>
              <div>
                <h4 className={`text-sm font-black uppercase tracking-tight mb-1 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                  {post.caption?.substring(0, 35) || "Unnamed Craft"}...
                </h4>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-black px-3 py-1 rounded-lg bg-gray-100 dark:bg-white/5 ${activeColor}`}>
                    {post.price} ETB
                  </span>
                  <span className={`text-[9px] font-black uppercase px-3 py-1 rounded-full border ${
                    post.sales_status === 'available' ? 'border-green-500/30 text-green-500' : 
                    post.sales_status === 'pending_verification' ? 'border-blue-500/30 text-blue-500' : 
                    'border-gray-500/30 text-gray-500'
                  }`}>
                    {post.sales_status}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full md:w-auto">
              {post.sales_status === 'available' ? (
                <button 
                  onClick={() => { setReportingPost(post); setStep('input'); }}
                  className={`w-full md:w-auto flex items-center justify-center gap-3 px-8 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest text-white shadow-xl transition-all active:scale-95 ${activeBg} hover:brightness-110`}
                >
                  Report Sold <ArrowRight className="w-4 h-4" />
                </button>
              ) : post.sales_status === 'pending_verification' ? (
                <div className="flex flex-col items-center md:items-end gap-1 px-4">
                   <p className="text-[9px] font-black text-blue-500 uppercase">Awaiting Admin Verification</p>
                   <p className="text-[8px] text-gray-500 uppercase">Commission logic triggered</p>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-500 bg-green-500/10 px-6 py-3 rounded-2xl border border-green-500/20">
                  <CheckCircle className="w-4 h-4 shadow-sm" />
                  <span className="text-[10px] font-black uppercase tracking-widest">Verified Sale</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 4. WING REPORTING MODAL */}
      {reportingPost && (
        <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl">
          <div className={`w-full max-w-md rounded-[3.5rem] p-10 shadow-2xl border animate-in fade-in zoom-in duration-300 ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
            
            {step === 'input' ? (
              <>
                <div className="text-center mb-10">
                  <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${isDarkMode ? 'bg-white/5' : 'bg-gray-50'}`}>
                    <Tag className={`w-10 h-10 ${activeColor}`} />
                  </div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Verify Token</h3>
                  <p className="text-[11px] text-gray-500 mt-3 font-bold uppercase tracking-tight leading-relaxed">
                    Enter the WCT-ET token provided by your buyer to confirm this sale.
                  </p>
                </div>

                <input 
                  type="text" 
                  placeholder="WCT-ET-000000"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value.toUpperCase())}
                  className={`w-full p-6 rounded-[2rem] border-2 text-center font-mono text-3xl font-black mb-8 outline-none transition-all ${isDarkMode ? 'bg-white/5 border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-gray-50 border-gray-200 focus:border-[#E07A5F]'}`}
                />

                <div className="grid grid-cols-2 gap-4">
                  <button 
                    onClick={() => { setReportingPost(null); setTokenInput(''); }} 
                    className="py-5 text-[11px] font-black uppercase text-gray-500 hover:text-gray-400"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleReportSale} 
                    disabled={isSubmitting || !tokenInput}
                    className={`py-5 rounded-2xl text-white text-[11px] font-black uppercase tracking-widest shadow-2xl ${activeBg} disabled:opacity-50`}
                  >
                    {isSubmitting ? 'Verifying...' : 'Submit Report'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-10">
                  <div className="w-24 h-24 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-12 h-12 text-green-500" />
                  </div>
                  <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Token Valid</h3>
                  <p className="text-[11px] text-gray-500 mt-3 font-bold uppercase tracking-tight px-4 leading-relaxed">
                    Your report is logged. Pay the Wing commission to finalize and boost your Trust Score.
                  </p>
                </div>

                <div className="bg-gray-100 dark:bg-white/5 rounded-[2.5rem] p-8 mb-10 border dark:border-gray-800">
                  <div className="flex justify-between items-center mb-5 opacity-60">
                    <span className="text-[10px] font-black uppercase tracking-widest">Listing Price</span>
                    <span className="text-xs font-black">{reportingPost.price} ETB</span>
                  </div>
                  <div className="flex justify-between items-center pt-6 border-t dark:border-gray-700">
                    <span className="text-[10px] font-black text-[#E07A5F] uppercase tracking-widest">Wing Fee (15%)</span>
                    <span className={`text-3xl font-black ${activeColor}`}>{(reportingPost.price || 0) * 0.15} ETB</span>
                  </div>
                </div>

                <div className="space-y-4 mb-10">
                   <div className="p-6 rounded-[1.5rem] bg-blue-500/5 border border-blue-500/20 flex items-center gap-6">
                      <div className="p-4 bg-blue-500/20 rounded-2xl shadow-inner"><CreditCard className="w-8 h-8 text-blue-500" /></div>
                      <div>
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mb-1">Pay via Telebirr</p>
                        <p className={`text-lg font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>09XXXXXXXX</p>
                      </div>
                   </div>
                </div>

                <button 
                  onClick={() => { setReportingPost(null); setStep('input'); setTokenInput(''); }}
                  className={`w-full py-6 rounded-3xl text-white text-[11px] font-black uppercase tracking-[0.4em] shadow-2xl ${activeBg} hover:scale-[1.02] transition-transform`}
                >
                  Confirm & Notify Admin
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}