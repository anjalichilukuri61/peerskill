const { db } = require('./firebase');

const demoTasks = [
    {
        seekerId: 'demo-user-1',
        providerId: null,
        title: 'Help with React Hooks',
        description: 'Need someone to explain useEffect and useCallback hooks with practical examples.',
        category: 'Tutoring',
        status: 'open',
        budget: 25,
        deadline: null,
        createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
        ethicalDisclaimerAgreed: true
    },
    {
        seekerId: 'demo-user-2',
        providerId: null,
        title: 'Code Review for Portfolio Website',
        description: 'Looking for feedback on my HTML/CSS/JS portfolio site. Want to improve accessibility and performance.',
        category: 'Code Review',
        status: 'open',
        budget: 30,
        deadline: null,
        createdAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        ethicalDisclaimerAgreed: true
    },
    {
        seekerId: 'demo-user-3',
        providerId: null,
        title: 'Python List Comprehension Bug',
        description: 'My list comprehension is not filtering data correctly. Need help debugging this specific issue.',
        category: 'Debugging',
        status: 'open',
        budget: 15,
        deadline: null,
        createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(), // 5 hours ago
        ethicalDisclaimerAgreed: true
    },
    {
        seekerId: 'demo-user-4',
        providerId: null,
        title: 'Explain Binary Search Trees',
        description: 'Can someone walk me through how BST insertion and deletion works? I understand the concept but struggle with implementation.',
        category: 'Explanation',
        status: 'open',
        budget: 20,
        deadline: null,
        createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3 hours ago
        ethicalDisclaimerAgreed: true
    },
    {
        seekerId: 'demo-user-5',
        providerId: null,
        title: 'Logo Design for Student App',
        description: 'Need a simple, modern logo for my study planner app. Looking for minimalist design with blue/purple theme.',
        category: 'Graphic Design',
        status: 'open',
        budget: 40,
        deadline: null,
        createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
        ethicalDisclaimerAgreed: true
    },
    {
        seekerId: 'demo-user-6',
        providerId: null,
        title: 'Blog Post About Machine Learning',
        description: 'Need help writing a 500-word blog post explaining neural networks to beginners. Must be engaging and easy to understand.',
        category: 'Content Writing',
        status: 'open',
        budget: 35,
        deadline: null,
        createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
        ethicalDisclaimerAgreed: true
    }
];

async function addDemoTasks() {
    try {
        console.log('Adding demo tasks to Firestore...');

        for (const task of demoTasks) {
            const docRef = await db.collection('tasks').add(task);
            console.log(`✓ Added task: "${task.title}" (ID: ${docRef.id})`);
        }

        console.log('\n✅ Successfully added all demo tasks!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error adding demo tasks:', error);
        process.exit(1);
    }
}

addDemoTasks();
