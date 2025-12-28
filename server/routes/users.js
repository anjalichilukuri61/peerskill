const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');

const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token provided' });
    try {
        const decodedToken = await auth.verifyIdToken(token);
        req.user = decodedToken;
        next();
    } catch (error) {
        res.status(403).json({ error: 'Unauthorized' });
    }
};

// GET /api/users/:id
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection('users').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'User not found' });

        // Exclude sensitive info if any? Firestore rules usually handle this, but here we can too.
        res.json(doc.data());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/users/profile
router.put('/profile', verifyToken, async (req, res) => {
    try {
        console.log("Received profile update for:", req.user.uid);
        console.log("Body:", req.body);
        const { name, email, bio, skills, department, year, rates } = req.body;
        const userRef = db.collection('users').doc(req.user.uid);

        // Update fields individually to avoid overwriting everything if undefined
        const updates = {};
        if (name) updates.name = name;
        if (email) updates.email = email;
        if (bio !== undefined) updates.bio = bio;
        if (skills !== undefined) updates.skills = skills;
        if (department !== undefined) updates.department = department;
        if (year !== undefined) updates.year = year;
        if (rates !== undefined) updates.rates = rates;

        console.log("Applying updates:", updates);
        await userRef.set(updates, { merge: true });
        console.log("Update successful");

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
