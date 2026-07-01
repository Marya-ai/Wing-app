import React, { useState, useEffect } from 'react';
import { Post, UserProfile } from '../types';
// WING: Firebase & Service Imports
import { db, auth } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
// Safe imports with fallback checks
import { verifySaleAction, flagSellerAction } from '../lib/wingServices';

import { 
  ShieldCheck, AlertTriangle, CheckCircle, XCircle, 
  Eye, DollarSign, Search, Clock, TrendingUp, Filter, Users,
  LogOut, Activity, Ban, RefreshCw
} from 'lucide-react';

interface AdminDashboardProps {
  user?: any;           // Made optional
  profile?: UserProfile | null; // Made optional
  isDarkMode?: boolean; // Made optional
}

export default function AdminDashboard({ 
  user = null, 
  profile = null, 
  isDarkMode = true 
}: AdminDashboardProps) {
  
  // --- STATE ---
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [filter, setFilter] = useState<'verifying' | 'completed' | 'fraud_flagged'>('verifying');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // NEW: User Management State
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');

  const activeBg = isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]';
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';
  const cardBg = isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200 shadow-sm';

  // --- SECURITY CHECK ---
  useEffect(() => {
    if (!user || !profile) {
      setIsAuthorized(false);
      setCheckingAuth(false);
      return;
    }

    // Check if user is admin via profile flag OR hardcoded email
    const isAdmin = profile.is_admin === true || user.email === 'admin@wing.com';
    setIsAuthorized(isAdmin);
    setCheckingAuth(false);
  }, [user, profile]);

  // --- WING: REAL-TIME DATA LISTENER ---
  useEffect(() => {
    if (!isAuthorized) return;

    const q = query(collection(db, "reports"), orderBy("reportedAt", "desc"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const reportData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setReports(reportData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isAuthorized]);

  // NEW: Load Users for Management Tab
  useEffect(() => {
    if (!isAuthorized || activeTab !== 'users') return;
    
    const loadUsers = async () => {
      try {
        const snap = await getDocs(collection(db, "profiles"));
        const userList = snap.docs.map(d => ({ id: d.id, ...d.data() } as UserProfile));
        setUsers(userList);
      } catch (err) {
        console.error("Failed to load users:", err);
      }
    };
    loadUsers();
  }, [isAuthorized, activeTab]);

  // --- LOGIC ---
  const filteredReports = reports.filter(r => {
    // FIX: Safe access to potentially undefined fields
    const rStatus = r.status || 'verifying';
    const matchesFilter = rStatus === filter;
    const matchesSearch = (r.token || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (r.sellerName || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingRevenue = reports
    .filter(r => (r.status || 'verifying') === 'verifying')
    .reduce((sum, r) => sum + (r.commission || 0), 0);

  const totalCollected = reports
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.commission || 0), 0);

  const handleVerify = async (report: any) => {
    if (typeof verifySaleAction !== 'function') {
      alert("Verification service is currently unavailable.");
      return;
    }
    try {
      await verifySaleAction(report.id, report.postId, report.sellerId);
      setSelectedReport(null);
    } catch (err) {
      console.error(err);
      alert("Failed to verify sale.");
    }
  };

  const handleFlag = async (report: any) => {
    if (typeof flagSellerAction !== 'function') {
      alert("Fraud reporting service is currently unavailable.");
      return;
    }
    if(window.confirm("Flag this seller for fraud? This will restrict their account.")) {
      try {
        await flagSellerAction(report.sellerId, report.id, report.postId);
        setSelectedReport(null);
      } catch (err) {
        console.error(err);
        alert("Failed to flag seller.");
      }
    }
  };

  const handleSignOut = async () => {
    try { await signOut(auth); } catch (err) { console.error(err); }
  };

  // --- RENDER: AUTH GATE ---
  if (checkingAuth) {
    return (
      <div className={`min-h-screen flex items-center justify-center ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <RefreshCw className="w-8 h-8 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center p-8 ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
        <Ban className="w-16 h-16 text-red-500 mb-6 opacity-50" />
        <h2 className={`text-2xl font-black uppercase tracking-tighter mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Access Denied</h2>
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-8">You do not have administrator privileges.</p>
        <button onClick={handleSignOut} className="px-6 py-3 rounded-xl bg-red-500/10 text-red-500 text-xs font-black uppercase hover:bg-red-500 hover:text-white transition-all">
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className={`min-h-screen p-6 md:p-10 ${isDarkMode ? 'bg-[#0A0A0A]' : 'bg-gray-50'}`}>
      
      {/* 1. ADMIN HEADER & REVENUE STATS */}
      <header className="mb-12 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-8">
        <div>
          <h1 className={`text-4xl font-black uppercase tracking-tighter ${isDarkMode ? 'text-white' : 'text-black'}`}>
            Wing <span className={activeColor}>Admin</span>
          </h1>
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.4em] mt-2">Marketplace Oversight & Revenue</p>
        </div>

        <div className="flex flex-wrap gap-4 w-full lg:w-auto">
          <div className={`flex-1 lg:flex-none p-6 px-10 rounded-[2rem] border ${cardBg}`}>
            <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Collected Revenue</p>
            <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{totalCollected.toLocaleString()} <span className="text-green-500 text-xs font-bold uppercase ml-1">ETB</span></p>
          </div>
          <div className={`flex-1 lg:flex-none p-6 px-10 rounded-[2rem] border ${cardBg}`}>
            <p className="text-[9px] font-black text-[#E07A5F] uppercase mb-2 tracking-widest">Pending Verification</p>
            <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{pendingRevenue.toLocaleString()} <span className="text-xs font-bold uppercase ml-1">ETB</span></p>
          </div>
        </div>
      </header>

      {/* 2. TAB SWITCHER & CONTROL BAR */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-10">
        <div className="flex bg-gray-200 dark:bg-white/5 p-1.5 rounded-[1.5rem] w-full md:w-auto">
          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest flex items-center gap-2 ${activeTab === 'reports' ? activeBg + ' text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
          >
            <DollarSign className="w-3 h-3" /> Reports
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest flex items-center gap-2 ${activeTab === 'users' ? activeBg + ' text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
          >
            <Users className="w-3 h-3" /> Artisans
          </button>
        </div>

        {activeTab === 'reports' && (
          <>
            <div className="flex bg-gray-200 dark:bg-white/5 p-1.5 rounded-[1.5rem] w-full md:w-auto">
              {(['verifying', 'completed', 'fraud_flagged'] as const).map((type) => (
                <button 
                  key={type}
                  onClick={() => setFilter(type)} 
                  className={`flex-1 md:flex-none px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all tracking-widest ${filter === type ? activeBg + ' text-white shadow-lg' : 'text-gray-500 hover:text-gray-400'}`}
                >
                  {type.replace('_', ' ')}
                </button>
              ))}
            </div>
            <div className="relative flex-1 max-w-md w-full">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input 
                type="text" 
                placeholder="Search Token or Artisan..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full pl-14 pr-6 py-4 rounded-2xl text-xs font-bold outline-none border transition-all ${isDarkMode ? 'bg-[#111] border-gray-800 text-white focus:border-[#D4AF37]' : 'bg-white border-gray-200 focus:border-[#E07A5F]'}`} 
              />
            </div>
          </>
        )}
      </div>

      {/* 3. CONTENT AREA */}
      {activeTab === 'reports' ? (
        <div className={`rounded-[3rem] border overflow-hidden shadow-2xl ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-gray-800 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Artisan</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Sale Token</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Commission Due</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {loading ? (
                  <tr><td colSpan={5} className="p-20 text-center text-xs font-black uppercase opacity-30">Loading Cloud Data...</td></tr>
                ) : filteredReports.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center text-xs font-black uppercase opacity-30">No {filter} reports found</td></tr>
                ) : filteredReports.map((report) => {
                  // FIX: Safe defaults for all report properties
                  const rStatus = report.status || 'verifying';
                  const rToken = report.token || 'N/A';
                  const rSeller = report.sellerName || 'Anonymous';
                  const rCommission = report.commission || 0;
                  const rAmount = report.amount || 0;
                  const rInitial = rSeller.charAt(0).toUpperCase();

                  return (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors">
                      <td className="p-8">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-500 flex items-center justify-center text-[10px] text-white font-bold">
                            {rInitial}
                          </div>
                          <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{rSeller}</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <span className="font-mono text-sm font-black p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {rToken}
                        </span>
                      </td>
                      <td className="p-8">
                        <div className="flex flex-col">
                          <span className={`text-lg font-black ${activeColor}`}>{rCommission} ETB</span>
                          <span className="text-[9px] font-bold text-gray-500 uppercase">15% of {rAmount} ETB</span>
                        </div>
                      </td>
                      <td className="p-8">
                        <div className={`flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2 rounded-full w-fit ${
                          rStatus === 'completed' ? 'bg-green-500/10 text-green-500' : 
                          rStatus === 'verifying' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'
                        }`}>
                          {rStatus === 'verifying' && <Clock className="w-3 h-3" />}
                          {rStatus.replace('_', ' ')}
                        </div>
                      </td>
                      <td className="p-8">
                        <button 
                          onClick={() => setSelectedReport({...report, status: rStatus, token: rToken, sellerName: rSeller, commission: rCommission, amount: rAmount})}
                          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-[#E07A5F] hover:text-white transition-all"
                        >
                          <Eye className="w-4 h-4" /> Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* NEW: USER MANAGEMENT TABLE */
        <div className={`rounded-[3rem] border overflow-hidden shadow-2xl ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200'}`}>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={`border-b ${isDarkMode ? 'border-gray-800 bg-white/5' : 'border-gray-100 bg-gray-50'}`}>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Artisan</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Trust Score</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Commission Rate</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Joined</th>
                  <th className="p-8 text-[10px] font-black uppercase text-gray-400 tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {users.length === 0 ? (
                  <tr><td colSpan={5} className="p-20 text-center text-xs font-black uppercase opacity-30">Loading Artisans...</td></tr>
                ) : users.map((u) => (
                  <tr key={u.id} className="hover:bg-white/5 transition-colors">
                    <td className="p-8">
                      <div className="flex items-center gap-3">
                        <img src={u.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${u.id}`} className="w-8 h-8 rounded-full" alt="" />
                        <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{u.full_name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="p-8">
                      <span className={`text-sm font-black ${u.trust_score >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                        {u.trust_score || 0}
                      </span>
                    </td>
                    <td className="p-8">
                      <span className={`text-sm font-black ${activeColor}`}>{u.commission_rate || 15}%</span>
                    </td>
                    <td className="p-8">
                      <span className="text-xs text-gray-500 font-mono">{u.artisan_since ? new Date(u.artisan_since).toLocaleDateString() : 'N/A'}</span>
                    </td>
                    <td className="p-8">
                      <div className={`text-[10px] font-black uppercase px-3 py-1.5 rounded-full w-fit ${
                        u.trust_score >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                      }`}>
                        {u.trust_score >= 0 ? 'Active' : 'Restricted'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. VERIFICATION MODAL */}
      {selectedReport && (
        <div className="fixed inset-0 z-[7000] flex items-center justify-center p-4 bg-black/90 backdrop-blur-2xl">
          <div className={`w-full max-w-3xl rounded-[4rem] overflow-hidden border shadow-2xl flex flex-col md:flex-row animate-in zoom-in duration-300 ${isDarkMode ? 'bg-[#0F0F0F] border-gray-800' : 'bg-white border-gray-100'}`}>
            
            {/* Left: Receipt Preview Area */}
            <div className="w-full md:w-1/2 bg-black flex flex-col items-center justify-center p-10 border-r dark:border-gray-800 relative">
               <p className="absolute top-6 text-[9px] font-black text-gray-600 uppercase tracking-widest">Telebirr Confirmation</p>
              <div className="w-full aspect-[3/4] bg-gray-900 rounded-[2rem] flex flex-col items-center justify-center border-2 border-dashed border-gray-800 text-center p-6">
                <DollarSign className="w-16 h-16 text-gray-800 mb-4" />
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-relaxed">
                  The Seller claims payment of <br/>
                  <span className="text-white text-lg">{selectedReport.commission || 0} ETB</span><br/>
                  Check your Telebirr history for Token:<br/>
                  <span className="text-blue-500">{selectedReport.token || 'N/A'}</span>
                </p>
              </div>
            </div>

            {/* Right: Actions Area */}
            <div className="w-full md:w-1/2 p-12 flex flex-col relative">
              <button onClick={() => setSelectedReport(null)} className="absolute top-8 right-8 p-2 rounded-full hover:bg-white/10 transition-colors">
                <XCircle className="w-8 h-8 text-gray-500" />
              </button>
              
              <div className="mb-10">
                <h3 className={`text-2xl font-black uppercase tracking-tight ${isDarkMode ? 'text-white' : 'text-black'}`}>Verify Sale</h3>
                <p className="text-[10px] text-gray-500 font-black uppercase mt-2 tracking-widest">Artisan: {selectedReport.sellerName || 'Anonymous'}</p>
              </div>

              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center py-4 border-b dark:border-gray-800">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sale</span>
                  <span className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedReport.amount || 0} ETB</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b dark:border-gray-800">
                  <span className="text-[10px] font-black text-[#E07A5F] uppercase tracking-widest">Our Commission (15%)</span>
                  <span className={`text-2xl font-black ${activeColor}`}>{selectedReport.commission || 0} ETB</span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium italic leading-relaxed">
                  Approval will mark the craft as "Sold" globally and award the artisan <span className="text-green-500 font-bold">+10 Trust Points</span>.
                </p>
              </div>

              {(selectedReport.status || 'verifying') === 'verifying' && (
                <div className="grid grid-cols-2 gap-4 mt-10">
                  <button 
                    onClick={() => handleFlag(selectedReport)}
                    className="flex flex-col items-center gap-2 p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all group"
                  >
                    <AlertTriangle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black uppercase">Fraud / Reject</span>
                  </button>

                  <button 
                    onClick={() => handleVerify(selectedReport)}
                    className="flex flex-col items-center gap-2 p-5 rounded-3xl bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500 hover:text-white transition-all group"
                  >
                    <CheckCircle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black uppercase">Verify / Approve</span>
                  </button>
                </div>
              )}

              {selectedReport.status === 'completed' && (
                <div className="mt-10 p-4 rounded-2xl bg-green-500/10 border border-green-500/20 text-green-500 text-center">
                  <p className="text-[10px] font-black uppercase">Transaction Fully Verified</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}