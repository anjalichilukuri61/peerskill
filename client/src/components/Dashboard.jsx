import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { auth, db, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { onSnapshot, collection, query, where, orderBy, doc, getDoc, addDoc, updateDoc, deleteDoc, arrayUnion } from 'firebase/firestore';
import { Plus, Check, X, Clock, Student, ChalkboardTeacher, Trash, CalendarBlank, ChatCircle, CheckCircle, CurrencyInr, User, SignOut, Wallet, Star, MagnifyingGlass, Funnel, ArrowRight, ShareNetwork, Warning, Camera } from 'phosphor-react';
import Chat from './Chat';
import ReviewModal from './ReviewModal';
import { verifySrgecIdCard } from '../services/ocrService';
import API_URL from '../config/api';

export default function Dashboard() {
    const { currentUser, userData, refreshUserData } = useAuth();
    const { addToast } = useToast();
    const [tasks, setTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCreate, setShowCreate] = useState(false);
    const [filter, setFilter] = useState('all'); // all, open, my-tasks
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    // New Task State
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        category: 'Debugging',
        customCategory: '',
        budget: '',
        deadline: '',
        ethicalDisclaimerAgreed: false
    });
    const [activeChatTask, setActiveChatTask] = useState(null);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [isVerifyingId, setIsVerifyingId] = useState(false);
    const [idVerificationError, setIdVerificationError] = useState('');
    const [reviewTask, setReviewTask] = useState(null);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, [filter, categoryFilter, searchQuery]);

    async function fetchTasks() {
        try {
            const token = await currentUser.getIdToken();
            let url = `${API_URL}/api/tasks`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok) {
                // Sort by newest
                let sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                if (filter === 'open') {
                    sorted = sorted.filter(t => t.status === 'open');
                } else if (filter === 'my-tasks') {
                    sorted = sorted.filter(t => t.seekerId === currentUser.uid || t.providerId === currentUser.uid);
                }

                if (filter === 'all' || filter === 'open') {
                    sorted = sorted.filter(t => t.category !== 'Other');
                }

                if (categoryFilter !== 'All') {
                    sorted = sorted.filter(t => t.category === categoryFilter);
                }

                if (searchQuery) {
                    const lowerQuery = searchQuery.toLowerCase();
                    sorted = sorted.filter(t =>
                        (t.title && t.title.toLowerCase().includes(lowerQuery)) ||
                        (t.description && t.description.toLowerCase().includes(lowerQuery)) ||
                        (t.category && t.category.toLowerCase().includes(lowerQuery))
                    );
                }

                setTasks(sorted);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            addToast('Failed to load tasks', 'error');
        }
        setLoading(false);
    }

    async function handleCreate(e) {
        e.preventDefault();
        if (!newTask.ethicalDisclaimerAgreed) return addToast('You must agree to the ethical disclaimer.', 'error');

        try {
            const token = await currentUser.getIdToken();
            const submissionTask = { ...newTask };
            if (submissionTask.category === 'Other') {
                submissionTask.category = submissionTask.customCategory || 'Other';
            }
            delete submissionTask.customCategory;

            const res = await fetch(`${API_URL}/api/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(submissionTask)
            });

            if (res.ok) {
                setShowCreate(false);
                setNewTask({ title: '', description: '', category: 'Debugging', customCategory: '', budget: '', deadline: '', ethicalDisclaimerAgreed: false });
                fetchTasks();
                addToast('Task created successfully!', 'success');
            } else {
                const err = await res.json();
                addToast(err.error, 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleApply(taskId, currentBudget) {
        const offer = window.prompt(`The budget is ₹${currentBudget}. How much do you want to charge for this task?`, currentBudget);
        if (offer === null) return;
        if (!offer || isNaN(offer) || offer <= 0) return addToast('Please enter a valid amount.', 'error');

        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/apply`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ price: offer })
            });

            if (res.ok) {
                fetchTasks();
                addToast(`Application sent at ₹${offer}! Seeker will notify you if hired.`, 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to apply', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleHire(taskId, providerId, price) {
        if (!window.confirm(`Hire this person for ₹${price}?`)) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/hire`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ providerId, price })
            });

            if (res.ok) {
                fetchTasks();
                addToast('Helper hired! They have been notified to proceed.', 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to hire', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleComplete(taskId) {
        if (!window.confirm('Are you sure the work is done? This will release the payment to the provider.')) return;
        try {
            const token = await currentUser.getIdToken();
            const taskRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const task = await taskRes.json();

            const paymentRes = await fetch(`${API_URL}/api/wallet/pay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: taskId,
                    amount: task.budget,
                    recipientId: task.providerId
                })
            });

            if (!paymentRes.ok) {
                const err = await paymentRes.json();
                if (err.error?.toLowerCase().includes('balance')) {
                    addToast('Insufficient wallet balance! Please Top Up in your Wallet.', 'error');
                } else {
                    addToast(err.error || 'Payment failed', 'error');
                }
                return;
            }

            const completeRes = await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (completeRes.ok) {
                fetchTasks();
                addToast(`Task completed! ₹${task.budget} has been transferred.`, 'success');
                setReviewTask(task);
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleReviewSubmit({ rating, comment }) {
        if (!reviewTask) return;
        setIsSubmittingReview(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/reviews`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: reviewTask.id,
                    revieweeId: reviewTask.providerId,
                    rating,
                    comment
                })
            });

            if (res.ok) {
                addToast('Review submitted successfully!', 'success');
                setReviewTask(null);
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to submit review', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Failed to submit review', 'error');
        }
        setIsSubmittingReview(false);
    }

    async function handleDelete(taskId) {
        if (!window.confirm('Are you sure you want to delete this task?')) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchTasks();
                addToast('Task deleted successfully', 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to delete task', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleSubmitWork(taskId) {
        const details = window.prompt("Please provide a link to your work (Google Drive, GitHub, etc.) or a description:");
        if (!details) return;

        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/submit`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ submissionDetails: details })
            });

            if (res.ok) {
                fetchTasks();
                addToast('Work submitted successfully!', 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to submit work', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    const [verificationProgress, setVerificationProgress] = useState('');

    async function handleVerificationUpload(file) {
        if (!file) {
            setIdVerificationError('Please select a file.');
            return;
        }

        setIsVerifyingId(true);
        setIdVerificationError('');
        setVerificationProgress('Scanning ID card...');

        try {
            console.log("Starting local OCR scan...");
            const ocrResult = await verifySrgecIdCard(file);
            const { isValid, details, reasons, score } = ocrResult;
            console.log(`OCR Result - Valid: ${isValid}, Score: ${score}`, details);

            if (isValid) {
                setVerificationProgress('ID Verified! Finishing up...');

                const token = await currentUser.getIdToken();

                // STEP 1: Update verification status in DB immediately (Fast)
                console.log("Updating verification status first...");
                const statusRes = await fetch(`${API_URL}/api/users/verify-id`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        isVerified: true,
                        // Include extracted data if available to make it feel more "verified"
                        name: ocrResult.details?.name,
                        rollNumber: ocrResult.details?.rollNumber
                    })
                });

                if (statusRes.ok) {
                    // STEP 2: Background Upload (Truly non-blocking)
                    // We fire this and forget so the UI responds instantly
                    (async () => {
                        try {
                            console.log("Starting background upload...");
                            const cleanName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
                            const fileRef = ref(storage, `id_verifications/${currentUser.uid}/${cleanName}`);
                            await uploadBytes(fileRef, file);
                            const downloadURL = await getDownloadURL(fileRef);

                            // Update with URL silently in background
                            await fetch(`${API_URL}/api/users/verify-id`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ collegeIdUrl: downloadURL, isVerified: true })
                            });
                            console.log("Background upload and sync complete.");
                        } catch (uploadErr) {
                            console.error("Background upload failed:", uploadErr);
                        }
                    })();

                    // UI Success Path
                    if (refreshUserData) {
                        await refreshUserData();
                    }

                    const successMsg = ocrResult.details?.name
                        ? `ID Verified for ${ocrResult.details.name}! Welcome.`
                        : 'ID verified successfully! Welcome to the Hub.';

                    addToast(successMsg, 'success');

                    // Close modal and let the user see the "Verified" badge
                    setShowVerifyModal(false);
                    setIsVerifyingId(false);
                    setVerificationProgress('');

                    // Optional: Brief delay before reload to let toast be seen
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    let errorMsg = 'Failed to update status.';
                    try {
                        const contentType = statusRes.headers.get("content-type");
                        if (contentType && contentType.indexOf("application/json") !== -1) {
                            const err = await statusRes.json();
                            errorMsg = err.error || errorMsg;
                        } else {
                            const text = await statusRes.text();
                            errorMsg = `Server error: ${text.substring(0, 50)}`;
                        }
                    } catch (e) { }
                    setIdVerificationError(errorMsg);
                    setIsVerifyingId(false);
                }
            } else {
                const failureMsg = reasons && reasons.length > 0
                    ? `Verification failed: ${reasons.join(' ')}`
                    : 'Could not verify ID. Please ensure it is a clear photo of your SRGEC ID card.';
                setIdVerificationError(failureMsg);
                setIsVerifyingId(false);
            }
        } catch (error) {
            console.error('ID verification error:', error);
            setIdVerificationError(`Verification failed: ${error.message || 'Please try again.'}`);
            setIsVerifyingId(false);
        } finally {
            setVerificationProgress('');
        }
    }

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h1 style={{ fontSize: '1.8rem' }}>Welcome, {userData?.name}</h1>
                        {userData?.isVerified ? (
                            <span className="badge" style={{ background: 'var(--success)', color: 'white' }}>✓ Verified Student</span>
                        ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span className="badge" style={{ background: 'var(--error)', color: 'white' }}>Unverified</span>
                                <button className="btn btn-outline" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => setShowVerifyModal(true)}>Verify Now</button>
                            </div>
                        )}
                    </div>
                    <p style={{ color: 'var(--text-muted)' }}>Find help or earn by helping others.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? <X size={20} /> : <Plus size={20} />}
                    {showCreate ? 'Cancel' : 'Request Help'}
                </button>
            </div>

            {showCreate && (
                <div className="card" style={{ marginBottom: '2rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Create New Task</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem' }}>
                        <input className="input-field" placeholder="Task Title" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} required />
                        <textarea className="input-field" placeholder="Description" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} required style={{ minHeight: '100px' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                            <select className="input-field" value={newTask.category} onChange={e => setNewTask({ ...newTask, category: e.target.value })}>
                                <option>Debugging</option>
                                <option>Explanation</option>
                                <option>Code Review</option>
                                <option>Tutoring</option>
                                <option>Graphic Design</option>
                                <option>Content Writing</option>
                                <option>Video Editing</option>
                                <option>Other</option>
                            </select>
                            <input type="number" className="input-field" placeholder="Budget (₹)" value={newTask.budget} onChange={e => setNewTask({ ...newTask, budget: e.target.value })} required />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <input type="checkbox" id="ethical" checked={newTask.ethicalDisclaimerAgreed} onChange={e => setNewTask({ ...newTask, ethicalDisclaimerAgreed: e.target.checked })} required />
                            <label htmlFor="ethical" style={{ fontSize: '0.8rem' }}>I agree that this task does not violate academic integrity.</label>
                        </div>
                        <button type="submit" className="btn btn-primary">Post Task</button>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
                <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>Explore</button>
                <button className={`btn ${filter === 'open' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('open')}>Available</button>
                <button className={`btn ${filter === 'my-tasks' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('my-tasks')}>My Activity</button>
                <input className="input-field" placeholder="Search..." style={{ flex: '1', minWidth: '200px' }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>

            {loading ? <p>Loading...</p> : (
                <div style={{ display: 'grid', gap: '1.5rem' }}>
                    {filter === 'my-tasks' ? (
                        <div style={{ display: 'grid', gap: '2rem' }}>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>My Requests</h2>
                                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                    {tasks.filter(t => t.seekerId === currentUser.uid).map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            currentUser={currentUser}
                                            userData={userData}
                                            handleDelete={handleDelete}
                                            handleApply={handleApply}
                                            handleHire={handleHire}
                                            handleComplete={handleComplete}
                                            handleSubmitWork={handleSubmitWork}
                                            setActiveChatTask={setActiveChatTask}
                                        />
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem' }}>My Jobs</h2>
                                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                    {tasks.filter(t => t.providerId === currentUser.uid).map(task => (
                                        <TaskCard
                                            key={task.id}
                                            task={task}
                                            isProviding={true}
                                            currentUser={currentUser}
                                            userData={userData}
                                            handleDelete={handleDelete}
                                            handleApply={handleApply}
                                            handleHire={handleHire}
                                            handleComplete={handleComplete}
                                            handleSubmitWork={handleSubmitWork}
                                            setActiveChatTask={setActiveChatTask}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                            {tasks.map(task => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    currentUser={currentUser}
                                    userData={userData}
                                    handleDelete={handleDelete}
                                    handleApply={handleApply}
                                    handleHire={handleHire}
                                    handleComplete={handleComplete}
                                    handleSubmitWork={handleSubmitWork}
                                    setActiveChatTask={setActiveChatTask}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeChatTask && <Chat taskId={activeChatTask.id} taskTitle={activeChatTask.title} onClose={() => setActiveChatTask(null)} />}
            <ReviewModal isOpen={!!reviewTask} onClose={() => setReviewTask(null)} onSubmit={handleReviewSubmit} revieweeName="the Helper" loading={isSubmittingReview} />

            {showVerifyModal && (
                <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1100 }}>
                    <div className="card" style={{ width: '90%', maxWidth: '400px', textAlign: 'center' }}>
                        <h2 style={{ marginBottom: '1rem' }}>Verify Student ID</h2>
                        <input type="file" accept="image/*" onChange={e => {
                            if (e.target.files[0]) handleVerificationUpload(e.target.files[0]);
                        }} disabled={isVerifyingId} />

                        {isVerifyingId && (
                            <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                                <div className="spinner" style={{ width: '24px', height: '24px', border: '3px solid #f3f3f3', borderTop: '3px solid var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                <p style={{ fontSize: '0.9rem', color: 'var(--primary)' }}>{verificationProgress}</p>
                            </div>
                        )}

                        {idVerificationError && <p style={{ color: 'var(--error)', marginTop: '1rem', fontSize: '0.85rem' }}>{idVerificationError}</p>}

                        {!isVerifyingId && (
                            <button className="btn btn-outline" style={{ marginTop: '1.5rem' }} onClick={() => setShowVerifyModal(false)}>Close</button>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

// Moved outside to prevent re-creation on every render
function TaskCard({ task, isProviding = false, currentUser, userData, handleDelete, handleApply, handleHire, handleComplete, handleSubmitWork, setActiveChatTask }) {
    const getStatusColor = (status) => {
        switch (status) {
            case 'open': return '#3b82f6';
            case 'submitted': return '#0ea5e9';
            case 'pending_approval': return '#f59e0b';
            case 'accepted': return '#8b5cf6';
            case 'completed': return '#10b981';
            default: return 'var(--text-muted)';
        }
    };

    return (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', border: isProviding ? '1px solid var(--success)' : '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span className="badge" style={{ background: getStatusColor(task.status), color: 'white' }}>{task.status.toUpperCase()}</span>
                    {isProviding && <span className="badge" style={{ background: 'var(--success)', color: 'white' }}>HELPING</span>}
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--success)' }}>
                        {task.seekerId === currentUser?.uid ? 'Budget: ' : 'Earn: '}₹{task.budget}
                    </span>
                    {task.seekerId === currentUser?.uid && task.status === 'open' && (
                        <button
                            onClick={() => handleDelete(task.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                        >
                            <Trash size={18} />
                        </button>
                    )}
                </div>
            </div>
            <span className="badge" style={{ background: 'var(--surface-hover)', fontSize: '0.7rem', alignSelf: 'flex-start', marginBottom: '0.5rem' }}>{task.category}</span>
            <h3 style={{ marginBottom: '0.5rem' }}>{task.title}</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', flex: 1 }}>{task.description}</p>

            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Posted by {(task.seekerName && task.seekerName !== 'Unknown') ? task.seekerName : (task.seekerId === currentUser?.uid ? (userData?.name || 'You') : 'Unknown User')}
            </p>

            <div style={{ marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                {task.status === 'open' && task.seekerId !== currentUser?.uid && (
                    <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => handleApply(task.id, task.budget)} disabled={task.applicants?.some(a => a.userId === currentUser?.uid)}>
                        {task.applicants?.some(a => a.userId === currentUser?.uid) ? 'Applied' : 'Interested'}
                    </button>
                )}

                {task.status === 'open' && task.seekerId === currentUser?.uid && task.applicants?.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {task.applicants.map(app => (
                            <div key={app.userId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)' }}>
                                <span style={{ fontSize: '0.8rem' }}><strong>{app.name}</strong> • ₹{app.price}</span>
                                <button className="btn btn-primary" style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }} onClick={() => handleHire(task.id, app.userId, app.price)}>Hire</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {(task.status === 'submitted' || task.status === 'completed') && task.submissionDetails && (
                <div style={{ width: '100%', marginBottom: '1rem', padding: '0.75rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                        <strong>Submission:</strong>
                        <span style={{ wordBreak: 'break-all' }}>
                            {(() => {
                                const isUrl = task.submissionDetails.startsWith('http') || task.submissionDetails.startsWith('www.');
                                const url = task.submissionDetails.startsWith('www.') ? `https://${task.submissionDetails}` : task.submissionDetails;
                                return isUrl ? <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>{task.submissionDetails}</a> : task.submissionDetails;
                            })()}
                        </span>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                {(task.status !== 'open' && task.status !== 'completed') && (task.seekerId === currentUser?.uid || task.providerId === currentUser?.uid) && (
                    <button className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => setActiveChatTask(task)}><ChatCircle size={18} style={{ marginRight: '4px' }} /> Chat</button>
                )}
                {(task.status === 'accepted' || task.status === 'submitted') && task.seekerId === currentUser?.uid && (
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleComplete(task.id)}>{task.status === 'submitted' ? 'Approve & Release' : 'Release Early'}</button>
                )}
                {task.status === 'accepted' && task.providerId === currentUser?.uid && (
                    <button className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={() => handleSubmitWork(task.id)}>Submit Work</button>
                )}
                {task.status === 'completed' && <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>✓ Done</span>}
            </div>
        </div>
    );
}

