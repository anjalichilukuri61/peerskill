import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { auth } from '../firebase';
import { Plus, Check, X, Clock, Student, ChalkboardTeacher, Trash, CalendarBlank, ChatCircle } from 'phosphor-react';
import Chat from './Chat';
import ReviewModal from './ReviewModal';
import API_URL from '../config/api';

export default function Dashboard() {
    const { currentUser, userData } = useAuth();
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
    const [reviewTask, setReviewTask] = useState(null);
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);

    useEffect(() => {
        fetchTasks();
    }, [filter, categoryFilter, searchQuery]);

    async function fetchTasks() {
        try {
            const token = await currentUser.getIdToken();
            let url = `${API_URL}/api/tasks`;

            // Basic filtering client-side for now or query params if backend supports
            // Our backend supports ?status=open but we might want to see accepted ones too

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();

            if (res.ok) {
                console.log('Raw tasks from API:', data.length);
                // Sort by newest
                let sorted = data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

                if (filter === 'open') {
                    sorted = sorted.filter(t => t.status === 'open');
                    console.log('After open filter:', sorted.length);
                } else if (filter === 'my-tasks') {
                    console.log('Current user UID:', currentUser.uid);
                    console.log('Tasks before my-tasks filter:', sorted.map(t => ({ id: t.id, seekerId: t.seekerId, providerId: t.providerId })));
                    sorted = sorted.filter(t => t.seekerId === currentUser.uid || t.providerId === currentUser.uid);
                    console.log('After my-tasks filter:', sorted.length, sorted.map(t => ({ id: t.id, title: t.title, providerId: t.providerId })));
                }

                if (filter === 'all' || filter === 'open') {
                    // Hide placeholder "Other" tasks that weren't given a custom name
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

                console.log('Final tasks to display:', sorted.length);
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

            // Handle custom category
            const submissionTask = { ...newTask };
            if (submissionTask.category === 'Other') {
                submissionTask.category = submissionTask.customCategory || 'Other';
            }
            delete submissionTask.customCategory; // Clean up before sending

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

    async function handleAccept(taskId, currentBudget) {
        // User wants to specify how much they charge.
        // We can ask if they agree to the budget or want to propose a rate? 
        // For simplicity and per requirement "specify how much they charge", let's ask for an amount.
        const offer = window.prompt(`The budget is ₹${currentBudget}. How much do you want to charge for this task?`, currentBudget);

        if (offer === null) return; // Cancelled
        if (!offer || isNaN(offer) || offer <= 0) return addToast('Please enter a valid amount.', 'error');

        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/accept`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json', // Need content type for body
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ price: offer }) // Send the agreed price
            });
            if (res.ok) {
                fetchTasks();
                addToast(`Task accepted at ₹${offer}`, 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to accept task', 'error');
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

            // Get task details first to know the amount and seeker
            const taskRes = await fetch(`${API_URL}/api/tasks/${taskId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const task = await taskRes.json();

            // Process payment from seeker to provider
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
                addToast(err.error || 'Payment failed', 'error');
                return;
            }

            // Mark task as complete
            const completeRes = await fetch(`${API_URL}/api/tasks/${taskId}/complete`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (completeRes.ok) {
                fetchTasks();
                addToast(`Task completed! ₹${task.budget} has been transferred.`, 'success');
                // Trigger Review
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

    async function handleApprovePrice(taskId) {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/approve-price`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchTasks();
                addToast('Price approved! Task is now accepted.', 'success');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to approve price', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
    }

    async function handleRejectPrice(taskId) {
        if (!window.confirm('Reject this price proposal? The task will return to open status.')) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${API_URL}/api/tasks/${taskId}/reject-price`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                fetchTasks();
                addToast('Price rejected. Task returned to open status.', 'info');
            } else {
                const err = await res.json();
                addToast(err.error || 'Failed to reject price', 'error');
            }
        } catch (error) {
            console.error(error);
            addToast('Something went wrong', 'error');
        }
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

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.8rem' }}>Welcome, {userData?.name}</h1>
                    <p style={{ color: 'var(--text-muted)' }}>Find help or earn by helping others.</p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(!showCreate)}>
                    {showCreate ? <X size={20} style={{ marginRight: '0.5rem' }} /> : <Plus size={20} style={{ marginRight: '0.5rem' }} />}
                    {showCreate ? 'Cancel' : 'Request Help'}
                </button>
            </div>

            {showCreate && (
                <div className="card" style={{ marginBottom: '2rem', animation: 'fadeIn 0.3s' }}>
                    <h3 style={{ marginBottom: '1rem' }}>Create New Task</h3>
                    <form onSubmit={handleCreate} style={{ display: 'grid', gap: '1rem', gridTemplateColumns: '1fr 1fr' }}>
                        <input
                            className="input-field"
                            placeholder="Task Title"
                            value={newTask.title}
                            onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                            required
                            style={{ gridColumn: 'span 2' }}
                        />
                        <textarea
                            className="input-field"
                            placeholder="Description (Be specific about what you need help with)"
                            value={newTask.description}
                            onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                            required
                            style={{ gridColumn: 'span 2', minHeight: '100px' }}
                        />
                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                            <select
                                className="input-field"
                                value={newTask.category}
                                onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                            >
                                <option>Debugging</option>
                                <option>Explanation</option>
                                <option>Code Review</option>
                                <option>Tutoring</option>
                                <option>Graphic Design</option>
                                <option>Content Writing</option>
                                <option>Video Editing</option>
                                <option>Other</option>
                            </select>
                            {newTask.category === 'Other' && (
                                <input
                                    className="input-field"
                                    placeholder="Enter category name"
                                    value={newTask.customCategory}
                                    onChange={e => setNewTask({ ...newTask, customCategory: e.target.value })}
                                    required
                                />
                            )}
                        </div>
                        <input
                            type="number"
                            className="input-field"
                            placeholder="Budget (₹)"
                            value={newTask.budget}
                            onChange={e => setNewTask({ ...newTask, budget: e.target.value })}
                            required
                        />
                        <div style={{ gridColumn: 'span 2' }}>
                            <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Deadline</label>
                            <input
                                type="datetime-local"
                                className="input-field"
                                value={newTask.deadline}
                                onChange={e => setNewTask({ ...newTask, deadline: e.target.value })}
                                required
                            />
                        </div>
                        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.5rem', background: '#f59e0b22', borderRadius: 'var(--radius)', border: '1px solid #f59e0b44' }}>
                            <input
                                type="checkbox"
                                id="ethical"
                                checked={newTask.ethicalDisclaimerAgreed}
                                onChange={e => setNewTask({ ...newTask, ethicalDisclaimerAgreed: e.target.checked })}
                            />
                            <label htmlFor="ethical" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                                I confirm this request does not violate academic integrity policies (e.g., this is not exam cheating or plagiarism).
                            </label>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 2' }}>Post Task</button>
                    </form>
                </div>
            )}

            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('all')}>All Tasks</button>
                    <button className={`btn ${filter === 'open' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('open')}>Open Requests</button>
                    <button className={`btn ${filter === 'my-tasks' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setFilter('my-tasks')}>My Tasks</button>
                </div>

                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                        className="input-field"
                        placeholder="Search tasks..."
                        style={{ width: '200px', padding: '0.4rem' }}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Filter by:</span>
                    <select
                        className="input-field"
                        style={{ width: 'auto', padding: '0.4rem' }}
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                        <option value="All">All Categories</option>
                        <option>Debugging</option>
                        <option>Explanation</option>
                        <option>Code Review</option>
                        <option>Tutoring</option>
                        <option>Graphic Design</option>
                        <option>Content Writing</option>
                        <option>Video Editing</option>
                    </select>
                </div>
            </div>

            {loading ? <p>Loading tasks...</p> : (
                <div style={{ display: 'grid', gap: '2rem' }}>
                    {filter === 'my-tasks' ? (
                        <>
                            {/* My Requests Section */}
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--primary)' }}>My Requests</h2>
                                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                    {tasks.filter(t => t.seekerId === currentUser.uid).map(task => (
                                        <TaskCard key={task.id} task={task} />
                                    ))}
                                    {tasks.filter(t => t.seekerId === currentUser.uid).length === 0 && <p style={{ color: 'var(--text-muted)' }}>You haven't posted any tasks yet.</p>}
                                </div>
                            </div>

                            {/* My Jobs Section */}
                            <div>
                                <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', color: 'var(--success)' }}>Tasks I'm Helping With</h2>
                                <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                                    {tasks.filter(t => t.providerId === currentUser.uid).map(task => (
                                        <TaskCard key={task.id} task={task} isProviding={true} />
                                    ))}
                                    {tasks.filter(t => t.providerId === currentUser.uid).length === 0 && <p style={{ color: 'var(--text-muted)' }}>You haven't accepted any tasks to help with yet.</p>}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                            {tasks.map(task => (
                                <TaskCard key={task.id} task={task} />
                            ))}
                            {tasks.length === 0 && <p style={{ color: 'var(--text-muted)', gridColumn: '1/-1', textAlign: 'center' }}>No tasks found.</p>}
                        </div>
                    )}
                </div>
            )}
            {activeChatTask && (
                <Chat
                    taskId={activeChatTask.id}
                    taskTitle={activeChatTask.title}
                    onClose={() => setActiveChatTask(null)}
                />
            )}

            <ReviewModal
                isOpen={!!reviewTask}
                onClose={() => setReviewTask(null)}
                onSubmit={handleReviewSubmit}
                revieweeName="the Helper"
                loading={isSubmittingReview}
            />
        </div>
    );

    // Component-level helper to avoid repetition
    function TaskCard({ task, isProviding = false }) {
        // Get status badge color
        const getStatusColor = (status) => {
            switch (status) {
                case 'open': return '#3b82f6'; // blue
                case 'submitted': return '#0ea5e9'; // light blue
                case 'pending_approval': return '#f59e0b'; // yellow/orange
                case 'accepted': return '#8b5cf6'; // purple
                case 'completed': return '#10b981'; // green
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
                            {task.seekerId === currentUser.uid ? 'Budget: ' : 'Earn: '}₹{task.budget}
                        </span>
                        {task.seekerId === currentUser.uid && task.status === 'open' && (
                            <button
                                onClick={() => handleDelete(task.id)}
                                style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                title="Delete Task"
                            >
                                <Trash size={18} />
                            </button>
                        )}
                    </div>
                </div>
                <span className="badge" style={{ background: 'var(--surface-hover)', fontSize: '0.7rem', alignSelf: 'flex-start', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>{task.category}</span>
                <h3 style={{ marginBottom: '0.5rem' }}>{task.title}</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.5rem', flex: 1 }}>{task.description}</p>

                {/* Author info */}
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', fontStyle: 'italic' }}>
                    Posted by {(task.seekerName && task.seekerName !== 'Unknown') ? task.seekerName : (task.seekerId === currentUser?.uid ? (userData?.name || 'You') : 'Unknown User')}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            <Clock size={16} />
                            <span>{new Date(task.createdAt).toLocaleDateString()}</span>
                        </div>
                        {task.deadline && (
                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }} title={`Deadline: ${new Date(task.deadline).toLocaleString()}`}>
                                <CalendarBlank size={16} color="var(--error)" />
                                <span style={{ color: 'var(--error)' }}>
                                    {new Date(task.deadline).toLocaleDateString()}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Open tasks - show Accept button to non-owners */}
                    {task.status === 'open' && task.seekerId !== currentUser.uid && (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={() => handleAccept(task.id, task.budget)}>
                            Accept
                        </button>
                    )}

                    {/* Pending approval - show price comparison and approve/reject buttons to owner */}
                    {task.status === 'pending_approval' && task.seekerId === currentUser.uid && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                Price: <span style={{ textDecoration: 'line-through' }}>₹{task.originalBudget}</span> → <span style={{ fontWeight: 'bold', color: 'var(--warning)' }}>₹{task.proposedBudget}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    className="btn"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', background: 'var(--error)', color: 'white' }}
                                    onClick={() => handleRejectPrice(task.id)}
                                >
                                    Reject
                                </button>
                                <button
                                    className="btn btn-primary"
                                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                    onClick={() => handleApprovePrice(task.id)}
                                >
                                    Approve
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Submitted Work Display for Seeker */}
                    {(task.status === 'submitted' || task.status === 'completed') && task.submissionDetails && (
                        <div style={{ padding: '0.5rem', background: 'var(--surface-hover)', borderRadius: 'var(--radius)', fontSize: '0.8rem', marginRight: '1rem', flex: 1 }}>
                            <strong>Submission:</strong> {task.submissionDetails}
                        </div>
                    )}

                    {/* Chat Button for Accepted/Submitted Tasks */}
                    {(task.status === 'accepted' || task.status === 'submitted') && (task.seekerId === currentUser.uid || task.providerId === currentUser.uid) && (
                        <button
                            className="btn btn-outline"
                            style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', marginRight: '0.5rem', display: 'flex', alignItems: 'center' }}
                            onClick={() => setActiveChatTask(task)}
                            title="Open Chat"
                        >
                            <ChatCircle size={18} style={{ marginRight: '4px' }} /> Chat
                        </button>
                    )}

                    {/* Accepted/Submitted - Seeker release payment */}
                    {(task.status === 'accepted' || task.status === 'submitted') && task.seekerId === currentUser.uid && (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={() => handleComplete(task.id)}>
                            Release Payment & Complete
                        </button>
                    )}

                    {/* Accepted tasks - Provider Submit Work */}
                    {task.status === 'accepted' && task.providerId === currentUser.uid && (
                        <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={() => handleSubmitWork(task.id)}>
                            Submit Work
                        </button>
                    )}

                    {/* Submitted tasks - Provider Waiting */}
                    {task.status === 'submitted' && task.providerId === currentUser.uid && (
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Waiting for verification</span>
                    )}

                    {/* Completed tasks - show checkmark */}
                    {task.status === 'completed' && (
                        <span style={{ color: 'var(--success)', fontSize: '0.9rem', fontWeight: 'bold' }}>✓ Completed</span>
                    )}
                </div>
            </div >
        );
    }
}
