import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { ShieldCheck, Check, X } from 'phosphor-react';

export default function AdminDashboard() {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWithdrawals();
    }, []);

    async function fetchWithdrawals() {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('http://localhost:5000/api/admin/withdrawals', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.status === 403) {
                setLoading(false);
                return; // Not admin
            }

            const data = await res.json();
            if (Array.isArray(data)) {
                setWithdrawals(data);
            } else {
                setWithdrawals([]);
                addToast(data.error || 'Invalid data received', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to fetch withdrawals', 'error');
        }
        setLoading(false);
    }

    async function handleProcess(id, action) {
        if (!window.confirm(`Are you sure you want to ${action} this request?`)) return;

        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`http://localhost:5000/api/admin/withdrawals/${id}/process`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ action })
            });

            if (res.ok) {
                addToast(`Request ${action}ed successfully`, 'success');
                fetchWithdrawals();
            } else {
                const data = await res.json();
                addToast(data.error || 'Operation failed', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Operation failed', 'error');
        }
    }

    if (loading) return <div style={{ textAlign: 'center', marginTop: '2rem' }}>Loading Admin Panel...</div>;

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
                    <ShieldCheck size={32} color="var(--primary)" />
                    <h2>Admin Dashboard</h2>
                </div>

                <h3>Pending Withdrawals</h3>
                {withdrawals.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>No pending requests.</p>
                ) : (
                    <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                            <thead>
                                <tr style={{ background: 'var(--surface-hover)', textAlign: 'left' }}>
                                    <th style={{ padding: '1rem' }}>Date</th>
                                    <th style={{ padding: '1rem' }}>User ID</th>
                                    <th style={{ padding: '1rem' }}>UPI / Bank</th>
                                    <th style={{ padding: '1rem' }}>Amount</th>
                                    <th style={{ padding: '1rem' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {withdrawals.map(tx => (
                                    <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                        <td style={{ padding: '1rem' }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                                        <td style={{ padding: '1rem', fontSize: '0.8rem', fontFamily: 'monospace' }}>{tx.userId}</td>
                                        <td style={{ padding: '1rem' }}>{tx.upiId}</td>
                                        <td style={{ padding: '1rem', fontWeight: 'bold' }}>₹{Math.abs(tx.amount)}</td>
                                        <td style={{ padding: '1rem', display: 'flex', gap: '0.5rem' }}>
                                            <button
                                                className="btn btn-outline"
                                                style={{ borderColor: 'var(--success)', color: 'var(--success)', padding: '0.4rem' }}
                                                onClick={() => handleProcess(tx.id, 'approve')}
                                                title="Mark Paid"
                                            >
                                                <Check size={18} />
                                            </button>
                                            <button
                                                className="btn btn-outline"
                                                style={{ borderColor: 'var(--error)', color: 'var(--error)', padding: '0.4rem' }}
                                                onClick={() => handleProcess(tx.id, 'reject')}
                                                title="Reject & Refund"
                                            >
                                                <X size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
