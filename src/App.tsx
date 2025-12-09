import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Sidebar } from './components/Sidebar/Sidebar';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Chats } from './pages/Chats';
import { Images } from './pages/Images';
import { Archives } from './pages/Archives';
import { Charts } from './pages/Charts';
import { Presentations } from './pages/Presentations';
import { Settings } from './pages/Settings';
import './index.css';

// Loading component
function LoadingScreen() {
  return (
    <div style={{
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
    }}>
      <div className="spinner" style={{ width: 40, height: 40, borderWidth: 3 }} />
    </div>
  );
}

// Protected route wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

// Main app layout
function AppLayout() {
  const { user, userData, loading, logout, refreshUserData } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleCancelPlan = async () => {
    // This will be called from Settings
    // The actual cancellation is handled there
    await refreshUserData();
  };

  return (
    <div className="app-container">
      <Sidebar
        userEmail={userData?.email}
        userPlan={userData?.plan}
        onLogout={logout}
      />
      <main className="main-content">
        <Routes>
          <Route
            path="/"
            element={
              <Home
                tokensUsed={userData?.tokensUsed}
                tokensLimit={userData?.tokensLimit}
                messagesLast30Days={userData?.messagesCount}
                interactionsLast30Days={userData?.interactionsCount}
              />
            }
          />
          <Route path="/chats" element={<Chats />} />
          <Route path="/images" element={<Images />} />
          <Route path="/archives" element={<Archives />} />
          <Route path="/charts" element={<Charts />} />
          <Route path="/presentations" element={<Presentations />} />
          <Route
            path="/settings"
            element={
              <Settings
                userEmail={userData?.email}
                userPlan={userData?.plan}
                tokensUsed={userData?.tokensUsed}
                tokensLimit={userData?.tokensLimit}
                subscriptionId={userData?.subscriptionId}
                onLogout={logout}
                onCancelPlan={handleCancelPlan}
              />
            }
          />
        </Routes>
      </main>
    </div>
  );
}

// Login page wrapper
function LoginPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <Login onAuthSuccess={() => { }} />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
