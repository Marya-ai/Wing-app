import React from 'react';
import { ShieldCheck, AlertOctagon, Star } from 'lucide-react';

interface ReputationBadgeProps {
  score: number; // 0 to 100
  isBanned?: boolean;
  size?: 'sm' | 'lg';
}

export default function ReputationBadge({ score, isBanned, size = 'sm' }: ReputationBadgeProps) {
  if (isBanned) {
    return (
      <div className="flex items-center gap-1 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 font-black text-[9px] uppercase tracking-tighter">
        <AlertOctagon className="w-3 h-3" /> Fraud Risk
      </div>
    );
  }

  if (score >= 90) {
    return (
      <div className={`flex items-center gap-1 ${size === 'lg' ? 'px-4 py-2' : 'px-2 py-1'} bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-600 font-black ${size === 'lg' ? 'text-xs' : 'text-[9px]'} uppercase tracking-tighter`}>
        <Star className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} fill="currentColor" /> Top Maker
      </div>
    );
  }

  if (score >= 50) {
    return (
      <div className={`flex items-center gap-1 ${size === 'lg' ? 'px-4 py-2' : 'px-2 py-1'} bg-green-500/10 border border-green-500/20 rounded-lg text-green-600 font-black ${size === 'lg' ? 'text-xs' : 'text-[9px]'} uppercase tracking-tighter`}>
        <ShieldCheck className={size === 'lg' ? 'w-4 h-4' : 'w-3 h-3'} /> Trusted Seller
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1 bg-gray-500/10 border border-gray-500/20 rounded-lg text-gray-500 font-black text-[9px] uppercase tracking-tighter">
      New Artisan
    </div>
  );
}