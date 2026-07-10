import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Wallet, Building2, Globe, TrendingUp, Info, ArrowRight, Sparkles } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any, token: string) => void;
}

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Animation trigger for opening/closing
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setMounted(false), 300);x
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', username: '', isMaker: false,
    businessScale: 'small' as 'small' | 'medium' | 'large', 
    tgWallet: '', minEarning: '', maxEarning: '',
    companyName: '', tiktok: '', website: ''
  });

  if (!mounted && !isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const endpoint = isRegistering 
        ? 'http://localhost:3000/api/auth/register'
        : 'http://localhost:3000/api/auth/login';

      const payload = isRegistering
        ? {
            email: formData.email,
            password: formData.password,
            full_name: formData.fullName,
            role: formData.isMaker ? 'seller' : 'buyer'
          }
        : {
            email: formData.email,
            password: formData.password
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      // Store JWT token
      localStorage.setItem('wing_access_token', data.accessToken);

      // Notify parent component
      onLoginSuccess(data.user, data.accessToken);
      onClose();

    } catch (err: any) { 
      setError(err.message || 'An unexpected error occurred.'); 
    } finally { 
      setLoading(false); 
    }
  };

  const inputClass = "w-full p-4 border border-slate-200 rounded-2xl bg-white text-slate-900 placeholder:text-slate-400 focus:border-[#E07A5F] focus:ring-4 focus:ring-[#E07A5F]/10 outline-none transition-all duration-200 font-medium";
  const labelClass = "block text-xs font-black uppercase tracking-wider text-slate-500 mb-2 ml-1";

  return (
    <div className={`fixed inset-0 z-[100] flex items-end sm:items-center justify-center transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      {/* Modal Container */}
      <div className={`relative bg-[#FAF9F6] w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-10 sm:scale-95'}`}>
        
        {/* Header */}
        <div className="p-6 pb-4 flex justify-between items-start bg-[#FAF9F6] shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              {isRegistering ? <Sparkles className="w-6 h-6 text-[#E07A5F]" /> : <User className="w-6 h-6 text-[#E07A5F]" />}
              {isRegistering ? 'Artisan Registration' : 'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {isRegistering ? 'Join our global community of makers.' : 'Sign in to continue your creative journey.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Form Area */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 scrollbar-hide">
          
          {/* Error Banner */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
              <Info className="w-5 h-5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          {/* Core Credentials */}
          <div className="space-y-4">
            <div>
              <label className={labelClass}><Mail className="w-3 h-3 inline mr-1"/> Email Address</label>
              <input required type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="maker@example.com" />
            </div>
            
            <div>
              <label className={labelClass}><Lock className="w-3 h-3 inline mr-1"/> Password</label>
              <input required type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className={inputClass} placeholder="••••••••" />
            </div>
          </div>

          {/* Registration Specific Fields */}
          {isRegistering && (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div>
                <label className={labelClass}><User className="w-3 h-3 inline mr-1"/> Full Name</label>
                <input required value={formData.fullName} onChange={e=>setFormData({...formData, fullName: e.target.value})} className={inputClass} placeholder="Your artisan name" />
              </div>

              <div>
                <label className={labelClass}>Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">@</span>
                  <input required value={formData.username} onChange={e=>setFormData({...formData, username: e.target.value.replace(/[^a-zA-Z0-9_]/g, '')})} className={`${inputClass} pl-8`} placeholder="username" />
                </div>
              </div>

              {/* Maker Toggle */}
              <label className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors group">
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.isMaker ? 'bg-[#E07A5F] border-[#E07A5F]' : 'border-slate-300 bg-white'}`}>
                    {formData.isMaker && <ArrowRight className="w-3 h-3 text-white rotate-[-45deg]" />}
                  </div>
                  <span className="text-sm font-black text-slate-800 group-hover:text-[#E07A5F] transition-colors">Register as a Maker?</span>
                </div>
                <input type="checkbox" checked={formData.isMaker} onChange={e=>setFormData({...formData, isMaker: e.target.checked})} className="hidden" />
              </label>

              {/* Maker Details - Animated Slide Down */}
              <div className={`overflow-hidden transition-all duration-500 ease-in-out ${formData.isMaker ? 'max-h-[800px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="border-l-4 border-[#E07A5F] pl-5 py-2 space-y-5 bg-white/50 p-5 rounded-r-2xl">
                  
                  {/* Business Scale Selector */}
                  <div>
                    <label className={labelClass}>Business Scale & Commission</label>
                    <div className="grid grid-cols-3 gap-2">
                      {(['small', 'medium', 'large'] as const).map(s => (
                        <button 
                          key={s} 
                          type="button" 
                          onClick={()=>setFormData({...formData, businessScale: s})} 
                          className={`py-3 rounded-xl text-[10px] font-black uppercase border-2 transition-all duration-200 ${
                            formData.businessScale === s 
                              ? 'bg-[#E07A5F] text-white border-[#E07A5F] shadow-lg shadow-[#E07A5F]/20 scale-[1.02]' 
                              : 'bg-white border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          {s} <br/> {s === 'small' ? '10%' : s === 'medium' ? '15%' : '25%'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}><Wallet className="w-3 h-3 inline mr-1"/> Telegram Wallet</label>
                    <input placeholder="@username or TON address" value={formData.tgWallet} onChange={e=>setFormData({...formData, tgWallet: e.target.value})} className={inputClass} />
                  </div>

                  <div>
                    <label className={labelClass}><TrendingUp className="w-3 h-3 inline mr-1"/> Expected Earnings (ETB)</label>
                    <div className="flex gap-3">
                      <input placeholder="Min" type="number" value={formData.minEarning} onChange={e=>setFormData({...formData, minEarning: e.target.value})} className={`${inputClass} flex-1`} />
                      <span className="self-center text-slate-400 font-bold">-</span>
                      <input placeholder="Max" type="number" value={formData.maxEarning} onChange={e=>setFormData({...formData, maxEarning: e.target.value})} className={`${inputClass} flex-1`} />
                    </div>
                  </div>

                  <div>
                    <label className={labelClass}><Globe className="w-3 h-3 inline mr-1"/> Social / Company</label>
                    <input placeholder="TikTok link or Company Name" value={formData.tiktok} onChange={e=>setFormData({...formData, tiktok: e.target.value})} className={inputClass} />
                  </div>
                </div>
              </div>
            </div>
          )}
        </form>

        {/* Footer Actions */}
        <div className="p-6 bg-[#FAF9F6] border-t border-slate-100 shrink-0">
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full py-4 bg-[#E07A5F] hover:bg-[#d06a4f] text-white rounded-[2rem] font-black uppercase shadow-xl shadow-[#E07A5F]/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {isRegistering ? 'Start Artisan Journey' : 'Sign In'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          
          <button 
            type="button" 
            onClick={()=>{ setIsRegistering(!isRegistering); setError(null); }} 
            className="w-full mt-4 text-xs font-black text-slate-400 hover:text-[#E07A5F] transition-colors uppercase tracking-widest"
          >
            {isRegistering ? '← Switch to Sign In' : 'Need an account? Register →'}
          </button>
        </div>
      </div>
    </div>
  );
}