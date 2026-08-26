import { UserProfile } from '../types';

/**
 * Get user avatar with fallback logic:
 * 1. Telegram WebApp photo (if available)
 * 2. User's saved avatar_url
 * 3. Random DiceBear avatar based on Telegram ID
 */
export function getUserAvatar(user: UserProfile | null, telegramPhotoUrl?: string): string {
  // Priority 1: Telegram WebApp photo (real-time from Telegram)
  if (telegramPhotoUrl) {
    return telegramPhotoUrl;
  }
  
  // Priority 2: User's saved avatar in database
  if (user?.avatar_url) {
    return user.avatar_url;
  }
  
  // Priority 3: Generate random avatar based on Telegram ID or user ID
  const seed = user?.telegram_chat_id || user?.id || 'default';
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${seed}&backgroundColor=b6e3f4`;
}

/**
 * Get avatar for a post author
 */
export function getPostAuthorAvatar(authorId: string, authorAvatar?: string): string {
  if (authorAvatar) {
    return authorAvatar;
  }
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${authorId}&backgroundColor=c0aede`;
}