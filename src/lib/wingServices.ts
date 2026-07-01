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
 * 0. CREATE WING POST
 */
export const createWingPost = async (postData: any) => {
  try {
    const docRef = await addDoc(collection(db, "posts"), {
      ...postData,
      created_at: serverTimestamp(),
    });
    return { success: true, id: docRef.id };
  } catch (error: any) {
    console.error("Error creating post:", error);
    return { success: false, error: error.message };
  }
};

/**
 * 1. REPORT SALE
 */
export const reportSaleAction = async (postId: string, sellerId: string, token: string, commission: number) => {
  try {
    const postRef = doc(db, 'posts', postId);
    const postSnap = await getDoc(postRef);
    if (!postSnap.exists()) throw new Error("Post not found");
    const postData = postSnap.data();
    if (postData.wing_token !== token) throw new Error("Invalid Token.");

    const batch = writeBatch(db);
    batch.update(postRef, { sales_status: 'pending_verification' });
    const reportRef = doc(collection(db, 'reports'));
    batch.set(reportRef, {
      postId, sellerId, sellerName: postData.author_name, token, commission,
      amount: postData.price, status: 'verifying', reportedAt: serverTimestamp(),
    });
    await batch.commit();
    return { success: true, reportId: reportRef.id };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 2. VERIFY SALE
 */
export const verifySaleAction = async (reportId: string, postId: string, sellerId: string) => {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'posts', postId), { sales_status: 'sold', isVisible: false });
    batch.update(doc(db, 'reports', reportId), { status: 'completed', verifiedAt: serverTimestamp() });
    batch.update(doc(db, 'profiles', sellerId), { trust_score: increment(10), total_sales: increment(1) });
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};

/**
 * 3. FLAG FRAUD
 */
export const flagSellerAction = async (sellerId: string, reportId: string, postId: string) => {
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, 'reports', reportId), { status: 'fraud_flagged', flaggedAt: serverTimestamp() });
    batch.update(doc(db, 'posts', postId), { sales_status: 'available' });
    batch.update(doc(db, 'profiles', sellerId), { trust_score: increment(-50), isFlagged: true });
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
};