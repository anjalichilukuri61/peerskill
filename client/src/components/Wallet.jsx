import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Wallet as WalletIcon, TrendUp, Clock, ArrowUp, ArrowDown, Bank } from 'phosphor-react';

export default function Wallet() {
    const { currentUser } = useAuth();
    const { addToast } = useToast();
    const [balance, setBalance] = useState(0);
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);
    const [transactions, setTransactions] = useState([]);

    // Withdraw State
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [upiId, setUpiId] = useState('');
    const [withdrawLoading, setWithdrawLoading] = useState(false);

    useEffect(() => {
        fetchBalance();
        fetchTransactions();
    }, []);

    async function fetchBalance() {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('http://localhost:5000/api/wallet/balance', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setBalance(data.balance);
        } catch (error) {
            console.error(error);
            addToast('Failed to fetch balance', 'error');
        }
    }

    async function fetchTransactions() {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('http://localhost:5000/api/wallet/transactions', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setTransactions(data);
        } catch (error) {
            console.error(error);
        }
    }

    async function handleTopUp(e) {
        e.preventDefault();
        if (!amount || amount <= 0) return;
        setLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const orderRes = await fetch('http://localhost:5000/api/wallet/create-razorpay-order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount })
            });

            const orderData = await orderRes.json();
            if (!orderRes.ok) throw new Error(orderData.error);

            const options = {
                key: orderData.keyId,
                amount: orderData.amount,
                currency: orderData.currency,
                name: 'PeerSkill Hub',
                description: 'Wallet Top-up',
                order_id: orderData.orderId,
                handler: async function (response) {
                    try {
                        const verifyRes = await fetch('http://localhost:5000/api/wallet/verify-razorpay-payment', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                            body: JSON.stringify({
                                razorpay_order_id: response.razorpay_order_id,
                                razorpay_payment_id: response.razorpay_payment_id,
                                razorpay_signature: response.razorpay_signature
                            })
                        });
                        if (verifyRes.ok) {
                            setAmount('');
                            fetchBalance();
                            fetchTransactions();
                            addToast(`₹${amount} added successfully!`, 'success');
                        } else {
                            addToast('Payment verification failed', 'error');
                        }
                    } catch (error) {
                        console.error(error);
                        addToast('Payment verification failed', 'error');
                    }
                    setLoading(false);
                },
                modal: { ondismiss: () => { setLoading(false); addToast('Payment cancelled', 'info'); } }
            };
            const rzp = new window.Razorpay(options);
            rzp.open();
        } catch (error) {
            console.error(error);
            addToast('Failed to initiate payment', 'error');
            setLoading(false);
        }
    }

    async function handleWithdraw(e) {
        e.preventDefault();
        if (!withdrawAmount || Number(withdrawAmount) <= 0) return;
        if (!upiId) return;

        setWithdrawLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch('http://localhost:5000/api/wallet/withdraw', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ amount: withdrawAmount, upiId })
            });

            const data = await res.json();
            if (res.ok) {
                addToast('Withdrawal request submitted!', 'success');
                setWithdrawAmount('');
                setUpiId('');
                fetchBalance();
                fetchTransactions();
            } else {
                addToast(data.error || 'Withdrawal failed', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Withdrawal failed', 'error');
        }
        setWithdrawLoading(false);
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div className="card" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <WalletIcon size={48} color="var(--primary)" style={{ marginBottom: '1rem' }} />
                <h2 style={{ marginBottom: '0.5rem' }}>Current Balance</h2>
                <div style={{ fontSize: '3rem', fontWeight: 'bold', color: 'var(--text)' }}>₹{balance}</div>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <TrendUp size={24} color="var(--success)" />
                    Top Up Wallet
                </h3>
                <form onSubmit={handleTopUp} style={{ display: 'flex', gap: '1rem' }}>
                    <input type="number" className="input-field" placeholder="Amount to add" value={amount} onChange={e => setAmount(e.target.value)} required min="1" />
                    <button disabled={loading} className="btn btn-primary" type="submit">{loading ? 'Processing...' : 'Add Funds'}</button>
                </form>
                <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>Note: This is a demo transaction system. No real money is involved.</p>
            </div>

            <div className="card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Bank size={24} color="var(--primary)" />
                    Withdraw Funds
                </h3>
                <form onSubmit={handleWithdraw} style={{ display: 'grid', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        <input type="number" className="input-field" placeholder="Amount to withdraw" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} required min="1" style={{ flex: 1 }} />
                        <input type="text" className="input-field" placeholder="UPI ID / Bank Account" value={upiId} onChange={e => setUpiId(e.target.value)} required style={{ flex: 2 }} />
                    </div>
                    <button disabled={withdrawLoading} className="btn btn-outline" type="submit" style={{ width: '100%' }}>{withdrawLoading ? 'Processing...' : 'Request Withdrawal'}</button>
                </form>
            </div>

            <div className="card">
                <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={24} color="var(--primary)" />
                    Transaction History
                </h3>
                {transactions.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>No transactions yet</p>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {transactions.map(tx => (
                            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    {tx.type === 'topup' || tx.type === 'received' ? <ArrowDown size={20} color="var(--success)" /> : <ArrowUp size={20} color="var(--error)" />}
                                    <div>
                                        <div style={{ fontWeight: '500' }}>{tx.description}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(tx.createdAt).toLocaleString()}</div>
                                    </div>
                                </div>
                                <div style={{ fontWeight: 'bold', color: tx.amount > 0 ? 'var(--success)' : 'var(--error)' }}>
                                    {tx.amount > 0 ? '+' : ''}₹{Math.abs(tx.amount)}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
