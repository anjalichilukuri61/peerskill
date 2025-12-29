import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Link, useNavigate } from 'react-router-dom';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            setLoading(true);
            await login(email, password);
            navigate('/');
        } catch (err) {
            setError('Failed to log in: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div className="auth-card-container">
            <div className="card">
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Login</h2>
                {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', padding: '0.5rem', background: '#ef444422', borderRadius: 'var(--radius)' }}>{error}</div>}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
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
                    <button disabled={loading} className="btn btn-primary" type="submit">
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>
                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                    Don't have an account? <Link to="/register" style={{ color: 'var(--primary)' }}>Register</Link>
                </div>
            </div>
        </div>
    );
}
