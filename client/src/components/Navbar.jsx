import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SignOut, User, Wallet, ClipboardText, HouseLine, ShieldCheck } from 'phosphor-react';
import NotificationDropdown from './NotificationDropdown';

export default function Navbar() {
    const { currentUser, userData, logout } = useAuth();
    const navigate = useNavigate();

    async function handleLogout() {
        try {
            await logout();
            navigate('/login');
        } catch {
            console.error('Failed to log out');
        }
    }

    return (
        <nav className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderRadius: '0 0 var(--radius) var(--radius)', borderTop: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <Link to={currentUser ? "/dashboard" : "/login"} style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    PeerSkill Hub
                </Link>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                {currentUser ? (
                    <>
                        <Link to="/dashboard" className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} title="Home">
                            <HouseLine size={20} />
                            <span className="hide-mobile">Home</span>
                        </Link>
                        <Link to="/metrics" className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }} title="Wallet">
                            <Wallet size={20} />
                            <span className="hide-mobile">Wallet</span>
                        </Link>
                        {/* Admin Link (Demo) */}
                        <Link to="/admin" className="btn btn-outline" title="Admin Panel">
                            <ShieldCheck size={20} />
                        </Link>
                        <div className="btn btn-outline" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', cursor: 'default', border: '1px solid var(--success)', color: 'var(--success)' }}>
                            <span>₹{userData?.walletBalance || 0}</span>
                        </div>
                        <NotificationDropdown />
                        <Link to="/profile" className="btn btn-outline" title="Profile">
                            <User size={20} />
                        </Link>
                        <button onClick={handleLogout} className="btn btn-outline" title="Logout">
                            <SignOut size={20} />
                        </button>
                    </>
                ) : (
                    <>
                        <Link to="/login" className="btn btn-outline">Login</Link>
                        <Link to="/register" className="btn btn-primary">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
}
