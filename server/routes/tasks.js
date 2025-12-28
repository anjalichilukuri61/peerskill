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

// POST /api/tasks - Create Task
router.post('/', verifyToken, async (req, res) => {
    const { title, description, category, budget, deadline, ethicalDisclaimerAgreed } = req.body;

    if (!ethicalDisclaimerAgreed) {
        return res.status(400).json({ error: 'You must agree to the ethical disclaimer.' });
    }

    try {
        // Fetch user profile to get name
        const userDoc = await db.collection('users').doc(req.user.uid).get();
        const seekerName = userDoc.exists ? userDoc.data().name : 'Unknown';

        const task = {
            seekerId: req.user.uid,
            seekerName, // Store name directly on task
            providerId: null,
            title,
            description,
            category,
            status: 'open',
            budget: Number(budget),
            deadline: deadline ? new Date(deadline).toISOString() : null,
            createdAt: new Date().toISOString(),
            ethicalDisclaimerAgreed
        };

        const docRef = await db.collection('tasks').add(task);
        res.status(201).json({ id: docRef.id, ...task });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tasks - List Tasks
router.get('/', async (req, res) => {
    try {
        const { category, status } = req.query;
        let query = db.collection('tasks');

        if (category) query = query.where('category', '==', category);
        if (status) query = query.where('status', '==', status);

        const snapshot = await query.get();
        const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Fetch seeker profile data for each task if name is missing
        const tasksWithProfiles = await Promise.all(tasks.map(async (task) => {
            if (task.seekerName && task.seekerName !== 'Unknown') {
                return task;
            }

            try {
                const userDoc = await db.collection('users').doc(task.seekerId).get();
                const seekerProfile = userDoc.exists ? userDoc.data() : null;
                return {
                    ...task,
                    seekerName: seekerProfile?.name || 'Unknown User',
                    seekerEmail: seekerProfile?.email || ''
                };
            } catch (error) {
                console.error(`Error fetching profile for seeker ${task.seekerId}:`, error);
                return {
                    ...task,
                    seekerName: 'Unknown User',
                    seekerEmail: ''
                };
            }
        }));

        res.json(tasksWithProfiles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET /api/tasks/:id
router.get('/:id', async (req, res) => {
    try {
        const doc = await db.collection('tasks').doc(req.params.id).get();
        if (!doc.exists) return res.status(404).json({ error: 'Task not found' });
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tasks/:id/accept
router.put('/:id/accept', verifyToken, async (req, res) => {
    try {
        console.log('Accept request received for task:', req.params.id);
        console.log('User UID:', req.user.uid);
        console.log('Requested price:', req.body.price);

        const taskRef = db.collection('tasks').doc(req.params.id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            console.log('Task not found');
            return res.status(404).json({ error: 'Task not found' });
        }
        if (taskDoc.data().status !== 'open') {
            console.log('Task not open, current status:', taskDoc.data().status);
            return res.status(400).json({ error: 'Task not open' });
        }
        if (taskDoc.data().seekerId === req.user.uid) {
            console.log('User trying to accept own task');
            return res.status(400).json({ error: 'Cannot accept own task' });
        }

        const { price } = req.body;
        const originalBudget = taskDoc.data().budget;
        const proposedPrice = price ? Number(price) : originalBudget;

        const updates = {
            providerId: req.user.uid,
            proposedBudget: proposedPrice,
            originalBudget: originalBudget
        };

        // If price is different, require seeker approval
        if (proposedPrice !== originalBudget) {
            updates.status = 'pending_approval';
            console.log('Price changed, setting status to pending_approval');
        } else {
            updates.status = 'accepted';
            updates.budget = proposedPrice;
            console.log('Price unchanged, setting status to accepted');
        }

        await taskRef.update(updates);
        await taskRef.update(updates);
        console.log('Task accepted successfully. Updates:', updates);

        // Notify Seeker
        await db.collection('notifications').add({
            userId: taskDoc.data().seekerId,
            message: proposedPrice !== originalBudget
                ? `Counter-offer received for "${taskDoc.data().title}"`
                : `Your task "${taskDoc.data().title}" has been accepted!`,
            type: 'info',
            relatedId: req.params.id,
            createdAt: new Date().toISOString(),
            read: false
        });

        res.json({ success: true, status: updates.status });
    } catch (error) {
        console.error('Error accepting task:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tasks/:id/approve-price
router.put('/:id/approve-price', verifyToken, async (req, res) => {
    try {
        const taskRef = db.collection('tasks').doc(req.params.id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });
        if (taskDoc.data().seekerId !== req.user.uid) return res.status(403).json({ error: 'Only task owner can approve price' });
        if (taskDoc.data().status !== 'pending_approval') return res.status(400).json({ error: 'Task is not pending approval' });

        await taskRef.update({
            status: 'accepted',
            budget: taskDoc.data().proposedBudget,
            isNegotiated: true
        });

        // Notify Provider
        await db.collection('notifications').add({
            userId: taskDoc.data().providerId,
            message: `Your price for "${taskDoc.data().title}" was approved!`,
            type: 'success',
            relatedId: req.params.id,
            createdAt: new Date().toISOString(),
            read: false
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error approving price:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tasks/:id/reject-price
router.put('/:id/reject-price', verifyToken, async (req, res) => {
    try {
        const taskRef = db.collection('tasks').doc(req.params.id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });
        if (taskDoc.data().seekerId !== req.user.uid) return res.status(403).json({ error: 'Only task owner can reject price' });
        if (taskDoc.data().status !== 'pending_approval') return res.status(400).json({ error: 'Task is not pending approval' });

        // Return task to open status
        await taskRef.update({
            status: 'open',
            providerId: null,
            proposedBudget: null,
            budget: taskDoc.data().originalBudget
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error rejecting price:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tasks/:id/submit
router.put('/:id/submit', verifyToken, async (req, res) => {
    try {
        const { submissionDetails } = req.body;
        const taskRef = db.collection('tasks').doc(req.params.id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });
        if (taskDoc.data().providerId !== req.user.uid) return res.status(403).json({ error: 'Not authorized' });

        await taskRef.update({
            status: 'submitted',
            submissionDetails,
            submittedAt: new Date().toISOString()
        });

        // Notify Seeker
        await db.collection('notifications').add({
            userId: taskDoc.data().seekerId,
            message: `Work submitted for "${taskDoc.data().title}". Please review and pay.`,
            type: 'info',
            relatedId: req.params.id,
            createdAt: new Date().toISOString(),
            read: false
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Error submitting work:', error);
        res.status(500).json({ error: error.message });
    }
});

// PUT /api/tasks/:id/complete
router.put('/:id/complete', verifyToken, async (req, res) => {
    try {
        const taskRef = db.collection('tasks').doc(req.params.id);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) return res.status(404).json({ error: 'Task not found' });

        // Only provider or seeker can mark complete? Usually provider marks, seeker confirms. 
        // For simplicity: Provider marks as completed.
        if (taskDoc.data().seekerId !== req.user.uid && taskDoc.data().providerId !== req.user.uid) return res.status(403).json({ error: 'Not authorized' });

        await taskRef.update({
            status: 'completed'
        });

        // Notify Provider
        await db.collection('notifications').add({
            userId: taskDoc.data().providerId,
            message: `Task "${taskDoc.data().title}" marked as complete!`,
            type: 'success',
            createdAt: new Date().toISOString(),
            read: false
        });

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE /api/tasks/:id
router.delete('/:id', verifyToken, async (req, res) => {
    try {
        const taskRef = db.collection('tasks').doc(req.params.id);
        const doc = await taskRef.get();

        if (!doc.exists) return res.status(404).json({ error: 'Task not found' });
        if (doc.data().seekerId !== req.user.uid) return res.status(403).json({ error: 'Not authorized to delete this task' });

        await taskRef.delete();
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
