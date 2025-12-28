import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Star, CheckCircle } from 'phosphor-react';

export default function Profile() {
    const { currentUser } = useAuth();
    console.log("Profile render. currentUser:", currentUser?.uid);
    const [profile, setProfile] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({});
    const [error, setError] = useState(null);

    useEffect(() => {
        if (currentUser) {
            fetchProfile();
        }
    }, [currentUser]);


    async function fetchProfile() {
        if (!currentUser) return;

        setError(null);
        setProfile(null);
        try {
            const token = await currentUser.getIdToken();

            const res = await fetch(
                `http://localhost:5000/api/users/${currentUser.uid}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            if (!res.ok) {
                if (res.status === 404) {
                    throw new Error("Profile not found. Please try to save your details to create one.");
                }
                throw new Error("Failed to fetch profile (Server Error)");
            }

            const data = await res.json();
            setProfile(data);

            // Format skills for editing (convert array to comma-separated string if needed)
            const editingData = { ...data };
            if (Array.isArray(data.skills)) {
                editingData.skills = data.skills.join(', ');
            }
            setFormData(editingData);
        } catch (err) {
            console.error("Fetch profile error:", err.message);
            setError(err.message);
        }
    }


    async function handleSave() {
        if (!currentUser) return;

        console.log("Saving profile changes...", formData);

        try {
            const token = await currentUser.getIdToken();

            // Format skills back to array if it was a string
            const submissionData = { ...formData };
            if (typeof formData.skills === 'string') {
                submissionData.skills = formData.skills.split(',').map(s => s.trim()).filter(s => s !== '');
            }

            const res = await fetch(
                'http://localhost:5000/api/users/profile',
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify(submissionData)
                }
            );

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.error || "Failed to save profile");
            }

            alert("✅ Profile updated successfully");
            setIsEditing(false);
            fetchProfile(); // Refresh data
        } catch (error) {
            console.error("Save profile error:", error.message);
            alert(error.message);
        }
    }


    if (error) return (
        <div className="card" style={{ maxWidth: '600px', margin: '2rem auto', textAlign: 'center' }}>
            <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>
            <button className="btn btn-primary" onClick={() => { setError(null); setIsEditing(true); setProfile({}); setFormData({}); }}>
                Create Profile
            </button>
        </div>
    );

    if (!profile) return (
        <div style={{ textAlign: 'center', marginTop: '4rem' }}>
            <p>Loading profile...</p>
        </div>
    );

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
            <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
                    <h2>User Profile</h2>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        {isEditing && (
                            <button className="btn btn-outline" onClick={() => { setIsEditing(false); fetchProfile(); }}>
                                Cancel
                            </button>
                        )}
                        <button className="btn btn-primary" onClick={() => isEditing ? handleSave() : setIsEditing(true)}>
                            {isEditing ? 'Save Changes' : 'Edit Profile'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    <div>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Name</label>
                        {isEditing ? (
                            <input
                                className="input-field"
                                value={formData.name || ''}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        ) : (
                            <div style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                {profile.name}
                                {profile.isVerified && (
                                    <CheckCircle size={20} weight="fill" color="var(--primary)" title="Verified Student" />
                                )}
                            </div>
                        )}
                        {!isEditing && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <div style={{ display: 'flex', color: '#f59e0b' }}>
                                    {[1, 2, 3, 4, 5].map(star => (
                                        <Star
                                            key={star}
                                            size={16}
                                            weight={(profile.averageRating || 0) >= star ? 'fill' : 'regular'}
                                        />
                                    ))}
                                </div>
                                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                    {profile.averageRating ? profile.averageRating.toFixed(1) : 'No rating'} ({profile.ratingCount || 0} reviews)
                                </span>
                            </div>
                        )}
                    </div>
                    <div>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Email</label>
                        {isEditing ? (
                            <input
                                className="input-field"
                                value={formData.email || ''}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                            />
                        ) : (
                            <div style={{ fontSize: '1.1rem' }}>{profile.email}</div>
                        )}
                    </div>

                    <div>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Bio</label>
                        {isEditing ? (
                            <textarea
                                className="input-field"
                                value={formData.bio || ''}
                                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                            />
                        ) : (
                            <p>{profile.bio || 'No bio yet.'}</p>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Department</label>
                            {isEditing ? (
                                <input
                                    className="input-field"
                                    value={formData.department || ''}
                                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                                />
                            ) : (
                                <div>{profile.department || 'N/A'}</div>
                            )}
                        </div>
                        <div>
                            <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Year</label>
                            {isEditing ? (
                                <input
                                    className="input-field"
                                    value={formData.year || ''}
                                    onChange={e => setFormData({ ...formData, year: e.target.value })}
                                />
                            ) : (
                                <div>{profile.year || 'N/A'}</div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Skills (comma separated)</label>
                        {isEditing ? (
                            <input
                                className="input-field"
                                placeholder="e.g. Python, Graphic Design, Calculus"
                                value={formData.skills || ''}
                                onChange={e => setFormData({ ...formData, skills: e.target.value })}
                            />
                        ) : (
                            <div>
                                {profile.skills && (Array.isArray(profile.skills) ? profile.skills.length > 0 : profile.skills.length > 0) ? (
                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                        {(Array.isArray(profile.skills) ? profile.skills : profile.skills.split(',')).map((skill, i) => (
                                            <span key={i} className="badge" style={{ background: 'var(--surface-hover)', color: 'var(--text)' }}>
                                                {skill.trim()}
                                            </span>
                                        ))}
                                    </div>
                                ) : 'No skills listed'}
                            </div>
                        )}
                    </div>

                    <div>
                        <label style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Hourly Rate / Points</label>
                        {isEditing ? (
                            <input
                                className="input-field"
                                placeholder="e.g. 50 pts/hr"
                                value={formData.rates || ''}
                                onChange={e => setFormData({ ...formData, rates: e.target.value })}
                            />
                        ) : (
                            <div style={{ color: 'var(--success)', fontWeight: 'bold' }}>{profile.rates || 'Negotiable'}</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
