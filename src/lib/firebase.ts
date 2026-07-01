import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged as onAuthStateChangedFirebase,
  signInWithEmailAndPassword as signInWithEmailAndPasswordFirebase,
  createUserWithEmailAndPassword as createUserWithEmailAndPasswordFirebase,
  signOut as signOutFirebase,
  updateProfile as updateProfileFirebase
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDocFromServer, 
  collection, 
  getDocs, 
  query, 
  where, 
  setDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Configuration for your Wing App project
const firebaseConfig = {
  apiKey:  "AIzaSyCdeRDZtCiQCSelwaP-y9xDycqAN5lRZio",
  authDomain: "wing-app-55bc8.firebaseapp.com",
  projectId: "wing-app-55bc8",
  storageBucket: "wing-app-55bc8.firebasestorage.app",
  messagingSenderId: "718269448738",
  appId: "1:718269448738:web:d0edf63c9102360a85c07b",
  measurementId: "G-ECH94GSHDS"
};

// Initialize Firebase Core
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); // Added for product image storage

// Test Connection Helper
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("✅ WING Firebase: Connection Successful!");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("❌ WING Firebase: Client is offline. Check internet.");
    } else {
      console.log("ℹ️ WING Firebase: Initial handshake received.");
    }
  }
}

testConnection();

// --- RESILIENT AUTH FALLBACK MOTOR ---
// This handles the custom 'profiles' collection auth if standard Firebase Auth is disabled
let currentCustomUser: any = null;
const authStateCallbacks: Array<(user: any) => void> = [];

// Load initial custom user session from localStorage
const savedUserJson = localStorage.getItem('wing_custom_user');
if (savedUserJson) {
  try {
    currentCustomUser = JSON.parse(savedUserJson);
  } catch (e) {
    console.error("Error loading saved custom user session", e);
  }
}

function triggerAuthCallbacks(user: any) {
  authStateCallbacks.forEach(cb => {
    try {
      cb(user);
    } catch (e) {
      console.error("Error in auth state callback", e);
    }
  });
}

// Wrapper for onAuthStateChanged
export function onAuthStateChanged(authInstance: any, callback: (user: any) => void) {
  authStateCallbacks.push(callback);
  
  const initialUser = currentCustomUser || authInstance.currentUser;
  callback(initialUser);

  const unsubFirebase = onAuthStateChangedFirebase(authInstance, (firebaseUser) => {
    if (firebaseUser) {
      currentCustomUser = null;
      localStorage.removeItem('wing_custom_user');
      triggerAuthCallbacks(firebaseUser);
    } else {
      if (currentCustomUser) {
        triggerAuthCallbacks(currentCustomUser);
      } else {
        triggerAuthCallbacks(null);
      }
    }
  });

  return () => {
    const idx = authStateCallbacks.indexOf(callback);
    if (idx !== -1) {
      authStateCallbacks.splice(idx, 1);
    }
    unsubFirebase();
  };
}

// Wrapper for signInWithEmailAndPassword (with Profile fallback)
export async function signInWithEmailAndPassword(authInstance: any, email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPasswordFirebase(authInstance, email, password);
    return cred;
  } catch (err: any) {
    // If standard auth fails or is not enabled, check our custom profiles collection
    if (
      err.code === 'auth/operation-not-allowed' || 
      err.code === 'auth/configuration-not-found' || 
      err.message?.includes('operation-not-allowed')
    ) {
      console.warn("WING: Using Custom Profile Auth Fallback...");
      const emailLower = email.toLowerCase().trim();
      const profilesCol = collection(db, 'profiles');
      const q = query(profilesCol, where('email', '==', emailLower));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No account found with this email on WING.");
      }

      const profileDoc = snap.docs[0];
      const profileData = profileDoc.data();

      if (profileData.password !== password) {
        throw new Error("Incorrect password for WING account.");
      }

      const customUser = {
        uid: profileDoc.id,
        email: emailLower,
        displayName: profileData.full_name || 'Artisan',
        photoURL: profileData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profileDoc.id}`,
        trust_score: profileData.trust_score || 50, // WING: Reputation support
        role: profileData.role || 'seller',
        isCustom: true
      };

      currentCustomUser = customUser;
      localStorage.setItem('wing_custom_user', JSON.stringify(customUser));
      triggerAuthCallbacks(customUser);
      return { user: customUser };
    } else {
      throw err;
    }
  }
}

// Wrapper for createUserWithEmailAndPassword (with Profile fallback)
export async function createUserWithEmailAndPassword(authInstance: any, email: string, password: string) {
  try {
    const cred = await createUserWithEmailAndPasswordFirebase(authInstance, email, password);
    return cred;
  } catch (err: any) {
    if (
      err.code === 'auth/operation-not-allowed' || 
      err.code === 'auth/configuration-not-found' || 
      err.message?.includes('operation-not-allowed')
    ) {
      console.warn("WING: Registering via Custom Profile Database...");
      const emailLower = email.toLowerCase().trim();
      const profilesCol = collection(db, 'profiles');
      const q = query(profilesCol, where('email', '==', emailLower));
      const snap = await getDocs(q);

      if (!snap.empty) {
        throw new Error("This email is already registered on WING.");
      }

      const uid = `custom_${Math.random().toString(36).substring(2, 11)}`;
      const customUser = {
        uid,
        email: emailLower,
        displayName: '',
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`,
        trust_score: 50, // WING: Start new users with 50 points
        isCustom: true,
        _tempPassword: password
      };

      currentCustomUser = customUser;
      localStorage.setItem('wing_custom_user', JSON.stringify(customUser));
      triggerAuthCallbacks(customUser);
      return { user: customUser };
    } else {
      throw err;
    }
  }
}

// Wrapper for updateProfile (Syncs with custom profiles collection)
export async function updateProfile(userInstance: any, { displayName, photoURL }: { displayName?: string, photoURL?: string }) {
  if (userInstance && userInstance.isCustom) {
    const updatedUser = {
      ...userInstance,
      displayName: displayName || userInstance.displayName,
      photoURL: photoURL || userInstance.photoURL
    };
    currentCustomUser = updatedUser;
    localStorage.setItem('wing_custom_user', JSON.stringify(updatedUser));

    // Save to Firestore 'profiles'
    const docRef = doc(db, 'profiles', userInstance.uid);
    await setDoc(docRef, {
      full_name: displayName,
      avatar_url: photoURL,
      email: userInstance.email,
      trust_score: userInstance.trust_score || 50,
      updated_at: serverTimestamp(),
      ...(userInstance._tempPassword ? { password: userInstance._tempPassword } : {})
    }, { merge: true });

    triggerAuthCallbacks(updatedUser);
    return;
  } else {
    return await updateProfileFirebase(userInstance, { displayName, photoURL });
  }
}

// Wrapper for signOut
export async function signOut(authInstance: any) {
  currentCustomUser = null;
  localStorage.removeItem('wing_custom_user');
  triggerAuthCallbacks(null);
  return await signOutFirebase(authInstance);
}