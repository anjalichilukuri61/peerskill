const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');
const { runTransaction } = require('firebase-admin/firestore');

// Middleware
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

// POST /api/reviews
router.post('/', verifyToken, async (req, res) => {
    try {
        const { taskId, revieweeId, rating, comment } = req.body;
        const reviewerId = req.user.uid;

        if (!taskId || !revieweeId || !rating) {
            return res.status(400).json({ error: 'Missing review details' });
        }

        const ratingNum = Number(rating);
        if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Rating must be between 1 and 5' });
        }

        const taskRef = db.collection('tasks').doc(taskId);
        const userRef = db.collection('users').doc(revieweeId);
        const reviewRef = db.collection('reviews').doc();

        // Run transaction to ensure atomicity
        await db.runTransaction(async (t) => {
            const taskDoc = await t.get(taskRef);
            const userDoc = await t.get(userRef);

            if (!taskDoc.exists) throw new Error('Task not found');
            if (!userDoc.exists) throw new Error('User not found');

            // Verify participation
            const taskData = taskDoc.data();
            if (taskData.seekerId !== reviewerId && taskData.providerId !== reviewerId) {
                throw new Error('You were not a participant in this task');
            }

            // Create review
            t.set(reviewRef, {
                taskId,
                reviewerId,
                revieweeId,
                rating: ratingNum,
                comment: comment || '',
                createdAt: new Date().toISOString()
            });

            // Update user rating
            const currentRating = userDoc.data().averageRating || 0;
            const currentCount = userDoc.data().ratingCount || 0;

            const newCount = currentCount + 1;
            const newAverage = ((currentRating * currentCount) + ratingNum) / newCount;

            t.update(userRef, {
                averageRating: Number(newAverage.toFixed(1)),
                ratingCount: newCount
            });

            // Notify Reviewee
            const notificationRef = db.collection('notifications').doc();
            t.set(notificationRef, {
                userId: revieweeId,
                message: `You received a ${ratingNum}-star review!`,
                type: 'info',
                relatedId: taskId,
                createdAt: new Date().toISOString(),
                read: false
            });
        });

        res.status(201).json({ success: true });
    } catch (error) {
        console.error('Error submitting review:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/reviews/user/:userId
router.get('/user/:userId', async (req, res) => {
    try {
        const snapshot = await db.collection('reviews')
            .where('revieweeId', '==', req.params.userId)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get();

        const reviews = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(reviews);
    } catch (error) {
        console.error('Error fetching reviews:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
