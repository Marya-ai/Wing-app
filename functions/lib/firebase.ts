import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  // PASTE YOUR COPIED KEY VALUES HERE
  apiKey: "AIzaSyCg_15Weu24q4-g0-OJ4uW7Hzk1cYKLvqs", 
  authDomain: "wing-app-55bc8.firebaseapp.com",
  projectId: "wing-app-55bc8",
  storageBucket: "wing-app-55bc8.appspot.com",
  messagingSenderId: "718269448738",
  appId: "1:718269448738:web:d0edf63c9102360a85c07b"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);