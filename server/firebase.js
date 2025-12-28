console.log("🔥 firebase.js file loaded");

const admin = require("firebase-admin");

try {
    if (!admin.apps.length) {
        const serviceAccount = require("./serviceAccountKey.json");

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
        });
    }
} catch (error) {
    console.error("❌ Firebase Admin initialization failed:", error);
    process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
