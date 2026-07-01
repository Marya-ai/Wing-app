import React from 'react';
import { ShieldCheck, AlertOctagon, Star, Award, Zap } from 'lucide-react';

interface ReputationBadgeProps {
  score: number; // trust_score from Firestore
  isBanned?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function ReputationBadge({ score, isBanned, size = 'sm' }: ReputationBadgeProps) {
  
  // Size Configurations
  const sizeClasses = {
    sm: 'px-2 py-1 text-[9px] gap-1',
    md: 'px-3 py-1.5 text-[10px] gap-1.5',
    lg: 'px-4 py-2 text-xs gap-2',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  // 1. BANNED / FRAUD STATUS
  if (isBanned || score < 0) {
    return (
      <div className={`flex items-center bg-red-500/10 border border-red-500/30 rounded-full text-red-500 font-black uppercase tracking-tighter ${sizeClasses[size]}`}>
        <AlertOctagon className={iconSizes[size]} /> 
        Fraud Risk
      </div>
    );
  }

  // 2. MASTER CRAFTER (Score 90+)
  if (score >= 90) {
    return (
      <div className={`flex items-center bg-amber-500/10 border border-amber-500/40 rounded-full text-amber-500 font-black uppercase tracking-tighter animate-pulse ${sizeClasses[size]}`}>
        <Star className={iconSizes[size]} fill="currentColor" /> 
        Master Crafter
      </div>
    );
  }

  // 3. TRUSTED SELLER (Score 50-89)
  if (score >= 50) {
    return (
      <div className={`flex items-center bg-green-500/10 border border-green-500/30 rounded-full text-green-600 font-black uppercase tracking-tighter ${sizeClasses[size]}`}>
        <ShieldCheck className={iconSizes[size]} /> 
        Trusted Seller
      </div>
    );
  }

  // 4. RISING STAR (Score 20-49) - Added tier for better progression
  if (score >= 20) {
    return (
      <div className={`flex items-center bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-500 font-black uppercase tracking-tighter ${sizeClasses[size]}`}>
        <Zap className={iconSizes[size]} fill="currentColor" /> 
        Rising Star
      </div>
    );
  }

  // 5. NEW ARTISAN (Score 0-19)
  return (
    <div className={`flex items-center bg-gray-500/10 border border-gray-500/20 rounded-full text-gray-500 font-black uppercase tracking-tighter ${sizeClasses[size]}`}>
      <Award className={iconSizes[size]} /> 
      New Artisan
    </div>
  );
}