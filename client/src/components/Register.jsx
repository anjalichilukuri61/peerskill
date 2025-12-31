import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { Link, useNavigate } from 'react-router-dom';
import API_URL from '../config/api';
import { verifySrgecIdCard } from '../services/ocrService';

export default function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState('seeker');
    const [idCard, setIdCard] = useState(null);
    const [isIdVerified, setIsIdVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { signup, refreshUserData } = useAuth();
    const { addToast } = useToast();
    const navigate = useNavigate();

    async function handleIdCardChange(e) {
        const file = e.target.files[0];
        if (!file) return;

        setError('');
        setIsIdVerified(false);
        setIsVerifying(true);

        try {
            const ocrResult = await verifySrgecIdCard(file);
            const { isValid, details, reasons, score } = ocrResult;

            console.log(`OCR Result - Valid: ${isValid}, Score: ${score}`, details);

            if (isValid) {
                setIdCard(file);
                setIsIdVerified(true);
                if (details.name) setName(details.name);
                addToast ? addToast(`ID Verified: ${details.name || 'Student'}`, 'success') : console.log('Verified');
            } else {
                setIdCard(null);
                setIsIdVerified(false);
                const failureReason = reasons && reasons.length > 0
                    ? `Verification failed: ${reasons.join(' ')}`
                    : 'Invalid ID layout or college name.';
                setError(`${failureReason} Please ensure the photo is clear and shows your SRGEC ID card.`);
                e.target.value = '';
            }
        } catch (err) {
            console.error(err);
            setError('An error occurred during verification. Please try again.');
            e.target.value = '';
        } finally {
            setIsVerifying(false);
        }
    }

    async function uploadCollegeId(file, token) {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch(`${API_URL}/api/uploads/college-id`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });

        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to upload ID card');
        }

        return data.downloadURL;
    }

    async function handleSubmit(e) {
        e.preventDefault();
        try {
            setError('');
            if (!isIdVerified) {
                setError('ID Verification required. Please upload your SRGEC student ID card above.');
                return;
            }
            setLoading(true);
            // 1. Create User in Firebase Auth
            const userCredential = await signup(email, password);
            const user = userCredential.user;
            const token = await user.getIdToken();

            // 2. Upload ID Card if selected
            let collegeIdUrl = '';
            if (idCard) {
                collegeIdUrl = await uploadCollegeId(idCard, token);
            }

            // 3. Create User Profile in Backend (Firestore)
            const res = await fetch(`${API_URL}/api/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ name, email, role, collegeIdUrl, isVerified: isIdVerified })
            });

            if (!res.ok) {
                throw new Error('Failed to create user profile in backend');
            }

            // Refresh user data locally from Firestore before navigating
            await refreshUserData();

            navigate('/');
        } catch (err) {
            setError('Failed to create account: ' + err.message);
        }
        setLoading(false);
    }

    return (
        <div className="auth-card-container">
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
                    <div style={{ display: 'grid', gap: '0.25rem' }}>
                        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Upload College ID Card (Mandatory)</label>
                        <input
                            type="file"
                            className="input-field"
                            accept="image/*"
                            onChange={handleIdCardChange}
                            required
                        />
                        {isVerifying && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="spinner" style={{ width: '16px', height: '16px', border: '2px solid #f3f3f3', borderTop: '2px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                <p style={{ fontSize: '0.75rem', color: 'var(--primary)' }}>Scanning ID Card... Please wait.</p>
                            </div>
                        )}
                        {isIdVerified && <p style={{ fontSize: '0.75rem', color: 'var(--success)' }}>✓ SRGEC ID Verified</p>}
                    </div>

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
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
