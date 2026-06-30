import { 
  collection, 
  doc, 
  getDocs, 
  addDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  increment,
  getDoc,
  limit,
  writeBatch,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { Post, Comment, Save, DailyLog, ChatRoom, Message, UserProfile, Notification } from '../types';

// --- SEEDING & INITIALIZATION ---

export async function seedDatabaseIfEmpty() {
  try {
    const postsCol = collection(db, 'posts');
    const q = query(postsCol, limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      console.log("Seeding WING database with stunning artisan crafts...");

      // 1. Seed public chat rooms
      const chatRooms = [
        { id: 'textiles-fiber', name: ' Textiles & Fiber Arts', type: 'public', created_at: new Date().toISOString() },
        { id: 'woodwork', name: ' Woodwork', type: 'public', created_at: new Date().toISOString() },
        { id: 'ceramics-pottery', name: '🪔 Ceramics & Pottery', type: 'public', created_at: new Date().toISOString() },
        { id: 'jewelry-accessories', name: '💍 Jewelry & Accessories', type: 'public', created_at: new Date().toISOString() },
        { id: 'crochet-knitting', name: '🧶 Crochet & Knitting', type: 'public', created_at: new Date().toISOString() },
        { id: 'leatherwork', name: '🪡 Leatherwork', type: 'public', created_at: new Date().toISOString() },
        { id: 'metalwork', name: '🧱 Metalwork', type: 'public', created_at: new Date().toISOString() },
        { id: 'painting-visual', name: '🎨 Painting & Visual Arts', type: 'public', created_at: new Date().toISOString() },
        { id: 'home-decor-crafts', name: '🪑 Home Décor Crafts', type: 'public', created_at: new Date().toISOString() },
        { id: 'basketry-natural', name: '🧺 Basketry & Natural Fiber', type: 'public', created_at: new Date().toISOString() },
        { id: 'cultural-traditional', name: '🪆 Cultural & Traditional', type: 'public', created_at: new Date().toISOString() },
        { id: 'handmade-toys', name: '🧸 Handmade Toys', type: 'public', created_at: new Date().toISOString() },
        { id: 'lifestyle-crafts', name: '🕯️ Lifestyle Crafts', type: 'public', created_at: new Date().toISOString() },
        { id: 'general-chat', name: '💬 General Discussion', type: 'public', created_at: new Date().toISOString() },
        { id: 'showcase', name: '✨ Craft Showcase', type: 'public', created_at: new Date().toISOString() },
      ];

      for (const room of chatRooms) {
        await setDoc(doc(db, 'chat_rooms', room.id), room);
        
        const welcomeMsg = {
          room_id: room.id,
          user_id: 'wing-guide',
          username: 'Wing Guide ',
          avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=150',
          content: `Welcome to the ${room.name} guild! Share your progress, ask for technique advice, or showcase your latest masterpieces!`,
          created_at: new Date().toISOString()
        };
        await addDoc(collection(db, 'chat_rooms', room.id, 'messages'), welcomeMsg);
      }

      // 2. Seed starter posts
      const samplePosts = [
        {
          id: 'seed-post-1',
          user_id: 'maker-elena',
          author_name: 'Elena Rostova',
          author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
          image_url: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&q=80&w=800',
          caption: 'Just finished glazing this ocean-inspired ceramic vase. It features a speckled reduction glaze with a cobalt slip finish. Ready for its final kiln firing!',
          post_type: 'finished',
          materials: ['Stoneware Clay', 'Cobalt Speckled Glaze', 'Alumina Slip'],
          tools: ['Pottery Wheel', 'Rib Tool', 'Kiln'],
          likes_count: 42,
          comments_count: 2,
          created_at: new Date(Date.now() - 3600000 * 4).toISOString()
        },
        {
          id: 'seed-post-2',
          user_id: 'maker-rowan',
          author_name: 'Rowan Birchwood',
          author_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
          image_url: 'https://images.unsplash.com/photo-1606744824163-985d376605aa?auto=format&fit=crop&q=80&w=800',
          caption: 'Carving a rustic cherry wood bowl today. Capturing the organic grain patterns of this fallen tree branch. Slow, therapeutic work.',
          post_type: 'wip',
          materials: ['Cherry Wood', 'Organic Linseed Oil'],
          tools: ['Gouge Chisel', 'Wood Lathe', 'Scraper'],
          likes_count: 58,
          comments_count: 1,
          created_at: new Date(Date.now() - 3600000 * 12).toISOString()
        },
        {
          id: 'seed-post-3',
          user_id: 'maker-clara',
          author_name: 'Clara Weaver',
          author_avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=150',
          image_url: 'https://images.unsplash.com/photo-1520638029051-190c747594d4?auto=format&fit=crop&q=80&w=800',
          caption: 'Wrapping up this traditional hand-woven merino wool scarf. Soft, thick, and colored with natural indigo and marigold dyes.',
          post_type: 'finished',
          materials: ['Merino Wool', 'Natural Indigo Dye', 'Marigold Petals'],
          tools: ['Rigid Heddle Loom', 'Shuttle', 'Tapestry Needle'],
          likes_count: 29,
          comments_count: 0,
          created_at: new Date(Date.now() - 3600000 * 24).toISOString()
        },
        {
          id: 'seed-post-4',
          user_id: 'maker-marcus',
          author_name: 'Marcus Sterling',
          author_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=150',
          image_url: 'https://images.unsplash.com/photo-1599643478518-a784e5dc4c8f?auto=format&fit=crop&q=80&w=800',
          caption: 'Forming a custom sterling silver ring band. Annealing the metal to make it malleable before hammer texture work.',
          post_type: 'wip',
          materials: ['925 Sterling Silver Wire'],
          tools: ['Butane Torch', 'Ball-Peen Hammer', 'Mandrel'],
          likes_count: 73,
          comments_count: 3,
          created_at: new Date(Date.now() - 3600000 * 36).toISOString()
        },
        {
          id: 'seed-post-5',
          user_id: 'maker-elena',
          author_name: 'Elena Rostova',
          author_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
          image_url: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&q=80&w=800',
          caption: 'Cozy clay mugs fresh from the studio. Glazed in a warm honey drip pattern. Ready for morning coffee routines.',
          post_type: 'finished',
          materials: ['Terracotta Clay', 'Honey Drip Glaze'],
          tools: ['Ribbon Tool', 'Pottery Wheel'],
          likes_count: 95,
          comments_count: 1,
          created_at: new Date(Date.now() - 3600000 * 48).toISOString()
        }
      ];

      for (const p of samplePosts) {
        await setDoc(doc(db, 'posts', p.id), p);
      }

      // Add starter comments
      const sampleComments = [
        {
          post_id: 'seed-post-1',
          user_id: 'maker-rowan',
          username: 'Rowan Birchwood',
          avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=150',
          content: 'That cobalt speckled gaze is magnificent Elena! Looking forward to seeing the final gloss after kiln firing.',
          created_at: new Date(Date.now() - 3600000 * 3).toISOString()
        },
        {
          post_id: 'seed-post-2',
          user_id: 'maker-elena',
          username: 'Elena Rostova',
          avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=150',
          content: 'Wow Rowan! The grain flow in cherry wood is always so warm. Is this for a matching kitchen set?',
          created_at: new Date(Date.now() - 3600000 * 10).toISOString()
        }
      ];

      for (const comm of sampleComments) {
        await addDoc(collection(db, 'posts', comm.post_id, 'comments'), comm);
      }
    }
  } catch (error) {
    console.warn("Silent failure during database seeding.", error);
  }
}

// --- PROFILE SERVICES ---

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const profileDoc = await getDoc(doc(db, 'profiles', uid));
  return profileDoc.exists() ? (profileDoc.data() as UserProfile) : null;
}

export async function createOrUpdateProfile(uid: string, profile: Partial<UserProfile>): Promise<void> {
  const docRef = doc(db, 'profiles', uid);
  await setDoc(docRef, {
    id: uid,
    username: profile.username || `artisan_${uid.slice(0, 5)}`,
    full_name: profile.full_name || 'Anonymous Maker',
    avatar_url: profile.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
    bio: profile.bio || 'Craft enthusiast on WING.',
    is_maker: profile.is_maker ?? true,
    theme_preference: profile.theme_preference || 'light',
    created_at: profile.created_at || new Date().toISOString()
  }, { merge: true });
}

// --- POSTS SERVICES ---

export async function fetchAllPosts(): Promise<Post[]> {
  const querySnapshot = await getDocs(query(collection(db, 'posts'), orderBy('created_at', 'desc')));
  const posts: Post[] = [];
  querySnapshot.forEach(doc => {
    posts.push({ id: doc.id, ...doc.data() } as Post);
  });
  return posts;
}

export async function addPost(postData: Omit<Post, 'id' | 'likes_count' | 'comments_count' | 'created_at'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'posts'), {
    ...postData,
    likes_count: 0,
    comments_count: 0,
    created_at: new Date().toISOString()
  });
  return docRef.id;
}

export async function incrementLikes(postId: string): Promise<void> {
  await updateDoc(doc(db, 'posts', postId), {
    likes_count: increment(1)
  });
}

// --- COMMENTS & NOTIFICATION SERVICES ---

export async function fetchComments(postId: string): Promise<Comment[]> {
  const querySnapshot = await getDocs(
    query(collection(db, 'posts', postId, 'comments'), orderBy('created_at', 'asc'))
  );
  const comments: Comment[] = [];
  querySnapshot.forEach(doc => {
    comments.push({ id: doc.id, ...doc.data() } as Comment);
  });
  return comments;
}

/**
 * Adds a comment AND triggers a notification to the post author.
 * Prevents self-notifications and handles missing author data gracefully.
 */
export async function addComment(postId: string, commentData: Omit<Comment, 'id' | 'created_at'>): Promise<void> {
  const batch = writeBatch(db);
  
  // 1. Add the comment
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  batch.set(commentRef, {
    ...commentData,
    created_at: new Date().toISOString()
  });

  // 2. Increment post comment count
  const postRef = doc(db, 'posts', postId);
  batch.update(postRef, { comments_count: increment(1) });

  // 3. Create notification for post author (if not self-commenting)
  try {
    const postSnap = await getDoc(postRef);
    if (postSnap.exists()) {
      const postData = postSnap.data() as Post;
      
      // Only notify if commenter != author
      if (postData.user_id && postData.user_id !== commentData.user_id) {
        const notifRef = doc(collection(db, 'notifications'));
        batch.set(notifRef, {
          user_id: postData.user_id,
          sender_name: commentData.username || 'Anonymous',
          sender_avatar: commentData.avatar_url,
          type: 'comment',
          post_id: postId,
          post_image: postData.image_url,
          content: `${commentData.username || 'Someone'} commented: "${commentData.content.substring(0, 50)}${commentData.content.length > 50 ? '...' : ''}"`,
          created_at: new Date().toISOString(),
          read: false
        });
      }
    }
  } catch (err) {
    console.error("Failed to prepare comment notification:", err);
    // Don't fail the comment if notification prep fails
  }

  await batch.commit();
}

// --- SAVES / COLLECTION SERVICES ---

export async function savePostToBoard(userId: string, postId: string, boardName: string = 'Default'): Promise<void> {
  const id = `${userId}_${postId}`;
  await setDoc(doc(db, 'saves', id), {
    id,
    user_id: userId,
    post_id: postId,
    board_name: boardName,
    created_at: new Date().toISOString()
  });
}

export async function fetchSavedPosts(userId: string): Promise<string[]> {
  const q = query(collection(db, 'saves'), where('user_id', '==', userId));
  const querySnapshot = await getDocs(q);
  const postIds: string[] = [];
  querySnapshot.forEach(doc => {
    const data = doc.data() as Save;
    postIds.push(data.post_id);
  });
  return postIds;
}

export async function fetchSavesDetailed(userId: string): Promise<Save[]> {
  const q = query(collection(db, 'saves'), where('user_id', '==', userId));
  const querySnapshot = await getDocs(q);
  const saves: Save[] = [];
  querySnapshot.forEach(doc => {
    saves.push(doc.data() as Save);
  });
  return saves;
}

// --- DAILY LOGS SERVICES (MAKER STUDIO) ---

export async function fetchDailyLog(userId: string, dateStr: string): Promise<DailyLog | null> {
  const q = query(
    collection(db, 'daily_logs'),
    where('user_id', '==', userId),
    where('date_str', '==', dateStr),
    limit(1)
  );
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const docSnap = querySnapshot.docs[0];
    return { id: docSnap.id, ...docSnap.data() } as DailyLog;
  }
  return null;
}

export async function saveDailyLog(logData: Omit<DailyLog, 'id' | 'created_at'>): Promise<void> {
  const id = `${logData.user_id}_${logData.date_str}`;
  await setDoc(doc(db, 'daily_logs', id), {
    ...logData,
    id,
    created_at: new Date().toISOString()
  }, { merge: true });
}

// --- STREAK SERVICE (NEW FOR FEED) ---

/**
 * Calculates current streak based on consecutive days with activity.
 * Activity = posted craft OR saved daily log
 */
export async function calculateUserStreak(userId: string): Promise<{ streak: number; lastActiveDate: string | null }> {
  try {
    // Get user's posts sorted by date desc
    const postsQ = query(
      collection(db, 'posts'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    const postsSnap = await getDocs(postsQ);
    
    // Get user's daily logs sorted by date desc  
    const logsQ = query(
      collection(db, 'daily_logs'),
      where('user_id', '==', userId),
      orderBy('date_str', 'desc')
    );
    const logsSnap = await getDocs(logsQ);

    // Combine all activity dates
    const activityDates = new Set<string>();
    
    postsSnap.forEach(doc => {
      const data = doc.data() as Post;
      if (data.created_at) {
        activityDates.add(data.created_at.split('T')[0]);
      }
    });
    
    logsSnap.forEach(doc => {
      const data = doc.data() as DailyLog;
      if (data.date_str) {
        activityDates.add(data.date_str);
      }
    });

    if (activityDates.size === 0) {
      return { streak: 0, lastActiveDate: null };
    }

    // Sort dates descending and calculate consecutive streak
    const sortedDates = Array.from(activityDates).sort((a, b) => b.localeCompare(a));
    let streak = 1;
    let currentDate = new Date(sortedDates[0] + 'T00:00:00');
    
    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i] + 'T00:00:00');
      const diffDays = Math.round((currentDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
        currentDate = prevDate;
      } else {
        break;
      }
    }

    return { streak, lastActiveDate: sortedDates[0] };
  } catch (err) {
    console.error("Failed to calculate streak:", err);
    return { streak: 0, lastActiveDate: null };
  }
}

// --- REALTIME CHAT SERVICES ---

export function listenToRoomMessages(roomId: string, callback: (messages: Message[]) => void) {
  const q = query(
    collection(db, 'chat_rooms', roomId, 'messages'),
    orderBy('created_at', 'asc')
  );
  return onSnapshot(q, (snapshot) => {
    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      messages.push({ id: doc.id, ...doc.data() } as Message);
    });
    callback(messages);
  });
}

export async function sendMessage(roomId: string, messageData: Omit<Message, 'id' | 'created_at'>): Promise<void> {
  await addDoc(collection(db, 'chat_rooms', roomId, 'messages'), {
    ...messageData,
    created_at: new Date().toISOString()
  });

  // If private DM, notify recipient via Telegram if linked
  if (roomId.startsWith('dm_')) {
    try {
      const parts = roomId.replace('dm_', '').split('_');
      const recipientId = parts.find(id => id !== messageData.user_id);
      if (recipientId) {
        const recipientProfile = await getProfile(recipientId);
        if (recipientProfile && recipientProfile.telegram_chat_id) {
          fetch('/api/telegram/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chatId: recipientProfile.telegram_chat_id,
              text: `💬 *New WING message from ${messageData.username}*:\n\n"${messageData.content}"\n\n🔗 _Open the WING application to reply!_`
            })
          }).catch(err => console.error("Error dispatching Telegram message alert:", err));
        }
      }
    } catch (err) {
      console.error("Failed to execute Telegram notification check:", err);
    }
  }
}

export async function getOrCreateDirectMessageRoom(userAId: string, userBId: string, userAName: string, userBName: string): Promise<string> {
  const participants = [userAId, userBId].sort();
  const roomId = `dm_${participants[0]}_${participants[1]}`;

  const roomSnap = await getDoc(doc(db, 'chat_rooms', roomId));
  if (!roomSnap.exists()) {
    await setDoc(doc(db, 'chat_rooms', roomId), {
      id: roomId,
      name: `${userAName} & ${userBName}`,
      type: 'private',
      participants,
      created_at: new Date().toISOString()
    });
    
    await sendMessage(roomId, {
      room_id: roomId,
      user_id: 'system',
      username: 'System',
      content: `Private Chat Started with ${userBName}. Feel free to ask details about their craft and projects!`
    });
  }
  return roomId;
}

export async function fetchPrivateChatRooms(userId: string): Promise<ChatRoom[]> {
  const q = query(
    collection(db, 'chat_rooms'),
    where('type', '==', 'private'),
    where('participants', 'array-contains', userId)
  );
  const querySnapshot = await getDocs(q);
  const rooms: ChatRoom[] = [];
  querySnapshot.forEach(doc => {
    rooms.push(doc.data() as ChatRoom);
  });
  return rooms;
}

// --- NOTIFICATION SERVICES ---

export async function createNotification(notificationData: Omit<Notification, 'id' | 'created_at' | 'read'>): Promise<void> {
  const notifCol = collection(db, 'notifications');
  await addDoc(notifCol, {
    ...notificationData,
    created_at: new Date().toISOString(),
    read: false
  });
}

// --- SECURE BUY FLOW HELPER ---

/**
 * Generates a secure Telegram deep link for purchasing.
 * Payment is verified by bot BEFORE revealing maker contact info.
 * Commission is automatically deducted by the bot.
 */
export function generateSecureBuyLink(postId: string, buyerUserId: string, botUsername: string = 'mari_beeee'): string {
  const startParam = `buy_${postId}_${buyerUserId}`;
  return `https://t.me/${botUsername}?start=${startParam}`;
}