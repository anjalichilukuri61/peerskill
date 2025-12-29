import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
    apiKey: "AIzaSyCTWVI4x0tDBwYgf675lVTKbE0KrSfwrtg",
    authDomain: "peerskillhub.firebaseapp.com",
    projectId: "peerskillhub",
    storageBucket: "peerskillhub.firebasestorage.app",
    messagingSenderId: "290880651982",
    appId: "1:290880651982:web:89f474fa4d01cc011f869f",
    measurementId: "G-2C6TQG611Q"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
