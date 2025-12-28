import { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'phosphor-react';

const ToastContext = createContext();

export function useToast() {
    return useContext(ToastContext);
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = 'info') => {
        const id = Date.now() + Math.random();
        setToasts(prev => [...prev, { id, message, type }]);

        // Auto remove after 3 seconds
        setTimeout(() => {
            removeToast(id);
        }, 3000);
    }, []);

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast, removeToast }}>
            {children}
            <div style={{ position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        style={{
                            background: 'var(--surface)',
                            color: 'var(--text)',
                            border: '1px solid var(--border)',
                            borderLeft: `4px solid ${toast.type === 'error' ? 'var(--error)' : toast.type === 'success' ? 'var(--success)' : 'var(--primary)'}`,
                            borderRadius: 'var(--radius)',
                            padding: '1rem',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                            minWidth: '250px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            animation: 'slideIn 0.3s ease-out'
                        }}
                    >
                        <span style={{ fontSize: '0.9rem' }}>{toast.message}</span>
                        <button onClick={() => removeToast(toast.id)} style={{ background: 'transparent', color: 'var(--text-muted)' }}>
                            <X size={16} />
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
