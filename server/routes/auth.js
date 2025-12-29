const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');

// Middleware to verify Firebase ID Token
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(403).json({ error: 'Unauthorized' });
    }
};

// POST /api/auth/register
// Create/Update user in Firestore after separate Firebase Auth signup on client
router.post('/register', verifyToken, async (req, res) => {
    const { name, email, role, department, year, bio, skills, collegeIdUrl } = req.body;
    const uid = req.user.uid;

    try {
        const userRef = db.collection('users').doc(uid);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const isStudentEmail = ['.edu', '.ac.in', '.gov.in', 'university', 'college'].some(domain => email.toLowerCase().includes(domain));

        const newUser = {
            uid,
            name,
            email: email || req.user.email,
            role: role || 'seeker',
            skills: skills || [],
            department: department || '',
            year: year || '',
            bio: bio || '',
            collegeIdUrl: collegeIdUrl || '',
            walletBalance: 0,
            averageRating: 0,
            ratingCount: 0,
            isVerified: isStudentEmail,
            createdAt: new Date().toISOString()
        };

        await userRef.set(newUser);
        res.status(201).json(newUser);
    } catch (error) {
        console.error('Error registering user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
    try {
        const userRef = db.collection('users').doc(req.user.uid);
        const doc = await userRef.get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        res.json(doc.data());
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
