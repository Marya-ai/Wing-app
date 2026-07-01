import React, { useState, useEffect } from 'react';
import { Post } from '../types';
// WING: Firebase & Service Imports
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { verifySaleAction, flagSellerAction } from '../lib/wingServices';

import { 
  ShieldCheck, AlertTriangle, CheckCircle, XCircle, 
  Eye, DollarSign, Search, Clock, TrendingUp, Filter, Users
} from 'lucide-react';

interface AdminDashboardProps {
  isDarkMode: boolean;
}

export default function AdminDashboard({ isDarkMode }: AdminDashboardProps) {
  // --- STATE ---
  const [reports, setReports] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [filter, setFilter] = useState<'verifying' | 'completed' | 'fraud_flagged'>('verifying');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const activeBg = isDarkMode ? 'bg-[#D4AF37]' : 'bg-[#E07A5F]';
  const activeColor = isDarkMode ? 'text-[#D4AF37]' : 'text-[#E07A5F]';

  // --- WING: REAL-TIME DATA LISTENER ---
  useEffect(() => {
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
  }, []);

  // --- LOGIC ---
  const filteredReports = reports.filter(r => {
    const matchesFilter = r.status === filter;
    const matchesSearch = r.token?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.sellerName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const pendingRevenue = reports
    .filter(r => r.status === 'verifying')
    .reduce((sum, r) => sum + (r.commission || 0), 0);

  const totalCollected = reports
    .filter(r => r.status === 'completed')
    .reduce((sum, r) => sum + (r.commission || 0), 0);

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
          <div className={`flex-1 lg:flex-none p-6 px-10 rounded-[2rem] border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <p className="text-[9px] font-black text-gray-400 uppercase mb-2 tracking-widest">Collected Revenue</p>
            <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{totalCollected.toLocaleString()} <span className="text-green-500 text-xs font-bold uppercase ml-1">ETB</span></p>
          </div>
          <div className={`flex-1 lg:flex-none p-6 px-10 rounded-[2rem] border ${isDarkMode ? 'bg-[#111] border-gray-800' : 'bg-white border-gray-200 shadow-sm'}`}>
            <p className="text-[9px] font-black text-[#E07A5F] uppercase mb-2 tracking-widest">Pending Verification</p>
            <p className={`text-2xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{pendingRevenue.toLocaleString()} <span className="text-xs font-bold uppercase ml-1">ETB</span></p>
          </div>
        </div>
      </header>

      {/* 2. CONTROL BAR (FILTERS & SEARCH) */}
      <div className="flex flex-col md:flex-row items-center gap-6 mb-10">
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
      </div>

      {/* 3. REPORTS TABLE */}
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
              ) : filteredReports.map((report) => (
                <tr key={report.id} className="hover:bg-white/5 transition-colors">
                  <td className="p-8">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-700 to-gray-500 flex items-center justify-center text-[10px] text-white font-bold">
                        {report.sellerName?.charAt(0) || 'U'}
                      </div>
                      <span className={`text-xs font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{report.sellerName || 'Anonymous'}</span>
                    </div>
                  </td>
                  <td className="p-8">
                    <span className="font-mono text-sm font-black p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
                      {report.token}
                    </span>
                  </td>
                  <td className="p-8">
                    <div className="flex flex-col">
                      <span className={`text-lg font-black ${activeColor}`}>{report.commission} ETB</span>
                      <span className="text-[9px] font-bold text-gray-500 uppercase">15% of {report.amount} ETB</span>
                    </div>
                  </td>
                  <td className="p-8">
                    <div className={`flex items-center gap-2 text-[10px] font-black uppercase px-4 py-2 rounded-full w-fit ${
                      report.status === 'completed' ? 'bg-green-500/10 text-green-500' : 
                      report.status === 'verifying' ? 'bg-blue-500/10 text-blue-500' : 'bg-red-500/10 text-red-500'
                    }`}>
                      {report.status === 'verifying' && <Clock className="w-3 h-3" />}
                      {report.status.replace('_', ' ')}
                    </div>
                  </td>
                  <td className="p-8">
                    <button 
                      onClick={() => setSelectedReport(report)}
                      className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gray-100 dark:bg-white/5 text-[10px] font-black uppercase tracking-widest hover:bg-[#E07A5F] hover:text-white transition-all"
                    >
                      <Eye className="w-4 h-4" /> Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. VERIFICATION MODAL (INTEGRATED UI) */}
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
                  <span className="text-white text-lg">{selectedReport.commission} ETB</span><br/>
                  Check your Telebirr history for Token:<br/>
                  <span className="text-blue-500">{selectedReport.token}</span>
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
                <p className="text-[10px] text-gray-500 font-black uppercase mt-2 tracking-widest">Artisan: {selectedReport.sellerName}</p>
              </div>

              <div className="space-y-6 flex-1">
                <div className="flex justify-between items-center py-4 border-b dark:border-gray-800">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Sale</span>
                  <span className={`text-xl font-black ${isDarkMode ? 'text-white' : 'text-black'}`}>{selectedReport.amount} ETB</span>
                </div>
                <div className="flex justify-between items-center py-4 border-b dark:border-gray-800">
                  <span className="text-[10px] font-black text-[#E07A5F] uppercase tracking-widest">Our Commission (15%)</span>
                  <span className={`text-2xl font-black ${activeColor}`}>{selectedReport.commission} ETB</span>
                </div>
                <p className="text-[11px] text-gray-500 font-medium italic leading-relaxed">
                  Approval will mark the craft as "Sold" globally and award the artisan <span className="text-green-500 font-bold">+10 Trust Points</span>.
                </p>
              </div>

              {selectedReport.status === 'verifying' && (
                <div className="grid grid-cols-2 gap-4 mt-10">
                  <button 
                    onClick={async () => {
                      if(window.confirm("Flag this seller for fraud?")) {
                        await flagSellerAction(selectedReport.sellerId, selectedReport.id, selectedReport.postId);
                        setSelectedReport(null);
                      }
                    }}
                    className="flex flex-col items-center gap-2 p-5 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all group"
                  >
                    <AlertTriangle className="w-6 h-6 group-hover:scale-110 transition-transform" />
                    <span className="text-[9px] font-black uppercase">Fraud / Reject</span>
                  </button>

                  <button 
                    onClick={async () => {
                      await verifySaleAction(selectedReport.id, selectedReport.postId, selectedReport.sellerId);
                      setSelectedReport(null);
                    }}
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