// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCTWVI4x0tDBwYgf675lVTKbE0KrSfwrtg",
    authDomain: "peerskillhub.firebaseapp.com",
    projectId: "peerskillhub",
    storageBucket: "peerskillhub.firebasestorage.app",
    messagingSenderId: "290880651982",
    appId: "1:290880651982:web:89f474fa4d01cc011f869f",
    measurementId: "G-2C6TQG611Q"
};



// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
