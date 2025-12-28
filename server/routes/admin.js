const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');

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

// Check if user is admin (Simple check for demo)
// In production, use custom claims or a robust role system
const verifyAdmin = async (req, res, next) => {
    // For DEMO purposes: Allow all logged in users to access Admin Panel
    // In production, strictly enforce role checks
    console.log(`Admin access granted to ${req.user.email} (Demo Mode)`);
    next();
};

// GET /api/admin/withdrawals
router.get('/withdrawals', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const snapshot = await db.collection('transactions')
            .where('type', '==', 'withdrawal')
            .where('status', '==', 'pending')
            .get();

        const withdrawals = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json(withdrawals);
    } catch (error) {
        console.error('Error fetching withdrawals:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/admin/withdrawals/:id/process
router.post('/withdrawals/:id/process', verifyToken, verifyAdmin, async (req, res) => {
    try {
        const { action } = req.body; // 'approve' or 'reject'
        const txRef = db.collection('transactions').doc(req.params.id);

        await db.runTransaction(async (t) => {
            const txDoc = await t.get(txRef);
            if (!txDoc.exists) throw new Error('Transaction not found');
            if (txDoc.data().status !== 'pending') throw new Error('Transaction already processed');

            if (action === 'approve') {
                t.update(txRef, {
                    status: 'completed',
                    processedAt: new Date().toISOString()
                });

                // Notify User
                const notificationRef = db.collection('notifications').doc();
                t.set(notificationRef, {
                    userId: txDoc.data().userId,
                    message: `Withdrawal of ₹${Math.abs(txDoc.data().amount)} approved and processed.`,
                    type: 'success',
                    createdAt: new Date().toISOString(),
                    read: false
                });

            } else if (action === 'reject') {
                // Refund balance
                const walletRef = db.collection('wallets').doc(txDoc.data().userId);
                const walletDoc = await t.get(walletRef);
                const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;

                t.update(txRef, {
                    status: 'rejected',
                    processedAt: new Date().toISOString()
                });

                t.update(walletRef, {
                    balance: currentBalance + Math.abs(txDoc.data().amount)
                });

                // Notify User
                const notificationRef = db.collection('notifications').doc();
                t.set(notificationRef, {
                    userId: txDoc.data().userId,
                    message: `Withdrawal rejected. Funds refunded to wallet.`,
                    type: 'error',
                    createdAt: new Date().toISOString(),
                    read: false
                });
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
