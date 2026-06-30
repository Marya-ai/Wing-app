export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  is_maker: boolean;
  theme_preference: 'light' | 'dark';
  telegram_username?: string;
  telegram_chat_id?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  sender_name: string;
  sender_avatar?: string;
  type: 'like' | 'comment' | 'system' | 'telegram' | 'message';
  post_id?: string;
  post_image?: string;
  content: string;
  created_at: string;
  read: boolean;
}

export interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  image_url: string;
  caption: string;
  post_type: 'finished' | 'wip';
  category?: string;
  materials?: string[];
  tools?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

export interface Save {
  id: string;
  user_id: string;
  post_id: string;
  board_name: string;
  created_at: string;
}

export interface DailyLog {
  id: string;
  user_id: string;
  date_str: string; // YYYY-MM-DD
  focus_goal: string;
  progress_pct: number;
  reflection?: string;
  created_at: string;
}

export interface ChatRoom {
  id: string;
  name: string;
  type: 'public' | 'private';
  participants?: string[]; // UIDs for private chats
  created_at: string;
}

export interface Message {
  id: string;
  room_id: string;
  user_id: string;
  username: string;
  avatar_url?: string;
  content: string;
  image_url?: string;
  created_at: string;
}
