console.log("🔥 firebase.js file loaded");

const admin = require("firebase-admin");

try {
  if (!admin.apps.length) {
    const hasEnvVars = process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY;

    const baseConfig = {
      credential: admin.credential.cert(
        hasEnvVars
          ? {
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
            }
          : require("./serviceAccountKey.json")
      ),
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET || "peerskillhub.firebasestorage.app",
    };

    if (hasEnvVars) {
      admin.initializeApp(baseConfig);
    } else {
      // Fallback to local JSON file if it exists
      admin.initializeApp(baseConfig);
      console.log("ℹ️ Using serviceAccountKey.json for Firebase Admin");
    }
  }

  console.log("✅ Firebase Admin initialized successfully");
} catch (error) {
  console.error("❌ Firebase Admin initialization failed:", error);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();
const bucket = admin.storage().bucket();

module.exports = { admin, db, auth, bucket };
