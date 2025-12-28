const express = require('express');
const router = express.Router();
const { db, auth } = require('../firebase');
const Razorpay = require('razorpay');
const crypto = require('crypto');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_dummy',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

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

// GET /api/wallet/balance - Get user's wallet balance
router.get('/balance', verifyToken, async (req, res) => {
    try {
        const walletRef = db.collection('wallets').doc(req.user.uid);
        const walletDoc = await walletRef.get();

        if (!walletDoc.exists) {
            // Create wallet if it doesn't exist
            await walletRef.set({ balance: 0, createdAt: new Date().toISOString() });
            return res.json({ balance: 0 });
        }

        res.json({ balance: walletDoc.data().balance || 0 });
    } catch (error) {
        console.error('Error fetching balance:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/topup - Add funds to wallet
router.post('/topup', verifyToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const amountNum = Number(amount);

        if (!amount || amountNum <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const walletRef = db.collection('wallets').doc(req.user.uid);
        const walletDoc = await walletRef.get();

        const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
        const newBalance = currentBalance + amountNum;

        await walletRef.set({ balance: newBalance, updatedAt: new Date().toISOString() }, { merge: true });

        // Record transaction
        await db.collection('transactions').add({
            userId: req.user.uid,
            type: 'topup',
            amount: amountNum,
            balanceAfter: newBalance,
            createdAt: new Date().toISOString(),
            description: 'Wallet top-up'
        });

        res.json({ success: true, balance: newBalance });
    } catch (error) {
        console.error('Error topping up:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/pay - Process payment for task
router.post('/pay', verifyToken, async (req, res) => {
    try {
        const { taskId, amount, recipientId } = req.body;
        const amountNum = Number(amount);

        if (!taskId || !amount || !recipientId || amountNum <= 0) {
            return res.status(400).json({ error: 'Invalid payment details' });
        }

        // Get sender's wallet
        const senderWalletRef = db.collection('wallets').doc(req.user.uid);
        const senderWallet = await senderWalletRef.get();

        if (!senderWallet.exists || (senderWallet.data().balance || 0) < amountNum) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Get recipient's wallet
        const recipientWalletRef = db.collection('wallets').doc(recipientId);
        const recipientWallet = await recipientWalletRef.get();

        const senderBalance = senderWallet.data().balance || 0;
        const recipientBalance = recipientWallet.exists ? (recipientWallet.data().balance || 0) : 0;

        // Deduct from sender
        await senderWalletRef.update({
            balance: senderBalance - amountNum,
            updatedAt: new Date().toISOString()
        });

        // Add to recipient
        await recipientWalletRef.set({
            balance: recipientBalance + amountNum,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        // Record transactions
        const timestamp = new Date().toISOString();

        await db.collection('transactions').add({
            userId: req.user.uid,
            type: 'payment',
            amount: -amountNum,
            balanceAfter: senderBalance - amountNum,
            taskId,
            recipientId,
            createdAt: timestamp,
            description: `Payment for task`
        });

        await db.collection('transactions').add({
            userId: recipientId,
            type: 'received',
            amount: amountNum,
            balanceAfter: recipientBalance + amountNum,
            taskId,
            senderId: req.user.uid,
            createdAt: timestamp,
            description: `Payment received for task`
        });

        // Notify Recipient
        await db.collection('notifications').add({
            userId: recipientId,
            message: `You received ₹${amountNum} for a task!`,
            type: 'success',
            relatedId: taskId,
            createdAt: new Date().toISOString(),
            read: false
        });

        res.json({ success: true, newBalance: senderBalance - amountNum });
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET /api/wallet/transactions - Get user's transaction history
router.get('/transactions', verifyToken, async (req, res) => {
    try {
        const snapshot = await db.collection('transactions')
            .where('userId', '==', req.user.uid)
            .get();

        const transactions = snapshot.docs
            .map(doc => ({ id: doc.id, ...doc.data() }))
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 50);

        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/create-razorpay-order - Create Razorpay order for top-up
router.post('/create-razorpay-order', verifyToken, async (req, res) => {
    try {
        const { amount } = req.body;
        const amountNum = Number(amount);

        if (!amount || amountNum <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        const options = {
            amount: amountNum * 100, // Convert to paise
            currency: 'INR',
            receipt: `receipt_${req.user.uid}_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        res.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST /api/wallet/verify-razorpay-payment - Verify and process payment
router.post('/verify-razorpay-payment', verifyToken, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // Verify signature
        const sign = razorpay_order_id + '|' + razorpay_payment_id;
        const expectedSign = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(sign.toString())
            .digest('hex');

        if (razorpay_signature !== expectedSign) {
            return res.status(400).json({ error: 'Invalid payment signature' });
        }

        // Fetch payment details
        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return res.status(400).json({ error: 'Payment not successful' });
        }

        const amount = payment.amount / 100; // Convert from paise to rupees

        // Update wallet balance
        const walletRef = db.collection('wallets').doc(req.user.uid);
        const walletDoc = await walletRef.get();

        const currentBalance = walletDoc.exists ? (walletDoc.data().balance || 0) : 0;
        const newBalance = currentBalance + amount;

        await walletRef.set({ balance: newBalance, updatedAt: new Date().toISOString() }, { merge: true });

        // Record transaction
        await db.collection('transactions').add({
            userId: req.user.uid,
            type: 'topup',
            amount: amount,
            balanceAfter: newBalance,
            razorpayOrderId: razorpay_order_id,
            razorpayPaymentId: razorpay_payment_id,
            createdAt: new Date().toISOString(),
            description: 'Wallet top-up via Razorpay'
        });

        res.json({ success: true, balance: newBalance });
    } catch (error) {
        console.error('Error verifying Razorpay payment:', error);
        res.status(500).json({ error: error.message });
    }
});



// POST /api/wallet/withdraw
router.post('/withdraw', verifyToken, async (req, res) => {
    try {
        const { amount, upiId } = req.body;
        const amountNum = Number(amount);

        if (!amount || amountNum <= 0) return res.status(400).json({ error: 'Invalid amount' });
        if (!upiId) return res.status(400).json({ error: 'UPI ID or Bank Details required' });

        const walletRef = db.collection('wallets').doc(req.user.uid);

        await db.runTransaction(async (t) => {
            const doc = await t.get(walletRef);
            const currentBalance = doc.exists ? (doc.data().balance || 0) : 0;

            if (currentBalance < amountNum) {
                throw new Error('Insufficient balance');
            }

            const newBalance = currentBalance - amountNum;
            t.update(walletRef, {
                balance: newBalance,
                updatedAt: new Date().toISOString()
            });

            const transactionRef = db.collection('transactions').doc();
            t.set(transactionRef, {
                userId: req.user.uid,
                type: 'withdrawal',
                amount: -amountNum,
                balanceAfter: newBalance,
                upiId,
                status: 'pending',
                createdAt: new Date().toISOString(),
                description: `Withdrawal to ${upiId}`
            });

            const notificationRef = db.collection('notifications').doc();
            t.set(notificationRef, {
                userId: req.user.uid,
                message: `Withdrawal request for ₹${amountNum} submitted.`,
                type: 'info',
                createdAt: new Date().toISOString(),
                read: false
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error processing withdrawal:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;
