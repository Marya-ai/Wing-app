// src/lib/wingServices.ts
import { db } from './firebase';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp, 
  increment, 
  getDoc 
} from 'firebase/firestore';

/**
 * 1. REPORT SALE (Called from SellerDashboard)
 * Changes post status and creates a transaction record for Admin to review.
 */
export const reportSaleAction = async (
  postId: string, 
  sellerId: string, 
  token: string, 
  commission: number
) => {
  try {
    // 1. Verify the post exists and token matches (Security Check)
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) throw new Error("Post not found");
    
    const postData = postSnap.data();
    if (postData.wing_token !== token) {
      throw new Error("Invalid Token. Please verify with the buyer.");
    }

    // 2. Update post status to 'pending_verification'
    // This hides the 'Buy' button so no one else tries to buy it
    await updateDoc(postRef, {
      sales_status: 'pending_verification'
    });

    // 3. Create a record in 'reports' collection for Admin
    const reportRef = await addDoc(collection(db, 'reports'), {
      postId,
      sellerId,
      token,
      commission,
      amount: postData.price,
      status: 'verifying', // Admin needs to check Telebirr
      reportedAt: serverTimestamp(),
    });

    return { success: true, reportId: reportRef.id };
  } catch (error: any) {
    console.error("Error reporting sale:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 2. VERIFY SALE (Called from AdminDashboard)
 * Marks item as officially sold and boosts the seller's reputation.
 */
export const verifySaleAction = async (
  reportId: string, 
  postId: string, 
  sellerId: string
) => {
  try {
    // 1. Mark the post as officially SOLD
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      sales_status: 'sold'
    });

    // 2. Update the report status to COMPLETED
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      status: 'completed',
      verifiedAt: serverTimestamp()
    });

    // 3. BOOST SELLER TRUST SCORE (+10 points)
    // This is the "Trusted Seller" logic
    const sellerRef = doc(db, 'profiles', sellerId);
    await updateDoc(sellerRef, {
      trust_score: increment(10),
      total_sales: increment(1)
    });

    return { success: true };
  } catch (error: any) {
    console.error("Error verifying sale:", error.message);
    return { success: false, error: error.message };
  }
};

/**
 * 3. FLAG FRAUD (Called from AdminDashboard)
 * Punishes dishonest sellers by dropping their score and hiding their items.
 */
export const flagSellerAction = async (sellerId: string, reportId: string, postId: string) => {
  try {
    // 1. Mark report as FRAUD
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      status: 'fraud_flagged',
      flaggedAt: serverTimestamp()
    });

    // 2. Reset the post to 'available' so someone else can buy it
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, {
      sales_status: 'available'
    });

    // 3. PUNISH SELLER (-50 points)
    // This will trigger the "Fraud Risk" badge in the UI
    const sellerRef = doc(db, 'profiles', sellerId);
    await updateDoc(sellerRef, {
      trust_score: increment(-50)
    });

    return { success: true, message: "Seller penalized for fraud." };
  } catch (error: any) {
    console.error("Error flagging seller:", error.message);
    return { success: false, error: error.message };
  }
};