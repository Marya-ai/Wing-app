// --- TELEGRAM WEBAPP TYPES ---
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
            photo_url?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        MainButton?: any;
        BackButton?: any;
      };
    };
  }
}

// --- USER & ARTISAN PROFILE ---
export interface UserProfile {
  id: string;
  username: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  is_maker: boolean;          // DEPRECATED: Use 'role' instead
  theme_preference: 'light' | 'dark';
  telegram_username?: string;
  telegram_chat_id?: string;
  
  // PLAN A & MANAGED MARKETPLACE FIELDS
  phone_number?: string;      // For Telebirr payouts (hidden from public)
  role: 'buyer' | 'seller' | 'both' | 'admin';  // Account type
  business_scale: 'small' | 'medium' | 'large'; // Commission tier
  agreed_to_terms: boolean;   // Digital signature agreement
  is_limited: boolean;        // Account limited due to unpaid commission
  is_verified: boolean;       // Email verified
  
  // WING ADDITIONS (Legacy/Compatibility)
  phone?: string;             // DEPRECATED: Use phone_number
  trust_score: number;        // Artisan reputation (0-100+)
  commission_rate: number;    // Chosen rate (10-25%)
  has_agreed: boolean;        // DEPRECATED: Use agreed_to_terms
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
  stock_count: number;        // Legacy field
  stock_quantity?: number;    // NEW: Matches database stock_quantity
  seller_subcity?: string;    // NEW: For delivery calculation (e.g., 'Bole', 'Kirkos')
  wing_token: string;         // Unique WCT-ET-XXXXXX code
  sales_status: 'available' | 'pending_verification' | 'sold';
  trust_score: number;        // Cached from seller for feed display
  
  materials?: string[];
  tools?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
}

// --- MANAGED MARKETPLACE ORDERS (NEW) ---
export interface Order {
  id: string;
  order_token: string;              // e.g., "ORD-A1B2C3"
  buyer_id: string;
  seller_id: string;
  post_id: string;
  quantity: number;
  selected_color: string;
  buyer_subcity: string;            // e.g., "Bole", "Ayat"
  buyer_address: string;            // Detailed delivery address
  buyer_phone: string;              // Hidden from seller, visible to Admin/Courier
  delivery_method: 'motorbike' | 'isuzu' | 'bus_station' | 'pickup';
  item_price: number;
  commission_fee: number;
  delivery_fee: number;
  total_amount: number;
  status: 'pending_payment' | 'paid' | 'dispatched' | 'delivered' | 'cancelled';
  created_at: string;
  
  // Optional fields populated by Admin JOIN queries for UI display
  item_name?: string;
  buyer_name?: string;
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
  reportedAt: any;            // Firebase Timestamp or Date string
  verifiedAt?: any;
}

// --- NOTIFICATIONS ---
export interface Notification {
  id: string;
  user_id: string;
  sender_name: string;
  sender_avatar?: string;
  type: 'like' | 'comment' | 'system' | 'telegram' | 'message' | 'order_update';
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

// --- COMMISSION & ESCROW (LEGACY/HYBRID) ---
export interface Commission {
  id: string;
  seller_id: string;
  buyer_id: string;
  post_id: string;
  item_price: number;
  commission_amount: number;
  total_amount: number;
  unique_code: string;        // The decimal code (e.g., "83")
  expected_amount: string;    // Full amount with decimal (e.g., "220.83")
  token: string;              // WING-uuid token
  status: 'PENDING_BUYER_PAYMENT' | 'PENDING_SELLER_CONFIRM' | 'ACTIVE' | 'COMPLETED' | 'REFUNDED';
  created_at: string;
}