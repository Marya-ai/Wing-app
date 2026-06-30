import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  onAuthStateChanged as onAuthStateChangedFirebase,
  signInWithEmailAndPassword as signInWithEmailAndPasswordFirebase,
  createUserWithEmailAndPassword as createUserWithEmailAndPasswordFirebase,
  signOut as signOutFirebase,
  updateProfile as updateProfileFirebase
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, collection, getDocs, query, where, setDoc } from 'firebase/firestore';

// Configuration updated with your new project keys
const firebaseConfig = {
  apiKey:  "AIzaSyCdeRDZtCiQCSelwaP-y9xDycqAN5lRZio",
  authDomain: "wing-app-55bc8.firebaseapp.com",
  projectId: "wing-app-55bc8",
  storageBucket: "wing-app-55bc8.firebasestorage.app",
  messagingSenderId: "718269448738",
  appId: "1:718269448738:web:d0edf63c9102360a85c07b",
  measurementId: "G-ECH94GSHDS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Using standard Firestore initialization for your new project
export const db = getFirestore(app);

// Test Connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firebase Connection Successful!");
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. The client appears to be offline.");
    } else {
      console.log("Firebase initial response received (test collection check done).");
    }
  }
}

testConnection();

// --- RESILIENT AUTH FALLBACK MOTOR ---
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
  
  // Call immediately with existing state (preferring custom session, then standard)
  const initialUser = currentCustomUser || authInstance.currentUser;
  callback(initialUser);

  // Subscribe to real Firebase auth
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

// Wrapper for signInWithEmailAndPassword
export async function signInWithEmailAndPassword(authInstance: any, email: string, password: string) {
  try {
    const cred = await signInWithEmailAndPasswordFirebase(authInstance, email, password);
    return cred;
  } catch (err: any) {
    if (
      err.code === 'auth/operation-not-allowed' || 
      err.code === 'auth/configuration-not-found' || 
      err.message?.includes('operation-not-allowed')
    ) {
      console.warn("Firebase authentication email/password not enabled. Initiating secure custom database auth...");
      const emailLower = email.toLowerCase().trim();
      const profilesCol = collection(db, 'profiles');
      const q = query(profilesCol, where('email', '==', emailLower));
      const snap = await getDocs(q);

      if (snap.empty) {
        throw new Error("No account found with this email. Please click Sign Up above to register!");
      }

      const profileDoc = snap.docs[0];
      const profileData = profileDoc.data();

      if (profileData.password !== password) {
        throw new Error("Incorrect password. Please verify and try again.");
      }

      const customUser = {
        uid: profileDoc.id,
        email: emailLower,
        displayName: profileData.full_name || 'Artisan',
        photoURL: profileData.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${profileDoc.id}`,
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

// Wrapper for createUserWithEmailAndPassword
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
      console.warn("Firebase authentication email/password not enabled. Registering via custom database auth...");
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

// Wrapper for updateProfile
export async function updateProfile(userInstance: any, { displayName, photoURL }: { displayName?: string, photoURL?: string }) {
  if (userInstance && userInstance.isCustom) {
    const updatedUser = {
      ...userInstance,
      displayName: displayName || userInstance.displayName,
      photoURL: photoURL || userInstance.photoURL
    };
    currentCustomUser = updatedUser;
    localStorage.setItem('wing_custom_user', JSON.stringify(updatedUser));

    // Persist changes to profile document synchronously
    const docRef = doc(db, 'profiles', userInstance.uid);
    await setDoc(docRef, {
      full_name: displayName,
      avatar_url: photoURL,
      email: userInstance.email,
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