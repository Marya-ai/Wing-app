// --- USER & ARTISAN PROFILE ---
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
  
  // WING ADDITIONS
  phone?: string;             // For Telebirr
  trust_score: number;        // Artisan reputation (0-100+)
  commission_rate: number;    // Chosen rate (10-25%)
  has_agreed: boolean;        // Agreement to terms
  is_admin?: boolean;         // Access to Admin Dashboard
  total_sales?: number;       // Number of verified sales
  isFlagged?: boolean;        // Fraud protection flag
  
  created_at: string;
}

// --- MARKETPLACE POSTS (CRAFTS) ---
export interface Post {
  id: string;
  user_id: string;
  author_name: string;
  author_avatar?: string;
  image_url: string;
  caption: string;
  post_type: 'finished' | 'wip';
  category: string;           // Required for filtering
  
  // WING ADDITIONS
  price: number;
  stock_count: number;
  wing_token: string;         // Unique WCT-ET-XXXXXX code
  sales_status: 'available' | 'pending_verification' | 'sold';
  trust_score: number;        // Cached from seller for feed display
  
  materials?: string[];
  tools?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
}

// --- WING SALES REPORTS (FOR ADMIN) ---
export interface SaleReport {
  id: string;
  postId: string;
  sellerId: string;
  sellerName: string;
  token: string;
  amount: number;
  commission: number;
  status: 'verifying' | 'completed' | 'fraud_flagged';
  reportedAt: any;            // Firebase Timestamp
  verifiedAt?: any;
}

// --- NOTIFICATIONS ---
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

// --- SOCIAL INTERACTIONS ---
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

// --- PRODUCTIVITY ---
export interface DailyLog {
  id: string;
  user_id: string;
  date_str: string; // YYYY-MM-DD
  focus_goal: string;
  progress_pct: number;
  reflection?: string;
  created_at: string;
}

// --- CHAT & MESSAGING ---
export interface ChatRoom {
  id: string;
  name: string;
  type: 'public' | 'private';
  participants?: string[]; 
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