import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAXUDa9DMJO6_wc2QINZhq1E7WmALPNcD4",
  authDomain: "english-mastery-1c1ff.firebaseapp.com",
  projectId: "english-mastery-1c1ff",
  storageBucket: "english-mastery-1c1ff.firebasestorage.app",
  messagingSenderId: "962507399556",
  appId: "1:962507399556:web:5e14e040ff366a23cdbdd1"
};

// מוודא ש-Firebase מופעל רק פעם אחת כדי למנוע שגיאות ב-Next.js
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// מייצא את מסד הנתונים כדי שנוכל להשתמש בו בשאר האפליקציה
export const db = getFirestore(app);