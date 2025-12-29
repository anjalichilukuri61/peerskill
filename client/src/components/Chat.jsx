import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { PaperPlaneRight, X } from 'phosphor-react';
import API_URL from '../config/api';

export default function Chat({ taskId, onClose, taskTitle }) {
    const { currentUser, userData } = useAuth();
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [taskData, setTaskData] = useState(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        if (!taskId) return;
        async function fetchTask() {
            const docRef = doc(db, 'tasks', taskId);
            const snapshot = await getDoc(docRef);
            if (snapshot.exists()) {
                setTaskData(snapshot.data());
            }
        }
        fetchTask();
    }, [taskId]);

    useEffect(() => {
        if (!taskId) return;

        // Listen for messages in real-time
        const q = query(
            collection(db, 'chats', taskId, 'messages'),
            orderBy('createdAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, [taskId]);

    useEffect(() => {
        // Scroll to bottom when new messages arrive
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    async function handleSend(e) {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            await addDoc(collection(db, 'chats', taskId, 'messages'), {
                text: newMessage,
                senderId: currentUser.uid,
                senderName: userData?.name || 'User',
                createdAt: serverTimestamp()
            });

            // Send notification to the other party via Backend (more secure)
            const token = await currentUser.getIdToken();
            fetch(`${API_URL}/api/tasks/${taskId}/chat-notify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    message: `New message from ${userData?.name || 'User'} regarding "${taskTitle || 'task'}"`
                })
            }).catch(err => console.error("Notification trigger failed:", err));

            setNewMessage('');
        } catch (error) {
            console.error("Error sending message:", error);
        }
    }

    return (
        <div style={{
            position: 'fixed', bottom: '20px', right: '20px', width: '350px', maxWidth: 'calc(100vw - 40px)', height: '500px',
            maxHeight: 'calc(100vh - 100px)',
            background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column',
            zIndex: 1000
        }} className="fade-in">
            {/* Header */}
            <div style={{
                padding: '1rem', borderBottom: '1px solid var(--border)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: 'var(--surface)'
            }}>
                <div>
                    <h3 style={{ fontSize: '1rem', margin: 0 }}>Chat</h3>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{taskTitle}</span>
                </div>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text)', cursor: 'pointer' }}>
                    <X size={20} />
                </button>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {messages.length === 0 && (
                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: 'auto', marginBottom: 'auto' }}>
                        Start the conversation...
                    </p>
                )}
                {messages.map(msg => {
                    const isMe = msg.senderId === currentUser.uid;
                    return (
                        <div key={msg.id} style={{
                            alignSelf: isMe ? 'flex-end' : 'flex-start',
                            maxWidth: '80%',
                        }}>
                            <div style={{
                                padding: '0.5rem 0.8rem',
                                background: isMe ? 'var(--primary)' : 'var(--surface-hover)',
                                color: isMe ? 'white' : 'var(--text)',
                                borderRadius: '12px',
                                borderBottomRightRadius: isMe ? '2px' : '12px',
                                borderBottomLeftRadius: isMe ? '12px' : '2px',
                                fontSize: '0.9rem'
                            }}>
                                {msg.text}
                            </div>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: isMe ? 'right' : 'left', marginTop: '2px' }}>
                                {isMe ? 'You' : msg.senderName}
                            </div>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <form onSubmit={handleSend} style={{ padding: '1rem', borderTop: '1px solid var(--border)', display: 'flex', gap: '0.5rem' }}>
                <input
                    className="input-field"
                    style={{ flex: 1, marginBottom: 0 }}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '0.5rem' }}>
                    <PaperPlaneRight size={20} />
                </button>
            </form>
        </div>
    );
}
