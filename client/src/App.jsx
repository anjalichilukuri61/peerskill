import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import Navbar from './components/Navbar';
import './animations.css';
// We will create these next
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import Wallet from './components/Wallet';
import Profile from './components/Profile';
import AdminDashboard from './components/AdminDashboard';

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

function PublicRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to="/dashboard" /> : children;
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <div className="container" style={{ paddingBottom: '2rem', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
            <Navbar />
            <div style={{ flex: 1 }}>
              <Routes>
                {/* Redirect root to login */}
                <Route path="/" element={<Navigate to="/login" replace />} />

                {/* Public routes - redirect to dashboard if already logged in */}
                <Route
                  path="/login"
                  element={
                    <PublicRoute>
                      <Login />
                    </PublicRoute>
                  }
                />
                <Route
                  path="/register"
                  element={
                    <PublicRoute>
                      <Register />
                    </PublicRoute>
                  }
                />

                {/* Protected routes */}
                <Route
                  path="/dashboard"
                  element={
                    <PrivateRoute>
                      <Dashboard />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/metrics"
                  element={
                    <PrivateRoute>
                      <Wallet />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/profile"
                  element={
                    <PrivateRoute>
                      <Profile />
                    </PrivateRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <PrivateRoute>
                      <AdminDashboard />
                    </PrivateRoute>
                  }
                />
              </Routes>
            </div>
            <footer style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              &copy; {new Date().getFullYear()} PeerSkill Hub. Ethical Academic Support.
            </footer>
          </div>
        </ToastProvider>
      </AuthProvider>
    </Router >
  );
}

export default App;
