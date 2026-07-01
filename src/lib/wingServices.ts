// src/lib/wingServices.ts
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment, 
  getDoc,
  writeBatch 
} from 'firebase/firestore';

/**
 * 0. CREATE WING POST (Called from SocialFeed.tsx)
 * This is the function that was missing and causing your Render error.
 */
export const createWingPost = async (postData: any) => {
  try {
    const docRef = await addDoc(collection(db, "posts"), {
      ...postData,
      created_at: serverTimestamp(), // Use Firestore server time
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error creating post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 1. REPORT SALE (Called from SellerDashboard.tsx)
 * Changes post status and creates a transaction record for Admin to review.
 */
export const reportSaleAction = async (
  postId: string, 
  sellerId: string, 
  token: string, 
  commission: number
) => {
  try {
    // 1. Verify the post exists and token matches
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) throw new Error("Post not found");
    
    const postData = postSnap.data();
    
    // Security check: Ensure token provided by seller matches the token on the post
    if (postData.wing_token !== token) {
      throw new Error("Invalid Token. Please verify with the buyer.");
    }

    // 2. Use a Batch to update the Post and create the Report simultaneously
    const batch = writeBatch(db);

    // Update post status to 'pending_verification'
    batch.update(postRef, {
      sales_status: 'pending_verification'
    });

    // Create a record in 'reports' collection for Admin
    const reportRef = doc(collection(db, 'reports'));
    batch.set(reportRef, {
      postId,
      sellerId,
      sellerName: postData.author_name || "Unknown Artisan",
      token,
      commission,
      amount: postData.price,
      status: 'verifying',
      reportedAt: serverTimestamp(),
    });

    await batch.commit();
    return { success: true, reportId: reportRef.id };

  } catch (error: any) {
    console.error("Error reporting sale:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 2. VERIFY SALE (Called from AdminDashboard.tsx)
 * Marks item as officially sold and boosts the seller's reputation.
 */
export const verifySaleAction = async (
  reportId: string, 
  postId: string, 
  sellerId: string
) => {
  try {
    const batch = writeBatch(db);

    // 1. Mark the post as officially SOLD
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      sales_status: 'sold',
      isVisible: false // Hide from main marketplace
    });

    // 2. Update the report status to COMPLETED
    const reportRef = doc(db, 'reports', reportId);
    batch.update(reportRef, {
      status: 'completed',
      verifiedAt: serverTimestamp()
    });

    // 3. BOOST SELLER TRUST SCORE (+10 points)
    const sellerRef = doc(db, 'profiles', sellerId);
    batch.update(sellerRef, {
      trust_score: increment(10),
      total_sales: increment(1)
    });

    await batch.commit();
    return { success: true };

  } catch (error: any) {
    console.error("Error verifying sale:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 3. FLAG FRAUD (Called from AdminDashboard.tsx)
 * Punishes dishonest sellers by dropping their score and resetting the item.
 */
export const flagSellerAction = async (
  sellerId: string, 
  reportId: string, 
  postId: string
) => {
  try {
    const batch = writeBatch(db);

    // 1. Mark report as FRAUD
    const reportRef = doc(db, 'reports', reportId);
    batch.update(reportRef, {
      status: 'fraud_flagged',
      flaggedAt: serverTimestamp()
    });

    // 2. Reset the post to 'available' so someone else can buy it
    const postRef = doc(db, 'posts', postId);
    batch.update(postRef, {
      sales_status: 'available'
    });

    // 3. PUNISH SELLER (-50 points)
    const sellerRef = doc(db, 'profiles', sellerId);
    batch.update(sellerRef, {
      trust_score: increment(-50),
      isFlagged: true
    });

    await batch.commit();
    return { success: true, message: "Seller penalized for fraud." };

  } catch (error: any) {
    console.error("Error flagging seller:", error.message);
    return { success: false, error: error.message };
  }
};