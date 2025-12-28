import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Bell } from 'phosphor-react';

export default function NotificationDropdown() {
    const { currentUser } = useAuth();
    const [notifications, setNotifications] = useState([]);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    useEffect(() => {
        if (!currentUser) return;

        const q = query(
            collection(db, 'notifications'),
            where('userId', '==', currentUser.uid),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setNotifications(data);
        });

        return () => unsubscribe();
    }, [currentUser]);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAsRead = async (id) => {
        try {
            await updateDoc(doc(db, 'notifications', id), { read: true });
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div style={{ position: 'relative' }} ref={dropdownRef}>
            <button
                className="btn btn-outline"
                style={{ position: 'relative', border: 'none', background: 'transparent', padding: '0.5rem' }}
                onClick={() => setIsOpen(!isOpen)}
                title="Notifications"
            >
                <Bell size={24} />
                {unreadCount > 0 && (
                    <span style={{
                        position: 'absolute', top: 0, right: 0,
                        background: 'var(--error)', color: 'white',
                        borderRadius: '50%', width: '18px', height: '18px',
                        fontSize: '0.7rem', display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="card" style={{
                    position: 'absolute', top: '45px', right: '-80px', width: '300px',
                    maxHeight: '400px', overflowY: 'auto', padding: '0rem',
                    zIndex: 100, boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    border: '1px solid var(--border)'
                }}>
                    <div style={{ padding: '0.75rem', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>Notifications</h4>
                    </div>
                    {notifications.length === 0 ? (
                        <p style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)' }}>No notifications</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                            {notifications.map(n => (
                                <div key={n.id}
                                    onClick={() => handleMarkAsRead(n.id)}
                                    style={{
                                        padding: '0.75rem',
                                        background: n.read ? 'var(--card-bg)' : 'var(--surface-hover)',
                                        cursor: 'pointer',
                                        borderBottom: '1px solid var(--border)',
                                        borderLeft: n.read ? '3px solid transparent' : '3px solid var(--primary)'
                                    }}
                                >
                                    <p style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem' }}>{n.message}</p>
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
