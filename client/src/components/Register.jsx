import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase'; // Need auth to get token for backend
import API_URL from '../config/api';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('seeker');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            // 1. Create User in Firebase Auth
            const userCredential = await signup(email, password);
            const user = userCredential.user;

            // 2. Create User Profile in Backend (Firestore)
            const token = await user.getIdToken();
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, role })
            });

            if (!res.ok) {
                throw new Error('Failed to create user profile in backend');
            }

            navigate('/');
        } catch (err) {
            setError('Failed to create account: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div style={{ maxWidth: '400px', margin: '2rem auto' }}>
            <div className="card">
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Register</h2>
                {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', padding: '0.5rem', background: '#ef444422', borderRadius: 'var(--radius)' }}>{error}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <input
                        type="text"
                        className="input-field"
                        placeholder="Full Name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        required
                    />
                    <input
                        type="email"
                        className="input-field"
                        placeholder="Email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                    />
                    <input
                        type="password"
                        className="input-field"
                        placeholder="Password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                    />
                    <select
                        className="input-field"
                        value={role}
                        onChange={e => setRole(e.target.value)}
                    >
                        <option value="seeker">I want to learn (Seeker)</option>
                        <option value="provider">I want to teach (Provider)</option>
                        <option value="both">Both</option>
                    </select>

                    <button disabled={loading} className="btn btn-primary" type="submit">
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Already have an account? <Link to="/login" style={{ color: 'var(--primary)' }}>Login</Link>
                </div>
            </div>
        </div>
    );
}
