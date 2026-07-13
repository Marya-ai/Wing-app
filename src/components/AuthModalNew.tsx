import React, { useState, useEffect } from 'react';
import { X, Mail, Lock, User, Wallet, Globe, TrendingUp, Info, ArrowRight, Sparkles, CheckCircle, AlertTriangle, RefreshCw } from 'lucide-react';

// Declare Telegram WebApp types to prevent TypeScript errors
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initDataUnsafe?: {
          user?: {
            id: number;
            username?: string;
            first_name?: string;
            last_name?: string;
          };
        };
        ready: () => void;
        expand: () => void;
      };
    };
  }
}

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: any, token: string) => void;
}

type ViewMode = 'login' | 'register' | 'verify-email' | 'forgot-password' | 'reset-password';

export default function AuthModal({ isOpen, onClose, onLoginSuccess }: AuthModalProps) {
  const [view, setView] = useState<ViewMode>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [resetToken, setResetToken] = useState('');

  // ✅ FIXED: Get Telegram ID with debug logging
  const telegramId = (() => {
    const sdkId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString();
    const urlId = new URLSearchParams(window.location.search).get('tg_id');
    
    // Debug log to console
    console.log('=== TELEGRAM ID DEBUG ===');
    console.log('SDK User Data:', window.Telegram?.WebApp?.initDataUnsafe?.user);
    console.log('SDK Extracted ID:', sdkId);
    console.log('URL Param ID:', urlId);
    console.log('Final Telegram ID:', sdkId || urlId || '');
    console.log('========================');
    
    return sdkId || urlId || '';
  })();

  // Initialize Telegram WebApp when modal opens
  useEffect(() => {
    if (isOpen && window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Auto-fill form with Telegram data if available
      const tgUser = window.Telegram.WebApp.initDataUnsafe?.user;
      if (tgUser && view === 'register') {
        setFormData(prev => ({
          ...prev,
          fullName: `${tgUser.first_name || ''} ${tgUser.last_name || ''}`.trim(),
          username: tgUser.username || prev.username
        }));
      }
    }
  }, [isOpen, view]);

  // Animation trigger
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      document.body.style.overflow = 'hidden';
    } else {
      const timer = setTimeout(() => setMounted(false), 300);
      document.body.style.overflow = '';
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const [formData, setFormData] = useState({
    email: '', 
    password: '', 
    confirmPassword: '',
    fullName: '', 
    username: '', 
    isMaker: false,
    businessScale: 'small' as 'small' | 'medium' | 'large', 
    tgWallet: '', 
    tiktok: '',
    agreedToTerms: false
  });

  if (!mounted && !isOpen) return null;

  const API_BASE = process.env.NODE_ENV === 'production' 
    ? 'https://wing-artisan-bot.onrender.com' 
    : 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // VALIDATION FOR REGISTRATION
      if (view === 'register') {
        if (!formData.agreedToTerms) throw new Error("You must agree to the Terms of Service");
        if (formData.password !== formData.confirmPassword) throw new Error("Passwords do not match");
        if (formData.password.length < 8) throw new Error("Password must be at least 8 characters");
        if (!telegramId) throw new Error("⚠️ Please open this via @WingArtisanBot to link your account");
      }

      // REGISTER FLOW
      if (view === 'register') {
        const response = await fetch(`${API_BASE}/api/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password,
            full_name: formData.fullName,
            username: formData.username,
            telegram_id: telegramId,
            role: formData.isMaker ? 'seller' : 'buyer',
            business_scale: formData.businessScale,
            trust_score: 10,
            tg_wallet: formData.tgWallet,
            tiktok: formData.tiktok,
            agreed_to_terms: formData.agreedToTerms
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Registration failed');
        
        setVerificationEmail(formData.email);
        setView('verify-email');
        setSuccessMessage("✅ Account created! Please verify your email.");
      }
      
      // LOGIN FLOW
      else if (view === 'login') {
        const response = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            password: formData.password
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Login failed');
        
        localStorage.setItem('wing_access_token', data.accessToken);
        onLoginSuccess(data.user, data.accessToken);
        onClose();
      }

      // FORGOT PASSWORD FLOW
      else if (view === 'forgot-password') {
        const response = await fetch(`${API_BASE}/api/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: formData.email })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to send reset email');
        
        setSuccessMessage(" Password reset link sent! Check your inbox.");
        setTimeout(() => setView('login'), 3000);
      }

      // RESET PASSWORD FLOW
      else if (view === 'reset-password') {
        const response = await fetch(`${API_BASE}/api/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: resetToken,
            password: formData.password
          })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to reset password');
        
        setSuccessMessage(" Password reset successful! You can now login.");
        setTimeout(() => setView('login'), 2000);
      }

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
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />

      <div className={`relative bg-[#FAF9F6] w-full max-w-lg h-[90vh] sm:h-auto sm:max-h-[85vh] rounded-t-[2rem] sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-out ${isOpen ? 'translate-y-0 sm:scale-100' : 'translate-y-full sm:translate-y-10 sm:scale-95'}`}>
        
        {/* HEADER */}
        <div className="p-6 pb-4 flex justify-between items-start bg-[#FAF9F6] shrink-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              {view === 'register' ? <Sparkles className="w-6 h-6 text-[#E07A5F]" /> : 
               view === 'verify-email' ? <CheckCircle className="w-6 h-6 text-green-500" /> :
               view === 'forgot-password' || view === 'reset-password' ? <Lock className="w-6 h-6 text-[#E07A5F]" /> :
               <User className="w-6 h-6 text-[#E07A5F]" />}
              {view === 'register' ? 'Artisan Registration' : 
               view === 'verify-email' ? 'Verify Your Email' :
               view === 'forgot-password' ? 'Reset Password' :
               view === 'reset-password' ? 'Set New Password' :
               'Welcome Back'}
            </h2>
            <p className="text-sm text-slate-500 mt-1 font-medium">
              {view === 'register' ? 'Join our global community of makers.' : 
               view === 'verify-email' ? `We sent a link to ${verificationEmail}` :
               view === 'forgot-password' ? 'Enter your email to receive reset link.' :
               view === 'reset-password' ? 'Create a strong new password.' :
               'Sign in to continue your creative journey.'}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200/50 rounded-full transition-colors text-slate-400 hover:text-slate-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* SUCCESS MESSAGE */}
        {successMessage && (
          <div className="mx-6 p-4 bg-green-50 border border-green-100 text-green-700 text-sm rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <CheckCircle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{successMessage}</span>
          </div>
        )}

        {/* ERROR BANNER */}
        {error && (
          <div className="mx-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {/* FORM AREA */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 pb-6 space-y-5 scrollbar-hide">
          
          {/* EMAIL VERIFICATION VIEW */}
          {view === 'verify-email' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Mail className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-slate-600">Please check your inbox and click the verification link to activate your account.</p>
              <button type="button" onClick={() => setView('login')} className="text-[#E07A5F] font-bold hover:underline">
                ← Back to Login
              </button>
            </div>
          )}

          {/* ALL OTHER VIEWS */}
          {view !== 'verify-email' && (
            <>
              {/* EMAIL FIELD (Always shown except reset-password) */}
              {view !== 'reset-password' && (
                <div>
                  <label className={labelClass}><Mail className="w-3 h-3 inline mr-1"/> Email Address</label>
                  <input required type="email" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} className={inputClass} placeholder="maker@example.com" />
                </div>
              )}
              
              {/* PASSWORD FIELD */}
              {(view === 'login' || view === 'register' || view === 'reset-password') && (
                <div>
                  <label className={labelClass}><Lock className="w-3 h-3 inline mr-1"/> Password</label>
                  <input required type="password" value={formData.password} onChange={e=>setFormData({...formData, password: e.target.value})} className={inputClass} placeholder="••••••••" />
                </div>
              )}

              {/* CONFIRM PASSWORD (Register & Reset only) */}
              {(view === 'register' || view === 'reset-password') && (
                <div>
                  <label className={labelClass}><Lock className="w-3 h-3 inline mr-1"/> Confirm Password</label>
                  <input required type="password" value={formData.confirmPassword} onChange={e=>setFormData({...formData, confirmPassword: e.target.value})} className={inputClass} placeholder="••••••••" />
                </div>
              )}

              {/* FORGOT PASSWORD LINK (Login only) */}
              {view === 'login' && (
                <button type="button" onClick={() => setView('forgot-password')} className="text-right text-xs font-bold text-[#E07A5F] hover:underline w-full">
                  Forgot Password?
                </button>
              )}

              {/* REGISTRATION SPECIFIC FIELDS */}
              {view === 'register' && (
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

                  {/* MAKER TOGGLE */}
                  <label className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-200 cursor-pointer hover:bg-amber-100/50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${formData.isMaker ? 'bg-[#E07A5F] border-[#E07A5F]' : 'border-slate-300 bg-white'}`}>
                        {formData.isMaker && <ArrowRight className="w-3 h-3 text-white rotate-[-45deg]" />}
                      </div>
                      <span className="text-sm font-black text-slate-800 group-hover:text-[#E07A5F] transition-colors">Register as a Maker?</span>
                    </div>
                    <input type="checkbox" checked={formData.isMaker} onChange={e=>setFormData({...formData, isMaker: e.target.checked})} className="hidden" />
                  </label>

                  {/* MAKER DETAILS */}
                  {formData.isMaker && (
                    <div className="overflow-hidden transition-all duration-500 ease-in-out max-h-[800px] opacity-100">
                      <div className="border-l-4 border-[#E07A5F] pl-5 py-2 space-y-5 bg-white/50 p-5 rounded-r-2xl">
                        
                        {/* BUSINESS SCALE SELECTOR */}
                        <div>
                          <label className={labelClass}>Business Scale & Commission Rate</label>
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
                                {s.toUpperCase()} <br/> {s === 'small' ? '10%' : s === 'medium' ? '15%' : '25%'}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}><Wallet className="w-3 h-3 inline mr-1"/> Telegram Wallet</label>
                          <input placeholder="@username or TON address" value={formData.tgWallet} onChange={e=>setFormData({...formData, tgWallet: e.target.value})} className={inputClass} />
                        </div>

                        <div>
                          <label className={labelClass}><Globe className="w-3 h-3 inline mr-1"/> Social / Company</label>
                          <input placeholder="TikTok link or Company Name" value={formData.tiktok} onChange={e=>setFormData({...formData, tiktok: e.target.value})} className={inputClass} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TERMS AGREEMENT */}
                  <label className="flex items-start gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 cursor-pointer">
                    <div className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${formData.agreedToTerms ? 'bg-[#E07A5F] border-[#E07A5F]' : 'border-slate-300 bg-white'}`}>
                      {formData.agreedToTerms && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className="text-xs text-slate-600 leading-relaxed">
                      I agree to the <span className="font-bold text-[#E07A5F]">Wing Artisan Alliance Terms</span>. I understand that commissions are mandatory for all sales and failure to pay will result in account limitation.
                    </span>
                    <input type="checkbox" checked={formData.agreedToTerms} onChange={e=>setFormData({...formData, agreedToTerms: e.target.checked})} className="hidden" />
                  </label>
                </div>
              )}
            </>
          )}
        </form>

        {/* FOOTER ACTIONS */}
        <div className="p-6 bg-[#FAF9F6] border-t border-slate-100 shrink-0">
          <button 
            onClick={handleSubmit} 
            disabled={loading} 
            className="w-full py-4 bg-[#E07A5F] hover:bg-[#d06a4f] text-white rounded-[2rem] font-black uppercase shadow-xl shadow-[#E07A5F]/20 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <>
                {view === 'register' ? 'Start Artisan Journey' : 
                 view === 'forgot-password' ? 'Send Reset Link' :
                 view === 'reset-password' ? 'Reset Password' :
                 'Sign In'}
                <ArrowRight className="w-5 h-5" />
              </>
            )}
          </button>
          
          {/* VIEW SWITCHER */}
          {view === 'login' && (
            <button type="button" onClick={()=>{ setView('register'); setError(null); }} className="w-full mt-4 text-xs font-black text-slate-400 hover:text-[#E07A5F] transition-colors uppercase tracking-widest">
              Need an account? Register →
            </button>
          )}
          {view === 'register' && (
            <button type="button" onClick={()=>{ setView('login'); setError(null); }} className="w-full mt-4 text-xs font-black text-slate-400 hover:text-[#E07A5F] transition-colors uppercase tracking-widest">
              ← Already have an account? Sign In
            </button>
          )}
          {(view === 'forgot-password' || view === 'reset-password') && (
            <button type="button" onClick={()=>{ setView('login'); setError(null); }} className="w-full mt-4 text-xs font-black text-slate-400 hover:text-[#E07A5F] transition-colors uppercase tracking-widest">
              ← Back to Sign In
            </button>
          )}
        </div>
      </div>
    </div>
  );
}